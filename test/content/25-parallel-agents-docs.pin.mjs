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

  // AC1.2: README EN/VI có đoạn Parallel agents / Agent song song; CLAUDE.md nhắc script và quy ước nhánh
  {
    const upTo = (s, lead, end) => { const i = s.indexOf(lead); const j = i < 0 ? -1 : s.indexOf(end, i + lead.length); return i < 0 || j < 0 ? '' : flat(s.slice(i, j)); };
    const common = ['claude --worktree', 'worktree-<slug>-t<n>', 'check-partition.mjs', '[Verified', '[Unverified', 'isolation: worktree', 'code.claude.com/docs/en/worktrees', 'merge --no-ff'];
    const cases = [
      ['README.md', '**Parallel agents.**', '**Limits / residual risk.**', 'does not run agents'],
      ['README_VI.md', '**Agent song song.**', '**Giới hạn / residual risk.**', 'không tự chạy agent'],
    ];
    for (const [file, lead, end, notRun] of cases) {
      const sec = upTo(read(file), lead, end);
      ok(sec !== '' && [...common, notRun].every((w) => sec.includes(w)), `P3 AC1.2: ${file} có đoạn ${lead} với công thức, bảng Verified/Unverified, URL worktrees và câu aip không tự chạy agent`);
    }
    const claude = flat(read('CLAUDE.md'));
    ok(['check-partition.mjs', 'Parallel agents', 'worktree-<slug>-t<n>'].every((w) => claude.includes(w)), 'P3 AC1.2: CLAUDE.md nhắc check-partition.mjs, Parallel agents và worktree-<slug>-t<n>');
  }

  // AC4.1: spec sống hooks-gates có R4, R5 (link tới design của request), hai dòng Lịch sử mới; specs/README vẫn đủ 7 năng lực
  {
    const spec = read('docs', 'specs', 'hooks-gates', 'spec.md');
    const link = '2026-10-22-parallel-agents/design.md';
    const req = spec.slice(spec.indexOf('## Yêu cầu'), spec.indexOf('## Lịch sử'));
    const hist = spec.slice(spec.indexOf('## Lịch sử'));
    for (const id of ['hooks-gates/R4', 'hooks-gates/R5']) {
      const line = req.split('\n').find((l) => l.includes(`**${id}**`)) ?? '';
      ok(line.includes(link), `P3 AC4.1: mục Yêu cầu có dòng **${id}** liên kết tới design của request`);
      ok(hist.split('\n').some((l) => l.includes(id) && l.includes(link) && l.includes('2026-10-22')), `P3 AC4.1: bảng Lịch sử có dòng ${id} ngày 2026-10-22`);
    }
    const readme = read('docs', 'specs', 'README.md');
    ok(['projection', 'install-lifecycle', 'hooks-gates', 'workflows', 'artifact-templates', 'baseline', 'cli-wizard'].every((c) => readme.includes('`' + c + '`')), 'P3 AC4.1: docs/specs/README.md vẫn liệt kê đủ 7 năng lực');
  }

  // AC5.1: core đã bump từ 1.11.1 (script check-partition và baseline đổi nội dung) và lock khớp manifest
  {
    const ver = JSON.parse(read('core', '.manifest.json')).version;
    const lock = JSON.parse(read('plugins', '_versions.lock.json')).core?.version;
    const cmp = (a, b) => a.split('.').map(Number).reduce((d, n, i) => d || n - Number(b.split('.')[i]), 0);
    ok(cmp(ver, '1.12.0') >= 0 && lock === ver, 'P3 AC5.1: core >= 1.12.0 và plugins/_versions.lock.json khớp core/.manifest.json');
  }
}
