// Pin: chuẩn tài liệu superpowers (docs/requests/2026-10-20-superpowers-docs-standard). Task 1: script check-request.mjs (AC4.1–AC4.3).
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
}
