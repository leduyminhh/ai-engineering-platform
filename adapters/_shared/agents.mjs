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

/**
 * Tên agent phía Codex. Tài liệu chính thức (learn.chatgpt.com/docs/agent-configuration/subagents)
 * cho phép filename giữ `-` (vd `.codex/agents/pr-explorer.toml`) nhưng MỌI ví dụ trường `name`
 * trong file lại dùng snake_case (`pr_explorer`, `docs_researcher`, `code_mapper`, `ui_fixer`, …) —
 * không có ví dụ nào giữ `-` trong `name`. Không thể tự spawn agent để xác thực runtime (CLI cài
 * sẵn không có subcommand liệt kê/validate custom agent), nên đây là suy luận theo convention tài
 * liệu, chưa phải bằng chứng runtime trực tiếp.
 */
export function codexAgentName(id) { return id.replace(/-/g, '_'); }

export function tomlBasic(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}

// Multi-line basic string của TOML vẫn xử lý escape `\`, và `"""` trong nội dung sẽ đóng chuỗi sớm.
export function tomlMultiline(s) {
  return '"""\n' + String(s).replace(/\\/g, '\\\\').replace(/"""/g, '""\\"') + '"""';
}

const CODEX_SANDBOX = { 'read-only': 'read-only', write: 'workspace-write' };
// [Unverified] Codex chỉ nhận low/medium/high cho model_reasoning_effort; mức khác bỏ qua thay vì ghi sai.
const CODEX_EFFORT = new Set(['low', 'medium', 'high']);

export function codexAgentToml(agent) {
  const lines = [
    `name = ${tomlBasic(codexAgentName(agent.id))}`,
    `description = ${tomlBasic(agent.description)}`,
    `sandbox_mode = ${tomlBasic(CODEX_SANDBOX[agent.mode])}`,
  ];
  if (agent.effort && CODEX_EFFORT.has(agent.effort)) lines.push(`model_reasoning_effort = ${tomlBasic(agent.effort)}`);
  const note = `> Dùng skill: ${agent.skills.map((s) => `\`${s.split('/')[1]}\``).join(', ')}. Đọc trước skill \`principles\`.`;
  lines.push(`developer_instructions = ${tomlMultiline(`${note}\n\n${agent.body.replace(/^\n+/, '')}`)}`);
  return lines.join('\n') + '\n';
}
