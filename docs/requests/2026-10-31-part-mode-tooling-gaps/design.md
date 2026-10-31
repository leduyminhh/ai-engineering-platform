# Thiết kế: vá lỗ hổng TOOLING/ledger/review cuối của chế độ part từ lượt thử 2
- Ngày: 2026-10-31
- Trạng thái: in-progress — Task 1–3 complete, review cuối xong (1 major đã sửa ở ddb7341); câu chữ AC2.5 người dùng chốt 2026-10-31 (BE không ở chế độ inline); kết quả thử ở trial-3.md
- Requirement: không có
## Vấn đề và lý do
Lượt thử 2 (`text-format`, repo `E:\Mine\AI\aip-parts-trial`) chạy trọn chế độ part nhưng lộ các chỗ phải tự chế:
1. Hook `session-start` nạp ledger `root/` của request khác vào phiên part (ledger part chưa tồn tại lúc mở phiên). Đã vá ở `4f50815` (core 1.22.6) nhưng chưa kiểm bằng phiên part thật và spec `hooks-gates/R11` chưa cập nhật.
2. Task `TOOLING` TDD `có` do session chính làm:
   - không có mẫu dòng `complete` khi task có reviewer (`task-loop.md` bước 9 trỏ sang mẫu `inline`); `review clean` mâu thuẫn khi còn `minor (deferred)`;
   - reviewer `general-purpose` "nạp skill review phù hợp" nhưng không có skill nào hợp, và không có `agent_result`/`tdd` để đối chiếu;
   - test và code nằm chung một commit nên reviewer không kiểm được thứ tự đỏ → xanh (`declined_to_judge`);
   - `ledger.mjs` chỉ kiểm `red:` khi dòng có chữ `inline`; thiếu `red:` ở task TDD `có` không bị từ chối.
3. Review cuối (`final-review.md`) chỉ gọi `backend-reviewer`/`frontend-reviewer`; diff Node thuần/tooling không có reviewer nào hợp.
4. Vòng sửa của review cuối thêm AC mới (người dùng chốt từ `questions[]`) nhưng giao thức không nói task phủ AC đó đặt ở đâu; `check-request.mjs` báo W6.
5. Mở phiên part ở thư mục worktree mới: app đòi trust thư mục; khối bàn giao không nhắc.
## Quyết định đã chốt
- (1) Không đổi code hook; kiểm ở lượt thử 3 với core đã cài từ nhánh này; cập nhật `hooks-gates/R11` cho khớp `4f50815`.
- (2a) `task-loop.md` bước 9: mẫu dòng `complete` cho task do session chính làm (TOOLING, inline) có TDD `có`: `Task <n>: complete (commits <a>..<b>, review clean|<k> ruled, red: <lệnh> exit <n khác 0>, tests: <lệnh> exit 0)`. `review clean` = không còn finding `blocker`/`major` mở; các dòng `minor (deferred)` của task đứng trước dòng `complete`.
- (2b) Task `TOOLING`: session chính ghi báo cáo task dạng `agent_result` (có `tdd.red`/`tdd.green`, file đổi, lệnh test) vào `.aip/runs/<request>/<part>/task-<n>-report.md` và đưa đường dẫn cho reviewer; reviewer `general-purpose` không nạp skill domain, tiêu chí là `prompts/task-review.md`.
- (2c) Task do session chính làm có TDD `có`: commit test đỏ riêng trước (`test(<scope>): …`), rồi commit code xanh; reviewer kiểm thứ tự bằng hai commit trong review package. Repo có hook pre-commit chặn commit đỏ thì ghi `Ruling:` và quay về một commit kèm bằng chứng ledger.
- (2d) `ledger.mjs <plan.md> "<dòng>"`: dòng `Task <n>: complete` của task có TDD hiệu lực `có` (dùng `extractTask`/`effectiveTdd` của `task-brief.mjs`) và kind `TOOLING` hoặc dòng có chữ `inline` mà thiếu `red: <lệnh> exit <n>` thì từ chối (exit 2, không ghi). Task không tìm thấy trong plan thì giữ kiểm cũ.
- (3) `final-review.md`: diff không chạm phía backend hay frontend (tooling, script, docs) thì reviewer là `general-purpose` với `model: opus`, cùng mẫu prompt.
- (4) `final-review.md`: AC mới do người dùng chốt trong vòng sửa thì người dùng duyệt câu AC trong `design.md`, session chính thêm `### Task <n>` sửa vào plan gốc (`**Phủ AC:**`, `**Files:**`), một lần dispatch sửa phủ cả task đó.
- (5) `task-loop.md` bước 6: khối bàn giao nhắc người dùng lần đầu mở phiên ở thư mục worktree mới có thể phải trust thư mục.
## Tiêu chí chấp nhận
- [x] **AC1.1** — Given core cài từ nhánh này ở scope user When mở phiên part thật trong worktree `<slug>-p<nn>` có plan part mà ledger của part chưa có, và có ledger `root/` dở của request khác Then hook `session-start` không nạp ledger nào
- [x] **AC2.1** — Given task `TOOLING` TDD `có` do session chính làm When đọc `task-loop.md` bước 9 Then có mẫu dòng `complete` gồm `review clean|<k> ruled`, `red:` và `tests:`, và định nghĩa `review clean` khi còn minor
- [x] **AC2.2** — Given task `TOOLING` When session chính giao task review Then `task-loop.md` bảo ghi `task-<n>-report.md` dạng `agent_result` có `tdd.red`/`tdd.green` và reviewer `general-purpose` không nạp skill domain
- [x] **AC2.3** — Given task do session chính làm có TDD `có` When commit Then `task-loop.md` và `inline.md` đòi commit test đỏ riêng trước commit code, kèm lối thoát khi hook pre-commit chặn
- [x] **AC2.4** — Given plan có task kind `TOOLING` TDD `có` When `ledger.mjs` ghi dòng `Task <n>: complete` thiếu `red:` Then exit 2 và không ghi
- [x] **AC2.5** — Given task TDD `không` hoặc kind `BE` không ở chế độ inline, hoặc số task không có trong plan When `ledger.mjs` ghi dòng `complete` không có `red:` Then ghi như cũ (exit 0)
- [x] **AC3.1** — Given diff toàn nhánh không chạm backend hay frontend When chuẩn bị review cuối Then `final-review.md` chỉ định `general-purpose` với `model: opus`
- [x] **AC4.1** — Given vòng sửa review cuối thêm AC mới When chuẩn bị dispatch sửa Then `final-review.md` bảo thêm `### Task` sửa có `**Phủ AC:**` vào plan gốc
- [x] **AC5.1** — Given khối bàn giao phiên part When session gốc soạn ở bước 6 Then có dòng nhắc trust thư mục worktree
- [x] **AC6.1** — Given request thử 3 part (01, 02 song song; 03 phụ thuộc 01 qua Interfaces) When chạy chế độ part trên `aip-parts-trial` với core từ nhánh này Then cả 3 part `merged <hash>`, review cuối chạy xong, và không phải tự chế mẫu dòng `complete`/báo cáo TOOLING
## Thiết kế
- `ledger.mjs`: `main` đã có `planArg`; đọc plan, `extractTask(plan, n)` với `n` từ `Task <n>: complete`, `effectiveTdd`; kind lấy bằng `taskField(task, 'Kind')` (export thêm từ `task-brief.mjs` nếu chưa export). `validateLine(line, ctx)` nhận thêm `{ tdd, kind }` tuỳ chọn; thiếu ctx thì hành vi cũ.
- Các mục (2a)(2b)(2c)(3)(4)(5) là câu chữ trong `core/skills/plan-execution/references/task-loop.md`, `inline.md`, `prompts/final-review.md`.
## Ảnh hưởng spec
- hooks-gates: đổi R11
- workflows: đổi R7
- workflows: đổi R12
- workflows: đổi R14
## Ngoài phạm vi và anti-goal
- Không đổi luồng `BE` (agent không commit; `tdd` vẫn trong `agent_result`).
- Không thêm skill review riêng cho TOOLING.
- Không pin câu chữ (2a)(2b)(2c)(3)(4)(5) bằng test: văn xuôi, quy tắc Testing không pin; kiểm ở lượt thử 3.
- Không xử lý `status: done` ngoài contract của reviewer/auditor và thiếu `.gitattributes` của repo thử.
## Ràng buộc
- Script zero-dependency; bump version `core`, chạy `node cli/lib/versions.mjs --lock`; `npm test` xanh.
## Không đổi
- Dòng `inline` vẫn đòi `tests: <lệnh> exit 0` và từ chối `red: … exit 0` như R12.
- Task kind khác `TOOLING` không ở chế độ inline không bị đòi `red:` trong ledger.
- `ledger.mjs` gọi với plan không đọc được vẫn ghi theo kiểm cũ (không chặn).
## Kiểm thử
- AC2.4, AC2.5: `test/content/32-superpowers-gap.pin.mjs` hoặc module contract của `ledger.mjs` (cùng nơi đang kiểm `validateLine`), một test có tham số.
- AC1.1, AC6.1: lượt thử 3 thực tế trên `aip-parts-trial`; evidence là output hook trong phiên part và ledger.
- AC2.1–AC2.3, AC3.1, AC4.1, AC5.1: đọc lại tài liệu và đối chiếu ở lượt thử 3.
## Để builder quyết
- Tên trường trong `task-<n>-report.md`, miễn khớp `agent_result` của contract.
## Rủi ro và câu hỏi mở
- [Unverified] App desktop đòi trust thư mục worktree là hành vi của Claude Code desktop, có thể khác ở CLI.
- Commit đỏ riêng làm lịch sử có commit test fail; `git bisect` có thể dừng ở đó.
