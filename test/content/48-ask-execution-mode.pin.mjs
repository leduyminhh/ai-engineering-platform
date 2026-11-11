// Pin: docs/requests/2026-11-11-ask-execution-mode — luôn hỏi cách thực thi plan, nhớ câu trả lời làm gợi ý (planRunner/partRunner).
export default async function run({ ok, ctx }) {
  const { fs, path, os, REPO_ROOT, pathToFileURL } = ctx;
  const { execFileSync } = await import('node:child_process');
  const skillDir = path.join(REPO_ROOT, 'core', 'skills', 'plan-execution');
  const auto = await import(pathToFileURL(path.join(skillDir, 'scripts', 'autonomy.mjs')).href);

  // AC3.1–AC3.4: setRunner ghi gợi ý, chỉ hai khoá, không đụng khoá khác, không làm bẩn file đã theo dõi
  {
    ok(typeof auto.setRunner === 'function', 'AC3.1: autonomy.mjs xuất setRunner');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-set-'));
    const main = path.join(root, 'main');
    const wt = path.join(root, 'wt');
    const gitFake = (top, common) => (args) => {
      if (args.includes('--show-toplevel')) return top;
      if (args.includes('--git-common-dir')) return common;
      throw new Error(`git lạ: ${args.join(' ')}`);
    };
    const file = (dir) => path.join(dir, '.claude', 'aip-gate.json');
    const put = (dir, text) => { fs.mkdirSync(path.dirname(file(dir)), { recursive: true }); fs.writeFileSync(file(dir), text); };
    const clear = (dir) => fs.rmSync(path.join(dir, '.claude'), { recursive: true, force: true });
    const text = (dir) => fs.readFileSync(file(dir), 'utf8');
    const inMain = { git: gitFake(main, path.join(main, '.git')), tracked: () => false };
    const inWt = { git: gitFake(wt, path.join(main, '.git')), tracked: () => false };
    const set = (k, v, cwd = main, deps = inMain) => (typeof auto.setRunner === 'function' ? auto.setRunner(k, v, cwd, deps) : { code: -1, message: '' });
    try {
      fs.mkdirSync(main, { recursive: true });
      fs.mkdirSync(wt, { recursive: true });

      put(main, JSON.stringify({ mode: 'ask', autonomy: { mergeLocal: true, partRunner: 'session' } }));
      let r = set('planRunner', 'inline');
      let g = JSON.parse(text(main));
      ok(r.code === 0 && g.autonomy.planRunner === 'inline' && g.autonomy.mergeLocal === true && g.autonomy.partRunner === 'session' && g.mode === 'ask',
        'AC3.1: --set planRunner=inline ghi autonomy.planRunner và giữ mọi khoá khác');
      const before = text(main);
      r = set('planRunner', 'inline');
      ok(r.code === 0 && text(main) === before, 'AC3.1: đặt lại cùng giá trị không đổi file');
      r = set('partRunner', 'subagent');
      ok(r.code === 0 && JSON.parse(text(main)).autonomy.partRunner === 'subagent', 'AC3.1: --set partRunner=subagent');
      ok(text(main).endsWith('\n') && !text(main).startsWith('﻿'), 'AC3.1: file ghi UTF-8 không BOM, kết thúc bằng LF');

      const kept = text(main);
      for (const [k, v] of [['mergeLocal', 'true'], ['cleanup', 'true'], ['mode', 'full'], ['planRunner', 'parallel'], ['partRunner', 'inline'], ['planRunner', 'session'], ['', 'x']]) {
        r = set(k, v);
        ok(r.code === 2 && text(main) === kept, `AC3.2: --set ${k}=${v} bị từ chối (exit 2), không ghi`);
      }

      put(main, '{ hỏng');
      r = set('planRunner', 'inline');
      ok(r.code === 1 && text(main) === '{ hỏng', 'AC3.3: file hỏng → exit 1, không ghi');

      for (const [label, tracked] of [['đã theo dõi', () => true], ['không xác định', () => null]]) {
        put(main, JSON.stringify({ autonomy: { partRunner: 'session' } }));
        const b = text(main);
        r = set('planRunner', 'inline', main, { ...inMain, tracked });
        ok(r.code === 0 && text(main) === b && /theo dõi|xác định/.test(r.message), `AC3.3: file ${label} → exit 0, không ghi, nêu lý do`);
      }

      // AC3.4: worktree không có file mà repo chính có → ghi file repo chính; cả hai không có → tạo ở gốc repo chính
      put(main, JSON.stringify({ autonomy: { cleanup: true } }));
      clear(wt);
      r = set('planRunner', 'inline', wt, inWt);
      ok(r.code === 0 && JSON.parse(text(main)).autonomy.planRunner === 'inline' && !fs.existsSync(file(wt)), 'AC3.4: worktree không có file → ghi vào file repo chính');
      put(wt, JSON.stringify({ mode: 'ask' }));
      r = set('partRunner', 'sequential', wt, inWt);
      ok(r.code === 0 && JSON.parse(text(wt)).autonomy.partRunner === 'sequential' && JSON.parse(text(main)).autonomy.partRunner === undefined, 'AC3.4: worktree có file riêng → ghi file đó');
      clear(main);
      clear(wt);
      r = set('planRunner', 'subagent', wt, inWt);
      ok(r.code === 0 && text(main) === JSON.stringify({ autonomy: { planRunner: 'subagent' } }, null, 2) + '\n' && !fs.existsSync(file(wt)),
        'AC3.4: chưa có file nào → tạo ở gốc repo chính, chỉ gồm khoá vừa đặt');

      // git thật: file đã git add thì không ghi
      const repo = path.join(root, 'repo');
      fs.mkdirSync(repo, { recursive: true });
      execFileSync('git', ['init', '-q'], { cwd: repo });
      put(repo, JSON.stringify({ autonomy: {} }));
      execFileSync('git', ['add', '.claude/aip-gate.json'], { cwd: repo });
      const b = text(repo);
      r = auto.setRunner('planRunner', 'inline', repo);
      ok(r.code === 0 && text(repo) === b, 'AC3.3: git thật, file đã theo dõi → không ghi');

      // CLI: --set chạy từ gốc project đích; từ trong thư mục skill bị từ chối như lệnh đọc
      const { spawnSync } = await import('node:child_process');
      const script = path.join(skillDir, 'scripts', 'autonomy.mjs');
      const clean = path.join(root, 'cli');
      fs.mkdirSync(clean, { recursive: true });
      execFileSync('git', ['init', '-q'], { cwd: clean });
      const cli = (cwd, ...args) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
      let c = cli(clean, '--set', 'planRunner=inline');
      ok(c.status === 0 && JSON.parse(fs.readFileSync(file(clean), 'utf8')).autonomy.planRunner === 'inline', 'AC3.1: CLI --set planRunner=inline exit 0 và ghi file');
      c = cli(clean, '--set', 'planRunner');
      ok(c.status === 2, 'AC3.2: CLI --set thiếu "=" → exit 2');
      c = cli(skillDir, '--set', 'planRunner=inline');
      ok(c.status === 2, 'AC3.1: CLI --set chạy từ trong thư mục skill → exit 2');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  // AC1.4: ledger.mjs nhận dòng Ruling của thẻ cách thực thi
  {
    const lg = await import(pathToFileURL(path.join(skillDir, 'scripts', 'ledger.mjs')).href);
    for (const l of ['Ruling: cách chạy inline — người dùng chọn — chi phí nếu sai: mất review từng task', 'Ruling: cách chạy subagent — không có tool subagent — chi phí nếu sai: không']) {
      ok(lg.validateLine(l) === null, `AC1.4: validateLine chấp nhận ${JSON.stringify(l)}`);
    }
  }

  // AC1.1–AC1.5, AC3.6: SKILL.md và inline.md hỏi cách thực thi trước Task 1
  {
    const read = (...p) => fs.readFileSync(path.join(skillDir, ...p), 'utf8');
    const flat = (s) => s.replace(/\s+/g, ' ');
    const skill = flat(read('SKILL.md'));
    const inline = flat(read('references', 'inline.md'));
    ok(/thẻ Cách thực thi/.test(skill) && /Subagent \+ review từng task/.test(skill) && /Inline/.test(skill), 'AC1.1: SKILL.md có thẻ Cách thực thi với hai lựa chọn Subagent + review từng task / Inline');
    ok(/`planRunner`[^.]*gợi ý/.test(skill) && /không bỏ (qua )?câu hỏi/.test(skill), 'AC1.2: SKILL.md nêu planRunner chỉ là gợi ý, không bỏ câu hỏi');
    ok(!/Không hỏi người dùng chọn cách thực thi/i.test(skill + inline) && !/khi `partRunner` là `session` hoặc thiếu khoá/.test(skill), 'AC1.2: không còn câu cấm hỏi cách thực thi hay điều kiện hỏi theo khoá');
    ok(/không có tool subagent/.test(skill) && /nói rõ/.test(skill) && /người dùng nói rõ/.test(inline), 'AC1.3: SKILL.md và inline.md nêu hai trường hợp không hỏi (không có tool subagent, người dùng nói rõ)');
    ok(/grep[^.]*ledger `root\/`[^.]*`\^Ruling: cách chạy`/.test(skill) && /Ruling: cách chạy <[^>]*> — </.test(skill) && /Ruling: cách chạy/.test(inline) && !/Ruling: thực thi inline/.test(inline),
      'AC1.4: SKILL.md grep cả ledger root/ tìm Ruling: cách chạy và nêu mẫu dòng; inline.md dùng cùng mẫu');
    ok(/Task 1: start/.test(skill.slice(skill.indexOf('Cách thực thi'))) && /người dùng chọn inline/i.test(inline), 'AC1.4: thẻ đặt trước Task 1: start; inline.md nêu điều kiện người dùng chọn inline');
    ok(/phiên part và subagent part không hỏi/i.test(skill) && /không hỏi cách chạy/i.test(inline), 'AC1.5: phiên part và subagent part không hỏi cách chạy');
    ok(/autonomy\.mjs --set planRunner=/.test(skill) && /không dùng Write\/Edit/i.test(skill), 'AC3.6: SKILL.md lưu gợi ý bằng autonomy.mjs --set, không dùng Write/Edit lên aip-gate.json');
  }

  // AC1.5, AC2.1–AC2.4, AC3.6: task-loop.md và ask-user.md hỏi cách chạy part theo từng nhóm Song song
  {
    const read = (...p) => fs.readFileSync(path.join(skillDir, ...p), 'utf8');
    const flat = (s) => s.replace(/\s+/g, ' ');
    const loop = flat(read('references', 'task-loop.md'));
    const ask = flat(read('references', 'ask-user.md'));
    ok(/Hỏi người dùng một lần trước mỗi nhóm Song song \(mọi giá trị `partRunner`/.test(loop) && /ba lựa chọn/.test(loop) && /--set partRunner=/.test(loop),
      'AC2.1: task-loop.md hỏi ba lựa chọn trước mỗi nhóm Song song ở mọi giá trị partRunner và lưu gợi ý bằng --set');
    ok(!/`subagent`: không hỏi/.test(loop) && !/`sequential`: không hỏi/.test(loop) && !/Khoá `subagent` cũng là sự đồng ý/.test(loop) && !/khi `partRunner` là `session` hoặc thiếu khoá/.test(loop),
      'AC2.1: task-loop.md không còn nhánh khoá bỏ câu hỏi');
    ok(/check-partition\.mjs[^.]*P1\/P2\/P4[^.]*không hỏi, chạy tuần tự/.test(loop), 'AC2.2: nhóm bị P1/P2/P4 không hỏi, chạy tuần tự');
    ok(/Câu trả lời `subagent` hoặc `session` cũng là sự đồng ý để tạo worktree và `merge --no-ff`/.test(loop) && /`sequential`: không tạo worktree/.test(loop),
      'AC2.3: câu trả lời subagent/session là đồng ý tạo worktree và merge local; sequential không tạo worktree');
    ok(/không có nhóm Song song[^.]*thẻ Cách thực thi/.test(loop), 'AC2.4: plan có part mà không nhóm Song song vẫn qua thẻ Cách thực thi');
    ok(/phiên part và subagent part không hỏi cách chạy/i.test(loop), 'AC1.5: task-loop.md nêu phiên part và subagent part không hỏi cách chạy');
    ok(/không dùng Write\/Edit/i.test(loop), 'AC3.6: task-loop.md không dùng Write/Edit lên aip-gate.json');
    ok(/\| Cách thực thi \| [^|]* \| [^|]* \| Subagent \+ review từng task \/ Inline/.test(ask) && /\| Cách chạy part \| [^|]* \| [^|]* \| Subagent \/ Phiên riêng \/ Tuần tự/.test(ask) && /cách thực thi/.test(ask.slice(0, 600)),
      'AC1.1/AC2.1: ask-user.md có hàng Cách thực thi (hai lựa chọn) và hàng Cách chạy part (ba lựa chọn), đoạn mở đầu nêu cách thực thi');
  }

  // AC6.1: baseline và CLAUDE.md bỏ câu cấm hỏi cách thực thi; hai file baseline giữ giống hệt nhau, không quá 200 dòng
  {
    const raw = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8');
    const flat = (s) => s.replace(/\s+/g, ' ');
    const template = raw('core', 'agents', 'AGENTS.template.md');
    ok(template === raw('AGENTS.md') && template.split('\n').length <= 201, 'AC6.1: AGENTS.md giống hệt template và không quá 200 dòng');
    for (const [name, text] of [['template', template], ['CLAUDE.md', raw('CLAUDE.md')]]) {
      const t = flat(text);
      ok(!/do not ask again how to execute/.test(t), `AC6.1: ${name} không còn "do not ask again how to execute"`);
      ok(/plan-execution`[^.]*asks how to run \(subagent per task or inline\) before each execution and remembers the answer as a suggestion/.test(t), `AC6.1: ${name} nêu plan-execution hỏi cách chạy trước mỗi lần thực thi và nhớ câu trả lời làm gợi ý`);
    }
    ok(/planRunner/.test(raw('CLAUDE.md')), 'AC6.1: CLAUDE.md liệt kê planRunner trong khoá autonomy');
  }

  // AC2.3, AC6.2: git-worktree, WORKFLOW feature và hai README đồng bộ với "luôn hỏi cách chạy"
  {
    const raw = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8').replace(/\s+/g, ' ');
    const wtSkill = raw('core', 'skills', 'git-worktree', 'SKILL.md');
    const parallel = raw('core', 'skills', 'git-worktree', 'references', 'parallel-agents.md');
    ok(!/hoặc khoá `partRunner: subagent`/.test(wtSkill) && /câu trả lời Subagent hoặc Phiên riêng/.test(wtSkill), 'AC2.3: git-worktree/SKILL.md: câu trả lời nhóm Song song thay câu hỏi tạo worktree, không còn khoá bỏ câu hỏi');
    ok(!/not asked when `autonomy\.partRunner` is `subagent`/.test(parallel) && /autonomy\.partRunner` only orders the options, it never skips the question/.test(parallel), 'AC2.3: parallel-agents.md: partRunner chỉ đặt thứ tự lựa chọn');
    const wf = raw('workflows', 'feature', 'WORKFLOW.md');
    ok(!/khi `partRunner` là `session` hoặc thiếu khoá/.test(wf) && !/hoặc khoá `partRunner: subagent`/.test(wf) && !/thiếu khoá thì hỏi người dùng một lần trước mỗi nhóm/.test(wf) && /thẻ Cách thực thi/.test(wf),
      'AC6.2: WORKFLOW.md feature: không còn khoá bỏ câu hỏi, nêu thẻ Cách thực thi');
    ok(!/parallel parts run as background subagents/.test(raw('README.md')) && /`partRunner` and `planRunner` only order the options/.test(raw('README.md')), 'AC6.2: README.md nêu khoá chỉ đặt thứ tự lựa chọn');
    ok(!/part song song chạy bằng subagent nền/.test(raw('README_VI.md')) && /`partRunner` và `planRunner` chỉ đặt lựa chọn đứng đầu/.test(raw('README_VI.md')), 'AC6.2: README_VI.md nêu khoá chỉ đặt lựa chọn đứng đầu');
  }

  // AC3.5: lệnh --set không bị guard-bash hỏi (lệnh không nêu tên aip-gate.json), còn ghi file bằng lệnh nêu tên vẫn hỏi
  {
    const { decide } = await import(pathToFileURL(path.join(REPO_ROOT, 'core', 'hooks', 'scripts', 'guard-bash.mjs')).href);
    const on = { currentBranch: () => 'feature/x' };
    const bash = (command) => ({ tool_name: 'Bash', cwd: '.', tool_input: { command } });
    const hint = 'node core/skills/plan-execution/scripts/autonomy.mjs --set planRunner=inline';
    ok(decide(bash(hint), on) === null, 'AC3.5: guard-bash không hỏi lệnh autonomy.mjs --set');
    ok(decide(bash('echo {} > .claude/aip-gate.json'), on)?.decision === 'ask', 'AC3.5: ghi aip-gate.json bằng lệnh nêu tên file vẫn bị hỏi');
  }
}
