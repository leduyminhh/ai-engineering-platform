#!/usr/bin/env node
// Kiểm plan.md của docs/requests/<ngày>-<slug>/: task cùng nhóm **Song song:** không được ghi trùng file (P1) hay file chung (P2).
// Cách dùng: <thư-mục-request> [--strict]. Chọn tham gia: plan không có **Song song:** thì im. Chỉ cảnh báo; exit 1 chỉ khi --strict mà có cảnh báo, exit 2 khi sai đối số.
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { linesOf } from './check-request.mjs';

const TASK_RE = /^(#{2,4})\s+Task\s+(\d+)\b[\s:.—–-]*(.*)$/;
const GROUP_RE = /^\*\*Song song:\*\*(.*)$/;

// So không phân biệt hoa/thường vì plan viết trên Windows/macOS hay lệch hoa thường so với tên file thật.
export function normPath(p) {
  let s = p.trim().replace(/:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/, '').replace(/\\/g, '/');
  while (s.startsWith('./')) s = s.slice(2);
  return s.toLowerCase();
}

// Mục có '*' hoặc kết thúc bằng '/' là tiền tố; mục còn lại phải khớp nguyên đường dẫn.
const asPrefix = (p) => (p.includes('*') ? p.slice(0, p.indexOf('*')) : p.endsWith('/') ? p : null);

export function pathsOverlap(a, b) {
  const pa = asPrefix(a);
  const pb = asPrefix(b);
  if (pa === null && pb === null) return a === b;
  if (pa === null) return a.startsWith(pb);
  if (pb === null) return b.startsWith(pa);
  return pa.startsWith(pb) || pb.startsWith(pa);
}

// Vùng **Files:** = chính dòng đó + các dòng "- " liền sau; đoạn có khoảng trắng là lệnh, không phải đường dẫn.
export function parsePartition(planText) {
  const lines = linesOf(planText);
  const tasks = [];
  let cur = null;
  let level = 0;
  let inFiles = false;
  lines.forEach((l, i) => {
    const h = l.match(/^(#{1,6})\s/);
    if (h) {
      const t = l.match(TASK_RE);
      if (t) {
        cur = { n: Number(t[2]), title: t[3].trim(), line: i + 1, group: null, files: [] };
        level = t[1].length;
        tasks.push(cur);
      } else if (h[1].length <= level) cur = null;
      inFiles = false;
      return;
    }
    if (!cur) return;
    const g = l.match(GROUP_RE);
    if (g) { cur.group = g[1].trim().toLowerCase(); inFiles = false; return; }
    if (l.startsWith('**Files:**')) inFiles = true;
    else if (!inFiles || !/^\s*-\s/.test(l)) { inFiles = false; return; }
    for (const m of l.matchAll(/`([^`]+)`/g)) {
      const p = normPath(m[1]);
      if (p && !/\s/.test(p) && !cur.files.includes(p)) cur.files.push(p);
    }
  });
  return tasks;
}

const isShared = (p) => p.split('/').pop() === '.manifest.json' || p === 'plugins/_versions.lock.json' || p.startsWith('docs/specs/') || /^readme(_[a-z]+)?\.md$/.test(p);

export function checkPartition(planText) {
  const warnings = [];
  const tasks = parsePartition(planText).filter((t) => t.group);
  for (const t of tasks) {
    for (const f of t.files) {
      if (isShared(f)) warnings.push({ line: t.line, code: 'P2', msg: `Task ${t.n} (nhóm ${t.group}) ghi file chung ${f}; bước chạm file chung làm ở phiên chính sau khi gộp, không giao cho agent song song` });
    }
  }
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i];
      const b = tasks[j];
      if (a.group !== b.group) continue;
      const hit = a.files.flatMap((x) => b.files.filter((y) => pathsOverlap(x, y)).map((y) => (x === y ? x : `${x} ↔ ${y}`)))[0];
      if (hit) warnings.push({ line: b.line, code: 'P1', msg: `Task ${a.n} và Task ${b.n} cùng nhóm ${a.group} nhưng ghi trùng file ${hit}; tách file hoặc đổi nhóm` });
    }
  }
  return warnings.sort((x, y) => x.line - y.line);
}

export function main(argv) {
  const usage = () => { console.error('Cách dùng: node check-partition.mjs <thư-mục-request> [--strict]'); return 2; };
  let dir;
  let strict = false;
  for (const a of argv) {
    if (a === '--strict') strict = true;
    else if (a.startsWith('--')) return usage();
    else if (dir === undefined) dir = a;
    else return usage();
  }
  if (dir === undefined) return usage();
  try {
    if (!fs.statSync(dir).isDirectory()) throw new Error('không phải thư mục');
  } catch (e) {
    console.error(`Không đọc được thư mục ${dir}: ${e.message}`);
    return usage();
  }
  const p = path.join(dir, 'plan.md');
  let text = '';
  if (fs.existsSync(p)) {
    try { text = fs.readFileSync(p, 'utf8'); } catch (e) { console.error(`Không đọc được ${p}: ${e.message}`); return 2; }
  }
  const warnings = checkPartition(text);
  for (const w of warnings) console.log(`WARN plan.md:${w.line} [${w.code}] ${w.msg}`);
  console.log(`${warnings.length} cảnh báo`);
  return strict && warnings.length ? 1 : 0;
}

// realpath vì trên Windows skill được cài qua junction: argv[1] là đường dẫn junction còn import.meta.url là đường dẫn thật.
const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
