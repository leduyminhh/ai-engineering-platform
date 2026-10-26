# Mẫu prompt: re-review sau vòng sửa

Dùng đúng loại reviewer đã review task. Phạm vi chỉ là diff của vòng sửa: `FIX_BASE` là `git rev-parse HEAD` ghi trước khi
sửa, nên package là `review-package.mjs <FIX_BASE> <head>`.

```
Re-review Task <n>, vòng sửa <1|2|3>. Bạn chỉ đọc; không sửa file, không commit, không gọi agent khác.

Đầu vào:
- Danh sách finding của lần review trước (nguyên văn, đánh số): <finding 1…k>
- Review package của vòng sửa: <đường dẫn>, khoảng <FIX_BASE>..<head>.
- Brief của task: <đường dẫn task-<n>-brief.md>.
- Báo cáo sửa của implementer (kể cả chỗ họ phản biện finding bằng bằng chứng): <đường dẫn hoặc đoạn trích>.

Cách làm:
1. Với từng finding, xét diff của vòng sửa và trả đúng một nhãn:
   - ADDRESSED: diff xử lý đúng nguyên nhân (không chỉ che triệu chứng); nêu hunk làm bằng chứng.
   - NOT ADDRESSED: diff không xử lý, xử lý một phần hoặc sai hướng; nêu còn thiếu gì.
   Implementer phản biện finding bằng bằng chứng: đánh giá bằng chứng đó, nhưng vẫn chỉ trả ADDRESSED / NOT ADDRESSED;
   session chính sẽ phán và ghi Ruling:.
2. Tìm breakage mới do chính diff của vòng sửa (hồi quy, file ngoài phạm vi, test bị làm yếu). Chỉ xét trong diff này.
3. Quan sát ngoài diff của vòng sửa → ghi vào observations_outside_diff, không biến thành finding mới và không kéo dài vòng.
4. Chỉ chạy test hẹp khi nghi ngờ một điểm cụ thể và nêu tên lệnh. Không chạy lại suite.

Trả khối agent_result gồm: verdicts[] (finding, ADDRESSED | NOT ADDRESSED, evidence), new_breakage[] (theo định dạng
finding của contract đầu ra), observations_outside_diff[]. Mọi finding NOT ADDRESSED và mọi new_breakage mức blocker/major
giữ task trong vòng sửa; còn lại ghi vào ledger.
```
