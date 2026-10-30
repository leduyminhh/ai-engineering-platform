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
      'Task 2: complete (commits a..b, INLINE)',
      'Task 2: complete (commits a..b, inline, tests: a exit 1; b exit 0)',
      'Task 2: complete (commits a..b, review clean)\nTask 3: complete (commits c..d, inline)',
    ];
    const accept = [
      'Task 2: complete (commits a..b, inline, tests: npm test exit 0)',
      'Task 2: complete (commits a..b, review clean)',
      'Task 2: complete (commits a..b, 1 ruled)',
      'Ruling: giữ nguyên — vì inline chưa cần — chi phí thấp',
      'minor (deferred): đặt tên — task 2',
      'Plan: complete',
      '# Ledger — plan: docs/requests/x/plan.md',
      // Regression: ghi chú nhắc tới inline.md trong dòng của chế độ subagent không phải dòng inline.
      'Task 3: complete (commits a..b, review clean, thêm references/inline.md)',
    ];
    // Regression ReDoS: dòng dài lặp "tests: " bị từ chối theo độ dài thay vì làm regex lùi bậc hai.
    const t0 = Date.now();
    const long = lg.validateLine('Task 1: complete inline ' + 'tests: '.repeat(20000));
    ok(typeof long === 'string' && Date.now() - t0 < 200, 'AC5.2: dòng ledger quá dài bị từ chối nhanh theo độ dài (không ReDoS)');
    const verdict = (l) => (typeof lg.validateLine === 'function' ? lg.validateLine(l) : undefined);
    for (const l of reject) ok(typeof verdict(l) === 'string' && verdict(l) !== '', `AC5.2: validateLine từ chối ${JSON.stringify(l)}`);
    for (const l of accept) ok(verdict(l) === null, `AC5.2: validateLine chấp nhận ${JSON.stringify(l)}`);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-ledger-inline-'));
    try {
      // cwd/git giả: không để main() resolve ra gốc repo chính thật và ghi .aip vào đó.
      const deps = { cwd: tmp, git: () => { throw new Error('không phải repo'); } };
      const file = path.join(tmp, '.aip', 'runs', path.basename(tmp), 'root', 'progress.md');
      const realError = console.error;
      let rc;
      console.error = () => {};
      try { rc = lg.main([tmp, reject[0]], deps); } finally { console.error = realError; }
      ok(rc === 2 && !fs.existsSync(file), 'AC5.2: main trả exit 2 và không tạo hay ghi ledger khi dòng bị từ chối');
      const logged = console.log;
      console.log = () => {};
      try { rc = lg.main([tmp, accept[0]], deps); } finally { console.log = logged; }
      ok(rc === 0 && fs.readFileSync(file, 'utf8').includes(accept[0]), 'AC5.2: main ghi dòng inline đủ evidence như cũ');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }

  // AC2.1, AC2.2: engineering-tdd có luật đỏ trước, bảng biện minh, dẫn chiếu quy tắc Testing; hai skill trỏ tới nó có điều kiện
  {
    const tdd = read('plugins', 'engineering', 'skills', 'engineering-tdd', 'SKILL.md');
    const slice = (text, from, to) => text.slice(text.indexOf(from), to ? text.indexOf(to) : undefined);
    const procedure = slice(tdd, '## Quy trình — đỏ, xanh, refactor', '## Dấu hiệu đang tự biện minh');
    ok(/Chạy và thấy đỏ đúng lý do/.test(procedure) && /`tdd\.red`/.test(procedure) && /Viết code tối thiểu/.test(procedure) && procedure.indexOf('thấy đỏ') < procedure.indexOf('Viết code tối thiểu'),
      'AC2.1: mục Quy trình của engineering-tdd bắt thấy đỏ đúng lý do trước khi viết code');
    ok(/## Dấu hiệu đang tự biện minh/.test(tdd) && (tdd.match(/^\| "/gm) || []).length >= 5, 'AC2.1: engineering-tdd có bảng ≥ 5 dấu hiệu tự biện minh');
    const boundary = slice(tdd, '## Ranh giới với quy tắc Testing', '## Ranh giới an toàn');
    ok(/một hành vi một test/i.test(boundary) && boundary.includes('references/anti-patterns.md') && /AGENTS\.md/.test(boundary),
      'AC2.1: mục ranh giới dẫn chiếu quy tắc "một hành vi một test" của AGENTS.md và anti-patterns.md');
    ok(/chỉ khi task `kind: BE`/.test(slice(tdd, '## Ranh giới an toàn')), 'AC2.2: engineering-tdd chỉ báo tdd.red/tdd.green cho task kind BE');
    ok(fs.existsSync(path.join(REPO_ROOT, 'plugins', 'engineering', 'skills', 'engineering-tdd', 'references', 'anti-patterns.md')), 'AC2.1: anti-patterns.md tồn tại');
    for (const [name, p] of [['backend-implement', ['plugins', 'backend', 'skills', 'backend-implement', 'SKILL.md']], ['frontend-testing', ['plugins', 'frontend', 'skills', 'frontend-testing', 'SKILL.md']]]) {
      const t = read(...p).replace(/\r?\n(?=[^\n])/g, ' ');
      const at = t.indexOf('engineering-tdd');
      // Con trỏ phải có cả điều kiện "khi skill đã cài" lẫn nhánh dự phòng "thiếu ..." trong cùng đoạn, để plugin không gãy khi chưa cài engineering.
      ok(at >= 0 && /khi skill đã cài[^.]*thiếu/.test(t.slice(Math.max(0, at - 200), at + 300)), `AC2.2: ${name} trỏ tới engineering-tdd có điều kiện và có nhánh dự phòng khi thiếu skill`);
    }
    const be = read('plugins', 'backend', 'skills', 'backend-implement', 'SKILL.md');
    const beStep3 = be.slice(be.indexOf('### 3. Test đỏ trước'), be.indexOf('### 4.'));
    ok(beStep3.includes('engineering-tdd'), 'AC2.2: con trỏ của backend-implement nằm trong bước viết test (### 3)');
    ok(/`tdd\.red`/.test(be) && /`tdd\.green`/.test(be) && /tdd: \{ red, green \}/.test(be), 'AC2.2: backend-implement giữ nguyên định dạng tdd.red/tdd.green');
  }

  // AC3.1, AC3.2: engineering-debugging có bốn pha và liên kết đủ bốn tài liệu; bugfix và orchestrator trỏ tới nó có điều kiện
  {
    const dbg = read('plugins', 'engineering', 'skills', 'engineering-debugging', 'SKILL.md');
    const procedure = dbg.slice(dbg.indexOf('## Quy trình — bốn pha'), dbg.indexOf('## Dấu hiệu đang đoán'));
    ok(['Điều tra', 'So sánh mẫu', 'Giả thuyết và kiểm', 'Sửa'].every((phase, i) => procedure.includes(`${i + 1}. **${phase}.**`)),
      'AC3.1: mục Quy trình của engineering-debugging có đủ bốn pha theo thứ tự');
    for (const ref of ['root-cause-tracing', 'defense-in-depth', 'condition-based-waiting', 'polluter-bisect']) {
      ok(dbg.includes(`](references/${ref}.md)`) && fs.existsSync(path.join(REPO_ROOT, 'plugins', 'engineering', 'skills', 'engineering-debugging', 'references', `${ref}.md`)),
        `AC3.1: SKILL.md liên kết references/${ref}.md và file tồn tại`);
    }
    const bugfix = read('workflows', 'bugfix', 'WORKFLOW.md');
    for (const step of [4, 5]) {
      const section = bugfix.slice(bugfix.indexOf(`### Bước ${step} `), bugfix.indexOf(`### Bước ${step + 1} `));
      ok(/`engineering-debugging` \(khi skill đã cài\)/.test(section), `AC3.2: workflow-bugfix Bước ${step} trỏ tới engineering-debugging có điều kiện`);
    }
    const orchestrator = read('workflows', 'orchestrator', 'WORKFLOW.md');
    const direct = orchestrator.slice(orchestrator.indexOf('## Yêu cầu chạy trực tiếp bằng skill'), orchestrator.indexOf('## Các bước'));
    ok(/\|[^|\n]*"test flaky"[^|\n]*\|\s*`engineering-debugging`/.test(direct), 'AC3.2: orchestrator định tuyến "test flaky" tới engineering-debugging trong bảng skill trực tiếp');
    const registry = orchestrator.slice(orchestrator.indexOf('## Registry'), orchestrator.indexOf('## Yêu cầu chạy trực tiếp bằng skill'));
    ok(!registry.includes('engineering-debugging'), 'AC3.2: engineering-debugging không nằm trong Registry (không phải workflow)');
  }

  // AC4.1: git-worktree theo quy ước baseline, dọn chỉ bằng git worktree remove khi đã merge và sạch, cấm rm -rf
  {
    const t = read('core', 'skills', 'git-worktree', 'SKILL.md');
    const baseline = read('core', 'agents', 'AGENTS.template.md');
    ok(baseline.includes('worktree-<slug>-t<n>') && baseline.includes('.claude/worktrees/<slug>-t<n>/'),
      'AC4.1: baseline vẫn có quy ước tên nhánh và thư mục worktree mà skill bám theo');
    ok(t.includes('git worktree add -b worktree-<slug>-t<n> .claude/worktrees/<slug>-t<n> feature/<slug>'),
      'AC4.1: lệnh tạo worktree dùng đúng tên nhánh, thư mục và nhánh gốc theo baseline');
    // Cổng "đã merge và sạch" phải nằm trong chính mục dọn, không chỉ xuất hiện ở đâu đó trong skill.
    const cleanup = t.slice(t.indexOf('## Quy trình — dọn worktree'), t.indexOf('## Ranh giới an toàn'));
    ok(cleanup.includes('git branch --merged') && cleanup.includes('status --short') && cleanup.includes('git worktree remove .claude/worktrees/<slug>-t<n>'),
      'AC4.1: mục dọn chỉ gỡ bằng git worktree remove sau khi kiểm đã merge và cây sạch');
    ok(/Không `rm -rf`[^\n]*`Remove-Item -Recurse`[^\n]*`git worktree remove --force`[^\n]*`git branch -D`/.test(t),
      'AC4.1: git-worktree cấm rm -rf, Remove-Item -Recurse, worktree remove --force và branch -D');
    ok(!/^\s*(rm -rf|Remove-Item|git worktree remove[^\n]*--force|git branch -D)/m.test(t), 'AC4.1: không có lệnh bị cấm nào nằm trong khối lệnh của skill');
  }
}
