#!/usr/bin/env node
// aip — Plugins Platform build CLI
//
// Sinh cấu hình workflow cho từng công cụ (claude / cursor / codex / antigravity) từ
// NGUỒN SỰ THẬT trung tính trong plugins/. Mỗi LĨNH VỰC = một plugin (plugins/<id>/);
// mỗi CÔNG CỤ = một adapter (adapters/<tool>/adapter.mjs). Adapter nhận TOÀN BỘ danh
// sách plugin và tự quyết cách bố trí output: claude gộp thành MỘT marketplace nhiều
// plugin; cursor/codex/antigravity sinh cấu hình RIÊNG cho từng plugin. Zero dependency.
//
// Dùng:
//   node cli/build.mjs --list                          # liệt kê adapter + plugin
//   node cli/build.mjs --target claude                 # build 1 adapter -> build/claude/
//   node cli/build.mjs --target all                    # build mọi adapter
//   node cli/build.mjs --target all --plugin backend   # chỉ build 1 plugin
//   node cli/build.mjs --target cursor --out ./out     # đổi thư mục output
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPlugins, loadMarketplace, loadCore, REPO_ROOT } from './lib/plugins.mjs';
import { writeFiles, ensureDir, rmrf } from './lib/write.mjs';
import { writeWizardReport } from './lib/report.mjs';

const ADAPTERS_DIR = path.join(REPO_ROOT, 'adapters');
const DEFAULT_OUT = path.join(REPO_ROOT, 'build');

function parseArgs(argv) {
  const a = { target: null, out: null, plugin: null, list: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--list') a.list = true;
    else if (v === '--target') a.target = argv[++i];
    else if (v === '--out') a.out = argv[++i];
    else if (v === '--plugin') a.plugin = argv[++i];
    else if (v.startsWith('--target=')) a.target = v.slice(9);
    else if (v.startsWith('--out=')) a.out = v.slice(6);
    else if (v.startsWith('--plugin=')) a.plugin = v.slice(9);
  }
  return a;
}

async function discoverAdapters() {
  const out = [];
  if (!fs.existsSync(ADAPTERS_DIR)) return out;
  for (const e of fs.readdirSync(ADAPTERS_DIR, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('_')) continue;
    const file = path.join(ADAPTERS_DIR, e.name, 'adapter.mjs');
    if (!fs.existsSync(file)) continue;
    const mod = await import(pathToFileURL(file).href);
    const adapter = mod.default;
    if (!adapter || typeof adapter.build !== 'function') {
      console.warn(`[warn] adapters/${e.name}/adapter.mjs thiếu default export { name, build }`);
      continue;
    }
    out.push({ ...adapter, _dir: e.name });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const adapters = await discoverAdapters();
  let plugins = loadPlugins();
  const marketplace = loadMarketplace();
  const core = loadCore();

  if (args.plugin) {
    plugins = plugins.filter((p) => p.id === args.plugin);
    if (plugins.length === 0) {
      console.error(`[lỗi] Không tìm thấy plugin "${args.plugin}".`);
      process.exit(1);
    }
  }

  if (args.list || !args.target) {
    console.log('Adapter (auto-discovered từ adapters/*/adapter.mjs):');
    for (const a of adapters) console.log(`  ${a.name.padEnd(14)} ${a.describe || ''}`);
    console.log('\nCore (dùng chung, mọi plugin phụ thuộc — core/principles/ + core/skills/):');
    console.log(`  ${core.id.padEnd(14)} v${core.version} — ${core.name} (${core.stages.length} skill dùng chung)`);
    console.log('\nPlugin (auto-discovered từ plugins/*/.manifest.json):');
    for (const p of plugins) console.log(`  ${p.id.padEnd(14)} ${String(p.stages.length).padStart(2)} stage — ${p.name}`);
    if (!args.target) console.log('\nDùng: node cli/build.mjs --target <name|all> [--plugin id] [--out dir]');
    return;
  }

  const targets = args.target === 'all'
    ? adapters
    : adapters.filter((a) => a.name === args.target);

  if (targets.length === 0) {
    console.error(`[lỗi] Không tìm thấy adapter "${args.target}". Có: ${adapters.map((a) => a.name).join(', ')}`);
    process.exit(1);
  }

  for (const adapter of targets) {
    const outDir = args.out
      ? (targets.length > 1 ? path.join(args.out, adapter.name) : args.out)
      : path.join(DEFAULT_OUT, adapter.name);
    rmrf(outDir);
    ensureDir(outDir);
    const files = await adapter.build(plugins, { outDir, marketplace, core });
    const n = writeFiles(outDir, files);
    console.log(`[${adapter.name}] ${plugins.length} plugin, ${n} mục -> ${path.relative(REPO_ROOT, outDir) || '.'}`);
  }

  // Report "phần nào cài được qua wizard" (offered vs draft) — nguồn plugins/_published.json.
  const rep = writeWizardReport(args.out || DEFAULT_OUT);
  console.log(`[report] cài-qua-wizard: ${rep.model.offered.length} offered · ${rep.model.draft.length} draft -> ${path.relative(REPO_ROOT, rep.md)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
