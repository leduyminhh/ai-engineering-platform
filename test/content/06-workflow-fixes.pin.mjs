// Pin nội dung: sửa lỗi workflow (major, P2, P3).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, PLUGINS_DIR, parseSteps, stepRefs, frontmatter, workflows } = ctx;

  // 15. SOURCE: workflow — sửa lỗi major không phụ thuộc skill draft (spec 2026-09-29 §5.3 WF7, WF4, WF3; lỗi D7–D10)
  {
    const wfBody = (id) => workflows.stages.find((s) => s.id === id);
    const noStep = { title: '', body: '', checkpoint: false };

    const sec = wfBody('workflow-security-review');
    const secSteps = sec ? parseSteps(sec.body) : [];
    const secStep = (n) => secSteps.find((s) => s.n === n) ?? noStep;
    ok(!!sec && ['engineering-quality-auditor', 'backend-test-writer', 'frontend-test-writer', 'backend-fixer', 'frontend-fixer'].every((a) => sec.agents.includes(a)),
      'workflow-security-review: agents gồm auditor + 2 test-writer (regression test) + 2 fixer (sửa)');
    // D7: vùng rủi ro phải phủ authorization, SSRF và misconfiguration.
    ok(/authorization/.test(secStep(2).body) && secStep(2).body.includes('SSRF') && /misconfiguration/i.test(secStep(2).body),
      'workflow-security-review Bước 2: vùng rủi ro có authorization/access control, SSRF, security misconfiguration');
    // D8: secret lộ phải có bước rotate do người dùng thực hiện, đặt trước bước sửa code.
    ok(secStep(6).title.includes('Thu hồi secret') && secStep(6).checkpoint && /rotate/.test(secStep(6).body) && /người dùng/.test(secStep(6).body),
      'workflow-security-review Bước 6: bước Thu hồi secret (rotate) do người dùng thực hiện, có ⏸');
    ok(/Regression/i.test(secStep(7).title) && secStep(7).body.includes('agent `backend-test-writer`') && secStep(7).body.includes('agent `frontend-test-writer`'),
      'workflow-security-review Bước 7: regression test qua test-writer');
    ok(secSteps.length === 10 && secStep(8).title.startsWith('Sửa') && secStep(9).title.startsWith('Re-scan') && secStep(10).title.startsWith('Commit'),
      'workflow-security-review: 10 bước, Sửa ở Bước 8, Re-scan ở Bước 9, Commit ở Bước 10');

    ok(secStep(7).body.includes('local/test'), 'workflow-security-review Bước 7: test regression chỉ chạy trên môi trường local/test');
    // Bảng agent ở README liệt kê workflow dùng từng agent; phải đi theo frontmatter sau khi sửa D7–D10.
    for (const f of ['README.md', 'README_VI.md']) {
      const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
      const row = (agent) => rd.split('\n').find((l) => l.startsWith(`| \`${agent}\` |`)) ?? '';
      ok(row('backend-test-writer').includes('WF06') && row('frontend-test-writer').includes('WF06')
        && row('engineering-quality-auditor').includes('WF06'),
        `${f}: bảng agent nêu đủ workflow dùng test-writer/auditor sau khi sửa D7–D10`);
    }
  }

  // 16. SOURCE: P2 còn lại — S5, S6, WF9, WF8, WF10 (spec 2026-09-29 §3.3, §5.3)
  {
    const engRead = (rel) => fs.readFileSync(path.join(PLUGINS_DIR, 'engineering', 'skills', rel), 'utf8');
    const wf16 = (id) => workflows.stages.find((s) => s.id === id);
    const noStep16 = { title: '', body: '', checkpoint: false };

    // S5: quality-gate không làm nhiệm vụ kiểm quy ước; chỉ đường sang skill chuyên trách.
    ok(engRead('engineering-quality-gate/SKILL.md').includes('engineering-convention-enforce'),
      'S5: engineering-quality-gate trỏ sang engineering-convention-enforce');
    // S6: thủ tục ghi ADR nằm ở engineering-adr; spec-writing chỉ trỏ sang, không lặp lại thủ tục.
    const specSkill = engRead('engineering-spec-writing/SKILL.md');
    const specStep4 = (specSkill.split('**Ghi ADR')[1] ?? '').split('**Builder check')[0];
    ok(specStep4.includes('engineering-adr') && !specStep4.includes('<số kế tiếp>'),
      'S6: engineering-spec-writing bước Ghi ADR trỏ sang engineering-adr, không còn thủ tục đánh số ADR');

    // WF10: orchestrator từng không chỉ đường tới skill không có workflow (chuỗi db-change → api → feature đi theo workflow đã gỡ).
    const orch16 = wf16('workflow-orchestrator');
    const direct16 = ((orch16?.body ?? '').split('## Yêu cầu chạy trực tiếp bằng skill')[1] ?? '').split('\n## ')[0];
    ok(['backend-init', 'frontend-init', 'backend-migrate-vault-consul'].every((s) => direct16.includes(`\`${s}\``)),
      'workflow-orchestrator: mục "Yêu cầu chạy trực tiếp bằng skill" nêu backend-init, frontend-init, backend-migrate-vault-consul');

    // Sau final review: orchestrator phải nhất quán với đầu ra chuỗi/skill trực tiếp; các workflow khác nêu đủ handoff.
    const orchStep1 = (orch16 ? parseSteps(orch16.body).find((s) => s.n === 1) : undefined) ?? noStep16;
    const out1 = (orchStep1.body.split('**Đầu ra:**')[1] ?? '').split('\n- **')[0];
    const gate1 = (orchStep1.body.split('**Gate:**')[1] ?? '').split('\n- **')[0];
    ok(/ứng viên/.test(out1) && /skill trực tiếp/.test(out1.replace(/\n/g, ' ')) && /skill trực tiếp/.test(gate1.replace(/\n/g, ' ')),
      'workflow-orchestrator Bước 1: Đầu ra và Gate nêu ứng viên và mục skill trực tiếp');
    ok(((orch16?.body ?? '').replace(/\n\s+/g, ' ').match(/không khớp mục skill trực tiếp/g) ?? []).length >= 3,
      'workflow-orchestrator: Khi fail, bảng lỗi và Điều kiện dừng không coi yêu cầu skill trực tiếp là "không khớp"');
  }

  // 17. SOURCE: P3 — WF3-b, A3, WF12, vùng rủi ro, WF11 (spec 2026-09-29 §5.3, §8.5)
  {
    const wf17 = (id) => workflows.stages.find((s) => s.id === id);
    const noStep17 = { title: '', body: '', checkpoint: false };
    const step17 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) ?? noStep17 : noStep17);
    const flat17 = (t) => t.replace(/\s+/g, ' ');

    // A3: mode write không khoá được theo đường dẫn nên mỗi bước test-writer phải tự chứng minh chỉ đụng file test.
    let matched = 0;
    for (const w17 of workflows.stages) {
      const refs17 = stepRefs(w17.body);
      for (const st of parseSteps(w17.body)) {
        const doers = refs17.find((r) => r.n === st.n)?.agents ?? [];
        if (!doers.some((a) => a === 'backend-test-writer' || a === 'frontend-test-writer')) continue;
        matched += 1;
        const gate = flat17((st.body.split('**Gate:**')[1] ?? '').split('\n- **')[0]);
        const evidence = flat17((st.body.split('**Evidence:**')[1] ?? '').split('\n- **')[0]);
        ok(gate.includes('git diff --name-only') && gate.includes('đầu bước') && /file test/.test(gate) && evidence.includes('đầu bước'),
          `${w17.id} bước ${st.n}: Gate/Evidence kiểm file thay đổi so với đầu bước, chỉ chứa file test`);
      }
    }
    ok(matched >= 4, 'A3: có ít nhất 4 bước test-writer được kiểm gate');

    // Workflow security-review có 8 vùng; reference của quality-gate phải có key check cho 3 vùng mới và bảng ánh xạ.
    const areas17 = fs.readFileSync(path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-quality-gate', 'references', 'security-review-areas.md'), 'utf8');
    ok(/authorization|phân quyền|kiểm quyền/i.test(areas17) && /SSRF/.test(areas17) && /misconfiguration|cấu hình (sai|không an toàn)/i.test(areas17),
      'quality-gate security-review-areas: có key check authorization, SSRF, security misconfiguration');
    ok(areas17.includes('**Security misconfiguration:**'),
      'quality-gate security-review-areas: có bullet "**Security misconfiguration:**" ở mục Crypto / Secrets');
    for (const area of ['auth/session', 'authorization/access control', 'input validation', 'SSRF', 'crypto/secrets', 'dependency', 'security misconfiguration', 'logging']) {
      ok(areas17.includes(`| ${area} |`),
        `quality-gate security-review-areas: bảng ánh xạ có hàng vùng "${area}" của workflow-security-review`);
    }

    // WF11 (phần 1): baseline từng chỉ là tiền điều kiện không ai đo (W-a).
    for (const id of ['workflow-feature', 'workflow-bugfix']) {
      const w = wf17(id);
      const s1 = step17(w, 1);
      ok(/^Baseline/.test(s1.title) && flat17(s1.body).includes('session chính') && flat17(w?.body ?? '').includes('Baseline đỏ'),
        `${id}: Bước 1 là Baseline build/test do session chính đo, có hàng lỗi Baseline đỏ`);
      ok(flat17((w?.body ?? '').split('## Điều kiện tiên quyết')[1]?.split('## Các bước')[0] ?? '').includes('ở Bước 1'),
        `${id}: tiền điều kiện Baseline nêu được đo ở Bước 1`);
    }

    // WF11 (phần 2).
    for (const [id, total] of [['workflow-security-review', 10]]) {
      const w = wf17(id);
      const s1 = step17(w, 1);
      ok(/^Baseline/.test(s1.title) && flat17(s1.body).includes('session chính') && flat17(w?.body ?? '').includes('Baseline đỏ'),
        `${id}: Bước 1 là Baseline build/test do session chính đo, có hàng lỗi Baseline đỏ`);
      ok((w ? parseSteps(w.body).length : 0) === total, `${id}: ${total} bước sau khi thêm Baseline`);
      ok(flat17((w?.body ?? '').split('## Điều kiện tiên quyết')[1]?.split('## Các bước')[0] ?? '').includes('ở Bước 1'),
        `${id}: tiền điều kiện Baseline nêu được đo ở Bước 1`);
    }
  }

}
