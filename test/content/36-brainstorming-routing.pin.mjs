// Pin: docs/requests/2026-10-31-brainstorming-routing — neo giá trị vận hành (lệnh, khoá, trạng thái, đường dẫn) theo AC.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (rel) => { try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };
  // [AC, file, regex, mô tả]; một hành vi nhiều ràng buộc → một bảng có tham số.
  // Các regex AC7.1 khoanh trong mục "## Đóng phiên con" (không lan sang mục khác).
  const F = 'core/skills/plan-execution/references/finish.md';
  const ANCHORS = [
    ['AC7.1', F, /^## Dọn theo khoá[\s\S]*^## Đóng phiên con$/m, 'mục Đóng phiên con đặt sau "Dọn theo khoá"'],
    ['AC7.1', F, /^## Đóng phiên con\n(?:(?!^## )[\s\S])*archive/m, 'nêu archive'],
    ['AC7.1', F, /^## Đóng phiên con\n(?:(?!^## )[\s\S])*cleanup: true/m, 'nêu `cleanup: true` không hỏi thêm'],
    ['AC7.1', F, /^## Đóng phiên con\n(?:(?!^## )[\s\S])*đang chờ người dùng/m, 'phiên còn chạy hoặc đang chờ người dùng được giữ'],
    ['AC7.1', F, /^## Đóng phiên con\n(?:(?!^## )[\s\S])*không xoá phiên/m, 'nêu không xoá phiên'],
    ['AC7.1', F, /^4\. [^\n]*Đóng phiên con/m, 'bước 4 của "Merge local theo khoá" tham chiếu mục mới'],
  ];
  for (const [ac, file, re, msg] of ANCHORS) ok(re.test(read(file)), `${ac}: ${msg}`);
}
