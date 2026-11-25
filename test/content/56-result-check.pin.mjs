// Pin: docs/requests/2026-11-25-agent-session-result-contract — result-check.mjs (dòng aip-report, agent_result) và tài liệu đi kèm.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export default async function run({ ok, ctx }) {
  const { fs, path, os, pathToFileURL, REPO_ROOT } = ctx;
  const scriptPath = path.join(REPO_ROOT, 'core', 'skills', 'plan-execution', 'scripts', 'result-check.mjs');
  if (!fs.existsSync(scriptPath)) { ok(false, 'AC3.1: result-check.mjs tồn tại'); return; }
  const rc = await import(pathToFileURL(scriptPath).href);
  const roots = [];
  const write = (name, body) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'result-check-'));
    roots.push(root);
    const abs = path.join(root, name);
    fs.writeFileSync(abs, body);
    return abs;
  };
  const cli = (args) => {
    const r = spawnSync(process.execPath, [scriptPath, ...args], { encoding: 'utf8' });
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* exit 2 không in JSON */ }
    return { code: r.status, json };
  };
  const rules = (res) => res.violations.map((v) => v.rule);

  try {
    // AC2.1–AC2.5: dòng aip-report
    const GOOD = 'aip-report v1 from=part-02 status=complete hash=abc1234 tests=pass minor=2 file=.aip/runs/x/02-y/progress.md';
    // note giữ dưới trần 120 nên phần đệm nằm ở file=; chữ có dấu kiểm cách đếm code point.
    const pad = (n) => {
      const head = 'aip-report v1 from=part-02 status=blocked note="thiếu quyền ghi" file=';
      return `${head}${'ệ'.repeat(n - [...head].length)}`;
    };
    const LINES = [
      ['AC2.1: dòng mẫu hợp lệ', GOOD, true],
      ['AC2.2: complete thiếu hash', 'aip-report v1 from=part-02 status=complete tests=pass', false, 'hash'],
      ['AC2.2: complete thiếu tests', 'aip-report v1 from=part-02 status=complete hash=abc1234', false, 'tests'],
      ['AC2.3: blocked thiếu note', 'aip-report v1 from=root status=blocked', false, 'note'],
      ['AC2.3: failed thiếu note', 'aip-report v1 from=root status=failed', false, 'note'],
      ['AC2.3: blocked có note', 'aip-report v1 from=root status=blocked note="thiếu quyền ghi .aip"', true],
      ['AC2.5: thiếu v1', 'aip-report from=root status=blocked note="x"', false],
      ['AC2.5: status ngoài tập', 'aip-report v1 from=root status=done hash=abc1234 tests=pass', false],
      ['AC2.5: giá trị có khoảng trắng ngoài note', 'aip-report v1 from=part 02 status=complete hash=abc1234 tests=pass', false],
      ['note chứa = và khoảng trắng', 'aip-report v1 from=root status=failed note="a=b c  d"', true],
      ['dòng kết thúc \\r', `${GOOD}\r`, true],
      ['nhiều dòng', `${GOOD}\n${GOOD}`, false],
    ];
    for (const [name, line, good, key] of LINES) {
      const res = rc.checkReportLine(line);
      ok(res.ok === good && (good ? res.violations.length === 0 : res.violations.length > 0), name);
      if (key) ok(res.violations.some((v) => v.detail.includes(key)), `${name}: detail nêu ${key}`);
    }
    // AC2.4: trần đếm theo code point, note có chữ tiếng Việt có dấu
    const at400 = pad(400);
    const at401 = pad(401);
    ok([...at400].length === 400 && [...at401].length === 401, 'AC2.4: dựng đúng dòng 400 và 401 code point');
    ok(rc.checkReportLine(at400).ok === true, 'AC2.4: 400 code point đạt');
    ok(rules(rc.checkReportLine(at401)).includes('line-too-long'), 'AC2.4: 401 code point vi phạm line-too-long');

    // AC3.1: CLI --line và đối số sai
    const good = cli(['--line', GOOD]);
    ok(good.code === 0 && good.json?.ok === true && Array.isArray(good.json.violations) && Array.isArray(good.json.not_run),
      'AC3.1: --line hợp lệ exit 0, JSON { ok, violations, not_run }');
    const bad = cli(['--line', 'aip-report v1 from=root status=blocked']);
    ok(bad.code === 1 && bad.json?.ok === false && bad.json.violations.every((v) => v.rule && v.detail),
      'AC3.1: --line vi phạm exit 1, violations có rule và detail');
    const report = write('task-1-report.md', 'agent_result:\n  status: completed\n  summary: "x"\n');
    const dir = path.dirname(report);
    for (const [name, args] of [
      ['không đối số', []],
      ['thiếu --role', [report]],
      ['--role lạ', [report, '--role', 'foo']],
      ['file không tồn tại', [path.join(dir, 'missing.md'), '--role', 'worker']],
      ['đường dẫn là thư mục', [dir, '--role', 'worker']],
      ['--plan không kèm --task', [report, '--role', 'worker', '--plan', report]],
    ]) ok(cli(args).code === 2, `AC3.1: ${name} → exit 2`);

    // AC3.7: script chỉ đọc file và chỉ import node:* và ./task-brief.mjs
    const sha = () => createHash('sha256').update(fs.readFileSync(report)).digest('hex');
    const before = sha();
    cli([report, '--role', 'worker']);
    ok(sha() === before, 'AC3.7: file report không đổi sau khi chạy script');
    const src = fs.readFileSync(scriptPath, 'utf8');
    const imports = [...src.matchAll(/^import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    ok(imports.length > 0 && imports.every((s) => s.startsWith('node:') || s === './task-brief.mjs'),
      `AC3.7: import chỉ node:* và ./task-brief.mjs (có: ${imports.join(', ')})`);
  } finally {
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
  }
}
