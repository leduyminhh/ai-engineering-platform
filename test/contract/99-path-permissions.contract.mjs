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
    const dec = (tool, file, { cfg = config, extra = {}, opts = {} } = {}) => files.decide({ tool_name: tool, tool_input: { file_path: file }, cwd: P, permission_mode: 'bypassPermissions', ...extra },
      { scopes: {}, repoRoot: P, allowEnv: () => false, config: cfg, ...opts });
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

    const kindF = (tool, file, opt) => dec(tool, file, opt)?.decision ?? null;
    const S = path.join(tmp, 's');
    const CP = path.join(os.tmpdir(), 'claude', 'p');
    const ro = (p) => ({ path: p, allow: ['read'] });
    const rows = [
      ['AC4.1', { mode: 'full', fullReadRoots: [D], fullPaths: [{ path: path.join(D, 'out'), allow: ['read', 'write'] }] }, {}, [['Write', path.join(D, 'out', 'f'), null], ['Write', path.join(D, 'x'), 'deny'], ['Read', path.join(D, 'x'), null]]],
      ['AC4.2', { mode: 'full', fullRoots: [T], fullPaths: [ro(path.join(T, 'keep')), ro(path.join(P, 'sub')), ro(path.join(S, 'sub')), ro(CP)] }, { scratchpad_dir: S },
        [['Write', path.join(T, 'keep', 'f'), null], ['Write', path.join(P, 'sub', 'f'), null], ['Write', path.join(S, 'sub', 'f'), null], ['Write', path.join(CP, 'x'), null]]],
      ['AC4.3', { mode: 'full', fullPaths: [ro(W), { path: W, allow: ['write'] }] }, {}, [['Write', path.join(W, 'a.txt'), null], ['Read', path.join(W, 'a.txt'), null]]],
      ['AC5.2', { mode: 'full', fullReadRoots: [D] }, {}, [['Read', path.join(D, 'f'), null], ['Grep', path.join(D, 'f'), null], ['Write', path.join(D, 'f'), 'deny']]],
    ];
    for (const [ac, cfg, extra, cases] of rows) for (const [tool, file, want] of cases) ok(kindF(tool, file, { cfg, extra }) === want, `${ac}: ${tool} ${path.relative(tmp, file)} → ${want}`);

    // AC5.2: `*` trong fullReadRoots khớp đúng một đoạn như trên master; `*` trong fullPaths vẫn là ký tự thường (D4).
    const G = path.join(tmp, 'g', '*', 'data');
    const star = { mode: 'full', fullReadRoots: [G], fullPaths: [ro(path.join(tmp, 'q', '*'))] };
    for (const [tool, file, want] of [
      ['Read', path.join(tmp, 'g', 'a', 'data', 'f'), null], ['Grep', path.join(tmp, 'g', 'a', 'data', 'f'), null],
      ['Read', path.join(tmp, 'g', 'a', 'b', 'data', 'f'), 'ask'], ['Read', path.join(tmp, 'g', 'data', 'f'), 'ask'],
      ['Write', path.join(tmp, 'g', 'a', 'data', 'f'), 'deny'],
      ['Read', path.join(tmp, 'q', 'a', 'f'), 'ask'], ['Read', path.join(tmp, 'q', '*', 'f'), null],
    ]) ok(kindF(tool, file, { cfg: star }) === want, `AC5.2: ${tool} ${path.relative(tmp, file)} với * → ${want}`);

    // AC5.1: fullRoots: [T] đồng nghĩa mục đủ ba quyền; AC6.1: full không hiệu lực thì fullPaths không đổi kết quả.
    const probes = [['Read', T], ['Write', T], ['Write', D], ['Read', D], ['Read', O], ['Write', O], ['Read', X], ['Write', X], ['Read', path.join(T, '.env')], ['Write', path.join(T, '.env')]]
      .map(([tool, dir]) => [tool, path.join(dir, dir.endsWith('.env') ? '' : 'a.txt')]);
    const same = (a, b, extra = {}, optB = {}) => probes.every(([tool, f]) => JSON.stringify(dec(tool, f, { cfg: a, extra })) === JSON.stringify(dec(tool, f, { cfg: b, extra, opts: optB })));
    ok(same({ mode: 'full', fullRoots: [T] }, { mode: 'full', fullPaths: [{ path: T, allow: ['read', 'write', 'delete'] }] }), 'AC5.1: guard-files fullRoots: [T] ≡ mục đủ ba quyền');
    const withPaths = config.fullPaths;
    ok(same({ mode: 'ask', fullPaths: withPaths }, { mode: 'ask' }), 'AC6.1: guard-files mode ask → y hệt khi không có fullPaths');
    ok(same({ mode: 'full', fullPaths: withPaths }, { mode: 'full' }, { permission_mode: 'default' }), 'AC6.1: guard-files phiên không bypass → y hệt khi không có fullPaths');
    const trackedGate = (cfg) => ({ reader: () => ({ config: cfg, file: path.join(P, '.claude', 'aip-gate.json'), roots: [P] }), tracked: () => true });
    ok(probes.every(([tool, f]) => JSON.stringify(files.decide({ tool_name: tool, tool_input: { file_path: f }, cwd: P, permission_mode: 'bypassPermissions' }, { scopes: {}, repoRoot: P, allowEnv: () => false, ...trackedGate({ mode: 'full', fullPaths: withPaths }) }))
      === JSON.stringify(files.decide({ tool_name: tool, tool_input: { file_path: f }, cwd: P, permission_mode: 'bypassPermissions' }, { scopes: {}, repoRoot: P, allowEnv: () => false, ...trackedGate({ mode: 'full' }) }))), 'AC6.1: guard-files aip-gate.json bị git theo dõi → y hệt khi không có fullPaths');

    // AC2.1/AC2.2: chính <tmpdir>/claude bị chặn ở mọi công cụ file kể cả khi fullPaths cấp quyền; phần dưới nó vẫn là root.
    const CTF = path.join(os.tmpdir(), 'claude');
    const allTools = ['Read', 'Grep', ...WRITES];
    const grantTmp = { mode: 'full', fullPaths: [{ path: CTF, allow: ['read', 'write', 'delete'] }] };
    for (const tool of allTools) for (const f of [CTF, CTF + path.sep]) for (const cfg of [config, grantTmp]) {
      const d = dec(tool, f, { cfg });
      ok(d?.decision === 'deny' && /luôn/.test(d.reason) && !/fullRoots|fullPaths/.test(d.reason), `AC2.1: ${tool} vào gốc <tmpdir>/claude${f === CTF ? '' : '/'} → deny, không gợi ý khoá`);
    }
    ok(allTools.every((tool) => dec(tool, path.join(CTF, 'p', 'x')) === null), 'AC2.1: mọi công cụ vào dưới <tmpdir>/claude → cho qua');
    const OTHER = path.join(os.tmpdir(), 'aip-pp-khac', 'x');
    ok(dec('Write', OTHER)?.decision === 'deny' && dec('Read', OTHER)?.decision === 'ask', 'AC2.1: <tmpdir> ngoài thư mục claude → như cũ (Write deny, Read ask)');
    ok(allTools.every((tool) => dec(tool, CTF, { cfg: { mode: 'ask' } }) === null && dec(tool, CTF, { extra: { permission_mode: 'default' } }) === null
      && files.decide({ tool_name: tool, tool_input: { file_path: CTF }, cwd: P, permission_mode: 'bypassPermissions' }, { scopes: {}, repoRoot: P, allowEnv: () => false, ...trackedGate({ mode: 'full' }) }) === null),
    'AC2.2: mode ask, phiên không bypass hoặc aip-gate.json bị git theo dõi → gốc <tmpdir>/claude không bị chặn bởi mục này');
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
    const bd = (cmd, { tool = 'Bash', cfg = config, extra = {}, opts = {} } = {}) => bash.decide({ tool_name: tool, tool_input: { command: cmd }, cwd: P, permission_mode: 'bypassPermissions', ...extra },
      { repoRoot: P, config: cfg, allowEnv: () => false, currentBranch: () => 'feature/x', ...opts });
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
    // Cờ PowerShell có chữ `t` không được làm mất việc kiểm đích thật.
    expectAll(['-Filter a', '-WhatIf', '-filter a', '-Container', '-Force -Filter a'].map((f) => [`cp ${f} x ${OUT}/b`, 'deny', 'AC3.8']));
    expectAll([[`cp -Filter a x ${O}/b`, null, 'AC3.8']]);
    expectAll(['-tosession', '-toSession'].map((f) => [`cp ${f} s x ${OUT}/b`, 'deny', 'AC3.8']));
    // PowerShell nhận tiền tố tham số: `-t` là `-ToSession`, không phải GNU `-t DIR`.
    expectAll([[`cp -t s x ${OUT}/b`, 'deny', 'AC3.8'], [`mv -t s ${T}/a ${OUT}/b`, 'deny', 'AC3.7'], [`cp --target-directory=${O} x ${OUT}/b`, 'deny', 'AC3.8'],
      ['cp -t s x .claude/aip-gate.json', 'ask', 'AC3.8']], { tool: 'PowerShell' });
    expectAll([['echo "$(cp -t .claude/aip-gate.json x)"', 'ask', 'AC3.8']]);
    // D8: gốc <tmpdir>/claude luôn bị chặn, kể cả khi chỉ cần read.
    const CT = u(path.join(os.tmpdir(), 'claude'));
    expectAll([[`Copy-Item -Path ${CT} -Destination ${O}/b`, 'deny', 'D8'], [`Copy-Item -Path ${CT}/* -Destination ${O}/b`, 'deny', 'D8']], { tool: 'PowerShell' });
    expectAll([[`cp -Path ${D}/a -Destination ${O}/b`, null, 'AC3.10'], [`cp -LiteralPath ${D}/a -Destination ${O}/b`, null, 'AC3.10']], { tool: 'PowerShell' });

    // AC4.1–AC4.4: hợp quyền giữa root, scratchpad, <tmpdir>/claude và fullPaths; D11 chuẩn hoá đường dẫn.
    const S = u(path.join(tb, 's'));
    const CP = `${CT}/p`;
    const all = ['read', 'write', 'delete'];
    expectAll([[`rm ${D}/out/f`, 'deny', 'AC4.1'], [`cp x ${D}/out/f`, null, 'AC4.1'], [`cp x ${D}/x`, 'deny', 'AC4.1']],
      { cfg: { mode: 'full', fullReadRoots: [D], fullPaths: [{ path: `${D}/out`, allow: ['read', 'write'] }] } });
    expectAll([[`rm ${T}/keep/f`, null, 'AC4.2'], [`rm ${P}/sub/f`, null, 'AC4.2'], [`cp x ${P}/sub/f`, null, 'AC4.2'], [`rm ${S}/sub/f`, null, 'AC4.2'], [`rm ${CP}/x`, null, 'AC4.2']],
      { cfg: { mode: 'full', fullRoots: [T], fullPaths: [`${T}/keep`, `${P}/sub`, `${S}/sub`, CP].map((p) => ({ path: p, allow: ['read'] })) }, extra: { scratchpad_dir: S } });
    expectAll([[`rm ${T2}/f`, null, 'AC4.3'], [`cp x ${T2}/f`, null, 'AC4.3'], [`rm ${CT}`, 'deny', 'D8']],
      { cfg: { mode: 'full', fullPaths: [{ path: T2, allow: ['delete'] }, { path: T2, allow: ['write'] }, { path: CT, allow: all }] } });
    const tOpO = { mode: 'full', fullPaths: [{ path: T, allow: all }, { path: O, allow: ['read', 'write'] }] };
    expectAll([[`rm ${T}/../${path.basename(O)}/f`, 'deny', 'AC4.4'], [`rm ${T}/sub/../f`, null, 'AC4.4']], { cfg: tOpO });
    expectAll([[`rm ${T}/f`, null, 'AC4.4']], { cfg: { mode: 'full', fullPaths: [{ path: `${T}/`, allow: all }] } });
    if (process.platform === 'win32') {
      expectAll([[`rm ${T.toUpperCase()}/f`, null, 'AC4.4']], { cfg: { mode: 'full', fullPaths: [{ path: T.toLowerCase(), allow: all }] } });
      ok(fullPaths({ fullPaths: [{ path: T, allow: ['read'] }, { path: T.toUpperCase(), allow: ['write'] }] }).length === 1, 'AC4.4: hai mục chỉ khác hoa/thường gộp thành một');
    }

    // AC5.1/AC5.2/AC6.1: fullRoots ≡ ba quyền; fullReadRoots chỉ đọc; full không hiệu lực thì fullPaths vô tác dụng.
    const cmds = [`rm ${T}/f`, `rm ${O}/f`, `rm ${D}/f`, `cp x ${T}/f`, `cp x ${O}/f`, `cp x ${D}/f`, `mv ${T}/a ${T}/b`, `mv ${T}/a ${O}/b`, `mv ${O}/a ${T}/b`, `mv ${D}/a ${T}/b`, `mv -t ${T} ${T}/a`, `cp -t ${T} x`,
      `rm ${OUT}/f`, `cat ${T}/.env`, 'rm $X/f'];
    const same = (a, b, optA = {}, optB = {}) => cmds.every((c) => JSON.stringify(bd(c, { cfg: a, ...optA })) === JSON.stringify(bd(c, { cfg: b, ...optB })));
    ok(same({ mode: 'full', fullRoots: [T] }, { mode: 'full', fullPaths: [{ path: T, allow: all }] }), 'AC5.1: guard-bash fullRoots: [T] ≡ mục đủ ba quyền');
    expectAll([[`rm ${T}/f`, null, 'AC5.1'], [`mv ${T}/a ${T}/b`, null, 'AC5.1'], [`cp x ${T}/f`, null, 'AC5.1'], [`rm ${O}/f`, 'deny', 'AC5.1']], { cfg: { mode: 'full', fullRoots: [T] } });
    expectAll([[`rm ${D}/f`, 'deny', 'AC5.2'], [`cp x ${D}/f`, 'deny', 'AC5.2'], [`mv ${D}/a ${T}/b`, 'deny', 'AC5.2']], { cfg: { mode: 'full', fullReadRoots: [D] } });
    const bare = { mode: 'full' };
    ok(same({ ...bare, mode: 'ask', fullPaths: config.fullPaths }, { mode: 'ask' }), 'AC6.1: guard-bash mode ask → y hệt khi không có fullPaths');
    ok(same({ ...bare, fullPaths: config.fullPaths }, bare, { extra: { permission_mode: 'default' } }, { extra: { permission_mode: 'default' } }), 'AC6.1: guard-bash phiên không bypass → y hệt khi không có fullPaths');
    const trackedGate = (cfg) => ({ config: undefined, reader: () => ({ config: cfg, file: `${P}/.claude/aip-gate.json`, roots: [P] }), tracked: () => true });
    ok(same(null, null, { opts: trackedGate({ ...bare, fullPaths: config.fullPaths }) }, { opts: trackedGate(bare) }), 'AC6.1: guard-bash aip-gate.json bị git theo dõi → y hệt khi không có fullPaths');

    // mv với -t gộp/dính: nguồn cuối vẫn bị xoá nên mọi đối số cần delete+write.
    expectAll([[`mv -vt ${T} ${T}/a ${O}/b`, 'deny', 'AC3.7'], [`mv -t${T} ${T}/a ${O}/b`, 'deny', 'AC3.7'], [`mv -vt${T} ${T}/a ${O}/b`, 'deny', 'AC3.7'],
      [`mv -vt ${T} ${T}/a ${T}/b`, null, 'AC3.7']]);
    // PowerShell viết tắt tham số: không nhận ra cờ thì mọi đối số vị trí cần delete+write.
    expectAll([[`Move-Item -Dest ${T}/b ${O}/a`, 'deny', 'AC3.9'], [`Move-Item -Dest ${T}/b -Pa ${O}/a`, 'deny', 'AC3.9'], [`Move-Item -Dest:${O}/b ${T}/a`, 'deny', 'AC3.9'],
      [`Move-Item -Dest ${T}/b ${T}/a`, null, 'AC3.9']], { tool: 'PowerShell' });
    // cp -t vẫn để kiểm cấu hình hook thấy đối số vị trí (mode ask, phiên thường).
    const askMode = { cfg: { mode: 'ask' }, extra: { permission_mode: 'default' } };
    expectAll([['cp -t .claude aip-gate.json', 'ask', 'AC3.8'], ['cp --target-directory=.claude /s/aip-gate.json', 'ask', 'AC3.8'], ['cp -t .claude .claude/settings.local.json', 'ask', 'AC3.8']], askMode);
    expectAll([[`cp -t ${O} x`, null, 'AC3.8']]);

    // R18: cp/mv vào thư mục .claude với nguồn tên file cấu hình hook phải hỏi ở mọi chế độ.
    const r18 = (rows, opt) => { expectAll(rows, askMode); expectAll(rows, opt); };
    r18([...['cp settings.json .claude/', 'cp -t .claude settings.json', 'cp -t .claude /s/settings.local.json', 'mv -t .claude settings.json', 'mv settings.json .claude',
      'cp aip-gate.json .claude', 'cp --target-directory=.claude settings.json', 'cp a settings.json .claude/', 'cp Settings.JSON .CLAUDE/'].map((c) => [c, 'ask', 'AC1.1']),
    ...['cp x.json .claude/', 'cp settings.json out/', 'cp .claude/settings.json out/x'].map((c) => [c, null, 'AC1.3'])], {});
    const psAsk = { ...askMode, tool: 'PowerShell' };
    const psRows = ['Copy-Item settings.json .claude\\', 'Copy-Item -Path settings.json -Destination .claude', 'Copy-Item -Path settings.json -Destination .claude\\', 'Move-Item settings.json .claude',
      'Copy-Item -Path:settings.json -Destination .claude', 'Copy-Item -Destination:.claude -Path:settings.json', 'Copy-Item settings.json,aip-gate.json .claude', 'Copy-Item -Path settings.json,x.json -Destination .claude'].map((c) => [c, 'ask', 'AC1.2']);
    expectAll(psRows, psAsk);
    expectAll(psRows, { tool: 'PowerShell' });
    // Nguồn chỉ đọc không phải đích ghi: không hỏi R18 khi .claude/settings.json chỉ là nguồn (AC1.3).
    const readOnlyCfg = [['Copy-Item -Path .claude/settings.json -Destination out\\x', null, 'AC1.3']];
    expectAll(readOnlyCfg, psAsk);
    expectAll(readOnlyCfg, { tool: 'PowerShell' });
    r18([['cp -t backup .claude settings.json', null, 'AC1.3']], {});

    // AC3.1–AC3.3: nguồn vị trí của cp/Copy-Item cần read, Move-Item -Path chỉ đòi write ở đích vị trí.
    expectAll([
      ...[`cp ${OUT}/a ${O}/b`, `cp ${OUT}/a ${OUT}/b2 ${O}/`, `cp -t ${O} ${OUT}/a`, `cp ${OUT}/* ${O}/`, 'cp $X/a ' + `${O}/b`].map((c) => [c, 'ask', 'AC3.1']),
      ...[`cp ${T}/a ${O}/b`, `cp ${D}/a ${O}/b`, `cp -t ${O} ${D}/a`, `cp x ${O}/b`].map((c) => [c, null, 'AC3.1']),
      [`cp ${OUT}/a ${D}/b`, 'deny', 'AC3.1'], [`cp -rt ${O} ${OUT}/a`, 'deny', 'AC3.1'],
    ]);
    expectAll([
      ...[`Copy-Item ${OUT}/a ${O}/b`, `cp ${OUT}/a ${O}/b`, `copy ${OUT}/a ${O}/b`, `Copy-Item -Destination ${O}/b ${OUT}/a`, `Copy-Item -Path ${OUT}/a ${O}/b`].map((c) => [c, 'ask', 'AC3.2']),
      ...[`Copy-Item ${D}/a ${O}/b`, `Copy-Item -Destination ${O}/b ${D}/a`, `Copy-Item -Path ${D}/a ${O}/b`].map((c) => [c, null, 'AC3.2']),
      [`Copy-Item ${D}/a ${D}/b`, 'deny', 'AC3.2'],
      ...[`Move-Item -Path ${T}/a ${O}/b`, `Move-Item -LiteralPath ${T}/a ${O}/b`, `Move-Item -Destination ${O}/b ${T}/a`, `Move-Item ${T}/a ${O}/b`].map((c) => [c, null, 'AC3.3']),
      ...[`Move-Item -Path ${O}/a ${O}/b`, `Move-Item -Path ${T}/a ${D}/b`, `Move-Item -Destination ${O}/b ${O}/a`, `Move-Item -Dest ${T}/b ${O}/a`].map((c) => [c, 'deny', 'AC3.3']),
      // Mảng dấu phẩy của PowerShell: mỗi phần tử là một đích riêng, một phần tử ngoài root là đủ để chặn/hỏi.
      ...[`Move-Item -Path ${T}/a,${OUT}/b ${O}/x`, `Move-Item -Path ${T}/a,${OUT}/b -Destination ${T}/x`, `Remove-Item ${T}/a,${OUT}/b`, `Remove-Item -Path ${T}/a,${OUT}/b`,
        `Set-Content -Path ${O}/a,${OUT}/b -Value x`].map((c) => [c, 'deny', 'AC3.3']),
      ...[`Copy-Item -Path ${T}/a,${OUT}/b ${O}/x`, `Copy-Item ${D}/a,${OUT}/b ${O}/x`].map((c) => [c, 'ask', 'AC3.2']),
      ...[`Remove-Item ${T}/a,${T}/b`, `Move-Item -Path ${T}/a,${T}/b ${O}/x`].map((c) => [c, null, 'AC3.3']),
      // Tham số có giá trị đứng trước đối số vị trí không được làm lệch slot Path/Destination.
      ...[`Copy-Item -Filter *.txt ${D}/a ${O}/b`, `Copy-Item -Include *.txt ${D}/a ${O}/b`, `Copy-Item -Exclude x ${D}/a ${O}/b`, `Copy-Item -Credential c ${D}/a ${O}/b`,
        `Copy-Item -Force -Filter *.txt -Recurse ${D}/a ${O}/b`, `Move-Item -Filter *.txt ${T}/a ${O}/b`].map((c) => [c, null, 'AC3.2']),
      ...[`Copy-Item -Filter *.txt ${OUT}/a ${O}/b`, `Copy-Item -ToSession s ${OUT}/a ${O}/b`].map((c) => [c, 'ask', 'AC3.2']),
      [`Copy-Item -Filter *.txt ${O}/a ${D}/b`, 'deny', 'AC3.2'],
    ], { tool: 'PowerShell' });

    // Glob kèm `..` sau đoạn glob đầu có thể thoát ra ngoài thư mục đã phân loại.
    expectAll([[`rm ${T}/*/../../d/f`, 'ask', 'AC4.5'], [`rm ${T}/?/../../d/f`, 'ask', 'AC4.5'], [`rm ${T}/[a]/../../d/f`, 'ask', 'AC4.5'], [`rm ${T}/*`, null, 'AC4.5'], [`rm ${O}/*`, 'deny', 'AC4.5']]);
    // Token cờ gộp dài kết thúc bằng xuống dòng không được làm regex chạy bậc hai.
    const t0 = performance.now();
    bd(`cp "-${'t'.repeat(50000)}\n" x`);
    ok(performance.now() - t0 < 1000, 'AC3.8: token cờ gộp 50k ký tự chạy dưới 1s');
    // Thiếu read hỏi bằng câu riêng và dòng tóm tắt gắn nhãn đúng vai.
    const rd = bd(`Copy-Item -Path ${u(path.join(tb, 'out'))}/a -Destination ${O}/b`, { tool: 'PowerShell' });
    ok(rd?.decision === 'ask' && shapeOk(rd.reason) && /đọc/.test(rd.reason) && !/\$VAR/.test(rd.reason) && !/ghi vào/.test(rd.reason), 'AC3.10: thiếu read → ask câu riêng, tóm tắt không ghi nhầm "ghi vào"');
    const blk = bd(`Copy-Item -Path ${CT} -Destination ${O}/b`, { tool: 'PowerShell' });
    ok(blk?.decision === 'deny' && /luôn/.test(blk.reason) && !/fullRoots/.test(blk.reason), 'AC3.10: gốc <tmpdir>/claude → deny câu riêng, không gợi ý mở bằng cấu hình');

    const denyW = bd(`cp x ${D}/f`);
    const denyD = bd(`rm ${D}/f`);
    ok([denyW, denyD].every((d) => /fullPaths/.test(d.reason) && /fullRoots/.test(d.reason)) && /write/.test(denyW.reason) && /delete/.test(denyD.reason), 'AC6.2: reason deny nêu fullPaths, fullRoots và quyền thiếu');
    const asks = ['rm $X/f', `cat ${D}/.env`].map((c) => bd(c));
    ok(asks.every((a) => a?.decision === 'ask' && shapeOk(a.reason)), 'AC6.2: reason ask của guard-bash theo khuôn');
  } finally { fs.rmSync(tb, { recursive: true, force: true }); }
}
