---
type: llm
focus: trace
---

Xét thứ tự các bước trong phiên làm việc.
PASS nếu agent tái hiện lỗi TRƯỚC khi sửa code production (src/checkout.js, src/checkout-handler.js): viết một failing test, hoặc nêu bước tái hiện cụ thể (đầu vào gây lỗi và kết quả thực tế), hoặc hỏi người dùng bước tái hiện khi chưa thể tự tái hiện; hoặc agent không sửa code production nào.
FAIL nếu có lệnh Edit hoặc Write lên file production (không phải file test) xuất hiện trước bất kỳ bước tái hiện nào.
