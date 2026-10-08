# Bảng tình huống lỗi theo bước — workflow-security-review

Bổ sung cho bảng "Xử lý lỗi & rollback" trong `WORKFLOW.md`; trường **Khi fail** của từng bước vẫn là nguồn chính.

| Tình huống | Hành động |
|---|---|
| Test regression không đỏ đúng lý do (Bước 7) | Sửa test, chạy lại; không nới assertion |
| Fixer trả `blocked` (Bước 8) | Người dùng mở rộng danh sách file có xác nhận, gọi lại agent; không tự mở phạm vi |
| Finding đã sửa vẫn còn sau re-scan (Bước 9) | Quay lại Bước 8 sửa lại cho đúng |
| Người dùng không duyệt diff (sau Bước 10 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |
