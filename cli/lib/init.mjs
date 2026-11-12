// aip init — scaffold file chỉ dẫn agent (AGENTS.md + CLAUDE.md) cho project bất kỳ, không cài skill.
// Zero-dependency.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './plugins.mjs';
import { BEGIN, END, importsAgentsMd, mergeManagedBlock, removeManagedBlock, extractBaselineBlock } from './managed-block.mjs';
import { initDocFiles } from './templates.mjs';
import { buildClaudePermissions, loadPolicy } from './permissions.mjs';
import { locateGate, readGateAt, trustedValue, gateTracked, lsFiles } from '../../core/hooks/scripts/gate-file.mjs';

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

// So gốc bằng đường dẫn thật: git trả `top` đã qua realpath, còn root có thể là symlink/junction hoặc khác hoa/thường ổ đĩa (win32).
// realpath lỗi thì so chuỗi như trước.
const sameDir = (a, b) => {
  const real = (p) => { try { return fs.realpathSync.native(p); } catch { return path.resolve(p); } };
  const [x, y] = [real(a), real(b)];
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
};

// Chỉ `true` đúng kiểu và đáng tin (file không bị git theo dõi, hoặc thư mục ngoài repo git) mới bỏ quy tắc .env, khớp hook.
// File hỏng thì ném trước mọi lần ghi (im lặng coi là false sẽ sinh settings.json theo cấu hình chưa sửa); tracked mặc định bỏ cache vì trạng thái git đổi được trong một tiến trình.
export function readAllowEnvFiles(root, { tracked = (f) => gateTracked(f, { run: (dir, spec) => lsFiles(dir, spec) }) } = {}) {
  const g = locateGate(root);
  // Thư mục con của repo tự có file riêng (hoặc không có): không thừa kế file của gốc git, như trước khi gom về locateGate.
  if (g.inRepo && !g.gitUnknown && !sameDir(root, g.top)) {
    const own = readGateAt(root);
    if (own?.invalid) throw new Error(`${path.join(root, '.claude', 'aip-gate.json')} không phải đối tượng JSON hợp lệ — sửa tay rồi chạy lại aip init --full; chưa ghi file nào.`);
    return own ? trustedValue({ inRepo: true, file: path.join(root, '.claude', 'aip-gate.json'), config: own.config }, 'allowEnvFiles', { tracked }) === true : false;
  }
  const bad = g.source === 'worktree-invalid' ? g.file : g.mainInvalid;
  if (bad) throw new Error(`${bad} không phải đối tượng JSON hợp lệ — sửa tay rồi chạy lại aip init --full; chưa ghi file nào.`);
  return trustedValue(g, 'allowEnvFiles', { tracked }) === true;
}

const isLink = (p) => { try { fs.readlinkSync(p); return true; } catch { return false; } };
const eolOf = (text) => (text.includes('\r\n') ? '\r\n' : '\n');
const norm = (text) => text.replace(/\r\n/g, '\n');

// Ghi lại file UTF-16/nhị phân bằng utf8 sẽ phá nội dung cũ, nên từ chối trước mọi ghi. BOM UTF-8 vẫn hợp lệ.
function readUtf8(abs, name) {
  const buf = fs.readFileSync(abs);
  const text = buf.toString('utf8');
  const utf16Bom = buf.length >= 2 && ((buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff));
  if (utf16Bom || buf.includes(0) || text.includes(String.fromCharCode(0xfffd))) throw new Error(`${name} không phải UTF-8 (UTF-16 hoặc nhị phân) — chuyển sang UTF-8 rồi chạy lại aip init; chưa ghi file nào.`);
  return text;
}

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
    const existing = readUtf8(agentsAbs, 'AGENTS.md');
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
    const text = readUtf8(claudeAbs, 'CLAUDE.md');
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
