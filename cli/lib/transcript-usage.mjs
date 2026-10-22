// Phân tích lượt dùng token từ transcript JSONL của Claude Code. Zero-dependency.
// [Unverified] Layout dòng transcript (assistant.usage, cost-state) là nội bộ của Claude Code, không phải hợp đồng công khai.

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
  };
}
