// Định dạng UsageReport thành các dòng text cho `aip stats --usage`. Zero-dependency.
// Chỉ in số, tên model, sessionId, tên agent, tên file transcript — không bao giờ in nội dung hội thoại.

const money = (v) => (v === null ? '—' : `$${v.toFixed(2)}`);
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const n = (v, w) => String(v).padStart(w);

export function formatUsageReport(r) {
  const out = [];
  const t = r.totals;
  const since = r.sinceMs === null ? 'toàn bộ' : `từ ${new Date(r.sinceMs).toISOString().slice(0, 10)}`;
  const unknown = t.unknownModelCost ? ' (có model chưa rõ giá)' : '';
  const noCost = t.sessionsWithoutCost > 0 ? ` (${t.sessionsWithoutCost} phiên thiếu cost-state)` : '';
  out.push(`Phiên: ${r.sessions} (${since}) | tiền: ${money(t.costUsd)}${noCost}${unknown} | subagent: ${pct(t.subagentShare)} token`);

  out.push('');
  out.push(`${'Model'.padEnd(30)} ${'lượt'.padStart(6)} ${'input'.padStart(10)} ${'cache đọc'.padStart(12)} ${'cache tạo'.padStart(12)} ${'output'.padStart(10)} ${'%đọc'.padStart(6)} ${'tiền'.padStart(9)}`);
  for (const m of r.byModel) {
    out.push(`${m.model.padEnd(30)} ${n(m.turns, 6)} ${n(m.input, 10)} ${n(m.cacheRead, 12)} ${n(m.cacheCreate, 12)} ${n(m.output, 10)} ${n(pct(m.cacheReadPct), 6)} ${n(money(m.costUsd), 9)}`);
  }

  const s = r.signals;
  out.push('');
  out.push(`Tín hiệu: đổi model ${s.modelSwitches.count} lần (${s.modelSwitches.tokens} token cache tạo) | nghỉ >1h rồi cache lớn ${s.idleGaps.count} lần (${s.idleGaps.tokens}) | cache tạo >50% ${s.cacheHeavy.count} lần (${s.cacheHeavy.tokens})`);

  out.push('');
  out.push(`${'Top phiên'.padEnd(38)} ${'tiền'.padStart(9)} ${'lượt'.padStart(6)} ${'subagent'.padStart(9)} ${'tín hiệu'.padStart(9)}`);
  for (const p of r.top) {
    const sig = p.signals.modelSwitches.count + p.signals.idleGaps.count + p.signals.cacheHeavy.count;
    const label = `${p.sessionId}${p.unknownModelCost ? ' *' : ''}${p.sharedTurns > 0 ? ' †' : ''}`;
    out.push(`${label.padEnd(38)} ${n(money(p.costUsd), 9)} ${n(p.turns, 6)} ${n(pct(p.subagentShare), 9)} ${n(sig, 9)}`);
  }
  if (r.top.some((p) => p.unknownModelCost)) out.push('  * có model chưa rõ giá');
  if (r.top.some((p) => p.sharedTurns > 0)) out.push('  † phiên fork/resume: tiền cost-state có thể trùng với phiên gốc');

  out.push('');
  out.push('[Unverified] Tiền là cost-state của Claude Code cho cả phiên (gồm cả subagent), không chia theo cửa sổ --since, không phải hóa đơn.');
  return out;
}
