// Contract Phase 3: hook plugin (nguồn hợp lệ, ship sang build Claude, không lọt sang provider khác / skills-mode).
export default async function run({ ok, ctx }) {
  const { fs, path, core, plugins, BUILD, claudeDir, checkHooksJson, HOOK_EVENTS } = ctx;
  ok(HOOK_EVENTS.includes('PreToolUse'), 'HOOK_EVENTS có PreToolUse');
  ok(checkHooksJson({ hooks: { Foo: [] } }, { scriptsExist: () => true }).some((e) => e.includes('Foo')), 'checkHooksJson: event lạ → lỗi');
  ok(checkHooksJson({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'bash', args: ['x'] }] }] } },
    { scriptsExist: () => true }).length >= 1, 'checkHooksJson: command khác node → lỗi');
  ok(checkHooksJson({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node',
    args: ['${CLAUDE_PLUGIN_ROOT}/hooks/scripts/missing.mjs'], timeout: 10 }] }] } }, { scriptsExist: () => false }).length === 1,
    'checkHooksJson: script không tồn tại → lỗi');
  const units = [core, ...plugins].filter((u) => u.hooksDir);
  ok(units.some((u) => u.id === 'core'), 'core có hooks/');
  for (const u of units) {
    const obj = JSON.parse(fs.readFileSync(path.join(u.hooksDir, 'hooks.json'), 'utf8'));
    const errs = checkHooksJson(obj, { scriptsExist: (rel) => fs.existsSync(path.join(u.hooksDir, rel)) });
    ok(errs.length === 0, `${u.id}: hooks.json hợp lệ${errs.length ? ' — ' + errs.join('; ') : ''}`);
    if (fs.existsSync(claudeDir)) {
      ok(fs.existsSync(path.join(claudeDir, 'plugins', u.id, 'hooks', 'hooks.json')), `build claude ${u.id}: ship hooks/hooks.json`);
      ok(!fs.existsSync(path.join(BUILD, 'codex', u.id, 'hooks')) && !fs.existsSync(path.join(BUILD, 'cursor', u.id, 'hooks')),
        `${u.id}: hook không lọt sang codex/cursor`);
    }
  }
}
