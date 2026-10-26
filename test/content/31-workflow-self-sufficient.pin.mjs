// Pin: workflow tự đủ (docs/requests/2026-10-26-workflow-self-sufficient). Task 1: check-request kiểm kind của task + plan template (AC2.1).
export default async function run({ ok, ctx }) {
  const { fs, path, os, REPO_ROOT, pathToFileURL } = ctx;

  // AC2.1: check-request kiểm dòng **Kind:** của từng task trong plan.md
  {
    const scriptPath = path.join(REPO_ROOT, 'core', 'skills', 'artifact-templates', 'scripts', 'check-request.mjs');
    const cr = await import(pathToFileURL(scriptPath).href);
    const base = {
      'design.md': '# D\n## 3. Tiêu chí chấp nhận\n- [ ] **AC1.1** — Given a When b Then c\n',
      'plan.md': '# Plan\n**Goal:** x\n**Spec:** design.md\n**Phủ AC:** AC1.1\n',
    };
    const withTasks = (tasks) => ({ ...base, 'plan.md': base['plan.md'] + tasks });
    const run1 = (tasks) => cr.checkRequest(withTasks(tasks)).filter((w) => w.code === 'W17' || w.code === 'W18');
    const codes = (tasks) => run1(tasks).map((w) => w.code).join(',');

    ok(Array.isArray(cr.TASK_KINDS) && cr.TASK_KINDS.join(',') === 'BE,FE-UI,FE-INT,E2E,DB,CT,DOCS,TOOLING',
      'AC2.1: TASK_KINDS đủ 8 kind');
    ok(codes('\n### Task 1: x\n**Phủ AC:** AC1.1\n') === 'W17', 'AC2.1: task thiếu **Kind:** → W17');
    ok(codes('\n### Task 1: x\n**Kind:** QA\n') === 'W18', 'AC2.1: kind ngoài TASK_KINDS → W18');
    ok(codes('\n### Task 1: x\n**Kind:** BE\n') === '', 'AC2.1: kind hợp lệ → không W17/W18');
    ok(codes('') === '', 'AC2.1: plan không có task → không W17/W18');
    ok(codes('\n```\n### Task 9: y\n```\n') === '', 'AC2.1: heading task trong khối code không bị tính');
    ok(codes('\n### Task 1: a\n**Kind:** BE\n## Khác\n### Task 2: b\n') === 'W17', 'AC2.1: Kind chỉ tính trong phạm vi task của nó');
    const w = run1('\n### Task 1: a\n**Kind:** BE\n### Task 2: b\n')[0];
    ok(!!w && w.file === 'plan.md' && w.line === 8, 'AC2.1: cảnh báo trỏ dòng heading task (plan.md:8)');
  }

  // AC2.1: plan template có bản đồ file, Kind và Interfaces ở task mẫu
  {
    const tpl = fs.readFileSync(path.join(REPO_ROOT, 'core', 'skills', 'artifact-templates', 'references', 'plan.template.md'), 'utf8');
    ok(tpl.indexOf('## Bản đồ file') > 0 && tpl.indexOf('## Bản đồ file') < tpl.indexOf('## Global Constraints'),
      'AC2.1: plan template có "## Bản đồ file" trước Global Constraints');
    ok(tpl.includes('**Kind:**') && tpl.includes('**Interfaces:**') && tpl.includes('Consumes') && tpl.includes('Produces'),
      'AC2.1: task mẫu có **Kind:** và **Interfaces:** (Consumes/Produces)');
  }

  // AC2.1, AC2.2, AC2.3, AC1.4: skill engineering-plan-writing + quan hệ với task-breakdown
  {
    const dir = path.join(REPO_ROOT, 'plugins', 'engineering', 'skills', 'engineering-plan-writing');
    const read = (...p) => (fs.existsSync(path.join(dir, ...p)) ? fs.readFileSync(path.join(dir, ...p), 'utf8') : '');
    const skill = read('SKILL.md');
    ok(skill.length > 0, 'AC2.1: engineering-plan-writing/SKILL.md tồn tại');
    for (const phrase of ['Bản đồ file', 'Global Constraints', 'Review Focus', '**Interfaces:**', '**Kind:**', 'check-request.mjs']) {
      ok(skill.includes(phrase), `AC2.1: SKILL plan-writing nhắc "${phrase}"`);
    }
    ok(/thay đổi nhỏ[^\n]*(không|bỏ)[^\n]*plan\.md/.test(skill), 'AC1.4: SKILL nói cỡ "thay đổi nhỏ" không có plan.md');
    ok(read('references', 'plan-structure.md').length > 0, 'AC2.1: có references/plan-structure.md');

    const self = read('references', 'self-review.md');
    const items = (self.match(/^[1-9]\. /gm) || []).join('');
    ok(items === '1. 2. 3. 4. 5. ', 'AC2.2: self-review.md có đúng 5 mục đánh số 1.–5.');
    ok(self.includes('check-request.mjs'), 'AC2.2: self-review chạy check-request.mjs sau 5 mục');

    const tb = fs.readFileSync(path.join(REPO_ROOT, 'plugins', 'engineering', 'skills', 'engineering-task-breakdown', 'SKILL.md'), 'utf8');
    ok(tb.includes('ID task') && tb.includes('một checkpoint'),
      'AC2.3: task-breakdown nói task trong plan.md trỏ ID task của tasks.md, một checkpoint chung');
  }

  // AC1.1–AC1.5: spec-writing chạy ở session chính (cổng, lối thoát, hỏi từng câu, playback, đề xuất, cỡ việc, builder check); spec-analyst chỉ ghi
  {
    const eng = path.join(REPO_ROOT, 'plugins', 'engineering');
    const sw = path.join(eng, 'skills', 'engineering-spec-writing');
    const read = (...p) => (fs.existsSync(path.join(...p)) ? fs.readFileSync(path.join(...p), 'utf8').replace(/\r\n/g, '\n') : '');
    const flat = (t) => t.replace(/\s+/g, ' ');
    const skill = flat(read(sw, 'SKILL.md'));

    for (const phrase of ['session chính', 'bỏ qua phần hỏi', 'quyết định của agent', '2–3 hướng', 'builder check', 'một tin nhắn']) {
      ok(skill.includes(phrase), `AC1.1–AC1.3: SKILL spec-writing nhắc "${phrase}"`);
    }
    ok(/đủ thông tin/.test(skill), 'AC1.1: SKILL có cổng "đủ thông tin" trước khi hỏi');
    ok(/playback|tóm tắt lại/.test(skill) && /từng câu/.test(skill), 'AC1.1: SKILL hỏi từng câu và tóm tắt lại từng phần');
    ok(/khuyến nghị/.test(skill) && /đánh đổi/.test(skill), 'AC1.1: SKILL đề xuất kèm 1 khuyến nghị và đánh đổi');
    ok(/sau (khi )?playback/.test(skill) && /lệch có chủ đích/.test(skill),
      'AC1.1: SKILL đặt đề xuất sau playback và ghi đây là lệch có chủ đích');
    const sizeOf = (name) => read(sw, 'SKILL.md').split('\n').find((l) => l.includes('- **' + name + '**')) || '';
    ok(/không chạy workflow/.test(sizeOf('Việc rõ và nhỏ')), 'AC1.4: dòng cỡ "Việc rõ và nhỏ" → không chạy workflow');
    ok(['requirement.md', 'design.md', 'plan.md'].every((f) => sizeOf('Dự án').includes('`' + f + '`')) && /gate/.test(sizeOf('Dự án')),
      'AC1.4: dòng cỡ "Dự án" → requirement.md + design.md + plan.md, mỗi file một gate');
    const sizeLine = read(sw, 'SKILL.md').split('\n').find((l) => /\*\*Thay đổi nhỏ\*\*/.test(l)) || '';
    ok(/requirement\.md/.test(sizeLine) && /không có `design\.md`/.test(sizeLine) && /không có `plan\.md`/.test(sizeLine),
      'AC1.4: cỡ "thay đổi nhỏ" chỉ requirement.md, không design.md/plan.md');
    ok(/bỏ qua → bỏ bước 3–4[^]*không hỏi thêm câu nào/.test(skill), 'AC1.2: bỏ qua phần hỏi → viết thẳng, không hỏi thêm câu nào trước checkpoint');
    ok(/không có tool subagent[^.]*(tự đọc|tự đóng vai)/i.test(skill), 'AC1.3: không có tool subagent → tự đọc như builder');
    // AC1.2: bỏ qua phần hỏi thì builder check cũng không hỏi; AC1.1: design.md vẫn có 2–3 hướng, agent tự chọn
    const skillRaw = read(sw, 'SKILL.md');
    const between = (from, to) => skillRaw.split(from)[1]?.split(to)[0] || '';
    const step9 = between('9. **Builder check', '10. **Verify');
    ok(/bỏ qua phần hỏi/.test(step9) && /không hỏi/.test(step9) && /quyết định của agent/.test(step9) && /nổi bật/.test(step9),
      'AC1.2: SKILL bước 9 — đã bỏ qua phần hỏi thì không hỏi, nhóm của người dùng thành quyết định của agent, nêu nổi bật ở checkpoint');
    ok(/người dùng đã bỏ qua phần hỏi[^]*không hỏi gì[^]*quyết định của agent[^]*nổi bật/.test(read(sw, 'references', 'builder-check.md')),
      'AC1.2: builder-check.md có ngoại lệ bỏ qua phần hỏi (không hỏi, quyết định của agent, nêu nổi bật)');
    const step5 = between('5. **Đề xuất', '6. **Xếp cỡ');
    ok(/hướng bị loại/.test(step5) && /tự chọn/.test(step5) && /không dừng chờ chọn/.test(step5),
      'AC1.1: SKILL bước 5 — ghi cả hướng bị loại; bỏ qua phần hỏi thì agent tự chọn, không dừng chờ');
    const step2 = between('2. **Cổng', '3. **Hỏi từng câu');
    ok(/tự chọn hướng/.test(step2) && /2–3 hướng/.test(step2) && !/bước 5–7/.test(step2),
      'AC1.1: SKILL bước 2 — bỏ qua phần hỏi: agent tự chọn hướng, vẫn ghi 2–3 hướng');
    const verif = between('## Verification', '## Ghi chú');
    ok(/2–3 hướng/.test(verif) && /không bỏ phần này/.test(verif), 'AC1.1: Verification không miễn 2–3 hướng khi bỏ qua phần hỏi');

    const bc = flat(read(sw, 'references', 'builder-check.md'));
    ok(bc.length > 0, 'AC1.3: có references/builder-check.md');
    const bcRow = (name) => read(sw, 'references', 'builder-check.md').split('\n').find((l) => l.trim().startsWith('| **' + name + '**')) || '';
    ok(bcRow('Đã trả lời').includes('Ghi vào tài liệu') && /quyết định của agent/.test(bcRow('Nhỏ')) && /hỏi/.test(bcRow('Của người dùng')),
      'AC1.3: builder-check có đủ 3 hàng nhóm (đã trả lời / nhỏ / của người dùng) với cách xử lý tương ứng');
    ok(/không được hỏi/i.test(bc) && /xếp hạng/i.test(bc) && /một tin nhắn/.test(bc), 'AC1.3: builder-check cấm hỏi người viết, xếp hạng, gom một tin nhắn');
    ok(bc.includes('quyết định của agent'), 'AC1.3: câu nhỏ tự quyết được ghi "quyết định của agent"');

    const el = flat(read(sw, 'references', 'elicitation.md'));
    ok(/vùng phủ/i.test(el) && /không đọc ra/i.test(el), 'AC1.1: elicitation coi 8 nhóm là vùng phủ, không đọc ra thành danh sách câu');
    ok(!/một cụm nhỏ/.test(el), 'AC1.1: elicitation bỏ chỉ dẫn hỏi theo cụm/bảng câu hỏi');

    const sstr = flat(read(sw, 'references', 'spec-structure.md'));
    ok(/hướng bị loại.{0,80}ghi vào `design\.md`/i.test(sstr), 'AC1.1: spec-structure ghi cả hướng bị loại vào design.md');
    ok(/đã chốt/i.test(sstr) && /quyết định của agent/i.test(sstr) && /để builder quyết/i.test(sstr) && /anti-goal/i.test(sstr),
      'AC1.1: spec-structure hướng dẫn điền design.md (đã chốt / quyết định của agent / để builder quyết / anti-goal)');
    ok(/builder check/.test(flat(read(sw, 'references', 'checklist.md'))), 'AC1.3: checklist có mục builder check');

    const agentRaw = read(eng, 'agents', 'engineering-spec-analyst.md');
    const agent = flat(agentRaw);
    const desc = (agentRaw.match(/^description: "(.*)"$/m) || [])[1] || '';
    ok(desc.length > 0 && desc.length <= 260 && /Dùng khi [^.]*\.?$/.test(desc), 'AC1.5: description agent ≤ 260 ký tự, kết bằng "Dùng khi …"');
    ok(!/khảo sát yêu cầu/i.test(desc), 'AC1.5: description agent không còn vai khảo sát');
    ok(!/hỏi từng câu/.test(agent) && !/Khảo sát\/làm rõ theo bộ câu hỏi/.test(agent), 'AC1.5: agent không còn bước hỏi/khảo sát người dùng');
    ok(/status: blocked/.test(agent) && /questions\[\]/.test(agent), 'AC1.5: thiếu thông tin → trả status: blocked + questions[]');
    ok(/writeScope:\s*\n\s*- docs\/\*\*/.test(agentRaw), 'AC1.5: giữ writeScope docs/**');
  }

  // AC1.1, AC1.3, AC1.4, AC2.2: workflow-feature Bước 1–4 mới (làm rõ ở session chính → tài liệu → plan)
  {
    const wfRaw = fs.readFileSync(path.join(REPO_ROOT, 'workflows', 'feature', 'WORKFLOW.md'), 'utf8').replace(/\r\n/g, '\n');
    const flatW = (t) => t.replace(/\s+/g, ' ');
    const secs = wfRaw.split(/^### Bước /m).slice(1).map((s) => ({ head: s.split('\n')[0], body: s }));
    const heads = secs.slice(0, 4).map((s) => s.head).join('|');
    ok(heads === '1 — Baseline build/test|2 — Làm rõ & cỡ việc ⏸|3 — Tài liệu ⏸|4 — Plan ⏸',
      'AC1.1: workflow-feature 4 bước đầu là Baseline, Làm rõ & cỡ việc ⏸, Tài liệu ⏸, Plan ⏸');
    ok(secs.length === 9 && secs[8].head === '9 — Commit ⏸', 'AC1.1: workflow-feature có 9 bước, Commit ⏸ ở Bước 9');
    const field = (s, name) => flatW((s.body.split(`- **${name}:**`)[1] || '').split(/\n- \*\*/)[0]);
    const doing2 = field(secs[1], 'Thực hiện');
    ok(/session chính/.test(doing2) && doing2.includes('`engineering-spec-writing`'),
      'AC1.1: Bước 2 do session chính chạy skill engineering-spec-writing');
    ok(!/agent `engineering-spec-analyst`/.test(doing2), 'AC1.1: Bước 2 không giao agent hỏi người dùng');
    const s3 = field(secs[2], 'Thực hiện') + ' ' + field(secs[2], 'Hành động');
    ok(s3.includes('engineering-spec-analyst') && /builder check/.test(s3),
      'AC1.3: Bước 3 spec-analyst ghi tài liệu, session chính chạy builder check');
    ok(/design\.md/.test(s3) && /cỡ dự án/.test(s3), 'AC1.4: Bước 3 chỉ viết design.md khi cỡ dự án');
    const s4 = secs[3].body;
    ok(s4.includes('check-request.mjs') && s4.includes('`engineering-plan-writing`') && /thay đổi nhỏ/.test(s4) && /bỏ qua/.test(s4),
      'AC2.2: Bước 4 theo engineering-plan-writing, chạy check-request.mjs, bỏ qua khi cỡ thay đổi nhỏ');
    ok(/W9/.test(field(secs[3], 'Gate')), 'AC2.2: Gate Bước 4 cho phép riêng cảnh báo W9');
    ok(secs[1].body.includes('data-db-migration') && secs[1].body.includes('ứng viên e2e'),
      'AC1.1: Bước 2 giữ dừng khi đổi schema → data-db-migration và bảng ứng viên e2e');

    const g = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'workflows', 'feature', 'graph.json'), 'utf8'));
    ok(g.steps.slice(0, 4).map((s) => s.id).join(',') === 'baseline,clarify,documents,plan', 'AC1.1: graph id bước 1–4 là baseline, clarify, documents, plan');
    ok(g.steps.slice(1, 4).every((s) => s.gate.type === 'human' && s.gate.reject === 'ask_user'), 'AC1.1: graph bước 2–4 gate human, reject → ask_user');
  }

  // AC3.6, AC3.3: script plan-execution (task-brief, review-package, ledger)
  {
    const sdir = path.join(REPO_ROOT, 'core', 'skills', 'plan-execution', 'scripts');
    const load = async (n) => {
      const f = path.join(sdir, n);
      if (!fs.existsSync(f)) { ok(false, `AC3.6: thiếu ${n}`); return null; }
      return import(pathToFileURL(f).href);
    };
    const tb = await load('task-brief.mjs');
    const rp = await load('review-package.mjs');
    const lg = await load('ledger.mjs');

    if (tb) {
      const plan = '# Plan\n\n```\n### Task 1: giả trong code\n```\n\n### Task 1: a\nnội dung 1\n\n```md\n## Không phải heading\n```\ncòn task 1\n\n### Task 2: b\nnội dung 2\n**Kind:** BE\n\n## Phụ lục\nngoài\n\n### Task 3: c\nnội dung 3\n';
      const t2 = tb.extractTask(plan, 2);
      ok(t2 === '### Task 2: b\nnội dung 2\n**Kind:** BE\n', 'AC3.6: extractTask lấy đúng task 2, dừng ở heading ## kế tiếp');
      ok(tb.extractTask(plan, 9) === null, 'AC3.6: extractTask trả null khi không có task');
      const t1 = tb.extractTask(plan, 1);
      ok(t1.startsWith('### Task 1: a') && t1.includes('còn task 1') && t1.includes('## Không phải heading') && !t1.includes('Task 2'),
        'AC3.6: extractTask bỏ qua heading trong khối code (cả "### Task 1:" lẫn "##") và giữ nguyên khối đó');
      ok(tb.extractTask(plan.replace(/\n/g, '\r\n'), 2).startsWith('### Task 2: b'), 'AC3.6: extractTask chịu CRLF');
    }

    if (rp) {
      const mk = (ancestor) => (args) => {
        if (args[0] === 'merge-base') { if (!ancestor) throw new Error('exit 1'); return ''; }
        if (args[0] === 'log') return 'abc1234 feat: x\n';
        if (args.includes('--stat')) return ' a.js | 2 +-\n';
        return 'diff --git a/a.js b/a.js\n';
      };
      let msg = '';
      try { rp.buildPackage({ base: 'a', head: 'a', run: mk(true) }); } catch (e) { msg = e.message; }
      ok(msg !== '', 'AC3.6: buildPackage ném lỗi khi base == head');
      msg = '';
      try { rp.buildPackage({ base: 'a', head: 'b', run: mk(false) }); } catch (e) { msg = e.message; }
      ok(msg !== '', 'AC3.6: buildPackage ném lỗi khi base không là tổ tiên của head');
      const pkg = rp.buildPackage({ base: 'a', head: 'b', run: mk(true) });
      ok(pkg.includes('abc1234 feat: x') && pkg.includes('a.js | 2 +-') && pkg.includes('diff --git a/a.js'),
        'AC3.6: buildPackage gồm commit list, stat và diff');
      const calls = [];
      rp.buildPackage({ base: 'a', head: 'b', run: (args) => { calls.push(args.join(' ')); return mk(true)(args); } });
      ok(calls.some((c) => c.includes('-U10') && c.includes('a..b')) && calls.some((c) => c.startsWith('merge-base --is-ancestor a b')),
        'AC3.6: buildPackage gọi diff -U10 theo base..head và merge-base --is-ancestor');
    }

    if (lg) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-ledger-'));
      try {
        const file = lg.ensureWorkspace(tmp);
        ok(file === path.join(tmp, '.sdd', 'progress.md'), 'AC3.3: ensureWorkspace trả đường dẫn .sdd/progress.md');
        ok(fs.readFileSync(path.join(tmp, '.sdd', '.gitignore'), 'utf8') === '*\n', 'AC3.3: .sdd/.gitignore chứa "*"');
        ok(lg.ensureWorkspace(tmp) === file, 'AC3.3: ensureWorkspace chạy lại không lỗi');
        ok(lg.readTail(file, 100) === null, 'AC3.3: readTail trả null khi ledger chưa có');
        lg.appendLedger(file, '# Ledger — plan: plan.md');
        lg.appendLedger(file, 'Task 1: complete (commits a..b, review clean)');
        ok(fs.readFileSync(file, 'utf8') === '# Ledger — plan: plan.md\nTask 1: complete (commits a..b, review clean)\n', 'AC3.3: appendLedger ghi mỗi dòng kết thúc bằng LF');
        const all = lg.readTail(file, 1000);
        ok(all.includes('Task 1: complete'), 'AC3.3: readTail trả nội dung khi plan chưa xong');
        const tail = lg.readTail(file, 20);
        ok(tail.length <= 20 && tail.endsWith('review clean)\n'), 'AC3.3: readTail trả tối đa max ký tự cuối');
        lg.appendLedger(file, 'Plan: complete');
        ok(lg.readTail(file, 1000) === null, 'AC3.3: readTail trả null khi có dòng "Plan: complete"');
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }
  }
}
