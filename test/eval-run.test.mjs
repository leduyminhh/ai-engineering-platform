#!/usr/bin/env node
// Unit test cho runner eval — chỉ hàm thuần, không gọi model. Zero-dependency.
// Chạy: node test/eval-run.test.mjs
import { stripDependencies, parseArgs } from '../scripts/eval-run.mjs';

let pass = 0;
const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

const src = { name: 'backend', version: '1.0.0', dependencies: ['core'] };
const out = stripDependencies(src);
ok(!('dependencies' in out) && out.name === 'backend' && out.version === '1.0.0', 'eval-run AC1.1: bỏ dependencies, giữ khoá khác');
ok(Array.isArray(src.dependencies), 'eval-run AC1.1: không đổi đối tượng đầu vào');
ok(JSON.stringify(stripDependencies({ name: 'core' })) === '{"name":"core"}', 'eval-run AC1.1: plugin không có dependencies là no-op');

const a = parseArgs(['--plugin', 'core', '--max-cost-usd', '0.3']);
ok(a.plugin === 'core' && a.maxCostUsd === 0.3 && a.runs === 3 && a.scaffold === false, 'eval-run AC1.2: mặc định runs=3, scaffold=false');
const b = parseArgs(['--plugin', 'backend', '--max-cost-usd', '2', '--runs', '1', '--scaffold']);
ok(b.runs === 1 && b.scaffold === true && b.maxCostUsd === 2, 'eval-run AC1.2: đọc --runs và --scaffold');
ok(throws(() => parseArgs(['--max-cost-usd', '1'])), 'eval-run AC1.2: thiếu --plugin bị từ chối');
ok(throws(() => parseArgs(['--plugin', 'core'])), 'eval-run AC1.2: thiếu --max-cost-usd bị từ chối');
ok(throws(() => parseArgs(['--plugin', 'core', '--max-cost-usd', '1', '--bogus'])), 'eval-run AC1.2: cờ lạ bị từ chối');
ok(throws(() => parseArgs(['--plugin', 'core', '--max-cost-usd', 'abc'])), 'eval-run AC1.2: chi phí không phải số bị từ chối');
ok(throws(() => parseArgs(['--plugin', 'core', '--max-cost-usd', '1', '--runs', '0'])), 'eval-run AC1.2: runs <= 0 bị từ chối');
ok(throws(() => parseArgs(['--plugin', '../x', '--max-cost-usd', '1'])), 'eval-run AC1.2: plugin id chứa đường dẫn bị từ chối');

if (fails.length) { console.error(`FAIL ${fails.length}:\n- ${fails.join('\n- ')}`); process.exit(1); }
console.log(`eval-run: ${pass} OK`);
