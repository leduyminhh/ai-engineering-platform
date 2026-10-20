// Contract templates: drift guard AGENTS.md và khung init dùng chung giữa CLI lẫn skill *-init.
import { importsAgentsMd } from '../../cli/lib/managed-block.mjs';
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, PLUGINS_DIR, core, plugins, BUILD, claudeDir, claudeSkillDir, listFilesRec } = ctx;

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
    ok(importsAgentsMd(claude), 'templates/init/CLAUDE.md: import @AGENTS.md (link Markdown không được Claude Code nạp)');
    ok(claude.includes('core:principles') && claude.includes('`principles`'),
      'templates/init/CLAUDE.md: pointer principles (phẳng + core:principles)');
    ok(claude.includes('core:git-workflow') && claude.includes('`git-workflow`'),
      'templates/init/CLAUDE.md: pointer git-workflow (phẳng + core:git-workflow)');
  }

  // 5d. DRIFT GUARD: AGENTS.md Safety chuyển chốt duyệt diff sang trước khi tích hợp; bản cũ còn sót ở tầng
  // core (template init, principles, digest nhúng mọi skill) và skill plugin từng làm agent vẫn dừng ở mỗi commit.
  {
    // Bản cũ có nhiều biến thể: in đậm, xuống dòng giữa câu, "trước commit" thiếu "khi", "DỪNG … duyệt diff".
    const OLD_RULE = /duyệt[*\s]+diff(?:[*\s]+contract)?[*\s>]*\s+trước(?:\s+khi)?[\s>]+commit|dừng[^.\n]{0,40}duyệt[*\s]+diff/i;
    for (const rel of ['templates/init/CLAUDE.md', 'core/principles/principles.md', 'adapters/_shared/lib.mjs']) {
      const text = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      ok(!OLD_RULE.test(text), `${rel}: không còn rule cũ "duyệt diff trước khi commit"`);
    }
    // Skill giữ chốt dừng riêng có chủ đích cho thao tác rủi ro; skill ngoài danh sách phải theo rule chung.
    const KEEP_STOP = new Set([
      'backend/skills/backend-migrate-architecture', 'frontend/skills/frontend-migrate-architecture',
      'backend/skills/backend-migrate-vault-consul', 'backend/skills/backend-testing', 'frontend/skills/frontend-testing',
    ]);
    const stale = listFilesRec(PLUGINS_DIR)
      .filter((rel) => rel.endsWith('.md') && !KEEP_STOP.has(rel.split('/').slice(0, 3).join('/')))
      .filter((rel) => OLD_RULE.test(fs.readFileSync(path.join(PLUGINS_DIR, rel), 'utf8')));
    ok(stale.length === 0, `plugins: không còn rule cũ "duyệt diff trước commit" (${stale.join(', ')})`);
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
