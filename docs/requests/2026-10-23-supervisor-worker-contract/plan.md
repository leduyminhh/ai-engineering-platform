# Supervisor kiểm đầu ra worker và retry có ngưỡng Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm khóa `max_attempts` cho cạnh `on_fail` quay ngược của `graph.json` (có `checkGraph` kiểm tra), khối
`agent_result` chung cho mọi agent, và luật "Kiểm đầu ra worker" + retry trong contract đầu ra.
**Architecture:** Sửa `checkGraph` trong `cli/lib/workflows.mjs` để kiểm tra `max_attempts`; điền `max_attempts: 2` vào 4
graph. Văn bản luật nằm trong `core/principles/workflow-output-contract.md`, được build gộp vào skill
`principles`. Mỗi `WORKFLOW.md` trỏ tới luật qua một dòng neo mới trong `WF_ANCHORS`. Mục `## Report trả về` của
mọi agent trỏ tới `agent_result`. Không có runtime nào mới.
**Tech Stack:** Node.js 20+ built-ins (ESM), harness `ok(cond, msg)` của `test/validate.mjs`.
**Spec:** design.md
**Requirement:** không có

## Global Constraints

- Zero runtime dependency; UTF-8 không BOM, LF; nội dung contract, agent và workflow viết bằng tiếng Việt có dấu;
  comment code chỉ nêu *vì sao*, bằng tiếng Việt.
- Ngưỡng retry = **2** (`max_attempts: 2`) ở mọi cạnh quay ngược thuộc diện kiểm.
- "Quay ngược" = đích là một bước có `n` ≤ `n` của bước hiện tại (tính cả cạnh tự trỏ). Được miễn: cạnh có
  `to === gate.reject` khi `gate.type === 'human'`, và cạnh tới đích đặc biệt (`blocked`, `ask_user`).
- Nhánh: `feature/supervisor-worker-contract`, tách từ `master` **sau khi** phần CI
  (`feature/ci-pin-input-as-data`) đã vào master. Mỗi task một commit qua `core:git-workflow` (header tiếng Anh,
  thân tiếng Việt, `git commit -F` từ file ngoài repo, không có dòng `Co-Authored-By`). Không push, không merge.
- Mỗi task chạy `node test/validate.mjs` (không `--build`) để kiểm source. Bump version, build, lock và
  `npm test` đầy đủ chỉ làm ở Task 4.
- Không `rm -rf` thư mục chứa junction trên Windows.
- Tên mọi test mới mở đầu bằng `SWC ACx.y:`, ví dụ `SWC AC3.1: …`. Lý do: `50-workflows.contract.mjs` đã có
  test `AC1.1:`/`AC2.1:` của request cũ, nên nếu không có tiền tố thì W7 sẽ coi AC đã có test dù chưa có. Tên
  test ghi trong các task dưới đây đều hiểu là đã có tiền tố này.

## Review Focus

- Cạnh tự trỏ (`to` = id của chính bước đó) là cạnh quay ngược, nên phải có `max_attempts` (test ở Task 1).
- Bước có gate `human`: cạnh `gate.reject` được miễn, nhưng một cạnh quay ngược *khác* của cùng bước tới một
  bước sớm hơn vẫn phải có `max_attempts` (test ở Task 1).
- Cạnh `on_fail` trỏ tới id không tồn tại: chỉ báo lỗi "trỏ tới không tồn tại" như cũ, không báo thêm lỗi
  `max_attempts` ăn theo (test ở Task 1).
- `max_attempts` sai kiểu (`0`, `1.5`, `"2"`): báo lỗi, không ném exception (test ở Task 1).
- Agent nhắc `agent_result` ở mục khác nhưng mục `## Report trả về` không nhắc: test phải đỏ. Kiểm theo đúng
  mục, không theo cả body (Task 3).

---

### Task 1: `checkGraph` kiểm `max_attempts` và điền ngưỡng vào 4 graph
**Phủ AC:** AC3.1, AC3.2, AC3.3
**Files:**
- Modify: `cli/lib/workflows.mjs` (`GRAPH_KEYS.onFail`, `checkGraph`)
- Modify: `workflows/bugfix/graph.json`, `workflows/feature/graph.json`, `workflows/performance/graph.json`,
  `workflows/security-review/graph.json`
- Test: `test/contract/50-workflows.contract.mjs`

**Interfaces:**
- Produces: `GRAPH_KEYS.onFail = ['to', 'when', 'max_attempts']`. `checkGraph(graph)` trả thêm các lỗi dạng
  `bước <id>: on_fail[<j>] quay ngược tới "<to>" thiếu max_attempts`,
  `bước <id>: on_fail[<j>] max_attempts phải là số nguyên ≥ 1` và
  `bước <id>: on_fail[<j>] max_attempts chỉ dùng cho cạnh quay ngược`.

- [ ] **Step 1: Sửa fixture `base()` và thêm test có tham số** trong `50-workflows.contract.mjs`, ngay sau
  vòng `schemaCases`.
  - Trong `base()`, cạnh `implement → baseline` là cạnh quay ngược, nên thêm `max_attempts: 2` vào cạnh đó để
    `base()` vẫn hợp lệ.
  - Thêm bảng `attemptCases`, cùng kiểu `[fn, want, at]` với `schemaCases`, chạy qua cùng vòng kiểm
    `errs.some(m => m.includes(want) && m.includes(at))`, tên test có tiền tố `AC3.1:` hoặc `AC3.2:`:
    - `'quay ngược thiếu max_attempts'`: `delete g.steps[s2].on_fail[0].max_attempts` → `'thiếu max_attempts'`, `'implement'`
    - `'tự trỏ thiếu max_attempts'`: `g.steps[s2].on_fail.push({ to: 'implement', when: 'x' })` → `'thiếu max_attempts'`, `'implement'`
    - `'max_attempts = 0'`, `'= 1.5'`, `'= "2"'`: gán vào `g.steps[s2].on_fail[0].max_attempts` → `'số nguyên ≥ 1'`, `'implement'`
    - `'max_attempts ở cạnh tới ask_user'`: `g.steps[s3].on_fail[0].max_attempts = 2` → `'chỉ dùng cho cạnh quay ngược'`, `'commit'`
    - `'max_attempts ở cạnh tiến'`: `g.steps[s1].on_fail.push({ to: 'implement', when: 'x', max_attempts: 2 })` → `'chỉ dùng cho cạnh quay ngược'`, `'baseline'`
    - `'max_attempts ở cạnh human reject'`: đặt `g.steps[s3].gate.reject = 'implement'` và
      `g.steps[s3].on_fail = [{ to: 'implement', when: 'x', max_attempts: 2 }]` → `'chỉ dùng cho cạnh quay ngược'`, `'commit'`
    - `'human: cạnh quay ngược khác reject'`: đặt `g.steps[s3].on_fail.push({ to: 'baseline', when: 'x' })` → `'thiếu max_attempts'`, `'commit'`
  - Thêm hai test hợp lệ:
    - `AC3.2: human reject không có max_attempts → hợp lệ`: `reject = 'implement'`,
      `on_fail = [{ to: 'implement', when: 'x' }]`, mong `checkGraph(...).length === 0`.
    - `AC3.1: đích không tồn tại không kéo theo lỗi max_attempts`: `g.steps[s2].on_fail[0].to = 'nowhere'`,
      mong không có lỗi nào chứa `max_attempts`.
- [ ] **Step 2: Chạy** `node test/validate.mjs --only workflows`. Mong đợi: FAIL ở các case `AC3.x` mới, và
  `base()` báo `khóa lạ "max_attempts"`.
- [ ] **Step 3: Hiện thực.**
  - Trong `cli/lib/workflows.mjs`, thêm `'max_attempts'` vào `GRAPH_KEYS.onFail`.
  - Trong `checkGraph`, dựng `nOf` (id → n) từ `graph.steps.filter(isObj)` trước vòng duyệt bước.
  - Trong vòng `on_fail`, sau các check hiện có, với mỗi cạnh có `to` hợp lệ:
    - `exempt` = `GRAPH_TERMINALS.includes(f.to)`, hoặc (`g.type === 'human'` và `f.to === g.reject`).
    - `back` = `!exempt && nOf.has(f.to) && nOf.get(f.to) <= s.n`.
    - `back` mà thiếu `max_attempts` → lỗi "thiếu".
    - Có `max_attempts` nhưng không phải `Number.isInteger(v) && v >= 1` → lỗi "số nguyên ≥ 1".
    - `!back` mà vẫn có `max_attempts` → lỗi "chỉ dùng cho cạnh quay ngược".
  - Đích không có trong `nOf` và không phải đích đặc biệt thì bỏ qua, vì đã có lỗi đích riêng báo.
  - Thêm một dòng comment tiếng Việt nêu lý do miễn `gate.reject`: người dùng đã ở trong vòng.
- [ ] **Step 4: Chạy lại** `node test/validate.mjs --only workflows`. Mong đợi: các case mới PASS; các graph
  thật đỏ vì thiếu `max_attempts`.
- [ ] **Step 5: Điền ngưỡng vào graph thật.** Thêm `"max_attempts": 2` vào đúng các cạnh quay ngược không được
  miễn trong 4 `graph.json`. Danh sách 16 cạnh quay ngược ở thời điểm viết plan (trước khi trừ cạnh reject):
  - bugfix: `reproduce→context`, `root-cause→evidence`, `fix→root-cause`, `regression→fix`, `review→fix`
  - feature: `implement→design-contract`, `test→implement`, `review→implement`, `review→test`,
    `review→design-contract`
  - performance: `profile→baseline`, `benchmark→profile`, `benchmark→baseline`, `review→optimize`
  - security-review: `regression-test→validate-findings`, `re-scan→fix`

  Để `checkGraph` quyết cạnh nào được miễn. Không sửa `workflow.graph.template.json` (AC3.3).
- [ ] **Step 6: Chạy** `node test/validate.mjs`. Mong đợi: không còn lỗi graph. Nếu chỉ còn lỗi version/lock
  thì để Task 4 xử lý.
- [ ] **Step 7: Commit**: `feat(workflows): cap backward on_fail edges with max_attempts`.

### Task 2: Luật Supervisor trong contract và dòng neo trong workflow
**Phủ AC:** AC1.1, AC2.1, AC2.2, AC3.4
**Files:**
- Modify: `core/principles/workflow-output-contract.md`
- Modify: `cli/lib/workflows.mjs` (`WF_ANCHORS`)
- Modify: `core/skills/artifact-templates/references/workflow.template.md`, `workflows/bugfix/WORKFLOW.md`,
  `workflows/feature/WORKFLOW.md`, `workflows/performance/WORKFLOW.md`, `workflows/security-review/WORKFLOW.md`,
  `workflows/orchestrator/WORKFLOW.md`
- Test: `test/contract/50-workflows.contract.mjs`

**Interfaces:**
- Consumes: khóa `max_attempts` (Task 1).
- Produces:
  - Khối YAML `agent_result:` trong contract, với các trường `agent`, `status`, `summary`, `changes`,
    `validation`, `findings`, `questions`, `remaining_risks`. Task 3 trỏ tới khối này bằng chuỗi `agent_result`.
  - Dòng neo, chép nguyên văn:
    `Supervisor (session chính) kiểm \`agent_result\` của worker và giới hạn retry theo contract đầu ra (\`core:principles\`).`

- [ ] **Step 1: Viết test.**
  - Thêm dòng neo trên vào cuối mảng `WF_ANCHORS`. Test sẵn có ở mục 27 (`missingAnchors` cho template và
    mọi stage) sẽ đỏ.
  - Trong mục 27, thêm `ok()` kiểm `workflow-output-contract.md` có chuỗi `agent_result:` và có dòng
    `status:` nằm trong khối đó, tên `AC1.1: contract có agent_result với status`. Đây là contract vận hành,
    nên được phép pin.
- [ ] **Step 2: Chạy** `node test/validate.mjs --only workflows`. Mong đợi: FAIL, thiếu dòng neo ở template và
  ở 5 `WORKFLOW.md`, thiếu `agent_result`.
- [ ] **Step 3: Viết contract.** Thêm vào `workflow-output-contract.md` sau mục `## Finding`:
  - `## Agent result`: khối YAML như §1 của design (có `questions: []`).
  - `## Kiểm đầu ra worker`: các luật AC2.1 và cách xử lý theo loại kết quả của AC2.2: đầu ra hỏng thì giao lại
    cho chính worker tối đa 2 lần; `blocked` thì đi `on_fail` ngay; `failed` hoặc gate trượt thì đi cạnh
    `on_fail`.
  - `## Retry có ngưỡng`: luật AC3.4, gồm đếm theo từng cạnh, không reset, khi hết ngưỡng thì `ask_user` kèm lý
    do trượt của từng lượt.
- [ ] **Step 4: Chèn dòng neo** vào template và 5 `WORKFLOW.md`, ngay dưới `## Xử lý lỗi & rollback` và trước
  bảng `| Tình huống | Hành động |`.
- [ ] **Step 5: Chạy** `node test/validate.mjs`. Mong đợi: các test anchor, contract và
  `checkGraphAgainstBody` đều PASS. Lỗi version/lock (nếu có) để Task 4.
- [ ] **Step 6: Commit**: `feat(core): add agent_result, worker check and retry rules to output contract`.

### Task 3: Mọi agent và template agent trỏ tới `agent_result`
**Phủ AC:** AC1.2
**Files:**
- Modify: 16 file `plugins/*/agents/*.md` (mục `## Report trả về`)
- Modify: `core/skills/artifact-templates/references/agent.template.md` (mục `## Report trả về`)
- Test: `test/contract/10-source.contract.mjs`
- Test: `test/contract/35-artifact-templates.contract.mjs`

**Interfaces:**
- Consumes: tên khối `agent_result` (Task 2).

- [ ] **Step 1: Viết test.**
  - Trong mục 2b của `10-source.contract.mjs`, trong vòng `for (const a of allAgents)`, cắt riêng phần thân
    của mục `## Report trả về` (từ heading đó tới `## ` kế tiếp, cùng cách hàm `section` ở
    `35-artifact-templates`). Thêm
    `ok(rep.includes('agent_result'), \`AC1.2: agent ${a.id}: Report trả về trỏ tới agent_result\`)`.
  - Trong `35-artifact-templates.contract.mjs`, ngay sau dòng kiểm `rep` của template agent, thêm
    `ok(rep.includes('agent_result'), 'AC1.2: template agent: Report trỏ tới agent_result')`.
- [ ] **Step 2: Chạy** `node test/validate.mjs --only source --only artifact`. Mong đợi: FAIL ở 16 agent và ở
  template.
- [ ] **Step 3: Sửa nội dung.**
  - Ở mỗi agent, thêm gạch đầu dòng đầu tiên của `## Report trả về`:
    `- Trả khối \`agent_result\` theo contract đầu ra (\`core:principles\`); các ý dưới là nội dung riêng của agent này.`
  - Ở template, thêm cùng câu đó (bỏ dấu `- `) làm dòng đầu, phía trên bảng. Giữ nguyên bảng 4 dòng.
- [ ] **Step 4: Chạy** `node test/validate.mjs`. Mong đợi: PASS, lỗi version/lock (nếu có) để Task 4.
- [ ] **Step 5: Commit**: `feat(agents): point agent reports to the shared agent_result block`.

### Task 4: Bump version, build, lock và chạy full suite
**Phủ AC:** AC3.3
**Files:**
- Modify: `core/.manifest.json`, `workflows/.manifest.json`, `plugins/backend/.manifest.json`,
  `plugins/frontend/.manifest.json`, `plugins/data/.manifest.json`, `plugins/engineering/.manifest.json`,
  `plugins/ops/.manifest.json`, `plugins/_versions.lock.json`
- Test: `test/validate.mjs`

- [ ] **Step 1: Bump version** tính từ giá trị đang có trên nhánh:
  - `core` và `workflows`: bump **minor**, vì có thêm contract và khóa graph.
  - 5 plugin có agent bị sửa: bump **patch**.
- [ ] **Step 2: Build và lock.** Chạy `npm run build`, sau đó `node cli/lib/versions.mjs --lock`. Mong đợi:
  lock được cập nhật, không bị từ chối.
- [ ] **Step 3: Chạy** `npm test`. Mong đợi: exit 0. Có lỗi thì sửa ở task gây ra lỗi, không nới test.
- [ ] **Step 4: Commit**: `chore(release): bump versions for supervisor worker contract`.

### Task 5: Spec sống `workflows`
**Phủ AC:** AC1.1, AC2.1, AC3.1
**Files:**
- Create: `docs/specs/workflows/spec.md` (từ `core/skills/artifact-templates/references/spec.template.md`)
- Modify: `docs/specs/README.md` (cập nhật câu nêu các spec sống đã có)

- [ ] **Step 1: Tạo spec.** Ghi 3 yêu cầu, mỗi yêu cầu có liên kết nguồn tới
  `../../requests/2026-10-23-supervisor-worker-contract/design.md` (thêm), và thêm một dòng vào bảng lịch sử:
  - `workflows/R1`: mọi agent trả `agent_result`.
  - `workflows/R2`: luật "Kiểm đầu ra worker".
  - `workflows/R3`: cạnh quay ngược có `max_attempts`, hết ngưỡng thì `ask_user`.
- [ ] **Step 2: Chạy**
  `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-23-supervisor-worker-contract/`.
  Mong đợi: không còn W11, không còn W9 (các file test đều đã tồn tại), không có cảnh báo AC thiếu test.
- [ ] **Step 3: Commit**: `docs(workflows): add living spec for supervisor rules`.
