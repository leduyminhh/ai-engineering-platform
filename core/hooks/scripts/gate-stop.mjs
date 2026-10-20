#!/usr/bin/env node
// Stop/SubagentStop: chặn một lần khi lượt hiện tại đã sửa file code mà chưa chạy test/lint/build nào sau lần sửa cuối.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
const DOC_FILE = /\.(md|mdx|txt|rst|adoc)$/i;
export const DEFAULT_EXEMPT_AGENTS = ['data-migration-writer'];

// Neo ^ vào đầu từng đoạn lệnh để "echo npm test" hay "cat test/a.js" không bị tính là đã chạy test.
const DEFAULT_TEST_PATTERNS = [
  /^(?:\S*[\\/])?(vitest|jest|mocha|tsc|eslint|pytest|ruff|mypy|rspec)(\.(exe|cmd))?(\s|$)/,
  /^bundle exec rspec\b/,
  /^node\s+(--test\b|(\.[\\/])?test[\\/])/,
  /^(\.[\\/])?mvnw?(\.cmd)?\b.*\b(test|verify|compile)\b/,
  /^(\.[\\/])?gradlew?(\.bat)?\b.*\b(test|check|build)\b/,
  /^(?:\S*[\\/])?(python3?|py)(\.exe)?\s+(-m\s+(pytest|unittest)\b|\S*manage\.py\s+test\b)/,
  /^(uv|poetry|pipenv) run (python3? -m )?(pytest|unittest|ruff|mypy)\b/,
  /^(go (test|build|vet)|cargo (test|build|check|clippy)|dotnet (test|build))\b/,
  /^make(\s+-\S+)*\s+(test|check)\b/,
];

const SCRIPT = /^(test|build|lint|typecheck|type-check|check)(:[\w:-]*)?$/;
const TOOL = /^(vitest|jest|mocha|playwright test|tsc|eslint)\b/;
// Tuỳ chọn nhận một giá trị riêng (npm --prefix app, pnpm -C app); '-w' của pnpm là cờ nên không nằm trong tập của pnpm.
const VALUE_OPTS = { npm: ['--prefix', '-w', '--workspace'], pnpm: ['-C', '--dir', '--filter', '-F'], yarn: ['--cwd'], bun: ['--cwd', '--filter'] };

// Duyệt theo token thay vì regex lồng nhau để thời gian khớp luôn tuyến tính.
function skipOptions(tokens, i, withValue = []) {
  while (i < tokens.length && tokens[i].startsWith('-')) i += withValue.includes(tokens[i]) ? 2 : 1;
  return i;
}

function isPackageCommand(tokens) {
  const mgr = tokens[0];
  const rest = tokens.slice(1);
  const withValue = VALUE_OPTS[mgr];
  let i = skipOptions(rest, 0, withValue);
  if (mgr === 'yarn' && rest[i] === 'workspace') i = skipOptions(rest, i + 2, withValue);
  const sub = rest[i];
  if (!sub) return false;
  if (sub === 'run' || sub === 'run-script') return SCRIPT.test(rest[skipOptions(rest, i + 1, withValue)] || '');
  if (sub === 'exec' || sub === 'dlx' || sub === 'x') return TOOL.test(rest.slice(skipOptions(rest, i + 1, withValue)).join(' '));
  if (mgr === 'npm') return sub === 'test' || sub === 't' || sub === 'tst';
  return SCRIPT.test(sub) || TOOL.test(rest.slice(i).join(' '));
}

function isNpxCommand(tokens) {
  const rest = tokens.slice(1);
  return TOOL.test(rest.slice(skipOptions(rest, 0, ['-p', '--package'])).join(' '));
}

// Bỏ tiền tố không đổi ý nghĩa lệnh: VAR=x, time, env, timeout <n>.
function stripPrefixes(seg) {
  for (let s = seg.trim(); ; ) {
    const n = s.replace(/^(?:\w+=\S*|time|env|timeout\s+\d+\w*)\s+/, '');
    if (n === s) return s;
    s = n;
  }
}

export function isTestCommand(command, extra = []) {
  const patterns = [...DEFAULT_TEST_PATTERNS, ...extra];
  return String(command || '').split(/&&|\|\||;|\||\n/)
    .map(stripPrefixes)
    .some((seg) => {
      if (!seg) return false;
      const tokens = seg.split(/\s+/);
      if (Object.hasOwn(VALUE_OPTS, tokens[0]) && isPackageCommand(tokens)) return true;
      if (['npx', 'bunx', 'pnpx'].includes(tokens[0]) && isNpxCommand(tokens)) return true;
      return patterns.some((re) => re.test(seg));
    });
}

function loadConfig(cwd) {
  try {
    const root = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return JSON.parse(readFileSync(path.join(root, '.claude', 'aip-gate.json'), 'utf8').replace(/^﻿/, ''));
  } catch { return null; }
}

function parseLine(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function isPromptLine(o) {
  // isCompactSummary: auto-compact giữa lượt chèn dòng user tóm tắt; coi là prompt mới thì các lần sửa trước đó bị bỏ sót.
  if (o?.type !== 'user' || o.isMeta || o.isCompactSummary === true) return false;
  const c = o.message?.content;
  return typeof c === 'string' || (Array.isArray(c) && c.some((p) => p?.type !== 'tool_result'));
}

// Chỉ parse từ cuối lên tới prompt người dùng gần nhất: transcript dài hàng MB không phải parse hết.
function currentTurn(text, wholeFile) {
  const lines = text.split('\n');
  const out = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].trim()) continue;
    const o = parseLine(lines[i]);
    if (!wholeFile && isPromptLine(o)) break;
    if (o) out.push(o);
  }
  return out.reverse();
}

export function decide(input, deps = {}) {
  try {
    const { readFile = (p) => readFileSync(p, 'utf8'), loadConfig: load = loadConfig, env = process.env } = deps;
    if (input?.stop_hook_active === true || String(env.AIP_STOP_GATE || '').toLowerCase() === 'off') return null;
    const cfg = load(path.resolve(input?.cwd || '.'));
    if (cfg?.stopGate === false) return null;
    const sub = input?.hook_event_name === 'SubagentStop';
    if (sub) {
      const exempt = Array.isArray(cfg?.exemptAgents) ? cfg.exemptAgents : DEFAULT_EXEMPT_AGENTS;
      if (exempt.includes(String(input.agent_type || '').split(':').pop())) return null;
    }
    const file = sub ? input.agent_transcript_path : input?.transcript_path;
    if (typeof file !== 'string' || !file) return null;
    const extra = [];
    for (const s of Array.isArray(cfg?.testCommands) ? cfg.testCommands : []) {
      if (typeof s !== 'string') continue;
      try { extra.push(new RegExp(s)); } catch { /* regex sai chỉ bỏ qua mẫu đó */ }
    }
    let pos = 0;
    let lastEdit = -1;
    let lastTest = -1;
    const edited = [];
    for (const o of currentTurn(readFile(file), sub)) {
      if (o.type !== 'assistant' || !Array.isArray(o.message?.content)) continue;
      for (const part of o.message.content) {
        if (part?.type !== 'tool_use') continue;
        pos++;
        const inp = part.input;
        if (EDIT_TOOLS.has(part.name)) {
          const p = inp?.file_path ?? inp?.notebook_path;
          if (typeof p !== 'string' || !p || DOC_FILE.test(p)) continue;
          lastEdit = pos;
          if (!edited.includes(p)) edited.push(p);
        } else if (SHELL_TOOLS.has(part.name) && typeof inp?.command === 'string' && isTestCommand(inp.command, extra)) {
          lastTest = pos;
        }
      }
    }
    if (lastEdit < 0 || lastTest > lastEdit) return null;
    return {
      decision: 'block',
      reason: `Lượt này đã sửa ${edited.length} file code (${edited.slice(0, 3).join(', ')}${edited.length > 3 ? ', …' : ''}) nhưng chưa chạy test/lint/build nào sau lần sửa cuối. `
        + 'Hãy chạy kiểm tra liên quan và báo kết quả, hoặc nói rõ vì sao bỏ qua. (Người dùng có thể tắt gate này bằng AIP_STOP_GATE=off hoặc "stopGate": false trong .claude/aip-gate.json.)',
    };
  } catch { return null; }
}

function main() {
  let input;
  // Pipe từ PowerShell 5.1 chèn BOM vào đầu stdin; JSON.parse lỗi sẽ làm hook im lặng cho qua.
  try { input = JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, '')); } catch { return; }
  const d = decide(input);
  if (!d) return;
  process.stdout.write(JSON.stringify({ decision: d.decision, reason: d.reason }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch { /* fail-open: lỗi nội bộ không được chặn phiên làm việc */ }
  // Không process.exit(): để stdout được xả hết khi đầu ra là pipe.
  process.exitCode = 0;
}
