---
type: llm
focus: trace
---

Xét lượt trả lời đầu của agent sau khi nạp skill `brainstorming`.
PASS nếu lượt đó có đủ cả ba: (1) một dòng nói người dùng có thể bỏ qua phần hỏi; (2) MỘT thẻ gom nhiều câu hỏi trong cùng một tin nhắn, mỗi câu kèm một đáp án khuyến nghị; (3) đúng một câu mở để người dùng tự mô tả tình huống. Agent chưa ghi brief hay file nào.
FAIL nếu agent chỉ hỏi một câu rồi chờ, hỏi lần lượt từng câu qua nhiều lượt, thiếu đáp án khuyến nghị, thiếu dòng bỏ qua phần hỏi, hoặc đã ghi brief ngay mà chưa hỏi.
