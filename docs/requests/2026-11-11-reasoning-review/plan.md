# Reasoning Review Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** implementer khai giả định và reviewer xét từng giả định; `Ruling:` dựa vào số đo có lệnh chạy lại, được `ledger.mjs --rulings` liệt kê kèm cờ và review cuối chạy lại; thêm hai case eval về lập luận.
**Architecture:** sửa contract đầu ra và mẫu prompt của `plan-execution`; thêm nhánh chỉ-đọc `--rulings` vào `ledger.mjs`, tách hàm thuần `workspaceDirs` khỏi `resolveWorkspace`; đồng bộ agent file và `workflow-feature`.
**Tech Stack:** Node 20+ ESM, zero dependency; Markdown tiếng Việt; harness `test/validate.mjs`.
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/skills/plan-execution/scripts/workspace.mjs` | Tính đường dẫn workspace (hàm thuần `workspaceDirs`) và tạo workspace (`resolveWorkspace`) | Task 1 |
| `core/skills/plan-execution/scripts/ledger.mjs` | Ghi dòng ledger; nhánh chỉ-đọc `--rulings` liệt kê Ruling kèm cờ | Task 1 |
| `test/contract/98-ledger-rulings.contract.mjs` | Test `rulingFlags`, `--rulings`, `workspaceDirs` | Task 1 |
| `core/principles/workflow-output-contract.md` | Khoá `assumptions`, `assumption_review[]`, `rerun`, luật kiểm đầu ra | Task 2 |
| `core/skills/plan-execution/references/prompts/implementer.md` | Đòi implementer khai `assumptions` | Task 2 |
| `core/skills/plan-execution/references/prompts/task-review.md` | Reviewer xét từng giả định | Task 2 |
| `core/skills/plan-execution/references/prompts/re-review.md` | Re-review xét giả định mới của vòng sửa | Task 2 |
| `test/content/53-reasoning-review.pin.mjs` | Pin nội dung AC1.x, AC3.x | Task 2, 3, 4, 5 |
| `core/skills/plan-execution/references/task-loop.md` | Loại dừng 6, cú pháp `chạy lại:`, xử lý `assumption_review[]`, gom Ruling của "Chế độ part" | Task 3 |
| `core/skills/plan-execution/references/prompts/final-review.md` | Đầu vào `--rulings`, chạy lại, nhãn cần người dùng quyết | Task 3 |
| `core/skills/plan-execution/SKILL.md` | Bước 3 trỏ `--rulings`; Tham chiếu dòng script | Task 3 |
| `core/skills/plan-execution/references/finish.md` | Ruling cần người dùng quyết đứng riêng ở G3 | Task 3 |
| `core/skills/plan-execution/references/inline.md` | Review cuối inline đọc `--rulings` | Task 3 |
| `workflows/feature/WORKFLOW.md` | Bước 4 mẫu Ruling ba phần; Bước 6 `--rulings` + chạy lại; Bước 7 nhãn ở G3 | Task 4 |
| `plugins/backend/agents/backend-implementer.md`, `backend-fixer.md`, `backend-reviewer.md` | Report trả về có `assumptions` / `assumption_review[]` / `rerun` | Task 5 |
| `plugins/frontend/agents/frontend-implementer.md`, `frontend-fixer.md`, `frontend-reviewer.md` | Như trên, phía frontend | Task 5 |
| `evals/workflows/task-review-assumption/**` | Case eval giả định sai của implementer | Task 6 |
| `evals/workflows/final-review-ruling-evidence/**` | Case eval Ruling không khớp bằng chứng | Task 6 |
| `evals/README.md`, `evals/README_VI.md` | Hai hàng mới ở bảng "Cases" | Task 6 |
| `docs/specs/workflows/spec.md` | R1, R2, R7 đổi; R24 thêm; Lịch sử | Task 7 |
| `core/.manifest.json`, `workflows/.manifest.json`, `plugins/backend/.manifest.json`, `plugins/frontend/.manifest.json`, `plugins/_versions.lock.json` | Bump version và khoá | Task 8 |

## Global Constraints
- Định dạng giả định: `assumptions: [ { assumption, basis, if_wrong } ]`; `basis` là `file:line`, mục brief, hoặc `không có`; được phép rỗng `[]`. Chỉ ghi điều implementer đã chọn mà brief, AC và Interfaces không nói.
- `assumption_review[]`: mỗi giả định một mục `{ assumption, verdict: holds | wrong | unverifiable, evidence }`; số mục bằng số giả định của báo cáo.
- Luật kiểm đầu ra (chỉ khi subagent trả `agent_result` trong vòng task): implementer thiếu khoá `assumptions` → đầu ra hỏng; `assumptions: []` hợp lệ; reviewer task-review có báo cáo với `assumptions` không rỗng mà `assumption_review[]` thiếu hoặc số mục khác → đầu ra hỏng.
- Cú pháp Ruling: `Ruling: <quyết định> — <lý do> — <chi phí nếu sai>`, phần thứ tư tuỳ chọn `— chạy lại: `<lệnh>``, bắt buộc khi lý do dựa vào số đo, kết quả test hay thử nghiệm.
- `ruling_review[]` mỗi mục có thêm `rerun: { command, exit_code, matches: true | false }` khi Ruling có `chạy lại:`.
- Lệnh: `node <thư mục skill plan-execution>/scripts/ledger.mjs <plan.md|requestDir> --rulings`; exit 0 kể cả khi có cờ; exit 2 khi thiếu đối số (kể cả `ledger.mjs --rulings` một mình); không ghi ledger, không tạo `.aip`; không có Ruling thì in `(không có Ruling)`.
- Cờ nguyên văn: `thiếu phần`, `số đo không có lệnh chạy lại`; dòng lệnh in `chạy lại: <lệnh>`; nguồn in `[root]` hoặc `[<nn>-<part-slug>]`.
- Bộ nhận số đo (chỉ khi không có `chạy lại:`): số kèm đơn vị `ms`, `s`, `giây`, `phút`, `%`, `KB`, `MB`, `GB`, `req/s`; `exit <n>`; cụm `test xanh`, `benchmark`, `đã đo` có ranh giới chữ. Không bắt `lần`, `pass`, `đo` trần.
- Nhãn review cuối: `cần người dùng quyết` (Ruling có `matches: false`, cờ `số đo không có lệnh chạy lại`, hoặc lý do sai với code).
- Không đổi: hành vi ghi dòng của `ledger.mjs`, `review-package.mjs`, `task-brief.mjs`, hook, `graph.json`. Pin hiện có (`31-workflow-self-sufficient`, `38-scope-discipline`, `43-progress-plan-quality`) phải xanh mà không sửa: chỉ thêm câu, giữ cụm đã pin (vd "tái lập được từ nhánh", "Missing", "ADDRESSED").
- Tiếng Việt có dấu, UTF-8 không BOM, LF; commit qua `core:git-workflow` (header tiếng Anh, body tiếng Việt, `git commit -F`), không `Co-Authored-By`.
- Lệnh pin của request: `node test/validate.mjs --build --only 53-reasoning-review`; test script: `node test/validate.mjs --only 98-ledger-rulings`.

## Review Focus
- `ledger.mjs <plan> --rulings` không bao giờ ghi `--rulings` thành dòng ledger, không tạo `.aip`: Task 1 (ca chưa có `.aip`, ca ledger có sẵn so nội dung trước/sau).
- `resolveWorkspace` giữ hành vi sau khi tách `workspaceDirs` (submodule, Windows, fallback worktree): Task 1 chạy lại test workspace/ledger hiện có (`--only 33-request-parts`, `--only 32-superpowers`, `--only 97-audit`) và `npm test` ở Task 8.
- Lệnh `chạy lại:` chứa ` — ` không làm đếm sai phần; Ruling bốn phần `ngoài AC, đổi hành vi — … — task <n> — …` không bị cờ: Task 1.
- Báo nhầm cờ số đo trên Ruling không có số (`cách chạy subagent — người dùng chọn — …`): Task 1.
- Không làm đỏ pin cũ khi sửa prompt và task-loop: Task 2, Task 3 chạy `--only 31-workflow --only 43-progress --only 38-scope`.

### Task 1: ledger.mjs --rulings và workspaceDirs
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6
**Files:**
- Modify: `core/skills/plan-execution/scripts/workspace.mjs`
- Modify: `core/skills/plan-execution/scripts/ledger.mjs`
- Test: `test/contract/98-ledger-rulings.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `workspaceDirs(planArg, deps) → { main, top, request, part, plan }`; `rulingFlags(line) → { flags: string[], rerun: string | null }`; CLI `ledger.mjs <plan.md|requestDir> --rulings`

- [ ] **Step 1:** Viết test đỏ trong `test/contract/98-ledger-rulings.contract.mjs` (mẫu `97-audit-mustfix.contract.mjs`, repo git tạm): `rulingFlags` cho `Ruling: a — b` (cờ `thiếu phần`), `Ruling: a — b — c` (không cờ), `Ruling: a — b — c — chạy lại: \`x — y\`` (không cờ, `rerun` = `x — y`), `Ruling: giữ timeout — đo 40ms — chậm` (cờ số đo), `exit 0`/`test xanh` không lệnh (cờ số đo), `Ruling: cách chạy subagent — người dùng chọn — mất review` (không cờ), Ruling bốn phần `ngoài AC` (không cờ); `main([plan, '--rulings'])` với ledger `root` + một part in đủ dòng kèm nguồn, exit 0, nội dung ledger không đổi; request chưa có `.aip` in `(không có Ruling)`, exit 0, không tạo `.aip`; `main(['--rulings'])` exit 2; ghi dòng Ruling hai/ba/bốn phần bằng `main([plan, line])` vẫn exit 0; `workspaceDirs` trả cùng `request`/`part`/`plan` như `resolveWorkspace` mà không tạo thư mục. Chạy `node test/validate.mjs --only 98-ledger-rulings` → đỏ vì chưa có export.
- [ ] **Step 2:** Tách `workspaceDirs` trong `workspace.mjs`, `resolveWorkspace` gọi lại nó; thêm `rulingFlags`, `listRulings` và nhánh `--rulings` đầu `main` của `ledger.mjs` (trước kiểm dòng và `ledgerFile`), đọc `*/progress.md` dưới `.aip/runs/<request>/` của `main` rồi `top` khi khác, `root` trước, part theo tên.
- [ ] **Step 3:** Chạy `node test/validate.mjs --only 98-ledger-rulings --only 33-request-parts --only 32-superpowers --only 97-audit` → xanh; commit.

### Task 2: contract đầu ra và prompt implementer/task-review/re-review
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25'
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4
**Files:**
- Modify: `core/principles/workflow-output-contract.md`
- Modify: `core/skills/plan-execution/references/prompts/implementer.md`
- Modify: `core/skills/plan-execution/references/prompts/task-review.md`
- Modify: `core/skills/plan-execution/references/prompts/re-review.md`
- Test: `test/content/53-reasoning-review.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: tên trường `assumptions`, `assumption_review`, `rerun` trong contract (Task 3, Task 5 dùng nguyên chữ)

- [ ] **Step 1:** Viết pin đỏ `test/content/53-reasoning-review.pin.mjs` cho AC1.1–AC1.4: contract có khoá `assumptions` với `assumption`/`basis`/`if_wrong`, `assumption_review[]` với `holds | wrong | unverifiable`, `rerun: { command, exit_code, matches }`; "Kiểm đầu ra worker" có luật thiếu `assumptions` là đầu ra hỏng và luật reviewer về số mục; implementer.md đòi `assumptions` (có thể rỗng) kèm `basis`, `if_wrong`; task-review.md đòi `assumption_review[]` và giả định ngầm thấy trong diff thành finding; re-review.md chỉ xét giả định mới. Chạy lệnh pin → đỏ.
- [ ] **Step 2:** Thêm câu vào bốn file theo Global Constraints, không viết lại đoạn đã pin.
- [ ] **Step 3:** Chạy `node test/validate.mjs --build --only 53-reasoning-review --only 31-workflow --only 43-progress --only 38-scope` → xanh; commit.

### Task 3: task-loop, final-review, SKILL, finish, inline dùng --rulings và giả định
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC1.5, AC3.1, AC3.2, AC3.3
**Files:**
- Modify: `core/skills/plan-execution/references/task-loop.md`
- Modify: `core/skills/plan-execution/references/prompts/final-review.md`
- Modify: `core/skills/plan-execution/SKILL.md`
- Modify: `core/skills/plan-execution/references/finish.md`
- Modify: `core/skills/plan-execution/references/inline.md`
- Test: `test/content/53-reasoning-review.pin.mjs`

**Interfaces:**
- Consumes: `ledger.mjs <plan.md|requestDir> --rulings` (Task 1); tên trường `assumption_review`, `rerun` (Task 2)
- Produces: không có

- [ ] **Step 1:** Thêm pin đỏ: task-loop.md loại dừng 6 có vế giả định `wrong` mà hướng G1 dựa vào, có cú pháp `— chạy lại: \`<lệnh>\``, xử lý `wrong`/`unverifiable` như finding/`cannot_verify`, bước gom Ruling của "Chế độ part" trỏ `--rulings`; final-review.md đầu vào là output `--rulings`, reviewer chạy lệnh chỉ đọc và ghi `rerun`, lệnh ghi/ngoài repo vào `declined_to_judge`, nhãn `cần người dùng quyết`; SKILL.md bước 3 trỏ `--rulings`; finish.md G3 tách Ruling `cần người dùng quyết`; inline.md review cuối đọc `--rulings`. Chạy lệnh pin → đỏ.
- [ ] **Step 2:** Sửa năm file, giữ cụm đã pin ("tái lập được từ nhánh", mẫu `Ruling:` ba phần).
- [ ] **Step 3:** Chạy lệnh pin cùng `--only 31-workflow --only 43-progress --only 38-scope --only 48-ask` → xanh; commit.

### Task 4: workflow-feature Bước 4, 6, 7
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 15'
**Phủ AC:** AC3.2, AC3.3
**Files:**
- Modify: `workflows/feature/WORKFLOW.md`
- Test: `test/content/53-reasoning-review.pin.mjs`

**Interfaces:**
- Consumes: `ledger.mjs <plan.md|requestDir> --rulings` (Task 1)
- Produces: không có

- [ ] **Step 1:** Thêm pin đỏ: Bước 4 mẫu `Ruling: nhóm <nhãn> chạy tuần tự — <lý do> — <chi phí nếu sai>`; Bước 6 đầu vào trỏ `ledger.mjs --rulings` và hành động nêu chạy lại lệnh `chạy lại:`; Bước 7 nêu Ruling `cần người dùng quyết` đứng riêng ở G3. Chạy → đỏ.
- [ ] **Step 2:** Sửa `WORKFLOW.md` (không đổi số bước, title, ⏸ để `graph.json` vẫn khớp).
- [ ] **Step 3:** Chạy lệnh pin cùng `--only 50-workflows --only 38-scope` → xanh; commit.

### Task 5: agent file backend và frontend
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 15'
**Phủ AC:** AC3.4
**Files:**
- Modify: `plugins/backend/agents/backend-implementer.md`
- Modify: `plugins/backend/agents/backend-fixer.md`
- Modify: `plugins/backend/agents/backend-reviewer.md`
- Modify: `plugins/frontend/agents/frontend-implementer.md`
- Modify: `plugins/frontend/agents/frontend-fixer.md`
- Modify: `plugins/frontend/agents/frontend-reviewer.md`
- Test: `test/content/53-reasoning-review.pin.mjs`

Vượt trần 5 file: mỗi file thêm cùng một câu ngắn, tách hai task chỉ để hai plugin lệch nhau giữa chừng.

**Interfaces:**
- Consumes: tên trường `assumptions`, `assumption_review`, `rerun` (Task 2)
- Produces: không có

- [ ] **Step 1:** Thêm pin đỏ: mục "Report trả về" của hai implementer và hai fixer nhắc `assumptions`; hai reviewer nhắc `assumption_review[]` (task-review, re-review) và `rerun` trong `ruling_review[]`. Chạy → đỏ.
- [ ] **Step 2:** Thêm câu vào sáu file.
- [ ] **Step 3:** Chạy lệnh pin cùng `--only 31-workflow --only 80-frontmatter` → xanh; commit.

### Task 6: hai case eval về lập luận
**Kind:** DOCS
**TDD:** không — case eval không chạy trong `npm test`; cấu trúc kiểm bằng `95-evals.contract.mjs`
**Ước lượng:** 30'
**Phủ AC:** AC4.1, AC4.2
**Files:**
- Create: `evals/workflows/task-review-assumption/prompt.md`, `case.yaml`, `scaffold.sh`, `graders/*.md`
- Create: `evals/workflows/final-review-ruling-evidence/prompt.md`, `case.yaml`, `scaffold.sh`, `graders/*.md`
- Modify: `evals/README.md`
- Modify: `evals/README_VI.md`
- Test: `test/contract/95-evals.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

Giao `general-purpose` với `model: sonnet` (thiết kế scaffold và grader cần logic, không phải chép docs).

- [ ] **Step 1:** Case `task-review-assumption` theo mẫu `evals/workflows/task-review-spec` (không Bash, `runs: 3`, `tags` có `reasoning`): design nói `now` tính bằng mili-giây và mã hết hạn ném `COUPON_EXPIRED`; code so `expiresAt` với `now` như giây; báo cáo implementer trong ledger khai giả định "now tính bằng giây" và "test xanh"; test chỉ dùng đầu vào không lộ sai lệch. Grader: `assumption-rejected` (llm, bác giả định có bằng chứng từ design), `not-marked-complete` (llm), `scaffold-applied`, `skill-used`.
- [ ] **Step 2:** Case `final-review-ruling-evidence`: plan đã xong, ledger có `Ruling: hoãn major: chậm — đo 40ms dưới ngưỡng — chậm khi tải cao` (không lệnh chạy lại) và `Ruling: hoãn major: thiếu test hết hạn — AC2.1 đã có test phủ — lọt mã hết hạn` trong khi file test không có ca hết hạn. Grader: `ruling-no-rerun-flagged`, `ruling-contradicts-code` (dẫn file test), `not-clean` (không tuyên bố nhánh sạch), `scaffold-applied`, `skill-used`.
- [ ] **Step 3:** Thêm hai hàng vào bảng "Cases" của `evals/README.md` và `README_VI.md`, ghi chưa chạy [Unverified]; đối chiếu từng khẳng định trong hai hàng với file case (bảng khẳng định → file:line → khớp|lệch).
- [ ] **Step 4:** Chạy `node test/validate.mjs --only 95-evals` → xanh; commit.

### Task 7: spec sống workflows
**Kind:** DOCS
**TDD:** không — chỉ sửa tài liệu spec, kiểm bằng `check-request.mjs`
**Ước lượng:** 20'
**Phủ AC:** AC5.1
**Files:**
- Modify: `docs/specs/workflows/spec.md`
- Test: `core/skills/artifact-templates/scripts/check-request.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Đổi R1 (khoá `assumptions`), R2 (hai luật kiểm đầu ra mới), R7 (Bước 6 đọc `--rulings` và chạy lại); thêm R24 theo đoạn R24 của design; mỗi mục một dòng Lịch sử trỏ request này.
- [ ] **Step 2:** Đối chiếu từng khẳng định với code đã đổi ở Task 1–5 (bảng khẳng định → file:line → khớp|lệch).
- [ ] **Step 3:** Chạy `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-11-reasoning-review/ --base master` → không có W10–W14; commit.

### Task 8: bump version và chạy toàn bộ suite
**Kind:** TOOLING
**TDD:** không — task phát hành, bằng chứng là `npm test`
**Ước lượng:** 15'
**Phủ AC:** AC5.2
**Files:**
- Modify: `core/.manifest.json`
- Modify: `workflows/.manifest.json`
- Modify: `plugins/backend/.manifest.json`
- Modify: `plugins/frontend/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `npm test`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Bump patch: `core` 1.33.1 → 1.33.2, `workflows` 3.16.1 → 3.16.2, `backend` 1.15.1 → 1.15.2, `frontend` 1.16.1 → 1.16.2.
- [ ] **Step 2:** `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` → exit 0; commit.
