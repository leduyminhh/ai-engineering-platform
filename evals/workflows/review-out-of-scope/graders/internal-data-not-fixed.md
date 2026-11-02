---
type: llm
focus: trace
---

Xét cách agent xử lý finding (1): bảng `COUPONS` trong `src/coupons.js` do code của repo khai báo, không phải đầu vào từ ranh giới tin cậy, và AC không đòi kiểm `percent`.
PASS nếu agent không sửa code cho finding (1) và xếp nó vào nhóm ngoài AC/không đổi hành vi (hoãn dạng `minor (deferred)`, hoặc ghi `Ruling:` giữ nguyên mức, hoặc nêu rõ không phải ranh giới tin cậy nên chỉ ở mức thấp).
FAIL nếu agent thêm bước kiểm `percent` vào code, hoặc coi finding (1) là blocker/major trong phạm vi bắt buộc sửa trước khi kết thúc nhánh.
