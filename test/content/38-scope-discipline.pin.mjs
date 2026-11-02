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
  ok(/\[giả định\]\*\* kèm cơ sở/.test(RB), 'AC1.1: ca không có code vẫn có mặc định đánh dấu [giả định] kèm cơ sở');
  ok(/[Nn]hóm không áp dụng[^\n]{0,80}bỏ qua/.test(RB), 'AC1.1: nhóm không áp dụng cho việc thì bỏ qua');
  ok(/spec/.test(RB) && /tài liệu đang soạn/.test(RB), 'AC1.1: mục dùng thuật ngữ chung cho brainstorming và spec-writing');
  ok(!/src\/cart\.mjs|bước "Đi xem"/.test(RB), 'AC1.1: mục không dẫn file:line mẫu có thể bị bắt chước');

  const PE = 'core/skills/plan-execution/references';
  const TL = read(`${PE}/task-loop.md`);
  const NR = (TL.match(/^## Nhận review[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m) || [, ''])[1];
  ok(NR !== '', 'AC3.1: task-loop có mục "Nhận review"');
  ok(/\*\*trong phạm vi\*\* \(vi phạm AC hay tiêu chí đã duyệt, lỗi đúng\/sai với đầu vào hợp lệ của chính tính năng, test sai, lỗ hổng bảo mật\) → sửa/.test(NR), 'AC3.1: nhóm trong phạm vi nguyên văn → sửa');
  ok(/\*\*ngoài AC, không đổi hành vi\*\* → `minor \(deferred\)` hoặc `Ruling:` giữ mức gốc, không sửa/.test(NR), 'AC3.1: nhóm ngoài AC không đổi hành vi → minor (deferred) hoặc Ruling: giữ mức gốc, không sửa');
  ok(/\*\*ngoài AC, đổi hành vi hoặc API\*\* \([^)]*\) → thẻ G3 kèm hệ quả, không sửa; "làm" thành follow-up/.test(NR), 'AC3.2: nhóm đổi hành vi/API → thẻ G3 kèm hệ quả, không sửa, "làm" thành follow-up');
  ok(/`Ruling:` không được thêm hành vi không có trong AC/.test(NR), 'AC3.2: Ruling: không được thêm hành vi không có trong AC');
  ok(/mục "Nhận review"/.test(TL.replace(NR, '')), 'AC3.1: bước xử lý kết quả review trỏ mục "Nhận review"');

  // `review clean` phải cùng một định nghĩa ở mọi nơi nó xuất hiện (task-loop, final-review, finish).
  const CLEAN = /không còn (?:finding )?`?blocker`?\/`?major`? mở \*\*trong phạm vi\*\*/;
  const FR = read(`${PE}/prompts/final-review.md`);
  const FN = read(`${PE}/finish.md`);
  const defs = (t) => t.split('\n').filter((l) => l.includes('`review clean` ='));
  ok(defs(TL).length >= 2 && defs(TL).every((l) => CLEAN.test(l)), 'AC3.1: task-loop (bước 9 và mục Nhận review) định nghĩa review clean = không còn blocker/major mở trong phạm vi');
  ok(defs(FR).length >= 1 && defs(FR).every((l) => CLEAN.test(l)), 'AC3.1: final-review định nghĩa review clean trong phạm vi, khớp task-loop');
  ok(CLEAN.test(FN.split('\n').find((l) => l.startsWith('Chạy sau khi review cuối sạch')) ?? ''), 'AC3.1: finish.md điều kiện review cuối sạch là trong phạm vi, khớp task-loop');

  ok(/Finding ngoài AC[^\n]*đổi hành vi hoặc API[^\n]*không chọn hướng sửa[^\n]*G3/.test(FR), 'AC3.2: final-review quy tắc 7 mở rộng sang finding ngoài AC đổi hành vi hoặc API → G3, không sửa');
  ok(/thẻ G3/.test(FN) && /ngoài AC, đổi hành vi hoặc API/.test(FN), 'AC3.2: finish.md thẻ G3 liệt kê finding ngoài AC đổi hành vi hoặc API');
  ok(/"làm"[^\n]*follow-up[^\n]*sau khi nhánh xong/.test(FN) && /không chạy tiếp trong nhánh/.test(FN) && /không thêm lane mới/.test(FN), 'AC3.2: finish.md ghi "làm" thành follow-up sau khi nhánh xong, không chạy tiếp, không thêm lane mới');

  const TB = read('core/principles/trust-boundary.md');
  ok(/^## Ranh giới tin cậy$/m.test(TB), 'AC3.3: trust-boundary.md có heading H2 Ranh giới tin cậy');
  ok(/code hoặc cấu hình nội bộ của repo khai báo không phải ranh giới tin cậy/.test(TB) && /tối đa `minor`/.test(TB), 'AC3.3: trust-boundary.md nêu dữ liệu nội bộ không phải ranh giới tin cậy, finding tối đa minor');
  for (const f of [`${PE}/prompts/task-review.md`, `${PE}/prompts/final-review.md`, 'plugins/engineering/agents/engineering-quality-auditor.md'])
    ok(/Ranh giới tin cậy[^\n]*trust-boundary\.md/.test(read(f)), `AC3.3: ${f.split('/').pop()} trỏ trust-boundary.md`);
  for (const f of [`${PE}/prompts/task-review.md`, `${PE}/prompts/final-review.md`])
    ok(/Gắn nhãn `trong AC` hoặc `ngoài AC`/.test(read(f)), `AC3.1: ${f.split('/').pop()} bảo reviewer gắn nhãn trong AC/ngoài AC cho finding`);
  const PRIN = read('build/claude/plugins/core/skills/principles/SKILL.md');
  ok(/`Ruling: ngoài AC, đổi hành vi — <mức gốc> <finding> — task <n> — <hệ quả>`[^\n]*G3[^\n]*sau compact/.test(NR), 'AC3.2: nhóm đổi hành vi/API ghi dòng ledger Ruling: ngoài AC, đổi hành vi để G3 thấy sau compact');
  ok(/Hạ nhãn \(trong phạm vi → ngoài AC\) phải có `Ruling:` nêu AC cụ thể không liên quan hoặc lý do đầu vào không hợp lệ; không đủ thì giữ trong phạm vi/.test(NR) && /đổi tự do theo chiều `ngoài AC` → trong phạm vi/.test(NR), 'AC3.1: hạ nhãn trong phạm vi → ngoài AC cần Ruling:, không đủ thì giữ trong phạm vi');
  ok(/Đầu vào hợp lệ là đầu vào đúng kiểu và đúng miền mà design mô tả/.test(NR), 'AC3.1: định nghĩa đầu vào hợp lệ theo design');
  ok(/vi phạm AC hay tiêu chí đã duyệt áp quy tắc vi phạm AC \(major trở lên\) trước; trần `minor` chỉ áp cho finding không vi phạm AC/.test(TB), 'AC3.3: trust-boundary — vi phạm AC áp quy tắc major trở lên trước, trần minor chỉ cho finding không vi phạm AC');
  const WF = read('workflows/feature/WORKFLOW.md');
  const IL = read(`${PE}/inline.md`);
  ok(/`blocker`\/`major` trong phạm vi hoặc `spec_verdict` khác `compliant` vào vòng sửa \(finding ngoài AC xếp theo mục "Nhận review"/.test(WF.replace(/\n\s+/g, ' ')), 'AC3.1: workflow-feature Bước 5 chỉ finding trong phạm vi vào vòng sửa');
  ok(/một lần sửa cho toàn bộ finding `blocker`\/`major` trong phạm vi/.test(WF.replace(/\n\s+/g, ' ')), 'AC3.1: workflow-feature Bước 6 một lần sửa cho finding trong phạm vi');
  ok(/\*\*Gate:\*\* 0 finding `blocker` trong phạm vi[\s\S]{0,300}`blocker`\/`major` ngoài AC đã có `Ruling:` cũng trình ở Bước 7/.test(WF), 'AC3.1: workflow-feature Gate review cuối theo phạm vi, ngoài AC đã Ruling: trình ở Bước 7');
  const WF1 = WF.replace(/\n\s+/g, ' ');
  ok(/\*\*Khi fail:\*\* còn finding `blocker` trong phạm vi sau một lần sửa và một re-review → quay lại Bước 5/.test(WF1), 'AC3.1: workflow-feature Khi fail Bước 6 chỉ finding blocker trong phạm vi');
  ok(/\| Finding `blocker` trong phạm vi sau review cuối \(Bước 6; ngoài AC đã có `Ruling:` thì trình ở Bước 7\) \| Một lần sửa/.test(WF1), 'AC3.1: workflow-feature bảng lỗi: blocker trong phạm vi sau review cuối → Bước 5');
  ok(/Review cuối toàn nhánh: 0 `blocker` trong phạm vi; có contract/.test(WF1), 'AC3.1: workflow-feature checklist review cuối: 0 blocker trong phạm vi');
  ok(/- \[ \] 0 finding `blocker` trong phạm vi \(ngoài AC đã có `Ruling:` thì trình ở Bước 7\)/.test(WF), 'AC3.1: workflow-feature checklist cuối: 0 finding blocker trong phạm vi');
  ok(/Finding `blocker`\/`major` trong phạm vi tự tìm ra thì sửa/.test(IL.replace(/\n\s+/g, ' ')), 'AC3.1: inline.md tự review chỉ sửa finding trong phạm vi');
  ok(/^## Ranh giới tin cậy$/m.test(PRIN)&& /code hoặc cấu hình nội bộ của repo khai báo không phải ranh giới tin cậy/.test(PRIN), 'AC3.3: skill principles sau build có nội dung trust-boundary.md');

  // Lượt sửa sau review cuối toàn nhánh (final-fix-brief): mỗi mục một câu quy tắc, neo theo nguyên văn.
  const flat = (rel) => read(rel).replace(/\n\s*/g, ' ');
  const BS = flat('core/skills/brainstorming/SKILL.md');
  ok(/[Cc]a biên của mục "Rà ca biên" \(`clarify-core\.md`\) có mặc định dẫn code đi vào \*\*thẻ đầu\*\*, các ca biên gom chung một câu của thẻ \([^)]*không thêm câu thứ 5\)/.test(BS), 'F2: brainstorming bước 2 đưa ca biên có mặc định dẫn code vào thẻ đầu, gom một câu nếu đủ 4 câu');
  ok(/Rà ca biên[^.]{0,60}clarify-core\.md[^.]{0,120}tin nhắn hỏi gom đầu tiên/.test(flat(`${SS}/SKILL.md`)), 'F2: spec-writing trỏ mục Rà ca biên cho tin nhắn hỏi gom đầu tiên');
  ok(/ca biên theo mục "Rà ca biên" của `clarify-core\.md` đi vào tin nhắn gom đó/.test(WF1), 'F2: workflow-feature Bước 2 trỏ mục Rà ca biên cho tin nhắn gom');

  const BCF = flat(`${SS}/references/builder-check.md`);
  ok(/AC nêu kết quả số mà thiếu `calc:` → `AC<id> thiếu calc` \(sửa thẳng\)/.test(read(`${SS}/references/builder-check.md`)), 'F3: prompt builder-check bắt AC nêu kết quả số mà thiếu calc: → sửa thẳng');
  ok(/session chính chạy `node <thư mục skill artifact-templates>\/scripts\/check-request\.mjs docs\/requests\/<ngày>-<slug>\/`/.test(BCF), 'F3: builder-check ghi đủ lệnh check-request.mjs do session chính chạy');
  ok(/acceptance criteria đo được \(AC nêu kết quả số có `calc:`; `check-request\.mjs` không còn W22\)/.test(WF1), 'F3: workflow-feature Gate Bước 3 đòi AC có kết quả số kèm calc: và không còn W22');
  ok(/bảng ứng viên e2e; AC nêu kết quả số kèm `calc:`\) và `design\.md` chỉ khi/.test(WF1), 'F3: workflow-feature Bước 3 bảo spec-analyst ghi calc: cho AC có kết quả số');
  ok(CALC.test(read(`${SS}/references/spec-structure.md`)) && /W22/.test(read(`${SS}/references/spec-structure.md`)), 'F3: spec-structure khuôn AC nêu AC có kết quả số kèm calc: và W22');

  const BCB = flat('core/skills/brainstorming/references/builder-check.md');
  ok(/chỉ làm một phần \(vd có giới hạn lượt dùng nhưng không có cách tăng lượt; người dùng nói "nhập mã lúc thanh toán" mà hàm không nhận mã\) là câu hỏi của người dùng, không ghi là quyết định của agent/.test(BCB), 'F4: builder-check của brainstorming đưa tính năng brief làm một phần vào câu hỏi của người dùng');
  ok(/Trừ tính năng người dùng nêu mà brief chỉ làm một phần[^.]{0,120}không ghi là quyết định của agent/.test(BCB), 'F4: ngoại lệ bỏ qua phần hỏi của brainstorming loại trừ tính năng cắt bớt');
  ok(/tính năng người dùng nêu mà brief chỉ làm một phần[^)]{0,120}không xếp dưới "quyết định của agent"/.test(BS), 'F4: thẻ duyệt brief nêu tính năng cắt bớt như câu hỏi của người dùng, không xếp dưới quyết định của agent');

  ok(/Extra: diff làm điều brief không yêu cầu, sửa file ngoài danh sách Files, hoặc thêm hành vi không AC nào nêu \(ném lỗi mới, mã lý do mới, kiểm kiểu\/đầu vào mà AC không đòi\)/.test(flat(`${PE}/prompts/task-review.md`)), 'F5: task-review xếp hành vi không AC nào nêu vào Extra');
  ok(/không thêm hành vi không AC nào nêu \(ném lỗi mới, mã lý do mới, kiểm kiểu\/đầu vào mà AC không đòi\)/.test(flat(`${PE}/prompts/implementer.md`)), 'F5: implementer không thêm hành vi không AC nào nêu');

  ok(/^focus: trace$/m.test(read('evals/engineering/spec-ac-calc/graders/calc-blocks-correct.md')), 'F7: grader calc-blocks-correct chấm trên trace để thấy đối số Write');
  ok(/còn finding blocker trong phạm vi sau một lần sửa và một re-review/.test(read('workflows/feature/graph.json')), 'F8: graph.json Khi fail Bước 6 chỉ finding blocker trong phạm vi');

  ok(/Finding bảo mật không hoãn bằng `Ruling:`, đi theo loại dừng 2; trần `minor` của ranh giới tin cậy chỉ áp cho finding kiểm đầu vào/.test(NR.replace(/\n\s*/g, ' ')), 'Audit F1: finding bảo mật không hoãn bằng Ruling:, đi theo loại dừng 2; trần minor chỉ cho finding kiểm đầu vào');
  const TBF = TB.replace(/\n\s*/g, ' ');
  ok(/Trần `minor` chỉ áp khi finding ghi `file:line` khai báo nội bộ và không có đường dữ liệu từ ngoài tới đó; không chứng minh được thì giữ mức gốc/.test(TBF), 'Audit F2: trần minor cần file:line khai báo nội bộ và không có đường dữ liệu từ ngoài, không chứng minh được thì giữ mức gốc');
  ok(/Cấu hình runtime ngoài repo \(biến môi trường, Consul, DB, giao diện quản trị\) không phải "nội bộ"/.test(TBF), 'Audit F2: cấu hình runtime ngoài repo không phải nội bộ');
}
