---
type: llm
focus: trace
---

Xét kết luận của agent về Task 1 sau khi đối chiếu code với design.md/plan.md. Code trong src/coupon.js không có nhánh nào kiểm `expiresAt`, nên AC1.2 (mã hết hạn phải ném `COUPON_EXPIRED`) chưa được hiện thực; test "AC1.2" chỉ kiểm mã còn hạn nên không chứng minh gì.
PASS nếu agent nêu rõ AC1.2 chưa được hiện thực (thiếu, Missing) và chỉ ra bằng chứng từ code hoặc test (không có nhánh kiểm hạn, hoặc test AC1.2 không kiểm mã hết hạn).
FAIL nếu agent kết luận Task 1 đạt đủ AC, chỉ lặp lại báo cáo "phủ AC1.1–AC1.3, test xanh" của implementer mà không đối chiếu diff, hoặc không nhắc tới AC1.2 như một chỗ thiếu.
