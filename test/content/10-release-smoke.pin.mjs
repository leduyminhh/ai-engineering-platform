// Pin nội dung: workflow-release smoke e2e.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, parseSteps, offeredCatalog, frontmatter, workflows, wfText } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 21. SOURCE: workflow-release Bước 5 — smoke e2e trước deploy (brief C, frontend-e2e-test-writer)
  {
    const flat21 = (t) => t.replace(/\s+/g, ' ');
    const wf21 = (id) => workflows.stages.find((s) => s.id === id);
    const step21 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { title: '', body: '', checkpoint: false };
    // Cắt đúng một trường cột 0 để assert không khớp nhầm chữ của trường khác trong cùng bước.
    const field21 = (body, name) => {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const lines = body.split('\n');
      const i = lines.findIndex((l) => new RegExp(`^- \\*\\*${esc}:\\*\\*`).test(l));
      if (i < 0) return '';
      let j = lines.findIndex((l, k) => k > i && /^- \*\*/.test(l));
      if (j < 0) j = lines.length;
      return flat21(lines.slice(i, j).join('\n'));
    };
    const relWf = wf21('workflow-release');
    const rS5 = step21(relWf, 5), rS6 = step21(relWf, 6);
    ok(field21(rS5.body, 'Thực hiện').includes('agent `frontend-e2e-test-writer`') && field21(rS5.body, 'Thực hiện').includes('agent `ops-release-engineer`'),
      'workflow-release Bước 5: Thực hiện có cả ops-release-engineer lẫn frontend-e2e-test-writer (smoke tuỳ chọn)');
    ok(field21(rS5.body, 'Ràng buộc').includes('staging/production') && field21(rS5.body, 'Ràng buộc').includes('không viết'),
      'workflow-release Bước 5: Ràng buộc smoke chỉ local/test (không staging/production), không viết test');
    ok(field21(rS5.body, 'Gate').includes('not_run') && field21(rS5.body, 'Gate').includes('không có e2e'),
      'workflow-release Bước 5: Gate nhận smoke pass, not_run có lý do hoặc không có e2e');
    ok(field21(rS5.body, 'Khi fail').includes('không deploy') && field21(rS5.body, 'Khi fail').includes('workflow-bugfix'),
      'workflow-release Bước 5: Khi fail smoke đỏ → không deploy, đề xuất workflow-bugfix');
    ok(flat21(wfText('release')).includes('bỏ qua E2') && flat21(wfText('release')).includes('không sửa test'),
      'workflow-release Bước 5: chế độ smoke bỏ qua E2/E3 và không sửa test (flaky → chạy lại, không E4)');
    ok(field21(rS6.body, 'Đầu vào').includes('smoke'), 'workflow-release Bước 6: Đầu vào có kết quả smoke e2e');
    ok((relWf?.agents ?? []).includes('frontend-e2e-test-writer'), 'workflow-release: frontmatter agents có frontend-e2e-test-writer');
    ok(relWf ? parseSteps(relWf.body).length === 8 : false, 'workflow-release: vẫn 8 bước');
    ok(rS6.checkpoint === true, 'workflow-release Bước 6: vẫn là checkpoint ⏸');
    ok((offeredCatalog().plugins.find((p) => p.id === 'workflows')?.skillIds ?? []).includes('workflows/workflow-release'),
      'offeredCatalog: vẫn offer workflows/workflow-release (closure agent e2e đã publish)');
    for (const rd of ['README.md', 'README_VI.md']) {
      const txt = fs.existsSync(path.join(REPO_ROOT, rd)) ? fs.readFileSync(path.join(REPO_ROOT, rd), 'utf8') : '';
      const agentRow = txt.split('\n').find((l) => l.startsWith('| `frontend-e2e-test-writer` |')) ?? '';
      const wfRow = txt.split('\n').find((l) => l.startsWith('| WF11 |')) ?? '';
      ok(agentRow.includes('WF11'), `${rd}: hàng agent frontend-e2e-test-writer có WF11`);
      ok(wfRow.includes('frontend-e2e-test-writer'), `${rd}: hàng WF11 liệt kê frontend-e2e-test-writer`);
    }
  }

  // Phase 2 Task 5: câu đã chuyển sang references/ chỉ đến được model qua dòng trỏ trong WORKFLOW.md.
  {
    ok((workflows.stages.find((s) => s.id === 'workflow-release')?.body ?? '').includes('`references/smoke-e2e.md`'), 'workflow-release: WORKFLOW.md vẫn trỏ tới references/smoke-e2e.md');
  }
}
