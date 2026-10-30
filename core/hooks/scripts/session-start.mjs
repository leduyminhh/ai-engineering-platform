#!/usr/bin/env node
// SessionStart: nạp quy tắc bootstrap gọi skill, handoff.md và đuôi ledger của plan đang chạy khi mở phiên mới (startup/clear/compact) và cảnh báo khi resume/fork phiên đã nguội cache.
import { readFileSync, existsSync, statSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readGateConfig, resolveGate } from './gate-config.mjs';

// Claude Code giới hạn additionalContext ở 10.000 ký tự; chừa chỗ cho phần bọc. Bootstrap, ledger và handoff chia chung ngân sách này.
const MAX_TOTAL = 9000;
// Chặn file rỗng hoặc chỉ còn khung heading của template.
const MIN_CHARS = 80;
// Trần của riêng phần ledger; handoff nhường phần còn lại của MAX_TOTAL.
const LEDGER_MAX_CHARS = 2000;
// `Part: complete <hash>` đóng ledger của một part, `Plan: complete` đóng ledger root; dòng `Part <nn>: merged` ở root không phải dấu hiệu xong.
const LEDGER_DONE_RE = /^(?:Plan: complete\s*$|Part: complete\b)/m;
const DEFAULT_MAX_AGE_HOURS = 24;
const HOUR_MS = 3600000;

// Bản tóm tắt của skill using-aip, chép nhỏ vào hook vì hook không phụ thuộc bố cục thư mục của bản build; ≤ 1200 ký tự (test kiểm).
const BOOTSTRAP = 'AIP — quy tắc nền của phiên này. Nếu có khả năng, dù nhỏ, một skill áp dụng cho việc đang làm thì gọi skill đó trước khi trả lời, '
  + 'hỏi lại hay đọc code; skill `using-aip` nêu thứ tự ưu tiên và các dấu hiệu tự biện minh để bỏ qua skill. '
  + 'Yêu cầu của người dùng và quy tắc project (CLAUDE.md, AGENTS.md) ưu tiên hơn skill. '
  + 'Skill đã đọc mà không áp dụng thì nói một dòng rồi bỏ qua; ngoài ra chỉ bỏ qua khi người dùng nói rõ. Agent worker được giao một task cụ thể thì bỏ qua đoạn này.';

function within(root, p) {
  const rel = path.relative(root, p);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// Workspace `.aip` nằm ở gốc repo chính, nhưng skill có thể lùi về gốc worktree khi không ghi được; cả hai đều là ứng viên.
// Git lỗi hoặc không phải repo thì chỉ còn cwd: hook phải mở được phiên, không được chặn vì không dò được gốc.
// Chép quy ước đường dẫn của workspace.mjs thay vì import để hook và skill cài độc lập.
function aipRoots(cwd, d) {
  if (d.aipRoots) return d.aipRoots;
  let g = null;
  try { g = d.gitRoots(cwd); } catch { /* git lỗi: chỉ dùng cwd */ }
  const found = [g?.main, g?.top].filter(Boolean).map((r) => path.resolve(r));
  return (d.aipRoots = [...new Set(found.length ? found : [cwd])]);
}

// Liệt kê `.aip/runs/<request>/...` ở mọi gốc; mục không đọc được thì bỏ qua.
function aipRuns(cwd, d) {
  const out = [];
  for (const root of aipRoots(cwd, d)) {
    const runs = path.join(root, '.aip', 'runs');
    try {
      for (const req of d.readdirSync(runs)) out.push({ req: String(req), dir: path.join(runs, String(req)), root });
    } catch { /* gốc này chưa có .aip */ }
  }
  return out;
}

// File `.aip` ở gốc repo chính nằm ngoài cwd của worktree; đường tương đối `../../..` khó đọc nên in đường dẫn tuyệt đối.
function show(cwd, p) {
  return (within(cwd, p) ? path.relative(cwd, p) : p).split(path.sep).join('/');
}

// Theo symlink: .aip, docs và .claude là nội dung repo, một symlink (ở file hay ở thư mục request) trỏ ra ngoài gốc của nó
// sẽ kéo file bất kỳ vào context; nên chỉ nhận file có đường dẫn thật nằm trong đường dẫn thật của gốc chứa nó.
const real = (d, p) => { try { return d.realpath(p); } catch { return p; } };
const inside = (d, root, p) => within(real(d, root), real(d, p));

// Template chưa điền chỉ còn heading, `<…>`, nhãn và dấu list rỗng; các phần đó không tính vào nội dung thật.
function substantive(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>\n]*>/g, '').replace(/^#.*$/gm, '')
    .replace(/\*\*[^*\n]*\*\*:?/g, '').replace(/``/g, '').replace(/^\s*(?:[-*+]|\d+\.)\s*$/gm, '').trim();
}

// Handoff dùng được = tồn tại, trong gốc, chưa quá tuổi và đã điền; dùng chung cho nạp ngữ cảnh và dòng cảnh báo resume.
// Lọc tuổi/nội dung ngay ở từng nguồn rồi mới rơi xuống nguồn kế, để handoff cũ hoặc rỗng ở nguồn ưu tiên không che nguồn thấp hơn.
function usableHandoff(cwd, cfg, d) {
  const maxAge = Number.isFinite(cfg?.handoffMaxAgeHours) ? cfg.handoffMaxAgeHours : DEFAULT_MAX_AGE_HOURS;
  const probe = ([p, root]) => {
    try {
      if (!d.existsSync(p) || !inside(d, root, p)) return null;
      const t = d.statSync(p).mtimeMs;
      return d.now() - t > maxAge * HOUR_MS ? null : { file: p, t };
    } catch { return null; }
  };
  const load = (c) => {
    try {
      const text = String(d.readFile(c.file)).replace(/^\uFEFF/, '');
      return substantive(text).length < MIN_CHARS ? null : { file: c.file, text };
    } catch { return null; }
  };
  // Mỗi nguồn là hàm lười: docs/requests chỉ được liệt kê khi các nguồn ưu tiên hơn không có handoff dùng được.
  const sources = [
    () => {
      if (typeof cfg?.handoffPath !== 'string' || !cfg.handoffPath) return [];
      const p = path.resolve(cwd, cfg.handoffPath);
      // aip-gate.json nằm trong repo nên handoffPath không đáng tin: chỉ nhận file .md trong project, kể cả sau khi theo symlink.
      // shortcut: so với cwd của phiên, không phải gốc git; phiên mở ở thư mục con thì handoffPath trỏ lên trên bị bỏ qua.
      return /\.md$/i.test(p) && within(cwd, p) ? [[p, cwd]] : [];
    },
    () => aipRuns(cwd, d).map((r) => [path.join(r.dir, 'handoff.md'), r.root]),
    () => {
      const reqDir = path.join(cwd, 'docs', 'requests');
      return d.readdirSync(reqDir).map((name) => [path.join(reqDir, String(name), 'handoff.md'), cwd]);
    },
    () => [[path.join(cwd, '.claude', 'handoff.md'), cwd]],
  ];
  for (const source of sources) {
    let cands = [];
    try { cands = source().map(probe).filter(Boolean); } catch { /* nguồn không liệt kê được: rơi xuống nguồn kế */ }
    for (const c of cands.sort((a, b) => b.t - a.t)) {
      const h = load(c);
      if (h) return h;
    }
  }
  return null;
}

// Ledger chưa xong có mtime mới nhất; file hỏng, đã `Plan: complete` hoặc cũ hơn handoffMaxAgeHours (plan bỏ dở) bị bỏ qua.
// Chép nhỏ thay vì import skill plan-execution để hook tự đứng, không phụ thuộc bố cục thư mục của bản build.
function ledgerSection(cwd, cfg, d) {
  const maxAge = Number.isFinite(cfg?.handoffMaxAgeHours) ? cfg.handoffMaxAgeHours : DEFAULT_MAX_AGE_HOURS;
  const cands = [];
  const consider = (p, root) => {
    try {
      if (!d.existsSync(p) || !inside(d, root, p)) return;
      const t = d.statSync(p).mtimeMs;
      if (d.now() - t <= maxAge * HOUR_MS) cands.push({ p, t });
    } catch { /* mục không đọc được: bỏ qua */ }
  };
  const runs = aipRuns(cwd, d);
  for (const { dir, root } of runs) {
    try { for (const part of d.readdirSync(dir)) consider(path.join(dir, String(part), 'progress.md'), root); } catch { /* request không đọc được: bỏ qua */ }
  }
  // Request đã chuyển sang .aip thì .sdd cũ của nó là bản chép lỗi thời, kể cả khi mới hơn; không nạp lại.
  const migrated = new Set(runs.map((r) => r.req));
  const reqDir = path.join(cwd, 'docs', 'requests');
  let legacy = [];
  try { legacy = d.readdirSync(reqDir); } catch { /* không có docs/requests */ }
  for (const name of legacy) if (!migrated.has(String(name))) consider(path.join(reqDir, String(name), '.sdd', 'progress.md'), cwd);
  for (const { p } of cands.sort((a, b) => b.t - a.t)) {
    try {
      const text = String(d.readFile(p)).replace(/^\uFEFF/, '');
      if (LEDGER_DONE_RE.test(text)) continue;
      const head = `Ledger (${show(cwd, p)}):\n`;
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
  const rel = handoff ? show(cwd, handoff) : '';
  return `${cost} Cân nhắc mở phiên mới${rel ? ` từ ${rel}` : ''}.`;
}

export function decide(input, deps = {}) {
  try {
    const d = { readFile: (p) => readFileSync(p, 'utf8'), existsSync, statSync, readdirSync, realpath: realpathSync.native, now: Date.now, loadConfig: readGateConfig, gitRoots: (dir) => { const g = resolveGate(dir); return g && { top: g.top, main: g.main }; }, ...deps };
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
      try { ledger = ledgerSection(cwd, cfg, d); } catch { /* ledger hỏng không được chặn handoff */ }
    }
    const parts = [];
    // Bootstrap đứng đầu và trừ khỏi ngân sách chung để tổng không vượt MAX_TOTAL.
    const boot = cfg?.bootstrapInject !== false;
    if (boot) parts.push(BOOTSTRAP);
    if (cfg?.handoffInject !== false) {
      try {
        const h = usableHandoff(cwd, cfg, d);
        const room = MAX_TOTAL - (ledger ? ledger.length + 2 : 0) - (boot ? BOOTSTRAP.length + 2 : 0);
        if (h) parts.push(`Handoff của phiên trước (${show(cwd, h.file)}):\n${h.text}`.slice(0, room));
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
