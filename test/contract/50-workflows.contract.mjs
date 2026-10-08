// Contract workflows: drift guard workflow, hard-dependency và script Phase 1.
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, REPO_ROOT, PLUGINS_DIR, CORE_DIR, missingAnchors, registrySignals, claudeAdapter, core, plugins, allAgents, workflows, BUILD, fxPlugin, fxWorkflows, fxCore, fxMk, byPath, checkDescriptionStyle, notForTargets, claudeDir } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 27. Chuẩn hoá A4: drift guard workflow ↔ template, Registry ↔ description (spec 2026-10-06 §4.4, §10)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const tpl27 = fs.readFileSync(path.join(REPO_ROOT, 'templates', 'workflows', 'workflow.template.md'), 'utf8').replace(/\r\n/g, '\n');
    ok(missingAnchors(tpl27).length === 0, 'template workflow chứa mọi dòng neo WF_ANCHORS');
    ok(!tpl27.includes('Không có subagent'), 'template workflow: không lặp câu fallback subagent (adapter đã chèn preamble)');
    ok(missingAnchors(tpl27.replace('Thiếu điều kiện nào → dừng', 'Thiếu điều kiện → dừng')).length === 1,
      'missingAnchors: lệch một chữ → báo thiếu');
    ok(missingAnchors(tpl27.replace(/\n/g, '\r\n')).length === 0, 'missingAnchors: chấp nhận CRLF');
    const fx27 = registrySignals(['## Registry', '| id | Tín hiệu | Risk | Nối tiếp | Không dùng khi |', '|---|---|---|---|---|',
      '| `workflow-x` | "a b", stacktrace, "c" | low | — | x |', '## Khác'].join('\n'));
    ok(JSON.stringify(fx27.get('workflow-x')) === '["a b","c"]', 'registrySignals: chỉ lấy cụm trong ngoặc kép');
    if (workflows) {
      for (const s of workflows.stages) {
        const miss = missingAnchors(s.body);
        ok(miss.length === 0, `${s.id}: đủ dòng neo khung${miss.length ? ' — thiếu: ' + miss.join(' | ') : ''}`);
      }
      const orch27 = workflows.stages.find((s) => s.kind === 'orchestrator');
      const sig27 = registrySignals(orch27 ? orch27.body : '');
      ok(sig27.size === workflows.stages.filter((s) => s.kind === 'workflow').length, 'registrySignals: đọc đủ dòng Registry');
      for (const [id, sigs] of sig27) {
        const w = workflows.stages.find((s) => s.id === id);
        const d = (w ? w.description : '').toLowerCase();
        const miss = sigs.filter((x) => !d.includes(x.toLowerCase()));
        ok(miss.length === 0, `${id}: mọi tín hiệu Registry có trong description${miss.length ? ' — thiếu: ' + miss.join(', ') : ''}`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 32. workflows: hard-dependency tường minh + plugin còn lại ghi trong preamble (spec 2026-10-07 audit E6 / P0.2)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    if (workflows) {
      const hard = workflows.manifest.hardDependencies;
      ok(Array.isArray(hard) && hard.includes('core') && hard.length < plugins.length + 1,
        'workflows manifest: hardDependencies tường minh, có core, không bao trùm mọi plugin');
      ok(/^\d+\.\d+\.\d+$/.test(workflows.version) && workflows.version !== '1.0.0', 'workflows manifest: version đã bump khỏi 1.0.0');
      const pluginOfAgent = new Map(allAgents.map((a) => [a.id, a.plugin]));
      for (const wf of workflows.stages) {
        const need = new Set([...wf.requires.map((r) => r.split('/')[0]), ...wf.agents.map((a) => pluginOfAgent.get(a)).filter(Boolean)]);
        const soft = [...need].filter((p) => !(hard || []).includes(p)).sort();
        const built = path.join(BUILD, 'claude', 'plugins', 'workflows', 'skills', wf.id, 'SKILL.md');
        const c = fs.existsSync(built) ? fs.readFileSync(built, 'utf8') : '';
        if (soft.length) {
          ok(c.includes(`> **Plugin cần có:** ${soft.map((p) => `\`${p}\``).join(', ')}`),
            `${wf.id}: preamble nêu plugin ngoài hard-dep (${soft.join(',')})`);
        } else {
          ok(!c.includes('**Plugin cần có:**'), `${wf.id}: không có plugin ngoài hard-dep → không có dòng "Plugin cần có"`);
        }
      }
    }
    // Fixture: hardDependencies lọc theo plugin có mặt; thiếu hardDependencies → giữ hành vi cũ (union).
    const fxWfHard = { ...fxWorkflows, manifest: { hardDependencies: ['core', 'fx', 'absent-plugin'] } };
    const outH = byPath(claudeAdapter.build([fxPlugin], { marketplace: fxMk, core: fxCore, workflows: fxWfHard }));
    const pjH = JSON.parse(outH.get('plugins/workflows/.claude-plugin/plugin.json').content);
    ok(JSON.stringify(pjH.dependencies) === '["core","fx"]', 'claude workflows: hardDependencies lọc plugin vắng mặt');
    const fxWfSoft = { ...fxWorkflows, manifest: { hardDependencies: ['core'] } };
    const outS = byPath(claudeAdapter.build([fxPlugin], { marketplace: fxMk, core: fxCore, workflows: fxWfSoft }));
    ok(JSON.parse(outS.get('plugins/workflows/.claude-plugin/plugin.json').content).dependencies.length === 1
      && outS.get('plugins/workflows/skills/workflow-demo/SKILL.md').content.includes('> **Plugin cần có:** `fx`'),
      'claude workflows: plugin ngoài hard-dep → không vào dependencies, có dòng Plugin cần có');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 37. Workflow/orchestrator/script Phase 1 (spec 2026-10-07 audit W7, S6; final-review M8 / P1.4, P1.5)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    if (workflows) {
      const orch = fs.readFileSync(path.join(workflows.dir, 'orchestrator', 'WORKFLOW.md'), 'utf8');
      ok(orch.includes('claude plugin install workflows@') && orch.includes('aip install --skill workflows/'),
        'orchestrator Bước 2: lệnh cài theo cả hai cách (phẳng + plugin Claude)');
      for (const [slug, plug] of [['db-change', 'data'], ['incident', 'ops'], ['release', 'ops']]) {
        const w = fs.readFileSync(path.join(workflows.dir, slug, 'WORKFLOW.md'), 'utf8');
        ok(new RegExp(`Plugin cần cài thêm:.*\`${plug}\``).test(w), `workflow-${slug}: điều kiện tiên quyết nêu plugin ${plug}`);
      }
      const feat = path.join(BUILD, 'claude', 'plugins', 'workflows', 'skills', 'workflow-feature', 'SKILL.md');
      if (fs.existsSync(feat)) ok(fs.readFileSync(feat, 'utf8').includes('`∥`'), 'preamble claude: giải thích ký hiệu ∥ (nhiều Agent trong một message)');
    }
    const mig = path.join(PLUGINS_DIR, 'data', 'skills', 'data-db-migration');
    ok(fs.existsSync(path.join(mig, 'scripts', 'new-migration.sh')) && !fs.existsSync(path.join(mig, 'references', 'spring-boot', 'common', 'new-migration.sh')),
      'data-db-migration: new-migration.sh nằm ở scripts/');
    ok(fs.readFileSync(path.join(mig, 'references', 'README.md'), 'utf8').includes('../scripts/new-migration.sh'),
      'data-db-migration references/README.md: trỏ ../scripts/new-migration.sh');
    const vc = path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-migrate-vault-consul');
    ok(['seed-consul.sh', 'seed-vault.sh'].every((f) => fs.existsSync(path.join(vc, 'scripts', f)) && !fs.existsSync(path.join(vc, 'references', 'spring-boot', f))),
      'backend-migrate-vault-consul: seed-*.sh nằm ở scripts/');
    ok(fs.readFileSync(path.join(vc, 'references', 'spring-boot', 'README.md'), 'utf8').includes('`scripts/` của skill'),
      'vault-consul references/spring-boot/README.md: ghi script nằm ở `scripts/` của skill');
    const ccm = path.join(CORE_DIR, 'skills', 'git-workflow', 'scripts', 'check-commit-message.mjs');
    ok(fs.existsSync(ccm), 'git-workflow: có scripts/check-commit-message.mjs');
    if (fs.existsSync(ccm)) {
      const src = fs.readFileSync(ccm, 'utf8');
      ok(!/(?:from\s+|import\s*\(?\s*)['"](?!node:)/.test(src) && src.includes('realpathSync'), 'check-commit-message: chỉ node:*, guard realpath');
      const tmp37 = fs.mkdtempSync(path.join(os.tmpdir(), 'ccm-'));
      const run = (...args) => { try { return { code: 0, out: execFileSync(process.execPath, [ccm, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; } catch (e) { return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` }; } };
      try {
        const good = path.join(tmp37, 'ok.txt'); fs.writeFileSync(good, 'feat(x): add y\n\nChanged:\n- Thêm tính năng có dấu\n');
        const bom = path.join(tmp37, 'bom.txt'); fs.writeFileSync(bom, '\uFEFFfeat(x): add y\n\nThêm\n');
        const bad = path.join(tmp37, 'bad.txt'); fs.writeFileSync(bad, Buffer.from([0x66, 0x65, 0x61, 0x74, 0x3a, 0x20, 0x78, 0x0a, 0x0a, 0xe1, 0xba, 0x0a]));
        const hdr = path.join(tmp37, 'hdr.txt'); fs.writeFileSync(hdr, 'Thêm tính năng\n\nThân có dấu\n');
        ok(run(good).code === 0, 'check-commit-message: file hợp lệ → exit 0');
        ok(run(bom).code === 1 && /BOM/.test(run(bom).out), 'check-commit-message: BOM → exit 1');
        ok(run(bad).code === 1, 'check-commit-message: UTF-8 hỏng → exit 1');
        ok(run(hdr).code === 1 && /header/i.test(run(hdr).out), 'check-commit-message: header sai dạng → exit 1');
        const coa = path.join(tmp37, 'coa.txt'); fs.writeFileSync(coa, 'feat(x): add y\n\nChanged:\n- Thêm có dấu\n\nCo-Authored-By: X <x@y>\n');
        ok(run(coa).code === 1 && /Co-Authored-By/.test(run(coa).out), 'check-commit-message: có Co-Authored-By → exit 1');
        ok(run().code === 2, 'check-commit-message: thiếu tham số → exit 2');
      } finally { fs.rmSync(tmp37, { recursive: true, force: true }); }
    }
    const gw = fs.readFileSync(path.join(CORE_DIR, 'skills', 'git-workflow', 'SKILL.md'), 'utf8');
    ok(gw.includes('scripts/check-commit-message.mjs') && gw.includes('test-commit-message-encoding.ps1'),
      'git-workflow SKILL.md: nêu bản Node (ưu tiên) và bản PowerShell');
  }

  // Phase 2 Task 4: gate đầu cho risk cao, argument-hint, description đúng mẫu
  if (workflows) {
    const snap = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'test', 'fixtures', 'workflow-not-for-ids.json'), 'utf8'));
    for (const s of workflows.stages) {
      const errs = checkDescriptionStyle(s.description, { max: 500 });
      ok(errs.length === 0, `${s.id}: description đúng mẫu Phase 1 (≤ 500)${errs.length ? ' — ' + errs.join('; ') : ''}`);
      const now = notForTargets(s.description) || [];
      ok((snap[s.id] || []).every((id) => now.includes(id)), `${s.id}: giữ mọi "→ id" của snapshot`);
      if (s.kind === 'workflow') ok(typeof s.passthrough['argument-hint'] === 'string', `${s.id}: có argument-hint`);
    }
    const hi = workflows.stages.filter((s) => ['high', 'critical'].includes(s.risk));
    ok(hi.length === 4, `4 workflow risk ≥ high (=${hi.map((s) => s.id).join(', ')})`);
    if (fs.existsSync(claudeDir)) {
      for (const s of workflows.stages) {
        const c = fs.readFileSync(path.join(claudeDir, 'plugins/workflows/skills', s.id, 'SKILL.md'), 'utf8');
        const has = c.includes('> **⏸ Xác nhận trước khi bắt đầu:**');
        ok(has === hi.includes(s), `build claude ${s.id}: gate ⏸ đầu ${hi.includes(s) ? 'có' : 'không có'} (risk ${s.risk || '—'})`);
        if (s.passthrough['argument-hint']) ok(/^argument-hint: ".+"$/m.test(c.split('\n---')[0]), `build claude ${s.id}: argument-hint`);
      }
    }

    // Phase 2 Task 5: mọi references/<x>.md được trỏ tới phải tồn tại và được ship
    for (const s of workflows.stages) {
      const refs = [...s.body.matchAll(/`references\/([\w.-]+\.md)`/g)].map((m) => m[1]);
      for (const r of new Set(refs)) {
        ok(fs.existsSync(path.join(s.dir, 'references', r)), `${s.id}: references/${r} tồn tại`);
        if (fs.existsSync(claudeDir)) {
          ok(fs.existsSync(path.join(claudeDir, 'plugins/workflows/skills', s.id, 'references', r)), `build claude ${s.id}: ship references/${r}`);
        }
      }
    }
  }
}
