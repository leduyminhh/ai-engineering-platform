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
// Chỉ nhận dạng `key: value` một dòng — đúng tập con mà frontmatter() phát ra hiện nay.
const PLAIN_UNSAFE_VALUE = /^[\s"'#&*!|>%@`\[\]{},?:-]|:(?:\s|$)|\s#|\s$/;
const QUOTED = /^"(?:[^"\\]|\\.)*"$/;

export function checkFrontmatterYaml(fmText) {
  const errs = [];
  for (const line of fmText.split('\n')) {
    if (!line.trim()) continue;
    const m = line.match(/^([A-Za-z][\w-]*):(?:\s(.*))?$/);
    if (!m) { errs.push(`dòng không phải "key: value": ${line.slice(0, 40)}`); continue; }
    const v = m[2] ?? '';
    if (v.startsWith('"')) { if (!QUOTED.test(v)) errs.push(`${m[1]}: chuỗi quote không đóng hoặc escape sai`); continue; }
    if (PLAIN_UNSAFE_VALUE.test(v)) errs.push(`${m[1]}: plain scalar không an toàn ("${v.slice(0, 30)}")`);
  }
  return errs;
}

// Mẫu description Phase 1: câu hành động ngắn → "Dùng khi" 3–5 trigger → "Không dùng khi → id".
// Câu đầu ≤ 200 vì adapter cắt dòng mục lục ở WHEN_TO_USE_MAX; boilerplate là phần mô hình suy ra được, chỉ tốn context.
export const DESCRIPTION_TARGET = 500;
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
