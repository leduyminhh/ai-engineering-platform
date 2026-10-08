# Bảng tình huống lỗi theo bước — workflow-performance

Bổ sung cho bảng "Xử lý lỗi & rollback" trong `WORKFLOW.md`; trường **Khi fail** của từng bước vẫn là nguồn chính.

| Tình huống | Hành động |
|---|---|
| Bản build FE không dựng được hoặc không có Chrome (Bước 2/5, `not_run`) | Dừng `blocked`, báo người dùng cung cấp môi trường; không tối ưu khi chưa có baseline |
| Điều kiện Bước 5 lệch Bước 2 | Từ chối so sánh; chạy lại đúng điều kiện Bước 2 |
| Nhiễu vượt ngưỡng P3 (Bước 2/5) | Không kết luận; tăng số lần lặp hoặc cô lập nhiễu rồi đo lại |
| Quyết định phát sinh ở Bước 3/5 làm đổi điều kiện đo | Quay lại Bước 2 đo lại baseline; không sửa bảng điều kiện đã chốt |
| Người dùng không đồng ý hướng tối ưu (sau Bước 3 ⏸) | Profile lại hoặc thu thêm evidence |
| Fixer trả `blocked` (Bước 4) | Người dùng mở rộng danh sách file có xác nhận, gọi lại agent; không tự mở phạm vi |
| Không đạt ngưỡng mục tiêu (Bước 5) | Báo rõ, quay lại Bước 3 tìm hướng khác hoặc dừng theo quyết định người dùng |
| Người dùng không duyệt diff (sau Bước 7 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |
