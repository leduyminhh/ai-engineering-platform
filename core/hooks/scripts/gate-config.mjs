// Đọc <git-root>/.claude/aip-gate.json cho các hook của core; không phải hook, chỉ được import.
import path from 'node:path';
import os from 'node:os';
import { locateGate, gateTracked, lsFiles, trustedValue } from './gate-file.mjs';

export { gateTracked, lsFiles };

// Hook chỉ nhận cấu hình trong repo git (R4): thư mục ngoài repo không có gốc nào để neo, kể cả khi thư mục cha có file.
export function resolveGate(dir) {
  const g = locateGate(dir);
  // gitUnknown: không xác định được repo, giữ hành vi như ngoài repo.
  return g.inRepo && !g.gitUnknown ? g : null;
}

export function readGate(dir) {
  const g = resolveGate(dir);
  return g?.config ? g : null;
}

// Cho khoá chỉ siết (mcpAllow/mcpDeny): gitUnknown vẫn dùng file đã đọc được, file hỏng được báo riêng để hook hỏi thay vì bỏ qua im lặng.
export function gateForGuard(dir) {
  const g = locateGate(dir);
  if (!g.inRepo) return { gate: null, invalid: null };
  return { gate: g.config ? g : null, invalid: g.source === 'worktree-invalid' ? g.file : (g.mainInvalid ?? null) };
}

export function readGateConfig(dir) {
  return readGate(dir)?.config ?? null;
}

// `full` chỉ hiệu lực khi cả cấu hình lẫn phiên đều đồng ý: bypassPermissions do người dùng bật, không do repo tự quyết.
export function effectiveMode(config, input) {
  return input?.permission_mode === 'bypassPermissions' && config && typeof config === 'object' && config.mode === 'full' ? 'full' : 'ask';
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

export function envFilesAllowed(dir, { tracked } = {}) {
  return trustedValue(resolveGate(dir), 'allowEnvFiles', { tracked }) === true;
}

// Chuỗi do agent cung cấp (đường dẫn, token lệnh) đi vào reason hiện cho người dùng: bỏ xuống dòng/backtick để không làm giả dòng hay đóng khối trích, cắt giữ phần đuôi (tên file) để lời khuyên không bị đẩy ra ngoài.
export function showArg(s, max = 120) {
  const t = String(s).replace(new RegExp('[\\p{Cc}\\p{Cf}\\u2028\\u2029`]+', 'gu'), ' ').trim();
  return t.length > max ? `…${t.slice(-max)}` : t;
}

// Git Bash/Cygwin đưa đường dẫn kiểu /e/x hay /cygdrive/e/x; Node trên Windows sẽ hiểu thành E:\e\x (sai ổ) nếu không đổi trước.
export function normalizeMsysPath(p, platform = process.platform) {
  if (platform !== 'win32' || typeof p !== 'string') return p;
  const m = /^\/(?:cygdrive\/)?([A-Za-z])(?:\/(.*))?$/s.exec(p);
  return m ? `${m[1].toUpperCase()}:/${m[2] ?? ''}` : p;
}

// Chỉ `~` đứng đầu mới được shell bung thành home; `~` giữa tên (tên rút gọn 8.3 như LDMLE~1) là ký tự thường.
export const hasUnresolvedRef = (s) => /[$`]/.test(s) || s.startsWith('~');

const PERMS = ['read', 'write', 'delete'];

const norm = (x) => {
  const n = x.replace(/\\/g, '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? n.toLowerCase() : n;
};

// Ổ đĩa/UNC trên nền không phải win32 không resolve được thành đường dẫn thật nên luôn coi là ngoài root.
// Không realpath: symlink trong root trỏ ra ngoài không bị phát hiện (ghi nhận ở Rủi ro của design).
// msys=false: đường dẫn từ PowerShell, không đổi /e/x.
export function classifyPath(p, cwd, roots, msys = true, need = 'write') {
  const s = msys ? normalizeMsysPath(String(p ?? '')) : String(p ?? '');
  if (!s || hasUnresolvedRef(s)) return 'unknown';
  if (process.platform !== 'win32' && (/^[A-Za-z]:[\\/]/.test(s) || s.startsWith('\\\\'))) return 'outside';
  const abs = norm(path.resolve(cwd, s.replace(/\\/g, '/')));
  const segs = abs.split('/');
  return roots.some((r) => {
    const g = typeof r === 'string' ? { path: r, allow: PERMS } : r;
    if (!g.allow.includes(need)) return false;
    const n = norm(path.resolve(g.path));
    if (!g.glob) return abs === n || abs.startsWith(`${n}/`);
    const seg = n.split('/');
    return segs.length >= seg.length && seg.every((x, i) => (x === '*' ? segs[i] !== '' : x === segs[i]));
  }) ? 'inside' : 'outside';
}

// Thư mục tạm do chính Claude Code sinh ra (scratchpad, thư mục kết quả tool): không phải "ngoài project" với agent. [Unverified] Bố cục <tmpdir>/claude đo trên Windows, chưa kiểm POSIX.
export const claudeTmpRoots = (tmp = os.tmpdir()) => [path.join(tmp, 'claude')];

// Mục sai cú pháp bị bỏ hoặc mất quyền (D4): sai chính tả chỉ làm ít quyền đi, không bao giờ nhiều hơn. `path` không có wildcard.
export function fullPaths(config) {
  const v = config?.fullPaths;
  if (!Array.isArray(v)) return [];
  const merged = new Map();
  for (const e of v) {
    if (!e || typeof e !== 'object' || typeof e.path !== 'string' || !path.isAbsolute(e.path) || !Array.isArray(e.allow)) continue;
    const p = path.resolve(e.path);
    const m = merged.get(norm(p)) ?? { path: p, allow: new Set() };
    for (const a of e.allow) if (PERMS.includes(a)) m.allow.add(a);
    merged.set(norm(p), m);
  }
  return [...merged.values()].map((m) => ({ path: m.path, allow: PERMS.filter((a) => m.allow.has(a)) }));
}

export function grantsOf(gate, input) {
  const sp = input?.scratchpad_dir;
  const full = [...(gate?.roots ?? []), ...(typeof sp === 'string' && path.isAbsolute(sp) ? [sp] : []), ...fullRoots(gate?.config), ...claudeTmpRoots()];
  return [
    ...full.map((p) => ({ path: p, allow: [...PERMS] })),
    ...fullReadRoots(gate?.config).map((p) => ({ path: p, allow: ['read'] })),
    ...defaultReadRoots(input).map((p) => ({ path: p, allow: ['read'], glob: true })),
    ...fullPaths(gate?.config),
  ];
}

export function allowedRoots(gate, input) {
  return grantsOf(gate, input).filter((g) => PERMS.every((a) => g.allow.includes(a))).map((g) => g.path);
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
