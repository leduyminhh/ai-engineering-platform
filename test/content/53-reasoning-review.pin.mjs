// Pin: docs/requests/2026-11-11-reasoning-review — giả định của implementer được reviewer xét; Ruling dựa vào số đo có lệnh chạy lại.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8').replace(/\r\n/g, '\n');
  const flat = (s) => s.replace(/\s*\n\s*/g, ' ');
  const PE = ['core', 'skills', 'plan-execution'];
  const contract = flat(read('core', 'principles', 'workflow-output-contract.md'));
  const impl = flat(read(...PE, 'references', 'prompts', 'implementer.md'));
  const tr = flat(read(...PE, 'references', 'prompts', 'task-review.md'));
  const rr = flat(read(...PE, 'references', 'prompts', 're-review.md'));

  // AC1.1: contract có khoá assumptions, assumption_review[], rerun
  ok(/assumptions: \[\]/.test(contract) && /`assumptions`[^.]*`assumption`[^.]*`basis`[^.]*`if_wrong`/.test(contract),
    'AC1.1: contract có khoá assumptions với assumption/basis/if_wrong');
  ok(/`assumption_review\[\]`[^.]*`holds` \| `wrong` \| `unverifiable`[^.]*`evidence`/.test(contract),
    'AC1.1: contract có assumption_review[] với holds | wrong | unverifiable và evidence');
  ok(/`ruling_review\[\]`[^]*rerun: \{ command, exit_code, matches \}/.test(contract), 'AC1.1: ruling_review[] nêu rerun: { command, exit_code, matches }');

  // AC1.2: luật kiểm đầu ra
  const check = contract.split('## Kiểm đầu ra worker')[1]?.split('Kết quả không đạt')[0] ?? '';
  ok(/thiếu khoá `assumptions`[^.]*đầu ra hỏng/.test(check) && /`assumptions: \[\]`[^.]*không phải đầu ra hỏng/.test(check),
    'AC1.2: thiếu khoá assumptions là đầu ra hỏng; assumptions: [] thì không');
  ok(/subagent/.test(check), 'AC1.2: luật assumptions chỉ áp khi subagent trả agent_result');
  ok(/task-review[^.]*`assumptions` không rỗng[^.]*`assumption_review\[\]`[^.]*số mục/.test(check),
    'AC1.2: luật riêng cho reviewer task-review: thiếu assumption_review[] hoặc số mục khác là đầu ra hỏng');

  // AC1.3: implementer khai assumptions
  ok(/assumptions/.test(impl) && /có thể rỗng/.test(impl) && /`basis`/.test(impl) && /`if_wrong`/.test(impl)
    && /brief, AC (?:và|hay) Interfaces không nói/.test(impl), 'AC1.3: implementer đòi assumptions (có thể rỗng) kèm basis, if_wrong, chỉ điều brief/AC/Interfaces không nói');

  // AC1.4: task-review xét từng giả định; re-review chỉ xét giả định mới
  ok(/assumption_review\[\]/.test(tr) && /từng giả định/.test(tr) && /`wrong`[^.]*major/.test(tr),
    'AC1.4: task-review đòi assumption_review[] cho từng giả định, wrong vi phạm AC/brief là major trở lên');
  ok(/[Gg]iả định ngầm[^.]*(không khai|chưa khai)[^.]*finding/.test(tr), 'AC1.4: giả định ngầm thấy trong diff mà báo cáo không khai thành finding');
  ok(/giả định mới/.test(rr) && /assumption_review\[\]/.test(rr) && /`wrong`[^.]*`blocker`\/`major`[^.]*vòng sửa/.test(rr),
    'AC1.4: re-review chỉ xét giả định mới, wrong mức blocker/major giữ task trong vòng sửa');

  const loop = flat(read(...PE, 'references', 'task-loop.md'));
  const fr = flat(read(...PE, 'references', 'prompts', 'final-review.md'));
  const skill = flat(read(...PE, 'SKILL.md'));
  const fin = flat(read(...PE, 'references', 'finish.md'));
  const inl = flat(read(...PE, 'references', 'inline.md'));
  const RULINGS = /ledger\.mjs <plan\.md(?: gốc)?> --rulings/;

  // AC1.5: loại dừng 6 có vế giả định wrong; cú pháp chạy lại; xử lý assumption_review[]
  ok(/6\. phải đổi nghĩa[^]*?[Gg]iả định `wrong`[^.]*G1/.test(loop), 'AC1.5: loại dừng 6 gồm giả định wrong mà hướng G1 dựa vào');
  ok(/— chạy lại: `<lệnh>`/.test(loop), 'AC1.5: task-loop nêu cú pháp — chạy lại: `<lệnh>`');
  ok(/`assumption_review\[\]`[^.]*`wrong`[^.]*finding[^.]*`unverifiable`[^.]*`cannot_verify`/.test(loop),
    'AC1.5: task-loop xử lý wrong như finding, unverifiable như cannot_verify');

  // AC3.1: final-review dùng --rulings, chạy lại lệnh chỉ đọc, nhãn cần người dùng quyết
  ok(RULINGS.test(fr), 'AC3.1: final-review nhận output ledger.mjs --rulings');
  ok(/chạy lại:[^.]*chỉ đọc[^.]*`rerun`/.test(fr) && /declined_to_judge/.test(fr), 'AC3.1: reviewer chạy lệnh chỉ đọc, ghi rerun; lệnh ghi/ngoài repo vào declined_to_judge');
  ok(/`matches: false`[^.]*`số đo không có lệnh chạy lại`[^.]*lý do sai với code[^.]*cần người dùng quyết/.test(fr),
    'AC3.1: matches false, cờ số đo, lý do sai với code → nhãn cần người dùng quyết');

  // AC3.2, AC3.3: G3 tách Ruling cần người dùng quyết; gom Ruling bằng --rulings
  ok(/cần người dùng quyết[^.]*(riêng|tách)/.test(fin) && RULINGS.test(fin), 'AC3.2: finish.md gom bằng --rulings và nêu riêng Ruling cần người dùng quyết ở G3');
  ok(RULINGS.test(skill), 'AC3.3: SKILL.md bước 3 trỏ --rulings');
  ok(/11\. [^]*?--rulings/.test(loop.split('## Review cuối và các điểm cố định')[0]), 'AC3.3: Chế độ part bước 11 gom Ruling bằng --rulings');
  ok(RULINGS.test(inl.split('## Review cuối')[1] ?? ''), 'AC3.3: review cuối inline đọc --rulings');

  // AC3.2, AC3.3: workflow-feature Bước 4 mẫu ba phần, Bước 6 --rulings + chạy lại, Bước 7 tách Ruling cần người dùng quyết
  const wf = flat(read('workflows', 'feature', 'WORKFLOW.md'));
  const step = (n) => wf.split(`### Bước ${n} `)[1]?.split('### Bước ')[0] ?? '';
  ok(/`Ruling: nhóm <nhãn> chạy tuần tự — <lý do> — <chi phí nếu sai>`/.test(step(4)), 'AC3.3: Bước 4 mẫu Ruling nhóm tuần tự có ba phần');
  ok(/ledger\.mjs <plan\.md> --rulings/.test(step(6)) && /chạy lại/.test(step(6)), 'AC3.3: Bước 6 gom Ruling bằng --rulings và chạy lại lệnh');
  ok(/cần người dùng quyết[^.]*(riêng|tách)/.test(step(7)), 'AC3.2: Bước 7 nêu riêng Ruling cần người dùng quyết ở G3');
}
