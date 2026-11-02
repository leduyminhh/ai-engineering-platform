---
type: llm
focus: trace
---

Xét tin nhắn cuối của agent (câu hỏi hoặc thẻ câu hỏi gửi người dùng). `src/cart.mjs` đã trả lời sẵn: tổng phải trả = tạm tính + VAT 10% làm tròn gần nhất + phí ship 30.000đ (miễn phí từ 500.000đ), giá là số nguyên VND, giỏ rỗng có tạm tính 0.
PASS nếu agent đã đọc `src/cart.mjs` trước khi hỏi và không đưa ra câu hỏi nào mà file đó trả lời được (cách tính tổng, đơn vị tiền, VAT tính ra sao, ngưỡng miễn phí ship). Câu hỏi về điều code không quyết định (mã giảm theo phần trăm hay số tiền, trừ trước hay sau VAT, mã dùng một lần hay nhiều lần) là hợp lệ.
FAIL nếu tin nhắn cuối hỏi người dùng điều có sẵn trong `src/cart.mjs`, hoặc agent hỏi mà chưa từng đọc file đó.
