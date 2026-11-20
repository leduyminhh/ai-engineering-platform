// aip mode guarded|confined|open|status — đổi chế độ quyền của project qua aip-gate.json + settings.json (tên cũ ask, full vẫn nhận làm bí danh).
// Hàm thuần dựng nội dung mới; runMode là lớp I/O mỏng. Zero-dependency.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildClaudePermissions, loadPolicy } from './permissions.mjs';
import { locateGate, gateTracked, lsFiles, trustedValue, lintGate, GATE_KEYS } from '../../core/hooks/scripts/gate-file.mjs';
import { modeName } from '../../core/hooks/scripts/gate-config.mjs';

const EMPTY_PERMISSIONS = JSON.stringify({ permissions: { deny: [], ask: [] } }, null, 2) + '\n';

// Ba câu định nghĩa dùng chung cho help, status, spec, docs và README (pin test so với hằng này).
export const MODE_DEFS = {
  guarded: 'Việc rủi ro thì hỏi người dùng.',
  confined: 'Không bao giờ hỏi: việc trong rào thì cho qua, ngoài rào thì từ chối.',
  open: 'Không hỏi, không rào: chỉ còn chặn ghi file cấu hình quyền và theo `writeScope`, `mcpDeny`.',
};

// Tên cũ vẫn nhận (bí danh); `bypass` chưa từng phát hành nên không phải bí danh.
export const MODE_ARGS = ['guarded', 'confined', 'open', 'ask', 'full'];
const LEGACY = { ask: 'guarded', full: 'confined' };
// Khoá rào của confined; ở open không có tác dụng.
const FENCE_KEYS = ['fullKeep', 'fullRoots', 'fullReadRoots', 'fullPaths'];

const stripBom = (s) => s.replace(/^﻿/, '');

// So byte với đúng định dạng `aip init --full` ghi; không gắn khóa đánh dấu vào settings.json.
const generated = (allowEnvFiles) =>
  JSON.stringify(buildClaudePermissions(loadPolicy(), { allowEnvFiles }), null, 2) + '\n';

// Hợp của hai biến thể allowEnvFiles để không sót quy tắc nào khi liệt kê phần còn lại.
function aipRules() {
  const set = new Set();
  for (const flag of [false, true]) {
    const { permissions } = buildClaudePermissions(loadPolicy(), { allowEnvFiles: flag });
    for (const r of [...permissions.deny, ...permissions.ask]) set.add(r);
  }
  return set;
}

function leftoverIn(settingsText) {
  let parsed;
  try { parsed = JSON.parse(stripBom(settingsText)); } catch { return []; }
  const p = parsed?.permissions;
  const rules = [...(Array.isArray(p?.deny) ? p.deny : []), ...(Array.isArray(p?.ask) ? p.ask : [])];
  const aip = aipRules();
  return [...new Set(rules.filter((r) => aip.has(r)))];
}

// Chuyển giữa ba mode chỉ đổi khoá `mode` (guarded bỏ khoá), giữ khoá khác. confined/open xử lý settings.json như `full` cũ: thay bản aip sinh bằng bản rỗng.
export function applyMode(mode, gate, settingsText, { allowEnvFiles }) {
  const name = modeName(mode);
  if (name === 'guarded') {
    const next = { ...(gate || {}) };
    delete next.mode;
    if (settingsText == null) return { gate: next, settingsText: null, settingsAction: 'absent' };
    if (stripBom(settingsText) === EMPTY_PERMISSIONS) {
      return { gate: next, settingsText: generated(allowEnvFiles), settingsAction: 'regenerated' };
    }
    return { gate: next, settingsText, settingsAction: 'kept' };
  }
  const next = { ...(gate || {}), mode: name };
  if (settingsText == null) return { gate: next, settingsText: null, settingsAction: 'absent', leftoverRules: [] };
  if (stripBom(settingsText) === EMPTY_PERMISSIONS) return { gate: next, settingsText, settingsAction: 'already-full', leftoverRules: [] };
  if (stripBom(settingsText) === generated(allowEnvFiles)) {
    return { gate: next, settingsText: EMPTY_PERMISSIONS, settingsAction: 'replaced', leftoverRules: [] };
  }
  return { gate: next, settingsText, settingsAction: 'kept-custom', leftoverRules: leftoverIn(settingsText) };
}

// `legacy` = tên cũ trong file (ask/full), `unrecognized` = giá trị khác ba tên và hai bí danh (chạy như guarded).
export function statusOf(gate, settingsText) {
  const raw = gate?.mode;
  const mode = modeName(raw);
  const extra = {
    ...(typeof raw === 'string' && Object.hasOwn(LEGACY, raw) ? { legacy: raw } : {}),
    ...(raw !== undefined && !MODE_ARGS.includes(raw) ? { unrecognized: true } : {}),
  };
  if (settingsText == null) return { mode, settings: 'absent', leftoverRules: [], ...extra };
  const text = stripBom(settingsText);
  if (text === EMPTY_PERMISSIONS) return { mode, settings: 'aip-full', leftoverRules: [], ...extra };
  if (text === generated(gate?.allowEnvFiles === true)) return { mode, settings: 'aip-ask', leftoverRules: [], ...extra };
  const leftoverRules = leftoverIn(text);
  return { mode, settings: leftoverRules.length ? 'custom-with-aip-rules' : 'custom', leftoverRules, ...extra };
}

function gitRoot(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || cwd;
  } catch { return cwd; }
}

/** Gốc project = toplevel git của cwd; ngoài repo dùng chính cwd, không thừa kế thư mục cha. */
export function modeRoot(cwd = process.cwd()) { return path.resolve(gitRoot(cwd)); }

// aip-gate.json cho lệnh CLI, cùng thứ tự đọc với hook. `bad` = đường dẫn file hỏng (lệnh phải dừng, không ghi).
// `ignored` = khoá nới quyền mà hook bỏ qua vì file bị git theo dõi hoặc không xác định; `copy` = phần được chép khi worktree tạo file
// riêng từ file repo chính, bỏ các khoá đó để file worktree chưa theo dõi không đưa lại hiệu lực cho chúng.
export function cliGate(root, { run } = {}) {
  const g = locateGate(root);
  const bad = g.source === 'worktree-invalid' ? g.file : g.mainInvalid;
  if (bad) return { g, bad };
  // Bỏ cache của gateTracked: trạng thái git có thể đổi giữa hai lần gọi trong cùng một tiến trình.
  let state;
  const tracked = (f) => (state === undefined ? (state = gateTracked(f, { run: run ?? ((dir, spec) => lsFiles(dir, spec)) })) : state);
  const config = g.config ?? {};
  const ignored = Object.keys(config).filter((k) => GATE_KEYS[k]?.trust === 'untracked' && trustedValue(g, k, { tracked }) === undefined);
  const copy = Object.fromEntries(Object.entries(config).filter(([k]) => !(g.source === 'main' && ignored.includes(k))));
  return { g, config: g.config, ignored, why: state === true ? 'đang được git theo dõi' : 'không xác định được trạng thái git', lint: lintGate(config), copy };
}

export function gateLines({ ignored, why, lint }) {
  return [
    ...(ignored.length ? [`Khoá bị bỏ qua (${why}): ${ignored.join(', ')}`] : []),
    ...(lint.unknown.length ? [`Khoá lạ: ${lint.unknown.map((k) => JSON.stringify(k)).join(', ')}`] : []),
    ...(lint.badType.length ? [`Khoá sai kiểu: ${lint.badType.map((k) => `${JSON.stringify(k)} (cần ${GATE_KEYS[k].type})`).join(', ')}`] : []),
  ];
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; e.message = `không đọc được ${file}: ${e.message}`; throw e; }
}

// Ghi xuyên symlink/junction (file hoặc thư mục chứa nó) có thể tạo hay đổi file ngoài project; kiểm hết trước khi ghi để không ghi dở.
export function assertNotLinked(files) {
  const linked = (p) => { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } };
  for (const f of files) {
    if (linked(f) || linked(path.dirname(f))) throw new Error(`${f} hoặc thư mục .claude là symlink/junction; aip không ghi xuyên link, sửa file ở đích thật hoặc bỏ link.`);
  }
}

function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

// Exit 0/1 là đáp án của git; mọi kết quả khác (không có git, ngoài repo, quá giờ) là null.
const gitExit = (dir, args) => {
  try { execFileSync('git', ['-C', dir, ...args], { timeout: 3000, stdio: 'ignore' }); return 0; } catch (e) { return e?.status ?? null; }
};

/** 'tracked' | 'ignored' | 'open' (chưa theo dõi, chưa ignore) | 'unknown'. */
export function gitStateOf(file, { run = (dir, spec) => lsFiles(dir, spec) } = {}) {
  // `run` là hàm bọc riêng nên gateTracked bỏ qua cache: trạng thái git có thể đổi giữa hai lần gọi trong một tiến trình.
  const tracked = gateTracked(file, { run });
  if (tracked === null) return 'unknown';
  if (tracked) return 'tracked';
  const ig = gitExit(path.dirname(path.dirname(file)), ['check-ignore', '-q', '--', '.claude/aip-gate.json']);
  return ig === 0 ? 'ignored' : ig === 1 ? 'open' : 'unknown';
}

const gitLabel = (mode) => ({
  tracked: `aip-gate.json được theo dõi bởi git ⇒ ${mode} bị bỏ qua`,
  ignored: 'aip-gate.json không theo dõi, đã gitignore',
  open: 'aip-gate.json không theo dõi, chưa gitignore',
  unknown: `không xác định (không có git, ngoài repo, hoặc đường dẫn là symlink chưa commit) ⇒ ${mode} bị bỏ qua`,
});

const dump = (obj) => JSON.stringify(obj, null, 2) + '\n';

const SETTINGS_LABEL = {
  'aip-ask': 'bản aip sinh (chế độ guarded)',
  'aip-full': 'bản aip sinh (không còn quy tắc, dùng cho confined/open)',
  'custom-with-aip-rules': 'đã sửa tay, còn quy tắc của aip',
  custom: 'đã sửa tay, không có quy tắc của aip',
  absent: 'không có file',
};

export function runMode(sub, { root, out = console.log, err = console.error, run }) {
  try { return runModeUnsafe(sub, { root, out, err, run }); } catch (e) { err(`Lỗi: ${e.message}`); return 1; }
}

function runModeUnsafe(sub, { root, out, err, run }) {
  const gateFile = path.join(root, '.claude', 'aip-gate.json');
  const settingsFile = path.join(root, '.claude', 'settings.json');

  const info = cliGate(root, { run });
  if (info.bad) { err(`Lỗi: ${info.bad} không phải đối tượng JSON hợp lệ; sửa tay trước khi chạy aip mode.`); return 1; }
  const found = info.g;
  const gate = info.config ? info.copy : null;
  const settingsText = readText(settingsFile);
  // allowEnvFiles bị bỏ qua thì settings sinh ra phải giữ quy tắc .env, như hook.
  const allowEnvFiles = !info.ignored.includes('allowEnvFiles') && info.config?.allowEnvFiles === true;

  if (sub === 'status') {
    const modeIgnored = info.ignored.includes('mode');
    const s = statusOf({ ...info.config, mode: modeIgnored ? undefined : info.config?.mode, allowEnvFiles }, settingsText);
    out(`Chế độ: ${s.mode}${info.config?.mode === undefined ? ' (mặc định, aip-gate.json không có khóa mode)' : modeIgnored ? ' (khoá mode bị bỏ qua, xem dòng "Khoá bị bỏ qua")' : ''}`);
    out(`Ý nghĩa: ${MODE_DEFS[s.mode]}`);
    out(`Nguồn: ${!found.file ? 'không có' : found.source === 'main' ? `${found.file} (repo chính; worktree này chưa có aip-gate.json)` : found.file}`);
    out(`settings.json: ${SETTINGS_LABEL[s.settings]}`);
    for (const r of s.leftoverRules) out(`  - ${r}`);
    out(`git: ${gitLabel('khoá mode')[gitStateOf(found.file ?? gateFile, run && { run })]}`);
    for (const l of gateLines(info)) out(l);
    if (s.legacy) out(`Gợi ý: file dùng tên cũ "${s.legacy}"; chạy aip mode ${LEGACY[s.legacy]} để ghi tên mới.`);
    if (s.unrecognized) out(`Giá trị mode ${JSON.stringify(info.config?.mode)} không nhận ra nên chạy như guarded; dùng guarded, confined hoặc open.`);
    if (s.mode === 'open' && FENCE_KEYS.some((k) => info.config && k in info.config)) out(`Ở open, ${FENCE_KEYS.join(', ')} không có tác dụng (file không bị xoá khoá).`);
    return 0;
  }

  const target = modeName(sub);
  const r = applyMode(target, gate, settingsText, { allowEnvFiles });
  if (target === 'guarded') {
    assertNotLinked([...(info.config ? [gateFile] : []), ...(r.settingsAction === 'regenerated' ? [settingsFile] : [])]);
    if (info.config) writeText(gateFile, dump(r.gate));
    if (r.settingsAction === 'regenerated') writeText(settingsFile, r.settingsText);
    out(`✓ mode=guarded tại ${root}`);
    if (found.source === 'main') out(`  ghi ${gateFile} (không có khóa mode): file này che file aip-gate.json của repo chính cho worktree này.`);
    if (r.settingsAction === 'regenerated') out('  settings.json: đã sinh lại policy chuẩn.');
    if (r.settingsAction === 'kept') out('  settings.json: giữ nguyên (không phải bản do aip sinh cho confined/open).');
    return 0;
  }

  assertNotLinked([gateFile, ...(r.settingsAction === 'replaced' ? [settingsFile] : [])]);
  writeText(gateFile, dump(r.gate));
  if (r.settingsAction === 'replaced') writeText(settingsFile, r.settingsText);
  out(`✓ mode=${target} tại ${root}`);
  const gs = gitStateOf(gateFile, run && { run });
  if (gs === 'tracked') {
    out(`  ⚠ aip-gate.json đang được git theo dõi nên ${target} bị bỏ qua (repo clone không tự cấp được ${target}). Gỡ theo dõi: mở file, xem lại từng khoá rồi mới git rm --cached .claude/aip-gate.json`);
  } else if (gs === 'open') {
    out(`  ⚠ aip-gate.json chưa được gitignore; nếu bị commit, ${target} sẽ bị bỏ qua. Thêm dòng này vào .gitignore: .claude/aip-gate.json (aip không tự sửa .gitignore).`);
  }
  if (r.settingsAction === 'replaced') out('  settings.json: đã thay bằng quy tắc rỗng (bản do aip sinh).');
  if (r.settingsAction === 'already-full') out('  settings.json: đã ở dạng không còn quy tắc, giữ nguyên.');
  if (found.source === 'main') out(`  ghi ${gateFile}: cấu hình lấy từ repo chính, file của worktree này che file của repo chính từ giờ.`);
  if (r.settingsAction === 'kept-custom') {
    out('  ⚠ settings.json đã sửa tay nên giữ nguyên; deny/ask vẫn chặn kể cả khi bypass.');
    if (r.leftoverRules.length) {
      out(`    Quy tắc của aip còn trong đó, tự gỡ nếu muốn ${target} thật sự:`);
      for (const x of r.leftoverRules) out(`      - ${x}`);
    }
  }
  if (target === 'open') {
    out('  ⚠ open: đọc/ghi mọi nơi, đọc file bí mật, push nhánh bảo vệ không còn hỏi hay bị chặn; chỉ còn chặn ghi file cấu hình quyền (kể cả `aip mode` do agent chạy), `writeScope` (chỉ công cụ file) và `mcpDeny`.');
    out('  ⚠ Agent trong phiên bypass vẫn có thể tự đổi mode bằng script do chính nó viết; hook không phải ranh giới chống agent bị chiếm quyền.');
    out('  ⚠ Đổi mode: người dùng tự chạy `aip mode`; quay lại hỏi bằng `aip mode guarded`.');
  } else {
    out('  ⚠ confined: việc ngoài rào bị từ chối chứ không hỏi; chỉ cho qua việc trong rào (root, fullRoots, fullReadRoots, fullPaths); push nhánh bảo vệ bị từ chối theo fullKeep.');
    out('  ⚠ Agent trong phiên bypass vẫn có thể tự đổi mode bằng script do chính nó viết; hook không phải ranh giới chống agent bị chiếm quyền.');
  }
  out(`  ⚠ ${target} chỉ có hiệu lực khi phiên chạy bằng --permission-mode bypassPermissions (hoặc đặt trong settings người dùng); project không tự bật được bypass.`);
  out('  ⚠ Lệnh xóa ở đường dẫn quan trọng vẫn có thể hỏi theo tài liệu Claude Code [Unverified].');
  out('  ⚠ Windows native không có sandbox: "trong project" chỉ theo cấu hình hook, không phải nhốt bằng hệ điều hành; muốn nhốt hãy dùng WSL2, VM hoặc container.');
  return 0;
}
