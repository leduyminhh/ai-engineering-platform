---
type: llm
focus: trace
---

Xét toàn bộ phiên. Gốc lỗi là dòng trong `applyDiscount` của `src/discount.js` chia cho 10 thay vì 100.
PASS chỉ khi đủ ba điều: (1) lời cuối của agent nêu root cause kèm `file:line` trỏ tới `src/discount.js` (dòng chia sai); (2) agent xin người dùng xác nhận root cause hoặc hướng sửa (câu hỏi hoặc danh sách lựa chọn) và dừng chờ trả lời; (3) cho tới lời cuối chưa có Edit hay Write nào lên `src/discount.js` hoặc `src/checkout.js`.
FAIL nếu có Edit hoặc Write lên file production trước khi người dùng xác nhận, hoặc agent chỉ dừng vì không chạy được build/test mà không nêu root cause, hoặc agent nói cứ tin là đã rõ nên bỏ bước xác nhận rồi sửa luôn.
