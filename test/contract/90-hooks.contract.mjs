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
  {
    const { pathToFileURL, execFileSync, CORE_DIR } = ctx;
    const script = path.join(CORE_DIR, 'hooks', 'scripts', 'guard-bash.mjs');
    const { decide } = await import(pathToFileURL(script).href);
    const on = (branch) => ({ currentBranch: () => branch });
    const bash = (command) => ({ tool_name: 'Bash', cwd: '.', tool_input: { command } });
    const d = (cmd, br = 'feature/x') => decide(bash(cmd), on(br));
    ok(d('git push origin main')?.decision === 'ask', 'H1: push main → ask');
    ok(d('git add . && git push origin develop')?.decision === 'ask', 'H1: lệnh ghép push develop → ask');
    ok(d('git -C repo push origin master')?.decision === 'ask', 'H1: git -C … push master → ask');
    ok(d('git push origin HEAD', 'main')?.decision === 'ask' && d('git push', 'dev')?.decision === 'ask', 'H1: HEAD/không refspec khi đang ở nhánh bảo vệ → ask');
    ok(d('git push origin feature:main')?.decision === 'ask', 'H1: src:dst vào main → ask');
    ok(d('git push --force origin feature/x')?.decision === 'ask' && d('git push origin +feature/x')?.decision === 'ask'
      && d('git push origin --delete feature/x')?.decision === 'ask', 'H1: force/+ref/delete → ask');
    ok(d('git push -u origin feature/x') === null && d('git push') === null, 'H1: push nhánh feature → không quyết định');
    ok(d('git commit -m "sửa lỗi"')?.decision === 'deny' && d('git commit -m "fix bug"') === null && d('git commit -F msg.txt') === null,
      'H2: -m có dấu → deny; -m ASCII và -F → cho qua');
    ok(d('cat .env')?.decision === 'ask' && d('source ./.env.local')?.decision === 'ask' && d('cat certs/server.pem')?.decision === 'ask',
      'H3: Bash đụng file bí mật → ask');
    ok(d('cp .env.example .env.example.bak') === null && d('ls -la') === null, 'H3: .env.example và lệnh thường → cho qua');
    // Vòng sửa 1: các dạng lách cổng đã biết
    const heredoc = ['git commit -m "$(cat <<\'EOF\'', 'feat: x', '', 'sửa lỗi', 'EOF', ')"'].join('\n');
    ok(['git commit -am "sửa lỗi"', 'git commit -qm "sửa lỗi"', 'git commit -m"sửa lỗi"', 'git commit -m "fix; sửa"', heredoc, 'git commit --message="sửa"', 'git commit --message "sửa"']
      .every((c) => d(c)?.decision === 'deny'), 'H2: -am/-qm/-m"…"/dấu ; trong message/heredoc/--message → deny');
    ok(d('git commit -m "fix" -- tài-liệu.md') === null && d('git commit -F msg.txt') === null && d('git commit -am "fix"') === null,
      'H2: non-ASCII chỉ ở path sau --, -F, -am ASCII → cho qua');
    ok(['git push origin "main"', "git push origin 'main'", 'git push -fu origin feature/x', 'git push -uf origin feature/x', 'git push -d origin feature/x', 'git push --prune origin']
      .every((c) => d(c)?.decision === 'ask'), 'H1: ref có nháy, cụm cờ -fu/-uf/-d, --prune → ask');
    ok(d('git --git-dir .git push origin main')?.decision === 'ask' && d('git --work-tree . --namespace x push origin main')?.decision === 'ask',
      'H1: --git-dir/--work-tree/--namespace tách token không làm lạc subcommand');
    ok(d('git push -o ci.skip origin', 'main')?.decision === 'ask' && d('git push --push-option ci.skip origin', 'main')?.decision === 'ask'
      && d('git push origin @', 'main')?.decision === 'ask' && d('git push -o ci.skip origin', 'feature/x') === null,
      'H1: -o/--push-option bỏ qua giá trị; @ = HEAD');
    const repoDir = path.resolve('.', 'repo');
    const inRepo = { currentBranch: (dir) => (dir === repoDir ? 'main' : 'feature/x') };
    ok(decide(bash('git -C repo push origin HEAD'), inRepo)?.decision === 'ask' && decide(bash('git push origin HEAD'), inRepo) === null,
      'H1: -C <dir> → tra nhánh của repo đích (so với cwd)');
    ok(['cat .env;echo', 'cat <.env', 'source .env&&npm start', 'echo $(cat .env)', 'type certs\\server.pem', 'cat ..\\.env']
      .every((c) => d(c)?.decision === 'ask'), 'H3: .env sau ;/</&&/$()/dấu backslash → ask');
    ok(['cp .env.example .env.example.bak', 'cat config/.env.sample', 'cat id_rsa.pub', 'cat .envrc', 'echo process.env'].every((c) => d(c) === null),
      'H3: .env.example/.env.sample/id_rsa.pub/.envrc/process.env → cho qua');
    // Vòng sửa 2: nháy lẻ không được che lệnh phía sau; parse không tin cậy → nghiêng về an toàn
    ok(["cat > n.txt <<'EOF'\ndon't\nEOF\ngit push origin main", "git commit -F - <<'EOF'\nfeat: don't\nEOF\ngit push origin main",
      "git status # don't\ngit push origin main", "echo don\\'t && git push origin main", 'echo "C:\\\\" && git push origin main']
      .every((c) => d(c)?.decision === 'ask'), 'H1: nháy lẻ (heredoc/#/\\\'/\\\\ trước nháy đóng) không che push main → ask');
    const oddQuote = ['git commit -m "$(cat <<\'EOF\'', 'feat: x', '', 'fix "x', 'sửa lỗi', 'EOF', ')"'].join('\n');
    ok(d(oddQuote)?.decision === 'ask', 'H2: số nháy " lẻ trong heredoc + non-ASCII → ask (không phân tích chắc chắn)');
    ok(d("cat > m.txt <<'EOF'\nsửa don't\nEOF\ngit commit -F m.txt && python -m pytest") === null
      && d("git commit -F - <<'EOF'\nfeat(core): guard\n\n- chặn commit -m có dấu, don't\nEOF") === null,
      'H2: đường -F có nháy lẻ + non-ASCII trong thân → không chặn');
    {
      const adversarial = '"é ' + 'git '.repeat(32000);
      const t0 = Date.now();
      d(adversarial);
      ok(Date.now() - t0 < 500, `decide trên input ${adversarial.length} ký tự chạy < 500 ms (tuyến tính)`);
    }
    ok(d('git -C "$VAR" push')?.decision === 'ask' && d('git -C ~/repo push')?.decision === 'ask' && d('git -C $(pwd) push')?.decision === 'ask',
      'H1: -C chứa $/~ không resolve được, không refspec → ask');
    ok(d('git --config-env x=y push origin main')?.decision === 'ask', 'H1: --config-env bỏ qua giá trị → ask');
    ok(['git log --oneline', 'npm test', 'echo "a; b"', 'git commit -m "fix: a && b"', 'git status && git diff', 'git push -u origin feature/x']
      .every((c) => d(c) === null), 'không báo nhầm: log/npm test/echo "a; b"/commit -m "…&&…"/status && diff/push -u feature');
    const run = (stdin) => execFileSync('node', [script], { input: stdin, encoding: 'utf8' });
    ok(run('') === '' && run('{bad json') === '' && run('{}') === '', 'guard-bash CLI: input rỗng/hỏng → exit 0, không in gì (fail-open)');
    const out = JSON.parse(run(JSON.stringify(bash('git commit -m "thêm"'))) || '{}');
    ok(out.hookSpecificOutput?.hookEventName === 'PreToolUse' && out.hookSpecificOutput?.permissionDecision === 'deny'
      && /-F/.test(out.hookSpecificOutput?.permissionDecisionReason || ''), 'guard-bash CLI: in JSON hookSpecificOutput deny + hướng dẫn -F');
  }
  {
    const { pathToFileURL, execFileSync, CORE_DIR, claudeAdapter, fxPlugin, fxAgent, fxCore, fxMk, byPath, allAgents } = ctx;
    const script = path.join(CORE_DIR, 'hooks', 'scripts', 'guard-files.mjs');
    const { decide, globToRegExp } = await import(pathToFileURL(script).href);
    const scopes = { 'fx-writer': ['docs/**', 'CHANGELOG.md'], 'fx-tests': ['**/test/**', '**/*.test.*'] };
    const call = (tool, file, agent) => decide({ tool_name: tool, cwd: '/repo', agent_type: agent, tool_input: { file_path: file } }, { scopes });
    ok(call('Read', '/repo/.env')?.decision === 'deny' && call('Edit', '/repo/app/.env.local')?.decision === 'deny'
      && call('Read', '/repo/certs/server.pem')?.decision === 'deny', 'H3: tool file đụng .env/.env.local/.pem → deny');
    ok(call('Read', '/repo/.env.example') === null && call('Read', '/repo/config/.env.sample') === null
      && call('Read', '/repo/keys/id_rsa.pub') === null, 'H3: .env.example/.sample và khoá public → cho qua');
    ok(call('Write', '/repo/docs/a.md', 'fx-writer') === null && call('Write', '/repo/CHANGELOG.md', 'plugin:fx-writer') === null,
      'H5: ghi trong writeScope (kể cả agent_type có tiền tố plugin:) → cho qua');
    ok(call('Write', '/repo/src/a.js', 'fx-writer')?.decision === 'deny' && call('Write', '/other/x.md', 'fx-writer')?.decision === 'deny',
      'H5: ghi ngoài writeScope (kể cả ngoài repo) → deny');
    ok(call('Write', '/repo/src/test/A.java', 'fx-tests') === null && call('Write', '/repo/web/a.test.ts', 'fx-tests') === null
      && call('Edit', '/repo/src/a.ts', 'fx-tests')?.decision === 'deny', 'H5: glob test cho test-writer');
    ok(call('Read', '/repo/src/a.js', 'fx-writer') === null, 'H5: chỉ khoá ghi, không khoá đọc');
    ok(call('Write', '../x.md', 'fx-writer')?.decision === 'deny' && call('Write', 'docs/../src/a.js', 'fx-writer')?.decision === 'deny'
      && call('Write', 'docs/a.md', 'fx-writer') === null, 'H5: đường dẫn tương đối và ../ được chuẩn hoá theo cwd');
    ok(call('Write', '/repo/src/a.js') === null && call('Write', '/repo/src/a.js', 'khac') === null,
      'H5: phiên chính hoặc agent không có writeScope → không khoá');
    ok(globToRegExp('**/test/**').test('test/a.java') && !globToRegExp('docs/*').test('docs/a/b.md'), 'globToRegExp: **/ và *');
    const run = (stdin) => execFileSync('node', [script], { input: stdin, encoding: 'utf8' });
    ok(run('') === '' && run('nope') === '', 'guard-files CLI: input hỏng → exit 0, không in gì');
    const ag = { ...fxAgent, id: 'fx-writer', mode: 'write', writeScope: ['docs/**'] };
    const out = byPath(claudeAdapter.build([{ ...fxPlugin, agents: [ag] }], { marketplace: fxMk, core: { ...fxCore, hooksDir: path.join(CORE_DIR, 'hooks') } }));
    const lock = JSON.parse((out.get('plugins/core/hooks/scope-lock.json') || { content: '{}' }).content);
    ok(JSON.stringify(lock['fx-writer']) === '["docs/**"]', 'adapter: sinh scope-lock.json từ writeScope');
    ok(!(out.get('plugins/fx/agents/fx-writer.md') || { content: '' }).content.includes('writeScope'), 'adapter: không ghi writeScope vào agent .md');
    const { checkAgentTools } = ctx;
    ok(checkAgentTools({ mode: 'read-only', skills: [], tools: [], writeScope: ['docs/**'] }).length === 1
      && checkAgentTools({ mode: 'write', skills: [], tools: [], writeScope: ['docs/**'] }).length === 0, 'checkAgentTools: writeScope chỉ cho agent mode write');
    const scoped = allAgents.filter((a) => a.writeScope.length);
    ok(scoped.length === 5 && scoped.every((a) => a.mode === 'write'), '5 agent ghi có writeScope (H5)');
  }
}
