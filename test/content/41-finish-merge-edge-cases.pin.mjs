// Pin: "Merge local theo khoá" phải nêu hai lỗi chặn biên (nhánh feature đã là tổ tiên của nhánh gốc; git từ chối bắt đầu merge nên không có MERGE_HEAD để abort) và giữ bước 1–5.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const fin = fs.readFileSync(path.join(REPO_ROOT, 'core/skills/plan-execution/references/finish.md'), 'utf8').replace(/\r\n/g, '\n');
  const mech = (fin.match(/^## Merge local theo khoá\n([\s\S]*?)(?=^## |$(?![\s\S]))/m) ?? [])[1] ?? '';

  ok(/git merge-base --is-ancestor/.test(mech) && /MERGE_HEAD/.test(mech) && [1, 2, 3, 4, 5].every((n) => new RegExp(`^${n}\\. `, 'm').test(mech)),
    'AC5.1: "Merge local theo khoá" có --is-ancestor và MERGE_HEAD cho hai ca biên, giữ bước 1–5');
}
