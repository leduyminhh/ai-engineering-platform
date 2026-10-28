#!/usr/bin/env node
// Gom commit list + diff --stat + diff -U10 của khoảng base..head vào một file cho reviewer.
// Cách dùng: <base> <head> [--out <file>] — không có --out thì in ra stdout. Exit 1 khi khoảng commit không hợp lệ, exit 2 khi sai đối số.
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

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

export function main(argv) {
  const args = [...argv];
  const oi = args.indexOf('--out');
  let out = null;
  if (oi >= 0) { out = args[oi + 1]; args.splice(oi, 2); }
  const [base, head] = args;
  if (!base || !head || (oi >= 0 && !out)) {
    console.error('Cách dùng: review-package.mjs <base> <head> [--out <file>]');
    return 2;
  }
  try {
    const pkg = buildPackage({ base, head });
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
