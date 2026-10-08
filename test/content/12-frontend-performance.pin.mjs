// Pin nội dung: frontend-performance.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, PLUGINS_DIR, parseSteps, offeredCatalog, frontmatter, core, workflows, wfText } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 23. SOURCE: frontend-performance skill + agent + workflow-performance Bước 2/3/5 phía FE (spec 2026-10-01-frontend-performance-design)
  {
    const flat23 = (t) => t.replace(/\s+/g, ' ');
    const wf23 = (id) => workflows.stages.find((s) => s.id === id);
    const step23 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { title: '', body: '', checkpoint: false };
    // Cắt đúng một trường cột 0 để assert không khớp nhầm chữ của trường khác trong cùng bước.
    const field23 = (body, name) => {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const lines = body.split('\n');
      const i = lines.findIndex((l) => new RegExp(`^- \\*\\*${esc}:\\*\\*`).test(l));
      if (i < 0) return '';
      let j = lines.findIndex((l, k) => k > i && /^- \*\*/.test(l));
      if (j < 0) j = lines.length;
      return flat23(lines.slice(i, j).join('\n'));
    };
    const feDir23 = path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-performance');
    const feSkill23 = fs.existsSync(path.join(feDir23, 'SKILL.md')) ? fs.readFileSync(path.join(feDir23, 'SKILL.md'), 'utf8') : '';
    ok(feSkill23.length > 0, 'frontend-performance: có SKILL.md');
    ok(/^order: 10$/m.test(feSkill23) && /^runsIn: execute$/m.test(feSkill23),
      'frontend-performance: frontmatter order 10, runsIn execute');
    ok(/^description: .*frontend-fix/m.test(feSkill23) && /^description: .*frontend-testing/m.test(feSkill23)
      && /^description: .*frontend-e2e-testing/m.test(feSkill23),
      'frontend-performance: description nêu ranh giới với frontend-fix, frontend-testing, frontend-e2e-testing');
    for (const g of ['P1', 'P2', 'P3', 'P4', 'P5']) ok(new RegExp(`^\\| ${g} `, 'm').test(feSkill23), `frontend-performance: bảng gate có ${g}`);
    ok(feSkill23.includes('`measure`') && feSkill23.includes('`profile`'), 'frontend-performance: có 2 chế độ measure / profile');
    ok(/^\| P3 [^\n]*10%/m.test(feSkill23), 'frontend-performance: P3 có ngưỡng độ lệch mặc định 10%');
    ok(/^\| P1 [^\n]*staging\/production/m.test(feSkill23) && flat23(feSkill23).includes('not_run'),
      'frontend-performance: P1 từ chối staging/production, thiếu môi trường → not_run');
    ok(/^\| P1 [^\n]*(bên thứ ba|dịch vụ đo)/m.test(feSkill23),
      'frontend-performance: P1 cấm gửi URL cho dịch vụ đo của bên thứ ba');
    ok(/≥\s?3/.test(feSkill23) && feSkill23.includes('`perf/`') && feSkill23.includes('`bench/`'),
      'frontend-performance: đo ≥3 lần, script ở perf/ và bench/');
    ok(feSkill23.includes('dev server') && feSkill23.includes('bản build production'),
      'frontend-performance: đo trên bản build production, cấm dev server');
    ok(feSkill23.includes('INP') && feSkill23.includes('TBT') && /lab/i.test(feSkill23),
      'frontend-performance: nêu Lighthouse là số lab, INP không đo được, TBT thay thế');
    ok(/^\| P5 [^\n]*`src\/`/m.test(feSkill23) && /^\| P5 [^\n]*blocked/m.test(feSkill23),
      'frontend-performance: P5 cấm sửa src/, chạy như subagent → trả blocked');
    ok(feSkill23.includes('`frontend-fix`'), 'frontend-performance: ranh giới nêu frontend-fix');
    const feRefs23 = ['measure-conditions', 'serve-production-build', 'lighthouse-cli', 'bundle-analysis', 'profiling-react', 'chrome-trace'];
    const feRef23 = (n) => { const f = path.join(feDir23, 'references', `${n}.md`); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; };
    for (const n of feRefs23) {
      ok(feRef23(n).length > 200, `frontend-performance references/${n}.md: có nội dung`);
      ok(feSkill23.includes(`(references/${n}.md)`), `frontend-performance: SKILL.md link tới references/${n}.md`);
      ok(feRef23(n).includes('[Unverified]'), `frontend-performance references/${n}.md: lệnh/cờ chưa kiểm gắn [Unverified]`);
    }
    const fmc23 = feRef23('measure-conditions');
    ok(/\| *Route/.test(fmc23) && /\| *Build/.test(fmc23) && fmc23.includes('Config tool đo') && fmc23.includes('10%')
      && /\| *Cache/.test(fmc23) && /throttl/i.test(fmc23) && fmc23.includes('Phục vụ bản build'),
      'measure-conditions.md (FE): bảng điều kiện có Route, Build, Phục vụ bản build, Cache, throttle, Config tool đo, ngưỡng 10%');
    ok(/vite preview|next start/.test(feRef23('serve-production-build')) && feRef23('serve-production-build').includes('dev server')
      && feRef23('serve-production-build').includes('blocked'),
      'serve-production-build.md: lệnh phục vụ bản build (vite preview / next start), cấm dev server, project không có lệnh → blocked');
    ok(/lighthouse/i.test(feRef23('lighthouse-cli')) && feRef23('lighthouse-cli').includes('--output=json')
      && feRef23('lighthouse-cli').includes('localhost') && !/https?:\/\/(?!localhost|127\.0\.0\.1)[a-z]/i.test(feRef23('lighthouse-cli'))
      && feRef23('lighthouse-cli').includes('INP'),
      'lighthouse-cli.md: lệnh Lighthouse CLI trỏ localhost, xuất JSON, không URL ngoài, nêu INP không đo trong lab');
    ok(/bundle/i.test(feRef23('bundle-analysis')) && /(source-map-explorer|visualizer|webpack-bundle-analyzer)/.test(feRef23('bundle-analysis'))
      && /code-splitting|dynamic import/i.test(feRef23('bundle-analysis')),
      'bundle-analysis.md: có bundle analyzer và code-splitting');
    ok(/Profiler/.test(feRef23('profiling-react')) && /(profiling build|build profiling)/i.test(feRef23('profiling-react'))
      && /commit/i.test(feRef23('profiling-react')),
      'profiling-react.md: React Profiler, cần build profiling, commit thừa');
    ok(/long task/i.test(feRef23('chrome-trace')) && /trace/i.test(feRef23('chrome-trace')) && feRef23('chrome-trace').includes('Bước 3'),
      'chrome-trace.md: long task, xuất trace, ghi lệnh vào report Bước 3');
    ok(!/https?:\/\/(?!localhost|127\.0\.0\.1)[a-z]/i.test(feRefs23.map(feRef23).join('\n').replace(/https?:\/\/(?:github\.com|developer\.chrome\.com|web\.dev|react\.dev)[^\s)]*/g, '')),
      'frontend-performance references: không URL host ngoài (trừ link tài liệu chính thức)');

    const pub23 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_published.json'), 'utf8')).published;
    ok(pub23.includes('frontend/frontend-performance'), '_published.json: có frontend/frontend-performance (publish trước khi nối workflow)');
    const cowork23 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_cowork.json'), 'utf8')).skills;
    ok(cowork23.includes('frontend:frontend-performance'), '_cowork.json: có frontend:frontend-performance');
    const feMan23 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', '.manifest.json'), 'utf8'));
    ok(/^\d+\.\d+\.\d+$/.test(feMan23.version) && feMan23.description.includes('frontend-performance'),
      'frontend manifest: version semver, description nêu frontend-performance');
    const offFe23 = offeredCatalog().plugins.find((p) => p.id === 'frontend');
    ok(!!offFe23 && offFe23.skillIds.includes('frontend/frontend-performance') && offFe23.skillIds.length === 10,
      'offeredCatalog: plugin frontend offer 10 skill gồm frontend-performance');

    const fpaPath = path.join(PLUGINS_DIR, 'frontend', 'agents', 'frontend-performance-analyst.md');
    const fpa = fs.existsSync(fpaPath) ? fs.readFileSync(fpaPath, 'utf8') : '';
    ok(fpa.length > 0, 'frontend-performance-analyst: có agent file');
    ok(/^mode: write$/m.test(fpa) && /^skills: "frontend-performance"$/m.test(fpa),
      'frontend-performance-analyst: mode write, skills = frontend-performance (đúng 1 skill)');
    const fpaScope = flat23(fpa.split('## Phạm vi')[1]?.split('## Quy trình')[0] ?? '');
    ok(fpaScope.includes('`perf/`') && fpaScope.includes('`bench/`') && fpaScope.includes('`src/`')
      && fpaScope.includes('dev server') && fpaScope.includes('staging/production'),
      'frontend-performance-analyst: Phạm vi ghi perf/ bench/, cấm sửa src/, cấm dev server, cấm staging/production');
    ok(fpaScope.includes('blocked') && fpaScope.includes('questions') && fpaScope.includes('not_run'),
      'frontend-performance-analyst: cần quyết định → blocked + questions; thiếu môi trường → not_run');
    ok(fpa.includes('core:principles') && fpa.includes('git diff --name-only'),
      'frontend-performance-analyst: report theo core:principles, tự đối chiếu diff');
    ok(fpa.includes('INP') && /^description: .*(LCP|TBT)/m.test(fpa),
      'frontend-performance-analyst: nêu lab không phải INP; description nêu LCP/TBT');

    const pf23 = wf23('workflow-performance');
    for (const [n, mode] of [[2, 'measure'], [3, 'profile'], [5, 'measure']]) {
      const s = step23(pf23, n);
      const th = field23(s.body, 'Thực hiện');
      ok(th.includes('agent `backend-performance-analyst`') && th.includes('agent `frontend-performance-analyst`') && th.includes(`\`${mode}\``),
        `workflow-performance Bước ${n}: Thực hiện có cả hai analyst (BE ∥ FE) chế độ ${mode}`);
      ok(!flat23(s.body).includes('Phía FE: chưa có skill'), `workflow-performance Bước ${n}: không còn câu chờ phía FE`);
      ok(field23(s.body, 'Khi fail').includes('blocked') && field23(s.body, 'Khi fail').includes('câu hỏi'),
        `workflow-performance Bước ${n}: Khi fail — analyst trả blocked + câu hỏi → session chính hỏi người dùng`);
    }
    ok(!flat23(pf23?.body ?? '').includes('Phía FE: chưa có skill'), 'workflow-performance: body không còn "Phía FE: chưa có skill"');
    const fS2 = step23(pf23, 2), fS3 = step23(pf23, 3), fS5 = step23(pf23, 5);
    ok(field23(fS2.body, 'Evidence').includes('hash-object') && /từng phía|BE và FE|cả hai phía/.test(field23(fS2.body, 'Evidence')),
      'workflow-performance Bước 2: Evidence ghi git hash-object script + bảng điều kiện của TỪNG phía');
    ok(field23(fS2.body, 'Hành động').includes('perf/frontend/') && field23(fS2.body, 'Hành động').includes('perf/backend/'),
      'workflow-performance Bước 2: hai phía dùng thư mục con riêng perf/backend/ và perf/frontend/');
    ok(field23(fS3.body, 'Gate').includes('mốc Bước 2') && /từng phía|BE và FE|cả hai phía/.test(field23(fS3.body, 'Gate')),
      'workflow-performance Bước 3: Gate so hash của từng phía với mốc Bước 2');
    ok(field23(fS5.body, 'Gate').includes('mốc Bước 2') && /từng phía/.test(field23(fS5.body, 'Gate')),
      'workflow-performance Bước 5: Gate hash từng phía bằng mốc Bước 2, kết luận đạt/không đạt theo từng phía');
    ok(flat23(wfText('performance')).includes('hash') && flat23(wfText('performance')).includes('chunk')
      && flat23(wfText('performance')).includes('bản build production'),
      'workflow-performance Bước 5: FE build lại bản production, xác nhận bản mới (hash file build / tên chunk khác baseline)');
    ok(field23(fS5.body, 'Ràng buộc').includes('dev server') && field23(fS2.body, 'Ràng buộc').includes('dev server'),
      'workflow-performance: Ràng buộc FE cấm đo trên dev server ở CẢ Bước 2 và Bước 5');
    ok(flat23(wfText('performance')).includes('dist-profile'),
      'workflow-performance Bước 3: output build profile (dist-profile/) xoá sau khi profile hoặc .gitignore, nếu không thì blocked');
    ok(field23(fS3.body, 'Gate').includes('assets-baseline.txt') && field23(fS5.body, 'Gate').includes('assets-baseline.txt')
      && field23(fS5.body, 'Evidence').includes('assets-baseline.txt'),
      'workflow-performance Bước 3 và 5: hash assets-baseline.txt (FE) nằm trong Gate/Evidence');
    ok(field23(fS2.body, 'Evidence').includes('giá trị hash') && field23(fS2.body, 'Evidence').includes('không có thẩm quyền'),
      'workflow-performance Bước 2: session chính ghi GIÁ TRỊ hash vào Evidence; file hashes chỉ là bản sao tiện lợi, không có thẩm quyền');
    for (const [n, s] of [[2, fS2], [3, fS3], [5, fS5]]) {
      ok(field23(s.body, 'Gate').includes('hợp của hai bảng'),
        `workflow-performance Bước ${n}: Gate session chính đối chiếu diff với HỢP của hai bảng Config tool đo (BE và FE)`);
    }
    ok(field23(fS2.body, 'Hành động').includes('phía kia') && field23(fS2.body, 'Khi fail').includes('phía kia'),
      'workflow-performance Bước 2: agent chỉ tự đối chiếu phía mình, không revert file của phía kia');
    ok(field23(fS2.body, 'Khi fail').includes('đo lại từng phía tuần tự') && field23(fS5.body, 'Khi fail').includes('đo lại từng phía tuần tự'),
      'workflow-performance Bước 2 và 5: nhiễu do hai pha đo chồng nhau trên cùng máy → đo lại từng phía tuần tự');
    ok(step23(pf23, 3).checkpoint && step23(pf23, 7).checkpoint && parseSteps(pf23?.body ?? '').length === 7,
      'workflow-performance: vẫn 7 bước, ⏸ ở Bước 3 và 7');
    ok(pf23 && ['backend-performance-analyst', 'frontend-performance-analyst', 'backend-fixer', 'frontend-fixer', 'backend-reviewer', 'frontend-reviewer']
      .every((a) => pf23.agents.includes(a)),
      'workflow-performance: frontmatter agents có frontend-performance-analyst');
    const pfErr23 = flat23(wfText('performance'));
    ok(pfErr23.includes('Chrome') && pfErr23.includes('not_run'),
      'workflow-performance: bảng lỗi có hàng bản build FE không dựng được / không có Chrome (not_run → blocked)');
    ok(flat23(pf23?.body.split('## Điều kiện tiên quyết')[1]?.split('## Các bước')[0] ?? '').includes('frontend-performance-analyst'),
      'workflow-performance: điều kiện tiên quyết liệt kê frontend-performance-analyst');
    ok((offeredCatalog().plugins.find((p) => p.id === 'workflows')?.skillIds ?? []).includes('workflows/workflow-performance'),
      'offeredCatalog: vẫn offer workflows/workflow-performance (closure frontend-performance đã publish)');
    const bpaFlow23 = flat23(fs.readFileSync(path.join(PLUGINS_DIR, 'backend', 'agents', 'backend-performance-analyst.md'), 'utf8')
      .split('## Quy trình')[1]?.split('## Report trả về')[0] ?? '');
    ok(bpaFlow23.includes('perf/backend/'), 'backend-performance-analyst: Quy trình ghi artifact vào perf/backend/ khi workflow có cả hai phía');
    for (const [f, head] of [['README.md', '### Agents (18)'], ['README_VI.md', '### Agent (18)']]) {
      const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
      const row = (a) => rd.split('\n').find((l) => l.startsWith(`| \`${a}\` |`)) ?? '';
      ok(rd.split('\n').some((l) => l.trim() === head), `${f}: heading ${head}`);
      ok(row('frontend-performance-analyst').includes('WF09') && row('frontend-performance-analyst').includes('frontend-performance'),
        `${f}: bảng agent có frontend-performance-analyst dùng ở WF09`);
      ok((rd.split('\n').find((l) => l.startsWith('| WF09 |')) ?? '').includes('frontend-performance-analyst'),
        `${f}: WF09 liệt kê frontend-performance-analyst`);
    }
    ok(flat23(fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8')).includes('`frontend` (10 skills published'),
      'CLAUDE.md: frontend 10 skill published (gồm frontend-performance)');
    ok(flat23(fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8')).includes('`frontend-performance`'),
      'CLAUDE.md: nêu frontend-performance');
  }
}
