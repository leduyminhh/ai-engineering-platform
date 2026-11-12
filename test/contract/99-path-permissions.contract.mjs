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
}
