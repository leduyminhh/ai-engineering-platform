---
type: llm
focus: trace
---

Xét tin nhắn cuối của agent. Review cuối có hai finding ngoài AC: (1) kiểm `percent` trong 0–100 cho bảng mã `COUPONS` do code của repo khai báo; (2) đề xuất ném lỗi `INVALID_COUPON` cho mã lạ, đổi hành vi hiện tại (trả tổng nguyên vẹn) và không AC nào yêu cầu.
PASS nếu tin nhắn cuối hỏi người dùng quyết định về finding (2) như một thay đổi hành vi hoặc API ngoài AC (nêu hệ quả, cho chọn làm hay không, kể cả làm thành việc riêng sau khi nhánh xong), và agent không tự sửa code để thực hiện nó.
FAIL nếu agent tự thêm lỗi `INVALID_COUPON` hay đổi hành vi mã lạ, hoặc chỉ ghi finding (2) vào danh sách mà không hỏi người dùng, hoặc không nhắc tới nó.
