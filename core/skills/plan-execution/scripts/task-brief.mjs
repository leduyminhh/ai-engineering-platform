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
  fs.writeFileSync(out, task);
  console.log(out);
  return 0;
}

const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
