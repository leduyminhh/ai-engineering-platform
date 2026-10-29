// Pin: docs/requests/2026-10-29-superpowers-gap-closure — nội dung đặc thù của các skill bổ sung (bootstrap, worktree, inline, TDD, debug).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8');

  // AC1.3: using-aip có SUBAGENT-STOP, thứ tự ưu tiên và bảng dấu hiệu tự biện minh
  {
    const t = read('core', 'skills', 'using-aip', 'SKILL.md');
    ok(t.includes('SUBAGENT-STOP'), 'AC1.3: using-aip có dòng SUBAGENT-STOP cho agent worker');
    ok(/## Thứ tự ưu tiên[\s\S]*?của người dùng\s*>\s*quy tắc project[^>]*>\s*skill\s*>/.test(t), 'AC1.3: using-aip nêu đúng thứ tự ưu tiên người dùng > project > skill');
    ok(/## Dấu hiệu đang tự biện minh/.test(t) && (t.match(/^\| "/gm) || []).length >= 5, 'AC1.3: using-aip có bảng ≥ 5 dấu hiệu tự biện minh');
  }

  // AC4.1: git-worktree theo quy ước baseline, dọn chỉ bằng git worktree remove khi đã merge và sạch, cấm rm -rf
  {
    const t = read('core', 'skills', 'git-worktree', 'SKILL.md');
    const baseline = read('core', 'agents', 'AGENTS.template.md');
    ok(baseline.includes('worktree-<slug>-t<n>') && baseline.includes('.claude/worktrees/<slug>-t<n>/'),
      'AC4.1: baseline vẫn có quy ước tên nhánh và thư mục worktree mà skill bám theo');
    ok(t.includes('worktree-<slug>-t<n>') && t.includes('.claude/worktrees/<slug>-t<n>/'), 'AC4.1: git-worktree nêu đúng tên nhánh và thư mục theo baseline');
    ok(t.includes('git worktree remove') && t.includes('git branch --merged') && t.includes('status --short'),
      'AC4.1: git-worktree chỉ dọn bằng git worktree remove khi đã merge và cây sạch');
    ok(/Không `rm -rf`/.test(t) && !/^\s*rm -rf/m.test(t), 'AC4.1: git-worktree cấm rm -rf và không có lệnh rm -rf nào');
  }
}
