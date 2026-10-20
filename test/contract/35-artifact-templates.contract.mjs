// Contract artifact-templates: helper khối header, mục lục skill core `artifact-templates` và từng template qua validator của chính nó.
import { TEMPLATES_DIR, templateHeader, stripTemplateHeader, templateIndex } from '../../cli/lib/templates.mjs';

export default async function run({ ok, ctx }) {
  const { fs, path, CORE_DIR, core, plugins, workflows, allAgents, parseFrontmatter, checkWorkflowBody, missingAnchors, checkSourceKeys, checkSkillBody, checkDescription, checkDescriptionStyle } = ctx;
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
  const tplOf = (type) => {
    const row = index.find((r) => r.type === type);
    return row ? read(path.join(path.dirname(skillFile), row.file)) : '';
  };
  for (const row of index) {
    const file = path.join(path.dirname(skillFile), row.file);
    const exists = fs.existsSync(file);
    ok(exists, `mục lục: ${row.type} → ${row.file} tồn tại`);
    if (!exists) continue;
    const h = templateHeader(fs.readFileSync(file, 'utf8'));
    ok(h !== null, `${row.file}: có khối <!-- artifact-template -->`);
    // Header và mục lục lặp cùng thông tin; kiểm lệch để không trôi dần (bỏ dấu backtick của cột Validator).
    ok(!!h && h.validator === row.validator.replace(/`/g, '') && h.sources === row.sources, `${row.file}: header validator/sources khớp dòng mục lục`);
    ok(!!h && h.type === row.type, `${row.file}: header type khớp cột Loại (${row.type})`);
    ok(!!h && Number.isInteger(h.version) && h.validator !== '' && h.sources !== '', `${row.file}: header đủ version/validator/sources`);
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
}
