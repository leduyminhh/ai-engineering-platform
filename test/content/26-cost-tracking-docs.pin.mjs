// Pin: tài liệu theo dõi chi phí (docs/requests/2026-10-22-cost-tracking), AC3.1.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8');
  const flat = (s) => s.replace(/\s+/g, ' ');
  // Đoạn aip stats bắt đầu bằng neo in đậm, kết thúc ở dòng bullet kế tiếp.
  const para = (s, lead) => { const i = s.indexOf(lead); if (i < 0) return ''; const j = s.indexOf('\n- ', i + lead.length); return flat(s.slice(i, j < 0 ? undefined : j)); };

  const cases = [
    ['README.md', 'no price table', 'does not predict'],
    ['README_VI.md', 'không có bảng giá', 'không dự đoán'],
  ];
  for (const [file, price, predict] of cases) {
    const sec = para(read(file), '- **`aip stats`**');
    const need = ['--usage', '--since', 'cost-state', '[Unverified]', price, predict];
    ok(sec !== '' && need.every((w) => sec.includes(w)), `P5c AC3.1: ${file} mục aip stats nêu --usage, --since, cost-state, [Unverified], không bảng giá, không dự đoán hạn mức`);
  }

  const line = read('CLAUDE.md').split('\n').find((l) => l.startsWith('aip stats ')) ?? '';
  // Nhãn [Unverified] phải nằm trong ngoặc cuối, cùng chỗ với cost-state, không chỉ xuất hiện đâu đó trên dòng.
  const unv = line.slice(line.lastIndexOf('('));
  ok(['--usage', '--since'].every((w) => line.includes(w)) && unv.includes('cost-state') && unv.includes('[Unverified]'), 'P5c AC3.1: CLAUDE.md dòng lệnh aip stats có --usage, --since và nhãn [Unverified] cho cả cost-state');
}
