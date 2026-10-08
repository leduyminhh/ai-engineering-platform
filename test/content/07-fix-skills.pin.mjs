// Pin nội dung: *-fix skill, *-fixer agent và nối workflow.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, PLUGINS_DIR, parseSteps, offeredCatalog, frontmatter, core, plugins, workflows, wfText } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 18. SOURCE: *-fix skill + *-fixer agent + nối workflow (spec 2026-09-30-fixer-agent-design)
  {
    const fixSkill = (p) => {
      const f = path.join(PLUGINS_DIR, p, 'skills', `${p}-fix`, 'SKILL.md');
      return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    };
    const flat18 = (t) => t.replace(/\s+/g, ' ');
    for (const p of ['backend', 'frontend']) {
      const s = fixSkill(p);
      ok(s.length > 0, `${p}-fix: có SKILL.md`);
      ok(/^order: 9$/m.test(s) && /^runsIn: execute$/m.test(s),
        `${p}-fix: frontmatter order 9, runsIn execute`);
      // §3.2: ranh giới với implement/refactor phải nằm trong description để trigger đúng skill.
      ok(/^description: .*oracle/m.test(s) && /^description: .*-implement/m.test(s) && /^description: .*-refactor/m.test(s),
        `${p}-fix: description nêu oracle và ranh giới với ${p}-implement / ${p}-refactor`);
      for (const g of ['F1', 'F2', 'F3', 'F4', 'F5']) ok(s.includes(`| ${g} `), `${p}-fix: bảng gate có ${g}`);
      for (const m of ['`bug`', '`security`', '`performance`']) ok(s.includes(m), `${p}-fix: có chế độ ${m}`);
      ok(flat18(s).includes('không tự tuyên bố nhanh hơn') && flat18(s).includes('Bước 5'),
        `${p}-fix: chế độ performance không tự tuyên bố nhanh hơn, số đo thuộc Bước 5 của workflow`);
      ok(s.includes('blocked') && flat18(s).includes('không tự mở'),
        `${p}-fix: cần sửa ngoài danh sách → blocked, không tự mở phạm vi`);
      ok(/^\| F3 \| Không sửa[^\n]*test[^\n]*fixture[^\n]*snapshot/m.test(s),
        `${p}-fix: hàng F3 của bảng gate cấm sửa file test/fixture/snapshot`);
      ok(s.includes('che triệu chứng'), `${p}-fix: F4 có danh sách che triệu chứng`);
    }
    ok(fixSkill('backend').includes('@Disabled') && fixSkill('backend').includes('pytest.skip'),
      'backend-fix: danh sách che triệu chứng theo stack Java/Python');
    ok(fixSkill('frontend').includes('@ts-ignore') && fixSkill('frontend').includes('eslint-disable') && fixSkill('frontend').includes('tsc --noEmit'),
      'frontend-fix: danh sách che triệu chứng theo stack TS/React và lệnh tsc --noEmit');
    const pub18 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_published.json'), 'utf8')).published;
    ok(pub18.includes('backend/backend-fix') && pub18.includes('frontend/frontend-fix'),
      '_published.json: có backend/backend-fix và frontend/frontend-fix (publish cùng đợt nối workflow, spec F-Q3)');
    const cowork18 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_cowork.json'), 'utf8')).skills;
    ok(cowork18.includes('backend:backend-fix') && cowork18.includes('frontend:frontend-fix'),
      '_cowork.json: có backend:backend-fix và frontend:frontend-fix');
    const fixAgent = (p) => {
      const f = path.join(PLUGINS_DIR, p, 'agents', `${p}-fixer.md`);
      return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    };
    for (const p of ['backend', 'frontend']) {
      const a = fixAgent(p);
      ok(a.length > 0, `${p}-fixer: có agent file`);
      ok(/^mode: write$/m.test(a) && new RegExp(`^skills: "${p}-fix"$`, 'm').test(a),
        `${p}-fixer: mode write, skills = ${p}-fix (đúng 1 skill)`);
      ok(/^description: .*oracle/m.test(a), `${p}-fixer: description nêu oracle`);
      ok(flat18(a).includes('file test') && flat18(a).includes('ngoài danh sách'),
        `${p}-fixer: phạm vi cấm sửa file test và cấm sửa ngoài danh sách`);
      ok(a.includes('blocked') && flat18(a).includes('không tự mở'),
        `${p}-fixer: cần mở rộng phạm vi → blocked, không tự mở`);
      ok(a.includes('core:principles') && a.includes('not_run'),
        `${p}-fixer: report theo contract core:principles, có not_run`);
      ok(a.includes('git diff --name-only'), `${p}-fixer: tự đối chiếu diff với danh sách trước khi trả`);
    }
    // spec 2026-09-30 §6.2: nối agent fixer vào workflow chỉ hợp lệ khi closure đã publish; nếu ai đó rút *-fix về
    // draft, 3 workflow sẽ bị wizard ẩn lặng lẽ — assert này bắt đúng điểm đó.
    const offeredWf = offeredCatalog().plugins.find((p) => p.id === 'workflows')?.skillIds ?? [];
    for (const w of ['workflow-bugfix', 'workflow-security-review', 'workflow-performance']) {
      ok(offeredWf.includes(`workflows/${w}`), `offeredCatalog: vẫn offer workflows/${w} (closure fixer đã publish)`);
    }
    const wf18 = (id) => workflows.stages.find((s) => s.id === id);
    const step18 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { title: '', body: '', checkpoint: false };
    const fixStepOk = (id, prevN, fixN, prevTitleRe, fixTitleRe) => {
      const w = wf18(id);
      const prev = step18(w, prevN), fix = step18(w, fixN);
      ok(prevTitleRe.test(prev.title) && prev.checkpoint && flat18(prev.body).includes('danh sách file'),
        `${id} Bước ${prevN}: bước ⏸ trước xuất danh sách file được sửa (đầu vào F2)`);
      ok(fixTitleRe.test(fix.title) && fix.body.includes('agent `backend-fixer`') && fix.body.includes('agent `frontend-fixer`'),
        `${id} Bước ${fixN}: Thực hiện là agent backend-fixer ∥ frontend-fixer`);
      ok(!flat18(fix.body).includes('Thực hiện:** session chính'), `${id} Bước ${fixN}: không còn session chính`);
      ok(fix.body.includes('git status --porcelain') && fix.body.includes('git diff --name-only')
        && flat18(fix.body).includes('⊆ danh sách') && flat18(fix.body).includes('không chứa file test'),
        `${id} Bước ${fixN}: Gate so diff với mốc đầu bước, ⊆ danh sách, không chứa file test`);
      ok(flat18(fix.body).includes('blocked'), `${id} Bước ${fixN}: Khi fail xử lý agent trả blocked`);
      ok(w && w.agents.includes('backend-fixer') && w.agents.includes('frontend-fixer'),
        `${id}: frontmatter agents có backend-fixer, frontend-fixer`);
      ok(flat18(wfText(id.replace(/^workflow-/, ''))).includes('Fixer trả `blocked`'), `${id}: bảng lỗi có hàng Fixer trả blocked`);
    };
    fixStepOk('workflow-bugfix', 5, 6, /^Root cause/, /^Fix tối thiểu/);
    ok(parseSteps(wf18('workflow-bugfix')?.body ?? '').length === 9, 'workflow-bugfix: vẫn 9 bước');
    fixStepOk('workflow-security-review', 5, 8, /^Kế hoạch remediation/, /^Sửa/);
    fixStepOk('workflow-performance', 3, 4, /^Profile & giả thuyết/, /^Tối ưu/);
    ok(parseSteps(wf18('workflow-performance')?.body ?? '').length === 7, 'workflow-performance: vẫn 7 bước');
    // spec 2026-09-30 §3.3: chế độ performance không có oracle đỏ — bước phải nói rõ số đo thuộc Bước 5.
    ok(flat18(step18(wf18('workflow-performance'), 4).body).includes('Bước 5'),
      'workflow-performance Bước 4: không kết luận hiệu năng, số đo thuộc Bước 5');
    for (const f of ['README.md', 'README_VI.md']) {
      const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
      const row = (agent) => rd.split('\n').find((l) => l.startsWith(`| \`${agent}\` |`)) ?? '';
      ok(['WF02', 'WF06', 'WF09'].every((w) => row('backend-fixer').includes(w) && row('frontend-fixer').includes(w)),
        `${f}: bảng agent có backend-fixer, frontend-fixer dùng ở WF02, WF06, WF09`);
    }
    // §3.2: refactor không còn trỏ "sửa bug → *-implement"; đích đúng là *-fix.
    for (const p of ['backend', 'frontend']) {
      const r = fs.readFileSync(path.join(PLUGINS_DIR, p, 'skills', `${p}-refactor`, 'SKILL.md'), 'utf8');
      ok(flat18(r).includes(`sửa bug`) && flat18(r).includes(`\`${p}-fix\``),
        `${p}-refactor: câu "cần đổi hành vi (sửa bug…)" trỏ sang ${p}-fix`);
    }

    // Review toàn nhánh: gate diff phải trừ mốc đầu bước và nhận ra file test đã bẩn (oracle) bị sửa; oracle
    // không chỉ là test đỏ (performance, vòng quay lại từ review/re-scan, tái hiện thủ công, finding không có test).
    for (const p of ['backend', 'frontend']) {
      const a = fixAgent(p), s = fixSkill(p);
      ok(flat18(a).includes('chế độ `performance`'), `${p}-fixer: Vai trò/Quy trình phân biệt chế độ performance`);
      ok(a.includes('hash-object'), `${p}-fixer: tự kiểm hash-object file test đã bẩn trong mốc`);
      ok(s.includes('Oracle chấp nhận'), `${p}-fix: có đoạn "Oracle chấp nhận" liệt kê các loại oracle`);
      ok(s.includes('hash-object'), `${p}-fix: F5 kiểm hash-object file test đã bẩn trong mốc`);
      ok(s.includes('NÂNG version'), `${p}-fix: nêu rõ được NÂNG version dependency đã có khi finding là CVE`);
    }
    for (const [id, n] of [['workflow-bugfix', 6], ['workflow-security-review', 8], ['workflow-performance', 4]]) {
      const st = step18(wf18(id), n);
      const field = (name) => flat18((st.body.split(`**${name}:**`)[1] ?? '').split('\n- **')[0]);
      ok(field('Gate').includes('hash-object') && field('Gate').includes('mock'),
        `${id} Bước ${n}: Gate kiểm hash-object file test đã bẩn và không chứa file mock`);
      ok(field('Đầu vào').includes('quay lại'), `${id} Bước ${n}: Đầu vào nêu oracle khi quay lại từ bước sau`);
      ok(field('Hành động').includes('git status --porcelain') && field('Hành động').includes('dispatch'),
        `${id} Bước ${n}: session chính ghi mốc git status --porcelain trước khi dispatch agent`);
    }
    // Bug phát hiện khi refactor chưa có oracle nên không thể đi thẳng sang *-implement (sinh code mới).
    for (const p of ['backend', 'frontend']) {
      const r = flat18(fs.readFileSync(path.join(PLUGINS_DIR, p, 'skills', `${p}-refactor`, 'SKILL.md'), 'utf8'));
      ok(!new RegExp(`bug[^.;\`]*\`${p}-implement\``).test(r) && r.includes('`workflow-bugfix`'),
        `${p}-refactor: bug phát hiện khi dọn route workflow-bugfix, không route ${p}-implement`);
    }

    // Dọn minor đã park: description/Phạm vi của agent phải khớp "Oracle chấp nhận" của skill (a)–(e), và gate
    // của workflow phải có nhánh xanh cho oracle không phải test đỏ.
    for (const p of ['backend', 'frontend']) {
      const a = fixAgent(p);
      ok(/^description: .*tái hiện thủ công/m.test(a),
        `${p}-fixer: description nêu đủ loại oracle, gồm bước tái hiện thủ công`);
      const scope = flat18((a.split('## Phạm vi')[1] ?? '').split('## Quy trình')[0]);
      const bullets = scope.split(/ - /);
      ok(bullets.some((b) => /^(- )?Được: nâng version/.test(b) && b.includes('CVE')),
        `${p}-fixer: có câu "Được" riêng cho nâng version dependency đã có, điều kiện CVE`);
      ok(bullets.some((b) => /^(- )?Không được:/.test(b) && b.includes('không thêm dependency mới') && !b.includes('nâng version')),
        `${p}-fixer: "Không được" giữ cấm thêm dependency mới, không còn phủ định kép về nâng version`);
    }
    {
      const upgradeSentence = (t) => flat18(t.slice(t.indexOf('NÂNG version'), t.indexOf('CVE của dependency đó')));
      const upFe = upgradeSentence(fixSkill('frontend'));
      ok(upFe.length > 0 && upFe.includes('package-lock') && !upFe.includes('pom.xml'),
        'frontend-fix: câu NÂNG version liệt kê manifest/lockfile frontend, không liệt kê pom.xml');
      const upBe = upgradeSentence(fixSkill('backend'));
      ok(upBe.includes('pom.xml') && !upBe.includes('package.json'),
        'backend-fix: câu NÂNG version liệt kê manifest backend, không liệt kê package.json');
      const gateOf = (id, n) => flat18((step18(wf18(id), n).body.split('**Gate:**')[1] ?? '').split('\n- **')[0]);
      ok(gateOf('workflow-bugfix', 6).includes('tái hiện'),
        'workflow-bugfix Bước 6: Gate có nhánh xanh cho oracle tái hiện thủ công');
      ok(gateOf('workflow-security-review', 8).includes('re-scan'),
        'workflow-security-review Bước 8: Gate có nhánh xanh cho finding không có test (re-scan)');
      const fieldOf18 = (id, n, name) => flat18((step18(wf18(id), n).body.split(`**${name}:**`)[1] ?? '').split('\n- **')[0]);
      for (const name of ['Đầu ra', 'Evidence']) {
        ok(fieldOf18('workflow-bugfix', 6, name).includes('tái hiện thủ công'),
          `workflow-bugfix Bước 6: ${name} nêu oracle tái hiện thủ công`);
        ok(fieldOf18('workflow-security-review', 8, name).includes('re-scan'),
          `workflow-security-review Bước 8: ${name} nêu finding không có test chờ re-scan`);
      }
    }
    for (const p of ['backend', 'frontend']) {
      ok(flat18(fixAgent(p)).includes('review/re-scan lại do bước sau của workflow'),
        `${p}-fixer: Report oracle (b)/(e) chỉ ghi file:line đã sửa, review/re-scan thuộc bước sau của workflow`);
    }
  }
}
