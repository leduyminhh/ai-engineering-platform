#!/usr/bin/env node
// PreToolUse(Bash): biến các ranh giới "không push nhánh bảo vệ / commit -F / không đụng file bí mật" thành cổng cứng.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const PROTECTED = new Set(['main', 'master', 'dev', 'develop']);
const SECRET = /(^|[\s'"=/\\<(])(\.env(\.(?!example\b|sample\b|template\b)[\w.-]+)?|[\w.-]+\.(pem|jks|keystore|p12|pfx)|id_(rsa|ed25519|ecdsa)|credentials(\.json)?)(?=$|[\s'";&|)<>])/;
const GIT_OPTS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace']);
const PUSH_OPTS_WITH_VALUE = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);

// Tách lệnh thành các đoạn token, tôn trọng nháy: toán tử/xuống dòng nằm trong nháy (vd heredoc trong -m "$(…)") không cắt đoạn.
function parse(cmd) {
  const segs = [];
  let toks = [];
  let cur = '';
  let has = false;
  let q = null;
  const endTok = () => { if (has) toks.push(cur); cur = ''; has = false; };
  const endSeg = () => { endTok(); if (toks.length) segs.push(toks); toks = []; };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) {
      if (c === q) { q = null; continue; }
      if (q === '"' && c === '\\' && cmd[i + 1] === '"') { cur += '"'; i++; continue; }
      cur += c;
      continue;
    }
    if (c === '"' || c === "'") { q = c; has = true; continue; }
    if (c === '\n') { endSeg(); continue; }
    if (/\s/.test(c)) { endTok(); continue; }
    if (';&|()`'.includes(c)) { endSeg(); continue; }
    cur += c;
    has = true;
  }
  endSeg();
  return segs;
}

function gitCmd(t) {
  const g = t.findIndex((x) => /(^|[\\/])git(\.exe)?$/i.test(x));
  if (g === -1) return null;
  const dirs = [];
  for (let i = g + 1; i < t.length; i++) {
    if (GIT_OPTS_WITH_VALUE.has(t[i])) {
      if (t[i] === '-C' && t[i + 1] !== undefined) dirs.push(t[i + 1]);
      i++;
      continue;
    }
    if (t[i].startsWith('-')) continue;
    return { sub: t[i], i, dirs };
  }
  return null;
}

function commitMessages(t, from) {
  const msgs = [];
  for (let i = from; i < t.length; i++) {
    const a = t[i];
    if (a === '--') break;
    if (a === '--message') { if (t[i + 1] !== undefined) msgs.push(t[++i]); continue; }
    if (a.startsWith('--message=')) { msgs.push(a.slice('--message='.length)); continue; }
    if (a.startsWith('--')) continue;
    const m = /^-([A-Za-z]*?)m([\s\S]*)$/.exec(a);
    if (m) {
      if (m[2]) msgs.push(m[2]);
      else if (t[i + 1] !== undefined) msgs.push(t[++i]);
    }
  }
  return msgs;
}

function pushReason(t, gc, cwd, currentBranch) {
  let force = false;
  const pos = [];
  const args = t.slice(gc.i + 1);
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (PUSH_OPTS_WITH_VALUE.has(a)) { k++; continue; }
    if (a.startsWith('--')) {
      if (/^--(force(-with-lease|-if-includes)?|delete|mirror|all|prune)(=|$)/.test(a)) force = true;
      continue;
    }
    if (a.startsWith('-') && a.length > 1) {
      // Cụm cờ ngắn: dừng ở `o` vì phần sau nó là giá trị của -o, không phải cờ.
      if (/^-[A-NP-Za-np-z]*[fd]/.test(a)) force = true;
      continue;
    }
    pos.push(a);
  }
  const specs = pos.slice(1);
  if (force || specs.some((r) => r.startsWith('+') || r.startsWith(':'))) return 'push dạng force/xoá/mirror/all';
  const dir = gc.dirs.length ? path.resolve(cwd, ...gc.dirs) : cwd;
  const refs = specs.map((r) => r.split(':').pop().replace(/^refs\/heads\//, ''));
  const targets = (refs.length ? refs : ['HEAD']).map((r) => (r === 'HEAD' || r === '@' ? currentBranch(dir) : r));
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
  for (const t of parse(cmd)) {
    const gc = gitCmd(t);
    if (!gc) continue;
    if (gc.sub === 'commit' && commitMessages(t, gc.i + 1).some((m) => /[^\x00-\x7F]/.test(m))) {
      return { decision: 'deny', reason: 'Commit message có ký tự non-ASCII qua -m dễ hỏng encoding. Ghi message ra file UTF-8, kiểm bằng check-commit-message.mjs rồi chạy `git commit -F <file>` (skill git-workflow).' };
    }
    const why = gc.sub === 'push' ? pushReason(t, gc, cwd, currentBranch) : null;
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
  // Không process.exit(): để stdout được xả hết khi đầu ra là pipe.
  process.exitCode = 0;
}
