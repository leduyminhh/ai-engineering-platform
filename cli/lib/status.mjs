// aip status — xem tiến trình request chia part, chỉ đọc: Bảng part, plan, ledger + events.jsonl, git log nhánh part. Zero-dependency.
// Một mô hình JSON dựng một lần; text, JSON và HTML đều render từ mô hình đó.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parsePartTable, requestStatusToken, STATUSES } from '../../core/skills/artifact-templates/scripts/check-request.mjs';
import { parsePartition, normPath } from '../../core/skills/artifact-templates/scripts/check-partition.mjs';
import { readGateConfig } from '../../core/hooks/scripts/gate-config.mjs';

export const DEFAULT_STALE_MINUTES = 30;
export const STATE_LABELS = {
  blocked: 'vướng', merged: 'merged', done: 'xong chờ merge', waiting: 'chờ part phụ thuộc',
  stale: 'im lặng quá lâu', active: 'đang làm', todo: 'chưa làm',
};
const WATCH_SECONDS = 10;
const REQUEST_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const DONE_RE =/^Plan: complete\s*$/m;
// Chỉ dòng theo định dạng plan-execution; "Task 1: started …" là ghi chú tự do cũ, không có nghĩa part đã bắt đầu.
const TASK_EVENT_RE = /^Task \d+: (?:start|review|complete)\b/;
const PROTECTED = new Set(['main', 'master', 'dev', 'develop']);

const defaultGit = (args, cwd) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const tryGit = (git, args, cwd) => { try { return git(args, cwd); } catch { return null; } };
const readText = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return null; } };
const linesOf = (t) => (t ?? '').split(/\r\n|\r|\n/).filter((l) => l.trim());
const mtimeOf = (f) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };
const nnOf = (id) => id.slice(0, 2);

export function staleMinutesOf(config) {
  const v = config?.statusStaleMinutes;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : DEFAULT_STALE_MINUTES;
}

export function mainRoot(cwd = process.cwd(), git = defaultGit) {
  const common = tryGit(git, ['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
  if (!common) return cwd;
  // Submodule: common-dir là <cha>/.git/modules/<tên>, dirname của nó nằm trong .git của repo cha; dùng gốc của chính submodule (cùng guard với route.mjs).
  return path.basename(common) === '.git' ? path.dirname(common) : (tryGit(git, ['rev-parse', '--show-toplevel'], cwd) ?? cwd);
}

const runsDir = (runsRoot, request) => path.join(runsRoot, '.aip', 'runs', ...(request ? [request] : []));

// Vướng = dòng Blocked: mới nhất chưa có Unblocked:, Task <n>: complete hay Part: complete đứng sau nó.
export function blockedReason(lines) {
  let reason = null;
  for (const l of lines) {
    if (/^Blocked:/.test(l)) reason = l.replace(/^Blocked:\s*/, '');
    else if (/^Unblocked:|^Task \d+: complete\b|^Part: complete\b/.test(l)) reason = null;
  }
  return reason;
}

function ledgerDirs(runsRoot, request) {
  try { return fs.readdirSync(runsDir(runsRoot, request), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
}

// Request có ledger dở (root chưa Plan: complete) mà ledger được ghi gần nhất.
export function pickRequest(runsRoot) {
  let best = null;
  let bestTime = -1;
  let names = [];
  // Tên không qua REQUEST_RE (vd có dấu cách) bị runStatus từ chối, nên không chọn làm request mặc định.
  try { names = fs.readdirSync(runsDir(runsRoot), { withFileTypes: true }).filter((d) => d.isDirectory() && REQUEST_RE.test(d.name)).map((d) => d.name); } catch { return null; }
  for (const name of names) {
    if (DONE_RE.test(readText(path.join(runsDir(runsRoot, name), 'root', 'progress.md')) ?? '')) continue;
    const t = Math.max(0, ...ledgerDirs(runsRoot, name).map((p) => mtimeOf(path.join(runsDir(runsRoot, name), p, 'progress.md'))));
    if (t > 0 && t > bestTime) { best = name; bestTime = t; }
  }
  return best;
}

// countBlocked chỉ đọc ledger, không gọi git (caller gọi mainRoot một lần mỗi lần làm mới statusline).
// Đếm cả ledger root: buildStatus cũng đưa root vướng vào "Cần bạn xử lý", nên statusline và trang báo cùng một số.
export function countBlocked(runsRoot) {
  const request = pickRequest(runsRoot);
  if (!request) return 0;
  return ledgerDirs(runsRoot, request).filter((p) => blockedReason(linesOf(readText(path.join(runsDir(runsRoot, request), p, 'progress.md'))))).length;
}

function readEvents(dir) {
  return linesOf(readText(path.join(dir, 'events.jsonl'))).map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((e) => e && typeof e.ts === 'string' && typeof e.line === 'string');
}

function taskDetails(tasks, lines, events) {
  const tsOf = (l) => events.findLast((e) => e.line === l)?.ts ?? null;
  return tasks.map((t) => {
    const mine = (re) => lines.filter((l) => re.test(l));
    const start = mine(new RegExp(`^Task ${t.n}: start\\b`)).at(-1);
    return {
      n: t.n, title: t.title, files: t.files,
      start: start ? (tsOf(start) ?? true) : null,
      complete: mine(new RegExp(`^Task ${t.n}: complete\\b`)).at(-1) ?? null,
      reviews: mine(new RegExp(`^Task ${t.n}: review\\b`)),
      minors: mine(new RegExp(`^minor \\(deferred\\):.*— task ${t.n}\\s*$`)),
    };
  });
}

export function buildStatus({ docsRoot, runsRoot, request, now = Date.now(), staleMinutes = DEFAULT_STALE_MINUTES, git = defaultGit, autonomy = null }) {
  const slug = request.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  const reqDir = path.join(docsRoot, 'docs', 'requests', request);
  const designText = readText(path.join(reqDir, 'design.md'));
  const design = designText ?? '';
  const table = parsePartTable(design);
  // Cỡ "thay đổi nhỏ" chỉ có requirement.md: không có plan nên không có cổng G2, task lấy từ ledger.
  const small = designText === null && readText(path.join(reqDir, 'plan.md')) === null;
  const headBranch = tryGit(git, ['rev-parse', '--abbrev-ref', 'HEAD'], docsRoot);
  // feature/<slug> chỉ là quy ước; session gốc có thể đặt tên khác, nên nhánh đang checkout (không phải nhánh part hay protected) đáng tin hơn.
  const rootBranch = headBranch && headBranch !== 'HEAD' && !PROTECTED.has(headBranch) && !/^worktree-/.test(headBranch) ? headBranch : `feature/${slug}`;
  const rows = table?.rows.length ? table.rows : [{ part: 'root', deps: [], group: null, status: '' }];
  const ledger = (id) => {
    const dir = path.join(runsDir(runsRoot, request), id);
    const file = path.join(dir, 'progress.md');
    return { lines: linesOf(readText(file)), events: readEvents(dir), mtime: mtimeOf(file) };
  };
  const root = ledger('root');
  const mergedNn = new Set(root.lines.map((l) => l.match(/^Part (\d{2})\S*: merged\b/)?.[1]).filter(Boolean));
  for (const r of rows) if (/^merged\b/.test(r.status)) mergedNn.add(nnOf(r.part));

  const parts = rows.map((r) => {
    const id = r.part;
    const lg = id === 'root' ? root : ledger(id);
    const planText = readText(path.join(reqDir, ...(id === 'root' ? ['plan.md'] : ['parts', id, 'plan.md'])));
    // parsePartition viết thường đường dẫn để so trùng; trang phải hiện tên file đúng như plan.
    const original = new Map([...(planText ?? '').matchAll(/`([^`]+)`/g)].map((m) => [normPath(m[1]), m[1].trim()]));
    const tasks = !small
      ? (planText ? parsePartition(planText) : []).map((t) => ({ ...t, files: t.files.map((f) => original.get(f) ?? f) }))
      : [...new Set(lg.lines.map((l) => l.match(/^Task (\d+): (?:start|review|complete)\b/)?.[1]).filter(Boolean))]
        .map((n) => ({ n: Number(n), title: 'theo requirement.md', files: [], consumes: new Set(), produces: new Set() }));
    const branch = id === 'root' ? rootBranch : `worktree-${slug}-p${nnOf(id)}`;
    const log = id === 'root' ? null : tryGit(git, ['log', '--format=%H%x09%ct%x09%s', `${rootBranch}..${branch}`], docsRoot);
    const commits = linesOf(log).map((l) => l.split('\t')).filter((c) => c.length >= 3)
      .map(([hash, ct, ...s]) => ({ hash, ts: new Date(Number(ct) * 1000).toISOString(), subject: s.join('\t') }));
    const done = new Set(lg.lines.map((l) => l.match(/^Task (\d+): complete\b/)?.[1]).filter(Boolean));
    const last = Math.max(lg.mtime, ...lg.events.map((e) => Date.parse(e.ts) || 0), ...commits.map((c) => Date.parse(c.ts)));
    const reason = blockedReason(lg.lines);
    const started = commits.length > 0 || lg.lines.some((l) => TASK_EVENT_RE.test(l));
    let state;
    if (reason !== null) state = 'blocked';
    else if (mergedNn.has(nnOf(id))) state = 'merged';
    else if (lg.lines.some((l) => /^Part: complete\b/.test(l))) state = 'done';
    else if (r.deps.some((d) => !mergedNn.has(nnOf(d)))) state = 'waiting';
    else if (started) state = now - last > staleMinutes * 60_000 ? 'stale' : 'active';
    else state = 'todo';
    return {
      id, deps: r.deps, group: r.group, state, branch, reason,
      tasksDone: done.size, tasksTotal: Math.max(tasks.length, done.size),
      lastActivity: last > 0 ? new Date(last).toISOString() : null,
      _tasks: tasks, _lg: lg, _commits: commits,
    };
  });

  const byNn = new Map(parts.map((p) => [nnOf(p.id), p]));
  const ifaces = (p, k) => new Set(p._tasks.flatMap((t) => [...t[k]]));
  const graph = parts.flatMap((p) => p.deps.map((d) => {
    const from = byNn.get(nnOf(d));
    const produced = from ? ifaces(from, 'produces') : new Set();
    return { from: from?.id ?? d, to: p.id, label: [...ifaces(p, 'consumes')].filter((x) => produced.has(x)) };
  }));

  const allLines = [root, ...parts.filter((p) => p.id !== 'root').map((p) => p._lg)].flatMap((l) => l.lines);
  const events = [
    ...(parts.some((p) => p.id === 'root') ? [] : root.events.map((e) => ({ ts: e.ts, part: 'root', text: e.line }))),
    ...parts.flatMap((p) => [
      ...p._lg.events.map((e) => ({ ts: e.ts, part: p.id, text: e.line })),
      ...p._commits.map((c) => ({ ts: c.ts, part: p.id, text: `commit ${c.hash.slice(0, 7)} ${c.subject}` })),
    ]),
  ].sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));

  const designStatus = design.match(/^- Trạng thái:\s*(\S+)/m)?.[1] ?? '';
  const gates = [
    { id: 'G1', done: /^(approved|in-progress|merged)$/.test(designStatus) },
    ...(small ? [] : [{ id: 'G2', done: allLines.some((l) => TASK_EVENT_RE.test(l)) }]),
    { id: 'G3', done: DONE_RE.test(root.lines.join('\n')) || designStatus === 'merged' },
  ];
  // Request cỡ nhỏ không có design.md nên không có dấu hiệu nào ghi G1: task đã chạy nghĩa là requirement đã duyệt.
  if (small) gates[0].done ||= allLines.some((l) => TASK_EVENT_RE.test(l));
  // Cổng sau xong thì cổng trước đã qua.
  for (let i = gates.length - 2; i >= 0; i--) gates[i].done ||= gates[i + 1].done;
  gates.push({ id: 'push', done: !!tryGit(git, ['branch', '-r', '--contains', rootBranch], docsRoot) });

  const details = Object.fromEntries(parts.map((p) => [p.id, taskDetails(p._tasks, p._lg.lines, p._lg.events)]));
  const clean = parts.map(({ _tasks, _lg, _commits, ...p }) => p);
  // Request chia part: session gốc vướng không có hàng riêng nhưng vẫn là việc của người dùng, và countBlocked (statusline) cũng đếm nó.
  const rootReason = parts.some((p) => p.id === 'root') ? null : blockedReason(root.lines);
  const needs = [
    ...(rootReason === null ? [] : [{ part: 'root', state: 'blocked', reason: rootReason }]),
    ...clean.filter((p) => p.state === 'blocked' || p.state === 'stale')
      .map((p) => ({ part: p.id, state: p.state, reason: p.state === 'blocked' ? p.reason : `không có dòng ledger hay commit mới quá ${staleMinutes} phút` })),
  ];
  return {
    header: {
      request, branch: headBranch, head: tryGit(git, ['rev-parse', '--short', 'HEAD'], docsRoot),
      autonomy, updatedAt: new Date(now).toISOString(), staleMinutes,
    },
    gates,
    needs,
    totals: {
      partsMerged: clean.filter((p) => p.state === 'merged').length, partsTotal: clean.length,
      tasksDone: clean.reduce((a, p) => a + p.tasksDone, 0), tasksTotal: clean.reduce((a, p) => a + p.tasksTotal, 0),
      blocked: needs.filter((n) => n.state === 'blocked').length,
      rulings: allLines.filter((l) => /^Ruling:/.test(l)).length, minors: allLines.filter((l) => /^minor \(deferred\):/.test(l)).length,
    },
    parts: clean, graph, details, events,
  };
}

const findPart = (model, sel) => model.parts.find((p) => p.id === sel || p.id.startsWith(`${sel}-`));
const autonomyText = (a) => (a && typeof a === 'object' ? JSON.stringify(a) : 'mặc định');
// Mô hình giữ ISO UTC (cho --json); người đọc thấy giờ máy: HH:MM nếu cùng ngày với `ref`, không thì dd/mm HH:MM.
const two = (v) => String(v).padStart(2, '0');
function clock(iso, ref) {
  const d = new Date(iso);
  if (typeof iso !== 'string' || Number.isNaN(d.getTime())) return '—';
  const hm = `${two(d.getHours())}:${two(d.getMinutes())}`;
  return ref && new Date(ref).toDateString() === d.toDateString() ? hm : `${two(d.getDate())}/${two(d.getMonth() + 1)} ${hm}`;
}
const totalsText = (t) => `Part merged ${t.partsMerged}/${t.partsTotal} · task ${t.tasksDone}/${t.tasksTotal} · vướng ${t.blocked} · Ruling ${t.rulings} · minor ${t.minors}`;

export function renderText(model, { part } = {}) {
  const h = model.header;
  const out = [
    `aip status — ${h.request} (${h.branch ?? '?'} @ ${h.head ?? '?'}) · autonomy ${autonomyText(h.autonomy)} · cập nhật ${clock(h.updatedAt)}`,
    `Cổng: ${model.gates.map((g) => `${g.id} ${g.done ? '✓' : '·'}`).join(' → ')}`,
  ];
  if (model.needs.length) out.push('Cần bạn xử lý:', ...model.needs.map((n) => `  - ${n.part}: ${STATE_LABELS[n.state]} — ${n.reason}`));
  out.push(totalsText(model.totals), '');
  const w = Math.max(4, ...model.parts.map((p) => p.id.length));
  out.push(`${'Part'.padEnd(w)}  ${'Trạng thái'.padEnd(18)} ${'Task'.padEnd(6)} Phụ thuộc`);
  for (const p of model.parts) out.push(`${p.id.padEnd(w)}  ${STATE_LABELS[p.state].padEnd(18)} ${`${p.tasksDone}/${p.tasksTotal}`.padEnd(6)} ${p.deps.join(', ') || '—'}`);
  if (part !== undefined) {
    const p = findPart(model, part);
    if (!p) out.push('', `Không có part ${part}.`);
    else {
      out.push('', `Part ${p.id} — ${STATE_LABELS[p.state]} (nhánh ${p.branch})`);
      for (const t of model.details[p.id]) {
        out.push(`  Task ${t.n}: ${t.title}${t.complete ? ' ✓' : t.start ? ' …' : ''}`);
        for (const l of [t.complete, ...t.reviews, ...t.minors].filter(Boolean)) out.push(`    ${l}`);
        if (t.files.length) out.push(`    file: ${t.files.join(', ')}`);
      }
      const ev = model.events.filter((e) => e.part === p.id);
      if (ev.length) out.push('  Sự kiện:', ...ev.map((e) => `    ${clock(e.ts, h.updatedAt)} ${e.text}`));
      else if (p.reason) out.push(`  Blocked: ${p.reason}`);
    }
  }
  // Nội dung ledger, commit, tên file là dữ liệu không tin cậy: bỏ ký tự điều khiển để không chèn escape sequence vào terminal.
  return out.join('\n').replace(/\t/g, ' ').replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CSS = `body{font:14px/1.45 system-ui,sans-serif;margin:0;padding:16px;background:#fff;color:#1d1d1f}
section{margin:0 0 20px}h1{font-size:18px;margin:0 0 4px}h2{font-size:15px;margin:0 0 8px}
.muted{color:#6b6b70}.gates span{display:inline-block;padding:2px 10px;border-radius:12px;background:#eee;margin-right:4px}
.gates .done{background:#d6f5dd}.needs{border:2px solid #d93025;border-radius:8px;padding:8px 12px}
table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:4px 8px;border-bottom:1px solid #e5e5e5;vertical-align:top}
.s-blocked{color:#d93025;font-weight:600}.s-stale{color:#b06000}.s-merged,.s-done{color:#188038}.s-waiting,.s-todo{color:#80868b}
.totals span{margin-right:16px}code{font-size:12px}
@media (prefers-color-scheme:dark){body{background:#1d1d1f;color:#e8e8ea}.gates span{background:#333}.gates .done{background:#1e4620}td,th{border-color:#333}.muted{color:#9a9aa0}}`;

export function renderHtml(model, { watch = false } = {}) {
  const h = model.header;
  const state = (s) => `<span class="s-${s}">${esc(STATE_LABELS[s])}</span>`;
  const t = model.totals;
  const parts = model.parts.map((p) => `<tr><td>${esc(p.id)}</td><td>${state(p.state)}</td><td>${p.tasksDone}/${p.tasksTotal}</td><td>${esc(p.deps.join(', ') || '—')}</td><td>${esc(p.group ?? '—')}</td><td class="muted">${esc(clock(p.lastActivity, h.updatedAt))}</td></tr>`).join('');
  const graph = model.graph.length
    ? `<ul>${model.graph.map((e) => `<li>${esc(e.from)} → ${esc(e.to)}${e.label.length ? ` <code>${esc(e.label.join(', '))}</code>` : ''}</li>`).join('')}</ul>`
    : '<p class="muted">Không có phụ thuộc.</p>';
  const details = model.parts.map((p) => {
    const rows = model.details[p.id].map((d) => `<tr><td>Task ${d.n}: ${esc(d.title)}</td><td>${esc(d.start === true ? 'đã start' : d.start ? clock(d.start, h.updatedAt) : '—')}</td><td>${esc(d.complete ?? '—')}</td><td>${d.reviews.map(esc).join('<br>') || '—'}</td><td>${d.minors.map(esc).join('<br>') || '—'}</td><td><code>${esc(d.files.join(', '))}</code></td></tr>`).join('');
    return `<h3>${esc(p.id)} ${state(p.state)}</h3>${rows ? `<table><tr><th>Task</th><th>Start</th><th>Complete (commit đỏ/xanh)</th><th>Review</th><th>Minor</th><th>File</th></tr>${rows}</table>` : '<p class="muted">Chưa có plan part.</p>'}`;
  }).join('');
  const events = model.events.length
    ? `<table>${model.events.map((e) => `<tr><td class="muted">${esc(clock(e.ts, h.updatedAt))}</td><td>${esc(e.part)}</td><td>${esc(e.text)}</td></tr>`).join('')}</table>`
    : '<p class="muted">Chưa có sự kiện có thời điểm (events.jsonl).</p>';
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
${watch ? `<meta http-equiv="refresh" content="${WATCH_SECONDS}">` : ''}<title>aip status — ${esc(h.request)}</title><style>${CSS}</style></head><body>
<section id="header"><h1>${esc(h.request)}</h1><div class="muted">nhánh ${esc(h.branch ?? '?')} · HEAD ${esc(h.head ?? '?')} · autonomy ${esc(autonomyText(h.autonomy))} · cập nhật ${esc(clock(h.updatedAt))}</div></section>
<section id="gates" class="gates">${model.gates.map((g) => `<span class="${g.done ? 'done' : ''}">${esc(g.id)} ${g.done ? '✓' : '·'}</span>`).join('→ ')}</section>
${model.needs.length ? `<section id="needs" class="needs"><h2>Cần bạn xử lý</h2><ul>${model.needs.map((n) => `<li><b>${esc(n.part)}</b> ${state(n.state)} — ${esc(n.reason)}</li>`).join('')}</ul></section>` : ''}
<section id="totals" class="totals"><span>Part merged <b>${t.partsMerged}/${t.partsTotal}</b></span><span>Task <b>${t.tasksDone}/${t.tasksTotal}</b></span><span>Vướng <b>${t.blocked}</b></span><span>Ruling <b>${t.rulings}</b> · minor <b>${t.minors}</b></span></section>
<section id="parts"><h2>Part</h2><table><tr><th>Part</th><th>Trạng thái</th><th>Task</th><th>Phụ thuộc</th><th>Song song</th><th>Hoạt động cuối</th></tr>${parts}</table></section>
<section id="graph"><h2>Phụ thuộc</h2>${graph}</section>
<section id="details"><h2>Chi tiết part</h2>${details}<h2 id="events">Sự kiện</h2>${events}</section>
</body></html>
`;
}

const CLOSED = new Set(['merged', 'abandoned']);

// Request đang mở: mọi thư mục của docs/requests/ trừ _TEMPLATE và trạng thái đã đóng; token lạ hay thiếu dòng là null ("không rõ").
export function listOpenRequests({ docsRoot, git = defaultGit }) {
  const dir = path.join(docsRoot, 'docs', 'requests');
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of entries.filter((d) => d.isDirectory() && d.name !== '_TEMPLATE').sort((a, b) => a.name.localeCompare(b.name))) {
    const line = linesOf(readText(path.join(dir, e.name, 'design.md'))).find((l) => requestStatusToken(l) !== null);
    const token = line ? requestStatusToken(line) : null;
    if (CLOSED.has(token)) continue;
    const branch = `feature/${e.name.replace(/^\d{4}-\d{2}-\d{2}-/, '')}`;
    // Gợi ý thôi: squash/rebase hay nhánh đã xoá không nhận ra. Nhánh vừa tạo chưa có commit riêng trùng HEAD nên cũng là tổ tiên: loại để không báo merge giả.
    // show-ref (không --quiet vì --quiet nuốt luôn sha) lấy sha tại đúng refs/heads/, không để tên nhánh bị đọc thành revision khác.
    const ref = `refs/heads/${branch}`;
    const tip = tryGit(git, ['show-ref', '--verify', '--hash', ref], docsRoot);
    const suspectMerged = !!tip && tip !== tryGit(git, ['rev-parse', 'HEAD'], docsRoot)
      && tryGit(git, ['merge-base', '--is-ancestor', ref, 'HEAD'], docsRoot) !== null;
    out.push({ name: e.name, status: STATUSES.includes(token) ? token : null, suspectMerged });
  }
  return out;
}

function runRequests(args, { docsRoot, out, err, git }) {
  const extra = [args._[1] !== undefined && '<request>', args.html && '--html', args.watch && '--watch', 'part' in args && '--part'].filter(Boolean);
  if (extra.length) { err(`--requests chỉ đi cùng --json, không đi cùng ${extra.join(', ')}.`); return 2; }
  const list = listOpenRequests({ docsRoot, git });
  if (args.json) { out(JSON.stringify({ requests: list }, null, 2)); return 0; }
  if (!list.length) { out('Không có request đang mở trong docs/requests/.'); return 0; }
  const width = Math.max(...list.map((r) => r.name.length));
  for (const r of list) out(`${r.name.padEnd(width)}  ${r.status ?? 'không rõ'}${r.suspectMerged ? '  nghi đã merge' : ''}`);
  return 0;
}

// CLI: trả exit code; --watch giữ tiến trình và ghi lại HTML mỗi 10 giây.
export function runStatus(args, { cwd = process.cwd(), out = console.log, err = console.error, git = defaultGit, rename = fs.renameSync } = {}) {
  const runsRoot = mainRoot(cwd, git);
  const docsRoot = tryGit(git, ['rev-parse', '--show-toplevel'], cwd) ?? cwd;
  if (args.requests) return runRequests(args, { docsRoot, out, err, git });
  if ('part' in args && !args.part) { err('--part cần số part, vd --part 02.'); return 2; }
  const request = args._[1] ?? pickRequest(runsRoot);
  if (!request) { out('Không có request nào đang chạy (chưa có ledger dở trong .aip/runs/).'); return 0; }
  // Tên request đi thẳng vào đường dẫn đọc và ghi status.html: chặn `..`, dấu phân cách và đường dẫn tuyệt đối.
  if (!REQUEST_RE.test(request)) { err(`Tên request không hợp lệ: ${request}.`); return 2; }
  const hasDocs = (r) => fs.existsSync(path.join(r, 'docs', 'requests', request));
  const docs = hasDocs(docsRoot) ? docsRoot : hasDocs(runsRoot) ? runsRoot : null;
  if (!docs && !fs.existsSync(runsDir(runsRoot, request))) { err(`Không tìm thấy request ${request}.`); return 2; }
  const config = readGateConfig(cwd);
  const make = () => buildStatus({ docsRoot: docs ?? docsRoot, runsRoot, request, git, staleMinutes: staleMinutesOf(config), autonomy: config?.autonomy ?? null });
  const html = path.join(runsDir(runsRoot, request), 'status.html');
  const writeHtml = (watch) => {
    fs.mkdirSync(path.dirname(html), { recursive: true });
    // status.html chứa nội dung ledger: bảo đảm git bỏ qua .aip dù plan-execution chưa tạo workspace (vd trước G2).
    const ignore = path.join(runsRoot, '.aip', '.gitignore');
    if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '*\n');
    // Ghi qua file tạm rồi đổi tên để trang đang mở với meta refresh không đọc phải file ghi dở.
    const page = renderHtml(make(), { watch });
    fs.writeFileSync(`${html}.tmp`, page);
    try {
      rename(`${html}.tmp`, html);
    } catch {
      // Windows: đích đang bị trình duyệt hay antivirus giữ thì rename lỗi EPERM; ghi trực tiếp thay vì thất bại.
      fs.writeFileSync(html, page);
      fs.rmSync(`${html}.tmp`, { force: true });
    }
  };
  if (args.watch) {
    writeHtml(true);
    out(`${html} (ghi lại mỗi ${WATCH_SECONDS} giây, Ctrl+C để dừng)`);
    setInterval(() => { try { writeHtml(true); } catch (e) { err(e.message); } }, WATCH_SECONDS * 1000);
    return 0;
  }
  if (args.html) { writeHtml(false); out(html); return 0; }
  const model = make();
  if (args.json) { out(JSON.stringify(model, null, 2)); return 0; }
  out(renderText(model, { part: args.part }));
  return 0;
}
