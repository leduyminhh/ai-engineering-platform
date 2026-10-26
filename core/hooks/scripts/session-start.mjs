#!/usr/bin/env node
// SessionStart: nạp handoff.md và đuôi ledger của plan đang chạy khi mở phiên mới (startup/clear/compact) và cảnh báo khi resume/fork phiên đã nguội cache.
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readGateConfig } from './gate-config.mjs';

// Claude Code giới hạn additionalContext ở 10.000 ký tự; chừa chỗ cho phần bọc. Handoff và ledger chia chung ngân sách này.
const MAX_TOTAL = 9000;
// Chặn file rỗng hoặc chỉ còn khung heading của template.
const MIN_CHARS = 80;
// Trần của riêng phần ledger; handoff nhường phần còn lại của MAX_TOTAL.
const LEDGER_MAX_CHARS = 2000;
const LEDGER_DONE_RE = /^Plan: complete\s*$/m;
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

// Template chưa điền chỉ còn heading, `<…>`, nhãn và dấu list rỗng; các phần đó không tính vào nội dung thật.
function substantive(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>\n]*>/g, '').replace(/^#.*$/gm, '')
    .replace(/\*\*[^*\n]*\*\*:?/g, '').replace(/``/g, '').replace(/^\s*(?:[-*+]|\d+\.)\s*$/gm, '').trim();
}

// Handoff dùng được = tồn tại, chưa quá tuổi và đã điền; dùng chung cho nạp ngữ cảnh và dòng cảnh báo resume.
function usableHandoff(cwd, cfg, d) {
  const file = findHandoff(cwd, cfg, d);
  if (!file) return null;
  const maxAge = Number.isFinite(cfg?.handoffMaxAgeHours) ? cfg.handoffMaxAgeHours : DEFAULT_MAX_AGE_HOURS;
  if (d.now() - d.statSync(file).mtimeMs > maxAge * HOUR_MS) return null;
  const text = String(d.readFile(file)).replace(/^\uFEFF/, '');
  return substantive(text).length < MIN_CHARS ? null : { file, text };
}

// Ledger chưa xong có mtime mới nhất; file hỏng hoặc đã `Plan: complete` bị bỏ qua. Chép nhỏ thay vì import
// skill plan-execution để hook tự đứng, không phụ thuộc bố cục thư mục của bản build.
function ledgerSection(cwd, d) {
  const reqDir = path.join(cwd, 'docs', 'requests');
  const cands = [];
  for (const name of d.readdirSync(reqDir)) {
    try {
      const p = path.join(reqDir, String(name), '.sdd', 'progress.md');
      if (d.existsSync(p)) cands.push({ p, t: d.statSync(p).mtimeMs });
    } catch { /* mục không đọc được: bỏ qua */ }
  }
  for (const { p } of cands.sort((a, b) => b.t - a.t)) {
    try {
      const text = String(d.readFile(p)).replace(/^\uFEFF/, '');
      if (LEDGER_DONE_RE.test(text)) continue;
      const head = `Ledger (${path.relative(cwd, p).split(path.sep).join('/')}):\n`;
      return head + text.slice(Math.max(0, text.length - (LEDGER_MAX_CHARS - head.length)));
    } catch { /* ledger hỏng: thử ledger kế tiếp */ }
  }
  return null;
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
      return { additionalContext: resumeLine(input, (() => { try { return usableHandoff(cwd, cfg, d)?.file; } catch { return null; } })(), cwd) };
    }
    if (source !== 'startup' && source !== 'clear' && source !== 'compact') return null;
    let ledger = null;
    if (cfg?.ledgerInject !== false) {
      try { ledger = ledgerSection(cwd, d); } catch { /* ledger hỏng không được chặn handoff */ }
    }
    const parts = [];
    if (cfg?.handoffInject !== false) {
      try {
        const h = usableHandoff(cwd, cfg, d);
        const room = MAX_TOTAL - (ledger ? ledger.length + 2 : 0);
        if (h) parts.push(`Handoff của phiên trước (${path.relative(cwd, h.file).split(path.sep).join('/')}):\n${h.text}`.slice(0, room));
      } catch { /* handoff hỏng không được chặn ledger */ }
    }
    if (ledger) parts.push(ledger);
    return parts.length ? { additionalContext: parts.join('\n\n') } : null;
  } catch { return null; }
}

function main() {
  let input;
  // Pipe từ PowerShell 5.1 chèn BOM vào đầu stdin; JSON.parse lỗi sẽ làm hook im lặng cho qua.
  try { input = JSON.parse(readFileSync(0, 'utf8').replace(/^\uFEFF/, '')); } catch { return; }
  const r = decide(input);
  if (!r) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: r.additionalContext } }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch { /* fail-open: lỗi nội bộ không được chặn phiên làm việc */ }
  // Không process.exit(): để stdout được xả hết khi đầu ra là pipe.
  process.exitCode = 0;
}
