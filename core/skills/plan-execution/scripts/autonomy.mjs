#!/usr/bin/env node
// In JSON khoá `autonomy` hiệu lực của <git-root>/.claude/aip-gate.json cho skill plan-execution.
// Cách dùng: node autonomy.mjs → {"mergeLocal":…,"cleanup":…,"partRunner":…,"planRunner":…}; import: readAutonomy(cwd, deps?).
// node autonomy.mjs --set <planRunner|partRunner>=<giá trị> lưu gợi ý cách chạy (không phải quyền; chỉ đổi thứ tự lựa chọn của thẻ hỏi).
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì; đọc aip-gate.json qua bản sao gate-file.mjs cạnh nó
// (skills mode không có cây hook để import).
import { existsSync, lstatSync, mkdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { locateGate, readGateAt, gateTracked, lsFiles, trustedValue } from './gate-file.mjs';

export const DEFAULTS = Object.freeze({ mergeLocal: false, cleanup: false, partRunner: 'session', planRunner: 'subagent' });
const RUNNERS = new Set(['subagent', 'session', 'sequential']);
const PLAN_RUNNERS = new Set(['subagent', 'inline']);

const defaultGit = (args, cwd) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();

// Bỏ cache của gateTracked: aip autonomy và test gọi nhiều lần trong một tiến trình, trạng thái git có thể đổi giữa các lần.
const freshTracked = (file) => gateTracked(file, { run: (dir, spec) => lsFiles(dir, spec) });

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ignored: 'tracked' | 'unknown' khi file có khoá autonomy bị bỏ qua (khoá `untracked` của gate-file.mjs), ngược lại null.
// File hỏng của worktree vẫn che repo chính và cho mặc định an toàn, như hook.
export function resolveAutonomy(cwd = process.cwd(), deps = {}) {
  const g = locateGate(cwd, { git: deps.git ?? defaultGit });
  let state = false;
  const raw = trustedValue(g, 'autonomy', { tracked: (f) => (state = (deps.tracked ?? freshTracked)(f)) });
  const ignored = state === true ? 'tracked' : state === null ? 'unknown' : null;
  const a = isObj(raw) ? raw : {};
  return { ignored, value: {
    mergeLocal: typeof a.mergeLocal === 'boolean' ? a.mergeLocal : DEFAULTS.mergeLocal,
    cleanup: typeof a.cleanup === 'boolean' ? a.cleanup : DEFAULTS.cleanup,
    partRunner: RUNNERS.has(a.partRunner) ? a.partRunner : DEFAULTS.partRunner,
    planRunner: PLAN_RUNNERS.has(a.planRunner) ? a.planRunner : DEFAULTS.planRunner,
  } };
}

export const readAutonomy = (cwd, deps) => resolveAutonomy(cwd, deps).value;

const SETTABLE = { planRunner: PLAN_RUNNERS, partRunner: RUNNERS };

// true/false khi git check-ignore thoát 0/1; mọi kết quả khác là null.
function gitIgnored(file) {
  try { execFileSync('git', ['-C', path.dirname(file), 'check-ignore', '-q', '--', path.basename(file)], { timeout: 3000, stdio: 'ignore' }); return true; } catch (e) { return e?.status === 1 ? false : null; }
}

// Lưu gợi ý cách chạy. Chỉ hai khoá sở thích: mergeLocal/cleanup/mode không ghi được từ đây nên lệnh này không nâng quyền.
// code: 0 = đã ghi hoặc bỏ qua có lý do, 1 = file hỏng (không ghi), 2 = sai khoá/giá trị.
export function setRunner(key, value, cwd = process.cwd(), deps = {}) {
  const allowed = Object.hasOwn(SETTABLE, key) ? SETTABLE[key] : null;
  if (!allowed || !allowed.has(value)) {
    return { code: 2, message: `--set chỉ nhận planRunner=${[...PLAN_RUNNERS].join('|')} hoặc partRunner=${[...RUNNERS].join('|')} (nhận: ${JSON.stringify(key)}=${JSON.stringify(value)})` };
  }
  const { top, main, inRepo } = locateGate(cwd, { git: deps.git ?? defaultGit });
  const at = (root) => path.join(root, '.claude', 'aip-gate.json');
  // Cùng thứ tự với resolveAutonomy: file của worktree che file repo chính; chưa có file nào thì tạo ở repo chính để còn lại khi worktree bị dọn.
  const file = existsSync(at(top)) ? at(top) : main && existsSync(at(main)) ? at(main) : at(main ?? top);
  // Ghi xuyên symlink/junction (file hoặc thư mục .claude) có thể tạo file ngoài project; bỏ qua như file đã theo dõi.
  const linked = (p) => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };
  if (linked(file) || linked(path.dirname(file))) return { code: 0, message: `Bỏ qua: ${file} hoặc thư mục .claude là symlink/junction, không lưu gợi ý ${key}.` };
  let gate = {};
  const read = readGateAt(path.dirname(path.dirname(file)));
  if (read) {
    if (read.invalid) return { code: 1, message: `${file} không phải đối tượng JSON hợp lệ; sửa tay trước khi lưu gợi ý.` };
    gate = read.config;
    // File đã commit: ghi vào làm bẩn cây, và khoá autonomy của nó bị bỏ qua nên gợi ý cũng không có hiệu lực.
    const tracked = inRepo ? (deps.tracked ?? freshTracked)(file) : false;
    if (tracked !== false) {
      return { code: 0, message: `Bỏ qua: ${file} ${tracked ? 'đang được git theo dõi' : 'không xác định được trạng thái git'}, không lưu gợi ý ${key}.` };
    }
  }
  if (isObj(gate.autonomy) && gate.autonomy[key] === value) return { code: 0, message: `${key}=${value} đã có trong ${file}` };
  const next = { ...gate, autonomy: { ...(isObj(gate.autonomy) ? gate.autonomy : {}), [key]: value } };
  mkdirSync(path.dirname(file), { recursive: true });
  // Ghi tạm rồi đổi tên: ngắt giữa chừng hay hai phiên cùng ghi không để file cụt (hook coi file hỏng là che cấu hình repo chính).
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n', 'utf8');
  renameSync(tmp, file);
  // File chưa gitignore mà bị commit thì khoá autonomy bị bỏ qua (như `aip autonomy high` cảnh báo); null = không xác định, không cảnh báo.
  const warn = inRepo && (deps.ignored ?? gitIgnored)(file) === false
    ? `\n  ⚠ ${file} chưa được gitignore; nếu bị commit, khoá autonomy bị bỏ qua. Thêm dòng .claude/aip-gate.json vào .gitignore (aip không tự sửa .gitignore).`
    : '';
  return { code: 0, message: `✓ ${key}=${value} → ${file}${warn}` };
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
