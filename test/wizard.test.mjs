#!/usr/bin/env node
// Test logic wizard + prompt (không cần TTY). Zero-dep. Chạy: node test/wizard.test.mjs
import { keyToAction, BACK, CANCEL, renderFrame, viewport } from '../cli/lib/prompt.mjs';
import { flattenTree, headerState, cascadeToggle } from '../cli/lib/prompt.mjs';

let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };

// keyToAction
ok(keyToAction('up', {}) === 'up', 'up -> up');
ok(keyToAction('k', {}) === 'up', 'k -> up');
ok(keyToAction('down', {}) === 'down', 'down -> down');
ok(keyToAction('j', {}) === 'down', 'j -> down');
ok(keyToAction('space', {}) === 'toggle', 'space -> toggle');
ok(keyToAction('a', {}) === 'all', 'a -> all');
ok(keyToAction('return', {}) === 'confirm', 'return -> confirm');
ok(keyToAction('b', {}) === 'back', 'b -> back');
ok(keyToAction('q', {}) === 'quit', 'q -> quit');
ok(keyToAction('escape', {}) === 'quit', 'escape -> quit');
ok(keyToAction('c', { ctrl: true }) === 'quit', 'ctrl-c -> quit');
ok(keyToAction('x', {}) === null, 'phím lạ -> null');
ok(typeof BACK === 'symbol' && typeof CANCEL === 'symbol', 'BACK/CANCEL là symbol');
ok(BACK !== CANCEL, 'BACK !== CANCEL');

// renderFrame: đếm đúng số DÒNG HIỂN THỊ kể cả title nhiều dòng (bug step 4 confirm)
{
  const f = renderFrame('a\nb', [{ label: 'x' }, { label: 'y' }], { cursor: 0, selected: new Set(), multi: false, hint: 'h' });
  ok(f.rows === f.text.split('\n').length, 'renderFrame.rows = số dòng visual của text');
  ok(f.rows === 5, 'renderFrame: title 2 dòng + 2 item + hint = 5 dòng (không undercount)');
}

// renderFrame: đếm CẢ dòng bị WRAP khi label dài hơn bề rộng terminal (bug up/down duplicate text)
{
  const f = renderFrame('t', [{ label: 'x'.repeat(50) }], { cursor: 0, selected: new Set(), multi: false, hint: 'h' }, 20);
  // width=20 · title "t"(1) + item "> "+50 = 52 ký tự → ceil(52/20)=3 + hint "h"(1) = 5 dòng visual
  ok(f.rows === 5, `renderFrame: label wrap theo width → đếm đủ visual rows (được ${f.rows}, mong đợi 5)`);
  ok(f.rows > f.text.split('\n').length, 'renderFrame: dòng wrap KHÔNG bị undercount (rows > số dòng logic)');
}

// viewport: cửa sổ cuộn giữ con trỏ trong tầm nhìn khi list dài hơn terminal
ok(JSON.stringify(viewport(3, 0, 10)) === JSON.stringify({ start: 0, end: 3 }),
  'viewport: capacity ≥ total → vẽ toàn bộ (không cắt)');
{
  const w = viewport(30, 0, 10);
  ok(w.start === 0 && w.end === 10, 'viewport: cursor ở đầu → start=0, đúng capacity');
}
{
  const w = viewport(30, 29, 10);
  ok(w.end === 30 && w.start === 20, 'viewport: cursor ở cuối → end=total (clamp), đúng capacity');
}
{
  const w = viewport(30, 15, 10);
  ok(w.start <= 15 && 15 < w.end && (w.end - w.start) === 10,
    'viewport: cursor ở giữa → nằm trong cửa sổ, giữ nguyên capacity');
}
{
  const w = viewport(30, 3, 0); // capacity xấu → không cắt (fallback an toàn)
  ok(w.start === 0 && w.end === 30, 'viewport: capacity ≤ 0 → không cắt');
}

// renderFrame với window: chỉ vẽ lát cắt [start,end) + chỉ báo còn mục trên/dưới
{
  const items = Array.from({ length: 20 }, (_, i) => ({ label: 'item' + i }));
  const f = renderFrame('t', items,
    { cursor: 10, selected: new Set(), multi: false, hint: 'h', window: { start: 6, end: 12 } });
  const lines = f.text.split('\n');
  ok(lines.some((l) => l.includes('item6')) && lines.some((l) => l.includes('item11')),
    'renderFrame window: vẽ item trong [start,end)');
  ok(!lines.some((l) => l.includes('item0')) && !lines.some((l) => l.includes('item19')),
    'renderFrame window: KHÔNG vẽ item ngoài cửa sổ');
  ok(lines.some((l) => l.includes('↑')) && lines.some((l) => l.includes('↓')),
    'renderFrame window: có chỉ báo còn mục trên/dưới');
}

// selectTree phần thuần: flattenTree / headerState / cascadeToggle
const GROUPS = [
  { plugin: 'core', label: 'core', skills: [
    { value: 'core/principles', label: 'principles', locked: true },
    { value: 'core/git-workflow', label: 'git-workflow' } ] },
  { plugin: 'backend', label: 'backend', skills: [
    { value: 'backend/backend-init', label: 'backend-init' },
    { value: 'backend/backend-testing', label: 'backend-testing' } ] },
];

{
  const rows = flattenTree(GROUPS);
  ok(rows[0].type === 'header' && rows[0].groupIndex === 0, 'flattenTree: dòng 0 là header core');
  ok(rows.filter((r) => r.type === 'skill').length === 4, 'flattenTree: 4 skill rows');
}
{
  ok(headerState(GROUPS[1], new Set(['backend/backend-init', 'backend/backend-testing'])) === 'full',
    'headerState: đủ con → full');
  ok(headerState(GROUPS[1], new Set(['backend/backend-init'])) === 'partial', 'headerState: một phần → partial');
  ok(headerState(GROUPS[1], new Set()) === 'empty', 'headerState: rỗng → empty');
}
{
  const sel = new Set(['core/principles']);
  cascadeToggle(sel, GROUPS[0]);
  ok(sel.has('core/git-workflow'), 'cascadeToggle: bật toàn nhóm');
  cascadeToggle(sel, GROUPS[0]);
  ok(!sel.has('core/git-workflow') && sel.has('core/principles'),
    'cascadeToggle: tắt nhóm nhưng giữ locked (principles)');
}

import { runWizard } from '../cli/lib/wizard.mjs';

// Stub prompt: trả lần lượt theo kịch bản đã nạp.
function stub(script) {
  const calls = [...script];
  return () => Promise.resolve(calls.shift());
}
// Catalog nguồn giả: core (principles KHOÁ + git-workflow) + backend 2 skill.
const CATALOG = { plugins: [
  { id: 'core', skillIds: ['core/principles', 'core/git-workflow'] },
  { id: 'backend', skillIds: ['backend/backend-init', 'backend/backend-testing'] },
] };
// Cài sẵn (project): claude có backend-init + baseline; cursor có backend-testing. skills = tập hiệu lực
// (gồm generated backend-principles) như check() thật trả về — cây wizard tự bỏ id không nằm trong catalog.
const INSTALLED_PROJECT = [
  { provider: 'claude', plugins: [], mode: 'skills',
    skills: ['core/principles', 'core/git-workflow', 'backend/backend-init', 'backend/backend-principles'] },
  { provider: 'cursor', plugins: [], mode: 'skills',
    skills: ['core/principles', 'backend/backend-testing', 'backend/backend-principles'] },
];

function makeDeps({ one = [], many = [], confirm = [], tree = [], catalog = CATALOG, installsFor } = {}) {
  const o = stub(one), m = stub(many), c = stub(confirm), t = stub(tree);
  const treeCalls = [];
  const installs = installsFor || ((scope) => (scope === 'project' ? INSTALLED_PROJECT : []));
  return {
    selectOne: () => o(), selectMany: () => m(), confirmStep: () => c(),
    selectTree: (_title, groups, opts = {}) => { treeCalls.push({ groups, opts }); return Promise.resolve(t()); },
    _treeCalls: treeCalls,
    PROVIDERS: ['claude', 'cursor', 'codex'], // antigravity pending — không offer trong wizard
    knownPluginIds: () => ['backend', 'frontend', 'data'],
    offeredCatalog: () => catalog,
    check: ({ scope }) => ({ installs: installs(scope) }),
  };
}

// install: scope -> providers -> skills (cây gộp plugin) -> (kiểu cài claude) -> confirm
{
  const deps = makeDeps({ one: ['project', 'skills'], many: [['claude']],
    tree: [['core/git-workflow', 'backend/backend-init']], confirm: [true] });
  const r = await runWizard('install', deps);
  ok(r && r.action === 'install' && r.scope === 'project' && r.mode === 'skills'
    && JSON.stringify(r.plugins) === '[]'
    && JSON.stringify(r.skills) === '["core/git-workflow","backend/backend-init"]'
    && JSON.stringify(r.providers) === '["claude"]',
    'install: ráp đúng action object (plugins=[], skills từ cây, claude→skills)');
}

// install: preselect cây = core/git-workflow (default) ∪ skill đã cài của provider; core/principles KHOÁ trong groups
{
  const deps = makeDeps({ one: ['project', 'skills'], many: [['claude']],
    tree: [['core/git-workflow', 'backend/backend-init']], confirm: [true] });
  await runWizard('install', deps);
  const call = deps._treeCalls[0];
  const pre = new Set(call.opts.preselected);
  ok(pre.has('core/git-workflow'), 'install: preselect có core/git-workflow (default baseline)');
  ok(pre.has('backend/backend-init'), 'install: preselect có skill đã cài của claude (backend-init)');
  const coreGroup = call.groups.find((g) => g.plugin === 'core');
  const principles = coreGroup.skills.find((s) => s.value === 'core/principles');
  ok(principles && principles.locked === true, 'install: core/principles là con KHOÁ trong cây');
  ok(call.opts.min === 1, 'install: cây skill min=1');
  // Cây phải dựng từ offeredCatalog (đã lọc published), KHÔNG phải skillCatalog đầy đủ.
  ok(JSON.stringify(call.groups.map((g) => g.plugin)) === '["core","backend"]',
    'install: cây skill chỉ gồm plugin trong offeredCatalog (đã lọc published)');
}

// install: claude chọn kiểu plugin -> mode='plugin'
{
  const deps = makeDeps({ one: ['project', 'plugin'], many: [['claude']],
    tree: [['core/git-workflow', 'backend/backend-init']], confirm: [true] });
  const r = await runWizard('install', deps);
  ok(r && r.mode === 'plugin', 'install: claude chọn kiểu cài plugin → mode=plugin');
}

// install: KHÔNG chọn claude -> không hỏi kiểu cài (selectOne chỉ tiêu cho scope), mode mặc định 'skills'
{
  const deps = makeDeps({ one: ['project'], many: [['cursor']],
    tree: [['backend/backend-testing']], confirm: [true] });
  const r = await runWizard('install', deps);
  ok(r && r.mode === 'skills' && JSON.stringify(r.providers) === '["cursor"]',
    'install: không claude → mode=skills (bỏ qua bước kiểu cài)');
}

// back: skills trả BACK -> quay lại providers (giữ), chọn lại -> tiếp
{
  const { BACK } = await import('../cli/lib/prompt.mjs');
  const deps = makeDeps({ one: ['project', 'skills'], many: [['claude'], ['claude']],
    tree: [BACK, ['core/git-workflow', 'backend/backend-init']], confirm: [true] });
  const r = await runWizard('install', deps);
  ok(r && JSON.stringify(r.skills) === '["core/git-workflow","backend/backend-init"]',
    'install: back ở skills quay lại providers, chọn lại OK');
}

// cancel: bước đầu (scope) BACK -> null
{
  const { BACK } = await import('../cli/lib/prompt.mjs');
  const deps = makeDeps({ one: [BACK] });
  const r = await runWizard('install', deps);
  ok(r === null, 'install: BACK ở bước đầu (scope) -> huỷ (null)');
}

// CANCEL giữa luồng (providers q huỷ) -> null
{
  const { CANCEL } = await import('../cli/lib/prompt.mjs');
  const deps = makeDeps({ one: ['project'], many: [CANCEL] });
  const r = await runWizard('install', deps);
  ok(r === null, 'install: CANCEL giữa luồng (providers) -> null');
}

// uninstall: scope project -> chọn skill đã cài -> confirm; providers suy từ entry chứa skill
{
  const deps = makeDeps({ one: ['project'], tree: [['backend/backend-init']], confirm: [true] });
  const r = await runWizard('uninstall', deps);
  ok(r && r.action === 'uninstall' && JSON.stringify(r.skills) === '["backend/backend-init"]'
    && JSON.stringify(r.providers) === '["claude"]' && r.scope === 'project',
    'uninstall: chọn skill đã cài, providers suy đúng (claude giữ backend-init)');
}

// uninstall: groups CHỈ gồm skill gỡ được (bỏ core/principles + generated backend-principles), gộp theo plugin
{
  const deps = makeDeps({ one: ['project'], tree: [['backend/backend-init']], confirm: [true] });
  await runWizard('uninstall', deps);
  const groups = deps._treeCalls[0].groups;
  const all = groups.flatMap((g) => g.skills.map((s) => s.value));
  ok(!all.includes('core/principles') && !all.includes('backend/backend-principles'),
    'uninstall: cây loại core/principles + generated backend-principles');
  ok(all.includes('backend/backend-init') && all.includes('backend/backend-testing'),
    'uninstall: cây gồm skill nguồn đã cài (union claude+cursor)');
  ok(!groups.some((g) => g.skills.some((s) => s.locked)), 'uninstall: cây không có mục khoá');
}

// uninstall: chọn skill có ở CẢ hai provider -> providers gồm cả claude+cursor
{
  const deps = makeDeps({ one: ['project'],
    tree: [['backend/backend-init', 'backend/backend-testing']], confirm: [true] });
  const r = await runWizard('uninstall', deps);
  ok(r && JSON.stringify(r.providers.sort()) === '["claude","cursor"]',
    'uninstall: providers = mọi provider chứa skill vừa chọn');
}

// uninstall: scope global -> manifest rỗng -> null (không có skill gỡ được)
{
  const deps = makeDeps({ one: ['global'] });
  const r = await runWizard('uninstall', deps);
  ok(r === null, 'uninstall: manifest rỗng -> null');
}

// uninstall: scope CHỈ có plugin-mode -> bỏ bước skill, chọn plugin để gỡ (pluginModeRemovals)
{
  const pmInstalls = [{ provider: 'claude', mode: 'plugin', plugins: ['backend', 'frontend'] }];
  const deps = makeDeps({ one: ['project'], many: [['claude::backend']], confirm: [true],
    installsFor: (scope) => (scope === 'project' ? pmInstalls : []) });
  const r = await runWizard('uninstall', deps);
  ok(r && r.action === 'uninstall' && JSON.stringify(r.skills) === '[]'
    && JSON.stringify(r.pluginModeRemovals) === JSON.stringify([{ provider: 'claude', plugins: ['backend'] }]),
    'uninstall pure-plugin-mode: skills rỗng, pluginModeRemovals gom theo provider');
}

// uninstall: mixed copy + plugin-mode -> hai loại tách riêng, đúng provider
{
  const mixed = [
    { provider: 'cursor', mode: 'skills', skills: ['core/principles', 'backend/backend-init', 'backend/backend-principles'] },
    { provider: 'claude', mode: 'plugin', plugins: ['frontend'] },
  ];
  const deps = makeDeps({ one: ['project'], tree: [['backend/backend-init']],
    many: [['claude::frontend']], confirm: [true],
    installsFor: (scope) => (scope === 'project' ? mixed : []) });
  const r = await runWizard('uninstall', deps);
  ok(r && JSON.stringify(r.skills) === '["backend/backend-init"]'
    && JSON.stringify(r.providers) === '["cursor"]'
    && JSON.stringify(r.pluginModeRemovals) === JSON.stringify([{ provider: 'claude', plugins: ['frontend'] }]),
    'uninstall mixed: copy-mode theo skill + plugin-mode theo provider, không lẫn');
}

// update: scope -> cây skill -> confirm; chọn LẺ 1 skill -> filter skills đúng
{
  const deps = makeDeps({ one: ['project'], tree: [['backend/backend-init']], confirm: [true] });
  const r = await runWizard('update', deps);
  ok(r && r.action === 'update' && r.scope === 'project'
    && JSON.stringify(r.skills) === '["backend/backend-init"]',
    'update: chọn lẻ skill -> {action:update, scope, skills:[backend-init]}');
}

// update: cây skill preselect TẤT CẢ (mặc định = update mọi entry)
{
  const deps = makeDeps({ one: ['project'], tree: [['backend/backend-init']], confirm: [true] });
  await runWizard('update', deps);
  const call = deps._treeCalls[0];
  const all = call.groups.flatMap((g) => g.skills.map((s) => s.value));
  ok(all.length > 0 && call.opts.preselected.length === all.length,
    'update: cây preselect tất cả skill đã cài (mặc định update hết)');
  ok(!all.includes('core/principles') && !all.includes('backend/backend-principles'),
    'update: cây loại baseline principles (không tách lẻ được)');
}

// update: chọn cả nhóm (nguyên plugin) -> skills gồm mọi skill của plugin đó
{
  const deps = makeDeps({ one: ['project'],
    tree: [['backend/backend-init', 'backend/backend-testing']], confirm: [true] });
  const r = await runWizard('update', deps);
  ok(r && r.skills.includes('backend/backend-init') && r.skills.includes('backend/backend-testing'),
    'update: chọn nguyên plugin -> skills gồm mọi skill của plugin');
}

// update: scope global (manifest rỗng) -> null (không có gì để update)
{
  const deps = makeDeps({ one: ['global'] });
  const r = await runWizard('update', deps);
  ok(r === null, 'update: manifest rỗng -> null');
}

// update: BACK ở bước scope -> huỷ (null)
{
  const { BACK } = await import('../cli/lib/prompt.mjs');
  const deps = makeDeps({ one: [BACK] });
  const r = await runWizard('update', deps);
  ok(r === null, 'update: BACK ở bước đầu -> null');
}

console.log('');
if (fails.length) { console.log('FAIL:'); for (const f of fails) console.log('  ✗ ' + f); }
console.log(`\nWIZARD TEST: ${pass} pass, ${fails.length} fail`);
process.exit(fails.length ? 1 : 0);
