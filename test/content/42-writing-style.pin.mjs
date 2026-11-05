// Pin nội dung: scan-style.mjs của engineering-writing-style (AC2.1, AC2.2) và bảng cụm vi/en (AC1.2).
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, pathToFileURL, PLUGINS_DIR } = ctx;
  const skill = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-writing-style');
  const script = path.join(skill, 'scripts', 'scan-style.mjs');
  const { loadPatterns, scanText } = await import(pathToFileURL(script).href);
  const patterns = loadPatterns(path.join(skill, 'references'));

  const cases = [
    { name: 'văn xuôi tiếng Việt', text: 'Mở đầu.\nTóm lại, xong.', want: [2] },
    { name: 'văn xuôi tiếng Anh', text: 'We delve into it.', want: [1] },
    { name: 'không phân biệt hoa thường', text: 'TÓM LẠI xong. IN CONCLUSION done.', want: [1, 1] },
    { name: 'fenced block ```', text: '```\nTóm lại\n```\nxong', want: [] },
    { name: 'fenced block ~~~', text: '~~~\ndelve\n~~~', want: [] },
    { name: 'inline code', text: 'Gọi `delve` và `Tóm lại` ở đây.', want: [] },
    { name: 'URL', text: 'Xem https://example.com/delve/tóm-lại ở đây.', want: [] },
    { name: 'dòng trích dẫn', text: '  > Tóm lại, delve', want: [] },
    { name: 'ranh giới từ: robustness không khớp robust', text: 'Test the robustness of it.', want: [] },
    { name: 'ranh giới từ: robust khớp', text: 'A robust system.', want: [1] },
    { name: 'fence ``` chứa ~~~ bên trong, sau khi đóng vẫn quét', text: '```\n~~~\ndelve\n```\nTóm lại', want: [5] },
    { name: 'fence 4 backtick chứa dòng ``` không đóng sớm', text: '````\n```\ndelve\n````\nTóm lại', want: [5] },
    { name: 'fence không đóng: phần còn lại là code', text: '```\nTóm lại', want: [] },
    { name: 'inline code nhiều backtick', text: '``a`b delve`` thật', want: [] },
    { name: 'văn bản NFD vẫn khớp', text: 'Tóm lại, xong.'.normalize('NFD'), want: [1] },
    { name: 'khớp dài nhất, không báo trùng', text: 'Nói tóm lại, xong.', want: [1] },
    { name: 'ranh giới: tiền tố chữ không khớp', text: 'xrobust thing', want: [] },
    { name: 'ranh giới: hậu tố có dấu không khớp', text: 'Tóm lạiệ', want: [] },
    { name: 'ranh giới: tiền tố có dấu không khớp', text: 'ệTóm lại', want: [] },
    { name: 'ranh giới: hậu tố chữ không khớp', text: 'delvedd', want: [] },
    { name: 'fence thụt 4 khoảng trắng trong list item', text: '- Bước:\n    ```bash\n    echo Tóm lại\n    ```\nxong', want: [] },
    { name: 'nhiều lần khớp trên một dòng', text: 'Nói tóm lại. Tóm lại, xong.', want: [1, 1] },
    { name: 'sau fenced block vẫn quét', text: '```\nx\n```\nTóm lại', want: [4] },
    { name: 'dòng ``` thụt 4 trong văn xuôi không mở fence', text: 'Đoạn trước.\n    ```\nTóm lại, xong.\n', want: [3] },
    { name: 'dòng ~~~ thụt 4 trong văn xuôi không mở fence', text: 'Đoạn\n    ~~~\nTóm lại\n', want: [3] },
    { name: 'fence thụt 3 trong list có số, sau đóng vẫn quét', text: '1. Bước\n\n   ```\n   Tóm lại\n   ```\nTóm lại\n', want: [6] },
  ];
  for (const c of cases) {
    const got = scanText(c.text, patterns).map((h) => h.line);
    ok(JSON.stringify(got) === JSON.stringify(c.want), `AC2.1: scanText — ${c.name}`);
  }
  const hit = scanText('Tóm lại, xong.', patterns)[0];
  ok(hit && hit.phrase === 'Tóm lại' && hit.replacement.length > 0, 'AC2.2: hit mang cụm và gợi ý thay');

  for (const lang of ['vi', 'en']) {
    const rows = patterns.filter((p) => p.file === `patterns-${lang}.md`);
    ok(rows.length >= 15 && rows.every((p) => p.phrase.length > 0), `AC2.2: patterns-${lang}.md có ≥ 15 hàng, không phrase rỗng (${rows.length})`);
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'writing-style-'));
  try {
    const cli = (...a) => {
      try { return { status: 0, out: execFileSync(process.execPath, [script, ...a], { stdio: 'pipe', encoding: 'utf8' }) }; } catch (e) { return { status: e.status, out: String(e.stdout) }; }
    };
    const clean = path.join(dir, 'clean.md');
    const dirty = path.join(dir, 'dirty.md');
    fs.writeFileSync(clean, 'Đã thêm cờ `--yes`.\n');
    fs.writeFileSync(dirty, 'Dòng một.\nTóm lại, xong.\n');
    ok(cli(clean).status === 0, 'AC2.1: CLI file sạch → exit 0');
    const r = cli(dirty);
    ok(r.status === 1 && r.out.includes(`${dirty}:2:`), 'AC2.1: CLI có cụm → exit 1, output có file:line');
    ok(cli().status === 2, 'AC2.1: CLI không đối số → exit 2');
    ok(cli(path.join(dir, 'khong-co.md')).status === 2, 'AC2.1: CLI file không tồn tại → exit 2');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
