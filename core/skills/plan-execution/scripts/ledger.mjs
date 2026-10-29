#!/usr/bin/env node
// Sổ tiến độ của một plan: <requestDir>/.sdd/progress.md (git bỏ qua cả thư mục .sdd).
// Cách dùng: <requestDir> "<dòng>" — thêm một dòng vào ledger, in đường dẫn file. Exit 2 khi thiếu đối số hoặc dòng bị từ chối.
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DONE_RE = /^Plan: complete\s*$/m;
// Chế độ inline không có review từng task, nên dòng complete là bằng chứng duy nhất: bắt buộc mang lệnh test và exit 0.
const INLINE_COMPLETE_RE = /^Task \d+: complete\b.*\binline\b/i;
const INLINE_EVIDENCE_RE = /\btests: \S.* exit 0\b/;
const EXIT_FAILED_RE = /\bexit [1-9]/;

export function validateLine(line) {
  // Đối số nhiều dòng được kiểm từng dòng: một dòng hợp lệ không được che dòng inline thiếu evidence.
  for (const l of line.split(/\r?\n/)) {
    if (INLINE_COMPLETE_RE.test(l) && !(INLINE_EVIDENCE_RE.test(l) && !EXIT_FAILED_RE.test(l))) {
      return 'dòng Task <n>: complete ở chế độ inline phải có "tests: <lệnh> exit 0" và không kèm exit khác 0';
    }
  }
  return null;
}

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
  const invalid = validateLine(line);
  if (invalid) {
    console.error(invalid);
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
