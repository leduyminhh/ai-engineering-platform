#!/usr/bin/env node
// Sổ tiến độ của một plan: <requestDir>/.sdd/progress.md (git bỏ qua cả thư mục .sdd).
// Cách dùng: <requestDir> "<dòng>" — thêm một dòng vào ledger, in đường dẫn file. Exit 2 khi thiếu đối số.
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DONE_RE = /^Plan: complete\s*$/m;

// Tạo .sdd/ và .gitignore chứa `*` để ledger không bao giờ lọt vào commit; trả đường dẫn progress.md.
export function ensureWorkspace(requestDir) {
  const dir = path.join(requestDir, '.sdd');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.gitignore'), '*\n');
  return path.join(dir, 'progress.md');
}

export function appendLedger(file, line) {
  fs.appendFileSync(file, `${line.replace(/\r?\n$/, '')}\n`);
}

// null = không có gì để nạp lại: file không đọc được hoặc plan đã xong. Còn lại trả tối đa `max` ký tự cuối.
export function readTail(file, max) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
  if (DONE_RE.test(text)) return null;
  return text.slice(Math.max(0, text.length - max));
}

export function main(argv) {
  const [requestDir, line] = argv;
  if (!requestDir || line === undefined) {
    console.error('Cách dùng: ledger.mjs <requestDir> "<dòng>"');
    return 2;
  }
  const file = ensureWorkspace(requestDir);
  appendLedger(file, line);
  console.log(file);
  return 0;
}

const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
