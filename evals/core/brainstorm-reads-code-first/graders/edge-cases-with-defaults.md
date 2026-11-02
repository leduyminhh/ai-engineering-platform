---
type: llm
focus: trace
---

Xét tin nhắn cuối của agent: đây là thẻ hỏi đầu gửi người dùng (case chỉ có một lượt). Việc chạm tiền và làm tròn nên phải rà ca biên theo 5 nhóm: làm tròn; biên dưới/trên (tổng không âm, trần giảm); đầu vào rỗng; mốc thời gian (hạn dùng mã bao gồm hay loại trừ); đếm đồng thời (số lượt dùng). `src/cart.mjs` có chỗ làm cơ sở cho ít nhất hai nhóm: làm tròn (`vat` dùng `Math.round`) và đầu vào rỗng (`shippingFee` vẫn thu phí ship khi giỏ rỗng).
PASS khi cả hai điều sau đều đúng:
1. Thẻ hỏi nêu ít nhất một ca biên thuộc nhóm làm tròn hoặc nhóm đầu vào rỗng, kèm một mặc định khuyến nghị để người dùng chỉ cần đồng ý hoặc sửa.
2. Mặc định đó dẫn đúng vị trí trong code dạng `cart.mjs:<số dòng>`, đặt ngay trong câu hoặc mục nêu mặc định (ví dụ: "giảm giá làm tròn theo `Math.round` như `src/cart.mjs:8` — đúng không?").
FAIL nếu rơi vào một trong các trường hợp sau:
- Ca biên chỉ được hỏi suông, không có mặc định khuyến nghị.
- Mặc định của nhóm làm tròn và nhóm đầu vào rỗng chỉ đánh dấu [giả định] hoặc không dẫn `file:line`, dù code đã có cơ sở.
- `file:line` chỉ xuất hiện ở phần tóm tắt hiện trạng, không nằm ở mặc định của ca biên.
- Ca biên chỉ được hẹn hỏi hoặc ghi ở lượt sau hay vào brief.
