// Pin: model and session routing (docs/requests/2026-10-21-model-session-routing). Task 2: mục baseline + README (AC2.1, AC2.2, AC3.1).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8');

  const tpl = read('core', 'agents', 'AGENTS.template.md');
  const start = tpl.indexOf('### Model and session routing');
  const rest = start < 0 ? '' : tpl.slice(start + 5);
  const next = rest.indexOf('\n### ');
  const sec = start < 0 ? '' : tpl.slice(start, next < 0 ? tpl.length : start + 5 + next);

  ok(start >= 0 && start < tpl.indexOf('### Language')
    && ['`haiku`', '`sonnet`', '`opus`', 'new session', '`/clear`', '`/compact', '15 minutes', 'acknowledg'].every((s) => sec.includes(s)),
    'AC2.1: baseline có mục Model and session routing');

  // Thí nghiệm 2026-10-30: spec-analyst chạy haiku ngang chất lượng sonnet, rẻ hơn; haiku giữ effort mặc định.
  const HAIKU = ['engineering-spec-analyst'];
  const offRoute = ctx.allAgents.filter((a) => (HAIKU.includes(a.id)
    ? a.model !== 'haiku' || a.effort : a.model !== 'sonnet' || a.effort !== 'high'));
  ok(ctx.allAgents.length > 0 && !offRoute.length,
    `AC1.1: agent khai model sonnet + effort high, spec-analyst khai haiku${offRoute.map((a) => ' ' + a.id).join('')}`);

  ok(/task review, re-review và task `DOCS` dùng `haiku`/.test(read('core', 'skills', 'plan-execution', 'SKILL.md')),
    'plan-execution giao task review, re-review và DOCS cho haiku (thí nghiệm 2026-10-30)');

  ok(['`effort`', '`medium`', '`high`'].every((s) => sec.includes(s)),
    'AC2.1: mục baseline nêu quy tắc effort (opus mặc định medium, sonnet high)');

  ok(['code.claude.com/docs/en/prompt-caching', 'code.claude.com/docs/en/sub-agents', 'code.claude.com/docs/en/costs',
    'anthropic.com/engineering/multi-agent-research-system'].every((s) => sec.includes(s)),
    'AC2.2: số liệu có nguồn');

  for (const f of ['README.md', 'README_VI.md']) {
    const t = read(f);
    ok(t.includes('CLAUDE_CODE_SUBAGENT_MODEL') && t.includes('"env"'), `AC3.1: ${f} hướng dẫn CLAUDE_CODE_SUBAGENT_MODEL`);
  }
}
