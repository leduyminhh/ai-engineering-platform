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
