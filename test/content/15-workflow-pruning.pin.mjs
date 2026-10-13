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
    // Review đứng riêng (không qua workflow-feature) vẫn phải bắt drift khi diff đụng contract/controller/DTO.
    ['backend/skills/backend-code-review/SKILL.md', 'kiểm drift contract↔code', 'backend-code-review: diff đụng contract/controller/DTO thì kiểm drift'],
    // Rào của P0 WF1: sửa test không được thành xoá/nới assertion để qua.
    ['backend/skills/backend-testing/SKILL.md', 'không xoá/nới assertion', 'backend-testing: lỗi test → sửa test, không xoá/nới assertion'],
    ['frontend/skills/frontend-testing/SKILL.md', 'không xoá/nới assertion', 'frontend-testing: lỗi test → sửa test, không xoá/nới assertion'],
    // Verdict + dedupe của workflow-code-review Bước 5 cũ.
    ['backend/skills/backend-code-review/SKILL.md', 'Kết luận PR fullstack', 'backend-code-review: PR fullstack gộp finding, bỏ trùng, có verdict'],
    ['frontend/skills/frontend-code-review/SKILL.md', 'Kết luận PR fullstack', 'frontend-code-review: PR fullstack gộp finding, bỏ trùng, có verdict'],
    ['ops/skills/ops-incident-troubleshooting/SKILL.md', 'Gán severity', 'ops-incident-troubleshooting bước 0: gán severity'],
    ['ops/skills/ops-incident-troubleshooting/SKILL.md', 'phòng ngừa cần sửa code → `workflow-bugfix`', 'ops-incident-troubleshooting bước 7: phòng ngừa cần sửa code → workflow-bugfix'],
    // Hai agent mất nơi dispatch khi gỡ workflow: skill nhận lại phải chỉ rõ lúc nào giao cho agent.
    ['ops/skills/ops-incident-troubleshooting/SKILL.md', 'agent `ops-incident-investigator`', 'ops-incident-troubleshooting: chỉ rõ phần giao agent ops-incident-investigator (chỉ đọc)'],
    ['data/skills/data-db-migration/SKILL.md', 'agent `data-migration-writer`', 'data-db-migration C3: chỉ rõ phần giao agent data-migration-writer'],
    // Gate của workflow-release (spec 2026-10-13 §6.2): migration chờ chạy, thứ tự migration↔deploy, smoke e2e trước deploy.
    ['ops/skills/ops-deploy-release/references/release-checklist.md', 'so với tag trước', 'ops-deploy-release checklist: liệt kê migration chờ chạy so với tag trước'],
    ['ops/skills/ops-deploy-release/references/release-checklist.md', 'migration tương thích ngược chạy trước', 'ops-deploy-release checklist: thứ tự migration↔deploy'],
    ['ops/skills/ops-deploy-release/references/release-checklist.md', 'Smoke e2e trước deploy', 'ops-deploy-release checklist: smoke e2e tuỳ chọn trước deploy'],
    ['ops/skills/ops-deploy-release/references/release-checklist.md', 'không trỏ staging/production', 'ops-deploy-release checklist: smoke e2e chỉ local/test, không trỏ staging/production'],
    ['ops/skills/ops-deploy-release/references/release-checklist.md', 'KHÔNG deploy', 'ops-deploy-release checklist: smoke e2e đỏ/failed → KHÔNG deploy'],
  ];
  for (const [rel, needle, msg] of ABSORBED) ok(read(rel).includes(needle), msg);

  const RETIRED = [...['api', 'code-review', 'db-change', 'docs', 'incident', 'refactor', 'testing', 'release'].map((s) => `workflow-${s}`),
    'engineering-release-scribe', 'ops-release-engineer'];
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
  // Yêu cầu khớp cả Registry lẫn mục skill (vd "review bảo mật PR#12") phải có luật chọn, và Ràng buộc không cấm chính mục skill.
  ok(orch.includes('ưu tiên workflow trong Registry'), 'orchestrator Bước 1: khớp cả Registry lẫn mục skill → ưu tiên workflow');
  ok(orch.includes('heuristic ngoài Registry và mục "Yêu cầu chạy trực tiếp bằng skill"'),
    'orchestrator Bước 1: Ràng buộc cho phép route theo mục skill trực tiếp');
  ok(!orch.includes('đổi schema → làm API'), 'orchestrator Bước 1: không còn ví dụ chuỗi dựa trên workflow đã gỡ');

  // workflow-release đã gỡ: tín hiệu phát hành route sang git-release, chuẩn bị deploy sang ops-deploy-release.
  ok(direct.includes('`git-release`') && direct.includes('"phát hành"') && direct.includes('`ops-deploy-release`'),
    'orchestrator: "phát hành" → git-release, chuẩn bị deploy → ops-deploy-release');
  ok(!fs.existsSync(path.join(REPO_ROOT, 'workflows', 'release')), 'workflows/release đã gỡ');
}
