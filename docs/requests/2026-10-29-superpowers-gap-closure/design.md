# Thiết kế: bổ sung bootstrap, TDD, debug, worktree và thực thi plan inline
- Ngày: 2026-10-29
- Trạng thái: merged — 6821140 (merge local --no-ff vào master ngày 2026-10-29, đã lên origin); eval AC6.1 hoãn theo quyết định của người dùng
- Requirement: không có
## Vấn đề và lý do
So sánh với `superpowers` 7.0.0 (bản cài trên máy) cho thấy `aip` đủ khung quy trình nhưng mỏng ở lớp kỷ luật hành vi:
- Không có bootstrap ép gọi skill khi vào phiên; `session-start` chỉ nạp handoff và ledger. Bản ghi eval ngày 2026-10-23 cho thấy `backend-fix`/`frontend-fix` được gọi 0/3 dù prompt có test đỏ ([Inference] thiếu lớp bootstrap là một nguyên nhân khả dĩ, chưa kiểm).
- TDD chỉ là một bước trong `backend-implement` và trường `tdd.red`/`tdd.green`; không có tài liệu kỷ luật riêng.
- Debug chỉ có trong `workflow-bugfix`; không có skill gọi trực tiếp cho lỗi lạ, test flaky, và không có kỹ thuật bổ trợ.
- Worktree chỉ là quy ước trong `AGENTS.md`, chưa có skill hướng dẫn tạo và dọn.
- Thực thi plan inline (không subagent) chỉ có một đoạn dự phòng trong `task-loop.md`, không có ledger evidence riêng.
## Quyết định đã chốt
- Viết lại nội dung bằng tiếng Việt theo cấu trúc của `aip`; không chép nguyên văn từ superpowers.
- Bootstrap: skill mới `core:using-aip` + `session-start` nạp một đoạn ngắn trỏ tới skill đó. Cấu hình `bootstrapInject` trong `aip-gate.json` (mặc định bật, `false` tắt).
- Thực thi inline: mở rộng `plan-execution` (một `references/inline.md`), không tạo skill mới. Inline chỉ bật khi người dùng nói rõ trong yêu cầu hoặc khi không có tool subagent; không bao giờ hỏi lại cách thực thi (khớp `AGENTS.md` mục Workflow defaults).
- TDD và debug: hai skill mới trong plugin `engineering` (`engineering-tdd`, `engineering-debugging`), theo quy ước skill xuyên suốt vào `engineering`.
- Worktree: skill mới `core:git-worktree`, vì thuộc vòng đời git và quy ước nằm trong baseline của core.
- Skill `runsIn: execute` không vào `_cowork.json` (Cowork không có subagent và không chạy shell).
## Thiết kế
**Bootstrap.** `core/skills/using-aip/SKILL.md` (≤ 80 dòng): quy tắc "có khả năng một skill áp dụng thì gọi skill trước khi trả lời hoặc hành động", thứ tự ưu tiên (yêu cầu người dùng > quy tắc project > skill > mặc định), dòng `SUBAGENT-STOP` cho agent worker, bảng dấu hiệu tự biện minh ("đây chỉ là câu hỏi đơn giản", "để tôi xem code trước"…) kèm cách xử lý. `session-start.mjs` thêm hằng văn bản bootstrap ≤ 1200 ký tự (chép nhỏ, không import từ thư mục skill, theo chú thích sẵn có của hook), đặt trước handoff và ledger, trừ phần của nó khỏi `MAX_TOTAL`. Không nạp khi `source` là `resume`/`fork`. Hook chỉ có ở plugin mode; ở skills mode `description` của skill (có cụm "bắt đầu mọi hội thoại") là đường duy nhất.
**Thực thi inline.** `references/inline.md`: khi nào dùng (người dùng chọn inline hoặc không có tool subagent; không bịa lệnh giao việc), vòng một task do session chính làm (BASE → brief → test đỏ → code → test xanh → commit → ghi ledger), thay review từng task bằng một lần review cuối bởi subagent mới nếu có tool, ngược lại tự review bằng `prompts/final-review.md` và ghi "tự review" vào ledger. Dòng ledger inline: `Task <n>: complete (commits <a>..<b>, inline, tests: <lệnh> exit 0)`. `ledger.mjs` thêm hàm `validateLine`: dòng `Task <n>: complete` có chữ `inline` mà thiếu `tests: … exit 0` bị từ chối (exit 2, không ghi). Dòng khác giữ nguyên.
**TDD.** `engineering-tdd`: luật "không code production khi chưa có test đỏ đúng lý do", chu trình đỏ → xanh → refactor, bảng biện minh, các anti-pattern (chỉ assert mock vừa cấu hình, test theo chi tiết cài đặt), và ranh giới với quy tắc Testing của `AGENTS.md`: một hành vi một test ở tầng thấp nhất, không tăng số test chỉ để "đủ". `backend-implement` bước 3 và `frontend-testing` trỏ tới skill (không phải `frontend-implement`: skill đó cấm sinh test nghiệp vụ và chuỗi FE-UI là implementer rồi test-writer); định dạng `tdd.red`/`tdd.green` của contract đầu ra không đổi.
**Debug.** `engineering-debugging`: bốn pha (điều tra nguyên nhân gốc, so sánh mẫu, giả thuyết và kiểm, sửa), cùng bốn tài liệu bổ trợ trong `references/`: truy vết ngược nguyên nhân gốc, phòng thủ nhiều lớp, chờ theo điều kiện (không `sleep` cố định, khớp `AGENTS.md`), tìm test gây ô nhiễm (mô tả quy trình bằng `git bisect`-kiểu chia đôi, không thêm script). `workflow-bugfix` Bước 4–5 trỏ tới skill; cạnh graph và trần 3 lần sửa không đổi. Orchestrator thêm một dòng vào bảng "Yêu cầu chạy trực tiếp bằng skill": lỗi chưa rõ nguyên nhân, test flaky, lỗi lạ → `engineering-debugging`.
**Worktree.** `git-worktree`: kiểm trước (thư mục `.claude/worktrees/` đã bị git bỏ qua, nhánh tích hợp sạch, baseline test xanh trong worktree mới), tạo theo quy ước `worktree-<slug>-t<n>` trong `.claude/worktrees/<slug>-t<n>/` cắt từ tip nhánh tích hợp, dọn bằng `git worktree remove` chỉ khi đã merge và sạch, cảnh báo junction trên Windows (không `rm -rf`), dọn bằng `fs.rmSync` của Node khi cần. Không thêm script.
**Chiếu và phát hành.** Bump version `core`, `engineering`, `backend`, `frontend`, `workflows`; `node cli/lib/versions.mjs --lock`; cập nhật mô tả và số skill trong manifest, `CLAUDE.md`, README cặp EN/VI.
## Ảnh hưởng spec
- hooks-gates: thêm R12
- workflows: thêm R12, thêm R13
## Ngoài phạm vi và anti-goal
- Không thêm visual companion, `diagnosing-superpowers`, `receiving-code-review`, hay hỗ trợ harness mới.
- Không đổi contract đầu ra (`agent_result`, `tdd`, `rulings`) và không đổi cạnh, `max_attempts`, gate trong `graph.json` của workflow nào.
- Không tạo script chạy lệnh test thay agent; session chính vẫn tự chạy test và ghi ledger.
- Không ép bootstrap trong skills mode.
## Ràng buộc
- Mô tả skill ≤ 500 ký tự theo mẫu "Dùng khi … Không dùng khi … → id"; không lặp nguyên văn trigger của skill khác; thân skill có đủ `## Quy trình…` và `## Ranh giới an toàn…`.
- Mọi nội dung hướng người dùng bằng tiếng Việt có dấu; nguồn UTF-8 không BOM, LF.
- Hook zero-dependency, fail-open, không ghi file.
- Văn bản bootstrap ≤ 1200 ký tự; tổng `additionalContext` vẫn ≤ 9000 ký tự.
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given `session-start` với `source` là `startup`, `clear` hoặc `compact` và `bootstrapInject` không phải `false`, When hook chạy, Then `additionalContext` mở đầu bằng văn bản bootstrap ≤ 1200 ký tự có chứa `using-aip`, và tổng độ dài vẫn ≤ 9000 khi có cả handoff và ledger.
- [ ] **AC1.2** — Given `bootstrapInject: false`, hoặc `source` là `resume`/`fork`, When hook chạy, Then đầu ra không chứa văn bản bootstrap và hành vi handoff, ledger, cảnh báo nguội giữ nguyên.
- [ ] **AC1.3** — Given skill `using-aip`, When chạy `node test/validate.mjs --build`, Then skill qua mọi contract và thân skill có dòng `SUBAGENT-STOP`, quy tắc thứ tự ưu tiên và bảng dấu hiệu tự biện minh.
- [ ] **AC2.1** — Given `engineering-tdd`, When chạy validate, Then skill qua mọi contract, nêu luật test đỏ trước, bảng biện minh và dẫn chiếu quy tắc "một hành vi một test".
- [ ] **AC2.2** — Given `backend-implement` và `frontend-testing`, When đọc bước viết test, Then mỗi skill trỏ tới `engineering-tdd` và không đổi định dạng `tdd.red`/`tdd.green`.
- [ ] **AC3.1** — Given `engineering-debugging`, When chạy validate, Then skill qua mọi contract, có bốn pha và bốn file `references/` được liên kết từ `SKILL.md`.
- [ ] **AC3.2** — Given `workflow-bugfix` và orchestrator, When chạy validate, Then Bước 4–5 của bugfix trỏ tới skill, orchestrator có dòng định tuyến tới `engineering-debugging`, và `graph.json` vẫn qua `checkGraphAgainstBody` (chỉ thêm id skill vào `run.skills` nếu validator đòi; không đổi cạnh, `max_attempts`, gate).
- [ ] **AC4.1** — Given `git-worktree`, When chạy validate, Then skill qua mọi contract, nêu đúng quy ước tên nhánh và thư mục của `AGENTS.md`, cấm `rm -rf` worktree và chỉ cho `git worktree remove` khi đã merge và sạch.
- [ ] **AC5.1** — Given `plan-execution`, When chạy validate, Then `SKILL.md` liên kết `references/inline.md` và nêu điều kiện bật inline (người dùng nói rõ hoặc không có tool subagent) mà không thêm bước hỏi cách thực thi.
- [ ] **AC5.2** — Given `ledger.mjs`, When ghi dòng `Task <n>: complete (… inline …)` thiếu `tests: … exit 0`, Then exit 2 và ledger không đổi; dòng inline đủ evidence và mọi dòng không phải `complete` inline được ghi như cũ.
- [ ] **AC6.1** — Given các case eval mới, When chạy `node scripts/eval-run.mjs` với trần chi phí, Then kết quả (n, chi phí, Δ và nhãn Δ đo cái gì) được ghi vào `evals/README.md` và `evals/README_VI.md`; không có ngưỡng đạt/trượt.
## Kiểm thử
- AC1.1, AC1.2: `decide()` của `session-start` trong `test/contract/90-hooks.contract.mjs` (tham số hoá theo `source` và cấu hình).
- AC1.3, AC2.1, AC3.1, AC4.1: contract chung hiện có (`10-source`, `40-conventions`, `80-frontmatter`, kiểm link `references/`); phần nội dung đặc thù (dòng `SUBAGENT-STOP`, quy ước tên worktree) gom vào một pin `test/content/32-superpowers-gap.pin.mjs`.
- AC2.2, AC3.2, AC5.1: cùng pin đó (mục dẫn chiếu giữa các tài liệu); `graph.json` do `50-workflows.contract.mjs` kiểm.
- AC5.2: unit test `validateLine` trong `test/content/32-superpowers-gap.pin.mjs` (không phải `00-unit.contract.mjs`: file đó tự mô tả là không đọc script core thật, còn pin `31-workflow-self-sufficient` đã có tiền lệ import `ledger.mjs`).
- AC6.1: ba case eval `core/bootstrap-skill-first`, `engineering/tdd-red-first`, `engineering/debugging-root-cause-first`; chạy tay, không nằm trong `npm test`.
## Để builder quyết
- Danh sách chính xác "dấu hiệu tự biện minh" trong `using-aip` (viết theo tình huống thật của dự án, không dịch bảng của superpowers).
- Tên mục trong `inline.md`; có cần ví dụ minh hoạ một task hay không.
## Rủi ro và câu hỏi mở
- [Unverified] `SessionStart` có chạy cho subagent hay không; dòng `SUBAGENT-STOP` là lớp bảo vệ nếu có.
- [Inference] Quy tắc "1% khả năng thì gọi skill" có thể làm tăng số lần gọi skill không cần thiết và tốn token; eval AC6.1 đo tỷ lệ gọi skill trước lần Edit đầu, không đo chất lượng.
- Eval có thể không nạp hook `SessionStart` khi chạy từ đường dẫn; nếu vậy case bootstrap chỉ đo đường `description`.
- `engineering-debugging` chồng lấn với `backend-fix`/`frontend-fix` (áp fix theo oracle) và `workflow-bugfix`; chạy `npm run overlap` và chỉnh mô tả để không lặp trigger.
- Test đếm số skill (`test/install.test.mjs`, `test/wizard.test.mjs`, `test/contract/80-frontmatter.contract.mjs`) có thể đỏ khi thêm skill; sửa con số trong cùng task, không thêm pin mới.
