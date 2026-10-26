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

  // AC3.1, AC3.5, AC4.1, AC4.2, AC4.3: workflow-feature đúng 7 bước (Bước 5–7 mới: vòng task, review cuối, kết thúc nhánh)
  {
    const wfRaw = fs.readFileSync(path.join(REPO_ROOT, 'workflows', 'feature', 'WORKFLOW.md'), 'utf8').replace(/\r\n/g, '\n');
    const flatW = (t) => t.replace(/\s+/g, ' ');
    const secs = wfRaw.split(/^### Bước /m).slice(1).map((s) => ({ head: s.split('\n')[0], body: s }));
    ok(secs.map((s) => s.head).join('|') === '1 — Baseline build/test|2 — Làm rõ & cỡ việc ⏸|3 — Tài liệu ⏸|4 — Plan ⏸|5 — Vòng task|6 — Review cuối|7 — Kết thúc nhánh ⏸',
      'AC3.1: workflow-feature đúng 7 bước, Bước 5–7 là Vòng task, Review cuối, Kết thúc nhánh ⏸');
    const field = (s, name) => flatW((s.body.split(`- **${name}:**`)[1] || '').split(/\n- \*\*/)[0]);
    const s5 = flatW(secs[4].body);
    ok(s5.includes('`plan-execution`') && s5.includes('.sdd/progress.md') && /ledger/.test(s5),
      'AC3.1: Bước 5 chạy skill plan-execution và nhắc ledger .sdd/progress.md');
    ok(/spec_verdict/.test(s5) && /tối đa 3 vòng/.test(s5) && /commit/.test(field(secs[4], 'Hành động')),
      'AC3.1: Bước 5 review từng task trả spec_verdict, sửa tối đa 3 vòng, session chính commit theo task');
    ok(/thay đổi nhỏ/.test(s5) && /task id `1`/.test(s5) && /requirement\.md/.test(s5),
      'AC3.1: Bước 5 cỡ thay đổi nhỏ chạy một task, brief là requirement.md');
    ok(/`E2E`/.test(s5) && s5.includes('frontend-e2e-test-writer'), 'AC3.1: Bước 5 giữ e2e cho AC luồng UI qua task kind E2E');
    const s6 = flatW(secs[5].body);
    ok(/opus/.test(s6) && s6.includes('`engineering-quality-auditor`') && /một lần sửa/.test(s6) && /re-review/.test(s6),
      'AC3.5: Bước 6 reviewer opus + engineering-quality-auditor, một lần sửa + một re-review');
    ok(/drift/.test(s6) && /authorization/.test(s6) && /input validation/.test(s6),
      'AC3.5: Bước 6 giữ kiểm drift contract↔code, authorization và input validation khi có API');
    // I1: CT chốt ở Bước 3, vòng task bỏ qua — WORKFLOW và task-breakdown.md thống nhất
    ok(/task `CT` đã chốt contract ở Bước 3[^.;]*đánh `Done` từ Bước 3[^.;]*vòng task bỏ qua/.test(flatW(field(secs[4], 'Hành động'))) && !/`CT` → /.test(s5),
      'AC3.1: Bước 5 — task CT đã Done từ Bước 3, vòng task bỏ qua, không giao agent cho CT');
    const tbk = flatW(fs.readFileSync(path.join(REPO_ROOT, 'workflows', 'feature', 'references', 'task-breakdown.md'), 'utf8'));
    ok(/`CT` làm ở Bước 3/.test(tbk) && !/`CT` →/.test(tbk), 'AC3.1: task-breakdown.md — CT làm ở Bước 3, thống nhất với WORKFLOW');
    // I2: gate build/tsc/lint + type khớp contract khi FE-INT
    const g5 = field(secs[4], 'Gate'), e5 = field(secs[4], 'Evidence');
    ok(/build\/`tsc`\/lint[^;]*xanh/.test(g5) && /`FE-INT`: type khớp contract/.test(g5) && /exit code 0/.test(e5) && /`FE-INT`/.test(e5),
      'AC3.1: Bước 5 Gate/Evidence — build/tsc/lint xanh, FE-INT type khớp contract');
    ok(/reviewer chạy `model: opus`/.test(field(secs[5], 'Thực hiện')) && /model mặc định/.test(field(secs[5], 'Thực hiện')),
      'AC3.5: Bước 6 — opus cho reviewer domain, auditor model mặc định');
    ok(!/engineering-quality-auditor/.test(s5), 'AC3.5: engineering-quality-auditor chỉ ở Bước 6, không ở vòng task');
    const s7 = flatW(secs[6].body);
    ok(s7.includes('docs/specs/') && s7.includes('check-request.mjs') && /full suite/i.test(s7),
      'AC4.2: Bước 7 cập nhật spec sống, chạy check-request.mjs và full suite');
    ok(/merge local/.test(s7) && /push \+ PR/.test(s7) && /giữ nguyên/.test(s7) && /mặc định/.test(s7) && /không merge/i.test(s7),
      'AC4.2: Bước 7 đưa 3 lựa chọn, mặc định giữ nguyên, không merge/push khi chưa chọn');
    ok(/duyệt diff cả nhánh/.test(s7), 'AC4.2: Bước 7 là chỗ người dùng duyệt diff cả nhánh');
    ok(!/không tự commit khi người dùng chưa duyệt diff/.test(wfRaw) && !/Bước [89]\b/.test(wfRaw),
      'AC4.1: workflow-feature bỏ chốt "không commit khi chưa duyệt diff" và không còn Bước 8–9');
    ok(/^  rulings: \[\]/m.test(wfRaw.split('## Report cuối')[1] || ''), 'AC4.3: Report cuối có rulings: []');
    ok(/acceptance criteria từ Bước 3/.test(wfRaw) && !/acceptance criteria từ Bước 2/.test(wfRaw), 'AC3.1: tham chiếu acceptance criteria trỏ Bước 3');

    const fm = wfRaw.split('---')[1];
    const desc = (fm.match(/^description: "(.*)"$/m) || [])[1] || '';
    ok(desc.length > 0 && desc.length <= 500 && /làm rõ/.test(desc) && /tài liệu/.test(desc) && /plan/.test(desc) && /vòng task/.test(desc) && /review cuối/.test(desc),
      'AC3.1: description ≤ 500 ký tự, nêu làm rõ → tài liệu → plan → vòng task → review cuối');
    ok(/^requires: "[^"]*core\/plan-execution/m.test(fm), 'AC3.1: requires có core/plan-execution');

    const g = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'workflows', 'feature', 'graph.json'), 'utf8'));
    ok(g.steps.map((s) => s.id).join(',') === 'baseline,clarify,documents,plan,task-loop,final-review,finish', 'AC3.1: graph id 7 bước');
    const byId = Object.fromEntries(g.steps.map((s) => [s.id, s]));
    ok(byId['task-loop']?.gate.type === 'auto' && byId['final-review']?.gate.type === 'auto' && byId.finish?.gate.type === 'human' && byId.finish?.gate.reject === 'ask_user',
      'AC4.2: graph gate human chỉ ở finish (reject → ask_user)');
    const back = byId['final-review']?.on_fail.find((f) => f.to === 'task-loop');
    ok(!!back && back.max_attempts === 2, 'AC3.5: cạnh lùi final-review → task-loop có max_attempts 2');
    ok(!!byId['task-loop']?.run.skills.includes('plan-execution'), 'AC3.1: graph task-loop chạy skill plan-execution');
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

  // AC3.1, AC3.2, AC3.5, AC4.1, AC4.2, AC4.3: skill core plan-execution (giao thức vòng task, 4 prompt, kết thúc nhánh)
  {
    const dir = path.join(REPO_ROOT, 'core', 'skills', 'plan-execution');
    const rd = (...p) => (fs.existsSync(path.join(dir, ...p)) ? fs.readFileSync(path.join(dir, ...p), 'utf8').replace(/\r\n/g, '\n') : '');
    const flat = (t) => t.replace(/\s+/g, ' ');
    const skillRaw = rd('SKILL.md');
    const skill = flat(skillRaw);
    const loop = flat(rd('references', 'task-loop.md'));
    const fin = flat(rd('references', 'finish.md'));
    const prompt = (n) => flat(rd('references', 'prompts', n + '.md'));

    ok(skillRaw.length > 0, 'AC3.1: plan-execution/SKILL.md tồn tại');
    ok(/^## Quy trình/m.test(skillRaw) && /^## Ranh giới an toàn/m.test(skillRaw), 'AC3.1: SKILL có H2 Quy trình và Ranh giới an toàn');
    ok(/^order: 5\s*$/m.test(skillRaw), 'AC3.1: SKILL core order 5');

    // vòng task: BASE trước khi giao việc, review-package, spec_verdict, commit do session chính
    const all = skill + ' ' + loop;
    ok(/BASE/.test(all) && /git rev-parse HEAD/.test(all) && /trước khi giao/.test(all), 'AC3.1: ghi BASE (git rev-parse HEAD) trước khi giao việc');
    ok(all.includes('review-package') && all.includes('task-brief') && all.includes('ledger'), 'AC3.1: vòng task dùng task-brief, review-package, ledger');
    ok(all.includes('spec_verdict') && all.includes('engineering-plan-writing'), 'AC3.1: task review trả spec_verdict; kind trỏ engineering-plan-writing');
    ok(/session chính commit/.test(all) && all.includes('git-workflow') && /agent không tự commit/.test(all), 'AC4.1: session chính commit qua git-workflow, agent không tự commit');
    for (const f of ['Task <n>: complete', 'Ruling:', 'Plan: complete', '# Ledger']) ok(all.includes(f), `AC3.3: ledger nhắc "${f}"`);

    // vòng sửa: tối đa 3, vòng 3 opus, re-review có phạm vi, 4 loại dừng
    ok(/tối đa 3 vòng/.test(loop) && /vòng 3/.test(loop) && /opus/.test(loop) && /đặt lại/.test(loop), 'AC3.2: tối đa 3 vòng/task, đặt lại mỗi task, vòng 3 agent mới opus');
    ok(/SendMessage/.test(loop) && /ADDRESSED/.test(loop) && /chỉ[^.]*diff của vòng sửa/.test(loop), 'AC3.2: vòng 1–2 SendMessage; re-review chỉ diff của vòng sửa');
    ok(/sau vòng 3[^.]*(không còn|hết)/.test(loop) && /Ruling:/.test(loop), 'AC3.2: hết vòng 3 không còn vòng nào, ghi Ruling:');
    for (const stop of ['không đảo ngược', 'bảo mật', 'ngoài repo', 'mọi hướng đều là đoán', 'schema DB']) {
      ok(loop.includes(stop), `AC3.2: loại dừng hỏi người dùng nhắc "${stop}"`);
    }

    // review cuối nhánh
    const fr = prompt('final-review');
    ok(/toàn nhánh/.test(all) && /opus/.test(fr + ' ' + loop) && /Review Focus/.test(fr) && /minor/.test(fr) && /Ruling:/.test(fr),
      'AC3.5: review cuối toàn nhánh chạy opus, nhận Review Focus + Ruling: + minor đã hoãn');
    ok(/engineering-quality-auditor[^.]*chỉ[^.]*review cuối|chỉ[^.]*review cuối[^.]*engineering-quality-auditor/.test(all),
      'AC3.5: engineering-quality-auditor chỉ chạy ở review cuối');
    ok(/một lần sửa/.test(loop + ' ' + fr) && /một lần re-review/.test(loop + ' ' + fr), 'AC3.5: review cuối chỉ một lần sửa + một lần re-review');

    // 4 prompt
    for (const n of ['implementer', 'task-review', 're-review', 'final-review']) ok(prompt(n).length > 0, `AC3.1: có prompts/${n}.md`);
    const tr = prompt('task-review');
    ok(['Missing', 'Extra', 'Misunderstood', 'spec_verdict', 'cannot_verify'].every((w) => tr.includes(w)), 'AC3.1: task-review.md yêu cầu Missing/Extra/Misunderstood + spec_verdict');
    const rr = prompt('re-review');
    ok(/(?<!NOT )ADDRESSED/.test(rr) && rr.includes('NOT ADDRESSED'), 'AC3.2: re-review.md yêu cầu ADDRESSED đứng riêng và NOT ADDRESSED');

    // AC3.1: mọi lệnh review-package ghi package vào .sdd/ của request bằng --out (không đổ diff vào context, không lọt vào commit)
    {
      const cmds = (loop + ' ' + fr + ' ' + rr).match(/review-package\.mjs <[^`]*/g) || [];
      ok(cmds.length >= 4 && cmds.every((c) => c.includes('--out <requestDir>/.sdd/')), 'AC3.1: mọi lệnh review-package (task, re-review, review cuối) có --out <requestDir>/.sdd/…');
    }

    // AC3.2: task qua breaker vẫn có dòng complete sau các Ruling:; hoãn blocker/major ghi trong Ruling: kèm mức gốc
    ok(/Ruling:[^]*Task <n>: complete \(commits <a>\.\.<b>, <k> ruled\)/.test(loop), 'AC3.2: sau Ruling: cho mọi finding còn mở có dòng "Task <n>: complete (…, <k> ruled)"');
    ok(/Ruling:[^.]*mức gốc/.test(loop) && /minor \(deferred\)[^.]*chỉ[^.]*minor`\/`nit/.test(loop), 'AC3.2: blocker/major hoãn ghi trong Ruling: kèm mức gốc; minor (deferred) chỉ cho minor/nit');

    // AC3.1: model mặc định nằm trong skill, không phụ thuộc trường Model của plan
    ok(!/\*\*Model:\*\*/.test(prompt('implementer')) && /implementer[^.]*sonnet/.test(skill) && /vòng 3[^.]*opus/.test(skill), 'AC3.1: model mặc định (implementer sonnet; vòng 3 và review cuối opus) nằm trong SKILL, không dùng trường **Model:**');

    // kết thúc nhánh
    ok(/merge local/.test(fin) && /push \+ PR/.test(fin) && /giữ nguyên/.test(fin) && /mặc định[^.]*giữ nguyên/.test(fin), 'AC4.2: kết thúc nhánh đúng 3 lựa chọn, mặc định giữ nguyên');
    ok(/docs\/specs/.test(fin) && /check-request\.mjs/.test(fin) && /full suite/.test(fin), 'AC4.2: finish cập nhật spec sống, chạy check-request.mjs và full suite');
    ok(/không (merge|push)[^.]*chưa chọn/.test(fin) && /merge xong[^.]*(chạy lại|test lại)/.test(fin) && /xác nhận rõ/.test(fin), 'AC4.2: không merge/push khi chưa chọn; test lại sau merge; xoá nhánh chỉ khi xác nhận rõ');
    ok(/rulings/.test(fin) && /Ruling:/.test(fin), 'AC4.3: kết thúc gom mọi Ruling: vào rulings của workflow_result');
  }

  // AC3.4, AC3.2, AC4.3: contract đầu ra mở rộng cho vòng task (trường mới, vòng sửa riêng, re-review có phạm vi, ánh xạ blocked)
  {
    const oc = fs.readFileSync(path.join(REPO_ROOT, 'core', 'principles', 'workflow-output-contract.md'), 'utf8').replace(/\r\n/g, '\n');
    const flat = oc.replace(/\s+/g, ' ');
    const heads = oc.split(/^## /m).slice(1);
    const section = (title) => {
      const s = heads.find((h) => h.split('\n')[0].trim() === title);
      return s ? s.replace(/\s+/g, ' ') : '';
    };

    // AC3.4, AC4.3: trường mới của agent_result và workflow_result; mọi trường plan-execution tham chiếu đều có định nghĩa
    const ar = (oc.split('agent_result:\n')[1] || '').split('```')[0];
    ok(/^\s+tdd:\s*\{[^}]*red[^}]*green/m.test(ar) && /^\s+report_file:/m.test(ar) && /^\s+commits:/m.test(ar),
      'AC3.4: agent_result có tdd {red, green}, report_file, commits');
    const wr = (oc.split('workflow_result:\n')[1] || '').split('```')[0];
    ok(/^\s+rulings:/m.test(wr), 'AC4.3: workflow_result có rulings');
    ok(/rulings[^.]*Ruling:|Ruling:[^.]*rulings/.test(flat), 'AC4.3: rulings liệt kê mọi dòng Ruling: trong ledger');
    for (const f of ['spec_verdict', 'compliant', 'issues', 'cannot_verify', 'verdicts', 'new_breakage', 'observations_outside_diff', 'ruling_review', 'declined_to_judge']) {
      ok(flat.includes(f), `AC3.4: contract định nghĩa "${f}" (plan-execution tham chiếu)`);
    }

    // AC3.4: luật kiểm đầu ra mới + ánh xạ trạng thái cho vòng task
    const out = section('Kiểm đầu ra worker');
    ok(/kind: BE/.test(out) && /tdd\.red/.test(out) && /tdd\.green/.test(out) && /đầu ra hỏng/.test(out), 'AC3.4: task kind: BE thiếu tdd.red/tdd.green → đầu ra hỏng');
    ok(/spec_verdict/.test(out) && /findings/.test(out), 'AC3.4: task-review thiếu spec_verdict hoặc findings → đầu ra hỏng');
    ok(/remaining_risks/.test(out) && /xong kèm lo ngại/.test(out), 'AC3.4: remaining_risks không rỗng = xong kèm lo ngại');
    ok(/spec\/plan/.test(out) && /Ruling:/.test(out) && /không dùng vòng task/.test(out) && /ask_user/.test(out),
      'AC3.4: blocked + questions → trả lời từ spec/plan, ghi Ruling:; luật ask_user ngay giữ cho workflow không dùng vòng task');

    // AC3.2: vòng sửa của vòng task (D5) — bộ đếm riêng, hai con số đo hai thứ khác nhau
    const fix = section('Vòng sửa của vòng task');
    ok(/tối đa 3 vòng/.test(fix) && /đặt lại mỗi task/.test(fix) && /bộ đếm riêng/.test(fix) && /không phải cạnh[^.]*graph\.json/.test(fix),
      'AC3.2: tối đa 3 vòng/task, bộ đếm riêng, đặt lại mỗi task, không phải cạnh graph.json');
    ok(/Retry có ngưỡng/.test(fix) && /mặc định 2/.test(fix) && /đo hai thứ khác nhau/.test(fix),
      'AC3.2: cạnh lùi theo "Retry có ngưỡng" (mặc định 2); hai con số đo hai thứ khác nhau');
    ok(/sau vòng 3[^.]*không còn vòng nào/i.test(fix) && /Ruling:/.test(fix), 'AC3.2: sau vòng 3 không còn vòng nào, finding còn mở ghi Ruling:');

    // AC3.2: re-review có phạm vi
    const rr = section('Re-review có phạm vi');
    ok(/chỉ xét diff của vòng sửa/.test(rr) && /NOT ADDRESSED/.test(rr) && /(?<!NOT )ADDRESSED/.test(rr) && /ngoài diff[^.]*không kéo dài vòng/.test(rr),
      'AC3.2: re-review chỉ xét diff của vòng sửa, ADDRESSED/NOT ADDRESSED từng finding, quan sát ngoài diff không kéo dài vòng');

    // giữ mục cũ
    for (const h of ['Evidence', 'Finding', 'Agent result', 'Kiểm đầu ra worker', 'Retry có ngưỡng', 'Result contract', 'Quy tắc chung']) {
      ok(section(h).length > 0, `AC3.4: giữ mục "${h}"`);
    }
  }

  // AC3.4: implementer/test-writer — BE tự đỏ→xanh báo tdd, FE-UI để test-writer làm trong cùng task, 3 luật chất lượng test, không tự commit
  {
    const rd = (...p) => fs.readFileSync(path.join(REPO_ROOT, 'plugins', ...p), 'utf8').replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
    const be = rd('backend', 'agents', 'backend-implementer.md');
    ok(/task `kind: BE` trong vòng task/.test(be) && /test lõi/.test(be) && /đỏ đúng lý do/.test(be) && /tdd: { red, green }/.test(be) && /tdd\.red/.test(be) && /tdd\.green/.test(be),
      'AC3.4: backend-implementer — task kind: BE trong vòng task: test lõi đỏ đúng lý do trước, báo tdd.red/tdd.green');
    ok(/ngoài vòng task[^.]*không ép/.test(be), 'AC3.4: backend-implementer — không ép TDD khi được gọi ngoài vòng task');
    ok(!/xanh ở bước [0-9]/.test(be), 'AC3.4: backend-implementer — gọi bước chạy build + test theo tên, không theo số (số bước của agent khác SKILL)');
    const skill = rd('backend', 'skills', 'backend-implement', 'SKILL.md');
    ok(/kind: BE/.test(skill) && /đỏ đúng lý do/.test(skill) && /tdd\.red/.test(skill) && /tdd\.green/.test(skill),
      'AC3.4: backend-implement SKILL — bước test đỏ trước và báo tdd khi task kind: BE trong vòng task');

    const fi = rd('frontend', 'agents', 'frontend-implementer.md');
    ok(/`frontend-test-writer`[^.]*cùng task/.test(fi) && /không cần `tdd`/.test(fi) && /không (viết|sinh) test nghiệp vụ/i.test(fi),
      'AC3.4: frontend-implementer — không viết test nghiệp vụ; frontend-test-writer viết trong cùng task; không cần tdd');

    for (const f of [['backend', 'agents', 'backend-test-writer.md'], ['frontend', 'agents', 'frontend-test-writer.md']]) {
      const t = rd(...f);
      const n = f[2];
      ok(/thay đổi production[^.]*fail/.test(t), `AC3.4: ${n} — trước khi viết nêu thay đổi production nào làm test fail`);
      ok(/literal/.test(t) && /không tính bằng chính code đang test/.test(t), `AC3.4: ${n} — giá trị mong đợi là literal, không tính bằng code đang test`);
      ok(/không assert[^.]*mock/i.test(t), `AC3.4: ${n} — không assert vào mock vừa cấu hình`);
      ok(/chờ theo điều kiện/i.test(t) && /sleep cứng/.test(t), `AC3.4: ${n} — chờ theo điều kiện, không sleep cứng`);
    }

    for (const f of [['backend', 'agents', 'backend-implementer.md'], ['backend', 'agents', 'backend-test-writer.md'],
      ['frontend', 'agents', 'frontend-implementer.md'], ['frontend', 'agents', 'frontend-test-writer.md'], ['frontend', 'agents', 'frontend-data-integrator.md']]) {
      ok(/không tự commit/i.test(rd(...f)), `AC3.4: ${f[2]} — không tự commit`);
    }
  }

  // AC3.1, AC3.2, AC3.5: reviewer 3 chế độ, skill code-review có trục spec, auditor chỉ chạy ở review cuối nhánh, prompt dùng declined_to_judge[]
  {
    const rd = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8').replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
    for (const side of ['backend', 'frontend']) {
      const raw = fs.readFileSync(path.join(REPO_ROOT, 'plugins', side, 'agents', side + '-reviewer.md'), 'utf8');
      const t = raw.replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
      const n = side + '-reviewer';
      ok(/^tools: Read, Grep, Glob, Bash, Skill$/m.test(raw) && /^model: sonnet$/m.test(raw) && /^effort: high$/m.test(raw),
        `AC3.1: ${n} — giữ nguyên tools/model/effort`);
      ok(['task-review', 're-review', 'final-review'].every((m) => t.includes('`' + m + '`')), `AC3.1: ${n} — có 3 chế độ task-review, re-review, final-review`);
      ok(/ngoài vòng task[^.]*như cũ/.test(t), `AC3.1: ${n} — gọi ngoài vòng task giữ chế độ review hiện tại`);
      ok(/không chạy lại suite/i.test(t) && /test hẹp/.test(t) && /nêu (rõ )?tên/.test(t) && /review-package/.test(t),
        `AC3.1: ${n} — task-review không chạy lại suite, chỉ test hẹp nêu tên, đọc diff từ review-package`);
      ok(/spec_verdict/.test(t) && /Missing/.test(t) && /Extra/.test(t) && /Misunderstood/.test(t), `AC3.1: ${n} — task-review trả spec_verdict với Missing/Extra/Misunderstood`);
      ok(/chỉ diff của vòng sửa/.test(t) && /NOT ADDRESSED/.test(t) && /new_breakage/.test(t) && /observations_outside_diff/.test(t),
        `AC3.2: ${n} — re-review chỉ diff vòng sửa, ADDRESSED/NOT ADDRESSED, new_breakage, observations_outside_diff`);
      ok(/final-review[^.]*toàn nhánh/.test(t) && /được chạy suite/.test(t) && /ruling_review/.test(t) && /declined_to_judge/.test(t),
        `AC3.1: ${n} — final-review toàn nhánh, được chạy suite, ruling_review, declined_to_judge`);

      const sk = rd('plugins', side, 'skills', side + '-code-review', 'SKILL.md');
      ok(/Missing/.test(sk) && /Extra/.test(sk) && /Misunderstood/.test(sk) && /trục spec/.test(sk), `AC3.1: ${side}-code-review — có trục spec Missing/Extra/Misunderstood`);
      ok(/re-review/i.test(sk) && /diff của vòng sửa/.test(sk), `AC3.2: ${side}-code-review — mô tả re-review có phạm vi`);
      ok(/blocker \/ major \/ minor \/ nit/.test(sk), `AC3.1: ${side}-code-review — giữ thang severity blocker/major/minor/nit`);
    }

    const qa = rd('plugins', 'engineering', 'agents', 'engineering-quality-auditor.md');
    ok(/vòng task/.test(qa) && /review cuối nhánh/.test(qa) && /không (chạy )?theo từng task/.test(qa), 'AC3.5: quality-auditor — từ vòng task chỉ chạy ở review cuối nhánh, không theo từng task');

    for (const f of ['task-review.md', 'final-review.md']) {
      const pr = rd('core', 'skills', 'plan-execution', 'references', 'prompts', f);
      ok(pr.includes('declined_to_judge[]') && !/Declined to judge/.test(pr), `AC3.1: prompt ${f} — dùng tên trường declined_to_judge[] theo contract`);
    }
    ok(/agent_result:[^.]*declined_to_judge\[\]/.test(rd('core', 'skills', 'plan-execution', 'references', 'prompts', 'final-review.md')), 'AC3.1: final-review trả declined_to_judge[] trong agent_result');
  }

  // AC4.1, AC4.2: git-workflow cho vòng task — commit theo task không dừng trên feature, worktree hỏi một lần, kết thúc nhánh trỏ finish.md
  {
    const gw = fs.readFileSync(path.join(REPO_ROOT, 'core', 'skills', 'git-workflow', 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
    ok(/feature[^.]*plan đã duyệt[^.]*commit[^.]*không dừng/.test(gw) && /session chính/.test(gw),
      'AC4.1: git-workflow — session chính commit theo task không dừng trên nhánh feature chạy plan đã duyệt');
    ok(/mỗi task ít nhất 1 commit/.test(gw) && /vòng sửa[^.]*thêm commit/.test(gw), 'AC4.1: git-workflow — mỗi task ít nhất 1 commit, vòng sửa có thể thêm commit');
    ok(/không amend[^.]*squash[^.]*chưa[^.]*xác nhận/.test(gw), 'AC4.1: git-workflow — không amend/squash khi người dùng chưa xác nhận');
    ok(/protected[^.]*dừng[^.]*trước mỗi commit/.test(gw), 'AC4.1: git-workflow — nhánh protected vẫn dừng trước mỗi commit');
    ok(/hỏi người dùng một lần trước khi tạo (git )?worktree/i.test(gw) && !/trừ khi người dùng yêu cầu tường minh/.test(gw),
      'AC4.2: git-workflow — hỏi một lần trước khi tạo worktree, bỏ câu "chỉ khi yêu cầu tường minh"');
    ok(gw.includes('.claude/worktrees/'), 'AC4.2: git-workflow — giữ quy ước .claude/worktrees/');
    const bc = fs.readFileSync(path.join(REPO_ROOT, 'core', 'skills', 'git-workflow', 'references', 'branch-convention.md'), 'utf8').replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
    ok(/hỏi người dùng một lần trước khi tạo/i.test(bc) && bc.includes('.claude/worktrees/') && !/worktree trừ khi người dùng yêu cầu tường minh/.test(bc),
      'AC4.2: branch-convention — mục worktree khớp SKILL (hỏi một lần, .claude/worktrees/), không còn "trừ khi yêu cầu tường minh"');
    ok(gw.includes('plan-execution/references/finish.md'), 'AC4.2: git-workflow — mục kết thúc nhánh trỏ plan-execution/references/finish.md');
    ok(/không push khi chưa xác nhận branch/.test(gw) && /Co-Authored-By/.test(gw) && /commit -F/.test(gw), 'AC4.1: git-workflow — giữ ranh giới push/Co-Authored-By/commit -F');
  }

  // AC5.1–AC5.5: workflow-bugfix Bước 3–6 (kỹ thuật điều tra, trần số lần sửa thất bại) — vẫn đúng 9 bước
  {
    const bfDir = path.join(REPO_ROOT, 'workflows', 'bugfix');
    const wf = fs.readFileSync(path.join(bfDir, 'WORKFLOW.md'), 'utf8').replace(/\r\n/g, '\n');
    const matrix = fs.readFileSync(path.join(bfDir, 'references', 'error-matrix.md'), 'utf8').replace(/\r\n/g, '\n');
    const flatB = (t) => t.replace(/\s+/g, ' ');
    const secs = wf.split(/^### Bước /m).slice(1).map((s) => ({ head: s.split('\n')[0], body: s }));
    const field = (n, name) => flatB((secs[n - 1].body.split(`- **${name}:**`)[1] || '').split(/\n- \*\*/)[0]);
    ok(secs.length === 9, 'AC5.1: workflow-bugfix vẫn đúng 9 bước');

    // AC5.1: Bước 3 — thử script/test trước khi chấp nhận tái hiện thủ công
    ok(/thử viết (script|test)[^.;]*một lần/.test(field(3, 'Hành động')) && /phương án cuối/.test(field(3, 'Hành động')) && /lý do/.test(field(3, 'Hành động')),
      'AC5.1: Bước 3 — thử viết script/test một lần trước; tái hiện thủ công là phương án cuối kèm lý do');
    ok(/chờ theo điều kiện/.test(field(3, 'Ràng buộc')) && /sleep cứng/.test(field(3, 'Ràng buộc')),
      'AC5.1: Bước 3 — bug race/timing chờ theo điều kiện, không sleep cứng');

    // AC5.1, AC5.2: Bước 4 — thay đổi gần đây, code tương tự đang đúng, log tạm có mốc và gate diff sạch
    const a4 = field(4, 'Hành động');
    ok(/git log/.test(a4) && /git diff/.test(a4) && /thay đổi gần đây/.test(a4) && /dependency/.test(a4) && /config/.test(a4),
      'AC5.1: Bước 4 — xem thay đổi gần đây của vùng nghi ngờ (git log/git diff, dependency, config) làm một loại evidence');
    ok(/code tương tự đang chạy đúng/.test(a4) && /khác biệt/.test(a4) && /lý do không có/.test(a4),
      'AC5.1: Bước 4 — tìm code tương tự đang chạy đúng, nêu khác biệt hoặc ghi lý do không có');
    ok(/log tạm/.test(a4) && a4.includes('git status --porcelain') && /đầu bước/.test(a4) && /gỡ hết/.test(a4),
      'AC5.2: Bước 4 — log tạm chỉ khi ghi mốc git status --porcelain đầu bước và gỡ hết trước Bước 5');
    ok(/diff sạch so với mốc đầu bước/.test(field(4, 'Gate')) && /≥1 evidence/.test(field(4, 'Gate')),
      'AC5.2: Gate Bước 4 — diff sạch so với mốc đầu bước, vẫn ≥1 evidence');
    ok(/mốc/.test(field(4, 'Evidence')) && /thay đổi gần đây/.test(field(4, 'Evidence')), 'AC5.2: Evidence Bước 4 ghi mốc và thay đổi gần đây');

    // AC5.5: Bước 5 — giả thuyết + cách kiểm, truy ngược tới nguồn, đối chiếu lý do đỏ với root cause
    const a5 = field(5, 'Hành động');
    ok(/giả thuyết/.test(a5) && /cách kiểm/.test(a5), 'AC5.5: Bước 5 — ghi một giả thuyết kèm cách kiểm');
    ok(/truy ngược/.test(a5) && /nguồn/.test(a5) && /gồm nguồn/.test(field(5, 'Đầu ra')),
      'AC5.5: Bước 5 — truy ngược từ chỗ nổ lỗi tới nguồn; danh sách file gồm nguồn, không chỉ chỗ nổ');
    ok(/lý do đỏ/.test(a5) && /root cause/.test(a5) && /quay lại Bước 3/.test(field(5, 'Khi fail')),
      'AC5.5: Bước 5 — đối chiếu lý do đỏ của test Bước 3 với root cause; lệch thì quay lại Bước 3');
    ok(/lý do đỏ/.test(field(5, 'Gate')), 'AC5.5: Gate Bước 5 có đối chiếu lý do đỏ');

    // AC5.3, AC5.4: Bước 6 — bộ đếm tổng 3 lần, revert, một thay đổi mỗi lần, session chính chạy lại oracle
    const f6 = field(6, 'Khi fail'), a6 = field(6, 'Hành động'), g6 = field(6, 'Gate');
    ok(/tổng[^.;]*3 lần sửa thất bại/.test(f6) && /6→5/.test(f6) && /7→6/.test(f6) && /8→6/.test(f6) && /ask_user/.test(f6) && /kiến trúc/.test(f6),
      'AC5.3: Bước 6 — tổng 3 lần sửa thất bại (qua 6→5, 7→6, 8→6) → ask_user kèm câu hỏi kiến trúc');
    ok(/coupling/.test(f6) && /shared state/.test(f6) && /refactor/.test(f6), 'AC5.3: câu hỏi kiến trúc nhắc coupling/shared state/refactor lớn');
    ok(/revert/.test(f6) && /một thay đổi/.test(a6), 'AC5.3: Bước 6 — bản sửa hỏng phải revert trước khi thử lại; mỗi lần một thay đổi');
    ok(/tự chạy lại/.test(g6) && /oracle/.test(g6) && /Bước 3/.test(g6) && /exit code/.test(g6) && /không chỉ tin report/.test(g6),
      'AC5.4: Gate Bước 6 — session chính tự chạy lại lệnh oracle của Bước 3 và ghi exit code, không chỉ tin report fixer');
    ok(/exit code/.test(field(6, 'Evidence')) && /session chính/.test(field(6, 'Evidence')), 'AC5.4: Evidence Bước 6 có exit code do session chính chạy lại');

    // graph: cạnh ask_user cho tổng 3 lần, cạnh Bước 5 → Bước 3, giữ max_attempts cũ, qua checkGraph/checkGraphAgainstBody
    const wfLib = await import(pathToFileURL(path.join(REPO_ROOT, 'cli', 'lib', 'workflows.mjs')).href);
    const g = JSON.parse(fs.readFileSync(path.join(bfDir, 'graph.json'), 'utf8'));
    const byId = Object.fromEntries(g.steps.map((s) => [s.id, s]));
    ok(g.steps.length === 9, 'AC5.3: graph bugfix vẫn 9 bước');
    ok(wfLib.checkGraph(g).length === 0 && wfLib.checkGraphAgainstBody(g, wf).length === 0, 'AC5.3: graph bugfix qua checkGraph và checkGraphAgainstBody');
    const askFix = (byId.fix?.on_fail || []).filter((f) => f.to === 'ask_user');
    ok(askFix.some((f) => /3 lần/.test(f.when) && /kiến trúc/.test(f.when)), 'AC5.3: graph Bước 6 có cạnh ask_user cho tổng 3 lần sửa thất bại');
    const edge = (from, to) => (byId[from]?.on_fail || []).find((f) => f.to === to);
    ok(edge('fix', 'root-cause')?.max_attempts === 2 && edge('regression', 'fix')?.max_attempts === 2 && edge('review', 'fix')?.max_attempts === 2,
      'AC5.3: giữ max_attempts 2 của các cạnh lùi về Bước 6 và 5');
    ok(edge('root-cause', 'reproduce')?.max_attempts === 2, 'AC5.5: graph có cạnh Bước 5 → Bước 3 (lý do đỏ lệch root cause) với max_attempts 2');

    // AC5.2–AC5.5: bảng xử lý lỗi + error-matrix có 4 hàng mới
    const tableRows = (t) => t.split('\n').filter((l) => l.startsWith('|'));
    for (const [name, text] of [['WORKFLOW.md', wf], ['error-matrix.md', matrix]]) {
      const rows = tableRows(text).map(flatB);
      const has = (re) => rows.some((r) => re.test(r));
      ok(has(/lần sửa thứ 3[^|]*\|[^|]*ask_user[^|]*kiến trúc/i), `AC5.3: ${name} — hàng lần sửa thứ 3 thất bại → ask_user kiến trúc`);
      ok(has(/log tạm chưa gỡ[^|]*\|[^|]*gỡ/i), `AC5.2: ${name} — hàng log tạm chưa gỡ`);
      ok(has(/lệch root cause[^|]*\|[^|]*Bước 3/), `AC5.5: ${name} — hàng test đỏ lệch root cause → Bước 3`);
      ok(has(/race|timing/) && has(/chờ theo điều kiện/), `AC5.1: ${name} — hàng bug race/timing chờ theo điều kiện`);
    }
    ok(wf.includes('superpowers:brainstorming'), 'AC5.1: dòng Superpowers ở Điều kiện tiên quyết còn nguyên (Task 23 xử lý)');
  }

  // AC5.3: *-fix + *-fixer — một thay đổi mỗi lượt, revert bản sửa hỏng trước khi thử lại, báo số lần thử + giả thuyết; danh sách che triệu chứng và F1–F5 giữ nguyên
  {
    const rd = (...p) => fs.readFileSync(path.join(REPO_ROOT, 'plugins', ...p), 'utf8').replace(/\r\n/g, '\n');
    const flat = (t) => t.replace(/\s+/g, ' ');
    const symptoms = {
      backend: ['@SuppressWarnings', '@Disabled', 'pytest.skip', 'xfail', 'nới timeout/retry', 'except: pass'],
      frontend: ['@ts-ignore', 'eslint-disable', '(`-u`)', 'it.skip', 'nới `waitFor` timeout', 'key={index}'],
    };
    for (const p of ['backend', 'frontend']) {
      const rawSkill = rd(p, 'skills', `${p}-fix`, 'SKILL.md');
      const s = flat(rawSkill);
      const a = flat(rd(p, 'agents', `${p}-fixer.md`));
      for (const [n, t] of [[`${p}-fix`, s], [`${p}-fixer`, a]]) {
        ok(/một thay đổi mỗi lượt/i.test(t) && /giả thuyết/.test(t), `AC5.3: ${n} — một thay đổi mỗi lượt, gắn với một giả thuyết`);
        ok(/revert bản sửa hỏng trước khi thử lại/i.test(t) && /(?:không|KHÔNG) dùng `git reset --hard`/.test(t) && /file test đã bẩn[^.]*giữ nguyên/.test(t),
          `AC5.3: ${n} — revert bản sửa hỏng trước khi thử lại, chỉ phần của bản sửa, không git reset --hard, giữ file test đã bẩn`);
        ok(/số lần thử/.test(t) && /giả thuyết đang kiểm/.test(t), `AC5.3: ${n} — báo số lần thử và giả thuyết đang kiểm`);
      }
      ok(/chế độ `performance`[^.]*một thay đổi tối ưu/.test(s), `AC5.3: ${p}-fix — chế độ performance: một thay đổi tối ưu mỗi lượt`);
      ok(/`summary`/.test(a) && /remaining_risks/.test(a) && /không thêm trường/.test(a),
        `AC5.3: ${p}-fixer — số lần thử + giả thuyết đặt vào summary/remaining_risks của agent_result, không thêm trường contract`);
      for (const sym of symptoms[p]) ok(rawSkill.includes(sym), `AC5.3: ${p}-fix — danh sách che triệu chứng giữ nguyên "${sym}"`);
      for (const g of ['F1', 'F2', 'F3', 'F4', 'F5']) ok(rawSkill.includes(`| ${g} `), `AC5.3: ${p}-fix — bảng gate giữ ${g}`);
    }
  }
}
