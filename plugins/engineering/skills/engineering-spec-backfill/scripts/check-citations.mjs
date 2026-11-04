#!/usr/bin/env node
// Kiểm trích dẫn `file:line` trong spec sống: file phải có thật trong root và dòng nằm trong file. Zero-dependency.
// Cách dùng: node check-citations.mjs <spec.md | thư mục specs> [--root <dir>]. Exit 0 sạch, 1 có trích dẫn hỏng, 2 sai đối số.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CITE_RE = /`([^`\s]+):(\d+)`/g;

function lineCount(text) {
  const n = text.split(/\r\n|\r|\n/).length;
  return /(\r\n|\r|\n)$/.test(text) ? n - 1 : n;
}

export function checkCitations(specText, { root }) {
  const errors = [];
  const counts = new Map();
  specText.split(/\r\n|\r|\n/).forEach((text, i) => {
    for (const m of text.matchAll(CITE_RE)) {
      const [, rel, num] = m;
      const ref = `${rel}:${num}`;
      const abs = path.resolve(root, rel);
      const back = path.relative(root, abs);
      if (back.startsWith('..') || path.isAbsolute(back)) { errors.push({ line: i + 1, ref, reason: 'đường dẫn nằm ngoài root' }); continue; }
      if (!counts.has(abs)) {
        let n = null;
        try { if (fs.statSync(abs).isFile()) n = lineCount(fs.readFileSync(abs, 'utf8')); } catch { /* n giữ null */ }
        counts.set(abs, n);
      }
      const n = counts.get(abs);
      const at = Number(num);
      if (n === null) errors.push({ line: i + 1, ref, reason: 'file không tồn tại' });
      else if (at < 1 || at > n) errors.push({ line: i + 1, ref, reason: `dòng ${at} ngoài khoảng 1–${n}` });
    }
  });
  return errors;
}

function specFiles(target) {
  if (fs.statSync(target).isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((e) => {
    const abs = path.join(target, e.name);
    return e.isDirectory() ? specFiles(abs) : e.name.endsWith('.md') ? [abs] : [];
  });
}

export function main(argv) {
  let target;
  let root = process.cwd();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') { root = argv[++i]; if (!root) { console.error('--root cần một thư mục.'); return 2; } }
    else if (!target) target = argv[i];
    else { console.error(`Đối số thừa: ${argv[i]}`); return 2; }
  }
  if (!target || !fs.existsSync(target)) { console.error('Cách dùng: check-citations.mjs <spec.md | thư mục specs> [--root <dir>]'); return 2; }
  root = path.resolve(root);
  let total = 0;
  for (const f of specFiles(target)) {
    for (const e of checkCitations(fs.readFileSync(f, 'utf8'), { root })) {
      console.log(`${path.relative(root, f) || f}:${e.line} ${e.ref} — ${e.reason}`);
      total++;
    }
  }
  console.log(`${total} trích dẫn hỏng`);
  return total ? 1 : 0;
}

// realpath vì trên Windows skill được cài qua junction: argv[1] là đường dẫn junction còn import.meta.url là đường dẫn thật.
const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
