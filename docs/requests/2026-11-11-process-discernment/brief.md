# Brief: Process Discernment — aip đã có gì để đánh giá quá trình lập luận của AI
- Ngày: 2026-11-11
- Trạng thái: approved

## Vấn đề và loại việc
Người dùng hỏi aip đã có gì về "Process Discernment", định nghĩa là đánh giá QUÁ TRÌNH AI đi tới kết quả: có lỗi logic, chỗ bỏ sót hay lập luận không hợp lý hay không, không chỉ kiểm kết quả cuối. Loại việc là nghiên cứu (kiểm kê hiện trạng và chỉ ra khoảng trống), phạm vi không-code. Điểm đặc biệt: repo không chứa chính cụm "Process Discernment" hay "discern" (đã grep toàn repo, trừ `build/`, `.git/`, `.aip/`); nghĩa của khái niệm lấy từ lời người dùng, chưa có nguồn ngoài đối chiếu (người dùng chọn chỉ repo aip).

## Vì sao bây giờ và thành công trông thế nào
[giả định] Người dùng muốn biết aip có đang chặn được lỗi nằm ở lập luận của agent (chứ không chỉ ở diff) hay không, trước khi quyết có đầu tư thêm. Thành công: một bản kiểm kê có file:line và một danh sách khoảng trống có bằng chứng vắng, kèm khuyến nghị làm tiếp hay không; người dùng quyết được mà không phải tự đọc lại repo.

## Goal, non-goal, anti-goal
- Goal: bản kiểm kê cơ chế đang có (ai đánh giá, khi nào, quan sát được gì, giới hạn) và khoảng trống so với định nghĩa trên; một khuyến nghị.
- Đầu ra của request này chính là báo cáo kiểm kê: mục "Hiện trạng" và "Khoảng trống chính" của brief này, kèm khuyến nghị; hướng B (hoặc C) nếu người dùng chọn là một request riêng làm sau, không thuộc request này.
- Non-goal: thiết kế hay code cơ chế mới trong request này; đọc web hay tài liệu ngoài repo; đo chất lượng bằng chạy eval tốn model.
- Anti-goal: gọi một cơ chế kiểm kết quả là "kiểm quá trình"; kết luận "đã đủ" từ việc có bảng văn bản nhắc mà không có kiểm tất định.

## Hiện trạng và tham khảo đã thấy
Đã đọc (chỉ đọc, nguồn chỉ repo aip; bảng đầy đủ với file:line nằm ở báo cáo kiểm kê của phiên này). Cơ chế đang có, nhóm theo việc chúng thật sự quan sát:
- **Đối chiếu kết quả với yêu cầu (không đọc lập luận):** `spec_verdict` Missing/Extra/Misunderstood (`core/skills/plan-execution/references/prompts/task-review.md:17-21`); báo cáo implementer "chỉ biết ý định, KHÔNG tin" (`task-review.md:12-13`); re-review ADDRESSED/NOT ADDRESSED (`prompts/re-review.md:16-19`); `declined_to_judge[]` (`core/principles/workflow-output-contract.md:70`).
- **Buộc ghi lý do và rủi ro của quyết định:** dòng `Ruling: <quyết định> — <lý do> — <chi phí nếu sai>` (`task-loop.md:110-121`); `ruling_review[]` ở review cuối (`prompts/final-review.md:29-39`); 6 loại dừng không được tự phán (`task-loop.md:123-132`); nhãn `[giả định]`/"quyết định của agent" và playback ở brainstorming (`clarify-core.md:19-23,49-53`).
- **Kiểm tất định trên dấu vết có thể đếm:** `## Dấu hiệu nới kiểm` (`scripts/review-package.mjs:14-79`); `ledger.mjs` từ chối `complete` thiếu `red:`/`tests: … exit 0` (`inline.md:32-39`); `check-request.mjs` W6/W7/W22; hook `gate-stop.mjs:129-149` (sửa code mà không chạy test sau lần sửa cuối).
- **Kỷ luật suy luận viết thành văn bản:** `engineering-debugging` (giả thuyết "X là nguyên nhân vì Y", một biến mỗi lần, dừng sau 3 lần sửa; `SKILL.md:21-40`); `workflow-bugfix` Bước 5 có người xác nhận root cause; bảng "dấu hiệu tự biện minh" ở `plan-execution`, `using-aip`, `engineering-tdd`, `engineering-debugging`.
- **Eval:** 33 file grader `focus: trace`, vài case chấm thứ tự và "đọc trước khi kết luận" (`evals/engineering/debugging-root-cause-first/graders/hypothesis-with-evidence.md:6-8`); README tự nêu Δ chủ yếu không phải bằng chứng chất lượng (`evals/README.md:93-120`), chạy tay, không nằm trong `npm test`.

Chưa xem [Unverified]: toàn văn `ledger.mjs`, `task-brief.mjs`, `task-size.md`, `guard-*.mjs`, phần lớn 129 file grader, `docs/requests/*` (chỉ grep tên cụm).

## Hướng đã cân nhắc
- **A. Dừng ở kiểm kê, không làm thêm.** Đánh đổi: không tốn công; nhưng khoảng trống chính (bên dưới) vẫn mở. Loại nếu người dùng muốn giảm rủi ro lập luận.
- **B. Tăng cường cơ chế review có sẵn (khuyến nghị).** Ba việc nhỏ, đều dựa trên chỗ aip đã có: (1) báo cáo `agent_result` thêm trường `assumptions[]` cho giả định thiết kế agent đã dựa vào, reviewer phải xét từng giả định; (2) mục review cuối kiểm từng `Ruling:` với bằng chứng chạy lại được (hiện chỉ quy tắc văn bản, `task-loop.md:137-139`); (3) thêm 2–3 case eval về lập luận (bỏ sót AC, kết luận không khớp bằng chứng). Đánh đổi: tốn thêm tokens ở review; phần "kiểm lập luận" vẫn do agent thứ hai đọc báo cáo, không đọc chuỗi suy nghĩ.
- **C. Skill mới on-demand `engineering-process-audit`** đọc ledger, `Ruling:` và (nếu người dùng cho phép) transcript phiên để chấm lỗi logic và bỏ sót, trả finding có trích dẫn. Đánh đổi: phủ được lập luận trung gian nhất, nhưng cần quyết định riêng về quyền đọc transcript (`usage-report.mjs:2` hiện cố ý không in nội dung hội thoại), chi phí cao, khó kiểm chất lượng của chính người chấm. Hoãn: chỉ làm nếu B chứng minh chưa đủ.

Khoảng trống chính (mỗi mục có bằng chứng vắng hoặc nơi chỉ có một phần): (1) không cơ chế nào đọc chuỗi suy nghĩ hay lập luận trung gian; grep `hallucinat|sycophan|chain.of.thought|rationali|pre-?mortem|adversar|counterfactual|calibrat…` trên core, plugins, workflows, docs/specs, docs/decisions, evals, scripts, cli, templates cho 0 kết quả; reviewer chỉ nhận diff, báo cáo và ledger (`task-review.md:9-13`); transcript chỉ dùng đếm tool-call và token (`gate-stop.mjs`, `transcript-stats.mjs`); (2) `Ruling:` do chính agent đưa ra tự phán, người ngoài chỉ xét ở review cuối, và chế độ inline ghi thẳng "không có góc nhìn thứ hai" (`inline.md:49-50`); (3) không có script xác minh Ruling khớp bằng chứng (`ledger.mjs` tự nhận không xác minh được exit code thật, `inline.md:36-38`); (4) `confidence` của finding không có tiêu chí hiệu chuẩn và chưa thấy chỗ dùng nó để ra quyết định (`workflow-output-contract.md:29`) [Unverified: grep chỉ trong plan-execution]; (5) giả định thiết kế ngầm của implementer không có nhãn (chỉ `[Unverified]` cho số đo ngoài repo, `prompts/implementer.md:29-30`); (6) phần lớn "dấu hiệu tự biện minh" chỉ là bảng văn bản, ít cái có kiểm tất định; (7) ADR-0005 cho task cỡ Nhỏ bỏ review từng task, tự ghi ngưỡng "chưa kiểm trên dữ liệu [Unverified]" (`ADR-0005:38`).

## Quyết định của agent
- Chọn hướng B làm khuyến nghị (người dùng chưa chọn hướng): ít rủi ro nhất, tận dụng cơ chế có sẵn, có phần kiểm tất định.
- Lưu brief trong thư mục của phiên này (`docs/requests/2026-11-11-process-discernment/brief.md` dưới thư mục worktree cũ), không phải checkout `master`: hook chặn ghi vào checkout gốc từ phiên worktree, và thư mục worktree đã bị gỡ đăng ký sau merge nên brief chưa nằm trên nhánh nào, không commit. Người dùng chuyển vào repo khi cần.
- Không đọc web và không chạy eval (theo lựa chọn "Chỉ repo aip" và chi phí).
- Từ builder check (một vòng, không hỏi thêm): báo cáo kiểm kê là chính brief này, không có file báo cáo riêng; các điểm [Unverified] giữ nguyên nhãn, không đọc thêm trước khi duyệt; khoảng trống chỉ đúng theo định nghĩa người dùng đã xác nhận (nếu khái niệm gốc rộng hơn, ví dụ hiệu chuẩn độ tin cậy hay tính nhất quán giữa các lần chạy, danh sách còn thiếu mục; `confidence` ở khoảng trống 4 là một phần của hướng đó).
- Tiêu chí khuyến nghị làm tiếp (người dùng chưa nêu): rủi ro lập luận sai lọt qua review so với chi phí token và công bảo trì. Nếu tiêu chí là "không tốn thêm token ở review" thì B bị loại và khuyến nghị đổi thành A.
- Route: `route.mjs` trả `chosen: null` (chưa có quy trình phù hợp cho `nghiên-cứu` + `không-code`), nên `ứng-viên-route` để trống; sau khi duyệt không gọi orchestrator mà làm việc trong phiên theo brief.

## Phần đoán
- [giả định] Đối tượng đánh giá là lập luận và quyết định của agent trong aip (plan, review, `Ruling:`, spec), không phải code đầu ra. Người dùng đã xác nhận ở playback.
- [giả định] Người hoặc agent thứ hai đánh giá, trong lúc chạy hoặc sau đó. Người dùng đã xác nhận ở playback.
- [giả định] Người dùng muốn một khuyến nghị làm tiếp, không chỉ danh sách.
- [giả định] Ba việc của hướng B là đủ nhỏ để thành một request riêng; chưa ước lượng công.

## Định tuyến
loại-việc: nghiên-cứu
phạm-vi: không-code
đầu-ra-mong-đợi: bản kiểm kê aip đã có gì về đánh giá quá trình lập luận của AI và danh sách khoảng trống có bằng chứng, kèm khuyến nghị làm tiếp hay không
rủi-ro: báo cáo kiểm kê chưa đọc hết repo nên có thể bỏ sót cơ chế
ứng-viên-route: []
route-đã-duyệt: chưa-có-quy-trình
