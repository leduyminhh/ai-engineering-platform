// Pin: báo tiến độ tổng thể, cỡ task, Files đủ, spike giả định, luật phạm vi một chuẩn, cổng thừa (request 2026-11-10-workflow-progress-plan-quality).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (rel) => { try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };
  const PE = 'core/skills/plan-execution';
  const TL = read(`${PE}/references/task-loop.md`);
  const SK = read(`${PE}/SKILL.md`);
  const WF = read('workflows/feature/WORKFLOW.md');
  const PS = read('plugins/engineering/skills/engineering-plan-writing/references/plan-structure.md');
  const SR = read('plugins/engineering/skills/engineering-plan-writing/references/self-review.md');
  const SW = 'plugins/engineering/skills/engineering-spec-writing';

  // AC1: báo tiến độ tổng thể giữa G2 và G3
  for (const [name, txt] of [['SKILL.md', SK], ['task-loop.md', TL], ['WORKFLOW.md feature', WF]]) {
    ok(!/không gửi dòng trạng thái giữa chừng/.test(txt), `AC1.2: ${name} bỏ luật cấm dòng trạng thái giữa chừng`);
  }
  ok(/^## Báo tiến độ/m.test(TL), 'AC1.1: task-loop có mục "Báo tiến độ"');
  const BT = (TL.match(/^## Báo tiến độ[^\n]*\n([\s\S]*?)(?=^## )/m) || [, ''])[1];
  ok(/`Task <n>: complete`[\s\S]{0,200}một dòng tiến độ/.test(BT), 'AC1.1: sau mỗi Task complete gửi một dòng tiến độ');
  for (const f of ['<n>/<N>', 'đã chạy', 'còn lại', 'minor hoãn', 'Ruling']) ok(BT.includes(f), `AC1.1: dòng tiến độ có trường ${f}`);
  ok(/danh sách task của công cụ[\s\S]{0,300}(update_plan|TodoWrite)/.test(BT), 'AC1.1: cập nhật danh sách task của công cụ (update_plan/TodoWrite)');
  ok(/[Tt]rước Task 1[\s\S]{0,300}mọi task[\s\S]{0,200}review cuối[\s\S]{0,120}G3/.test(BT), 'AC1.3: trước Task 1 đăng đủ mọi task + review cuối + G3 lên danh sách task');
  ok(/không chờ trả lời/.test(BT), 'AC1.1: dòng tiến độ không phải câu hỏi, không chờ trả lời');
  ok(/vượt ước lượng/.test(BT), 'AC1.4: task vượt ước lượng thì nêu trong dòng tiến độ');
  ok(/Báo tiến độ/.test(SK) && /Báo tiến độ/.test(WF), 'AC1.1: SKILL và WORKFLOW trỏ tới mục Báo tiến độ');

  // AC2: cỡ task và ước lượng ở G2
  ok(/\*\*Ước lượng:\*\*/.test(PS), 'AC2.1: plan-structure yêu cầu dòng **Ước lượng:** mỗi task');
  ok(/30 phút[\s\S]{0,200}5 file/.test(PS) && /vượt một trong hai thì tách/.test(PS), 'AC2.1: trần 30 phút / 5 file production, vượt thì tách');
  const stale = ['plugins/engineering/skills/engineering-plan-writing/SKILL.md', 'workflows/feature/WORKFLOW.md'].filter((f) => /tự soát 5 mục|Chạy 5 mục/.test(read(f)));
  ok(stale.length === 0, `AC3.1: không còn chỗ ghi tự soát 5 mục (${stale.join(', ')})`);
  ok(/tổng ước lượng/.test(WF) && /tổng ước lượng/.test(read(`${PE}/references/ask-user.md`)), 'AC2.2: G2 trình tổng ước lượng (WORKFLOW + ask-user)');

  // AC3: Files đủ khi gỡ hoặc đổi chữ ký
  ok(/^6\. \*\*Files đủ/m.test(SR), 'AC3.1: self-review có mục 6 Files đủ');
  ok(/grep[\s\S]{0,300}(inject|bean)[\s\S]{0,200}test/.test(SR), 'AC3.1: grep caller, chỗ inject bean và test cho symbol bị gỡ/đổi');
  ok(/nuốt lỗi/.test(SR), 'AC3.1: đổi từ nuốt lỗi sang ném lỗi tính là đổi hành vi cần grep caller');
  ok(/Files đủ/.test(PS), 'AC3.1: plan-structure (Bản đồ file) trỏ tới mục Files đủ');

  // AC4: spike giả định chịu tải trước G1
  const SWS = read(`${SW}/SKILL.md`);
  ok(/[Ss]pike giả định/.test(SWS), 'AC4.1: spec-writing có bước spike giả định');
  ok(/\[Unverified\][\s\S]{0,300}hướng đã chọn[\s\S]{0,300}trước\s+(checkpoint|G1)/.test(SWS), 'AC4.1: spike giả định [Unverified] mà hướng đã chọn dựa vào, trước checkpoint');
  ok(/lệnh chạy lại/.test(SWS), 'AC4.1: kết quả spike ghi vào design kèm lệnh chạy lại');
  ok(/[Ss]pike/.test(read(`${SW}/references/checklist.md`)), 'AC4.2: checklist có mục spike');

  // AC5: luật phạm vi một chuẩn và dừng khi giả định của hướng bị bác
  ok(/6\. phải đổi nghĩa[\s\S]{0,300}giả định[\s\S]{0,120}bác/.test(TL), 'AC5.1: loại dừng 6 gồm hướng G1 dựa trên giả định bị kết quả chạy thật bác');
  ok(/mọi mức severity/.test(TL), 'AC5.2: luật ngoài AC đổi hành vi áp mọi mức severity');
  ok(/`Ruling:` không mở rộng `\*\*Files:\*\*`/.test(TL), 'AC5.2: Ruling không mở rộng Files để làm thay đổi hành vi ngoài AC');
  ok(/gộp vào task sau/.test(SK), 'AC5.2: bảng tự biện minh có dòng gộp rủi ro vào task sau');

  // AC6: số đo tái lập được từ nhánh
  ok(/tái lập được từ nhánh/.test(TL), 'AC6.1: số đo mà quyết định dựa vào phải tái lập được từ nhánh');
  ok(/tái lập được từ nhánh/.test(read(`${PE}/references/prompts/implementer.md`)), 'AC6.1: prompt implementer đòi đo bằng test hoặc script trong repo');
  ok(/số đo[\s\S]{0,200}`design\.md`/.test(read(`${PE}/references/finish.md`)), 'AC6.2: finish chép Ruling và số đo vào design.md');

  // AC7: bỏ cổng thừa
  ok(/Testcontainers[\s\S]{0,300}không hỏi/.test(read('plugins/data/skills/data-db-migration/references/change/verify-cycle.md')), 'AC7.1: DB tạm Testcontainers do test project dựng thì không hỏi xác nhận');
  ok(/kế hoạch C2[\s\S]{0,200}plan đã duyệt/.test(read('core/skills/git-workflow/SKILL.md')), 'AC7.2: kế hoạch C2 data-db-migration đã duyệt tính là plan đã duyệt');
}
