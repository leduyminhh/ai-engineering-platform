# aip status Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Lệnh `aip status` chỉ đọc cho thấy part đang làm gì, đã làm gì, vướng gì; ledger ghi thời gian và dòng mới để dựng được trạng thái; statusline báo số part vướng; skill `/aip-status` hiển thị trang và nút xử lý.
**Architecture:** `cli/lib/status.mjs` đọc design/plan/ledger/`events.jsonl`/`git log` thành một mô hình JSON rồi render text, JSON, HTML tự chứa từ mô hình đó; `ledger.mjs` kiểm thêm 4 dạng dòng và ghi `events.jsonl`; `statusline.mjs` nhận số vướng từ `status.mjs`.
**Tech Stack:** Node.js 20+ ESM, zero-dependency, test bằng script Node thuần.
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/skills/plan-execution/scripts/ledger.mjs` | kiểm 4 dạng dòng mới, ghi `events.jsonl` | Task 1 |
| `test/content/35-aip-status.pin.mjs` | test ledger (AC2.x) và pin skill (AC3.x) | Task 1, Task 4 |
| `cli/lib/status.mjs` | dựng mô hình trạng thái request, render text/JSON/HTML, đếm vướng | Task 2 |
| `cli/lib/args.mjs` | cờ `--html`, `--part`, `--watch` | Task 2 |
| `cli/index.mjs` | định tuyến `aip status`, help, nối số vướng vào `statusline` | Task 2, Task 3 |
| `test/status.test.mjs` | test `status.mjs` + CLI (AC1.x) | Task 2 |
| `package.json` | thêm `test/status.test.mjs` vào `npm test` | Task 2 |
| `README.md`, `README_VI.md`, `CLAUDE.md` | dòng lệnh `aip status`, skill `aip-status` | Task 2, Task 4 |
| `cli/lib/statusline.mjs` | đoạn `⚠ <n> vướng` | Task 3 |
| `test/statusline.test.mjs` | test đoạn vướng (AC5.1) | Task 3 |
| `core/skills/aip-status/SKILL.md` | skill `/aip-status`: chạy lệnh, render HTML, widget hành động, fallback text | Task 4 |
| `core/skills/plan-execution/references/task-loop.md`, `core/skills/plan-execution/references/inline.md` | câu chữ dòng mới, bảng xử lý vướng, báo một lần | Task 5 |
| `core/.manifest.json`, `plugins/_versions.lock.json`, `docs/specs/*/spec.md`, `docs/requests/2026-10-31-aip-status/trial-5.md` | bump, lock, spec sống, lượt thử 5 | Task 6 |

## Global Constraints
- Zero-dependency: chỉ built-in của Node; không thêm gói npm.
- Dòng ledger mới, nguyên văn: `Task <n>: start (base <hash>)`, `Task <n>: review <vòng> <spec_verdict> <blocker>/<major>/<minor>`, `Blocked: <lý do>`, `Unblocked: <cách giải>`. `spec_verdict` ∈ `compliant` | `issues` | `cannot_verify`. Sai định dạng → `ledger.mjs` exit 2, không ghi gì (cả `progress.md` lẫn `events.jsonl`).
- `events.jsonl` nằm cạnh `progress.md`, mỗi dòng ledger một bản ghi `{"ts": <ISO 8601>, "line": <dòng>}`; định dạng `progress.md` không đổi.
- Trạng thái part, thứ tự ưu tiên: `vướng` (dòng `Blocked:` mới nhất chưa có `Unblocked:`/`complete` sau nó) > `merged` (`Part <nn>: merged` ở ledger root) > `xong chờ merge` (`Part: complete`) > `chờ part phụ thuộc` (phụ thuộc chưa merged; không phải vướng) > `im lặng quá lâu` (đang làm, không có dòng ledger hay commit mới quá `statusStaleMinutes`) > `đang làm` (`Task <n>: start` hoặc có commit trên nhánh part) > `chưa làm`.
- `statusStaleMinutes` đọc từ `.claude/aip-gate.json` (thứ tự worktree → repo chính như các khoá khác); thiếu hoặc không phải số dương thì 30.
- 7 khối của trang: đầu trang (request, nhánh, HEAD, mức `autonomy`, thời điểm cập nhật); dải cổng G1 → G2 → G3 → push; "Cần bạn xử lý" (chỉ khi có việc); số tổng (part merged/tổng, task xong/tổng, số vướng, Ruling/minor); bảng part; sơ đồ phụ thuộc (cột Phụ thuộc, nhãn từ `**Interfaces:**`); chi tiết part và dòng sự kiện (mới nhất trước).
- `status.html` ghi ở `.aip/runs/<request>/status.html`, một file, CSS inline, không tải tài nguyên ngoài; `--watch` ghi lại mỗi 10 giây và thêm `<meta http-equiv="refresh">`.
- Nhánh part `worktree-<slug>-p<nn>`, nhánh tích hợp `feature/<slug>`; `<slug>` = tên request bỏ tiền tố ngày.
- Task 1–4 không sửa `task-loop.md`, `inline.md`, `finish.md`, `workflows/feature/WORKFLOW.md`, `core/.manifest.json`, `plugins/_versions.lock.json` (nhánh `feature/autonomy-gates` đang sửa).
- Commit qua `git-workflow`: `git commit -F`, header tiếng Anh, body tiếng Việt có dấu, không `Co-Authored-By`; task TOOLING TDD `có` commit test đỏ riêng.

## Review Focus
- Thứ tự ưu tiên khi một part khớp nhiều trạng thái (vd vừa `Blocked:` vừa có phụ thuộc chưa merged; `Blocked:` rồi `Task <n>: complete` sau đó) — test tham số AC1.1/AC1.4 ở Task 2.
- Request cũ không có `events.jsonl`, không có nhánh part, không có git: lệnh không ném, vẫn in bảng — test "thiếu dữ liệu" ở Task 2.
- HTML chèn nội dung ledger (dòng `Blocked: <script>`): phải escape — test AC1.3 ở Task 2.
- `Task 1: started …` (dòng tự do cũ) không bị bắt nhầm thành dạng `start` — test AC2.2 ở Task 1.
- Đối số ledger nhiều dòng: mỗi dòng một bản ghi `events.jsonl`, một dòng sai thì không ghi gì — test AC2.1/AC2.2 ở Task 1.

### Task 1: ledger.mjs — 4 dòng mới và events.jsonl
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC2.1, AC2.2
**Files:**
- Modify: `core/skills/plan-execution/scripts/ledger.mjs`
- Create: `test/content/35-aip-status.pin.mjs`
- Test: `test/content/35-aip-status.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `validateLine(line, ctx)` (thêm luật), `appendLedger(file, line, now?)` ghi `events.jsonl` cạnh `file`

- [ ] **Step 1:** Viết test đỏ trong `35-aip-status.pin.mjs` (module `export default async function run({ ok, ctx })`): (a) tham số hoá dòng sai bị `validateLine` từ chối: `Task 1: start`, `Task 1: start (base xyz)`, `Task 1: review 0 compliant 0/0/0`, `Task 1: review 1 ok 0/0/0`, `Task 1: review 1 issues 1/0`, `Blocked:`, `Blocked:   `, `Unblocked:`; dòng đúng được nhận: `Task 3: start (base 1a2b3c4)`, `Task 3: review 2 issues 0/1/2`, `Blocked: thiếu quyền ghi`, `Unblocked: dùng thư mục tạm`, `Task 1: started trong worktree` (dòng tự do cũ). (b) `main([plan, dòng sai])` exit 2, không tạo `progress.md` lẫn `events.jsonl`. (c) `main` ghi 2 dòng (đối số nhiều dòng) → `events.jsonl` thêm đúng 2 bản ghi `{ts, line}` với `ts` parse được bằng `Date.parse`, `progress.md` chỉ chứa đúng các dòng đó (không có JSON). Chạy `node test/validate.mjs --only aip-status` → Expected: FAIL.
- [ ] **Step 2:** Commit test đỏ (chỉ stage file test).
- [ ] **Step 3:** Thêm luật vào `validateLine`, ghi `events.jsonl` trong `appendLedger` (mỗi dòng của đối số một bản ghi). Chạy `node test/validate.mjs --only aip-status` → Expected: PASS; `node test/validate.mjs --only request-parts` và `--only superpowers-gap` → PASS (ledger cũ không vỡ).
- [ ] **Step 4:** Commit code.

### Task 2: aip status — mô hình, text, JSON, HTML
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4, AC1.5
**Files:**
- Create: `cli/lib/status.mjs`
- Modify: `cli/lib/args.mjs`
- Modify: `cli/index.mjs`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `CLAUDE.md`
- Create: `test/status.test.mjs`
- Test: `test/status.test.mjs`

**Interfaces:**
- Consumes: `parsePartTable(designText)` từ `core/skills/artifact-templates/scripts/check-request.mjs`; `parsePartition(planText)` từ `core/skills/artifact-templates/scripts/check-partition.mjs`; `readGateConfig(dir)` từ `core/hooks/scripts/gate-config.mjs`; định dạng `events.jsonl` của Task 1
- Produces: `buildStatus({ docsRoot, runsRoot, request, now, staleMinutes, git, autonomy })`, `pickRequest(runsRoot)`, `renderText(model, { part })`, `renderHtml(model, { watch })`, `countBlocked(runsRoot)`, `mainRoot(cwd)`

- [ ] **Step 1:** Viết test đỏ `test/status.test.mjs` (cùng khung `ok`/`fails` với `test/statusline.test.mjs`). Fixture dựng trong `fs.mkdtempSync`: request `2026-01-01-demo` có `design.md` với Bảng part 4–5 part, `plan.md` gốc, `parts/<nn>-<slug>/plan.md` có `**Interfaces:**`, ledger root + ledger part (+ `events.jsonl` cho một part), `git` giả (hàm trả chuỗi `git log` cố định theo nhánh). Test: AC1.1 tham số hoá trạng thái theo thứ tự ưu tiên (`Blocked:` mới nhất chưa gỡ → `vướng`; `Blocked:` rồi `Unblocked:` → không vướng; `Blocked:` rồi `Task <n>: complete` → không vướng; `Part 01: merged` ở root → `merged`; `Part: complete` → `xong chờ merge`; `Task 1: start` → `đang làm`; commit trên nhánh part không có ledger → `đang làm`; không gì → `chưa làm`) và `renderText` có số tổng + bảng part. AC1.2: `JSON.parse` đầu ra `--json` có khoá `header`, `gates`, `needs`, `totals`, `parts`, `graph`, `details`, `events`. AC1.3: `renderHtml` có 7 khối (id cố định), không có `src=`/`href=` trỏ `http`, `<link`, `@import`; dòng `Blocked: <script>` bị escape; `{watch:true}` có `http-equiv="refresh"`. AC1.4: part có phụ thuộc chưa merged → `chờ part phụ thuộc`, không vào `needs`, không tính vào `totals.blocked`. AC1.5: part đang làm, hoạt động cuối cách `now` 31 phút → `im lặng quá lâu` khi `staleMinutes` 30 và thiếu khoá; 29 phút → `đang làm`; `staleMinutes: 60` → `đang làm`. Thiếu dữ liệu: request không có `events.jsonl`, `git` ném lỗi → không ném, vẫn có bảng. CLI: `aip status <request> --json` trong fixture (`cwd` = fixture, `AIE_*` nếu cần) exit 0; `parse(['status','--html','--part','02','--watch'])` cho `html`, `part`, `watch`. Chạy `node test/status.test.mjs` → Expected: FAIL.
- [ ] **Step 2:** Commit test đỏ (chỉ stage file test).
- [ ] **Step 3:** Viết `status.mjs`, cờ trong `args.mjs`, nhánh `status` trong `cli/index.mjs` (text mặc định; `--json`; `--html` ghi `status.html` và in đường dẫn; `--part <nn>` in chi tiết part; `--watch` ghi lại HTML mỗi 10 giây; không có request đang chạy → in một dòng, exit 0), help, thêm test vào `npm test`, dòng lệnh trong `README.md`/`README_VI.md`/`CLAUDE.md`. Chạy `node test/status.test.mjs` → Expected: PASS; `node test/args.test.mjs` → PASS.
- [ ] **Step 4:** Commit code.

### Task 3: statusline — đoạn vướng
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC5.1
**Files:**
- Modify: `cli/lib/statusline.mjs`
- Modify: `cli/index.mjs`
- Test: `test/statusline.test.mjs`

**Interfaces:**
- Consumes: `countBlocked(runsRoot)`, `mainRoot(cwd)` của Task 2
- Produces: `renderStatusline(input, { …, blocked })`

- [ ] **Step 1:** Thêm test đỏ vào `test/statusline.test.mjs`: `blocked: 2` → dòng chứa `⚠ 2 vướng`; `blocked: 0`/thiếu → không có `vướng`; CLI với `cwd` là fixture có một part `Blocked:` chưa gỡ → stdout chứa `⚠ 1 vướng`, exit 0; thư mục không phải repo → không có `vướng`, exit 0. Chạy `node test/statusline.test.mjs` → Expected: FAIL.
- [ ] **Step 2:** Commit test đỏ (chỉ stage file test).
- [ ] **Step 3:** Thêm đoạn vào `renderStatusline`; nhánh `statusline` của CLI lấy thư mục từ `workspace.current_dir`/`cwd` của stdin (thiếu thì `process.cwd()`), gọi `countBlocked(mainRoot(dir))`, lỗi bất kỳ → coi như 0. Chạy `node test/statusline.test.mjs` → Expected: PASS.
- [ ] **Step 4:** Commit code.

### Task 4: skill aip-status
**Kind:** DOCS
**Phủ AC:** AC3.1, AC3.2
**Files:**
- Create: `core/skills/aip-status/SKILL.md`
- Modify: `test/content/35-aip-status.pin.mjs`
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `CLAUDE.md`
- Test: `test/content/35-aip-status.pin.mjs`

**Interfaces:**
- Consumes: CLI `aip status --json`, `aip status --html` của Task 2
- Produces: không có

- [ ] **Step 1:** Viết `SKILL.md`: frontmatter `name: aip-status`, `description` theo mẫu Phase 1 (≤ 500 ký tự, triggers không trùng skill khác, `Không dùng khi … → <id thật>`), `order`, `title`, `runsIn`, `invoke`; thân có `## Quy trình…` (chạy `aip status --json` rồi `--html`; có công cụ hiển thị thì render `status.html` ở panel bên và, khi `needs` không rỗng, hiện widget chỉ gồm khối "Cần bạn xử lý" với nút "Xử lý ↗" gửi lệnh xử lý đúng part vào chat; không có công cụ hiển thị thì in text của `aip status`) và `## Ranh giới an toàn…` (chỉ đọc, không publish trang ra dịch vụ ngoài, widget không vẽ lại dashboard). Ghi `[Unverified]` cho hành vi panel/widget của app.
- [ ] **Step 2:** Thêm pin AC3.1/AC3.2 vào `35-aip-status.pin.mjs`: skill nêu `aip status --json`, `--html`, "Cần bạn xử lý", "Xử lý ↗", nhánh không có công cụ hiển thị in text. Thêm skill vào danh sách skill core ở `README.md`/`README_VI.md`/`CLAUDE.md`. Chạy `node test/validate.mjs --only aip-status` và `node test/validate.mjs --build --only conventions` → Expected: PASS.
- [ ] **Step 3:** Commit.

### Task 5: câu chữ task-loop và inline
**Kind:** DOCS
**Phủ AC:** AC4.1, AC4.2, AC4.3
**Files:**
- Modify: `core/skills/plan-execution/references/task-loop.md`
- Modify: `core/skills/plan-execution/references/inline.md`
- Modify: `test/content/35-aip-status.pin.mjs`
- Test: `test/content/35-aip-status.pin.mjs`

**Interfaces:**
- Consumes: định dạng 4 dòng ledger mới (Global Constraints)
- Produces: không có

- [ ] **Step 1:** Chỉ chạy sau khi `feature/autonomy-gates` đã merge vào master và nhánh này đã nhận master. `task-loop.md`: ghi `Task <n>: start (base <hash>)` ở bước 1, `Task <n>: review …` sau mỗi lần review, `Blocked:`/`Unblocked:`; bảng xử lý vướng (root tự gỡ: test đỏ sau merge part tối đa 2 vòng, conflict trong write set, part im lặng khởi động lại một lần, câu hỏi trả lời được từ design/plan; hỏi người dùng: 6 loại dừng, plan hỏng → plan riêng part duyệt một lần, conflict ngoài write set); gom câu hỏi một thẻ có đáp án khuyến nghị, part khác chạy tiếp; gửi lời giải về part (`SendMessage` / giao lại subagent) và ghi `Unblocked:`; mỗi vướng báo một lần, không nhắc lại, vướng mới gộp thẻ; session gốc đưa trang `aip status` (skill `aip-status`) ở mỗi cổng G1/G2/G3 và khi một part chuyển sang vướng (design (7)); `xử lý vướng part root` = vướng của chính session gốc. `inline.md`: subagent part ghi `Task <n>: start`, `Blocked:`. 6 loại dừng giữ nguyên.
- [ ] **Step 2:** Pin AC4.1–AC4.3 (câu chữ trên) vào `35-aip-status.pin.mjs`. Chạy `node test/validate.mjs --only aip-status` → Expected: PASS.
- [ ] **Step 3:** Commit.

### Task 6: bump, lock, spec sống, lượt thử 5
**Kind:** DOCS
**Phủ AC:** AC6.1
**Files:**
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Modify: `docs/specs/workflows/spec.md`
- Modify: `docs/specs/cli-wizard/spec.md`
- Modify: `docs/specs/hooks-gates/spec.md`
- Create: `docs/requests/2026-10-31-aip-status/trial-5.md`
- Test: `docs/requests/2026-10-31-aip-status/trial-5.md`

**Interfaces:**
- Consumes: `aip status`, skill `aip-status`, dòng ledger mới (Task 1–5)
- Produces: không có

- [ ] **Step 1:** Bump `core/.manifest.json`, `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` → Expected: PASS.
- [ ] **Step 2:** Spec sống theo `## Ảnh hưởng spec`: `workflows` đổi R8, R14; `cli-wizard` thêm R7; `hooks-gates` thêm R17; chạy `check-request.mjs` → không cảnh báo ngoài W9.
- [ ] **Step 3:** Lượt thử 5 ở `E:\Mine\AI\aip-parts-trial`: request 2 part, một part vướng có chủ đích; kiểm AC3.1, AC3.2, AC4.1–AC4.3, AC6.1 (trang đúng trạng thái, vướng báo một lần, gỡ xong part tiếp tục và merged); ghi kết quả từng AC vào `trial-5.md`.
- [ ] **Step 4:** Commit.
