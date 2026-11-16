#!/usr/bin/env node
// Kiểm kê module của một project có sẵn từ build file. Zero-dependency.
// Cách dùng: node inventory-modules.mjs <gốc project> [--format json|table]. Exit 0 xong, 2 sai đối số.
// Chỉ mở build file (lấy tên, phụ thuộc) và file nguồn (đếm dòng); không mở file cấu hình, không in nội dung file.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SRC_EXT = new Set(['java', 'kt', 'groovy', 'scala', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'go', 'cs', 'rs', 'rb', 'php', 'vue', 'sql']);
const SKIP_DIRS = new Set(['node_modules', 'target', 'build', 'dist', '.git', '.aip', '.venv', 'venv', '__pycache__', '.gradle', 'out', 'vendor']);
const MAX_BUILD_BYTES = 1 << 20;
const TEST_DIRS = new Set(['test', 'tests', '__tests__']);
const PK_FILES = ['project-overview.md', 'architecture.md', 'source-structure.md', 'tech-stack.yml'];
// shortcut: build file nằm dưới các thư mục này bị coi là fixture, không phải module; nâng cấp khi gặp project đặt module ở đó.
const FIXTURE_DIRS = new Set(['src', 'test', 'tests', 'fixtures']);

// Symlink bỏ qua: git ls-files liệt kê cả symlink đã track, readFileSync đi theo link ra ngoài gốc.
const read = (root, rel) => {
  try {
    const abs = path.join(root, rel);
    return fs.lstatSync(abs).isFile() ? fs.readFileSync(abs, 'utf8') : '';
  } catch { return ''; }
};
const isRegular = (root, rel) => { try { return fs.lstatSync(path.join(root, rel)).isFile(); } catch { return false; } };
// Build file quá lớn không đọc: regex trên chuỗi cỡ này chậm và file đó không phải build file thật.
function readBuild(root, rel, notes) {
  try {
    if (fs.lstatSync(path.join(root, rel)).size > MAX_BUILD_BYTES) {
      notes.push(`${rel}: build file lớn hơn 1 MB, bỏ qua; kiểm kê tay ở cổng 1.`);
      return '';
    }
  } catch { return ''; }
  return read(root, rel);
}
// id, tên phụ thuộc và thư mục đi vào bảng markdown và prompt subagent: bỏ ký tự điều khiển và `|`, cắt 100 ký tự.
const clean = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f|]/g, '').slice(0, 100);
// Bỏ từng khối open...close bằng indexOf (regex lười bậc hai khi có nhiều open không đóng); open không đóng thì giữ nguyên phần còn lại.
function stripBlocks(text, open, close) {
  let out = ''; let i = 0;
  for (;;) {
    const a = text.indexOf(open, i);
    const b = a < 0 ? -1 : text.indexOf(close, a + open.length);
    if (b < 0) return out + text.slice(i);
    out += text.slice(i, a);
    i = b + close.length;
  }
}
const dirOf = (rel) => (path.posix.dirname(rel) === '.' ? '.' : path.posix.dirname(rel));

// git ls-files chạy ở cwd=gốc chỉ liệt kê file dưới gốc (đường dẫn tương đối gốc), nên phạm vi thư mục con vẫn dùng được git và tôn trọng .gitignore.
// fsmonitor tắt vì config của repo được quét không được phép chạy lệnh ngoài; mỗi file đếm một lần (không dùng glob).
const GIT = ['-c', 'core.fsmonitor=false'];
function listFiles(root) {
  let files = null;
  try {
    execFileSync('git', [...GIT, 'rev-parse', '--is-inside-work-tree'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] });
    // -z: không có thì git bọc nháy và escape octal tên file không ASCII, đếm sai file và thư mục tiếng Việt.
    files = execFileSync('git', [...GIT, 'ls-files', '-z', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 })
      .split('\0').filter((f) => f && isRegular(root, f)); // -c liệt kê cả file đã xoá khỏi cây làm việc; symlink bị loại như ở chế độ walk
  } catch { files = null; }
  if (!files) {
    files = [];
    const walk = (dir) => {
      let entries = [];
      try { entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const rel = dir ? `${dir}/${e.name}` : e.name;
        if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(rel); } else if (e.isFile()) files.push(rel);
      }
    };
    walk('');
  }
  return [...new Set(files.map((f) => f.split(path.sep).join('/')))].filter((f) => !f.split('/').some((s) => SKIP_DIRS.has(s)));
}

const isFixture = (rel) => rel.split('/').slice(0, -1).some((s) => FIXTURE_DIRS.has(s));
const isTest = (rel) => rel.split('/').some((s, i, a) => i < a.length - 1 && TEST_DIRS.has(s))
  || /\.(test|spec)\.[^.]+$/.test(rel) || /(^|\/)test_[^/]*\.py$/.test(rel);

function mavenInfo(text) {
  const xml = stripBlocks(stripBlocks(text, '<!--', '-->'), '<parent>', '</parent>');
  const own = /<artifactId>\s*([^<\s]+)\s*<\/artifactId>/.exec(xml);
  const deps = [...xml.matchAll(/<artifactId>\s*([^<\s]+)\s*<\/artifactId>/g)].map((m) => m[1]).slice(1);
  return { id: own ? own[1] : null, deps, aggregator: /<modules>/.test(xml) };
}

function npmInfo(text, hasPnpm) {
  let pkg = {};
  try { pkg = JSON.parse(text); } catch { /* package.json hỏng: coi như không có tên */ }
  if (!pkg || typeof pkg !== 'object') pkg = {};
  const deps = ['dependencies', 'devDependencies', 'peerDependencies'].flatMap((k) => Object.keys(pkg[k] || {}));
  return { id: pkg.name || null, deps, aggregator: hasPnpm || pkg.workspaces !== undefined };
}

export function inventoryModules(root) {
  root = path.resolve(root);
  const files = listFiles(root);
  const has = new Set(files);
  const notes = [];
  const found = []; // { path, kind, buildFile, id, deps (tên), aggregator }
  // build.gradle đứng riêng chỉ nhận khi repo không có settings.gradle; có settings thì module do include khai báo.
  const hasSettings = files.some((f) => !isFixture(f) && /(^|\/)settings\.gradle(\.kts)?$/.test(f));

  for (const f of files) {
    const base = path.posix.basename(f);
    const dir = dirOf(f);
    if (isFixture(f)) continue;
    if (base === 'pom.xml') { const i = mavenInfo(readBuild(root, f, notes)); found.push({ path: dir, kind: 'maven', buildFile: f, ...i }); }
    else if (base === 'package.json') {
      const hasPnpm = has.has(dir === '.' ? 'pnpm-workspace.yaml' : `${dir}/pnpm-workspace.yaml`);
      found.push({ path: dir, kind: 'npm', buildFile: f, ...npmInfo(readBuild(root, f, notes), hasPnpm) });
    } else if (/^settings\.gradle(\.kts)?$/.test(base)) {
      const text = stripBlocks(readBuild(root, f, notes), '/*', '*/').replace(/\/\/.*$/gm, '');
      const names = [...text.matchAll(/include[\s(]*((?:['"][^'"]+['"][\s,]*)+)/g)]
        .flatMap((m) => [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]));
      // include không theo sau bởi chuỗi (vd `include(*listOf(...))`): một phần module con không đọc được từ settings.
      // Ký tự sau `[\s(]*` kiểm riêng: nếu để trong cùng regex, backtrack nhường `(` cho `\S` và báo nhầm `include(":a")`.
      const dynamicInclude = [...text.matchAll(/(?<![\w'"\-.])include\b[\s(]*/g)].some((m) => { const c = text[m.index + m[0].length]; return c !== undefined && c !== '"' && c !== "'"; });
      if (dynamicInclude) notes.push(`${f}: có include động (không phải danh sách chuỗi), một phần module con không đọc được; kiểm kê tay ở cổng 1.`);
      let escaped = false;
      for (const n of names) {
        // Tên chứa `..` hoặc tuyệt đối sinh path thoát gốc: bỏ, không in tên (có thể là nội dung file).
        if (/^[A-Za-z]:|^[/\\]/.test(n) || n.split(/[:/\\]+/).includes('..')) { escaped = true; continue; }
        const rel = n.replace(/^:/, '').split(':').join('/');
        const p = dir === '.' ? rel : `${dir}/${rel}`;
        const bf = ['build.gradle', 'build.gradle.kts'].map((b) => `${p}/${b}`).find((b) => has.has(b)) || f;
        found.push({ path: p, kind: 'gradle', buildFile: bf, id: path.posix.basename(p), deps: [], aggregator: false });
      }
      if (escaped) notes.push(`${f}: có tên module chứa '..' hoặc là đường dẫn tuyệt đối, đã bỏ qua; kiểm kê tay ở cổng 1.`);
      // settings không có include nào là project Gradle một module; include động vẫn là aggregator để không gộp file của module con vào gốc.
      found.push({ path: dir, kind: 'gradle', buildFile: f, id: null, deps: [], aggregator: names.length > 0 || dynamicInclude });
    } else if (/^build\.gradle(\.kts)?$/.test(base) && !hasSettings) {
      found.push({ path: dir, kind: 'gradle', buildFile: f, id: null, deps: [], aggregator: false });
    } else if (['pyproject.toml', 'setup.py', 'requirements.txt'].includes(base)) {
      found.push({ path: dir, kind: 'python', buildFile: f, id: path.posix.basename(dir === '.' ? path.basename(root) : dir), deps: [], aggregator: false });
    }
  }

  // Một thư mục một module: ưu tiên maven, gradle, npm, python; gradle đã khai trong settings thắng build.gradle riêng.
  const order = { maven: 0, gradle: 1, npm: 2, python: 3 };
  const byDir = new Map();
  for (const c of found.sort((a, b) => order[a.kind] - order[b.kind])) {
    const cur = byDir.get(c.path);
    if (!cur) byDir.set(c.path, c);
    else if (c.aggregator && !cur.aggregator && cur.kind === c.kind) cur.aggregator = true;
  }
  let cands = [...byDir.values()];
  // Python ở gốc chỉ là module khi không có thư mục python nào bên dưới.
  const pyDirs = cands.filter((c) => c.kind === 'python');
  cands = cands.filter((c) => !(c.kind === 'python' && c.path === '.' && pyDirs.length > 1));
  const mods = cands.filter((c) => !c.aggregator);

  if (mods.length === 0) notes.push('Không nhận ra build file nào (pom.xml, settings.gradle, package.json, pyproject.toml, setup.py, requirements.txt); kiểm kê tay ở cổng 1.');

  const depth = (m) => (m.path === '.' ? 0 : m.path.split('/').length);
  const sorted = [...mods].sort((a, b) => depth(b) - depth(a));
  const owner = (f) => sorted.find((m) => m.path === '.' || f.startsWith(`${m.path}/`));
  const stats = new Map(mods.map((m) => [m.path, { sourceFiles: 0, testFiles: 0, lines: 0 }]));
  const unowned = [];
  for (const f of files) {
    const o = owner(f);
    if (!o) { unowned.push(f); continue; }
    if (!SRC_EXT.has(path.posix.extname(f).slice(1))) continue;
    const s = stats.get(o.path);
    if (isTest(f)) s.testFiles++;
    else {
      const text = read(root, f);
      s.sourceFiles++;
      s.lines += text === '' ? 0 : text.split(/\r\n|\r|\n/).length - (/(\r\n|\r|\n)$/.test(text) ? 1 : 0);
    }
  }

  const idOf = (m) => clean(m.id || path.posix.basename(m.path === '.' ? path.basename(root) : m.path));
  const gradleByPath = new Map(mods.filter((m) => m.kind === 'gradle').map((m) => [m.path, idOf(m)]));
  const siblingIds = new Set(mods.map(idOf));
  const modules = mods.map((m) => {
    let deps = m.deps;
    if (m.kind === 'gradle') {
      const prefix = m.buildFile.includes('settings.') ? null : m.buildFile;
      deps = prefix ? [...readBuild(root, prefix, notes).matchAll(/project\(\s*['"]:?([^'"]+)['"]\s*\)/g)].map((x) => gradleByPath.get(x[1].split(':').join('/'))).filter(Boolean) : [];
    }
    const id = idOf(m);
    return {
      id, path: m.path, kind: m.kind, buildFile: m.buildFile, ...stats.get(m.path),
      hasReadme: files.some((f) => f.toLowerCase() === `${m.path === '.' ? '' : `${m.path}/`}readme.md`),
      declaredDeps: [...new Set(deps.map(clean).filter((d) => siblingIds.has(d) && d !== id))],
    };
  });

  const unclaimed = [...new Set(unowned.filter((f) => f.includes('/')).map((f) => clean(f.split('/')[0])))].sort();
  const pk = (f) => has.has(`project-knowledge/${f}`) || has.has(`docs/project-knowledge/${f}`);
  return {
    // rootFiles chỉ đếm file nguồn nằm ở gốc ngoài mọi module; build file và tài liệu ở gốc không phải nội dung cần đọc.
    modules, unclaimed, rootFiles: unowned.filter((f) => !f.includes('/') && SRC_EXT.has(path.posix.extname(f).slice(1))).length,
    projectKnowledge: Object.fromEntries(PK_FILES.map((f) => [f, pk(f)])), notes,
  };
}

function table(r) {
  const rows = r.modules.map((m) => `| ${m.id} | ${m.path} | ${m.kind} | ${m.sourceFiles} | ${m.testFiles} | ${m.lines} | ${m.hasReadme ? 'có' : 'chưa'} | ${m.declaredDeps.join(', ') || '—'} |`);
  return [
    '| Module | Đường dẫn | Loại | File nguồn | File test | Dòng | README | Phụ thuộc khai báo |', '|---|---|---|---|---|---|---|---|', ...rows,
    '', `Chưa thuộc module nào: ${r.unclaimed.join(', ') || '—'}; file ở gốc: ${r.rootFiles}`,
    `project-knowledge hiện có: ${Object.entries(r.projectKnowledge).filter(([, v]) => v).map(([k]) => k).join(', ') || '—'}`,
    ...r.notes.map((n) => `Ghi chú: ${n}`),
  ].join('\n');
}

export function main(argv) {
  let root; let format = 'json';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--format') { format = argv[++i]; if (!['json', 'table'].includes(format)) { console.error('--format nhận json hoặc table.'); return 2; } }
    else if (!root) root = argv[i];
    else { console.error(`Đối số thừa: ${argv[i]}`); return 2; }
  }
  if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) { console.error('Cách dùng: inventory-modules.mjs <gốc project> [--format json|table]'); return 2; }
  const r = inventoryModules(root);
  console.log(format === 'table' ? table(r) : JSON.stringify(r, null, 2));
  return 0;
}

// realpath vì trên Windows skill được cài qua junction: argv[1] là đường dẫn junction còn import.meta.url là đường dẫn thật.
const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
