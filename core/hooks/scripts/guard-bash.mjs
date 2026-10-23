#!/usr/bin/env node
// PreToolUse(Bash|PowerShell): biến các ranh giới "không push nhánh bảo vệ / commit -F / không đụng file bí mật" thành cổng cứng.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { envFilesAllowed, readGate, fullEffective, fullKeep, classifyPath, allowedRoots, normalizeMsysPath, hasUnresolvedRef } from './gate-config.mjs';

const PROTECTED = new Set(['main', 'master', 'dev', 'develop']);
const SECRET = /(^|[\s'"=/\\<(])(\.env(rc)?(\.(?!(example|sample|template)\b)[\w.-]+)?|(?!process\.env(?![\w.-]))[\w.-]+\.env|[\w.-]+\.(pem|jks|keystore|p12|pfx|key|ppk|p8)|id_(rsa|dsa|ecdsa|ed25519)(_sk)?(\.(?!pub\b)[\w.-]+)?|credentials(\.(json|ya?ml))?)(?=$|[\s'";&|)<>])/i;
// SECRET bỏ nhánh .env: project bật "allowEnvFiles" thì chỉ khoá/credentials còn bị hỏi.
const KEY_SECRET = /(^|[\s'"=/\\<(])([\w.-]+\.(pem|jks|keystore|p12|pfx|key|ppk|p8)|id_(rsa|dsa|ecdsa|ed25519)(_sk)?(\.(?!pub\b)[\w.-]+)?|credentials(\.(json|ya?ml))?)(?=$|[\s'";&|)<>])/i;
const GIT_OPTS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env']);
const PUSH_OPTS_WITH_VALUE = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);

// Tách lệnh thành các đoạn token, tôn trọng nháy: toán tử/xuống dòng nằm trong nháy (vd heredoc trong -m "$(…)") không cắt đoạn.
function parse(cmd) {
  const segs = [];
  let toks = [];
  let cur = '';
  let has = false;
  let qp = Infinity;
  let q = null;
  let op = '';
  // qpos: vị trí ký tự nháy đầu tiên trong token, để H6 chỉ tìm `>` ở phần không nằm trong nháy.
  const endTok = () => { if (has) { toks.push(cur); (toks.qpos ??= []).push(qp); } cur = ''; has = false; qp = Infinity; };
  const endSeg = () => { endTok(); if (toks.length) { toks.op = op; op = ''; segs.push(toks); } toks = []; };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) {
      if (c === q) { q = null; continue; }
      if (q === '"' && c === '\\' && (cmd[i + 1] === '"' || cmd[i + 1] === '\\')) { cur += cmd[i + 1]; i++; continue; }
      cur += c;
      continue;
    }
    if (c === '\\' && (cmd[i + 1] === "'" || cmd[i + 1] === '"')) { cur += cmd[i + 1]; has = true; i++; continue; }
    if (c === '"' || c === "'") { if (qp === Infinity) qp = cur.length; q = c; has = true; continue; }
    if (c === '\n') { endSeg(); if (op !== '||' && op !== '|') op = ';'; continue; }
    if (/\s/.test(c)) { endTok(); continue; }
    if (';&|()`'.includes(c)) {
      endSeg();
      // `||` / `|` giữ tới đoạn kế: lệnh sau đó có thể chạy khi `cd` phía trước chưa xảy ra.
      if (c === '|' && cmd[i + 1] === '|') op = '||';
      else if (c === '|' && op !== '||') op = '|';
      else if (c !== '|' && op !== '||' && op !== '|') op = c;
      continue;
    }
    cur += c;
    has = true;
  }
  endSeg();
  return { segs, unclosed: q !== null };
}

// Cách tách thô (không hiểu nháy) của bản cũ: chạy song song với parse() vì nháy lẻ (heredoc, #, \') làm parse() nuốt các lệnh phía sau.
function naiveSegments(cmd) {
  const out = [];
  let op = '';
  cmd.split(/(&&|\|\||;|\n|\|)/).forEach((x, k) => {
    if (k % 2) { if (op !== '||' && op !== '|') op = x; return; }
    const words = x.match(/"[^"]*"|'[^']*'|\S+/g) || [];
    const t = words.map((w) => w.replace(/^(["'])(.*)\1$/s, '$2'));
    t.qpos = words.map((w) => { const p = w.search(/["']/); return p < 0 ? Infinity : p; });
    if (t.length) { t.op = op; op = ''; out.push(t); }
  });
  return out;
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

function pushReason(t, gc, cwd, currentBranch, cdUnresolved = false, msys = true) {
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
  // -C chứa biến/~/backtick không resolve được → không biết nhánh hiện tại, hỏi thay vì tra một đường dẫn literal.
  const unresolvable = cdUnresolved || gc.dirs.some(hasUnresolvedRef);
  const dir = gc.dirs.length ? path.resolve(cwd, ...gc.dirs.map((d) => np(d, msys))) : cwd;
  const refs = specs.map((r) => r.split(':').pop().replace(/^refs\/heads\//, ''));
  const wantsHead = (refs.length ? refs : ['HEAD']).some((r) => r === 'HEAD' || r === '@');
  if (unresolvable && wantsHead) return 'push không xác định được nhánh hiện tại (đường dẫn -C/cd chứa biến/~)';
  const targets = (refs.length ? refs : ['HEAD']).map((r) => (r === 'HEAD' || r === '@' ? currentBranch(dir) : r));
  const hit = targets.find((r) => r && PROTECTED.has(r));
  return hit ? `push vào nhánh bảo vệ "${hit}"` : null;
}

// Git Bash đổi /e/x thành E:/x; PowerShell giải /e/x theo ổ hiện tại (E:\e\x) nên không được đổi.
const np = (p, msys) => (msys ? normalizeMsysPath(p) : p);

const CD_CMDS = new Set(['cd', 'chdir', 'pushd', 'push-location', 'set-location', 'sl']);
const POP_CMDS = new Set(['popd', 'pop-location']);

// Theo dõi thư mục làm việc qua các đoạn theo thứ tự: `cd repo && git push` phải tra nhánh của repo, không phải của cwd phiên.
function trackDirs(segs, cwd, msys = true) {
  let dir = cwd;
  let unres = false;
  let cdSeen = false;
  return segs.map((t) => {
    const name = String(t[0]).toLowerCase();
    // Sau `||` / `|` lệnh cd phía trước có thể chưa chạy (hoặc chạy ở tiến trình con) → không tin thư mục đang theo dõi.
    if (cdSeen && (t.op === '||' || t.op === '|')) unres = true;
    if (CD_CMDS.has(name)) {
      cdSeen = true;
      const arg = t.slice(1).find((x) => !(/^-[A-Za-z]/.test(x) || x === '--' || x === '/d' || x === '/D'));
      if (arg === undefined || hasUnresolvedRef(arg) || arg === '-') unres = true;
      else { const a = np(arg, msys); dir = path.resolve(dir, a); if (path.isAbsolute(a)) unres = false; }
    } else if (POP_CMDS.has(name)) {
      cdSeen = true;
      unres = true;
    }
    // u: lệnh đã bỏ tiền tố bọc (env -S, sudo, nice…) để H1 thấy `git push` thật.
    const u = unwrap(t)[0];
    return { t, u, gc: gitCmd(u), dir, unres };
  });
}

function withDirs(segs, cwd, msys = true) {
  return trackDirs(segs, cwd, msys).filter((x) => x.gc);
}

// H6 là heuristic đọc token, không phải sandbox: biến, subshell, script con vẫn có thể ghi ra ngoài root mà không bị thấy.
const WRITE_CMDS = new Set(['rm', 'rmdir', 'del', 'erase', 'rd', 'remove-item', 'mv', 'move', 'move-item', 'cp', 'copy', 'copy-item', 'touch', 'mkdir', 'chmod', 'chown', 'tee', 'truncate', 'set-content', 'out-file', 'add-content']);
const LAST_ONLY = new Set(['cp', 'copy', 'copy-item']);
const FIRST_ONLY = new Set(['set-content', 'out-file', 'add-content']);
const SKIP_FIRST = new Set(['chmod', 'chown']);
const CMD_SWITCH = new Set(['del', 'erase', 'rd', 'copy', 'move']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'pwsh', 'powershell']);
const PS_PATH_FLAGS = new Set(['-path', '-literalpath', '-filepath', '-destination']);
const NULL_DEVICE = /^(\/dev\/(null|stdout|stderr)|nul|\$null)$/i;
const WRITE_IN_STRING = new RegExp(`(^|[\\s;&|(])(${[...WRITE_CMDS].join('|')})(\\s|$)|>(?!&)`, 'i');
const GLOB = /[*?[]/;

const cmdName = (x) => String(x).split(/[\\/]/).pop().toLowerCase().replace(/\.exe$/, '');

const SUDO_VALUE_OPT = /^(-[A-Za-z]*[ughpCrtUDRT]|--(user|group|host|prompt|chdir|role|type|other-user|close-from))$/;
const ENV_SPLIT = /^(-S|--split-string=?)([\s\S]*)$/;

// Bỏ tiền tố bọc lệnh (VAR=x, sudo, timeout, nohup, nice, env, command, exec); trả [token, chỉ số lệnh thật].
// `env -S "<chuỗi>"` được tách bằng chính parse() và ghép vào token để H6 và matchesAsk thấy lệnh thật.
function unwrap(tokens) {
  let t = tokens;
  let k = 0;
  while (k < t.length) {
    const n = cmdName(t[k]);
    if (/^\w+=/.test(t[k]) || ['nohup', 'command', 'exec'].includes(n)) { k++; continue; }
    if (n === 'sudo') {
      k++;
      while (k < t.length && t[k].startsWith('-')) k += SUDO_VALUE_OPT.test(t[k]) ? 2 : 1;
      continue;
    }
    if (n === 'timeout') {
      k++;
      while (k < t.length && t[k].startsWith('-')) k += /^(-s|-k|--signal|--kill-after)$/.test(t[k]) ? 2 : 1;
      if (k < t.length && /^\d+(\.\d+)?[smhd]?$/.test(t[k])) k++;
      continue;
    }
    if (n === 'nice') {
      k++;
      if (/^(-n|--adjustment)$/.test(t[k])) k += 2;
      else if (/^(-n-?\d+|--?\d+|--adjustment=\S+)$/.test(t[k])) k++;
      continue;
    }
    if (n === 'env') {
      k++;
      while (k < t.length && (t[k].startsWith('-') || /^\w+=/.test(t[k]))) {
        const m = ENV_SPLIT.exec(t[k]);
        if (m) {
          const used = m[2] || t[k + 1] === undefined ? 1 : 2;
          t = [...t.slice(0, k), ...parse(m[2] || t[k + 1] || '').segs.flat(), ...t.slice(k + used)];
          continue;
        }
        k += /^(-u|-C|--unset|--chdir)$/.test(t[k]) ? 2 : 1;
      }
      continue;
    }
    break;
  }
  return [t, k];
}

function classifyTarget(raw, dir, unres, roots, msys = true) {
  const p = np(raw, msys);
  if (NULL_DEVICE.test(p)) return null;
  const absolute = path.isAbsolute(p) || /^[A-Za-z]:[\\/]/.test(p) || p.startsWith('\\\\');
  if (!absolute && (unres || hasUnresolvedRef(p))) return 'unknown';
  if (GLOB.test(p)) {
    const parts = p.split(/[\\/]/);
    const first = parts.findIndex((x) => x !== '');
    const g = parts.findIndex((x) => GLOB.test(x));
    if (g <= first) return 'unknown';
    return classifyPath(`${parts.slice(0, g).join('/')}/`, dir, roots, msys);
  }
  return classifyPath(p, dir, roots, msys);
}

// Trả 'deny' | 'ask' | null cho một đoạn lệnh; nơi gọi cho deny của bất kỳ đoạn nào thắng ask của đoạn khác.
function confineSegment(t, dir, unres, roots, msys = true) {
  const rest = [];
  const targets = [];
  for (let i = 0; i < t.length; i++) {
    // Chỉ tìm `>` ở phần token trước ký tự nháy đầu: `awk '$1>2'` hay `"a > b"` là dữ liệu, còn `a>/tmp/x` là chuyển hướng.
    const tok = t[i];
    const head = tok.slice(0, t.qpos?.[i] ?? Infinity);
    let at = head.indexOf('>');
    if (at < 0) { rest.push(tok); continue; }
    const left = tok.slice(0, at);
    if (!/^(\d+|&)?$/.test(left)) rest.push(left);
    // Chuyển hướng nối chuỗi `a>b>/tmp/x`: mỗi `>` mở một đích ghi.
    while (at >= 0) {
      const after = at + (tok[at + 1] === '>' || tok[at + 1] === '|' ? 2 : 1);
      const nx = head.indexOf('>', after);
      // `2>&1` bị parse() tách ở `&` thành `2>` + `1`: đích thiếu hoặc bắt đầu bằng `&` là dup fd, không phải file.
      const target = tok.slice(after, nx < 0 ? undefined : nx) || (nx < 0 && i + 1 < t.length ? t[++i] : '');
      if (target && !target.startsWith('&')) targets.push(target);
      at = nx;
    }
  }
  const [tk, k] = unwrap(rest);
  const name = k < tk.length ? cmdName(tk[k]) : '';
  const args = tk.slice(k + 1);
  let ask = false;
  if (SHELLS.has(name) && args.some((a) => /^(-[a-z]*c|-command)$/i.test(a)) && WRITE_IN_STRING.test(args.join(' '))) ask = true;
  if (name === 'eval' && WRITE_IN_STRING.test(args.join(' '))) ask = true;
  if (WRITE_CMDS.has(name)) {
    let pos = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (PS_PATH_FLAGS.has(a.toLowerCase())) { if (i + 1 < args.length) targets.push(args[++i]); continue; }
      // chmod/chown: `-x`/`-w` là mode, chỉ `-R`/`--long`… mới là cờ.
      if (a.startsWith('-') && !(SKIP_FIRST.has(name) && /^-[A-Za-z]/.test(a) && !/^-[RfvchHLP]+$/.test(a))) continue;
      if (CMD_SWITCH.has(name) && /^\/[A-Za-z]$/.test(a)) continue;
      if (name === 'rmdir' && /^\/[sq]$/i.test(a)) continue;
      pos.push(a);
    }
    if (SKIP_FIRST.has(name)) pos = pos.slice(1);
    if (LAST_ONLY.has(name)) pos = pos.slice(-1);
    if (FIRST_ONLY.has(name)) pos = pos.slice(0, 1);
    targets.push(...pos);
  }
  let unknown = false;
  for (const p of targets) {
    const c = classifyTarget(p, dir, unres, roots, msys);
    if (c === 'outside') return 'deny';
    if (c === 'unknown') unknown = true;
  }
  return unknown || ask ? 'ask' : null;
}

// Token (hoặc phần tách theo khoảng trắng trong chuỗi nháy) khớp mẫu bí mật → lấy phần sau `=`/`@`/`<`/`(` làm đường dẫn rồi phân loại theo cwd đã theo dõi.
// Không tách được token bí mật nào dù regex khớp cả lệnh thì coi là không chắc ⇒ hỏi.
function secretOutsideRoots(lists, cwd, roots, re, msys = true) {
  let found = false;
  for (const { t, dir, unres } of lists.flatMap((l) => trackDirs(l, cwd, msys))) {
    for (const tok of t.flatMap((x) => x.split(/\s+/))) {
      if (!re.test(tok)) continue;
      found = true;
      const p = tok.slice(Math.max(tok.lastIndexOf('='), tok.lastIndexOf('@'), tok.lastIndexOf('<'), tok.lastIndexOf('(')) + 1);
      const c = classifyTarget(p, dir, unres, roots, msys);
      if (c === 'outside' || c === 'unknown') return true;
    }
  }
  return !found;
}

// PowerShell: backtick là ký tự escape/nối dòng, không phải dấu tách lệnh; chuẩn hoá trước khi tách để `ma`in` hay nối dòng không che push.
function psNormalize(cmd) {
  return cmd.replace(/`\r?\n/g, ' ').replace(/`([\s\S])/g, (_, c) => (c === '"' || c === "'" ? '\\' + c : c));
}

function defaultBranch(cwd) {
  try {
    return execFileSync('git', ['-C', cwd || '.', 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

// Phải khớp các quy tắc Bash(<tiền tố> *) nhóm git_push/network/production_deploy trong core/permissions/policy.json (test AC1.9 đối chiếu).
const KUBE_VALUE_FLAGS = new Set(['-n', '--namespace', '--context', '--kube-context', '--kubeconfig', '-s', '--server', '--cluster', '--user']);

export const ASK_COMMANDS = ['git push', 'curl', 'wget', 'kubectl apply', 'terraform apply', 'helm upgrade'];

// Đoạn lệnh có bắt đầu bằng một tiền tố ASK_COMMANDS không (bỏ qua VAR=x và sudo đứng trước).
function matchesAsk(orig) {
  const [t, k] = unwrap(orig);
  if (k >= t.length) return false;
  const name = cmdName(t[k]);
  const rest = t.slice(k);
  return ASK_COMMANDS.some((e) => {
    const [head, sub] = e.split(' ');
    if (name !== head) return false;
    if (!sub) return true;
    if (head === 'git') return gitCmd(rest)?.sub === sub;
    const args = rest.slice(1);
    let i = 0;
    // kubectl/helm: cờ toàn cục có giá trị đứng trước subcommand (`kubectl -n x apply`).
    while (i < args.length && args[i].startsWith('-')) i += KUBE_VALUE_FLAGS.has(args[i]) ? 2 : 1;
    return args[i] === sub;
  });
}

const NON_ASCII = /[^\x00-\x7F]/;
const DENY_COMMIT = { decision: 'deny', reason: 'Commit message có ký tự non-ASCII qua -m dễ hỏng encoding. Ghi message ra file UTF-8, kiểm bằng check-commit-message.mjs rồi chạy `git commit -F <file>` (skill git-workflow).' };

const ASK_UNPARSABLE = { decision: 'ask', reason: 'Không phân tích chắc chắn được lệnh (nháy không đóng) nhưng có vẻ là git commit -m kèm ký tự non-ASCII. Dùng `git commit -F <file>` (skill git-workflow) hoặc xác nhận thủ công.' };

// Kiểm tuyến tính theo dòng/đoạn (không regex lồng) để input dài không gây backtracking bậc hai.
function hasCommitWithMessageFlag(cmd) {
  for (const line of cmd.split('\n')) {
    for (const piece of line.split(/[;&|]+/)) {
      const toks = piece.trim().split(/\s+/);
      const g = toks.findIndex((x) => /(^|[\\/])git(\.exe)?$/i.test(x));
      if (g === -1) continue;
      const c = toks.indexOf('commit', g + 1);
      if (c === -1) continue;
      const rest = toks.slice(c + 1);
      if (rest.some((x) => /^(-[A-Za-z]*F|--file)/.test(x))) continue;
      if (rest.some((x) => /^(-[A-Za-z]*m|--message)/.test(x))) return true;
    }
  }
  return false;
}

export function decide(input, { currentBranch = defaultBranch, allowEnv = envFilesAllowed, config, repoRoot, tracked, reader = readGate } = {}) {
  const raw = String(input?.tool_input?.command ?? '');
  if (!raw) return null;
  const cmd = input?.tool_name === 'PowerShell' ? psNormalize(raw) : raw;
  const cwd = input?.cwd || '.';
  const msys = input?.tool_name !== 'PowerShell';
  // Kiểm rẻ (permission_mode) trước; chỉ đọc cấu hình (tốn lời gọi git) khi một nhánh H1–H3 thật sự cần quyết định.
  const bypass = input?.permission_mode === 'bypassPermissions';
  let cfg;
  let rg;
  const readOnce = () => (rg === undefined ? (rg = reader(cwd)) : rg);
  const gate = () => (cfg === undefined ? (cfg = config !== undefined ? config : (readOnce()?.config ?? null)) : cfg);
  // Không có gốc git (chỉ xảy ra khi cấu hình được truyền thẳng) thì coi cwd là root để không chặn nhầm mọi đường dẫn.
  const rootsOf = () => {
    const base = repoRoot ? [path.resolve(repoRoot)] : (readOnce()?.roots ?? []);
    return allowedRoots({ roots: base.length ? base : [path.resolve(cwd)], config: gate() }, input);
  };
  let fe;
  // Phiên không bypass không bao giờ full: thoát trước khi đọc cấu hình để không tốn lời gọi git nào.
  const full = () => (fe === undefined ? (fe = bypass && fullEffective(config !== undefined ? { config } : readOnce(), input, { tracked })) : fe);
  const { segs, unclosed } = parse(cmd);
  const parsed = withDirs(segs, cwd, msys);
  if (parsed.some(({ u, gc }) => gc.sub === 'commit' && commitMessages(u, gc.i + 1).some((m) => NON_ASCII.test(m))) && !full()) return DENY_COMMIT;
  // Nháy lẻ làm parse() mất cấu trúc: không tin được việc tách message → hỏi người dùng (ask) khi có dấu bất kỳ.
  if (unclosed && NON_ASCII.test(cmd) && hasCommitWithMessageFlag(cmd) && !full()) return ASK_UNPARSABLE;
  // Hợp của hai cách tách: bắt push dù nháy lẻ khiến một trong hai cách bỏ sót.
  const naive = withDirs(naiveSegments(cmd), cwd, msys);
  for (const { u, gc, dir, unres } of [...parsed, ...naive]) {
    const why = gc.sub === 'push' ? pushReason(u, gc, dir, currentBranch, unres, msys) : null;
    if (why && !(full() && !fullKeep(gate()).includes('push'))) return { decision: 'ask', reason: `Nguyên tắc nền: ${why} cần người dùng xác nhận trước.` };
  }
  if (full()) {
    const roots = rootsOf();
    let ask = false;
    for (const { t, dir, unres } of [...trackDirs(segs, cwd, msys), ...trackDirs(naiveSegments(cmd), cwd, msys)]) {
      const r = confineSegment(t, dir, unres, roots, msys);
      if (r === 'deny') return { decision: 'deny', reason: 'Chế độ full: lệnh ghi/xoá đường dẫn ngoài root của project. Thêm thư mục vào "fullRoots" trong .claude/aip-gate.json nếu thật sự cần.' };
      if (r === 'ask') ask = true;
    }
    if (ask) return { decision: 'ask', reason: 'Chế độ full: lệnh ghi/xoá có đường dẫn không xác định được (biến, ~, glob đầu đường dẫn, bash -c) — cần người dùng xác nhận.' };
  }
  // Phiên không bypass trong project full: settings.json không còn quy tắc ask nào chắc chắn áp dụng nên hook hỏi thay.
  // Chỉ đọc cấu hình sau khi một đoạn khớp tiền tố, để lệnh thường không tốn lời gọi git.
  if (!bypass && [...segs, ...naiveSegments(cmd)].some(matchesAsk) && gate()?.mode === 'full') {
    return { decision: 'ask', reason: 'Chế độ full: phiên không bypass nên lệnh push/mạng/deploy production cần người dùng xác nhận. Chạy `aip mode ask` hoặc khởi động với `--permission-mode bypassPermissions` nếu muốn đổi.' };
  }
  const hits = (re) => re.test(cmd) || re.test(raw);
  // Cấu hình chỉ đọc khi lệnh đã nhắc tới file bí mật: lệnh thường không tốn thêm lời gọi git.
  const secretAsk = { decision: 'ask', reason: 'Lệnh nhắc tới file bí mật (.env/khoá/credentials) — nguyên tắc nền không đọc/sửa file bí mật khi chưa được duyệt.' };
  if (hits(SECRET) && !full() && (hits(KEY_SECRET) || !allowEnv(cwd))) return secretAsk;
  // Ở full, bí mật chỉ mở trong root của project: đường dẫn bí mật nằm ngoài root hoặc không xác định được vẫn hỏi (khớp guard-files).
  if (hits(SECRET) && full()) {
    // Cùng mẫu với H3: allowEnvFiles bật thì .env không phải bí mật ở đây nên không được xét tới root.
    const secretRe = hits(KEY_SECRET) || !allowEnv(cwd) ? SECRET : KEY_SECRET;
    if (hits(secretRe) && secretOutsideRoots([segs, naiveSegments(cmd)], cwd, rootsOf(), secretRe, msys)) return secretAsk;
  }
  return null;
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
