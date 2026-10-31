# Chế độ inline — session chính tự thực thi plan

Session chính làm từng task, không giao implementer và không có reviewer từng task. Giữ lại những gì làm cho vòng task có
giá trị: brief làm nguồn sự thật, ledger làm trí nhớ, test đỏ rồi xanh làm cổng của từng task, commit từng task và một lần
review cuối.

## Khi nào dùng

- Người dùng nói rõ trong yêu cầu rằng muốn chạy inline hoặc không dùng subagent; hoặc
- session không có tool subagent. Không bịa lệnh giao việc: chạy plan tại chỗ.

Không hỏi người dùng chọn cách thực thi. Plan đã duyệt thì mặc định là vòng task có subagent (`AGENTS.md`, mục Workflow
defaults); inline chỉ bật theo một trong hai điều kiện trên. Subagent part do `partRunner: subagent` giao là trường hợp
riêng, xem mục "Subagent part".

Dòng đầu tiên sau tiêu đề ledger: `Ruling: thực thi inline — <người dùng chọn | không có tool subagent | subagent part> — <chi phí nếu sai>`.

## Vòng một task

1. Ghi BASE bằng `git rev-parse HEAD`; cắt brief bằng `scripts/task-brief.mjs`; chỉ đọc brief của task này.
2. Làm theo step trong brief: task TDD `có` thì test đỏ (chạy, thấy đỏ đúng lý do) → code → test xanh; task `không` thì
   làm theo step của brief. Chỉ task `DOCS`/`TOOLING` thuộc diện `không` (không có test sản phẩm) mới dùng lệnh kiểm
   chứng ghi trong task thay cho test.
3. Chạy lệnh test hẹp của task, đọc đủ output và exit code. Không chạy full suite ở từng task.
4. Commit qua `git-workflow`, một task ít nhất một commit. Task TDD `có`: commit test đỏ riêng trước
   (`test(<scope>): …`, chỉ stage file test), rồi commit code xanh. Hook pre-commit của repo chặn commit đỏ thì ghi `Ruling:` (nêu hook chặn) và gộp thành một commit; bằng chứng đỏ vẫn ghi vào dòng ledger ở bước 6.
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
không ghi là quyết định bí mật. Chạy liên tục giữa các task; chỉ dừng hỏi người dùng ở sáu loại dừng của `task-loop.md`.

## Review cuối

- **Có tool subagent** (người dùng chọn inline): giao review toàn nhánh cho subagent mới theo `prompts/final-review.md`
  (model opus) cùng `engineering-quality-auditor`; một lần sửa và một re-review có phạm vi như vòng task thường.
- **Không có tool subagent**: session chính tự review theo `prompts/final-review.md`, đọc diff qua
  `scripts/review-package.mjs <base> <head> --plan <plan.md>` thay vì dựa vào trí nhớ. Ghi `Ruling: review cuối là tự review — không có tool subagent —
  không có góc nhìn thứ hai` vào ledger và đưa mục này vào `remaining_risks` khi trình người dùng. Finding `blocker`/`major`
  tự tìm ra thì sửa một lượt rồi tự đọc lại đúng phần diff vừa sửa; không có làn sửa thứ hai.

Sau đó kết thúc nhánh theo `finish.md` như thường: full suite một lần, G3 (rẽ theo khoá `mergeLocal`), `Plan: complete`.

## Subagent part

Với `partRunner: subagent` (`task-loop.md`, "Chế độ part" bước 3), mỗi part do một subagent nền (`general-purpose`,
`model: sonnet`) làm theo "Vòng một task" của file này, chỉ cho plan của part mình, đóng vai session của part:

- Code, test và commit chỉ trong worktree `.claude/worktrees/<slug>-p<nn>/`, trên nhánh `worktree-<slug>-p<nn>`. Mọi lệnh dùng
  đường dẫn tuyệt đối hoặc `git -C <worktree>`, vì cwd có thể bị reset giữa các lệnh Bash. Dùng plan của part
  `parts/<nn>-<part-slug>/plan.md` cho `ledger.mjs`, `task-brief.mjs`, `review-package.mjs --plan`; ba script tự đặt ledger,
  brief và review package ở gốc repo chính, đó là chỗ đúng, không phải ghi ra ngoài worktree.
- Trước dòng `Ruling:` đầu tiên, tạo tiêu đề ledger part:
  `node <thư mục skill plan-execution>/scripts/ledger.mjs <plan part> "# Ledger — plan: <đường dẫn plan part>"`.
- Tự commit từng task trên nhánh part qua `git-workflow`: đây là ngoại lệ của luật "agent không commit". Không push, không merge.
  File message cho `git commit -F` đặt trong scratchpad hoặc thư mục tạm của phiên, không đặt trong worktree (file lạ
  trong worktree làm cây bẩn và cản dọn worktree).
- Không cần `task-<n>-report.md`: dòng ledger inline (bước 6, có `tests:` và `red:` khi TDD `có`) là bằng chứng của task.
- Không review từng task (subagent không gọi được agent khác) và không review cuối; lỗi do review cuối toàn nhánh của session gốc bắt.
- Không sửa `design.md` gốc hay Bảng part. Gặp loại dừng của `task-loop.md` thì trả `blocked` kèm `questions[]` thay vì tự quyết.
- Xong thì ghi `Part: complete <hash>` vào ledger của part, với `<hash>` là hash đầy đủ của HEAD nhánh part sau commit task
  cuối (`git -C <worktree> rev-parse HEAD`); session gốc merge khi thấy dòng đó.

## Ranh giới

- Inline bỏ review từng task, không bỏ ranh giới an toàn: vẫn chỉ làm trên nhánh `feature/<slug>` (subagent part: nhánh
  part của nó), vẫn không push hay merge khi người dùng chưa chọn, vẫn không `Co-authored-by`.
- Không tự nâng một task lên `complete` khi chưa có lệnh test chạy trong lượt này.
