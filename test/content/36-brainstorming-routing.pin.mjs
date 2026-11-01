// Pin: docs/requests/2026-10-31-brainstorming-routing — neo theo AC các giá trị vận hành (status, khoá, lệnh, đường dẫn) và vài cụm then chốt
// của hành vi chỉ nằm trong tài liệu (AC không có test chạy được); đổi chữ mà giữ nghĩa thì sửa regex, đừng xoá dòng.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (rel) => { try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };
  // [AC, file, regex, mô tả]; một hành vi nhiều ràng buộc → một bảng có tham số.
  // Các regex AC7.1 khoanh trong mục "## Đóng phiên con" (không lan sang mục khác).
  const F = 'core/skills/plan-execution/references/finish.md';
  const B = 'core/skills/brainstorming/SKILL.md';
  const ANCHORS = [
    ['AC7.1', F, /^## Dọn theo khoá[\s\S]*^## Đóng phiên con$/m, 'mục Đóng phiên con đặt sau "Dọn theo khoá"'],
    ['AC7.1', F, /^## Đóng phiên con\n(?:(?!^## )[\s\S])*archive/m, 'nêu archive'],
    ['AC7.1', F, /^## Đóng phiên con\n(?:(?!^## )[\s\S])*cleanup: true/m, 'nêu `cleanup: true` không hỏi thêm'],
    ['AC7.1', F, /^## Đóng phiên con\n(?:(?!^## )[\s\S])*đang chờ người dùng/m, 'phiên còn chạy hoặc đang chờ người dùng được giữ'],
    ['AC7.1', F, /^## Đóng phiên con\n(?:(?!^## )[\s\S])*không xoá phiên/m, 'nêu không xoá phiên'],
    ['AC7.1', F, /^## Merge local theo khoá\n(?:(?!^## )[\s\S])*^4\. [^\n]*Đóng phiên con/m, 'bước 4 của "Merge local theo khoá" tham chiếu mục mới'],
    ['AC3.2', 'workflows/feature/WORKFLOW.md', /^### Bước 1 —(?:(?!^### )[\s\S])*status: misrouted/m, 'Bước 1 feature trả status: misrouted'],
    ['AC3.2', 'workflows/bugfix/WORKFLOW.md', /^### Bước 1 —(?:(?!^### )[\s\S])*status: misrouted/m, 'Bước 1 bugfix trả status: misrouted'],
    ['AC3.2', 'workflows/security-review/WORKFLOW.md', /^### Bước 1 —(?:(?!^### )[\s\S])*status: misrouted/m, 'Bước 1 security-review trả status: misrouted'],
    ['AC3.2', 'workflows/performance/WORKFLOW.md', /^### Bước 1 —(?:(?!^### )[\s\S])*status: misrouted/m, 'Bước 1 performance trả status: misrouted'],
    ['AC4.1', 'workflows/feature/WORKFLOW.md', /^### Bước 2 —(?:(?!^### )[\s\S])*brief\.md/m, 'Bước 2 feature đọc brief.md'],
    ['AC1.1', B, /brief\.md/, 'SKILL.md nêu brief.md là đầu ra'],
    ['AC1.1', B, /route\.mjs/, 'SKILL.md nêu lệnh route.mjs'],
    ['AC1.1', B, /bỏ qua phần hỏi/, 'lượt đầu có dòng bỏ qua phần hỏi'],
    ['AC1.1', B, /thẻ gom câu hỏi/, 'lượt đầu có thẻ gom câu hỏi'],
    ['AC1.1', B, /đáp án khuyến nghị/, 'mỗi câu trong thẻ kèm đáp án khuyến nghị'],
    ['AC1.1', B, /một câu mở/, 'thẻ có đúng một câu mở'],
    ['AC1.2', B, /builder check[\s\S]*một vòng/i, 'builder check chỉ một vòng hỏi'],
    ['AC1.2', B, /cổng duy nhất/, 'duyệt brief là cổng duy nhất'],
    ['AC1.3', B, /quyết định của agent/, 'người dùng bỏ qua → ghi quyết định của agent'],
  ];
  for (const [ac, file, re, msg] of ANCHORS) ok(re.test(read(file)), `${ac}: ${msg}`);
}
