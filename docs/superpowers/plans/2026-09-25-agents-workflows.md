# Agents + 12 Workflows + Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm 11 agent (subagent native) và bộ 12 workflow + orchestrator ở thư mục cấp repo `workflows/`, project cho Claude và Codex, cài được từ source lẫn gói npm.

**Architecture:**
- Agent: nguồn `plugins/<id>/agents/<agent-id>.md` → Claude `agents/*.md`, Codex `agents/*.toml`.
- Workflow: nguồn `workflows/<slug>/WORKFLOW.md`, load thành object hình dạng plugin (khuôn `loadCore()`), adapter chiếu thành plugin/skill-group `workflows`.
- Installer dùng lại cơ chế chọn `--plugin`/`--skill` + `installOne`; thêm closure phụ thuộc suy ra mỗi lần, đặt agent, và bỏ workflow ở provider chưa hỗ trợ.

**Tech Stack:** Pure ESM, Node ≥20, zero runtime dependency, không build step. Test dùng harness `ok(cond, msg)`; test cài dùng `AIE_INSTALL_ROOT`.

**Spec:** [docs/superpowers/specs/2026-09-25-agents-workflows-design.md](../specs/2026-09-25-agents-workflows-design.md)

## Global Constraints

- Pure ESM, zero runtime dependency (chỉ Node built-in), Node ≥20.
- Frontmatter chỉ scalar; danh sách là chuỗi phân tách bằng dấu phẩy (như `sharedAssets`).
- Agent id = `<plugin>-<slug>`, duy nhất toàn cục, không chứa `:`. Workflow id = `workflow-<tên thư mục>`.
- KHÔNG đổi hành vi/nội dung 27 skill hiện có.
- Đóng gói: chỉ sửa `package.json` mục `files`, `pack.config.json` mục `allowTop`, `plugins/_published.json` — và chỉ ở Task 13.
- KHÔNG thêm file test mới vào script `npm test`; chỉ thêm assert vào `test/validate.mjs`, `test/install.test.mjs`, `test/pack-guard.test.mjs`.
- File UTF-8 không BOM, LF. Nội dung workflow/agent viết tiếng Việt có dấu. Comment code theo `AGENTS.md`: chỉ giải thích *why*, tiếng Việt, 1–2 dòng.
- Test install/uninstall phải chạy qua seam `args` (skill/plugin mặc định `[]` ≠ `undefined`) [[aip-uninstall-args-seam]].
- Không `rm -rf` sandbox chứa junction; dọn bằng `fs.rmSync` của Node [[windows-junction-rm-hazard]].
- Mỗi task = 1 commit qua skill `core:git-workflow` (header EN, body VI có dấu, KHÔNG trailer `Co-Authored-By`). Dừng cho người duyệt diff trước mỗi commit.
- Push/PR: luôn chờ người dùng xác nhận.
- `<scratchpad>` trong lệnh = thư mục tạm của phiên thực thi, nằm NGOÀI repo.

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `cli/lib/plugins.mjs` | `splitList`, `loadAgents`, `loadWorkflows`, `WORKFLOWS_DIR` | 2 |
| `cli/lib/workflows.mjs` (mới) | Helper thuần: khung body, step, registry, closure, `WORKFLOW_PROVIDERS` | 3 |
| `adapters/_shared/agents.mjs` (mới) | Dựng agent Claude/Codex, TOML escape, preamble dispatch workflow | 5, 6 |
| `adapters/claude/adapter.mjs` | + agent `.md`, + plugin `workflows` | 5 |
| `adapters/codex/adapter.mjs` | + agent `.toml`, + `workflows/skills/` | 6 |
| `cli/build.mjs` | Truyền `workflows` vào ctx adapter, in ở `--list` | 5 |
| `cli/lib/install.mjs` | Catalog có `workflows`, closure, lỗi thiếu skill, đặt agent, bỏ workflow ở cursor/antigravity | 9 |
| `cli/lib/report.mjs`, `cli/index.mjs` | Report có workflows; in danh sách kéo theo | 9 |
| `workflows/.manifest.json` (mới) | Identity nhóm workflows | 2 |
| `workflows/<slug>/WORKFLOW.md` ×12, `workflows/orchestrator/WORKFLOW.md` | Nội dung | 8, 10, 11, 12 |
| `plugins/<id>/agents/*.md` ×11 | Nội dung agent | 7 |
| `test/validate.mjs` | Unit helper + adapter; contract source/build | 2–8 |
| `test/install.test.mjs` | Catalog, closure, cài/gỡ workflow + agent | 9, 13 |
| `test/pack-guard.test.mjs` | Policy publish mới | 13 |
| `plugins/_published.json`, `package.json`, `pack.config.json`, manifest | Publish engineering + ops, ship `workflows/` | 13 |
| `README.md`, `README_VI.md`, `CLAUDE.md`, `CHANGELOG.md`, `plugins/engineering/shared/principles.md` | Tài liệu | 14 |

---

### Task 1: Branch + commit spec, plan, template

**Files:** `docs/superpowers/specs/2026-09-25-agents-workflows-design.md`, `docs/superpowers/plans/2026-09-25-agents-workflows.md`, `templates/workflows/workflow.template.md`

- [ ] **Step 1: Hỏi base branch.** Branch hiện tại là `chore/skill-audit-content-fixes`. Hỏi người dùng: branch đó đã merge vào `master` chưa, có cần base trên nó không.
- [ ] **Step 2: Tạo branch** `feature/agents-workflows` qua `core:git-workflow` từ base đã chốt.
- [ ] **Step 3: Verify** `npm test` → exit 0 (template không bị code nào quét).
- [ ] **Step 4: Commit** `docs(plan): add agents and workflows design, plan and workflow template`.

### Task 2: Loader — agent, workflows, `splitList`

**Files:**
- Modify: `cli/lib/plugins.mjs`
- Create: `workflows/.manifest.json`
- Test: `test/validate.mjs`

**Interfaces:**
- Produces:
  - `splitList(v: unknown): string[]`
  - `WORKFLOWS_DIR: string`
  - `loadPlugins()` mỗi plugin thêm `agents: Agent[]`; `loadCore()` thêm `agents: []`
  - `Agent = { id, plugin, description, mode, skills: string[] /* 'plugin/skill' */, model, effort, color, body, file }`
  - `loadWorkflows(): null | { id: 'workflows', name, description, version, manifest, shared: { principles: '' }, stages: WorkflowStage[], agents: [], dir }`
  - `WorkflowStage = { id, slug, order, title, description, kind, tier, risk, agents: string[], requires: string[], runsIn, invoke, pipeline, next, body, dir, assetsDir, assets: string[] /* thư mục */, fileAssets: {name,from}[], dirAssets: [] }`

- [ ] **Step 1: Viết test fail** — thêm vào `test/validate.mjs`, ngay sau import (sửa dòng import để thêm `loadWorkflows, splitList`):

```js
import { loadPlugins, loadCore, loadMarketplace, loadWorkflows, splitList, REPO_ROOT, PLUGINS_DIR, CORE_DIR } from '../cli/lib/plugins.mjs';
```

và thêm khối mới ngay trước `// 1. CORE`:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 0. UNIT: loader agent + workflows
// ─────────────────────────────────────────────────────────────────────────────
ok(JSON.stringify(splitList(' a, b ,,c ')) === '["a","b","c"]', 'splitList: tách phẩy + trim + bỏ rỗng');
ok(Array.isArray(splitList(undefined)) && splitList(undefined).length === 0, 'splitList: không phải chuỗi → []');
ok(loadPlugins().every((p) => Array.isArray(p.agents)), 'loadPlugins: mỗi plugin có mảng agents');
ok(Array.isArray(loadCore().agents) && loadCore().agents.length === 0, 'loadCore: agents = []');
{
  const wf = loadWorkflows();
  ok(!!wf && wf.id === 'workflows', 'loadWorkflows: đọc workflows/.manifest.json (id = workflows)');
  ok(!!wf && Array.isArray(wf.stages), 'loadWorkflows: có mảng stages');
}
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `node test/validate.mjs`
Expected: lỗi import `loadWorkflows`/`splitList` không được export (SyntaxError) → exit ≠ 0.

- [ ] **Step 3: Implement** trong `cli/lib/plugins.mjs`:

Sau `export const CORE_DIR = ...` thêm:

```js
export const WORKFLOWS_DIR = path.join(REPO_ROOT, 'workflows');
```

Sau hàm `readText` thêm:

```js
/** Danh sách trong frontmatter là chuỗi "a, b" vì parser chỉ nhận scalar. */
export function splitList(v) {
  return typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
}
```

Trong `loadCore()` thêm field `agents: [],` sau `stages`.

Sau hàm `loadSkills` thêm:

```js
/** Agent ở `agents/<id>.md`; `skills` trần hiểu là skill cùng plugin. */
function loadAgents(pluginDir, pluginId) {
  const dir = path.join(pluginDir, 'agents');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const { meta, body } = parseFrontmatter(readText(path.join(dir, f)));
    return {
      id: meta.name || path.basename(f, '.md'),
      plugin: pluginId,
      description: meta.description || '',
      mode: meta.mode || '',
      skills: splitList(meta.skills).map((s) => (s.includes('/') ? s : `${pluginId}/${s}`)),
      model: meta.model || null,
      effort: meta.effort || null,
      color: meta.color || null,
      body,
      file: path.join(dir, f),
    };
  });
}

/**
 * Bộ workflow cấp repo (`workflows/<slug>/WORKFLOW.md`), trả object hình dạng plugin như loadCore()
 * để adapter/installer dùng lại đường xử lý skill. Thiếu `workflows/.manifest.json` → null.
 */
export function loadWorkflows() {
  const manifestPath = path.join(WORKFLOWS_DIR, '.manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = readJSON(manifestPath);
  const stages = [];
  for (const e of fs.readdirSync(WORKFLOWS_DIR, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const dir = path.join(WORKFLOWS_DIR, e.name);
    const file = path.join(dir, 'WORKFLOW.md');
    if (!fs.existsSync(file)) continue;
    const { meta, body } = parseFrontmatter(readText(file));
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter((x) => x.name !== 'WORKFLOW.md' && x.name !== 'README.md');
    // assetFiles copy `assets` bằng copyDir, nên file lẻ (checklist.md) phải đi đường fileAssets.
    const assets = entries.filter((x) => x.isDirectory()).map((x) => x.name);
    const fileAssets = entries.filter((x) => x.isFile()).map((x) => ({ name: x.name, from: path.join(dir, x.name) }));
    stages.push({
      id: meta.name || `workflow-${e.name}`,
      slug: e.name,
      order: typeof meta.order === 'number' ? meta.order : 0,
      title: meta.title || '',
      description: meta.description || '',
      kind: meta.kind || '',
      tier: typeof meta.tier === 'number' ? meta.tier : null,
      risk: meta.risk || '',
      agents: splitList(meta.agents),
      requires: splitList(meta.requires),
      runsIn: meta.runsIn || '',
      invoke: meta.invoke || '',
      pipeline: meta.pipeline === false || meta.pipeline === 'false' ? false : true,
      next: meta.next === undefined ? null : meta.next,
      body,
      dir,
      assetsDir: dir,
      assets,
      fileAssets,
      dirAssets: [],
    });
  }
  stages.sort((a, b) => a.order - b.order);
  return {
    id: manifest.id || 'workflows',
    name: manifest.name || 'Workflows',
    description: manifest.description || '',
    version: manifest.version || '0.0.0',
    manifest,
    shared: { principles: '' },
    stages,
    agents: [],
    dir: WORKFLOWS_DIR,
  };
}
```

Trong `loadPlugins()` thêm field `agents: loadAgents(dir, id),` sau `stages`.

Tạo `workflows/.manifest.json`:

```json
{
  "id": "workflows",
  "name": "Engineering Workflows",
  "description": "Bộ 12 workflow kỹ thuật (feature, bugfix, refactor, code review, testing, security review, db change, API, performance, incident, release, docs) + orchestrator chọn workflow theo yêu cầu. Workflow điều phối agent/skill của nhiều plugin qua các bước có gate, evidence và checkpoint người duyệt.",
  "version": "1.0.0"
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `node test/validate.mjs`
Expected: `KẾT QUẢ: … 0 fail`.

- [ ] **Step 5: Verify không đổi build** — `npm test` → exit 0.
- [ ] **Step 6: Commit** `feat(loader): load agents and repo-level workflows`.

### Task 3: Helper thuần `cli/lib/workflows.mjs`

**Files:**
- Create: `cli/lib/workflows.mjs`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: `splitList` (Task 2) — không dùng trực tiếp; nhận dữ liệu đã load.
- Produces:
  - `WF_HEADINGS: string[]` (7), `STEP_FIELDS: string[]` (8), `RISKS: string[]`, `WORKFLOW_PROVIDERS: ['claude','codex']`
  - `parseSteps(text) → { n, title, checkpoint: boolean, body }[]`
  - `checkWorkflowBody(text, { kind = 'workflow' }) → string[]` (rỗng = hợp lệ)
  - `stepRefs(text) → { n, agents: string[], skills: string[] }[]`
  - `parseRegistry(text) → { rows: { id, risk, next: string[] }[], priority: string[] }`
  - `expandWorkflowDeps(selected: Set<string>, { workflows: WorkflowStage[], agents: Agent[] }) → { skills: Set<string>, pulled: { from, added: string[] }[], required: Set<string> }`
  - `missingDeps(skills: Iterable<string>, catalogIds: Set<string>) → string[]`

- [ ] **Step 1: Viết test fail** — trong `test/validate.mjs` thêm import:

```js
import { checkWorkflowBody, stepRefs, parseRegistry, expandWorkflowDeps, missingDeps, RISKS } from '../cli/lib/workflows.mjs';
```

và thêm vào cuối khối `0. UNIT`:

```js
// 0b. UNIT: helper workflow (khung body, step, registry, closure)
{
  const tpl = fs.readFileSync(path.join(REPO_ROOT, 'templates', 'workflows', 'workflow.template.md'), 'utf8').replace(/\r\n/g, '\n');
  const tplErrs = checkWorkflowBody(tpl);
  ok(tplErrs.length === 0, `template workflow PASS checkWorkflowBody${tplErrs.length ? ' — ' + tplErrs.join('; ') : ''}`);

  const step = (n, fields, tail = '') => `### Bước ${n} — Tên${tail}\n` + fields.map((f) => `- **${f}:** x`).join('\n') + '\n';
  const ALL = ['Thực hiện', 'Đầu vào', 'Hành động', 'Ràng buộc', 'Đầu ra', 'Gate', 'Khi fail', 'Evidence'];
  const frame = (steps, result = 'workflow_result:') => [
    '## Mục tiêu & đầu vào', 'x', '## Điều kiện tiên quyết', 'x', '## Các bước', steps,
    '## Checkpoint', 'x', '## Xử lý lỗi & rollback', 'x', '## Definition of Done', 'x', '## Report cuối', result,
  ].join('\n');
  ok(checkWorkflowBody(frame(step(1, ALL, ' ⏸'))).length === 0, 'checkWorkflowBody: khung đủ → hợp lệ');
  ok(checkWorkflowBody(frame(step(1, ALL.filter((f) => f !== 'Gate'), ' ⏸'))).some((e) => e.includes('"Gate"')),
    'checkWorkflowBody: thiếu trường Gate → báo lỗi');
  ok(checkWorkflowBody(frame(step(1, ALL, ' ⏸') + step(3, ALL))).some((e) => e.includes('liên tục')),
    'checkWorkflowBody: đánh số nhảy → báo lỗi');
  ok(checkWorkflowBody(frame(step(1, ALL))).some((e) => e.includes('⏸')), 'checkWorkflowBody: không có ⏸ → báo lỗi');
  ok(checkWorkflowBody(frame(step(1, ALL, ' ⏸')).replace('## Checkpoint', '## X')).some((e) => e.includes('Checkpoint')),
    'checkWorkflowBody: thiếu heading → báo lỗi');
  ok(checkWorkflowBody(frame(step(1, ALL, ' ⏸')), { kind: 'orchestrator' }).some((e) => e.includes('orchestrator_result')),
    'checkWorkflowBody: orchestrator đòi orchestrator_result');

  const refs = stepRefs(frame(
    '### Bước 1 — A ⏸\n- **Thực hiện:** agent `backend-reviewer` ∥ agent `frontend-reviewer`\n' +
    '### Bước 2 — B\n- **Thực hiện:** skill `backend-refactor` | skill `core/git-workflow`\n'));
  ok(JSON.stringify(refs[0].agents) === '["backend-reviewer","frontend-reviewer"]', 'stepRefs: bắt agent song song');
  ok(JSON.stringify(refs[1].skills) === '["backend-refactor","core/git-workflow"]', 'stepRefs: bắt skill trần + đầy đủ');

  const reg = parseRegistry([
    '## Registry', '| id | Tín hiệu | Risk | Nối tiếp | Không dùng khi |', '|---|---|---|---|---|',
    '| `workflow-incident` | prod down | critical | `workflow-bugfix`, `workflow-docs` | x |',
    '| `workflow-docs` | readme | low | — | x |',
    '**Thứ tự ưu tiên:** `workflow-incident` > `workflow-docs`', '## Khác',
  ].join('\n'));
  ok(reg.rows.length === 2 && reg.rows[0].risk === 'critical', 'parseRegistry: đọc dòng + risk');
  ok(JSON.stringify(reg.rows[0].next) === '["workflow-bugfix","workflow-docs"]' && reg.rows[1].next.length === 0,
    'parseRegistry: đọc cột Nối tiếp ("—" = rỗng)');
  ok(JSON.stringify(reg.priority) === '["workflow-incident","workflow-docs"]', 'parseRegistry: đọc thứ tự ưu tiên');

  const model = {
    workflows: [{ id: 'workflow-x', requires: ['core/git-workflow'], agents: ['be-rev'] }],
    agents: [{ id: 'be-rev', skills: ['backend/backend-code-review'] }],
  };
  const dep = expandWorkflowDeps(new Set(['workflows/workflow-x']), model);
  ok(dep.skills.has('core/git-workflow') && dep.skills.has('backend/backend-code-review'),
    'expandWorkflowDeps: kéo requires + skill của agent');
  ok(dep.pulled.length === 1 && dep.pulled[0].from === 'workflow-x', 'expandWorkflowDeps: ghi nguồn kéo theo');
  ok(expandWorkflowDeps(new Set(['backend/backend-init']), model).pulled.length === 0,
    'expandWorkflowDeps: không có workflow → giữ nguyên');
  ok(JSON.stringify(missingDeps(dep.required, new Set(['core/git-workflow']))) === '["backend/backend-code-review"]',
    'missingDeps: nêu skill không có trong catalog');
  ok(RISKS.join(',') === 'low,medium,high,critical', 'RISKS: 4 mức');
}
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `node test/validate.mjs`
Expected: lỗi import `../cli/lib/workflows.mjs` không tồn tại.

- [ ] **Step 3: Implement** `cli/lib/workflows.mjs`:

```js
// Helper THUẦN cho bộ workflow: kiểm khung body, trích tham chiếu bước, registry orchestrator,
// closure phụ thuộc khi cài. Zero-dependency; không đọc đĩa để test được độc lập.

export const WF_HEADINGS = ['Mục tiêu & đầu vào', 'Điều kiện tiên quyết', 'Các bước', 'Checkpoint',
  'Xử lý lỗi & rollback', 'Definition of Done', 'Report cuối'];
export const STEP_FIELDS = ['Thực hiện', 'Đầu vào', 'Hành động', 'Ràng buộc', 'Đầu ra', 'Gate', 'Khi fail', 'Evidence'];
export const RISKS = ['low', 'medium', 'high', 'critical'];
// Cursor/Antigravity chưa có đích native cho workflow (spec §9 P1) nên installer bỏ workflow ở đó.
export const WORKFLOW_PROVIDERS = ['claude', 'codex'];

function section(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return null;
  const end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  return lines.slice(start + 1, end === -1 ? lines.length : end).join('\n');
}

export function parseSteps(text) {
  const sec = section(text, 'Các bước');
  if (sec === null) return [];
  return sec.split(/^### /m).slice(1).map((part) => {
    const [head, ...rest] = part.split('\n');
    const m = head.match(/^Bước (\d+) — (.+)$/);
    return {
      n: m ? Number(m[1]) : NaN,
      title: (m ? m[2] : head).trim(),
      checkpoint: head.trim().endsWith('⏸'),
      body: rest.join('\n'),
    };
  });
}

export function checkWorkflowBody(text, { kind = 'workflow' } = {}) {
  const errs = [];
  for (const h of WF_HEADINGS) if (section(text, h) === null) errs.push(`thiếu heading "## ${h}"`);
  const steps = parseSteps(text);
  if (!steps.length) errs.push('không có bước "### Bước <n> — <tên>"');
  steps.forEach((s, i) => {
    if (s.n !== i + 1) errs.push(`bước thứ ${i + 1} đánh số "${s.n}" (phải liên tục từ 1)`);
    for (const f of STEP_FIELDS) if (!s.body.includes(`**${f}:**`)) errs.push(`bước ${s.n}: thiếu trường "${f}"`);
  });
  if (steps.length && !steps.some((s) => s.checkpoint)) errs.push('không có bước nào gắn ⏸');
  const block = kind === 'orchestrator' ? 'orchestrator_result:' : 'workflow_result:';
  if (!text.includes(block)) errs.push(`thiếu khối "${block}"`);
  return errs;
}

export function stepRefs(text) {
  return parseSteps(text).map((s) => {
    const line = s.body.split('\n').find((l) => l.includes('**Thực hiện:**')) || '';
    // Chỉ token trong backtick có ký tự id hợp lệ; placeholder `<plugin>-<agent>` của template bị bỏ qua.
    const grab = (kw) => [...line.matchAll(new RegExp(`${kw}\\s+\`([a-z0-9/-]+)\``, 'g'))].map((m) => m[1]);
    return { n: s.n, agents: grab('agent'), skills: grab('skill') };
  });
}

export function parseRegistry(text) {
  const rows = [];
  for (const line of (section(text, 'Registry') || '').split('\n')) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) continue;
    const id = cells[0].replace(/`/g, '');
    if (!id.startsWith('workflow-')) continue;
    const next = [...cells[3].matchAll(/`(workflow-[a-z0-9-]+)`/g)].map((m) => m[1]);
    rows.push({ id, risk: cells[2].replace(/`/g, ''), next });
  }
  const pri = text.split('\n').find((l) => l.startsWith('**Thứ tự ưu tiên:**')) || '';
  const priority = [...pri.matchAll(/`(workflow-[a-z0-9-]+)`/g)].map((m) => m[1]);
  return { rows, priority };
}

/**
 * Mỗi `workflows/<id>` đã chọn kéo theo `requires` + skill của agent trong `agents`. Một lượt là đủ
 * vì validate ép `requires` chỉ trỏ tới skill plugin/core, không trỏ tới workflow khác.
 */
export function expandWorkflowDeps(selected, { workflows = [], agents = [] } = {}) {
  const skills = new Set(selected);
  const required = new Set();
  const pulled = [];
  const agentById = new Map(agents.map((a) => [a.id, a]));
  for (const wf of workflows) {
    if (!skills.has(`workflows/${wf.id}`)) continue;
    const need = [...wf.requires];
    for (const aid of wf.agents) need.push(...((agentById.get(aid) || {}).skills || []));
    const added = [];
    for (const s of need) {
      required.add(s);
      if (!skills.has(s)) { skills.add(s); added.push(s); }
    }
    if (added.length) pulled.push({ from: wf.id, added: added.sort() });
  }
  return { skills, pulled, required };
}

export function missingDeps(skills, catalogIds) {
  return [...skills].filter((s) => !catalogIds.has(s)).sort();
}
```

- [ ] **Step 4: Chạy test, xác nhận pass** — `node test/validate.mjs` → `0 fail`.
- [ ] **Step 5: `npm test`** → exit 0.
- [ ] **Step 6: Commit** `feat(workflows): add pure helpers for body, steps, registry and deps`.

### Task 4: Contract validate cho agent + workflows (source)

**Files:**
- Modify: `test/validate.mjs`

**Interfaces:**
- Consumes: `loadPlugins().agents`, `loadWorkflows()`, `checkWorkflowBody`, `stepRefs`, `parseRegistry`, `RISKS`.

- [ ] **Step 1: Thêm contract** — sau khối `// 2. SOURCE structure mỗi plugin` (sau vòng `for (const p of plugins)` kết thúc, trước `// 3. BUILD OUTPUT`):

```js
// ─────────────────────────────────────────────────────────────────────────────
// 2b. SOURCE: agents (plugins/<id>/agents/*.md)
// ─────────────────────────────────────────────────────────────────────────────
const catalogSkillIds = new Set([
  'core/principles', ...core.stages.map((s) => `core/${s.id}`),
  ...plugins.flatMap((p) => p.stages.map((s) => `${p.id}/${s.id}`)),
]);
const allAgents = plugins.flatMap((p) => p.agents);
const MODES = ['read-only', 'write'];
const MODELS = ['sonnet', 'opus', 'haiku', 'fable', 'inherit'];
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const AGENT_HEADINGS = ['Vai trò', 'Phạm vi', 'Quy trình', 'Report trả về'];
ok(new Set(allAgents.map((a) => a.id)).size === allAgents.length, 'agents: id duy nhất toàn cục');
for (const a of allAgents) {
  ok(path.basename(a.file, '.md') === a.id, `agent ${a.id}: name == tên file`);
  ok(a.id.startsWith(`${a.plugin}-`) && !a.id.includes(':'), `agent ${a.id}: prefix "${a.plugin}-", không chứa ":"`);
  ok(a.description.length > 10, `agent ${a.id}: có description`);
  ok(MODES.includes(a.mode), `agent ${a.id}: mode ∈ {read-only, write} (=${a.mode})`);
  ok(a.skills.length > 0, `agent ${a.id}: skills không rỗng`);
  for (const s of a.skills) ok(catalogSkillIds.has(s), `agent ${a.id}: skill "${s}" tồn tại`);
  if (a.model) ok(MODELS.includes(a.model), `agent ${a.id}: model hợp lệ (=${a.model})`);
  if (a.effort) ok(EFFORTS.includes(a.effort), `agent ${a.id}: effort hợp lệ (=${a.effort})`);
  for (const h of AGENT_HEADINGS) ok(a.body.includes(`## ${h}`), `agent ${a.id}: có heading "## ${h}"`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2c. SOURCE: workflows/ (bộ workflow + orchestrator cấp repo)
// ─────────────────────────────────────────────────────────────────────────────
const workflows = loadWorkflows();
ok(!!workflows, 'workflows/.manifest.json tồn tại');
if (workflows) {
  for (const f of ['id', 'name', 'description', 'version']) ok(!!workflows.manifest[f], `workflows: .manifest.json có "${f}"`);
  const agentById = new Map(allAgents.map((a) => [a.id, a]));
  const byBare = new Map([...catalogSkillIds].map((s) => [s.split('/')[1], s]));
  const wfs = workflows.stages.filter((s) => s.kind === 'workflow');
  const orch = workflows.stages.filter((s) => s.kind === 'orchestrator');
  const orders = workflows.stages.map((s) => s.order);
  ok(new Set(orders).size === orders.length, 'workflows: order không trùng');
  if (workflows.stages.length) ok(orch.length === 1, 'workflows: đúng 1 orchestrator');
  for (const s of workflows.stages) {
    ok(s.id === `workflow-${s.slug}`, `${s.id}: name == "workflow-<thư mục>"`);
    ok(['workflow', 'orchestrator'].includes(s.kind), `${s.id}: kind ∈ {workflow, orchestrator}`);
    ok(s.description.length > 10, `${s.id}: có description`);
    ok(RUN_IN.includes(s.runsIn) && INVOKE_IN.includes(s.invoke), `${s.id}: runsIn/invoke hợp lệ`);
    ok(s.pipeline === false && s.next === null, `${s.id}: pipeline=false, next=null`);
    for (const aid of s.agents) ok(agentById.has(aid), `${s.id}: agent "${aid}" tồn tại`);
    for (const r of s.requires) ok(catalogSkillIds.has(r), `${s.id}: requires "${r}" là skill plugin/core có thật`);
    const errs = checkWorkflowBody(s.body, { kind: s.kind });
    ok(errs.length === 0, `${s.id}: khung body hợp lệ${errs.length ? ' — ' + errs.join('; ') : ''}`);
    const allowed = new Set([...s.requires, ...s.agents.flatMap((aid) => (agentById.get(aid) || { skills: [] }).skills)]);
    for (const st of stepRefs(s.body)) {
      for (const aid of st.agents) ok(s.agents.includes(aid), `${s.id} bước ${st.n}: agent "${aid}" có trong frontmatter agents`);
      for (const sk of st.skills) {
        const full = sk.includes('/') ? sk : byBare.get(sk);
        ok(!!full && allowed.has(full), `${s.id} bước ${st.n}: skill "${sk}" có trong requires hoặc skill của agent`);
      }
    }
    if (s.kind === 'workflow') {
      ok([1, 2, 3].includes(s.tier), `${s.id}: tier ∈ {1,2,3}`);
      ok(RISKS.includes(s.risk), `${s.id}: risk ∈ {${RISKS.join(', ')}}`);
      ok(s.order > 0, `${s.id}: order > 0`);
    } else {
      ok(s.order === 0, `${s.id}: orchestrator order = 0`);
    }
  }
  for (const o of orch) {
    const { rows, priority } = parseRegistry(o.body);
    const reg = new Set(rows.map((r) => r.id));
    const ids = new Set(wfs.map((w) => w.id));
    ok(reg.size === rows.length, `${o.id}: registry không trùng id`);
    for (const id of ids) ok(reg.has(id), `${o.id}: registry có ${id}`);
    for (const id of reg) ok(ids.has(id), `${o.id}: registry "${id}" trỏ tới workflow có thật`);
    for (const r of rows) {
      const w = wfs.find((x) => x.id === r.id);
      if (w) ok(r.risk === w.risk, `${o.id}: risk của ${r.id} khớp frontmatter (${r.risk} vs ${w.risk})`);
      for (const n of r.next) ok(ids.has(n), `${o.id}: nối tiếp "${n}" của ${r.id} tồn tại`);
    }
    ok(priority.length === ids.size && [...ids].every((id) => priority.includes(id)),
      `${o.id}: thứ tự ưu tiên liệt kê đủ ${ids.size} workflow`);
  }
}
```

- [ ] **Step 2: Chạy** `node test/validate.mjs` → `0 fail` (chưa có agent/workflow nên vòng lặp rỗng; chỉ assert manifest).
- [ ] **Step 3: Verify đường fail — agent lỗi.** Tạo tạm `plugins/backend/agents/backend-bad.md`:

```markdown
---
name: backend-bad
description: "Agent lỗi để kiểm validate"
mode: write
skills: "backend-khong-ton-tai"
---

## Vai trò
x
```

Run: `node test/validate.mjs`
Expected: FAIL có dòng `agent backend-bad: skill "backend/backend-khong-ton-tai" tồn tại` và `agent backend-bad: có heading "## Phạm vi"`.
Xoá file bằng `node -e "require('fs').rmSync('plugins/backend/agents',{recursive:true,force:true})"`.

- [ ] **Step 4: Verify đường fail — workflow lỗi.** Tạo tạm `workflows/bad/WORKFLOW.md` bằng cách copy `templates/workflows/workflow.template.md`, rồi xoá dòng `- **Gate:** …` của Bước 2.

Run: `node test/validate.mjs`
Expected: FAIL có `workflow-<slug>: name == "workflow-<thư mục>"` (template còn placeholder) và `khung body hợp lệ — bước 2: thiếu trường "Gate"`.
Xoá thư mục bằng `node -e "require('fs').rmSync('workflows/bad',{recursive:true,force:true})"`.

- [ ] **Step 5: `npm test`** → exit 0.
- [ ] **Step 6: Commit** `test(validate): add agent and workflow source contracts`.

### Task 5: Claude adapter — agent + plugin `workflows`; `build.mjs` truyền workflows

**Files:**
- Create: `adapters/_shared/agents.mjs`
- Modify: `adapters/claude/adapter.mjs`, `cli/build.mjs`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: `Agent`, `loadWorkflows()` (Task 2).
- Produces:
  - `skillPointer(fullIds: string[]) → string`
  - `claudeAgentMd(agent: Agent) → string`
  - `workflowPreamble(wf: WorkflowStage, agentsById: Map<string,Agent>, provider: 'claude'|'codex') → string`
  - Ctx adapter có thêm `workflows` (có thể `null`/`undefined` — `pack.mjs` không truyền).
  - Build Claude: `plugins/<id>/agents/<agent>.md`; khi `workflows.stages.length > 0`: `plugins/workflows/.claude-plugin/plugin.json` + `plugins/workflows/skills/<wf-id>/SKILL.md` + entry marketplace `workflows`.

- [ ] **Step 1: Viết test fail** — trong `test/validate.mjs` thêm import:

```js
import claudeAdapter from '../adapters/claude/adapter.mjs';
```

và thêm sau khối `0b`:

```js
// 0c. UNIT: adapter với fixture (thuần — không đọc plugin thật)
const fxAgent = { id: 'fx-reviewer', plugin: 'fx', description: 'Agent fixture để test adapter', mode: 'read-only',
  skills: ['fx/fx-review'], model: null, effort: 'high', color: null, body: '## Vai trò\nx\n', file: '' };
const fxPlugin = { id: 'fx', name: 'Fixture', description: 'Plugin fixture', version: '1.0.0',
  shared: { principles: '' }, stages: [], agents: [fxAgent] };
const fxWorkflows = { id: 'workflows', name: 'Workflows', description: 'Bộ workflow fixture', version: '1.0.0',
  shared: { principles: '' }, agents: [], stages: [{ id: 'workflow-demo', description: 'Workflow fixture để test',
    body: '# Demo\n', agents: ['fx-reviewer'], requires: ['core/git-workflow'],
    assets: [], fileAssets: [], dirAssets: [], assetsDir: '' }] };
const fxCore = { ...loadCore(), stages: [] };
const fxMk = { name: 'fx-mkt', owner: { name: 'fx' }, description: '' };
const byPath = (files) => new Map(files.map((f) => [f.path, f]));
{
  const out = byPath(claudeAdapter.build([fxPlugin], { marketplace: fxMk, core: fxCore, workflows: fxWorkflows }));
  const agentMd = (out.get('plugins/fx/agents/fx-reviewer.md') || {}).content || '';
  ok(agentMd.includes('name: fx-reviewer') && agentMd.includes('disallowedTools: Edit, Write, NotebookEdit, Agent'),
    'claude agent: frontmatter name + disallowedTools read-only');
  ok(agentMd.includes('effort: high') && agentMd.includes('`fx:fx-review`'), 'claude agent: effort + pointer skill dạng plugin');
  const pj = JSON.parse((out.get('plugins/workflows/.claude-plugin/plugin.json') || { content: '{}' }).content);
  ok(JSON.stringify(pj.dependencies) === '["core","fx"]', 'claude workflows: dependencies = core + plugin của agent/requires');
  const wfMd = (out.get('plugins/workflows/skills/workflow-demo/SKILL.md') || {}).content || '';
  ok(wfMd.includes('name: workflow-demo') && wfMd.includes('`fx:fx-reviewer`') && wfMd.includes('`core:git-workflow`'),
    'claude workflows: SKILL.md + preamble dispatch 2 dạng tên');
  const mk = JSON.parse(out.get('.claude-plugin/marketplace.json').content);
  ok(mk.plugins.some((x) => x.name === 'workflows'), 'claude marketplace: có entry workflows');
  const noWf = byPath(claudeAdapter.build([fxPlugin], { marketplace: fxMk, core: fxCore }));
  ok(![...noWf.keys()].some((k) => k.startsWith('plugins/workflows/')), 'claude: không truyền workflows → không sinh plugin workflows');
}
```

Trong khối `// 3. BUILD OUTPUT (Claude)` sửa assert số entry marketplace:

```js
  const wfBuilt = !!(workflows && workflows.stages.length);
  ok(mk.plugins.length === plugins.length + 1 + (wfBuilt ? 1 : 0),
    `build: marketplace có ${plugins.length}+1 (core)${wfBuilt ? '+1 (workflows)' : ''} entry`);
```

(xoá assert cũ `mk.plugins.length === plugins.length + 1`). Thêm cuối khối 3 (trước `} else {`):

```js
  for (const a of allAgents) {
    const f = path.join(claudeDir, 'plugins', a.plugin, 'agents', `${a.id}.md`);
    ok(fs.existsSync(f), `build claude agent ${a.id}: có file`);
    const c = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    ok(c.includes(`name: ${a.id}`) && c.includes('disallowedTools:') && c.includes('Agent'),
      `build claude agent ${a.id}: name + chặn tool Agent`);
  }
  if (wfBuilt) {
    const pj = JSON.parse(fs.readFileSync(path.join(claudeDir, 'plugins/workflows/.claude-plugin/plugin.json'), 'utf8'));
    ok(pj.dependencies[0] === 'core', 'build claude workflows: depends on core');
    for (const s of workflows.stages) {
      const f = path.join(claudeDir, 'plugins/workflows/skills', s.id, 'SKILL.md');
      const c = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      const fm = (c.match(/^---\n([\s\S]*?)\n---/) || ['', ''])[1];
      ok(fm.includes(`name: ${s.id}`) && !/^(kind|tier|risk):/m.test(fm), `build claude ${s.id}: frontmatter chuẩn (strip metadata)`);
      ok(c.includes('core:principles'), `build claude ${s.id}: pointer principles`);
    }
  }
```

Lưu ý: khối 3 dùng `workflows`/`allAgents` khai báo ở khối 2b/2c — giữ thứ tự khối trong file.

- [ ] **Step 2: Chạy test, xác nhận fail** — `node test/validate.mjs` → FAIL `claude agent: …` (adapter chưa sinh agent).
- [ ] **Step 2b: Chụp build trước thay đổi** (để Step 5 so diff):

Run: `node cli/build.mjs --target claude --out <scratchpad>/before-claude`

- [ ] **Step 3: Implement** `adapters/_shared/agents.mjs`:

```js
// Helper dựng agent (Claude .md / Codex .toml) và preamble dispatch cho workflow. Là thư viện,
// không phải adapter (thư mục `_shared` bị build bỏ qua khi discover).
import { frontmatter } from '../../cli/lib/write.mjs';

const CLAUDE_DENY = { 'read-only': 'Edit, Write, NotebookEdit, Agent', write: 'Agent' };

/** Tên skill ở 2 dạng vì cài phẳng và cài plugin đặt tên khác nhau (`x` vs `plugin:x`). */
export function skillPointer(fullIds) {
  return fullIds.map((sid) => {
    const [p, s] = sid.split('/');
    return `\`${s}\` (bản cài dạng plugin: \`${p}:${s}\`)`;
  }).join(', ');
}

export function claudeAgentMd(agent) {
  const head = frontmatter([
    ['name', agent.id],
    ['description', agent.description],
    ['disallowedTools', CLAUDE_DENY[agent.mode]],
    ['model', agent.model],
    ['effort', agent.effort],
    ['color', agent.color],
  ]);
  const note = `> **Dùng skill:** ${skillPointer(agent.skills)}. ` +
    'Đọc trước skill `principles` (bản cài dạng plugin: `core:principles`).';
  return `${head}\n\n${note}\n\n${agent.body.replace(/^\n+/, '')}`;
}

export function workflowPreamble(wf, agentsById, provider) {
  const L = [];
  if (provider === 'claude') {
    L.push('> **Đọc trước** nguyên tắc nền tảng — skill `principles` (bản cài dạng plugin: `core:principles`).');
    if (wf.agents.length) {
      L.push('> **Cách dispatch trên Claude:** bước ghi `agent <id>` → gọi subagent qua tool Agent: ' +
        wf.agents.map((id) => `\`${id}\` (bản cài dạng plugin: \`${(agentsById.get(id) || {}).plugin}:${id}\`)`).join(', ') + '.');
    }
    if (wf.requires.length) L.push(`> **Skill dùng trực tiếp:** ${skillPointer(wf.requires)}.`);
  } else {
    L.push('> **Đọc trước** nguyên tắc nền tảng — skill `principles`.');
    if (wf.agents.length) {
      L.push('> **Cách dispatch trên Codex:** bước ghi `agent <id>` → spawn subagent theo tên: ' +
        wf.agents.map((id) => `\`${codexAgentName(id)}\``).join(', ') + '.');
    }
    if (wf.requires.length) L.push(`> **Skill dùng trực tiếp:** ${wf.requires.map((s) => `\`${s.split('/')[1]}\``).join(', ')}.`);
  }
  L.push('> Không có subagent → chạy tuần tự skill tương ứng trong session chính.');
  return L.join('\n');
}

/** Tên agent phía Codex; Task 6 chốt có đổi `-` → `_` hay không. */
export function codexAgentName(id) { return id; }
```

Sửa `adapters/claude/adapter.mjs`:

```js
import { skillFiles, frontmatter } from '../_shared/lib.mjs';
import { claudeAgentMd, workflowPreamble } from '../_shared/agents.mjs';
```

Thêm hàm trước `export default`:

```js
// Plugin `workflows` gọi xuyên nhiều plugin; Claude chỉ resolve dependency có trong marketplace
// nên bỏ plugin vắng mặt (build lọc --plugin).
function workflowFiles(wfs, plugins, author) {
  const agentsById = new Map(plugins.flatMap((p) => p.agents || []).map((a) => [a.id, a]));
  const present = new Set(plugins.map((p) => p.id));
  const deps = new Set();
  for (const wf of wfs.stages) {
    for (const r of wf.requires) deps.add(r.split('/')[0]);
    for (const id of wf.agents) { const a = agentsById.get(id); if (a) deps.add(a.plugin); }
  }
  const dependencies = ['core', ...[...deps].filter((d) => d !== 'core' && present.has(d)).sort()];
  const files = [{ path: 'plugins/workflows/.claude-plugin/plugin.json', content: pluginJson(wfs, { dependencies, author }) }];
  for (const wf of wfs.stages) {
    files.push(...skillFiles(wf, 'plugins/workflows/skills', workflowPreamble(wf, agentsById, 'claude')));
  }
  return files;
}
```

Trong `build(plugins, { marketplace, core, workflows })`:

```js
    const wfs = workflows && workflows.stages.length ? workflows : null;
    const entries = [core, ...plugins, ...(wfs ? [wfs] : [])];
```

Trong vòng `for (const p of plugins)`, sau vòng `for (const stage of p.stages)` thêm:

```js
      for (const a of p.agents || []) {
        files.push({ path: `plugins/${p.id}/agents/${a.id}.md`, content: claudeAgentMd(a) });
      }
```

Trước `return files;` thêm `if (wfs) files.push(...workflowFiles(wfs, plugins, author));`.

Sửa `cli/build.mjs`:
- import `loadWorkflows` từ `./lib/plugins.mjs`.
- sau `const core = loadCore();` thêm `const workflows = loadWorkflows();`.
- trong nhánh `--list`, sau khối Core thêm:

```js
    if (workflows) {
      console.log('\nWorkflows (cấp repo — workflows/<slug>/WORKFLOW.md):');
      console.log(`  ${workflows.id.padEnd(14)} v${workflows.version} — ${workflows.stages.length} workflow/orchestrator`);
    }
```

- đổi `adapter.build(plugins, { outDir, marketplace, core })` thành `adapter.build(plugins, { outDir, marketplace, core, workflows })`.

- [ ] **Step 4: Chạy test, xác nhận pass** — `node test/validate.mjs --build` → `0 fail`.
- [ ] **Step 5: Diff build skill cũ = 0.**

Run: `node cli/build.mjs --target claude && diff -r <scratchpad>/before-claude/plugins build/claude/plugins`
Expected: không khác biệt (chưa có agent/workflow thật ở task này; khác biệt nào cũng là lỗi). Dọn bằng `node -e "require('fs').rmSync('<scratchpad>/before-claude',{recursive:true,force:true})"`.

- [ ] **Step 6: `claude plugin validate build/claude`** nếu CLI `claude` có sẵn; không có → ghi "bỏ qua, CLI không có" vào report task.
- [ ] **Step 7: `npm test`** → exit 0.
- [ ] **Step 8: Commit** `feat(claude): project agents and workflows plugin`.

### Task 6: Codex adapter — agent `.toml` + `workflows/skills/`

**Files:**
- Modify: `adapters/_shared/agents.mjs`, `adapters/codex/adapter.mjs`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: `workflowPreamble`, `codexAgentName` (Task 5).
- Produces: `tomlBasic(s) → string`, `tomlMultiline(s) → string`, `codexAgentToml(agent) → string`; build Codex `<id>/agents/<agent-id>.toml`, `workflows/skills/<wf-id>/SKILL.md`.

- [ ] **Step 1: Viết test fail** — import:

```js
import codexAdapter from '../adapters/codex/adapter.mjs';
import { tomlBasic, tomlMultiline } from '../adapters/_shared/agents.mjs';
```

thêm cuối khối `0c`:

```js
{
  ok(tomlBasic('a"b\\c\nd') === '"a\\"b\\\\c\\nd"', 'tomlBasic: escape " \\ và newline');
  ok(tomlMultiline('x"""y\\z') === '"""\nx""\\"y\\\\z"""', 'tomlMultiline: tách """ và escape \\');
  const out = byPath(codexAdapter.build([fxPlugin], { core: fxCore, workflows: fxWorkflows }));
  const toml = (out.get('fx/agents/fx-reviewer.toml') || {}).content || '';
  ok(toml.includes('sandbox_mode = "read-only"') && toml.includes('model_reasoning_effort = "high"'),
    'codex agent: sandbox_mode + effort');
  ok(toml.includes('developer_instructions = """') && toml.includes('`fx-review`'), 'codex agent: developer_instructions + pointer skill');
  ok(!toml.includes('model ='), 'codex agent: KHÔNG map model');
  const wfMd = (out.get('workflows/skills/workflow-demo/SKILL.md') || {}).content || '';
  ok(wfMd.includes('name: workflow-demo') && wfMd.includes('Cách dispatch trên Codex'), 'codex workflows: SKILL.md + preamble Codex');
}
```

Thêm vào khối `// 7. BUILD codex`, trong `if (fs.existsSync(codexDir))`:

```js
    for (const a of allAgents) {
      const f = path.join(codexDir, a.plugin, 'agents', `${a.id}.toml`);
      const c = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      ok(/^name = ".+"$/m.test(c) && /^description = /m.test(c) && c.includes('developer_instructions = """')
        && /^sandbox_mode = "(read-only|workspace-write)"$/m.test(c), `build codex agent ${a.id}: đủ trường`);
    }
    if (workflows) for (const s of workflows.stages) {
      ok(fs.existsSync(path.join(codexDir, 'workflows', 'skills', s.id, 'SKILL.md')), `build codex ${s.id}: có SKILL.md`);
    }
```

- [ ] **Step 2: Chạy test, xác nhận fail** — `node test/validate.mjs` → lỗi import `tomlBasic`.
- [ ] **Step 3: Implement** — thêm vào `adapters/_shared/agents.mjs`:

```js
export function tomlBasic(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}

// Multi-line basic string của TOML vẫn xử lý escape `\`, và `"""` trong nội dung sẽ đóng chuỗi sớm.
export function tomlMultiline(s) {
  return '"""\n' + String(s).replace(/\\/g, '\\\\').replace(/"""/g, '""\\"') + '"""';
}

const CODEX_SANDBOX = { 'read-only': 'read-only', write: 'workspace-write' };
// [Unverified] Codex chỉ nhận low/medium/high cho model_reasoning_effort; mức khác bỏ qua thay vì ghi sai.
const CODEX_EFFORT = new Set(['low', 'medium', 'high']);

export function codexAgentToml(agent) {
  const lines = [
    `name = ${tomlBasic(codexAgentName(agent.id))}`,
    `description = ${tomlBasic(agent.description)}`,
    `sandbox_mode = ${tomlBasic(CODEX_SANDBOX[agent.mode])}`,
  ];
  if (agent.effort && CODEX_EFFORT.has(agent.effort)) lines.push(`model_reasoning_effort = ${tomlBasic(agent.effort)}`);
  const note = `> Dùng skill: ${agent.skills.map((s) => `\`${s.split('/')[1]}\``).join(', ')}. Đọc trước skill \`principles\`.`;
  lines.push(`developer_instructions = ${tomlMultiline(`${note}\n\n${agent.body.replace(/^\n+/, '')}`)}`);
  return lines.join('\n') + '\n';
}
```

Sửa `adapters/codex/adapter.mjs`:

```js
import { codexAgentToml, workflowPreamble } from '../_shared/agents.mjs';
```

Đổi chữ ký `build(plugins, { core, workflows })`; trong vòng `for (const p of plugins)` sau vòng stage thêm:

```js
      for (const a of p.agents || []) files.push({ path: `${p.id}/agents/${a.id}.toml`, content: codexAgentToml(a) });
```

Trước `return files;` thêm:

```js
    if (workflows && workflows.stages.length) {
      const agentsById = new Map(plugins.flatMap((p) => p.agents || []).map((a) => [a.id, a]));
      for (const wf of workflows.stages) {
        files.push(...skillFiles(wf, 'workflows/skills', workflowPreamble(wf, agentsById, 'codex')));
      }
    }
```

- [ ] **Step 4: Chạy test, xác nhận pass** — `node test/validate.mjs --build` → `0 fail`.
- [ ] **Step 5: Kiểm chứng tên agent Codex.** Nếu có `codex` CLI: tạo sandbox `AIE_INSTALL_ROOT`, đặt 1 file `.codex/agents/fx-reviewer.toml` (từ fixture), chạy codex và xác nhận agent được nhận. Không có CLI → đọc lại `learn.chatgpt.com/docs/agent-configuration/subagents`.
  - Chấp nhận `-` → giữ `codexAgentName(id) { return id; }`.
  - Không chấp nhận hoặc không kiểm chứng được → đổi thành `return id.replace(/-/g, '_');`, thêm test `ok(toml.includes('name = "fx_reviewer"'), …)`, và ghi quyết định vào spec §7.3.
- [ ] **Step 6: `npm test`** → exit 0.
- [ ] **Step 7: Commit** `feat(codex): project agents as toml and workflows as skills`.

### Task 7: Nội dung 11 agent

**Files:** Create:
- `plugins/backend/agents/{backend-implementer,backend-test-writer,backend-reviewer}.md`
- `plugins/frontend/agents/{frontend-implementer,frontend-test-writer,frontend-reviewer}.md`
- `plugins/engineering/agents/{engineering-quality-auditor,engineering-spec-analyst,engineering-release-scribe}.md`
- `plugins/ops/agents/{ops-incident-investigator,ops-release-engineer}.md`

**Interfaces:** Consumes contract Task 4 (4 heading, mode, skills tồn tại).

Frontmatter chính xác (không đặt `model` → kế thừa model session):

| file | `name` | `mode` | `skills` |
|---|---|---|---|
| backend-implementer.md | backend-implementer | write | `"backend-implement,backend-api-contract"` |
| backend-test-writer.md | backend-test-writer | write | `"backend-testing"` |
| backend-reviewer.md | backend-reviewer | read-only | `"backend-code-review,backend-api-contract"` |
| frontend-implementer.md | frontend-implementer | write | `"frontend-implement"` |
| frontend-test-writer.md | frontend-test-writer | write | `"frontend-testing"` |
| frontend-reviewer.md | frontend-reviewer | read-only | `"frontend-code-review"` |
| engineering-quality-auditor.md | engineering-quality-auditor | read-only | `"engineering-quality-gate,engineering-convention-enforce"` |
| engineering-spec-analyst.md | engineering-spec-analyst | write | `"engineering-spec-writing,engineering-adr,engineering-diagram"` |
| engineering-release-scribe.md | engineering-release-scribe | write | `"engineering-release-notes"` |
| ops-incident-investigator.md | ops-incident-investigator | read-only | `"ops-incident-troubleshooting,ops-observability"` |
| ops-release-engineer.md | ops-release-engineer | read-only | `"ops-deploy-release,ops-observability"` |

Mẫu đầy đủ cho 1 agent (các agent khác theo cùng cấu trúc, thay nội dung theo vai):

```markdown
---
name: backend-reviewer
description: "Agent chỉ đọc review diff/module backend (Java/Spring, Python) theo skill backend-code-review và kiểm drift contract↔code theo backend-api-contract; trả finding có severity, evidence file:line, confidence. Dùng khi workflow cần review phần backend."
mode: read-only
skills: "backend-code-review,backend-api-contract"
---

## Vai trò

Reviewer backend: đọc diff hoặc module được giao, tìm lỗi correctness, vi phạm kiến trúc, drift contract.

## Phạm vi

- Được: đọc mã nguồn, chạy lệnh chỉ đọc (build/test/lint) để lấy evidence.
- Không được: sửa file, commit/push, gọi agent khác, tác động môi trường ngoài repo.

## Quy trình

1. Đọc skill `backend-code-review`, review theo các trục của skill.
2. Nếu phạm vi có API: đọc skill `backend-api-contract`, kiểm drift contract↔code.
3. Tự đọc lại `file:line` của từng finding trước khi trả; bỏ finding không tái lập được.

## Report trả về

- Danh sách finding theo schema spec §5.1 (`severity` blocker|major|minor|nit, `category`, `location`, `evidence`, `impact`, `recommendation`, `confidence`).
- Evidence lệnh đã chạy (`command`, `exit_code`, `status`, `summary`); không chạy được → `not_run` + `reason`.
- `remaining_risks`: phần chưa review được và lý do.
```

Yêu cầu riêng theo vai (đưa vào `## Phạm vi` và `## Quy trình`):
- `*-implementer`: chỉ sửa trong phạm vi slice được giao; bám kiến trúc trong `project-knowledge/architecture.md`; build phải xanh trước khi trả.
- `*-test-writer`: chỉ thêm/sửa file test; không sửa code production; failing test tái hiện bug phải đỏ đúng lý do.
- `engineering-quality-auditor`: chạy `engineering-convention-enforce` ở chế độ **chỉ kiểm**; mask mọi secret; không tự sửa.
- `engineering-spec-analyst`: chỉ ghi trong `docs/`; ADR theo template của skill `engineering-adr`.
- `engineering-release-scribe`: chỉ ghi `docs/` và `CHANGELOG.md`; không tag/push.
- `ops-*`: chỉ đọc; mọi hành động lên môi trường chỉ **đề xuất lệnh**, không thực thi.

- [ ] **Step 1: Viết 11 file** theo bảng + mẫu.
- [ ] **Step 2: Chạy** `node test/validate.mjs --build` → `0 fail` (contract 2b + build claude/codex agent).
- [ ] **Step 3: Đọc kỹ** `build/claude/plugins/backend/agents/backend-reviewer.md` và `build/codex/backend/agents/backend-reviewer.toml`: TOML hợp lệ (mở bằng `"""`, đóng bằng `"""`), pointer đúng.
- [ ] **Step 4: Bump version minor** `.manifest.json` của backend, frontend, engineering, ops (`1.1.1` → `1.2.0`).
- [ ] **Step 5: `npm test`** → exit 0.
- [ ] **Step 6: Commit** `feat(agents): add 11 role agents across backend, frontend, engineering and ops`.

### Task 8: Orchestrator + WF01 feature + WF02 bugfix

**Files:** Create `workflows/orchestrator/WORKFLOW.md`, `workflows/feature/WORKFLOW.md`, `workflows/bugfix/WORKFLOW.md`

**Interfaces:** Viết từ `templates/workflows/workflow.template.md`; contract Task 4.

Quy tắc viết chung cho mọi workflow (Task 8, 10, 11, 12):
- Copy template, điền frontmatter theo bảng của task; giữ `runsIn: execute`, `invoke: per-request`, `pipeline: false`, `next: null`.
- Mỗi bước điền đủ 8 trường. `Thực hiện` và `Gate` lấy đúng từ bảng bước của task; các trường còn lại viết từ spec §4.2 (chuỗi bước + ràng buộc đặc thù).
- `Evidence` luôn theo định dạng spec §5.1.
- Bảng `## Xử lý lỗi & rollback` tối thiểu 4 dòng: build fail, test fail, yêu cầu mơ hồ, finding blocker; thêm dòng đặc thù ở cột "Ràng buộc đặc thù" của spec §4.2.
- `## Definition of Done`: mỗi mục trỏ tới evidence; luôn có "Mọi gate có evidence `passed`" và (nếu có review) "0 finding `blocker`".
- `## Report cuối`: khối `workflow_result` của template, đổi `workflow:` thành id thật.
- Tier 1: mỗi bước có ít nhất 2 hành động cụ thể và bảng lỗi có dòng riêng cho từng gate có ⏸. Tier 2/3: gọn, 1 hành động/bước là đủ.

**Orchestrator** (`workflows/orchestrator/WORKFLOW.md`):

Frontmatter: `name: workflow-orchestrator`, `order: 0`, `title: "Orchestrator — chọn và chạy workflow theo yêu cầu"`, `kind: orchestrator`, **không có** `tier`/`risk`, `agents: ""`, `requires: ""`, description có trigger "không biết dùng workflow nào", "chọn workflow", "orchestrate", "làm giúp việc này theo quy trình".

Body = 7 heading của template + thêm `## Registry` (đặt giữa `## Điều kiện tiên quyết` và `## Các bước`) chứa:

```markdown
## Registry

| id | Tín hiệu | Risk | Nối tiếp | Không dùng khi |
|---|---|---|---|---|
| `workflow-feature` | "thêm tính năng", "làm feature", "user story", acceptance criteria | medium | `workflow-docs` | Chỉ sửa lỗi hành vi đã có → bugfix |
| `workflow-bugfix` | "lỗi", "bug", stacktrace, "không chạy", "sai kết quả" | medium | `workflow-docs` | Hệ thống production đang sập → incident |

**Thứ tự ưu tiên:** `workflow-bugfix` > `workflow-feature`
```

Mỗi task nội dung sau (10, 11, 12) **thêm dòng registry + chèn id vào thứ tự ưu tiên** theo thứ tự cuối cùng: incident > security-review > bugfix > db-change > api > feature > refactor > performance > testing > code-review > release > docs.

Bước orchestrator (tất cả `Thực hiện: session chính`):

| n | Tên | Gate |
|---|---|---|
| 1 | Phân loại | Chọn được 1 workflow hoặc ≤2 ứng viên, có tín hiệu khớp trong registry |
| 2 | Kiểm cài | Workflow đã cài; chưa cài → in `aip install --skill workflows/<id>` và dừng `blocked` |
| 3 | Xác nhận ⏸ | Người dùng xác nhận workflow + chuỗi nối tiếp; risk high/critical phải xác nhận rõ ràng |
| 4 | Chạy | Gọi workflow đã chọn; chain tuần tự tối đa 3, ⏸ giữa mỗi workflow |
| 5 | Tổng hợp | Có `orchestrator_result` với `status` = trạng thái xấu nhất trong chain |

Report cuối dùng khối `orchestrator_result` (spec §4.3), không dùng `workflow_result`.

**WF01** (`workflows/feature/WORKFLOW.md`): `name: workflow-feature`, `order: 1`, `tier: 1`, `risk: medium`,
`agents: "engineering-spec-analyst,backend-implementer,frontend-implementer,backend-test-writer,frontend-test-writer,backend-reviewer,frontend-reviewer,engineering-quality-auditor"`,
`requires: "core/git-workflow"`, trigger: "làm feature", "thêm tính năng", "implement user story", "làm chức năng mới end-to-end".

| n | Tên | Thực hiện | Gate |
|---|---|---|---|
| 1 | Phân tích yêu cầu & phạm vi ⏸ | agent `engineering-spec-analyst` | Acceptance criteria đo được; phạm vi ∈ {backend, frontend, fullstack} |
| 2 | Thiết kế & contract ⏸ | agent `backend-implementer` (skill `backend-api-contract`, chỉ khi có API) | Contract OpenAPI hợp lệ, hoặc ghi rõ "không có API" |
| 3 | Implement | agent `backend-implementer` ∥ agent `frontend-implementer` (chỉ phía có đụng) | Build xanh |
| 4 | Test | agent `backend-test-writer` ∥ agent `frontend-test-writer` | Mỗi acceptance criterion ≥1 test; test pass |
| 5 | Review | agent `backend-reviewer` ∥ agent `frontend-reviewer` ∥ agent `engineering-quality-auditor` | 0 blocker; major đã sửa hoặc được chấp nhận |
| 6 | Tài liệu | session chính | Docs bị ảnh hưởng đã cập nhật hoặc ghi "không ảnh hưởng" |
| 7 | Commit ⏸ | skill `git-workflow` | Người dùng duyệt diff |

Ghi chú gap G1 vào bước 3: FE chưa nối API → checkpoint "nối data thủ công".

**WF02** (`workflows/bugfix/WORKFLOW.md`): `name: workflow-bugfix`, `order: 2`, `tier: 1`, `risk: medium`,
`agents: "backend-test-writer,frontend-test-writer,backend-reviewer,frontend-reviewer,engineering-quality-auditor"`,
`requires: "core/git-workflow"`, trigger: "sửa bug", "fix lỗi", "debug", "tại sao bị lỗi", stacktrace.

| n | Tên | Thực hiện | Gate |
|---|---|---|---|
| 1 | Hiểu bối cảnh | session chính | Hành vi mong đợi vs thực tế + phía BE/FE ghi rõ |
| 2 | Tái hiện | agent `backend-test-writer` ∥ agent `frontend-test-writer` (phía có lỗi) | Failing test đỏ đúng lý do, hoặc bước tái hiện thủ công có evidence |
| 3 | Thu evidence | session chính | ≥1 evidence (log/stacktrace/metric/DB) gắn với lỗi |
| 4 | Root cause ⏸ | session chính | Giải thích nhân quả khớp evidence, người dùng đồng ý |
| 5 | Fix tối thiểu | session chính | Failing test chuyển xanh |
| 6 | Regression | agent `backend-test-writer` ∥ agent `frontend-test-writer` | Toàn bộ test pass |
| 7 | Review | agent `backend-reviewer` ∥ agent `frontend-reviewer` ∥ agent `engineering-quality-auditor` | 0 blocker |
| 8 | Commit ⏸ | skill `git-workflow` | Người dùng duyệt diff |

`## Xử lý lỗi & rollback` phải có dòng cấm: sửa khi chưa tái hiện/chưa có evidence mạnh; chỉ sửa triệu chứng; xoá/nới test cho qua.

- [ ] **Step 1: Viết 3 file** theo bảng.
- [ ] **Step 2: Chạy** `node test/validate.mjs --build` → `0 fail` (khung body, step refs, registry đồng bộ 2 workflow).
- [ ] **Step 3: Đọc** `build/claude/plugins/workflows/skills/workflow-feature/SKILL.md`: preamble liệt kê 8 agent dạng `backend:backend-implementer`.
- [ ] **Step 4: `npm test`** → exit 0.
- [ ] **Step 5: Commit** `feat(workflows): add orchestrator, feature and bugfix workflows`.

### Task 9: Installer — catalog, closure, agent, provider chưa hỗ trợ; report

**Files:**
- Modify: `cli/lib/install.mjs`, `cli/lib/report.mjs`, `cli/index.mjs`
- Test: `test/install.test.mjs`

**Interfaces:**
- Consumes: `loadWorkflows`, `expandWorkflowDeps`, `missingDeps`, `WORKFLOW_PROVIDERS`.
- Produces:
  - `skillCatalog()` có nhóm `workflows` ngay sau `core` (khi có stage).
  - `effectiveSkills(entry, { withDeps = true } = {})`.
  - `stripUnsupportedWorkflows(provider, entry) → entry` (export).
  - `install()` ném `Error` khi closure thiếu skill; mỗi result skills-mode có `pulled: {from, added}[]`.
  - `offeredCatalog()` có nhóm `workflows` gồm workflow có closure ⊆ skill được offer.

- [ ] **Step 1: Viết test fail** — trong `test/install.test.mjs` thêm `stripUnsupportedWorkflows` vào import từ `../cli/lib/install.mjs`, rồi thêm khối trước `// ── pack Cowork`:

```js
// ── workflows: catalog + closure + agent + provider chưa hỗ trợ ────────────────
{
  const cat = skillCatalog();
  ok(cat.plugins[1].id === 'workflows', 'skillCatalog: workflows đứng sau core');
  ok(cat.plugins[1].skillIds.includes('workflows/workflow-feature'), 'skillCatalog: có workflows/workflow-feature');
  const eff = effectiveSkills({ plugins: [], skills: ['workflows/workflow-feature'] });
  ok(eff.has('backend/backend-implement') && eff.has('engineering/engineering-quality-gate'),
    'effective: workflow kéo skill của agent (closure)');
  ok(!eff.has('workflows/workflows-principles'), 'effective: không sinh workflows-principles');
  ok(!effectiveSkills({ plugins: [], skills: ['workflows/workflow-feature'] }, { withDeps: false }).has('backend/backend-implement'),
    'effective withDeps=false: không kéo closure');
  const stripped = stripUnsupportedWorkflows('cursor', { provider: 'cursor', plugins: ['workflows', 'backend'], skills: ['workflows/workflow-bugfix'] });
  ok(!stripped.plugins.includes('workflows') && stripped.skills.length === 0 && stripped.plugins.includes('backend'),
    'stripUnsupportedWorkflows: cursor bỏ workflows, giữ plugin khác');

  const TMP_W = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-wf-'));
  process.env.AIE_INSTALL_ROOT = TMP_W;
  const a = parse(['install', '--provider', 'claude', '--skill', 'workflows/workflow-feature']);
  const plugins = (a.skill.length && !a.pluginExplicit) ? [] : a.plugin;
  const r = install({ providers: a.provider, plugins, skills: a.skill, scope: 'project', mode: a.mode });
  const E = (rel) => fs.existsSync(path.join(TMP_W, rel));
  ok(E('.claude/skills/workflow-feature/SKILL.md'), 'cài workflow: SKILL.md của workflow');
  ok(E('.claude/skills/backend-implement/SKILL.md') && E('.claude/skills/frontend-code-review/SKILL.md'),
    'cài workflow: skill kéo theo được đặt');
  ok(E('.claude/agents/backend-implementer.md') && E('.claude/agents/engineering-quality-auditor.md'),
    'cài workflow: agent trong frontmatter agents được đặt');
  ok(!E('.claude/agents/ops-incident-investigator.md'), 'cài workflow: agent không liên quan KHÔNG đặt');
  ok(r.results[0].pulled.some((p) => p.from === 'workflow-feature'), 'cài workflow: result có danh sách kéo theo');
  const u = parse(['uninstall', '--provider', 'claude', '--skill', 'workflows/workflow-feature']);
  uninstall({ providers: u.provider, plugins: u.pluginExplicit ? u.plugin : [], skills: u.skill, scope: 'project' });
  ok(!E('.claude/skills/workflow-feature') && !E('.claude/skills/backend-implement') && !E('.claude/agents/backend-implementer.md'),
    'gỡ workflow: gỡ luôn phần kéo theo + agent');
  fs.rmSync(TMP_W, { recursive: true, force: true });

  const TMP_X = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-wfx-'));
  process.env.AIE_INSTALL_ROOT = TMP_X;
  install({ providers: 'codex', skills: ['workflows/workflow-bugfix'], scope: 'project' });
  ok(fs.existsSync(path.join(TMP_X, '.codex/skills/workflow-bugfix/SKILL.md')), 'codex: cài workflow skill');
  ok(fs.existsSync(path.join(TMP_X, '.codex/agents/backend-test-writer.toml')), 'codex: đặt agent .toml');
  fs.rmSync(TMP_X, { recursive: true, force: true });
  process.env.AIE_INSTALL_ROOT = TMP;
}
```

(Nếu Task 6 đổi tên Codex sang `_`, tên file `.toml` vẫn theo id gốc `backend-test-writer.toml` — không đổi assert.)

- [ ] **Step 2: Chạy test, xác nhận fail** — `node test/install.test.mjs` → FAIL (import `stripUnsupportedWorkflows` undefined → TypeError, hoặc assert catalog).
- [ ] **Step 3: Implement** trong `cli/lib/install.mjs`:

Import:

```js
import { REPO_ROOT, loadPlugins, loadCore, loadMarketplace, loadPublished, loadWorkflows } from './plugins.mjs';
import { expandWorkflowDeps, missingDeps, WORKFLOW_PROVIDERS } from './workflows.mjs';
```

Thêm helper trước `skillCatalog`:

```js
function workflowsModel() {
  const wf = loadWorkflows();
  return { workflows: wf ? wf.stages : [], agents: loadPlugins().flatMap((p) => p.agents) };
}
function catalogIds() { return new Set(skillCatalog().plugins.flatMap((p) => p.skillIds)); }

/** Provider chưa có đích cho workflow: bỏ workflow khỏi lựa chọn để không kéo closure vô ích. */
export function stripUnsupportedWorkflows(provider, entry) {
  if (WORKFLOW_PROVIDERS.includes(provider)) return entry;
  const plugins = (entry.plugins || []).filter((p) => p !== 'workflows');
  const skills = (entry.skills || []).filter((s) => !s.startsWith('workflows/'));
  if (plugins.length !== (entry.plugins || []).length || skills.length !== (entry.skills || []).length) {
    console.warn(`[aip] ${provider} chưa hỗ trợ workflow — bỏ qua phần workflows.`);
  }
  return { ...entry, plugins, skills };
}
```

`skillCatalog()`:

```js
export function skillCatalog() {
  const core = loadCore();
  const wf = loadWorkflows();
  const groups = [core, ...(wf && wf.stages.length ? [wf] : []), ...loadPlugins()];
  const plugins = groups.map((p) => ({
    id: p.id,
    skillIds: [
      ...(p.id === 'core' ? ['core/principles'] : []),
      ...p.stages.map((s) => `${p.id}/${s.id}`),
    ],
  }));
  return { plugins };
}
```

`offeredCatalog()` — trong vòng lặp, trước `const sel = published[p.id];` thêm `if (p.id === 'workflows') { wfGroup = p; continue; }` (khai báo `let wfGroup = null;` trước vòng). Sau vòng, trước `return { plugins };`:

```js
  if (wfGroup) {
    const offered = new Set(plugins.flatMap((x) => x.skillIds));
    const model = workflowsModel();
    const skillIds = wfGroup.skillIds.filter((sid) =>
      [...expandWorkflowDeps(new Set([sid]), model).required].every((s) => offered.has(s)));
    if (skillIds.length) plugins.splice(1, 0, { ...wfGroup, skillIds });
  }
```

`effectiveSkills()`:

```js
export function effectiveSkills(entry, { withDeps = true } = {}) {
  let out = new Set(['core/principles']);
  const plugins = entry.plugins || [];
  const skills = entry.skills || [];
  for (const p of plugins) for (const sid of allSkillsOf(p)) out.add(sid);
  for (const sid of skills) out.add(sid);
  if (withDeps) out = expandWorkflowDeps(out, workflowsModel()).skills;
  const activePlugins = new Set(plugins);
  for (const sid of out) activePlugins.add(sid.split('/')[0]);
  for (const pid of activePlugins) {
    // workflows không có principles riêng (adapter không sinh `workflows-principles`).
    if (pid === 'core' || pid === 'workflows') continue;
    out.add(`${pid}/${pid}-principles`);
  }
  return out;
}
```

`installOne()` — sau `const pluginActive = …` thêm:

```js
  const agentSkills = new Map(loadPlugins().flatMap((p) => p.agents).map((a) => [a.id, a.skills]));
  // Agent chỉ hữu ích khi mọi skill nó gói đã có mặt, tránh agent trỏ tới skill chưa cài.
  const agentActive = (id) => { const s = agentSkills.get(id); return !!s && s.every((x) => effSet.has(x)); };
```

Nhánh `claude`, trong vòng `for (const comp …)` ngay sau `const destComp = …`:

```js
        if (comp.name === 'agents') {
          for (const f of fs.readdirSync(srcComp)) {
            if (!f.endsWith('.md') || !agentActive(path.basename(f, '.md'))) continue;
            fs.mkdirSync(destComp, { recursive: true });
            placeEntry(path.join(srcComp, f), path.join(destComp, f), ctx);
          }
          continue;
        }
```

Nhánh `codex`, trong vòng `for (const id of fs.readdirSync(pbuild))` — đặt đoạn agent **trước** `if (!fs.existsSync(sdir) …) continue;`:

```js
      const adir = path.join(pbuild, id, 'agents');
      if (fs.existsSync(adir)) {
        for (const f of fs.readdirSync(adir)) {
          if (!f.endsWith('.toml') || !agentActive(path.basename(f, '.toml'))) continue;
          placeEntry(path.join(adir, f), path.join(root, '.codex', 'agents', f), ctx);
        }
      }
```

`install()` — nhánh skills-mode, thay:

```js
    const entry = { provider, plugins: effPlugins, skills: skillsFinal, scope };
    uninstallEntries(m, root, (e) => e.provider === provider);
```

bằng:

```js
    const entry = stripUnsupportedWorkflows(provider, { provider, plugins: effPlugins, skills: skillsFinal, scope });
    const deps = expandWorkflowDeps(effectiveSkills(entry, { withDeps: false }), workflowsModel());
    const miss = missingDeps(deps.required, catalogIds());
    // Ném TRƯỚC khi gỡ bản cũ để lỗi không để lại bản cài dở.
    if (miss.length) throw new Error(`Workflow cần skill không có trong bản cài nguồn: ${miss.join(', ')}`);
    uninstallEntries(m, root, (e) => e.provider === provider);
```

và thêm `pulled: deps.pulled` vào object `results.push({ provider, plugins: effPlugins, … })`.

`check()` — đổi `skills: [...effectiveSkills(e)]` thành `skills: [...effectiveSkills(e, { withDeps: false })]` (wizard preselect không biến skill kéo theo thành lựa chọn tường minh).

`cli/index.mjs` `reportInstall` — trong vòng `for (const x of r.results)`, sau dòng `console.log(\`  - ${x.provider}: …\`)` thêm:

```js
    for (const p of (x.pulled || [])) console.log(`    · ${p.from} kéo theo: ${p.added.join(', ')}`);
```

`cli/lib/report.mjs` `wizardReportModel` — nhận thêm `workflows = loadWorkflows()` (import từ `./plugins.mjs`), sau dòng `const offered = [...]` thêm:

```js
  if (workflows && workflows.stages.length) {
    offered.push({ id: 'workflows', name: workflows.name, published: true, skills: workflows.stages.map((s) => `workflows/${s.id}`) });
  }
```

- [ ] **Step 4: Chạy test, xác nhận pass** — `node test/install.test.mjs` → `0 fail`.
- [ ] **Step 5: `npm test`** → exit 0 (wizard test dùng `offeredCatalog` inject — không đổi).
- [ ] **Step 6: Smoke CLI** trong sandbox (PowerShell: `$env:AIE_INSTALL_ROOT = "<scratchpad>/wf"`), chạy `node cli/index.mjs install --provider claude --skill workflows/workflow-feature` → output có dòng `· workflow-feature kéo theo: …`; rồi `node cli/index.mjs uninstall --provider claude --skill workflows/workflow-feature`; dọn bằng `fs.rmSync`.
- [ ] **Step 7: Commit** `feat(install): install workflows with dependency closure and agents`.

### Task 10: WF03 refactor, WF04 code-review, WF06 security-review, WF10 incident (Tier 1)

**Files:** Create `workflows/{refactor,code-review,security-review,incident}/WORKFLOW.md`; Modify `workflows/orchestrator/WORKFLOW.md` (registry + ưu tiên).

Áp "Quy tắc viết chung" ở Task 8.

**Ràng buộc forward-reference (phát hiện ở Task 8, áp dụng từ đây):** `workflow-docs` (WF12) CHƯA tồn tại tới Task 12. `validate.mjs` ép mọi id trong cột "Nối tiếp" của registry phải là workflow ĐÃ CÓ THẬT trên đĩa. Vì vậy ở task này, mọi chỗ hướng dẫn "nối tiếp `workflow-docs`" (WF03, WF06) → ghi `—` (chưa nối) thay vì `workflow-docs`. Task 12 sẽ có bước riêng khôi phục lại các nối tiếp này. WF10 vẫn nối tiếp `workflow-bugfix` bình thường (WF02 đã có từ Task 8).

**WF03** `name: workflow-refactor`, `order: 3`, `tier: 1`, `risk: medium`,
`agents: "backend-test-writer,frontend-test-writer,backend-reviewer,frontend-reviewer,engineering-spec-analyst,engineering-quality-auditor"`,
`requires: "backend/backend-refactor,frontend/frontend-refactor,backend/backend-migrate-architecture,frontend/frontend-migrate-architecture,core/git-workflow"`,
trigger: "refactor", "tái cấu trúc", "dọn code", "đổi kiến trúc", "chuyển sang Hexagonal/FSD".

| n | Tên | Thực hiện | Gate |
|---|---|---|---|
| 1 | Chọn chế độ & phạm vi | session chính | Chế độ `code` \| `architecture` + invariant hành vi ghi rõ |
| 2 | ADR ⏸ | agent `engineering-spec-analyst` (chỉ chế độ architecture; chế độ code ghi "N/A") | ADR được người dùng chấp nhận |
| 3 | Baseline | session chính | Build/test/lint xanh trước khi đổi |
| 4 | Characterization test | agent `backend-test-writer` ∥ agent `frontend-test-writer` | Vùng đụng có test khoá hành vi, xanh |
| 5 | Refactor từng bước | skill `backend-refactor` \| skill `frontend-refactor` \| skill `backend-migrate-architecture` \| skill `frontend-migrate-architecture` | Xanh sau mỗi bước nhỏ |
| 6 | So hành vi | session chính | Toàn bộ test xanh; không đổi API công khai ngoài phạm vi |
| 7 | Review | agent `backend-reviewer` ∥ agent `frontend-reviewer` ∥ agent `engineering-quality-auditor` | 0 blocker; chế độ architecture: không vi phạm boundary |
| 8 | Commit theo lô ⏸ | skill `git-workflow` | Người dùng duyệt diff từng lô |

Registry: tín hiệu "refactor", "tái cấu trúc", "đổi kiến trúc"; nối tiếp `workflow-docs`; không dùng khi: đổi hành vi → feature.

**WF04** `name: workflow-code-review`, `order: 4`, `tier: 1`, `risk: low`,
`agents: "backend-reviewer,frontend-reviewer,engineering-quality-auditor"`, `requires: ""`,
trigger: "review PR", "review code", "đọc soát diff", "nhận xét PR".

| n | Tên | Thực hiện | Gate |
|---|---|---|---|
| 1 | Hiểu intent | session chính | Mục tiêu thay đổi + danh sách file đổi |
| 2 | Phân vùng diff | session chính | Mỗi file gán BE, FE hoặc khác |
| 3 | Review song song | agent `backend-reviewer` ∥ agent `frontend-reviewer` ∥ agent `engineering-quality-auditor` (chỉ vùng có đụng) | Mỗi agent trả finding theo schema |
| 4 | Validate findings | session chính | Mỗi finding giữ lại đã đọc lại `file:line`; ghi số finding bị loại |
| 5 | Tổng hợp & verdict ⏸ | session chính | Report theo severity, dedupe theo `file:line`, verdict approve \| request-changes |

Ràng buộc: chỉ đọc, không commit. Registry: tín hiệu "PR #", "review", "diff"; nối tiếp —; không dùng khi: cần sửa code → feature/bugfix.

**WF06** `name: workflow-security-review`, `order: 6`, `tier: 1`, `risk: high`,
`agents: "engineering-quality-auditor"`, `requires: "core/git-workflow"`,
trigger: "security review", "review bảo mật", "quét lỗ hổng", "OWASP", "kiểm secret".

| n | Tên | Thực hiện | Gate |
|---|---|---|---|
| 1 | Phạm vi & threat | session chính | Danh sách vùng rủi ro áp dụng (auth/session, input, crypto/secrets, dependency, logging) |
| 2 | Review & scan | agent `engineering-quality-auditor` | Report finding theo schema; secret đã mask |
| 3 | Validate findings | session chính | Từng finding đọc lại `file:line` |
| 4 | Kế hoạch remediation ⏸ | session chính | Người dùng chọn finding cần sửa |
| 5 | Sửa | session chính | Build/test xanh |
| 6 | Re-scan | agent `engineering-quality-auditor` | Finding đã sửa không còn; 0 blocker hoặc blocker được chấp nhận rõ ràng |
| 7 | Commit ⏸ | skill `git-workflow` | Người dùng duyệt diff |

Registry: tín hiệu "bảo mật", "OWASP", "CVE", "secret"; nối tiếp `workflow-docs`; không dùng khi: chỉ cần quality gate trước release → release.

**WF10** `name: workflow-incident`, `order: 10`, `tier: 1`, `risk: critical`,
`agents: "ops-incident-investigator,engineering-spec-analyst"`, `requires: "core/git-workflow"`,
trigger: "sự cố production", "prod down", "incident", "hệ thống chậm bất thường", "alert".

| n | Tên | Thực hiện | Gate |
|---|---|---|---|
| 1 | Triage & blast radius | agent `ops-incident-investigator` | Mức độ, phạm vi ảnh hưởng, thời điểm bắt đầu |
| 2 | Thu evidence | agent `ops-incident-investigator` | Evidence log/metric/trace/deploy liên quan |
| 3 | Giả thuyết & kiểm chứng | agent `ops-incident-investigator` | ≥1 giả thuyết được kiểm chứng bằng evidence |
| 4 | Đề xuất mitigation ⏸ | session chính | Người dùng chọn/thực hiện mitigation; không agent nào tác động production |
| 5 | Xác minh phục hồi | agent `ops-incident-investigator` | Metric/health về ngưỡng bình thường |
| 6 | RCA & postmortem | agent `engineering-spec-analyst` | Khối `incident` đủ: summary, timeline, impact, root_cause, mitigation, prevention |
| 7 | Commit tài liệu ⏸ | skill `git-workflow` | Người dùng duyệt diff; `next_actions` gợi ý `workflow-bugfix` |

Registry: tín hiệu "prod down", "sự cố", "alert", "incident"; nối tiếp `workflow-bugfix`, `workflow-docs`; không dùng khi: lỗi tái hiện được ở local, production vẫn ổn → bugfix.

Thứ tự ưu tiên sau task này: `workflow-incident` > `workflow-security-review` > `workflow-bugfix` > `workflow-feature` > `workflow-refactor` > `workflow-code-review`.

- [ ] **Step 1: Viết 4 file + cập nhật registry/ưu tiên.**
- [ ] **Step 2:** `node test/validate.mjs --build` → `0 fail`.
- [ ] **Step 3:** `npm test` → exit 0.
- [ ] **Step 4: Commit** `feat(workflows): add refactor, code-review, security-review and incident workflows`.

### Task 11: WF05 testing, WF07 db-change, WF08 api, WF11 release (Tier 2)

**Files:** Create `workflows/{testing,db-change,api,release}/WORKFLOW.md`; Modify orchestrator.

**Ràng buộc forward-reference (như Task 10):** `workflow-docs` chưa tồn tại tới Task 12. Ghi `—` thay vì `workflow-docs` ở cột "Nối tiếp" cho WF07 và WF08 (dòng "Registry thêm 4 dòng" bên dưới nêu `db-change workflow-docs` / `api workflow-docs` — bỏ qua phần đó, dùng `—`). Task 12 khôi phục lại.

**WF05** `name: workflow-testing`, `order: 5`, `tier: 2`, `risk: low`, `agents: "backend-test-writer,frontend-test-writer"`, `requires: "core/git-workflow"`, trigger: "viết test", "tăng coverage", "test strategy", "kiểm thử".

| n | Tên | Thực hiện | Gate |
|---|---|---|---|
| 1 | Phân tích | session chính | Danh sách hành vi cần test |
| 2 | Chiến lược ⏸ | session chính | Loại test theo policy (feature: unit; API: integration + contract; luồng quan trọng: e2e) |
| 3 | Viết test | agent `backend-test-writer` ∥ agent `frontend-test-writer` | Test chạy được |
| 4 | Chạy & phân tích failure | agent `backend-test-writer` ∥ agent `frontend-test-writer` | Mọi failure phân loại lỗi test \| lỗi code; lỗi code → đề xuất `workflow-bugfix` |
| 5 | Coverage | session chính | Coverage report, hoặc `not_run` có lý do |
| 6 | Commit ⏸ | skill `git-workflow` | Người dùng duyệt diff |

**WF07** `name: workflow-db-change`, `order: 7`, `tier: 2`, `risk: high`, `agents: "backend-implementer,backend-reviewer"`, `requires: "core/git-workflow"`, trigger: "đổi schema", "migration", "thêm cột/bảng", "đổi index".

| n | Tên | Thực hiện | Gate |
|---|---|---|---|
| 1 | Data model & impact | session chính | Bảng/cột/index bị ảnh hưởng + nơi dùng trong code |
| 2 | Thiết kế migration ⏸ | session chính | Forward + rollback + tương thích ngược (expand/contract) |
| 3 | Implement | session chính (file migration) ∥ agent `backend-implementer` (code) | Build xanh |
| 4 | Review query/index | agent `backend-reviewer` | 0 blocker |
| 5 | Chạy thử trên DB test | session chính | Migrate up → rollback → migrate up thành công, có evidence lệnh |
| 6 | Commit ⏸ | skill `git-workflow` | Người dùng duyệt diff |

Bảng lỗi thêm: cấm thay đổi phá huỷ dữ liệu khi chưa xác nhận; không chạy trên production.

**WF08** `name: workflow-api`, `order: 8`, `tier: 2`, `risk: medium`, `agents: "backend-implementer,backend-test-writer,backend-reviewer,frontend-implementer"`, `requires: "backend/backend-api-contract,core/git-workflow"`, trigger: "làm API", "thêm endpoint", "OpenAPI", "contract-first".

| n | Tên | Thực hiện | Gate |
|---|---|---|---|
| 1 | Contract ⏸ | agent `backend-implementer` (skill `backend-api-contract`) | OpenAPI 3.1 hợp lệ; breaking change có versioning/deprecation |
| 2 | Implement BE | agent `backend-implementer` | Build xanh |
| 3 | Test | agent `backend-test-writer` | Integration + contract test pass |
| 4 | Kiểm drift | agent `backend-reviewer` | 0 drift contract↔code |
| 5 | FE client (tuỳ chọn) | agent `frontend-implementer` | Type/client khớp contract, hoặc ghi "bỏ qua" |
| 6 | Docs & commit ⏸ | skill `git-workflow` | Docs API cập nhật; người dùng duyệt diff |

**WF11** `name: workflow-release`, `order: 11`, `tier: 2`, `risk: high`, `agents: "engineering-quality-auditor,engineering-release-scribe,ops-release-engineer"`, `requires: "core/git-workflow"`, trigger: "release", "phát hành", "chuẩn bị deploy", "ra version".

| n | Tên | Thực hiện | Gate |
|---|---|---|---|
| 1 | Quality gate ⏸ | agent `engineering-quality-auditor` | 0 blocker |
| 2 | Release notes ⏸ | agent `engineering-release-scribe` | Notes/CHANGELOG từ git log đúng phạm vi |
| 3 | Deploy checklist | agent `ops-release-engineer` | Checklist + điều kiện rollback |
| 4 | Hậu kiểm | agent `ops-release-engineer` | Health/observability bình thường sau deploy, hoặc `not_run` nếu chưa deploy |
| 5 | Tag ⏸ | skill `git-workflow` | Chỉ đề xuất lệnh tag/push, chờ xác nhận |

Registry thêm 4 dòng (nối tiếp: testing —; db-change `workflow-docs`; api `workflow-docs`; release —). Thứ tự ưu tiên sau task: incident > security-review > bugfix > db-change > api > feature > refactor > testing > code-review > release.

- [ ] **Step 1: Viết 4 file + cập nhật orchestrator.**
- [ ] **Step 2:** `node test/validate.mjs --build` → `0 fail`.
- [ ] **Step 3:** `npm test` → exit 0.
- [ ] **Step 4: Commit** `feat(workflows): add testing, db-change, api and release workflows`.

### Task 12: WF09 performance, WF12 docs (Tier 3)

**Files:** Create `workflows/{performance,docs}/WORKFLOW.md`; Modify orchestrator.

**WF09** `name: workflow-performance`, `order: 9`, `tier: 3`, `risk: medium`, `agents: "backend-reviewer"`, `requires: "core/git-workflow"`, trigger: "chậm", "tối ưu hiệu năng", "performance", "latency".

| n | Tên | Thực hiện | Gate |
|---|---|---|---|
| 1 | Metric & mục tiêu | session chính | Metric + ngưỡng + điều kiện đo |
| 2 | Baseline | session chính | Số đo baseline có lệnh + môi trường |
| 3 | Profile & giả thuyết ⏸ | session chính | Bottleneck có evidence |
| 4 | Tối ưu | session chính | Build/test xanh |
| 5 | Benchmark & so sánh | session chính | Số đo sau cùng điều kiện; đạt ngưỡng hoặc báo không đạt |
| 6 | Review | agent `backend-reviewer` | 0 blocker |
| 7 | Commit ⏸ | skill `git-workflow` | Người dùng duyệt diff |

DoD bắt buộc: không có số trước/sau → `blocked`.

**WF12** `name: workflow-docs`, `order: 12`, `tier: 3`, `risk: low`, `agents: "engineering-spec-analyst"`, `requires: "core/git-workflow"`, trigger: "cập nhật tài liệu", "sync docs", "README lỗi thời", "viết runbook".

| n | Tên | Thực hiện | Gate |
|---|---|---|---|
| 1 | Xác định diff | session chính | Danh sách thay đổi hành vi công khai |
| 2 | Tài liệu bị ảnh hưởng | session chính | Danh sách file docs cần sửa |
| 3 | Cập nhật | agent `engineering-spec-analyst` (ADR/diagram) ∥ session chính (README, runbook) | Mỗi file đã sửa hoặc ghi lý do không sửa |
| 4 | Kiểm | session chính | Link nội bộ tồn tại; ví dụ lệnh khớp code |
| 5 | Commit ⏸ | skill `git-workflow` | Người dùng duyệt diff |

Ràng buộc: không sửa vùng managed block của `AGENTS.md`/`CLAUDE.md`.

Registry thêm 2 dòng (nối tiếp —). Thứ tự ưu tiên cuối: `workflow-incident` > `workflow-security-review` > `workflow-bugfix` > `workflow-db-change` > `workflow-api` > `workflow-feature` > `workflow-refactor` > `workflow-performance` > `workflow-testing` > `workflow-code-review` > `workflow-release` > `workflow-docs`.

**Khôi phục forward-reference (bắt buộc, vì Task 8/10/11 đã tạm ghi `—` do `workflow-docs` chưa tồn tại lúc đó):** `workflow-docs` (WF12) giờ đã có. Sửa lại cột "Nối tiếp" trong registry của orchestrator (`workflows/orchestrator/WORKFLOW.md`) cho đúng 7 dòng sau, thêm `workflow-docs` vào:
- `workflow-feature` (WF01)
- `workflow-bugfix` (WF02)
- `workflow-refactor` (WF03)
- `workflow-security-review` (WF06)
- `workflow-db-change` (WF07)
- `workflow-api` (WF08)
- `workflow-incident` (WF10) — đã có `workflow-bugfix`, thêm `workflow-docs` vào cùng ô (`workflow-bugfix`, `workflow-docs`)

Các workflow khác (WF04, WF05, WF09, WF11, WF12) giữ nguyên `—` như đã định.

- [ ] **Step 1: Viết 2 file + cập nhật orchestrator** (thêm 2 dòng registry mới + khôi phục 7 nối tiếp `workflow-docs` đã tạm bỏ ở Task 8/10/11, xem "Khôi phục forward-reference" ở trên).
- [ ] **Step 2:** `node test/validate.mjs --build` → `0 fail`; xác nhận `loadWorkflows().stages.length === 13`:

Run: `node -e "import('./cli/lib/plugins.mjs').then(m=>console.log(m.loadWorkflows().stages.length))"`
Expected: `13`

- [ ] **Step 3:** `npm test` → exit 0.
- [ ] **Step 4: Commit** `feat(workflows): add performance and docs workflows`.

### Task 13: Publish engineering + ops, ship `workflows/`

**Files:**
- Modify: `plugins/_published.json`, `package.json` (`files`), `pack.config.json` (`allowTop`)
- Test: `test/install.test.mjs`, `test/pack-guard.test.mjs`

- [ ] **Step 1: Sửa test theo policy mới (fail trước).**

`test/install.test.mjs` khối `publishedPluginIds + offeredCatalog`, thay 2 assert "KHÔNG gồm engineering/ops" bằng:

```js
  ok(pub.includes('engineering') && pub.includes('ops'), 'publishedPluginIds: gồm engineering, ops');
  ok(!pub.includes('data'), 'publishedPluginIds: KHÔNG gồm data (draft)');
  const offered = offeredCatalog().plugins.map((p) => p.id);
  ok(offered[0] === 'core' && offered[1] === 'workflows', 'offeredCatalog: core rồi workflows');
  ok(offered.includes('engineering') && offered.includes('ops') && !offered.includes('data'),
    'offeredCatalog: offer engineering/ops, ẩn data');
  ok(offeredCatalog().plugins[1].skillIds.length === 13, 'offeredCatalog: đủ 12 workflow + orchestrator');
  ok(offeredCatalog({ backend: '*', frontend: '*' }).plugins.find((p) => p.id === 'workflows')
    .skillIds.every((s) => !s.endsWith('/workflow-feature')), 'offeredCatalog: ẩn workflow có closure chưa được offer');
```

(xoá khai báo `const offered` cũ trùng tên trong khối và các assert `!offered.includes('engineering') …`, `!offered.includes('ops')`).

Cùng file, khối `wizardReportModel`: thay assert `report: engineering nằm ở draft, KHÔNG ở offered` bằng:

```js
  ok(offeredIds.includes('engineering') && offeredIds.includes('ops') && !m.draft.some((e) => e.id === 'engineering'),
    'report: engineering + ops đã publish → nằm ở offered');
  ok(offeredIds.includes('workflows'), 'report: offered có nhóm workflows');
```

`test/pack-guard.test.mjs` test "loadPolicy suy denylist…": bỏ dòng `"plugins/engineering/.manifest.json",` và assert engineering; thêm:

```js
  assert.ok(policy.published.includes("engineering") && policy.published.includes("ops"),
    "engineering + ops đã publish");
```

Run: `npm test` → Expected: FAIL ở các assert mới.

- [ ] **Step 2: Implement publish.**

`plugins/_published.json` `published`: `["backend", "frontend", "engineering", "ops"]`.

`package.json` `files` thêm `"workflows/"`, `"plugins/engineering/"`, `"plugins/ops/"` (giữ thứ tự hiện có, chèn sau `"plugins/frontend/"`; `"workflows/"` chèn sau `"templates/"`).

`pack.config.json` `allowTop`: `["adapters", "cli", "core", "plugins", "templates", "workflows"]`.

- [ ] **Step 3:** `npm test` → exit 0.
- [ ] **Step 4:** `npm run pack:verify` → pass; danh sách file mới chỉ gồm `workflows/**`, `plugins/engineering/**`, `plugins/ops/**`, `templates/workflows/**`, file agent. Ghi số file vào report task.
- [ ] **Step 5: Commit** `chore(release): publish engineering and ops, ship workflows`.

### Task 14: Tài liệu

**Files:** `README.md`, `README_VI.md`, `CLAUDE.md`, `CHANGELOG.md`, `plugins/engineering/shared/principles.md`

- [ ] **Step 1: README cặp EN/VI** — thêm mục "Agents & Workflows":
  - bảng 11 agent (id, plugin, mode) và bảng 12 workflow (mã, id, tier, risk) lấy từ spec §3, §4.1;
  - cách gọi: Claude `/workflow-orchestrator <yêu cầu>`, hoặc gọi thẳng `/workflow-<slug>`; subagent qua `/agents`; Codex gọi skill `workflow-<slug>`;
  - lệnh cài (5 lệnh ở spec §7.4);
  - mục "Roadmap": G1–G11, workflow tương lai, P1–P7 (spec §9).
- [ ] **Step 2: `CLAUDE.md`** — mục Architecture: thêm `workflows/` vào "Canonical source" và `loadWorkflows()`/`loadAgents()` vào mô tả loader; mục "Adding capability content" thêm:
  - "New agent → `plugins/<id>/agents/<id>-<slug>.md` (frontmatter `name`, `description`, `mode`, `skills`; body 4 heading)."
  - "New workflow → copy `templates/workflows/workflow.template.md` thành `workflows/<slug>/WORKFLOW.md`, thêm dòng vào registry của `workflows/orchestrator/WORKFLOW.md`."
  - Cập nhật câu published/draft: `backend`, `frontend`, `engineering`, `ops` published; `data` draft.
- [ ] **Step 3: `plugins/engineering/shared/principles.md`** — thêm mục ngắn "Agent & workflow": agent không commit, không gọi agent khác; checkpoint người duyệt; không báo hoàn thành khi thiếu evidence (spec §5).
- [ ] **Step 4: `CHANGELOG.md`** — thêm `## [Unreleased]` với `### Added` (11 agent, 12 workflow + orchestrator, template, closure khi cài) và `### Changed` (publish engineering + ops).
- [ ] **Step 5:** `npm test` → exit 0 (validate drift `AGENTS.md` không đổi vì không sửa `AGENTS.md`).
- [ ] **Step 6: Commit** `docs: document agents, workflows and orchestrator`.

### Task 15: Verify tổng + bàn giao

- [ ] **Step 1:** `npm test` (ghi số pass từng bộ), `npm run build`, `npm run pack:verify`.
- [ ] **Step 2: Smoke** trong sandbox `AIE_INSTALL_ROOT` (dọn bằng `fs.rmSync`):
  - claude: `install --provider claude --plugin workflows` → đếm `.claude/skills/workflow-*` = 13, `.claude/agents/*.md` = 11; `uninstall --plugin workflows` → 0 workflow, 0 agent.
  - codex: `install --provider codex --plugin workflows` → `.codex/skills/workflow-*` = 13, `.codex/agents/*.toml` = 11; gỡ → 0.
  - cursor: `install --provider cursor --plugin workflows` → có cảnh báo "chưa hỗ trợ workflow", không có file workflow.
- [ ] **Step 3: Client thật** — nếu có `claude` CLI: mở session trong sandbox, `/agents` thấy 11 agent, `/workflow-orchestrator` hiện được. Không có → ghi rõ **chưa kiểm chứng trên client thật**.
- [ ] **Step 4: Báo cáo** cho người dùng: danh sách commit, kết quả test, residual risk (spec §10), quyết định tên agent Codex (Task 6).
- [ ] **Step 5:** Không push. Chờ người dùng xác nhận push/PR.
