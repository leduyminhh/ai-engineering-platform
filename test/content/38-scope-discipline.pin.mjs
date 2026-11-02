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
}
