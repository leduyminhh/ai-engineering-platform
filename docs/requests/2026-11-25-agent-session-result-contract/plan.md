# Chuẩn hoá result giữa session và subagent Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** một contract kết quả chung cho subagent và phiên: `agent_result` bỏ được khoá rỗng, dòng `aip-report v1` ≤ 400 code point cho tin phiên con → phiên gốc, script `result-check.mjs` áp 11 luật kiểm đầu ra kèm test, prompt `plan-execution` chỉ trỏ về contract.
**Architecture:** một script Node thuần `core/skills/plan-execution/scripts/result-check.mjs` export hàm thuần `checkReportLine(line)`, `parseAgentResult(text)`, `checkAgentResult(parsed, opts)`; phần CLI đặt sau cổng `import.meta.url` như `task-brief.mjs`, chỉ đọc file, gọi hàm, in JSON. Phần còn lại là nội dung markdown của contract (`core/principles/`) và `plan-execution` (`references/`).
**Tech Stack:** Node 20+ built-in (`node:fs`, `node:path`, `node:url`), markdown tiếng Việt; test qua `test/validate.mjs` (module `test/content/*.pin.mjs`).
**Spec:** design.md
**Requirement:** requirement.md

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/skills/plan-execution/scripts/result-check.mjs` | parse + kiểm dòng `aip-report` và khối `agent_result`, CLI | Task 1, Task 2 |
| `test/content/56-result-check.pin.mjs` | test hàm (tham số hoá), CLI qua `spawnSync`, pin nội dung contract/prompt/reference của request này | Task 1–5 |
| `core/principles/workflow-output-contract.md` | khối mẫu có chú thích khoá bỏ được; mục "Khoá bỏ được", "Báo cáo giữa phiên (aip-report)", "Kiểm bằng script"; câu `final-review-keys` trong "Kiểm đầu ra worker" | Task 3 |
| `core/skills/plan-execution/references/prompts/implementer.md` | trỏ contract, nêu khoá bắt buộc của vai implementer | Task 4 |
| `core/skills/plan-execution/references/prompts/task-review.md` | trỏ contract, nêu khoá bắt buộc của vai task-review | Task 4 |
| `core/skills/plan-execution/references/prompts/re-review.md` | trỏ contract, nêu khoá bắt buộc của vai re-review | Task 4 |
| `core/skills/plan-execution/references/prompts/final-review.md` | trỏ contract, nêu khoá bắt buộc của vai final-review | Task 4 |
| `core/skills/plan-execution/references/task-loop.md` | bước 3–4 (lưu report, chạy script), bước 7–8 (lưu review, chạy script), "Chế độ part" bước 6–7 (dòng `aip-report`) | Task 5 |
| `core/skills/plan-execution/references/model-routing.md` | quy tắc 9 và 14 trỏ dòng `aip-report` | Task 5 |
| `core/skills/plan-execution/references/inline.md` | mục "Subagent part": báo cáo cuối mở bằng dòng `aip-report` | Task 5 |
| `plugins/engineering/skills/engineering-codebase-onboarding/references/subagent-prompts.md` | mục D: khoá rỗng bỏ được theo contract (nếu rà thấy lệch D1) | Task 6 |
| `docs/requests/2026-11-25-agent-session-result-contract/design.md` | ghi số "Sau" của mục "Đo kích thước" và kết quả rà biến thể | Task 6 |
| `test/content/31-workflow-self-sufficient.pin.mjs`, `test/content/53-reasoning-review.pin.mjs`, `test/contract/10-source.contract.mjs` | chỉ đổi đường dẫn file nếu định nghĩa chuyển chỗ; không nới regex | Task 3, Task 4, Task 5 |
| `core/.manifest.json`, `plugins/engineering/.manifest.json`, `plugins/_versions.lock.json` | bump version, refresh lock | Task 7 |

## Global Constraints
- Nhánh `feature/agent-session-result-contract` (đã tạo từ `master`); commit đầu chứa `brief.md`, `requirement.md`, `design.md`, `plan.md`. Commit mỗi task qua `core:git-workflow`, header tiếng Anh, body tiếng Việt, không `Co-authored-by`. Không push, không merge khi chưa duyệt G3.
- Script chỉ import `node:*` và `./task-brief.mjs` (dùng `extractTask`, `taskField`, `effectiveTdd`); không import `./workspace.mjs`; zero-dep; chỉ đọc file, không ghi; không đọc stdin; không nhận thư mục. Đường dẫn `<report.md>`, `--plan`, `--implementer-report` tính theo cwd. UTF-8 không BOM, LF; comment tiếng Việt có dấu, chỉ khi qua cổng comment của `AGENTS.md`.
- CLI (nguyên văn): `node result-check.mjs <report.md> --role <implementer|task-review|re-review|final-review|worker> [--tdd] [--plan <plan.md> --task <n>] [--implementer-report <file>] [--findings <n>]` và `node result-check.mjs --line "<dòng>"`.
- Đầu ra (nguyên văn): JSON `{ ok, violations: [{rule, detail}], not_run: [{rule, reason}] }`; exit 0 khi `ok`, 1 khi có vi phạm, 2 khi sai đối số (thiếu `--role`, `--role` lạ, thiếu `<report.md>` lẫn `--line`, `--plan` không kèm `--task`), không đọc được file hoặc đường dẫn là thư mục.
- 11 ID luật (nguyên văn): `status-valid`, `finding-location-evidence`, `completed-no-failed-validation`, `changes-in-files`, `tdd-required`, `assumptions-key`, `spec-verdict-findings`, `assumption-review-count`, `verdicts-count`, `blocked-questions`, `final-review-keys`; thêm `unparseable`. Điều kiện áp từng luật theo bảng luật của `design.md` mục "`result-check.mjs`".
- Không có khối `agent_result:` hoặc không parse được → `violations` chỉ có đúng một mục `unparseable`, không áp luật khác. Parse được → áp mọi luật có điều kiện khớp, báo đủ.
- Vai `worker`: chỉ luật "mọi vai" (`status-valid`, `finding-location-evidence`, `completed-no-failed-validation`, `blocked-questions`) cộng `changes-in-files`/`tdd-required` khi có cờ tương ứng.
- `assumption-review-count` áp cho `--role task-review` và `--role re-review` khi có `--implementer-report`; không có cờ → `not_run`. `verdicts-count` cần `--findings`; không có → `not_run`. `changes-in-files` cần `--plan --task`; không có → `not_run`.
- Dòng `aip-report` (nguyên văn): `aip-report v1 from=<part-nn|root|<slug>> status=<complete|blocked|failed> [hash=<sha>] [tests=<pass|fail|not_run>] [minor=<số>] [file=<đường dẫn>] [note="<≤120 ký tự>"]`. `complete` bắt buộc `hash` (7–40 hex) và `tests`; `blocked`/`failed` bắt buộc `note`; giá trị không khoảng trắng trừ `note` trong nháy kép; một dòng; độ dài đếm theo code point (`[...line].length`), trần 400, `note` trần 120.
- D1 (nguyên văn): luôn bắt buộc `status`, `summary`; implementer trong vòng task → `assumptions` (được rỗng); TDD `có` → `tdd.red`, `tdd.green`; task-review → `spec_verdict`, `findings` (được `[]`), `assumption_review[]` khi báo cáo implementer có giả định; re-review → `verdicts[]`; final-review → `findings`, `ruling_review[]`; `questions` không rỗng khi `status: blocked`; mọi khoá khác bỏ được khi rỗng, khoá vắng là rỗng.
- File report do session chính ghi: `<workspace>/task-<n>-report.md`, review `task-<n>-review-<vòng>.md`. Worker và reviewer không ghi file. Ledger (`ledger.mjs`, `progress.md`, `events.jsonl`) không đổi; dòng `aip-report` không ghi vào ledger.
- Câu hiện có của mục "Kiểm đầu ra worker" giữ nguyên chữ (chỉ thêm câu). Regex trong 3 file pin cũ không được nới; chỉ đổi đường dẫn file khi định nghĩa chuyển chỗ; số `ok(` không giảm (trước: 31 → 249, 53 → 25, 10-source → 70).
- Không sửa `core/hooks/`, `cli/lib/status*`, `core/skills/aip-status/`, `ledger.mjs`, `AGENTS.md`, `core/agents/AGENTS.template.md`, 16 file `plugins/*/agents/*.md`, `docs/specs/` (spec sống viết ở `finish.md`).
- Version: `core` 1.36.0 → 1.37.0; `engineering` 2.17.0 → 2.17.1 chỉ khi Task 6 sửa file của plugin này.

## Review Focus
- `agent_result` thật có giá trị chứa `:` hoặc `#` trong chuỗi (summary, evidence) làm parser tách sai khoá: Task 2 có ca fixture summary chứa `: ` và `# ` → vẫn đạt.
- Khối `agent_result` nằm trong hàng rào ```yaml lẫn trần, có văn bản trước/sau: Task 2 có ca cả hai dạng (AC3.5).
- `note` chứa dấu `=` hoặc khoảng trắng nhiều lần, và dòng có `\r` cuối: Task 1 có ca `note="a=b c"` đạt và dòng kết thúc `\r` (coi như một dòng, không vượt trần vì `\r`).
- Đường dẫn trong `changes` dùng `\` (Windows) so với `**Files:**` dùng `/`: Task 2 có ca `changes-in-files` với `core\\x.mjs` khớp `core/x.mjs` → đạt (AC3.3).
- Report cũ thật trong `.aip/runs/` có đủ khoá: Task 2 dựng fixture theo dạng `task-3-report.md` mẫu (flow `{ assumption, basis, if_wrong }`, `tdd.red` là chuỗi) → `--role implementer --tdd` đạt (AC7.2).

### Task 1: Kiểm dòng `aip-report` và khung CLI
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25'
**Phủ AC:** AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC3.1, AC3.7
**Files:**
- Create: `core/skills/plan-execution/scripts/result-check.mjs`
- Create: `test/content/56-result-check.pin.mjs`
- Test: `test/content/56-result-check.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `checkReportLine(line)` trả `{ ok, violations: [{rule, detail}], not_run: [] }`; `parseArgs(argv)` trả `{ line, report, role, tdd, plan, task, implementerReport, findings }` hoặc ném `UsageError`; CLI `--line`; helper test `cli(args)` (spawnSync, trả `{ code, json }`) trong `56-result-check.pin.mjs`.

- [ ] **Step 0:** Commit tài liệu request trên nhánh hiện tại qua `core:git-workflow`: `docs(requests): add agent-session-result-contract brief, requirement, design and plan`.
- [ ] **Step 1:** Viết test đỏ trong `56-result-check.pin.mjs`: bảng tham số hoá `checkReportLine` gồm AC2.1 (dòng mẫu đạt), AC2.2 (thiếu `hash`; thiếu `tests`), AC2.3 (`blocked`/`failed` thiếu `note` → vi phạm; có `note` → đạt), AC2.4 (400 code point có chữ tiếng Việt → đạt, 401 → vi phạm), AC2.5 (thiếu `v1`; `status=done`; giá trị có khoảng trắng ngoài `note`), ca Review Focus (`note="a=b c"`, `\r` cuối). CLI: AC3.1 (`--line` hợp lệ exit 0 JSON đúng hình; vi phạm exit 1; không đối số, `--role foo`, file không tồn tại, đường dẫn thư mục → exit 2), AC3.7 (SHA-256 của file report trước/sau lần chạy bằng nhau; import của script chỉ `node:` và `./task-brief.mjs`). Chạy `node test/validate.mjs --only result-check`; mong đợi: assert mới đỏ vì script chưa có.
- [ ] **Step 2:** Viết `parseArgs`, `UsageError`, `checkReportLine`, CLI (`--line` → in JSON, exit theo `ok`; `UsageError`/lỗi đọc → stderr + exit 2). Chế độ `<report.md>` lúc này chỉ đọc file và trả `unparseable` (Task 2 hoàn thiện). Chạy lại; mong đợi: xanh.
- [ ] **Step 3: Commit** test đỏ riêng trước (`test(core): add result-check line tests`), rồi `feat(core): add result-check script with aip-report line check`.

### Task 2: Parse `agent_result` và 11 luật
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC1.2, AC1.3, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC7.2
**Files:**
- Modify: `core/skills/plan-execution/scripts/result-check.mjs`
- Modify: `test/content/56-result-check.pin.mjs`
- Test: `test/content/56-result-check.pin.mjs`

**Interfaces:**
- Consumes: `parseArgs(argv)`, `UsageError`, helper `cli(args)` từ Task 1; `extractTask(planText, n)`, `taskField(taskText, name)`, `effectiveTdd(taskText)` của `./task-brief.mjs`.
- Produces: `parseAgentResult(text)` trả object khoá cấp một (`status`, `summary`, `changes`, `validation`, `findings`, `questions`, `tdd`, `assumptions`, `spec_verdict`, `assumption_review`, `verdicts`, `ruling_review`) hoặc `null` khi không có/không parse được; `checkAgentResult(parsed, { role, tdd, planText, task, implementerAssumptions, findings })` trả `{ ok, violations, not_run }`.

- [ ] **Step 1:** Viết test đỏ: bảng tham số hoá 11 luật, mỗi luật một ca đạt + một ca vi phạm trả đúng `rule` (AC3.2), gồm `--role worker` chỉ `status` + `summary` → đạt; AC1.2 (implementer `status`, `summary`, `assumptions: []` → exit 0); AC1.3 (blocked không `questions` / `questions: []` → `blocked-questions`); AC3.3 (`changes` ngoài `**Files:**` → vi phạm; không `--plan --task` → `not_run` có `changes-in-files`; `\` khớp `/`); AC3.4 (task `BE` không dòng TDD, report không `tdd` → `tdd-required`; `--tdd`; task `**TDD:** không — <lý do>` → không đòi); AC3.5 (cùng nội dung dạng block và flow cho cùng kết quả; không khối / khối hỏng → chỉ một `unparseable`; khối trong ```yaml và trần; summary chứa `: ` và `# `); AC3.6 (task-review với `--implementer-report` 3 giả định và 2 mục `assumption_review` → vi phạm, 3 mục → đạt; re-review `--findings 3` với 2 `verdicts` → vi phạm; re-review kèm `--implementer-report` áp `assumption-review-count`); AC7.2 (fixture dạng `task-3-report.md` cũ đủ khoá → kiểm bình thường, đạt). Plan fixture dựng trong thư mục tạm lúc chạy. Chạy `node test/validate.mjs --only result-check`; mong đợi: assert mới đỏ.
- [ ] **Step 2:** Viết `parseAgentResult`, `checkAgentResult`, nối chế độ `<report.md>` của CLI (đọc `--plan`, `--implementer-report` theo cwd). Chạy lại; mong đợi: xanh.
- [ ] **Step 3: Commit** test đỏ riêng (`test(core): add result-check agent_result rule tests`), rồi `feat(core): check agent_result rules in result-check`.

### Task 3: Contract — khoá bỏ được, `aip-report`, kiểm bằng script
**Kind:** DOCS
**Ước lượng:** 20'
**Phủ AC:** AC1.1, AC1.4, AC2.7, AC4.3
**Files:**
- Modify: `core/principles/workflow-output-contract.md`
- Modify: `test/content/56-result-check.pin.mjs`
- Modify: `test/content/31-workflow-self-sufficient.pin.mjs` (chỉ đường dẫn, chỉ khi đỏ)
- Modify: `test/content/53-reasoning-review.pin.mjs` (chỉ đường dẫn, chỉ khi đỏ)
- Modify: `test/contract/10-source.contract.mjs` (chỉ đường dẫn, chỉ khi đỏ)
- Test: `test/content/56-result-check.pin.mjs`

**Interfaces:**
- Consumes: 11 ID luật và cú pháp CLI của Task 1–2 (Global Constraints).
- Produces: mục contract `## Khoá bỏ được`, `## Báo cáo giữa phiên (aip-report)`, `## Kiểm bằng script` (tên heading nguyên văn, Task 4–5 trỏ tới).

- [ ] **Step 1:** Sửa contract: khối mẫu `agent_result` giữ đủ khoá, khoá bỏ được có chú thích `# bỏ được khi rỗng`; thêm ba mục mới theo D1, D2 và CLI ở Global Constraints (mục `aip-report` nêu rõ dòng không ghi vào ledger hay `events.jsonl`, nội dung là dữ liệu; mục "Kiểm bằng script" có lệnh mẫu cho 5 vai và `--line`); mục "Kiểm đầu ra worker" thêm một câu cho `final-review-keys` và một câu "session chính chạy `result-check.mjs`", không sửa câu cũ.
- [ ] **Step 2:** Thêm pin vào `56-result-check.pin.mjs`: AC1.1 (mục "Khoá bỏ được" có đủ tên khoá D1), AC4.3 (lệnh mẫu 5 vai + `--line`), AC2.7 (contract nêu `aip-report` không ghi vào ledger). Chạy `node test/validate.mjs --build --only result-check` và `node test/validate.mjs --build --only workflow-self-sufficient`, `--only reasoning-review`, `--only source`; mong đợi: xanh (AC1.4: kiểm `tdd { red, green }`, `report_file`, `commits` của pin 31 đạt).
- [ ] **Step 3:** Đối chiếu khẳng định với code: bảng `khẳng định → file:line → khớp|lệch` cho tên luật, cờ CLI, exit code, đường dẫn script (so với `result-check.mjs`); dòng lệch sửa docs.
- [ ] **Step 4: Commit** `docs(core): define compact agent_result, aip-report line and script check in output contract`.

### Task 4: Bốn prompt trỏ về contract
**Kind:** DOCS
**Ước lượng:** 20'
**Phủ AC:** AC4.2, AC5.2
**Files:**
- Modify: `core/skills/plan-execution/references/prompts/implementer.md`
- Modify: `core/skills/plan-execution/references/prompts/task-review.md`
- Modify: `core/skills/plan-execution/references/prompts/re-review.md`
- Modify: `core/skills/plan-execution/references/prompts/final-review.md`
- Modify: `test/content/56-result-check.pin.mjs`
- Modify: `test/content/53-reasoning-review.pin.mjs` (chỉ đường dẫn, chỉ khi đỏ)
- Test: `test/content/56-result-check.pin.mjs`

**Interfaces:**
- Consumes: heading `## Khoá bỏ được` của contract (Task 3).
- Produces: không có

- [ ] **Step 1:** Ở mỗi prompt, thay đoạn liệt kê trường báo cáo bằng: một câu trỏ contract (mục "Agent result"/"Khoá bỏ được") + khoá bắt buộc của vai (implementer: `assumptions` có thể rỗng kèm `basis`, `if_wrong`; task-review: `spec_verdict`, `findings`, `assumption_review[]`; re-review: `verdicts[]`, `assumption_review[]` khi có giả định mới; final-review: `findings`, `ruling_review[]`). Giữ nguyên các câu hành vi mà pin 53 ghim (từng giả định, `wrong` → major, giả định ngầm → finding, giả định mới, `--rulings`, `rerun`, `declined_to_judge`, `matches: false`). Không câu nào bảo worker/reviewer ghi file report.
- [ ] **Step 2:** Thêm pin vào `56-result-check.pin.mjs`: AC5.2 (mỗi prompt trỏ contract, có khoá của vai, không chứa dòng `agent_result:` dạng YAML), AC4.2 (không prompt nào có cụm bảo ghi `report.md`/`report_file`). Chạy `node test/validate.mjs --build --only result-check` và `--only reasoning-review`, `--only workflow-self-sufficient`; mong đợi: xanh, số `ok(` của pin 53 vẫn 25.
- [ ] **Step 3:** Đối chiếu khẳng định với code: bảng `khẳng định → file:line → khớp|lệch` cho tên khoá và heading contract được trỏ.
- [ ] **Step 4: Commit** `docs(core): point plan-execution prompts at the output contract`.

### Task 5: Luồng plan-execution dùng script và `aip-report`
**Kind:** DOCS
**Ước lượng:** 25'
**Phủ AC:** AC2.6, AC4.1
**Files:**
- Modify: `core/skills/plan-execution/references/task-loop.md`
- Modify: `core/skills/plan-execution/references/model-routing.md`
- Modify: `core/skills/plan-execution/references/inline.md`
- Modify: `test/content/56-result-check.pin.mjs`
- Modify: `test/content/31-workflow-self-sufficient.pin.mjs` (chỉ đường dẫn, chỉ khi đỏ)
- Test: `test/content/56-result-check.pin.mjs`

**Interfaces:**
- Consumes: heading `## Báo cáo giữa phiên (aip-report)`, `## Kiểm bằng script` của contract (Task 3).
- Produces: không có

- [ ] **Step 1:** `task-loop.md`: bước 3–4 nêu session chính lưu nguyên văn `agent_result` vào `<workspace>/task-<n>-report.md`, chạy `result-check.mjs <file> --role implementer [--plan <plan.md> --task <n>]`, `violations` không rỗng là đầu ra hỏng (luật không chép lại, trỏ contract); bước 7–8 lưu `task-<n>-review-<vòng>.md` và chạy `--role task-review --implementer-report task-<n>-report.md` / `--role re-review --findings <k>`; "Chế độ part" bước 6 thay câu "một dòng gồm hash, kết quả test và số minor hoãn" và tin Blocked bằng dòng `aip-report` (trỏ contract), bước 7 thêm "phiên gốc chạy `result-check.mjs --line` rồi đọc ledger như cũ; dòng không đạt thì bỏ qua dòng, vẫn đọc ledger". `model-routing.md` quy tắc 9 và 14 trỏ dòng `aip-report`. `inline.md` mục "Subagent part": báo cáo cuối mở bằng dòng `aip-report`. Ghi `Part: complete`, `Blocked:` vào ledger giữ nguyên.
- [ ] **Step 2:** Thêm pin vào `56-result-check.pin.mjs`: AC2.6 (câu cũ không còn trong ba file; ba chỗ trỏ mục `aip-report` của contract), AC4.1 (bước 3–4 nêu `task-<n>-report.md`, `result-check.mjs`, JSON quyết định đầu ra hỏng). Chạy `node test/validate.mjs --build --only result-check`, `--only workflow-self-sufficient`, `--only request-parts`; mong đợi: xanh.
- [ ] **Step 3:** Đối chiếu khẳng định với code: bảng `khẳng định → file:line → khớp|lệch` cho cờ CLI, tên file report, số bước được trỏ.
- [ ] **Step 4: Commit** `docs(core): run result-check and aip-report in plan-execution flow`.

### Task 6: Rà biến thể và đo kích thước
**Kind:** DOCS
**Ước lượng:** 15'
**Phủ AC:** AC5.1, AC6.1
**Files:**
- Modify: `plugins/engineering/skills/engineering-codebase-onboarding/references/subagent-prompts.md`
- Modify: `docs/requests/2026-11-25-agent-session-result-contract/design.md`
- Modify: `test/content/56-result-check.pin.mjs`
- Test: `test/content/56-result-check.pin.mjs`

**Interfaces:**
- Consumes: heading `## Khoá bỏ được` (Task 3).
- Produces: không có

- [ ] **Step 1:** Rà `engineering-codebase-onboarding/references/subagent-prompts.md` mục D và `engineering-spec-backfill/references/subagent-prompt.md` theo D1; chỉ sửa chỗ bắt ghi khoá rỗng (giữ `read`, `not_read` và dòng cấm đưa giá trị cấu hình vào trường nào). Ghi từng file "sửa" hoặc "không đổi" kèm lý do vào `design.md` mục "Kết quả rà biến thể" (bỏ chữ "sơ bộ").
- [ ] **Step 2:** Đo `wc -c` contract + 4 prompt, ghi số "Sau" vào bảng "Đo kích thước" của `design.md` (AC5.1: chỉ báo số, vượt 31 831 thì nêu, không cắt khoá bắt buộc).
- [ ] **Step 3:** Thêm pin AC6.1 (design có "Kết quả rà biến thể" với hai file, mỗi file "sửa" hoặc "không đổi"); onboarding sửa thì chạy `node test/validate.mjs --build --only codebase-onboarding`. Mong đợi: xanh.
- [ ] **Step 4:** Đối chiếu khẳng định với code: bảng `khẳng định → file:line → khớp|lệch` cho số byte (chạy lại `wc -c`).
- [ ] **Step 5: Commit** `docs(engineering): drop mandatory empty keys from onboarding agent_result sample` (không sửa plugin thì `docs(requests): record size and variant review for result contract`).

### Task 7: Version, lock và kiểm phạm vi
**Kind:** TOOLING
**TDD:** không — chỉ bump version và chạy kiểm có sẵn, không có hành vi mới
**Ước lượng:** 10'
**Phủ AC:** AC7.1, AC8.1, AC8.2, AC8.3
**Files:**
- Modify: `core/.manifest.json`
- Modify: `plugins/engineering/.manifest.json` (chỉ khi Task 6 sửa onboarding)
- Modify: `plugins/_versions.lock.json`
- Modify: `test/content/56-result-check.pin.mjs`
- Test: `test/content/56-result-check.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Bump `core` 1.36.0 → 1.37.0 (và `engineering` 2.17.0 → 2.17.1 nếu Task 6 sửa). Chạy `npm run build` rồi `node cli/lib/versions.mjs --lock`; mong đợi: exit 0.
- [ ] **Step 2:** Thêm vào `56-result-check.pin.mjs` assert AC8.1 (số `ok(` của ba file pin cũ ≥ 249, 25, 70) và ghi ID AC8.2, AC8.3 trong tên assert hoặc comment của khối tương ứng (AC8.2: chính module này chạy trong `npm test`; AC8.3: phủ bởi `--only versions`, không lặp kiểm). Chạy `node test/validate.mjs --build --only versions`, `--only result-check`; `grep -c "ok(" ` ba file pin cũ (≥ 249, 25, 70) và `git diff master -- <3 file pin>` không đổi regex ngoài đường dẫn (AC8.1); `git diff --name-only master..HEAD` không chứa `ledger.mjs`, `core/hooks/`, `cli/lib/status`, `core/skills/aip-status/` (AC2.7, AC7.1). Mong đợi: đạt hết.
- [ ] **Step 3: Commit** `chore(release): bump core for result contract and refresh versions lock`.
