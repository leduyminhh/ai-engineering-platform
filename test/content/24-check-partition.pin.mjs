// Pin: check-partition.mjs cảnh báo task cùng nhóm **Song song:** ghi trùng file (P1) hoặc file chung (P2) (docs/requests/2026-10-22-parallel-agents, AC2.1–AC2.3).
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, pathToFileURL, CORE_DIR } = ctx;
  const script = path.join(CORE_DIR, 'skills', 'artifact-templates', 'scripts', 'check-partition.mjs');
  if (!fs.existsSync(script)) { ok(false, `P3 AC2.1: thiếu ${script}`); return; }
  const { checkPartition } = await import(pathToFileURL(script).href);

  const task = (n, group, files, heading = `### Task ${n}: x`) => [
    heading,
    ...(group === undefined ? [] : [`**Song song:** ${group}`]),
    ...(files === undefined ? [] : ['**Files:**', ...files.map((f) => `- Modify: \`${f}\``)]),
    '',
  ].join('\n');
  const plan = (...tasks) => `# Plan\n\n**Goal:** g\n\n${tasks.join('\n')}`;
  const codes = (text) => checkPartition(text).map((w) => w.code);

  // AC2.1: P1 khi hai task cùng nhóm có mục trùng nhau
  const p1Cases = [
    ['cùng file', plan(task(1, 'A', ['src/a.js']), task(2, 'A', ['src/a.js'])), ['P1']],
    ['glob src/** với src/a.js', plan(task(1, 'A', ['src/**']), task(2, 'A', ['src/a.js'])), ['P1']],
    ['thư mục src/ với src/a/b.js', plan(task(1, 'A', ['src/']), task(2, 'A', ['src/a/b.js'])), ['P1']],
    ['hai file rời nhau', plan(task(1, 'A', ['src/a.js']), task(2, 'A', ['src/b.js'])), []],
    ['glob src/a/** không chạm src/b.js', plan(task(1, 'A', ['src/a/**']), task(2, 'A', ['src/b.js'])), []],
    ['cùng file nhưng nhóm khác', plan(task(1, 'A', ['src/a.js']), task(2, 'B', ['src/a.js'])), []],
    ['một task không có nhóm', plan(task(1, 'A', ['src/a.js']), task(2, undefined, ['src/a.js'])), []],
    ['nhóm "a" và "A " là một', plan(task(1, 'a', ['src/a.js']), task(2, 'A ', ['src/a.js'])), ['P1']],
    ['đường dẫn khác hoa/thường, ./, \\, hậu tố :12-30', plan(task(1, 'A', ['Src\\A.js:12-30']), task(2, 'A', ['./src/a.js'])), ['P1']],
    ['heading ## Task 2 — x', plan(task(1, 'A', ['src/a.js']), task(2, 'A', ['src/a.js'], '## Task 2 — x')), ['P1']],
  ];
  for (const [name, text, want] of p1Cases) {
    ok(JSON.stringify(codes(text)) === JSON.stringify(want), `P3 AC2.1: ${name} → ${want.join(',') || 'không cảnh báo'}`);
  }

  const lineOf = (text, head) => text.split('\n').findIndex((l) => l.startsWith(head)) + 1;
  const lf = plan(task(1, 'A', ['src/a.js']), task(2, 'A', ['src/a.js']));
  const dup = checkPartition(lf);
  ok(dup.length === 1 && ['Task 1', 'Task 2', 'src/a.js'].every((s) => dup[0].msg.includes(s)), 'P3 AC2.1: P1 nêu hai task và file trùng');
  ok(dup[0]?.line === lineOf(lf, '### Task 2'), 'P3 AC2.1: P1 trỏ về dòng heading của task sau');

  const crlf = '\uFEFF' + lf.replace(/\n/g, '\r\n');
  ok(JSON.stringify(checkPartition(crlf)) === JSON.stringify(checkPartition(lf)) && checkPartition(crlf).length === 1, 'P3 AC2.1: plan CRLF + BOM cho kết quả giống bản LF');


  // AC2.2: P2 khi task có nhóm ghi file chung
  const shared = ['plugins/_versions.lock.json', 'plugins/backend/.manifest.json', 'docs/specs/hooks-gates/spec.md', 'README.md', 'README_VI.md'];
  const p2 = checkPartition(plan(task(1, 'A', shared)));
  ok(p2.length === shared.length && p2.every((w) => w.code === 'P2'), 'P3 AC2.2: mỗi file chung của task có nhóm một P2');
  ok(shared.every((f) => p2.some((w) => w.msg.includes(f.toLowerCase()))), 'P3 AC2.2: P2 nêu từng file chung');
  ok(codes(plan(task(1, undefined, shared))).length === 0, 'P3 AC2.2: file chung ở task không nhóm → im');
  ok(codes(plan(task(1, 'A', ['docs/README.md', 'plugins/other.lock.json']))).length === 0, 'P3 AC2.2: README ngoài gốc và lock khác không bị P2');

  // AC2.3: chọn tham gia
  ok(codes(plan(task(1, undefined, ['src/a.js']), task(2, undefined, ['src/a.js']))).length === 0, 'P3 AC2.3: plan không có **Song song:** → im');
  ok(codes(plan(task(1, 'A'), task(2, 'A', ['src/a.js']))).length === 0, 'P3 AC2.3: task có nhóm nhưng thiếu **Files:** → im');

  // CLI
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-partition-'));
  try {
    const run = (args) => {
      try { return { code: 0, out: execFileSync('node', [script, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
      catch (e) { return { code: e.status, out: `${e.stdout || ''}` }; }
    };
    fs.writeFileSync(path.join(tmp, 'plan.md'), lf);
    const plain = run([tmp]);
    ok(plain.code === 0 && /^WARN plan\.md:\d+ \[P1\] /m.test(plain.out) && /1 cảnh báo/.test(plain.out), 'P3 AC2.1: CLI không --strict → exit 0 và in dòng [P1]');
    ok(run([tmp, '--strict']).code === 1, 'P3 AC2.1: CLI --strict có cảnh báo → exit 1');
    ok(run([]).code === 2 && run([tmp, '--bogus']).code === 2, 'P3 CLI: thiếu đối số hoặc cờ lạ → exit 2');
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-partition-'));
    try {
      const r = run([empty, '--strict']);
      ok(r.code === 0 && /0 cảnh báo/.test(r.out), 'P3 AC2.3: thư mục không có plan.md → exit 0, 0 cảnh báo');
    } finally { fs.rmSync(empty, { recursive: true, force: true }); }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
