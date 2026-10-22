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
ok(parse(['init', '--full']).full === true && !parse(['init']).full, '--full chỉ bật khi có cờ');
ok(parse(['stats', '--session', 'a.jsonl', '--json']).session === 'a.jsonl' && parse(['stats', '--json']).json === true && !parse(['stats']).json, 'stats: --session/--json được parse');
{
  const a = parse(['stats', '--usage', '--since', '3', '--json']);
  ok(a.usage === true && a.since === '3' && a.json === true && !a.explicit, 'P5c AC2.2: --usage --since <v> --json được parse, không đặt explicit');
  ok(parse(['stats', '--usage', '--since=2026-10-01']).since === '2026-10-01', 'P5c AC2.2: --since=<v> được parse');
  ok(parse(['stats', '--usage', '--since']).since === '' && parse(['stats', '--usage', '--since=']).since === '', 'P5c AC2.2: --since thiếu giá trị → chuỗi rỗng (để parseSince từ chối)');
  const d = parse(['stats']);
  ok(d.usage === undefined && d.since === undefined, 'P5c AC2.2: stats thường không có usage/since');
}

if (fails.length) { for (const f of fails) console.error('✗', f); console.error(`\n${fails.length} FAIL / ${pass + fails.length}`); process.exit(1); }
console.log(`args.test: ${pass} pass`);
