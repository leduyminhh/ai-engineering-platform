#!/usr/bin/env node
// Kiểm kết quả worker theo contract đầu ra (core:principles): khối agent_result trong file report, hoặc một dòng aip-report.
// Chỉ đọc; in JSON { ok, violations, not_run }; exit 0 đạt, 1 vi phạm, 2 sai đối số hoặc không đọc được file.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

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
  note: (v) => [...v].length <= NOTE_MAX,
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
    if (t[1] && key !== 'note') { add('line-format', `chỉ note được đặt trong nháy kép: ${key}`); continue; }
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

export function parseAgentResult() {
  return null;
}

export function checkAgentResult(parsed) {
  if (!parsed) return { ok: false, violations: [{ rule: 'unparseable', detail: 'không có khối agent_result đọc được' }], not_run: [] };
  return { ok: true, violations: [], not_run: [] };
}

function readText(file, flag) {
  let st;
  try { st = fs.statSync(file); } catch { throw new UsageError(`${flag}: không đọc được ${file}`); }
  if (st.isDirectory()) throw new UsageError(`${flag}: ${file} là thư mục`);
  return fs.readFileSync(file, 'utf8');
}

export function main(argv) {
  let args;
  let result;
  try {
    args = parseArgs(argv);
    result = args.line !== undefined
      ? checkReportLine(args.line)
      : checkAgentResult(parseAgentResult(readText(args.report, '<report.md>')), args);
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
