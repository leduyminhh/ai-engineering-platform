#!/usr/bin/env node
// PreToolUse(Bash|PowerShell): biến các ranh giới "không push nhánh bảo vệ / commit -F / không đụng file bí mật" thành cổng cứng.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { envFilesAllowed, readGate, fullEffective, fullKeep, classifyPath, grantsOf, normalizeMsysPath, hasUnresolvedRef, showArg, isClaudeTmpRoot, denyOutsideText, CLAUDE_TMP_BLOCKED_TEXT } from './gate-config.mjs';

const PROTECTED = new Set(['main', 'master', 'dev', 'develop']);
// Biên gồm cả > : ` @ { , (vd x>.env, HEAD:.env, @.env, {a,.env}) vì tên file dính các ký tự này vẫn được lệnh đọc/ghi.
const SECRET = /(^|[\s'"=/\\<>(:`@{,])(\.env(rc)?(\.(?!(example|sample|template)\b)[\w.-]+)?|(?!process\.env(?![\w.-]))[\w.-]+\.env|[\w.-]+\.(pem|jks|keystore|p12|pfx|key|ppk|p8)|id_(rsa|dsa|ecdsa|ed25519)(_sk)?(\.(?!pub\b)[\w.-]+)?|credentials(\.(json|ya?ml))?)(?=$|[\s'";&|)<>`,}:])/i;
// SECRET bỏ nhánh .env: project bật "allowEnvFiles" thì chỉ khoá/credentials còn bị hỏi.
const KEY_SECRET = /(^|[\s'"=/\\<>(:`@{,])([\w.-]+\.(pem|jks|keystore|p12|pfx|key|ppk|p8)|id_(rsa|dsa|ecdsa|ed25519)(_sk)?(\.(?!pub\b)[\w.-]+)?|credentials(\.(json|ya?ml))?)(?=$|[\s'";&|)<>`,}:])/i;
const GIT_OPTS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env']);
const PUSH_OPTS_WITH_VALUE = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);

// Tách lệnh thành các đoạn token, tôn trọng nháy: toán tử/xuống dòng nằm trong nháy (vd heredoc trong -m "$(…)") không cắt đoạn.
export function parse(cmd) {
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

const SH_OPEN = new Set(['if', 'for', 'while', 'until', 'case', '{']);
const SH_CLOSE = new Set(['fi', 'done', 'esac', '}']);
const SH_KW = new Set([...SH_OPEN, ...SH_CLOSE, 'then', 'else', 'elif', 'do', 'function']);

// Với `$(`/backtick: trả chỉ số ngay sau phần đóng; chưa đóng thì tới hết chuỗi.
function skipSubst(cmd, i, ps) {
  if (cmd[i] === '`') {
    // \` bên trong backtick là backtick lồng, không phải dấu đóng.
    for (let k = i + 1; k < cmd.length; k++) {
      if (cmd[k] === '\\') { k++; continue; }
      if (cmd[k] === '`') return { end: k + 1, closed: true };
    }
    return { end: cmd.length, closed: false };
  }
  let depth = 0;
  for (let k = i; k < cmd.length; k++) {
    const c = cmd[k];
    if (c === (ps ? '`' : '\\')) { k++; continue; }
    if (c === "'" || c === '"') { const e = cmd.indexOf(c, k + 1); if (e < 0) return { end: cmd.length, closed: false }; k = e; continue; }
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return { end: k + 1, closed: true };
  }
  return { end: cmd.length, closed: false };
}

const RW_VAR = /\$(?:([A-Za-z_]\w*)|\{([A-Za-z_]\w*)\})/y;
const RW_CYGPATH = /\$\(\s*cygpath((?:\s+-[umwal]+)*)\s+(?:'([^']*)'|"([^"$`\\]*)")\s*\)/y;
const RW_ABS = /^(?:[\\/]|[A-Za-z]:[\\/])/;

// Giải một từ của scanWords thành { text, glob } hoặc null khi chưa rõ. Glob chỉ tính ở phần không nháy hoặc giá trị biến mở rộng không nháy, vì shell không bung glob trong nháy.
// state: { env: Map<tên, giá trị|null>, dir, unres, msys }.
export function resolveWord(word, state, dialect = 'bash') {
  let text = '';
  let glob = false;
  for (const [pi, { text: s, quote }] of word.parts.entries()) {
    if (quote === 'single') { text += s; continue; }
    const bare = quote === 'none';
    if (pi === 0 && bare && s.startsWith('~')) return null;
    const put = (v, expanded) => {
      if (expanded && bare && /\s/.test(v)) return false;
      if (bare && GLOB.test(v)) glob = true;
      text += v;
      return true;
    };
    for (let i = 0; i < s.length;) {
      if (s[i] !== '$' && s[i] !== '`') {
        let j = i;
        while (j < s.length && s[j] !== '$' && s[j] !== '`') j++;
        put(s.slice(i, j), false);
        i = j;
        continue;
      }
      if (s[i] === '`') return null;
      RW_VAR.lastIndex = i;
      const m = RW_VAR.exec(s);
      if (dialect !== 'bash') {
        // PowerShell: `$NAME`/`${NAME}`/`$PWD` không phân biệt hoa thường; `$NAME:x` là biến có phạm vi, `$(`, `$env:`, `${…}` lạ là chưa rõ; ngoài nháy chỉ nhận khi cả từ là biến đó.
        if (!m || s[i + m[0].length] === ':' || (bare && !(word.parts.length === 1 && s === m[0]))) return null;
        const key = (m[1] ?? m[2]).toLowerCase();
        const v = key === 'pwd' ? (state.unres ? null : state.dir) : state.env.get(key);
        if (typeof v !== 'string' || !RW_ABS.test(v) || !put(v, true)) return null;
        i += m[0].length;
        continue;
      }
      if (m) {
        const name = m[1] ?? m[2];
        const v = name === 'HOME' ? null : name === 'PWD' ? (state.unres ? null : state.dir) : state.env.get(name);
        if (typeof v !== 'string' || !RW_ABS.test(v) || !put(v, true)) return null;
        i += m[0].length;
        continue;
      }
      RW_CYGPATH.lastIndex = i;
      const cy = RW_CYGPATH.exec(s);
      if (!cy) return null;
      const lit = cy[2] ?? cy[3];
      if (!put(state.msys ? normalizeMsysPath(lit) : lit, true)) return null;
      i += cy[0].length;
    }
  }
  return { text, glob };
}

// Tách lệnh thành đoạn → từ → phần, mỗi phần giữ loại nháy; $( … ) và backtick là chữ thô của từ hiện tại.
export function scanWords(cmd, dialect = 'bash') {
  const ps = dialect === 'powershell';
  const segs = [];
  let words = [];
  let parts = null;
  let pending = null;
  let kwDepth = 0;
  let kwMark = false;
  let paren = 0;
  let q = null;
  let substOpen = false;
  let braceVar = 0;
  let callNext = false;
  const add = (text, quote) => {
    parts ??= [];
    const last = parts[parts.length - 1];
    if (last && last.quote === quote && quote === 'none') last.text += text;
    else if (last && last.quote === quote && q) last.text += text;
    else parts.push({ text, quote });
  };
  const endWord = () => {
    if (!parts) return;
    if (!ps && !words.length && parts.length === 1 && parts[0].quote === 'none') {
      const t = parts[0].text;
      if (SH_KW.has(t)) { kwMark = true; if (SH_OPEN.has(t)) kwDepth++; else if (SH_CLOSE.has(t)) kwDepth = Math.max(0, kwDepth - 1); }
    }
    // PowerShell không có từ khoá shell: chỉ `{`/`}` đánh dấu cấu trúc phức (khối lệnh, hashtable).
    if (ps && parts.length === 1 && parts[0].quote === 'none' && (parts[0].text === '{' || parts[0].text === '}')) {
      kwMark = true;
      if (parts[0].text === '{') kwDepth++; else kwDepth = Math.max(0, kwDepth - 1);
    }
    words.push({ parts });
    parts = null;
    braceVar = 0;
  };
  const endSeg = () => {
    endWord();
    if (words.length) {
      const sep = pending ?? (segs.length ? ';' : 'start');
      segs.push({ words, sep, pipeIn: sep === '|', pipeOut: false, background: false, compound: paren > 0 || kwDepth > 0 || kwMark, call: callNext });
      callNext = false;
      if (sep === '|' && segs.length > 1) segs[segs.length - 2].pipeOut = true;
      pending = null;
    }
    words = [];
    kwMark = false;
  };
  const setSep = (o) => { if (pending !== '||' && pending !== '|') pending = o; };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) {
      if (c === q) {
        if (ps && cmd[i + 1] === q) { add(q, q === "'" ? 'single' : 'double'); i++; } else q = null;
        continue;
      }
      const quote = q === "'" ? 'single' : 'double';
      if (q === '"' && ((ps && c === '`') || (!ps && c === '\\' && '"\\$`'.includes(cmd[i + 1] ?? '')))) { if (i + 1 < cmd.length) { (parts ??= []).push({ text: cmd[i + 1], quote: 'single' }); i++; } continue; }
      if (q === '"' && ((c === '$' && cmd[i + 1] === '(') || (c === '`' && !ps))) { const { end: e, closed } = skipSubst(cmd, i + (c === '$' ? 1 : 0), ps); if (!closed) substOpen = true; add(cmd.slice(i, e), quote); i = e - 1; continue; }
      add(c, quote);
      continue;
    }
    if (c === '"' || c === "'") { q = c; parts ??= []; parts.push({ text: '', quote: c === "'" ? 'single' : 'double' }); continue; }
    if ((ps && c === '`') || (!ps && c === '\\')) {
      if (cmd[i + 1] === '\n') { i++; continue; }
      if (i + 1 < cmd.length) { (parts ??= []).push({ text: cmd[i + 1], quote: 'single' }); i++; }
      continue;
    }
    if ((c === '$' && cmd[i + 1] === '(') || (c === '`' && !ps)) { const { end: e, closed } = skipSubst(cmd, i + (c === '$' ? 1 : 0), ps); if (!closed) substOpen = true; add(cmd.slice(i, e), 'none'); i = e - 1; continue; }
    if (c === '#' && !parts) { while (i + 1 < cmd.length && cmd[i + 1] !== '\n') i++; continue; }
    if (c === '\n') { endSeg(); if (pending !== '&&') setSep(';'); continue; }
    // Chỉ space, tab, CR là khoảng trắng của bash; BOM/NBSP/VT dính vào từ nên `<BOM>S=v` là tên lệnh lạ, không phải phép gán.
    if (c === ' ' || c === '\t' || c === '\r') { endWord(); continue; }
    if (c === '(') { endSeg(); paren++; continue; }
    if (c === ')') { endSeg(); paren = Math.max(0, paren - 1); continue; }
    if (c === ';') { endSeg(); setSep(';'); continue; }
    if (c === '|') { endSeg(); if (cmd[i + 1] === '|') { i++; setSep('||'); } else setSep('|'); continue; }
    if (c === '&') {
      if (cmd[i - 1] === '>' || cmd[i - 1] === '<' || (!ps && cmd[i + 1] === '>')) { add(c, 'none'); continue; }
      if (cmd[i + 1] === '&') { endSeg(); i++; setSep('&&'); continue; }
      endSeg();
      // `&` đưa cả danh sách and-or phía trước vào nền, không chỉ đoạn cuối.
      for (let j = segs.length - 1; j >= 0; j--) { segs[j].background = true; if (['start', ';', '&'].includes(segs[j].sep)) break; }
      setSep('&');
      // PowerShell: `&` là toán tử gọi hoặc dấu tách; lệnh phía sau đứng đầu đoạn riêng nhưng đoạn đó là phức (tắt giải biến cả lệnh).
      if (ps) { kwMark = true; callNext = true; }
      continue;
    }
    // PowerShell: `{` đầu từ và `}` không đóng `{` của chính từ đó (`${tên}`, `@{…}`, `a{b}`) là mở/đóng khối và bắt đầu đoạn mới,
    // để lệnh trong khối đứng đầu đoạn như `if (…) { rm … }` (sau `& {`, `ForEach-Object {` nó từng bị coi là đối số).
    if (ps && (c === '{' || c === '}')) {
      if (c === '{' ? parts !== null : braceVar > 0) { braceVar += c === '{' ? 1 : -1; add(c, 'none'); continue; }
      endSeg();
      add(c, 'none');
      endWord();
      continue;
    }
    add(c, 'none');
  }
  endSeg();
  return { segs, unclosed: q !== null || substOpen };
}

// Một từ là chuỗi liên tiếp phần nháy đơn/kép/không nháy, không có khoảng trắng ngoài nháy; nháy không đóng là ký tự thường.
// subst: coi `$( … )` là một phần của từ (chỉ cho walkSegments; các kiểm khác giữ cách tách cũ).
function naiveWords(x, subst = false) {
  const out = [];
  let i = 0;
  while (i < x.length) {
    while (i < x.length && /\s/.test(x[i])) i++;
    if (i >= x.length) break;
    const start = i;
    const parts = [];
    let cur = '';
    const flush = () => { if (cur) parts.push({ text: cur, quote: 'none' }); cur = ''; };
    while (i < x.length && !/\s/.test(x[i])) {
      const c = x[i];
      if (subst && c === '$' && x[i + 1] === '(') { const { end: e } = skipSubst(x, i + 1, false); cur += x.slice(i, e); i = e; continue; }
      const end = c === '"' || c === "'" ? x.indexOf(c, i + 1) : -1;
      if (end < 0) { cur += c; i++; continue; }
      flush();
      parts.push({ text: x.slice(i + 1, end), quote: c === '"' ? 'double' : 'single' });
      i = end + 1;
    }
    flush();
    out.push({ parts, raw: x.slice(start, i) });
  }
  return out;
}

// Cách tách thô (không hiểu nháy) của bản cũ: chạy song song với parse() vì nháy lẻ (heredoc, #, \') làm parse() nuốt các lệnh phía sau.
function naiveSegments(cmd) {
  const out = [];
  let op = '';
  cmd.split(/(&&|\|\||;|\n|\|)/).forEach((x, k) => {
    if (k % 2) { if (op !== '||' && op !== '|') op = x; return; }
    const words = naiveWords(x);
    const t = words.map((w) => w.parts.map((q) => q.text).join(''));
    t.qpos = words.map((w) => { const p = w.raw.search(/["']/); return p < 0 ? Infinity : p; });
    t.src = x;
    // Cờ glob theo từ; từ có biến/backtick để undefined để classifyPlain rơi về GLOB.test như trước.
    t.globs = words.map((w) => (/[$`]/.test(w.raw) ? undefined : w.parts.some((q) => q.quote === 'none' && GLOB.test(q.text))));
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
const WRITE_CMDS = new Set(['rm', 'rmdir', 'del', 'erase', 'rd', 'remove-item', 'ri', 'mv', 'move', 'move-item', 'mi', 'cp', 'copy', 'copy-item', 'cpi', 'touch', 'mkdir', 'chmod', 'chown', 'tee', 'truncate', 'set-content', 'out-file', 'add-content']);
const LAST_ONLY = new Set(['cp', 'copy', 'copy-item', 'cpi']);
const DELETE_CMDS = new Set(['rm', 'rmdir', 'del', 'erase', 'rd', 'remove-item', 'ri']);
const MOVE_CMDS = new Set(['mv', 'move', 'move-item', 'mi']);
// Một đối số mv: không biết là nguồn hay đích nên cần cả hai quyền.
const needsOf = (name) => (DELETE_CMDS.has(name) ? ['delete'] : MOVE_CMDS.has(name) ? ['delete', 'write'] : ['write']);
// Vai của cờ đường dẫn PowerShell theo (lệnh, cờ): đích → write, nguồn của Move/Remove-Item → delete, nguồn của Copy-Item → read.
const flagNeeds = (name, flag) => {
  const f = flag.toLowerCase().replace(/^-/, '');
  return f === 'destination' || f === 'filepath' ? ['write'] : DELETE_CMDS.has(name) || MOVE_CMDS.has(name) ? ['delete'] : LAST_ONLY.has(name) ? ['read'] : ['write'];
};
const FIRST_ONLY = new Set(['set-content', 'out-file', 'add-content']);
const SKIP_FIRST = new Set(['chmod', 'chown']);
const CMD_SWITCH = new Set(['del', 'erase', 'rd', 'copy', 'move']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ash', 'ksh', 'fish', 'csh', 'tcsh', 'cmd', 'pwsh', 'powershell']);
const PS_PATH_FLAGS = new Set(['-path', '-literalpath', '-filepath', '-destination']);
// Switch của Copy-Item/Move-Item (không nhận giá trị): đã biết nên không làm đối số vị trí bị lẫn vai. Viết tắt (`-Rec`) vẫn là cờ lạ → thận trọng.
const PS_COPY_SWITCH = /^-(recurse|force|container|passthru|whatif|confirm|usetransaction|verbose|debug)(:.*)?$/i;
// Cờ lạ không cho biết đối số nào là nguồn, đích: mọi đối số vị trí cần cả hai vai.
const blurredNeeds = (name) => (LAST_ONLY.has(name) ? ['read', 'write'] : ['delete', 'write']);
// Tham số của Copy-Item/Move-Item nhận một giá trị: bỏ giá trị đi, nếu không nó bị tính là đối số vị trí và làm lệch slot Path/Destination.
const PS_VALUE_FLAGS = /^-(filter|include|exclude|credential|tosession|fromsession|(error|warning|information)(action|variable)|outvariable|outbuffer|pipelinevariable)(:.*)?$/i;
// Set-Content/Out-File/Add-Content: giá trị của tham số có giá trị đứng trơn (`-Encoding utf8`, `-Value y`) là nội dung, không phải đường dẫn.
// Tên ngoài hai tập (viết tắt `-Enc`, tham số lạ) không biết có nhận giá trị hay không nên psWriteCandidates coi mọi token của nó là ứng viên.
const PS_WRITE_VALUE = new Set(['value', 'encoding', 'stream', 'width', 'inputobject', 'filter', 'include', 'exclude', 'credential', 'erroraction', 'ea', 'warningaction', 'wa',
  'informationaction', 'infa', 'errorvariable', 'ev', 'warningvariable', 'wv', 'informationvariable', 'iv', 'outvariable', 'ov', 'outbuffer', 'ob', 'pipelinevariable', 'pv']);
const PS_WRITE_SWITCH = new Set(['force', 'nonewline', 'append', 'noclobber', 'passthru', 'asbytestream', 'whatif', 'confirm', 'cf', 'usetransaction', 'verbose', 'vb', 'debug', 'db']);
const PS_WRITE_PATH_FLAG = new Set(['path', 'literalpath', 'filepath', 'pspath']);
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

// Đoạn glob có khớp được `..` không (bash < 5.2 và dash mở rộng `.?`, `.*`, `.[.]` ra thư mục cha). Không dịch được thì coi là khớp: hỏi thừa còn hơn bỏ sót.
function globMatchesDotDot(seg) {
  // Dấu chấm đầu tên chỉ khớp với `.` viết tường minh ở đầu mẫu: `*`, `?`, `[…]` đứng đầu không bao giờ khớp `..`.
  if (seg[0] !== '.') return false;
  // Dãy `*` liền nhau dịch thành `.*.*…` và backtrack bậc hai khi đuôi không khớp.
  const s = seg.replace(/\*+/g, '*');
  if (s.length > 1024) return true;
  let re = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else if (c === '[') {
      const neg = s[i + 1] === '!' || s[i + 1] === '^';
      // Ký tự đầu tiên sau `[` (và sau `!`) là ký tự thường kể cả `]`.
      const end = s.indexOf(']', i + (neg ? 3 : 2));
      if (end < 0) return true;
      const body = s.slice(i + (neg ? 2 : 1), end);
      // Lớp POSIX (`[:punct:]`, `[=.=]`) khớp `..` trên dash mà không dịch đơn giản được: coi là khớp.
      if (/\[[:=.]/.test(body)) return true;
      re += `[${neg ? '^' : ''}${body.replace(/[\\\]\[^]/g, '\\$&')}]`;
      i = end;
    } else re += c.replace(/[.+^${}()|\\\]]/g, '\\$&');
  }
  try { return new RegExp(`^${re}$`).test('..'); } catch { return true; }
}

// `dst.push(...src)` tràn stack khoảng 100 nghìn phần tử (giới hạn số đối số của V8): lệnh dài làm decide ném lỗi và hook cho qua.
function pushAll(dst, src) {
  for (const x of src) dst.push(x);
  return dst.length;
}

// Trả mọi nhánh của nhóm `{a,b}` có dấu phẩy (lồng được), hoặc null khi quá `cap`; `{1..3}` và `{x}` giữ nguyên. Không bóc nháy: hook không biết nháy bash có chặn mở rộng hay không, nên `"T/{..,x}/f"` cũng bị mở.
// Quá 64 dấu `{` hoặc 4096 ký tự thì bỏ cuộc (null): 9 nhóm đã vượt trần, còn đệ quy theo số nhóm làm tràn stack. Quét một lượt bằng ngăn xếp nên chi phí không nhân với số `{` không đóng.
function braceExpand(p, cap) {
  if (p.length > 4096 || p.split('{').length > 65) return null;
  const open = [];
  let best = null;
  for (let j = 0; j < p.length; j++) {
    if (p[j] === '{') open.push({ at: j, commas: [] });
    else if (p[j] === ',' && open.length) open[open.length - 1].commas.push(j);
    else if (p[j] === '}' && open.length) {
      const g = open.pop();
      if (g.commas.length && (!best || g.at < best.at)) best = { ...g, end: j };
    }
  }
  if (!best) return [p];
  const cuts = [best.at, ...best.commas, best.end];
  const out = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const sub = braceExpand(p.slice(0, best.at) + p.slice(cuts[k] + 1, cuts[k + 1]) + p.slice(best.end + 1), cap);
    if (!sub || pushAll(out, sub) > cap) return null;
  }
  return out;
}

// Ngân sách brace của MỘT lệnh (decide đặt lại), tính bằng số nhánh × (độ dài + 256) mỗi lần phân loại: hết thì `unknown`. Phân loại một nhánh tốn ~5 µs dù ngắn hay dài, nên hằng 256 chặn tổng số nhánh (~56 nghìn nhánh ≈ 0,3 s với token ngắn).
const BRACE_BUDGET = 1 << 24;
let braceLeft = BRACE_BUDGET;
const braceCache = new Map();

// Một đường dẫn được phân loại 3–6 lần (read/write/delete, H6, bí mật): nhớ kết quả mở rộng theo chuỗi, nhưng mỗi lần phân loại vẫn trừ ngân sách.
function expandBraces(p) {
  if (braceLeft < 0) return null;
  let r = braceCache.get(p);
  if (r === undefined) {
    // Lỗi bất ngờ không được ném ra: main nuốt lỗi và fail-open sẽ cho cả lệnh qua.
    try { r = braceExpand(p, 256); } catch { r = null; }
    braceCache.set(p, r);
  }
  braceLeft -= (r ? r.length : 256) * (p.length + 256);
  return braceLeft < 0 ? null : r;
}

function classifyTarget(raw, dir, unres, roots, msys = true, need = 'write', glob) {
  const p = np(raw, msys);
  if (!msys || !p.includes('{')) return classifyPlain(p, dir, unres, roots, msys, need, glob);
  const branches = expandBraces(p);
  if (!branches) return 'unknown';
  // Nhánh do braceExpand sinh không còn nhóm có dấu phẩy: phân loại thẳng, không mở rộng lại.
  const all = branches.map((b) => classifyPlain(b, dir, unres, roots, msys, need, glob));
  return ['blocked', 'outside', 'unknown'].find((k) => all.includes(k)) ?? all[0];
}

// glob (boolean) chỉ được bớt glob của chuỗi có ký tự đặc biệt nằm trong nháy; không có cờ thì giữ GLOB.test.
function classifyPlain(raw, dir, unres, roots, msys = true, need = 'write', glob) {
  const p = np(raw, msys);
  if (NULL_DEVICE.test(p)) return null;
  const isGlob = glob === undefined ? GLOB.test(p) : glob && GLOB.test(p);
  if (!hasUnresolvedRef(p) && !isGlob && isClaudeTmpRoot(p, dir)) return 'blocked';
  const absolute = path.isAbsolute(p) || /^[A-Za-z]:[\\/]/.test(p) || p.startsWith('\\\\');
  if (!absolute && (unres || hasUnresolvedRef(p))) return 'unknown';
  if (isGlob) {
    const parts = p.split(/[\\/]/);
    const first = parts.findIndex((x) => x !== '');
    const g = parts.findIndex((x) => GLOB.test(x));
    if (g <= first) return 'unknown';
    if (isClaudeTmpRoot(parts.slice(0, g).join('/'), dir)) return 'blocked';
    const c = classifyPath(`${parts.slice(0, g).join('/')}/`, dir, roots, msys, need);
    // `..` sau đoạn glob, chính đoạn glob khớp được `..`, hay biến ($X) trong đó có thể kéo đường dẫn ra khỏi thư mục đã phân loại, mà glob thì không resolve được: hỏi.
    // Thư mục trước đoạn glob đã thiếu quyền thì vẫn từ chối như trước, không hạ xuống hỏi.
    return c !== 'outside' && parts.slice(g).some((x) => globMatchesDotDot(x) || hasUnresolvedRef(x)) ? 'unknown' : c;
  }
  return classifyPath(p, dir, roots, msys, need);
}

// Ứng viên đích ghi của Set-Content/Out-File/Add-Content. Windows PowerShell 5.1 đảo vai đối số vị trí khi có tham số động (`-NoNewline`, `-Encoding:x`)
// và hook không thấy nháy, nên mọi token là ứng viên trừ tên cờ đã biết; chỉ giá trị của cờ có giá trị đứng trơn (`-Value x`) là nội dung và bị bỏ.
function psWriteCandidates(args) {
  const out = [];
  const flagOf = (a) => /^-([A-Za-z][A-Za-z0-9]*)(:([\s\S]*))?$/.exec(a);
  // Dấu phẩy, backtick hoặc `--` làm ranh giới token mơ hồ (sau `--` PowerShell có thể đọc `-X:giá-trị` thành đường dẫn): kiểm hết, không nuốt giá trị của cờ nào.
  // Cờ có giá trị (đã biết, hoặc bất kỳ cờ dạng `-X:` vì có thể là viết tắt như `-Val:`) bỏ trống mà token kế bắt đầu bằng `-`:
  // PowerShell 5.1 lấy chính token đó làm giá trị, hook không phân biệt được với một cờ thật.
  const strict = args.some((a, i) => {
    const m = flagOf(a);
    return /^,|,$|`|^--$/.test(a) || (m && !m[3] && (m[2] !== undefined || PS_WRITE_VALUE.has(m[1].toLowerCase())) && args[i + 1]?.startsWith('-'));
  });
  // Token kế của cờ đường dẫn là ứng viên kể cả khi bắt đầu bằng `-`, trừ dạng dính `-X:val` (có thể là cờ thật đứng sau một cờ giả trong nháy).
  const takeNext = (i) => (i + 1 < args.length && !/^-[A-Za-z][A-Za-z0-9]*:/.test(args[i + 1]) ? (out.push(args[i + 1]), i + 1) : i);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') continue;
    const m = flagOf(a);
    if (!m) { out.push(a); continue; }
    const f = m[1].toLowerCase();
    const known = PS_WRITE_VALUE.has(f) || PS_WRITE_SWITCH.has(f);
    const swallow = () => { if (i + 1 < args.length && !args[i + 1].startsWith('-')) i++; };
    if (m[2] !== undefined) {
      if (m[3]) { if (!known || strict) out.push(m[3]); } else if (!strict) { if (known) swallow(); else i = takeNext(i); }
    } else if (strict) {
      if (!known && !PS_WRITE_PATH_FLAG.has(f)) out.push(a);
    } else if (PS_WRITE_SWITCH.has(f)) continue;
    else if (PS_WRITE_VALUE.has(f)) swallow();
    else if (PS_WRITE_PATH_FLAG.has(f)) i = takeNext(i);
    else out.push(a);
  }
  return out;
}

// Đích ghi của một đoạn lệnh (chuyển hướng, đối số của WRITE_CMDS, cờ đường dẫn PowerShell) kèm tên lệnh và đối số sau khi bỏ tiền tố bọc.
function writeTargets(t, msys = true) {
  const rest = [];
  const targets = [];
  const needs = [];
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
      // naiveSegments không bóc nháy trong token dính `>"…"`; để nguyên thì đường dẫn tuyệt đối thành tương đối theo cwd.
      const target = (tok.slice(after, nx < 0 ? undefined : nx) || (nx < 0 && i + 1 < t.length ? t[++i] : '')).replace(/^(["'])([\s\S]*)\1$/, '$2');
      if (target && !target.startsWith('&')) { targets.push(target); needs.push(['write']); }
      at = nx;
    }
  }
  const [tk, k] = unwrap(rest);
  const name = k < tk.length ? cmdName(tk[k]) : '';
  const args = tk.slice(k + 1);
  let allPos = [];
  if (WRITE_CMDS.has(name)) {
    const nd = needsOf(name);
    // Chỉ Bash: PowerShell nhận tiền tố tham số nên `-t` ở đó là `-ToSession` của Copy-Item, không phải GNU `-t DIR`.
    const gnu = msys && (name === 'mv' || name === 'cp');
    let toDir = false;
    // Cờ bó/viết tắt không phân biệt được nguồn với đích: mọi đối số vị trí phải đủ quyền của cả hai vai (mv/Move-Item: delete và write; cp/Copy-Item: read và write).
    let blurred = false;
    // Tham số PowerShell đã gọi tên (-Path/-LiteralPath/-Destination) chiếm slot của nó: đối số vị trí chỉ lấp slot còn trống.
    let namedPath = false;
    let namedDest = false;
    const named = (flag) => { if (/^-?destination$/i.test(flag)) namedDest = true; else namedPath = true; };
    let pos = [];
    let eoo = false;
    // Set-Content/Out-File/Add-Content có hàm riêng (psWriteCandidates), vòng này không chạy cho chúng.
    for (let i = 0; i < (FIRST_ONLY.has(name) ? 0 : args.length); i++) {
      const a = args[i];
      // Sau `--` của cp/mv Bash mọi token là tên file: `-S`/`-t` ở đó không được nuốt token kế (đích thật).
      if (gnu && eoo) { pos.push(a); continue; }
      if (gnu && a === '--') { eoo = true; continue; }
      if (PS_PATH_FLAGS.has(a.toLowerCase())) { named(a); if (i + 1 < args.length) { targets.push(args[++i]); needs.push(flagNeeds(name, a)); } continue; }
      const colon = /^-(path|literalpath|filepath|destination):(.+)$/i.exec(a);
      if (colon) { named(colon[1]); targets.push(colon[2]); needs.push(flagNeeds(name, colon[1])); continue; }
      const pv = !msys && (LAST_ONLY.has(name) || MOVE_CMDS.has(name)) ? PS_VALUE_FLAGS.exec(a) : null;
      if (pv) { if (!pv[4]) i++; continue; }
      // PowerShell chấp nhận viết tắt tham số (`-Dest`, `-Pa`) nên cờ lạ có thể đã gắn đối số vị trí vào -Path của nguồn.
      if (!msys && (MOVE_CMDS.has(name) || LAST_ONLY.has(name)) && /^-[A-Za-z]/.test(a)) {
        if (PS_COPY_SWITCH.test(a)) continue;
        blurred = true;
        const val = /^-[A-Za-z]+:(.+)$/.exec(a);
        if (val) { targets.push(val[1]); needs.push(blurredNeeds(name)); }
        continue;
      }
      // Chỉ `-t DIR` (tách rời) và `--target-directory[=]DIR` đổi vai đối số vị trí; `-tDIR`, cờ gộp (`-rt`) hay cờ PowerShell (`-toSession`, `-Filter`)
      // không phân biệt được nên vừa thêm một đích write phỏng đoán vừa giữ kiểm đích vị trí mặc định, không để cờ nào làm mất đích thật.
      const exact = gnu && (a === '-t' || a === '--target-directory' ? args[++i] : /^--target-directory=(.+)$/.exec(a)?.[1]);
      if (exact) { toDir = true; targets.push(exact); needs.push(['write']); continue; }
      const bundle = gnu ? /^-[A-Za-z]*?t([\s\S]*)$/.exec(a) : null;
      if (bundle) {
        if (name === 'mv') blurred = true;
        const d = bundle[1] || args[++i];
        if (d) { targets.push(d); needs.push(['write']); }
        continue;
      }
      // Giá trị của `-S`/`--suffix` là hậu tố, không phải đường dẫn: giữ lại thì nó chiếm vai đích của cp/mv.
      if (gnu && (/^--su(f(f(i(x)?)?)?)?$/.test(a) || /^-[A-Za-z]*S$/.test(a))) { i++; continue; }
      // chmod/chown: `-x`/`-w` là mode, chỉ `-R`/`--long`… mới là cờ.
      if (a.startsWith('-') && !(SKIP_FIRST.has(name) && /^-[A-Za-z]/.test(a) && !/^-[RfvchHLP]+$/.test(a))) continue;
      if (CMD_SWITCH.has(name) && /^\/[A-Za-z]$/.test(a)) continue;
      if (name === 'rmdir' && /^\/[sq]$/i.test(a)) continue;
      pos.push(a);
    }
    if (SKIP_FIRST.has(name)) pos = pos.slice(1);
    const all = pos;
    const copyLike = LAST_ONLY.has(name);
    // Set-Content/Out-File/Add-Content: mọi ứng viên là đích ghi (không biết token nào PowerShell gắn vào Path). allPos giữ mọi đối số cho kiểm cấu hình hook.
    allPos = copyLike ? all.slice(-1) : all;
    if (FIRST_ONLY.has(name)) allPos = pos = psWriteCandidates(args);
    // PowerShell lấp đối số vị trí theo thứ tự Path rồi Destination; đối số thừa (cờ có giá trị như -Filter làm lệch) lấy cả hai vai để không bỏ sót.
    const slots = !msys && !blurred && (copyLike || MOVE_CMDS.has(name))
      ? [...(namedPath ? [] : [copyLike ? ['read'] : ['delete']]), ...(namedDest ? [] : [['write']])] : null;
    if (gnu && toDir) {
      // Có -t DIR: đối số vị trí là nguồn: mv bị xoá, cp được đọc.
      pushAll(targets, all);
      pushAll(needs, all.map(() => (name === 'mv' ? ['delete'] : ['read'])));
    } else if (copyLike && msys) {
      // Cờ gộp có `t` (-rt, -tDIR) không đặt toDir nên rơi vào đây: giữ cách thận trọng, đối số cuối vẫn là đích ghi, mọi đối số trước là nguồn đọc.
      pushAll(targets, all);
      pushAll(needs, all.map((_, i) => (i === all.length - 1 ? ['write'] : ['read'])));
    } else if (slots) {
      const extra = copyLike ? ['read', 'write'] : ['delete', 'write'];
      const lone = !namedPath && !namedDest && all.length === 1;
      pushAll(targets, all);
      pushAll(needs, all.map((_, i) => (lone ? extra : (slots[i] ?? extra))));
    } else {
      pushAll(targets, pos);
      pushAll(needs, pos.map((_, i) => (blurred ? blurredNeeds(name) : MOVE_CMDS.has(name) && pos.length > 1 ? [i === pos.length - 1 ? 'write' : 'delete'] : nd)));
    }
  }
  // PowerShell nhận mảng `a,b` trong một token: tách thành từng đích để phần tử ngoài root không lọt. Chỉ PowerShell: ở Bash dấu phẩy là ký tự của tên file.
  if (!msys) {
    // Giữ cả token gốc: chuỗi trong nháy có dấu phẩy là một đường dẫn literal, và từng phần tách riêng có thể resolve khác khi chứa `..`.
    const split = targets.flatMap((p, i) => {
      const pieces = String(p).split(',').filter(Boolean);
      return (pieces.length > 1 || pieces[0] !== p ? [p, ...pieces] : [p]).map((x) => [x, needs[i]]);
    });
    return { targets: split.map(([x]) => x), needs: split.map(([, n]) => n), name, args, allPos };
  }
  return { targets, needs, name, args, allPos };
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

// Trả { deny: <quyền thiếu> } | 'ask' | null cho một đoạn lệnh; nơi gọi cho deny của bất kỳ đoạn nào thắng ask của đoạn khác.
function confineSegment(t, dir, unres, roots, msys = true) {
  const { targets, needs, name, args } = writeTargets(t, msys);
  // Cùng chuỗi xuất hiện hai lần với cờ khác nhau thì lấy glob (thận trọng).
  const globOf = new Map();
  t.forEach((x, i) => { if (t.globs?.[i] !== undefined) globOf.set(x, globOf.get(x) || t.globs[i]); });
  const inner = name === 'eval' || SHELLS.has(name) ? shellString(name, args) : null;
  const ask = Boolean(inner) && stringWrites(inner);
  let unknown = false;
  let readAsk = false;
  for (const [i, p] of targets.entries()) {
    for (const need of needs[i]) {
      const c = classifyTarget(p, dir, unres, roots, msys, need, globOf.get(p));
      // Thiếu read chỉ hỏi (như Read ở guard-files); gốc <tmpdir>/claude ('blocked') luôn deny dù cấu hình cấp gì.
      if (c === 'outside' && need === 'read') readAsk = true;
      else if (c === 'outside' || c === 'blocked') return { deny: need, blocked: c === 'blocked' };
      if (c === 'unknown') unknown = true;
    }
  }
  return unknown || ask ? 'ask' : readAsk ? 'ask-read' : null;
}

// Token (hoặc phần tách theo khoảng trắng trong chuỗi nháy) khớp mẫu bí mật → lấy phần sau `=`/`@`/`<`/`(` làm đường dẫn rồi phân loại theo cwd đã theo dõi.
// Không tách được token bí mật nào dù regex khớp cả lệnh thì coi là không chắc ⇒ hỏi.
function secretOutsideRoots(walked, roots, re, msys = true) {
  let found = false;
  for (const { t, dir, unres } of walked) {
    for (const tok of t.flatMap((x) => x.split(/\s+/))) {
      if (!re.test(tok)) continue;
      found = true;
      const p = tok.slice(Math.max(tok.lastIndexOf('='), tok.lastIndexOf('@'), tok.lastIndexOf('<'), tok.lastIndexOf('(')) + 1);
      // File bí mật chỉ được miễn hỏi khi đường dẫn có đủ ba quyền hiệu lực.
      if (['read', 'write', 'delete'].some((need) => ['outside', 'blocked', 'unknown'].includes(classifyTarget(p, dir, unres, roots, msys, need)))) return true;
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
// cp/mv vào thư mục .claude: tên file cấu hình nằm ở nguồn, không ở đích, nên phải ghép theo token.
const CLAUDE_DIR = /(?:^|[\\/])\.claude[\\/]*$/i;
const CONFIG_FILE_NAME = /^(?:settings(?:\.[\w-]+)?|aip-gate)\.json$/i;
const COPY_MOVE = new Set(['cp', 'copy', 'copy-item', 'cpi', 'mv', 'move', 'move-item', 'mi']);
// PowerShell gắn giá trị vào tham số (`-Path:x`) và nhận danh sách phân cách bằng dấu phẩy (`a,b`): tách trước khi lấy tên file.
const hasConfigName = (a) => a.replace(/^-\w+:/, '').split(',').some((x) => CONFIG_FILE_NAME.test(x.split(/[\\/]/).pop()));

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
  return found.some((str) => expandShells(parse(str).segs).some((t) => writesGuardConfig(t)));
}

function pipedIndirectConfigWrite(list) {
  return list.some((t) => indirectWrite(t)) && list.some((t) => t.some(isConfigPath));
}

function writesGuardConfig(t, msys = true) {
  const w = writeTargets(t, msys);
  const { name, args, allPos } = w;
  // Đích chỉ có vai read (nguồn của cp/Copy-Item) là file bị đọc, không phải file bị ghi.
  const targets = w.targets.filter((_, i) => w.needs[i].some((n) => n !== 'read'));
  if (targets.some((p) => GUARD_CONFIG.test(p)) || (FIRST_ONLY.has(name) && allPos.some((p) => GUARD_CONFIG.test(p)))) return true;
  // Chuẩn hoá trước khi so: `.claude/.` và `.claude/sub/..` cùng là thư mục .claude.
  if (COPY_MOVE.has(name) && targets.some((p) => CLAUDE_DIR.test(path.posix.normalize(String(p).replace(/\\/g, '/')))) && args.some(hasConfigName)) return true;
  // Lệnh không thuộc WRITE_CMDS (khối script PowerShell, xargs, find, parallel…): không đọc được đích ghi thì hỏi khi cùng đoạn có đường dẫn cấu hình và tín hiệu ghi.
  if (name !== 'sed' && name !== 'perl' && !WRITE_CMDS.has(name)) {
    const all = [name, ...args];
    // xargs/find/parallel đưa chuỗi `sh -c '… > cfg'` làm một đối số có khoảng trắng nên tên file nằm trong chuỗi vẫn tính.
    const indirect = INDIRECT.has(name);
    if (all.some((x) => (indirect ? GUARD_CONFIG.test(x) : isConfigPath(x))) && writeSignal(all, indirect)) return true;
  }
  return (name === 'sed' || name === 'perl') && args.some((a) => IN_PLACE_FLAG.test(a)) && args.some((a) => GUARD_CONFIG.test(a));
}

// Câu hỏi hiện trong popup cho người dùng: chỉ nói lệnh đang làm gì và đụng nhánh/đường dẫn nào; không lý do, không lời khuyên, không thuật ngữ nội bộ.
const PUSH_TEXT = {
  force: 'Force push hoặc xoá nhánh trên remote.',
  unknown: 'Push vào nhánh chưa rõ (tên nhánh hoặc thư mục là biến).',
};
const pushText = (r) => (r.kind === 'protected'
  ? `Đẩy code lên nhánh bảo vệ \`${r.branch}\`.`
  : PUSH_TEXT[r.kind]);
const CONFIG_TEXT = 'Ghi vào file cấu hình quyền (`.claude/aip-gate.json` hoặc `settings.json`).';
const FULL_PATH_TEXT = 'Ghi hoặc xoá ở đường dẫn chưa rõ (`$VAR`, `~`, `*`).';
const READ_OUTSIDE_TEXT = 'Đọc file ngoài các thư mục được cấp quyền đọc.';
const FULL_NO_BYPASS_TEXT = 'Lệnh đẩy code, gọi mạng hoặc deploy; project bật chế độ full nhưng phiên này vẫn hỏi. Đổi: `aip mode ask`.';
// Dòng liệt kê root chỉ là gợi ý cho agent: lỗi khi dựng nó không được làm mất deny, nên rơi về câu không có dòng root.
function denyText(need, grants, subject) {
  try { return denyOutsideText(need, grants, subject); } catch { return denyOutsideText(need, [], subject); }
}
const secretText = (name) => `Lệnh nhắc tới file bí mật \`${showArg(name)}\`.`;

// Dòng tóm tắt đọc từ chính parse của hook (nháy, bung bash -c/eval), không cắt heredoc bằng regex: liệt kê thừa còn hơn giấu lệnh, và chạy tuyến tính.
const MAX_STEPS = 3;
// Chỉ dùng thông tin có sẵn từ parse (tên lệnh, lệnh con git, đích chuyển hướng); không đoán số file vì git commit -m không nêu file nào.
// `max` chỉ để test đọc đủ bước; popup luôn dùng MAX_STEPS.
export function summarize(cmd, msys = true, max = MAX_STEPS) {
  const p = parse(stripSimpleHeredocs(cmd) ?? cmd);
  const steps = [];
  let total = 0;
  let nested = false;
  for (const t of expandShells(p.segs)) {
    const [tk, k] = unwrap(t);
    if (/\$\(|`|<\(/.test(t.join(' '))) nested = true;
    if (k >= tk.length || String(tk[k]).startsWith('#')) continue;
    total++;
    if (steps.length >= max) continue;
    const g = cmdName(tk[k]) === 'git' ? gitCmd(tk.slice(k)) : null;
    const w = writeTargets(t, msys);
    // Nêu đường dẫn gây ra câu hỏi: đường dẫn chưa biết (`$X`, `~`), rồi file cấu hình hook, rồi đích đầu tiên; nếu không, nguồn đọc đứng đầu của cp che mất đích ghi.
    const live = w.targets.map((x, j) => j).filter((j) => !NULL_DEVICE.test(w.targets[j]));
    const ti = live.find((j) => hasUnresolvedRef(w.targets[j])) ?? live.find((j) => GUARD_CONFIG.test(w.targets[j]) || CLAUDE_DIR.test(w.targets[j])) ?? live[0] ?? -1;
    const nd = w.needs[ti] ?? [];
    // Đích vừa đọc vừa ghi (cờ lạ của Copy-Item) nói là ghi: câu hỏi quyền xoay quanh việc ghi.
    const verb = nd.includes('delete') ? (nd.includes('write') ? 'xoá hoặc ghi' : 'xoá') : nd.includes('write') || !nd.includes('read') ? 'ghi vào' : 'đọc';
    steps.push(`${g ? `git ${showArg(g.sub, 40)}` : showArg(cmdName(tk[k]), 40)}${ti >= 0 ? ` (${verb} ${showArg(w.targets[ti], 40)})` : ''}`);
  }
  if (!total) return '';
  const more = total > max ? `, … và ${total - max} bước khác` : '';
  const open = (p.unclosed ? ' (nháy chưa đóng: danh sách có thể thiếu bước)' : '') + (nested ? ' (có lệnh lồng trong nháy: xem khối lệnh bên dưới)' : '');
  return `Lệnh gồm: ${steps.join(', ')}${more}.${open}`;
}

const NON_ASCII = /[^\x00-\x7F]/;
const DENY_COMMIT = { decision: 'deny', reason: 'Commit message có ký tự non-ASCII qua -m dễ hỏng encoding. Ghi message ra file UTF-8, kiểm bằng check-commit-message.mjs rồi chạy `git commit -F <file>` (skill git-workflow).' };

const UNPARSABLE_TEXT = 'Lệnh commit có dấu nháy chưa đóng, không đọc chắc được.';

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
function stripSimpleHeredocs(rest, mask = (l) => l) {
  const out = [];
  let end = null;
  for (const raw of rest.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (end !== null) { if (line.trim() === end) end = null; continue; }
    const view = mask(line);
    const { open, ops } = lineQuotes(view);
    if (open || ops.length > 1 || /\$['{[(]/.test(view)) return null;
    if (ops.length === 1) {
      const m = HEREDOC_AFTER.exec(view.slice(ops[0] + 2));
      if (!m || !HEREDOC_BEFORE.test(view.slice(0, ops[0]))) return null;
      end = m[2];
    }
    out.push(raw);
  }
  return out.join('\n');
}

// Giải biến cho H6 và kiểm bí mật ở full: một vòng duyệt các đoạn của scanWords theo thứ tự, theo dõi cd và phép gán; chỉ tin phép gán chắc chắn đã chạy.
// Lệnh/cấu trúc làm shell đổi biến theo cách không đọc được (kể cả phép gán trong `$(( ))`, `$[ ]`, chỉ số mảng) thì tắt giải biến cả lệnh.
const VAR_MUTATORS = /\b(?:unset|read|declare|typeset|local|readonly|eval|source|trap|mapfile|readarray|getopts)\b|printf\s+-v|\bIFS\b|(?:^|[;&|\n(])[ \t]*\.[ \t]|\$\(\(|\$\[|\$\{[A-Za-z_]\w*\[/;
// Cmdlet/tham số đổi biến theo cách không đọc được: tắt giải biến cả lệnh vì không liệt kê hết được các cách đổi.
const PS_MUTATORS = /\b(?:set|new|remove|clear)-variable\b|\b(?:invoke-expression|iex|get-variable|psvariable)\b|variable:|(?:^|[\s;|({])(?:sv|nv|clv|rv|gv|set)\s|\s-(?:outvariable|ov|errorvariable|ev|warningvariable|wv|informationvariable|iv|pipelinevariable|pv)\b/i;
const ASSIGN_WORD = /^([A-Za-z_]\w*)(\+?=|\[)/;
const LEAD_KW = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '{', '!', 'time']);
const MAX_VAR_NAMES = 20;
const MAX_VAR_CMD = 20000;
const MAX_INNER_DEPTH = 3;
const MAX_INNER_WALK = 200;
const MAX_WALK_SEGS = 1000;
const CYGPATH_MASK = /\$\(\s*cygpath\b[^()\n]*\)/g;
const wordText = (w) => w.parts.map((p) => p.text).join('');

// `..` và `.` được chuẩn hoá cho giá trị biến (cả `\` lẫn `/`) để `S=<T>/../..` ra ngoài root bị thấy; chỉ gọi với đường dẫn tuyệt đối không có glob.
function collapseAbs(p) {
  const prefix = /^(?:[A-Za-z]:[\\/]|[\\/]{1,2})/.exec(p)?.[0] ?? '';
  const out = [];
  for (const s of p.slice(prefix.length).split(/[\\/]+/)) {
    if (s === '' || s === '.') continue;
    if (s === '..') out.pop();
    else out.push(s);
  }
  return prefix.replaceAll('\\', '/') + out.join('/');
}

// Chuỗi lệnh con trong `$( … )` và backtick của một từ (không tính phần nháy đơn/ký tự thoát).
function innerTexts(w, ps = false) {
  const out = [];
  for (const { text, quote } of w.parts) {
    if (quote === 'single' || !(text.includes('$(') || text.includes('`'))) continue;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '`') {
        const { end, closed } = skipSubst(text, i, false);
        // Trong backtick, \` \$ \\ là ký tự thoát của lớp ngoài: bỏ thoát để quét lại như lệnh thật.
        out.push(text.slice(i + 1, closed ? end - 1 : end).replace(/\\([`$\\])/g, '$1'));
        i = end - 1;
      } else if (text[i] === '$' && text[i + 1] === '(') {
        const { end, closed } = skipSubst(text, i + 1, ps);
        out.push(text.slice(i + 2, closed ? end - 1 : end));
        i = end - 1;
      }
    }
  }
  return out;
}

// Từ chuyển hướng ở vị trí i: số từ nó chiếm (2 khi toán tử đứng riêng và đích là từ kế, 1 khi dính liền), 0 nếu không phải chuyển hướng.
function redirSkip(ws, i) {
  const w = ws[i];
  if (!w || w.parts[0].quote !== 'none') return 0;
  const m = /^\d*(?:>>?|<<?|>&|<&|>\||&>>?)/.exec(w.parts[0].text);
  if (!m) return 0;
  return wordText(w).length === m[0].length ? 2 : 1;
}

// Phép gán `NAME=…` đứng đầu đoạn (sau từ khoá mở như `then` và chuyển hướng), `export NAME=…`, các dạng đổi tên biến không đọc được (`+=`, `[i]=`, `for`, `in`, `printf -v`),
// và mọi từ khác có dạng `NAME=…` ở đâu cũng được (nháy, `builtin export`, trong `{ }`): phần đó không được tin nên tên của nó là chưa rõ.
function leadInfo(seg) {
  const ws = seg.words;
  let i = 0;
  while (i < ws.length && ws[i].parts.length === 1 && ws[i].parts[0].quote === 'none' && LEAD_KW.has(ws[i].parts[0].text)) i++;
  const lead = i;
  const assigns = [];
  const used = new Set();
  const assignOf = (w, k, exp) => {
    const m = w.parts[0].quote === 'none' ? ASSIGN_WORD.exec(w.parts[0].text) : null;
    return m ? { name: m[1], plain: m[2] === '=', valueWord: { parts: [{ text: w.parts[0].text.slice(m[0].length), quote: 'none' }, ...w.parts.slice(1)] }, exp } : null;
  };
  while (i < ws.length) {
    const r = redirSkip(ws, i);
    if (r) { i += r; continue; }
    const a = assignOf(ws[i], i, false);
    if (!a) break;
    assigns.push(a);
    used.add(i);
    i++;
  }
  const rest = ws.slice(i);
  if (rest.length && wordText(rest[0]) === 'export') {
    for (let j = 1; j < rest.length; j++) { const a = assignOf(rest[j], i + j, true); if (a) { assigns.push(a); used.add(i + j); } }
  }
  let cmdAt = i;
  while (ws[cmdAt] && (wordText(ws[cmdAt]) === 'builtin' || wordText(ws[cmdAt]) === 'command')) cmdAt++;
  const extra = [];
  const txt = (k) => (ws[k] ? wordText(ws[k]) : '');
  for (let k = 0; k < ws.length; k++) {
    const x = txt(k);
    if ((x === 'for' || x === 'select') && ws[k + 1]) extra.push(txt(k + 1));
    if (/^[A-Za-z_]\w*$/.test(x) && txt(k + 1) === 'in') extra.push(x);
    if (x === 'printf' && txt(k + 1) === '-v' && ws[k + 2]) extra.push(txt(k + 2).replace(/\[.*$/, ''));
    const loose = used.has(k) ? null : /^([A-Za-z_]\w*)(?:\+?=|\[)/.exec(x);
    if (loose) extra.push(loose[1]);
  }
  return { lead, assigns, extra, hasCmd: rest.length > 0, cmdAt };
}

// PowerShell: `$NAME = <từ>` hoặc `$NAME=<từ>` (tên viết thường); đoạn có thêm từ sau giá trị (`$S = Get-Item x`) thì giá trị là kết quả lệnh nên không tin.
// `+=`, `++`, `[ref]$S`, `$S in`, `foreach ($S in …)` đổi biến theo cách không đọc được → tên chưa rõ.
const PS_OP_ATTACHED = /^\$([A-Za-z_]\w*)(?:[-+*\/%?]?\??=|\+\+|--)/;
const PS_OP_NEXT = /^(?:[-+*\/%]|\?\?)?=|^(?:\+\+|--)$/;
function leadInfoPs(seg) {
  const ws = seg.words;
  const assigns = [];
  const extra = [];
  const used = new Set();
  let hasCmd = false;
  let cmdAt = 0;
  const m0 = ws[0]?.parts[0].quote === 'none' ? /^\$([A-Za-z_]\w*)(=?)([\s\S]*)$/.exec(ws[0].parts[0].text) : null;
  const value = (headText, headParts, nextAt) => {
    const vp = [{ text: headText, quote: 'none' }, ...headParts];
    return vp.length === 1 && headText === '' ? { word: ws[nextAt] ?? null, rest: nextAt + 1 } : { word: { parts: vp }, rest: nextAt };
  };
  let hit = null;
  if (m0 && m0[2] === '=') hit = { ...value(m0[3], ws[0].parts.slice(1), 1), used: [0] };
  else if (m0 && m0[3] === '' && ws[0].parts.length === 1 && ws[1]?.parts[0].quote === 'none' && ws[1].parts[0].text.startsWith('=') && !ws[1].parts[0].text.startsWith('==')) {
    hit = { ...value(ws[1].parts[0].text.slice(1), ws[1].parts.slice(1), 2), used: [0, 1] };
  }
  if (hit) {
    assigns.push({ name: m0[1].toLowerCase(), plain: true, valueWord: hit.word, exp: false });
    hit.used.forEach((k) => used.add(k));
    hasCmd = ws.length > hit.rest;
    cmdAt = ws.length;
  } else if (ws[0] && wordText(ws[0]) === '.') cmdAt = 1;
  const txt = (k) => (ws[k] ? wordText(ws[k]) : '');
  for (let k = 0; k < ws.length; k++) {
    if (used.has(k)) continue;
    const x = txt(k);
    const a = PS_OP_ATTACHED.exec(x);
    if (a) extra.push(a[1].toLowerCase());
    const v = /^\$([A-Za-z_]\w*)$/.exec(x);
    if (v && ws[k + 1] && (PS_OP_NEXT.test(txt(k + 1)) || txt(k + 1) === 'in')) extra.push(v[1].toLowerCase());
    for (const r of x.matchAll(/\[ref\]\s*\$([A-Za-z_]\w*)/gi)) extra.push(r[1].toLowerCase());
  }
  return { lead: 0, assigns, extra, hasCmd, cmdAt, used };
}

// Danh sách trắng PowerShell: ngoài phép gán đơn `$name = từ` đứng đầu đoạn, mọi `{`/`}`, `(` hay `=` ngoài nháy, `$( )` có các dấu đó/đổi thư mục là dấu hiệu đổi biến → tắt giải biến cả lệnh.
const PS_CD = /(?:^|[\s;|({])(?:cd|chdir|sl|set-location|push-location|pushd|popd|pop-location)(?=[\s;|)]|$)/i;
const PS_SCOPE_CHANGE = new RegExp('[={}]|' + PS_CD.source, 'i');
// Danh sách cho phép theo tên lệnh: lệnh ngoài tập có thể đổi biến theo cách không liệt kê hết (*-ItemProperty, Invoke-Item, New-PSDrive, pipe…).
// Tên có tiền tố đường dẫn (`.\Remove-Item`, `module\Remove-Item`) là lệnh khác nên không khớp tập.
const PS_VAR_SAFE_CMDS = new Set(['remove-item', 'ri', 'rm', 'del', 'new-item', 'ni', 'mkdir', 'md', 'copy-item', 'cpi', 'cp', 'copy', 'move-item', 'mi', 'mv', 'move',
  'set-content', 'add-content', 'out-file', 'get-content', 'gc', 'cat', 'write-host', 'write-output', 'echo', 'get-childitem', 'gci', 'ls', 'dir', 'test-path',
  'get-item', 'gi', 'resolve-path', 'join-path', 'out-null']);
// Đổi vị trí chỉ được tin khi đối số là literal: `cd $n` với $n = 'vari'+'able:' đưa $PWD và đường dẫn tương đối vào ổ variable:.
const PS_CD_CMDS = new Set(['cd', 'chdir', 'set-location', 'sl', 'push-location', 'pushd', 'popd', 'pop-location']);
function psUnsafe(scan, depth = 0, absNames = null) {
  if (depth > MAX_INNER_DEPTH) return true;
  const infos = scan.segs.map(leadInfoPs);
  if (!absNames) {
    // Tên chỉ được gán literal đường dẫn tuyệt đối (hoặc $PWD) thì giá trị không thể là ổ `variable:`, nên dùng làm đối số *-Item vẫn an toàn.
    // $PWD chỉ là ổ variable: khi cd tới đó, mà cd literal bị PS_MUTATORS bắt, cd không literal thì thư mục đã chưa rõ.
    const abs = new Map([['pwd', true]]);
    for (const inf of infos) {
      for (const a of inf.assigns) {
        let r = null;
        try { r = a.valueWord && resolveWord(a.valueWord, { env: new Map(), dir: '/', unres: false, msys: false }, 'powershell'); } catch { /* chưa rõ */ }
        abs.set(a.name, abs.get(a.name) !== false && !!r && RW_ABS.test(r.text));
      }
      inf.extra.forEach((n) => abs.set(n, false));
    }
    absNames = new Set([...abs].filter(([, v]) => v).map(([n]) => n));
  }
  const unsafeRef = (text) => /\$/.test(text.replace(/\$(?:([A-Za-z_]\w*)(?![\w:])|\{([A-Za-z_]\w*)\}(?!:))/g, (m, a, b) => (absNames.has((a ?? b).toLowerCase()) ? '' : m)));
  // Đối số ghép (`$n` = 'vari'+'able:S', `'vari'+'able:S'`, splat `@p`) có thể là đường dẫn ổ variable:, kể cả khi chỉ chảy qua ống dẫn (`gi $n | rm`).
  // `@'`/`@"` mở here-string (dữ liệu, phần nháy kép vẫn theo luật biến); chỉ `@tên` là splat.
  const argUnsafe = (w) => (w.parts[0]?.quote === 'none' && /^@\w/.test(w.parts[0].text))
    || w.parts.some(({ text, quote }) => (quote !== 'single' && unsafeRef(text)) || (quote === 'none' && text.includes('+')));
  const partsUnsafe = (w) => w.parts.some(({ text, quote }) => quote === 'none' && /[={}]/.test(text.replace(/\$\{[A-Za-z_]\w*\}/g, '')))
    || innerTexts(w, true).some((x) => PS_SCOPE_CHANGE.test(x) || psUnsafe(scanWords(x, 'powershell'), depth + 1, absNames));
  return scan.segs.some((seg, i) => {
    const { used, assigns } = infos[i];
    const ws = seg.words;
    const head = wordText(ws[0]);
    if (head === '.') return true;
    // Vế phải phép gán cũng là pipeline: `$x = Invoke-Item $n` chạy Invoke-Item. Từ mở đầu bằng `$`, số hay chuỗi nháy là biểu thức, không phải lệnh.
    const vw = assigns[0]?.valueWord;
    const cmdWord = assigns.length ? vw : ws[0];
    const lead = cmdWord?.parts.find((p) => p.text !== '');
    const isCmd = !!lead && lead.quote === 'none' && !/^[$\d@]/.test(lead.text);
    const vi = vw ? ws.indexOf(vw) : -1;
    const argsFrom = !assigns.length ? 1 : vi >= 0 ? vi + 1 : Math.max(...used) + 1;
    const name = isCmd ? wordText(cmdWord).toLowerCase() : '';
    const args = ws.slice(argsFrom);
    const cmdUnsafe = isCmd && !(PS_VAR_SAFE_CMDS.has(name) || (PS_CD_CMDS.has(name) && args.every((w) => !/[$(+`]/.test(wordText(w)))));
    // Đoạn biểu thức (`$n | rm`) cũng là đối số: giá trị của nó chảy vào lệnh sau ống dẫn.
    // Danh sách trắng: chỉ một từ; thêm từ là toán tử (`-join`, `-f`, `,`…) ghép được đường dẫn variable: không cần `$`/`+`/`@`.
    const operands = isCmd ? args : ws.filter((w, k) => !used.has(k) && w !== vw);
    const exprUnsafe = !isCmd && !assigns.length && operands.length > 1;
    return seg.compound || cmdUnsafe || exprUnsafe || ws.some((w, k) => !used.has(k) && partsUnsafe(w)) || (vw ? partsUnsafe(vw) : false) || operands.some(argUnsafe);
  });
}

// scan: { segs, unclosed } của scanWords (hoặc naiveScan); trả [{ t, dir, unres }] cùng hình với trackDirs. Từ chưa rõ giữ chữ thô có `$` để hasUnresolvedRef bắt.
export function walkSegments(scan, { cwd, msys = true, dialect = 'bash', noVars = false } = {}, ctx = { inner: MAX_INNER_WALK }, init = null) {
  const { segs } = scan;
  const out = [];
  let dir = init?.dir ?? cwd;
  let unres = init?.unres ?? false;
  const base = init?.env ?? new Map();
  const depth = init?.depth ?? 0;
  const ps = dialect !== 'bash';
  const infos = segs.map(ps ? leadInfoPs : leadInfo);
  const listId = [];
  const allAnd = [];
  segs.forEach((s, i) => {
    const fresh = i === 0 || s.sep === 'start' || s.sep === ';' || s.sep === '&';
    listId.push(fresh ? (i ? listId[i - 1] + 1 : 0) : listId[i - 1]);
    allAnd.push(fresh ? true : allAnd[i - 1] && s.sep === '&&');
  });
  const structOk = segs.map((s, i) => !(s.pipeIn || s.pipeOut || s.background || s.compound) && infos[i].lead === 0);
  const head = segs.map((s) => s.sep === 'start' || s.sep === ';');
  // Tên có phép gán không tin được ở bất kỳ đâu là chưa rõ ở toàn lệnh, vì đoạn dùng nó có thể chạy trước hoặc sau phép gán đó.
  const bad = new Set();
  const names = new Set();
  infos.forEach((inf, i) => {
    inf.extra.forEach((n) => bad.add(n));
    for (const a of inf.assigns) {
      names.add(a.name);
      // Gán trước một lệnh (`S=v cmd`) chỉ có hiệu lực cho lệnh đó.
      if (!a.plain || !structOk[i] || (inf.hasCmd && !a.exp)) bad.add(a.name);
    }
  });
  const vars = !noVars && !scan.unclosed && names.size <= MAX_VAR_NAMES;
  // Gán PWD/OLDPWD làm $PWD không còn khớp thư mục đang theo dõi.
  const pwdNames = ps ? ['pwd', 'oldpwd'] : ['PWD', 'OLDPWD'];
  const pwdOff = pwdNames.some((n) => bad.has(n) || names.has(n));
  const latest = new Map();
  const trusted = (k, j) => structOk[k.seg] && ((head[k.seg] && listId[j] > listId[k.seg]) || (listId[j] === listId[k.seg] && allAnd[j]));
  const safe = (w, state) => { try { return resolveWord(w, state, dialect); } catch { return null; } };
  let cdSeen = false;
  segs.forEach((seg, i) => {
    const env = new Map();
    if (vars) {
      for (const [n, v] of base) if (!latest.has(n) && !bad.has(n)) env.set(n, v);
      for (const [n, k] of latest) env.set(n, !bad.has(n) && trusted(k, i) ? k.value : null);
    }
    const state = { env, dir, unres: unres || !vars || pwdOff, msys };
    const t = [];
    t.globs = [];
    t.qpos = [];
    let opaque = false;
    for (const [wi, w] of seg.words.entries()) {
      const r = safe(w, state);
      // Tên lệnh là thế lệnh hoặc biến không giải được (`$(:) rm …`, `R=rm; $R x`): không biết lệnh nào chạy nên cả đoạn là chưa rõ.
      // PowerShell chỉ tính biến sau toán tử gọi `&`, vì `$x` đầu đoạn khác là biểu thức.
      if (wi === infos[i].cmdAt && !r && w.parts.some((p) => p.quote !== 'single' && ((!ps || seg.call) ? /[$`]/ : /\$\(|`/).test(p.text))) opaque = true;
      const raw = wordText(w);
      t.push(r ? r.text : raw);
      t.globs.push(r ? r.glob : (/[$`]/.test(raw) ? undefined : w.parts.some((p) => p.quote === 'none' && GLOB.test(p.text))));
      const k = w.parts.findIndex((p) => p.quote !== 'none');
      if (k < 0) t.qpos.push(Infinity);
      else if (k === 0) t.qpos.push(0);
      else { const pre = { parts: w.parts.slice(0, k) }; t.qpos.push((safe(pre, state)?.text ?? wordText(pre)).length); }
    }
    t.op = seg.sep === 'start' ? '' : seg.sep;
    const name = String(t[infos[i].cmdAt] ?? '').toLowerCase();
    if (cdSeen && (seg.sep === '||' || seg.sep === '|')) unres = true;
    if (CD_CMDS.has(name) || POP_CMDS.has(name)) {
      cdSeen = true;
      // Cùng luật tin cậy với phép gán: cd ở ống dẫn, nền, khối hoặc sau `||` có thể không chạy hoặc chạy ở tiến trình con.
      const sure = structOk[i] && allAnd[i];
      const arg = POP_CMDS.has(name) ? undefined : t.slice(infos[i].cmdAt + 1).find((x) => !(/^-[A-Za-z]/.test(x) || x === '--' || x === '/d' || x === '/D'));
      if (arg === undefined || hasUnresolvedRef(arg) || arg === '-') unres = true;
      else { const a = np(arg, msys); dir = path.resolve(dir, a); if (sure && path.isAbsolute(a)) unres = false; }
      if (!sure) unres = true;
    }
    const entry = { t, dir, unres };
    out.push(entry);
    // Gán trái sang phải: phép sau thấy giá trị mới của phép trước trong cùng đoạn.
    const seen = new Map(env);
    for (const a of infos[i].assigns) {
      if (!a.plain) continue;
      const r = vars && a.valueWord ? safe(a.valueWord, { ...state, env: seen }) : null;
      const v = r && RW_ABS.test(r.text) ? (GLOB.test(r.text) ? r.text : collapseAbs(r.text)) : null;
      latest.set(a.name, { value: v, seg: i });
      if (!bad.has(a.name)) seen.set(a.name, v);
    }
    // Vượt trần sâu hoặc ngân sách lệnh con, hoặc `case` (dấu `)` của nhánh đóng $( ) sớm): không quét hết được thì chưa rõ.
    for (const w of seg.words) {
      for (const inner of innerTexts(w, ps)) {
        // `$( )` của PowerShell cùng scope: cd bên trong đổi thư mục của đoạn này và các đoạn sau.
        if (ps && PS_CD.test(inner)) { unres = true; entry.unres = true; }
        if (/\bcase\b/.test(inner)) opaque = true;
        if (depth >= MAX_INNER_DEPTH || ctx.inner <= 0) { opaque = true; continue; }
        ctx.inner--;
        const sub = scanWords(inner, dialect);
        pushAll(out, walkSegments(sub, { cwd, msys, dialect, noVars: noVars || !vars }, ctx, { env, dir, unres: unres || !vars, depth: depth + 1 }));
      }
    }
    if (opaque) entry.opaque = true;
  });
  return out;
}

// Dựng đối tượng giống scanWords từ naiveSegments (cùng từ có phần nháy) để walkSegments chạy trên cách nhìn thô.
function naiveScan(naive) {
  const segs = naive.map((t, i) => {
    const sep = !t.op ? (i ? ';' : 'start') : t.op === '\n' ? ';' : t.op;
    const words = naiveWords(t.src, true);
    const first = words[0] ? wordText(words[0]) : '';
    return { words, sep, pipeIn: sep === '|', pipeOut: false, background: false, compound: SH_KW.has(first) || first.startsWith('(') };
  });
  segs.forEach((s, i) => { if (s.sep === '|' && i) segs[i - 1].pipeOut = true; });
  return { segs, unclosed: false };
}

// Chuẩn bị đầu vào cho walkSegments: heredoc đơn giản bị bỏ thân (là dữ liệu, không phải lệnh); lệnh có dấu hiệu đổi biến khó đọc thì tắt giải biến cả lệnh.
function prepareWalk(cmd, ps = false) {
  let noVars = cmd.length > MAX_VAR_CMD || (ps ? PS_MUTATORS : VAR_MUTATORS).test(cmd) || (!ps && cmd.includes('<<<'));
  let text = cmd;
  if (!ps && !noVars && cmd.includes('<<')) {
    const s = stripSimpleHeredocs(cmd, (l) => l.replace(CYGPATH_MASK, 'C'));
    if (s === null) noVars = true;
    else text = s;
  }
  const scan = scanWords(text, ps ? 'powershell' : 'bash');
  const info = ps ? leadInfoPs : leadInfo;
  // `.` làm lệnh (source) ở mọi vị trí lệnh, kể cả sau `{`, `then`, `!`, `time`, `builtin`, `command`.
  const dot = scan.segs.some((s) => { const w = s.words[info(s).cmdAt]; return w && w.parts.length === 1 && w.parts[0].quote === 'none' && w.parts[0].text === '.'; });
  return { scan, text, noVars: noVars || dot || scan.unclosed || (ps && psUnsafe(scan)) };
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
  braceLeft = BRACE_BUDGET;
  braceCache.clear();
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
    return grantsOf({ roots: base.length ? base : [path.resolve(cwd)], config: gate() }, input);
  };
  let fe;
  // Phiên không bypass không bao giờ full: thoát trước khi đọc cấu hình để không tốn lời gọi git nào.
  const full = () => (fe === undefined ? (fe = bypass && fullEffective(config !== undefined ? { config } : readOnce(), input, { tracked })) : fe);
  const ask = (text) => { let line = ''; try { line = summarize(cmd, msys); } catch { /* chỉ mất dòng tóm tắt */ } return { decision: 'ask', reason: line ? `${text}\n${line}` : text }; };
  // Lỗi bất ngờ ở full + bypass thành hỏi: ném lại sẽ để main() cho lệnh chưa được kiểm đi qua.
  try {
  const parsedCmd = parse(cmd);
  const { unclosed } = parsedCmd;
  // Chuỗi con của shell -c/eval chỉ vào kiểm push và tiền tố ask; H6 giữ cách nhìn riêng của confineSegment (ask với bash -c).
  const outer = parsedCmd.segs;
  const naiveOuter = naiveSegments(cmd);
  // Trước mọi bước theo dõi thư mục: chuỗi `cd` dài làm đường dẫn `dir` phình dần, mỗi đoạn tốn thêm nên tổng bậc hai (8000 × `cd a` mất vài giây) [Inference, chưa profile].
  if (Math.max(outer.length, naiveOuter.length) > MAX_WALK_SEGS && full()) return ask(FULL_PATH_TEXT);
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
  if ([...segs, ...naiveAll].some((t) => writesGuardConfig(t, msys)) || pipedIndirectConfigWrite([...segs, ...naiveAll]) || opaqueConfigWrite([...segs, ...naiveAll], cmd) || substitutedConfigWrite([...segs, ...naiveAll], cmd)) {
    return ask(CONFIG_TEXT);
  }
  // Một lần mỗi decide, dùng chung cho H6 và kiểm bí mật để hai nơi không lệch kết quả. Hợp của cách nhìn scanWords và cách nhìn thô; lỗi nội bộ rơi về chữ chưa giải (hỏi).
  let walkedAll;
  const walked = () => {
    if (walkedAll) return walkedAll;
    const legacy = () => [...trackDirs(outer, cwd, msys), ...trackDirs(naiveOuter, cwd, msys)];
    // PowerShell quét chuỗi gốc: scanWords tự hiểu backtick, còn psNormalize đã đổi backtick-nháy thành dấu gạch ngược trước nháy nên sẽ bị đọc sai.
    const isPs = input?.tool_name === 'PowerShell';
    const dialect = isPs ? 'powershell' : 'bash';
    // Không bỏ chú thích PowerShell: bỏ sai (`${#x}`, here-string có nháy lẻ, `<#` không đóng) che lệnh ghi; `{`/`=` trong chú thích chỉ làm hỏi thừa.
    try {
      const { scan, text, noVars } = prepareWalk(isPs ? raw : cmd, isPs);
      const naive = isPs || text === cmd ? naiveOuter : naiveSegments(text);
      walkedAll = [...walkSegments(scan, { cwd, msys, dialect, noVars }), ...walkSegments(naiveScan(naive), { cwd, msys, dialect, noVars })];
    } catch {
      walkedAll = legacy();
    }
    return walkedAll;
  };
  if (full()) {
    const roots = rootsOf();
    let unknownPath = false;
    let readOutside = false;
    for (const { t, dir, unres, opaque } of walked()) {
      if (opaque) unknownPath = true;
      const r = confineSegment(t, dir, unres, roots, msys);
      if (r?.deny) return { decision: 'deny', reason: r.blocked ? CLAUDE_TMP_BLOCKED_TEXT : denyText(r.deny, roots, 'lệnh này ở thư mục') };
      if (r === 'ask') unknownPath = true;
      if (r === 'ask-read') readOutside = true;
    }
    if (unknownPath) return ask(FULL_PATH_TEXT);
    if (readOutside) return ask(READ_OUTSIDE_TEXT);
  }
  // Phiên không bypass trong project full: settings.json không còn quy tắc ask nào chắc chắn áp dụng nên hook hỏi thay.
  // Chỉ đọc cấu hình sau khi một đoạn khớp tiền tố, để lệnh thường không tốn lời gọi git.
  if (!bypass && [...segs, ...naiveAll].some(matchesAsk) && gate()?.mode === 'full') {
    return ask(FULL_NO_BYPASS_TEXT);
  }
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
    if (hits(secretRe) && secretOutsideRoots(walked(), rootsOf(), secretRe, msys)) return secretAsk(secretRe);
  }
  return null;
  } catch (e) {
    let inFull = false;
    try { inFull = full(); } catch { /* không đọc được cấu hình: coi như không full */ }
    if (inFull) return ask(FULL_PATH_TEXT);
    throw e;
  }
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
