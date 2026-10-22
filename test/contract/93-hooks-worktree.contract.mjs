// Contract hook trong git worktree thật: gate-config theo repo chính/worktree, guard-files neo writeScope theo gốc worktree.
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, pathToFileURL, CORE_DIR } = ctx;
  const scripts = path.join(CORE_DIR, 'hooks', 'scripts');
  const { readGateConfig } = await import(pathToFileURL(path.join(scripts, 'gate-config.mjs')).href);
  const { decide } = await import(pathToFileURL(path.join(scripts, 'guard-files.mjs')).href);

  const git = (cwd, ...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  // Tên nhánh mặc định phụ thuộc máy nên không gán cứng; nhánh worktree đặt riêng theo repo.
  const makeRepo = (dir) => {
    fs.mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.name', 'aip-test');
    git(dir, 'config', 'user.email', 'aip-test@example.com');
    fs.writeFileSync(path.join(dir, 'README.md'), 'x\n');
    git(dir, 'add', 'README.md');
    git(dir, 'commit', '-q', '-m', 'init');
  };
  const writeGate = (root, obj) => {
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(root, '.claude', 'aip-gate.json'), JSON.stringify(obj));
  };

  const tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aip-wt-')));
  const worktrees = [];
  try {
    const main = path.join(tmp, 'main');
    const wt = path.join(tmp, 'wt');
    makeRepo(main);
    git(main, 'worktree', 'add', '-q', wt, '-b', 'wt-branch');
    worktrees.push([main, wt]);
    writeGate(main, { stopGate: false });

    const sub = path.join(wt, 'src', 'deep');
    fs.mkdirSync(sub, { recursive: true });
    const fromSub = readGateConfig(sub);
    ok(fromSub && fromSub.stopGate === false && Object.keys(fromSub).length === 1,
      'P3 AC3.1: readGateConfig từ thư mục con của worktree lấy cấu hình repo chính');

    // Thư mục chưa tồn tại (Write tạo mới) vẫn phải lên được thư mục cha có thật.
    const missing = readGateConfig(path.join(wt, 'chua', 'co'));
    ok(missing && missing.stopGate === false, 'P3 AC3.1: thư mục chưa tồn tại trong worktree vẫn lấy cấu hình repo chính');

    writeGate(wt, { stopGate: true });
    const own = readGateConfig(sub);
    ok(own && own.stopGate === true, 'P3 AC3.1: worktree có file riêng thì dùng file của worktree');

    // Repo độc lập cùng worktree của nó không chung git-common-dir với repo chính → không được mượn cấu hình repo chính.
    const other = path.join(tmp, 'other');
    const otherWt = path.join(tmp, 'other-wt');
    makeRepo(other);
    git(other, 'worktree', 'add', '-q', otherWt, '-b', 'other-branch');
    worktrees.push([other, otherWt]);
    ok(readGateConfig(other) === null, 'P3 AC3.1: repo độc lập (không chung git-common-dir) không lấy cấu hình repo khác');
    ok(readGateConfig(otherWt) === null, 'P3 AC3.1: worktree của repo độc lập không lấy cấu hình repo khác');

    const scopes = { tester: ['test/**'] };
    const write = (file) => decide({ tool_name: 'Write', cwd: wt, agent_type: 'p:tester', tool_input: { file_path: file } }, { scopes });
    ok(write(path.join(wt, 'test', 'a.test.js')) === null, 'P3 AC3.2: writeScope neo theo gốc worktree: file trong phạm vi được ghi');
    ok(write(path.join(wt, 'src', 'a.js'))?.decision === 'deny', 'P3 AC3.2: writeScope neo theo gốc worktree: file ngoài phạm vi bị deny');
  } finally {
    // Gỡ worktree bằng git trước (dọn metadata của repo chính), lỗi dọn không được che kết quả test.
    for (const [repo, dir] of worktrees) {
      try { git(repo, 'worktree', 'remove', '--force', dir); } catch { /* bỏ qua */ }
    }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* bỏ qua */ }
  }
}
