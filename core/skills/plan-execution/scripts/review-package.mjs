#!/usr/bin/env node
// Gom commit list (kèm file đổi của từng commit) + diff --stat + dấu hiệu nới kiểm (diff và project-knowledge/quality-bar.md) + diff -U10 của khoảng base..head vào một file cho reviewer.
// Cách dùng: <base> <head> [--plan <plan.md>] [--out <file>] — --out thắng; chỉ có --plan thì ghi vào workspace .aip của plan và in đường dẫn; không có cả hai thì in ra stdout. Exit 1 khi khoảng commit không hợp lệ, exit 2 khi sai đối số.
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolveWorkspace } from './workspace.mjs';

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

// Dấu hiệu bỏ qua test hoặc tắt cảnh báo: agent hay dùng để "xanh" thay vì sửa lỗi thật.
const WEAKENING =/@Disabled|@Ignore\b|@SuppressWarnings|@SuppressFBWarnings|@Test\([^)]*enabled\s*=\s*false|pytest\.(?:mark\.)?skip|\bxfail\b|unittest\.skip|\b(?:it|test|describe)\.(?:skip|only)\(|\b[xf](?:it|describe)\(|\bt\.Skip\w*\(|NOSONAR|#\s*nosec|#\s*noqa|pylint:\s*disable|\/\/\s*nolint|pragma: no cover|istanbul ignore|eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck|#\s*type:\s*ignore/;

// Ngưỡng hạ xuống là nới (coverage tối thiểu) và ngưỡng nâng lên là nới (số cảnh báo/lỗi cho phép).
// Khoá phải đi liền một con số để tên biến thường như `lines` trong code không bị bắt nhầm.
// shortcut: không bắt timeout (tăng có thể là sửa đúng) và ngưỡng đổi tên khoá; cần thì thêm danh sách khoá theo project.
const MIN_KEY = /(?:fail[_-]?under|minimum|threshold|coveredratio|\b(?:lines|branches|functions|statements))["'>]?\s*[:=>]?\s*["']?-?\d/i;
const MAX_KEY = /(?:max[_-]?(?:warnings|complexity|violations|issues|failures)|allowed[_-]?failures)["'>]?\s*[:=]?\s*["']?-?\d/i;
const NUM = /-?\d+(?:\.\d+)?/g;

// Dòng xoá và dòng thêm chỉ khác số trên cùng khoá ngưỡng, đổi theo hướng nới → "cũ → mới"; còn lại → null.
export function loosenedThreshold(oldLine, newLine) {
  const dir = MAX_KEY.test(newLine) ? 1 : MIN_KEY.test(newLine) ? -1 : 0;
  if (!dir || oldLine.replace(NUM, '#') !== newLine.replace(NUM, '#')) return null;
  const a = oldLine.match(NUM);
  const b = newLine.match(NUM);
  const i = a.findIndex((x, k) => Number(x) !== Number(b[k]));
  if (i < 0) return null;
  return Math.sign(Number(b[i]) - Number(a[i])) === dir ? `${a[i]} → ${b[i]}` : null;
}

// Liệt kê dòng thêm mới khớp WEAKENING hoặc nới ngưỡng, kèm file, để reviewer buộc phải xét từng chỗ.
export function findWeakening(diff) {
  const hits = [];
  let file = '';
  // Dòng thêm có nội dung "++ x" cũng bắt đầu bằng "+++ ": chỉ coi là header khi đang ở giữa "diff --git" và "@@".
  let inHeader = false;
  // Dòng xoá của khối thay đổi hiện tại; dòng ngữ cảnh hay hunk mới kết thúc khối.
  let removed = [];
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) { inHeader = true; removed = []; continue; }
    if (line.startsWith('@@')) { inHeader = false; removed = []; continue; }
    if (inHeader) {
      if (line.startsWith('+++ ')) file = line.replace(/^\+\+\+ (?:b\/)?/, '').replace(/[\t\r]+$/, '');
      continue;
    }
    if (line.startsWith('-')) { removed.push(line.slice(1)); continue; }
    if (!line.startsWith('+')) { removed = []; continue; }
    // Markdown chỉ nhắc tên annotation hay con số, không tắt được test nào.
    if (file.endsWith('.md')) continue;
    const added = line.slice(1);
    if (WEAKENING.test(line)) hits.push(`- ${file}: ${added.trim()}`);
    for (const old of removed) {
      const change = loosenedThreshold(old, added);
      if (change) { hits.push(`- ${file}: ngưỡng nới ${change}: ${added.trim()}`); break; }
    }
  }
  return hits;
}

const QUALITY_BAR = 'project-knowledge/quality-bar.md';
const THRESHOLD = /^(.*?)\s*(>=|<=)\s*(-?\d+(?:\.\d+)?)$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Hàng bảng của mục "## <heading>" → mảng ô (bỏ backtick và khoảng trắng); bỏ dòng tiêu đề cột và dòng ngăn.
function tableRows(text, heading) {
  const body = text.replace(/\r\n/g, '\n').split(new RegExp('^## ' + heading + '\s*$', 'm'))[1]?.split(/^## /m)[0] ?? '';
  return body.split('\n').filter((l) => l.trim().startsWith('|')).slice(2)
    .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.replace(/`/g, '').trim()));
}

// So hai bản quality-bar.md, trả dòng báo cho mọi chỗ nới; thêm lệnh, siết ngưỡng, bỏ ngoại lệ, rút hạn không báo.
export function qualityBarLoosening(oldText, newText) {
  const out = [];
  const say = (s) => out.push('- ' + QUALITY_BAR + ': ' + s);
  const newCmds = new Map(tableRows(newText, 'Lệnh kiểm').map(([c, th]) => [c, th ?? '']));
  for (const [cmd, oldTh = ''] of tableRows(oldText, 'Lệnh kiểm')) {
    if (!newCmds.has(cmd)) { say('bỏ lệnh kiểm ' + cmd); continue; }
    const newTh = newCmds.get(cmd);
    if (newTh === oldTh) continue;
    const a = oldTh.match(THRESHOLD);
    const b = newTh.match(THRESHOLD);
    if (a && b && a[1] === b[1] && a[2] === b[2]) {
      const d = Number(b[3]) - Number(a[3]);
      if (a[2] === '>=' ? d < 0 : d > 0) say('ngưỡng nới ' + cmd + ': ' + oldTh + ' → ' + newTh);
    } else say('đổi ngưỡng, cần xét ' + cmd + ': ' + oldTh + ' → ' + newTh);
  }
  const oldExc = new Map(tableRows(oldText, 'Ngoại lệ').map((r) => [r[0], r[3] ?? '']));
  for (const [name, , , due = ''] of tableRows(newText, 'Ngoại lệ')) {
    if (!oldExc.has(name)) say('thêm ngoại lệ ' + name);
    else if (ISO_DATE.test(due) && ISO_DATE.test(oldExc.get(name)) && due > oldExc.get(name)) say('gia hạn ngoại lệ ' + name + ': ' + oldExc.get(name) + ' → ' + due);
  }
  return out;
}

// Chỉ đọc hai bản khi khoảng đổi đúng file này; chưa có ở base thì không có gì để so, bị xoá ở head thì mọi lệnh cũ là bỏ.
function qualityBarHits(range, base, head, run) {
  if (!run(['diff', '--name-only', range]).split('\n').some((l) => l.trim() === QUALITY_BAR)) return [];
  const show = (ref) => { try { return run(['show', ref + ':' + QUALITY_BAR]); } catch { return null; } };
  const oldText = show(base);
  if (oldText === null) return [];
  return qualityBarLoosening(oldText, show(head) ?? '');
}

// `run(args) -> stdout` chạy git (không qua shell); quy ước run ném lỗi khi git exit khác 0.
export function buildPackage({ base, head, run = git }) {
  // Ref bắt đầu bằng '-' sẽ bị git hiểu là option.
  for (const ref of [base, head]) {
    if (!ref || ref.startsWith('-')) throw new Error(`Ref không hợp lệ: "${ref}"`);
  }
  if (base === head) throw new Error('base và head trùng nhau: không có gì để review');
  try { run(['merge-base', '--is-ancestor', base, head]); } catch (e) {
    // --is-ancestor: exit 1 = không là tổ tiên; mã khác (128…) = ref không tồn tại hoặc git lỗi.
    if (e?.status === 1) throw new Error(`${base} không là tổ tiên của ${head}`);
    throw new Error(`Không kiểm được ${base}..${head}: ref không tồn tại hoặc git lỗi (${String(e?.message ?? e).trim()})`);
  }
  const range = `${base}..${head}`;
  const diff = run(['diff', '-U10', range]).trimEnd();
  const weakening = [...findWeakening(diff), ...qualityBarHits(range, base, head, run)];
  return [
    `# Review package: ${range}`,
    '',
    '## Commits',
    run(['log', '--stat', '--format=%h %s', range]).trimEnd(),
    '',
    '## Stat',
    run(['diff', '--stat', range]).trimEnd(),
    '',
    '## Dấu hiệu nới kiểm',
    weakening.length ? weakening.join('\n') : '(không có)',
    '',
    '## Diff (-U10)',
    diff,
    '',
  ].join('\n');
}

export function main(argv, deps) {
  const args = [...argv];
  // null = không có cờ; '' = có cờ nhưng thiếu giá trị.
  const take = (flag) => {
    const i = args.indexOf(flag);
    return i < 0 ? null : (args.splice(i, 2)[1] ?? '');
  };
  let out = take('--out');
  const plan = take('--plan');
  const [base, head] = args;
  if (!base || !head || out === '' || plan === '') {
    console.error('Cách dùng: review-package.mjs <base> <head> [--plan <plan.md>] [--out <file>]');
    return 2;
  }
  try {
    const pkg = buildPackage({ base, head });
    // Tên theo khoảng commit để review task, re-review và review cuối trong cùng workspace không ghi đè nhau; ref có `/` hoặc `:` phải làm sạch.
    if (!out && plan) out = path.join(resolveWorkspace(plan, deps).dir, `review-${base}..${head}.md`.replace(/[^\w.~^+-]/g, '_'));
    if (!out) { process.stdout.write(pkg); return 0; }
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, pkg);
    console.log(out);
    return 0;
  } catch (e) {
    console.error(e.message);
    return 1;
  }
}

const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
