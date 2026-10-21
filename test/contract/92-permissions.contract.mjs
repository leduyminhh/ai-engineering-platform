// Contract permissions: chính sách quyền chuẩn của core và bộ dựng khối `permissions` cho Claude.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { POLICY_PATH, loadPolicy, checkPolicy, isValidRule, buildClaudePermissions } from '../../cli/lib/permissions.mjs';

export default async function run({ ok }) {
  const GROUPS = { secrets: 'deny', git_push: 'ask', network: 'ask', production_deploy: 'ask' };
  const good = () => ({ version: 1, groups: Object.fromEntries(Object.entries(GROUPS).map(([n, action]) => [n, { action, rules: ['WebFetch'] }])) });

  // AC1.1: chính sách thật của repo
  {
    const policy = loadPolicy(POLICY_PATH);
    const errs = checkPolicy(policy);
    ok(errs.length === 0, `AC1.1: policy.json hợp lệ${errs.length ? ' — ' + errs.join('; ') : ''}`);
    const secrets = policy.groups.secrets.rules;
    ok(secrets.every((r) => !r.includes('*') && !/example|sample|template/i.test(r)), 'AC1.1: quy tắc secrets không dùng ký tự đại diện, không chặn .env.example/.sample/.template (hook H3 cho phép đọc)');
    ok(secrets.includes('Read(.env)'), 'AC1.1: secrets chặn .env ở mọi độ sâu (tên trần theo cú pháp gitignore)');
    ok(Object.entries(GROUPS).every(([n, a]) => policy.groups[n]?.action === a), 'AC1.1: đủ bốn nhóm với action đúng');
  }

  // AC1.1: isValidRule — một hành vi, nhiều đầu vào
  const ruleCases = [
    ['Read(./.env)', true], ['Read(.env)', true], ['Read(.env.local)', true], ['Read(./.env.*)', true], ['Bash(git push *)', true], ['WebFetch', true], ['mcp__x__*', true], ['mcp__my_server__*', true],
    ['', false], ['Bash(git push*)', false], ['Read()', false], ['mcp__x', false], ['Read(./.env)\nBash(ls *)', false], ['WebFetch(domain:x)', false], ['Bash( *)', false],
    [' Read(./.env)', false], ['Read(./.env) ', false], ['mcp__a-b__*', true], ['Read(./a\x7fb)', false], ['Bash(git\x7f push *)', false],
  ];
  for (const [rule, expected] of ruleCases) ok(isValidRule(rule) === expected, `AC1.1: isValidRule(${JSON.stringify(rule)}) = ${expected}`);
  ok(isValidRule(undefined) === false && isValidRule(7) === false, 'AC1.1: isValidRule không phải chuỗi → false');

  // AC1.1: checkPolicy báo lỗi
  const mutate = (fn) => { const p = good(); fn(p); return p; };
  const policyCases = [
    ['nhóm lạ', mutate((p) => { p.groups.extra = { action: 'ask', rules: ['WebFetch'] }; })],
    ['action lạ', mutate((p) => { p.groups.network.action = 'allow'; })],
    ['action sai nhóm secrets', mutate((p) => { p.groups.secrets.action = 'ask'; })],
    ['thiếu nhóm', mutate((p) => { delete p.groups.git_push; })],
    ['rules rỗng', mutate((p) => { p.groups.network.rules = []; })],
    ['quy tắc sai cú pháp', mutate((p) => { p.groups.network.rules = ['Bash(curl*)']; })],
    ['không phải object', null],
    ['nhóm kế thừa từ Object', mutate((p) => { Object.defineProperty(p.groups, 'constructor', { value: { action: 'ask', rules: ['WebFetch'] }, enumerable: true }); })],
    ['version sai', mutate((p) => { p.version = 2; })],
  ];
  for (const [name, p] of policyCases) ok(checkPolicy(p).length >= 1, `AC1.1: checkPolicy báo lỗi — ${name}`);
  ok(checkPolicy(good()).length === 0, 'AC1.1: checkPolicy chính sách hợp lệ → không lỗi');

  // AC1.1: loadPolicy bỏ BOM đầu file
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-pol-'));
    try {
      const file = path.join(dir, 'policy.json');
      fs.writeFileSync(file, '﻿' + JSON.stringify(good()));
      ok(checkPolicy(loadPolicy(file)).length === 0, 'AC1.1: loadPolicy đọc được file có BOM');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }

  // AC1.1: buildClaudePermissions
  {
    const p = good();
    p.groups.secrets.rules = ['Read(./.env)', 'Read(./.env.*)'];
    p.groups.git_push.rules = ['Bash(git push *)', 'WebFetch'];
    p.groups.network.rules = ['WebFetch', 'Bash(curl *)'];
    p.groups.production_deploy.rules = ['Bash(kubectl apply *)'];
    const out = buildClaudePermissions(p);
    ok(JSON.stringify(out) === JSON.stringify({ permissions: {
      deny: ['Read(./.env)', 'Read(./.env.*)'],
      ask: ['Bash(git push *)', 'WebFetch', 'Bash(curl *)', 'Bash(kubectl apply *)'],
    } }), 'AC1.1: buildClaudePermissions gom deny/ask đúng thứ tự, không trùng');
    const bad = good();
    bad.groups.network.action = 'allow';
    let msg = '';
    try { buildClaudePermissions(bad); } catch (e) { msg = `${e.constructor.name}: ${e.message}`; }
    ok(/^Error: .*allow/.test(msg), 'AC1.1: buildClaudePermissions action lạ → Error rõ ràng');
  }
  // AC1.4: omitWhen và cờ allowEnvFiles
  {
    const withOmit = (v) => mutate((p) => { p.groups.secrets.omitWhen = v; });
    ok(checkPolicy(withOmit('allowEnvFiles')).length === 0, 'AC1.4: checkPolicy chấp nhận omitWhen "allowEnvFiles"');
    for (const v of ['other', true, 1, null, '']) ok(checkPolicy(withOmit(v)).length >= 1, `AC1.4: checkPolicy từ chối omitWhen ${JSON.stringify(v)}`);
    ok(checkPolicy(loadPolicy(POLICY_PATH)).length === 0 && loadPolicy(POLICY_PATH).groups.secrets.omitWhen === 'allowEnvFiles', 'AC1.4: policy.json gắn omitWhen cho nhóm secrets');
    const p = withOmit('allowEnvFiles');
    p.groups.secrets.rules = ['Read(.env)'];
    p.groups.network.rules = ['WebFetch'];
    const on = buildClaudePermissions(p, { allowEnvFiles: true });
    ok(Array.isArray(on.permissions.deny) && on.permissions.deny.length === 0 && on.permissions.ask.includes('WebFetch'), 'AC1.4: buildClaudePermissions {allowEnvFiles:true} bỏ nhóm secrets, deny là mảng rỗng');
    for (const opts of [undefined, {}, { allowEnvFiles: false }]) {
      ok(buildClaudePermissions(p, opts).permissions.deny.includes('Read(.env)'), `AC1.4: buildClaudePermissions giữ secrets với ${JSON.stringify(opts)}`);
    }
  }
}
