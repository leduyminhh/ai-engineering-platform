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
}
