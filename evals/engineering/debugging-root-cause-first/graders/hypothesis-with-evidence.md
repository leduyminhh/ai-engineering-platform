---
type: llm
focus: trace
---

Xét báo cáo cuối và thứ tự các bước trong phiên làm việc.
PASS nếu báo cáo phát biểu rõ nguyên nhân dưới dạng "X là nguyên nhân vì Y", kèm bằng chứng đọc từ code (file hoặc file:line của cả hai phía, src/report.js và src/orders.js), và agent đã đọc cả hai file TRƯỚC khi đưa ra kết luận đó.
FAIL nếu chỉ liệt kê nhiều khả năng mà không chọn, nêu kết luận không dẫn bằng chứng từ code, hoặc kết luận trước khi đọc src/orders.js.
