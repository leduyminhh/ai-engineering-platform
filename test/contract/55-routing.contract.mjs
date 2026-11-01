// Contract routing: bảng định tuyến của orchestrator đọc được bằng route.mjs, từng bước của orchestrator nêu đúng
// lệnh và giá trị vận hành, các mẫu brief chạy qua bảng thật ra đúng route, và chỉ workflow_result có status misrouted.
const splitCell = (c) => (c ?? '').split(',').map((s) => s.trim()).filter(Boolean);
// Tập cờ của route.mjs; route.mjs phải còn khai báo từng cờ (khoá drift bên dưới).
const ROUTE_FLAGS = ['--exclude', '--log', '--chosen', '--overridden', '--misrouted'];

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

// Cắt theo "### Bước N —" tới heading kế tiếp, để kiểm chữ đúng trong đúng bước.
function stepText(text, n) {
  const ls = text.split('\n');
  const at = ls.findIndex((l) => l.startsWith(`### Bước ${n} —`));
  if (at === -1) return '';
  const end = ls.findIndex((l, i) => i > at && /^#{2,3} /.test(l));
  return ls.slice(at, end === -1 ? ls.length : end).join('\n');
}

export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, CORE_DIR } = ctx;
  const routeFile = path.join(REPO_ROOT, 'core', 'skills', 'brainstorming', 'scripts', 'route.mjs');
  const route = await import(ctx.pathToFileURL(routeFile).href);
  const { TYPES, SCOPES, COND_RE, parseRoutes, parseBrief, routeBrief } = route;
  const routeSrc = fs.readFileSync(routeFile, 'utf8');
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
        const vals = m[3].split('/').map((v) => v.trim());
        if (vals.some((v) => v === '')) return true;
        if (m[1] === 'rủi-ro' || m[2] === '~') return false;
        const allowed = m[1] === 'loại-việc' ? TYPES : SCOPES;
        return vals.some((v) => !allowed.includes(v));
      });
      ok(badCond.length === 0, `AC2.1: ${name} điều-kiện đúng cú pháp${badCond.length ? ' — sai: ' + badCond.join(', ') : ''}`);
    }
  }

  // Mẫu brief chạy qua parseBrief + routeBrief với bảng thật; đổi bảng mà lệch route là lỗi của contract này.
  const routes = parseRoutes(orch);
  const brief = (type, scope, risk) => ['# Brief: mẫu', '', '## Định tuyến', `loại-việc: ${type}`, `phạm-vi: ${scope}`,
    'đầu-ra-mong-đợi: mẫu', `rủi-ro: ${risk}`, 'ứng-viên-route: []', ''].join('\n');
  const pick = (type, scope, risk = '—') => routeBrief(parseBrief(brief(type, scope, risk)), routes);

  // [AC, nhãn, loại-việc, phạm-vi, rủi-ro, id mong đợi, kind mong đợi]
  const SAMPLES = [
    ['AC2.1', 'feature/fullstack', 'feature', 'fullstack', '—', 'workflow-feature', 'workflow'],
    ['AC2.1', 'feature/data', 'feature', 'data', '—', 'data-db-migration', 'skill'],
    ['AC2.1', 'quyết-định/không-code', 'quyết-định', 'không-code', '—', 'engineering-adr', 'skill'],
    ['AC2.1', 'bug/code-be', 'bug', 'code-be', '—', 'workflow-bugfix', 'workflow'],
    ['AC2.1', 'nghiên-cứu/code-be rủi-ro hiệu năng chậm', 'nghiên-cứu', 'code-be', 'hiệu năng chậm', 'workflow-performance', 'workflow'],
    ['AC2.1', 'nghiên-cứu/code-be rủi-ro lỗ hổng bảo mật', 'nghiên-cứu', 'code-be', 'lỗ hổng bảo mật', 'workflow-security-review', 'workflow'],
    ['AC2.1', 'tài-liệu/không-code', 'tài-liệu', 'không-code', '—', 'làm-trong-phiên', 'in-session'],
  ];
  for (const [ac, label, type, scope, risk, id, kind] of SAMPLES) {
    const r = pick(type, scope, risk);
    ok(r.chosen?.id === id && r.chosen?.kind === kind, `${ac}: ${label} → ${id} (${kind}) (chosen=${JSON.stringify(r.chosen)})`);
  }
  const none = pick('nghiên-cứu', 'không-code');
  ok(none.chosen === null && none.confidence === 'none', `AC2.3: nghiên-cứu/không-code → chosen null, confidence none (chosen=${JSON.stringify(none.chosen)}, confidence=${none.confidence})`);
  // Bug kèm rủi ro bảo mật khớp cả bugfix lẫn security-review cùng 6 điểm: không được chọn bugfix với độ tin cậy cao.
  const sqli = pick('bug', 'code-be', 'SQL injection lộ secret');
  const pair = (sqli.candidates ?? []).map((c) => c.id).sort().join(',');
  ok(sqli.chosen === null && sqli.confidence === 'low' && pair === 'workflow-bugfix,workflow-security-review',
    `AC2.2: bug/code-be + "SQL injection lộ secret" → hai ứng viên, không chọn bugfix (chosen=${JSON.stringify(sqli.chosen)}, candidates=${pair})`);

  // Từng bước của orchestrator nêu đúng lệnh và giá trị vận hành; kiểm trong đúng bước để chữ ở bước khác không đạt thay.
  ok(stepText(orch, 1).includes('route.mjs'), 'AC2.2: Bước 1 của orchestrator gọi route.mjs');
  ok(stepText(orch, 1).includes('route-đã-duyệt') && stepText(orch, 1).includes('--exclude'),
    'AC3.1: Bước 1 nêu route-đã-duyệt và --exclude (lượt quay lại bỏ qua route đã duyệt)');
  ok(stepText(orch, 1).includes('--log'), 'AC5.1: Bước 1 ghi --log khi dừng ở nhánh không chạy workflow');
  ok(stepText(orch, 3).includes('route-đã-duyệt'), 'AC3.1: Bước 3 nêu route-đã-duyệt khi bỏ qua xác nhận');
  ok(stepText(orch, 4).includes('misrouted') && stepText(orch, 4).includes('--exclude'), 'AC3.2: Bước 4 nêu misrouted và --exclude');
  ok(stepText(orch, 5).includes('--log'), 'AC5.1: Bước 5 có lệnh --log');
  ok(stepText(orch, 5).includes('blocked'), 'AC3.2: Bước 5 nêu blocked khi hết route sau misrouted');

  // Cờ trong lệnh route.mjs của orchestrator phải thuộc tập cờ thật; route.mjs phải còn khai báo từng cờ.
  for (const f of ROUTE_FLAGS) ok(routeSrc.includes(f), `AC5.1: route.mjs còn khai báo cờ ${f}`);
  const cmdSpans = [...orch.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]).filter((s) => s.includes('route.mjs') || s.startsWith('--'));
  const flags = cmdSpans.flatMap((s) => s.match(/--[a-z]+/g) ?? []);
  const unknown = [...new Set(flags)].filter((f) => !ROUTE_FLAGS.includes(f));
  ok(flags.length > 0 && unknown.length === 0, `AC5.1: cờ trong lệnh route.mjs của orchestrator đều thuộc tập cờ route.mjs${unknown.length ? ' — lạ: ' + unknown.join(', ') : ''}`);

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
