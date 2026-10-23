// aip mode full|ask|status — bật/tắt chế độ quyền `full` của project qua aip-gate.json + settings.json.
// Hàm thuần dựng nội dung mới; runMode là lớp I/O mỏng. Zero-dependency.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildClaudePermissions, loadPolicy } from './permissions.mjs';
import { resolveGate, gateTracked } from '../../core/hooks/scripts/gate-config.mjs';

const EMPTY_PERMISSIONS = JSON.stringify({ permissions: { deny: [], ask: [] } }, null, 2) + '\n';

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

export function applyFull(gate, settingsText, { allowEnvFiles }) {
  const next = { ...(gate || {}), mode: 'full' };
  if (settingsText == null) return { gate: next, settingsText: null, settingsAction: 'absent', leftoverRules: [] };
  if (stripBom(settingsText) === EMPTY_PERMISSIONS) return { gate: next, settingsText, settingsAction: 'already-full', leftoverRules: [] };
  if (stripBom(settingsText) === generated(allowEnvFiles)) {
    return { gate: next, settingsText: EMPTY_PERMISSIONS, settingsAction: 'replaced', leftoverRules: [] };
  }
  return { gate: next, settingsText, settingsAction: 'kept-custom', leftoverRules: leftoverIn(settingsText) };
}

export function applyAsk(gate, settingsText, { allowEnvFiles }) {
  const next = { ...(gate || {}) };
  delete next.mode;
  if (settingsText == null) return { gate: next, settingsText: null, settingsAction: 'absent' };
  if (stripBom(settingsText) === EMPTY_PERMISSIONS) {
    return { gate: next, settingsText: generated(allowEnvFiles), settingsAction: 'regenerated' };
  }
  return { gate: next, settingsText, settingsAction: 'kept' };
}

export function statusOf(gate, settingsText) {
  const mode = gate?.mode === 'full' ? 'full' : 'ask';
  if (settingsText == null) return { mode, settings: 'absent', leftoverRules: [] };
  const text = stripBom(settingsText);
  if (text === EMPTY_PERMISSIONS) return { mode, settings: 'aip-full', leftoverRules: [] };
  if (text === generated(gate?.allowEnvFiles === true)) return { mode, settings: 'aip-ask', leftoverRules: [] };
  const leftoverRules = leftoverIn(text);
  return { mode, settings: leftoverRules.length ? 'custom-with-aip-rules' : 'custom', leftoverRules };
}

function gitRoot(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || cwd;
  } catch { return cwd; }
}

/** Gốc project = toplevel git của cwd; ngoài repo dùng chính cwd, không thừa kế thư mục cha. */
export function modeRoot(cwd = process.cwd()) { return path.resolve(gitRoot(cwd)); }

// Cùng thứ tự với hook (readGate): file của worktree trước, thiếu thì lấy file của repo chính.
function locateGate(root) {
  const own = path.join(root, '.claude', 'aip-gate.json');
  const ownRaw = readText(own);
  if (ownRaw != null) return { file: own, raw: ownRaw, source: 'own' };
  const main = resolveGate(root)?.main;
  if (main && path.resolve(main).toLowerCase() !== path.resolve(root).toLowerCase()) {
    const file = path.join(main, '.claude', 'aip-gate.json');
    const raw = readText(file);
    if (raw != null) return { file, raw, source: 'main' };
  }
  return { file: own, raw: null, source: null };
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
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
export function gitStateOf(file) {
  // Truyền `run` riêng để bỏ qua cache của gateTracked: trạng thái git có thể đổi giữa hai lần gọi trong một tiến trình.
  const tracked = gateTracked(file, { run: (dir) => gitExit(dir, ['ls-files', '--error-unmatch', '--', '.claude/aip-gate.json']) });
  if (tracked === null) return 'unknown';
  if (tracked) return 'tracked';
  const ig = gitExit(path.dirname(path.dirname(file)), ['check-ignore', '-q', '--', '.claude/aip-gate.json']);
  return ig === 0 ? 'ignored' : ig === 1 ? 'open' : 'unknown';
}

const GIT_LABEL = {
  tracked: 'aip-gate.json được theo dõi bởi git ⇒ full bị bỏ qua',
  ignored: 'aip-gate.json không theo dõi, đã gitignore',
  open: 'aip-gate.json không theo dõi, chưa gitignore',
  unknown: 'không xác định (không có git hoặc ngoài repo)',
};

const dump = (obj) => JSON.stringify(obj, null, 2) + '\n';

const SETTINGS_LABEL = {
  'aip-ask': 'bản aip sinh (chế độ ask)',
  'aip-full': 'bản aip sinh (chế độ full, không còn quy tắc)',
  'custom-with-aip-rules': 'đã sửa tay, còn quy tắc của aip',
  custom: 'đã sửa tay, không có quy tắc của aip',
  absent: 'không có file',
};

export function runMode(sub, { root, out = console.log }) {
  const gateFile = path.join(root, '.claude', 'aip-gate.json');
  const settingsFile = path.join(root, '.claude', 'settings.json');

  let gate = null;
  const found = locateGate(root);
  const gateRaw = found.raw;
  if (gateRaw != null) {
    try { gate = JSON.parse(stripBom(gateRaw)); } catch (e) { out(`Lỗi: ${found.file} không phải JSON hợp lệ (${e.message}).`); return 1; }
    if (gate === null || typeof gate !== 'object' || Array.isArray(gate)) { out(`Lỗi: ${found.file} phải là một đối tượng JSON.`); return 1; }
  }
  const settingsText = readText(settingsFile);
  const allowEnvFiles = gate?.allowEnvFiles === true;

  if (sub === 'status') {
    const s = statusOf(gate, settingsText);
    out(`Chế độ: ${s.mode}${gate?.mode === undefined ? ' (mặc định, aip-gate.json không có khóa mode)' : ''}`);
    out(`Nguồn: ${gateRaw == null ? 'không có' : found.source === 'main' ? `${found.file} (repo chính; worktree này chưa có aip-gate.json)` : found.file}`);
    out(`settings.json: ${SETTINGS_LABEL[s.settings]}`);
    for (const r of s.leftoverRules) out(`  - ${r}`);
    out(`git: ${GIT_LABEL[gitStateOf(found.file)]}`);
    return 0;
  }

  if (sub === 'full') {
    const r = applyFull(gate, settingsText, { allowEnvFiles });
    writeText(gateFile, dump(r.gate));
    if (r.settingsAction === 'replaced') writeText(settingsFile, r.settingsText);
    out(`✓ mode=full tại ${root}`);
    const gs = gitStateOf(gateFile);
    if (gs === 'tracked') {
      out('  ⚠ aip-gate.json đang được git theo dõi nên full bị bỏ qua (repo clone không tự cấp được full). Gỡ theo dõi: git rm --cached .claude/aip-gate.json');
    } else if (gs === 'open') {
      out('  ⚠ aip-gate.json chưa được gitignore; nếu bị commit, full sẽ bị bỏ qua. Thêm dòng này vào .gitignore: .claude/aip-gate.json (aip không tự sửa .gitignore).');
    }
    if (r.settingsAction === 'replaced') out('  settings.json: đã thay bằng quy tắc rỗng (bản do aip sinh).');
    if (r.settingsAction === 'already-full') out('  settings.json: đã ở dạng full (quy tắc rỗng), giữ nguyên.');
    if (found.source === 'main') out(`  ghi ${gateFile}: cấu hình lấy từ repo chính, file của worktree này che file của repo chính từ giờ.`);
    if (r.settingsAction === 'kept-custom') {
      out('  ⚠ settings.json đã sửa tay nên giữ nguyên; deny/ask vẫn chặn kể cả khi bypass.');
      if (r.leftoverRules.length) {
        out('    Quy tắc của aip còn trong đó, tự gỡ nếu muốn full thật sự:');
        for (const x of r.leftoverRules) out(`      - ${x}`);
      }
    }
    out('  ⚠ full chỉ có hiệu lực khi phiên chạy bằng --permission-mode bypassPermissions (hoặc đặt trong settings người dùng); project không tự bật được bypass.');
    out('  ⚠ Lệnh xóa ở đường dẫn quan trọng vẫn có thể hỏi theo tài liệu Claude Code [Unverified].');
    out('  ⚠ Windows native không có sandbox: "trong project" chỉ theo cấu hình hook, không phải nhốt bằng hệ điều hành; muốn nhốt hãy dùng WSL2, VM hoặc container.');
    return 0;
  }

  const r = applyAsk(gate, settingsText, { allowEnvFiles });
  if (gateRaw != null) writeText(gateFile, dump(r.gate));
  if (r.settingsAction === 'regenerated') writeText(settingsFile, r.settingsText);
  out(`✓ mode=ask tại ${root}`);
  if (found.source === 'main') out(`  ghi ${gateFile} (không có khóa mode): file này che file aip-gate.json của repo chính cho worktree này.`);
  if (r.settingsAction === 'regenerated') out('  settings.json: đã sinh lại policy chuẩn.');
  if (r.settingsAction === 'kept') out('  settings.json: giữ nguyên (không phải bản full do aip sinh).');
  return 0;
}
