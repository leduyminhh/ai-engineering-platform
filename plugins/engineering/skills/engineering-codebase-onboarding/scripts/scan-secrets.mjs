#!/usr/bin/env node
// Quét file Markdown tìm dấu hiệu secret. Zero-dependency.
// Cách dùng: node scan-secrets.mjs <file | thư mục> [...]. In `file:line loại`, không bao giờ in đoạn khớp.
// Exit 0 sạch, 1 có khớp, 2 sai đối số hoặc file không đọc được.
// Heuristic: sạch không chứng minh log phiên sạch hay không còn secret dạng tự do (mật khẩu không kèm tên khoá, chuỗi mã hoá lạ).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PLACEHOLDER = /^(<.*|\$.*|\{\{.*|\*+|x{3,}|changeme|change-me|null|none|true|false|\.{3}|…)$/i;
const isPlaceholder = (v) => v.length < 4 || PLACEHOLDER.test(v);

const SECRET_KEY = /(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential)s?["']?\s*[:=]\s*["']?([^\s"'`,;|]*)/gi;
const URL_CRED = /[a-z][a-z0-9+.-]*:\/\/[^\s/:@<>]+:([^\s/@<>]+)@/gi;
// Octet phải ≤ 255; dải 127.*, 0.0.0.0 và 192.0.2.* không nằm trong ba dải riêng nên không khớp.
const PRIVATE_IP = /(?<![\d.])(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?!\.?\d)/g;

const RULES = [
  ['private-key', (l) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(l)],
  ['cloud-key-id', (l) => /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bAIza[0-9A-Za-z_-]{35}\b|\bxox[abprs]-[0-9A-Za-z-]{10,}/.test(l)],
  ['jwt', (l) => /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(l)],
  ['url-credentials', (l) => [...l.matchAll(URL_CRED)].some((m) => !isPlaceholder(m[1]))],
  ['secret-assignment', (l) => [...l.matchAll(SECRET_KEY)].some((m) => !isPlaceholder(m[1]))],
  ['private-ip', (l) => [...l.matchAll(PRIVATE_IP)].some((m) => m[1].split('.').every((o) => Number(o) <= 255))],
];

export function scanText(text) {
  const out = [];
  text.split(/\r\n|\r|\n/).forEach((line, i) => {
    for (const [kind, test] of RULES) if (test(line)) out.push({ line: i + 1, kind });
  });
  return out;
}

function filesOf(target) {
  if (fs.statSync(target).isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((e) => {
    const abs = path.join(target, e.name);
    return e.isDirectory() ? filesOf(abs) : e.name.endsWith('.md') ? [abs] : [];
  });
}

export function scanPaths(targets) {
  return targets.flatMap((t) => filesOf(t).flatMap((f) => scanText(fs.readFileSync(f, 'utf8')).map((h) => ({ file: f, ...h }))));
}

export function main(argv) {
  if (argv.length === 0) { console.error('Cách dùng: scan-secrets.mjs <file | thư mục> [...]'); return 2; }
  let hits;
  try { hits = scanPaths(argv); } catch { console.error('Không đọc được một trong các đường dẫn đã nêu.'); return 2; }
  for (const h of hits) console.log(`${h.file}:${h.line} ${h.kind}`);
  console.log(`${hits.length} khớp`);
  return hits.length ? 1 : 0;
}

// realpath vì trên Windows skill được cài qua junction: argv[1] là đường dẫn junction còn import.meta.url là đường dẫn thật.
const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
