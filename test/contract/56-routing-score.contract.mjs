// Contract 56: scorer routing tất định (scripts/routing-score.mjs) — unit của scorer (AC1.3, AC1.4).
export default async function run({ ok, ctx }) {
  const { fs, path, pathToFileURL, REPO_ROOT } = ctx;
  const S = await import(pathToFileURL(path.join(REPO_ROOT, 'scripts', 'routing-score.mjs')).href);
  const { findWeakening } = await import(pathToFileURL(path.join(REPO_ROOT, 'core', 'skills', 'plan-execution', 'scripts', 'review-package.mjs')).href);

  ok(S.normalize('Đặc tả yêu cầu') === 'dac ta yeu cau', 'AC1.3 normalize bỏ dấu, đ → d, chữ thường');
  const tk = S.tokens('Đặc tả yêu cầu');
  ok(['dac', 'ta', 'yeu', 'cau', 'dac ta'].every((t) => tk.includes(t)), 'AC1.3 tokens có unigram và bigram');
  ok(S.routable('Viết spec. Không dùng khi cần ADR → engineering-adr.') === 'Viết spec. ', 'AC1.3 routable cắt từ "Không dùng khi"');

  const docs = [
    { id: 'b-git', text: 'commit branch merge git' },
    { id: 'a-spec', text: 'viết spec đặc tả yêu cầu' },
    { id: 'c-same', text: 'commit branch merge git' },
  ];
  const idx = S.buildIndex(docs);
  ok(S.rank(idx, 'đặc tả yêu cầu cho tính năng')[0].id === 'a-spec', 'AC1.3 rank: hạng 1 đúng tài liệu');
  ok(S.rank(idx, 'commit git')[0].id === 'b-git' && S.rank(idx, 'commit git')[1].id === 'c-same', 'AC1.3 rank: hoà điểm xếp theo id tăng dần');
  const empty = S.rank(idx, '!!! ???');
  ok(empty.length === 3 && empty.every((r) => r.score === 0), 'AC1.3 rank: prompt không token → điểm 0 cho mọi id, không ném');

  const m = S.measure({ docs, data: {
    'a-spec': { positive: ['đặc tả yêu cầu', 'commit git'], negative: ['commit git', 'đặc tả yêu cầu'] },
  } });
  ok(m.positive.hit === 1 && m.positive.total === 2 && m.positive.pct === 50, 'AC1.3 measure: đếm hit/total/pct của positive');
  ok(m.negative.hit === 1 && m.negative.total === 2 && m.negative.pct === 50, 'AC1.3 measure: negative đạt khi id không ở hạng 1');
  ok(m.misses.length === 2, 'AC1.3 measure: liệt kê miss');
  ok(S.measure({ docs, data: { 'a-spec': { positive: ['đặc tả yêu cầu', 'commit git', 'commit git'], negative: [] } } }).positive.pct === 33, 'AC1.3 measure: pct làm tròn xuống');

  const lk = (p, n) => ({ positive: { threshold: p }, negative: { threshold: n } });
  const meas = (p, n) => ({ positive: { pct: p }, negative: { pct: n } });
  ok(S.lockDecision({ measured: meas(80, 90), locked: null }).action === 'write', 'AC1.4 lockDecision: chưa có khoá → ghi');
  ok(S.lockDecision({ measured: meas(85, 90), locked: lk(80, 90) }).action === 'write', 'AC1.4 lockDecision: số đo cao hơn → ghi');
  ok(S.lockDecision({ measured: meas(85, 90), locked: lk(80, 90) }).lock.positive.threshold === 85, 'AC1.4 lockDecision: khoá mới mang số đo cao hơn');
  ok(S.lockDecision({ measured: meas(75, 95), locked: lk(80, 90) }).action === 'fail', 'AC1.4 lockDecision: một trục thấp hơn → exit 1, không ghi');
  ok(S.lockDecision({ measured: meas(80, 90), locked: lk(80, 90) }).action === 'keep', 'AC1.4 lockDecision: bằng → không ghi');

  const diff = [
    'diff --git a/test/routing/rank1.lock.json b/test/routing/rank1.lock.json',
    '--- a/test/routing/rank1.lock.json',
    '+++ b/test/routing/rank1.lock.json',
    '@@ -1,5 +1,5 @@',
    ' {',
    '   "positive": {',
    '-    "threshold": 80',
    '+    "threshold": 70',
    '   },',
    '   "negative": {',
    '     "threshold": 90',
    '   }',
    ' }',
  ].join('\n');
  ok(findWeakening(diff).length === 1, 'AC1.4 findWeakening: hạ "threshold" trong file khoá bị bắt đúng một dòng');

  // Dữ liệu thật: mỗi id published có file prompt mẫu, và số đo không tụt dưới ngưỡng khoá (AC1.1, AC1.2).
  const realDocs = S.loadRoutingDocs();
  const realData = S.loadRoutingData();
  const names = realDocs.map((d) => d.id);
  ok(new Set(names).size === names.length, 'AC1.1 id trần của tập chấm không trùng nhau');
  for (const id of names) {
    const d = realData[id];
    ok(!!d && d.positive?.length >= 3 && d.negative?.length >= 2, `AC1.1 test/routing/${id}.json có ≥ 3 positive và ≥ 2 negative`);
  }
  for (const id of Object.keys(realData)) ok(names.includes(id), `AC1.1 test/routing/${id}.json thuộc tập id published`);
  const lockPath = path.join(REPO_ROOT, 'test', 'routing', 'rank1.lock.json');
  ok(fs.existsSync(lockPath), 'AC1.2 có test/routing/rank1.lock.json');
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const real = S.measure({ docs: realDocs, data: realData });
    for (const k of ['positive', 'negative']) {
      ok(real[k].pct >= lock[k].threshold, `AC1.2 ${k} rank-1 ${real[k].pct}% >= ngưỡng khoá ${lock[k].threshold}%`);
    }
  }

  // Case eval "phải im lặng": skill đúng được gọi (min 1), skill dễ nhầm không được gọi (max 0) (AC1.5).
  const quiet = [
    ['engineering/tdd-quiet-on-bug', 'workflow-bugfix', 'engineering-tdd'],
    ['backend/code-review-quiet-on-scan', 'engineering-quality-gate', 'backend-code-review'],
    ['core/release-quiet-on-commit', 'git-workflow', 'git-release'],
  ];
  for (const [dir, want, silent] of quiet) {
    const gdir = path.join(REPO_ROOT, 'evals', dir, 'graders');
    const gs = fs.existsSync(gdir) ? fs.readdirSync(gdir).filter((f) => f.endsWith('.md')).map((f) => ctx.parseFrontmatter(fs.readFileSync(path.join(gdir, f), 'utf8')).meta) : [];
    const hits = (id) => gs.filter((g) => g.type === 'tool_used' && g.tool === 'Skill' && g.input_match && new RegExp(g.input_match).test(`"skill": "${id}"`) && new RegExp(g.input_match).test(`"skill":"core:${id}"`));
    ok(hits(want).some((g) => g.min === 1), `AC1.5 evals/${dir}: skill ${want} phải được gọi (min: 1)`);
    ok(hits(silent).some((g) => g.min === 0 && g.max === 0), `AC1.5 evals/${dir}: skill ${silent} phải im lặng (max: 0)`);
  }
}
