// Regression request 2026-11-03-audit-mustfix: Must-fix của audit phần hook và skill script (phần CLI nằm ở test/*.test.mjs).
// Số trong tên ca là số finding của audit (docs/requests/2026-11-03-audit-mustfix/design.md).
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, pathToFileURL, CORE_DIR, REPO_ROOT } = ctx;
  const load = (...p) => import(pathToFileURL(path.join(...p)).href);
  const hook = (name) => load(CORE_DIR, 'hooks', 'scripts', name);

  // ── guard-bash: #1 (shell bọc), #10 (nối dòng + refspec biến), #2 (ghi file cấu hình của guard)
  {
    const gb = await hook('guard-bash.mjs');
    const run1 = (cmd, branch = 'feature/x', tool = 'Bash') => gb.decide({ tool_name: tool, cwd: '.', tool_input: { command: cmd } }, { currentBranch: () => branch });
    const ask = (c, ...rest) => run1(c, ...rest)?.decision === 'ask';

    for (const c of ['bash -c "git push origin master"', "sh -c 'git push origin main'", 'bash -lc "git push origin develop"', 'zsh -c "git push origin main"',
      'sudo bash -c "git push origin main"', 'eval "git push origin master"', "bash -c \"bash -c 'git push origin main'\"",
      'bash -c "git add . && git push --force"', 'env bash -c "git push origin main"']) {
      ok(ask(c), `AC1.1: shell/eval bọc không che push nhánh bảo vệ: ${c}`);
    }
    ok(ask('bash -c "git push"', 'main'), 'AC1.1: bash -c "git push" khi đang ở main → ask');
    for (const c of ['powershell -Command "git push origin master"', 'pwsh -c "git push origin main"', 'iex "git push origin master"',
      'Invoke-Expression "git push origin main"', 'powershell -NoProfile -Command git push origin main']) {
      ok(ask(c, 'feature/x', 'PowerShell'), `AC1.1: PowerShell bọc không che push nhánh bảo vệ: ${c}`);
    }
    for (const c of ['bash -c "git status"', 'bash -c "git push origin feature/x"', 'bash -c "echo hi"', 'eval "ls"', 'sh script.sh']) {
      ok(run1(c) === null, `AC1.1: shell bọc lệnh vô hại không bị hỏi nhầm: ${c}`);
    }
    {
      // full + bypass vẫn giữ push (fullKeep mặc định) kể cả khi bọc trong shell
      const input = { tool_name: 'Bash', cwd: '.', permission_mode: 'bypassPermissions', tool_input: { command: 'bash -c "git push origin main"' } };
      ok(gb.decide(input, { currentBranch: () => 'feature/x', config: { mode: 'full' }, repoRoot: path.resolve('.'), tracked: () => false })?.decision === 'ask',
        'AC1.1: full + bypass: bash -c "git push origin main" vẫn ask (fullKeep push)');
    }

  }




}
