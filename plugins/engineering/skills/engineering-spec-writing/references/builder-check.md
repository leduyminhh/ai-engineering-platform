# Builder check — kiểm tài liệu bằng một người lập plan "không được hỏi lại"

Chạy **một lần**, sau khi đã có bản nháp `requirement.md`/`design.md` và trước checkpoint duyệt. Mục đích: bắt phần
còn thiếu mà người viết không thấy, **không** tăng số câu hỏi cho người dùng — câu nhỏ do agent tự quyết và nêu rõ,
chỉ câu mà đoán sai sẽ làm hỏng kết quả mới đi hỏi người dùng.

Chỉ session chính chạy bước này (spec-analyst không có tool gọi subagent).

## Cách chạy

1. Session chính gọi **một subagent MỚI** (loại general-purpose, không mang ngữ cảnh hội thoại), đưa đường dẫn tài
   liệu và prompt bên dưới. Không dùng lại subagent cũ: người đã biết bối cảnh sẽ tự điền chỗ trống.
2. Subagent trả danh sách câu hỏi đã xếp hạng, hoặc "không còn gì quan trọng".
3. Session chính phân từng câu vào **3 nhóm**:

   | Nhóm | Dấu hiệu | Xử lý |
   |---|---|---|
   | **Đã trả lời** | Câu trả lời đã có trong hội thoại hoặc tài liệu nguồn nhưng chưa ghi vào tài liệu | Ghi vào tài liệu, không hỏi |
   | **Nhỏ** | Đoán sai chỉ tốn một sửa nhỏ, có mặc định hợp lý | Tự quyết, ghi vào tài liệu là **quyết định của agent**, không hỏi |
   | **Của người dùng** | Đoán sai làm đổi AC, phạm vi, hướng đã chọn hoặc rủi ro mất dữ liệu/bảo mật | Gom vào danh sách hỏi |

   Trước khi giao subagent, session chính chạy `node <thư mục skill artifact-templates>/scripts/check-request.mjs docs/requests/<ngày>-<slug>/` trên bản nháp. Mọi cảnh báo W22, và dòng `AC<id> thiếu calc` của subagent, là lỗi sửa thẳng:
   session chính sửa tài liệu, không đưa vào bảng này và không hỏi người dùng. Tính năng người dùng nêu mà design chỉ
   làm một phần (vd có giới hạn lượt dùng nhưng không có cách tăng lượt) là câu hỏi của người dùng, không ghi là
   quyết định của agent.

4. Có câu thuộc nhóm "của người dùng" → hỏi **trong đúng một tin nhắn** (đánh số, mỗi câu kèm mặc định đề xuất để
   người dùng chỉ cần "đồng ý" hoặc sửa). Đây là vòng hỏi **duy nhất** của bước kiểm; không chạy lại builder check sau
   khi nhận trả lời, chỉ cập nhật tài liệu. Không có câu nào → báo ngắn rằng builder check không còn câu hỏi.
   **Ngoại lệ — người dùng đã bỏ qua phần hỏi:** không hỏi gì; nhóm "của người dùng" cũng ghi là **quyết định của agent**
   kèm mặc định đã chọn, và nêu nổi bật ở checkpoint để người dùng sửa khi duyệt. Trừ tính năng người dùng nêu mà design
   chỉ làm một phần: mục đó vẫn nêu ở checkpoint duyệt design như điều chưa được duyệt, không ghi là quyết định của agent.
5. **Không có tool subagent** → session chính tự đọc tài liệu theo đúng prompt dưới đây, đóng vai builder, rồi phân
   3 nhóm như trên và ghi rõ trong báo cáo là đã tự đọc.

## Prompt mẫu cho subagent

```
Bạn là một kỹ sư giỏi sắp nhận tài liệu này để lập kế hoạch và xây dựng. Bạn không thể hỏi người viết.
Đọc: <đường dẫn requirement.md / design.md>.

Việc của bạn: liệt kê những câu hỏi mà bạn CÒN CẦN được trả lời trước khi bắt tay làm, mà nếu đoán sai thì kết quả
sẽ hỏng hoặc phải làm lại. Quy tắc:
- Không được hỏi người viết; chỉ ghi câu hỏi ra danh sách.
- Xếp hạng từ quan trọng nhất; mỗi câu một dòng, kèm một dòng "đoán sai thì hỏng gì".
- Bỏ câu soi chi tiết vụn vặt, phần tài liệu đã giao cho builder quyết (mục "Để builder quyết"), và câu mà một
  mặc định hợp lý trả lời được.
- AC nêu kết quả số mà thiếu `calc:` → `AC<id> thiếu calc` (sửa thẳng).
- Không viết lại tài liệu, không đề xuất thiết kế mới.
- Nếu không còn câu nào quan trọng, trả đúng một dòng: "Không còn gì quan trọng."
```

Đây là bản tóm ý bằng tiếng Việt, chỉnh theo quy ước của repo; có thể bổ sung vào prompt tên file AC/ràng buộc cần
chú ý nhưng không đưa kết luận của người viết cho subagent.
