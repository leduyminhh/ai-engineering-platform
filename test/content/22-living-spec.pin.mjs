// Pin: spec sống (docs/requests/2026-10-21-living-spec). Baseline có bước gộp spec (AC4.1) và docs/specs/README.md liệt kê năng lực (AC5.1).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;

  // AC4.1: baseline có bước gộp spec sống trước khi kết thúc nhánh + bảng bộ nhớ dài hạn có docs/specs/
  {
    const tpl = fs.readFileSync(path.join(REPO_ROOT, 'core', 'agents', 'AGENTS.template.md'), 'utf8');
    const i = tpl.indexOf('#### Docs location and format');
    const docs = tpl.slice(i, tpl.indexOf('#### Memory and resume', i)).replace(/\s+/g, ' ');
    ok(docs.includes('docs/specs/<capability>/spec.md') && docs.includes('Ảnh hưởng spec') && docs.includes('history table')
      && docs.includes('docs/specs/README.md') && docs.includes('check-request.mjs') && docs.includes('--base <ref>')
      && docs.indexOf('docs/specs/<capability>/spec.md') < docs.indexOf('finishing-a-development-branch'),
    'AC4.1: baseline có bước gộp spec sống trước finishing-a-development-branch');
    ok(docs.includes('has a `## Ảnh hưởng spec` section') && docs.includes('`Không ảnh hưởng: <reason>`')
      && docs.includes('_TEMPLATE/design.md') && docs.includes('(W10)'),
    'AC4.1: baseline nêu mục Ảnh hưởng spec của design.md và lưu ý _TEMPLATE cũ thiếu mục (W10)');
    const longRow = tpl.split('\n').find((l) => l.startsWith('| Long-term |')) ?? '';
    ok(longRow.includes('docs/specs/'), 'AC4.1: bảng bộ nhớ ghi spec sống ở dòng Long-term');
  }

  // AC5.1: docs/specs/README.md liệt kê 7 năng lực; câu "chưa có spec.md nào" của AC là trạng thái tại thời điểm viết nên không pin.
  {
    const p = path.join(REPO_ROOT, 'docs', 'specs', 'README.md');
    const readme = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    const names = ['projection', 'install-lifecycle', 'hooks-gates', 'workflows', 'artifact-templates', 'baseline', 'cli-wizard'];
    ok(names.every((n) => readme.includes(`\`${n}\``) && readme.includes(`docs/specs/${n}/spec.md`)),
      'AC5.1: docs/specs/README.md liệt kê đủ 7 năng lực kèm đường dẫn dự kiến');
  }
}
