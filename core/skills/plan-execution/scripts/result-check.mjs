#!/usr/bin/env node
// Kiểm kết quả worker theo contract đầu ra (core:principles): khối agent_result trong file report, hoặc một dòng aip-report.
// Chỉ đọc; in JSON { ok, violations, not_run }; exit 0 đạt, 1 vi phạm, 2 sai đối số hoặc không đọc được file.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { extractTask, effectiveTdd } from './task-brief.mjs';

export const ROLES = ['implementer', 'task-review', 're-review', 'final-review', 'worker'];

export class UsageError extends Error {}

const USAGE = 'cách dùng: result-check.mjs <report.md> --role <implementer|task-review|re-review|final-review|worker> '
  + '[--tdd] [--plan <plan.md> --task <n>] [--implementer-report <file>] [--findings <n>] | result-check.mjs --line "<dòng>"';

export function parseArgs(argv) {
  const out = { tdd: false };
  const value = (i, flag) => {
    if (i + 1 >= argv.length) throw new UsageError(`${flag} thiếu giá trị`);
    return argv[i + 1];
  };
  const count = (raw, flag) => {
    if (!/^\d+$/.test(raw)) throw new UsageError(`${flag} phải là số nguyên ≥ 0`);
    return Number(raw);
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--line') out.line = value(i++, a);
    else if (a === '--role') out.role = value(i++, a);
    else if (a === '--tdd') out.tdd = true;
    else if (a === '--plan') out.plan = value(i++, a);
    else if (a === '--task') out.task = count(value(i++, a), a);
    else if (a === '--implementer-report') out.implementerReport = value(i++, a);
    else if (a === '--findings') out.findings = count(value(i++, a), a);
    else if (a.startsWith('--')) throw new UsageError(`cờ lạ: ${a}`);
    else if (out.report === undefined) out.report = a;
    else throw new UsageError(`thừa đối số: ${a}`);
  }
  if (out.line !== undefined) {
    if (out.report !== undefined || out.role !== undefined) throw new UsageError('--line không đi cùng <report.md> hay --role');
    return out;
  }
  if (out.report === undefined) throw new UsageError('thiếu <report.md> hoặc --line');
  if (out.role === undefined) throw new UsageError('thiếu --role');
  if (!ROLES.includes(out.role)) throw new UsageError(`--role lạ: ${out.role}`);
  if ((out.plan === undefined) !== (out.task === undefined)) throw new UsageError('--plan và --task phải đi cùng nhau');
  return out;
}

const LINE_MAX = 400;
const NOTE_MAX = 120;
const LINE_KEYS = {
  from: (v) => /^[A-Za-z0-9._-]+$/.test(v),
  status: (v) => ['complete', 'blocked', 'failed'].includes(v),
  hash: (v) => /^[0-9a-f]{7,40}$/i.test(v),
  tests: (v) => ['pass', 'fail', 'not_run'].includes(v),
  minor: (v) => /^\d+$/.test(v),
  file: (v) => v.length > 0,
  note: (v) => v.trim().length > 0 && [...v].length <= NOTE_MAX,
};

export function checkReportLine(raw) {
  const violations = [];
  const add = (rule, detail) => violations.push({ rule, detail });
  const line = String(raw).replace(/\r$/, '');
  if (/[\r\n]/.test(line)) add('line-format', 'phải là đúng một dòng');
  if ([...line].length > LINE_MAX) add('line-too-long', `dài ${[...line].length} code point, trần ${LINE_MAX}`);
  const tokens = [...line.matchAll(/([a-z]+)="([^"]*)"|(\S+)/g)];
  if (tokens[0]?.[3] !== 'aip-report' || tokens[1]?.[3] !== 'v1') add('line-format', 'phải mở đầu bằng "aip-report v1"');
  const kv = {};
  for (const t of tokens.slice(2)) {
    const [key, val] = t[1] ? [t[1], t[2]] : (t[3].match(/^([a-z]+)=(.*)$/)?.slice(1) ?? [undefined, undefined]);
    if (key === undefined) { add('line-format', `token không phải khoá=giá trị: ${t[0]}`); continue; }
    if (!Object.hasOwn(LINE_KEYS, key)) { add('line-format', `khoá lạ: ${key}`); continue; }
    if (!!t[1] !== (key === 'note')) { add('line-format', `chỉ note, và luôn note, đặt trong nháy kép: ${key}`); continue; }
    if (Object.hasOwn(kv, key)) { add('line-format', `khoá lặp: ${key}`); continue; }
    kv[key] = val;
    if (!LINE_KEYS[key](val)) add('line-bad-value', `giá trị sai cho ${key}: ${val}`);
  }
  const need = ['from', 'status'];
  if (kv.status === 'complete') need.push('hash', 'tests');
  if (kv.status === 'blocked' || kv.status === 'failed') need.push('note');
  for (const k of need) if (kv[k] === undefined) add('line-missing-key', `thiếu khoá ${k}`);
  return { ok: violations.length === 0, violations, not_run: [] };
}

// Parser YAML tối thiểu cho khối agent_result: map/list theo thụt lề, flow {…}/[…] một dòng, chuỗi nháy, chú thích `#`.
// Không phải YAML đầy đủ: cấu trúc ngoài tập này ném lỗi để khối bị coi là unparseable (worker trả lại).
// Chạy trên báo cáo do worker viết nên có trần độ sâu, độ dài dòng và khoá cấm; mọi vòng quét đều tuyến tính (không regex lùi).
class YamlError extends Error {}

const DEPTH_MAX = 64;
const YAML_LINE_MAX = 10_000;
const REPORT_MAX = 1_000_000;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const newMap = () => Object.create(null);
function safeKey(k) {
  if (FORBIDDEN_KEYS.has(k)) throw new YamlError(`khoá bị cấm: ${k}`);
  return k;
}

// Chú thích bắt đầu ở `#` đầu tiên đứng sau khoảng trắng, ngoài nháy và ngoài ngoặc; nháy chỉ mở ở đầu token
// để dấu nháy đơn trong chữ thường (`don't`) không nuốt mất chú thích phía sau.
function stripComment(s) {
  let quote = '';
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const prev = i === 0 ? ' ' : s[i - 1];
    if (quote) {
      if (c === '\\' && quote === '"') i++;
      else if (c === quote) quote = '';
    } else if ((c === '"' || c === "'") && /[\s[{,:]/.test(prev)) quote = c;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth = Math.max(0, depth - 1);
    else if (c === '#' && depth === 0 && /\s/.test(prev)) return s.slice(0, i).trimEnd();
  }
  return s;
}

function parseFlow(src) {
  let i = 0;
  const ws = () => { while (src[i] === ' ' || src[i] === '\t') i++; };
  const quoted = () => {
    const q = src[i++];
    const start = i;
    while (i < src.length && src[i] !== q) i += src[i] === '\\' && q === '"' ? 2 : 1;
    if (i >= src.length) throw new YamlError('chuỗi chưa đóng nháy');
    return src.slice(start, i++);
  };
  const flowKey = () => {
    ws();
    let key;
    if (src[i] === '"' || src[i] === "'") key = quoted();
    else {
      const start = i;
      while (i < src.length && !':,{}[]'.includes(src[i])) i++;
      key = src.slice(start, i).trim();
    }
    ws();
    if (!key || src[i] !== ':' || !/\s/.test(src[i + 1] ?? '')) throw new YamlError('flow map thiếu khoá');
    i++;
    return safeKey(key);
  };
  const value = (stops, depth) => {
    if (depth > DEPTH_MAX) throw new YamlError('flow lồng quá sâu');
    ws();
    if (src[i] === '{' || src[i] === '[') {
      const close = src[i] === '{' ? '}' : ']';
      const isMap = src[i++] === '{';
      const out = isMap ? newMap() : [];
      ws();
      if (src[i] === close) { i++; return out; }
      for (;;) {
        if (isMap) out[flowKey()] = value(',}', depth + 1);
        else out.push(value(',]', depth + 1));
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === close) { i++; return out; }
        throw new YamlError('flow chưa đóng');
      }
    }
    if (src[i] === '"' || src[i] === "'") return quoted();
    const start = i;
    while (i < src.length && !stops.includes(src[i])) i++;
    return src.slice(start, i).trim();
  };
  const v = value('', 0);
  ws();
  if (i < src.length) throw new YamlError('thừa ký tự sau flow');
  return v;
}

// Khoá mà luật đọc cấu trúc: flow hỏng ở đây là unparseable; ở khoá khác, report thật hay viết `[] (ghi chú)`
// hoặc `- [Unverified] …`, nên giữ nguyên làm chuỗi thay vì bắt worker trả lại.
const STRICT_KEYS = new Set(['changes', 'validation', 'findings', 'new_breakage', 'questions', 'tdd', 'assumptions',
  'assumption_review', 'verdicts', 'ruling_review']);

function scalar(raw, key) {
  const s = stripComment(raw).trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (/^[{["']/.test(s)) {
    try {
      return parseFlow(s);
    } catch (e) {
      if (!(e instanceof YamlError) || STRICT_KEYS.has(key)) throw e;
      return s;
    }
  }
  return s;
}

// Report thật hay viết giá trị trần kèm ghi chú nhiều dòng thụt sâu hơn; gom thành chuỗi thay vì bắt worker trả lại.
function deeperText(lines, i, indent) {
  const out = [];
  while (i < lines.length && lines[i].indent > indent) out.push(lines[i++].text);
  return [out.join('\n'), i];
}

const KEY_LINE = /^([A-Za-z_][\w.-]*):(?:\s+(.*))?$/;

function parseNode(lines, i, indent, key, depth) {
  return lines[i].text.startsWith('-') ? parseList(lines, i, indent, key, depth) : parseMap(lines, i, indent, depth);
}

function childOf(lines, i, indent, key, depth) {
  const next = lines[i + 1];
  if (next && next.indent > indent) return parseNode(lines, i + 1, next.indent, key, depth + 1);
  if (next && next.indent === indent && next.text.startsWith('-')) return parseList(lines, i + 1, indent, key, depth + 1);
  return [null, i + 1];
}

function parseMap(lines, i, indent, depth) {
  if (depth > DEPTH_MAX) throw new YamlError('thụt lề lồng quá sâu');
  const out = newMap();
  while (i < lines.length && lines[i].indent === indent && !lines[i].text.startsWith('-')) {
    const m = KEY_LINE.exec(lines[i].text);
    if (!m) throw new YamlError(`dòng không phải khoá: ${lines[i].text}`);
    const key = safeKey(m[1]);
    const inline = stripComment(m[2] ?? '').trim();
    if (/^[|>][-+]?$/.test(inline)) [out[key], i] = deeperText(lines, i + 1, indent);
    else if (inline !== '') {
      out[key] = scalar(inline, key);
      i++;
      if (i < lines.length && lines[i].indent > indent) {
        if (STRICT_KEYS.has(key) || typeof out[key] !== 'string') throw new YamlError(`khoá ${key} vừa có giá trị vừa có dòng con`);
        let tail; [tail, i] = deeperText(lines, i, indent);
        out[key] = `${out[key]}\n${tail}`;
      }
    } else [out[key], i] = childOf(lines, i, indent, key, depth);
  }
  if (i < lines.length && lines[i].indent > indent) throw new YamlError(`thụt lề sai: ${lines[i].text}`);
  return [out, i];
}

function parseList(lines, i, indent, key, depth) {
  if (depth > DEPTH_MAX) throw new YamlError('thụt lề lồng quá sâu');
  const out = [];
  while (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith('-')) {
    const rest = lines[i].text.slice(1).trimStart();
    if (rest === '') {
      // Chỉ dòng thụt sâu hơn mới là con của mục `-` rỗng; mục `-` ngang hàng phía sau là mục khác.
      const next = lines[i + 1];
      if (next && next.indent > indent) { let v; [v, i] = parseNode(lines, i + 1, next.indent, key, depth + 1); out.push(v); } else { out.push(null); i++; }
      continue;
    }
    if (KEY_LINE.test(rest) && !/^[{["']/.test(rest)) {
      const childIndent = indent + (lines[i].text.length - rest.length);
      lines[i] = { indent: childIndent, text: rest };
      let v; [v, i] = parseMap(lines, i, childIndent, depth + 1); out.push(v); continue;
    }
    // Mục list chỉ hỏng flow khi là map/list thật ({…} hoặc […] có dấu phẩy/hai chấm); `[Unverified] chữ` là chuỗi.
    out.push(scalar(rest, /^\{|^\[[^\]]*[,:]/.test(rest) ? key : undefined));
    i++;
  }
  return [out, i];
}

// Header `agent_result:` riêng một dòng (khoá con ở các dòng sau) hoặc flow một dòng `agent_result: { … }`; trả phần sau dấu `:` đã bỏ chú thích.
function headerRest(l) {
  const t = l.trimStart();
  if (l.length > YAML_LINE_MAX || !t.startsWith('agent_result:') || (t.length > 13 && !/\s/.test(t[13]))) return null;
  const rest = stripComment(t.slice(13)).trim();
  return rest === '' || rest[0] === '{' ? rest : null;
}

export function parseAgentResult(text) {
  const all = String(text).replace(/\r\n?/g, '\n').split('\n');
  const at = all.findIndex((l) => headerRest(l) !== null);
  if (at < 0) return null;
  const rest = headerRest(all[at]);
  try {
    if (rest !== '') {
      const v = parseFlow(rest);
      return v && !Array.isArray(v) && typeof v === 'object' ? v : null;
    }
    const base = all[at].search(/\S/);
    const lines = [];
    for (const l of all.slice(at + 1)) {
      if (/^\s*(```|~~~)/.test(l)) break;
      const t = l.trim();
      if (t === '' || t[0] === '#') continue;
      const indent = l.search(/\S/);
      if (indent <= base) break;
      if (l.length > YAML_LINE_MAX) return null;
      lines.push({ indent, text: t });
    }
    if (!lines.length) return null;
    const [v, end] = parseNode(lines, 0, lines[0].indent, undefined, 0);
    return end === lines.length && v && !Array.isArray(v) ? v : null;
  } catch (e) {
    if (e instanceof YamlError) return null;
    throw e;
  }
}

const list = (v) => (Array.isArray(v) ? v : []);
const filled = (v) => v !== undefined && v !== null && v !== '' && !(typeof v === 'object' && !Object.keys(v).length);

function taskFiles(taskText) {
  return [...taskText.matchAll(/^-\s*(?:Create|Modify|Test|Delete):\s*`([^`]+)`/gm)].map((m) => m[1].replace(/\\/g, '/'));
}

function changedPaths(changes) {
  if (Array.isArray(changes)) return changes.filter((x) => typeof x === 'string');
  if (changes && typeof changes === 'object') return ['added', 'modified', 'deleted'].flatMap((k) => list(changes[k]));
  return [];
}

export function checkAgentResult(parsed, opts = {}) {
  if (!parsed) return { ok: false, violations: [{ rule: 'unparseable', detail: 'không có khối agent_result đọc được' }], not_run: [] };
  const { role = 'worker', planText, task } = opts;
  const violations = [];
  const notRun = [];
  const add = (rule, detail) => violations.push({ rule, detail });
  const skip = (rule, reason) => notRun.push({ rule, reason });

  if (!['completed', 'failed', 'blocked'].includes(parsed.status)) add('status-valid', `status phải là completed | failed | blocked, có: ${parsed.status ?? 'thiếu'}`);

  [...list(parsed.findings), ...list(parsed.new_breakage)].forEach((f, k) => {
    if (!f || typeof f !== 'object' || !filled(f.location) || !filled(f.evidence)) add('finding-location-evidence', `finding #${k + 1} thiếu location hoặc evidence`);
  });

  if (parsed.status === 'completed' && list(parsed.validation).some((v) => v && typeof v === 'object' && v.status === 'failed')) {
    add('completed-no-failed-validation', 'status completed nhưng có validation failed');
  }

  // Reviewer chỉ đọc nên không sửa file và không viết test: hai luật này chỉ áp cho vai ghi code.
  if (role === 'implementer' || role === 'worker') {
    let taskText;
    if (planText !== undefined && task !== undefined) {
      taskText = extractTask(planText, task);
      if (!taskText) throw new UsageError(`--plan không có Task ${task}`);
      const allowed = new Set(taskFiles(taskText));
      const outside = changedPaths(parsed.changes).map((p) => String(p).replace(/\\/g, '/')).filter((p) => !allowed.has(p));
      if (outside.length) add('changes-in-files', `file ngoài **Files:** của Task ${task}: ${outside.join(', ')}`);
    } else skip('changes-in-files', 'cần --plan và --task');

    const needTdd = opts.tdd || (taskText !== undefined && effectiveTdd(taskText).value === 'có');
    if (needTdd && (!filled(parsed.tdd?.red) || !filled(parsed.tdd?.green))) add('tdd-required', 'task TDD có nhưng thiếu tdd.red hoặc tdd.green');
  }

  if (role === 'implementer' && !Object.hasOwn(parsed, 'assumptions')) add('assumptions-key', 'implementer thiếu khoá assumptions ([] hợp lệ)');
  if (role === 'task-review' && (!Object.hasOwn(parsed, 'spec_verdict') || !Object.hasOwn(parsed, 'findings'))) add('spec-verdict-findings', 'task-review thiếu spec_verdict hoặc findings');
  if (role === 'task-review' || role === 're-review') {
    if (opts.implementerAssumptions === undefined) skip('assumption-review-count', 'cần --implementer-report');
    else if (list(parsed.assumption_review).length !== opts.implementerAssumptions) {
      add('assumption-review-count', `assumption_review có ${list(parsed.assumption_review).length} mục, báo cáo implementer có ${opts.implementerAssumptions} giả định`);
    }
  }
  if (role === 're-review') {
    if (opts.findings === undefined) skip('verdicts-count', 'cần --findings');
    else if (list(parsed.verdicts).length !== opts.findings) add('verdicts-count', `verdicts có ${list(parsed.verdicts).length} mục, cần ${opts.findings}`);
  }
  const q = parsed.questions;
  const hasQuestions = Array.isArray(q) ? q.length > 0 : typeof q === 'string' && q.trim() !== '';
  if (parsed.status === 'blocked' && !hasQuestions) add('blocked-questions', 'status blocked nhưng questions rỗng hoặc vắng');
  if (role === 'final-review' && (!Object.hasOwn(parsed, 'findings') || !Object.hasOwn(parsed, 'ruling_review'))) add('final-review-keys', 'final-review thiếu findings hoặc ruling_review');

  return { ok: violations.length === 0, violations, not_run: notRun };
}

function readText(file, flag) {
  let st;
  try { st = fs.statSync(file); } catch { throw new UsageError(`${flag}: không đọc được ${file}`); }
  if (st.isDirectory()) throw new UsageError(`${flag}: ${file} là thư mục`);
  if (st.size > REPORT_MAX) throw new UsageError(`${flag}: ${file} lớn hơn ${REPORT_MAX} byte`);
  try { return fs.readFileSync(file, 'utf8'); } catch { throw new UsageError(`${flag}: không đọc được ${file}`); }
}

export function main(argv) {
  let args;
  let result;
  try {
    args = parseArgs(argv);
    if (args.line !== undefined) result = checkReportLine(args.line);
    else {
      const opts = { role: args.role, tdd: args.tdd, task: args.task, findings: args.findings };
      if (args.plan !== undefined) opts.planText = readText(args.plan, '--plan');
      if (args.implementerReport !== undefined) {
        const impl = parseAgentResult(readText(args.implementerReport, '--implementer-report'));
        if (!impl) throw new UsageError('--implementer-report: không có khối agent_result đọc được');
        opts.implementerAssumptions = list(impl.assumptions).length;
      }
      result = checkAgentResult(parseAgentResult(readText(args.report, '<report.md>')), opts);
    }
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    process.stderr.write(`${e.message}\n${USAGE}\n`);
    return 2;
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.ok ? 0 : 1;
}

const isMain = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (isMain) process.exitCode = main(process.argv.slice(2));
