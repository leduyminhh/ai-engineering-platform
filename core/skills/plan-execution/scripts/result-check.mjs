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
    if (!(key in LINE_KEYS)) { add('line-format', `khoá lạ: ${key}`); continue; }
    if (!!t[1] !== (key === 'note')) { add('line-format', `chỉ note, và luôn note, đặt trong nháy kép: ${key}`); continue; }
    if (key in kv) { add('line-format', `khoá lặp: ${key}`); continue; }
    kv[key] = val;
    if (!LINE_KEYS[key](val)) add('line-bad-value', `giá trị sai cho ${key}: ${val}`);
  }
  const need = ['from', 'status'];
  if (kv.status === 'complete') need.push('hash', 'tests');
  if (kv.status === 'blocked' || kv.status === 'failed') need.push('note');
  for (const k of need) if (kv[k] === undefined) add('line-missing-key', `thiếu khoá ${k}`);
  return { ok: violations.length === 0, violations, not_run: [] };
}

// Parser YAML tối thiểu cho khối agent_result: map/list theo thụt lề, flow {…}/[…] một dòng, chuỗi nháy.
// Không phải YAML đầy đủ: cấu trúc ngoài tập này ném lỗi để khối bị coi là unparseable (worker trả lại).
class YamlError extends Error {}

function parseFlow(src) {
  let i = 0;
  const ws = () => { while (src[i] === ' ' || src[i] === '\t') i++; };
  const value = (stops) => {
    ws();
    if (src[i] === '{' || src[i] === '[') {
      const close = src[i] === '{' ? '}' : ']';
      const isMap = src[i++] === '{';
      const out = isMap ? {} : [];
      ws();
      if (src[i] === close) { i++; return out; }
      for (;;) {
        if (isMap) {
          const m = /^\s*([^:,{}[\]]+?)\s*:\s/.exec(src.slice(i));
          if (!m) throw new YamlError('flow map thiếu khoá');
          i += m[0].length;
          out[m[1].replace(/^["']|["']$/g, '')] = value(',}');
        } else out.push(value(',]'));
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === close) { i++; return out; }
        throw new YamlError('flow chưa đóng');
      }
    }
    if (src[i] === '"' || src[i] === "'") {
      const q = src[i++];
      const start = i;
      while (i < src.length && src[i] !== q) i += src[i] === '\\' && q === '"' ? 2 : 1;
      if (i >= src.length) throw new YamlError('chuỗi chưa đóng nháy');
      return src.slice(start, i++);
    }
    const start = i;
    while (i < src.length && !stops.includes(src[i])) i++;
    return src.slice(start, i).trim();
  };
  const v = value('');
  ws();
  if (i < src.length) throw new YamlError('thừa ký tự sau flow');
  return v;
}

// Khoá mà luật đọc cấu trúc: flow hỏng ở đây là unparseable; ở khoá khác, report thật hay viết `[] (ghi chú)`
// hoặc `- [Unverified] …`, nên giữ nguyên làm chuỗi thay vì bắt worker trả lại.
const STRICT_KEYS = new Set(['changes', 'validation', 'findings', 'new_breakage', 'questions', 'tdd', 'assumptions',
  'assumption_review', 'verdicts', 'ruling_review']);

function scalar(raw, key) {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (/^[{["']/.test(s)) {
    // Bỏ comment sau giá trị đã đóng, vd `status: "x"  # ghi chú`.
    const body = /^(["']).*\1\s+#/.test(s) ? s.replace(/(["'])\s+#.*$/, '$1') : s;
    try {
      return parseFlow(body.replace(/\s+#[^"'\]}]*$/, ''));
    } catch (e) {
      if (!(e instanceof YamlError) || STRICT_KEYS.has(key)) throw e;
      return s;
    }
  }
  return s.replace(/\s+#.*$/, '');
}

// Dòng thụt sâu hơn ngay sau một giá trị: gom thành chuỗi (block scalar `|`/`>` hoặc phần nối của giá trị trần).
function deeperText(lines, i, indent) {
  const out = [];
  while (i < lines.length && lines[i].indent > indent) out.push(lines[i++].text);
  return [out.join('\n'), i];
}

const KEY_LINE = /^([A-Za-z_][\w.-]*):(?:\s+(.*))?$/;

function parseNode(lines, i, indent, key) {
  return lines[i].text.startsWith('-') ? parseList(lines, i, indent, key) : parseMap(lines, i, indent);
}

function childOf(lines, i, indent, key) {
  const next = lines[i + 1];
  if (next && next.indent > indent) return parseNode(lines, i + 1, next.indent, key);
  if (next && next.indent === indent && next.text.startsWith('-')) return parseList(lines, i + 1, indent, key);
  return [null, i + 1];
}

function parseMap(lines, i, indent) {
  const out = {};
  while (i < lines.length && lines[i].indent === indent && !lines[i].text.startsWith('-')) {
    const m = KEY_LINE.exec(lines[i].text);
    if (!m) throw new YamlError(`dòng không phải khoá: ${lines[i].text}`);
    const inline = m[2]?.trim() ?? '';
    if (/^[|>][-+]?$/.test(inline)) [out[m[1]], i] = deeperText(lines, i + 1, indent);
    else if (inline !== '') {
      out[m[1]] = scalar(inline, m[1]);
      i++;
      if (i < lines.length && lines[i].indent > indent) {
        if (STRICT_KEYS.has(m[1]) || typeof out[m[1]] !== 'string') throw new YamlError(`khoá ${m[1]} vừa có giá trị vừa có dòng con`);
        let tail; [tail, i] = deeperText(lines, i, indent);
        out[m[1]] = `${out[m[1]]}\n${tail}`;
      }
    } else [out[m[1]], i] = childOf(lines, i, indent, m[1]);
  }
  if (i < lines.length && lines[i].indent > indent) throw new YamlError(`thụt lề sai: ${lines[i].text}`);
  return [out, i];
}

function parseList(lines, i, indent, key) {
  const out = [];
  while (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith('-')) {
    const rest = lines[i].text.slice(1).trimStart();
    if (rest === '') { let v; [v, i] = childOf(lines, i, indent); out.push(v); continue; }
    if (KEY_LINE.test(rest) && !/^[{["']/.test(rest)) {
      const childIndent = indent + (lines[i].text.length - rest.length);
      lines[i] = { indent: childIndent, text: rest };
      let v; [v, i] = parseMap(lines, i, childIndent); out.push(v); continue;
    }
    // Mục list chỉ hỏng flow khi là map/list thật ({…} hoặc […] có dấu phẩy/hai chấm); `[Unverified] chữ` là chuỗi.
    out.push(scalar(rest, /^\{|^\[[^\]]*[,:]/.test(rest) ? key : undefined));
    i++;
  }
  return [out, i];
}

export function parseAgentResult(text) {
  const all = String(text).replace(/\r\n?/g, '\n').split('\n');
  const at = all.findIndex((l) => /^\s*agent_result:\s*$/.test(l));
  if (at < 0) return null;
  const base = all[at].search(/\S/);
  const lines = [];
  for (const l of all.slice(at + 1)) {
    if (/^\s*(```|~~~)/.test(l)) break;
    if (l.trim() === '') continue;
    const indent = l.search(/\S/);
    if (indent <= base) break;
    lines.push({ indent, text: l.trim() });
  }
  if (!lines.length) return null;
  try {
    const [v, end] = parseNode(lines, 0, lines[0].indent);
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

  if (role === 'implementer' && !('assumptions' in parsed)) add('assumptions-key', 'implementer thiếu khoá assumptions ([] hợp lệ)');
  if (role === 'task-review' && (!('spec_verdict' in parsed) || !('findings' in parsed))) add('spec-verdict-findings', 'task-review thiếu spec_verdict hoặc findings');
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
  if (parsed.status === 'blocked' && !list(parsed.questions).length) add('blocked-questions', 'status blocked nhưng questions rỗng hoặc vắng');
  if (role === 'final-review' && (!('findings' in parsed) || !('ruling_review' in parsed))) add('final-review-keys', 'final-review thiếu findings hoặc ruling_review');

  return { ok: violations.length === 0, violations, not_run: notRun };
}

function readText(file, flag) {
  let st;
  try { st = fs.statSync(file); } catch { throw new UsageError(`${flag}: không đọc được ${file}`); }
  if (st.isDirectory()) throw new UsageError(`${flag}: ${file} là thư mục`);
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
