#!/usr/bin/env node
// Test cho `aip status`: mô hình dựng từ fixture request (design, plan, ledger, events.jsonl) với git giả, render text/JSON/HTML, CLI thật. Zero-dependency.
// Chạy: node test/status.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildStatus, pickRequest, renderText, renderHtml, countBlocked, staleMinutesOf, runStatus } from '../cli/lib/status.mjs';
import { parse } from '../cli/lib/args.mjs';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'cli', 'index.mjs');
let pass = 0;
const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };

const REQ = '2026-01-01-demo';
const NOW = Date.now();
const MIN = 60_000;
const START = 'Task 1: start (base 1a2b3c4)';

const DESIGN = `# Thiết kế: demo
- Trạng thái: approved
## Bảng part
| Part | Phụ thuộc | Song song | Trạng thái |
|---|---|---|---|
| 01-core | — | — | merged abc1234 |
| 02-api | 01-core | a | đang làm |
| 03-ui | 01-core | a | đang làm |
| 04-docs | 02-api | — | chưa làm |
| 05-idle | — | — | chưa làm |
| 06-git | — | — | chưa làm |
| 07-done | — | — | đang làm |
| 08-stale | — | — | đang làm |
## Ảnh hưởng spec
Không ảnh hưởng: test
`;
const plan = (tasks) => tasks.map(([n, files, iface = '']) => `### Task ${n}: t${n}\n**Kind:** TOOLING\n**Files:**\n${files.map((f) => `- Modify: \`${f}\``).join('\n')}\n${iface}\n`).join('\n');
const PLANS = {
  '01-core': plan([[1, ['src/core.mjs'], '**Interfaces:**\n- Consumes: không có\n- Produces: `parseX(text)`\n']]),
  '02-api': plan([[1, ['src/api.mjs', 'src/ApiController.java'], '**Interfaces:**\n- Consumes: `parseX(text)`\n- Produces: không có\n'], [2, ['src/api2.mjs']]]),
  '07-done': plan([[1, ['src/done.mjs']]]),
};
const LEDGERS = {
  root: ['# Ledger', 'Part 01: merged (abc1234)', 'Ruling: chọn A — vì B — nếu sai: C'],
  '01-core': ['Task 1: complete (commits a..b, review clean)', 'Part: complete abc1234'],
  '02-api': [START, 'Blocked: thiếu quyền <script>alert(1)</script>'],
  '03-ui': [START],
  '07-done': ['Task 1: complete (commits c..d, review clean)', 'minor (deferred): đặt tên — task 1', 'Part: complete def5678'],
  '08-stale': [START],
};
const MTIME = { '03-ui': NOW - 5 * MIN, '08-stale': NOW - 31 * MIN };

function fixture(ledgers = LEDGERS, mtime = MTIME) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-status-'));
  const req = path.join(root, 'docs', 'requests', REQ);
  fs.mkdirSync(req, { recursive: true });
  fs.writeFileSync(path.join(req, 'design.md'), DESIGN);
  for (const [p, t] of Object.entries(PLANS)) {
    fs.mkdirSync(path.join(req, 'parts', p), { recursive: true });
    fs.writeFileSync(path.join(req, 'parts', p, 'plan.md'), t);
  }
  for (const [p, lines] of Object.entries(ledgers)) {
    const dir = path.join(root, '.aip', 'runs', REQ, p);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'progress.md');
    fs.writeFileSync(file, `${lines.join('\n')}\n`);
    if (p === '02-api') fs.writeFileSync(path.join(dir, 'events.jsonl'), lines.map((line, i) => JSON.stringify({ ts: new Date(NOW - (10 - i) * MIN).toISOString(), line })).join('\n') + '\n');
    const t = (mtime[p] ?? NOW) / 1000;
    fs.utimesSync(file, t, t);
  }
  return root;
}

// git giả: chỉ nhánh part 06 có commit (2 phút trước); lệnh khác ném như ngoài repo.
const fakeGit = (args) => {
  const s = args.join(' ');
  if (s.includes('worktree-demo-p06')) return `${'f'.repeat(40)}\t${Math.floor(NOW / 1000) - 120}\tfeat: thêm git part`;
  if (s.startsWith('rev-parse --abbrev-ref')) return 'feature/demo';
  if (s.startsWith('rev-parse --short')) return 'abc1234';
  throw new Error('không phải repo');
};
const build = (root, opts = {}) => buildStatus({ docsRoot: root, runsRoot: root, request: REQ, now: NOW, git: fakeGit, ...opts });
const stateOf = (m, id) => m.parts.find((p) => p.id === id)?.state;

const root = fixture();
try {
  const m = build(root);

  // AC1.1: trạng thái theo thứ tự ưu tiên, số tổng và bảng part ở text
  for (const [id, want] of [['01-core', 'merged'], ['02-api', 'blocked'], ['03-ui', 'active'], ['04-docs', 'waiting'], ['05-idle', 'todo'], ['06-git', 'active'], ['07-done', 'done'], ['08-stale', 'stale']]) {
    ok(stateOf(m, id) === want, `AC1.1: part ${id} ở trạng thái ${want} (nhận ${stateOf(m, id)})`);
  }
  ok(m.totals.partsMerged === 1 && m.totals.partsTotal === 8 && m.totals.tasksDone === 2 && m.totals.tasksTotal === 4 && m.totals.blocked === 1 && m.totals.rulings === 1 && m.totals.minors === 1,
    `AC1.1: số tổng đúng (nhận ${JSON.stringify(m.totals)})`);
  const text = renderText(m);
  ok(/merged 1\/8/.test(text) && /task 2\/4/.test(text) && /vướng 1/.test(text), 'AC1.1: text có dòng số tổng');
  ok(['01-core', '08-stale'].every((id) => text.includes(id)) && text.includes('chờ part phụ thuộc') && text.includes('im lặng quá lâu'), 'AC1.1: text có bảng part với nhãn trạng thái');
  ok(renderText(m, { part: '02' }).includes('Task 2') && renderText(m, { part: '02' }).includes('Blocked: thiếu quyền'), 'AC1.1: --part 02 in chi tiết task và dòng sự kiện của part');

  // AC1.1: dòng Blocked: chỉ là vướng khi chưa có Unblocked:/complete sau nó
  for (const [lines, want] of [
    [[START, 'Blocked: a'], 'blocked'],
    [[START, 'Blocked: a', 'Unblocked: b'], 'active'],
    [[START, 'Blocked: a', 'Task 1: complete (commits a..b, review clean)'], 'active'],
    [[START, 'Blocked: a', 'Unblocked: b', 'Blocked: c'], 'blocked'],
    [['Blocked: a', 'Part: complete x'], 'done'],
    // Regression review Task 2 (F2): ghi chú tự do cũ "Task 1: started …" không có nghĩa part đã bắt đầu
    [['Task 1: started trong worktree'], 'todo'],
  ]) {
    const r = fixture({ root: LEDGERS.root, '02-api': lines });
    try { ok(stateOf(build(r), '02-api') === want, `AC1.1: ${JSON.stringify(lines)} → ${want}`); } finally { fs.rmSync(r, { recursive: true, force: true }); }
  }

  // Regression 2026-11-02: request cỡ nhỏ không có design.md approved nhưng ledger đã có task → G1 không được hiện chưa xong.
  {
    const r = fixture();
    try {
      fs.writeFileSync(path.join(r, 'docs', 'requests', REQ, 'design.md'), DESIGN.replace('approved', 'draft'));
      const g = build(r).gates;
      ok(g[0].done && g[1].done && !g[2].done, `G1 xong khi G2 đã xong dù design chưa approved (nhận ${JSON.stringify(g)})`);
      fs.rmSync(path.join(r, '.aip'), { recursive: true, force: true });
      const g0 = build(r).gates;
      ok(!g0[0].done && !g0[1].done, 'chưa có task nào và design draft → G1, G2 chưa xong');
    } finally { fs.rmSync(r, { recursive: true, force: true }); }
  }

  // Regression trial 2026-11-03: request cỡ nhỏ (chỉ requirement.md) hiện task 0/0, G2 ✓ và nhánh root feature/<slug> dù session gốc ở nhánh khác.
  {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-status-small-'));
    try {
      fs.mkdirSync(path.join(r, 'docs', 'requests', REQ), { recursive: true });
      fs.writeFileSync(path.join(r, 'docs', 'requests', REQ, 'requirement.md'), '# Requirement: demo\n');
      fs.mkdirSync(path.join(r, '.aip', 'runs', REQ, 'root'), { recursive: true });
      fs.writeFileSync(path.join(r, '.aip', 'runs', REQ, 'root', 'progress.md'), `# Ledger\n${START}\n`);
      const gitOn = (head) => (args) => (args.join(' ').startsWith('rev-parse --abbrev-ref') ? head : fakeGit(args));
      for (const [head, want] of [['feature/demo-v2', 'feature/demo-v2'], ['master', 'feature/demo'], ['worktree-demo-p01', 'feature/demo'], ['HEAD', 'feature/demo']]) {
        const s = build(r, { git: gitOn(head) });
        ok(s.parts[0].branch === want, `cỡ nhỏ: HEAD ${head} → nhánh root ${want} (nhận ${s.parts[0].branch})`);
      }
      const s = build(r);
      ok(s.totals.tasksDone === 0 && s.totals.tasksTotal === 1 && s.details.root.length === 1, `cỡ nhỏ: task lấy từ ledger → 0/1 (nhận ${JSON.stringify(s.totals)})`);
      ok(s.gates.map((g) => `${g.id}${g.done ? '+' : '-'}`).join() === 'G1+,G3-,push-', `cỡ nhỏ: không có G2, G1 xong khi task đã chạy (nhận ${JSON.stringify(s.gates)})`);
    } finally { fs.rmSync(r, { recursive: true, force: true }); }
  }

  // Review Focus (a): Blocked thắng chờ part phụ thuộc (04-docs phụ thuộc 02-api chưa merged)
  {
    const r = fixture({ root: LEDGERS.root, '04-docs': [START, 'Blocked: a'] });
    try { ok(stateOf(build(r), '04-docs') === 'blocked', 'Review Focus: Blocked + phụ thuộc chưa merged → blocked'); } finally { fs.rmSync(r, { recursive: true, force: true }); }
  }

  // AC1.2: JSON đủ trường của 7 khối
  const json = JSON.parse(JSON.stringify(m));
  ok(['header', 'gates', 'needs', 'totals', 'parts', 'graph', 'details', 'events'].every((k) => k in json), 'AC1.2: mô hình JSON có đủ khoá của 7 khối');
  ok(json.header.request === REQ && json.header.branch === 'feature/demo' && json.header.head === 'abc1234' && typeof json.header.updatedAt === 'string', 'AC1.2: đầu trang có request, nhánh, HEAD, thời điểm');
  ok(json.gates.map((g) => g.id).join() === 'G1,G2,G3,push' && json.gates[0].done === true && json.gates[2].done === false, 'AC1.2: dải cổng G1 → G2 → G3 → push, G1 xong theo design approved');
  ok(json.graph.some((e) => e.from === '01-core' && e.to === '02-api' && e.label.includes('parseX(text)')), 'AC1.2: sơ đồ phụ thuộc có nhãn từ Interfaces');
  ok(json.details['02-api']?.length === 2 && json.details['02-api'][0].files.includes('src/api.mjs'), 'AC1.2: chi tiết part có task và file');
  ok(json.events.length >= 3 && json.events.every((e, i, a) => i === 0 || a[i - 1].ts >= e.ts) && json.events.some((e) => e.part === '06-git' && e.text.includes('feat: thêm git part')),
    'AC1.2: dòng sự kiện gồm ledger + commit nhánh part, mới nhất trước');
  ok(json.needs.length === 2 && json.needs.some((n) => n.part === '02-api' && n.reason.includes('thiếu quyền')) && json.needs.some((n) => n.part === '08-stale'), 'AC1.2: Cần bạn xử lý gồm part vướng và part im lặng');

  // AC1.3: HTML tự chứa, 7 khối, escape nội dung ledger, refresh khi watch
  const html = renderHtml(m);
  for (const id of ['header', 'gates', 'needs', 'totals', 'parts', 'graph', 'details']) ok(html.includes(`id="${id}"`), `AC1.3: HTML có khối #${id}`);
  ok(!/(src|href)\s*=\s*["']?(https?:)?\/\//i.test(html) && !/<link\b|@import|<script\b/i.test(html), 'AC1.3: HTML không tải tài nguyên ngoài, không có script');
  ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'AC1.3: nội dung ledger được escape');
  // Regression xem trang (2026-10-31): tên file giữ nguyên hoa thường như plan; JSON giữ ISO, trang in giờ địa phương thay vì ISO UTC
  ok(json.details['02-api'][0].files.includes('src/ApiController.java') && html.includes('src/ApiController.java'), 'chi tiết part giữ nguyên hoa thường của tên file trong plan');
  const iso = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/;
  ok(!iso.test(html) && !iso.test(renderText(m)) && !iso.test(renderText(m, { part: '02' })), 'trang và text không in thời điểm ISO UTC thô');
  const two = (v) => String(v).padStart(2, '0');
  const d = new Date(json.events.find((e) => e.part === '02-api').ts);
  const today = new Date(NOW).toDateString() === d.toDateString();
  ok(html.includes(`${today ? '' : `${two(d.getDate())}/${two(d.getMonth() + 1)} `}${two(d.getHours())}:${two(d.getMinutes())}`), 'thời điểm in theo giờ địa phương HH:MM (thêm dd/mm khi khác ngày)');
  ok(iso.test(JSON.stringify(json.events[0])), '--json vẫn giữ thời điểm ISO');
  ok(!html.includes('http-equiv="refresh"') && renderHtml(m, { watch: true }).includes('http-equiv="refresh"'), 'AC1.3: chỉ --watch mới có meta refresh');
  const calm = fixture({ root: LEDGERS.root });
  try { ok(!renderHtml(build(calm)).includes('id="needs"'), 'AC1.3: không có việc thì không có khối Cần bạn xử lý'); } finally { fs.rmSync(calm, { recursive: true, force: true }); }

  // AC1.4: chờ part phụ thuộc không phải vướng
  ok(stateOf(m, '04-docs') === 'waiting' && !m.needs.some((n) => n.part === '04-docs'), 'AC1.4: part chờ phụ thuộc chưa merged không vào Cần bạn xử lý, không tính vướng');

  // AC1.5: ngưỡng im lặng, mặc định 30
  ok(staleMinutesOf(null) === 30 && staleMinutesOf({}) === 30 && staleMinutesOf({ statusStaleMinutes: 'x' }) === 30 && staleMinutesOf({ statusStaleMinutes: -5 }) === 30 && staleMinutesOf({ statusStaleMinutes: 45 }) === 45,
    'AC1.5: statusStaleMinutes thiếu/sai thì 30, hợp lệ thì dùng');
  ok(stateOf(build(root, { staleMinutes: 60 }), '08-stale') === 'active', 'AC1.5: 31 phút dưới ngưỡng 60 là đang làm');
  const r29 = fixture(LEDGERS, { ...MTIME, '08-stale': NOW - 29 * MIN });
  try { ok(stateOf(build(r29), '08-stale') === 'active', 'AC1.5: 29 phút dưới ngưỡng mặc định 30 là đang làm'); } finally { fs.rmSync(r29, { recursive: true, force: true }); }

  // Regression minor review cuối: thư mục request tên lạ (dấu cách, chữ có dấu) bị bỏ qua, không làm aip status không đối số thoát 2
  {
    const odd = path.join(root, '.aip', 'runs', 'tên lạ', 'root');
    fs.mkdirSync(odd, { recursive: true });
    fs.writeFileSync(path.join(odd, 'progress.md'), 'Blocked: x\n');
    fs.utimesSync(path.join(odd, 'progress.md'), new Date(NOW + 60 * MIN), new Date(NOW + 60 * MIN));
    ok(pickRequest(root) === REQ && countBlocked(root) === 1, 'pickRequest bỏ thư mục request tên lạ, chọn request hợp lệ');
    fs.rmSync(path.join(root, '.aip', 'runs', 'tên lạ'), { recursive: true, force: true });
  }

  // Request cũ: không có events.jsonl, git ném lỗi → không ném, vẫn có bảng
  const bare = buildStatus({ docsRoot: root, runsRoot: root, request: REQ, now: NOW, git: () => { throw new Error('x'); } });
  ok(bare.parts.length === 8 && bare.header.branch === null, 'thiếu git: vẫn dựng bảng, nhánh null');

  // pickRequest / countBlocked: request có ledger dở mới nhất; request đã Plan: complete bị bỏ
  const old = path.join(root, '.aip', 'runs', '2025-01-01-old', 'root');
  fs.mkdirSync(old, { recursive: true });
  fs.writeFileSync(path.join(old, 'progress.md'), 'Blocked: cũ\nPlan: complete\n');
  ok(pickRequest(root) === REQ && countBlocked(root) === 1, 'pickRequest chọn request dở; countBlocked đếm part vướng của request đó');
  ok(pickRequest(path.join(root, 'không-có')) === null && countBlocked(path.join(root, 'không-có')) === 0, 'không có .aip/runs: pickRequest null, countBlocked 0');
  // Regression review Task 2 (F1): request chia part có Blocked: ở ledger root → trang và statusline báo cùng số vướng
  fs.appendFileSync(path.join(root, '.aip', 'runs', REQ, 'root', 'progress.md'), 'Blocked: root chờ\n');
  const withRoot = build(root);
  ok(countBlocked(root) === 2 && withRoot.totals.blocked === 2 && withRoot.needs.some((n) => n.part === 'root' && n.reason === 'root chờ'),
    'root vướng vào Cần bạn xử lý, countBlocked bằng totals.blocked');
  // Chỉ có ledger root (part chưa có ledger) và có Bảng part
  const onlyRoot = fixture({ root: [...LEDGERS.root, 'Blocked: root chờ'] });
  try { ok(countBlocked(onlyRoot) === 1 && build(onlyRoot).totals.blocked === 1, 'chỉ ledger root vướng: countBlocked bằng totals.blocked'); } finally { fs.rmSync(onlyRoot, { recursive: true, force: true }); }
  const solo = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-status-solo-'));
  try {
    fs.mkdirSync(path.join(solo, '.aip', 'runs', REQ, 'root'), { recursive: true });
    fs.writeFileSync(path.join(solo, '.aip', 'runs', REQ, 'root', 'progress.md'), 'Blocked: x\n');
    const m1 = buildStatus({ docsRoot: solo, runsRoot: solo, request: REQ, now: NOW, git: fakeGit });
    ok(countBlocked(solo) === 1 && m1.totals.blocked === 1 && m1.needs.length === 1, 'request không chia part: root là hàng, vướng đếm một lần');
  } finally { fs.rmSync(solo, { recursive: true, force: true }); }

  // CLI thật: thư mục tạm không phải repo nên docsRoot = runsRoot = cwd
  const cli = (...a) => spawnSync(process.execPath, [CLI, 'status', ...a], { cwd: root, encoding: 'utf8' });
  const j = cli(REQ, '--json');
  let parsed = null;
  try { parsed = JSON.parse(j.stdout); } catch { /* để ok báo */ }
  ok(j.status === 0 && parsed?.header?.request === REQ, 'AC1.2: aip status <request> --json in JSON, exit 0');
  const t = cli();
  ok(t.status === 0 && t.stdout.includes('02-api') && t.stdout.includes('vướng'), 'AC1.1: aip status không tên chọn request dở mới nhất, in text');
  const h = cli('--html');
  const out = path.join(root, '.aip', 'runs', REQ, 'status.html');
  ok(h.status === 0 && fs.existsSync(out) && h.stdout.includes('status.html'), 'AC1.3: aip status --html ghi .aip/runs/<request>/status.html và in đường dẫn');
  ok(fs.readFileSync(path.join(root, '.aip', '.gitignore'), 'utf8').trim() === '*', '--html tạo .aip/.gitignore (*) khi thiếu');
  ok(fs.readFileSync(out, 'utf8').includes('Content-Security-Policy') && !fs.existsSync(`${out}.tmp`), '--html có CSP và không để lại file tạm');
  // Regression review cuối (CWE-22): tên request có `..`, dấu phân cách hay đường dẫn tuyệt đối bị từ chối, không ghi file
  for (const bad of ['..', '../x', 'a/../..', 'a\\b', '/abs', '-x']) {
    const b = cli(bad, '--html');
    ok(b.status === 2 && b.stderr.includes('không hợp lệ'), `tên request ${JSON.stringify(bad)} → exit 2`);
  }
  ok(!fs.existsSync(path.join(root, '.aip', 'status.html')) && !fs.existsSync(path.join(root, 'status.html')), 'tên request lạ không ghi status.html ra ngoài thư mục request');
  const ctl = renderText({ ...m, needs: [{ part: 'x', state: 'blocked', reason: 'a\x1b[31mb\x07c' }] });
  ok(!/[\x00-\x09\x0b-\x1f\x7f]/.test(ctl) && ctl.includes('a[31mbc'), 'text bỏ ký tự điều khiển lấy từ ledger');
  // Regression minor review cuối: tab là khoảng trắng, không phải ký tự điều khiển cần bỏ (không dính chữ)
  ok(renderText({ ...m, needs: [{ part: 'x', state: 'blocked', reason: 'a	b' }] }).includes('a b'), 'text đổi tab thành khoảng trắng, không dính chữ');
  // Regression minor review cuối: rename đè file đang mở có thể lỗi EPERM trên Windows → ghi trực tiếp, không để lại .tmp
  {
    let calls = 0;
    const eperm = () => { calls++; throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); };
    const target = path.join(root, '.aip', 'runs', REQ, 'status.html');
    fs.rmSync(target, { force: true });
    const rc = runStatus({ _: ['status', REQ], html: true }, { cwd: root, out: () => {}, err: () => {}, rename: eperm });
    ok(calls === 1 && rc === 0 && fs.readFileSync(target, 'utf8').includes('id="parts"') && !fs.existsSync(`${target}.tmp`), '--html: rename lỗi EPERM vẫn ghi status.html và không để lại .tmp');
  }
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-status-empty-'));
  const e = spawnSync(process.execPath, [CLI, 'status'], { cwd: empty, encoding: 'utf8' });
  ok(e.status === 0 && e.stdout.trim().length > 0, 'không có request đang chạy: in một dòng, exit 0');
  fs.rmSync(empty, { recursive: true, force: true });

  const pa = parse(['status', '--html', '--part', '02', '--watch']);
  ok(pa._.join() === 'status' && pa.html === true && pa.part === '02' && pa.watch === true, 'parse() nhận --html/--part/--watch');
  ok(parse(['status', '--part=03']).part === '03', 'parse() nhận --part=<nn>');
  const np = cli('--part');
  ok(np.status === 2 && np.stderr.includes('--part'), '--part thiếu giá trị → exit 2, báo lỗi');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

if (fails.length) { console.error(`FAIL ${fails.length}:\n- ${fails.join('\n- ')}`); process.exit(1); }
console.log(`status: ${pass} OK`);
