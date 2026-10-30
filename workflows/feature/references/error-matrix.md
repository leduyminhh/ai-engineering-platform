# Bảng tình huống lỗi theo bước — workflow-feature

Bổ sung cho bảng "Xử lý lỗi & rollback" trong `WORKFLOW.md`; trường **Khi fail** của từng bước vẫn là nguồn chính.

| Tình huống | Hành động |
|---|---|
| Thông tin còn mơ hồ hoặc người dùng chưa chọn hướng (sau Bước 2 ⏸) | Dừng, hỏi lại người dùng từng câu, không tự suy diễn; người dùng đã bỏ qua phần hỏi thì ghi "quyết định của agent" |
| Acceptance criteria không đo được hoặc agent `blocked` (sau Bước 3 ⏸) | Session chính thử trả lời từ đầu vào đã chốt; không được thì hỏi người dùng, gom một tin nhắn |
| Chưa rõ có API hay contract xung đột (sau Bước 3 ⏸) | Dừng, hỏi lại người dùng cách xử lý breaking change |
| `check-request.mjs` còn cảnh báo ngoài W9 (Bước 4 ⏸) | Sửa `plan.md`; lỗi ở tài liệu → quay lại Bước 3; không xoá `**Files:**`/test để tắt cảnh báo |
| e2e thiếu BE/DB test (Bước 5, task `E2E`) | Ghi `not_run` + lý do vào `remaining_risks`; không tự dựng hạ tầng |
| Task TDD `có` thiếu `tdd.red` hoặc `tdd.green` (Bước 5) | Coi là đầu ra hỏng: giao lại cho chính agent, tối đa 2 lần rồi hỏi người dùng |
| Hết 3 vòng sửa mà task còn finding mở (Bước 5) | Session chính phán từng finding, ghi `Ruling:` và chạy tiếp; thuộc loại dừng của `plan-execution` (không đảo ngược, bảo mật, tác động ngoài repo, schema DB, plan hỏng) thì hỏi người dùng |
| Mất BASE hoặc ledger sau khi compact (Bước 5) | Lấy `<b>` của dòng `Task <n-1>: complete` gần nhất trong ledger, đối chiếu `git log`; làm tiếp từ task chưa `complete` |
| Còn `blocker` sau một lần sửa và một re-review (Bước 6) | Quay lại Bước 5 thêm task sửa, tối đa 2 lần rồi hỏi người dùng; không mở làn sửa thứ hai |
| Full suite đỏ (Bước 7 ⏸) | Dừng, không đưa 3 lựa chọn; sửa trong phạm vi plan rồi chạy lại, tối đa 2 lần, vẫn đỏ → báo `blocked` |
| Người dùng không duyệt diff cả nhánh (Bước 7 ⏸) | Không merge, không push; giữ nguyên nhánh, quay lại Bước 5 với task sửa theo yêu cầu (tối đa 2 lần) |
