#!/usr/bin/env node
// Cắt một task khỏi plan.md ra file brief cho implementer.
// Cách dùng: <plan.md> <n> [--out <dir>] — ghi task-<n>-brief.md (mặc định <thư mục plan>/.sdd) và in đường dẫn. Exit 1 khi không có task, exit 2 khi sai đối số.
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ensureWorkspace } from './ledger.mjs';

// Nguyên văn từ `### Task <n>` tới heading #/##/### kế tiếp; heading trong khối ``` hoặc ~~~ không tính.
export function extractTask(planText, n) {
  const lines = planText.replace(/^﻿/, '').split(/\r?\n/);
  let fenced = false;
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fenced = !fenced; continue; }
    if (fenced) continue;
    if (start < 0) {
      const m = lines[i].match(/^###\s+Task\s+(\d+)\b/);
      if (m && Number(m[1]) === n) start = i;
    } else if (/^#{1,3}\s/.test(lines[i])) { end = i; break; }
  }
  if (start < 0) return null;
  const body = lines.slice(start, end);
  while (body.length && body[body.length - 1].trim() === '') body.pop();
  return `${body.join('\n')}\n`;
}

// Không import check-request.mjs vì khác skill; test 33-request-parts chạy chung bộ vector để hai bên không lệch.
const TDD_KINDS = ['BE', 'TOOLING'];

// Dòng **Kind:** / **TDD:** đầu tiên ngoài khối code (khớp cách check-request đọc plan).
function taskField(taskText, name) {
  let fenced = false;
  for (const l of taskText.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(l)) { fenced = !fenced; continue; }
    const m = !fenced && l.match(new RegExp(`^\\*\\*${name}:\\*\\*\\s*(.*)$`));
    if (m) return m[1].trim();
  }
  return undefined;
}

// TDD hiệu lực của task: giá trị plan ghi nếu hợp lệ với kind, ngược lại mặc định theo kind (BE = có, còn lại = không).
export function effectiveTdd(taskText) {
  const kind = taskField(taskText, 'Kind');
  const raw = taskField(taskText, 'TDD');
  const m = raw?.match(/^(có|không(?:\s*—\s*(\S.*))?)$/);
  if (m && (m[1] === 'có' ? TDD_KINDS.includes(kind) : m[2] !== undefined)) {
    return m[1] === 'có' ? { value: 'có', defaulted: false } : { value: 'không', reason: m[2].trim(), defaulted: false };
  }
  return { value: TDD_KINDS.includes(kind) ? 'có' : 'không', defaulted: true };
}

// Brief luôn có đúng một dòng TDD hiệu lực: dòng hợp lệ giữ tại chỗ; thiếu hoặc sai thì bỏ dòng sai và chèn mặc định
// ngay sau heading, để implementer không đọc phải dòng mâu thuẫn (W21 vẫn báo lỗi ở plan.md).
function withTddLine(taskText) {
  const eff = effectiveTdd(taskText);
  if (!eff.defaulted) return taskText;
  let fenced = false;
  const [heading, ...rest] = taskText.split('\n').filter((l) => {
    if (/^\s*(```|~~~)/.test(l)) fenced = !fenced;
    return fenced || !l.startsWith('**TDD:**');
  });
  return [heading, `**TDD:** ${eff.value} (mặc định theo kind)`, ...rest].join('\n');
}

export function main(argv) {
  const args = [...argv];
  const oi = args.indexOf('--out');
  let outDir = null;
  if (oi >= 0) { outDir = args[oi + 1]; args.splice(oi, 2); }
  const [planFile, nRaw] = args;
  const n = Number(nRaw);
  if (!planFile || !Number.isInteger(n) || n < 1 || (oi >= 0 && !outDir)) {
    console.error('Cách dùng: task-brief.mjs <plan.md> <n> [--out <dir>]');
    return 2;
  }
  const task = extractTask(fs.readFileSync(planFile, 'utf8'), n);
  if (task === null) {
    console.error(`Không có "### Task ${n}" trong ${planFile}`);
    return 1;
  }
  const dir = outDir ?? path.dirname(ensureWorkspace(path.dirname(path.resolve(planFile))));
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `task-${n}-brief.md`);
  fs.writeFileSync(out, withTddLine(task));
  console.log(out);
  return 0;
}

const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
