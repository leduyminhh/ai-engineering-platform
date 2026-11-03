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
{
  for (const sub of ['full', 'ask', 'status']) {
    const a = parse(['mode', sub]);
    ok(eq(a._, ['mode', sub]) && !a.explicit && a.scope === 'project', `P4e AC2.4: mode ${sub} được parse, không đặt explicit`);
  }
  ok(parse(['mode', 'full', '-g']).scope === 'global', 'P4e AC2.4: -g vẫn được parse (index.mjs từ chối)');
  ok(eq(parse(['install'])._, ['install']) && parse(['install']).mode === 'skills', 'P4e AC2.4: lệnh hiện có không đổi');
}
{
  const throws = (argv) => { try { parse(argv); return null; } catch (e) { return e.message; } };
  // Regression: cờ gõ sai từng bị nuốt vào `_`, plugin giữ mặc định 'all' nên cài cả 6 plugin.
  for (const [argv, flag] of [
    [['install', '--provider', 'cursor', '--plugins', 'ops'], '--plugins'],
    [['uninstall', '--plugin=ops', '--yse'], '--yse'],
    [['install', '-x'], '-x'],
  ]) {
    const msg = throws(argv);
    ok(msg && msg.includes(flag), `cờ lạ bị từ chối, nêu tên cờ: ${argv.join(' ')}`);
  }
  for (const y of ['--yes', '-y']) {
    const msg = throws(['install', '--provider', 'claude', y]);
    ok(!msg && eq(parse(['install', '--provider', 'claude', y])._, ['install']), `${y} được nhận, không rơi vào _`);
  }
}
{
  // AC4.1: cờ nhận giá trị mà thiếu giá trị từng thành plugin/provider undefined = "không lọc" nên uninstall gỡ hết
  const throws = (argv) => { try { parse(argv); return null; } catch (e) { return e.message; } };
  for (const [argv, flag] of [
    [['uninstall', '--provider', 'claude', '--plugin'], '--plugin'],
    [['uninstall', '--plugin', '--yes'], '--plugin'],
    [['uninstall', '--provider'], '--provider'],
    [['uninstall', '--provider='], '--provider'],
    [['uninstall', '--plugin='], '--plugin'],
    [['uninstall', '--skill='], '--skill'],
    [['uninstall', '--skill', ','], '--skill'],
    [['build', '--target'], '--target'],
    [['build', '--target='], '--target'],
  ]) {
    const msg = throws(argv);
    ok(msg && msg.includes(flag), `AC4.1: thiếu giá trị bị từ chối, nêu tên cờ: ${argv.join(' ')}`);
  }
  ok(parse(['uninstall', '--plugin', 'all']).plugin === 'all' && parse(['uninstall', '--provider=claude', '--plugin=ops']).plugin === 'ops'
    && eq(parse(['uninstall', '--skill', 'a,b']).skill, ['a', 'b']), 'AC4.1: cờ có giá trị hợp lệ không đổi');
}

if (fails.length) { for (const f of fails) console.error('✗', f); console.error(`\n${fails.length} FAIL / ${pass + fails.length}`); process.exit(1); }
console.log(`args.test: ${pass} pass`);
