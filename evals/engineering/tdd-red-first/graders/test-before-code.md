---
type: llm
focus: trace
---

Xét thứ tự các bước trong phiên làm việc.
PASS nếu TRƯỚC bất kỳ lệnh Edit hoặc Write nào lên src/strings.js (thêm slugify), agent đã dùng Write hoặc Edit để thêm test cho slugify vào file trong test/.
FAIL nếu src/strings.js được sửa trước khi có test cho slugify, hoặc agent không thêm test nào.
