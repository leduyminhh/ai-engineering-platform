// Pin: bảng tự biện minh 4–6 dòng cho 9 skill (request 2026-11-10-agent-skills-gap-closure, part 04).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const SELF = '## Dấu hiệu đang tự biện minh';
  const skills = [
    ['plugins/backend/skills/backend-code-review', SELF],
    ['plugins/frontend/skills/frontend-code-review', SELF],
    ['plugins/backend/skills/backend-refactor', SELF],
    ['plugins/frontend/skills/frontend-refactor', SELF],
    ['plugins/engineering/skills/engineering-quality-gate', SELF],
    ['plugins/ops/skills/ops-deploy-release', SELF],
    ['plugins/data/skills/data-db-migration', SELF],
    ['core/skills/git-workflow', SELF],
    ['plugins/engineering/skills/engineering-debugging', '## Dấu hiệu đang đoán thay vì điều tra'],
  ];
  for (const [dir, heading] of skills) {
    let txt = '';
    try { txt = fs.readFileSync(path.join(REPO_ROOT, dir, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n'); } catch { /* thiếu file → assert đỏ */ }
    const name = path.basename(dir);
    const lines = txt.split('\n');
    const start = lines.findIndex((l) => l.trim() === heading);
    ok(start >= 0, `AC4.1: ${name} có mục "${heading}"`);
    if (start >= 0) {
      let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
      if (end < 0) end = lines.length;
      const rows = lines.slice(start, end).filter((l) => l.startsWith('| "')).length;
      ok(rows >= 4 && rows <= 6, `AC4.1: ${name} có 4–6 dòng bảng (có ${rows})`);
    }
    ok(lines.length <= 300, `AC4.1: ${name} SKILL.md ≤ 300 dòng (có ${lines.length})`);
  }
}
