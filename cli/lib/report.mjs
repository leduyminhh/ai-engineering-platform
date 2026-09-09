// Report "phần nào cài được qua wizard" — sinh sau khi build (npm run build) ra build/wizard-install-report.{md,json}.
// Nguồn sự thật: plugins/_published.json (offered = core + plugin đã publish) so với plugin trên đĩa (draft = còn lại).
// Bám semantics của skillCatalog: core mang thêm 'core/principles'; KHÔNG liệt kê generated '<plugin>-principles'.
import fs from 'node:fs';
import path from 'node:path';
import { loadPlugins, loadCore, loadPublished, REPO_ROOT } from './plugins.mjs';
import { ensureDir } from './write.mjs';

const skillsOf = (p, isCore) => [
  ...(isCore ? ['core/principles'] : []),
  ...p.stages.map((s) => `${p.id}/${s.id}`),
];

/**
 * Thuần: mô hình report. offered = core + skill đã publish (wizard cho cài); mỗi plugin published
 * theo '*' (mọi skill) hoặc mảng skill lẻ. draft = plugin trên đĩa KHÔNG có skill nào published
 * (chỉ cài bằng --plugin). published=null → offer tất cả. `published` là map {id:'*'|[fullId]}.
 * Export để test.
 */
export function wizardReportModel({ plugins = loadPlugins(), core = loadCore(), published = loadPublished() } = {}) {
  const offered = [{ id: 'core', name: core.name, published: true, skills: skillsOf(core, true) }];
  const draft = [];
  for (const p of plugins) {
    const all = skillsOf(p, false);
    const sel = published ? published[p.id] : '*';
    if (published && !sel) { draft.push({ id: p.id, name: p.name, published: false, skills: all }); continue; }
    const skills = sel === '*' ? all : all.filter((s) => sel.includes(s));
    offered.push({ id: p.id, name: p.name, published: true, partial: sel !== '*', skills });
  }
  return { published: published ? Object.keys(published) : [], offered, draft };
}

/** Render report ra Markdown người đọc. */
export function renderWizardReportMd(model, at) {
  const tag = (e) => e.id === 'core' ? '' : !e.published ? ' *(draft)*' : e.partial ? ' **[PUBLISHED — skill lẻ]**' : ' **[PUBLISHED]**';
  const line = (e) => `- \`${e.id}\`${tag(e)} — ${e.name}\n` +
    e.skills.map((s) => `  - \`${s}\``).join('\n');
  const out = [
    '# Report — phần cài được qua wizard',
    '',
    `Sinh tự động lúc ${at}. Nguồn: \`plugins/_published.json\` + skill trên đĩa.`,
    '',
    `## Cài được qua wizard (offered) — ${model.offered.length}`,
    '',
    model.offered.map(line).join('\n'),
    '',
    `## KHÔNG offer — draft (chỉ cài bằng \`--plugin\`) — ${model.draft.length}`,
    '',
    model.draft.length ? model.draft.map(line).join('\n') : '_(không có)_',
    '',
  ];
  return out.join('\n');
}

/** Render report ra object JSON (máy đọc). */
export function renderWizardReportJson(model, at) {
  return { generatedAt: at, published: model.published, offered: model.offered, draft: model.draft };
}

/**
 * Ghi report ra <outDir>/wizard-install-report.{md,json}. Trả đường dẫn 2 file + model.
 * @param {string} [outDir] mặc định build/ ở gốc repo.
 */
export function writeWizardReport(outDir = path.join(REPO_ROOT, 'build'), at = new Date().toISOString()) {
  const model = wizardReportModel();
  ensureDir(outDir);
  const mdPath = path.join(outDir, 'wizard-install-report.md');
  const jsonPath = path.join(outDir, 'wizard-install-report.json');
  fs.writeFileSync(mdPath, renderWizardReportMd(model, at));
  fs.writeFileSync(jsonPath, JSON.stringify(renderWizardReportJson(model, at), null, 2) + '\n');
  return { md: mdPath, json: jsonPath, model };
}
