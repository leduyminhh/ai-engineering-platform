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
}
