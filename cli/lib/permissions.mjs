import fs from 'node:fs';
import path from 'node:path';
import { CORE_DIR } from './plugins.mjs';

export const POLICY_PATH = path.join(CORE_DIR, 'permissions', 'policy.json');

// Mỗi nhóm bắt buộc gắn một action cố định để file sinh ra không âm thầm hạ mức bảo vệ.
const REQUIRED_GROUPS = { secrets: 'deny', git_push: 'ask', network: 'ask', production_deploy: 'ask' };

// Chỉ các dạng quy tắc đã đối chiếu tài liệu; ký tự điều khiển bị loại để một quy tắc không thể chứa quy tắc khác.
const RULE_PATTERNS = [
  /^Read\([^()\x00-\x1f\x7f]+\)$/,
  /^Bash\([^()\x00-\x1f\x7f*]*[^()\x00-\x1f\x7f* ] \*\)$/,
  /^WebFetch$/,
  /^mcp__[A-Za-z0-9_-]+__\*$/,
];

export function loadPolicy(file = POLICY_PATH) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
}

export function isValidRule(rule) {
  return typeof rule === 'string' && RULE_PATTERNS.some((re) => re.test(rule));
}

export function checkPolicy(policy) {
  const errs = [];
  if (policy && typeof policy === 'object' && policy.version !== 1) errs.push(`policy: version phải là 1, đang là ${JSON.stringify(policy.version)}`);
  if (!policy || typeof policy !== 'object' || !policy.groups || typeof policy.groups !== 'object') {
    return ['policy: thiếu đối tượng groups'];
  }
  for (const name of Object.keys(policy.groups)) {
    if (!Object.hasOwn(REQUIRED_GROUPS, name)) errs.push(`nhóm lạ: ${name}`);
  }
  for (const [name, action] of Object.entries(REQUIRED_GROUPS)) {
    const g = policy.groups[name];
    if (!g) { errs.push(`thiếu nhóm: ${name}`); continue; }
    if (g.action !== action) errs.push(`${name}: action phải là ${action}, đang là ${JSON.stringify(g.action)}`);
    if (!Array.isArray(g.rules) || g.rules.length === 0) { errs.push(`${name}: rules rỗng`); continue; }
    for (const r of g.rules) if (!isValidRule(r)) errs.push(`${name}: quy tắc không hợp lệ ${JSON.stringify(r)}`);
  }
  return errs;
}

export function buildClaudePermissions(policy) {
  const out = { deny: new Set(), ask: new Set() };
  for (const g of Object.values(policy.groups)) {
    if (!Object.hasOwn(out, g.action)) throw new Error(`policy: action phải là deny hoặc ask, đang là ${JSON.stringify(g.action)}`);
    for (const r of g.rules) out[g.action].add(r);
  }
  return { permissions: { deny: [...out.deny], ask: [...out.ask] } };
}
