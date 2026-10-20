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
export function readGateConfig(dir) {
  let d = path.resolve(dir || '.');
  while (!existsSync(d) && path.dirname(d) !== d) d = path.dirname(d);
  let top;
  try { top = git(d, ['rev-parse', '--show-toplevel']); } catch { return null; }
  const cfg = readJson(top);
  if (cfg) return cfg;
  try { return readJson(path.dirname(git(d, ['rev-parse', '--path-format=absolute', '--git-common-dir']))); } catch { return null; }
}

export function envFilesAllowed(dir) {
  return readGateConfig(dir)?.allowEnvFiles === true;
}
