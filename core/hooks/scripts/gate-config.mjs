// Đọc <git-root>/.claude/aip-gate.json cho các hook của core; không phải hook, chỉ được import.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

function git(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function readJson(root) {
  try { return JSON.parse(readFileSync(path.join(root, '.claude', 'aip-gate.json'), 'utf8').replace(/^﻿/, '')); } catch { return null; }
}

// Gốc worktree trước rồi tới gốc repo chính: worktree con tạo trước khi commit file cấu hình vẫn theo project.
// Thư mục có thể chưa tồn tại (Write tạo mới) nên đi lên thư mục cha gần nhất đã có.
// `roots` gồm gốc worktree và gốc repo chính (loại trùng) để hook `full` biết file đích thuộc project nào.
export function readGate(dir) {
  let d = path.resolve(dir || '.');
  while (!existsSync(d) && path.dirname(d) !== d) d = path.dirname(d);
  let top;
  try { top = git(d, ['rev-parse', '--show-toplevel']); } catch { return null; }
  let main = null;
  try { main = path.dirname(git(d, ['rev-parse', '--path-format=absolute', '--git-common-dir'])); } catch { /* chỉ còn gốc worktree */ }
  const roots = [...new Set([top, main].filter(Boolean).map((r) => path.resolve(r)))];
  const config = readJson(top) ?? (main ? readJson(main) : null);
  return config ? { config, roots } : null;
}

export function readGateConfig(dir) {
  return readGate(dir)?.config ?? null;
}

// `full` chỉ hiệu lực khi cả cấu hình lẫn phiên đều đồng ý: bypassPermissions do người dùng bật, không do repo tự quyết.
export function effectiveMode(config, input) {
  return config && typeof config === 'object' && config.mode === 'full'
    && input && typeof input === 'object' && input.permission_mode === 'bypassPermissions' ? 'full' : 'ask';
}

export function fullKeep(config) {
  const v = config?.fullKeep;
  if (!Array.isArray(v)) return ['push'];
  return v.filter((x) => x === 'push');
}

export function fullRoots(config) {
  const v = config?.fullRoots;
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string' && path.isAbsolute(x)).map((x) => path.resolve(x));
}

export function envFilesAllowed(dir) {
  return readGateConfig(dir)?.allowEnvFiles === true;
}
