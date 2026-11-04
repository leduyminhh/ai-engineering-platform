// aip init — scaffold file chỉ dẫn agent (AGENTS.md + CLAUDE.md) cho project bất kỳ, không cài skill.
// Zero-dependency.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './plugins.mjs';
import { BEGIN, END, importsAgentsMd, mergeManagedBlock, removeManagedBlock, extractBaselineBlock } from './managed-block.mjs';
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

const isLink = (p) => { try { fs.readlinkSync(p); return true; } catch { return false; } };
const eolOf = (text) => (text.includes('\r\n') ? '\r\n' : '\n');
const norm = (text) => text.replace(/\r\n/g, '\n');

/** Kế hoạch cho AGENTS.md + CLAUDE.md có sẵn, tính hết trước khi ghi: marker hỏng ở AGENTS.md ném tại đây. */
function planInstructionFiles(root) {
  const template = fs.readFileSync(AGENTS_TEMPLATE, 'utf8');
  const block = extractBaselineBlock(template);
  const plan = new Map(), warnings = [];
  const agentsAbs = path.join(root, 'AGENTS.md');
  const agentsLink = isLink(agentsAbs);
  if (agentsLink) {
    plan.set('AGENTS.md', { state: 'skipped' });
    warnings.push('AGENTS.md là symlink/junction — bỏ qua, không làm mới khối baseline (ghi sẽ xuyên vào file đích).');
  } else if (!fs.existsSync(agentsAbs)) {
    plan.set('AGENTS.md', { state: 'created', content: template });
  } else {
    const existing = fs.readFileSync(agentsAbs, 'utf8');
    const s = existing.indexOf(BEGIN), e = existing.indexOf(END);
    if (existing.trim() === '') plan.set('AGENTS.md', { state: 'refreshed', content: template });
    else if (s !== -1 && e > s && norm(existing.slice(s, e + END.length)) === norm(block)) plan.set('AGENTS.md', { state: 'unchanged' });
    else {
      const eol = eolOf(existing);
      plan.set('AGENTS.md', { state: 'refreshed', content: mergeManagedBlock(existing, eol === '\n' ? block : block.replace(/\n/g, eol), 'AGENTS.md') });
    }
  }

  const claudeAbs = path.join(root, 'CLAUDE.md');
  if (isLink(claudeAbs)) {
    plan.set('CLAUDE.md', { state: 'skipped' });
    warnings.push('CLAUDE.md là symlink/junction — bỏ qua, không thêm @AGENTS.md.');
  } else if (fs.existsSync(claudeAbs)) {
    const text = fs.readFileSync(claudeAbs, 'utf8');
    let next = text;
    const s = text.indexOf(BEGIN), e = text.indexOf(END);
    if (s !== -1 || e !== -1) {
      if (s !== -1 && e > s) next = removeManagedBlock(next);
      else warnings.push('CLAUDE.md có marker khối baseline hỏng — giữ nguyên phần đó; sửa tay để không nạp baseline hai lần.');
    }
    if (!importsAgentsMd(next)) {
      const bom = next.charCodeAt(0) === 0xfeff ? next[0] : '';
      const eol = eolOf(next);
      next = `${bom}@AGENTS.md${eol}${eol}${next.slice(bom.length)}`;
    }
    if (next === text) plan.set('CLAUDE.md', { state: 'unchanged' });
    else if (agentsLink) {
      plan.set('CLAUDE.md', { state: 'skipped' });
      warnings.push('CLAUDE.md giữ nguyên: AGENTS.md là symlink/junction nên không chuyển khối baseline hay thêm @AGENTS.md.');
    } else plan.set('CLAUDE.md', { state: 'refreshed', content: next });
  }
  return { plan, warnings };
}

/**
 * AGENTS.md: tạo từ template hoặc làm mới vùng giữa marker; CLAUDE.md có sẵn: bảo đảm import @AGENTS.md, không chứa khối.
 * File khác của khung KHÔNG ghi đè (chạy lại an toàn).
 * @returns {{root:string, created:string[], refreshed:string[], unchanged:string[], skipped:string[], warnings:string[]}}
 */
export function init({ root, full = false }) {
  const srcDir = full ? FULL_DIR : MINIMAL_DIR;
  const { plan: own, warnings } = planInstructionFiles(root);
  const plan = listFiles(srcDir).filter((rel) => !own.has(rel)).map((rel) => [rel, { from: path.join(srcDir, rel) }]);
  if (full) {
    for (const f of initDocFiles()) plan.push([f.rel, { content: f.content }]);
    plan.push(['.claude/settings.json', { content: JSON.stringify(buildClaudePermissions(loadPolicy(), { allowEnvFiles: readAllowEnvFiles(root) }), null, 2) + '\n' }]);
  }
  const out = { created: [], refreshed: [], unchanged: [], skipped: [] };
  for (const [rel, { state, content }] of own) {
    if (content != null) fs.writeFileSync(path.join(root, rel), content, 'utf8');
    out[state].push(rel);
  }
  for (const [rel, src] of plan) {
    const dest = path.join(root, rel);
    if (fs.existsSync(dest)) { out.skipped.push(rel); continue; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (src.content != null) fs.writeFileSync(dest, src.content, 'utf8');
    else fs.copyFileSync(src.from, dest);
    out.created.push(rel);
  }
  if (out.skipped.includes('.claude/settings.json')) {
    warnings.push('.claude/settings.json đã có nên giữ nguyên; chính sách chuẩn nằm ở core/permissions/policy.json (so sánh và tự thêm quy tắc nếu cần).');
  }
  return { root, ...out, warnings };
}
