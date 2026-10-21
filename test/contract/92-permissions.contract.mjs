// Contract permissions: chính sách quyền chuẩn của core và bộ dựng khối `permissions` cho Claude.
import { POLICY_PATH, loadPolicy, checkPolicy, isValidRule, buildClaudePermissions } from '../../cli/lib/permissions.mjs';

export default async function run({ ok }) {
  const GROUPS = { secrets: 'deny', git_push: 'ask', network: 'ask', production_deploy: 'ask' };
  const good = () => ({ version: 1, groups: Object.fromEntries(Object.entries(GROUPS).map(([n, action]) => [n, { action, rules: ['WebFetch'] }])) });

  // AC1.1: chính sách thật của repo
  {
    const policy = loadPolicy(POLICY_PATH);
    const errs = checkPolicy(policy);
    ok(errs.length === 0, `AC1.1: policy.json hợp lệ${errs.length ? ' — ' + errs.join('; ') : ''}`);
    ok(Object.entries(GROUPS).every(([n, a]) => policy.groups[n]?.action === a), 'AC1.1: đủ bốn nhóm với action đúng');
  }

  // AC1.1: isValidRule — một hành vi, nhiều đầu vào
  const ruleCases = [
    ['Read(./.env)', true], ['Read(./.env.*)', true], ['Bash(git push *)', true], ['WebFetch', true], ['mcp__x__*', true], ['mcp__my_server__*', true],
    ['', false], ['Bash(git push*)', false], ['Read()', false], ['mcp__x', false], ['Read(./.env)\nBash(ls *)', false], ['WebFetch(domain:x)', false], ['Bash( *)', false],
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
  ];
  for (const [name, p] of policyCases) ok(checkPolicy(p).length >= 1, `AC1.1: checkPolicy báo lỗi — ${name}`);
  ok(checkPolicy(good()).length === 0, 'AC1.1: checkPolicy chính sách hợp lệ → không lỗi');

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
  }
}
