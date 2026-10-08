# Standards Phase 1 — nội dung + quy ước + test — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giảm context luôn nạp và chi phí mỗi lần gọi skill mà không đổi cấu trúc engine: viết lại 36 description skill (≤ 450 ký tự, mẫu "hành động → dùng khi → không dùng khi") và 18 description agent (≤ 260), thay preamble ép nạp 2 skill principles bằng digest nhúng, bỏ mục body lặp, hoàn thiện workflow/orchestrator/script, tách `test/validate.mjs` thành harness + contract/content, rồi siết validator, bump MINOR và lock.

**Architecture:** Nội dung (SKILL.md, agents/*.md, WORKFLOW.md) được viết lại theo mẫu cố định và được **validator ép** (`checkDescriptionStyle`), áp dần theo plugin (tập `STYLE_READY`) để mỗi commit đều xanh; đến task cuối áp cho tất cả và hạ `DESCRIPTION_MAX`. Preamble đổi ở 3 điểm phát duy nhất (`adapters/claude/adapter.mjs`, `adapters/codex/adapter.mjs`, `adapters/_shared/agents.mjs`) qua một helper chung `principlesDigest()`. Test được tách cơ học: `validate.mjs` giữ làm entry (npm script không đổi), import các module `test/contract/*.mjs` (generic) và `test/content/*.mjs` (pin) qua `test/harness.mjs` + `test/context.mjs`; bất biến = tổng số assert pass không đổi.

**Tech Stack:** Node ≥ 20 ESM zero-dep; `node test/validate.mjs` (`ok(cond,msg)`); `claude` CLI 2.1.285; `py` (Python 3.13 + PyYAML) chỉ để kiểm chéo.

**Spec:** `docs/superpowers/specs/2026-10-07-platform-standards-audit-design.md` (§3.2 S1, S2, S5, S6; §3.3 W4, W7; §3.4 T2, T3, T6; §5 Phase 1 P1.1–P1.6; §6 D1, D4)

## Global Constraints

- Làm việc trong worktree `E:\Mine\AI\ai-engineering-platform\.worktrees\standards-phase1` (branch `refactor/standards-phase1`, từ `master c9b59b2`). Không đụng main tree, không đổi branch, không `git stash`, không push.
- UTF-8 **không BOM**, LF; nội dung tiếng Việt có dấu; comment code tiếng Việt, chỉ giải thích *vì sao*.
- **KHÔNG sửa** `package.json`, `pack.config.json`. `npm test` chạy `node test/validate.mjs --build` nên `validate.mjs` phải giữ là entry.
- Mẫu description skill (bắt buộc từ Task 2): `<1 câu hành động, ≤ 200 ký tự>. Dùng khi người dùng muốn "<t1>", "<t2>", "<t3>"[, "<t4>", "<t5>"]. Không dùng khi <case> → <id>[; <case> → <id>].` — **≤ 450 ký tự** (trần cứng 500 ở Task 8), 3–5 cụm trigger trong ngoặc kép, **giữ nguyên mọi id** sau `→` của description hiện tại, không có các cụm boilerplate: `kể cả khi không nói chính xác`, `Recipe on-demand`, `Skill capability`, `Skill vận hành`, `KHÔNG thuộc pipeline`, `Gọi khi cần`.
- Mẫu description agent: `<Vai trò>: <việc chính + phạm vi đọc/ghi> theo skill <skill chính>. Dùng khi <bước workflow / nhu cầu>.` — **≤ 260 ký tự**, không liệt kê danh sách cấm (đã có ở body).
- Trigger trong ngoặc kép không được trùng giữa 2 skill (validator `triggerCollisions`); trigger trùng với workflow chỉ hợp lệ khi description có `→ workflow-<x>`.
- Các từ khoá bị test ghim phải còn trong description (không sửa test để lách): `backend-code-review`: `N+1`; `backend-fix`/`frontend-fix`: `oracle`, có id `*-implement` và `*-refactor` sau `→`; `backend-performance`: nhắc `backend-fix` và `backend-testing`; `frontend-performance`: nhắc `frontend-fix`, `frontend-testing`, `frontend-e2e-testing`; agent `backend-fixer`/`frontend-fixer`: `oracle`; `backend-performance-analyst`: `Score`; `frontend-performance-analyst`: `LCP` hoặc `TBT`. Chạy `node test/validate.mjs` sau khi viết lại; assert đỏ nào về description → sửa description, không sửa assert.
- Mỗi task một commit qua `core:git-workflow` (header tiếng Anh, body tiếng Việt, `git commit -F` sau script encoding, **không** `Co-authored-by`). Trước `node test/validate.mjs` luôn `npm run build`. Không chạy 2 lượt test song song.
- Version/lock: KHÔNG bump và KHÔNG chạy `--lock` ở Task 1–7; Task 8 bump MINOR mọi plugin một lần rồi `node cli/lib/versions.mjs --lock`. Vì vậy từ Task 2 trở đi khối 34 "versions lock khớp build" sẽ **đỏ có chủ đích** cho tới Task 8 — mỗi task phải báo cáo rõ số fail = đúng các assert lock (`<id>: build đổi so với lock`) và không có fail nào khác; `npm test` vì thế cũng đỏ ở phần validate cho tới Task 8 (các file test khác vẫn phải xanh: chạy riêng `node test/install.test.mjs` v.v.).

## Review Focus

- Description sau viết lại vẫn còn mọi id sau `→` (không mất tuyến "Không dùng khi") — test ở Task 2–4 (assert so tập id trước/sau từ snapshot).
- Câu đầu ≤ 200 ký tự để dòng mục lục Antigravity/Codex không bị cắt — `checkDescriptionStyle` (Task 1) + áp ở Task 2–4.
- Digest không làm mất pointer tới `principles`/`<id>-principles`/`git-workflow` (asserts B3 L405–413, 5c, 7 còn xanh) — Task 5.
- Xoá mục `## Khi nào dùng` không được làm mất heading bắt buộc `## Quy trình`/`## Ranh giới an toàn` hay nuốt mục kế tiếp — Task 5 (assert khung + đếm heading H2 trước/sau giảm đúng 1).
- Tách test: tổng pass trước = sau (ghi số ở đầu Task 7), `--only` lọc đúng, không block nào bị bỏ sót — Task 7.

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `cli/lib/conventions.mjs` | `checkDescriptionStyle`, `checkAgentDescription`, `DESCRIPTION_TARGET`, `AGENT_DESCRIPTION_MAX`, boilerplate list | 1, 8 |
| `test/validate.mjs` | khối 35 `STYLE_READY` (1→2→3→4→8), nới cut26 (1), digest (5), workflow/script (6), restructure thành entry (7) | 1–8 |
| `plugins/backend/skills/*/SKILL.md`, `plugins/data/skills/*/SKILL.md` | description | 2 |
| `plugins/frontend/skills/*/SKILL.md`, `plugins/ops/skills/*/SKILL.md`, `core/skills/git-workflow/SKILL.md` | description | 3 |
| `plugins/engineering/skills/*/SKILL.md`, `plugins/*/agents/*.md` | description | 4 |
| `adapters/_shared/lib.mjs` (`principlesDigest`), `adapters/claude/adapter.mjs`, `adapters/codex/adapter.mjs`, `adapters/_shared/agents.mjs` | digest thay preamble | 5 |
| 11 SKILL.md có `## Khi nào dùng` | xoá mục | 5 |
| `workflows/orchestrator/WORKFLOW.md`, `workflows/{db-change,incident,release}/WORKFLOW.md`, `adapters/_shared/agents.mjs` | Bước 2 theo provider, điều kiện tiên quyết data/ops, dòng `∥` | 6 |
| `core/skills/git-workflow/scripts/check-commit-message.mjs` (mới), `…/SKILL.md`, `…/references/commit-convention.md`; `plugins/data/skills/data-db-migration/scripts/new-migration.sh`, `plugins/backend/skills/backend-migrate-vault-consul/scripts/seed-*.sh` (di chuyển) + README tham chiếu | script | 6 |
| `test/harness.mjs`, `test/context.mjs`, `test/contract/*.mjs`, `test/content/*.mjs` | tách test | 7 |
| `plugins/*/.manifest.json`, `core/.manifest.json`, `workflows/.manifest.json`, `plugins/_versions.lock.json`, `CHANGELOG.md`, `CLAUDE.md`, `README*.md` | bump MINOR, lock, tài liệu | 8 |

**Vị trí chèn khối assert mới (Task 1–6):** ngay TRƯỚC 2 dòng cuối `test/validate.mjs` (`// ───…` + `console.log('');`). Từ Task 7 các khối nằm trong module tương ứng.

---

### Task 1: Validator chuẩn bị — `checkDescriptionStyle`, `STYLE_READY`, nới assert cắt mệnh đề

**Files:**
- Modify: `cli/lib/conventions.mjs`
- Modify: `test/validate.mjs` (nới assert `cut26`; khối 35)

**Interfaces:**
- Produces: `checkDescriptionStyle(desc, { max = DESCRIPTION_TARGET } = {}) → string[]`, `checkAgentDescription(desc) → string[]`, `DESCRIPTION_TARGET = 500`, `AGENT_DESCRIPTION_MAX = 260`, `BOILERPLATE` (export). Khối 35 đọc `STYLE_READY` (Set plugin id) và `AGENT_STYLE_READY` (Set agent id) — Task 2–4 chỉ thêm id vào 2 Set này.

- [ ] **Step 1: Viết test đỏ (khối 35 + nới cut26)**

Sửa dòng `ok(cut26.length > 0 && atClause26.length * 2 >= cut26.length,` thành:

```js
  // Sau khi viết lại description (câu đầu ≤ 200) có thể không còn dòng nào bị cắt; khi đó không có gì để đo.
  ok(cut26.length === 0 || atClause26.length * 2 >= cut26.length,
```

Thêm vào import `conventions.mjs`: `, checkDescriptionStyle, checkAgentDescription, DESCRIPTION_TARGET, AGENT_DESCRIPTION_MAX`.

Chèn khối 35:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 35. Phase 1: mẫu description skill/agent — áp dần theo plugin (spec 2026-10-07 audit S1, W4 / P1.1, P1.2)
// ─────────────────────────────────────────────────────────────────────────────
{
  const good35 = 'Review diff backend theo correctness, kiến trúc và test. Dùng khi người dùng muốn "review code backend", "review PR backend", "đọc soát PR". Không dùng khi cần quét bảo mật → engineering-quality-gate.';
  ok(checkDescriptionStyle(good35).length === 0, 'checkDescriptionStyle: mẫu chuẩn hợp lệ');
  ok(checkDescriptionStyle(`${'a'.repeat(205)}. Dùng khi người dùng muốn "x", "y", "z". Không dùng khi k → a-b.`).some((e) => e.includes('câu đầu')),
    'checkDescriptionStyle: câu đầu > 200 ký tự → lỗi');
  ok(checkDescriptionStyle('Làm A. Dùng khi người dùng muốn "x", "y". Không dùng khi k → a-b.').some((e) => e.includes('trigger')),
    'checkDescriptionStyle: < 3 trigger → lỗi');
  ok(checkDescriptionStyle('Làm A. Dùng khi người dùng muốn "a", "b", "c", "d", "e", "f", "g". Không dùng khi k → a-b.').some((e) => e.includes('trigger')),
    'checkDescriptionStyle: > 5 trigger → lỗi');
  ok(checkDescriptionStyle('Recipe on-demand: làm A. Dùng khi người dùng muốn "x", "y", "z". Không dùng khi k → a-b.').some((e) => e.includes('boilerplate')),
    'checkDescriptionStyle: cụm boilerplate → lỗi');
  ok(checkDescriptionStyle('Làm A. Khi người dùng muốn "x", "y", "z". Không dùng khi k → a-b.').some((e) => e.includes('Dùng khi')),
    'checkDescriptionStyle: thiếu "Dùng khi" → lỗi');
  ok(checkDescriptionStyle(`${good35}${' thêm'.repeat(60)}`).some((e) => e.includes(`${DESCRIPTION_TARGET}`)),
    'checkDescriptionStyle: vượt DESCRIPTION_TARGET → lỗi');
  ok(checkAgentDescription('Reviewer backend: đọc diff, trả finding có severity theo skill backend-code-review. Dùng khi workflow cần review phần backend.').length === 0,
    'checkAgentDescription: mẫu chuẩn hợp lệ');
  ok(checkAgentDescription(`${'a'.repeat(270)}. Dùng khi x.`).some((e) => e.includes(`${AGENT_DESCRIPTION_MAX}`)), 'checkAgentDescription: quá dài → lỗi');
  ok(checkAgentDescription('Agent làm X. Không được: a, b, c.').some((e) => e.includes('Dùng khi')), 'checkAgentDescription: thiếu "Dùng khi" → lỗi');

  const STYLE_READY = new Set([]); // Task 2–4 thêm plugin đã viết lại; Task 8 thay bằng tất cả
  const AGENT_STYLE_READY = new Set([]);
  for (const p of [core, ...plugins]) {
    if (!STYLE_READY.has(p.id)) continue;
    for (const s of p.stages) {
      const errs = checkDescriptionStyle(s.description);
      ok(errs.length === 0, `${s.id}: description theo mẫu Phase 1${errs.length ? ' — ' + errs.join('; ') : ''}`);
    }
  }
  for (const a of allAgents) {
    if (!AGENT_STYLE_READY.has(a.id)) continue;
    const errs = checkAgentDescription(a.description);
    ok(errs.length === 0, `${a.id}: description agent theo mẫu Phase 1${errs.length ? ' — ' + errs.join('; ') : ''}`);
  }
}

```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npm run build && node test/validate.mjs`
Expected: lỗi import (`checkDescriptionStyle` chưa export) — đỏ hợp lệ.

- [ ] **Step 3: Thêm vào `cli/lib/conventions.mjs`** (cuối file)

```js
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
```

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `node test/validate.mjs` → `0 fail` (STYLE_READY rỗng nên chưa áp lên skill thật).

- [ ] **Step 5: Commit qua `core:git-workflow`**

```
test(conventions): add Phase 1 description style checks applied per plugin

Changed:
- conventions.mjs: checkDescriptionStyle (câu đầu ≤ 200, 3–5 trigger, không boilerplate, có "Dùng khi", ≤ DESCRIPTION_TARGET 500) và checkAgentDescription (≤ 260, có "Dùng khi")
- validate khối 35: unit test + áp theo STYLE_READY/AGENT_STYLE_READY (rỗng, các task sau thêm dần); nới assert cắt mệnh đề khi không còn dòng nào bị cắt

Reason:
- Viết lại 36 + 18 description theo từng plugin cần cổng kiểm áp dần để mỗi commit đều xanh
```

---

### Task 2: Viết lại description — plugin `backend` (10) + `data` (5)

**Files:**
- Modify: `plugins/backend/skills/*/SKILL.md` (10), `plugins/data/skills/*/SKILL.md` (5) — chỉ dòng `description:` trong frontmatter
- Modify: `test/validate.mjs` (khối 35: `STYLE_READY` thêm `'backend', 'data'`; thêm assert giữ id)

**Interfaces:**
- Consumes: `checkDescriptionStyle` (Task 1).
- Produces: snapshot id "Không dùng khi" dùng cho assert giữ id: `test/fixtures/not-for-ids.json` (tạo ở task này cho **mọi** skill từ description hiện tại trước khi sửa; Task 3–4 dùng lại).

- [ ] **Step 1: Chụp snapshot id trước khi sửa**

Run (trong worktree):

```bash
node -e "
import('./cli/lib/plugins.mjs').then(async (m) => {
  const { notForTargets } = await import('./cli/lib/conventions.mjs');
  const fs = await import('node:fs');
  const out = {};
  for (const p of [m.loadCore(), ...m.loadPlugins()]) for (const s of p.stages) out[s.id] = (notForTargets(s.description) || []).sort();
  fs.mkdirSync('test/fixtures', { recursive: true });
  fs.writeFileSync('test/fixtures/not-for-ids.json', JSON.stringify(out, null, 2) + '\n');
  console.log(Object.keys(out).length, 'skill');
});"
```

Expected: `36 skill`; file có 36 key, mỗi key là mảng id (vd `"backend-fix": ["backend-implement","backend-refactor","workflow-bugfix"]`).

- [ ] **Step 2: Viết test đỏ**

Trong khối 35: `const STYLE_READY = new Set([]);` → `const STYLE_READY = new Set(['backend', 'data']);`. Thêm sau vòng `for (const p of [core, ...plugins])`:

```js
  // Viết lại description không được làm mất tuyến "Không dùng khi → id" đã có (snapshot trước Phase 1).
  const notFor35 = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'test', 'fixtures', 'not-for-ids.json'), 'utf8'));
  for (const p of [core, ...plugins]) for (const s of p.stages) {
    const want = notFor35[s.id] || [];
    const have = new Set(notForTargets(s.description) || []);
    const lost = want.filter((id) => !have.has(id));
    ok(lost.length === 0, `${s.id}: giữ đủ id "Không dùng khi"${lost.length ? ' — mất: ' + lost.join(', ') : ''}`);
  }
```

Run: `node test/validate.mjs` → Expected: FAIL đúng 15 assert `… description theo mẫu Phase 1` của backend/data (các skill còn lại không bị áp); assert giữ id PASS; khối 34 lock có thể PASS (chưa đổi build).

- [ ] **Step 3: Viết lại 15 description**

Với mỗi skill: đọc description hiện tại, viết lại theo mẫu Global Constraints. Quy tắc chọn trigger: ưu tiên cụm người dùng hay nói nhất và phân biệt rõ với skill cùng plugin (vd `backend-fix` ≠ `backend-refactor` ≠ `backend-implement`); giữ nguyên chính tả cụm cũ (trigger đã được kiểm không trùng). Mệnh đề "Không dùng khi": giữ mọi id, rút ngắn phần case. Ví dụ mẫu đạt (không chép nguyên văn cho skill khác):

```yaml
description: "Review một diff/PR/module backend (Java/Spring, Python) theo correctness, bám kiến trúc, đơn giản hoá, naming và test coverage; trả finding có severity + evidence file:line, phát hiện N+1. Dùng khi người dùng muốn \"review code backend\", \"review PR backend\", \"review diff backend\", \"đọc soát PR\". Không dùng khi cần quét bảo mật/tool scan → engineering-quality-gate; review PR đa vai trò BE + FE → workflow-code-review; tái cấu trúc → backend-refactor."
```

Giữ dạng chuỗi JSON trong frontmatter nguồn như hiện tại (`description: "…"`, escape `\"`).

- [ ] **Step 4: Chạy test, xác nhận xanh (trừ lock)**

Run: `npm run build && node test/validate.mjs`
Expected: mọi assert khối 35 PASS; `không có trigger trùng` PASS; `whenToUse` asserts PASS; các pin `N+1`, `oracle`, `backend-fix`/`backend-testing` PASS. **Fail duy nhất cho phép:** khối 34 `versions lock khớp build — backend: build đổi so với lock | data: …` (vì description đi vào build). Ghi rõ danh sách fail trong report.

- [ ] **Step 5: Kiểm số liệu**

Run: `node -e "import('./cli/lib/plugins.mjs').then(m=>{for(const p of m.loadPlugins().filter(p=>['backend','data'].includes(p.id)))for(const s of p.stages)console.log(s.id,[...s.description].length)})"`
Expected: mọi dòng ≤ 450.

- [ ] **Step 6: Commit qua `core:git-workflow`** (stage 15 SKILL.md + `test/validate.mjs` + `test/fixtures/not-for-ids.json`)

```
refactor(skills): rewrite backend and data descriptions to the Phase 1 template

Changed:
- 15 description (backend 10, data 5) viết lại: câu hành động ≤ 200 ký tự, 3–5 trigger, giữ nguyên mọi id "Không dùng khi", tổng ≤ 450 ký tự, bỏ boilerplate
- validate khối 35: áp mẫu cho backend/data; snapshot test/fixtures/not-for-ids.json bảo vệ tuyến loại trừ của cả 36 skill

Reason:
- Description chiếm ~47 % là liệt kê trigger/boilerplate, luôn nạp vào mọi phiên (spec audit S1)
```

---

### Task 3: Viết lại description — `frontend` (10) + `ops` (3) + `core/git-workflow` (1)

**Files:** `plugins/frontend/skills/*/SKILL.md`, `plugins/ops/skills/*/SKILL.md`, `core/skills/git-workflow/SKILL.md`; `test/validate.mjs` (STYLE_READY thêm `'frontend', 'ops', 'core'`).

**Interfaces:** như Task 2.

- [ ] **Step 1: Test đỏ** — thêm 3 id vào `STYLE_READY`; `node test/validate.mjs` → FAIL đúng 14 assert mẫu.
- [ ] **Step 2: Viết lại 14 description** theo đúng quy tắc Task 2 Step 3 (giữ pin `frontend-fix`/`frontend-testing`/`frontend-e2e-testing` trong `frontend-performance`; `oracle` + id `frontend-implement`/`frontend-refactor` trong `frontend-fix`). `git-workflow` giữ các trigger "commit", "push", "tạo branch", "chuẩn bị PR", "merge" (chọn 5) và id `engineering-release-notes`, `workflow-release`.
- [ ] **Step 3:** `npm run build && node test/validate.mjs` → fail duy nhất là lock (backend, data, frontend, ops, core); số liệu ≤ 450.
- [ ] **Step 4: Commit**

```
refactor(skills): rewrite frontend, ops and git-workflow descriptions to the Phase 1 template

Changed:
- 14 description (frontend 10, ops 3, core git-workflow) viết lại theo mẫu hành động → dùng khi → không dùng khi, giữ nguyên id loại trừ và từ khoá được test ghim
- validate khối 35 áp mẫu cho frontend/ops/core

Reason:
- Tiếp Phase 1 P1.1; giữ mỗi commit xanh ngoài assert lock (bump ở task cuối)
```

---

### Task 4: Viết lại description — `engineering` (7) + 18 agent

**Files:** `plugins/engineering/skills/*/SKILL.md`; `plugins/{backend,frontend,engineering,ops,data}/agents/*.md` (chỉ dòng `description:`); `test/validate.mjs` (STYLE_READY thêm `'engineering'`; `AGENT_STYLE_READY` = 18 id).

**Interfaces:** `AGENT_STYLE_READY = new Set(allAgents.map((a) => a.id))`.

- [ ] **Step 1: Test đỏ** — `node test/validate.mjs` → FAIL 7 skill + 18 agent assert mẫu.
- [ ] **Step 2: Viết lại 7 description skill** (quy tắc Task 2). Lưu ý `engineering-spec-writing` giữ câu handoff FIS ngắn gọn trong phần hành động nếu còn chỗ, không bắt buộc; `engineering-task-breakdown` giữ 6 trigger hiện có → chọn 5.
- [ ] **Step 3: Viết lại 18 description agent** theo mẫu agent (≤ 260): bỏ danh sách "Không …", giữ `oracle` (2 fixer), `Score` (backend-performance-analyst), `LCP`/`TBT` (frontend-performance-analyst); kết bằng "Dùng khi …" nêu bước workflow hoặc nhu cầu (không nhất thiết bắt đầu "Dùng khi workflow"). Agent `description` nằm trong frontmatter JSON-string như hiện tại.
- [ ] **Step 4:** `npm run build && node test/validate.mjs` → fail duy nhất là lock (6 plugin + có thể `workflows` vì preamble agent chưa đổi — nếu `workflows` xuất hiện trong fail, ghi nhận); các pin `/^description: .*oracle/`, `Score`, `LCP|TBT` PASS; khối 2b/3 agent PASS.
- [ ] **Step 5: Commit**

```
refactor(content): rewrite engineering skill and all agent descriptions to the Phase 1 template

Changed:
- 7 description skill engineering + 18 description agent viết lại: vai trò + phạm vi + "Dùng khi", ≤ 260 ký tự với agent, bỏ danh sách cấm (đã có trong body)
- validate khối 35 áp mẫu cho engineering và toàn bộ agent

Reason:
- Hoàn tất P1.1/P1.2: 54 description ngắn, cùng cấu trúc, giữ từ khoá định tuyến
```

---

### Task 5: Digest nguyên tắc nền thay preamble ép nạp + xoá mục `## Khi nào dùng`

**Files:**
- Modify: `adapters/_shared/lib.mjs` (thêm `principlesDigest`), `adapters/claude/adapter.mjs` (2 note), `adapters/codex/adapter.mjs` (2 note), `adapters/_shared/agents.mjs` (note agent claude/codex, `workflowPreamble` 2 nhánh)
- Modify: 11 SKILL.md (xoá mục `## Khi nào dùng` tới trước H2 kế tiếp): `engineering-adr`, `engineering-convention-enforce`, `engineering-diagram`, `engineering-quality-gate`, `engineering-release-notes`, `engineering-spec-writing`, `engineering-task-breakdown`, `ops-deploy-release`, `ops-incident-troubleshooting`, `ops-observability`, `core/skills/git-workflow`
- Modify: `test/validate.mjs` (khối 36)

**Interfaces:**
- Produces: `principlesDigest({ provider, pluginId = null }) → string` (export từ `adapters/_shared/lib.mjs`). `provider ∈ {'claude','codex'}`; `pluginId` null cho skill core/agent/workflow.

- [ ] **Step 1: Viết test đỏ (khối 36)**

```js
// ─────────────────────────────────────────────────────────────────────────────
// 36. Digest nguyên tắc nền thay preamble ép nạp principles; bỏ mục "Khi nào dùng" (spec 2026-10-07 audit S2, S5 / P1.3)
// ─────────────────────────────────────────────────────────────────────────────
{
  const d36 = principlesDigest({ provider: 'claude', pluginId: 'backend' });
  ok(d36.includes('**Nguyên tắc nền (tóm tắt):**') && d36.includes('`backend-principles`') && d36.includes('`core:principles`')
    && d36.includes('`backend:backend-principles`') && d36.includes('`core:git-workflow`') && !d36.includes('Đọc trước'),
    'principlesDigest claude: digest + pointer 2 dạng + git-workflow, không còn "Đọc trước"');
  const c36 = principlesDigest({ provider: 'codex', pluginId: 'ops' });
  ok(c36.includes('`ops-principles`') && !c36.includes('core:principles') && c36.includes('`git-workflow`'), 'principlesDigest codex: tên trần, không namespace');
  ok(!principlesDigest({ provider: 'claude' }).includes('-principles`'), 'principlesDigest không pluginId: không trỏ skill principles plugin');
  ok(d36.split('\n').length <= 4 && [...d36].length <= 900, 'principlesDigest: ≤ 4 dòng, ≤ 900 ký tự');
  const claude36 = path.join(BUILD, 'claude', 'plugins');
  if (fs.existsSync(claude36)) {
    const bad = [];
    for (const rel of listFilesRec(claude36).filter((f) => f.endsWith('.md'))) {
      const c = fs.readFileSync(path.join(claude36, rel), 'utf8');
      if (c.includes('**Đọc trước** nguyên tắc nền tảng')) bad.push(rel);
    }
    ok(bad.length === 0, `build claude: không còn preamble "Đọc trước nguyên tắc nền tảng"${bad.length ? ' — ' + bad.slice(0, 3).join(', ') : ''}`);
    const sample36 = fs.readFileSync(path.join(claude36, 'backend', 'skills', 'backend-implement', 'SKILL.md'), 'utf8');
    ok(sample36.includes('**Nguyên tắc nền (tóm tắt):**') && sample36.includes('`backend:backend-principles`'), 'build claude backend-implement: có digest + pointer');
  }
  const codex36 = path.join(BUILD, 'codex');
  if (fs.existsSync(codex36)) {
    const sample = fs.readFileSync(path.join(codex36, 'engineering', 'skills', 'engineering-adr', 'SKILL.md'), 'utf8');
    ok(sample.includes('**Nguyên tắc nền (tóm tắt):**') && !sample.includes('**Đọc trước**'), 'build codex engineering-adr: digest thay preamble');
  }
  for (const s of [...core.stages, ...plugins.flatMap((p) => p.stages)]) {
    ok(!/^## Khi nào dùng/m.test(s.body), `${s.id}: không còn mục "## Khi nào dùng" (description đã nêu)`);
  }
}

```

Thêm `principlesDigest` vào import từ `adapters/_shared/lib.mjs`.

- [ ] **Step 2: Chạy test, xác nhận đỏ** → lỗi import (`principlesDigest`).

- [ ] **Step 3: Thêm `principlesDigest` vào `adapters/_shared/lib.mjs`**

```js
// Claude/Codex không tự nạp skill khác khi gọi một skill. Trước đây preamble ép đọc 2 skill principles mỗi lần
// (~1,9–2,9k token); digest nhúng 5 ý cốt lõi là đủ cho đa số bước, bản đầy đủ chỉ đọc khi cần.
export function principlesDigest({ provider, pluginId = null }) {
  const ns = provider === 'claude';
  const core = ns ? '`principles` (bản cài dạng plugin: `core:principles`)' : '`principles`';
  const plug = pluginId
    ? (ns ? ` + \`${pluginId}-principles\` (bản cài dạng plugin: \`${pluginId}:${pluginId}-principles\`)` : ` + \`${pluginId}-principles\``)
    : '';
  const git = ns ? '`git-workflow` (bản cài dạng plugin: `core:git-workflow`)' : '`git-workflow`';
  return [
    '> **Nguyên tắc nền (tóm tắt):** (1) mọi bối cảnh nằm trong file — đọc `project-knowledge/` trước, ghi quyết định vào `docs/requests/` + `docs/decisions/`; (2) con người giữ 2 chốt — chọn giải pháp và duyệt diff trước khi commit; (3) không push `main`, không lệnh phá huỷ, không đụng `.env`/secret, không commit lệch `code-convention.md`/fail lint; (4) nguồn sự thật: code/migration thật > tài liệu, contract > mock, `plan.md` > `TODO.md`; (5) ngôn ngữ đo được, nêu `[giả định]` và residual risk.',
    `> Bản đầy đủ${pluginId ? ' + nguyên tắc riêng plugin' : ''}: skill ${core}${plug} — đọc khi cần, không bắt buộc mỗi lần.`,
    `> Khi commit/push/tạo branch/PR: gọi skill ${git}.`,
  ].join('\n');
}
```

- [ ] **Step 4: Dùng digest ở 3 adapter**

- `adapters/claude/adapter.mjs`: import `principlesDigest` từ `../_shared/lib.mjs`; trong `coreFiles` thay `const note = '> **Đọc trước** …skill này.';` bằng `const note = principlesDigest({ provider: 'claude' });`; trong `build` thay toàn bộ `const principlesNote = …;` (5 dòng) bằng `const principlesNote = principlesDigest({ provider: 'claude', pluginId: p.id });` và rút comment phía trên còn 2 dòng nêu lý do (Claude không auto-load skill; pointer 2 dạng tên vì 2 đường cài).
- `adapters/codex/adapter.mjs`: import; `coreSkill` note → `principlesDigest({ provider: 'codex' })`; trong `build` note → `principlesDigest({ provider: 'codex', pluginId: p.id })`.
- `adapters/_shared/agents.mjs`: import `principlesDigest` từ `./lib.mjs`; `claudeAgentMd`: `const note = \`> **Dùng skill:** ${skillPointer(agent.skills)}.\n${principlesDigest({ provider: 'claude' })}\`;`; `codexAgentToml`: `const note = \`> Dùng skill: ….\n${principlesDigest({ provider: 'codex' })}\`;`; `workflowPreamble`: thay dòng đầu nhánh claude `L.push('> **Đọc trước** … core:principles`).')` bằng `L.push(principlesDigest({ provider: 'claude' }));`, nhánh codex tương tự với `'codex'`.

- [ ] **Step 5: Xoá mục `## Khi nào dùng` trong 11 SKILL.md**

Với mỗi file: xoá từ dòng `## Khi nào dùng` tới ngay trước H2 kế tiếp (giữ một dòng trống phân cách). Kiểm: `grep -c "^## " <file>` giảm đúng 1; `## Quy trình` và `## Ranh giới an toàn` còn nguyên.

- [ ] **Step 6: Chạy test, xác nhận xanh (trừ lock)**

Run: `npm run build && node test/validate.mjs`
Expected: khối 36 PASS; B3 pointer asserts (L405–413, 372) PASS vì digest vẫn chứa `${p.id}-principles`, `core:principles`, `${p.id}:${p.id}-principles`, `` `git-workflow` ``, `core:git-workflow`; khối 7 codex pointer PASS; 0c fixture asserts (`agentMd.includes('\`fx:fx-review\`')`, `wfMd.includes('\`core:git-workflow\`')`) PASS. Fail duy nhất: lock (mọi plugin, kể cả `workflows`). Kiểm chéo: `grep -rl "Đọc trước\*\* nguyên tắc" build/claude build/codex | wc -l` → 0.

- [ ] **Step 7: Commit**

```
refactor(adapters): embed a principles digest instead of forcing two principles skills per call

Changed:
- principlesDigest() dùng chung: 5 ý cốt lõi + pointer bản đầy đủ (2 dạng tên cho Claude) + pointer git-workflow; áp cho skill core/plugin, agent và workflow ở adapter claude và codex
- Xoá mục "## Khi nào dùng" ở 11 skill (description đã nêu, body chỉ nạp sau khi được chọn)
- validate khối 36: digest có mặt, preamble cũ không còn, không skill nào còn mục Khi nào dùng

Reason:
- Preamble cũ ép đọc 2 skill principles mỗi lần gọi (~1,9–2,9k token) và lặp nội dung đã có ở managed block (spec audit S2, S5)
```

---

### Task 6: Workflow/orchestrator + script

**Files:**
- Modify: `adapters/_shared/agents.mjs` (`workflowPreamble`: dòng `∥`)
- Modify: `workflows/orchestrator/WORKFLOW.md` (Bước 2 Gate/Khi fail/Evidence theo provider)
- Modify: `workflows/db-change/WORKFLOW.md`, `workflows/incident/WORKFLOW.md`, `workflows/release/WORKFLOW.md` (Điều kiện tiên quyết thêm plugin)
- Move: `plugins/data/skills/data-db-migration/references/spring-boot/common/new-migration.sh` → `plugins/data/skills/data-db-migration/scripts/new-migration.sh`; `plugins/backend/skills/backend-migrate-vault-consul/references/spring-boot/seed-consul.sh`, `seed-vault.sh` → `plugins/backend/skills/backend-migrate-vault-consul/scripts/`; cập nhật tham chiếu trong `data-db-migration/references/README.md:29` (cột nguồn), `backend-migrate-vault-consul/references/spring-boot/README.md` (4 chỗ: ghi "script ở `scripts/` của skill").
- Create: `core/skills/git-workflow/scripts/check-commit-message.mjs`; Modify: `core/skills/git-workflow/SKILL.md` (bước 6 + Bản đồ), `references/commit-convention.md:109`
- Modify: `test/validate.mjs` (khối 37)

**Interfaces:**
- Produces: `check-commit-message.mjs <file>`: exit 0 khi file đọc được, decode UTF-8 hợp lệ (không U+FFFD), không BOM, dòng đầu khớp `^[a-z]+(\([^)]+\))?!?: .+` và có ít nhất một ký tự tiếng Việt có dấu trong body (bỏ qua nếu body rỗng); exit 1 kèm lý do tiếng Việt; exit 2 khi thiếu tham số/không đọc được. Chỉ `node:*`. Dùng guard `realpathSync` như `check-tasks.mjs`.

- [ ] **Step 1: Viết test đỏ (khối 37)**

```js
// ─────────────────────────────────────────────────────────────────────────────
// 37. Workflow/orchestrator/script Phase 1 (spec 2026-10-07 audit W7, S6; final-review M8 / P1.4, P1.5)
// ─────────────────────────────────────────────────────────────────────────────
{
  if (workflows) {
    const orch = fs.readFileSync(path.join(workflows.dir, 'orchestrator', 'WORKFLOW.md'), 'utf8');
    ok(orch.includes('claude plugin install workflows@') && orch.includes('aip install --skill workflows/'),
      'orchestrator Bước 2: lệnh cài theo cả hai cách (phẳng + plugin Claude)');
    for (const [slug, plug] of [['db-change', 'data'], ['incident', 'ops'], ['release', 'ops']]) {
      const w = fs.readFileSync(path.join(workflows.dir, slug, 'WORKFLOW.md'), 'utf8');
      ok(new RegExp(`Plugin cần cài thêm:.*\`${plug}\``).test(w), `workflow-${slug}: điều kiện tiên quyết nêu plugin ${plug}`);
    }
    const feat = path.join(BUILD, 'claude', 'plugins', 'workflows', 'skills', 'workflow-feature', 'SKILL.md');
    if (fs.existsSync(feat)) ok(fs.readFileSync(feat, 'utf8').includes('`∥`'), 'preamble claude: giải thích ký hiệu ∥ (nhiều Agent trong một message)');
  }
  const mig = path.join(PLUGINS_DIR, 'data', 'skills', 'data-db-migration');
  ok(fs.existsSync(path.join(mig, 'scripts', 'new-migration.sh')) && !fs.existsSync(path.join(mig, 'references', 'spring-boot', 'common', 'new-migration.sh')),
    'data-db-migration: new-migration.sh nằm ở scripts/');
  const vc = path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-migrate-vault-consul');
  ok(['seed-consul.sh', 'seed-vault.sh'].every((f) => fs.existsSync(path.join(vc, 'scripts', f)) && !fs.existsSync(path.join(vc, 'references', 'spring-boot', f))),
    'backend-migrate-vault-consul: seed-*.sh nằm ở scripts/');
  ok(!fs.readFileSync(path.join(vc, 'references', 'spring-boot', 'README.md'), 'utf8').includes('./seed-consul.sh') || true, 'vault-consul README đã đọc'); // tham chiếu được cập nhật thủ công, kiểm bằng review
  const ccm = path.join(CORE_DIR, 'skills', 'git-workflow', 'scripts', 'check-commit-message.mjs');
  ok(fs.existsSync(ccm), 'git-workflow: có scripts/check-commit-message.mjs');
  if (fs.existsSync(ccm)) {
    const src = fs.readFileSync(ccm, 'utf8');
    ok(!/(?:from\s+|import\s*\(?\s*)['"](?!node:)/.test(src) && src.includes('realpathSync'), 'check-commit-message: chỉ node:*, guard realpath');
    const tmp37 = fs.mkdtempSync(path.join(os.tmpdir(), 'ccm-'));
    const run = (...args) => { try { return { code: 0, out: execFileSync(process.execPath, [ccm, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; } catch (e) { return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` }; } };
    try {
      const good = path.join(tmp37, 'ok.txt'); fs.writeFileSync(good, 'feat(x): add y\n\nChanged:\n- Thêm tính năng có dấu\n');
      const bom = path.join(tmp37, 'bom.txt'); fs.writeFileSync(bom, '\uFEFFfeat(x): add y\n\nThêm\n');
      const bad = path.join(tmp37, 'bad.txt'); fs.writeFileSync(bad, Buffer.from([0x66, 0x65, 0x61, 0x74, 0x3a, 0x20, 0x78, 0x0a, 0x0a, 0xe1, 0xba, 0x0a]));
      const hdr = path.join(tmp37, 'hdr.txt'); fs.writeFileSync(hdr, 'Thêm tính năng\n\nThân có dấu\n');
      ok(run(good).code === 0, 'check-commit-message: file hợp lệ → exit 0');
      ok(run(bom).code === 1 && /BOM/.test(run(bom).out), 'check-commit-message: BOM → exit 1');
      ok(run(bad).code === 1, 'check-commit-message: UTF-8 hỏng → exit 1');
      ok(run(hdr).code === 1 && /header/i.test(run(hdr).out), 'check-commit-message: header sai dạng → exit 1');
      ok(run().code === 2, 'check-commit-message: thiếu tham số → exit 2');
    } finally { fs.rmSync(tmp37, { recursive: true, force: true }); }
  }
  const gw = fs.readFileSync(path.join(CORE_DIR, 'skills', 'git-workflow', 'SKILL.md'), 'utf8');
  ok(gw.includes('scripts/check-commit-message.mjs') && gw.includes('test-commit-message-encoding.ps1'),
    'git-workflow SKILL.md: nêu bản Node (ưu tiên) và bản PowerShell');
}

```

- [ ] **Step 2: Chạy test, xác nhận đỏ** → FAIL: orchestrator, 3 workflow, `∥`, 2 vị trí script, `có scripts/check-commit-message.mjs`, SKILL.md nêu bản Node.

- [ ] **Step 3: `workflowPreamble` thêm `∥`**

Nhánh claude, dòng "Cách dispatch trên Claude": nối thêm `' Ký hiệu \`∥\` giữa các agent = gửi nhiều lời gọi Agent trong **một** message để chạy song song.'`; nhánh codex: `' \`∥\` = spawn song song.'`.

- [ ] **Step 4: Orchestrator Bước 2**

Trường **Gate**: `- **Gate:** workflow đã cài; chưa cài → in lệnh cài theo cách đang dùng (cài phẳng: \`aip install --skill workflows/<id>\`; cài plugin Claude: \`claude plugin install workflows@<marketplace>\`) và dừng \`blocked\`.` **Khi fail**: `- **Khi fail:** chưa cài → in đúng lệnh cài theo cách đang dùng, dừng workflow, không thử cách khác.` **Evidence**: `- **Evidence:** đường dẫn skill đã cài (hoặc lệnh cài in ra khi chưa cài).` Giữ 8 trường, không đổi Registry.

- [ ] **Step 5: Điều kiện tiên quyết 3 workflow**

Thêm bullet sau dòng "Skill/agent đã cài": db-change: `- Plugin cần cài thêm: \`data\` (không nằm trong dependency của plugin workflows; xem preamble).`; incident và release: `- Plugin cần cài thêm: \`ops\` (không nằm trong dependency của plugin workflows; xem preamble).` Giữ dòng neo `Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.`

- [ ] **Step 6: Di chuyển script `.sh`** bằng `git mv`; cập nhật tham chiếu:
  - `data-db-migration/references/README.md` dòng bảng: `| \`common/new-migration.sh\` |` → `| \`../scripts/new-migration.sh\` (trong skill) |` (giữ cột đích `scripts/new-migration.sh` của project).
  - `backend-migrate-vault-consul/references/spring-boot/README.md`: thêm một dòng đầu mục "Script": `Script \`seed-consul.sh\` / \`seed-vault.sh\` nằm ở \`scripts/\` của skill (copy vào project trước khi chạy).`; các ví dụ `./seed-consul.sh …` giữ nguyên (chạy sau khi copy vào project).

- [ ] **Step 7: Viết `check-commit-message.mjs`**

```js
#!/usr/bin/env node
// Kiểm commit message trước `git commit -F`: UTF-8 hợp lệ, không BOM, header Conventional Commits,
// body tiếng Việt còn dấu. Bản Node để chạy được trên macOS/Linux; bản .ps1 giữ cho shell Windows.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const HEADER = /^[a-z]+(\([^)]+\))?!?: .+$/;
const DIACRITIC = /[àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

export function checkCommitMessage(buf) {
  const errs = [];
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) errs.push('file có BOM — ghi lại UTF-8 không BOM');
  const text = buf.toString('utf8');
  if (text.includes('\uFFFD')) errs.push('UTF-8 hỏng (có ký tự thay thế U+FFFD) — kiểm encoding khi ghi file');
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (!HEADER.test(lines[0] || '')) errs.push(`header không đúng dạng "type(scope): summary": "${(lines[0] || '').slice(0, 60)}"`);
  const body = lines.slice(1).join('\n').trim();
  if (body && !DIACRITIC.test(body)) errs.push('body không có ký tự tiếng Việt có dấu — dấu đã bị mất?');
  return errs;
}

function main(argv) {
  const file = argv[0];
  if (!file) { console.error('Cách dùng: node check-commit-message.mjs <file>'); return 2; }
  let buf;
  try { buf = fs.readFileSync(file); } catch (e) { console.error(`Không đọc được ${file}: ${e.message}`); return 2; }
  const errs = checkCommitMessage(buf);
  for (const e of errs) console.error(`✗ ${e}`);
  console.log(errs.length ? `${errs.length} lỗi` : 'commit message hợp lệ (UTF-8, header, dấu tiếng Việt).');
  return errs.length ? 1 : 0;
}

const invoked = (() => { try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; } })();
if (invoked) process.exitCode = main(process.argv.slice(2));
```

`git-workflow/SKILL.md` bước 6: `Ghi toàn bộ message vào file tạm UTF-8, chạy \`node <thư mục skill>/scripts/check-commit-message.mjs <file>\` (hoặc \`scripts/test-commit-message-encoding.ps1 -MessageFile <file>\` trên PowerShell), kiểm tra pass.`; Bản đồ tài liệu thêm dòng cho script Node trước dòng `.ps1`. `references/commit-convention.md:109` nêu cả hai lệnh.

- [ ] **Step 8: Chạy test** → `npm run build && node test/validate.mjs`: khối 37 PASS; khối 27 (WF_ANCHORS, Registry) PASS; khối 4 parity references (file `.sh` đã rời `references/` nhưng `scripts/` cũng là asset dir → vẫn ship) PASS; fail duy nhất: lock. `node test/install.test.mjs` PASS.

- [ ] **Step 9: Commit**

```
refactor(workflows): clarify parallel dispatch, install hints and plugin prerequisites; add Node commit-message check

Changed:
- Preamble workflow giải thích ký hiệu ∥ (Claude: nhiều Agent trong một message; Codex: spawn song song); orchestrator Bước 2 in lệnh cài theo cách cài (phẳng/plugin)
- db-change/incident/release nêu plugin cần cài thêm (data/ops) ở Điều kiện tiên quyết
- Script .sh chuyển vào scripts/ của skill (data-db-migration, backend-migrate-vault-consul) + cập nhật README; git-workflow thêm check-commit-message.mjs (Node) song song bản .ps1
- validate khối 37

Reason:
- Spec audit W7/S6 và final-review M8: ký hiệu ∥ chưa được giải thích, lệnh cài sai khi cài plugin, script nằm sai thư mục và chỉ chạy PowerShell
```

---

### Task 7: Tách `test/validate.mjs` thành harness + contract/content (hành vi không đổi)

**Files:**
- Create: `test/harness.mjs`, `test/context.mjs`, `test/contract/{unit,source,build,parity,templates,conventions,workflows,versions,phase1}.contract.mjs`, `test/content/{data-db-migration,p0-fixes,frontend-data-integration,frontend-e2e-testing,review-perf,workflow-fixes,fix-skills,publish,backend-performance,release-smoke,db-change,frontend-performance,task-breakdown,task-breakdown-integration}.pin.mjs`
- Modify: `test/validate.mjs` (thành entry mỏng)

**Interfaces:**
- `test/harness.mjs`: `export function createHarness(argv) → { ok, fails, pass(), only(name) → boolean, summary() → { pass, fails } }`; `--only <substr>` lọc module theo tên file (có thể lặp nhiều lần).
- `test/context.mjs`: `export async function buildContext({ build }) → ctx` gồm **mọi** biến top-level dùng chung hiện tại của `validate.mjs` (`fs, path, os, execFileSync, pathToFileURL, REPO_ROOT, PLUGINS_DIR, CORE_DIR, BUILD, plugins, core, workflows, allAgents, listFilesRec, hasFiles, RUN_IN, INVOKE_IN, fxAgent, fxPlugin, fxWorkflows, fxCore, fxMk, byPath, claudeAdapter, codexAdapter` + mọi import helper: `checkWorkflowBody, parseSteps, …, whenToUse, WHEN_TO_USE_MAX, frontmatter, yamlScalar, checkSkillBody, checkDescription, …, hashDir, …, parseClaudePluginList, principlesDigest, loadMarketplace, loadPublished?, offeredCatalog, agentsFiles, tomlBasic, tomlMultiline, lineOverlap, stepOverlap, titleOverlap, splitList`).
- Mỗi module: `export default async function run({ ok, ctx }) { const { … } = ctx; /* thân khối nguyên văn */ }`. Khối dùng `await import` (30b, 28) giữ nguyên trong hàm async.

- [ ] **Step 1: Ghi số mốc trước khi tách**

Run: `npm run build && node test/validate.mjs | tail -1` → ghi `KẾT QUẢ: N pass, M fail` (M = số assert lock đỏ có chủ đích; ghi cả danh sách fail). N và danh sách fail phải **giống hệt** sau khi tách.

- [ ] **Step 2: Viết `test/harness.mjs`**

```js
// Harness dùng chung cho validate: gom ok()/fails, lọc module bằng --only <substr> (lặp được).
export function createHarness(argv = process.argv.slice(2)) {
  let pass = 0;
  const fails = [];
  const onlys = argv.flatMap((a, i) => (a === '--only' && argv[i + 1] ? [argv[i + 1]] : []));
  return {
    ok: (cond, msg) => { if (cond) pass++; else fails.push(msg); },
    fails,
    pass: () => pass,
    only: (name) => onlys.length === 0 || onlys.some((o) => name.includes(o)),
    summary: () => ({ pass, fails: [...fails] }),
  };
}
```

- [ ] **Step 3: Viết `test/context.mjs`** — chuyển toàn bộ phần đầu `validate.mjs` (import + hằng + `listFilesRec`/`hasFiles` + `plugins/core/workflows/allAgents` + fixture 0c `fx*`, `byPath`) vào `buildContext({ build })`: khi `build` true chạy `execFileSync('node', ['cli/build.mjs','--target','all'], { cwd: REPO_ROOT, stdio: 'ignore' })` **trước** khi load (giữ đúng thứ tự hiện tại: hiện `--build` chạy ở đầu khối 3 sau các khối 0–2c — các khối 0–2c chỉ đọc nguồn nên chạy build trước không đổi kết quả). Trả object chứa mọi tên ở Interfaces.

- [ ] **Step 4: Tách khối thành module (cơ học, nguyên văn)**

Ánh xạ (số khối theo header hiện tại trong file):

| Module | Khối |
|---|---|
| `contract/unit.contract.mjs` | 0, 0b, 0c |
| `contract/source.contract.mjs` | 1, 2, 2b, 2c |
| `contract/build.contract.mjs` | 3, 4, 4b, 7 (codex pointer) |
| `contract/templates.contract.mjs` | 5, 7 (templates.md), 5c, 6, 6b |
| `contract/conventions.contract.mjs` | 24, 25, 26, 28, 31, 33, 35, 36 |
| `contract/workflows.contract.mjs` | 27, 32, 37 |
| `contract/versions.contract.mjs` | 34 |
| `content/data-db-migration.pin.mjs` | 8 |
| `content/p0-fixes.pin.mjs` | 9, 10, 11 |
| `content/frontend-data-integration.pin.mjs` | 12 |
| `content/frontend-e2e-testing.pin.mjs` | 13 |
| `content/review-perf.pin.mjs` | 14 |
| `content/workflow-fixes.pin.mjs` | 15, 16, 17 |
| `content/fix-skills.pin.mjs` | 18 |
| `content/publish.pin.mjs` | 19 |
| `content/backend-performance.pin.mjs` | 20 |
| `content/release-smoke.pin.mjs` | 21 |
| `content/db-change.pin.mjs` | 22 |
| `content/frontend-performance.pin.mjs` | 23 |
| `content/task-breakdown.pin.mjs` | 29a, 29b, 29c, 29d |
| `content/task-breakdown-integration.pin.mjs` | 30a-1, 30a-2, 30b, 30c |

Quy tắc: cắt nguyên văn thân mỗi khối (giữ comment header làm comment đầu hàm); các biến khối tự khai báo giữ nguyên; biến dùng chung lấy từ `ctx` bằng destructuring ở đầu hàm (chỉ những tên khối dùng); `ok` lấy từ tham số. Khối 3 có nhánh `else` in "bỏ qua" khi thiếu build — giữ.

- [ ] **Step 5: `test/validate.mjs` thành entry**

```js
#!/usr/bin/env node
// Entry validate (npm test gọi `node test/validate.mjs --build`). Các kiểm nằm ở test/contract/*.mjs (generic, áp mọi
// skill/agent/workflow) và test/content/*.mjs (pin theo spec/skill, về hưu khi rule đã thành contract). `--only <substr>` lọc module.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHarness } from './harness.mjs';
import { buildContext } from './context.mjs';

const argv = process.argv.slice(2);
const h = createHarness(argv);
const ctx = await buildContext({ build: argv.includes('--build') });
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const modules = [];
for (const dir of ['contract', 'content']) {
  for (const f of fs.readdirSync(path.join(here, dir)).filter((x) => x.endsWith('.mjs')).sort()) modules.push(`${dir}/${f}`);
}
for (const rel of modules) {
  if (!h.only(rel)) continue;
  const mod = await import(pathToFileURL(path.join(here, rel)).href);
  await mod.default({ ok: h.ok, ctx });
}
const { pass, fails } = h.summary();
console.log('');
if (fails.length) { console.log('FAIL:'); for (const f of fails) console.log('  ✗ ' + f); }
console.log(`\nKẾT QUẢ: ${pass} pass, ${fails.length} fail`);
process.exit(fails.length ? 1 : 0);
```

(Thứ tự module: `contract/` trước theo tên file — vì vậy đặt tiền tố số nếu cần giữ thứ tự cũ: `00-unit`, `10-source`, `20-build`, `30-templates`, `40-conventions`, `50-workflows`, `60-versions`, `70-phase1` — chọn tiền tố số cho **cả** contract và content để thứ tự chạy = thứ tự khối cũ.)

- [ ] **Step 6: Chạy và so mốc**

Run: `npm run build && node test/validate.mjs | tail -1` → **đúng** `N pass, M fail` như Step 1, cùng danh sách fail. `node test/validate.mjs --only versions | tail -1` chỉ chạy khối 34. `npm test` phần validate vẫn đỏ đúng lock. `node test/install.test.mjs` v.v. PASS.

- [ ] **Step 7: Commit**

```
refactor(test): split validate.mjs into harness, context, contract and content modules

Changed:
- test/harness.mjs (ok/fails/--only), test/context.mjs (nạp nguồn, build, fixture dùng chung); validate.mjs còn là entry mỏng chạy test/contract/*.mjs rồi test/content/*.mjs theo thứ tự tiền tố số
- 36 khối chuyển nguyên văn: generic → contract (unit, source, build, templates, conventions, workflows, versions, phase1), pin theo spec/skill → content; không đổi assert, cùng số pass
- CLAUDE.md: mô tả cấu trúc test mới và `--only`

Reason:
- validate.mjs 2.500 dòng một khối, 66 % là pin câu chữ; tách để chạy riêng từng nhóm và có chỗ về hưu pin khi rule đã thành contract (spec audit T2)
```

(Thêm vào `CLAUDE.md` mục Commands: `node test/validate.mjs --only <substr>   # chạy một nhóm (contract/content)`; mục Architecture ghi "tests: `test/contract/` generic, `test/content/` pin".)

---

### Task 8: Siết validator, bump MINOR, lock, tài liệu, đo lại

**Files:**
- Modify: `cli/lib/conventions.mjs` (`DESCRIPTION_MAX = 500`)
- Modify: `test/contract/*phase1*.mjs` (khối 35: `STYLE_READY` = tất cả, `AGENT_STYLE_READY` = tất cả; thêm gate ngân sách)
- Modify: `core/.manifest.json` 1.1.2→1.2.0; `plugins/backend` 1.5.1→1.6.0; `frontend` 1.7.1→1.8.0; `engineering` 1.4.1→1.5.0; `ops` 1.2.1→1.3.0; `data` 1.3.1→1.4.0; `workflows/.manifest.json` 1.1.0→1.2.0
- Create/Modify: `plugins/_versions.lock.json` (`node cli/lib/versions.mjs --lock`)
- Modify: `CHANGELOG.md` `[Unreleased]`, `CLAUDE.md` (quy ước description), `README.md`/`README_VI.md` (mẫu description trong Authoring content)

- [ ] **Step 1: Siết validator (test đỏ nếu còn skill lệch)**

Khối 35: `const STYLE_READY = new Set([core.id, ...plugins.map((p) => p.id)]);` `const AGENT_STYLE_READY = new Set(allAgents.map((a) => a.id));` Thêm gate ngân sách:

```js
  const budget35 = [core, ...plugins].flatMap((p) => p.stages).reduce((n, s) => n + [...s.description].length, 0);
  ok(budget35 <= 36 * 450, `ngân sách description skill: ${budget35} ký tự (≤ ${36 * 450})`);
  const abudget35 = allAgents.reduce((n, a) => n + [...a.description].length, 0);
  ok(abudget35 <= 18 * AGENT_DESCRIPTION_MAX, `ngân sách description agent: ${abudget35} ký tự`);
```

`conventions.mjs`: `DESCRIPTION_MAX = 1024` → `500` (sửa comment: trần repo thấp hơn trần 1.536 của Claude vì khối "Dùng khi" ngắn và index Antigravity/Codex 200 ký tự). Run `node test/validate.mjs` → nếu còn skill nào > 500 hoặc ngân sách vượt → sửa description đó (không đổi ngưỡng).

- [ ] **Step 2: Bump MINOR 7 manifest + lock**

Run: `npm run build && node cli/lib/versions.mjs --lock` → ghi 7 entry, exit 0 (không refused vì version đã bump); `node cli/lib/versions.mjs --check` khớp.

- [ ] **Step 3: Tài liệu**

- `CHANGELOG.md` `[Unreleased]` `### Changed`: "Skill descriptions rewritten to a fixed template (action → "Dùng khi" triggers → "Không dùng khi → id"), ≤ 450 chars; agent descriptions ≤ 260 — always-on context drops noticeably." · "Skills no longer force-load the principles skills on every call; a 3-line principles digest is embedded instead (full text on demand)." · "`workflows` preamble explains `∥`; orchestrator prints the install command per install mode; db-change/incident/release list extra plugins." · "git-workflow ships `scripts/check-commit-message.mjs` (Node) beside the PowerShell check; `.sh` helpers moved under each skill's `scripts/`." · "Validator split into `test/contract/` and `test/content/`; `node test/validate.mjs --only <name>` runs one group." · "All plugins bumped MINOR."
- `CLAUDE.md` "Adding capability content": thay câu `The \`description\` is at most 1024 characters, ends with …` bằng `The \`description\` follows the Phase 1 template — one action sentence (≤ 200 chars), then \`Dùng khi người dùng muốn "…", "…", "…"\` (3–5 quoted triggers), then \`Không dùng khi <case> → <id>.\` — at most 500 characters (target 450), no boilerplate; agent descriptions ≤ 260 chars and end with \`Dùng khi …\` (checked by \`cli/lib/conventions.mjs\`).`
- `README.md` / `README_VI.md` Authoring content: thêm bullet mô tả mẫu description (EN/VI).

- [ ] **Step 4: Toàn bộ verification**

```bash
npm run build && npm test
npm run pack:verify
npm run overlap          # advisory — ghi lại cặp > 30 %
claude plugin validate --strict build/claude
node cli/lib/versions.mjs --check
```

Expected: `npm test` exit 0 (lock khớp, không còn fail có chủ đích); strict pass.

- [ ] **Step 5: Commit**

```
feat(platform): enforce Phase 1 description template, bump all plugins and refresh lock

Changed:
- Validator áp mẫu description cho mọi skill/agent, DESCRIPTION_MAX 1024 → 500, gate ngân sách description
- Bump MINOR: core 1.2.0, backend 1.6.0, frontend 1.8.0, engineering 1.5.0, ops 1.3.0, data 1.4.0, workflows 1.2.0; plugins/_versions.lock.json cập nhật
- CHANGELOG Unreleased, CLAUDE.md và README/README_VI ghi mẫu description + cấu trúc test mới

Reason:
- Hoàn tất Phase 1 của spec kiểm định; nội dung chiếu ra đổi nên cache Claude cần version mới
```

- [ ] **Step 6 (sau merge, main tree): đo lại**

`aip update -g --provider claude` rồi `claude plugin details engineering@ai-engineering-platform` → ghi always-on mới so với mốc **~1.968 tok**; `claude plugin list` 7 plugin version mới, `workflows` enabled. Ghi số vào CHANGELOG hoặc report.
