// Pin: docs/requests/2026-10-29-superpowers-gap-closure — nội dung đặc thù của các skill bổ sung (bootstrap, worktree, inline, TDD, debug).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8');

  // AC1.3: using-aip có SUBAGENT-STOP, thứ tự ưu tiên và bảng dấu hiệu tự biện minh
  {
    const t = read('core', 'skills', 'using-aip', 'SKILL.md');
    ok(t.includes('SUBAGENT-STOP'), 'AC1.3: using-aip có dòng SUBAGENT-STOP cho agent worker');
    ok(/## Thứ tự ưu tiên[\s\S]*?của người dùng\s*>\s*quy tắc project[^>]*>\s*skill\s*>/.test(t), 'AC1.3: using-aip nêu đúng thứ tự ưu tiên người dùng > project > skill');
    ok(/## Dấu hiệu đang tự biện minh/.test(t) && (t.match(/^\| "/gm) || []).length >= 5, 'AC1.3: using-aip có bảng ≥ 5 dấu hiệu tự biện minh');
  }

  // AC5.1: plan-execution liên kết inline.md, nêu điều kiện bật và không thêm bước hỏi cách thực thi
  {
    const skill = read('core', 'skills', 'plan-execution', 'SKILL.md');
    const inline = read('core', 'skills', 'plan-execution', 'references', 'inline.md');
    const loop = read('core', 'skills', 'plan-execution', 'references', 'task-loop.md');
    ok(skill.includes('references/inline.md') && loop.includes('inline.md'), 'AC5.1: SKILL.md và task-loop.md trỏ tới references/inline.md');
    ok(/người dùng nói rõ/i.test(inline) && /không có tool subagent/i.test(inline), 'AC5.1: inline.md nêu hai điều kiện bật (người dùng nói rõ, không có tool subagent)');
    ok(/Không hỏi người dùng chọn cách thực thi/.test(inline) && !/hỏi (người dùng )?(chọn|có muốn) (cách )?(thực thi|chạy) inline/i.test(skill + loop),
      'AC5.1: không có bước hỏi người dùng chọn inline hay subagent');
  }

  // AC5.2: ledger.mjs từ chối dòng "Task n: complete … inline" thiếu "tests: <lệnh> exit 0", không ghi gì; dòng khác giữ nguyên
  {
    const { pathToFileURL, os } = ctx;
    const lg = await import(pathToFileURL(path.join(REPO_ROOT, 'core', 'skills', 'plan-execution', 'scripts', 'ledger.mjs')).href);
    const reject = [
      'Task 2: complete (commits a..b, inline)',
      'Task 2: complete (commits a..b, inline, tests: npm test exit 1)',
      'Task 2: complete (commits a..b, inline, tests: exit 0)',
      'Task 2: complete (commits a..b, inline, tests: npm test exit 10)',
    ];
    const accept = [
      'Task 2: complete (commits a..b, inline, tests: npm test exit 0)',
      'Task 2: complete (commits a..b, review clean)',
      'Task 2: complete (commits a..b, 1 ruled)',
      'Ruling: giữ nguyên — vì inline chưa cần — chi phí thấp',
      'minor (deferred): đặt tên — task 2',
      'Plan: complete',
      '# Ledger — plan: docs/requests/x/plan.md',
    ];
    ok(typeof lg.validateLine === 'function' && reject.every((l) => typeof lg.validateLine(l) === 'string' && lg.validateLine(l)),
      'AC5.2: validateLine từ chối dòng inline thiếu hoặc sai evidence (exit khác 0, thiếu lệnh)');
    ok(typeof lg.validateLine === 'function' && accept.every((l) => lg.validateLine(l) === null),
      'AC5.2: validateLine chấp nhận dòng inline đủ evidence và mọi dòng ledger không phải complete inline');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-ledger-inline-'));
    try {
      const file = path.join(tmp, '.sdd', 'progress.md');
      const realError = console.error;
      let rc;
      console.error = () => {};
      try { rc = lg.main([tmp, reject[0]]); } finally { console.error = realError; }
      ok(rc === 2 && !fs.existsSync(file), 'AC5.2: main trả exit 2 và không tạo hay ghi ledger khi dòng bị từ chối');
      const logged = console.log;
      console.log = () => {};
      try { rc = lg.main([tmp, accept[0]]); } finally { console.log = logged; }
      ok(rc === 0 && fs.readFileSync(file, 'utf8').includes(accept[0]), 'AC5.2: main ghi dòng inline đủ evidence như cũ');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }

  // AC4.1: git-worktree theo quy ước baseline, dọn chỉ bằng git worktree remove khi đã merge và sạch, cấm rm -rf
  {
    const t = read('core', 'skills', 'git-worktree', 'SKILL.md');
    const baseline = read('core', 'agents', 'AGENTS.template.md');
    ok(baseline.includes('worktree-<slug>-t<n>') && baseline.includes('.claude/worktrees/<slug>-t<n>/'),
      'AC4.1: baseline vẫn có quy ước tên nhánh và thư mục worktree mà skill bám theo');
    ok(t.includes('worktree-<slug>-t<n>') && t.includes('.claude/worktrees/<slug>-t<n>/'), 'AC4.1: git-worktree nêu đúng tên nhánh và thư mục theo baseline');
    ok(t.includes('git worktree remove') && t.includes('git branch --merged') && t.includes('status --short'),
      'AC4.1: git-worktree chỉ dọn bằng git worktree remove khi đã merge và cây sạch');
    ok(/Không `rm -rf`/.test(t) && !/^\s*rm -rf/m.test(t), 'AC4.1: git-worktree cấm rm -rf và không có lệnh rm -rf nào');
  }
}
