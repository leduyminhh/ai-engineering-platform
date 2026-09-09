// install / check / uninstall logic — file-copy theo provider × scope, track bằng manifest.
// Zero-dependency. Build output (build/<provider>/) là nguồn copy; tự build nếu thiếu.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { REPO_ROOT, loadPlugins, loadCore, loadMarketplace, loadPublished } from './plugins.mjs';
import { scopeRoot, manifestPath, PROVIDER_LAYOUT, PROVIDERS } from './paths.mjs';
import { pack } from './pack.mjs';
import { BEGIN as MB_BEGIN, END as MB_END, mergeManagedBlock, removeManagedBlock } from './managed-block.mjs';

// ── phát hiện môi trường ───────────────────────────────────────────────────
/** true nếu kit chạy từ trong node_modules (đã cài như package) → KHÔNG link vào đó
 *  (link sẽ gãy khi npm update/gỡ kit); thay vào đó copy để bản cài self-contained. */
export function linkDisabledForRoot(repoRoot) {
  return repoRoot.split(/[\\/]+/).includes('node_modules');
}
const USE_LINK = !linkDisabledForRoot(REPO_ROOT);

const BUILD_DIR = path.join(REPO_ROOT, 'build');

// ── fs helpers ───────────────────────────────────────────────────────────────
function copyFileRec(src, dest, files) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  files.push(dest);
}
function copyDirRec(src, destDir, files) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(destDir, e.name);
    if (e.isDirectory()) copyDirRec(s, d, files);
    else copyFileRec(s, d, files);
  }
}
/** Dọn các thư mục cha rỗng từ `start` lên tới (không gồm) `stopAt`. */
function pruneEmptyDirs(start, stopAt) {
  let dir = start;
  while (dir.startsWith(stopAt) && dir !== stopAt) {
    try {
      if (fs.readdirSync(dir).length === 0) { fs.rmdirSync(dir); dir = path.dirname(dir); }
      else break;
    } catch { break; }
  }
}
/** Xóa file rồi dọn các thư mục cha rỗng (an toàn — không đụng file người dùng). */
function removeFileAndPruneEmpty(file, stopAt) {
  try { fs.rmSync(file, { force: true }); } catch { /* ignore */ }
  pruneEmptyDirs(path.dirname(file), stopAt);
}

/** Kiểu symlink theo nền tảng: Windows dùng junction cho THƯ MỤC (không cần admin). */
function symlinkType(isDir) {
  if (process.platform === 'win32') return isDir ? 'junction' : 'file';
  return isDir ? 'dir' : 'file';
}
/** true nếu `p` là symlink HOẶC junction (readlink chạy được cho cả hai; ném với dir thật). */
function isLinkPath(p) { try { fs.readlinkSync(p); return true; } catch { return false; } }

/** Gỡ một LINK an toàn: unlink (symlink) / rmdir (junction) — KHÔNG xóa nội dung target. */
function removeLinkAndPruneEmpty(link, stopAt) {
  try {
    const st = fs.lstatSync(link);
    if (st.isSymbolicLink()) fs.unlinkSync(link);   // symlink (file/dir POSIX)
    else if (st.isDirectory()) fs.rmdirSync(link);  // junction Windows (chỉ gỡ reparse point)
    else fs.unlinkSync(link);                        // file (copy-fallback) — phòng hờ
  } catch { /* ignore */ }
  pruneEmptyDirs(path.dirname(link), stopAt);
}

// ── manifest ─────────────────────────────────────────────────────────────────
function readManifest(scope) {
  const p = manifestPath(scope);
  if (!fs.existsSync(p)) return { version: 1, installs: [] };
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return { version: 1, installs: [] }; }
}
function writeManifest(scope, m) {
  const p = manifestPath(scope);
  if (!m.installs.length) {
    try { fs.rmSync(p, { force: true }); } catch { /* */ }
    // Dọn thư mục .ai-engineering nếu đã rỗng (best-effort; còn file khác → rmdir ném, bỏ qua).
    try { fs.rmdirSync(path.dirname(p)); } catch { /* không rỗng hoặc không tồn tại */ }
    return;
  }
  fs.mkdirSync(path.dirname(p), { recursive: true }); // đảm bảo .ai-engineering tồn tại trước khi ghi
  fs.writeFileSync(p, JSON.stringify(m, null, 2) + '\n');
}

// ── managed block (graft) ──────────────────────────────────────────────────────
// Chèn khối baseline "AI Engineering" vào file chỉ dẫn (AGENTS.md/CLAUDE.md) tại scope root
// của project ĐÍCH — augment file có sẵn của người dùng, chỉ ghi vùng giữa marker. Track theo
// entry (field `managed`) + reference-count khi gỡ để không xoá khối khi provider khác còn dùng.
/** Khối baseline = vùng BEGIN..END TRÍCH từ core/agents/AGENTS.template.md (template đã chứa sẵn
 *  marker; phần trước BEGIN là preamble project-owned, KHÔNG thuộc khối managed). */
function baselineBlock() {
  const full = fs.readFileSync(path.join(REPO_ROOT, 'core', 'agents', 'AGENTS.template.md'), 'utf8');
  const start = full.indexOf(MB_BEGIN);
  const end = full.indexOf(MB_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error('core/agents/AGENTS.template.md thiếu marker managed block hợp lệ');
  }
  return full.slice(start, end + MB_END.length);
}
/** File chỉ dẫn (rel scope root) mỗi provider nhận khối. cursor + antigravity: bỏ qua — governance đã
 *  inline sẵn (cursor vào .cursor/rules; antigravity vào AGENTS.md sinh sẵn). Nếu trả 'AGENTS.md' cho
 *  antigravity, applyManagedBlock sẽ ghi XUYÊN symlink (AGENTS.md là artifact ship từ build) vào nguồn
 *  build, đồng thời trùng file với codex. */
function instructionFiles(provider, scope) {
  if (provider === 'claude') return [scope === 'global' ? '.claude/CLAUDE.md' : 'CLAUDE.md'];
  if (provider === 'codex') return [scope === 'global' ? '.codex/AGENTS.md' : 'AGENTS.md'];
  return [];
}
/** Merge khối baseline vào từng file; trả các rel đã ghi (để lưu vào manifest entry). */
function applyManagedBlock(root, rels) {
  const block = baselineBlock();
  const written = [];
  for (const rel of rels) {
    const abs = path.join(root, rel);
    const existing = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
    const next = existing.trim() === '' ? `${block}\n` : mergeManagedBlock(existing, block, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, next);
    written.push(rel);
  }
  return written;
}
/** Gỡ khối baseline khỏi 1 file; xoá file (+ prune) nếu sau khi gỡ chỉ còn rỗng. */
function cleanManagedBlock(root, rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return;
  const next = removeManagedBlock(fs.readFileSync(abs, 'utf8'));
  if (next.trim() === '') removeFileAndPruneEmpty(abs, root);
  else fs.writeFileSync(abs, next);
}
/** PURE: file managed cần gỡ = có ở entry bị gỡ mà KHÔNG entry giữ lại nào còn dùng (reference-count). */
export function managedFilesToClean(removeEntries, keepEntries) {
  const kept = new Set();
  for (const e of keepEntries) for (const f of (e.managed || [])) kept.add(f);
  const out = new Set();
  for (const e of removeEntries) for (const f of (e.managed || [])) if (!kept.has(f)) out.add(f);
  return out;
}

// ── build ensure ─────────────────────────────────────────────────────────────
export function ensureBuilt(provider) {
  execFileSync('node', ['cli/build.mjs', '--target', provider], { cwd: REPO_ROOT, stdio: 'ignore' });
}

// ── claude plugin-mode (cài THẬT như plugin qua `claude` CLI, không phải skills phẳng) ───────
// Khác mode 'skills' (copy/symlink vào .claude/skills/): mode 'plugin' đăng ký build/claude làm
// marketplace dạng directory rồi `claude plugin install <id>@<mkt>` để Claude quản lý như plugin
// thật (namespaced <id>:<skill>, core tự kéo qua dependencies). aip không tự ghi settings.json
// — uỷ cho `claude` CLI (nguồn chuẩn) để check/uninstall do chính Claude Code theo dõi.

/** scope của aip → --scope của `claude plugin` (global = toàn máy = user). */
export function claudeCliScope(scope) { return scope === 'global' ? 'user' : 'project'; }

/** Thư mục marketplace dạng directory mà `claude plugin marketplace add` trỏ tới (= build/claude). */
export function claudeMarketplaceDir() { return path.join(BUILD_DIR, 'claude'); }

/**
 * PURE: dựng đúng các argv cho `claude plugin …` (không thực thi — để test argv tất định).
 * core KHÔNG cài tường minh trong `installs`: domain plugin tự kéo core qua dependency "core" trong
 * plugin.json. NHƯNG cache plugin của Claude key theo VERSION — nếu core@<ver> đã cache (bản cũ, cài
 * trước khi thêm skill dùng chung mới) thì `plugin install` domain sẽ no-op dependency core ("already
 * installed") và KHÔNG re-copy → git-workflow không tới Claude. Nên trước khi cài domain phải:
 *   marketplaceUpdate (làm mới snapshot nguồn = build/claude) + coreUninstall (gỡ core cũ) → lần cài
 *   domain kế tiếp kéo LẠI core TƯƠI qua dependency (đã xác nhận: "+ 1 dependency: core", re-copy đủ skill).
 * @returns {{cliScope:string, marketplace:string, dir:string, add:string[], marketplaceUpdate:string[],
 *            coreUninstall:string[], installs:string[][], uninstalls:string[][], marketplaceRemove:string[]}}
 */
export function claudePluginCommands({ pluginIds, scope, marketplaceName, marketplaceDir }) {
  const cliScope = claudeCliScope(scope);
  const at = (id) => `${id}@${marketplaceName}`;
  return {
    cliScope,
    marketplace: marketplaceName,
    dir: marketplaceDir,
    add: ['plugin', 'marketplace', 'add', marketplaceDir, '--scope', cliScope],
    marketplaceUpdate: ['plugin', 'marketplace', 'update', marketplaceName],
    coreUninstall: ['plugin', 'uninstall', at('core'), '--scope', cliScope, '-y'],
    installs: pluginIds.map((id) => ['plugin', 'install', at(id), '--scope', cliScope]),
    uninstalls: pluginIds.map((id) => ['plugin', 'uninstall', at(id), '--scope', cliScope, '-y']),
    marketplaceRemove: ['plugin', 'marketplace', 'remove', marketplaceName, '--scope', cliScope],
  };
}

/**
 * PURE: argv để REFRESH plugin-mode (dùng cho `aip update`). Cache plugin của Claude key theo
 * VERSION (backend/2.0.0); kit đổi nội dung nhưng không bump version → `plugin install`/`plugin update`
 * no-op ("already at latest") và cache KHÔNG được re-copy. Refresh đúng = `marketplace update <mkt>`
 * (làm mới snapshot nguồn) + với TỪNG plugin: uninstall (-y, tolerate) rồi install (force re-copy).
 * @returns {{marketplaceUpdate:string[], pairs:Array<{id:string, uninstall:string[], install:string[]}>}}
 */
export function claudePluginRefreshCommands({ pluginIds, scope, marketplaceName }) {
  const cliScope = claudeCliScope(scope);
  const at = (id) => `${id}@${marketplaceName}`;
  // core PHẢI được refresh TƯỜNG MINH: lúc install đầu core chỉ được kéo theo qua dependency của
  // domain plugin, KHÔNG cài riêng. Cache plugin của Claude key theo VERSION (cache/<mkt>/core/1.0.0);
  // uninstall/install domain plugin KHÔNG re-copy core khi version core không đổi → SKILL DÙNG CHUNG
  // mới thêm vào core (vd git-workflow) không bao giờ tới Claude. `plugin update`/`install` cũng no-op
  // ("already at latest"). Chỉ uninstall(-y) rồi install core mới buộc re-copy từ snapshot marketplace
  // vừa `marketplace update`. Prepend core (dedup) để nó được làm mới TRƯỚC các domain plugin.
  const ids = [...new Set(['core', ...pluginIds])];
  return {
    marketplaceUpdate: ['plugin', 'marketplace', 'update', marketplaceName],
    pairs: ids.map((id) => ({
      id,
      uninstall: ['plugin', 'uninstall', at(id), '--scope', cliScope, '-y'],
      install: ['plugin', 'install', at(id), '--scope', cliScope],
    })),
  };
}

/** Bọc 1 đối số shell trên Windows (execSync nối chuỗi) — chỉ thêm "" khi có ký tự cần bảo vệ. */
function shQuote(arg) { return /[\s"&|<>^()]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg; }

/**
 * Chạy `claude <argv>`. Trên Windows `claude` là shim (.cmd) → dùng shell. Trả {ok, out|err}.
 * KHÔNG ném khi lệnh fail (để gọi nơi khác quyết định bỏ qua, vd marketplace add trùng); CHỈ
 * ném khi không tìm thấy `claude` trên PATH (ENOENT) — báo lỗi rõ cho người dùng.
 */
function runClaudeCli(argv, { tolerate = false } = {}) {
  try {
    const out = process.platform === 'win32'
      ? execSync(['claude', ...argv].map(shQuote).join(' '), { encoding: 'utf8', stdio: 'pipe' })
      : execFileSync('claude', argv, { encoding: 'utf8', stdio: 'pipe' });
    return { ok: true, out: String(out || '') };
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw new Error("Không tìm thấy lệnh 'claude' trên PATH. Cần cài Claude Code CLI để dùng --as-plugin.");
    }
    if (!tolerate) {
      const detail = (err.stderr || err.stdout || err.message || '').toString().trim().split('\n')[0];
      throw new Error(`'claude ${argv.join(' ')}' lỗi: ${detail}`);
    }
    return { ok: false, err };
  }
}

/** Cài claude dạng plugin: đăng ký marketplace (idempotent) rồi install từng plugin đã chọn. */
function installClaudePlugin({ pluginIds, scope }) {
  const dir = claudeMarketplaceDir();
  if (!fs.existsSync(path.join(dir, '.claude-plugin', 'marketplace.json'))) {
    throw new Error(`Chưa build claude (thiếu ${path.join('build', 'claude', '.claude-plugin', 'marketplace.json')}).`);
  }
  const marketplaceName = loadMarketplace().name;
  const cmd = claudePluginCommands({ pluginIds, scope, marketplaceName, marketplaceDir: dir });
  // marketplace add: trùng (đã đăng ký) thì `claude` báo lỗi → bỏ qua, vẫn install tiếp.
  runClaudeCli(cmd.add, { tolerate: true });
  // FORCE core tươi trước khi cài domain (xem chú thích claudePluginCommands): làm mới snapshot rồi gỡ
  // core cũ để domain plugin kéo LẠI core tươi qua dependency — bust cache key-theo-version. Cả hai
  // tolerate: marketplace chưa từng update / core chưa cài đều không sao.
  runClaudeCli(cmd.marketplaceUpdate, { tolerate: true });
  runClaudeCli(cmd.coreUninstall, { tolerate: true });
  for (const argv of cmd.installs) runClaudeCli(argv); // domain plugins → kéo core tươi; ném nếu lỗi thật
  return { marketplace: marketplaceName, cliScope: cmd.cliScope, dir };
}

/**
 * PURE: cho danh sách entry SẼ GỠ + entry GIỮ LẠI, trả Set marketplace an toàn để gỡ — tức
 * marketplace của entry plugin-mode bị gỡ mà KHÔNG còn entry giữ lại nào (cùng marketplace) dùng.
 * Tránh yank marketplace khi vẫn còn plugin khác của nó. Export để test. (cùng scope trong 1 manifest)
 */
export function marketplacesToRemove(removeEntries, keepEntries) {
  const kept = new Set(keepEntries.filter((e) => e.mode === 'plugin').map((e) => e.marketplace));
  const out = new Set();
  for (const e of removeEntries) {
    if (e.mode === 'plugin' && !kept.has(e.marketplace)) out.add(e.marketplace);
  }
  return out;
}

/** Gỡ một manifest entry kiểu plugin: uninstall từng plugin + (tuỳ chọn) gỡ marketplace. Tolerant. */
function uninstallClaudePlugin(entry, { removeMarketplace = true } = {}) {
  const cliScope = entry.cliScope || claudeCliScope(entry.scope);
  for (const id of entry.plugins) {
    runClaudeCli(['plugin', 'uninstall', `${id}@${entry.marketplace}`, '--scope', cliScope, '-y'], { tolerate: true });
  }
  if (removeMarketplace) {
    runClaudeCli(['plugin', 'marketplace', 'remove', entry.marketplace, '--scope', cliScope], { tolerate: true });
  }
}

// ── plugin resolution ────────────────────────────────────────────────────────
export function knownPluginIds() { return loadPlugins().map((p) => p.id); }

/** Danh mục skill NGUỒN theo plugin (core đầu tiên). KHÔNG gồm generated <id>-principles.
 *  core mang thêm baseline `core/principles` (adapter sinh từ core.principles, không có trong loadSkills). */
export function skillCatalog() {
  const core = loadCore();
  const plugins = [core, ...loadPlugins()].map((p) => ({
    id: p.id,
    skillIds: [
      ...(p.id === 'core' ? ['core/principles'] : []),
      ...p.stages.map((s) => `${p.id}/${s.id}`),
    ],
  }));
  return { plugins };
}
/** Plugin id ĐÃ published (có ≥1 skill) CÓ trên đĩa. `_published.json` vắng → mọi plugin. */
export function publishedPluginIds(published = loadPublished()) {
  const ids = loadPlugins().map((p) => p.id);
  if (!published) return ids;
  return ids.filter((id) => published[id]);
}

/**
 * Catalog wizard được phép OFFER: core + skill đã published. Mỗi plugin published theo '*' (mọi skill)
 * hoặc mảng skill lẻ (chỉ những `plugin/skill` đó). KHÁC skillCatalog (đầy đủ, gate flag/dev).
 * published vắng (null) → offer tất cả. Nhận map để test.
 */
export function offeredCatalog(published = loadPublished()) {
  const cat = skillCatalog();
  if (!published) return cat;
  const plugins = [];
  for (const p of cat.plugins) {
    if (p.id === 'core') { plugins.push(p); continue; }
    const sel = published[p.id];
    if (!sel) continue;
    if (sel === '*') { plugins.push(p); continue; }
    const allow = new Set(sel);
    const skillIds = p.skillIds.filter((s) => allow.has(s));
    if (skillIds.length) plugins.push({ ...p, skillIds });
  }
  return { plugins };
}

/** Các `plugin/skill` NGUỒN của một plugin (rỗng nếu plugin không tồn tại). */
export function allSkillsOf(pluginId) {
  const p = skillCatalog().plugins.find((x) => x.id === pluginId);
  return p ? [...p.skillIds] : [];
}

/** Chuẩn hoá lựa chọn → {plugins, skills}. plugins=khối; skills=lẻ (plugin/skill). Ném nếu id lạ. */
export function resolveSelection({ plugins = [], skills = [] } = {}) {
  const cat = skillCatalog();
  const validPlugins = new Set(cat.plugins.map((p) => p.id));
  const bySkill = new Map();          // 'plugin/skill' -> true
  const byBare = new Map();           // 'skill' -> ['plugin/skill', ...]
  for (const p of cat.plugins) for (const sid of p.skillIds) {
    bySkill.set(sid, true);
    const bare = sid.split('/')[1];
    byBare.set(bare, [...(byBare.get(bare) || []), sid]);
  }
  const pluginSel = (plugins === 'all')
    ? cat.plugins.map((p) => p.id)
    : (Array.isArray(plugins) ? plugins : (plugins ? [plugins] : []));
  const badP = pluginSel.filter((id) => !validPlugins.has(id));
  if (badP.length) throw new Error(`Plugin không tồn tại: ${badP.join(', ')} (có: ${[...validPlugins].join(', ')})`);

  const skillSel = new Set();
  const rawSkills = Array.isArray(skills) ? skills : (skills ? [skills] : []);
  for (const raw of rawSkills) {
    if (raw.includes('/')) {
      if (!bySkill.has(raw)) throw new Error(`Skill không tồn tại: ${raw}`);
      skillSel.add(raw);
    } else {
      const cands = byBare.get(raw);
      if (!cands) throw new Error(`Skill không tồn tại: ${raw} (có: ${[...bySkill.keys()].join(', ')})`);
      if (cands.length > 1) throw new Error(`Skill "${raw}" mơ hồ, ghi rõ plugin/skill: ${cands.join(', ')}`);
      skillSel.add(cands[0]);
    }
  }
  // quy về khối: plugin có mọi con đã chọn (qua --plugin HOẶC đủ skill lẻ) → plugins
  const wholeSet = new Set(pluginSel);
  for (const p of cat.plugins) {
    if (wholeSet.has(p.id)) continue;
    if (p.skillIds.length && p.skillIds.every((sid) => skillSel.has(sid))) wholeSet.add(p.id);
  }
  // Mặc định: nếu người dùng KHÔNG nói gì về core → nhận whole core baseline (principles + git-workflow).
  // Wizard luôn phát core/principles (locked) → hasExplicitCore=true → narrow được bằng bỏ tick git-workflow.
  const hasExplicitCore = wholeSet.has('core') || [...skillSel].some((s) => s.startsWith('core/'));
  if (!hasExplicitCore) wholeSet.add('core');
  // dedup: bỏ skill đã nằm trong khối
  const coveredByWhole = new Set();
  for (const id of wholeSet) for (const sid of allSkillsOf(id)) coveredByWhole.add(sid);
  const outSkills = [...skillSel].filter((s) => !coveredByWhole.has(s)).sort();
  return { plugins: [...wholeSet].sort(), skills: outSkills };
}

/** PURE: tập plugin (dedup) suy từ lựa chọn — dùng cho claude plugin-mode (whole-plugin only). */
export function pluginsFromSelection({ plugins = [], skills = [] } = {}) {
  const out = new Set(plugins);
  for (const s of skills) out.add(s.split('/')[0]);
  return [...out];
}

/** Tập `plugin/skill` để LỌC đặt file: core/principles ép bật; khối mở rộng theo kit HIỆN TẠI;
 *  skill lẻ cố định; MỌI plugin active kèm generated `<id>-principles` (baseline, không có trong loadSkills). */
export function effectiveSkills(entry) {
  const out = new Set(['core/principles']);
  const plugins = entry.plugins || [];
  const skills = entry.skills || [];
  for (const p of plugins) for (const sid of allSkillsOf(p)) out.add(sid);
  for (const sid of skills) out.add(sid);
  // plugin active (có ≥1 skill hiệu lực HOẶC là khối) → kèm generated <id>-principles
  const activePlugins = new Set(plugins);
  for (const sid of out) activePlugins.add(sid.split('/')[0]);
  for (const pid of activePlugins) {
    if (pid === 'core') continue; // core baseline là 'principles' (đã ép ở trên)
    out.add(`${pid}/${pid}-principles`);
  }
  return out;
}

// ── copy theo layout từng provider ──────────────────────────────────────────

/**
 * Đặt `src` vào `dest`. Ưu tiên symlink (ctx.useLink); merge an toàn để KHÔNG đè thư mục
 * sẵn có của project; lỗi/không hỗ trợ → copy + cảnh báo MỘT lần. Ghi đường dẫn đã tạo vào
 * ctx.links (link) hoặc ctx.files (copy).
 */
function placeEntry(src, dest, ctx) {
  const isDir = fs.statSync(src).isDirectory();

  if (!ctx.useLink) { // môi trường npm (node_modules) → copy thuần
    if (isDir) copyDirRec(src, dest, ctx.files); else copyFileRec(src, dest, ctx.files);
    return;
  }

  // dest là THƯ MỤC THẬT (không phải link) + src là thư mục → merge từng child (tránh đè dir project)
  if (isDir && fs.existsSync(dest) && !isLinkPath(dest) && fs.statSync(dest).isDirectory()) {
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      placeEntry(path.join(src, e.name), path.join(dest, e.name), ctx);
    }
    return;
  }

  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest) || isLinkPath(dest)) removeLinkAndPruneEmpty(dest, ctx.root); // dọn dest cũ
    fs.symlinkSync(path.resolve(src), dest, symlinkType(isDir)); // junction cần target tuyệt đối
    ctx.links.push(dest);
  } catch (err) {
    if (!ctx.warned) {
      ctx.warned = true;
      console.warn(`[aip] Không tạo được symlink (${err.code || err.message}); chuyển sang copy. ` +
        `Bản cài sẽ KHÔNG tự cập nhật khi rebuild.`);
    }
    if (isDir) copyDirRec(src, dest, ctx.files); else copyFileRec(src, dest, ctx.files);
  }
}

/**
 * Đặt file từ BUILD OUTPUT vào scope root, LỌC thuần theo tập skill hiệu lực `effSetArg`
 * (`Set<'plugin/skill'>` từ effectiveSkills). Chỉ skill-dir có id trong tập mới được đặt — KHÔNG
 * tự ép core: chính sách "mặc định nhận whole core / narrow được bằng chọn lẻ" nằm ở resolveSelection.
 */
function installOne(provider, effSetArg, scope) {
  const layout = PROVIDER_LAYOUT[provider];
  if (!layout) throw new Error(`Provider không hỗ trợ: ${provider}`);
  const root = scopeRoot(scope);
  const pbuild = path.join(BUILD_DIR, provider);
  if (!fs.existsSync(pbuild)) throw new Error(`Chưa build ${provider} (build/${provider} không có).`);
  const ctx = { files: [], links: [], useLink: USE_LINK, warned: false, root };
  const effSet = new Set(effSetArg); // LỌC thuần: chỉ đặt skill-dir có id trong tập (không tự ép core)
  const pluginActive = (id) => { for (const s of effSet) if (s.startsWith(`${id}/`)) return true; return false; };

  if (layout.kind === 'claude') {
    const claudeRoot = path.join(root, '.claude');
    const pluginsDir = path.join(pbuild, 'plugins');
    if (!fs.existsSync(pluginsDir)) return { files: ctx.files, links: ctx.links };
    for (const id of fs.readdirSync(pluginsDir)) {
      const pdir = path.join(pluginsDir, id);
      if (!fs.statSync(pdir).isDirectory()) continue;
      for (const comp of fs.readdirSync(pdir, { withFileTypes: true })) {
        if (!comp.isDirectory() || comp.name === '.claude-plugin') continue; // bỏ manifest plugin
        const srcComp = path.join(pdir, comp.name);
        const destComp = path.join(claudeRoot, comp.name);
        for (const skill of fs.readdirSync(srcComp, { withFileTypes: true })) { // comp='skills' → từng skill-dir
          if (!skill.isDirectory()) continue;
          if (!effSet.has(`${id}/${skill.name}`)) continue;
          fs.mkdirSync(destComp, { recursive: true });         // dir TỔNG HỢP là thật (gộp nhiều plugin)
          placeEntry(path.join(srcComp, skill.name), path.join(destComp, skill.name), ctx);
        }
      }
      // .mcp.json cấp plugin: chỉ đặt khi plugin đó active (có ≥1 skill hiệu lực) → gộp thành <id>.mcp.json
      const mcp = path.join(pdir, '.mcp.json');
      if (fs.existsSync(mcp) && pluginActive(id)) placeEntry(mcp, path.join(claudeRoot, `${id}.mcp.json`), ctx);
    }
  } else if (layout.kind === 'codex') {
    // Codex nạp native skills từ <root>/.codex/skills/<skill-id>/ (global -g → ~/.codex/skills/).
    const skillsRoot = path.join(root, '.codex', 'skills');
    for (const id of fs.readdirSync(pbuild)) {
      const sdir = path.join(pbuild, id, 'skills');
      if (!fs.existsSync(sdir) || !fs.statSync(sdir).isDirectory()) continue;
      for (const skill of fs.readdirSync(sdir, { withFileTypes: true })) {
        if (!skill.isDirectory()) continue; // mỗi skill = 1 thư mục (SKILL.md + assets)
        if (!effSet.has(`${id}/${skill.name}`)) continue;
        placeEntry(path.join(sdir, skill.name), path.join(skillsRoot, skill.name), ctx);
      }
    }
  } else if (layout.kind === 'cursor') {
    // Cursor: rules (<id>-00-principles always-on) + Agent Skills (gọi bằng /skill-id).
    const rulesDir = path.join(root, '.cursor', 'rules');
    const skillsRoot = path.join(root, '.cursor', 'skills');
    for (const id of fs.readdirSync(pbuild)) {
      const base = path.join(pbuild, id);
      if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) continue;
      const rulesSrc = path.join(base, '.cursor', 'rules');
      // Rule 00-principles = generated <id>-principles → ship khi plugin có ≥1 skill hiệu lực.
      if (pluginActive(id) && fs.existsSync(rulesSrc)) {
        for (const e of fs.readdirSync(rulesSrc, { withFileTypes: true })) {
          placeEntry(path.join(rulesSrc, e.name), path.join(rulesDir, e.name), ctx);
        }
      }
      const skillsSrc = path.join(base, '.cursor', 'skills');
      if (!fs.existsSync(skillsSrc)) continue;
      for (const skill of fs.readdirSync(skillsSrc, { withFileTypes: true })) {
        if (!skill.isDirectory()) continue;
        if (!effSet.has(`${id}/${skill.name}`)) continue;
        placeEntry(path.join(skillsSrc, skill.name), path.join(skillsRoot, skill.name), ctx);
      }
    }
  } else if (layout.kind === 'agents') {
    // Antigravity: 1 bundle/plugin (AGENTS.md + docs/workflow/<skill>/). Skill dùng chung của core
    // được gộp vào docs/workflow của TỪNG plugin (giữ id gốc core/<skill>) → lọc theo cả hai tiền tố.
    const activeIds = [...new Set([...effSet].map((s) => s.split('/')[0]))]
      .filter((id) => id !== 'core' && fs.existsSync(path.join(pbuild, id)));
    const single = activeIds.length === 1;
    const shipWorkflow = (id, name) => effSet.has(`${id}/${name}`) || effSet.has(`core/${name}`);
    for (const id of activeIds) {
      const src = path.join(pbuild, id);
      const dest = single ? root : path.join(root, `cowork-${provider}`, id);
      for (const top of fs.readdirSync(src, { withFileTypes: true })) {
        if (top.name === 'docs') {
          const wf = path.join(src, 'docs', 'workflow');
          if (!fs.existsSync(wf)) continue;
          for (const skill of fs.readdirSync(wf, { withFileTypes: true })) {
            if (!skill.isDirectory() || !shipWorkflow(id, skill.name)) continue;
            placeEntry(path.join(wf, skill.name), path.join(dest, 'docs', 'workflow', skill.name), ctx);
          }
        } else {
          placeEntry(path.join(src, top.name), path.join(dest, top.name), ctx); // plugin-level (AGENTS.md…)
        }
      }
    }
  }
  return { files: ctx.files, links: ctx.links };
}

/**
 * Cài providers × plugins ở scope cho trước. Ghi manifest. Trả về tóm tắt.
 * @param {{providers:string[], plugins:string|string[], scope:'project'|'global',
 *          mode?:'skills'|'plugin'}} opts
 *   mode 'plugin' (mặc định 'skills') CHỈ áp dụng cho provider claude — cài qua `claude` CLI
 *   như plugin thật; provider khác luôn ở mode 'skills' (copy/symlink).
 */
export function install({ providers, plugins, skills, scope = 'project', mode = 'skills' }) {
  if (!USE_LINK) console.warn('[aip] Cài qua npm (node_modules) → dùng copy thay vì symlink (bản cài self-contained).');
  const provs = !providers || providers === 'all' ? PROVIDERS : (Array.isArray(providers) ? providers : [providers]);
  // Codex nạp native skills ở mức user (~/.codex/skills). Cài scope=project (.codex/skills/ trong
  // repo) thường KHÔNG được codex đọc → cảnh báo để tránh tưởng đã cài.
  if (scope === 'project' && provs.includes('codex')) {
    console.warn('[aip] codex nạp native skills từ ~/.codex/skills (mức user); cài scope=project ' +
      'thường KHÔNG được codex đọc — cân nhắc cài global: aip install --provider codex -g');
  }
  const root = scopeRoot(scope);
  const m = readManifest(scope);
  const results = [];
  for (const provider of provs) {
    ensureBuilt(provider);

    if (provider === 'claude' && mode === 'plugin') {
      // plugin-mode CHỈ cài NGUYÊN plugin (claude CLI không tách skill). Suy tập plugin DOMAIN từ
      // lựa chọn (khối + plugin của skill lẻ); loại core — core tự kéo qua dependency, không cài tường minh.
      const sel = resolveSelection({ plugins, skills });
      const inferred = pluginsFromSelection(sel).filter((id) => id !== 'core');
      if ((sel.skills || []).length) {
        console.warn('[aip] claude --as-plugin cài NGUYÊN plugin (không tách skill). ' +
          `Cài cả: ${inferred.join(', ')}. Dùng mode skills nếu muốn chọn lẻ.`);
      }
      // CỘNG DỒN: gộp với plugin đã cài cùng mode (install thêm, không thay thế); cùng plugin → refresh.
      const prev = m.installs.find((e) => e.provider === 'claude' && e.mode === 'plugin');
      const effPlugins = prev ? [...new Set([...(prev.plugins || []), ...inferred])] : inferred;
      uninstallEntries(m, root, (e) => e.provider === 'claude'); // gỡ bản claude cũ (skills HOẶC plugin)
      const info = installClaudePlugin({ pluginIds: effPlugins, scope });
      const managed = applyManagedBlock(root, instructionFiles('claude', scope));
      m.installs.push({
        provider: 'claude', mode: 'plugin', plugins: effPlugins, scope,
        marketplace: info.marketplace, cliScope: info.cliScope,
        files: [], links: [], managed, installedAt: new Date().toISOString(),
      });
      results.push({ provider: 'claude', plugins: effPlugins, mode: 'plugin', marketplace: info.marketplace });
      continue;
    }

    // CỘNG DỒN: union khối+lẻ với entry cùng provider (skills-mode) — install thêm, không thay thế.
    const sel = resolveSelection({ plugins, skills });
    const prev = m.installs.find((e) => e.provider === provider && e.mode !== 'plugin');
    const effPlugins = prev ? [...new Set([...(prev.plugins || []), ...sel.plugins])] : sel.plugins;
    const effSkills = prev ? [...new Set([...(prev.skills || []), ...sel.skills])] : sel.skills;
    // chuẩn hoá dedup: skill lẻ đã nằm trong khối → bỏ khỏi skills (khối đã phủ)
    const covered = new Set();
    for (const id of effPlugins) for (const s of allSkillsOf(id)) covered.add(s);
    const skillsFinal = effSkills.filter((s) => !covered.has(s));
    const entry = { provider, plugins: effPlugins, skills: skillsFinal, scope };
    uninstallEntries(m, root, (e) => e.provider === provider); // gỡ bản cũ cùng (provider,scope) rồi cài lại UNION
    const effSet = effectiveSkills(entry);
    const { files, links } = installOne(provider, effSet, scope);
    const rel = (arr) => arr.map((f) => path.relative(root, f).split(path.sep).join('/'));
    const relF = rel(files), relL = rel(links);
    const managed = applyManagedBlock(root, instructionFiles(provider, scope));
    m.installs.push({ ...entry, files: relF, links: relL, managed, installedAt: new Date().toISOString() });
    results.push({ provider, plugins: effPlugins, skills: skillsFinal, linked: relL.length, copied: relF.length, count: relF.length + relL.length });
  }
  writeManifest(scope, m);
  // Cài claude → đóng gói sẵn skill cho Cowork (Cowork không đọc kho plugin local; phải upload .zip).
  let coworkPack = null;
  if (provs.includes('claude')) {
    try { coworkPack = pack(); } catch (e) { console.warn('[aip] đóng gói Cowork lỗi:', e.message); }
  }
  return { root, scope, results, coworkPack };
}

function uninstallEntries(m, root, predicate) {
  const keep = [], remove = [];
  for (const e of m.installs) (predicate(e) ? remove : keep).push(e);
  const dropMkts = marketplacesToRemove(remove, keep); // marketplace không còn ai giữ lại dùng
  const done = new Set();                              // gỡ mỗi marketplace tối đa 1 lần
  let removed = 0;
  for (const e of remove) {
    if (e.mode === 'plugin') {
      const drop = dropMkts.has(e.marketplace) && !done.has(e.marketplace);
      uninstallClaudePlugin(e, { removeMarketplace: drop }); // uỷ cho `claude` CLI gỡ plugin (+marketplace nếu drop)
      if (drop) done.add(e.marketplace);
      removed += (e.plugins || []).length;
    } else {
      for (const rel of e.files) removeFileAndPruneEmpty(path.join(root, rel), root);
      for (const rel of (e.links || [])) removeLinkAndPruneEmpty(path.join(root, rel), root);
      removed += e.files.length + (e.links || []).length;
    }
  }
  // Gỡ khối managed khỏi file chỉ dẫn khi không entry giữ lại nào còn dùng (reference-count).
  for (const rel of managedFilesToClean(remove, keep)) cleanManagedBlock(root, rel);
  m.installs = keep;
  return removed;
}

/** Chuẩn hoá một trục lọc. undefined, 'all' (khi all=true) và mảng RỖNG đều là null = "không lọc
 *  theo trục này". Không quy [] về null thì mệnh đề (!sel || …some(sel.includes)) thành
 *  (false || false) → không entry nào khớp (vd args.skill mặc định []). Export để test. */
export function normFilter(v, all = false) {
  return !v || (all && v === 'all') || (Array.isArray(v) && !v.length) ? null : (Array.isArray(v) ? v : [v]);
}
/** PURE: entry có khớp bộ lọc (đã normFilter) không. Trục null = bỏ qua. plugin khớp theo khối
 *  HOẶC theo prefix của skill lẻ; skill khớp theo tập hiệu lực (gồm generated <plugin>-principles). */
export function entryMatches(e, provs, plugSel, skillSel) {
  return (!provs || provs.includes(e.provider)) &&
    (!plugSel || (e.plugins || []).some((p) => plugSel.includes(p))
      || (e.skills || []).some((s) => plugSel.includes(s.split('/')[0]))) &&
    (!skillSel || [...effectiveSkills(e)].some((s) => skillSel.includes(s)));
}

/** Gỡ cài đặt theo filter provider/plugin/skill/scope. Gỡ LẺ (plugin hoặc skill): khi entry còn
 *  phần khác, gỡ nguyên entry rồi cài lại phần GIỮ (tận dụng install cộng dồn) — vì manifest không
 *  tách file theo skill. Phần GIỮ dựng từ SELECTION NGUỒN của entry (plugins→allSkillsOf + skills lẻ),
 *  KHÔNG dùng effectiveSkills: tập hiệu lực chứa generated `<plugin>-principles` không hợp lệ với
 *  resolveSelection nên sẽ ném khi cài lại. core/principles giữ nguyên trong remaining khi core còn —
 *  resolveSelection tự quy về whole-core, install lại tự ép core/principles. */
export function uninstall({ providers, plugins, skills, scope = 'project' }) {
  const provs = normFilter(providers, true);
  const plugSel = normFilter(plugins, true);
  const skillSel = normFilter(skills);
  const root = scopeRoot(scope);
  const m = readManifest(scope);
  const matched = (e) => entryMatches(e, provs, plugSel, skillSel);

  // Gỡ LẺ (plugin/skill): tính phần GIỮ LẠI của mỗi entry khớp → cài lại sau khi gỡ nguyên entry.
  const reinstall = [];
  if (plugSel || skillSel) {
    const removeSkills = new Set(skillSel || []);
    const removePlugins = new Set(plugSel || []);
    for (const e of m.installs.filter(matched)) {
      if (e.mode === 'plugin') { // plugin-mode chỉ gỡ theo plugin (uỷ `claude` CLI); giữ ngữ nghĩa cũ
        const remaining = (e.plugins || []).filter((p) => !removePlugins.has(p));
        if (remaining.length) reinstall.push({ providers: [e.provider], plugins: remaining, scope, mode: 'plugin' });
        continue;
      }
      const srcSel = new Set(e.skills || []);                        // selection nguồn hợp lệ của entry
      for (const p of (e.plugins || [])) for (const s of allSkillsOf(p)) srcSel.add(s);
      const remaining = [...srcSel].filter((s) =>
        !removeSkills.has(s) && !removePlugins.has(s.split('/')[0]));
      if (remaining.length) reinstall.push({ providers: [e.provider], skills: remaining, scope, mode: 'skills' });
    }
  }

  const removed = uninstallEntries(m, root, matched);
  writeManifest(scope, m);
  for (const r of reinstall) install(r); // cài lại phần GIỮ (install tự ghi manifest)
  return { root, scope, removed };
}

/** Liệt kê đã cài gì ở scope (đọc manifest) + tồn tại file thực tế. */
export function check({ scope = 'project' } = {}) {
  const root = scopeRoot(scope);
  const m = readManifest(scope);
  return {
    root,
    scope,
    manifest: manifestPath(scope),
    installs: m.installs.map((e) => {
      if (e.mode === 'plugin') {
        // do `claude` CLI quản lý (cache + settings.json) → không soi file ở scope root.
        const n = (e.plugins || []).length;
        return { provider: e.provider, plugins: e.plugins, mode: 'plugin',
          marketplace: e.marketplace, files: n, present: n, installedAt: e.installedAt };
      }
      const all = [...e.files, ...(e.links || [])];
      // skills = tập hiệu lực (gồm generated <plugin>-principles) — chỉ để hiển thị/preselect wizard;
      // cây wizard bỏ qua id generated không có trong catalog.
      return {
        provider: e.provider,
        plugins: e.plugins,
        skills: [...effectiveSkills(e)],
        files: all.length,
        present: all.filter((rel) => fs.existsSync(path.join(root, rel))).length,
        installedAt: e.installedAt,
      };
    }),
  };
}

// ── update: cập nhật plugin ĐÃ CÀI (pull → build → cài lại nếu là copy) ─────────
/** git pull nguồn kit (best-effort, --ff-only). Trả {ok, out} hoặc {ok:false, reason}. */
function gitPull() {
  try {
    const out = execFileSync('git', ['pull', '--ff-only'], { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' });
    return { ok: true, out: String(out || '').trim() };
  } catch (err) {
    const detail = (err.stderr || err.stdout || err.message || '').toString().trim().split('\n').filter(Boolean).slice(-1)[0];
    return { ok: false, reason: detail || 'git pull lỗi' };
  }
}

/**
 * aip update — cập nhật các plugin ĐÃ CÀI ở scope, theo trình tự:
 *   1) git pull nguồn kit (best-effort; lỗi thì cảnh báo và vẫn tiếp tục với nguồn hiện tại)
 *   2) build lại các provider (đã lọc) có entry khớp
 *   3) mỗi entry: skills-mode → CÀI LẠI (tái quét build, nhận cả skill mới); plugin → refresh qua `claude` CLI
 * Filter provider/plugin/skill (giống uninstall) chọn ĐÚNG entry cần refresh; bỏ trống = mọi entry.
 * Granularity ở mức ENTRY: một skill/plugin khớp làm tươi CẢ entry chứa nó (entry được reinstall
 * nguyên khối từ build) — trục lọc quyết định entry NÀO được đụng, không tách file trong entry.
 * @param {{scope?:'project'|'global', pull?:boolean, providers?, plugins?, skills?}} opts
 *   pull=false để bỏ qua git (dùng cho test).
 */
export function update({ scope = 'project', pull = true, providers, plugins, skills } = {}) {
  const pulled = pull ? gitPull() : { ok: true, skipped: true };
  const root = scopeRoot(scope);
  const m = readManifest(scope);
  if (!m.installs.length) return { scope, root, pulled, built: [], entries: [], empty: true };

  const provs = normFilter(providers, true);
  const plugSel = normFilter(plugins, true);
  const skillSel = normFilter(skills);
  const targets = m.installs.filter((e) => entryMatches(e, provs, plugSel, skillSel));
  if (!targets.length) return { scope, root, pulled, built: [], entries: [], empty: false, noMatch: true };

  const providersToBuild = [...new Set(targets.map((e) => e.provider))];
  for (const p of providersToBuild) ensureBuilt(p); // "run build" cho đúng provider có entry khớp

  const entries = [];
  for (const e of targets) { // snapshot: install() bên dưới ghi lại manifest
    if (e.mode === 'plugin') {
      try {
        // KHÔNG dùng install-semantics (marketplace add + plugin install đều no-op khi đã cài cùng
        // version → cache giữ bản cũ). Phải FORCE: marketplace update + uninstall/install từng plugin.
        const cmd = claudePluginRefreshCommands({
          pluginIds: e.plugins, scope, marketplaceName: e.marketplace || loadMarketplace().name,
        });
        runClaudeCli(cmd.marketplaceUpdate, { tolerate: true }); // làm mới snapshot nguồn (dir = build/claude)
        for (const p of cmd.pairs) {
          runClaudeCli(p.uninstall, { tolerate: true }); // chưa cài/lỗi lặt vặt → vẫn install tiếp
          runClaudeCli(p.install);                        // ném nếu install thật sự lỗi
        }
        entries.push({ provider: e.provider, plugins: e.plugins, action: 'plugin-refresh', reload: true });
      } catch (err) {
        entries.push({ provider: e.provider, plugins: e.plugins, action: 'plugin-error', reason: err.message });
      }
    } else {
      // Luôn CÀI LẠI (install tái quét thư mục build) — KHÔNG tin vào tập link/file đã ghi lúc cài.
      // Trước đây symlink-install đi nhánh "pass" (chỉ rebuild build/, link cũ tự tươi) nên BỎ SÓT
      // SKILL MỚI thêm sau lần cài đầu (vd core/git-workflow): không có link nào cho skill mới. Re-install
      // gỡ link cũ rồi re-link TOÀN BỘ theo build (idempotent) + tạo link cho skill mới; entry copy re-copy.
      // Dùng SELECTION NGUỒN (plugins khối + skills lẻ) — hợp lệ với resolveSelection. Khối `e.plugins`
      // (kể cả core) mở rộng lại theo kit HIỆN TẠI → nhận skill mới; `e.skills` lẻ giữ cố định, KHÔNG
      // kéo skill anh em.
      install({ providers: [e.provider], plugins: e.plugins || [], skills: e.skills || [], scope, mode: 'skills' });
      entries.push({ provider: e.provider, plugins: e.plugins, action: 'reinstall' });
    }
  }
  return { scope, root, pulled, built: providersToBuild, entries, empty: false };
}
