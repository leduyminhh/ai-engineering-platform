#!/usr/bin/env node
// PreToolUse(mcp__.*): chặn tool của server MCP theo mcpAllow/mcpDeny trong <git-root>/.claude/aip-gate.json.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readGate, fullEffective } from './gate-config.mjs';

// mcp__<server>__<tool> → server; mcp__plugin_<plugin>_<server>__<tool> → "plugin:<plugin>:<server>" (tên plugin không chứa "_").
export function parseMcpTool(name) {
  const m = /^mcp__(.+?)__(.+)$/s.exec(String(name ?? ''));
  if (!m) return null;
  const p = /^plugin_([^_]+)_(.+)$/s.exec(m[1]);
  return { server: p ? `plugin:${p[1]}:${p[2]}` : m[1] };
}

// Chỉ nhận mảng chuỗi; phần tử sai kiểu bị bỏ, khoảng trắng hai đầu được cắt (phân biệt hoa thường), mảng rỗng sau lọc coi như không khai báo.
function nameList(v) {
  if (!Array.isArray(v)) return null;
  const s = v.filter((x) => typeof x === 'string').map((x) => x.trim()).filter(Boolean);
  return s.length ? s : null;
}

export function decide(input, { config, tracked } = {}) {
  const t = parseMcpTool(input?.tool_name);
  if (!t) return null;
  const gate = config === undefined ? readGate(input?.cwd) : { config };
  const cfg = gate?.config;
  if (!cfg || typeof cfg !== 'object') return null;
  const deny = nameList(cfg.mcpDeny);
  const allow = nameList(cfg.mcpAllow);
  if (deny?.includes(t.server)) return { decision: 'deny', reason: `Server MCP "${t.server}" nằm trong mcpDeny của .claude/aip-gate.json — gỡ khỏi mcpDeny nếu cần dùng.` };
  // full hiệu lực chỉ mở mcpAllow; mcpDeny là chặn tường minh của người dùng nên vẫn giữ.
  if (allow && !allow.includes(t.server) && !fullEffective(gate, input, { tracked })) return { decision: 'deny', reason: `Server MCP "${t.server}" không nằm trong mcpAllow của .claude/aip-gate.json — thêm vào mcpAllow nếu cần dùng.` };
  return null;
}

function main() {
  let input;
  // Pipe từ PowerShell 5.1 chèn BOM vào đầu stdin; JSON.parse lỗi sẽ làm hook im lặng cho qua.
  try { input = JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, '')); } catch { return; }
  const d = decide(input);
  if (!d) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: d.decision, permissionDecisionReason: d.reason } }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch { /* fail-open: lỗi nội bộ không được chặn phiên làm việc */ }
  // Không process.exit(): để stdout được xả hết khi đầu ra là pipe.
  process.exitCode = 0;
}
