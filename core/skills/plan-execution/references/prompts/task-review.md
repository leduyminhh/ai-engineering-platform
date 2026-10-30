# Mẫu prompt: review một task

Gọi `backend-reviewer` hoặc `frontend-reviewer` theo `kind` (task `DOCS`/`TOOLING`: `general-purpose`, chỉ đọc bằng
prompt). Chỉ một reviewer cho mỗi task, chạy sau cả chuỗi agent của task. Không chạy `engineering-quality-auditor` ở đây.

```
Review Task <n> của plan <đường dẫn plan.md>, chế độ task-review. Bạn chỉ đọc; không sửa file, không commit, không gọi agent khác.

Đầu vào:
- Brief của task: <đường dẫn task-<n>-brief.md> (nguồn sự thật về yêu cầu và danh sách file).
- Review package (commit list + stat + diff): <đường dẫn task-<n>-review.md>, khoảng <BASE>..<head>.
- Báo cáo của implementer: <đường dẫn hoặc đoạn agent_result> — dùng để biết ý định, KHÔNG tin; đối chiếu với diff.

Cách làm:
1. Đọc diff qua review package, không tự chạy lại git. Không chạy lại suite test của implementer; chỉ chạy test hẹp
   khi bạn nghi ngờ một điểm cụ thể và nêu rõ tên test/lệnh.
2. Phán quyết thứ nhất — spec_verdict, so diff với brief và AC:
   - Missing: yêu cầu có trong brief nhưng diff không làm (task gom nhiều file: mỗi file trong brief phải có hunk).
   - Extra: diff làm điều brief không yêu cầu hoặc sửa file ngoài danh sách Files.
   - Misunderstood: có làm nhưng hiểu sai ý.
   spec_verdict: compliant | issues | cannot_verify. cannot_verify kèm điều cần kiểm thêm; không đoán.
   AC mơ hồ, hoặc làm đúng chữ AC thì vỡ một bất biến khác (vd giá trị API trả về không gửi lại được): không chọn hướng
   sửa. Ghi vào questions[] gồm AC ID, các cách hiểu, và hệ quả của từng cách hiểu.
3. Phán quyết thứ hai — chất lượng theo các trục của skill review của bạn. Task BE: kiểm tdd.red/tdd.green có trong báo cáo
   và khớp diff (test có đỏ đúng lý do, kỳ vọng tự tính chứ không chép từ code).
4. Thang severity của contract đầu ra: blocker (≈ Critical), major (≈ Important), minor/nit. "Coverage có thể rộng hơn"
   là minor; mục plan bắt buộc mà thiếu là major. Plan/spec im lặng về một điều không có nghĩa là cho phép.
5. Mỗi finding có severity, category, location (file:line), evidence, impact, recommendation, confidence. Tự đọc lại
   file:line trước khi trả; bỏ finding không tái lập được.

Trả khối agent_result, gồm cả spec_verdict (kèm Missing/Extra/Misunderstood nếu issues) lẫn findings[]; thiếu một trong
hai là đầu ra hỏng. Trường declined_to_judge[]: liệt kê điều bạn bỏ qua và lý do (vd cần chạy hệ thống thật).
Không khen, không tóm tắt lại diff.
```
