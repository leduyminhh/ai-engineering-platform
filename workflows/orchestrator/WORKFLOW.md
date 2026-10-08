---
name: workflow-orchestrator
description: "Phân loại yêu cầu để chọn 1 (hoặc tối đa 2 ứng viên) workflow đã cài, xác nhận với người dùng rồi chạy tuần tự chuỗi nối tiếp và tổng hợp kết quả. Dùng khi người dùng muốn \"không biết dùng workflow nào\", \"chọn workflow\", \"orchestrate\", \"làm giúp việc này theo quy trình\". Không dùng khi việc đã rõ là sửa bug → workflow-bugfix; làm feature → workflow-feature."
order: 0
title: "Orchestrator — chọn và chạy workflow theo yêu cầu"
kind: orchestrator
agents: ""
requires: ""
runsIn: execute
invoke: per-request
---

# Orchestrator — chọn và chạy workflow theo yêu cầu

## Mục tiêu & đầu vào

- **Mục tiêu:** từ một yêu cầu tự do của người dùng, chọn đúng workflow trong Registry, xác nhận với người
  dùng, chạy (một mình hoặc chuỗi nối tiếp tối đa 3 workflow) và trả về `orchestrator_result` tổng hợp.
- **Đầu vào bắt buộc:** mô tả yêu cầu của người dùng (câu lệnh tự nhiên, có thể kèm log/stacktrace/diff/PR).
- **Đầu vào tuỳ chọn:** ngữ cảnh project đã biết (project-knowledge, PR đang mở, bug report có sẵn).

## Điều kiện tiên quyết

- Skill/agent đã cài: không cần agent riêng (orchestrator chỉ chạy ở session chính); workflow được chọn ở
  bước "Chạy" phải đã cài — bước "Kiểm cài" tự xác minh việc này.
- Artifact phải có sẵn: không có, ngoài chính yêu cầu của người dùng.
- Baseline: không yêu cầu build/test xanh trước — đó là điều kiện của workflow con được chọn, không phải của
  orchestrator.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Registry

| id | Tín hiệu | Risk | Nối tiếp | Không dùng khi |
|---|---|---|---|---|
| `workflow-feature` | "thêm tính năng", "làm feature", "user story", acceptance criteria | medium | — | Chỉ sửa lỗi hành vi đã có → bugfix |
| `workflow-bugfix` | "lỗi", "bug", stacktrace, "không chạy", "sai kết quả" | medium | `workflow-docs` | Hệ thống production đang sập → incident |
| `workflow-refactor` | "refactor", "tái cấu trúc", "đổi kiến trúc" | medium | `workflow-docs` | Đổi hành vi → feature |
| `workflow-code-review` | "PR#", "review", "diff" | low | — | Cần sửa code → feature/bugfix |
| `workflow-security-review` | "bảo mật", "OWASP", "CVE", "secret" | high | `workflow-docs` | Chỉ cần quality gate trước release → release |
| `workflow-incident` | "prod down", "sự cố", "alert", "incident" | critical | `workflow-bugfix`, `workflow-docs` | Lỗi tái hiện được ở local, production vẫn ổn → bugfix |
| `workflow-testing` | "viết test", "tăng coverage", "test strategy", "kiểm thử" | low | — | Failure là lỗi code cần sửa → bugfix |
| `workflow-db-change` | "đổi schema", "migration", "thêm cột/bảng", "đổi index" | high | `workflow-api`, `workflow-docs` | Không đổi schema, chỉ đổi query/logic → feature/bugfix |
| `workflow-api` | "làm API", "thêm endpoint", "OpenAPI", "contract-first" | medium | `workflow-feature`, `workflow-docs` | Không cần contract mới, chỉ sửa logic nội bộ → feature/bugfix |
| `workflow-release` | "release", "phát hành", "chuẩn bị deploy", "ra version" | high | — | Chưa sẵn sàng phát hành, cần sửa lỗi/tính năng trước → feature/bugfix |
| `workflow-performance` | "chậm", "tối ưu hiệu năng", "performance", "latency" | medium | — | Chậm do lỗi logic rõ ràng, không phải hiệu năng → bugfix |
| `workflow-docs` | "cập nhật tài liệu", "sync docs", "README lỗi thời", "viết runbook" | low | — | Cần đổi hành vi/code, không chỉ tài liệu → feature/bugfix |

**Thứ tự ưu tiên:** `workflow-incident` > `workflow-security-review` > `workflow-bugfix` > `workflow-db-change` > `workflow-api` > `workflow-feature` > `workflow-refactor` > `workflow-performance` > `workflow-testing` > `workflow-code-review` > `workflow-release` > `workflow-docs`

## Yêu cầu chạy trực tiếp bằng skill

Các việc sau là skill on-demand, không có workflow. Khi yêu cầu khớp, orchestrator không chọn workflow: chỉ nêu
skill cần gọi và kết thúc (không phải lỗi). Kết thúc tại Bước 1, không cần `orchestrator_result`.

| Tín hiệu | Skill |
|---|---|
| "khởi tạo backend", "scaffold API/service", "setup project backend mới" | `backend-init` |
| "khởi tạo frontend", "setup project React mới", "scaffold tài liệu nền frontend" | `frontend-init` |
| "chuyển .env sang Vault/Consul", "externalize config/secret", "đưa secret vào Vault" | `backend-migrate-vault-consul` |

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.
Orchestrator không dispatch agent, không sửa code — mọi bước chạy ở session chính.

### Bước 1 — Phân loại

- **Thực hiện:** session chính
- **Đầu vào:** mô tả yêu cầu của người dùng
- **Hành động:** so khớp yêu cầu với cột `Tín hiệu` của từng dòng Registry; loại dòng mà yêu cầu rơi vào cột
  `Không dùng khi` (chuyển sang workflow cột đó chỉ tới); nếu vẫn khớp nhiều dòng, áp dụng **Thứ tự ưu tiên**
  để rút về tối đa 2 ứng viên. Khi yêu cầu cần nhiều workflow phụ thuộc nhau (vd đổi schema → làm API → làm
  tính năng), đề xuất chuỗi theo thứ tự phụ thuộc thay vì chọn một workflow, tối đa 3 workflow, mỗi mắt nối
  phải có trong cột `Nối tiếp` của workflow đứng trước. Yêu cầu khớp mục "Yêu cầu chạy trực tiếp bằng skill"
  thì nêu skill cần gọi và dừng. Chuỗi đủ 3 workflow thì nhắc người dùng chạy `workflow-docs` riêng sau khi
  chuỗi xong, không nối thêm.
- **Ràng buộc:** không tự phân loại bằng heuristic ngoài Registry; không đoán khi tín hiệu quá yếu — nêu rõ vì
  sao chọn.
- **Đầu ra:** 1 workflow đã chọn, hoặc tối đa 2 ứng viên kèm lý do, hoặc một chuỗi tối đa 3 workflow theo thứ
  tự phụ thuộc, hoặc 1 skill trực tiếp.
- **Gate:** chọn được 1 workflow, ≤2 ứng viên hoặc một chuỗi ≤3 workflow, có tín hiệu khớp trong Registry;
  hoặc yêu cầu khớp mục skill trực tiếp.
- **Khi fail:** không ứng viên nào khớp Registry và cũng không khớp mục skill trực tiếp → hỏi lại người dùng
  mô tả rõ hơn việc cần làm.
- **Evidence:** trích dẫn tín hiệu khớp trong yêu cầu + dòng Registry tương ứng.

### Bước 2 — Kiểm cài

- **Thực hiện:** session chính
- **Đầu vào:** workflow (hoặc chuỗi workflow đề xuất) đã chọn ở Bước 1
- **Hành động:** kiểm mọi workflow đã chọn (kể cả các mắt trong chuỗi đề xuất) có trong danh sách skill khả
  dụng của session hiện tại (skill tên `workflow-<slug>`, hoặc `workflows:workflow-<slug>` khi cài dạng plugin
  Claude); nếu cần đối chiếu file, cài phẳng nằm ở `.claude/skills/workflow-<slug>/` (Claude) hoặc
  `.codex/skills/workflow-<slug>/` (Codex), ở gốc project hoặc thư mục home khi cài global.
- **Ràng buộc:** không tự cài workflow thay người dùng.
- **Đầu ra:** xác nhận đã cài, hoặc lệnh cài đề xuất.
- **Gate:** workflow đã cài; chưa cài → in lệnh cài theo cách đang dùng (cài phẳng: `aip install --skill workflows/<id>`;
  cài plugin Claude: `claude plugin install workflows@<marketplace>`) và dừng `blocked`.
- **Khi fail:** chưa cài → in đúng lệnh cài theo cách đang dùng, dừng workflow, không thử cách khác.
- **Evidence:** đường dẫn skill đã cài (hoặc lệnh cài in ra khi chưa cài).

### Bước 3 — Xác nhận ⏸

- **Thực hiện:** session chính
- **Đầu vào:** workflow đã chọn (đã xác nhận cài ở Bước 2)
- **Hành động:** nêu rõ workflow được chọn, lý do khớp tín hiệu, `risk`, và chuỗi nối tiếp dự kiến (nếu có);
  nếu ở Bước 1 còn 2 ứng viên, hỏi người dùng chọn 1.
- **Ràng buộc:** `risk` = `high`/`critical` bắt buộc người dùng xác nhận rõ ràng bằng lời, không suy diễn từ
  im lặng.
- **Đầu ra:** người dùng xác nhận workflow + chuỗi nối tiếp cụ thể sẽ chạy.
- **Gate:** người dùng xác nhận workflow + chuỗi nối tiếp; risk high/critical phải xác nhận rõ ràng.
- **Khi fail:** người dùng từ chối hoặc còn mơ hồ → quay lại Bước 1 với thông tin bổ sung.
- **Evidence:** câu trả lời xác nhận của người dùng (trích dẫn nguyên văn trong report).

### Bước 4 — Chạy ⏸

- **Thực hiện:** session chính
- **Đầu vào:** workflow (và chuỗi nối tiếp) đã được xác nhận ở Bước 3
- **Hành động:** gọi skill của workflow đã chọn; nếu có chuỗi nối tiếp, chạy tuần tự tối đa 3 workflow; sau
  mỗi workflow (trừ workflow cuối) dừng, trình `workflow_result` vừa xong và hỏi người dùng có chạy workflow kế
  tiếp không.
- **Ràng buộc:** không chạy song song nhiều workflow; không tự nối thêm workflow ngoài chuỗi đã xác nhận;
  không gọi lồng orchestrator.
- **Đầu ra:** một `workflow_result` cho mỗi workflow đã chạy trong chuỗi.
- **Gate:** mỗi workflow đã chạy trả về `workflow_result` hợp lệ (có `status`); người dùng xác nhận trước mỗi
  workflow kế tiếp trong chuỗi.
- **Khi fail:** một workflow trong chuỗi `blocked`/`failed` → dừng chuỗi tại đó, không chạy tiếp workflow sau.
- **Evidence:** khối `workflow_result` của từng workflow đã chạy.

### Bước 5 — Tổng hợp

- **Thực hiện:** session chính
- **Đầu vào:** danh sách `workflow_result` từ Bước 4
- **Hành động:** gom các `workflow_result` thành `results`, suy ra `status` tổng = trạng thái xấu nhất trong
  chain (`blocked` > `failed` > `completed`).
- **Ràng buộc:** không tự nâng `status` lên `completed` nếu bất kỳ workflow nào trong chain chưa `completed`.
- **Đầu ra:** khối `orchestrator_result`.
- **Gate:** có `orchestrator_result` với `status` = trạng thái xấu nhất trong chain.
- **Khi fail:** thiếu `workflow_result` của một workflow trong chain → `status: blocked`, ghi rõ lý do.
- **Evidence:** khối `orchestrator_result` cuối report.

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 3 | Workflow được chọn, lý do, risk, chuỗi nối tiếp dự kiến | Người dùng xác nhận rõ ràng (bằng lời với risk high/critical) |
| 4 | `workflow_result` của workflow vừa xong + workflow kế tiếp trong chuỗi | Người dùng xác nhận chạy tiếp (không có chuỗi → không dừng) |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối của workflow con; orchestrator không tự
commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Build fail (trong workflow con) | Workflow con tự xử lý theo bảng lỗi của nó; orchestrator chỉ dừng chain nếu workflow con báo `failed`/`blocked` |
| Test fail (trong workflow con) | Như trên — orchestrator không tự sửa, chỉ dừng chain khi cần |
| Yêu cầu mơ hồ | Dừng ở Bước 1/3, hỏi lại người dùng |
| Finding `blocker` (trong workflow con) | Workflow con dừng `blocked`; orchestrator dừng chain tại đó |
| Không tín hiệu nào khớp Registry và không khớp mục skill trực tiếp | Dừng, hỏi người dùng mô tả lại việc cần làm |
| Workflow chưa cài | In lệnh `aip install`, dừng `blocked`, không tự cài |
| Người dùng không muốn chạy workflow kế tiếp (sau Bước 4 ⏸) | Dừng chuỗi, tổng hợp các `workflow_result` đã có ở Bước 5 |

- **Điều kiện dừng:** không tín hiệu nào khớp Registry và không khớp mục skill trực tiếp; workflow chưa cài;
  người dùng không xác nhận ở Bước 3; một workflow trong chain trả `blocked`/`failed`.
- **Rollback:** orchestrator không tự sửa file nên không có gì để rollback ở tầng orchestrator; rollback thay
  đổi (nếu có) thuộc trách nhiệm của workflow con đã chạy.

## Definition of Done

- [ ] Workflow được chọn có tín hiệu khớp Registry — evidence: Bước 1
- [ ] Người dùng đã xác nhận workflow + chuỗi nối tiếp — evidence: Bước 3
- [ ] Mọi workflow trong chain có `workflow_result` — evidence: Bước 4
- [ ] Mọi gate có evidence `passed`
- [ ] `orchestrator_result` phản ánh đúng trạng thái xấu nhất trong chain

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
orchestrator_result:
  request: "<tóm tắt yêu cầu>"
  classified: workflow-bugfix
  reason: "<tín hiệu khớp>"
  chain: [workflow-bugfix, workflow-docs]
  results: [ <workflow_result>, … ]
  status: completed        # completed | failed | blocked — trạng thái xấu nhất trong chain
```
