// Helper THUẦN cho bộ workflow: kiểm khung body, trích tham chiếu bước, registry orchestrator,
// closure phụ thuộc khi cài. Zero-dependency; không đọc đĩa để test được độc lập.

export const WF_HEADINGS = ['Mục tiêu & đầu vào', 'Điều kiện tiên quyết', 'Các bước', 'Checkpoint',
  'Xử lý lỗi & rollback', 'Definition of Done', 'Report cuối'];
export const STEP_FIELDS = ['Thực hiện', 'Đầu vào', 'Hành động', 'Ràng buộc', 'Đầu ra', 'Gate', 'Khi fail', 'Evidence'];
export const RISKS = ['low', 'medium', 'high', 'critical'];
// Cursor/Antigravity chưa có đích native cho workflow (spec §9 P1) nên installer bỏ workflow ở đó.
export const WORKFLOW_PROVIDERS = ['claude', 'codex'];

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

export function stepRefs(text) {
  return parseSteps(text).map((s) => {
    const line = s.body.split('\n').find((l) => l.includes('**Thực hiện:**')) || '';
    // Chỉ token trong backtick có ký tự id hợp lệ; placeholder `<plugin>-<agent>` của template bị bỏ qua.
    const grab = (kw) => [...line.matchAll(new RegExp(`${kw}\\s+\`([a-z0-9/-]+)\``, 'g'))].map((m) => m[1]);
    return { n: s.n, agents: grab('agent'), skills: grab('skill') };
  });
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
