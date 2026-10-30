#!/usr/bin/env node
// Kiểm docs/requests/<ngày>-<slug>/: part cùng nhãn cột Song song của Bảng part không được ghi trùng file (P1), file chung (P2) hay Consumes thứ part cùng nhóm Produces (P4); plan còn **Song song:** cấp task thì báo P3 (đã bỏ). Part có Trạng thái `bỏ` không tham gia P1/P2/P4.
// Cách dùng: <thư-mục-request> [--strict]. Chọn tham gia: request không có Bảng part và plan không có **Song song:** thì im. Chỉ cảnh báo; exit 1 chỉ khi --strict mà có cảnh báo, exit 2 khi sai đối số.
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { linesOf, parsePartTable } from './check-request.mjs';

const TASK_RE = /^(#{2,4})\s+Task\s+(\d+)\b[\s:.—–-]*(.*)$/;
const GROUP_RE = /^\*\*Song song:\*\*(.*)$/;

// So không phân biệt hoa/thường vì plan viết trên Windows/macOS hay lệch hoa thường so với tên file thật.
export function normPath(p) {
  let s = p.trim().replace(/:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/, '').replace(/\\/g, '/');
  while (s.startsWith('./')) s = s.slice(2);
  return s.toLowerCase();
}

// Mục có '*' hoặc kết thúc bằng '/' là tiền tố; mục còn lại phải khớp nguyên đường dẫn.
// Glob bắt đầu bằng '*' (vd **/x.test.js) có tiền tố rỗng nên trùng mọi đường dẫn: chấp nhận dương tính giả vì chỉ là cảnh báo.
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
// Vùng **Interfaces:** = các dòng "- Consumes:"/"- Produces:" (kèm dòng thụt vào nối tiếp); chỉ lấy tên trong backtick.
export function parsePartition(planText) {
  const lines = linesOf(planText);
  const tasks = [];
  let cur = null;
  let level = 0;
  let inFiles = false;
  let inIface = false;
  let mode = null;
  lines.forEach((l, i) => {
    const h = l.match(/^(#{1,6})\s/);
    if (h) {
      const t = l.match(TASK_RE);
      if (t) {
        cur = { n: Number(t[2]), title: t[3].trim(), line: i + 1, group: null, groupLine: 0, files: [], consumes: new Set(), produces: new Set() };
        level = t[1].length;
        tasks.push(cur);
      } else if (h[1].length <= level) cur = null;
      inFiles = false;
      inIface = false;
      return;
    }
    if (!cur) return;
    const g = l.match(GROUP_RE);
    if (g) { cur.group = g[1].trim().toLowerCase(); cur.groupLine = i + 1; inFiles = false; inIface = false; return; }
    if (l.startsWith('**Interfaces:**')) { inIface = true; mode = null; inFiles = false; return; }
    if (inIface) {
      const b = l.match(/^-\s+(Consumes|Produces):(.*)$/i);
      if (b) mode = b[1].toLowerCase();
      else if (!/^\s+\S/.test(l)) inIface = false;
      if (inIface) {
        if (mode) for (const m of (b ? b[2] : l).matchAll(/`([^`]+)`/g)) cur[mode].add(m[1].trim());
        return;
      }
    }
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

// Tập file/interface của part = hợp mọi task trong parts/<part>/plan.md; part thiếu plan.md có tập rỗng (W19 lo phần lệch thư mục).
const partInfo = (planText) => {
  const tasks = typeof planText === 'string' ? parsePartition(planText) : [];
  const union = (k) => [...new Set(tasks.flatMap((t) => [...t[k]]))];
  return { files: union('files'), consumes: union('consumes'), produces: union('produces') };
};

// input: { design?, plan?, parts?: { '<nn>-<slug>': planText } } (text thô). Cảnh báo: { file, line, code, msg }.
export function checkPartition({ design, plan, parts = {} } = {}) {
  const warnings = [];
  const plans = [['plan.md', plan], ...Object.entries(parts).map(([n, t]) => [`parts/${n}/plan.md`, t])];
  for (const [file, text] of plans) {
    if (typeof text !== 'string') continue;
    for (const t of parsePartition(text).filter((x) => x.group)) {
      warnings.push({ file, line: t.groupLine, code: 'P3', msg: `Task ${t.n} còn dòng **Song song:** cấp task, đã bỏ; khai nhóm song song ở cột Song song của Bảng part` });
    }
  }
  const table = typeof design === 'string' ? parsePartTable(design) : null;
  // Part bỏ không chạy nên không đụng ai; hàng trùng tên (W19 đã báo) chỉ lấy hàng đầu để part không bị so với chính nó.
  const seen = new Set();
  const rows = (table?.rows ?? []).filter((r) => r.group && r.status !== 'bỏ' && !seen.has(r.part) && seen.add(r.part))
    .map((r) => ({ ...r, group: r.group.toLowerCase(), ...partInfo(parts[r.part]) }));
  const at = (r, code, msg) => warnings.push({ file: 'design.md', line: r.line, code, msg });
  for (const r of rows) {
    for (const f of r.files.filter(isShared)) at(r, 'P2', `Part ${r.part} (nhóm ${r.group}) ghi file chung ${f}; bước chạm file chung làm ở phiên chính sau khi gộp, không giao cho agent song song`);
  }
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (a.group !== b.group) continue;
      const hit = a.files.flatMap((x) => b.files.filter((y) => pathsOverlap(x, y)).map((y) => (x === y ? x : `${x} ↔ ${y}`)))[0];
      if (hit) at(b, 'P1', `Part ${a.part} và Part ${b.part} cùng nhóm ${a.group} nhưng ghi trùng file ${hit}; tách file hoặc đổi nhóm`);
      // Chỉ Consumes↔Produces: hai part cùng Consumes (hoặc cùng Produces) một tên chung như `string` không phải phụ thuộc.
      for (const [c, p] of [[a, b], [b, a]]) {
        const names = c.consumes.filter((x) => p.produces.includes(x));
        if (names.length) at(c, 'P4', `Part ${c.part} Consumes ${names.map((x) => `\`${x}\``).join(', ')} mà Part ${p.part} cùng nhóm ${c.group} Produces; part dùng interface của part khác phải khai Phụ thuộc và chạy sau, không cùng nhóm`);
      }
    }
  }
  return warnings.sort((x, y) => (x.file === y.file ? x.line - y.line : x.file < y.file ? -1 : 1));
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
  const read = (p) => {
    if (!fs.existsSync(p)) return undefined;
    try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`Không đọc được ${p}: ${e.message}`); }
  };
  let input;
  try {
    const partsDir = path.join(dir, 'parts');
    const names = fs.existsSync(partsDir) ? fs.readdirSync(partsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];
    input = { design: read(path.join(dir, 'design.md')), plan: read(path.join(dir, 'plan.md')), parts: Object.fromEntries(names.map((n) => [n, read(path.join(partsDir, n, 'plan.md'))])) };
  } catch (e) { console.error(e.message); return 2; }
  const warnings = checkPartition(input);
  for (const w of warnings) console.log(`WARN ${w.file}:${w.line} [${w.code}] ${w.msg}`);
  console.log(`${warnings.length} cảnh báo`);
  return strict && warnings.length ? 1 : 0;
}

// realpath vì trên Windows skill được cài qua junction: argv[1] là đường dẫn junction còn import.meta.url là đường dẫn thật.
const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
