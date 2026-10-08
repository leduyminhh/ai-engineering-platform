// Contract build output: chuẩn hoá ở tầng adapter, parity references/, cursor và pointer codex.
export default async function run({ ok, ctx }) {
  const { fs, path, loadMarketplace, frontmatter, hasFiles, core, plugins, allAgents, workflows, BUILD, claudeDir, claudeSkillDir, loadPublished, fails } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. BUILD OUTPUT (Claude) — chuẩn hóa ở tầng adapter
  // ─────────────────────────────────────────────────────────────────────────────
  if (fs.existsSync(claudeDir)) {
    const mk = JSON.parse(fs.readFileSync(path.join(claudeDir, '.claude-plugin', 'marketplace.json'), 'utf8'));
    const mkName = loadMarketplace().name;
    ok(mk.name === mkName, `build: marketplace.json name khớp nguồn ("${mkName}")`);
    ok(mk.plugins.some((x) => x.name === 'core'), 'build: marketplace liệt kê core');
    const wfBuilt = !!(workflows && workflows.stages.length);
    ok(mk.plugins.length === plugins.length + 1 + (wfBuilt ? 1 : 0),
      `build: marketplace có ${plugins.length}+1 (core)${wfBuilt ? '+1 (workflows)' : ''} entry`);

    // core plugin
    ok(fs.existsSync(path.join(claudeDir, 'plugins/core/.claude-plugin/plugin.json')), 'build: core plugin.json');
    ok(fs.existsSync(path.join(claudeDir, 'plugins/core/skills/principles/SKILL.md')), 'build: core skill principles');

    // skill dùng chung của core ship như skill plugin core + pointer principles + strip metadata
    for (const s of core.stages) {
      const out = path.join(claudeDir, 'plugins/core/skills', s.id, 'SKILL.md');
      ok(fs.existsSync(out), `build core ${s.id}: có SKILL.md`);
      const content = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
      ok(content.includes('core:principles') && content.includes('`principles`'),
        `build core ${s.id}: pointer principles đủ 2 dạng (phẳng + plugin)`);
      const fmText = content.match(/^---\n([\s\S]*?)\n---/);
      const keys = fmText ? fmText[1].split('\n').filter(Boolean).map((l) => l.split(':')[0].trim()) : [];
      ok(keys.includes('name') && keys.includes('description') && !keys.includes('order'),
        `build core ${s.id}: frontmatter chuẩn Claude (name+description, strip metadata)`);
    }

    for (const p of plugins) {
      const pj = JSON.parse(fs.readFileSync(path.join(claudeDir, 'plugins', p.id, '.claude-plugin/plugin.json'), 'utf8'));
      ok(!!pj.name && !!pj.version && !!pj.description, `build ${p.id}: plugin.json có name/version/description`);
      // Dependency cùng marketplace = TÊN TRẦN "core" (Claude Code không nhận "<mkt>:core").
      ok(Array.isArray(pj.dependencies) && pj.dependencies.includes('core'),
        `build ${p.id}: depends on "core" (tên trần, cùng marketplace)`);

      // shared/principles.md tới Claude qua skill <id>-principles (claude không inline principles)
      if (p.shared.principles && p.shared.principles.trim()) {
        ok(fs.existsSync(path.join(claudeDir, 'plugins', p.id, 'skills', `${p.id}-principles`, 'SKILL.md')),
          `build claude ${p.id}: có skill ${p.id}-principles`);
      }

      // SKILL.md output đã CHUẨN HÓA: chỉ name + description (metadata workflow bị strip ở adapter)
      for (const s of p.stages) {
        const out = path.join(claudeSkillDir(p.id, s.id), 'SKILL.md');
        ok(fs.existsSync(out), `build ${s.id}: có SKILL.md`);
        const content = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
        const fmText = content.match(/^---\n([\s\S]*?)\n---/);
        if (fmText) {
          const keys = fmText[1].split('\n').filter(Boolean).map((l) => l.split(':')[0].trim());
          ok(keys.includes('name') && keys.includes('description'), `build ${s.id}: frontmatter có name+description`);
          ok(!keys.includes('order') && !keys.includes('runsIn'), `build ${s.id}: đã strip metadata workflow (chuẩn Claude)`);
        } else {
          fails.push(`build ${s.id}: SKILL.md thiếu frontmatter`);
        }
        // pointer principles: Claude không auto-load → stage skill phải trỏ tới nguyên tắc nền tảng.
        // Pointer nêu CẢ dạng skill phẳng (principles / <id>-principles) lẫn dạng plugin namespaced
        // (core:principles / <id>:<id>-principles) để đúng với mọi cách cài (aip skills vs marketplace).
        if (p.shared.principles && p.shared.principles.trim()) {
          ok(content.includes(`${p.id}-principles`) && content.includes('core:principles')
            && content.includes(`${p.id}:${p.id}-principles`),
            `build claude ${s.id}: pointer principles đủ cả 2 dạng (phẳng + plugin)`);
          ok(content.includes('`git-workflow`') && content.includes('core:git-workflow'),
            `build claude ${s.id}: pointer git-workflow (phẳng + core:git-workflow)`);
        }
      }
    }

    for (const a of allAgents) {
      const f = [path.join(claudeDir, 'plugins', a.plugin, 'agents', `${a.id}.md`), path.join(claudeDir, 'drafts', a.plugin, 'agents', `${a.id}.md`)].find((x) => fs.existsSync(x)) || path.join(claudeDir, 'plugins', a.plugin, 'agents', `${a.id}.md`);
      ok(fs.existsSync(f), `build claude agent ${a.id}: có file`);
      const c = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      const fmA = (c.match(/^---\n([\s\S]*?)\n---/) || ['', ''])[1];
      ok(fmA.includes(`name: ${a.id}`) && /^disallowedTools: .*\bAgent\b/m.test(fmA),
        `build claude agent ${a.id}: name + chặn tool Agent`);
    }
    // Phase 2 Task 6: marketplace không lộ skill draft (E8)
    {
      const pub = loadPublished();
      const isDraft = (pid, sid) => pid !== 'core' && !!pub && pub[pid] !== '*' && !(pub[pid] || []).includes(`${pid}/${sid}`);
      for (const p of plugins) for (const s of p.stages) {
        const inPlugins = fs.existsSync(path.join(claudeDir, 'plugins', p.id, 'skills', s.id, 'SKILL.md'));
        const inDrafts = fs.existsSync(path.join(claudeDir, 'drafts', p.id, 'skills', s.id, 'SKILL.md'));
        ok(isDraft(p.id, s.id) ? (!inPlugins && inDrafts) : (inPlugins && !inDrafts),
          `build claude ${s.id}: ${isDraft(p.id, s.id) ? 'draft nằm ở drafts/' : 'published nằm ở plugins/'}`);
      }
      for (const a of allAgents) {
        const inPlugins = fs.existsSync(path.join(claudeDir, 'plugins', a.plugin, 'agents', `${a.id}.md`));
        if (inPlugins) ok(a.skills.every((sid) => !isDraft(...sid.split('/'))), `build claude agent ${a.id}: không trỏ skill draft`);
      }
      const pj = JSON.parse(fs.readFileSync(path.join(claudeDir, 'plugins/backend/.claude-plugin/plugin.json'), 'utf8'));
      ok(/^https:\/\//.test(pj.homepage || '') && !!pj.repository && pj.license === 'MIT', 'plugin.json: homepage/repository/license (E9)');
      ok(Array.isArray(pj.keywords) && pj.keywords.includes('backend') && !pj.keywords.includes('cowork-to-code'),
        'plugin.json: keywords riêng theo plugin');
    }
    if (wfBuilt) {
      const pj = JSON.parse(fs.readFileSync(path.join(claudeDir, 'plugins/workflows/.claude-plugin/plugin.json'), 'utf8'));
      const hard32 = ['core', ...(workflows.manifest.hardDependencies || []).filter((d) => d !== 'core').sort()];
      const mkNames32 = new Set(mk.plugins.map((x) => x.name));
      ok(JSON.stringify(pj.dependencies) === JSON.stringify(hard32.filter((d) => mkNames32.has(d))),
        `build claude workflows: dependencies = hardDependencies có mặt trong marketplace (${pj.dependencies.join(',')})`);
      ok(pj.dependencies.every((d) => mkNames32.has(d)), 'build claude workflows: mọi dependency là entry marketplace');
      for (const s of workflows.stages) {
        const f = path.join(claudeDir, 'plugins/workflows/skills', s.id, 'SKILL.md');
        const c = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
        const fm = (c.match(/^---\n([\s\S]*?)\n---/) || ['', ''])[1];
        ok(fm.includes(`name: ${s.id}`) && !/^(kind|tier|risk):/m.test(fm), `build claude ${s.id}: frontmatter chuẩn (strip metadata)`);
        ok(c.includes('core:principles'), `build claude ${s.id}: pointer principles`);
      }
    }
  } else {
    console.log('  (bỏ qua kiểm tra build/ — chưa build. Dùng --build để build trước.)');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. PARITY references/ — skill có references trong source thì MỌI build phải ship
  // (trước đây chỉ claude ship; codex/antigravity/cursor bị rớt → mất nội dung).
  // ─────────────────────────────────────────────────────────────────────────────
  for (const p of plugins) {
    for (const s of p.stages) {
      if (!(s.assets || []).includes('references')) continue;
      const checks = [
        ['claude', path.join(claudeSkillDir(p.id, s.id), 'references')],
        ['codex', path.join(BUILD, 'codex', p.id, 'skills', s.id, 'references')],
        ['antigravity', path.join(BUILD, 'antigravity', p.id, 'docs', 'workflow', s.id, 'references')],
        ['cursor', path.join(BUILD, 'cursor', p.id, '.cursor', 'skills', s.id, 'references')],
      ];
      for (const [tool, refDir] of checks) {
        // chỉ kiểm tra nếu build của tool đó tồn tại (validate có thể chạy không --build)
        if (!fs.existsSync(path.join(BUILD, tool))) continue;
        ok(hasFiles(refDir), `build ${tool} ${s.id}: ship references/ (parity)`);
      }
    }
  }

  // Parity cho SKILL DÙNG CHUNG của core: claude/codex/cursor ship trong plugin/bundle core;
  // antigravity gộp vào bundle TỪNG plugin (recipe on-demand).
  for (const s of core.stages) {
    if (!(s.assets || []).includes('references')) continue;
    const checks = [
      ['claude', path.join(claudeDir, 'plugins', 'core', 'skills', s.id, 'references')],
      ['codex', path.join(BUILD, 'codex', 'core', 'skills', s.id, 'references')],
      ['cursor', path.join(BUILD, 'cursor', 'core', '.cursor', 'skills', s.id, 'references')],
      ...plugins.map((p) => ['antigravity', path.join(BUILD, 'antigravity', p.id, 'docs', 'workflow', s.id, 'references'), p.id]),
    ];
    for (const [tool, refDir, pid] of checks) {
      if (!fs.existsSync(path.join(BUILD, tool))) continue;
      ok(hasFiles(refDir), `build ${tool}${pid ? ' ' + pid : ''} core ${s.id}: ship references/ (parity)`);
    }
  }

  // 4b. CURSOR: Agent Skills (.cursor/skills/) + chỉ còn 00-principles rule
  {
    const cursorDir = path.join(BUILD, 'cursor');
    if (fs.existsSync(cursorDir)) {
      function assertCursorSkill(bundleId, skillId) {
        const skillDir = path.join(cursorDir, bundleId, '.cursor', 'skills', skillId);
        const out = path.join(skillDir, 'SKILL.md');
        ok(fs.existsSync(out), `build cursor ${bundleId}/${skillId}: có SKILL.md`);
        ok(/^[a-z0-9-]+$/.test(skillId), `build cursor ${skillId}: skill-id hợp lệ (a-z0-9-)`);
        const content = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
        const fmText = content.match(/^---\n([\s\S]*?)\n---/);
        const keys = fmText ? fmText[1].split('\n').filter(Boolean).map((l) => l.split(':')[0].trim()) : [];
        ok(keys.includes('name') && keys.includes('description') && !keys.includes('order'),
          `build cursor ${skillId}: frontmatter chuẩn (name+description, strip metadata)`);
        const nameLine = fmText ? fmText[1].split('\n').find((l) => l.startsWith('name:')) : '';
        const nameVal = nameLine ? nameLine.slice('name:'.length).trim().replace(/^["']|["']$/g, '') : '';
        ok(nameVal === skillId, `build cursor ${skillId}: name == folder`);
      }
      for (const s of core.stages) assertCursorSkill('core', s.id);
      for (const p of plugins) {
        for (const s of p.stages) assertCursorSkill(p.id, s.id);
        const rulesDir = path.join(cursorDir, p.id, '.cursor', 'rules');
        const rules = fs.existsSync(rulesDir) ? fs.readdirSync(rulesDir) : [];
        const mdc = rules.filter((f) => f.endsWith('.mdc'));
        ok(mdc.length === 1 && mdc[0] === `${p.id}-00-principles.mdc`,
          `build cursor ${p.id}: chỉ còn ${p.id}-00-principles.mdc (không per-stage rule)`);
      }
      const coreRules = path.join(cursorDir, 'core', '.cursor', 'rules');
      ok(!fs.existsSync(coreRules) || fs.readdirSync(coreRules).length === 0,
        'build cursor core: không còn rules/ (skills-only)');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. BUILD codex: pointer git-workflow trong stage skill (parity nhắc nguyên tắc nền tảng)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    const codexDir = path.join(BUILD, 'codex');
    if (fs.existsSync(codexDir)) {
      for (const p of plugins) {
        const sample = p.stages[0];
        if (!sample) continue;
        const out = path.join(codexDir, p.id, 'skills', sample.id, 'SKILL.md');
        if (!fs.existsSync(out)) continue;
        const content = fs.readFileSync(out, 'utf8');
        ok(content.includes('`git-workflow`'),
          `build codex ${sample.id}: pointer git-workflow`);
      }
      for (const a of allAgents) {
        const f = path.join(codexDir, a.plugin, 'agents', `${a.id}.toml`);
        const c = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
        ok(/^name = ".+"$/m.test(c) && /^description = /m.test(c) && c.includes('developer_instructions = """')
          && /^sandbox_mode = "(read-only|workspace-write)"$/m.test(c), `build codex agent ${a.id}: đủ trường`);
      }
      if (workflows) for (const s of workflows.stages) {
        ok(fs.existsSync(path.join(codexDir, 'workflows', 'skills', s.id, 'SKILL.md')), `build codex ${s.id}: có SKILL.md`);
      }
    }
  }
}
