// Shared helpers for adapters.
//
// Adapters live in adapters/<tool>/adapter.mjs and are auto-discovered by cli/build.mjs.
// This `_shared` dir is skipped by discovery — it is a plain library, not an adapter.
//
// Adapter contract:  build(plugins, { outDir, marketplace }) -> file entries
// where each entry is { path, content } | { path, copyFrom } | { path, copyDir },
// `path` relative to build/<tool>/ using '/' separators. `plugins` is the FULL list.
import path from 'node:path';
import { frontmatter } from '../../cli/lib/write.mjs';

export { frontmatter };

/**
 * Full principles for a plugin = shared CORE baseline + plugin's domain-specific part.
 * Used by adapters that embed principles inline (cursor rules, antigravity AGENTS.md).
 * claude + codex do NOT use this — they ship core as a separate skill (`principles`) instead.
 */
export function fullPrinciples(core, plugin) {
  const head = (core && core.principles ? core.principles : '').trim();
  const body = (plugin.shared && plugin.shared.principles ? plugin.shared.principles : '').trim();
  return [head, body].filter(Boolean).join('\n\n') + '\n';
}

/**
 * SKILL.md content for a stage: YAML frontmatter (name, description) + instructions body.
 * Optional `preamble` is inserted right after the frontmatter — the claude adapter uses it to
 * point a stage skill at the separately-shipped principles skills (Claude + Codex do NOT auto-load
 * them, so both pass a pointer preamble; cursor inline principles always-on, so it passes none).
 */
export function skillMd(stage, preamble = '') {
  return (
    frontmatter([
      ['name', stage.id],
      ['description', stage.description],
    ]) +
    '\n\n' +
    (preamble ? preamble.trim() + '\n\n' : '') +
    stage.body.replace(/^\n+/, '')
  );
}

/**
 * copyDir entries for a stage's declared asset subdirs (e.g. `references/`), materialized
 * under `dir`. Shared by every adapter so referenced material (templates, structure docs)
 * ships alongside the instructions in ALL builds — not just claude. `references/<x>` links
 * in the body resolve because the assets sit beside the body file.
 */
export function assetFiles(stage, dir) {
  const dirs = (stage.assets || []).map((asset) => ({
    path: `${dir}/${asset}`, copyDir: path.join(stage.assetsDir, asset),
  }));
  const extraDirs = (stage.dirAssets || []).map((da) => ({
    path: `${dir}/${da.name}`, copyDir: da.from,
  }));
  const files = (stage.fileAssets || []).map((fa) => ({
    path: `${dir}/${fa.name}`, copyFrom: fa.from,
  }));
  return [...dirs, ...extraDirs, ...files];
}

/**
 * File entries that materialize one stage as a skill directory under `<base>/<stage.id>/`.
 * Emits SKILL.md plus any declared asset directories (copied verbatim).
 */
export function skillFiles(stage, base, preamble = '') {
  const dir = `${base}/${stage.id}`;
  return [{ path: `${dir}/SKILL.md`, content: skillMd(stage, preamble) }, ...assetFiles(stage, dir)];
}

/**
 * Where a stage's instructions live inside an AGENTS.md-style bundle (antigravity).
 * Stages WITH assets get their own folder (`<id>/SKILL.md` + `<id>/references/`) so relative
 * `references/...` links resolve; stages without assets stay a flat `<id>.md` (minimal churn).
 */
export function workflowDocPath(stage) {
  const hasAssets = (stage.assets || []).length || (stage.fileAssets || []).length || (stage.dirAssets || []).length;
  return hasAssets ? `docs/workflow/${stage.id}/SKILL.md` : `docs/workflow/${stage.id}.md`;
}

// Mục lục AGENTS.md chỉ cần một dòng nhận diện; bản đầy đủ nằm ở file hướng dẫn mà dòng kế tiếp trỏ tới.
export const WHEN_TO_USE_MAX = 200;

/** Single-line "when to use" — first sentence of the stage description, cut at a word boundary. */
export function whenToUse(stage) {
  const d = (stage.description || '').trim().replace(/\s+/g, ' ');
  const m = d.match(/^(.*?[.。])\s/);
  const first = m ? m[1] : d;
  const chars = [...first];
  if (chars.length <= WHEN_TO_USE_MAX) return first;
  const head = chars.slice(0, WHEN_TO_USE_MAX - 1).join('');
  const cut = head.lastIndexOf(' ');
  return closeCut(cut > 0 ? head.slice(0, cut) : head);
}

const TRAILING_JOINERS = /[\s,;:—\-/+&|×(]+$/;

function unclosedOpens(text) {
  const open = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') open.push(i);
    else if (text[i] === ')' && open.length) open.pop();
  }
  return open;
}

// Cắt giữa ngoặc để lại "(" không đóng; lùi về trước "(" ngoài cùng chưa đóng để dòng mục lục đọc trọn ý.
function closeCut(text) {
  const open = unclosedOpens(text);
  if (!open.length) return `${text.replace(TRAILING_JOINERS, '')}…`;
  const before = text.slice(0, open[0]).replace(TRAILING_JOINERS, '');
  if (before) return `${before}…`;
  const body = [...text.replace(TRAILING_JOINERS, '')];
  while (body.length && body.length + 1 + unclosedOpens(body.join('')).length > WHEN_TO_USE_MAX) body.pop();
  const kept = body.join('');
  return `${kept}…${')'.repeat(unclosedOpens(kept).length)}`;
}

/**
 * AGENTS.md-style bundle for ONE plugin (used by antigravity; codex switched to native skills),
 * written under `<base>/`: AGENTS.md (principles + skill index) + docs/workflow/<id>.md per stage.
 * Antigravity reads a root AGENTS.md as its "contract" file.
 */
export function agentsFiles(plugin, { tool, base, core }) {
  const L = [];
  L.push(`# ${plugin.name} — Quy trình làm việc (AGENTS.md)`);
  L.push('');
  L.push(
    `> File AGENTS.md này do \`cli/build.mjs\` sinh tự động cho công cụ **${tool}** từ plugin ` +
      `\`${plugin.id}\` (nguồn trung tính trong \`plugins/${plugin.id}/\`) + nguyên tắc CORE chung ` +
      `(\`core/principles/\`). KHÔNG sửa tay — sửa ở nguồn rồi build lại.`,
  );
  L.push('');
  L.push(fullPrinciples(core, plugin).trim());
  L.push('');
  L.push('## Skill (gọi theo yêu cầu)');
  L.push('');
  for (const s of plugin.stages) {
    L.push(`### ${s.id} — ${s.title}`);
    L.push(`- **Chạy ở:** ${s.runsIn} · **Tần suất:** ${s.invoke}`);
    L.push(`- **Khi nào dùng:** ${whenToUse(s)}`);
    L.push(`- **Hướng dẫn chi tiết:** \`${workflowDocPath(s)}\``);
    L.push('');
  }
  L.push('## Cách dùng');
  L.push('- Trước khi làm một giai đoạn, đọc `docs/workflow/<id>.md` tương ứng và tuân thủ đầy đủ.');
  L.push('- Mọi bối cảnh giữ trong file (xem nguyên tắc trên). Con người duyệt diff trước khi commit.');
  L.push('');

  const files = [{ path: `${base}/AGENTS.md`, content: L.join('\n') }];
  for (const s of plugin.stages) {
    const doc = workflowDocPath(s);
    files.push({ path: `${base}/${doc}`, content: s.body.replace(/^\n+/, '') });
    // ship references/ and fileAssets beside SKILL.md when the stage has assets (doc lives in its own folder)
    if ((s.assets || []).length || (s.fileAssets || []).length || (s.dirAssets || []).length) files.push(...assetFiles(s, `${base}/${path.dirname(doc)}`));
  }
  return files;
}
