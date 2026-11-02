// Pin: quy tắc calc: trong AC và builder check cắt bớt tính năng (design B1–B3, C3) — câu chữ chỉ tồn tại trong tài liệu skill/agent.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (rel) => { try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };
  const SS = 'plugins/engineering/skills/engineering-spec-writing';
  const CALC = /kết quả số[\s\S]{0,120}calc:/;

  ok(CALC.test(read(`${SS}/SKILL.md`)), 'AC2.3: spec-writing SKILL nêu AC có kết quả số phải kèm calc:');
  ok(CALC.test(read(`${SS}/references/checklist.md`)), 'AC2.3: checklist nêu AC có kết quả số phải kèm calc:');
  ok(CALC.test(read('plugins/engineering/agents/engineering-spec-analyst.md')), 'AC2.3: spec-analyst nêu AC có kết quả số phải kèm calc:');

  const BC = read(`${SS}/references/builder-check.md`);
  ok(/check-request\.mjs/.test(BC), 'AC2.3: builder-check chạy check-request.mjs');
  ok(/W22[\s\S]{0,200}sửa thẳng/.test(BC), 'AC2.3: builder-check đưa W22 vào nhóm sửa thẳng');
  ok(!/tính lại kết quả từ Given|tự tính lại/.test(BC), 'AC2.3: builder-check đã bỏ câu tính lại kết quả từ Given (quy tắc cũ)');
  ok(/làm một phần[\s\S]{0,200}của người dùng/.test(BC), 'AC3.4: builder-check đưa tính năng người dùng nêu mà design làm một phần vào nhóm câu hỏi của người dùng');
  ok(/làm một phần[\s\S]{0,200}không ghi là quyết định của agent/.test(BC), 'AC3.4: builder-check không ghi tính năng cắt bớt là quyết định của agent');
  ok(/Ngoại lệ[\s\S]{0,400}[Tt]rừ tính năng[\s\S]{0,200}không ghi là quyết định của agent/.test(BC), 'AC3.4: ngoại lệ bỏ qua phần hỏi của builder-check loại trừ tính năng cắt bớt');
  ok(/bỏ qua phần hỏi\*\*[\s\S]{0,400}[Tt]rừ tính năng[\s\S]{0,200}không ghi là quyết định của agent/.test(read(`${SS}/SKILL.md`)), 'AC3.4: SKILL ngoại lệ bỏ qua phần hỏi loại trừ tính năng cắt bớt');

  const CC = read('core/skills/brainstorming/references/clarify-core.md');
  const RB = (CC.match(/^## Rà ca biên[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m) || [, ''])[1];
  ok(RB !== '', 'AC1.1: clarify-core có mục "Rà ca biên"');
  for (const g of ['làm tròn', 'biên dưới/trên', 'đầu vào rỗng', 'mốc thời gian', 'đếm đồng thời']) ok(RB.includes(g), `AC1.1: Rà ca biên nêu nhóm ${g}`);
  ok(/mặc định khuyến nghị[^\n]{0,120}`file:line`/.test(RB), 'AC1.1: mỗi ca một mặc định khuyến nghị dẫn file:line của code đã đọc');
  ok(/[Cc]ode đã trả lời[^\n]{0,80}không hỏi/.test(RB), 'AC1.1: ca code đã trả lời thì ghi thẳng vào brief, không hỏi');
}
