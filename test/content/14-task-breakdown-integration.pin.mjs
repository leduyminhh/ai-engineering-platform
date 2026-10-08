// Pin nội dung: tích hợp engineering-task-breakdown và check-tasks.mjs.
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, pathToFileURL, REPO_ROOT, PLUGINS_DIR, plugins } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 30a-1. SOURCE: skill code nhận task từ tasks.md (spec 2026-10-07 integration §2.1–§2.4)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const rd = (...p) => fs.readFileSync(path.join(PLUGINS_DIR, ...p), 'utf8');
    const intake = rd('backend', 'skills', 'backend-implement', 'references', 'use-case-intake.md');
    ok(/^## Nguồn D — task `BE` trong `tasks\.md`$/m.test(intake) && ['B1', 'B3', 'B6', 'B10'].every((b) => intake.includes(`| ${b} `)),
      'backend-implement: use-case-intake có Nguồn D map trường task BE');
    ok(rd('backend', 'skills', 'backend-implement', 'SKILL.md').includes('task `BE` trong `tasks.md`'),
      'backend-implement: bước 1 liệt kê task BE trong tasks.md là nguồn đầu vào');
    const feImpl = rd('frontend', 'skills', 'frontend-implement', 'SKILL.md');
    ok(feImpl.includes('**Nhận task `FE-UI` từ `tasks.md`**') && feImpl.includes('F6 là `N/A`'),
      'frontend-implement: nhận task FE-UI, F6 để cho task FE-INT');
    const feInt = rd('frontend', 'skills', 'frontend-data-integration', 'SKILL.md');
    ok(feInt.includes('**Nhận task `FE-INT` từ `tasks.md`**') && feInt.includes('bảng B7'),
      'frontend-data-integration: nhận task FE-INT, map lỗi theo bảng B7');
    for (const [name, t] of [['use-case-intake', intake], ['frontend-implement', feImpl], ['frontend-data-integration', feInt]]) {
      ok(/KHÔNG sửa\s+`tasks\.md`/.test(t) && t.includes('[giả định]'),
        `${name}: agent không sửa tasks.md, hỏi lại mục [giả định]`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 30a-2. SOURCE: workflow-feature + agent + principles nối engineering-task-breakdown (spec 2026-10-07 integration §2.5–§2.7)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const wf = fs.readFileSync(path.join(REPO_ROOT, 'workflows', 'feature', 'WORKFLOW.md'), 'utf8');
    const step = (n) => wf.split(/^### Bước /m).find((s) => s.startsWith(`${n} `)) || '';
    ok(step(2).includes('engineering-task-breakdown') && step(2).includes('`tasks.md`'),
      'workflow-feature: Bước 2 tuỳ chọn tách task bằng engineering-task-breakdown');
    ok(!wf.includes('không phân rã story/task chi tiết'), 'workflow-feature: bỏ câu cấm phân rã task');
    ok(step(4).includes('`tasks.md`') && step(4).includes('`FE-INT` → `frontend-data-integrator`'),
      'workflow-feature: Bước 4 giao implementer theo từng task');
    ok(/^### Bước 8 — Commit ⏸$/m.test(wf), 'workflow-feature: không đánh số lại bước');
    const ag = fs.readFileSync(path.join(PLUGINS_DIR, 'engineering', 'agents', 'engineering-spec-analyst.md'), 'utf8');
    ok(/^skills: "engineering-spec-writing,engineering-adr,engineering-diagram,engineering-task-breakdown"$/m.test(ag),
      'engineering-spec-analyst: skills có engineering-task-breakdown');
    ok(!ag.includes('phân rã story/task chi') && ag.includes('Checkpoint 2'),
      'engineering-spec-analyst: tách task khi được yêu cầu, dừng ở 2 checkpoint');
    const pr = fs.readFileSync(path.join(PLUGINS_DIR, 'engineering', 'shared', 'principles.md'), 'utf8');
    ok(['quality-gate', 'spec-writing', 'task-breakdown', 'diagram', 'adr', 'convention-enforce', 'release-notes']
      .every((s) => pr.includes(`\`${s}\``)), 'engineering principles: nêu đủ 7 skill');
    for (const f of ['README.md', 'README_VI.md']) {
      ok(/^\| `engineering-spec-analyst` \|.*engineering-task-breakdown/m.test(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')),
        `${f}: bảng agent nêu engineering-task-breakdown cho engineering-spec-analyst`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 30b. SOURCE: engineering-task-breakdown scripts/check-tasks.mjs (spec 2026-10-07 integration §3, §4.2)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const TB_SCRIPT = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-task-breakdown', 'scripts', 'check-tasks.mjs');
    const exists = fs.existsSync(TB_SCRIPT);
    ok(exists, 'check-tasks: có scripts/check-tasks.mjs');
    if (exists) {
      const tb = await import(pathToFileURL(TB_SCRIPT).href);
      const items = (p, n) => Array.from({ length: n }, (_, i) => `- **${p}${i + 1}. Mục:** x`).join('\n');
      const FX = [
        '# Tasks: Mẫu', '', '## 2. Use case', '',
        '| ID | Tên | Actor | Mục tiêu | AC | NFR | Nguồn |', '|---|---|---|---|---|---|---|',
        '| UC01 | Đăng ký | Khách | Tạo tài khoản | AC1.1 Given email mới When gửi Then tạo<br>AC1.2 Given email trùng When gửi Then báo lỗi | p95 ≤ 500 ms | requirement.md §1 |',
        '', '## 3. Bảng tổng task', '',
        '| ID | UC | Loại | Tiêu đề | Size | Phụ thuộc | Owner | Trạng thái | Skill gợi ý |', '|---|---|---|---|---|---|---|---|---|',
        '| [UC01-CT-01](#uc01-ct-01) | UC01 | CT | Chốt contract "đăng ký" | S | — |  | Todo | backend-api-contract |',
        '| [UC01-BE-01](#uc01-be-01) | UC01 | BE | Tạo tài khoản | M | UC01-CT-01 |  | Todo | backend-implement |',
        '| [UC01-FE-01](#uc01-fe-01) | UC01 | FE-UI | Dựng form | S | — |  | Todo | frontend-implement |',
        '| [UC01-FE-02](#uc01-fe-02) | UC01 | FE-INT | Nối form | S | UC01-CT-01, UC01-FE-01 |  | Todo | frontend-data-integration |',
        '', '## 5. Chi tiết task', '',
        '<a id="uc01-ct-01"></a>', '### UC01-CT-01 — Chốt contract "đăng ký"', '',
        '- [ ] AC1.1 — contract có POST /accounts', '- [ ] AC1.2 — contract có lỗi 409', '',
        '<a id="uc01-be-01"></a>', '### UC01-BE-01 — Tạo tài khoản', '',
        '- [ ] AC1.1 — tạo tài khoản', '- [ ] AC1.2 — email trùng trả 409', '', '#### Backend', '', items('B', 10), '',
        '<a id="uc01-fe-01"></a>', '', '### UC01-FE-01 — Dựng form', '',
        '- [x] AC1.1 — form hiển thị', '', '#### Frontend', '', items('F', 9), '',
        '<a id="uc01-fe-02"></a>', '### UC01-FE-02 — Nối form', '',
        '- [ ] AC1.2 — hiện lỗi 409', '', '#### Frontend', '', items('F', 9), '',
        '## 6. Câu hỏi mở & giả định', '',
      ].join('\n');
      const check = (text) => tb.checkTasks(tb.parseTasks(text));
      const codes = (text) => { const r = check(text); return [...r.errors, ...r.warnings].map((p) => p.code); };
      const r0 = check(FX);
      ok(r0.errors.length === 0 && r0.warnings.length === 0,
        `check-tasks: fixture hợp lệ → 0 lỗi, 0 cảnh báo (${[...r0.errors, ...r0.warnings].map((p) => p.code + ' ' + p.msg).join(' | ')})`);
      const cases = [
        ['E1', '| UC01 | BE | Tạo tài khoản |', '| UC01 | FE-UI | Tạo tài khoản |'],
        ['E2', '| [UC01-FE-02](#uc01-fe-02) |', '| [UC01-FE-01](#uc01-fe-01) |'],
        ['E3', '<a id="uc01-be-01"></a>', '<a id="uc01-be-1"></a>'],
        ['E4', '| M | UC01-CT-01 |', '| M | UC01-CT-09 |'],
        ['E5', '| S | — |  | Todo | backend-api-contract |', '| S | UC01-FE-02 |  | Todo | backend-api-contract |'],
        ['E6', '| M | UC01-CT-01 |', '| L | UC01-CT-01 |'],
        ['E7', '<br>AC1.2 Given', '<br>AC1.3 Given x<br>AC1.2 Given'],
        ['E8', '- [ ] AC1.2 — contract có lỗi 409', '- [ ] AC1.9 — contract có lỗi 409'],
        ['E8', '- [ ] AC1.2 — hiện lỗi 409\n', ''],
        ['E9', '- **B7. Mục:** x\n', ''],
        ['E9', '| Tạo tài khoản | M |', '|  | M |'],
        ['E3', '### UC01-FE-02 — Nối form', '### UC01-FE-09 — Nối form'],
        ['E6', '| M | UC01-CT-01 |', '| XL | UC01-CT-01 |'],
        ['E9', '- **F9. Mục:** x', ''],
        ['E9', '| Skill gợi ý |', '| Skill |'],
        ['W1', '| M | UC01-CT-01 |', '| M | — |'],
        ['W2', '| S | — |  | Todo | frontend-implement |', '| S | UC01-CT-01 |  | Todo | frontend-implement |'],
      ];
      for (const [code, from, to] of cases) {
        ok(FX.includes(from) && codes(FX.replace(from, to)).includes(code), `check-tasks: biến thể ${code} (${from.trim()}) bị bắt`);
      }
      ok(check(FX.replace('| M | UC01-CT-01 |', '| M | — |')).errors.length === 0, 'check-tasks: W1 chỉ là cảnh báo, không thành lỗi');
      ok(check(FX.replace(/\n/g, '\r\n')).errors.length === 0, 'check-tasks: tasks.md CRLF → 0 lỗi');
      ok(check('\uFEFF' + FX).errors.length === 0, 'check-tasks: tasks.md có BOM → 0 lỗi');
      const linked = check(FX.replace('| M | UC01-CT-01 |', '| M | [UC01-CT-01](#uc01-ct-01) |'));
      ok(linked.errors.length === 0 && linked.warnings.length === 0, 'check-tasks: Phụ thuộc dạng link markdown được nhận');
      ok(check(FX.replace('### UC01-FE-01 — ', '### UC01-FE-01 – ')).errors.length === 0, 'check-tasks: heading en dash vẫn nhận');
      ok(check(FX.replace('# Tasks: Mẫu', '# Tasks: Mẫu\n\n## 1. Tóm tắt use case\n\n- Use case: 1')).errors.length === 0, 'check-tasks: bỏ qua mục H2 "use case" không có bảng');
      ok(check(FX.replace('| S | UC01-CT-01, UC01-FE-01 |', '| S | `UC01-CT-01`, `UC01-FE-01` |')).errors.length === 0, 'check-tasks: Phụ thuộc trong backtick được nhận');
      ok(check(FX.normalize('NFD')).errors.length === 0, 'check-tasks: tasks.md NFD → 0 lỗi');
      let noDetail = null;
      try { noDetail = check(FX.replace('## 5. Chi tiết task', '## 5. Ghi chú')); } catch { noDetail = null; }
      ok(!!noDetail && noDetail.errors.some((p) => p.code === 'E3'), 'check-tasks: thiếu mục Chi tiết task → E3, không ném lỗi');
      const csv = tb.toCsv(tb.parseTasks(FX));
      const recs = csv.slice(1).split('\r\n').filter(Boolean);
      ok(csv.startsWith('\uFEFF') && csv.endsWith('\r\n') && recs.length === 5, 'check-tasks: CSV có BOM, 1 header + 4 task, kết thúc CRLF');
      ok(recs[0] === tb.CSV_COLS.map((c) => `"${c}"`).join(',') && tb.CSV_COLS.length === 11, 'check-tasks: CSV header đủ 11 cột');
      ok(recs[1].startsWith('"UC01-CT-01","UC01","CT","Chốt contract ""đăng ký""","S","—",""'),
        'check-tasks: CSV ID trần, ngoặc kép nhân đôi, Phụ thuộc rỗng = —');
      ok(recs[2].includes('"AC1.1 — tạo tài khoản\nAC1.2 — email trùng trả 409"') && recs[2].endsWith('"tasks.md#uc01-be-01"'),
        'check-tasks: CSV ô AC nhiều dòng trong ngoặc kép, link chi tiết theo anchor');
      const src = fs.readFileSync(TB_SCRIPT, 'utf8');
      ok(!/(?:from\s+|import\s*\(?\s*)['"](?!node:)/.test(src) && !/require\(/.test(src), 'check-tasks: chỉ import node:*');
      ok(src.includes('realpathSync'), 'check-tasks: guard CLI so sánh qua realpath (chạy được qua junction/symlink)');
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-tasks-'));
      const run = (...args) => {
        try {
          return { code: 0, out: execFileSync(process.execPath, [TB_SCRIPT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
        } catch (e) { return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` }; }
      };
      try {
        const good = path.join(tmp, 'tasks.md');
        fs.writeFileSync(good, '\uFEFF' + FX.replace(/\n/g, '\r\n'));
        const bad = path.join(tmp, 'bad.md');
        fs.writeFileSync(bad, FX.replace('| M | UC01-CT-01 |', '| M | UC01-CT-09 |'));
        const okCsv = path.join(tmp, 'ok.csv');
        const badCsv = path.join(tmp, 'bad.csv');
        const r1 = run(good, '--csv', okCsv);
        ok(r1.code === 0 && r1.out.includes('0 lỗi, 0 cảnh báo, 4 task') && fs.existsSync(okCsv),
          `check-tasks CLI: hợp lệ → exit 0, ghi CSV (${r1.code}: ${r1.out.trim()})`);
        const r2 = run(bad, '--csv', badCsv);
        ok(r2.code === 1 && /bad\.md:\d+: \[E4\] UC01-BE-01 phụ thuộc UC01-CT-09 không tồn tại/.test(r2.out) && !fs.existsSync(badCsv),
          `check-tasks CLI: có lỗi → exit 1, báo dòng, không ghi CSV (${r2.code}: ${r2.out.trim()})`);
        ok(run(good, '--csv', path.join(tmp, 'khong-co-thu-muc', 'x.csv')).code === 2, 'check-tasks CLI: không ghi được CSV → exit 2');
        ok(run().code === 2 && run(path.join(tmp, 'khong-co.md')).code === 2, 'check-tasks CLI: thiếu tham số / không đọc được file → exit 2');
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 30c. SOURCE: tài liệu engineering-task-breakdown dùng check-tasks.mjs + nguyên tắc script (spec 2026-10-07 integration §3.5–§3.7)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const TB = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-task-breakdown');
    const rd = (rel) => fs.readFileSync(path.join(TB, rel), 'utf8');
    const skill = rd('SKILL.md');
    ok(skill.includes('(scripts/check-tasks.mjs)') && skill.includes('check-tasks.mjs <đường dẫn tasks.md>'),
      'engineering-task-breakdown: SKILL.md bước 5 chạy check-tasks.mjs và link tới script');
    ok(skill.includes('không có Node → kiểm cả checklist thủ công'), 'engineering-task-breakdown: không có Node → checklist thủ công');
    const out = rd('references/output-formats.md');
    ok(out.includes('check-tasks.mjs <tasks.md> --csv'), 'output-formats: CSV qua check-tasks.mjs --csv');
    const cl = rd('references/breakdown-checklist.md');
    ok(['**(script E7)**', '**(script E1, E2)**', '**(script E4, E5)**', '**(script E6)**', '**(script E8)**', '**(script E9 cho BE/FE;', '**(script W1, W2 một phần;'].every((s) => cl.includes(s)),
      'breakdown-checklist: đánh dấu mục script kiểm tự động');
    const pr = fs.readFileSync(path.join(PLUGINS_DIR, 'engineering', 'shared', 'principles.md'), 'utf8');
    ok(pr.includes('chỉ khi thoả cả 3 điều kiện') && pr.includes('check-tasks.mjs') && !pr.includes('KHÔNG sinh code chạy được') && ['(1)', '(2)', '(3)'].every((s) => pr.includes(s)),
      'engineering principles: cho phép script tất định với 3 điều kiện');
    const mf30 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, 'engineering', '.manifest.json'), 'utf8'));
    ok(mf30.description.includes('check-tasks.mjs'), 'engineering manifest: description nêu check-tasks.mjs');
    for (const [p, rel] of [
      ['claude', 'claude/plugins/engineering/skills/engineering-task-breakdown'],
      ['codex', 'codex/engineering/skills/engineering-task-breakdown'],
      ['cursor', 'cursor/engineering/.cursor/skills/engineering-task-breakdown'],
      ['antigravity', 'antigravity/engineering/docs/workflow/engineering-task-breakdown'],
    ]) {
      if (fs.existsSync(path.join(REPO_ROOT, 'build', p))) {
        ok(fs.existsSync(path.join(REPO_ROOT, 'build', rel, 'scripts', 'check-tasks.mjs')), `build ${p}: ship scripts/check-tasks.mjs`);
      }
    }
  }
}
