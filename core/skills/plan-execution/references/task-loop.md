# Vòng task — giao thức từng task

Session chính chạy giao thức này cho từng task của `plan.md`, lần lượt, không song song trong cùng một cây làm việc.
Định dạng trường (`agent_result`, `spec_verdict`, `tdd`, finding, `rulings`) theo contract đầu ra (`core:principles`).
Mọi lệnh chạy từ gốc project: `node <thư mục skill plan-execution>/scripts/<script>.mjs …`; đường dẫn
`plan.md` tương đối theo gốc project (script tự tính workspace `.aip/` từ plan).

## Rà plan trước khi chạy

Một lượt đọc `plan.md` trước Task 1, ghi kết quả vào ledger bằng một dòng `Ruling:` nếu có quyết định:

- Chỉ xét task có `**Interfaces:**` nối nhau (`Produces` của task A là `Consumes` của task B) hoặc cùng sửa một file:
  tên, kiểu, chữ ký phải khớp từng ký tự; lệch thì phán một hướng và ghi `Ruling:`.
- Không có task nào chung interface hay file → không cần ghi gì thêm.
- Bước rà này không thay `check-request.mjs`; plan còn cảnh báo ngoài W9 thì quay lại `engineering-plan-writing`.

## Các bước của một task

1. **Ghi BASE** bằng `git rev-parse HEAD` trước khi giao việc. Không dùng `HEAD~1`. Mất BASE sau khi compact thì lấy
   `<b>` của dòng `Task <n-1>: complete` gần nhất trong ledger và đối chiếu `git log`.
2. **Cắt brief**: `node <thư mục skill plan-execution>/scripts/task-brief.mjs <plan.md> <n>` ghi `task-<n>-brief.md` vào workspace `.aip/` của plan và in đường
   dẫn. Brief là nguyên văn mục `### Task <n>`; không tóm tắt lại, không chép nội dung task vào context của session chính.
3. **Giao việc** theo `kind` (chuỗi agent: `engineering-plan-writing`) bằng mẫu `prompts/implementer.md`. Prompt giao việc
   chỉ gồm một dòng bối cảnh, đường dẫn brief, `Produces` của task trước mà task này dùng, và model; không dán lịch sử
   hội thoại. Task `DOCS`/`TOOLING` do session chính tự làm theo brief.
4. **Nhận `agent_result`** và áp luật kiểm đầu ra của contract (có `status`, finding có `location` + `evidence`, file thay đổi
   thuộc danh sách `**Files:**`). Task TDD `có` (dòng `**TDD:**` trong brief; thiếu dòng thì `BE` là `có`): thiếu
   `tdd.red`/`tdd.green` là đầu ra hỏng; task `không` không bị đòi `tdd`. Task `TOOLING` TDD `có` do session chính làm:
   thiếu red/green trong dòng ledger là hỏng. Ánh xạ trạng thái:
   - `completed` và `remaining_risks` rỗng → qua bước 5.
   - `completed` kèm `remaining_risks` → xong kèm lo ngại: đọc từng lo ngại; liên quan đúng/phạm vi thì xử lý trước khi
     review, không thì chuyển cho reviewer.
   - `blocked` kèm `questions[]` → session chính thử trả lời từ spec/plan/design; trả lời được thì gửi lại câu trả lời
     (ghi `Ruling:` nếu là quyết định), không hỏi người dùng. Chỉ hỏi người dùng khi thuộc loại dừng bên dưới.
   - `failed` → đừng bắt cùng agent thử lại y nguyên: đổi bối cảnh, tách task nhỏ hơn hoặc dùng agent mạnh hơn; vẫn không
     được thì coi như plan hỏng cho task đó.
5. **Kiểm chứng của session chính**: tự chạy lệnh test nêu trong task (chỉ test hẹp, không chạy full suite ở từng task)
   và so với `Expected:` của plan; báo cáo "xanh" của agent chỉ là đầu vào, không phải bằng chứng.
6. **Commit**: session chính commit sau mỗi task qua `git-workflow`; agent không tự commit. Một task có ≥ 1 commit; vòng
   sửa sinh thêm commit, không amend hay squash. Ghi `head` = `git rev-parse HEAD` sau commit.
7. **Task review**: `node <thư mục skill plan-execution>/scripts/review-package.mjs <BASE> <head> --plan <plan.md>`
   (luôn có `--plan` để package ghi vào workspace `.aip/` của plan, đã được git bỏ qua, và script in đường dẫn; diff không
   đổ vào context của session chính), rồi gọi
   `backend-reviewer`/`frontend-reviewer` (task `DOCS`/`TOOLING`: `general-purpose` nạp skill review phù hợp) bằng
   `prompts/task-review.md`. Reviewer trả **cả hai**: `spec_verdict` (Missing / Extra / Misunderstood) và finding chất
   lượng; thiếu một trong hai là đầu ra hỏng. Task có chuỗi hai agent (vd FE-UI) chỉ review một lần, sau cả hai.
8. **Xử lý kết quả review**: `spec_verdict: cannot_verify` do session chính giải quyết (đọc code, chạy lệnh) rồi mới
   tiếp. Chỉ finding `blocker`/`major` hoặc `spec_verdict` khác `compliant` mới vào vòng sửa; `minor`/`nit` ghi vào
   ledger dạng `minor (deferred): <finding> — task <n>` để chuyển cho review cuối. Mục plan bắt buộc mà thiếu vẫn là
   `major`. Không tự sửa finding: sửa do agent.
9. **Ghi ledger** khi task kết thúc, với `<a>` = BASE và `<b>` = `head` cuối cùng, và chỉ khi đã có evidence test:
   - review sạch: `node <thư mục skill plan-execution>/scripts/ledger.mjs <plan.md> "Task <n>: complete (commits <a>..<b>, review clean)"`;
   - qua breaker (còn finding mở sau vòng 3, đã phán hết): các dòng `Ruling:` của task đứng trước, rồi
     `Task <n>: complete (commits <a>..<b>, <k> ruled)` với `<k>` là số finding đã phán. Không có dòng complete thì lần
     làm tiếp sẽ làm lại task, nên task chưa bao giờ kết thúc mà thiếu dòng này;
   - task `TOOLING` TDD `có` do session chính làm: dòng `complete` mang bằng chứng đỏ theo định dạng
     `red: <lệnh> exit <n khác 0>` … `tests: <lệnh> exit 0` của `inline.md` (bước 6).

## Vòng sửa

Mỗi task có tối đa 3 vòng sửa; bộ đếm đặt lại về 0 ở task kế tiếp và không phải cạnh của `graph.json`. Mỗi vòng gồm một
lần sửa + một lần re-review có phạm vi.

- **Vòng 1–2**: tiếp tục implementer cũ bằng `SendMessage` (finding thuộc test → test-writer đã làm test đó), kèm danh sách
  finding và đường dẫn brief. Implementer xác minh finding trước khi sửa; không đồng ý thì ghi bằng chứng vào báo cáo
  sửa, session chính phán và ghi `Ruling:`; không được âm thầm bỏ finding.
- **Vòng 3**: gọi agent mới (cùng loại agent domain, hoặc `*-fixer` vì khoá theo danh sách file) với `model: opus`, đưa
  brief + báo cáo trước + finding còn mở.
- **Re-review**: `FIX_BASE` = `git rev-parse HEAD` trước khi sửa; gom `node <thư mục skill plan-execution>/scripts/review-package.mjs <FIX_BASE> <head> --plan <plan.md>`
  và gọi reviewer bằng `prompts/re-review.md`. Re-review chỉ xét diff của vòng sửa, trả `ADDRESSED` hoặc `NOT ADDRESSED` cho từng
  finding cộng breakage mới trong diff đó. Quan sát ngoài diff ghi vào ledger, không kéo dài vòng.
- Mỗi vòng sửa chỉ chạy test hẹp phủ phần vừa sửa. Bugfix có regression test thì kiểm đỏ→xanh: hoàn tác bản sửa phải
  làm test đỏ, khôi phục thì xanh.
- Một task không bao giờ có vòng thứ tư: sau vòng 3, không còn vòng nào nữa; finding còn mở chuyển sang breaker.

Phương án dự phòng (chỉ khi lời gọi lỗi): `SendMessage` không chạy được → gọi agent mới nhận brief + báo cáo + finding;
agent plugin không nhận `model` → dùng `general-purpose` với `model: opus`, nạp skill `backend-code-review`/
`frontend-code-review`, giữ chỉ-đọc bằng prompt. Không thêm agent mới.

## Breaker và `Ruling:`

Hết vòng 3 mà còn finding mở, session chính phán từng finding: hoãn, chấp nhận có điều kiện, hoặc dừng. Mỗi quyết
định ghi một dòng:

```
Ruling: <quyết định> — <lý do> — <chi phí nếu sai>
```

Finding `blocker`/`major` mà hoãn hoặc chấp nhận phải ghi trong `Ruling:` kèm mức gốc (vd `major: …`) để review cuối nhìn
thấy; nhãn `minor (deferred)` chỉ dành cho finding `minor`/`nit`. Phán xong hết finding thì ghi dòng
`Task <n>: complete (commits <a>..<b>, <k> ruled)` (bước 9) và chạy tiếp task sau.

**Dừng hỏi người dùng, không ghi `Ruling:` rồi chạy tiếp**, khi finding hoặc tình huống thuộc một trong:

1. việc không đảo ngược được hoặc phá huỷ (xoá dữ liệu, ghi đè lịch sử, thao tác không hoàn tác được);
2. bảo mật;
3. tác động ngoài repo (merge, push, publish, gọi dịch vụ ngoài);
4. finding chạm schema DB;
5. plan hỏng đến mức mọi hướng đều là đoán.

Các trường hợp còn lại (mơ hồ nhỏ, xung đột giữa hai task, finding không load-bearing) session chính tự quyết, ghi
`Ruling:` và chạy tiếp. Mọi dòng `Ruling:` phải đi vào `rulings` của `workflow_result` lúc kết thúc.

## Gom task nhỏ

Nhiều task nhỏ cùng khuôn (vd đổi một dòng ở nhiều file) có thể giao một lần và review như một đơn vị, miễn brief liệt kê
từng file và reviewer kiểm **mỗi file có hunk tương ứng**; file nào không có hunk là `Missing`. Ledger vẫn ghi một dòng
`Task <n>: complete` cho từng task.

## Review cuối và các điểm cố định

- Sau task cuối, một lần review toàn nhánh (`MERGE_BASE..HEAD`) theo `prompts/final-review.md`: reviewer chạy `model: opus`;
  `engineering-quality-auditor` chỉ chạy ở review cuối, không chạy theo task. Chỉ một lần sửa cho toàn bộ finding và một
  lần re-review có phạm vi; phần còn lại trình người dùng ở bước kết thúc nhánh, không có làn sửa thứ hai.
- Full suite của mọi component bị chạm chạy **một lần** sau vòng sửa cuối, không chạy ở từng task.
- Không có tool subagent, hoặc người dùng nói rõ chạy inline: làm theo `inline.md` (session chính làm mọi task, review cuối thay
  review từng task).

## Ledger

`<gốc repo chính>/.aip/runs/<request>/<part>/progress.md`, mỗi dòng thêm bằng `scripts/ledger.mjs <plan.md> "<dòng>"`:

```
# Ledger — plan: <đường dẫn plan.md>
Task <n>: complete (commits <a>..<b>, review clean)
Ruling: <quyết định> — <lý do> — <chi phí nếu sai>
Task <m>: complete (commits <a>..<b>, <k> ruled)
minor (deferred): <finding minor/nit> — task <n>
Plan: complete
```

Sau compact hoặc resume, tin ledger + `git log` hơn trí nhớ: làm tiếp từ task chưa `complete`. Dòng `Plan: complete`
chỉ ghi ở cuối bước kết thúc nhánh; hook `session-start` ngừng nạp ledger khi thấy dòng này.
