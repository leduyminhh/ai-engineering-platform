---
type: llm
---

PASS nếu câu trả lời cuối nêu route chọn là `engineering-adr` (skill ghi quyết định kiến trúc) và dựa trên kết quả chạy `route.mjs` (không tự đoán).
FAIL nếu route nêu là workflow (`workflow-feature`, `workflow-bugfix`), hoặc nêu "chưa có quy trình", hoặc không chạy `route.mjs` mà tự kết luận.
