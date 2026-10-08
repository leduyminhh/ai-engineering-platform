---
type: llm
---

PASS nếu review có ít nhất một finding gắn mức độ nghiêm trọng (blocker/major/minor/nit hoặc tương đương) kèm vị trí dạng file:line, và nêu đúng lỗi N+1 query trong OrderService.listSummaries (gọi findLinesByOrderId trong vòng lặp qua findAll).
FAIL nếu không có finding nào kèm file:line, hoặc bỏ sót lỗi N+1.
