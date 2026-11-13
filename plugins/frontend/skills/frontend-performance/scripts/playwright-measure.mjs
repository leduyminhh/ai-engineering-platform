#!/usr/bin/env node
// Script mẫu đo LCP, CLS và TBT xấp xỉ bằng Playwright trên bản build production phục vụ ở local.
// Chép vào perf/<phía>/ của project (vd perf/frontend/measure.mjs): ESM resolve `playwright` theo vị trí file script, nên file phải nằm trong cây có node_modules.
// Cách dùng: node perf/frontend/measure.mjs --url http://localhost:4173/ [--runs 5] [--out perf/frontend/results] [--cpu-slowdown 4] [--executable-path <chromium>]
// Exit 0 đo xong, 2 sai đối số hoặc URL ngoài local, 3 không mở được trình duyệt (agent báo not_run).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function assertLocalUrl(url) {
  const u = new URL(url);
  // So hostname nguyên văn: `localhost.evil.com` không được lọt qua kiểm tiền tố.
  if (!['http:', 'https:'].includes(u.protocol) || !LOCAL_HOSTS.has(u.hostname)) {
    throw new Error(`chỉ đo URL local (localhost, 127.0.0.1, [::1]); nhận: ${url}`);
  }
  return u;
}

export function parseArgs(argv) {
  const opts = { url: null, runs: 5, out: 'perf/frontend/results', cpuSlowdown: 4, executablePath: null };
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (value === undefined) throw new Error(`thiếu giá trị cho ${flag}`);
    if (flag === '--url') opts.url = value;
    else if (flag === '--runs') opts.runs = Number(value);
    else if (flag === '--out') opts.out = value;
    else if (flag === '--cpu-slowdown') opts.cpuSlowdown = Number(value);
    else if (flag === '--executable-path') opts.executablePath = value;
    else throw new Error(`cờ không hỗ trợ: ${flag}`);
  }
  if (!opts.url) throw new Error('thiếu --url');
  if (!Number.isInteger(opts.runs) || opts.runs < 3) throw new Error('--runs phải là số nguyên ≥ 3 (P3)');
  if (!Number.isFinite(opts.cpuSlowdown) || opts.cpuSlowdown < 0) throw new Error('--cpu-slowdown phải ≥ 0 (0 = tắt)');
  return opts;
}

// Số lần chẵn lấy phần tử trên giữa, không nội suy, để số báo cáo luôn là một giá trị đo thật.
export const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// Median bằng 0 (hay gặp ở CLS) thì độ lệch tương đối vô nghĩa: trả null thay vì Infinity hoặc NaN.
export function spread(xs) {
  const m = median(xs);
  return m === 0 ? null : (Math.max(...xs) - Math.min(...xs)) / m;
}

export function summarize(runs) {
  const out = {};
  for (const k of ['lcp', 'tbt', 'cls']) {
    const raw = runs.map((r) => r[k]);
    out[k] = { median: median(raw), spread: spread(raw), raw };
  }
  return out;
}

// Nạp trong hàm, không ở đầu file, để test import được các hàm thuần khi repo chưa cài Playwright; chỉ chạy trực tiếp mới cần trình duyệt.
async function loadChromium() {
  for (const pkg of ['playwright', '@playwright/test']) {
    try {
      return { pkg, chromium: (await import(pkg)).chromium };
    } catch (e) {
      if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
    }
  }
  throw new Error('không nạp được playwright hay @playwright/test; chép script vào cây thư mục của project đã khai Playwright (có node_modules ở thư mục cha)');
}

// Context mới mỗi lần để cache lạnh; PerformanceObserver gắn trước khi trang chạy để không mất entry sớm.
async function measureOnce(browser, url, cpuSlowdown) {
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    if (cpuSlowdown > 0) {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuSlowdown });
    }
    await page.addInitScript(() => {
      const m = (window.__perf = { lcp: 0, cls: 0, fcp: 0, long: [] });
      const watch = (type, fn) => new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true });
      watch('largest-contentful-paint', (e) => { m.lcp = e.startTime; });
      watch('layout-shift', (e) => { if (!e.hadRecentInput) m.cls += e.value; });
      watch('paint', (e) => { if (e.name === 'first-contentful-paint') m.fcp = e.startTime; });
      watch('longtask', (e) => m.long.push([e.startTime, e.duration]));
    });
    await page.goto(url, { waitUntil: 'load' });
    // App local có thể redirect ra host ngoài (vd đăng nhập OAuth); P1 phải giữ cả sau điều hướng.
    assertLocalUrl(page.url());
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const m = await page.evaluate(() => window.__perf);
    // TBT xấp xỉ: Lighthouse tính trong FCP–TTI với throttle mô phỏng, ở đây chỉ cộng phần vượt 50 ms của long task sau FCP.
    const tbt = m.long.filter(([start]) => start >= m.fcp).reduce((sum, [, d]) => sum + Math.max(0, d - 50), 0);
    return { lcp: m.lcp, tbt, cls: m.cls };
  } finally {
    await ctx.close();
  }
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
    assertLocalUrl(opts.url);
  } catch (e) {
    console.error(`lỗi: ${e.message}`);
    process.exit(2);
  }
  const { pkg, chromium } = await loadChromium();
  let browser;
  try {
    browser = await chromium.launch(opts.executablePath ? { executablePath: opts.executablePath } : {});
  } catch (e) {
    console.error(`not_run: không mở được Chromium (${e.message.split('\n')[0]}); cài hoặc trỏ --executable-path, script không tự tải`);
    process.exit(3);
  }
  // Lấy phiên bản khi trình duyệt còn mở: sau close() Playwright không bảo đảm trả được.
  const chromiumVersion = browser.version();
  const results = [];
  try {
    // Lần đầu sau khi mở trình duyệt bị lệch (paint trễ, mất CLS/TBT); đo một lần bỏ đi trước.
    await measureOnce(browser, opts.url, opts.cpuSlowdown);
    for (let i = 1; i <= opts.runs; i++) {
      const r = await measureOnce(browser, opts.url, opts.cpuSlowdown);
      if (!(r.lcp > 0)) throw new Error(`lần ${i} không lấy được LCP; kiểm URL và bản build`);
      results.push(r);
    }
    fs.mkdirSync(opts.out, { recursive: true });
    const meta = { url: opts.url, package: pkg, chromium: chromiumVersion, cpuSlowdown: opts.cpuSlowdown, warmup: 1 };
    results.forEach((r, i) => fs.writeFileSync(path.join(opts.out, `run-${i + 1}.json`), JSON.stringify({ ...meta, ...r }, null, 2)));
  } finally {
    await browser.close();
  }
  console.log(`công cụ: ${pkg}, Chromium ${chromiumVersion}, CPU slowdown ${opts.cpuSlowdown || 'không throttle'}, warm-up 1 (bỏ)`);
  const s = summarize(results);
  for (const k of ['lcp', 'tbt', 'cls']) {
    const sp = s[k].spread === null ? 'không xác định' : s[k].spread.toFixed(3);
    console.log(k, 'median', s[k].median, 'độ lệch', sp, 'thô', s[k].raw.join(', '));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`lỗi: ${e.message}`); process.exit(1); });
}
