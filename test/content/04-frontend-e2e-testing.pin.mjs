// Pin nội dung: frontend-e2e-testing.
export default async function run({ ok, ctx }) {
  const { fs, path, PLUGINS_DIR, frontmatter, listFilesRec, core } = ctx;

  // 13. SOURCE: frontend-e2e-testing — hợp đồng skill/references/agent (spec 2026-09-29 §7.2, §8.2)
  {
    const e2eDir = path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-e2e-testing');
    const e2eRef = path.join(e2eDir, 'references');
    const e2eFiles = listFilesRec(e2eRef);
    const e2eRead = (rel) => fs.readFileSync(path.join(e2eRef, rel), 'utf8');
    const e2eSkillPath = path.join(e2eDir, 'SKILL.md');
    const e2eSkillExists = fs.existsSync(e2eSkillPath);
    ok(e2eSkillExists, 'frontend-e2e-testing: có SKILL.md');
    const e2eSkill = e2eSkillExists ? fs.readFileSync(e2eSkillPath, 'utf8') : '';
    ok(/^order: 8$/m.test(e2eSkill) && /^sharedAssets: templates\/architecture$/m.test(e2eSkill),
      'frontend-e2e-testing: frontmatter order 8, sharedAssets templates/architecture');
    ok(['E1', 'E2', 'E3', 'E4', 'E5'].every((g) => e2eSkill.includes(`### ${g}.`)),
      'frontend-e2e-testing: SKILL.md có đủ cổng E1–E5');
    ok(['E-r1', 'E-r2', 'E-r3', 'E-r4', 'E-r5', 'E-r6', 'E-r7'].every((r) => e2eSkill.includes(`| ${r} |`)),
      'frontend-e2e-testing: SKILL.md có đủ quy tắc E-r1–E-r7');
    for (const f of ['playwright-config-and-auth.md', 'flow-selection-and-patterns.md']) {
      ok(e2eFiles.includes(f), `frontend-e2e-testing: có references/${f}`);
      ok(e2eSkill.includes(`(references/${f})`), `frontend-e2e-testing: SKILL.md link tới references/${f}`);
    }
    const e2eCfg = e2eFiles.includes('playwright-config-and-auth.md') ? e2eRead('playwright-config-and-auth.md') : '';
    ok(e2eCfg.includes("trace: 'on-first-retry'") && e2eCfg.includes('storageState') && e2eCfg.includes('E2E_BASE_URL'),
      'frontend-e2e-testing: config mẫu có trace on-first-retry, storageState, baseURL từ biến môi trường');
    ok(/retries:\s*process\.env\.CI \? 2 : 1/.test(e2eCfg), 'frontend-e2e-testing: config mẫu có retries ≥ 1 để trace on-first-retry được ghi');
    ok(e2eCfg.includes('assertLocalBaseURL') && /staging/.test(e2eCfg) && /production/.test(e2eCfg),
      'frontend-e2e-testing: có hàm chặn host không phải local/test (staging/production)');
    ok(e2eCfg.includes('https://playwright.dev/'),
      'frontend-e2e-testing: playwright-config-and-auth có nguồn https://playwright.dev/ cho hành vi công cụ');
    ok(['Feature-Based', 'FSD', 'Micro-FE'].every((k) => e2eCfg.includes(`| ${k} |`)),
      'frontend-e2e-testing: bảng vị trí e2e có đủ 3 kiến trúc');
    const e2eFlow = e2eFiles.includes('flow-selection-and-patterns.md') ? e2eRead('flow-selection-and-patterns.md') : '';
    ok(e2eFlow.includes('| # | Luồng | AC |') && e2eFlow.includes('--repeat-each=3'),
      'frontend-e2e-testing: có bảng chọn luồng → AC và lệnh --repeat-each=3');
    // E-r1/E-r2: ví dụ trong tài liệu không được tự vi phạm quy tắc của chính skill.
    ok(!/locator\(\s*['"`][.#\/]/.test(e2eCfg + e2eFlow) && !/waitForTimeout\(/.test(e2eCfg + e2eFlow),
      'frontend-e2e-testing: ví dụ không dùng selector CSS/XPath và không dùng waitForTimeout(');
    // Tên file references không trùng giữa các skill frontend (validate mục hygiene cũng kiểm, ở đây báo rõ theo skill).
    const e2eOtherRefs = fs.readdirSync(path.join(PLUGINS_DIR, 'frontend', 'skills'))
      .filter((d) => d !== 'frontend-e2e-testing')
      .flatMap((d) => listFilesRec(path.join(PLUGINS_DIR, 'frontend', 'skills', d, 'references')));
    ok(e2eFiles.every((f) => !e2eOtherRefs.includes(f)), 'frontend-e2e-testing: tên file references không trùng skill frontend khác');

    const e2eAgentPath = path.join(PLUGINS_DIR, 'frontend', 'agents', 'frontend-e2e-test-writer.md');
    const e2eAgentExists = fs.existsSync(e2eAgentPath);
    ok(e2eAgentExists, 'frontend-e2e-test-writer: có agent file');
    const e2eAgent = e2eAgentExists ? fs.readFileSync(e2eAgentPath, 'utf8') : '';
    ok(/^mode: write$/m.test(e2eAgent) && /^skills: "frontend-e2e-testing"$/m.test(e2eAgent),
      'frontend-e2e-test-writer: mode write, skills = frontend-e2e-testing');
    ok(e2eAgent.includes('e2e/') && e2eAgent.includes('staging/production') && e2eAgent.includes('not_run') && e2eAgent.includes('core:principles'),
      'frontend-e2e-test-writer: chỉ ghi e2e/, cấm staging/production, not_run khi thiếu môi trường, evidence theo core:principles');
  }
}
