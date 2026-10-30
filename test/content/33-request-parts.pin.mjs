// Pin: request parts, workspace .aip và trường TDD (docs/requests/2026-10-30-request-parts-aip-workspace). Task 2: task-brief chèn dòng TDD hiệu lực (AC5.2).
import { spawnSync } from 'node:child_process';

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
    // F1/F2: không phân biệt hoa thường, không cần dấu cách sau "red:", kiểm mọi khối red:
    for (const [line, name] of [
      ['task 1: complete (a, inline, red: x exit 0, tests: y exit 0)', 'chữ thường "task" + red exit 0 bị từ chối'],
      ['TASK 2: COMPLETE (a, review, RED: x exit 0, tests: y exit 0)', 'chữ hoa "RED:" + red exit 0 bị từ chối'],
      ['Task 1: complete (a, inline, Red: x exit 0, tests: y exit 0)', '"Red:" + red exit 0 bị từ chối'],
      ['Task 1: complete (a, inline, red:x exit 0, tests: y exit 0)', '"red:" không dấu cách + exit 0 bị từ chối'],
      ['Task 1: complete (a, red: x exit 1, red: z exit 0, tests: y exit 0)', 'khối red: thứ hai exit 0 bị từ chối'],
    ]) ok(typeof validateLine(line) === 'string', `AC5.3: ${name}`);
    ok(validateLine('Task 1: complete (a, inline, red:x exit 1, Red: z exit 2, tests: y exit 0)') === null, 'AC5.3: nhiều khối red: đều exit khác 0 + tests exit 0 hợp lệ');
    for (const [line, valid, name] of cases) ok((validateLine(line) === null) === valid, `AC5.3: ${name}`);
    ok(typeof validateLine('x\nTask 1: complete (inline, red: t exit 0, tests: t exit 0)') === 'string', 'AC5.3: red exit 0 ở dòng sau của đối số nhiều dòng vẫn bị bắt');
    const long = `Task 1: complete (inline, red: ${'tests: '.repeat(2000)} exit 0`;
    const t0 = Date.now();
    ok(typeof validateLine(long) === 'string' && Date.now() - t0 < 500, 'AC5.3: dòng dài bị chặn bằng MAX_LINE, không lùi regex');
  }

  // AC3.2, AC3.5: resolveWorkspace tính <gốc repo chính>/.aip/runs/<request>/<part>/; đường lui chỉ với lỗi quyền
  {
    const { resolveWorkspace } = await import(pathToFileURL(path.join(REPO_ROOT, 'core', 'skills', 'plan-execution', 'scripts', 'workspace.mjs')).href);
    const fwd = (p) => p.replace(/\\/g, '/');
    const gitFake = (top, common) => (args) => {
      if (args.includes('--show-toplevel')) return top;
      if (args.includes('--git-common-dir')) return common;
      throw new Error(`git lạ: ${args.join(' ')}`);
    };

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-ws-'));
    try {
      const reqDir = path.join(root, 'docs', 'requests', '2026-10-30-x');
      fs.mkdirSync(path.join(reqDir, 'parts', '01-a'), { recursive: true });
      const lines = [];
      const deps = { cwd: root, git: gitFake(root, path.join(root, '.git')), stderr: (s) => lines.push(s) };
      const runs = fwd(path.join(root, '.aip', 'runs'));

      const a = resolveWorkspace(reqDir, deps);
      const b = resolveWorkspace(path.join(reqDir, 'plan.md'), deps);
      ok(JSON.stringify(a) === JSON.stringify(b), 'AC3.2: đối số thư mục request cho kết quả giống truyền <dir>/plan.md');
      ok(a.plan === path.join(reqDir, 'plan.md') && a.request === '2026-10-30-x' && a.part === 'root' && a.fallback === false
        && fwd(a.dir) === `${runs}/2026-10-30-x/root`, 'AC3.2: plan gốc → part root, dir dưới <gốc>/.aip/runs/<request>/root');
      ok(fs.statSync(a.dir).isDirectory() && fs.readFileSync(path.join(root, '.aip', '.gitignore'), 'utf8') === '*\n',
        'AC3.2: tạo dir và .aip/.gitignore = "*\\n"');

      const p = resolveWorkspace(path.join(reqDir, 'parts', '01-a', 'plan.md'), deps);
      ok(p.part === '01-a' && p.request === '2026-10-30-x' && fwd(p.dir) === `${runs}/2026-10-30-x/01-a`, 'AC3.2: parts/01-a/plan.md → part 01-a');

      fs.mkdirSync(path.join(root, 'misc', 'notes'), { recursive: true });
      const o = resolveWorkspace(path.join(root, 'misc', 'notes', 'plan.md'), deps);
      ok(o.request === 'notes' && o.part === 'root' && fwd(o.dir) === `${runs}/notes/root`, 'AC3.2: plan ngoài docs/requests → request = thư mục cha, part root');
      ok(lines.length === 0, 'AC3.2: không cảnh báo khi ghi được');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }

    // fs/git giả: không chạm đĩa, dùng đường dẫn Windows như git trả về
    const top = 'e:/repo/.claude/worktrees/x-p01';
    const git = gitFake(top, 'E:\\repo\\.git');
    const plan = 'docs/requests/r1/plan.md';
    const made = [];
    const notFound = () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); };
    const fakeFs = { mkdirSync: (p) => { made.push(fwd(p)); }, writeFileSync: (p) => { made.push(fwd(p)); }, existsSync: () => false, statSync: notFound };
    const denying = (code, deny) => (p) => {
      if (fwd(p).startsWith(deny)) throw Object.assign(new Error(code), { code });
      made.push(fwd(p));
    };

    {
      const w = resolveWorkspace(plan, { cwd: top, git, fs: fakeFs, stderr: () => {} });
      ok(fwd(w.root) === 'E:/repo' && fwd(w.dir) === 'E:/repo/.aip/runs/r1/root' && w.fallback === false
        && made.every((p) => p.startsWith('E:/repo/.aip')) && made.includes('E:/repo/.aip/.gitignore'),
        'workspace: gốc repo chính từ worktree, đường dẫn Windows');
    }

    for (const code of ['EACCES', 'EPERM', 'EROFS']) {
      made.length = 0;
      const lines = [];
      const w = resolveWorkspace(plan, { cwd: top, git, fs: { ...fakeFs, mkdirSync: denying(code, 'E:/repo/.aip') }, stderr: (s) => lines.push(s) });
      ok(w.fallback === true && fwd(w.root) === top && fwd(w.dir) === `${top}/.aip/runs/r1/root` && made.includes(`${top}/.aip/.gitignore`),
        `AC3.5: ${code} khi ghi gốc repo chính → ghi vào gốc worktree, fallback true`);
      ok(lines.join('').trimEnd().split('\n').length === 1 && lines.join('').includes(w.dir), `AC3.5: ${code} → đúng một dòng stderr nêu đường dẫn đã dùng`);
    }

    const rethrow = (deps) => {
      const lines = [];
      let err;
      try { resolveWorkspace(plan, { stderr: (s) => lines.push(s), ...deps }); } catch (e) { err = e; }
      return { err, lines };
    };
    const full = rethrow({ cwd: top, git, fs: { ...fakeFs, mkdirSync: denying('ENOSPC', 'E:/repo/.aip') } });
    ok(full.err?.code === 'ENOSPC' && full.lines.length === 0, 'AC3.5: lỗi ngoài EACCES/EPERM/EROFS (ENOSPC) → hàm ném, không cảnh báo');
    // Chạy ở chính gốc repo chính (ổ đĩa khác hoa thường): không có chỗ lui, thử lại cùng thư mục là vô nghĩa
    const same = rethrow({ cwd: 'e:/repo', git: gitFake('e:/repo', 'E:\\repo\\.git'), fs: { ...fakeFs, mkdirSync: denying('EPERM', 'E:/repo/.aip') } });
    ok(same.err?.code === 'EPERM' && same.lines.length === 0, 'AC3.5: lỗi quyền ngay ở gốc repo chính (không phải worktree) → ném, không lui');
  }

  // AC3.1, AC3.3, AC3.4: ba script ghi vào workspace .aip (repo git tạm + git worktree thật, không chạm thư mục request thật)
  {
    const scripts = path.join(REPO_ROOT, 'core', 'skills', 'plan-execution', 'scripts');
    const real = (p) => fs.realpathSync.native(p);
    const rd = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
    const git = (cwd, ...a) => {
      const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd, encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`);
      return r.stdout.trim();
    };
    const sh = (script, args, cwd) => spawnSync(process.execPath, [path.join(scripts, script), ...args], { cwd, encoding: 'utf8' });

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-ws3-'));
    try {
      const repo = path.join(tmp, 'repo');
      const wt = path.join(tmp, 'wt');
      const req = 'docs/requests/2026-10-30-x';
      fs.mkdirSync(path.join(repo, req, 'parts', '01-a'), { recursive: true });
      const planText = '# Plan\n\n### Task 1: a\n**Kind:** BE\n**Phủ AC:** AC1.1\n';
      fs.writeFileSync(path.join(repo, req, 'plan.md'), planText);
      fs.writeFileSync(path.join(repo, req, 'parts', '01-a', 'plan.md'), planText);
      git(repo, 'init', '-q');
      git(repo, 'add', '.');
      git(repo, 'commit', '-q', '-m', 'c1');
      const c1 = git(repo, 'rev-parse', 'HEAD');
      fs.writeFileSync(path.join(repo, 'f.txt'), 'x\n');
      git(repo, 'add', '.');
      git(repo, 'commit', '-q', '-m', 'c2');
      const c2 = git(repo, 'rev-parse', 'HEAD');
      git(repo, 'worktree', 'add', '-q', wt, '-b', 'wt');

      for (const [where, cwd] of [['gốc repo chính', repo], ['worktree', wt]]) {
        for (const [part, planRel] of [['root', `${req}/plan.md`], ['01-a', `${req}/parts/01-a/plan.md`]]) {
          const dir = path.join(repo, '.aip', 'runs', '2026-10-30-x', part);
          const at = (r, name) => r.status === 0 && fs.existsSync(path.join(dir, name))
            && real(r.stdout.trim()) === real(path.join(dir, name));
          const tag = `AC3.1: ${where}, part ${part}`;

          const l = sh('ledger.mjs', [planRel, `Task 1: started ${where}`], cwd);
          ok(at(l, 'progress.md') && rd(path.join(dir, 'progress.md'))?.includes(`started ${where}`), `${tag}: ledger.mjs ghi progress.md vào workspace và in đường dẫn`);
          const b = sh('task-brief.mjs', [planRel, '1'], cwd);
          ok(at(b, 'task-1-brief.md'), `${tag}: task-brief.mjs ghi brief vào workspace`);
          const r = sh('review-package.mjs', [c1, c2, '--plan', planRel], cwd);
          const rp = r.status === 0 ? r.stdout.trim() : '';
          ok(rp !== '' && fs.existsSync(rp) && real(path.dirname(rp)) === real(dir) && rd(rp)?.startsWith('# Review package'),
            `AC3.4: ${where}, part ${part}: review-package.mjs --plan không --out ghi package vào workspace và in đường dẫn`);
        }
      }
      ok(rd(path.join(repo, '.aip', '.gitignore')) === '*\n', 'AC3.1: <gốc repo chính>/.aip/.gitignore = "*"');
      ok(!fs.existsSync(path.join(wt, '.aip')) && !fs.existsSync(path.join(repo, req, '.sdd')) && !fs.existsSync(path.join(wt, req, '.sdd')),
        'AC3.1: không ghi .aip vào gốc worktree, không còn tạo .sdd trong thư mục request');

      // AC3.4: không --plan → stdout như cũ; --out luôn thắng --plan; --plan thiếu giá trị là sai đối số
      const out = sh('review-package.mjs', [c1, c2], repo);
      ok(out.status === 0 && out.stdout.startsWith('# Review package'), 'AC3.4: không --plan, không --out → package ra stdout như cũ');
      const explicit = path.join(tmp, 'explicit.md');
      const both = sh('review-package.mjs', [c1, c2, '--plan', `${req}/plan.md`, '--out', explicit], repo);
      ok(both.status === 0 && both.stdout.trim() === explicit && fs.existsSync(explicit), 'AC3.4: có cả --plan và --out → ghi theo --out');
      ok(sh('review-package.mjs', [c1, c2, '--plan'], repo).status === 2, 'AC3.4: --plan thiếu giá trị → exit 2');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }

    // AC3.3: .sdd cũ chỉ được chép sang ledger mới khi ledger mới chưa có; luôn giữ nguyên file cũ
    const ledger = await import(pathToFileURL(path.join(scripts, 'ledger.mjs')).href);
    const noGit = () => { throw new Error('không phải repo'); };
    const lg = (cwd, planArg, line) => {
      const o = console.log;
      const e = console.error;
      console.log = () => {};
      console.error = () => {};
      try { return ledger.main([planArg, line], { cwd, git: noGit }); } finally { console.log = o; console.error = e; }
    };
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-ledger-mig-'));
    try {
      const seed = (reqName, legacy, current) => {
        const reqDir = path.join(cwd, 'docs', 'requests', reqName);
        fs.mkdirSync(path.join(reqDir, '.sdd'), { recursive: true });
        fs.writeFileSync(path.join(reqDir, '.sdd', 'progress.md'), legacy);
        const file = path.join(cwd, '.aip', 'runs', reqName, 'root', 'progress.md');
        if (current !== null) {
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, current);
        }
        return { reqDir, file, legacyFile: path.join(reqDir, '.sdd', 'progress.md') };
      };

      const a = seed('2026-10-30-a', 'Task 1: complete (cũ)\n', null);
      ok(lg(cwd, path.join(a.reqDir, 'plan.md'), 'Task 2: started') === 0
        && rd(a.file) === 'Task 1: complete (cũ)\nTask 2: started\n'
        && fs.readFileSync(a.legacyFile, 'utf8') === 'Task 1: complete (cũ)\n',
        'AC3.3: có .sdd/progress.md cũ, chưa có ledger mới → chép nội dung sang ledger mới rồi ghi tiếp, file cũ còn nguyên');

      const b = seed('2026-10-30-b', 'CŨ\n', 'MỚI\n');
      ok(lg(cwd, b.reqDir, 'Task 2: started') === 0 && rd(b.file) === 'MỚI\nTask 2: started\n'
        && fs.readFileSync(b.legacyFile, 'utf8') === 'CŨ\n',
        'ledger: không chép khi ledger mới đã tồn tại');

      // Ledger part không được nhận .sdd của request (ledger cũ là của cả request, thuộc part root)
      const c = seed('2026-10-30-c', 'CŨ\n', null);
      fs.mkdirSync(path.join(c.reqDir, 'parts', '01-a'), { recursive: true });
      lg(cwd, path.join(c.reqDir, 'parts', '01-a', 'plan.md'), 'Task 1: started');
      ok(rd(path.join(cwd, '.aip', 'runs', '2026-10-30-c', '01-a', 'progress.md')) === 'Task 1: started\n',
        'AC3.3: ledger của part không chép .sdd của request');
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  }
}
