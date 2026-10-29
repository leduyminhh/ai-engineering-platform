# Bảng tình huống lỗi theo bước — workflow-bugfix

Bổ sung cho bảng "Xử lý lỗi & rollback" trong `WORKFLOW.md`; trường **Khi fail** của từng bước vẫn là nguồn chính.

| Tình huống | Hành động |
|---|---|
| Fixer trả `blocked` (Bước 6) | Người dùng mở rộng danh sách file có xác nhận, gọi lại agent; không tự mở phạm vi |
| Người dùng không đồng ý root cause (sau Bước 5 ⏸) | Quay lại Bước 4 thu thêm evidence hoặc xem lại giả thuyết |
| Người dùng không duyệt diff (sau Bước 9 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |
| Lần sửa thứ 3 thất bại (Bước 6, tổng qua mọi cạnh 6→5, 7→6, 8→6) | Dừng `ask_user`, không thử lần 4; hỏi câu hỏi kiến trúc: mỗi lần sửa lộ coupling/shared state mới không, cần refactor lớn không |
| Log tạm chưa gỡ (Bước 4) | Gỡ hết, kiểm lại gate diff sạch so với mốc đầu bước; không sang Bước 5 |
| Test đỏ lệch root cause (Bước 5) | Quay lại Bước 3 sửa test cho đỏ đúng lý do root cause đã xác nhận |
| Bug race/timing (Bước 3, 6) | Test chờ theo điều kiện, không sleep cứng, không nới timeout/retry; không tái hiện ổn định → hỏi người dùng |
