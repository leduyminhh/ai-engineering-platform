#!/usr/bin/env node
// Validate plugin SOURCE structure (chuẩn Claude-style: skills/<id>/SKILL.md + .manifest.json)
// và (tùy chọn) build OUTPUT cho Claude. Zero-dependency — chỉ Node built-in.
//
//   node test/validate.mjs                     # validate source (+ build output nếu build/ tồn tại)
//   node test/validate.mjs --build             # build trước rồi validate cả output
//   node test/validate.mjs --only <substr>     # chỉ chạy module có tên khớp (lặp được), vd --only versions
//
// Các kiểm nằm ở test/contract/*.mjs (generic, áp mọi skill/agent/workflow) rồi test/content/*.mjs (pin theo
// spec/skill, về hưu khi rule đã thành contract); tiền tố số trong tên file cố định thứ tự chạy.
//
// Exit code 0 = pass, 1 = có lỗi.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHarness } from './harness.mjs';
import { buildContext } from './context.mjs';

const argv = process.argv.slice(2);
const h = createHarness(argv);
const ctx = await buildContext({ build: argv.includes('--build'), fails: h.fails });
const here = path.dirname(fileURLToPath(import.meta.url));
const modules = [];
for (const dir of ['contract', 'content']) {
  for (const f of fs.readdirSync(path.join(here, dir)).filter((x) => x.endsWith('.mjs')).sort()) modules.push(`${dir}/${f}`);
}
const selected = modules.filter((rel) => h.only(rel, modules));
if (selected.length === 0) {
  console.error(`--only ${argv.filter((_, i) => argv[i - 1] === '--only').join(', ')}: không có module nào khớp`);
  process.exit(2);
}
for (const rel of selected) {
  const mod = await import(pathToFileURL(path.join(here, rel)).href);
  await mod.default({ ok: h.ok, ctx });
}

const { pass, fails } = h.summary();
console.log('');
if (fails.length) {
  console.log('FAIL:');
  for (const f of fails) console.log('  ✗ ' + f);
}
console.log(`\nKẾT QUẢ: ${pass} pass, ${fails.length} fail`);
process.exit(fails.length ? 1 : 0);
