#!/usr/bin/env node
// Gom commit list + diff --stat + diff -U10 của khoảng base..head vào một file cho reviewer.
// Cách dùng: <base> <head> [--plan <plan.md>] [--out <file>] — --out thắng; chỉ có --plan thì ghi vào workspace .aip của plan và in đường dẫn; không có cả hai thì in ra stdout. Exit 1 khi khoảng commit không hợp lệ, exit 2 khi sai đối số.
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolveWorkspace } from './workspace.mjs';

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

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
  return [
    `# Review package: ${range}`,
    '',
    '## Commits',
    run(['log', '--oneline', range]).trimEnd(),
    '',
    '## Stat',
    run(['diff', '--stat', range]).trimEnd(),
    '',
    '## Diff (-U10)',
    run(['diff', '-U10', range]).trimEnd(),
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
