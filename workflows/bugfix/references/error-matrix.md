# Bảng tình huống lỗi theo bước — workflow-bugfix

Bổ sung cho bảng "Xử lý lỗi & rollback" trong `WORKFLOW.md`; trường **Khi fail** của từng bước vẫn là nguồn chính.

| Tình huống | Hành động |
|---|---|
| Fixer trả `blocked` (Bước 6) | Người dùng mở rộng danh sách file có xác nhận, gọi lại agent; không tự mở phạm vi |
| Người dùng không đồng ý root cause (sau Bước 5 ⏸) | Quay lại Bước 4 thu thêm evidence hoặc xem lại giả thuyết |
| Người dùng không duyệt diff (sau Bước 9 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |
