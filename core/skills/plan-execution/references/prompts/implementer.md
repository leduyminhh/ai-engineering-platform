# Mẫu prompt: giao task cho implementer

Session chính điền các `<…>` rồi gửi. Gọi agent domain theo `kind` của task (bảng ở `engineering-plan-writing`), tham số
`model` mặc định `sonnet`; vòng sửa 3 dùng `opus` (xem `task-loop.md`). Không dán lịch sử hội thoại hay nội dung task vào prompt:
brief đã nằm trong file.

```
Bạn thực hiện Task <n> của plan <đường dẫn plan.md>: <tiêu đề task>.

Bối cảnh một dòng: <nhánh, tính năng đang làm, task này đứng ở đâu trong plan>.

Brief (nguyên văn task, đọc kỹ trước khi làm): <đường dẫn task-<n>-brief.md>
Interface từ task trước mà task này dùng: <chữ ký chính xác lấy từ Produces của task trước, hoặc "không có">
Global Constraints và Review Focus nằm trong plan; chỉ đọc các mục đó, không đọc cả plan.

Trước khi làm: có điểm nào trong brief chưa rõ hoặc mâu thuẫn → dừng, trả status: blocked kèm questions[] cụ thể.
Đừng đoán. Hỏi được ở đầu thì hỏi ở đầu.

Việc cần làm:
1. Làm đúng và chỉ những gì brief yêu cầu; không thêm tính năng, không dọn code ngoài phạm vi, không thêm hành vi không AC nào nêu (ném lỗi mới, mã lý do mới, kiểm kiểu/đầu vào mà AC không đòi).
2. Chỉ sửa file trong danh sách **Files:** của brief. Cần sửa file khác → dừng và báo blocked.
3. Task TDD `có` (dòng `**TDD:**` đầu brief): viết test đỏ trước, chạy, xác nhận đỏ vì đúng lý do, rồi mới viết code cho
   xanh. Brief không có dòng `**TDD:**` (vd thay đổi nhỏ không có plan.md) thì theo mặc định của kind: BE là `có`, kind
   khác là `không`. Task `**TDD:** không`, ví dụ FE-UI: dựng component, build/tsc/lint xanh; test do
   frontend-test-writer làm ở bước sau của cùng task.
4. Test phủ AC ghi ID AC của dòng `**Phủ AC:**` trong tên test hoặc comment (`AC1.2`; hàm Python `ac1_2`), để `check-request.mjs` không báo W7.
5. Chạy test hẹp phủ phần vừa làm, không chạy full suite.
6. Tự soát diff trước khi báo: đủ yêu cầu brief? có làm thừa? test kiểm hành vi thật hay chỉ lặp lại mock?
7. Số đo hay thử nghiệm bạn nêu trong báo cáo (thời gian chặn, hành vi thư viện, kết quả trái giả định) phải tái lập được từ nhánh:
   chạy bằng test hoặc script nằm trong Files; báo kèm lệnh chạy lại. Đo bằng code tạm ngoài repo thì ghi rõ [Unverified].

Không được: commit, push, gọi agent khác hay reviewer. Session chính sẽ commit và review sau khi bạn báo.

Báo cáo trả về trong tin nhắn cuối, theo khối agent_result của contract đầu ra (core:principles):
- status: completed | blocked | failed; summary 1–3 câu.
- changes (file thêm/sửa/xoá), validation (lệnh, exit code, tóm tắt).
- tdd (task TDD `có`): red = lệnh + exit code + lý do đỏ đúng; green = lệnh + exit code.
- questions[] khi blocked; remaining_risks[] cho điều bạn còn lo (completed kèm remaining_risks = xong kèm lo ngại).
```

Khi nhận báo cáo: session chính xử lý theo `references/task-loop.md` (bước 4–6). Vòng sửa dùng cùng prompt này nhưng thay
phần "Việc cần làm" bằng danh sách finding và nhắc: xác minh từng finding trước khi sửa; không đồng ý thì nêu bằng chứng
trong báo cáo thay vì bỏ qua.
