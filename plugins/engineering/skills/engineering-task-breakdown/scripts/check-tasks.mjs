#!/usr/bin/env node
// Kiểm tasks.md do skill engineering-task-breakdown sinh và xuất CSV cho Excel.
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ID_RE = /^UC\d{2}-(CT|DB|BE|FE|E2E)-\d{2}$/;
const PREFIX_TYPES = { CT: ['CT'], DB: ['DB'], BE: ['BE'], FE: ['FE-UI', 'FE-INT'], E2E: ['E2E'] };
const SUMMARY_COLS = ['ID', 'UC', 'Loại', 'Tiêu đề', 'Size', 'Phụ thuộc', 'Owner', 'Trạng thái', 'Skill gợi ý'];
export const CSV_COLS = [...SUMMARY_COLS, 'AC', 'Link chi tiết'];
const AC_RE = /AC\d+\.\d+/g;
const NO_DEP = new Set(['', '—', '-']);
// Phụ thuộc tối thiểu theo SKILL.md bước 3; chỉ cảnh báo vì bảng chuẩn cho phép thêm phụ thuộc có lý do.
const MIN_DEPS = { BE: ['CT', 'DB'], 'FE-INT': ['CT', 'FE-UI'], E2E: ['BE', 'FE-INT'] };

const cellsOf = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const linkText = (cell) => {
  const m = cell.match(/^\[([^\]]+)\]\([^)]*\)$/);
  return m ? m[1] : cell;
};

function sections(lines) {
  const out = [];
  lines.forEach((l, i) => {
    const m = l.match(/^## (.+)$/);
    if (m) out.push({ title: m[1].toLowerCase(), start: i + 1, end: lines.length });
  });
  for (let i = 0; i < out.length - 1; i++) out[i].end = out[i + 1].start - 1;
  return out;
}

function table(lines, sec) {
  if (!sec) return null;
  let i = sec.start;
  while (i < sec.end && !lines[i].trim().startsWith('|')) i++;
  if (i >= sec.end) return null;
  const header = cellsOf(lines[i]);
  const rows = [];
  for (let j = i + 2; j < sec.end && lines[j].trim().startsWith('|'); j++) {
    const cells = cellsOf(lines[j]);
    rows.push({ line: j + 1, get: (name) => { const k = header.indexOf(name); return k < 0 ? '' : (cells[k] ?? ''); } });
  }
  return { header, line: i + 1, rows };
}

export function parseTasks(text) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const secs = sections(lines);
  // Tìm mục theo tên heading thay vì số thứ tự vì agent có thể đánh số lại các mục H2.
  const find = (kw) => secs.find((s) => s.title.includes(kw));
  const ucTable = table(lines, find('use case'));
  const sumTable = table(lines, find('bảng tổng task'));
  const detSec = find('chi tiết task');
  const useCases = ucTable
    ? ucTable.rows.map((r) => ({ id: r.get('ID'), acs: r.get('AC').match(AC_RE) || [], line: r.line }))
    : [];
  const tasks = sumTable
    ? sumTable.rows.map((r) => {
      const depCell = r.get('Phụ thuộc');
      return {
        id: linkText(r.get('ID')),
        type: r.get('Loại'),
        size: r.get('Size'),
        deps: NO_DEP.has(depCell) ? [] : depCell.split(',').map((d) => linkText(d.trim())).filter(Boolean),
        cells: Object.fromEntries(SUMMARY_COLS.map((c) => [c, r.get(c)])),
        line: r.line,
      };
    })
    : [];
  const details = [];
  if (detSec) {
    let anchor = null;
    let cur = null;
    for (let i = detSec.start; i < detSec.end; i++) {
      const l = lines[i];
      const a = l.match(/^<a id="([^"]*)"><\/a>\s*$/);
      if (a) { anchor = a[1]; continue; }
      const h = l.match(/^### (\S+)\s+[—-]\s+/);
      if (h) {
        cur = { id: h[1], anchor, line: i + 1, acs: [], acTexts: [], b: new Set(), f: new Set() };
        details.push(cur);
        anchor = null;
        continue;
      }
      if (!cur) continue;
      const ac = l.match(/^\s*- \[[ xX]\] (AC\d+\.\d+.*)$/);
      if (ac) {
        cur.acs.push(ac[1].match(/^AC\d+\.\d+/)[0]);
        cur.acTexts.push(ac[1].trim());
        continue;
      }
      const item = l.match(/\*\*([BF])(\d+)\. /);
      if (item) cur[item[1].toLowerCase()].add(Number(item[2]));
    }
  }
  return {
    sections: { useCase: !!ucTable, summary: !!sumTable, detail: !!detSec },
    summaryHeader: sumTable ? sumTable.header : [],
    summaryLine: sumTable ? sumTable.line : 1,
    useCases,
    tasks,
    details,
  };
}

export function checkTasks(model) {
  const errors = [];
  const warnings = [];
  const err = (code, line, msg) => errors.push({ code, line, msg });
  const warn = (code, line, msg) => warnings.push({ code, line, msg });
  if (!model.sections.useCase) err('E7', 1, 'Thiếu mục H2 "Use case" có bảng');
  if (!model.sections.summary) err('E3', 1, 'Thiếu mục H2 "Bảng tổng task" có bảng');
  if (!model.sections.detail) err('E3', 1, 'Thiếu mục H2 "Chi tiết task"');
  const missingCols = model.sections.summary ? SUMMARY_COLS.filter((c) => !model.summaryHeader.includes(c)) : [];
  if (missingCols.length) err('E9', model.summaryLine, `Bảng tổng task thiếu cột: ${missingCols.join(', ')}`);

  const byId = new Map();
  for (const t of model.tasks) {
    const m = t.id.match(ID_RE);
    if (!m) err('E1', t.line, `ID "${t.id}" sai dạng UC<nn>-<CT|DB|BE|FE|E2E>-<nn>`);
    else if (!PREFIX_TYPES[m[1]].includes(t.type)) err('E1', t.line, `${t.id}: Loại "${t.type}" không khớp tiền tố ${m[1]}`);
    if (byId.has(t.id)) err('E2', t.line, `${t.id} trùng với dòng ${byId.get(t.id).line}`);
    else byId.set(t.id, t);
    for (const c of SUMMARY_COLS) {
      if (c !== 'Owner' && model.summaryHeader.includes(c) && !t.cells[c]) err('E9', t.line, `${t.id}: ô "${c}" trống`);
    }
    if (t.size === 'L') err('E6', t.line, `${t.id}: size L — buộc tách thành task S/M`);
    else if (t.size && !['S', 'M'].includes(t.size)) err('E6', t.line, `${t.id}: size "${t.size}" phải là S hoặc M`);
  }

  const detById = new Map();
  for (const d of model.details) {
    if (detById.has(d.id)) err('E3', d.line, `${d.id}: mục chi tiết lặp lại`);
    detById.set(d.id, d);
    if (!byId.has(d.id)) err('E3', d.line, `${d.id}: có mục chi tiết nhưng không có trong Bảng tổng task`);
    if (d.anchor !== d.id.toLowerCase()) err('E3', d.line, `${d.id}: cần <a id="${d.id.toLowerCase()}"></a> ngay trên heading`);
  }
  if (model.sections.detail) {
    for (const t of byId.values()) {
      if (!detById.has(t.id)) err('E3', t.line, `${t.id}: thiếu mục chi tiết "### ${t.id} — …"`);
    }
  }

  for (const t of byId.values()) {
    for (const d of t.deps) if (!byId.has(d)) err('E4', t.line, `${t.id} phụ thuộc ${d} không tồn tại`);
  }
  const state = new Map();
  const stack = [];
  const visit = (id) => {
    state.set(id, 1);
    stack.push(id);
    for (const d of byId.get(id).deps) {
      if (!byId.has(d)) continue;
      if (state.get(d) === 1) err('E5', byId.get(id).line, `Vòng phụ thuộc: ${[...stack.slice(stack.indexOf(d)), d].join(' → ')}`);
      else if (!state.has(d)) visit(d);
    }
    stack.pop();
    state.set(id, 2);
  };
  for (const id of byId.keys()) if (!state.has(id)) visit(id);

  const ucAcs = new Set(model.useCases.flatMap((u) => u.acs));
  const covered = new Set(model.details.flatMap((d) => d.acs));
  for (const u of model.useCases) {
    for (const a of u.acs) if (!covered.has(a)) err('E7', u.line, `${a} (${u.id}) chưa được task nào phủ`);
  }
  for (const d of model.details) {
    if (!d.acs.length) err('E8', d.line, `${d.id}: không có AC nào (dòng "- [ ] AC<uc>.<n> — …")`);
    for (const a of d.acs) if (!ucAcs.has(a)) err('E8', d.line, `${d.id}: ${a} không có trong bảng Use case`);
    const t = byId.get(d.id);
    const need = !t ? null : t.type === 'BE' ? ['b', 'B', 10] : ['FE-UI', 'FE-INT'].includes(t.type) ? ['f', 'F', 9] : null;
    if (need) {
      const miss = Array.from({ length: need[2] }, (_, i) => i + 1).filter((n) => !d[need[0]].has(n));
      if (miss.length) err('E9', d.line, `${d.id}: thiếu mục ${miss.map((n) => need[1] + n).join(', ')}`);
    }
  }

  for (const t of byId.values()) {
    const uc = t.id.slice(0, 4);
    const sameUc = [...byId.values()].filter((o) => o.id.slice(0, 4) === uc);
    for (const req of MIN_DEPS[t.type] || []) {
      const cands = sameUc.filter((o) => o.type === req);
      if (cands.length && !cands.some((o) => t.deps.includes(o.id))) {
        warn('W1', t.line, `${t.id} (${t.type}) nên phụ thuộc task ${req} của ${uc}: ${cands.map((o) => o.id).join(', ')}`);
      }
    }
    if (t.type === 'FE-UI') {
      const ct = t.deps.filter((d) => byId.get(d)?.type === 'CT');
      if (ct.length) warn('W2', t.line, `${t.id} (FE-UI) không nên chờ CT: ${ct.join(', ')}`);
    }
  }
  const byLine = (a, b) => a.line - b.line;
  return { errors: errors.sort(byLine), warnings: warnings.sort(byLine) };
}

const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function toCsv(model) {
  const det = new Map(model.details.map((d) => [d.id, d]));
  const rows = model.tasks.map((t) => [
    ...SUMMARY_COLS.map((c) => (c === 'ID' ? t.id : c === 'Phụ thuộc' ? (t.deps.join(', ') || '—') : t.cells[c])),
    (det.get(t.id)?.acTexts || []).join('\n'),
    `tasks.md#${t.id.toLowerCase()}`,
  ]);
  // BOM để Excel trên Windows đọc đúng UTF-8 (dấu tiếng Việt); CRLF theo RFC 4180.
  return '\uFEFF' + [CSV_COLS, ...rows].map((r) => r.map(quote).join(',')).join('\r\n') + '\r\n';
}

function main(argv) {
  const usage = () => { console.error('Cách dùng: node check-tasks.mjs <tasks.md> [--csv <out.csv>]'); return 2; };
  let file = null;
  let csv = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--csv') { csv = argv[++i]; if (!csv) return usage(); }
    else if (!file) file = argv[i];
    else return usage();
  }
  if (!file) return usage();
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { console.error(`Không đọc được ${file}: ${e.message}`); return 2; }
  const model = parseTasks(text);
  const { errors, warnings } = checkTasks(model);
  const name = path.basename(file);
  for (const p of [...errors, ...warnings]) console.log(`${name}:${p.line}: [${p.code}] ${p.msg}`);
  console.log(`${errors.length} lỗi, ${warnings.length} cảnh báo, ${model.tasks.length} task`);
  if (errors.length) {
    if (csv) console.log('Không ghi CSV vì còn lỗi.');
    return 1;
  }
  if (csv) { fs.writeFileSync(csv, toCsv(model)); console.log(`Đã ghi ${csv}`); }
  return 0;
}

// realpath vì trên Windows skill được cài qua junction: argv[1] là đường dẫn junction còn import.meta.url là đường dẫn thật.
const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
