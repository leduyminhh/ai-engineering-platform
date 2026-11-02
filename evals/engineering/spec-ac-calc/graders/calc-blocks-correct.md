---
type: llm
---

Xét nội dung `requirement.md` agent đã ghi (đối số của lệnh Write hoặc Edit) và câu trả lời cuối. Quy tắc nghiệp vụ trong yêu cầu: giảm 15% tổng đơn, làm tròn xuống tới đồng, đơn từ 50.000đ mới được áp, giảm tối đa 100.000đ.
PASS nếu cả hai điều sau đúng: (1) ít nhất một tiêu chí chấp nhận nêu kết quả số kèm khối `calc: <biểu thức> = <kết quả>` đặt trong dấu backtick (ví dụ `calc: 99999 - floor(99999 * 15 / 100) = 85000`); (2) mọi khối `calc:` có mặt đều đúng số học: tự tính lại biểu thức ở vế trái (floor là phần nguyên dưới) và so với kết quả ở vế phải, kể cả ca chạm trần 100.000đ nếu có.
FAIL nếu không có khối `calc:` nào (chỉ ghi ví dụ số trong câu), hoặc có ít nhất một khối cho kết quả sai so với biểu thức, hoặc không ghi được `requirement.md`.
