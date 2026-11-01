// Contract routing: bảng định tuyến của orchestrator đọc được bằng route.mjs, ba brief mẫu chạy qua bảng thật
// ra đúng route, và chỉ workflow_result có status misrouted (agent_result thì không).
const COND_RE = /^(loại-việc|phạm-vi|rủi-ro)(!=|=|~)(.+)$/u;
const splitCell = (c) => (c ?? '').split(',').map((s) => s.trim()).filter(Boolean);

// Đọc thô để thấy ô sai cú pháp: parseRoutes bỏ qua ô không khớp nên không tự báo lỗi điều-kiện,
// và dòng lệch số ô là dấu hiệu của `|` lạc vào trong ô.
function rawRows(text, heading) {
  const ls = text.split('\n');
  const at = ls.findIndex((l) => l.trim() === `## ${heading}`);
  if (at === -1) return { rows: [], broken: [`thiếu mục ## ${heading}`] };
  const end = ls.findIndex((l, i) => i > at && /^## /.test(l));
  const table = ls.slice(at + 1, end === -1 ? ls.length : end).filter((l) => l.trim().startsWith('|'));
  const cellsOf = (l) => l.split('|').slice(1, -1).map((c) => c.trim());
  const [head, , ...body] = table;
  const names = cellsOf(head);
  const broken = body.filter((l) => cellsOf(l).length !== names.length).map((l) => l.trim().slice(0, 60));
  return { rows: body.map((l) => Object.fromEntries(names.map((n, i) => [n, cellsOf(l)[i] ?? '']))), broken };
}

export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, CORE_DIR } = ctx;
  const route = await import(ctx.pathToFileURL(path.join(REPO_ROOT, 'core', 'skills', 'brainstorming', 'scripts', 'route.mjs')).href);
  const { TYPES, SCOPES, parseRoutes, parseBrief, routeBrief } = route;
  const orch = fs.readFileSync(path.join(REPO_ROOT, 'workflows', 'orchestrator', 'WORKFLOW.md'), 'utf8').replace(/\r\n/g, '\n');

  const TYPE_SET = new Set([...TYPES, '*', '—']);
  const SCOPE_SET = new Set([...SCOPES, '*', '—']);
  for (const heading of ['Registry', 'Yêu cầu chạy trực tiếp bằng skill']) {
    const { rows, broken } = rawRows(orch, heading);
    ok(broken.length === 0, `AC2.1: bảng "${heading}" không có dòng lệch số ô (dấu | trong ô?)${broken.length ? ' — ' + broken.join(' | ') : ''}`);
    for (const row of rows) {
      const name = (row.id ?? row['Tín hiệu'] ?? '').replace(/`/g, '').slice(0, 40);
      ok(['loại-việc', 'phạm-vi', 'điều-kiện'].every((k) => k in row), `AC2.1: ${name} có đủ ba cột loại-việc, phạm-vi, điều-kiện`);
      const types = splitCell(row['loại-việc']);
      ok(types.length > 0 && types.every((t) => TYPE_SET.has(t)), `AC2.1: ${name} loại-việc ⊂ TYPES, * hoặc —`);
      const scopes = splitCell(row['phạm-vi']);
      ok(scopes.length > 0 && scopes.every((s) => SCOPE_SET.has(s)), `AC2.1: ${name} phạm-vi ⊂ SCOPES, * hoặc —`);
      if (name.startsWith('workflow-')) {
        ok(types.some((t) => TYPES.includes(t)), `AC2.1: ${name} có ít nhất một loại-việc thật`);
      }
      const conds = splitCell(row['điều-kiện']).filter((c) => c !== '—');
      const badCond = conds.filter((c) => {
        const m = c.match(COND_RE);
        if (!m) return true;
        if (m[1] === 'rủi-ro' || m[2] === '~') return false;
        const allowed = m[1] === 'loại-việc' ? TYPES : SCOPES;
        return m[3].split('/').some((v) => !allowed.includes(v.trim()));
      });
      ok(badCond.length === 0, `AC2.1: ${name} điều-kiện đúng cú pháp${badCond.length ? ' — sai: ' + badCond.join(', ') : ''}`);
    }
  }

  // Brief mẫu chạy qua parseBrief + routeBrief với bảng thật; đổi bảng mà lệch route là lỗi của contract này.
  const routes = parseRoutes(orch);
  const brief = (type, scope) => ['# Brief: mẫu', '', '## Định tuyến', `loại-việc: ${type}`, `phạm-vi: ${scope}`,
    'đầu-ra-mong-đợi: mẫu', 'rủi-ro: —', 'ứng-viên-route: []', ''].join('\n');
  const pick = (type, scope) => routeBrief(parseBrief(brief(type, scope)), routes);

  const feat = pick('feature', 'fullstack');
  ok(feat.chosen?.id === 'workflow-feature', `AC2.1: brief feature/fullstack → workflow-feature (chosen=${JSON.stringify(feat.chosen)})`);
  const adr = pick('quyết-định', 'không-code');
  ok(adr.chosen?.id === 'engineering-adr' && adr.chosen.kind === 'skill', `AC2.1: brief quyết-định/không-code → skill engineering-adr (chosen=${JSON.stringify(adr.chosen)})`);
  const none = pick('nghiên-cứu', 'không-code');
  ok(none.chosen === null && none.confidence === 'none', `AC2.3: brief nghiên-cứu/không-code → chosen null, confidence none (chosen=${JSON.stringify(none.chosen)}, confidence=${none.confidence})`);

  // Operational contract: orchestrator phải gọi đúng lệnh, dùng đúng khoá và đúng giá trị status.
  for (const [token, ac] of [['route.mjs', 'AC2.2'], ['route-đã-duyệt', 'AC3.1'], ['--exclude', 'AC3.2'], ['--log', 'AC5.1'], ['misrouted', 'AC3.2']]) {
    ok(orch.includes(token), `${ac}: orchestrator nêu ${token}`);
  }

  // status: misrouted chỉ thuộc workflow_result; agent_result là worker, không định tuyến.
  const contract = fs.readFileSync(path.join(CORE_DIR, 'principles', 'workflow-output-contract.md'), 'utf8').replace(/\r\n/g, '\n').split('\n');
  const statusUnder = (key) => {
    const at = contract.indexOf(`${key}:`);
    return at === -1 ? undefined : contract.slice(at + 1).find((l) => /^\s+status:/.test(l));
  };
  const wfStatus = statusUnder('workflow_result') ?? '';
  const arStatus = statusUnder('agent_result') ?? '';
  ok(wfStatus.includes('misrouted'), `AC3.2: workflow_result.status có misrouted (dòng: "${wfStatus.trim()}")`);
  ok(arStatus !== '' && !arStatus.includes('misrouted'), `AC3.2: agent_result.status không có misrouted (dòng: "${arStatus.trim()}")`);

  // Bước 1 của bốn workflow pipeline: kiểm điều-kiện trong Hành động và trả misrouted trong Khi fail.
  // Khoanh theo trường để chữ ở trường khác của bước không làm đạt điều kiện.
  const readWorkflow = (id) => fs.readFileSync(path.join(REPO_ROOT, 'workflows', id, 'WORKFLOW.md'), 'utf8').replace(/\r\n/g, '\n').split('\n');
  const section = (lines, n) => {
    const at = lines.findIndex((l) => l.startsWith(`### Bước ${n} —`));
    if (at === -1) return [];
    const end = lines.findIndex((l, i) => i > at && l.startsWith('### '));
    return lines.slice(at, end === -1 ? lines.length : end);
  };
  const field = (lines, name) => {
    const at = lines.findIndex((l) => l.startsWith(`- **${name}:**`));
    if (at === -1) return '';
    const end = lines.findIndex((l, i) => i > at && l.startsWith('- **'));
    return lines.slice(at, end === -1 ? lines.length : end).join('\n');
  };
  for (const id of ['feature', 'bugfix', 'security-review', 'performance']) {
    const step1 = section(readWorkflow(id), 1);
    ok(field(step1, 'Khi fail').includes('misrouted'), `AC3.2: workflow-${id} Bước 1 trả misrouted trong Khi fail`);
    ok(field(step1, 'Hành động').includes('điều-kiện'), `AC3.2: workflow-${id} Bước 1 kiểm điều-kiện trong Hành động`);
  }

  // Bước 2 của feature: request có brief.md thì việc đọc brief nằm trong Hành động.
  const featureStep2 = section(readWorkflow('feature'), 2);
  ok(field(featureStep2, 'Hành động').includes('brief.md'), 'AC4.1: workflow-feature Bước 2 đọc brief.md trong Hành động');
}
