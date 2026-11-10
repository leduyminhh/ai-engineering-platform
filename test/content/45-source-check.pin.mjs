// Pin: mục Kiểm nguồn trong skill principles và con trỏ ở ba skill implement (design P2, D5) — câu chữ chỉ tồn tại trong tài liệu.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (rel) => { try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };

  const P = read('build/claude/plugins/core/skills/principles/SKILL.md');
  const SC = (P.match(/^## Kiểm nguồn[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m) || [, ''])[1];
  ok(SC !== '', 'AC2.1: bản build skill principles có mục "Kiểm nguồn"');
  for (const k of ['phiên bản', 'docs chính thức', 'deep link', '[Unverified]']) ok(SC.includes(k), `AC2.1: Kiểm nguồn nêu ý "${k}"`);

  for (const f of ['plugins/backend/skills/backend-implement', 'plugins/frontend/skills/frontend-implement', 'plugins/frontend/skills/frontend-data-integration']) {
    const body = read(`${f}/SKILL.md`);
    const s0 = (body.match(/^### 0\.[^\n]*\n([\s\S]*?)(?=^### I?1\.)/m) || [, ''])[1];
    ok(/Kiểm nguồn/.test(s0) && /core:principles/.test(s0), `AC2.2: ${f.split('/').pop()} trỏ mục Kiểm nguồn của core:principles ở bước 0`);
  }
}
