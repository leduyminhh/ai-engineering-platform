// Pin nội dung: publish frontend-data-integration/e2e-testing và WF4/WF5/WF6.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, PLUGINS_DIR, parseSteps, parseRegistry, offeredCatalog, frontmatter, workflows } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 19. SOURCE: S7 + publish frontend-data-integration/e2e-testing + WF4/WF5/WF6 (spec 2026-09-29 §3.3, §5.3, §7.2, §7.3.7)
  {
    const flat19 = (t) => t.replace(/\s+/g, ' ');
    const wf19 = (id) => workflows.stages.find((s) => s.id === id);
    const step19 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { title: '', body: '', checkpoint: false };
    // Lấy riêng một trường của bước để assert không khớp nhầm chữ ở trường khác.
    const field19 = (body, name) => {
      const lines = body.split('\n');
      const head = new RegExp(`^- \\*\\*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\*\\*`);
      const i = lines.findIndex((l) => head.test(l));
      if (i === -1) return '';
      const j = lines.findIndex((l, k) => k > i && /^- \*\*/.test(l));
      return flat19(lines.slice(i, j === -1 ? lines.length : j).join('\n'));
    };
    const sec3do19 = field19(step19(wf19('workflow-security-review'), 3).body, 'Thực hiện');
    ok(sec3do19.includes('agent `engineering-quality-auditor`') && !sec3do19.includes('**Đầu vào:**'),
      'field19 (sanity): workflow-security-review Bước 3 "Thực hiện" có agent engineering-quality-auditor và dừng trước trường kế tiếp');
    const ft19 = fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-testing', 'SKILL.md'), 'utf8');
    const fts19 = fs.readFileSync(
      path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-testing', 'references', 'test-strategy.md'), 'utf8');
    ok(flat19(ft19).includes('`frontend-e2e-testing`') && !/ngoài phạm vi recipe/.test(flat19(ft19) + flat19(fts19)),
      'frontend-testing (S7): SKILL.md trỏ e2e sang frontend-e2e-testing; SKILL.md + references/test-strategy.md hết "ngoài phạm vi recipe"');
    const pub19 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_published.json'), 'utf8')).published;
    for (const s of ['frontend/frontend-data-integration', 'frontend/frontend-e2e-testing']) {
      ok(pub19.includes(s), `_published.json: có ${s} (publish trước khi nối workflow, không chờ pilot)`);
    }
    const cowork19 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_cowork.json'), 'utf8')).skills;
    for (const s of ['frontend:frontend-data-integration', 'frontend:frontend-e2e-testing']) {
      ok(cowork19.includes(s), `_cowork.json: có ${s}`);
    }
    const feMan19 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', '.manifest.json'), 'utf8'));
    ok(/^\d+\.\d+\.\d+$/.test(feMan19.version) && !feMan19.description.includes('DRAFT'),
      'frontend manifest: version semver, description không còn nhãn DRAFT');
    const fePr19 = fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', 'shared', 'principles.md'), 'utf8');
    ok(!fePr19.includes('state-model'), 'frontend principles: không còn tham chiếu state-model treo (spec §7.3.7)');
    const feImpl19 = fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-implement', 'SKILL.md'), 'utf8');
    ok(flat19(feImpl19).includes('`frontend-data-integration`'),
      'frontend-implement: trỏ phần nối data/API sang frontend-data-integration');
    const offWf19 = offeredCatalog().plugins.find((p) => p.id === 'workflows')?.skillIds ?? [];
    // Nối agent chỉ hợp lệ khi skill của agent đã publish; nếu rút về draft, wizard ẩn workflow lặng lẽ.
    for (const w of ['workflow-feature']) {
      ok(offWf19.includes(`workflows/${w}`), `offeredCatalog: vẫn offer workflows/${w} (closure agent frontend đã publish)`);
    }
    const feat19 = wf19('workflow-feature');
    const fS2 = step19(feat19, 2), fS4 = step19(feat19, 5), fS5 = fS4; // Bước 5 mới gộp implement + test trong vòng task
    ok(/^Làm rõ/.test(fS2.title) && flat19(fS2.body).includes('schema') && flat19(fS2.body).includes('`data-db-migration`'),
      'workflow-feature Bước 2: phạm vi có đổi schema → dừng, đề xuất skill data-db-migration trước');
    // Integrator nối vào component do implementer dựng, nên phải chạy SAU, không song song.
    ok(/^Vòng task/.test(fS4.title) && field19(fS4.body, 'Thực hiện').includes('agent `frontend-data-integrator`')
      && field19(fS4.body, 'Hành động').includes('`FE-INT` → `frontend-data-integrator` (sau `FE-UI`') && !flat19(fS4.body).includes('Gap G1'),
      'workflow-feature Bước 5: frontend-data-integrator chạy sau task FE-UI (fullstack), bỏ Gap G1');
    ok(field19(fS5.body, 'Thực hiện').includes('agent `frontend-e2e-test-writer`') && field19(fS5.body, 'Hành động').includes('`E2E` → `frontend-e2e-test-writer`'),
      'workflow-feature Bước 5: có frontend-e2e-test-writer cho AC dạng luồng UI (task kind E2E)');
    ok(field19(fS5.body, 'Gate').includes('playwright.config') && flat19(fS5.body).includes('not_run'),
      'workflow-feature Bước 5: Gate cho phép e2e/ + playwright.config.*; e2e thiếu BE/DB test → not_run hợp lệ');
    ok(feat19 && ['frontend-data-integrator', 'frontend-e2e-test-writer'].every((a) => feat19.agents.includes(a)),
      'workflow-feature: frontmatter agents có frontend-data-integrator, frontend-e2e-test-writer');
    ok(parseSteps(feat19?.body ?? '').length === 7, 'workflow-feature: 7 bước (làm rõ, tài liệu, plan, vòng task, review cuối, kết thúc nhánh)');
    const orch19 = workflows.stages.find((s) => s.kind === 'orchestrator');
    const featRow19 = parseRegistry(orch19?.body ?? '').rows.find((r) => r.id === 'workflow-feature');
    ok(featRow19 && featRow19.next.length === 0, 'orchestrator: workflow-feature không nối tiếp workflow-docs (Bước 7 đã làm docs)');
    for (const f of ['README.md', 'README_VI.md']) {
      const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
      const row = (a) => rd.split('\n').find((l) => l.startsWith(`| \`${a}\` |`)) ?? '';
      ok(row('frontend-data-integrator').includes('WF01'),
        `${f}: bảng agent có frontend-data-integrator dùng ở WF01`);
      ok(row('frontend-e2e-test-writer').includes('WF01'),
        `${f}: bảng agent có frontend-e2e-test-writer dùng ở WF01`);
      ok(!/^\| G1 \|/m.test(rd) && !/^\| G5 \|/m.test(rd), `${f}: bảng Skill gaps bỏ G1, G5 (đã có skill)`);
    }
    // Duyệt E2 của skill e2e phải có chỗ trong workflow, nếu không agent sẽ trình lại hoặc bỏ qua cổng.
    ok(field19(fS2.body, 'Hành động').includes('e2e'),
      'workflow-feature Bước 2: Hành động đánh dấu AC cần e2e (bảng luồng → AC → lý do)');
    ok(field19(fS5.body, 'Đầu vào').includes('E2'),
      'workflow-feature Bước 5: Đầu vào nhận bảng ứng viên e2e đã duyệt ở Bước 2 (duyệt E2)');
    for (const [name, s] of [['workflow-feature Bước 5', fS5]]) {
      const g = field19(s.body, 'Gate');
      ok(g.includes('.gitignore') && g.includes('E-r7'),
        `${name}: Gate cho phép dòng .gitignore của Playwright và package.json/lockfile chỉ khi đã duyệt (E-r7)`);
    }
    // Dọn minor đã park: Đầu ra/Evidence e2e của testing Bước 4, integrator blocked ở feature Bước 4, E-r7 gồm script.
    for (const [name, s] of [['workflow-feature Bước 5', fS5]]) {
      ok(field19(s.body, 'Gate').includes('script chạy e2e cũng cần duyệt'),
        `${name}: Gate E-r7 gồm cả việc thêm script chạy e2e vào package.json (cần duyệt như E-r7)`);
    }
    ok(field19(fS4.body, 'Khi fail').includes('codegen') && field19(fS4.body, 'Khi fail').includes('blocked'),
      'workflow-feature Bước 5: Khi fail xử lý integrator trả blocked vì thiếu codegen/thư viện data');
    for (const [name, w] of [['workflow-feature', feat19]]) {
      const b = w?.body ?? '';
      const i = b.indexOf('## Definition of Done'), j = b.indexOf('## Report');
      ok(i !== -1 && j > i && flat19(b.slice(i, j)).includes('e2e `not_run`'), `${name}: Definition of Done có ngoại lệ e2e not_run`);
    }
    const fS4r = field19(fS4.body, 'Ràng buộc');
    ok(fS4r.includes('codegen') && fS4r.includes('fetch'),
      'workflow-feature Bước 5: Ràng buộc integrator (thiếu codegen → dừng chờ chọn; không gọi fetch trong component)');
    for (const t of [['references', 'testing-toolchain.md'], ['react-micro-frontend.template.md']]) {
      const tpl = flat19(fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', 'templates', 'architecture', ...t), 'utf8'));
      ok(tpl.includes('`frontend-e2e-testing`'), `frontend template ${t.join('/')}: câu e2e trỏ sang frontend-e2e-testing (S7)`);
    }
  }
}
