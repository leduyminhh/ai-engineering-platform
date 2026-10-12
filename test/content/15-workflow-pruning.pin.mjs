// Pin nội dung: gate của workflow đã gỡ (plan 2026-10-12-prune-workflows-to-pipelines) phải còn ở skill nhận lại.
export default async function run({ ok, ctx }) {
  const { fs, path, PLUGINS_DIR, CORE_DIR, REPO_ROOT, listFilesRec, workflows } = ctx;
  const flat = (s) => s.replace(/\s+/g, ' ');
  const read = (rel) => { const p = path.join(PLUGINS_DIR, rel); return fs.existsSync(p) ? flat(fs.readFileSync(p, 'utf8')) : ''; };

  const ABSORBED = [
    ['data/skills/data-db-migration/SKILL.md', '`backend-code-review`', 'data-db-migration C5: review query/index chuyển sang backend-code-review'],
    ['data/skills/data-db-migration/references/change/verify-cycle.md', 'Kiểm SQL bù', 'verify-cycle: kiểm SQL bù trên DB test'],
    ['ops/skills/ops-incident-troubleshooting/SKILL.md', 'Cập nhật stakeholder', 'ops-incident-troubleshooting: có bước cập nhật stakeholder'],
    ['ops/skills/ops-incident-troubleshooting/SKILL.md', 'Xác minh phục hồi', 'ops-incident-troubleshooting: có bước xác minh phục hồi'],
    ['ops/skills/ops-incident-troubleshooting/SKILL.md', 'references/severity-scale.md', 'ops-incident-troubleshooting: trỏ thang severity mặc định'],
    ['backend/skills/backend-testing/SKILL.md', 'Phân loại mọi failure', 'backend-testing: phân loại failure, lỗi code → workflow-bugfix'],
    ['frontend/skills/frontend-testing/SKILL.md', 'Phân loại mọi failure', 'frontend-testing: phân loại failure, lỗi code → workflow-bugfix'],
    ['backend/skills/backend-code-review/SKILL.md', 'PR fullstack', 'backend-code-review: chia vùng diff fullstack'],
    ['frontend/skills/frontend-code-review/SKILL.md', 'PR fullstack', 'frontend-code-review: chia vùng diff fullstack'],
    ['backend/skills/backend-code-review/SKILL.md', 'Validate trước khi báo', 'backend-code-review: validate finding trước khi báo'],
    ['frontend/skills/frontend-code-review/SKILL.md', 'Validate trước khi báo', 'frontend-code-review: validate finding trước khi báo'],
  ];
  for (const [rel, needle, msg] of ABSORBED) ok(read(rel).includes(needle), msg);

  const RETIRED = ['api', 'code-review', 'db-change', 'docs', 'incident', 'refactor', 'testing'].map((s) => `workflow-${s}`);
  const hits = [];
  for (const dir of [PLUGINS_DIR, CORE_DIR, workflows?.dir].filter(Boolean)) {
    for (const rel of listFilesRec(dir).filter((f) => /\.(md|json)$/.test(f))) {
      const text = fs.readFileSync(path.join(dir, rel), 'utf8');
      for (const id of RETIRED) if (text.includes(id)) hits.push(`${path.relative(REPO_ROOT, path.join(dir, rel))}: ${id}`);
    }
  }
  ok(hits.length === 0, `không còn tham chiếu workflow đã gỡ${hits.length ? ' — ' + hits.join('; ') : ''}`);

  // Orchestrator nhận tín hiệu của workflow đã gỡ và route sang skill; sự cố production giữ ưu tiên cao nhất cũ.
  const orch = flat(workflows?.stages.find((s) => s.kind === 'orchestrator')?.body ?? '');
  const direct = orch.split('## Yêu cầu chạy trực tiếp bằng skill')[1]?.split('## Các bước')[0] ?? '';
  for (const id of ['ops-incident-troubleshooting', 'backend-code-review', 'frontend-code-review', 'backend-refactor',
    'backend-testing', 'frontend-testing', 'data-db-migration', 'backend-api-contract']) {
    ok(direct.includes(`\`${id}\``), `orchestrator: mục skill trực tiếp route tới ${id}`);
  }
  ok(orch.includes('xét TRƯỚC Registry'), 'orchestrator Bước 1: tín hiệu sự cố production xét trước Registry');
}
