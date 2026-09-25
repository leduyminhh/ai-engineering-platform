// codex adapter — OpenAI Codex nạp NATIVE SKILLS từ `$CODEX_HOME/skills/` (mặc định
// `~/.codex/skills/`): mỗi skill là một thư mục con chứa SKILL.md (frontmatter name +
// description). Vì thế ta build CÙNG layout skill như claude (nhưng PHẲNG, không marketplace):
//
// build/codex/
//   core/skills/principles/SKILL.md          <- nguyên tắc nền tảng chung (core)
//   <id>/skills/<id>-principles/SKILL.md      <- nguyên tắc RIÊNG của plugin (nếu có)
//   <id>/skills/<stage>/SKILL.md (+ assets)   <- mỗi giai đoạn = 1 skill
//
// install (kind 'codex') link mỗi thư mục skill vào `<root>/.codex/skills/<skill-id>/`.
// Tên skill (backend-init, principles, <id>-principles) đã DUY NHẤT toàn cục nên cài nhiều
// plugin không đụng nhau — khác hẳn mô hình AGENTS.md cũ (3 plugin = 3 AGENTS.md không gộp
// được vào 1 file gốc). Codex KHÔNG auto-load skill khác khi gọi 1 skill, nên chèn pointer
// nhắc đọc nguyên tắc nền tảng trước (giống claude).
import { skillFiles, frontmatter } from '../_shared/lib.mjs';
import { codexAgentToml, workflowPreamble } from '../_shared/agents.mjs';

// CORE = skill "principles" (nguyên tắc nền tảng) + các SKILL DÙNG CHUNG từ core/skills/
// (vd git-workflow) — install kind 'codex' luôn kèm core nên các skill này đi theo.
function coreSkill(core) {
  const content =
    frontmatter([
      ['name', 'principles'],
      ['description', core.description],
    ]) +
    '\n\n' +
    core.principles.replace(/^\n+/, '');
  const files = [{ path: 'core/skills/principles/SKILL.md', content }];
  const note =
    '> **Đọc trước** nguyên tắc nền tảng — skill `principles` — rồi mới thực hiện skill này.';
  for (const stage of core.stages || []) {
    files.push(...skillFiles(stage, 'core/skills', note));
  }
  return files;
}

// Nguyên tắc RIÊNG của plugin (shared/principles.md) thành một skill riêng cho Codex.
function pluginPrinciplesSkill(p) {
  const body = ((p.shared && p.shared.principles) || '').replace(/^\n+/, '');
  if (!body.trim()) return [];
  const name = `${p.id}-principles`;
  const description =
    `Nguyên tắc nền tảng RIÊNG của plugin ${p.id} (pipeline bắt buộc, phân tầng, ranh giới ` +
    `an toàn, nguồn sự thật đặc thù) — đọc TRƯỚC khi chạy bất kỳ giai đoạn ${p.id}-* nào; ` +
    `bổ sung cho skill core principles.`;
  const content = frontmatter([['name', name], ['description', description]]) + '\n\n' + body;
  return [{ path: `${p.id}/skills/${name}/SKILL.md`, content }];
}

export default {
  name: 'codex',
  describe: 'OpenAI Codex — build/codex/<id>/skills/<skill>/SKILL.md (native skills → ~/.codex/skills/)',
  build(plugins, { core, workflows }) {
    const files = [...coreSkill(core)];
    for (const p of plugins) {
      files.push(...pluginPrinciplesSkill(p));
      const note =
        `> **Đọc trước** nguyên tắc nền tảng — skill \`principles\` + \`${p.id}-principles\` — ` +
        `rồi mới thực hiện giai đoạn này.\n` +
        `> Khi commit/push/tạo branch/PR: gọi skill \`git-workflow\`.`;
      for (const stage of p.stages) {
        files.push(...skillFiles(stage, `${p.id}/skills`, note));
      }
      for (const a of p.agents || []) files.push({ path: `${p.id}/agents/${a.id}.toml`, content: codexAgentToml(a) });
    }
    if (workflows && workflows.stages.length) {
      const agentsById = new Map(plugins.flatMap((p) => p.agents || []).map((a) => [a.id, a]));
      for (const wf of workflows.stages) {
        files.push(...skillFiles(wf, 'workflows/skills', workflowPreamble(wf, agentsById, 'codex')));
      }
    }
    return files;
  },
};
