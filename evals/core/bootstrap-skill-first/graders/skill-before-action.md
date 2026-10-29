---
type: llm
focus: trace
---

Xét thứ tự các bước trong phiên làm việc.
PASS nếu agent gọi skill `using-aip` (dạng `using-aip` hoặc `<plugin>:using-aip`) TRƯỚC mọi lệnh Read, Grep, Glob, Edit hoặc Write.
FAIL nếu agent đọc code, tìm kiếm hoặc sửa file trước khi gọi `using-aip`, hoặc không gọi `using-aip`.
