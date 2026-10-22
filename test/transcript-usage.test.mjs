#!/usr/bin/env node
// Unit test cho transcript-usage — fixture JSONL dựng tại chỗ, không cần transcript thật. Zero-dependency.
// Chạy: node test/transcript-usage.test.mjs
import { parseUsageLines, buildSessionUsage, LARGE_CACHE_CREATE, IDLE_GAP_MS } from '../cli/lib/transcript-usage.mjs';

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

// ---- buildSessionUsage ----
const T0 = Date.parse('2026-10-22T10:00:00.000Z');
const at = (min) => new Date(T0 + min * 60000).toISOString();
const u = (input, cacheRead, cacheCreate, output = 0) => ({ input_tokens: input, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: cacheCreate, output_tokens: output });
const turn = (id, model, usage, min = 0) => asst(id, model, usage, { timestamp: at(min) });
const cost = (total, extra = {}) => j({ type: 'cost-state', sessionId: 's1', totalCostUSD: total, ...extra });
const part = (agent, lines, file = `${agent ?? 'main'}.jsonl`) => ({ agent, file, parsed: parseUsageLines(lines) });
const build = (lines, agent = null) => buildSessionUsage('s1', [part(agent, lines)]);

// AC1.1: tiền lấy từ cost-state lớn nhất
let s = build([turn('m1', 'x', u(1, 0, 0)), cost(1), cost(3, { hasUnknownModelCost: true, modelUsage: { x: { costUSD: 3 } } }), cost(2, { modelUsage: { x: { costUSD: 2 } } })]);
ok(s.costUsd === 3, 'P5c AC1.1: costUsd là totalCostUSD lớn nhất, không phải dòng cuối');
ok(s.unknownModelCost === true, 'P5c AC1.1: unknownModelCost lấy từ bản lớn nhất');
ok(s.byModel.x.costUsd === 3, 'P5c AC1.1: byModel.costUsd lấy từ bản lớn nhất');
s = build([turn('m1', 'x', u(1, 0, 0))]);
ok(s.costUsd === null && s.unknownModelCost === false && s.byModel.x.costUsd === null, 'P5c AC1.1: không có cost-state → costUsd null');
s = buildSessionUsage('s1', [part(null, [turn('m1', 'x', u(1, 0, 0)), cost(1)]), part('r', [cost(5)], 'r.jsonl')]);
ok(s.costUsd === 5 && s.files.join() === 'main.jsonl,r.jsonl', 'P5c AC1.1: cost-state chọn trên toàn bộ parts, files liệt kê đủ');
ok(s.sessionId === 's1' && s.firstTs === T0 && s.lastTs === T0, 'P5c AC1.1: sessionId, firstTs, lastTs');

// AC1.3: tách phiên chính và subagent
s = buildSessionUsage('s1', [
  part(null, [turn('m1', 'opus', u(10, 0, 0, 10))]),
  part('reviewer', [turn('a1', 'sonnet', u(30, 0, 0, 10))], 'a.jsonl'),
  part('a0c291f1eec1ef53d', [turn('b1', 'opus', u(10, 10, 0, 10))], 'b.jsonl'),
]);
ok(Object.keys(s.bySubagent).sort().join() === 'a0c291f1eec1ef53d,reviewer', 'P5c AC1.3: bySubagent có đúng hai khóa');
ok(s.main.input === 10 && s.main.output === 10 && s.main.turns === 1, 'P5c AC1.3: main không lẫn token subagent');
ok(s.bySubagent.reviewer.input === 30 && s.bySubagent.reviewer.turns === 1, 'P5c AC1.3: token subagent theo agent');
ok(s.subagentShare === 70 / 90, 'P5c AC1.3: subagentShare = token subagent / tổng');
ok(s.byModel.opus.input === 20 && s.byModel.opus.turns === 2 && s.byModel.sonnet.input === 30, 'P5c AC1.3: token subagent vẫn vào byModel theo model');
ok(build([turn('m1', 'x', u(0, 0, 0))]).subagentShare === 0, 'P5c AC1.3: tổng token 0 → subagentShare 0');

// AC1.4: tín hiệu
const sig = (lines, agent) => build(lines, agent).signals;
const zero = { count: 0, tokens: 0 };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let g = sig([turn('m1', 'a', u(1, 0, 0), 0), turn('m2', 'b', u(1, 0, 7), 1)]);
ok(eq(g.modelSwitches, { count: 1, tokens: 7 }), 'P5c AC1.4: đổi model → count 1, tokens = cacheCreate lượt sau');
const idle = (gapMin, cc) => sig([turn('m1', 'a', u(1, 0, 0), 0), turn('m2', 'a', u(1, 0, cc), gapMin)]).idleGaps;
ok(eq(idle(61, 20000), { count: 1, tokens: 20000 }), 'P5c AC1.4: nghỉ 61 phút + cache lớn → idleGaps');
ok(eq(idle(59, 20000), zero), 'P5c AC1.4: nghỉ 59 phút → không tính');
ok(eq(idle(61, 9999), zero), 'P5c AC1.4: cacheCreate 9999 → không tính');
ok(eq(sig([turn('m1', 'a', u(1, 0, 0), 0), turn('m2', 'a', u(1, 0, 20000), 61)], 'r').idleGaps, zero), 'P5c AC1.4: idleGaps chỉ áp cho phiên chính');
ok(eq(sig([turn('m1', 'a', u(100, 300, 600))]).cacheHeavy, { count: 1, tokens: 600 }), 'P5c AC1.4: cacheHeavy khi cacheCreate > 50%');
ok(eq(sig([turn('m1', 'a', u(0, 500, 500))]).cacheHeavy, zero), 'P5c AC1.4: đúng 50% không tính cacheHeavy');
ok(eq(sig([turn('m1', 'a', u(100, 300, 600))], 'r').cacheHeavy, { count: 1, tokens: 600 }), 'P5c AC1.4: cacheHeavy áp cho cả subagent');
ok(eq(sig([turn('m1', 'a', u(5, 5, 0), 0), turn('m2', 'a', u(5, 5, 0), 1)]), { modelSwitches: zero, idleGaps: zero, cacheHeavy: zero }), 'P5c AC1.4: không hiện tượng → ba tín hiệu {0,0}');
g = buildSessionUsage('s1', [part(null, [turn('m1', 'a', u(1, 0, 0), 0)]), part('r', [turn('a1', 'b', u(1, 0, 0), 1)], 'a.jsonl')]).signals;
ok(eq(g.modelSwitches, zero), 'P5c AC1.4: đổi model giữa phiên chính và subagent không phải đổi model');

// Gộp và sinceMs
s = buildSessionUsage('s1', [
  part(null, [turn('m1', 'x', u(1, 0, 5, 1), 5)]),
  part(null, [turn('m1', 'x', u(2, 0, 3, 9), 2)], 'fork.jsonl'),
]);
ok(s.main.turns === 1 && s.main.input === 2 && s.main.cacheCreate === 5 && s.main.output === 9 && s.firstTs === T0 + 2 * 60000, 'P5c AC1.1: cùng message.id ở hai parts tính một lần (max trường, min ts)');
s = buildSessionUsage('s1', [part(null, [turn('m1', 'x', u(1, 0, 0), 0)]), part('r', [turn('m1', 'x', u(1, 0, 0), 0)], 'a.jsonl')]);
ok(s.main.turns === 1 && Object.keys(s.bySubagent).length === 0, 'P5c AC1.1: message.id trùng giữa main và agent giữ chuỗi của part đầu');
const sp = [part(null, [turn('m1', 'x', u(1, 0, 0), 0), turn('m2', 'x', u(1, 0, 0), 10), asst('m3', 'x', u(1, 0, 0), { timestamp: undefined })])];
s = buildSessionUsage('s1', sp, { sinceMs: T0 + 5 * 60000 });
ok(s.main.turns === 1 && s.firstTs === T0 + 10 * 60000, 'P5c AC1.1: sinceMs bỏ lượt cũ và lượt ts null');
ok(buildSessionUsage('s1', sp, { sinceMs: T0 + 60 * 60000 }) === null, 'P5c AC1.1: sinceMs loại hết lượt → null');
ok(buildSessionUsage('s1', sp, { sinceMs: null }).main.turns === 3, 'P5c AC1.1: sinceMs null không lọc');

if (fails.length) { for (const f of fails) console.error('✗', f); console.error(`\n${fails.length} FAIL / ${pass + fails.length}`); process.exit(1); }
console.log(`transcript-usage.test: ${pass} pass`);
