// Pin: tài liệu chế độ quyền phase 2 (docs/requests/2026-10-23-permission-modes-phase2), AC4.1. Chỉ ghim lệnh/khóa/phiên bản.
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
  const bulletWith = (sec, token) => flat(sec.split('\n').find((l) => l.startsWith('- ') && l.includes(token)) ?? '');

  const cases = [
    ['README.md', '**Permission modes (`aip mode`).**', 'does not check whether the file is tracked'],
    ['README_VI.md', '**Chế độ quyền (`aip mode`).**', 'code không kiểm file có được git theo dõi'],
  ];
  for (const [file, lead, stale] of cases) {
    const sec = para(raw(file), lead);
    const has = (token, words) => { const b = bulletWith(sec, token); return b !== '' && words.every((w) => b.includes(w)); };
    ok(has('git ls-files', ['git rm --cached', '.claude/aip-gate.json', 'bypassPermissions', 'git:']), `P4e2 AC4.1: ${file} điều kiện không-được-theo-dõi nêu git ls-files, git rm --cached, aip-gate.json, bypassPermissions, dòng git:`);
    ok(!sec.includes(stale), `P4e2 AC4.1: ${file} đã bỏ đoạn rủi ro I4 cũ`);
    ok(has('env -S', ['nice', 'sudo', 'kubectl -n x apply', 'bash -lc']), `P4e2 AC4.1: ${file} đoạn wrapper nêu env -S, nice, sudo, bash -lc, kubectl -n x apply`);
    ok(has('/e/x', ['PowerShell']), `P4e2 AC4.1: ${file} đoạn PowerShell nêu /e/x`);
    ok(has('fullReadRoots', ['fullRoots', 'tool-results', 'CLAUDE_CONFIG_DIR']), `P4e2 AC4.1: ${file} đoạn root chỉ-đọc nêu fullReadRoots, fullRoots, tool-results, CLAUDE_CONFIG_DIR`);
    ok(has('2.1.308', ['claude -p', '[Unverified]']), `P4e2 AC4.1: ${file} bản ghi phép đo 2.1.308 có claude -p và nhãn [Unverified]`);
    ok(has('worktree', ['aip-gate.json']) && /stderr/.test(sec), `P4e2 AC4.1: ${file} nêu worktree + aip-gate.json hỏng và stderr`);
  }
  const claude = raw('CLAUDE.md');
  ok(claude.includes('`fullReadRoots`') && /not tracked by git/.test(claude), 'P4e2 AC4.1: CLAUDE.md nhắc fullReadRoots và điều kiện not tracked by git');
}
