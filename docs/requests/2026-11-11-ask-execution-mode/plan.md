# Ask Execution Mode Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** `plan-execution` luôn hỏi cách chạy trước mỗi lần thực thi plan (chia part hay không); câu trả lời lưu vào `.claude/aip-gate.json` và lần sau làm lựa chọn đứng đầu, không bỏ qua câu hỏi.
**Architecture:** hai khoá gợi ý `autonomy.planRunner` / `autonomy.partRunner` đọc và ghi bằng `core/skills/plan-execution/scripts/autonomy.mjs` (`--set`); thẻ hỏi mô tả trong `SKILL.md`, `task-loop.md`, `ask-user.md`; hook không đổi.
**Tech Stack:** Node ESM không phụ thuộc ngoài, Markdown, pin test `test/content/*.pin.mjs`.
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/skills/plan-execution/scripts/autonomy.mjs` | đọc bốn khoá, ghi gợi ý qua `--set` | Task 1 |
| `test/content/34-autonomy-gates.pin.mjs` | pin khoá `autonomy` thêm `planRunner` | Task 1 |
| `test/content/48-ask-execution-mode.pin.mjs` | pin mới: `--set`, hook, nội dung docs của request | Task 1, 3, 4, 5, 6 |
| `cli/index.mjs` | chữ help của `aip autonomy` | Task 2 |
| `cli/lib/autonomy.mjs` | dòng cuối thông báo `high` | Task 2 |
| `test/mode.test.mjs` | kiểm thông báo `high` và `status` | Task 2 |
| `core/skills/plan-execution/SKILL.md` | thẻ cách thực thi ở bước Chuẩn bị, điểm dừng, bảng Ai làm gì | Task 3 |
| `core/skills/plan-execution/references/inline.md` | điều kiện bật inline, dòng Ruling, Subagent part | Task 3 |
| `test/content/32-superpowers-gap.pin.mjs` | AC5.1 đổi theo hành vi mới | Task 3 |
| `core/skills/plan-execution/references/task-loop.md` | Chế độ part bước 3–4, các dòng nhắc `partRunner` | Task 4 |
| `core/skills/plan-execution/references/ask-user.md` | hàng "Cách thực thi", hàng "Cách chạy part" | Task 4 |
| `core/agents/AGENTS.template.md` | baseline, dòng Execution (đổi tại chỗ) | Task 5 |
| `AGENTS.md` | bản chép byte-identical của template | Task 5 |
| `CLAUDE.md` | dòng Workflow defaults | Task 5 |
| `core/skills/git-worktree/SKILL.md` | câu hỏi tạo worktree theo câu trả lời nhóm Song song | Task 6 |
| `core/skills/git-worktree/references/parallel-agents.md` | khoá `partRunner` chỉ là gợi ý | Task 6 |
| `workflows/feature/WORKFLOW.md` | Bước 5 và đoạn Checkpoint | Task 6 |
| `README.md`, `README_VI.md` | mục Autonomy | Task 6 |
| `docs/specs/workflows/spec.md` | R14 đổi, R21 thêm, Lịch sử | Task 7 |
| `docs/specs/hooks-gates/spec.md` | R15 đổi, Lịch sử | Task 7 |
| `docs/specs/cli-wizard/spec.md` | R6 đổi, Lịch sử | Task 7 |
| `docs/specs/baseline/spec.md` | R8 đổi, Lịch sử | Task 7 |
| `docs/requests/2026-11-03-execution-mode-choice/design.md` | Trạng thái `abandoned` (A11) | Task 7 |
| `core/.manifest.json`, `workflows/.manifest.json`, `plugins/backend/.manifest.json`, `plugins/frontend/.manifest.json`, `plugins/_versions.lock.json` | bump version, lock (backend/frontend vì init chép AGENTS.template.md) | Task 8 |

## Global Constraints
- Khoá `autonomy` hiệu lực có đúng bốn khoá `{ mergeLocal, cleanup, partRunner, planRunner }`; mặc định `{ mergeLocal: false, cleanup: false, partRunner: "session", planRunner: "subagent" }`; `planRunner` ∈ `subagent` | `inline`; `partRunner` ∈ `subagent` | `session` | `sequential`.
- Lệnh lưu gợi ý: `node <thư mục skill plan-execution>/scripts/autonomy.mjs --set <khoá>=<giá trị>`; chỉ nhận `planRunner` và `partRunner`; exit 0 = đã ghi hoặc bỏ qua có lý do (file đã theo dõi / không xác định / giá trị trùng), exit 1 = file hỏng, exit 2 = sai khoá, giá trị hoặc cú pháp.
- Dòng ledger: `Ruling: cách chạy <subagent|inline> — <người dùng chọn | không có tool subagent | người dùng nói rõ> — <chi phí nếu sai>`, ghi vào ledger `root/` trước `Task 1: start`.
- Không sửa hook trong `core/hooks/`, không sửa `ledger.mjs`, không đổi `HIGH` trong `cli/lib/autonomy.mjs`.
- `AGENTS.md` giống hệt `core/agents/AGENTS.template.md` và không quá 200 dòng; chỉ sửa tại chỗ, không thêm dòng.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; commit qua `core:git-workflow` (header tiếng Anh, body tiếng Việt, `git commit -F`), không `Co-Authored-By`.
- Lệnh pin của request: `node test/validate.mjs --build --only 48-ask-execution-mode`.

## Review Focus
- `--set` trên file đã được git theo dõi không được làm bẩn cây: test ở Task 1 (ca "đã theo dõi").
- `readAutonomy` với `planRunner` sai kiểu chỉ rơi về mặc định của trường đó, và bốn khoá khớp từng ký tự trong pin 34: Task 1.
- Baseline vẫn ≤ 200 dòng và byte-identical sau khi đổi câu Execution: Task 5 (`test/contract/30-templates.contract.mjs` chạy trong `npm test`).
- Không sót mô tả cũ ("không hỏi người dùng chọn cách thực thi", khoá `partRunner` bỏ câu hỏi) ở bất kỳ file nào: grep ở Task 3, 4, 5, 6 và pin 48.
- Lệnh `--set` không bị `guard-bash` hỏi: Task 1 (ca `decide`).

### Task 1: autonomy.mjs đọc planRunner và ghi gợi ý bằng --set
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC1.4, AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC4.1
**Files:**
- Modify: `core/skills/plan-execution/scripts/autonomy.mjs`
- Modify: `test/content/34-autonomy-gates.pin.mjs`
- Create: `test/content/48-ask-execution-mode.pin.mjs`
- Test: `test/content/34-autonomy-gates.pin.mjs`, `test/content/48-ask-execution-mode.pin.mjs`

**Interfaces:**
- Consumes: `resolveAutonomy(cwd, deps)` hiện có (đường dẫn `top`/`main`, `trackedByGit`, `readGateAt`).
- Produces: `readAutonomy()` trả thêm `planRunner`; `setRunner(key, value, cwd, deps)` trả `{ code, message }`; lệnh `autonomy.mjs --set <khoá>=<giá trị>`.

- [ ] **Step 1:** Mở `test/content/34-autonomy-gates.pin.mjs`, đọc cách nó dựng repo git tạm và đối chiếu bốn khoá. Sửa các chuỗi kỳ vọng thành bốn khoá (`planRunner` đứng cuối, mặc định `subagent`), thêm một ca `planRunner` ngoài tập (`'parallel'`) và một ca sai kiểu (`1`) chỉ rơi về mặc định của trường đó.
- [ ] **Step 2:** Tạo `test/content/48-ask-execution-mode.pin.mjs` theo mẫu pin 34 (cùng `read`, `ok`, repo tạm). Thêm ca cho `setRunner`: (a) file hợp lệ không theo dõi → ghi `autonomy.planRunner`, giữ `mode` và `mergeLocal`, chạy lại giá trị trùng thì nội dung file không đổi; (b) `mergeLocal=true`, `planRunner=parallel`, `planRunner` thiếu `=` → code 2, file không đổi; (c) file hỏng → code 1, không ghi; (d) file đã `git add`/commit hoặc không xác định được → code 0, không ghi, `message` nêu lý do; (e) worktree không có file, repo chính có → ghi vào file repo chính; (f) cả hai không có → tạo `.claude/aip-gate.json` ở gốc repo chính chỉ gồm khoá vừa đặt; (g) `ledger.mjs` `main` với tệp tạm nhận dòng `Ruling: cách chạy inline — người dùng chọn — chi phí nếu sai: mất review từng task` (exit 0); (h) `decide` của `core/hooks/scripts/guard-bash.mjs` với lệnh `node core/skills/plan-execution/scripts/autonomy.mjs --set planRunner=inline` không trả `ask` (đọc export thật của guard-bash trước khi gọi).
- [ ] **Step 3:** Chạy `node test/validate.mjs --build --only 34-autonomy-gates` và `--only 48-ask-execution-mode`; thấy đỏ đúng lý do (thiếu `planRunner`, thiếu `setRunner`). Ghi lệnh và exit code làm `red:`.
- [ ] **Step 4:** Trong `autonomy.mjs`: thêm `planRunner: 'subagent'` vào `DEFAULTS` (đứng cuối), tập `PLAN_RUNNERS = new Set(['subagent', 'inline'])`, đọc `planRunner` trong `resolveAutonomy` như ba khoá còn lại. Thêm `export function setRunner(key, value, cwd = process.cwd(), deps = {})` theo A7–A8 của design (nơi ghi, file theo dõi/không xác định, file hỏng, giá trị trùng, tạo file ở gốc repo chính, `JSON.stringify(obj, null, 2) + '\n'`). Nối `--set <khoá>=<giá trị>` vào nhánh `invoked` (giữ kiểm `insidePlugin`); sửa comment đầu file (cách dùng). Một dòng comment `shortcut:` nếu có giới hạn đã biết.
- [ ] **Step 5:** Chạy lại hai pin ở Step 3, rồi `node test/validate.mjs --build --only 34` và `node test/mode.test.mjs`; thấy xanh. Commit test đỏ riêng trước (`test(core): pin planRunner and --set for autonomy`, chỉ stage file test), rồi commit code (`feat(core): add planRunner hint and --set to autonomy script`).

### Task 2: chữ mô tả aip autonomy không còn ngụ ý bỏ câu hỏi
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 15'
**Phủ AC:** AC5.1
**Files:**
- Modify: `cli/index.mjs`
- Modify: `cli/lib/autonomy.mjs`
- Modify: `test/mode.test.mjs`
- Test: `test/mode.test.mjs`

**Interfaces:**
- Consumes: `readAutonomy()` bốn khoá của Task 1 (qua `resolveAutonomy` trong `status`).
- Produces: không có

- [ ] **Step 1:** Trong `test/mode.test.mjs`, ở các ca `autonomy high` và `autonomy status` đã có (quanh dòng 261–330), thêm kiểm: đầu ra `high` nêu cách chạy vẫn hỏi mỗi lần (một cụm cố định, vd `cách chạy vẫn hỏi`), `status` in `"planRunner":"subagent"`; dữ liệu `high` ghi vẫn đúng `{ mergeLocal: true, cleanup: true, partRunner: "subagent" }`.
- [ ] **Step 2:** Chạy `node test/mode.test.mjs`; thấy đỏ ở hai kiểm mới. Ghi `red:`.
- [ ] **Step 3:** Sửa `cli/lib/autonomy.mjs` dòng `Push/PR vẫn luôn hỏi; …` thêm cụm đã chốt ở Step 1, và `cli/index.mjs` (help `autonomy`, quanh dòng 249–251): `partRunner: "subagent"` mô tả là gợi ý cách chạy part, không phải "không hỏi". Không đổi `HIGH`.
- [ ] **Step 4:** Chạy `node test/mode.test.mjs`; xanh. Commit test đỏ riêng rồi commit code (`docs(cli): autonomy help says execution mode is still asked`).

### Task 3: plan-execution SKILL.md và inline.md hỏi cách thực thi
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25'
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC3.6
**Files:**
- Modify: `core/skills/plan-execution/SKILL.md`
- Modify: `core/skills/plan-execution/references/inline.md`
- Modify: `test/content/32-superpowers-gap.pin.mjs`
- Modify: `test/content/48-ask-execution-mode.pin.mjs`
- Test: `test/content/32-superpowers-gap.pin.mjs`, `test/content/48-ask-execution-mode.pin.mjs`

**Interfaces:**
- Consumes: `` `autonomy.mjs --set <khoá>=<giá trị>` `` và dòng ledger `Ruling: cách chạy …` từ Global Constraints.
- Produces: quy tắc "thẻ Cách thực thi" ở bước Chuẩn bị để `ask-user.md` (Task 4) tham chiếu.

- [ ] **Step 1:** Trong pin 32, đổi kiểm AC5.1 (dòng 14–23): giữ kiểm `inline.md` nêu "người dùng nói rõ" và "không có tool subagent", bỏ cặp kiểm "Không hỏi người dùng chọn cách thực thi" và regex cấm hỏi; thay bằng kiểm `inline.md` có điều kiện bật thứ ba "người dùng chọn inline" và không còn câu "Không hỏi người dùng chọn cách thực thi". Trong pin 48 thêm các kiểm nội dung (câu khoá chính, không khớp toàn đoạn): `SKILL.md` có thẻ cách thực thi ở bước Chuẩn bị với hai lựa chọn `subagent`/`inline` trước `Task 1: start`; nêu `planRunner` chỉ đặt lựa chọn đứng đầu; ba trường hợp không hỏi (không có tool subagent, người dùng nói rõ, ledger đã có `Ruling: cách chạy` — grep cả ledger `root/`); phiên part và subagent part không hỏi; lưu bằng `autonomy.mjs --set` và không dùng Write/Edit lên `aip-gate.json`; mẫu dòng `Ruling: cách chạy`; hàng "Chế độ inline" của bảng "Ai làm gì" không còn "không hỏi người dùng chọn cách thực thi".
- [ ] **Step 2:** Chạy `node test/validate.mjs --build --only 32-superpowers-gap` và `--only 48-ask-execution-mode`; thấy đỏ đúng lý do. Ghi `red:`.
- [ ] **Step 3:** Sửa `SKILL.md`: bước 1 "Chuẩn bị" (thêm thẻ Cách thực thi sau khi tạo ledger và đọc `autonomy.mjs`, thay câu "thiếu khoá … hỏi cách chạy part"), mục "Điểm dừng và báo cáo" (câu hỏi cách chạy ở mọi lần thực thi; nhóm Song song hỏi thêm), hàng "Chế độ inline" của bảng "Ai làm gì", dòng "Ranh giới an toàn" nói về merge part (câu trả lời nhóm Song song thay khoá `subagent`), dòng 30–31 nhắc `partRunner`. Sửa `inline.md`: "Khi nào dùng" (bỏ câu cấm hỏi, thêm "người dùng chọn inline ở thẻ cách thực thi"), dòng Ruling đầu ledger thay bằng mẫu `Ruling: cách chạy …`, mục "Subagent part" nêu không hỏi cách chạy.
- [ ] **Step 4:** Đối chiếu khẳng định (step DOCS): liệt kê từng lệnh, tên khoá, đường dẫn mới viết, grep với `autonomy.mjs`/`task-loop.md`; ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo task. Chạy `grep -n "không hỏi người dùng chọn cách thực thi\|do not ask again" core/skills/plan-execution` (kết quả rỗng).
- [ ] **Step 5:** Chạy lại hai pin ở Step 2, xanh. Commit pin đỏ riêng trước rồi commit docs (`docs(core): plan-execution asks execution mode before each run`).

### Task 4: task-loop.md và ask-user.md hỏi cách chạy part theo từng nhóm
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC1.1, AC1.5, AC2.1, AC2.2, AC2.3, AC2.4, AC3.6
**Files:**
- Modify: `core/skills/plan-execution/references/task-loop.md`
- Modify: `core/skills/plan-execution/references/ask-user.md`
- Modify: `test/content/48-ask-execution-mode.pin.mjs`
- Test: `test/content/48-ask-execution-mode.pin.mjs`

**Interfaces:**
- Consumes: thẻ Cách thực thi và mẫu `Ruling: cách chạy` của Task 3.
- Produces: không có

- [ ] **Step 1:** Trong pin 48 thêm kiểm nội dung: `task-loop.md` "Chế độ part" bước 3 hỏi ba lựa chọn `subagent`/`session`/`sequential` cho mỗi nhóm Song song, `partRunner` ở mọi giá trị vẫn hỏi và chỉ đặt lựa chọn đứng đầu; nhóm P1/P2/P4 không hỏi chạy tuần tự; câu trả lời `subagent`/`session` là đồng ý tạo worktree và `merge --no-ff` (merge local), `sequential` không tạo worktree; plan có part không có nhóm Song song vẫn hỏi `planRunner` một lần; phiên part và subagent part không hỏi; sau mỗi câu gọi `autonomy.mjs --set partRunner=`; không còn cụm "`subagent`: không hỏi" và "khoá `subagent` cũng là sự đồng ý". `ask-user.md` có hàng "Cách thực thi" (hai lựa chọn, `planRunner` đứng đầu) và hàng "Cách chạy part" ba lựa chọn, đoạn mở đầu liệt kê "cách thực thi".
- [ ] **Step 2:** Chạy `node test/validate.mjs --build --only 48-ask-execution-mode`; đỏ đúng lý do. Ghi `red:`.
- [ ] **Step 3:** Sửa `task-loop.md`: dòng 127 (ngoại lệ merge part theo câu trả lời nhóm), 141–146 (danh sách câu hỏi cố định), "Chế độ part" bước 3–4 (thay ba nhánh rẽ theo khoá bằng một câu ba lựa chọn, giữ cách giao việc subagent và khối bàn giao `session`), dòng 220–221, 234 (nhắc `partRunner: subagent`), 243. Sửa `ask-user.md`: dòng 3–5 và bảng cổng (hàng mới "Cách thực thi", hàng "Cách chạy part" đổi sang ba lựa chọn).
- [ ] **Step 4:** Đối chiếu khẳng định như Task 3 Step 4, grep `grep -n "partRunner" core/skills/plan-execution/references` để chắc mọi lần nhắc đều đúng nghĩa gợi ý; chạy lại pin, xanh. Commit pin đỏ riêng rồi commit docs (`docs(core): ask execution mode per parallel group in task-loop`).

### Task 5: baseline và CLAUDE.md bỏ câu cấm hỏi cách thực thi
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 15'
**Phủ AC:** AC6.1
**Files:**
- Modify: `core/agents/AGENTS.template.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `test/content/48-ask-execution-mode.pin.mjs`
- Test: `test/content/48-ask-execution-mode.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Trong pin 48 thêm kiểm: ba file (`AGENTS.md`, template, `CLAUDE.md`) sau khi gộp xuống dòng không còn "do not ask again how to execute"; hai file baseline đọc ra giống hệt nhau và ≤ 200 dòng; baseline và `CLAUDE.md` nêu `plan-execution` hỏi cách chạy trước mỗi lần thực thi và nhớ câu trả lời làm gợi ý.
- [ ] **Step 2:** Chạy pin, đỏ đúng lý do. Ghi `red:`.
- [ ] **Step 3:** Sửa dòng Execution (dòng 152–153) của template rồi chép byte-identical sang `AGENTS.md` bằng `cp`; câu mới thay "do not ask again how to execute once the plan is approved" bằng một câu cùng độ dài tương đương (không thêm dòng). Sửa `CLAUDE.md:90` tương tự. Kiểm `wc -l` hai file baseline ≤ 200 và `cmp`.
- [ ] **Step 4:** Chạy pin và `node test/validate.mjs --build --only 30-templates`; xanh. Commit pin đỏ riêng rồi commit docs (`docs(core): baseline says plan-execution asks execution mode`).

### Task 6: git-worktree, WORKFLOW feature và README đồng bộ
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25'
**Phủ AC:** AC2.3, AC6.2
**Files:**
- Modify: `core/skills/git-worktree/SKILL.md`
- Modify: `core/skills/git-worktree/references/parallel-agents.md`
- Modify: `workflows/feature/WORKFLOW.md`
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `test/content/48-ask-execution-mode.pin.mjs`
- Test: `test/content/48-ask-execution-mode.pin.mjs`

**Interfaces:**
- Consumes: quy tắc nhóm Song song của Task 4.
- Produces: không có

- [ ] **Step 1:** Trong pin 48 thêm kiểm: `git-worktree/SKILL.md` và `parallel-agents.md` không còn "not asked when `autonomy.partRunner` is `subagent`" / "hoặc khoá `partRunner: subagent`", và nêu câu trả lời nhóm Song song là sự đồng ý tạo worktree và merge local, `partRunner` chỉ đặt lựa chọn đứng đầu; `WORKFLOW.md` Bước 5 và đoạn Checkpoint nêu câu hỏi cách thực thi (trước Task 1) và câu hỏi nhóm Song song theo mọi giá trị khoá; hai README mục Autonomy nêu cách chạy do câu trả lời quyết định và khoá chỉ là gợi ý, `aip autonomy high` không bỏ câu hỏi.
- [ ] **Step 2:** Chạy pin, đỏ đúng lý do. Ghi `red:`.
- [ ] **Step 3:** Sửa `git-worktree/SKILL.md:21`, `parallel-agents.md:13`, `workflows/feature/WORKFLOW.md` (dòng 162, 168, 246, 255–256 và các chỗ còn nhắc `partRunner`), `README.md` và `README_VI.md` (câu về `partRunner`/"parallel parts run as background subagents", mục Autonomy). Giữ nguyên tiếng của từng README (EN/VI).
- [ ] **Step 4:** Đối chiếu khẳng định như Task 3 Step 4; `grep -rn "partRunner" core workflows README.md README_VI.md` rà lần cuối. Chạy pin, xanh. Commit pin đỏ riêng rồi commit docs (`docs: align worktree, workflow and README with ask-every-run`).

### Task 7: spec sống và đánh dấu design nháp cũ
**Kind:** DOCS
**TDD:** không — chỉ sửa tài liệu spec, kiểm bằng `check-request.mjs`
**Ước lượng:** 25'
**Phủ AC:** AC7.1
**Files:**
- Modify: `docs/specs/workflows/spec.md`
- Modify: `docs/specs/hooks-gates/spec.md`
- Modify: `docs/specs/cli-wizard/spec.md`
- Modify: `docs/specs/baseline/spec.md`
- Modify: `docs/requests/2026-11-03-execution-mode-choice/design.md`
- Test: `core/skills/artifact-templates/scripts/check-request.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Đọc `design.md` mục "Ảnh hưởng spec" và R21; sửa `workflows` R14 (câu hỏi trước nhóm Song song theo mọi giá trị khoá, khoá chỉ là gợi ý) và thêm R21 (Nguồn trỏ request này); sửa `hooks-gates` R15 (bốn khoá, `planRunner`, `--set`, nghĩa gợi ý), `cli-wizard` R6 (`status` in bốn khoá; chữ `high`), `baseline` R8 (câu Execution). Thêm dòng bảng Lịch sử cho từng R đổi hoặc thêm (ngày 2026-11-11, trỏ `2026-11-11-ask-execution-mode`).
- [ ] **Step 2:** Đặt Trạng thái của `2026-11-03-execution-mode-choice/design.md` thành `abandoned — thay bằng 2026-11-11-ask-execution-mode (phần review part chưa làm)`.
- [ ] **Step 3:** Đối chiếu khẳng định với code (bảng `khẳng định → file:line → khớp|lệch`: tên khoá, giá trị mặc định, lệnh `--set`, exit code). Chạy `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-11-ask-execution-mode/ --base master`; không còn W10–W14. Commit (`docs(specs): record ask-execution-mode in living specs`).

### Task 8: bump version và chạy toàn bộ suite
**Kind:** TOOLING
**TDD:** không — task phát hành, bằng chứng là `npm test`
**Ước lượng:** 20'
**Phủ AC:** AC7.2
**Files:**
- Modify: `core/.manifest.json`
- Modify: `workflows/.manifest.json`
- Modify: `plugins/backend/.manifest.json`
- Modify: `plugins/frontend/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Bump `core` 1.32.4 → 1.32.5, `workflows` 3.15.0 → 3.15.1, `backend` 1.14.1 → 1.14.2 và `frontend` 1.15.1 → 1.15.2 trong `.manifest.json` (đọc version hiện tại trước, đổi nếu master đã đi tiếp; backend/frontend vì `backend-init`/`frontend-init` chép `AGENTS.template.md`).
- [ ] **Step 2:** `npm run build`, rồi `node cli/lib/versions.mjs --lock`; mở diff `plugins/_versions.lock.json`, chỉ đổi bốn mục trên.
- [ ] **Step 3:** `npm test`; exit 0, ghi số pass/fail. Commit (`chore: bump core, workflows, backend, frontend for ask-execution-mode`).
