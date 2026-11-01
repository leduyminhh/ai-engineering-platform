# Làm rõ — phần chung (nguồn duy nhất)

Phần làm rõ dùng chung cho mọi skill cần hiểu người dùng muốn gì trước khi viết tài liệu: `brainstorming` và
`engineering-spec-writing` cùng đọc file này, không chép thành hai bản. Chạy ở **session chính** (hội thoại trực tiếp với
người dùng), không chạy trong subagent. Chỉ hỏi phần còn thiếu sau khi đã nạp context; đừng hỏi lại thứ tìm được trong repo.

## Cổng "đủ thông tin" + lối thoát

Tự hỏi: mình đã biết gì về điều người dùng muốn và vì sao? Việc đã đủ rõ và nhỏ (một sửa đổi có kết quả quan sát được,
không có quyết định thiết kế) → **không chạy quy trình làm rõ**, làm thẳng. Ngược lại, tin nhắn đầu tiên gồm đúng hai
phần:

1. Một dòng nói rằng người dùng có thể **bỏ qua phần hỏi** bất cứ lúc nào.
2. Một câu mở gợi họ kể tình huống thật. Ở `brainstorming`, thẻ gom câu hỏi thay cho câu mở đơn lẻ nhưng thẻ vẫn có
   đúng một câu mở.

Người dùng chọn **bỏ qua phần hỏi** → bỏ phần hỏi và playback từng phần, **không hỏi thêm câu nào** trước checkpoint
(kể cả ở builder check): agent **tự chọn hướng** (vẫn ghi 2–3 hướng + khuyến nghị + đánh đổi, không dừng chờ chọn), viết
tài liệu với mọi lựa chọn đánh dấu **quyết định của agent**, và nêu nổi bật các quyết định đó ở checkpoint (chỉ nêu riêng
lựa chọn công nghệ hoặc nền tảng quan trọng) để người dùng sửa khi duyệt. Không trình bày quyết định của agent như điều
người dùng đã đồng ý.

## Nguyên tắc hỏi

- **Câu mở trước, đoán để họ sửa:** neo vào tình huống cụ thể; chỉ đưa lựa chọn khi họ bí. Khi có cơ sở, nêu điều mình
  đoán và hỏi "đúng không?"; điều chưa xác nhận ghi **[giả định]**.
- **Ưu tiên câu mở khoá kết quả:** hỏi trước những câu mà thiếu nó thì không viết được tiêu chí kiểm được.
- **Không bịa:** phần chưa có câu trả lời ghi **[giả định]** kèm cơ sở và đưa vào mục câu hỏi mở để con người chốt.
- Chuyện kỹ thuật hoặc nền tảng: hỏi người dùng muốn tự chọn hay giao agent; agent chọn thì ghi **quyết định của agent**.

## Playback — tóm tắt lại từng phần

Mỗi khi hiểu xong một phần, **tóm tắt lại** ngắn (khoảng 200–300 từ) bằng lời của mình, đánh dấu chỗ suy đoán là
**[giả định]**, kết bằng "sai hoặc thiếu gì?". Xen kẽ với câu hỏi, không dồn về cuối. Nếu thực ra là nhiều dự án độc lập
→ nói thẳng, thống nhất thứ tự rồi làm lần lượt.

## Đề xuất 2–3 hướng — đặt sau playback

Chỉ làm khi mô tả đã được xác nhận qua playback (**sau playback**). Tự nghĩ rộng riêng tư, bỏ hướng yếu; chỉ trình
**2–3 hướng** thật sự khác nhau, mỗi hướng một dòng đánh đổi, nêu **một khuyến nghị** và lý do. Ghi cả hướng được chọn lẫn
các hướng bị loại (kèm đánh đổi và lý do) vào tài liệu đầu ra. Người dùng chốt hướng → ghi là quyết định đã chốt;
người dùng bỏ qua phần hỏi hoặc không chốt → agent tự chọn theo khuyến nghị, ghi **quyết định của agent**, không dừng
chờ chọn.

Đây là **lệch có chủ đích**: cách làm thường gặp là không đưa lựa chọn sớm (chỉ mô tả, để người dùng tự đi tới hướng). Ở
đây chủ repo yêu cầu có đề xuất; giữ thứ tự hỏi mô tả trước, đề xuất sau, và đừng bỏ bước đề xuất này.
