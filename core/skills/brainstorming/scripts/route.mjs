#!/usr/bin/env node
// Định tuyến tất định: khối `## Định tuyến` của brief.md + hai bảng của orchestrator WORKFLOW.md → route nên chạy.
// Cách dùng: <brief.md> <orchestrator WORKFLOW.md> [--exclude id,id]  → in JSON { chosen, candidates, reason, confidence } (thêm error: 'brief' | 'registry' khi brief hoặc bảng lỗi).
//            --log <brief.md> --chosen <id|-> [--overridden] [--misrouted] → thêm một dòng vào <gốc repo chính>/.aip/routing-log.jsonl.
// Exit 0 khi chạy được (kể cả không khớp), 2 khi thiếu đối số hoặc không đọc được file; ghi nhật ký hỏng chỉ cảnh báo (exit 0).
// Không gọi model. Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const TYPES = ['feature', 'bug', 'quyết-định', 'nghiên-cứu', 'quy-trình', 'tài-liệu', 'nghiệp-vụ', 'không-làm'];
export const SCOPES = ['code-be', 'code-fe', 'fullstack', 'data', 'ops', 'không-code'];
// Ngưỡng và độ chênh là lựa chọn của builder (design "Để builder quyết"): 6 = khớp cả loại-việc lẫn phạm-vi; chênh < 1 là hai ứng viên sát nhau.
export const THRESHOLD = 6;
export const MARGIN = 1;
const COND_FIELDS = ['loại-việc', 'phạm-vi', 'rủi-ro'];
export const COND_RE = new RegExp(`^(${COND_FIELDS.join('|')})(!=|=|~)(.+)$`, 'u');

const lines = (text) => text.replace(/\r\n?/g, '\n').split('\n');
// Hàng thiếu dấu | cuối sẽ mất ô cuối nếu cắt cứng; chỉ bỏ ô cuối khi nó rỗng.
const cells = (line) => {
  if (!line.trim().startsWith('|')) return null;
  const cs = line.trim().split('|').slice(1).map((c) => c.trim());
  if (cs.at(-1) === '') cs.pop();
  return cs;
};
const list = (v) => v.split(',').map((s) => s.trim()).filter(Boolean);
const norm = (s) => s.toLowerCase().normalize('NFC');

function section(text, heading) {
  const ls = lines(text);
  const at = ls.findIndex((l) => l.trim() === `## ${heading}`);
  if (at === -1) return [];
  const end = ls.findIndex((l, i) => i > at && /^## /.test(l));
  return ls.slice(at + 1, end === -1 ? ls.length : end);
}

export function parseBrief(text) {
  const raw = {};
  for (const l of section(text, 'Định tuyến')) {
    const m = l.replace(/^\s*(?:[-*]\s+)?/, '').replace(/\*\*/g, '').match(/^([^:\s][^:]*?)\s*:\s*(.*?)\s*$/u);
    if (m) raw[norm(m[1])] = m[2];
  }
  const type = norm(raw['loại-việc'] ?? '');
  const scope = norm(raw['phạm-vi'] ?? '');
  if (!type || !scope) return null;
  const hints = (raw['ứng-viên-route'] ?? '').replace(/^\[|\]$/g, '');
  return {
    type,
    scope,
    risk: norm(raw['rủi-ro'] ?? ''),
    hints: list(hints).map(norm),
    approved: raw['route-đã-duyệt'] || null,
  };
}

// bad = vị từ không đọc được: bỏ qua im lặng sẽ biến hàng có điều kiện thành hàng luôn khớp, nên routeBrief báo lỗi thay vì đoán.
function parseConds(cell) {
  if (!cell || cell === '—' || cell === '-') return { conds: [], bad: [] };
  const conds = [];
  const bad = [];
  for (const c of list(cell)) {
    const m = c.match(COND_RE);
    if (m) conds.push({ field: m[1], op: m[2], values: m[3].split('/').map((v) => norm(v.trim())) });
    else bad.push(c);
  }
  return { conds, bad };
}

// Đọc cột theo tên tiêu đề nên thứ tự cột không quan trọng; hàng thiếu cột mới có types rỗng, không bao giờ khớp.
export function parseRoutes(text) {
  const rows = [];
  let order = 0;
  for (const [heading, table] of [['Registry', 'registry'], ['Yêu cầu chạy trực tiếp bằng skill', 'direct']]) {
    let col = null;
    for (const l of section(text, heading)) {
      const cs = cells(l);
      if (!cs) continue;
      if (!col) {
        const names = cs.map(norm);
        if (names.includes('id') || names.includes('skill')) col = Object.fromEntries(names.map((n, i) => [n, i]));
        continue;
      }
      if (cs.every((c) => /^:?-+:?$/.test(c))) continue;
      const at = (name) => (col[name] === undefined ? '' : (cs[col[name]] ?? ''));
      let id;
      let kind;
      if (table === 'registry') {
        id = at('id').replace(/`/g, '');
        if (!id.startsWith('workflow-')) continue;
        kind = 'workflow';
      } else {
        const target = at('skill');
        const first = target.startsWith('`') ? target.match(/^`([^`]+)`/) : null;
        id = first ? first[1] : 'làm-trong-phiên';
        kind = first ? 'skill' : 'in-session';
      }
      rows.push({
        id,
        kind,
        types: list(at('loại-việc')).map(norm),
        scopes: list(at('phạm-vi')).map(norm),
        ...parseConds(at('điều-kiện')),
        order: order++,
      });
    }
  }
  return rows;
}

const holds = (brief, c) => {
  const have = c.field === 'loại-việc' ? brief.type : c.field === 'phạm-vi' ? brief.scope : brief.risk;
  if (c.op === '~') return c.values.some((v) => have.includes(v));
  return c.op === '=' ? c.values.includes(have) : !c.values.includes(have);
};
const matches = (values, have) => values.includes('*') || values.includes(have);

export function routeBrief(brief, routes, { exclude = [], priority = [] } = {}) {
  if (!brief) return { chosen: null, candidates: [], reason: 'thiếu khối định tuyến hợp lệ (cần loại-việc và phạm-vi dưới "## Định tuyến")', confidence: 'none', error: 'brief' };
  if (!TYPES.includes(brief.type)) return { chosen: null, candidates: [], reason: `loại-việc "${brief.type}" không thuộc tập đóng (${TYPES.join(', ')})`, confidence: 'none', error: 'brief' };
  if (!SCOPES.includes(brief.scope)) return { chosen: null, candidates: [], reason: `phạm-vi "${brief.scope}" không thuộc tập đóng (${SCOPES.join(', ')})`, confidence: 'none', error: 'brief' };
  const skip = new Set(exclude);
  const broken = routes.find((r) => !skip.has(r.id) && r.bad?.length && matches(r.types, brief.type) && matches(r.scopes, brief.scope));
  if (broken) return { chosen: null, candidates: [], reason: `điều-kiện sai cú pháp ở "${broken.id}": ${broken.bad.join(', ')}`, confidence: 'none', error: 'registry' };
  const hintAt = (id) => brief.hints.indexOf(id);
  const scored = routes
    .filter((r) => !skip.has(r.id) && r.conds.every((c) => holds(brief, c)))
    .map((r) => {
      const h = hintAt(r.id);
      const score = (matches(r.types, brief.type) ? 4 : 0) + (matches(r.scopes, brief.scope) ? 2 : 0) + (h === 0 ? 1 : h > 0 ? 0.5 : 0);
      return { id: r.id, kind: r.kind, score, order: r.order };
    })
    .filter((r) => r.score >= THRESHOLD);
  const rank = (id, order) => { const p = priority.indexOf(id); return p === -1 ? 1000 + order : p; };
  scored.sort((a, b) => b.score - a.score || rank(a.id, a.order) - rank(b.id, b.order));
  if (!scored.length) return { chosen: null, candidates: [], reason: `chưa có quy trình phù hợp cho loại-việc "${brief.type}", phạm-vi "${brief.scope}"`, confidence: 'none' };
  const [top, second] = scored;
  if (second && top.score - second.score < MARGIN) {
    // Hai ứng viên sát điểm: không tự chọn; thứ tự ưu tiên chỉ quyết định hiển thị.
    const pair = scored.filter((r) => top.score - r.score < MARGIN).slice(0, 2).sort((a, b) => rank(a.id, a.order) - rank(b.id, b.order));
    return { chosen: null, candidates: pair.map(({ id, kind, score }) => ({ id, kind, score })), reason: `${pair.map((p) => p.id).join(' và ')} sát điểm nhau (chênh < ${MARGIN})`, confidence: 'low' };
  }
  const candidates = scored.slice(0, 3).map(({ id, kind, score }) => ({ id, kind, score }));
  return { chosen: { id: top.id, kind: top.kind }, candidates, reason: `khớp loại-việc "${brief.type}" và phạm-vi "${brief.scope}"`, confidence: 'high' };
}

const defaultGit = (args, cwd) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();

// Gốc repo chính (không phải gốc worktree) để nhật ký sống qua việc dọn worktree; không có git thì dùng cwd.
function mainRoot(cwd, git) {
  try {
    return path.dirname(git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd));
  } catch {
    return cwd;
  }
}

export function appendRoutingLog(root, record) {
  const dir = path.join(root, '.aip');
  fs.mkdirSync(dir, { recursive: true });
  // Cùng quy ước với workspace.mjs: .aip chứa trạng thái chạy, git phải bỏ qua dù plan-execution chưa tạo workspace.
  const ignore = path.join(dir, '.gitignore');
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '*\n');
  fs.appendFileSync(path.join(dir, 'routing-log.jsonl'), `${JSON.stringify(record)}\n`);
}

function flag(args, name) {
  const i = args.indexOf(name);
  if (i === -1) return { present: false };
  const v = args[i + 1];
  const has = v !== undefined && !v.startsWith('--');
  args.splice(i, has ? 2 : 1);
  return { present: true, value: has ? v : undefined };
}

export function main(argv, deps = {}) {
  const cwd = deps.cwd ?? process.cwd();
  const git = deps.git ?? defaultGit;
  const now = deps.now ?? (() => new Date());
  const args = [...argv];
  const bool = (name) => { const i = args.indexOf(name); if (i !== -1) args.splice(i, 1); return i !== -1; };

  if (bool('--log')) {
    const overridden = bool('--overridden');
    const misrouted = bool('--misrouted');
    const chosen = flag(args, '--chosen');
    const briefPath = args[0];
    if (!briefPath || chosen.value === undefined) { console.error('Cách dùng: route.mjs --log <brief.md> --chosen <id|-> [--overridden] [--misrouted]'); return 2; }
    const root = mainRoot(cwd, git);
    try {
      appendRoutingLog(root, { ts: now().toISOString(), brief: path.resolve(cwd, briefPath), chosen: chosen.value === '-' ? null : chosen.value, overridden, misrouted });
    } catch (e) {
      console.error(`route.mjs: không ghi được routing-log (${e.code ?? e.message}); bỏ qua`);
    }
    return 0;
  }

  const ex = flag(args, '--exclude');
  if (ex.present && ex.value === undefined) { console.error('route.mjs: --exclude cần giá trị id,id'); return 2; }
  const [briefPath, orchPath] = args;
  if (!briefPath || !orchPath) { console.error('Cách dùng: route.mjs <brief.md> <orchestrator WORKFLOW.md> [--exclude id,id]'); return 2; }
  let briefText;
  let orchText;
  try {
    briefText = fs.readFileSync(path.resolve(cwd, briefPath), 'utf8');
    orchText = fs.readFileSync(path.resolve(cwd, orchPath), 'utf8');
  } catch (e) {
    console.error(`route.mjs: không đọc được file (${e.code ?? e.message})`);
    return 2;
  }
  const priority = (lines(orchText).find((l) => l.startsWith('**Thứ tự ưu tiên:**')) ?? '').match(/`workflow-[a-z0-9-]+`/g)?.map((s) => s.replace(/`/g, '')) ?? [];
  console.log(JSON.stringify(routeBrief(parseBrief(briefText), parseRoutes(orchText), { exclude: ex.value ? list(ex.value) : [], priority })));
  return 0;
}

// realpath: cài skills-mode dùng symlink/junction, khi đó argv[1] chưa resolve còn import.meta.url đã resolve.
const isMain = (() => { try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; } })();
if (isMain) process.exit(main(process.argv.slice(2)));
