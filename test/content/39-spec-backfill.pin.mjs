// Pin nội dung: check-citations.mjs của engineering-spec-backfill (trích dẫn `file:line` trong spec sống).
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, pathToFileURL, PLUGINS_DIR } = ctx;
  const script = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-spec-backfill', 'scripts', 'check-citations.mjs');
  const { checkCitations } = await import(pathToFileURL(script).href);

  const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-citations-'));
  const root = path.join(outer, 'repo');
  try {
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'a.js'), 'l1\nl2\nl3\nl4\nl5\n');
    fs.writeFileSync(path.join(root, 'src', 'crlf.js'), 'l1\r\nl2\r\nl3\r\nl4\r\nl5\r\n');
    // File có thật ngoài root: ca thoát root phải báo vì ra ngoài, không phải vì file không tồn tại.
    fs.writeFileSync(path.join(outer, 'outside.js'), 'l1\n');
    const spec = (body) => ['# Spec: x', '', '## Yêu cầu', '', body, ''].join('\n');
    const cases = [
      { name: 'dòng nằm trong file', body: '- **x/R1** — a. Nguồn: `src/a.js:3`, test `t`', want: 0 },
      { name: 'dòng cuối file', body: '- **x/R1** — a. Nguồn: `src/a.js:5`', want: 0 },
      { name: 'dòng 0', body: '- **x/R1** — a. Nguồn: `src/a.js:0`', want: 1 },
      { name: 'dòng vượt cuối file', body: '- **x/R1** — a. Nguồn: `src/a.js:6`', want: 1 },
      { name: 'file không tồn tại', body: '- **x/R1** — a. Nguồn: `src/b.js:1`', want: 1 },
      { name: 'range', body: '- **x/R1** — a. Nguồn: `src/a.js:1-3`', want: 1 },
      { name: 'danh sách dòng', body: '- **x/R1** — a. Nguồn: `src/a.js:1,3`', want: 1 },
      { name: 'dòng:cột', body: '- **x/R1** — a. Nguồn: `src/a.js:1:5`', want: 1 },
      { name: 'khoảng trắng sau số', body: '- **x/R1** — a. Nguồn: `src/a.js:3 `', want: 1 },
      { name: 'khoảng trắng sau dấu hai chấm', body: '- **x/R1** — a. Nguồn: `src/a.js: 3`', want: 1 },
      { name: 'URL không phải trích dẫn', body: '- **x/R1** — a. Gọi `http://localhost/x`', want: 0 },
      { name: 'file CRLF, dòng cuối', body: '- **x/R1** — a. Nguồn: `src/crlf.js:5`', want: 0 },
      { name: 'file CRLF, vượt cuối', body: '- **x/R1** — a. Nguồn: `src/crlf.js:6`', want: 1 },
      { name: '[Unverified] không có file:line', body: '- **x/R1** — a. Nguồn: [Unverified] suy từ code', want: 0 },
      { name: 'hai trích dẫn, một hỏng', body: '- **x/R1** — a. Nguồn: `src/a.js:1`, `src/a.js:9`', want: 1 },
    ];
    for (const c of cases) ok(checkCitations(spec(c.body), { root }).length === c.want, `AC5.4: checkCitations — ${c.name}`);
    const bad = checkCitations(spec('- **x/R1** — a. Nguồn: `src/a.js:6`'), { root })[0];
    ok(bad && bad.line === 5 && bad.ref === 'src/a.js:6' && bad.reason.length > 0, 'AC5.4: lỗi nêu dòng của spec, trích dẫn và lý do');
    const escape = checkCitations(spec('- **x/R1** — a. Nguồn: `../outside.js:1`'), { root });
    ok(escape.length === 1 && escape[0].reason === 'đường dẫn nằm ngoài root', 'AC5.4: file có thật ngoài root vẫn bị chặn, lý do là ngoài root');
    const crlfSpec = checkCitations(['# Spec: x', '', '- **x/R1** — a. Nguồn: `src/a.js:9`', ''].join('\r\n'), { root })[0];
    ok(crlfSpec && crlfSpec.line === 3, 'AC5.4: spec CRLF vẫn báo đúng số dòng');

    const specs = path.join(root, 'docs', 'specs', 'x');
    fs.mkdirSync(specs, { recursive: true });
    const cli = (...a) => {
      try { execFileSync(process.execPath, [script, ...a], { stdio: 'pipe' }); return 0; } catch (e) { return e.status; }
    };
    fs.writeFileSync(path.join(specs, 'spec.md'), spec('- **x/R1** — a. Nguồn: `src/a.js:2`'));
    ok(cli(path.join(root, 'docs', 'specs'), '--root', root) === 0, 'AC5.4: CLI thư mục specs sạch → exit 0');
    fs.writeFileSync(path.join(specs, 'spec.md'), spec('- **x/R1** — a. Nguồn: `src/a.js:42`'));
    ok(cli(path.join(specs, 'spec.md'), '--root', root) === 1, 'AC5.4: CLI có trích dẫn hỏng → exit 1');
    ok(cli() === 2, 'AC5.4: CLI thiếu đối số → exit 2');
  } finally {
    fs.rmSync(outer, { recursive: true, force: true });
  }
}
