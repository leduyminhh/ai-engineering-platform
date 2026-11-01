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
    ['AC1.1', B, /brief\.md/, 'SKILL.md nêu brief.md là đầu ra'],
    ['AC1.1', B, /route\.mjs/, 'SKILL.md nêu lệnh route.mjs'],
    // Khối một bước = từ dòng "<n>. **" tới dòng bước kế (dòng con thụt lề không khớp ^\d+\.).
    ['AC1.1', B, /^2\. \*\*Lượt hỏi đầu(?:(?!^\d+\. )[\s\S])*bỏ qua phần hỏi/m, 'lượt hỏi đầu có dòng bỏ qua phần hỏi'],
    ['AC1.1', B, /^2\. \*\*Lượt hỏi đầu(?:(?!^\d+\. )[\s\S])*thẻ gom câu hỏi/m, 'lượt hỏi đầu có thẻ gom câu hỏi'],
    ['AC1.1', B, /^2\. \*\*Lượt hỏi đầu(?:(?!^\d+\. )[\s\S])*đáp án khuyến nghị/m, 'mỗi câu trong thẻ kèm đáp án khuyến nghị'],
    ['AC1.1', B, /^2\. \*\*Lượt hỏi đầu(?:(?!^\d+\. )[\s\S])*một câu mở/m, 'thẻ có đúng một câu mở'],
    ['AC1.2', B, /^9\. \*\*Builder check(?:(?!^\d+\. )[\s\S])*một vòng/m, 'builder check chỉ một vòng hỏi'],
    ['AC1.2', B, /^(?:(?!Builder check)[\s\S])*Ghi brief\.md nháp[\s\S]*Builder check/, 'ghi brief.md nháp trước Builder check'],
    ['AC1.2', B, /cổng duy nhất/, 'duyệt brief là cổng duy nhất'],
    ['AC1.3', B, /quyết định của agent/, 'người dùng bỏ qua → ghi quyết định của agent'],
    ['AC5.2', 'evals/core/brainstorm-gather-questions/case.yaml', /name: brainstorm-gather-questions/, 'case eval brainstorm-gather-questions có case.yaml'],
    ['AC5.2', 'evals/core/route-brief-decision/case.yaml', /name: route-brief-decision/, 'case eval route-brief-decision có case.yaml'],
    ['AC5.2', 'evals/core/route-brief-decision/graders/route-is-adr.md', /engineering-adr/, 'route kỳ vọng của route-brief-decision là engineering-adr'],
    ['AC6.1', 'docs/requests/2026-10-31-brainstorming-routing/trial-6.md', /workflow-feature[\s\S]*engineering-adr[\s\S]*chưa có quy trình/, 'trial-6.md ghi kết quả ba vấn đề thử (feature, quyết định, nghiên cứu)'],
    // Yêu cầu của người dùng 2026-11-01: mọi lần dừng hỏi phải có lựa chọn bấm được hoặc file/diff mở sẵn, không hỏi suông.
    ['ASK', 'core/skills/plan-execution/references/ask-user.md', /AskUserQuestion[\s\S]*show_pane/, 'ask-user.md nêu công cụ hỏi có lựa chọn và pane mở file/diff'],
    ['ASK', 'core/skills/plan-execution/references/finish.md', /G3\.\*\* Theo `ask-user\.md`/, 'G3 hỏi theo ask-user.md (mở diff, lựa chọn bấm được)'],
    ['ASK', 'core/skills/brainstorming/SKILL.md', /ask-user\.md[\s\S]*Dừng/, 'brainstorming hỏi theo ask-user.md ở thẻ đầu và thẻ duyệt brief'],
  ];
  for (const [ac, file, re, msg] of ANCHORS) ok(re.test(read(file)), `${ac}: ${msg}`);

  // engineering-spec-writing trỏ tới clarify-core.md bằng tiêu đề mục: tiêu đề phải có thật ở clarify-core và được SKILL.md nêu đúng.
  const core = read('core/skills/brainstorming/references/clarify-core.md');
  const spec = read('plugins/engineering/skills/engineering-spec-writing/SKILL.md');
  ok(/clarify-core\.md/.test(spec), 'AC1.2: engineering-spec-writing trỏ tới clarify-core.md');
  for (const title of ['Cổng "đủ thông tin" + lối thoát', 'Playback — tóm tắt lại từng phần', 'Đề xuất 2–3 hướng — đặt sau playback']) {
    ok(core.split('\n').includes(`## ${title}`), `AC1.2: clarify-core.md có mục "## ${title}"`);
    ok(spec.includes(`"${title}"`), `AC1.2: engineering-spec-writing trỏ đúng tiêu đề mục "${title}"`);
  }
}
