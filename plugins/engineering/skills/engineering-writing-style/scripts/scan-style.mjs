#!/usr/bin/env node
// Quét file theo bảng cụm của references/patterns-*.md. Zero-dependency.
// Cách dùng: node scan-style.mjs <file…>. Exit 0 sạch, 1 có cụm, 2 sai đối số hoặc không đọc được file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HEADER_RE = /^\|\s*Cụm\s*\|\s*Thay bằng\s*\|\s*$/;
const SEPARATOR_RE = /^\|[\s:|-]+\|\s*$/;

export function loadPatterns(dir) {
  const out = [];
  for (const file of fs.readdirSync(dir).filter((f) => /^patterns-.+\.md$/.test(f)).sort()) {
    let inTable = false;
    for (const line of fs.readFileSync(path.join(dir, file), 'utf8').split(/\r\n|\r|\n/)) {
      const t = line.trim();
      if (HEADER_RE.test(t)) { inTable = true; continue; }
      if (!inTable) continue;
      if (!t.startsWith('|')) { inTable = false; continue; }
      if (SEPARATOR_RE.test(t)) continue;
      const [phrase = '', replacement = ''] = t.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (phrase) out.push({ phrase, replacement, file });
    }
  }
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Ranh giới theo ký tự chữ Unicode để "robust" không khớp "robustness" và vẫn chạy với tiếng Việt.
export function scanText(text, patterns) {
  const compiled = patterns.map((p) => ({ ...p, re: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(p.phrase)}(?![\\p{L}\\p{N}])`, 'iu') }));
  const hits = [];
  let fence = false;
  text.split(/\r\n|\r|\n/).forEach((raw, i) => {
    const t = raw.trim();
    if (/^(```|~~~)/.test(t)) { fence = !fence; return; }
    if (fence || t.startsWith('>')) return;
    const line = raw.replace(/`[^`]*`/g, ' ').replace(/https?:\/\/\S+/g, ' ');
    for (const p of compiled) if (p.re.test(line)) hits.push({ line: i + 1, phrase: p.phrase, replacement: p.replacement });
  });
  return hits;
}

function main(files) {
  if (files.length === 0) { console.error('Dùng: node scan-style.mjs <file…>'); return 2; }
  const patterns = loadPatterns(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'references'));
  let found = false;
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch (e) { console.error(`Không đọc được ${f}: ${e.message}`); return 2; }
    for (const h of scanText(text, patterns)) { console.log(`${f}:${h.line}: "${h.phrase}" → ${h.replacement}`); found = true; }
  }
  return found ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
