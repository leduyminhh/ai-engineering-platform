#!/usr/bin/env node
// Chạy `claude plugin eval` một lệnh cho một plugin đã build. Zero-dependency.
// Dùng: node scripts/eval-run.mjs --plugin <id> --max-cost-usd <usd> [--runs 3] [--scaffold] [--case <glob>]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Khoá `dependencies` làm plugin không được nạp khi đánh giá từ đường dẫn, nhánh "có plugin" khi đó trùng baseline.
export function stripDependencies(pluginJson) {
  const { dependencies, ...rest } = pluginJson;
  return rest;
}

export function parseArgs(argv) {
  const out = { plugin: null, runs: 3, maxCostUsd: null, scaffold: false, case: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--scaffold') out.scaffold = true;
    else if (k === '--plugin' || k === '--case' || k === '--runs' || k === '--max-cost-usd') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`${k} thiếu giá trị`);
      if (k === '--plugin') out.plugin = v;
      else if (k === '--case') {
        if (!/^[\w*?.\-/]+$/.test(v)) throw new Error(`--case chứa ký tự không hợp lệ: ${v}`);
        out.case = v;
      }
      else {
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) throw new Error(`${k} phải là số dương: ${v}`);
        if (k === '--runs') { if (!Number.isInteger(n)) throw new Error('--runs phải là số nguyên'); out.runs = n; }
        else out.maxCostUsd = n;
      }
    } else throw new Error(`Đối số không hợp lệ: ${k}`);
  }
  if (!out.plugin) throw new Error('Thiếu --plugin');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(out.plugin)) throw new Error(`plugin id không hợp lệ: ${out.plugin}`);
  if (out.maxCostUsd === null) throw new Error('Thiếu --max-cost-usd');
  return out;
}

function table(report) {
  const rows = [];
  for (const c of report.cases ?? []) {
    for (const arm of ['with', 'without']) {
      const runs = c.arms?.[arm] ?? [];
      const names = new Set(runs.flatMap((r) => (r.graders ?? []).map((g) => g.name)));
      for (const n of names) {
        const gs = runs.map((r) => (r.graders ?? []).find((g) => g.name === n)).filter(Boolean);
        rows.push([c.name ?? c.id ?? '?', arm, n, `${gs.filter((g) => g.passed).length}/${gs.length}`]);
      }
    }
  }
  const w = [0, 1, 2, 3].map((i) => Math.max(...rows.map((r) => r[i].length), 4));
  return rows.map((r) => r.map((v, i) => v.padEnd(w[i])).join('  ')).join('\n');
}

function run() {
  const a = parseArgs(process.argv.slice(2));
  const built = path.join(ROOT, 'build', 'claude', 'plugins', a.plugin);
  if (!fs.existsSync(built)) {
    const r = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: true });
    if (r.status !== 0 || !fs.existsSync(built)) throw new Error(`Không build được ${built}`);
  }
  const evalSrc = path.join(ROOT, 'evals', a.plugin);
  if (!fs.existsSync(evalSrc)) throw new Error(`Không có evals/${a.plugin}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-eval-'));
  const work = path.join(tmp, a.plugin);
  const evalTemps = new Set();
  try {
    fs.cpSync(built, work, { recursive: true, dereference: true });
    fs.cpSync(evalSrc, path.join(work, 'evals'), { recursive: true });
    const pj = path.join(work, '.claude-plugin', 'plugin.json');
    fs.writeFileSync(pj, JSON.stringify(stripDependencies(JSON.parse(fs.readFileSync(pj, 'utf8'))), null, 2) + '\n');

    const args = ['plugin', 'eval', '.', '--eval-dir', 'evals', '--runs', String(a.runs), '--keep-temp',
      '--max-cost-usd', String(a.maxCostUsd), '--no-publish', ...(a.scaffold ? ['--scaffold'] : []), ...(a.case ? ['--case', a.case] : []),
      '--allow-tools', 'Write', 'Edit', '--trust-plugin', '--json', 'r.json'];
    const r = spawnSync('claude', args, { cwd: work, stdio: 'inherit', shell: true });
    const rj = path.join(work, 'r.json');
    if (!fs.existsSync(rj)) throw new Error(`claude plugin eval không tạo r.json (exit ${r.status})`);
    const report = JSON.parse(fs.readFileSync(rj, 'utf8'));

    const results = path.join(evalSrc, 'results');
    const traces = path.join(results, 'traces');
    fs.mkdirSync(traces, { recursive: true });
    fs.copyFileSync(rj, path.join(results, 'latest.json'));
    for (const c of report.cases ?? []) {
      for (const arm of ['with', 'without']) {
        (c.arms?.[arm] ?? []).forEach((run, i) => {
          if (!run.tracePath) return;
          // tracePath nằm trong claude-eval-*/out/; chỉ thư mục cha mang tên đó mới bị xoá ở bước dọn.
          const dir = path.dirname(path.dirname(run.tracePath));
          if (/^claude-eval-/.test(path.basename(dir))) evalTemps.add(dir);
          if (fs.existsSync(run.tracePath)) fs.copyFileSync(run.tracePath, path.join(traces, `${c.name ?? c.id}-${arm}-${i + 1}.jsonl`));
        });
      }
    }
    console.log(table(report));
    console.log(`\nChi phí: ${report.costUsd ?? '?'} USD${report.partial ? ' (partial)' : ''}; kết quả: ${results}`);
    process.exitCode = r.status ?? 1;
  } finally {
    for (const d of evalTemps) fs.rmSync(d, { recursive: true, force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(); } catch (e) { console.error(e.message); process.exit(1); }
}
