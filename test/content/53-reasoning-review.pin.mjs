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
}
