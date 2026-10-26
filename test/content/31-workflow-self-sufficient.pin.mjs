// Pin: workflow tự đủ (docs/requests/2026-10-26-workflow-self-sufficient). Task 1: check-request kiểm kind của task + plan template (AC2.1).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, pathToFileURL } = ctx;

  // AC2.1: check-request kiểm dòng **Kind:** của từng task trong plan.md
  {
    const scriptPath = path.join(REPO_ROOT, 'core', 'skills', 'artifact-templates', 'scripts', 'check-request.mjs');
    const cr = await import(pathToFileURL(scriptPath).href);
    const base = {
      'design.md': '# D\n## 3. Tiêu chí chấp nhận\n- [ ] **AC1.1** — Given a When b Then c\n',
      'plan.md': '# Plan\n**Goal:** x\n**Spec:** design.md\n**Phủ AC:** AC1.1\n',
    };
    const withTasks = (tasks) => ({ ...base, 'plan.md': base['plan.md'] + tasks });
    const run1 = (tasks) => cr.checkRequest(withTasks(tasks)).filter((w) => w.code === 'W17' || w.code === 'W18');
    const codes = (tasks) => run1(tasks).map((w) => w.code).join(',');

    ok(Array.isArray(cr.TASK_KINDS) && cr.TASK_KINDS.join(',') === 'BE,FE-UI,FE-INT,E2E,DB,CT,DOCS,TOOLING',
      'AC2.1: TASK_KINDS đủ 8 kind');
    ok(codes('\n### Task 1: x\n**Phủ AC:** AC1.1\n') === 'W17', 'AC2.1: task thiếu **Kind:** → W17');
    ok(codes('\n### Task 1: x\n**Kind:** QA\n') === 'W18', 'AC2.1: kind ngoài TASK_KINDS → W18');
    ok(codes('\n### Task 1: x\n**Kind:** BE\n') === '', 'AC2.1: kind hợp lệ → không W17/W18');
    ok(codes('') === '', 'AC2.1: plan không có task → không W17/W18');
    ok(codes('\n```\n### Task 9: y\n```\n') === '', 'AC2.1: heading task trong khối code không bị tính');
    ok(codes('\n### Task 1: a\n**Kind:** BE\n## Khác\n### Task 2: b\n') === 'W17', 'AC2.1: Kind chỉ tính trong phạm vi task của nó');
    const w = run1('\n### Task 1: a\n**Kind:** BE\n### Task 2: b\n')[0];
    ok(!!w && w.file === 'plan.md' && w.line === 8, 'AC2.1: cảnh báo trỏ dòng heading task (plan.md:8)');
  }

  // AC2.1: plan template có bản đồ file, Kind và Interfaces ở task mẫu
  {
    const tpl = fs.readFileSync(path.join(REPO_ROOT, 'core', 'skills', 'artifact-templates', 'references', 'plan.template.md'), 'utf8');
    ok(tpl.indexOf('## Bản đồ file') > 0 && tpl.indexOf('## Bản đồ file') < tpl.indexOf('## Global Constraints'),
      'AC2.1: plan template có "## Bản đồ file" trước Global Constraints');
    ok(tpl.includes('**Kind:**') && tpl.includes('**Interfaces:**') && tpl.includes('Consumes') && tpl.includes('Produces'),
      'AC2.1: task mẫu có **Kind:** và **Interfaces:** (Consumes/Produces)');
  }
}
