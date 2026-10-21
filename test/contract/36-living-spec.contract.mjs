// Contract spec sống: parseImpact (mục "Ảnh hưởng spec" của design.md) và cảnh báo W10 của check-request.mjs.
export default async function run({ ok, ctx }) {
  const { path, pathToFileURL, CORE_DIR } = ctx;
  const cr = await import(pathToFileURL(path.join(CORE_DIR, 'skills', 'artifact-templates', 'scripts', 'check-request.mjs')).href);
  const parse = (text) => cr.parseImpact(cr.linesOf(text));

  // parseImpact: một hành vi, nhiều đầu vào.
  {
    const cases = [
      {
        name: 'dòng mục thường',
        text: '# D\n## Ảnh hưởng spec\n- hooks-gates: thêm R12, đổi R3\n',
        want: { found: true, line: 2, none: null, entries: [{ cap: 'hooks-gates', items: [{ action: 'thêm', n: 12 }, { action: 'đổi', n: 3 }], line: 3 }] },
      },
      {
        name: 'Không ảnh hưởng kèm lý do',
        text: '## Ảnh hưởng spec\nKhông ảnh hưởng: chỉ sửa docs\n',
        want: { found: true, line: 1, none: { reason: 'chỉ sửa docs' }, entries: [] },
      },
      {
        name: 'Không ảnh hưởng rỗng lý do',
        text: '## Ảnh hưởng spec\nKhông ảnh hưởng:\n',
        want: { found: true, line: 1, none: { reason: '' }, entries: [] },
      },
      {
        name: 'mục trong code fence bị bỏ qua',
        text: '# D\n```\n## Ảnh hưởng spec\n- a: thêm R1\n```\n',
        want: { found: false, line: 0, none: null, entries: [] },
      },
      {
        name: 'không có heading',
        text: '# D\n## Thiết kế\n- a: thêm R1\n',
        want: { found: false, line: 0, none: null, entries: [] },
      },
      {
        name: 'heading không phân biệt hoa thường, dừng ở heading kế',
        text: '## ẢNH HƯỞNG SPEC\n- a: bỏ R2\n## Khác\n- b: thêm R9\n',
        want: { found: true, line: 1, none: null, entries: [{ cap: 'a', items: [{ action: 'bỏ', n: 2 }], line: 2 }] },
      },
    ];
    for (const c of cases) {
      ok(JSON.stringify(parse(c.text)) === JSON.stringify(c.want), `AC3.1: parseImpact — ${c.name}`);
    }
  }

  // W10: chỉ chạy khi caller cấp readSpec.
  {
    const base = ['# Thiết kế', '## Tiêu chí chấp nhận', '- [ ] **AC1.1** — Given a When b Then c', ''];
    const w10 = (extra, opts = { readSpec: () => null }) =>
      cr.checkRequest({ 'design.md': [...base, ...extra].join('\n') }, opts).filter((w) => w.code === 'W10');

    const missing = w10([]);
    ok(missing.length === 1 && missing[0].file === 'design.md' && missing[0].line === 1, 'AC3.1: design thiếu mục → đúng một W10 tại dòng 1');
    ok(w10(['## Ảnh hưởng spec', 'Không ảnh hưởng: x']).length === 0, 'AC3.1: Không ảnh hưởng có lý do → không W10');
    const empty = w10(['## Ảnh hưởng spec', 'Không ảnh hưởng:']);
    ok(empty.length === 1 && empty[0].line === 5, 'AC3.1: Không ảnh hưởng rỗng lý do → W10 tại dòng heading');
    ok(w10(['## Ảnh hưởng spec', '- a: thêm R1']).length === 0, 'AC3.1: có mục hợp lệ → không W10');
    ok(w10([], {}).length === 0, 'AC3.1: không cấp readSpec → không W10');
    ok(cr.checkRequest({ 'plan.md': '# P\n' }, { readSpec: () => null }).every((w) => w.code !== 'W10'),
      'AC3.1: không có design.md → không W10');
  }
}
