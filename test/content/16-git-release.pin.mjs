// Pin: script next-version.mjs của skill core/git-release (spec 2026-10-13-git-release-skill-design §5.1, §8).
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, pathToFileURL, CORE_DIR } = ctx;
  const SCRIPT = path.join(CORE_DIR, 'skills', 'git-release', 'scripts', 'next-version.mjs');
  ok(fs.existsSync(SCRIPT), 'git-release: có scripts/next-version.mjs');
  if (!fs.existsSync(SCRIPT)) return;

  const src = fs.readFileSync(SCRIPT, 'utf8');
  ok(!/(?:from\s+|import\s*\(?\s*)['"](?!node:)/.test(src) && src.includes('realpathSync'), 'next-version: chỉ node:*, guard realpath');

  const { computeNext, latestTag } = await import(pathToFileURL(SCRIPT).href);
  const c = (message, i = 0) => ({ hash: `${i}`.padStart(40, 'a'), message });

  // Bảng bump: [mô tả, current, messages, kỳ vọng bump, kỳ vọng next]
  const CASES = [
    ['breaking bằng !', [1, 2, 3], ['feat(api)!: drop v1'], 'major', '2.0.0'],
    ['breaking bằng footer', [1, 2, 3], ['fix(db): change key\r\n\r\nBREAKING CHANGE: cột id đổi kiểu'], 'major', '2.0.0'],
    ['feat → minor', [1, 2, 3], ['fix(a): x', 'feat(b): y'], 'minor', '1.3.0'],
    ['fix → patch', [1, 2, 3], ['fix(a): x', 'chore(deps): bump'], 'patch', '1.2.4'],
    ['perf → patch', [1, 2, 3], ['perf(q): faster'], 'patch', '1.2.4'],
    ['chỉ chore/docs → none', [1, 2, 3], ['chore: x', 'docs(readme): y'], 'none', null],
    ['0.x breaking → minor', [0, 4, 1], ['feat!: new api'], 'minor', '0.5.0'],
  ];
  for (const [name, current, msgs, bump, next] of CASES) {
    const r = computeNext({ current, commits: msgs.map(c) });
    ok(r.bump === bump && r.next === next, `computeNext ${name}: ${r.bump}/${r.next}`);
  }
  ok(computeNext({ current: [0, 4, 1], commits: [c('feat!: x')], zeroMajorBreaking: 'major' }).next === '1.0.0',
    'computeNext: 0.x breaking với zeroMajorBreaking=major → 1.0.0');
  ok(computeNext({ current: [1, 2, 3], commits: [c('feat: x')] }).nextDev === '1.4.0', 'computeNext: nextDev = minor kế tiếp của next');

  const hf = computeNext({ current: [1, 2, 3], commits: [c('feat(a): x', 1)], hotfix: true });
  ok(hf.bump === 'patch' && hf.next === '1.2.4' && hf.warnings.some((w) => w.includes('feat')), 'computeNext hotfix: luôn patch, feat → warning');
  ok(computeNext({ current: [1, 2, 3], commits: [], hotfix: true }).next === '1.2.4', 'computeNext hotfix: chưa có commit vẫn ra patch+1');

  const odd = computeNext({ current: [1, 2, 3], commits: [c('Update stuff', 2), c('fix: y', 3)] });
  ok(odd.groups.other.length === 1 && odd.bump === 'patch' && odd.warnings.some((w) => w.includes('Conventional')),
    'computeNext: commit lệch chuẩn → other + warning, không làm hỏng lần chạy');

  ok(latestTag(['v1.2.0', 'v1.10.0', 'v1.9.3', 'v2.0', 'release-1', 'x3.0.0'])?.tag === 'v1.10.0',
    'latestTag: chọn semver lớn nhất, bỏ tag sai định dạng');

  // Hồi quy Gitflow: tag nằm trên merge commit của main, không phải tổ tiên của develop (git describe trả v1.0.0).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nv-'));
  const g = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false',
    '-c', 'tag.gpgsign=false', '-c', `core.hooksPath=${path.join(tmp, 'no-hooks')}`, ...args], { cwd: tmp, stdio: 'pipe', encoding: 'utf8' });
  const run = (...args) => {
    try { return { code: 0, out: execFileSync(process.execPath, [SCRIPT, ...args], { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
    catch (e) { return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` }; }
  };
  try {
    g('init', '-q'); g('symbolic-ref', 'HEAD', 'refs/heads/main');
    g('commit', '-q', '--allow-empty', '-m', 'chore: init'); g('tag', 'v1.0.0');
    g('checkout', '-q', '-b', 'develop');
    g('commit', '-q', '--allow-empty', '-m', 'feat(a): add a');
    g('checkout', '-q', '-b', 'release/1.1.0');
    g('commit', '-q', '--allow-empty', '-m', 'chore(release): v1.1.0');
    g('checkout', '-q', 'main'); g('merge', '-q', '--no-ff', '-m', 'Merge release/1.1.0', 'release/1.1.0');
    g('tag', '-a', 'v1.1.0', '-m', 'Release 1.1.0');
    g('checkout', '-q', 'develop'); g('merge', '-q', '--no-ff', '-m', 'Merge release/1.1.0 into develop', 'release/1.1.0');
    g('commit', '-q', '--allow-empty', '-m', 'fix(b): fix b');
    g('tag', 'v2.0');

    const dev = run('--base', 'develop', '--json');
    const r = dev.code === 0 ? JSON.parse(dev.out) : {};
    ok(r.current === '1.1.0' && r.next === '1.1.1' && r.range === 'v1.1.0..develop'
      && r.groups?.fix.length === 1 && r.groups?.feat.length === 0,
      `next-version CLI: tag trên merge commit main vẫn ra current 1.1.0, chỉ đếm commit sau release (=${dev.code} ${r.current}→${r.next})`);
    ok(run('--base', 'main').code === 2, 'next-version CLI: không có commit cần release → exit 2');
    const hot = run('--base', 'main', '--hotfix', '--json');
    ok(hot.code === 0 && JSON.parse(hot.out).next === '1.1.1', 'next-version CLI: --hotfix trên main → 1.1.1, exit 0');
    ok(run('--base', 'no-such-branch').code === 1, 'next-version CLI: ref không tồn tại → exit 1');

    // Hotfix đã tag trên main nhưng chưa merge-back: tag mới nhất không nằm trong base → phải cảnh báo.
    g('checkout', '-q', 'main'); g('commit', '-q', '--allow-empty', '-m', 'fix(c): hot'); g('tag', 'v1.1.1');
    g('checkout', '-q', 'develop');
    const stale = run('--base', 'develop', '--json');
    const sr = stale.code === 0 ? JSON.parse(stale.out) : {};
    ok(sr.current === '1.1.1' && sr.warnings?.some((w) => w.includes('v1.1.1')),
      `next-version CLI: tag mới nhất chưa nằm trong base → warning (=${stale.code} ${sr.current})`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
