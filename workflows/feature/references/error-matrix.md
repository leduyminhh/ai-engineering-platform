# Bảng tình huống lỗi theo bước — workflow-feature

Bổ sung cho bảng "Xử lý lỗi & rollback" trong `WORKFLOW.md`; trường **Khi fail** của từng bước vẫn là nguồn chính.

| Tình huống | Hành động |
|---|---|
| Thông tin còn mơ hồ hoặc người dùng chưa chọn hướng (sau Bước 2 ⏸) | Dừng, hỏi lại người dùng từng câu, không tự suy diễn; người dùng đã bỏ qua phần hỏi thì ghi "quyết định của agent" |
| Acceptance criteria không đo được hoặc agent `blocked` (sau Bước 3 ⏸) | Session chính thử trả lời từ đầu vào đã chốt; không được thì hỏi người dùng, gom một tin nhắn |
| Chưa rõ có API hay contract xung đột (sau Bước 3 ⏸) | Dừng, hỏi lại người dùng cách xử lý breaking change |
| `check-request.mjs` còn cảnh báo ngoài W9 (Bước 4 ⏸) | Sửa `plan.md`; lỗi ở tài liệu → quay lại Bước 3; không xoá `**Files:**`/test để tắt cảnh báo |
| e2e thiếu BE/DB test (Bước 6) | Ghi `not_run` + lý do vào `remaining_risks`; không tự dựng hạ tầng |
| Người dùng không duyệt diff (sau Bước 9 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |
