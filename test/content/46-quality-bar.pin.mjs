// Pin: template quality bar và dấu hiệu nới quality bar trong review package (request 2026-11-10-agent-skills-gap-closure, P3).
export default async function run({ ok, ctx }) {
  const { fs, path, pathToFileURL, REPO_ROOT } = ctx;
  const TPL = 'core/skills/artifact-templates/references/quality-bar.template.md';

  ok(fs.existsSync(path.join(REPO_ROOT, TPL)), `AC3.1: ${TPL} tồn tại`);
  ok(!fs.existsSync(path.join(REPO_ROOT, 'core/skills/artifact-templates/references/project-knowledge/quality-bar.md'))
    && !fs.existsSync(path.join(REPO_ROOT, 'core/skills/artifact-templates/references/project-knowledge/quality-bar.template.md')),
  'AC3.1: template không nằm dưới references/project-knowledge/ nên aip init --full không chép');

  const rp = await import(pathToFileURL(path.join(REPO_ROOT, 'core/skills/plan-execution/scripts/review-package.mjs')).href);
  const QB = 'project-knowledge/quality-bar.md';
  const bar = (cmds, exc = []) => [
    '# Quality bar', '', '## Lệnh kiểm', '', '| Lệnh | Ngưỡng | Owner |', '|---|---|---|',
    ...cmds.map(([c, th]) => '| ' + c + ' | ' + th + ' | qa |'),
    '', '## Ngoại lệ', '', '| Ngoại lệ | Lý do | Owner | Hạn |', '|---|---|---|---|',
    ...exc.map(([n, h]) => '| ' + n + ' | tạm | qa | ' + h + ' |'), '',
  ].join('\n');
  const base = bar([['`npm test`', 'exit 0'], ['cov', 'coverage >= 80'], ['lint', 'warnings <= 5']], [['legacy', '2026-12-01']]);
  const trail = (t) => t.replace('## Lệnh kiểm', '## Lệnh kiểm ').replace('## Ngoại lệ', '## Ngoại lệ ');
  const L = (s) => '- ' + QB + ': ' + s;

  // AC3.2: mỗi loại nới một ca, mỗi loại không nới một ca rỗng.
  const cases = [
    ['bỏ lệnh kiểm', bar([['cov', 'coverage >= 80'], ['lint', 'warnings <= 5']], [['legacy', '2026-12-01']]), [L('bỏ lệnh kiểm npm test')]],
    ['ô có backtick so với không backtick', bar([['npm test', 'exit 0'], ['cov', 'coverage >= 80'], ['lint', 'warnings <= 5']], [['legacy', '2026-12-01']]), []],
    ['thêm ngoại lệ', base.replace(/\n$/, '') + '\n| flaky | tạm | qa | 2026-11-30 |\n', [L('thêm ngoại lệ flaky')]],
    ['gia hạn ngoại lệ', base.replace('2026-12-01', '2027-01-15'), [L('gia hạn ngoại lệ legacy: 2026-12-01 → 2027-01-15')]],
    ['hạ ngưỡng >=', base.replace('>= 80', '>= 70'), [L('ngưỡng nới cov: coverage >= 80 → coverage >= 70')]],
    ['nâng ngưỡng <=', base.replace('<= 5', '<= 9'), [L('ngưỡng nới lint: warnings <= 5 → warnings <= 9')]],
    ['đổi ngưỡng không đọc được hướng', base.replace('coverage >= 80', 'coverage > 80'), [L('đổi ngưỡng, cần xét cov: coverage >= 80 → coverage > 80')]],
    ['thêm lệnh kiểm', base.replace('| lint |', '| e2e | exit 0 | qa |\n| lint |'), []],
    ['siết ngưỡng', base.replace('>= 80', '>= 90').replace('<= 5', '<= 2'), []],
    ['bỏ ngoại lệ', base.replace('| legacy | tạm | qa | 2026-12-01 |\n', ''), []],
    ['rút hạn', base.replace('2026-12-01', '2026-11-20'), []],
    ['không đổi', base, []],
    // Heading có khoảng trắng cuối dòng vẫn phải được nhận ra ở cả hai bản.
    ['heading có khoảng trắng cuối: hạ ngưỡng >=', trail(base.replace('>= 80', '>= 70')), [L('ngưỡng nới cov: coverage >= 80 → coverage >= 70')], trail(base)],
    ['heading có khoảng trắng cuối: bỏ lệnh kiểm', trail(bar([['cov', 'coverage >= 80'], ['lint', 'warnings <= 5']], [['legacy', '2026-12-01']])), [L('bỏ lệnh kiểm npm test')], trail(base)],
    ['heading chỉ bản mới có khoảng trắng, nội dung y hệt', trail(base), []],
    ['Hạn bị xoá', base.replace('2026-12-01', ''), [L('đổi hạn, cần xét legacy: 2026-12-01 → ')]],
    ['Hạn thành không hạn', base.replace('2026-12-01', 'không hạn'), [L('đổi hạn, cần xét legacy: 2026-12-01 → không hạn')]],
  ];
  for (const [name, next, want, prev = base] of cases) {
    const got = rp.qualityBarLoosening(prev, next);
    ok(JSON.stringify(got) === JSON.stringify(want), 'AC3.2: ' + name + ' → ' + JSON.stringify(want) + ' (nhận ' + JSON.stringify(got) + ')');
  }
  ok(rp.qualityBarLoosening(
    fs.readFileSync(path.join(REPO_ROOT, TPL), 'utf8'), fs.readFileSync(path.join(REPO_ROOT, TPL), 'utf8')).length === 0,
  'AC3.2: template so với chính nó → 0 dòng');

  // AC3.3: buildPackage với run giả.
  const mk = (files, show) => (args) => {
    if (args[0] === 'diff' && args.includes('--name-status')) return files;
    if (args[0] === 'show') return show(args[1]);
    return '';
  };
  const section = (pkg) => (pkg.match(/## Dấu hiệu nới kiểm\n([\s\S]*?)\n\n## Diff/) || [, ''])[1];
  {
    const next = base.replace('>= 80', '>= 70');
    const pkg = rp.buildPackage({ base: 'a', head: 'b', run: mk('M\t' + QB + '\n', (r) => (r === 'a:' + QB ? base : next)) });
    ok(section(pkg) === L('ngưỡng nới cov: coverage >= 80 → coverage >= 70'), 'AC3.3: buildPackage đưa dòng nới quality bar vào mục Dấu hiệu nới kiểm');
    const quiet = rp.buildPackage({ base: 'a', head: 'b', run: mk('M\tREADME.md\n', () => { throw new Error('không được đọc'); }) });
    ok(section(quiet) === '(không có)', 'AC3.3: không đổi quality-bar.md thì không đọc file và ghi "(không có)"');
  }
  {
    let pkg = '';
    let threw = false;
    try { pkg = rp.buildPackage({ base: 'a', head: 'b', run: mk('M\t' + QB + '\n', (r) => { if (r === 'a:' + QB) throw new Error('fatal: path does not exist'); return base; }) }); } catch { threw = true; }
    ok(!threw && section(pkg) === '(không có)', 'AC3.3: file chưa có ở base (git show ném) → không báo, buildPackage không ném');
  }
  {
    const pkg = rp.buildPackage({ base: 'a', head: 'b', run: mk('D\t' + QB + '\n', (r) => { if (r === 'b:' + QB) throw new Error('fatal: path does not exist'); return base; }) });
    ok(section(pkg) === [L('bỏ lệnh kiểm npm test'), L('bỏ lệnh kiểm cov'), L('bỏ lệnh kiểm lint')].join('\n'), 'AC3.3: file bị xoá ở head → mỗi lệnh kiểm cũ một dòng bỏ lệnh kiểm');
  }
  {
    // Dời file sang chỗ khác rồi nới: vẫn phải báo dời và so với bản ở chỗ mới.
    const NEW = 'docs/quality-bar.md';
    const next = base.replace('>= 80', '>= 70');
    const run = mk('R090\t' + QB + '\t' + NEW + '\n', (r) => (r === 'a:' + QB ? base : r === 'b:' + NEW ? next : (() => { throw new Error('sai đường dẫn ' + r); })()));
    ok(section(rp.buildPackage({ base: 'a', head: 'b', run })) === ['- ' + QB + ': đổi tên/dời sang ' + NEW + ', cần xét', L('ngưỡng nới cov: coverage >= 80 → coverage >= 70')].join('\n'), 'AC3.3: đổi tên/dời file → báo dời và so với bản ở chỗ mới');
  }
  {
    // git thật: -M phải nhận ra đổi tên có sửa nội dung và đầu ra phải khớp bộ phân tích.
    const { execFileSync } = await import('node:child_process');
    const dir = fs.mkdtempSync(path.join(ctx.os?.tmpdir?.() ?? (await import('node:os')).tmpdir(), 'qb-'));
    const g = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: dir, encoding: 'utf8' });
    try {
      g('init', '-q');
      fs.mkdirSync(path.join(dir, 'project-knowledge'));
      fs.writeFileSync(path.join(dir, QB), base);
      g('add', '.'); g('commit', '-qm', 'a');
      g('mv', QB, 'quality.md');
      fs.writeFileSync(path.join(dir, 'quality.md'), base.replace('>= 80', '>= 70'));
      g('add', '-A'); g('commit', '-qm', 'b');
      const run = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
      const got = section(rp.buildPackage({ base: 'HEAD~1', head: 'HEAD', run }));
      ok(got.includes('đổi tên/dời sang quality.md') && got.includes('ngưỡng nới cov'), 'AC3.3: git thật, dời + nới → cả hai dòng báo (nhận ' + JSON.stringify(got) + ')');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
}
