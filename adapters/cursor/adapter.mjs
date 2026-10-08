// cursor adapter — Cursor Project Rules + Agent Skills cho TỪNG plugin:
//
// build/cursor/<id>/.cursor/
//   rules/<id>-00-principles.mdc   — alwaysApply=true (core + phần riêng đã gộp)
//   skills/<skill-id>/{ SKILL.md, references/, templates/, … }
// build/cursor/core/.cursor/
//   skills/<skill-id>/…            — skill dùng chung (vd git-workflow); không có rule
//
// Per-stage KHÔNG còn .mdc (tránh trùng với skill). Nguyên tắc nền tảng vẫn always-on
// qua 00-principles; quy trình dài gọi bằng /skill-id (Cursor Agent Skills).
//
// Skill có folder riêng ⇒ asset KHÔNG cần prefix `<id>-` và KHÔNG rewrite link
// (references/… resolve nguyên bản). Prefix `<id>-` chỉ còn trên rule phẳng
// (00-principles, không có asset).
//
// [Inference] Khóa frontmatter .mdc (description / globs / alwaysApply) theo tài liệu
// Cursor Rules; SKILL.md theo Cursor Agent Skills (name khớp folder + description).
import { fullPrinciples, skillFiles } from '../_shared/lib.mjs';
import { yamlScalar } from '../../cli/lib/write.mjs';

function mdc({ description = '', alwaysApply = false, globs = '' }, body) {
  const fm = ['---'];
  if (description) fm.push(`description: ${yamlScalar(description)}`);
  if (globs) fm.push(`globs: ${globs}`); // bỏ key khi rỗng (tránh dòng "globs:" trống)
  fm.push(`alwaysApply: ${alwaysApply ? 'true' : 'false'}`);
  fm.push('---');
  const text = body.replace(/^\n+/, '').replace(/\n+$/, '');
  return `${fm.join('\n')}\n\n${text}\n`;
}

export default {
  name: 'cursor',
  describe:
    'Cursor — build/cursor/<id>/.cursor/rules/<id>-00-principles.mdc + .cursor/skills/<skill>/',
  build(plugins, { core }) {
    const files = [];
    // Skill DÙNG CHUNG của core → build/cursor/core/.cursor/skills/ (không sinh principles skill —
    // nguyên tắc đã inline vào <id>-00-principles của từng plugin). Không preamble: Cursor
    // nạp principles qua alwaysApply rule.
    for (const s of core.stages || []) {
      files.push(...skillFiles(s, `${core.id}/.cursor/skills`));
    }
    for (const p of plugins) {
      const rulesBase = `${p.id}/.cursor/rules`;
      files.push({
        path: `${rulesBase}/${p.id}-00-principles.mdc`,
        content: mdc(
          { description: `Nguyên tắc nền tảng (CORE + ${p.name}) — luôn áp dụng`, alwaysApply: true },
          fullPrinciples(core, p),
        ),
      });
      // Stage skills dưới .cursor/skills/<skill-id>/ — không preamble (00-principles always-on).
      for (const s of p.stages) {
        files.push(...skillFiles(s, `${p.id}/.cursor/skills`));
      }
    }
    return files;
  },
};
