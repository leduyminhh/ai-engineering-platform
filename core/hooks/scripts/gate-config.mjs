// Đọc <git-root>/.claude/aip-gate.json cho các hook của core; không phải hook, chỉ được import.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

function git(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function readJson(root) {
  try { return JSON.parse(readFileSync(path.join(root, '.claude', 'aip-gate.json'), 'utf8').replace(/^﻿/, '')); } catch { return null; }
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
  const own = readJson(top);
  const config = own ?? (main ? readJson(main) : null);
  return { config, roots, top: path.resolve(top), main: main ? path.resolve(main) : null, source: own ? 'worktree' : (config ? 'main' : null) };
}

export function readGate(dir) {
  const g = resolveGate(dir);
  return g?.config ? { config: g.config, roots: g.roots } : null;
}

export function readGateConfig(dir) {
  return readGate(dir)?.config ?? null;
}

// `full` chỉ hiệu lực khi cả cấu hình lẫn phiên đều đồng ý: bypassPermissions do người dùng bật, không do repo tự quyết.
export function effectiveMode(config, input) {
  return input?.permission_mode === 'bypassPermissions' && config && typeof config === 'object' && config.mode === 'full' ? 'full' : 'ask';
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
export function classifyPath(p, cwd, roots) {
  const s = normalizeMsysPath(String(p ?? ''));
  if (!s || hasUnresolvedRef(s)) return 'unknown';
  if (process.platform !== 'win32' && (/^[A-Za-z]:[\\/]/.test(s) || s.startsWith('\\\\'))) return 'outside';
  const abs = norm(path.resolve(cwd, s.replace(/\\/g, '/')));
  return roots.some((r) => { const n = norm(path.resolve(r)); return abs === n || abs.startsWith(`${n}/`); }) ? 'inside' : 'outside';
}

export function allowedRoots(gate, input) {
  const sp = input?.scratchpad_dir;
  return [...(gate?.roots ?? []), ...(typeof sp === 'string' && path.isAbsolute(sp) ? [sp] : []), ...fullRoots(gate?.config)];
}
