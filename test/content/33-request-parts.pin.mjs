// Pin: request parts, workspace .aip và trường TDD (docs/requests/2026-10-30-request-parts-aip-workspace). Task 2: task-brief chèn dòng TDD hiệu lực (AC5.2).
export default async function run({ ok, ctx }) {
  const { fs, path, os, REPO_ROOT, pathToFileURL } = ctx;

  // AC5.2: brief chèn dòng TDD mặc định theo kind khi plan không ghi; plan đã ghi thì giữ nguyên văn
  {
    const tb = await import(pathToFileURL(path.join(REPO_ROOT, 'core', 'skills', 'plan-execution', 'scripts', 'task-brief.mjs')).href);
    const cr = await import(pathToFileURL(path.join(REPO_ROOT, 'core', 'skills', 'artifact-templates', 'scripts', 'check-request.mjs')).href);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-tdd-'));
    try {
      const plan = [
        '# Plan', '**Goal:** x', '',
        '### Task 1: be', '**Kind:** BE', '**Phủ AC:** AC1.1', '', '- [ ] **Step 1:** a', '',
        '### Task 2: ui', '**Kind:** FE-UI', '**Phủ AC:** AC1.1', '',
        '### Task 3: ngoại lệ', '**Kind:** BE', '**TDD:** không — script dùng một lần', '**Phủ AC:** AC1.1', '',
        '### Task 4: tooling có', '**Kind:** TOOLING', '**TDD:** có', '**Phủ AC:** AC1.1', '',
      ].join('\n');
      const planFile = path.join(dir, 'plan.md');
      fs.writeFileSync(planFile, plan);
      const brief = (n) => {
        const log = console.log;
        console.log = () => {};
        try { tb.main([planFile, String(n), '--out', dir]); } finally { console.log = log; }
        return fs.readFileSync(path.join(dir, `task-${n}-brief.md`), 'utf8');
      };
      const count = (s) => (s.match(/^\*\*TDD:\*\*/gm) || []).length;

      const b1 = brief(1);
      const l1 = b1.split('\n');
      ok(l1[1] === '**TDD:** có (mặc định theo kind)' && count(b1) === 1, 'AC5.2: task BE không ghi TDD → đúng một dòng "có (mặc định theo kind)" ngay sau heading');
      ok([l1[0], ...l1.slice(2)].join('\n') === tb.extractTask(plan, 1), 'AC5.2: phần còn lại của task BE giữ nguyên văn');

      const b2 = brief(2);
      ok(b2.split('\n')[1] === '**TDD:** không (mặc định theo kind)' && count(b2) === 1, 'AC5.2: task FE-UI không ghi TDD → "không (mặc định theo kind)"');

      const b3 = brief(3);
      ok(b3 === tb.extractTask(plan, 3) && count(b3) === 1, 'AC5.2: task có TDD ghi sẵn → giữ nguyên văn, không chèn thêm');
      const b4 = brief(4);
      ok(b4 === tb.extractTask(plan, 4), 'AC5.2: task TOOLING có TDD "có" ghi sẵn → giữ nguyên văn');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }

    // Bộ vector dùng chung: parseTddLine (check-request) và effectiveTdd (task-brief) phải cùng kết luận
    const vectors = ['có', 'không — script dùng một lần', 'không', 'không —', 'không —   ', 'sau', '', 'Có', 'không - x'];
    const task = (kind, line) => `### Task 1: x\n**Kind:** ${kind}\n**TDD:** ${line}\n`;
    for (const line of vectors) {
      const p = cr.parseTddLine(line);
      const e = tb.effectiveTdd(task('BE', line));
      const valid = !p.error;
      ok(e.defaulted === !valid, `AC5.2: vector ${JSON.stringify(line)} → hợp lệ khớp parseTddLine (defaulted=${!valid})`);
      if (valid) ok(e.value === p.value && e.reason === p.reason, `AC5.2: vector ${JSON.stringify(line)} → cùng value/reason`);
      else ok(e.value === 'có', `AC5.2: vector ${JSON.stringify(line)} không hợp lệ → rơi về mặc định theo kind`);
    }
    // "có" ở kind ngoài TDD_ALLOWED_KINDS là W21 → brief cũng không công nhận
    for (const kind of cr.TASK_KINDS) {
      const e = tb.effectiveTdd(task(kind, 'có'));
      const allowed = cr.TDD_ALLOWED_KINDS.includes(kind);
      ok(e.value === (allowed ? 'có' : 'không') && e.defaulted === !allowed, `AC5.2: TDD "có" với kind ${kind} ${allowed ? 'được công nhận' : 'rơi về mặc định'}`);
    }
    ok(tb.effectiveTdd('### Task 1: x\n**Kind:** BE\n').value === 'có' && tb.effectiveTdd('### Task 1: x\n').value === 'không',
      'AC5.2: thiếu dòng TDD → BE có, thiếu Kind → không');
    ok(tb.effectiveTdd('### Task 1: x\n**Kind:** BE\n```\n**TDD:** không — y\n```\n').defaulted === true, 'AC5.2: dòng TDD trong khối code không tính');
  }
}
