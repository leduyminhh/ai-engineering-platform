#!/usr/bin/env node
// In JSON khoá `autonomy` hiệu lực của <git-root>/.claude/aip-gate.json cho skill plan-execution.
// Cách dùng: node autonomy.mjs → {"mergeLocal":…,"cleanup":…,"partRunner":…,"planRunner":…}; import: readAutonomy(cwd, deps?).
// node autonomy.mjs --set <planRunner|partRunner>=<giá trị> lưu gợi ý cách chạy (không phải quyền; chỉ đổi thứ tự lựa chọn của thẻ hỏi).
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì (không import hook của core).
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULTS = Object.freeze({ mergeLocal: false, cleanup: false, partRunner: 'session', planRunner: 'subagent' });
const RUNNERS = new Set(['subagent', 'session', 'sequential']);
const PLAN_RUNNERS = new Set(['subagent', 'inline']);

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

function locate(cwd, git) {
  try {
    const top = git(['rev-parse', '--show-toplevel'], cwd);
    const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
    // Submodule: common-dir là <cha>/.git/modules/<tên>, dirname của nó nằm trong .git của repo cha; dùng gốc của chính submodule (cùng guard với route.mjs).
    return { top, main: path.basename(common) === '.git' ? path.dirname(common) : top, inRepo: true };
  } catch { /* không phải repo hoặc không có git: chỉ đọc cwd */ return { top: cwd, main: null, inRepo: false }; }
}

// ignored: 'tracked' | 'unknown' khi file có khoá autonomy bị bỏ qua (xem dưới), ngược lại null.
export function resolveAutonomy(cwd = process.cwd(), deps = {}) {
  const git = deps.git ?? defaultGit;
  const { top, main, inRepo } = locate(cwd, git);
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
    planRunner: PLAN_RUNNERS.has(a.planRunner) ? a.planRunner : DEFAULTS.planRunner,
  } };
}

export const readAutonomy = (cwd, deps) => resolveAutonomy(cwd, deps).value;

const SETTABLE = { planRunner: PLAN_RUNNERS, partRunner: RUNNERS };

// Lưu gợi ý cách chạy. Chỉ hai khoá sở thích: mergeLocal/cleanup/mode không ghi được từ đây nên lệnh này không nâng quyền.
// code: 0 = đã ghi hoặc bỏ qua có lý do, 1 = file hỏng (không ghi), 2 = sai khoá/giá trị.
export function setRunner(key, value, cwd = process.cwd(), deps = {}) {
  const allowed = Object.hasOwn(SETTABLE, key) ? SETTABLE[key] : null;
  if (!allowed || !allowed.has(value)) {
    return { code: 2, message: `--set chỉ nhận planRunner=${[...PLAN_RUNNERS].join('|')} hoặc partRunner=${[...RUNNERS].join('|')} (nhận: ${key}=${value})` };
  }
  const { top, main, inRepo } = locate(cwd, deps.git ?? defaultGit);
  const at = (root) => path.join(root, '.claude', 'aip-gate.json');
  // Cùng thứ tự với resolveAutonomy: file của worktree che file repo chính; chưa có file nào thì tạo ở repo chính để còn lại khi worktree bị dọn.
  const file = existsSync(at(top)) ? at(top) : main && existsSync(at(main)) ? at(main) : at(main ?? top);
  let gate = {};
  if (existsSync(file)) {
    try {
      gate = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
    } catch { gate = null; }
    if (!isObj(gate)) return { code: 1, message: `${file} không phải đối tượng JSON hợp lệ; sửa tay trước khi lưu gợi ý.` };
    // File đã commit: ghi vào làm bẩn cây, và khoá autonomy của nó bị bỏ qua nên gợi ý cũng không có hiệu lực.
    const tracked = inRepo ? (deps.tracked ?? trackedByGit)(file) : false;
    if (tracked !== false) {
      return { code: 0, message: `Bỏ qua: ${file} ${tracked ? 'đang được git theo dõi' : 'không xác định được trạng thái git'}, không lưu gợi ý ${key}.` };
    }
  }
  if (isObj(gate.autonomy) && gate.autonomy[key] === value) return { code: 0, message: `${key}=${value} đã có trong ${file}` };
  const next = { ...gate, autonomy: { ...(isObj(gate.autonomy) ? gate.autonomy : {}), [key]: value } };
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return { code: 0, message: `✓ ${key}=${value} → ${file}` };
}

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
  } else if (process.argv[2] === '--set') {
    const arg = process.argv[3] ?? '';
    const i = arg.indexOf('=');
    const r = i < 0 ? { code: 2, message: 'Cách dùng: autonomy.mjs --set <planRunner|partRunner>=<giá trị>' } : setRunner(arg.slice(0, i), arg.slice(i + 1), cwd);
    (r.code === 0 ? console.log : console.error)(r.message);
    process.exitCode = r.code;
  } else console.log(JSON.stringify(readAutonomy()));
}
