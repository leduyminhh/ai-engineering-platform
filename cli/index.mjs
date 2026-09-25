#!/usr/bin/env node
// aip — AI Engineering Platform CLI.
//
//   aip                                  mở wizard (build/install/check/uninstall)
//   aip build  [--target all|<tool>] [--plugin <id>]
//   aip install   [--provider all|<p>] [--plugin all|<id>] [-g|--global]
//   aip check     [-g|--global]
//   aip uninstall [--provider all|<p>] [--plugin all|<id>] [-g|--global]
//   aip list                             liệt kê provider + plugin
//   aip --help
//
// Scope: mặc định project (thư mục hiện tại); -g/--global = toàn máy (~).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { install, uninstall, update, check, knownPluginIds } from './lib/install.mjs';
import { pack } from './lib/pack.mjs';
import { PROVIDERS } from './lib/paths.mjs';
import { runWizard } from './lib/wizard.mjs';
import { WizardUnavailable } from './lib/prompt.mjs';
import { parse } from './lib/args.mjs';

const CLI_DIR = path.dirname(fileURLToPath(import.meta.url));

function pkgVersion() {
  try { return JSON.parse(fs.readFileSync(path.join(CLI_DIR, '..', 'package.json'), 'utf8')).version; }
  catch { return '?'; }
}

function runBuild(extra = []) {
  execFileSync('node', [path.join(CLI_DIR, 'build.mjs'), ...extra], { stdio: 'inherit' });
}

function reportInstall(r) {
  console.log(`\n✓ Đã cài (scope=${r.scope}) tại: ${r.root}`);
  for (const x of r.results) {
    if (x.mode === 'plugin') {
      console.log(`  - ${x.provider} (plugin): ${x.plugins.join(', ')} (+core) → đăng ký marketplace "${x.marketplace}" qua "claude plugin"`);
      continue;
    }
    const mode = x.linked && x.copied ? `${x.linked} link + ${x.copied} copy`
      : x.linked ? `${x.linked} link`
      : `${x.copied} copy`;
    const skills = (x.skills && x.skills.length) ? ` + skills: ${x.skills.join(', ')}` : '';
    console.log(`  - ${x.provider}: ${x.plugins.join(', ')} (+core)${skills} → ${mode}`);
    for (const p of (x.pulled || [])) console.log(`    · ${p.from} kéo theo: ${p.added.join(', ')}`);
  }
  if (r.results.some((x) => x.mode === 'plugin')) {
    console.log(`  ⚠ Claude (plugin): mở/khởi động lại Claude Code rồi chạy /reload-plugins để nạp skills vừa cài.`);
  }
  if (r.coworkPack) reportPack(r.coworkPack);
  console.log(`  Manifest: .ai-engineering/manifest.json (dùng "aip check"/"aip uninstall").`);
}

function reportUpdate(r) {
  console.log(`\naip update (scope=${r.scope}) tại: ${r.root}`);
  if (r.pulled.skipped) console.log('  1) git pull: (bỏ qua)');
  else if (r.pulled.ok) console.log(`  1) git pull: ✓ ${(r.pulled.out || '').split('\n').filter(Boolean).slice(-1)[0] || ''}`.trimEnd());
  else console.log(`  1) git pull: ⚠ bỏ qua — ${r.pulled.reason} (dùng nguồn hiện tại)`);
  if (r.empty) { console.log('  Chưa cài plugin nào ở scope này — không có gì để update.'); return; }
  if (r.noMatch) { console.log('  Không có entry nào khớp bộ lọc (--provider/--plugin/--skill) — không update gì.'); return; }
  console.log(`  2) build lại: ${r.built.join(', ')}`);
  console.log('  3) cập nhật plugin đã cài:');
  let reload = false;
  for (const e of r.entries) {
    const label = e.action === 'reinstall' ? 'đã cài lại (tái quét build — nhận cả skill mới)'
      : e.action === 'plugin-refresh' ? 'plugin → refresh (cần /reload-plugins)'
      : e.action === 'plugin-error' ? `plugin → lỗi: ${e.reason}`
      : e.action;
    if (e.reload) reload = true;
    console.log(`     - ${e.provider.padEnd(10)} ${e.plugins.join(',').padEnd(24)} ${label}`);
  }
  if (reload) console.log('  ⚠ Claude (plugin): khởi động lại Claude Code + /reload-plugins.');
  console.log('  Xong. Mở lại session Claude Code để nạp skill mới nhất.');
}

function reportPack(r) {
  console.log(`  Cowork: đã đóng gói ${r.packed.length} skill .zip tại ${r.outDir}`);
  console.log(`    → upload từng .zip vào Cowork qua Customize → Skills.`);
  if (r.missing.length) console.log(`    ⚠ thiếu (chưa build?): ${r.missing.join(', ')}`);
}
function reportCheck(r) {
  console.log(`\nĐã cài ở scope=${r.scope} (${r.root}):`);
  if (!r.installs.length) { console.log('  (trống)'); return; }
  for (const e of r.installs) {
    if (e.mode === 'plugin') { // do Claude quản lý (cache + settings.json) — không soi file, không bịa present/files
      console.log(`  - ${e.provider.padEnd(12)} ${e.plugins.join(',').padEnd(28)} (plugin do Claude quản lý — xác thực: "claude plugin list")`);
      continue;
    }
    const warn = e.present < e.files ? `  ⚠ thiếu ${e.files - e.present}/${e.files} file` : '';
    const skills = (e.skills && e.skills.length) ? `  + skills: ${e.skills.join(', ')}` : '';
    console.log(`  - ${e.provider.padEnd(12)} ${e.plugins.join(',').padEnd(28)} ${e.present}/${e.files} file${warn}${skills}`);
  }
}

async function wizardFlow(action) {
  let sel;
  try { sel = await runWizard(action); }
  catch (e) {
    if (e instanceof WizardUnavailable) {
      console.error('Wizard cần terminal tương tác. Dùng cờ trực tiếp, vd:\n  aip install --provider claude --plugin backend');
      process.exit(1);
    }
    throw e;
  }
  if (!sel) { console.log('Đã huỷ.'); return; }
  if (sel.action === 'build') return runBuild(['--target', 'all']);
  if (sel.action === 'install') return reportInstall(install(sel));
  if (sel.action === 'update') return reportUpdate(update(sel));
  if (sel.action === 'uninstall') {
    // Copy-mode (theo skill) và plugin-mode (theo provider+plugin) gỡ bằng hai lời gọi riêng để
    // bộ lọc mỗi loại được scope đúng, không lẫn sang entry khác.
    let removed = 0, root = sel.root;
    if ((sel.skills || []).length && (sel.providers || []).length) {
      const r = uninstall({ providers: sel.providers, skills: sel.skills, scope: sel.scope });
      removed += r.removed; root = r.root;
    }
    for (const pm of (sel.pluginModeRemovals || [])) {
      const r = uninstall({ providers: [pm.provider], plugins: pm.plugins, scope: sel.scope });
      removed += r.removed; root = r.root;
    }
    console.log(`\n✓ Đã gỡ ${removed} file (scope=${sel.scope}) tại ${root}.`);
  }
}

function buildHelp() {
  let plugins;
  try { plugins = knownPluginIds(); } catch { plugins = []; }
  return `aip v${pkgVersion()} — AI Engineering Platform
Build & cài workflow cho nhiều công cụ AI từ một nguồn trung tính.

CÁCH DÙNG
  aip                    mở wizard tương tác (không cần nhớ cờ)
  aip <lệnh> [tùy chọn]

  Mẹo: chạy lệnh KHÔNG cờ để vào wizard chọn bằng phím (Space chọn, ↑/↓, Enter, b quay lại, q huỷ).

LỆNH
  install                   cài workflow (không cờ → wizard step-by-step; có --provider/--plugin → non-interactive)
                            (symlink tới build/, tự cập nhật khi rebuild; tự copy nếu
                            môi trường/npm không hỗ trợ link)
  uninstall  (alias remove) gỡ workflow đã cài (không cờ → wizard chọn từ manifest)
  update                    cập nhật plugin đã cài: git pull → build → symlink giữ nguyên / copy cài lại
                            (lọc được bằng --provider/--plugin/--skill; bỏ trống = mọi entry)
  check                     liệt kê đã cài gì ở scope hiện tại
  build                     chỉ build ra build/<tool>/ (không cài)
  pack                      đóng gói skill Cowork ra build/cowork/<skill>.zip (theo plugins/_cowork.json);
                            upload từng .zip vào Cowork qua Customize → Skills (tự chạy kèm khi install claude)
  list                      liệt kê adapter + plugin tìm được
  help                      hiện trợ giúp này (hoặc -h, --help)

TÙY CHỌN
  --provider <p|all>        công cụ đích: ${PROVIDERS.join(', ')}, hoặc all (mặc định all)
  --plugin <id|all>         plugin cần cài/build: ${plugins.length ? plugins.join(', ') : '<id>'}, hoặc all (mặc định all)
                            — 'core' (nguyên tắc nền tảng) LUÔN tự đi kèm
  --skill <a,b>             (install/uninstall/update) chọn skill LẺ dạng 'plugin/skill' hoặc tên
                            skill; nhiều skill ngăn bằng dấu phẩy. Khác --plugin (cả plugin).
                            update: lọc theo mức ENTRY — skill khớp làm tươi cả entry chứa nó.
  --as-plugin               (chỉ 'install', riêng claude) cài như PLUGIN THẬT qua "claude plugin"
                            (đăng ký marketplace + namespaced <id>:<skill>) thay vì copy skills phẳng
                            vào .claude/skills/. Cần có CLI "claude" trên PATH. provider khác giữ skills.
  --target <tool|all>       (chỉ cho 'build') adapter cần build
  -g, --global              scope = toàn máy (~); KHÔNG cờ này = project (thư mục hiện tại)
  -h, --help                hiện trợ giúp

SCOPE
  project (mặc định)        cài vào thư mục hiện tại — chỉ dự án này
  global  (-g)              cài vào home (~) — dùng cho mọi dự án

VÍ DỤ
  aip                                    # wizard
  aip install                            # mọi provider + mọi plugin -> project
  aip install --provider claude --plugin backend
  aip install --provider claude --skill backend/backend-init,core/git-workflow
  aip uninstall --skill backend/backend-testing
  aip install --provider claude --as-plugin        # cài claude như PLUGIN qua "claude plugin"
  aip install --provider cursor -g       # cài global cho mọi project
  aip check                              # xem đã cài gì (project)
  aip check -g                           # xem đã cài gì (global)
  aip uninstall --provider claude        # gỡ claude khỏi project
  aip uninstall                          # gỡ tất cả ở scope hiện tại
  aip update                             # pull + build + cập nhật MỌI plugin đã cài (project)
  aip update --provider cursor           # chỉ cập nhật entry của cursor
  aip update --plugin backend            # chỉ cập nhật entry chứa plugin backend
  aip update -g                          # tương tự cho scope global
  aip build --target all                 # chỉ build
  aip pack                               # đóng gói skill Cowork ra build/cowork/*.zip

CLAUDE — CÀI QUA MARKETPLACE (thay cho 'aip install')
  Claude Code còn có thể cài plugin qua marketplace, 3 cách:
    1) /plugin                               panel UI: Marketplaces -> add, Discover -> install
    2) /plugin marketplace add <repo|path>   rồi  /plugin install <plugin>@aip
    3) settings.json: khai báo "extraKnownMarketplaces" + "enabledPlugins" (commit qua git)

Manifest '.ai-engineering/manifest.json' (ghi ở gốc scope) cho phép check/uninstall chính xác.`;
}

async function main() {
  const args = parse(process.argv.slice(2));
  const cmd = args._[0];

  if (args.help || cmd === 'help') { console.log(buildHelp()); return; }

  // không có lệnh -> wizard
  if (!cmd) return wizardFlow(undefined);

  const WIZARDABLE = { install: 'install', uninstall: 'uninstall', remove: 'uninstall' };
  if (WIZARDABLE[cmd] && !args.explicit) return wizardFlow(WIZARDABLE[cmd]);

  switch (cmd) {
    case 'build':
      return runBuild(['--target', args.target, ...(args.plugin !== 'all' ? ['--plugin', args.plugin] : [])]);
    case 'list':
      return runBuild(['--list']);
    case 'install': {
      // --skill KHÔNG kèm --plugin: để skill điều hướng lựa chọn, tránh 'all' lan ra mọi plugin.
      const plugins = (args.skill.length && !args.pluginExplicit) ? [] : args.plugin;
      return reportInstall(install({ providers: args.provider, plugins, skills: args.skill, scope: args.scope, mode: args.mode }));
    }
    case 'remove':
    case 'uninstall': {
      const r = uninstall({ providers: args.provider, plugins: args.plugin, skills: args.skill, scope: args.scope });
      console.log(`✓ Đã gỡ ${r.removed} file (scope=${r.scope}) tại ${r.root}.`);
      return;
    }
    case 'update':
      return reportUpdate(update({ scope: args.scope, providers: args.provider, plugins: args.plugin, skills: args.skill }));
    case 'check':
      return reportCheck(check({ scope: args.scope }));
    case 'pack': {
      console.log('Đóng gói skill cho Cowork…');
      return reportPack(pack());
    }
    default:
      console.error(`Lệnh không rõ: "${cmd}".\n`);
      console.log(buildHelp());
      process.exit(1);
  }
}

main().catch((err) => { console.error('Lỗi:', err.message); process.exit(1); });
