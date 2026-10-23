#!/usr/bin/env node
// PreToolUse(Read|Grep|Edit|Write|MultiEdit|NotebookEdit): chặn file bí mật; agent có writeScope chỉ ghi trong phạm vi khai báo.
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { envFilesAllowed, fullEffective, readGate, classifyPath, allowedRoots, normalizeMsysPath } from './gate-config.mjs';

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

const SECRET_DENY = { decision: 'deny', reason: 'File bí mật (.env/khoá/credentials) — nguyên tắc nền không đọc/sửa; nhờ người dùng thao tác trực tiếp nếu thật sự cần.' };

// H6: chỉ khi full hiệu lực. Kiểm permission_mode trước để phiên thường không tốn lệnh git đọc cấu hình.
function confine(input, file, cwd, { repoRoot, config, tracked }) {
  if (input?.permission_mode !== 'bypassPermissions') return null;
  const tool = input.tool_name;
  const write = WRITE_TOOLS.has(tool);
  if (!write && tool !== 'Read' && tool !== 'Grep') return null;
  const gate = config === undefined ? readGate(cwd) : { config, roots: repoRoot ? [path.resolve(repoRoot)] : (readGate(cwd)?.roots ?? []) };
  if (!fullEffective(gate, input, { tracked })) return null;
  const where = classifyPath(String(file), cwd, allowedRoots(gate, input));
  if (where === 'inside') return null;
  const reason = `Chế độ full chỉ cho phép thao tác trong root của project; đường dẫn ${where === 'unknown' ? 'không xác định được' : 'nằm ngoài root'}. Cần mở rộng → thêm vào "fullRoots" trong .claude/aip-gate.json.`;
  return { decision: write && where === 'outside' ? 'deny' : 'ask', reason };
}

export function decide(input, { scopes, repoRoot, rootOf = gitRoot, ignoreCase = process.platform === 'win32', allowEnv = envFilesAllowed, config, tracked } = {}) {
  const ti = input?.tool_input;
  const file = ti?.file_path || ti?.notebook_path || (input?.tool_name === 'Grep' ? ti?.path : undefined);
  const cwd = path.resolve(input?.cwd || '.');
  // Cấu hình theo repo chứa file đích (như allowEnv), không theo cwd.
  // Kiểm permission_mode trước để phiên thường không tốn lệnh git khi đọc cấu hình.
  const isFull = (dir) => fullEffective(config === undefined ? readGate(dir) : { config }, input, { tracked });
  if (input?.tool_name === 'Grep' && ti?.glob && globNamesSecret(ti.glob)
    && (globNamesSecret(ti.glob, KEY_PROBES) || !allowEnv(path.resolve(cwd, String(ti.path || '.'))))
    && !isFull(path.resolve(cwd, String(ti.path || '.')))) return SECRET_DENY;
  if (!file) return null;
  const target = path.resolve(cwd, normalizeMsysPath(String(file)));
  // Chuẩn hoá về "/" để cùng một regex/glob chạy đúng trên Windows (dấu "\" và ký tự ổ đĩa).
  const abs = target.replace(/\\/g, '/');
  // Công tắc đọc theo project chứa file đích, không theo cwd: cwd bật cờ không được mở .env của repo khác.
  if (isSecretPath(abs, target) && (isSecretPath(abs, target, KEY_SECRET) || !allowEnv(path.dirname(target))) && !isFull(path.dirname(target))) return SECRET_DENY;
  const confined = confine(input, file, cwd, { repoRoot, config, tracked });
  if (confined) return confined;
  if (!WRITE_TOOLS.has(input.tool_name)) return null;
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
