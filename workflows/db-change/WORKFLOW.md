---
name: workflow-db-change
description: "Workflow điều phối thay đổi schema database: xác định bảng/cột/index bị ảnh hưởng, thiết kế migration forward + rollback tương thích ngược, implement migration và code, review query/index, chạy thử migrate up/rollback/up trên DB test, rồi commit. Dùng workflow NÀY khi người dùng muốn \"đổi schema\", \"migration\", \"thêm cột/bảng\", \"đổi index\" — kể cả khi không nói chính xác chữ \"workflow\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần."
order: 7
title: "DB change — migration schema forward/rollback"
kind: workflow
tier: 2
risk: high
agents: "backend-implementer,backend-reviewer"
requires: "core/git-workflow"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# DB change — migration schema forward/rollback

## Mục tiêu & đầu vào

- **Mục tiêu:** thay đổi schema database an toàn — có migration forward + rollback tương thích ngược, code
  đi kèm đã review, đã chạy thử migrate up → rollback → migrate up thành công trên DB test.
- **Đầu vào bắt buộc:** mô tả thay đổi schema (bảng/cột/index cần thêm/sửa/xoá).
- **Đầu vào tuỳ chọn:** data-model/ERD hiện tại, migration tool đang dùng của project.

## Điều kiện tiên quyết

- Skill/agent đã cài: `backend-implementer`, `backend-reviewer`, skill `core/git-workflow`.
- Artifact phải có sẵn: schema/data-model hiện tại đọc được (migration trước đó, ERD, hoặc kết nối DB test).
- Baseline: có DB test riêng biệt để chạy thử migration, không phải DB production.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Data model & impact

- **Thực hiện:** session chính
- **Đầu vào:** mô tả thay đổi schema của người dùng
- **Hành động:** xác định bảng/cột/index bị ảnh hưởng; tìm nơi dùng các bảng/cột đó trong code (query, ORM
  mapping, DTO).
- **Ràng buộc:** không mở rộng phạm vi ngoài thay đổi được nêu.
- **Đầu ra:** danh sách bảng/cột/index bị ảnh hưởng + nơi dùng trong code.
- **Gate:** bảng/cột/index bị ảnh hưởng + nơi dùng trong code.
- **Khi fail:** không xác định được hết nơi dùng → hỏi người dùng phạm vi rõ hơn, không tự đoán.
- **Evidence:** danh sách bảng/cột/index + `file:line` nơi dùng trong report bước.

### Bước 2 — Thiết kế migration ⏸

- **Thực hiện:** session chính
- **Đầu vào:** danh sách impact từ Bước 1
- **Hành động:** thiết kế migration forward + rollback theo chiến lược expand/contract (thêm trước, backfill,
  rồi mới xoá/đổi ràng buộc cũ ở migration sau); trình cho người dùng xác nhận trước khi implement.
- **Ràng buộc:** không thiết kế migration xoá dữ liệu ngay trong cùng migration thêm cột/bảng mới.
- **Đầu ra:** thiết kế migration forward + rollback + tương thích ngược, đã được người dùng xác nhận.
- **Gate:** forward + rollback + tương thích ngược (expand/contract).
- **Khi fail:** người dùng không đồng ý thiết kế → quay lại Bước 1 làm rõ impact/ràng buộc.
- **Evidence:** thiết kế migration + xác nhận của người dùng trong report bước.

### Bước 3 — Implement

- **Thực hiện:** session chính (file migration) ∥ agent `backend-implementer` (code)
- **Đầu vào:** thiết kế đã xác nhận từ Bước 2
- **Hành động:** viết file migration forward + rollback theo migration tool của project; cập nhật code
  (query/ORM mapping/DTO) theo nơi dùng đã xác định ở Bước 1.
- **Ràng buộc:** không sửa code ngoài phạm vi nơi dùng đã xác định.
- **Đầu ra:** file migration + code cập nhật.
- **Gate:** build xanh.
- **Khi fail:** build đỏ → chẩn đoán → sửa → build lại.
- **Evidence:** lệnh build + exit code 0.

### Bước 4 — Review query/index

- **Thực hiện:** agent `backend-reviewer`
- **Đầu vào:** migration + code từ Bước 3
- **Hành động:** review query mới/đổi và index liên quan (thiếu index gây scan toàn bảng, index thừa,
  N+1 query phát sinh từ thay đổi schema).
- **Ràng buộc:** chỉ đọc, không tự sửa code.
- **Đầu ra:** danh sách finding theo severity (schema §5.1).
- **Gate:** 0 blocker.
- **Khi fail:** còn finding `blocker` → quay lại Bước 3 sửa, review lại phần đã sửa.
- **Evidence:** danh sách finding (severity/category/location/evidence/confidence).

### Bước 5 — Chạy thử trên DB test

- **Thực hiện:** session chính
- **Đầu vào:** migration đã qua review từ Bước 4
- **Hành động:** chạy migrate up → rollback → migrate up lại trên DB test; xác nhận cả 3 lượt chạy thành công.
- **Ràng buộc:** cấm chạy trên DB production; cấm thay đổi phá huỷ dữ liệu khi chưa được người dùng xác nhận
  ở Bước 2.
- **Đầu ra:** kết quả migrate up → rollback → migrate up trên DB test.
- **Gate:** migrate up → rollback → migrate up thành công, có evidence lệnh.
- **Khi fail:** một lượt trong chuỗi up/rollback/up thất bại → quay lại Bước 3 sửa migration, chạy lại cả
  chuỗi từ đầu.
- **Evidence:** lệnh migrate up/rollback/up + exit code từng lượt.

### Bước 6 — Commit ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** migration + code đã qua Bước 1–5
- **Hành động:** đề xuất commit message Conventional Commits (header EN, body VI); trình diff cho người dùng
  duyệt.
- **Ràng buộc:** không tự commit khi người dùng chưa duyệt diff; không push trừ khi được yêu cầu.
- **Đầu ra:** commit đã tạo (sau khi người dùng duyệt).
- **Gate:** người dùng duyệt diff.
- **Khi fail:** người dùng yêu cầu sửa thêm → quay lại bước tương ứng, không commit tạm.
- **Evidence:** hash commit + message.

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 2 | Thiết kế migration forward + rollback + tương thích ngược | Người dùng xác nhận thiết kế |
| 6 | Diff migration + code | Người dùng duyệt diff |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Build fail | Chẩn đoán → sửa → build lại |
| Test fail | Phân tích failure → sửa code (không xoá/nới test) → chạy lại |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` | Chặn hoàn thành cho tới khi sửa hoặc người dùng chấp nhận rủi ro |
| Người dùng không xác nhận thiết kế migration (sau Bước 2 ⏸) | Quay lại Bước 1 làm rõ impact/ràng buộc |
| Một lượt migrate up/rollback/up thất bại (Bước 5) | Quay lại Bước 3 sửa migration, chạy lại cả chuỗi từ đầu |
| Người dùng không duyệt diff (sau Bước 6 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |
| Thay đổi phá huỷ dữ liệu chưa được xác nhận | Cấm thực hiện; quay lại Bước 2 xin xác nhận rõ ràng |

- **Điều kiện dừng:** người dùng không xác nhận thiết kế migration sau nhiều vòng; chuỗi migrate up/rollback/up
  liên tục thất bại; finding `blocker` không sửa được; người dùng không duyệt diff; yêu cầu chạy migration
  trên production.
- **Rollback:** migration đã viết có sẵn script rollback riêng (Bước 2); trước checkpoint commit, chưa có gì
  để rollback ở tầng git; workflow không tự chạy migration trên production nên không cần rollback ở đó.

## Definition of Done

- [ ] Bảng/cột/index bị ảnh hưởng + nơi dùng trong code — evidence: Bước 1
- [ ] Thiết kế migration forward + rollback + tương thích ngược đã xác nhận — evidence: Bước 2
- [ ] Build xanh sau implement — evidence: Bước 3
- [ ] 0 finding blocker ở review query/index — evidence: Bước 4
- [ ] Migrate up → rollback → migrate up thành công trên DB test — evidence: Bước 5
- [ ] Người dùng đã duyệt diff và commit đã tạo — evidence: Bước 6
- [ ] Mọi gate có evidence `passed`
- [ ] 0 finding `blocker`

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
workflow_result:
  workflow: workflow-db-change
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
