# Bảng tình huống lỗi theo bước — workflow-security-review

Bổ sung cho bảng "Xử lý lỗi & rollback" trong `WORKFLOW.md`; trường **Khi fail** của từng bước vẫn là nguồn chính.

| Tình huống | Hành động |
|---|---|
| Test regression không đỏ đúng lý do (Bước 7) | Sửa test, chạy lại, tối đa 2 lần rồi `ask_user` hỏi người dùng; không nới assertion |
| Fixer trả `blocked` vì hết phạm vi file (Bước 8) | Người dùng mở rộng danh sách file có xác nhận, gọi lại agent; không tự mở phạm vi |
| Fixer trả `blocked` vì đã thất bại lần sửa thứ 3 của một finding (Bước 8) | `ask_user` kèm lý do từng lần; không gọi lại tự động |
| Sửa xong vẫn đỏ (Bước 8) | Revert bản sửa hỏng (chỉ thay đổi của bản sửa đó, không `reset --hard`), thử thay đổi khác; tối đa 3 lần sửa thất bại cho một finding rồi `ask_user` |
| Finding đã sửa vẫn còn sau re-scan (Bước 9) | Quay lại Bước 8 sửa lại cho đúng |
| Reviewer báo finding `blocker` về bản sửa (Bước 9) | Quay lại Bước 8 sửa theo finding đó, re-scan và review lại; tối đa 2 lần quay lại |
| Người dùng không duyệt diff (sau Bước 10 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |
