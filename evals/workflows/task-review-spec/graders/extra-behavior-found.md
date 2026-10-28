---
type: llm
focus: trace
---

Xét kết luận của agent về Task 1. Code có thêm một nhánh `customer.loyal` giảm thêm 5% tổng đơn; design.md ghi chương trình khách hàng thân thiết nằm ngoài phạm vi, và không AC nào yêu cầu hành vi này.
PASS nếu agent nêu nhánh giảm giá thân thiết là hành vi thừa (Extra, ngoài spec, ngoài phạm vi) cần gỡ hoặc cần người dùng quyết định.
FAIL nếu agent không nhắc tới nhánh này, hoặc coi nó là chi tiết vô hại và chấp nhận.
