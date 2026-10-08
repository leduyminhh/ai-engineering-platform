// Contract byte: file nguồn được git theo dõi không có BOM, dùng LF trong index và là UTF-8 hợp lệ (spec 2026-10-07 audit / P1.6).
export default async function run({ ok, ctx }) {
  const { fs, path, execFileSync, REPO_ROOT } = ctx;
  const DIRS = ['adapters/', 'cli/', 'core/', 'plugins/', 'templates/', 'workflows/', 'test/'];
  const REPLACEMENT_CHAR = String.fromCharCode(0xfffd);
  const EXTS = new Set(['.md', '.mjs', '.json', '.yml', '.toml', '.mdc', '.sh', '.ps1']);

  let entries;
  try {
    // -z: đường dẫn có dấu tiếng Việt không bị git quote; --eol cho kiểu xuống dòng của INDEX (working tree có thể là CRLF trên Windows).
    const raw = execFileSync('git', ['ls-files', '--eol', '-z', '--', ...DIRS], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    entries = raw.split('\0').filter(Boolean).map((r) => {
      const [info, file] = r.split('\t');
      return { file, eol: info.trim().split(/\s+/)[0] };
    });
  } catch (e) {
    ok(false, `byte contract: không chạy được git ls-files (${e.message.split('\n')[0]})`);
    return;
  }
  const files = entries.filter((e) => EXTS.has(path.extname(e.file).toLowerCase()) && fs.existsSync(path.join(REPO_ROOT, e.file)));
  ok(files.length > 100, `byte contract: quét ${files.length} file nguồn (kỳ vọng > 100)`);

  const bom = [], crlf = [], badUtf8 = [];
  for (const { file, eol } of files) {
    const buf = fs.readFileSync(path.join(REPO_ROOT, file));
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) bom.push(file);
    if (eol === 'i/crlf' || eol === 'i/mixed') crlf.push(file);
    if (new TextDecoder('utf-8').decode(buf).includes(REPLACEMENT_CHAR)) badUtf8.push(file);
  }
  const list = (a) => (a.length ? ` — ${a.length}: ${a.slice(0, 5).join(', ')}` : '');
  ok(bom.length === 0, `byte contract: không file nào có BOM UTF-8${list(bom)}`);
  ok(crlf.length === 0, `byte contract: index không chứa CRLF (i/lf)${list(crlf)}`);
  ok(badUtf8.length === 0, `byte contract: mọi file là UTF-8 hợp lệ (không có U+FFFD)${list(badUtf8)}`);
}
