// Pin nội dung: frontend-manual-check (AC5.1, AC5.3).
export default async function run({ ok, ctx }) {
  const { fs, path, PLUGINS_DIR } = ctx;
  const dir = path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-manual-check');
  const read = (rel) => {
    const p = path.join(dir, rel);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  };
  const skill = read('SKILL.md');
  const tpl = read('references/runbook.template.md');

  // AC5.1: mẫu runbook đủ ba phần; quy trình đòi phủ AC và ghi "chưa kiểm".
  ok(tpl.includes('## Điều kiện') && tpl.includes('## Kết quả đã chạy'),
    'AC5.1 frontend-manual-check: mẫu runbook có ## Điều kiện và ## Kết quả đã chạy');
  ok(tpl.includes('| # | Thao tác | Kết quả mong đợi | AC |'),
    'AC5.1 frontend-manual-check: mẫu runbook có bảng | # | Thao tác | Kết quả mong đợi | AC |');
  ok(/[Mm]ỗi `AC<n>\.<m>`[^\n]*ít nhất một bước/.test(skill),
    'AC5.1 frontend-manual-check: quy trình đòi mỗi AC xuất hiện ở ít nhất một bước');
  ok(/chưa kiểm/.test(skill) && /không để trống/.test(skill),
    'AC5.1 frontend-manual-check: quy trình đòi ghi "chưa kiểm", không để trống');

  // AC5.3: thân ≤ 300 dòng; description giữ ranh giới với skill anh em.
  ok(skill.split('\n').length <= 300, 'AC5.3 frontend-manual-check: SKILL.md ≤ 300 dòng');
  const m = skill.match(/^description: "((?:[^"\\]|\\.)*)"$/m);
  const desc = m ? m[1].replace(/\\"/g, '"') : '';
  ok(desc.length > 0 && desc.length <= 500, 'AC5.3 frontend-manual-check: description ≤ 500 ký tự');
  ok(desc.includes('frontend-e2e-testing') && desc.includes('frontend-testing'),
    'AC5.3 frontend-manual-check: description nêu frontend-e2e-testing và frontend-testing');
}
