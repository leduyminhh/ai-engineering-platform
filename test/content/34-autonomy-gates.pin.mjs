// Pin: khoá autonomy trong aip-gate.json (docs/requests/2026-10-31-autonomy-gates). Task 1: autonomy.mjs đọc + chuẩn hoá khoá.
export default async function run({ ok, ctx }) {
  const { fs, path, os, REPO_ROOT, pathToFileURL } = ctx;
  const { execFileSync } = await import('node:child_process');

  // AC3.1, AC3.2, AC3.3: readAutonomy đọc gate gốc worktree rồi gốc repo chính, chuẩn hoá từng trường về mặc định an toàn
  {
    const { readAutonomy, resolveAutonomy, DEFAULTS } = await import(pathToFileURL(path.join(REPO_ROOT, 'core', 'skills', 'plan-execution', 'scripts', 'autonomy.mjs')).href);
    const SAFE = { mergeLocal: false, cleanup: false, partRunner: 'session', planRunner: 'subagent' };
    const P = (o) => ({ ...o, planRunner: o.planRunner ?? 'subagent' });
    ok(JSON.stringify(DEFAULTS) === JSON.stringify(SAFE), 'AC3.2: mặc định an toàn { mergeLocal: false, cleanup: false, partRunner: "session", planRunner: "subagent" }');

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-auto-'));
    const main = path.join(root, 'main');
    const wt = path.join(root, 'wt');
    const gitFake = (top, common) => (args) => {
      if (args.includes('--show-toplevel')) return top;
      if (args.includes('--git-common-dir')) return common;
      throw new Error(`git lạ: ${args.join(' ')}`);
    };
    const put = (dir, text) => { fs.mkdirSync(path.join(dir, '.claude'), { recursive: true }); fs.writeFileSync(path.join(dir, '.claude', 'aip-gate.json'), text); };
    const clear = (dir) => fs.rmSync(path.join(dir, '.claude'), { recursive: true, force: true });
    const inMain = { git: gitFake(main, path.join(main, '.git')), tracked: () => false };
    const read = (deps = inMain) => JSON.stringify(readAutonomy(deps === inMain ? main : wt, deps));
    try {
      fs.mkdirSync(main, { recursive: true });
      fs.mkdirSync(wt, { recursive: true });

      const cases = [
        ['AC3.1: giá trị hợp lệ', { mode: 'full', autonomy: { mergeLocal: true, cleanup: true, partRunner: 'subagent' } }, { mergeLocal: true, cleanup: true, partRunner: 'subagent' }],
        ['AC3.1: partRunner sequential', { autonomy: { mergeLocal: false, cleanup: true, partRunner: 'sequential' } }, { mergeLocal: false, cleanup: true, partRunner: 'sequential' }],
        ['AC3.2: không có khoá autonomy', { mode: 'full' }, SAFE],
        ['AC3.2: autonomy không phải đối tượng', { autonomy: 'high' }, SAFE],
        ['AC3.2: autonomy là mảng', { autonomy: [true] }, SAFE],
        ['AC3.2: mergeLocal sai kiểu chỉ hỏng trường đó', { autonomy: { mergeLocal: 'true', cleanup: true, partRunner: 'subagent' } }, { mergeLocal: false, cleanup: true, partRunner: 'subagent' }],
        ['AC3.2: cleanup sai kiểu chỉ hỏng trường đó', { autonomy: { mergeLocal: true, cleanup: 1, partRunner: 'sequential' } }, { mergeLocal: true, cleanup: false, partRunner: 'sequential' }],
        ['AC3.2: partRunner ngoài tập chỉ hỏng trường đó', { autonomy: { mergeLocal: true, cleanup: true, partRunner: 'parallel' } }, { mergeLocal: true, cleanup: true, partRunner: 'session' }],
        ['AC3.2: gate không phải đối tượng', [1, 2], SAFE],
        ['AC4.1: planRunner inline', { autonomy: { planRunner: 'inline' } }, { ...SAFE, planRunner: 'inline' }],
        ['AC4.1: planRunner ngoài tập chỉ hỏng trường đó', { autonomy: { mergeLocal: true, planRunner: 'parallel' } }, { ...SAFE, mergeLocal: true }],
        ['AC4.1: planRunner sai kiểu chỉ hỏng trường đó', { autonomy: { cleanup: true, planRunner: 1 } }, { ...SAFE, cleanup: true }],
      ];
      for (const [name, gate, want] of cases) {
        put(main, JSON.stringify(gate));
        ok(read() === JSON.stringify(P(want)), `${name} → ${JSON.stringify(P(want))}`);
      }

      put(main, '﻿' + JSON.stringify({ autonomy: { mergeLocal: true, cleanup: false, partRunner: 'subagent' } }));
      ok(read() === JSON.stringify(P({ mergeLocal: true, cleanup: false, partRunner: 'subagent' })), 'AC3.1: file có BOM vẫn đọc được');

      put(main, '{ hỏng');
      ok(read() === JSON.stringify(SAFE), 'AC3.2: JSON hỏng → mặc định cả ba trường');

      clear(main);
      ok(read() === JSON.stringify(SAFE), 'AC3.2: không có aip-gate.json → mặc định');

      // AC3.3: worktree không có gate riêng → gate repo chính; có gate riêng (kể cả hỏng) thì che repo chính như hook
      const inWt = { git: gitFake(wt, path.join(main, '.git')), tracked: () => false };
      put(main, JSON.stringify({ autonomy: { mergeLocal: true, cleanup: true, partRunner: 'subagent' } }));
      ok(read(inWt) === JSON.stringify(P({ mergeLocal: true, cleanup: true, partRunner: 'subagent' })), 'AC3.3: worktree không có aip-gate.json → đọc khoá của repo chính');
      put(wt, JSON.stringify({ mode: 'ask' }));
      ok(read(inWt) === JSON.stringify(SAFE), 'AC3.3: worktree có aip-gate.json riêng → dùng file đó, không trộn với repo chính');
      put(wt, '{ hỏng');
      ok(read(inWt) === JSON.stringify(SAFE), 'AC3.3: aip-gate.json của worktree hỏng vẫn che repo chính → mặc định');

      // AC3.4: file đã commit đến từ clone nên khoá bị bỏ qua như `mode: full`; chỉ file chắc chắn chưa theo dõi mới có hiệu lực
      const FULL = { autonomy: { mergeLocal: true, cleanup: true, partRunner: 'subagent' } };
      for (const [label, tracked] of [['đã theo dõi', () => true], ['không xác định', () => null]]) {
        put(main, JSON.stringify(FULL));
        clear(wt);
        ok(JSON.stringify(readAutonomy(wt, { ...inWt, tracked })) === JSON.stringify(SAFE), `AC3.4: file ${label} ở gốc repo chính (worktree không có file) → mặc định an toàn`);
        put(wt, JSON.stringify(FULL));
        ok(JSON.stringify(readAutonomy(wt, { ...inWt, tracked })) === JSON.stringify(SAFE), `AC3.4: file ${label} ở gốc worktree → mặc định an toàn`);
      }
      const gated = (tracked) => resolveAutonomy(main, { ...inMain, tracked });
      put(main, JSON.stringify(FULL));
      ok(gated(() => true).ignored === 'tracked' && gated(() => null).ignored === 'unknown' && gated(() => false).ignored === null, 'AC3.4: resolveAutonomy nêu lý do bỏ qua (tracked | unknown | null)');
      put(main, JSON.stringify({ mode: 'full' }));
      ok(resolveAutonomy(main, { ...inMain, tracked: () => { throw new Error('không được hỏi git khi không có khoá autonomy'); } }).ignored === null, 'AC3.4: không có khoá autonomy thì không hỏi git');

      put(main, JSON.stringify(FULL));
      const noGit = { git: () => { throw new Error('không có git'); } };
      ok(JSON.stringify(readAutonomy(main, noGit)) === JSON.stringify(P({ mergeLocal: true, cleanup: true, partRunner: 'subagent' })), 'AC3.3: không có git → đọc gate ở cwd');

      // AC3.4: git thật (không seam): chưa theo dõi ⇒ có hiệu lực; đã `git add` ⇒ bỏ qua
      const repo = path.join(root, 'repo');
      fs.mkdirSync(repo, { recursive: true });
      execFileSync('git', ['init', '-q'], { cwd: repo });
      put(repo, JSON.stringify(FULL));
      ok(JSON.stringify(readAutonomy(repo)) === JSON.stringify(P(FULL.autonomy)), 'AC3.4: git thật, file chưa theo dõi → khoá có hiệu lực');
      execFileSync('git', ['add', '.claude/aip-gate.json'], { cwd: repo });
      ok(JSON.stringify(readAutonomy(repo)) === JSON.stringify(SAFE), 'AC3.4: git thật, file đã theo dõi → mặc định an toàn');

      // Regression trial 2026-11-03: `cd <skill> && node scripts/autonomy.mjs` đọc aip-gate.json của clone aip chứa plugin
      // (mergeLocal/cleanup true) thay vì của project đích → từ chối, exit 2, không in JSON.
      const { spawnSync } = await import('node:child_process');
      const skillDir = path.join(REPO_ROOT, 'core', 'skills', 'plan-execution');
      for (const [cwd, want] of [[skillDir, 2], [path.join(REPO_ROOT, 'core'), 2], [repo, 0]]) {
        const r = spawnSync(process.execPath, [path.join(skillDir, 'scripts', 'autonomy.mjs')], { cwd, encoding: 'utf8' });
        ok(r.status === want && (want === 0 ? r.stdout.includes('mergeLocal') : r.stdout === '' && r.stderr.includes('gốc project')),
          `autonomy.mjs chạy từ ${path.relative(REPO_ROOT, cwd) || cwd} → exit ${want} (nhận ${r.status})`);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
}
