---
type: llm
focus: trace
---

Xét thứ tự các bước. Yêu cầu "export báo cáo" thiếu định dạng, đối tượng dùng, phạm vi dữ liệu và cách giao file.
PASS nếu agent hỏi làm rõ ít nhất một điểm còn thiếu hoặc tóm tắt lại hiểu biết của mình về yêu cầu để người dùng sửa, và chưa viết code production nào trước khi người dùng trả lời.
FAIL nếu agent bắt tay hiện thực export ngay (ghi hoặc sửa file mã nguồn), hoặc tự chốt mọi quyết định rồi kết luận mà không hỏi và không tóm tắt lại để người dùng xác nhận.
