// Pin: khoá autonomy trong aip-gate.json (docs/requests/2026-10-31-autonomy-gates). Task 1: autonomy.mjs đọc + chuẩn hoá khoá.
export default async function run({ ok, ctx }) {
  const { fs, path, os, REPO_ROOT, pathToFileURL } = ctx;

  // AC3.1, AC3.2, AC3.3: readAutonomy đọc gate gốc worktree rồi gốc repo chính, chuẩn hoá từng trường về mặc định an toàn
  {
    const { readAutonomy, DEFAULTS } = await import(pathToFileURL(path.join(REPO_ROOT, 'core', 'skills', 'plan-execution', 'scripts', 'autonomy.mjs')).href);
    const SAFE = { mergeLocal: false, cleanup: false, partRunner: 'session' };
    ok(JSON.stringify(DEFAULTS) === JSON.stringify(SAFE), 'AC3.2: mặc định an toàn { mergeLocal: false, cleanup: false, partRunner: "session" }');

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
    const inMain = { git: gitFake(main, path.join(main, '.git')) };
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
      ];
      for (const [name, gate, want] of cases) {
        put(main, JSON.stringify(gate));
        ok(read() === JSON.stringify(want), `${name} → ${JSON.stringify(want)}`);
      }

      put(main, '﻿' + JSON.stringify({ autonomy: { mergeLocal: true, cleanup: false, partRunner: 'subagent' } }));
      ok(read() === JSON.stringify({ mergeLocal: true, cleanup: false, partRunner: 'subagent' }), 'AC3.1: file có BOM vẫn đọc được');

      put(main, '{ hỏng');
      ok(read() === JSON.stringify(SAFE), 'AC3.2: JSON hỏng → mặc định cả ba trường');

      clear(main);
      ok(read() === JSON.stringify(SAFE), 'AC3.2: không có aip-gate.json → mặc định');

      // AC3.3: worktree không có gate riêng → gate repo chính; có gate riêng (kể cả hỏng) thì che repo chính như hook
      const inWt = { git: gitFake(wt, path.join(main, '.git')) };
      put(main, JSON.stringify({ autonomy: { mergeLocal: true, cleanup: true, partRunner: 'subagent' } }));
      ok(read(inWt) === JSON.stringify({ mergeLocal: true, cleanup: true, partRunner: 'subagent' }), 'AC3.3: worktree không có aip-gate.json → đọc khoá của repo chính');
      put(wt, JSON.stringify({ mode: 'ask' }));
      ok(read(inWt) === JSON.stringify(SAFE), 'AC3.3: worktree có aip-gate.json riêng → dùng file đó, không trộn với repo chính');
      put(wt, '{ hỏng');
      ok(read(inWt) === JSON.stringify(SAFE), 'AC3.3: aip-gate.json của worktree hỏng vẫn che repo chính → mặc định');

      const noGit = { git: () => { throw new Error('không có git'); } };
      ok(JSON.stringify(readAutonomy(main, noGit)) === JSON.stringify({ mergeLocal: true, cleanup: true, partRunner: 'subagent' }), 'AC3.3: không có git → đọc gate ở cwd');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
}
