# Living spec bootstrap Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Chặn vòng lặp "Không ảnh hưởng: chưa có spec" (W23, `finish.md`, `engineering-spec-writing`, `init --full`), thêm skill `engineering-spec-backfill` dựng spec sống cho project đã có code, và `aip status --requests` liệt kê request đang mở.
**Architecture:** W23 là một nhánh mới trong `checkRequest` nhận cờ `specsIndex` từ `main()`; token trạng thái đọc bằng một hàm export từ `check-request.mjs` để `status.mjs` dùng chung với W15; `--requests` là nhánh riêng của `runStatus`; skill backfill là nội dung `plugins/engineering/` kèm một script kiểm trích dẫn.
**Tech Stack:** Node 20 ESM, zero dependency; test `node:assert` theo harness sẵn có (`ok`).
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/skills/artifact-templates/scripts/check-request.mjs` | W23; export `requestStatusToken` dùng chung với W15 | Task 1 |
| `test/contract/36-living-spec.contract.mjs` | Test W23 (tham số hoá) + CLI exit code | Task 1 |
| `cli/lib/status.mjs` | `listOpenRequests` + nhánh `--requests` của `runStatus` | Task 2 |
| `cli/lib/args.mjs` | Cờ `--requests` | Task 2 |
| `cli/index.mjs` | Dòng help của `status` | Task 2 |
| `test/status.test.mjs` | Test `--requests` (git giả + CLI thật) | Task 2 |
| `core/skills/artifact-templates/references/specs-readme.template.md` | Mẫu điểm vào spec sống cho `init --full` | Task 3 |
| `docs/specs/README.md` | Điểm vào spec của repo này, dạng mới | Task 3 |
| `test/init.test.mjs` | Test `init --full` tạo/không ghi đè README | Task 3 |
| `core/skills/plan-execution/references/finish.md` | Tạo spec/README khi thiếu; trạng thái ở mọi lựa chọn G3 | Task 4 |
| `plugins/engineering/skills/engineering-spec-writing/SKILL.md`, `references/spec-structure.md` | Quy tắc điền `## Ảnh hưởng spec` | Task 4 |
| `plugins/engineering/skills/engineering-spec-backfill/scripts/check-citations.mjs` | Kiểm `file:line` trích dẫn trong spec | Task 5 |
| `test/content/39-spec-backfill.pin.mjs` | Test `check-citations.mjs` | Task 5 |
| `plugins/engineering/skills/engineering-spec-backfill/SKILL.md`, `references/*.md` | Skill backfill | Task 6 |
| `plugins/engineering/.manifest.json`, `workflows/orchestrator/WORKFLOW.md` | Số skill 12; dòng route trực tiếp cho backfill | Task 6 |
| `docs/specs/{artifact-templates,workflows,cli-wizard}/spec.md` | Gộp spec sống theo `## Ảnh hưởng spec` | Task 7 |
| `README.md`, `README_VI.md`, `CLAUDE.md`, `core/skills/artifact-templates/SKILL.md`, `core/skills/artifact-templates/references/docs-conventions.md` | Nhắc W23, `--requests`, 12 skill | Task 7 |
| `core/.manifest.json`, `plugins/engineering/.manifest.json`, `plugins/_versions.lock.json` | Bump version + lock | Task 7 |

## Global Constraints
- Zero runtime dependency, Node built-ins; UTF-8 không BOM, LF; chuỗi hiển thị tiếng Việt có dấu; comment theo mục Comments của `AGENTS.md` (chỉ "vì sao", tiếng Việt).
- W23 điều kiện nguyên văn: `readSpec` có (cùng điều kiện W10), `legacy !== true`, `imp.none` có, `opts.specsIndex === false`; dòng báo `imp.line`; không truyền `specsIndex` thì không W23. `main()`: `specsIndex = fs.existsSync(path.join(specsDir, 'README.md'))`. Chỉ cảnh báo (exit 0, `--strict` exit 1).
- `STATUSES` giữ nguyên: `draft | approved | in-progress | merged | abandoned`. `--requests` bỏ `merged`, `abandoned`, `_TEMPLATE`, mục không phải thư mục; thiếu `design.md`/thiếu dòng `- Trạng thái:`/token lạ → `status: null` (hiển thị "không rõ").
- Nhánh dự kiến: `feature/` + tên thư mục bỏ `^\d{4}-\d{2}-\d{2}-`; "nghi đã merge" khi `git rev-parse --verify --quiet refs/heads/<nhánh>` và `git merge-base --is-ancestor <nhánh> HEAD` đều thành công; mọi lỗi git → không đánh dấu.
- `--requests` chỉ đi cùng `--json`; kèm `<request>`, `--html`, `--watch` hoặc `--part` → stderr + exit 2. JSON: `{ "requests": [{ "name", "status", "suspectMerged" }] }`. Chỉ đọc, không ghi file.
- Trạng thái ghi ở G3: merge local → `merged <hash merge>`; push + PR → `in-progress — PR nhánh <tên nhánh feature>` (commit docs trước khi push); giữ nguyên → `in-progress — nhánh <tên nhánh feature>`.
- Bản đồ docs sáu dòng: làm gì → specs; cấu trúc → ARD/overview; vì sao → decisions; giao tiếp → contracts; vận hành → runbooks; đang làm → lệnh `aip status --requests`. Không bảng request đang mở.
- Skill backfill chỉ ghi dưới `docs/specs/`, không sửa code; chạy lại khi đã có `docs/specs/` chỉ báo lệch, không ghi; subagent `general-purpose`, mỗi năng lực một con; request chưa `merged` không là nguồn.
- Testing theo `AGENTS.md`: một hành vi một test, nhiều đầu vào → một test tham số hoá; không pin văn xuôi. Sandbox dọn bằng `fs.rmSync`, không `rm -rf`.
- Mỗi task ≥ 1 commit trên `feature/living-spec-bootstrap`; không push, không merge.

## Review Focus
- Design có `Không ảnh hưởng` + `specsIndex: false` nhưng thư mục legacy (trước 2026-10-21) — Task 1, test tham số hoá ca legacy.
- `specsDir` lồng repo/pkg: `main()` phải tính README theo cùng `specsDir` của `readSpec` — Task 1, ca CLI trên thư mục tạm lồng `pkg/docs/...`.
- Dòng trạng thái có `—`/`–` dính token (`approved—x`) và chữ hoa (`Merged`) phải ra cùng token như W15 — Task 2, ca trong test `listOpenRequests` dùng `requestStatusToken`.
- `git` giả trả mã 1 cho `merge-base --is-ancestor` (không tổ tiên) khác với ném lỗi — Task 2, hai ca riêng trong cùng test tham số hoá.
- `check-citations.mjs` với dòng 0, dòng vượt cuối file, đường dẫn thoát khỏi repo (`../`) — Task 5.

### Task 1: W23 và token trạng thái dùng chung
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC2.1, AC2.2, AC2.3, AC2.4
**Files:**
- Modify: `core/skills/artifact-templates/scripts/check-request.mjs`
- Test: `test/contract/36-living-spec.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `requestStatusToken(line: string): string | null` (token đầu đã chữ thường của dòng `- Trạng thái:`, `null` khi dòng không khớp `^-\s+Trạng thái\s*:`); `opts.specsIndex` của `checkRequest`

- [ ] **Step 1:** Thêm vào `36-living-spec.contract.mjs` một test tham số hoá `AC2.1–AC2.3` gọi `cr.checkRequest` với `readSpec` có sẵn: ca (`Không ảnh hưởng: x`, `specsIndex:false`) → đúng một `W23` tại dòng heading; (`specsIndex:true`) → 0; (`- a: thêm R1`, `specsIndex:false`) → 0; ba lý do khác nhau (có/không chữ "spec") với `specsIndex:false` → mỗi ca một W23; ca legacy và ca không truyền `specsIndex` → 0 (`AC2.4`). Thêm ca `requestStatusToken` (`'- Trạng thái: approved — x'` → `approved`; `'- Trạng thái: Merged'` → `merged`; dòng không khớp → `null`). Chạy `node test/validate.mjs --only living-spec` → đỏ.
- [ ] **Step 2:** Hiện thực W23 trong `checkRequest` theo Global Constraints, export `requestStatusToken` và cho W15 dùng nó (W15 không đổi kết quả). Chạy lại → xanh.
- [ ] **Step 3:** Thêm ca CLI `AC2.4`: chạy `check-request.mjs` trên thư mục tạm `<tmp>/docs/requests/2026-11-04-x/` (design `Không ảnh hưởng: x`, không có `docs/specs/README.md`) → stdout có `[W23]`, exit 0; thêm `--strict` → exit 1; tạo `<tmp>/docs/specs/README.md` → không W23. Chạy `node test/validate.mjs --only living-spec` → xanh; `node test/validate.mjs --only artifact-templates` → xanh.
- [ ] **Step 4:** Commit `feat(artifact-templates): warn W23 when no living spec index exists`.

### Task 2: `aip status --requests`
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC6.1, AC6.2, AC6.3, AC6.4, AC6.5
**Files:**
- Modify: `cli/lib/status.mjs`
- Modify: `cli/lib/args.mjs`
- Modify: `cli/index.mjs`
- Test: `test/status.test.mjs`

**Interfaces:**
- Consumes: `requestStatusToken(line: string): string | null`
- Produces: `listOpenRequests({ docsRoot, git }): Array<{ name: string, status: string | null, suspectMerged: boolean }>`

- [ ] **Step 1:** Thêm test `AC6.1` vào `status.test.mjs`: dựng `docs/requests/` tạm gồm `draft`, `approved`, `in-progress`, `merged`, `abandoned`, thiếu dòng trạng thái, token lạ, thư mục chỉ có `requirement.md`, `_TEMPLATE`, một file thường → `listOpenRequests` trả đúng 6 mục (3 token mở + 3 `null`). Test tham số hoá `AC6.2/AC6.3` với `git` giả: tổ tiên → `suspectMerged: true`; mã 1 → `false`; nhánh không tồn tại → `false`; ném lỗi → `false` và không ném. Chạy `node test/status.test.mjs` → đỏ.
- [ ] **Step 2:** Hiện thực `listOpenRequests` (dùng `requestStatusToken`, `tryGit` sẵn có) và nhánh `args.requests` trong `runStatus` trước đoạn chọn request; thêm `--requests` vào `args.mjs`; thêm dòng help ở `cli/index.mjs`. Chạy lại → xanh.
- [ ] **Step 3:** Thêm ca CLI thật: `AC6.4` `aip status --requests --json` → `JSON.parse` được với khoá `requests[].name/status/suspectMerged`, thư mục không có file mới; `--requests --html`, `--requests --watch`, `--requests --part 01`, `--requests <tên>` → exit 2; `AC6.5` không có `docs/requests/` → một dòng thông báo, exit 0. Chạy `node test/status.test.mjs` và `node test/args.test.mjs` → xanh.
- [ ] **Step 4:** Commit `feat(cli): list open requests with aip status --requests`.

### Task 3: README điểm vào spec sống
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC4.1, AC4.2, AC7.1
**Files:**
- Create: `core/skills/artifact-templates/references/specs-readme.template.md`
- Modify: `docs/specs/README.md`
- Test: `test/init.test.mjs`

**Interfaces:**
- Consumes: lệnh `aip status --requests` (Task 2, chỉ nhắc tên trong README)
- Produces: `core/skills/artifact-templates/references/specs-readme.template.md` (mẫu Task 4 và Task 6 trỏ tới)

- [ ] **Step 1:** Thêm test `AC4.1/AC4.2` vào `init.test.mjs`: `init({root, full:true})` trên thư mục tạm → `docs/specs/README.md` có trong `created` và chứa `aip status --requests`; file có sẵn khác nội dung → không đổi byte, nằm trong `skipped`; `init({root})` không `--full` → không có file. Chạy `node test/init.test.mjs` → đỏ.
- [ ] **Step 2:** Tạo `core/skills/artifact-templates/references/specs-readme.template.md`: tiêu đề, bảng năng lực rỗng `| Năng lực | Mô tả | Spec |`, đoạn "spec sống tạo dần", bản đồ docs sáu dòng (Global Constraints), dòng `aip status --requests`, một dòng trỏ skill `engineering-spec-backfill` cho project đã có code. Chạy lại → xanh.
- [ ] **Step 3:** Đổi `docs/specs/README.md` của repo sang dạng mới: giữ bảng 7 năng lực và đoạn tạo dần, rút đoạn "Backfill 2026-10-23" thành một dòng, thêm bản đồ docs (cột "cấu trúc" trỏ `CLAUDE.md` mục Architecture vì repo không có ARD; "vận hành" ghi "chưa có" nếu không có runbook) và dòng lệnh. Kiểm `AC7.1` bằng đọc lại hai file. Chạy `node test/validate.mjs --build` → xanh (đã có `npm run build`).
- [ ] **Step 4:** Commit `feat(init): scaffold docs/specs/README.md as the living spec entry point`.

### Task 4: `finish.md` và `engineering-spec-writing`
**Kind:** DOCS
**Phủ AC:** AC1.1, AC3.1, AC3.2, AC3.3, AC3.4
**Files:**
- Modify: `core/skills/plan-execution/references/finish.md`
- Modify: `plugins/engineering/skills/engineering-spec-writing/SKILL.md`
- Modify: `plugins/engineering/skills/engineering-spec-writing/references/spec-structure.md`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: `core/skills/artifact-templates/references/specs-readme.template.md`
- Produces: không có

- [ ] **Step 1:** `engineering-spec-writing`: thêm quy tắc điền `## Ảnh hưởng spec` (đọc `docs/specs/README.md`; năng lực chưa có spec → `- <năng-lực>: thêm R1…`; "chưa có spec" không phải lý do `Không ảnh hưởng`; nhắc năng lực mới cần `spec.md` ở bước gộp). Giữ khung H2 và độ dài description.
- [ ] **Step 2:** `finish.md` bước 2: năng lực chưa có `spec.md` → tạo từ `spec.template.md` (bỏ khối chú thích, có bảng Lịch sử); chưa có `docs/specs/README.md` → tạo theo `core/skills/artifact-templates/references/specs-readme.template.md` rồi thêm dòng năng lực. Bước G3/"Chi tiết từng lựa chọn": bảng trạng thái ba lựa chọn (Global Constraints) và dòng nhắc người merge tay đặt `merged <hash>` + xoá `plan.md` (W16). Rà `workflows/feature/WORKFLOW.md` Bước 7, chỉ sửa nếu mâu thuẫn.
- [ ] **Step 3:** `npm run build` rồi `node test/validate.mjs --build` → xanh (contract khung H2, description, pin hiện có của `finish.md`).
- [ ] **Step 4:** Commit `docs(plan-execution): create first living spec and record status on every G3 choice`.

### Task 5: `check-citations.mjs`
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC5.4
**Files:**
- Create: `plugins/engineering/skills/engineering-spec-backfill/scripts/check-citations.mjs`
- Test: `test/content/39-spec-backfill.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `checkCitations(specText: string, { root: string }): Array<{ line: number, ref: string, reason: string }>`; CLI `node check-citations.mjs <spec.md|thư mục specs> [--root <dir>]` (exit 0 khi không lỗi, exit 1 khi có trích dẫn hỏng, exit 2 khi sai đối số)

- [ ] **Step 1:** Viết test tham số hoá `AC5.4` trong `39-spec-backfill.pin.mjs` (theo mẫu `export default async function run({ ok, ctx })`): trích dẫn `` `src/a.js:3` `` với file 5 dòng → 0 lỗi; dòng 0, dòng 6, file không tồn tại, `../x.js:1` thoát khỏi root → mỗi ca một lỗi; dòng `[Unverified]` không có `file:line` → bỏ qua. Ca CLI: exit 1 khi có lỗi, exit 0 khi sạch. Chạy `node test/validate.mjs --only spec-backfill` → đỏ.
- [ ] **Step 2:** Hiện thực script zero-dep (chỉ đọc file, không gọi git). Chạy lại → xanh.
- [ ] **Step 3:** Commit `feat(engineering): add citation checker for living spec backfill`.

### Task 6: Skill `engineering-spec-backfill`
**Kind:** DOCS
**Phủ AC:** AC5.1, AC5.2, AC5.3, AC5.5, AC5.6
**Files:**
- Create: `plugins/engineering/skills/engineering-spec-backfill/SKILL.md`
- Create: `plugins/engineering/skills/engineering-spec-backfill/references/sources.md`
- Create: `plugins/engineering/skills/engineering-spec-backfill/references/subagent-prompt.md`
- Create: `plugins/engineering/skills/engineering-spec-backfill/references/drift-report.md`
- Modify: `plugins/engineering/.manifest.json`
- Modify: `workflows/orchestrator/WORKFLOW.md`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: `checkCitations` CLI (Task 5); `core/skills/artifact-templates/references/specs-readme.template.md` (Task 3)
- Produces: skill id `engineering-spec-backfill`

- [ ] **Step 1:** Viết `SKILL.md` theo `skill.template.md` và mục "Adding capability content" của `CLAUDE.md`: frontmatter đủ khoá (`order` sau `engineering-spec-writing`), description theo design (đếm ≤ 500 ký tự, trigger không trùng skill khác), `## Quy trình…` 7 bước của design mục B (cổng duyệt năng lực trước khi tạo subagent; mỗi năng lực một `general-purpose`; bước kiểm chạy `check-request.mjs` W14 + `scripts/check-citations.mjs`; cổng duyệt diff + `core:git-workflow`; chạy lại chỉ báo lệch), `## Ranh giới an toàn…` (chỉ ghi `docs/specs/`, không sửa code, không push, request chưa `merged` không là nguồn).
- [ ] **Step 2:** Viết ba reference: `sources.md` (thứ tự kiểm kê rẻ→đắt, bảng nguồn của `R<n>` từ design), `subagent-prompt.md` (mẫu prompt mỗi năng lực: đầu vào, chỉ ghi `docs/specs/<năng-lực>/spec.md`, định dạng `agent_result`), `drift-report.md` (hai nhóm: R không còn đúng; hành vi chưa có R).
- [ ] **Step 3:** Cập nhật `plugins/engineering/.manifest.json` (12 skill, liệt kê `engineering-spec-backfill`); thêm một dòng vào bảng "Yêu cầu chạy trực tiếp bằng skill" của `workflows/orchestrator/WORKFLOW.md`.
- [ ] **Step 4:** `npm run build` rồi `node test/validate.mjs --build` → xanh (AC5.1: skill được nạp, contract conventions/frontmatter/routing qua).
- [ ] **Step 5:** Commit `feat(engineering): add engineering-spec-backfill skill`.

### Task 7: Gộp spec sống, tài liệu, version
**Kind:** DOCS
**Phủ AC:** AC8.1, AC8.2, AC8.3, AC8.4
**Files:**
- Modify: `docs/specs/artifact-templates/spec.md`
- Modify: `docs/specs/workflows/spec.md`
- Modify: `docs/specs/cli-wizard/spec.md`
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `CLAUDE.md`
- Modify: `core/skills/artifact-templates/SKILL.md`
- Modify: `core/skills/artifact-templates/references/docs-conventions.md`
- Modify: `core/.manifest.json`
- Modify: `plugins/engineering/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: mọi thay đổi của Task 1–6
- Produces: không có

- [ ] **Step 1:** Gộp spec theo `## Ảnh hưởng spec` của design: `artifact-templates` đổi R3, thêm R15–R17; `workflows` thêm R18–R19; `cli-wizard` thêm R9; mỗi R có `Nguồn:` link request này (và tên test), mỗi spec thêm dòng Lịch sử, cập nhật dòng `Cập nhật:`.
- [ ] **Step 2:** `README.md`/`README_VI.md`/`CLAUDE.md`: "W1–W22" → "W1–W23" (nêu W23), lệnh `aip status` có `--requests`, `engineering` 12 skill (nêu `engineering-spec-backfill`); `artifact-templates/SKILL.md` + `docs-conventions.md` mô tả W23 và README điểm vào. `README_VI.md` khớp `README.md`.
- [ ] **Step 3:** Bump `core/.manifest.json` (minor) và `plugins/engineering/.manifest.json` (minor); `npm run build`; `node cli/lib/versions.mjs --lock`.
- [ ] **Step 4:** `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-04-living-spec-bootstrap/ --base master` → không W10–W14, W23 (W7 cho AC chỉ kiểm bằng review được ghi vào `remaining_risks`); `npm test` → exit 0 (AC8.1).
- [ ] **Step 5:** Commit `docs(specs): merge living-spec-bootstrap into living specs and bump versions`.

## Rủi ro còn lại
- AC1.1, AC3.1–AC3.4, AC5.2, AC5.3, AC5.5, AC5.6, AC7.1, AC8.4 kiểm bằng review và `grep`, không có test nhắc ID (AGENTS.md: không pin văn xuôi), nên W7 sẽ báo chúng; ghi vào `remaining_risks` khi kết thúc nhánh.
- AC5.2–AC5.6 chỉ có bằng chứng thật khi chạy skill trên một project mẫu (vd `content-automation-platform`); việc đó nằm ngoài nhánh này.
