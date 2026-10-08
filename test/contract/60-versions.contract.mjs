// Contract versions: core manifest, semver, lock hash và doctor.
export default async function run({ ok, ctx }) {
  const { fs, path, os, loadCore, CORE_DIR, hashDir, currentVersions, planLock, lockDecision, diffLock, readLock, parseClaudePluginList, core, plugins, workflows, BUILD } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 34. Version gate: core manifest, semver + đồng bộ version, lock hash↔version, doctor (spec 2026-10-07 audit E5 / P0.3)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const coreMf = path.join(CORE_DIR, '.manifest.json');
    ok(fs.existsSync(coreMf), 'core: có core/.manifest.json');
    const cm = fs.existsSync(coreMf) ? JSON.parse(fs.readFileSync(coreMf, 'utf8')) : {};
    ok(cm.id === 'core' && core.version === cm.version && core.description === cm.description,
      'core: loadCore đọc id/version/description từ manifest');
    const units = [core, ...plugins, ...(workflows ? [workflows] : [])];
    for (const u of units) ok(/^\d+\.\d+\.\d+$/.test(u.version), `${u.id}: version semver (${u.version})`);
    const claudeDir34 = path.join(BUILD, 'claude');
    if (fs.existsSync(claudeDir34)) {
      const mk = JSON.parse(fs.readFileSync(path.join(claudeDir34, '.claude-plugin', 'marketplace.json'), 'utf8'));
      const mkNames = new Set(mk.plugins.map((x) => x.name));
      for (const u of units) {
        const pj = JSON.parse(fs.readFileSync(path.join(claudeDir34, 'plugins', u.id, '.claude-plugin', 'plugin.json'), 'utf8'));
        const entry = mk.plugins.find((x) => x.name === u.id) || {};
        ok(pj.version === u.version && entry.version === u.version, `${u.id}: version đồng bộ manifest = plugin.json = marketplace`);
        ok((pj.dependencies || []).every((d) => mkNames.has(d)), `${u.id}: dependencies ⊂ marketplace`);
      }
      // Lock = chân lý đã commit của "build của version này"; lệch ⇒ chạy node cli/lib/versions.mjs --lock (nó từ chối nếu chưa bump).
      const diff = diffLock(currentVersions(), readLock());
      ok(diff.length === 0, `versions lock khớp build${diff.length ? ' — ' + diff.slice(0, 3).join(' | ') : ''}`);
    }
    // Thuần: hash ổn định, nhạy nội dung; planLock từ chối khi hash đổi mà version giữ nguyên.
    const tmp34 = fs.mkdtempSync(path.join(os.tmpdir(), 'ver-'));
    try {
      fs.mkdirSync(path.join(tmp34, 'a'));
      fs.writeFileSync(path.join(tmp34, 'a', 'x.md'), 'một');
      const h1 = hashDir(tmp34);
      ok(h1 === hashDir(tmp34) && /^[0-9a-f]{64}$/.test(h1), 'hashDir: tất định, sha256 hex');
      fs.writeFileSync(path.join(tmp34, 'a', 'x.md'), 'hai');
      ok(hashDir(tmp34) !== h1, 'hashDir: đổi nội dung → đổi hash');
      fs.writeFileSync(path.join(tmp34, 'a', 'x.md'), 'x\r\n');
      const hCrlf = hashDir(tmp34);
      fs.writeFileSync(path.join(tmp34, 'a', 'x.md'), 'x\n');
      ok(hCrlf === hashDir(tmp34), 'hashDir: CRLF và LF cho cùng hash (gate không đỏ giả khi working tree còn CRLF)');
    } finally { fs.rmSync(tmp34, { recursive: true, force: true }); }
    const prev = { core: { version: '1.0.0', hash: 'h1' }, be: { version: '2.0.0', hash: 'k1' } };
    const cur = { core: { version: '1.0.0', hash: 'h2' }, be: { version: '2.0.1', hash: 'k2' }, fe: { version: '0.1.0', hash: 'f' } };
    const plan34 = planLock(cur, prev);
    ok(plan34.refused.length === 1 && plan34.refused[0].id === 'core', 'planLock: hash đổi + version giữ → từ chối đúng plugin');
    ok(plan34.next.be.hash === 'k2' && plan34.next.fe && plan34.next.core.hash === 'h1', 'planLock: entry hợp lệ cập nhật, entry mới thêm, entry bị từ chối giữ cũ');
    ok(diffLock(cur, prev).length === 3 && diffLock(cur, { ...cur }).length === 0, 'diffLock: báo lệch hash/version/thiếu id; khớp → rỗng');
    const dMissing = lockDecision({ a: { version: '1', hash: 'h' } }, { a: { version: '1', hash: 'h' }, b: { version: '1', hash: 'g' } });
    ok(!dMissing.write && dMissing.code === 2 && dMissing.missing[0] === 'b', 'lockDecision: build thiếu id trong lock → không ghi, exit 2');
    const dRefuse = lockDecision({ a: { version: '1', hash: 'h2' } }, { a: { version: '1', hash: 'h' } });
    ok(!dRefuse.write && dRefuse.code === 1 && dRefuse.refused.length === 1, 'lockDecision: hash đổi version giữ → không ghi, exit 1');
    const dOk = lockDecision({ a: { version: '2', hash: 'h2' }, c: { version: '1', hash: 'x' } }, { a: { version: '1', hash: 'h' } });
    ok(dOk.write && dOk.code === 0 && dOk.next.c && dOk.next.a.version === '2', 'lockDecision: bump hợp lệ + plugin mới → ghi');
    const gone34 = diffLock({ a: { version: '1', hash: 'h' } }, { a: { version: '1', hash: 'h' }, gone: { version: '1', hash: 'g' } });
    ok(gone34.length === 1 && gone34[0].includes('không còn trong build'), 'diffLock: báo entry có trong lock nhưng không còn trong build');
    const sample = 'Installed plugins:\n\n  ❯ backend@ai-engineering-platform\n    Version: 1.2.0\n    Scope: user\n    Status: ✔ enabled\n\n  ❯ feature-dev@claude-plugins-official\n    Version: 2a8ad9f74633\n\n  ❯ workflows@ai-engineering-platform\n    Version: 1.0.0\n    Status: ✘ failed to load\n';
    ok(JSON.stringify(parseClaudePluginList(sample, 'ai-engineering-platform')) === '[{"id":"backend","version":"1.2.0"},{"id":"workflows","version":"1.0.0"}]',
      'parseClaudePluginList: lấy đúng plugin của marketplace + version');
  }
}
