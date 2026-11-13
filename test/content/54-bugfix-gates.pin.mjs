// Pin hợp đồng vận hành của workflow-bugfix: không bỏ gate khi bug "đã rõ" (request 2026-11-13-bugfix-gates).
export default async function run({ ok, ctx }) {
  const { workflows, parseSteps } = ctx;
  const wf = workflows.stages.find((s) => s.id === 'workflow-bugfix');
  const flat = (t) => t.replace(/\s+/g, ' ');
  const step = (n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { body: '' };
  const field = (n, name) => flat((step(n).body.split(`**${name}:**`)[1] ?? '').split('\n- **')[0]);

  // [bước, trường, các chuỗi bắt buộc, AC]; chuỗi chỉ là tên vận hành (agent, skill, status, nhánh), không phải câu văn.
  const GATES = [
    [5, 'Ràng buộc', ['không phải lý do bỏ'], 'AC1.1'],
    [6, 'Ràng buộc', ['`frontend-fixer`', '`backend-fixer`', '`frontend-fix`', '`backend-fix`', 'kể cả bản sửa một dòng'], 'AC2.1'],
    [5, 'Ràng buộc', ['status: blocked', 'next_actions'], 'AC3.1'],
    [9, 'Ràng buộc', ['status: blocked', 'next_actions'], 'AC3.1'],
    [3, 'Hành động', ['`bugfix/<slug>`', '`main`', '`master`', '`dev`', '`develop`', '`core:git-workflow`'], 'AC4.1'],
    [3, 'Evidence', ['tên nhánh'], 'AC4.1'],
    [3, 'Hành động', ['blocked'], 'AC4.2'],
    [3, 'Hành động', ['test đỏ sẵn', 'không dispatch'], 'AC5.1'],
    [3, 'Gate', ['chỉ gồm file test'], 'AC4.1'],
  ];
  for (const [n, name, needles, ac] of GATES) {
    const text = field(n, name);
    for (const needle of needles) ok(text.includes(needle), `${ac}: bugfix Bước ${n} ${name} có "${needle}"`);
  }

  const fixDesc = ctx.plugins.find((p) => p.id === 'frontend')?.stages.find((s) => s.id === 'frontend-fix')?.description ?? '';
  ok(fixDesc.length > 0 && fixDesc.length <= 500 && fixDesc.includes('Không dùng khi chưa có oracle đỏ → workflow-bugfix'),
    `AC6.1: description của frontend-fix ≤ 500 ký tự (có ${fixDesc.length}) và giữ vế "Không dùng khi chưa có oracle đỏ → workflow-bugfix"`);

  const { fs, path, REPO_ROOT } = ctx;
  const caseDir = path.join(REPO_ROOT, 'evals', 'workflows', 'bugfix-clear-cause');
  const graderDir = path.join(caseDir, 'graders');
  const graders = fs.existsSync(graderDir) ? fs.readdirSync(graderDir).map((f) => fs.readFileSync(path.join(graderDir, f), 'utf8')) : [];
  ok(fs.existsSync(path.join(caseDir, 'prompt.md')) && graders.some((g) => /^type: llm$/m.test(g) && g.includes('root cause')),
    'AC8.1: case evals/workflows/bugfix-clear-cause có prompt.md và grader llm nhắc root cause');

  const graph = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'workflows', 'bugfix', 'graph.json'), 'utf8'));
  ok(graph.steps.length === 9 && graph.steps.every((s, i) => s.n === i + 1),
    `AC7.1: graph.json của bugfix vẫn có đúng 9 bước đánh số 1–9 (có ${graph.steps.length})`);

  const rows = (wf?.body ?? '').split('\n').filter((l) => l.startsWith('| Cấm: bỏ bước ⏸ hoặc Bước 8'));
  ok(rows.length === 1, `AC1.2: bảng lỗi có đúng một hàng "Cấm: bỏ bước ⏸ hoặc Bước 8" (có ${rows.length})`);
}
