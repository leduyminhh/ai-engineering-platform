// Pin: tài liệu chế độ quyền (docs/requests/2026-10-22-permission-modes), AC3.1 và AC3.2; AC7.1 của 2026-11-12-scoped-path-permissions;
// AC5.4, AC5.5 của 2026-11-19-permission-modes-standard (tên guarded/confined/open, bí danh ask/full, CHANGELOG).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const raw = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8');
  const flat = (s) => s.replace(/\s+/g, ' ');
  // Mục chế độ quyền bắt đầu bằng neo in đậm, kết thúc ở đoạn in đậm kế tiếp hoặc H2 kế tiếp.
  const para = (s, lead) => {
    const i = s.indexOf(lead);
    if (i < 0) return '';
    const rest = s.slice(i + lead.length);
    const m = rest.search(/\n\*\*|\n## /);
    return flat(s.slice(i, m < 0 ? undefined : i + lead.length + m));
  };

  const template = raw('core', 'agents', 'AGENTS.template.md');
  const bullet = flat((template.match(/- \*\*[^\n]*\n(?:  [^\n]*\n?)*/g) ?? []).find((b) => b.includes('aip-gate.json') && b.includes('bypassPermissions')) ?? '');
  const needBullet = ['aip-gate.json', '`confined`', '`open`', 'bypassPermissions', 'fullKeep'];
  ok(bullet !== '' && needBullet.every((w) => bullet.includes(w)) && /push/i.test(bullet) && /protected/i.test(bullet),
    'P4e AC3.1 AC5.5: bullet Safety của template nêu aip-gate.json, confined, open, bypassPermissions, fullKeep và push nhánh bảo vệ');

  const cases = [
    ['README.md', '**Permission modes (`aip mode`).**'],
    ['README_VI.md', '**Chế độ quyền (`aip mode`).**'],
  ];
  for (const [file, lead] of cases) {
    const text = raw(file);
    const sec = para(text, lead);
    const warn = file === 'README.md'
      ? [['project settings.json cannot turn bypass on', 'cannot turn bypass on'], ['deletion of an important path may still prompt', 'delete on an important path may still prompt']]
      : [['settings.json của project không bật được bypass', 'không bật được bypass'], ['lệnh xóa ở đường dẫn quan trọng vẫn có thể hỏi', 'đường dẫn quan trọng vẫn có thể hỏi']];
    for (const [what, phrase] of warn) ok(sec.includes(phrase), `P4e AC3.2: ${file} mục chế độ quyền có cảnh báo: ${what}`);
    const need = ['aip mode', 'bypassPermissions', 'fullKeep', 'fullRoots', '[Unverified]', 'Windows', 'sandbox'];
    ok(sec !== '' && need.every((w) => sec.includes(w)), `P4e AC3.2: ${file} mục chế độ quyền nêu ${need.join(', ')}`);
    ok(/^aip mode\s+guarded\|confined\|open\|status/m.test(text), `P4e AC3.2 AC5.4: ${file} danh sách lệnh CLI có aip mode guarded|confined|open|status`);
    const alias = ['`"ask"`', '`"full"`', '`aip mode guarded`'];
    ok(alias.every((w) => sec.includes(w)), `AC5.4: ${file} mục chế độ quyền nêu bí danh "ask"/"full" và aip mode guarded`);
    // Dòng giới hạn cũ về ask trong bypass phải ghi nhận kết quả đã kiểm (claude -p) và vẫn gắn nhãn cho phần tương tác.
    const old = text.split('\n').find((l) => l.startsWith('- ') && l.includes('bypassPermissions') && l.includes('[Unverified]') && l.includes('claude -p')) ?? '';
    ok(old !== '', `P4e AC3.2: ${file} dòng [Unverified] về ask trong bypass ghi kết quả đã kiểm bằng claude -p`);
  }

  // AC5.5: mục breaking dưới [Unreleased] nêu confined từ chối thay vì hỏi và bí danh.
  const log = raw('CHANGELOG.md');
  const unreleased = log.slice(log.indexOf('## [Unreleased]'), log.indexOf('\n## [', log.indexOf('## [Unreleased]') + 1));
  const breaking = unreleased.split('\n').find((l) => l.includes('BREAKING') && l.includes('confined')) ?? '';
  ok(['`deny`', '`ask`', '`full`', '`guarded`'].every((w) => breaking.includes(w)), 'AC5.5: CHANGELOG [Unreleased] có mục BREAKING nêu confined từ chối (deny) thay vì hỏi (ask) và bí danh ask/full');

  const claude = raw('CLAUDE.md');
  // Dòng lệnh `aip mode` đã rời CLAUDE.md (167a3520); README ở trên vẫn pin lệnh, CLAUDE.md chỉ còn các khoá cấu hình.
  ok(['mode', 'fullKeep', 'fullRoots'].every((w) => claude.includes('`' + w + '`')),
    'P4e AC3.2: CLAUDE.md nhắc khoá mode/fullKeep/fullRoots');

  // AC7.1: chỉ ghim tên khoá fullPaths và ba giá trị allow, không ghim đoạn văn.
  ok(['README.md', 'README_VI.md', 'CLAUDE.md'].every((f) => raw(f).includes('fullPaths')),
    'P4e AC7.1: README, README_VI và CLAUDE.md nêu khoá fullPaths');
  ok(claude.split('\n').some((l) => l.includes('fullPaths') && l.includes('fullRoots')),
    'P4e AC7.1: CLAUDE.md nêu fullPaths cạnh fullRoots');
  for (const f of ['README.md', 'README_VI.md']) {
    const text = raw(f);
    ok(['"read"', '"write"', '"delete"'].every((v) => text.includes(v)),
      `P4e AC7.1: ${f} nêu ba giá trị allow read, write, delete`);
  }
}
