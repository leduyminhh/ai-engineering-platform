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
import { skillFiles, frontmatter } from '../_shared/lib.mjs';
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
  const note =
    '> **Đọc trước** nguyên tắc nền tảng — skill `principles` ' +
    '(bản cài dạng plugin: `core:principles`) — rồi mới thực hiện skill này.';
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
    `Nguyên tắc nền tảng RIÊNG của plugin ${p.id} (pipeline bắt buộc, phân tầng, ranh giới ` +
    `an toàn, nguồn sự thật đặc thù) — đọc TRƯỚC khi chạy bất kỳ giai đoạn ${p.id}-* nào; ` +
    `bổ sung cho skill core principles.`;
  const skill = frontmatter([['name', name], ['description', description]]) + '\n\n' + body;
  return [{ path: `plugins/${p.id}/skills/${name}/SKILL.md`, content: skill }];
}

// Plugin `workflows` gọi xuyên nhiều plugin; Claude chỉ resolve dependency có trong marketplace
// nên bỏ plugin vắng mặt (build lọc --plugin).
function workflowFiles(wfs, plugins, author) {
  const agentsById = new Map(plugins.flatMap((p) => p.agents || []).map((a) => [a.id, a]));
  const present = new Set(plugins.map((p) => p.id));
  const deps = new Set();
  for (const wf of wfs.stages) {
    for (const r of wf.requires) deps.add(r.split('/')[0]);
    for (const id of wf.agents) { const a = agentsById.get(id); if (a) deps.add(a.plugin); }
  }
  const dependencies = ['core', ...[...deps].filter((d) => d !== 'core' && present.has(d)).sort()];
  const files = [{ path: 'plugins/workflows/.claude-plugin/plugin.json', content: pluginJson(wfs, { dependencies, author }) }];
  for (const wf of wfs.stages) {
    files.push(...skillFiles(wf, 'plugins/workflows/skills', workflowPreamble(wf, agentsById, 'claude')));
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
      // Claude KHÔNG auto-load skill khác khi gọi 1 skill (khác cursor alwaysApply / codex AGENTS.md).
      // Chèn pointer để agent nạp nguyên tắc nền tảng trước khi thực hiện stage.
      // Pointer phải đúng cho CẢ HAI đường phân phối: (a) aip install dạng skills PHẲNG →
      // skill mang tên trần `principles` / `<id>-principles`; (b) cài qua marketplace dạng PLUGIN →
      // skill namespaced `core:principles` / `<id>:<id>-principles`. Nêu cả hai để khớp mọi cách cài.
      const principlesNote =
        `> **Đọc trước** nguyên tắc nền tảng — skill \`principles\` + \`${p.id}-principles\` ` +
        `(bản cài dạng plugin: \`core:principles\` + \`${p.id}:${p.id}-principles\`) — ` +
        `rồi mới thực hiện giai đoạn này.\n` +
        `> Khi commit/push/tạo branch/PR: gọi skill \`git-workflow\` ` +
        `(bản cài dạng plugin: \`core:git-workflow\`).`;
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
