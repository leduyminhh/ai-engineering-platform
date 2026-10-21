// Pin: long-session context rules (docs/requests/2026-10-21-long-session-context). Task 5: baseline (AC1.1, AC1.2, AC2.2, AC4.1).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8');

  const tpl = read('core', 'agents', 'AGENTS.template.md');
  const start = tpl.indexOf('### Model and session routing');
  const rest = start < 0 ? '' : tpl.slice(start + 5);
  const next = rest.indexOf('\n### ');
  const sec = start < 0 ? '' : tpl.slice(start, next < 0 ? tpl.length : start + 5 + next);

  ok(['handoff.md', 'foreground', 'one line', '1 hour', 'statusline'].every((s) => sec.includes(s)),
    'AC1.1: mục có quy tắc phiên dài');

  ok(['[Inference]', '[Unverified]', 'code.claude.com/docs/en/prompt-caching'].every((s) => sec.includes(s)),
    'AC1.2: mọi con số có nguồn hoặc nhãn');

  ok(sec.split('\n').some((l) => l.includes('statusline') && l.includes('hook') && l.includes('cannot')),
    'AC2.2: nêu ai đọc được % context');

  ok(sec.includes('/usage'), 'AC4.1: có quy tắc ghi % context ở cổng phase');

  const norm = (s) => s.replace(/\r\n/g, '\n');
  ok(norm(read('AGENTS.md')) === norm(tpl), 'AC1.1: AGENTS.md == AGENTS.template.md');
}
