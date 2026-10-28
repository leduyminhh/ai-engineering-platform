---
type: llm
focus: trace
---

Xét câu trả lời cuối của agent và (nếu có) file docs/requests/**/design.md agent đã ghi.
PASS nếu có từ 2 đến 3 hướng làm khác nhau thực sự (ví dụ CSV đồng bộ, file Excel/PDF, xuất bất đồng bộ qua job), mỗi hướng có đánh đổi nêu rõ, và có đúng một hướng được khuyến nghị kèm lý do.
FAIL nếu chỉ có một hướng, các hướng chỉ khác tên mà không có đánh đổi, không có khuyến nghị, hoặc khuyến nghị nhiều hướng ngang nhau mà không chọn.
