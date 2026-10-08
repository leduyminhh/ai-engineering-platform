#!/usr/bin/env node
// Cổng version: cache plugin của Claude Code key theo version, nên nội dung build đổi mà version
// không đổi thì người dùng không bao giờ nhận bản mới. Lock ghi hash build của từng plugin tại version
// đã commit; --lock từ chối khi hash đổi mà version chưa bump; validate kiểm lock khớp build hiện tại.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from './plugins.mjs';

export const LOCK_PATH = path.join(REPO_ROOT, 'plugins', '_versions.lock.json');
const BUILD_CLAUDE_PLUGINS = path.join(REPO_ROOT, 'build', 'claude', 'plugins');

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

export function hashDir(dir) {
  const h = createHash('sha256');
  for (const rel of walk(dir)) {
    h.update(rel); h.update('\0');
    h.update(fs.readFileSync(path.join(dir, rel))); h.update('\0');
  }
  return h.digest('hex');
}

export function currentVersions({ buildDir = BUILD_CLAUDE_PLUGINS } = {}) {
  const out = {};
  if (!fs.existsSync(buildDir)) return out;
  for (const e of fs.readdirSync(buildDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const pj = path.join(buildDir, e.name, '.claude-plugin', 'plugin.json');
    if (!fs.existsSync(pj)) continue;
    const { version } = JSON.parse(fs.readFileSync(pj, 'utf8'));
    out[e.name] = { version, hash: hashDir(path.join(buildDir, e.name)) };
  }
  return out;
}

export function readLock(p = LOCK_PATH) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
}

/** Thuần: lock mới từ build hiện tại; entry hash đổi nhưng version giữ nguyên bị từ chối (giữ entry cũ). */
export function planLock(current, previous) {
  const next = {};
  const refused = [];
  for (const id of Object.keys(current).sort()) {
    const cur = current[id];
    const old = previous[id];
    if (old && old.hash !== cur.hash && old.version === cur.version) {
      refused.push({ id, version: cur.version, reason: 'nội dung build đổi nhưng version chưa bump' });
      next[id] = old;
    } else {
      next[id] = cur;
    }
  }
  return { next, refused };
}

/** Thuần: lệch giữa build hiện tại và lock đã commit. */
export function diffLock(current, lock) {
  const errs = [];
  for (const id of Object.keys(current).sort()) {
    const l = lock[id];
    if (!l) { errs.push(`${id}: chưa có trong lock`); continue; }
    if (l.version !== current[id].version) errs.push(`${id}: lock ghi ${l.version}, build là ${current[id].version}`);
    else if (l.hash !== current[id].hash) errs.push(`${id}: build đổi so với lock (version ${l.version})`);
  }
  for (const id of Object.keys(lock)) if (!current[id]) errs.push(`${id}: có trong lock nhưng không còn trong build`);
  return errs;
}

function main(argv) {
  const current = currentVersions();
  if (!Object.keys(current).length) { console.error('Chưa có build/claude/plugins — chạy npm run build trước.'); return 2; }
  if (argv.includes('--lock')) {
    const { next, refused } = planLock(current, readLock());
    for (const r of refused) console.error(`✗ ${r.id}@${r.version}: ${r.reason} — bump version trong manifest rồi chạy lại.`);
    fs.writeFileSync(LOCK_PATH, JSON.stringify(next, null, 2) + '\n');
    console.log(`Đã ghi ${path.relative(REPO_ROOT, LOCK_PATH)} (${Object.keys(next).length} plugin).`);
    return refused.length ? 1 : 0;
  }
  const diff = diffLock(current, readLock());
  for (const d of diff) console.error(`✗ ${d}`);
  console.log(diff.length ? `${diff.length} lệch — chạy: node cli/lib/versions.mjs --lock` : 'versions lock khớp build.');
  return diff.length ? 1 : 0;
}

const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
