#!/usr/bin/env node
// Test round-trip: install -> check -> uninstall vào thư mục tạm (AIE_INSTALL_ROOT).
// Zero-dependency. Chạy: node test/install.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isLink = (p) => { try { fs.readlinkSync(p); return true; } catch { return false; } };

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-test-'));
process.env.AIE_INSTALL_ROOT = TMP;

const { install, uninstall, update, check, linkDisabledForRoot, claudePluginCommands,
  claudePluginRefreshCommands, claudeCliScope, marketplacesToRemove,
  skillCatalog, allSkillsOf, resolveSelection, effectiveSkills, pluginsFromSelection,
  normFilter, entryMatches, offeredCatalog, publishedPluginIds } =
  await import('../cli/lib/install.mjs');
const { zipBuffer, coworkSkillIds, coworkBuildSet, pack } = await import('../cli/lib/pack.mjs');
const { wizardReportModel, renderWizardReportMd } = await import('../cli/lib/report.mjs');
const { normalizePublished } = await import('../cli/lib/plugins.mjs');
const { parse } = await import('../cli/lib/args.mjs');

let pass = 0;
const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };
const exists = (rel) => fs.existsSync(path.join(TMP, rel));

// ── unit: phát hiện môi trường npm (node_modules) ──────────────────────────
ok(linkDisabledForRoot('/home/u/app/node_modules/cowork-code-workflow-kit') === true,
  'linkDisabledForRoot: posix node_modules → true');
ok(linkDisabledForRoot('C:\\Users\\u\\AppData\\Roaming\\npm\\node_modules\\cwk') === true,
  'linkDisabledForRoot: windows node_modules → true');
ok(linkDisabledForRoot('E:\\Company\\IOC\\Shared\\cowork-code-workflow-kit') === false,
  'linkDisabledForRoot: repo thường (win) → false');
ok(linkDisabledForRoot('/home/u/dev/cowork-code-workflow-kit') === false,
  'linkDisabledForRoot: repo thường (posix) → false');

// ── unit: claude plugin-mode command builder (PURE — KHÔNG exec `claude`) ────
ok(claudeCliScope('global') === 'user' && claudeCliScope('project') === 'project',
  'claudeCliScope: global→user, project→project');
{
  const c = claudePluginCommands({
    pluginIds: ['backend', 'frontend'], scope: 'global',
    marketplaceName: 'cowork-code-workflow-kit', marketplaceDir: '/x/build/claude',
  });
  ok(c.cliScope === 'user', 'pluginCmds: scope global → --scope user');
  ok(JSON.stringify(c.add) === JSON.stringify(['plugin', 'marketplace', 'add', '/x/build/claude', '--scope', 'user']),
    'pluginCmds: "marketplace add <dir> --scope user" đúng argv');
  ok(c.installs.length === 2
    && JSON.stringify(c.installs[0]) === JSON.stringify(['plugin', 'install', 'backend@cowork-code-workflow-kit', '--scope', 'user']),
    'pluginCmds: "install <id>@<mkt> --scope user" đúng argv');
  ok(!c.installs.some((a) => a.some((t) => t === 'core@cowork-code-workflow-kit')),
    'pluginCmds: KHÔNG install core tường minh (tự kéo qua dependency "core")');
  // FORCE core tươi khi cài: làm mới snapshot + gỡ core cũ để domain kéo lại core tươi (bust version-cache)
  ok(JSON.stringify(c.marketplaceUpdate) === JSON.stringify(['plugin', 'marketplace', 'update', 'cowork-code-workflow-kit']),
    'pluginCmds: có "marketplace update <mkt>" (làm mới snapshot trước khi cài)');
  ok(JSON.stringify(c.coreUninstall) === JSON.stringify(['plugin', 'uninstall', 'core@cowork-code-workflow-kit', '--scope', 'user', '-y']),
    'pluginCmds: có "uninstall core -y" (bust cache core cũ → domain kéo lại core tươi)');
  ok(JSON.stringify(c.uninstalls[1]) === JSON.stringify(['plugin', 'uninstall', 'frontend@cowork-code-workflow-kit', '--scope', 'user', '-y']),
    'pluginCmds: "uninstall …@… --scope user -y" (non-interactive, có -y)');
  ok(JSON.stringify(c.marketplaceRemove) === JSON.stringify(['plugin', 'marketplace', 'remove', 'cowork-code-workflow-kit', '--scope', 'user']),
    'pluginCmds: "marketplace remove <mkt> --scope user" đúng argv');
}

// ── unit: claudePluginRefreshCommands (PURE) — update plugin-mode phải FORCE re-copy ─────────
// Root cause đã xác nhận: cache Claude key theo VERSION; kit không bump version → `plugin install`/
// `plugin update` no-op ("already at latest 1.0.0") dù nội dung đổi. Refresh đúng = marketplace update
// + uninstall + install từng plugin (force re-copy từ build/claude). BẮT BUỘC gồm core (prepend):
// core chỉ được kéo qua dependency lúc install nên KHÔNG bao giờ tự re-copy → skill dùng chung mới
// của core (git-workflow) không tới Claude nếu update bỏ sót core.
{
  const c = claudePluginRefreshCommands({
    pluginIds: ['backend', 'frontend'], scope: 'global', marketplaceName: 'cowork-code-workflow-kit',
  });
  ok(JSON.stringify(c.marketplaceUpdate) === JSON.stringify(['plugin', 'marketplace', 'update', 'cowork-code-workflow-kit']),
    'refreshCmds: "marketplace update <mkt>" đúng argv');
  ok(c.pairs.length === 3 && c.pairs[0].id === 'core',
    'refreshCmds: core được refresh TƯỜNG MINH và ĐỨNG TRƯỚC (dependency trước domain plugin)');
  ok(JSON.stringify(c.pairs[0].uninstall) === JSON.stringify(['plugin', 'uninstall', 'core@cowork-code-workflow-kit', '--scope', 'user', '-y'])
    && JSON.stringify(c.pairs[0].install) === JSON.stringify(['plugin', 'install', 'core@cowork-code-workflow-kit', '--scope', 'user']),
    'refreshCmds: core = cặp uninstall(-y) rồi install (force re-copy, scope user khi global)');
  ok(JSON.stringify(c.pairs[1].uninstall).includes('backend@cowork-code-workflow-kit')
    && JSON.stringify(c.pairs[2].uninstall).includes('frontend@cowork-code-workflow-kit'),
    'refreshCmds: đủ mọi domain plugin trong entry sau core');
}
// dedup: nếu ai đó truyền core sẵn trong pluginIds thì KHÔNG nhân đôi
{
  const c = claudePluginRefreshCommands({
    pluginIds: ['core', 'backend'], scope: 'project', marketplaceName: 'mkt',
  });
  ok(c.pairs.length === 2 && c.pairs.filter((p) => p.id === 'core').length === 1,
    'refreshCmds: core truyền sẵn → dedup, không nhân đôi');
}

// ── unit: marketplacesToRemove (PURE) — chỉ gỡ marketplace khi không còn entry giữ lại dùng ──
{
  const MKT = 'cowork-code-workflow-kit';
  const rem = [{ mode: 'plugin', marketplace: MKT, plugins: ['backend'] }];
  const keepSame = [{ mode: 'plugin', marketplace: MKT, plugins: ['frontend'] }];
  ok(marketplacesToRemove(rem, keepSame).size === 0,
    'mktToRemove: còn entry giữ lại cùng marketplace → KHÔNG gỡ marketplace');
  ok(marketplacesToRemove(rem, []).has(MKT),
    'mktToRemove: gỡ entry cuối, hết plugin → gỡ marketplace');
  ok(marketplacesToRemove([{ provider: 'claude', plugins: ['x'] }], []).size === 0,
    'mktToRemove: entry skills (không mode plugin) → không gỡ marketplace');
  // gỡ 2 entry cùng marketplace, không giữ lại entry nào → marketplace xuất hiện đúng 1 lần
  const rem2 = [{ mode: 'plugin', marketplace: MKT, plugins: ['backend'] }, { mode: 'plugin', marketplace: MKT, plugins: ['frontend'] }];
  ok(marketplacesToRemove(rem2, []).size === 1 && marketplacesToRemove(rem2, []).has(MKT),
    'mktToRemove: nhiều entry cùng marketplace → Set gộp 1 lần');
}

// ── unit: skillCatalog + allSkillsOf (PURE) ──────────────────────────────────
{
  const cat = skillCatalog();
  ok(cat.plugins[0].id === 'core', 'skillCatalog: core đứng đầu');
  ok(cat.plugins.some((p) => p.id === 'backend'), 'skillCatalog: có backend');
  const be = cat.plugins.find((p) => p.id === 'backend');
  ok(be.skillIds.includes('backend/backend-init'), 'skillCatalog: backend gồm backend/backend-init');
  ok(!be.skillIds.some((s) => s.endsWith('/backend-principles')),
    'skillCatalog: KHÔNG liệt kê generated backend-principles');
  ok(allSkillsOf('backend').includes('backend/backend-init')
    && allSkillsOf('backend').every((s) => s.startsWith('backend/')),
    'allSkillsOf: trả plugin/skill của đúng plugin');
  ok(allSkillsOf('core').includes('core/principles'), 'allSkillsOf: core gồm principles');
}

// ── unit: normalizePublished — parse "plugin" (cả plugin) vs "plugin/skill" (skill lẻ) ──
{
  const m = normalizePublished(['backend', 'frontend/frontend-init', 'frontend/frontend-implement']);
  ok(m.backend === '*', 'normalizePublished: "plugin" → cả plugin (*)');
  ok(Array.isArray(m.frontend) && m.frontend.length === 2 && m.frontend.includes('frontend/frontend-init'),
    'normalizePublished: "plugin/skill" → mảng skill lẻ');
  ok(normalizePublished('x') === null, 'normalizePublished: không phải mảng → null');
  const star = normalizePublished(['frontend/frontend-init', 'frontend']);
  ok(star.frontend === '*', 'normalizePublished: có "plugin" thì "*" đè entry lẻ cùng plugin');
}

// ── unit: publishedPluginIds + offeredCatalog (đọc plugins/_published.json) ──
// offeredCatalog = tập plugin wizard được phép offer (published-only); skillCatalog vẫn đầy đủ để
// dev cài draft bằng --plugin và để build/cowork/validate không đổi.
{
  const pub = publishedPluginIds();
  ok(pub.includes('backend') && pub.includes('frontend') && pub.includes('engineering'),
    'publishedPluginIds: gồm backend, frontend, engineering');
  ok(!pub.includes('data') && !pub.includes('ops'),
    'publishedPluginIds: KHÔNG gồm plugin chưa publish (data, ops)');
  const offered = offeredCatalog().plugins.map((p) => p.id);
  ok(offered[0] === 'core', 'offeredCatalog: core đứng đầu');
  ok(offered.includes('backend') && offered.includes('frontend') && offered.includes('engineering'),
    'offeredCatalog: gồm 3 plugin đã publish');
  ok(!offered.includes('data') && !offered.includes('ops'),
    'offeredCatalog: ẩn plugin chưa publish khỏi wizard');
  ok(skillCatalog().plugins.some((p) => p.id === 'data'),
    'skillCatalog: vẫn liệt kê plugin chưa publish (gate flag cho dev)');
  // per-skill: publish một phần → chỉ offer skill lẻ trong plugin (map inject để test độc lập file)
  const partial = offeredCatalog({ backend: '*', frontend: ['frontend/frontend-init'] });
  const fe = partial.plugins.find((p) => p.id === 'frontend');
  const bep = partial.plugins.find((p) => p.id === 'backend');
  ok(fe && fe.skillIds.length === 1 && fe.skillIds[0] === 'frontend/frontend-init',
    'offeredCatalog per-skill: frontend chỉ offer đúng skill lẻ đã publish');
  ok(bep && bep.skillIds.length > 1, 'offeredCatalog per-skill: backend "*" vẫn offer mọi skill');
  ok(!partial.plugins.some((p) => p.id === 'engineering'),
    'offeredCatalog per-skill: plugin ngoài map → không offer');
  ok(publishedPluginIds({ frontend: ['frontend/frontend-init'] }).includes('frontend'),
    'publishedPluginIds per-skill: plugin có skill lẻ vẫn tính published');
}

// ── unit: wizardReportModel — report "phần nào cài được qua wizard" (offered vs draft) ──
{
  const m = wizardReportModel();
  const offeredIds = m.offered.map((e) => e.id);
  ok(offeredIds[0] === 'core', 'report: core đứng đầu offered');
  ok(['backend', 'frontend', 'engineering'].every((id) => offeredIds.includes(id)),
    'report: offered gồm mọi plugin đã publish');
  ok(m.draft.some((e) => e.id === 'data') && !offeredIds.includes('data'),
    'report: data nằm ở draft, KHÔNG ở offered');
  const be = m.offered.find((e) => e.id === 'backend');
  ok(be.published === true && be.skills.includes('backend/backend-init'),
    'report: entry offered có cờ published + danh sách skill');
  // per-skill: publish một phần → offered.partial + chỉ skill lẻ; plugin ngoài map → draft
  const mp = wizardReportModel({ published: { frontend: ['frontend/frontend-init'] } });
  const feR = mp.offered.find((e) => e.id === 'frontend');
  ok(feR && feR.partial === true && feR.skills.length === 1 && feR.skills[0] === 'frontend/frontend-init',
    'report per-skill: frontend offered một phần đúng skill lẻ');
  ok(mp.draft.some((e) => e.id === 'backend'), 'report per-skill: plugin ngoài map → draft');
  // published=null (chưa cấu hình) → mọi plugin offered, draft rỗng (tương thích ngược)
  const mAll = wizardReportModel({ published: null });
  ok(mAll.draft.length === 0 && mAll.offered.some((e) => e.id === 'data'),
    'report: published=null → offer tất cả (không có draft)');
  // Markdown render có tiêu đề + tên plugin
  const md = renderWizardReportMd(m, '2026-01-01T00:00:00.000Z');
  ok(md.includes('# ') && md.includes('backend') && md.includes('data'),
    'report: markdown có tiêu đề + liệt kê plugin offered lẫn draft');
}

// ── unit: resolveSelection (PURE) ────────────────────────────────────────────
{
  // chọn đủ mọi con của một plugin → quy về khối (plugins), skills rỗng phần đó
  const whole = resolveSelection({ skills: allSkillsOf('backend') });
  ok(whole.plugins.includes('backend') && !whole.skills.some((s) => s.startsWith('backend/')),
    'resolveSelection: đủ mọi con → plugins=[backend], skills không lặp lại con backend');
  // chọn một phần → skills lẻ, không vào plugins
  const partial = resolveSelection({ skills: ['backend/backend-init'] });
  ok(!partial.plugins.includes('backend') && partial.skills.includes('backend/backend-init'),
    'resolveSelection: một phần → skills lẻ, không nguyên khối');
  // --plugin nguyên khối
  const byPlugin = resolveSelection({ plugins: ['frontend'] });
  ok(byPlugin.plugins.includes('frontend'), 'resolveSelection: --plugin → plugins');
  // skill trần suy plugin duy nhất
  const bare = resolveSelection({ skills: ['backend-init'] });
  ok(bare.skills.includes('backend/backend-init') || bare.plugins.includes('backend'),
    'resolveSelection: skill trần suy được plugin');
  // dedup: skill nằm trong khối đã chọn → bỏ khỏi skills
  const dd = resolveSelection({ plugins: ['backend'], skills: ['backend/backend-init'] });
  ok(!dd.skills.includes('backend/backend-init'),
    'resolveSelection: skill đã trong khối → dedup khỏi skills');
  // id lạ → ném
  let threw = false;
  try { resolveSelection({ skills: ['backend/khong-ton-tai'] }); } catch { threw = true; }
  ok(threw, 'resolveSelection: skill không tồn tại → ném lỗi');
}

// ── unit: normFilter + entryMatches (PURE) — trục lọc dùng chung uninstall/update ──
{
  ok(normFilter(undefined) === null && normFilter([]) === null,
    'normFilter: undefined/[] → null (không lọc trục này)');
  ok(normFilter('all', true) === null, "normFilter: 'all' (all=true) → null");
  ok(JSON.stringify(normFilter('all')) === '["all"]',
    "normFilter: 'all' khi all=false → giữ nguyên (không coi là bỏ lọc)");
  ok(JSON.stringify(normFilter('cursor')) === '["cursor"]', 'normFilter: string → [string]');
  ok(JSON.stringify(normFilter(['a', 'b'])) === '["a","b"]', 'normFilter: array giữ nguyên');

  const e = { provider: 'cursor', plugins: ['core'], skills: ['backend/backend-init'] };
  ok(entryMatches(e, null, null, null), 'entryMatches: mọi trục null → khớp (không lọc)');
  ok(entryMatches(e, ['cursor'], null, null), 'entryMatches: đúng provider → khớp');
  ok(!entryMatches(e, ['claude'], null, null), 'entryMatches: sai provider → trượt');
  ok(entryMatches(e, null, ['backend'], null),
    'entryMatches: plugin khớp qua prefix skill lẻ (plugins=[core] nhưng có backend/*)');
  ok(!entryMatches(e, null, ['frontend'], null), 'entryMatches: plugin không có → trượt');
  ok(entryMatches(e, null, null, ['backend/backend-init']), 'entryMatches: skill khớp theo tập hiệu lực');
}

// ── plugin-mode: suy tập plugin từ skill lẻ (PURE) ───────────────────────────
{
  const ids = pluginsFromSelection({ plugins: ['frontend'], skills: ['backend/backend-init'] });
  ok(ids.includes('frontend') && ids.includes('backend') && new Set(ids).size === ids.length,
    'pluginsFromSelection: gộp plugin của khối + plugin của skill lẻ, dedup');
}

// ── unit: effectiveSkills (PURE) — ép core/principles + generated <id>-principles + compat ──
{
  // entry nguyên khối backend
  const eWhole = effectiveSkills({ plugins: ['backend'], skills: [] });
  ok(eWhole.has('core/principles'), 'effective: LUÔN có core/principles (ép bật)');
  ok(eWhole.has('backend/backend-init'), 'effective: gồm skill nguồn của khối backend');
  ok(eWhole.has('backend/backend-principles'),
    'effective: khối backend → kèm generated backend-principles (baseline)');
  // entry skill lẻ: chỉ 1 skill của backend
  const ePartial = effectiveSkills({ plugins: [], skills: ['backend/backend-init'] });
  ok(ePartial.has('backend/backend-init'), 'effective: có skill lẻ đã chọn');
  ok(ePartial.has('backend/backend-principles'),
    'effective: plugin active dù chỉ 1 skill → vẫn kèm backend-principles');
  ok(!ePartial.has('backend/backend-testing'), 'effective: skill lẻ KHÔNG kéo skill anh em');
  ok(ePartial.has('core/principles'), 'effective: vẫn ép core/principles');
  // backward-compat: entry cũ chỉ có plugins, không field skills
  const eCompat = effectiveSkills({ plugins: ['frontend'] });
  ok(eCompat.has('frontend/frontend-init') && eCompat.has('frontend/frontend-principles'),
    'effective: entry cũ (thiếu skills) mở rộng nguyên khối như hôm nay');
}

// ── additive: cài cùng provider 2 lần -> CỘNG DỒN plugin (không thay thế) ─────
{
  const TMP_ADD = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-add-'));
  process.env.AIE_INSTALL_ROOT = TMP_ADD;
  install({ providers: 'claude', plugins: 'backend', scope: 'project' });
  install({ providers: 'claude', plugins: 'frontend', scope: 'project' });
  const E = (rel) => fs.existsSync(path.join(TMP_ADD, rel));
  ok(E('.claude/skills/backend-init/SKILL.md') && E('.claude/skills/frontend-init/SKILL.md'),
    'additive: cài backend rồi frontend → cả hai cùng tồn tại (không thay thế)');
  const mf = JSON.parse(fs.readFileSync(path.join(TMP_ADD, '.ai-engineering/manifest.json'), 'utf8'));
  const claudeEntry = mf.installs.find((e) => e.provider === 'claude');
  ok(claudeEntry && claudeEntry.plugins.includes('backend') && claudeEntry.plugins.includes('frontend'),
    'additive: manifest entry claude gộp [backend, frontend]');
  fs.rmSync(TMP_ADD, { recursive: true, force: true });
  process.env.AIE_INSTALL_ROOT = TMP; // khôi phục cho round-trip
}

// ── skill-granular: cài LẺ 1 skill → chỉ skill đó (+ baseline principles) ─────
{
  const TMP_S = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-skill-'));
  process.env.AIE_INSTALL_ROOT = TMP_S;
  install({ providers: 'claude', skills: ['backend/backend-init'], scope: 'project' });
  const E = (rel) => fs.existsSync(path.join(TMP_S, rel));
  ok(E('.claude/skills/backend-init/SKILL.md'), 'skill-lẻ: backend-init được cài');
  ok(!E('.claude/skills/backend-testing/SKILL.md'), 'skill-lẻ: backend-testing KHÔNG được cài');
  ok(E('.claude/skills/principles/SKILL.md'), 'skill-lẻ: core principles vẫn ép bật');
  ok(E('.claude/skills/backend-principles/SKILL.md'), 'skill-lẻ: backend-principles baseline vẫn kèm');
  const mf = JSON.parse(fs.readFileSync(path.join(TMP_S, '.ai-engineering/manifest.json'), 'utf8'));
  const ce = mf.installs.find((e) => e.provider === 'claude');
  ok(ce.skills.includes('backend/backend-init') && !ce.plugins.includes('backend'),
    'skill-lẻ: manifest ghi skills=[backend/backend-init], KHÔNG nguyên khối');
  fs.rmSync(TMP_S, { recursive: true, force: true });
  process.env.AIE_INSTALL_ROOT = TMP;
}

// ── partial uninstall: entry nhiều plugin, gỡ 1 plugin -> GIỮ phần còn lại ────
{
  const TMP_P = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-partial-'));
  process.env.AIE_INSTALL_ROOT = TMP_P;
  install({ providers: 'claude', plugins: ['backend', 'frontend'], scope: 'project' });
  uninstall({ providers: 'claude', plugins: 'backend', scope: 'project' });
  const E = (rel) => fs.existsSync(path.join(TMP_P, rel));
  ok(!E('.claude/skills/backend-init/SKILL.md'), 'partial uninstall: backend đã gỡ');
  ok(E('.claude/skills/frontend-init/SKILL.md'), 'partial uninstall: frontend còn lại');
  const mf = JSON.parse(fs.readFileSync(path.join(TMP_P, '.ai-engineering/manifest.json'), 'utf8'));
  const ce = mf.installs.find((e) => e.provider === 'claude');
  ok(ce && ce.plugins.includes('frontend') && !ce.plugins.includes('backend'),
    'partial uninstall: manifest còn frontend, hết backend');
  fs.rmSync(TMP_P, { recursive: true, force: true });
  process.env.AIE_INSTALL_ROOT = TMP;
}

// ── skill-granular: gỡ LẺ 1 skill của một khối → giữ các skill còn lại ────────
// Khối backend "vỡ" thành skills lẻ (8 skill trừ 1); core vẫn whole (default-whole-core) nên
// git-workflow + principles còn nguyên.
{
  const TMP_RU = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-skill-rm-'));
  process.env.AIE_INSTALL_ROOT = TMP_RU;
  install({ providers: 'claude', plugins: 'backend', scope: 'project' }); // nguyên khối
  uninstall({ providers: 'claude', skills: ['backend/backend-testing'], scope: 'project' });
  const E = (rel) => fs.existsSync(path.join(TMP_RU, rel));
  ok(!E('.claude/skills/backend-testing/SKILL.md'), 'gỡ-lẻ: backend-testing đã gỡ');
  ok(E('.claude/skills/backend-init/SKILL.md'), 'gỡ-lẻ: backend-init còn lại');
  ok(E('.claude/skills/backend-principles/SKILL.md'), 'gỡ-lẻ: baseline backend-principles còn');
  ok(E('.claude/skills/principles/SKILL.md') && E('.claude/skills/git-workflow/SKILL.md'),
    'gỡ-lẻ: core whole vẫn còn (principles + git-workflow)');
  const mf = JSON.parse(fs.readFileSync(path.join(TMP_RU, '.ai-engineering/manifest.json'), 'utf8'));
  const ce = mf.installs.find((e) => e.provider === 'claude');
  ok(!ce.plugins.includes('backend') && ce.skills.includes('backend/backend-init')
    && !ce.skills.includes('backend/backend-testing'),
    'gỡ-lẻ: khối backend "vỡ" thành skills lẻ, hết backend-testing');
  ok(ce.plugins.includes('core'),
    'gỡ-lẻ: core vẫn whole trong manifest (default-whole-core giữ nguyên)');
  ok(mf.installs.length === 1 && mf.installs[0].provider === 'claude',
    'gỡ-lẻ: KHÔNG rò rỉ sang provider khác (chỉ còn entry claude)');
  ok(!E('.cursor/skills/backend-init/SKILL.md') && !E('.codex/skills/backend-init/SKILL.md'),
    'gỡ-lẻ: không tạo cây .cursor/.codex ngoài ý muốn');
  fs.rmSync(TMP_RU, { recursive: true, force: true });
  process.env.AIE_INSTALL_ROOT = TMP;
}

// ── update: empty manifest + reinstall (tái quét) + regression phát hiện SKILL MỚI ──────────
{
  // empty manifest → update không làm gì (pull=false: không đụng git)
  const TMP_E = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-upd-empty-'));
  process.env.AIE_INSTALL_ROOT = TMP_E;
  const re = update({ scope: 'project', pull: false });
  ok(re.empty === true && re.entries.length === 0, 'update: manifest trống → empty, không cập nhật gì');
  fs.rmSync(TMP_E, { recursive: true, force: true });

  // integration: cài claude backend rồi update (pull=false) → reinstall (tái quét), skill vẫn còn
  const TMP_UP = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-upd-int-'));
  process.env.AIE_INSTALL_ROOT = TMP_UP;
  install({ providers: 'claude', plugins: 'backend', scope: 'project' });
  const ru = update({ scope: 'project', pull: false });
  const be = ru.entries.find((e) => e.provider === 'claude');
  ok(be && be.action === 'reinstall', 'update: entry skills-mode → reinstall (tái quét build)');
  ok(fs.existsSync(path.join(TMP_UP, '.claude/skills/backend-init/SKILL.md')), 'update: skill vẫn còn sau update');
  fs.rmSync(TMP_UP, { recursive: true, force: true });

  // REGRESSION (root cause): skill dùng chung MỚI của core (git-workflow) phải xuất hiện sau update
  // dù bản cài trước đó KHÔNG có nó. Mô phỏng "cài trước khi git-workflow tồn tại" = xoá link/skill
  // git-workflow rồi update. Trước fix: symlink-pass giữ nguyên tập link cũ → git-workflow BỎ SÓT.
  const TMP_NEW = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-upd-new-'));
  process.env.AIE_INSTALL_ROOT = TMP_NEW;
  install({ providers: 'claude', plugins: 'backend', scope: 'project' });
  const gwf = path.join(TMP_NEW, '.claude/skills/git-workflow');
  ok(fs.existsSync(gwf), 'regression precondition: git-workflow (core) được cài từ đầu');
  fs.rmSync(gwf, { recursive: true, force: true }); // giả lập bản cài cũ chưa có git-workflow
  ok(!fs.existsSync(gwf), 'regression: đã xoá git-workflow để mô phỏng bản cài cũ');
  update({ scope: 'project', pull: false });
  ok(fs.existsSync(path.join(gwf, 'SKILL.md')), 'regression: update TÁI TẠO git-workflow (phát hiện skill mới của core)');
  ok(fs.existsSync(path.join(TMP_NEW, '.claude/skills/backend-init/SKILL.md')), 'regression: skill cũ không bị mất');
  fs.rmSync(TMP_NEW, { recursive: true, force: true });

  process.env.AIE_INSTALL_ROOT = TMP; // khôi phục cho round-trip chính
}

// ── update: khối nhận skill MỚI; skill-lẻ KHÔNG kéo anh em; check trả skills ──
{
  const TMP_U2 = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-upd-skill-'));
  process.env.AIE_INSTALL_ROOT = TMP_U2;
  install({ providers: 'claude', skills: ['backend/backend-init'], scope: 'project' }); // cài LẺ
  const chk = check({ scope: 'project' }).installs.find((e) => e.provider === 'claude');
  ok(Array.isArray(chk.skills) && chk.skills.includes('backend/backend-init'),
    'check: trả danh sách skills hiệu lực');
  // update: skill-lẻ chỉ refresh, KHÔNG kéo backend-testing (skill anh em)
  update({ scope: 'project', pull: false });
  ok(!fs.existsSync(path.join(TMP_U2, '.claude/skills/backend-testing/SKILL.md')),
    'update skill-lẻ: KHÔNG tự kéo skill anh em');
  ok(fs.existsSync(path.join(TMP_U2, '.claude/skills/backend-init/SKILL.md')),
    'update skill-lẻ: skill đã chọn vẫn còn (refresh)');
  fs.rmSync(TMP_U2, { recursive: true, force: true });
  process.env.AIE_INSTALL_ROOT = TMP;
}

// ── update FILTER: chỉ làm tươi entry khớp --provider/--plugin; không khớp → noMatch ──
{
  const TMP_UF = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-upd-filter-'));
  process.env.AIE_INSTALL_ROOT = TMP_UF;
  install({ providers: 'claude', plugins: 'backend', scope: 'project' });
  install({ providers: 'cursor', plugins: 'frontend', scope: 'project' });

  // lọc theo provider: chỉ cursor được build + reinstall
  const rProv = update({ scope: 'project', pull: false, providers: 'cursor' });
  ok(JSON.stringify(rProv.built) === '["cursor"]', 'update --provider: chỉ build provider khớp (cursor)');
  ok(rProv.entries.length === 1 && rProv.entries[0].provider === 'cursor',
    'update --provider: chỉ refresh entry cursor, không đụng claude');

  // lọc theo plugin: chỉ entry chứa backend (claude)
  const rPlug = update({ scope: 'project', pull: false, plugins: 'backend' });
  ok(rPlug.entries.length === 1 && rPlug.entries[0].provider === 'claude',
    'update --plugin backend: chỉ refresh entry chứa backend (claude)');

  // lọc không khớp entry nào → noMatch, không build gì
  const rNo = update({ scope: 'project', pull: false, plugins: 'data' });
  ok(rNo.noMatch === true && rNo.entries.length === 0 && rNo.built.length === 0,
    'update --plugin data: không entry khớp → noMatch, không build');

  // không filter (mặc định) → cả hai entry
  const rAll = update({ scope: 'project', pull: false });
  ok(rAll.entries.length === 2 && !rAll.noMatch, 'update không filter: làm tươi mọi entry');
  fs.rmSync(TMP_UF, { recursive: true, force: true });
  process.env.AIE_INSTALL_ROOT = TMP;
}

// ── narrowing: chọn LẺ core/principles → KHÔNG kéo git-workflow (Q2) ──────────
{
  const TMP_NW = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-narrow-'));
  process.env.AIE_INSTALL_ROOT = TMP_NW;
  install({ providers: 'claude', skills: ['core/principles'], scope: 'project' });
  const E = (rel) => fs.existsSync(path.join(TMP_NW, rel));
  ok(E('.claude/skills/principles/SKILL.md'), 'narrow: core/principles có');
  ok(!E('.claude/skills/git-workflow/SKILL.md'), 'narrow: git-workflow KHÔNG cài khi chọn lẻ core/principles');
  fs.rmSync(TMP_NW, { recursive: true, force: true });
  process.env.AIE_INSTALL_ROOT = TMP;
}

// ── CLI seam: --skill KHÔNG kèm --plugin → chỉ cài skill đó, KHÔNG cài mọi plugin ──
{
  const TMP_CLI = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-cli-'));
  process.env.AIE_INSTALL_ROOT = TMP_CLI;
  const a = parse(['install', '--provider', 'claude', '--skill', 'backend/backend-init']);
  const plugins = (a.skill.length && !a.pluginExplicit) ? [] : a.plugin;
  install({ providers: a.provider, plugins, skills: a.skill, scope: 'project', mode: a.mode });
  const E = (rel) => fs.existsSync(path.join(TMP_CLI, rel));
  ok(E('.claude/skills/backend-init/SKILL.md'), 'cli-skill: backend-init được cài');
  ok(!E('.claude/skills/frontend-init/SKILL.md'), 'cli-skill: KHÔNG cài frontend (không lan ra mọi plugin)');
  ok(E('.claude/skills/principles/SKILL.md'), 'cli-skill: core principles vẫn có');
  fs.rmSync(TMP_CLI, { recursive: true, force: true });
  process.env.AIE_INSTALL_ROOT = TMP;
}

// ── CLI seam: uninstall --provider/--plugin (KHÔNG --skill) vẫn gỡ thật ────────
// index.mjs truyền skills=args.skill (mặc định []). [] phải được coi là "không lọc theo skill",
// KHÔNG phải "lọc theo tập rỗng" (khiến matched luôn false → gỡ 0 file).
{
  const TMP_UR = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-cli-rm-'));
  process.env.AIE_INSTALL_ROOT = TMP_UR;
  const E = (rel) => fs.existsSync(path.join(TMP_UR, rel));

  // gỡ theo --plugin: giữ core, xoá backend
  install({ providers: 'cursor', plugins: 'backend', scope: 'project' });
  const ap = parse(['uninstall', '--provider', 'cursor', '--plugin', 'backend']);
  const rp = uninstall({ providers: ap.provider, plugins: ap.plugin, skills: ap.skill, scope: 'project' });
  ok(rp.removed > 0, 'cli-uninstall --plugin: gỡ >0 file (args.skill=[] không làm matched luôn false)');
  ok(!E('.cursor/skills/backend-init/SKILL.md'), 'cli-uninstall --plugin: backend đã gỡ khỏi đĩa');
  ok(E('.cursor/skills/git-workflow/SKILL.md'), 'cli-uninstall --plugin: core còn lại');

  // gỡ theo --provider (plugin=all): xoá sạch provider
  const av = parse(['uninstall', '--provider', 'cursor']);
  const rv = uninstall({ providers: av.provider, plugins: av.plugin, skills: av.skill, scope: 'project' });
  ok(rv.removed > 0, 'cli-uninstall --provider: gỡ >0 file (không kẹt vì skills=[])');
  ok(!E('.cursor/skills/git-workflow/SKILL.md'), 'cli-uninstall --provider: đã gỡ sạch cursor');
  fs.rmSync(TMP_UR, { recursive: true, force: true });
  process.env.AIE_INSTALL_ROOT = TMP;
}

// ── antigravity (layout 'agents'): full luồng tường minh + regression managed-block symlink ─────
// antigravity KHÔNG thuộc PROVIDERS (không wizard/--all) nhưng cài được khi gọi tường minh.
// Layout 1 plugin: AGENTS.md + docs/workflow/<skill>/ ở gốc. AGENTS.md là artifact SINH SẴN (đã
// inline baseline) ship qua symlink → install KHÔNG được merge managed block (ghi xuyên vào nguồn build).
{
  const BUILD_AGENTS = path.join(REPO, 'build/antigravity/backend/AGENTS.md');
  const MARK = '<!-- AI-ENGINEERING:BEGIN AGENTS_BASELINE -->';

  // A) vòng đời đầy đủ: install khối → gỡ lẻ → update → gỡ provider (một scope)
  const TA = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-agy-'));
  process.env.AIE_INSTALL_ROOT = TA;
  const A = (rel) => fs.existsSync(path.join(TA, rel));
  install({ providers: 'antigravity', plugins: 'backend', scope: 'project' });
  ok(A('AGENTS.md'), 'agy: AGENTS.md ở gốc (plugin-level)');
  ok(A('docs/workflow/backend-init/SKILL.md'), 'agy: docs/workflow/backend-init');
  ok(A('docs/workflow/git-workflow/SKILL.md'), 'agy: core git-workflow gộp vào docs/workflow');
  ok(!fs.readFileSync(BUILD_AGENTS, 'utf8').includes(MARK),
    'agy regression: install KHÔNG ghi managed block xuyên symlink vào nguồn build');
  const ce = JSON.parse(fs.readFileSync(path.join(TA, '.ai-engineering/manifest.json'), 'utf8'))
    .installs.find((e) => e.provider === 'antigravity');
  ok(ce && (!ce.managed || ce.managed.length === 0),
    'agy: entry KHÔNG track managed AGENTS.md (governance đã trong artifact sinh sẵn)');
  // gỡ lẻ 1 skill → giữ phần còn lại
  uninstall({ providers: 'antigravity', skills: ['backend/backend-testing'], scope: 'project' });
  ok(!A('docs/workflow/backend-testing/SKILL.md'), 'agy gỡ-lẻ: backend-testing đã gỡ');
  ok(A('docs/workflow/backend-init/SKILL.md'), 'agy gỡ-lẻ: backend-init còn');
  // update --provider antigravity → reinstall, không mất file
  const ru = update({ scope: 'project', pull: false, providers: 'antigravity' });
  ok(ru.entries.some((e) => e.provider === 'antigravity' && e.action === 'reinstall'),
    'agy update: entry reinstall');
  ok(A('docs/workflow/backend-init/SKILL.md'), 'agy update: skill còn sau update');
  // gỡ nguyên provider → sạch
  uninstall({ providers: 'antigravity', scope: 'project' });
  ok(!A('docs/workflow/backend-init/SKILL.md'), 'agy gỡ provider: skills đã gỡ');
  ok(check({ scope: 'project' }).installs.length === 0, 'agy gỡ provider: manifest trống');
  ok(!fs.readFileSync(BUILD_AGENTS, 'utf8').includes(MARK),
    'agy regression: hết vòng đời, nguồn build vẫn không có managed marker');
  fs.rmSync(TA, { recursive: true, force: true });

  // B) install LẺ 1 skill → chỉ skill đó + git-workflow, không kéo anh em
  const TB = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-agy-skill-'));
  process.env.AIE_INSTALL_ROOT = TB;
  const B = (rel) => fs.existsSync(path.join(TB, rel));
  install({ providers: 'antigravity', skills: ['backend/backend-init'], scope: 'project' });
  ok(B('docs/workflow/backend-init/SKILL.md'), 'agy skill-lẻ: backend-init có');
  ok(B('docs/workflow/git-workflow/SKILL.md'), 'agy skill-lẻ: core git-workflow đi kèm');
  ok(!B('docs/workflow/backend-testing/SKILL.md'), 'agy skill-lẻ: KHÔNG kéo skill anh em');
  fs.rmSync(TB, { recursive: true, force: true });
  process.env.AIE_INSTALL_ROOT = TMP;
}

try {
  // 1. install claude + backend (project)
  const r1 = install({ providers: 'claude', plugins: 'backend', scope: 'project' });
  ok(r1.results[0].count > 0, 'claude: có file được cài');
  ok(exists('.claude/skills/backend-init/SKILL.md'), 'claude: backend-init/SKILL.md');
  ok(exists('.claude/skills/principles/SKILL.md'), 'claude: core principles đi kèm');
  ok(exists('.claude/skills/backend-principles/SKILL.md'), 'claude: backend-principles (shared) đi kèm');
  ok(exists('.ai-engineering/manifest.json'), 'manifest được tạo');
  ok(typeof r1.results[0].linked === 'number' && typeof r1.results[0].copied === 'number',
    'results: có trường linked/copied');
  ok(r1.results[0].count === r1.results[0].linked + r1.results[0].copied,
    'results: count = linked + copied');
  // link mode: skill-dir là symlink/junction trỏ build/ (không phải copy)
  ok(isLink(path.join(TMP, '.claude/skills/backend-init')), 'claude: skill-dir là link (junction/symlink)');
  ok(r1.results[0].linked > 0, 'claude: có link được tạo (linked > 0)');

  // 2. install cursor + frontend (project) — rules (00-principles) + Agent Skills
  install({ providers: 'cursor', plugins: 'frontend', scope: 'project' });
  const rules = fs.existsSync(path.join(TMP, '.cursor/rules'))
    ? fs.readdirSync(path.join(TMP, '.cursor/rules')) : [];
  ok(rules.includes('frontend-00-principles.mdc'), 'cursor: 00-principles có prefix tránh đụng');
  ok(rules.every((f) => !f.endsWith('.mdc') || f === 'frontend-00-principles.mdc'),
    'cursor: không còn per-stage .mdc (chỉ 00-principles)');
  ok(exists('.cursor/skills/frontend-init/SKILL.md'), 'cursor: skill frontend-init');
  ok(exists('.cursor/skills/git-workflow/SKILL.md'), 'cursor: core git-workflow đi kèm');
  ok(isLink(path.join(TMP, '.cursor/skills/frontend-init')), 'cursor: skill-dir là link (junction/symlink)');
  ok(isLink(path.join(TMP, '.cursor/skills/git-workflow')), 'cursor: git-workflow skill-dir là link');

  // 3. install codex -> native skills vào .codex/skills/ (core đi kèm)
  install({ providers: 'codex', plugins: 'data', scope: 'project' });
  ok(exists('.codex/skills/data-olap-init/SKILL.md'), 'codex: skill-dir vào .codex/skills/');
  ok(exists('.codex/skills/principles/SKILL.md'), 'codex: core principles đi kèm');
  // skill có references -> ship references/ đi kèm SKILL.md (parity) — core git-workflow còn references/
  ok(exists('.codex/skills/git-workflow/references/branch-convention.md'), 'codex: references đi kèm SKILL.md');
  ok(isLink(path.join(TMP, '.codex/skills/data-olap-init')), 'codex: skill-dir là link (junction/symlink)');

  // 4. check
  const c = check({ scope: 'project' });
  ok(c.installs.length === 3, 'check: liệt kê 3 install');
  ok(c.installs.every((e) => e.present === e.files), 'check: mọi file present');

  // 5. uninstall claude -> file claude mất, cursor/codex còn
  uninstall({ providers: 'claude', scope: 'project' });
  ok(!exists('.claude/skills/backend-init/SKILL.md'), 'uninstall claude: file đã xóa');
  ok(fs.existsSync(path.join(REPO, 'build/claude/plugins/backend/skills/backend-init/SKILL.md')),
    'uninstall claude: build/ nguồn KHÔNG bị xóa qua link');
  ok(exists('.codex/skills/data-olap-init/SKILL.md'), 'uninstall claude: KHÔNG đụng codex');
  ok(exists('.cursor/skills/frontend-init/SKILL.md'), 'uninstall claude: KHÔNG đụng cursor skills');
  ok(check({ scope: 'project' }).installs.length === 2, 'check: còn 2 install');

  // 5b. uninstall cursor -> rules + skills sạch
  uninstall({ providers: 'cursor', scope: 'project' });
  ok(!exists('.cursor/rules/frontend-00-principles.mdc'), 'uninstall cursor: rules đã xóa');
  ok(!exists('.cursor/skills/frontend-init/SKILL.md'), 'uninstall cursor: skills đã xóa');
  ok(!exists('.cursor/skills/git-workflow/SKILL.md'), 'uninstall cursor: core skills đã xóa');
  ok(exists('.codex/skills/data-olap-init/SKILL.md'), 'uninstall cursor: KHÔNG đụng codex');
  ok(check({ scope: 'project' }).installs.length === 1, 'check: còn 1 install (codex)');

  // 6. uninstall all -> manifest biến mất
  uninstall({ scope: 'project' });
  ok(!exists('.ai-engineering/manifest.json'), 'uninstall all: manifest đã dọn');
  ok(check({ scope: 'project' }).installs.length === 0, 'check: trống');
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}

// ── pack Cowork: manifest _cowork.json + ZIP writer zero-dep ─────────────────
{
  const z = zipBuffer([{ name: 'd/a.txt', data: Buffer.from('hello cowork') }]);
  ok(z.slice(0, 4).toString('hex') === '504b0304', 'zip: chữ ký local file header (PK\\x03\\x04)');
  ok(z.includes(Buffer.from('504b0506', 'hex')), 'zip: có End Of Central Directory (PK\\x05\\x06)');

  const ids = coworkSkillIds();
  ok(ids.includes('backend:backend-init') && ids.includes('core:principles'),
    'cowork manifest: gồm backend:backend-init + core:principles');

  // coworkBuildSet: build CHỈ skill trong danh sách cấu hình (không build full claude tree).
  const sub = coworkBuildSet(['backend:backend-init', 'core:git-workflow']);
  const subStages = sub.plugins.flatMap((p) => p.stages.map((s) => `${p.id}:${s.id}`));
  ok(subStages.length === 1 && subStages[0] === 'backend:backend-init',
    'coworkBuildSet: subset → chỉ giữ stage được liệt kê (bỏ mọi skill ngoài danh sách)');
  ok(sub.core.stages.length === 1 && sub.core.stages[0].id === 'git-workflow',
    'coworkBuildSet: core lọc còn đúng git-workflow');
  ok(sub.plugins.every((p) => p.stages.length > 0),
    'coworkBuildSet: loại plugin không có stage cowork nào');

  const TMP_PK = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-pack-'));
  const r = pack({ outDir: TMP_PK });
  ok(r.packed.some((p) => p.skill === 'backend-init'), 'pack: đóng gói skill backend-init');
  ok(r.packed.length === ids.length && r.missing.length === 0,
    'pack: đóng gói ĐÚNG tập cowork (đủ, không thiếu)');
  const zp = path.join(TMP_PK, 'backend-init.zip');
  ok(fs.existsSync(zp) && fs.readFileSync(zp).slice(0, 4).toString('hex') === '504b0304',
    'pack: tạo backend-init.zip hợp lệ (PK)');
  fs.rmSync(TMP_PK, { recursive: true, force: true });
}

console.log('');
if (fails.length) { console.log('FAIL:'); for (const f of fails) console.log('  ✗ ' + f); }
console.log(`\nINSTALL TEST: ${pass} pass, ${fails.length} fail`);
process.exit(fails.length ? 1 : 0);
