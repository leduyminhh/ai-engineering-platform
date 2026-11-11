#!/usr/bin/env node
// Đo ledger của một project: đọc <project>/.aip/runs/<request>/**/progress.md, in JSON ra stdout, không ghi gì.
// Cách dùng: --project <dir> [--label <nhãn>]. Thiếu --project hoặc không thấy progress.md: exit 1, lý do ra stderr.
// Dòng nhận: `Task <n>: complete` (không phân biệt hoa thường, loại `complete?`; nhiều dòng của một task đếm một lần),
// `Task <n>: review <vòng> <compliant|issues|cannot_verify> a/b/c`, `Ruling:`, `minor (deferred)`; chỉ task đã complete vào mẫu số.
// Hai chỉ số thành công: pctReview2plus (% task cần review từ vòng 2) và outsideFilesPerRequest (ruling "ngoài Files" trên mỗi request).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const COMPLETE_RE = /^Task (\d+): complete\b(?!\?)/i;
const REVIEW_RE = /^Task (\d+): review (\d+) (compliant|issues|cannot_verify) \d+\/\d+\/\d+/;
const OUTSIDE_RE = /ngoài\s+\**Files/i;
const round1 = (x) => Math.round(x * 10) / 10;
const round2 = (x) => Math.round(x * 100) / 100;

export function parseLedger(text) {
  const complete = new Set();
  const maxRound = {};
  const issueRounds = {};
  let rulings = 0, outsideFiles = 0, minor = 0;
  for (const line of text.split(/\r\n|\r|\n/)) {
    let m;
    if ((m = COMPLETE_RE.exec(line))) complete.add(Number(m[1]));
    else if ((m = REVIEW_RE.exec(line))) {
      const [n, round] = [m[1], Number(m[2])];
      maxRound[n] = Math.max(maxRound[n] || 0, round);
      if (m[3] === 'issues') (issueRounds[n] ||= []).push(round);
    } else if (line.startsWith('Ruling:')) {
      rulings++;
      if (OUTSIDE_RE.test(line)) outsideFiles++;
    } else if (line.startsWith('minor (deferred)')) minor++;
  }
  return { complete: [...complete].sort((a, b) => a - b), maxRound, issueRounds, rulings, outsideFiles, minor };
}

function findLedgers(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...findLedgers(p));
    else if (e.name === 'progress.md') out.push(p);
  }
  return out;
}

export function measure(dir, label = 'project') {
  const runs = path.join(dir, '.aip', 'runs');
  const byReq = new Map();
  let ledgers = 0;
  if (fs.existsSync(runs)) {
    for (const r of fs.readdirSync(runs, { withFileTypes: true }).filter((e) => e.isDirectory()).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const files = findLedgers(path.join(runs, r.name)).sort();
      if (!files.length) continue;
      const s = { request: r.name, tasks: 0, tasksReview2plus: 0, tasksIssuesAtRound2plus: 0, tasksIssuesAtRound3plus: 0, rulings: 0, rulingsOutsideFiles: 0, minorDeferred: 0 };
      for (const f of files) {
        ledgers++;
        const p = parseLedger(fs.readFileSync(f, 'utf8'));
        for (const n of p.complete) {
          s.tasks++;
          if ((p.maxRound[n] || 0) >= 2) s.tasksReview2plus++;
          const issues = p.issueRounds[n] || [];
          if (issues.some((x) => x >= 2)) s.tasksIssuesAtRound2plus++;
          if (issues.some((x) => x >= 3)) s.tasksIssuesAtRound3plus++;
        }
        s.rulings += p.rulings; s.rulingsOutsideFiles += p.outsideFiles; s.minorDeferred += p.minor;
      }
      byReq.set(r.name, s);
    }
  }
  if (!ledgers) throw new Error('không thấy progress.md nào dưới .aip/runs của --project');
  const rows = [...byReq.values()];
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const tasks = sum('tasks');
  return {
    project: label,
    ledgers,
    requests: rows.length,
    tasks,
    tasksReview2plus: sum('tasksReview2plus'),
    pctReview2plus: tasks ? round1((sum('tasksReview2plus') / tasks) * 100) : 0,
    tasksIssuesAtRound2plus: sum('tasksIssuesAtRound2plus'),
    tasksIssuesAtRound3plus: sum('tasksIssuesAtRound3plus'),
    rulings: sum('rulings'),
    rulingsOutsideFiles: sum('rulingsOutsideFiles'),
    outsideFilesPerRequest: round2(sum('rulingsOutsideFiles') / rows.length),
    minorDeferred: sum('minorDeferred'),
    byRequest: rows.map(({ request, tasks, tasksReview2plus, rulings, rulingsOutsideFiles, minorDeferred }) => (
      { request, tasks, tasksReview2plus, rulings, rulingsOutsideFiles, minorDeferred })),
  };
}
