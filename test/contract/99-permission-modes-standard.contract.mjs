// Contract chuẩn hoá ba chế độ quyền guarded/confined/open (request 2026-11-19-permission-modes-standard).
export default async function run({ ok, ctx }) {
  const { fs, path, os, pathToFileURL, CORE_DIR } = ctx;
  const load = (n) => import(pathToFileURL(path.join(CORE_DIR, 'hooks', 'scripts', n)).href);
  const bash = await load('guard-bash.mjs');

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
    rows([[`rm -rf ${OUT}/x`, 'deny', 'AC2.1'], [`echo x > ${OUT}/y`, 'deny', 'AC2.1'], [`rm ${tmpClaude}`, 'deny', 'AC2.1'], ['rm $UNKNOWN/x', 'ask', 'AC2.1']], { cfg: CONFINED_FREE });
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
      'aip -y mode open', 'aip --provider claude mode open', 'aip mode -y open', 'ai-engineering-platform --no-color mode guarded'];
    rows(evasions.map((c) => [c, 'deny', 'AC2.11']), { cfg: OPEN });
    rows(evasions.map((c) => [c, 'ask', 'AC2.11']), { cfg: GUARDED });
    rows([['aip -y mode status', null, 'AC2.11'], ['aip mode --help', null, 'AC2.11']], { cfg: OPEN });

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
  } finally {
    fs.rmSync(tb, { recursive: true, force: true });
  }
}
