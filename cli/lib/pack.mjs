// Đóng gói skill cho Cowork — Cowork nạp skill bằng cách UPLOAD .zip (Customize → Skills),
// KHÔNG đọc kho plugin local của Claude Code. Module này build mỗi skill (theo manifest
// plugins/_cowork.json, mặc định = skill runsIn:plan + core principles) thành build/cowork/<skill>.zip,
// bên trong là THƯ MỤC skill ở gốc (vd backend-init/SKILL.md) — đúng định dạng Cowork cần.
//
// ZIP writer ZERO-DEPENDENCY: zlib.deflateRawSync (built-in) + tự dựng header/central-directory + CRC32.
// Chạy y hệt mọi OS, không cần `zip`/`Compress-Archive`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { REPO_ROOT, PLUGINS_DIR, loadPlugins, loadCore, loadMarketplace } from './plugins.mjs';
import { ensureDir, writeFiles, rmrf } from './write.mjs';
import claudeAdapter from '../../adapters/claude/adapter.mjs';

const COWORK_CONFIG = path.join(PLUGINS_DIR, '_cowork.json');

// ── ZIP writer (zero-dep) ────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Dựng buffer ZIP từ danh sách entry [{ name:'a/b.md', data:Buffer }].
 * Mỗi entry deflate (method 8); nếu deflate không nhỏ hơn thì store (method 0). Date cố định
 * (1980-01-01) để zip tất định. Export để test.
 */
export function zipBuffer(entries) {
  const parts = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const crc = crc32(e.data);
    const comp = zlib.deflateRawSync(e.data);
    const store = comp.length >= e.data.length;
    const method = store ? 0 : 8;
    const body = store ? e.data : comp;
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);            // version needed
    lfh.writeUInt16LE(0, 6);             // flags
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(0, 10);            // mod time
    lfh.writeUInt16LE(0x21, 12);         // mod date = 1980-01-01 (cố định)
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(body.length, 18);  // compressed size
    lfh.writeUInt32LE(e.data.length, 22);// uncompressed size
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);            // extra len
    parts.push(lfh, nameBuf, body);
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);            // version made by
    cdh.writeUInt16LE(20, 6);            // version needed
    cdh.writeUInt16LE(0, 8);
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt16LE(0, 12);
    cdh.writeUInt16LE(0x21, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(body.length, 20);
    cdh.writeUInt32LE(e.data.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);            // extra
    cdh.writeUInt16LE(0, 32);            // comment
    cdh.writeUInt16LE(0, 34);            // disk #
    cdh.writeUInt16LE(0, 36);            // internal attrs
    cdh.writeUInt32LE(0, 38);            // external attrs
    cdh.writeUInt32LE(offset, 42);       // offset of local header
    central.push(cdh, nameBuf);
    offset += lfh.length + nameBuf.length + body.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);                  // disk #
  eocd.writeUInt16LE(0, 6);                  // disk with central dir
  eocd.writeUInt16LE(entries.length, 8);     // entries on this disk
  eocd.writeUInt16LE(entries.length, 10);    // total entries
  eocd.writeUInt32LE(centralBuf.length, 12); // central dir size
  eocd.writeUInt32LE(offset, 16);            // central dir offset
  eocd.writeUInt16LE(0, 20);                 // comment len
  return Buffer.concat([...parts, centralBuf, eocd]);
}

// ── pack ──────────────────────────────────────────────────────────────────────

/**
 * Danh sách skill id ("<plugin>:<skill>") cho Cowork: lấy từ plugins/_cowork.json nếu có
 * "skills" không rỗng; ngược lại suy ra các stage runsIn:plan + "core:principles". Export để test.
 */
export function coworkSkillIds(plugins = loadPlugins()) {
  if (fs.existsSync(COWORK_CONFIG)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(COWORK_CONFIG, 'utf8'));
      if (Array.isArray(cfg.skills) && cfg.skills.length) return cfg.skills;
    } catch { /* hỏng config → suy ra mặc định */ }
  }
  const ids = ['core:principles'];
  for (const p of plugins) for (const s of p.stages) if (s.runsIn === 'plan') ids.push(`${p.id}:${s.id}`);
  return ids;
}

/** Thu thập file của một thư mục skill thành entry ZIP, tên có tiền tố `<prefix>/`. */
function collectEntries(dir, prefix) {
  const out = [];
  (function walk(abs, rel) {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const childRel = `${rel}/${e.name}`;
      const childAbs = path.join(abs, e.name);
      if (e.isDirectory()) walk(childAbs, childRel);
      else out.push({ name: childRel, data: fs.readFileSync(childAbs) });
    }
  })(dir, prefix);
  return out;
}

/**
 * Thuần: tập plugin/core đã LỌC còn đúng các stage nằm trong danh sách cowork `ids` — chỉ những
 * skill này được adapter claude render (KHÔNG build full cây claude). Bỏ plugin không còn stage nào.
 * core giữ nguyên (adapter tự phát skill `principles`); stage core (vd git-workflow) lọc theo ids.
 * Export để test.
 */
export function coworkBuildSet(ids = coworkSkillIds()) {
  const want = new Set(ids);
  const keep = (p) => ({ ...p, stages: p.stages.filter((s) => want.has(`${p.id}:${s.id}`)) });
  const plugins = loadPlugins().map(keep).filter((p) => p.stages.length);
  return { plugins, core: keep(loadCore()) };
}

/**
 * Đóng gói skill Cowork thành build/cowork/<skill>.zip. Render CHỈ các skill trong plugins/_cowork.json
 * qua adapter claude vào THƯ MỤC TẠM (không đụng build/claude, không build full cây). Trả
 * { outDir, packed:[{id,skill,zip}], missing:[] }.
 * @param {{outDir?:string}} opts
 */
export function pack({ outDir } = {}) {
  const ids = coworkSkillIds();
  const out = outDir || path.join(REPO_ROOT, 'build', 'cowork');
  ensureDir(out);
  const { plugins, core } = coworkBuildSet(ids);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-cowork-'));
  try {
    writeFiles(tmp, claudeAdapter.build(plugins, { outDir: tmp, marketplace: loadMarketplace(), core }));
    const pluginsRoot = path.join(tmp, 'plugins');
    const packed = [], missing = [];
    for (const full of ids) {
      const [plugin, skill] = full.includes(':') ? full.split(':') : [null, full];
      const skillDir = plugin ? path.join(pluginsRoot, plugin, 'skills', skill) : null;
      if (!skillDir || !fs.existsSync(skillDir)) { missing.push(full); continue; }
      const zipPath = path.join(out, `${skill}.zip`);
      fs.writeFileSync(zipPath, zipBuffer(collectEntries(skillDir, skill)));
      packed.push({ id: full, skill, zip: zipPath });
    }
    return { outDir: out, packed, missing };
  } finally {
    rmrf(tmp);
  }
}
