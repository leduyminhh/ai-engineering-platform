// Contract workflows: drift guard workflow, hard-dependency và script Phase 1.
import { checkGraph, checkGraphAgainstBody } from '../../cli/lib/workflows.mjs';
import { readGraph } from '../../cli/lib/plugins.mjs';
import { stripTemplateHeader } from '../../cli/lib/templates.mjs';

export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, REPO_ROOT, PLUGINS_DIR, CORE_DIR, missingAnchors, registrySignals, claudeAdapter, core, plugins, allAgents, workflows, BUILD, fxPlugin, fxWorkflows, fxCore, fxMk, byPath, checkDescriptionStyle, notForTargets, claudeDir, listFilesRec } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 27. Chuẩn hoá A4: drift guard workflow ↔ template, Registry ↔ description (spec 2026-10-06 §4.4, §10)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const tpl27 = fs.readFileSync(path.join(CORE_DIR, 'skills', 'artifact-templates', 'references', 'workflow.template.md'), 'utf8').replace(/\r\n/g, '\n');
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Workflow graph (spec 2026-10-20-workflow-graph): schema, đích/reachability và đối chiếu văn xuôi
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const mkStep = (n, title, doing, failLines) => [`### Bước ${n} — ${title}`, `- **Thực hiện:** ${doing}`, '- **Đầu vào:** x',
      '- **Hành động:** x', '- **Ràng buộc:** x', '- **Đầu ra:** x', '- **Gate:** x', ...failLines, '- **Evidence:** x', ''];
    const frame = (steps) => ['## Các bước', '', ...steps.flat()].join('\n');
    const prose = frame([
      mkStep(1, 'Baseline', 'session chính', ['- **Khi fail:** đỏ → dừng `blocked`.']),
      mkStep(2, 'Implement', 'agent `a-one` ∥ agent `a-two` (skill `s-one`, chỉ khi có API)',
        ['- **Khi fail:** build lỗi → sửa lại; lệch contract → quay lại', '  Bước 1 sửa.']),
      mkStep(3, 'Commit ⏸', 'skill `git-workflow`', ['- **Khi fail:** người dùng yêu cầu sửa thêm → quay lại bước người dùng chỉ định.']),
    ]);
    const base = () => ({
      schema: 1, workflow: 'workflow-demo', start: 'baseline',
      steps: [
        { id: 'baseline', n: 1, title: 'Baseline', run: { session: true }, next: 'implement',
          on_fail: [{ to: 'blocked', when: 'đỏ' }], gate: { type: 'auto' } },
        { id: 'implement', n: 2, title: 'Implement',
          run: { agents: ['a-one', { id: 'a-two' }], skills: [{ id: 's-one', when: 'chỉ khi có API' }], parallel: true },
          next: 'commit', on_fail: [{ to: 'baseline', when: 'lệch contract' }], gate: { type: 'auto' } },
        { id: 'commit', n: 3, title: 'Commit', run: { skills: ['git-workflow'] }, next: 'done',
          on_fail: [{ to: 'ask_user', when: 'người dùng yêu cầu sửa thêm' }],
          gate: { type: 'human', review: 'Diff', approve: 'done', reject: 'ask_user' } },
      ],
    });
    const mut = (fn) => { const g = base(); fn(g); return g; };
    const [s1, s2, s3] = [0, 1, 2];

    ok(checkGraph(base()).length === 0, `AC1.1: graph hợp lệ → 0 lỗi${checkGraph(base()).length ? ' — ' + checkGraph(base()).join('; ') : ''}`);
    ok(checkGraphAgainstBody(base(), prose).length === 0,
      `AC1.1: graph hợp lệ khớp văn xuôi → 0 lỗi${checkGraphAgainstBody(base(), prose).length ? ' — ' + checkGraphAgainstBody(base(), prose).join('; ') : ''}`);

    const schemaCases = {
      'schema: 2': (g) => { g.schema = 2; },
      'thiếu workflow': (g) => { delete g.workflow; },
      'start khác bước n=1': (g) => { g.start = 'implement'; },
      'id viết hoa': (g) => { g.steps[s1].id = 'Baseline'; },
      'id trùng': (g) => { g.steps[s2].id = 'baseline'; },
      'id trùng đích đặc biệt': (g) => { g.steps[s2].id = 'done'; },
      'n nhảy 1→3': (g) => { g.steps[s2].n = 3; },
      'title rỗng': (g) => { g.steps[s1].title = ''; },
      'run rỗng': (g) => { g.steps[s1].run = {}; },
      'run.agents chứa số': (g) => { g.steps[s2].run.agents = [5]; },
      'gate.type lạ': (g) => { g.steps[s1].gate.type = 'x'; },
      'human gate thiếu review': (g) => { delete g.steps[s3].gate.review; },
      'approve ≠ next': (g) => { g.steps[s3].gate.approve = 'blocked'; },
      'reject không có trong on_fail': (g) => { g.steps[s3].gate.reject = 'blocked'; },
      'on_fail thiếu when': (g) => { delete g.steps[s1].on_fail[0].when; },
      'after trỏ id ngoài bước': (g) => { g.steps[s2].run.skills[0].after = 'ghost'; },
      'after trỏ chính nó': (g) => { g.steps[s2].run.agents[1] = { id: 'a-two', after: 'a-two' }; },
      'on_fail trỏ tới done': [(g) => { g.steps[s2].on_fail.push({ to: 'done', when: 'x' }); }, 'done'],
    };
    for (const [name, c] of Object.entries(schemaCases)) {
      const [fn, want] = Array.isArray(c) ? c : [c];
      const errs = checkGraph(mut(fn));
      ok(errs.length >= 1 && (!want || errs.some((m) => m.includes(want) && m.includes('implement'))), `AC1.1: checkGraph báo lỗi schema — ${name}`);
    }
    ok(checkGraph(mut((g) => { g.steps[s2].run.agents[1] = { id: 'a-two', after: 'a-one' }; })).length === 0,
      'AC1.1: after trỏ id khác cùng bước → hợp lệ');

    const badTarget = checkGraph(mut((g) => { g.steps[s2].next = 'nowhere'; }));
    ok(badTarget.some((m) => m.includes('implement') && m.includes('nowhere')), 'AC1.2: đích không tồn tại → lỗi nêu bước và đích');

    const orphan = checkGraph(mut((g) => {
      g.steps.push({ id: 'extra', n: 4, title: 'Extra', run: { session: true }, next: 'done', on_fail: [], gate: { type: 'auto' } });
    }));
    ok(orphan.some((m) => m.includes('extra')), 'AC1.3: bước mồ côi bị báo kèm id');
    const loop = checkGraph(mut((g) => { g.steps[s3].next = 'implement'; g.steps[s3].gate.approve = 'implement'; }));
    ok(loop.some((m) => m.includes('implement')) && loop.some((m) => m.includes('commit')), 'AC1.3: vòng không lối ra tới done bị báo');

    const bodyErr = (fn) => checkGraphAgainstBody(mut(fn), prose);
    ok(bodyErr((g) => { g.steps.pop(); }).length >= 1, 'AC2.1: số bước lệch văn xuôi → lỗi');
    ok(bodyErr((g) => { g.steps[s2].title = 'Khác'; }).some((m) => m.includes('implement')), 'AC2.1: tên bước lệch văn xuôi → lỗi nêu bước');
    ok(bodyErr((g) => { g.steps[s3].gate = { type: 'auto' }; }).some((m) => m.includes('commit')), 'AC2.2: ⏸ nhưng gate auto → lỗi');
    ok(bodyErr((g) => { g.steps[s1].gate = { type: 'human', review: 'x', approve: 'implement', reject: 'blocked' }; }).some((m) => m.includes('baseline')),
      'AC2.2: gate human nhưng không ⏸ → lỗi');
    const runCases = {
      'thiếu agent a-two': (g) => { g.steps[s2].run.agents = ['a-one']; },
      'thừa skill s-two': (g) => { g.steps[s2].run.skills.push('s-two'); },
      'session chính nhưng session: false': (g) => { g.steps[s1].run.session = false; },
      'có ∥ nhưng parallel: false': (g) => { g.steps[s2].run.parallel = false; },
    };
    for (const [name, fn] of Object.entries(runCases)) ok(bodyErr(fn).length >= 1, `AC2.3: run lệch văn xuôi — ${name}`);

    ok(bodyErr((g) => { g.steps[s2].on_fail = []; }).some((m) => m.includes('Bước 1')),
      'AC2.4: "quay lại Bước N" ở dòng nối tiếp phải có cạnh');
    ok(bodyErr((g) => { g.steps[s2].on_fail.push({ to: 'blocked', when: 'x' }); }).some((m) => m.includes('implement') && m.includes('blocked')),
      'AC2.4: cạnh không có bằng chứng trong Khi fail → lỗi');

    const lastFail = (to) => [`- **Khi fail:** hỏng → quay lại Bước ${to}.`];
    const prose5 = frame([1, 2, 3, 4].map((n) => mkStep(n, `S${n}`, 'session chính', ['- **Khi fail:** đỏ → dừng `blocked`.']))
      .concat([mkStep(5, 'S5', 'session chính', lastFail('3/4'))]));
    const graph5 = (targets) => ({
      schema: 1, workflow: 'workflow-five', start: 's1',
      steps: [1, 2, 3, 4, 5].map((n) => ({
        id: `s${n}`, n, title: `S${n}`, run: { session: true }, next: n === 5 ? 'done' : `s${n + 1}`,
        on_fail: n === 5 ? targets.map((t) => ({ to: t, when: 'x' })) : [{ to: 'blocked', when: 'x' }], gate: { type: 'auto' },
      })),
    });
    ok(checkGraphAgainstBody(graph5(['s3', 's4']), prose5).length === 0, 'AC2.4: "quay lại Bước 3/4" có cạnh tới cả hai → 0 lỗi');
    ok(checkGraphAgainstBody(graph5(['s3']), prose5).some((m) => m.includes('Bước 4')), 'AC2.4: "quay lại Bước 3/4" thiếu cạnh tới một bước → lỗi nhắc bước đó');
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
    ok(hi.length === 1, `1 workflow risk ≥ high (=${hi.map((s) => s.id).join(', ')})`);
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
      // Chiều ngược: file nằm trong references/ của workflow mà body không trỏ tới thì model không bao giờ mở nó.
      const refDir = path.join(s.dir, 'references');
      if (fs.existsSync(refDir)) {
        for (const f of fs.readdirSync(refDir).filter((x) => x.endsWith('.md'))) {
          ok(s.body.includes(`\`references/${f}\``), `${s.id}: WORKFLOW.md trỏ tới references/${f}`);
        }
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────
  // Workflow graph (project 2b): graph.json cho pipeline workflow, khớp văn xuôi
  // ─────────────────────────────────────────────────────────────────────────────
  {
    if (workflows) {
      const pipelines = workflows.stages.filter((s) => s.kind === 'workflow');
      for (const s of pipelines) {
        ok(s.graph != null && s.graph.workflow === s.id, `AC1.1: ${s.id} có graph.json với graph.workflow = id`);
        if (!s.graph) continue;
        const gErrs = checkGraph(s.graph);
        ok(gErrs.length === 0, `AC1.1/AC1.2/AC1.3: ${s.id} graph hợp lệ${gErrs.length ? ' — ' + gErrs.join(' | ') : ''}`);
        const pErrs = checkGraphAgainstBody(s.graph, s.body);
        ok(pErrs.length === 0, `AC2.1–AC2.4: ${s.id} graph khớp văn xuôi${pErrs.length ? ' — ' + pErrs.join(' | ') : ''}`);
      }
      for (const s of workflows.stages) {
        ok(!s.body.includes('quay lại bước tương ứng'), `AC2.5: ${s.id} không còn "quay lại bước tương ứng"`);
      }
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-graph-'));
      try {
        const bad = path.join(tmp, 'graph.json');
        fs.writeFileSync(bad, '{"schema":');
        let msg = '';
        try { readGraph(bad); } catch (e) { msg = e.message; }
        ok(msg.includes(bad) && msg.includes('graph.json không phải JSON hợp lệ'), 'AC1.1: readGraph — JSON hỏng ném lỗi có đường dẫn file');
        ok(readGraph(path.join(tmp, 'khong-ton-tai.json')) === null, 'AC1.1: readGraph — không có file → null');
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Workflow graph (project 2b): template graph, tài liệu, ship build
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const refDir = path.join(CORE_DIR, 'skills', 'artifact-templates', 'references');
    const tplBody = stripTemplateHeader(fs.readFileSync(path.join(refDir, 'workflow.template.md'), 'utf8').replace(/\r\n/g, '\n'));
    let tErrs;
    try {
      const tplGraph = JSON.parse(fs.readFileSync(path.join(refDir, 'workflow.graph.template.json'), 'utf8'));
      tErrs = [...checkGraph(tplGraph), ...checkGraphAgainstBody(tplGraph, tplBody)];
    } catch (err) {
      tErrs = [err.message];
    }
    ok(tErrs.length === 0, `AC3.2: template graph hợp lệ và khớp template workflow${tErrs.length ? ' — ' + tErrs.join(' | ') : ''}`);

    const skillMd = fs.readFileSync(path.join(CORE_DIR, 'skills', 'artifact-templates', 'SKILL.md'), 'utf8');
    const claudeMd = fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8');
    const newWf = claudeMd.split('\n').find((l) => l.startsWith('- New workflow')) || '';
    ok(skillMd.includes('workflow.graph.template.json') && newWf.includes('graph.json'),
      'AC3.2: SKILL.md artifact-templates và CLAUDE.md nhắc graph.json');

    if (workflows && fs.existsSync(claudeDir)) {
      const codexDir = path.join(BUILD, 'codex');
      const same = (built, src) => fs.existsSync(built) && fs.readFileSync(built).equals(fs.readFileSync(src));
      for (const s of workflows.stages.filter((x) => x.kind === 'workflow')) {
        const src = path.join(s.dir, 'graph.json');
        const c = path.join(claudeDir, 'plugins', 'workflows', 'skills', s.id, 'graph.json');
        const x = path.join(codexDir, 'workflows', 'skills', s.id, 'graph.json');
        ok(same(c, src) && same(x, src), `AC3.1: build ship graph.json cho Claude và Codex, byte-for-byte — ${s.id}`);
      }
      const stray = ['cursor', 'antigravity'].flatMap((p) => (fs.existsSync(path.join(BUILD, p)) ? listFilesRec(path.join(BUILD, p)) : []))
        .filter((f) => path.basename(f) === 'graph.json');
      ok(stray.length === 0, `AC3.1: cursor/antigravity không build graph.json${stray.length ? ' — ' + stray.join(', ') : ''}`);
    }
  }
}
