#!/usr/bin/env node
// Test cho route.mjs của skill brainstorming: đọc khối định tuyến của brief + hai bảng của orchestrator, chấm điểm tất định,
// ghi nhật ký định tuyến. Fixture là chuỗi, không đọc workflows/orchestrator/WORKFLOW.md thật (contract 55-routing lo phần đó).
// Chạy: node test/route.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'core', 'skills', 'brainstorming', 'scripts', 'route.mjs');
let pass = 0;
const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };

let r;
try {
  r = await import(pathToFileURL(SCRIPT).href);
} catch (e) {
  console.error(`FAIL: không nạp được ${SCRIPT}: ${e.message}`);
  process.exit(1);
}

const ORCH = [
  '## Registry',
  '| id | Tín hiệu | Risk | Không dùng khi | loại-việc | phạm-vi | điều-kiện |',
  '|---|---|---|---|---|---|---|',
  '| `workflow-feature` | "thêm tính năng" | medium | x | feature | code-be, code-fe, fullstack | — |',
  '| `workflow-bugfix` | "lỗi" | medium | x | bug | code-be, code-fe, fullstack | — |',
  '| `workflow-security-review` | "bảo mật" | high | x | nghiên-cứu, bug | code-be, code-fe, fullstack | rủi-ro~bảo mật |',
  '| `workflow-performance` | "chậm" | medium | x | bug, nghiên-cứu | code-be, code-fe, fullstack | rủi-ro~hiệu năng, phạm-vi!=ops |',
  '',
  '**Thứ tự ưu tiên:** `workflow-security-review` > `workflow-bugfix` > `workflow-feature` > `workflow-performance`',
  '',
  '## Yêu cầu chạy trực tiếp bằng skill',
  '| Tín hiệu | Skill | loại-việc | phạm-vi | điều-kiện |',
  '|---|---|---|---|---|',
  '| "quyết định" | `engineering-adr` | quyết-định | * | — |',
  '| "cập nhật tài liệu" | Session chính sửa trực tiếp (ghi ADR → `engineering-adr`) | tài-liệu | * | — |',
  '| "đổi schema" | `data-db-migration` (plugin `data`) | feature | data | phạm-vi=data/fullstack |',
  '',
  '## Các bước',
].join('\n');

const brief = (o = {}) => [
  '# Brief: demo',
  '## Định tuyến',
  `loại-việc: ${o.type ?? 'feature'}`,
  `phạm-vi: ${o.scope ?? 'fullstack'}`,
  'đầu-ra-mong-đợi: x',
  `rủi-ro: ${o.risk ?? 'không có'}`,
  `ứng-viên-route: ${o.hints ?? '[]'}`,
  ...(o.approved ? [`route-đã-duyệt: ${o.approved}`] : []),
  '',
].join('\n');

const routes = r.parseRoutes(ORCH);
const run = (b, opts) => r.routeBrief(r.parseBrief(b), routes, opts);

// parseRoutes: đọc cột theo tên, cả hai bảng, ô Skill không mở đầu bằng backtick là in-session
ok(routes.length === 7, `parseRoutes: đọc đủ 7 hàng (có ${routes.length})`);
ok(routes.find((x) => x.id === 'workflow-feature')?.kind === 'workflow', 'parseRoutes: hàng Registry là workflow');
ok(routes.find((x) => x.id === 'engineering-adr' && x.types.includes('quyết-định'))?.kind === 'skill', 'parseRoutes: hàng skill lấy token backtick đầu');
ok(routes.some((x) => x.kind === 'in-session' && x.types.includes('tài-liệu')), 'parseRoutes: ô Skill không mở bằng backtick → in-session');
ok(JSON.stringify(routes.find((x) => x.id === 'workflow-performance').conds.map((c) => c.field)) === '["rủi-ro","phạm-vi"]', 'parseRoutes: đọc vị từ điều-kiện');
ok(r.parseRoutes(ORCH.replace(/\n/g, '\r\n')).length === 7, 'parseRoutes: chấp nhận CRLF');
ok(r.parseRoutes('## Registry\n| id | Tín hiệu | Risk | Không dùng khi |\n|---|---|---|---|\n| `workflow-x` | "a" | low | y |\n').every((x) => x.types.length === 0), 'parseRoutes: bảng chưa có cột mới → không hàng nào khớp loại-việc');

// parseBrief
ok(r.parseBrief(brief({ hints: '[workflow-feature, workflow-bugfix]' })).hints.join() === 'workflow-feature,workflow-bugfix', 'parseBrief: ứng-viên-route thành mảng');
ok(r.parseBrief(brief({ approved: 'engineering-adr' })).approved === 'engineering-adr', 'parseBrief: đọc route-đã-duyệt');
ok(r.parseBrief('# Brief\nkhông có khối') === null, 'parseBrief: thiếu khối → null');
ok(r.parseBrief('## Định tuyến\nphạm-vi: fullstack\n') === null, 'parseBrief: thiếu loại-việc → null');
ok(r.parseBrief(brief().replace(/\n/g, '\r\n'))?.type === 'feature', 'parseBrief: chấp nhận CRLF');
ok(r.parseBrief(brief({ type: 'bug' }).replace('loại-việc', 'Loại-Việc'))?.type === 'bug', 'parseBrief: khoá không phân biệt hoa thường');

// ac2_1: khớp rõ một dòng → chosen, confidence high
const ac21 = [
  ['feature fullstack → workflow-feature', { type: 'feature', scope: 'fullstack' }, 'workflow-feature'],
  ['bug code-be → workflow-bugfix', { type: 'bug', scope: 'code-be' }, 'workflow-bugfix'],
  ['quyết-định không-code → engineering-adr', { type: 'quyết-định', scope: 'không-code' }, 'engineering-adr'],
  ['feature data → data-db-migration (vị từ phạm-vi thoả)', { type: 'feature', scope: 'data' }, 'data-db-migration'],
];
for (const [name, o, want] of ac21) {
  const res = run(brief(o));
  ok(res.chosen?.id === want && res.confidence === 'high', `ac2_1: ${name} (được ${JSON.stringify(res.chosen)} ${res.confidence})`);
}
ok(run(brief({ type: 'tài-liệu', scope: 'không-code' })).chosen?.kind === 'in-session', 'ac2_1: tài-liệu → in-session');
ok(run(brief({ type: 'feature', scope: 'code-be' })).chosen?.id === 'workflow-feature', 'ac2_1: điều-kiện phạm-vi=data/fullstack loại hàng schema khi phạm-vi code-be');

// ac2_2: hai ứng viên sát điểm → không tự chọn
const tie = run(brief({ type: 'bug', scope: 'code-be', risk: 'hiệu năng chậm' }));
ok(tie.chosen === null && tie.candidates.length === 2 && tie.confidence === 'low', `ac2_2: bug + rủi-ro hiệu năng → hai ứng viên, không chọn (được ${tie.candidates.map((c) => c.id)})`);
ok(tie.candidates[0].id === 'workflow-bugfix' && tie.candidates[1].id === 'workflow-performance', 'ac2_2: hai ứng viên xếp theo thứ tự ưu tiên của orchestrator');
// chênh đúng 0.5 (ứng viên phụ) vẫn là hai ứng viên; chênh đúng MARGIN (ứng viên chính) thì chọn
const half = run(brief({ type: 'bug', scope: 'code-be', risk: 'hiệu năng', hints: '[workflow-bugfix]' }));
ok(half.chosen?.id === 'workflow-bugfix' && half.confidence === 'high', `ac2_2: chênh đúng MARGIN (ứng viên chính +1) → chọn (được ${JSON.stringify(half.chosen)})`);
const secondary = run(brief({ type: 'bug', scope: 'code-be', risk: 'hiệu năng', hints: '[workflow-security-review, workflow-bugfix]' }));
ok(secondary.chosen === null && secondary.candidates.length === 2, 'ac2_2: chênh 0.5 (ứng viên phụ) → vẫn hai ứng viên');
ok(r.MARGIN === 1 && r.THRESHOLD === 6, 'hằng số: MARGIN = 1, THRESHOLD = 6');

// ac2_3: không khớp, thiếu khối → chosen null kèm lý do
const none = [
  ['loại-việc không có hàng nào', brief({ type: 'nghiệp-vụ', scope: 'không-code' })],
  ['phạm-vi không khớp', brief({ type: 'feature', scope: 'ops' })],
  ['thiếu khối định tuyến', '# Brief\nkhông có khối\n'],
  ['thiếu loại-việc', '## Định tuyến\nphạm-vi: fullstack\n'],
];
for (const [name, b] of none) {
  const res = run(b);
  ok(res.chosen === null && res.candidates.length === 0 && res.confidence === 'none' && typeof res.reason === 'string' && res.reason.length > 0, `ac2_3: ${name} → chosen null kèm reason`);
}
ok(run(brief({ type: 'feature', scope: 'fullstack', hints: '[]' })).chosen?.id === 'workflow-feature', 'ac2_3: ứng-viên-route rỗng không làm hỏng việc chọn');
ok(run(brief({ type: 'nghiên-cứu', scope: 'code-be', risk: 'không' })).chosen === null, 'ac2_3: hàng điều-kiện rủi-ro~bảo mật bị loại khi rủi-ro không chứa chuỗi đó');

// --exclude: loại route đã thử rồi mới chấm
const ex = run(brief({ type: 'bug', scope: 'code-be', risk: 'hiệu năng' }), { exclude: ['workflow-bugfix'] });
ok(ex.chosen?.id === 'workflow-performance', `exclude: loại workflow-bugfix → còn workflow-performance (được ${JSON.stringify(ex.chosen)})`);
ok(run(brief({ type: 'feature', scope: 'fullstack' }), { exclude: ['workflow-feature'] }).chosen === null, 'exclude: hết route → chosen null');

// CLI + --log trong thư mục tạm
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-route-'));
const quiet = (fn) => { const o = [console.log, console.error]; console.log = console.error = () => {}; try { return fn(); } finally { [console.log, console.error] = o; } };
const out = [];
const cap = (fn) => { const o = console.log; console.log = (s) => out.push(String(s)); try { return fn(); } finally { console.log = o; } };
try {
  const bf = path.join(tmp, 'brief.md');
  const of = path.join(tmp, 'WORKFLOW.md');
  fs.writeFileSync(bf, brief({ type: 'quyết-định', scope: 'không-code' }));
  fs.writeFileSync(of, ORCH);
  const rc = cap(() => r.main([bf, of], { cwd: tmp }));
  const parsed = JSON.parse(out.join(''));
  ok(rc === 0 && parsed.chosen?.id === 'engineering-adr' && Array.isArray(parsed.candidates) && 'reason' in parsed && 'confidence' in parsed, 'main: in JSON { chosen, candidates, reason, confidence }, exit 0');
  ok(quiet(() => r.main([], { cwd: tmp })) === 2, 'main: thiếu đối số → exit 2');
  ok(quiet(() => r.main([path.join(tmp, 'khong-co.md'), of], { cwd: tmp })) === 2, 'main: không đọc được brief → exit 2');
  ok(quiet(() => r.main([bf, of, '--exclude'], { cwd: tmp })) === 2, 'main: --exclude thiếu giá trị → exit 2');

  // ac5_1: --log ghi đúng một dòng JSON mỗi lần, append-only, ở gốc repo chính
  const logFile = path.join(tmp, '.aip', 'routing-log.jsonl');
  const deps = { cwd: tmp, git: () => { throw new Error('không phải repo'); }, now: () => new Date('2026-11-01T00:00:00Z') };
  const rc1 = quiet(() => r.main(['--log', bf, '--chosen', 'engineering-adr'], deps));
  const lines1 = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').trim().split('\n') : [];
  const rec = lines1.length ? JSON.parse(lines1[0]) : {};
  ok(rc1 === 0 && lines1.length === 1 && rec.chosen === 'engineering-adr' && rec.overridden === false && rec.misrouted === false && rec.ts === '2026-11-01T00:00:00.000Z' && typeof rec.brief === 'string' && rec.brief.endsWith('brief.md'), 'ac5_1: --log ghi một bản ghi {ts,brief,chosen,overridden,misrouted}');
  quiet(() => r.main(['--log', bf, '--chosen', 'workflow-bugfix', '--overridden', '--misrouted'], deps));
  const lines2 = fs.readFileSync(logFile, 'utf8').trim().split('\n');
  const rec2 = JSON.parse(lines2[1]);
  ok(lines2.length === 2 && rec2.overridden === true && rec2.misrouted === true && rec2.chosen === 'workflow-bugfix', 'ac5_1: lần ghi thứ hai thêm dòng mới, cờ --overridden/--misrouted');
  quiet(() => r.main(['--log', bf, '--chosen', '-'], deps));
  ok(JSON.parse(fs.readFileSync(logFile, 'utf8').trim().split('\n')[2]).chosen === null, 'ac5_1: --chosen - ghi chosen null');
  ok(quiet(() => r.main(['--log', bf], deps)) === 2, 'ac5_1: --log thiếu --chosen → exit 2, không ghi thêm');
  ok(fs.readFileSync(logFile, 'utf8').trim().split('\n').length === 3, 'ac5_1: lệnh sai không ghi thêm dòng');

  // ghi hỏng → fail-open: exit 0 (cảnh báo trên stderr), không ném
  const bad = path.join(tmp, 'bad');
  fs.mkdirSync(bad);
  fs.writeFileSync(path.join(bad, '.aip'), 'file chặn thư mục');
  const rc3 = quiet(() => r.main(['--log', bf, '--chosen', 'x'], { ...deps, cwd: bad }));
  ok(rc3 === 0, 'ac5_1: thư mục .aip không tạo được → exit 0 (fail-open)');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (fails.length) {
  console.error(`FAIL ${fails.length}/${pass + fails.length}:\n- ${fails.join('\n- ')}`);
  process.exit(1);
}
console.log(`route.test: ${pass} pass`);
