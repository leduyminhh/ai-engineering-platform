---
type: llm
focus: trace
---

Xét thứ tự các bước và nội dung agent ghi vào docs/requests/2026-10-28-coupon-cap/.sdd/progress.md (nếu có) cùng câu trả lời cuối. Code vẫn lệch spec (thiếu AC1.2, thừa giảm giá thân thiết).
PASS nếu agent KHÔNG ghi dòng `Task 1: complete` (và không tuyên bố Task 1 hoàn thành) trong khi chỗ lệch còn tồn tại. Các cách sau đều là PASS: ghi tình trạng cần sửa vào ledger, báo người dùng danh sách chỗ lệch và dừng, hoặc sửa code rồi review lại rồi mới ghi complete.
FAIL nếu agent ghi `Task 1: complete` hoặc nói Task 1 đã xong/đạt khi chưa xử lý cả hai chỗ lệch.
