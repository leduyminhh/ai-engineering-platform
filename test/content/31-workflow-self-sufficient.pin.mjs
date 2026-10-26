// Pin: workflow tự đủ (docs/requests/2026-10-26-workflow-self-sufficient). Task 1: check-request kiểm kind của task + plan template (AC2.1).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, pathToFileURL } = ctx;

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
    ok(/việc rõ và nhỏ/i.test(skill) && /thay đổi nhỏ/i.test(skill) && /dự án/i.test(skill), 'AC1.4: SKILL nêu đủ ba cỡ việc');
    const sizeLine = read(sw, 'SKILL.md').split('\n').find((l) => /\*\*Thay đổi nhỏ\*\*/.test(l)) || '';
    ok(/requirement\.md/.test(sizeLine) && /không có `design\.md`/.test(sizeLine) && /không có `plan\.md`/.test(sizeLine),
      'AC1.4: cỡ "thay đổi nhỏ" chỉ requirement.md, không design.md/plan.md');
    ok(/bỏ qua → chuyển thẳng[^]*không hỏi thêm câu nào/.test(skill), 'AC1.2: bỏ qua phần hỏi → viết thẳng, không hỏi thêm câu nào trước checkpoint');
    ok(/không có tool subagent[^.]*(tự đọc|tự đóng vai)/i.test(skill), 'AC1.3: không có tool subagent → tự đọc như builder');

    const bc = flat(read(sw, 'references', 'builder-check.md'));
    ok(bc.length > 0, 'AC1.3: có references/builder-check.md');
    ok(/đã trả lời/i.test(bc) && /nhỏ/i.test(bc) && /của người dùng/i.test(bc), 'AC1.3: builder-check phân 3 nhóm (đã trả lời / nhỏ / của người dùng)');
    ok(/không được hỏi/i.test(bc) && /xếp hạng/i.test(bc) && /một tin nhắn/.test(bc), 'AC1.3: builder-check cấm hỏi người viết, xếp hạng, gom một tin nhắn');
    ok(bc.includes('quyết định của agent'), 'AC1.3: câu nhỏ tự quyết được ghi "quyết định của agent"');

    const el = flat(read(sw, 'references', 'elicitation.md'));
    ok(/vùng phủ/i.test(el) && /không đọc ra/i.test(el), 'AC1.1: elicitation coi 8 nhóm là vùng phủ, không đọc ra thành danh sách câu');
    ok(!/một cụm nhỏ/.test(el), 'AC1.1: elicitation bỏ chỉ dẫn hỏi theo cụm/bảng câu hỏi');

    const sstr = flat(read(sw, 'references', 'spec-structure.md'));
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
}
