// Pin: merge local tay (lựa chọn 1 của G3) đi cùng cơ chế --no-commit/--abort như merge local theo khoá — suite đỏ không được để lại commit merge trên nhánh gốc.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const fin = fs.readFileSync(path.join(REPO_ROOT, 'core/skills/plan-execution/references/finish.md'), 'utf8').replace(/\r\n/g, '\n');
  const section = (h) => (fin.match(new RegExp(`^## ${h}\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm')) ?? [])[1] ?? '';
  const mech = section('Merge local theo khoá');
  const manual = (fin.match(/^- \*\*merge local\*\*[\s\S]*?(?=^- \*\*|^## )/m) ?? [''])[0];

  ok(/git merge --no-ff --no-commit/.test(mech) && /git merge --abort/.test(mech), 'AC5.1: mục "Merge local theo khoá" có --no-commit và --abort');
  ok(manual !== '' && /--no-commit/.test(manual) && /--abort/.test(manual) && !/kết quả merge/.test(fin),
    'AC1.1, AC5.1: bullet merge local tay trỏ tới cơ chế --no-commit/--abort và finish.md không còn "full suite trên kết quả merge"');
}
