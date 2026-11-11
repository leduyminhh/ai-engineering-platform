// Pin: part 01-core của request 2026-11-11-skill-enrichment-from-usage (cỡ task, vai phiên, luật git).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (rel) => {
    try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; }
  };
  const section = (txt, heading) => {
    const lines = txt.split('\n');
    const start = lines.findIndex((l) => l.trim() === heading);
    if (start < 0) return null;
    let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
    if (end < 0) end = lines.length;
    return lines.slice(start, end);
  };
  const PE = 'core/skills/plan-execution';
  const taskLoop = read(`${PE}/references/task-loop.md`);
  const taskSize = read(`${PE}/references/task-size.md`);
  const skillMd = read(`${PE}/SKILL.md`);

  // AC2.1
  const H_SIZE = '## Cỡ task và review từng task';
  const sec = section(taskLoop, H_SIZE);
  ok(sec !== null, 'AC2.1: task-loop.md có mục "Cỡ task và review từng task"');
  if (sec) {
    const lines = sec.length;
    const body = sec.join('\n');
    const linksDetail = /task-size\.md/.test(body);
    ok(lines <= 25 || linksDetail, `AC2.1: mục ≤ 25 dòng hoặc chuyển chi tiết sang task-size.md (có ${lines})`);
    const full = lines <= 25 ? body : `${body}\n${taskSize}`;
    ok(/FE-UI/.test(full) && /TOOLING/.test(full), 'AC2.1: nêu Kind cỡ Nhỏ FE-UI và TOOLING');
    ok(/\*\*TDD:\*\* không/.test(full) && /5 file/.test(full), 'AC2.1: nêu điều kiện TDD không và ≤ 5 file production');
    ok(/migration/.test(full) && /(auth|phân quyền)/.test(full) && /(secret|credential)/.test(full) && /(CI|hook)/.test(full) && /(contract API|schema)/.test(full),
      'AC2.1: nêu đường dẫn nhạy cảm và đổi contract/schema');
    ok(['BE', 'DB', 'CT', 'FE-INT', 'E2E', 'DOCS'].every((k) => full.includes(`\`${k}\``)) && /\*\*TDD:\*\* có/.test(full),
      'AC2.1: cỡ Lớn gồm BE, DB, CT, FE-INT, E2E, DOCS và TDD có luôn review');
    ok(/Gom task nhỏ/.test(full), 'AC2.1: trỏ mục "Gom task nhỏ" cho cỡ Vừa');
  }
  const iSize = taskLoop.indexOf(H_SIZE);
  const iGom = taskLoop.indexOf('## Gom task nhỏ');
  ok(iSize >= 0 && iGom > iSize, 'AC2.1: mục cỡ task đặt trước "Gom task nhỏ"');
  ok(/task-loop\.md[^\n]*Cỡ task|Cỡ task và review từng task/.test(skillMd), 'AC2.1: SKILL.md trỏ mục cỡ task');
  ok(skillMd.split('\n').length <= 300, 'AC2.1: plan-execution SKILL.md ≤ 300 dòng');
}
