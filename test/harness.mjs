// Harness dùng chung cho validate: gom ok()/fails và lọc module bằng --only <substr> (lặp được).
export function createHarness(argv = process.argv.slice(2)) {
  let pass = 0;
  const fails = [];
  const onlys = argv.flatMap((a, i) => (a === '--only' && argv[i + 1] ? [argv[i + 1]] : []));
  // Tên module có tiền tố số để cố định thứ tự chạy; khớp theo phần còn lại để `--only content/task-breakdown`
  // không kéo theo `task-breakdown-integration` (khớp đúng tên được ưu tiên hơn khớp chuỗi con).
  const stem = (name) => name.replace(/(^|\/)\d+-/, '$1').replace(/\.(contract|pin)\.mjs$/, '');
  const baseStem = (name) => stem(name).split('/').pop();
  return {
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
