# Lượt thử 4 — khoá autonomy với core 1.23.0

- Ngày: 2026-10-31
- Core 1.23.0, workflows 3.13.0 (`0239c34` trên `feature/autonomy-gates`), cài plugin scope user bằng `aip update -g`;
  `claude plugin list` báo `core@ai-engineering-platform` 1.23.0. Session gốc dùng script và câu chữ từ cache plugin
  `C:\Users\ldmle\.claude\plugins\cache\ai-engineering-platform\core\1.23.0\skills\plan-execution\`.
- Repo thử: `E:\Mine\AI\aip-parts-trial`, không remote. Nhánh `feature/text-snake-kebab` cắt từ `feature/text-case` `9d0f3e4`.
- `aip autonomy high` trong repo thử: ghi `.claude/aip-gate.json` (không commit); `aip autonomy status` và `autonomy.mjs`
  của bản cài cùng in `{"mergeLocal":true,"cleanup":true,"partRunner":"subagent"}`.
- Request: `docs/requests/2026-10-31-text-snake-kebab/` — 2 part Song song nhóm A, mỗi part 1 task `TOOLING` `**TDD:** có`:
  `01-kebab-case` (`kebabCase`) ∥ `02-snake-case` (`snakeCase`), cả hai Consumes `splitWords`. `check-request`: chỉ W9 trước
  khi chạy, 0 cảnh báo sau cùng; `check-partition`: 0 cảnh báo.
- G1/G2 của request thử: session gốc tự viết design/plan; G2 coi như đã duyệt theo Task 4 của plan này (ghi `Ruling:` ở
  ledger `root/` của repo thử). G3 của request thử cũng coi như đã duyệt theo Step 2 của Task 4; G3 thật là G3 của nhánh aip.

## Diễn biến và hash

| Bước | Ai chạy | Commit | Kiểm chứng |
|---|---|---|---|
| Request + plan | session gốc | `7cf8339` | check-request W9, check-partition 0 |
| Đọc khoá, không hỏi nhóm A ("Chế độ part" bước 3, `subagent`) | session gốc | — | `autonomy.mjs` → `partRunner: subagent` |
| Part 01, 02 `đang làm` + 2 worktree `.claude/worktrees/text-snake-kebab-p0{1,2}` | session gốc | `cb3cc52` | — |
| Part 01: test đỏ / code | subagent nền `general-purpose` sonnet trong worktree p01 | `f450f67` / `fda1cce` | `npm test` exit 1 (ERR_MODULE_NOT_FOUND) / exit 0 (27 pass) |
| Part 02: test đỏ / code | subagent nền `general-purpose` sonnet trong worktree p02 (chạy song song với p01) | `074c717` / `dddaabd` | `npm test` exit 1 / exit 0 (27 pass) |
| Merge part 01 + Bảng part | session gốc | `8837165`, `815bed1` | `npm test` exit 0 |
| Merge part 02 + Bảng part | session gốc | `ae57041`, `02ea06e` | `npm test` exit 0 (29 pass) |
| Gỡ worktree p01, p02 (bước 10, `cleanup: true`, không hỏi) | session gốc | — | `git worktree remove` sạch |
| Review cuối `9d0f3e4..02ea06e` | `general-purpose` opus | — | approve, 0 blocker/major, 3 nit |
| AC đạt | session gốc | `a5808c7` | check-request 0, `npm test` exit 0 (29 pass) |
| Merge local vào `feature/text-case` (`mergeLocal: true`) | session gốc | `89f3652` | `npm test` exit 0 (29 pass) trên kết quả merge |
| Commit docs trên nhánh gốc: `merged 89f3652`, xoá `plan.md` + `parts/*/plan.md` | session gốc | `a4f0735` | check-request chạy lại: 0 cảnh báo |
| Dọn (`cleanup: true`): `git branch -d` 3 nhánh đã là tổ tiên của `feature/text-case` | session gốc | — | `feature/text-snake-kebab`, `worktree-text-snake-kebab-p01`, `-p02` đã xoá |

Ledger repo thử `E:\Mine\AI\aip-parts-trial\.aip\runs\2026-10-31-text-snake-kebab\`:

- `root/`: 3 `Ruling:` (G2 coi như duyệt; review cuối bỏ auditor; G3 coi như duyệt), `Part 01: merged 8837165…`,
  `Part 02: merged ae57041…`, `Plan: complete`.
- `01-kebab-case/`: `Ruling: thực thi inline — subagent part — …`,
  `Task 1: complete (commits f450f67..fda1cce, inline, red: npm test exit 1, tests: npm test exit 0)`, `Part: complete fda1cce…` (hash đầy đủ).
- `02-snake-case/`: cùng mẫu, `Task 1: complete (commits 074c717..dddaabd, …)`, `Part: complete dddaabd` (hash ngắn).

## Số lần dừng chờ người dùng

Từ G2 tới G3 của request thử: **0** câu hỏi cho người dùng. Không có câu hỏi trước nhóm Song song, không mở phiên, không
trust thư mục, không hỏi merge part, không hỏi dọn worktree, không hỏi merge local hay xoá nhánh. So với lượt thử 3
(15–20 lần quay lại chat mỗi request).

Ngoài luồng: harness Claude Code nhiều lần nhắc "người dùng chưa nghe gì một lúc" và session gốc trả một dòng trạng thái
ngắn. Đó là nhắc của harness, không phải điểm dừng của luồng; câu chữ AC7.1 không ngăn được nhắc này.

## Subagent part: cwd, hook, commit

- cwd: không giữ giữa các lệnh Bash (p01 kiểm `pwd` → về `E:\Mine\AI\ai-engineering-platform`). Cả hai subagent dùng
  `cd <worktree> && …` hoặc `git -C` trong mọi lệnh, đúng câu chữ mới của `inline.md` (đường dẫn tuyệt đối). Không có lệnh
  nào ghi nhầm vào repo khác: diff mỗi nhánh part chỉ có 2 file của task.
- Hook: cả hai subagent không thấy hook nào in hay chặn. [Unverified] Không kiểm được hook plugin có chạy trong subagent
  hay không; guard-files không có `writeScope` cho `general-purpose` nên không có gì để chặn.
- Commit: subagent tự commit trên nhánh part (ngoại lệ "agent không commit"), header tiếng Anh, `commit -F`, không
  `Co-Authored-By` (theo AGENTS.md dù system-reminder của harness yêu cầu thêm).
- Ledger: `ledger.mjs` chạy từ worktree tự đặt ledger part ở gốc repo chính; session gốc đọc `Part: complete` ở đó.
- Thời gian: mỗi part ~40–45 giây, hai part chạy song song.

## Vướng còn lại

- V1 (minor): `inline.md` nói `Ruling: thực thi inline …` là "dòng đầu tiên sau tiêu đề ledger", nhưng mục Subagent part không
  bảo tạo tiêu đề; cả hai ledger part bắt đầu bằng `Ruling:`.
- V2 (minor): `Part: complete <hash>` không nói hash đầy đủ hay ngắn; hai subagent ghi khác nhau.
- V3 (minor): chỗ đặt file message cho `commit -F` không được nêu; subagent dùng `/tmp`.
- V4 (minor): sau khi `mergeLocal` xoá `plan.md`, bước "Ghi nhận" của `finish.md` vẫn gọi `ledger.mjs <plan.md gốc>`; đường dẫn
  plan đã xoá vẫn chạy đúng, nhưng session gốc lỡ truyền đường dẫn `progress.md` và ledger rơi vào `.aip/runs/root/root/`
  (đã xoá, ghi lại đúng chỗ). Câu chữ nên nói rõ: dùng đường dẫn plan dù file đã bị xoá.
- V5 (nit): đỏ của test mới là `ERR_MODULE_NOT_FOUND` (task tạo file mới), như lượt thử 3.
- G3 của request thử là giả lập bằng `Ruling:`; phần "người dùng duyệt G3 thật rồi luồng không hỏi thêm" chỉ kiểm được ở
  nửa sau (merge, suite, commit docs, dọn chạy liền không hỏi).

## Đối chiếu AC

| AC | Kết quả | Evidence |
|---|---|---|
| AC1.1 | đạt | `workflow-feature` (mục Checkpoint, đoạn sau bảng) và `plan-execution` (SKILL.md "Điểm dừng và báo cáo", task-loop.md "Báo cáo") nêu đúng G1, G2, G3, câu hỏi push, câu hỏi cách chạy part khi `session`, 6 loại dừng, lỗi chặn. Lượt thử: 0 lần dừng từ G2 tới G3. |
| AC2.1 | đạt (câu chữ) | `workflow-feature` Bước 2 gom mọi câu làm rõ vào một tin nhắn; bảng lỗi "Yêu cầu mơ hồ" cũng gom. Lượt thử bắt đầu từ G2 nên không chạy Bước 2. `engineering-spec-writing` vẫn ghi "hỏi từng câu" (ngoài phạm vi, Bước 2 ghi đè). |
| AC4.1 | đạt | Sau G3 (giả lập), `mergeLocal: true`: merge `89f3652`, `npm test` exit 0 trên kết quả merge, commit docs `a4f0735` đặt `merged 89f3652` và xoá plan, check-request 0 cảnh báo, không hỏi thêm. Nhánh đỏ không chạy (suite xanh). |
| AC5.1 | đạt | `cleanup: true`: chỉ gỡ worktree sạch của request này; `git branch -d` 3 nhánh sau khi `git merge-base --is-ancestor` xác nhận; worktree `text-case-p02` và các nhánh cũ (không thuộc request) giữ nguyên. |
| AC6.1 | đạt | `partRunner: subagent`, `check-partition` 0: không hỏi, tạo worktree theo quy ước `worktree-text-snake-kebab-p0{1,2}`, giao 2 subagent nền theo `inline.md`, merge khi ledger part có `Part: complete`. |
| AC7.1 | đạt (kèm lưu ý) | Session gốc không gửi tin trạng thái khi subagent part xong; chỉ nhắc của harness (xem trên) sinh dòng trạng thái. |
| AC9.1 | đạt | `aip autonomy high` + request 2 part Song song: 0 lần dừng ngoài cổng từ G2 tới G3, cả hai part `merged` qua subagent. |
