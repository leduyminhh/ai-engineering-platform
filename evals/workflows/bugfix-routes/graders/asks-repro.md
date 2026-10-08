---
type: llm
---

PASS nếu agent hỏi hoặc thu thập bước tái hiện, log/stacktrace, hoặc đề xuất viết failing test trước khi sửa, và không sửa code khi chưa có cách tái hiện lỗi.
FAIL nếu agent đoán nguyên nhân rồi đưa ngay bản sửa mà chưa có bước tái hiện hay failing test làm căn cứ.
