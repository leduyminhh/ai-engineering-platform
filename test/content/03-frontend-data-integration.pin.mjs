// Pin nội dung: frontend-data-integration.
export default async function run({ ok, ctx }) {
  const { fs, path, PLUGINS_DIR, frontmatter, listFilesRec, core } = ctx;

  // 12. SOURCE: frontend-data-integration — hợp đồng skill/references/agent (spec 2026-09-29 §7.3, §8.3)
  {
    const diDir = path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-data-integration');
    const diRef = path.join(diDir, 'references');
    const diFiles = listFilesRec(diRef);
    const diRead = (rel) => fs.readFileSync(path.join(diRef, rel), 'utf8');
    const diSkillPath = path.join(diDir, 'SKILL.md');
    const diSkillExists = fs.existsSync(diSkillPath);
    ok(diSkillExists, 'frontend-data-integration: có SKILL.md');
    const diSkill = diSkillExists ? fs.readFileSync(diSkillPath, 'utf8') : '';
    ok(/^order: 7$/m.test(diSkill) && /^sharedAssets: templates\/architecture$/m.test(diSkill),
      'frontend-data-integration: frontmatter order 7, sharedAssets templates/architecture');
    ok(['I1', 'I2', 'I3', 'I4', 'I5'].every((g) => diSkill.includes(`### ${g}.`)),
      'frontend-data-integration: SKILL.md có đủ cổng I1–I5');
    for (const f of ['contract-and-codegen.md', 'data-layer-by-architecture.md', 'states-and-errors.md']) {
      ok(diFiles.includes(f), `frontend-data-integration: có references/${f}`);
      ok(diSkill.includes(`(references/${f})`), `frontend-data-integration: SKILL.md link tới references/${f}`);
    }
    const diLayer = diFiles.includes('data-layer-by-architecture.md') ? diRead('data-layer-by-architecture.md') : '';
    ok(['Feature-Based', 'FSD', 'Micro-FE'].every((k) => diLayer.includes(`| ${k} |`)),
      'frontend-data-integration: bảng đặt file có đủ 3 kiến trúc');
    ok(diLayer.includes('entities/<x>/api') && diLayer.includes('features/<x>/api'),
      'frontend-data-integration: FSD tách đọc (entities) và ghi (features)');
    const diStates = diFiles.includes('states-and-errors.md') ? diRead('states-and-errors.md') : '';
    ok(['loading', 'error', 'empty', 'success'].every((s) => diStates.includes(`| ${s} |`)),
      'frontend-data-integration: bảng trạng thái đủ 4 hàng loading/error/empty/success');
    const diCodegen = diFiles.includes('contract-and-codegen.md') ? diRead('contract-and-codegen.md') : '';
    ok(diCodegen.includes('https://'),
      'frontend-data-integration: contract-and-codegen có nguồn https cho hành vi công cụ');
    // Tên file references không trùng giữa các skill frontend (validate mục hygiene cũng kiểm, ở đây báo rõ theo skill).
    const diOtherRefs = fs.readdirSync(path.join(PLUGINS_DIR, 'frontend', 'skills'))
      .filter((d) => d !== 'frontend-data-integration')
      .flatMap((d) => listFilesRec(path.join(PLUGINS_DIR, 'frontend', 'skills', d, 'references')));
    ok(diFiles.every((f) => !diOtherRefs.includes(f)), 'frontend-data-integration: tên file references không trùng skill frontend khác');
    const diAgentPath = path.join(PLUGINS_DIR, 'frontend', 'agents', 'frontend-data-integrator.md');
    const diAgentExists = fs.existsSync(diAgentPath);
    ok(diAgentExists, 'frontend-data-integrator: có agent file');
    const diAgent = diAgentExists ? fs.readFileSync(diAgentPath, 'utf8') : '';
    ok(/^mode: write$/m.test(diAgent) && /^skills: "frontend-data-integration"$/m.test(diAgent),
      'frontend-data-integrator: mode write, skills = frontend-data-integration');
    ok(diAgent.includes('container') && diAgent.includes('docs/contracts/') && diAgent.includes('core:principles'),
      'frontend-data-integrator: nối ở container/page, không sửa docs/contracts/, trỏ contract đầu ra ở core:principles');
  }
}
