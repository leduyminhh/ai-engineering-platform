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
    // Manifest description là nơi người dùng phát hiện skill; skill mới thêm mà quên cập nhật thì bị "ẩn".
    for (const id of ['backend', 'frontend', 'engineering']) {
      const desc = JSON.parse(readSrc(`${id}/.manifest.json`)).description;
      const skillsDir = path.join(PLUGINS_DIR, id, 'skills');
      const missing = fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !desc.includes(e.name)).map((e) => e.name);
      ok(missing.length === 0, `P0 PL2: manifest ${id} nêu đủ skill trong description (thiếu: ${missing.join(', ')})`);
    }
    ok(!JSON.parse(readSrc('frontend/.manifest.json')).description.includes('Layered'),
      'P0 D4: manifest frontend không còn "Layered" (kiểu kiến trúc đã đổi sang Feature-Based)');
  }

  // 11. SOURCE: sửa lỗi workflow/agent (P0 WF1, WF2, D11)
  {
    const readRepo = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8').replace(/\r\n/g, '\n');
    const testing = readRepo('workflows', 'testing', 'WORKFLOW.md');
    // Bước 5 cấm sửa code production; câu phủ định "không sửa code" là hợp lệ nên loại trước khi kiểm.
    const testFailRow = testing.split('\n').find((l) => l.startsWith('| Test fail |')) ?? '';
    ok(testFailRow !== '' && !testFailRow.replaceAll('không sửa code', '').includes('sửa code'),
      'P0 WF1: workflow-testing có dòng "Test fail" và không bảo "sửa code" (mâu thuẫn Bước 5)');
    // "sửa test" phải kèm rào chắn chống xoá/nới test để qua; lỗi code phải chuyển sang workflow-bugfix.
    ok(testFailRow.includes('nới') && testFailRow.includes('workflow-bugfix'),
      'P0 WF1: dòng "Test fail" giữ rào "không xoá/nới test" và định tuyến lỗi code sang workflow-bugfix');
    const step6 = testing.split('### Bước 6')[1]?.split('### Bước 7')[0] ?? '';
    const step6Input = step6.split('\n').find((l) => l.startsWith('- **Đầu vào:**')) ?? '';
    ok(step6Input !== '' && !step6Input.includes('đã chạy xanh'),
      'P0 WF1: workflow-testing Bước 6 không đòi "đã chạy xanh" (lỗi code chuyển sang workflow-bugfix nên không xanh toàn bộ)');
    const docs = readRepo('workflows', 'docs', 'WORKFLOW.md');
    ok(!docs.includes('| Build fail | Chẩn đoán') && !docs.includes('| Test fail | Phân tích failure'),
      'P0 WF2: workflow-docs không còn boilerplate Build fail/Test fail (workflow không build/test)');
    ok(!readRepo('plugins', 'engineering', 'agents', 'engineering-spec-analyst.md').includes('cả hai skill'),
      'P0 D11: engineering-spec-analyst không còn "cả hai skill" (agent dùng ba skill)');
  }
}
