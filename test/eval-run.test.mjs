#!/usr/bin/env node
// Unit test cho runner eval — chỉ hàm thuần, không gọi model. Zero-dependency.
// Chạy: node test/eval-run.test.mjs
import os from 'node:os';
import path from 'node:path';
import { stripDependencies, parseArgs, extraSkillCopies, needsShell, evalCopyFilter, reportName, staleTraces, isEvalTemp, leftoverEvalTemps } from '../scripts/eval-run.mjs';

let pass = 0;
const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

const src = { name: 'backend', version: '1.0.0', dependencies: ['core'] };
const out = stripDependencies(src);
ok(!('dependencies' in out) && out.name === 'backend' && out.version === '1.0.0', 'eval-run AC1.1: bỏ dependencies, giữ khoá khác');
ok(Array.isArray(src.dependencies), 'eval-run AC1.1: không đổi đối tượng đầu vào');
ok(JSON.stringify(stripDependencies({ name: 'core' })) === '{"name":"core"}', 'eval-run AC1.1: plugin không có dependencies là no-op');

const a = parseArgs(['--plugin', 'core', '--max-cost-usd', '0.3']);
ok(a.plugin === 'core' && a.maxCostUsd === 0.3 && a.runs === 3 && a.scaffold === false, 'eval-run AC1.2: mặc định runs=3, scaffold=false');
const b = parseArgs(['--plugin', 'backend', '--max-cost-usd', '2', '--runs', '1', '--scaffold']);
ok(b.runs === 1 && b.scaffold === true && b.maxCostUsd === 2, 'eval-run AC1.2: đọc --runs và --scaffold');
ok(parseArgs(['--plugin', 'core', '--max-cost-usd', '1', '--case', 'key-*']).case === 'key-*' && a.case === null, 'eval-run: --case chuyển tiếp glob, mặc định null');
ok(throws(() => parseArgs(['--plugin', 'core', '--max-cost-usd', '1', '--case', 'a;b'])), 'eval-run: --case chứa ký tự shell bị từ chối');
ok(throws(() => parseArgs(['--max-cost-usd', '1'])), 'eval-run AC1.2: thiếu --plugin bị từ chối');
ok(throws(() => parseArgs(['--plugin', 'core'])), 'eval-run AC1.2: thiếu --max-cost-usd bị từ chối');
ok(throws(() => parseArgs(['--plugin', 'core', '--max-cost-usd', '1', '--bogus'])), 'eval-run AC1.2: cờ lạ bị từ chối');
ok(throws(() => parseArgs(['--plugin', 'core', '--max-cost-usd', 'abc'])), 'eval-run AC1.2: chi phí không phải số bị từ chối');
ok(throws(() => parseArgs(['--plugin', 'core', '--max-cost-usd', '1', '--runs', '0'])), 'eval-run AC1.2: runs <= 0 bị từ chối');
ok(throws(() => parseArgs(['--plugin', '../x', '--max-cost-usd', '1'])), 'eval-run AC1.2: plugin id chứa đường dẫn bị từ chối');

// Nhánh có plugin của workflows cần plan-execution (skill core) vì workflow-feature gọi nó; plugin khác không đổi.
const ex = extraSkillCopies('workflows', '/r');
ok(ex.length === 1 && ex[0].from.split(path.sep).join('/') === '/r/build/claude/plugins/core/skills/plan-execution' && ex[0].to === 'skills/plan-execution', 'eval-run: workflows chép thêm skill core plan-execution');
ok(extraSkillCopies('backend', '/r').length === 0 && extraSkillCopies('core', '/r').length === 0, 'eval-run: plugin khác workflows không chép thêm skill');

// --case có `*`/`?` chỉ an toàn khi POSIX tự bung; chỉ Windows (.cmd) cần shell.
ok(needsShell('win32') && !needsShell('linux') && !needsShell('darwin'), 'eval-run: chỉ win32 bật shell');

// results cũ không được chép vào bản sao tạm; file khác và thư mục lồng tên `results` vẫn chép.
const keep = evalCopyFilter(path.join('/e', 'core'));
ok(keep(path.join('/e', 'core')) && keep(path.join('/e', 'core', 'case-a', 'prompt.md')) && keep(path.join('/e', 'core', 'case-a', 'results')), 'eval-run: filter giữ case và file');
ok(!keep(path.join('/e', 'core', 'results')) && !keep(path.join('/e', 'core', 'results', 'latest.json')), 'eval-run: filter bỏ results của plugin');

// --case không ghi đè latest.json của lượt đầy đủ.
ok(reportName(null) === 'latest.json' && reportName('key-*') === 'latest-key-_.json' && reportName('a/b?') === 'latest-a_b_.json', 'eval-run: --case ghi báo cáo riêng, lượt đầy đủ giữ latest.json');

// Trace cũ bị xoá theo từng lượt chạy.
const files = ['a-with-1.jsonl', 'a-without-1.jsonl', 'ab-with-1.jsonl', 'b-with-1.jsonl', 'note.txt'];
ok(JSON.stringify(staleTraces(files, null)) === JSON.stringify(files.slice(0, 4)), 'eval-run: lượt đầy đủ xoá mọi trace .jsonl');
ok(JSON.stringify(staleTraces(files, ['a'])) === JSON.stringify(['a-with-1.jsonl', 'a-without-1.jsonl']), 'eval-run: --case chỉ xoá trace của case vừa chạy, không nhầm tiền tố ab');

// Thư mục dọn phải nằm ngay dưới tmp; tracePath giả không được trỏ rmSync ra ngoài.
const tmpRoot = path.join(os.tmpdir(), 'evt');
ok(isEvalTemp(path.join(tmpRoot, 'claude-eval-1'), tmpRoot), 'eval-run: claude-eval-* dưới tmp được dọn');
ok(!isEvalTemp(path.join(tmpRoot, 'x', 'claude-eval-1'), tmpRoot) && !isEvalTemp(path.join(path.resolve('.'), 'claude-eval-1'), tmpRoot) && !isEvalTemp(path.join(tmpRoot, 'other'), tmpRoot), 'eval-run: ngoài tmp hoặc sai tên không bị dọn');

// Eval thoát sớm không có r.json: chỉ dọn thư mục claude-eval-* tạo sau lúc bắt đầu, không đụng thư mục của lượt khác.
const lo = leftoverEvalTemps([{ name: 'claude-eval-new', ms: 10 }, { name: 'claude-eval-old', ms: 5 }, { name: 'other-new', ms: 10 }], 10);
ok(lo.length === 1 && lo[0] === 'claude-eval-new', 'eval-run: thiếu r.json chỉ quét claude-eval-* mới tạo');

if (fails.length) { console.error(`FAIL ${fails.length}:\n- ${fails.join('\n- ')}`); process.exit(1); }
console.log(`eval-run: ${pass} OK`);
