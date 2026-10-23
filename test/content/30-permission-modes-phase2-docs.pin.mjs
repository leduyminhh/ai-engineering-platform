// Pin: tài liệu chế độ quyền phase 2 (docs/requests/2026-10-23-permission-modes-phase2), AC4.1. Chỉ ghim lệnh/khóa/phiên bản, neo theo đầu bullet.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const raw = (f) => fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
  const flat = (s) => s.replace(/\s+/g, ' ');
  const para = (s, lead) => {
    const i = s.indexOf(lead);
    if (i < 0) return '';
    const rest = s.slice(i + lead.length);
    const m = rest.search(/\n\*\*|\n## /);
    return s.slice(i, m < 0 ? undefined : i + lead.length + m);
  };
  const bullet = (sec, start) => flat(sec.split('\n').find((l) => l.startsWith(start)) ?? '');

  // [file, đầu đoạn, đầu bullet: điều kiện thứ ba | nhốt root | không bypass | worktree | PowerShell | root chỉ-đọc | phép đo, đoạn I4 cũ]
  const cases = [
    ['README.md', '**Permission modes (`aip mode`).**', ['- Third condition:', '- Confinement to the roots', '- Sessions that are not in bypass', '- In a worktree', '- PowerShell tool:', '- Read-only roots', '- Probe 2026-10-23'], 'does not check whether the file is tracked'],
    ['README_VI.md', '**Chế độ quyền (`aip mode`).**', ['- Điều kiện thứ ba:', '- Nhốt trong các root', '- Phiên không bypass', '- Trong worktree', '- Tool PowerShell:', '- Root chỉ-đọc', '- Phép đo 2026-10-23'], 'code không kiểm file có được git theo dõi'],
  ];
  for (const [file, lead, [third, confine, nonBypass, worktree, ps, readRoots, probe], stale] of cases) {
    const sec = para(raw(file), lead);
    const need = (start, words, what) => {
      const b = bullet(sec, start);
      ok(b !== '' && words.every((w) => b.includes(w)), `P4e2 AC4.1: ${file} ${what} nêu ${words.join(', ')}`);
    };
    need(third, ['git ls-files', 'git rm --cached', '.claude/aip-gate.json', 'bypassPermissions', 'git:'], 'điều kiện không-được-theo-dõi');
    ok(!sec.includes(stale), `P4e2 AC4.1: ${file} đã bỏ đoạn rủi ro I4 cũ`);
    need(confine, ['env -S', 'nice', 'sudo', 'bash -lc', 'env -iS'], 'wrapper được phủ và chưa phát hiện');
    need(nonBypass, ['kubectl -n x apply', 'helm -n x upgrade', 'xargs', 'bash -c'], 'danh sách ask ngoài bypass');
    need(worktree, ['aip-gate.json', 'stderr'], 'worktree hỏng');
    need(ps, ['PowerShell', '/e/x', '[Unverified'], 'PowerShell');
    need(readRoots, ['fullReadRoots', 'fullRoots', 'tool-results', 'CLAUDE_CONFIG_DIR', 'session_id', '[Unverified'], 'root chỉ-đọc');
    need(probe, ['2.1.308', 'claude -p', '[Unverified'], 'bản ghi phép đo');
  }
  const claude = raw('CLAUDE.md');
  ok(claude.includes('`fullReadRoots`') && /not tracked by git/.test(claude), 'P4e2 AC4.1: CLAUDE.md nhắc fullReadRoots và điều kiện not tracked by git');
}
