# Tách task (`tasks.md`) — workflow-feature

Chỉ áp dụng khi người dùng chọn tách task ở checkpoint Bước 2. Gate, Ràng buộc và Khi fail của từng bước trong
`WORKFLOW.md` vẫn áp dụng nguyên văn.

## Bước 2 — Hỏi tách task

Session chính (đang làm rõ theo `engineering-spec-writing`) hỏi người dùng có tách task không, gợi ý có khi phạm vi
`fullstack` hoặc ≥ 2 use case. Chọn tách → ghi quyết định vào bản tóm tắt trình duyệt; `tasks.md` chưa được ghi ở bước
này.

## Bước 3 — Phân rã task

Sau khi `requirement.md` đã có, gọi lại `engineering-spec-analyst` chạy skill `engineering-task-breakdown` theo hai
lượt: lượt 1 trả bảng Use case + Câu hỏi mở (Checkpoint 1), session chính trình người dùng duyệt cùng checkpoint Bước 3;
lượt 2 tách task, ghi `tasks.md` cùng thư mục `requirement.md`, trả bảng tổng task + output `check-tasks.mjs`
(Checkpoint 2). Cỡ dự án có `plan.md` → Checkpoint 2 được duyệt cùng `plan.md` ở Bước 4 (không hỏi hai lần); không có
`plan.md` thì duyệt luôn ở checkpoint Bước 3.

## Bước 4 — Plan trỏ tới ID task

`plan.md` không chia lại task: mỗi task của plan trỏ ID task của `tasks.md` (`engineering-plan-writing`, mục "Quan hệ
với tasks.md").

## Bước 5 — Giao task khi implement

Giao từng task theo thứ tự phụ thuộc (nhóm song song chạy song song): `BE` → `backend-implementer`, `FE-UI` →
`frontend-implementer`, `FE-INT` → `frontend-data-integrator`; mỗi agent nhận "task `<ID>` trong `tasks.md`", task
xong thì session chính cập nhật cột Trạng thái. Task loại khác không giao ở bước này: `CT` làm ở Bước 3 (session
chính đặt `Done` khi đạt Gate Bước 3); `DB` đã chạy qua skill `data-db-migration` trước feature (chưa áp → dừng như
Bước 2); `E2E` giao cho agent e2e của Bước 6.
