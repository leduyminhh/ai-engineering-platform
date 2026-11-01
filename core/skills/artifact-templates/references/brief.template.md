<!-- artifact-template
type: brief
version: 1
validator: scripts/check-request.mjs
sources: docs/requests/2026-10-31-brainstorming-routing/design.md
Ghi bản điền ở docs/requests/<ngày>-<slug>/brief.md (ngoài repo code thì hỏi chỗ lưu). Duyệt brief là cổng duy nhất của brainstorm và cũng là duyệt route.
Bỏ khối này khi chép template ra dùng.
-->

# Brief: <tên>
- Ngày: <yyyy-mm-dd>
- Trạng thái: <draft | approved>

## Vấn đề và loại việc
<việc này là gì, thuộc loại nào, có điểm gì đặc biệt>
## Vì sao bây giờ và thành công trông thế nào
<...>
## Goal, non-goal, anti-goal
<...>
## Hiện trạng và tham khảo đã thấy
<code, file, tài liệu, đường link đã xem; phần chưa xem ghi rõ>
## Hướng đã cân nhắc
<2–3 hướng, hướng được chọn và các hướng bị loại kèm đánh đổi và lý do; việc nhỏ không có hướng nào thì ghi "không có">
## Quyết định của agent
<mọi lựa chọn agent tự đưa ra khi người dùng bỏ qua phần hỏi hoặc câu trả lời chưa chốt; không có thì ghi "không có">
## Phần đoán
<các chỗ đánh dấu [giả định] chưa được xác nhận>
## Định tuyến
loại-việc: feature | bug | quyết-định | nghiên-cứu | quy-trình | tài-liệu | nghiệp-vụ | không-làm
phạm-vi: code-be | code-fe | fullstack | data | ops | không-code
đầu-ra-mong-đợi: <một dòng: kết quả người dùng nhận được>
rủi-ro: <một dòng: điều có thể hỏng hoặc làm lệch; ghi "không có" nếu không>
ứng-viên-route: [<id route chính>, <id route phụ>]
route-đã-duyệt: <id route sau khi người dùng duyệt brief, hoặc chưa-có-quy-trình; để trống khi còn draft>
