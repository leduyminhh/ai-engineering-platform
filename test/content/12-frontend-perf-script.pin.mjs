// Pin nội dung: script đo Playwright của frontend-performance (AC1.3–AC1.5 của request 2026-11-13-frontend-perf-script).
export default async function run({ ok, ctx }) {
  const { path, pathToFileURL, PLUGINS_DIR } = ctx;
  const perfDir = path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-performance');
  const script = path.join(perfDir, 'scripts', 'playwright-measure.mjs');
  // Import không được mở trình duyệt hay đòi Playwright: repo này không cài Playwright.
  const { assertLocalUrl, parseArgs, median, spread, summarize } = await import(pathToFileURL(script).href);

  ok([assertLocalUrl, parseArgs, median, spread, summarize].every((f) => typeof f === 'function'),
    'import script không cần Playwright và không mở trình duyệt');

  const throws = (fn) => { try { fn(); return false; } catch { return true; } };

  // AC1.3: P1 — chỉ host local, kể cả host lừa có tiền tố local.
  for (const [url, valid] of [
    ['http://localhost:4173/', true],
    ['http://127.0.0.1:4173/', true],
    ['http://[::1]:4173/', true],
    ['https://example.com/', false],
    ['http://localhost.evil.com/', false],
    ['http://127.0.0.1.evil.com/', false],
    ['file:///etc/passwd', false],
  ]) {
    ok(throws(() => assertLocalUrl(url)) === !valid, `AC1.3 assertLocalUrl(${url}) ${valid ? 'hợp lệ' : 'bị từ chối'}`);
  }

  // AC1.4: P3 — tối thiểu 3 lần; mặc định và throttle sau spike.
  const base = ['--url', 'http://localhost:4173/'];
  ok(throws(() => parseArgs(['--runs', '3'])), 'AC1.4 thiếu --url bị từ chối');
  for (const [runs, valid] of [['2', false], ['0', false], ['3', true]]) {
    ok(throws(() => parseArgs([...base, '--runs', runs])) === !valid, `AC1.4 --runs ${runs} ${valid ? 'hợp lệ' : 'bị từ chối'}`);
  }
  const dflt = parseArgs(base);
  ok(dflt.runs === 5 && dflt.cpuSlowdown === 4 && dflt.executablePath === null && dflt.out === 'perf/frontend/results/playwright',
    'AC1.4 mặc định: runs 5, cpuSlowdown 4, executablePath null, out perf/frontend/results/playwright');
  ok(parseArgs([...base, '--cpu-slowdown', '0']).cpuSlowdown === 0, 'AC1.4 --cpu-slowdown 0 tắt throttle');

  // AC1.5: median phần tử trên giữa, độ lệch (max − min) / median, null khi median bằng 0.
  for (const [xs, med, spr] of [
    [[100, 120, 110, 130], 120, 0.25],
    [[3, 1, 2], 2, 1],
    [[0, 0, 0], 0, null],
    [[0, 0, 0.09], 0, null],
  ]) {
    ok(median(xs) === med, `AC1.5 median([${xs}]) = ${med}`);
    ok(spread(xs) === spr, `AC1.5 spread([${xs}]) = ${spr}`);
  }
  const s = summarize([{ lcp: 100, tbt: 0, cls: 0 }, { lcp: 120, tbt: 0, cls: 0 }, { lcp: 110, tbt: 0, cls: 0 }, { lcp: 130, tbt: 0, cls: 0 }]);
  ok(s.lcp.median === 120 && s.lcp.spread === 0.25 && s.lcp.raw.join() === '100,120,110,130', 'AC1.5 summarize giữ median, độ lệch và dãy thô');
  ok(s.cls.spread === null && s.tbt.spread === null, 'AC1.5 summarize: median 0 cho độ lệch null, không Infinity/NaN');

  // Pin vận hành của tài liệu frontend-performance (AC1.1, AC1.2, AC2.1, AC3.1).
  const { fs } = ctx;
  const perfRoot = path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-performance');
  const perfRead = (p) => fs.readFileSync(path.join(perfRoot, p), 'utf8');
  const skillText = perfRead('SKILL.md');
  const order = ['(a)', '(b)', '(c)', '(d)'].map((m) => skillText.indexOf(m));
  ok(order.every((i) => i >= 0) && order.every((i, k) => k === 0 || i > order[k - 1]),
    'AC1.1 SKILL.md: thứ tự chọn công cụ (a) → (b) → (c) → (d)');
  ok(skillText.includes('(scripts/playwright-measure.mjs)') && skillText.includes('`package.json`'),
    'AC1.1 SKILL.md: nhánh (c) trỏ script mẫu và điều kiện khai trong package.json');
  ok(skillText.includes('Hỏi trước khi thêm tool/dependency'), 'AC1.2 SKILL.md: giữ quy tắc "Hỏi trước khi thêm tool/dependency"');
  for (const f of ['SKILL.md', 'references/measure-conditions.md', 'references/lighthouse-cli.md']) {
    const t = perfRead(f);
    ok(t.includes('results/') && !t.includes('perf/frontend/run-'), `AC3.1 ${f}: output ở results/, không còn perf/frontend/run-`);
  }
  const mcText = perfRead('references/measure-conditions.md');
  ok(mcText.includes('PerformanceObserver') && mcText.includes('xấp xỉ'),
    'AC2.1 measure-conditions.md: LCP/CLS bằng PerformanceObserver, TBT ghi xấp xỉ');

  // AC1.5 (vận hành): median 0 cho độ lệch "không xác định", cả script summarize của Lighthouse lẫn quy tắc P3.
  const lhText = perfRead('references/lighthouse-cli.md');
  const lhSpread = lhText.slice(lhText.indexOf('const spread'), lhText.indexOf('```', lhText.indexOf('const spread')));
  ok(lhSpread.includes('=== 0') && lhSpread.includes('null') && lhSpread.includes('không xác định'),
    'AC1.5 lighthouse-cli.md: script summarize bắt median 0, trả null và in "không xác định"');
  ok(mcText.includes('không xác định'), 'AC1.5 measure-conditions.md: P3 nêu độ lệch "không xác định" khi median 0');

  // Pin vận hành của frontend-init (AC4.1): bước .gitignore giữ đủ bốn dòng và quy tắc không ghi đè.
  const initText = fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-init', 'SKILL.md'), 'utf8');
  // Chỉ xét đoạn bước 2: các dòng này còn xuất hiện ở nơi khác trong file, pin toàn file sẽ xanh giả khi bước bị xoá.
  const gitignoreStart = initText.indexOf('### 2.');
  const gitignoreSection = initText.slice(gitignoreStart, initText.indexOf('### 3.', gitignoreStart));
  ok(gitignoreStart >= 0 && gitignoreSection.includes('.gitignore'), 'AC4.1 frontend-init SKILL.md: có mục bước 2 về .gitignore');
  for (const line of ['.playwright-mcp/', 'perf/**/results/', 'dist/', 'node_modules/']) {
    ok(gitignoreSection.includes(line), `AC4.1 frontend-init SKILL.md bước 2: có dòng .gitignore ${line}`);
  }
  ok(gitignoreSection.toLowerCase().includes('không ghi đè'), 'AC4.1 frontend-init SKILL.md bước 2: nêu "không ghi đè"');
  ok(initText.split('---')[1].includes('disable-model-invocation: true'),
    'AC4.1 frontend-init SKILL.md: frontmatter giữ disable-model-invocation: true');
}
