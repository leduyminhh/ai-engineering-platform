#!/usr/bin/env node
// PreToolUse(Bash): biến các ranh giới "không push nhánh bảo vệ / commit -F / không đụng file bí mật" thành cổng cứng.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const PROTECTED = new Set(['main', 'master', 'dev', 'develop']);
const SECRET = /(^|[\s'"=/])(\.env(\.(?!example\b|sample\b|template\b)[\w.-]+)?|[\w.-]+\.(pem|jks|keystore|p12|pfx)|id_(rsa|ed25519|ecdsa)|credentials(\.json)?)(?=$|[\s'"])/;

const tokens = (s) => s.match(/"[^"]*"|'[^']*'|\S+/g) || [];
const segments = (cmd) => cmd.split(/&&|\|\||;|\n|\|/).map((s) => s.trim()).filter(Boolean);

function gitSub(t, sub) {
  const g = t.indexOf('git');
  if (g === -1) return -1;
  for (let i = g + 1; i < t.length; i++) {
    if (t[i] === sub) return i;
    if (t[i] === '-C' || t[i] === '-c') { i++; continue; }
    if (!t[i].startsWith('-')) return -1;
  }
  return -1;
}

function pushReason(seg, cwd, currentBranch) {
  const t = tokens(seg);
  const i = gitSub(t, 'push');
  if (i === -1) return null;
  const args = t.slice(i + 1);
  const flags = args.filter((a) => a.startsWith('-'));
  const pos = args.filter((a) => !a.startsWith('-'));
  if (flags.some((f) => /^(--force(-with-lease)?(=.*)?|-f|--delete|-d|--mirror|--all)$/.test(f)) || pos.slice(1).some((r) => r.startsWith('+'))) {
    return 'push dạng force/xoá/mirror/all';
  }
  const here = () => currentBranch(cwd);
  const refs = pos.slice(1).map((r) => r.split(':').pop().replace(/^refs\/heads\//, ''));
  const targets = (refs.length ? refs : ['HEAD']).map((r) => (r === 'HEAD' ? here() : r));
  const hit = targets.find((r) => r && PROTECTED.has(r));
  return hit ? `push vào nhánh bảo vệ "${hit}"` : null;
}

function defaultBranch(cwd) {
  try {
    return execFileSync('git', ['-C', cwd || '.', 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

export function decide(input, { currentBranch = defaultBranch } = {}) {
  const cmd = String(input?.tool_input?.command ?? '');
  if (!cmd) return null;
  const cwd = input?.cwd || '.';
  for (const seg of segments(cmd)) {
    const t = tokens(seg);
    if (gitSub(t, 'commit') !== -1 && /(^|\s)(-m|--message)(\s|=)/.test(seg) && /[^\x00-\x7F]/.test(seg)) {
      return { decision: 'deny', reason: 'Commit message có ký tự non-ASCII qua -m dễ hỏng encoding. Ghi message ra file UTF-8, kiểm bằng check-commit-message.mjs rồi chạy `git commit -F <file>` (skill git-workflow).' };
    }
    const why = pushReason(seg, cwd, currentBranch);
    if (why) return { decision: 'ask', reason: `Nguyên tắc nền: ${why} cần người dùng xác nhận trước.` };
  }
  if (SECRET.test(cmd)) return { decision: 'ask', reason: 'Lệnh nhắc tới file bí mật (.env/khoá/credentials) — nguyên tắc nền không đọc/sửa file bí mật khi chưa được duyệt.' };
  return null;
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
  process.exit(0);
}
