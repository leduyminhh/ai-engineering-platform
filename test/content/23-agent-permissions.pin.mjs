// Pin: quyền cho agent và cổng MCP (docs/requests/2026-10-21-agent-permissions). Baseline có mục Agents in CI (AC3.1); README EN/VI và CLAUDE.md mô tả công thức CI, chính sách quyền, guard-mcp (AC3.2).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8');
  const flat = (s) => s.replace(/\s+/g, ' ');

  // AC3.1: baseline có mục Agents in CI với cờ bắt buộc; AGENTS.md giống template (bytes contract giữ phần byte-for-byte)
  {
    const tpl = read('core', 'agents', 'AGENTS.template.md');
    const i = tpl.indexOf('### Agents in CI');
    const sec = i < 0 ? '' : flat(tpl.slice(i, tpl.indexOf('\n### ', i + 5)));
    const need = ['claude -p', '--permission-mode dontAsk', '--allowedTools', '--max-turns', '--max-budget-usd', '--bare', 'commit SHA', 'read-only', 'required reviewers'];
    ok(i >= 0 && need.every((w) => sec.includes(w)), 'AC3.1: baseline có mục Agents in CI với dontAsk, allowedTools, max-turns, max-budget-usd, bare, SHA, token chỉ đọc, required reviewers');
    ok(i >= 0 && i < tpl.indexOf('### Model and session routing'), 'AC3.1: mục Agents in CI nằm cạnh Model and session routing');
    ok(read('AGENTS.md') === tpl, 'AC3.1: AGENTS.md giống template từng byte');
  }

  // AC3.2: README EN/VI có công thức CI, chính sách quyền, guard-mcp; CLAUDE.md nhắc guard-mcp và policy.json
  {
    for (const f of ['README.md', 'README_VI.md']) {
      const t = flat(read(f));
      ok(['claude -p', '--permission-mode dontAsk', '--allowedTools', '--max-turns', '--max-budget-usd', '--bare'].every((w) => t.includes(w)),
        `AC3.2: ${f} có công thức CI cho claude -p`);
      ok(['guard-mcp', 'mcpAllow', 'mcpDeny'].every((w) => t.includes(w)), `AC3.2: ${f} mô tả guard-mcp với mcpAllow/mcpDeny`);
      ok(t.includes('core/permissions/policy.json') && t.includes('.claude/settings.json') && ['Cursor', 'Codex', 'Antigravity'].every((w) => t.includes(w)),
        `AC3.2: ${f} có mục chính sách quyền (policy.json, settings.json, Cursor/Codex/Antigravity)`);
    }
    const c = flat(read('CLAUDE.md'));
    ok(c.includes('guard-mcp.mjs') && c.includes('mcpAllow') && c.includes('mcpDeny') && c.includes('permissions/policy.json'),
      'AC3.2: CLAUDE.md mô tả guard-mcp và permissions/policy.json');
  }
}
