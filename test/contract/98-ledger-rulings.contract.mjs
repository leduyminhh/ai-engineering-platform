// Contract 98: ledger.mjs --rulings và workspaceDirs (request 2026-11-11-reasoning-review, AC2.1–AC2.6).
export default async function run({ ok, ctx }) {
  const { fs, path, os, pathToFileURL, REPO_ROOT } = ctx;
  const S = path.join(REPO_ROOT, 'core', 'skills', 'plan-execution', 'scripts');
  const L = await import(pathToFileURL(path.join(S, 'ledger.mjs')).href);
  const W = await import(pathToFileURL(path.join(S, 'workspace.mjs')).href);

  // AC2.2, AC2.3: cờ theo từng dòng
  {
    const f = (line) => L.rulingFlags(line);
    const has = (line, flag) => f(line).flags.includes(flag);
    ok(has('Ruling: a — b', 'thiếu phần'), 'AC2.2: hai phần → cờ thiếu phần');
    ok(f('Ruling: a — b — c').flags.length === 0, 'AC2.2: ba phần → không cờ');
    const rr = f('Ruling: a — b — c — chạy lại: `x — y`');
    ok(rr.flags.length === 0 && rr.rerun === 'x — y', 'AC2.2: lệnh chạy lại chứa " — " không làm đếm sai phần, rerun = lệnh');
    ok(f('Ruling: ngoài AC, đổi hành vi — major lỗi — task 2 — đổi API').flags.length === 0, 'AC2.2: Ruling bốn phần không bị cờ');
    for (const line of ['Ruling: giữ timeout — đo 40ms dưới ngưỡng — chậm khi tải cao', 'Ruling: hoãn — test xanh sau sửa — lọt lỗi',
      'Ruling: hoãn — lệnh trả exit 0 — lọt lỗi', 'Ruling: giữ — đã đo trên máy dev — sai số', 'Ruling: giữ — tải 120 req/s ổn — quá tải']) {
      ok(has(line, 'số đo không có lệnh chạy lại'), `AC2.3: số đo không lệnh → cờ: ${line}`);
    }
    const ok3 = f('Ruling: giữ timeout — đo 40ms dưới ngưỡng — chậm khi tải cao — chạy lại: `npm test`');
    ok(ok3.flags.length === 0 && ok3.rerun === 'npm test', 'AC2.3: có chạy lại → không cờ số đo, rerun = npm test');
    for (const line of ['Ruling: cách chạy subagent — người dùng chọn — mất review', 'Ruling: giữ — đoạn văn bypass lần đầu — thấp']) {
      ok(f(line).flags.length === 0, `AC2.3: không số đo → không cờ: ${line}`);
    }
  }

  const gitFake = (root) => (args) => {
    if (args.includes('--show-toplevel')) return root;
    if (args.includes('--git-common-dir')) return path.join(root, '.git');
    throw new Error(`git lạ: ${args.join(' ')}`);
  };
  const capture = (fn) => {
    const out = []; const err = [];
    const [lo, le] = [console.log, console.error];
    console.log = (...a) => out.push(a.join(' ')); console.error = (...a) => err.push(a.join(' '));
    try { return { code: fn(), out: out.join('\n'), err: err.join('\n') }; } finally { console.log = lo; console.error = le; }
  };

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-rulings-'));
  try {
    const reqDir = path.join(root, 'docs', 'requests', '2026-11-11-x');
    fs.mkdirSync(reqDir, { recursive: true });
    const plan = path.join(reqDir, 'plan.md');
    fs.writeFileSync(plan, '# Plan\n');
    const deps = { cwd: root, git: gitFake(root) };

    // AC2.6: workspaceDirs tính cùng request/part/plan như resolveWorkspace mà không tạo thư mục
    const d = W.workspaceDirs(reqDir, deps);
    ok(d.request === '2026-11-11-x' && d.part === 'root' && d.plan === plan && !fs.existsSync(path.join(root, '.aip')),
      'AC2.6: workspaceDirs trả request/part/plan, không tạo .aip');

    // AC2.4: chưa có .aip → "(không có Ruling)", exit 0, không tạo .aip
    const none = capture(() => L.main([plan, '--rulings'], deps));
    ok(none.code === 0 && none.out.includes('(không có Ruling)') && !fs.existsSync(path.join(root, '.aip')),
      'AC2.4: chưa có .aip → in (không có Ruling), exit 0, không tạo .aip');
    const bare = capture(() => L.main(['--rulings'], deps));
    ok(bare.code === 2 && !fs.existsSync(path.join(root, '.aip')), 'AC2.4: ledger.mjs --rulings không có plan → exit 2, không ghi');

    // AC2.5: ghi Ruling hai/ba/bốn phần vẫn exit 0
    const lines = ['Ruling: nhóm A chạy tuần tự — chung file', 'Ruling: giữ timeout — đo 40ms — chậm khi tải cao',
      'Ruling: hoãn major: x — đã có test — lọt lỗi — chạy lại: `npm test`'];
    for (const l of lines) ok(capture(() => L.main([plan, l], deps)).code === 0, `AC2.5: ghi dòng Ruling vẫn exit 0: ${l}`);

    // AC2.1: root + part, kèm nguồn; ledger không đổi sau --rulings
    const partFile = path.join(root, '.aip', 'runs', '2026-11-11-x', '02-api', 'progress.md');
    fs.mkdirSync(path.dirname(partFile), { recursive: true });
    fs.writeFileSync(partFile, '# Ledger part\nTask 1: complete (commits a..b, review clean)\nRuling: chọn A — vì B — nếu sai C\n');
    const rootFile = path.join(root, '.aip', 'runs', '2026-11-11-x', 'root', 'progress.md');
    const before = fs.readFileSync(rootFile, 'utf8');
    const all = capture(() => L.main([plan, '--rulings'], deps));
    ok(all.code === 0, 'AC2.1: --rulings exit 0 kể cả khi có cờ');
    ok(lines.every((l) => all.out.includes(`[root] ${l}`)) && all.out.includes('[02-api] Ruling: chọn A — vì B — nếu sai C'),
      'AC2.1: in mọi Ruling của root và part kèm nguồn');
    ok(all.out.indexOf('[root]') < all.out.indexOf('[02-api]'), 'AC2.1: root đứng trước part');
    ok(/thiếu phần/.test(all.out) && /số đo không có lệnh chạy lại/.test(all.out) && /chạy lại: npm test/.test(all.out),
      'AC2.2, AC2.3: output kèm cờ và lệnh chạy lại');
    ok(fs.readFileSync(rootFile, 'utf8') === before && !before.includes('--rulings'), 'AC2.4: --rulings không ghi dòng nào vào ledger');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
