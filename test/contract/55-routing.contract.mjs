// Contract routing: bảng định tuyến của orchestrator đọc được bằng route.mjs, từng bước của orchestrator nêu đúng
// chuỗi lệnh và giá trị vận hành, các mẫu brief chạy qua bảng thật ra đúng route, và chỉ workflow_result có status misrouted.
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

// Lấy một trường "- **Tên:**" của bước; kết thúc ở bullet cột 0 kế tiếp (gạch thụt lề của Hành động không cắt).
function fieldOf(lines, name) {
  const at = lines.findIndex((l) => l.startsWith(`- **${name}:**`));
  if (at === -1) return '';
  const end = lines.findIndex((l, i) => i > at && l.startsWith('- **'));
  return lines.slice(at, end === -1 ? lines.length : end).join('\n');
}

// Phủ định ngay trước "trả" của status misrouted: "không trả", "không được trả", "chớ trả", "đừng trả".
const isNegated = (s) => /(?:không|chớ|đừng)\s+(?:được\s+)?trả\s[^.]*misrouted/.test(s);

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

  // Chuỗi lệnh đầy đủ theo bước: một cờ bị xoá hoặc đổi thứ tự làm chuỗi không khớp và test đỏ.
  const s1 = stepText(orch, 1);
  ok(s1.includes('route.mjs <brief.md> <WORKFLOW.md của orchestrator> [--exclude id,id]'), 'AC2.2: Bước 1 có lệnh route.mjs kèm --exclude');
  ok(s1.includes('route-đã-duyệt') && s1.includes('`error`'), 'AC3.1: Bước 1 nêu route-đã-duyệt và khoá error của route.mjs');
  ok(s1.includes('làm-trong-phiên') && s1.includes('chưa-có-quy-trình'), 'AC3.1: Bước 1 nêu giá trị làm-trong-phiên và chưa-có-quy-trình của route-đã-duyệt');
  ok(s1.includes('--log <brief.md> --chosen <id|-> [--overridden]'), 'AC5.1: Bước 1 ghi nhật ký với --chosen và --overridden');
  ok(stepText(orch, 2).includes('--log <brief.md> --chosen <id workflow>'), 'AC5.1: Bước 2 ghi nhật ký khi workflow chưa cài');
  const s3 = stepText(orch, 3);
  const h3 = fieldOf(s3.split('\n'), 'Hành động');
  ok(h3.includes('route-đã-duyệt'), 'AC3.1: Bước 3 Hành động có điều kiện route-đã-duyệt');
  ok(h3.includes('`--exclude`'), 'AC3.1: Bước 3 Hành động có điều kiện lượt đầu (không --exclude)');
  ok(h3.includes('cột Risk, không phải `rủi-ro` của brief') && h3.includes('`high`/`critical`'), 'AC3.1: Bước 3 Hành động dùng Risk của Registry và high/critical');
  ok(fieldOf(s3.split('\n'), 'Gate').includes('cột Risk, không phải `rủi-ro` của brief'), 'AC3.1: Bước 3 Gate dùng Risk của Registry');
  ok(s3.includes('--log <brief.md> --chosen <id workflow>'), 'AC5.1: Bước 3 ghi nhật ký khi người dùng từ chối');
  const cp = orch.slice(orch.indexOf('## Checkpoint'), orch.indexOf('## Xử lý lỗi'));
  ok(cp.includes('cột Risk, không phải `rủi-ro` của brief'), 'AC3.1: dòng Checkpoint dùng Risk của Registry');
  ok(stepText(orch, 4).includes('--log <brief.md> --chosen <id đã thử> --misrouted'), 'AC3.2: Bước 4 ghi nhật ký misrouted với --chosen và --misrouted');
  ok(stepText(orch, 4).includes('--exclude'), 'AC3.2: Bước 4 quay lại Bước 1 với --exclude');
  const s5 = stepText(orch, 5);
  ok(s5.includes('--log <brief.md> --chosen <id workflow> [--overridden] [--misrouted]'), 'AC5.1: Bước 5 có lệnh --log với [--overridden] [--misrouted]');
  ok(s5.includes('`status` tổng là `blocked`'), 'AC3.2: Bước 5 nêu status tổng là blocked khi hết route sau misrouted');

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

  // Bộ dò phủ định phải bắt các dạng phủ định và bỏ qua câu khẳng định, nếu không kiểm Khi fail bên dưới vô nghĩa.
  ok(!isNegated('Workflow trả `status: misrouted`, không phải lỗi.')
    && isNegated('không trả `status: misrouted`') && isNegated('không được trả status: misrouted')
    && isNegated('chớ trả status: misrouted') && isNegated('đừng trả status: misrouted'),
  'AC3.2: bộ dò phủ định bắt không trả / không được trả / chớ trả / đừng trả và bỏ qua câu khẳng định');

  // Bốn workflow pipeline: Khi fail Bước 1 trả misrouted (không phủ định), Evidence ghi misrouted,
  // Hành động nêu đúng vị từ: security-review và performance dùng điều-kiện, feature và bugfix dùng loại-việc.
  const readWorkflow = (id) => fs.readFileSync(path.join(REPO_ROOT, 'workflows', id, 'WORKFLOW.md'), 'utf8').replace(/\r\n/g, '\n').split('\n');
  const section = (lines, n) => {
    const at = lines.findIndex((l) => l.startsWith(`### Bước ${n} —`));
    if (at === -1) return [];
    const end = lines.findIndex((l, i) => i > at && l.startsWith('### '));
    return lines.slice(at, end === -1 ? lines.length : end);
  };
  const PIPE_TERM = { feature: 'loại-việc', bugfix: 'loại-việc', 'security-review': 'điều-kiện', performance: 'điều-kiện' };
  for (const [id, term] of Object.entries(PIPE_TERM)) {
    const step1 = section(readWorkflow(id), 1);
    const khiFail = fieldOf(step1, 'Khi fail');
    ok(/trả\s[^.]*status: misrouted/.test(khiFail) && !isNegated(khiFail), `AC3.2: workflow-${id} Bước 1 Khi fail trả status: misrouted (không phủ định)`);
    ok(fieldOf(step1, 'Evidence').includes('misrouted'), `AC3.2: workflow-${id} Bước 1 Evidence ghi misrouted`);
    ok(fieldOf(step1, 'Hành động').includes(term), `AC3.2: workflow-${id} Bước 1 Hành động nêu ${term}`);
  }

  // Bước 2 của feature: request có brief.md thì việc đọc brief nằm trong Hành động.
  const featureStep2 = section(readWorkflow('feature'), 2);
  ok(fieldOf(featureStep2, 'Hành động').includes('brief.md'), 'AC4.1: workflow-feature Bước 2 đọc brief.md trong Hành động');
}
