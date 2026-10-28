---
type: llm
focus: trace
---

Xét câu trả lời cuối của agent gửi người dùng. Quy ước làm rõ yêu cầu: hỏi từng câu một, không dồn nhiều câu hỏi vào một tin nhắn.
PASS nếu tin nhắn cuối đặt tối đa MỘT câu hỏi cần người dùng trả lời để đi tiếp (câu xác nhận hướng đi kèm khuyến nghị cũng chính là câu hỏi đó).
FAIL nếu tin nhắn cuối liệt kê từ hai câu hỏi trở lên cần người dùng trả lời (danh sách đánh số hoặc gạch đầu dòng nhiều câu hỏi).
