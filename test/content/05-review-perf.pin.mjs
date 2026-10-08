// Pin nội dung: backend-code-review trục performance.
export default async function run({ ok, ctx }) {
  const { fs, path, PLUGINS_DIR } = ctx;

  // 14. SOURCE: backend-code-review — trục performance (spec 2026-09-29 §3.3 S4, lỗi D12)
  {
    const brDir = path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-code-review');
    const brRead = (rel) => fs.readFileSync(path.join(brDir, rel), 'utf8');
    const brDims = brRead('references/review-dimensions.md');
    const brSkill = brRead('SKILL.md');
    const brTemplate = brRead('references/review-output-template.md');
    const brAgent = fs.readFileSync(path.join(PLUGINS_DIR, 'backend', 'agents', 'backend-reviewer.md'), 'utf8');
    ok(brDims.includes('## Trục 6 — Performance'), 'backend-code-review: review-dimensions có "Trục 6 — Performance"');
    const brPerf = (brDims.split('## Trục 6 — Performance')[1] ?? '').split('\n## ')[0];
    ok(['N+1', 'index', 'vòng lặp', 'eager'].every((k) => brPerf.includes(k)),
      'backend-code-review: Trục 6 nêu đủ N+1, thiếu index, query trong vòng lặp, tải eager thừa');
    // Contract đầu ra cấm kết luận hiệu năng khi thiếu số đo; trục mới phải giữ đúng ràng buộc đó.
    ok(brPerf.includes('suspected') && brPerf.includes('số đo'),
      'backend-code-review: Trục 6 quy định finding hiệu năng không có số đo là suspected');
    ok(brSkill.includes('- **Performance**') && /^description: .*N\+1/m.test(brSkill),
      'backend-code-review: SKILL.md có bullet Performance ở bước 1 và nêu N+1 trong description');
    ok(brTemplate.includes('`performance`'), 'backend-code-review: mẫu output liệt kê trục performance');
    ok(/hiệu năng/.test(brAgent), 'backend-reviewer: Vai trò nêu rủi ro hiệu năng');
  }
}
