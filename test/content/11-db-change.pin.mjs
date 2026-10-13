// Pin nội dung: publish data-db-migration và data-migration-writer (workflow-db-change đã gỡ 2026-10-12).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, PLUGINS_DIR, offeredCatalog, frontmatter } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 22. SOURCE: publish data-db-migration + agent data-migration-writer (spec 2026-10-01-data-migration-writer-design)
  {
    const flat22 = (t) => t.replace(/\s+/g, ' ');
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
    ok(dmwScope.includes('do chính lượt giao việc này tạo') && dmwScope.includes('đã có trên base branch'),
      'data-migration-writer: được sửa file do chính lượt giao việc tạo; cấm sửa file đã có trên base branch');
    const beImpl22 = flat22(fs.readFileSync(path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-implement', 'SKILL.md'), 'utf8'));
    ok(beImpl22.includes('`data-db-migration`') && beImpl22.includes('`backend-migrate-vault-consul`'),
      'backend-implement (S8): ranh giới trỏ đích danh data-db-migration và backend-migrate-vault-consul');
    for (const f of ['README.md', 'README_VI.md']) {
      const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
      const row = (a) => rd.split('\n').find((l) => l.startsWith(`| \`${a}\` |`)) ?? '';
      ok(row('data-migration-writer').includes('data-db-migration'), `${f}: bảng agent có data-migration-writer dùng qua skill data-db-migration`);
      ok(!/^\| G2 \|/m.test(rd), `${f}: bảng Skill gaps bỏ G2 (đã có data-db-migration)`);
      ok(!(rd.split('\n').find((l) => l.startsWith('| `data` |')) ?? '').includes('draft, not yet published') && !(rd.split('\n').find((l) => l.startsWith('| `data` |')) ?? '').includes('draft, chưa publish'),
        `${f}: hàng plugin data không còn ghi draft toàn khối`);
    }
    ok(flat22(fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8')).includes('`data-db-migration` published'),
      'CLAUDE.md: data có data-db-migration published, 4 skill còn draft');
    ok(fs.readFileSync(path.join(REPO_ROOT, 'docs', 'decisions', '0001-database-capabilities-in-data-plugin.md'), 'utf8').includes('data-migration-writer'),
      'ADR-0001: ghi cập nhật publish data-db-migration và agent data-migration-writer');
  }
}
