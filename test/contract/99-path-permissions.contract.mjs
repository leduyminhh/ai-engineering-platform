// Contract quyền theo thư mục (khoá fullPaths của aip-gate.json).
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, pathToFileURL, CORE_DIR } = ctx;
  const { runMode } = await import(pathToFileURL(path.join(CORE_DIR, '..', 'cli', 'lib', 'mode.mjs')).href);

  const { fullPaths, classifyPath } = await import(pathToFileURL(path.join(CORE_DIR, 'hooks', 'scripts', 'gate-config.mjs')).href);
  const A = path.resolve('/aip-pp-a');
  const B = path.resolve('/aip-pp-b');
  const cases = [
    ['khoá thiếu', {}, []],
    ['null', { fullPaths: null }, []],
    ['chuỗi', { fullPaths: 'x' }, []],
    ['đối tượng', { fullPaths: { path: A, allow: ['read'] } }, []],
    ['path tương đối', { fullPaths: [{ path: 'rel', allow: ['read'] }] }, []],
    ['path không phải chuỗi', { fullPaths: [{ path: 3, allow: ['read'] }] }, []],
    ['allow không phải mảng', { fullPaths: [{ path: A, allow: 'read' }] }, []],
    ['phần tử không phải đối tượng', { fullPaths: [null, 'x', 1] }, []],
    ['quyền lạ/hoa thường', { fullPaths: [{ path: A, allow: ['read', 'Write', 'x', 3] }] }, [{ path: A, allow: ['read'] }]],
    ['Write', { fullPaths: [{ path: A, allow: ['Write'] }] }, [{ path: A, allow: [] }]],
    ['allow rỗng', { fullPaths: [{ path: A, allow: [] }] }, [{ path: A, allow: [] }]],
    ['gộp trùng path', { fullPaths: [{ path: A, allow: ['read'] }, { path: A + '/', allow: ['delete'] }, { path: B, allow: ['write'] }] }, [{ path: A, allow: ['read', 'delete'] }, { path: B, allow: ['write'] }]],
  ];
  for (const [name, cfg, want] of cases) {
    const got = fullPaths(cfg).map((e) => ({ path: e.path, allow: [...e.allow].sort() }));
    const exp = want.map((e) => ({ path: e.path, allow: [...e.allow].sort() }));
    ok(JSON.stringify(got) === JSON.stringify(exp), `AC2.1: fullPaths ${name}`);
  }

  const roots = [A, { path: B, allow: ['read'] }, { path: path.resolve('/aip-pp-c'), allow: ['write', 'delete'] }];
  const cwd = path.resolve('/aip-pp-cwd');
  const cl = (p, need) => classifyPath(p, cwd, roots, true, need);
  ok(cl(A + '/f') === 'inside' && cl(A + '/f', 'delete') === 'inside', 'AC2.1: root chuỗi đủ ba quyền');
  ok(cl(B + '/f', 'read') === 'inside' && cl(B + '/f') === 'outside' && cl(B + '/f', 'delete') === 'outside', 'AC2.1: root đối tượng tra theo need (mặc định write)');
  ok(cl(path.resolve('/aip-pp-c/f'), 'read') === 'outside' && cl(path.resolve('/aip-pp-c/f'), 'delete') === 'inside', 'AC2.1: thiếu read thì outside');
  ok(cl('$HOME/x', 'read') === 'unknown' && cl('~/x', 'delete') === 'unknown', 'AC2.1: $/~ → unknown');

  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aip-pp-')));
  try {
    fs.mkdirSync(path.join(root, '.claude'));
    fs.writeFileSync(path.join(root, '.claude', 'aip-gate.json'), JSON.stringify({ fullPaths: [{ path: '/x', read: true }] }));
    const git = (...a) => execFileSync('git', ['-C', root, ...a], { stdio: 'ignore' });
    git('init');
    git('add', '.claude/aip-gate.json');
    const lines = [];
    runMode('status', { root, out: (l) => lines.push(l) });
    ok(/Khoá bị bỏ qua[^\n]*fullPaths/.test(lines.join('\n')), 'AC1.2: fullPaths trong aip-gate.json bị git theo dõi → liệt kê ở "Khoá bị bỏ qua"');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }

  // guard-files: quyền theo thư mục (full hiệu lực). Khuôn ask sao chép từ 99-hook-popup.
  const files = await import(pathToFileURL(path.join(CORE_DIR, 'hooks', 'scripts', 'guard-files.mjs')).href);
  const BANNED = ['nguyên tắc nền', 'hook an toàn', 'fullRoots', 'bypass', 'root'];
  const shapeOk = (reason) => {
    const main = String(reason).split('\n').filter((l) => !l.startsWith('Lệnh gồm')).join(' ');
    return typeof reason === 'string' && !BANNED.some((w) => reason.toLowerCase().includes(w.toLowerCase())) && /cho phép|từ chối/i.test(main) && main.length <= 500;
  };
  const tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aip-pp-gf-')));
  try {
    const P = path.join(tmp, 'proj');
    const D = path.join(tmp, 'd');
    const O = path.join(tmp, 'o');
    const T = path.join(tmp, 't');
    const W = path.join(tmp, 'w');
    const X = path.join(tmp, 'x');
    const config = { mode: 'full', fullPaths: [
      { path: D, allow: ['read'] }, { path: O, allow: ['read', 'write'] }, { path: T, allow: ['read', 'write', 'delete'] }, { path: W, allow: ['write'] },
    ] };
    const dec = (tool, file) => files.decide({ tool_name: tool, tool_input: { file_path: file }, cwd: P, permission_mode: 'bypassPermissions' },
      { scopes: {}, repoRoot: P, allowEnv: () => false, config });
    const WRITES = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
    for (const dir of [D, O, T]) for (const tool of ['Read', 'Grep']) ok(dec(tool, path.join(dir, 'a.txt')) === null, `AC3.1: ${tool} vào ${path.basename(dir)} → cho qua`);
    for (const tool of WRITES) {
      const d = dec(tool, path.join(D, 'a.txt'));
      ok(d?.decision === 'deny' && /fullPaths/.test(d.reason) && /fullRoots/.test(d.reason) && /write/.test(d.reason), `AC3.1/AC6.2: ${tool} vào D (chỉ read) → deny, reason nêu fullPaths, fullRoots, write`);
      ok(dec(tool, path.join(O, 'a.txt')) === null && dec(tool, path.join(T, 'a.txt')) === null, `AC3.1: ${tool} vào O,T → cho qua`);
    }
    const rw = dec('Read', path.join(W, 'a.txt'));
    ok(rw?.decision === 'ask' && dec('Write', path.join(W, 'a.txt')) === null, 'AC3.2: mục chỉ ["write"] → Read ask, Write cho qua');
    ok(dec('Read', path.join(D, '.env'))?.decision === 'ask' && dec('Read', path.join(O, '.env'))?.decision === 'ask' && dec('Read', path.join(T, '.env')) === null, 'AC6.3: Read .env chỉ miễn khi đủ ba quyền');
    ok(dec('Write', path.join(O, '.env'))?.decision === 'ask' && dec('Write', path.join(T, '.env')) === null
      && dec('Write', path.join(D, '.env'))?.decision === 'deny' && dec('Write', path.join(P, '.env')) === null, 'AC6.4: Write .env: O ask, T qua, D deny, project qua');
    const asks = [rw, dec('Read', path.join(D, '.env')), dec('Write', path.join(O, '.env')), dec('Read', path.join(X, 'a.txt'))];
    ok(asks.every((a) => a?.decision === 'ask' && shapeOk(a.reason)), 'AC6.2: reason ask theo khuôn (cả ask .env và đọc ngoài mọi mục)');
    ok(asks[3].reason.includes(path.join(X, 'a.txt')), 'AC3.11: Read ngoài mọi mục → ask nêu đường dẫn');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }

  // guard-bash: quyền ghi/xoá theo thư mục (full + bypass).
  const bash = await import(pathToFileURL(path.join(CORE_DIR, 'hooks', 'scripts', 'guard-bash.mjs')).href);
  const tb = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aip-pp-gb-')));
  try {
    const u = (p) => p.replace(/\\/g, '/');
    const P = u(path.join(tb, 'proj'));
    const D = u(path.join(tb, 'd'));
    const O = u(path.join(tb, 'o'));
    const T = u(path.join(tb, 't'));
    const T2 = u(path.join(tb, 't2'));
    const config = { mode: 'full', fullPaths: [
      { path: D, allow: ['read'] }, { path: O, allow: ['read', 'write'] }, { path: T, allow: ['read', 'write', 'delete'] },
    ] };
    const bd = (cmd, { tool = 'Bash', cfg = config } = {}) => bash.decide({ tool_name: tool, tool_input: { command: cmd }, cwd: P, permission_mode: 'bypassPermissions' },
      { repoRoot: P, config: cfg, allowEnv: () => false, currentBranch: () => 'feature/x' });
    const kind = (cmd, opt) => bd(cmd, opt)?.decision ?? null;
    const expectAll = (rows, opt) => { for (const [cmd, want, ac] of rows) ok(kind(cmd, opt) === want, `${ac}: \`${cmd.replaceAll(tb.replace(/\\/g, '/'), '~')}\` → ${want}`); };

    expectAll([
      [`rm ${D}/f`, 'deny', 'AC3.3'], [`rm ${O}/f`, 'deny', 'AC3.3'], [`rmdir ${O}/d`, 'deny', 'AC3.3'],
      [`rm ${T}/f`, null, 'AC3.3'], [`rm ${P}/f`, null, 'AC3.3'], [`rm ${T}/a ${O}/b`, 'deny', 'AC3.3'],
    ]);
    expectAll([[`Remove-Item ${O}/f`, 'deny', 'AC3.3'], [`Remove-Item ${T}/f`, null, 'AC3.3']], { tool: 'PowerShell' });
    const WRITES = (d) => [`cp x ${d}/f`, `touch ${d}/f`, `mkdir ${d}/n`, `chmod 600 ${d}/f`, `tee ${d}/f`, `truncate -s0 ${d}/f`, `echo x > ${d}/f`, `echo x >> ${d}/f`];
    expectAll(WRITES(D).map((c) => [c, 'deny', 'AC3.4']));
    expectAll([...WRITES(O), ...WRITES(T)].map((c) => [c, null, 'AC3.4']));
    expectAll([[`Set-Content -Path ${D}/f -Value x`, 'deny', 'AC3.4'], [`Set-Content -Path ${O}/f -Value x`, null, 'AC3.4'], [`Set-Content -Path ${T}/f -Value x`, null, 'AC3.4']], { tool: 'PowerShell' });

    const only = { mode: 'full', fullPaths: [{ path: T2, allow: ['delete'] }] };
    expectAll([[`cp x ${T2}/f`, 'deny', 'AC3.5'], [`touch ${T2}/f`, 'deny', 'AC3.5'], [`echo x > ${T2}/f`, 'deny', 'AC3.5'], [`rm ${T2}/f`, null, 'AC3.5']], { cfg: only });
    const star = { mode: 'full', fullPaths: [{ path: `${D}/*`, allow: ['read', 'write', 'delete'] }] };
    expectAll([[`rm ${D}/a`, 'deny', 'AC2.2']], { cfg: star });
    expectAll([[`rm ${O}/*`, 'deny', 'AC4.5'], [`rm ${T}/*`, null, 'AC4.5'], [`cp x ${D}/*`, 'deny', 'AC4.5']]);
    expectAll([
      ['rm $X/f', 'ask', 'AC3.11'], ['cat > ~/f', 'ask', 'AC3.11'], ['rm `pwd`/f', 'ask', 'AC3.11'], [`bash -c "rm ${T}/f"`, 'ask', 'AC3.11'],
      [`cat ${D}/.env`, 'ask', 'AC6.3'], [`cat ${T}/.env`, null, 'AC6.3'],
    ]);

    const OUT = u(path.join(tb, 'out'));
    expectAll([
      [`mv ${T}/a ${O}/b`, null, 'AC3.6'], [`mv ${T}/a`, null, 'AC3.6'],
      [`mv ${O}/a ${O}/b`, 'deny', 'AC3.6'], [`mv ${T}/a ${D}/b`, 'deny', 'AC3.6'], [`mv ${D}/a ${T}/b`, 'deny', 'AC3.6'], [`mv ${O}/a`, 'deny', 'AC3.6'],
      [`mv -t ${O} ${T}/a`, null, 'AC3.7'], [`mv --target-directory=${O} ${T}/a`, null, 'AC3.7'], [`mv --target-directory ${O} ${T}/a`, null, 'AC3.7'], [`mv -t${O} ${T}/a`, null, 'AC3.7'],
      [`mv -t ${T} ${O}/a`, 'deny', 'AC3.7'], [`mv -t ${D} ${T}/a`, 'deny', 'AC3.7'],
      [`cp -t ${O} x`, null, 'AC3.8'], [`cp --target-directory=${O} x`, null, 'AC3.8'], [`cp -t ${D} x`, 'deny', 'AC3.8'],
    ]);
    expectAll([
      [`Move-Item ${T}/a ${O}/b`, null, 'AC3.9'], [`Move-Item -Path ${T}/a -Destination ${O}/b`, null, 'AC3.9'], [`Move-Item -LiteralPath ${T}/a -Destination ${O}/b`, null, 'AC3.9'],
      [`Move-Item ${O}/a ${O}/b`, 'deny', 'AC3.9'], [`Move-Item -Path ${T}/a -Destination:${D}/b`, 'deny', 'AC3.9'], [`Move-Item -Path:${O}/a -Destination ${T}/b`, 'deny', 'AC3.9'],
      [`Move-Item -LiteralPath:${O}/a -Destination ${T}/b`, 'deny', 'AC3.9'], [`Move-Item -LiteralPath ${O}/a -Destination ${T}/b`, 'deny', 'AC3.9'],
      [`Copy-Item -Path ${D}/a -Destination ${O}/b`, null, 'AC3.10'], [`Copy-Item -Path:${D}/a -Destination:${O}/b`, null, 'AC3.10'], [`Copy-Item -LiteralPath ${D}/a -Destination ${O}/b`, null, 'AC3.10'],
      [`Copy-Item -Path ${O}/a -Destination ${D}/b`, 'deny', 'AC3.10'], [`Copy-Item -Path ${O}/a -Destination:${D}/b`, 'deny', 'AC3.10'],
      [`Copy-Item -Path ${OUT}/a -Destination ${O}/b`, 'ask', 'AC3.10'], [`Copy-Item -Path:${OUT}/a -Destination ${O}/b`, 'ask', 'AC3.10'],
      [`Set-Content -Path:${D}/f -Value x`, 'deny', 'AC3.4'], [`Out-File -FilePath ${D}/f`, 'deny', 'AC3.4'], [`Out-File -FilePath ${O}/f`, null, 'AC3.4'],
      [`Remove-Item -Path ${O}/f`, 'deny', 'AC3.3'], [`Remove-Item -LiteralPath:${O}/f`, 'deny', 'AC3.3'], [`Remove-Item -Path:${T}/f`, null, 'AC3.3'],
    ], { tool: 'PowerShell' });

    expectAll([
      [`cp -rt ${OUT} x`, 'deny', 'AC3.8'], [`cp -rt ${O} x`, null, 'AC3.8'], [`cp -rt${O} x`, null, 'AC3.8'], [`cp -rt${OUT} x`, 'deny', 'AC3.8'],
      [`mv -vt ${O} ${T}/a`, null, 'AC3.7'], [`mv -vt ${T} ${O}/a`, 'deny', 'AC3.7'],
    ]);
    // D8: gốc <tmpdir>/claude luôn bị chặn, kể cả khi chỉ cần read.
    const CT = u(path.join(os.tmpdir(), 'claude'));
    expectAll([[`Copy-Item -Path ${CT} -Destination ${O}/b`, 'deny', 'D8'], [`Copy-Item -Path ${CT}/* -Destination ${O}/b`, 'deny', 'D8']], { tool: 'PowerShell' });
    expectAll([[`cp -Path ${D}/a -Destination ${O}/b`, null, 'AC3.10'], [`cp -LiteralPath ${D}/a -Destination ${O}/b`, null, 'AC3.10']], { tool: 'PowerShell' });

    const denyW = bd(`cp x ${D}/f`);
    const denyD = bd(`rm ${D}/f`);
    ok([denyW, denyD].every((d) => /fullPaths/.test(d.reason) && /fullRoots/.test(d.reason)) && /write/.test(denyW.reason) && /delete/.test(denyD.reason), 'AC6.2: reason deny nêu fullPaths, fullRoots và quyền thiếu');
    const asks = ['rm $X/f', `cat ${D}/.env`].map((c) => bd(c));
    ok(asks.every((a) => a?.decision === 'ask' && shapeOk(a.reason)), 'AC6.2: reason ask của guard-bash theo khuôn');
  } finally { fs.rmSync(tb, { recursive: true, force: true }); }
}
