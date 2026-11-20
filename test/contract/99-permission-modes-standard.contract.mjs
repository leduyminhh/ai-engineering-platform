// Contract chuẩn hoá ba chế độ quyền guarded/confined/open (request 2026-11-19-permission-modes-standard).
export default async function run({ ok, ctx }) {
  const { fs, path, os, pathToFileURL, CORE_DIR } = ctx;
  const load = (n) => import(pathToFileURL(path.join(CORE_DIR, 'hooks', 'scripts', n)).href);
  const bash = await load('guard-bash.mjs');
  const files = await load('guard-files.mjs');

  const tb = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'aip-pms-')));
  try {
    const u = (p) => p.replace(/\\/g, '/');
    const P = u(path.join(tb, 'proj'));
    const OUT = u(path.join(tb, 'out'));
    const BYPASS = 'bypassPermissions';
    const bd = (cmd, { tool = 'Bash', cfg, extra = {}, opts = {} } = {}) => bash.decide({ tool_name: tool, tool_input: { command: cmd }, cwd: P, permission_mode: BYPASS, ...extra },
      { repoRoot: P, config: cfg, allowEnv: () => false, currentBranch: () => 'feature/x', ...opts });
    const safe = (cmd, opt) => { try { return bd(cmd, opt); } catch (e) { return { decision: `throw ${e.message}` }; } };
    const kind = (cmd, opt) => safe(cmd, opt)?.decision ?? null;
    const rows = (list, opt) => { for (const [cmd, want, ac] of list) ok(kind(cmd, opt) === want, `${ac}: \`${cmd.replaceAll(u(tb), '~')}\` → ${want}`); };
    const OPEN = { mode: 'open' };
    const GUARDED = { mode: 'guarded' };
    const CONFINED_FREE = { mode: 'confined', fullKeep: [] };
    const tmpClaude = u(path.join(os.tmpdir(), 'claude'));

    // AC2.1: open bỏ H1, H2, H3, nhốt root, <tmp>/claude; đối chứng confined (fullKeep rỗng) vẫn chặn ở các hàng ghi/đọc ngoài rào.
    const free = ['git push origin master', 'git push --force origin feature/x', 'git commit -m "tiếng Việt có dấu"', 'cat .env', `cat ${P}/id_rsa`,
      `rm -rf ${OUT}/x`, `echo x > ${OUT}/y`, `rm ${tmpClaude}`, 'cat $UNKNOWN/x', 'rm $UNKNOWN/x', 'aip mode status'];
    rows(free.map((c) => [c, null, 'AC2.1']), { cfg: OPEN });
    rows([[`Set-Content -Path ${OUT}/y -Value x`, null, 'AC2.1']], { cfg: OPEN, tool: 'PowerShell' });
    rows([[`rm -rf ${OUT}/x`, 'deny', 'AC2.1'], [`echo x > ${OUT}/y`, 'deny', 'AC2.1'], [`rm ${tmpClaude}`, 'deny', 'AC2.1'], ['rm $UNKNOWN/x', 'deny', 'AC2.1']], { cfg: CONFINED_FREE });
    ok(kind(`Set-Content -Path ${OUT}/y -Value x`, { cfg: CONFINED_FREE, tool: 'PowerShell' }) === 'deny', 'AC2.1: đối chứng confined — PowerShell ghi ngoài root bị chặn');

    // AC2.2: lỗi đọc cú pháp không thành popup ở open khi lệnh không nhắc file cấu hình hay aip mode.
    const boom = { currentBranch: () => { throw new Error('boom'); } };
    rows([['git push', null, 'AC2.2'], [`git commit -m 'tiếng`, null, 'AC2.2']], { cfg: OPEN, opts: boom });
    rows([[`git commit -m 'tiếng`, 'deny', 'AC2.2']], { cfg: GUARDED });

    // AC2.8: phiên không bypass trong project confined/open/full vẫn hỏi như R8; guarded và thiếu khoá không.
    const r8 = ['git push origin feature/x', 'curl https://x', 'wget https://x', 'kubectl apply -f a.yaml', 'terraform apply', 'helm upgrade r c'];
    for (const mode of ['open', 'confined', 'full']) {
      for (const pm of [undefined, 'default']) {
        for (const c of r8) {
          const d = safe(c, { cfg: { mode }, extra: { permission_mode: pm } });
          ok(d?.decision === 'ask' && d.reason.includes('aip mode guarded'), `AC2.8: ${mode}/${pm ?? 'thiếu'} không bypass: \`${c}\` → ask nêu aip mode guarded`);
        }
      }
    }
    for (const cfg of [{}, { mode: 'ask' }, { mode: 'guarded' }]) {
      ok(kind('curl https://x', { cfg, extra: { permission_mode: 'default' } }) === null, `AC2.8: ${JSON.stringify(cfg)} không bypass: curl → null`);
    }
    for (const mode of ['open', 'confined', 'full', 'ask', 'guarded']) ok(kind('ls', { cfg: { mode }, extra: { permission_mode: 'default' } }) === null, `AC2.8: ls → null ở ${mode}`);

    // AC1.3: phiên không bypass, tên cũ và tên mới như nhau và như guarded ở các ca ngoài R8.
    const ordinary = ['git push origin master', 'git commit -m "dấu"', 'cat .env', `rm -rf ${OUT}/x`];
    for (const pm of [undefined, 'default']) {
      for (const c of ordinary) {
        const base = JSON.stringify(safe(c, { cfg: { mode: 'ask' }, extra: { permission_mode: pm } }));
        for (const mode of ['full', 'confined']) {
          ok(JSON.stringify(safe(c, { cfg: { mode }, extra: { permission_mode: pm } })) === base, `AC1.3: ${mode}/${pm ?? 'thiếu'} không bypass: \`${c.replaceAll(u(tb), '~')}\` = guarded`);
        }
      }
    }

    // AC2.11 (guard-bash): open vẫn chặn ghi file cấu hình và aip mode đổi mode; không bao giờ ask.
    const cfgWrites = [`echo x > ${P}/.claude/aip-gate.json`, 'sed -i s/a/b/ .claude/settings.json', 'aip mode guarded', 'aip mode open', 'npx aip mode confined',
      'node cli/index.mjs mode full', "echo '{ > .claude/aip-gate.json"];
    rows(cfgWrites.map((c) => [c, 'deny', 'AC2.11']), { cfg: OPEN });
    rows([['aip mode status', null, 'AC2.11'], ['echo mode', null, 'AC2.11'], ['cat .claude/aip-gate.json', null, 'AC2.11']], { cfg: OPEN });

    // Nháy tách tên file hoặc tên lệnh vẫn là ghi cấu hình; cờ chèn giữa aip và mode vẫn là đổi mode. Đối chứng guarded: ask.
    const evasions = ['echo x > .claude/aip-"gate".json', "echo x > .claude/aip-g''ate.json", 'echo x > .claude/sett"ings".json', 'tee .claude/sett"ings".json', 'aip mo"de" open',
      'aip -y mode open', 'aip --provider claude mode open', 'aip mode -y open', 'ai-engineering-platform --no-color mode guarded',
      'aip --skill a --skill b --skill c --skill d mode open', 'aip --plugin a --plugin b --plugin c --plugin d mode open',
      'aip mode --provider claude open', 'aip mode --soft 5 open', 'aip mode --skill a --part p1 confined', 'aip --skill a mode --target x full'];
    rows(evasions.map((c) => [c, 'deny', 'AC2.11']), { cfg: OPEN });
    rows(evasions.map((c) => [c, 'ask', 'AC2.11']), { cfg: GUARDED });
    rows([['aip -y mode status', null, 'AC2.11'], ['aip mode --help', null, 'AC2.11'], ['aip --skill a mode', null, 'AC2.11'], ['aip status mode', null, 'AC2.11'],
      ['aip mode --provider claude status', null, 'AC2.11'], ['aip mode -y', null, 'AC2.11']], { cfg: OPEN });
    // Chi phí tuyến tính theo số token (hook timeout 10 s): lệnh lặp `mode` không được làm decide() chậm hơn 1 s.
    for (const c of ['aip ' + 'mode aip '.repeat(6000) + 'open', 'aip ' + 'mode '.repeat(30000) + 'open']) {
      const t0 = Date.now();
      const k = kind(c, { cfg: OPEN });
      const ms = Date.now() - t0;
      ok((k === 'deny' || k === 'ask') && ms < 1000, `AC2.11: lệnh lặp mode ${c.length} ký tự xong < 1000 ms (${ms} ms, ${k})`);
    }

    // AC2.9: đọc cấu hình ném lỗi thì không tự mở cổng: kết quả bằng guarded, không ném ra ngoài decide.
    const reader = { reader: () => { throw new Error('boom'); } };
    rows([['git push origin master', 'ask', 'AC2.9'], ['echo x > .claude/aip-gate.json', 'ask', 'AC2.9'], ['aip mode open', 'ask', 'AC2.9'], ['ls', null, 'AC2.9']], { cfg: undefined, opts: reader });
    const trackedThrows = { reader: () => ({ config: OPEN, file: P + '/.claude/aip-gate.json', roots: [P] }), tracked: () => { throw new Error('boom'); } };
    rows([['git push origin master', 'ask', 'AC2.9']], { cfg: undefined, opts: trackedThrows });

    // K12: ở guarded/ask, đổi mode do agent chạy là ghi cấu hình → ask với CONFIG_TEXT; status cho qua.
    for (const mode of ['guarded', 'ask']) {
      for (const pm of [BYPASS, 'default']) {
        for (const c of ['aip mode open', 'node cli/index.mjs mode confined']) {
          const d = safe(c, { cfg: { mode }, extra: { permission_mode: pm } });
          ok(d?.decision === 'ask' && d.reason.startsWith('Ghi vào file cấu hình quyền'), `K12 (AC1.2): ${mode}/${pm}: \`${c}\` → ask CONFIG_TEXT`);
        }
        ok(kind('aip mode status', { cfg: { mode }, extra: { permission_mode: pm } }) === null, `K12 (AC1.2): ${mode}/${pm}: aip mode status → null`);
      }
    }

    // AC3.1/AC3.2/AC3.5: confined (và bí danh full) không bao giờ hỏi; câu deny nêu việc bị chặn và cách mở.
    const chain = Array(1100).fill('cd a').join('; ');
    const table = [
      // [nhãn, lệnh, kỳ vọng ở guarded, từ khoá vận hành bắt buộc trong reason, từ khoá cấm]
      ['1', chain, null, ['aip mode open'], []],
      ['2', 'git push origin master', 'ask', ['fullKeep', 'aip mode open'], []],
      ['2', 'git push --force origin feature/x', 'ask', ['fullKeep', 'aip mode open'], []],
      ['3', 'echo x > ' + P + '/.claude/aip-gate.json', 'ask', ['aip mode'], ['aip mode open']],
      ['4', 'rm $UNKNOWN/x', null, ['aip mode open'], []],
      ['5', 'cp ' + OUT + '/x ' + P + '/y', null, ['fullPaths', 'aip mode open'], []],
      ['6', 'cat ' + OUT + '/id_rsa', 'ask', ['fullPaths', 'aip mode open'], []],
      ['7', 'git push', undefined, ['aip mode open'], []],
      ['8', 'aip mode open', 'ask', ['aip mode'], ['aip mode open']],
      ['8', 'node cli/index.mjs mode guarded', 'ask', ['aip mode'], ['aip mode open']],
    ];
    for (const mode of ['confined', 'full']) {
      for (const [n, cmd, wantGuarded, words, banned] of table) {
        const opts = n === '7' ? { opts: boom } : {};
        const d = safe(cmd, { cfg: { mode }, ...opts });
        const short = cmd.length > 60 ? cmd.slice(0, 20) + '…' : cmd.replaceAll(u(tb), '~');
        ok(d?.decision === 'deny', 'AC3.1: ' + mode + ' hàng (' + n + ') ' + short + ' → deny (' + d?.decision + ')');
        ok(words.every((w) => d?.reason?.includes(w)) && banned.every((w) => !d?.reason?.includes(w)), 'AC3.2: ' + mode + ' hàng (' + n + ') reason nêu ' + words.join(' + ') + (banned.length ? ' và không gợi ý ' + banned.join(',') : ''));
        if (wantGuarded !== undefined) ok(kind(cmd, { cfg: GUARDED }) === wantGuarded, 'AC3.1: đối chứng guarded hàng (' + n + ') ' + short + ' → ' + wantGuarded);
      }
      ok(kind('aip mode status', { cfg: { mode } }) === null, 'AC3.1: ' + mode + ' aip mode status → null');
    }
    for (const c of ['git push origin master', 'git push --force origin feature/x']) ok(kind(c, { cfg: { mode: 'confined', fullKeep: [] } }) === null, 'AC3.1: fullKeep rỗng mở cổng push ở confined: ' + c);
    // AC3.6 (guard-bash): lỗi nội bộ sau khi xác định confined ⇒ deny cho lệnh bất kỳ; guarded không bị ảnh hưởng.
    const throwing = (mode) => ({ mode, get fullRoots() { throw new Error('boom'); } });
    const e = safe('echo x', { cfg: throwing('confined') });
    ok(e?.decision === 'deny' && e.reason.includes('aip mode open'), 'AC3.6: confined, lỗi nội bộ với lệnh bất kỳ → deny nêu aip mode open (' + e?.decision + ')');
    ok(kind('echo x', { cfg: throwing('guarded') }) === null, 'AC3.6: đối chứng guarded, cùng seam ném → null');

    // AC3.5: thiếu một điều kiện (file bị theo dõi, phiên không bypass) → bằng guarded, không có deny của nhánh confined.
    const trackedGate = (cfg) => ({ config: undefined, reader: () => ({ config: cfg, file: P + '/.claude/aip-gate.json', roots: [P] }), tracked: () => true });
    for (const [n, cmd] of table) {
      const asGuarded = (opt) => JSON.stringify(safe(cmd, opt));
      const o7 = n === '7' ? { opts: boom } : {};
      ok(asGuarded({ cfg: undefined, opts: { ...o7.opts, ...trackedGate({ mode: 'confined' }) } }) === asGuarded({ cfg: undefined, opts: { ...o7.opts, ...trackedGate({ mode: 'guarded' }) } }),
        'AC3.5: file bị git theo dõi, hàng (' + n + ') ' + cmd.slice(0, 30) + ' = guarded');
      ok(asGuarded({ cfg: { mode: 'confined' }, extra: { permission_mode: 'default' }, ...o7 }) === asGuarded({ cfg: GUARDED, extra: { permission_mode: 'default' }, ...o7 }),
        'AC3.5: phiên không bypass, hàng (' + n + ') ' + cmd.slice(0, 30) + ' = guarded');
    }
    // ── guard-files (Task 4) ──
    const HOME = u(path.join(tb, 'home'));
    const fsafe = (input, { cfg, opts = {}, extra = {} } = {}) => { try { return files.decide({ cwd: P, permission_mode: BYPASS, ...extra, ...input }, { repoRoot: P, config: cfg, allowEnv: () => false, scopes: {}, ...opts }); } catch (e) { return { decision: 'throw ' + e.message }; } };
    const fk = (input, opt) => fsafe(input, opt)?.decision ?? null;
    const R = (file) => ({ tool_name: 'Read', tool_input: { file_path: file } });
    const W = (file, tool = 'Write') => ({ tool_name: tool, tool_input: { file_path: file } });
    const G = (p, glob) => ({ tool_name: 'Grep', tool_input: { path: p, glob } });
    const frows = (list, opt) => { for (const [name, input, want, ac] of list) ok(fk(input, opt) === want, `${ac}: ${name} → ${want}`); };

    // AC2.3: open bỏ SECRET_DENY, nhốt root, <tmp>/claude cho công cụ file.
    const openFree = [['Read .env', R(`${P}/.env`)], ['Read id_rsa', R(`${P}/id_rsa`)], ['Read credentials.json', R(`${P}/credentials.json`)], ['Grep glob .env*', G(P, '.env*')],
      ['Write ngoài root', W(`${OUT}/x`)], ['Read ngoài root', R(`${OUT}/x`)], ['Write <tmp>/claude/x', W(`${tmpClaude}/x`)], ['Read aip-gate.json', R(`${P}/.claude/aip-gate.json`)]];
    frows(openFree.map(([n, i]) => [n, i, null, 'AC2.3']), { cfg: OPEN });
    frows([['Read ngoài root', R(`${OUT}/x`), 'deny', 'AC2.3'], ['Write ngoài root', W(`${OUT}/x`), 'deny', 'AC2.3']], { cfg: { mode: 'confined' } });
    frows([['Read .env', R(`${P}/.env`), 'deny', 'AC2.3'], ['Read id_rsa', R(`${P}/id_rsa`), 'deny', 'AC2.3'], ['Grep glob .env*', G(P, '.env*'), 'deny', 'AC2.3']], { cfg: GUARDED });

    // AC2.4: open vẫn áp writeScope.
    const scoped = { extra: { agent_type: 'coder' }, opts: { scopes: { coder: ['src/**'] } } };
    frows([['Edit docs ngoài scope', W(`${P}/docs/a.md`, 'Edit'), 'deny', 'AC2.4'], ['Write ngoài root', W(`${OUT}/x`), 'deny', 'AC2.4'], ['Write aip-gate.json', W(`${P}/.claude/aip-gate.json`), 'deny', 'AC2.4'],
      ['Edit trong scope', W(`${P}/src/a.js`, 'Edit'), null, 'AC2.4']], { cfg: OPEN, ...scoped });

    // AC2.11 (guard-files): open chặn ghi file cấu hình quyền, không ask; guarded giữ ask và không đổi với scope-lock.json.
    const cfgTargets = [['Write aip-gate.json', W(`${P}/.claude/aip-gate.json`)], ['Edit settings.json', W(`${P}/.claude/settings.json`, 'Edit')], ['Write settings.local.json', W(`${P}/.claude/settings.local.json`)],
      ['Write scope-lock.json', W(`${HOME}/.claude/plugins/x/core/hooks/scope-lock.json`)]];
    frows(cfgTargets.map(([n, i]) => [n, i, 'deny', 'AC2.11']), { cfg: OPEN });
    frows(cfgTargets.slice(0, 3).map(([n, i]) => [n, i, 'ask', 'AC2.11']), { cfg: GUARDED });
    frows([['Write scope-lock.json', cfgTargets[3][1], null, 'AC2.11']], { cfg: GUARDED });

    // AC3.3/AC3.4: confined không còn ask ở guard-files.
    const readD = u(path.join(tb, 'readonly'));
    const confinedCfg = { mode: 'confined', fullPaths: [{ path: readD, allow: ['read'] }] };
    const confinedRows = [['Read ngoài root', R(`${OUT}/x`)], ['Read $HOME', R('$HOME/x')], ['Grep ngoài root', G(OUT, undefined)], ['Read .env ở thư mục chỉ-đọc', R(`${readD}/.env`)], ['Grep glob *.pem ở thư mục chỉ-đọc', G(readD, '*.pem')],
      ['Write aip-gate.json', W(`${P}/.claude/aip-gate.json`)], ['Edit settings.json', W(`${P}/.claude/settings.json`, 'Edit')]];
    for (const [n, i] of confinedRows) {
      const d = fsafe(i, { cfg: confinedCfg });
      ok(d?.decision === 'deny' && d.reason.includes('Mở:'), `AC3.3: confined ${n} → deny nêu "Mở:" (${d?.decision})`);
    }
    frows([['Grep glob *.pem ở thư mục chỉ-đọc', G(readD, '*.pem'), 'deny', 'AC3.3'], ['Write aip-gate.json', W(`${P}/.claude/aip-gate.json`), 'ask', 'AC3.3'], ['Edit settings.json', W(`${P}/.claude/settings.json`, 'Edit'), 'ask', 'AC3.3']], { cfg: GUARDED });
    frows([['Grep glob *.pem trong root đủ quyền', G(P, '*.pem'), null, 'AC3.3']], { cfg: confinedCfg });
    frows([['Grep glob *.pem ở thư mục chỉ-đọc', G(readD, '*.pem'), null, 'AC3.3']], { cfg: { mode: 'open' } });
    for (const [n, i] of [...openFree, ...cfgTargets, ...confinedRows]) ok(fk(i, { cfg: confinedCfg }) !== 'ask', `AC3.4: confined không bao giờ ask: ${n}`);

    // AC2.12 (K14): mức chặt hơn giữa cấu hình theo cwd và theo thư mục file đích; repo lồng P/tmp có thể là open.
    const D = `${P}/tmp`;
    const stricter = (a, b) => (a === 'guarded' || b === 'guarded' ? 'guarded' : a === 'confined' || b === 'confined' ? 'confined' : 'open');
    const byDir = (cwdMode, tgtMode) => ({ config: undefined, reader: (dir) => ({ config: { mode: u(dir) === P ? cwdMode : tgtMode }, roots: [P] }) });
    const rows212 = [['Read D/.env', R(`${D}/.env`)], ['Write OUT/x', W(`${OUT}/x`)], ['Read OUT/x', R(`${OUT}/x`)], ['Write D/.claude/aip-gate.json', W(`${D}/.claude/aip-gate.json`)]];
    for (const [cm, tm] of [['confined', 'open'], ['guarded', 'open'], ['open', 'confined'], ['open', 'guarded'], ['open', 'open']]) {
      for (const [n, i] of rows212) {
        const got = fsafe(i, { opts: byDir(cm, tm) });
        const want = fsafe(i, { cfg: { mode: stricter(cm, tm) } });
        ok(got?.decision === want?.decision && (got?.decision !== 'deny' || got.reason.length > 0), `AC2.12: cwd=${cm} đích=${tm} ${n} = mức chặt hơn (${got?.decision})`);
      }
    }
    ok(fk(R(`${OUT}/x`), { opts: byDir('confined', 'open') }) === 'deny' && fk(R(`${D}/.env`), { opts: byDir('guarded', 'open') }) === 'deny', 'AC2.12: repo lồng open không phá rào của cwd confined/guarded');
    ok(fk(R(`${OUT}/x`), { opts: byDir('open', 'open') }) === null && fk(W(`${D}/.claude/aip-gate.json`), { opts: byDir('open', 'open') }) === 'deny', 'AC2.12: open ở cả hai nơi → null cho đọc ngoài root, deny ghi cấu hình');

    // Thư mục đích không có cấu hình (thư mục plugin, ~/.claude, ngoài repo) kế thừa mode của cwd; không tự thành guarded (K13 ở thư mục plugin).
    const noGate = (cwdMode) => ({ config: undefined, reader: (dir) => (u(dir) === P ? { config: { mode: cwdMode }, roots: [P] } : null) });
    const scopeLock = `${HOME}/.claude/plugins/x/core/hooks/scope-lock.json`;
    frows([['Write scope-lock.json ở thư mục plugin', W(scopeLock), 'deny', 'AC2.11'], ['Write ~/.claude/settings.json', W(`${HOME}/.claude/settings.json`), 'deny', 'AC2.11'],
      ['Write ~/.claude/aip-gate.json', W(`${HOME}/.claude/aip-gate.json`), 'deny', 'AC2.11'], ['Read ~/.aws/credentials', R(`${HOME}/.aws/credentials`), null, 'AC2.3'],
      ['Read .env ngoài repo', R(`${OUT}/.env`), null, 'AC2.3']], { opts: noGate('open') });
    frows([['Read .env ngoài repo', R(`${OUT}/.env`), 'deny', 'AC2.12'], ['Write ~/.claude/settings.json', W(`${HOME}/.claude/settings.json`), 'ask', 'AC2.12']], { opts: noGate('guarded') });
    frows([['Read .env ngoài repo', R(`${OUT}/.env`), 'deny', 'AC2.12']], { opts: noGate('confined') });

    // Đường UNC không bị statSync (mở SMB trong hook trước hộp xác nhận); Grep thư mục cục bộ ở phiên bypass vẫn hỏi isDirectory (đối chứng), phiên không bypass thì không.
    const statCalls = (extra, p) => { const seen = []; fsafe(G(p, undefined), { cfg: OPEN, extra, opts: { isDirectory: (x) => { seen.push(x); return true; } } }); return seen.length; };
    ok(statCalls({ permission_mode: 'default' }, '//attacker/share/x') === 0, 'AC2.12: phiên không bypass + Grep path UNC → không statSync');
    // Chỉ Windows: trên POSIX path.resolve('//h/s') thành '/h/s' (đường dẫn thường), nên không phải UNC.
    ok(process.platform !== 'win32' || statCalls({}, '//attacker/share/x') === 0, 'AC2.12: phiên bypass + Grep path UNC → không statSync (Windows)');
    ok(statCalls({ permission_mode: 'default' }, OUT) === 0 && statCalls({}, OUT) === 1, 'AC2.12: Grep path cục bộ: bypass hỏi isDirectory một lần, không bypass thì không');

    // Gate hỏng hoặc không xác định được repo không phải "không có cấu hình": vẫn guarded, không kế thừa open của cwd.
    frows([['Read .env ở đích có gate hỏng', R(`${OUT}/.env`), 'deny', 'AC2.12'], ['Write ~/.claude/settings.json ở đích có gate hỏng', W(`${HOME}/.claude/settings.json`), 'ask', 'AC2.12']], { opts: { ...noGate('open'), inspect: () => 'invalid' } });
    // Cùng ca với bộ dò thật (locateGate): repo git có .claude/aip-gate.json hỏng.
    const badRepo = u(path.join(tb, 'bad'));
    fs.mkdirSync(`${badRepo}/.claude`, { recursive: true });
    ctx.execFileSync('git', ['init', '-q', badRepo]);
    fs.writeFileSync(`${badRepo}/.claude/aip-gate.json`, '{ not json');
    frows([['Read .env ở repo có gate hỏng (bộ dò thật)', R(`${badRepo}/.env`), 'deny', 'AC2.12']], { opts: { config: undefined, reader: (dir) => (u(dir) === P ? { config: { mode: 'open' }, roots: [P] } : null) } });
    // Grep trỏ vào thư mục có cấu hình riêng: mode của chính thư mục đó (không phải thư mục cha) cùng cwd quyết định.
    const grepDir = { config: undefined, reader: (dir) => (u(dir) === u(OUT) ? { config: { mode: 'confined' }, roots: [P] } : u(dir) === P ? { config: { mode: 'open' }, roots: [P] } : null) };
    fs.mkdirSync(OUT, { recursive: true });
    frows([['Grep thư mục ngoài root có cấu hình confined, cwd open', G(OUT, undefined), 'deny', 'AC2.12']], { opts: grepDir });

    // K14 cho Grep (không có file): thư mục của path quyết định cùng cwd; K15: cwd confined + đích guarded, lỗi sau xác định mode thì mode cuối là guarded.
    frows([['Grep .env* ở repo lồng confined, cwd guarded', G(D, '.env*'), 'deny', 'AC2.12']], { opts: byDir('guarded', 'confined') });
    frows([['Grep .env* ở repo lồng open, cwd guarded', G(D, '.env*'), 'deny', 'AC2.12']], { opts: byDir('guarded', 'open') });
    frows([['Grep .env* ở repo lồng open, cwd confined', G(D, '.env*'), null, 'AC2.12']], { opts: byDir('confined', 'open') });
    ok(fsafe(W(`${D}/src/a.js`, 'Edit'), { extra: { agent_type: 'coder' }, opts: { ...byDir('confined', 'guarded'), scopes: { get coder() { throw new Error('boom'); } } } })?.decision?.startsWith('throw'),
      'K15: cwd confined + đích guarded, lỗi sau bước xác định mode → mode cuối là guarded (ném như hôm nay)');

    // AC2.9/AC3.6 (guard-files): lỗi không tự mở cổng; confined lỗi sau xác định mode ⇒ deny, guarded fail-open như hôm nay.
    ok(fk(R(`${P}/.env`), { cfg: undefined, opts: { reader: () => { throw new Error('boom'); } } }) === 'deny', 'AC2.9: reader ném ⇒ như guarded: Read .env → deny');
    const scopesBoom = { get coder() { throw new Error('boom'); } };
    const sb = { extra: { agent_type: 'coder' }, opts: { scopes: scopesBoom } };
    const eb = fsafe(W(`${P}/src/a.js`, 'Edit'), { cfg: { mode: 'confined' }, ...sb });
    ok(eb?.decision === 'deny' && eb.reason.includes('Mở:'), `AC3.6: confined, lỗi nội bộ → deny nêu "Mở:" (${eb?.decision})`);
    ok(fsafe(W(`${P}/src/a.js`, 'Edit'), { cfg: GUARDED, ...sb })?.decision?.startsWith('throw'), 'AC3.6: đối chứng guarded, cùng seam ném → ném như hôm nay (main() fail-open)');
    ok(fk(W(`${P}/.claude/aip-gate.json`, 'Edit'), { cfg: OPEN, ...sb }) === 'deny' && fk(W(`${P}/src/a.js`, 'Edit'), { cfg: OPEN, ...sb }) === null, 'K15: open, lỗi sau bước kiểm: chỉ deny khi đích là file cấu hình, còn lại null');
    // ── guard-mcp (Task 5) ──
    const mcp = await load('guard-mcp.mjs');
    const SS = 'mcp__ccd_session__start_session';
    const mk = (tool, opt = {}) => { const { cfg, tracked, locate } = opt; const pm = 'pm' in opt ? opt.pm : BYPASS; try { return mcp.decide({ tool_name: tool, cwd: '.', permission_mode: pm }, { config: cfg, tracked, locate }); } catch (e) { return { decision: `throw ${e.message}` }; } };
    const mkind = (tool, opt) => mk(tool, opt)?.decision ?? null;

    // AC2.5/AC2.6: open bỏ deny start_session thiếu model và mcpAllow; mcpDeny vẫn giữ. Đối chứng guarded.
    ok(mkind(SS, { cfg: OPEN }) === null && mkind('mcp__b__t', { cfg: { mode: 'open', mcpAllow: ['a'] } }) === null, 'AC2.5: open → start_session thiếu model và mcpAllow chặn server ngoài danh sách đều null');
    ok(mkind(SS, { cfg: GUARDED }) === 'deny' && mkind('mcp__b__t', { cfg: { mode: 'guarded', mcpAllow: ['a'] } }) === 'deny', 'AC2.5: đối chứng guarded → deny cả hai');
    ok(mkind('mcp__b__t', { cfg: { mode: 'open', mcpDeny: ['b'] } }) === 'deny' && mkind('mcp__b__t', { cfg: { mode: 'open', mcpDeny: ['b'], mcpAllow: ['b'] } }) === 'deny'
      && mkind('mcp__c__t', { cfg: { mode: 'open', mcpDeny: ['b'] } }) === null, 'AC2.6: open giữ mcpDeny (kể cả khi mcpAllow có server đó); server khác → null');

    // AC2.10: file cấu hình hỏng → ask ở mọi mode, vì không có config dùng được (open/confined không hiệu lực).
    for (const pm of [BYPASS, 'default']) ok(mkind('mcp__b__t', { pm, locate: () => ({ gate: null, invalid: '/x/.claude/aip-gate.json' }) }) === 'ask', `AC2.10: gate hỏng → ask (${pm})`);

    // AC2.9 (guard-mcp): đọc cấu hình ném lỗi thì không tự mở cổng: start_session thiếu model vẫn deny.
    ok(mkind(SS, { locate: () => { throw new Error('boom'); } }) === 'deny', 'AC2.9: locate ném ⇒ như guarded: start_session thiếu model → deny');

    // AC3.6 (guard-mcp): lỗi sau bước xác định mode: confined ⇒ deny, open ⇒ null, guarded ném như hôm nay.
    const boomCfg = (mode) => ({ mode, get mcpDeny() { throw new Error('boom'); } });
    const cb = mk('mcp__b__t', { cfg: boomCfg('confined') });
    ok(cb?.decision === 'deny' && cb.reason.includes('aip mode open'), `AC3.6: confined, lỗi nội bộ → deny nêu aip mode open (${cb?.decision})`);
    ok(mkind('mcp__b__t', { cfg: boomCfg('open') }) === null, 'AC3.6/K15: open, lỗi nội bộ → null (không bao giờ hỏi)');
    ok(mkind('mcp__b__t', { cfg: boomCfg('guarded') }).startsWith('throw'), 'AC3.6: đối chứng guarded, cùng seam ném → ném như hôm nay (main() fail-open)');

    // ── bảng chéo ba hook: bí danh (AC1.2) và thiếu một điều kiện (AC2.7) ──
    const repBash = ['git push origin master', 'git commit -m "dấu"', 'cat .env', `rm -rf ${OUT}/x`];
    const repFiles = [R(`${P}/.env`), W(`${P}/.claude/aip-gate.json`), R(`${OUT}/x`)];
    const mcpAllow = ['a'];
    const everywhere = (base, pm) => JSON.stringify([
      ...repBash.map((c) => safe(c, { cfg: base, extra: { permission_mode: pm } })),
      ...repFiles.map((i) => fsafe(i, { cfg: base, extra: { permission_mode: pm } })),
      mk('mcp__b__t', { cfg: { ...base, mcpAllow }, pm }), mk(SS, { cfg: base, pm }),
    ]);
    const everywhereTracked = (base) => {
      const found = { gate: { config: { ...base, mcpAllow }, file: `${P}/.claude/aip-gate.json` }, invalid: null };
      return JSON.stringify([
        ...repBash.map((c) => safe(c, { cfg: undefined, opts: trackedGate(base) })),
        ...repFiles.map((i) => fsafe(i, { cfg: undefined, opts: trackedGate(base) })),
        mk('mcp__b__t', { locate: () => found, tracked: () => true }),
        mk(SS, { locate: () => ({ ...found, gate: { ...found.gate, config: base } }), tracked: () => true }),
      ]);
    };
    const guardedAll = (pm) => everywhere(GUARDED, pm);
    for (const pm of [BYPASS, 'default']) {
      for (const base of [{}, { mode: 'ask' }, { mode: 'bypass' }]) ok(everywhere(base, pm) === guardedAll(pm), `AC1.2: ${JSON.stringify(base)} ≡ guarded ở ba hook (${pm})`);
      ok(everywhere({ mode: 'full' }, pm) === everywhere({ mode: 'confined' }, pm), `AC1.2: full ≡ confined ở ba hook (${pm})`);
    }
    ok(everywhere({ mode: 'confined' }, BYPASS) !== guardedAll(BYPASS), 'AC1.2: confined khác guarded ở phiên bypass (bảng không rỗng nghĩa)');
    for (const pm of [undefined, 'default', 'acceptEdits', 'auto', 'dontAsk']) {
      ok(everywhere({ mode: 'open' }, pm) === guardedAll(pm), `AC2.7: open nhưng phiên không bypass (${pm ?? 'thiếu'}) ≡ guarded ở ba hook`);
      ok(everywhere({ mode: 'confined' }, pm) === guardedAll(pm), `AC3.5: confined nhưng phiên không bypass (${pm ?? 'thiếu'}) ≡ guarded ở ba hook`);
    }
    for (const v of ['ask', 'guarded', 'Open', 'OPEN', 'bypass', 1, null, ['open'], ' open']) ok(everywhere({ mode: v }, BYPASS) === guardedAll(BYPASS), `AC2.7: mode ${JSON.stringify(v)} ≡ guarded ở ba hook`);
    ok(everywhere({ mode: 'open' }, BYPASS) !== guardedAll(BYPASS) && everywhere({ mode: 'open' }, BYPASS) !== everywhere({ mode: 'confined' }, BYPASS), 'AC2.7: open khác guarded và confined khi đủ điều kiện (bảng không rỗng nghĩa)');
    ok(everywhereTracked({ mode: 'open' }) === everywhereTracked({ mode: 'guarded' }), 'AC2.7: open nhưng file bị git theo dõi ≡ guarded ở ba hook');
    ok(everywhereTracked({ mode: 'confined' }) === everywhereTracked({ mode: 'guarded' }), 'AC3.5: confined nhưng file bị git theo dõi ≡ guarded ở ba hook');
    // Phiên không bypass không đọc cấu hình khi deny start_session thiếu model (ràng buộc đường nóng).
    let reads = 0;
    const counting = () => { reads++; return { gate: { config: OPEN }, invalid: null }; };
    ok(mkind(SS, { pm: 'default', locate: counting }) === 'deny' && reads === 0, 'AC2.9: start_session thiếu model ở phiên không bypass → deny, không đọc cấu hình');
    ok(mkind(SS, { pm: BYPASS, locate: counting }) === null && reads === 1, 'AC2.5: phiên bypass + open đọc cấu hình đúng một lần → null');
    // ── session-start báo mode (Task 6) ──
    const ss = await load('session-start.mjs');
    const gateOf = (mode, extra = {}) => ({ config: mode === undefined ? { ...extra } : { mode, ...extra }, file: `${P}/.claude/aip-gate.json` });
    const startAs = (source, g, over = {}) => ss.decide({ cwd: tb, source }, { loadGate: () => g, gateTracked: () => false, loadConfig: () => g?.config ?? null, ...over });
    const head = (r) => (r?.additionalContext ?? '').split('\n')[0];
    const MODE_RE = /^aip: mode hiệu lực = (\w+)/;
    for (const source of ['startup', 'clear', 'compact']) {
      for (const [mode, want] of [['confined', 'confined'], ['full', 'confined'], ['open', 'open'], ['guarded', null], ['ask', null], [undefined, null], ['bypass', null], ['constructor', null]]) {
        const line = head(startAs(source, gateOf(mode)));
        const got = MODE_RE.exec(line)?.[1] ?? null;
        ok(got === want && (!want || line.includes('.claude/aip-gate.json')), `AC6.1: ${source} mode=${JSON.stringify(mode)} → ${want ? `dòng "mode hiệu lực = ${want}" kèm nguồn` : 'không có dòng báo mode'}`);
      }
    }
    for (const source of ['resume', 'fork']) {
      const r = ss.decide({ cwd: tb, source, prompt_cache_likely_expired: true }, { loadGate: () => gateOf('open'), gateTracked: () => false, loadConfig: () => gateOf('open').config });
      ok(r?.additionalContext?.includes('Phiên nguội') && !r.additionalContext.includes('mode hiệu lực'), `AC6.1: ${source} có cảnh báo nguội nhưng không báo mode`);
    }
    ok(!MODE_RE.test(head(startAs('startup', gateOf('open'), { gateTracked: () => true }))), 'AC6.1: file bị git theo dõi → không báo mode');
    ok(!MODE_RE.test(head(startAs('startup', gateOf('open'), { gateTracked: () => null }))), 'AC6.1: không xác định được git theo dõi → không báo mode (hướng an toàn)');

    const injected = startAs('startup', { ...gateOf('open'), file: `${P}/.claude/aip-gate.json\nINJECTED: x` });
    ok(!(injected?.additionalContext ?? '').split('\n').some((l) => l.startsWith('INJECTED')) && MODE_RE.test(head(injected)), 'AC6.1: đường dẫn nguồn có xuống dòng không chèn thêm dòng vào context');

    // AC6.2: dòng báo mode không phụ thuộc bootstrapInject, nằm trong ngân sách MAX_TOTAL, lỗi đọc cấu hình thì hook không chặn.
    const noBoot = startAs('startup', gateOf('open', { bootstrapInject: false }));
    ok(MODE_RE.test(head(noBoot)) && !noBoot.additionalContext.includes('using-aip'), 'AC6.2: bootstrapInject false vẫn có dòng báo mode, không có bootstrap');
    const handoffFile = `${tb}/handoff.md`;
    fs.writeFileSync(handoffFile, `# Handoff\n${'x'.repeat(30000)}\n`);
    const crowded = startAs('startup', gateOf('confined', { handoffPath: 'handoff.md' }));
    ok(MODE_RE.test(head(crowded)) && crowded.additionalContext.length <= 9000 && crowded.additionalContext.includes('Handoff của phiên trước'), `AC6.2: handoff dài + dòng báo mode vẫn tổng ≤ 9000 (${crowded?.additionalContext?.length})`);
    const broken = startAs('startup', gateOf('open'), { loadGate: () => { throw new Error('boom'); } });
    ok(!MODE_RE.test(head(broken)) && broken.additionalContext.includes('using-aip'), 'AC6.2: loadGate ném lỗi → không có dòng báo mode, hook không ném, vẫn trả bootstrap');
  } finally {
    fs.rmSync(tb, { recursive: true, force: true });
  }
}
