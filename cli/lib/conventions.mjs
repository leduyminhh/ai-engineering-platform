// Helper THUẦN kiểm quy ước SKILL.md và description (spec 2026-10-06 §4.2–4.3).
// Zero-dependency; không đọc đĩa để validator test được bằng chuỗi.

// Cho phép hậu tố sau dấu cách ("## Quy trình — cổng F1–F5") để không phải đổi heading đang mang nghĩa.
export const SKILL_HEADINGS = [
  ['Quy trình', /^## Quy trình(?: .*)?$/m],
  ['Ranh giới an toàn', /^## Ranh giới an toàn(?: .*)?$/m],
];

export function checkSkillBody(body) {
  return SKILL_HEADINGS.filter(([, re]) => !re.test(body)).map(([h]) => `thiếu heading "## ${h}"`);
}

// Giới hạn của Agent Skills (platform.claude.com, mục "Skill structure"); bộ zip Cowork được upload lên claude.ai.
export const DESCRIPTION_MAX = 1024;
// whenToUse() render câu đầu vào mục lục AGENTS.md của antigravity; câu quá dài làm mục lục khó đọc.
export const FIRST_SENTENCE_MAX = 200;
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
