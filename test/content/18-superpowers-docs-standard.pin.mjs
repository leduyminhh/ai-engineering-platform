// Pin: chuẩn tài liệu superpowers (docs/requests/2026-10-20-superpowers-docs-standard). Task 1: script check-request.mjs (AC4.1–AC4.3). Task 2: baseline (AC1.1–AC1.4). Task 3: skill engineering (AC3.1, AC3.3). Task 4: workflow (AC3.2).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, pathToFileURL } = ctx;

  // AC4.1–AC4.3: script kiểm thư mục request trong skill core artifact-templates
  {
    const scriptPath = path.join(REPO_ROOT, 'core', 'skills', 'artifact-templates', 'scripts', 'check-request.mjs');
    ok(fs.existsSync(scriptPath), 'check-request: có core/skills/artifact-templates/scripts/check-request.mjs');
    const cr = fs.existsSync(scriptPath) ? await import(pathToFileURL(scriptPath).href) : null;
    if (cr) {
      const OK = {
        'design.md': [
          '# Thiết kế: demo',
          '## 3. Tiêu chí chấp nhận',
          '- [ ] **AC1.1** — Given a When b Then c',
          '- [ ] **AC1.2** — Given c When d Then e',
          '```markdown',
          '- [ ] **AC1.1** — mẫu trong khối code, phải bị bỏ qua',
          '```',
          '## 4. Thiết kế',
          'nội dung',
          '',
        ].join('\n'),
        'plan.md': [
          '# Plan',
          '**Goal:** x',
          '**Spec:** design.md',
          '**Phủ AC:** AC1.1',
          '**Phủ AC:** AC1.2',
          '',
        ].join('\n'),
      };
      const codes = (t) => cr.checkRequest(t).map((w) => w.code).sort().join(',');
      ok(codes(OK) === '', 'AC4.1: thư mục hợp lệ → 0 cảnh báo');
      const cases = [
        ['W1', { 'plan.md': OK['plan.md'] }],
        ['W2', { ...OK, 'requirement.md': '## Tiêu chí chấp nhận\n- [ ] **AC1.1** — Given a When b Then c\n' }],
        ['W3', { ...OK, 'design.md': OK['design.md'].replace('**AC1.2**', '**AC1.1**') }],
        ['W4', { ...OK, 'design.md': OK['design.md'].replace('**AC1.2**', '**AC-2**') }],
        ['W5', { ...OK, 'plan.md': OK['plan.md'].replace('**Goal:** x', '') }],
        ['W6', { ...OK, 'plan.md': OK['plan.md'].replace('**Phủ AC:** AC1.2', '') }],
        ['', { ...OK, 'design.md': '﻿' + OK['design.md'].replace(/\n/g, '\r\n') }],
        ['', { ...OK, 'design.md': OK['design.md'].normalize('NFD') }],
        ['', { 'design.md': OK['design.md'] }],
      ];
      for (const [want, t] of cases) {
        ok(codes(t).includes(want) && (want || codes(t) === ''), `AC4.2: ${want || 'biến thể sạch'} đúng`);
      }
      const w6 = cr.checkRequest(cases[5][1]).find((w) => w.code === 'W6');
      ok(!!w6 && w6.file === 'design.md' && w6.line === 4, 'AC4.2: W6 trỏ đúng file:dòng của AC (design.md:4)');

      const quiet = (fn) => {
        const log = console.log;
        const err = console.error;
        console.log = () => {};
        console.error = () => {};
        try { return fn(); } finally { console.log = log; console.error = err; }
      };
      ok(quiet(() => cr.main([])) === 2, 'AC4.3: không đối số → exit 2');
      ok(quiet(() => cr.main([path.join(REPO_ROOT, 'không-tồn-tại-xyz')])) === 2, 'AC4.3: đường dẫn không tồn tại → exit 2');
      ok(quiet(() => cr.main([scriptPath])) === 2, 'AC4.3: đường dẫn là file, không phải thư mục → exit 2');

      const tmp = fs.mkdtempSync(path.join(ctx.os.tmpdir(), 'check-request-'));
      try {
        fs.writeFileSync(path.join(tmp, 'design.md'), OK['design.md']);
        fs.writeFileSync(path.join(tmp, 'plan.md'), OK['plan.md']);
        ok(quiet(() => cr.main([tmp])) === 0, 'AC4.1: main(thư mục hợp lệ) → exit 0');
        fs.writeFileSync(path.join(tmp, 'plan.md'), OK['plan.md'].replace('**Phủ AC:** AC1.2', ''));
        ok(quiet(() => cr.main([tmp])) === 0, 'AC4.2: main(thư mục có cảnh báo) vẫn exit 0');
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }
  }

  // AC1.1–AC1.4, P1/P3: baseline (mục Superpowers workflow defaults) ghi đè vị trí docs, quy ước AC, bộ nhớ, resume
  {
    const tpl = fs.readFileSync(path.join(REPO_ROOT, 'core', 'agents', 'AGENTS.template.md'), 'utf8');
    const sp = tpl.slice(tpl.indexOf('### Superpowers workflow defaults'), tpl.indexOf('### Language'));
    ok(sp.includes('docs/requests/<yyyy-mm-dd>-<slug>/design.md') && sp.includes('`plan.md` in the same folder')
      && sp.includes('overrides the superpowers default `docs/superpowers/`'), 'AC1.1: baseline ghi đè vị trí docs');
    ok(sp.includes('`AC<n>.<m>`') && sp.includes('Given/When/Then') && sp.includes('`Tiêu chí chấp nhận`')
      && sp.includes('`requirement.md` if it exists, otherwise in') && sp.includes('`**Phủ AC:**`') && sp.includes('`Không đổi`'), 'AC1.2: baseline có quy ước AC');
    ok(sp.includes('| Short-term |') && sp.includes('| Long-term |') && sp.includes('first unchecked task')
      && sp.includes('never create a second folder'), 'AC1.4: baseline có bảng bộ nhớ + quy tắc resume');
    ok(sp.includes('only when it contains `design.md`') && sp.includes('`artifact-templates`')
      && sp.includes('check-request.mjs docs/requests/<yyyy-mm-dd>-<slug>/'), 'P1/P3: baseline trỏ template core + script kiểm tra');
  }

  // AC3.1, AC3.3: skill engineering dùng ID AC, không dựng khung plan.md; task-breakdown dùng lại ID của nguồn
  {
    const ENG = path.join(REPO_ROOT, 'plugins', 'engineering');
    const SW = path.join(ENG, 'skills', 'engineering-spec-writing');
    const r = (p) => fs.readFileSync(p, 'utf8');
    const analyst = path.join(ENG, 'agents', 'engineering-spec-analyst.md');
    ok(r(path.join(SW, 'SKILL.md')).includes('`AC<n>.<m>`') && r(path.join(SW, 'SKILL.md')).includes('check-request.mjs'),
      'AC3.1: spec-writing dùng ID AC + gọi check-request');
    for (const p of [path.join(SW, 'SKILL.md'), path.join(SW, 'references', 'checklist.md'), analyst]) {
      ok(!r(p).includes('khung `plan.md`'), `AC3.1: ${path.basename(p)} không còn dựng khung plan.md`);
    }
    ok(r(analyst).includes('design.md'), 'AC3.1: spec-analyst liệt kê design.md');
    ok(r(path.join(SW, 'references', 'spec-structure.md')).includes('`^AC\\d+\\.\\d+$`'),
      'AC3.1: spec-structure ghi đúng regex ID AC (không mất backslash)');
    const TB = path.join(ENG, 'skills', 'engineering-task-breakdown');
    ok(r(path.join(TB, 'references', 'breakdown-checklist.md')).includes('tự đánh `AC<uc>.<n>` chỉ khi nguồn chưa có ID'),
      'AC3.3: breakdown-checklist không mâu thuẫn với việc dùng lại ID nguồn');
    ok(r(path.join(TB, 'references', 'analysis.md')).includes('dùng lại nguyên ID'), 'AC3.3: dùng lại ID AC của nguồn');
    ok(/không có `requirement\.md`.*`design\.md`/s.test(r(path.join(TB, 'SKILL.md'))),
      'AC3.3: đọc AC từ design.md khi không có requirement.md');
  }

  // AC3.2: workflow feature/bugfix/orchestrator nêu nhánh superpowers (D1) trong điều kiện tiên quyết
  for (const wf of ['feature', 'bugfix', 'orchestrator']) {
    const t = fs.readFileSync(path.join(REPO_ROOT, 'workflows', wf, 'WORKFLOW.md'), 'utf8');
    const i = t.indexOf('## Điều kiện tiên quyết');
    const pre = t.slice(i, t.indexOf('\n## ', i + 5));
    ok(pre.includes('superpowers:brainstorming') && pre.includes('docs/requests/') && pre.includes('trừ khi người dùng chỉ định rõ'),
      `AC3.2: ${wf} nêu nhánh superpowers (định nghĩa "đã cài" + ngoại lệ người dùng chỉ định) trong điều kiện tiên quyết`);
  }
  // AC3.2: orchestrator thực sự route sang superpowers ở Bước 1 (bảng skill trực tiếp xét trước Registry + ngoại lệ tie-break), không chỉ nêu ở điều kiện tiên quyết
  {
    const o = fs.readFileSync(path.join(REPO_ROOT, 'workflows', 'orchestrator', 'WORKFLOW.md'), 'utf8').replace(/\s+/g, ' ');
    const direct = o.split('## Yêu cầu chạy trực tiếp bằng skill')[1]?.split('## Các bước')[0] ?? '';
    const step1 = o.split('### Bước 1')[1]?.split('### Bước 2')[0] ?? '';
    ok(/\| [^|]*xét TRƯỚC Registry[^|]*\| `superpowers:brainstorming`/.test(direct) && direct.includes('danh sách skill khả dụng'),
      'AC3.2: bảng skill trực tiếp có dòng superpowers:brainstorming (xét trước Registry, điều kiện đã cài)');
    ok(step1.includes('dòng `superpowers:brainstorming` ở mục "Yêu cầu chạy trực tiếp bằng skill"') && step1.includes('ngoài tín hiệu sự cố và dòng `superpowers:brainstorming`'),
      'AC3.2: Bước 1 xét dòng superpowers trước Registry và loại khỏi tie-break ưu tiên Registry');
  }
}
