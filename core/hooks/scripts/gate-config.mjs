// Đọc <git-root>/.claude/aip-gate.json cho các hook của core; không phải hook, chỉ được import.
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

function git(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

// null = file thiếu hẳn; { invalid } = tồn tại nhưng không đọc/parse được hoặc không phải đối tượng; { config } = hợp lệ.
function readState(root) {
  let raw;
  try { raw = readFileSync(path.join(root, '.claude', 'aip-gate.json'), 'utf8'); } catch (e) { return e?.code === 'ENOENT' ? null : { invalid: true }; }
  try {
    const config = JSON.parse(raw.replace(/^﻿/, ''));
    return config && typeof config === 'object' && !Array.isArray(config) ? { config } : { invalid: true };
  } catch { return { invalid: true }; }
}

// Gốc worktree trước rồi tới gốc repo chính: worktree con tạo trước khi commit file cấu hình vẫn theo project.
// Thư mục có thể chưa tồn tại (Write tạo mới) nên đi lên thư mục cha gần nhất đã có.
// `roots` gồm gốc worktree và gốc repo chính (loại trùng) để hook `full` biết file đích thuộc project nào.
export function resolveGate(dir) {
  let d = path.resolve(dir || '.');
  while (!existsSync(d) && path.dirname(d) !== d) d = path.dirname(d);
  let top;
  try { top = git(d, ['rev-parse', '--show-toplevel']); } catch { return null; }
  let main = null;
  try { main = path.dirname(git(d, ['rev-parse', '--path-format=absolute', '--git-common-dir'])); } catch { /* chỉ còn gốc worktree */ }
  const roots = [...new Set([top, main].filter(Boolean).map((r) => path.resolve(r)))];
  const own = readState(top);
  const base = { roots, top: path.resolve(top), main: main ? path.resolve(main) : null };
  // File worktree hỏng vẫn che file repo chính: rơi về repo chính sẽ cấp `full` từ một cấu hình mà người dùng đã cố ghi đè.
  if (own?.invalid) return { ...base, config: null, file: path.resolve(top, '.claude', 'aip-gate.json'), source: 'worktree-invalid' };
  const config = own?.config ?? (main ? readState(main)?.config : null) ?? null;
  const file = config ? path.resolve(own ? top : main, '.claude', 'aip-gate.json') : null;
  return { ...base, config, file, source: own ? 'worktree' : (config ? 'main' : null) };
}

export function readGate(dir) {
  const g = resolveGate(dir);
  return g?.config ? { config: g.config, roots: g.roots, file: g.file } : null;
}

export function readGateConfig(dir) {
  return readGate(dir)?.config ?? null;
}

// `full` chỉ hiệu lực khi cả cấu hình lẫn phiên đều đồng ý: bypassPermissions do người dùng bật, không do repo tự quyết.
export function effectiveMode(config, input) {
  return input?.permission_mode === 'bypassPermissions' && config && typeof config === 'object' && config.mode === 'full' ? 'full' : 'ask';
}

const trackedCache = new Map();
export const lsFiles = (dir, spec) => { execFileSync('git', ['-C', dir, 'ls-files', '--error-unmatch', '--', spec], { timeout: 3000, stdio: ['ignore', 'ignore', 'ignore'] }); return 0; };

// true/false khi git trả đúng exit 0/1; mọi kết quả khác (128, không có git, quá giờ, run trả không phải số) là null.
// Hỏi repo thật sự chứa file (realpath: .claude có thể là symlink hay submodule) bằng pathspec icase: FS không phân biệt hoa thường
// còn pathspec thì có, nên AIP-GATE.json đã commit vẫn được hook đọc mà ls-files thường báo chưa theo dõi.
// Có `run` (seam test) thì bỏ qua cache để đếm lời gọi xác định.
export function gateTracked(file, { run = lsFiles } = {}) {
  const useCache = run === lsFiles;
  if (useCache && trackedCache.has(file)) return trackedCache.get(file);
  let st;
  try {
    const rp = realpathSync.native(file);
    const r = run(path.dirname(rp), `:(icase)${path.basename(rp)}`);
    st = typeof r === 'number' ? r : null;
  } catch (e) { st = e?.status; }
  const res = st === 0 ? true : st === 1 ? false : null;
  if (useCache) trackedCache.set(file, res);
  return res;
}

// Repo không đáng tin tự cấp `full`: file cấu hình đã commit đến từ clone nên bị bỏ qua; exit lạ ⇒ không full (hỏi thừa là hướng an toàn).
// Kiểm rẻ trước để phiên thường và project `ask` không tốn lần spawn git nào. Cấu hình tiêm (không có `file`) coi là đáng tin.
export function fullEffective(gate, input, { tracked = gateTracked } = {}) {
  if (input?.permission_mode !== 'bypassPermissions') return false;
  if (effectiveMode(gate?.config, input) !== 'full') return false;
  return gate.file ? tracked(gate.file) === false : true;
}

export function fullKeep(config) {
  const v = config?.fullKeep;
  if (!Array.isArray(v)) return ['push'];
  const known = v.filter((x) => x === 'push');
  // Mảng rỗng tường minh là mở hết; mảng có phần tử nhưng không nhận ra cái nào (vd gõ "Push") là lỗi gõ nên giữ mặc định an toàn.
  return v.length && !known.length ? ['push'] : known;
}

export function fullRoots(config) {
  const v = config?.fullRoots;
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string' && path.isAbsolute(x)).map((x) => path.resolve(x));
}

export function envFilesAllowed(dir) {
  return readGateConfig(dir)?.allowEnvFiles === true;
}

// Git Bash/Cygwin đưa đường dẫn kiểu /e/x hay /cygdrive/e/x; Node trên Windows sẽ hiểu thành E:\e\x (sai ổ) nếu không đổi trước.
export function normalizeMsysPath(p, platform = process.platform) {
  if (platform !== 'win32' || typeof p !== 'string') return p;
  const m = /^\/(?:cygdrive\/)?([A-Za-z])(?:\/(.*))?$/s.exec(p);
  return m ? `${m[1].toUpperCase()}:/${m[2] ?? ''}` : p;
}

// Chỉ `~` đứng đầu mới được shell bung thành home; `~` giữa tên (tên rút gọn 8.3 như LDMLE~1) là ký tự thường.
export const hasUnresolvedRef = (s) => /[$`]/.test(s) || s.startsWith('~');

const norm = (x) => {
  const n = x.replace(/\\/g, '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? n.toLowerCase() : n;
};

// Ổ đĩa/UNC trên nền không phải win32 không resolve được thành đường dẫn thật nên luôn coi là ngoài root.
// Không realpath: symlink trong root trỏ ra ngoài không bị phát hiện (ghi nhận ở Rủi ro của design).
// msys=false: đường dẫn từ PowerShell, không đổi /e/x.
export function classifyPath(p, cwd, roots, msys = true) {
  const s = msys ? normalizeMsysPath(String(p ?? '')) : String(p ?? '');
  if (!s || hasUnresolvedRef(s)) return 'unknown';
  if (process.platform !== 'win32' && (/^[A-Za-z]:[\\/]/.test(s) || s.startsWith('\\\\'))) return 'outside';
  const abs = norm(path.resolve(cwd, s.replace(/\\/g, '/')));
  return roots.some((r) => { const n = norm(path.resolve(r)); return abs === n || abs.startsWith(`${n}/`); }) ? 'inside' : 'outside';
}

export function allowedRoots(gate, input) {
  const sp = input?.scratchpad_dir;
  return [...(gate?.roots ?? []), ...(typeof sp === 'string' && path.isAbsolute(sp) ? [sp] : []), ...fullRoots(gate?.config)];
}

export function fullReadRoots(config) {
  const v = config?.fullReadRoots;
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string' && path.isAbsolute(x)).map((x) => path.resolve(x));
}

// Root chỉ-đọc mặc định đo được ở Claude Code 2.1.308 (design I5): cây plugin và thư mục tool-results của chính phiên này.
// `*` khớp đúng một đoạn đường dẫn (thư mục project đã được Claude Code làm sạch); không có wildcard qua phiên khác.
export function defaultReadRoots(input, env = process.env, homedir = os.homedir()) {
  const cfg = typeof env?.CLAUDE_CONFIG_DIR === 'string' && path.isAbsolute(env.CLAUDE_CONFIG_DIR) ? env.CLAUDE_CONFIG_DIR : path.join(homedir, '.claude');
  const sid = input?.session_id;
  const roots = [path.join(cfg, 'plugins')];
  if (typeof sid === 'string' && sid && sid !== '.' && sid !== '..' && !/[\\/*]/.test(sid)) roots.push(path.join(cfg, 'projects', '*', sid, 'tool-results'));
  return roots;
}

// Khớp theo đoạn để `*` chỉ thay một đoạn; cùng chuẩn hoá `norm`/MSYS/biến như classifyPath.
export function inReadRoot(p, cwd, roots, msys = true) {
  const s = msys ? normalizeMsysPath(String(p ?? '')) : String(p ?? '');
  if (!s || hasUnresolvedRef(s)) return false;
  if (process.platform !== 'win32' && (/^[A-Za-z]:[\\/]/.test(s) || s.startsWith('\\\\'))) return false;
  const abs = norm(path.resolve(cwd, s.replace(/\\/g, '/'))).split('/');
  return roots.some((r) => {
    const seg = norm(path.resolve(r)).split('/');
    return abs.length >= seg.length && seg.every((x, i) => (x === '*' ? abs[i] !== '' : x === abs[i]));
  });
}
