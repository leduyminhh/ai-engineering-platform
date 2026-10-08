// Contract templates: drift guard AGENTS.md và khung init dùng chung giữa CLI lẫn skill *-init.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, PLUGINS_DIR, core, plugins, BUILD, claudeDir, claudeSkillDir } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. DRIFT GUARD: AGENTS.md (repo) == AGENTS.template.md (nguồn template)
  {
    const a = path.join(REPO_ROOT, 'AGENTS.md');
    const t = path.join(REPO_ROOT, 'core', 'agents', 'AGENTS.template.md');
    ok(fs.existsSync(t), 'AGENTS.template.md tồn tại');
    ok(fs.existsSync(a), 'AGENTS.md (repo) tồn tại');
    if (fs.existsSync(a) && fs.existsSync(t)) {
      const norm = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
      ok(norm(a) === norm(t), 'AGENTS.md == AGENTS.template.md (không drift)');
      const body = norm(a);
      ok(body.includes('Comments are documentation, not narration')
        && body.includes('Quality gate')
        && body.includes('Assume the reader is an experienced engineer')
        && /explain \*why\*/.test(body),
        'AGENTS.md: comment policy (why-only + quality gate + senior reader)');
    }
  }

  // 7. SOURCE: templates.md của *-init (nếu có) phải có link tới AGENTS.md
  for (const p of plugins) {
    for (const s of p.stages) {
      if (!s.id.endsWith('-init')) continue;
      const tpl = path.join(PLUGINS_DIR, p.id, 'skills', s.id, 'references', 'templates.md');
      if (!fs.existsSync(tpl)) continue;
      const tplText = fs.readFileSync(tpl, 'utf8');
      if (!tplText.includes('## CLAUDE.md')) continue; // khung chung đã chuyển sang templates/init
      ok(tplText.includes('[AGENTS.md](AGENTS.md)'),
        `${s.id}: references/templates.md (còn mô tả CLAUDE.md) có link [AGENTS.md](AGENTS.md)`);
    }
  }

  // 5c. SOURCE: templates/init/ — khung chung dùng cho aip init + skill *-init
  {
    const T = path.join(REPO_ROOT, 'templates', 'init');
    ok(fs.existsSync(T), 'templates/init/ tồn tại');
    const must = [
      'CLAUDE.md', 'CONTRIBUTING.md', 'README.md', 'TODO.md',
      'project-knowledge/project-overview.md', 'project-knowledge/domain-context.md',
      'project-knowledge/architecture.md', 'project-knowledge/source-structure.md',
      'project-knowledge/code-convention.md', 'project-knowledge/tech-stack.yml',
      'docs/requests/_TEMPLATE/requirement.md',
      'docs/requests/_TEMPLATE/plan.md', 'docs/contracts/.gitkeep',
      'docs/decisions/_TEMPLATE.md', 'docs/decisions/0001-vi-du-quyet-dinh.md',
      'docs/decisions/0002-code-convention.md', 'src/shared/.gitkeep', 'tests/.gitkeep',
    ];
    for (const rel of must) ok(fs.existsSync(path.join(T, rel)), `templates/init/${rel} tồn tại`);
    const claude = fs.existsSync(path.join(T, 'CLAUDE.md')) ? fs.readFileSync(path.join(T, 'CLAUDE.md'), 'utf8') : '';
    ok(claude.includes('[AGENTS.md](AGENTS.md)'), 'templates/init/CLAUDE.md: link [AGENTS.md](AGENTS.md)');
    ok(claude.includes('core:principles') && claude.includes('`principles`'),
      'templates/init/CLAUDE.md: pointer principles (phẳng + core:principles)');
    ok(claude.includes('core:git-workflow') && claude.includes('`git-workflow`'),
      'templates/init/CLAUDE.md: pointer git-workflow (phẳng + core:git-workflow)');
  }

  // 6. INIT skills ship AGENTS.template.md (CLI lẫn skill drop ra ./AGENTS.md)
  for (const p of plugins) {
    for (const s of p.stages) {
      if (!s.id.endsWith('-init')) continue;
      const checks = [
        ['claude', path.join(claudeSkillDir(p.id, s.id), 'AGENTS.template.md')],
        ['codex', path.join(BUILD, 'codex', p.id, 'skills', s.id, 'AGENTS.template.md')],
        ['antigravity', path.join(BUILD, 'antigravity', p.id, 'docs', 'workflow', s.id, 'AGENTS.template.md')],
        ['cursor', path.join(BUILD, 'cursor', p.id, '.cursor', 'skills', s.id, 'AGENTS.template.md')],
      ];
      for (const [tool, f] of checks) {
        if (!fs.existsSync(path.join(BUILD, tool))) continue;
        ok(fs.existsSync(f), `build ${tool} ${s.id}: ship AGENTS.template.md`);
      }
    }
  }

  // 6b. BUILD: *-init ship cả cây templates/ (khung chung) cho mọi tool
  if (fs.existsSync(BUILD)) {
    for (const p of plugins) {
      for (const s of p.stages) {
        if (!s.id.endsWith('-init')) continue;
        const targets = [
          ['claude', path.join(claudeSkillDir(p.id, s.id), 'templates', 'CLAUDE.md')],
          ['codex', path.join(BUILD, 'codex', p.id, 'skills', s.id, 'templates', 'CLAUDE.md')],
          ['antigravity', path.join(BUILD, 'antigravity', p.id, 'docs', 'workflow', s.id, 'templates', 'CLAUDE.md')],
          ['cursor', path.join(BUILD, 'cursor', p.id, '.cursor', 'skills', s.id, 'templates', 'CLAUDE.md')],
        ];
        for (const [tool, f] of targets) {
          if (!fs.existsSync(path.join(BUILD, tool))) continue;
          ok(fs.existsSync(f), `build ${tool} ${s.id}: ship templates/CLAUDE.md`);
        }
      }
    }
  }
}
