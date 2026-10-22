// Contract chế độ quyền ask/full (P4e): effectiveMode, guard-mcp, guard-files.
export default async function run({ ok, ctx }) {
  const { path, pathToFileURL, CORE_DIR } = ctx;
  const scripts = path.join(CORE_DIR, 'hooks', 'scripts');
  const load = (n) => import(pathToFileURL(path.join(scripts, n)).href);
  const { effectiveMode, fullKeep, fullRoots } = await load('gate-config.mjs');
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
}
