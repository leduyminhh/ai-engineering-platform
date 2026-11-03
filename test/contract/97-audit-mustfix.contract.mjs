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

    for (const c of ['echo \'{"mode":"full"}\' > .claude/aip-gate.json', "sed -i 's/ask/full/' .claude/aip-gate.json", 'cp x.json .claude/settings.json',
      'echo x | tee .claude/settings.local.json', 'rm .claude/aip-gate.json', 'echo x >> .claude\\settings.json']) {
      ok(ask(c), `AC2.2: lệnh shell ghi file cấu hình của guard → ask: ${c}`);
    }
    ok(ask('Set-Content .claude\\aip-gate.json x', 'feature/x', 'PowerShell'), 'AC2.2: PowerShell Set-Content vào aip-gate.json → ask');
    for (const c of ['cat .claude/aip-gate.json', 'git diff .claude/settings.json', 'ls .claude', 'echo hi > notes.txt', 'aip mode status']) {
      ok(run1(c) === null, `AC2.2: đọc file cấu hình hay lệnh khác không bị hỏi nhầm: ${c}`);
    }
  }

  // ── guard-files: #2 Write/Edit vào cấu hình của guard luôn ask, mọi chế độ
  {
    const gf = await hook('guard-files.mjs');
    const root = path.resolve('/tmp/am-repo').replaceAll('\\', '/');
    const fdec = (tool, file, extra = {}, opts = {}) => gf.decide({ tool_name: tool, tool_input: { file_path: file }, cwd: root, ...extra },
      { scopes: {}, repoRoot: root, allowEnv: () => false, ...opts });
    for (const tool of ['Edit', 'Write', 'MultiEdit']) {
      for (const f of ['.claude/aip-gate.json', '.claude/settings.json', '.claude/settings.local.json']) {
        ok(fdec(tool, `${root}/${f}`)?.decision === 'ask', `AC2.1: ${tool} ${f} → ask (chế độ thường)`);
      }
    }
    ok(fdec('Write', `${root}/.claude/aip-gate.json`, { permission_mode: 'bypassPermissions' }, { config: { mode: 'full' }, tracked: () => false })?.decision === 'ask',
      'AC2.1: full + bypass vẫn ask khi ghi aip-gate.json');
    ok(fdec('Edit', path.resolve('/home/u/.claude/settings.json').replaceAll('\\', '/'))?.decision === 'ask', 'AC2.1: settings.json toàn cục cũng ask');
    ok(fdec('Read', `${root}/.claude/aip-gate.json`) === null && fdec('Write', `${root}/docs/a.md`) === null && fdec('Write', `${root}/.claude/agents/x.md`) === null,
      'AC2.1: đọc cấu hình hay ghi file khác trong .claude không bị hỏi nhầm');
  }


  // ── ledger: #9 dòng Plan:/Part:/Part NN: sai định dạng bị từ chối, dòng trống bị từ chối
  {
    const { validateLine } = await load(CORE_DIR, 'skills', 'plan-execution', 'scripts', 'ledger.mjs');
    const sha = 'a'.repeat(40);
    for (const l of ['Part 1: merged', 'Part 1: merged abc1234', 'Plan: Complete', 'Plan: complete.', 'Plan: complete now', 'Part: done', 'Part: complete.',
      'Part: Complete abc1234', 'Part 01: done', '', '   ', '\n']) {
      ok(typeof validateLine(l) === 'string', `AC9.1: validateLine từ chối ${JSON.stringify(l)}`);
    }
    for (const l of ['Plan: complete', 'Part: complete', `Part: complete ${sha}`, 'Part 01: merged abc1234def', 'Part 02-word-count: merged abc1234',
      'Task 1: start (base abc1234)', 'Blocked: x']) {
      ok(validateLine(l) === null, `AC9.1: validateLine chấp nhận ${JSON.stringify(l)}`);
    }
  }

  // ── AC8.1: gốc repo chính trong submodule là gốc của chính submodule, không phải <cha>/.git
  {
    const inGit = (p) => /[\\/]\.git([\\/]|$)/.test(p);
    const fwd = (p) => p.replace(/\\/g, '/');
    const fakeGit = (top, common) => (args) => {
      if (args.includes('--show-toplevel')) return top;
      if (args.includes('--git-common-dir')) return common;
      throw new Error(`git lạ: ${args.join(' ')}`);
    };
    const sub = path.resolve('/tmp/am-super/mod');
    const common = path.resolve('/tmp/am-super/.git/modules/mod');
    const { mainRoot } = await import(pathToFileURL(path.join(REPO_ROOT, 'cli', 'lib', 'status.mjs')).href);
    ok(fwd(mainRoot(sub, fakeGit(sub, common))) === fwd(sub), 'AC8.1: status.mainRoot trong submodule = gốc submodule');
    ok(fwd(mainRoot(sub, fakeGit(sub, path.join(sub, '.git')))) === fwd(sub), 'AC8.1: status.mainRoot repo thường không đổi');
    const { resolveWorkspace } = await load(CORE_DIR, 'skills', 'plan-execution', 'scripts', 'workspace.mjs');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-sm-ws-'));
    try {
      const reqDir = path.join(tmp, 'docs', 'requests', '2026-11-03-x');
      fs.mkdirSync(reqDir, { recursive: true });
      const ws = resolveWorkspace(reqDir, { cwd: tmp, git: fakeGit(tmp, path.join(path.dirname(tmp), '.git', 'modules', 'mod')), stderr: () => {} });
      ok(!inGit(ws.dir) && fwd(ws.dir).startsWith(fwd(tmp)), `AC8.1: workspace.mjs trong submodule ghi .aip trong submodule, không trong .git (${ws.dir})`);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    const { resolveAutonomy } = await load(CORE_DIR, 'skills', 'plan-execution', 'scripts', 'autonomy.mjs');
    const sm = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-sm-au-'));
    try {
      const topDir = path.join(sm, 'mod');
      const gitDir = path.join(sm, '.git');
      fs.mkdirSync(topDir, { recursive: true });
      // File giả nằm trong <cha>/.git/modules/.claude: chỉ đọc được nếu "gốc chính" bị tính nhầm thành dirname(common-dir).
      fs.mkdirSync(path.join(gitDir, 'modules', '.claude'), { recursive: true });
      fs.writeFileSync(path.join(gitDir, 'modules', '.claude', 'aip-gate.json'), JSON.stringify({ autonomy: { mergeLocal: true } }));
      const r = resolveAutonomy(topDir, { git: fakeGit(topDir, path.join(gitDir, 'modules', 'mod')), tracked: () => false });
      ok(r.value.mergeLocal === false, 'AC8.1: autonomy.mjs trong submodule không đọc cấu hình từ <cha>/.git/modules');
    } finally { fs.rmSync(sm, { recursive: true, force: true }); }

    // gate-config dùng git thật: dựng một submodule thật.
    const { resolveGate } = await hook('gate-config.mjs');
    const tmpR = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-sm-real-'));
    try {
      const g = (cwd, ...a) => execFileSync('git', ['-c', 'protocol.file.allow=always', '-c', 'user.name=t', '-c', 'user.email=t@t.test', ...a], { cwd, stdio: 'pipe', encoding: 'utf8' });
      const lib = path.join(tmpR, 'lib');
      const sup = path.join(tmpR, 'sup');
      fs.mkdirSync(lib); fs.mkdirSync(sup);
      g(lib, 'init', '-q'); fs.writeFileSync(path.join(lib, 'a.txt'), 'x'); g(lib, 'add', '.'); g(lib, 'commit', '-qm', 'x');
      g(sup, 'init', '-q'); g(sup, 'submodule', 'add', '-q', lib, 'mod');
      const gate = resolveGate(path.join(sup, 'mod'));
      ok(gate && gate.roots.every((r) => !inGit(r)) && fwd(gate.main) === fwd(path.join(sup, 'mod')),
        `AC8.1: gate-config.resolveGate trong submodule thật: main = gốc submodule (${gate?.roots?.join(', ')})`);
    } finally { fs.rmSync(tmpR, { recursive: true, force: true }); }
  }
}
