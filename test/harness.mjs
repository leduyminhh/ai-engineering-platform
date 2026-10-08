// Harness dùng chung cho validate: gom ok()/fails và lọc module bằng --only <substr> (lặp được).
// `--only` thiếu giá trị (hoặc theo sau là một flag khác) là lỗi dùng sai, không được lặng lẽ chạy hết mọi module.
export function parseOnly(argv) {
  const onlys = [];
  let error = null;
  const need = '--only cần một giá trị (tên module hoặc chuỗi con), vd --only versions';
  argv.forEach((a, i) => {
    if (a.startsWith('--only=')) {
      const v = a.slice('--only='.length);
      if (!v) error = need; else onlys.push(v);
      return;
    }
    if (a !== '--only') return;
    const v = argv[i + 1];
    if (!v || v.startsWith('--')) error = need;
    else onlys.push(v);
  });
  return { onlys, error };
}

export function createHarness(argv = process.argv.slice(2)) {
  let pass = 0;
  const fails = [];
  const { onlys, error } = parseOnly(argv);
  // Tên module có tiền tố số để cố định thứ tự chạy; khớp theo phần còn lại để `--only content/task-breakdown`
  // không kéo theo `task-breakdown-integration` (khớp đúng tên được ưu tiên hơn khớp chuỗi con).
  const stem = (name) => name.replace(/(^|\/)\d+-/, '$1').replace(/\.(contract|pin)\.mjs$/, '');
  const baseStem = (name) => stem(name).split('/').pop();
  return {
    onlyError: error,
    ok: (cond, msg) => { if (cond) pass++; else fails.push(msg); },
    fails,
    pass: () => pass,
    only: (name, all = [name]) => onlys.length === 0 || onlys.some((o) => {
      const exact = (n) => stem(n) === o || baseStem(n) === o;
      return all.some(exact) ? exact(name) : name.includes(o);
    }),
    summary: () => ({ pass, fails: [...fails] }),
  };
}
