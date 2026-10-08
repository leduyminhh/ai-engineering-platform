// claude adapter — gộp TẤT CẢ plugin thành MỘT marketplace Claude Code.
//
// build/claude/
//   .claude-plugin/marketplace.json            <- liệt kê core + mọi plugin
//   plugins/core/.claude-plugin/plugin.json    <- plugin CORE (nguyên tắc nền tảng)
//   plugins/core/skills/principles/SKILL.md    <- nội dung core/principles/
//   plugins/<id>/.claude-plugin/plugin.json    <- manifest từng plugin (depends on core)
//   plugins/<id>/skills/<stage>/SKILL.md (+ assets)
//
// HYBRID: core là MỘT plugin riêng; mỗi domain plugin khai báo "dependencies": ["<mkt>:core"]
// nên khi /plugin install <id> thì Claude Code tự cài kèm core (lấy đúng logic nền tảng).
// Mỗi giai đoạn = 1 skill (auto-discover trong skills/), gọi theo namespace /<plugin-id>:<skill>.
import { skillFiles, frontmatter, principlesDigest, PROVIDER_SKILL_KEYS } from '../_shared/lib.mjs';
import { claudeAgentMd, workflowPreamble } from '../_shared/agents.mjs';

function pluginJson(p, { dependencies, author, meta } = {}) {
  const obj = {
    name: p.id, // kebab-case; namespace skill: /<id>:<skill>
    displayName: p.name,
    description: p.description,
    version: p.version, // semver MAJOR.MINOR.PATCH
    author, // attribution (= owner của marketplace) — tránh cảnh báo "No author" của `claude plugin validate`
    homepage: meta && meta.homepage,
    repository: meta && meta.repository,
    license: meta && meta.license,
    keywords: Array.isArray(p.manifest && p.manifest.keywords) ? p.manifest.keywords : ['workflow', p.id],
  };
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
  if (dependencies && dependencies.length) obj.dependencies = dependencies; // tên trần cùng marketplace, vd ["core"]
  return JSON.stringify(obj, null, 2) + '\n';
}

function marketplaceJson(entries, marketplace) {
  return JSON.stringify(
    {
      name: marketplace.name,
      owner: marketplace.owner,
      description: marketplace.description,
      metadata: { pluginRoot: './plugins' },
      plugins: entries.map((p) => ({
        name: p.id,
        source: `./plugins/${p.id}`,
        description: p.description,
        version: p.version,
      })),
    },
    null,
    2,
  ) + '\n';
}

// Marketplace chỉ đọc plugins/, nên skill draft để ở drafts/: cài skills-mode và gói Cowork vẫn lấy được, marketplace thì không thấy.
// core không có trong _published.json nên không bao giờ coi là draft.
function draftOf(published) {
  if (!published) return () => false;
  return (pid, sid) => pid !== 'core' && published[pid] !== '*' && !(published[pid] || []).includes(`${pid}/${sid}`);
}

// Principles là nền cho skill khác, không phải lệnh người dùng gõ; model vẫn gọi được.
const principlesHidden = (skillKeys) => (skillKeys.includes('user-invocable') ? [['user-invocable', false]] : []);

// CORE plugin = skill "principles" (nguyên tắc nền tảng) + các SKILL DÙNG CHUNG từ
// core/skills/ (vd git-workflow) — cài plugin nào cũng kéo theo qua dependency "core".
function coreFiles(core, { author, meta, skillKeys = [] } = {}) {
  const skill =
    frontmatter([
      ['name', 'principles'],
      ['description', core.description],
      ...principlesHidden(skillKeys),
    ]) +
    '\n\n' +
    core.principles.replace(/^\n+/, '');
  const files = [
    { path: 'plugins/core/.claude-plugin/plugin.json', content: pluginJson(core, { author, meta }) },
    { path: 'plugins/core/skills/principles/SKILL.md', content: skill },
  ];
  // Pointer 2 dạng (phẳng + plugin namespaced) giống stage skill của domain plugin.
  const note = principlesDigest({ provider: 'claude' });
  for (const stage of core.stages || []) {
    files.push(...skillFiles(stage, 'plugins/core/skills', note, { keys: skillKeys }));
  }
  return files;
}

// Nguyên tắc RIÊNG của plugin (shared/principles.md) thành một skill discoverable cho Claude.
// cursor/codex/antigravity đã inline principles vào rules/AGENTS.md; claude thì KHÔNG, nên nếu
// không làm bước này phần principles đặc thù lĩnh vực sẽ không tới Claude. Bổ sung cho skill core.
function pluginPrinciplesFiles(p, skillKeys = []) {
  const body = ((p.shared && p.shared.principles) || '').replace(/^\n+/, '');
  if (!body.trim()) return [];
  const name = `${p.id}-principles`;
  const description =
    `Nguyên tắc riêng của plugin ${p.id} (phân tầng, ranh giới an toàn, nguồn sự thật đặc thù), ` +
    `bổ sung cho skill core principles. Dùng khi bắt đầu bất kỳ skill ${p.id}-* nào hoặc trước khi ` +
    `quyết định điều gì chạm ranh giới an toàn của plugin ${p.id}.`;
  const skill = frontmatter([['name', name], ['description', description], ...principlesHidden(skillKeys)]) + '\n\n' + body;
  return [{ path: `plugins/${p.id}/skills/${name}/SKILL.md`, content: skill }];
}

// Plugin `workflows` gọi xuyên nhiều plugin. Claude coi `dependencies` là "phải enabled" nên chỉ khai
// báo hard-dependency tường minh từ manifest (thiếu một plugin lẻ như `data` không được làm hỏng cả bộ);
// plugin còn lại được nêu trong preamble từng workflow. Không có hardDependencies → union như trước.
function workflowFiles(wfs, plugins, author, meta, skillKeys) {
  const agentsById = new Map(plugins.flatMap((p) => p.agents || []).map((a) => [a.id, a]));
  const present = new Set(plugins.map((p) => p.id));
  const pluginsOf = (wf) => {
    const s = new Set();
    for (const r of wf.requires) s.add(r.split('/')[0]);
    for (const id of wf.agents) { const a = agentsById.get(id); if (a) s.add(a.plugin); }
    return s;
  };
  const hard = (wfs.manifest && wfs.manifest.hardDependencies) || null;
  const deps = hard ? new Set(hard) : new Set(wfs.stages.flatMap((wf) => [...pluginsOf(wf)]));
  const dependencies = ['core', ...[...deps].filter((d) => d !== 'core' && present.has(d)).sort()];
  const files = [{ path: 'plugins/workflows/.claude-plugin/plugin.json', content: pluginJson(wfs, { dependencies, author, meta }) }];
  for (const wf of wfs.stages) {
    const soft = hard ? [...pluginsOf(wf)].filter((p) => !hard.includes(p)).sort() : [];
    files.push(...skillFiles(wf, 'plugins/workflows/skills', workflowPreamble(wf, agentsById, 'claude', { softDeps: soft }), { keys: skillKeys }));
  }
  return files;
}

// Khoá theo id agent (không kèm plugin) vì hook nhận agent_type và script bỏ tiền tố plugin: trước khi tra.
function scopeLockJson(plugins) {
  const map = {};
  const scoped = plugins.flatMap((p) => p.agents || []).filter((a) => (a.writeScope || []).length);
  for (const a of scoped.sort((x, y) => x.id.localeCompare(y.id))) map[a.id] = a.writeScope;
  return `${JSON.stringify(map, null, 2)}\n`;
}

export default {
  name: 'claude',
  describe: 'Claude Code marketplace — core (dependency) + plugins/<id>/ (mỗi plugin có skills/)',
  build(plugins, { marketplace, core, workflows, published, skillKeys = PROVIDER_SKILL_KEYS.claude }) {
    const author = marketplace.owner; // attribution dùng chung cho mọi plugin.json (= owner marketplace)
    const meta = { homepage: marketplace.homepage, repository: marketplace.repository, license: marketplace.license };
    const isDraft = draftOf(published);
    const wfs = workflows && workflows.stages.length ? workflows : null;
    // marketplace liệt kê core TRƯỚC rồi tới các domain plugin (+ workflows nếu có)
    const entries = [core, ...plugins, ...(wfs ? [wfs] : [])];
    const files = [
      { path: '.claude-plugin/marketplace.json', content: marketplaceJson(entries, marketplace) },
      ...coreFiles(core, { author, meta, skillKeys }),
    ];
    if (core.hooksDir) files.push({ path: 'plugins/core/hooks', copyDir: core.hooksDir });
    for (const p of plugins) {
      files.push({
        path: `plugins/${p.id}/.claude-plugin/plugin.json`,
        // Dependency CÙNG marketplace = TÊN TRẦN "core" (KHÔNG phải "<marketplace>:core";
        // Claude Code không hỗ trợ shorthand "marketplace:plugin" trong dependencies).
        content: pluginJson(p, { dependencies: ['core'], author, meta }),
      });
      if (p.hooksDir) files.push({ path: `plugins/${p.id}/hooks`, copyDir: p.hooksDir });
      files.push(...pluginPrinciplesFiles(p, skillKeys)); // <plugin>-principles skill
      // Claude không auto-load skill khác khi gọi một skill nên cần digest + pointer.
      // Pointer có 2 dạng tên vì 2 đường cài: skills phẳng (`principles`) và plugin namespaced (`core:principles`).
      const principlesNote = principlesDigest({ provider: 'claude', pluginId: p.id });
      for (const stage of p.stages) {
        const base = isDraft(p.id, stage.id) ? `drafts/${p.id}/skills` : `plugins/${p.id}/skills`;
        files.push(...skillFiles(stage, base, principlesNote, { keys: skillKeys }));
      }
      for (const a of p.agents || []) {
        const root = a.skills.some((sid) => isDraft(...sid.split('/'))) ? 'drafts' : 'plugins';
        files.push({ path: `${root}/${p.id}/agents/${a.id}.md`, content: claudeAgentMd(a) });
      }
    }
    if (wfs) files.push(...workflowFiles(wfs, plugins, author, meta, skillKeys));
    // Phải đứng sau entry copyDir của hooks để file sinh ra không bị bản copy ghi đè.
    if (core.hooksDir) files.push({ path: 'plugins/core/hooks/scope-lock.json', content: scopeLockJson(plugins) });
    return files;
  },
};
