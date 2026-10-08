// Helper THUẦN kiểm quy ước SKILL.md và description (spec 2026-10-06 §4.2–4.3).
// Zero-dependency; không đọc đĩa để validator test được bằng chuỗi.

// Cho phép hậu tố sau dấu cách ("## Quy trình — cổng F1–F5") để không phải đổi heading đang mang nghĩa.
export const SKILL_HEADINGS = [
  ['Quy trình', /^## Quy trình(?: .*)?$/m],
  ['Ranh giới an toàn', /^## Ranh giới an toàn(?: .*)?$/m],
];

// Heading trong khối code là ví dụ, không phải mục thật của skill; bỏ khối code trước khi kiểm.
const FENCE = /^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm;

export function checkSkillBody(body) {
  const text = body.replace(FENCE, '');
  return SKILL_HEADINGS.filter(([, re]) => !re.test(text)).map(([h]) => `thiếu heading "## ${h}"`);
}

// Trần của repo thấp hơn trần 1.536 ký tự của Claude (description + when_to_use bị cắt ở mức này trong danh sách skill,
// https://code.claude.com/docs/en/skills.md) vì khối "Dùng khi" ngắn là đủ, và index Antigravity/Codex chỉ lấy ~200 ký tự đầu.
export const DESCRIPTION_MAX = 500;
export const NOT_FOR = 'Không dùng khi';
const GENERIC = new Set(['skill', 'workflow']);

export function quotedPhrases(desc) {
  return [...desc.matchAll(/"([^"]{2,80})"/g)].map((m) => m[1].trim().toLowerCase()).filter((p) => !GENERIC.has(p));
}

// Câu "Không dùng khi" luôn đứng cuối, nên lấy mọi "→ <id>" từ đó tới hết; tách câu theo dấu chấm sẽ hỏng với "v.v.".
export function notForTargets(desc) {
  const i = desc.indexOf(NOT_FOR);
  if (i === -1) return null;
  return [...desc.slice(i).matchAll(/→\s*`?([a-z][a-z0-9-]*)`?/g)].map((m) => m[1]);
}

export function checkDescription(desc, knownIds, selfId) {
  const errs = [];
  const len = [...desc].length;
  if (len > DESCRIPTION_MAX) errs.push(`dài ${len} ký tự (tối đa ${DESCRIPTION_MAX})`);
  if (desc.includes('KHÔNG thuộc pipeline')) errs.push('còn câu "KHÔNG thuộc pipeline…" (khái niệm pipeline đã bỏ)');
  // frontmatter() ghi description dạng YAML plain scalar; " #" mở comment nên parser chặt sẽ cắt mất phần sau.
  if (desc.includes(' #')) errs.push('chứa " #" (YAML hiểu là comment khi ghi plain scalar)');
  const targets = notForTargets(desc);
  if (targets === null) errs.push(`thiếu câu "${NOT_FOR} … → <id>"`);
  else if (!targets.length) errs.push(`câu "${NOT_FOR}" không có "→ <id>"`);
  else {
    for (const t of targets) {
      if (t === selfId) errs.push(`"→ ${t}" trỏ vào chính nó`);
      else if (!knownIds.has(t)) errs.push(`"→ ${t}" không phải id skill/workflow/agent có thật`);
    }
  }
  return errs;
}

// Trùng trigger giữa hai skill làm mô hình chọn tuỳ ý; trùng skill ↔ workflow chỉ hợp lệ khi skill trỏ sang workflow.
export function triggerCollisions(entries) {
  const owners = new Map();
  for (const e of entries) {
    for (const p of new Set(quotedPhrases(e.description))) {
      if (!owners.has(p)) owners.set(p, []);
      owners.get(p).push(e);
    }
  }
  const errs = [];
  for (const [p, es] of owners) {
    const skills = es.filter((e) => e.kind === 'skill');
    const wfs = es.filter((e) => e.kind === 'workflow');
    if (skills.length > 1) errs.push(`"${p}" trùng giữa skill ${skills.map((e) => e.id).join(', ')}`);
    for (const s of skills) {
      for (const w of wfs) {
        if (!(notForTargets(s.description) || []).includes(w.id)) {
          errs.push(`"${p}" trùng ${s.id} ↔ ${w.id} nhưng ${s.id} không trỏ "→ ${w.id}"`);
        }
      }
    }
  }
  return errs;
}

// Kiểm frontmatter ĐÃ PHÁT: value chứa ": ", " #" hoặc mở đầu bằng ký tự cấu trúc phải nằm trong ngoặc kép.
// Nhận `key: value` và dòng con `  - x` / `  k: v` mà frontmatter() phát ra.
const PLAIN_UNSAFE_VALUE = /^[\s"'#&*!|>%@`\[\]{},?:-]|:(?:\s|$)|\s#|\s$/;
const QUOTED = /^"(?:[^"\\]|\\.)*"$/;

export function checkFrontmatterYaml(fmText) {
  const errs = [];
  let parent = null;
  const checkValue = (key, v) => {
    if (v.startsWith('"')) { if (!QUOTED.test(v)) errs.push(`${key}: chuỗi quote không đóng hoặc escape sai`); return; }
    if (PLAIN_UNSAFE_VALUE.test(v)) errs.push(`${key}: plain scalar không an toàn ("${v.slice(0, 30)}")`);
  };
  for (const line of fmText.split('\n')) {
    if (!line.trim()) continue;
    const item = line.match(/^ {2}- (.*)$/);
    const sub = line.match(/^ {2}([A-Za-z][\w-]*): (.*)$/);
    if ((item || sub) && parent) { checkValue(parent, item ? item[1] : sub[2]); continue; }
    const m = line.match(/^([A-Za-z][\w-]*):(?:\s(.*))?$/);
    if (!m) { errs.push(`dòng không phải "key: value": ${line.slice(0, 40)}`); parent = null; continue; }
    const v = m[2] ?? '';
    parent = v === '' ? m[1] : null;
    if (v !== '') checkValue(m[1], v);
  }
  return errs;
}

// Mẫu description Phase 1: câu hành động ngắn → "Dùng khi" 3–5 trigger → "Không dùng khi → id".
// Câu đầu ≤ 200 vì adapter cắt dòng mục lục ở WHEN_TO_USE_MAX; boilerplate là phần mô hình suy ra được, chỉ tốn context.
export const DESCRIPTION_TARGET = 450;
export const AGENT_DESCRIPTION_MAX = 260;
export const FIRST_SENTENCE_MAX = 200;
export const BOILERPLATE = ['kể cả khi không nói chính xác', 'Recipe on-demand', 'Skill capability', 'Skill vận hành',
  'KHÔNG thuộc pipeline', 'Gọi khi cần'];

function firstSentence(desc) {
  const d = desc.trim().replace(/\s+/g, ' ');
  const m = d.match(/^(.*?[.。])\s/);
  return m ? m[1] : d;
}

export function checkDescriptionStyle(desc, { max = DESCRIPTION_TARGET, minTriggers = 3, maxTriggers = 5 } = {}) {
  const errs = [];
  const len = [...desc].length;
  if (len > max) errs.push(`dài ${len} ký tự (mục tiêu ≤ ${max})`);
  const first = [...firstSentence(desc)].length;
  if (first > FIRST_SENTENCE_MAX) errs.push(`câu đầu ${first} ký tự (≤ ${FIRST_SENTENCE_MAX})`);
  const n = new Set(quotedPhrases(desc)).size;
  if (n < minTriggers || n > maxTriggers) errs.push(`${n} trigger (cần ${minTriggers}–${maxTriggers})`);
  for (const b of BOILERPLATE) if (desc.includes(b)) errs.push(`còn boilerplate "${b}"`);
  if (!desc.includes('Dùng khi')) errs.push('thiếu "Dùng khi"');
  return errs;
}

export function checkAgentDescription(desc) {
  const errs = [];
  const len = [...desc].length;
  if (len > AGENT_DESCRIPTION_MAX) errs.push(`dài ${len} ký tự (≤ ${AGENT_DESCRIPTION_MAX})`);
  if (!desc.includes('Dùng khi')) errs.push('thiếu "Dùng khi"');
  return errs;
}

// Khoá skill chiếu thẳng sang SKILL.md, tên theo https://code.claude.com/docs/en/skills.md (re-fetch 2026-10-08).
// Không có when_to_use: Claude gộp nó với description nên không tiết kiệm token, provider khác không hiểu.
export const SKILL_PASSTHROUGH = ['argument-hint', 'arguments', 'user-invocable', 'disable-model-invocation',
  'allowed-tools', 'disallowed-tools', 'effort', 'paths', 'compatibility', 'metadata'];

// Allowlist khoá frontmatter NGUỒN: loader chỉ đọc các khoá này, khoá lạ bị bỏ im lặng nên gõ sai (vd `runin`) không lộ ra.
export const SOURCE_KEYS = {
  skill: ['name', 'description', 'order', 'title', 'runsIn', 'invoke', 'sharedAssets', ...SKILL_PASSTHROUGH],
  agent: ['name', 'description', 'mode', 'skills', 'model', 'effort', 'color', 'tools', 'maxTurns', 'isolation'],
  workflow: ['name', 'description', 'order', 'title', 'kind', 'tier', 'risk', 'agents', 'requires', 'runsIn', 'invoke', 'argument-hint'],
};

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const isStr = (v) => typeof v === 'string';
const isStrList = (v) => isStr(v) || (Array.isArray(v) && v.every(isStr));
const PASSTHROUGH_TYPES = {
  'argument-hint': [isStr, 'chuỗi (giá trị bắt đầu bằng "[" phải đặt trong ngoặc kép)'],
  arguments: [isStrList, 'chuỗi hoặc list chuỗi'],
  'user-invocable': [(v) => typeof v === 'boolean', 'true/false'],
  'disable-model-invocation': [(v) => typeof v === 'boolean', 'true/false'],
  'allowed-tools': [isStrList, 'chuỗi hoặc list chuỗi'],
  'disallowed-tools': [isStrList, 'chuỗi hoặc list chuỗi'],
  effort: [(v) => EFFORTS.includes(v), EFFORTS.join('|')],
  paths: [isStrList, 'chuỗi hoặc list chuỗi'],
  compatibility: [(v) => isStr(v) && [...v].length <= 500, 'chuỗi ≤ 500 ký tự'],
  metadata: [(v) => !!v && typeof v === 'object' && !Array.isArray(v), 'map'],
};

export function checkPassthroughTypes(meta) {
  return Object.entries(PASSTHROUGH_TYPES)
    .filter(([k]) => meta[k] !== undefined && !PASSTHROUGH_TYPES[k][0](meta[k]))
    .map(([k, [, want]]) => `khoá "${k}" sai kiểu (cần ${want})`);
}

export function checkSourceKeys(kind, meta) {
  const allowed = new Set(SOURCE_KEYS[kind] || []);
  return Object.keys(meta).filter((k) => !allowed.has(k))
    .map((k) => `khoá frontmatter lạ "${k}" (chưa được chiếu, sẽ bị bỏ im lặng)`);
}

const WRITE_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'Agent'];

// tools là allowlist: agent read-only không được có tool ghi; thiếu Skill thì agent không nạp được skill thứ hai.
export function checkAgentTools(agent) {
  const tools = agent.tools || [];
  if (!tools.length) return [];
  const errs = [];
  if (agent.mode === 'read-only') {
    const bad = tools.filter((t) => WRITE_TOOLS.includes(t));
    if (bad.length) errs.push(`read-only nhưng tools có ${bad.join(', ')}`);
  }
  if ((agent.skills || []).length > 1 && !tools.includes('Skill')) errs.push('có > 1 skill nhưng tools thiếu Skill');
  return errs;
}

export const HOOK_EVENTS = ['PreToolUse', 'PostToolUse'];
const HOOK_SCRIPT_PREFIX = '${CLAUDE_PLUGIN_ROOT}/hooks/';
const HOOK_TIMEOUT_MAX = 30;

// Dạng exec (command "node" + args) là mẫu đa nền tảng; mọi script phải nằm trong hooks/ của chính plugin.
export function checkHooksJson(obj, { scriptsExist = () => true } = {}) {
  const errs = [];
  if (!obj || typeof obj !== 'object' || !obj.hooks || typeof obj.hooks !== 'object' || Array.isArray(obj.hooks)) {
    return ['thiếu khoá bọc "hooks"'];
  }
  for (const [event, groups] of Object.entries(obj.hooks)) {
    if (!HOOK_EVENTS.includes(event)) { errs.push(`event "${event}" ngoài ${HOOK_EVENTS.join('/')}`); continue; }
    if (!Array.isArray(groups)) { errs.push(`${event}: phải là mảng`); continue; }
    groups.forEach((g, gi) => {
      const at = `${event}[${gi}]`;
      if (!g || !Array.isArray(g.hooks)) { errs.push(`${at}: thiếu mảng hooks`); return; }
      g.hooks.forEach((h, hi) => {
        const hat = `${at}.hooks[${hi}]`;
        if (!h || h.type !== 'command') errs.push(`${hat}: type phải là "command"`);
        if (!h || h.command !== 'node') errs.push(`${hat}: command phải là "node" (dạng exec)`);
        const first = h && Array.isArray(h.args) ? h.args[0] : undefined;
        if (typeof first !== 'string' || !first.startsWith(`${HOOK_SCRIPT_PREFIX}scripts/`)) {
          errs.push(`${hat}: args[0] phải bắt đầu bằng ${HOOK_SCRIPT_PREFIX}scripts/`);
        } else if (!scriptsExist(first.slice(HOOK_SCRIPT_PREFIX.length))) {
          errs.push(`${hat}: script không tồn tại (${first})`);
        }
        if (typeof h?.timeout !== 'number' || !(h.timeout > 0) || h.timeout > HOOK_TIMEOUT_MAX) {
          errs.push(`${hat}: timeout phải là số trong (0, ${HOOK_TIMEOUT_MAX}]`);
        }
      });
    });
  }
  return errs;
}
