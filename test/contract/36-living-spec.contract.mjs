// Contract spec sống: parseImpact, parseSpec, cảnh báo W10–W14 và tuỳ chọn --base của check-request.mjs.
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
        name: 'tên năng lực bọc backtick',
        text: '## Ảnh hưởng spec\n- `hooks-gates`: thêm R1\n',
        want: { found: true, line: 1, none: null, entries: [{ cap: 'hooks-gates', items: [{ action: 'thêm', n: 1 }], line: 2 }] },
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
    ok(ps(spec(REQ('x/R01'))).problems === 1, 'AC3.5: parseSpec báo ID có số 0 đứng đầu');
    ok(ps(spec(REQ('y/R1'))).problems === 1, 'AC3.5: parseSpec báo tiền tố khác tên thư mục');
    ok(ps('# S\n\nCập nhật: 2026-10-21\n' + spec(REQ('x/R1'))).problems === 0, 'AC3.5: parseSpec bỏ qua dòng lạ như Cập nhật');
    ok(ps('# S\n## Khác\n- **zzz** — x\n## Yêu cầu\n' + REQ('x/R1') + '\n').problems === 0, 'AC3.5: parseSpec chỉ đọc vùng H2 Yêu cầu');
    const plain = spec(REQ('x/R1'), DEL('x/R2'));
    ok(JSON.stringify(ps('﻿' + plain.replace(/\n/g, '\r\n'))) === JSON.stringify(ps(plain)), 'AC3.5: spec CRLF và BOM parse như LF');
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

  // W13 qua checkRequest: changedSpecs là Set tên năng lực đã đổi kể từ base ref; null = không chạy.
  {
    const design = (...imp) => ['# D', '## Tiêu chí chấp nhận', '- [ ] **AC1.1** — a', '', '## Ảnh hưởng spec', ...imp, ''].join('\n');
    const w13 = (imp, changedSpecs) => cr.checkRequest({ 'design.md': design(...imp) }, {
      readSpec: (cap) => spec(REQ(`${cap}/R1`)), changedSpecs,
    }).filter((w) => w.code === 'W13');
    const cases = [
      { name: 'set rỗng, đổi R1 → W13', imp: ['- x: đổi R1'], set: new Set(), want: 1 },
      { name: 'set có x → không W13', imp: ['- x: đổi R1'], set: new Set(['x']), want: 0 },
      { name: 'null → không W13', imp: ['- x: đổi R1'], set: null, want: 0 },
      { name: 'undefined → không W13', imp: ['- x: đổi R1'], set: undefined, want: 0 },
      { name: 'Không ảnh hưởng → không W13', imp: ['Không ảnh hưởng: docs'], set: new Set(), want: 0 },
      { name: 'cùng năng lực ở hai dòng → một W13', imp: ['- x: đổi R1', '- x: đổi R1'], set: new Set(), want: 1 },
      { name: 'hai mục, một đã đổi → một W13', imp: ['- x: đổi R1', '- y: đổi R1'], set: new Set(['x']), want: 1 },
    ];
    for (const c of cases) ok(w13(c.imp, c.set).length === c.want, `AC3.4: W13 — ${c.name}`);
    const one = w13(['- x: đổi R1', '- y: đổi R1'], new Set(['x']))[0];
    ok(one && one.file === 'design.md' && one.line === 7 && one.msg.includes('y'), 'AC3.4: W13 nêu đúng dòng và năng lực chưa đổi');
  }

  // W13 qua CLI trong repo git tạm.
  {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const { execFileSync } = await import('node:child_process');
    const git = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: 'pipe' });
    const runMain = (argv) => {
      const lines = [];
      const [log, err] = [console.log, console.error];
      console.log = (m) => lines.push(String(m));
      console.error = () => {};
      let code;
      try { code = cr.main(argv); } finally { console.log = log; console.error = err; }
      return { code, out: lines.join('\n') };
    };
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'living-git-'));
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'living-nogit-'));
    try {
      const setup = (root) => {
        const req = path.join(root, 'docs', 'requests', 'r1');
        for (const c of ['x', 'y']) fs.mkdirSync(path.join(root, 'docs', 'specs', c), { recursive: true });
        fs.mkdirSync(req, { recursive: true });
        fs.writeFileSync(path.join(req, 'design.md'), '# D\n## Tiêu chí chấp nhận\n- [ ] **AC1.1** — a\n## Ảnh hưởng spec\n- x: đổi R1\n');
        fs.writeFileSync(path.join(root, 'docs', 'specs', 'x', 'spec.md'), spec(REQ('x/R1')));
        return req;
      };
      const req = setup(tmp);
      git(tmp, 'init', '-q');
      git(tmp, 'config', 'user.name', 'T');
      git(tmp, 'config', 'user.email', 't@example.com');
      git(tmp, 'config', 'commit.gpgsign', 'false');
      git(tmp, 'add', '-A');
      git(tmp, 'commit', '-q', '-m', 'init');
      const w13 = (argv) => /\[W13\]/.test(runMain(argv).out);

      ok(w13([req, '--base', 'HEAD']), 'AC3.4: CLI --base HEAD, spec không đổi → W13');
      ok(!w13([req]), 'AC3.4: CLI không --base → không W13');
      fs.appendFileSync(path.join(tmp, 'docs', 'specs', 'x', 'spec.md'), '\nghi chú\n');
      ok(!w13([req, '--base', 'HEAD']), 'AC3.4: CLI spec đã sửa (chưa commit) → không W13');
      git(tmp, 'checkout', '-q', '--', '.');
      ok(w13([req, '--base', 'HEAD']), 'AC3.4: CLI spec hoàn lại → W13');
      // Spec mới chưa track vẫn tính là đã đổi.
      fs.writeFileSync(path.join(req, 'design.md'), '# D\n## Tiêu chí chấp nhận\n- [ ] **AC1.1** — a\n## Ảnh hưởng spec\n- y: thêm R1\n');
      fs.writeFileSync(path.join(tmp, 'docs', 'specs', 'y', 'spec.md'), spec(REQ('y/R1')));
      ok(!w13([req, '--base', 'HEAD']), 'AC3.4: CLI spec mới chưa track → không W13');
      fs.writeFileSync(path.join(req, 'design.md'), '# D\n## Tiêu chí chấp nhận\n- [ ] **AC1.1** — a\n## Ảnh hưởng spec\n- x: đổi R1\n');
      ok(w13([req, '--base', 'HEAD']), 'AC3.4: CLI chỉ y mới, x không đổi → W13 cho x');

      const bad = runMain([req, '--base', 'khong-ton-tai-ref']);
      ok(bad.code === 0 && !/W13/.test(bad.out), 'AC3.4: CLI ref không tồn tại → không crash, không W13');

      const preq = setup(plain);
      const ng = runMain([preq, '--base', 'HEAD']);
      ok(ng.code === 0 && !/W13/.test(ng.out), 'AC3.4: CLI thư mục không phải git → không crash, không W13');

      // Bố cục lồng (repo/pkg/docs/...): pathspec của git phải theo thư mục specs thật, không theo <git-root>/docs/specs.
      const nest = path.join(tmp, 'pkg');
      const nreq = setup(nest);
      git(tmp, 'add', '-A');
      git(tmp, 'commit', '-q', '-m', 'nested');
      ok(w13([nreq, '--base', 'HEAD']), 'AC3.4: CLI bố cục lồng, spec không đổi → W13');
      fs.appendFileSync(path.join(nest, 'docs', 'specs', 'x', 'spec.md'), '\nghi chú\n');
      ok(!w13([nreq, '--base', 'HEAD']), 'AC3.4: CLI bố cục lồng, spec đã sửa → không W13');

      ok(runMain([req, '--base']).code === 2, 'AC3.4: --base thiếu giá trị → exit 2');
      ok(runMain([req, '--base', '--strict']).code === 2, 'AC3.4: --base nhận giá trị bắt đầu bằng "-" → exit 2');
      ok(runMain([req, '--base', '--output=x']).code === 2, 'AC3.4: ref dạng option git bị từ chối → exit 2');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.rmSync(plain, { recursive: true, force: true });
    }
  }

  // W10-legacy: thư mục request trước ngày P7 (hoặc không có tiền tố ngày) được miễn W10.
  {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const noSection = ['# D', '## Tiêu chí chấp nhận', '- [ ] **AC1.1** — a', ''].join('\n');
    const pure = (design, opts) => cr.checkRequest({ 'design.md': design }, { readSpec: () => null, ...opts }).map((w) => w.code);
    ok(!pure(noSection, { legacy: true }).includes('W10'), 'W10-legacy: legacy true, thiếu mục → không W10');
    ok(pure(noSection + '## Ảnh hưởng spec\n- ghost: thêm R1\n', { legacy: true }).includes('W11'),
      'W10-legacy: legacy true vẫn báo W11 khi design có mục ảnh hưởng');
    ok(pure(noSection, {}).includes('W10') && pure(noSection, { legacy: false }).includes('W10'),
      'W10-legacy: không có legacy hoặc legacy false → vẫn W10');
    ok(cr.SPEC_SINCE === '2026-10-21', 'W10-legacy: SPEC_SINCE là 2026-10-21');

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'living-legacy-'));
    try {
      const runCli = (name, strict) => {
        const req = path.join(tmp, 'docs', 'requests', name);
        fs.mkdirSync(req, { recursive: true });
        fs.writeFileSync(path.join(req, 'design.md'), noSection);
        const lines = [];
        const orig = console.log;
        console.log = (m) => lines.push(String(m));
        let code;
        try { code = cr.main(strict ? [req, '--strict'] : [req]); } finally { console.log = orig; }
        return { code, out: lines.join('\n') };
      };
      const old = runCli('2026-10-20-x', true);
      ok(!/W10/.test(old.out) && old.code === 0, 'W10-legacy: CLI thư mục 2026-10-20 → không W10, --strict exit 0');
      const cur = runCli('2026-10-21-y', true);
      ok(/\[W10\]/.test(cur.out) && cur.code === 1, 'W10-legacy: CLI thư mục 2026-10-21 (biên, không legacy) → W10, --strict exit 1');
      const undated = runCli('legacy-z', false);
      ok(!/W10/.test(undated.out), 'W10-legacy: CLI thư mục không có tiền tố ngày → không W10');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
}
