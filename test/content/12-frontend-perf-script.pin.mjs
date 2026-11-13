// Pin nội dung: script đo Playwright của frontend-performance (AC1.3–AC1.5 của request 2026-11-13-frontend-perf-script).
export default async function run({ ok, ctx }) {
  const { path, pathToFileURL, PLUGINS_DIR } = ctx;
  const perfDir = path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-performance');
  const script = path.join(perfDir, 'scripts', 'playwright-measure.mjs');
  // Import không được mở trình duyệt hay đòi Playwright: repo này không cài Playwright.
  const { assertLocalUrl, parseArgs, median, spread, summarize } = await import(pathToFileURL(script).href);

  ok([assertLocalUrl, parseArgs, median, spread, summarize].every((f) => typeof f === 'function'),
    'import script không cần Playwright và không mở trình duyệt');

  const throws = (fn) =>{ try { fn(); return false; } catch { return true; } };

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
  ok(dflt.runs === 5 && dflt.cpuSlowdown === 4 && dflt.executablePath === null && dflt.out === 'perf/frontend/results',
    'AC1.4 mặc định: runs 5, cpuSlowdown 4, executablePath null, out perf/frontend/results');
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
}
