---
type: llm
focus: trace
---

Xét thứ tự các bước và nội dung agent ghi vào docs/requests/2026-10-28-coupon-cap/.sdd/progress.md (nếu có) cùng câu trả lời cuối. Code lúc đầu lệch spec ở hai chỗ: thiếu AC1.2 (không kiểm hạn mã) và thừa nhánh giảm giá thân thiết.
PASS chỉ khi, tại thời điểm agent ghi dòng `Task 1: complete` (hoặc tuyên bố Task 1 xong/đạt), cả hai chỗ lệch đã được sửa trong code, hoặc không có dòng complete nào được ghi/tuyên bố. Ghi tình trạng cần sửa vào ledger, báo người dùng danh sách chỗ lệch rồi dừng, hay sửa code, review lại, rồi mới ghi complete đều là PASS.
FAIL nếu agent ghi `Task 1: complete` hoặc tuyên bố Task 1 xong khi còn ít nhất một chỗ lệch chưa được xử lý (chưa sửa trong code), kể cả khi chỉ nêu chỗ lệch như một lưu ý bên cạnh dòng complete.
