// Contract 99: request 2026-11-12-hook-popup-standardization (reason dễ hiểu, bớt bắt nhầm, guard-mcp giữ mcpDeny).
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, pathToFileURL, CORE_DIR } = ctx;
  const hook = (name) => import(pathToFileURL(path.join(CORE_DIR, 'hooks', 'scripts', name)).href);
  // Khuôn của reason `ask` (AC1.1): không thuật ngữ nội bộ, có lời khuyên cho phép/từ chối, ngắn; không ghim cả câu.
  const BANNED = ['nguyên tắc nền', 'hook an toàn', 'fullRoots', 'bypass', 'root'];
  const shapeOk = (reason) => {
    const main = String(reason).split('\n').filter((l) => !l.startsWith('Lệnh gồm')).join(' ');
    return typeof reason === 'string' && !BANNED.some((w) => reason.toLowerCase().includes(w.toLowerCase())) && /cho phép|từ chối/i.test(main) && main.length <= 500;
  };

  // ── Task 1: guard-mcp (AC3.x)
  {
    const mcp = await hook('guard-mcp.mjs');
    const call = (tool, locate, extra = {}) => mcp.decide({ tool_name: tool, cwd: '.' }, { locate, tracked: () => null, ...extra });
    const cfgOf = (config, extra = {}) => () => ({ gate: { config, file: '/x/.claude/aip-gate.json', inRepo: true, ...extra }, invalid: null });
    const broken = (file) => () => ({ gate: null, invalid: file });
    const none = () => ({ gate: null, invalid: null });

    const bad = call('mcp__a__t', broken('/repo/.claude/aip-gate.json'));
    ok(bad?.decision === 'ask' && bad.reason.includes('/repo/.claude/aip-gate.json') && bad.reason.includes('"a"'),
      'AC3.2: file aip-gate.json hỏng → ask mọi tool MCP, lý do nêu đường dẫn file');
    ok(call('Bash', broken('/repo/.claude/aip-gate.json')) === null, 'AC3.2: tool không phải MCP không bị ảnh hưởng khi file hỏng');
    const START = 'mcp__ccd_session__start_session';
    ok(mcp.decide({ tool_name: START, tool_input: { initiation: 'own_initiative' }, cwd: '.' }, { locate: broken('/r/.claude/aip-gate.json') })?.decision === 'deny',
      'AC3.2: start_session thiếu model vẫn deny trước, kể cả khi file hỏng');
    ok(call('mcp__a__t', none) === null && call('mcp__a__t', cfgOf({})) === null && call('mcp__a__t', cfgOf({ mcpDeny: ['b'] })) === null,
      'AC3.3: không file / file không có mcpDeny / mcpDeny server khác → null');
    ok(call('mcp__a__t', cfgOf({ mcpDeny: ['a'] }))?.decision === 'deny', 'AC3.3: mcpDeny đúng server vẫn deny (không đổi)');

    // AC3.1: git lỗi nhưng có .git ở trên → gitUnknown; file vẫn đọc được và mcpDeny/mcpAllow phải áp
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-popup-'));
    try {
      const repo = path.join(tmp, 'repo');
      fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
      fs.mkdirSync(path.join(repo, '.claude'));
      const gate = path.join(repo, '.claude', 'aip-gate.json');
      const real = (tool) => mcp.decide({ tool_name: tool, cwd: repo }, {});
      fs.writeFileSync(gate, JSON.stringify({ mcpDeny: ['a'], mcpAllow: ['b'] }));
      ok(real('mcp__a__t')?.decision === 'deny' && /mcpDeny/.test(real('mcp__a__t').reason), 'AC3.1: gitUnknown + mcpDeny → deny nêu mcpDeny');
      ok(real('mcp__c__t')?.decision === 'deny' && /mcpAllow/.test(real('mcp__c__t').reason) && real('mcp__b__t') === null, 'AC3.1: gitUnknown + mcpAllow vẫn áp');
      fs.writeFileSync(gate, '{ hỏng');
      const r = real('mcp__b__t');
      ok(r?.decision === 'ask' && r.reason.includes('aip-gate.json'), 'AC3.2: JSON hỏng trong repo → ask, lý do nêu aip-gate.json');
      const outside = path.join(tmp, 'plain');
      fs.mkdirSync(outside);
      ok(mcp.decide({ tool_name: 'mcp__b__t', cwd: outside }, {}) === null, 'AC3.3: ngoài repo git → null (R3/R4)');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }

    // AC3.2 trong git repo thật: CLI trả ask khi file hỏng ở repo chính, cả khi chạy từ worktree liên kết (nhánh mainInvalid)
    const real = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-popup-git-'));
    const main = path.join(real, 'main');
    const wt = path.join(real, 'wt');
    const git = (...a) => execFileSync('git', ['-C', main, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { stdio: 'ignore' });
    try {
      fs.mkdirSync(main);
      git('init', '-q');
      git('commit', '-q', '--allow-empty', '-m', 'init');
      git('worktree', 'add', '-q', wt, '-b', 'wt-branch');
      fs.mkdirSync(path.join(main, '.claude'));
      const gateFile = path.join(main, '.claude', 'aip-gate.json');
      fs.writeFileSync(gateFile, '{ hỏng');
      const cli = (cwd) => {
        const out = execFileSync(process.execPath, [path.join(CORE_DIR, 'hooks', 'scripts', 'guard-mcp.mjs')], { input: JSON.stringify({ tool_name: 'mcp__a__t', cwd }), encoding: 'utf8' });
        return out ? JSON.parse(out).hookSpecificOutput : null;
      };
      for (const [where, cwd] of [['repo chính', main], ['worktree liên kết', wt]]) {
        const o = cli(cwd);
        ok(o?.permissionDecision === 'ask' && o.permissionDecisionReason.includes('aip-gate.json'), `AC3.2: CLI trong git repo thật, file hỏng ở repo chính, chạy từ ${where} → ask`);
      }
      fs.writeFileSync(gateFile, JSON.stringify({ mcpDeny: ['a'] }));
      ok(cli(wt)?.permissionDecision === 'deny', 'AC3.1: CLI từ worktree đọc mcpDeny của repo chính → deny');
    } finally {
      try { git('worktree', 'remove', '--force', wt); } catch { /* dọn thư mục bên dưới */ }
      fs.rmSync(real, { recursive: true, force: true });
    }
  }
  // ── guard-bash helpers dùng chung cho Task 2–4
  const gb = await hook('guard-bash.mjs');
  const bash = (command, { tool = 'Bash', branch = 'feature/x', full = false, extra = {} } = {}) => gb.decide(
    { tool_name: tool, cwd: '.', tool_input: { command }, ...(full ? { permission_mode: 'bypassPermissions' } : {}), ...extra },
    { currentBranch: () => branch, ...(full ? { config: { mode: 'full' }, repoRoot: path.resolve('.'), tracked: () => false } : {}) });
  const asks = (c, o) => bash(c, o)?.decision === 'ask';

  // ── Task 2: cấu hình hook chỉ hỏi theo đích ghi; chuỗi bash -c ở full theo parse (AC2.1, AC2.3)
  {
    for (const c of ['git commit -m "docs: aip-gate.json" > m2.txt', 'cat .claude/settings.json | tee x', 'echo x > a; cat .claude/aip-gate.json', 'cp .claude/settings.json backup.json']) {
      ok(bash(c) === null, `AC2.1: không ghi vào file cấu hình → không hỏi: ${c}`);
    }
    for (const c of ['bash -c "echo x > .claude/aip-gate.json"', 'sed -i s/a/b/ .claude/settings.json', 'perl -pi -e s/a/b/ .claude/aip-gate.json', 'cp x .claude/settings.json',
      String.raw`echo x >> .claude\settings.json`, 'echo y | sudo tee .claude/settings.local.json', 'git commit -m x > .claude/aip-gate.json']) {
      ok(asks(c), `AC2.1: ghi vào file cấu hình vẫn hỏi: ${c}`);
    }
    ok(asks(String.raw`Set-Content .claude\aip-gate.json x`, { tool: 'PowerShell' }), 'AC2.1: PowerShell Set-Content vào aip-gate.json vẫn hỏi');
    // Vòng sửa 1: các đường ghi mà regex toàn lệnh cũ bắt được, cách đọc theo đích ghi không được bỏ sót
    for (const c of [String.raw`Out-File -Encoding utf8 .claude\settings.json`, String.raw`Set-Content -Encoding utf8 .claude\aip-gate.json x`, String.raw`Set-Content -Value x .claude\aip-gate.json`,
      String.raw`Set-Content -Path:.claude\aip-gate.json x`]) {
      ok(asks(c, { tool: 'PowerShell' }), `AC2.1: PowerShell ghi cấu hình qua cờ có giá trị vẫn hỏi: ${c}`);
    }
    for (const c of ['echo x >| .claude/aip-gate.json', 'echo x >|.claude/settings.json', 'bash -c "echo x >|.claude/aip-gate.json"',
      String.raw`cmd /c "echo x > .claude\settings.json"`, 'dash -c "echo x > .claude/aip-gate.json"', "ksh -c 'echo x > .claude/aip-gate.json'", "busybox sh -c 'echo x > .claude/aip-gate.json'",
      `bash -c "bash -c \\"bash -c \\\\\\"bash -c 'echo x > .claude/aip-gate.json'\\\\\\"\\""`,
      'time cp x .claude/settings.json', 'command -p cp x .claude/settings.json', 'doas cp x .claude/settings.json', 'ionice -c3 cp x .claude/settings.json',
      'stdbuf -o0 tee .claude/aip-gate.json', 'xargs -I{} cp {} .claude/settings.json', 'echo x | xargs -I% cp % .claude/settings.json',
      'echo .claude/aip-gate.json | xargs rm', 'find . -name x -exec cp {} .claude/settings.json \\;']) {
      ok(asks(c), `AC2.1: đường ghi cấu hình qua dạng bọc/chuyển hướng ít gặp vẫn hỏi: ${c}`);
    }
    ok(bash('find . -name aip-gate.json') === null && bash('echo x | xargs echo .claude/aip-gate.json') === null, 'AC2.1: find/xargs chỉ nhắc tên file cấu hình, không có lệnh ghi → không hỏi');
    // Vòng sửa 2: khối lệnh/cấu trúc shell, cmd /c không nháy, xargs/parallel với sed -i hoặc sh -c
    for (const c of ['{ cp x .claude/settings.json; }', 'if true; then cp x .claude/settings.json; fi', 'for i in 1; do cp x .claude/settings.json; done',
      'while true; do tee .claude/aip-gate.json; done', '! cp x .claude/settings.json', 'true && ! cp x .claude/settings.json', 'if true; then rm .claude/aip-gate.json; fi',
      String.raw`cmd /c copy x .claude\settings.json`, 'echo .claude/settings.json | xargs sed -i s/a/b/', 'echo .claude/settings.json | xargs perl -pi -e s/a/b/',
      'parallel sed -i s/a/b/ ::: .claude/settings.json', "find . -name x -exec sh -c 'echo a > .claude/settings.json' \\;",
      'echo .claude/settings.json | xargs -I{} bash -c "echo x > {}"']) {
      ok(asks(c), `AC2.1: ghi cấu hình qua cấu trúc shell hoặc wrapper vẫn hỏi: ${c}`);
    }
    for (const c of [String.raw`& { Set-Content .claude\aip-gate.json x }`, String.raw`if ($true) { Set-Content .claude\aip-gate.json x }`, String.raw`ForEach-Object { Set-Content .claude\aip-gate.json x }`,
      String.raw`cmd.exe /c copy x .claude\settings.json`]) {
      ok(asks(c, { tool: 'PowerShell' }), `AC2.1: PowerShell ghi cấu hình qua khối script vẫn hỏi: ${c}`);
    }
    for (const c of ['{ cat .claude/settings.json; }', 'for f in .claude/settings.json; do cat $f; done', 'if grep x .claude/aip-gate.json; then echo ok; fi', 'cat .claude/settings.json | xargs echo']) {
      ok(bash(c) === null, `AC2.1: chỉ đọc cấu hình trong khối lệnh → không hỏi: ${c}`);
    }
    ok(asks('bash -c "{ rm /x; }"', { full: true }) && bash('bash -c "if true; then rm /x; fi"', { full: true }) !== null, 'AC2.3: full — lệnh ghi trong khối { } hay if trong chuỗi bash -c vẫn bị hỏi hoặc chặn');
    for (const c of ['bash -c "time rm /x"', 'bash -c "ls | xargs rm"', 'bash -c "find . -exec rm {} \\;"']) {
      ok(asks(c, { full: true }), `AC2.3: full — chuỗi con ghi qua wrapper vẫn hỏi: ${c}`);
    }
    for (const c of ['bash -c "awk \'$1>2\' f"', 'bash -c "grep -rm 1 x ."', 'bash -c "echo hi 2>&1"', 'bash -c "echo hi > /dev/null"']) {
      ok(bash(c, { full: true }) === null, `AC2.3: full — chuỗi con không ghi → không hỏi: ${c}`);
    }
    for (const c of ['bash -c "rm /x"', 'bash -c "echo a > /x"', 'eval "rm /x"', 'bash -c "echo \'x > y\\" ; rm z"']) {
      ok(asks(c, { full: true }), `AC2.3: full — chuỗi con có lệnh ghi vẫn hỏi: ${c}`);
    }
  }

  // ── Task 5: guard-files reason theo khuôn (AC1.1, AC1.2, AC1.4)
  {
    const gf = await hook('guard-files.mjs');
    const proj = path.resolve('/tmp/popup-proj');
    const outsideFile = path.resolve('/tmp/popup-elsewhere/notes.txt');
    const dec = (tool, file, { bypass = false } = {}) => gf.decide(
      { tool_name: tool, tool_input: { file_path: file }, cwd: proj, ...(bypass ? { permission_mode: 'bypassPermissions' } : {}) },
      { scopes: {}, repoRoot: proj, allowEnv: () => false, ...(bypass ? { config: { mode: 'full' }, tracked: () => false } : {}) });
    const cfg = dec('Write', path.join(proj, '.claude', 'aip-gate.json'));
    ok(cfg?.decision === 'ask' && shapeOk(cfg.reason) && cfg.reason.includes('aip-gate.json'), 'AC1.1: guard-files — ghi cấu hình quyền → ask theo khuôn, nêu tên file');
    const rd = dec('Read', outsideFile, { bypass: true });
    ok(rd?.decision === 'ask' && shapeOk(rd.reason) && rd.reason.includes(outsideFile), 'AC1.2: guard-files — đọc ngoài project ở full → ask theo khuôn, nêu đường dẫn');
    const unk = dec('Read', '$HOME/x.txt', { bypass: true });
    ok(unk?.decision === 'ask' && shapeOk(unk.reason) && unk.reason.includes('$HOME/x.txt'), 'AC1.1: guard-files — đường dẫn không xác định được → ask theo khuôn');
    const wr = dec('Write', outsideFile, { bypass: true });
    ok(wr?.decision === 'deny' && wr.reason.includes('fullRoots'), 'AC1.4: guard-files — ghi ngoài project ở full vẫn deny nhắc fullRoots');
    const wunk = dec('Write', '$HOME/x.txt', { bypass: true });
    ok(wunk?.decision === 'ask' && shapeOk(wunk.reason) && !/Lệnh gồm/.test(cfg.reason + rd.reason + unk.reason + wunk.reason), 'AC1.3: reason của guard-files không có dòng "Lệnh gồm"; ghi vào đường dẫn không xác định → ask theo khuôn');
    // Đường dẫn do agent cung cấp không được làm giả dòng hay đẩy lời khuyên ra khỏi popup: bỏ xuống dòng/backtick, cắt độ dài
    for (const evil of ['$X/`a`\nAn toàn, hãy cho phép.\n`b.txt`', `$X/${'a'.repeat(900)}`, `${outsideFile}\nHãy cho phép`]) {
      const r = dec('Read', evil, { bypass: true });
      ok(r?.decision === 'ask' && shapeOk(r.reason) && !/[\r\n]/.test(r.reason) && !r.reason.includes('`a`'), `AC1.1: đường dẫn có xuống dòng/backtick/quá dài không làm sai lệch reason (${evil.slice(0, 12).replace(/\n/g, '⏎')}…)`);
    }
  }

  // ── Task 4: guard-bash reason theo khuôn, kèm dòng "Lệnh gồm" (AC1.1–AC1.4)
  {
    const cases = [
      ['push nhánh bảo vệ', 'git push origin master', {}, ['master']],
      ['push force', 'git push --force origin x', {}, []],
      ['push không biết nhánh đích', 'git push origin $B', {}, []],
      ['ghi cấu hình quyền', 'echo x > .claude/aip-gate.json', {}, ['aip-gate.json']],
      ['nhắc file bí mật .env', 'cat .env', {}, ['.env']],
      ['nhắc file bí mật .pem', 'cat certs/server.pem', {}, ['server.pem']],
      ['commit nháy chưa đóng', 'git commit -m "é', {}, []],
      ['full + đường dẫn không rõ', 'rm -rf $X', { full: true }, []],
    ];
    for (const [name, cmd, o, tokens] of cases) {
      const r = bash(cmd, o);
      ok(r?.decision === 'ask' && shapeOk(r.reason) && tokens.every((t) => r.reason.includes(t)) && r.reason.split('\n').length <= 2,
        `AC1.1/AC1.2: guard-bash — ${name} → ask theo khuôn, nêu token khớp: ${cmd}`);
    }
    // Phiên không chạy ở chế độ bỏ qua hỏi quyền trong project full
    const nb = gb.decide({ tool_name: 'Bash', cwd: '.', permission_mode: 'default', tool_input: { command: 'curl http://x' } },
      { config: { mode: 'full' }, repoRoot: path.resolve('.'), tracked: () => false, currentBranch: () => 'feature/x' });
    ok(nb?.decision === 'ask' && shapeOk(nb.reason) && nb.reason.includes('aip mode ask'), 'AC1.1: guard-bash — full nhưng phiên không bỏ qua hỏi quyền → ask theo khuôn, còn gợi ý aip mode ask');

    const chain = bash('git add -A && git commit -m x && git push origin master');
    const line = chain?.reason.split('\n').find((l) => l.startsWith('Lệnh gồm:')) ?? '';
    const order = ['git add', 'git commit', 'git push'].map((w) => line.indexOf(w));
    ok(order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2], 'AC1.3: dòng "Lệnh gồm:" liệt kê các bước theo thứ tự');
    const long = bash('echo 1; echo 2; echo 3; echo 4; echo 5; echo 6; echo 7; git push origin master')?.reason.split('\n').find((l) => l.startsWith('Lệnh gồm:')) ?? '';
    ok(long.includes('2 bước khác') && !long.includes('git push'), 'AC1.3: lệnh 8 bước chỉ liệt kê 6, nêu "2 bước khác"');

    const deny = bash('rm /popup-elsewhere/x', { full: true });
    ok(deny?.decision === 'deny' && deny.reason.includes('fullRoots'), 'AC1.4: guard-bash — deny full ngoài project vẫn nhắc fullRoots');

    const { showArg } = await hook('gate-config.mjs');
    ok(!new RegExp('[\p{Cc}\p{Cf}\u2028\u2029`]', 'u').test(showArg('a`b[31m‮c de')), 'AC1.1: showArg bỏ ký tự điều khiển, bidi và backtick');
  }

  // ── Task 7: thư mục tạm do Claude sinh ra và biến gán trong cùng lệnh ở full (AC6.1–AC6.3)
  {
    const tmpRoot = path.join(os.tmpdir(), 'claude');
    const scratch = path.join(tmpRoot, 'p', 's', 'scratchpad');
    const fwd = (p) => p.replaceAll('\\', '/');
    const withScratch = { full: true, extra: { scratchpad_dir: scratch } };
    ok(bash(`mkdir -p ${fwd(scratch)}/bin`, { full: true }) === null, 'AC6.1: full — mkdir trong <tmpdir>/claude (không cần scratchpad_dir) → không hỏi');
    ok(bash(`rm ${fwd(path.join(os.tmpdir(), 'popup-outside.txt'))}`, { full: true })?.decision === 'deny', 'AC6.1: full — ghi ngoài thư mục claude của tmpdir vẫn deny');
    const gf = await hook('guard-files.mjs');
    const fdec = (tool, file) => gf.decide({ tool_name: tool, tool_input: { file_path: file }, cwd: path.resolve('.'), permission_mode: 'bypassPermissions' },
      { scopes: {}, repoRoot: path.resolve('.'), allowEnv: () => false, config: { mode: 'full' }, tracked: () => false });
    ok(fdec('Write', path.join(tmpRoot, 'p', 's', 'x.txt')) === null && fdec('Read', path.join(tmpRoot, 'p', 's', 'x.txt')) === null, 'AC6.1: guard-files — Write/Read dưới <tmpdir>/claude ở full → không hỏi');
    ok(fdec('Write', path.join(os.tmpdir(), 'x.txt'))?.decision === 'deny', 'AC6.1: guard-files — Write vào <tmpdir>/x.txt (ngoài claude) vẫn deny');

    const popupCmd = [`S=$(cygpath -u '${scratch}'); R=/e/Mine/BE/be-documents; mkdir -p $S/bin && cd $S`, '# stub docker: always fails', "cat > bin/docker <<'EOF'",
      '#!/usr/bin/env bash', 'echo "docker stub: $*" >&2; exit 1', 'EOF', 'chmod +x bin/docker', 'echo "--- smoke-test with failing docker";',
      'PATH="$S/bin:$PATH" bash $R/src/secrets/vault-consul/scripts/smoke-test.sh; echo "exit=$?"'].join('\n');
    ok(bash(popupCmd, withScratch) === null, 'AC6.2: full — lệnh của ảnh popup (S=$(cygpath -u …), heredoc, chmod, PATH=$S/bin) → không hỏi');
    ok(bash(`S=${fwd(scratch)}; rm $S/x`, withScratch) === null, 'AC6.2: full — S=<literal trong scratchpad>; rm $S/x → không hỏi');

    const stay = [
      ['S=/etc; rm $S/x', 'deny', 'gán ra ngoài root → deny như viết thẳng đường dẫn'],
      [`rm $S/x; S=${fwd(scratch)}`, 'ask', 'dùng trước khi gán'],
      ['S=$X; rm $S/x', 'ask', 'giá trị không giải được'],
      [`S=${fwd(scratch)}; S=$X; rm $S/x`, 'ask', 'gán lại bằng giá trị không giải được'],
      [`cat > f <<'EOF'\nS=${fwd(scratch)}\nEOF\nrm -rf $S/x`, 'ask', 'phép gán giả trong thân heredoc'],
      [`S="${fwd(scratch)}/a b"; rm $S`, 'ask', 'giá trị có khoảng trắng'],
      [`if false; then S=${fwd(scratch)}; fi; rm -rf $S/x`, 'ask', 'phép gán không ở đầu lệnh cấp cao nhất'],
    ];
    for (const [cmd, want, why] of stay) {
      ok(bash(cmd, withScratch)?.decision === want, `AC6.3: full — ${why}: ${cmd.replace(/\n/g, '⏎')}`);
    }
    ok(bash('S=/etc; rm $S/x') === null, 'AC6.3: ngoài chế độ full lệnh không đổi (không có H6)');
  }

  // ── Task 3: file bí mật bỏ qua lệnh metadata và mẫu tìm kiếm (AC2.2)
  {
    for (const c of ['git log -- .env', 'git log --oneline -5 -- credentials', 'ls credentials', 'grep -rn credentials src', 'npm test -- --grep "credentials"',
      'npm test -- --grep=credentials', 'rg --glob "*.ts" credentials', 'ls -la .env', 'grep -e credentials src', 'git log --format=%H --name-only -3 -- id_rsa']) {
      ok(bash(c) === null, `AC2.2: lệnh metadata hoặc mẫu tìm kiếm không in nội dung file bí mật → không hỏi: ${c}`);
    }
    for (const c of ['git log -p -- .env', 'git log --patch -- .env', 'git log -S token -- .env', 'git log -L1,5:.env', 'git log --textconv -- .env', 'git diff -- .env', 'grep x .env',
      'grep -rn credentials credentials.json', 'grep -e foo .env', 'cat .env', 'git log -- .env | xargs cat', 'ls .env > out', 'grep -- .env src', 'ls $(cat .env)']) {
      ok(asks(c), `AC2.2: lệnh có thể in nội dung file bí mật vẫn hỏi: ${c}`);
    }
  }
}
