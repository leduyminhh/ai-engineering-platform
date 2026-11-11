// Pin: checklist robustness và skill gọi LLM (request 2026-11-11-skill-enrichment-from-usage, part 03-backend).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (rel) => {
    try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; }
  };

  // AC4.1: đúng 5 nhóm, mỗi nhóm 2–4 checkbox kèm cách kiểm.
  const checklist = read('plugins/backend/templates/robustness/robustness-checklist.md');
  const groups = checklist.split(/^## /m).slice(1);
  const wanted = ['Chặn kích thước input', 'Che secret', 'Idempotency', 'Race và CAS', 'Việc mồ côi'];
  ok(groups.length === wanted.length, `AC4.1: checklist có đúng ${wanted.length} nhóm (có ${groups.length})`);
  for (const w of wanted) {
    const g = groups.find((x) => x.startsWith(w));
    ok(!!g, `AC4.1: có nhóm "${w}"`);
    if (!g) continue;
    const boxes = g.split('\n').filter((l) => l.startsWith('- [ ] '));
    ok(boxes.length >= 2 && boxes.length <= 4, `AC4.1: nhóm "${w}" có 2–4 checkbox (có ${boxes.length})`);
    ok(boxes.every((l) => /Cách kiểm:/.test(l)), `AC4.1: mỗi checkbox nhóm "${w}" có "Cách kiểm:"`);
  }

  // AC4.2: hai skill ship chung một checklist qua sharedAssets và trỏ ở bước đầu quy trình.
  for (const id of ['backend-implement', 'backend-code-review']) {
    const txt = read(`plugins/backend/skills/${id}/SKILL.md`);
    const assets = (txt.match(/^sharedAssets:s*(.+)$/m)?.[1] ?? '').split(',').map((s) => s.trim());
    ok(assets.includes('templates/robustness') && assets.includes('templates/architecture'), `AC4.2: ${id} khai sharedAssets robustness và architecture`);
    const proc = txt.split(/^## Quy trình/m)[1] ?? '';
    const firstStep = proc.split(/^### 1./m)[0];
    ok(firstStep.includes('robustness/robustness-checklist.md'), `AC4.2: ${id} trỏ checklist ở bước đầu quy trình`);
    ok(txt.split(String.fromCharCode(10)).length <= 300, `AC4.2: ${id} SKILL.md ≤ 300 dòng`);
    ok(fs.existsSync(path.join(ctx.claudeSkillDir('backend', id), 'robustness', 'robustness-checklist.md')), `AC4.2: build có robustness/robustness-checklist.md cạnh ${id}`);
  }
}
