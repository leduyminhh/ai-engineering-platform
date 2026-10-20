#!/usr/bin/env node
// Kiểm thư mục docs/requests/<ngày>-<slug>/: nguồn AC, ID AC, header plan.md, độ phủ AC bởi plan.md/tasks.md và AC nào chưa có test nhắc tới.
// Cách dùng: <thư-mục> [--tests <path>…] [--strict]. Chỉ cảnh báo; exit 1 chỉ khi --strict mà có cảnh báo, exit 2 khi sai đối số.
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const FILES = ['requirement.md', 'design.md', 'plan.md', 'tasks.md'];
const AC_SOURCES = ['requirement.md', 'design.md'];
const AC_ID_RE = /^AC\d+\.\d+$/;
const AC_ANY_RE = /AC\d+\.\d+/g;
const AC_HEADING = 'tiêu chí chấp nhận';
// Test đặt tên AC theo từng ngôn ngữ (AC1.1, ac1_1, testAc1_1) nên nhận cả '.' lẫn '_'; lookaround chặn AC1.10 khớp nhầm AC1.1.
const TEST_AC_RE = /(?<!\d)AC(\d+)[._](\d+)(?!\d)/gi;
const TEST_PATH_RE = /(^|\/)(test|tests|__tests__|spec)(\/|$)|\.(test|spec)\.[^/]+$|_test\.[^/]+$|(^|\/)test_[^/]+\.py$|Test\.java$/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'build', 'dist', 'target', '.venv']);

// Trả về mảng dòng đã chuẩn hóa; dòng trong khối ``` hoặc ~~~ thành '' để giữ nguyên số dòng gốc.
function linesOf(text) {
  const raw = text.replace(/^\uFEFF/, '').normalize('NFC').replace(/\r\n?/g, '\n').split('\n');
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

export function acIdsIn(text) {
  const ids = new Set();
  for (const m of text.matchAll(TEST_AC_RE)) ids.add(`AC${m[1]}.${m[2]}`);
  return ids;
}

// Vùng **Files:** = chính dòng đó + các dòng "- " liền sau; mục là test khi dòng "- Test:" hoặc đường dẫn khớp TEST_PATH_RE.
export function planTestPaths(planText) {
  const entries = [];
  const seen = new Set();
  let hasFiles = false;
  let inRegion = false;
  linesOf(planText).forEach((l, i) => {
    if (l.startsWith('**Files:**')) { hasFiles = true; inRegion = true; }
    else if (!inRegion || !/^\s*-\s/.test(l)) { inRegion = false; return; }
    const marked = /^\s*-\s*Test:/i.test(l);
    for (const m of l.matchAll(/`([^`]+)`/g)) {
      const p = m[1].trim().replace(/:\d+(-\d+)?$/, '');
      // Đoạn có khoảng trắng là lệnh (vd `npm test`), không phải đường dẫn.
      if (!p || /\s/.test(p) || seen.has(p) || !(marked || TEST_PATH_RE.test(p))) continue;
      seen.add(p);
      entries.push({ path: p, line: i + 1 });
    }
  });
  return { hasFiles, entries };
}

export function checkRequest(texts, { readTest, override } = {}) {
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

  // Chỉ chạy khi caller cấp readTest, để lời gọi cũ (chỉ truyền texts) giữ nguyên hành vi W1–W6.
  if (readTest) {
    const contents = [];
    let run = true;
    if (override) {
      for (const p of override) { const c = readTest(p); if (c !== null) contents.push(c); }
    } else {
      const { hasFiles, entries } = planTestPaths(texts['plan.md'] || '');
      run = entries.length > 0; // W8 đã nói thiếu file test; thêm W7 cho mọi AC chỉ gây nhiễu
      if (hasFiles && !entries.length) {
        const at = lines['plan.md'].findIndex((l) => l.startsWith('**Files:**'));
        warn('plan.md', at + 1, 'W8', 'plan.md không ghi file test nào trong **Files:**');
      }
      for (const e of entries) {
        const c = readTest(e.path);
        if (c === null) warn('plan.md', e.line, 'W9', `File test ${e.path} chưa tồn tại`);
        else contents.push(c);
      }
    }
    if (run) {
      const mentioned = new Set(contents.flatMap((c) => [...acIdsIn(c)]));
      for (const [id, at] of valid) if (!mentioned.has(id)) warn(at.file, at.line, 'W7', `${id} chưa có test nào nhắc tới`);
    }
  }
  return warnings;
}

// Gốc project = tổ tiên gần nhất có .git (file hay thư mục); path trong plan được resolve theo gốc này.
function projectRoot(dir) {
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.git'))) return d;
    if (path.dirname(d) === d) return process.cwd();
  }
}

// Trả '' cho file nhị phân hoặc đọc lỗi để không làm hỏng cả lượt kiểm; null chỉ khi path không tồn tại.
function readTestFrom(root) {
  const readFile = (p) => {
    try {
      const buf = fs.readFileSync(p);
      return buf.subarray(0, 8192).includes(0) ? '' : buf.toString('utf8');
    } catch { return ''; }
  };
  const readDir = (p) => {
    let ents;
    try { ents = fs.readdirSync(p, { withFileTypes: true }); } catch { return ''; }
    return ents.map((e) => {
      const q = path.join(p, e.name);
      if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? '' : readDir(q);
      return e.isFile() ? readFile(q) : '';
    }).join('\n');
  };
  return (rel) => {
    const p = path.resolve(root, rel);
    let st;
    try { st = fs.statSync(p); } catch { return null; }
    return st.isDirectory() ? readDir(p) : readFile(p);
  };
}

export function main(argv) {
  const usage = () => { console.error('Cách dùng: node check-request.mjs <thư-mục-request> [--tests <path>…] [--strict]'); return 2; };
  let dir;
  let strict = false;
  let tests;
  let collecting = false;
  let since = 0;
  for (const a of argv) {
    if (a === '--tests') {
      if (collecting && !since) return usage();
      tests ??= [];
      collecting = true;
      since = 0;
    } else if (a === '--strict') {
      if (collecting && !since) return usage();
      strict = true;
      collecting = false;
    } else if (a.startsWith('--')) return usage();
    else if (collecting) { tests.push(a); since++; }
    else if (dir === undefined) dir = a;
    else return usage();
  }
  if (dir === undefined || (collecting && !since)) return usage();
  const cwd = process.cwd();
  const override = tests?.map((p) => path.resolve(cwd, p));
  for (const p of override || []) {
    if (!fs.existsSync(p)) { console.error(`--tests: không tìm thấy ${p}`); return usage(); }
  }
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
  const warnings = checkRequest(texts, { readTest: readTestFrom(projectRoot(dir)), override });
  for (const w of warnings) console.log(`WARN ${w.file}:${w.line} [${w.code}] ${w.msg}`);
  console.log(`${warnings.length} cảnh báo`);
  return strict && warnings.length ? 1 : 0;
}

// realpath vì trên Windows skill được cài qua junction: argv[1] là đường dẫn junction còn import.meta.url là đường dẫn thật.
const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
