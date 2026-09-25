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
import { checkWorkflowBody, stepRefs, parseRegistry, expandWorkflowDeps, missingDeps, RISKS } from '../cli/lib/workflows.mjs';

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
  ok(mk.plugins.length === plugins.length + 1, `build: marketplace có ${plugins.length}+1 (core) entry`);

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
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('');
if (fails.length) {
  console.log('FAIL:');
  for (const f of fails) console.log('  ✗ ' + f);
}
console.log(`\nKẾT QUẢ: ${pass} pass, ${fails.length} fail`);
process.exit(fails.length ? 1 : 0);
