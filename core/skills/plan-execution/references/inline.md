# Chế độ inline — session chính tự thực thi plan

Session chính làm từng task, không giao implementer và không có reviewer từng task. Giữ lại những gì làm cho vòng task có
giá trị: brief làm nguồn sự thật, ledger làm trí nhớ, test đỏ rồi xanh làm cổng của từng task, commit từng task và một lần
review cuối.

## Khi nào dùng

- Người dùng nói rõ trong yêu cầu rằng muốn chạy inline hoặc không dùng subagent; hoặc
- session không có tool subagent. Không bịa lệnh giao việc: chạy plan tại chỗ.

Không hỏi người dùng chọn cách thực thi. Plan đã duyệt thì mặc định là vòng task có subagent (`AGENTS.md`, mục Workflow
defaults); inline chỉ bật theo một trong hai điều kiện trên.

Dòng đầu tiên sau tiêu đề ledger: `Ruling: thực thi inline — <người dùng chọn | không có tool subagent> — <chi phí nếu sai>`.

## Vòng một task

1. Ghi BASE bằng `git rev-parse HEAD`; cắt brief bằng `scripts/task-brief.mjs`; chỉ đọc brief của task này.
2. Làm theo step trong brief: task TDD `có` thì test đỏ (chạy, thấy đỏ đúng lý do) → code → test xanh; task `không` thì
   làm theo step của brief. Chỉ task `DOCS`/`TOOLING` thuộc diện `không` (không có test sản phẩm) mới dùng lệnh kiểm
   chứng ghi trong task thay cho test.
3. Chạy lệnh test hẹp của task, đọc đủ output và exit code. Không chạy full suite ở từng task.
4. Commit qua `git-workflow`, một task ít nhất một commit. Task TDD `có`: commit test đỏ riêng trước (`test(<scope>): …`), rồi commit code xanh. Hook pre-commit của repo chặn commit đỏ thì ghi `Ruling:` (nêu hook chặn) và gộp thành một commit; bằng chứng đỏ vẫn ghi vào dòng ledger ở bước 6.
5. Vì không có review từng task, sau commit tự đối chiếu `git diff --name-only <BASE>..HEAD` với `**Files:**` của task: file
   ngoài danh sách là lệch plan, sửa bằng một commit mới (không amend) hoặc ghi `Ruling:`.
6. Ghi ledger:
   `node <thư mục skill plan-execution>/scripts/ledger.mjs <plan.md> "Task <n>: complete (commits <a>..<b>, inline, tests: <lệnh> exit 0)"`.
   Task TDD `có` ghi thêm bằng chứng đỏ ngay trước `tests:`: `red: <lệnh> exit <n khác 0>, tests: <lệnh> exit 0`.
   `ledger.mjs` từ chối (exit 2, không ghi) dòng inline thiếu `tests: <lệnh> exit 0` hoặc kèm exit khác 0, và dòng có
   `red: … exit 0`. `ledger.mjs` đọc task trong plan và từ chối (exit 2) dòng inline thiếu `red: <lệnh> exit <n khác 0>` của task TDD `có`.
   Plan không đọc được hoặc task không có trong plan thì script không kiểm được `red:`: session chính tự kiểm dòng đã có
   `red:` trước khi ghi. Kiểm này chỉ chặn việc quên điền hay ghi sai định dạng,
   không xác minh được exit code thật; lệnh test pass mà không in gì vẫn hợp lệ vì bằng chứng là exit code, không phải
   output.

Lỗi tự phát hiện trong lúc làm thì sửa ngay trong task đó. Chỉ ghi `Ruling:` khi quyết định lệch khỏi plan; lệch plan mà
không ghi là quyết định bí mật. Chạy liên tục giữa các task; chỉ dừng hỏi người dùng ở năm loại dừng của `task-loop.md`.

## Review cuối

- **Có tool subagent** (người dùng chọn inline): giao review toàn nhánh cho subagent mới theo `prompts/final-review.md`
  (model opus) cùng `engineering-quality-auditor`; một lần sửa và một re-review có phạm vi như vòng task thường.
- **Không có tool subagent**: session chính tự review theo `prompts/final-review.md`, đọc diff qua
  `scripts/review-package.mjs <base> <head> --plan <plan.md>` thay vì dựa vào trí nhớ. Ghi `Ruling: review cuối là tự review — không có tool subagent —
  không có góc nhìn thứ hai` vào ledger và đưa mục này vào `remaining_risks` khi trình người dùng. Finding `blocker`/`major`
  tự tìm ra thì sửa một lượt rồi tự đọc lại đúng phần diff vừa sửa; không có làn sửa thứ hai.

Sau đó kết thúc nhánh theo `finish.md` như thường: full suite một lần, ba lựa chọn, `Plan: complete`.

## Ranh giới

- Inline bỏ review từng task, không bỏ ranh giới an toàn: vẫn chỉ làm trên nhánh `feature/<slug>`, vẫn không push hay merge
  khi người dùng chưa chọn, vẫn không `Co-authored-by`.
- Không tự nâng một task lên `complete` khi chưa có lệnh test chạy trong lượt này.
