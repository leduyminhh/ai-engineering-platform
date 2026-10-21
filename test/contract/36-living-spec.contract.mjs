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

  // parseImpact: heading con (H3+) nằm trong mục, không cắt các mục sau.
  ok(parse('## Ảnh hưởng spec\n- a: thêm R1\n### Ghi chú\n- b: đổi R2\n## Khác\n- c: thêm R3\n').entries.map((e) => e.cap).join() === 'a,b',
    'AC3.1: parseImpact — heading H3 trong mục không làm rơi mục sau');

  const spec = (...rows) => ['# Spec: x', '', '## Yêu cầu', '', ...rows, '', '## Lịch sử', ''].join('\n');
  const REQ = (id) => `- **${id}** — hành vi. Nguồn: [s](../../requests/s/design.md) (thêm)`;
  const DEL = (id) => `- ~~**${id}** — đã dừng~~ đã bỏ bởi [s](../../requests/s/design.md)`;

  // parseSpec: một hành vi, nhiều đầu vào.
  {
    const ps = (t, f = 'x') => {
      const r = cr.parseSpec(t, f);
      return { reqs: [...r.reqs].map(([k, v]) => `${k}:${v.line}:${v.removed}`), problems: r.problems.length };
    };
    const good = ps(spec(REQ('x/R1'), DEL('x/R2')));
    ok(JSON.stringify(good.reqs) === JSON.stringify(['x/R1:5:false', 'x/R2:6:true']) && good.problems === 0, 'AC3.5: parseSpec đọc yêu cầu thường và yêu cầu đã bỏ');
    ok(ps(spec(REQ('x/R1'), REQ('x/R1'))).problems === 1, 'AC3.5: parseSpec báo ID trùng');
    ok(ps(spec(REQ('X/r1'))).problems === 1, 'AC3.5: parseSpec báo ID sai định dạng');
    ok(ps(spec(REQ('y/R1'))).problems === 1, 'AC3.5: parseSpec báo tiền tố khác tên thư mục');
    ok(ps('# S\n\nCập nhật: 2026-10-21\n' + spec(REQ('x/R1'))).problems === 0, 'AC3.5: parseSpec bỏ qua dòng lạ như Cập nhật');
    ok(ps('# S\n## Khác\n- **zzz** — x\n## Yêu cầu\n' + REQ('x/R1') + '\n').problems === 0, 'AC3.5: parseSpec chỉ đọc vùng H2 Yêu cầu');
    const plain = spec(REQ('x/R1'), DEL('x/R2'));
    ok(JSON.stringify(ps('﻿' + plain.replace(/\n/g, '\r\n'))) === JSON.stringify(ps(plain)), 'AC3.3: spec CRLF và BOM parse như LF');
    const l = cr.parseSpec('[a](a.md) [b](http://e.com) [c](#x) [d](../d.md#f)\n', 'x').links.map((k) => k.href);
    ok(JSON.stringify(l) === JSON.stringify(['a.md', '../d.md#f']), 'AC3.5: parseSpec chỉ lấy link tương đối');
  }

  // W11/W12/W14 qua checkRequest.
  {
    const design = (...imp) => ['# Thiết kế', '## Tiêu chí chấp nhận', '- [ ] **AC1.1** — a', '', '## Ảnh hưởng spec', ...imp, ''].join('\n');
    const run = (imp, specs, extra = {}) => {
      const reads = [];
      const w = cr.checkRequest({ 'design.md': design(...imp) }, {
        readSpec: (cap) => { reads.push(cap); const t = specs[cap]; return t === undefined ? null : t; }, ...extra,
      }).filter((x) => ['W11', 'W12', 'W14'].includes(x.code));
      return { w, reads };
    };
    const codes = (r) => r.w.map((x) => x.code).join();
    const S = { x: spec(REQ('x/R1'), REQ('x/R10'), DEL('x/R2')) };

    const missing = run(['- x: đổi R1'], {});
    ok(codes(missing) === 'W11' && missing.w[0].line === 6, 'AC3.2: năng lực không có spec → W11');
    for (const bad of ['../x', 'a/b', 'a\\b', 'X', '-a', 'Không ảnh hưởng', '..']) {
      const r = run([`- ${bad}: đổi R1`], { [bad]: S.x });
      ok(codes(r) === 'W11' && r.reads.length === 0, `AC3.2: tên "${bad}" → W11 và không gọi readSpec`);
    }
    ok(run(['- x: đổi R1'], S).w.length === 0, 'AC3.3: đổi R1 có trong spec → không cảnh báo');
    ok(codes(run(['- x: đổi R3'], S)) === 'W12', 'AC3.3: đổi R3 không có trong spec → W12');
    ok(codes(run(['- x: bỏ R3'], S)) === 'W12', 'AC3.3: bỏ R3 không có trong spec → W12');
    ok(codes(run(['- x: bỏ R1'], S)) === 'W12', 'AC3.3: bỏ R1 chưa đánh dấu đã bỏ → W12');
    ok(run(['- x: bỏ R2'], S).w.length === 0, 'AC3.3: bỏ R2 đã đánh dấu đã bỏ → không cảnh báo');
    ok(codes(run(['- x: đổi R1'], { x: spec(REQ('x/R10')) })) === 'W12', 'AC3.3: đổi R1 khi spec chỉ có x/R10 → W12 (không khớp tiền tố)');
    ok(run(['- x: thêm R9'], S).w.length === 0, 'AC3.3: thêm R9 không kiểm tồn tại');
    ok(codes(run(['- x: đổi R1, đổi R7, bỏ R8'], S)) === 'W12,W12', 'AC3.3: mỗi mục sai một W12');

    const bad = run(['- x: thêm R1', '- x: thêm R2'], { x: spec(REQ('x/R1'), REQ('x/R1'), REQ('y/R2'), REQ('X/r3')) });
    ok(codes(bad) === 'W14,W14,W14' && bad.reads.length === 1, 'AC3.5: mỗi problem một W14, spec đọc và kiểm một lần dù nhiều mục');
    const withLink = (href) => spec(REQ('x/R1')) + `| d | [s](${href}) | x/R1 | thêm |\n`;
    const checked = [];
    const linkExists = (href, cap) => { checked.push(`${href}@${cap}`); return href !== 'dead.md'; };
    ok(codes(run(['- x: thêm R1'], { x: withLink('dead.md') }, { linkExists })) === 'W14', 'AC3.5: link Lịch sử không tồn tại → W14');
    ok(run(['- x: thêm R1'], { x: withLink('ok.md#frag') }, { linkExists }).w.length === 0, 'AC3.5: link tồn tại → không W14');
    ok(checked.includes('dead.md@x'), 'AC3.5: linkExists nhận cả năng lực để resolve theo thư mục spec');
    ok(run(['- x: thêm R1'], { x: withLink('dead.md') }).w.length === 0, 'AC3.5: không cấp linkExists → bỏ qua kiểm link');
  }

  // CLI end-to-end: main đọc specs ở ../../specs của thư mục request.
  {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'living-'));
    try {
      const req = path.join(tmp, 'docs', 'requests', 'r1');
      fs.mkdirSync(req, { recursive: true });
      fs.mkdirSync(path.join(tmp, 'docs', 'specs', 'x'), { recursive: true });
      fs.writeFileSync(path.join(req, 'design.md'), '# D\n## Tiêu chí chấp nhận\n- [ ] **AC1.1** — a\n## Ảnh hưởng spec\n- x: đổi R5\n- y: thêm R1\n');
      fs.writeFileSync(path.join(tmp, 'docs', 'specs', 'x', 'spec.md'), spec(REQ('x/R1')) + '| d | [s](../../requests/gone/design.md) | x/R1 | thêm |\n');
      const lines = [];
      const orig = console.log;
      console.log = (m) => lines.push(String(m));
      try { cr.main([req]); } finally { console.log = orig; }
      const out = lines.join('\n');
      ok(/\[W12\]/.test(out) && /\[W11\]/.test(out) && /\[W14\]/.test(out) && !/W10/.test(out), 'AC3.2: CLI đọc specs tại ../../specs (W11 cho y, W12 và W14 cho x)');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
}
