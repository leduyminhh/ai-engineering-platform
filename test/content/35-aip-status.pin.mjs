// Pin: docs/requests/2026-10-31-aip-status — dòng ledger mới + events.jsonl, skill aip-status.
export default async function run({ ok, ctx }) {
  const { fs, path, os, pathToFileURL, REPO_ROOT } = ctx;

  // AC2.1, AC2.2: 4 dạng dòng mới được kiểm định dạng; ghi được thì events.jsonl thêm {ts, line}, progress.md giữ định dạng
  {
    const lg = await import(pathToFileURL(path.join(REPO_ROOT, 'core', 'skills', 'plan-execution', 'scripts', 'ledger.mjs')).href);
    const reject = [
      'Task 1: start', 'Task 1: start (base xyz)', 'Task 1: start base 1a2b3c4',
      'Task 1: review 0 compliant 0/0/0', 'Task 1: review 1 ok 0/0/0', 'Task 1: review 1 issues 1/0', 'Task 1: review',
      'Blocked:', 'Blocked:   ', 'Unblocked:', 'Unblocked:  ',
      // Regression review Task 1 (F1): biến thể hoa thường/thụt đầu dòng không được lọt thành dòng tự do
      ' Blocked: x', 'blocked: x', 'UNBLOCKED: y', '  Task 1: start', 'task 1: review 1 compliant 0/0/0',
    ];
    const accept = [
      'Task 3: start (base 1a2b3c4)', 'Task 3: start (base 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b)',
      'Task 3: review 2 issues 0/1/2', 'Task 3: review 1 compliant 0/0/0', 'Task 3: review 3 cannot_verify 0/0/1',
      'Blocked: thiếu quyền ghi', 'Unblocked: dùng thư mục tạm', 'Task 1: started trong worktree',
    ];
    for (const l of reject) ok(typeof lg.validateLine(l) === 'string', `AC2.2: validateLine từ chối ${JSON.stringify(l)}`);
    for (const l of accept) ok(lg.validateLine(l) === null, `AC2.2: validateLine chấp nhận ${JSON.stringify(l)}`);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-ledger-events-'));
    const quiet = (fn) => { const o = console.log, e = console.error; console.log = console.error = () => {}; try { return fn(); } finally { console.log = o; console.error = e; } };
    try {
      const deps = { cwd: tmp, git: () => { throw new Error('không phải repo'); } };
      const dir = path.join(tmp, '.aip', 'runs', path.basename(tmp), 'root');
      const prog = path.join(dir, 'progress.md');
      const events = path.join(dir, 'events.jsonl');
      const rc = quiet(() => lg.main([tmp, 'Blocked:'], deps));
      ok(rc === 2 && !fs.existsSync(prog) && !fs.existsSync(events), 'AC2.2: dòng sai định dạng → exit 2, không ghi progress.md lẫn events.jsonl');
      const rc2 = quiet(() => lg.main([tmp, 'Task 1: start (base 1a2b3c4)\nBlocked:'], deps));
      ok(rc2 === 2 && !fs.existsSync(prog) && !fs.existsSync(events), 'AC2.2: đối số nhiều dòng có một dòng sai → không ghi gì');

      const lines = ['Task 1: start (base 1a2b3c4)', 'Blocked: thiếu quyền ghi'];
      const rc3 = quiet(() => lg.main([tmp, lines.join('\n')], deps));
      const recs = fs.existsSync(events) ? fs.readFileSync(events, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
      ok(rc3 === 0 && recs.length === 2 && recs.every((r, i) => r.line === lines[i] && !Number.isNaN(Date.parse(r.ts)) && /T.*Z$/.test(r.ts)),
        'AC2.1: ghi 2 dòng → events.jsonl thêm đúng 2 bản ghi {ts ISO, line}');
      ok(rc3 === 0 && fs.readFileSync(prog, 'utf8') === `${lines.join('\n')}\n`, 'AC2.1: progress.md chỉ chứa đúng các dòng ledger, không có JSON');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}
