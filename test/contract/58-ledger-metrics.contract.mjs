// Contract 58: script đo ledger (scripts/ledger-metrics.mjs) — AC1.1–AC1.6.
export default async function run({ ok, ctx }) {
  const { fs, path, os, pathToFileURL, REPO_ROOT } = ctx;
  const M = await import(pathToFileURL(path.join(REPO_ROOT, 'scripts', 'ledger-metrics.mjs')).href);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-metrics-'));
  const put = (project, rel, text) => {
    const file = path.join(tmp, project, '.aip', 'runs', rel, 'progress.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  try {
    // AC1.2 + AC1.3 + AC1.4 trong một project: request a (4 task xong), request b (ruling/minor + dòng nhiễu).
    put('p', 'req-a/root', [
      '# Ledger',
      'Ruling: ngoài Files: sửa thêm helper',
      'Ruling: ngoài AC, đổi hành vi',
      'Task 1: complete (commits a..b)',
      'Task 1: review 1 compliant 0/0/0',
      'Task 2: complete (commits c..d)',
      'Task 2: review 1 issues 0/1/0',
      'Task 2: review 2 compliant 0/0/0',
      'Task 3: complete (commits e..f)',
      'Task 3: review 1 issues 0/1/0',
      'Task 3: review 2 issues 0/1/0',
      'Task 3: review 3 compliant 0/0/0',
      'Task 4: complete (commits g..h)',
      'minor (deferred): đặt tên',
      '',
    ].join('\n'));
    put('p', 'req-b/root', [
      '# Ledger',
      'Ruling: giữ nguyên',
      'minor (deferred): thiếu test',
      'Task 5: complete? chờ re-review',
      'Task 5: review 2 issues 0/1/0',
      'Task 6: start (base abcdef1)',
      'Task 6: review 2 issues 0/1/0',
      'Task 7: complete (commits i..j)',
      'Task 7: complete (commits k..l, sửa lại)',
      '',
    ].join('\n'));

    const m = M.measure(path.join(tmp, 'p'), 'x');
    ok(m.project === 'x' && m.ledgers === 2 && m.requests === 2, 'AC1.3 measure: ledgers và requests theo thư mục cấp một');
    ok(m.tasks === 5, 'AC1.4 task `complete?`, task chưa complete không vào tasks; task hai dòng complete đếm một lần');
    ok(m.tasksReview2plus === 2 && m.tasksIssuesAtRound2plus === 1 && m.tasksIssuesAtRound3plus === 0,
      'AC1.2 tasksReview2plus=2, issues vòng ≥2 = 1, vòng ≥3 = 0; review của task chưa complete không vào');
    ok(m.pctReview2plus === 40, 'AC1.2 pctReview2plus = 2/5*100 làm tròn 1 chữ số');
    ok(m.rulings === 3 && m.rulingsOutsideFiles === 1 && m.minorDeferred === 2, 'AC1.3 rulings=3, ngoài Files=1 (ngoài AC không tính), minor=2');
    ok(m.outsideFilesPerRequest === 0.5, 'AC1.3 outsideFilesPerRequest = 1/2');
    const a = m.byRequest.find((r) => r.request === 'req-a');
    ok(m.byRequest.length === 2 && a.tasks === 4 && a.tasksReview2plus === 2 && a.rulings === 2 && a.rulingsOutsideFiles === 1 && a.minorDeferred === 1,
      'AC1.3 byRequest tách số theo request');

    const p = M.parseLedger('Task 1: complete\nTask 1: review 2 issues 0/1/0\nTask 2: COMPLETE ok\nTask 3: complete?\n');
    ok(p.complete.join() === '1,2' && p.maxRound['1'] === 2 && p.issueRounds['1'].join() === '2', 'AC1.4 parseLedger: complete không phân biệt hoa thường, loại `complete?`');

    // AC1.2 đúng bộ số của design (4 task, 2 vòng 2+): tách riêng khỏi dữ liệu nhiễu ở trên.
    put('q', 'r/root', [
      'Task 1: complete', 'Task 1: review 1 compliant 0/0/0',
      'Task 2: complete', 'Task 2: review 1 issues 0/1/0', 'Task 2: review 2 compliant 0/0/0',
      'Task 3: complete', 'Task 3: review 1 issues 0/1/0', 'Task 3: review 2 issues 0/1/0', 'Task 3: review 3 compliant 0/0/0',
      'Task 4: complete', '',
    ].join('\n'));
    const q = M.measure(path.join(tmp, 'q'), 'q');
    ok(q.tasks === 4 && q.tasksReview2plus === 2 && q.pctReview2plus === 50, 'AC1.2 4 task: tasks=4, tasksReview2plus=2, pct=50');
    // AC1.1 + AC1.5: CLI.
    const CLI = path.join(REPO_ROOT, 'scripts', 'ledger-metrics.mjs');
    const cli = (args) => {
      try { return { status: 0, stderr: '', stdout: ctx.execFileSync(process.execPath, [CLI, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
      catch (e) { return { status: e.status, stdout: String(e.stdout), stderr: String(e.stderr) }; }
    };
    const list = (d) => fs.readdirSync(d, { recursive: true }).sort().join('|');
    const before = list(path.join(tmp, 'p'));
    const r = cli(['--project', path.join(tmp, 'p'), '--label', 'lbl']);
    let j = null;
    try { j = JSON.parse(r.stdout); } catch { /* assert dưới */ }
    const KEYS = ['project', 'ledgers', 'requests', 'tasks', 'tasksReview2plus', 'pctReview2plus', 'tasksIssuesAtRound2plus', 'tasksIssuesAtRound3plus', 'rulings', 'rulingsOutsideFiles', 'outsideFilesPerRequest', 'minorDeferred', 'byRequest'];
    ok(r.status === 0 && j && KEYS.every((k) => k in j) && j.project === 'lbl' && r.stderr === '', 'AC1.1 CLI: exit 0, JSON đủ khoá D3, project = --label, stderr rỗng');
    ok(list(path.join(tmp, 'p')) === before, 'AC1.1 CLI không tạo hay sửa file trong --project');
    const dflt = cli(['--project', path.join(tmp, 'p')]);
    ok(dflt.status === 0 && JSON.parse(dflt.stdout).project === 'project', 'AC1.1 --label mặc định là `project`');
    ok(!r.stdout.includes(tmp), 'AC1.1 stdout không chứa đường dẫn tuyệt đối');

    fs.mkdirSync(path.join(tmp, 'empty'));
    const e1 = cli(['--project', path.join(tmp, 'empty')]);
    const e2 = cli([]);
    ok(e1.status === 1 && e1.stdout === '' && e1.stderr.trim() !== '', 'AC1.5 thư mục không có progress.md: exit 1, stdout rỗng, stderr nêu lý do');
    ok(e2.status === 1 && e2.stdout === '' && e2.stderr.trim() !== '', 'AC1.5 thiếu --project: exit 1, stdout rỗng, stderr nêu lý do');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
