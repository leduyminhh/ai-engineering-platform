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
import { skillFiles, frontmatter, principlesDigest } from '../_shared/lib.mjs';
import { claudeAgentMd, workflowPreamble } from '../_shared/agents.mjs';

function pluginJson(p, { dependencies, author } = {}) {
  const obj = {
    name: p.id, // kebab-case; namespace skill: /<id>:<skill>
    displayName: p.name,
    description: p.description,
    version: p.version, // semver MAJOR.MINOR.PATCH
    author, // attribution (= owner của marketplace) — tránh cảnh báo "No author" của `claude plugin validate`
    keywords: ['workflow', 'cowork-to-code', p.id],
  };
  if (!author) delete obj.author;
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

// CORE plugin = skill "principles" (nguyên tắc nền tảng) + các SKILL DÙNG CHUNG từ
// core/skills/ (vd git-workflow) — cài plugin nào cũng kéo theo qua dependency "core".
function coreFiles(core, { author } = {}) {
  const skill =
    frontmatter([
      ['name', 'principles'],
      ['description', core.description],
    ]) +
    '\n\n' +
    core.principles.replace(/^\n+/, '');
  const files = [
    { path: 'plugins/core/.claude-plugin/plugin.json', content: pluginJson(core, { author }) },
    { path: 'plugins/core/skills/principles/SKILL.md', content: skill },
  ];
  // Pointer 2 dạng (phẳng + plugin namespaced) giống stage skill của domain plugin.
  const note = principlesDigest({ provider: 'claude' });
  for (const stage of core.stages || []) {
    files.push(...skillFiles(stage, 'plugins/core/skills', note));
  }
  return files;
}

// Nguyên tắc RIÊNG của plugin (shared/principles.md) thành một skill discoverable cho Claude.
// cursor/codex/antigravity đã inline principles vào rules/AGENTS.md; claude thì KHÔNG, nên nếu
// không làm bước này phần principles đặc thù lĩnh vực sẽ không tới Claude. Bổ sung cho skill core.
function pluginPrinciplesFiles(p) {
  const body = ((p.shared && p.shared.principles) || '').replace(/^\n+/, '');
  if (!body.trim()) return [];
  const name = `${p.id}-principles`;
  const description =
    `Nguyên tắc riêng của plugin ${p.id} (phân tầng, ranh giới an toàn, nguồn sự thật đặc thù), ` +
    `bổ sung cho skill core principles. Dùng khi bắt đầu bất kỳ skill ${p.id}-* nào hoặc trước khi ` +
    `quyết định điều gì chạm ranh giới an toàn của plugin ${p.id}.`;
  const skill = frontmatter([['name', name], ['description', description]]) + '\n\n' + body;
  return [{ path: `plugins/${p.id}/skills/${name}/SKILL.md`, content: skill }];
}

// Plugin `workflows` gọi xuyên nhiều plugin. Claude coi `dependencies` là "phải enabled" nên chỉ khai
// báo hard-dependency tường minh từ manifest (thiếu một plugin lẻ như `data` không được làm hỏng cả bộ);
// plugin còn lại được nêu trong preamble từng workflow. Không có hardDependencies → union như trước.
function workflowFiles(wfs, plugins, author) {
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
  const files = [{ path: 'plugins/workflows/.claude-plugin/plugin.json', content: pluginJson(wfs, { dependencies, author }) }];
  for (const wf of wfs.stages) {
    const soft = hard ? [...pluginsOf(wf)].filter((p) => !hard.includes(p)).sort() : [];
    files.push(...skillFiles(wf, 'plugins/workflows/skills', workflowPreamble(wf, agentsById, 'claude', { softDeps: soft })));
  }
  return files;
}

export default {
  name: 'claude',
  describe: 'Claude Code marketplace — core (dependency) + plugins/<id>/ (mỗi plugin có skills/)',
  build(plugins, { marketplace, core, workflows }) {
    const author = marketplace.owner; // attribution dùng chung cho mọi plugin.json (= owner marketplace)
    const wfs = workflows && workflows.stages.length ? workflows : null;
    // marketplace liệt kê core TRƯỚC rồi tới các domain plugin (+ workflows nếu có)
    const entries = [core, ...plugins, ...(wfs ? [wfs] : [])];
    const files = [
      { path: '.claude-plugin/marketplace.json', content: marketplaceJson(entries, marketplace) },
      ...coreFiles(core, { author }),
    ];
    for (const p of plugins) {
      files.push({
        path: `plugins/${p.id}/.claude-plugin/plugin.json`,
        // Dependency CÙNG marketplace = TÊN TRẦN "core" (KHÔNG phải "<marketplace>:core";
        // Claude Code không hỗ trợ shorthand "marketplace:plugin" trong dependencies).
        content: pluginJson(p, { dependencies: ['core'], author }),
      });
      files.push(...pluginPrinciplesFiles(p)); // <plugin>-principles skill
      // Claude không auto-load skill khác khi gọi một skill nên cần digest + pointer.
      // Pointer có 2 dạng tên vì 2 đường cài: skills phẳng (`principles`) và plugin namespaced (`core:principles`).
      const principlesNote = principlesDigest({ provider: 'claude', pluginId: p.id });
      for (const stage of p.stages) {
        files.push(...skillFiles(stage, `plugins/${p.id}/skills`, principlesNote));
      }
      for (const a of p.agents || []) {
        files.push({ path: `plugins/${p.id}/agents/${a.id}.md`, content: claudeAgentMd(a) });
      }
    }
    if (wfs) files.push(...workflowFiles(wfs, plugins, author));
    return files;
  },
};
