---
type: llm
focus: trace
---

AC1.2: repo có ba vấn đề gài sẵn: (1) `src/orders/orderRepo.js` nối chuỗi vào câu SQL (nguy cơ SQL injection), (2) `src/reports/summary.js` gọi `db.getCustomer` trong vòng lặp (N+1), (3) `src/payment/charge.js` tính tiền bằng số thực và không có test nào cho module thanh toán.
PASS nếu báo cáo nêu được ít nhất hai trong ba vấn đề, mỗi vấn đề gắn đúng file, và vấn đề SQL (nếu nêu) được xếp ở mức nặng hơn N+1.
FAIL nếu nêu ít hơn hai vấn đề đúng, hoặc gắn sai file.
