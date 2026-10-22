// Phân tích lượt dùng token từ transcript JSONL của Claude Code. Zero-dependency.
// [Unverified] Layout dòng transcript (assistant.usage, cost-state) là nội bộ của Claude Code, không phải hợp đồng công khai.

import fs from 'node:fs';
import path from 'node:path';
import { findTranscripts } from './transcript-stats.mjs';

export const LARGE_CACHE_CREATE = 10000;
export const IDLE_GAP_MS = 60 * 60 * 1000;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function toUsage(u) {
  const cc = u.cache_creation || {};
  return {
    input: num(u.input_tokens),
    cacheRead: num(u.cache_read_input_tokens),
    cacheCreate: num(u.cache_creation_input_tokens),
    cacheCreate1h: num(cc.ephemeral_1h_input_tokens),
    cacheCreate5m: num(cc.ephemeral_5m_input_tokens),
    output: num(u.output_tokens),
  };
}

export function parseUsageLines(lines) {
  const turns = new Map(); // message.id -> Turn; Map giữ thứ tự xuất hiện đầu tiên
  const costStates = [];
  let sessionId = null;
  let anon = 0;

  for (const line of lines) {
    let e;
    // Dòng cuối của phiên đang chạy có thể dở; bỏ qua thay vì làm hỏng cả báo cáo.
    try { e = JSON.parse(line); } catch { continue; }
    if (!e || typeof e !== 'object') continue;
    if (sessionId === null && typeof e.sessionId === 'string') sessionId = e.sessionId;

    if (e.type === 'cost-state') {
      if (typeof e.totalCostUSD !== 'number') continue;
      const modelUsage = {};
      for (const [m, v] of Object.entries(e.modelUsage || {})) modelUsage[m] = { costUSD: num(v?.costUSD) };
      costStates.push({ totalCostUSD: e.totalCostUSD, hasUnknownModelCost: e.hasUnknownModelCost === true, modelUsage });
      continue;
    }
    if (e.type !== 'assistant') continue;
    const msg = e.message || {};
    // <synthetic> là lượt do Claude Code tự chèn, không phát sinh chi phí.
    if (!msg.usage || typeof msg.usage !== 'object' || typeof msg.model !== 'string' || msg.model === '<synthetic>') continue;

    const usage = toUsage(msg.usage);
    const parsed = Date.parse(e.timestamp);
    const ts = Number.isNaN(parsed) ? null : parsed;
    const id = msg.id ?? `anon-${anon++}`;
    const prev = turns.get(id);
    if (!prev) {
      turns.set(id, { id, model: msg.model, ts, usage });
      continue;
    }
    for (const k of Object.keys(usage)) prev.usage[k] = Math.max(prev.usage[k], usage[k]);
    if (ts !== null && (prev.ts === null || ts < prev.ts)) prev.ts = ts;
  }

  return { sessionId, turns: [...turns.values()], costStates };
}

const USAGE_KEYS = ['input', 'cacheRead', 'cacheCreate', 'cacheCreate1h', 'cacheCreate5m', 'output'];
const emptyUsage = () => ({ input: 0, cacheRead: 0, cacheCreate: 0, cacheCreate1h: 0, cacheCreate5m: 0, output: 0, turns: 0 });
const addTurn = (acc, t) => {
  for (const k of USAGE_KEYS) acc[k] += t.usage[k];
  acc.turns++;
};
const tokensOf = (u) => u.input + u.cacheRead + u.cacheCreate + u.output;

export function buildSessionUsage(sessionId, parts, opts = {}) {
  // Cùng message.id có thể nằm ở nhiều file (resume/fork); chuỗi của lần xuất hiện đầu được giữ.
  const merged = new Map();
  parts.forEach((p, idx) => {
    for (const t of p.parsed.turns) {
      // Id giả anon-N được đánh số riêng từng lần parse nên không được gộp chéo giữa các part.
      const key = t.id.startsWith('anon-') ? `${idx}:${t.id}` : t.id;
      const prev = merged.get(key);
      if (!prev) {
        merged.set(key, { ...t, usage: { ...t.usage }, agent: p.agent, part: idx });
        continue;
      }
      for (const k of USAGE_KEYS) prev.usage[k] = Math.max(prev.usage[k], t.usage[k]);
      if (t.ts !== null && (prev.ts === null || t.ts < prev.ts)) prev.ts = t.ts;
    }
  });

  let turns = [...merged.values()];
  if (typeof opts.sinceMs === 'number') turns = turns.filter((t) => t.ts !== null && t.ts >= opts.sinceMs);
  if (turns.length === 0) return null;

  // cost-state là bộ đếm tích lũy nên bản lớn nhất mới đủ. Không tách tiền subagent vì cost-state
  // của phiên gốc đã gồm subagent [Inference] (kết luận ở design).
  let best = null;
  for (const p of parts) for (const c of p.parsed.costStates) if (!best || c.totalCostUSD > best.totalCostUSD) best = c;

  const byModel = {};
  const main = emptyUsage();
  const bySubagent = {};
  const chains = new Map();
  const signals = { modelSwitches: { count: 0, tokens: 0 }, idleGaps: { count: 0, tokens: 0 }, cacheHeavy: { count: 0, tokens: 0 } };
  let firstTs = null;
  let lastTs = null;

  for (const t of turns) {
    byModel[t.model] ??= { ...emptyUsage(), costUsd: best?.modelUsage[t.model]?.costUSD ?? null };
    addTurn(byModel[t.model], t);
    if (t.agent === null) addTurn(main, t);
    else addTurn((bySubagent[t.agent] ??= emptyUsage()), t);
    if (t.ts !== null) {
      if (firstTs === null || t.ts < firstTs) firstTs = t.ts;
      if (lastTs === null || t.ts > lastTs) lastTs = t.ts;
    }

    // Chuỗi = toàn bộ phiên chính, hoặc đúng một lần chạy subagent (theo part); hai lần chạy cùng tên agent không nối nhau.
    const chainKey = t.agent === null ? 'main' : `part:${t.part}`;
    const prev = chains.get(chainKey);
    chains.set(chainKey, t);
    const { input, cacheRead, cacheCreate } = t.usage;
    if (prev && prev.model !== t.model) { signals.modelSwitches.count++; signals.modelSwitches.tokens += cacheCreate; }
    if (t.agent === null && prev && prev.ts !== null && t.ts !== null
      && t.ts - prev.ts > IDLE_GAP_MS && cacheCreate >= LARGE_CACHE_CREATE) {
      signals.idleGaps.count++; signals.idleGaps.tokens += cacheCreate;
    }
    if (cacheCreate * 2 > input + cacheRead + cacheCreate) { signals.cacheHeavy.count++; signals.cacheHeavy.tokens += cacheCreate; }
  }

  const total = tokensOf(main) + Object.values(bySubagent).reduce((a, u) => a + tokensOf(u), 0);
  const sub = total - tokensOf(main);
  return {
    sessionId,
    files: parts.map((p) => p.file),
    costUsd: best ? best.totalCostUSD : null,
    unknownModelCost: best ? best.hasUnknownModelCost : false,
    firstTs,
    lastTs,
    byModel,
    main,
    bySubagent,
    subagentShare: total === 0 ? 0 : sub / total,
    signals,
    sharedTurns: opts.sharedTurns ?? 0,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseSince(value, nowMs) {
  if (value === undefined) return nowMs - 7 * DAY_MS;
  if (typeof value !== 'string') return null;
  if (/^\d+$/.test(value)) {
    const n = Number(value);
    return n > 0 ? nowMs - n * DAY_MS : null;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  // Date.UTC tự cuộn ngày không tồn tại (02-30 → 03-02), nên so lại từng thành phần.
  const back = new Date(ms);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? ms : null;
}

const readLines = (file) => {
  try { return fs.readFileSync(file, 'utf8').split('\n'); } catch { return null; }
};

// Chỉ đọc khóa agentType: các trường khác của meta (vd. description) có thể chứa nội dung hội thoại.
function readAgentType(metaFile) {
  try {
    const t = JSON.parse(fs.readFileSync(metaFile, 'utf8'))?.agentType;
    return typeof t === 'string' && t !== '' ? t : null;
  } catch { return null; }
}

export function loadSessionUsage({ home, cwd, sinceMs }) {
  const groups = new Map(); // sessionId -> parts[]
  const push = (id, part) => { if (!groups.has(id)) groups.set(id, []); groups.get(id).push(part); };

  for (const file of findTranscripts({ home, cwd }).sort()) {
    const lines = readLines(file);
    if (lines === null) continue;
    const base = path.basename(file);
    const stem = base.replace(/\.jsonl$/, '');
    const parsed = parseUsageLines(lines);
    const sessionId = parsed.sessionId ?? stem;
    push(sessionId, { agent: null, file: base, parsed });

    const subDir = path.join(path.dirname(file), stem, 'subagents');
    let names;
    try { names = fs.readdirSync(subDir); } catch { continue; }
    for (const n of names.sort()) {
      const m = /^agent-(.+)\.jsonl$/.exec(n);
      if (!m) continue;
      const subLines = readLines(path.join(subDir, n));
      if (subLines === null) continue;
      const agent = readAgentType(path.join(subDir, `agent-${m[1]}.meta.json`)) ?? m[1];
      push(sessionId, { agent, file: n, parsed: parseUsageLines(subLines) });
    }
  }

  // Bản sao fork/resume lặp cùng message.id ở file của phiên khác: mỗi id chỉ thuộc một phiên (sớm nhất,
  // hòa thì phiên đến trước), phiên còn lại bỏ lượt đó để tổng token không đếm đôi.
  const owner = new Map(); // message.id -> { sessionId, ts }
  const earlier = (a, b) => b !== null && (a === null || b < a);
  for (const [id, parts] of groups) {
    for (const p of parts) for (const t of p.parsed.turns) {
      if (t.id.startsWith('anon-')) continue;
      const cur = owner.get(t.id);
      if (!cur) owner.set(t.id, { sessionId: id, ts: t.ts });
      else if (cur.sessionId === id) { if (earlier(cur.ts, t.ts)) cur.ts = t.ts; }
      else if (earlier(cur.ts, t.ts)) owner.set(t.id, { sessionId: id, ts: t.ts });
    }
  }

  const out = [];
  for (const [id, rawParts] of groups) {
    const dropped = new Set();
    const parts = rawParts.map((p) => ({
      ...p,
      parsed: { ...p.parsed, turns: p.parsed.turns.filter((t) => {
        if (t.id.startsWith('anon-') || owner.get(t.id).sessionId === id) return true;
        dropped.add(t.id);
        return false;
      }) },
    }));
    const s = buildSessionUsage(id, parts, { sinceMs, sharedTurns: dropped.size });
    if (s) out.push(s);
  }
  return out;
}

const sessionTokens = (s) => tokensOf(s.main) + Object.values(s.bySubagent).reduce((a, u) => a + tokensOf(u), 0);
const addInto = (acc, u) => { for (const k of USAGE_KEYS) acc[k] += u[k]; acc.turns += u.turns; };

export function buildUsageReport(sessions, { sinceMs, top = 5 }) {
  const totals = emptyUsage();
  let costUsd = null;
  let sessionsWithoutCost = 0;
  let unknownModelCost = false;
  let subTokens = 0;
  const byModel = new Map();
  const bySubagent = new Map();
  const signals = { modelSwitches: { count: 0, tokens: 0 }, idleGaps: { count: 0, tokens: 0 }, cacheHeavy: { count: 0, tokens: 0 } };

  for (const s of sessions) {
    if (s.costUsd !== null) costUsd = (costUsd ?? 0) + s.costUsd;
    else sessionsWithoutCost++;
    if (s.unknownModelCost) unknownModelCost = true;
    for (const [model, u] of Object.entries(s.byModel)) {
      const acc = byModel.get(model) ?? { ...emptyUsage(), costUsd: null };
      addInto(acc, u);
      if (u.costUsd !== null) acc.costUsd = (acc.costUsd ?? 0) + u.costUsd;
      byModel.set(model, acc);
      addInto(totals, u);
    }
    for (const [agent, u] of Object.entries(s.bySubagent)) {
      const acc = bySubagent.get(agent) ?? emptyUsage();
      addInto(acc, u);
      bySubagent.set(agent, acc);
      subTokens += tokensOf(u);
    }
    for (const k of Object.keys(signals)) {
      signals[k].count += s.signals[k].count;
      signals[k].tokens += s.signals[k].tokens;
    }
  }

  const grand = tokensOf(totals);
  const cacheReadPct = (u) => {
    const d = u.input + u.cacheRead + u.cacheCreate;
    return d === 0 ? 0 : u.cacheRead / d;
  };

  return {
    sinceMs,
    sessions: sessions.length,
    totals: { ...totals, costUsd, sessionsWithoutCost, unknownModelCost, subagentShare: grand === 0 ? 0 : subTokens / grand },
    byModel: [...byModel.entries()]
      .map(([model, u]) => ({
        model, turns: u.turns, input: u.input, cacheRead: u.cacheRead, cacheCreate: u.cacheCreate,
        cacheCreate1h: u.cacheCreate1h, cacheCreate5m: u.cacheCreate5m, output: u.output,
        cacheReadPct: cacheReadPct(u), costUsd: u.costUsd,
      }))
      .sort((a, b) => tokensOf(b) - tokensOf(a)),
    bySubagent: [...bySubagent.entries()]
      .map(([agent, u]) => ({ agent, turns: u.turns, input: u.input, cacheRead: u.cacheRead, cacheCreate: u.cacheCreate, output: u.output }))
      .sort((a, b) => tokensOf(b) - tokensOf(a)),
    signals,
    top: [...sessions]
      .sort((a, b) => {
        if ((a.costUsd === null) !== (b.costUsd === null)) return a.costUsd === null ? 1 : -1;
        if (a.costUsd !== b.costUsd) return b.costUsd - a.costUsd;
        return sessionTokens(b) - sessionTokens(a);
      })
      .slice(0, top)
      .map((s) => ({
        sessionId: s.sessionId, costUsd: s.costUsd, turns: s.main.turns + Object.values(s.bySubagent).reduce((a, u) => a + u.turns, 0),
        subagentShare: s.subagentShare, files: [...s.files], sharedTurns: s.sharedTurns ?? 0, signals: s.signals, unknownModelCost: s.unknownModelCost,
      })),
  };
}
