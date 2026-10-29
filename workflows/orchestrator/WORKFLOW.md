---
name: workflow-orchestrator
description: "Phân loại yêu cầu để chọn 1 (hoặc tối đa 2 ứng viên) workflow đã cài, xác nhận với người dùng rồi chạy và tổng hợp kết quả. Dùng khi người dùng muốn \"không biết dùng workflow nào\", \"chọn workflow\", \"orchestrate\", \"làm giúp việc này theo quy trình\". Không dùng khi việc đã rõ là sửa bug → workflow-bugfix; làm feature → workflow-feature."
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
  dùng, chạy workflow đó và trả về `orchestrator_result` tổng hợp.
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

| id | Tín hiệu | Risk | Không dùng khi |
|---|---|---|---|
| `workflow-feature` | "thêm tính năng", "thêm endpoint", "làm feature", "user story", acceptance criteria | medium | Chỉ sửa lỗi hành vi đã có → bugfix |
| `workflow-bugfix` | "lỗi", "bug", stacktrace, "không chạy", "sai kết quả" | medium | Hệ thống production đang sập → skill `ops-incident-troubleshooting` |
| `workflow-security-review` | "bảo mật", "OWASP", "CVE", "secret" | high | Chỉ cần quality gate trước release → skill `engineering-quality-gate` |
| `workflow-performance` | "chậm", "tối ưu hiệu năng", "performance", "latency" | medium | Chậm do lỗi logic rõ ràng, không phải hiệu năng → bugfix |

**Thứ tự ưu tiên:** `workflow-security-review` > `workflow-bugfix` > `workflow-feature` > `workflow-performance`

## Yêu cầu chạy trực tiếp bằng skill

Các việc sau chỉ cần một năng lực nên là skill on-demand, không có workflow. Khi yêu cầu khớp, orchestrator không
chọn workflow: chỉ nêu skill cần gọi và kết thúc (không phải lỗi). Kết thúc tại Bước 1, không cần
`orchestrator_result`. Skill thuộc plugin chưa cài → in lệnh `aip install --plugin <id>`.

| Tín hiệu | Skill |
|---|---|
| "prod down", "sự cố", "alert", "incident" (xét TRƯỚC Registry) | `ops-incident-troubleshooting` (plugin `ops`) |
| "review", "PR#", "diff" | `backend-code-review` / `frontend-code-review` theo phía của diff; PR fullstack gọi cả hai |
| "refactor", "tái cấu trúc" | `backend-refactor` / `frontend-refactor`; "đổi kiến trúc" → `backend-migrate-architecture` / `frontend-migrate-architecture` |
| "viết test", "tăng coverage", "test strategy", "kiểm thử" | `backend-testing` / `frontend-testing`; luồng UI đầu-cuối → `frontend-e2e-testing` |
| "đổi schema", "migration", "thêm cột/bảng", "đổi index" | `data-db-migration` (plugin `data`) |
| "debug", "test flaky", "tìm nguyên nhân gốc", "tại sao test này đỏ" (chỉ điều tra, chưa cần pipeline sửa) | `engineering-debugging` (plugin `engineering`) |
| "OpenAPI", "contract-first" (chỉ chốt contract, chưa code) | `backend-api-contract` |
| "cập nhật tài liệu", "sync docs", "viết runbook" | Session chính sửa trực tiếp; ghi quyết định kiến trúc → `engineering-adr` |
| "khởi tạo backend", "scaffold API/service", "setup project backend mới" | `backend-init` (model không tự gọi được: đề nghị người dùng gõ `/backend:backend-init` khi cài dạng plugin, `/backend-init` khi cài dạng skills) |
| "khởi tạo frontend", "setup project React mới", "scaffold tài liệu nền frontend" | `frontend-init` (model không tự gọi được: đề nghị người dùng gõ `/frontend:frontend-init` khi cài dạng plugin, `/frontend-init` khi cài dạng skills) |
| "chuyển .env sang Vault/Consul", "externalize config/secret", "đưa secret vào Vault" | `backend-migrate-vault-consul` |
| "release", "phát hành", "ra version", "release start", "release finish", "hotfix start", "tạo tag version" | `git-release` (core) |
| "chuẩn bị deploy", "deploy checklist", "rollback" | `ops-deploy-release` (plugin `ops`) |

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.
Orchestrator không dispatch agent, không sửa code — mọi bước chạy ở session chính.

### Bước 1 — Phân loại

- **Thực hiện:** session chính
- **Đầu vào:** mô tả yêu cầu của người dùng
- **Hành động:** tín hiệu sự cố production ở mục "Yêu cầu chạy trực tiếp bằng skill" được xét TRƯỚC Registry;
  khớp thì nêu skill và dừng. Sau đó so khớp yêu cầu với cột `Tín hiệu` của từng dòng Registry; loại dòng mà
  yêu cầu rơi vào cột `Không dùng khi` (chuyển sang workflow cột đó chỉ tới); nếu vẫn khớp nhiều dòng, áp dụng **Thứ tự ưu tiên**
  để rút về tối đa 2 ứng viên. Yêu cầu khớp mục "Yêu cầu chạy trực tiếp bằng skill"
  thì nêu skill cần gọi và dừng; khớp cả Registry lẫn mục đó (ngoài tín hiệu sự cố, vd "review bảo mật PR#12")
  thì ưu tiên workflow trong Registry vì workflow đã gồm năng lực của skill.
- **Ràng buộc:** không tự phân loại bằng heuristic ngoài Registry và mục "Yêu cầu chạy trực tiếp bằng skill"; không
  đoán khi tín hiệu quá yếu — nêu rõ vì sao chọn.
- **Đầu ra:** 1 workflow đã chọn, hoặc tối đa 2 ứng viên kèm lý do, hoặc 1 skill trực tiếp.
- **Gate:** chọn được 1 workflow hoặc ≤2 ứng viên, có tín hiệu khớp trong Registry;
  hoặc yêu cầu khớp mục skill trực tiếp.
- **Khi fail:** không ứng viên nào khớp Registry và cũng không khớp mục skill trực tiếp → hỏi lại người dùng
  mô tả rõ hơn việc cần làm.
- **Evidence:** trích dẫn tín hiệu khớp trong yêu cầu + dòng Registry tương ứng.

### Bước 2 — Kiểm cài

- **Thực hiện:** session chính
- **Đầu vào:** workflow đã chọn ở Bước 1
- **Hành động:** kiểm workflow đã chọn có trong danh sách skill khả
  dụng của session hiện tại (skill tên `workflow-<slug>`, hoặc `workflows:workflow-<slug>` khi cài dạng plugin
  Claude); nếu cần đối chiếu file, cài phẳng nằm ở `.claude/skills/workflow-<slug>/` (Claude) hoặc
  `.agents/skills/workflow-<slug>/` (Codex), ở gốc project hoặc thư mục home khi cài global.
- **Ràng buộc:** không tự cài workflow thay người dùng.
- **Đầu ra:** xác nhận đã cài, hoặc lệnh cài đề xuất.
- **Gate:** workflow đã cài; chưa cài → in lệnh cài theo cách đang dùng (cài phẳng: `aip install --skill workflows/<id>`;
  cài plugin Claude: `claude plugin install workflows@<marketplace>`) và dừng `blocked`.
- **Khi fail:** chưa cài → in đúng lệnh cài theo cách đang dùng, dừng workflow, không thử cách khác.
- **Evidence:** đường dẫn skill đã cài (hoặc lệnh cài in ra khi chưa cài).

### Bước 3 — Xác nhận ⏸

- **Thực hiện:** session chính
- **Đầu vào:** workflow đã chọn (đã xác nhận cài ở Bước 2)
- **Hành động:** nêu rõ workflow được chọn, lý do khớp tín hiệu, `risk`; nếu ở Bước 1 còn 2 ứng viên, hỏi người dùng chọn 1.
- **Ràng buộc:** `risk` = `high`/`critical` bắt buộc người dùng xác nhận rõ ràng bằng lời, không suy diễn từ
  im lặng.
- **Đầu ra:** người dùng xác nhận workflow sẽ chạy.
- **Gate:** người dùng xác nhận workflow; risk high/critical phải xác nhận rõ ràng.
- **Khi fail:** người dùng từ chối hoặc còn mơ hồ → quay lại Bước 1 với thông tin bổ sung.
- **Evidence:** câu trả lời xác nhận của người dùng (trích dẫn nguyên văn trong report).

### Bước 4 — Chạy

- **Thực hiện:** session chính
- **Đầu vào:** workflow đã được xác nhận ở Bước 3
- **Hành động:** gọi skill của workflow đã chọn.
- **Ràng buộc:** chỉ chạy workflow đã xác nhận, không tự nối thêm workflow khác; không gọi lồng orchestrator.
- **Đầu ra:** `workflow_result` của workflow đã chạy.
- **Gate:** workflow đã chạy trả về `workflow_result` hợp lệ (có `status`).
- **Khi fail:** workflow `blocked`/`failed` → dừng tại đó, chuyển nguyên `workflow_result` sang Bước 5.
- **Evidence:** khối `workflow_result` của workflow đã chạy.

### Bước 5 — Tổng hợp

- **Thực hiện:** session chính
- **Đầu vào:** `workflow_result` từ Bước 4
- **Hành động:** đặt `workflow_result` vào `result`, lấy `status` của nó làm `status` tổng.
- **Ràng buộc:** không tự nâng `status` lên `completed` nếu workflow chưa `completed`.
- **Đầu ra:** khối `orchestrator_result`.
- **Gate:** có `orchestrator_result` với `status` bằng `status` của `workflow_result`.
- **Khi fail:** thiếu `workflow_result` → `status: blocked`, ghi rõ lý do.
- **Evidence:** khối `orchestrator_result` cuối report.

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 3 | Workflow được chọn, lý do, risk | Người dùng xác nhận rõ ràng (bằng lời với risk high/critical) |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối của workflow con; orchestrator không tự
commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Build fail (trong workflow con) | Workflow con tự xử lý theo bảng lỗi của nó; orchestrator chỉ dừng nếu workflow con báo `failed`/`blocked` |
| Test fail (trong workflow con) | Như trên — orchestrator không tự sửa, chỉ dừng khi workflow con báo `failed`/`blocked` |
| Yêu cầu mơ hồ | Dừng ở Bước 1/3, hỏi lại người dùng |
| Finding `blocker` (trong workflow con) | Workflow con dừng `blocked`; orchestrator dừng tại đó |
| Không tín hiệu nào khớp Registry và không khớp mục skill trực tiếp | Dừng, hỏi người dùng mô tả lại việc cần làm |
| Workflow chưa cài | In lệnh `aip install`, dừng `blocked`, không tự cài |

- **Điều kiện dừng:** không tín hiệu nào khớp Registry và không khớp mục skill trực tiếp; workflow chưa cài;
  người dùng không xác nhận ở Bước 3; workflow con trả `blocked`/`failed`.
- **Rollback:** orchestrator không tự sửa file nên không có gì để rollback ở tầng orchestrator; rollback thay
  đổi (nếu có) thuộc trách nhiệm của workflow con đã chạy.

## Definition of Done

- [ ] Workflow được chọn có tín hiệu khớp Registry — evidence: Bước 1
- [ ] Người dùng đã xác nhận workflow — evidence: Bước 3
- [ ] Workflow đã chạy có `workflow_result` — evidence: Bước 4
- [ ] Mọi gate có evidence `passed`
- [ ] `orchestrator_result` phản ánh đúng `status` của workflow đã chạy

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
orchestrator_result:
  request: "<tóm tắt yêu cầu>"
  classified: workflow-bugfix
  reason: "<tín hiệu khớp>"
  result: <workflow_result>
  status: completed        # completed | failed | blocked — bằng status của workflow_result
```
