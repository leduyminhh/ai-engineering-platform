#!/usr/bin/env node
// In JSON khoá `autonomy` hiệu lực của <git-root>/.claude/aip-gate.json cho skill plan-execution.
// Cách dùng: node autonomy.mjs → {"mergeLocal":…,"cleanup":…,"partRunner":…}; import: readAutonomy(cwd, deps?).
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì (không import hook của core).
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULTS = Object.freeze({ mergeLocal: false, cleanup: false, partRunner: 'session' });
const RUNNERS = new Set(['subagent', 'session', 'sequential']);

const defaultGit = (args, cwd) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// true/false khi git trả exit 0/1; mọi kết quả khác là null. Chép rút gọn gateTracked của hook (icase vì FS không phân biệt hoa thường,
// symlink thì hỏi cả đường dẫn thật) vì script skill phải tự đứng, không import hook.
function trackedByGit(file) {
  const ask = (dir, name) => {
    try { execFileSync('git', ['-C', dir, 'ls-files', '--error-unmatch', '--', `:(icase)${name}`], { timeout: 3000, stdio: 'ignore' }); return true; } catch (e) { return e?.status === 1 ? false : null; }
  };
  const root = path.dirname(path.dirname(file));
  let linked = false;
  try { linked = lstatSync(path.dirname(file)).isSymbolicLink(); } catch { /* realpath bên dưới báo null */ }
  const logical = linked ? (ask(root, '.claude') ? true : null) : ask(path.dirname(file), path.basename(file));
  let real;
  try { const rp = realpathSync.native(file); real = ask(path.dirname(rp), path.basename(rp)); } catch { real = null; }
  return logical === true || real === true ? true : logical === null || real === null ? null : false;
}

// null = không có file; {} = có file nhưng hỏng (vẫn che repo chính như hook gate-config); còn lại = nội dung.
function readGateAt(root) {
  let raw;
  try { raw = readFileSync(path.join(root, '.claude', 'aip-gate.json'), 'utf8'); } catch (e) { return e?.code === 'ENOENT' ? null : {}; }
  try { const v = JSON.parse(raw.replace(/^﻿/, '')); return isObj(v) ? v : {}; } catch { return {}; }
}

// ignored: 'tracked' | 'unknown' khi file có khoá autonomy bị bỏ qua (xem dưới), ngược lại null.
export function resolveAutonomy(cwd = process.cwd(), deps = {}) {
  const git = deps.git ?? defaultGit;
  let top = cwd;
  let main = null;
  let inRepo = false;
  try {
    top = git(['rev-parse', '--show-toplevel'], cwd);
    main = path.dirname(git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd));
    inRepo = true;
  } catch { /* không phải repo hoặc không có git: chỉ đọc cwd */ }
  const own = readGateAt(top);
  const mainGate = own ? null : main ? readGateAt(main) : null;
  const gate = own ?? mainGate ?? {};
  const file = path.join(own ? top : main ?? top, '.claude', 'aip-gate.json');
  // File đã commit đến từ clone nên không được tự cấp merge local/dọn không hỏi (như `mode: full` ở hook); không xác định được cũng bỏ qua.
  // Ngoài repo git không có clone nào để tin, nên đọc như cũ. Chỉ hỏi git khi file thật sự có khoá.
  const tracked = gate.autonomy !== undefined && inRepo ? (deps.tracked ?? trackedByGit)(file) : false;
  const ignored = tracked === true ? 'tracked' : tracked === null ? 'unknown' : null;
  const a = !ignored && isObj(gate.autonomy) ? gate.autonomy : {};
  return { ignored, value: {
    mergeLocal: typeof a.mergeLocal === 'boolean' ? a.mergeLocal : DEFAULTS.mergeLocal,
    cleanup: typeof a.cleanup === 'boolean' ? a.cleanup : DEFAULTS.cleanup,
    partRunner: RUNNERS.has(a.partRunner) ? a.partRunner : DEFAULTS.partRunner,
  } };
}

export const readAutonomy = (cwd, deps) => resolveAutonomy(cwd, deps).value;

// Gate đọc theo cwd: chạy sau khi `cd` vào thư mục skill sẽ đọc aip-gate.json của repo chứa plugin
// (bản cài từ source nằm trong clone aip) và cấp mergeLocal/cleanup của project khác.
export function insidePlugin(cwd, scriptFile) {
  const pluginRoot = path.resolve(scriptFile, '..', '..', '..', '..');
  const rel = path.relative(pluginRoot, path.resolve(cwd));
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) {
  let cwd = process.cwd();
  try { cwd = realpathSync.native(cwd); } catch { /* giữ cwd như process báo */ }
  if (insidePlugin(cwd, realpathSync(fileURLToPath(import.meta.url)))) {
    console.error('autonomy.mjs phải chạy từ gốc project đích, không phải từ trong thư mục plugin/skill: gọi `node <thư mục skill>/scripts/autonomy.mjs` mà không `cd`.');
    process.exitCode = 2;
  } else console.log(JSON.stringify(readAutonomy()));
}
