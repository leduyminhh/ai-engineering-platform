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

  // H6: nhốt công cụ file trong root khi full hiệu lực.
  const tmp6 = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aip-p4e-h6-')));
  try {
    const slash6 = (x) => x.replaceAll('\\', '/');
    const proj = slash6(path.join(tmp6, 'proj'));
    const extra = slash6(path.join(tmp6, 'extra'));
    const scratch = slash6(path.join(tmp6, 'scratch'));
    const elsewhere = slash6(path.join(tmp6, 'elsewhere'));
    const cfg6 = { mode: 'full', fullRoots: [extra] };
    const h6 = (tool, file, { config = cfg6, pm = 'bypassPermissions', cwd = proj } = {}) => files.decide(
      { tool_name: tool, tool_input: { file_path: file }, cwd, permission_mode: pm, scratchpad_dir: scratch },
      { scopes: {}, repoRoot: proj, allowEnv: () => false, config });
    for (const tool of ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']) {
      for (const f of [`${proj}/a.txt`, `${proj}/x/../b.txt`, `${scratch}/t`, `${extra}/z.txt`]) {
        ok(h6(tool, f) === null, `P4e AC1.6: ${tool} trong root cho qua: ${f.slice(tmp6.length)}`);
      }
      for (const f of [`${proj}/../c.txt`, '/etc/x', 'C:\\Windows\\x', '\\\\srv\\share\\x']) {
        const d = h6(tool, f);
        ok(d?.decision === 'deny' && d.reason.includes('fullRoots'), `P4e AC1.6: ${tool} ngoài root → deny nhắc fullRoots: ${f.slice(-12)}`);
      }
    }
    ok(h6('Write', 'rel.txt', { cwd: elsewhere })?.decision === 'deny', 'P4e AC1.6: cwd ngoài root + đường dẫn tương đối → deny');
    for (const tool of ['Read', 'Grep']) {
      ok(h6(tool, `${proj}/a.txt`) === null && h6(tool, `${extra}/a.txt`) === null, `P4e AC1.6: ${tool} trong root → cho qua`);
      ok(h6(tool, '/etc/x')?.decision === 'ask' && h6(tool, `${proj}/../c.txt`)?.decision === 'ask', `P4e AC1.6: ${tool} ngoài root → ask`);
    }
    ok(files.decide({ tool_name: 'Grep', tool_input: { glob: '*.js' }, cwd: proj, permission_mode: 'bypassPermissions' }, { scopes: {}, repoRoot: proj, config: cfg6 }) === null,
      'P4e AC1.6: Grep thiếu path → bỏ qua H6');
    ok(h6('Write', '$HOME/x')?.decision === 'ask' && h6('Read', '~/x')?.decision === 'ask', 'P4e AC1.6: đường dẫn có $ hoặc ~ → ask');
    ok(h6('Write', '/etc/x', { pm: 'default' }) === null && h6('Write', '/etc/x', { config: { mode: 'ask' } }) === null
      && h6('Write', '/etc/x', { config: {} }) === null, 'P4e AC1.6: full không hiệu lực → không có H6');
    ok(h6('Bash', '/etc/x') === null, 'P4e AC1.6: công cụ ngoài Read/Grep/ghi → không có H6');
    ok(h6('Write', `${proj}/../.env`)?.decision === 'deny' && h6('Read', `${proj}/.env`) === null,
      'P4e AC1.6: full bỏ qua secret nhưng .env ngoài root vẫn bị H6 chặn, trong root cho qua');
  } finally {
    fs.rmSync(tmp6, { recursive: true, force: true });
  }

  // H6 của guard-bash: nhốt lệnh ghi/xoá trong root khi full hiệu lực.
  const tmp7 = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aip-p4e-h6b-')));
  try {
    const proj = path.join(tmp7, 'proj').replaceAll('\\', '/');
    const extra7 = path.join(tmp7, 'extra').replaceAll('\\', '/');
    const scratch = path.join(tmp7, 'scratch').replaceAll('\\', '/');
    const h6b = (command, { config = { mode: 'full' }, pm = 'bypassPermissions' } = {}) => bash.decide(
      { tool_name: 'Bash', tool_input: { command }, cwd: proj, permission_mode: pm, scratchpad_dir: scratch },
      { currentBranch: () => 'feature/x', allowEnv: () => false, config, repoRoot: proj });
    const table = {
      deny: ['echo a>/tmp/x', 'echo a>>/tmp/x', 'cmd 2>/tmp/x', 'echo a>"/tmp/x y"', 'rm -rf ../x', 'rm /etc/x', 'mv a /tmp/b', 'echo x > /tmp/y', 'del C:\\Windows\\x', 'cd /tmp && rm x', 'rm a; rm /etc/b',
        'rm -rf $X; rm /etc/b', 'cp a /tmp/b', 'rm /etc/x "unclosed', 'rm a; rm /etc/b && echo "$(x'],
      ask: ['rm -rf $X', 'rm -rf ~', 'rm -rf *', 'bash -c "rm /x"'],
      pass: ['echo a>out.txt', "awk '$1>2' f", 'echo "a>/tmp/x"', 'git commit -m "a > b"', 'echo "x > y"', 'echo a >&2', 'rm -rf build', 'mv a b', 'echo x > out.txt', 'cp /etc/hosts here.txt', 'echo x > /dev/null', 'cmd 2>&1', 'echo x >>out.log',
        'ls /tmp', 'echo x > "x y"', 'rm -rf src/*.js', 'rd /s /q build', 'touch a 2>/dev/null', `mv a ${scratch}/b`, 'cd sub && rm x'],
    };
    for (const [want, cmds] of Object.entries(table)) {
      for (const c of cmds) {
        const d = h6b(c);
        const got = d ? d.decision : 'pass';
        ok(got === want, `P4e AC1.7: guard-bash "${c}" → ${want} (got ${got})`);
      }
    }
    ok(h6b('rm /etc/x', { pm: 'default' }) === null && h6b('rm /etc/x', { config: { mode: 'ask' } }) === null,
      'P4e AC1.7: full không hiệu lực → rm /etc/x không bị H6');
    ok(h6b(`rm ${extra7}/x`, { config: { mode: 'full', fullRoots: [extra7] } }) === null, 'P4e AC1.7: fullRoots mở rộng root cho lệnh bash');
    ok(h6b('git push origin main')?.decision === 'ask' && h6b('git push origin main; rm /etc/x')?.decision === 'ask',
      'P4e AC1.7: H1 (push) đứng trước H6');
  } finally {
    fs.rmSync(tmp7, { recursive: true, force: true });
  }
}

