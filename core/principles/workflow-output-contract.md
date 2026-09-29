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
