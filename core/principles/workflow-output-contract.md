# Contract đầu ra — evidence, finding, workflow_result

Đây là **định dạng đầu ra mà agent và workflow phải tuân theo** khi báo kết quả; không phải dữ liệu để CLI
parse. Mọi pointer "contract đầu ra" trong agent/workflow đều trỏ về mục này.

## Evidence

Mỗi lệnh kiểm chứng (build/test/lint/scan) ghi một evidence:

```yaml
- command: "mvn test"
  exit_code: 0
  status: passed        # passed | failed | not_run
  summary: "142 tests, 142 passed, 0 failed, 0 skipped"
  reason: ""            # bắt buộc khi not_run
```

## Finding

Dùng cho reviewer, quality-auditor. Severity giữ thang của skill `*-code-review`:

```yaml
- severity: blocker     # blocker | major | minor | nit
  category: correctness # correctness | architecture | security | performance | testing | readability
  location: "src/.../OrderService.java:42"
  evidence: "<trích đoạn hoặc lý do quan sát được>"
  impact: "<hậu quả nếu không sửa>"
  recommendation: "<cách sửa>"
  confidence: high      # high | medium | low
```

## Agent result

Mọi worker agent kết thúc bằng khối này; `status` là bắt buộc:

```yaml
agent_result:
  agent: <agent-id>
  status: completed     # completed | failed | blocked
  summary: "<1–3 câu>"
  changes: { added: [], modified: [], deleted: [] }
  validation: [ <evidence> ]
  findings: [ <finding> ]
  questions: []         # câu hỏi cho người dùng/bước gọi; không rỗng thường đi kèm status: blocked
  remaining_risks: []
  tdd: { red: <evidence>, green: <evidence> }   # chỉ task TDD `có` (trường **TDD:** của plan); xem "Trường mở rộng"
  report_file: ""       # đường dẫn file report nếu có; agent chỉ-đọc để trống
  commits: []           # SHA commit của task; agent không tự commit nên thường rỗng
```

## Trường mở rộng cho vòng task

Dùng trong vòng task của `plan-execution`; workflow không dùng vòng task có thể bỏ qua. Mọi trường là phần của
`agent_result` ở trên.

- `tdd.red` / `tdd.green`: mỗi cái là một evidence. `red` là lệnh test chạy trước khi viết code, `exit_code` khác 0 và
  `summary` nêu vì sao đỏ là đúng lý do; `green` là cùng lệnh sau khi viết code, `exit_code: 0`. Chỉ task TDD `có`:
  dòng `**TDD:**` của task trong plan; thiếu dòng thì `BE` là `có`, kind khác là `không`.
- `report_file`: đường dẫn file report của agent. Agent không có quyền ghi (reviewer) trả report trong tin nhắn và để
  trống; session chính ghi file khi cần.
- `commits`: danh sách SHA. Agent không tự commit, nên trường này do session chính điền sau khi commit hoặc để rỗng.
- `spec_verdict` (reviewer chế độ task-review): `compliant` (diff khớp brief và AC), `issues` (có `Missing`, `Extra` hoặc
  `Misunderstood`, nêu từng mục), `cannot_verify` (kèm điều cần kiểm thêm; session chính giải quyết, không đoán).
- `verdicts[]` (reviewer chế độ re-review): mỗi finding của lần review trước một mục
  `{ finding, verdict: ADDRESSED | NOT ADDRESSED, evidence }`.
- `new_breakage[]`: finding (định dạng ở mục Finding) do chính diff của vòng sửa gây ra.
- `observations_outside_diff[]`: quan sát ngoài diff của vòng sửa; chỉ ghi nhận, không phải finding.
- `ruling_review[]` (reviewer chế độ final-review): đánh giá từng dòng `Ruling:` của ledger — đúng hay sai, chi phí nếu
  sai có chấp nhận được không, có cần người dùng quyết không.
- `declined_to_judge[]` (reviewer): điều bỏ qua kèm lý do (vd cần chạy hệ thống thật).

## Chế độ nhúng

Skill được viết cho phiên tương tác. Khi một agent worker nạp skill (khai trong `skills:` của agent) và chạy theo
giao việc của workflow hoặc `plan-execution`, agent ở **chế độ nhúng**. Session chính tự chạy skill theo yêu cầu của
người dùng thì không ở chế độ nhúng.

- **Không hỏi người dùng.** Bước nào của skill cần người dùng (hỏi, xác nhận, chọn phương án, duyệt) do bước gọi của
  workflow đảm nhận. Thiếu đầu vào hoặc cần xác nhận → `status: blocked` kèm `questions[]` (mỗi câu một dòng, kèm mặc
  định đề xuất).
- **Gate ⏸ thuộc workflow.** Agent không tự coi checkpoint người duyệt của skill là đã qua.
- **Phạm vi do bước gọi giao** (danh sách file, oracle, scope). Cần mở rộng → `blocked`, không tự mở.
- **Không commit, push, tag, merge.** Trường `commits` do session chính điền.
- **Đầu ra là `agent_result`.** Nội dung báo cáo mà skill yêu cầu đi vào `summary`, `findings`, `validation`,
  `remaining_risks` hoặc file report trong phạm vi được ghi; không in thêm bản báo cáo dài ngoài khối này.
- **Ranh giới an toàn và Verification của skill giữ nguyên.** Chế độ nhúng chỉ bỏ phần tương tác, không nới an toàn.

## Kiểm đầu ra worker

Supervisor là session chính (orchestrator hoặc workflow đang chạy). Mỗi lần nhận `agent_result`, áp các luật
sau trước khi đi `next`:

- Có `status`.
- Mỗi finding có `location` không rỗng và có `evidence`. `location` là `file:line` khi finding gắn với code;
  với log, số đo hoặc tài liệu thì là tham chiếu tới nguồn đó.
- `status: completed` thì không có `validation` nào ở trạng thái `failed`.
- Mọi file trong `changes` thuộc danh sách file đã giao (với agent có danh sách).
- Task TDD `có` phải có `tdd.red` và `tdd.green`; thiếu một trong hai → đầu ra hỏng. Task `**TDD:** không — <lý do>`
  không bị đòi `tdd`.
- Reviewer chạy task-review phải trả đủ cả `spec_verdict` lẫn `findings`; thiếu một trong hai → đầu ra hỏng.
  Re-review phải có `verdicts[]` cho từng finding đã giao.

Kết quả không đạt bất kỳ luật nào là **đầu ra hỏng**. Xử lý theo loại kết quả:

- **Đầu ra hỏng** → giao lại cho chính worker đó, kèm luật bị vi phạm, tối đa 2 lần. Không đi theo cạnh nào
  của graph. Hết ngưỡng → `ask_user`.
- **`status: blocked`** → `ask_user` ngay, không retry (đi cạnh `on_fail` tới `ask_user`/`blocked` nếu bước có); chuyển `questions[]` của worker cho người dùng.
  Luật này áp cho workflow không dùng vòng task. Trong vòng task của `plan-execution`, `blocked` kèm `questions[]` thì
  session chính thử trả lời từ spec/plan/design trước; trả lời được thì gửi lại câu trả lời (quyết định thì ghi dòng
  `Ruling:`), không hỏi người dùng. Chỉ `ask_user` khi câu hỏi thuộc loại dừng của `task-loop.md` (không đảo ngược, bảo mật,
  ngoài repo, schema DB, plan hỏng đến mức mọi hướng đều là đoán).
- **`status: completed` kèm `remaining_risks` không rỗng** → xong kèm lo ngại: đọc từng lo ngại, xử lý nếu thuộc phạm vi
  task, không thì chuyển cho reviewer; không tính là lỗi và không đi cạnh `on_fail`.
- **`status: failed`**, hoặc đầu ra hợp lệ nhưng gate trượt → đi cạnh `on_fail` khớp `when`, tính lượt theo
  mục "Retry có ngưỡng".

## Retry có ngưỡng

- Cạnh `on_fail` quay ngược khai báo `max_attempts` trong `graph.json`; mỗi cạnh quay ngược được đi tối đa
  `max_attempts` lần trong một lần chạy workflow. `graph.json` nằm cùng thư mục với `SKILL.md`/`WORKFLOW.md`
  của workflow; không đọc được hoặc cạnh thiếu `max_attempts` thì Supervisor dùng 2.
- Bộ đếm tính riêng cho từng cạnh và không reset khi workflow đi tiếp. Supervisor tự đếm trong hội thoại,
  không ghi file state.
- Lần thứ `max_attempts + 1` cần đi cạnh đó → chuyển sang `ask_user`, kèm lý do trượt của từng lượt.
- Cạnh `gate.reject` của gate `human` và cạnh tới `blocked`/`ask_user` không có `max_attempts`.

## Vòng sửa của vòng task

Vòng task của `plan-execution` sửa theo finding review với bộ đếm riêng, không dùng `max_attempts` của `graph.json`:

- Mỗi task tối đa 3 vòng sửa; bộ đếm đặt lại mỗi task (về 0 ở task kế tiếp) và không phải cạnh của `graph.json`.
  Supervisor tự đếm trong hội thoại. Mỗi vòng là một lần sửa cộng một lần re-review có phạm vi.
- Vòng 3 dùng agent mới chạy `opus`. Sau vòng 3 không còn vòng nào nữa: finding còn mở được session chính phán, ghi mỗi
  quyết định một dòng `Ruling:` vào ledger rồi chạy tiếp; chạm loại dừng thì `ask_user`.
- Bước "Vòng task" chỉ là một node của graph. Cạnh lùi giữa các bước của workflow vẫn theo mục "Retry có ngưỡng"
  (`max_attempts`, mặc định 2). Hai con số đo hai thứ khác nhau: 3 là số vòng sửa trong một task, 2 là số lần quay lại
  một bước trước đó của workflow.

## Re-review có phạm vi

Sau mỗi vòng sửa, reviewer chỉ xét diff của vòng sửa (từ `FIX_BASE` tới `head`), không review lại cả task:

- Mỗi finding của lần review trước nhận đúng một nhãn trong `verdicts[]`: `ADDRESSED` hoặc `NOT ADDRESSED`.
- Breakage do chính diff của vòng sửa gây ra ghi vào `new_breakage[]`, theo định dạng Finding.
- Quan sát ngoài diff ghi vào `observations_outside_diff[]` và vào ledger; không thành finding mới, không kéo dài vòng.
- Còn `NOT ADDRESSED` hoặc `new_breakage` mức `blocker`/`major` → task ở lại vòng sửa kế tiếp (nếu còn vòng); còn lại
  ghi vào ledger.

## Result contract

Mọi workflow kết thúc bằng:

```yaml
workflow_result:
  workflow: <workflow-id>
  status: completed     # completed | failed | blocked
  summary: "<1–3 câu>"
  changes: { added: [], modified: [], deleted: [] }
  validation: [ <evidence> ]
  findings: [ <finding> ]    # nếu workflow có bước review
  remaining_risks: []
  docs_updated: []
  next_actions: []
  rulings: []                # mọi dòng `Ruling:` đã ghi trong ledger; rỗng nếu workflow không dùng vòng task
```

`rulings` liệt kê nguyên văn mọi dòng `Ruling: <quyết định> — <lý do> — <chi phí nếu sai>` ghi trong ledger của lần chạy.

## Quy tắc chung

- `status: completed` chỉ khi mọi mục Definition of Done có evidence `passed`. Mục `not_run` ghi vào
  `remaining_risks`; mục bắt buộc mà `not_run` → `blocked`.
- Không kết luận về hiệu năng nếu không có số đo trước/sau trên cùng điều kiện.
