// Pin: tài liệu agent song song (docs/requests/2026-10-22-parallel-agents). Baseline có mục Parallel agents (AC1.1); các khối sau do task 4 và 5 bổ sung.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8');
  const flat = (s) => s.replace(/\s+/g, ' ');

  // AC1.1: baseline có mục Parallel agents nằm giữa Agents in CI và Model and session routing; AGENTS.md giống template
  {
    const tpl = read('core', 'agents', 'AGENTS.template.md');
    const i = tpl.indexOf('### Parallel agents');
    const sec = i < 0 ? '' : flat(tpl.slice(i, tpl.indexOf('\n### ', i + 5)));
    const need = ['worktree-<slug>-t<n>', '.claude/worktrees/', 'merge --no-ff', 'integration branch', '3 agents', 'disjoint', 'rm -rf', 'junction', 'once'];
    ok(i >= 0 && need.every((w) => sec.includes(w)), 'P3 AC1.1: baseline có mục Parallel agents với tên nhánh, thư mục worktree, merge --no-ff, integration branch, giới hạn 3, disjoint, rm -rf/junction, once');
    ok(i > tpl.indexOf('### Agents in CI') && i < tpl.indexOf('### Model and session routing'), 'P3 AC1.1: mục Parallel agents nằm giữa Agents in CI và Model and session routing');
    ok(read('AGENTS.md') === tpl, 'P3 AC1.1: AGENTS.md giống template từng byte');
  }
}
