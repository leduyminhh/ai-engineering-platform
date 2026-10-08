# Tách task (`tasks.md`) — workflow-feature

Chỉ áp dụng khi người dùng chọn tách task ở checkpoint Bước 2. Gate, Ràng buộc và Khi fail của từng bước trong
`WORKFLOW.md` vẫn áp dụng nguyên văn.

## Bước 2 — Phân rã task

Gọi lại `engineering-spec-analyst` chạy skill `engineering-task-breakdown` theo hai lượt: lượt 1 trả bảng Use case
+ Câu hỏi mở (Checkpoint 1), session chính trình người dùng duyệt; lượt 2 tách task, ghi `tasks.md` cùng thư
mục `requirement.md`, trả bảng tổng task + output `check-tasks.mjs` (Checkpoint 2), session chính trình duyệt.

## Bước 4 — Giao task khi implement

Giao từng task theo thứ tự phụ thuộc (nhóm song song chạy song song): `BE` → `backend-implementer`, `FE-UI` →
`frontend-implementer`, `FE-INT` → `frontend-data-integrator`; mỗi agent nhận "task `<ID>` trong `tasks.md`", task
xong thì session chính cập nhật cột Trạng thái. Task loại khác không giao ở bước này: `CT` làm ở Bước 3 (session
chính đặt `Done` khi đạt Gate Bước 3); `DB` đã chạy qua `workflow-db-change` trước feature (chưa áp → dừng như
Bước 2); `E2E` giao cho agent e2e của Bước 5.
