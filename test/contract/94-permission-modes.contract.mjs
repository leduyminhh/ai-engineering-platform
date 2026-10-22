// Contract chế độ quyền ask/full (P4e): effectiveMode, guard-mcp, guard-files.
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, pathToFileURL, CORE_DIR } = ctx;
  const scripts = path.join(CORE_DIR, 'hooks', 'scripts');
  const load = (n) => import(pathToFileURL(path.join(scripts, n)).href);
  const { effectiveMode, fullKeep, fullRoots, readGate } = await load('gate-config.mjs');
  const mcp = await load('guard-mcp.mjs');
  const files = await load('guard-files.mjs');

  const modes = [undefined, 'ask', 'full', 'FULL', 1, null, ['full']];
  const perms = [undefined, 'default', 'acceptEdits', 'auto', 'dontAsk', 'bypassPermissions', 5];
  for (const m of modes) {
    for (const p of perms) {
      const want = m === 'full' && p === 'bypassPermissions' ? 'full' : 'ask';
      ok(effectiveMode({ mode: m }, { permission_mode: p }) === want,
        `P4e AC1.1: effectiveMode(mode=${JSON.stringify(m)}, permission_mode=${JSON.stringify(p)}) = ${want}`);
    }
  }
  const bypass = { permission_mode: 'bypassPermissions' };
  ok(effectiveMode(null, bypass) === 'ask' && effectiveMode('full', bypass) === 'ask' && effectiveMode({ mode: 'full' }, null) === 'ask',
    'P4e AC1.1: config null/chuỗi hoặc input null → ask');

  const keepCases = [
    [{}, ['push']], [null, ['push']], [{ fullKeep: [] }, []], [{ fullKeep: ['push', 'x', 3] }, ['push']], [{ fullKeep: 'push' }, ['push']],
  ];
  for (const [cfg, want] of keepCases) {
    ok(JSON.stringify(fullKeep(cfg)) === JSON.stringify(want), `P4e AC1.1: fullKeep(${JSON.stringify(cfg)}) = ${JSON.stringify(want)}`);
  }
  const abs = path.resolve('/tmp/p4e-root');
  ok(JSON.stringify(fullRoots({ fullRoots: [abs, 'rel/path', 3] })) === JSON.stringify([abs])
    && fullRoots({}).length === 0 && fullRoots(null).length === 0 && fullRoots({ fullRoots: 'x' }).length === 0,
    'P4e AC1.1: fullRoots chỉ giữ đường dẫn tuyệt đối, mặc định []');

  const call = (tool, config, permission_mode) => mcp.decide({ tool_name: tool, cwd: '.', permission_mode }, { config });
  ok(call('mcp__b__t', { mode: 'full', mcpAllow: ['a'] }, 'bypassPermissions') === null, 'P4e AC1.4: full hiệu lực bỏ mcpAllow');
  ok(call('mcp__b__t', { mode: 'full', mcpAllow: ['a'], mcpDeny: ['b'] }, 'bypassPermissions')?.decision === 'deny', 'P4e AC1.4: full hiệu lực vẫn giữ mcpDeny');
  ok(call('mcp__b__t', { mode: 'full', mcpAllow: ['a'] }, 'default')?.decision === 'deny', 'P4e AC1.5: full không hiệu lực (permission_mode default) → mcpAllow vẫn chặn');
  ok(call('mcp__b__t', { mode: 'full', mcpAllow: ['a'] }, undefined)?.decision === 'deny', 'P4e AC1.5: full không hiệu lực (thiếu permission_mode) → mcpAllow vẫn chặn');

  const root = path.resolve('/tmp/p4e-repo').replaceAll('\\', '/');
  const scopes = { writer: ['src/**'] };
  const fdec = (tool, file, config, permission_mode, extra = {}) => files.decide(
    { tool_name: tool, tool_input: { file_path: file }, cwd: root, permission_mode, ...extra },
    { scopes, repoRoot: root, allowEnv: () => false, config });
  const full = { mode: 'full' };
  ok(fdec('Read', `${root}/.env`, full, 'bypassPermissions') === null, 'P4e AC1.3: full hiệu lực cho đọc .env');
  ok(fdec('Write', `${root}/x.pem`, full, 'bypassPermissions') === null, 'P4e AC1.3: full hiệu lực cho ghi khoá .pem');
  ok(fdec('Edit', `${root}/docs/a.md`, full, 'bypassPermissions', { agent_type: 'writer' })?.decision === 'deny', 'P4e AC1.3: full vẫn giữ writeScope (H5) ngoài phạm vi');
  ok(fdec('Edit', `${root}/src/a.js`, full, 'bypassPermissions', { agent_type: 'writer' }) === null, 'P4e AC1.3: full, trong writeScope → cho qua');
  ok(fdec('Read', `${root}/.env`, full, 'default')?.decision === 'deny', 'P4e AC1.5: full không hiệu lực → .env vẫn deny');
  ok(fdec('Read', `${root}/.env`, { mode: 'ask' }, 'bypassPermissions')?.decision === 'deny', 'P4e AC1.3: mode ask → .env vẫn deny');

  // Repo tạm thật: cấu hình phải theo repo chứa file đích, không theo cwd.
  const git = (cwd, ...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  const makeRepo = (dir, gate) => {
    fs.mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.name', 'aip-test');
    git(dir, 'config', 'user.email', 'aip-test@example.com');
    fs.writeFileSync(path.join(dir, 'README.md'), 'x');
    git(dir, 'add', 'README.md');
    git(dir, 'commit', '-q', '-m', 'init');
    if (gate) {
      fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.claude', 'aip-gate.json'), JSON.stringify(gate));
    }
  };
  const tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aip-p4e-')));
  try {
    const fullRepo = path.join(tmp, 'full');
    const plainRepo = path.join(tmp, 'plain');
    makeRepo(fullRepo, { mode: 'full' });
    makeRepo(plainRepo, null);
    const slash = (x) => x.replaceAll('\\', '/');
    const real = (input) => files.decide({ permission_mode: 'bypassPermissions', ...input }, { scopes: {} });

    ok(real({ tool_name: 'Read', tool_input: { file_path: slash(path.join(fullRepo, '.env')) }, cwd: plainRepo }) === null,
      'P4e AC1.3: cwd ở repo không full nhưng file đích thuộc repo full → cho qua');
    ok(real({ tool_name: 'Read', tool_input: { file_path: slash(path.join(plainRepo, '.env')) }, cwd: fullRepo })?.decision === 'deny',
      'P4e AC1.3: cwd ở repo full nhưng file đích thuộc repo không cấu hình → vẫn deny');
    ok(real({ tool_name: 'Write', tool_input: { file_path: slash(path.join(fullRepo, 'moi', 'k.pem')) }, cwd: plainRepo }) === null,
      'P4e AC1.3: file đích chưa tồn tại trong repo full vẫn đọc đúng cấu hình');
    ok(real({ tool_name: 'Grep', tool_input: { glob: '.env*', path: slash(fullRepo) }, cwd: plainRepo }) === null,
      'P4e AC1.3: Grep glob bí mật trong repo full hiệu lực → cho qua');
    ok(real({ tool_name: 'Grep', tool_input: { glob: '.env*', path: slash(plainRepo) }, cwd: fullRepo })?.decision === 'deny',
      'P4e AC1.3: Grep glob bí mật trong repo không full → deny');
    ok(files.decide({ tool_name: 'Grep', tool_input: { glob: '.env*' }, cwd: '.', permission_mode: 'bypassPermissions' }, { scopes: {}, config: { mode: 'full' } }) === null
      && files.decide({ tool_name: 'Grep', tool_input: { glob: '.env*' }, cwd: '.', permission_mode: 'default' }, { scopes: {}, config: { mode: 'full' } })?.decision === 'deny',
      'P4e AC1.3: Grep glob bí mật phụ thuộc full hiệu lực');

    const wt = path.join(tmp, 'wt');
    git(fullRepo, 'worktree', 'add', '-q', wt, '-b', 'p4e-wt');
    const g = readGate(path.join(wt, 'sub', 'chua-co'));
    ok(g?.config?.mode === 'full' && g.roots.length === 2 && new Set(g.roots).size === 2
      && g.roots.includes(path.resolve(wt)) && g.roots.includes(path.resolve(fullRepo)),
      'P4e AC1.1: readGate trong worktree trả cả gốc worktree và gốc repo chính');
    const own = readGate(path.join(fullRepo, 'x'));
    ok(own?.roots.length === 1 && own.roots[0] === path.resolve(fullRepo), 'P4e AC1.1: readGate repo thường loại trùng gốc');
    ok(readGate(plainRepo) === null, 'P4e AC1.1: readGate không có cấu hình → null');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  const bash = await load('guard-bash.mjs');
  const bdec = (command, config, pm) => bash.decide({ tool_name: 'Bash', tool_input: { command }, cwd: '.', ...(pm ? { permission_mode: pm } : {}) },
    { currentBranch: () => 'main', allowEnv: () => false, config });
  const fullCfg = { mode: 'full' };
  for (const c of ['rm -rf x', 'cat .env', 'curl http://x', 'git commit -m "có dấu"']) {
    ok(bdec(c, fullCfg, 'bypassPermissions') === null, `P4e AC1.2: guard-bash full cho qua: ${c}`);
  }
  ok(bdec('git commit -m "có dấu', fullCfg, 'bypassPermissions') === null, 'P4e AC1.2: full bỏ cả ASK_UNPARSABLE');
  for (const c of ['git push origin main', 'git push --force']) {
    ok(bdec(c, fullCfg, 'bypassPermissions')?.decision === 'ask', `P4e AC1.2: full vẫn hỏi push (fullKeep mặc định): ${c}`);
    ok(bdec(c, { mode: 'full', fullKeep: [] }, 'bypassPermissions') === null, `P4e AC1.2: fullKeep rỗng bỏ H1: ${c}`);
  }
  for (const pm of ['default', undefined]) {
    ok(bdec('cat .env', fullCfg, pm)?.decision === 'ask', `P4e AC1.5: guard-bash permission_mode=${pm} → .env vẫn ask`);
    ok(bdec('git commit -m "có dấu"', fullCfg, pm)?.decision === 'deny', `P4e AC1.5: guard-bash permission_mode=${pm} → commit non-ASCII vẫn deny`);
    ok(bdec('git push origin main', fullCfg, pm)?.decision === 'ask', `P4e AC1.5: guard-bash permission_mode=${pm} → push main vẫn ask`);
  }
}
