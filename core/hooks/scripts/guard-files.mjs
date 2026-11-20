#!/usr/bin/env node
// PreToolUse(Read|Grep|Edit|Write|MultiEdit|NotebookEdit): chặn file bí mật; agent có writeScope chỉ ghi trong phạm vi khai báo.
import { readFileSync, existsSync, realpathSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { locateGate } from './gate-file.mjs';
import { envFilesAllowed, fullEffective, openEffective, readGate, classifyPath, grantsOf, normalizeMsysPath, showArg, isClaudeTmpRoot, denyOutsideText, CLAUDE_TMP_BLOCKED_TEXT } from './gate-config.mjs';

const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const SECRET = /(^|\/)(\.env(rc)?(\.(?!(example|sample|template)$)[\w.-]+)?|[^/]+\.env|[^/]+\.(pem|jks|keystore|p12|pfx|key|ppk|p8)|id_(rsa|dsa|ecdsa|ed25519)(_sk)?(\.(?!pub$)[\w.-]+)?|credentials(\.(json|ya?ml))?)$/i;
// Tên mẫu dùng để đoán một glob của Grep có chủ đích quét file bí mật hay không.
const SECRET_PROBES = ['.env', '.env.local', '.envrc', 'prod.env', 'server.pem', 'server.key', 'store.jks', 'store.keystore', 'a.p12', 'a.pfx', 'a.ppk', 'a.p8',
  'id_rsa', 'id_ed25519', 'credentials', 'credentials.json', 'credentials.yml'];
// Bản bỏ nhánh .env của SECRET/SECRET_PROBES: project bật "allowEnvFiles" thì khoá/credentials vẫn bị chặn.
const KEY_SECRET = /(^|\/)([^/]+\.(pem|jks|keystore|p12|pfx|key|ppk|p8)|id_(rsa|dsa|ecdsa|ed25519)(_sk)?(\.(?!pub$)[\w.-]+)?|credentials(\.(json|ya?ml))?)$/i;
const KEY_PROBES = SECRET_PROBES.filter((p) => !/env/i.test(p));
// Phần chữ cố định của glob phải tự chứa từ khoá bí mật; chỉ khớp tên mẫu thôi sẽ chặn nhầm "*.json", "s*", "*rc"...
const SECRET_WORDS = /env|pem|key|jks|keystore|p12|pfx|ppk|p8|id_|credentials/i;

export function globToRegExp(glob, { ignoreCase = false } = {}) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    if (glob.startsWith('**/', i)) { re += '(?:.*/)?'; i += 2; }
    else if (glob.startsWith('**', i)) { re += '.*'; i += 1; }
    else if (glob[i] === '*') re += '[^/]*';
    else re += glob[i].replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, ignoreCase ? 'i' : '');
}

function loadScopes() {
  const f = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scope-lock.json');
  try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; } catch { return {}; }
}

// Phạm vi ghi neo theo gốc git của file đích (worktree lồng trong cwd có gốc riêng); lỗi git → quay về cwd.
// Thư mục đích có thể chưa tồn tại (Write tạo mới) nên đi lên thư mục cha gần nhất đã có.
function gitRoot(dir, cwd) {
  try {
    let d = dir;
    while (!existsSync(d) && path.dirname(d) !== d) d = path.dirname(d);
    const out = execFileSync('git', ['-C', d, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return out || cwd;
  } catch { return cwd; }
}

// Bỏ hậu tố luồng NTFS (":stream", "::$DATA") và dấu chấm/khoảng trắng cuối — Windows coi chúng cùng một file.
function stripAliases(p) {
  return p.replace(/:[^/]*$/, '').replace(/[. ]+$/, '');
}

function isSecretPath(abs, target, re = SECRET) {
  if (re.test(stripAliases(abs))) return true;
  // Symlink/junction tên vô hại nhưng trỏ tới file bí mật: so khớp cả đường dẫn thật (chỉ đọc).
  // Đường UNC bỏ qua realpath để hook không chạm mạng; tên đã được kiểm ở trên.
  if (abs.startsWith('//')) return false;
  try {
    if (existsSync(target)) return re.test(realpathSync.native(target).replace(/\\/g, '/'));
  } catch { /* không resolve được thì dựa vào tên */ }
  return false;
}

function braceAlternatives(glob) {
  const m = /\{([^{}]*)\}/.exec(glob);
  if (!m) return [glob];
  return m[1].split(',').flatMap((alt) => braceAlternatives(glob.slice(0, m.index) + alt + glob.slice(m.index + m[0].length)));
}

// Glob chỉ bị coi là nhắm file bí mật khi có phần chữ cố định (vd ".env*", "*.pem"); "*" hay "**/*" thì không.
function globNamesSecret(glob, probes = SECRET_PROBES) {
  return braceAlternatives(String(glob).replace(/\\/g, '/').split('/').pop())
    .some((g) => SECRET_WORDS.test(g.replace(/[*?]/g, '')) && probes.some((p) => globToRegExp(g, { ignoreCase: true }).test(p)));
}

// Cấu hình của chính các hook: agent bị tiêm lệnh không được tự đặt mode, fullKeep:[] hay allowEnvFiles:true nên luôn bị chặn hoặc hỏi, kể cả khi confined/open hiệu lực.
const GUARD_CONFIG = /(^|\/)\.claude\/(aip-gate\.json|settings(\.[\w-]+)?\.json)$/i;
// open thêm file phạm vi ghi của plugin: writeScope đọc từ đó nên để agent ghi được thì cổng chỉ còn danh nghĩa (K13).
const SCOPE_LOCK = /(^|\/)hooks\/scope-lock\.json$/i;
const guardConfigAsk = (file) => ({ decision: 'ask', reason: `Ghi vào file cấu hình quyền \`${showArg(path.basename(file))}\`.` });
// Câu deny cho agent (D15): nêu việc bị chặn và cách mở.
const guardConfigDeny = (file) => ({ decision: 'deny', reason: `Ghi vào file cấu hình quyền \`${showArg(path.basename(file))}\` bị chặn với agent. Mở: người dùng tự sửa file hoặc tự chạy \`aip mode\`.` });
const DENY_INTERNAL = { decision: 'deny', reason: 'Lỗi nội bộ khi kiểm file nên bị từ chối. Mở: thử lại với đường dẫn khác hoặc người dùng chạy `aip mode open`.' };

const SECRET_DENY = { decision: 'deny', reason: 'File bí mật (.env/khoá/credentials) — nguyên tắc nền không đọc/sửa; nhờ người dùng thao tác trực tiếp nếu thật sự cần.' };

// H6: chỉ gọi khi confined hiệu lực (hoặc cwd confined). Không bao giờ hỏi: ngoài rào là deny kèm cách mở (D15).
function confine(input, file, cwd, { gate, secret = false }) {
  const tool = input.tool_name;
  const write = WRITE_TOOLS.has(tool);
  if (!write && tool !== 'Read' && tool !== 'Grep') return null;
  // Gốc <tmpdir>/claude thắng mọi grant (kể cả fullPaths): Grep/Read vào đó lộ nội dung của phiên khác, giống guard-bash.
  if (isClaudeTmpRoot(normalizeMsysPath(String(file)), cwd)) return { decision: 'deny', reason: CLAUDE_TMP_BLOCKED_TEXT };
  const grants = grantsOf(gate, input);
  const where = classifyPath(String(file), cwd, grants, true, write ? 'write' : 'read');
  // File bí mật chỉ được miễn khi đường dẫn có đủ ba quyền hiệu lực; thiếu thì từ chối.
  if (where === 'inside' && !(secret && ['read', 'write', 'delete'].some((a) => classifyPath(String(file), cwd, grants, true, a) !== 'inside'))) return null;
  if (write && where === 'outside') {
    // Dòng liệt kê root chỉ là gợi ý cho agent: lỗi khi dựng nó không được làm mất deny.
    let reason;
    try { reason = denyOutsideText('write', grants, 'ghi vào thư mục'); } catch { reason = denyOutsideText('write', [], 'ghi vào thư mục'); }
    return { decision: 'deny', reason };
  }
  const shown = showArg(file);
  const reason = where === 'unknown'
    ? `${write ? 'Ghi' : 'Đọc'} đường dẫn chưa rõ \`${shown}\`. Mở: dùng đường dẫn tuyệt đối trong root, hoặc người dùng chạy \`aip mode open\`.`
    : where === 'inside'
      ? `${write ? 'Ghi' : 'Đọc'} file bí mật \`${shown}\` ở thư mục chưa đủ quyền đọc, ghi, xoá. Mở: cấp đủ quyền qua "fullRoots" hoặc "fullPaths" trong .claude/aip-gate.json, hoặc người dùng chạy \`aip mode open\`.`
      : `Đọc file ngoài thư mục project \`${shown}\`. Mở: thêm vào "fullReadRoots" hoặc "fullPaths" (allow "read") trong .claude/aip-gate.json, hoặc người dùng chạy \`aip mode open\`.`;
  return { decision: 'deny', reason };
}

// guarded > confined > open về độ chặt (K14): open chỉ áp khi mọi nơi đều open, confined khi không nơi nào guarded.
const RANK = { guarded: 2, confined: 1, open: 0 };
const stricter = (a, b) => (RANK[a] >= RANK[b] ? a : b);

export function decide(input, deps = {}) {
  const ctx = { mode: 'guarded' };
  try {
    return decideInner(input, deps, ctx);
  } catch (e) {
    // Lỗi sau bước xác định mode không được tự mở cổng (K15): confined chặn, open chỉ chặn đích là file cấu hình, guarded fail-open như main().
    if (ctx.mode === 'confined') return DENY_INTERNAL;
    if (ctx.mode === 'open') return configTarget(input, deps) ? guardConfigDeny(configTarget(input, deps)) : null;
    throw e;
  }
}

// Đích ghi là file cấu hình quyền (hoặc scope-lock.json khi open): trả đường dẫn chuẩn hoá, ngược lại null; không bao giờ ném.
function configTarget(input, deps) {
  try {
    if (!WRITE_TOOLS.has(input?.tool_name)) return null;
    const ti = input.tool_input;
    const file = ti?.file_path || ti?.notebook_path;
    if (!file) return null;
    const abs = path.resolve(path.resolve(input?.cwd || '.'), normalizeMsysPath(String(file))).replace(/\\/g, '/');
    const clean = stripAliases(abs);
    return GUARD_CONFIG.test(clean) || SCOPE_LOCK.test(clean) ? abs : null;
  } catch { return null; }
}

// Thư mục không có gate dùng được: 'none' (không có file cấu hình, trung tính) hay 'invalid' (file hỏng, không xác định được repo; hướng an toàn là guarded).
// readGate gộp cả hai thành null nên phải hỏi locateGate để phân biệt.
function inspectGate(dir) {
  const g = locateGate(dir);
  return g.gitUnknown || g.source === 'worktree-invalid' || g.mainInvalid ? 'invalid' : 'none';
}
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };

function decideInner(input, { scopes, repoRoot, rootOf = gitRoot, ignoreCase = process.platform === 'win32', allowEnv = envFilesAllowed, config, tracked, reader = readGate, inspect = inspectGate, isDirectory = isDir } = {}, ctx) {
  const ti = input?.tool_input;
  const file = ti?.file_path || ti?.notebook_path || (input?.tool_name === 'Grep' ? ti?.path : undefined);
  const cwd = path.resolve(input?.cwd || '.');
  // Bypass kiểm trước readGate: phiên thường không tốn lệnh git nào. Cấu hình đọc theo cả cwd lẫn thư mục file đích, lấy mức chặt hơn (K14);
  // lỗi khi xác định mode ⇒ guarded, không bao giờ tự mở cổng.
  const bypass = input?.permission_mode === 'bypassPermissions';
  const gates = new Map();
  const gateAt = (dir) => { if (!gates.has(dir)) gates.set(dir, reader(dir)); return gates.get(dir); };
  // null = thư mục không có cấu hình để nói gì (ví dụ thư mục plugin, `~/.claude`): kế thừa mode của cwd, không tự thành guarded,
  // nếu không thì open sẽ hỏi/chặn nhầm đúng những file cấu hình mà K13 nhắm tới.
  const modeAt = (dir) => {
    if (!bypass) return 'guarded';
    try {
      const g = config === undefined ? gateAt(dir) : { config };
      if (!g?.config) return config === undefined && inspect(dir) === 'invalid' ? 'guarded' : null;
      return openEffective(g, input, { tracked }) ? 'open' : fullEffective(g, input, { tracked }) ? 'confined' : 'guarded';
    } catch { return 'guarded'; }
  };
  const confineGate = () => config === undefined ? gateAt(cwd) : { config, roots: repoRoot ? [path.resolve(repoRoot)] : (gateAt(cwd)?.roots ?? []) };
  const cwdMode = modeAt(cwd) ?? 'guarded';
  ctx.mode = cwdMode;
  const eff = (dir) => stricter(cwdMode, modeAt(dir) ?? cwdMode);
  if (input?.tool_name === 'Grep' && ti?.glob && globNamesSecret(ti.glob)) {
    const dir = path.resolve(cwd, String(ti.path || '.'));
    const m = eff(dir);
    if (m === 'guarded' && (globNamesSecret(ti.glob, KEY_PROBES) || !allowEnv(dir))) return SECRET_DENY;
    // confined: glob bí mật chỉ được miễn ở thư mục có đủ ba quyền, như file bí mật cụ thể.
    if (m === 'confined') {
      const hit = confine(input, dir, cwd, { gate: confineGate(), secret: true });
      if (hit) return hit;
    }
  }
  if (!file) return null;
  const target = path.resolve(cwd, normalizeMsysPath(String(file)));
  // Chuẩn hoá về "/" để cùng một regex/glob chạy đúng trên Windows (dấu "\" và ký tự ổ đĩa).
  const abs = target.replace(/\\/g, '/');
  // Công tắc đọc theo project chứa file đích, không theo cwd: cwd bật cờ không được mở .env của repo khác.
  // Grep trỏ vào một thư mục: thư mục đó là nơi tìm, không phải thư mục cha của nó.
  // statSync lên đường UNC mở kết nối SMB ngay trong hook, trước hộp xác nhận; phiên không bypass thì mode luôn guarded nên không cần phân biệt thư mục.
  const mode = eff(input.tool_name === 'Grep' && bypass && !abs.startsWith('//') && isDirectory(target) ? target : path.dirname(target));
  ctx.mode = mode;
  if (mode === 'guarded' && isSecretPath(abs, target) && (isSecretPath(abs, target, KEY_SECRET) || !allowEnv(path.dirname(target)))) return SECRET_DENY;
  const write = WRITE_TOOLS.has(input.tool_name);
  if (mode === 'open') {
    const cfgFile = configTarget(input, { });
    if (cfgFile) return guardConfigDeny(cfgFile);
  } else if (mode === 'confined' || cwdMode === 'confined') {
    // Rào root neo theo cwd kể cả khi file đích thuộc repo lồng guarded (K14).
    const confined = confine(input, file, cwd, { gate: confineGate(), secret: isSecretPath(abs, target) });
    if (confined) return confined;
  }
  if (!write) return null;
  if (mode !== 'open' && GUARD_CONFIG.test(stripAliases(abs))) return mode === 'confined' ? guardConfigDeny(abs) : guardConfigAsk(abs);
  const agent = String(input.agent_type || '').split(':').pop();
  const table = scopes || loadScopes();
  const scope = agent && Object.hasOwn(table, agent) ? table[agent] : null;
  if (!Array.isArray(scope) || !scope.length) return null;
  const root = path.resolve(repoRoot || rootOf(path.dirname(target), cwd));
  const rel = path.relative(root, target).replace(/\\/g, '/');
  const outside = rel === '..' || rel.startsWith('../') || path.isAbsolute(rel);
  if (!outside && scope.some((g) => globToRegExp(g, { ignoreCase }).test(rel))) return null;
  return { decision: 'deny', reason: `Agent ${agent} chỉ được ghi trong: ${scope.join(', ')}. Cần sửa ngoài phạm vi → trả blocked cho session chính.` };
}

function main() {
  let input;
  // Pipe từ PowerShell 5.1 chèn BOM vào đầu stdin; JSON.parse lỗi sẽ làm hook im lặng cho qua.
  try { input = JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, '')); } catch { return; }
  const d = decide(input);
  if (!d) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: d.decision, permissionDecisionReason: d.reason } }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch { /* fail-open: lỗi nội bộ không được chặn phiên làm việc */ }
  // Không process.exit(): để stdout được xả hết khi đầu ra là pipe.
  process.exitCode = 0;
}
