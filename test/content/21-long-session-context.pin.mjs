// Pin: long-session context rules (docs/requests/2026-10-21-long-session-context). Task 5: baseline (AC1.1, AC1.2, AC2.2, AC4.1); Task 6: README + script test (AC5.1, AC6.1).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8');

  const tpl = read('core', 'agents', 'AGENTS.template.md');
  const start = tpl.indexOf('### Model and session routing');
  const rest = start < 0 ? '' : tpl.slice(start + 5);
  const next = rest.indexOf('\n### ');
  const sec = start < 0 ? '' : tpl.slice(start, next < 0 ? tpl.length : start + 5 + next);

  const mr = read('core', 'skills', 'plan-execution', 'references', 'model-routing.md');

  ok(['handoff.md', 'foreground', '[Inference]'].every((s) => sec.includes(s))
    && ['1 hour', 'statusline', 'sends the parent one line', 'bounds its output', 'instead of ending the turn',
      'cheaper to replace than', 'open a new session from `handoff.md`', 'Record each session'].every((s) => mr.includes(s)),
    'AC1.1: baseline giữ quy tắc phiên dài cốt lõi, chi tiết ở model-routing.md');

  ok(['[Inference]', '[Unverified]', 'code.claude.com/docs/en/prompt-caching'].every((s) => mr.includes(s)),
    'AC1.2: mọi con số có nguồn hoặc nhãn');

  ok(mr.split('\n').some((l) => l.includes('statusline') && l.includes('hook') && l.includes('cannot')),
    'AC2.2: nêu ai đọc được % context');

  ok(mr.includes('/usage'), 'AC4.1: có quy tắc ghi % context ở cổng phase');

  const norm = (s) => s.replace(/\r\n/g, '\n');

  for (const f of ['README.md', 'README_VI.md']) {
    const t = read(f);
    ok(t.includes('autoCompactWindow') && t.includes('CLAUDE_CODE_AUTO_COMPACT_WINDOW'),
      `AC5.1: ${f} nêu cách đặt cửa sổ nén`);
  }

  ok(String(JSON.parse(read('package.json')).scripts.test).includes('transcript-stats.test.mjs'),
    'AC6.1: npm test chạy transcript-stats.test.mjs');
}
