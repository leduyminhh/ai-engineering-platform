# Workflow graph máy đọc được (project 2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi workflow pipeline có `graph.json` máy đọc được, được contract đối chiếu hai chiều với văn xuôi `WORKFLOW.md`, và được ship cho Claude/Codex.
**Architecture:** Hai helper thuần mới trong `cli/lib/workflows.mjs` (`checkGraph`, `checkGraphAgainstBody`) kiểm schema/reachability và đối chiếu văn xuôi; `loadWorkflows()` gắn `stage.graph`; `graph.json` nằm cạnh `WORKFLOW.md` nên cơ chế `fileAssets` hiện có tự ship nó vào build Claude/Codex (cursor/antigravity không build workflow).
**Tech Stack:** Node 20+ ESM, chỉ built-in; harness `test/validate.mjs` (`ok(cond, msg)`).
**Spec:** design.md
**Requirement:** không có

## Global Constraints

- Zero-dep, Node 20+ ESM; UTF-8 không BOM, LF; comment tiếng Việt chỉ nêu *vì sao*, 1–2 dòng.
- Không đổi khung 8 trường, `WF_HEADINGS`, `STEP_FIELDS`, `WF_ANCHORS`.
- Schema v1 đúng design §1 + D4/D5/D9/D10: khoá gốc `schema` (= 1), `workflow`, `start`, `steps`; mỗi bước `id`, `n`, `title`, `run`, `next`, `on_fail`, `gate`.
- Đích đặc biệt: `done`, `blocked`, `ask_user`. Id bước: `/^[a-z][a-z0-9-]*$/`, duy nhất, không trùng đích đặc biệt.
- `run`: `session` (bool, tuỳ chọn), `agents`/`skills` (mảng, phần tử là chuỗi id hoặc `{ "id", "when"?, "after"? }`), `parallel` (bool, tuỳ chọn); phải có ít nhất `session: true` hoặc một agent/skill.
- Gate: `{ "type": "auto" }` hoặc `{ "type": "human", "review", "approve", "reject" }`; `approve === next`; `reject` là một `on_fail[].to`.
- Bằng chứng văn xuôi cho cạnh `on_fail` (trong trường **Khi fail** của chính bước đó, gồm dòng nối tiếp): tới bước N ← `/quay (?:lại|về) Bước (\d+(?:\/\d+)*)/gi` (mỗi số trong `4/5` là một N); tới `blocked` ← `/blocked|dừng/i`; tới `ask_user` ← `/hỏi|người dùng/i` (rộng hơn D9 "người dùng chỉ định" để phủ "người dùng mở rộng danh sách"; chiều ngược chỉ áp cho "quay lại/về Bước N").
- Tên test (chuỗi thứ hai của `ok`) bắt đầu bằng ID AC nó phủ.
- Giữa các task chỉ chạy `node test/validate.mjs --build --only workflows` (và nhóm liên quan); `npm test` toàn bộ chỉ xanh sau Task 4 (version lock).
- Commit mỗi task qua `core:git-workflow` (`git commit -F`, header EN, body VI có dấu), không thêm dòng `Co-Authored-By`.

## Review Focus

- Trường **Khi fail** xuống dòng (bugfix Bước 6, feature Bước 4/6 có "quay lại" ở dòng nối tiếp) — trích phải gom dòng nối tiếp → test ở Task 1.
- "quay lại Bước 4/5" (feature Bước 6) — cả 4 và 5 phải có cạnh → test ở Task 1.
- Vòng lặp không lối ra (on_fail quay qua lại, không bước nào tới `done`) — phải báo lỗi → test ở Task 1.
- `after` trỏ tới id không có trong cùng bước, hoặc trỏ chính nó → lỗi → test ở Task 1.
- `graph.json` sai cú pháp JSON → loader báo lỗi to kèm đường dẫn file, không im lặng bỏ qua → test ở Task 2.

---

### Task 1: Helper `checkGraph` và `checkGraphAgainstBody`

**Phủ AC:** AC1.1, AC1.2, AC1.3, AC2.1, AC2.2, AC2.3, AC2.4
**Files:**
- Modify: `cli/lib/workflows.mjs`
- Test: `test/contract/50-workflows.contract.mjs`

**Interfaces:**
- Consumes: `parseSteps(text)`, `stepRefs(text)` hiện có trong `cli/lib/workflows.mjs`.
- Produces:
  - `export const GRAPH_TERMINALS = ['done', 'blocked', 'ask_user']`
  - `export function checkGraph(graph: object): string[]` — lỗi schema (AC1.1), đích sai (AC1.2), reachability (AC1.3). Mỗi lỗi nêu id bước.
  - `export function checkGraphAgainstBody(graph: object, text: string): string[]` — đối chiếu với `WORKFLOW.md` body (AC2.1–AC2.4). Không kiểm `graph.workflow` (contract Task 2 so với frontmatter).

- [ ] **Step 1: Viết test đỏ** — khối mới trong `50-workflows.contract.mjs`, import 2 helper trực tiếp từ `../../cli/lib/workflows.mjs`. Fixture văn xuôi 3 bước (đủ 8 trường mỗi bước, không cần pass `checkWorkflowBody`):
  - Bước 1 "Baseline": `- **Thực hiện:** session chính`, `- **Khi fail:** đỏ → dừng \`blocked\`.`
  - Bước 2 "Implement": `- **Thực hiện:** agent \`a-one\` ∥ agent \`a-two\` (skill \`s-one\`, chỉ khi có API)`, `- **Khi fail:** build lỗi → sửa lại; lệch contract → quay lại` + dòng nối tiếp `  Bước 1 sửa.`
  - Bước 3 "Commit ⏸": `- **Thực hiện:** skill \`git-workflow\``, `- **Khi fail:** người dùng yêu cầu sửa thêm → quay lại bước người dùng chỉ định.`
  Graph hợp lệ tương ứng (`baseline` → `implement` → `commit`, commit `gate: { type: 'human', review: 'Diff', approve: 'done', reject: 'ask_user' }`, `next: 'done'`, on_fail lần lượt `blocked` / `baseline` / `ask_user`; bước 2 `run: { agents: ['a-one', { id: 'a-two' }], skills: [{ id: 's-one', when: 'chỉ khi có API' }], parallel: true }`).
  Assertion:
  - `AC1.1: graph hợp lệ → 0 lỗi` cho cả `checkGraph` và `checkGraphAgainstBody`.
  - `AC1.1: checkGraph báo lỗi schema` — một test tham số hoá; mỗi biến thể đúng ≥1 lỗi: `schema: 2`; thiếu `workflow`; `start` khác id bước `n: 1`; id `Baseline` (hoa); id trùng; id `done`; `n` nhảy 1→3; `title` rỗng; `run: {}`; `run.agents: [5]`; `gate.type: 'x'`; human gate thiếu `review`; `approve` ≠ `next`; `reject` không có trong `on_fail`; `on_fail` phần tử thiếu `when`.
  - `AC1.2: đích không tồn tại → lỗi nêu bước và đích` — `next: 'nowhere'` → lỗi chứa `implement` và `nowhere`.
  - `AC1.3: bước mồ côi và vòng không lối ra bị báo` — thêm bước 4 không ai trỏ tới → lỗi chứa id; đổi graph để bước 2 và 3 chỉ trỏ qua lại nhau (không tới `done`) → lỗi.
  - `AC1.1: after trỏ id ngoài bước hoặc chính nó → lỗi` (Review Focus).
  - `AC2.1: số bước/tên bước lệch văn xuôi → lỗi` (bỏ bước 3 khỏi graph; đổi title bước 2).
  - `AC2.2: ⏸ ↔ gate human lệch hai chiều → lỗi` (bước 3 `type: 'auto'`; bước 1 `type: 'human'`).
  - `AC2.3: agent/skill/session/parallel lệch → lỗi` (bỏ `a-two`; thêm `s-two`; bước 1 `session: false`; bước 2 `parallel: false`).
  - `AC2.4: "quay lại Bước N" ở dòng nối tiếp phải có cạnh` — bỏ cạnh `baseline` của bước 2 → lỗi (Review Focus).
  - `AC2.4: cạnh không có bằng chứng → lỗi` — thêm `{ to: 'blocked', when: 'x' }` vào bước 2 (văn xuôi bước 2 không có "dừng"/"blocked") → lỗi.
  - `AC2.4: "quay lại Bước 4/5" cần cạnh tới cả hai` — fixture riêng nhỏ: văn xuôi 5 bước tối thiểu, bước 5 Khi fail "quay lại Bước 3/4"; graph chỉ có cạnh tới bước 3 → lỗi nhắc bước 4 (Review Focus).

- [ ] **Step 2: Chạy, xác nhận đỏ** — Run: `node test/validate.mjs --only workflows` — Expected: FAIL, `checkGraph is not a function` (hoặc import lỗi).

- [ ] **Step 3: Viết 2 helper** trong `cli/lib/workflows.mjs` (thuần, không đọc đĩa). Trích trường của bước bằng cùng cách `stepRefs` trích **Thực hiện** (từ bullet `- **<Trường>:**` tới bullet cột 0 kế tiếp) — tách hàm nội bộ dùng chung `fieldText(body, field)` và cho `stepRefs` dùng lại. Reachability: BFS từ `start` qua `next`, `on_fail[].to`, `gate.approve/reject` (bỏ đích đặc biệt); "tới được `done`" = BFS ngược từ các bước có cạnh tới `done`. Title so với `parseSteps(...).title` đã bỏ hậu tố ` ⏸`. Bằng chứng cạnh theo regex ở Global Constraints.

- [ ] **Step 4: Chạy, xác nhận xanh** — Run: `node test/validate.mjs --only workflows` — Expected: PASS toàn bộ, test cũ của `stepRefs` vẫn xanh.

- [ ] **Step 5: Commit** — `feat(workflows): add graph schema and prose cross-check helpers`.

### Task 2: `graph.json` cho 4 workflow + loader + làm rõ văn xuôi

**Phủ AC:** AC1.1, AC1.2, AC1.3, AC2.1, AC2.2, AC2.3, AC2.4, AC2.5
**Files:**
- Create: `workflows/bugfix/graph.json`, `workflows/feature/graph.json`, `workflows/security-review/graph.json`, `workflows/performance/graph.json`
- Modify: `workflows/{bugfix,feature,security-review,performance}/WORKFLOW.md` (chỉ chỗ AC2.5)
- Modify: `cli/lib/plugins.mjs` (`loadWorkflows`, thêm `readGraph`)
- Test: `test/contract/50-workflows.contract.mjs`

**Interfaces:**
- Consumes: `checkGraph`, `checkGraphAgainstBody` (Task 1).
- Produces: `export function readGraph(file: string): object | null` trong `cli/lib/plugins.mjs` — không có file → `null`; JSON hỏng → `throw new Error(\`${file}: graph.json không phải JSON hợp lệ — ${e.message}\`)`. `loadWorkflows()` gắn `stage.graph = readGraph(path.join(dir, 'graph.json'))`; `graph.json` vẫn nằm trong `fileAssets` (để ship).

- [ ] **Step 1: Viết test đỏ** trong `50-workflows.contract.mjs`:
  - `AC1.1: mọi workflow pipeline có graph.json` — với mỗi `workflows.stages` có `kind === 'workflow'`: `stage.graph` khác null; `stage.graph.workflow === stage.id`; orchestrator không bắt buộc.
  - `AC1.1/AC1.2/AC1.3: <id> graph hợp lệ` — `checkGraph(stage.graph)` rỗng (in lỗi trong message khi đỏ).
  - `AC2.1–AC2.4: <id> graph khớp văn xuôi` — `checkGraphAgainstBody(stage.graph, stage.body)` rỗng.
  - `AC2.5: không còn "quay lại bước tương ứng"` — không body workflow nào chứa chuỗi đó.
  - `readGraph`: file tạm chứa `{"schema":` → ném lỗi có đường dẫn file; file không tồn tại → `null` (Review Focus).

- [ ] **Step 2: Chạy, xác nhận đỏ** — Run: `node test/validate.mjs --only workflows` — Expected: FAIL ở các dòng mới.

- [ ] **Step 3: Sửa văn xuôi (AC2.5)** — 4 bước commit: "quay lại bước tương ứng" → "quay lại bước người dùng chỉ định". Chỗ mơ hồ khác phát hiện khi viết graph: sửa tối thiểu cùng kiểu, và liệt kê từng chỗ (file:dòng, trước → sau) trong báo cáo task. Không đổi nghiệp vụ.

- [ ] **Step 4: Viết `readGraph` + gắn vào `loadWorkflows`.**

- [ ] **Step 5: Viết 4 `graph.json`** — đọc từng bước; id kebab-case tiếng Anh ngắn theo việc của bước; `run` theo trường **Thực hiện** (điều kiện "chỉ khi…", "chỉ phía…" vào `when`, "chạy **sau** khi…" vào `after`); `on_fail` theo **Khi fail** (mỗi cạnh `when` là câu ngắn trích ý); gate human lấy `review` từ cột "Người duyệt xem gì" của bảng Checkpoint; bước cuối `next: "done"`. JSON 2 khoảng trắng thụt lề, LF, có newline cuối file.

- [ ] **Step 6: Chạy, xác nhận xanh** — Run: `node test/validate.mjs --build --only workflows` rồi `node test/validate.mjs --only content` — Expected: PASS (pin cũ trỏ văn xuôi workflow vẫn xanh; nếu một pin nhắc nguyên câu đã sửa ở Step 3 thì cập nhật pin đó và ghi vào báo cáo).

- [ ] **Step 7: Commit** — `feat(workflows): add machine-readable graph for pipeline workflows`.

### Task 3: Template graph, tài liệu, ship build

**Phủ AC:** AC3.1, AC3.2
**Files:**
- Create: `core/skills/artifact-templates/references/workflow.graph.template.json`
- Modify: `core/skills/artifact-templates/references/workflow.template.md` (Bước 2 ⏸ trường **Khi fail**)
- Modify: `core/skills/artifact-templates/SKILL.md` (dòng `workflow` của mục lục: thêm link thứ hai vào ô Template; mục Bản đồ tài liệu)
- Modify: `CLAUDE.md` (bullet "New workflow"; câu mô tả `loadWorkflows` có `graph`)
- Test: `test/contract/50-workflows.contract.mjs`

**Interfaces:**
- Consumes: `checkGraph`, `checkGraphAgainstBody` (Task 1); `stripTemplateHeader` từ `cli/lib/templates.mjs`.

- [ ] **Step 1: Viết test đỏ** trong `50-workflows.contract.mjs`:
  - `AC3.2: template graph hợp lệ và khớp template workflow` — `checkGraph(tplGraph)` rỗng và `checkGraphAgainstBody(tplGraph, stripTemplateHeader(workflowTemplate))` rỗng.
  - `AC3.2: SKILL.md artifact-templates và CLAUDE.md nhắc graph.json` — `SKILL.md` chứa `workflow.graph.template.json`; `CLAUDE.md` bullet "New workflow" chứa `graph.json`.
  - `AC3.1: build ship graph.json cho Claude và Codex, byte-for-byte` — khi `claudeDir` tồn tại: với mỗi workflow pipeline, `build/claude/plugins/workflows/skills/<id>/graph.json` và `build/codex/workflows/skills/<id>/graph.json` tồn tại và bằng nguồn; không có `graph.json` nào dưới `build/cursor` hay `build/antigravity`.

- [ ] **Step 2: Chạy, xác nhận đỏ** — Run: `node test/validate.mjs --build --only workflows` — Expected: FAIL ở dòng AC3.2 (dòng AC3.1 có thể đã xanh nhờ `fileAssets` — ghi rõ trong báo cáo).

- [ ] **Step 3: Viết nội dung**
  - Template workflow Bước 2 ⏸: **Khi fail** `…` → `người dùng không duyệt → quay lại Bước 1 hoặc hỏi lại người dùng.` (để gate human có đích `reject`).
  - `workflow.graph.template.json`: graph 2 bước khớp template (`workflow: "workflow-<slug>"`; bước 1 `run: { session: true }`, on_fail `ask_user` + `blocked`; bước 2 human gate `reject` về bước 1, `approve: "done"`).
  - SKILL.md: ô Template dòng `workflow` thành `[workflow.template.md](references/workflow.template.md) + [workflow.graph.template.json](references/workflow.graph.template.json)` (link đầu vẫn là file có header, `templateIndex` chỉ đọc link đầu; không đổi cột Validator/Nguồn); thêm một bullet Bản đồ tài liệu cho file graph.
  - CLAUDE.md: bullet "New workflow" thêm: kèm `workflows/<slug>/graph.json` từ `workflow.graph.template.json`, được `checkGraph`/`checkGraphAgainstBody` kiểm; câu `loadWorkflows()` nhắc `graph`.

- [ ] **Step 4: Chạy, xác nhận xanh** — Run: `node test/validate.mjs --build --only workflows && node test/validate.mjs --only artifact-templates` — Expected: PASS.

- [ ] **Step 5: Commit** — `feat(core): add workflow graph template and docs`.

### Task 4: Bump version, lock, toàn bộ test

**Phủ AC:** AC4.1
**Files:**
- Modify: `workflows/.manifest.json` (`3.1.2` → `3.2.0`), `core/.manifest.json` (`1.8.1` → `1.8.3`), manifest plugin khác chỉ khi lock từ chối (bump patch)
- Modify: `plugins/_versions.lock.json`

- [ ] **Step 1:** Bump như trên. (`1.8.3`, không phải `1.8.2`: nhánh `feature/core-allow-env-files` chưa merge đã dùng `1.8.2`.)
- [ ] **Step 2:** Run: `npm run build && node cli/lib/versions.mjs --lock` — Expected: exit 0 (lock từ chối plugin nào → bump patch plugin đó, chạy lại).
- [ ] **Step 3:** Run: `npm test` — Expected: toàn bộ PASS.
- [ ] **Step 4:** Run: `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-20-workflow-graph` — Expected: chỉ W7 cho `AC4.1` (kiểm bằng chính `npm test`), không W8/W9.
- [ ] **Step 5: Commit** — `chore(release): bump workflows and core for workflow graph`.
