// Pin: ba câu định nghĩa chế độ quyền (docs/requests/2026-11-19-permission-modes-standard), AC5.1, AC5.3, AC5.4.
// Câu VI lấy từ MODE_DEFS của CLI; câu EN là bảng ở Global Constraints của plan, nên không suy ra được từ code.
const EN = {
  guarded: 'Risky actions ask the user.',
  confined: 'Never asks: work inside the fence passes, work outside it is denied.',
  open: 'Never asks, no fence: only writes to permission config files, `writeScope` and `mcpDeny` still block.',
};

export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const { pathToFileURL } = await import('node:url');
  const { MODE_DEFS } = await import(pathToFileURL(path.join(REPO_ROOT, 'cli', 'lib', 'mode.mjs')).href);
  const flat = (s) => s.replace(/\s+/g, ' ');
  const raw = (f) => fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
  const modes = ['guarded', 'confined', 'open'];

  // Đoạn từ neo đến neo kế tiếp (đoạn in đậm, bullet yêu cầu hoặc H2), đã gộp khoảng trắng.
  const slice = (text, lead, end) => {
    const i = text.indexOf(lead);
    if (i < 0) return '';
    const rest = text.slice(i + lead.length);
    const j = rest.search(end);
    return flat(j < 0 ? text.slice(i) : text.slice(i, i + lead.length + j));
  };
  const rawLines = (f) => fs.readFileSync(path.join(REPO_ROOT, f), 'utf8').split('\n');

  ok(modes.every((m) => typeof MODE_DEFS[m] === 'string' && MODE_DEFS[m] !== ''), 'AC5.4: MODE_DEFS có đủ ba câu guarded, confined, open');

  const spec = slice(raw('docs/specs/hooks-gates/spec.md'), '**hooks-gates/R25**', /\n- \*\*hooks-gates\/R\d+\*\*|\n## /);
  for (const m of modes) ok(spec.includes(MODE_DEFS[m]), `AC5.1: spec hooks-gates R25 chứa nguyên văn câu định nghĩa ${m} (VI)`);

  const hooksSpec = raw('docs/specs/hooks-gates/spec.md');
  ok(spec !== '' && /^\| 2026-11-19 \| \[2026-11-19-permission-modes-standard\][^\n]*\| hooks-gates\/R25 \| thêm \|$/m.test(hooksSpec), 'AC5.1: spec hooks-gates có R25 và hàng Lịch sử thêm R25');
  const r20 = slice(hooksSpec, '**hooks-gates/R20**', /\n- \*\*hooks-gates\/R\d+\*\*|\n## /);
  ok(['`guarded`', '`confined`', '`open`', '`ask`', '`full`'].every((w) => r20.includes(w)) && spec.includes('aip mode guarded|confined|open|status'), 'AC5.1: R20 nêu ba giá trị mode và bí danh ask/full; R25 nêu lệnh aip mode guarded|confined|open|status');
  const wizard = slice(raw('docs/specs/cli-wizard/spec.md'), '**cli-wizard/R4**', /\n- \*\*cli-wizard\/R\d+\*\*|\n## /);
  const baseline = slice(raw('docs/specs/baseline/spec.md'), '**baseline/R5**', /\n- \*\*baseline\/R\d+\*\*|\n## /);
  ok(wizard.includes('aip mode guarded|confined|open|status') && wizard.includes('`ask`') && wizard.includes('`full`'), 'AC5.2: cli-wizard R4 nêu aip mode guarded|confined|open|status và bí danh ask/full');
  ok(['`confined`', '`open`', 'bypassPermissions', '`fullKeep`'].every((w) => baseline.includes(w)), 'AC5.2: baseline R5 nêu confined, open, bypassPermissions, fullKeep');
  const history = (f) => raw(f).split('\n').filter((l) => l.startsWith('| 2026-11-19 |')).join('\n');
  ok(history('docs/specs/cli-wizard/spec.md').includes('| cli-wizard/R4 | đổi |') && history('docs/specs/baseline/spec.md').includes('| baseline/R5 | đổi |'), 'AC5.2: Lịch sử của cli-wizard và baseline có hàng 2026-11-19 đổi R4, R5');

  // [file, hàm dựng tiêu đề mục, bản câu]: câu định nghĩa là dòng không rỗng đầu tiên sau tiêu đề H2.
  const docs = [
    ['docs/aip-gate.md', (m) => `## \`${m}\` mode`, EN],
    ['docs/aip-gate_VI.md', (m) => `## Chế độ \`${m}\``, MODE_DEFS],
  ];
  for (const [file, heading, defs] of docs) {
    const lines = rawLines(file);
    for (const m of modes) {
      const i = lines.findIndex((l) => l.startsWith(heading(m)));
      const first = i < 0 ? '' : (lines.slice(i + 1).find((l) => l.trim() !== '') ?? '').trim();
      ok(first === defs[m], `AC5.3: ${file} mục ${m} mở đầu bằng đúng câu định nghĩa`);
    }
  }

  const readmes = [
    ['README.md', '**Permission modes (`aip mode`).**', EN],
    ['README_VI.md', '**Chế độ quyền (`aip mode`).**', MODE_DEFS],
  ];
  for (const [file, lead, defs] of readmes) {
    const sec = slice(raw(file), lead, /\n\*\*|\n## /);
    for (const m of modes) ok(sec.includes(defs[m]), `AC5.4: ${file} mục chế độ quyền chứa nguyên văn câu định nghĩa ${m}`);
  }
}
