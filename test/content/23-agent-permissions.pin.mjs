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

  // AC3.2: README EN/VI có công thức CI, guard-mcp, chính sách quyền — mỗi từ khoá neo vào đúng đoạn, không khớp toàn file
  {
    // Từ dấu mở đoạn tới dòng trống kế tiếp; riêng mục CI kéo dài tới đoạn in đậm kế tiếp (có khối code và danh sách).
    const must = (i, what) => { if (i < 0) throw new Error(`23-agent-permissions.pin: không thấy mốc ${what}`); return i; };
    const para = (s, lead) => { const i = must(s.indexOf(lead), lead); const j = s.indexOf('\n\n', i); return s.slice(i, j < 0 ? undefined : j); };
    const upTo = (s, lead, end) => { const i = must(s.indexOf(lead), lead); return s.slice(i, must(s.indexOf(end, i + lead.length), end)); };
    const cases = [
      ['README.md', '**Agents in CI.**', '**MCP gate (`guard-mcp`).**', '**Permission policy.**', '**Limits / residual risk.**'],
      ['README_VI.md', '**Agent trong CI.**', '**Cổng MCP (`guard-mcp`).**', '**Chính sách quyền.**', '**Giới hạn / residual risk.**'],
    ];
    for (const [f, ciLead, mcpLead, polLead, ciEnd] of cases) {
      const src = read(f);
      const ci = flat(upTo(src, ciLead, ciEnd));
      ok(['claude -p', '--permission-mode dontAsk', '--allowedTools', '--max-turns', '--max-budget-usd', '--bare', 'commit SHA'].every((w) => ci.includes(w)),
        `AC3.2: ${f} có công thức CI cho claude -p trong mục Agents in CI`);
      const mcp = flat(para(src, mcpLead));
      ok(['mcpAllow', 'mcpDeny', 'plugin:<plugin>:<server>', 'fail-open'].every((w) => mcp.includes(w)),
        `AC3.2: ${f} mô tả guard-mcp với mcpAllow/mcpDeny trong đoạn riêng`);
      const pol = flat(para(src, polLead));
      ok(['core/permissions/policy.json', '.claude/settings.json', 'Cursor', 'Codex', 'Antigravity', 'allowEnvFiles'].every((w) => pol.includes(w)),
        `AC3.2: ${f} có mục chính sách quyền (policy.json, settings.json, Cursor/Codex/Antigravity)`);
    }
    const c = flat(read('CLAUDE.md'));
    ok(c.includes('guard-mcp.mjs') && c.includes('mcpAllow') && c.includes('mcpDeny') && c.includes('permissions/policy.json'),
      'AC3.2: CLAUDE.md mô tả guard-mcp và permissions/policy.json');
  }
}
