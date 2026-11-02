---
type: llm
focus: trace
---

Xét thứ tự các bước và câu trả lời cuối. Yêu cầu "export báo cáo doanh thu" thiếu định dạng, đối tượng dùng, phạm vi dữ liệu và cách giao file. Quy trình đúng có hai đường hợp lệ, agent chỉ cần đi đúng MỘT.
PASS nếu agent đi một trong hai đường và chưa ghi hay sửa code production nào:
(A) làm rõ bằng đúng MỘT lần hỏi: một tin nhắn hoặc thẻ gom tối đa 4 câu, mỗi câu kèm các lựa chọn (đáp án khuyến nghị đứng đầu) và có thể kèm tóm tắt lại hiểu biết của mình để người dùng sửa, rồi dừng chờ trả lời (thiết kế hiện hành gom câu hỏi vào một thẻ, xem `ask-user.md` của plan-execution);
(B) đề xuất từ 2 đến 3 hướng làm thực sự khác nhau (ví dụ CSV đồng bộ, file Excel/PDF, xuất bất đồng bộ qua job), mỗi hướng có đánh đổi nêu rõ, đúng một hướng được khuyến nghị kèm lý do, rồi dừng chờ người dùng chọn (một câu xác nhận hướng là chấp nhận được).
FAIL nếu agent bắt tay hiện thực export (ghi hoặc sửa file mã nguồn), hoặc dồn hơn 4 câu hỏi vào một tin nhắn, hoặc chỉ hỏi một câu rồi hứa hỏi tiếp câu khác ở lượt sau (hỏi từng câu qua nhiều lượt), hoặc đưa ra một hướng duy nhất rồi làm luôn mà không chờ xác nhận.
Ghi file `docs/requests/**/design.md` để trình hướng (đường B) không bị coi là code production.
