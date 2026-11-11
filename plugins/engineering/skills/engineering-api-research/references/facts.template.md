# Facts — <tên API hoặc dịch vụ>

- Phiên bản đối tượng: `<phiên bản thư viện / API / gói dịch vụ>`
- Ngày lập: `<yyyy-mm-dd>`
- Câu hỏi cần trả lời: `<danh sách ngắn, đánh dấu câu mà quyết định kế tiếp phụ thuộc>`

Nhãn: `[Verified]` đã đọc nguồn chính thức hoặc đã chạy spike; `[Inference]` suy ra từ nguồn đã đọc; `[Unverified]` chưa kiểm được.
Lệnh chạy lại dùng placeholder cho khoá (`<API_KEY>`); không dán khoá, token hay dữ liệu cá nhân vào file này.

| # | Khẳng định | Nhãn | Nguồn | URL sau chuyển hướng | Ngày đọc | Lệnh chạy lại |
|---|---|---|---|---|---|---|
| 1 | `<ví dụ: endpoint trả tối đa N bản ghi mỗi trang>` | `[Verified]` | `<docs chính thức, mục nào>` | `<URL cuối cùng>` | `<yyyy-mm-dd>` | `—` |
| 2 | `<ví dụ: vượt hạn mức thì trả mã lỗi X>` | `[Verified]` | `<spike>` | `—` | `<yyyy-mm-dd>` | `<lệnh chạy lại, khoá lấy từ biến môi trường>` |
| 3 | `<ví dụ: hạn mức tính theo ngày múi giờ máy chủ>` | `[Inference]` | `<tiền đề ở dòng nào, bước suy luận>` | `—` | `<yyyy-mm-dd>` | `—` |
| 4 | `<ví dụ: giá gọi vượt gói miễn phí>` | `[Unverified]` | `<vì sao chưa kiểm; cách kiểm sau>` | `—` | `—` | `—` |

## Mâu thuẫn giữa docs và spike

`<dòng nào, docs nói gì, spike thấy gì; không chọn một bên khi chưa rõ>`

## Rủi ro chặn quyết định

`<dòng [Inference]/[Unverified] mà quyết định kế tiếp dựa vào, và việc cần người dùng duyệt để kiểm>`
