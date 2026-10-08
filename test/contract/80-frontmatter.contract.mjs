// Contract Phase 2: parser/emitter frontmatter (list, map, boolean) và fail-loud khoá lạ.
export default async function run({ ok, ctx }) {
  const { parseFrontmatter, frontmatter, yamlScalar, checkFrontmatterYaml, splitList } = ctx;

  // Parser: các dạng mới
  {
    const { meta, body } = parseFrontmatter([
      '---',
      'name: x',
      'description: "A: b \\"q\\""',
      'flag: true',
      'off: false',
      'n: 12',
      'nil: null',
      "single: 'it''s'",
      'inline: [Read, "Grep", \'Glob\']',
      'empty: []',
      'block:',
      '  - a',
      '  - "b: c"',
      'meta:',
      '  owner: team',
      '  level: 2',
      '---',
      'Body',
    ].join('\n'));
    ok(meta.name === 'x' && meta.description === 'A: b "q"', 'parseFrontmatter: scalar + chuỗi JSON-quoted');
    ok(meta.flag === true && meta.off === false && meta.n === 12 && meta.nil === null, 'parseFrontmatter: boolean/số/null');
    ok(meta.single === "it's", "parseFrontmatter: chuỗi nháy đơn ('' = ')");
    ok(JSON.stringify(meta.inline) === '["Read","Grep","Glob"]', 'parseFrontmatter: list inline có quote');
    ok(Array.isArray(meta.empty) && meta.empty.length === 0, 'parseFrontmatter: list inline rỗng');
    ok(JSON.stringify(meta.block) === '["a","b: c"]', 'parseFrontmatter: block list');
    ok(JSON.stringify(meta.meta) === '{"owner":"team","level":2}', 'parseFrontmatter: map một cấp');
    ok(body === 'Body', 'parseFrontmatter: body sau frontmatter');
  }
  {
    const crlf = '---\r\nname: x\r\nblock:\r\n  - a\r\n  - b\r\n---\r\nB\r\n';
    const { meta } = parseFrontmatter(crlf);
    ok(meta.name === 'x' && JSON.stringify(meta.block) === '["a","b"]', 'parseFrontmatter: CRLF + block list');
  }
  {
    let threw = false;
    try { parseFrontmatter('---\nname: x\n  - lạc\n---\n'); } catch { threw = true; }
    ok(threw, 'parseFrontmatter: dòng thụt lề không thuộc khoá nào → ném lỗi');
  }
  {
    const { meta } = parseFrontmatter('---\nname: x\ntools:\n- Read\n- Grep\nafter: y\n---\n');
    ok(JSON.stringify(meta.tools) === '["Read","Grep"]' && meta.after === 'y', 'parseFrontmatter: block list không thụt lề → mảng');
  }
  {
    let threw = false;
    try { parseFrontmatter('---\nname: x\nstray\n---\n'); } catch { threw = true; }
    ok(threw, 'parseFrontmatter: dòng cấp cao không có ":" → ném lỗi');
    threw = false;
    try { parseFrontmatter('---\nname: x\n- lạc\n---\n'); } catch { threw = true; }
    ok(threw, 'parseFrontmatter: phần tử list không thuộc khoá nào → ném lỗi');
  }

  // splitList nhận mảng
  ok(JSON.stringify(splitList(['a ', '', 'b'])) === '["a","b"]', 'splitList: nhận mảng, trim + bỏ rỗng');

  // Emitter: list/map + quote chuỗi trông giống kiểu khác
  {
    ok(yamlScalar('true') === '"true"' && yamlScalar('123') === '"123"' && yamlScalar('null') === '"null"',
      'yamlScalar: chuỗi trông như bool/số/null → quote');
    const fm = frontmatter([
      ['name', 'x'], ['tools', ['Read', 'Grep']], ['meta', { owner: 'team', level: 2 }],
      ['empty', []], ['blank', {}], ['flag', false], ['hint', '[PR | branch]'],
    ]);
    ok(fm === ['---', 'name: x', 'tools:', '  - Read', '  - Grep', 'meta:', '  owner: team', '  level: 2',
      'flag: false', 'hint: "[PR | branch]"', '---'].join('\n'), 'frontmatter: list/map/bool, bỏ list/map rỗng');
    const back = parseFrontmatter(`${fm}\n`).meta;
    ok(JSON.stringify(back) === JSON.stringify({ name: 'x', tools: ['Read', 'Grep'], meta: { owner: 'team', level: 2 }, flag: false, hint: '[PR | branch]' }),
      'frontmatter → parseFrontmatter: round-trip giữ nguyên giá trị');
    const inner = fm.split('\n').slice(1, -1).join('\n');
    ok(checkFrontmatterYaml(inner).length === 0, 'checkFrontmatterYaml: chấp nhận dòng con list/map');
    ok(checkFrontmatterYaml('tools:\n  - a: b').length === 1, 'checkFrontmatterYaml: item list plain không an toàn → lỗi');
  }

  // Loader fail-loud: khoá lạ ném lỗi nêu file + khoá
  {
    const { fs, os, path } = ctx;
    const { loadSkillsFrom } = ctx;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-fm-'));
    try {
      fs.mkdirSync(path.join(dir, 'skills', 'demo'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'skills', 'demo', 'SKILL.md'), '---\nname: demo\nrunin: plan\n---\nx\n');
      let msg = '';
      try { loadSkillsFrom(dir); } catch (e) { msg = String(e.message); }
      ok(msg.includes('runin') && msg.includes('SKILL.md'), 'loader: khoá frontmatter lạ → ném lỗi nêu khoá + file');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}
