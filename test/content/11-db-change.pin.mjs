// Pin nội dung: publish data-db-migration, data-migration-writer và workflow-db-change.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, PLUGINS_DIR, parseSteps, offeredCatalog, frontmatter, workflows, wfText } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 22. SOURCE: publish data-db-migration + agent data-migration-writer + workflow-db-change (spec 2026-10-01-data-migration-writer-design)
  {
    const flat22 = (t) => t.replace(/\s+/g, ' ');
    const wf22 = (id) => workflows.stages.find((s) => s.id === id);
    const step22 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { title: '', body: '', checkpoint: false };
    // Cắt đúng một trường cột 0 để assert không khớp nhầm chữ của trường khác trong cùng bước.
    const field22 = (body, name) => {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const lines = body.split('\n');
      const i = lines.findIndex((l) => new RegExp(`^- \\*\\*${esc}:\\*\\*`).test(l));
      if (i < 0) return '';
      let j = lines.findIndex((l, k) => k > i && /^- \*\*/.test(l));
      if (j < 0) j = lines.length;
      return flat22(lines.slice(i, j).join('\n'));
    };
    const pub22 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_published.json'), 'utf8')).published;
    ok(pub22.includes('data/data-db-migration'), '_published.json: có data/data-db-migration (publish không chờ pilot, publish trước khi nối workflow)');
    ok(!pub22.some((e) => /^data\/data-(oltp|olap)/.test(e)), '_published.json: 4 skill data-oltp/olap vẫn draft');
    const cowork22 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_cowork.json'), 'utf8')).skills;
    ok(cowork22.includes('data:data-db-migration'), '_cowork.json: có data:data-db-migration');
    const dataMan22 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, 'data', '.manifest.json'), 'utf8'));
    ok(/^\d+\.\d+\.\d+$/.test(dataMan22.version) && !dataMan22.description.includes('DRAFT') && dataMan22.description.includes('data-db-migration'),
      'data manifest: version semver, description nêu data-db-migration và không còn nhãn DRAFT');
    const dataPr22 = fs.readFileSync(path.join(PLUGINS_DIR, 'data', 'shared', 'principles.md'), 'utf8');
    ok(dataPr22.includes('data-db-migration') && flat22(dataPr22).includes('project backend') && flat22(dataPr22).includes('DB riêng của app')
      && dataPr22.includes('data-oltp-implement'),
      'data principles: nêu data-db-migration phục vụ project backend có DB riêng của app (không thuộc nhánh OLTP/OLAP)');
    const offData22 = offeredCatalog().plugins.find((p) => p.id === 'data');
    ok(!!offData22 && offData22.skillIds.includes('data/data-db-migration') && !offData22.skillIds.some((s) => /data-(oltp|olap)/.test(s)),
      'offeredCatalog: plugin data chỉ offer data/data-db-migration');
    const dmwPath = path.join(PLUGINS_DIR, 'data', 'agents', 'data-migration-writer.md');
    const dmw = fs.existsSync(dmwPath) ? fs.readFileSync(dmwPath, 'utf8') : '';
    ok(dmw.length > 0, 'data-migration-writer: có agent file');
    ok(/^mode: write$/m.test(dmw) && /^skills: "data-db-migration"$/m.test(dmw),
      'data-migration-writer: mode write, skills = data-db-migration (đúng 1 skill)');
    const dmwScope = flat22(dmw.split('## Phạm vi')[1]?.split('## Quy trình')[0] ?? '');
    ok(dmwScope.includes('kết nối DB') && dmwScope.includes('chạy migration'),
      'data-migration-writer: Phạm vi cấm kết nối DB và chạy migration');
    ok(dmwScope.includes('file migration đã có') && dmwScope.includes('repair'),
      'data-migration-writer: Phạm vi cấm sửa file migration đã có và repair/clean');
    ok(dmwScope.includes('mã ứng dụng') && dmwScope.includes('ngoài thư mục migration') && dmwScope.includes('blocked') && dmwScope.includes('questions'),
      'data-migration-writer: cấm sửa mã ứng dụng ngoài thư mục migration, cần quyết định → blocked + questions');
    ok(dmwScope.includes('mã ứng dụng') && dmwScope.includes('vắng khỏi mốc') && dmw.split('\n')[2].includes('sửa file do chính lượt này tạo'),
      'data-migration-writer: nhận diện file do chính lượt này tạo (vắng khỏi mốc); description nêu sửa file do chính lượt này tạo');
    ok(dmw.includes('git diff --name-only') && dmw.includes('not_run'),
      'data-migration-writer: tự đối chiếu diff; validation not_run (verify do session chính)');
    ok(dmw.includes('compensating_sql') && dmw.includes('KHÔNG tạo file migration bù'),
      'data-migration-writer: Flyway forward-only → migration bù là văn bản compensating_sql trong report, không tạo file');
    ok(dmwScope.includes('do chính lượt workflow này tạo') && dmwScope.includes('đã có trên base branch'),
      'data-migration-writer: được sửa file do chính lượt workflow tạo; cấm sửa file đã có trên base branch');
    const dbc22 = wf22('workflow-db-change');
    const dS2 = step22(dbc22, 2), dS3 = step22(dbc22, 3), dS6 = step22(dbc22, 6), dS8 = step22(dbc22, 8);
    ok(field22(dS2.body, 'Thực hiện').includes('skill `data-db-migration`') && field22(dS2.body, 'Hành động').includes('change-patterns')
      && field22(dS2.body, 'Hành động').includes('lock-risk-postgres'),
      'workflow-db-change Bước 2: theo skill data-db-migration (C2), tra change-patterns và lock-risk-postgres');
    ok(field22(dS2.body, 'Đầu ra').includes('expand') && field22(dS2.body, 'Đầu ra').includes('Bước 3'),
      'workflow-db-change Bước 2: Đầu ra có kế hoạch theo pha làm đầu vào cho Bước 3');
    ok(field22(dS3.body, 'Thực hiện').includes('agent `data-migration-writer`') && field22(dS3.body, 'Thực hiện').includes('agent `backend-implementer`'),
      'workflow-db-change Bước 3: data-migration-writer (file migration) ∥ backend-implementer (code)');
    ok(field22(dS3.body, 'Hành động').includes('git status --porcelain') && field22(dS3.body, 'Hành động').includes('MỘT lần'), 'workflow-db-change Bước 3: session chính ghi mốc git status --porcelain trước khi dispatch');
    ok(field22(dS3.body, 'Ràng buộc').includes('không sửa file migration đã có') && field22(dS3.body, 'Ràng buộc').includes('không kết nối DB')
      && field22(dS3.body, 'Ràng buộc').includes('không sửa file trong thư mục migration'),
      'workflow-db-change Bước 3: file migration chỉ file MỚI, agent không kết nối DB/chạy migration');
    ok(field22(dS3.body, 'Gate').includes('file migration MỚI') && field22(dS3.body, 'Gate').includes('git ls-files --others')
      && field22(dS3.body, 'Gate').includes('đã có trên base branch') && field22(dS3.body, 'Gate').includes('nơi dùng đã xác định ở Bước 1'),
      'workflow-db-change Bước 3: Gate so diff với mốc — chỉ file migration mới + file code thuộc nơi dùng, không sửa file đã có');
    ok(field22(dS3.body, 'Khi fail').includes('blocked') && field22(dS3.body, 'Khi fail').includes('quay lại Bước 2'),
      'workflow-db-change Bước 3: agent blocked → hỏi người dùng; đổi kế hoạch → quay lại Bước 2');
    ok(field22(dS6.body, 'Thực hiện').includes('skill `data-db-migration`') && field22(dS6.body, 'Hành động').includes('verify-cycle'),
      'workflow-db-change Bước 6: chạy thử theo skill data-db-migration (C4), chu trình verify-cycle');
    ok(field22(dS3.body, 'Hành động').includes('không thành file') && field22(dS3.body, 'Evidence').includes('compensating_sql')
      && flat22(wfText('db-change')).includes('report Bước 3') && flat22(wfText('db-change')).includes('migration bù'),
      'workflow-db-change: migration bù của công cụ forward-only là SQL trong report Bước 3 (không thành file), Bước 6 lấy từ report');
    ok(field22(dS3.body, 'Ràng buộc').includes('R__') && field22(dS2.body, 'Đầu ra').includes('số dòng bảng bị đụng')
      && field22(dS3.body, 'Đầu vào').includes('số dòng bảng bị đụng'),
      'workflow-db-change: file migration thuộc nơi dùng Bước 1 → hỏi người dùng; số dòng bảng truyền từ Bước 2 sang Bước 3');
    ok(field22(dS8.body, 'Hành động').includes('next_actions') && field22(dS8.body, 'Hành động').includes('Bước 3'),
      'workflow-db-change Bước 8: pha contract còn nợ lấy từ next_actions của report Bước 3');
    ok(dbc22 && ['data-migration-writer', 'backend-implementer', 'backend-test-writer', 'backend-reviewer'].every((a) => dbc22.agents.includes(a))
      && dbc22.requires.includes('data/data-db-migration'),
      'workflow-db-change: frontmatter agents có data-migration-writer, requires có data/data-db-migration');
    ok(parseSteps(dbc22?.body ?? '').length === 9 && step22(dbc22, 2).checkpoint && step22(dbc22, 5).checkpoint && step22(dbc22, 9).checkpoint,
      'workflow-db-change: vẫn 9 bước, ⏸ ở Bước 2, 5, 9');
    ok(flat22(wfText('db-change')).includes('Agent migration trả `blocked`'),
      'workflow-db-change: bảng lỗi có hàng agent migration trả blocked');
    const dbcDoD22 = flat22(dbc22?.body.split('## Definition of Done')[1]?.split('## Report cuối')[0] ?? '');
    ok(field22(step22(dbc22, 4).body, 'Đầu vào').includes('compensating_sql')
      && field22(step22(dbc22, 8).body, 'Hành động').includes('runbook') && field22(step22(dbc22, 8).body, 'Hành động').includes('NGOÀI thư mục migration')
      && dbcDoD22.includes('SQL bù'),
      'workflow-db-change: SQL bù có chỗ ở — Bước 4 kiểm compensating_sql, Bước 8 ghi runbook ngoài thư mục migration, DoD có dòng SQL bù');
    ok(field22(dS3.body, 'Gate').includes('trừ file đã được nhận ở bước trước') && field22(dS3.body, 'Gate').includes('test đơn vị'),
      'workflow-db-change Bước 3: Gate chấp nhận file đã nhận ở bước trước (vòng Bước 7 → Bước 3) và test đơn vị của code');
    ok(field22(dS6.body, 'Hành động').includes('nguyên văn') && field22(dS6.body, 'Hành động').includes('rỗng hoặc N-1')
      && field22(dS6.body, 'Ràng buộc').includes('ngoại lệ'),
      'workflow-db-change Bước 6: SQL bù áp nguyên văn, DB test về rỗng hoặc N-1 trước mỗi lần chạy, ngoại lệ cho điều cấm sửa tay schema');
    ok(field22(step22(dbc22, 1).body, 'Hành động').includes('PostgreSQL') && field22(step22(dbc22, 1).body, 'Hành động').includes('data-oltp-implement'),
      'workflow-db-change Bước 1: nhận diện công cụ + engine, điều kiện dừng (PostgreSQL, data-oltp-implement)');
    ok((offeredCatalog().plugins.find((p) => p.id === 'workflows')?.skillIds ?? []).includes('workflows/workflow-db-change'),
      'offeredCatalog: vẫn offer workflows/workflow-db-change (closure data-db-migration đã publish)');
    const beImpl22 = flat22(fs.readFileSync(path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-implement', 'SKILL.md'), 'utf8'));
    ok(beImpl22.includes('`data-db-migration`') && beImpl22.includes('`backend-migrate-vault-consul`'),
      'backend-implement (S8): ranh giới trỏ đích danh data-db-migration và backend-migrate-vault-consul');
    for (const f of ['README.md', 'README_VI.md']) {
      const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
      const row = (a) => rd.split('\n').find((l) => l.startsWith(`| \`${a}\` |`)) ?? '';
      ok(row('data-migration-writer').includes('WF07'), `${f}: bảng agent có data-migration-writer dùng ở WF07`);
      ok((rd.split('\n').find((l) => l.startsWith('| WF07 |')) ?? '').includes('data-migration-writer'), `${f}: WF07 liệt kê data-migration-writer`);
      ok(!/^\| G2 \|/m.test(rd), `${f}: bảng Skill gaps bỏ G2 (đã có data-db-migration)`);
      ok(!(rd.split('\n').find((l) => l.startsWith('| `data` |')) ?? '').includes('draft, not yet published') && !(rd.split('\n').find((l) => l.startsWith('| `data` |')) ?? '').includes('draft, chưa publish'),
        `${f}: hàng plugin data không còn ghi draft toàn khối`);
    }
    ok(flat22(fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8')).includes('`data-db-migration` published'),
      'CLAUDE.md: data có data-db-migration published, 4 skill còn draft');
    ok(fs.readFileSync(path.join(REPO_ROOT, 'docs', 'decisions', '0001-database-capabilities-in-data-plugin.md'), 'utf8').includes('data-migration-writer'),
      'ADR-0001: ghi cập nhật publish data-db-migration và agent data-migration-writer');
  }

  // Phase 2 Task 5: câu đã chuyển sang references/ chỉ đến được model qua dòng trỏ trong WORKFLOW.md.
  {
    ok((workflows.stages.find((s) => s.id === 'workflow-db-change')?.body ?? '').includes('`references/forward-only.md`'), 'workflow-db-change: WORKFLOW.md vẫn trỏ tới references/forward-only.md');
    ok((workflows.stages.find((s) => s.id === 'workflow-db-change')?.body ?? '').includes('`references/error-matrix.md`'), 'workflow-db-change: WORKFLOW.md vẫn trỏ tới references/error-matrix.md');
  }
}
