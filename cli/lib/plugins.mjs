// Plugin loader — reads the tool-agnostic source of truth in plugins/ into a model
// that adapters consume. Each plugins/<id>/ is ONE plugin (one workflow) with its own
// manifest, principles, and ordered stages. Zero dependencies (Node built-ins only).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PLUGINS_DIR = path.join(REPO_ROOT, 'plugins');
export const CORE_DIR = path.join(REPO_ROOT, 'core');

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
// Normalize CRLF -> LF so the model is line-ending agnostic regardless of how source
// files were authored (Windows checkouts are often CRLF); adapters then emit canonical LF.
function readText(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : ''; }

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
 * Map plugin ĐÃ published (nguồn sự thật cho wizard offer + đóng gói npm): {pluginId: '*'|[fullSkillId]}.
 * Thiếu file/shape sai → null = "không giới hạn" (mọi plugin/skill trên đĩa đều offer/ship).
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
 * @returns {{id:string, name:string, description:string, version:string, principles:string, stages:Array}}
 */
export function loadCore() {
  return {
    id: 'core',
    name: 'Core — Nguyên tắc nền tảng Cowork→Code',
    description:
      'Nguyên tắc nền tảng dùng chung (4 nguyên tắc cốt lõi, 3 tầng tài liệu, ranh giới an toàn, nguồn sự thật) cho mọi plugin workflow Cowork → Code. Mọi plugin phụ thuộc core này.',
    version: '1.1.1',
    principles: readCorePrinciples(),
    stages: loadSkills(CORE_DIR),
  };
}

/**
 * Minimal YAML frontmatter parser for SKILL.md (zero-dep). Handles the controlled subset
 * the kit emits: `key: value` lines where value is a double-quoted string (JSON-escaped),
 * `null`, an integer, or a bare scalar. Returns { meta, body } (body = text after frontmatter).
 */
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const i = line.indexOf(':');
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const raw = line.slice(i + 1).trim();
    let val;
    if (raw === 'null') val = null;
    else if (raw === '') val = '';
    else if (raw[0] === '"') { try { val = JSON.parse(raw); } catch { val = raw; } }
    else if (/^-?\d+$/.test(raw)) val = Number(raw);
    else val = raw;
    meta[key] = val;
  }
  return { meta, body: m[2] };
}

/**
 * Load a plugin's skills from `skills/<skill-id>/SKILL.md`. Workflow metadata lives in the
 * SKILL.md frontmatter (order, stageNumber, title, runsIn, invoke, next); body is the
 * instructions. Files alongside SKILL.md (e.g. `references/`) are treated as assets to ship.
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
      stageNumber: meta.stageNumber || '',
      title: meta.title || '',
      description: meta.description || '',
      runsIn: meta.runsIn || '',
      invoke: meta.invoke || '',
      // pipeline=false đánh dấu "recipe on-demand" — skill KHÔNG thuộc chuỗi bắt buộc
      // init→...→implement (đứng riêng, next=null). Frontmatter parser trả "false" dạng
      // string nên nhận cả hai. Mặc định (thiếu field) = true = stage pipeline.
      pipeline: meta.pipeline === false || meta.pipeline === 'false' ? false : true,
      next: meta.next === undefined ? null : meta.next,
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
      dir,
    });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}
