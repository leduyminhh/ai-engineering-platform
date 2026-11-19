// Contract quyền theo thư mục (khoá fullPaths của aip-gate.json).
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, pathToFileURL, CORE_DIR } = ctx;
  const { runMode } = await import(pathToFileURL(path.join(CORE_DIR, '..', 'cli', 'lib', 'mode.mjs')).href);

  const { fullPaths, classifyPath, denyOutsideText, CLAUDE_TMP_BLOCKED_TEXT } = await import(pathToFileURL(path.join(CORE_DIR, 'hooks', 'scripts', 'gate-config.mjs')).href);
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

  // Câu deny dùng chung (kiểu list_roots): liệt kê root có đúng quyền đang thiếu để agent biết được làm ở đâu.
  const deny = denyOutsideText;
  const G = (p, allow, glob = false) => ({ path: p, allow, ...(glob ? { glob: true } : {}) });
  const ALL = ['read', 'write', 'delete'];
  const gT = G('/aip-dt-t', ALL);
  const gO = G('/aip-dt-o', ['read', 'write']);
  const gD = G('/aip-dt-d', ['read']);
  const rootLine = (s) => s.split('\n').find((l) => /^Được (ghi|xoá):/.test(l)) ?? '';
  // Thứ tự root trong dòng "Được ghi:" phụ thuộc nguồn khai (fullRoots đứng trước fullPaths): sắp xếp để so tập root mà không so thứ tự.
  const normRoots = (d) => (d?.reason ? { ...d, reason: d.reason.replace(/^(Được (?:ghi|xoá): )(.*)$/m, (_, p, rest) => p + (rest.match(/`[^`]*`/g) ?? []).sort().join(', ') + (/, … .*$/.exec(rest)?.[0] ?? '')) } : d);
  {
    const w = deny('write', [gT, gO, gD], 'ghi vào thư mục');
    ok(rootLine(w).startsWith('Được ghi:') && rootLine(w).includes(gT.path) && rootLine(w).includes(gO.path) && !rootLine(w).includes(gD.path), 'AC2.1: write chỉ liệt kê root có quyền write');
    ok(/^Chế độ full chỉ cho phép ghi vào thư mục có quyền write;/.test(w) && /fullPaths/.test(w) && /fullRoots/.test(w) && w.includes('"write"'), 'AC2.1: câu deny vẫn nêu quyền thiếu, fullPaths và fullRoots');
    const d = deny('delete', [gT, gO, gD], 'lệnh này ở thư mục');
    ok(rootLine(d).startsWith('Được xoá:') && rootLine(d).includes(gT.path) && !rootLine(d).includes(gO.path) && !rootLine(d).includes(gD.path), 'AC2.1: delete chỉ liệt kê root có quyền delete');
    ok(d.split('\n').length === 3 && d.split('\n').at(-1).includes('"delete"'), 'AC2.1: thứ tự câu quyền → dòng root → câu xin thêm quyền');
    ok(deny('write', [], 'ghi vào thư mục') === 'Chế độ full chỉ cho phép ghi vào thư mục có quyền write; đường dẫn chưa có. Cần mở rộng → thêm vào "fullPaths" (allow có "write") hoặc "fullRoots" trong .claude/aip-gate.json.',
      'AC1.4: không root nào có quyền thì không có dòng root, câu giữ nguyên một dòng');
    ok(rootLine(deny('write', [gD, G('/aip-dt-g', ALL, true)], 'x')) === '' && rootLine(deny('read', [gT], 'x')) === '', 'AC1.4: root chỉ-đọc, root glob và need read không sinh dòng root');
    const many = Array.from({ length: 8 }, (_, i) => G(`/aip-dt-r${i}`, ALL));
    const ml = rootLine(deny('write', many, 'x'));
    ok(many.slice(0, 6).every((g) => ml.includes(g.path)) && !ml.includes(many[6].path) && ml.endsWith('… và 2 mục khác'), 'AC1.3: hơn 6 root chỉ liệt kê 6 mục, nêu "… và 2 mục khác"');
    ok(rootLine(deny('write', many.slice(0, 6), 'x')).endsWith('`') && !/mục khác/.test(deny('write', many.slice(0, 6), 'x')), 'AC1.3: đúng 6 root không có "mục khác"');
    // Ký tự bẩn đặt ở đuôi: showArg giữ 80 ký tự cuối nên ký tự bẩn đầu chuỗi sẽ bị cắt mất và test không kiểm gì.
    const dirty = G('D:/' + 'a'.repeat(120) + 'z'.repeat(10) + '`\nc\u202e' + 'z'.repeat(40), ALL);
    const dt = deny('write', [dirty], 'x');
    const dl = rootLine(dt);
    ok(dt.split('\n').length === 3 && (dl.match(/`/g) ?? []).length === 2 && !dl.includes('\u202e') && dl.includes('z'.repeat(40)) && !dl.includes('a'.repeat(30)) && dl.slice(dl.indexOf('`') + 1, dl.lastIndexOf('`')).length <= 81,
      'AC1.3: đường dẫn root có xuống dòng, backtick, bidi, quá dài không chèn dòng giả và chỉ giữ 80 ký tự cuối');
    ok(/z{10} c z{40}/.test(dl), 'AC1.3: ký tự bẩn ở đuôi bị thay bằng khoảng trắng, không còn trong dòng root');
    const dup = [G('/aip-dt-t', ALL), G('/aip-dt-t/', ALL)];
    ok((rootLine(deny('write', dup, 'x')).match(/aip-dt-t/g) ?? []).length === 1, 'AC1.3: hai grant cùng đường dẫn (một có đuôi /) chỉ hiện một lần');
    const dup7 = [...many.slice(0, 6), G('/aip-dt-r0/', ALL)];
    ok(!/mục khác/.test(deny('write', dup7, 'x')) && (rootLine(deny('write', dup7, 'x')).match(/`/g) ?? []).length === 12, 'AC1.3: 7 mục có 2 mục trùng nhau → 6 mục, không có "mục khác"');
    const tmpRoot = path.join(os.tmpdir(), 'claude');
    ok(rootLine(deny('write', [G(tmpRoot, ALL)], 'x')).includes(`${tmpRoot}/…`), 'AC2.1: root <tmpdir>/claude hiện dạng <tmpdir>/claude/… (chỉ phần dưới nó là root)');
  }

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
  const ADVICE = /cho phép|từ chối|nên |hãy |khuyên|agent muốn/i;
  const shapeOk = (reason) => {
    const lines = String(reason).split('\n');
    const main = lines.filter((l) => !l.startsWith('Lệnh gồm')).join(' ');
    return typeof reason === 'string' && !BANNED.some((w) => reason.toLowerCase().includes(w.toLowerCase())) && !ADVICE.test(main) && main.length <= 500 && lines.length <= 2;
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
    ok(rw?.decision === 'deny' && dec('Write', path.join(W, 'a.txt')) === null, 'AC3.2: mục chỉ ["write"] → Read deny, Write cho qua');
    ok(dec('Read', path.join(D, '.env'))?.decision === 'deny' && dec('Read', path.join(O, '.env'))?.decision === 'deny' && dec('Read', path.join(T, '.env')) === null, 'AC6.3: Read .env chỉ miễn khi đủ ba quyền');
    ok(dec('Write', path.join(O, '.env'))?.decision === 'deny' && dec('Write', path.join(T, '.env')) === null
      && dec('Write', path.join(D, '.env'))?.decision === 'deny' && dec('Write', path.join(P, '.env')) === null, 'AC6.4: Write .env: O deny, T qua, D deny, project qua');
    const denies = [rw, dec('Read', path.join(D, '.env')), dec('Write', path.join(O, '.env')), dec('Read', path.join(X, 'a.txt'))];
    ok(denies.every((a) => a?.decision === 'deny' && a.reason.includes('Mở:')), 'AC6.2: reason deny ở confined có "Mở:" (cả .env thiếu quyền và đọc ngoài mọi mục)');
    // Ca ask còn lại ở guarded (mode ask + bypass): ghi file cấu hình quyền vẫn theo khuôn ask.
    const askCfg = dec('Write', path.join(P, '.claude', 'aip-gate.json'), { cfg: { mode: 'ask' } });
    ok(askCfg?.decision === 'ask' && shapeOk(askCfg.reason), 'AC6.2: reason ask của guard-files ở guarded theo khuôn');
    ok(denies[3].reason.includes(path.join(X, 'a.txt')), 'AC3.11: Read ngoài mọi mục → deny nêu đường dẫn');

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
      ['Read', path.join(tmp, 'g', 'a', 'b', 'data', 'f'), 'deny'], ['Read', path.join(tmp, 'g', 'data', 'f'), 'deny'],
      ['Write', path.join(tmp, 'g', 'a', 'data', 'f'), 'deny'],
      ['Read', path.join(tmp, 'q', 'a', 'f'), 'deny'], ['Read', path.join(tmp, 'q', '*', 'f'), null],
    ]) ok(kindF(tool, file, { cfg: star }) === want, `AC5.2: ${tool} ${path.relative(tmp, file)} với * → ${want}`);

    // AC5.1: fullRoots: [T] đồng nghĩa mục đủ ba quyền; AC6.1: full không hiệu lực thì fullPaths không đổi kết quả.
    const probes = [['Read', T], ['Write', T], ['Write', D], ['Read', D], ['Read', O], ['Write', O], ['Read', X], ['Write', X], ['Read', path.join(T, '.env')], ['Write', path.join(T, '.env')]]
      .map(([tool, dir]) => [tool, path.join(dir, dir.endsWith('.env') ? '' : 'a.txt')]);
    const same = (a, b, extra = {}, optB = {}) => probes.every(([tool, f]) => JSON.stringify(normRoots(dec(tool, f, { cfg: a, extra }))) === JSON.stringify(normRoots(dec(tool, f, { cfg: b, extra, opts: optB }))));
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
    ok(dec('Write', OTHER)?.decision === 'deny' && dec('Read', OTHER)?.decision === 'deny', 'AC2.1: <tmpdir> ngoài thư mục claude → như cũ (Write deny, Read deny ở confined)');
    ok(allTools.every((tool) => dec(tool, CTF, { cfg: { mode: 'ask' } }) === null && dec(tool, CTF, { extra: { permission_mode: 'default' } }) === null
      && files.decide({ tool_name: tool, tool_input: { file_path: CTF }, cwd: P, permission_mode: 'bypassPermissions' }, { scopes: {}, repoRoot: P, allowEnv: () => false, ...trackedGate({ mode: 'full' }) }) === null),
    'AC2.2: mode ask, phiên không bypass hoặc aip-gate.json bị git theo dõi → gốc <tmpdir>/claude không bị chặn bởi mục này');
    // Deny ghi ngoài root liệt kê root có quyền write (kiểu list_roots); D chỉ read nên không có mặt.
    for (const tool of WRITES) {
      const d = dec(tool, path.join(X, 'a.txt'));
      const l = rootLine(d?.reason ?? '');
      ok(d?.decision === 'deny' && l.startsWith('Được ghi:') && [P, O, T, W].every((p) => l.includes(p)) && !l.includes(D) && /fullPaths/.test(d.reason) && /fullRoots/.test(d.reason) && /"write"/.test(d.reason),
        `AC1.2: ${tool} vào ngoài root → deny, dòng "Được ghi:" liệt kê root có quyền write, vẫn nêu fullPaths và fullRoots`);
    }
    ok(WRITES.every((tool) => dec(tool, CTF)?.reason === CLAUDE_TMP_BLOCKED_TEXT) && dec('Read', OTHER)?.decision === 'deny' && !/Được (ghi|xoá):/.test(dec('Read', OTHER).reason),
      'AC1.5: deny gốc <tmpdir>/claude giữ nguyên chữ, deny đọc ngoài root không có dòng root');
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
    // Cùng một bảng chạy ở guarded (ask) và confined (deny): hàng `ask` đổi thành `deny` khi chạy ở confined + bypass.
    const toDeny = (rows) => rows.map(([c, w, ac]) => [c, w === 'ask' ? 'deny' : w, ac]);
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
      ['rm $X/f', 'deny', 'AC3.11'], ['cat > ~/f', 'deny', 'AC3.11'], ['rm `pwd`/f', 'deny', 'AC3.11'], [`bash -c "rm ${T}/f"`, 'deny', 'AC3.11'],
      [`cat ${D}/.env`, 'deny', 'AC6.3'], [`cat ${T}/.env`, null, 'AC6.3'],
    ]);

    const OUT = u(path.join(tb, 'out'));
    // Token mảng PowerShell chỉ có dấu phẩy ở đầu vẫn là một đích riêng (mọi lệnh PowerShell, không riêng Set-Content).
    expectAll([[`Remove-Item ${T}/a ,${OUT}/b`, 'deny', 'AC3.3']], { tool: 'PowerShell' });
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
      [`Copy-Item -Path ${OUT}/a -Destination ${O}/b`, 'deny', 'AC3.10'], [`Copy-Item -Path:${OUT}/a -Destination ${O}/b`, 'deny', 'AC3.10'],
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
      ['cp -t s x .claude/aip-gate.json', 'deny', 'AC3.8']], { tool: 'PowerShell' });
    expectAll([['echo "$(cp -t .claude/aip-gate.json x)"', 'deny', 'AC3.8']]);
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
    const same = (a, b, optA = {}, optB = {}) => cmds.every((c) => JSON.stringify(normRoots(bd(c, { cfg: a, ...optA }))) === JSON.stringify(normRoots(bd(c, { cfg: b, ...optB }))));
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
    const r18 = (rows, opt) => { expectAll(rows, askMode); expectAll(toDeny(rows), opt); };
    r18([...['cp settings.json .claude/', 'cp -t .claude settings.json', 'cp -t .claude /s/settings.local.json', 'mv -t .claude settings.json', 'mv settings.json .claude',
      'cp aip-gate.json .claude', 'cp --target-directory=.claude settings.json', 'cp a settings.json .claude/', 'cp Settings.JSON .CLAUDE/',
      'cp settings.json .claude/.', 'cp settings.json .claude/./', 'cp -t .claude/. settings.json', 'cp settings.json .claude/sub/..'].map((c) => [c, 'ask', 'AC1.1']),
    ...['cp x.json .claude/', 'cp settings.json out/', 'cp .claude/settings.json out/x'].map((c) => [c, null, 'AC1.3'])], {});
    const psAsk = { ...askMode, tool: 'PowerShell' };
    const psRows = ['Copy-Item settings.json .claude\\', 'Copy-Item -Path settings.json -Destination .claude', 'Copy-Item -Path settings.json -Destination .claude\\', 'Move-Item settings.json .claude',
      'Copy-Item -Path:settings.json -Destination .claude', 'Copy-Item -Destination:.claude -Path:settings.json', 'Copy-Item settings.json,aip-gate.json .claude', 'Copy-Item -Path settings.json,x.json -Destination .claude', 'Copy-Item settings.json .claude\\sub\\..'].map((c) => [c, 'ask', 'AC1.2']);
    expectAll(psRows, psAsk);
    expectAll(toDeny(psRows), { tool: 'PowerShell' });
    // Nguồn chỉ đọc không phải đích ghi: không hỏi R18 khi .claude/settings.json chỉ là nguồn (AC1.3).
    const readOnlyCfg = [['Copy-Item -Path .claude/settings.json -Destination out\\x', null, 'AC1.3']];
    expectAll(readOnlyCfg, psAsk);
    expectAll(readOnlyCfg, { tool: 'PowerShell' });
    r18([['cp -t backup .claude settings.json', null, 'AC1.3']], {});

    // AC3.1–AC3.3: nguồn vị trí của cp/Copy-Item cần read, Move-Item -Path chỉ đòi write ở đích vị trí.
    expectAll([
      ...[`cp ${OUT}/a ${O}/b`, `cp ${OUT}/a ${OUT}/b2 ${O}/`, `cp -t ${O} ${OUT}/a`, `cp ${OUT}/* ${O}/`, 'cp $X/a ' + `${O}/b`].map((c) => [c, 'deny', 'AC3.1']),
      ...[`cp ${T}/a ${O}/b`, `cp ${D}/a ${O}/b`, `cp -t ${O} ${D}/a`, `cp x ${O}/b`].map((c) => [c, null, 'AC3.1']),
      [`cp ${OUT}/a ${D}/b`, 'deny', 'AC3.1'], [`cp -rt ${O} ${OUT}/a`, 'deny', 'AC3.1'],
    ]);
    expectAll([
      ...[`Copy-Item ${OUT}/a ${O}/b`, `cp ${OUT}/a ${O}/b`, `copy ${OUT}/a ${O}/b`, `Copy-Item -Destination ${O}/b ${OUT}/a`, `Copy-Item -Path ${OUT}/a ${O}/b`].map((c) => [c, 'deny', 'AC3.2']),
      ...[`Copy-Item ${D}/a ${O}/b`, `Copy-Item -Destination ${O}/b ${D}/a`, `Copy-Item -Path ${D}/a ${O}/b`].map((c) => [c, null, 'AC3.2']),
      [`Copy-Item ${D}/a ${D}/b`, 'deny', 'AC3.2'],
      ...[`Move-Item -Path ${T}/a ${O}/b`, `Move-Item -LiteralPath ${T}/a ${O}/b`, `Move-Item -Destination ${O}/b ${T}/a`, `Move-Item ${T}/a ${O}/b`].map((c) => [c, null, 'AC3.3']),
      ...[`Move-Item -Path ${O}/a ${O}/b`, `Move-Item -Path ${T}/a ${D}/b`, `Move-Item -Destination ${O}/b ${O}/a`, `Move-Item -Dest ${T}/b ${O}/a`].map((c) => [c, 'deny', 'AC3.3']),
      // Mảng dấu phẩy của PowerShell: mỗi phần tử là một đích riêng, một phần tử ngoài root là đủ để chặn/hỏi.
      ...[`Move-Item -Path ${T}/a,${OUT}/b ${O}/x`, `Move-Item -Path ${T}/a,${OUT}/b -Destination ${T}/x`, `Remove-Item ${T}/a,${OUT}/b`, `Remove-Item -Path ${T}/a,${OUT}/b`,
        `Set-Content -Path ${O}/a,${OUT}/b -Value x`].map((c) => [c, 'deny', 'AC3.3']),
      ...[`Copy-Item -Path ${T}/a,${OUT}/b ${O}/x`, `Copy-Item ${D}/a,${OUT}/b ${O}/x`].map((c) => [c, 'deny', 'AC3.2']),
      ...[`Remove-Item ${T}/a,${T}/b`, `Move-Item -Path ${T}/a,${T}/b ${O}/x`].map((c) => [c, null, 'AC3.3']),
      // Tham số có giá trị đứng trước đối số vị trí không được làm lệch slot Path/Destination.
      ...[`Copy-Item -Filter *.txt ${D}/a ${O}/b`, `Copy-Item -Include *.txt ${D}/a ${O}/b`, `Copy-Item -Exclude x ${D}/a ${O}/b`, `Copy-Item -Credential c ${D}/a ${O}/b`,
        `Copy-Item -Force -Filter *.txt -Recurse ${D}/a ${O}/b`, `Move-Item -Filter *.txt ${T}/a ${O}/b`].map((c) => [c, null, 'AC3.2']),
      ...[`Copy-Item -Filter *.txt ${OUT}/a ${O}/b`, `Copy-Item -ToSession s ${OUT}/a ${O}/b`].map((c) => [c, 'deny', 'AC3.2']),
      [`Copy-Item -Filter *.txt ${O}/a ${D}/b`, 'deny', 'AC3.2'],
      // Tham số chung có giá trị (-ErrorAction, -OutVariable…) cũng không được làm lệch slot.
      ...[`Copy-Item -ErrorAction SilentlyContinue ${D}/a ${O}/b`, `Copy-Item -ErrorAction Stop ${D}/a ${O}/b`, `Copy-Item -OutVariable v ${D}/a ${O}/b`].map((c) => [c, null, 'AC3.2']),
      [`Copy-Item -Recurse -ErrorAction Stop ${OUT}/a ${O}/b`, 'deny', 'AC3.2'],
      // Chuỗi trong nháy có dấu phẩy là một đường dẫn literal: vẫn phải xét cả token gốc, không chỉ các phần đã tách (phần sau `..` resolve theo cwd khác).
      ...[`cd ${P}/a/b; Remove-Item '${T}/x,m/../../${path.basename(OUT)}/f'`, `cd ${P}/a/b; Set-Content -Path '${O}/x,m/../../${path.basename(OUT)}/f' -Value y`].map((c) => [c, 'deny', 'AC3.3']),
      // Đường dẫn rỗng là không xác định: không được bị bỏ khi tách dấu phẩy.
      ...[`Remove-Item ''`, `Remove-Item ${T}/a ''`].map((c) => [c, 'deny', 'AC3.3']),
    ], { tool: 'PowerShell' });

    // Glob kèm `..` sau đoạn glob đầu có thể thoát ra ngoài thư mục đã phân loại.
    expectAll([[`rm ${T}/*/../../d/f`, 'deny', 'AC4.5'], [`rm ${T}/?/../../d/f`, 'deny', 'AC4.5'], [`rm ${T}/[a]/../../d/f`, 'deny', 'AC4.5'], [`rm ${T}/*`, null, 'AC4.5'], [`rm ${O}/*`, 'deny', 'AC4.5']]);
    // AC4.1: đoạn glob khớp được `..` (bash < 5.2, dash) thoát khỏi thư mục đã phân loại nên phải hỏi; đoạn không khớp được `..` giữ nguyên.
    expectAll([
      ...[`rm ${T}/.?/d/f`, `rm ${T}/..*/d/f`, `rm ${T}/.[.]/d/f`, `rm ${T}/.*/d/f`, `rm ${T}/.*`, `cp x ${T}/.?/f`].map((c) => [c, 'deny', 'AC4.1']),
      ...[`rm ${T}/.[!.]*/f`, `rm ${T}/.git*/f`, `rm ${T}/*/d/f`, `rm ${T}/a?/f`, `rm ${T}/.?x/f`].map((c) => [c, null, 'AC4.1']),
      // Lớp ký tự POSIX khớp `..` trên dash; biến trong đoạn glob hoặc sau nó có thể là `.`/`..`.
      ...[`rm ${T}/.[[:punct:]]/d/f`, `rm ${T}/.[![:alpha:]]/d/f`, `rm ${T}/.[[=.=]]/d/f`, `X=.; rm ${T}/$X?/d/f`, `X=.; rm ${T}/$X*/d/f`, `rm ${T}/*/$X/f`].map((c) => [c, 'deny', 'AC4.1']),
      // Thư mục trước đoạn glob đã thiếu quyền thì vẫn deny như trước, không hạ xuống ask.
      ...[`rm ${O}/.*`, `rm ${OUT}/.*`, `rm ${O}/.?/d/f`].map((c) => [c, 'deny', 'AC4.1']),
    ]);
    // Dãy `*` dài kết thúc bằng ký tự thường không được làm regex backtrack bậc hai.
    const tGlob = performance.now();
    bd(`rm ${T}/.${'*'.repeat(10000)}x/d/f`);
    ok(performance.now() - tGlob < 1000, 'AC4.1: đoạn glob 10k dấu * chạy dưới 1s');
    // Token cờ gộp dài kết thúc bằng xuống dòng không được làm regex chạy bậc hai.
    const t0 = performance.now();
    bd(`cp "-${'t'.repeat(50000)}\n" x`);
    ok(performance.now() - t0 < 1000, 'AC3.8: token cờ gộp 50k ký tự chạy dưới 1s');
    // Thiếu read hỏi bằng câu riêng và dòng tóm tắt gắn nhãn đúng vai.
    const rd = bd(`Copy-Item -Path ${u(path.join(tb, 'out'))}/a -Destination ${O}/b`, { tool: 'PowerShell' });
    ok(rd?.decision === 'deny' && rd.reason.includes('Mở:') && /đọc/.test(rd.reason) && !/\$VAR/.test(rd.reason) && !/ghi vào/.test(rd.reason), 'AC3.10: thiếu read → deny câu riêng có "Mở:", không ghi nhầm "ghi vào"');
    const blk = bd(`Copy-Item -Path ${CT} -Destination ${O}/b`, { tool: 'PowerShell' });
    ok(blk?.decision === 'deny' && /luôn/.test(blk.reason) && !/fullRoots/.test(blk.reason), 'AC3.10: gốc <tmpdir>/claude → deny câu riêng, không gợi ý mở bằng cấu hình');

    // Dòng "Lệnh gồm" của popup nêu đích ghi (thứ gây ra câu hỏi), không nêu nguồn đọc đứng đầu.
    const sum = bd('cp x $X/b');
    ok(sum?.decision === 'deny' && sum.reason.includes('Mở:') && !/\(đọc x\)/.test(sum.reason), 'AC3.1: confined chặn đích ghi chưa rõ bằng câu có "Mở:", không nêu nguồn đọc');

    const denyW = bd(`cp x ${D}/f`);
    const denyD = bd(`rm ${D}/f`);
    ok([denyW, denyD].every((d) => /fullPaths/.test(d.reason) && /fullRoots/.test(d.reason)) && /write/.test(denyW.reason) && /delete/.test(denyD.reason), 'AC6.2: reason deny nêu fullPaths, fullRoots và quyền thiếu');
    const denies = ['rm $X/f', `cat ${D}/.env`].map((c) => bd(c));
    ok(denies.every((a) => a?.decision === 'deny' && a.reason.includes('Mở:')), 'AC6.2: reason deny của guard-bash ở confined có "Mở:"');
    const asks = ['git push origin main', 'cat .env'].map((c) => bd(c, { cfg: { mode: 'ask' } }));
    ok(asks.every((a) => a?.decision === 'ask' && shapeOk(a.reason)), 'AC6.2: reason ask của guard-bash ở guarded theo khuôn');

    // Deny ghi/xoá ngoài root liệt kê root có đúng quyền đang thiếu (kiểu list_roots); đường dẫn Windows đổi về / để so khớp.
    const roots = (cmd) => { const d = bd(cmd); return { d, l: rootLine(d?.reason ?? '').replace(/\\/g, '/') }; };
    for (const c of [`cp x ${OUT}/b`, `echo x > ${OUT}/f`, `touch ${OUT}/f`]) {
      const { d, l } = roots(c);
      ok(d?.decision === 'deny' && l.startsWith('Được ghi:') && [P, O, T].every((p) => l.includes(p)) && !l.includes(D) && /fullPaths/.test(d.reason) && /fullRoots/.test(d.reason) && /"write"/.test(d.reason),
        `AC1.1: \`${c.replaceAll(u(tb), '~')}\` → deny, dòng "Được ghi:" liệt kê P, O, T (không D), vẫn nêu fullPaths, fullRoots và quyền thiếu`);
    }
    {
      const { d, l } = roots(`rm ${OUT}/f`);
      ok(d?.decision === 'deny' && l.startsWith('Được xoá:') && [P, T].every((p) => l.includes(p)) && !l.includes(O) && !l.includes(D) && /"delete"/.test(d.reason),
        'AC1.1: rm ngoài root → deny, dòng "Được xoá:" chỉ liệt kê root có quyền delete (P, T)');
    }
    const dc = bd('git commit -m "tiếng Việt"', { cfg: { mode: 'ask' } });
    ok(bd(`rm ${CT}`)?.reason === CLAUDE_TMP_BLOCKED_TEXT && dc?.decision === 'deny' && !/Được (ghi|xoá):/.test(dc.reason) && !/Được (ghi|xoá):/.test(bd('rm $X/f')?.reason ?? ''),
      'AC1.5: deny gốc <tmpdir>/claude giữ nguyên chữ, DENY_COMMIT và ask không có dòng root');
    ok(['guard-bash.mjs', 'guard-files.mjs'].every((f) => !fs.readFileSync(path.join(CORE_DIR, 'hooks', 'scripts', f), 'utf8').includes('Chế độ full chỉ cho phép')),
      'AC2.1: câu deny ngoài root chỉ còn dựng ở gate-config (guard-bash và guard-files gọi denyOutsideText)');

    // hook-ps-write-flags: cờ có giá trị đứng trước đường dẫn của Set-Content/Out-File/Add-Content không được làm mất đích thật.
    const psw = (ac, rows, opt = { tool: 'PowerShell' }) => expectAll(rows.map(([c, want]) => [c, want, `ps-write-flags ${ac}`]), opt);
    const flagged = ['Set-Content -Encoding utf8 X/x -Value y', 'Out-File -Encoding utf8 X/x', 'Add-Content -Value y X/x', 'Set-Content -ErrorAction Stop X/a x', 'Set-Content -ea Stop X/x y',
      'Set-Content -Encoding:utf8 X/x y', 'Out-File -Append -Encoding utf8 X/x', 'Out-File -Width 80 X/x', 'Set-Content -Stream s X/x y', 'Set-Content -Include a X/x y', 'Set-Content -Force X/x y',
      'Set-Content -Value: y X/x', 'Set-Content -Encoding: utf8 X/x y', 'Set-Content -Force: $false X/x y'];
    psw('AC1.1', [[OUT, 'deny'], [D, 'deny'], [O, null], [T, null]].flatMap(([dir, want]) => flagged.map((c) => [c.replace('X/', `${dir}/`), want])));
    // Mọi token trừ tên cờ đã biết là ứng viên đích (PowerShell 5.1 đảo vai đối số vị trí khi có tham số động); chỉ giá trị của cờ có giá trị đứng trơn là nội dung.
    psw('AC1.2', [
      ...[`Set-Content ${O}/x ${OUT}/y`, `Set-Content -Path ${O}/x ${OUT}/y`, `Set-Content -FilePath:${O}/x ${OUT}/y`,
        `Set-Content ${OUT}/x y`, `Set-Content -Path ${OUT}/x y`,
        // `--`, nháy và cờ đường dẫn cụt: không dựa vào việc đoán nháy.
        `Set-Content ${OUT}/x -- -Path`, `Set-Content ${OUT}/x '-Path'`, `Set-Content ${OUT}/x "-LiteralPath"`, `Out-File ${OUT}/x '-FilePath'`, `Set-Content ${OUT}/x '-Path:zzz'`,
        `Set-Content -Value y -- -x/../../out/x`,
        // Mảng Path có dấu cách hoặc dấu phẩy đứng đầu: phần tử sau dấu phẩy là đích.
        `Set-Content -Path ${O}/x, ${OUT}/y -Value z`, `Set-Content -Path "${O}/x", "${OUT}/y" z`, `Out-File -FilePath ${O}/x, ${OUT}/y -Encoding utf8`,
        `Set-Content -LiteralPath ${O}/x, ${OUT}/y z`, `Add-Content -Path ${O}/x, ${OUT}/y -Value z`, `Set-Content -Path ${O}/x, ${D}/y z`,
        `Set-Content -Path ${O}/x ,${OUT}/y -Value z`, `Set-Content ${O}/x ,${OUT}/y`,
        // Value mảng nhiều token: đích thật đứng sau.
        `Set-Content -Value a, b ${OUT}/x`, `Set-Content -Value a ,b ${OUT}/x`, `Set-Content -Encoding utf8 -Value a, b ${OUT}/x`, `Add-Content -Value a, b ${OUT}/x`,
        `Set-Content -Value @('a', 'b') ${OUT}/x`,
        // `--` trong nháy/backtick hoặc bị công tắc động của 5.1 làm mất tác dụng; cờ đường dẫn thật vẫn được đọc sau nó.
        `Set-Content '--' -Path ${OUT}/x`, `Set-Content '--' -Path:${OUT}/x`, `Add-Content '--' -LiteralPath ${OUT}/x`, `Set-Content \`-- -Path ${OUT}/x`,
        `Set-Content -Path -- ${OUT}/x v`, `Set-Content -LiteralPath -- ${OUT}/x v`, `Out-File -FilePath -- ${OUT}/x`,
        `Set-Content -NoNewline -- -Path ${OUT}/x`, `Add-Content -NoNewline -- -Path ${OUT}/x`, `Add-Content -Value -- -Value:${D}/x`, `Set-Content -Value -- -Value:${O}/x,${OUT}/y`,
        // Cờ đường dẫn trong nháy đứng trước cờ đường dẫn thật (dạng tách rời hoặc dính).
        `Set-Content '-Path' -Path ${OUT}/x`, `Set-Content "-LiteralPath" -LiteralPath ${OUT}/x`, `Add-Content '-Path' -Path ${D}/x`,
        `Set-Content '-Path' -Path:${OUT}/x`, `Set-Content '-Path' -LiteralPath:${OUT}/x`, `Add-Content '-LiteralPath' -Path:${D}/x`,
        // Cờ có giá trị trong nháy hoặc sau dấu phẩy không được nuốt token kế bắt đầu bằng `-`.
        `Set-Content '-Value' -Path:${OUT}/x`, `Set-Content '-ea' -Path:${D}/x`, `Set-Content '-Encoding' -LiteralPath:${OUT}/x`,
        `Set-Content -Value:a, -Value: ${D}/x`, `Set-Content -Value: ${OUT}/y, -Value:${O}/x,${OUT}/y`, `Set-Content -Value: ${OUT}/x '-Value' ,${OUT}/y`,
        // PowerShell 5.1 đảo vai đối số vị trí khi có tham số động.
        `Set-Content -NoNewline ${O}/x ${OUT}/y`, `Set-Content ${O}/x ${OUT}/y -Encoding:utf8`, `Add-Content -Encoding:utf8 ${O}/x ${D}/y`, `Set-Content -Stream:s ${O}/x ${OUT}/y`,
        // Cờ đường dẫn viết tắt/alias dạng dính.
        `Set-Content -PSPath:${OUT}/x v`, `Set-Content -Lit:${OUT}/x v`, `Set-Content -LiteralPa:${OUT}/x v`, `Add-Content -PSPath:${D}/x v`,
        `Out-File -Fi:${OUT}/x`, `Out-File -File:${OUT}/x`, `Out-File -FilePa:${OUT}/x`,
        // Đường dẫn trong nháy bắt đầu bằng `-` (cwd là project, nằm cạnh out và d).
        `Set-Content '-x/../../out/y' v`, `Out-File '-a/../../out/y'`, `Set-Content '-x/../../${path.basename(D)}/y' v`,
        // Cờ có giá trị bỏ trống rồi tới token bắt đầu bằng `-`: PowerShell 5.1 lấy token đó làm giá trị, cờ ấy không được nuốt đường dẫn thật.
        `Set-Content -Value: -Encoding ${OUT}/x`, `Set-Content -Value: -Value ${D}/x`, `Set-Content -Val: -ea: ${OUT}/x`, `Add-Content -Val: -Stream: ${O}/x,${OUT}/y`,
        `Set-Content -ov -Encoding ${OUT}/x y`, `Out-File -OutVariable -Value ${OUT}/x`, `Out-File -ov -Stream ${OUT}/x`, `Out-File -ov -Filter ${OUT}/x`,
        `Set-Content -ov -Width ${OUT}/x y`, `Set-Content -ov -InputObject ${OUT}/x y`, `Add-Content -ev -Width ${OUT}/x y`].map((c) => [c, 'deny']),
      // Nội dung (giá trị của cờ có giá trị đứng trơn) và đối số trong root không bị hỏi thừa.
      ...[`Out-File ${O}/x utf8`, `Set-Content -Value ${OUT}/y ${O}/x`, `Set-Content -Path ${O}/x -Encoding utf8 -Value ${OUT}/y`, `Set-Content -Path ${O}/x -Value a, b`,
        `Set-Content -Path ${O}/x -Value $text`, `Set-Content ${O}/x -Value 'a b'`, `Set-Content -Path ${O}/x -Force`,
        `Set-Content ${O}/x y`, `Set-Content ${O}/x -Value -5`, `Set-Content ${O}/x -Value -Encoding`].map((c) => [c, null]),
    ]);
    psw('AC1.3', [[`Set-Content -Enc utf8 ${OUT}/x -Val y`, 'deny'], [`Set-Content -Foo a ${OUT}/x y`, 'deny'], [`Set-Content -Enc utf8 ${O}/x y`, null]]);
    // Các ca `ask` của R18 đã có ở 99-hook-popup; ở đây chỉ giữ ca nội dung (không phải đích) không bị hỏi nhầm.
    psw('AC1.4', [['Set-Content -Value .claude\\aip-gate.json x', null], ['Set-Content -Value: -Encoding .claude\\aip-gate.json', 'ask'], ['Add-Content -ea: -Value .claude\\aip-gate.json', 'ask'],
      ['Set-Content -Value: -Value .claude\\settings.json', 'ask']], psAsk);

    // hook-copy-alias-brace: giá trị của -S/--suffix (cp/mv Bash) là hậu tố, không phải đối số vị trí; nếu không thì nó chiếm vai đích và che đích thật.
    expectAll([
      ...[`cp ${O}/x ${D}/b -S .bak`, `cp ${O}/x ${D}/b --suffix .bak`, `cp -S .bak ${O}/x ${D}/b`, `cp -bS .bak ${O}/x ${D}/b`, `cp ${O}/x ${D}/b --suffix=.bak`,
        `mv ${T}/x ${D}/b -S .bak`, `mv ${O}/x ${T}/b -S .bak`].map((c) => [c, 'deny', 'hook-copy-alias-brace AC4.1']),
      ...[`cp ${T}/x ${O}/b -S .bak`, `cp ${D}/x ${O}/b --suffix .bak`, `mv ${T}/x ${O}/b -S .bak`].map((c) => [c, null, 'hook-copy-alias-brace AC4.1']),
      ...[`cp ${OUT}/x ${O}/b -S .bak`, `cp -t ${O} ${OUT}/x --suffix .bak`].map((c) => [c, 'deny', 'hook-copy-alias-brace AC4.1']),
      // `--suffix` viết tắt (cp/mv chỉ có một tùy chọn dài bắt đầu bằng `--su`).
      ...[`cp ${O}/x ${D}/b --su .bak`, `cp ${O}/x ${D}/b --suf .bak`].map((c) => [c, 'deny', 'hook-copy-alias-brace AC4.1']),
      [`cp ${T}/x ${O}/b --suf .bak`, null, 'hook-copy-alias-brace AC4.1'],
      // Sau `--` mọi token là đối số vị trí: `-S` là tên file, không được nuốt token kế (đích thật).
      ...[`cp -- ${T}/x -S ${D}/b`, `cp -- ${O}/x -S ${D}/b`].map((c) => [c, 'deny', 'hook-copy-alias-brace AC4.1']),
      [`cp -- ${T}/x ${O}/b`, null, 'hook-copy-alias-brace AC4.1'],
    ]);
    r18(['cp -- settings.json -S .claude/', 'mv -- settings.json -S .claude'].map((c) => [c, 'ask', 'hook-copy-alias-brace AC4.1']), {});

    // hook-copy-alias-brace: alias PowerShell cpi/mi/ri phải bị xét như Copy-Item/Move-Item/Remove-Item.
    expectAll([
      ...[`cpi ${T}/a ${D}/b`, `mi ${T}/a ${OUT}/b`, `ri ${OUT}/a`, `mi ${O}/a ${T}/b`, `ri ${O}/a`, `cpi ${D}/a ${D}/b`].map((c) => [c, 'deny', 'hook-copy-alias-brace AC2.1']),
      ...[`cpi ${D}/a ${O}/b`, `mi ${T}/a ${O}/b`, `ri ${T}/a`, `cpi ${T}/a ${T}/b`].map((c) => [c, null, 'hook-copy-alias-brace AC2.1']),
      [`cpi ${OUT}/a ${O}/b`, 'deny', 'hook-copy-alias-brace AC2.1'],
    ], { tool: 'PowerShell' });
    const aliasCfg = [...['cpi settings.json .claude', 'mi settings.json .claude\\', 'cpi -Path settings.json -Destination .claude', 'ri .claude\\settings.json'].map((c) => [c, 'ask', 'hook-copy-alias-brace AC2.2']),
      ['cpi .claude\\settings.json out\\x', null, 'hook-copy-alias-brace AC2.2']];
    expectAll(aliasCfg, psAsk);
    expectAll(toDeny(aliasCfg), { tool: 'PowerShell' });

    // hook-copy-alias-brace: cờ lạ của Copy-Item (viết tắt `-Dest`) không rõ có nhận giá trị hay không, nên mọi đối số vị trí cần cả read lẫn write; switch đã biết thì không.
    expectAll([
      ...[`Copy-Item -Dest ${D}/b x`, `Copy-Item -De ${D}/b x`, `Copy-Item -D ${D}/b x`, `Copy-Item -Dest:${D}/b x`, `Copy-Item -Recurse -Dest ${D}/b x`, `cp -Dest ${D}/b x`,
        `Copy-Item -Dest ${O}/b ${D}/a`, `Copy-Item -Dest ${O}/b ${OUT}/a`].map((c) => [c, 'deny', 'hook-copy-alias-brace AC1.1']),
      ...[`Copy-Item -Dest ${O}/b ${T}/a`, `Copy-Item -Dest ${T}/b ${O}/a`].map((c) => [c, null, 'hook-copy-alias-brace AC1.1']),
    ], { tool: 'PowerShell' });
    expectAll([
      ...[`Copy-Item -Recurse ${D}/a ${O}/b`, `Copy-Item -Force ${D}/a ${O}/b`, `Copy-Item -Container ${D}/a ${O}/b`, `Copy-Item -PassThru ${D}/a ${O}/b`, `Copy-Item -WhatIf ${D}/a ${O}/b`,
        `Copy-Item -Confirm:$false ${D}/a ${O}/b`, `Copy-Item -recurse -Path ${D}/a -Destination ${O}/b`, `Move-Item -Force ${T}/a ${O}/b`].map((c) => [c, null, 'hook-copy-alias-brace AC1.2']),
      [`Copy-Item -Recurse ${OUT}/a ${O}/b`, 'deny', 'hook-copy-alias-brace AC1.2'],
      [`Copy-Item -Recurse ${D}/a ${D}/b`, 'deny', 'hook-copy-alias-brace AC1.2'],
    ], { tool: 'PowerShell' });
    const destCfg = [...['Copy-Item -Dest .claude\\settings.json x', 'Copy-Item -Dest .claude settings.json', 'Copy-Item -Dest:.claude\\aip-gate.json x', 'Copy-Item -De .claude\\settings.json x']
      .map((c) => [c, 'ask', 'hook-copy-alias-brace AC1.3'])];
    expectAll(destCfg, psAsk);
    expectAll(toDeny(destCfg), { tool: 'PowerShell' });
    // Dòng "Lệnh gồm" của đích vừa đọc vừa ghi phải nói ghi, không nói đọc.
    const destAsk = bd('Copy-Item -Dest .claude\\settings.json x', psAsk);
    ok(destAsk?.decision === 'ask' && /Lệnh gồm: [^\n]*ghi vào/.test(destAsk.reason) && !/Lệnh gồm: [^\n]*đọc/.test(destAsk.reason) && shapeOk(destAsk.reason), 'hook-copy-alias-brace AC1.4: dòng Lệnh gồm nói ghi vào');

    // hook-copy-alias-brace: Bash mở rộng brace `{a,b}` trước khi chạy lệnh, nên `{..,x}` thành `..`; mỗi nhánh được phân loại riêng và nhánh xấu nhất thắng.
    const BR9 = '{a,b}'.repeat(9);
    expectAll([
      ...[`rm ${T}/{..,x}/f`, `rm ${T}/.{.,x}/d/f`, `rm ${T}/{a,..}`, `rm {${T},${OUT}}/f`, `rm ${O}/{a,b}`, `cp x ${T}/{..,y}/f`, `rm ${T}/{a,{..,b}}/f`]
        .map((c) => [c, 'deny', 'hook-copy-alias-brace AC3.1']),
      ...[`rm ${T}/{a,b}/f`, `rm ${T}/{a,b}`, `rm ${T}/{1..3}/f`, `rm ${T}/{x}/f`, `rm ${T}/{.git,.x}/f`].map((c) => [c, null, 'hook-copy-alias-brace AC3.1']),
      [`rm ${T}/{a,$X}/f`, 'deny', 'hook-copy-alias-brace AC3.1'],
      // Trên 256 nhánh thì không liệt kê hết mà hỏi; glob trong nhánh được xét như glob ngoài brace.
      [`rm ${T}/${BR9}/f`, 'deny', 'hook-copy-alias-brace AC3.2'], [`rm ${T}/{.?,x}/f`, 'deny', 'hook-copy-alias-brace AC3.2'],
    ]);
    // Đối số có hàng nghìn `{`: không được đệ quy tràn stack (hook fail-open sẽ cho qua cả đường dẫn ngoài root ở đối số khác) hay quét bậc hai.
    const tBig = performance.now();
    expectAll([
      [`rm ${T}/${'{,}'.repeat(6000)}/f`, 'deny', 'hook-copy-alias-brace AC3.2'], [`rm ${T}/${'{,}'.repeat(6000)}/f ${OUT}/x`, 'deny', 'hook-copy-alias-brace AC3.2'],
      [`rm ${T}/${'{a,'.repeat(20000)}/f`, 'deny', 'hook-copy-alias-brace AC3.2'],
      // Đường dài: dưới 64 dấu `{` vẫn có thể tốn bậc hai nếu không chặn theo độ dài; đích ngoài root ở đối số khác vẫn phải bị deny.
      [`rm ${T}/${'{'.repeat(55)}${'x'.repeat(100000)}${'{a,b}'.repeat(8)}/f ${OUT}/z`, 'deny', 'hook-copy-alias-brace AC3.2'],
      // Biên của ngưỡng 64 dấu `{`.
      [`rm ${T}/${'{x}'.repeat(64)}/f`, null, 'hook-copy-alias-brace AC3.2'], [`rm ${T}/${'{x}'.repeat(65)}/f`, 'deny', 'hook-copy-alias-brace AC3.2'],
    ]);
    ok(performance.now() - tBig < 1000, 'hook-copy-alias-brace AC3.2: đầu vào lớn xử lý nhanh');
    // Chi phí brace tính theo cả lệnh: mỗi token dưới trần 4096 ký tự nhưng 24 token (~96KB) cộng lại không được vượt 1 giây; hết ngân sách thì ask, đích ngoài root vẫn deny.
    const heavy = `${T}/${'{'.repeat(56)}${'{a,b}'.repeat(8)}${'x'.repeat(3800)}`;
    const many = Array(24).fill(heavy).join(' ');
    expectAll([
      [`rm ${many} ${OUT}/z`, 'deny', 'hook-copy-alias-brace AC3.4'], [`rm ${many}`, 'deny', 'hook-copy-alias-brace AC3.4'],
      // Lệnh đời thường và 5 đường dẫn 8 nhóm ngắn nằm trong ngân sách: không đổi.
      [`cp ${T}/x ${T}/{a,b}`, null, 'hook-copy-alias-brace AC3.4'], [`rm ${Array(5).fill(`${T}/${'{a,b}'.repeat(8)}/f`).join(' ')}`, null, 'hook-copy-alias-brace AC3.4'],
    ]);
    // Token ngắn thì độ dài không chặn được: mỗi nhánh phải tốn một khoản cố định, nếu không hàng trăm token 256 nhánh vẫn mất vài giây.
    const shortAll = (n, tok) => Array(n).fill(tok).join(' ');
    expectAll([
      [`rm ${shortAll(800, '{a,b}'.repeat(8))} ${OUT}/z`, 'deny', 'hook-copy-alias-brace AC3.4'], [`rm ${shortAll(1600, '{,}'.repeat(8))}`, 'deny', 'hook-copy-alias-brace AC3.4'],
    ]);
    // Thời gian đo trong tiến trình con mới: trong cả lượt validate (đã chạy hàng nghìn test) cùng lệnh chậm gấp 3–4 lần, ngưỡng nới sẽ không còn bắt hồi quy.
    const childScript = `
      const [guardUrl, P, T, OUT, cfgJson] = process.argv.slice(1);
      const bash = await import(guardUrl);
      const config = JSON.parse(cfgJson);
      const run = (cmds) => { const t0 = performance.now(); for (const c of cmds) bash.decide({ tool_name: 'Bash', tool_input: { command: c }, cwd: P, permission_mode: 'bypassPermissions' }, { repoRoot: P, config, allowEnv: () => false, currentBranch: () => 'feature/x', reader: () => null }); return performance.now() - t0; };
      const heavy = T + '/' + '{'.repeat(56) + '{a,b}'.repeat(8) + 'x'.repeat(3800);
      const many = Array(24).fill(heavy).join(' ');
      const shortAll = (n, tok) => Array(n).fill(tok).join(' ');
      const tCmd = run([\`rm \${many} \${OUT}/z\`, \`rm \${many}\`, \`cp \${T}/x \${T}/{a,b}\`, \`rm \${Array(5).fill(T + '/' + '{a,b}'.repeat(8) + '/f').join(' ')}\`]);
      const tShort = run([\`rm \${shortAll(800, '{a,b}'.repeat(8))} \${OUT}/z\`, \`rm \${shortAll(1600, '{,}'.repeat(8))}\`]);
      console.log(JSON.stringify({ tCmd, tShort }));`;
    const { tCmd, tShort } = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', childScript, pathToFileURL(path.join(CORE_DIR, 'hooks', 'scripts', 'guard-bash.mjs')).href, P, T, OUT, JSON.stringify(config)], { encoding: 'utf8' }));
    ok(tCmd < 1000, `hook-copy-alias-brace AC3.4: lệnh nhiều token brace xử lý dưới 1 giây (${Math.round(tCmd)} ms)`);
    ok(tShort < 1000, `hook-copy-alias-brace AC3.4: nhiều token brace ngắn xử lý dưới 1 giây (${Math.round(tShort)} ms)`);
    // PowerShell không mở rộng brace: kết quả giữ như trước request.
    expectAll([[`Remove-Item ${T}/{..,x}/f`, null, 'hook-copy-alias-brace AC3.3'], [`Remove-Item ${O}/{a,b}`, 'deny', 'hook-copy-alias-brace AC3.3']], { tool: 'PowerShell' });

    // Bộ giải đường dẫn: scanWords giữ nháy từng phần của mỗi từ.
    const sw = (cmd, dialect = 'bash') => (typeof bash.scanWords === 'function' ? bash.scanWords(cmd, dialect) : null);
    const shape = (r) => r?.segs.map((g) => ({ sep: g.sep, bg: g.background, cp: g.compound, w: g.words.map((x) => x.parts.map((q) => `${q.quote}:${q.text}`).join('+')) }));
    const label = (cmd) => cmd.replace(/\n/g, '\\n');
    const SW = [
      ['a && b & c', [{ sep: 'start', bg: true, cp: false, w: ['none:a'] }, { sep: '&&', bg: true, cp: false, w: ['none:b'] }, { sep: '&', bg: false, cp: false, w: ['none:c'] }]],
      ['cd x && rm f &; y', [{ sep: 'start', bg: true, cp: false, w: ['none:cd', 'none:x'] }, { sep: '&&', bg: true, cp: false, w: ['none:rm', 'none:f'] }, { sep: ';', bg: false, cp: false, w: ['none:y'] }]],
      ['echo $(a) ; b', [{ sep: 'start', bg: false, cp: false, w: ['none:echo', 'none:$(a)'] }, { sep: ';', bg: false, cp: false, w: ['none:b'] }]],
      ['echo $(a) && b', [{ sep: 'start', bg: false, cp: false, w: ['none:echo', 'none:$(a)'] }, { sep: '&&', bg: false, cp: false, w: ['none:b'] }]],
      ['echo $((1+2)); x', [{ sep: 'start', bg: false, cp: false, w: ['none:echo', 'none:$((1+2))'] }, { sep: ';', bg: false, cp: false, w: ['none:x'] }]],
      ['x=$(a b)c d', [{ sep: 'start', bg: false, cp: false, w: ['none:x=$(a b)c', 'none:d'] }]],
      ['rm &>/dev/null x', [{ sep: 'start', bg: false, cp: false, w: ['none:rm', 'none:&>/dev/null', 'none:x'] }]],
      ['rm >&2 x', [{ sep: 'start', bg: false, cp: false, w: ['none:rm', 'none:>&2', 'none:x'] }]],
      ['foo 2>&1 | tee o', [{ sep: 'start', bg: false, cp: false, w: ['none:foo', 'none:2>&1'] }, { sep: '|', bg: false, cp: false, w: ['none:tee', 'none:o'] }]],
      ['a &&\nb', [{ sep: 'start', bg: false, cp: false, w: ['none:a'] }, { sep: '&&', bg: false, cp: false, w: ['none:b'] }]],
      ['echo "$(printf \'"\')" ; rm x', [{ sep: 'start', bg: false, cp: false, w: ['none:echo', 'double:$(printf \'"\')'] }, { sep: ';', bg: false, cp: false, w: ['none:rm', 'none:x'] }]],
      ['S="$(cygpath -u \'C:\\a b\')/e2e"', [{ sep: 'start', bg: false, cp: false, w: ['none:S=+double:$(cygpath -u \'C:\\a b\')/e2e'] }]],
      ['rm \\*x', [{ sep: 'start', bg: false, cp: false, w: ['none:rm', 'single:*+none:x'] }]],
      ['rm "x"*', [{ sep: 'start', bg: false, cp: false, w: ['none:rm', 'double:x+none:*'] }]],
      ["echo $(cygpath -u 'a b')/x", [{ sep: 'start', bg: false, cp: false, w: ['none:echo', "none:$(cygpath -u 'a b')/x"] }]],
      ['x # c; y', [{ sep: 'start', bg: false, cp: false, w: ['none:x'] }]],
      ['S=\'a\'"b"c', [{ sep: 'start', bg: false, cp: false, w: ['none:S=+single:a+double:b+none:c'] }]],
      ['(cd x); y', [{ sep: 'start', bg: false, cp: true, w: ['none:cd', 'none:x'] }, { sep: ';', bg: false, cp: false, w: ['none:y'] }]],
      ['a\nb', [{ sep: 'start', bg: false, cp: false, w: ['none:a'] }, { sep: ';', bg: false, cp: false, w: ['none:b'] }]],
    ];
    for (const [cmd, want] of SW) ok(JSON.stringify(shape(sw(cmd))) === JSON.stringify(want), `AC4.2: scanWords \`${label(cmd)}\` giữ sep/background/compound/nháy từng phần`);
    const ifSegs = sw('if a; then b; fi')?.segs ?? [];
    ok(['a', 'b'].every((t) => ifSegs.some((g) => g.compound && g.words.some((x) => x.parts.map((q) => q.text).join('') === t))), 'AC4.2: scanWords `if a; then b; fi` đánh dấu compound cho đoạn bên trong');
    ok(sw('S="$(cygpath -u \'C:\\a b\')/e2e"')?.unclosed === false && sw('echo "$(printf \'"\')" ; rm x')?.unclosed === false, 'AC4.2: scanWords không báo unclosed khi nháy kép chứa $( ) có nháy bên trong');
    ok(sw('echo $(Split-Path C:\\a\\) ; Remove-Item x', 'powershell')?.segs.length === 2, 'AC4.2: scanWords powershell không coi `\\` là escape trong $( ), lệnh sau `;` vẫn tách');
    ok(sw('echo $(cygpath -u \'C:\\a\\\') ; rm x')?.segs.length === 2, 'AC4.2: scanWords bash `$(… \'C:\\a\\\')` trong nháy đơn vẫn tách đoạn sau `;`');
    ok(sw('echo $(a ; rm x')?.unclosed === true && sw('echo `a ; rm x')?.unclosed === true, 'AC4.2: scanWords báo unclosed khi $( hoặc backtick không đóng');
    ok(sw('echo "a')?.unclosed === true && sw('echo "a"')?.unclosed === false, 'AC4.2: scanWords báo unclosed khi nháy chưa đóng');
    // Cùng token đã bỏ nháy với parse() trên lệnh không có $( )/&.
    for (const cmd of ['git commit -m "a;b" x', 'rm "x y" \'z w\' ; ls | grep q', 'a || b\nc', 'echo \'it\'"s" ok']) {
      const flat = sw(cmd)?.segs.map((g) => g.words.map((x) => x.parts.map((q) => q.text).join('')));
      const ref = typeof bash.parse === 'function' ? bash.parse(cmd).segs.map((t) => [...t]) : null;
      ok(flat && ref && JSON.stringify(flat) === JSON.stringify(ref), `AC4.2: scanWords cùng token với parse() trên \`${label(cmd)}\``);
    }

    // AC1.3: glob chỉ tính ở phần không nháy; "T/x*" là tên thường trong T, "T/x"* vẫn là glob.
    expectAll([[`rm "${T}/x*"`, null, 'AC1.3'], [`rm "${T}/x"*`, null, 'AC1.3'], [`rm "${OUT}/x"*`, 'deny', 'AC1.3'], [`rm -rf "${T}/backup/"*`, null, 'AC1.3']]);

    // D11: naiveSegments tách từ theo phần nháy.
    expectAll([[`rm a"b c"`, null, 'AC4.1'], [`echo x > "${OUT}/x y"`, 'deny', 'AC4.1'], [`rm \\' ${OUT}/x \\'`, 'deny', 'AC4.1'],
      [`cat <<'EOF' > ${OUT}/x\nhello\nEOF`, 'deny', 'AC4.1']]);
    ok(kind(`echo it's; rm ${OUT}/x`) !== null, 'AC4.1: nháy lẻ kèm `;` vẫn không cho qua lệnh xoá ngoài root');

    // H6-hỏi-oan: ruột chuỗi nháy là dữ liệu; `;`, xuống dòng và `=>` trong `node -e '…'` không phải lệnh hay chuyển hướng.
    const JS = `const a=[...r.matchAll(/^- \\[ \\]/gm)].map(m=>m[1]);\nconst d=[...c].filter(([k,v])=>v>1);\nconsole.log(a||"none")`;
    expectAll([
      [`cd ${P}/docs && node -e '${JS}' | grep x`, null, 'H6-hỏi-oan'], [`node -e 'x=m=>m[1];'`, null, 'H6-hỏi-oan'],
      // Đối chứng: lệnh thật sau chuỗi nháy vẫn bị kiểm.
      [`node -e '${JS}' && echo x > ${OUT}/f`, 'deny', 'H6-hỏi-oan'], [`node -e '${JS}'; echo x > $X/f`, 'deny', 'H6-hỏi-oan'],
      [`echo '${JS}' ; rm ${OUT}/x`, 'deny', 'H6-hỏi-oan'],
    ]);

    // resolveWord: giải một từ theo nháy từng phần (D5–D8), glob theo D6.
    const rw = (cmd, { env = {}, unres = false, idx = 1, dialect = 'bash' } = {}) => {
      if (typeof bash.resolveWord !== 'function') return 'thiếu resolveWord';
      const word = bash.scanWords(cmd, dialect).segs[0].words[idx];
      return bash.resolveWord(word, { env: new Map(Object.entries(env)), dir: P, unres, msys: true }, dialect);
    };
    const V = `${T}/a b`;
    const RW = [
      [`rm '${T}/x'`, {}, { text: `${T}/x`, glob: false }, 'AC4.1'],
      [`rm "${T}/x"`, {}, { text: `${T}/x`, glob: false }, 'AC4.1'],
      [`rm ${T}/x`, {}, { text: `${T}/x`, glob: false }, 'AC4.1'],
      [`rm "${T}/"x'/y'`, {}, { text: `${T}/x/y`, glob: false }, 'AC4.1'],
      [`rm "${T}/x*"`, {}, { text: `${T}/x*`, glob: false }, 'AC1.3'],
      [`rm '${T}/x*'`, {}, { text: `${T}/x*`, glob: false }, 'AC1.3'],
      [`rm "${T}/[a]"`, {}, { text: `${T}/[a]`, glob: false }, 'AC1.3'],
      [`rm ${T}/x*`, {}, { text: `${T}/x*`, glob: true }, 'AC1.3'],
      [`rm ${T}/x?`, {}, { text: `${T}/x?`, glob: true }, 'AC1.3'],
      [`rm "${T}/x"*`, {}, { text: `${T}/x*`, glob: true }, 'AC1.3'],
      [`rm "${T}/backup/"*`, {}, { text: `${T}/backup/*`, glob: true }, 'AC1.3'],
      [`rm $S/x`, { S: T }, { text: `${T}/x`, glob: false }, 'AC4.1'],
      [`rm \${S}/x`, { S: T }, { text: `${T}/x`, glob: false }, 'AC4.1'],
      [`rm "$S/x"`, { S: T }, { text: `${T}/x`, glob: false }, 'AC4.1'],
      [`rm $S/x`, { S: null }, null, 'AC4.1'],
      [`rm $S/x`, {}, null, 'AC4.1'],
      [`rm $PWD/x`, {}, { text: `${P}/x`, glob: false }, 'AC4.1'],
      [`rm \${PWD}/x`, {}, { text: `${P}/x`, glob: false }, 'AC4.1'],
      [`rm $PWD/x`, {}, null, 'AC4.1', true],
      [`echo $(cygpath -u '${T}')/e2e`, {}, { text: `${T}/e2e`, glob: false }, 'AC4.1'],
      [`echo "$(cygpath -u '${T}')/e2e"`, {}, { text: `${T}/e2e`, glob: false }, 'AC4.1'],
      [`echo $(cygpath -p '${T}')/e2e`, {}, null, 'AC4.1'],
      [`echo $(date)/e2e`, {}, null, 'AC4.1'],
      [`rm ~/x`, {}, null, 'AC4.1'],
      [`rm $HOME/x`, { HOME: T }, null, 'AC4.1'],
      [`rm $?/x`, {}, null, 'AC4.1'],
      [`rm \${X:-y}/x`, { X: T }, null, 'AC4.1'],
      [`rm $V/x`, { V }, null, 'AC4.1'],
      [`rm "$V/x"`, { V }, { text: `${V}/x`, glob: false }, 'AC4.1'],
      [`rm "\\$S/x"`, { S: T }, { text: '$S/x', glob: false }, 'AC4.1'],
      [`rm "\\\\$S/x"`, { S: T }, { text: `\\${T}/x`, glob: false }, 'AC4.1'],
      [`echo $(cygpath -u 'C:\\a\\b')/x`, {}, { text: 'C:\\a\\b/x', glob: false }, 'AC4.1'],
      [`echo $(cygpath -ua '${T}')/x`, {}, { text: `${T}/x`, glob: false }, 'AC4.1'],
      [`echo $(cygpath -u -a  '${T}')/x`, {}, { text: `${T}/x`, glob: false }, 'AC4.1'],
      [`echo $(cygpath -ux '${T}')/x`, {}, null, 'AC4.1'],
      [`echo $(cygpath -u "C:\\a")/x`, {}, null, 'AC4.1'],
      [`rm $G`, { G: `${T}/x*` }, { text: `${T}/x*`, glob: true }, 'AC1.3'],
      [`rm "$G"`, { G: `${T}/x*` }, { text: `${T}/x*`, glob: false }, 'AC1.3'],
    ];
    for (const [cmd, env, want, ac, unres = false] of RW) {
      ok(JSON.stringify(rw(cmd, { env, unres })) === JSON.stringify(want), `${ac}: resolveWord \`${cmd.replaceAll(T, '<T>').replaceAll(P, '<P>')}\` → ${want ? JSON.stringify(want.glob) + ' glob' : 'chưa rõ'}`);
    }

    // Phép gán biến/cd trong cùng lệnh đi qua một luật tin cậy (walkSegments). T nằm dưới root, OUT ngoài mọi root.
    fs.mkdirSync(T, { recursive: true });
    const real = "S=\"$(cygpath -u '" + T + "')/e2e\" && M=\"$PWD/src/data/database-backup\" && rm -rf \"$S/run/backup\"/* && : >\"$S/stub.log\" && echo \"CRON_USER=$(id -un)\" >>\"$S/run/.env\" && export APP_ROOT=\"$S/run/app\" PATH=\"$S/shim:$M/scripts:$PATH\" && bash \"$APP_ROOT/scripts/db-job.sh\" create 2>&1 | tail -2; cat \"$S/cron.d\" | tail -1";
    expectAll([[real, null, 'AC1.1']], { extra: { cwd: T } });
    expectAll([
      [`S="$(cygpath -u '${T}')/e2e"; rm -rf "$S/x"`, null, 'AC1.2'],
      [`S=$(cygpath -u '${T}')/e2e && rm "$S/x"`, null, 'AC1.2'],
      [`S="${T}/e2e"; rm -rf "$S/run/backup/"*`, null, 'AC1.2'],
      [`rm -rf "${T}/backup/"*`, null, 'AC1.2'],
      [`echo hi\nS=${T}\nrm -rf "$S/etc"`, null, 'AC1.2'],
      [`cd ${T} && echo hi; S=${T}; rm $S/x`, null, 'AC1.2'],
      [`echo hi && export A=${T}/a && rm "$A/x"`, null, 'AC1.2'],
      [`export APP="${T}/app" && rm "$APP/x"`, null, 'AC1.4'],
      [`cd ${T}; M="$PWD"; rm "$M/y"`, null, 'AC1.4'],
      [`cd ${OUT}; M="$PWD"; rm "$M/y"`, 'deny', 'AC1.4'],
      [`export APP=${OUT}/app && rm -rf "$APP/x"`, 'deny', 'AC1.4'],
      ...[
        `rm $S/x; S=${T}`, `S=$X; rm "$S/x"`, `S=${T}; S=$X; rm "$S/x"`, `S="${T}/a b"; rm $S/x`, `A=1 && S=${T}; rm $S/x`,
        `S=${T} rm -rf "$S/etc"`, `S=${T} | cat; rm -rf "$S/etc"`, `S=${T} & rm -rf "$S/etc"`, `if false; then S=${T}; fi; rm -rf "$S/x"`,
        `(S=${T}); rm -rf "$S/x"`, `f() { S=${T}; }; rm -rf "$S/x"`, `S=${T}; S+=/../v; rm -rf $S`, `S=${T}; S[0]=/etc; rm -rf $S/x`,
        `S=${T}; unset S; rm -rf $S/etc`, `S=${T}; read X; rm -rf "$S/x"`, `S=${T}; eval S=/etc; rm -rf $S/x`, `S=${T}; cat <<<x; rm -rf $S/y`,
      ].map((c) => [c, 'deny', 'AC1.5']),
      [`S=${OUT}; rm $S/x`, 'deny', 'AC1.6'],
      [`cd ${T}; S=/etc; rm $S/x`, 'deny', 'AC1.6'],
      [`S='${T}'/../../..; rm -rf $S/victim`, 'deny', 'AC1.6'],
      [`S="${T}"/../../..; rm -rf $S/victim`, 'deny', 'AC1.6'],
      [`S=$(cygpath -u '${T}')/../../..; rm -rf $S/victim`, 'deny', 'AC1.6'],
      ...(path.sep === '\\' ? [[`S='${T.replaceAll('/', '\\')}\\..\\..\\..'; rm -rf $S/victim`, 'deny', 'AC1.6']] : []),
    ]);
    const noH6 = [`S=${OUT}; rm $S/x`, `S=${T}; rm $S/x`].map((c) => [c, null, 'AC1.8']);
    expectAll(noH6, { cfg: { mode: 'ask' } });
    expectAll(noH6, { extra: { permission_mode: 'default' } });

    // Vòng sửa 1 của walkSegments: đường không hiểu được thì chưa rõ (ask), không im lặng cho qua. Hàng ask ghi AC1.5, deny ghi AC1.6, không biến ghi AC4.1.
    const nested = `echo \`echo \\\`rm -rf ${OUT}/x\\\`\``;
    expectAll([
      // F1: tên lệnh là thế lệnh/backtick (kể cả rỗng).
      ...[`$(:) rm -rf ${OUT}/x`, `\`:\` rm -rf ${OUT}/x`, `true && $(:) rm -rf ${OUT}/x`, `FOO=1 $(:) rm -rf ${OUT}/x`, `S=${T}; $(:) rm $S/x`, `$(which rm) ${OUT}/x`].map((c) => [c, 'deny', 'AC1.5']),
      // F2: backtick lồng, vượt trần sâu, vượt ngân sách lệnh con.
      [nested, 'deny', 'AC1.6'],
      [`echo $(echo $(echo $(echo $(rm -rf ${OUT}/x))))`, 'deny', 'AC1.5'],
      [`echo ${'$(:) '.repeat(250)}$(rm -rf ${OUT}/x)`, 'deny', 'AC1.5'],
      // F3: `)` của nhánh case đóng $( ) sớm.
      [`echo $(case x in x) rm -rf ${OUT}/x;; esac)`, 'deny', 'AC1.5'],
      // F4a: gán tuần tự trong một đoạn (kể cả export) thấy giá trị mới.
      [`A=${T}; A=${OUT} B=$A/x; rm $B`, 'deny', 'AC1.6'],
      [`export A=${OUT} B=$A/x; rm $B`, 'deny', 'AC1.6'],
      // F4b: từ khoá function là cấu trúc phức.
      [`S=${T}; function f { S=${OUT}; }; f; rm $S/x`, 'deny', 'AC1.5'],
      // F4c: phép gán đứng sau chuyển hướng vẫn là phép gán.
      [`S=${T}; > /dev/null S=${OUT}; rm $S/x`, 'deny', 'AC1.6'],
      [`S=${T}; 2>/dev/null S=${OUT}; rm $S/x`, 'deny', 'AC1.6'],
      // F4d: đối số export có nháy hoặc export qua builtin/command.
      ...[`export "S=${OUT}"`, `export 'S'=${OUT}`, `builtin export S=${OUT}`, `command export S=${OUT}`].map((c) => [`S=${T}; ${c}; rm $S/x`, 'deny', 'AC1.5']),
      // F5: trap đổi biến; gán PWD làm $PWD không khớp thư mục đang theo dõi.
      [`S=${T}; trap 'S=/etc' DEBUG; rm $S/x`, 'deny', 'AC1.5'],
      [`cd ${T}; PWD=${OUT}; rm $PWD/x`, 'deny', 'AC1.5'],
      // F6: `.` là source ở mọi vị trí lệnh.
      ...['{ . ./v.sh; }', 'if true; then . ./v.sh; fi', '! . ./v.sh', 'time . ./v.sh', 'builtin . ./v.sh', 'command . ./v.sh'].map((c) => [`S=${T}; ${c}; rm $S/x`, 'deny', 'AC1.5']),
      // `.` làm đối số (không phải lệnh) không tắt giải biến.
      [`S=${T}; cp x .; rm $S/x`, null, 'AC4.1'],
      // F9: hai hàng D2 cũ của 99-hook-popup.
      [`cd /e/x && echo hi; S=${T}; rm $S/x`, null, 'AC1.2'],
    ]);

    // Trần cỡ của bộ giải (D4, D15): dưới trần thì giải đúng luật và nhanh; vượt trần thì không giải biến nào (ask).
    const nameList = (n) => Array.from({ length: n }, (_, i) => `V${i}=${T}/d${i}`).join('; ');
    const useAll = (n) => Array.from({ length: n * 20 }, (_, i) => `rm "$V${i % n}/f${i}"`).join('; ');
    const at20 = `${nameList(20)}; ${useAll(20)}`;
    const t31 = performance.now();
    const k31 = [kind(at20), kind(`${at20}; V19=${OUT}; rm "$V19/x"`)];
    ok(at20.length < 20000 && k31[0] === null && k31[1] === 'deny', 'AC3.1: 20 tên gán hợp lệ và 400 đường dẫn dùng biến → giải đúng (null; gán lại ra ngoài root → deny)');
    ok(performance.now() - t31 < 1000, 'AC3.1: lệnh 20 tên gán, 400 đường dẫn dùng biến chạy dưới 1s');
    const big = `echo ${'a'.repeat(20000)}; S=${T}; rm -rf $S/x`;
    ok(big.length > 20000 && kind(big) === 'deny', 'AC3.2: lệnh dài hơn 20000 ký tự có S=<T>; rm -rf $S/x → deny (không giải biến)');
    ok(kind(`${nameList(21)}; rm -rf $V20/x`) === 'deny' && kind(`${nameList(20)}; rm -rf $V19/x`) === null, 'AC3.2: 21 tên gán → deny, 20 tên gán vẫn giải (null)');

    // PowerShell: biến gán trong cùng lệnh (D13). Dấu \ của "$S\x" là phân cách thư mục của Windows.
    const ps = (assign, use = 'Remove-Item "$S\\x"') => `${assign}; ${use}`;
    const PS = { tool: 'PowerShell' };
    const psRowsAc21 = [
      [ps(`$S = '${T}'`), null], [ps(`$s = '${T}'`), null], [ps(`$S = "${T}"`), null], [ps(`$S='${T}'`), null],
      [ps(`$S = '${OUT}'`), 'deny'], [ps(`$S = '${T}/../../..'`), 'deny'],
      [ps('$S = $env:TEMP'), 'deny'], [ps(`if ($true) { $S = '${T}' }`), 'deny'],
    ];
    expectAll(psRowsAc21.map(([c, want]) => [c, want, 'AC2.1']), PS);
    // Set-Variable đổi biến theo cách không đọc được: không được cho qua im lặng.
    const sv = kind(ps(`$S = "${T}"; Set-Variable S '${OUT}'`), PS);
    ok(sv === 'ask' || sv === 'deny', 'AC2.1: $S = "<T>"; Set-Variable S \'<OUT>\'; Remove-Item "$S\\x" → ask hoặc deny (không null)');
    // AC2.2: ngoài full + bypass không có H6, nên kết quả giữ như trước thiết kế (đo trên code trước khi sửa).
    const psAll = [...psRowsAc21.map(([c]) => c), ps(`$S = "${T}"; Set-Variable S '${OUT}'`)];
    expectAll(psAll.map((c) => [c, null, 'AC2.2']), { ...PS, cfg: { mode: 'ask' } });
    expectAll(psAll.map((c) => [c, null, 'AC2.2']), { ...PS, extra: { permission_mode: 'default' } });

    // D13: quét chuỗi gốc (backtick-nháy), biến không nháy, phép gán không đọc được, khối lệnh, `||`, kết quả lệnh.
    expectAll([
      [ps(`$S = '${T}'`, 'Remove-Item "$S\\x\`"y"'), null],
      [ps(`$S = '${T}'`, 'Remove-Item $S'), null],
      [ps(`cd '${T}'; $M = $PWD`, 'Remove-Item "$M\\x"'), null],
      [ps(`$S = '${T}'`, 'Remove-Item $S\\x'), 'deny'],
      [ps(`$S = '${T}'`, 'Remove-Item "$S:x"'), 'deny'],
      [ps(`$S = '${T}'; $S += '/..'`), 'deny'],
      [`$S = '${T}' || Remove-Item "$S\\x"`, 'deny'],
      [ps(`$S = '${T}'; foreach ($S in '${OUT}') { Remove-Item "$S\\x" }`, '$null'), 'deny'],
      [ps(`$S = Get-Item x`), 'deny'],
      [ps(`$S = '${T}'; Start-Job { $S = '${OUT}' }`), 'deny'],
    ].map(([c, want]) => [c, want, 'AC2.1']), PS);

    // Danh sách trắng PowerShell: lệnh có dấu hiệu đổi biến ngoài phép gán đơn `$name = từ` đứng đầu đoạn thì không giải biến nào (ask), không vá từng dạng.
    const USE = 'Remove-Item "$S\\x"';
    const psAskRows = [
      `$S='${T}'; if ($true) {$S='${OUT}'}; ${USE}`,
      `$S='${T}'; [string]$S='${OUT}'; ${USE}`,
      `$S='${T}'; \${S}='${OUT}'; ${USE}`,
      `$S='${T}'; $script:S='${OUT}'; ${USE}`,
      `$S='${T}'; $global:S='${OUT}'; ${USE}`,
      `$S='${T}'; ($S)='${OUT}'; ${USE}`,
      `$S='${T}'; ($X, $S) = 1,'${OUT}'; ${USE}`,
      `$S='${T}'; $S, $X = '${OUT}',1; ${USE}`,
      `$S='${T}'; $sb={$S='${OUT}'}; & $sb; ${USE}`,
      `$S='${T}'; 1 | % {$S='${OUT}'}; ${USE}`,
      `$S='${T}'; Write-Host $($S='${OUT}'); ${USE}`,
      `$S='${T}'; Write-Host "$($S='${OUT}')"; ${USE}`,
      `$S='${T}'; Write-Host $(Set-Location '${OUT}'); Remove-Item "$PWD\\x"`,
      `$S='${T}'; Set-Item variable:S '${OUT}'; ${USE}`,
      `$S='${T}'; (Get-Variable S).Value = '${OUT}'; ${USE}`,
      `$S='${T}'; gv S; ${USE}`,
      `$S='${T}'; $ExecutionContext.SessionState.PSVariable.Set('S','${OUT}'); ${USE}`,
      `$S='${T}'; $S -eq 1 -and ($S='${OUT}'); ${USE}`,
    ];
    expectAll(psAskRows.map((c) => [c, 'deny', 'AC2.1']), PS);
    // Dùng $S trong khối `{ }` sau khi đã đổi trong khối: không được null, kể cả khi dùng ở ngoài.
    const inBlock = kind(`$S='${T}'; Remove-Item "$S\\x"; if ($true) {$S='${OUT}'; Remove-Item "$S\\y"}`, PS);
    ok(inBlock !== null, 'AC2.1: dùng $S trong khối { } đã đổi $S ra ngoài root → không null');
    // So sánh `-eq` là từ, không phải `=`; phép gán đơn đứng đầu đoạn vẫn giải.
    expectAll([[`$S='${T}'; if ($S -eq 1) { }; ${USE}`, 'deny', 'AC2.1'], [`$S = '${T}'; $M = $PWD; Remove-Item "$S\\x" -Force`, null, 'AC2.1']], PS);

    // $( ) cùng scope ở PowerShell: lệnh đổi vị trí bên trong làm thư mục của các đoạn sau chưa rõ (không được null); chú thích # và <# #> không phải mã.
    const psCd = ['$(cd \'OUT\')', '$(Push-Location \'OUT\')', '$(chdir \'OUT\')', '$(pushd \'OUT\')', '$(Set-Location -Path \'OUT\')', '"$(cd \'OUT\')"', '$(Set-Location\n\'OUT\')']
      .map((x) => x.replaceAll('OUT', OUT));
    expectAll(psCd.map((x) => [`Write-Host ${x}; Remove-Item x`, 'deny', 'AC2.1']), PS);
    // Không bỏ chú thích trước khi quét (bỏ sai thì che lệnh ghi): `{`/`=` trong chú thích làm hỏi thừa, có chủ ý.
    const commentAc = 'AC2.1 (hỏi thừa có chủ ý: { hoặc = trong chú thích tắt giải biến, Ruling vòng 3)';
    expectAll([
      [`$S = '${T}' # comment {\nRemove-Item "$S\\x"`, 'deny', commentAc],
      [`$S = '${T}' <# {= #> ; Remove-Item "$S\\x"`, 'deny', commentAc],
      [`$S = '${T}'; <# \n$S='x' #>\nRemove-Item "$S\\x"`, 'deny', commentAc],
      [`Write-Host \${#x}; Remove-Item '${OUT}\\x'`, 'deny', 'AC2.1'],
      [`@'\nit's <#\n'@\nRemove-Item '${OUT}\\x'\n#>`, 'deny', 'AC2.1'],
      [`<# x\nRemove-Item '${OUT}\\x'`, 'deny', 'AC2.1'],
    ], PS);
    // Khối `{ }` viết liền vẫn là khối: lệnh bên trong được kiểm như khi có khoảng trắng.
    expectAll([
      [`if ($true) {Remove-Item '${OUT}\\x'}`, 'deny'],
      [`& {Remove-Item '${OUT}\\x'}`, 'deny'],
      [`1 | ForEach-Object {Remove-Item '${OUT}\\x'}`, 'deny'],
      [`$S='${OUT}'; if ($true) {Remove-Item "$S\\x"}`, 'deny'],
    ].map(([c, want]) => [c, want, 'AC2.1']), PS);
    // Đổi biến qua ổ variable: ghép chuỗi (biểu thức `( )`, đối số *-Item không phải literal, splat) → không giải biến.
    expectAll([
      `$S='${T}'; Set-Item -Path ('vari'+'able:S') -Value '${OUT}'; ${USE}`,
      `$S='${T}'; $n='vari'+'able:S'; Set-Item $n '${OUT}'; ${USE}`,
      `$S='${T}'; $n='S'; New-Item ("var"+"iable:$n") -Value '${OUT}' -Force; ${USE}`,
      `$S='${T}'; $p='vari'+'able:S', '${OUT}'; Set-Item @p; ${USE}`,
    ].map((c) => [c, 'deny', 'AC2.1']), PS);
    // Danh sách cho phép theo tên lệnh: có lệnh ngoài tập (đổi biến qua *-ItemProperty, Invoke-Item, pipe, đổi vị trí, PSDrive, lệnh lạ) thì không giải biến nào.
    const N = `$n='vari'+'able:S'`;
    expectAll([
      `$S='${T}'; ${N}; Set-ItemProperty $n -Name Value -Value '${OUT}'; ${USE}`,
      `$S='${T}'; ${N}; Clear-ItemProperty $n -Name Value; ${USE}`,
      `$S='${T}'; ${N}; Rename-ItemProperty $n -Name Value -NewName X; ${USE}`,
      `$S='${T}'; ${N}; Invoke-Item $n; ${USE}`,
      `$S='${T}'; ${N}; $x = Invoke-Item $n; ${USE}`,
      `$S='${T}'; ${N}; $n | Set-Item -Value '${OUT}'; ${USE}`,
      ...['Set-Location', 'Push-Location', 'cd', 'sl'].map((c) => `$S='${T}'; $n='vari'+'able:'; ${c} $n; Set-Item S '${OUT}'; ${USE}`),
      `$S='${T}'; New-PSDrive -Name Z -PSProvider Variable -Root '\\'; Set-Item Z:S '${OUT}'; ${USE}`,
      `$S = '${T}'; Get-Date; ${USE}`,
      // Lệnh trong tập làm nguồn ống dẫn với đối số ghép chuỗi: đối tượng ổ variable: chảy sang lệnh sau.
      `$S='${T}'; ${N}; Get-ChildItem $n | Remove-Item; ${USE}`,
      `$S='${T}'; ${N}; ls $n | rm; ${USE}`,
      `$S='${T}'; ${N}; gi $n | rm; ${USE}`,
      `$S='${T}'; ${N}; Resolve-Path $n | Remove-Item; ${USE}`,
      `$S='${T}'; ${N}; gi $n | Set-Content -Value '${OUT}'; ${USE}`,
      `$S='${T}'; ${N}; Write-Output $n | Get-Item | Set-Content -Value '${OUT}'; ${USE}`,
      `$S='${T}'; ${N}; $n | rm; ${USE}`,
      // Đoạn biểu thức nhiều từ (toán tử -join, -f…) ghép được đường dẫn variable: mà không cần `$`/`+`/`@`.
      `$S='${T}'; 'vari', 'able:S' -join '' | Get-Item | Remove-Item; ${USE}`,
      `$S='${T}'; "vari{0}" -f 'able:S' | gi | rm; ${USE}`,
      // Tên lệnh có tiền tố đường dẫn là lệnh khác, không phải cmdlet trong tập.
      ...['.\\Remove-Item', 'C:\\x\\Remove-Item', 'Microsoft.PowerShell.Management\\Remove-Item', './Remove-Item'].map((c) => `$S='${T}'; ${c} "$S\\x"`),
    ].map((c) => [c, 'deny', 'AC2.1']), PS);
    // Lệnh trong tập vẫn giải biến đã gán đơn.
    expectAll([
      `$S = '${T}'; Set-Content "$S\\f" -Value x`,
      `$S = '${T}'; Copy-Item x "$S\\y"`,
      `$S = '${T}'; New-Item -ItemType Directory "$S\\d"`,
      `$S = '${T}'; ${USE} | Out-Null`,
      // Here-string `@'…'@` là dữ liệu, không phải splat `@tên`.
      `$S = '${T}'; Write-Host @'\nabc\n'@; ${USE}`,
      `$S = '${T}'; Set-Content "$S\\f" @'\nabc\n'@`,
      `$S = '${T}'; @'\nabc\n'@ | Set-Content "$S\\f"`,
    ].map((c) => [c, null, 'AC2.1']), PS);

    // Hồi quy sau review cuối: `&` của PowerShell (toán tử gọi hoặc dấu tách) không được làm mất lệnh đứng sau nó.
    expectAll([
      `& Remove-Item ${OUT}/f`, `& rm -Recurse ${OUT}`, `& 'Remove-Item' ${OUT}/f`, `&{ Remove-Item ${OUT}/f }`, `&rm '${OUT}/f'`, `&Remove-Item ${OUT}/f`,
      `& Out-File -FilePath ${OUT}/f`, `& Move-Item ${T}/a ${OUT}/b`, `Get-ChildItem x & Remove-Item ${OUT}/f`,
    ].map((c) => [c, 'deny', 'AC4.1']), PS);
    // Sau `&` biến không còn được giải (đoạn phức): hỏi, không im lặng cho qua.
    expectAll([[`$S='${OUT}'; & Remove-Item "$S\\x"`, 'deny', 'AC4.1'], [`& cmd /c del ${OUT}\\f`, 'deny', 'AC4.1'], [`& Remove-Item ${T}/f`, null, 'AC4.1'], [`Remove-Item ${T}/f 2>&1`, null, 'AC4.1'],
      [`$R='rm'; & $R ${OUT}/x`, 'deny', 'AC1.5']], PS);

    // Hồi quy sau review cuối: phép gán số học đổi biến của shell hiện tại mà bộ giải không thấy.
    expectAll([
      `S=${CT}/a/b/c; : $((S=0)); rm -rf $S/../../../x/y`, `S=${T}; echo $((S=0)) >/dev/null; rm -rf $S/x`, `S=${T}; : $[S=0]; rm -rf $S/x`,
      `S=${T}; : \${a[S=0]}; rm -rf $S/x`, `S=${T}; : "$((S=0))"; rm -rf $S/x`, `S=${T}; : $((S=0)); rm -rf $S/x`,
    ].map((c) => [c, 'deny', 'AC1.5']));

    // Hồi quy sau review cuối: cd ở ngữ cảnh không chắc (nền, ||, && ở đầu danh sách trước, ống dẫn) không được tin cho đoạn sau.
    expectAll([
      // `false && cd core; rm ../x` vẫn được tin có chủ ý: cùng hình với lệnh popup `mkdir -p $S/bin && cd $S` (99-hook-popup AC6.2), người dùng chọn không hỏi thêm.
      ...[`cd core & rm ../x`, `true || cd core; rm ../x`, `echo hi | cd core; rm ../x`, `cd core & rm $PWD/../x`].map((c) => [c, 'deny', 'AC1.5']),
      ...[`cd core; rm ../x`, `cd core && rm ../x`, `true && cd core && rm ../x`].map((c) => [c, null, 'AC1.5']),
    ]);
    expectAll([[`cd ${T}; rm x`, null, 'AC1.5'], [`cd ${T} && rm x`, null, 'AC1.5']]);

    // Hồi quy sau review cuối: tên lệnh lấy từ biến không giải được là chưa rõ lệnh nào chạy.
    expectAll([`R=rm; $R -rf ${OUT}/x`, `R=rm; "$R" -rf ${OUT}/x`, `R=rm; \${R} -rf ${OUT}/x`].map((c) => [c, 'deny', 'AC1.5']));

    // Hồi quy sau review cuối: `$env:TEMP` không được đọc thành `$en` đã gán.
    expectAll([[`$en='${T}'; Remove-Item "$env:TEMP\\x"`, 'deny', 'AC2.1']], PS);

    // Kiểm bí mật dùng chung kết quả bộ giải: biến trỏ ra ngoài root thì hỏi, trong root thì cho qua.
    expectAll([[`S=${OUT}; cat $S/.env`, 'deny', 'AC1.6'], [`S=${T}; cat $S/.env`, null, 'AC1.6']]);

    // Lỗ guard-bash đã hoãn ở request full-path-resolver (request guard-bash-deferred-holes). Lỗi ném ra được gom thành 'throw' để một hàng đỏ không dừng cả bảng.
    const holeKind = (cmd, opt) => { try { return kind(cmd, opt); } catch (e) { return 'throw ' + e.constructor.name; } };
    const holeRows = (rows, opt) => { for (const [cmd, want, ac] of rows) ok(holeKind(cmd, opt) === want, `${ac}: \`${cmd.length > 90 ? cmd.slice(0, 60) + '…(' + cmd.length + ' ký tự)' : cmd.replaceAll(tb.replace(/\\/g, '/'), '~')}\` → ${want}`); };
    const manyArgs = Array(130000).fill('a').join(' ');
    // 130000 đối số làm `push(...)` tràn stack: decide từng ném RangeError và hook cho qua.
    holeRows([[`rm ${OUT}/x ${manyArgs}`, 'deny', 'AC1.1'], [`rm ${T}/x ${manyArgs}`, null, 'AC1.1']]);
    // Lỗi nội bộ: ở full + bypass thành deny (câu DENY_INTERNAL_TEXT), ngoài full vẫn ném như trước.
    const boom = { opts: { currentBranch: () => { throw new Error('boom'); } } };
    let crash = null;
    try { crash = bd('git push', boom); } catch { /* chưa vá: lỗi ném ra, assert dưới đỏ */ }
    ok(crash?.decision === 'deny' && crash.reason.includes('Lỗi nội bộ') && crash.reason.includes('Mở:'), 'AC1.2: full + bypass, decide gặp lỗi nội bộ → deny với câu DENY_INTERNAL_TEXT');
    ok(holeKind('git push', { ...boom, cfg: { mode: 'ask' } }) === 'throw Error', 'AC1.2: mode ask, lỗi nội bộ vẫn ném');
    ok(holeKind('git push', { ...boom, extra: { permission_mode: 'default' } }) === 'throw Error', 'AC1.2: full không bypass, lỗi nội bộ vẫn ném');

    // Chuỗi `cd` rất dài làm bộ duyệt chậm bậc hai (đo: 8000 × `cd a; rm x` ≈ 2–16 s): quá trần số đoạn thì hỏi, và hỏi nhanh.
    const timed = (cmd) => { const t0 = Date.now(); const r = holeKind(cmd); return { r, ms: Date.now() - t0 }; };
    for (const [name, cmd] of [['8000 × cd a; rm x', Array(8000).fill('cd a; rm x').join('; ')], ['8000 × cd a', Array(8000).fill('cd a').join('; ')]]) {
      const { r, ms } = timed(cmd);
      ok(r === 'deny' && ms < 1000, `AC1.3: ${name} → deny dưới 1 s (${r}, ${ms} ms)`);
    }
    ok(holeKind(Array(50).fill('cd a; rm x').join('; ')) === null, 'AC1.3: 50 × cd a; rm x (dưới trần) giữ kết quả cũ');

    // `cd` sau từ khoá hoặc lệnh bọc: tên lệnh nằm sau `then`/`time`/`builtin`/`command`, không ở đầu đoạn. Ở `if`/`then` cd không chắc chạy, còn `time` bị coi như từ khoá mở đầu đoạn (không tin) → thư mục chưa rõ (ask); `builtin`/`command` thì cd chắc chạy → deny ở thư mục ngoài root.
    holeRows([
      [`if true; then cd ${OUT}; fi; rm x`, 'deny', 'AC2.1'], [`time cd ${OUT}; rm x`, 'deny', 'AC2.1'],
      [`builtin cd ${OUT}; rm x`, 'deny', 'AC2.1'], [`command cd ${OUT}; rm x`, 'deny', 'AC2.1'],
      [`builtin cd ${T}; rm x`, null, 'AC2.1'], [`command cd ${T}; rm x`, null, 'AC2.1'],
    ]);

    // Tên lệnh là biến đứng sau tiền tố bọc: lệnh thật chạy là `$R`, hook không biết nó có ghi hay xoá.
    holeRows([
      [`R=rm; sudo $R ${OUT}/x`, 'deny', 'AC2.2'], [`R=rm; env $R ${OUT}/x`, 'deny', 'AC2.2'], [`R=rm; nohup $R ${OUT}/x`, 'deny', 'AC2.2'],
      [`sudo rm ${T}/x`, null, 'AC2.2'],
      [`command -v $x`, null, 'AC2.2'], [`if command -v $x >/dev/null 2>&1; then :; fi`, null, 'AC2.2'],
    ]);
    // Ba chỗ shell gán biến theo cách không đọc được: tên đó chưa rõ ở toàn lệnh, nhưng phép gán thường vẫn được giải.
    holeRows([
      [`S=${T}; exec {S}>/dev/null; rm -rf $S/x`, 'deny', 'AC2.3'], [`S=${T}; wait -p S; rm -rf $S/x`, 'deny', 'AC2.3'], [`S=${T}; coproc S { :; }; rm -rf $S/x`, 'deny', 'AC2.3'],
      [`S=${T}; rm -rf $S/x`, null, 'AC2.3'],
    ]);

    // PowerShell: New-Item và alias ghi chưa nằm trong tập lệnh ghi nên đích ngoài root không bị kiểm.
    holeRows([
      [`md '${OUT}/d'`, 'deny', 'AC3.3'], [`ni '${OUT}/f'`, 'deny', 'AC3.3'], [`New-Item '${OUT}/f'`, 'deny', 'AC3.3'],
      [`New-Item -Path '${OUT}/f' -ItemType File`, 'deny', 'AC3.3'], [`sc '${OUT}/f' x`, 'deny', 'AC3.3'], [`ac '${OUT}/f' x`, 'deny', 'AC3.3'],
      [`md '${T}/d'`, null, 'AC3.3'], [`ni '${T}/f'`, null, 'AC3.3'], [`New-Item -Path '${T}/f' -ItemType File`, null, 'AC3.3'], [`sc '${T}/f' x`, null, 'AC3.3'],
    ], { tool: 'PowerShell' });

    // PowerShell: đường dẫn đưa qua ống không nằm trong đối số của lệnh ghi. Nguồn Get-ChildItem/Get-Item có đường dẫn tường minh thì đường dẫn đó chịu quyền của lệnh ghi; nguồn khác không đoán được.
    holeRows([
      [`$p = '${OUT}'; $p | Remove-Item`, 'deny', 'AC3.1'], [`Get-ChildItem '${OUT}' | Remove-Item`, 'deny', 'AC3.1'],
      [`Get-ChildItem $x | Remove-Item`, 'deny', 'AC3.1'], [`Get-Content a | Set-Content`, 'deny', 'AC3.1'],
      [`Get-ChildItem -Path '${OUT}' -Filter *.log -Recurse | Remove-Item -Force`, 'deny', 'AC3.1'],
      [`Get-ChildItem '${T}' | Remove-Item`, null, 'AC3.1'], [`Get-ChildItem -Path '${T}' -Filter *.log -Recurse | Remove-Item -Force`, null, 'AC3.1'],
      [`gci '${T}' | Remove-Item`, null, 'AC3.1'], [`Get-ChildItem | Remove-Item`, null, 'AC3.1'],
      [`Get-Content a | Out-File '${T}/f'`, null, 'AC3.1'], [`Get-Content a | Out-File '${OUT}/f'`, 'deny', 'AC3.1'],
      // Move-Item/Copy-Item chỉ có -Destination: nguồn vẫn đến từ ống, và Move xoá nguồn.
      [`Get-ChildItem '${OUT}' | Move-Item -Destination '${T}'`, 'deny', 'AC3.1'], [`$p | Move-Item -Destination '${T}'`, 'deny', 'AC3.1'], [`Get-ChildItem '${OUT}' | Move-Item -Des '${T}'`, 'deny', 'AC3.1'],
      [`Get-ChildItem '${OUT}' | Copy-Item -Destination '${T}'`, 'deny', 'AC3.1'], [`Get-ChildItem '${T}' | Move-Item -Destination '${O}'`, null, 'AC3.1'],
      [`Get-ChildItem '${T}' | Copy-Item -Destination '${O}'`, null, 'AC3.1'],
    ], { tool: 'PowerShell' });

    // PowerShell: `cd` trong khối `{ }` không chắc chạy, và `cd HKCU:`/`Env:` vào ổ provider (không phải thư mục đĩa) bị `path.resolve` nối vào project.
    holeRows([
      [`& { cd '${OUT}' }; Remove-Item x`, 'deny', 'AC3.4'], [`if ($true) { cd '${OUT}' }; Remove-Item x`, 'deny', 'AC3.4'],
      [`cd HKCU:; Remove-Item Software/x`, 'deny', 'AC3.4'], [`cd Env:; Remove-Item x`, 'deny', 'AC3.4'], [`cd HKLM:/Software; Remove-Item x`, 'deny', 'AC3.4'],
      [`Set-Location HKCU:/Software; Remove-Item x`, 'deny', 'AC3.4'], [`pushd Cert:; Remove-Item x`, 'deny', 'AC3.4'], [`cd variable:; Remove-Item x`, 'deny', 'AC3.4'],
      [`cd '${T}'; Remove-Item x`, null, 'AC3.4'], [`cd C:/Windows; Remove-Item x`, 'deny', 'AC3.4'],
    ], { tool: 'PowerShell' });

    // PowerShell: Set-Alias/function:/Alias: đặt lại tên lệnh nên `gd` có thể là Remove-Item mà hook không biết.
    holeRows([
      [`Set-Alias gd Remove-Item; gd '${OUT}/x'`, 'deny', 'AC3.2'], [`sal gd ri; gd '${OUT}/x'`, 'deny', 'AC3.2'], [`New-Alias gd rm; gd '${OUT}/x'`, 'deny', 'AC3.2'],
      [`nal gd rm; gd '${OUT}/x'`, 'deny', 'AC3.2'], [`Set-Item Alias:gd Remove-Item; gd '${OUT}/x'`, 'deny', 'AC3.2'],
      [`\${function:gd} = { Remove-Item $args }; gd '${OUT}/x'`, 'deny', 'AC3.2'], [`Set-Item function:gd { Remove-Item $args }; gd '${OUT}/x'`, 'deny', 'AC3.2'],
      [`function gd { Remove-Item $args[0] }; gd '${OUT}/x'`, 'deny', 'AC3.2'],
      // Dấu hiệu nằm sau nháy hoặc bị escape bằng backtick, và các dạng định nghĩa còn lại.
      [`pwsh -c "sal gd ri; gd '${OUT}/x'"`, 'deny', 'AC3.2'], [`& 'sal' gd ri; gd '${OUT}/x'`, 'deny', 'AC3.2'], [`iex "sal gd ri"; gd '${OUT}/x'`, 'deny', 'AC3.2'],
      ["Set-Al`ias gd ri; gd '" + OUT + "/x'", 'deny', 'AC3.2'], ["s`al gd ri; gd '" + OUT + "/x'", 'deny', 'AC3.2'],
      [`Import-Alias a.csv; gd '${OUT}/x'`, 'deny', 'AC3.2'], [`filter gd { & ('Remove-'+'Item') $_ }; gd '${OUT}/x'`, 'deny', 'AC3.2'],
      [`function f { Remove-Item '${OUT}/x' }; f`, 'deny', 'AC3.2'],
      [`Get-Alias gd`, null, 'AC3.2'], [`Write-Host 'my function foo'`, null, 'AC3.2'], [`Remove-Item '${T}/x'`, null, 'AC3.2'],
    ], { tool: 'PowerShell' });

    // PowerShell: đối số là biểu thức trong ngoặc hoặc splat thì giá trị thật không đọc được từ chữ; chữ thô giống một tên tương đối nên từng cho qua.
    holeRows([
      [`Remove-Item ('${OUT}/x')`, 'deny', 'AC3.5'], [`Remove-Item -Path ('${OUT}/x')`, 'deny', 'AC3.5'],
      [`$p = @{Path='${OUT}/x'}; Remove-Item @p`, 'deny', 'AC3.5'],
      [`Remove-Item '${T}/x'`, null, 'AC3.5'],
      // `(` giữa token mở một biểu thức mới (`T/a('OUT/x')` là hai đối số); `@(…)` là mảng. Dấu ngoặc trong nháy là chữ thường nên không hỏi.
      [`Remove-Item ${T}/a('${OUT}/x')`, 'deny', 'AC3.5'], [`Remove-Item @('${OUT}/x')`, 'deny', 'AC3.5'], [`Remove-Item ${T}/"a"("${OUT}/x")`, 'deny', 'AC3.5'], [`Remove-Item ${T}/'a'(x)`, 'deny', 'AC3.5'],
      [`Remove-Item '(1) x.txt'`, null, 'AC3.5'], [`Remove-Item '@backup'`, null, 'AC3.5'],
      [`Remove-Item '${T}/(x)'`, null, 'AC3.5'], [`Remove-Item "${T}/file (1).txt"`, null, 'AC3.5'],
    ], { tool: 'PowerShell' });

    // Hồi quy sau review cuối: nhánh `function`/`filter` của PS_REDEFINE không được backtrack bậc hai trên chuỗi xuống dòng.
    const tNl = performance.now();
    const nl = holeKind('\n'.repeat(100000) + `Remove-Item '${T}/x'`, { tool: 'PowerShell' });
    const nlMs = performance.now() - tNl;
    ok(nl === null && nlMs < 2000, `AC3.2: 100000 ký tự xuống dòng rồi Remove-Item trong root → null dưới 2 s (${nl}, ${Math.round(nlMs)} ms)`);
    holeRows([[`function gd { }`, 'deny', 'AC3.2'], [`\nfunction gd { }`, 'deny', 'AC3.2'], [`Write-Host a\n  function gd { }`, 'deny', 'AC3.2']], { tool: 'PowerShell' });

    // Hồi quy sau review cuối: `wait` lặp lại không làm leadInfo quét tới hết đoạn cho mỗi từ.
    const tW = performance.now();
    const wk = holeKind('echo ' + 'wait '.repeat(10000) + `; rm ${OUT}/x`);
    const wMs = performance.now() - tW;
    ok(wk === 'deny' && wMs < 1500, `AC2.3: 10000 từ wait rồi rm ngoài root → deny dưới 1,5 s (${wk}, ${Math.round(wMs)} ms)`);
    holeRows([[`S=${T}; wait -n -p S; rm -rf $S/x`, 'deny', 'AC2.3'], [`S=${T}; wait -f -n -p S; rm -rf $S/x`, 'deny', 'AC2.3']]);

    // Hồi quy sau review cuối: nguồn qua ống có danh sách đường dẫn (dấu phẩy) hoặc biểu thức/splat thì không đoán được → ask.
    holeRows([
      [`Get-ChildItem '${T}/a','${OUT}/b' | Remove-Item`, 'deny', 'AC3.1'], [`Get-ChildItem -Path ${T}/a,${OUT}/b | Remove-Item`, 'deny', 'AC3.1'],
      [`gci -LiteralPath ${T}/a,${OUT}/b | ri`, 'deny', 'AC3.1'], [`Get-Item ${T}/a,${OUT}/b | Remove-Item`, 'deny', 'AC3.1'],
      [`$p=@{Path='${OUT}'}; Get-ChildItem @p | Remove-Item`, 'deny', 'AC3.1'],
      [`Get-ChildItem '${T}' | Remove-Item`, null, 'AC3.1'], [`Get-ChildItem '${OUT}' | Remove-Item`, 'deny', 'AC3.1'],
    ], { tool: 'PowerShell' });

    // Hồi quy sau review cuối: số `-C` phụ thuộc độ dài lệnh không được đi qua spread (tràn stack → RangeError → push nhánh main lọt).
    const gc = holeKind('git ' + '-C a '.repeat(130000) + 'push origin main', { cfg: { mode: 'ask' } });
    ok(gc === 'ask', `AC1.1: 130000 × git -C a push origin main vẫn bị hỏi, decide không ném lỗi (${gc})`);

    // Request guard-bash-cd-wrapper-holes: cd sau cờ của command/builtin/time. `builtin`/`command` chạy chắc → deny ở thư mục ngoài root; `time` là từ khoá không được tin → ask; `command -v` chỉ tra cứu.
    holeRows([
      [`command -- cd ${OUT}; rm x`, 'deny', 'cd-wrapper AC1.1'], [`command -p cd ${OUT}; rm x`, 'deny', 'cd-wrapper AC1.1'], [`builtin -- cd ${OUT}; rm x`, 'deny', 'cd-wrapper AC1.1'],
      [`time -p cd ${OUT}; rm x`, 'deny', 'cd-wrapper AC1.1'],
      // `command -pv $x` vốn ask (không phải ngoại lệ lookup của request trước): không đổi.
      [`command -pv $x`, 'deny', 'cd-wrapper AC1.1'], [`command -v cd; rm x`, null, 'cd-wrapper AC1.1'], [`command -v $x`, null, 'cd-wrapper AC1.1'], [`command -pv cd; rm x`, null, 'cd-wrapper AC1.1'],
      [`builtin cd ${T}; rm x`, null, 'cd-wrapper AC1.1'], [`command -p cd ${T}; rm x`, null, 'cd-wrapper AC1.1'],
    ]);
    // H1 (push nhánh bảo vệ): `trackDirs` nhận `cd` qua `unwrap` nên cd sau `builtin`/`command`/`then` đổi thư mục tra nhánh. `<P>/repo` đang ở main, mọi thư mục khác ở feature.
    {
      const repoDir = path.resolve(P, 'repo');
      const branchOpts = { currentBranch: (d) => (d === repoDir ? 'main' : 'feature/x') };
      for (const [label, o] of [['full', { opts: branchOpts }], ['ask', { cfg: { mode: 'ask' }, opts: branchOpts }]]) {
        const pushKind = label === 'full' ? 'deny' : 'ask';
        holeRows([
          [`builtin cd repo && git push`, pushKind, `cd-wrapper AC1.3 (${label})`], [`command cd repo; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`],
          [`command -- cd repo && git push`, pushKind, `cd-wrapper AC1.3 (${label})`], [`if true; then cd repo; fi; git push`, pushKind, `cd-wrapper AC1.3 (${label})`],
          [`cd repo && git push`, pushKind, `cd-wrapper AC1.3 (${label})`], [`builtin cd other && git push`, null, `cd-wrapper AC1.3 (${label})`],
        ], o);
      }
    }
    // Ngược lại (cwd ở main, `other` ở feature): chỉ `cd` chạy trong shell hiện tại mới đổi thư mục tra nhánh; `sudo cd`, `env cd`, `command -v cd`… không đổi nên push vẫn từ main → ask (không được thành null).
    {
      const mainDir = path.resolve(P);
      const mainOpts = { currentBranch: (d) => (path.resolve(d) === mainDir ? 'main' : 'feature/x') };
      for (const [label, o] of [['full', { opts: mainOpts }], ['ask', { cfg: { mode: 'ask' }, opts: mainOpts }]]) {
        const pushKind = label === 'full' ? 'deny' : 'ask';
        holeRows([
          [`cd other; git push origin HEAD`, null, `cd-wrapper AC1.3 (${label})`], [`builtin cd other; git push origin HEAD`, null, `cd-wrapper AC1.3 (${label})`],
          [`command -p cd other; git push origin HEAD`, null, `cd-wrapper AC1.3 (${label})`],
          // cd sau từ khoá điều kiện/`time`/`.{` không chắc chạy: thư mục chưa rõ nên push không refspec rõ vẫn hỏi (cwd ở main, `other` ở feature).
          [`if false; then cd other; fi; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`], [`time -p cd other; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`],
          [`while true; do cd other; done; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`], [`.{ cd other }; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`],
          [`sudo cd other; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`], [`env cd other; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`],
          [`nohup cd other; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`], [`timeout 5 cd other; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`],
          [`exec cd other; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`], [`env -S "cd other"; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`],
          [`command -v cd other; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`], [`command -pv cd other; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`],
        ], o);
      }
      // `builtin` nay thuộc unwrap nên H6 cũng thấy lệnh ghi sau nó.
      holeRows([[`builtin rm ${OUT}/x`, 'deny', 'cd-wrapper AC1.3'], [`builtin rm ${T}/x`, null, 'cd-wrapper AC1.3']]);
    }
    // `wait` cờ gộp (`-fp S`) và tên dính liền (`-pS`) vẫn ghi PID vào S; cờ không có `p` thì không. `timeout` nhận thời lượng là biến nhưng chỉ một từ.
    holeRows([
      [`S=${T}; wait -fp S; rm -rf $S/x`, 'deny', 'cd-wrapper AC1.4'], [`S=${T}; wait -pS; rm -rf $S/x`, 'deny', 'cd-wrapper AC1.4'],
      [`S=${T}; wait -n -fp S; rm -rf $S/x`, 'deny', 'cd-wrapper AC1.4'], [`S=${T}; wait -fpS; rm -rf $S/x`, 'deny', 'cd-wrapper AC1.4'],
      [`S=${T}; wait -fn; rm -rf $S/x`, null, 'cd-wrapper AC1.4'], [`S=${T}; wait; rm -rf $S/x`, null, 'cd-wrapper AC1.4'],
      // Thời lượng là biến không trích dẫn có thể chứa khoảng trắng (bash tách từ: `T='5 rm'` → `timeout 5 rm -rf …`), nên `$T` không được coi là thời lượng → vẫn ask như trước request.
      [`timeout $T ls`, 'deny', 'cd-wrapper AC1.5'], [`timeout \${T}s ls ${T}/x`, 'deny', 'cd-wrapper AC1.5'], [`T='5 rm'; timeout $T -rf ${OUT}/x`, 'deny', 'cd-wrapper AC1.5'],
      [`timeout 5 ls ${T}/x`, null, 'cd-wrapper AC1.5'],
      [`R=rm; timeout 5 $R ${OUT}/x`, 'deny', 'cd-wrapper AC1.5'], [`R=rm; timeout $T $R ${OUT}/x`, 'deny', 'cd-wrapper AC1.5'],
    ]);
    // Hồi quy sau review cuối: từ `-ppp…p` kèm nháy chứa xuống dòng không được làm regex của nhánh `wait` backtrack bậc hai (50000 ký tự `p` từng mất ~1,8 s).
    {
      const tP = performance.now();
      const pw = holeKind(`S=${T}; wait -` + 'p'.repeat(50000) + `'\n'; rm -rf $S/x`);
      const pwMs = performance.now() - tP;
      ok(pw !== null && !String(pw).startsWith('throw') && pwMs < 1500, `cd-wrapper AC1.4: wait -ppp…p (50000) kèm nháy xuống dòng, rm qua $S → hỏi/chặn dưới 1,5 s (${pw}, ${Math.round(pwMs)} ms)`);
    }
    // H1: cwd ở main, `other` ở feature. Khối `{ }` trần của PowerShell là scriptblock không chạy; cd trong `$( )`/subshell không đổi thư mục shell cha; cd sau `||`/ống hoặc chạy nền (`&`) không chắc đổi thư mục → push vẫn từ main (ask). Đối chứng: cd thật chạy (`{ cd; }` của bash, `!`, `VAR=x cd`, `&&`) vẫn đổi sang feature (null).
    {
      const mainDir = path.resolve(P);
      const mainOpts = { currentBranch: (d) => (path.resolve(d) === mainDir ? 'main' : 'feature/x') };
      for (const [label, o] of [['full', { opts: mainOpts }], ['ask', { cfg: { mode: 'ask' }, opts: mainOpts }]]) {
        const pushKind = label === 'full' ? 'deny' : 'ask';
        holeRows([
          [`{ cd other }; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 PS (${label})`], [`{ cd other; }; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 PS (${label})`],
          [`{ Set-Location other }; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 PS (${label})`], [`{ cd other } && git push origin HEAD`, pushKind, `cd-wrapper AC1.3 PS (${label})`],
        ], { ...o, tool: 'PowerShell' });
        holeRows([
          [`x=$(builtin cd other); git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`], [`x=$(builtin cd other) git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`],
          ['x=`builtin cd other`; git push origin HEAD', pushKind, `cd-wrapper AC1.3 (${label})`],
          [`true || builtin cd other; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`], [`echo x | builtin cd other; git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`],
          [`builtin cd other & git push origin HEAD`, pushKind, `cd-wrapper AC1.3 (${label})`],
          [`{ cd other; }; git push origin HEAD`, null, `cd-wrapper AC1.3 (${label})`], [`! cd other; git push origin HEAD`, null, `cd-wrapper AC1.3 (${label})`],
          [`VAR=x cd other; git push origin HEAD`, null, `cd-wrapper AC1.3 (${label})`], [`builtin cd other && git push origin HEAD`, null, `cd-wrapper AC1.3 (${label})`],
          [`cd other 2>&1 && git push origin HEAD`, null, `cd-wrapper AC1.3 (${label})`],
        ], o);
      }
    }
    // PowerShell: `.{ … }` (dot-source một khối) chạy ngay trong scope hiện tại nên cd đổi thư mục thật; từ `.{`/`&{` đầu đoạn không phải tên lệnh.
    holeRows([
      [`.{ cd '${OUT}' }; Remove-Item x`, 'deny', 'cd-wrapper AC1.2'], [`&{ cd '${OUT}' }; Remove-Item x`, 'deny', 'cd-wrapper AC1.2'],
      [`cd '${T}'; Remove-Item x`, null, 'cd-wrapper AC1.2'],
      // Lệnh ghi đứng ngay sau `.{`: unwrap cũng phải bỏ từ `.{`/`&{` như `{`.
      [`.{ Remove-Item ${OUT}/x }`, 'deny', 'cd-wrapper AC1.2'], [`.{ rm ${OUT}/x }`, 'deny', 'cd-wrapper AC1.2'], [`.{ Remove-Item ${T}/x }`, null, 'cd-wrapper AC1.2'],
    ], { tool: 'PowerShell' });

    // for-loop-var: `for NAME in <literal>; do … done` giải $NAME bằng từng giá trị như brace; mỗi giá trị phân loại riêng, giá trị xấu nhất thắng.
    const L = 'for-loop-var';
    const vals = (n) => Array.from({ length: n }, (_, i) => `v${i}`).join(' ');
    expectAll([
      [`for c in a b; do rm ${T}/$c.out; done`, null, `${L} AC1.1`],
      [`SP=${T} && for c in 1 2 3; do bash "$SP/runcase.sh" $c > "$SP/$c.out" 2>&1; done`, null, `${L} AC1.1`],
      [`for c in a b; do rm "$c"; done`, null, `${L} AC1.1`],
      [`for c in a b\ndo\n  cp x ${T}/$c\n  echo y > ${T}/$c.log\ndone`, null, `${L} AC1.1`],
      [`for c in a b; do echo $(rm ${T}/$c); done`, null, `${L} AC1.1`],
      [`for a in 1 2; do for b in x y; do rm ${T}/$a/$b; done; done`, null, `${L} AC1.1`],
      [`for c in ${vals(256)}; do rm ${T}/$c; done`, null, `${L} AC1.1`],
      [`for c in a b; do rm ${OUT}/$c.out; done`, 'deny', `${L} AC1.1`],
      [`for c in a b; do rm ${D}/$c.out; done`, 'deny', `${L} AC1.1`],
      [`SP=${OUT} && for c in 1 2 3; do bash "$SP/runcase.sh" $c > "$SP/$c.out" 2>&1; done`, 'deny', `${L} AC1.1`],
      [`for a in 1 2; do for b in x y; do rm ${OUT}/$a/$b; done; done`, 'deny', `${L} AC1.1`],
      [`for c in .. a; do rm ${T}/$c/x; done`, 'deny', `${L} AC1.2`],
      [`for c in a ..; do rm ${T}/$c/x; done`, 'deny', `${L} AC1.2`],
      [`for c in $X; do rm ${T}/$c; done`, 'deny', `${L} AC1.3`],
      [`for c in *.log; do rm ${T}/$c; done`, 'deny', `${L} AC1.3`],
      [`for c in $(ls); do rm ${T}/$c; done`, 'deny', `${L} AC1.3`],
      [`for c in {a,b}; do rm ${T}/$c; done`, 'deny', `${L} AC1.3`],
      [`for c in a,b; do rm ${T}/$c; done`, 'deny', `${L} AC1.3`],
      [`for c in "a b"; do rm ${T}/$c; done`, 'deny', `${L} AC1.3`],
      [`for c in -t; do rm ${T}/$c; done`, 'deny', `${L} AC1.3`],
      [`for c in; do rm ${T}/$c; done`, 'deny', `${L} AC1.3`],
      [`for c; do rm ${T}/$c; done`, 'deny', `${L} AC1.3`],
      [`for c in ${vals(257)}; do rm ${T}/$c; done`, 'deny', `${L} AC1.3`],
      [`for c in a; do case $x in a) :;; esac; rm ${T}/$c; done`, 'deny', `${L} AC1.3`],
      [`rm ${T}/$c; for c in a; do :; done`, 'deny', `${L} AC1.4`],
      [`for c in a; do :; done; rm ${T}/$c`, 'deny', `${L} AC1.4`],
      [`for c in a; do :; done > ${T}/$c.out`, 'deny', `${L} AC1.4`],
      [`for c in a; do c=/etc; rm ${T}/$c; done`, 'deny', `${L} AC1.4`],
      [`for c in a; do rm ${T}/$c; done; for c in b; do rm ${T}/$c; done`, 'deny', `${L} AC1.4`],
      [`for c in a; do read c; rm ${T}/$c; done`, 'deny', `${L} AC1.4`],
      // Lệnh con gán lại tên của vòng: giá trị thừa kế phải bị bỏ, nếu không `$c` vẫn là `a` và `rm /etc/x` lọt.
      [`for c in a; do x=$(c=/etc; rm $c/x); done`, 'deny', `${L} AC1.4`],
      [`for c in rm ls; do $c ${OUT}/x; done`, 'deny', `${L} AC1.5`],
      [`for c in rm ls; do $c ${T}/x; done`, 'deny', `${L} AC1.5`],
      [`for c in rm ls; do sudo $c ${OUT}/x; done`, 'deny', `${L} AC1.5`],
      [`for c in rm ls; do env $c ${OUT}/x; done`, 'deny', `${L} AC1.5`],
      [`for c in rm ls; do timeout 5 $c ${OUT}/x; done`, 'deny', `${L} AC1.5`],
      // Một giá trị `rm` thật sự là lệnh rm: ghi ngoài root bị chặn, trong root vẫn hỏi vì tên lệnh là biến.
      [`for c in rm; do $c ${OUT}/x; done`, 'deny', `${L} AC1.5`],
      [`for c in rm; do $c ${T}/x; done`, 'deny', `${L} AC1.5`],
      // Tên file bí mật nằm trong danh sách: nhóm giá trị phải được đọc như brace khi dò bí mật ngoài root.
      [`for c in .env a; do cat ${OUT}/$c; done`, 'deny', `${L} AC1.7`],
      [`for c in .env a; do cat ${T}/$c; done`, null, `${L} AC1.7`],
    ]);
    expectAll([
      [`$SP = '${T}'; foreach ($x in 'a','b') { Remove-Item "$SP\\$x.out" }`, null, `${L} AC1.6`],
      [`foreach ($x in 'a', 'b') { Remove-Item "${T}/$x.out" }`, null, `${L} AC1.6`],
      [`foreach ($x in 'a','b') {\n  Remove-Item "${T}/$x.a"\n  Remove-Item "${T}/$x.b"\n}`, null, `${L} AC1.6`],
      [`foreach ($x in 'a','b') { Remove-Item "${T}/$x.a"; Remove-Item "${T}/$x.b" }`, null, `${L} AC1.6`],
      [`FOREACH ($X in 'a','b') { Remove-Item "${T}/$x.out" }`, null, `${L} AC1.6`],
      [`foreach ($x in 'a','b') { Remove-Item "${OUT}/$x.out" }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in 'a','b') { Remove-Item "${D}/$x.out" }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in 'a','..') { Remove-Item "${T}/$x/f" }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in 'a','b') { Remove-Item "${T}/$x.a"; Remove-Item "${OUT}/$x.b" }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in 'a') { foreach ($y in 'b') { Remove-Item "${T}/$x/$y" } }`, null, `${L} AC1.6`],
      [`foreach ($x in 'a') { foreach ($y in 'b') { Remove-Item "${OUT}/$x/$y" } }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in 'a') { foreach ($y in 'b') { Remove-Item "${T}/$x/$y" }; Remove-Item "${OUT}/$x" }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in 'a') { foreach ($y in 'b') { Remove-Item "${T}/$x/$y" }; Remove-Item "${T}/$y" }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in 'a') { foreach ($x in 'b') { Remove-Item "${T}/$x" } }`, 'deny', `${L} AC1.6`],
      [`if ($true) { foreach ($y in 'b') { Remove-Item "${T}/$y" } }`, 'deny', `${L} AC1.6`],
      // Từ không nháy trong danh sách là lệnh được chạy (pwd cho thư mục hiện tại), không phải chuỗi 'pwd'.
      [`foreach ($x in pwd) { Remove-Item "$x\\.." -Recurse }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in 'a',pwd) { Remove-Item "$x/../x" }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in a,b) { Remove-Item "${T}/$x" }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in @('a','b')) { Remove-Item "${T}/$x" }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in 1..3) { Remove-Item "${T}/$x" }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in $list) { Remove-Item "${T}/$x" }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in (Get-ChildItem)) { Remove-Item "${T}/$x" }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in 'a' 'b') { Remove-Item "${T}/$x" }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in 'a','variable:S') { Remove-Item $x }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in 'a') { Write-Host hi }; Remove-Item "${T}/$x"`, 'deny', `${L} AC1.6`],
      [`foreach ($x in 'a') { $x = '/etc'; Remove-Item "${T}/$x" }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in 'a','b') { Get-Date; Remove-Item "${T}/$x" }`, 'deny', `${L} AC1.6`],
      [`foreach ($x in 'a') { iex 'x'; Remove-Item "${T}/$x" }`, 'deny', `${L} AC1.6`],
      [`'a','b' | ForEach-Object { Remove-Item "${T}/$_" }`, 'deny', `${L} AC1.6`],
      [`$SP = '${T}'; if ($true) { Remove-Item "$SP\\a" }`, 'deny', `${L} AC1.6`],
    ], { tool: 'PowerShell' });
  } finally { fs.rmSync(tb, { recursive: true, force: true }); }

  // Test hook không đọc aip-gate.json thật của repo đang chạy test: cwd '.' trỏ vào chính repo này nên mọi lời gọi decide với cwd đó phải có seam.
  {
    const root = path.join(CORE_DIR, '..');
    const dirs = ['contract', 'content'].map((d) => path.join(root, 'test', d));
    const files = dirs.flatMap((d) => fs.readdirSync(d).filter((f) => /\.(contract|pin)\.mjs$/.test(f)).map((f) => path.join(d, f)));
    const SEAM = /\b(config|reader|locate|loadConfig)\b/;
    const bare = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      if (!/guard-(bash|files)\.mjs/.test(src)) continue;
      for (const m of src.matchAll(/\bdecide\(/g)) {
        let i = m.index + m[0].length;
        for (let depth = 1; i < src.length && depth; i++) depth += src[i] === '(' ? 1 : src[i] === ')' ? -1 : 0;
        const call = src.slice(m.index, i);
        if (/cwd: '\.'/.test(call) && !SEAM.test(call)) bare.push(`${path.basename(f)}:${src.slice(0, m.index).split('\n').length}`);
      }
      // Helper dựng input tách khỏi lời gọi (vd `bash = (command) => ({ …, cwd })` với cwd là dấu chấm): file phải truyền seam cho decide ở chỗ khác.
      const helperOnly = src.split('\n').some((l) => /cwd: '\.'/.test(l) && !/decide\(/.test(l));
      if (helperOnly && !/reader: \(\) => null/.test(src)) bare.push(`${path.basename(f)}: helper cwd '.' không có reader`);
    }
    ok(bare.length === 0, `AC1.4: test hook không đọc aip-gate.json thật (${bare.join(', ') || 'đủ seam'})`);
  }
}
