#!/usr/bin/env node
// PreToolUse(Read|Edit|Write|MultiEdit|NotebookEdit): chặn file bí mật; agent có writeScope chỉ ghi trong phạm vi khai báo.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const SECRET = /(^|\/)(\.env(\.(?!(example|sample|template)$)[\w.-]+)?|[^/]+\.(pem|jks|keystore|p12|pfx)|id_(rsa|ed25519|ecdsa)|credentials(\.json)?)$/i;

export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    if (glob.startsWith('**/', i)) { re += '(?:.*/)?'; i += 2; }
    else if (glob.startsWith('**', i)) { re += '.*'; i += 1; }
    else if (glob[i] === '*') re += '[^/]*';
    else re += glob[i].replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

function loadScopes() {
  const f = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scope-lock.json');
  try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; } catch { return {}; }
}

export function decide(input, { scopes = loadScopes() } = {}) {
  const file = input?.tool_input?.file_path || input?.tool_input?.notebook_path;
  if (!file) return null;
  const root = path.resolve(input.cwd || '.');
  const target = path.resolve(root, String(file));
  // Chuẩn hoá về "/" để cùng một regex/glob chạy đúng trên Windows (dấu "\" và ký tự ổ đĩa).
  const abs = target.replace(/\\/g, '/');
  if (SECRET.test(abs)) {
    return { decision: 'deny', reason: 'File bí mật (.env/khoá/credentials) — nguyên tắc nền không đọc/sửa; nhờ người dùng thao tác trực tiếp nếu thật sự cần.' };
  }
  if (!WRITE_TOOLS.has(input.tool_name)) return null;
  const agent = String(input.agent_type || '').split(':').pop();
  const scope = agent && Object.hasOwn(scopes, agent) ? scopes[agent] : null;
  if (!Array.isArray(scope) || !scope.length) return null;
  const rel = path.relative(root, target).replace(/\\/g, '/');
  const outside = rel === '..' || rel.startsWith('../') || path.isAbsolute(rel);
  if (!outside && scope.some((g) => globToRegExp(g).test(rel))) return null;
  return { decision: 'deny', reason: `Agent ${agent} chỉ được ghi trong: ${scope.join(', ')}. Cần sửa ngoài phạm vi → trả blocked cho session chính.` };
}

function main() {
  let input;
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { return; }
  const d = decide(input);
  if (!d) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: d.decision, permissionDecisionReason: d.reason } }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch { /* fail-open: lỗi nội bộ không được chặn phiên làm việc */ }
  // Không process.exit(): để stdout được xả hết khi đầu ra là pipe.
  process.exitCode = 0;
}
