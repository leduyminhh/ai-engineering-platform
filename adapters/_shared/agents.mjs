// Helper dựng agent (Claude .md / Codex .toml) và preamble dispatch cho workflow. Là thư viện,
// không phải adapter (thư mục `_shared` bị build bỏ qua khi discover).
import { frontmatter } from '../../cli/lib/write.mjs';

const CLAUDE_DENY = { 'read-only': 'Edit, Write, NotebookEdit, Agent', write: 'Agent' };

/** Tên skill ở 2 dạng vì cài phẳng và cài plugin đặt tên khác nhau (`x` vs `plugin:x`). */
export function skillPointer(fullIds) {
  return fullIds.map((sid) => {
    const [p, s] = sid.split('/');
    return `\`${s}\` (bản cài dạng plugin: \`${p}:${s}\`)`;
  }).join(', ');
}

export function claudeAgentMd(agent) {
  const head = frontmatter([
    ['name', agent.id],
    ['description', agent.description],
    ['disallowedTools', CLAUDE_DENY[agent.mode]],
    ['model', agent.model],
    ['effort', agent.effort],
    ['color', agent.color],
  ]);
  const note = `> **Dùng skill:** ${skillPointer(agent.skills)}. ` +
    'Đọc trước skill `principles` (bản cài dạng plugin: `core:principles`).';
  return `${head}\n\n${note}\n\n${agent.body.replace(/^\n+/, '')}`;
}

export function workflowPreamble(wf, agentsById, provider) {
  const L = [];
  if (provider === 'claude') {
    L.push('> **Đọc trước** nguyên tắc nền tảng — skill `principles` (bản cài dạng plugin: `core:principles`).');
    if (wf.agents.length) {
      L.push('> **Cách dispatch trên Claude:** bước ghi `agent <id>` → gọi subagent qua tool Agent: ' +
        wf.agents.map((id) => `\`${id}\` (bản cài dạng plugin: \`${(agentsById.get(id) || {}).plugin}:${id}\`)`).join(', ') + '.');
    }
    if (wf.requires.length) L.push(`> **Skill dùng trực tiếp:** ${skillPointer(wf.requires)}.`);
  } else {
    L.push('> **Đọc trước** nguyên tắc nền tảng — skill `principles`.');
    if (wf.agents.length) {
      L.push('> **Cách dispatch trên Codex:** bước ghi `agent <id>` → spawn subagent theo tên: ' +
        wf.agents.map((id) => `\`${codexAgentName(id)}\``).join(', ') + '.');
    }
    if (wf.requires.length) L.push(`> **Skill dùng trực tiếp:** ${wf.requires.map((s) => `\`${s.split('/')[1]}\``).join(', ')}.`);
  }
  L.push('> Không có subagent → chạy tuần tự skill tương ứng trong session chính.');
  return L.join('\n');
}

/** Tên agent phía Codex; Task 6 chốt có đổi `-` → `_` hay không. */
export function codexAgentName(id) { return id; }
