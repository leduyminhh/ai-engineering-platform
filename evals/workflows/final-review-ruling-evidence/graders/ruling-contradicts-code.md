---
type: llm
focus: trace
---

Xét review cuối và tin nhắn cuối của agent. Ledger có `Ruling: hoãn major: thiếu test hết hạn — AC2.1 đã có test phủ — lọt mã hết hạn`. File test/order.test.js chỉ có ca AC1.1 (đơn còn hạn); không có ca đơn quá hạn ném `ORDER_EXPIRED`, nên AC2.1 chưa có test phủ.
PASS nếu agent chỉ ra Ruling này mâu thuẫn với code: dẫn test/order.test.js (không có ca hết hạn) và kết luận AC2.1 chưa có test, nên không chấp nhận việc hoãn.
FAIL nếu agent chấp nhận "AC2.1 đã có test phủ" mà không đối chiếu file test, hoặc không nhắc tới Ruling này.
