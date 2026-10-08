#!/usr/bin/env node
// Kiểm commit message trước `git commit -F`: UTF-8 hợp lệ, không BOM, header Conventional Commits,
// body tiếng Việt còn dấu. Bản Node để chạy được trên macOS/Linux; bản .ps1 giữ cho shell Windows.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const HEADER = /^[a-z]+(\([^)]+\))?!?: .+$/;
const DIACRITIC = /[àáâãèéêìíĩòóôõùúũýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

export function checkCommitMessage(buf) {
  const errs = [];
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) errs.push('file có BOM — ghi lại UTF-8 không BOM');
  const text = buf.toString('utf8');
  if (text.includes('\uFFFD')) errs.push('UTF-8 hỏng (có ký tự thay thế U+FFFD) — kiểm encoding khi ghi file');
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (!HEADER.test(lines[0] || '')) errs.push(`header không đúng dạng "type(scope): summary": "${(lines[0] || '').slice(0, 60)}"`);
  if (/^co-authored-by:/im.test(text)) errs.push('có dòng Co-Authored-By — bỏ dòng này (quy tắc dự án)');
  const body = lines.slice(1).join('\n').trim();
  if (body && !DIACRITIC.test(body)) errs.push('body không có ký tự tiếng Việt có dấu — dấu đã bị mất?');
  return errs;
}

function main(argv) {
  const file = argv[0];
  if (!file) { console.error('Cách dùng: node check-commit-message.mjs <file>'); return 2; }
  let buf;
  try { buf = fs.readFileSync(file); } catch (e) { console.error(`Không đọc được ${file}: ${e.message}`); return 2; }
  const errs = checkCommitMessage(buf);
  for (const e of errs) console.error(`✗ ${e}`);
  console.log(errs.length ? `${errs.length} lỗi` : 'commit message hợp lệ (UTF-8, header, dấu tiếng Việt).');
  return errs.length ? 1 : 0;
}

const invoked = (() => { try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; } })();
if (invoked) process.exitCode = main(process.argv.slice(2));
