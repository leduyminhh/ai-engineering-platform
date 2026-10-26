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
    const bom = JSON.parse(run('﻿' + JSON.stringify(bash('git push origin main'), null, 2) + '\r\n') || '{}');
    ok(bom.hookSpecificOutput?.permissionDecision === 'ask', 'guard-bash CLI: stdin có BOM + CRLF vẫn đọc được → ask');
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
    const bomOut = JSON.parse(run('﻿' + JSON.stringify({ tool_name: 'Read', cwd: '/repo', tool_input: { file_path: '/repo/.env' } })) || '{}');
    ok(bomOut.hookSpecificOutput?.permissionDecision === 'deny', 'guard-files CLI: stdin có BOM vẫn đọc được → deny');
    const ag = { ...fxAgent, id: 'fx-writer', mode: 'write', writeScope: ['docs/**'] };
    const out = byPath(claudeAdapter.build([{ ...fxPlugin, agents: [ag] }], { marketplace: fxMk, core: { ...fxCore, hooksDir: path.join(CORE_DIR, 'hooks') } }));
    const lock = JSON.parse((out.get('plugins/core/hooks/scope-lock.json') || { content: '{}' }).content);
    ok(JSON.stringify(lock['fx-writer']) === '["docs/**"]', 'adapter: sinh scope-lock.json từ writeScope');
    ok(!(out.get('plugins/fx/agents/fx-writer.md') || { content: '' }).content.includes('writeScope'), 'adapter: không ghi writeScope vào agent .md');
    const { checkAgentTools } = ctx;
    ok(checkAgentTools({ mode: 'read-only', skills: [], tools: [], writeScope: ['docs/**'] }).length === 1
      && checkAgentTools({ mode: 'write', skills: [], tools: [], writeScope: ['docs/**'] }).length === 0, 'checkAgentTools: writeScope chỉ cho agent mode write');
    const scoped = allAgents.filter((a) => a.writeScope.length);
    ok(scoped.length === 4 && scoped.every((a) => a.mode === 'write'), '4 agent ghi có writeScope (H5)');
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
  {
    const { pathToFileURL, execFileSync, CORE_DIR } = ctx;
    const script = path.join(CORE_DIR, 'hooks', 'scripts', 'gate-stop.mjs');
    const gate = await import(pathToFileURL(script).href);
    const line = (o) => JSON.stringify(o);
    const human = (text) => line({ type: 'user', message: { role: 'user', content: text } });
    const meta = (text) => line({ type: 'user', isMeta: true, message: { role: 'user', content: [{ type: 'text', text }] } });
    const use = (name, input) => line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't' + Math.random(), name, input }] } });
    const result = () => line({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }] } });
    const run = (lines, { input = {}, cfg = null, env = {} } = {}) => gate.decide(
      { hook_event_name: 'Stop', stop_hook_active: false, transcript_path: 'T', cwd: '.', ...input },
      { readFile: () => lines.join('\n'), loadConfig: () => cfg, env });
    const edit = (p) => use('Edit', { file_path: p, old_string: 'a', new_string: 'b' });
    const bash = (command) => use('Bash', { command });
    const blocked = (r) => r?.decision === 'block';

    const r1 = run([human('sửa'), edit('src/a.js'), edit('src/b.ts'), edit('src/c.py'), edit('src/d.go'), result()]);
    ok(blocked(r1) && r1.reason.includes('4') && ['src/a.js', 'src/b.ts', 'src/c.py'].every((p) => r1.reason.includes(p)) && !r1.reason.includes('src/d.go'),
      'AC1.1: sửa 4 file code không test → block, nêu số file và tối đa 3 đường dẫn');
    ok(blocked(run([human('x'), use('Write', { file_path: 'a.js', content: '' })])), 'AC1.1: Write → block');
    ok(blocked(run([human('x'), use('MultiEdit', { file_path: 'a.js', edits: [] })])), 'AC1.1: MultiEdit → block');
    ok(blocked(run([human('x'), use('NotebookEdit', { notebook_path: 'n.ipynb' })])), 'AC1.1: NotebookEdit (notebook_path) → block');
    ok(blocked(run([human('x'), edit('a.js'), bash('npm test'), edit('b.js')])), 'AC1.1: test chạy trước lần sửa cuối → block');

    ok(run([human('x'), edit('a.js'), bash('npm test')]) === null, 'AC1.2: có test sau lần sửa cuối → cho dừng');
    ok(run([human('x'), edit('a.js'), use('PowerShell', { command: 'npm test; if ($?) { "ok" }' })]) === null, 'AC1.2: PowerShell chạy test → cho dừng');
    const isTest = [
      'npm test', 'pnpm run test', 'yarn test', 'bun test', 'npm run test:unit', 'npx vitest run', 'npx jest', 'npx playwright test', 'node --test',
      'node test/validate.mjs --build', 'mvn -q test', './mvnw verify', 'mvn compile', './gradlew check', 'gradle build', 'pytest -q', 'python -m pytest',
      'python3 -m unittest', 'uv run pytest', 'go test ./...', 'cargo test', 'dotnet test', 'tsc --noEmit', 'npx tsc', 'eslint .', 'npm run lint',
      'pnpm run typecheck', 'npm run build', 'ruff check .', 'mypy src', 'cd app && npm test 2>&1 | tail -5', 'FOO=1 npx vitest run',
      'npm --prefix app test', 'npm -w pkg test', 'pnpm -C app test', 'pnpm --filter web test', 'yarn workspace web test', 'pnpm vitest run',
      'npx --yes vitest', 'npx -y tsc', 'npm t', 'npm run type-check', 'npm run check', '.venv/bin/pytest', 'uv run python -m pytest',
      'python manage.py test', 'time npm test', 'env CI=1 npm test', 'timeout 60 npm test', 'node ./test/x.mjs', 'cargo build', 'cargo check',
      'cargo clippy', 'go build ./...', 'go vet ./...', 'dotnet build', 'rspec', 'make test', 'make check',
    ];
    const notTest = ['echo npm test', 'npm install', 'cat test/a.js', 'git status', 'ls tests/', 'node scripts/build.mjs', 'npm i -D vitest', 'npm run dev',
      'pnpm add vitest', 'yarn workspace web add x', 'make install'];
    const badPos = isTest.filter((c) => !gate.isTestCommand(c));
    const badNeg = notTest.filter((c) => gate.isTestCommand(c));
    ok(badPos.length === 0, `AC1.2: isTestCommand nhận đúng lệnh test/lint/build${badPos.length ? ' — sót: ' + badPos.join(' | ') : ''}`);
    ok(badNeg.length === 0, `AC1.2: isTestCommand không nhận lệnh không phải test${badNeg.length ? ' — nhầm: ' + badNeg.join(' | ') : ''}`);

    ok(run([human('x')]) === null, 'AC1.3: không sửa gì → cho dừng');
    ok(['docs/a.md', 'E:\\repo\\README.MD', 'notes.txt', 'x.rst', 'y.adoc', 'z.mdx'].every((p) => run([human('x'), edit(p)]) === null),
      'AC1.3: chỉ sửa file tài liệu → cho dừng');
    ok(blocked(run([human('x'), edit('package.json')])) && blocked(run([human('x'), edit('ci.yml')])), 'AC1.3: sửa cấu hình (json/yml) không test → block');

    const dirty = [human('x'), edit('a.js')];
    ok(run(dirty, { input: { stop_hook_active: true } }) === null, 'AC1.4: stop_hook_active → cho dừng (chống vòng lặp)');
    ok(run(dirty, { env: { AIP_STOP_GATE: 'off' } }) === null, 'AC1.4: AIP_STOP_GATE=off → cho dừng');
    ok(run(dirty, { cfg: { stopGate: false } }) === null, 'AC1.4: stopGate:false trong cấu hình → cho dừng');
    ok(blocked(run(dirty, { cfg: { stopGate: true } })), 'AC1.4: stopGate:true vẫn block');

    const throws = gate.decide({ hook_event_name: 'Stop', transcript_path: 'T', cwd: '.' },
      { readFile: () => { throw new Error('ENOENT'); }, loadConfig: () => null, env: {} });
    ok(throws === null, 'AC1.5: đọc transcript lỗi → cho dừng');
    ok(run(['not json', '{"type":1}', '[]']) === null, 'AC1.5: JSONL hỏng/lạ → cho dừng');
    const odd = [human('x'), line({ type: 'assistant', message: { content: 'chuỗi' } }), line({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit' }] } })];
    let oddRes;
    let oddThrew = false;
    try { oddRes = run(odd); } catch { oddThrew = true; }
    ok(!oddThrew && oddRes === null, 'AC1.5: content là chuỗi / tool_use thiếu input → không ném, cho dừng');
    const cli = (stdin) => {
      try { return { out: execFileSync(process.execPath, [script], { input: stdin, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }), code: 0 }; } catch (e) { return { out: String(e.stdout || ''), code: e.status }; }
    };
    const cl = cli('không phải json');
    ok(cl.out === '' && cl.code === 0, 'AC1.5: CLI stdin không phải JSON → stdout rỗng, exit 0');

    const gitDir = fs.mkdtempSync(path.join(ctx.os.tmpdir(), 'aip-gate-'));
    try {
      execFileSync('git', ['init', '-q', gitDir]);
      fs.mkdirSync(path.join(gitDir, '.claude'));
      fs.mkdirSync(path.join(gitDir, 'src'));
      const tp = path.join(gitDir, 'transcript.jsonl');
      fs.writeFileSync(tp, [human('sửa'), edit('a.js')].join('\n'));
      const cfgPath = path.join(gitDir, '.claude', 'aip-gate.json');
      const stdinOf = () => JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: false, transcript_path: tp, cwd: path.join(gitDir, 'src') });
      fs.writeFileSync(cfgPath, String.fromCharCode(0xFEFF) + '{"stopGate": false}');
      ok(cli(stdinOf()).out === '', 'AC1.4: CLI đọc aip-gate.json có BOM ở gốc git (cwd là thư mục con): stopGate:false → stdout rỗng');
      fs.writeFileSync(cfgPath, '{}');
      const on = cli(stdinOf());
      let onJson = null;
      try { onJson = JSON.parse(on.out); } catch { /* ok bên dưới báo lỗi */ }
      ok(on.code === 0 && onJson?.decision === 'block' && typeof onJson.reason === 'string',
        'AC1.1: CLI in JSON {"decision":"block","reason":…} ra stdout, exit 0');
    } finally {
      fs.rmSync(gitDir, { recursive: true, force: true });
    }

    const subDirty = [edit('a.js')].join('\n');
    const subClean = [human('x')].join('\n');
    const sub = (subLines, mainLines) => gate.decide(
      { hook_event_name: 'SubagentStop', stop_hook_active: false, transcript_path: 'MAIN', agent_transcript_path: 'SUB', cwd: '.' },
      { readFile: (p) => (p === 'SUB' ? subLines : mainLines), loadConfig: () => null, env: {} });
    ok(blocked(sub(subDirty, subClean)), 'AC1.6: SubagentStop đọc agent_transcript_path (sub sửa không test) → block, kể cả không có prompt người dùng');
    ok(sub(subClean, subDirty) === null, 'AC1.6: SubagentStop không đọc transcript chính → cho dừng');

    ok(run([human('x'), edit('a.js'), bash('./run-tests.sh')], { cfg: { testCommands: ['^\\./run-tests\\.sh', '('] } }) === null,
      'AC1.7: testCommands bổ sung nhận lệnh, regex sai bị bỏ qua không ném');
    ok(blocked(run([human('x'), edit('a.js'), bash('./run-tests.sh')])), 'AC1.7: không cấu hình → ./run-tests.sh không tính là test');

    ok(run([human('a'), edit('a.js'), human('b'), bash('git status')]) === null, 'AC1.8: chỉ xét lượt hiện tại (sửa ở lượt trước không tính)');
    ok(blocked(run([human('a'), edit('a.js'), meta('Base directory for this skill: x'), bash('git status')])),
      'AC1.8: dòng isMeta không mở lượt mới');
    const compact = line({ type: 'user', isCompactSummary: true, message: { role: 'user', content: 'This session is being continued…' } });
    ok(blocked(run([human('a'), edit('a.js'), compact, bash('git status')])), 'AC1.8: dòng tóm tắt auto-compact không mở lượt mới');

    const subAgent = (agent_type, cfg = null) => gate.decide(
      { hook_event_name: 'SubagentStop', stop_hook_active: false, transcript_path: 'M', agent_transcript_path: 'S', agent_type, cwd: '.' },
      { readFile: () => edit('a.js'), loadConfig: () => cfg, env: {} });
    ok(subAgent('data:data-migration-writer') === null && subAgent('data-migration-writer') === null, 'AC1.10: agent migration mặc định được miễn (có/không tiền tố plugin)');
    ok(blocked(subAgent('backend:backend-implementer')), 'AC1.10: agent khác vẫn bị gate');
    ok(subAgent('backend:backend-implementer', { exemptAgents: ['backend-implementer'] }) === null
      && blocked(subAgent('data:data-migration-writer', { exemptAgents: ['backend-implementer'] })), 'AC1.10: exemptAgents ghi đè danh sách mặc định');

    const big = [];
    for (let i = 0; i < 15000; i++) big.push(use('Read', { file_path: 'src/' + 'x'.repeat(200) + i }));
    const bigLines = [...big, human('x'), edit('a.js')];
    const t0 = Date.now();
    const bigRes = run(bigLines);
    const dt = Date.now() - t0;
    ok(blocked(bigRes) && dt < 1000, `AC1.1: transcript ~5 MB chỉ parse sau ranh giới lượt → < 1000 ms (đo ${dt} ms)`);
  }
  {
    ok(HOOK_EVENTS.includes('Stop') && HOOK_EVENTS.includes('SubagentStop'), 'AC1.9: HOOK_EVENTS có Stop và SubagentStop');
    const hooks = JSON.parse(fs.readFileSync(path.join(ctx.CORE_DIR, 'hooks', 'hooks.json'), 'utf8')).hooks;
    const expected = { type: 'command', command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/hooks/scripts/gate-stop.mjs'], timeout: 10 };
    ok(['Stop', 'SubagentStop'].every((ev) => hooks[ev]?.length === 1 && hooks[ev][0].hooks?.length === 1
      && JSON.stringify(hooks[ev][0].hooks[0]) === JSON.stringify(expected)),
    'AC1.9: hooks.json core đăng ký Stop + SubagentStop gọi gate-stop.mjs');
    if (fs.existsSync(claudeDir)) {
      ok(fs.existsSync(path.join(claudeDir, 'plugins', 'core', 'hooks', 'scripts', 'gate-stop.mjs')), 'AC1.9: build claude ship gate-stop.mjs');
    }
  }
  // SessionStart: nạp handoff khi mở phiên mới, cảnh báo khi resume phiên nguội cache
  {
    ok(HOOK_EVENTS.includes('SessionStart'), 'AC3.1: HOOK_EVENTS có SessionStart');
    const { pathToFileURL, CORE_DIR } = ctx;
    const ss = await import(pathToFileURL(path.join(CORE_DIR, 'hooks', 'scripts', 'session-start.mjs')).href);
    const HOUR = 3600000;
    const T0 = Date.UTC(2026, 0, 10);
    const abs = (p) => path.resolve('/repo', p);
    const body = (extra = '') => `# Bàn giao\nNhánh: feature/x. Việc đang làm: hoàn thiện hook SessionStart, còn lại bước đăng ký event và test. ${extra}`;
    // files: { 'đường/dẫn/tương-đối': { text, mtime } } — giả lập đĩa, không chạm đĩa thật
    const fake = (files, cfg = null, nowMs = T0 + HOUR) => {
      const m = new Map(Object.entries(files).map(([k, v]) => [abs(k), v]));
      return {
        readFile: (p) => { const f = m.get(p); if (!f) throw new Error('ENOENT'); if (f.throws) throw new Error('EIO'); return f.text; },
        existsSync: (p) => m.has(p) || [...m.keys()].some((k) => k.startsWith(p + path.sep)),
        statSync: (p) => ({ mtimeMs: m.get(p).mtime }),
        readdirSync: (p) => [...new Set([...m.keys()].filter((k) => k.startsWith(p + path.sep)).map((k) => k.slice(p.length + 1).split(path.sep)[0]))],
        now: () => nowMs,
        loadConfig: () => cfg,
      };
    };
    const start = (files, { source = 'startup', cfg = null, nowMs, extra = {} } = {}) =>
      ss.decide({ hook_event_name: 'SessionStart', source, cwd: '/repo', ...extra }, fake(files, cfg, nowMs));
    const one = { 'docs/requests/2026-01-01-a/handoff.md': { text: body(), mtime: T0 } };

    ok(start(one)?.additionalContext?.includes('feature/x'), 'AC3.1: startup có handoff → chèn nội dung');
    ok(['clear', 'compact'].every((source) => start(one, { source })?.additionalContext?.includes('feature/x')), 'AC3.1: clear/compact cũng nạp handoff');
    ok(start({}) === null, 'AC3.1: không có handoff → null');
    ok(start(one, { nowMs: T0 + 25 * HOUR }) === null && start(one, { nowMs: T0 + 25 * HOUR, cfg: { handoffMaxAgeHours: 48 } }) !== null,
      'AC3.1: handoff cũ hơn handoffMaxAgeHours → null (mặc định 24, ghi đè được)');
    const long = { 'docs/requests/2026-01-01-a/handoff.md': { text: '# Bàn giao\n' + 'x'.repeat(20000), mtime: T0 } };
    ok(start(long)?.additionalContext.length === 9000, 'AC3.1: nội dung dài bị cắt còn 9000 ký tự');
    ok(start({ 'docs/requests/a/handoff.md': { text: '# Bàn giao\n## Mục tiêu\n\n', mtime: T0 } }) === null
      && start({ 'docs/requests/a/handoff.md': { text: '', mtime: T0 } }) === null, 'AC3.1: handoff rỗng hoặc chỉ có placeholder → null');
    const two = {
      'docs/requests/2026-01-01-a/handoff.md': { text: body('CU'), mtime: T0 },
      'docs/requests/2026-02-02-z/handoff.md': { text: body('MOI'), mtime: T0 + HOUR / 2 },
    };
    const picked = start(two)?.additionalContext || '';
    ok(picked.includes('MOI') && !picked.includes('CU') && picked.includes('2026-02-02-z'), 'AC3.1: nhiều request → chọn mtime mới nhất, ghi đường dẫn tương đối');
    ok(start(one, { source: 'resume', extra: { prompt_cache_likely_expired: false } }) === null, 'AC3.1: source resume không nạp handoff');
    ok(start(one, { cfg: { handoffInject: false } }) === null, 'AC3.1: handoffInject false → null');
    ok(start(one, { cfg: { handoffInject: true } }) !== null, 'AC3.1: handoffInject true vẫn nạp');
    ok(start({ 'docs/requests/a/handoff.md': { throws: true, mtime: T0 } }) === null, 'AC3.1: lỗi đọc file → null');
    const viaCfg = { 'notes/h.md': { text: body('CFG'), mtime: T0 }, ...one };
    ok(start(viaCfg, { cfg: { handoffPath: 'notes/h.md' } })?.additionalContext.includes('CFG'), 'AC3.1: handoffPath được ưu tiên hơn tự tìm');
    ok(start({ '.claude/handoff.md': { text: body('FALLBACK'), mtime: T0 } })?.additionalContext.includes('FALLBACK'), 'AC3.1: fallback .claude/handoff.md');

    // Regression: bản chép nguyên template chưa điền không được coi là handoff thật
    const tpl = fs.readFileSync(path.join(CORE_DIR, 'skills', 'artifact-templates', 'references', 'handoff.template.md'), 'utf8').replace(/^<!--[\s\S]*?-->\s*/, '');
    const blank = { 'docs/requests/a/handoff.md': { text: tpl, mtime: T0 } };
    ok(tpl.includes('<') && start(blank) === null && start({ '.claude/handoff.md': { text: '﻿' + tpl, mtime: T0 } }) === null,
      'AC3.1: handoff.template.md chưa điền (còn <…>, bullet rỗng) → null');
    ok(start(blank, { source: 'resume', extra: { prompt_cache_likely_expired: true } })?.additionalContext.includes('handoff.md') === false
      && start(one, { source: 'resume', nowMs: T0 + 25 * HOUR, extra: { prompt_cache_likely_expired: true } })?.additionalContext.includes('handoff.md') === false
      && start(one, { source: 'resume', extra: { prompt_cache_likely_expired: true } })?.additionalContext.includes('handoff.md') === true,
      'AC3.2: dòng resume không trỏ tới handoff rỗng hoặc quá tuổi');

    const cold = { prompt_cache_likely_expired: true, context_tokens: 182340, estimated_cache_write_usd: 1.1396 };
    for (const source of ['resume', 'fork']) {
      const r = start(one, { source, extra: cold });
      ok(r && r.additionalContext.includes('182340') && r.additionalContext.includes('1.1396') && !r.additionalContext.includes('\n'),
        `AC3.2: ${source} + cache nguội → một dòng có token và estimated_cache_write_usd`);
    }
    ok(start(one, { source: 'resume', extra: { prompt_cache_likely_expired: false } }) === null
      && start(one, { source: 'resume' }) === null, 'AC3.2: prompt_cache_likely_expired false hoặc thiếu → null');
    ok(start(one, { source: 'resume', extra: cold, cfg: { resumeWarn: false } }) === null, 'AC3.2: resumeWarn false → null');
    ok(!String(start({}, { source: 'resume', extra: { prompt_cache_likely_expired: true } })?.additionalContext).match(/undefined|NaN/),
      'AC3.2: thiếu số liệu thì bỏ phần đó, không bịa');
  }
  // SessionStart nạp đuôi ledger của plan đang chạy (D6), sau phần handoff
  {
    const { pathToFileURL, CORE_DIR } = ctx;
    const ss = await import(pathToFileURL(path.join(CORE_DIR, 'hooks', 'scripts', 'session-start.mjs')).href);
    const HOUR = 3600000;
    const T0 = Date.UTC(2026, 0, 10);
    const abs = (p) => path.resolve('/repo', p);
    const fake = (files, cfg = null) => {
      const m = new Map(Object.entries(files).map(([k, v]) => [abs(k), v]));
      return {
        readFile: (p) => { const f = m.get(p); if (!f) throw new Error('ENOENT'); if (f.throws) throw new Error('EIO'); return f.text; },
        existsSync: (p) => m.has(p) || [...m.keys()].some((k) => k.startsWith(p + path.sep)),
        statSync: (p) => ({ mtimeMs: m.get(p).mtime }),
        readdirSync: (p) => [...new Set([...m.keys()].filter((k) => k.startsWith(p + path.sep)).map((k) => k.slice(p.length + 1).split(path.sep)[0]))],
        now: () => T0 + HOUR,
        loadConfig: () => cfg,
      };
    };
    const start = (files, cfg = null) => ss.decide({ hook_event_name: 'SessionStart', source: 'startup', cwd: '/repo' }, fake(files, cfg));
    const LEDGER = 'docs/requests/2026-01-01-a/.sdd/progress.md';
    const handoff = { 'docs/requests/2026-01-01-a/handoff.md': { text: '# Bàn giao\nNhánh: feature/x. Việc đang làm: hoàn thiện hook SessionStart, còn lại bước đăng ký event và test. HANDOFF', mtime: T0 } };
    const open = { [LEDGER]: { text: 'Task 1: complete\nTask 2: dang lam\n', mtime: T0 } };

    ok(start(open)?.additionalContext.startsWith('Ledger (docs/requests/2026-01-01-a/.sdd/progress.md):') && start(open).additionalContext.includes('Task 2'),
      'AC3.3: ledger chưa xong, không có handoff → chỉ nạp ledger');
    const both = start({ ...handoff, ...open })?.additionalContext || '';
    ok(both.includes('HANDOFF') && both.indexOf('Ledger (') > both.indexOf('HANDOFF'), 'AC3.3: ledger nối sau handoff');
    ok(start({ [LEDGER]: { text: 'Task 1: complete\nPlan: complete\n', mtime: T0 } }) === null, 'AC3.3: ledger có Plan: complete → không nạp');
    ok(start(open, { ledgerInject: false }) === null && start({ ...handoff, ...open }, { ledgerInject: false })?.additionalContext.includes('Ledger') === false,
      'AC3.3: ledgerInject false → không nạp ledger');
    const bad = start({ ...handoff, [LEDGER]: { throws: true, mtime: T0 } })?.additionalContext || '';
    ok(bad.includes('HANDOFF') && !bad.includes('Ledger'), 'AC3.3: ledger không đọc được → bỏ qua, vẫn trả handoff');
    const big = start({ [LEDGER]: { text: 'a'.repeat(5000) + 'CUOI', mtime: T0 } })?.additionalContext || '';
    ok(big.length <= 2000 && big.endsWith('CUOI'), 'AC3.3: phần ledger ≤ 2000 ký tự và giữ phần đuôi');
    const newest = start({
      [LEDGER]: { text: 'CU', mtime: T0 },
      'docs/requests/2026-02-02-z/.sdd/progress.md': { text: 'MOI', mtime: T0 + 1 },
      'docs/requests/2026-03-03-y/.sdd/progress.md': { text: 'Plan: complete\n', mtime: T0 + 2 },
    })?.additionalContext || '';
    ok(newest.includes('MOI') && !newest.includes('CU'), 'AC3.3: chọn ledger chưa xong có mtime mới nhất, bỏ qua ledger đã xong mới hơn');
  }
  // Công tắc allowEnvFiles: mở .env theo project, khoá/credentials vẫn bị chặn
  {
    const { pathToFileURL, CORE_DIR, os, execFileSync } = ctx;
    const dir = path.join(CORE_DIR, 'hooks', 'scripts');
    const bash = await import(pathToFileURL(path.join(dir, 'guard-bash.mjs')).href);
    const files = await import(pathToFileURL(path.join(dir, 'guard-files.mjs')).href);
    const on = () => true;
    const off = () => false;
    const sh = (command, allowEnv) => bash.decide({ tool_name: 'Bash', cwd: '.', tool_input: { command } }, { currentBranch: () => 'feature/x', allowEnv });
    ok(sh('cat .env', on) === null && sh('source ./.env.local', on) === null && sh('cat .env', off)?.decision === 'ask',
      'E1: guard-bash — cờ bật thì .env cho qua, cờ tắt vẫn ask');
    ok(['cat certs/server.pem', 'cat id_rsa', 'cat credentials.json', 'cat .env && cat ~/.ssh/id_rsa'].every((c) => sh(c, on)?.decision === 'ask')
      && sh('git push origin main', on)?.decision === 'ask',
      'E1: guard-bash — cờ bật vẫn ask với khoá/credentials (kể cả đi cùng .env) và push main');
    let calls = 0;
    sh('git status && npm test', () => { calls++; return true; });
    ok(calls === 0, 'E1: guard-bash — lệnh không nhắc file bí mật thì không đọc cấu hình');
    const fd = (tool_name, tool_input, allowEnv) => files.decide({ tool_name, cwd: '/repo', tool_input }, { scopes: {}, allowEnv, ignoreCase: false });
    ok(fd('Read', { file_path: '/repo/.env' }, on) === null && fd('Write', { file_path: '/repo/.env.local' }, on) === null
      && fd('Grep', { pattern: 'x', glob: '.env*' }, on) === null && fd('Read', { file_path: '/repo/.env' }, off)?.decision === 'deny',
      'E2: guard-files — cờ bật thì Read/Write/Grep .env cho qua, cờ tắt vẫn deny');
    ok(fd('Read', { file_path: '/repo/server.key' }, on)?.decision === 'deny' && fd('Read', { file_path: '/repo/credentials.json' }, on)?.decision === 'deny'
      && fd('Grep', { pattern: 'x', glob: '*.pem' }, on)?.decision === 'deny',
      'E2: guard-files — cờ bật vẫn deny khoá/credentials');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-allowenv-'));
    try {
      const a = path.join(tmp, 'a');
      const b = path.join(tmp, 'b');
      const wt = path.join(tmp, 'wt');
      for (const r of [a, b]) execFileSync('git', ['init', '-q', r]);
      execFileSync('git', ['-C', a, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init']);
      fs.mkdirSync(path.join(a, '.claude'));
      fs.writeFileSync(path.join(a, '.claude', 'aip-gate.json'), '﻿{"allowEnvFiles": true}');
      execFileSync('git', ['-C', a, 'worktree', 'add', '-q', wt]);
      const real = (cwd, file) => files.decide({ tool_name: 'Read', cwd, tool_input: { file_path: file } }, { scopes: {} });
      ok(real(b, path.join(a, '.env')) === null && real(a, path.join(b, '.env'))?.decision === 'deny',
        'E3: guard-files — cờ đọc theo repo chứa file đích, không theo cwd');
      ok(real(wt, path.join(wt, '.env')) === null, 'E3: worktree chưa có aip-gate.json theo cờ của repo chính');
      const shReal = (cwd) => bash.decide({ tool_name: 'Bash', cwd, tool_input: { command: 'cat .env' } }, { currentBranch: () => 'feature/x' });
      ok(shReal(a) === null && shReal(b)?.decision === 'ask', 'E3: guard-bash — cờ đọc từ aip-gate.json (có BOM) của repo theo cwd');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}
