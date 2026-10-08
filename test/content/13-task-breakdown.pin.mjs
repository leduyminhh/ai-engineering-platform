// Pin nội dung: engineering-task-breakdown.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, PLUGINS_DIR, frontmatter, plugins } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 29a. SOURCE: engineering-task-breakdown — SKILL.md + analysis/sizing/checklist (spec 2026-10-07 §4, §6.1)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const TB_DIR = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-task-breakdown');
    const tbRead = (rel) => { const p = path.join(TB_DIR, rel); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; };
    const skill = tbRead('SKILL.md');
    ok(skill !== '', 'engineering-task-breakdown: có SKILL.md');
    ok(/^order: 7$/m.test(skill) && /^runsIn: plan$/m.test(skill) && /^invoke: per-request$/m.test(skill),
      'engineering-task-breakdown: frontmatter order 7, runsIn plan, invoke per-request');
    for (const f of ['analysis.md', 'task-template-common.md', 'task-template-backend.md', 'task-template-frontend.md',
      'sizing.md', 'output-formats.md', 'breakdown-checklist.md']) {
      ok(skill.includes(`(references/${f})`), `engineering-task-breakdown: SKILL.md link tới references/${f}`);
    }
    ok(skill.includes('CT → DB → BE → FE-UI → FE-INT → E2E'), 'engineering-task-breakdown: SKILL.md nêu chuỗi lát dọc đủ 6 loại');
    ok(skill.includes('Checkpoint 1') && skill.includes('Checkpoint 2'), 'engineering-task-breakdown: có 2 checkpoint teamlead duyệt');
    ok(skill.includes('engineering-spec-writing') && skill.includes('ngưỡng mơ hồ'),
      'engineering-task-breakdown: input mơ hồ → chuyển engineering-spec-writing');
    ok(skill.includes('Thiếu `project-knowledge/`') && skill.includes('[giả định]'),
      'engineering-task-breakdown: thiếu project-knowledge vẫn chạy, đánh dấu [giả định]');
    const analysis = tbRead('references/analysis.md');
    ok(analysis.includes('Ngưỡng mơ hồ') && analysis.includes('mâu thuẫn') && analysis.includes('| ID | Tên | Actor |'),
      'engineering-task-breakdown: analysis có ngưỡng mơ hồ, xử lý nguồn mâu thuẫn, bảng Use case');
    const sizing = tbRead('references/sizing.md');
    ok(['| S |', '| M |', '| L |'].every((s) => sizing.includes(s)) && sizing.includes('Buộc tách'),
      'engineering-task-breakdown: sizing có S/M/L và quy tắc buộc tách L');
    const checklist = tbRead('references/breakdown-checklist.md');
    ok(checklist.includes('vòng phụ thuộc') && checklist.includes('N/A — <lý do>') && checklist.includes('size `L`'),
      'engineering-task-breakdown: checklist kiểm vòng phụ thuộc, mục N/A, task L');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 29b. SOURCE: engineering-task-breakdown — template task common/backend/frontend (spec 2026-10-07 §3)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const TB_REF = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-task-breakdown', 'references');
    const tbRef = (f) => { const p = path.join(TB_REF, f); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; };
    const common = tbRef('task-template-common.md');
    ok(['CT', 'DB', 'BE', 'FE-UI', 'FE-INT', 'E2E'].every((t) => common.includes(`| \`${t}\` |`)),
      'engineering-task-breakdown: template common có bảng đủ 6 loại task');
    ok(['Use case', 'Loại', 'Size', 'Phụ thuộc', 'Owner', 'Trạng thái', 'Skill gợi ý', 'Nguồn'].every((h) => common.includes(`| ${h} |`))
      && ['**Ngữ cảnh:**', '**Acceptance criteria:**', '**File dự kiến:**', '**Lệnh verify:**', '**DoD:**'].every((h) => common.includes(h)),
      'engineering-task-breakdown: template common có đủ header chung');
    ok(common.includes('N/A — <lý do>') && common.includes('[giả định]'),
      'engineering-task-breakdown: template common có quy tắc N/A và [giả định]');
    ok(common.includes('Chỉ sinh loại cần') && common.includes('không sinh `CT`, `BE`, `FE-INT`')
      && common.includes('không sinh `FE-UI`, `FE-INT`, `E2E`'),
      'engineering-task-breakdown: use case không có API / chỉ backend thì không sinh loại task thừa');
    ok(['### CT', '### DB', '### E2E'].every((h) => common.includes(h)), 'engineering-task-breakdown: có template CT/DB/E2E');
    const be = tbRef('task-template-backend.md');
    ok(Array.from({ length: 10 }, (_, i) => `### B${i + 1}. `).every((h) => be.includes(h))
      && Array.from({ length: 10 }, (_, i) => `**B${i + 1}. `).every((h) => be.includes(h)),
      'engineering-task-breakdown: template backend có đủ B1–B10 (hướng dẫn + template chép được)');
    const fe = tbRef('task-template-frontend.md');
    ok(Array.from({ length: 9 }, (_, i) => `### F${i + 1}. `).every((h) => fe.includes(h))
      && Array.from({ length: 9 }, (_, i) => `**F${i + 1}. `).every((h) => fe.includes(h)),
      'engineering-task-breakdown: template frontend có đủ F1–F9 (hướng dẫn + template chép được)');
    ok(fe.includes('đồng bộ với B4') && fe.includes('msw'), 'engineering-task-breakdown: FE đồng bộ validation với BE, mock API bằng msw');
    ok(![common, be, fe].some((t) => /\bTODO\b|\bTBD\b/.test(t)), 'engineering-task-breakdown: template không còn TODO/TBD');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 29c. SOURCE: engineering-task-breakdown — định dạng đầu ra (spec 2026-10-07 §5)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const p = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-task-breakdown', 'references', 'output-formats.md');
    const out = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    ok(out.includes('nguồn sự thật') && out.includes('docs/requests/<yyyy-mm-dd>-<slug>/'),
      'engineering-task-breakdown: tasks.md là nguồn sự thật, đặt trong docs/requests/<ngày>-<slug>/');
    ok(['`Tasks`', '`UseCases`', '`OpenQuestions`'].every((s) => out.includes(s)), 'engineering-task-breakdown: Excel có 3 sheet');
    ok(out.includes('UTF-8 có BOM') && out.includes('utf-8-sig') && out.includes('QUOTE_ALL'),
      'engineering-task-breakdown: CSV UTF-8 có BOM, quote mọi ô');
    ok(out.includes('openpyxl') && out.includes('fallback'), 'engineering-task-breakdown: xlsx khi có openpyxl, không có thì fallback CSV');
    ok(out.includes('tasks.md#uc01-be-01') && out.includes('<a id="uc01-ct-01"></a>'),
      'engineering-task-breakdown: link chi tiết Excel trỏ anchor ổn định trong tasks.md');
    ok(out.includes('đã tồn tại') && out.includes('Owner'), 'engineering-task-breakdown: tasks.md đã tồn tại → hỏi, giữ Owner/Trạng thái');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 29d. SOURCE: engineering-task-breakdown — tích hợp manifest/cowork/README/spec-writing (spec 2026-10-07 §6.2)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const read29 = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    const mf = JSON.parse(read29('plugins/engineering/.manifest.json'));
    ok(mf.description.includes('7 skill') && mf.description.includes('engineering-task-breakdown') && /^\d+\.\d+\.\d+$/.test(mf.version),
      'engineering manifest: 7 skill, có engineering-task-breakdown, version semver');
    ok(JSON.parse(read29('plugins/_cowork.json')).skills.includes('engineering:engineering-task-breakdown'),
      '_cowork.json: có engineering:engineering-task-breakdown');
    for (const f of ['README.md', 'README_VI.md']) {
      const t = read29(f);
      ok(/^\| `engineering` \|.*engineering-task-breakdown/m.test(t), `${f}: dòng plugin engineering nêu engineering-task-breakdown`);
      ok(!/^\| G9 \|/m.test(t), `${f}: Roadmap không còn gap G9 (đã lấp)`);
    }
    ok(read29('plugins/engineering/skills/engineering-spec-writing/SKILL.md').includes('→ `engineering-task-breakdown`'),
      'engineering-spec-writing: trỏ phần phân rã task sang engineering-task-breakdown');
  }
}
