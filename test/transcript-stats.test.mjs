#!/usr/bin/env node
// Unit test cho transcript-stats — fixture JSONL dựng tại chỗ, không cần transcript thật. Zero-dependency.
// Chạy: node test/transcript-stats.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectSlug, statsFromLines, statsForFile, findTranscripts } from '../cli/lib/transcript-stats.mjs';

let pass = 0;
const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };
const j = (o) => JSON.stringify(o);
const asst = (id, content, usage) => j({ type: 'assistant', message: { id, role: 'assistant', content, ...(usage ? { usage } : {}) } });
const user = (content) => j({ type: 'user', message: { role: 'user', content } });

ok(projectSlug('E:\\Mine\\AI\\x') === 'E--Mine-AI-x', 'AC4.2: projectSlug chuyển dấu hai chấm và gạch chéo thành -');

const u = { input_tokens: 2, cache_read_input_tokens: 43501, cache_creation_input_tokens: 23846 };
let s = statsFromLines([asst('m1', [{ type: 'text', text: 'a' }], u), asst('m1', [{ type: 'text', text: 'b' }], u)]);
ok(s.turns === 1 && s.lastCtx === 67349, 'AC4.2: context một lượt = input + cache_read + cache_creation');

s = statsFromLines([
  asst('m1', [{ type: 'tool_use', id: 't1', name: 'Read', input: {} }]),
  user([{ type: 'tool_result', tool_use_id: 't1', content: 'x'.repeat(100) }]),
  user([{ type: 'tool_result', tool_use_id: 't1', content: 'y'.repeat(50) }]),
]);
ok(s.chars.toolResult === 100 && s.toolResultByTool.Read === 100, 'AC4.2: tool_result trùng tool_use_id chỉ tính một lần');

s = statsFromLines([
  asst('m1', [{ type: 'thinking', thinking: 't'.repeat(300) }]),
  asst('m1', [{ type: 'text', text: 'a'.repeat(200) }]),
]);
ok(s.chars.thinking === 300 && s.chars.assistantText === 200, 'AC4.2: hai entry assistant cùng message.id khác block đều được tính');

s = statsFromLines([j({ type: 'attachment', attachment: { type: 'skill_listing', content: 'z'.repeat(480) } })]);
ok(s.chars.attachment > 0 && s.chars.toolResult === 0 && s.attachmentByType.skill_listing === s.chars.attachment,
  'AC4.2: attachment tách nhóm riêng');

s = statsFromLines([asst('m1', [{ type: 'text', text: 'aa' }], u), '{not json', user('hello'), '{"type":"assistant","mess']);
ok(s.turns === 1 && s.chars.assistantText === 2 && s.chars.userText === 5, 'AC4.2: dòng JSONL hỏng (kể cả dòng cuối dở) không làm hỏng báo cáo');

s = statsFromLines([
  asst('m1', [{ type: 'thinking', thinking: 'abc' }, { type: 'text', text: 'de' }, { type: 'tool_use', id: 't1', name: 'Bash', input: { c: 'ls' } }], u),
  user([{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: '12345' }] }]),
  user('fgh'),
  j({ type: 'attachment', attachment: { type: 'x', v: 1 } }),
  j({ type: 'queue-operation', content: 'ignored' }),
]);
const expected = 3 + 2 + JSON.stringify({ c: 'ls' }).length + 5 + 3 + JSON.stringify({ type: 'x', v: 1 }).length;
ok(Object.values(s.chars).reduce((a, b) => a + b, 0) === expected, 'AC4.2: tổng các nhóm = tổng ký tự nội dung');

s = statsFromLines([
  asst('a', [], { input_tokens: 10 }), asst('b', [], { input_tokens: 50 }), asst('c', [], { input_tokens: 30 }),
]);
ok(s.firstCtx === 10 && s.peakCtx === 50 && s.peakTurn === 2 && s.lastCtx === 30 && s.turns === 3, 'AC4.2: first/peak/peakTurn/last');

// file + findTranscripts trên thư mục tạm; dọn bằng fs.rmSync (không rm -rf trên Windows)
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-stats-'));
try {
  ok(findTranscripts({ home, cwd: 'E:\\none' }).length === 0, 'AC4.2: project chưa có phiên → mảng rỗng, không ném lỗi');
  const dir = path.join(home, '.claude', 'projects', projectSlug('E:\\p'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 's1.jsonl'), asst('m1', [], u) + '\n{"type":"assis');
  fs.writeFileSync(path.join(dir, 'note.txt'), 'x');
  const found = findTranscripts({ home, cwd: 'E:\\p' });
  ok(found.length === 1 && statsForFile(found[0]).lastCtx === 67349, 'AC4.2: findTranscripts + statsForFile đọc file đang ghi dở');
} finally { fs.rmSync(home, { recursive: true, force: true }); }

if (fails.length) { for (const f of fails) console.error('✗', f); console.error(`\n${fails.length} FAIL / ${pass + fails.length}`); process.exit(1); }
console.log(`transcript-stats.test: ${pass} pass`);
