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
      // Regression review cuối: events.jsonl không ghi được thì progress.md vẫn có dòng và lệnh không thất bại (ghi lại sẽ trùng dòng)
      fs.rmSync(events);
      fs.mkdirSync(events);
      const rc4 = quiet(() => lg.main([tmp, 'Unblocked: dùng thư mục tạm'], deps));
      ok(rc4 === 0 && fs.readFileSync(prog, 'utf8').endsWith('Unblocked: dùng thư mục tạm\n'), 'events.jsonl lỗi → progress.md vẫn ghi, exit 0');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  // AC3.1, AC3.2: skill /aip-status nêu đủ lệnh, khối hành động và nhánh không có công cụ hiển thị
  {
    const t = fs.readFileSync(path.join(REPO_ROOT, 'core', 'skills', 'aip-status', 'SKILL.md'), 'utf8');
    ok(t.includes('aip status --json') && t.includes('aip status --html'), 'AC3.1: skill nêu cả `aip status --json` lẫn `aip status --html`');
    ok(t.includes('Cần bạn xử lý') && t.includes('Xử lý ↗'), 'AC3.1: skill nêu khối "Cần bạn xử lý" và nút "Xử lý ↗"');
    ok(/không có công cụ hiển thị[^\n]*in text/.test(t), 'AC3.2: skill có nhánh không có công cụ hiển thị in text của aip status');
  }
  // AC4.1–AC4.3: câu chữ task-loop/inline về dòng ledger mới và xử lý part vướng
  {
    const dir = path.join(REPO_ROOT, 'core', 'skills', 'plan-execution', 'references');
    const loop = fs.readFileSync(path.join(dir, 'task-loop.md'), 'utf8');
    const inline = fs.readFileSync(path.join(dir, 'inline.md'), 'utf8');
    const part = loop.slice(loop.indexOf('## Part vướng'), loop.indexOf('## Gom task nhỏ'));
    ok(loop.includes('Task <n>: start (base <hash>)') && loop.includes('Task <n>: review <vòng> <spec_verdict>'),
      'task-loop.md bắt ghi Task <n>: start và Task <n>: review');
    ok(inline.includes('Task <n>: start (base <hash>)') && inline.includes('Blocked: <lý do>'),
      'inline.md bắt ghi Task <n>: start và Blocked:');
    ok(part.length > 0 && part.includes('không hỏi') && part.includes('Ruling:') && part.includes('Unblocked:')
      && part.includes('tối đa 2 vòng') && /chỉ một lần/.test(part),
      'AC4.1: bảng xử lý vướng nêu root tự gỡ không hỏi, Ruling/Unblocked, giới hạn 2 vòng sửa và 1 lần khởi động lại');
    ok(part.includes('một thẻ') && part.includes('đáp án khuyến nghị') && part.includes('part khác chạy tiếp') && part.includes('SendMessage'),
      'AC4.2: vướng hỏi người dùng gom một thẻ có đáp án khuyến nghị, part khác chạy tiếp, lời giải gửi về part');
    ok(part.includes('chỉ báo **một lần**') && part.includes('không nhắc lại') && part.includes('gộp vào cùng thẻ'),
      'AC4.3: mỗi vướng báo một lần, không nhắc lại, vướng mới gộp vào cùng thẻ');
    ok(part.includes('xử lý vướng part root'), 'nêu cách xử lý vướng của chính session gốc (part root)');
  }
}
