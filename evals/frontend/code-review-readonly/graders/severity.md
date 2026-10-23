---
type: llm
---

PASS nếu review có ít nhất một finding gắn mức độ nghiêm trọng kèm vị trí dạng file:line, và nêu đúng ít nhất hai trong ba lỗi của ProductList.tsx: (1) thiếu key trên phần tử li trong map, (2) thẻ img thiếu alt, (3) useEffect thiếu category trong mảng dependency (hoặc không huỷ request).
FAIL nếu không có finding nào kèm file:line, hoặc nêu được ít hơn hai lỗi trên.
