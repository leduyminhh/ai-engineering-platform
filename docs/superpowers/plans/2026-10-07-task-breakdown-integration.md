# task-breakdown integration + check-tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nối skill `engineering-task-breakdown` vào 3 skill code, `workflow-feature`, agent `engineering-spec-analyst`, principles engineering (Phase 1), rồi thêm script Node zero-dep `check-tasks.mjs` kiểm `tasks.md` + xuất CSV (Phase 2).

**Architecture:** Phase 1 là sửa câu chữ trong recipe markdown + assert khối 30a ở `test/validate.mjs`. Phase 2 thêm `plugins/engineering/skills/engineering-task-breakdown/scripts/check-tasks.mjs` (thư mục cạnh SKILL.md tự ship sang 4 provider), export `parseTasks`/`checkTasks`/`toCsv` để `validate.mjs` import và test bằng fixture (khối 30b), rồi cập nhật tài liệu skill + nguyên tắc plugin + manifest (khối 30c).

**Tech Stack:** Node.js ≥ 20 ESM, chỉ built-in (`node:fs`, `node:path`, `node:url`, `node:os`, `node:child_process`); test qua `node test/validate.mjs` (hàm `ok(cond, msg)`).

**Spec:** `docs/superpowers/specs/2026-10-07-task-breakdown-integration-design.md`

## Global Constraints

- Nội dung tiếng Việt CÓ DẤU, UTF-8 **không BOM**, line ending **LF** cho mọi file nguồn trong repo.
- KHÔNG sửa: `package.json`, `pack.config.json`, `cli/`, `adapters/`, `plugins/_published.json`, `plugins/_cowork.json`.
- KHÔNG bump version manifest `backend` / `frontend` (đang bị assert ghim `test/validate.mjs:1316`, `:1470`, `:1789`).
- `workflows/feature/WORKFLOW.md`: KHÔNG đổi số bước, frontmatter `agents`, hay Registry orchestrator; khung `WF_ANCHORS` + 8 trường mỗi bước phải giữ nguyên.
- Script `check-tasks.mjs`: chỉ import `node:*`; exit `0` không lỗi, `1` có lỗi E*, `2` sai tham số/không đọc được file; CSV chỉ ghi khi 0 lỗi; CSV = `﻿` + mọi ô quote + `"` nhân đôi + dòng kết thúc `\r\n`; 11 cột `ID · UC · Loại · Tiêu đề · Size · Phụ thuộc · Owner · Trạng thái · Skill gợi ý · AC · Link chi tiết`.
- Mã luật: E1 ID/Loại, E2 trùng ID, E3 bảng tổng ↔ chi tiết + anchor, E4 phụ thuộc không tồn tại, E5 vòng phụ thuộc, E6 size, E7 AC chưa phủ, E8 AC lạ / task 0 AC, E9 ô trống + B1–B10/F1–F9; W1 thiếu phụ thuộc tối thiểu, W2 FE-UI chờ CT.
- Agent subagent không sửa `tasks.md`; skill code chỉ báo trạng thái đề xuất.
- Commit qua `core:git-workflow`: header tiếng Anh `type(scope): summary`, body tiếng Việt có dấu (Changed/Reason), `git commit -F <file>` sau khi chạy script encoding, KHÔNG có dòng `Co-authored-by` / `Co-Authored-By`. Branch: `feature/task-breakdown-integration`.
- Comment trong code: tiếng Việt, chỉ giải thích *vì sao*, chỉ khi qua quality gate của AGENTS.md.

## Review Focus

- `tasks.md` lưu CRLF (Windows) → parse như LF, 0 lỗi; test ở Task 3 (fixture `.replace(/\n/g, '\r\n')`).
- `tasks.md` có BOM ở đầu → không làm hỏng heading đầu, 0 lỗi; test ở Task 3 (parse + CLI ghi file có BOM).
- Script được gọi qua junction/symlink (skill cài bằng junction trên Windows) → CLI vẫn chạy vì so sánh bằng `fs.realpathSync`; test ở Task 3 (assert nguồn dùng `realpathSync` trong guard CLI).
- Cột Phụ thuộc ghi dạng link `[UC01-CT-01](#uc01-ct-01)` thay vì ID trần → không báo E4/W1; test ở Task 3.
- Anchor cách heading một dòng trống, AC đã tick `- [x]` → vẫn nhận; test ở Task 3 (fixture task `UC01-FE-01`).

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/backend/skills/backend-implement/references/use-case-intake.md` | Nguồn D — task `BE` | 1 |
| `plugins/backend/skills/backend-implement/SKILL.md` | bước 1 nhắc task `BE` | 1 |
| `plugins/frontend/skills/frontend-implement/SKILL.md` | nhận task `FE-UI` | 1 |
| `plugins/frontend/skills/frontend-data-integration/SKILL.md` | nhận task `FE-INT` | 1 |
| `workflows/feature/WORKFLOW.md` | Bước 2 tuỳ chọn tách task, Bước 4 giao theo task | 2 |
| `plugins/engineering/agents/engineering-spec-analyst.md` | thêm skill + phạm vi | 2 |
| `plugins/engineering/shared/principles.md` | 7 skill (Task 2); 3 điều kiện script (Task 4) | 2, 4 |
| `README.md`, `README_VI.md` | bảng agent | 2 |
| `plugins/engineering/skills/engineering-task-breakdown/scripts/check-tasks.mjs` | parse/kiểm/xuất CSV + CLI | 3 |
| `plugins/engineering/skills/engineering-task-breakdown/SKILL.md`, `references/output-formats.md`, `references/breakdown-checklist.md` | dùng script | 4 |
| `plugins/engineering/.manifest.json` | 1.4.0 | 4 |
| `test/validate.mjs` | import `os` (Task 3); khối 30a (Task 1–2), 30b (Task 3), 30c (Task 4); assert 29d đổi version (Task 4) | 1–4 |

**Vị trí chèn khối assert:** mỗi khối mới chèn ngay TRƯỚC 2 dòng cuối file `test/validate.mjs`:

```js
// ─────────────────────────────────────────────────────────────────────────────
console.log('');
```

(khối sau nằm sau khối trước). Biến có sẵn: `fs`, `path`, `REPO_ROOT`, `PLUGINS_DIR`, `ok`, `execFileSync`, `pathToFileURL`.

Mọi lần chạy `node test/validate.mjs` sau khi đổi nội dung skill: chạy `npm run build` trước (assert build đọc `build/`).

---

### Task 1: Ba skill code nhận task từ `tasks.md`

**Files:**
- Modify: `plugins/backend/skills/backend-implement/references/use-case-intake.md` (chèn sau mục `## Nguồn C`)
- Modify: `plugins/backend/skills/backend-implement/SKILL.md` (bước `### 1. Chốt use-case`)
- Modify: `plugins/frontend/skills/frontend-implement/SKILL.md` (mục `### 1. Chuẩn hoá đầu vào → "design intent"`)
- Modify: `plugins/frontend/skills/frontend-data-integration/SKILL.md` (mục `### 0. Nạp context`)
- Modify: `test/validate.mjs` (khối 30a-1)

**Interfaces:**
- Consumes: định dạng `tasks.md` của skill `engineering-task-breakdown` (anchor `<a id="<id chữ thường>">`, mục B1–B10 / F1–F9).
- Produces: cụm chữ mà Task 2 (workflow Bước 4) dựa vào: mỗi agent nhận đầu vào dạng "task `<ID>` trong `tasks.md`".

- [ ] **Step 1: Viết test đỏ (khối 30a-1)**

```js
// ─────────────────────────────────────────────────────────────────────────────
// 30a-1. SOURCE: skill code nhận task từ tasks.md (spec 2026-10-07 integration §2.1–§2.4)
// ─────────────────────────────────────────────────────────────────────────────
{
  const rd = (...p) => fs.readFileSync(path.join(PLUGINS_DIR, ...p), 'utf8');
  const intake = rd('backend', 'skills', 'backend-implement', 'references', 'use-case-intake.md');
  ok(/^## Nguồn D — task `BE` trong `tasks\.md`$/m.test(intake) && ['B1', 'B3', 'B6', 'B10'].every((b) => intake.includes(`| ${b} `)),
    'backend-implement: use-case-intake có Nguồn D map trường task BE');
  ok(rd('backend', 'skills', 'backend-implement', 'SKILL.md').includes('task `BE` trong `tasks.md`'),
    'backend-implement: bước 1 liệt kê task BE trong tasks.md là nguồn đầu vào');
  const feImpl = rd('frontend', 'skills', 'frontend-implement', 'SKILL.md');
  ok(feImpl.includes('**Nhận task `FE-UI` từ `tasks.md`**') && feImpl.includes('F6 là `N/A`'),
    'frontend-implement: nhận task FE-UI, F6 để cho task FE-INT');
  const feInt = rd('frontend', 'skills', 'frontend-data-integration', 'SKILL.md');
  ok(feInt.includes('**Nhận task `FE-INT` từ `tasks.md`**') && feInt.includes('bảng B7'),
    'frontend-data-integration: nhận task FE-INT, map lỗi theo bảng B7');
  for (const [name, t] of [['use-case-intake', intake], ['frontend-implement', feImpl], ['frontend-data-integration', feInt]]) {
    ok(/KHÔNG sửa\s+`tasks\.md`/.test(t) && t.includes('[giả định]'),
      `${name}: agent không sửa tasks.md, hỏi lại mục [giả định]`);
  }
}

```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npm run build && node test/validate.mjs`
Expected: FAIL đúng 7 assert của khối 30a-1 (4 assert đầu + 3 assert vòng lặp). Riêng `use-case-intake`/`frontend-*` đã có chữ `[giả định]` nhưng chưa có `KHÔNG sửa tasks.md` nên vẫn đỏ.

- [ ] **Step 3: Sửa `use-case-intake.md`**

Chèn ngay TRƯỚC dòng `## Nguyên tắc "một use-case, một aggregate, tối giản"` (sau mục Nguồn C), giữ một dòng trống phân cách:

````markdown
## Nguồn D — task `BE` trong `tasks.md`

Do skill `engineering-task-breakdown` sinh; đầu vào dạng "task `UC01-BE-01` trong `docs/requests/<...>/tasks.md`".
Cách chốt:

- Đọc **chỉ** mục chi tiết của task đó (anchor `<a id="uc01-be-01">`) + mục của các task trong cột Phụ thuộc; không
  làm phần việc của task khác.
- Map trường task → phạm vi use-case:

  | Trường task | Phạm vi use-case |
  |---|---|
  | B1 Endpoint | kênh vào (endpoint / trigger) + input/output DTO theo contract |
  | B2 Use case | command hay query |
  | B3 Aggregate + invariant | aggregate root + invariant |
  | B4 Validation, B5 Phân quyền, B7 Bảng lỗi | ràng buộc ở biên + mã lỗi |
  | B6 Dữ liệu chạm | driven port (repository/gateway); đổi schema → task `DB` phải xong trước |
  | B8 Transaction / idempotency | ranh giới transaction |
  | B10 Test bắt buộc | test lõi + integration của slice |

- AC + DoD của task là tiêu chí xong; "Lệnh verify" là lệnh build/test phải chạy ở bước verify.
- Mục còn `[giả định]` ảnh hưởng thiết kế (aggregate, endpoint, quyền) → hỏi lại, không tự chốt.
- Kết thúc: báo trạng thái đề xuất (`Done` hoặc lý do chặn) để session chính cập nhật cột Trạng thái; KHÔNG sửa
  `tasks.md`.

````

- [ ] **Step 4: Sửa `backend-implement/SKILL.md` bước 1**

Trong mục `### 1. Chốt use-case`, dòng:

```markdown
`docs/contracts/openapi.json` nếu có), xác định phạm vi TRƯỚC khi sinh — chi tiết:
```

đổi thành:

```markdown
`docs/contracts/openapi.json` nếu có · task `BE` trong `tasks.md`), xác định phạm vi TRƯỚC khi sinh — chi tiết:
```

- [ ] **Step 5: Sửa `frontend-implement/SKILL.md`**

Ngay sau dòng `- Luôn map token quan sát → token chuẩn trong \`design-system.md\`; không chế token mới nếu đã có.` (trong mục `### 1.`), chèn:

```markdown
- **Nhận task `FE-UI` từ `tasks.md`** (do `engineering-task-breakdown` sinh, dạng "task `UC01-FE-01` trong
  `docs/requests/<...>/tasks.md`"): đọc **chỉ** mục chi tiết của task đó (anchor `<a id="uc01-fe-01">`) + mục của các
  task trong cột Phụ thuộc. Map: F2 → nguồn thiết kế đưa vào input adapter; F3 → component tái dùng/mới; F1, F4, F5,
  F7, F8 → yêu cầu UI (route, 4 trạng thái, form, phân quyền hiển thị, i18n/a11y/responsive); F6 là `N/A` (nối API
  thuộc task `FE-INT`); F9 → test render + interaction. AC + DoD của task là tiêu chí xong, "Lệnh verify" là lệnh phải
  chạy. Mục còn `[giả định]` ảnh hưởng thiết kế (nguồn thiết kế, component) → hỏi lại. Kết thúc: báo trạng thái đề
  xuất cho session chính; KHÔNG sửa `tasks.md`.
```

- [ ] **Step 6: Sửa `frontend-data-integration/SKILL.md`**

Ngay sau dòng `- Đọc các component được giao và liệt kê chỗ \`TODO\` / props còn thiếu dữ liệu do \`frontend-implement\` để lại.` (trong mục `### 0. Nạp context`), chèn:

```markdown
- **Nhận task `FE-INT` từ `tasks.md`** (do `engineering-task-breakdown` sinh, dạng "task `UC01-FE-02` trong
  `docs/requests/<...>/tasks.md`"): đọc **chỉ** mục chi tiết của task đó + mục của các task trong cột Phụ thuộc
  (task `FE-UI` trong đó là container/page cần nối). Map: F6 → `operationId` + map lỗi theo bảng B7 của task `BE`
  liên quan; F4 → 4 trạng thái; F9 → test mock bằng msw. AC + DoD của task là tiêu chí xong, "Lệnh verify" là lệnh
  phải chạy. Mục còn `[giả định]` (endpoint, map lỗi) → hỏi lại. Kết thúc: báo trạng thái đề xuất cho session chính;
  KHÔNG sửa `tasks.md`.
```

- [ ] **Step 7: Chạy test, xác nhận xanh**

Run: `npm run build && node test/validate.mjs`
Expected: `KẾT QUẢ: … pass, 0 fail` (khối 25/26 về khung và description của 4 skill vẫn xanh).

- [ ] **Step 8: Commit qua `core:git-workflow`**

Stage đúng 5 file (4 file skill + `test/validate.mjs`). Message:

```
feat(skills): let implement skills take a task from tasks.md

Changed:
- backend-implement: use-case-intake thêm Nguồn D map trường task BE (B1–B10) sang phạm vi use-case; bước 1 liệt kê task BE
- frontend-implement nhận task FE-UI (F2 → input adapter, F6 để cho FE-INT); frontend-data-integration nhận task FE-INT (F6 → operationId + map lỗi theo B7)
- Agent chỉ đọc mục task được giao + task phụ thuộc, hỏi lại mục [giả định], không sửa tasks.md
- Thêm khối assert 30a-1 trong test/validate.mjs

Reason:
- tasks.md của engineering-task-breakdown chưa có skill code nào biết đọc, agent nhận task phải tự đoán
```

---

### Task 2: `workflow-feature`, agent, principles 7 skill, README

**Files:**
- Modify: `workflows/feature/WORKFLOW.md` (Bước 2, Bước 4)
- Modify: `plugins/engineering/agents/engineering-spec-analyst.md`
- Modify: `plugins/engineering/shared/principles.md` (mục `## Bản chất plugin`, dòng "Con người giữ chốt")
- Modify: `README.md` (dòng bảng agent `engineering-spec-analyst`), `README_VI.md` (dòng tương ứng)
- Modify: `test/validate.mjs` (khối 30a-2, ngay sau 30a-1)

**Interfaces:**
- Consumes: cụm "task `<ID>` trong `tasks.md`" mà 3 skill ở Task 1 đã nhận.
- Produces: đoạn `## Bản chất plugin` mới trong `principles.md` — Task 4 sẽ thay đúng 2 dòng cuối của đoạn này (bắt đầu `Mỗi skill là **recipe docs-only**`).

- [ ] **Step 1: Viết test đỏ (khối 30a-2)**

```js
// ─────────────────────────────────────────────────────────────────────────────
// 30a-2. SOURCE: workflow-feature + agent + principles nối engineering-task-breakdown (spec 2026-10-07 integration §2.5–§2.7)
// ─────────────────────────────────────────────────────────────────────────────
{
  const wf = fs.readFileSync(path.join(REPO_ROOT, 'workflows', 'feature', 'WORKFLOW.md'), 'utf8');
  const step = (n) => wf.split(/^### Bước /m).find((s) => s.startsWith(`${n} `)) || '';
  ok(step(2).includes('engineering-task-breakdown') && step(2).includes('`tasks.md`'),
    'workflow-feature: Bước 2 tuỳ chọn tách task bằng engineering-task-breakdown');
  ok(!wf.includes('không phân rã story/task chi tiết'), 'workflow-feature: bỏ câu cấm phân rã task');
  ok(step(4).includes('`tasks.md`') && step(4).includes('`FE-INT` → `frontend-data-integrator`'),
    'workflow-feature: Bước 4 giao implementer theo từng task');
  ok(/^### Bước 8 — Commit ⏸$/m.test(wf), 'workflow-feature: không đánh số lại bước');
  const ag = fs.readFileSync(path.join(PLUGINS_DIR, 'engineering', 'agents', 'engineering-spec-analyst.md'), 'utf8');
  ok(/^skills: "engineering-spec-writing,engineering-adr,engineering-diagram,engineering-task-breakdown"$/m.test(ag),
    'engineering-spec-analyst: skills có engineering-task-breakdown');
  ok(!ag.includes('phân rã story/task chi') && ag.includes('Checkpoint 2'),
    'engineering-spec-analyst: tách task khi được yêu cầu, dừng ở 2 checkpoint');
  const pr = fs.readFileSync(path.join(PLUGINS_DIR, 'engineering', 'shared', 'principles.md'), 'utf8');
  ok(['quality-gate', 'spec-writing', 'task-breakdown', 'diagram', 'adr', 'convention-enforce', 'release-notes']
    .every((s) => pr.includes(`\`${s}\``)), 'engineering principles: nêu đủ 7 skill');
  for (const f of ['README.md', 'README_VI.md']) {
    ok(/^\| `engineering-spec-analyst` \|.*engineering-task-breakdown/m.test(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')),
      `${f}: bảng agent nêu engineering-task-breakdown cho engineering-spec-analyst`);
  }
}

```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `node test/validate.mjs`
Expected: FAIL 8 assert của khối 30a-2 (`không đánh số lại bước` PASS sẵn → tổng 8 đỏ / 9).

- [ ] **Step 3: Sửa `workflows/feature/WORKFLOW.md` — Bước 2**

Đọc file trước. Trong `### Bước 2 — Phân tích yêu cầu & phạm vi ⏸`:

(a) Trường **Hành động**: thay cụm cuối `chứng minh được ở tầng unit/integration (bảng luồng → AC → lý do).` bằng (giữ thụt 2 dấu cách ở dòng tiếp):

```markdown
  chứng minh được ở tầng unit/integration (bảng luồng → AC → lý do). Ở checkpoint, hỏi người dùng có tách task
  không (gợi ý có khi phạm vi `fullstack` hoặc ≥ 2 use case); có → `engineering-spec-analyst` chạy skill
  `engineering-task-breakdown`, sinh `tasks.md` cùng thư mục `requirement.md`.
```

(b) Trường **Ràng buộc**: thay `định]\`; không phân rã story/task chi tiết.` bằng `định]\`; chỉ phân rã task khi người dùng chọn ở checkpoint.`

(c) Trường **Đầu ra**: thay `+ bảng ứng viên e2e (nếu có).` bằng `+ bảng ứng viên e2e (nếu có); \`tasks.md\` nếu người dùng chọn tách task.`

(d) Trường **Gate**: thay `có FE thì có bảng ứng viên e2e hoặc ghi "không có e2e".` bằng `có FE thì có bảng ứng viên e2e hoặc ghi "không có e2e"; có \`tasks.md\` thì đạt checklist của \`engineering-task-breakdown\`.`

(e) Trường **Evidence**: thay `- **Evidence:** đường dẫn \`requirement.md\` + trích đoạn acceptance criteria.` bằng `- **Evidence:** đường dẫn \`requirement.md\` + trích đoạn acceptance criteria; có \`tasks.md\` thì đường dẫn + kết quả checklist.`

Nếu dòng nào bị ngắt khác với chuỗi trên, sửa theo nghĩa tương đương, giữ thụt lề 2 dấu cách và mỗi trường vẫn là MỘT bullet `- **<Trường>:**`.

- [ ] **Step 4: Sửa `workflows/feature/WORKFLOW.md` — Bước 4**

Trong `### Bước 4 — Implement`:

(a) Trường **Đầu vào**: `- **Đầu vào:** \`requirement.md\` + contract (nếu có) từ Bước 2–3` → `- **Đầu vào:** \`requirement.md\` + contract (nếu có) + \`tasks.md\` (nếu có) từ Bước 2–3`

(b) Trường **Hành động**: sau cụm cuối `chạy build của từng phía.` thêm (cùng bullet, thụt 2 dấu cách):

```markdown
  Có `tasks.md` từ Bước 2 → giao từng task theo thứ tự phụ thuộc (nhóm song song chạy song song): `BE` →
  `backend-implementer`, `FE-UI` → `frontend-implementer`, `FE-INT` → `frontend-data-integrator`; mỗi agent nhận
  "task `<ID>` trong `tasks.md`", task xong thì session chính cập nhật cột Trạng thái. Không có `tasks.md` → giữ
  luồng trên.
```

- [ ] **Step 5: Sửa agent `engineering-spec-analyst.md`**

- Frontmatter `description`: thay `theo template của skill engineering-adr. Chỉ ghi trong docs/.` bằng `theo template của skill engineering-adr, và phân rã task BE/FE theo skill engineering-task-breakdown khi được yêu cầu. Chỉ ghi trong docs/.`
- Frontmatter: `skills: "engineering-spec-writing,engineering-adr,engineering-diagram"` → `skills: "engineering-spec-writing,engineering-adr,engineering-diagram,engineering-task-breakdown"`
- `## Vai trò`: thay `(không phân rã story)` bằng `(phân rã task chỉ khi được yêu cầu, theo \`engineering-task-breakdown\`)`.
- `## Phạm vi`, dòng "Được": thay `(requirement.md + plan.md)` bằng `(requirement.md + plan.md; \`tasks.md\` + \`tasks.csv\`/\`tasks.xlsx\` khi được yêu cầu tách task)`.
- Dòng "Không được": thay cụm `phân rã story/task chi` + xuống dòng + `  tiết;` bằng `phân rã task khi người dùng` + xuống dòng + `  chưa yêu cầu;`.
- `## Quy trình`: chèn bước mới trước bước 6 hiện tại và đánh số lại bước 6 cũ thành 7:

```markdown
6. Được yêu cầu tách task: đọc skill `engineering-task-breakdown`, chạy bước 0–6 của skill, dừng ở Checkpoint 1 và
   Checkpoint 2 chờ người duyệt; ghi `tasks.md` cùng thư mục `requirement.md`.
7. Chạy checklist Definition of Done của các skill đã dùng trước khi báo hoàn thành; nêu rõ phần còn thiếu.
```

  (bước 7 thay thế dòng `6. Chạy checklist Definition of Done của cả ba skill trước khi báo hoàn thành; nêu rõ phần còn thiếu.`)
- `## Report trả về`, bullet đầu: thay `(\`requirement.md\`, \`plan.md\`, ADR, diagram nếu có)` bằng `(\`requirement.md\`, \`plan.md\`, \`tasks.md\`, ADR, diagram nếu có)`.

- [ ] **Step 6: Sửa `plugins/engineering/shared/principles.md`**

Thay toàn bộ đoạn dưới heading `## Bản chất plugin` (4 dòng, từ `Đây là các capability` tới `KHÔNG đụng CLI/adapter/engine.`) bằng:

```markdown
Đây là các capability **opt-in, xuyên suốt (cross-cutting)** — KHÔNG thuộc pipeline bắt buộc của
plugin nào, KHÔNG có thứ tự chạy ép buộc. Gọi từng skill khi cần: `quality-gate` (chất lượng +
bảo mật), `spec-writing` (khảo sát + đặc tả), `task-breakdown` (phân rã yêu cầu thành task BE/FE),
`diagram` (sinh PlantUML), `adr` (ghi quyết định kiến trúc), `convention-enforce` (kiểm quy ước),
`release-notes` (changelog + release notes).
Mỗi skill là **recipe docs-only** — hướng dẫn cách agent hành động, KHÔNG sinh code chạy được và KHÔNG
đụng CLI/adapter/engine.
```

Trong `## Ranh giới đặc thù`, thay `duyệt **spec** (spec-writing), xác nhận` bằng `duyệt **spec** (spec-writing), duyệt **use case + bảng task** (task-breakdown), xác nhận`.

- [ ] **Step 7: Sửa README**

`README.md`, dòng bắt đầu `| \`engineering-spec-analyst\` |`: cột skill `engineering-spec-writing, engineering-adr, engineering-diagram` → `engineering-spec-writing, engineering-adr, engineering-diagram, engineering-task-breakdown`. Làm y hệt cho dòng tương ứng trong `README_VI.md`. Không đổi cột khác.

- [ ] **Step 8: Chạy test, xác nhận xanh**

Run: `npm run build && npm test`
Expected: exit 0; `node test/validate.mjs` báo `0 fail` (gồm khối 27 `workflow-feature: đủ dòng neo khung`, Registry ↔ description, khối 26 description agent/skill).

- [ ] **Step 9: Commit qua `core:git-workflow`**

Stage đúng 6 file: `workflows/feature/WORKFLOW.md`, agent, `principles.md`, `README.md`, `README_VI.md`, `test/validate.mjs`. Message:

```
feat(workflow): offer task breakdown in workflow-feature

Changed:
- workflow-feature Bước 2 hỏi tách task ở checkpoint (gợi ý khi fullstack hoặc ≥ 2 use case) và sinh tasks.md; Bước 4 giao implementer theo từng task, không đánh số lại bước
- Agent engineering-spec-analyst thêm skill engineering-task-breakdown, chỉ tách task khi được yêu cầu và dừng ở 2 checkpoint
- Principles engineering liệt kê đủ 7 skill; README/README_VI cập nhật bảng agent
- Thêm khối assert 30a-2 trong test/validate.mjs

Reason:
- Workflow và agent đang cấm phân rã task nên tasks.md không được dùng trong luồng feature
```

---

### Task 3: Script `check-tasks.mjs` + test

**Files:**
- Create: `plugins/engineering/skills/engineering-task-breakdown/scripts/check-tasks.mjs`
- Modify: `test/validate.mjs` (thêm `import os from 'node:os';` ngay sau dòng `import path from 'node:path';`; khối 30b sau 30a-2)

**Interfaces:**
- Consumes: định dạng `tasks.md` theo `references/output-formats.md` §3 + `task-template-common.md` §2–§3.
- Produces: `parseTasks(text) → model`, `checkTasks(model) → { errors: [{code, line, msg}], warnings: [...] }`, `toCsv(model) → string`, `CSV_COLS`; CLI `node check-tasks.mjs <tasks.md> [--csv <out.csv>]` in `"<tên file>:<dòng>: [<mã>] <thông điệp>"` rồi dòng `"<n> lỗi, <m> cảnh báo, <k> task"`. Task 4 tài liệu hoá đúng lệnh này.

- [ ] **Step 1: Viết test đỏ (khối 30b)**

Thêm import (đầu file, sau `import path from 'node:path';`):

```js
import os from 'node:os';
```

Khối:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 30b. SOURCE: engineering-task-breakdown scripts/check-tasks.mjs (spec 2026-10-07 integration §3, §4.2)
// ─────────────────────────────────────────────────────────────────────────────
{
  const TB_SCRIPT = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-task-breakdown', 'scripts', 'check-tasks.mjs');
  const exists = fs.existsSync(TB_SCRIPT);
  ok(exists, 'check-tasks: có scripts/check-tasks.mjs');
  if (exists) {
    const tb = await import(pathToFileURL(TB_SCRIPT).href);
    const items = (p, n) => Array.from({ length: n }, (_, i) => `- **${p}${i + 1}. Mục:** x`).join('\n');
    const FX = [
      '# Tasks: Mẫu', '', '## 2. Use case', '',
      '| ID | Tên | Actor | Mục tiêu | AC | NFR | Nguồn |', '|---|---|---|---|---|---|---|',
      '| UC01 | Đăng ký | Khách | Tạo tài khoản | AC1.1 Given email mới When gửi Then tạo<br>AC1.2 Given email trùng When gửi Then báo lỗi | p95 ≤ 500 ms | requirement.md §1 |',
      '', '## 3. Bảng tổng task', '',
      '| ID | UC | Loại | Tiêu đề | Size | Phụ thuộc | Owner | Trạng thái | Skill gợi ý |', '|---|---|---|---|---|---|---|---|---|',
      '| [UC01-CT-01](#uc01-ct-01) | UC01 | CT | Chốt contract "đăng ký" | S | — |  | Todo | backend-api-contract |',
      '| [UC01-BE-01](#uc01-be-01) | UC01 | BE | Tạo tài khoản | M | UC01-CT-01 |  | Todo | backend-implement |',
      '| [UC01-FE-01](#uc01-fe-01) | UC01 | FE-UI | Dựng form | S | — |  | Todo | frontend-implement |',
      '| [UC01-FE-02](#uc01-fe-02) | UC01 | FE-INT | Nối form | S | UC01-CT-01, UC01-FE-01 |  | Todo | frontend-data-integration |',
      '', '## 5. Chi tiết task', '',
      '<a id="uc01-ct-01"></a>', '### UC01-CT-01 — Chốt contract "đăng ký"', '',
      '- [ ] AC1.1 — contract có POST /accounts', '- [ ] AC1.2 — contract có lỗi 409', '',
      '<a id="uc01-be-01"></a>', '### UC01-BE-01 — Tạo tài khoản', '',
      '- [ ] AC1.1 — tạo tài khoản', '- [ ] AC1.2 — email trùng trả 409', '', '#### Backend', '', items('B', 10), '',
      '<a id="uc01-fe-01"></a>', '', '### UC01-FE-01 — Dựng form', '',
      '- [x] AC1.1 — form hiển thị', '', '#### Frontend', '', items('F', 9), '',
      '<a id="uc01-fe-02"></a>', '### UC01-FE-02 — Nối form', '',
      '- [ ] AC1.2 — hiện lỗi 409', '', '#### Frontend', '', items('F', 9), '',
      '## 6. Câu hỏi mở & giả định', '',
    ].join('\n');
    const check = (text) => tb.checkTasks(tb.parseTasks(text));
    const codes = (text) => { const r = check(text); return [...r.errors, ...r.warnings].map((p) => p.code); };
    const r0 = check(FX);
    ok(r0.errors.length === 0 && r0.warnings.length === 0,
      `check-tasks: fixture hợp lệ → 0 lỗi, 0 cảnh báo (${[...r0.errors, ...r0.warnings].map((p) => p.code + ' ' + p.msg).join(' | ')})`);
    const cases = [
      ['E1', '| UC01 | BE | Tạo tài khoản |', '| UC01 | FE-UI | Tạo tài khoản |'],
      ['E2', '| [UC01-FE-02](#uc01-fe-02) |', '| [UC01-FE-01](#uc01-fe-01) |'],
      ['E3', '<a id="uc01-be-01"></a>', '<a id="uc01-be-1"></a>'],
      ['E4', '| M | UC01-CT-01 |', '| M | UC01-CT-09 |'],
      ['E5', '| S | — |  | Todo | backend-api-contract |', '| S | UC01-FE-02 |  | Todo | backend-api-contract |'],
      ['E6', '| M | UC01-CT-01 |', '| L | UC01-CT-01 |'],
      ['E7', '<br>AC1.2 Given', '<br>AC1.3 Given x<br>AC1.2 Given'],
      ['E8', '- [ ] AC1.2 — contract có lỗi 409', '- [ ] AC1.9 — contract có lỗi 409'],
      ['E8', '- [ ] AC1.2 — hiện lỗi 409\n', ''],
      ['E9', '- **B7. Mục:** x\n', ''],
      ['E9', '| Tạo tài khoản | M |', '|  | M |'],
      ['W1', '| M | UC01-CT-01 |', '| M | — |'],
      ['W2', '| S | — |  | Todo | frontend-implement |', '| S | UC01-CT-01 |  | Todo | frontend-implement |'],
    ];
    for (const [code, from, to] of cases) {
      ok(FX.includes(from) && codes(FX.replace(from, to)).includes(code), `check-tasks: biến thể ${code} (${from.trim()}) bị bắt`);
    }
    ok(check(FX.replace('| M | UC01-CT-01 |', '| M | — |')).errors.length === 0, 'check-tasks: W1 chỉ là cảnh báo, không thành lỗi');
    ok(check(FX.replace(/\n/g, '\r\n')).errors.length === 0, 'check-tasks: tasks.md CRLF → 0 lỗi');
    ok(check('﻿' + FX).errors.length === 0, 'check-tasks: tasks.md có BOM → 0 lỗi');
    const linked = check(FX.replace('| M | UC01-CT-01 |', '| M | [UC01-CT-01](#uc01-ct-01) |'));
    ok(linked.errors.length === 0 && linked.warnings.length === 0, 'check-tasks: Phụ thuộc dạng link markdown được nhận');
    let noDetail = null;
    try { noDetail = check(FX.replace('## 5. Chi tiết task', '## 5. Ghi chú')); } catch { noDetail = null; }
    ok(!!noDetail && noDetail.errors.some((p) => p.code === 'E3'), 'check-tasks: thiếu mục Chi tiết task → E3, không ném lỗi');
    const csv = tb.toCsv(tb.parseTasks(FX));
    const recs = csv.slice(1).split('\r\n').filter(Boolean);
    ok(csv.startsWith('﻿') && csv.endsWith('\r\n') && recs.length === 5, 'check-tasks: CSV có BOM, 1 header + 4 task, kết thúc CRLF');
    ok(recs[0] === tb.CSV_COLS.map((c) => `"${c}"`).join(',') && tb.CSV_COLS.length === 11, 'check-tasks: CSV header đủ 11 cột');
    ok(recs[1].startsWith('"UC01-CT-01","UC01","CT","Chốt contract ""đăng ký""","S","—",""'),
      'check-tasks: CSV ID trần, ngoặc kép nhân đôi, Phụ thuộc rỗng = —');
    ok(recs[2].includes('"AC1.1 — tạo tài khoản\nAC1.2 — email trùng trả 409"') && recs[2].endsWith('"tasks.md#uc01-be-01"'),
      'check-tasks: CSV ô AC nhiều dòng trong ngoặc kép, link chi tiết theo anchor');
    const src = fs.readFileSync(TB_SCRIPT, 'utf8');
    ok(!/from\s+['"](?!node:)/.test(src) && !/require\(/.test(src), 'check-tasks: chỉ import node:*');
    ok(src.includes('realpathSync'), 'check-tasks: guard CLI so sánh qua realpath (chạy được qua junction/symlink)');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-tasks-'));
    const run = (...args) => {
      try {
        return { code: 0, out: execFileSync(process.execPath, [TB_SCRIPT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
      } catch (e) { return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` }; }
    };
    try {
      const good = path.join(tmp, 'tasks.md');
      fs.writeFileSync(good, '﻿' + FX.replace(/\n/g, '\r\n'));
      const bad = path.join(tmp, 'bad.md');
      fs.writeFileSync(bad, FX.replace('| M | UC01-CT-01 |', '| M | UC01-CT-09 |'));
      const okCsv = path.join(tmp, 'ok.csv');
      const badCsv = path.join(tmp, 'bad.csv');
      const r1 = run(good, '--csv', okCsv);
      ok(r1.code === 0 && r1.out.includes('0 lỗi, 0 cảnh báo, 4 task') && fs.existsSync(okCsv),
        `check-tasks CLI: hợp lệ → exit 0, ghi CSV (${r1.code}: ${r1.out.trim()})`);
      const r2 = run(bad, '--csv', badCsv);
      ok(r2.code === 1 && /bad\.md:\d+: \[E4\] UC01-BE-01 phụ thuộc UC01-CT-09 không tồn tại/.test(r2.out) && !fs.existsSync(badCsv),
        `check-tasks CLI: có lỗi → exit 1, báo dòng, không ghi CSV (${r2.code}: ${r2.out.trim()})`);
      ok(run().code === 2 && run(path.join(tmp, 'khong-co.md')).code === 2, 'check-tasks CLI: thiếu tham số / không đọc được file → exit 2');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}

```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `node test/validate.mjs`
Expected: FAIL đúng 1 assert `check-tasks: có scripts/check-tasks.mjs` (các assert còn lại nằm trong `if (exists)` nên chưa chạy).

- [ ] **Step 3: Tạo `scripts/check-tasks.mjs`**

```js
#!/usr/bin/env node
// Kiểm tasks.md do skill engineering-task-breakdown sinh và xuất CSV cho Excel.
// Chỉ dùng built-in của Node để chạy được ở project đích mà không cài thêm gì.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ID_RE = /^UC\d{2}-(CT|DB|BE|FE|E2E)-\d{2}$/;
const PREFIX_TYPES = { CT: ['CT'], DB: ['DB'], BE: ['BE'], FE: ['FE-UI', 'FE-INT'], E2E: ['E2E'] };
const SUMMARY_COLS = ['ID', 'UC', 'Loại', 'Tiêu đề', 'Size', 'Phụ thuộc', 'Owner', 'Trạng thái', 'Skill gợi ý'];
export const CSV_COLS = [...SUMMARY_COLS, 'AC', 'Link chi tiết'];
const AC_RE = /AC\d+\.\d+/g;
const NO_DEP = new Set(['', '—', '-']);
// Phụ thuộc tối thiểu theo SKILL.md bước 3; chỉ cảnh báo vì bảng chuẩn cho phép thêm phụ thuộc có lý do.
const MIN_DEPS = { BE: ['CT', 'DB'], 'FE-INT': ['CT', 'FE-UI'], E2E: ['BE', 'FE-INT'] };

const cellsOf = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const linkText = (cell) => {
  const m = cell.match(/^\[([^\]]+)\]\([^)]*\)$/);
  return m ? m[1] : cell;
};

function sections(lines) {
  const out = [];
  lines.forEach((l, i) => {
    const m = l.match(/^## (.+)$/);
    if (m) out.push({ title: m[1].toLowerCase(), start: i + 1, end: lines.length });
  });
  for (let i = 0; i < out.length - 1; i++) out[i].end = out[i + 1].start - 1;
  return out;
}

function table(lines, sec) {
  if (!sec) return null;
  let i = sec.start;
  while (i < sec.end && !lines[i].trim().startsWith('|')) i++;
  if (i >= sec.end) return null;
  const header = cellsOf(lines[i]);
  const rows = [];
  for (let j = i + 2; j < sec.end && lines[j].trim().startsWith('|'); j++) {
    const cells = cellsOf(lines[j]);
    rows.push({ line: j + 1, get: (name) => { const k = header.indexOf(name); return k < 0 ? '' : (cells[k] ?? ''); } });
  }
  return { header, line: i + 1, rows };
}

export function parseTasks(text) {
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const secs = sections(lines);
  // Tìm mục theo tên heading thay vì số thứ tự vì agent có thể đánh số lại các mục H2.
  const find = (kw) => secs.find((s) => s.title.includes(kw));
  const ucTable = table(lines, find('use case'));
  const sumTable = table(lines, find('bảng tổng task'));
  const detSec = find('chi tiết task');
  const useCases = ucTable
    ? ucTable.rows.map((r) => ({ id: r.get('ID'), acs: r.get('AC').match(AC_RE) || [], line: r.line }))
    : [];
  const tasks = sumTable
    ? sumTable.rows.map((r) => {
      const depCell = r.get('Phụ thuộc');
      return {
        id: linkText(r.get('ID')),
        type: r.get('Loại'),
        size: r.get('Size'),
        deps: NO_DEP.has(depCell) ? [] : depCell.split(',').map((d) => linkText(d.trim())).filter(Boolean),
        cells: Object.fromEntries(SUMMARY_COLS.map((c) => [c, r.get(c)])),
        line: r.line,
      };
    })
    : [];
  const details = [];
  if (detSec) {
    let anchor = null;
    let cur = null;
    for (let i = detSec.start; i < detSec.end; i++) {
      const l = lines[i];
      const a = l.match(/^<a id="([^"]*)"><\/a>\s*$/);
      if (a) { anchor = a[1]; continue; }
      const h = l.match(/^### (\S+)\s+[—-]\s+/);
      if (h) {
        cur = { id: h[1], anchor, line: i + 1, acs: [], acTexts: [], b: new Set(), f: new Set() };
        details.push(cur);
        anchor = null;
        continue;
      }
      if (!cur) continue;
      const ac = l.match(/^\s*- \[[ xX]\] (AC\d+\.\d+.*)$/);
      if (ac) {
        cur.acs.push(ac[1].match(/^AC\d+\.\d+/)[0]);
        cur.acTexts.push(ac[1].trim());
        continue;
      }
      const item = l.match(/\*\*([BF])(\d+)\. /);
      if (item) cur[item[1].toLowerCase()].add(Number(item[2]));
    }
  }
  return {
    sections: { useCase: !!ucTable, summary: !!sumTable, detail: !!detSec },
    summaryHeader: sumTable ? sumTable.header : [],
    summaryLine: sumTable ? sumTable.line : 1,
    useCases,
    tasks,
    details,
  };
}

export function checkTasks(model) {
  const errors = [];
  const warnings = [];
  const err = (code, line, msg) => errors.push({ code, line, msg });
  const warn = (code, line, msg) => warnings.push({ code, line, msg });
  if (!model.sections.useCase) err('E7', 1, 'Thiếu mục H2 "Use case" có bảng');
  if (!model.sections.summary) err('E3', 1, 'Thiếu mục H2 "Bảng tổng task" có bảng');
  if (!model.sections.detail) err('E3', 1, 'Thiếu mục H2 "Chi tiết task"');
  const missingCols = model.sections.summary ? SUMMARY_COLS.filter((c) => !model.summaryHeader.includes(c)) : [];
  if (missingCols.length) err('E9', model.summaryLine, `Bảng tổng task thiếu cột: ${missingCols.join(', ')}`);

  const byId = new Map();
  for (const t of model.tasks) {
    const m = t.id.match(ID_RE);
    if (!m) err('E1', t.line, `ID "${t.id}" sai dạng UC<nn>-<CT|DB|BE|FE|E2E>-<nn>`);
    else if (!PREFIX_TYPES[m[1]].includes(t.type)) err('E1', t.line, `${t.id}: Loại "${t.type}" không khớp tiền tố ${m[1]}`);
    if (byId.has(t.id)) err('E2', t.line, `${t.id} trùng với dòng ${byId.get(t.id).line}`);
    else byId.set(t.id, t);
    for (const c of SUMMARY_COLS) {
      if (c !== 'Owner' && model.summaryHeader.includes(c) && !t.cells[c]) err('E9', t.line, `${t.id}: ô "${c}" trống`);
    }
    if (t.size === 'L') err('E6', t.line, `${t.id}: size L — buộc tách thành task S/M`);
    else if (t.size && !['S', 'M'].includes(t.size)) err('E6', t.line, `${t.id}: size "${t.size}" phải là S hoặc M`);
  }

  const detById = new Map();
  for (const d of model.details) {
    if (detById.has(d.id)) err('E3', d.line, `${d.id}: mục chi tiết lặp lại`);
    detById.set(d.id, d);
    if (!byId.has(d.id)) err('E3', d.line, `${d.id}: có mục chi tiết nhưng không có trong Bảng tổng task`);
    if (d.anchor !== d.id.toLowerCase()) err('E3', d.line, `${d.id}: cần <a id="${d.id.toLowerCase()}"></a> ngay trên heading`);
  }
  if (model.sections.detail) {
    for (const t of byId.values()) {
      if (!detById.has(t.id)) err('E3', t.line, `${t.id}: thiếu mục chi tiết "### ${t.id} — …"`);
    }
  }

  for (const t of byId.values()) {
    for (const d of t.deps) if (!byId.has(d)) err('E4', t.line, `${t.id} phụ thuộc ${d} không tồn tại`);
  }
  const state = new Map();
  const stack = [];
  const visit = (id) => {
    state.set(id, 1);
    stack.push(id);
    for (const d of byId.get(id).deps) {
      if (!byId.has(d)) continue;
      if (state.get(d) === 1) err('E5', byId.get(id).line, `Vòng phụ thuộc: ${[...stack.slice(stack.indexOf(d)), d].join(' → ')}`);
      else if (!state.has(d)) visit(d);
    }
    stack.pop();
    state.set(id, 2);
  };
  for (const id of byId.keys()) if (!state.has(id)) visit(id);

  const ucAcs = new Set(model.useCases.flatMap((u) => u.acs));
  const covered = new Set(model.details.flatMap((d) => d.acs));
  for (const u of model.useCases) {
    for (const a of u.acs) if (!covered.has(a)) err('E7', u.line, `${a} (${u.id}) chưa được task nào phủ`);
  }
  for (const d of model.details) {
    if (!d.acs.length) err('E8', d.line, `${d.id}: không có AC nào (dòng "- [ ] AC<uc>.<n> — …")`);
    for (const a of d.acs) if (!ucAcs.has(a)) err('E8', d.line, `${d.id}: ${a} không có trong bảng Use case`);
    const t = byId.get(d.id);
    const need = !t ? null : t.type === 'BE' ? ['b', 'B', 10] : ['FE-UI', 'FE-INT'].includes(t.type) ? ['f', 'F', 9] : null;
    if (need) {
      const miss = Array.from({ length: need[2] }, (_, i) => i + 1).filter((n) => !d[need[0]].has(n));
      if (miss.length) err('E9', d.line, `${d.id}: thiếu mục ${miss.map((n) => need[1] + n).join(', ')}`);
    }
  }

  for (const t of byId.values()) {
    const uc = t.id.slice(0, 4);
    const sameUc = [...byId.values()].filter((o) => o.id.slice(0, 4) === uc);
    for (const req of MIN_DEPS[t.type] || []) {
      const cands = sameUc.filter((o) => o.type === req);
      if (cands.length && !cands.some((o) => t.deps.includes(o.id))) {
        warn('W1', t.line, `${t.id} (${t.type}) nên phụ thuộc task ${req} của ${uc}: ${cands.map((o) => o.id).join(', ')}`);
      }
    }
    if (t.type === 'FE-UI') {
      const ct = t.deps.filter((d) => byId.get(d)?.type === 'CT');
      if (ct.length) warn('W2', t.line, `${t.id} (FE-UI) không nên chờ CT: ${ct.join(', ')}`);
    }
  }
  const byLine = (a, b) => a.line - b.line;
  return { errors: errors.sort(byLine), warnings: warnings.sort(byLine) };
}

const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function toCsv(model) {
  const det = new Map(model.details.map((d) => [d.id, d]));
  const rows = model.tasks.map((t) => [
    ...SUMMARY_COLS.map((c) => (c === 'ID' ? t.id : c === 'Phụ thuộc' ? (t.deps.join(', ') || '—') : t.cells[c])),
    (det.get(t.id)?.acTexts || []).join('\n'),
    `tasks.md#${t.id.toLowerCase()}`,
  ]);
  // BOM để Excel trên Windows đọc đúng UTF-8 (dấu tiếng Việt); CRLF theo RFC 4180.
  return '﻿' + [CSV_COLS, ...rows].map((r) => r.map(quote).join(',')).join('\r\n') + '\r\n';
}

function main(argv) {
  const usage = () => { console.error('Cách dùng: node check-tasks.mjs <tasks.md> [--csv <out.csv>]'); return 2; };
  let file = null;
  let csv = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--csv') { csv = argv[++i]; if (!csv) return usage(); }
    else if (!file) file = argv[i];
    else return usage();
  }
  if (!file) return usage();
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { console.error(`Không đọc được ${file}: ${e.message}`); return 2; }
  const model = parseTasks(text);
  const { errors, warnings } = checkTasks(model);
  const name = path.basename(file);
  for (const p of [...errors, ...warnings]) console.log(`${name}:${p.line}: [${p.code}] ${p.msg}`);
  console.log(`${errors.length} lỗi, ${warnings.length} cảnh báo, ${model.tasks.length} task`);
  if (errors.length) {
    if (csv) console.log('Không ghi CSV vì còn lỗi.');
    return 1;
  }
  if (csv) { fs.writeFileSync(csv, toCsv(model)); console.log(`Đã ghi ${csv}`); }
  return 0;
}

// realpath vì trên Windows skill được cài qua junction: argv[1] là đường dẫn junction còn import.meta.url là đường dẫn thật.
const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
```

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `node test/validate.mjs`
Expected: `0 fail`; mọi assert `check-tasks:` / `check-tasks CLI:` PASS. Nếu một biến thể không bắt được mã, in `codes(...)` của biến thể đó để chẩn đoán — sửa script, KHÔNG sửa fixture/test trừ khi test sai so với spec §3.3 (khi đó báo lại trong report).

- [ ] **Step 5: Chạy toàn bộ**

Run: `npm run build && npm test`
Expected: exit 0. Kiểm build có script: `ls build/claude/plugins/engineering/skills/engineering-task-breakdown/scripts/check-tasks.mjs`.

- [ ] **Step 6: Commit qua `core:git-workflow`**

Stage đúng 2 file: `check-tasks.mjs` + `test/validate.mjs`. Message:

```
feat(engineering): add check-tasks script for tasks.md

Changed:
- Thêm scripts/check-tasks.mjs (Node built-in): parse tasks.md theo tên mục, kiểm E1–E9 (ID, trùng, anchor, phụ thuộc, vòng, size L, phủ AC, AC lạ, mục trống/B1–B10/F1–F9) và cảnh báo W1–W2
  • Báo theo dòng, exit 0/1/2; --csv ghi CSV UTF-8 có BOM chỉ khi 0 lỗi
  • Nhận CRLF, BOM, Phụ thuộc dạng link; guard CLI qua realpath để chạy được qua junction
- Thêm khối assert 30b trong test/validate.mjs (fixture hợp lệ, 13 biến thể lỗi/cảnh báo, CSV, CLI)

Reason:
- Kiểm tasks.md bằng đọc dễ sót khi nhiều task; CSV không còn phụ thuộc Python
```

---

### Task 4: Tài liệu skill dùng script, nguyên tắc plugin, manifest 1.4.0

**Files:**
- Modify: `plugins/engineering/skills/engineering-task-breakdown/SKILL.md` (bước 5, 6, Verification, Bản đồ tài liệu)
- Modify: `plugins/engineering/skills/engineering-task-breakdown/references/output-formats.md` (§4)
- Modify: `plugins/engineering/skills/engineering-task-breakdown/references/breakdown-checklist.md`
- Modify: `plugins/engineering/shared/principles.md` (2 dòng cuối `## Bản chất plugin` do Task 2 viết)
- Modify: `plugins/engineering/.manifest.json`
- Modify: `test/validate.mjs` (assert khối 29d đổi `1.3.0` → `1.4.0`; khối 30c sau 30b)

**Interfaces:**
- Consumes: CLI `node <skill-dir>/scripts/check-tasks.mjs <tasks.md> [--csv <out.csv>]` + mã E1–E9/W1–W2 từ Task 3; đoạn `## Bản chất plugin` từ Task 2.
- Produces: không có.

- [ ] **Step 1: Viết test đỏ (khối 30c + sửa 29d)**

Trong khối 29d, dòng assert manifest: đổi `mf.version === '1.3.0'` thành `mf.version === '1.4.0'` và message `'engineering manifest: 7 skill, có engineering-task-breakdown, version 1.3.0'` thành `'engineering manifest: 7 skill, có engineering-task-breakdown, version 1.4.0'`.

Khối mới:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 30c. SOURCE: tài liệu engineering-task-breakdown dùng check-tasks.mjs + nguyên tắc script (spec 2026-10-07 integration §3.5–§3.7)
// ─────────────────────────────────────────────────────────────────────────────
{
  const TB = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-task-breakdown');
  const rd = (rel) => fs.readFileSync(path.join(TB, rel), 'utf8');
  const skill = rd('SKILL.md');
  ok(skill.includes('(scripts/check-tasks.mjs)') && skill.includes('check-tasks.mjs <đường dẫn tasks.md>'),
    'engineering-task-breakdown: SKILL.md bước 5 chạy check-tasks.mjs và link tới script');
  ok(skill.includes('không có Node → kiểm cả checklist thủ công'), 'engineering-task-breakdown: không có Node → checklist thủ công');
  const out = rd('references/output-formats.md');
  ok(out.includes('check-tasks.mjs <tasks.md> --csv'), 'output-formats: CSV qua check-tasks.mjs --csv');
  const cl = rd('references/breakdown-checklist.md');
  ok(['**(script E7)**', '**(script E1, E2)**', '**(script E4, E5)**', '**(script E6)**', '**(script W1, W2)**'].every((s) => cl.includes(s)),
    'breakdown-checklist: đánh dấu mục script kiểm tự động');
  const pr = fs.readFileSync(path.join(PLUGINS_DIR, 'engineering', 'shared', 'principles.md'), 'utf8');
  ok(pr.includes('chỉ khi thoả cả 3 điều kiện') && pr.includes('check-tasks.mjs') && !pr.includes('KHÔNG sinh code chạy được'),
    'engineering principles: cho phép script tất định với 3 điều kiện');
  const mf30 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, 'engineering', '.manifest.json'), 'utf8'));
  ok(mf30.description.includes('check-tasks.mjs'), 'engineering manifest: description nêu check-tasks.mjs');
  for (const [p, rel] of [
    ['claude', 'claude/plugins/engineering/skills/engineering-task-breakdown'],
    ['codex', 'codex/engineering/skills/engineering-task-breakdown'],
    ['cursor', 'cursor/engineering/.cursor/skills/engineering-task-breakdown'],
    ['antigravity', 'antigravity/engineering/docs/workflow/engineering-task-breakdown'],
  ]) {
    if (fs.existsSync(path.join(REPO_ROOT, 'build', p))) {
      ok(fs.existsSync(path.join(REPO_ROOT, 'build', rel, 'scripts', 'check-tasks.mjs')), `build ${p}: ship scripts/check-tasks.mjs`);
    }
  }
}

```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npm run build && node test/validate.mjs`
Expected: FAIL assert 29d (version 1.4.0) + 6 assert đầu của 30c; 4 assert build PASS sẵn (Task 3 đã ship script).

- [ ] **Step 3: Sửa `SKILL.md` bước 5 và 6**

Thay toàn bộ bước 5 (từ dòng `5. **Kiểm tra. ⏸ Checkpoint 2**` tới hết câu `Câu hỏi mở phát sinh ở bước 3–5 trình cùng Checkpoint 2.`) và bước 6 (từ `6. **Xuất file.**` tới hết `` `tasks.md`. `` trước `## Verification`) bằng:

```markdown
5. **Kiểm tra. ⏸ Checkpoint 2**
   Ghi bản nháp `docs/requests/<yyyy-mm-dd>-<slug>/tasks.md` theo
   [references/output-formats.md](references/output-formats.md) §2–§3 (đã tồn tại → hỏi trước). Có Node → chạy
   `node <thư mục skill>/scripts/check-tasks.mjs <đường dẫn tasks.md>` ([scripts/check-tasks.mjs](scripts/check-tasks.mjs));
   exit 1 → sửa `tasks.md` theo từng dòng lỗi rồi chạy lại tới khi 0 lỗi; cảnh báo W* → sửa hoặc nêu lý do ở Ngữ
   cảnh. Rồi chạy [references/breakdown-checklist.md](references/breakdown-checklist.md) cho các mục script không kiểm
   (không có Node → kiểm cả checklist thủ công). Nêu rõ phần còn thiếu (fail-loud); trình bảng tổng task cho
   teamlead duyệt. Câu hỏi mở phát sinh ở bước 3–5 trình cùng Checkpoint 2.

6. **Xuất file.**
   Hỏi định dạng (nếu chưa nói): `md` (mặc định) hoặc `md + excel`. `tasks.md` đã ghi ở bước 5; chọn excel →
   `tasks.xlsx` hoặc `tasks.csv` theo [references/output-formats.md](references/output-formats.md) §4 (CSV ưu tiên
   `check-tasks.mjs --csv`). `plan.md` đã có → chỉ thêm 1 dòng link tới `tasks.md`.
```

Trong `## Verification (trước khi báo hoàn thành)`, thêm bullet sau bullet "Mọi AC của use case được phủ…":

```markdown
- `check-tasks.mjs` báo 0 lỗi (hoặc ghi rõ không có Node và đã kiểm checklist thủ công).
```

Trong `## Bản đồ tài liệu`, thêm dòng cuối:

```markdown
- [scripts/check-tasks.mjs](scripts/check-tasks.mjs): kiểm `tasks.md` (lỗi E1–E9, cảnh báo W1–W2) + xuất CSV UTF-8 có
  BOM; Node ≥ 20, không phụ thuộc ngoài.
```

- [ ] **Step 4: Sửa `references/output-formats.md` §4**

(a) Trong `### Chọn .xlsx hay CSV`, thay toàn bộ item 2 (bắt đầu `2. Không có → sinh \`tasks.csv\``) bằng:

```markdown
2. Không có → sinh `tasks.csv` (chỉ sheet `Tasks`) bằng
   `node <thư mục skill>/scripts/check-tasks.mjs <tasks.md> --csv <thư mục>/tasks.csv` (chỉ ghi khi 0 lỗi); không có
   Node → dùng `write_tasks_csv` ở mẫu Python bên dưới. Cả hai trường hợp **báo rõ** đã fallback CSV vì môi trường
   không có công cụ tạo xlsx. Không tự cài package vào môi trường người dùng khi chưa hỏi.
```

(b) Trong `### Quy tắc CSV`, bullet đầu: thay `(Python: \`encoding="utf-8-sig"\`)` bằng `(\`check-tasks.mjs\` tự thêm BOM; Python: \`encoding="utf-8-sig"\`)`.

- [ ] **Step 5: Sửa `references/breakdown-checklist.md`**

Sau dòng `Chạy từng mục; mục nào chưa đạt → nêu rõ (fail-loud), không báo hoàn thành.`, thêm đoạn (cách một dòng trống):

```markdown
Mục có nhãn **(script …)** được `scripts/check-tasks.mjs` kiểm tự động khi có Node (mã lỗi/cảnh báo trong ngoặc);
mục còn lại kiểm bằng đọc. Không có Node → kiểm tất cả bằng đọc.
```

Gắn nhãn vào cuối các bullet (giữ nguyên chữ hiện có, chỉ thêm nhãn trước dấu chấm cuối nếu có):

| Bullet bắt đầu bằng | Nhãn thêm |
|---|---|
| `- [ ] Mọi AC của mọi use case được phủ` | ` **(script E7)**` |
| `- [ ] Mọi task có ≥ 1 AC truy vết` | ` **(script E8)**` |
| `- [ ] ID duy nhất, đúng dạng` | ` **(script E1, E2)**` |
| `- [ ] Không có vòng phụ thuộc` | ` **(script E4, E5)**` |
| `- [ ] Phụ thuộc có tối thiểu bảng chuẩn` | ` **(script W1, W2)**` |
| `- [ ] Không còn task size \`L\`` | ` **(script E6)**` |
| `- [ ] Task \`BE\` có đủ B1–B10` | ` **(script E9 cho BE/FE; CT/DB/E2E kiểm bằng đọc)**` |

- [ ] **Step 6: Sửa `plugins/engineering/shared/principles.md`**

Thay 2 dòng (do Task 2 viết):

```markdown
Mỗi skill là **recipe docs-only** — hướng dẫn cách agent hành động, KHÔNG sinh code chạy được và KHÔNG
đụng CLI/adapter/engine.
```

bằng:

```markdown
Mỗi skill là **recipe docs-only** — hướng dẫn cách agent hành động, KHÔNG sinh mã nguồn cho project và KHÔNG
đụng CLI/adapter/engine. Skill được kèm **script kiểm tra/xuất tất định** (vd `task-breakdown/scripts/check-tasks.mjs`)
chỉ khi thoả cả 3 điều kiện: (1) chỉ dùng built-in của runtime, không phụ thuộc ngoài; (2) chỉ đọc input và ghi
file đầu ra được chỉ định, không sửa mã nguồn project; (3) skill vẫn chạy được bằng hướng dẫn thủ công khi không có
runtime. Tiền lệ: `core:git-workflow` kèm `scripts/test-commit-message-encoding.ps1`.
```

- [ ] **Step 7: Sửa `plugins/engineering/.manifest.json`**

- `"version": "1.3.0"` → `"version": "1.4.0"`.
- Trong `description`, thay `engineering-task-breakdown (phân rã yêu cầu/use case/ARD thành task BE/FE giao được cho dev và agent, xuất tasks.md + Excel tuỳ chọn), ` bằng `engineering-task-breakdown (phân rã yêu cầu/use case/ARD thành task BE/FE giao được cho dev và agent, kiểm tasks.md bằng script check-tasks.mjs, xuất tasks.md + Excel tuỳ chọn), `.

- [ ] **Step 8: Chạy toàn bộ verification**

```bash
npm run build
npm test
npm run overlap
npm run pack:verify
```

Expected: build exit 0; `npm test` exit 0 với validate `0 fail`; overlap exit 0 (advisory, ghi lại cặp nào có `engineering-task-breakdown`); pack:verify pass.

- [ ] **Step 9: Commit qua `core:git-workflow`**

Stage đúng 6 file: `SKILL.md`, `output-formats.md`, `breakdown-checklist.md`, `principles.md`, `.manifest.json`, `test/validate.mjs`. Message:

```
feat(engineering): use check-tasks in task-breakdown flow

Changed:
- SKILL.md bước 5 ghi nháp tasks.md rồi chạy check-tasks.mjs tới khi 0 lỗi, không có Node thì kiểm checklist thủ công; bước 6 xuất CSV qua --csv
- output-formats ưu tiên check-tasks.mjs --csv, giữ mẫu Python cho xlsx và cho máy không có Node; breakdown-checklist đánh dấu mục script kiểm
- Principles engineering cho phép script kiểm tra/xuất tất định với 3 điều kiện (built-in, chỉ ghi đầu ra chỉ định, có đường thủ công)
- Manifest engineering 1.4.0; thêm khối assert 30c, cập nhật assert version ở khối 29d

Reason:
- Hoàn tất phase 2 spec 2026-10-07 integration: skill dùng script tất định thay vì kiểm bằng đọc
```
