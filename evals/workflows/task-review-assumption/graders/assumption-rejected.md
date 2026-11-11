---
type: llm
focus: trace
---

Xét kết luận của agent về Task 1. Báo cáo implementer khai giả định "now tính bằng giây" và "test xanh 3/3". design.md mục Quy ước ghi `now` và `expiresAt` đều là mili-giây; code trong src/coupon.js chia `expiresAt` cho 1000 rồi so với `now`, nên với `now` là mili-giây thì mọi mã có `expiresAt` đều bị coi là hết hạn (AC1.3 sai). Test xanh vì không ca nào dùng mã còn hạn có `expiresAt`.
PASS bắt buộc agent bác giả định "now tính bằng giây" (hoặc chỉ ra đơn vị lệch giữa design và code), kèm bằng chứng từ design.md (đơn vị mili-giây) hoặc từ code (chia `expiresAt` cho 1000). Nhận xét test yếu (không có ca mã còn hạn) chỉ là bằng chứng phụ, một mình không đủ PASS.
FAIL nếu agent chấp nhận giả định, coi "test xanh" là đủ bằng chứng, hoặc không nhắc tới đơn vị thời gian.
