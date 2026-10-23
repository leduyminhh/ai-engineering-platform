#!/usr/bin/env node
// Kiểm thư mục docs/requests/<ngày>-<slug>/: nguồn AC, ID AC, header plan.md, độ phủ AC bởi plan.md/tasks.md, AC nào chưa có test nhắc tới và mục "Ảnh hưởng spec" của design.md (W10–W14).
// Cách dùng: <thư-mục> [--tests <path>…] [--base <ref>] [--strict]. --base <ref> bật W13 (spec bị ảnh hưởng chưa đổi kể từ ref). Chỉ cảnh báo; exit 1 chỉ khi --strict mà có cảnh báo, exit 2 khi sai đối số.
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
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
export function linesOf(text) {
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
      const p = m[1].trim().replace(/:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/, '');
      // Đoạn có khoảng trắng là lệnh (vd `npm test`), không phải đường dẫn.
      if (!p || /\s/.test(p) || seen.has(p) || !(marked || TEST_PATH_RE.test(p))) continue;
      seen.add(p);
      entries.push({ path: p, line: i + 1 });
    }
  });
  return { hasFiles, entries };
}

// Mục "Ảnh hưởng spec": heading H2 tới heading cùng cấp hoặc cao hơn; `lines` phải qua linesOf để bỏ khối code fence.
export function parseImpact(lines) {
  const res = { found: false, line: 0, none: null, entries: [] };
  let inside = false;
  lines.forEach((l, i) => {
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      if (h[1].length > 2) return;
      inside = h[1].length === 2 && h[2].toLowerCase().includes('ảnh hưởng spec');
      if (inside && !res.found) { res.found = true; res.line = i + 1; }
      return;
    }
    if (!inside) return;
    const none = l.match(/^\s*Không ảnh hưởng\s*:(.*)$/i);
    if (none) { res.none = { reason: none[1].trim() }; return; }
    const m = l.match(/^\s*[-*]\s+([^:\s][^:]*?)\s*:\s*(.*)$/);
    if (!m) return;
    const items = [...m[2].matchAll(/(thêm|đổi|bỏ)\s+R(\d+)/gi)].map((x) => ({ action: x[1].toLowerCase(), n: Number(x[2]) }));
    res.entries.push({ cap: m[1].replace(/^`+|`+$/g, ''), items, line: i + 1 });
  });
  return res;
}

// Ngày P7 (spec sống) thêm mục "Ảnh hưởng spec"; thư mục request dated trước ngày này không có mục đó nên không bị W10.
export const SPEC_SINCE = '2026-10-21';

// Vòng đời một request: token đầu của dòng "- Trạng thái:" trong design.md.
export const STATUSES = ['draft', 'approved', 'in-progress', 'merged', 'abandoned'];

const CAP_RE = /^[a-z0-9][a-z0-9-]*$/;
const REQ_ID_RE = /^[a-z0-9][a-z0-9-]*\/R[1-9]\d*$/;

// Đọc spec sống: yêu cầu nằm trong H2 "Yêu cầu"; link lấy toàn file vì bảng Lịch sử cũng trỏ về request. Dòng lạ (Cập nhật:, ghi chú) bị bỏ qua.
export function parseSpec(text, folder) {
  const lines = linesOf(text);
  const reqs = new Map();
  const problems = [];
  const links = [];
  let inReq = false;
  lines.forEach((l, i) => {
    const line = i + 1;
    for (const m of l.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (!/^#|^[a-z][a-z0-9+.-]*:/i.test(m[1])) links.push({ line, href: m[1] });
    }
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) { inReq = h[1].length === 2 && h[2].trim().toLowerCase() === 'yêu cầu'; return; }
    if (!inReq) return;
    const m = l.match(/^\s*[-*]\s+(~~)?\*\*([^*]+)\*\*/);
    if (!m) return;
    const id = m[2].trim();
    if (!REQ_ID_RE.test(id)) { problems.push({ line, msg: `ID "${id}" sai định dạng, cần <năng-lực>/R<n>` }); return; }
    if (id.split('/')[0] !== folder) problems.push({ line, msg: `ID "${id}" có tiền tố khác tên thư mục "${folder}"` });
    if (reqs.has(id)) { problems.push({ line, msg: `ID "${id}" trùng với dòng ${reqs.get(id).line}` }); return; }
    reqs.set(id, { line, removed: !!m[1] && l.includes('đã bỏ bởi') });
  });
  return { reqs, problems, links };
}

export function checkRequest(texts, { readTest, override, readSpec, linkExists, changedSpecs, legacy } = {}) {
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
      if (hasFiles && !entries.length) {
        const at = lines['plan.md'].findIndex((l) => l.startsWith('**Files:**'));
        warn('plan.md', at + 1, 'W8', 'plan.md không ghi file test nào trong **Files:**');
      }
      for (const e of entries) {
        const c = readTest(e.path);
        if (c === null) warn('plan.md', e.line, 'W9', `File test ${e.path} chưa tồn tại`);
        else contents.push(c);
      }
      // W8/W9 đã báo thiếu file test; lúc lập plan test chưa có nên W7 cho mọi AC chỉ gây nhiễu (và không được xoá **Files:** để im).
      run = contents.length > 0;
    }
    if (run) {
      const mentioned = new Set(contents.flatMap((c) => [...acIdsIn(c)]));
      for (const [id, at] of valid) if (!mentioned.has(id)) warn(at.file, at.line, 'W7', `${id} chưa có test nào nhắc tới`);
    }
  }

  // Chỉ chạy khi caller cấp readSpec, để lời gọi cũ giữ nguyên hành vi W1–W9.
  if (readSpec && lines['design.md']) {
    const imp = parseImpact(lines['design.md']);
    if (legacy === true) { /* thư mục request cũ: miễn W10 */ } else if (!imp.found) warn('design.md', 1, 'W10', 'design.md thiếu mục "## Ảnh hưởng spec" (liệt kê năng lực bị ảnh hưởng hoặc "Không ảnh hưởng: <lý do>")');
    else if (!imp.entries.length && !imp.none?.reason) warn('design.md', imp.line, 'W10', 'Mục "Ảnh hưởng spec" cần ít nhất một dòng "- <năng-lực>: thêm|đổi|bỏ R<n>" hoặc "Không ảnh hưởng: <lý do>" với lý do không rỗng');
    // Mỗi spec đọc và kiểm W14 một lần dù nhiều mục nhắc tới; tên sai định dạng không bao giờ tới readSpec để không đọc ngoài docs/specs.
    const cache = new Map();
    const load = (cap) => {
      if (cache.has(cap)) return cache.get(cap);
      const text = readSpec(cap);
      const spec = typeof text === 'string' ? parseSpec(text, cap) : null;
      cache.set(cap, spec);
      if (spec) {
        const file = `specs/${cap}/spec.md`;
        for (const p of spec.problems) warn(file, p.line, 'W14', p.msg);
        if (linkExists) for (const k of spec.links) if (!linkExists(k.href.replace(/[#?].*$/, ''), cap)) warn(file, k.line, 'W14', `Link "${k.href}" không tồn tại`);
      }
      return spec;
    };
    const staleReported = new Set();
    for (const e of imp.entries) {
      if (!CAP_RE.test(e.cap)) { warn('design.md', e.line, 'W11', `Tên năng lực "${e.cap}" không hợp lệ, cần khớp ^[a-z0-9][a-z0-9-]*$`); continue; }
      const spec = load(e.cap);
      if (!spec) { warn('design.md', e.line, 'W11', `Không có spec cho năng lực "${e.cap}" (docs/specs/${e.cap}/spec.md)`); continue; }
      // Chỉ chạy khi caller cấp changedSpecs (null = không có git/base ref hợp lệ → bỏ qua).
      if (changedSpecs && !changedSpecs.has(e.cap) && !staleReported.has(e.cap) && staleReported.add(e.cap)) warn('design.md', e.line, 'W13', `Năng lực "${e.cap}" được khai báo bị ảnh hưởng nhưng docs/specs/${e.cap}/spec.md chưa đổi kể từ base ref`);
      for (const it of e.items) {
        if (it.action === 'thêm') continue;
        const id = `${e.cap}/R${it.n}`;
        const r = spec.reqs.get(id);
        if (!r) warn('design.md', e.line, 'W12', `${it.action} R${it.n}: spec không có ${id}`);
        else if (it.action === 'bỏ' && !r.removed) warn('design.md', e.line, 'W12', `bỏ R${it.n}: ${id} chưa được gạch ngang kèm "đã bỏ bởi" trong spec`);
      }
    }
  }
  // Chỉ kiểm khi design.md có dòng "- Trạng thái:" để design cũ (không có dòng này) không bị cảnh báo hàng loạt.
  if (lines['design.md']) {
    const at = lines['design.md'].findIndex((l) => /^-\s+Trạng thái\s*:/.test(l));
    if (at >= 0) {
      const status = lines['design.md'][at].replace(/^-\s+Trạng thái\s*:\s*/, '').split(/[\s—–]/)[0].toLowerCase();
      if (!STATUSES.includes(status)) warn('design.md', at + 1, 'W15', `Trạng thái "${status}" không hợp lệ, cần một trong: ${STATUSES.join(' | ')}`);
      else if ((status === 'merged' || status === 'abandoned') && typeof texts['plan.md'] === 'string') warn('plan.md', 1, 'W16', `Request đã ${status}: xoá plan.md (checklist thực thi, không còn giá trị)`);
    }
  }
  return warnings;
}

// Gốc project = tổ tiên gần nhất có .git (file hay thư mục); path trong plan được resolve theo gốc này.
function projectRoot(dir, fallback = process.cwd()) {
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.git'))) return d;
    if (path.dirname(d) === d) return fallback;
  }
}

// Tập năng lực có <specsDir>/<cap>/spec.md đổi (kể cả file mới chưa track) kể từ ref; mọi lỗi git → null để W13 im lặng.
// Pathspec lấy theo specsDir thật (readSpec cũng resolve ở đó) nên bố cục lồng repo/pkg/docs/... không bị W13 giả.
function changedSpecsSince(dir, ref, specsDir) {
  const root = projectRoot(dir, null);
  if (!root) return null;
  const rel = path.relative(root, specsDir).split(path.sep).join('/');
  if (!rel || rel.startsWith('..')) return null;
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    const out = (...args) => git(...args).split(/\r?\n/);
    const names = [...out('diff', '--name-only', ref, '--', rel), ...out('ls-files', '--others', '--exclude-standard', '--', rel)];
    const caps = new Set();
    const prefix = `${rel}/`;
    for (const n of names) {
      const p = n.trim();
      const m = p.startsWith(prefix) && p.slice(prefix.length).match(/^([^/]+)\/spec\.md$/);
      if (m) caps.add(m[1]);
    }
    return caps;
  } catch { return null; }
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
  const usage = () => { console.error('Cách dùng: node check-request.mjs <thư-mục-request> [--tests <path>…] [--base <ref>] [--strict]'); return 2; };
  let dir;
  let strict = false;
  let tests;
  let collecting = false;
  let since = 0;
  let base;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') {
      if (collecting && !since) return usage();
      collecting = false;
      // ref không được bắt đầu bằng '-' để git không đọc nó như một option.
      const v = argv[++i];
      if (v === undefined || v === '' || v.startsWith('-') || base !== undefined) return usage();
      base = v;
    } else if (a === '--tests') {
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
  const specsDir = path.resolve(dir, '..', '..', 'specs');
  const readSpec = (cap) => {
    const p = path.resolve(specsDir, cap, 'spec.md');
    if (path.relative(specsDir, p).startsWith('..')) return null;
    try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
  };
  const linkExists = (href, cap) => fs.existsSync(path.resolve(specsDir, cap, href));
  // Thư mục không có tiền tố ngày coi là cũ (không rõ tuổi thì không cảnh báo).
  const dated = path.basename(path.resolve(dir)).match(/^(\d{4}-\d{2}-\d{2})-/);
  const legacy = !dated || dated[1] < SPEC_SINCE;
  const warnings = checkRequest(texts, { legacy, readTest: readTestFrom(projectRoot(dir)), override, readSpec, linkExists, changedSpecs: base === undefined ? null : changedSpecsSince(dir, base, specsDir) });
  for (const w of warnings) console.log(`WARN ${w.file}:${w.line} [${w.code}] ${w.msg}`);
  console.log(`${warnings.length} cảnh báo`);
  return strict && warnings.length ? 1 : 0;
}

// realpath vì trên Windows skill được cài qua junction: argv[1] là đường dẫn junction còn import.meta.url là đường dẫn thật.
const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
