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
      if (phrase) out.push({ phrase: phrase.normalize('NFC'), replacement, file });
    }
  }
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Ranh giới theo ký tự chữ Unicode để "robust" không khớp "robustness" và vẫn chạy với tiếng Việt;
// \p{M} giữ dấu tổ hợp (NFD) khỏi bị coi là ranh giới.
export function scanText(text, patterns) {
  const compiled = patterns.map((p) => ({ ...p, re: new RegExp(`(?<![\\p{L}\\p{N}\\p{M}])${escapeRe(p.phrase)}(?![\\p{L}\\p{N}\\p{M}])`, 'giu') }));
  const hits = [];
  // Theo CommonMark: fence chỉ đóng bằng cùng ký tự, độ dài >= fence mở; fence không đóng thì phần còn lại của file là code.
  let fence = null;
  // Fence trong list item được thụt tới cột nội dung của item + 3; ngoài list, thụt ≥ 4 là văn xuôi/indented code, không mở fence.
  // shortcut: chỉ nhớ list marker gần nhất, không dựng cây list lồng nhau; nâng cấp khi gặp list lồng nhiều cấp báo sai.
  let listIndent = 0;
  const width = (s) => s.replace(/\t/g, '    ').length;
  text.normalize('NFC').split(/\r\n|\r|\n/).forEach((raw, i) => {
    const ws = /^[ \t]*/.exec(raw)[0];
    const indent = width(ws);
    const lead = raw.slice(ws.length);
    if (fence) {
      const close = /^(`{3,}|~{3,})[ \t]*$/.exec(lead);
      if (close && close[1][0] === fence.ch && close[1].length >= fence.len && indent <= fence.indent + 3) fence = null;
      return;
    }
    const open = indent <= listIndent + 3 && /^(`{3,}|~{3,})(.*)$/.exec(lead);
    if (open && !(open[1][0] === '`' && open[2].includes('`'))) { fence = { ch: open[1][0], len: open[1].length, indent }; return; }
    const marker = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/.exec(raw);
    if (marker) listIndent = width(marker[0]);
    else if (lead && indent === 0) listIndent = 0;
    if (raw.trim().startsWith('>')) return;
    const line = raw.replace(/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g, ' ').replace(/https?:\/\/\S+/g, ' ');
    const found = [];
    for (const p of compiled) {
      for (const m of line.matchAll(p.re)) found.push({ line: i + 1, phrase: p.phrase, replacement: p.replacement, start: m.index, end: m.index + m[0].length });
    }
    // Giữ khớp dài nhất: "Tóm lại" nằm trong "Nói tóm lại" không báo hai lần.
    for (const h of found) {
      if (!found.some((o) => o !== h && o.start <= h.start && o.end >= h.end && o.end - o.start > h.end - h.start)) hits.push({ line: h.line, phrase: h.phrase, replacement: h.replacement });
    }
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
