// Contract Phase 3: phân phối — distPlan thuần, publishDist trên repo tạm (KHÔNG chạm repo thật/remote), cảnh báo cài trùng.
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, REPO_ROOT, pathToFileURL } = ctx;
  const { distPlan, publishDist, parseGithubSlug } = await import(pathToFileURL(path.join(REPO_ROOT, 'cli', 'dist.mjs')).href);
  const { claudePluginOverlap } = await import(pathToFileURL(path.join(REPO_ROOT, 'cli', 'lib', 'install.mjs')).href);
  const checker = path.join(REPO_ROOT, 'core', 'skills', 'git-workflow', 'scripts', 'check-commit-message.mjs');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-dist-test-'));
  const put = (root, rel, text = 'x\n') => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  try {
    // distPlan thuần trên fixture
    const fx = path.join(tmp, 'fx');
    put(fx, 'plugins/a/x.md');
    put(fx, 'drafts/b/y.md');
    put(fx, '.claude-plugin/marketplace.json', '{}\n');
    const plan = distPlan({ buildDir: fx, sourceSha: 'abc1234def' });
    ok(plan.files.includes('plugins/a/x.md') && plan.files.includes('.claude-plugin/marketplace.json'), 'distPlan: có file plugin + .claude-plugin/marketplace.json');
    ok(!plan.files.some((f) => f.startsWith('drafts/')), 'distPlan: bỏ drafts/');
    ok(plan.message.split('\n')[0] === 'chore(dist): publish claude marketplace from abc1234', 'distPlan: header commit dùng sha 7 ký tự');
    const msgFile = path.join(tmp, 'msg.txt');
    fs.writeFileSync(msgFile, plan.message);
    let code = 0;
    try { execFileSync('node', [checker, msgFile], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    ok(code === 0, 'distPlan: message qua check-commit-message.mjs (exit 0)');
    ok(parseGithubSlug('https://github.com/o/r.git') === 'o/r' && parseGithubSlug('git@github.com:o/r.git') === 'o/r' && parseGithubSlug('/local/path') === null,
      'parseGithubSlug: https/ssh → owner/repo, remote lạ → null');

    // publishDist trên repo tạm: orphan branch → commit → idempotent → xoá file cũ
    const repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo);
    git(repo, 'init', '-q', '-b', 'main');
    git(repo, 'config', 'user.name', 'T'); git(repo, 'config', 'user.email', 't@example.com');
    put(repo, 'README.md');
    git(repo, 'add', '.'); git(repo, 'commit', '-q', '-m', 'init');
    const buildDir = path.join(repo, 'build', 'claude');
    put(buildDir, 'plugins/a/x.md', 'v1\n');
    put(buildDir, 'plugins/a/old.md');
    put(buildDir, 'drafts/b/y.md');
    put(buildDir, '.claude-plugin/marketplace.json', '{}\n');
    const quiet = { log: { log: () => {} } };
    const r1 = publishDist({ repoRoot: repo, buildDir, build: false, ...quiet });
    ok(r1.committed === true && /^[0-9a-f]{40}$/.test(git(repo, 'rev-parse', 'dist')), 'publishDist: tạo branch dist cục bộ với 1 commit');
    const tree1 = git(repo, 'ls-tree', '-r', '--name-only', 'dist').split('\n').sort();
    ok(tree1.join() === ['.claude-plugin/marketplace.json', 'plugins/a/old.md', 'plugins/a/x.md'].join(), 'publishDist: tree dist = build/claude trừ drafts/');
    ok(git(repo, 'log', '-1', '--format=%s', 'dist').startsWith('chore(dist): publish claude marketplace from '), 'publishDist: header commit đúng dạng');
    ok(!/co-authored-by/i.test(git(repo, 'log', '-1', '--format=%B', 'dist')), 'publishDist: commit không có Co-Authored-By');
    ok(git(repo, 'branch', '--show-current') === 'main' && git(repo, 'worktree', 'list').split('\n').length === 1, 'publishDist: repo gốc vẫn ở main, worktree tạm đã gỡ');
    const sha1 = git(repo, 'rev-parse', 'dist');
    const r2 = publishDist({ repoRoot: repo, buildDir, build: false, ...quiet });
    ok(r2.committed === false && git(repo, 'rev-parse', 'dist') === sha1, 'publishDist: build không đổi → không tạo commit mới');
    fs.rmSync(path.join(buildDir, 'plugins/a/old.md'));
    put(buildDir, 'plugins/a/x.md', 'v2\n');
    const r3 = publishDist({ repoRoot: repo, buildDir, build: false, ...quiet });
    ok(r3.committed === true && !git(repo, 'ls-tree', '-r', '--name-only', 'dist').includes('old.md') && git(repo, 'show', 'dist:plugins/a/x.md') === 'v2',
      'publishDist: lần sau xoá file cũ và cập nhật nội dung');
    ok(git(repo, 'worktree', 'list').split('\n').length === 1, 'publishDist: không để sót worktree sau nhiều lần chạy');
    const before = git(repo, 'rev-parse', 'dist');
    const dry = publishDist({ repoRoot: repo, buildDir, build: false, dryRun: true, ...quiet });
    ok(dry.committed === false && git(repo, 'rev-parse', 'dist') === before, 'publishDist --dry-run: chỉ trả plan, không commit');

    // claudePluginOverlap thuần
    ok(JSON.stringify(claudePluginOverlap(['backend', 'core'], ['backend', 'frontend'])) === '["backend"]', 'claudePluginOverlap: giao của đã cài và đang chọn');
    ok(claudePluginOverlap([], ['backend']).length === 0 && claudePluginOverlap(['a'], []).length === 0, 'claudePluginOverlap: rỗng → rỗng');
    ok(JSON.stringify(claudePluginOverlap(['core', 'backend'], ['backend', 'core', 'backend'])) === '["backend","core"]', 'claudePluginOverlap: theo thứ tự đang chọn, không trùng');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
