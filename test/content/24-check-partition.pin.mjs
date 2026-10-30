// Pin: check-partition.mjs kiểm giữa các part cùng nhãn cột Song song của Bảng part (P1 trùng file, P2 file chung, P4 Consumes↔Produces)
// và báo P3 khi plan còn **Song song:** cấp task (docs/requests/2026-10-30-request-parts-aip-workspace, AC2.1–AC2.4).
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, pathToFileURL, CORE_DIR } = ctx;
  const script = path.join(CORE_DIR, 'skills', 'artifact-templates', 'scripts', 'check-partition.mjs');
  if (!fs.existsSync(script)) { ok(false, `P3 AC2.1: thiếu ${script}`); return; }
  const { checkPartition } = await import(pathToFileURL(script).href);

  const design = (rows) => ['# D', '', '## Bảng part', '', '| Part | Phụ thuộc | Song song | Trạng thái |', '|---|---|---|---|',
    ...rows.map(([p, deps = '—', group = '—']) => `| ${p} | ${deps} | ${group} | chưa làm |`), ''].join('\n');
  // spec: { files, consumes, produces } cho một task
  const ptask = (n, { files, consumes, produces, group } = {}) => [
    `### Task ${n}: x`,
    ...(group === undefined ? [] : [`**Song song:** ${group}`]),
    ...(files === undefined ? [] : ['**Files:**', ...files.map((f) => `- Modify: \`${f}\``)]),
    ...(consumes === undefined && produces === undefined ? [] : ['', '**Interfaces:**',
      `- Consumes: ${consumes === undefined ? 'không có' : consumes.map((c) => `\`${c}\``).join(', ')}`,
      `- Produces: ${produces === undefined ? 'không có' : produces.map((c) => `\`${c}\``).join(', ')}`]),
    '',
  ].join('\n');
  const plan = (...tasks) => `# Plan\n\n**Goal:** g\n\n${tasks.join('\n')}`;
  const req = (rows, parts, root) => ({ design: design(rows), parts, plan: root });
  const codes = (r) => checkPartition(r).map((w) => w.code);
  const filesPlan = (...files) => plan(ptask(1, { files }));

  // AC2.1: P1 khi hai part cùng nhãn có mục Files giao nhau
  const rows2 = (ga, gb) => [['01-a', '—', ga], ['02-b', '—', gb]];
  const p1Cases = [
    ['cùng file', rows2('A', 'A'), ['src/a.js'], ['src/a.js'], ['P1']],
    ['glob src/** với src/a.js', rows2('A', 'A'), ['src/**'], ['src/a.js'], ['P1']],
    ['thư mục src/ với src/a/b.js', rows2('A', 'A'), ['src/'], ['src/a/b.js'], ['P1']],
    ['hai file rời nhau', rows2('A', 'A'), ['src/a.js'], ['src/b.js'], []],
    ['glob src/a/** không chạm src/b.js', rows2('A', 'A'), ['src/a/**'], ['src/b.js'], []],
    ['cùng file nhưng nhãn khác', rows2('A', 'B'), ['src/a.js'], ['src/a.js'], []],
    ['cùng file, một part nhãn —', rows2('A', '—'), ['src/a.js'], ['src/a.js'], []],
    ['cùng file, cả hai nhãn —', rows2('—', '—'), ['src/a.js'], ['src/a.js'], []],
    ['nhãn "a" và "A" là một', rows2('a', 'A'), ['src/a.js'], ['src/a.js'], ['P1']],
    ['đường dẫn khác hoa/thường, ./, \\, hậu tố :12-30', rows2('A', 'A'), ['Src\\A.js:12-30'], ['./src/a.js'], ['P1']],
  ];
  for (const [name, rows, fa, fb, want] of p1Cases) {
    const got = codes(req(rows, { '01-a': filesPlan(...fa), '02-b': filesPlan(...fb) }));
    ok(JSON.stringify(got) === JSON.stringify(want), `P3 AC2.1: ${name} → ${want.join(',') || 'không cảnh báo'}`);
  }

  const three = req([['01-a', '—', 'A'], ['02-b', '—', 'A'], ['03-c', '—', 'A']], {
    '01-a': filesPlan('src/a.js'), '02-b': filesPlan('src/b.js'), '03-c': plan(ptask(1, { files: ['src/c.js'] }), ptask(2, { files: ['src/b.js'] })),
  });
  const dup = checkPartition(three);
  ok(dup.length === 1 && dup[0].code === 'P1' && ['02-b', '03-c', 'src/b.js'].every((s) => dup[0].msg.includes(s)), 'P3 AC2.1: tập file của part là hợp mọi task; P1 nêu hai tên part và file trùng');
  const designText = design([['01-a', '—', 'A'], ['02-b', '—', 'A'], ['03-c', '—', 'A']]);
  ok(dup[0]?.file === 'design.md' && dup[0].line === designText.split('\n').findIndex((l) => l.startsWith('| 03-c')) + 1, 'P3 AC2.1: P1 trỏ về hàng part sau trong Bảng part của design.md');

  const same = { '01-a': filesPlan('src/a.js'), '02-b': filesPlan('src/a.js') };
  const lf = req(rows2('A', 'A'), same);
  const crlf = { ...lf, design: '﻿' + lf.design.replace(/\n/g, '\r\n'), parts: Object.fromEntries(Object.entries(same).map(([k, v]) => [k, '﻿' + v.replace(/\n/g, '\r\n')])) };
  ok(JSON.stringify(checkPartition(crlf)) === JSON.stringify(checkPartition(lf)) && checkPartition(crlf).length === 1, 'P3 AC2.1: design và plan CRLF + BOM cho kết quả giống bản LF');
  ok(codes(req(rows2('A', 'A'), { '01-a': filesPlan('src/a.js') })).length === 0, 'P3 AC2.1: part không có plan.md → im (W19 lo)');
  ok(codes({ parts: same }).length === 0 && codes({ design: '# D\n', parts: same }).length === 0, 'P3 AC2.1: không có Bảng part → không P1');

  // AC2.2: P2 khi part trong nhóm ghi file chung
  const shared = ['plugins/_versions.lock.json', 'plugins/backend/.manifest.json', 'docs/specs/hooks-gates/spec.md', 'README.md', 'README_VI.md'];
  const p2 = checkPartition(req([['01-a', '—', 'A']], { '01-a': filesPlan(...shared) }));
  ok(p2.length === shared.length && p2.every((w) => w.code === 'P2' && w.msg.includes('01-a')), 'P3 AC2.2: mỗi file chung của part có nhóm một P2 nêu tên part');
  ok(shared.every((f) => p2.some((w) => w.msg.includes(f.toLowerCase()))), 'P3 AC2.2: P2 nêu từng file chung');
  ok(codes(req([['01-a', '—', '—']], { '01-a': filesPlan(...shared) })).length === 0, 'P3 AC2.2: file chung ở part nhãn — → im');
  ok(codes(req([['01-a', '—', 'A']], { '01-a': filesPlan('docs/README.md', 'plugins/other.lock.json') })).length === 0, 'P3 AC2.2: README ngoài gốc và lock khác không bị P2');

  // AC2.3: **Song song:** cấp task đã bỏ → P3, không còn P1/P2 giữa task
  const grouped = plan(ptask(1, { group: 'A', files: ['src/a.js', 'README.md'] }), ptask(2, { group: 'A', files: ['src/a.js'] }));
  const p3 = checkPartition({ plan: grouped });
  ok(p3.length === 2 && p3.every((w) => w.code === 'P3' && w.file === 'plan.md'), 'P3 AC2.3: plan gốc còn **Song song:** → mỗi dòng một P3, không P1/P2 giữa task');
  ok(p3[0].line === grouped.split('\n').findIndex((l) => l.startsWith('**Song song:**')) + 1 && /Task 1/.test(p3[0].msg), 'P3 AC2.3: P3 trỏ về dòng **Song song:** và nêu task');
  const p3Part = checkPartition(req([['01-a', '—', '—']], { '01-a': grouped }));
  ok(p3Part.length === 2 && p3Part.every((w) => w.code === 'P3' && w.file === 'parts/01-a/plan.md'), 'P3 AC2.3: plan của part còn **Song song:** → P3 nêu parts/<part>/plan.md');
  ok(codes({ plan: plan(ptask(1, { files: ['src/a.js'] }), ptask(2, { files: ['src/a.js'] })) }).length === 0, 'P3 AC2.3: plan không có **Song song:** → im');

  // AC2.4: P4 chỉ khi Consumes của part này trùng Produces của part cùng nhóm
  const ifPlan = (spec) => plan(ptask(1, { files: ['src/x.js'], ...spec }));
  const p4 = (rows, a, b) => checkPartition(req(rows, { '01-a': ifPlan(a), '02-b': ifPlan(b) })).filter((w) => w.code === 'P4');
  const hit = p4(rows2('A', 'A'), { consumes: ['X'] }, { produces: ['X'] });
  ok(hit.length === 1 && ['01-a', '02-b', 'X'].every((s) => hit[0].msg.includes(s)), 'AC2.4: chỉ báo khi Consumes của part này trùng Produces của part kia (cùng nhóm → P4 nêu hai part và tên)');
  ok(p4(rows2('A', 'A'), { produces: ['X'] }, { consumes: ['X'] }).length === 1, 'AC2.4: chiều ngược lại (part sau Consumes, part trước Produces) cũng P4');
  ok(p4([['01-a', '—', 'A'], ['02-b', '01-a', '—']], { produces: ['X'] }, { consumes: ['X'] }).length === 0, 'AC2.4: part B khai Phụ thuộc part A, khác nhóm → im');
  ok(p4(rows2('A', 'A'), { consumes: ['string'] }, { consumes: ['string'] }).length === 0, 'AC2.4: tên chung chỉ xuất hiện ở hai Consumes → im');
  ok(p4(rows2('A', 'A'), { produces: ['X'] }, { produces: ['X'] }).length === 0, 'AC2.4: tên chung chỉ xuất hiện ở hai Produces → im');
  ok(p4(rows2('A', 'B'), { consumes: ['X'] }, { produces: ['X'] }).length === 0, 'AC2.4: nhãn khác nhau → im');
  ok(p4(rows2('A', 'A'), { consumes: ['X'] }, { produces: ['Y'] }).length === 0, 'AC2.4: tên khác nhau → im');
  ok(p4(rows2('A', 'A'), { consumes: ['X'] }, { produces: ['X'] }).every((w) => w.file === 'design.md'), 'AC2.4: P4 trỏ về Bảng part của design.md');

  // CLI
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-partition-'));
  try {
    const run = (args) => {
      try { return { code: 0, out: execFileSync('node', [script, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
      catch (e) { return { code: e.status, out: `${e.stdout || ''}` }; }
    };
    fs.writeFileSync(path.join(tmp, 'design.md'), lf.design);
    for (const [name, text] of Object.entries(same)) {
      fs.mkdirSync(path.join(tmp, 'parts', name), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'parts', name, 'plan.md'), text);
    }
    const plain = run([tmp]);
    ok(plain.code === 0 && /^WARN design\.md:\d+ \[P1\] /m.test(plain.out) && /1 cảnh báo/.test(plain.out), 'P3 AC2.1: CLI không --strict → exit 0 và in dòng [P1] của design.md');
    ok(run([tmp, '--strict']).code === 1, 'P3 AC2.1: CLI --strict có cảnh báo → exit 1');
    fs.writeFileSync(path.join(tmp, 'plan.md'), grouped);
    ok(/^WARN plan\.md:\d+ \[P3\] /m.test(run([tmp]).out), 'P3 AC2.3: CLI đọc plan.md gốc và in dòng [P3]');
    ok(run([]).code === 2 && run([tmp, '--bogus']).code === 2, 'P3 CLI: thiếu đối số hoặc cờ lạ → exit 2');
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-partition-'));
    try {
      const r = run([empty, '--strict']);
      ok(r.code === 0 && /0 cảnh báo/.test(r.out), 'P3 AC2.3: thư mục không có plan.md, design.md → exit 0, 0 cảnh báo');
    } finally { fs.rmSync(empty, { recursive: true, force: true }); }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
