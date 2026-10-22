// Pin: tài liệu công thức review PR chỉ đọc (docs/requests/2026-10-21-ci-runner), AC2.1.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (f) => fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
  const flat = (s) => s.replace(/\s+/g, ' ');
  // Chỉ lấy từ heading đến H2 kế tiếp để từ khoá ở chỗ khác trong README không làm pin xanh oan.
  const section = (s, heading) => {
    const i = s.indexOf(`\n${heading}\n`);
    if (i < 0) return '';
    const j = s.indexOf('\n## ', i + heading.length + 2);
    return flat(s.slice(i, j < 0 ? undefined : j));
  };

  const common = [
    'templates/ci/claude-review.example.yml', 'aip init', 'pull_request', 'pull_request_target', 'contents: read', 'SHA',
    '--permission-mode dontAsk', '--allowedTools', '--max-budget-usd', 'fork', '--bare', '[Unverified]', 'aip-runner',
  ];
  const cases = [
    ['README.md', '## Run reviews in CI', ['copy', 'not implemented']],
    ['README_VI.md', '## Chạy review trong CI', ['chép', 'chưa hiện thực']],
  ];
  for (const [file, heading, extra] of cases) {
    const sec = section(read(file), heading);
    const missing = [...common, ...extra].filter((w) => !sec.includes(w));
    ok(sec !== '' && missing.length === 0, `P6a AC2.1: ${file} mục "${heading}" nêu file ví dụ, tự chép, điều kiện an toàn, giới hạn, [Unverified], aip-runner; thiếu [${missing.join(', ')}]`);
  }
}
