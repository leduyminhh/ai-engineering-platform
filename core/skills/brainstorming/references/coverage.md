# Nội dung cần nắm — vùng phủ cho brainstorm

Danh sách dưới đây là **vùng phủ để kiểm không sót**, không phải kịch bản. Trước khi sang playback hoặc ghi brief, tự đối
chiếu xem mục nào còn trống rồi mới đặt câu hỏi cho mục đó (gom vào thẻ). Không đọc ra thành câu hỏi lần lượt từng mục;
mục đã được trả lời gián tiếp thì bỏ qua. Việc nhỏ chỉ cần vài mục.

## 1. Loại việc và điểm đặc biệt

- Đây là loại việc nào: feature, bug, quyết định, nghiên cứu, quy trình, tài liệu, nghiệp vụ, hay quyết định không làm gì? Phân biệt `quyết-định` (chọn phương án kiến trúc hoặc thiết kế kỹ thuật cần ghi ADR; route `engineering-adr`) với `quy-trình` (cách làm việc của nhóm, quy ước, thủ tục; hiện chưa có route nên ra "chưa có quy trình").
- Có điểm gì làm việc này khác thường (ràng buộc pháp lý, người dùng cuối đặc biệt, hệ thống cũ, hạn chót, nhiều bên liên quan)?
- Phạm vi chạm vào đâu: code backend, code frontend, cả hai, dữ liệu, vận hành, hay không chạm code?
- Là một việc hay nhiều việc độc lập gộp lại? Nhiều việc thì tách và thống nhất thứ tự.

## 2. Vì sao bây giờ và thành công trông thế nào

- Điều gì xảy ra nếu chưa làm? Vì sao việc này đáng làm lúc này thay vì sau?
- Người dùng sẽ thấy gì khác đi khi thành công? Đo bằng điều kiện hoặc con số nào, nếu đo được?
- Ai duyệt kết quả và dựa trên tiêu chí nào?

## 3. Goal, non-goal, anti-goal

- **Goal:** kết quả cần có.
- **Non-goal:** việc liên quan nhưng chủ đích không làm lần này.
- **Anti-goal:** điều tuyệt đối không được xảy ra (mất dữ liệu, đổi hành vi hiện có, thêm phụ thuộc, lộ bí mật...).

## 4. Tham khảo đã thấy

- Người dùng đã xem sản phẩm, tài liệu, bài viết, mẫu hay đối thủ nào? Thích và không thích điểm nào?
- Có thứ đã thử và bỏ không? Vì sao bỏ?

## 5. Hiện trạng

- Hiện giờ việc này được làm thế nào (code, quy trình, tài liệu, tay)? Chỗ nào đau?
- Phần nào trong repo hoặc tài liệu đã có liên quan (ADR, contract, spec sống, project-knowledge)? Tìm trong repo trước khi hỏi.
- Phần agent chưa xem được ghi rõ là chưa xem; không suy diễn thành sự thật.

## Cách dùng

Mục chưa rõ mà đoán sai chỉ tốn một sửa nhỏ → agent tự chọn và ghi **quyết định của agent**. Mục chưa rõ mà đoán sai làm
đổi hướng, phạm vi hoặc rủi ro → đưa vào thẻ gom câu hỏi kèm đáp án khuyến nghị. Kết quả cuối đi vào các mục tương ứng của
`brief.md` (xem template `brief` của `artifact-templates`).
