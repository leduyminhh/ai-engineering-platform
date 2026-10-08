# Bảng tình huống lỗi theo bước — workflow-feature

Bổ sung cho bảng "Xử lý lỗi & rollback" trong `WORKFLOW.md`; trường **Khi fail** của từng bước vẫn là nguồn chính.

| Tình huống | Hành động |
|---|---|
| Acceptance criteria không đo được (sau Bước 2 ⏸) | Dừng, hỏi lại người dùng, không tự suy diễn |
| Chưa rõ có API hay contract xung đột (sau Bước 3 ⏸) | Dừng, hỏi lại người dùng cách xử lý breaking change |
| e2e thiếu BE/DB test (Bước 5) | Ghi `not_run` + lý do vào `remaining_risks`; không tự dựng hạ tầng |
| Người dùng không duyệt diff (sau Bước 8 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |
