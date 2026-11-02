# Builder check — kiểm brief.md bằng một người thực hiện "không được hỏi lại"

Chạy **một lần**, sau khi đã ghi `brief.md` nháp (bước 8 của `SKILL.md`) và trước khi chạy `route.mjs` và trình thẻ duyệt brief. Mục đích: bắt phần còn thiếu mà người viết
không thấy, **không** tăng số câu hỏi cho người dùng. Câu nhỏ do agent tự quyết và nêu rõ; chỉ câu mà đoán sai sẽ làm
hỏng kết quả mới đi hỏi người dùng. Chỉ session chính chạy bước này.

## Cách chạy

1. Session chính gọi **một subagent MỚI** (loại general-purpose, không mang ngữ cảnh hội thoại), đưa đường dẫn `brief.md`
   và prompt bên dưới. Không dùng lại subagent cũ: người đã biết bối cảnh sẽ tự điền chỗ trống.
2. Subagent trả danh sách câu hỏi đã xếp hạng, hoặc "Không còn gì quan trọng."
3. Session chính phân từng câu vào **3 nhóm**:

   | Nhóm | Dấu hiệu | Xử lý |
   |---|---|---|
   | **Đã trả lời** | Câu trả lời đã có trong hội thoại hoặc tài liệu nguồn nhưng chưa ghi vào brief | Ghi vào brief, không hỏi |
   | **Nhỏ** | Đoán sai chỉ tốn một sửa nhỏ, có mặc định hợp lý | Tự quyết, ghi vào brief là **quyết định của agent**, không hỏi |
   | **Của người dùng** | Đoán sai làm đổi loại việc, phạm vi, route, kết quả mong đợi hoặc rủi ro mất dữ liệu/bảo mật | Gom vào danh sách hỏi |

   Tính năng người dùng nêu mà brief chỉ làm một phần (vd có giới hạn lượt dùng nhưng không có cách tăng lượt; người dùng
   nói "nhập mã lúc thanh toán" mà hàm không nhận mã) là câu hỏi của người dùng, không ghi là quyết định của agent.

4. Có câu thuộc nhóm "của người dùng" → hỏi **trong đúng một tin nhắn** (đánh số, mỗi câu kèm mặc định đề xuất để người
   dùng chỉ cần "đồng ý" hoặc sửa). Đây là vòng hỏi **duy nhất** của bước kiểm; không chạy lại builder check sau khi nhận
   trả lời, chỉ cập nhật brief. Không có câu nào → báo ngắn rằng builder check không còn câu hỏi.
   **Ngoại lệ, người dùng đã bỏ qua phần hỏi:** không hỏi gì; nhóm "của người dùng" cũng ghi là **quyết định của agent**
   kèm mặc định đã chọn, và nêu nổi bật ở thẻ duyệt brief để người dùng sửa. Trừ tính năng người dùng nêu mà brief chỉ
   làm một phần: mục đó vẫn nêu ở thẻ duyệt brief như điều chưa được duyệt, không ghi là quyết định của agent.
5. **Không có công cụ subagent** → session chính tự đọc `brief.md` theo đúng prompt dưới đây, đóng vai người thực hiện,
   rồi phân 3 nhóm như trên và ghi rõ là đã tự đọc.
6. Cập nhật `brief.md` theo kết quả (nhóm "đã trả lời", "nhỏ" và câu trả lời của người dùng); chỉ sau đó mới chạy
   `route.mjs`, vì khối `## Định tuyến` có thể đổi.

## Prompt mẫu cho subagent

```
Bạn là người sắp nhận brief này để bắt tay làm việc được mô tả trong đó (có thể là viết spec, sửa code, ra quyết định,
nghiên cứu, soạn tài liệu hay chỉnh quy trình). Bạn không thể hỏi người viết.
Đọc: <đường dẫn brief.md>.

Việc của bạn: liệt kê những câu hỏi mà bạn CÒN CẦN được trả lời trước khi bắt tay làm, mà nếu đoán sai thì kết quả
sẽ hỏng hoặc phải làm lại. Quy tắc:
- Không được hỏi người viết; chỉ ghi câu hỏi ra danh sách.
- Xếp hạng từ quan trọng nhất; mỗi câu một dòng, kèm một dòng "đoán sai thì hỏng gì".
- Bỏ câu soi chi tiết vụn vặt và câu mà một mặc định hợp lý trả lời được.
- Chú ý riêng khối "Định tuyến": loại việc, phạm vi và đầu ra mong đợi có khớp với phần mô tả không.
- Không viết lại brief, không đề xuất thiết kế mới.
- Nếu không còn câu nào quan trọng, trả đúng một dòng: "Không còn gì quan trọng."
```

Có thể bổ sung vào prompt tên mục cần chú ý nhưng không đưa kết luận hay lập luận của người viết cho subagent.
