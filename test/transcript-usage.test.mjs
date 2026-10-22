#!/usr/bin/env node
// Unit test cho transcript-usage — fixture JSONL dựng tại chỗ, không cần transcript thật. Zero-dependency.
// Chạy: node test/transcript-usage.test.mjs
import { parseUsageLines, LARGE_CACHE_CREATE, IDLE_GAP_MS } from '../cli/lib/transcript-usage.mjs';

let pass = 0;
const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };
const j = (o) => JSON.stringify(o);
const asst = (id, model, usage, extra = {}) => j({
  type: 'assistant', timestamp: '2026-10-22T10:00:00.000Z', sessionId: 's1',
  message: { ...(id ? { id } : {}), ...(model ? { model } : {}), ...(usage ? { usage } : {}) }, ...extra,
});

ok(LARGE_CACHE_CREATE === 10000 && IDLE_GAP_MS === 3600000, 'P5c AC1.2: hằng ngưỡng cache lớn và khoảng nghỉ');

let r = parseUsageLines([
  asst('m1', 'claude-opus-4', { input_tokens: 2, cache_read_input_tokens: 100, cache_creation_input_tokens: 5, output_tokens: 1 }),
  asst('m1', 'claude-opus-4', { input_tokens: 1, cache_read_input_tokens: 90, cache_creation_input_tokens: 50, output_tokens: 40 },
    { timestamp: '2026-10-22T09:00:00.000Z' }),
]);
ok(r.turns.length === 1, 'P5c AC1.2: hai dòng cùng message.id gộp thành một lượt');
ok(r.turns[0].usage.input === 2 && r.turns[0].usage.cacheRead === 100 && r.turns[0].usage.cacheCreate === 50 && r.turns[0].usage.output === 40,
  'P5c AC1.2: gộp lấy giá trị lớn nhất từng trường');
ok(r.turns[0].ts === Date.parse('2026-10-22T09:00:00.000Z'), 'P5c AC1.2: ts nhỏ nhất khi gộp');
ok(r.turns[0].id === 'm1' && r.turns[0].model === 'claude-opus-4', 'P5c AC1.2: Turn mang id và model');

r = parseUsageLines([
  asst('a', '<synthetic>', { input_tokens: 1 }),
  asst('b', 'claude-opus-4', null),
  asst('c', null, { input_tokens: 1 }),
  asst('d', 'claude-opus-4', { input_tokens: 1 }),
]);
ok(r.turns.length === 1 && r.turns[0].id === 'd', 'P5c AC1.2: bỏ dòng synthetic, thiếu usage hoặc thiếu model');

r = parseUsageLines([asst('m1', 'x', {
  input_tokens: 1, cache_creation_input_tokens: 30,
  cache_creation: { ephemeral_1h_input_tokens: 20, ephemeral_5m_input_tokens: 10 },
}), asst('m2', 'x', { input_tokens: 1 })]);
ok(r.turns[0].usage.cacheCreate1h === 20 && r.turns[0].usage.cacheCreate5m === 10, 'P5c AC1.2: tách cache_creation 1h/5m');
ok(Object.values(r.turns[1].usage).every((v) => v === 0 || v === 1) && r.turns[1].usage.cacheCreate1h === 0 && r.turns[1].usage.output === 0,
  'P5c AC1.2: trường thiếu mặc định 0');

r = parseUsageLines([asst('m1', 'x', { input_tokens: 1 }, { timestamp: 'không-hợp-lệ' }), asst('m2', 'x', { input_tokens: 1 }, { timestamp: undefined })]);
ok(r.turns[0].ts === null && r.turns[1].ts === null, 'P5c AC1.2: timestamp hỏng hoặc thiếu → ts null');

r = parseUsageLines([asst(null, 'x', { input_tokens: 1 }), asst(null, 'x', { input_tokens: 2 })]);
ok(r.turns.length === 2, 'P5c AC1.2: không có message.id thì mỗi dòng một lượt');

r = parseUsageLines([
  asst('b', 'x', { input_tokens: 1 }), asst('a', 'x', { input_tokens: 1 }), asst('b', 'x', { input_tokens: 2 }),
]);
ok(r.turns.map((t) => t.id).join() === 'b,a', 'P5c AC1.2: thứ tự theo lần xuất hiện đầu tiên');

r = parseUsageLines([asst('m1', 'x', { input_tokens: 1 }), '{not json', '', asst('m2', 'x', { input_tokens: 1 }), '{"type":"assistant","mess']);
ok(r.turns.length === 2, 'P5c AC1.2: dòng JSON hỏng và dòng cuối dở bị bỏ qua');

r = parseUsageLines([
  j({ type: 'cost-state', sessionId: 's9', totalCostUSD: 1.5, hasUnknownModelCost: true, modelUsage: { 'claude-opus-4': { costUSD: 1.5, inputTokens: 3 } } }),
  j({ type: 'cost-state', sessionId: 's9', totalCostUSD: 'x' }),
]);
ok(r.costStates.length === 1 && r.costStates[0].totalCostUSD === 1.5 && r.costStates[0].hasUnknownModelCost === true
  && r.costStates[0].modelUsage['claude-opus-4'].costUSD === 1.5, 'P5c AC1.2: đọc cost-state, bỏ dòng totalCostUSD không phải số');

r = parseUsageLines([j({ type: 'user', message: {} }), j({ type: 'cost-state', sessionId: 'first', totalCostUSD: 0 }), asst('m1', 'x', { input_tokens: 1 }, { sessionId: 'later' })]);
ok(r.sessionId === 'first', 'P5c AC1.2: sessionId lấy từ dòng đầu có trường đó');
ok(parseUsageLines([]).sessionId === null, 'P5c AC1.2: không có sessionId → null');

if (fails.length) { for (const f of fails) console.error('✗', f); console.error(`\n${fails.length} FAIL / ${pass + fails.length}`); process.exit(1); }
console.log(`transcript-usage.test: ${pass} pass`);
