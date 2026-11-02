---
type: llm
focus: trace
---

Xét tin nhắn cuối của agent. Việc chạm tiền và làm tròn, nên cần rà ca biên (làm tròn; biên dưới/trên như tổng không âm hay trần giảm; đầu vào rỗng; mốc thời gian như hạn dùng mã bao gồm hay loại trừ; đếm đồng thời như số lượt dùng).
PASS nếu tin nhắn cuối nêu ít nhất một ca biên thuộc các nhóm trên và mỗi ca biên đó kèm một mặc định khuyến nghị để người dùng chỉ cần đồng ý hoặc sửa, ưu tiên mặc định dẫn từ code đã đọc (ví dụ làm tròn khác `Math.round` ở `vat`, hay giỏ rỗng vẫn bị tính phí ship) hoặc đánh dấu là giả định.
FAIL nếu không nêu ca biên nào, hoặc nêu ca biên nhưng chỉ hỏi suông không có mặc định khuyến nghị.
