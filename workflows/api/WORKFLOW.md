---
name: workflow-api
description: "Workflow điều phối làm API contract-first: chốt OpenAPI 3.1 trước khi code, implement backend theo contract, test integration + contract, kiểm drift contract↔code, tuỳ chọn sinh FE client, cập nhật docs rồi commit. Dùng workflow NÀY khi người dùng muốn \"làm API\", \"thêm endpoint\", \"OpenAPI\", \"contract-first\" — kể cả khi không nói chính xác chữ \"workflow\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần."
order: 8
title: "API — contract-first, implement, kiểm drift"
kind: workflow
tier: 2
risk: medium
agents: "backend-implementer,backend-test-writer,backend-reviewer,frontend-implementer"
requires: "backend/backend-api-contract,core/git-workflow"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# API — contract-first, implement, kiểm drift

## Mục tiêu & đầu vào

- **Mục tiêu:** có endpoint API mới/đổi, contract OpenAPI 3.1 hợp lệ chốt trước khi code, backend implement
  khớp contract, test integration + contract pass, 0 drift contract↔code, docs cập nhật.
- **Đầu vào bắt buộc:** mô tả endpoint cần làm (mục đích, request/response, ai gọi).
- **Đầu vào tuỳ chọn:** contract OpenAPI hiện có (nếu là đổi endpoint đã có), FE có cần nối client hay không.

## Điều kiện tiên quyết

- Skill/agent đã cài: `backend-implementer`, `backend-test-writer`, `backend-reviewer`, `frontend-implementer`,
  skill `backend/backend-api-contract`, `core/git-workflow`.
- Artifact phải có sẵn: `docs/contracts/` của project (nếu đã có API khác) để giữ nhất quán versioning.
- Baseline: build/test hiện tại của backend đang XANH trước khi thêm endpoint.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Contract ⏸

- **Thực hiện:** agent `backend-implementer` (skill `backend-api-contract`)
- **Đầu vào:** mô tả endpoint của người dùng
- **Hành động:** thiết kế/cập nhật OpenAPI 3.1 tại `docs/contracts/`; nếu là breaking change trên endpoint đã
  có, thêm versioning/deprecation theo lộ trình; trình cho người dùng xác nhận trước khi implement.
- **Ràng buộc:** không code trước khi contract được xác nhận.
- **Đầu ra:** file OpenAPI 3.1 đã cập nhật, đã được người dùng xác nhận.
- **Gate:** OpenAPI 3.1 hợp lệ; breaking change có versioning/deprecation.
- **Khi fail:** người dùng không đồng ý contract → sửa lại theo góp ý, trình lại.
- **Evidence:** đường dẫn file contract + xác nhận của người dùng.

### Bước 2 — Implement BE

- **Thực hiện:** agent `backend-implementer`
- **Đầu vào:** contract đã xác nhận từ Bước 1
- **Hành động:** implement controller/handler khớp đúng request/response của contract.
- **Ràng buộc:** không tự đổi contract khi implement — lệch thì quay lại Bước 1 sửa contract trước.
- **Đầu ra:** code backend khớp contract.
- **Gate:** build xanh.
- **Khi fail:** build đỏ → chẩn đoán → sửa → build lại.
- **Evidence:** lệnh build + exit code 0.

### Bước 3 — Test

- **Thực hiện:** agent `backend-test-writer`
- **Đầu vào:** code backend từ Bước 2 + contract từ Bước 1
- **Hành động:** viết integration test cho endpoint + contract test đối chiếu response thật với schema OpenAPI.
- **Ràng buộc:** không viết test giòn phụ thuộc dữ liệu ngoài tầm kiểm soát.
- **Đầu ra:** integration test + contract test, chạy được.
- **Gate:** integration + contract test pass.
- **Khi fail:** test fail → phân tích failure → sửa code (không xoá/nới test) → chạy lại.
- **Evidence:** lệnh chạy test + exit code + số liệu pass/fail.

### Bước 4 — Kiểm drift

- **Thực hiện:** agent `backend-reviewer`
- **Đầu vào:** contract + code + test đã qua Bước 1–3
- **Hành động:** đối chiếu endpoint/DTO thực tế với contract (thiếu/thừa field, kiểu sai, endpoint lệch).
- **Ràng buộc:** chỉ đọc, không tự sửa code.
- **Đầu ra:** danh sách drift (nếu có) hoặc xác nhận 0 drift.
- **Gate:** 0 drift contract↔code.
- **Khi fail:** phát hiện drift → quay lại Bước 2 sửa code hoặc Bước 1 sửa contract, review lại.
- **Evidence:** danh sách đối chiếu contract↔code trong report bước.

### Bước 5 — FE client (tuỳ chọn)

- **Thực hiện:** agent `frontend-implementer`
- **Đầu vào:** contract đã qua kiểm drift từ Bước 4
- **Hành động:** sinh/cập nhật type và client gọi API từ contract, nếu người dùng yêu cầu nối FE; nếu không,
  ghi rõ "bỏ qua".
- **Ràng buộc:** không tự đổi contract để hợp với FE — lệch thì quay lại Bước 1.
- **Đầu ra:** type/client FE khớp contract, hoặc dòng "bỏ qua".
- **Gate:** type/client khớp contract, hoặc ghi "bỏ qua".
- **Khi fail:** type/client không khớp contract → sửa lại theo đúng contract, không sửa contract để hợp FE.
- **Evidence:** đường dẫn file type/client, hoặc dòng "bỏ qua" trong report bước.

### Bước 6 — Docs & commit ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** contract + code + test đã qua Bước 1–5
- **Hành động:** cập nhật docs API bị ảnh hưởng; đề xuất commit message Conventional Commits (header EN, body
  VI); trình diff cho người dùng duyệt.
- **Ràng buộc:** không tự commit khi người dùng chưa duyệt diff.
- **Đầu ra:** docs API cập nhật + commit đã tạo (sau khi người dùng duyệt).
- **Gate:** docs API cập nhật; người dùng duyệt diff.
- **Khi fail:** người dùng yêu cầu sửa thêm → quay lại bước tương ứng, không commit tạm.
- **Evidence:** danh sách docs đã cập nhật + hash commit + message.

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 1 | OpenAPI 3.1 (mới/đổi) + versioning/deprecation nếu breaking | Người dùng xác nhận contract |
| 6 | Docs API + diff code/test | Người dùng duyệt diff |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Build fail | Chẩn đoán → sửa → build lại |
| Test fail | Phân tích failure → sửa code (không xoá/nới test) → chạy lại |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` | Chặn hoàn thành cho tới khi sửa hoặc người dùng chấp nhận rủi ro |
| Người dùng không xác nhận contract (sau Bước 1 ⏸) | Sửa lại theo góp ý, trình lại, không code trước |
| Phát hiện drift contract↔code (Bước 4) | Quay lại Bước 2 sửa code hoặc Bước 1 sửa contract |
| Người dùng không duyệt diff (sau Bước 6 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |

- **Điều kiện dừng:** người dùng không xác nhận contract sau nhiều vòng; drift contract↔code không sửa được;
  finding `blocker` không sửa được; người dùng không duyệt diff.
- **Rollback:** trước khi contract được xác nhận ở Bước 1, chưa có code nào được viết nên không cần rollback;
  sau đó, chưa có gì để rollback ở tầng git cho tới checkpoint commit.

## Definition of Done

- [ ] Contract OpenAPI 3.1 hợp lệ đã xác nhận — evidence: Bước 1
- [ ] Build xanh sau implement BE — evidence: Bước 2
- [ ] Integration + contract test pass — evidence: Bước 3
- [ ] 0 drift contract↔code — evidence: Bước 4
- [ ] FE client khớp contract hoặc ghi "bỏ qua" — evidence: Bước 5
- [ ] Docs API cập nhật, người dùng đã duyệt diff và commit đã tạo — evidence: Bước 6
- [ ] Mọi gate có evidence `passed`
- [ ] 0 finding `blocker`

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
workflow_result:
  workflow: workflow-api
  status: completed        # completed | failed | blocked
  summary: "<1–3 câu>"
  changes: { added: [], modified: [], deleted: [] }
  validation:
    - command: "<lệnh>"
      exit_code: 0
      status: passed       # passed | failed | not_run
      summary: "<số liệu>"
      reason: ""
  findings: []             # severity, category, location, evidence, impact, recommendation, confidence
  remaining_risks: []
  docs_updated: []
  next_actions: []
```
