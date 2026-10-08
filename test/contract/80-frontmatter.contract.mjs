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
      fs.writeFileSync(path.join(dir, 'skills', 'demo', 'SKILL.md'), '---\nname: demo\nargument-hint: [PR]\n---\nx\n');
      msg = '';
      try { loadSkillsFrom(dir); } catch (e) { msg = String(e.message); }
      ok(msg.includes('argument-hint') && msg.includes('SKILL.md'), 'loader: argument-hint không quote (thành list) → ném lỗi nêu khoá + file');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // Task 2: passthrough skill theo provider
  {
    const { claudeAdapter, codexAdapter, cursorAdapter, fxCore, fxMk, byPath, checkPassthroughTypes, SOURCE_KEYS } = ctx;
    ok(SOURCE_KEYS.skill.includes('disable-model-invocation') && SOURCE_KEYS.workflow.includes('argument-hint')
      && !SOURCE_KEYS.skill.includes('when_to_use'), 'SOURCE_KEYS: skill nhận khoá passthrough (không có when_to_use), workflow nhận argument-hint');
    ok(checkPassthroughTypes({ 'argument-hint': ['PR'] }).length === 1, 'checkPassthroughTypes: argument-hint là list (quên quote "[...]") → lỗi');
    ok(checkPassthroughTypes({ 'disable-model-invocation': 'true' }).length === 1, 'checkPassthroughTypes: cờ boolean viết dạng chuỗi → lỗi');
    ok(checkPassthroughTypes({ 'allowed-tools': ['Read'], paths: 'src/**', metadata: { a: 1 }, effort: 'high' }).length === 0,
      'checkPassthroughTypes: kiểu hợp lệ → không lỗi');
    ok(checkPassthroughTypes({ effort: 'huge' }).length === 1, 'checkPassthroughTypes: effort ngoài low|medium|high|xhigh|max → lỗi');
    const stage = { id: 'fx-init', title: '', description: 'Fixture init. Dùng khi người dùng muốn "a", "b", "c". Không dùng khi x → fx-other.',
      body: '## Quy trình\nx\n', passthrough: { 'argument-hint': '[path]', 'disable-model-invocation': true, paths: ['src/**'] },
      assets: [], fileAssets: [], dirAssets: [], assetsDir: '' };
    const fx = { id: 'fx', name: 'Fx', description: 'Fx', version: '1.0.0', shared: { principles: 'P\n' }, stages: [stage], agents: [] };
    const cl = byPath(claudeAdapter.build([fx], { marketplace: fxMk, core: fxCore }));
    const clMd = cl.get('plugins/fx/skills/fx-init/SKILL.md').content;
    ok(clMd.includes('argument-hint: "[path]"') && clMd.includes('disable-model-invocation: true') && clMd.includes('paths:\n  - src/**'),
      'claude skill: chiếu argument-hint, disable-model-invocation, paths');
    ok(cl.get('plugins/fx/skills/fx-principles/SKILL.md').content.includes('user-invocable: false')
      && cl.get('plugins/core/skills/principles/SKILL.md').content.includes('user-invocable: false'),
      'claude: skill principles (core + plugin) có user-invocable: false');
    const cw = byPath(claudeAdapter.build([fx], { marketplace: fxMk, core: fxCore, skillKeys: [] }));
    const cwMd = cw.get('plugins/fx/skills/fx-init/SKILL.md').content;
    ok(!cwMd.includes('argument-hint') && !cw.get('plugins/core/skills/principles/SKILL.md').content.includes('user-invocable'),
      'claude skillKeys: [] (gói Cowork): chỉ name + description');
    const cx = byPath(codexAdapter.build([fx], { core: fxCore }));
    const cxFm = cx.get('fx/skills/fx-init/SKILL.md').content.split('\n---')[0];
    ok(!cxFm.includes('argument-hint') && !cxFm.includes('disable-model-invocation'), 'codex skill: chỉ name + description');
    const cu = byPath(cursorAdapter.build([fx], { core: fxCore }));
    const cuMd = cu.get('fx/.cursor/skills/fx-init/SKILL.md').content;
    ok(cuMd.includes('disable-model-invocation: true') && cuMd.includes('paths:') && !cuMd.includes('argument-hint'),
      'cursor skill: chỉ paths, disable-model-invocation, metadata');
  }

  {
    const { fs, path, claudeDir, claudeSkillDir, plugins } = ctx;
    if (fs.existsSync(claudeDir)) {
      const fmOf = (p) => (fs.readFileSync(p, 'utf8').match(/^---\n([\s\S]*?)\n---/) || ['', ''])[1];
      for (const p of plugins) for (const s of p.stages.filter((x) => x.id.endsWith('-init'))) {
        ok(/^disable-model-invocation: true$/m.test(fmOf(path.join(claudeSkillDir(p.id, s.id), 'SKILL.md'))),
          `build claude ${s.id}: disable-model-invocation: true (D2)`);
      }
      for (const p of plugins) {
        const f = path.join(claudeDir, 'plugins', p.id, 'skills', `${p.id}-principles`, 'SKILL.md');
        if (fs.existsSync(f)) ok(/^user-invocable: false$/m.test(fmOf(f)), `build claude ${p.id}-principles: user-invocable: false`);
      }
      const hinted = plugins.flatMap((p) => p.stages.filter((s) => s.passthrough['argument-hint']).map((s) => [p.id, s.id]));
      ok(hinted.length >= 9, `có ≥ 9 skill khai báo argument-hint (=${hinted.length})`);
      for (const [pid, sid] of hinted) {
        ok(/^argument-hint: ".+"$/m.test(fmOf(path.join(claudeSkillDir(pid, sid), 'SKILL.md'))), `build claude ${sid}: argument-hint`);
      }
    }
  }

  // Task 3: agent passthrough
  {
    const { claudeAdapter, codexAdapter, fxPlugin, fxAgent, fxCore, fxMk, byPath, checkAgentTools, SOURCE_KEYS } = ctx;
    ok(['tools', 'maxTurns', 'isolation'].every((k) => SOURCE_KEYS.agent.includes(k)) && !SOURCE_KEYS.agent.includes('permissionMode'),
      'SOURCE_KEYS.agent: có tools/maxTurns/isolation, không có permissionMode (bị bỏ qua với agent plugin)');
    const ag = { ...fxAgent, skills: ['fx/fx-review', 'fx/fx-extra'], tools: ['Read', 'Grep', 'Glob', 'Skill'], maxTurns: 20, isolation: null };
    const md = byPath(claudeAdapter.build([{ ...fxPlugin, agents: [ag] }], { marketplace: fxMk, core: fxCore }))
      .get('plugins/fx/agents/fx-reviewer.md').content;
    ok(md.includes('tools: Read, Grep, Glob, Skill') && md.includes('skills:\n  - fx-review\n') && !md.includes('- fx-extra'),
      'claude agent: tools chuỗi phẩy + skills preload chỉ skill đầu (tên trần)');
    ok(md.includes('maxTurns: 20') && !md.includes('isolation:'), 'claude agent: maxTurns khi có, bỏ isolation khi null');
    const plain = byPath(claudeAdapter.build([fxPlugin], { marketplace: fxMk, core: fxCore })).get('plugins/fx/agents/fx-reviewer.md').content;
    ok(!/^tools:/m.test(plain) && plain.includes('skills:\n  - fx-review'), 'claude agent: không khai tools → không ghi tools, vẫn preload');
    const toml = byPath(codexAdapter.build([{ ...fxPlugin, agents: [ag] }], { core: fxCore })).get('fx/agents/fx-reviewer.toml').content;
    ok(!/^tools|^skills|^maxTurns/m.test(toml), 'codex agent: không ghi tools/skills/maxTurns');
    ok(checkAgentTools({ mode: 'read-only', skills: ['a/x', 'a/y'], tools: ['Read', 'Edit'] }).length === 2,
      'checkAgentTools: read-only có Edit + thiếu Skill khi > 1 skill → 2 lỗi');
    ok(checkAgentTools({ mode: 'read-only', skills: ['a/x'], tools: [] }).length === 0, 'checkAgentTools: không khai tools → không lỗi');
  }
  {
    const { allAgents } = ctx;
    const ro = allAgents.filter((a) => a.mode === 'read-only');
    ok(ro.length === 5 && ro.every((a) => a.tools.length > 0), 'mọi agent read-only khai báo tools allowlist (W1)');
    for (const a of allAgents) {
      const errs = ctx.checkAgentTools(a);
      ok(errs.length === 0, `${a.id}: tools hợp lệ${errs.length ? ' — ' + errs.join('; ') : ''}`);
    }
    for (const a of allAgents.filter((x) => x.plugin === 'ops')) {
      ok(!a.tools.includes('Bash'), `${a.id}: không có Bash (chỉ đề xuất lệnh)`);
    }
  }

  // Agent dùng skill draft: nhánh adapter agent → drafts/ (build thật không có agent nào kích hoạt nhánh này)
  {
    const { claudeAdapter, fxPlugin, fxAgent, fxCore, fxMk, byPath } = ctx;
    const mkStage = (id) => ({ id, title: '', description: `Fixture ${id}. Dùng khi người dùng muốn "a", "b", "c". Không dùng khi x → fx-other.`,
      body: '## Quy trình\nx\n', passthrough: {}, assets: [], fileAssets: [], dirAssets: [], assetsDir: '' });
    const fx = { ...fxPlugin, stages: [mkStage('a'), mkStage('b')], agents: [{ ...fxAgent, skills: ['fx/b'] }] };
    const split = byPath(claudeAdapter.build([fx], { marketplace: fxMk, core: fxCore, published: { fx: ['fx/a'] } }));
    ok(split.has('plugins/fx/skills/a/SKILL.md') && !split.has('drafts/fx/skills/a/SKILL.md'), 'claude published: skill published nằm ở plugins/');
    ok(split.has('drafts/fx/skills/b/SKILL.md') && !split.has('plugins/fx/skills/b/SKILL.md'), 'claude published: skill draft nằm ở drafts/');
    ok(split.has('drafts/fx/agents/fx-reviewer.md') && !split.has('plugins/fx/agents/fx-reviewer.md'),
      'claude published: agent dùng skill draft nằm ở drafts/, không vào marketplace');
    const all = byPath(claudeAdapter.build([fx], { marketplace: fxMk, core: fxCore, published: null }));
    ok(all.has('plugins/fx/skills/b/SKILL.md') && all.has('plugins/fx/agents/fx-reviewer.md')
      && ![...all.keys()].some((k) => k.startsWith('drafts/')), 'claude published=null: mọi skill/agent nằm ở plugins/');
  }
}
