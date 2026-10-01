#!/usr/bin/env node
// Validate plugin SOURCE structure (chuẩn Claude-style: skills/<id>/SKILL.md + .manifest.json)
// và (tùy chọn) build OUTPUT cho Claude. Zero-dependency — chỉ Node built-in.
//
//   node test/validate.mjs            # validate source (+ build output nếu build/ tồn tại)
//   node test/validate.mjs --build    # build trước rồi validate cả output
//
// Exit code 0 = pass, 1 = có lỗi.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadPlugins, loadCore, loadMarketplace, loadWorkflows, splitList, REPO_ROOT, PLUGINS_DIR, CORE_DIR } from '../cli/lib/plugins.mjs';
import { checkWorkflowBody, parseSteps, stepRefs, parseRegistry, expandWorkflowDeps, missingDeps, RISKS } from '../cli/lib/workflows.mjs';
import { offeredCatalog } from '../cli/lib/install.mjs';
import claudeAdapter from '../adapters/claude/adapter.mjs';
import codexAdapter from '../adapters/codex/adapter.mjs';
import { tomlBasic, tomlMultiline } from '../adapters/_shared/agents.mjs';

let pass = 0;
const fails = [];
const ok = (cond, msg) => { if (cond) pass++; else fails.push(msg); };

const RUN_IN = ['plan', 'execute'];
const INVOKE_IN = ['once', 'per-request'];

/** Đường dẫn tương đối (POSIX) của mọi file dưới `dir`, đệ quy. [] nếu dir không tồn tại. */
function listFilesRec(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFilesRec(p, baseDir));
    else out.push(path.relative(baseDir, p).split(path.sep).join('/'));
  }
  return out;
}
const hasFiles = (dir) => listFilesRec(dir).length > 0;

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
  const wrapped = stepRefs(frame(
    '### Bước 1 — A ⏸\n- **Thực hiện:** agent `backend-reviewer` rồi\n  agent `frontend-reviewer` và\n  skill `backend-refactor`\n' +
    '- **Đầu vào:** agent `z-khac` | skill `z-skill`\n'));
  ok(JSON.stringify(wrapped[0].agents) === '["backend-reviewer","frontend-reviewer"]',
    'stepRefs: bắt agent ở dòng nối của Thực hiện, bỏ agent ở trường kế tiếp');
  ok(JSON.stringify(wrapped[0].skills) === '["backend-refactor"]', 'stepRefs: bắt skill ở dòng nối, bỏ skill ở trường kế tiếp');

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
{
  ok(tomlBasic('a"b\\c\nd') === '"a\\"b\\\\c\\nd"', 'tomlBasic: escape " \\ và newline');
  {
    const out = tomlMultiline('x"""y\\z');
    ok(out.startsWith('"""\n'), 'tomlMultiline: mở bằng """ + newline');
    ok(out.endsWith('"""'), 'tomlMultiline: đóng bằng """');
    const body = out.slice(4, -3);
    ok(!/(^|[^\\])"""/.test(body), 'tomlMultiline: không còn chuỗi """ chưa escape ở giữa nội dung');
  }
  {
    // Regression: content kết thúc bằng dấu " sát ngay dấu đóng """ (thuật toán cũ tạo 4 dấu " liên tiếp → lỗi cú pháp TOML).
    const out = tomlMultiline('Hello"');
    ok(out.startsWith('"""\n') && out.endsWith('"""'), 'tomlMultiline: content kết thúc bằng " vẫn mở/đóng đúng');
    ok(out.slice(4, -3).endsWith('\\"'), 'tomlMultiline: dấu " cuối content được escape (không tạo 4 dấu " liên tiếp trước """ đóng)');
  }
  const out = byPath(codexAdapter.build([fxPlugin], { core: fxCore, workflows: fxWorkflows }));
  const toml = (out.get('fx/agents/fx-reviewer.toml') || {}).content || '';
  ok(toml.includes('sandbox_mode = "read-only"') && toml.includes('model_reasoning_effort = "high"'),
    'codex agent: sandbox_mode + effort');
  ok(toml.includes('developer_instructions = """') && toml.includes('`fx-review`'), 'codex agent: developer_instructions + pointer skill');
  ok(!toml.includes('model ='), 'codex agent: KHÔNG map model');
  ok(toml.includes('name = "fx_reviewer"'), 'codex agent: name đổi `-` → `_` (convention tài liệu subagents)');
  const wfMd = (out.get('workflows/skills/workflow-demo/SKILL.md') || {}).content || '';
  ok(wfMd.includes('name: workflow-demo') && wfMd.includes('Cách dispatch trên Codex'), 'codex workflows: SKILL.md + preamble Codex');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CORE
// ─────────────────────────────────────────────────────────────────────────────
const corePrinciplesDir = path.join(CORE_DIR, 'principles');
ok(fs.existsSync(corePrinciplesDir), 'core/principles/ (folder) tồn tại');
ok(fs.existsSync(corePrinciplesDir) && fs.readdirSync(corePrinciplesDir).some((f) => f.endsWith('.md')),
  'core/principles/ có file .md');

const core = loadCore();
ok(!!core.principles && core.principles.length > 100, 'loadCore() gộp principles có nội dung');

// core/skills/ — skill DÙNG CHUNG (vd git-workflow): recipe on-demand, ship kèm core ở mọi adapter
ok(Array.isArray(core.stages) && core.stages.some((s) => s.id === 'git-workflow'),
  'loadCore() nạp skill dùng chung git-workflow từ core/skills/');
for (const s of core.stages) {
  ok(fs.existsSync(path.join(CORE_DIR, 'skills', s.id, 'SKILL.md')), `core ${s.id}: có SKILL.md`);
  ok(!!s.description && s.description.length > 10, `core ${s.id}: có description`);
  ok(!!s.body && s.body.trim().length > 50, `core ${s.id}: có body hướng dẫn`);
  ok(s.pipeline === false && s.next === null,
    `core ${s.id}: recipe on-demand (pipeline=false, next=null) — core không có pipeline`);
  ok(RUN_IN.includes(s.runsIn), `core ${s.id}: runsIn ∈ {plan,execute} (=${s.runsIn})`);
  ok(INVOKE_IN.includes(s.invoke), `core ${s.id}: invoke ∈ {once,per-request} (=${s.invoke})`);
  ok(!!s.stageNumber, `core ${s.id}: có stageNumber (metadata workflow; strip ở adapter)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SOURCE structure mỗi plugin
// ─────────────────────────────────────────────────────────────────────────────
const plugins = loadPlugins();
ok(plugins.length > 0, 'Có ít nhất 1 plugin');

for (const p of plugins) {
  const dir = path.join(PLUGINS_DIR, p.id);

  // .manifest.json (KHÔNG dùng manifest.json cũ)
  ok(fs.existsSync(path.join(dir, '.manifest.json')), `${p.id}: có .manifest.json`);
  ok(!fs.existsSync(path.join(dir, 'manifest.json')), `${p.id}: KHÔNG còn manifest.json cũ`);
  ok(!fs.existsSync(path.join(dir, 'stages')), `${p.id}: KHÔNG còn thư mục stages/ cũ`);
  for (const f of ['id', 'name', 'description', 'version']) {
    ok(!!p.manifest[f], `${p.id}: .manifest.json có "${f}"`);
  }

  // skills/ dir
  ok(fs.existsSync(path.join(dir, 'skills')), `${p.id}: có thư mục skills/`);
  ok(p.stages.length > 0, `${p.id}: có ít nhất 1 skill`);

  // principles riêng KHÔNG lặp core
  ok(!p.shared.principles.includes('## 4 nguyên tắc cốt lõi'),
    `${p.id}: shared/principles.md KHÔNG lặp header core`);

  // mỗi skill: SKILL.md + frontmatter hợp lệ
  const orders = [];
  const ids = new Set(p.stages.map((s) => s.id));
  for (const s of p.stages) {
    const skillFile = path.join(dir, 'skills', s.id, 'SKILL.md');
    ok(fs.existsSync(skillFile), `${s.id}: có SKILL.md`);
    ok(s.id.startsWith(p.id + '-'), `${s.id}: tên skill bắt đầu bằng "${p.id}-"`);
    ok(!!s.description && s.description.length > 10, `${s.id}: có description`);
    ok(!!s.body && s.body.trim().length > 50, `${s.id}: có body hướng dẫn`);
    if (s.id.endsWith('-init')) {
      ok(s.body.includes('AGENTS.template.md') && s.body.includes('AGENTS.md'),
        `${s.id}: hướng dẫn tạo AGENTS.md từ template`);
    }
    ok(typeof s.order === 'number' && s.order > 0, `${s.id}: order là số > 0`);
    ok(RUN_IN.includes(s.runsIn), `${s.id}: runsIn ∈ {plan,execute} (=${s.runsIn})`);
    ok(INVOKE_IN.includes(s.invoke), `${s.id}: invoke ∈ {once,per-request} (=${s.invoke})`);
    ok(s.next === null || typeof s.next === 'string', `${s.id}: next là string|null`);
    if (typeof s.next === 'string') ok(ids.has(s.next), `${s.id}: next "${s.next}" trỏ tới skill có thật`);
    orders.push(s.order);
  }

  // Chia stage pipeline (chuỗi bắt buộc) vs recipe on-demand (pipeline=false).
  const pipe = p.stages.filter((s) => s.pipeline !== false);
  const recipes = p.stages.filter((s) => s.pipeline === false);
  const pipeOrders = pipe.map((s) => s.order);

  // order: unique toàn plugin; pipeline liên tục 1..N; recipe đứng SAU pipeline.
  ok(new Set(orders).size === orders.length, `${p.id}: order không trùng`);
  const sortedPipe = [...pipeOrders].sort((a, b) => a - b);
  ok(sortedPipe.every((v, i) => v === i + 1), `${p.id}: order pipeline liên tục 1..${pipe.length}`);
  ok(recipes.every((s) => s.order > pipe.length), `${p.id}: order recipe > ${pipe.length} (đứng sau pipeline)`);
  ok(recipes.every((s) => s.next === null), `${p.id}: recipe skill có next=null (không nối pipeline)`);

  // references/ — tên file KHÔNG trùng giữa các skill trong cùng plugin (giữ hygiene; trước đây
  // bắt buộc vì cursor ship references/ phẳng dưới rules/; giờ mỗi skill có folder riêng).
  const refRel = [];
  for (const s of p.stages) {
    if ((s.assets || []).includes('references')) {
      refRel.push(...listFilesRec(path.join(dir, 'skills', s.id, 'references')));
    }
  }
  ok(new Set(refRel).size === refRel.length, `${p.id}: tên file trong references/ không trùng giữa các skill`);

  // Nếu plugin CÓ pipeline: đúng 1 skill kết thúc (next=null), order lớn nhất. Bỏ pipeline
  // (mọi skill là recipe) → không áp ràng buộc này (không còn khái niệm chuỗi bắt buộc).
  if (pipe.length > 0) {
    const terminals = pipe.filter((s) => s.next === null);
    ok(terminals.length === 1, `${p.id}: đúng 1 skill pipeline kết thúc (next=null)`);
    if (terminals.length === 1) {
      ok(terminals[0].order === Math.max(...pipeOrders), `${p.id}: skill pipeline kết thúc có order lớn nhất`);
    }
  }
}

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
    // Agent không được gọi agent khác, nên agent nêu trong Hành động phải do chính bước đó dispatch.
    const agentsByStep = new Map(stepRefs(s.body).map((r) => [r.n, r.agents]));
    for (const st of parseSteps(s.body)) {
      const act = (st.body.split('**Hành động:**')[1] || '').split('\n- **')[0];
      for (const a of allAgents) {
        if (act.includes(a.id)) ok((agentsByStep.get(st.n) || []).includes(a.id),
          `${s.id} bước ${st.n}: agent "${a.id}" nêu trong Hành động phải có trong Thực hiện`);
      }
    }
    ok(!s.body.includes('skills/workflows/'),
      `${s.id}: không nêu đường dẫn "skills/workflows/" (workflow cài phẳng thành skills/workflow-<slug>/)`);
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

// ─────────────────────────────────────────────────────────────────────────────
// 3. BUILD OUTPUT (Claude) — chuẩn hóa ở tầng adapter
// ─────────────────────────────────────────────────────────────────────────────
const BUILD = path.join(REPO_ROOT, 'build');
if (process.argv.includes('--build')) {
  execFileSync('node', ['cli/build.mjs', '--target', 'all'], { cwd: REPO_ROOT, stdio: 'ignore' });
}
const claudeDir = path.join(BUILD, 'claude');
if (fs.existsSync(claudeDir)) {
  const mk = JSON.parse(fs.readFileSync(path.join(claudeDir, '.claude-plugin', 'marketplace.json'), 'utf8'));
  const mkName = loadMarketplace().name;
  ok(mk.name === mkName, `build: marketplace.json name khớp nguồn ("${mkName}")`);
  ok(mk.plugins.some((x) => x.name === 'core'), 'build: marketplace liệt kê core');
  const wfBuilt = !!(workflows && workflows.stages.length);
  ok(mk.plugins.length === plugins.length + 1 + (wfBuilt ? 1 : 0),
    `build: marketplace có ${plugins.length}+1 (core)${wfBuilt ? '+1 (workflows)' : ''} entry`);

  // core plugin
  ok(fs.existsSync(path.join(claudeDir, 'plugins/core/.claude-plugin/plugin.json')), 'build: core plugin.json');
  ok(fs.existsSync(path.join(claudeDir, 'plugins/core/skills/principles/SKILL.md')), 'build: core skill principles');

  // skill dùng chung của core ship như skill plugin core + pointer principles + strip metadata
  for (const s of core.stages) {
    const out = path.join(claudeDir, 'plugins/core/skills', s.id, 'SKILL.md');
    ok(fs.existsSync(out), `build core ${s.id}: có SKILL.md`);
    const content = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
    ok(content.includes('core:principles') && content.includes('`principles`'),
      `build core ${s.id}: pointer principles đủ 2 dạng (phẳng + plugin)`);
    const fmText = content.match(/^---\n([\s\S]*?)\n---/);
    const keys = fmText ? fmText[1].split('\n').filter(Boolean).map((l) => l.split(':')[0].trim()) : [];
    ok(keys.includes('name') && keys.includes('description') && !keys.includes('order'),
      `build core ${s.id}: frontmatter chuẩn Claude (name+description, strip metadata)`);
  }

  for (const p of plugins) {
    const pj = JSON.parse(fs.readFileSync(path.join(claudeDir, 'plugins', p.id, '.claude-plugin/plugin.json'), 'utf8'));
    ok(!!pj.name && !!pj.version && !!pj.description, `build ${p.id}: plugin.json có name/version/description`);
    // Dependency cùng marketplace = TÊN TRẦN "core" (Claude Code không nhận "<mkt>:core").
    ok(Array.isArray(pj.dependencies) && pj.dependencies.includes('core'),
      `build ${p.id}: depends on "core" (tên trần, cùng marketplace)`);

    // shared/principles.md tới Claude qua skill <id>-principles (claude không inline principles)
    if (p.shared.principles && p.shared.principles.trim()) {
      ok(fs.existsSync(path.join(claudeDir, 'plugins', p.id, 'skills', `${p.id}-principles`, 'SKILL.md')),
        `build claude ${p.id}: có skill ${p.id}-principles`);
    }

    // SKILL.md output đã CHUẨN HÓA: chỉ name + description (metadata workflow bị strip ở adapter)
    for (const s of p.stages) {
      const out = path.join(claudeDir, 'plugins', p.id, 'skills', s.id, 'SKILL.md');
      ok(fs.existsSync(out), `build ${s.id}: có SKILL.md`);
      const content = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
      const fmText = content.match(/^---\n([\s\S]*?)\n---/);
      if (fmText) {
        const keys = fmText[1].split('\n').filter(Boolean).map((l) => l.split(':')[0].trim());
        ok(keys.includes('name') && keys.includes('description'), `build ${s.id}: frontmatter có name+description`);
        ok(!keys.includes('order') && !keys.includes('runsIn'), `build ${s.id}: đã strip metadata workflow (chuẩn Claude)`);
      } else {
        fails.push(`build ${s.id}: SKILL.md thiếu frontmatter`);
      }
      // pointer principles: Claude không auto-load → stage skill phải trỏ tới nguyên tắc nền tảng.
      // Pointer nêu CẢ dạng skill phẳng (principles / <id>-principles) lẫn dạng plugin namespaced
      // (core:principles / <id>:<id>-principles) để đúng với mọi cách cài (aip skills vs marketplace).
      if (p.shared.principles && p.shared.principles.trim()) {
        ok(content.includes(`${p.id}-principles`) && content.includes('core:principles')
          && content.includes(`${p.id}:${p.id}-principles`),
          `build claude ${s.id}: pointer principles đủ cả 2 dạng (phẳng + plugin)`);
        ok(content.includes('`git-workflow`') && content.includes('core:git-workflow'),
          `build claude ${s.id}: pointer git-workflow (phẳng + core:git-workflow)`);
      }
    }
  }

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
} else {
  console.log('  (bỏ qua kiểm tra build/ — chưa build. Dùng --build để build trước.)');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PARITY references/ — skill có references trong source thì MỌI build phải ship
// (trước đây chỉ claude ship; codex/antigravity/cursor bị rớt → mất nội dung).
// ─────────────────────────────────────────────────────────────────────────────
for (const p of plugins) {
  for (const s of p.stages) {
    if (!(s.assets || []).includes('references')) continue;
    const checks = [
      ['claude', path.join(claudeDir, 'plugins', p.id, 'skills', s.id, 'references')],
      ['codex', path.join(BUILD, 'codex', p.id, 'skills', s.id, 'references')],
      ['antigravity', path.join(BUILD, 'antigravity', p.id, 'docs', 'workflow', s.id, 'references')],
      ['cursor', path.join(BUILD, 'cursor', p.id, '.cursor', 'skills', s.id, 'references')],
    ];
    for (const [tool, refDir] of checks) {
      // chỉ kiểm tra nếu build của tool đó tồn tại (validate có thể chạy không --build)
      if (!fs.existsSync(path.join(BUILD, tool))) continue;
      ok(hasFiles(refDir), `build ${tool} ${s.id}: ship references/ (parity)`);
    }
  }
}

// Parity cho SKILL DÙNG CHUNG của core: claude/codex/cursor ship trong plugin/bundle core;
// antigravity gộp vào bundle TỪNG plugin (recipe on-demand).
for (const s of core.stages) {
  if (!(s.assets || []).includes('references')) continue;
  const checks = [
    ['claude', path.join(claudeDir, 'plugins', 'core', 'skills', s.id, 'references')],
    ['codex', path.join(BUILD, 'codex', 'core', 'skills', s.id, 'references')],
    ['cursor', path.join(BUILD, 'cursor', 'core', '.cursor', 'skills', s.id, 'references')],
    ...plugins.map((p) => ['antigravity', path.join(BUILD, 'antigravity', p.id, 'docs', 'workflow', s.id, 'references'), p.id]),
  ];
  for (const [tool, refDir, pid] of checks) {
    if (!fs.existsSync(path.join(BUILD, tool))) continue;
    ok(hasFiles(refDir), `build ${tool}${pid ? ' ' + pid : ''} core ${s.id}: ship references/ (parity)`);
  }
}

// 4b. CURSOR: Agent Skills (.cursor/skills/) + chỉ còn 00-principles rule
{
  const cursorDir = path.join(BUILD, 'cursor');
  if (fs.existsSync(cursorDir)) {
    function assertCursorSkill(bundleId, skillId) {
      const skillDir = path.join(cursorDir, bundleId, '.cursor', 'skills', skillId);
      const out = path.join(skillDir, 'SKILL.md');
      ok(fs.existsSync(out), `build cursor ${bundleId}/${skillId}: có SKILL.md`);
      ok(/^[a-z0-9-]+$/.test(skillId), `build cursor ${skillId}: skill-id hợp lệ (a-z0-9-)`);
      const content = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
      const fmText = content.match(/^---\n([\s\S]*?)\n---/);
      const keys = fmText ? fmText[1].split('\n').filter(Boolean).map((l) => l.split(':')[0].trim()) : [];
      ok(keys.includes('name') && keys.includes('description') && !keys.includes('order'),
        `build cursor ${skillId}: frontmatter chuẩn (name+description, strip metadata)`);
      const nameLine = fmText ? fmText[1].split('\n').find((l) => l.startsWith('name:')) : '';
      const nameVal = nameLine ? nameLine.slice('name:'.length).trim().replace(/^["']|["']$/g, '') : '';
      ok(nameVal === skillId, `build cursor ${skillId}: name == folder`);
    }
    for (const s of core.stages) assertCursorSkill('core', s.id);
    for (const p of plugins) {
      for (const s of p.stages) assertCursorSkill(p.id, s.id);
      const rulesDir = path.join(cursorDir, p.id, '.cursor', 'rules');
      const rules = fs.existsSync(rulesDir) ? fs.readdirSync(rulesDir) : [];
      const mdc = rules.filter((f) => f.endsWith('.mdc'));
      ok(mdc.length === 1 && mdc[0] === `${p.id}-00-principles.mdc`,
        `build cursor ${p.id}: chỉ còn ${p.id}-00-principles.mdc (không per-stage rule)`);
    }
    const coreRules = path.join(cursorDir, 'core', '.cursor', 'rules');
    ok(!fs.existsSync(coreRules) || fs.readdirSync(coreRules).length === 0,
      'build cursor core: không còn rules/ (skills-only)');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DRIFT GUARD: AGENTS.md (repo) == AGENTS.template.md (nguồn template)
{
  const a = path.join(REPO_ROOT, 'AGENTS.md');
  const t = path.join(REPO_ROOT, 'core', 'agents', 'AGENTS.template.md');
  ok(fs.existsSync(t), 'AGENTS.template.md tồn tại');
  ok(fs.existsSync(a), 'AGENTS.md (repo) tồn tại');
  if (fs.existsSync(a) && fs.existsSync(t)) {
    const norm = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    ok(norm(a) === norm(t), 'AGENTS.md == AGENTS.template.md (không drift)');
    const body = norm(a);
    ok(body.includes('Comments are documentation, not narration')
      && body.includes('Quality gate')
      && body.includes('Assume the reader is an experienced engineer')
      && /explain \*why\*/.test(body),
      'AGENTS.md: comment policy (why-only + quality gate + senior reader)');
  }
}

// 7. SOURCE: templates.md của *-init (nếu có) phải có link tới AGENTS.md
for (const p of plugins) {
  for (const s of p.stages) {
    if (!s.id.endsWith('-init')) continue;
    const tpl = path.join(PLUGINS_DIR, p.id, 'skills', s.id, 'references', 'templates.md');
    if (!fs.existsSync(tpl)) continue;
    const tplText = fs.readFileSync(tpl, 'utf8');
    if (!tplText.includes('## CLAUDE.md')) continue; // khung chung đã chuyển sang templates/init
    ok(tplText.includes('[AGENTS.md](AGENTS.md)'),
      `${s.id}: references/templates.md (còn mô tả CLAUDE.md) có link [AGENTS.md](AGENTS.md)`);
  }
}

// 5c. SOURCE: templates/init/ — khung chung dùng cho aip init + skill *-init
{
  const T = path.join(REPO_ROOT, 'templates', 'init');
  ok(fs.existsSync(T), 'templates/init/ tồn tại');
  const must = [
    'CLAUDE.md', 'CONTRIBUTING.md', 'README.md', 'TODO.md',
    'project-knowledge/project-overview.md', 'project-knowledge/domain-context.md',
    'project-knowledge/architecture.md', 'project-knowledge/source-structure.md',
    'project-knowledge/code-convention.md', 'project-knowledge/tech-stack.yml',
    'docs/requests/_TEMPLATE/requirement.md',
    'docs/requests/_TEMPLATE/plan.md', 'docs/contracts/.gitkeep',
    'docs/decisions/_TEMPLATE.md', 'docs/decisions/0001-vi-du-quyet-dinh.md',
    'docs/decisions/0002-code-convention.md', 'src/shared/.gitkeep', 'tests/.gitkeep',
  ];
  for (const rel of must) ok(fs.existsSync(path.join(T, rel)), `templates/init/${rel} tồn tại`);
  const claude = fs.existsSync(path.join(T, 'CLAUDE.md')) ? fs.readFileSync(path.join(T, 'CLAUDE.md'), 'utf8') : '';
  ok(claude.includes('[AGENTS.md](AGENTS.md)'), 'templates/init/CLAUDE.md: link [AGENTS.md](AGENTS.md)');
  ok(claude.includes('core:principles') && claude.includes('`principles`'),
    'templates/init/CLAUDE.md: pointer principles (phẳng + core:principles)');
  ok(claude.includes('core:git-workflow') && claude.includes('`git-workflow`'),
    'templates/init/CLAUDE.md: pointer git-workflow (phẳng + core:git-workflow)');
}

// 6. INIT skills ship AGENTS.template.md (CLI lẫn skill drop ra ./AGENTS.md)
for (const p of plugins) {
  for (const s of p.stages) {
    if (!s.id.endsWith('-init')) continue;
    const checks = [
      ['claude', path.join(claudeDir, 'plugins', p.id, 'skills', s.id, 'AGENTS.template.md')],
      ['codex', path.join(BUILD, 'codex', p.id, 'skills', s.id, 'AGENTS.template.md')],
      ['antigravity', path.join(BUILD, 'antigravity', p.id, 'docs', 'workflow', s.id, 'AGENTS.template.md')],
      ['cursor', path.join(BUILD, 'cursor', p.id, '.cursor', 'skills', s.id, 'AGENTS.template.md')],
    ];
    for (const [tool, f] of checks) {
      if (!fs.existsSync(path.join(BUILD, tool))) continue;
      ok(fs.existsSync(f), `build ${tool} ${s.id}: ship AGENTS.template.md`);
    }
  }
}

// 6b. BUILD: *-init ship cả cây templates/ (khung chung) cho mọi tool
if (fs.existsSync(BUILD)) {
  for (const p of plugins) {
    for (const s of p.stages) {
      if (!s.id.endsWith('-init')) continue;
      const targets = [
        ['claude', path.join(claudeDir, 'plugins', p.id, 'skills', s.id, 'templates', 'CLAUDE.md')],
        ['codex', path.join(BUILD, 'codex', p.id, 'skills', s.id, 'templates', 'CLAUDE.md')],
        ['antigravity', path.join(BUILD, 'antigravity', p.id, 'docs', 'workflow', s.id, 'templates', 'CLAUDE.md')],
        ['cursor', path.join(BUILD, 'cursor', p.id, '.cursor', 'skills', s.id, 'templates', 'CLAUDE.md')],
      ];
      for (const [tool, f] of targets) {
        if (!fs.existsSync(path.join(BUILD, tool))) continue;
        ok(fs.existsSync(f), `build ${tool} ${s.id}: ship templates/CLAUDE.md`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. BUILD codex: pointer git-workflow trong stage skill (parity nhắc nguyên tắc nền tảng)
// ─────────────────────────────────────────────────────────────────────────────
{
  const codexDir = path.join(BUILD, 'codex');
  if (fs.existsSync(codexDir)) {
    for (const p of plugins) {
      const sample = p.stages[0];
      if (!sample) continue;
      const out = path.join(codexDir, p.id, 'skills', sample.id, 'SKILL.md');
      if (!fs.existsSync(out)) continue;
      const content = fs.readFileSync(out, 'utf8');
      ok(content.includes('`git-workflow`'),
        `build codex ${sample.id}: pointer git-workflow`);
    }
    for (const a of allAgents) {
      const f = path.join(codexDir, a.plugin, 'agents', `${a.id}.toml`);
      const c = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      ok(/^name = ".+"$/m.test(c) && /^description = /m.test(c) && c.includes('developer_instructions = """')
        && /^sandbox_mode = "(read-only|workspace-write)"$/m.test(c), `build codex agent ${a.id}: đủ trường`);
    }
    if (workflows) for (const s of workflows.stages) {
      ok(fs.existsSync(path.join(codexDir, 'workflows', 'skills', s.id, 'SKILL.md')), `build codex ${s.id}: có SKILL.md`);
    }
  }
}

// 8. SOURCE: data-db-migration — hợp đồng references/ (spec 2026-09-29 §7.1, G2 §5–§7; ADR 0001: skill thuộc plugin data)
{
  const dbmRef = path.join(PLUGINS_DIR, 'data', 'skills', 'data-db-migration', 'references');
  const dbmFiles = listFilesRec(dbmRef);
  const dbmRead = (rel) => fs.readFileSync(path.join(dbmRef, rel), 'utf8');
  const skillPath = path.join(dbmRef, '..', 'SKILL.md');
  const skillExists = fs.existsSync(skillPath);
  ok(skillExists, 'data-db-migration: có SKILL.md');
  const skillMd = skillExists ? fs.readFileSync(skillPath, 'utf8') : '';
  // ADR 0001: mọi năng lực liên quan database thuộc plugin data; bản cũ ở backend phải biến mất hẳn.
  ok(!fs.existsSync(path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-db-migration')),
    'data-db-migration: không còn thư mục backend-db-migration ở plugin backend');
  ok(/^name: data-db-migration$/m.test(skillMd) && /^order: 5$/m.test(skillMd) && /^stageNumber: "05"$/m.test(skillMd),
    'data-db-migration: frontmatter name, order 5, stageNumber "05" trong plugin data');
  for (const f of ['adopt/inventory-checklist.md', 'adopt/tool-comparison-rubric.md']) {
    ok(dbmFiles.includes(f), `data-db-migration: có references/${f}`);
    ok(skillMd.includes(`(references/${f})`), `data-db-migration: SKILL.md link tới references/${f}`);
  }
  const rubric = dbmFiles.includes('adopt/tool-comparison-rubric.md') ? dbmRead('adopt/tool-comparison-rubric.md') : '';
  ok(['T1', 'T2', 'T3', 'T4', 'T5', 'T6'].every((t) => rubric.includes(`| ${t} |`)),
    'data-db-migration: rubric đủ 6 tiêu chí T1–T6');
  ok(/\|\s*Bằng chứng\s*\|/.test(rubric), 'data-db-migration: rubric bắt buộc cột Bằng chứng');
  for (const f of ['change/change-patterns.md', 'change/lock-risk-postgres.md', 'change/verify-cycle.md']) {
    ok(dbmFiles.includes(f), `data-db-migration: có references/${f}`);
    ok(skillMd.includes(`(references/${f})`), `data-db-migration: SKILL.md link tới references/${f}`);
  }
  const cycle = dbmFiles.includes('change/verify-cycle.md') ? dbmRead('change/verify-cycle.md') : '';
  ok(['## Flyway', '## Liquibase', '## Alembic'].every((h) => cycle.includes(h)),
    'data-db-migration: verify-cycle có đủ Flyway / Liquibase / Alembic');
  ok(cycle.includes('forward-only'), 'data-db-migration: verify-cycle nêu Flyway forward-only (M3)');
  // Lệnh chờ ACCESS EXCLUSIVE chặn cả SELECT đến sau; mẫu thiếu lock_timeout sẽ bị chép nguyên vào project.
  const patterns = dbmFiles.includes('change/change-patterns.md') ? dbmRead('change/change-patterns.md') : '';
  const sqlSegments = [...patterns.matchAll(/```sql\n([\s\S]*?)```/g)]
    .flatMap((m) => m[1].split(/^(?=-- migration)/m));
  ok(sqlSegments.length > 0 && sqlSegments
    .filter((s) => /ADD CONSTRAINT|SET NOT NULL/.test(s)).every((s) => s.includes('lock_timeout')),
    'data-db-migration: mẫu ADD CONSTRAINT/SET NOT NULL có lock_timeout');
  const lock = dbmFiles.includes('change/lock-risk-postgres.md') ? dbmRead('change/lock-risk-postgres.md') : '';
  ok(lock.includes('| Nguồn |'), 'data-db-migration: bảng rủi ro khoá có cột Nguồn');
  const lockRows = lock.split('\n').filter((l) => l.startsWith('|'));
  ok(lockRows.some((l) => l.includes('https://')), 'data-db-migration: bảng rủi ro khoá có link nguồn https://');
  ok(!lockRows.some((l) => /\|\s*[LFQ]\d+(,\s*[LFQ]\d+)*\s*\|/.test(l)),
    'data-db-migration: bảng rủi ro khoá không dùng mã nguồn viết tắt (L1/F1/Q1)');
  const sbFiles = dbmFiles.filter((f) => f.startsWith('spring-boot/'));
  const sbRead = (rel) => dbmRead(rel);
  for (const f of ['module-pom.xml.tpl', 'DbMigrationApplication.java.tpl', 'application-migration.yml',
    'env.example', 'new-migration.sh']) {
    ok(sbFiles.includes(`spring-boot/common/${f}`), `data-db-migration: có spring-boot/common/${f}`);
  }
  // B2 của G2: env.example thừa/thiếu key so với yml là lỗi im lặng lúc chạy job.
  const ymlVars = new Set(sbFiles.filter((f) => f.endsWith('.yml'))
    .flatMap((f) => [...sbRead(f).matchAll(/\$\{([A-Z0-9_]+)(?::[^}]*)?\}/g)].map((m) => m[1])));
  const envKeys = new Set(sbFiles.includes('spring-boot/common/env.example')
    ? [...sbRead('spring-boot/common/env.example').matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]) : []);
  ok(ymlVars.size > 0 && [...ymlVars].every((v) => envKeys.has(v)) && [...envKeys].every((k) => ymlVars.has(k)),
    `data-db-migration: env.example khớp đúng biến yml (yml=${[...ymlVars].sort()} env=${[...envKeys].sort()})`);
  // D1–D3, B1 của G2: bean tự viết vô hiệu autoconfig; spring.factories trỏ class không tồn tại.
  ok(!dbmFiles.some((f) => f.endsWith('spring.factories')), 'data-db-migration: không ship spring.factories');
  ok(sbFiles.filter((f) => f.endsWith('.tpl')).every((f) => !sbRead(f).includes('@Configuration')),
    'data-db-migration: template không có @Configuration tự viết');
  const pom = sbFiles.includes('spring-boot/common/module-pom.xml.tpl') ? sbRead('spring-boot/common/module-pom.xml.tpl') : '';
  ok(pom.includes('<artifactId>flyway-core</artifactId>') && pom.includes('<artifactId>liquibase-core</artifactId>')
    && !/<artifactId>(flyway-core|flyway-database-postgresql|liquibase-core)<\/artifactId>\s*<version>/.test(pom),
    'data-db-migration: pom có cả hai khối công cụ, không ghim version (để BOM pin)');
  const fw = sbFiles.filter((f) => f.startsWith('spring-boot/flyway/db/migration/'));
  const baseName = (f) => f.split('/').pop();
  ok(sbFiles.includes('spring-boot/flyway/application-flyway.yml') && sbFiles.includes('spring-boot/flyway/CONVENTIONS.md'),
    'data-db-migration: có flyway/application-flyway.yml + CONVENTIONS.md');
  ok(fw.length === 5, `data-db-migration: layout mẫu flyway đủ 5 file (=${fw.length})`);
  // B4 của G2: sai separator thì Flyway bỏ qua migration mà không báo.
  ok(fw.every((f) => /^(V\d{14}__[a-z0-9_]+\.sql\.(tpl|conf)|R__[a-z0-9_]+\.sql\.tpl)$/.test(baseName(f))),
    'data-db-migration: tên file flyway đúng V<14 số>__ / R__');
  ok(fw.filter((f) => f.endsWith('.conf')).every((c) => fw.includes(c.replace(/\.conf$/, '.tpl'))),
    'data-db-migration: mỗi .conf có migration mẫu cùng tên');
  const fwRoot = 'spring-boot/flyway/db/migration/';
  ok(fw.every((f) => (baseName(f).startsWith('R__')
    ? f.startsWith(`${fwRoot}repeatable/`)
    : f.startsWith(`${fwRoot}baseline/`) || f.startsWith(`${fwRoot}versioned/`))),
    'data-db-migration: file flyway đúng thư mục baseline/versioned/repeatable');
  const lbRoot = 'spring-boot/liquibase/db/changelog/';
  const lb = sbFiles.filter((f) => f.startsWith(lbRoot));
  ok(sbFiles.includes('spring-boot/liquibase/application-liquibase.yml') && sbFiles.includes('spring-boot/liquibase/CONVENTIONS.md'),
    'data-db-migration: có liquibase/application-liquibase.yml + CONVENTIONS.md');
  const lbMaster = lb.includes(lbRoot + 'db.changelog-master.yaml') ? sbRead(lbRoot + 'db.changelog-master.yaml') : '';
  const lbIncludes = [...lbMaster.matchAll(/file:\s*(\S+\.yaml)/g)].map((m) => m[1]);
  ok(lbIncludes.length === 3 && lbIncludes.every((i) => lb.includes(lbRoot + i)),
    `data-db-migration: master include đủ 3 changelog có thật (=${lbIncludes})`);
  const lbSets = lb.filter((f) => f.endsWith('.yaml') && !f.endsWith('db.changelog-master.yaml'));
  // D6 của G2: changeSet thiếu rollback thì trả chi phí Liquibase mà mất lợi ích chính.
  ok(lbSets.length === 3 && lbSets.every((f) => {
    const c = sbRead(f);
    return (c.match(/- changeSet:/g) || []).length === (c.match(/^\s+rollback:/gm) || []).length;
  }), 'data-db-migration: mỗi changeSet mẫu có rollback');
  ok(lbSets.every((f) => [...sbRead(f).matchAll(/path:\s*(\S+)/g)].every((m) => {
    const p = path.posix.join(path.posix.dirname(f), m[1]);
    return lb.includes(p) || lb.includes(p + '.tpl');
  })), 'data-db-migration: sqlFile trong changeSet trỏ tới file có thật');
  // SET LOCAL không có tác dụng trong changeSet runInTransaction: false; luật phải tách hai trường hợp.
  const lbConv = sbFiles.includes('spring-boot/liquibase/CONVENTIONS.md') ? sbRead('spring-boot/liquibase/CONVENTIONS.md') : '';
  ok(lbConv.includes('SET LOCAL lock_timeout') && lbConv.includes('RESET lock_timeout'),
    'data-db-migration: CONVENTIONS liquibase tách luật lock_timeout trong/ngoài transaction');
  ok(dbmFiles.includes('README.md') && !dbmFiles.includes('spring-boot/README.md'),
    'data-db-migration: README ở gốc references/, không ở spring-boot/ (trùng path với vault-consul)');
  ok(skillMd.includes('(references/README.md)'), 'data-db-migration: SKILL.md link tới references/README.md');
  const readme = dbmFiles.includes('README.md') ? dbmRead('README.md') : '';
  ok(sbFiles.every((f) => readme.includes(f.replace(/^spring-boot\//, ''))),
    'data-db-migration: README liệt kê mọi file template spring-boot/');
  // Job chỉ chạy update: thiếu precondition MARK_RAN thì baseline chạy DDL trên DB đã có schema.
  ok(readme.includes('MARK_RAN') && readme.includes('changelog-sync'),
    'data-db-migration: README có đường adopt Liquibase cho DB đã có dữ liệu (MARK_RAN + changelog-sync)');
  ok(readme.includes('bỏ đuôi `.tpl`'), 'data-db-migration: README nêu quy tắc bỏ đuôi .tpl khi copy template');
}

// 9. SOURCE: contract đầu ra ở core/principles (P0 PL1)
{
  // Spec không được ship; contract chỉ tới được agent ở project đích qua core:principles.
  const cp = loadCore().principles || '';
  ok(cp.includes('workflow_result'), 'core.principles: có contract workflow_result');
  ok(cp.includes('severity: blocker'), 'core.principles: có schema finding (severity: blocker)');
  ok(cp.includes('status: passed'), 'core.principles: có schema evidence (status: passed)');
  const stale = [];
  for (const root of [PLUGINS_DIR, path.join(REPO_ROOT, 'workflows')]) {
    for (const rel of listFilesRec(root)) {
      if (!rel.endsWith('.md') || rel.split('/').includes('build')) continue;
      const txt = fs.readFileSync(path.join(root, rel), 'utf8');
      if (txt.includes('schema spec §5.1') || txt.includes('schema §5.1')) stale.push(path.basename(root) + '/' + rel);
    }
  }
  ok(stale.length === 0, `không còn pointer tới "schema §5.1" của spec không ship (=${stale.join(', ')})`);
}

// 10. SOURCE: sửa lỗi nội dung skill/manifest (P0 S1–S3, PL2)
{
  const readSrc = (rel) => fs.readFileSync(path.join(PLUGINS_DIR, rel), 'utf8');
  ok(!readSrc('backend/skills/backend-code-review/SKILL.md').includes('sắp có'),
    'P0 S1: backend-code-review không còn "sắp có" (backend-refactor đã tồn tại)');
  ok(!readSrc('frontend/skills/frontend-code-review/SKILL.md').includes('sắp có'),
    'P0 S1: frontend-code-review không còn "sắp có" (frontend-refactor đã tồn tại)');
  // Mâu thuẫn với ranh giới "KHÔNG nối data/API/route" của chính frontend-implement.
  ok(!readSrc('frontend/shared/principles.md').includes('nối API thật'),
    'P0 S2: frontend principles không còn "nối API thật" (mâu thuẫn ranh giới frontend-implement)');
  ok(!readSrc('backend/skills/backend-init/SKILL.md').includes('Node-TypeScript'),
    'P0 S3: backend-init không còn lựa chọn stack Node-TypeScript (chưa có template)');
  // Manifest description là nơi người dùng phát hiện skill; skill mới thêm mà quên cập nhật thì bị "ẩn".
  for (const id of ['backend', 'frontend', 'engineering']) {
    const desc = JSON.parse(readSrc(`${id}/.manifest.json`)).description;
    const skillsDir = path.join(PLUGINS_DIR, id, 'skills');
    const missing = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !desc.includes(e.name)).map((e) => e.name);
    ok(missing.length === 0, `P0 PL2: manifest ${id} nêu đủ skill trong description (thiếu: ${missing.join(', ')})`);
  }
  ok(!JSON.parse(readSrc('frontend/.manifest.json')).description.includes('Layered'),
    'P0 D4: manifest frontend không còn "Layered" (kiểu kiến trúc đã đổi sang Feature-Based)');
}

// 11. SOURCE: sửa lỗi workflow/agent (P0 WF1, WF2, D11)
{
  const readRepo = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8').replace(/\r\n/g, '\n');
  const testing = readRepo('workflows', 'testing', 'WORKFLOW.md');
  // Bước 5 cấm sửa code production; câu phủ định "không sửa code" là hợp lệ nên loại trước khi kiểm.
  const testFailRow = testing.split('\n').find((l) => l.startsWith('| Test fail |')) ?? '';
  ok(testFailRow !== '' && !testFailRow.replaceAll('không sửa code', '').includes('sửa code'),
    'P0 WF1: workflow-testing có dòng "Test fail" và không bảo "sửa code" (mâu thuẫn Bước 5)');
  // "sửa test" phải kèm rào chắn chống xoá/nới test để qua; lỗi code phải chuyển sang workflow-bugfix.
  ok(testFailRow.includes('nới') && testFailRow.includes('workflow-bugfix'),
    'P0 WF1: dòng "Test fail" giữ rào "không xoá/nới test" và định tuyến lỗi code sang workflow-bugfix');
  const step6 = testing.split('### Bước 6')[1]?.split('### Bước 7')[0] ?? '';
  const step6Input = step6.split('\n').find((l) => l.startsWith('- **Đầu vào:**')) ?? '';
  ok(step6Input !== '' && !step6Input.includes('đã chạy xanh'),
    'P0 WF1: workflow-testing Bước 6 không đòi "đã chạy xanh" (lỗi code chuyển sang workflow-bugfix nên không xanh toàn bộ)');
  const docs = readRepo('workflows', 'docs', 'WORKFLOW.md');
  ok(!docs.includes('| Build fail | Chẩn đoán') && !docs.includes('| Test fail | Phân tích failure'),
    'P0 WF2: workflow-docs không còn boilerplate Build fail/Test fail (workflow không build/test)');
  ok(!readRepo('plugins', 'engineering', 'agents', 'engineering-spec-analyst.md').includes('cả hai skill'),
    'P0 D11: engineering-spec-analyst không còn "cả hai skill" (agent dùng ba skill)');
}

// 12. SOURCE: frontend-data-integration — hợp đồng skill/references/agent (spec 2026-09-29 §7.3, §8.3)
{
  const diDir = path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-data-integration');
  const diRef = path.join(diDir, 'references');
  const diFiles = listFilesRec(diRef);
  const diRead = (rel) => fs.readFileSync(path.join(diRef, rel), 'utf8');
  const diSkillPath = path.join(diDir, 'SKILL.md');
  const diSkillExists = fs.existsSync(diSkillPath);
  ok(diSkillExists, 'frontend-data-integration: có SKILL.md');
  const diSkill = diSkillExists ? fs.readFileSync(diSkillPath, 'utf8') : '';
  ok(/^order: 7$/m.test(diSkill) && /^pipeline: false$/m.test(diSkill) && /^sharedAssets: templates\/architecture$/m.test(diSkill),
    'frontend-data-integration: frontmatter order 7, pipeline false, sharedAssets templates/architecture');
  ok(['I1', 'I2', 'I3', 'I4', 'I5'].every((g) => diSkill.includes(`### ${g}.`)),
    'frontend-data-integration: SKILL.md có đủ cổng I1–I5');
  for (const f of ['contract-and-codegen.md', 'data-layer-by-architecture.md', 'states-and-errors.md']) {
    ok(diFiles.includes(f), `frontend-data-integration: có references/${f}`);
    ok(diSkill.includes(`(references/${f})`), `frontend-data-integration: SKILL.md link tới references/${f}`);
  }
  const diLayer = diFiles.includes('data-layer-by-architecture.md') ? diRead('data-layer-by-architecture.md') : '';
  ok(['Feature-Based', 'FSD', 'Micro-FE'].every((k) => diLayer.includes(`| ${k} |`)),
    'frontend-data-integration: bảng đặt file có đủ 3 kiến trúc');
  ok(diLayer.includes('entities/<x>/api') && diLayer.includes('features/<x>/api'),
    'frontend-data-integration: FSD tách đọc (entities) và ghi (features)');
  const diStates = diFiles.includes('states-and-errors.md') ? diRead('states-and-errors.md') : '';
  ok(['loading', 'error', 'empty', 'success'].every((s) => diStates.includes(`| ${s} |`)),
    'frontend-data-integration: bảng trạng thái đủ 4 hàng loading/error/empty/success');
  const diCodegen = diFiles.includes('contract-and-codegen.md') ? diRead('contract-and-codegen.md') : '';
  ok(diCodegen.includes('https://'),
    'frontend-data-integration: contract-and-codegen có nguồn https cho hành vi công cụ');
  // Tên file references không trùng giữa các skill frontend (validate mục hygiene cũng kiểm, ở đây báo rõ theo skill).
  const diOtherRefs = fs.readdirSync(path.join(PLUGINS_DIR, 'frontend', 'skills'))
    .filter((d) => d !== 'frontend-data-integration')
    .flatMap((d) => listFilesRec(path.join(PLUGINS_DIR, 'frontend', 'skills', d, 'references')));
  ok(diFiles.every((f) => !diOtherRefs.includes(f)), 'frontend-data-integration: tên file references không trùng skill frontend khác');
  const diAgentPath = path.join(PLUGINS_DIR, 'frontend', 'agents', 'frontend-data-integrator.md');
  const diAgentExists = fs.existsSync(diAgentPath);
  ok(diAgentExists, 'frontend-data-integrator: có agent file');
  const diAgent = diAgentExists ? fs.readFileSync(diAgentPath, 'utf8') : '';
  ok(/^mode: write$/m.test(diAgent) && /^skills: "frontend-data-integration"$/m.test(diAgent),
    'frontend-data-integrator: mode write, skills = frontend-data-integration');
  ok(diAgent.includes('container') && diAgent.includes('docs/contracts/') && diAgent.includes('core:principles'),
    'frontend-data-integrator: nối ở container/page, không sửa docs/contracts/, trỏ contract đầu ra ở core:principles');
}

// 13. SOURCE: frontend-e2e-testing — hợp đồng skill/references/agent (spec 2026-09-29 §7.2, §8.2)
{
  const e2eDir = path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-e2e-testing');
  const e2eRef = path.join(e2eDir, 'references');
  const e2eFiles = listFilesRec(e2eRef);
  const e2eRead = (rel) => fs.readFileSync(path.join(e2eRef, rel), 'utf8');
  const e2eSkillPath = path.join(e2eDir, 'SKILL.md');
  const e2eSkillExists = fs.existsSync(e2eSkillPath);
  ok(e2eSkillExists, 'frontend-e2e-testing: có SKILL.md');
  const e2eSkill = e2eSkillExists ? fs.readFileSync(e2eSkillPath, 'utf8') : '';
  ok(/^order: 8$/m.test(e2eSkill) && /^pipeline: false$/m.test(e2eSkill) && /^sharedAssets: templates\/architecture$/m.test(e2eSkill),
    'frontend-e2e-testing: frontmatter order 8, pipeline false, sharedAssets templates/architecture');
  ok(['E1', 'E2', 'E3', 'E4', 'E5'].every((g) => e2eSkill.includes(`### ${g}.`)),
    'frontend-e2e-testing: SKILL.md có đủ cổng E1–E5');
  ok(['E-r1', 'E-r2', 'E-r3', 'E-r4', 'E-r5', 'E-r6', 'E-r7'].every((r) => e2eSkill.includes(`| ${r} |`)),
    'frontend-e2e-testing: SKILL.md có đủ quy tắc E-r1–E-r7');
  for (const f of ['playwright-config-and-auth.md', 'flow-selection-and-patterns.md']) {
    ok(e2eFiles.includes(f), `frontend-e2e-testing: có references/${f}`);
    ok(e2eSkill.includes(`(references/${f})`), `frontend-e2e-testing: SKILL.md link tới references/${f}`);
  }
  const e2eCfg = e2eFiles.includes('playwright-config-and-auth.md') ? e2eRead('playwright-config-and-auth.md') : '';
  ok(e2eCfg.includes("trace: 'on-first-retry'") && e2eCfg.includes('storageState') && e2eCfg.includes('E2E_BASE_URL'),
    'frontend-e2e-testing: config mẫu có trace on-first-retry, storageState, baseURL từ biến môi trường');
  ok(/retries:\s*process\.env\.CI \? 2 : 1/.test(e2eCfg), 'frontend-e2e-testing: config mẫu có retries ≥ 1 để trace on-first-retry được ghi');
  ok(e2eCfg.includes('assertLocalBaseURL') && /staging/.test(e2eCfg) && /production/.test(e2eCfg),
    'frontend-e2e-testing: có hàm chặn host không phải local/test (staging/production)');
  ok(e2eCfg.includes('https://playwright.dev/'),
    'frontend-e2e-testing: playwright-config-and-auth có nguồn https://playwright.dev/ cho hành vi công cụ');
  ok(['Feature-Based', 'FSD', 'Micro-FE'].every((k) => e2eCfg.includes(`| ${k} |`)),
    'frontend-e2e-testing: bảng vị trí e2e có đủ 3 kiến trúc');
  const e2eFlow = e2eFiles.includes('flow-selection-and-patterns.md') ? e2eRead('flow-selection-and-patterns.md') : '';
  ok(e2eFlow.includes('| # | Luồng | AC |') && e2eFlow.includes('--repeat-each=3'),
    'frontend-e2e-testing: có bảng chọn luồng → AC và lệnh --repeat-each=3');
  // E-r1/E-r2: ví dụ trong tài liệu không được tự vi phạm quy tắc của chính skill.
  ok(!/locator\(\s*['"`][.#\/]/.test(e2eCfg + e2eFlow) && !/waitForTimeout\(/.test(e2eCfg + e2eFlow),
    'frontend-e2e-testing: ví dụ không dùng selector CSS/XPath và không dùng waitForTimeout(');
  // Tên file references không trùng giữa các skill frontend (validate mục hygiene cũng kiểm, ở đây báo rõ theo skill).
  const e2eOtherRefs = fs.readdirSync(path.join(PLUGINS_DIR, 'frontend', 'skills'))
    .filter((d) => d !== 'frontend-e2e-testing')
    .flatMap((d) => listFilesRec(path.join(PLUGINS_DIR, 'frontend', 'skills', d, 'references')));
  ok(e2eFiles.every((f) => !e2eOtherRefs.includes(f)), 'frontend-e2e-testing: tên file references không trùng skill frontend khác');

  const e2eAgentPath = path.join(PLUGINS_DIR, 'frontend', 'agents', 'frontend-e2e-test-writer.md');
  const e2eAgentExists = fs.existsSync(e2eAgentPath);
  ok(e2eAgentExists, 'frontend-e2e-test-writer: có agent file');
  const e2eAgent = e2eAgentExists ? fs.readFileSync(e2eAgentPath, 'utf8') : '';
  ok(/^mode: write$/m.test(e2eAgent) && /^skills: "frontend-e2e-testing"$/m.test(e2eAgent),
    'frontend-e2e-test-writer: mode write, skills = frontend-e2e-testing');
  ok(e2eAgent.includes('e2e/') && e2eAgent.includes('staging/production') && e2eAgent.includes('not_run') && e2eAgent.includes('core:principles'),
    'frontend-e2e-test-writer: chỉ ghi e2e/, cấm staging/production, not_run khi thiếu môi trường, evidence theo core:principles');
}

// 14. SOURCE: backend-code-review — trục performance (spec 2026-09-29 §3.3 S4, lỗi D12)
{
  const brDir = path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-code-review');
  const brRead = (rel) => fs.readFileSync(path.join(brDir, rel), 'utf8');
  const brDims = brRead('references/review-dimensions.md');
  const brSkill = brRead('SKILL.md');
  const brTemplate = brRead('references/review-output-template.md');
  const brAgent = fs.readFileSync(path.join(PLUGINS_DIR, 'backend', 'agents', 'backend-reviewer.md'), 'utf8');
  ok(brDims.includes('## Trục 6 — Performance'), 'backend-code-review: review-dimensions có "Trục 6 — Performance"');
  const brPerf = (brDims.split('## Trục 6 — Performance')[1] ?? '').split('\n## ')[0];
  ok(['N+1', 'index', 'vòng lặp', 'eager'].every((k) => brPerf.includes(k)),
    'backend-code-review: Trục 6 nêu đủ N+1, thiếu index, query trong vòng lặp, tải eager thừa');
  // Contract đầu ra cấm kết luận hiệu năng khi thiếu số đo; trục mới phải giữ đúng ràng buộc đó.
  ok(brPerf.includes('suspected') && brPerf.includes('số đo'),
    'backend-code-review: Trục 6 quy định finding hiệu năng không có số đo là suspected');
  ok(brSkill.includes('- **Performance**') && /^description: .*N\+1/m.test(brSkill),
    'backend-code-review: SKILL.md có bullet Performance ở bước 1 và nêu N+1 trong description');
  ok(brTemplate.includes('`performance`'), 'backend-code-review: mẫu output liệt kê trục performance');
  ok(/hiệu năng/.test(brAgent), 'backend-reviewer: Vai trò nêu rủi ro hiệu năng');
}

// 15. SOURCE: workflow — sửa lỗi major không phụ thuộc skill draft (spec 2026-09-29 §5.3 WF7, WF4, WF3; lỗi D7–D10)
{
  const wfBody = (id) => workflows.stages.find((s) => s.id === id);
  const noStep = { title: '', body: '', checkpoint: false };

  const sec = wfBody('workflow-security-review');
  const secSteps = sec ? parseSteps(sec.body) : [];
  const secStep = (n) => secSteps.find((s) => s.n === n) ?? noStep;
  ok(!!sec && ['engineering-quality-auditor', 'backend-test-writer', 'frontend-test-writer', 'backend-fixer', 'frontend-fixer'].every((a) => sec.agents.includes(a)),
    'workflow-security-review: agents gồm auditor + 2 test-writer (regression test) + 2 fixer (sửa)');
  // D7: vùng rủi ro phải phủ authorization, SSRF và misconfiguration.
  ok(/authorization/.test(secStep(2).body) && secStep(2).body.includes('SSRF') && /misconfiguration/i.test(secStep(2).body),
    'workflow-security-review Bước 2: vùng rủi ro có authorization/access control, SSRF, security misconfiguration');
  // D8: secret lộ phải có bước rotate do người dùng thực hiện, đặt trước bước sửa code.
  ok(secStep(6).title.includes('Thu hồi secret') && secStep(6).checkpoint && /rotate/.test(secStep(6).body) && /người dùng/.test(secStep(6).body),
    'workflow-security-review Bước 6: bước Thu hồi secret (rotate) do người dùng thực hiện, có ⏸');
  ok(/Regression/i.test(secStep(7).title) && secStep(7).body.includes('agent `backend-test-writer`') && secStep(7).body.includes('agent `frontend-test-writer`'),
    'workflow-security-review Bước 7: regression test qua test-writer');
  ok(secSteps.length === 10 && secStep(8).title.startsWith('Sửa') && secStep(9).title.startsWith('Re-scan') && secStep(10).title.startsWith('Commit'),
    'workflow-security-review: 10 bước, Sửa ở Bước 8, Re-scan ở Bước 9, Commit ở Bước 10');

  const api = wfBody('workflow-api');
  const apiStep4 = api ? parseSteps(api.body).find((s) => s.n === 5) ?? noStep : noStep;
  ok(!!api && api.agents.includes('engineering-quality-auditor'), 'workflow-api: agents có engineering-quality-auditor');
  // D10: DoD đòi 0 blocker nên phải có bước review bảo mật, không chỉ kiểm drift.
  ok(apiStep4.body.includes('agent `backend-reviewer`') && apiStep4.body.includes('agent `engineering-quality-auditor`')
    && /authorization/.test(apiStep4.body) && /input validation/.test(apiStep4.body),
    'workflow-api Bước 5: kiểm drift song song với auditor kiểm authorization + input validation');

  const dbc = wfBody('workflow-db-change');
  const dbcSteps = dbc ? parseSteps(dbc.body) : [];
  const dbcStep = (n) => dbcSteps.find((s) => s.n === n) ?? noStep;
  // D9: đổi query/ORM/DTO mà không có bước test thì thay đổi schema không có lưới an toàn.
  ok(!!dbc && dbc.agents.includes('backend-test-writer'), 'workflow-db-change: agents có backend-test-writer');
  ok(/^Test/.test(dbcStep(7).title) && dbcStep(7).body.includes('agent `backend-test-writer`') && /Testcontainers/.test(dbcStep(7).body),
    'workflow-db-change Bước 7: bước Test qua backend-test-writer (integration, Testcontainers)');
  ok(/data-model\.md/.test(dbcStep(8).body) && /next_actions/.test(dbcStep(8).body),
    'workflow-db-change Bước 8: cập nhật data-model.md và ghi nợ contract vào next_actions');
  ok(dbcSteps.length === 9 && dbcStep(9).title.startsWith('Commit'), 'workflow-db-change: 9 bước, Commit ở Bước 9');

  ok(secStep(7).body.includes('local/test'), 'workflow-security-review Bước 7: test regression chỉ chạy trên môi trường local/test');
  ok(/ngoại lệ/.test(dbcStep(7).body) && /Docker/.test(dbcStep(7).body),
    'workflow-db-change Bước 7: DB tạm là ngoại lệ, có fallback khi không có Docker/Testcontainers');
  // Bảng agent ở README liệt kê workflow dùng từng agent; phải đi theo frontmatter sau khi sửa D7–D10.
  for (const f of ['README.md', 'README_VI.md']) {
    const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
    const row = (agent) => rd.split('\n').find((l) => l.startsWith(`| \`${agent}\` |`)) ?? '';
    ok(row('backend-test-writer').includes('WF06') && row('backend-test-writer').includes('WF07')
      && row('frontend-test-writer').includes('WF06') && row('engineering-quality-auditor').includes('WF08'),
      `${f}: bảng agent nêu đủ workflow dùng test-writer/auditor sau khi sửa D7–D10`);
  }
}

// 16. SOURCE: P2 còn lại — S5, S6, WF9, WF8, WF10 (spec 2026-09-29 §3.3, §5.3)
{
  const engRead = (rel) => fs.readFileSync(path.join(PLUGINS_DIR, 'engineering', 'skills', rel), 'utf8');
  const wf16 = (id) => workflows.stages.find((s) => s.id === id);
  const noStep16 = { title: '', body: '', checkpoint: false };

  // S5: quality-gate không làm nhiệm vụ kiểm quy ước; chỉ đường sang skill chuyên trách.
  ok(engRead('engineering-quality-gate/SKILL.md').includes('engineering-convention-enforce'),
    'S5: engineering-quality-gate trỏ sang engineering-convention-enforce');
  // S6: thủ tục ghi ADR nằm ở engineering-adr; spec-writing chỉ trỏ sang, không lặp lại thủ tục.
  const specSkill = engRead('engineering-spec-writing/SKILL.md');
  const specStep4 = (specSkill.split('4. **Ghi ADR')[1] ?? '').split('5. **Verify')[0];
  ok(specStep4.includes('engineering-adr') && !specStep4.includes('<số kế tiếp>'),
    'S6: engineering-spec-writing bước 4 trỏ sang engineering-adr, không còn thủ tục đánh số ADR');

  // WF9: nhóm "khác" từng không có reviewer; diff đụng contract/controller từng không kiểm drift.
  const cr = wf16('workflow-code-review');
  const crStep = (n) => (cr ? parseSteps(cr.body).find((s) => s.n === n) ?? noStep16 : noStep16);
  ok(/CI/.test(crStep(2).body) && /IaC/.test(crStep(2).body) && /SQL/.test(crStep(2).body),
    'workflow-code-review Bước 2: nhóm "khác" tách CI/IaC/SQL khỏi docs/config thuần');
  ok(crStep(3).body.includes('agent `engineering-quality-auditor`') && /CI\/IaC\/SQL/.test(crStep(3).body),
    'workflow-code-review Bước 3: auditor review nhóm CI/IaC/SQL');
  ok(crStep(3).body.includes('docs/contracts') && /drift/.test(crStep(3).body) && crStep(3).body.includes('agent `backend-reviewer`'),
    'workflow-code-review Bước 3: diff đụng docs/contracts hoặc controller thì backend-reviewer kiểm drift');

  // WF8: baseline từng chỉ là tiền điều kiện không ai đo (W-a); migration chờ chạy từng không được kiểm.
  const rel = wf16('workflow-release');
  const relSteps = rel ? parseSteps(rel.body) : [];
  const relStep = (n) => relSteps.find((s) => s.n === n) ?? noStep16;
  ok(relSteps.length === 8 && /Baseline/.test(relStep(1).title) && relStep(1).body.includes('session chính'),
    'workflow-release: 8 bước, Bước 1 là Baseline build/test do session chính đo');
  ok(relStep(2).title.startsWith('Quality gate') && relStep(4).title.startsWith('Version bump') && relStep(8).title.startsWith('Tag'),
    'workflow-release: Quality gate ở Bước 2, Version bump ở Bước 4, Tag ở Bước 8');
  ok(relStep(5).body.includes('agent `ops-release-engineer`') && /migration/.test(relStep(5).body) && /thứ tự/.test(relStep(5).body),
    'workflow-release Bước 5: deploy checklist kiểm migration chờ chạy và thứ tự migration↔deploy');

  // WF10: orchestrator từng không ghép được db-change + api + feature, và không chỉ đường tới skill không có workflow.
  const orch16 = wf16('workflow-orchestrator');
  const reg16 = orch16 ? parseRegistry(orch16.body) : { rows: [], priority: [] };
  const nextOf = (id) => (reg16.rows.find((r) => r.id === id) ?? { next: [] }).next;
  ok(nextOf('workflow-db-change').includes('workflow-api') && nextOf('workflow-api').includes('workflow-feature'),
    'workflow-orchestrator: Registry cho chuỗi db-change → api → feature qua cột Nối tiếp');
  const direct16 = ((orch16?.body ?? '').split('## Yêu cầu chạy trực tiếp bằng skill')[1] ?? '').split('\n## ')[0];
  ok(['backend-init', 'frontend-init', 'backend-migrate-vault-consul'].every((s) => direct16.includes(`\`${s}\``)),
    'workflow-orchestrator: mục "Yêu cầu chạy trực tiếp bằng skill" nêu backend-init, frontend-init, backend-migrate-vault-consul');
  ok(/tối đa 3/.test(orch16?.body ?? '') && /thứ tự phụ thuộc/.test(orch16?.body ?? ''),
    'workflow-orchestrator: giữ luật chuỗi tối đa 3 workflow và ghép theo thứ tự phụ thuộc');

  // Sau final review: orchestrator phải nhất quán với đầu ra chuỗi/skill trực tiếp; các workflow khác nêu đủ handoff.
  const orchStep1 = (orch16 ? parseSteps(orch16.body).find((s) => s.n === 1) : undefined) ?? noStep16;
  const out1 = (orchStep1.body.split('**Đầu ra:**')[1] ?? '').split('\n- **')[0];
  const gate1 = (orchStep1.body.split('**Gate:**')[1] ?? '').split('\n- **')[0];
  ok(/chuỗi/.test(out1) && /skill trực tiếp/.test(out1.replace(/\n/g, ' ')) && /skill trực tiếp/.test(gate1.replace(/\n/g, ' ')),
    'workflow-orchestrator Bước 1: Đầu ra và Gate nêu chuỗi và mục skill trực tiếp');
  ok(((orch16?.body ?? '').replace(/\n\s+/g, ' ').match(/không khớp mục skill trực tiếp/g) ?? []).length >= 3,
    'workflow-orchestrator: Khi fail, bảng lỗi và Điều kiện dừng không coi yêu cầu skill trực tiếp là "không khớp"');
  ok(crStep(3).body.includes('danh sách file cần kiểm drift') && /kết quả kiểm drift/.test(crStep(3).body),
    'workflow-code-review Bước 3: Đầu vào và Evidence nêu danh sách/kết quả kiểm drift');
  ok(((rel?.body ?? '').split('## Điều kiện tiên quyết')[0]).includes('baseline'),
    'workflow-release: Mục tiêu nêu baseline build/test');
}

// 17. SOURCE: P3 — WF3-b, A3, WF12, vùng rủi ro, WF11 (spec 2026-09-29 §5.3, §8.5)
{
  const wf17 = (id) => workflows.stages.find((s) => s.id === id);
  const noStep17 = { title: '', body: '', checkpoint: false };
  const step17 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) ?? noStep17 : noStep17);
  const flat17 = (t) => t.replace(/\s+/g, ' ');

  // WF3-b: Flyway forward-only không có rollback nên "up → rollback → up" không thực hiện được với mọi công cụ.
  const dbc17 = wf17('workflow-db-change');
  const dbcVerify = step17(dbc17, 6);
  ok(/Chạy thử|verify/i.test(dbcVerify.title) && flat17(dbcVerify.body).includes('forward-only') && flat17(dbcVerify.body).includes('migration bù'),
    'workflow-db-change Bước 6: verify theo công cụ, có nhánh forward-only dùng migration bù');
  ok(/chu trình verify/.test(flat17(dbcVerify.body.split('**Gate:**')[1] ?? '').split('- **')[0]),
    'workflow-db-change Bước 6: Gate nêu chu trình verify theo công cụ');

  // A3: mode write không khoá được theo đường dẫn nên mỗi bước test-writer phải tự chứng minh chỉ đụng file test.
  let matched = 0;
  for (const w17 of workflows.stages) {
    const refs17 = stepRefs(w17.body);
    for (const st of parseSteps(w17.body)) {
      const doers = refs17.find((r) => r.n === st.n)?.agents ?? [];
      if (!doers.some((a) => a === 'backend-test-writer' || a === 'frontend-test-writer')) continue;
      matched += 1;
      const gate = flat17((st.body.split('**Gate:**')[1] ?? '').split('\n- **')[0]);
      const evidence = flat17((st.body.split('**Evidence:**')[1] ?? '').split('\n- **')[0]);
      ok(gate.includes('git diff --name-only') && gate.includes('đầu bước') && /file test/.test(gate) && evidence.includes('đầu bước'),
        `${w17.id} bước ${st.n}: Gate/Evidence kiểm file thay đổi so với đầu bước, chỉ chứa file test`);
    }
  }
  ok(matched >= 9, 'A3: có ít nhất 9 bước test-writer được kiểm gate');

  // WF12: thiếu thang severity mặc định, thiếu bước truyền thông, "đủ thời gian" theo dõi không có ngưỡng.
  const inc17 = wf17('workflow-incident');
  const incSteps = inc17 ? parseSteps(inc17.body) : [];
  ok(incSteps.length === 8 && /Cập nhật stakeholder/.test(step17(inc17, 5).title) && step17(inc17, 5).checkpoint
    && step17(inc17, 6).title.startsWith('Xác minh phục hồi') && step17(inc17, 8).title.startsWith('Commit'),
    'workflow-incident: 8 bước, Bước 5 Cập nhật stakeholder ⏸, Xác minh phục hồi ở Bước 6, Commit ở Bước 8');
  ok(['SEV1', 'SEV2', 'SEV3', 'SEV4'].every((s) => flat17(step17(inc17, 1).body).includes(s)),
    'workflow-incident Bước 1: có thang severity mặc định SEV1–SEV4 khi project chưa có thang');
  ok(/cửa sổ theo dõi/.test(flat17(step17(inc17, 4).body)) && /cửa sổ theo dõi/.test(flat17(step17(inc17, 6).body)),
    'workflow-incident: cửa sổ theo dõi phục hồi do người dùng chốt ở Bước 4 và dùng ở Bước 6');
  ok(/người dùng tự gửi|người dùng gửi/.test(flat17(step17(inc17, 5).body))
    && stepRefs(inc17?.body ?? '').find((r) => r.n === 5)?.agents.length === 0,
    'workflow-incident Bước 5: chỉ soạn nội dung, người dùng tự gửi, không agent');

  // Workflow security-review có 8 vùng; reference của quality-gate phải có key check cho 3 vùng mới và bảng ánh xạ.
  const areas17 = fs.readFileSync(path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-quality-gate', 'references', 'security-review-areas.md'), 'utf8');
  ok(/authorization|phân quyền|kiểm quyền/i.test(areas17) && /SSRF/.test(areas17) && /misconfiguration|cấu hình (sai|không an toàn)/i.test(areas17),
    'quality-gate security-review-areas: có key check authorization, SSRF, security misconfiguration');
  ok(areas17.includes('**Security misconfiguration:**'),
    'quality-gate security-review-areas: có bullet "**Security misconfiguration:**" ở mục Crypto / Secrets');
  for (const area of ['auth/session', 'authorization/access control', 'input validation', 'SSRF', 'crypto/secrets', 'dependency', 'security misconfiguration', 'logging']) {
    ok(areas17.includes(`| ${area} |`),
      `quality-gate security-review-areas: bảng ánh xạ có hàng vùng "${area}" của workflow-security-review`);
  }

  // WF11 (phần 1): baseline từng chỉ là tiền điều kiện không ai đo (W-a).
  for (const id of ['workflow-feature', 'workflow-bugfix', 'workflow-testing']) {
    const w = wf17(id);
    const s1 = step17(w, 1);
    ok(/^Baseline/.test(s1.title) && flat17(s1.body).includes('session chính') && flat17(w?.body ?? '').includes('Baseline đỏ'),
      `${id}: Bước 1 là Baseline build/test do session chính đo, có hàng lỗi Baseline đỏ`);
    ok(flat17((w?.body ?? '').split('## Điều kiện tiên quyết')[1]?.split('## Các bước')[0] ?? '').includes('ở Bước 1'),
      `${id}: tiền điều kiện Baseline nêu được đo ở Bước 1`);
  }

  // WF11 (phần 2).
  for (const [id, total] of [['workflow-api', 8], ['workflow-security-review', 10]]) {
    const w = wf17(id);
    const s1 = step17(w, 1);
    ok(/^Baseline/.test(s1.title) && flat17(s1.body).includes('session chính') && flat17(w?.body ?? '').includes('Baseline đỏ'),
      `${id}: Bước 1 là Baseline build/test do session chính đo, có hàng lỗi Baseline đỏ`);
    ok((w ? parseSteps(w.body).length : 0) === total, `${id}: ${total} bước sau khi thêm Baseline`);
    ok(flat17((w?.body ?? '').split('## Điều kiện tiên quyết')[1]?.split('## Các bước')[0] ?? '').includes('ở Bước 1'),
      `${id}: tiền điều kiện Baseline nêu được đo ở Bước 1`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 18. SOURCE: *-fix skill + *-fixer agent + nối workflow (spec 2026-09-30-fixer-agent-design)
{
  const fixSkill = (p) => {
    const f = path.join(PLUGINS_DIR, p, 'skills', `${p}-fix`, 'SKILL.md');
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  };
  const flat18 = (t) => t.replace(/\s+/g, ' ');
  for (const p of ['backend', 'frontend']) {
    const s = fixSkill(p);
    ok(s.length > 0, `${p}-fix: có SKILL.md`);
    ok(/^order: 9$/m.test(s) && /^pipeline: false$/m.test(s) && /^runsIn: execute$/m.test(s),
      `${p}-fix: frontmatter order 9, pipeline false, runsIn execute`);
    // §3.2: ranh giới với implement/refactor phải nằm trong description để trigger đúng skill.
    ok(/^description: .*oracle/m.test(s) && /^description: .*-implement/m.test(s) && /^description: .*-refactor/m.test(s),
      `${p}-fix: description nêu oracle và ranh giới với ${p}-implement / ${p}-refactor`);
    for (const g of ['F1', 'F2', 'F3', 'F4', 'F5']) ok(s.includes(`| ${g} `), `${p}-fix: bảng gate có ${g}`);
    for (const m of ['`bug`', '`security`', '`performance`']) ok(s.includes(m), `${p}-fix: có chế độ ${m}`);
    ok(flat18(s).includes('không tự tuyên bố nhanh hơn') && flat18(s).includes('Bước 5'),
      `${p}-fix: chế độ performance không tự tuyên bố nhanh hơn, số đo thuộc Bước 5 của workflow`);
    ok(s.includes('blocked') && flat18(s).includes('không tự mở'),
      `${p}-fix: cần sửa ngoài danh sách → blocked, không tự mở phạm vi`);
    ok(/^\| F3 \| Không sửa[^\n]*test[^\n]*fixture[^\n]*snapshot/m.test(s),
      `${p}-fix: hàng F3 của bảng gate cấm sửa file test/fixture/snapshot`);
    ok(s.includes('che triệu chứng'), `${p}-fix: F4 có danh sách che triệu chứng`);
  }
  ok(fixSkill('backend').includes('@Disabled') && fixSkill('backend').includes('pytest.skip'),
    'backend-fix: danh sách che triệu chứng theo stack Java/Python');
  ok(fixSkill('frontend').includes('@ts-ignore') && fixSkill('frontend').includes('eslint-disable') && fixSkill('frontend').includes('tsc --noEmit'),
    'frontend-fix: danh sách che triệu chứng theo stack TS/React và lệnh tsc --noEmit');
  const pub18 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_published.json'), 'utf8')).published;
  ok(pub18.includes('backend/backend-fix') && pub18.includes('frontend/frontend-fix'),
    '_published.json: có backend/backend-fix và frontend/frontend-fix (publish cùng đợt nối workflow, spec F-Q3)');
  const cowork18 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_cowork.json'), 'utf8')).skills;
  ok(cowork18.includes('backend:backend-fix') && cowork18.includes('frontend:frontend-fix'),
    '_cowork.json: có backend:backend-fix và frontend:frontend-fix');
  const fixAgent = (p) => {
    const f = path.join(PLUGINS_DIR, p, 'agents', `${p}-fixer.md`);
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  };
  for (const p of ['backend', 'frontend']) {
    const a = fixAgent(p);
    ok(a.length > 0, `${p}-fixer: có agent file`);
    ok(/^mode: write$/m.test(a) && new RegExp(`^skills: "${p}-fix"$`, 'm').test(a),
      `${p}-fixer: mode write, skills = ${p}-fix (đúng 1 skill)`);
    ok(/^description: .*oracle/m.test(a), `${p}-fixer: description nêu oracle`);
    ok(flat18(a).includes('file test') && flat18(a).includes('ngoài danh sách'),
      `${p}-fixer: phạm vi cấm sửa file test và cấm sửa ngoài danh sách`);
    ok(a.includes('blocked') && flat18(a).includes('không tự mở'),
      `${p}-fixer: cần mở rộng phạm vi → blocked, không tự mở`);
    ok(a.includes('core:principles') && a.includes('not_run'),
      `${p}-fixer: report theo contract core:principles, có not_run`);
    ok(a.includes('git diff --name-only'), `${p}-fixer: tự đối chiếu diff với danh sách trước khi trả`);
  }
  // spec 2026-09-30 §6.2: nối agent fixer vào workflow chỉ hợp lệ khi closure đã publish; nếu ai đó rút *-fix về
  // draft, 3 workflow sẽ bị wizard ẩn lặng lẽ — assert này bắt đúng điểm đó.
  const offeredWf = offeredCatalog().plugins.find((p) => p.id === 'workflows')?.skillIds ?? [];
  for (const w of ['workflow-bugfix', 'workflow-security-review', 'workflow-performance']) {
    ok(offeredWf.includes(`workflows/${w}`), `offeredCatalog: vẫn offer workflows/${w} (closure fixer đã publish)`);
  }
  const wf18 = (id) => workflows.stages.find((s) => s.id === id);
  const step18 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { title: '', body: '', checkpoint: false };
  const fixStepOk = (id, prevN, fixN, prevTitleRe, fixTitleRe) => {
    const w = wf18(id);
    const prev = step18(w, prevN), fix = step18(w, fixN);
    ok(prevTitleRe.test(prev.title) && prev.checkpoint && flat18(prev.body).includes('danh sách file'),
      `${id} Bước ${prevN}: bước ⏸ trước xuất danh sách file được sửa (đầu vào F2)`);
    ok(fixTitleRe.test(fix.title) && fix.body.includes('agent `backend-fixer`') && fix.body.includes('agent `frontend-fixer`'),
      `${id} Bước ${fixN}: Thực hiện là agent backend-fixer ∥ frontend-fixer`);
    ok(!flat18(fix.body).includes('Thực hiện:** session chính'), `${id} Bước ${fixN}: không còn session chính`);
    ok(fix.body.includes('git status --porcelain') && fix.body.includes('git diff --name-only')
      && flat18(fix.body).includes('⊆ danh sách') && flat18(fix.body).includes('không chứa file test'),
      `${id} Bước ${fixN}: Gate so diff với mốc đầu bước, ⊆ danh sách, không chứa file test`);
    ok(flat18(fix.body).includes('blocked'), `${id} Bước ${fixN}: Khi fail xử lý agent trả blocked`);
    ok(w && w.agents.includes('backend-fixer') && w.agents.includes('frontend-fixer'),
      `${id}: frontmatter agents có backend-fixer, frontend-fixer`);
    ok(flat18(w?.body ?? '').includes('Fixer trả `blocked`'), `${id}: bảng lỗi có hàng Fixer trả blocked`);
  };
  fixStepOk('workflow-bugfix', 5, 6, /^Root cause/, /^Fix tối thiểu/);
  ok(parseSteps(wf18('workflow-bugfix')?.body ?? '').length === 9, 'workflow-bugfix: vẫn 9 bước');
  fixStepOk('workflow-security-review', 5, 8, /^Kế hoạch remediation/, /^Sửa/);
  fixStepOk('workflow-performance', 3, 4, /^Profile & giả thuyết/, /^Tối ưu/);
  ok(parseSteps(wf18('workflow-performance')?.body ?? '').length === 7, 'workflow-performance: vẫn 7 bước');
  // spec 2026-09-30 §3.3: chế độ performance không có oracle đỏ — bước phải nói rõ số đo thuộc Bước 5.
  ok(flat18(step18(wf18('workflow-performance'), 4).body).includes('Bước 5'),
    'workflow-performance Bước 4: không kết luận hiệu năng, số đo thuộc Bước 5');
  for (const f of ['README.md', 'README_VI.md']) {
    const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
    const row = (agent) => rd.split('\n').find((l) => l.startsWith(`| \`${agent}\` |`)) ?? '';
    ok(['WF02', 'WF06', 'WF09'].every((w) => row('backend-fixer').includes(w) && row('frontend-fixer').includes(w)),
      `${f}: bảng agent có backend-fixer, frontend-fixer dùng ở WF02, WF06, WF09`);
  }
  // §3.2: refactor không còn trỏ "sửa bug → *-implement"; đích đúng là *-fix.
  for (const p of ['backend', 'frontend']) {
    const r = fs.readFileSync(path.join(PLUGINS_DIR, p, 'skills', `${p}-refactor`, 'SKILL.md'), 'utf8');
    ok(flat18(r).includes(`sửa bug`) && flat18(r).includes(`\`${p}-fix\``),
      `${p}-refactor: câu "cần đổi hành vi (sửa bug…)" trỏ sang ${p}-fix`);
  }

  // Review toàn nhánh: gate diff phải trừ mốc đầu bước và nhận ra file test đã bẩn (oracle) bị sửa; oracle
  // không chỉ là test đỏ (performance, vòng quay lại từ review/re-scan, tái hiện thủ công, finding không có test).
  for (const p of ['backend', 'frontend']) {
    const a = fixAgent(p), s = fixSkill(p);
    ok(flat18(a).includes('chế độ `performance`'), `${p}-fixer: Vai trò/Quy trình phân biệt chế độ performance`);
    ok(a.includes('hash-object'), `${p}-fixer: tự kiểm hash-object file test đã bẩn trong mốc`);
    ok(s.includes('Oracle chấp nhận'), `${p}-fix: có đoạn "Oracle chấp nhận" liệt kê các loại oracle`);
    ok(s.includes('hash-object'), `${p}-fix: F5 kiểm hash-object file test đã bẩn trong mốc`);
    ok(s.includes('NÂNG version'), `${p}-fix: nêu rõ được NÂNG version dependency đã có khi finding là CVE`);
  }
  for (const [id, n] of [['workflow-bugfix', 6], ['workflow-security-review', 8], ['workflow-performance', 4]]) {
    const st = step18(wf18(id), n);
    const field = (name) => flat18((st.body.split(`**${name}:**`)[1] ?? '').split('\n- **')[0]);
    ok(field('Gate').includes('hash-object') && field('Gate').includes('mock'),
      `${id} Bước ${n}: Gate kiểm hash-object file test đã bẩn và không chứa file mock`);
    ok(field('Đầu vào').includes('quay lại'), `${id} Bước ${n}: Đầu vào nêu oracle khi quay lại từ bước sau`);
    ok(field('Hành động').includes('git status --porcelain') && field('Hành động').includes('dispatch'),
      `${id} Bước ${n}: session chính ghi mốc git status --porcelain trước khi dispatch agent`);
  }
  // Bug phát hiện khi refactor chưa có oracle nên không thể đi thẳng sang *-implement (sinh code mới).
  for (const p of ['backend', 'frontend']) {
    const r = flat18(fs.readFileSync(path.join(PLUGINS_DIR, p, 'skills', `${p}-refactor`, 'SKILL.md'), 'utf8'));
    ok(!new RegExp(`bug[^.;\`]*\`${p}-implement\``).test(r) && r.includes('`workflow-bugfix`'),
      `${p}-refactor: bug phát hiện khi dọn route workflow-bugfix, không route ${p}-implement`);
  }

  // Dọn minor đã park: description/Phạm vi của agent phải khớp "Oracle chấp nhận" của skill (a)–(e), và gate
  // của workflow phải có nhánh xanh cho oracle không phải test đỏ.
  for (const p of ['backend', 'frontend']) {
    const a = fixAgent(p);
    ok(/^description: .*tái hiện thủ công/m.test(a),
      `${p}-fixer: description nêu đủ loại oracle, gồm bước tái hiện thủ công`);
    const scope = flat18((a.split('## Phạm vi')[1] ?? '').split('## Quy trình')[0]);
    const bullets = scope.split(/ - /);
    ok(bullets.some((b) => /^(- )?Được: nâng version/.test(b) && b.includes('CVE')),
      `${p}-fixer: có câu "Được" riêng cho nâng version dependency đã có, điều kiện CVE`);
    ok(bullets.some((b) => /^(- )?Không được:/.test(b) && b.includes('không thêm dependency mới') && !b.includes('nâng version')),
      `${p}-fixer: "Không được" giữ cấm thêm dependency mới, không còn phủ định kép về nâng version`);
  }
  {
    const upgradeSentence = (t) => flat18(t.slice(t.indexOf('NÂNG version'), t.indexOf('CVE của dependency đó')));
    const upFe = upgradeSentence(fixSkill('frontend'));
    ok(upFe.length > 0 && upFe.includes('package-lock') && !upFe.includes('pom.xml'),
      'frontend-fix: câu NÂNG version liệt kê manifest/lockfile frontend, không liệt kê pom.xml');
    const upBe = upgradeSentence(fixSkill('backend'));
    ok(upBe.includes('pom.xml') && !upBe.includes('package.json'),
      'backend-fix: câu NÂNG version liệt kê manifest backend, không liệt kê package.json');
    const gateOf = (id, n) => flat18((step18(wf18(id), n).body.split('**Gate:**')[1] ?? '').split('\n- **')[0]);
    ok(gateOf('workflow-bugfix', 6).includes('tái hiện'),
      'workflow-bugfix Bước 6: Gate có nhánh xanh cho oracle tái hiện thủ công');
    ok(gateOf('workflow-security-review', 8).includes('re-scan'),
      'workflow-security-review Bước 8: Gate có nhánh xanh cho finding không có test (re-scan)');
    const fieldOf18 = (id, n, name) => flat18((step18(wf18(id), n).body.split(`**${name}:**`)[1] ?? '').split('\n- **')[0]);
    for (const name of ['Đầu ra', 'Evidence']) {
      ok(fieldOf18('workflow-bugfix', 6, name).includes('tái hiện thủ công'),
        `workflow-bugfix Bước 6: ${name} nêu oracle tái hiện thủ công`);
      ok(fieldOf18('workflow-security-review', 8, name).includes('re-scan'),
        `workflow-security-review Bước 8: ${name} nêu finding không có test chờ re-scan`);
    }
  }
  for (const p of ['backend', 'frontend']) {
    ok(flat18(fixAgent(p)).includes('review/re-scan lại do bước sau của workflow'),
      `${p}-fixer: Report oracle (b)/(e) chỉ ghi file:line đã sửa, review/re-scan thuộc bước sau của workflow`);
  }
  // Khối agent trong spec là bản hiện hành, không trôi khỏi file thật (LF, bỏ xuống dòng cuối).
  {
    const spec18 = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'superpowers', 'specs', '2026-09-30-fixer-agent-design.md'), 'utf8');
    const block18 = (spec18.split('### 4.2')[1] ?? '').match(/```markdown\n([\s\S]*?)\n```/)?.[1] ?? '';
    const lf18 = (t) => t.replace(/\r\n/g, '\n').trimEnd();
    ok(block18.length > 0 && lf18(block18) === lf18(fixAgent('backend')),
      'spec fixer §4.2: khối agent giống hệt từng byte plugins/backend/agents/backend-fixer.md');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 19. SOURCE: S7 + publish frontend-data-integration/e2e-testing + WF4/WF5/WF6 (spec 2026-09-29 §3.3, §5.3, §7.2, §7.3.7)
{
  const flat19 = (t) => t.replace(/\s+/g, ' ');
  const wf19 = (id) => workflows.stages.find((s) => s.id === id);
  const step19 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { title: '', body: '', checkpoint: false };
  // Lấy riêng một trường của bước để assert không khớp nhầm chữ ở trường khác.
  const field19 = (body, name) => {
    const lines = body.split('\n');
    const head = new RegExp(`^- \\*\\*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\*\\*`);
    const i = lines.findIndex((l) => head.test(l));
    if (i === -1) return '';
    const j = lines.findIndex((l, k) => k > i && /^- \*\*/.test(l));
    return flat19(lines.slice(i, j === -1 ? lines.length : j).join('\n'));
  };
  const api5do19 = field19(step19(wf19('workflow-api'), 5).body, 'Thực hiện');
  ok(api5do19.includes('agent `backend-reviewer`') && !api5do19.includes('**Đầu vào:**'),
    'field19 (sanity): workflow-api Bước 5 "Thực hiện" có agent backend-reviewer và dừng trước trường kế tiếp');
  const ft19 = fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-testing', 'SKILL.md'), 'utf8');
  const fts19 = fs.readFileSync(
    path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-testing', 'references', 'test-strategy.md'), 'utf8');
  ok(flat19(ft19).includes('`frontend-e2e-testing`') && !/ngoài phạm vi recipe/.test(flat19(ft19) + flat19(fts19)),
    'frontend-testing (S7): SKILL.md trỏ e2e sang frontend-e2e-testing; SKILL.md + references/test-strategy.md hết "ngoài phạm vi recipe"');
  const pub19 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_published.json'), 'utf8')).published;
  for (const s of ['frontend/frontend-data-integration', 'frontend/frontend-e2e-testing']) {
    ok(pub19.includes(s), `_published.json: có ${s} (publish trước khi nối workflow, không chờ pilot)`);
  }
  const cowork19 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_cowork.json'), 'utf8')).skills;
  for (const s of ['frontend:frontend-data-integration', 'frontend:frontend-e2e-testing']) {
    ok(cowork19.includes(s), `_cowork.json: có ${s}`);
  }
  const feMan19 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', '.manifest.json'), 'utf8'));
  ok(feMan19.version === '1.6.0' && !feMan19.description.includes('DRAFT'),
    'frontend manifest: version 1.6.0, description không còn nhãn DRAFT');
  const fePr19 = fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', 'shared', 'principles.md'), 'utf8');
  ok(!fePr19.includes('state-model'), 'frontend principles: không còn tham chiếu state-model treo (spec §7.3.7)');
  const feImpl19 = fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-implement', 'SKILL.md'), 'utf8');
  ok(flat19(feImpl19).includes('`frontend-data-integration`'),
    'frontend-implement: trỏ phần nối data/API sang frontend-data-integration');
  const offWf19 = offeredCatalog().plugins.find((p) => p.id === 'workflows')?.skillIds ?? [];
  // Nối agent chỉ hợp lệ khi skill của agent đã publish; nếu rút về draft, wizard ẩn workflow lặng lẽ.
  for (const w of ['workflow-api', 'workflow-feature', 'workflow-testing']) {
    ok(offWf19.includes(`workflows/${w}`), `offeredCatalog: vẫn offer workflows/${w} (closure agent frontend đã publish)`);
  }
  const api19 = wf19('workflow-api');
  const apiS6 = step19(api19, 6);
  ok(/^FE client/.test(apiS6.title) && field19(apiS6.body, 'Thực hiện').includes('agent `frontend-data-integrator`'),
    'workflow-api Bước 6: FE client do agent frontend-data-integrator thực hiện');
  ok(!flat19(apiS6.body).includes('Gap G1') && field19(apiS6.body, 'Ràng buộc').includes('docs/contracts/'),
    'workflow-api Bước 6: bỏ ghi chú Gap G1; Ràng buộc cấm sửa docs/contracts/');
  ok(api19 && api19.agents.includes('frontend-data-integrator'), 'workflow-api: frontmatter agents có frontend-data-integrator');
  ok(parseSteps(api19?.body ?? '').length === 8, 'workflow-api: vẫn 8 bước');
  const feat19 = wf19('workflow-feature');
  const fS2 = step19(feat19, 2), fS4 = step19(feat19, 4), fS5 = step19(feat19, 5);
  ok(/^Phân tích/.test(fS2.title) && flat19(fS2.body).includes('schema') && flat19(fS2.body).includes('`workflow-db-change`'),
    'workflow-feature Bước 2: phạm vi có đổi schema → dừng, đề xuất workflow-db-change trước');
  // Integrator nối vào component do implementer dựng, nên phải chạy SAU, không song song.
  ok(/^Implement/.test(fS4.title) && field19(fS4.body, 'Thực hiện').includes('agent `frontend-data-integrator`')
    && field19(fS4.body, 'Thực hiện').includes('sau khi') && !flat19(fS4.body).includes('Gap G1'),
    'workflow-feature Bước 4: frontend-data-integrator chạy sau frontend-implementer (fullstack), bỏ Gap G1');
  ok(/^Test/.test(fS5.title) && field19(fS5.body, 'Thực hiện').includes('agent `frontend-e2e-test-writer`'),
    'workflow-feature Bước 5: có frontend-e2e-test-writer cho AC dạng luồng UI');
  ok(field19(fS5.body, 'Gate').includes('playwright.config') && flat19(fS5.body).includes('not_run'),
    'workflow-feature Bước 5: Gate cho phép e2e/ + playwright.config.*; e2e thiếu BE/DB test → not_run hợp lệ');
  ok(feat19 && ['frontend-data-integrator', 'frontend-e2e-test-writer'].every((a) => feat19.agents.includes(a)),
    'workflow-feature: frontmatter agents có frontend-data-integrator, frontend-e2e-test-writer');
  ok(parseSteps(feat19?.body ?? '').length === 8, 'workflow-feature: vẫn 8 bước');
  const orch19 = workflows.stages.find((s) => s.kind === 'orchestrator');
  const featRow19 = parseRegistry(orch19?.body ?? '').rows.find((r) => r.id === 'workflow-feature');
  ok(featRow19 && featRow19.next.length === 0, 'orchestrator: workflow-feature không nối tiếp workflow-docs (Bước 7 đã làm docs)');
  const tst19 = wf19('workflow-testing');
  const tS4 = step19(tst19, 4), tS5 = step19(tst19, 5);
  for (const [n, s] of [[4, tS4], [5, tS5]]) {
    ok(field19(s.body, 'Thực hiện').includes('agent `frontend-e2e-test-writer`'),
      `workflow-testing Bước ${n}: loại "luồng quan trọng: e2e" do frontend-e2e-test-writer thực hiện`);
    ok(field19(s.body, 'Gate').includes('playwright.config'),
      `workflow-testing Bước ${n}: Gate cho phép e2e/ + playwright.config.*`);
  }
  ok(flat19(tS5.body).includes('not_run'), 'workflow-testing Bước 5: e2e thiếu BE/DB test → not_run hợp lệ');
  ok(tst19 && tst19.agents.includes('frontend-e2e-test-writer'), 'workflow-testing: frontmatter agents có frontend-e2e-test-writer');
  ok(parseSteps(tst19?.body ?? '').length === 7, 'workflow-testing: vẫn 7 bước');
  for (const f of ['README.md', 'README_VI.md']) {
    const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
    const row = (a) => rd.split('\n').find((l) => l.startsWith(`| \`${a}\` |`)) ?? '';
    ok(['WF01', 'WF08'].every((w) => row('frontend-data-integrator').includes(w)),
      `${f}: bảng agent có frontend-data-integrator dùng ở WF01, WF08`);
    ok(['WF01', 'WF05'].every((w) => row('frontend-e2e-test-writer').includes(w)),
      `${f}: bảng agent có frontend-e2e-test-writer dùng ở WF01, WF05`);
    ok(!/^\| G1 \|/m.test(rd) && !/^\| G5 \|/m.test(rd), `${f}: bảng Skill gaps bỏ G1, G5 (đã có skill)`);
  }
  // Duyệt E2 của skill e2e phải có chỗ trong workflow, nếu không agent sẽ trình lại hoặc bỏ qua cổng.
  ok(field19(fS2.body, 'Hành động').includes('e2e'),
    'workflow-feature Bước 2: Hành động đánh dấu AC cần e2e (bảng luồng → AC → lý do)');
  ok(field19(fS5.body, 'Đầu vào').includes('E2'),
    'workflow-feature Bước 5: Đầu vào nhận bảng ứng viên e2e đã duyệt ở Bước 2 (duyệt E2)');
  const tS3 = step19(tst19, 3);
  ok(flat19(tS3.body).includes('E2'), 'workflow-testing Bước 3: bảng chiến lược được tính là duyệt E2 của frontend-e2e-testing');
  ok(field19(tS4.body, 'Gate').includes('not_run'), 'workflow-testing Bước 4: Gate chấp nhận e2e not_run vì thiếu môi trường');
  ok(field19(tS5.body, 'Ràng buộc').includes('local/test') && field19(tS5.body, 'Ràng buộc').includes('không tự dựng hạ tầng'),
    'workflow-testing Bước 5: Ràng buộc e2e chỉ chạy local/test, không tự dựng hạ tầng');
  for (const [name, s] of [['workflow-feature Bước 5', fS5], ['workflow-testing Bước 4', tS4], ['workflow-testing Bước 5', tS5]]) {
    const g = field19(s.body, 'Gate');
    ok(g.includes('.gitignore') && g.includes('E-r7'),
      `${name}: Gate cho phép dòng .gitignore của Playwright và package.json/lockfile chỉ khi đã duyệt (E-r7)`);
  }
  // Dọn minor đã park: Đầu ra/Evidence e2e của testing Bước 4, integrator blocked ở feature Bước 4, E-r7 gồm script.
  for (const [name, s] of [['workflow-feature Bước 5', fS5], ['workflow-testing Bước 4', tS4], ['workflow-testing Bước 5', tS5]]) {
    ok(field19(s.body, 'Gate').includes('script chạy e2e cũng cần duyệt'),
      `${name}: Gate E-r7 gồm cả việc thêm script chạy e2e vào package.json (cần duyệt như E-r7)`);
  }
  ok(field19(tS4.body, 'Đầu ra').includes('not_run') && field19(tS4.body, 'Evidence').includes('not_run'),
    'workflow-testing Bước 4: Đầu ra và Evidence nêu e2e not_run có lý do khi thiếu môi trường BE/DB test');
  ok(field19(fS4.body, 'Khi fail').includes('codegen') && field19(fS4.body, 'Khi fail').includes('blocked'),
    'workflow-feature Bước 4: Khi fail xử lý integrator trả blocked vì thiếu codegen/thư viện data');
  for (const [name, w] of [['workflow-feature', feat19], ['workflow-testing', tst19]]) {
    const b = w?.body ?? '';
    const i = b.indexOf('## Definition of Done'), j = b.indexOf('## Report');
    ok(i !== -1 && j > i && flat19(b.slice(i, j)).includes('e2e `not_run`'), `${name}: Definition of Done có ngoại lệ e2e not_run`);
  }
  const fS4r = field19(fS4.body, 'Ràng buộc');
  ok(fS4r.includes('codegen') && fS4r.includes('fetch'),
    'workflow-feature Bước 4: Ràng buộc integrator (thiếu codegen → dừng chờ chọn; không gọi fetch trong component)');
  ok(flat19(apiS6.body).includes('next_actions') && flat19(apiS6.body).includes('workflow-feature'),
    'workflow-api Bước 6: chưa có màn hình → bỏ qua + next_actions: workflow-feature');
  for (const t of [['references', 'testing-toolchain.md'], ['react-micro-frontend.template.md']]) {
    const tpl = flat19(fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', 'templates', 'architecture', ...t), 'utf8'));
    ok(tpl.includes('`frontend-e2e-testing`'), `frontend template ${t.join('/')}: câu e2e trỏ sang frontend-e2e-testing (S7)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 20. SOURCE: backend-performance skill + agent + workflow-performance Bước 2/3/5 (spec 2026-09-30-backend-performance-design)
{
  const flat20 = (t) => t.replace(/\s+/g, ' ');
  const wf20 = (id) => workflows.stages.find((s) => s.id === id);
  const step20 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { title: '', body: '', checkpoint: false };
  // Cắt đúng một trường cột 0 để assert không khớp nhầm chữ của trường khác trong cùng bước.
  const field20 = (body, name) => {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lines = body.split('\n');
    const i = lines.findIndex((l) => new RegExp(`^- \\*\\*${esc}:\\*\\*`).test(l));
    if (i < 0) return '';
    let j = lines.findIndex((l, k) => k > i && /^- \*\*/.test(l));
    if (j < 0) j = lines.length;
    return flat20(lines.slice(i, j).join('\n'));
  };
  const perfDir = path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-performance');
  const perfSkill = fs.existsSync(path.join(perfDir, 'SKILL.md')) ? fs.readFileSync(path.join(perfDir, 'SKILL.md'), 'utf8') : '';
  ok(perfSkill.length > 0, 'backend-performance: có SKILL.md');
  ok(/^order: 10$/m.test(perfSkill) && /^pipeline: false$/m.test(perfSkill) && /^runsIn: execute$/m.test(perfSkill),
    'backend-performance: frontmatter order 10, pipeline false, runsIn execute');
  ok(/^description: .*backend-fix/m.test(perfSkill) && /^description: .*backend-testing/m.test(perfSkill),
    'backend-performance: description nêu ranh giới với backend-fix và backend-testing');
  for (const g of ['P1', 'P2', 'P3', 'P4', 'P5']) ok(new RegExp(`^\\| ${g} `, 'm').test(perfSkill), `backend-performance: bảng gate có ${g}`);
  ok(perfSkill.includes('`measure`') && perfSkill.includes('`profile`'), 'backend-performance: có 2 chế độ measure / profile');
  ok(/^\| P3 [^\n]*10%/m.test(perfSkill), 'backend-performance: P3 có ngưỡng độ lệch mặc định 10%');
  ok(/^\| P1 [^\n]*staging\/production/m.test(perfSkill) && flat20(perfSkill).includes('not_run'),
    'backend-performance: P1 từ chối staging/production, thiếu môi trường → not_run');
  ok(/≥\s?3/.test(perfSkill) && perfSkill.includes('`perf/`') && perfSkill.includes('`bench/`'),
    'backend-performance: đo ≥3 lần, script ở perf/ và bench/');
  ok(/^\| P5 [^\n]*`src\/`/m.test(perfSkill), 'backend-performance: P5 cấm sửa src/ production');
  const perfRefs = ['measure-conditions', 'k6', 'jmh-pytest-benchmark', 'profiling-java', 'profiling-python', 'db-query-analysis'];
  const perfRef = (n) => { const f = path.join(perfDir, 'references', `${n}.md`); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; };
  for (const n of perfRefs) {
    ok(perfRef(n).length > 200, `backend-performance references/${n}.md: có nội dung`);
    ok(perfSkill.includes(`(references/${n}.md)`), `backend-performance: SKILL.md link tới references/${n}.md`);
  }
  ok(/\| *Môi trường *\|/.test(perfRef('measure-conditions')) && /warm-up/i.test(perfRef('measure-conditions')) && perfRef('measure-conditions').includes('10%'),
    'measure-conditions.md: bảng điều kiện đo có Môi trường, warm-up, ngưỡng 10%');
  ok(perfRef('k6').includes('__ENV.BASE_URL') && !/https?:\/\/(?!localhost|127\.0\.0\.1)[a-z]/i.test(perfRef('k6')),
    'k6.md: script mẫu lấy BASE_URL từ biến môi trường, không trỏ host ngoài localhost');
  ok(perfRef('jmh-pytest-benchmark').includes('@Benchmark') && perfRef('jmh-pytest-benchmark').includes('benchmark('),
    'jmh-pytest-benchmark.md: có ví dụ JMH @Benchmark và pytest-benchmark');
  ok(/JFR|jcmd/.test(perfRef('profiling-java')) && /async-profiler/.test(perfRef('profiling-java')),
    'profiling-java.md: có JFR và async-profiler');
  ok(/py-spy/.test(perfRef('profiling-python')) && /cProfile/.test(perfRef('profiling-python')),
    'profiling-python.md: có py-spy và cProfile');
  ok(/EXPLAIN ANALYZE/.test(perfRef('db-query-analysis')) && /N\+1/.test(perfRef('db-query-analysis')),
    'db-query-analysis.md: có EXPLAIN ANALYZE và N+1');
  ok(perfRefs.every((n) => perfRef(n).includes('[Unverified]') || !/`[a-z0-9-]+ [^`]*--/.test(perfRef(n))),
    'backend-performance references: lệnh có cờ công cụ phải gắn [Unverified] trong file');
  const pub20 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_published.json'), 'utf8')).published;
  ok(pub20.includes('backend/backend-performance'), '_published.json: có backend/backend-performance (publish trước khi nối workflow)');
  const cowork20 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_cowork.json'), 'utf8')).skills;
  ok(cowork20.includes('backend:backend-performance'), '_cowork.json: có backend:backend-performance');
  const beMan20 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, 'backend', '.manifest.json'), 'utf8'));
  ok(beMan20.version === '1.5.0', 'backend manifest: version 1.5.0');
  const paPath = path.join(PLUGINS_DIR, 'backend', 'agents', 'backend-performance-analyst.md');
  const pa = fs.existsSync(paPath) ? fs.readFileSync(paPath, 'utf8') : '';
  ok(pa.length > 0, 'backend-performance-analyst: có agent file');
  ok(/^mode: write$/m.test(pa) && /^skills: "backend-performance"$/m.test(pa),
    'backend-performance-analyst: mode write, skills = backend-performance (đúng 1 skill)');
  const paScope = flat20(pa.split('## Phạm vi')[1]?.split('## Quy trình')[0] ?? '');
  ok(paScope.includes('`perf/`') && paScope.includes('`bench/`') && paScope.includes('`src/`') && paScope.includes('staging/production'),
    'backend-performance-analyst: Phạm vi chỉ ghi perf/ bench/, cấm sửa src/, cấm staging/production');
  ok(paScope.includes('not_run'), 'backend-performance-analyst: thiếu môi trường → not_run');
  ok(pa.includes('core:principles') && pa.includes('git diff --name-only'),
    'backend-performance-analyst: report theo core:principles, tự đối chiếu diff');
  const perfWf = wf20('workflow-performance');
  const pS1 = step20(perfWf, 1), pS2 = step20(perfWf, 2), pS3 = step20(perfWf, 3), pS5 = step20(perfWf, 5);
  for (const [n, s, mode] of [[2, pS2, 'measure'], [3, pS3, 'profile'], [5, pS5, 'measure']]) {
    ok(field20(s.body, 'Thực hiện').includes('agent `backend-performance-analyst`') && field20(s.body, 'Thực hiện').includes(`\`${mode}\``),
      `workflow-performance Bước ${n}: Thực hiện là backend-performance-analyst chế độ ${mode}`);
    ok(flat20(s.body).includes('Phía FE: chưa có skill'), `workflow-performance Bước ${n}: có câu chờ cho phía FE`);
  }
  ok(field20(pS1.body, 'Đầu ra').includes('điều kiện đo'), 'workflow-performance Bước 1: Đầu ra có điều kiện đo sơ bộ');
  for (const [n, s] of [[2, pS2], [3, pS3]]) {
    const gate20 = field20(s.body, 'Gate');
    ok(gate20.includes('`perf/`') && gate20.includes('`bench/`') && gate20.includes('git diff --name-only')
      && gate20.includes('git ls-files --others'),
      `workflow-performance Bước ${n}: Gate so diff chỉ perf/ bench/ config tool đo`);
  }
  ok(field20(pS2.body, 'Khi fail').includes('blocked'), 'workflow-performance Bước 2: thiếu môi trường → dừng blocked');
  ok(field20(pS5.body, 'Đầu vào').includes('Bước 2') && field20(pS5.body, 'Ràng buộc').includes('không đổi điều kiện đo'),
    'workflow-performance Bước 5: dùng lại script + bảng điều kiện Bước 2, không đổi điều kiện');
  ok(field20(pS5.body, 'Gate').includes('nhiễu'), 'workflow-performance Bước 5: nhiễu vượt P3 → không kết luận');
  ok(pS3.checkpoint, 'workflow-performance Bước 3: giữ ⏸');
  ok(perfWf && perfWf.agents.includes('backend-performance-analyst'), 'workflow-performance: frontmatter agents có backend-performance-analyst');
  ok(parseSteps(perfWf?.body ?? '').length === 7, 'workflow-performance: vẫn 7 bước');
  ok((offeredCatalog().plugins.find((p) => p.id === 'workflows')?.skillIds ?? []).includes('workflows/workflow-performance'),
    'offeredCatalog: vẫn offer workflows/workflow-performance (closure analyst đã publish)');
  const perfErr = flat20(perfWf?.body.split('## Xử lý lỗi')[1]?.split('## Definition of Done')[0] ?? '');
  ok(perfErr.includes('Môi trường đo thiếu') && perfErr.includes('lệch Bước 2') && perfErr.includes('Nhiễu vượt'),
    'workflow-performance: bảng lỗi có 3 hàng môi trường thiếu / điều kiện lệch / nhiễu');
  for (const f of ['README.md', 'README_VI.md']) {
    const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
    const row = (a) => rd.split('\n').find((l) => l.startsWith(`| \`${a}\` |`)) ?? '';
    ok(row('backend-performance-analyst').includes('WF09'), `${f}: bảng agent có backend-performance-analyst dùng ở WF09`);
    ok((rd.split('\n').find((l) => l.startsWith('| WF09 |')) ?? '').includes('backend-performance-analyst'), `${f}: WF09 liệt kê backend-performance-analyst`);
    ok(!/^\| G10 \|/m.test(rd), `${f}: bảng Skill gaps bỏ G10`);
  }
  const paFlow = flat20(pa.split('## Quy trình')[1]?.split('## Report trả về')[0] ?? '');
  ok(pa.includes('blocked') && pa.includes('questions'), 'backend-performance-analyst: cần quyết định người dùng → trả blocked + questions[]');
  ok(paFlow.includes('Score') && paFlow.includes('median'), 'backend-performance-analyst: Quy trình ghi thống kê chính theo P3 (Score JMH, median pytest-benchmark)');
  ok(/^\| P5 [^\n]*blocked/m.test(perfSkill), 'backend-performance: P5 chạy như subagent → trả blocked');
  const perfMeasure = flat20(perfSkill.split('### `measure`')[1]?.split('### `profile`')[0] ?? '');
  ok(perfMeasure.includes('không ramp') && !/(?<!không )ramp/.test(perfMeasure),
    'backend-performance: measure dùng tải hằng định, không ramp (warm-up chạy riêng)');
  ok(perfRef('measure-conditions').includes('Config tool đo') && perfRef('measure-conditions').includes('Khởi chạy ứng dụng'),
    'measure-conditions.md: bảng điều kiện có hàng Config tool đo và Khởi chạy ứng dụng');
  const dbq20 = flat20(perfRef('db-query-analysis'));
  ok(dbq20.includes('không sửa') && dbq20.includes('`src/`') && /pg_stat_statements|log_statement/.test(dbq20) && dbq20.includes('blocked'),
    'db-query-analysis.md: đếm query bật lúc khởi chạy, không sửa src/, có cách đếm phía DB, bí → blocked');
  ok(field20(pS5.body, 'Gate').includes('hash-object'), 'workflow-performance Bước 5: Gate so git hash-object script + bảng điều kiện Bước 2');
  ok(field20(pS5.body, 'Hành động').includes('tiến trình mới'), 'workflow-performance Bước 5: khởi chạy lại ứng dụng, xác nhận tiến trình mới trước warm-up');
  for (const [n, s] of [[2, pS2], [3, pS3], [5, pS5]]) {
    ok(field20(s.body, 'Khi fail').includes('blocked') && field20(s.body, 'Khi fail').includes('câu hỏi'),
      `workflow-performance Bước ${n}: Khi fail — agent trả blocked + câu hỏi → session chính hỏi người dùng`);
  }
  ok(field20(pS3.body, 'Đầu vào').includes('script'), 'workflow-performance Bước 3: Đầu vào có bảng điều kiện + script Bước 2');
  const pf2 = step20(wf20('workflow-performance'), 2), pf3 = step20(wf20('workflow-performance'), 3), pf5 = step20(wf20('workflow-performance'), 5);
  ok(field20(pf2.body, 'Evidence').includes('hash-object'), 'workflow-performance Bước 2: Evidence ghi mốc git hash-object của script + bảng điều kiện');
  ok(field20(pf5.body, 'Gate').includes('mốc Bước 2'), 'workflow-performance Bước 5: Gate so hash với mốc Bước 2');
  ok(field20(pf3.body, 'Gate').includes('mốc Bước 2'),
    'workflow-performance Bước 3: Gate so git hash-object script + bảng điều kiện với mốc Bước 2');
  ok(field20(pf3.body, 'Hành động').includes('git hash-object') && field20(pf3.body, 'Evidence').includes('mốc Bước 2'),
    'workflow-performance Bước 3: Hành động đọc mốc hash-object, Evidence ghi hash hiện tại so với mốc Bước 2');
  ok(/^description: .*Score/m.test(pa), 'backend-performance-analyst: description nêu thống kê chính theo P3 (Score JMH)');
  ok(field20(pf5.body, 'Khi fail').includes('report Bước 5') && field20(pf5.body, 'Khi fail').includes('quay lại Bước 2'),
    'workflow-performance Bước 5: blocked ghi quyết định vào report Bước 5; đổi điều kiện → quay lại Bước 2');
  ok(field20(pf3.body, 'Ràng buộc').includes('không sửa bảng điều kiện'), 'workflow-performance Bước 3: không sửa bảng điều kiện của Bước 2');
  ok(!flat20(perfRef('db-query-analysis')).includes('vào hàng Khởi chạy ứng dụng'),
    'db-query-analysis.md: profile không ghi lệnh khởi chạy vào bảng điều kiện Bước 2');
  ok(/^\| Khởi chạy ứng dụng \|[^|\n]*PID/m.test(perfRef('measure-conditions')), 'measure-conditions.md: hàng Khởi chạy ứng dụng ghi PID/thời điểm start Bước 2');
}

// ─────────────────────────────────────────────────────────────────────────────
// 21. SOURCE: workflow-release Bước 5 — smoke e2e trước deploy (brief C, frontend-e2e-test-writer)
{
  const flat21 = (t) => t.replace(/\s+/g, ' ');
  const wf21 = (id) => workflows.stages.find((s) => s.id === id);
  const step21 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { title: '', body: '', checkpoint: false };
  // Cắt đúng một trường cột 0 để assert không khớp nhầm chữ của trường khác trong cùng bước.
  const field21 = (body, name) => {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lines = body.split('\n');
    const i = lines.findIndex((l) => new RegExp(`^- \\*\\*${esc}:\\*\\*`).test(l));
    if (i < 0) return '';
    let j = lines.findIndex((l, k) => k > i && /^- \*\*/.test(l));
    if (j < 0) j = lines.length;
    return flat21(lines.slice(i, j).join('\n'));
  };
  const relWf = wf21('workflow-release');
  const rS5 = step21(relWf, 5), rS6 = step21(relWf, 6);
  ok(field21(rS5.body, 'Thực hiện').includes('agent `frontend-e2e-test-writer`') && field21(rS5.body, 'Thực hiện').includes('agent `ops-release-engineer`'),
    'workflow-release Bước 5: Thực hiện có cả ops-release-engineer lẫn frontend-e2e-test-writer (smoke tuỳ chọn)');
  ok(field21(rS5.body, 'Ràng buộc').includes('staging/production') && field21(rS5.body, 'Ràng buộc').includes('không viết'),
    'workflow-release Bước 5: Ràng buộc smoke chỉ local/test (không staging/production), không viết test');
  ok(field21(rS5.body, 'Gate').includes('not_run') && field21(rS5.body, 'Gate').includes('không có e2e'),
    'workflow-release Bước 5: Gate nhận smoke pass, not_run có lý do hoặc không có e2e');
  ok(field21(rS5.body, 'Khi fail').includes('không deploy') && field21(rS5.body, 'Khi fail').includes('workflow-bugfix'),
    'workflow-release Bước 5: Khi fail smoke đỏ → không deploy, đề xuất workflow-bugfix');
  ok(flat21(rS5.body).includes('bỏ qua E2') && flat21(rS5.body).includes('không sửa test'),
    'workflow-release Bước 5: chế độ smoke bỏ qua E2/E3 và không sửa test (flaky → chạy lại, không E4)');
  ok(field21(rS6.body, 'Đầu vào').includes('smoke'), 'workflow-release Bước 6: Đầu vào có kết quả smoke e2e');
  ok((relWf?.agents ?? []).includes('frontend-e2e-test-writer'), 'workflow-release: frontmatter agents có frontend-e2e-test-writer');
  ok(relWf ? parseSteps(relWf.body).length === 8 : false, 'workflow-release: vẫn 8 bước');
  ok(rS6.checkpoint === true, 'workflow-release Bước 6: vẫn là checkpoint ⏸');
  ok((offeredCatalog().plugins.find((p) => p.id === 'workflows')?.skillIds ?? []).includes('workflows/workflow-release'),
    'offeredCatalog: vẫn offer workflows/workflow-release (closure agent e2e đã publish)');
  for (const rd of ['README.md', 'README_VI.md']) {
    const txt = fs.existsSync(path.join(REPO_ROOT, rd)) ? fs.readFileSync(path.join(REPO_ROOT, rd), 'utf8') : '';
    const agentRow = txt.split('\n').find((l) => l.startsWith('| `frontend-e2e-test-writer` |')) ?? '';
    const wfRow = txt.split('\n').find((l) => l.startsWith('| WF11 |')) ?? '';
    ok(agentRow.includes('WF11'), `${rd}: hàng agent frontend-e2e-test-writer có WF11`);
    ok(wfRow.includes('frontend-e2e-test-writer'), `${rd}: hàng WF11 liệt kê frontend-e2e-test-writer`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 22. SOURCE: publish data-db-migration + agent data-migration-writer + workflow-db-change (spec 2026-10-01-data-migration-writer-design)
{
  const flat22 = (t) => t.replace(/\s+/g, ' ');
  const wf22 = (id) => workflows.stages.find((s) => s.id === id);
  const step22 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { title: '', body: '', checkpoint: false };
  // Cắt đúng một trường cột 0 để assert không khớp nhầm chữ của trường khác trong cùng bước.
  const field22 = (body, name) => {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lines = body.split('\n');
    const i = lines.findIndex((l) => new RegExp(`^- \\*\\*${esc}:\\*\\*`).test(l));
    if (i < 0) return '';
    let j = lines.findIndex((l, k) => k > i && /^- \*\*/.test(l));
    if (j < 0) j = lines.length;
    return flat22(lines.slice(i, j).join('\n'));
  };
  const pub22 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_published.json'), 'utf8')).published;
  ok(pub22.includes('data/data-db-migration'), '_published.json: có data/data-db-migration (publish không chờ pilot, publish trước khi nối workflow)');
  ok(!pub22.some((e) => /^data\/data-(oltp|olap)/.test(e)), '_published.json: 4 skill data-oltp/olap vẫn draft');
  const cowork22 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_cowork.json'), 'utf8')).skills;
  ok(cowork22.includes('data:data-db-migration'), '_cowork.json: có data:data-db-migration');
  const dataMan22 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, 'data', '.manifest.json'), 'utf8'));
  ok(dataMan22.version === '1.3.0' && !dataMan22.description.includes('DRAFT') && dataMan22.description.includes('data-db-migration'),
    'data manifest: version 1.3.0, description nêu data-db-migration và không còn nhãn DRAFT');
  const dataPr22 = fs.readFileSync(path.join(PLUGINS_DIR, 'data', 'shared', 'principles.md'), 'utf8');
  ok(dataPr22.includes('data-db-migration') && flat22(dataPr22).includes('project backend') && flat22(dataPr22).includes('DB riêng của app')
    && dataPr22.includes('data-oltp-implement'),
    'data principles: nêu data-db-migration phục vụ project backend có DB riêng của app (không thuộc nhánh OLTP/OLAP)');
  const offData22 = offeredCatalog().plugins.find((p) => p.id === 'data');
  ok(!!offData22 && offData22.skillIds.includes('data/data-db-migration') && !offData22.skillIds.some((s) => /data-(oltp|olap)/.test(s)),
    'offeredCatalog: plugin data chỉ offer data/data-db-migration');
  const dmwPath = path.join(PLUGINS_DIR, 'data', 'agents', 'data-migration-writer.md');
  const dmw = fs.existsSync(dmwPath) ? fs.readFileSync(dmwPath, 'utf8') : '';
  ok(dmw.length > 0, 'data-migration-writer: có agent file');
  ok(/^mode: write$/m.test(dmw) && /^skills: "data-db-migration"$/m.test(dmw),
    'data-migration-writer: mode write, skills = data-db-migration (đúng 1 skill)');
  const dmwScope = flat22(dmw.split('## Phạm vi')[1]?.split('## Quy trình')[0] ?? '');
  ok(dmwScope.includes('kết nối DB') && dmwScope.includes('chạy migration'),
    'data-migration-writer: Phạm vi cấm kết nối DB và chạy migration');
  ok(dmwScope.includes('file migration đã có') && dmwScope.includes('repair'),
    'data-migration-writer: Phạm vi cấm sửa file migration đã có và repair/clean');
  ok(dmwScope.includes('`src/`') && dmwScope.includes('blocked') && dmwScope.includes('questions'),
    'data-migration-writer: cấm sửa src/, cần quyết định → blocked + questions');
  ok(dmw.includes('git diff --name-only') && dmw.includes('not_run'),
    'data-migration-writer: tự đối chiếu diff; validation not_run (verify do session chính)');
  ok(dmw.includes('compensating_sql') && dmw.includes('KHÔNG tạo file migration bù'),
    'data-migration-writer: Flyway forward-only → migration bù là văn bản compensating_sql trong report, không tạo file');
  ok(dmwScope.includes('do chính lượt workflow này tạo') && dmwScope.includes('đã có trên base branch'),
    'data-migration-writer: được sửa file do chính lượt workflow tạo; cấm sửa file đã có trên base branch');
  const dmwSpec = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'superpowers', 'specs', '2026-10-01-data-migration-writer-design.md'), 'utf8')
    .replace(/\r\n/g, '\n');
  const dmwBlock = dmwSpec.split('### 3.2')[1]?.split('```markdown\n')[1]?.split('\n```')[0] ?? '';
  ok(dmwBlock.length > 0 && dmwBlock.trimEnd() === dmw.replace(/\r\n/g, '\n').trimEnd(),
    'data-migration-writer: khối agent trong spec §3.2 giống hệt file agent');
  const dbc22 = wf22('workflow-db-change');
  const dS2 = step22(dbc22, 2), dS3 = step22(dbc22, 3), dS6 = step22(dbc22, 6), dS8 = step22(dbc22, 8);
  ok(field22(dS2.body, 'Thực hiện').includes('skill `data-db-migration`') && field22(dS2.body, 'Hành động').includes('change-patterns')
    && field22(dS2.body, 'Hành động').includes('lock-risk-postgres'),
    'workflow-db-change Bước 2: theo skill data-db-migration (C2), tra change-patterns và lock-risk-postgres');
  ok(field22(dS2.body, 'Đầu ra').includes('expand') && field22(dS2.body, 'Đầu ra').includes('Bước 3'),
    'workflow-db-change Bước 2: Đầu ra có kế hoạch theo pha làm đầu vào cho Bước 3');
  ok(field22(dS3.body, 'Thực hiện').includes('agent `data-migration-writer`') && field22(dS3.body, 'Thực hiện').includes('agent `backend-implementer`'),
    'workflow-db-change Bước 3: data-migration-writer (file migration) ∥ backend-implementer (code)');
  ok(field22(dS3.body, 'Hành động').includes('git status --porcelain') && field22(dS3.body, 'Hành động').includes('MỘT lần'), 'workflow-db-change Bước 3: session chính ghi mốc git status --porcelain trước khi dispatch');
  ok(field22(dS3.body, 'Ràng buộc').includes('không sửa file migration đã có') && field22(dS3.body, 'Ràng buộc').includes('không kết nối DB')
    && field22(dS3.body, 'Ràng buộc').includes('không sửa file trong thư mục migration'),
    'workflow-db-change Bước 3: file migration chỉ file MỚI, agent không kết nối DB/chạy migration');
  ok(field22(dS3.body, 'Gate').includes('file migration MỚI') && field22(dS3.body, 'Gate').includes('git ls-files --others')
    && field22(dS3.body, 'Gate').includes('đã có trên base branch') && field22(dS3.body, 'Gate').includes('nơi dùng đã xác định ở Bước 1'),
    'workflow-db-change Bước 3: Gate so diff với mốc — chỉ file migration mới + file code thuộc nơi dùng, không sửa file đã có');
  ok(field22(dS3.body, 'Khi fail').includes('blocked') && field22(dS3.body, 'Khi fail').includes('quay lại Bước 2'),
    'workflow-db-change Bước 3: agent blocked → hỏi người dùng; đổi kế hoạch → quay lại Bước 2');
  ok(field22(dS6.body, 'Thực hiện').includes('skill `data-db-migration`') && field22(dS6.body, 'Hành động').includes('verify-cycle'),
    'workflow-db-change Bước 6: chạy thử theo skill data-db-migration (C4), chu trình verify-cycle');
  ok(field22(dS3.body, 'Hành động').includes('không thành file') && field22(dS3.body, 'Evidence').includes('compensating_sql')
    && field22(dS6.body, 'Hành động').includes('report Bước 3') && field22(dS6.body, 'Hành động').includes('migration bù'),
    'workflow-db-change: migration bù của công cụ forward-only là SQL trong report Bước 3 (không thành file), Bước 6 lấy từ report');
  ok(field22(dS3.body, 'Ràng buộc').includes('R__') && field22(dS2.body, 'Đầu ra').includes('số dòng bảng bị đụng')
    && field22(dS3.body, 'Đầu vào').includes('số dòng bảng bị đụng'),
    'workflow-db-change: file migration thuộc nơi dùng Bước 1 → hỏi người dùng; số dòng bảng truyền từ Bước 2 sang Bước 3');
  ok(field22(dS8.body, 'Hành động').includes('next_actions') && field22(dS8.body, 'Hành động').includes('Bước 3'),
    'workflow-db-change Bước 8: pha contract còn nợ lấy từ next_actions của report Bước 3');
  ok(dbc22 && ['data-migration-writer', 'backend-implementer', 'backend-test-writer', 'backend-reviewer'].every((a) => dbc22.agents.includes(a))
    && dbc22.requires.includes('data/data-db-migration'),
    'workflow-db-change: frontmatter agents có data-migration-writer, requires có data/data-db-migration');
  ok(parseSteps(dbc22?.body ?? '').length === 9 && step22(dbc22, 2).checkpoint && step22(dbc22, 5).checkpoint && step22(dbc22, 9).checkpoint,
    'workflow-db-change: vẫn 9 bước, ⏸ ở Bước 2, 5, 9');
  ok(flat22(dbc22?.body.split('## Xử lý lỗi')[1]?.split('## Definition of Done')[0] ?? '').includes('Agent migration trả `blocked`'),
    'workflow-db-change: bảng lỗi có hàng agent migration trả blocked');
  ok((offeredCatalog().plugins.find((p) => p.id === 'workflows')?.skillIds ?? []).includes('workflows/workflow-db-change'),
    'offeredCatalog: vẫn offer workflows/workflow-db-change (closure data-db-migration đã publish)');
  const beImpl22 = flat22(fs.readFileSync(path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-implement', 'SKILL.md'), 'utf8'));
  ok(beImpl22.includes('`data-db-migration`') && beImpl22.includes('`backend-migrate-vault-consul`'),
    'backend-implement (S8): ranh giới trỏ đích danh data-db-migration và backend-migrate-vault-consul');
  for (const [f, head] of [['README.md', '### Agents (17)'], ['README_VI.md', '### Agent (17)']]) {
    const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
    const row = (a) => rd.split('\n').find((l) => l.startsWith(`| \`${a}\` |`)) ?? '';
    ok(rd.split('\n').some((l) => l.trim() === head), `${f}: heading ${head}`);
    ok(row('data-migration-writer').includes('WF07'), `${f}: bảng agent có data-migration-writer dùng ở WF07`);
    ok((rd.split('\n').find((l) => l.startsWith('| WF07 |')) ?? '').includes('data-migration-writer'), `${f}: WF07 liệt kê data-migration-writer`);
    ok(!/^\| G2 \|/m.test(rd), `${f}: bảng Skill gaps bỏ G2 (đã có data-db-migration)`);
    ok(!(rd.split('\n').find((l) => l.startsWith('| `data` |')) ?? '').includes('draft, not yet published') && !(rd.split('\n').find((l) => l.startsWith('| `data` |')) ?? '').includes('draft, chưa publish'),
      `${f}: hàng plugin data không còn ghi draft toàn khối`);
  }
  ok(flat22(fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8')).includes('`data-db-migration` published'),
    'CLAUDE.md: data có data-db-migration published, 4 skill còn draft');
  ok(fs.readFileSync(path.join(REPO_ROOT, 'docs', 'decisions', '0001-database-capabilities-in-data-plugin.md'), 'utf8').includes('data-migration-writer'),
    'ADR-0001: ghi cập nhật publish data-db-migration và agent data-migration-writer');
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('');
if (fails.length) {
  console.log('FAIL:');
  for (const f of fails) console.log('  ✗ ' + f);
}
console.log(`\nKẾT QUẢ: ${pass} pass, ${fails.length} fail`);
process.exit(fails.length ? 1 : 0);
