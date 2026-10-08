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
    ok(['cp .env.example .env.example.bak', 'cat config/.env.sample', 'cat id_rsa.pub', 'echo process.env'].every((c) => d(c) === null)
      && d('cat .envrc')?.decision === 'ask',
      'H3: .env.example/.env.sample/id_rsa.pub/process.env → cho qua; .envrc → ask (vòng sửa 1: .envrc là file bí mật)');
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
  // Vòng sửa 1: phủ rộng file bí mật, Grep, alias Windows, gốc git, glob không phân biệt hoa thường
  {
    const { pathToFileURL, execFileSync, CORE_DIR, REPO_ROOT, checkAgentTools, os } = ctx;
    const dir = path.join(CORE_DIR, 'hooks', 'scripts');
    const files = await import(pathToFileURL(path.join(dir, 'guard-files.mjs')).href);
    const bash = await import(pathToFileURL(path.join(dir, 'guard-bash.mjs')).href);
    const scopes = { 'spec-analyst': ['docs/**'], 'fx-tests': ['**/test/**'] };
    const opts = { scopes, repoRoot: '/repo', ignoreCase: false };
    const tool = (tool_name, tool_input, extra = {}) => files.decide({ tool_name, cwd: '/repo', tool_input, ...extra }, opts);
    const read = (f) => tool('Read', { file_path: f });
    const denied = ['certs/server.key', 'private.key', 'id_dsa', '.ssh/id_ed25519_sk', 'keys/key.ppk', 'creds/sa.p8', 'id_rsa.bak',
      'prod.env', 'config/app.env', '.envrc', 'credentials.yml', 'ID_RSA', 'a/.ENV'];
    ok(denied.every((f) => read(`/repo/${f}`)?.decision === 'deny'), `H3: ${denied.length} dạng file bí mật mở rộng (.key/.ppk/.p8/*.env/.envrc/id_*/credentials.yml/hoa thường) → deny`);
    const allowed = ['.env.example', 'config/.env.sample', 'id_rsa.pub', 'src/credentials.ts', 'process.env.js', 'src/env.ts', 'keys.md'];
    ok(allowed.every((f) => read(`/repo/${f}`) === null), 'H3: .env.example/.sample, id_rsa.pub, credentials.ts, process.env.js → cho qua');
    const b = (command) => bash.decide({ tool_name: 'Bash', cwd: '.', tool_input: { command } }, { currentBranch: () => 'feature/x' });
    ok(['cat .ENV', 'cat prod.env', 'cat config/app.env', 'cat .envrc', 'cat certs/server.key', 'cat id_rsa.bak', 'cat credentials.yml']
      .every((c) => b(c)?.decision === 'ask'), 'H3 Bash: .ENV/prod.env/.envrc/.key/id_rsa.bak/credentials.yml → ask');
    ok(['cat id_rsa.pub', 'cat .env.example', 'cat src/credentials.ts', 'ls'].every((c) => b(c) === null), 'H3 Bash: id_rsa.pub/.env.example/credentials.ts → cho qua');
    // Grep không được đọc lén file bí mật
    ok(tool('Grep', { pattern: 'x', path: '/repo/.env' })?.decision === 'deny' && tool('Grep', { pattern: 'x', glob: '.env*' })?.decision === 'deny'
      && tool('Grep', { pattern: 'x', glob: '*.env' })?.decision === 'deny' && tool('Grep', { pattern: 'x', glob: '*.pem' })?.decision === 'deny'
      && tool('Grep', { pattern: 'x', glob: '**/{*.ts,.env}' })?.decision === 'deny', 'H3 Grep: path/glob nhắm file bí mật → deny');
    ok(tool('Grep', { pattern: 'x', path: '/repo/src', glob: '*.ts' }) === null && tool('Grep', { pattern: 'x' }) === null
      && tool('Grep', { pattern: 'x', glob: '**/*' }) === null && tool('Grep', { pattern: 'x', glob: '.env.example' }) === null, 'H3 Grep: path/glob thường → cho qua');
    // Vòng sửa 2: glob thường không bị chặn nhầm; glob nhắm bí mật vẫn bị chặn
    const grepGlob = (glob) => tool('Grep', { pattern: 'x', glob });
    ok(['*.json', '**/*.json', '*.{ts,json}', '*.local', '*rc', 's*', 'p*', '*.{ts,tsx}', 'src/**/*.json'].every((x) => grepGlob(x) === null),
      'H3 Grep: glob thường (*.json, *.{ts,json}, *.local, *rc, s*, p*) → cho qua');
    ok(['.env*', '*.env', '*.pem', '**/.env', 'credentials.*', '*.key', 'id_*', '*.{ts,env}', '*.p12'].every((x) => grepGlob(x)?.decision === 'deny'),
      'H3 Grep: glob có từ khoá bí mật và khớp tên bí mật → deny');
    // UNC: chặn theo tên, không resolve thật (không chạm mạng)
    ok(files.decide({ tool_name: 'Read', cwd: '/repo', tool_input: { file_path: String.raw`\\fileserver\share\app\.env` } }, opts)?.decision === 'deny'
      && files.decide({ tool_name: 'Read', cwd: '/repo', tool_input: { file_path: '//fileserver/share/app/readme.md' } }, opts) === null, 'H3: đường UNC → quyết định theo tên');
    const hooks = JSON.parse(fs.readFileSync(path.join(CORE_DIR, 'hooks', 'hooks.json'), 'utf8'));
    ok(hooks.hooks.PreToolUse.some((g) => g.matcher.split('|').includes('Grep') && g.hooks[0].args[0].endsWith('guard-files.mjs')), 'hooks.json: matcher guard-files có Grep');
    // NotebookEdit / MultiEdit
    ok(tool('NotebookEdit', { notebook_path: '/repo/prod.env' })?.decision === 'deny', 'H3: NotebookEdit notebook_path bí mật → deny');
    ok(tool('MultiEdit', { file_path: '/repo/src/a.js' }, { agent_type: 'spec-analyst' })?.decision === 'deny'
      && tool('NotebookEdit', { notebook_path: '/repo/n.ipynb' }, { agent_type: 'spec-analyst' })?.decision === 'deny'
      && tool('MultiEdit', { file_path: '/repo/docs/a.md' }, { agent_type: 'spec-analyst' }) === null, 'H5: MultiEdit/NotebookEdit ngoài scope → deny, trong scope → cho qua');
    const script = path.join(dir, 'guard-files.mjs');
    ok(execFileSync('node', [script], { input: '{}', encoding: 'utf8' }) === '', 'guard-files CLI: {} → exit 0, không in gì');
    // Alias Windows: luồng NTFS + dấu chấm cuối
    const ads = String.raw`C:\repo\.env::$DATA`;
    ok(files.decide({ tool_name: 'Read', cwd: '/repo', tool_input: { file_path: ads } }, opts)?.decision === 'deny'
      && files.decide({ tool_name: 'Read', cwd: '/repo', tool_input: { file_path: String.raw`C:\repo\.env:stream` } }, opts)?.decision === 'deny'
      && read('/repo/.env.') ?.decision === 'deny', 'H3: .env::$DATA / .env:stream / .env. (alias NTFS) → deny');
    // Symlink / junction tên vô hại trỏ tới file bí mật
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-guard-'));
    try {
      const real = path.join(tmp, 'real', 'prod.env');
      fs.mkdirSync(real, { recursive: true });
      const link = path.join(tmp, 'link.txt');
      let linked = false;
      try { fs.symlinkSync(real, link, 'junction'); linked = true; } catch { /* máy không cho tạo symlink/junction → bỏ nhánh này */ }
      if (linked) {
        ok(files.decide({ tool_name: 'Read', cwd: tmp, tool_input: { file_path: 'link.txt' } }, opts)?.decision === 'deny', 'H3: symlink/junction tên vô hại trỏ tới file bí mật → deny (realpath)');
        fs.unlinkSync(link);
      }
      const plain = path.join(tmp, 'plain.txt');
      fs.writeFileSync(plain, 'x');
      ok(files.decide({ tool_name: 'Read', cwd: tmp, tool_input: { file_path: 'plain.txt' } }, opts) === null, 'H3: file thường tồn tại → cho qua');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    // Gốc repo = git toplevel, không phải cwd
    ok(files.decide({ tool_name: 'Write', cwd: '/repo/docs', agent_type: 'spec-analyst', tool_input: { file_path: '/repo/docs/a.md' } }, opts) === null
      && files.decide({ tool_name: 'Write', cwd: '/repo/docs', agent_type: 'spec-analyst', tool_input: { file_path: '/repo/src/a.js' } }, opts)?.decision === 'deny',
      'H5: cwd là thư mục con, repoRoot neo scope theo gốc repo');
    if (fs.existsSync(path.join(REPO_ROOT, '.git'))) {
      ok(files.decide({ tool_name: 'Write', cwd: path.join(REPO_ROOT, 'core'), agent_type: 'spec-analyst', tool_input: { file_path: path.join(REPO_ROOT, 'docs', 'a.md') } },
        { scopes, ignoreCase: false }) === null, 'H5: không inject repoRoot → lấy từ git rev-parse --show-toplevel');
    }
    // Glob không phân biệt hoa thường (Windows)
    ok(files.globToRegExp('docs/**', { ignoreCase: true }).test('DOCS/a.md') && !files.globToRegExp('docs/**').test('DOCS/a.md')
      && files.decide({ tool_name: 'Write', cwd: '/repo', agent_type: 'spec-analyst', tool_input: { file_path: '/repo/DOCS/a.md' } }, { ...opts, ignoreCase: true }) === null
      && files.decide({ tool_name: 'Write', cwd: '/repo', agent_type: 'spec-analyst', tool_input: { file_path: '/repo/DOCS/a.md' } }, opts)?.decision === 'deny',
      'H5: ignoreCase bật → DOCS/ khớp docs/**, tắt → deny');
    // Cú pháp glob của writeScope
    const g = (writeScope) => checkAgentTools({ mode: 'write', skills: [], tools: [], writeScope });
    ok(['./docs/**', '/docs/**', '../x/**', 'a\\b', 'a.{ts,js}', 'a?.md'].every((x) => g([x]).length === 1)
      && g(['docs/**', '**/test/**', 'playwright.config.*', 'CHANGELOG.md']).length === 0, 'checkAgentTools: glob writeScope bắt đầu ./ / .. hoặc chứa \\ { ? → lỗi');
  }
  // Vòng sửa cuối: PowerShell, cd tracking, neo gốc repo theo file đích
  {
    const { pathToFileURL, CORE_DIR, os, execFileSync } = ctx;
    const dir = path.join(CORE_DIR, 'hooks', 'scripts');
    const bash = await import(pathToFileURL(path.join(dir, 'guard-bash.mjs')).href);
    const files = await import(pathToFileURL(path.join(dir, 'guard-files.mjs')).href);
    const hooks = JSON.parse(fs.readFileSync(path.join(CORE_DIR, 'hooks', 'hooks.json'), 'utf8'));
    const bashGroup = hooks.hooks.PreToolUse.find((g) => g.hooks[0].args[0].endsWith('guard-bash.mjs'));
    ok(bashGroup && bashGroup.matcher.split('|').includes('Bash') && bashGroup.matcher.split('|').includes('PowerShell'), 'F1: matcher guard-bash phủ cả Bash và PowerShell');
    const ps = (command, br = 'feature/x') => bash.decide({ tool_name: 'PowerShell', cwd: '.', tool_input: { command } }, { currentBranch: () => br });
    ok(ps('git push origin main')?.decision === 'ask' && ps('git commit -m "sửa"')?.decision === 'deny' && ps('git commit -F msg.txt') === null,
      'F1: decide() với tool_name PowerShell: push main → ask, commit -m có dấu → deny, -F → cho qua');
    // F2: cd/pushd/Set-Location đổi thư mục làm việc trước khi push
    const root = path.resolve('.');
    const repoDir = path.resolve(root, 'repo');
    const inRepo = { currentBranch: (d) => (d === repoDir ? 'main' : 'feature/x') };
    const cd = (command) => bash.decide({ tool_name: 'Bash', cwd: root, tool_input: { command } }, inRepo);
    ok(cd('cd repo && git push')?.decision === 'ask' && cd('cd repo; git push origin HEAD')?.decision === 'ask'
      && cd('pushd repo && git push origin @')?.decision === 'ask' && cd('Set-Location repo; git push')?.decision === 'ask'
      && cd('sl -Path repo; git push')?.decision === 'ask' && cd('cd /d repo && git push')?.decision === 'ask'
      && cd('cd repo && cd .. && git push') === null,
      'F2: cd/pushd/Set-Location <repo trên main> rồi git push → ask; cd ra ngoài lại → theo nhánh cwd');
    ok(cd('cd repo && git push origin feature/x') === null && cd('git push origin HEAD') === null && cd('cd other && git push') === null,
      'F2: cd repo && push nhánh feature → không quyết định; cd thư mục khác → theo nhánh của thư mục đó');
    ok(['cd $REPO && git push', 'cd ~/repo; git push origin HEAD', 'cd - && git push', 'cd && git push', 'cd `pwd` ; git push'].every((c) => cd(c)?.decision === 'ask')
      && cd('cd $REPO && git push origin feature/x') === null,
      'F2: cd target chứa $/~/backtick/- hoặc trống, push không refspec/HEAD → ask; refspec tường minh feature → cho qua');
    // PowerShell: backtick là escape/nối dòng, được chuẩn hoá trước khi tách đoạn (xem khối N2 bên dưới)
    ok(ps('Set-Location repo; git push origin HEAD', 'feature/x') === null, 'F1: PowerShell Set-Location theo nhánh thật của thư mục');
    // Vòng sửa residual N3: alias Push-Location, `--`, và trạng thái cd không được mang qua `||` / `|`
    const featOnRepo = { currentBranch: (d) => (d === repoDir ? 'feature/x' : 'main') };
    const cdMain = (command) => bash.decide({ tool_name: 'Bash', cwd: root, tool_input: { command } }, featOnRepo);
    ok(cd('Push-Location repo; git push')?.decision === 'ask' && cd('push-location repo && git push origin HEAD')?.decision === 'ask'
      && cd('Push-Location -Path repo; git push')?.decision === 'ask' && cd('pushd -- repo && git push')?.decision === 'ask'
      && cd('chdir repo && git push')?.decision === 'ask' && cd('Push-Location repo; git push origin feature/x') === null,
      'N3: Push-Location/pushd/chdir (kể cả -Path, --) rồi git push → tra nhánh của repo đích');
    ok(cd('cd -- repo && git push')?.decision === 'ask' && cd('Set-Location -- repo; git push')?.decision === 'ask' && cd('cd -- other && git push') === null,
      'N3: `cd -- repo` bỏ qua `--`, không resolve thành thư mục "--"');
    ok(cdMain('cd repo || git push')?.decision === 'ask' && cdMain('cd repo || git push origin HEAD')?.decision === 'ask'
      && cdMain('cd repo | git push')?.decision === 'ask' && cdMain('cd repo && git push') === null
      && cdMain('cd repo || git push origin feature/x') === null && cd('git status || git push') === null,
      'N3: sau `||`/`|` cd có thể chưa xảy ra → không tin nhánh repo, push không refspec/HEAD → ask; `&&` và không cd → giữ nguyên');
    ok(cd('popd && git push')?.decision === 'ask' && cd('Pop-Location; git push origin HEAD')?.decision === 'ask'
      && cd('popd && git push origin feature/x') === null, 'N3: popd/Pop-Location không biết thư mục đích → như cd không resolve được');
    // Vòng sửa residual N2: tool PowerShell chuẩn hoá nối dòng bằng backtick và escape backtick trước khi tách lệnh
    const psMain = (command) => bash.decide({ tool_name: 'PowerShell', cwd: '.', tool_input: { command } }, { currentBranch: () => 'feature/x' });
    ok(psMain('git push origin `\nmain')?.decision === 'ask' && psMain('git push origin `\r\n  main')?.decision === 'ask'
      && psMain('git push origin ma`in')?.decision === 'ask' && psMain('git `push origin main')?.decision === 'ask'
      && psMain('git push origin feature/x') === null && psMain('git push `\n  -u origin feature/x') === null,
      'N2: PowerShell nối dòng bằng backtick / escape `ma`in` vẫn bị bắt như `git push origin main`');
    ok(psMain('git commit -m "say `"hi`" sửa"')?.decision === 'deny' && psMain('cat .en`v')?.decision === 'ask',
      'N2: PowerShell escape backtick không che commit -m có dấu hay file .env');
    // F5: gốc git theo file đích, không theo cwd của phiên
    const w = path.resolve('/repo/.worktrees/x');
    const rootOf = (d) => (path.relative(w, d).startsWith('..') ? path.resolve('/repo') : w);
    const scopes = { 'spec-analyst': ['docs/**'] };
    const wt = (file) => files.decide({ tool_name: 'Write', cwd: '/repo', agent_type: 'spec-analyst', tool_input: { file_path: file } }, { scopes, rootOf, ignoreCase: false });
    ok(wt('/repo/.worktrees/x/docs/a.md') === null && wt('/repo/.worktrees/x/src/a.js')?.decision === 'deny' && wt('/repo/docs/a.md') === null,
      'F5: gốc scope = gốc git của file đích (worktree lồng trong cwd) → docs/** khớp trong worktree');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-root-'));
    try {
      const other = path.join(tmp, 'other');
      const repo = path.join(tmp, 'repo');
      fs.mkdirSync(other, { recursive: true });
      fs.mkdirSync(repo);
      execFileSync('git', ['init', '-q', repo]);
      const real = (cwd, file) => files.decide({ tool_name: 'Write', cwd, agent_type: 'spec-analyst', tool_input: { file_path: file } }, { scopes, ignoreCase: false });
      ok(real(other, path.join(repo, 'docs', 'new', 'a.md')) === null && real(other, path.join(repo, 'src', 'a.js'))?.decision === 'deny',
        'F5: cwd ngoài repo, file đích trong repo (thư mục chưa tồn tại) → neo theo gốc git của đích qua git rev-parse');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}
