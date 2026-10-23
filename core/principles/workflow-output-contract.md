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
```

## Kiểm đầu ra worker

Supervisor là session chính (orchestrator hoặc workflow đang chạy). Mỗi lần nhận `agent_result`, áp các luật
sau trước khi đi `next`:

- Có `status`.
- Mỗi finding có `location` không rỗng và có `evidence`. `location` là `file:line` khi finding gắn với code;
  với log, số đo hoặc tài liệu thì là tham chiếu tới nguồn đó.
- `status: completed` thì không có `validation` nào ở trạng thái `failed`.
- Mọi file trong `changes` thuộc danh sách file đã giao (với agent có danh sách).

Kết quả không đạt bất kỳ luật nào là **đầu ra hỏng**. Xử lý theo loại kết quả:

- **Đầu ra hỏng** → giao lại cho chính worker đó, kèm luật bị vi phạm, tối đa 2 lần. Không đi theo cạnh nào
  của graph. Hết ngưỡng → `ask_user`.
- **`status: blocked`** → đi cạnh `on_fail` hiện có (thường là `ask_user`) ngay, không retry.
- **`status: failed`**, hoặc đầu ra hợp lệ nhưng gate trượt → đi cạnh `on_fail` khớp `when`, tính lượt theo
  mục "Retry có ngưỡng".

## Retry có ngưỡng

- Cạnh `on_fail` quay ngược khai báo `max_attempts` trong `graph.json`; mỗi cạnh quay ngược được đi tối đa
  `max_attempts` lần trong một lần chạy workflow.
- Bộ đếm tính riêng cho từng cạnh và không reset khi workflow đi tiếp. Supervisor tự đếm trong hội thoại,
  không ghi file state.
- Lần thứ `max_attempts + 1` cần đi cạnh đó → chuyển sang `ask_user`, kèm lý do trượt của từng lượt.
- Cạnh `gate.reject` của gate `human` và cạnh tới `blocked`/`ask_user` không có `max_attempts`.

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
```

## Quy tắc chung

- `status: completed` chỉ khi mọi mục Definition of Done có evidence `passed`. Mục `not_run` ghi vào
  `remaining_risks`; mục bắt buộc mà `not_run` → `blocked`.
- Không kết luận về hiệu năng nếu không có số đo trước/sau trên cùng điều kiện.
