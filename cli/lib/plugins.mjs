// Plugin loader — reads the tool-agnostic source of truth in plugins/ into a model
// that adapters consume. Each plugins/<id>/ is ONE plugin (one workflow) with its own
// manifest, principles, and ordered stages. Zero dependencies (Node built-ins only).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSourceKeys } from './conventions.mjs';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PLUGINS_DIR = path.join(REPO_ROOT, 'plugins');
export const CORE_DIR = path.join(REPO_ROOT, 'core');
export const WORKFLOWS_DIR = path.join(REPO_ROOT, 'workflows');

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
// Normalize CRLF -> LF so the model is line-ending agnostic regardless of how source
// files were authored (Windows checkouts are often CRLF); adapters then emit canonical LF.
function readText(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : ''; }

/** Danh sách nguồn: chuỗi "a, b" (dạng cũ) hoặc YAML list. */
export function splitList(v) {
  const items = Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(',') : [];
  return items.map((s) => s.trim()).filter(Boolean);
}

/**
 * Chuẩn hoá mảng `published` thô → map {pluginId: '*' | string[fullSkillId]}. Phần tử "plugin"
 * (không có dấu /) = CẢ plugin (mọi skill); "plugin/skill" = CHỈ skill đó. '*' đè mọi entry lẻ cùng
 * plugin. Không phải mảng → null. Export để test.
 * @returns {Object<string,'*'|string[]>|null}
 */
export function normalizePublished(raw) {
  if (!Array.isArray(raw)) return null;
  const map = {};
  for (const e of raw) {
    if (typeof e !== 'string') continue;
    if (e.includes('/')) {
      const plug = e.split('/')[0];
      if (map[plug] === '*') continue;
      (map[plug] ||= []).push(e);
    } else {
      map[e] = '*';
    }
  }
  return map;
}

/**
 * Map plugin ĐÃ published (nguồn sự thật cho wizard offer; KHÔNG quyết định nội dung gói npm —
 * gói chỉ ship core, xem pack.config.json): {pluginId: '*'|[fullSkillId]}.
 * Thiếu file/shape sai → null = "không giới hạn" (mọi plugin/skill trên đĩa đều offer).
 * @returns {Object<string,'*'|string[]>|null}
 */
export function loadPublished() {
  const p = path.join(PLUGINS_DIR, '_published.json');
  if (!fs.existsSync(p)) return null;
  try { return normalizePublished(readJSON(p).published); } catch { return null; }
}

/** Marketplace identity — used by the claude adapter to assemble a multi-plugin marketplace. */
export function loadMarketplace() {
  const p = path.join(PLUGINS_DIR, '_marketplace.json');
  return fs.existsSync(p)
    ? readJSON(p)
    : { name: 'workflow-kit', owner: { name: 'unknown' }, description: '' };
}

/**
 * Đọc nguyên tắc CORE từ core/principles/ — nối mọi file .md (sắp theo tên) để có thể
 * tách nguyên tắc thành nhiều file và mở rộng sau này. Fallback file đơn core/principles.md (legacy).
 */
function readCorePrinciples() {
  const dir = path.join(CORE_DIR, 'principles');
  if (!fs.existsSync(dir)) return readText(path.join(CORE_DIR, 'principles.md'));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  return files.map((f) => readText(path.join(dir, f))).join('\n\n');
}

/**
 * Shared CORE principles ("always-on" baseline) referenced by EVERY plugin.
 * Adapters prepend this before each plugin's domain-specific principles. The claude
 * adapter additionally materializes core as a standalone plugin that domain plugins
 * declare as a dependency, so installing any plugin always pulls in the core logic.
 * Ngoài principles, core còn có SKILL DÙNG CHUNG ở core/skills/<id>/SKILL.md (vd
 * git-workflow) — load bằng cùng cơ chế loadSkills như plugin, ship kèm core ở mọi adapter.
 * id/name/description/version đọc từ core/.manifest.json, cùng cơ chế với plugin.
 * @returns {{id:string, name:string, description:string, version:string, principles:string, stages:Array}}
 */
export function loadCore() {
  const manifest = readJSON(path.join(CORE_DIR, '.manifest.json'));
  return {
    id: manifest.id || 'core',
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    manifest,
    principles: readCorePrinciples(),
    stages: loadSkills(CORE_DIR),
    agents: [],
  };
}

/**
 * Parser frontmatter zero-dep cho tập con YAML mà repo dùng: scalar một dòng (chuỗi "…" kiểu JSON, '…',
 * số nguyên, true/false/null, plain), list inline `[a, b]`, block list `- x` và map một cấp `k: v` thụt lề.
 */
export function parseFrontmatter(text) {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (/^\s/.test(line)) throw new Error(`frontmatter: dòng thụt lề không thuộc khoá nào: "${line.trim()}"`);
    const c = line.indexOf(':');
    if (c === -1 || /^-(\s|$)/.test(line)) throw new Error(`frontmatter: dòng cấp cao không phải "khoá: giá trị" hoặc phần tử list của khoá nào: "${line.trim()}"`);
    const key = line.slice(0, c).trim();
    const raw = line.slice(c + 1).trim();
    if (raw !== '') { meta[key] = parseInline(raw); continue; }
    const block = [];
    // Block list YAML hợp lệ cả khi `- x` nằm sát lề trái.
    while (i + 1 < lines.length && /^(\s+\S|-(\s|$))/.test(lines[i + 1])) block.push(lines[++i].trim());
    if (!block.length) { meta[key] = ''; continue; }
    if (block.every((b) => b === '-' || b.startsWith('- '))) {
      meta[key] = block.map((b) => parseScalar(b.slice(1).trim()));
    } else {
      meta[key] = Object.fromEntries(block.map((b) => {
        const j = b.indexOf(':');
        if (j === -1) throw new Error(`frontmatter: "${key}" trộn list và map hoặc dòng con sai: "${b}"`);
        return [b.slice(0, j).trim(), parseScalar(b.slice(j + 1).trim())];
      }));
    }
  }
  return { meta, body: m[2] };
}

function parseScalar(raw) {
  if (raw === '') return '';
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw[0] === '"') { try { return JSON.parse(raw); } catch { return raw; } }
  if (raw[0] === "'" && raw.length >= 2 && raw.endsWith("'")) return raw.slice(1, -1).replace(/''/g, "'");
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw;
}

function parseInline(raw) {
  if (!(raw[0] === '[' && raw.endsWith(']'))) return parseScalar(raw);
  const inner = raw.slice(1, -1).trim();
  return inner ? splitOutsideQuotes(inner).map((s) => parseScalar(s.trim())) : [];
}

// Dấu phẩy trong chuỗi quote là nội dung, không phải ranh giới phần tử.
function splitOutsideQuotes(s) {
  const out = [];
  let cur = '', q = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      cur += ch;
      if (ch === '\\' && q === '"' && i + 1 < s.length) cur += s[++i];
      else if (ch === q) q = null;
    } else if (ch === '"' || ch === "'") { q = ch; cur += ch; }
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// Khoá gõ sai trước đây bị bỏ im lặng; ném lỗi để build và test dừng ngay ở file sai.
function assertSourceKeys(kind, meta, file) {
  const errs = checkSourceKeys(kind, meta);
  if (errs.length) throw new Error(`${path.relative(REPO_ROOT, file)}: ${errs.join('; ')}`);
}

/**
 * Load a plugin's skills from `skills/<skill-id>/SKILL.md`. Metadata lives in the SKILL.md
 * frontmatter (order, title, runsIn, invoke, sharedAssets); body is the instructions. Files
 * alongside SKILL.md (e.g. `references/`) are treated as assets to ship.
 * Returns the same internal stage shape adapters already consume, ordered by `order`.
 */
function loadSkills(pluginDir) {
  const skillsDir = path.join(pluginDir, 'skills');
  if (!fs.existsSync(skillsDir)) return [];
  const stages = [];
  for (const e of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const dir = path.join(skillsDir, e.name);
    const skillFile = path.join(dir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const { meta, body } = parseFrontmatter(readText(skillFile));
    assertSourceKeys('skill', meta, skillFile);
    // README.md ở gốc skill = tài liệu cho người đọc repo, KHÔNG ship sang adapter (và tránh bị
    // coi như asset thư mục gây vỡ build khi copyDir vào một file). references/ + thư mục khác vẫn ship.
    const assets = fs.readdirSync(dir).filter((f) => f !== 'SKILL.md' && f !== 'README.md'); // ship alongside (claude)
    const isInit = (meta.name || e.name).endsWith('-init');
    const fileAssets = isInit
      ? [{ name: 'AGENTS.template.md', from: path.join(REPO_ROOT, 'core', 'agents', 'AGENTS.template.md') }]
      : [];
    // Khung chung templates/init/ ship kèm mọi skill *-init (init-qua-skill, kể cả Cowork không CLI).
    const initAssets = isInit
      ? [{ name: 'templates', from: path.join(REPO_ROOT, 'templates', 'init') }]
      : [];
    // Asset DÙNG CHUNG cấp plugin: skill opt-in qua frontmatter `sharedAssets` (danh sách path
    // ngăn cách bởi dấu phẩy, tương đối so với thư mục plugin). Cho phép NHIỀU skill — vd
    // backend-init và một backend-validate sau này — ship CÙNG một cây nguồn
    // (plugins/<id>/templates/architecture) cạnh SKILL.md mà KHÔNG nhân bản file. Tên thư mục
    // đích = basename của mỗi path khai báo.
    const sharedAssets = (typeof meta.sharedAssets === 'string' ? meta.sharedAssets : '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((rel) => ({ name: path.basename(rel), from: path.join(pluginDir, rel) }));
    const dirAssets = [...initAssets, ...sharedAssets];
    stages.push({
      id: meta.name || e.name,
      order: typeof meta.order === 'number' ? meta.order : 0,
      title: meta.title || '',
      description: meta.description || '',
      runsIn: meta.runsIn || '',
      invoke: meta.invoke || '',
      body,
      dir,
      assetsDir: dir,
      assets,
      fileAssets,
      dirAssets,
    });
  }
  stages.sort((a, b) => a.order - b.order);
  return stages;
}

export const loadSkillsFrom = loadSkills;

/** Agent ở `agents/<id>.md`; `skills` trần hiểu là skill cùng plugin. */
function loadAgents(pluginDir, pluginId) {
  const dir = path.join(pluginDir, 'agents');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const { meta, body } = parseFrontmatter(readText(path.join(dir, f)));
    assertSourceKeys('agent', meta, path.join(dir, f));
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
    assertSourceKeys('workflow', meta, file);
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

/**
 * Load every plugin under plugins/. A plugin = a directory containing `.manifest.json`.
 * Names starting with "_" are skipped (e.g. plugins/_marketplace.json is config, not a plugin).
 * Skills are auto-discovered from `skills/<id>/SKILL.md` and ordered by frontmatter `order`.
 * @returns {Array<{id,name,description,version,manifest,shared:{principles:string},stages:Array,dir:string}>}
 */
export function loadPlugins() {
  if (!fs.existsSync(PLUGINS_DIR)) return [];
  const out = [];
  for (const e of fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('_')) continue;
    const dir = path.join(PLUGINS_DIR, e.name);
    const manifestPath = path.join(dir, '.manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = readJSON(manifestPath);
    const id = manifest.id || e.name;
    out.push({
      id,
      name: manifest.name || id,
      description: manifest.description || '',
      version: manifest.version || '0.0.0',
      manifest,
      shared: { principles: readText(path.join(dir, 'shared', 'principles.md')) },
      stages: loadSkills(dir),
      agents: loadAgents(dir, id),
      dir,
    });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}
