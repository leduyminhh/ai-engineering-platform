// Pin: verification gate (docs/requests/2026-10-20-verification-gate). Task 4: quy ước gắn ID AC vào test trong baseline và plan template (AC2.5).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;

  // AC2.5: baseline yêu cầu gắn ID AC vào tên test hoặc comment, và nêu cờ --strict
  {
    const tpl = fs.readFileSync(path.join(REPO_ROOT, 'core', 'agents', 'AGENTS.template.md'), 'utf8');
    const sp = tpl.slice(tpl.indexOf('### Workflow defaults'), tpl.indexOf('### Language'));
    ok(sp.includes('`ac1_2`') && sp.includes('`- Test:`') && sp.includes('--strict'),
      'AC2.5: baseline yêu cầu gắn ID AC vào tên test hoặc comment');
  }

  // AC2.5: plan template ghi file test trong **Files:**
  {
    const plan = fs.readFileSync(path.join(REPO_ROOT, 'core', 'skills', 'artifact-templates', 'references', 'plan.template.md'), 'utf8');
    ok(plan.includes('- Test: `'), 'AC2.5: plan template ghi file test trong **Files:**');
  }
}
