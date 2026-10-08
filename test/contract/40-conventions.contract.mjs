// Contract conventions: frontmatter, khung H2, description, trùng lặp và các mẫu chuẩn hoá áp mọi skill/agent.
export default async function run({ ok, ctx }) {
  const { fs, path, execFileSync, pathToFileURL, REPO_ROOT, PLUGINS_DIR, CORE_DIR, agentsFiles, whenToUse, WHEN_TO_USE_MAX, principlesDigest, frontmatter, yamlScalar, checkSkillBody, checkDescription, notForTargets, quotedPhrases, triggerCollisions, checkFrontmatterYaml, checkDescriptionStyle, checkAgentDescription, DESCRIPTION_TARGET, AGENT_DESCRIPTION_MAX, lineOverlap, stepOverlap, titleOverlap, listFilesRec, core, plugins, allAgents, workflows, BUILD, fxCore } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 24. Chuẩn hoá A1: frontmatter không còn trường chết (spec 2026-10-06 §4.1)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const DEAD = /^(pipeline|next|stageNumber):/m;
    const fmOf = (file) => (fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
    const sources = [
      ...core.stages.map((s) => path.join(CORE_DIR, 'skills', s.id, 'SKILL.md')),
      ...plugins.flatMap((p) => p.stages.map((s) => path.join(PLUGINS_DIR, p.id, 'skills', s.id, 'SKILL.md'))),
      ...(workflows ? workflows.stages.map((s) => path.join(s.dir, 'WORKFLOW.md')) : []),
      path.join(REPO_ROOT, 'templates', 'workflows', 'workflow.template.md'),
    ];
    for (const f of sources) {
      ok(!DEAD.test(fmOf(f)), `${path.relative(REPO_ROOT, f)}: frontmatter không còn pipeline/next/stageNumber`);
    }
    for (const s of [...core.stages, ...plugins.flatMap((p) => p.stages), ...(workflows ? workflows.stages : [])]) {
      ok(!('pipeline' in s) && !('next' in s) && !('stageNumber' in s), `${s.id}: loader không trả pipeline/next/stageNumber`);
    }
    const ag24 = agentsFiles({ id: 'fx', name: 'Fixture', shared: { principles: '' }, stages: [{
      id: 'fx-a', title: 'A', description: 'Làm A. Chi tiết.', runsIn: 'execute', invoke: 'per-request', body: 'x',
      assets: [], fileAssets: [], dirAssets: [] }] }, { tool: 'Antigravity', base: 'fx', core: fxCore });
    const agMd24 = (ag24.find((f) => f.path === 'fx/AGENTS.md') || { content: '' }).content;
    ok(!agMd24.includes('Pipeline & các giai đoạn') && !agMd24.includes('Thứ tự bắt buộc') && !agMd24.includes('Tiếp theo'),
      'agentsFiles: không còn mục pipeline / "Tiếp theo"');
    ok(agMd24.includes('## Skill (gọi theo yêu cầu)') && agMd24.includes('### fx-a — A')
      && agMd24.includes('- **Khi nào dùng:** Làm A.'), 'agentsFiles: liệt kê skill trong một nhóm');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 25. Chuẩn hoá A2: khung H2 SKILL.md (spec 2026-10-06 §4.2)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    ok(checkSkillBody('## Quy trình\nx\n## Ranh giới an toàn\nx').length === 0, 'checkSkillBody: đủ 2 heading → hợp lệ');
    ok(checkSkillBody('## Quy trình (trung tính stack) — cổng\n## Ranh giới an toàn (CLAUDE.md)').length === 0,
      'checkSkillBody: cho phép hậu tố sau dấu cách');
    ok(checkSkillBody('## Luồng viết spec\n## Ranh giới an toàn').some((e) => e.includes('Quy trình')),
      'checkSkillBody: "## Luồng …" không thay được "## Quy trình"');
    ok(checkSkillBody('## Quy trình\n## Ranh giới').some((e) => e.includes('Ranh giới an toàn')),
      'checkSkillBody: "## Ranh giới" trần không đạt');
    ok(checkSkillBody('## Quy trìnhX\n## Ranh giới an toàn').length === 1, 'checkSkillBody: chữ dính sau tên heading không đạt');
    ok(checkSkillBody('### Quy trình\n## Ranh giới an toàn').length === 1, 'checkSkillBody: H3 không thay được H2');
    ok(checkSkillBody('```md\n## Quy trình\n```\n## Ranh giới an toàn').some((e) => e.includes('Quy trình')),
      'checkSkillBody: heading chỉ nằm trong khối ``` không tính');
    ok(checkSkillBody('~~~\n## Ranh giới an toàn\n~~~\n## Quy trình\n## Ranh giới an toàn').length === 0,
      'checkSkillBody: heading thật ngoài khối ~~~ vẫn đạt');
    for (const s of [...core.stages, ...plugins.flatMap((p) => p.stages)]) {
      const errs = checkSkillBody(s.body);
      ok(errs.length === 0, `${s.id}: khung SKILL.md hợp lệ${errs.length ? ' — ' + errs.join('; ') : ''}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 26. Chuẩn hoá A3: description (spec 2026-10-06 §4.3, §10)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const known26 = new Set(['a-b', 'c-d', 'workflow-x']);
    ok(checkDescription('Làm X. Không dùng khi Y → a-b.', known26, 'c-d').length === 0, 'checkDescription: hợp lệ');
    ok(checkDescription('Làm X.', known26, 'c-d').some((e) => e.includes('thiếu câu')), 'checkDescription: thiếu câu Không dùng khi');
    ok(checkDescription('Làm X. Không dùng khi Y.', known26, 'c-d').some((e) => e.includes('không có')),
      'checkDescription: câu Không dùng khi không có đích');
    ok(checkDescription('Làm X. Không dùng khi Y → z-z.', known26, 'c-d').some((e) => e.includes('z-z')),
      'checkDescription: đích không tồn tại');
    ok(checkDescription('Làm X. Không dùng khi Y → c-d.', known26, 'c-d').some((e) => e.includes('chính nó')),
      'checkDescription: trỏ vào chính nó');
    ok(checkDescription('Làm X. KHÔNG thuộc pipeline bắt buộc; gọi khi cần. Không dùng khi Y → a-b.', known26, 'c-d')
      .some((e) => e.includes('pipeline')), 'checkDescription: còn câu pipeline');
    ok(checkDescription(`${'x'.repeat(1020)}. Không dùng khi Y → a-b.`, known26, 'c-d').some((e) => e.includes('1024')),
      'checkDescription: quá 1024 ký tự');
    ok(checkDescription('Làm X "PR #". Không dùng khi Y → a-b.', known26, 'c-d').some((e) => e.includes('" #"')),
      'checkDescription: chứa " #" (YAML hiểu là comment khi ghi plain scalar)');
    ok(JSON.stringify(notForTargets('Làm X v.v. Không dùng khi Y, v.v. → a-b; Z →c-d; W → `workflow-x`.'))
      === '["a-b","c-d","workflow-x"]', 'notForTargets: chịu "v.v.", mũi tên dính, backtick');
    ok(notForTargets('Làm X.') === null, 'notForTargets: không có câu → null');
    ok(JSON.stringify(quotedPhrases('muốn "OpenAPI", " openapi " — chữ "skill"')) === '["openapi","openapi"]',
      'quotedPhrases: chữ thường, trim, bỏ "skill"');
    const col26 = triggerCollisions([
      { id: 'a-b', kind: 'skill', description: 'Dùng khi "Sửa Lỗi". Không dùng khi Y → c-d.' },
      { id: 'c-d', kind: 'skill', description: 'Dùng khi "sửa lỗi ". Không dùng khi Y → a-b.' },
      { id: 'e-f', kind: 'skill', description: 'Dùng khi "release". Không dùng khi Y → workflow-x.' },
      { id: 'g-h', kind: 'skill', description: 'Dùng khi "deploy". Không dùng khi Y → a-b.' },
      { id: 'workflow-x', kind: 'workflow', description: 'Dùng khi "release", "deploy". Không dùng khi Y → a-b.' },
    ]);
    ok(col26.some((e) => e.includes('"sửa lỗi"') && e.includes('a-b') && e.includes('c-d')),
      'triggerCollisions: trùng skill ↔ skill (khác hoa/thường, khoảng trắng) → lỗi');
    ok(!col26.some((e) => e.includes('e-f')), 'triggerCollisions: skill ↔ workflow có "→ workflow-x" → hợp lệ');
    ok(col26.some((e) => e.includes('g-h') && e.includes('workflow-x')), 'triggerCollisions: skill ↔ workflow không trỏ → lỗi');

    const all26 = [
      ...core.stages.map((s) => ({ ...s, kind: 'skill' })),
      ...plugins.flatMap((p) => p.stages.map((s) => ({ ...s, kind: 'skill' }))),
      ...(workflows ? workflows.stages.map((s) => ({ ...s, kind: 'workflow' })) : []),
    ];
    const ids26 = new Set([...all26.map((s) => s.id), ...allAgents.map((a) => a.id)]);
    for (const s of all26) {
      const errs = checkDescription(s.description, ids26, s.id);
      ok(errs.length === 0, `${s.id}: description hợp lệ${errs.length ? ' — ' + errs.join('; ') : ''}`);
    }
    const real26 = triggerCollisions(all26.map((s) => ({ id: s.id, kind: s.kind, description: s.description })));
    ok(real26.length === 0, `không có trigger trùng${real26.length ? ' — ' + real26.join(' | ') : ''}`);
    ok(whenToUse({ description: 'Làm A. Chi tiết.' }) === 'Làm A.', 'whenToUse: câu đầu ngắn giữ nguyên');
    const w26 = whenToUse({ description: `${'từ '.repeat(120)}cuối. Câu hai.` });
    ok([...w26].length <= WHEN_TO_USE_MAX && /(^| )từ…$/.test(w26), 'whenToUse: câu dài cắt ở ranh giới từ, thêm "…"');
    const w26b = whenToUse({ description: `${'abc / '.repeat(60)}cuối. Câu hai.` });
    ok(/abc…$/.test(w26b) && [...w26b].length <= WHEN_TO_USE_MAX, 'whenToUse: bỏ ký tự nối lơ lửng (/, +, () trước "…"');
    const parenBalanced = (s) => {
      let depth = 0;
      for (const ch of s) {
        if (ch === '(') depth++;
        else if (ch === ')') { if (!depth) return false; depth--; }
      }
      return depth === 0;
    };
    ok(whenToUse({ description: `Mở đầu (${'từ '.repeat(100)}đóng). Câu hai.` }) === 'Mở đầu…',
      'whenToUse: lùi về trước "(" ngoài cùng chưa đóng');
    const wNested = whenToUse({ description: `Mở (a) b (c (${'từ '.repeat(100)}x)). Hai.` });
    ok(wNested === 'Mở (a) b…', 'whenToUse: ngoặc lồng chưa đóng → lùi về trước "(" ngoài cùng, giữ ngoặc đã đóng');
    const wStart = whenToUse({ description: `(${'từ '.repeat(100)}x). Hai.` });
    ok(wStart.endsWith('…)') && parenBalanced(wStart) && [...wStart].length <= WHEN_TO_USE_MAX,
      'whenToUse: "(" ở đầu câu → đóng ngoặc sau "…", vẫn ≤ 200 ký tự');
    const wEdge = whenToUse({ description: `(${'a'.repeat(194)} ( x${'y'.repeat(20)}. Hai.` });
    ok(parenBalanced(wEdge) && [...wEdge].length <= WHEN_TO_USE_MAX, 'whenToUse: số ")" tính trên phần đã rút ngắn');
    const wCap = whenToUse({ description: `(${'a'.repeat(100)}(${'b'.repeat(96)})zzzzzz tail. Hai.` });
    ok(parenBalanced(wCap) && [...wCap].length <= WHEN_TO_USE_MAX, 'whenToUse: nhánh "(" đầu câu vẫn ≤ 200 ký tự sau khi đóng ngoặc');
    ok(whenToUse({ description: `${'a'.repeat(120)}, ${'b '.repeat(60)}cuối. Hai.` }) === `${'a'.repeat(120)}…`,
      'whenToUse: cắt ở ranh giới mệnh đề ", " gần nhất');
    ok(whenToUse({ description: `${'a'.repeat(130)} — ${'b '.repeat(60)}cuối. Hai.` }) === `${'a'.repeat(130)}…`,
      'whenToUse: cắt ở ranh giới mệnh đề " — "');
    ok(whenToUse({ description: `${'a'.repeat(110)}, ${'b'.repeat(30)}; ${'c '.repeat(40)}cuối. Hai.` }) === `${'a'.repeat(110)}, ${'b'.repeat(30)}…`,
      'whenToUse: nhiều ranh giới hợp lệ → chọn ranh giới cuối ("; ")');
    ok(whenToUse({ description: `${'a'.repeat(120)}: ${'b '.repeat(60)}cuối. Hai.` }) === `${'a'.repeat(120)}…`,
      'whenToUse: cắt ở ranh giới mệnh đề ": "');
    const wInParen = whenToUse({ description: `${'a'.repeat(110)} (x, y) ${'c '.repeat(60)}cuối. Hai.` });
    ok(wInParen.endsWith('c…') && wInParen.includes('(x, y)'), 'whenToUse: dấu phẩy trong ngoặc không phải ranh giới mệnh đề');
    ok(whenToUse({ description: `${'a'.repeat(50)}, ${'b '.repeat(80)}cuối. Hai.` }).endsWith('b…'),
      'whenToUse: ranh giới trước ký tự 100 bị bỏ qua, quay về cắt theo từ');
    const firstSentence26 = (s) => {
      const d = (s.description || '').trim().replace(/\s+/g, ' ');
      const m = d.match(/^(.*?[.。])\s/);
      return m ? m[1] : d;
    };
    const cut26 = all26.filter((s) => whenToUse(s).endsWith('…'));
    const atClause26 = cut26.filter((s) => {
      const kept = whenToUse(s).slice(0, -1);
      const first = firstSentence26(s);
      return first.startsWith(kept) && [', ', '; ', ' — ', ': '].some((b) => first.startsWith(b, kept.length));
    });
    // Cắt theo từ cũng có thể tình cờ dừng trước dấu phẩy, nên đòi đa số thay vì "ít nhất một".
    // Sau khi viết lại description (câu đầu ≤ 200) có thể không còn dòng nào bị cắt; khi đó không có gì để đo.
    ok(cut26.length === 0 || atClause26.length * 2 >= cut26.length,
      `whenToUse: đa số dòng thật bị cắt dừng sau trọn mệnh đề (${atClause26.length}/${cut26.length})`);
    const unbalanced26 = all26.filter((s) => !parenBalanced(whenToUse(s))).map((s) => s.id);
    ok(unbalanced26.length === 0, `whenToUse: mọi dòng "Khi nào dùng" cân ngoặc${unbalanced26.length ? ' — ' + unbalanced26.join(', ') : ''}`);
    const longWhen = all26.filter((s) => [...whenToUse(s)].length > WHEN_TO_USE_MAX).map((s) => s.id);
    ok(longWhen.length === 0, `whenToUse: mọi dòng "Khi nào dùng" ≤ ${WHEN_TO_USE_MAX} ký tự${longWhen.length ? ' — ' + longWhen.join(', ') : ''}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 28. Chuẩn hoá B0: chỉ số trùng lặp (spec 2026-10-06 §5.1)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    ok(lineOverlap('a\nb\nc', 'b\nc\nd\ne') === 2 / 3, 'lineOverlap: chia cho tập nhỏ hơn');
    ok(lineOverlap('Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.\nx',
      'Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.\ny') === 0, 'lineOverlap: bỏ dòng neo template');
    ok(lineOverlap('|---|---|\n```\nx', '|---|---|\n```\ny') === 0, 'lineOverlap: bỏ dòng cấu trúc markdown');
    ok(lineOverlap('', 'a') === 0, 'lineOverlap: rỗng → 0');
    const st = (n, who, act) => `### Bước ${n} — T${n}\n- **Thực hiện:** ${who}\n- **Hành động:** ${act}\n`;
    const wa = `## Các bước\n${st(1, 'session chính', 'chạy build')}${st(2, 'agent \`x\`', 'viết test')}## Checkpoint\n`;
    const wb = `## Các bước\n${st(1, 'session chính', 'chạy build')}${st(2, 'agent \`y\`', 'viết test')}${st(3, 'a', 'b')}## Checkpoint\n`;
    ok(stepOverlap(wa, wb) === 0.5, 'stepOverlap: khớp cả Thực hiện lẫn Hành động');
    ok(titleOverlap(wa, wb) === 1, 'titleOverlap: so tên bước');
    let out28 = null;
    try {
      out28 = execFileSync('node', ['--input-type=module', '-e',
        `await import(${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, 'test', 'overlap.mjs')).href)})`],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch { out28 = null; }
    ok(out28 === '', 'overlap.mjs: import từ node -e không ném lỗi và không in báo cáo');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 31. Frontmatter build là YAML an toàn (spec 2026-10-07 audit E1 / Phase 0 P0.1)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    ok(yamlScalar('backend-adr') === 'backend-adr', 'yamlScalar: chuỗi thuần giữ plain');
    ok(yamlScalar('Edit, Write, NotebookEdit, Agent') === 'Edit, Write, NotebookEdit, Agent', 'yamlScalar: dấu phẩy không cần quote');
    ok(yamlScalar('Recipe on-demand: review') === '"Recipe on-demand: review"', 'yamlScalar: ": " giữa chuỗi → quote');
    ok(yamlScalar('PR #12') === '"PR #12"', 'yamlScalar: " #" → quote');
    ok(yamlScalar('[a] b') === '"[a] b"' && yamlScalar('- x') === '"- x"' && yamlScalar('*.ts') === '"*.ts"',
      'yamlScalar: ký tự mở cấu trúc ở đầu → quote');
    ok(yamlScalar('nói "skill"') === '"nói \\"skill\\""', 'yamlScalar: dấu " bên trong được escape');
    ok(yamlScalar('') === '""' && yamlScalar('a ') === '"a "', 'yamlScalar: rỗng / khoảng trắng cuối → quote');
    ok(frontmatter([['name', 'x'], ['description', 'A: b'], ['effort', 'high'], ['skip', null]])
      === '---\nname: x\ndescription: "A: b"\neffort: high\n---', 'frontmatter: quote đúng key cần quote, bỏ key null');
    ok(yamlScalar('foo:') === '"foo:"' && checkFrontmatterYaml('d: foo:').length === 1, 'yamlScalar/checker: ":" cuối chuỗi → quote');
    ok(checkFrontmatterYaml('name: x\ndescription: "A: b"').length === 0, 'checkFrontmatterYaml: hợp lệ');
    ok(checkFrontmatterYaml('description: A: b').some((e) => e.includes('plain scalar')), 'checkFrontmatterYaml: ": " không quote → lỗi');
    ok(checkFrontmatterYaml('description: "chưa đóng').some((e) => e.includes('quote')), 'checkFrontmatterYaml: quote không đóng → lỗi');
    ok(checkFrontmatterYaml('description: "có \\"escape\\" đúng"').length === 0, 'checkFrontmatterYaml: escape \\" hợp lệ');
    ok(checkFrontmatterYaml('- item').length === 1, 'checkFrontmatterYaml: dòng không phải key: value → lỗi');
    const fmOf31 = (text) => { const m = text.match(/^---\n([\s\S]*?)\n---/); return m ? m[1] : null; };
    const targets31 = [
      ['claude', path.join(BUILD, 'claude'), (f) => f.endsWith('.md')],
      ['codex', path.join(BUILD, 'codex'), (f) => f.endsWith('SKILL.md')],
      ['cursor', path.join(BUILD, 'cursor'), (f) => f.endsWith('SKILL.md') || f.endsWith('.mdc')],
    ];
    for (const [prov, dir, pick] of targets31) {
      if (!fs.existsSync(dir)) continue;
      const bad = [];
      let seen = 0;
      for (const rel of listFilesRec(dir).filter(pick)) {
        const fm = fmOf31(fs.readFileSync(path.join(dir, rel), 'utf8'));
        if (fm === null) continue;
        seen++;
        const errs = checkFrontmatterYaml(fm);
        if (errs.length) bad.push(`${rel}: ${errs[0]}`);
      }
      ok(seen > 0 && bad.length === 0, `build ${prov}: ${seen} frontmatter đều là YAML an toàn${bad.length ? ' — ' + bad.slice(0, 3).join(' | ') : ''}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 33. Mô tả skill <plugin>-principles không còn "pipeline bắt buộc", có tình huống dùng (spec 2026-10-07 audit S3 / P0.5)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    for (const p of plugins) {
      if (!(p.shared.principles && p.shared.principles.trim())) continue;
      for (const [prov, rel] of [['claude', path.join('claude', 'plugins', p.id, 'skills', `${p.id}-principles`, 'SKILL.md')],
        ['codex', path.join('codex', p.id, 'skills', `${p.id}-principles`, 'SKILL.md')]]) {
        const f = path.join(BUILD, rel);
        const c = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
        // Chỉ xét dòng description: thân principles có thể phủ định hợp lệ ("không phải pipeline bắt buộc").
        const desc = (c.match(/^description: .*$/m) || [''])[0];
        ok(desc && !desc.includes('pipeline bắt buộc') && desc.includes('Dùng khi'),
          `build ${prov} ${p.id}-principles: mô tả không nhắc pipeline bắt buộc, có "Dùng khi"`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 35. Phase 1: mẫu description skill/agent — áp dần theo plugin (spec 2026-10-07 audit S1, W4 / P1.1, P1.2)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const good35 = 'Review diff backend theo correctness, kiến trúc và test. Dùng khi người dùng muốn "review code backend", "review PR backend", "đọc soát PR". Không dùng khi cần quét bảo mật → engineering-quality-gate.';
    ok(checkDescriptionStyle(good35).length === 0, 'checkDescriptionStyle: mẫu chuẩn hợp lệ');
    ok(checkDescriptionStyle(`${'a'.repeat(205)}. Dùng khi người dùng muốn "xx", "yy", "zz". Không dùng khi k → a-b.`).some((e) => e.includes('câu đầu')),
      'checkDescriptionStyle: câu đầu > 200 ký tự → lỗi');
    ok(checkDescriptionStyle('Làm A. Dùng khi người dùng muốn "xx", "yy". Không dùng khi k → a-b.').some((e) => e.includes('trigger')),
      'checkDescriptionStyle: < 3 trigger → lỗi');
    ok(checkDescriptionStyle('Làm A. Dùng khi người dùng muốn "aa", "bb", "cc", "dd", "ee", "ff", "gg". Không dùng khi k → a-b.').some((e) => e.includes('trigger')),
      'checkDescriptionStyle: > 5 trigger → lỗi');
    ok(checkDescriptionStyle('Recipe on-demand: làm A. Dùng khi người dùng muốn "xx", "yy", "zz". Không dùng khi k → a-b.').some((e) => e.includes('boilerplate')),
      'checkDescriptionStyle: cụm boilerplate → lỗi');
    ok(checkDescriptionStyle('Làm A. Khi người dùng muốn "xx", "yy", "zz". Không dùng khi k → a-b.').some((e) => e.includes('Dùng khi')),
      'checkDescriptionStyle: thiếu "Dùng khi" → lỗi');
    ok(checkDescriptionStyle(`${good35}${' thêm'.repeat(100)}`).some((e) => e.includes(`${DESCRIPTION_TARGET}`)),
      'checkDescriptionStyle: vượt DESCRIPTION_TARGET → lỗi');
    ok(checkAgentDescription('Reviewer backend: đọc diff, trả finding có severity theo skill backend-code-review. Dùng khi workflow cần review phần backend.').length === 0,
      'checkAgentDescription: mẫu chuẩn hợp lệ');
    ok(checkAgentDescription(`${'a'.repeat(270)}. Dùng khi x.`).some((e) => e.includes(`${AGENT_DESCRIPTION_MAX}`)), 'checkAgentDescription: quá dài → lỗi');
    ok(checkAgentDescription('Agent làm X. Không được: a, b, c.').some((e) => e.includes('Dùng khi')), 'checkAgentDescription: thiếu "Dùng khi" → lỗi');

    const STYLE_READY = new Set(['backend', 'data', 'frontend', 'ops', 'core', 'engineering']); // Task 8 thay bằng tất cả
    const AGENT_STYLE_READY = new Set(allAgents.map((a) => a.id));
    for (const p of [core, ...plugins]) {
      if (!STYLE_READY.has(p.id)) continue;
      for (const s of p.stages) {
        const errs = checkDescriptionStyle(s.description);
        ok(errs.length === 0, `${s.id}: description theo mẫu Phase 1${errs.length ? ' — ' + errs.join('; ') : ''}`);
      }
    }
    // Viết lại description không được làm mất tuyến "Không dùng khi → id" đã có (snapshot trước Phase 1).
    const notFor35 = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'test', 'fixtures', 'not-for-ids.json'), 'utf8'));
    for (const p of [core, ...plugins]) for (const s of p.stages) {
      const want = notFor35[s.id] || [];
      const have = new Set(notForTargets(s.description) || []);
      const lost = want.filter((id) => !have.has(id));
      ok(lost.length === 0, `${s.id}: giữ đủ id "Không dùng khi"${lost.length ? ' — mất: ' + lost.join(', ') : ''}`);
    }
    for (const a of allAgents) {
      if (!AGENT_STYLE_READY.has(a.id)) continue;
      const errs = checkAgentDescription(a.description);
      ok(errs.length === 0, `${a.id}: description agent theo mẫu Phase 1${errs.length ? ' — ' + errs.join('; ') : ''}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 36. Digest nguyên tắc nền thay preamble ép nạp principles; bỏ mục "Khi nào dùng" (spec 2026-10-07 audit S2, S5 / P1.3)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const d36 = principlesDigest({ provider: 'claude', pluginId: 'backend' });
    ok(d36.includes('**Nguyên tắc nền (tóm tắt):**') && d36.includes('`backend-principles`') && d36.includes('`core:principles`')
      && d36.includes('`backend:backend-principles`') && d36.includes('`core:git-workflow`') && !d36.includes('Đọc trước'),
      'principlesDigest claude: digest + pointer 2 dạng + git-workflow, không còn "Đọc trước"');
    const c36 = principlesDigest({ provider: 'codex', pluginId: 'ops' });
    ok(c36.includes('`ops-principles`') && !c36.includes('core:principles') && c36.includes('`git-workflow`'), 'principlesDigest codex: tên trần, không namespace');
    ok(!principlesDigest({ provider: 'claude' }).includes('-principles`'), 'principlesDigest không pluginId: không trỏ skill principles plugin');
    ok(d36.split('\n').length <= 4 && [...d36].length <= 900, 'principlesDigest: ≤ 4 dòng, ≤ 900 ký tự');
    const claude36 = path.join(BUILD, 'claude', 'plugins');
    if (fs.existsSync(claude36)) {
      const bad = [];
      for (const rel of listFilesRec(claude36).filter((f) => f.endsWith('.md'))) {
        const c = fs.readFileSync(path.join(claude36, rel), 'utf8');
        if (c.includes('**Đọc trước** nguyên tắc nền tảng')) bad.push(rel);
      }
      ok(bad.length === 0, `build claude: không còn preamble "Đọc trước nguyên tắc nền tảng"${bad.length ? ' — ' + bad.slice(0, 3).join(', ') : ''}`);
      const sample36 = fs.readFileSync(path.join(claude36, 'backend', 'skills', 'backend-implement', 'SKILL.md'), 'utf8');
      ok(sample36.includes('**Nguyên tắc nền (tóm tắt):**') && sample36.includes('`backend:backend-principles`'), 'build claude backend-implement: có digest + pointer');
    }
    const codex36 = path.join(BUILD, 'codex');
    if (fs.existsSync(codex36)) {
      const sample = fs.readFileSync(path.join(codex36, 'engineering', 'skills', 'engineering-adr', 'SKILL.md'), 'utf8');
      ok(sample.includes('**Nguyên tắc nền (tóm tắt):**') && !sample.includes('**Đọc trước**'), 'build codex engineering-adr: digest thay preamble');
    }
    for (const s of [...core.stages, ...plugins.flatMap((p) => p.stages)]) {
      ok(!/^## Khi nào dùng/m.test(s.body), `${s.id}: không còn mục "## Khi nào dùng" (description đã nêu)`);
    }
  }
}
