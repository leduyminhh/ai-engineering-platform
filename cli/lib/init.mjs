// aip init — scaffold file chỉ dẫn agent (AGENTS.md + CLAUDE.md) cho project bất kỳ, không cài skill.
// Zero-dependency.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './plugins.mjs';
import { importsAgentsMd } from './managed-block.mjs';
import { initDocFiles } from './templates.mjs';
import { buildClaudePermissions, loadPolicy } from './permissions.mjs';

const AGENTS_TEMPLATE = path.join(REPO_ROOT, 'core', 'agents', 'AGENTS.template.md');
const MINIMAL_DIR = path.join(REPO_ROOT, 'templates', 'init-minimal');
const FULL_DIR = path.join(REPO_ROOT, 'templates', 'init');

function listFiles(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(abs, base));
    else out.push(path.relative(base, abs).split(path.sep).join('/'));
  }
  return out.sort();
}

// Đọc trực tiếp vì thư mục đích có thể chưa là git repo; chỉ `true` đúng kiểu mới bật (khớp hook), mọi lỗi → tắt.
export function readAllowEnvFiles(root) {
  try {
    const raw = fs.readFileSync(path.join(root, '.claude', 'aip-gate.json'), 'utf8').replace(/^﻿/, '');
    return JSON.parse(raw)?.allowEnvFiles === true;
  } catch { return false; }
}

/**
 * Copy khung vào root, KHÔNG ghi đè file đã có (chạy lại an toàn).
 * @returns {{root:string, created:string[], skipped:string[], warnings:string[]}}
 */
export function init({ root, full = false }) {
  const srcDir = full ? FULL_DIR : MINIMAL_DIR;
  const plan = listFiles(srcDir).map((rel) => [rel, { from: path.join(srcDir, rel) }]);
  plan.push(['AGENTS.md', { from: AGENTS_TEMPLATE }]);
  if (full) {
    for (const f of initDocFiles()) plan.push([f.rel, { content: f.content }]);
    plan.push(['.claude/settings.json', { content: JSON.stringify(buildClaudePermissions(loadPolicy(), { allowEnvFiles: readAllowEnvFiles(root) }), null, 2) + '\n' }]);
  }
  const created = [], skipped = [], warnings = [];
  for (const [rel, src] of plan) {
    const dest = path.join(root, rel);
    if (fs.existsSync(dest)) { skipped.push(rel); continue; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (src.content != null) fs.writeFileSync(dest, src.content, 'utf8');
    else fs.copyFileSync(src.from, dest);
    created.push(rel);
  }
  const claudeMd = path.join(root, 'CLAUDE.md');
  if (skipped.includes('CLAUDE.md') && !importsAgentsMd(fs.readFileSync(claudeMd, 'utf8'))) {
    warnings.push('CLAUDE.md đã có nhưng chưa import AGENTS.md — thêm dòng `@AGENTS.md` ở đầu file để Claude Code nạp baseline.');
  }
  if (skipped.includes('.claude/settings.json')) {
    warnings.push('.claude/settings.json đã có nên giữ nguyên; chính sách chuẩn nằm ở core/permissions/policy.json (so sánh và tự thêm quy tắc nếu cần).');
  }
  return { root, created, skipped, warnings };
}
