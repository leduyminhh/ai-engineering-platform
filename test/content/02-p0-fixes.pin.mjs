// Pin nội dung: sửa lỗi P0 (contract đầu ra, skill/manifest, workflow/agent).
export default async function run({ ok, ctx }) {
  const { fs, path, loadCore, REPO_ROOT, PLUGINS_DIR, listFilesRec, core, plugins } = ctx;

  // 9. SOURCE: contract đầu ra ở core/principles (P0 PL1)
  {
    // Spec không được ship; contract chỉ tới được agent ở project đích qua core:principles.
    const cp = loadCore().principles || '';
    ok(cp.includes('workflow_result'), 'core.principles: có contract workflow_result');
    ok(cp.includes('severity: blocker'), 'core.principles: có schema finding (severity: blocker)');
    ok(cp.includes('status: passed'), 'core.principles: có schema evidence (status: passed)');
    const stale = [];
    for (const root of [PLUGINS_DIR, path.join(REPO_ROOT, 'workflows')]) {
      for (const rel of listFilesRec(root)) {
        if (!rel.endsWith('.md') || rel.split('/').includes('build')) continue;
        const txt = fs.readFileSync(path.join(root, rel), 'utf8');
        if (txt.includes('schema spec §5.1') || txt.includes('schema §5.1')) stale.push(path.basename(root) + '/' + rel);
      }
    }
    ok(stale.length === 0, `không còn pointer tới "schema §5.1" của spec không ship (=${stale.join(', ')})`);
  }

  // 10. SOURCE: sửa lỗi nội dung skill/manifest (P0 S1–S3, PL2)
  {
    const readSrc = (rel) => fs.readFileSync(path.join(PLUGINS_DIR, rel), 'utf8');
    ok(!readSrc('backend/skills/backend-code-review/SKILL.md').includes('sắp có'),
      'P0 S1: backend-code-review không còn "sắp có" (backend-refactor đã tồn tại)');
    ok(!readSrc('frontend/skills/frontend-code-review/SKILL.md').includes('sắp có'),
      'P0 S1: frontend-code-review không còn "sắp có" (frontend-refactor đã tồn tại)');
    // Mâu thuẫn với ranh giới "KHÔNG nối data/API/route" của chính frontend-implement.
    ok(!readSrc('frontend/shared/principles.md').includes('nối API thật'),
      'P0 S2: frontend principles không còn "nối API thật" (mâu thuẫn ranh giới frontend-implement)');
    ok(!readSrc('backend/skills/backend-init/SKILL.md').includes('Node-TypeScript'),
      'P0 S3: backend-init không còn lựa chọn stack Node-TypeScript (chưa có template)');
    // PL2 (manifest nêu đủ skill) đã thành contract ở 10-source.
    ok(!JSON.parse(readSrc('frontend/.manifest.json')).description.includes('Layered'),
      'P0 D4: manifest frontend không còn "Layered" (kiểu kiến trúc đã đổi sang Feature-Based)');
  }

  // 11. SOURCE: sửa lỗi agent (P0 D11; WF1/WF2 đi theo workflow-testing/workflow-docs đã gỡ)
  {
    const readRepo = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8').replace(/\r\n/g, '\n');
    ok(!readRepo('plugins', 'engineering', 'agents', 'engineering-spec-analyst.md').includes('cả hai skill'),
      'P0 D11: engineering-spec-analyst không còn "cả hai skill" (agent dùng ba skill)');
  }
}
