#!/usr/bin/env node
// Kiểm thư mục docs/requests/<ngày>-<slug>/: nguồn AC, ID AC, header plan.md và độ phủ AC bởi plan.md/tasks.md.
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì; chỉ cảnh báo, không chặn.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const FILES = ['requirement.md', 'design.md', 'plan.md', 'tasks.md'];
const AC_SOURCES = ['requirement.md', 'design.md'];
const AC_ID_RE = /^AC\d+\.\d+$/;
const AC_ANY_RE = /AC\d+\.\d+/g;
const AC_HEADING = 'tiêu chí chấp nhận';

// Trả về mảng dòng đã chuẩn hóa; dòng trong khối ``` hoặc ~~~ thành '' để giữ nguyên số dòng gốc.
function linesOf(text) {
  const raw = text.replace(/^﻿/, '').normalize('NFC').replace(/\r\n?/g, '\n').split('\n');
  let fenced = false;
  return raw.map((l) => {
    if (/^\s*(```|~~~)/.test(l)) { fenced = !fenced; return ''; }
    return fenced ? '' : l;
  });
}

// Mục AC: heading H2–H4 chứa "Tiêu chí chấp nhận", tới heading cùng cấp hoặc cao hơn.
function parseAcs(lines) {
  const acs = [];
  let level = 0;
  lines.forEach((l, i) => {
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const n = h[1].length;
      if (level && n <= level) level = 0;
      if (!level && n >= 2 && n <= 4 && h[2].toLowerCase().includes(AC_HEADING)) level = n;
      return;
    }
    if (!level) return;
    const m = l.match(/^\s*[-*]\s+(?:\[[ xX]\]\s*)?\*\*([^*]+)\*\*/);
    if (m) acs.push({ id: m[1].trim(), line: i + 1 });
  });
  return acs;
}

export function checkRequest(texts) {
  const warnings = [];
  const warn = (file, line, code, msg) => warnings.push({ file, line, code, msg });
  const lines = {};
  for (const f of FILES) if (typeof texts[f] === 'string') lines[f] = linesOf(texts[f]);

  const acsBy = Object.fromEntries(AC_SOURCES.filter((f) => lines[f]).map((f) => [f, parseAcs(lines[f])]));
  const sources = AC_SOURCES.filter((f) => acsBy[f]?.length);

  if (!sources.length) {
    warn(lines['design.md'] ? 'design.md' : 'requirement.md', 1, 'W1', 'Không có nguồn AC: cần mục "Tiêu chí chấp nhận" có AC trong requirement.md hoặc design.md');
  }
  if (sources.length > 1) {
    warn('design.md', acsBy['design.md'][0].line, 'W2', 'AC nằm ở cả requirement.md lẫn design.md; chỉ giữ ở một file');
  }

  const valid = new Map();
  for (const f of sources) {
    const seen = new Map();
    for (const ac of acsBy[f]) {
      if (!AC_ID_RE.test(ac.id)) {
        warn(f, ac.line, 'W4', `AC "${ac.id}" sai định dạng, cần AC<n>.<m> (vd AC1.1)`);
        continue;
      }
      if (seen.has(ac.id)) warn(f, ac.line, 'W3', `${ac.id} trùng với dòng ${seen.get(ac.id)}`);
      else seen.set(ac.id, ac.line);
      if (!valid.has(ac.id)) valid.set(ac.id, { file: f, line: ac.line });
    }
  }

  if (lines['plan.md']) {
    for (const field of ['Goal', 'Spec']) {
      if (!lines['plan.md'].some((l) => l.startsWith(`**${field}:**`))) {
        warn('plan.md', 1, 'W5', `plan.md thiếu dòng **${field}:**`);
      }
    }
  }

  if (lines['plan.md'] || lines['tasks.md']) {
    const covered = new Set();
    for (const l of lines['plan.md'] || []) if (l.startsWith('**Phủ AC:**')) for (const a of l.match(AC_ANY_RE) || []) covered.add(a);
    for (const l of lines['tasks.md'] || []) for (const a of l.match(AC_ANY_RE) || []) covered.add(a);
    for (const [id, at] of valid) {
      if (!covered.has(id)) warn(at.file, at.line, 'W6', `${id} chưa được task nào phủ (plan.md "**Phủ AC:**" hoặc tasks.md)`);
    }
  }
  return warnings;
}

export function main(argv) {
  const usage = () => { console.error('Cách dùng: node check-request.mjs <thư-mục-request>'); return 2; };
  if (argv.length !== 1) return usage();
  const dir = argv[0];
  try {
    if (!fs.statSync(dir).isDirectory()) throw new Error('không phải thư mục');
  } catch (e) {
    console.error(`Không đọc được thư mục ${dir}: ${e.message}`);
    return usage();
  }
  const texts = {};
  for (const f of FILES) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    try { texts[f] = fs.readFileSync(p, 'utf8'); } catch (e) { console.error(`Không đọc được ${p}: ${e.message}`); return 2; }
  }
  const warnings = checkRequest(texts);
  for (const w of warnings) console.log(`WARN ${w.file}:${w.line} [${w.code}] ${w.msg}`);
  console.log(`${warnings.length} cảnh báo`);
  return 0;
}

// realpath vì trên Windows skill được cài qua junction: argv[1] là đường dẫn junction còn import.meta.url là đường dẫn thật.
const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
