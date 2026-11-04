<!-- artifact-template
type: specs-readme
version: 1
validator: scripts/check-request.mjs
sources: docs/requests/2026-11-04-living-spec-bootstrap/design.md
Bỏ khối này khi chép template ra dùng.
-->

# Spec sống theo năng lực

Điểm vào để biết project **đang có** gì. Mỗi năng lực có một spec sống tại `docs/specs/<năng-lực>/spec.md` (khung: `docs/specs/_TEMPLATE.md` khi project đã chạy `aip init --full`; không thì `spec.template.md` của skill `artifact-templates`); mỗi yêu cầu có ID `<năng-lực>/R<n>` và một câu hành vi đo được.

| Năng lực | Mô tả | Spec |
|---|---|---|

Spec sống tạo dần: request chạm tới một năng lực khai ảnh hưởng ở mục `## Ảnh hưởng spec` của `design.md`, rồi bước gộp cập nhật spec của năng lực đó (tạo mới nếu chưa có, kèm một dòng trong bảng trên). Yêu cầu bị bỏ không xoá mà gạch ngang (`~~…~~`), kèm liên kết tới request đã bỏ nó.

Project đã có code nhưng bảng trên còn trống: chạy skill `engineering-spec-backfill` (plugin `engineering`) để dựng spec ban đầu từ docs, request đã merge và code.

## Bản đồ docs

| Câu hỏi | Nơi trả lời |
|---|---|
| Hệ thống làm gì | `docs/specs/` (file này và spec từng năng lực) |
| Cấu trúc ra sao | `project-knowledge/` (kiến trúc, tech stack), ARD hoặc tài liệu tổng quan source nếu có |
| Vì sao chọn như vậy | `docs/decisions/` (ADR) |
| Các phần giao tiếp thế nào | `docs/contracts/` |
| Chạy và vận hành | runbook của project (ghi đường dẫn khi có) |
| Đang làm dở | lệnh `aip status --requests` (request trong `docs/requests/` chưa `merged`/`abandoned`) |
