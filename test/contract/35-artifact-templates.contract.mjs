// Contract artifact-templates: helper khối header, mục lục skill core `artifact-templates` và từng template qua validator của chính nó.
import { TEMPLATES_DIR, templateHeader, stripTemplateHeader, templateIndex } from '../../cli/lib/templates.mjs';
import { splitList } from '../../cli/lib/plugins.mjs';
import { coworkSkillIds } from '../../cli/lib/pack.mjs';

export default async function run({ ok, ctx }) {
  const { fs, path, pathToFileURL, CORE_DIR, PLUGINS_DIR, core, plugins, workflows, allAgents, parseFrontmatter, checkWorkflowBody, missingAnchors, checkSourceKeys, checkSkillBody, checkDescription, checkDescriptionStyle, checkAgentDescription, checkAgentTools } = ctx;
  const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

  // 1. UNIT: templateHeader / stripTemplateHeader — một hành vi, nhiều đầu vào.
  {
    const HDR = '<!-- artifact-template\ntype: demo\nversion: 2\nvalidator: chưa có\nsources: A; B\nBỏ khối này khi chép template ra dùng.\n-->';
    const FM = '---\nname: x\n---';
    const cases = [
      { name: 'header ở đầu file', text: `${HDR}\n\n# Tiêu đề\n`, stripped: '# Tiêu đề\n' },
      { name: 'header sau frontmatter', text: `${FM}\n\n${HDR}\n\n# Tiêu đề\n`, stripped: `${FM}\n\n# Tiêu đề\n` },
      { name: 'file CRLF', text: `${FM}\n\n${HDR}\n\n# Tiêu đề\n`.replace(/\n/g, '\r\n'), stripped: `${FM}\n\n# Tiêu đề\n`.replace(/\n/g, '\r\n') },
      { name: 'không có header', text: `${FM}\n\n# Tiêu đề\n`, stripped: `${FM}\n\n# Tiêu đề\n`, none: true },
    ];
    for (const c of cases) {
      const h = templateHeader(c.text);
      if (c.none) ok(h === null, `templateHeader: ${c.name} → null`);
      else {
        ok(!!h && h.type === 'demo' && h.version === 2 && h.validator === 'chưa có' && h.sources === 'A; B',
          `templateHeader: ${c.name} → đọc đủ type/version/validator/sources`);
      }
      ok(stripTemplateHeader(c.text) === c.stripped, `stripTemplateHeader: ${c.name}`);
    }
    const fm = parseFrontmatter(stripTemplateHeader(cases[1].text));
    ok(fm.meta.name === 'x', 'stripTemplateHeader: frontmatter còn đọc được sau khi bỏ header');
    ok(parseFrontmatter(cases[1].text).meta.name === 'x', 'header sau frontmatter: parser vẫn đọc được frontmatter');
  }

  // 2. Mục lục SKILL.md: mỗi dòng trỏ tới file có header đúng loại.
  const skillFile = path.join(CORE_DIR, 'skills', 'artifact-templates', 'SKILL.md');
  ok(fs.existsSync(skillFile), 'core/skills/artifact-templates/SKILL.md tồn tại');
  ok(path.basename(path.dirname(TEMPLATES_DIR)) === 'artifact-templates' && path.basename(TEMPLATES_DIR) === 'references',
    'TEMPLATES_DIR trỏ tới core/skills/artifact-templates/references');
  const skillText = fs.existsSync(skillFile) ? read(skillFile) : '';
  const index = templateIndex(skillText);
  ok(index.length > 0, 'mục lục artifact-templates có ít nhất một dòng');
  const TYPES = ['skill', 'agent', 'workflow', 'requirement', 'design', 'plan', 'task', 'adr', 'project-knowledge', 'handoff', 'spec'];
  ok(JSON.stringify(index.map((r) => r.type).sort()) === JSON.stringify([...TYPES].sort()),
    `mục lục artifact-templates có đúng 11 loại (đang có: ${index.map((r) => r.type).join(', ')})`);
  const tplOf = (type) => {
    const row = index.find((r) => r.type === type);
    return row ? read(path.join(path.dirname(skillFile), row.file)) : '';
  };
  for (const row of index) {
    const target = path.join(path.dirname(skillFile), row.file);
    const exists = fs.existsSync(target);
    ok(exists, `mục lục: ${row.type} → ${row.file} tồn tại`);
    if (!exists) continue;
    // Dòng thư mục (project-knowledge): mọi .md bên trong có header; file khác (tech-stack.yml) không có header, được miễn.
    const files = row.isDir
      ? fs.readdirSync(target).filter((n) => n.endsWith('.md')).sort().map((n) => path.join(target, n))
      : [target];
    if (row.isDir) ok(files.length > 0, `mục lục: ${row.type} → ${row.file} có ít nhất một file .md`);
    for (const file of files) {
      const rel = path.relative(path.dirname(skillFile), file).split(path.sep).join('/');
      const h = templateHeader(fs.readFileSync(file, 'utf8'));
      ok(h !== null, `${rel}: có khối <!-- artifact-template -->`);
      // Header và mục lục lặp cùng thông tin; kiểm lệch để không trôi dần (bỏ dấu backtick của cột Validator).
      ok(!!h && h.validator === row.validator.replace(/`/g, '') && h.sources === row.sources, `${rel}: header validator/sources khớp dòng mục lục`);
      ok(!!h && h.type === row.type, `${rel}: header type khớp cột Loại (${row.type})`);
      ok(!!h && Number.isInteger(h.version) && h.validator !== '' && h.sources !== '', `${rel}: header đủ version/validator/sources`);
    }
  }

  {
    const row = index.find((r) => r.type === 'spec');
    ok(!!row && row.validator.includes('check-request.mjs'), 'AC1.1: mục lục có dòng spec với validator check-request.mjs');
    const tpl = tplOf('spec');
    for (const h of ['Mục đích', 'Phạm vi', 'Yêu cầu', 'Lịch sử']) {
      ok(new RegExp(`^## ${h}\\s*$`, 'm').test(tpl), `AC1.2: spec.template.md có mục ## ${h}`);
    }
    ok(/^- \*\*<năng-lực>\/R1\*\* — .*Nguồn: \[<slug>\]\(.*\) \(thêm\)/m.test(tpl), 'AC1.2: spec.template.md có dòng yêu cầu mẫu');
    ok(/^- ~~\*\*<năng-lực>\/R2\*\* — .*~~ đã bỏ bởi \[<slug>\]\(.*\)/m.test(tpl), 'AC1.2: spec.template.md có dòng yêu cầu bị bỏ mẫu');
  }

  {
    const tpl = tplOf('design');
    ok(/^## Ảnh hưởng spec\s*$/m.test(tpl), 'AC2.1: design.template.md có mục ## Ảnh hưởng spec');
    ok(tpl.indexOf('## Thiết kế') < tpl.indexOf('## Ảnh hưởng spec') && tpl.indexOf('## Ảnh hưởng spec') < tpl.indexOf('## Ngoài phạm vi'),
      'AC2.1: mục Ảnh hưởng spec nằm sau ## Thiết kế');
    ok(/^- <năng-lực>: thêm R<n>, đổi R<m>, bỏ R<k>/m.test(tpl) && /^Không ảnh hưởng: <lý do>/m.test(tpl),
      'AC2.1: design.template.md có cả hai dạng mẫu');
  }

  // 3. Workflow template qua validator workflow hiện có.
  {
    const tpl = tplOf('workflow');
    ok(tpl !== '', 'template workflow đọc được qua mục lục');
    const errs = checkWorkflowBody(tpl);
    ok(errs.length === 0, `template workflow PASS checkWorkflowBody${errs.length ? ' — ' + errs.join('; ') : ''}`);
    ok(missingAnchors(tpl).length === 0, 'template workflow chứa mọi dòng neo WF_ANCHORS');
    const keys = Object.fromEntries(Object.keys(parseFrontmatter(tpl).meta).map((k) => [k, true]));
    const kerrs = checkSourceKeys('workflow', keys);
    ok(Object.keys(keys).length > 0 && kerrs.length === 0, `template workflow: khoá frontmatter trong allowlist${kerrs.length ? ' — ' + kerrs.join('; ') : ''}`);
  }

  // 3b. Skill template: bản đã điền qua validator skill; bản thô giữ các điểm tiến hoá (checklist, vòng validate, 500 dòng, một tầng).
  {
    const raw = tplOf('skill');
    ok(raw !== '', 'template skill đọc được qua mục lục');
    const FILL = {
      '<skill-id>': 'demo-skill',
      '<Hành động một câu, ≤ 200 ký tự>': 'Soạn bản nháp mẫu cho một tình huống cụ thể.',
      '<trigger 1>': 'soạn mẫu một', '<trigger 2>': 'soạn mẫu hai', '<trigger 3>': 'soạn mẫu ba',
      '<tình huống>': 'cần việc khác',
      '<id-skill-khác>': 'git-workflow',
      '<n>': '9',
      '<Tiêu đề skill>': 'Demo Skill — mẫu',
      '<plan|execute>': 'plan',
    }; // placeholder còn lại (heading, checklist) điền 'mẫu'.
    const body = stripTemplateHeader(raw);
    const filled = body.replace(/<[^<>\n]+>/g, (p) => FILL[p] ?? 'mẫu');
    const fm = parseFrontmatter(filled);
    ok(fm.meta.name === 'demo-skill', 'template skill: frontmatter đọc được ở dòng 1 sau khi bỏ header');
    ok(parseFrontmatter(raw).meta.name === '<skill-id>', 'template skill: frontmatter đọc được khi header còn nguyên');
    const bodyErrs = checkSkillBody(fm.body);
    ok(bodyErrs.length === 0, `template skill (đã điền) PASS checkSkillBody${bodyErrs.length ? ' — ' + bodyErrs.join('; ') : ''}`);
    const ids = new Set([...core.stages.map((x) => x.id), ...plugins.flatMap((p) => p.stages.map((x) => x.id)),
      ...(workflows ? workflows.stages.map((x) => x.id) : []), ...allAgents.map((a) => a.id)]);
    const dErrs = checkDescription(fm.meta.description ?? '', ids, fm.meta.name);
    ok(dErrs.length === 0, `template skill (đã điền) PASS checkDescription${dErrs.length ? ' — ' + dErrs.join('; ') : ''}`);
    const sErrs = checkDescriptionStyle(fm.meta.description ?? '');
    ok(sErrs.length === 0, `template skill (đã điền) PASS checkDescriptionStyle${sErrs.length ? ' — ' + sErrs.join('; ') : ''}`);
    const kErrs = checkSourceKeys('skill', fm.meta);
    ok(Object.keys(fm.meta).length > 0 && kErrs.length === 0, `template skill: khoá frontmatter trong allowlist${kErrs.length ? ' — ' + kErrs.join('; ') : ''}`);
    for (const [needle, what] of [['- [ ]', 'checklist trong quy trình'], ['500 dòng', 'giới hạn SKILL.md 500 dòng'], ['một tầng', 'reference sâu một tầng']]) {
      ok(raw.includes(needle), `template skill (thô) có ${what}`);
    }
    ok(/validate[^\n]*→[^\n]*sửa[^\n]*→[^\n]*validate/i.test(raw), 'template skill (thô) có vòng validate → sửa → validate');
    ok(!fs.existsSync(path.join(path.dirname(CORE_DIR), 'templates', 'skills')), 'templates/skills/ đã bị xóa');
  }

  // 3c. Agent template: bản đã điền qua validator agent; bản thô giữ 3 tầng Phạm vi, Khi được gọi, bảng Report.
  {
    const raw = tplOf('agent');
    ok(raw !== '', 'template agent đọc được qua mục lục');
    const FILL = {
      '<plugin>': 'demo', '<slug>': 'agent',
      '<read-only|write>': 'write',
      '<Read, Edit, Write, Bash, Grep, Glob, Skill>': 'Read, Edit, Write, Bash, Grep, Glob, Skill',
      '<skill-1>': 'git-workflow', '<skill-2>': 'principles',
      '<n>': '30',
      '<glob/**>': 'src/**',
      '<Vai trò một câu, ≤ 200 ký tự>': 'Sửa mẫu trong một thư mục được giao',
      '<điều kiện gọi agent>': 'workflow cần một bước sửa mẫu',
    }; // placeholder còn lại (đầu vào, bước, dòng Report) điền 'mẫu'.
    const filled = stripTemplateHeader(raw).replace(/<[^<>\n]+>/g, (p) => FILL[p] ?? 'mẫu');
    const fm = parseFrontmatter(filled);
    ok(fm.meta.name === 'demo-agent', 'template agent: frontmatter đọc được ở dòng 1 sau khi bỏ header');
    ok(parseFrontmatter(raw).meta.name === '<plugin>-<slug>', 'template agent: frontmatter đọc được khi header còn nguyên');
    const agent = { mode: fm.meta.mode, skills: splitList(fm.meta.skills), tools: splitList(fm.meta.tools), writeScope: splitList(fm.meta.writeScope) };
    ok(agent.tools.length > 0 && agent.writeScope.length > 0, 'template agent (đã điền): khai tools và writeScope');
    const tErrs = checkAgentTools(agent);
    ok(tErrs.length === 0, `template agent (đã điền) PASS checkAgentTools${tErrs.length ? ' — ' + tErrs.join('; ') : ''}`);
    const mErrs = ctx.checkAgentModel({ id: 'demo-agent', model: fm.meta.model || null, effort: fm.meta.effort || null, body: fm.body || '' });
    ok(mErrs.length === 0, `AC1.1: template agent khai model${mErrs.length ? ' — ' + mErrs.join('; ') : ''}`);
    const dErrs = checkAgentDescription(fm.meta.description ?? '');
    ok(dErrs.length === 0, `template agent (đã điền) PASS checkAgentDescription${dErrs.length ? ' — ' + dErrs.join('; ') : ''}`);
    const kErrs = checkSourceKeys('agent', fm.meta);
    ok(Object.keys(fm.meta).length > 0 && kErrs.length === 0, `template agent: khoá frontmatter trong allowlist${kErrs.length ? ' — ' + kErrs.join('; ') : ''}`);
    for (const h of ['Vai trò', 'Phạm vi', 'Quy trình', 'Report trả về']) ok(fm.body.includes(`## ${h}`), `template agent (đã điền): có heading "## ${h}"`);
    const section = (h) => (raw.split(new RegExp(`^## ${h}\\s*$`, 'm'))[1] ?? '').split(/^## /m)[0];
    const scope = section('Phạm vi');
    for (const t of ['**Luôn làm:**', '**Hỏi trước:**', '**Không bao giờ:**']) ok(scope.includes(t), `template agent: Phạm vi có tầng ${t}`);
    const proc = section('Quy trình');
    ok(proc.trimStart().startsWith('Khi được gọi:'), 'template agent: Quy trình mở bằng "Khi được gọi:"');
    ok(/chạy[^\n]*→[^\n]*sửa[^\n]*→[^\n]*chạy/i.test(proc), 'template agent: Quy trình có bước kiểm chứng chạy → sửa → chạy lại');
    const rep = section('Report trả về');
    for (const r of ['Kết quả', 'Evidence', 'File đã đổi', 'Rủi ro còn lại']) ok(rep.includes(`| ${r} |`), `template agent: Report có dòng "| ${r} |"`);
    ok(rep.includes('agent_result'), 'SWC AC1.2: template agent: Report trỏ tới agent_result');
  }

  // 3d. Requirement / design / plan: validator là scripts/check-request.mjs (cảnh báo cấu trúc AC); ở đây pin thêm heading và mẫu dòng.
  {
    const heads = (t) => t.split('\n').filter((l) => /^#{1,3} /.test(l)).map((l) => l.trimEnd());
    const req = tplOf('requirement');
    ok(req !== '', 'template requirement đọc được qua mục lục');
    for (const h of ['Yêu cầu gốc', 'Bối cảnh', 'Ràng buộc', 'Tiêu chí chấp nhận', 'Không đổi (bugfix)']) {
      ok(heads(req).includes(`## ${h}`), `template requirement: có heading "## ${h}"`);
    }
    ok(req.includes('Hệ thống PHẢI'), 'template requirement: câu requirement dạng "Hệ thống PHẢI …"');
    ok(req.includes('**AC1.1** — Given'), 'template requirement: AC dạng "**AC1.1** — Given … When … Then …"');
    ok(/Given [^\n]*When [^\n]*Then /.test(req), 'template requirement: dòng AC đủ Given/When/Then');

    const design = tplOf('design');
    ok(design !== '', 'template design đọc được qua mục lục');
    for (const h of ['Vấn đề và lý do', 'Quyết định đã chốt', 'Tiêu chí chấp nhận', 'Thiết kế', 'Ngoài phạm vi và anti-goal', 'Ràng buộc', 'Kiểm thử', 'Để builder quyết', 'Rủi ro và câu hỏi mở']) {
      ok(heads(design).includes(`## ${h}`), `template design: có heading "## ${h}"`);
    }
    for (const m of ['- Ngày:', '- Trạng thái:', '- Requirement:']) ok(design.includes(m), `template design: có dòng "${m}"`);

    const plan = tplOf('plan');
    ok(plan !== '', 'template plan đọc được qua mục lục');
    ok(plan.includes('REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development'), 'template plan: header bắt buộc của writing-plans');
    for (const m of ['**Goal:**', '**Architecture:**', '**Tech Stack:**', '**Spec:** design.md', '**Requirement:**', '**Phủ AC:**']) {
      ok(plan.includes(m), `template plan: có "${m}"`);
    }
    for (const h of ['Global Constraints', 'Review Focus']) ok(heads(plan).includes(`## ${h}`), `template plan: có heading "## ${h}"`);
    ok(/^### Task 1: /m.test(plan), 'template plan: có khung "### Task 1: …"');
    ok(!/Phase/.test(plan), 'template plan: không còn khung Phase');

    const specStructure = read(path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-spec-writing', 'references', 'spec-structure.md'));
    ok(!specStructure.includes('Phase/Task'), 'spec-structure.md: không còn "Phase/Task"');
    ok(specStructure.includes('artifact-templates'), 'spec-structure.md: plan.md trỏ tới template plan của artifact-templates');
  }

  // 3e. ADR (MADR 4.0, tiếng Việt) + project-knowledge + skill/agent đọc ADR trỏ về template core.
  {
    const heads = (t) => t.split('\n').filter((l) => /^#{1,3} /.test(l)).map((l) => l.trimEnd());
    const adr = tplOf('adr');
    ok(adr !== '', 'template adr đọc được qua mục lục');
    for (const h of ['## Bối cảnh và vấn đề', '## Yếu tố quyết định', '## Các phương án', '## Kết quả quyết định', '### Hệ quả', '### Xác nhận', '## Ưu nhược từng phương án']) {
      ok(heads(adr).includes(h), `template adr: có heading "${h}"`);
    }
    for (const m of ['- Trạng thái:', '- Ngày:', '- Người quyết định:']) ok(adr.includes(m), `template adr: có dòng metadata "${m}"`);

    const pkRow = index.find((r) => r.type === 'project-knowledge');
    ok(!!pkRow && pkRow.isDir === true, 'mục lục: project-knowledge là dòng thư mục');
    const pkDir = path.join(path.dirname(skillFile), 'references', 'project-knowledge');
    for (const n of ['project-overview.md', 'domain-context.md', 'architecture.md', 'source-structure.md', 'code-convention.md', 'tech-stack.yml']) {
      ok(fs.existsSync(path.join(pkDir, n)), `references/project-knowledge/${n} tồn tại`);
    }
    ok(fs.existsSync(path.join(pkDir, 'tech-stack.yml')) && templateHeader(fs.readFileSync(path.join(pkDir, 'tech-stack.yml'), 'utf8')) === null, 'tech-stack.yml: không có khối header');
    ok(skillText.includes('references/project-knowledge/') && skillText.includes('tech-stack.yml'), 'SKILL.md: mục lục và bản đồ tài liệu nhắc project-knowledge/tech-stack.yml');

    for (const rel of ['skills/engineering-adr/SKILL.md', 'skills/engineering-adr/references/adr-structure.md', 'agents/engineering-spec-analyst.md']) {
      const t = read(path.join(PLUGINS_DIR, 'engineering', rel));
      ok(!t.includes('Nygard'), `engineering/${rel}: không còn "Nygard"`);
      ok(t.includes('MADR') && t.includes('artifact-templates'), `engineering/${rel}: nhắc MADR và trỏ tới artifact-templates`);
    }
    const initDir = path.join(path.dirname(CORE_DIR), 'templates', 'init');
    for (const n of ['0001-vi-du-quyet-dinh.md', '0002-code-convention.md']) {
      const t = read(path.join(initDir, 'docs', 'decisions', n));
      ok(t.includes('## Bối cảnh và vấn đề') && t.includes('## Kết quả quyết định'), `ADR ví dụ ${n}: theo khung MADR tiếng Việt`);
    }
    for (const gone of ['project-knowledge', 'docs/decisions/_TEMPLATE.md']) {
      ok(!fs.existsSync(path.join(initDir, gone)), `templates/init/${gone} đã bị xóa`);
    }
  }

  // 3f. Task: bản thô giữ khung chung + header task; bản điền mẫu UC01 qua check-tasks.mjs; skill task-breakdown trỏ về core.
  {
    const raw = tplOf('task');
    ok(raw !== '', 'template task đọc được qua mục lục');
    const tbDir = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-task-breakdown');
    for (const h of ['## 2. Use case', '## 3. Bảng tổng task', '## 5. Chi tiết task', '## 6. Câu hỏi mở & giả định']) {
      ok(raw.includes(h), `template task (thô): có heading "${h}"`);
    }
    ok(['CT', 'DB', 'BE', 'FE-UI', 'FE-INT', 'E2E'].every((t) => raw.includes(`| \`${t}\` |`)), 'template task (thô): bảng đủ 6 loại task');
    ok(['**Ngữ cảnh:**', '**Acceptance criteria:**', '**File dự kiến:**', '**Lệnh verify:**', '**DoD:**'].every((m) => raw.includes(m)),
      'template task (thô): header task đủ Ngữ cảnh/AC/File dự kiến/Lệnh verify/DoD');
    ok(raw.includes('N/A — <lý do>') && raw.includes('[giả định]') && raw.includes('Chỉ sinh loại cần'), 'template task (thô): quy tắc N/A, [giả định], chỉ sinh loại cần');

    const checkScript = path.join(tbDir, 'scripts', 'check-tasks.mjs');
    const tb = await import(pathToFileURL(checkScript).href);
    const items = (p, n) => Array.from({ length: n }, (_, i) => `- **${p}${i + 1}. Mục:** x`).join('\n');
    // Điền mẫu UC01: bảng tổng của template có sẵn dòng CT/BE/FE-UI/FE-INT; khối chi tiết BE của template được nhân cho
    // CT/FE-UI/FE-INT (đổi ID, anchor, Loại) và thêm mục riêng theo loại (B1–B10, F1–F9) để check-tasks đọc đủ 4 task.
    const body = stripTemplateHeader(raw);
    const marker = body.match(/^<mục riêng theo loại[^\n]*>$/m)?.[0] ?? '';
    const bStart = body.indexOf('<a id="uc01-be-01"></a>');
    ok(marker !== '' && bStart >= 0 && bStart < body.indexOf(marker), 'template task (thô): có khối chi tiết UC01-BE-01 và dòng "mục riêng theo loại"');
    const beBlock = body.slice(bStart, body.indexOf(marker));
    const clone = (id, type, tail) => beBlock
      .replace(/uc01-be-01/g, id.toLowerCase()).replace(/UC01-BE-01/g, id)
      .replace('| Loại | BE |', `| Loại | ${type} |`) + tail;
    const feTail = `#### Frontend\n\n${items('F', 9)}\n\n`;
    const extra = [
      clone('UC01-CT-01', 'CT', '#### Contract\n\n- **Endpoint cần chốt:** x\n\n'),
      clone('UC01-FE-01', 'FE-UI', feTail),
      clone('UC01-FE-02', 'FE-INT', feTail),
    ].join('');
    const filled = body
      .replace(marker, () => `#### Backend\n\n${items('B', 10)}\n\n${extra}`)
      .replace(/<[^<>\n]+>/g, (p) => (/^<a id=|^<\/a>$/.test(p) ? p : 'mẫu'));
    const model = tb.parseTasks(filled);
    const res = tb.checkTasks(model);
    const probs = [...res.errors, ...res.warnings].map((p) => `${p.code} ${p.msg}`).join(' | ');
    ok(res.errors.length === 0 && res.warnings.length === 0, `template task (điền mẫu UC01) PASS check-tasks${probs ? ' — ' + probs : ''}`);
    ok(model.useCases.length === 1 && model.tasks.length === 4 && model.details.length === 4, 'template task (điền mẫu): đọc được 1 use case, 4 task, 4 chi tiết');
    ok(JSON.stringify(model.tasks.map((t) => [t.id, t.type])) === JSON.stringify([['UC01-CT-01', 'CT'], ['UC01-BE-01', 'BE'], ['UC01-FE-01', 'FE-UI'], ['UC01-FE-02', 'FE-INT']]),
      'template task (điền mẫu): bảng tổng có CT, BE, FE-UI, FE-INT với ID khớp Loại');

    const skill = read(path.join(tbDir, 'SKILL.md'));
    ok(skill.includes('artifact-templates') && !skill.includes('task-template-common.md'), 'engineering-task-breakdown SKILL.md: trỏ artifact-templates, không còn task-template-common.md');
    ok(!fs.existsSync(path.join(tbDir, 'references', 'task-template-common.md')), 'engineering-task-breakdown: task-template-common.md đã bị xóa');
    for (const rel of ['references/output-formats.md', 'references/breakdown-checklist.md', 'references/task-template-backend.md']) {
      const t = read(path.join(tbDir, rel));
      ok(!t.includes('task-template-common') && t.includes('artifact-templates'), `engineering-task-breakdown/${rel}: trỏ template task của artifact-templates`);
    }
    ok(!read(path.join(tbDir, 'references', 'output-formats.md')).includes('## 6. Câu hỏi mở & giả định'), 'output-formats.md: khung tasks.md chung không còn lặp lại');
  }

  // 4. Chính skill artifact-templates qua validator skill.
  {
    const s = core.stages.find((x) => x.id === 'artifact-templates');
    ok(!!s, 'loadCore: có skill artifact-templates');
    if (s) {
      const bodyErrs = checkSkillBody(s.body);
      ok(bodyErrs.length === 0, `artifact-templates: khung H2${bodyErrs.length ? ' — ' + bodyErrs.join('; ') : ''}`);
      const ids = new Set([...core.stages.map((x) => x.id), ...plugins.flatMap((p) => p.stages.map((x) => x.id)),
        ...(workflows ? workflows.stages.map((x) => x.id) : []), ...allAgents.map((a) => a.id)]);
      const dErrs = checkDescription(s.description, ids, s.id);
      ok(dErrs.length === 0, `artifact-templates: description${dErrs.length ? ' — ' + dErrs.join('; ') : ''}`);
      const stErrs = checkDescriptionStyle(s.description);
      ok(stErrs.length === 0, `artifact-templates: description đúng mẫu${stErrs.length ? ' — ' + stErrs.join('; ') : ''}`);
      ok(s.body.split('\n').length < 500, 'artifact-templates: SKILL.md dưới 500 dòng');
    }
  }

  // 5. Cowork: zip chỉ chứa skill có trong _cowork.json, nên skill nhắc artifact-templates cần core:artifact-templates đi cùng.
  {
    const ids = coworkSkillIds();
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : (/\.(md|mjs)$/.test(e.name) ? [p] : []);
    });
    const dependents = ids.filter((id) => id !== 'core:artifact-templates').filter((id) => {
      const [plugin, skill] = id.split(':');
      const dir = plugin === 'core' ? path.join(CORE_DIR, 'skills', skill) : path.join(PLUGINS_DIR, plugin, 'skills', skill);
      return fs.existsSync(dir) && walk(dir).some((f) => read(f).includes('artifact-templates'));
    });
    ok(dependents.length > 0, 'Cowork: có skill nhắc artifact-templates (điều kiện của kiểm tra bên dưới không rỗng)');
    ok(ids.includes('core:artifact-templates'),
      `Cowork: core:artifact-templates có trong _cowork.json (cần cho ${dependents.join(', ')})`);
  }

  // 6. check-request.mjs: truy vết AC → test (W7–W9, --tests, --strict).
  {
    const cr = await import(pathToFileURL(path.join(CORE_DIR, 'skills', 'artifact-templates', 'scripts', 'check-request.mjs')).href);
    const tick = (p) => '`' + p + '`';
    const DESIGN = ['# Thiết kế', '## 3. Tiêu chí chấp nhận',
      '- [ ] **AC1.1** — Given a When b Then c', '- [ ] **AC1.2** — Given c When d Then e', '- [ ] **AC1.10** — Given e When f Then g', ''].join('\n');
    const FILES = ['**Files:**', `- Modify: ${tick('src/a.mjs:10-20')}`, `- Test: ${tick('test/a.contract.mjs:5')}`, `- Create: ${tick('tests/b_test.py')}`];
    const planOf = (files) => ['# Plan', '**Goal:** x', '**Spec:** design.md', '**Phủ AC:** AC1.1, AC1.2, AC1.10', '', ...files, ''].join('\n');
    const PLAN = planOf(FILES);
    const TESTS = { 'test/a.contract.mjs': "ok(x, 'AC1.10: …')", 'tests/b_test.py': 'def test_ac1_2_rejects(): pass' };
    const reader = (m) => (p) => (Object.hasOwn(m, p) ? m[p] : null);
    const check = (plan, m, extra = {}) => cr.checkRequest({ 'design.md': DESIGN, 'plan.md': plan }, { readTest: reader(m), ...extra });
    const of = (ws, code) => ws.filter((w) => w.code === code);
    const quiet = (fn) => {
      const log = console.log; const err = console.error; const out = [];
      console.log = (...a) => out.push(a.join(' ')); console.error = () => {};
      try { return { code: fn(), out }; } finally { console.log = log; console.error = err; }
    };

    const w7 = of(check(PLAN, TESTS), 'W7');
    ok(w7.length === 1 && w7[0].file === 'design.md' && w7[0].line === 3 && w7[0].msg.includes('AC1.1 '),
      'AC2.1: AC không có trong file test của plan → W7 tại dòng AC');
    ok(w7.every((w) => !w.msg.includes('AC1.2') && !w.msg.includes('AC1.10')),
      'AC2.2: AC1.10 không phủ AC1.1; test_ac1_2_* phủ AC1.2');
    ok(of(check(PLAN, { ...TESTS, 'tests/b_test.py': 'void testAc1_2Rejects()' }), 'W7').every((w) => !w.msg.includes('AC1.2')),
      'AC2.2: testAc1_2* phủ AC1.2');
    ok([...cr.acIdsIn('AC1.2 ac1_2 Ac1.2 AC1.20 xAC3_4')].sort().join() === 'AC1.2,AC1.20,AC3.4',
      'AC2.2: acIdsIn chuẩn hóa ID, không khớp một phần số');

    const noTest = check(planOf([FILES[0], FILES[1]]), TESTS);
    ok(of(noTest, 'W8').length === 1 && of(noTest, 'W7').length === 0 && of(noTest, 'W8')[0].line === 6,
      'AC2.6: plan có **Files:** nhưng không file test → W8, không W7');
    const w9 = of(check(PLAN, { 'test/a.contract.mjs': TESTS['test/a.contract.mjs'] }), 'W9');
    ok(w9.length === 1 && w9[0].file === 'plan.md' && w9[0].line === 9 && w9[0].msg.includes('tests/b_test.py'),
      'AC2.6: file test ghi trong plan chưa tồn tại → W9');
    const planTime = check(PLAN, {});
    ok(of(planTime, 'W9').length === 2 && of(planTime, 'W7').length === 0,
      'AC2.6: không file test nào của plan đọc được (lúc lập plan) → W9 từng file, không W7');

    const pt = (line) => cr.planTestPaths(`**Files:**\n${line}\n`).entries.map((e) => e.path);
    const cases = [
      ['- Modify: ', 'src/a.mjs', []], ['- Modify: ', 'src/a.mjs:10-20', []],
      ['- Create: ', 'test/x.mjs', ['test/x.mjs']], ['- Create: ', 'tests/x.py', ['tests/x.py']],
      ['- Create: ', 'src/__tests__/x.ts', ['src/__tests__/x.ts']], ['- Create: ', 'spec/x.rb', ['spec/x.rb']],
      ['- Create: ', 'a.test.ts', ['a.test.ts']], ['- Create: ', 'a.spec.js', ['a.spec.js']],
      ['- Create: ', 'a_test.go', ['a_test.go']], ['- Create: ', 'test_a.py', ['test_a.py']],
      ['- Create: ', 'FooTest.java', ['FooTest.java']], ['- Test: ', 'qa/x.feature', ['qa/x.feature']],
      ['- Test: ', 'qa/x.feature:3-9', ['qa/x.feature']], ['- Create: ', 'test/a.mjs:5-9', ['test/a.mjs']],
      ['- Create: ', 'test/a.mjs:15,342', ['test/a.mjs']], ['- Create: ', 'test/a.mjs:15-16,42-50', ['test/a.mjs']],
    ];
    for (const [lead, p, want] of cases) {
      ok(JSON.stringify(pt(lead + tick(p))) === JSON.stringify(want), `AC2.6: planTestPaths ${lead}${p}`);
    }
    const same = cr.planTestPaths(`# P\n**Files:** ${tick('test/a.mjs')}\n`);
    ok(same.hasFiles && same.entries.length === 1 && same.entries[0].path === 'test/a.mjs' && same.entries[0].line === 2,
      'AC2.6: planTestPaths nhận file test cùng dòng **Files:**');
    const none = cr.planTestPaths('# P\n**Goal:** x\n');
    const noFiles = check('# Plan\n**Goal:** x\n**Spec:** design.md\n**Phủ AC:** AC1.1, AC1.2, AC1.10\n', {});
    ok(none.hasFiles === false && none.entries.length === 0 && !noFiles.some((w) => ['W7', 'W8', 'W9'].includes(w.code)),
      'AC2.6: plan không có **Files:** → hasFiles=false, không W7/W8/W9');

    const ov = check(planOf([FILES[0], FILES[1]]), { 'qa/': 'AC1.1 AC1.2 AC1.10' }, { override: ['qa/'] });
    ok(ov.length === 0, 'AC2.7: override thay phạm vi plan, không W8/W9');
    ok(of(check(PLAN, { 'qa/': 'AC1.1 AC1.2 AC1.10' }, { override: ['qa/'] }), 'W9').length === 0,
      'AC2.7: override không đọc danh sách file test của plan');

    const tmp = fs.mkdtempSync(path.join(ctx.os.tmpdir(), 'check-request-tests-'));
    try {
      const put = (rel, data) => {
        const p = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, data);
      };
      fs.mkdirSync(path.join(tmp, '.git'));
      const dir = path.join(tmp, 'docs', 'requests', 'r');
      // main cấp readSpec nên W10 chạy; fixture có mục ảnh hưởng để các kiểm --strict vẫn chỉ nói về W7–W9.
      put('docs/requests/r/design.md', DESIGN + '- [ ] **AC2.1** — Given h When i Then j\n## Ảnh hưởng spec\nKhông ảnh hưởng: fixture\n');
      put('docs/requests/r/plan.md', ['# Plan', '**Goal:** x', '**Spec:** design.md', '**Phủ AC:** AC1.1, AC1.2, AC1.10, AC2.1', '', '**Files:**', `- Test: ${tick('test/')}`, ''].join('\n'));
      put('test/sub/a.mjs', 'AC1.1 AC1.2 AC1.10');
      for (const f of ['test/node_modules/x.js', 'test/build/y.js']) put(f, 'AC2.1');
      put('test/bin.dat', Buffer.concat([Buffer.from([0]), Buffer.from('AC2.1')]));
      const r = quiet(() => cr.main([dir]));
      const w7s = r.out.filter((l) => l.includes('[W7]'));
      ok(r.code === 0 && w7s.length === 1 && w7s[0].includes('AC2.1') && r.out.every((l) => !l.includes('[W8]') && !l.includes('[W9]')),
        'AC2.3: quét thư mục đệ quy, bỏ thư mục loại trừ và file nhị phân');

      ok(quiet(() => cr.main([dir, '--strict'])).code === 1, 'AC2.4: --strict exit 1 khi có cảnh báo');
      ok(quiet(() => cr.main([dir])).code === 0, 'AC2.4: không cờ → vẫn exit 0 khi có cảnh báo');
      put('test/sub/c.mjs', 'AC2.1');
      ok(quiet(() => cr.main([dir, '--strict'])).code === 0, 'AC2.4: --strict exit 0 khi sạch');
      fs.rmSync(path.join(tmp, 'test', 'sub', 'c.mjs'));
      put('qa/all.mjs', 'AC1.1 AC1.2 AC1.10 AC2.1');
      ok(quiet(() => cr.main([dir, '--tests', path.join(tmp, 'qa'), '--strict'])).code === 0,
        'AC2.7: --tests <path> thay phạm vi plan');
      for (const bad of [[dir, '--tests'], [dir, '--bogus'], [dir, dir], [dir, '--tests', 'không-có-xyz'], [dir, '--tests', '--strict']]) {
        ok(quiet(() => cr.main(bad)).code === 2, `AC2.4: đối số sai → exit 2 (${bad.slice(1).join(' ')})`);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}
