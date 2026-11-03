#!/usr/bin/env node
// Sổ tiến độ của một plan: <gốc repo chính>/.aip/runs/<request>/<part>/progress.md (xem workspace.mjs; git bỏ qua .aip).
// Cách dùng: <plan.md | requestDir> "<dòng>" — thêm một dòng vào ledger, in đường dẫn file. Exit 2 khi thiếu đối số hoặc dòng bị từ chối.
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveWorkspace } from './workspace.mjs';
import { extractTask, effectiveTdd, taskField } from './task-brief.mjs';

const DONE_RE = /^Plan: complete\s*$/m;
// Chế độ inline không có review từng task, nên dòng complete là bằng chứng duy nhất: bắt buộc mang lệnh test và exit 0.
// `inline` phải là một token riêng: "references/inline.md" hay "inline-fix" trong ghi chú của dòng thường không bị bắt nhầm.
const INLINE_COMPLETE_RE = /^Task \d+: complete\b.*\binline\b(?![.\w-])/i;
const INLINE_EVIDENCE_RE = /\btests: \S.* exit 0\b/;
const EXIT_FAILED_RE = /\bexit [1-9]/;
const TASK_COMPLETE_RE = /^Task \d+: complete\b/i;
// Không vượt qua "tests:": red: thiếu exit không được mượn exit của tests: phía sau. "red: exit 1" không có lệnh thì không tính.
const RED_RE = /\bred:\s*(?!tests:)\S(?:(?!\btests:).)*? exit (\d+)\b/gi;
// Khối red: không có lệnh bị từ chối thẳng, không chỉ bị bỏ qua: bỏ qua thì "red: exit 0" thoát kiểm exit 0 ở dưới.
const RED_NO_CMD_RE = /\bred:\s*(?:tests:|exit\s+\d)/i;
// Chặn độ dài trước khi chạy regex: INLINE_EVIDENCE_RE lùi bậc hai trên dòng dài lặp "tests: ".
const MAX_LINE = 4096;
// \r lẻ cũng ngăn dòng: TASK_COMPLETE_RE neo ^ không cờ m, nên "x\rTask 1: complete … inline" sẽ lọt kiểm.
const LINE_SPLIT = /\r\n|\r|\n/;
// Dòng sự kiện mà `aip status` đọc để dựng trạng thái part: tiền tố khớp thì cả dòng phải đúng mẫu, sai thì trạng thái dựng sai.
// Tiền tố nới (thụt đầu dòng, hoa thường) để "blocked: x" bị từ chối thay vì lọt qua thành dòng tự do mà status không nhận ra.
const EVENT_FORMATS = [
  [/^\s*task \d+: start\b/i, /^Task \d+: start \(base [0-9a-f]{7,40}\)$/, 'Task <n>: start (base <hash>)'],
  [/^\s*task \d+: review\b/i, /^Task \d+: review [1-9]\d* (?:compliant|issues|cannot_verify) \d+\/\d+\/\d+$/, 'Task <n>: review <vòng> <compliant|issues|cannot_verify> <blocker>/<major>/<minor>'],
  [/^\s*blocked:/i, /^Blocked: \S/, 'Blocked: <lý do>'],
  [/^\s*unblocked:/i, /^Unblocked: \S/, 'Unblocked: <cách giải>'],
  // Hook session-start chỉ nhận đúng "Plan: complete" và "Part: complete"; aip status chỉ nhận "Part <nn>…: merged": sai chữ thì ledger bị nạp lại mãi và part kẹt ở chờ.
  [/^\s*plan:/i, /^Plan: complete$/, 'Plan: complete'],
  [/^\s*part:/i, /^Part: complete(?: [0-9a-f]{7,40})?$/, 'Part: complete [<hash>]'],
  [/^\s*part \d/i, /^Part \d{2}\S*: merged(?: [0-9a-f]{7,40})?$/, 'Part <nn>[-<slug>]: merged [<hash>]'],
];

// ctx = { tdd, kind } của task trong plan; thiếu ctx thì chỉ kiểm định dạng như trước.
export function validateLine(line, ctx) {
  if (line.trim() === '') return 'dòng ledger trống';
  // Đối số nhiều dòng được kiểm từng dòng: một dòng hợp lệ không được che dòng inline thiếu evidence.
  for (const l of line.split(LINE_SPLIT)) {
    if (l.length > MAX_LINE) return `dòng ledger dài quá ${MAX_LINE} ký tự`;
    const fmt = EVENT_FORMATS.find(([prefix]) => prefix.test(l));
    if (fmt && !fmt[1].test(l)) return `dòng ledger sai định dạng, cần "${fmt[2]}"`;
    let evidence = l;
    let selfRunTdd = false;
    if (TASK_COMPLETE_RE.test(l)) {
      if (RED_NO_CMD_RE.test(l)) return 'dòng Task <n>: complete có khối "red:" không có lệnh: cần "red: <lệnh> exit <n khác 0>"';
      // Mọi khối red: đều phải exit khác 0; một khối giả không được che bởi khối hợp lệ đứng trước.
      for (const red of l.matchAll(RED_RE)) {
        if (Number(red[1]) === 0) return 'dòng Task <n>: complete có "red: <lệnh> exit 0": bằng chứng đỏ phải exit khác 0';
      }
      // exit khác 0 của red là hợp lệ, không được tính vào kiểm "tests" bên dưới.
      evidence = l.replace(RED_RE, '');
      // Task do session chính tự làm (TOOLING hoặc inline) không có agent_result: dòng ledger là bằng chứng đỏ duy nhất.
      const selfRun = ctx?.kind === 'TOOLING' || INLINE_COMPLETE_RE.test(l);
      selfRunTdd = ctx?.tdd === 'có' && selfRun;
      if (selfRunTdd && evidence === l) return 'dòng Task <n>: complete của task TDD có do session chính làm phải có "red: <lệnh> exit <n khác 0>"';
    }
    if ((selfRunTdd || INLINE_COMPLETE_RE.test(l)) && !(INLINE_EVIDENCE_RE.test(evidence) && !EXIT_FAILED_RE.test(evidence))) {
      return 'dòng Task <n>: complete ở chế độ inline hoặc của task TDD có do session chính làm phải có "tests: <lệnh> exit 0" và không kèm exit khác 0';
    }
  }
  return null;
}

// Trả đường dẫn progress.md trong workspace của plan. Ledger cũ <thư mục plan>/.sdd/progress.md được chép sang một lần để plan đang dở
// không mất tiến độ; COPYFILE_EXCL để không bao giờ ghi đè ledger mới đã có, và giữ nguyên file cũ.
export function ledgerFile(planArg, deps = {}) {
  const ws = resolveWorkspace(planArg, deps);
  const fsx = { ...fs, ...deps.fs };
  const file = path.join(ws.dir, 'progress.md');
  const planDir = path.dirname(ws.plan);
  const src = path.join(planDir, '.sdd', 'progress.md');
  try {
    // Chỉ chép file thường nằm thật trong thư mục plan: symlink (vd tới .env) sẽ đưa bí mật vào .aip, rồi hook session-start nạp vào context.
    const rel = fsx.lstatSync(src).isFile() && path.relative(fsx.realpathSync(planDir), fsx.realpathSync(src));
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) fsx.copyFileSync(src, file, fs.constants.COPYFILE_EXCL);
  } catch (e) {
    if (e?.code !== 'ENOENT' && e?.code !== 'EEXIST') throw e;
  }
  return file;
}

// events.jsonl cạnh progress.md mang thời điểm của từng dòng cho `aip status`; progress.md giữ định dạng vì hook session-start đọc nó.
export function appendLedger(file, line, now = new Date()) {
  const text = line.replace(/\r?\n$/, '');
  fs.appendFileSync(file, `${text}\n`);
  const ts = now.toISOString();
  try {
    fs.appendFileSync(path.join(path.dirname(file), 'events.jsonl'), text.split(LINE_SPLIT).filter((l) => l.trim()).map((l) => `${JSON.stringify({ ts, line: l })}\n`).join(''));
  } catch (e) {
    // progress.md là nguồn sự thật và đã ghi xong; lỗi ở events.jsonl không được làm lệnh thất bại, vì ghi lại sẽ trùng dòng.
    console.error(`events.jsonl không ghi được: ${e.message}`);
  }
}

// null = không có gì để nạp lại: file không đọc được hoặc plan đã xong. Còn lại trả tối đa `max` ký tự cuối.
export function readTail(file, max) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
  if (DONE_RE.test(text)) return null;
  return text.slice(Math.max(0, text.length - max));
}

// Đọc plan trực tiếp, không qua resolveWorkspace, để dòng bị từ chối không tạo thư mục .aip; plan không đọc được hay không có task thì không có ctx.
function taskCtx(planArg, line) {
  const n = line.match(/^Task (\d+): complete\b/i)?.[1];
  if (!n) return undefined;
  try {
    const plan = fs.statSync(planArg).isDirectory() ? path.join(planArg, 'plan.md') : planArg;
    const task = extractTask(fs.readFileSync(plan, 'utf8'), Number(n));
    return task ? { tdd: effectiveTdd(task).value, kind: taskField(task, 'Kind') } : undefined;
  } catch { return undefined; }
}

export function main(argv, deps) {
  const [planArg, line] = argv;
  if (!planArg || line === undefined) {
    console.error('Cách dùng: ledger.mjs <plan.md|requestDir> "<dòng>"');
    return 2;
  }
  // Mỗi dòng mang số task của chính nó, nên ctx dựng theo từng dòng.
  // Dòng trống xen giữa (vd xuống dòng cuối) bỏ qua, nhưng cả đối số trống thì từ chối.
  const invalid = (line.trim() === '' ? [line] : line.split(LINE_SPLIT).filter((l) => l.trim())).map((l) => validateLine(l, taskCtx(planArg, l))).find(Boolean);
  if (invalid) {
    console.error(invalid);
    return 2;
  }
  const file = ledgerFile(planArg, deps);
  appendLedger(file, line);
  console.log(file);
  return 0;
}

const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
