#!/usr/bin/env node
// Test cho `aip statusline`: hàm thuần cho nội dung dòng, chạy CLI thật cho đường stdin và mã thoát. Zero-dependency.
// Chạy: node test/statusline.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderStatusline, parseThresholds } from '../cli/lib/statusline.mjs';
import { parse } from '../cli/lib/args.mjs';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'cli', 'index.mjs');
let pass = 0;
const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };
const run = (args, input, cwd) => spawnSync(process.execPath, [CLI, 'statusline', ...args], { input, encoding: 'utf8', cwd });

const NOW = 1_700_000_000_000;
const ctx = (p) => ({ context_window: { used_percentage: p } });
const line = (input, opts) => renderStatusline(input, { nowMs: NOW, ...opts });

// AC1.1: ngưỡng mặc định 40/60 và ngưỡng do người dùng đặt
ok(line(ctx(30)) === 'ctx 30%', 'AC1.1: dưới ngưỡng mềm không có nhắc');
ok(line(ctx(45)) === 'ctx 45% ⚠ bàn giao sau gói', 'AC1.1: từ ngưỡng mềm nhắc bàn giao sau gói');
ok(line(ctx(62)) === 'ctx 62% ‼ bàn giao ngay', 'AC1.1: từ ngưỡng cứng nhắc bàn giao ngay');
ok(line(ctx(40)).includes('⚠') && line(ctx(60)).includes('‼'), 'AC1.1: ngưỡng tính từ giá trị bằng (≥)');
ok(line(ctx(45), { soft: 50, hard: 80 }) === 'ctx 45%', 'AC1.1: --soft/--hard đổi ngưỡng');
ok(line({}) === 'ctx --', 'AC1.1: thiếu context in ctx --');
ok(line({ context_window: { used_percentage: null } }) === 'ctx --', 'AC1.1: used_percentage null (đầu phiên) in ctx --');
ok(line(ctx(62), { color: true }).includes('\x1b[31m') && !line(ctx(62)).includes('\x1b'), 'AC1.1: màu chỉ khi bật color');

// AC1.2: cache ấm / nguội / vắng
const warm = (mins, extra = {}) => ({ prompt_cache: { warm: true, caching_observed: true, expires_at: NOW / 1000 + mins * 60, ...extra } });
ok(line({ ...ctx(10), ...warm(38) }) === 'ctx 10% │ cache 38m', 'AC1.2: cache ấm in số phút còn lại');
ok(line(warm(38, { hit_ratio: 0.91 })).includes('cache 38m 91%'), 'AC1.2: có hit_ratio thì in tỷ lệ');
ok(line(warm(3), { color: true }).includes('\x1b[33m'), 'AC1.2: cache còn ≤ 5 phút tô vàng');
ok(line({ prompt_cache: { warm: false, caching_observed: true, expires_at: null } }).includes('cache nguội'), 'AC1.2: cache nguội');
ok(!line({ prompt_cache: { warm: false, caching_observed: false } }).includes('cache'), 'AC1.2: caching_observed false thì bỏ phân đoạn');
ok(!line(ctx(10)).includes('cache'), 'AC1.2: không có prompt_cache thì bỏ phân đoạn');
ok(line(warm(-5)).includes('cache 0m'), 'AC1.2: expires_at đã qua không ra số âm');

// phân đoạn khác
ok(line({ model: { display_name: 'Opus' }, ...ctx(10), cost: { total_cost_usd: 1.234 }, rate_limits: { five_hour: { used_percentage: 23.5 } } }) === 'Opus │ ctx 10% │ $1.23 │ 5h 24%',
  'dòng đầy đủ: model, ctx, tiền, hạn mức 5h');

// AC1.3: đầu vào xấu không ném và không phá giao diện
for (const bad of [null, undefined, 'x', 42, [], true]) ok(line(bad) === '' || line(bad) === 'ctx --', `AC1.3: renderStatusline không ném với đầu vào ${JSON.stringify(bad)}`);
for (const [name, input] of [['rỗng', ''], ['hỏng', 'không phải json'], ['không phải object', '42']]) {
  const r = run([], input);
  ok(r.status === 0 && !/Error|at .*\.mjs/.test(r.stderr), `AC1.3: CLI stdin ${name} thoát 0, không in stack`);
}
const full = run(['--no-color'], JSON.stringify({ model: { display_name: 'Opus' }, context_window: { used_percentage: 45 } }));
ok(full.status === 0 && full.stdout.trim() === 'Opus │ ctx 45% ⚠ bàn giao sau gói', 'AC1.1: CLI đọc stdin thật và in một dòng');

// AC1.4: ngưỡng sai
ok('error' in parseThresholds({ soft: 70, hard: 60 }) && 'error' in parseThresholds({ soft: 'abc' }) && 'error' in parseThresholds({ hard: 101 }) && 'error' in parseThresholds({ soft: 0 }),
  'AC1.4: parseThresholds từ chối soft ≥ hard, không phải số, ngoài 1–100');
ok(parseThresholds({}).soft === 40 && parseThresholds({}).hard === 60, 'AC1.4: mặc định 40/60');
for (const bad of [['--soft', '70', '--hard', '60'], ['--soft', 'abc'], ['--hard=0']]) {
  const r = run(bad, '{}');
  ok(r.status === 2 && r.stderr.includes('--soft'), `AC1.4: CLI ${bad.join(' ')} báo lỗi stderr và thoát 2`);
}

// AC5.1 (2026-10-31-aip-status): request đang chạy có part vướng thì dòng có ⚠ <n> vướng
ok(line(ctx(10), { blocked: 2 }) === 'ctx 10% │ ⚠ 2 vướng', 'AC5.1: blocked 2 → đoạn ⚠ 2 vướng');
ok(!line(ctx(10), { blocked: 0 }).includes('vướng') && !line(ctx(10)).includes('vướng'), 'AC5.1: không vướng thì không có đoạn');
ok(line(ctx(10), { blocked: 1, color: true }).includes('\x1b[31m⚠ 1 vướng'), 'AC5.1: đoạn vướng tô đỏ khi bật color');
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-statusline-'));
  try {
    const dir = path.join(tmp, '.aip', 'runs', '2026-01-01-demo', '02-api');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'progress.md'), 'Task 1: start (base 1a2b3c4)\nBlocked: thiếu quyền\n');
    const r = run(['--no-color'], JSON.stringify({ ...ctx(10), workspace: { current_dir: tmp } }), os.tmpdir());
    ok(r.status === 0 && r.stdout.includes('⚠ 1 vướng'), 'AC5.1: CLI đọc .aip/runs của workspace.current_dir, in ⚠ 1 vướng');
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-statusline-none-'));
    const r2 = run(['--no-color'], JSON.stringify(ctx(10)), other);
    ok(r2.status === 0 && !r2.stdout.includes('vướng'), 'AC5.1: thư mục không có request đang chạy thì không có đoạn vướng, exit 0');
    fs.rmSync(other, { recursive: true, force: true });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// seam args: cờ mới đi qua parse(), không rơi vào danh sách lệnh
const pa = parse(['statusline', '--soft', '30', '--hard=70', '--no-color']);
ok(pa._.length === 1 && pa._[0] === 'statusline' && pa.soft === '30' && pa.hard === '70' && pa.noColor === true, 'AC1.4: parse() nhận --soft/--hard/--no-color');

if (fails.length) { console.error(`FAIL ${fails.length}:\n- ${fails.join('\n- ')}`); process.exit(1); }
console.log(`statusline: ${pass} OK`);
