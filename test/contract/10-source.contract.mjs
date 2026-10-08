// Contract source: core, cấu trúc plugin, agents và workflows cấp repo.
export default async function run({ ok, ctx }) {
  const { fs, path, loadCore, PLUGINS_DIR, CORE_DIR, checkWorkflowBody, parseSteps, stepRefs, parseRegistry, RISKS, frontmatter, RUN_IN, INVOKE_IN, listFilesRec, core, plugins, catalogSkillIds, allAgents, workflows, loadPublished } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. CORE
  // ─────────────────────────────────────────────────────────────────────────────
  const corePrinciplesDir = path.join(CORE_DIR, 'principles');
  ok(fs.existsSync(corePrinciplesDir), 'core/principles/ (folder) tồn tại');
  ok(fs.existsSync(corePrinciplesDir) && fs.readdirSync(corePrinciplesDir).some((f) => f.endsWith('.md')),
    'core/principles/ có file .md');

  ok(!!core.principles && core.principles.length > 100, 'loadCore() gộp principles có nội dung');

  // core/skills/ — skill DÙNG CHUNG (vd git-workflow): recipe on-demand, ship kèm core ở mọi adapter
  ok(Array.isArray(core.stages) && core.stages.some((s) => s.id === 'git-workflow'),
    'loadCore() nạp skill dùng chung git-workflow từ core/skills/');
  for (const s of core.stages) {
    ok(fs.existsSync(path.join(CORE_DIR, 'skills', s.id, 'SKILL.md')), `core ${s.id}: có SKILL.md`);
    ok(!!s.description && s.description.length > 10, `core ${s.id}: có description`);
    ok(!!s.body && s.body.trim().length > 50, `core ${s.id}: có body hướng dẫn`);
    ok(RUN_IN.includes(s.runsIn), `core ${s.id}: runsIn ∈ {plan,execute} (=${s.runsIn})`);
    ok(INVOKE_IN.includes(s.invoke), `core ${s.id}: invoke ∈ {once,per-request} (=${s.invoke})`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. SOURCE structure mỗi plugin
  // ─────────────────────────────────────────────────────────────────────────────
  ok(plugins.length > 0, 'Có ít nhất 1 plugin');

  for (const p of plugins) {
    const dir = path.join(PLUGINS_DIR, p.id);

    // .manifest.json (KHÔNG dùng manifest.json cũ)
    ok(fs.existsSync(path.join(dir, '.manifest.json')), `${p.id}: có .manifest.json`);
    ok(!fs.existsSync(path.join(dir, 'manifest.json')), `${p.id}: KHÔNG còn manifest.json cũ`);
    ok(!fs.existsSync(path.join(dir, 'stages')), `${p.id}: KHÔNG còn thư mục stages/ cũ`);
    for (const f of ['id', 'name', 'description', 'version']) {
      ok(!!p.manifest[f], `${p.id}: .manifest.json có "${f}"`);
    }

    // skills/ dir
    ok(fs.existsSync(path.join(dir, 'skills')), `${p.id}: có thư mục skills/`);
    ok(p.stages.length > 0, `${p.id}: có ít nhất 1 skill`);

    // principles riêng KHÔNG lặp core
    ok(!p.shared.principles.includes('## 4 nguyên tắc cốt lõi'),
      `${p.id}: shared/principles.md KHÔNG lặp header core`);

    // mỗi skill: SKILL.md + frontmatter hợp lệ
    const orders = [];
    for (const s of p.stages) {
      const skillFile = path.join(dir, 'skills', s.id, 'SKILL.md');
      ok(fs.existsSync(skillFile), `${s.id}: có SKILL.md`);
      ok(s.id.startsWith(p.id + '-'), `${s.id}: tên skill bắt đầu bằng "${p.id}-"`);
      ok(!!s.description && s.description.length > 10, `${s.id}: có description`);
      ok(!!s.body && s.body.trim().length > 50, `${s.id}: có body hướng dẫn`);
      if (s.id.endsWith('-init')) {
        ok(s.body.includes('AGENTS.template.md') && s.body.includes('AGENTS.md'),
          `${s.id}: hướng dẫn tạo AGENTS.md từ template`);
      }
      ok(typeof s.order === 'number' && s.order > 0, `${s.id}: order là số > 0`);
      ok(RUN_IN.includes(s.runsIn), `${s.id}: runsIn ∈ {plan,execute} (=${s.runsIn})`);
      ok(INVOKE_IN.includes(s.invoke), `${s.id}: invoke ∈ {once,per-request} (=${s.invoke})`);
      orders.push(s.order);
    }

    ok(new Set(orders).size === orders.length, `${p.id}: order không trùng`);

    // references/ — tên file KHÔNG trùng giữa các skill trong cùng plugin (giữ hygiene; trước đây
    // bắt buộc vì cursor ship references/ phẳng dưới rules/; giờ mỗi skill có folder riêng).
    const refRel = [];
    for (const s of p.stages) {
      if ((s.assets || []).includes('references')) {
        refRel.push(...listFilesRec(path.join(dir, 'skills', s.id, 'references')));
      }
    }
    ok(new Set(refRel).size === refRel.length, `${p.id}: tên file trong references/ không trùng giữa các skill`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2b. SOURCE: agents (plugins/<id>/agents/*.md)
  // ─────────────────────────────────────────────────────────────────────────────
  const MODES = ['read-only', 'write'];
  const MODELS = ['sonnet', 'opus', 'haiku', 'fable', 'inherit'];
  const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
  const AGENT_HEADINGS = ['Vai trò', 'Phạm vi', 'Quy trình', 'Report trả về'];
  ok(new Set(allAgents.map((a) => a.id)).size === allAgents.length, 'agents: id duy nhất toàn cục');
  for (const a of allAgents) {
    ok(path.basename(a.file, '.md') === a.id, `agent ${a.id}: name == tên file`);
    ok(a.id.startsWith(`${a.plugin}-`) && !a.id.includes(':'), `agent ${a.id}: prefix "${a.plugin}-", không chứa ":"`);
    ok(a.description.length > 10, `agent ${a.id}: có description`);
    ok(MODES.includes(a.mode), `agent ${a.id}: mode ∈ {read-only, write} (=${a.mode})`);
    ok(a.skills.length > 0, `agent ${a.id}: skills không rỗng`);
    for (const s of a.skills) ok(catalogSkillIds.has(s), `agent ${a.id}: skill "${s}" tồn tại`);
    if (a.model) ok(MODELS.includes(a.model), `agent ${a.id}: model hợp lệ (=${a.model})`);
    if (a.effort) ok(EFFORTS.includes(a.effort), `agent ${a.id}: effort hợp lệ (=${a.effort})`);
    for (const h of AGENT_HEADINGS) ok(a.body.includes(`## ${h}`), `agent ${a.id}: có heading "## ${h}"`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2c. SOURCE: workflows/ (bộ workflow + orchestrator cấp repo)
  // ─────────────────────────────────────────────────────────────────────────────
  ok(!!workflows, 'workflows/.manifest.json tồn tại');
  if (workflows) {
    for (const f of ['id', 'name', 'description', 'version']) ok(!!workflows.manifest[f], `workflows: .manifest.json có "${f}"`);
    const agentById = new Map(allAgents.map((a) => [a.id, a]));
    const byBare = new Map([...catalogSkillIds].map((s) => [s.split('/')[1], s]));
    const wfs = workflows.stages.filter((s) => s.kind === 'workflow');
    const orch = workflows.stages.filter((s) => s.kind === 'orchestrator');
    const orders = workflows.stages.map((s) => s.order);
    ok(new Set(orders).size === orders.length, 'workflows: order không trùng');
    if (workflows.stages.length) ok(orch.length === 1, 'workflows: đúng 1 orchestrator');
    for (const s of workflows.stages) {
      ok(s.id === `workflow-${s.slug}`, `${s.id}: name == "workflow-<thư mục>"`);
      ok(['workflow', 'orchestrator'].includes(s.kind), `${s.id}: kind ∈ {workflow, orchestrator}`);
      ok(s.description.length > 10, `${s.id}: có description`);
      ok(RUN_IN.includes(s.runsIn) && INVOKE_IN.includes(s.invoke), `${s.id}: runsIn/invoke hợp lệ`);
      for (const aid of s.agents) ok(agentById.has(aid), `${s.id}: agent "${aid}" tồn tại`);
      for (const r of s.requires) ok(catalogSkillIds.has(r), `${s.id}: requires "${r}" là skill plugin/core có thật`);
      const errs = checkWorkflowBody(s.body, { kind: s.kind });
      ok(errs.length === 0, `${s.id}: khung body hợp lệ${errs.length ? ' — ' + errs.join('; ') : ''}`);
      const allowed = new Set([...s.requires, ...s.agents.flatMap((aid) => (agentById.get(aid) || { skills: [] }).skills)]);
      for (const st of stepRefs(s.body)) {
        for (const aid of st.agents) ok(s.agents.includes(aid), `${s.id} bước ${st.n}: agent "${aid}" có trong frontmatter agents`);
        for (const sk of st.skills) {
          const full = sk.includes('/') ? sk : byBare.get(sk);
          ok(!!full && allowed.has(full), `${s.id} bước ${st.n}: skill "${sk}" có trong requires hoặc skill của agent`);
        }
      }
      // Agent không được gọi agent khác, nên agent nêu trong Hành động phải do chính bước đó dispatch.
      const agentsByStep = new Map(stepRefs(s.body).map((r) => [r.n, r.agents]));
      for (const st of parseSteps(s.body)) {
        const act = (st.body.split('**Hành động:**')[1] || '').split('\n- **')[0];
        for (const a of allAgents) {
          if (act.includes(a.id)) ok((agentsByStep.get(st.n) || []).includes(a.id),
            `${s.id} bước ${st.n}: agent "${a.id}" nêu trong Hành động phải có trong Thực hiện`);
        }
      }
      ok(!s.body.includes('skills/workflows/'),
        `${s.id}: không nêu đường dẫn "skills/workflows/" (workflow cài phẳng thành skills/workflow-<slug>/)`);
      if (s.kind === 'workflow') {
        ok([1, 2, 3].includes(s.tier), `${s.id}: tier ∈ {1,2,3}`);
        ok(RISKS.includes(s.risk), `${s.id}: risk ∈ {${RISKS.join(', ')}}`);
        ok(s.order > 0, `${s.id}: order > 0`);
      } else {
        ok(s.order === 0, `${s.id}: orchestrator order = 0`);
      }
    }
    for (const o of orch) {
      const { rows, priority } = parseRegistry(o.body);
      const reg = new Set(rows.map((r) => r.id));
      const ids = new Set(wfs.map((w) => w.id));
      ok(reg.size === rows.length, `${o.id}: registry không trùng id`);
      for (const id of ids) ok(reg.has(id), `${o.id}: registry có ${id}`);
      for (const id of reg) ok(ids.has(id), `${o.id}: registry "${id}" trỏ tới workflow có thật`);
      for (const r of rows) {
        const w = wfs.find((x) => x.id === r.id);
        if (w) ok(r.risk === w.risk, `${o.id}: risk của ${r.id} khớp frontmatter (${r.risk} vs ${w.risk})`);
        for (const n of r.next) ok(ids.has(n), `${o.id}: nối tiếp "${n}" của ${r.id} tồn tại`);
      }
      ok(priority.length === ids.size && [...ids].every((id) => priority.includes(id)),
        `${o.id}: thứ tự ưu tiên liệt kê đủ ${ids.size} workflow`);
    }
  }
  // Phase 2 Task 6: manifest description gọn và nêu đủ skill published (thay pin PL2)
  {
    const pub = loadPublished();
    for (const u of [core, ...plugins]) {
      const len = [...u.description].length;
      ok(len <= 500, `${u.id}: manifest description ≤ 500 ký tự (=${len})`);
      const published = u.stages.filter((s) => u.id === 'core' || !pub || pub[u.id] === '*' || (pub[u.id] || []).includes(`${u.id}/${s.id}`));
      const missing = published.map((s) => s.id).filter((id) => !u.description.includes(id));
      ok(missing.length === 0, `${u.id}: manifest description nêu đủ skill published (thiếu: ${missing.join(', ')})`);
      ok(Array.isArray(u.manifest.keywords) && u.manifest.keywords.length >= 2, `${u.id}: manifest có keywords`);
    }
  }
}
