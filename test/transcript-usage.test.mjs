#!/usr/bin/env node
// Unit test cho transcript-usage — fixture JSONL dựng tại chỗ, không cần transcript thật. Zero-dependency.
// Chạy: node test/transcript-usage.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseUsageLines, buildSessionUsage, parseSince, loadSessionUsage, buildUsageReport, LARGE_CACHE_CREATE, IDLE_GAP_MS } from '../cli/lib/transcript-usage.mjs';
import { projectSlug } from '../cli/lib/transcript-stats.mjs';
import { formatUsageReport } from '../cli/lib/usage-report.mjs';

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
ok(s.main.turns === 1 && s.main.input === 2 && s.main.cacheCreate === 5 && s.main.output === 9 && s.firstTs === T0 + 2 * 60000, 'P5c AC1.2: cùng message.id ở hai parts tính một lần (max trường, min ts)');
s = buildSessionUsage('s1', [part(null, [turn('m1', 'x', u(1, 0, 0), 0)]), part('r', [turn('m1', 'x', u(1, 0, 0), 0)], 'a.jsonl')]);
ok(s.main.turns === 1 && Object.keys(s.bySubagent).length === 0, 'P5c AC1.2: message.id trùng giữa main và agent giữ chuỗi của part đầu');
const sp = [part(null, [turn('m1', 'x', u(1, 0, 0), 0), turn('m2', 'x', u(1, 0, 0), 10), asst('m3', 'x', u(1, 0, 0), { timestamp: undefined })])];
s = buildSessionUsage('s1', sp, { sinceMs: T0 + 5 * 60000 });
ok(s.main.turns === 1 && s.firstTs === T0 + 10 * 60000, 'P5c AC1.1: sinceMs bỏ lượt cũ và lượt ts null');
ok(buildSessionUsage('s1', sp, { sinceMs: T0 + 60 * 60000 }) === null, 'P5c AC1.1: sinceMs loại hết lượt → null');
ok(buildSessionUsage('s1', sp, { sinceMs: null }).main.turns === 3, 'P5c AC1.1: sinceMs null không lọc');

// Regression: id-less turn ở hai part không gộp; hai lần chạy cùng tên agent không thành một chuỗi
s = buildSessionUsage('s1', [part(null, [asst(null, 'x', u(1, 0, 0))]), part(null, [asst(null, 'x', u(2, 0, 0))], 'fork.jsonl')]);
ok(s.main.turns === 2 && s.main.input === 3, 'P5c AC1.2: turn không có message.id ở hai part không bị gộp');
s = buildSessionUsage('s1', [part('reviewer', [turn('a1', 'opus', u(1, 0, 0), 0)], 'r1.jsonl'), part('reviewer', [turn('a2', 'sonnet', u(1, 0, 0), 1)], 'r2.jsonl')]);
ok(s.signals.modelSwitches.count === 0 && s.bySubagent.reviewer.turns === 2, 'P5c AC1.4: hai lần chạy cùng tên agent khác model không tính đổi model, vẫn gộp theo tên');

// ---- parseSince / loadSessionUsage / buildUsageReport ----
const NOW = Date.parse('2026-10-22T12:00:00.000Z');
const DAY = 86400000;
for (const [input, want] of [
  [undefined, NOW - 7 * DAY], ['3', NOW - 3 * DAY], ['2026-10-01', Date.UTC(2026, 9, 1)],
  ['0', null], ['-3', null], ['abc', null], ['2026-13-40', null], ['2026-02-30', null],
]) ok(parseSince(input, NOW) === want, `P5c AC2.1: parseSince(${input}) = ${want}`);

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-usage-'));
try {
  const cwd = 'E:\\proj';
  const dir = path.join(home, '.claude', 'projects', projectSlug(cwd));
  const w = (rel, lines) => { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Array.isArray(lines) ? lines.join('\n') : lines); };
  const sess = (id) => (o) => ({ ...JSON.parse(o), sessionId: id });
  const L = (id, ...lines) => lines.map((l) => j(sess(id)(l)));
  w('sA.jsonl', L('sA', turn('m1', 'opus', u(10, 0, 0, 10)), cost(2, { modelUsage: { opus: { costUSD: 2 } } })));
  w('sA/subagents/agent-aaa.jsonl', L('sA', turn('a1', 'sonnet', u(30, 0, 0, 10))));
  w('sA/subagents/agent-aaa.meta.json', j({ agentType: 'reviewer', description: 'SECRET-DESC-XYZ' }));
  w('sA/subagents/agent-bbb.jsonl', L('sA', turn('b1', 'sonnet', u(5, 0, 0, 0))));
  w('sA/subagents/agent-bbb.meta.json', '{not json SECRET-DESC-XYZ');
  w('sA/subagents/agent-ccc.jsonl', L('sA', turn('c1', 'sonnet', u(5, 0, 0, 0))));
  w('sB1.jsonl', L('sB', turn('x1', 'opus', u(1, 0, 0, 1)), cost(1)));
  w('sB2.jsonl', L('sB', turn('x2', 'opus', u(1, 0, 0, 1)), cost(3)));
  w('old.jsonl', L('sOld', asst('o1', 'opus', u(1, 0, 0, 1), { timestamp: '2020-01-01T00:00:00.000Z' })));
  w('broken.jsonl', '{garbage');

  const since = T0 - DAY;
  const got = loadSessionUsage({ home, cwd, sinceMs: since });
  const byId = Object.fromEntries(got.map((x) => [x.sessionId, x]));
  ok(got.length === 2 && byId.sA && byId.sB, 'P5c AC1.1: hai phiên, bỏ phiên ngoài cửa sổ và file hỏng');
  ok(byId.sB.costUsd === 3 && byId.sB.files.length === 2, 'P5c AC1.1: phiên chia hai file không đếm đôi tiền');
  ok(Object.keys(byId.sA.bySubagent).sort().join() === 'bbb,ccc,reviewer', 'P5c AC1.3: tên agent từ agentType, rơi về id khi meta hỏng/thiếu');
  ok(byId.sA.main.input === 10 && byId.sA.subagentShare === 50 / 70, 'P5c AC1.3: tách main và subagent từ đĩa');
  ok(loadSessionUsage({ home, cwd, sinceMs: null }).length === 3, 'P5c AC1.1: sinceMs null lấy cả phiên cũ');
  ok(loadSessionUsage({ home, cwd: 'E:\\none', sinceMs: null }).length === 0, 'P5c AC1.1: không có thư mục project → []');

  const rep = buildUsageReport(got, { sinceMs: since });
  ok(rep.sessions === 2 && rep.totals.turns === 6, 'P5c AC2.1: số phiên và lượt');
  ok(rep.totals.input === 52 && rep.totals.output === 22, 'P5c AC2.1: tổng token');
  ok(rep.totals.costUsd === 5, 'P5c AC2.1: tổng tiền cộng mỗi phiên một lần');
  ok(!JSON.stringify(rep).includes('SECRET-DESC-XYZ'), 'P5c AC2.1: description của meta không lọt vào báo cáo');
  ok(rep.byModel[0].model === 'sonnet' && rep.byModel[0].turns === 3, 'P5c AC2.1: byModel sắp theo token giảm dần');
  ok(rep.bySubagent.some((a) => a.agent === 'reviewer' && a.input === 30), 'P5c AC2.1: bySubagent có reviewer');
} finally { fs.rmSync(home, { recursive: true, force: true }); }

{
  const mk = (id, costUsd, input) => ({
    sessionId: id, files: [`${id}.jsonl`], costUsd, unknownModelCost: false, firstTs: T0, lastTs: T0,
    byModel: { m: { input, cacheRead: input, cacheCreate: input, cacheCreate1h: 0, cacheCreate5m: 0, output: 0, turns: 1, costUsd } },
    main: { input, cacheRead: input, cacheCreate: input, cacheCreate1h: 0, cacheCreate5m: 0, output: 0, turns: 1 },
    bySubagent: {}, subagentShare: 0,
    signals: { modelSwitches: { count: 0, tokens: 0 }, idleGaps: { count: 0, tokens: 0 }, cacheHeavy: { count: 0, tokens: 0 } },
  });
  const ss = [mk('p', null, 1), mk('q', 5, 1), mk('r', 9, 1), mk('s', null, 50), mk('t', 1, 1), mk('u', 2, 1), mk('v', 3, 1)];
  const snapshot = JSON.stringify(ss);
  const r7 = buildUsageReport(ss, { sinceMs: null });
  ok(r7.top.length === 5 && r7.top.map((x) => x.sessionId).join() === 'r,q,v,u,t', 'P5c AC2.1: top 5 sắp tiền giảm dần');
  ok(buildUsageReport(ss, { sinceMs: null, top: 7 }).top.slice(5).map((x) => x.sessionId).join() === 's,p', 'P5c AC2.1: phiên không tiền xếp sau, theo token');
  ok(JSON.stringify(ss) === snapshot, 'P5c AC2.1: không sửa đầu vào');
  ok(r7.byModel[0].cacheReadPct === 1 / 3 && r7.totals.costUsd === 20, 'P5c AC2.1: cacheReadPct và tổng tiền bỏ phiên null');
  const e = buildUsageReport([], { sinceMs: T0 + DAY });
  ok(e.sessions === 0 && e.byModel.length === 0 && e.totals.costUsd === null && e.top.length === 0 && e.totals.subagentShare === 0,
    'P5c AC2.1: không phiên nào → báo cáo rỗng, costUsd null');
}

// ---- dedupe message.id giữa các phiên (bản sao fork/resume) ----
{
  const dh = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-usage-dedupe-'));
  try {
    const cwd = 'E:\\dd';
    const dir = path.join(dh, '.claude', 'projects', projectSlug(cwd));
    fs.mkdirSync(dir, { recursive: true });
    const w = (name, lines) => fs.writeFileSync(path.join(dir, name), lines.join('\n'));
    const inS = (sid, line) => j({ ...JSON.parse(line), sessionId: sid });
    // fa là bản gốc (ts sớm hơn); fb là bản fork lặp m-shared và có thêm lượt riêng + hai lượt không có id.
    w('fa.jsonl', [inS('fa', turn('m-shared', 'x', u(100, 0, 0, 1), 0)), inS('fa', turn('m-a', 'x', u(1, 0, 0, 0), 1)), inS('fa', asst(null, 'x', u(7, 0, 0, 0)))]);
    w('fb.jsonl', [inS('fb', turn('m-shared', 'x', u(100, 0, 0, 1), 5)), inS('fb', turn('m-b', 'x', u(2, 0, 0, 0), 6)), inS('fb', asst(null, 'x', u(7, 0, 0, 0))), inS('fb', cost(4))]);
    const ss = loadSessionUsage({ home: dh, cwd, sinceMs: null });
    const by = Object.fromEntries(ss.map((x) => [x.sessionId, x]));
    ok(by.fa.main.input === 108 && by.fa.main.turns === 3 && by.fa.sharedTurns === 0, 'P5c AC1.2: phiên sở hữu (ts sớm nhất) giữ message.id chung, sharedTurns 0');
    ok(by.fb.main.input === 9 && by.fb.main.turns === 2 && by.fb.sharedTurns === 1, 'P5c AC1.2: phiên còn lại mất lượt chung, id riêng và lượt không id giữ nguyên, sharedTurns 1');
    const rp = buildUsageReport(ss, { sinceMs: null });
    ok(rp.totals.input === 117 && rp.totals.turns === 5, 'P5c AC1.2: tổng token trên toàn project đếm mỗi message.id một lần');
    ok(rp.top.find((x) => x.sessionId === 'fb').sharedTurns === 1 && rp.top.find((x) => x.sessionId === 'fa').sharedTurns === 0, 'P5c AC1.2: top mang sharedTurns');
    ok(by.fb.costUsd === 4, 'P5c AC1.2: không trừ tiền của phiên bị bỏ lượt');
    const txt = formatUsageReport(rp).join('\n');
    ok(txt.includes('fb †') && txt.includes('phiên fork/resume') && !txt.includes('fa †'), 'P5c AC2.1: bảng đánh dấu † phiên fork/resume kèm chú thích');
    ok(txt.includes('(1 phiên thiếu cost-state)'), 'P5c AC2.1: dòng tổng nêu số phiên thiếu cost-state');
    ok(!formatUsageReport(buildUsageReport([by.fb], { sinceMs: null })).join('\n').includes('thiếu cost-state'), 'P5c AC2.1: mọi phiên có cost-state thì không có ghi chú thiếu');
  } finally { fs.rmSync(dh, { recursive: true, force: true }); }
}

// ---- buildUsageReport cộng nhiều phiên ----
{
  const sg = (c, t) => ({ count: c, tokens: t });
  const mk = (id, costUsd, unknown, model, agent, sig) => ({
    sessionId: id, files: [id], costUsd, unknownModelCost: unknown, firstTs: T0, lastTs: T0, sharedTurns: 0,
    byModel: { [model]: { input: 10, cacheRead: 0, cacheCreate: 0, cacheCreate1h: 0, cacheCreate5m: 0, output: 0, turns: 1, costUsd } },
    main: { input: 10, cacheRead: 0, cacheCreate: 0, cacheCreate1h: 0, cacheCreate5m: 0, output: 0, turns: 1 },
    bySubagent: { [agent]: { input: 4, cacheRead: 1, cacheCreate: 2, cacheCreate1h: 0, cacheCreate5m: 0, output: 3, turns: 2 } },
    subagentShare: 0, signals: sig,
  });
  const a = mk('a', 1.5, false, 'm1', 'rev', { modelSwitches: sg(1, 5), idleGaps: sg(0, 0), cacheHeavy: sg(2, 7) });
  const b = mk('b', 2.5, true, 'm1', 'rev', { modelSwitches: sg(2, 6), idleGaps: sg(1, 9), cacheHeavy: sg(0, 0) });
  const c = mk('c', null, false, 'm2', 'qa', { modelSwitches: sg(0, 0), idleGaps: sg(0, 0), cacheHeavy: sg(1, 1) });
  const r = buildUsageReport([a, b, c], { sinceMs: null });
  const m1 = r.byModel.find((x) => x.model === 'm1');
  ok(m1.turns === 2 && m1.input === 20 && m1.costUsd === 4, 'P5c AC2.1: byModel cộng token và tiền qua nhiều phiên');
  ok(r.byModel.find((x) => x.model === 'm2').costUsd === null, 'P5c AC2.1: model chỉ có ở phiên không tiền → costUsd null');
  ok(r.totals.unknownModelCost === true && r.totals.costUsd === 4 && r.totals.sessionsWithoutCost === 1, 'P5c AC2.1: unknownModelCost là OR, tổng tiền bỏ phiên null, đếm phiên thiếu cost-state');
  ok(eq(r.signals, { modelSwitches: sg(3, 11), idleGaps: sg(1, 9), cacheHeavy: sg(3, 8) }), 'P5c AC2.1: tín hiệu cộng qua các phiên');
  const rev = r.bySubagent.find((x) => x.agent === 'rev');
  ok(rev.turns === 4 && rev.input === 8 && rev.cacheRead === 2 && rev.cacheCreate === 4 && rev.output === 6, 'P5c AC2.1: bySubagent cộng theo tên agent qua nhiều phiên');
}

// ---- CLI: aip stats --usage (chạy tiến trình thật, HOME/USERPROFILE trỏ thư mục tạm) ----
{
  const CLI = fileURLToPath(new URL('../cli/index.mjs', import.meta.url));
  const tmpHome = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aip-usage-cli-')));
  try {
    const proj = path.join(tmpHome, 'proj');
    fs.mkdirSync(proj);
    const dir = path.join(tmpHome, '.claude', 'projects', projectSlug(proj));
    const w = (rel, lines) => { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, lines.join('\n')); };
    const nowIso = new Date().toISOString();
    const a = (id, model, usage, sid) => j({ type: 'assistant', timestamp: nowIso, sessionId: sid, message: { id, model, usage } });
    w('c1.jsonl', [
      j({ type: 'user', sessionId: 'c1', message: { content: 'SECRET-USER-TEXT' } }),
      a('m1', 'claude-fixture-9', { input_tokens: 10, cache_read_input_tokens: 30, cache_creation_input_tokens: 5, output_tokens: 7 }, 'c1'),
      j({ type: 'user', sessionId: 'c1', message: { content: [{ type: 'tool_result', content: 'SECRET-TOOL-OUT' }] } }),
      j({ type: 'cost-state', sessionId: 'c1', totalCostUSD: 1.234, hasUnknownModelCost: true, modelUsage: { 'claude-fixture-9': { costUSD: 1.234 } } }),
    ]);
    w('c1/subagents/agent-zzz.jsonl', [a('s1', 'claude-fixture-9', { input_tokens: 4, output_tokens: 1 }, 'c1')]);
    w('c1/subagents/agent-zzz.meta.json', [j({ agentType: 'fixture-agent', description: 'SECRET-META-DESC' })]);
    w('c2.jsonl', [a('m2', 'claude-fixture-9', { input_tokens: 1, output_tokens: 1 }, 'c2')]);

    const run = (...args) => {
      try {
        const out = execFileSync(process.execPath, [CLI, 'stats', ...args], { cwd: proj, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome } });
        return { code: 0, out, err: '' };
      } catch (e) { return { code: e.status, out: String(e.stdout ?? ''), err: String(e.stderr ?? '') }; }
    };
    // Kèm size + mtime để phát hiện cả ghi đè nội dung, không chỉ tạo/xóa tên file.
    const listing = (root) => fs.readdirSync(root, { recursive: true }).map(String).sort().map((n) => {
      const st = fs.statSync(path.join(root, n));
      return st.isFile() ? `${n}:${st.size}:${st.mtimeMs}` : n;
    }).join('\n');

    const before = listing(tmpHome);
    const t = run('--usage');
    ok(t.code === 0 && t.out.includes('claude-fixture-9') && t.out.includes('$1.23') && t.out.includes('—'), 'P5c AC2.1: bảng có tên model, tiền $x.xx và — cho phiên không có cost-state');
    ok(t.out.includes('(1 phiên thiếu cost-state)'), 'P5c AC2.1: dòng tổng nêu 1 phiên thiếu cost-state');
    ok(t.out.includes('có model chưa rõ giá') && t.out.includes('cost-state') && t.out.includes('[Unverified]'), 'P5c AC2.1: nhãn model chưa rõ giá và dòng chú thích cost-state [Unverified]');
    const jr = run('--usage', '--json');
    let rep = null;
    try { rep = JSON.parse(jr.out); } catch { /* để ok() bên dưới báo lỗi */ }
    ok(rep && ['sinceMs', 'sessions', 'totals', 'byModel', 'bySubagent', 'signals', 'top'].every((k) => k in rep) && rep.sessions === 2, 'P5c AC2.1: --json parse được và đủ khóa UsageReport');
    ok(run('--usage', '--since', '1').code === 0 && run('--usage', '--since=2020-01-01').code === 0, 'P5c AC2.1: --since dạng số ngày và yyyy-mm-dd được nhận');

    const bad = run('--usage', '--since', 'abc');
    ok(bad.code === 2 && bad.err.includes('--since'), 'P5c AC2.1: --since sai định dạng → exit 2, stderr nêu --since');
    ok(run('--usage', '--since').code === 2, 'P5c AC2.1: --since là đối số cuối không có giá trị → exit 2');
    const sess = run('--usage', '--session', 'x');
    ok(sess.code === 2 && sess.err.includes('--session'), 'P5c AC2.2: --usage kèm --session → exit 2');
    const lone = run('--since', '3');
    ok(lone.code === 2 && lone.err.includes('--usage'), 'P5c AC2.2: --since không kèm --usage → exit 2');
    const old = run();
    ok(old.code === 0 && old.out.includes('Phiên') && !old.out.includes('Unverified'), 'P5c AC2.2: stats không cờ vẫn in bảng context cũ');

    const all = [t.out, jr.out].join('\n');
    ok(!/SECRET-(USER-TEXT|TOOL-OUT|META-DESC)/.test(all) && all.includes('fixture-agent'), 'P5c AC2.3: không in nội dung hội thoại/mô tả meta, chỉ tên agent');
    ok(listing(tmpHome) === before, 'P5c AC2.3: chỉ đọc, không tạo/xóa/sửa file trong HOME');

    const empty = path.join(tmpHome, 'empty');
    fs.mkdirSync(empty);
    const none = (() => { try { return { code: 0, out: execFileSync(process.execPath, [CLI, 'stats', '--usage'], { cwd: empty, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome } }) }; } catch (e) { return { code: e.status, out: '' }; } })();
    ok(none.code === 0 && none.out.includes('Không tìm thấy transcript'), 'P5c AC2.1: không có transcript → thông báo, exit 0');
  } finally { fs.rmSync(tmpHome, { recursive: true, force: true }); }
}

if (fails.length) { for (const f of fails) console.error('✗', f); console.error(`\n${fails.length} FAIL / ${pass + fails.length}`); process.exit(1); }
console.log(`transcript-usage.test: ${pass} pass`);
