# Workflow aip tự đủ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa điểm mạnh của superpowers vào workflow, skill và agent của aip để chỉ dùng workflow aip, kiểm chứng bằng chạy thật + eval.
**Architecture:** Sáu giai đoạn tuần tự (P1–P6). P1–P5 sửa nội dung markdown (workflow, skill, agent, baseline) kèm pin/contract test, và thêm 3 script Node zero-dep + mở rộng hook `session-start`. P6 viết eval và chạy thử workflow mới trên một feature thật.
**Tech Stack:** Node 20+ ESM, zero dependency; test bằng `test/validate.mjs` (`ok(cond, msg)` trong module `export default async function run({ ok, ctx })`) và `test/*.test.mjs`.
**Spec:** design.md
**Requirement:** không có

## Global Constraints
- Zero runtime dependency, Node 20+, chạy Windows và Linux; source UTF-8 không BOM, LF.
- Skill: frontmatter `name`, `description`, `order`, `title`, `runsIn`, `invoke`; description ≤ 500 ký tự, một câu hành động + `Dùng khi người dùng muốn "…"` (3–5 trigger) + `Không dùng khi <case> → <id>.`; thân có H2 `## Quy trình…` và `## Ranh giới an toàn…` (`cli/lib/conventions.mjs`). Agent description ≤ 260 ký tự, kết thúc bằng `Dùng khi …`.
- Mọi `graph.json` qua `checkGraph`/`checkGraphAgainstBody`; cạnh `on_fail` lùi có `"max_attempts": 2`, trừ `gate.reject` của gate human và cạnh tới `blocked`/`ask_user`.
- Nội dung chiếu ra provider đổi → bump `.manifest.json` của plugin sở hữu, `npm run build`, `node cli/lib/versions.mjs --lock`. Mỗi giai đoạn bump lại plugin nào bị chạm trong giai đoạn đó.
- `AGENTS.md` trùng byte với `core/agents/AGENTS.template.md` sau chuẩn hoá xuống dòng.
- Nội dung tiếng Việt có dấu; không chép nguyên văn superpowers (MIT, © 2025 Jesse Vincent). Token máy đọc giữ tiếng Anh: `Task N: complete`, `Ruling:`, `Plan: complete`.
- Tập `kind`: `BE`, `FE-UI`, `FE-INT`, `E2E`, `DB`, `CT`, `DOCS`, `TOOLING`.
- Vòng sửa của vòng task: tối đa 3 vòng/task, đặt lại mỗi task, vòng 3 agent mới chạy opus. Bugfix: tổng 3 lần sửa thất bại ở Bước 6 → `ask_user`.
- Ledger: `docs/requests/<ngày>-<slug>/.sdd/progress.md`; `.sdd/.gitignore` chứa `*`; hook nạp tối đa 2000 ký tự, khoá tắt `ledgerInject: false`.
- Eval: `--runs 3 --max-cost-usd 20`; đạt khi cả 3 case có plugin ≥ không plugin và ít nhất 2 case Δ > 0.
- Commit qua `core:git-workflow` (`git commit -F`, header tiếng Anh, body tiếng Việt). Không thêm dòng `Co-Authored-By`.
- Pin test mới đặt trong `test/content/31-workflow-self-sufficient.pin.mjs`; mỗi khối test ghi ID AC trong thông điệp `ok`.

## Bản đồ file

| File | Trách nhiệm | Task |
|---|---|---|
| `core/skills/artifact-templates/scripts/check-request.mjs` | Thêm W17/W18 cho `**Kind:**` của task | 1 |
| `core/skills/artifact-templates/references/plan.template.md` | Thêm Bản đồ file, `**Kind:**`, `**Interfaces:**` | 1, 24 |
| `plugins/engineering/skills/engineering-plan-writing/` (mới) | Cách viết `plan.md` | 2 |
| `plugins/engineering/skills/engineering-task-breakdown/SKILL.md` | Quan hệ `tasks.md` ↔ `plan.md` | 2 |
| `plugins/engineering/skills/engineering-spec-writing/` | Làm rõ ý định ở session chính, playback, đề xuất, builder check, cỡ việc | 3 |
| `plugins/engineering/agents/engineering-spec-analyst.md` | Chỉ ghi tài liệu từ đầu vào đã chốt | 3 |
| `workflows/feature/{WORKFLOW.md,graph.json,references/*}` | Luồng mới | 4, 13 |
| `core/skills/plan-execution/` (mới) | Giao thức vòng task, 3 script, mẫu prompt, kết thúc nhánh | 7, 8 |
| `core/principles/workflow-output-contract.md` | Trường mới, vòng sửa, re-review, breaker | 9 |
| `plugins/{backend,frontend}/agents/*`, `plugins/*/skills/*-code-review`, `*-fix` | Nâng cấp agent/skill | 10, 11, 17 |
| `core/skills/git-workflow/SKILL.md` | Commit theo task, menu kết thúc, worktree hỏi một lần | 12 |
| `core/hooks/scripts/session-start.mjs` | Nạp ledger | 14 |
| `workflows/{bugfix,security-review,performance,orchestrator}/*` | Nâng cấp + giới hạn vòng lặp | 16, 19–21 |
| `core/agents/AGENTS.template.md`, `AGENTS.md`, `CLAUDE.md` | Mặc định quy trình là workflow aip | 25 |
| `docs/decisions/0004-*.md`, `docs/specs/*` | ADR + spec sống | 26 |
| `evals/workflows/*` | 3 case mới | 28 |

## Review Focus
- Plan không có heading `### Task` (cỡ thay đổi nhỏ, plan cũ): `check-request.mjs` không được cảnh báo W17/W18 → test ở Task 1.
- Heading `### Task N:` nằm trong khối code của plan: `task-brief` phải bỏ qua, chỉ cắt task thật → test ở Task 7.
- `review-package` với BASE == HEAD hoặc BASE không phải tổ tiên của HEAD: từ chối, exit khác 0, không ghi file rỗng → test ở Task 7.
- Ledger đã có dòng `Plan: complete` hoặc file ledger hỏng/không đọc được: hook không nạp, không lỗi, vẫn nạp handoff bình thường → test ở Task 14.
- Dự án đã cài managed block cũ (có mục "Superpowers workflow defaults"): `aip install` thay bằng mục mới, không để lại mục cũ hay hai bản → test ở Task 25.

---

## P1 — Làm rõ, thiết kế, plan

### Task 1: check-request kiểm `kind` + plan template
**Kind:** TOOLING
**Phủ AC:** AC2.1
**Files:**
- Modify: `core/skills/artifact-templates/scripts/check-request.mjs`
- Modify: `core/skills/artifact-templates/references/plan.template.md`
- Test: `test/content/31-workflow-self-sufficient.pin.mjs`

**Interfaces:**
- Produces: `export const TASK_KINDS` (mảng 8 chuỗi theo Global Constraints); cảnh báo `W17` (task thiếu dòng `**Kind:**`) và `W18` (giá trị ngoài `TASK_KINDS`), dòng cảnh báo = dòng heading task. Task = heading `### Task <n>` ngoài khối code. Plan không có task → không cảnh báo.
- Produces: plan template có `## Bản đồ file`, và mỗi task mẫu có `**Kind:**`, `**Interfaces:**`.

- [ ] **Step 1: Viết test đỏ** — trong pin 31, khối "AC2.1 check-request kind": dựng `texts` hợp lệ như pin 18 rồi thêm `### Task 1: x` không có `**Kind:**` → codes chứa `W17`; `**Kind:** QA` → `W18`; `**Kind:** BE` → không W17/W18; plan không có `### Task` → không W17/W18; `### Task 9: y` trong khối ```` ``` ```` không bị tính.
- [ ] **Step 2: Chạy** `node test/validate.mjs --only workflow-self-sufficient` — Expected: FAIL ở các ok W17/W18.
- [ ] **Step 3: Implement** trong `checkRequest` (sau khối W5), dùng lại `linesOf` và cách bỏ qua khối code đang có của `parseAcs`; thêm `TASK_KINDS` export.
- [ ] **Step 4: Sửa `plan.template.md`**: thêm `## Bản đồ file` (bảng File | Trách nhiệm | Task) trước `## Global Constraints`; task mẫu thêm `**Kind:** <BE|FE-UI|…>` và `**Interfaces:**` (Consumes/Produces). Giữ header superpowers tới Task 24.
- [ ] **Step 5: Chạy** `node test/validate.mjs --build` — Expected: PASS (gồm `35-artifact-templates` kiểm template qua validator).
- [ ] **Step 6: Commit** `feat(artifact-templates): validate plan task kind`.

### Task 2: skill `engineering-plan-writing` + quan hệ với task-breakdown
**Kind:** DOCS
**Phủ AC:** AC2.1, AC2.2, AC2.3, AC1.4
**Files:**
- Create: `plugins/engineering/skills/engineering-plan-writing/SKILL.md`
- Create: `plugins/engineering/skills/engineering-plan-writing/references/plan-structure.md`
- Create: `plugins/engineering/skills/engineering-plan-writing/references/self-review.md`
- Modify: `plugins/engineering/skills/engineering-task-breakdown/SKILL.md`
- Test: `test/content/31-workflow-self-sufficient.pin.mjs`

**Interfaces:**
- Consumes: `TASK_KINDS`, W17/W18 (Task 1).
- Produces: skill id `engineering-plan-writing`, `order: 8`, `runsIn: execute`, `invoke: per-request`; được Task 4 gọi ở Bước 4 của feature.

- [ ] **Step 1: Viết test đỏ** — pin "AC2.x plan-writing": file SKILL.md tồn tại; thân nhắc đủ `Bản đồ file`, `Global Constraints`, `Review Focus`, `**Interfaces:**`, `**Kind:**`, `check-request.mjs`; `references/self-review.md` có 5 mục (đếm dòng bắt đầu `1.`…`5.`); SKILL nói cỡ "thay đổi nhỏ" không có `plan.md` (AC1.4); `engineering-task-breakdown/SKILL.md` nhắc task trong `plan.md` trỏ ID task của `tasks.md` và một checkpoint duyệt chung (AC2.3).
- [ ] **Step 2: Chạy** `node test/validate.mjs --only workflow-self-sufficient` — Expected: FAIL.
- [ ] **Step 3: Viết skill** theo design mục Thiết kế/bảng Skill và agent; nội dung tóm ý từ `research/compare-design-plan.md` hàng 18–22; ánh xạ `kind` → chuỗi agent lấy nguyên từ design D13. Description: `Không dùng khi cần bảng việc giao cho người → engineering-task-breakdown.`
- [ ] **Step 4: Sửa `engineering-task-breakdown/SKILL.md`** (một mục ngắn về quan hệ với `plan.md`).
- [ ] **Step 5: Chạy** `node test/validate.mjs --build` — Expected: PASS (conventions, frontmatter, build có skill mới).
- [ ] **Step 6: Commit** `feat(engineering): add plan-writing skill`.

### Task 3: nâng cấp `engineering-spec-writing` + `engineering-spec-analyst`
**Kind:** DOCS
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4, AC1.5
**Files:**
- Modify: `plugins/engineering/skills/engineering-spec-writing/SKILL.md`
- Modify: `plugins/engineering/skills/engineering-spec-writing/references/elicitation.md`
- Modify: `plugins/engineering/skills/engineering-spec-writing/references/spec-structure.md`
- Modify: `plugins/engineering/skills/engineering-spec-writing/references/checklist.md`
- Create: `plugins/engineering/skills/engineering-spec-writing/references/builder-check.md`
- Modify: `plugins/engineering/agents/engineering-spec-analyst.md`
- Test: `test/content/31-workflow-self-sufficient.pin.mjs`

**Interfaces:**
- Produces: quy trình làm rõ chạy ở session chính, gồm theo thứ tự: cổng đủ thông tin → lối thoát bỏ hỏi → hỏi từng câu (8 nhóm của `elicitation.md` là vùng phủ, không đọc ra) → playback từng phần → đề xuất 2–3 hướng + 1 khuyến nghị + đánh đổi → cỡ việc (3 cỡ của design D2) → spec-analyst ghi tài liệu → builder check (subagent mới, prompt ở `builder-check.md`, phân 3 nhóm, hỏi người dùng đúng một tin nhắn). Được Task 4 tham chiếu.

- [ ] **Step 1: Viết test đỏ** — pin "AC1.x spec-writing": SKILL.md nhắc `session chính`, `bỏ qua phần hỏi`, `quyết định của agent`, `2–3 hướng`, `builder check`, `một tin nhắn`, ba cỡ việc; `builder-check.md` tồn tại và nêu 3 nhóm (đã trả lời / nhỏ / của người dùng); agent `engineering-spec-analyst.md` không còn câu giao nó hỏi người dùng khảo sát và có `blocked` + `questions` (AC1.5); `elicitation.md` không còn chỉ dẫn đọc câu hỏi ra theo danh sách.
- [ ] **Step 2: Chạy** pin — Expected: FAIL.
- [ ] **Step 3: Sửa skill và references** theo `research/compare-design-plan.md` hàng 1–7, 9–13 và mục 2.1, 2.3 (đề xuất phương án đặt sau playback, ghi rõ đây là lệch có chủ đích khỏi superpowers).
- [ ] **Step 4: Sửa agent** — vai chỉ ghi `requirement.md`/`design.md`/ADR/`tasks.md` từ đầu vào đã chốt; giữ `writeScope`.
- [ ] **Step 5: Chạy** `node test/validate.mjs --build` — Expected: PASS.
- [ ] **Step 6: Commit** `feat(engineering): move elicitation to main session with builder check`.

### Task 4: `workflow-feature` Bước 1–4 mới
**Kind:** DOCS
**Phủ AC:** AC1.1, AC1.3, AC1.4, AC2.2
**Files:**
- Modify: `workflows/feature/WORKFLOW.md`
- Modify: `workflows/feature/graph.json`
- Modify: `workflows/feature/references/task-breakdown.md`
- Modify: `workflows/feature/references/error-matrix.md`
- Test: `test/content/31-workflow-self-sufficient.pin.mjs`; cập nhật pin cũ nếu đỏ: `test/content/06-workflow-fixes.pin.mjs`, `test/content/14-task-breakdown-integration.pin.mjs`, `test/content/15-workflow-pruning.pin.mjs`

**Interfaces:**
- Consumes: skill `engineering-spec-writing` (Task 3), `engineering-plan-writing` (Task 2).
- Produces: bước 1 Baseline build/test; 2 Làm rõ & cỡ việc ⏸; 3 Tài liệu ⏸; 4 Plan ⏸; 5–9 giữ nội dung cũ (Implement, Test, Review, Tài liệu, Commit) đánh số lại. Id graph mới: `clarify`, `documents`, `plan`. Task 13 thay 5–9.

- [ ] **Step 1: Viết test đỏ** — pin "AC1.x feature steps": tiêu đề 4 bước đầu như trên, ⏸ ở 2, 3, 4; Bước 4 nhắc `check-request.mjs` và bỏ qua khi cỡ "thay đổi nhỏ"; Bước 3 nhắc builder check.
- [ ] **Step 2: Chạy** pin — Expected: FAIL.
- [ ] **Step 3: Sửa WORKFLOW.md + graph.json** (gate human cho 2, 3, 4; `reject` → `ask_user`); bảng Checkpoint, DoD theo bước mới; references cập nhật số bước. Giữ nguyên dòng Superpowers ở Điều kiện tiên quyết tới Task 23.
- [ ] **Step 4: Chạy** `node test/validate.mjs --build` — Expected: PASS. Pin cũ đỏ vì số bước → sửa số bước trong pin, giữ hành vi chúng bảo vệ.
- [ ] **Step 5: Commit** `feat(workflows): add clarify, documents and plan steps to feature`.

### Task 5: đóng P1
**Kind:** TOOLING
**Phủ AC:** AC7.3
**Files:**
- Modify: `core/.manifest.json`, `plugins/engineering/.manifest.json`, `workflows/.manifest.json`, `plugins/_versions.lock.json`, `CHANGELOG.md`

- [ ] **Step 1:** Bump minor: core 1.14.3 → 1.15.0, engineering 2.2.4 → 2.3.0, workflows 3.3.0 → 3.4.0.
- [ ] **Step 2:** `npm run build` rồi `node cli/lib/versions.mjs --lock`.
- [ ] **Step 3:** `npm test` — Expected: exit 0. `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-23-workflow-self-sufficient/` — Expected: chỉ W9 (test chưa tồn tại) nếu còn.
- [ ] **Step 4:** Commit `chore(release): bump versions for clarify and plan steps`.

## P2 — Vòng task và review

### Task 6: thử tham số `model` khi gọi agent plugin
**Kind:** DOCS
**Phủ AC:** AC3.5
**Files:**
- Modify: `docs/requests/2026-10-23-workflow-self-sufficient/design.md` (mục Rủi ro)

- [ ] **Step 1:** Gọi `Agent` với `subagent_type: backend:backend-reviewer`, `model: opus`, prompt "báo tên model bạn đang chạy"; ghi kết quả (chạy được / lỗi + thông báo).
- [ ] **Step 2:** Ghi kết quả vào mục Rủi ro, bỏ nhãn [Unverified] nếu đã kiểm; nếu lỗi thì Task 8 dùng phương án D15.
- [ ] **Step 3:** Commit `docs(requests): record plugin agent model override check`.

### Task 7: script `task-brief`, `review-package`, `ledger`
**Kind:** TOOLING
**Phủ AC:** AC3.3, AC3.6
**Files:**
- Create: `core/skills/plan-execution/scripts/task-brief.mjs`
- Create: `core/skills/plan-execution/scripts/review-package.mjs`
- Create: `core/skills/plan-execution/scripts/ledger.mjs`
- Test: `test/content/31-workflow-self-sufficient.pin.mjs`

**Interfaces:**
- Produces: `extractTask(planText: string, n: number): string | null` — nguyên văn từ `### Task <n>` tới heading `###`/`##` kế tiếp ngoài khối code; CLI `node task-brief.mjs <plan.md> <n> [--out <dir>]` ghi `task-<n>-brief.md`, in đường dẫn, exit 1 khi không có task.
- Produces: `buildPackage({ base, head, run }): string` — gồm `git log --oneline base..head`, `git diff --stat`, `git diff -U10`; `run(args) -> stdout` tiêm được; ném lỗi khi base == head hoặc base không là tổ tiên (`git merge-base --is-ancestor`). CLI `node review-package.mjs <base> <head> --out <file>`, exit 1 khi lỗi.
- Produces: `ensureWorkspace(requestDir: string): string` (tạo `.sdd/` + `.gitignore` chứa `*`, trả đường dẫn `progress.md`); `appendLedger(file: string, line: string): void`; `readTail(file: string, max: number): string | null` (null khi không đọc được hoặc có dòng `Plan: complete`). CLI `node ledger.mjs <requestDir> "<line>"`.

- [ ] **Step 1: Viết test đỏ** — pin "AC3.6 scripts": `extractTask` trả đúng task 2 của plan mẫu 3 task, trả null cho task 9, bỏ qua `### Task 1:` trong khối code; `buildPackage` với `run` giả: base==head → throw; không là tổ tiên → throw; hợp lệ → chuỗi chứa 3 phần. `ensureWorkspace` trên thư mục tạm (`fs.mkdtempSync`) tạo `.sdd/.gitignore` nội dung `*\n`; `readTail` trả null khi ledger có `Plan: complete`, trả ≤ max ký tự cuối khi chưa. Dọn thư mục tạm bằng `fs.rmSync`.
- [ ] **Step 2: Chạy** pin — Expected: FAIL (module không tồn tại).
- [ ] **Step 3: Implement** ba module, mỗi module export hàm + chạy CLI khi gọi trực tiếp (theo mẫu `invoked` của `check-request.mjs`).
- [ ] **Step 4: Chạy** pin — Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): add plan-execution scripts`.

### Task 8: skill `plan-execution` (giao thức + prompt + kết thúc nhánh)
**Kind:** DOCS
**Phủ AC:** AC3.1, AC3.2, AC3.5, AC4.1, AC4.2, AC4.3
**Files:**
- Create: `core/skills/plan-execution/SKILL.md`
- Create: `core/skills/plan-execution/references/task-loop.md`
- Create: `core/skills/plan-execution/references/prompts/{implementer,task-review,re-review,final-review}.md`
- Create: `core/skills/plan-execution/references/finish.md`
- Test: `test/content/31-workflow-self-sufficient.pin.mjs`

**Interfaces:**
- Consumes: scripts Task 7; `kind` → chuỗi agent (design D13); kết quả Task 6.
- Produces: skill id `plan-execution` (core, `order: 5`); format ledger: dòng đầu `# Ledger — plan: <path>`, `Task <n>: complete (commits <a>..<b>, review clean)`, `Ruling: <quyết định> — <lý do> — <chi phí nếu sai>`, cuối `Plan: complete`. Được Task 13 gọi.

- [ ] **Step 1: Viết test đỏ** — pin "AC3.x plan-execution": SKILL.md có 2 H2 bắt buộc; nhắc ghi BASE trước khi giao việc, `review-package`, `spec_verdict`, tối đa 3 vòng, vòng 3 opus, `Ruling:`, review cuối toàn nhánh, `engineering-quality-auditor` chỉ ở review cuối, 3 lựa chọn kết thúc (merge local / push + PR / giữ nguyên, mặc định giữ nguyên); 4 prompt tồn tại, `task-review.md` yêu cầu `Missing`/`Extra`/`Misunderstood`, `re-review.md` yêu cầu `ADDRESSED`/`NOT ADDRESSED`.
- [ ] **Step 2: Chạy** pin — Expected: FAIL.
- [ ] **Step 3: Viết skill** theo `research/compare-execution.md` mục 1 (hàng 1–2, 6–7, 10–17, 19–21, 24–25), mục 2 và bảng xung đột C1–C15; mọi điểm "Bên thắng" lấy đúng như báo cáo.
- [ ] **Step 4: Chạy** `node test/validate.mjs --build` — Expected: PASS (conventions; core skill có trong build và trong gói npm theo `pack.config.json`).
- [ ] **Step 5: Commit** `feat(core): add plan-execution skill`.

### Task 9: contract đầu ra
**Kind:** DOCS
**Phủ AC:** AC3.2, AC3.4, AC4.3
**Files:**
- Modify: `core/principles/workflow-output-contract.md`
- Test: `test/content/31-workflow-self-sufficient.pin.mjs`

**Interfaces:**
- Produces: `agent_result` thêm `tdd: { red, green }` (mỗi cái là một evidence), `report_file`, `commits`; reviewer thêm `spec_verdict: compliant | issues | cannot_verify`; `workflow_result` thêm `rulings: []`. Luật kiểm đầu ra thêm: task `BE` thiếu `tdd.red`/`tdd.green` → đầu ra hỏng. Mục mới "Vòng sửa của vòng task" (D5) và "Re-review có phạm vi". Ánh xạ `remaining_risks ≠ ∅` = xong kèm lo ngại; `blocked + questions` → session chính thử trả lời từ spec/plan trước, ghi `Ruling:`.

- [ ] **Step 1: Viết test đỏ** — pin "AC3.4 contract": file nhắc đủ các trường trên và câu "đặt lại mỗi task".
- [ ] **Step 2–4:** Chạy pin FAIL → sửa contract → `node test/validate.mjs --build` PASS (contract `50-workflows` vẫn xanh).
- [ ] **Step 5: Commit** `feat(core): extend output contract for task loop`.

### Task 10: implementer và test-writer
**Kind:** DOCS
**Phủ AC:** AC3.4
**Files:**
- Modify: `plugins/backend/agents/backend-implementer.md`, `backend-test-writer.md`
- Modify: `plugins/frontend/agents/frontend-implementer.md`, `frontend-test-writer.md`, `frontend-data-integrator.md`
- Modify: `plugins/backend/skills/backend-implement/SKILL.md`
- Test: `test/content/31-workflow-self-sufficient.pin.mjs`

- [ ] **Step 1: Viết test đỏ** — pin: `backend-implementer.md` yêu cầu test đỏ trước + báo `tdd`; hai test-writer nêu 3 luật (nêu thay đổi production làm test fail, expected là literal, không assert mock) và chờ theo điều kiện; không agent nào trong 5 file được tự commit.
- [ ] **Step 2–4:** FAIL → sửa theo `research/compare-execution.md` hàng 8–9 và `research/compare-bugfix.md` hàng 11 → `node test/validate.mjs --build` PASS.
- [ ] **Step 5: Commit** `feat(agents): add tdd evidence and test quality rules`.

### Task 11: reviewer, code-review skill, quality-auditor
**Kind:** DOCS
**Phủ AC:** AC3.1, AC3.2, AC3.5
**Files:**
- Modify: `plugins/backend/agents/backend-reviewer.md`, `plugins/frontend/agents/frontend-reviewer.md`
- Modify: `plugins/backend/skills/backend-code-review/SKILL.md`, `plugins/frontend/skills/frontend-code-review/SKILL.md`
- Modify: `plugins/engineering/agents/engineering-quality-auditor.md`
- Test: `test/content/31-workflow-self-sufficient.pin.mjs`

- [ ] **Step 1: Viết test đỏ** — pin: hai reviewer có 3 chế độ `task-review`, `re-review`, `final-review`; ở `task-review` không chạy lại suite, chỉ chạy test hẹp khi nghi ngờ nêu tên; trả `spec_verdict`; hai skill code-review có trục spec (`Missing`/`Extra`/`Misunderstood`); auditor nêu chỉ chạy ở review cuối nhánh khi được gọi từ vòng task. `tools` của reviewer không đổi.
- [ ] **Step 2–4:** FAIL → sửa theo `research/compare-execution.md` mục 2.1 → `node test/validate.mjs --build` PASS.
- [ ] **Step 5: Commit** `feat(agents): add task review modes and spec verdict`.

### Task 12: `git-workflow` cho vòng task
**Kind:** DOCS
**Phủ AC:** AC4.1, AC4.2
**Files:**
- Modify: `core/skills/git-workflow/SKILL.md`
- Test: `test/content/31-workflow-self-sufficient.pin.mjs`

- [ ] **Step 1: Viết test đỏ** — pin: SKILL nêu session chính commit theo task không dừng trên nhánh feature, mỗi task ≥ 1 commit, không amend/squash khi chưa xác nhận; dòng worktree đổi thành "hỏi một lần trước khi tạo"; có mục kết thúc nhánh trỏ `plan-execution/references/finish.md`.
- [ ] **Step 2–4:** FAIL → sửa → `node test/validate.mjs --build` PASS.
- [ ] **Step 5: Commit** `feat(core): align git-workflow with task loop`.

### Task 13: `workflow-feature` Bước 5–7 mới
**Kind:** DOCS
**Phủ AC:** AC3.1, AC3.5, AC4.1, AC4.2, AC4.3
**Files:**
- Modify: `workflows/feature/WORKFLOW.md`, `workflows/feature/graph.json`, `workflows/feature/references/task-breakdown.md`, `workflows/feature/references/error-matrix.md`
- Test: `test/content/31-workflow-self-sufficient.pin.mjs`; pin cũ 06/14/15 nếu đỏ

**Interfaces:**
- Consumes: skill `plan-execution` (Task 8), contract (Task 9).
- Produces: bước 5 Vòng task; 6 Review cuối; 7 Kết thúc nhánh ⏸; id graph `task-loop`, `final-review`, `finish`; cạnh lùi `final-review` → `task-loop` `max_attempts: 2`. `workflow_result` có `rulings`. Bỏ chốt "duyệt diff trước commit" của bước commit cũ.

- [ ] **Step 1: Viết test đỏ** — pin "AC3.x feature loop": đúng 7 bước, tiêu đề trên, Bước 5 nhắc ledger + `plan-execution`, Bước 7 nhắc spec sống + `check-request.mjs` + 3 lựa chọn; Report cuối có `rulings`.
- [ ] **Step 2–4:** FAIL → sửa → `node test/validate.mjs --build` PASS; sửa pin cũ theo số bước mới, giữ hành vi chúng bảo vệ.
- [ ] **Step 5: Commit** `feat(workflows): replace feature phases with task loop`.

### Task 14: `session-start` nạp ledger
**Kind:** TOOLING
**Phủ AC:** AC3.3
**Files:**
- Modify: `core/hooks/scripts/session-start.mjs`
- Test: `test/contract/90-hooks.contract.mjs`

**Interfaces:**
- Consumes: `readTail` (Task 7) — import từ `../../skills/plan-execution/scripts/ledger.mjs` chỉ khi đường dẫn đó có trong bản build plugin; nếu không, chép một hàm đọc đuôi tối thiểu vào hook [quyết định của builder sau khi xem bố cục `build/claude`].
- Produces: `decide` khi `startup|clear|compact` và `cfg.ledgerInject !== false`: tìm `docs/requests/*/.sdd/progress.md` mtime mới nhất mà `readTail` khác null, nối `Ledger (<rel>):\n<tail>` (≤ 2000 ký tự) sau handoff; không có handoff thì chỉ ledger.

- [ ] **Step 1: Viết test đỏ** trong `90-hooks`, dùng `deps` tiêm của `decide`: có ledger chưa xong → `additionalContext` chứa "Ledger"; ledger có `Plan: complete` → không chứa; `ledgerInject: false` → không chứa; readFile ném lỗi cho ledger → vẫn trả handoff; độ dài phần ledger ≤ 2000.
- [ ] **Step 2–4:** FAIL → implement → `node test/validate.mjs --build` PASS.
- [ ] **Step 5: Commit** `feat(hooks): inject plan ledger on session start`.

### Task 15: đóng P2
**Kind:** TOOLING
**Phủ AC:** AC7.3
**Files:** `.manifest.json` của core, backend, frontend, engineering, workflows; `plugins/_versions.lock.json`; `CHANGELOG.md`; `CLAUDE.md` (dòng đếm skill core: 3 → 4, mô tả hook session-start)

- [ ] **Step 1:** Bump minor cho mọi plugin bị chạm ở P2; build; `versions.mjs --lock`.
- [ ] **Step 2:** `npm test` — Expected: exit 0.
- [ ] **Step 3:** Commit `chore(release): bump versions for task loop`.

## P3 — Bugfix

### Task 16: `workflow-bugfix` Bước 4–6
**Kind:** DOCS
**Phủ AC:** AC5.1, AC5.2, AC5.3, AC5.4, AC5.5
**Files:**
- Modify: `workflows/bugfix/WORKFLOW.md`, `workflows/bugfix/graph.json`, `workflows/bugfix/references/error-matrix.md`
- Test: `test/content/31-workflow-self-sufficient.pin.mjs`; `test/content/07-fix-skills.pin.mjs` nếu đỏ (giữ đúng 9 bước)

- [ ] **Step 1: Viết test đỏ** — pin "AC5.x": Bước 4 nhắc thay đổi gần đây (`git log`) + code tương tự đang đúng + log tạm có mốc `git status --porcelain` và gate diff sạch trước Bước 5; Bước 5 nhắc giả thuyết, truy ngược tới nguồn, đối chiếu lý do đỏ của test; Bước 6 nhắc tổng 3 lần → `ask_user` câu hỏi kiến trúc, revert bản sửa hỏng, session chính tự chạy lại oracle; graph Bước 6 có cạnh `ask_user` cho tổng 3 lần; vẫn 9 bước.
- [ ] **Step 2–4:** FAIL → sửa theo `research/compare-bugfix.md` hàng 3–8, 13, 21 và X3, X4, X6 → `node test/validate.mjs --build` PASS.
- [ ] **Step 5: Commit** `feat(workflows): add investigation techniques and fix cap to bugfix`.

### Task 17: `backend-fix`, `frontend-fix`, fixer
**Kind:** DOCS
**Phủ AC:** AC5.3
**Files:**
- Modify: `plugins/backend/skills/backend-fix/SKILL.md`, `plugins/frontend/skills/frontend-fix/SKILL.md`
- Modify: `plugins/backend/agents/backend-fixer.md`, `plugins/frontend/agents/frontend-fixer.md`
- Test: `test/content/31-workflow-self-sufficient.pin.mjs`; `test/content/07-fix-skills.pin.mjs` nếu đỏ

- [ ] **Step 1: Viết test đỏ** — pin: hai skill và hai agent nêu một thay đổi mỗi lượt, revert bản sửa hỏng trước khi thử lại, báo số lần thử + giả thuyết; danh sách cấm che triệu chứng hiện có không đổi (so chuỗi mẫu `@SuppressWarnings`, `@ts-ignore` vẫn còn).
- [ ] **Step 2–4:** FAIL → sửa → `node test/validate.mjs --build` PASS.
- [ ] **Step 5: Commit** `feat(fix): one change per attempt and revert failed fixes`.

### Task 18: đóng P3
**Kind:** TOOLING
**Phủ AC:** AC7.3
- [ ] Bump backend, frontend, workflows; build; lock; `npm test` exit 0; commit `chore(release): bump versions for bugfix upgrade`.

## P4 — Security-review, performance, giới hạn vòng lặp

### Task 19: security-review thêm reviewer correctness
**Kind:** DOCS
**Phủ AC:** AC6.2
**Files:** `workflows/security-review/WORKFLOW.md`, `graph.json`; Test: pin 31

- [ ] **Step 1: Viết test đỏ** — Bước 9 có `backend-reviewer`/`frontend-reviewer` song song với auditor; frontmatter `agents` có hai reviewer.
- [ ] **Step 2–4:** FAIL → sửa → PASS.
- [ ] **Step 5: Commit** `feat(workflows): add correctness review to security re-scan`.

### Task 20: performance thêm bước baseline build/test
**Kind:** DOCS
**Phủ AC:** AC6.3
**Files:** `workflows/performance/WORKFLOW.md`, `graph.json`, `references/*`; Test: pin 31, `09-backend-performance.pin.mjs`, `12-frontend-performance.pin.mjs` nếu đỏ

- [ ] **Step 1: Viết test đỏ** — Bước 1 mới "Baseline build/test" giống feature/bugfix; các bước sau đánh số lại; DoD có dòng baseline.
- [ ] **Step 2–4:** FAIL → sửa (cập nhật mọi tham chiếu "Bước N" trong thân và references) → PASS.
- [ ] **Step 5: Commit** `feat(workflows): add build baseline step to performance`.

### Task 21: không còn vòng lặp không giới hạn + dọn orchestrator
**Kind:** DOCS
**Phủ AC:** AC6.1
**Files:** 5 `workflows/*/WORKFLOW.md`, `workflows/*/references/error-matrix.md`; Test: `test/contract/50-workflows.contract.mjs`

- [ ] **Step 1: Viết test đỏ** trong contract 50: với mọi `WORKFLOW.md`, không khớp regex `/lặp tới khi xanh|sửa tiếp(?![^\n]*tối đa)|build lại(?![^\n]*tối đa)/i`; orchestrator không còn dòng "Supervisor (session chính) kiểm `agent_result`".
- [ ] **Step 2: Chạy** — Expected: FAIL (feature:113 cũ, bảng Xử lý lỗi của 4 workflow).
- [ ] **Step 3:** Đổi thành "tối đa 2 lần rồi `ask_user`"; orchestrator bỏ dòng Supervisor, bỏ cột `Nối tiếp` và logic chuỗi (Bước 1, 4, 5, `orchestrator_result.chain`) vì Registry không có cặp nào.
- [ ] **Step 4:** `node test/validate.mjs --build` — Expected: PASS.
- [ ] **Step 5: Commit** `fix(workflows): bound every retry loop`.

### Task 22: đóng P4
**Kind:** TOOLING
**Phủ AC:** AC7.3
- [ ] Bump workflows; build; lock; `npm test` exit 0; commit `chore(release): bump workflows for loop bounds`.

## P5 — Gỡ superpowers

### Task 23: gỡ nhánh superpowers khỏi workflow
**Kind:** DOCS
**Phủ AC:** AC7.1
**Files:** `workflows/feature/WORKFLOW.md`, `workflows/bugfix/WORKFLOW.md`, `workflows/orchestrator/WORKFLOW.md`; Test: `test/content/18-superpowers-docs-standard.pin.mjs`

- [ ] **Step 1:** Xoá dòng Superpowers ở Điều kiện tiên quyết của feature/bugfix, dòng routing + dòng bảng skill trực tiếp của orchestrator.
- [ ] **Step 2:** Pin 18: bỏ khối AC3.2 (đang ghim nhánh superpowers); giữ các khối còn bảo vệ hành vi hiện hành (check-request W1–W16, vị trí `docs/requests/`).
- [ ] **Step 3:** `node test/validate.mjs --build` — Expected: PASS.
- [ ] **Step 4: Commit** `refactor(workflows): drop superpowers routing`.

### Task 24: template và artifact-templates
**Kind:** DOCS
**Phủ AC:** AC7.1
**Files:** `core/skills/artifact-templates/references/{plan,design,requirement}.template.md`, `core/skills/artifact-templates/SKILL.md`; Test: `test/contract/35-artifact-templates.contract.mjs`

- [ ] **Step 1:** Header plan đổi thành dòng trỏ skill `plan-execution` (aip); khối `sources:` của 3 template bỏ `superpowers:*`, ghi nguồn là request này.
- [ ] **Step 2:** Contract 35 dòng 199 đổi assert sang header mới.
- [ ] **Step 3:** `node test/validate.mjs --build` PASS; commit `refactor(artifact-templates): point plan header to plan-execution`.

### Task 25: baseline và CLAUDE.md
**Kind:** DOCS
**Phủ AC:** AC7.1, AC7.2
**Files:** `core/agents/AGENTS.template.md`, `AGENTS.md`, `CLAUDE.md`; Test: `test/managed-block.test.mjs`, `test/content/19-verification-gate.pin.mjs`, pin 31

- [ ] **Step 1: Viết test đỏ** — pin 31 "AC7.x": grep `superpowers` (không phân biệt hoa thường) trên `workflows/`, `plugins/`, `core/`, `templates/`, `AGENTS.md`, `CLAUDE.md` → 0 kết quả; baseline có mục mặc định quy trình trỏ `workflow-feature`/`workflow-bugfix`. `managed-block.test.mjs`: block cũ chứa "Superpowers workflow defaults" sau khi áp template mới → không còn chuỗi đó, chỉ một cặp marker.
- [ ] **Step 2: Chạy** — Expected: FAIL.
- [ ] **Step 3:** Viết lại mục "Superpowers workflow defaults" → "Workflow defaults" (spec/plan là human gate, thực thi bằng `plan-execution`, commit theo task, kết thúc mặc định giữ nhánh); mục Memory: ledger `.sdd/`, bỏ "nếu có ledger superpowers"; Safety: "mỗi task ≥ 1 commit"; chép sang `AGENTS.md`; `CLAUDE.md` mục "Superpowers workflow defaults" tương ứng.
- [ ] **Step 4:** `npm test` — Expected: exit 0 (gồm `70-bytes`, managed-block, pin 19 sau khi chỉnh câu nó ghim nếu đỏ).
- [ ] **Step 5: Commit** `refactor(baseline): make aip workflows the default process`.

### Task 26: ADR, spec sống, tài liệu
**Kind:** DOCS
**Phủ AC:** AC7.1
**Files:** `docs/decisions/0004-aip-workflows-replace-superpowers.md`, `docs/specs/{workflows,artifact-templates,baseline,hooks-gates}/spec.md`, `README.md`, `README_VI.md`, `CHANGELOG.md`

- [ ] **Step 1:** ADR theo MADR (skill `engineering-adr`), Status `Proposed` — chủ repo chốt.
- [ ] **Step 2:** Spec sống theo mục `## Ảnh hưởng spec` của design (workflows đổi R3, thêm R7–R10; artifact-templates đổi R4, thêm R9; baseline đổi R2, R3, thêm R8; hooks-gates thêm R11), thêm dòng lịch sử.
- [ ] **Step 3:** README/README_VI bỏ hướng dẫn luồng superpowers nếu có.
- [ ] **Step 4:** `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-23-workflow-self-sufficient/` — Expected: 0 cảnh báo; commit `docs: record decision and update living specs`.

### Task 27: đóng P5
**Kind:** TOOLING
**Phủ AC:** AC7.3
- [ ] Bump core, workflows, engineering (nếu chạm); build; lock; `npm test` exit 0; commit `chore(release): bump versions for superpowers removal`. Dừng: người dùng duyệt diff nhánh P1–P5 trước P6.

## P6 — Kiểm chứng

### Task 28: 3 case eval
**Kind:** TOOLING
**Phủ AC:** AC8.2, AC1.1, AC3.2, AC5.3
**Files:** `evals/workflows/task-review-spec/`, `evals/workflows/bugfix-fix-cap/`, `evals/workflows/clarify-proposals/` (mỗi thư mục `prompt.md`, `graders/*.md`, `case.yaml`, `scaffold.sh` nếu cần), `evals/README.md`; Test: `test/contract/95-evals.contract.mjs`

- [ ] **Step 1:** Viết 3 case theo cấu trúc `evals/workflows/bugfix-routes/`; grader chỉ chấm hành vi quan sát được bằng Read/Write/Edit/Skill (case workflows không có Bash).
- [ ] **Step 2:** `node test/validate.mjs --only evals` — Expected: PASS.
- [ ] **Step 3:** Chạy `node scripts/eval-run.mjs --plugin workflows --runs 3 --max-cost-usd 20 --case '*'` (tốn tiền — chạy nền).
- [ ] **Step 4:** Ghi kết quả vào `evals/README.md` (bảng như các case hiện có). Không đạt điều kiện → dừng, báo người dùng, không sang Task 29.
- [ ] **Step 5:** Commit `test(evals): add workflow self-sufficiency cases and results`.

### Task 29: chạy thử trên feature thật
**Kind:** DOCS
**Phủ AC:** AC8.1
**Files:** `docs/requests/2026-10-23-workflow-self-sufficient/dogfood.md`

- [ ] **Step 1:** Người dùng chọn feature từ follow-up đang mở.
- [ ] **Step 2:** Mở phiên mới với superpowers đã tắt, cài workflow mới từ source, chạy `workflow-feature` từ yêu cầu tới review cuối.
- [ ] **Step 3:** Ghi `dogfood.md`: phiên, request folder sinh ra, mỗi checkpoint + evidence, xác nhận transcript không có `superpowers:` (grep transcript), chi phí theo `aip stats --usage`.
- [ ] **Step 4:** Commit `docs(requests): record dogfood run`. Người dùng quyết định bỏ superpowers.
