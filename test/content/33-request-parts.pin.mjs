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
        '### Task 5: ui sai', '**Kind:** FE-UI', '**TDD:** có', '**Phủ AC:** AC1.1', '',
        '### Task 6: be sai', '**Kind:** BE', '**TDD:** sau', '**Phủ AC:** AC1.1', '',
        '### Task 7: be rỗng', '**Kind:** BE', '**TDD:**', '**Phủ AC:** AC1.1', '',
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

      for (const n of [3, 4]) {
        const b = brief(n);
        ok(b === tb.extractTask(plan, n) && count(b) === 1, `AC5.2: task ${n} có TDD hợp lệ ghi sẵn → giữ nguyên văn, không chèn thêm`);
      }

      // Dòng TDD sai: bỏ dòng sai, thay bằng đúng một dòng mặc định ngay sau heading, phần còn lại giữ nguyên
      for (const [n, line, value] of [[5, '**TDD:** có', 'không'], [6, '**TDD:** sau', 'có'], [7, '**TDD:**', 'có']]) {
        const b = brief(n);
        const orig = tb.extractTask(plan, n);
        const eff = tb.effectiveTdd(orig);
        ok(count(b) === 1 && b.split('\n')[1] === `**TDD:** ${eff.value} (mặc định theo kind)` && eff.value === value && eff.defaulted,
          `AC5.2: task ${n} dòng TDD sai (${JSON.stringify(line)}) → đúng một dòng TDD hiệu lực "${value} (mặc định theo kind)" sau heading`);
        ok(b.split('\n').filter((l) => !l.startsWith('**TDD:**')).join('\n') === orig.split('\n').filter((l) => !l.startsWith('**TDD:**')).join('\n'),
          `AC5.2: task ${n} dòng TDD sai → các dòng khác giữ nguyên văn`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }

    // Bộ vector dùng chung: parseTddLine (check-request) và effectiveTdd (task-brief) phải cùng kết luận
    const vectors = ['có', 'không — script dùng một lần', 'không', 'không —', 'không —   ', 'sau', '', 'Có', 'không - x',
      'không—x', 'không —\tx', 'có — x', 'Không — x'];
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

  // AC5.3: ledger từ chối bằng chứng đỏ giả ("red: … exit 0") ở mọi dòng Task <n>: complete; dòng không có red: giữ hành vi cũ
  {
    const { validateLine } = await import(pathToFileURL(path.join(REPO_ROOT, 'core', 'skills', 'plan-execution', 'scripts', 'ledger.mjs')).href);
    const cases = [
      ['Task 1: complete (abc123, inline, red: npm t exit 1, tests: npm t exit 0)', true, 'inline red exit 1 + tests exit 0 hợp lệ'],
      ['Task 1: complete (abc123, inline, red: npm t exit 0, tests: npm t exit 0)', false, 'inline red exit 0 bị từ chối'],
      ['Task 1: complete (abc123, inline, tests: npm t exit 0)', true, 'inline không red: giữ hợp lệ'],
      ['Task 1: complete (abc123, inline, red: npm t exit 1, tests: npm t exit 1)', false, 'inline tests exit khác 0 vẫn bị từ chối dù có red'],
      ['Task 1: complete (abc123, inline, red: npm t exit 1)', false, 'inline thiếu tests: vẫn bị từ chối dù có red'],
      ['Task 2: complete (abc123, review round 1, red: npm t exit 0, tests: npm t exit 0)', false, 'dòng không inline: red exit 0 cũng bị từ chối'],
      ['Task 2: complete (abc123, review round 1, red: npm t exit 1, tests: npm t exit 0)', true, 'dòng không inline: red exit 1 hợp lệ'],
      ['Task 2: complete (abc123, review round 1)', true, 'dòng không inline, không red: giữ hợp lệ'],
      ['Task 3: started', true, 'dòng không phải complete không bị kiểm red'],
    ];
    for (const [line, valid, name] of cases) ok((validateLine(line) === null) === valid, `AC5.3: ${name}`);
    ok(typeof validateLine('x\nTask 1: complete (inline, red: t exit 0, tests: t exit 0)') === 'string', 'AC5.3: red exit 0 ở dòng sau của đối số nhiều dòng vẫn bị bắt');
    const long = `Task 1: complete (inline, red: ${'tests: '.repeat(2000)} exit 0`;
    const t0 = Date.now();
    ok(typeof validateLine(long) === 'string' && Date.now() - t0 < 500, 'AC5.3: dòng dài bị chặn bằng MAX_LINE, không lùi regex');
  }
}
