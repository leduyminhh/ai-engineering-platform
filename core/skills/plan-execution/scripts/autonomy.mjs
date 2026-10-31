#!/usr/bin/env node
// In JSON khoá `autonomy` hiệu lực của <git-root>/.claude/aip-gate.json cho skill plan-execution.
// Cách dùng: node autonomy.mjs → {"mergeLocal":…,"cleanup":…,"partRunner":…}; import: readAutonomy(cwd, deps?).
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì (không import hook của core).
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const DEFAULTS = Object.freeze({ mergeLocal: false, cleanup: false, partRunner: 'session' });
const RUNNERS = new Set(['subagent', 'session', 'sequential']);

const defaultGit = (args, cwd) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// null = không có file; {} = có file nhưng hỏng (vẫn che repo chính như hook gate-config); còn lại = nội dung.
function readGateAt(root) {
  let raw;
  try { raw = readFileSync(path.join(root, '.claude', 'aip-gate.json'), 'utf8'); } catch (e) { return e?.code === 'ENOENT' ? null : {}; }
  try { const v = JSON.parse(raw.replace(/^﻿/, '')); return isObj(v) ? v : {}; } catch { return {}; }
}

export function readAutonomy(cwd = process.cwd(), deps = {}) {
  const git = deps.git ?? defaultGit;
  let top = cwd;
  let main = null;
  try {
    top = git(['rev-parse', '--show-toplevel'], cwd);
    main = path.dirname(git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd));
  } catch { /* không phải repo hoặc không có git: chỉ đọc cwd */ }
  const gate = readGateAt(top) ?? (main ? readGateAt(main) : null) ?? {};
  const a = isObj(gate.autonomy) ? gate.autonomy : {};
  return {
    mergeLocal: typeof a.mergeLocal === 'boolean' ? a.mergeLocal : DEFAULTS.mergeLocal,
    cleanup: typeof a.cleanup === 'boolean' ? a.cleanup : DEFAULTS.cleanup,
    partRunner: RUNNERS.has(a.partRunner) ? a.partRunner : DEFAULTS.partRunner,
  };
}

const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) console.log(JSON.stringify(readAutonomy()));
