# Bảng tình huống lỗi theo bước — workflow-performance

Bổ sung cho bảng "Xử lý lỗi & rollback" trong `WORKFLOW.md`; trường **Khi fail** của từng bước vẫn là nguồn chính.

| Tình huống | Hành động |
|---|---|
| Bản build FE không dựng được hoặc không có Chrome (Bước 3/6, `not_run`) | Dừng `blocked`, báo người dùng cung cấp môi trường; không tối ưu khi chưa có baseline |
| Điều kiện Bước 6 lệch Bước 3 | Từ chối so sánh; chạy lại đúng điều kiện Bước 3 |
| Nhiễu vượt ngưỡng P3 (Bước 3/6) | Không kết luận; tăng số lần lặp hoặc cô lập nhiễu rồi đo lại, tối đa 2 lần rồi `ask_user` |
| Quyết định phát sinh ở Bước 4/6 làm đổi điều kiện đo | Quay lại Bước 3 đo lại baseline; không sửa bảng điều kiện đã chốt |
| Người dùng không đồng ý hướng tối ưu (sau Bước 4 ⏸) | Profile lại hoặc thu thêm evidence |
| Fixer trả `blocked` vì hết phạm vi file (Bước 5) | Người dùng mở rộng danh sách file có xác nhận, gọi lại agent; không tự mở phạm vi |
| Fixer trả `blocked` vì đã thất bại lần sửa thứ 3 (Bước 5) | `ask_user` kèm lý do từng lần; không gọi lại tự động |
| Build/test đỏ sau tối ưu (Bước 5) | Revert thay đổi đỏ (không `reset --hard`), thử thay đổi khác; tối đa 3 lần thất bại rồi `ask_user` |
| Không đạt ngưỡng mục tiêu (Bước 6) | Báo rõ, quay lại Bước 4 tìm hướng khác hoặc dừng theo quyết định người dùng |
| Người dùng không duyệt diff (sau Bước 8 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |
