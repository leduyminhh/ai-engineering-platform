# Thiết kế: luôn hỏi cách thực thi plan, nhớ câu trả lời làm gợi ý
- Ngày: 2026-11-11
- Trạng thái: approved — G1 duyệt 2026-11-11
- Requirement: không có

## Vấn đề và lý do

Đã đọc trong code (mọi mô tả "hiện tại" dựa vào các điểm này):
- Plan không chia part luôn chạy vòng task bằng subagent và bị cấm hỏi cách chạy: `core/skills/plan-execution/references/inline.md:12`
  ("Không hỏi người dùng chọn cách thực thi"), hàng "Chế độ inline" trong bảng "Ai làm gì" của `core/skills/plan-execution/SKILL.md`,
  `CLAUDE.md:90` và `AGENTS.md:152` (cùng `core/agents/AGENTS.template.md:152`, "do not ask again how to execute"). Pin
  `test/content/32-superpowers-gap.pin.mjs:21` (AC5.1) khoá câu đó.
- Plan chia part rẽ theo `autonomy.partRunner` ở `references/task-loop.md`, mục "Chế độ part" bước 3: `session` (mặc định, thiếu khoá) hỏi
  trước mỗi nhóm Song song; `sequential` và `subagent` không hỏi. `cli/lib/autonomy.mjs` chỉ cho `aip autonomy high` đặt `subagent`
  (cùng `mergeLocal`, `cleanup`). Khoá `subagent` đồng thời là sự đồng ý tạo worktree và `merge --no-ff` nhánh part.
- `core/skills/plan-execution/scripts/autonomy.mjs` chỉ đọc khoá, không có cách ghi. Hook `guard-files.mjs` (Write/Edit) và `guard-bash.mjs`
  (lệnh có tên `aip-gate.json` kèm dấu hiệu ghi) đều trả `ask` khi ghi `.claude/aip-gate.json`; lệnh không nêu tên file thì không bị
  `guard-bash` bắt, và tiến trình con tự ghi file thì hook không thấy.
- Có design nháp cũ cùng chủ đề: `docs/requests/2026-11-03-execution-mode-choice/design.md` (draft, chưa triển khai: không có
  `prompts/part-review.md`, không nhánh). R1–R4 của nó trùng ý định ở đây nhưng khác chỗ hỏi (gộp vào thẻ G2, ghi ledger) và không có
  chỗ lưu câu trả lời; R5 của nó (review part trước merge) không thuộc request này.

Yêu cầu của người dùng (qua session gốc, 2026-11-11): mọi lần thực thi plan, chia part hay không, đều hỏi cách chạy; câu trả lời ghi vào
`.claude/aip-gate.json` và lần sau hiện làm lựa chọn đầu tiên (gợi ý), không bỏ qua câu hỏi.

[Inference] Không làm thì người dùng không chọn được cách chạy theo từng lần, và `aip autonomy high` vẫn là công tắc tắt câu hỏi cách
chạy chung với `mergeLocal`/`cleanup`, hai thứ có tính chất khác (an toàn tác động ngoài repo, không phải sở thích).

## Quyết định đã chốt

Người dùng chốt (không hỏi lại):
- **R1** — Hỏi mỗi lần, lưu câu trả lời làm gợi ý (lựa chọn đứng đầu), không bỏ qua câu hỏi.
- **R2** — Plan không chia part: hai lựa chọn, subagent + review từng task (vòng task hiện tại) và inline (`inline.md`).

*Quyết định của agent* (người dùng chưa xét riêng; soát và đảo được ở G1):
- **A1** — Chỗ hỏi: bước Chuẩn bị của `plan-execution`, một thẻ "Cách thực thi" ngay sau khi ledger được tạo, trước `Task 1: start`.
  Không hỏi ở G2 (khác R1 của design nháp cũ): `plan-execution` cũng được gọi thẳng và cỡ "thay đổi nhỏ" không có G2, nên chỉ có một chỗ hỏi.
- **A2** — Hai khoá trong `autonomy`: `planRunner` mới (`subagent` | `inline`, mặc định `subagent`) và `partRunner` giữ (`subagent` |
  `session` | `sequential`, mặc định `session`). Cả hai chỉ đặt lựa chọn đứng đầu (nhãn "(Recommended)" theo `ask-user.md`); không khoá nào
  làm bỏ qua câu hỏi. `mergeLocal`, `cleanup` giữ nguyên nghĩa.
- **A3** — Hai câu hỏi, hai tầm áp. `planRunner`: một lần cho mỗi lần thực thi, áp cho việc chạy trong session gốc (plan gốc, part
  tuần tự, nhóm Song song mà người dùng chọn `sequential`). `partRunner`: trước mỗi nhóm Song song (bước 3 "Chế độ part" hiện có) với ba
  lựa chọn; nhóm bị `check-partition.mjs` báo P1/P2/P4 không hỏi, chạy tuần tự. Phiên part và subagent part không hỏi (khối bàn giao
  và `inline.md` "Subagent part" đã định sẵn cách chạy của chúng).
- **A4** — Câu trả lời của nhóm Song song `subagent` hoặc `session` vẫn là sự đồng ý tạo worktree và `merge --no-ff` nhánh part vào
  `feature/<slug>` (merge local), thay vai trò khoá `subagent` hiện nay. Push và merge vào nhánh gốc vẫn chỉ ở bước kết thúc nhánh.
- **A5** — Không hỏi trong hai trường hợp, vì đã có câu trả lời: (a) không có tool subagent (chỉ còn inline); (b) người dùng đã nói rõ
  trong yêu cầu chạy inline hoặc không dùng subagent (điều kiện bật inline sẵn có). Cả hai ghi `Ruling:` và vẫn lưu gợi ý.
- **A6** — Dòng `Ruling:` ghi vào ledger `root/` trước `Task 1: start`: `Ruling: cách chạy <subagent|inline> — <người dùng chọn |
  không có tool subagent | người dùng nói rõ> — <chi phí nếu sai>` (đúng mẫu ba phần của `Ruling:`; thay dòng `Ruling: thực thi inline`
  ở `inline.md:16`). Làm tiếp từ ledger đã có dòng này (grep cả ledger `root/`, hook chỉ chèn 2000 ký tự cuối) thì không hỏi lại: đó là
  cùng một lần thực thi. Câu hỏi nhóm Song song không có dòng riêng.
- **A7** — Lưu gợi ý bằng `node <thư mục skill plan-execution>/scripts/autonomy.mjs --set <khoá>=<giá trị>` (không thêm lệnh `aip`).
  Script chỉ nhận `planRunner` và `partRunner`; ghi `autonomy.<khoá>`, giữ mọi khoá khác. Lý do: hook hỏi người dùng khi agent ghi
  `aip-gate.json` bằng Write/Edit hoặc lệnh có tên file, và hộp thoại xác nhận mỗi câu trả lời phá mục tiêu "nhớ lần sau"; script chỉ
  ghi hai khoá sở thích, không thể nâng `mergeLocal`/`cleanup`/`mode`, nên không mở lỗ hổng mà hook chặn. Không sửa hook.
- **A8** — Nơi ghi: file hiệu lực mà `resolveAutonomy` đọc (file của worktree nếu có, không thì file repo chính); chưa có file nào thì
  tạo ở gốc repo chính (sống sót khi worktree bị dọn). File được git theo dõi hoặc không xác định được trạng thái git: không ghi,
  in một dòng lý do, exit 0 (cùng luật bỏ qua khoá `autonomy` hiện nay; ghi vào file đã theo dõi còn làm bẩn cây). File hỏng: exit 1,
  không ghi. Giá trị trùng giá trị đang có: không ghi.
- **A9** — `aip autonomy high` không đổi dữ liệu ghi (`mergeLocal`, `cleanup`, `partRunner: subagent`; `partRunner` giờ là gợi ý);
  chỉ sửa chữ mô tả (`cli/index.mjs` help, dòng cuối thông báo `high`: nêu cách chạy vẫn hỏi mỗi lần). `aip autonomy status` in thêm
  `planRunner` vì `resolveAutonomy` trả bốn khoá. Không thêm `planRunner` vào `HIGH`.
- **A10** — Đường đã cân nhắc và bị loại: (a) hỏi ở G2 như design nháp cũ (không phủ lối gọi thẳng và cỡ nhỏ); (b) ghi gợi ý bằng
  `aip autonomy set …` (thêm bề mặt CLI; session vẫn phải gọi lệnh, không có lợi hơn script); (c) giữ khoá `subagent`/`sequential` bỏ
  qua câu hỏi (trái R1).
- **A11** — Design nháp cũ `2026-11-03-execution-mode-choice`: đề xuất đặt Trạng thái `abandoned — thay bằng
  2026-11-11-ask-execution-mode` (một dòng); R5 (review part) ghi trong design này là follow-up nếu người dùng còn muốn. Chỉ làm khi G1
  xác nhận.
- **A12** — Môi trường không có công cụ hỏi có lựa chọn (headless, Codex, Cowork) theo quy tắc 4 của `ask-user.md`: in danh sách và dừng
  chờ như mọi cổng khác. `claude -p` không người trả lời: [giả định] builder kiểm `using-aip/references/agents-in-ci.md`; nếu luồng CI
  gọi `plan-execution` thì nêu ở đó rằng CI phải nói rõ cách chạy trong prompt (thành điều kiện A5b).
- **A13** — Version: bump patch `core` (1.32.4 → 1.32.5) và `workflows` (3.15.0 → 3.15.1) vì `workflows/feature/WORKFLOW.md` đổi; thêm `backend` (1.14.1 → 1.14.2) và `frontend` (1.15.1 → 1.15.2) vì `backend-init`/`frontend-init` chép `core/agents/AGENTS.template.md` vào plugin; `node cli/lib/versions.mjs --lock` sau build.

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given `plan-execution` bắt đầu thực thi một plan không có `## Bảng part` (kể cả cỡ "thay đổi nhỏ" không có `plan.md`) When tới bước Chuẩn bị, có tool subagent và người dùng chưa nói rõ cách chạy Then hỏi đúng một câu trước `Task 1: start` bằng công cụ hỏi có lựa chọn với đúng hai lựa chọn "Subagent + review từng task" (`subagent`) và "Inline" (`inline`), lựa chọn theo `planRunner` đứng đầu kèm "(Recommended)" (mặc định Subagent)
- [ ] **AC1.2** — Given `planRunner` là `subagent`, `inline` hoặc thiếu khoá When hỏi Then vẫn hỏi; khoá chỉ đổi thứ tự lựa chọn; `SKILL.md`, `inline.md` và `CLAUDE.md` không còn câu cấm hỏi cách thực thi (kiểm bằng pin nội dung)
- [ ] **AC1.3** — Given session không có tool subagent, hoặc yêu cầu của người dùng nói rõ chạy inline hay không dùng subagent When bước Chuẩn bị Then không hỏi và ghi `Ruling: cách chạy inline — <không có tool subagent | người dùng nói rõ> — …` (kiểm bằng pin nội dung trên `SKILL.md` và `inline.md`)
- [ ] **AC1.4** — Given câu trả lời hoặc A5 đã quyết When ghi ledger Then dòng `Ruling: cách chạy <giá trị> — …` nằm trước `Task 1: start`; Given ledger `root/` đã có dòng `Ruling: cách chạy` ở vị trí bất kỳ When làm tiếp Then không hỏi lại; `ledger.mjs` nhận dòng này (exit 0)
- [ ] **AC1.5** — Given phiên part (khối bàn giao) hoặc subagent part When nạp `plan-execution` Then không hỏi cách chạy; `task-loop.md` và `inline.md` nêu rõ
- [ ] **AC2.1** — Given plan có `## Bảng part` với nhóm Song song không bị P1/P2/P4 When tới nhóm đó Then hỏi một câu với ba lựa chọn "Subagent" / "Phiên riêng" / "Tuần tự trong session gốc" (`subagent` / `session` / `sequential`), lựa chọn theo `partRunner` đứng đầu kèm "(Recommended)"; `partRunner` ở mọi giá trị vẫn hỏi; `task-loop.md` bước 3 không còn nhánh "không hỏi"
- [ ] **AC2.2** — Given nhóm Song song bị `check-partition.mjs` báo P1, P2 hoặc P4 When tới nhóm Then không hỏi, chạy tuần tự
- [ ] **AC2.3** — Given người dùng chọn Subagent hoặc Phiên riêng cho một nhóm When part bắt đầu Then đó là sự đồng ý tạo worktree và `merge --no-ff` nhánh part vào `feature/<slug>`; chọn Tuần tự thì không tạo worktree; `task-loop.md`, `git-worktree/SKILL.md` và `parallel-agents.md` nêu đúng như vậy
- [ ] **AC2.4** — Given plan có part nhưng không nhóm Song song When thực thi Then vẫn hỏi `planRunner` một lần (AC1.1), không hỏi `partRunner`
- [ ] **AC3.1** — Given `autonomy.mjs --set planRunner=inline` (hoặc `partRunner=<giá trị hợp lệ>`) trên file hợp lệ không theo dõi When chạy Then exit 0, file có `autonomy.planRunner = "inline"` và mọi khoá khác (kể cả `mode`, `mergeLocal`) giữ nguyên; chạy lại cùng giá trị không đổi file
- [ ] **AC3.2** — Given khoá không phải `planRunner`/`partRunner` (vd `mergeLocal=true`), giá trị ngoài tập, hoặc cú pháp sai When chạy `--set` Then exit 2, không ghi
- [ ] **AC3.3** — Given file `aip-gate.json` hỏng When `--set` Then exit 1, không ghi; Given file đã được git theo dõi hoặc không xác định được When `--set` Then exit 0, không ghi, in một dòng nêu lý do
- [ ] **AC3.4** — Given worktree không có file và repo chính có file When `--set` chạy trong worktree Then ghi vào file repo chính; Given cả hai không có When `--set` Then tạo `.claude/aip-gate.json` ở gốc repo chính chỉ gồm khoá vừa đặt
- [ ] **AC3.5** — Given lệnh `node <skill>/scripts/autonomy.mjs --set planRunner=inline` When qua `decide` của `guard-bash.mjs` Then không trả `ask`; không sửa hook (kiểm bằng pin; test hook hiện có vẫn xanh)
- [ ] **AC3.6** — Given người dùng trả lời một câu cách chạy (planRunner hoặc partRunner) hoặc A5 áp dụng When session đi tiếp Then session gọi `autonomy.mjs --set` với đúng giá trị đó, kể cả khi trùng gợi ý, và không dùng Write/Edit lên `aip-gate.json` (kiểm bằng pin nội dung trên `SKILL.md` và `task-loop.md`)
- [ ] **AC4.1** — Given `readAutonomy` When đọc Then trả bốn khoá `{ mergeLocal, cleanup, partRunner, planRunner }`, mặc định `{ false, false, "session", "subagent" }`; `planRunner` sai kiểu hoặc ngoài tập chỉ rơi về mặc định của trường đó; khi file đã được theo dõi, bỏ qua cả bốn khoá như hiện nay; `test/content/34-autonomy-gates.pin.mjs` cập nhật theo bốn khoá và vẫn xanh
- [ ] **AC5.1** — Given `aip autonomy high` When chạy Then ghi đúng `{ mergeLocal: true, cleanup: true, partRunner: "subagent" }` như cũ; `status` in thêm `planRunner`; chữ help trong `cli/index.mjs` và dòng cuối thông báo `high` nêu cách chạy vẫn hỏi mỗi lần; `test/mode.test.mjs` xanh
- [ ] **AC6.1** — Given `AGENTS.md`, `core/agents/AGENTS.template.md`, `CLAUDE.md` When sau thay đổi Then không còn "do not ask again how to execute" (so sau khi gộp xuống dòng); hai file baseline vẫn giống hệt nhau và không quá 200 dòng; `CLAUDE.md` và baseline nêu `plan-execution` hỏi cách chạy trước mỗi lần thực thi và nhớ câu trả lời làm gợi ý
- [ ] **AC6.2** — Given `core/skills/plan-execution/SKILL.md`, `references/inline.md`, `references/task-loop.md`, `references/ask-user.md`, `core/skills/git-worktree/SKILL.md`, `references/parallel-agents.md`, `workflows/feature/WORKFLOW.md`, `README.md`, `README_VI.md` When sau thay đổi Then không còn mô tả cũ (khoá `partRunner`/`aip autonomy high` bỏ câu hỏi, "không hỏi người dùng chọn cách thực thi"); `ask-user.md` có hàng "Cách thực thi" và hàng "Cách chạy part" mới; pin 32 AC5.1 đổi theo, không thêm pin song song
- [ ] **AC7.1** — Given bước gộp When cập nhật spec sống Then `docs/specs/workflows/spec.md` có R21 mới và R14 đổi, `docs/specs/hooks-gates/spec.md` R15 đổi, `docs/specs/cli-wizard/spec.md` R6 đổi, `docs/specs/baseline/spec.md` R8 đổi, mỗi mục có dòng trong bảng Lịch sử trỏ tới request này; `check-request.mjs` với `--base master` không báo W10–W14
- [ ] **AC7.2** — Given sau thay đổi When chạy `npm run build`, `node cli/lib/versions.mjs --lock` và `npm test` Then `core` > 1.32.4, `workflows` > 3.15.0, `backend` > 1.14.1, `frontend` > 1.15.1 và `npm test` exit 0

## Thiết kế

### Thẻ "Cách thực thi" (A1–A3, A5, A6)

Bước Chuẩn bị của `plan-execution`, sau khi `ledger.mjs` tạo ledger và `autonomy.mjs` in bốn khoá, theo thứ tự:
1. Grep cả ledger `root/` tìm `^Ruling: cách chạy`; có thì dùng giá trị đó, không hỏi (A6).
2. Không có tool subagent → `inline`, lý do `không có tool subagent`; yêu cầu đã nói rõ inline hoặc không dùng subagent → `inline`, lý do
   `người dùng nói rõ`. Không hỏi (A5).
3. Còn lại: hỏi một câu theo `ask-user.md` (hàng "Cách thực thi"), hai lựa chọn của AC1.1, `planRunner` quyết thứ tự.
4. Ghi dòng `Ruling: cách chạy …` (`ledger.mjs`), rồi lưu gợi ý: `autonomy.mjs --set planRunner=<giá trị>` (A7). Bước 2 cũng lưu.
5. Chạy theo giá trị: `subagent` là vòng task của `task-loop.md`; `inline` là `inline.md`.

Nhóm Song song (bước 3 "Chế độ part" của `task-loop.md`): bỏ ba nhánh rẽ theo khoá, thay bằng một câu ba lựa chọn (hàng "Cách chạy
part" của `ask-user.md`, nêu từng nhánh `worktree-<slug>-p<nn>`, đường dẫn worktree và việc `merge --no-ff`), `partRunner` quyết thứ tự;
sau câu trả lời gọi `autonomy.mjs --set partRunner=<giá trị>`. `subagent` giữ cách giao việc hiện có (subagent nền `general-purpose`,
`model: sonnet`, theo "Subagent part"); `session` giữ khối bàn giao; `sequential` chạy trong session gốc (bước 8) theo `planRunner`.

### Đọc và ghi khoá (A2, A7, A8)

`autonomy.mjs`: `DEFAULTS` thêm `planRunner: 'subagent'`; tập `PLAN_RUNNERS = {subagent, inline}`; `resolveAutonomy` xử lý như ba khoá
còn lại (cùng nhánh `ignored` khi file đã theo dõi). Thêm `--set <khoá>=<giá trị>` vào nhánh `invoked` của file (đã có kiểm
`insidePlugin`); hàm ghi tách riêng để test import, dùng lại `readGateAt`, `trackedByGit`, đường dẫn `main`/`top` của `resolveAutonomy`.
Ghi bằng `JSON.stringify(obj, null, 2) + '\n'`, UTF-8 không BOM, giống `cli/lib/autonomy.mjs`. Không import `cli/` (script skill phải tự đứng).

### Mục đổi (file map)

- `core/skills/plan-execution/scripts/autonomy.mjs`: DEFAULTS, tập giá trị, đọc `planRunner`, `--set`.
- `core/skills/plan-execution/SKILL.md`: bước 1 (Chuẩn bị: thẻ cách thực thi, thay câu "thiếu khoá = hỏi cách chạy part"), mục "Điểm dừng và
  báo cáo", hàng "Chế độ inline" và dòng ngoại lệ merge part ở "Ranh giới an toàn".
- `core/skills/plan-execution/references/task-loop.md`: dòng "Chế độ part" bước 3 và 4, dòng 127, 141–146, 218–221, 234, 243.
- `core/skills/plan-execution/references/inline.md`: "Khi nào dùng" (bỏ câu cấm hỏi, thêm điều kiện người dùng chọn), dòng Ruling đầu ledger, "Subagent part".
- `core/skills/plan-execution/references/ask-user.md`: đoạn mở đầu, hàng "Cách thực thi" mới, sửa hàng "Cách chạy part".
- `core/skills/git-worktree/SKILL.md:21`, `core/skills/git-worktree/references/parallel-agents.md:13`.
- `workflows/feature/WORKFLOW.md`: Bước 5 (dòng 162), dòng 168, đoạn Checkpoint (dòng 246, 255–256).
- `core/agents/AGENTS.template.md` và `AGENTS.md` (byte-identical, chỉ dòng 152–153, đổi tại chỗ, không thêm dòng), `CLAUDE.md:90`.
- `cli/index.mjs:249–251` (help), `cli/lib/autonomy.mjs` (dòng cuối thông báo `high`).
- `README.md`, `README_VI.md` (mục Autonomy: câu về `partRunner`/"parallel parts run as background subagents").
- Test: `test/content/34-autonomy-gates.pin.mjs` (bốn khoá), `test/content/32-superpowers-gap.pin.mjs` (AC5.1), `test/content/48-ask-execution-mode.pin.mjs`
  mới (AC1.x–AC3.x, AC6.x; `--set` kiểm bằng repo git tạm theo mẫu pin 34; `decide` của `guard-bash` cho AC3.5).
- Spec sống (bước gộp): `docs/specs/workflows/spec.md`, `hooks-gates/spec.md`, `cli-wizard/spec.md`, `baseline/spec.md`.
- `core/.manifest.json`, `workflows/.manifest.json`, `plugins/_versions.lock.json`.

Không đổi: hook trong `core/hooks/`, `ledger.mjs`, `task-brief.mjs`, `review-package.mjs`, `finish.md`, `mergeLocal`/`cleanup`,
review cuối toàn nhánh, giá trị `HIGH`.

## Ảnh hưởng spec
- baseline: đổi R8
- workflows: đổi R12, đổi R14, thêm R21
- hooks-gates: đổi R15
- cli-wizard: đổi R6

R21 (workflows), viết ở bước gộp: `plan-execution` hỏi cách thực thi trước mỗi lần thực thi plan (thẻ ở bước Chuẩn bị; nhóm Song song
hỏi thêm `partRunner`); `autonomy.planRunner`/`partRunner` chỉ đặt lựa chọn đứng đầu, không bỏ câu hỏi; câu trả lời lưu bằng
`autonomy.mjs --set`; trường hợp không hỏi (không có tool subagent, người dùng đã nói rõ, làm tiếp từ ledger); ghi `Ruling: cách chạy`.

## Ngoài phạm vi và anti-goal
- Review part trước merge (R5 của design nháp cũ), `ledger.mjs`, hook, schema ngoài hai khoá gợi ý, trial thật bằng model.
- Anti-goal: bỏ câu hỏi vì "đã có gợi ý"; để gợi ý nâng quyền (`mergeLocal`/`cleanup`) hoặc ghi vào file đã commit.

## Ràng buộc
- Baseline giữ byte-identical và ≤ 200 dòng (`test/contract/30-templates.contract.mjs`): sửa tại chỗ, không thêm dòng.
- Zero-dependency; `autonomy.mjs` chỉ dùng built-in của Node, không import hook hay `cli/`.
- Gợi ý chỉ là sở thích: không đọc để cấp quyền; chỉ `planRunner`/`partRunner` ghi được qua `--set`.
- Không merge, không push khi người dùng chưa xác nhận; push luôn hỏi.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; không `Co-Authored-By`.

## Kiểm thử
- AC1.1–AC1.5, AC2.1–AC2.4, AC3.6, AC6.1, AC6.2: pin nội dung `test/content/48-ask-execution-mode.pin.mjs` (câu quy tắc chính, không khớp toàn đoạn).
- AC1.4 (`ledger.mjs` nhận dòng), AC3.1–AC3.4: chạy `autonomy.mjs`/hàm `--set` trên repo git tạm (đủ ca: file hợp lệ, hỏng, đã theo dõi, worktree/main, chưa có file).
- AC3.5: `decide` của `guard-bash.mjs` trên lệnh `--set`; test hook hiện có không đổi.
- AC4.1: `34-autonomy-gates.pin.mjs`; AC5.1: `test/mode.test.mjs` + dòng help; AC7.1: `check-request.mjs --base master`; AC7.2: `npm run build`, `versions.mjs --lock`, `npm test`.
- Không có AC nêu kết quả số cần `calc:`. Trial thật chưa chạy: hành vi model với text mới chưa có bằng chứng.

## Để builder quyết
- Tên khoá `planRunner` là tạm (session gốc); đổi tên thì đổi đồng loạt.
- Có thêm mẫu `Ruling: cách chạy` vào `EVENT_FORMATS` của `ledger.mjs` hay không: đề xuất không, trừ khi `validateLine` từ chối dòng ba phần.
- A12: kiểm `agents-in-ci.md` có gọi `plan-execution` không.

## Rủi ro và câu hỏi mở
- [Inference] Mỗi lần thực thi thêm một câu hỏi giữa G2 và Task 1: đổi lấy quyền chọn; chưa đo mức phiền.
- [Inference] Nhãn `sequential` (nhóm Song song) chạy theo `planRunner`, nên "Tuần tự" có thể là inline hoặc subagent từng task: thẻ phải nói rõ.
- [giả định] Lệnh `--set` không bị `guard-bash` bắt (đọc regex `GUARD_CONFIG` ở `guard-bash.mjs:373`, chưa chạy thật): AC3.5 kiểm.
- Câu hỏi cho G1: A1 (hỏi ở bước Chuẩn bị chứ không ở G2), A3 (hai câu hỏi riêng), A5 (người dùng nói rõ thì không hỏi), A6 (làm tiếp từ ledger không hỏi lại), A11 (đánh dấu design nháp cũ abandoned).
