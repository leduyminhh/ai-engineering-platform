#!/usr/bin/env node
// Unit test cho parse(argv) — cờ CLI, đặc biệt --skill. Zero-dependency.
// Chạy: node test/args.test.mjs
import { parse } from '../cli/lib/args.mjs';

let pass = 0;
const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

ok(eq(parse(['install', '--skill', 'backend/backend-init,core/git-workflow']).skill,
  ['backend/backend-init', 'core/git-workflow']), '--skill csv → mảng đã tách');
ok(parse(['install', '--skill', 'x']).explicit === true, '--skill đặt explicit=true');
ok(eq(parse(['install', '--skill=a,b']).skill, ['a', 'b']), '--skill=csv → mảng');
ok(eq(parse(['install', '--skill', ' a , , b ']).skill, ['a', 'b']), '--skill trim + bỏ rỗng');
ok(eq(parse(['install']).skill, []), 'mặc định skill = []');
ok(parse(['install', '--all']).all === true, '--all đặt all=true');
ok(!parse(['install', '--all']).explicit, '--all KHÔNG đặt explicit (vẫn vào wizard)');
ok(!parse(['install']).all, 'mặc định không có all');
ok(parse(['install', '--all', '--provider', 'claude']).explicit === true, '--all + --provider vẫn explicit (non-interactive)');
ok(parse(['install', '--provider', 'claude']).provider === 'claude', 'không hồi quy: --provider');

if (fails.length) { for (const f of fails) console.error('✗', f); console.error(`\n${fails.length} FAIL / ${pass + fails.length}`); process.exit(1); }
console.log(`args.test: ${pass} pass`);
