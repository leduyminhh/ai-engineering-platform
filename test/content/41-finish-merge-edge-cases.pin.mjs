// Pin: "Merge local theo khoá" phải nêu hai lỗi chặn biên (nhánh feature đã là tổ tiên của nhánh gốc; git từ chối bắt đầu merge nên không có MERGE_HEAD để abort) và giữ bước 1–5; WORKFLOW.md, error-matrix.md và spec R7 mô tả cùng hai ca.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (p) => fs.readFileSync(path.join(REPO_ROOT, p), 'utf8').replace(/\r\n/g, '\n');
  const fin = read('core/skills/plan-execution/references/finish.md');
  const mech = (fin.match(/^## Merge local theo khoá\n([\s\S]*?)(?=^## |$(?![\s\S]))/m) ?? [])[1] ?? '';
  const both = (s) => /git merge-base --is-ancestor/.test(s) && /MERGE_HEAD/.test(s);

  ok(both(mech) && [1, 2, 3, 4, 5].every((n) => new RegExp(`^${n}\\. `, 'm').test(mech)),
    'AC1.1, AC2.1, AC5.1: "Merge local theo khoá" có --is-ancestor và MERGE_HEAD cho hai ca biên, giữ bước 1–5');

  const at = (s) => s.indexOf('git checkout <nhánh gốc>');
  ok(at(mech) !== -1 && at(mech) < mech.indexOf('git merge --no-ff --no-commit'),
    'AC1.1, AC4.1: "Merge local theo khoá" chuyển nhánh bằng git checkout <nhánh gốc> trước git merge --no-ff --no-commit (checkout lỗi là lỗi chặn)');

  const mirrors = ['workflows/feature/WORKFLOW.md', 'workflows/feature/references/error-matrix.md', 'docs/specs/workflows/spec.md'];
  const missing = mirrors.filter((p) => !/MERGE_HEAD/.test(read(p)));
  ok(missing.length === 0, `AC3.1, AC4.1: WORKFLOW.md, error-matrix.md và spec R7 nêu MERGE_HEAD (--abort chỉ khi có merge)${missing.length ? ` (thiếu ở: ${missing.join(', ')})` : ''}`);
}
