// Contract quyền theo thư mục (khoá fullPaths của aip-gate.json).
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, pathToFileURL, CORE_DIR } = ctx;
  const { runMode } = await import(pathToFileURL(path.join(CORE_DIR, '..', 'cli', 'lib', 'mode.mjs')).href);

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
