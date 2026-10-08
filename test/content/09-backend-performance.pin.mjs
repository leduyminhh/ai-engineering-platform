// Pin nội dung: backend-performance.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, PLUGINS_DIR, parseSteps, offeredCatalog, frontmatter, core, workflows, wfText } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 20. SOURCE: backend-performance skill + agent + workflow-performance Bước 2/3/5 (spec 2026-09-30-backend-performance-design)
  {
    const flat20 = (t) => t.replace(/\s+/g, ' ');
    const wf20 = (id) => workflows.stages.find((s) => s.id === id);
    const step20 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { title: '', body: '', checkpoint: false };
    // Cắt đúng một trường cột 0 để assert không khớp nhầm chữ của trường khác trong cùng bước.
    const field20 = (body, name) => {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const lines = body.split('\n');
      const i = lines.findIndex((l) => new RegExp(`^- \\*\\*${esc}:\\*\\*`).test(l));
      if (i < 0) return '';
      let j = lines.findIndex((l, k) => k > i && /^- \*\*/.test(l));
      if (j < 0) j = lines.length;
      return flat20(lines.slice(i, j).join('\n'));
    };
    const perfDir = path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-performance');
    const perfSkill = fs.existsSync(path.join(perfDir, 'SKILL.md')) ? fs.readFileSync(path.join(perfDir, 'SKILL.md'), 'utf8') : '';
    ok(perfSkill.length > 0, 'backend-performance: có SKILL.md');
    ok(/^order: 10$/m.test(perfSkill) && /^runsIn: execute$/m.test(perfSkill),
      'backend-performance: frontmatter order 10, runsIn execute');
    ok(/^description: .*backend-fix/m.test(perfSkill) && /^description: .*backend-testing/m.test(perfSkill),
      'backend-performance: description nêu ranh giới với backend-fix và backend-testing');
    for (const g of ['P1', 'P2', 'P3', 'P4', 'P5']) ok(new RegExp(`^\\| ${g} `, 'm').test(perfSkill), `backend-performance: bảng gate có ${g}`);
    ok(perfSkill.includes('`measure`') && perfSkill.includes('`profile`'), 'backend-performance: có 2 chế độ measure / profile');
    ok(/^\| P3 [^\n]*10%/m.test(perfSkill), 'backend-performance: P3 có ngưỡng độ lệch mặc định 10%');
    ok(/^\| P1 [^\n]*staging\/production/m.test(perfSkill) && flat20(perfSkill).includes('not_run'),
      'backend-performance: P1 từ chối staging/production, thiếu môi trường → not_run');
    ok(/≥\s?3/.test(perfSkill) && perfSkill.includes('`perf/`') && perfSkill.includes('`bench/`'),
      'backend-performance: đo ≥3 lần, script ở perf/ và bench/');
    ok(/^\| P5 [^\n]*`src\/`/m.test(perfSkill), 'backend-performance: P5 cấm sửa src/ production');
    const perfRefs = ['measure-conditions', 'k6', 'jmh-pytest-benchmark', 'profiling-java', 'profiling-python', 'db-query-analysis'];
    const perfRef = (n) => { const f = path.join(perfDir, 'references', `${n}.md`); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; };
    for (const n of perfRefs) {
      ok(perfRef(n).length > 200, `backend-performance references/${n}.md: có nội dung`);
      ok(perfSkill.includes(`(references/${n}.md)`), `backend-performance: SKILL.md link tới references/${n}.md`);
    }
    ok(/\| *Môi trường *\|/.test(perfRef('measure-conditions')) && /warm-up/i.test(perfRef('measure-conditions')) && perfRef('measure-conditions').includes('10%'),
      'measure-conditions.md: bảng điều kiện đo có Môi trường, warm-up, ngưỡng 10%');
    ok(perfRef('k6').includes('__ENV.BASE_URL') && !/https?:\/\/(?!localhost|127\.0\.0\.1)[a-z]/i.test(perfRef('k6')),
      'k6.md: script mẫu lấy BASE_URL từ biến môi trường, không trỏ host ngoài localhost');
    ok(perfRef('jmh-pytest-benchmark').includes('@Benchmark') && perfRef('jmh-pytest-benchmark').includes('benchmark('),
      'jmh-pytest-benchmark.md: có ví dụ JMH @Benchmark và pytest-benchmark');
    ok(/JFR|jcmd/.test(perfRef('profiling-java')) && /async-profiler/.test(perfRef('profiling-java')),
      'profiling-java.md: có JFR và async-profiler');
    ok(/py-spy/.test(perfRef('profiling-python')) && /cProfile/.test(perfRef('profiling-python')),
      'profiling-python.md: có py-spy và cProfile');
    ok(/EXPLAIN ANALYZE/.test(perfRef('db-query-analysis')) && /N\+1/.test(perfRef('db-query-analysis')),
      'db-query-analysis.md: có EXPLAIN ANALYZE và N+1');
    ok(perfRefs.every((n) => perfRef(n).includes('[Unverified]') || !/`[a-z0-9-]+ [^`]*--/.test(perfRef(n))),
      'backend-performance references: lệnh có cờ công cụ phải gắn [Unverified] trong file');
    const pub20 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_published.json'), 'utf8')).published;
    ok(pub20.includes('backend/backend-performance'), '_published.json: có backend/backend-performance (publish trước khi nối workflow)');
    const cowork20 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_cowork.json'), 'utf8')).skills;
    ok(cowork20.includes('backend:backend-performance'), '_cowork.json: có backend:backend-performance');
    const beMan20 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, 'backend', '.manifest.json'), 'utf8'));
    ok(/^\d+\.\d+\.\d+$/.test(beMan20.version), 'backend manifest: version semver');
    const paPath = path.join(PLUGINS_DIR, 'backend', 'agents', 'backend-performance-analyst.md');
    const pa = fs.existsSync(paPath) ? fs.readFileSync(paPath, 'utf8') : '';
    ok(pa.length > 0, 'backend-performance-analyst: có agent file');
    ok(/^mode: write$/m.test(pa) && /^skills: "backend-performance"$/m.test(pa),
      'backend-performance-analyst: mode write, skills = backend-performance (đúng 1 skill)');
    const paScope = flat20(pa.split('## Phạm vi')[1]?.split('## Quy trình')[0] ?? '');
    ok(paScope.includes('`perf/`') && paScope.includes('`bench/`') && paScope.includes('`src/`') && paScope.includes('staging/production'),
      'backend-performance-analyst: Phạm vi chỉ ghi perf/ bench/, cấm sửa src/, cấm staging/production');
    ok(paScope.includes('not_run'), 'backend-performance-analyst: thiếu môi trường → not_run');
    ok(pa.includes('core:principles') && pa.includes('git diff --name-only'),
      'backend-performance-analyst: report theo core:principles, tự đối chiếu diff');
    const perfWf = wf20('workflow-performance');
    const pS1 = step20(perfWf, 1), pS2 = step20(perfWf, 2), pS3 = step20(perfWf, 3), pS5 = step20(perfWf, 5);
    for (const [n, s, mode] of [[2, pS2, 'measure'], [3, pS3, 'profile'], [5, pS5, 'measure']]) {
      ok(field20(s.body, 'Thực hiện').includes('agent `backend-performance-analyst`') && field20(s.body, 'Thực hiện').includes(`\`${mode}\``),
        `workflow-performance Bước ${n}: Thực hiện là backend-performance-analyst chế độ ${mode}`);
    }
    ok(field20(pS1.body, 'Đầu ra').includes('điều kiện đo'), 'workflow-performance Bước 1: Đầu ra có điều kiện đo sơ bộ');
    for (const [n, s] of [[2, pS2], [3, pS3]]) {
      const gate20 = field20(s.body, 'Gate');
      ok(gate20.includes('`perf/`') && gate20.includes('`bench/`') && gate20.includes('git diff --name-only')
        && gate20.includes('git ls-files --others'),
        `workflow-performance Bước ${n}: Gate so diff chỉ perf/ bench/ config tool đo`);
    }
    ok(field20(pS2.body, 'Khi fail').includes('blocked'), 'workflow-performance Bước 2: thiếu môi trường → dừng blocked');
    ok(field20(pS5.body, 'Đầu vào').includes('Bước 2') && field20(pS5.body, 'Ràng buộc').includes('không đổi điều kiện đo'),
      'workflow-performance Bước 5: dùng lại script + bảng điều kiện Bước 2, không đổi điều kiện');
    ok(field20(pS5.body, 'Gate').includes('nhiễu'), 'workflow-performance Bước 5: nhiễu vượt P3 → không kết luận');
    ok(pS3.checkpoint, 'workflow-performance Bước 3: giữ ⏸');
    ok(perfWf && perfWf.agents.includes('backend-performance-analyst'), 'workflow-performance: frontmatter agents có backend-performance-analyst');
    ok(parseSteps(perfWf?.body ?? '').length === 7, 'workflow-performance: vẫn 7 bước');
    ok((offeredCatalog().plugins.find((p) => p.id === 'workflows')?.skillIds ?? []).includes('workflows/workflow-performance'),
      'offeredCatalog: vẫn offer workflows/workflow-performance (closure analyst đã publish)');
    const perfErr = flat20(wfText('performance'));
    ok(perfErr.includes('Môi trường đo thiếu') && perfErr.includes('lệch Bước 2') && perfErr.includes('Nhiễu vượt'),
      'workflow-performance: bảng lỗi có 3 hàng môi trường thiếu / điều kiện lệch / nhiễu');
    for (const f of ['README.md', 'README_VI.md']) {
      const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
      const row = (a) => rd.split('\n').find((l) => l.startsWith(`| \`${a}\` |`)) ?? '';
      ok(row('backend-performance-analyst').includes('WF09'), `${f}: bảng agent có backend-performance-analyst dùng ở WF09`);
      ok((rd.split('\n').find((l) => l.startsWith('| WF09 |')) ?? '').includes('backend-performance-analyst'), `${f}: WF09 liệt kê backend-performance-analyst`);
      ok(!/^\| G10 \|/m.test(rd), `${f}: bảng Skill gaps bỏ G10`);
    }
    const paFlow = flat20(pa.split('## Quy trình')[1]?.split('## Report trả về')[0] ?? '');
    ok(pa.includes('blocked') && pa.includes('questions'), 'backend-performance-analyst: cần quyết định người dùng → trả blocked + questions[]');
    ok(paFlow.includes('Score') && paFlow.includes('median'), 'backend-performance-analyst: Quy trình ghi thống kê chính theo P3 (Score JMH, median pytest-benchmark)');
    ok(/^\| P5 [^\n]*blocked/m.test(perfSkill), 'backend-performance: P5 chạy như subagent → trả blocked');
    const perfMeasure = flat20(perfSkill.split('### `measure`')[1]?.split('### `profile`')[0] ?? '');
    ok(perfMeasure.includes('không ramp') && !/(?<!không )ramp/.test(perfMeasure),
      'backend-performance: measure dùng tải hằng định, không ramp (warm-up chạy riêng)');
    ok(perfRef('measure-conditions').includes('Config tool đo') && perfRef('measure-conditions').includes('Khởi chạy ứng dụng'),
      'measure-conditions.md: bảng điều kiện có hàng Config tool đo và Khởi chạy ứng dụng');
    const dbq20 = flat20(perfRef('db-query-analysis'));
    ok(dbq20.includes('không sửa') && dbq20.includes('`src/`') && /pg_stat_statements|log_statement/.test(dbq20) && dbq20.includes('blocked'),
      'db-query-analysis.md: đếm query bật lúc khởi chạy, không sửa src/, có cách đếm phía DB, bí → blocked');
    ok(field20(pS5.body, 'Gate').includes('hash-object'), 'workflow-performance Bước 5: Gate so git hash-object script + bảng điều kiện Bước 2');
    ok(field20(pS5.body, 'Hành động').includes('tiến trình mới'), 'workflow-performance Bước 5: khởi chạy lại ứng dụng, xác nhận tiến trình mới trước warm-up');
    for (const [n, s] of [[2, pS2], [3, pS3], [5, pS5]]) {
      ok(field20(s.body, 'Khi fail').includes('blocked') && field20(s.body, 'Khi fail').includes('câu hỏi'),
        `workflow-performance Bước ${n}: Khi fail — agent trả blocked + câu hỏi → session chính hỏi người dùng`);
    }
    ok(field20(pS3.body, 'Đầu vào').includes('script'), 'workflow-performance Bước 3: Đầu vào có bảng điều kiện + script Bước 2');
    const pf2 = step20(wf20('workflow-performance'), 2), pf3 = step20(wf20('workflow-performance'), 3), pf5 = step20(wf20('workflow-performance'), 5);
    ok(field20(pf2.body, 'Evidence').includes('hash-object'), 'workflow-performance Bước 2: Evidence ghi mốc git hash-object của script + bảng điều kiện');
    ok(field20(pf5.body, 'Gate').includes('mốc Bước 2'), 'workflow-performance Bước 5: Gate so hash với mốc Bước 2');
    ok(field20(pf3.body, 'Gate').includes('mốc Bước 2'),
      'workflow-performance Bước 3: Gate so git hash-object script + bảng điều kiện với mốc Bước 2');
    ok(field20(pf3.body, 'Hành động').includes('git hash-object') && field20(pf3.body, 'Evidence').includes('mốc Bước 2'),
      'workflow-performance Bước 3: Hành động đọc mốc hash-object, Evidence ghi hash hiện tại so với mốc Bước 2');
    ok(/^description: .*Score/m.test(pa), 'backend-performance-analyst: description nêu thống kê chính theo P3 (Score JMH)');
    ok(field20(pf5.body, 'Khi fail').includes('report Bước 5') && field20(pf5.body, 'Khi fail').includes('quay lại Bước 2'),
      'workflow-performance Bước 5: blocked ghi quyết định vào report Bước 5; đổi điều kiện → quay lại Bước 2');
    ok(field20(pf3.body, 'Ràng buộc').includes('không sửa bảng điều kiện'), 'workflow-performance Bước 3: không sửa bảng điều kiện của Bước 2');
    ok(!flat20(perfRef('db-query-analysis')).includes('vào hàng Khởi chạy ứng dụng'),
      'db-query-analysis.md: profile không ghi lệnh khởi chạy vào bảng điều kiện Bước 2');
    ok(/^\| Khởi chạy ứng dụng \|[^|\n]*PID/m.test(perfRef('measure-conditions')), 'measure-conditions.md: hàng Khởi chạy ứng dụng ghi PID/thời điểm start Bước 2');
  }

  // Phase 2 Task 5: câu đã chuyển sang references/ chỉ đến được model qua dòng trỏ trong WORKFLOW.md.
  {
    ok((workflows.stages.find((s) => s.id === 'workflow-performance')?.body ?? '').includes('`references/error-matrix.md`'), 'workflow-performance: WORKFLOW.md vẫn trỏ tới references/error-matrix.md');
  }
}
