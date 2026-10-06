#!/usr/bin/env node
// Báo cáo trùng lặp nội dung skill ↔ skill và workflow ↔ workflow (spec 2026-10-06 §5.1).
// Chỉ in số liệu để ra quyết định gộp; không assert nên không nằm trong `npm test`.
import { pathToFileURL } from 'node:url';
import { loadPlugins, loadCore, loadWorkflows } from '../cli/lib/plugins.mjs';
import { WF_ANCHORS, parseSteps } from '../cli/lib/workflows.mjs';

const ANCHORS = new Set(WF_ANCHORS);
// Dòng kẻ bảng, rào code và dòng chỉ có # trùng ở mọi file nên không phản ánh nội dung.
const STRUCTURAL = /^(\|[-| :]+\||```.*|#+|---)$/;

export function normLines(text) {
  return new Set(text.split('\n').map((l) => l.trim()).filter((l) => l && !ANCHORS.has(l) && !STRUCTURAL.test(l)));
}

const ratio = (hits, a, b) => (Math.min(a, b) ? hits / Math.min(a, b) : 0);

export function lineOverlap(a, b) {
  const A = normLines(a);
  const B = normLines(b);
  return ratio([...A].filter((l) => B.has(l)).length, A.size, B.size);
}

const field = (body, f) => ((body.split(`**${f}:**`)[1] || '').split('\n- **')[0]).replace(/\s+/g, ' ').trim();
const stepKey = (s) => `${field(s.body, 'Thực hiện')}§${field(s.body, 'Hành động')}`;
const titleKey = (s) => s.title.replace('⏸', '').trim().toLowerCase();

export function stepOverlap(a, b) {
  const A = parseSteps(a);
  const B = new Set(parseSteps(b).map(stepKey));
  return ratio(A.filter((s) => B.has(stepKey(s))).length, A.length, B.size);
}

export function titleOverlap(a, b) {
  const A = parseSteps(a);
  const B = new Set(parseSteps(b).map(titleKey));
  return ratio(A.filter((s) => B.has(titleKey(s))).length, A.length, B.size);
}

const pct = (x) => `${Math.round(x * 100)}%`;

function report(title, items, cols) {
  const rows = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      rows.push([`${items[i].id} ↔ ${items[j].id}`, ...cols.map(([, fn]) => fn(items[i].body, items[j].body))]);
    }
  }
  rows.sort((x, y) => Math.max(...y.slice(1)) - Math.max(...x.slice(1)));
  console.log(`\n## ${title}\n`);
  console.log(`| Cặp | ${cols.map(([h]) => h).join(' | ')} |`);
  console.log(`|---|${cols.map(() => '---').join('|')}|`);
  for (const r of rows.slice(0, 15)) {
    console.log(`| ${r[0]} | ${r.slice(1).map((x) => `${pct(x)}${x >= 0.6 ? ' ⚠' : ''}`).join(' | ')} |`);
  }
}

function main() {
  const skills = [...loadCore().stages, ...loadPlugins().flatMap((p) => p.stages)];
  const workflows = (loadWorkflows() || { stages: [] }).stages;
  report('Skill ↔ skill (top 15)', skills, [['Dòng', lineOverlap]]);
  report('Workflow ↔ workflow (top 15)', workflows,
    [['Dòng', lineOverlap], ['Bước (Thực hiện + Hành động)', stepOverlap], ['Tên bước', titleOverlap]]);
  console.log('\n⚠ = chạm ngưỡng gộp 60% (spec §5.2 tiêu chí 2).');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
