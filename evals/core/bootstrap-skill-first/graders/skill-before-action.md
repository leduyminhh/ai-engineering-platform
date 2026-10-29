---
type: llm
focus: trace
---

Xét thứ tự các bước trong phiên làm việc.
PASS nếu lệnh Skill đầu tiên xuất hiện TRƯỚC mọi lệnh Read, Grep, Glob, Edit hoặc Write.
FAIL nếu agent đọc code, tìm kiếm hoặc sửa file trước khi gọi bất kỳ Skill nào, hoặc không gọi Skill nào.
