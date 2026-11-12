#!/usr/bin/env node
// PreToolUse(Bash|PowerShell): biến các ranh giới "không push nhánh bảo vệ / commit -F / không đụng file bí mật" thành cổng cứng.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { envFilesAllowed, readGate, fullEffective, fullKeep, classifyPath, allowedRoots, normalizeMsysPath, hasUnresolvedRef, showArg, claudeTmpRoots } from './gate-config.mjs';

const PROTECTED = new Set(['main', 'master', 'dev', 'develop']);
// Biên gồm cả > : ` @ { , (vd x>.env, HEAD:.env, @.env, {a,.env}) vì tên file dính các ký tự này vẫn được lệnh đọc/ghi.
const SECRET = /(^|[\s'"=/\\<>(:`@{,])(\.env(rc)?(\.(?!(example|sample|template)\b)[\w.-]+)?|(?!process\.env(?![\w.-]))[\w.-]+\.env|[\w.-]+\.(pem|jks|keystore|p12|pfx|key|ppk|p8)|id_(rsa|dsa|ecdsa|ed25519)(_sk)?(\.(?!pub\b)[\w.-]+)?|credentials(\.(json|ya?ml))?)(?=$|[\s'";&|)<>`,}:])/i;
// SECRET bỏ nhánh .env: project bật "allowEnvFiles" thì chỉ khoá/credentials còn bị hỏi.
const KEY_SECRET = /(^|[\s'"=/\\<>(:`@{,])([\w.-]+\.(pem|jks|keystore|p12|pfx|key|ppk|p8)|id_(rsa|dsa|ecdsa|ed25519)(_sk)?(\.(?!pub\b)[\w.-]+)?|credentials(\.(json|ya?ml))?)(?=$|[\s'";&|)<>`,}:])/i;
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
  if (force || specs.some((r) => r.startsWith('+') || r.startsWith(':'))) return { kind: 'force' };
  // Refspec chứa biến/~/backtick không biết đích thật (có thể là nhánh bảo vệ): hỏi như -C không resolve được.
  if (specs.some(hasUnresolvedRef)) return { kind: 'unknown' };
  // -C chứa biến/~/backtick không resolve được → không biết nhánh hiện tại, hỏi thay vì tra một đường dẫn literal.
  const unresolvable = cdUnresolved || gc.dirs.some(hasUnresolvedRef);
  const dir = gc.dirs.length ? path.resolve(cwd, ...gc.dirs.map((d) => np(d, msys))) : cwd;
  const refs = specs.map((r) => r.split(':').pop().replace(/^refs\/heads\//, ''));
  const wantsHead = (refs.length ? refs : ['HEAD']).some((r) => r === 'HEAD' || r === '@');
  if (unresolvable && wantsHead) return { kind: 'unknown' };
  const targets = (refs.length ? refs : ['HEAD']).map((r) => (r === 'HEAD' || r === '@' ? currentBranch(dir) : r));
  const hit = targets.find((r) => r && PROTECTED.has(r));
  return hit ? { kind: 'protected', branch: hit } : null;
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
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ash', 'ksh', 'fish', 'csh', 'tcsh', 'cmd', 'pwsh', 'powershell']);
const PS_PATH_FLAGS = new Set(['-path', '-literalpath', '-filepath', '-destination']);
const NULL_DEVICE = /^(\/dev\/(null|stdout|stderr)|nul|\$null)$/i;
const WRITE_IN_STRING = new RegExp(`(^|[\\s;&|(])(${[...WRITE_CMDS].join('|')})(\\s|$)|>(?!&)`, 'i');
const GLOB = /[*?[]/;

const cmdName = (x) => String(x).split(/[\\/]/).pop().toLowerCase().replace(/\.exe$/, '');

const SHELL_KEYWORDS = new Set(['{', '!', 'if', 'then', 'else', 'elif', 'do', 'while', 'until']);
const SUDO_VALUE_OPT = /^(-[A-Za-z]*[ughpCrtUDRT]|--(user|group|host|prompt|chdir|role|type|other-user|close-from))$/;
const ENV_SPLIT = /^(-S|--split-string=?)([\s\S]*)$/;

// Bỏ tiền tố bọc lệnh (VAR=x, sudo, timeout, nohup, nice, env, command, exec); trả [token, chỉ số lệnh thật].
// `env -S "<chuỗi>"` được tách bằng chính parse() và ghép vào token để H6 và matchesAsk thấy lệnh thật.
function unwrap(tokens) {
  let t = tokens;
  let k = 0;
  while (k < t.length) {
    const n = cmdName(t[k]);
    // Từ khoá cấu trúc đứng ở vị trí lệnh (khối { }, if/then, for/do, !): lệnh thật là token kế, nếu không WRITE_CMDS không khớp.
    if (SHELL_KEYWORDS.has(t[k])) { k++; continue; }
    if (/^\w+=/.test(t[k]) || ['nohup', 'command', 'exec', 'busybox'].includes(n)) {
      k++;
      if (n === 'command') while (t[k]?.startsWith('-')) k++;
      continue;
    }
    // Các tiền tố bọc ít gặp: bỏ cờ của chúng để lệnh thật (cp, tee, rm…) lộ ra cho H6 và kiểm cấu hình hook.
    if (n === 'time') { k++; while (t[k]?.startsWith('-')) k++; continue; }
    if (n === 'doas' || n === 'ionice' || n === 'stdbuf') {
      k++;
      const value = n === 'doas' ? /^-[uC]$/ : n === 'ionice' ? /^-[cnpP]$/ : /^-[ioe]$/;
      while (t[k]?.startsWith('-')) k += value.test(t[k]) ? 2 : 1;
      continue;
    }
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

const SHELL_CMD_FLAG = /^(-[a-z]*c|-command|\/[ck])$/i;
const REST_AS_COMMAND = /^(-command|\/[ck])$/i;
const EVAL_CMDS = new Set(['eval', 'iex', 'invoke-expression']);

// Chuỗi lệnh con của `bash -c "…"`, `pwsh -Command …`, `eval …`, `iex …`: gitCmd chỉ nhận token đúng tên `git`, nên push nằm trong chuỗi bị che.
function innerSegs(t) {
  const [tk, k] = unwrap(t);
  const name = k < tk.length ? cmdName(tk[k]) : '';
  const args = tk.slice(k + 1);
  const inner = shellString(name, args);
  return inner ? parse(inner).segs : [];
}

// -Command (PowerShell) và /c, /k (cmd) nhận phần còn lại làm lệnh, -c chỉ nhận đối số kế (các đối số sau là $0, $1…).
function shellString(name, args) {
  if (SHELLS.has(name)) {
    const i = args.findIndex((a) => SHELL_CMD_FLAG.test(a));
    return i < 0 ? null : REST_AS_COMMAND.test(args[i]) ? args.slice(i + 1).join(' ') : args[i + 1];
  }
  return EVAL_CMDS.has(name) ? args.join(' ') : null;
}

// Đoạn con đặt ngay sau đoạn cha để trackDirs giữ đúng thứ tự cd; sâu quá 6 cấp thì dừng.
function expandShells(segs, depth = 0) {
  return segs.flatMap((t) => [t, ...(depth < 6 ? expandShells(innerSegs(t), depth + 1) : [])]);
}

// Chỉ phần dưới <tmpdir>/claude là root: xoá hay di chuyển cả thư mục gốc của Claude vẫn bị chặn.
function isClaudeTmpRoot(p, dir) {
  const a = path.resolve(dir, p).replace(/[\\/]+$/, '');
  return claudeTmpRoots().some((r) => (process.platform === 'win32' ? a.toLowerCase() === r.toLowerCase() : a === r));
}

function classifyTarget(raw, dir, unres, roots, msys = true) {
  const p = np(raw, msys);
  if (NULL_DEVICE.test(p)) return null;
  if (!hasUnresolvedRef(p) && !GLOB.test(p) && isClaudeTmpRoot(p, dir)) return 'outside';
  const absolute = path.isAbsolute(p) || /^[A-Za-z]:[\\/]/.test(p) || p.startsWith('\\\\');
  if (!absolute && (unres || hasUnresolvedRef(p))) return 'unknown';
  if (GLOB.test(p)) {
    const parts = p.split(/[\\/]/);
    const first = parts.findIndex((x) => x !== '');
    const g = parts.findIndex((x) => GLOB.test(x));
    if (g <= first) return 'unknown';
    if (isClaudeTmpRoot(parts.slice(0, g).join('/'), dir)) return 'outside';
    return classifyPath(`${parts.slice(0, g).join('/')}/`, dir, roots, msys);
  }
  return classifyPath(p, dir, roots, msys);
}

// Đích ghi của một đoạn lệnh (chuyển hướng, đối số của WRITE_CMDS, cờ đường dẫn PowerShell) kèm tên lệnh và đối số sau khi bỏ tiền tố bọc.
function writeTargets(t) {
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
  let allPos = [];
  if (WRITE_CMDS.has(name)) {
    let pos = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (PS_PATH_FLAGS.has(a.toLowerCase())) { if (i + 1 < args.length) targets.push(args[++i]); continue; }
      const colon = /^-(?:path|literalpath|filepath|destination):(.+)$/i.exec(a);
      if (colon) { targets.push(colon[1]); continue; }
      // chmod/chown: `-x`/`-w` là mode, chỉ `-R`/`--long`… mới là cờ.
      if (a.startsWith('-') && !(SKIP_FIRST.has(name) && /^-[A-Za-z]/.test(a) && !/^-[RfvchHLP]+$/.test(a))) continue;
      if (CMD_SWITCH.has(name) && /^\/[A-Za-z]$/.test(a)) continue;
      if (name === 'rmdir' && /^\/[sq]$/i.test(a)) continue;
      pos.push(a);
    }
    if (SKIP_FIRST.has(name)) pos = pos.slice(1);
    if (LAST_ONLY.has(name)) pos = pos.slice(-1);
    // Set-Content/Out-File: cờ có giá trị (-Encoding utf8, -Value x) làm đối số đầu không còn là đích thật; allPos giữ mọi đối số cho kiểm cấu hình hook.
    allPos = pos;
    if (FIRST_ONLY.has(name)) pos = pos.slice(0, 1);
    targets.push(...pos);
  }
  return { targets, name, args, allPos };
}

// Chuỗi con của `bash -c`/`eval` có ghi gì không: đọc bằng parse nên `>` trong nháy của awk hay tên lệnh nằm trong đối số không bị tính.
// Nháy không đóng làm parse mất cấu trúc: rơi về regex thô như bản cũ (hỏi thừa còn hơn bỏ sót).
function stringWrites(str) {
  const s = str.replace(/>\|/g, '>');
  const p = parse(s);
  if (p.unclosed) return WRITE_IN_STRING.test(s);
  return [...expandShells(p.segs), ...expandShells(naiveSegments(s))].some((t) => {
    const w = writeTargets(t);
    return w.targets.some((x) => !NULL_DEVICE.test(x)) || WRITE_CMDS.has(w.name) || indirectWrite(t, w);
  });
}

// Trả 'deny' | 'ask' | null cho một đoạn lệnh; nơi gọi cho deny của bất kỳ đoạn nào thắng ask của đoạn khác.
function confineSegment(t, dir, unres, roots, msys = true) {
  const { targets, name, args } = writeTargets(t);
  const inner = name === 'eval' || SHELLS.has(name) ? shellString(name, args) : null;
  const ask = Boolean(inner) && stringWrites(inner);
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

const KUBE_VALUE_FLAGS = new Set(['-n', '--namespace', '--context', '--kube-context', '--kubeconfig', '-s', '--server', '--cluster', '--user']);

// Phải khớp các quy tắc Bash(<tiền tố> *) nhóm git_push/network/production_deploy trong core/permissions/policy.json (test AC1.9 đối chiếu).
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

// File cấu hình của chính các hook (xem guard-files): lệnh nhắc tên file kèm lệnh ghi thì hỏi.
// shortcut: heuristic đọc token, `node -e`/script con ghi file vẫn lọt; nâng lên khi cần chặn thật thì dùng quyền hệ thống file.
const GUARD_CONFIG = /(?:\.claude[\\/]settings(?:\.[\w-]+)?|(?:^|[^\w.-])aip-gate)\.json(?![\w.-])/i;
const IN_PLACE_FLAG = /^(?:-[a-z]*i|--in-place)/i;

// Chỉ đích ghi mới tính: tên file cấu hình nằm trong message hay đối số đọc không làm lệnh bị hỏi.
// xargs/find/parallel nhận lệnh ghi qua đối số hay đầu vào pipe nên không có đích ghi nhìn thấy được: coi là ghi khi đoạn có tên lệnh ghi hoặc -exec/-delete.
const INDIRECT = new Set(['xargs', 'find', 'parallel']);
const inPlaceEdit = (all) => all.some((x) => x === 'sed' || x === 'perl') && all.some((x) => IN_PLACE_FLAG.test(x));
const writeSignal = (all, indirect) => all.some((x) => WRITE_CMDS.has(cmdName(x)) || (indirect && (SHELLS.has(cmdName(x)) || /^-(exec|execdir|delete)$/.test(x)))) || inPlaceEdit(all);
const indirectWrite = (t, w = writeTargets(t)) => INDIRECT.has(w.name) && writeSignal(w.args, true);
const isConfigPath = (x) => !/\s/.test(x) && GUARD_CONFIG.test(x);

// Tên file cấu hình đến từ đoạn khác (`echo cfg | xargs rm`) hay từ placeholder: có đoạn ghi gián tiếp và một token giống đường dẫn cấu hình ở bất kỳ đâu thì hỏi.
// Đích ghi là biến ($F), sed/perl tại-chỗ trên biến, hoặc awk/python/node… tự ghi file: không đọc được đích nên hỏi khi chính lệnh nhắc tên file cấu hình hook.
const INTERPRETERS = new Set(['awk', 'gawk', 'mawk', 'python', 'python2', 'python3', 'node', 'nodejs', 'perl', 'ruby', 'php', 'lua']);
function opaqueConfigWrite(list, cmd) {
  if (!GUARD_CONFIG.test(cmd)) return false;
  return list.some((t) => {
    const w = writeTargets(t);
    if (w.targets.some(hasUnresolvedRef)) return true;
    if ((w.name === 'sed' || w.name === 'perl') && w.args.some((x) => IN_PLACE_FLAG.test(x)) && w.args.some(hasUnresolvedRef)) return true;
    return INTERPRETERS.has(w.name) && w.args.some((x) => /[>]|open\(|write/i.test(x));
  });
}

// parse coi $( ) và backtick trong nháy là một token: bóc chuỗi bên trong (ngoặc cân bằng, tối đa 4 lớp, 200 chuỗi) để kiểm cấu hình hook như lệnh thường.
// Vượt trần thì trả truncated để người gọi hỏi, không đoán; vòng lặp thay cho spread vì input lớn làm tràn stack.
const MAX_INNER = 200;
function innerCommands(s, out) {
  for (let i = s.indexOf('$('); i >= 0 && out.length <= MAX_INNER;) {
    let depth = 1;
    let j = i + 2;
    for (; j < s.length && depth; j++) {
      if (s[j] === '(') depth++;
      else if (s[j] === ')') depth--;
    }
    out.push(s.slice(i + 2, depth ? s.length : j - 1));
    i = s.indexOf('$(', j);
  }
  for (let k = s.indexOf('`'); k >= 0 && out.length <= MAX_INNER;) {
    const e = s.indexOf('`', k + 1);
    if (e < 0) break;
    out.push(s.slice(k + 1, e));
    k = s.indexOf('`', e + 1);
  }
}
const hasSubstitution = (x) => x.includes('$(') || x.includes('`');
function substitutedConfigWrite(list, cmd) {
  const found = [];
  let layer = [];
  for (const t of list) for (const x of t) if (hasSubstitution(x)) layer.push(x);
  for (let depth = 0; layer.length; depth++) {
    if (depth >= 4 || found.length > MAX_INNER) return GUARD_CONFIG.test(cmd);
    const next = [];
    for (const x of layer) innerCommands(x, next);
    for (const x of next) found.push(x);
    layer = next.filter(hasSubstitution);
  }
  if (found.length > MAX_INNER) return GUARD_CONFIG.test(cmd);
  return found.some((str) => expandShells(parse(str).segs).some(writesGuardConfig));
}

function pipedIndirectConfigWrite(list) {
  return list.some((t) => indirectWrite(t)) && list.some((t) => t.some(isConfigPath));
}

function writesGuardConfig(t) {
  const { targets, name, args, allPos } = writeTargets(t);
  if (targets.some((p) => GUARD_CONFIG.test(p)) || (FIRST_ONLY.has(name) && allPos.some((p) => GUARD_CONFIG.test(p)))) return true;
  // Lệnh không thuộc WRITE_CMDS (khối script PowerShell, xargs, find, parallel…): không đọc được đích ghi thì hỏi khi cùng đoạn có đường dẫn cấu hình và tín hiệu ghi.
  if (name !== 'sed' && name !== 'perl' && !WRITE_CMDS.has(name)) {
    const all = [name, ...args];
    // xargs/find/parallel đưa chuỗi `sh -c '… > cfg'` làm một đối số có khoảng trắng nên tên file nằm trong chuỗi vẫn tính.
    const indirect = INDIRECT.has(name);
    if (all.some((x) => (indirect ? GUARD_CONFIG.test(x) : isConfigPath(x))) && writeSignal(all, indirect)) return true;
  }
  return (name === 'sed' || name === 'perl') && args.some((a) => IN_PLACE_FLAG.test(a)) && args.some((a) => GUARD_CONFIG.test(a));
}

// Câu hỏi hiện trong popup cho người dùng: nói việc lệnh làm, vì sao hỏi, cho phép thì sao và nên chọn gì, không dùng thuật ngữ nội bộ.
const PUSH_TEXT = {
  force: 'Lệnh push này có thể ghi đè hoặc xoá nhánh trên remote; commit bị mất không lấy lại được. Hãy từ chối, trừ khi chính bạn yêu cầu.',
  unknown: 'Không đoán được lệnh sẽ push vào nhánh nào (tên nhánh hoặc thư mục là biến). Xem lệnh bên dưới; chỉ cho phép khi chắc đó không phải nhánh bảo vệ.',
};
const pushText = (r) => (r.kind === 'protected'
  ? `Đẩy code lên nhánh bảo vệ \`${r.branch}\` trên remote. Sau khi đẩy, người khác thấy ngay và khó rút lại. Chỉ cho phép nếu bạn đã duyệt diff; nếu không, hãy từ chối để agent đẩy lên nhánh feature.`
  : PUSH_TEXT[r.kind]);
const CONFIG_TEXT = 'Lệnh sửa file cấu hình quyền (.claude/aip-gate.json hoặc settings.json), nơi quyết định agent được làm gì mà không hỏi bạn. Chỉ cho phép khi chính bạn yêu cầu đổi cấu hình; nếu không, hãy từ chối.';
const FULL_PATH_TEXT = 'Lệnh ghi hoặc xoá ở đường dẫn chỉ biết lúc chạy (`$VAR`, `~`, `*`), không chắc nằm trong thư mục project. Xem kỹ đường dẫn trước khi cho phép; không chắc thì từ chối.';
const FULL_NO_BYPASS_TEXT = 'Lệnh đẩy code, gọi mạng hoặc deploy. Project bật chế độ full nhưng phiên này không chạy ở chế độ bỏ qua hỏi quyền nên vẫn hỏi bạn như bình thường. Cho phép hoặc từ chối từng lần; muốn đổi thì chạy `aip mode ask`.';
const secretText = (name) => `Lệnh nhắc tới file bí mật \`${showArg(name)}\`. Cho phép thì nội dung file có thể lọt vào hội thoại với agent hoặc bị gửi ra ngoài. Hãy từ chối nếu không cần; bạn có thể tự mở file.`;

// Dòng tóm tắt đọc từ chính parse của hook (nháy, bung bash -c/eval), không cắt heredoc bằng regex: liệt kê thừa còn hơn giấu lệnh, và chạy tuyến tính.
const MAX_STEPS = 6;
// Chỉ dùng thông tin có sẵn từ parse (tên lệnh, lệnh con git, đích chuyển hướng); không đoán số file vì git commit -m không nêu file nào.
function summarize(cmd) {
  const p = parse(stripSimpleHeredocs(cmd) ?? cmd);
  const steps = [];
  let total = 0;
  let nested = false;
  for (const t of expandShells(p.segs)) {
    const [tk, k] = unwrap(t);
    if (/\$\(|`|<\(/.test(t.join(' '))) nested = true;
    if (k >= tk.length || String(tk[k]).startsWith('#')) continue;
    total++;
    if (steps.length >= MAX_STEPS) continue;
    const g = cmdName(tk[k]) === 'git' ? gitCmd(tk.slice(k)) : null;
    const target = writeTargets(t).targets.find((x) => !NULL_DEVICE.test(x));
    steps.push(`${g ? `git ${showArg(g.sub, 40)}` : showArg(cmdName(tk[k]), 40)}${target ? ` (ghi vào ${showArg(target, 60)})` : ''}`);
  }
  if (!total) return '';
  const more = total > MAX_STEPS ? `, … và ${total - MAX_STEPS} bước khác` : '';
  const open = (p.unclosed ? ' (nháy chưa đóng: danh sách có thể thiếu bước)' : '') + (nested ? ' (có lệnh lồng trong nháy: xem khối lệnh bên dưới)' : '');
  return `Lệnh gồm: ${steps.join(', ')}${more}.${open}`;
}

const NON_ASCII = /[^\x00-\x7F]/;
const DENY_COMMIT = { decision: 'deny', reason: 'Commit message có ký tự non-ASCII qua -m dễ hỏng encoding. Ghi message ra file UTF-8, kiểm bằng check-commit-message.mjs rồi chạy `git commit -F <file>` (skill git-workflow).' };

const UNPARSABLE_TEXT = 'Không đọc chắc được lệnh commit (dấu nháy chưa đóng). Nên từ chối để agent viết lại bằng `git commit -F`, hoặc cho phép nếu bạn đã tự kiểm tra lệnh.';

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

// Đoạn chỉ đọc metadata (git check-ignore/ls-files, echo, printf) nhắc tên file bí mật mà không đọc nội dung thì không hỏi.
// Chỉ miễn khi đoạn không chuyển hướng, không pipe sang lệnh sau và cả lệnh không có $( ), `` hay <( ): các đường đó đưa tên file sang lệnh đọc nội dung.
const META_GIT = new Set(['check-ignore', 'ls-files']);
const META_NAMES = new Set(['echo', 'printf', 'ls', 'dir']);
// git log chỉ miễn khi mọi cờ nằm trong danh sách này: -p/--patch/-S/-G/-L/--textconv và cờ lạ in được nội dung file nên vẫn bị hỏi.
const LOG_SAFE_FLAG = /^(--(oneline|stat|shortstat|numstat|name-only|name-status|follow|all|graph|decorate|abbrev-commit|no-merges)|--(format|pretty|date|since|until|author|max-count|skip)=.*|-\d+|-n\d*)$/;
function isMetaOnly(t) {
  const name = cmdName(t[0]);
  if (META_NAMES.has(name)) return true;
  const g = name === 'git' ? gitCmd(t) : null;
  if (!g) return false;
  if (META_GIT.has(g.sub)) return true;
  if (g.sub !== 'log') return false;
  // `git -c core.pager=…` chạy lệnh tuỳ ý khi mở pager: cấu hình truyền qua dòng lệnh làm git log không còn là lệnh metadata thuần.
  if (t.slice(1, g.i).some((x) => x === '-c' || x.startsWith('--config-env'))) return false;
  const dd = t.indexOf('--', g.i + 1);
  return t.slice(g.i + 1, dd < 0 ? undefined : dd).every((a) => !a.startsWith('-') || LOG_SAFE_FLAG.test(a));
}

// Mẫu tìm kiếm là chuỗi cần tìm chứ không phải file được mở: bỏ khỏi văn bản quét bí mật. Đối số còn lại (đường dẫn) vẫn được quét.
// Chỉ bỏ khi chắc chắn: mọi cờ của lệnh tìm kiếm đều là cờ boolean đã biết (hoặc đúng -e/--regexp tách rời); gặp cờ lạ (-f nạp mẫu từ file, -efoo dính liền, --glob, -Path…)
// thì không bỏ gì, vì khi đó đối số dương đầu có thể chính là file bí mật.
const SEARCH_CMDS = new Set(['grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack']);
const SEARCH_BOOL_FLAG = /^(-[rRniIvwxclLhHsaEFPoqzuU]+|--(recursive|ignore-case|line-number|count|files-with-matches|files-without-match|invert-match|word-regexp|line-regexp|fixed-strings|extended-regexp|perl-regexp|no-filename|with-filename|quiet|silent|only-matching|text|no-messages|smart-case|hidden|no-ignore))$/;
// Cờ --grep/--testNamePattern/--filter chỉ được bỏ giá trị ở các lệnh chạy test/log đã biết, không phải mọi lệnh.
const FILTER_RUNNERS = new Set(['npm', 'npx', 'pnpm', 'yarn', 'jest', 'vitest', 'mocha', 'pytest', 'git', 'mvn', 'gradle']);
function withoutSearchPatterns(t) {
  const [tk, k] = unwrap(t);
  const name = cmdName(tk[k] ?? '');
  const rest = tk.slice(k + 1);
  const out = tk.slice(0, k + 1);
  const runner = FILTER_RUNNERS.has(name);
  const dd = rest.indexOf('--');
  const flags = (dd < 0 ? rest : rest.slice(0, dd)).filter((a) => a.startsWith('-'));
  const known = SEARCH_CMDS.has(name) && flags.every((a) => a === '-e' || a === '--regexp' || SEARCH_BOOL_FLAG.test(a));
  let patternSeen = (dd < 0 ? rest : rest.slice(0, dd)).some((a) => a === '-e' || a === '--regexp');
  let afterDashes = false;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (runner && /^--(grep|testNamePattern|filter)=/.test(a)) continue;
    if (runner && /^--(grep|testNamePattern|filter)$/.test(a)) { out.push(a); i++; continue; }
    if (!known || afterDashes) { out.push(a); continue; }
    if (a === '--') { afterDashes = true; out.push(a); continue; }
    if (a === '-e' || a === '--regexp') { patternSeen = true; out.push(a); i++; continue; }
    if (a.startsWith('-')) { out.push(a); continue; }
    if (!patternSeen) { patternSeen = true; continue; }
    out.push(a);
  }
  return out;
}
// Theo dõi nháy của một dòng và vị trí các `<<` ngoài nháy; trạng thái mở nháy nghĩa là dòng sau chỉ là nội dung chuỗi.
function lineQuotes(line) {
  let q = null;
  const ops = [];
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (q === '"' && c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '\\') { i++; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '<' && line[i + 1] === '<') { ops.push(i); i++; }
  }
  return { open: q !== null, ops };
}
const HEREDOC_BEFORE = /^[ \t]*(?:cat|tee)(?=[ \t<])[^|;&<`()#\n]*$/;
const HEREDOC_AFTER = /^-?[ \t]*(['"])(\w+)\1(?=[ \t]|$)[^|;&<`()#\n]*$/;
// Bỏ thân heredoc bằng quét từng dòng, chỉ khi dòng có << là heredoc thật và đơn giản (cat/tee, delimiter có nháy kết thúc ở khoảng trắng, không # | ; & < ( ) hay $' ${ $[); null nếu không chắc.
function stripSimpleHeredocs(rest) {
  const out = [];
  let end = null;
  for (const raw of rest.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (end !== null) { if (line.trim() === end) end = null; continue; }
    const { open, ops } = lineQuotes(line);
    if (open || ops.length > 1 || /\$['{[(]/.test(line)) return null;
    if (ops.length === 1) {
      const m = HEREDOC_AFTER.exec(line.slice(ops[0] + 2));
      if (!m || !HEREDOC_BEFORE.test(line.slice(0, ops[0]))) return null;
      end = m[2];
    }
    out.push(raw);
  }
  return out.join('\n');
}

// Giải biến gán ở đầu chuỗi cho H6 ở full (`S=$(cygpath -u '<đường dẫn>'); mkdir -p $S/bin`); điều kiện nhận nằm ở ASSIGN_* và VAR_MUTATORS, không thoả thì trả nguyên lệnh.
const ASSIGN_LEAD = /[ \t\r\n]*([A-Za-z_]\w*)=/y;
const ASSIGN_VALUE = /(?:\$\(\s*cygpath(?:\s+-[A-Za-z]+)*\s+'([^']*)'\s*\)|\$\(\s*cygpath(?:\s+-[A-Za-z]+)*\s+"([^"$`\\]*)"\s*\)|'([^']*)'|"([^"$`\\]*)"|([^\s'"$`;&|()<>*?[\]{}~\\]+))(?=[ \t]*(?:;|\r?\n|$))/y;
const ASSIGN_TAIL = /[ \t]*(?:;|\r?\n)?/y;
const VAR_MUTATORS = /\b(?:unset|read|declare|typeset|local|readonly|eval|source|mapfile|readarray|getopts)\b|printf\s+-v|\bIFS\b|(?:^|[;&|\n(])[ \t]*\.[ \t]/;
// Chỉ ký tự đường dẫn thường: nháy, ; # ( ) < > = bị loại vì giá trị được chèn lại vào lệnh rồi parse lại.
const absoluteLiteral = (v) => typeof v === 'string' && /^[A-Za-z0-9_.\/:\\@%+,-]+$/.test(v) && (v.startsWith('/') || /^[A-Za-z]:[\\/]/.test(v));
function substituteVars(cmd, tool) {
  if (tool === 'PowerShell' || cmd.length > 20000) return cmd;
  const known = new Map();
  let pos = 0;
  for (;;) {
    ASSIGN_LEAD.lastIndex = pos;
    const lead = ASSIGN_LEAD.exec(cmd);
    if (!lead) break;
    ASSIGN_VALUE.lastIndex = ASSIGN_LEAD.lastIndex;
    const v = ASSIGN_VALUE.exec(cmd);
    if (!v) break;
    const value = v[1] ?? v[2] ?? v[3] ?? v[4] ?? v[5];
    // IFS đổi cách shell tách $S thành nhiều từ nên mọi phép thay thế sau đó đều sai.
    if (lead[1] === 'IFS') return cmd;
    known.set(lead[1], absoluteLiteral(value) ? value : null);
    ASSIGN_TAIL.lastIndex = ASSIGN_VALUE.lastIndex;
    ASSIGN_TAIL.exec(cmd);
    if (ASSIGN_TAIL.lastIndex === ASSIGN_VALUE.lastIndex) { pos = ASSIGN_TAIL.lastIndex; break; }
    pos = ASSIGN_TAIL.lastIndex;
  }
  const rest = cmd.slice(pos);
  if (known.size > 20 || ![...known.values()].some(Boolean) || /<<</.test(rest) || VAR_MUTATORS.test(rest)) return cmd;
  const stripped = stripSimpleHeredocs(rest);
  if (stripped === null) return cmd;
  let out = stripped;
  for (const [name, value] of known) {
    if (!value || new RegExp(String.raw`(?<![\w$])${name}\s*(?:\[|\+?=)|\b${name}\s+in\b`).test(rest)) continue;
    out = out.replace(new RegExp(String.raw`\$(?:\{${name}\}|${name}(?![A-Za-z0-9_]))`, 'g'), () => value);
  }
  return cmd.slice(0, pos) + out;
}

// Chuyển hướng tới fd khác hay null device không ghi file; bỏ trước khi tách vì parse() coi `&` trong `2>&1` là toán tử.
const HARMLESS_REDIRECT = /(^|\s)(?:\d*>>?&\d+|(?:\d*|&)>>?\s*(?:\/dev\/null|nul|\$null))(?=\s|$|[;&|])/gi;
function secretScanText(cmd) {
  if (/\$\(|`|<\(/.test(cmd)) return cmd;
  const c = cmd.replace(HARMLESS_REDIRECT, '$1');
  const p = parse(c);
  if (p.unclosed) return cmd;
  const keep = (list) => list.filter((t, k) => {
    const meta = isMetaOnly(t);
    return !meta || list[k + 1]?.op === '|' || t.some((x) => /[<>]/.test(x));
  });
  return [...keep(p.segs), ...keep(naiveSegments(c))].map((t) => withoutSearchPatterns(t).join(' ')).join('\n');
}

export function decide(input, { currentBranch = defaultBranch, allowEnv = envFilesAllowed, config, repoRoot, tracked, reader = readGate } = {}) {
  const raw = String(input?.tool_input?.command ?? '');
  if (!raw) return null;
  // Shell POSIX nối dòng bằng \<xuống dòng>; không nối thì \ thành refspec và che nhánh phía sau. PowerShell đã nối bằng backtick ở psNormalize.
  const cmd = input?.tool_name === 'PowerShell' ? psNormalize(raw) : raw.replace(/\\\r?\n/g, ' ').replace(/>\|/g, '>');
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
  const ask = (text) => { let line = ''; try { line = summarize(cmd); } catch { /* chỉ mất dòng tóm tắt */ } return { decision: 'ask', reason: line ? `${text}\n${line}` : text }; };
  const parsedCmd = parse(cmd);
  const { unclosed } = parsedCmd;
  // Chuỗi con của shell -c/eval chỉ vào kiểm push và tiền tố ask; H6 giữ cách nhìn riêng của confineSegment (ask với bash -c).
  const outer = parsedCmd.segs;
  const naiveOuter = naiveSegments(cmd);
  const segs = expandShells(outer);
  const naiveAll = expandShells(naiveOuter);
  const parsed = withDirs(segs, cwd, msys);
  if (parsed.some(({ u, gc }) => gc.sub === 'commit' && commitMessages(u, gc.i + 1).some((m) => NON_ASCII.test(m))) && !full()) return DENY_COMMIT;
  // Nháy lẻ làm parse() mất cấu trúc: không tin được việc tách message → hỏi người dùng (ask) khi có dấu bất kỳ.
  if (unclosed && NON_ASCII.test(cmd) && hasCommitWithMessageFlag(cmd) && !full()) return ask(UNPARSABLE_TEXT);
  // Hợp của hai cách tách: bắt push dù nháy lẻ khiến một trong hai cách bỏ sót.
  const naive = withDirs(naiveAll, cwd, msys);
  for (const { u, gc, dir, unres } of [...parsed, ...naive]) {
    const why = gc.sub === 'push' ? pushReason(u, gc, dir, currentBranch, unres, msys) : null;
    if (why && !(full() && !fullKeep(gate()).includes('push'))) return ask(pushText(why));
  }
  if ([...segs, ...naiveAll].some(writesGuardConfig) || pipedIndirectConfigWrite([...segs, ...naiveAll]) || opaqueConfigWrite([...segs, ...naiveAll], cmd) || substitutedConfigWrite([...segs, ...naiveAll], cmd)) {
    return ask(CONFIG_TEXT);
  }
  if (full()) {
    const roots = rootsOf();
    let unknownPath = false;
    const resolved = substituteVars(cmd, input?.tool_name);
    const [fullOuter, fullNaive] = resolved === cmd ? [outer, naiveOuter] : [parse(resolved).segs, naiveSegments(resolved)];
    for (const { t, dir, unres } of [...trackDirs(fullOuter, cwd, msys), ...trackDirs(fullNaive, cwd, msys)]) {
      const r = confineSegment(t, dir, unres, roots, msys);
      if (r === 'deny') return { decision: 'deny', reason: 'Chế độ full: lệnh ghi/xoá đường dẫn ngoài root của project. Thêm thư mục vào "fullRoots" trong .claude/aip-gate.json nếu thật sự cần.' };
      if (r === 'ask') unknownPath = true;
    }
    if (unknownPath) return ask(FULL_PATH_TEXT);
  }
  // Phiên không bypass trong project full: settings.json không còn quy tắc ask nào chắc chắn áp dụng nên hook hỏi thay.
  // Chỉ đọc cấu hình sau khi một đoạn khớp tiền tố, để lệnh thường không tốn lời gọi git.
  if (!bypass && [...segs, ...naiveAll].some(matchesAsk) && gate()?.mode === 'full') {
    return ask(FULL_NO_BYPASS_TEXT);
  }
  // Ở full, đường dẫn bí mật cũng được giải biến gán cùng lệnh như H6 (tính một lần, chỉ khi cần).
  const variableLists = () => { const r = substituteVars(cmd, input?.tool_name); return r === cmd ? [outer, naiveOuter] : [parse(r).segs, naiveSegments(r)]; };
  let scanned;
  const scans = () => (scanned ??= [secretScanText(cmd), secretScanText(raw)]);
  const hits = (re) => scans().some((text) => re.test(text));
  // Cấu hình chỉ đọc khi lệnh đã nhắc tới file bí mật: lệnh thường không tốn thêm lời gọi git.
  const secretName = (re) => { for (const text of scans()) { const m = re.exec(text); if (m) return m[2]; } return ''; };
  const secretAsk = (re) => ask(secretText(secretName(re)));
  if (hits(SECRET) && !full() && (hits(KEY_SECRET) || !allowEnv(cwd))) return secretAsk(hits(KEY_SECRET) ? KEY_SECRET : SECRET);
  // Ở full, bí mật chỉ mở trong root của project: đường dẫn bí mật nằm ngoài root hoặc không xác định được vẫn hỏi (khớp guard-files).
  if (hits(SECRET) && full()) {
    // Cùng mẫu với H3: allowEnvFiles bật thì .env không phải bí mật ở đây nên không được xét tới root.
    const secretRe = hits(KEY_SECRET) || !allowEnv(cwd) ? SECRET : KEY_SECRET;
    if (hits(secretRe) && secretOutsideRoots(variableLists(), cwd, rootsOf(), secretRe, msys)) return secretAsk(secretRe);
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
