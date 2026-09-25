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
