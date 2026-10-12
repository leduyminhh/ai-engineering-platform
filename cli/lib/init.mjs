// aip init — scaffold file chỉ dẫn agent (AGENTS.md + CLAUDE.md) cho project bất kỳ, không cài skill.
// Zero-dependency.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './plugins.mjs';
import { importsAgentsMd } from './managed-block.mjs';

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

/**
 * Copy khung vào root, KHÔNG ghi đè file đã có (chạy lại an toàn).
 * @returns {{root:string, created:string[], skipped:string[], warnings:string[]}}
 */
export function init({ root, full = false }) {
  const srcDir = full ? FULL_DIR : MINIMAL_DIR;
  const plan = listFiles(srcDir).map((rel) => [rel, path.join(srcDir, rel)]);
  plan.push(['AGENTS.md', AGENTS_TEMPLATE]);
  const created = [], skipped = [], warnings = [];
  for (const [rel, src] of plan) {
    const dest = path.join(root, rel);
    if (fs.existsSync(dest)) { skipped.push(rel); continue; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    created.push(rel);
  }
  const claudeMd = path.join(root, 'CLAUDE.md');
  if (skipped.includes('CLAUDE.md') && !importsAgentsMd(fs.readFileSync(claudeMd, 'utf8'))) {
    warnings.push('CLAUDE.md đã có nhưng chưa import AGENTS.md — thêm dòng `@AGENTS.md` ở đầu file để Claude Code nạp baseline.');
  }
  return { root, created, skipped, warnings };
}
