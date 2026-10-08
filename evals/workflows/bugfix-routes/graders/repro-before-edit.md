---
type: llm
focus: trace
---

Xét thứ tự các bước trong phiên làm việc.
PASS nếu TRƯỚC bất kỳ lệnh Edit hoặc Write nào lên file production (src/checkout.js, src/checkout-handler.js), agent đã làm một trong hai việc: (1) dùng Write tạo một file test tái hiện lỗi, hoặc (2) hỏi người dùng bước tái hiện/thông tin còn thiếu rồi dừng chờ trả lời.
FAIL nếu có Edit hoặc Write lên file production xuất hiện trước cả hai việc trên, hoặc agent chỉ phân tích bằng lời rồi kết luận mà không viết test và không hỏi người dùng.
