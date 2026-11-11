// Nơi đọc <git-root>/.claude/aip-gate.json duy nhất cho hook, CLI và script plan-execution; không phải hook, chỉ được import.
// Có bản sao giống hệt byte ở core/skills/plan-execution/scripts/gate-file.mjs vì script đó chạy ở skills mode, nơi không có cây hook;
// sửa file này thì chép nguyên sang bản kia (test/contract/98-gate-file.contract.mjs báo lệch). Chỉ import built-in `node:`.
import { readFileSync, existsSync, realpathSync, lstatSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// `untracked`: khoá nới quyền, chỉ có hiệu lực khi file không bị git theo dõi, vì file đã commit đến từ clone mà người dùng chưa xét.
// `any`: khoá siết hoặc trung tính, file đã commit chỉ làm hook chặt hơn hoặc đổi thông tin hiển thị.
export const GATE_KEYS = Object.freeze({
  mode: { type: 'string', trust: 'untracked' },
  autonomy: { type: 'object', trust: 'untracked' },
  allowEnvFiles: { type: 'boolean', trust: 'untracked' },
  stopGate: { type: 'boolean', trust: 'untracked' },
  exemptAgents: { type: 'array', trust: 'untracked' },
  fullKeep: { type: 'array', trust: 'any' },
  fullRoots: { type: 'array', trust: 'any' },
  fullReadRoots: { type: 'array', trust: 'any' },
  mcpAllow: { type: 'array', trust: 'any' },
  mcpDeny: { type: 'array', trust: 'any' },
  testCommands: { type: 'array', trust: 'any' },
  bootstrapInject: { type: 'boolean', trust: 'any' },
  handoffInject: { type: 'boolean', trust: 'any' },
  ledgerInject: { type: 'boolean', trust: 'any' },
  resumeWarn: { type: 'boolean', trust: 'any' },
  handoffPath: { type: 'string', trust: 'any' },
  handoffMaxAgeHours: { type: 'number', trust: 'any' },
  statusStaleMinutes: { type: 'number', trust: 'any' },
});

const gateFileOf = (root) => path.join(root, '.claude', 'aip-gate.json');

const defaultGit = (args, cwd) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();

// null = file thiếu hẳn; { invalid } = tồn tại nhưng không đọc/parse được hoặc không phải đối tượng; { config } = hợp lệ.
export function readGateAt(root) {
  let raw;
  try { raw = readFileSync(gateFileOf(root), 'utf8'); } catch (e) { return e?.code === 'ENOENT' ? null : { invalid: true }; }
  try {
    const config = JSON.parse(raw.replace(/^﻿/, ''));
    return config && typeof config === 'object' && !Array.isArray(config) ? { config } : { invalid: true };
  } catch { return { invalid: true }; }
}

// Gốc worktree trước rồi tới gốc repo chính: worktree con tạo trước khi commit file cấu hình vẫn theo project.
// Thư mục có thể chưa tồn tại (Write tạo mới) nên đi lên thư mục cha gần nhất đã có.
// Ngoài repo git: đọc thẳng <cwd>/.claude/aip-gate.json, inRepo=false (hook tự quyết bỏ qua, CLI và script vẫn đọc).
export function locateGate(cwd, { git = defaultGit } = {}) {
  let d = path.resolve(cwd || '.');
  while (!existsSync(d) && path.dirname(d) !== d) d = path.dirname(d);
  let top;
  try { top = path.resolve(git(['rev-parse', '--show-toplevel'], d)); } catch {
    const own = readGateAt(d);
    return { inRepo: false, top: d, main: null, roots: [d], ...pick(own, d), mainInvalid: null };
  }
  let main = null;
  try {
    const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], d);
    // Submodule: common-dir là <cha>/.git/modules/<tên>, dirname của nó nằm trong .git của repo cha; dùng gốc của chính submodule.
    main = path.resolve(path.basename(common) === '.git' ? path.dirname(common) : top);
  } catch { /* chỉ còn gốc worktree */ }
  const roots = [...new Set([top, main].filter(Boolean))];
  const base = { inRepo: true, top, main, roots, mainInvalid: null };
  const own = readGateAt(top);
  // File worktree hỏng vẫn che file repo chính: rơi về repo chính sẽ dùng một cấu hình mà người dùng đã cố ghi đè.
  if (own || !main || main === top) return { ...base, ...pick(own, top) };
  const fromMain = readGateAt(main);
  if (fromMain?.invalid) return { ...base, config: null, file: null, source: null, mainInvalid: gateFileOf(main) };
  return { ...base, ...(fromMain ? { config: fromMain.config, file: gateFileOf(main), source: 'main' } : pick(null, top)) };
}

function pick(state, root) {
  if (!state) return { config: null, file: null, source: null };
  if (state.invalid) return { config: null, file: gateFileOf(root), source: 'worktree-invalid' };
  return { config: state.config, file: gateFileOf(root), source: 'worktree' };
}

const trackedCache = new Map();
export const lsFiles = (dir, spec) => { execFileSync('git', ['-C', dir, 'ls-files', '--error-unmatch', '--', spec], { timeout: 3000, stdio: ['ignore', 'ignore', 'ignore'] }); return 0; };

// true/false khi git trả đúng exit 0/1; mọi kết quả khác (128, không có git, quá giờ, run trả không phải số) là null.
// Hỏi repo thật sự chứa file (realpath: .claude có thể là symlink hay submodule) bằng pathspec icase: FS không phân biệt hoa thường
// còn pathspec thì có, nên AIP-GATE.json đã commit vẫn được hook đọc mà ls-files thường báo chưa theo dõi.
// Symlink: file hay thư mục chứa nó là link đã commit thì đích có thể chưa theo dõi nên kiểm cả đường dẫn logic lẫn đường dẫn thật;
// một trong hai theo dõi ⇒ true, không xác định được ⇒ null. Tối đa 2 lời gọi git mỗi file.
// Có `run` (seam test) thì bỏ qua cache để đếm lời gọi xác định.
export function gateTracked(file, { run = lsFiles } = {}) {
  const useCache = run === lsFiles;
  if (useCache && trackedCache.has(file)) return trackedCache.get(file);
  const ask = (dir, name) => {
    try { const r = run(dir, `:(icase)${name}`); return r === 0 ? true : r === 1 ? false : null; } catch (e) { return e?.status === 1 ? false : null; }
  };
  const dir = path.dirname(file);
  let linkedDir = false;
  try { linkedDir = lstatSync(dir).isSymbolicLink(); } catch { /* realpath bên dưới sẽ báo null */ }
  // Thư mục chứa là link: ls-files không báo lỗi mà trả exit 1 cho đường dẫn xuyên link, nên hỏi chính mục link; link chưa commit ⇒ không đoán được ⇒ null.
  const logical = linkedDir ? (ask(path.dirname(dir), path.basename(dir)) === true ? true : null) : ask(dir, path.basename(file));
  let real;
  try { const rp = realpathSync.native(file); real = ask(path.dirname(rp), path.basename(rp)); } catch { real = null; }
  const res = logical === true || real === true ? true : logical === null || real === null ? null : false;
  if (useCache) trackedCache.set(file, res);
  return res;
}

// Khoá `untracked` chỉ trả giá trị khi file không bị theo dõi; bị theo dõi hoặc không xác định ⇒ undefined để consumer rơi về mặc định.
// Chỉ hỏi git khi khoá thật sự có trong config, nên phiên thường không tốn lần spawn nào. Cấu hình tiêm (không có `file`) coi là đáng tin.
export function trustedValue(gate, key, { tracked = gateTracked } = {}) {
  const cfg = gate?.config;
  if (!cfg || !Object.hasOwn(cfg, key)) return undefined;
  if (GATE_KEYS[key]?.trust !== 'untracked' || gate.inRepo === false || !gate.file) return cfg[key];
  return tracked(gate.file) === false ? cfg[key] : undefined;
}

const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

// Chỉ xét tên khoá và kiểu; miền giá trị (vd mode: "foo") để consumer coi như mặc định.
export function lintGate(config) {
  const unknown = [];
  const badType = [];
  for (const [k, v] of Object.entries(config ?? {})) {
    const meta = GATE_KEYS[k];
    if (!meta) unknown.push(k);
    else if (typeOf(v) !== meta.type) badType.push(k);
  }
  return { unknown, badType };
}
