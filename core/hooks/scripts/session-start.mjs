#!/usr/bin/env node
// SessionStart: nạp handoff.md khi mở phiên mới (startup/clear/compact) và cảnh báo khi resume/fork phiên đã nguội cache.
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readGateConfig } from './gate-config.mjs';

// Claude Code giới hạn additionalContext ở 10.000 ký tự; chừa chỗ cho phần bọc.
const MAX_CHARS = 9000;
// Chặn file rỗng hoặc chỉ còn khung heading của template.
const MIN_CHARS = 80;
const DEFAULT_MAX_AGE_HOURS = 24;
const HOUR_MS = 3600000;

function findHandoff(cwd, cfg, d) {
  const exists = (p) => { try { return d.existsSync(p); } catch { return false; } };
  if (typeof cfg?.handoffPath === 'string' && cfg.handoffPath) {
    const p = path.resolve(cwd, cfg.handoffPath);
    if (exists(p)) return p;
  }
  const reqDir = path.join(cwd, 'docs', 'requests');
  let best = null;
  let bestTime = -Infinity;
  if (exists(reqDir)) {
    for (const name of d.readdirSync(reqDir)) {
      const p = path.join(reqDir, String(name), 'handoff.md');
      if (!exists(p)) continue;
      const t = d.statSync(p).mtimeMs;
      if (t > bestTime) { best = p; bestTime = t; }
    }
  }
  if (best) return best;
  const fallback = path.join(cwd, '.claude', 'handoff.md');
  return exists(fallback) ? fallback : null;
}

function resumeLine(input, handoff, cwd) {
  const parts = ['Phiên nguội: mở lại tốn'];
  const tokens = input.context_tokens;
  const usd = input.estimated_cache_write_usd;
  if (Number.isFinite(tokens)) parts.push(`~${tokens} token không cache`);
  if (Number.isFinite(usd)) parts.push(`(~${usd} USD)`);
  // Chỉ có tiền tố "mở lại tốn" mà không có số liệu thì câu vô nghĩa; bỏ hẳn phần chi phí.
  const cost = parts.length > 1 ? parts.join(' ') + '.' : 'Phiên nguội: cache prompt đã hết hạn.';
  const rel = handoff ? path.relative(cwd, handoff).split(path.sep).join('/') : '';
  return `${cost} Cân nhắc mở phiên mới${rel ? ` từ ${rel}` : ''}.`;
}

export function decide(input, deps = {}) {
  try {
    const d = { readFile: (p) => readFileSync(p, 'utf8'), existsSync, statSync, readdirSync, now: Date.now, loadConfig: readGateConfig, ...deps };
    const cwd = path.resolve(input?.cwd || '.');
    const cfg = d.loadConfig(cwd);
    const source = input?.source;
    if (source === 'resume' || source === 'fork') {
      if (cfg?.resumeWarn === false || input.prompt_cache_likely_expired !== true) return null;
      return { additionalContext: resumeLine(input, findHandoff(cwd, cfg, d), cwd) };
    }
    if (source !== 'startup' && source !== 'clear' && source !== 'compact') return null;
    if (cfg?.handoffInject === false) return null;
    const file = findHandoff(cwd, cfg, d);
    if (!file) return null;
    const maxAge = Number.isFinite(cfg?.handoffMaxAgeHours) ? cfg.handoffMaxAgeHours : DEFAULT_MAX_AGE_HOURS;
    if (d.now() - d.statSync(file).mtimeMs > maxAge * HOUR_MS) return null;
    const text = String(d.readFile(file)).replace(/^﻿/, '');
    if (text.replace(/^#.*$/gm, '').trim().length < MIN_CHARS) return null;
    const rel = path.relative(cwd, file).split(path.sep).join('/');
    return { additionalContext: `Handoff của phiên trước (${rel}):\n${text}`.slice(0, MAX_CHARS) };
  } catch { return null; }
}

function main() {
  let input;
  // Pipe từ PowerShell 5.1 chèn BOM vào đầu stdin; JSON.parse lỗi sẽ làm hook im lặng cho qua.
  try { input = JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, '')); } catch { return; }
  const r = decide(input);
  if (!r) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: r.additionalContext } }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch { /* fail-open: lỗi nội bộ không được chặn phiên làm việc */ }
  // Không process.exit(): để stdout được xả hết khi đầu ra là pipe.
  process.exitCode = 0;
}
