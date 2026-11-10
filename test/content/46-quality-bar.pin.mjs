// Pin: template quality bar và dấu hiệu nới quality bar trong review package (request 2026-11-10-agent-skills-gap-closure, P3).
export default async function run({ ok, ctx }) {
  const { fs, path, pathToFileURL, REPO_ROOT } = ctx;
  const TPL = 'core/skills/artifact-templates/references/quality-bar.template.md';

  ok(fs.existsSync(path.join(REPO_ROOT, TPL)), `AC3.1: ${TPL} tồn tại`);
  ok(!fs.existsSync(path.join(REPO_ROOT, 'core/skills/artifact-templates/references/project-knowledge/quality-bar.md'))
    && !fs.existsSync(path.join(REPO_ROOT, 'core/skills/artifact-templates/references/project-knowledge/quality-bar.template.md')),
  'AC3.1: template không nằm dưới references/project-knowledge/ nên aip init --full không chép');
}
