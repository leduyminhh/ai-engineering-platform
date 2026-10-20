# Template chuẩn cho mọi artifact trong core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gom template của 9 loại artifact vào skill core `artifact-templates`. Mỗi template có nguồn tham chiếu và qua được validator của chính nó. `aip init` và các skill `*-init` đọc template từ đó. Sửa luôn các skill đang đọc template.

**Architecture:** Skill core (`SKILL.md` là mục lục, `references/*.template.md` là template). Helper `cli/lib/templates.mjs` đọc và bỏ khối header của template. `init.mjs` và `plugins.mjs` dùng helper này để sinh khung docs cho project đích. Contract mới `35-artifact-templates` đọc bảng mục lục, rồi kiểm từng template bằng validator sẵn có.

**Tech Stack:** Node.js ≥ 20, ESM, chỉ `node:*`. Harness `test/validate.mjs` (`ok`, `ctx`, `--only`, `--build`) và các `test/*.test.mjs`.

**Spec:** design.md

**Requirement:** không có

## Global Constraints

- Zero runtime dependency; ESM; file UTF-8 không BOM, LF; đường dẫn trong nội dung dùng `/`.
- Khối header template đúng dạng:

  ```
  <!-- artifact-template
  type: <loại>
  version: <số nguyên>
  validator: <đường dẫn → hàm, hoặc "chưa có">
  sources: <nguồn; nguồn>
  Bỏ khối này khi chép template ra dùng.
  -->
  ```

  Vị trí: đầu file, hoặc **ngay sau frontmatter** nếu template có frontmatter. Frontmatter phải nằm ở dòng 1 thì parser mới đọc được.
- Nội dung template viết tiếng Việt có dấu. Key frontmatter, field, lệnh giữ tiếng Anh. Template chỉ có placeholder `<…>` và ví dụ ngắn, không giảng giải.
- Quy tắc agent mới (3 tầng Phạm vi, `tools` bắt buộc, `writeScope` cho agent ghi, bảng Report) **chỉ kiểm trên template**. Không bật kiểm trên 16 agent thật.
- Template workflow giữ nguyên khung 8 trường và `WF_ANCHORS`. Không thêm ID bước hay `depends_on`.
- Template task giữ quy ước ID `UC<nn>-<loại>-<nn>` và phải qua `check-tasks.mjs`.
- Description của skill mới theo quy ước repo: ≤ 500 ký tự; có `Dùng khi người dùng muốn "…"` với 3–5 trigger không trùng skill khác; có `Không dùng khi … → <id có thật>`.
- Bump version và chạy `node cli/lib/versions.mjs --lock` **chỉ ở Task 7**. Task 1–6 chạy test có chọn lọc bằng `--only`.
- Mỗi task một commit qua `core:git-workflow` (header tiếng Anh, body tiếng Việt, `git commit -F`). Không push. Không thêm dòng Co-authored-by.

## Review Focus

- Template có frontmatter mà khối header nằm trước frontmatter → parser không đọc được frontmatter. Có test trong Task 1 (`templateHeader` nhận khối sau frontmatter) và trong Task 2/3 (validator đọc được frontmatter của template).
- `aip init --full` chạy trên project đã có `docs/requests/_TEMPLATE/plan.md` kiểu cũ → không được ghi đè. Có test trong Task 4.
- File template có CRLF (checkout trên Windows) → `stripTemplateHeader` vẫn bỏ đúng khối. Có test trong Task 1.
- Build `*-init` cho 4 provider phải ship `templates/docs/requests/_TEMPLATE/design.md`, và file này **không còn** khối header. Có test trong Task 4.
- Skill khác trỏ tới template core bằng tên skill, không bằng đường dẫn tuyệt đối. Pin ở Task 5 và Task 6 kiểm câu trỏ `artifact-templates`.

---

### Task 1: Skill core `artifact-templates` + helper template + template workflow

**Phủ AC:** AC1.2, AC1.3, AC2.4

**Files:**
- Create: `core/skills/artifact-templates/SKILL.md`
- Create: `cli/lib/templates.mjs`
- Move: `templates/workflows/workflow.template.md` → `core/skills/artifact-templates/references/workflow.template.md` (thêm khối header ngay sau frontmatter)
- Create: `test/contract/35-artifact-templates.contract.mjs`
- Modify: `test/contract/00-unit.contract.mjs:26`, `test/contract/40-conventions.contract.mjs:15,342`, `test/contract/50-workflows.contract.mjs:9` (đường dẫn template workflow mới)
- Modify: `CLAUDE.md` (câu "copy `templates/workflows/workflow.template.md`" → đường dẫn mới)

**Interfaces:**
- Produces (`cli/lib/templates.mjs`):
  - `export const TEMPLATES_DIR: string`, trỏ tới `core/skills/artifact-templates/references`.
  - `export function templateHeader(text: string): { type: string, version: number, validator: string, sources: string } | null`
  - `export function stripTemplateHeader(text: string): string`: bỏ khối header và đúng một dòng trống ngay sau nó; giữ nguyên frontmatter.
  - `export function templateIndex(skillMd: string): Array<{ type: string, file: string, validator: string, sources: string }>`: đọc bảng mục lục `| Loại | Template | Validator | Nguồn |` trong `SKILL.md`. `file` là đường dẫn tương đối trong link, ví dụ `references/workflow.template.md`.
- Produces (contract 35): duyệt `templateIndex(...)`. Với mỗi dòng, kiểm: file tồn tại, `templateHeader` khác `null`, và `type` trùng cột Loại. Task sau chỉ cần thêm dòng vào mục lục và thêm block kiểm riêng.

- [x] **Step 1: Viết test đỏ** trong `35-artifact-templates.contract.mjs`:
  - **Unit** `templateHeader` và `stripTemplateHeader`, gom thành một test tham số hóa với 4 trường hợp:
    - Header ở đầu file.
    - Header sau frontmatter.
    - File có CRLF.
    - File không có header → `null`; strip không đổi gì.
  - **Duyệt mục lục** như mô tả ở Interfaces.
  - **Workflow template:**
    - `checkWorkflowBody(tpl)` không có lỗi.
    - `missingAnchors(tpl)` rỗng.
    - `checkSourceKeys('workflow', …)` không có lỗi.
  - **Skill `artifact-templates`:**
    - Qua `checkSkillBody`.
    - Qua `checkDescription` (`knownIds` lấy từ `ctx`).
    - Qua `checkDescriptionStyle`.
- [x] **Step 2: Chạy, xác nhận đỏ** — `node test/validate.mjs --only 35-artifact --only 00-unit --only 40-conv --only 50-workflows`. Expected: FAIL vì chưa có `templates.mjs` / `SKILL.md` / file template mới.
- [x] **Step 3: Hiện thực.**
  - Viết `templates.mjs`.
  - Viết `SKILL.md`:
    - Frontmatter: `name: artifact-templates`, `order: 4`, `title`, `runsIn: plan`, `invoke: per-request`.
    - Khung `## Quy trình…` gồm 4 bước: chọn loại → mở template → điền → chạy validator nếu có → bỏ khối header.
    - Có `## Ranh giới an toàn…`, `## Verification`, `## Bản đồ tài liệu`.
    - Bảng mục lục lúc này chỉ có dòng workflow.
  - `git mv` file template workflow sang `references/` và thêm khối header.
  - Sửa 3 test và CLAUDE.md.
- [x] **Step 4: Chạy, xác nhận xanh** — cùng lệnh ở Step 2 → 0 fail.
- [x] **Step 5: Commit** — `feat(core): add artifact-templates skill with workflow template`

---

### Task 2: Template skill (tiến hóa)

**Phủ AC:** AC2.3

**Files:**
- Create: `core/skills/artifact-templates/references/skill.template.md`
- Delete: `templates/skills/skill.template.txt` (và thư mục `templates/skills/`)
- Modify: `core/skills/artifact-templates/SKILL.md` (thêm dòng mục lục `skill`)
- Modify: `test/contract/35-artifact-templates.contract.mjs`
- Modify: `CLAUDE.md` (bỏ nhắc `templates/skills/`)

**Interfaces:**
- Consumes: `templateIndex`, `templateHeader`, `stripTemplateHeader` (Task 1).

- [x] **Step 1: Viết test đỏ.** Thay mọi placeholder `<…>` bằng giá trị mẫu cố định, dùng một map ngay trong test. Sau đó kiểm:
  - Bản đã điền qua `checkSkillBody`, `checkDescription`, `checkDescriptionStyle`, và `checkSourceKeys('skill', …)`.
  - Template thô (chưa điền) chứa đủ 4 chuỗi:
    - `- [ ]` (checklist trong quy trình).
    - Một bước "validate → sửa → validate".
    - `500 dòng`.
    - `một tầng` (reference chỉ sâu một tầng).
  - `templates/skills/` không còn.
- [x] **Step 2: Chạy, xác nhận đỏ** — `node test/validate.mjs --only 35-artifact`. Expected: FAIL ở block skill.
- [x] **Step 3: Viết template.**
  - Frontmatter: `name`, `description` (một câu hành động + `Dùng khi …` + `Không dùng khi … → <id>`), `order`, `title`, `runsIn`, `invoke`.
  - Khối header (sources: Anthropic skill best practices; agentskills.io).
  - Heading: `## Quy trình — <tên>` (có checklist và vòng validate), `## Ranh giới an toàn`, `## Verification (trước khi báo hoàn thành)`, `## Bản đồ tài liệu`.
  - Xóa file `.txt`.
- [x] **Step 4: Chạy, xác nhận xanh** — `node test/validate.mjs --only 35-artifact --only 40-conv` → 0 fail.
- [x] **Step 5: Commit** — `feat(core): add evolved skill template to artifact-templates`

---

### Task 3: Template agent (mới)

**Phủ AC:** AC2.1, AC2.2

**Files:**
- Create: `core/skills/artifact-templates/references/agent.template.md`
- Modify: `core/skills/artifact-templates/SKILL.md` (thêm dòng mục lục `agent`)
- Modify: `test/contract/35-artifact-templates.contract.mjs`

- [x] **Step 1: Viết test đỏ.**
  - **Bản đã điền mẫu**, với `mode: write`, `tools: [Read, Edit, Write, Bash, Grep, Glob, Skill]`, `writeScope: ["src/**"]`, 2 skill:
    - Qua `checkAgentTools`, `checkAgentDescription`, `checkSourceKeys('agent', …)`.
    - Đúng khung 4 heading agent hiện có (`Vai trò`, `Phạm vi`, `Quy trình`, `Report trả về`).
  - **Template thô** chứa đủ:
    - `**Luôn làm:**`, `**Hỏi trước:**`, `**Không bao giờ:**` trong `## Phạm vi`.
    - `Khi được gọi:` trong `## Quy trình`, kèm một bước kiểm chứng (chạy lệnh → sửa → chạy lại).
    - Bảng `## Report trả về` có đủ các dòng `| Kết quả |`, `| Evidence |`, `| File đã đổi |`, `| Rủi ro còn lại |`.
    - Frontmatter có khóa `tools` và `writeScope`.
- [x] **Step 2: Chạy, xác nhận đỏ** — `node test/validate.mjs --only 35-artifact` → FAIL ở block agent.
- [x] **Step 3: Viết template** theo khung ở design §3 (dòng Agent). Khối header đặt sau frontmatter; sources: Claude Code subagents; GitHub agents.md (2025-11).
- [x] **Step 4: Chạy, xác nhận xanh** — `node test/validate.mjs --only 35-artifact` → 0 fail.
- [x] **Step 5: Commit** — `feat(core): add agent template with three-tier boundaries`

---

### Task 4: Template requirement / design / plan + `init` và `*-init` đọc từ core

**Phủ AC:** AC2.6, AC2.7, AC3.1, AC3.2, AC3.3, AC3.5

**Files:**
- Create: `core/skills/artifact-templates/references/{requirement,design,plan}.template.md`
- Delete: `templates/init/docs/requests/_TEMPLATE/` (requirement.md, plan.md)
- Modify: `cli/lib/templates.mjs`: thêm `export function initDocFiles(): Array<{ rel: string, content: string }>`. Hàm trả về các file cần sinh ở project đích, đã bỏ khối header. Task này map 3 file:
  - `docs/requests/_TEMPLATE/requirement.md`
  - `docs/requests/_TEMPLATE/design.md`
  - `docs/requests/_TEMPLATE/plan.md`
- Modify: `cli/lib/init.mjs`: khi `full`, ghi thêm `initDocFiles()`, áp cùng quy tắc không ghi đè file đã có.
- Modify: `cli/lib/plugins.mjs` (`initAssets` cho skill `*-init`) và `adapters/_shared/lib.mjs` (`assetFiles`): thêm kiểu asset `contentAssets: [{ name, content }]`, phát ra fileEntry `{ path, content }`. Dùng nó để ship `initDocFiles()` vào cây `templates/` của skill `*-init`.
- Modify: `core/skills/artifact-templates/SKILL.md` (3 dòng mục lục)
- Modify: `plugins/engineering/skills/engineering-spec-writing/references/spec-structure.md` (mục "Map vào `_TEMPLATE`": `plan.md` theo template plan của core, bỏ "khung Phase/Task")
- Modify: `test/contract/30-templates.contract.mjs:47-48` (bỏ 2 dòng `_TEMPLATE` khỏi `must`), `test/contract/35-artifact-templates.contract.mjs`, `test/init.test.mjs`

**Interfaces:**
- Produces: `initDocFiles()` (dùng lại ở Task 5); kiểu asset `contentAssets` trong stage.

- [ ] **Step 1: Viết test đỏ.**
  - **Contract 35** kiểm 3 template:
    - requirement: 4 heading gốc, `Hệ thống PHẢI`, mẫu `**AC1.1** — Given … When … Then …`, `## Không đổi (bugfix)`.
    - design: đủ heading theo design project 1 §4.2.
    - plan: header `writing-plans` + `**Requirement:**` + `**Phủ AC:**`.
    - Và kiểm `spec-structure.md` không còn chứa `Phase/Task`.
  - **`init.test.mjs`:**
    - (a) `init --full` trên thư mục trống sinh đủ 3 file `_TEMPLATE`, và không file nào chứa `<!-- artifact-template`.
    - (b) Thư mục đã có `docs/requests/_TEMPLATE/plan.md` → file đó không bị ghi đè và có tên trong `skipped`.
  - **Contract 30, mục 6b** (chạy `--build`): cây `templates/` của skill `*-init` ở cả 4 provider có `docs/requests/_TEMPLATE/design.md`, và file này không chứa khối header.
- [ ] **Step 2: Chạy, xác nhận đỏ** — `node test/init.test.mjs` và `node test/validate.mjs --build --only 35-artifact --only 30-templates`. Expected: FAIL.
- [ ] **Step 3: Hiện thực** theo danh sách Files. Nội dung 3 template đúng khung design project 1 §4.2. Khối header không có frontmatter, nên đặt ở đầu file.
- [ ] **Step 4: Chạy, xác nhận xanh** — cùng lệnh ở Step 2 → 0 fail.
- [ ] **Step 5: Commit** — `feat(core): serve request templates from artifact-templates`

---

### Task 5: Template ADR (MADR 4.0) + project-knowledge + skill đọc ADR

**Phủ AC:** AC2.8, AC3.1, AC3.3, AC3.4, AC3.7

**Files:**
- Create: `core/skills/artifact-templates/references/adr.template.md`
- Move: `templates/init/project-knowledge/*` → `core/skills/artifact-templates/references/project-knowledge/` (giữ tên file; thêm khối header vào file `.md`; với `tech-stack.yml` thì không thêm header mà ghi nguồn trong mục lục)
- Delete: `templates/init/docs/decisions/_TEMPLATE.md`, `templates/init/project-knowledge/`
- Modify: `templates/init/docs/decisions/0001-vi-du-quyet-dinh.md`, `0002-code-convention.md` (viết lại theo khung MADR tiếng Việt, giữ nguyên ý)
- Modify: `cli/lib/templates.mjs` (`initDocFiles()` thêm `docs/decisions/_TEMPLATE.md` và `project-knowledge/*`)
- Modify: `plugins/engineering/skills/engineering-adr/SKILL.md` (description + thân: "Nygard" → MADR 4.0; trỏ template `adr.template.md` của skill core `artifact-templates`), `plugins/engineering/skills/engineering-adr/references/adr-structure.md` (checklist theo mục MADR)
- Modify: `plugins/engineering/agents/engineering-spec-analyst.md:22`
- Modify: `core/skills/artifact-templates/SKILL.md` (dòng `adr`, `project-knowledge`)
- Modify: `test/contract/30-templates.contract.mjs` (bỏ `project-knowledge/*` và `docs/decisions/_TEMPLATE.md` khỏi `must`), `test/contract/35-artifact-templates.contract.mjs`, `test/init.test.mjs`

- [ ] **Step 1: Viết test đỏ.**
  - **Contract 35:**
    - ADR template có đủ các mục: `## Bối cảnh và vấn đề`, `## Yếu tố quyết định`, `## Các phương án`, `## Kết quả quyết định` (kèm `### Hệ quả`, `### Xác nhận`), `## Ưu nhược từng phương án`.
    - Có metadata `Trạng thái`, `Ngày`, `Người quyết định`.
    - 6 file project-knowledge có trong mục lục và tồn tại.
    - `engineering-adr` (SKILL.md + `adr-structure.md`) và `engineering-spec-analyst.md`: không còn `Nygard`, có chứa `MADR` và `artifact-templates`.
    - 2 ADR ví dụ có heading `## Bối cảnh và vấn đề` và `## Kết quả quyết định`.
  - **`init.test.mjs`:** `init --full` sinh `docs/decisions/_TEMPLATE.md` và `project-knowledge/project-overview.md`, cả hai không chứa khối header.
- [ ] **Step 2: Chạy, xác nhận đỏ** — `node test/init.test.mjs` và `node test/validate.mjs --build --only 35-artifact --only 30-templates --only conventions` → FAIL.
- [ ] **Step 3: Hiện thực** theo danh sách Files. Description của `engineering-adr` vẫn phải qua quy ước description (≤ 500 ký tự, trigger cũ giữ nguyên).
- [ ] **Step 4: Chạy, xác nhận xanh** — cùng lệnh ở Step 2 → 0 fail.
- [ ] **Step 5: Commit** — `feat(core): add MADR template and move project-knowledge to core`

---

### Task 6: Template task + `engineering-task-breakdown` trỏ về core

**Phủ AC:** AC2.5, AC3.6

**Files:**
- Create: `core/skills/artifact-templates/references/task.template.md`: gộp khung `tasks.md` chung, gồm:
  - Mục `Use case`, `Bảng tổng task`, `Chi tiết task`, `Câu hỏi mở & giả định`, lấy từ `output-formats.md` §3.
  - Header chung của task, lấy từ `task-template-common.md` (bảng 6 loại, `**Ngữ cảnh:**`, `**Acceptance criteria:**`, `**File dự kiến:**`, `**Lệnh verify:**`, `**DoD:**`, quy tắc `N/A — <lý do>`, `[giả định]`).
- Delete: `plugins/engineering/skills/engineering-task-breakdown/references/task-template-common.md`
- Modify: `plugins/engineering/skills/engineering-task-breakdown/SKILL.md` (link `task-template-common.md` → template `task.template.md` của skill core `artifact-templates`) và `references/output-formats.md` §3 (thay khung bằng câu trỏ tới template core; giữ phần Excel/CSV)
- Modify: `core/skills/artifact-templates/SKILL.md` (dòng `task`; validator = `check-tasks.mjs` của `engineering-task-breakdown`, chỉ có khi cài plugin `engineering`)
- Modify: `test/content/13-task-breakdown.pin.mjs:15-16,42-50` (chuyển các pin của `task-template-common.md` sang `task.template.md` của core), `test/contract/35-artifact-templates.contract.mjs`

- [ ] **Step 1: Viết test đỏ.**
  - **Contract 35:**
    - Thay placeholder trong `task.template.md` bằng mẫu `UC01` (đủ CT/BE/FE-UI/FE-INT như fixture ở `14-task-breakdown-integration.pin.mjs`).
    - Chạy `checkTasks(parseTasks(…))` → 0 lỗi.
    - Template thô chứa đủ header chung kể trên.
    - `SKILL.md` của task-breakdown chứa `artifact-templates` và không còn `task-template-common.md`.
  - **Pin 13:** trỏ sang file core.
- [ ] **Step 2: Chạy, xác nhận đỏ** — `node test/validate.mjs --only 35-artifact --only 13-task --only 14-task` → FAIL.
- [ ] **Step 3: Hiện thực** theo danh sách Files. `check-tasks.mjs` không sửa.
- [ ] **Step 4: Chạy, xác nhận xanh** — cùng lệnh ở Step 2 → 0 fail.
- [ ] **Step 5: Commit** — `feat(core): move shared task template to artifact-templates`

---

### Task 7: Đủ 9 loại, version, lock, kiểm tra toàn bộ

**Phủ AC:** AC1.1, AC4.1

**Files:**
- Modify: `test/contract/35-artifact-templates.contract.mjs` (kiểm mục lục có đúng 9 loại: `skill`, `agent`, `workflow`, `requirement`, `design`, `plan`, `task`, `adr`, `project-knowledge`)
- Modify: `core/.manifest.json` (`1.5.3` → `1.6.0`), `plugins/engineering/.manifest.json` (`2.0.1` → `2.1.0`); bump thêm plugin có skill `*-init` (backend, frontend, data) nếu `versions.mjs --lock` báo hash đổi
- Modify: `plugins/_versions.lock.json` (sinh bằng lệnh)
- Modify: `CLAUDE.md`, `README.md`, `README_VI.md` (mô tả `templates/` và skill core mới, nếu có nhắc vị trí template cũ)

- [ ] **Step 1: Viết test đỏ** — thêm kiểm "đúng 9 loại" → `node test/validate.mjs --only 35-artifact`. Expected: xanh nếu Task 1–6 đã đủ; đỏ thì ghi loại nào thiếu và quay lại task tương ứng.
- [ ] **Step 2: Bump version + build + lock** — `npm run build` rồi `node cli/lib/versions.mjs --lock`. Expected: lock ghi version mới, không từ chối. Nếu bị từ chối vì plugin `*-init` đổi hash → bump plugin đó rồi chạy lại.
- [ ] **Step 3: Chạy toàn bộ** — `npm test` → exit 0; `npm run pack:verify` → pass.
- [ ] **Step 4: Rà tham chiếu cũ.** Chạy `git grep -n "templates/skills\|templates/workflows\|templates/init/project-knowledge\|_TEMPLATE/requirement.md\|task-template-common" -- . ":!docs/superpowers" ":!docs/requests" ":!CHANGELOG.md"`. Expected: không còn kết quả nào.
- [ ] **Step 5: Commit** — `chore(release): bump core and engineering for artifact templates`
