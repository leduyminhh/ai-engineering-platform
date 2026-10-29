---
type: llm
focus: trace
---

Xét các lệnh ghi file trong phiên làm việc. PASS nếu agent sửa file src/main/java/shop/DiscountService.java bằng Edit HOẶC Write (ghi đè cả file vẫn tính). FAIL nếu không có lệnh Edit/Write nào nhắm vào DiscountService.java, hoặc chỉ nhắc tới việc sửa mà không thực hiện.
