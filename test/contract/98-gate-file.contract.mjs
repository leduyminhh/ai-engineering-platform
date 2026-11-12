// Contract của gate-file.mjs: nơi đọc .claude/aip-gate.json duy nhất cho hook, CLI và script plan-execution
// (request 2026-11-11-aip-gate-config-flow).
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, pathToFileURL, CORE_DIR } = ctx;
  const src = path.join(CORE_DIR, 'hooks', 'scripts', 'gate-file.mjs');
  const copy = path.join(CORE_DIR, 'skills', 'plan-execution', 'scripts', 'gate-file.mjs');
  const gf = await import(pathToFileURL(src).href);

  const git = (cwd, ...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  const makeRepo = (dir) => {
    fs.mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.name', 'aip-test');
    git(dir, 'config', 'user.email', 'aip-test@example.com');
    fs.writeFileSync(path.join(dir, 'README.md'), 'x\n');
    git(dir, 'add', 'README.md');
    git(dir, 'commit', '-q', '-m', 'init');
  };
  const writeRaw = (root, text) => {
    fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(root, '.claude', 'aip-gate.json'), text);
  };
  const gateOf = (root) => path.join(root, '.claude', 'aip-gate.json');
  const same = (a, b) => a != null && b != null && path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

  // ── AC1.1: locateGate trên repo, worktree và thư mục ngoài git thật
  const tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aip-gf-')));
  const main = path.join(tmp, 'main');
  const wt = path.join(tmp, 'wt');
  try {
    makeRepo(main);
    git(main, 'worktree', 'add', '-q', wt, '-b', 'wt-branch');
    const outside = path.join(tmp, 'outside');
    fs.mkdirSync(outside);

    const cases = [
      ['thiếu file', () => {}, main, (g) => g.inRepo === true && g.config === null && g.source === null && g.file === null && g.mainInvalid === null],
      ['JSON hỏng', () => writeRaw(main, '{ hỏng'), main, (g) => g.config === null && g.source === 'worktree-invalid' && same(g.file, gateOf(main))],
      ['mảng', () => writeRaw(main, '[1]'), main, (g) => g.config === null && g.source === 'worktree-invalid'],
      ['null', () => writeRaw(main, 'null'), main, (g) => g.config === null && g.source === 'worktree-invalid'],
      ['chuỗi', () => writeRaw(main, '"x"'), main, (g) => g.config === null && g.source === 'worktree-invalid'],
      ['BOM', () => writeRaw(main, '﻿{"stopGate":false}'), main, (g) => g.config?.stopGate === false && g.source === 'worktree' && same(g.file, gateOf(main))],
      ['worktree trống cạnh repo chính hợp lệ', () => writeRaw(main, '{"mcpDeny":["x"]}'), wt,
        (g) => g.source === 'main' && g.config?.mcpDeny?.[0] === 'x' && same(g.file, gateOf(main)) && same(g.top, wt) && same(g.main, main) && g.roots.length === 2],
      ['worktree có file riêng', () => { writeRaw(main, '{"mcpDeny":["x"]}'); writeRaw(wt, '{"mcpDeny":["y"]}'); }, wt,
        (g) => g.source === 'worktree' && g.config?.mcpDeny?.[0] === 'y' && same(g.file, gateOf(wt))],
      ['worktree hỏng che repo chính hợp lệ', () => { writeRaw(main, '{"stopGate":false}'); writeRaw(wt, '{ hỏng'); }, wt,
        (g) => g.source === 'worktree-invalid' && g.config === null && same(g.file, gateOf(wt))],
      ['repo chính hỏng, worktree trống', () => writeRaw(main, '{ hỏng'), wt,
        (g) => g.config === null && g.source === null && same(g.mainInvalid, gateOf(main))],
      ['ngoài repo git', () => writeRaw(outside, '{"allowEnvFiles":true}'), outside,
        (g) => g.inRepo === false && g.config?.allowEnvFiles === true && g.source === 'worktree' && same(g.file, gateOf(outside)) && g.main === null],
      ['thư mục con chưa tồn tại', () => writeRaw(main, '{"stopGate":true}'), path.join(main, 'chua', 'co'),
        (g) => g.config?.stopGate === true && same(g.top, main)],
    ];
    for (const [name, setup, cwd, expect] of cases) {
      for (const r of [main, wt, outside]) fs.rmSync(path.join(r, '.claude'), { recursive: true, force: true });
      setup();
      let g;
      try { g = gf.locateGate(cwd); } catch (e) { g = { error: e.message }; }
      ok(g && expect(g), `AC1.1: locateGate — ${name}: ${JSON.stringify(g)}`);
    }

    // Submodule: common-dir nằm trong .git/modules của repo cha → main là gốc của chính submodule.
    const top = path.join(tmp, 'outer', 'sub');
    const fakeGit = (args) => {
      if (args.includes('--show-toplevel')) return top;
      if (args.includes('--git-common-dir')) return path.join(tmp, 'outer', '.git', 'modules', 'sub');
      throw new Error('không mong đợi');
    };
    const sg = gf.locateGate(top, { git: fakeGit });
    ok(sg.inRepo === true && same(sg.main, top) && sg.roots.length === 1, `AC1.1: locateGate — submodule dùng gốc của chính nó: ${JSON.stringify(sg)}`);
  } finally {
    try { git(main, 'worktree', 'remove', '--force', wt); } catch { /* bỏ qua */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* bỏ qua */ }
  }

  // ── AC1.1 phần readGateAt: ba dạng kết quả
  {
    const d = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aip-gf-r-')));
    try {
      ok(gf.readGateAt(d) === null, 'AC1.1: readGateAt thiếu file → null');
      writeRaw(d, '{ x');
      ok(gf.readGateAt(d)?.invalid === true, 'AC1.1: readGateAt JSON hỏng → { invalid: true }');
      writeRaw(d, '{"a":1}');
      ok(gf.readGateAt(d)?.config?.a === 1, 'AC1.1: readGateAt hợp lệ → { config }');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  }

  // ── AC2.1: bảng khoá
  const UNTRACKED = ['mode', 'autonomy', 'allowEnvFiles', 'stopGate', 'exemptAgents', 'testCommands', 'fullKeep', 'fullRoots', 'fullReadRoots', 'fullPaths'];
  const ANY = ['mcpAllow', 'mcpDeny', 'bootstrapInject', 'handoffInject',
    'ledgerInject', 'resumeWarn', 'handoffPath', 'handoffMaxAgeHours', 'statusStaleMinutes'];
  {
    const keys = Object.keys(gf.GATE_KEYS ?? {});
    const byTrust = (t) => keys.filter((k) => gf.GATE_KEYS[k].trust === t).sort();
    ok(keys.length === 19, `AC2.1/AC1.1: GATE_KEYS có 19 khoá, gồm fullPaths (đang ${keys.length})`);
    ok(JSON.stringify(byTrust('untracked')) === JSON.stringify([...UNTRACKED].sort()), `AC2.1/AC1.1: đúng 10 khoá untracked (gồm fullPaths): ${byTrust('untracked')}`);
    ok(JSON.stringify(byTrust('any')) === JSON.stringify([...ANY].sort()), `AC2.1: đúng 9 khoá any: ${byTrust('any')}`);
    const types = new Set(['string', 'boolean', 'number', 'array', 'object']);
    ok(keys.every((k) => types.has(gf.GATE_KEYS[k].type)), 'AC2.1: mọi khoá có type thuộc tập đóng');
  }

  // ── AC2.2, AC2.3: trustedValue ở bốn trạng thái, đếm lời gọi seam tracked
  {
    const value = { mode: 'full', autonomy: { mergeLocal: true }, allowEnvFiles: true, stopGate: false, exemptAgents: ['x'], testCommands: ['.'], fullKeep: [], fullRoots: ['/x'], fullReadRoots: ['/y'], fullPaths: [{ path: '/z', read: true }] };
    const states = [['không bị theo dõi', true, false, true], ['bị theo dõi', true, true, false], ['không xác định', true, null, false], ['ngoài repo git', false, true, true]];
    for (const key of UNTRACKED) {
      for (const [name, inRepo, trackedRes, trusted] of states) {
        const gate = { inRepo, file: '/x/.claude/aip-gate.json', config: { [key]: value[key] } };
        const got = gf.trustedValue(gate, key, { tracked: () => trackedRes });
        ok(trusted ? got === value[key] : got === undefined, `AC2.2: trustedValue(${key}) — ${name} → ${trusted ? 'giá trị' : 'undefined'} (được ${JSON.stringify(got)})`);
      }
    }
    for (const key of ['mcpDeny', 'statusStaleMinutes']) {
      for (const [name, inRepo, trackedRes] of states) {
        let calls = 0;
        const v = key === 'mcpDeny' ? ['a'] : 5;
        const got = gf.trustedValue({ inRepo, file: '/x/.claude/aip-gate.json', config: { [key]: v } }, key, { tracked: () => { calls++; return trackedRes; } });
        ok(got === v && calls === 0, `AC2.3: khoá any ${key} — ${name}: trả nguyên, 0 lời gọi git (được ${calls})`);
      }
    }
    let calls = 0;
    const absent = gf.trustedValue({ inRepo: true, file: '/x/.claude/aip-gate.json', config: { mcpDeny: [] } }, 'stopGate', { tracked: () => { calls++; return false; } });
    ok(absent === undefined && calls === 0, 'AC2.3: khoá untracked không có trong config → undefined, 0 lời gọi git');
    ok(gf.trustedValue(null, 'stopGate') === undefined && gf.trustedValue({ config: null }, 'mcpDeny') === undefined, 'AC2.3: gate/config null → undefined');

    // gateTracked: tối đa 2 lời gọi git mỗi file (đường dẫn logic + đường dẫn thật).
    const d = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aip-gf-t-')));
    try {
      writeRaw(d, '{}');
      let n = 0;
      const res = gf.gateTracked(gateOf(d), { run: () => { n++; return 1; } });
      ok(res === false && n <= 2, `AC2.3: gateTracked file chưa theo dõi → false với ≤ 2 lời gọi (được ${res}, ${n})`);
      let m = 0;
      ok(gf.gateTracked(gateOf(d), { run: () => { m++; return 0; } }) === true && m <= 2, 'AC2.3: gateTracked file đã theo dõi → true');
      ok(gf.gateTracked(gateOf(d), { run: () => 128 }) === null, 'AC2.3: gateTracked git trả exit lạ → null');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  }

  // ── AC2.2 trạng thái 3: git hỏng nhưng thư mục có .git
  {
    const boom = () => { throw new Error('git hỏng'); };
    const d = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aip-gf-u-')));
    try {
      fs.mkdirSync(path.join(d, '.git'));
      writeRaw(d, '{"fullKeep":[]}');
      const sub = path.join(d, 'a', 'b');
      fs.mkdirSync(sub, { recursive: true });
      const g = gf.locateGate(sub, { git: boom });
      ok(g.inRepo === true && g.gitUnknown === true && same(g.top, d) && same(g.file, gateOf(d)) && g.config?.fullKeep?.length === 0, `AC2.2: locateGate git hỏng + có .git → inRepo, gitUnknown, đọc file ở gốc .git: ${JSON.stringify(g)}`);
      ok(gf.trustedValue(g, 'fullKeep', { tracked: () => null }) === undefined, 'AC2.2: git hỏng ⇒ khoá untracked → undefined');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
    const n = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aip-gf-n-')));
    try {
      const g = gf.locateGate(n, { git: boom });
      ok(g.inRepo === false && g.gitUnknown === false, `AC2.2: git hỏng, không có .git → inRepo false: ${JSON.stringify(g)}`);
    } finally { fs.rmSync(n, { recursive: true, force: true }); }
  }

  // ── AC2.4: lintGate
  {
    const r = gf.lintGate({ foo: 1, stopGate: 'no', mcpAllow: 'a', mode: 'full', autonomy: {} });
    ok(JSON.stringify(r.unknown) === '["foo"]', `AC2.4: lintGate khoá lạ (được ${JSON.stringify(r.unknown)})`);
    ok(r.badType.includes('stopGate') && r.badType.includes('mcpAllow') && r.badType.length === 2, `AC2.4: lintGate khoá sai kiểu (được ${JSON.stringify(r.badType)})`);
    const clean = gf.lintGate({ mode: 'ask', exemptAgents: [], autonomy: { cleanup: true }, handoffMaxAgeHours: 3, handoffPath: 'h.md' });
    ok(clean.unknown.length === 0 && clean.badType.length === 0, 'AC2.4: config hợp lệ → hai mảng rỗng');
    ok(gf.lintGate({ autonomy: [] }).badType.includes('autonomy') && gf.lintGate({ fullKeep: null }).badType.includes('fullKeep'), 'AC2.4: mảng không phải object, null không phải array');
  }

  // ── AC1.2: không còn hàm đọc aip-gate.json riêng ngoài hai bản gate-file.mjs
  {
    const { REPO_ROOT } = ctx;
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.mjs') ? [path.join(d, e.name)] : []));
    const sources = [...walk(path.join(REPO_ROOT, 'core')), ...walk(path.join(REPO_ROOT, 'cli'))].filter((f) => path.basename(f) !== 'gate-file.mjs');
    const OLD = ['readState', 'readAt', 'readGateAt', 'gateOf', 'trackedByGit', 'locateGate'];
    const defs = [];
    for (const f of sources) {
      const text = fs.readFileSync(f, 'utf8');
      for (const name of OLD) if (new RegExp(`(?:function\\s+${name}\\s*\\(|const\\s+${name}\\s*=)`).test(text)) defs.push(`${path.relative(REPO_ROOT, f)}: ${name}`);
    }
    ok(defs.length === 0, `AC1.2: còn hàm đọc riêng ngoài gate-file.mjs: ${defs.join('; ')}`);
    const initSrc = fs.readFileSync(path.join(REPO_ROOT, 'cli', 'lib', 'init.mjs'), 'utf8');
    const body = /export function readAllowEnvFiles[\s\S]*?\n}\n/.exec(initSrc)?.[0] ?? '';
    ok(body && !body.includes('readFileSync'), 'AC1.2: readAllowEnvFiles của init.mjs không tự đọc file');
  }

  // ── AC5.2, AC5.3: chỉ import node:; script plan-execution chạy được từ bản sao khi vắng core/hooks và cli
  {
    const text = fs.readFileSync(src, 'utf8');
    const specs = [...text.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    ok(specs.length > 0 && specs.every((s) => s.startsWith('node:')), `AC5.2: gate-file.mjs chỉ import node: (${specs.join(', ')})`);
    const t2 = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aip-gf-s-')));
    try {
      const scripts = path.join(t2, 'plugin', 'skills', 'plan-execution', 'scripts');
      fs.cpSync(path.join(CORE_DIR, 'skills', 'plan-execution', 'scripts'), scripts, { recursive: true });
      const proj = path.join(t2, 'proj');
      makeRepo(proj);
      const runScript = () => execFileSync(process.execPath, [path.join(scripts, 'autonomy.mjs')], { cwd: proj, encoding: 'utf8' }).trim();
      const SAFE = '{"mergeLocal":false,"cleanup":false,"partRunner":"session","planRunner":"subagent"}';
      let out = null;
      try { out = runScript(); } catch (e) { out = `lỗi: ${e.message}`; }
      ok(out === SAFE, `AC5.2: autonomy.mjs chạy từ bản chép không có core/hooks, cli → JSON bốn khoá (được ${out})`);
      writeRaw(proj, JSON.stringify({ autonomy: { mergeLocal: true } }));
      git(proj, 'add', '.claude/aip-gate.json');
      git(proj, 'commit', '-q', '-m', 'gate');
      try { out = runScript(); } catch (e) { out = `lỗi: ${e.message}`; }
      ok(out === SAFE, `AC5.3: bản chép vẫn bỏ qua khoá autonomy của file đã bị theo dõi (được ${out})`);
    } finally { fs.rmSync(t2, { recursive: true, force: true }); }
  }

  // ── AC5.1: bản sao giống hệt byte
  {
    const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : null);
    const a = read(src);
    const b = read(copy);
    ok(a !== null && a === b, `AC5.1: ${path.relative(CORE_DIR, src)} và ${path.relative(CORE_DIR, copy)} phải giống hệt byte`);
  }
}
