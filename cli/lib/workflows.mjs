// Helper THUẦN cho bộ workflow: kiểm khung body, trích tham chiếu bước, registry orchestrator,
// closure phụ thuộc khi cài. Zero-dependency; không đọc đĩa để test được độc lập.

export const WF_HEADINGS = ['Mục tiêu & đầu vào', 'Điều kiện tiên quyết', 'Các bước', 'Checkpoint',
  'Xử lý lỗi & rollback', 'Definition of Done', 'Report cuối'];
export const STEP_FIELDS = ['Thực hiện', 'Đầu vào', 'Hành động', 'Ràng buộc', 'Đầu ra', 'Gate', 'Khi fail', 'Evidence'];
export const RISKS = ['low', 'medium', 'high', 'critical'];
// Cursor/Antigravity chưa có đích native cho workflow (spec §9 P1) nên installer bỏ workflow ở đó.
export const WORKFLOW_PROVIDERS = ['claude', 'codex'];
// Chỉ neo dòng khung; bảng lỗi, DoD và dòng commit được từng workflow tuỳ biến hợp lệ (đo 7–10/12 file).
export const WF_ANCHORS = [
  'Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.',
  'Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.',
  '| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |',
  '| Tình huống | Hành động |',
  'Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.',
];

function section(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return null;
  const end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  return lines.slice(start + 1, end === -1 ? lines.length : end).join('\n');
}

export function parseSteps(text) {
  const sec = section(text, 'Các bước');
  if (sec === null) return [];
  return sec.split(/^### /m).slice(1).map((part) => {
    const [head, ...rest] = part.split('\n');
    const m = head.match(/^Bước (\d+) — (.+)$/);
    return {
      n: m ? Number(m[1]) : NaN,
      title: (m ? m[2] : head).trim(),
      checkpoint: head.trim().endsWith('⏸'),
      body: rest.join('\n'),
    };
  });
}

export function checkWorkflowBody(text, { kind = 'workflow' } = {}) {
  const errs = [];
  for (const h of WF_HEADINGS) if (section(text, h) === null) errs.push(`thiếu heading "## ${h}"`);
  const steps = parseSteps(text);
  if (!steps.length) errs.push('không có bước "### Bước <n> — <tên>"');
  steps.forEach((s, i) => {
    if (s.n !== i + 1) errs.push(`bước thứ ${i + 1} đánh số "${s.n}" (phải liên tục từ 1)`);
    for (const f of STEP_FIELDS) if (!s.body.includes(`**${f}:**`)) errs.push(`bước ${s.n}: thiếu trường "${f}"`);
  });
  if (steps.length && !steps.some((s) => s.checkpoint)) errs.push('không có bước nào gắn ⏸');
  const block = kind === 'orchestrator' ? 'orchestrator_result:' : 'workflow_result:';
  if (!text.includes(block)) errs.push(`thiếu khối "${block}"`);
  return errs;
}

function fieldText(body, field) {
  const lines = body.split('\n');
  const from = lines.findIndex((l) => l.startsWith(`- **${field}:**`));
  // Trường có thể xuống dòng nối thụt lề; dừng ở bullet cột 0 kế tiếp để không bắt token của trường khác.
  let to = from === -1 ? -1 : lines.findIndex((l, i) => i > from && /^- \*\*/.test(l));
  if (to === -1) to = lines.length;
  return from === -1 ? '' : lines.slice(from, to).join(' ');
}

export function stepRefs(text) {
  return parseSteps(text).map((s) => {
    const line = fieldText(s.body, 'Thực hiện');
    // Chỉ token trong backtick có ký tự id hợp lệ; placeholder `<plugin>-<agent>` của template bị bỏ qua.
    const grab = (kw) => [...line.matchAll(new RegExp(`${kw}\\s+\`([a-z0-9/-]+)\``, 'g'))].map((m) => m[1]);
    return { n: s.n, agents: grab('agent'), skills: grab('skill') };
  });
}

export const GRAPH_TERMINALS = ['done', 'blocked', 'ask_user'];
const STEP_ID = /^[a-z][a-z0-9-]*$/;
const REF_ID = /^[a-z0-9/-]+$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const itemId = (it) => (isObj(it) ? it.id : it);

// Khóa ngoài schema v1 gần như luôn là lỗi gõ (vd "afer"); im lặng bỏ qua sẽ làm cạnh/điều kiện biến mất khỏi runner.
const GRAPH_KEYS = {
  root: ['schema', 'workflow', 'start', 'steps'],
  step: ['id', 'n', 'title', 'run', 'next', 'on_fail', 'gate'],
  run: ['session', 'agents', 'skills', 'parallel'],
  item: ['id', 'when', 'after'],
  onFail: ['to', 'when'],
  gate: ['type', 'review', 'approve', 'reject'],
};
function unknownKeys(obj, allowed, where, e) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) e(`khóa lạ "${k}" trong ${where}`);
}

// Cạnh gate.approve/reject được tính riêng để reachability không phụ thuộc việc approve === next đã đúng.
function edgeTargets(s) {
  const ts = [['next', s.next]];
  (Array.isArray(s.on_fail) ? s.on_fail : []).forEach((f) => ts.push(['on_fail', isObj(f) ? f.to : undefined]));
  if (isObj(s.gate) && s.gate.type === 'human') ts.push(['gate.approve', s.gate.approve], ['gate.reject', s.gate.reject]);
  return ts.filter(([, t]) => typeof t === 'string');
}

function checkRun(run, e) {
  if (!isObj(run)) return e('thiếu run');
  unknownKeys(run, GRAPH_KEYS.run, 'run', e);
  for (const k of ['session', 'parallel']) if (run[k] !== undefined && typeof run[k] !== 'boolean') e(`run.${k} phải là boolean`);
  const items = [];
  for (const key of ['agents', 'skills']) {
    if (run[key] === undefined) continue;
    if (!Array.isArray(run[key])) { e(`run.${key} phải là mảng`); continue; }
    for (const it of run[key]) {
      const id = itemId(it);
      if (!isStr(id) || !REF_ID.test(id)) { e(`run.${key} có phần tử sai (cần id hoặc { id, when?, after? })`); continue; }
      if (isObj(it)) {
        unknownKeys(it, GRAPH_KEYS.item, `run.${key} "${id}"`, e);
        for (const k of ['when', 'after']) if (it[k] !== undefined && !isStr(it[k])) e(`run.${key} "${id}": ${k} phải là chuỗi`);
      }
      items.push(it);
    }
  }
  if (run.session !== true && !items.length) e('run cần session: true hoặc ít nhất một agent/skill');
  const ids = new Set(items.map(itemId));
  for (const it of items) {
    if (isObj(it) && isStr(it.after) && (it.after === it.id || !ids.has(it.after))) e(`after "${it.after}" của "${it.id}" phải là id khác cùng bước`);
  }
  // Mỗi phần tử có tối đa một `after`, nên đi theo chuỗi là đủ; vòng làm runner chờ nhau mãi.
  const afterOf = new Map(items.filter((it) => isObj(it) && isStr(it.after) && it.after !== it.id).map((it) => [it.id, it.after]));
  const reported = new Set();
  for (const start of afterOf.keys()) {
    const path = [start];
    for (let cur = afterOf.get(start); cur !== undefined; cur = afterOf.get(cur)) {
      if (cur === start) {
        if (!path.some((p) => reported.has(p))) e(`after tạo vòng: ${[...path, start].join(' → ')}`);
        path.forEach((p) => reported.add(p));
        break;
      }
      if (path.includes(cur)) break;
      path.push(cur);
    }
  }
}

export function checkGraph(graph) {
  if (!isObj(graph)) return ['graph: phải là object'];
  const errs = [];
  unknownKeys(graph, GRAPH_KEYS.root, 'graph', (m) => errs.push(`graph: ${m}`));
  if (graph.schema !== 1) errs.push(`graph: schema phải bằng 1 (đang ${JSON.stringify(graph.schema)})`);
  if (!isStr(graph.workflow)) errs.push('graph: thiếu "workflow"');
  if (!isStr(graph.start)) errs.push('graph: thiếu "start"');
  if (!Array.isArray(graph.steps) || !graph.steps.length) return [...errs, 'graph: "steps" phải là mảng không rỗng'];
  const seen = new Set();
  graph.steps.forEach((s, i) => {
    if (!isObj(s)) { errs.push(`bước #${i + 1}: phải là object`); return; }
    const at = isStr(s.id) ? s.id : `#${i + 1}`;
    const e = (m) => errs.push(`bước ${at}: ${m}`);
    unknownKeys(s, GRAPH_KEYS.step, 'bước', e);
    if (!isStr(s.id) || !STEP_ID.test(s.id)) e(`id ${JSON.stringify(s.id)} không khớp ${STEP_ID}`);
    else if (GRAPH_TERMINALS.includes(s.id)) e('id trùng đích đặc biệt');
    else if (seen.has(s.id)) e('id trùng với bước khác');
    else seen.add(s.id);
    if (s.n !== i + 1) e(`n phải liên tục từ 1 (đang ${JSON.stringify(s.n)}, mong ${i + 1})`);
    if (!isStr(s.title)) e('thiếu title');
    checkRun(s.run, e);
    if (!isStr(s.next)) e('thiếu next');
    if (!Array.isArray(s.on_fail)) e('on_fail phải là mảng');
    else {
      s.on_fail.forEach((f, j) => {
        if (isObj(f)) unknownKeys(f, GRAPH_KEYS.onFail, `on_fail[${j}]`, e);
        if (!isObj(f) || !isStr(f.to) || !isStr(f.when)) e(`on_fail[${j}] cần "to" và "when"`);
        // Fail không bao giờ dẫn tới hoàn tất; cho phép sẽ để vòng lặp vô hạn lọt qua kiểm reachability tới done.
        else if (f.to === 'done') e(`on_fail[${j}] không được trỏ tới "done" (dùng "blocked")`);
      });
    }
    const g = s.gate;
    if (isObj(g)) unknownKeys(g, GRAPH_KEYS.gate, 'gate', e);
    if (!isObj(g)) e('thiếu gate');
    else if (g.type === 'human') {
      if (!isStr(g.review)) e('gate human thiếu review');
      if (g.approve !== s.next) e(`gate.approve ${JSON.stringify(g.approve)} phải bằng next ${JSON.stringify(s.next)}`);
      if (!(Array.isArray(s.on_fail) && s.on_fail.some((f) => isObj(f) && f.to === g.reject))) e(`gate.reject ${JSON.stringify(g.reject)} phải là một đích của on_fail`);
    } else if (g.type !== 'auto') e(`gate.type ${JSON.stringify(g.type)} không hợp lệ (auto | human)`);
  });
  const first = graph.steps[0];
  if (isStr(graph.start) && isObj(first) && graph.start !== first.id) errs.push(`graph: start "${graph.start}" phải là id của bước n=1 ("${first.id}")`);
  const valid = new Set([...seen, ...GRAPH_TERMINALS]);
  for (const s of graph.steps.filter(isObj)) {
    for (const [label, t] of edgeTargets(s)) if (!valid.has(t)) errs.push(`bước ${s.id}: ${label} trỏ tới "${t}" không tồn tại`);
  }
  // Phân tích đồ thị chỉ có nghĩa khi cấu trúc đã sạch; tránh lỗi dây chuyền từ id trùng/đích sai.
  if (errs.length) return errs;
  const steps = graph.steps;
  const byId = new Map(steps.map((s) => [s.id, s]));
  const reach = new Set([graph.start]);
  for (const id of reach) for (const [, t] of edgeTargets(byId.get(id))) if (byId.has(t)) reach.add(t);
  for (const s of steps) if (!reach.has(s.id)) errs.push(`bước ${s.id}: mồ côi, không tới được từ start "${graph.start}"`);
  const toDone = new Set(steps.filter((s) => edgeTargets(s).some(([, t]) => t === 'done')).map((s) => s.id));
  for (let grew = true; grew;) {
    grew = false;
    for (const s of steps) {
      if (!toDone.has(s.id) && edgeTargets(s).some(([, t]) => toDone.has(t))) { toDone.add(s.id); grew = true; }
    }
  }
  for (const s of steps) if (!toDone.has(s.id)) errs.push(`bước ${s.id}: không có đường tới done (vòng không lối ra)`);
  return errs;
}

// Chiều văn xuôi → graph chỉ áp cho "quay lại/về Bước N": các chỗ nhắc "Bước N" khác không phải cạnh.
export function checkGraphAgainstBody(graph, text) {
  if (!isObj(graph) || !Array.isArray(graph.steps)) return ['graph: thiếu "steps"'];
  const errs = [];
  const prose = parseSteps(text);
  const refs = stepRefs(text);
  const steps = graph.steps.filter(isObj);
  const byN = new Map(steps.map((s) => [s.n, s]));
  if (steps.length !== prose.length) errs.push(`graph có ${steps.length} bước, văn xuôi có ${prose.length} bước`);
  prose.forEach((p, i) => {
    const g = byN.get(p.n);
    if (!g) { errs.push(`bước ${p.n} ("${p.title}"): có trong văn xuôi nhưng thiếu trong graph`); return; }
    const e = (m) => errs.push(`bước ${g.id}: ${m}`);
    const title = p.title.replace(/\s*⏸$/, '');
    if (g.title !== title) e(`title ${JSON.stringify(g.title)} lệch văn xuôi ${JSON.stringify(title)}`);
    const human = isObj(g.gate) && g.gate.type === 'human';
    if (p.checkpoint !== human) e(`${p.checkpoint ? 'văn xuôi có ⏸' : 'văn xuôi không có ⏸'} nhưng gate.type là ${isObj(g.gate) ? g.gate.type : 'thiếu'}`);
    const run = isObj(g.run) ? g.run : {};
    const doing = fieldText(p.body, 'Thực hiện');
    if (/session chính/.test(doing) !== (run.session === true)) e('run.session lệch "session chính" trong Thực hiện');
    if (doing.includes('∥') !== (run.parallel === true)) e('run.parallel lệch ký hiệu ∥ trong Thực hiện');
    for (const key of ['agents', 'skills']) {
      const want = refs[i][key];
      const have = (Array.isArray(run[key]) ? run[key] : []).map(itemId);
      const miss = want.filter((x) => !have.includes(x));
      const extra = have.filter((x) => !want.includes(x));
      if (miss.length) e(`run.${key} thiếu ${miss.join(', ')} so với Thực hiện`);
      if (extra.length) e(`run.${key} thừa ${extra.join(', ')} so với Thực hiện`);
    }
    const fail = fieldText(p.body, 'Khi fail').replace(/\s+/g, ' ');
    const back = new Set();
    for (const m of fail.matchAll(/quay (?:lại|về) Bước (\d+(?:\/\d+)*)/gi)) m[1].split('/').forEach((n) => back.add(Number(n)));
    const onFail = (Array.isArray(g.on_fail) ? g.on_fail : []).filter(isObj);
    for (const f of onFail) {
      if (f.to === 'blocked' && !/blocked|dừng/i.test(fail)) e('on_fail → blocked thiếu chữ "blocked"/"dừng" trong Khi fail');
      else if (f.to === 'ask_user' && !/hỏi|người dùng/i.test(fail)) e('on_fail → ask_user thiếu chữ "hỏi"/"người dùng" trong Khi fail');
      else if (!GRAPH_TERMINALS.includes(f.to) && !back.has((steps.find((s) => s.id === f.to) || {}).n)) e(`on_fail → ${f.to} thiếu câu "quay lại Bước N" trong Khi fail`);
    }
    // Văn xuôi nói "hỏi" mà graph không có ask_user thì runner không bao giờ dừng hỏi người dùng.
    if (/hỏi/i.test(fail) && !onFail.some((f) => f.to === 'ask_user')) e('Khi fail có chữ "hỏi" nhưng on_fail thiếu cạnh ask_user');
    for (const n of back) if (!onFail.some((f) => (byN.get(n) || {}).id === f.to)) e(`văn xuôi "quay lại Bước ${n}" nhưng graph thiếu cạnh on_fail tới bước ${n}`);
  });
  return errs;
}

export function parseRegistry(text) {
  const rows = [];
  for (const line of (section(text, 'Registry') || '').split('\n')) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) continue;
    const id = cells[0].replace(/`/g, '');
    if (!id.startsWith('workflow-')) continue;
    const next = [...cells[3].matchAll(/`(workflow-[a-z0-9-]+)`/g)].map((m) => m[1]);
    rows.push({ id, risk: cells[2].replace(/`/g, ''), next });
  }
  const pri = text.split('\n').find((l) => l.startsWith('**Thứ tự ưu tiên:**')) || '';
  const priority = [...pri.matchAll(/`(workflow-[a-z0-9-]+)`/g)].map((m) => m[1]);
  return { rows, priority };
}

/**
 * Mỗi `workflows/<id>` đã chọn kéo theo `requires` + skill của agent trong `agents`. Một lượt là đủ
 * vì validate ép `requires` chỉ trỏ tới skill plugin/core, không trỏ tới workflow khác.
 */
export function expandWorkflowDeps(selected, { workflows = [], agents = [] } = {}) {
  const skills = new Set(selected);
  const required = new Set();
  const pulled = [];
  const agentById = new Map(agents.map((a) => [a.id, a]));
  for (const wf of workflows) {
    if (!skills.has(`workflows/${wf.id}`)) continue;
    const need = [...wf.requires];
    for (const aid of wf.agents) need.push(...((agentById.get(aid) || {}).skills || []));
    const added = [];
    for (const s of need) {
      required.add(s);
      if (!skills.has(s)) { skills.add(s); added.push(s); }
    }
    if (added.length) pulled.push({ from: wf.id, added: added.sort() });
  }
  return { skills, pulled, required };
}

export function missingDeps(skills, catalogIds) {
  return [...skills].filter((s) => !catalogIds.has(s)).sort();
}

export function missingAnchors(text) {
  const lines = new Set(text.split('\n').map((l) => l.trimEnd()));
  return WF_ANCHORS.filter((a) => !lines.has(a));
}

export function registrySignals(text) {
  const out = new Map();
  for (const line of (section(text, 'Registry') || '').split('\n')) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) continue;
    const id = cells[0].replace(/`/g, '');
    if (!id.startsWith('workflow-')) continue;
    out.set(id, [...cells[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  }
  return out;
}
