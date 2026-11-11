// Pin: data-db-migration — đánh số migration khi nhánh song song (request 2026-11-11-skill-enrichment-from-usage, part 05).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const dir = path.join(REPO_ROOT, 'plugins/data/skills/data-db-migration');
  const read = (rel) => { try { return fs.readFileSync(path.join(dir, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };
  const skill = read('SKILL.md');
  const lines = skill.split('\n');
  const extra = read('references/change/migration-numbering.md');
  const all = skill + '\n' + extra;

  ok(lines.length <= 300, `AC6.1: SKILL.md ≤ 300 dòng (có ${lines.length})`);

  for (const cmd of ['git worktree list', 'git branch --list', 'git ls-tree -r --name-only <nhánh> -- <thư mục migration>']) {
    ok(all.includes(cmd), `AC6.1: có lệnh "${cmd}"`);
  }
  ok(/## Dự trữ số migration/.test(all), 'AC6.1: trỏ mục "## Dự trữ số migration"');
  ok(all.includes('| Part | Dải số | Trạng thái |'), 'AC6.1: nêu ba cột bảng dự trữ');
  ok(/chọn số cao hơn/.test(all), 'AC6.1: số đã bị giữ thì chọn số cao hơn');
  ok(/phiên gốc/.test(all) && /trước (khi chạy )?nhóm song song/.test(all), 'AC6.1: phiên gốc ghi dải trước nhóm song song');
  ok(/chỉ chọn số trong dải/.test(all), 'AC6.1: part chỉ chọn số trong dải của mình');
  ok(/nhánh số thấp merge trước/.test(all), "AC6.2: nhánh số thấp merge trước");
  ok(/trùng số/.test(all) && /đổi số của nhánh chưa phát hành/.test(all) && /`Ruling:`/.test(all), "AC6.2: trùng số thì đổi số nhánh chưa phát hành và ghi Ruling");
  ok(/không đổi số hay nội dung migration đã áp lên DB dùng chung/i.test(all) && /checksum/.test(all), "AC6.2: không đổi số/nội dung migration đã áp lên DB dùng chung (checksum)");
  const st = lines.findIndex((l) => l.trim() === "## Dấu hiệu đang tự biện minh");
  let en = lines.findIndex((l, i) => i > st && /^## /.test(l)); if (en < 0) en = lines.length;
  const rows = st < 0 ? 0 : lines.slice(st, en).filter((l) => l.startsWith("| \"")).length;
  ok(rows === 6, `AC6.2: bảng tự biện minh tăng đúng một dòng (5 → 6, có ${rows})`);
}
