# Spec follow-ups — S7 + publish frontend e2e/data-integration + WF4/WF5/WF6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trỏ `frontend-testing` sang `frontend-e2e-testing` (S7), publish `frontend-data-integration` + `frontend-e2e-testing` không chờ pilot, rồi nối agent `frontend-data-integrator` / `frontend-e2e-test-writer` vào `workflow-api` (Bước 6), `workflow-feature` (Bước 2, 4, 5) và `workflow-testing` (Bước 4, 5).

**Architecture:** Nội dung canonical ở `plugins/frontend/…` và `workflows/<slug>/WORKFLOW.md`; hợp đồng được `test/validate.mjs` kiểm bằng assert chuỗi/regex. Wizard ẩn workflow có closure (skill của agent trong `agents:`) chưa publish (`cli/lib/install.mjs:355`) → thứ tự bắt buộc: **publish → nối workflow**. Assert mới gom vào khối `// 19.` ở cuối `test/validate.mjs` (khối 18 là của đợt fixer, không đụng).

**Tech Stack:** Node.js 20+, ESM, zero dependency. `node test/validate.mjs`, `npm test`, `npm run build`.

**Spec:** [`docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md`](../specs/2026-09-29-skill-plugin-workflow-upgrade-design.md) — §3.3 S7, §5.3 WF4/WF5/WF6, §7.2 (e2e), §7.3.7 (pha publish data-integration), §8.1–§8.3 (agent), §13.2 (việc còn lại). Quyết định đã duyệt trong chat 2026-09-30: publish không chờ pilot (áp lại ruling F-Q3 của spec `2026-09-30-fixer-agent-design.md`); không đánh số lại bước; "Bước 3b" của WF5 gộp vào Bước 4; spec ghi WF4 "Bước 5" là số bước trước WF11 — nay là **Bước 6 FE client**.

## Global Constraints

- Node.js `>=20`; zero runtime dependency.
- File UTF-8 **không BOM**, LF. Nội dung tiếng Việt có dấu; code identifier / frontmatter key tiếng Anh. Giữ wrap ~110 cột như file xung quanh.
- **Không đánh số lại bước:** `workflow-api` 8 bước, `workflow-feature` 8 bước, `workflow-testing` 7 bước. Giữ mọi `⏸`.
- Mọi `agent \`x\`` trong bước phải có `x` trong frontmatter `agents:` (`test/validate.mjs:314-315`).
- Chỉ sửa đúng file mỗi task liệt kê. Không đụng khối `// 18.` của `test/validate.mjs`.
- Mỗi task = 1 commit qua `core:git-workflow`: header tiếng Anh `type(scope): summary`, body tiếng Việt (Changed/Reason), ghi message ra file UTF-8 rồi `git commit -F`. **Không `Co-Authored-By`.** Không push.
- Nhánh: `feature/spec-followups` (đã cắt từ `master` = `909f1b9`).
- Dọn sandbox bằng Node `fs.rmSync`, không `rm -rf` (junction Windows).

## Review Focus

1. **Nối trước publish** → wizard ẩn `workflow-api` / `feature` / `testing` lặng lẽ. Task 2 publish trước; Task 3 thêm assert `offeredCatalog` vẫn chứa 3 workflow và kiểm có răng.
2. **Feature fullstack chạy data-integrator song song với implementer** → integrator nối vào component chưa tồn tại. Task 4 assert Bước 4 ghi rõ thứ tự "sau khi" (tuần tự), không `∥`.
3. **Gate "chỉ file test" của Bước 5 feature / Bước 4–5 testing chặn nhầm `playwright.config.*`** (không phải file test). Task 4/5 assert Gate nêu ngoại lệ `e2e/` + `playwright.config.*`.
4. **e2e chạy khi thiếu BE/DB test** → agent phải `not_run`, workflow không được coi là fail. Task 4/5 assert bước nêu `not_run` là hợp lệ.
5. **Feature đổi schema mà không qua db-change** → Task 4 assert Bước 2 có nhánh dừng + đề xuất `workflow-db-change`.

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/frontend/skills/frontend-testing/SKILL.md:68-69,121` | S7 pointer e2e | 1 |
| `test/validate.mjs` (khối `// 19.` mới, cuối file, trước dòng `// ───…` đứng trước `console.log('')`) | Assert đợt này | 1–6 |
| `plugins/_published.json`, `plugins/_cowork.json`, `plugins/frontend/.manifest.json` | Publish 2 skill | 2 |
| `plugins/frontend/shared/principles.md:14,41` | Bỏ `state-model` treo | 2 |
| `plugins/frontend/skills/frontend-implement/SKILL.md:~59,~71,~78` | Pointer sang `frontend-data-integration` | 2 |
| `test/install.test.mjs:186-206` | 2 khối draft → published, 7 → 9 | 2 |
| `test/validate.mjs:860-867`, `:919-927` | Gỡ 2 assert "chưa workflow nào dùng" | 3, 4 |
| `workflows/api/WORKFLOW.md` | Bước 6 → `frontend-data-integrator` | 3 |
| `workflows/feature/WORKFLOW.md`, `workflows/orchestrator/WORKFLOW.md:38` | Bước 2/4/5 + Nối tiếp | 4 |
| `workflows/testing/WORKFLOW.md` | Bước 4/5 e2e | 5 |
| `README.md`, `README_VI.md`, `CLAUDE.md:83`, spec 2026-09-29 | Docs | 6 |

---

### Task 1: S7 — `frontend-testing` trỏ `frontend-e2e-testing` + mở khối 19

**Files:**
- Modify: `plugins/frontend/skills/frontend-testing/SKILL.md:68-69`, `:121`
- Modify: `test/validate.mjs` (tạo khối `// 19.`)

**Interfaces:**
- Produces: khối 19 với helper `flat19`, `wf19(id)`, `step19(wf, n)`, `field19(body, name)` dùng lại ở Task 3–6.

- [ ] **Step 1: Tạo khối 19 với assert S7 (đỏ)**

Thêm vào cuối `test/validate.mjs`, ngay trước khối `// ─────…` + `console.log('')` (tức là SAU dấu `}` đóng khối 18):

```js
// ─────────────────────────────────────────────────────────────────────────────
// 19. SOURCE: S7 + publish frontend-data-integration/e2e-testing + WF4/WF5/WF6 (spec 2026-09-29 §3.3, §5.3, §7.2, §7.3.7)
{
  const flat19 = (t) => t.replace(/\s+/g, ' ');
  const wf19 = (id) => workflows.stages.find((s) => s.id === id);
  const step19 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { title: '', body: '', checkpoint: false };
  // Lấy riêng một trường của bước để assert không khớp nhầm chữ ở trường khác.
  const field19 = (body, name) => flat19(body).split(`**${name}:**`)[1]?.split(' - **')[0] ?? '';
  const ft19 = fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-testing', 'SKILL.md'), 'utf8');
  ok(flat19(ft19).includes('`frontend-e2e-testing`') && !/e2e[^.]*ngoài phạm vi recipe này\s*;/.test(flat19(ft19)),
    'frontend-testing (S7): trỏ e2e sang skill frontend-e2e-testing, không còn chỉ ghi "ngoài phạm vi"');
}
```

- [ ] **Step 2: Chạy validate, xác nhận đỏ đúng 1 dòng**

Run: `node test/validate.mjs`
Expected: đúng 1 `✗ frontend-testing (S7): …`; còn lại pass (mốc hiện tại 1734 pass).

- [ ] **Step 3: Sửa `frontend-testing/SKILL.md:68-69`**

Thay 2 dòng:

```markdown
- **e2e (Playwright/Cypress) mỏng:** chỉ vài luồng người dùng giá trị cao đầu-cuối, **ngoài phạm
  vi recipe này**; không dồn e2e cho thứ tầng component/hook phủ được rẻ và ổn định hơn.
```

bằng:

```markdown
- **e2e (Playwright) mỏng:** chỉ 3–5 luồng người dùng giá trị cao đầu-cuối — viết bằng skill
  `frontend-e2e-testing`, không phải recipe này; không dồn e2e cho thứ tầng component/hook phủ được rẻ và
  ổn định hơn.
```

- [ ] **Step 4: Sửa `frontend-testing/SKILL.md:121`**

Thay đoạn cuối dòng `… e2e đầy đủ nằm ngoài phạm vi recipe này.` bằng `… e2e thuộc skill \`frontend-e2e-testing\`.` (giữ nguyên phần đầu dòng "Ngôn ngữ đo được; con người **duyệt diff** trước khi commit.").

- [ ] **Step 5: Chạy validate → 0 fail**

Run: `node test/validate.mjs`
Expected: `0 fail`.

- [ ] **Step 6: Commit**

```text
docs(frontend): point frontend-testing e2e guidance to frontend-e2e-testing

Changed:
- frontend-testing: mục e2e và dòng ranh giới trỏ sang skill frontend-e2e-testing thay vì chỉ ghi "ngoài phạm vi".
- Mở khối validate 19 (helper flat19, wf19, step19, field19) và assert S7.

Reason:
- Spec 2026-09-29 S7: skill e2e đã có, recipe testing phải chỉ đường tới nó.
```

---

### Task 2: Publish `frontend-data-integration` + `frontend-e2e-testing` (trước khi nối)

**Files:**
- Modify: `plugins/_published.json`, `plugins/_cowork.json`, `plugins/frontend/.manifest.json`
- Modify: `plugins/frontend/shared/principles.md:14`, `:41`
- Modify: `plugins/frontend/skills/frontend-implement/SKILL.md` (dòng ~58-59 "để trống bằng `props` + `TODO`", ~71 Ranh giới, ~78 Ghi chú)
- Modify: `test/install.test.mjs:186-206`
- Modify: `test/validate.mjs` (khối 19)

**Interfaces:**
- Produces: `frontend/frontend-data-integration`, `frontend/frontend-e2e-testing` trong `offeredCatalog()` (Task 3–5 phụ thuộc).

- [ ] **Step 1: Thêm assert đỏ vào khối 19**

```js
  const pub19 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_published.json'), 'utf8')).published;
  for (const s of ['frontend/frontend-data-integration', 'frontend/frontend-e2e-testing']) {
    ok(pub19.includes(s), `_published.json: có ${s} (publish trước khi nối workflow, không chờ pilot)`);
  }
  const cowork19 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_cowork.json'), 'utf8')).skills;
  for (const s of ['frontend:frontend-data-integration', 'frontend:frontend-e2e-testing']) {
    ok(cowork19.includes(s), `_cowork.json: có ${s}`);
  }
  const feMan19 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', '.manifest.json'), 'utf8'));
  ok(feMan19.version === '1.6.0' && !feMan19.description.includes('DRAFT'),
    'frontend manifest: version 1.6.0, description không còn nhãn DRAFT');
  const fePr19 = fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', 'shared', 'principles.md'), 'utf8');
  ok(!fePr19.includes('state-model'), 'frontend principles: không còn tham chiếu state-model treo (spec §7.3.7)');
  const feImpl19 = fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-implement', 'SKILL.md'), 'utf8');
  ok(flat19(feImpl19).includes('`frontend-data-integration`'),
    'frontend-implement: trỏ phần nối data/API sang frontend-data-integration');
```

- [ ] **Step 2: Chạy validate + install test, xác nhận đỏ**

Run: `node test/validate.mjs; node test/install.test.mjs`
Expected: validate đỏ ở 7 assert vừa thêm (4 publish/cowork, manifest, principles, implement); install test **xanh** (chưa publish).

- [ ] **Step 3: `plugins/_published.json`**

Sau dòng `"frontend/frontend-fix",` thêm:

```json
    "frontend/frontend-data-integration",
    "frontend/frontend-e2e-testing",
```

(giữ dấu phẩy đúng cú pháp JSON với phần tử kế tiếp).

- [ ] **Step 4: `plugins/_cowork.json`**

Sau dòng `"frontend:frontend-fix",` thêm `"frontend:frontend-data-integration",` và `"frontend:frontend-e2e-testing",`.

- [ ] **Step 5: `plugins/frontend/.manifest.json`**

- `"version": "1.5.0"` → `"1.6.0"`.
- Trong `description`, thay đoạn `; frontend-data-integration (DRAFT — nối UI với API theo contract OpenAPI: type sinh từ contract, data hook đúng tầng, đủ 4 trạng thái); frontend-e2e-testing (DRAFT — e2e Playwright cho 3–5 luồng giá trị cao, chỉ chạy trên môi trường local/test).` bằng `, frontend-data-integration (nối UI với API theo contract OpenAPI: type sinh từ contract, data hook đúng tầng, đủ 4 trạng thái), frontend-e2e-testing (e2e Playwright cho 3–5 luồng giá trị cao, chỉ chạy trên môi trường local/test).` — đồng thời đổi dấu `;` ngay trước `frontend-fix (` thành `,` để mọi recipe cùng một danh sách phân cách bằng dấu phẩy.

- [ ] **Step 6: `plugins/frontend/shared/principles.md`**

Dòng 14: `ở \`src/shared/\`. Cây component, design tokens, ui-contract, state-model đều externalize ra file.` → `ở \`src/shared/\`. Cây component, design tokens, ui-contract đều externalize ra file; tầng data (type sinh từ \`docs/contracts/\` + data hook) do \`frontend-data-integration\` sở hữu.`

Dòng 41: `` `ui-contract.md` (component API + states + data contract) > state-model > implement; `` → `` `ui-contract.md` (component API + states + data contract) > implement; ``

(Đọc lại 2 dòng thật trước khi sửa; nếu wrap lệch, giữ wrap ~100 cột.)

- [ ] **Step 7: `plugins/frontend/skills/frontend-implement/SKILL.md`**

- Dòng ~58-59 (`… chỗ cần dữ liệu để trống bằng \`props\` + \`TODO\` rõ ràng.`): nối thêm câu `Nối các chỗ đó với API thật là việc của skill \`frontend-data-integration\` (lượt sau).`
- Dòng ~71 Ranh giới `- Không nối data/API, …` → giữ nguyên, thêm vào cuối bullet ` Nối data/API → \`frontend-data-integration\`.`
- Dòng ~78 Ghi chú `- Nối dữ liệu/logic thật là bước hiện thực sau, ngoài phạm vi recipe này.` → `- Nối dữ liệu/API thật là bước sau, dùng skill \`frontend-data-integration\` (container/page gọi data hook, đổ \`props\` vào component này).`

Nếu dòng không khớp nguyên văn, grep `TODO`, `Không nối data`, `Nối dữ liệu` để định vị; báo lại nếu không tìm thấy.

- [ ] **Step 8: Chạy install test, xác nhận đỏ ở 2 khối draft**

Run: `node test/install.test.mjs`
Expected: `✗ offeredCatalog: KHÔNG offer frontend-data-integration (draft)`, `✗ … frontend-e2e-testing (draft)`, `✗ … 7 skill frontend …` (2 dòng).

- [ ] **Step 9: Sửa `test/install.test.mjs:186-206`**

Thay 2 khối draft bằng:

```js
// frontend-data-integration + frontend-e2e-testing đã publish (spec 2026-09-29 §7.3.7, §7.2; publish không chờ pilot).
{
  const feOff = offeredCatalog().plugins.find((p) => p.id === 'frontend');
  for (const s of ['frontend/frontend-data-integration', 'frontend/frontend-e2e-testing']) {
    ok(feOff && feOff.skillIds.includes(s), `offeredCatalog: offer ${s} (đã publish)`);
  }
  ok(feOff && feOff.skillIds.length === 9, 'offeredCatalog: offer đủ 9 skill frontend đã publish');
}
```

- [ ] **Step 10: Chạy toàn bộ**

Run: `npm test && npm run pack:verify`
Expected: validate `0 fail`; install/wizard/others không `✗`; pack-guard OK.

- [ ] **Step 11: Commit**

```text
feat(publish): publish frontend-data-integration and frontend-e2e-testing

Changed:
- Thêm frontend/frontend-data-integration và frontend/frontend-e2e-testing vào _published.json và _cowork.json; manifest frontend 1.6.0, bỏ nhãn DRAFT.
- frontend principles: bỏ tham chiếu state-model treo, nêu tầng data do frontend-data-integration sở hữu.
- frontend-implement: trỏ phần nối data/API sang frontend-data-integration.
- install.test: 2 khối draft đổi thành assert đã offer, frontend 9 skill; validate khối 19 thêm assert publish.

Reason:
- Pha publish của spec 2026-09-29 §7.3.7 và §7.2, làm trước khi nối agent vào workflow vì offeredCatalog ẩn workflow có closure chưa publish; publish không chờ pilot theo quyết định 2026-09-30.
```

---

### Task 3: WF4 — `workflow-api` Bước 6 → `frontend-data-integrator`

**Files:**
- Modify: `workflows/api/WORKFLOW.md` — frontmatter `agents:` (dòng 9); Điều kiện tiên quyết; Bước 6 (dòng 105-117); bảng Xử lý lỗi
- Modify: `test/validate.mjs:860-867` (gỡ assert `diWfMentions`) và khối 19

**Interfaces:**
- Consumes: publish ở Task 2.

- [ ] **Step 1: Thêm assert đỏ vào khối 19**

```js
  const offWf19 = offeredCatalog().plugins.find((p) => p.id === 'workflows')?.skillIds ?? [];
  // Nối agent chỉ hợp lệ khi skill của agent đã publish; nếu rút về draft, wizard ẩn workflow lặng lẽ.
  for (const w of ['workflow-api', 'workflow-feature', 'workflow-testing']) {
    ok(offWf19.includes(`workflows/${w}`), `offeredCatalog: vẫn offer workflows/${w} (closure agent frontend đã publish)`);
  }
  const api19 = wf19('workflow-api');
  const apiS6 = step19(api19, 6);
  ok(/^FE client/.test(apiS6.title) && field19(apiS6.body, 'Thực hiện').includes('agent `frontend-data-integrator`'),
    'workflow-api Bước 6: FE client do agent frontend-data-integrator thực hiện');
  ok(!flat19(apiS6.body).includes('Gap G1') && field19(apiS6.body, 'Ràng buộc').includes('docs/contracts/'),
    'workflow-api Bước 6: bỏ ghi chú Gap G1; Ràng buộc cấm sửa docs/contracts/');
  ok(api19 && api19.agents.includes('frontend-data-integrator'), 'workflow-api: frontmatter agents có frontend-data-integrator');
  ok(parseSteps(api19?.body ?? '').length === 8, 'workflow-api: vẫn 8 bước');
```

(`offeredCatalog` đã được import ở đầu `validate.mjs` từ đợt fixer — dòng 14. Nếu không thấy import, dừng và báo.)

- [ ] **Step 2: Chạy validate, xác nhận đỏ đúng nhóm `workflow-api`**

Run: `node test/validate.mjs`
Expected: `✗ workflow-api Bước 6 …` (2), `✗ workflow-api: frontmatter …`; 3 assert `offeredCatalog: vẫn offer …` và `vẫn 8 bước` xanh.

- [ ] **Step 3: Frontmatter `workflows/api/WORKFLOW.md:9`**

```yaml
agents: "backend-implementer,backend-test-writer,backend-reviewer,engineering-quality-auditor,frontend-data-integrator"
```

- [ ] **Step 4: Điều kiện tiên quyết** — thay dòng đầu mục:

```markdown
- Skill/agent đã cài: `backend-implementer`, `backend-test-writer`, `backend-reviewer`,
  `engineering-quality-auditor`, `frontend-data-integrator` (chỉ khi nối FE ở Bước 6), skill
  `backend/backend-api-contract`, `core/git-workflow`.
```

- [ ] **Step 5: Thay toàn bộ Bước 6**

```markdown
### Bước 6 — FE client (tuỳ chọn)

- **Thực hiện:** agent `frontend-data-integrator` (chỉ khi người dùng yêu cầu nối FE)
- **Đầu vào:** contract đã qua kiểm drift từ Bước 5 + màn hình/component FE đã có (do `frontend-implement` dựng,
  chỗ cần dữ liệu để trống bằng `props` + `TODO`)
- **Hành động:** agent nối UI với endpoint mới theo skill `frontend-data-integration`: dùng type sinh từ contract
  bằng codegen sẵn có của project, tạo data hook đúng tầng kiến trúc, nối ở container/page, đủ 4 trạng thái
  loading/error/empty/success; chạy `tsc --noEmit`, lint, build. Người dùng không yêu cầu nối FE → ghi "bỏ qua".
- **Ràng buộc:** không sửa `docs/contracts/` để hợp với FE — lệch contract thì dừng, quay lại Bước 2; chưa có
  codegen hoặc thư viện data → agent dừng, đề xuất, chờ người dùng chọn (không tự thêm); không viết tay type trùng
  contract; không gọi `fetch`/`axios` trong component.
- **Đầu ra:** type/hook/container FE khớp contract, `tsc`/lint/build xanh; hoặc dòng "bỏ qua".
- **Gate:** type khớp contract, `tsc`/lint/build xanh; hoặc ghi "bỏ qua".
- **Khi fail:** type/hook không khớp contract → sửa FE theo đúng contract, không sửa contract để hợp FE; thiếu
  codegen/thư viện data → dừng chờ người dùng chọn.
- **Evidence:** report của agent (file đã thêm/sửa theo tầng, endpoint ↔ hook ↔ container, lệnh `tsc`/lint/build +
  exit code), hoặc dòng "bỏ qua" trong report bước.
```

- [ ] **Step 6: Bảng Xử lý lỗi** — sau hàng `| Finding \`blocker\` về authorization/input validation (Bước 5) | … |` thêm:

```markdown
| Contract lệch khi nối FE (Bước 6) | Dừng, quay lại Bước 2 chỉnh contract; không sửa contract để hợp FE |
```

- [ ] **Step 7: Gỡ assert `diWfMentions` (`test/validate.mjs:860-867`)**

Xoá 2 dòng comment `// N1: agent chưa được nối vào workflow …` / `// Xoá assert này ở pha publish …` và khối `const diWfDir … ok(diWfMentions.length === 0, …)`. Giữ nguyên các assert agent phía trên (mode/skills/container…).

- [ ] **Step 8: Chạy validate → 0 fail; kiểm răng**

Run: `node test/validate.mjs` → `0 fail`.
Teeth: tạm xoá dòng `"frontend/frontend-data-integration",` trong `_published.json` → validate → Expected: `✗ offeredCatalog: vẫn offer workflows/workflow-api …` đỏ. Khôi phục `git checkout -- plugins/_published.json` → `0 fail`.

- [ ] **Step 9: Commit**

```text
fix(workflows): dispatch api FE client step to frontend-data-integrator

Changed:
- workflow-api Bước 6 FE client: Thực hiện là agent frontend-data-integrator theo skill frontend-data-integration; bỏ ghi chú Gap G1; Ràng buộc cấm sửa docs/contracts/, thiếu codegen/thư viện data thì dừng hỏi.
- Frontmatter agents, tiền điều kiện, bảng lỗi (contract lệch khi nối FE) cập nhật; số bước giữ 8.
- validate: gỡ assert "frontend-data-integrator chưa workflow nào dùng"; khối 19 thêm assert workflow-api và assert 3 workflow vẫn được offer.

Reason:
- Spec 2026-09-29 WF4: bước FE client đang ở session chính vì chưa có skill nối data (G1); skill và agent nay đã publish.
```

---

### Task 4: WF5 — `workflow-feature` (Bước 2, 4, 5) + orchestrator

**Files:**
- Modify: `workflows/feature/WORKFLOW.md` — frontmatter; Điều kiện tiên quyết; Bước 2 (dòng 54-65); Bước 4 (dòng 79-91); Bước 5 (dòng 93-108); bảng lỗi
- Modify: `workflows/orchestrator/WORKFLOW.md:38` (cột Nối tiếp của `workflow-feature`)
- Modify: `test/validate.mjs:919-927` (gỡ assert `e2eWfMentions`) và khối 19

- [ ] **Step 1: Thêm assert đỏ vào khối 19**

```js
  const feat19 = wf19('workflow-feature');
  const fS2 = step19(feat19, 2), fS4 = step19(feat19, 4), fS5 = step19(feat19, 5);
  ok(/^Phân tích/.test(fS2.title) && flat19(fS2.body).includes('schema') && flat19(fS2.body).includes('`workflow-db-change`'),
    'workflow-feature Bước 2: phạm vi có đổi schema → dừng, đề xuất workflow-db-change trước');
  // Integrator nối vào component do implementer dựng, nên phải chạy SAU, không song song.
  ok(/^Implement/.test(fS4.title) && field19(fS4.body, 'Thực hiện').includes('agent `frontend-data-integrator`')
    && field19(fS4.body, 'Thực hiện').includes('sau khi') && !flat19(fS4.body).includes('Gap G1'),
    'workflow-feature Bước 4: frontend-data-integrator chạy sau frontend-implementer (fullstack), bỏ Gap G1');
  ok(/^Test/.test(fS5.title) && field19(fS5.body, 'Thực hiện').includes('agent `frontend-e2e-test-writer`'),
    'workflow-feature Bước 5: có frontend-e2e-test-writer cho AC dạng luồng UI');
  ok(field19(fS5.body, 'Gate').includes('playwright.config') && flat19(fS5.body).includes('not_run'),
    'workflow-feature Bước 5: Gate cho phép e2e/ + playwright.config.*; e2e thiếu BE/DB test → not_run hợp lệ');
  ok(feat19 && ['frontend-data-integrator', 'frontend-e2e-test-writer'].every((a) => feat19.agents.includes(a)),
    'workflow-feature: frontmatter agents có frontend-data-integrator, frontend-e2e-test-writer');
  ok(parseSteps(feat19?.body ?? '').length === 8, 'workflow-feature: vẫn 8 bước');
  const orch19 = workflows.stages.find((s) => s.kind === 'orchestrator');
  const featRow19 = parseRegistry(orch19?.body ?? '').rows.find((r) => r.id === 'workflow-feature');
  ok(featRow19 && featRow19.next.length === 0, 'orchestrator: workflow-feature không nối tiếp workflow-docs (Bước 7 đã làm docs)');
```


- [ ] **Step 2: Chạy validate, xác nhận đỏ đúng nhóm `workflow-feature` + orchestrator**

Run: `node test/validate.mjs`
Expected: 6 `✗` thuộc `workflow-feature …` / `orchestrator: workflow-feature …`; `vẫn 8 bước` xanh.

- [ ] **Step 3: Frontmatter `workflows/feature/WORKFLOW.md:9`**

```yaml
agents: "engineering-spec-analyst,backend-implementer,frontend-implementer,frontend-data-integrator,backend-test-writer,frontend-test-writer,frontend-e2e-test-writer,backend-reviewer,frontend-reviewer,engineering-quality-auditor"
```

- [ ] **Step 4: Điều kiện tiên quyết** — thay dòng đầu:

```markdown
- Skill/agent đã cài: `engineering-spec-analyst`, `backend-implementer`, `frontend-implementer`,
  `frontend-data-integrator`, `backend-test-writer`, `frontend-test-writer`, `frontend-e2e-test-writer`,
  `backend-reviewer`, `frontend-reviewer`, `engineering-quality-auditor`, skill `core/git-workflow`.
```

- [ ] **Step 5: Bước 2 — thêm nhánh schema**

- Hành động: nối thêm câu `Phạm vi cần đổi schema DB (bảng/cột/index/migration) → dừng, đề xuất chạy \`workflow-db-change\` trước rồi quay lại feature (chuỗi \`db-change → feature\`).`
- Gate: nối thêm `; không đổi schema, hoặc đã có xác nhận chạy \`workflow-db-change\` trước`.
- Khi fail: nối thêm `; phạm vi có đổi schema → dừng, đề xuất \`workflow-db-change\`.`

- [ ] **Step 6: Thay toàn bộ Bước 4**

```markdown
### Bước 4 — Implement

- **Thực hiện:** agent `backend-implementer` ∥ agent `frontend-implementer` (chỉ phía có đụng theo phạm vi
  Bước 2); phạm vi `fullstack` có contract ở Bước 3 → agent `frontend-data-integrator` chạy sau khi
  `frontend-implementer` xong
- **Đầu vào:** `requirement.md` + contract (nếu có) từ Bước 2–3
- **Hành động:** sinh vertical slice backend (aggregate/use-case/port/adapter) bám kiến trúc đã chọn; và/hoặc
  sinh component frontend presentational bám kiến trúc UI + design-system (chỗ cần dữ liệu để trống bằng props +
  TODO); khi fullstack, `frontend-data-integrator` nối container/page với API theo contract (type sinh từ
  contract, data hook đúng tầng, đủ 4 trạng thái); chạy build của từng phía.
- **Ràng buộc:** chỉ sửa file trong slice/feature được giao; không giả lập data ẩn; integrator không sửa
  `docs/contracts/` — lệch contract thì dừng, quay lại Bước 3.
- **Đầu ra:** code implementation (backend và/hoặc frontend, gồm tầng data khi fullstack) build xanh.
- **Gate:** build xanh; khi fullstack: `tsc`/lint/build xanh sau khi nối data.
- **Khi fail:** build lỗi → chẩn đoán → sửa → build lại; lặp tới khi xanh; contract lệch khi nối data → quay lại
  Bước 3.
- **Evidence:** lệnh build (`mvn compile`/`npm run build`/`tsc --noEmit` …) + exit code 0; report của integrator
  (endpoint ↔ hook ↔ container) khi fullstack.
```

- [ ] **Step 7: Thay toàn bộ Bước 5**

```markdown
### Bước 5 — Test

- **Thực hiện:** agent `backend-test-writer` ∥ agent `frontend-test-writer` (chỉ phía có đụng); AC dạng luồng UI
  đầu-cuối → thêm agent `frontend-e2e-test-writer`
- **Đầu vào:** code implementation từ Bước 4 + acceptance criteria từ Bước 2
- **Hành động:** viết unit/integration test cho từng acceptance criterion; chạy toàn bộ test suite của phía
  tương ứng; với AC dạng luồng UI, `frontend-e2e-test-writer` viết e2e Playwright (3–5 luồng, mỗi test map 1 AC)
  và chạy `--repeat-each=3`.
- **Ràng buộc:** không sửa code production để "cho test xanh"; không viết test phụ thuộc thứ tự/thời gian
  thực/mạng thật; e2e chỉ chạy trên môi trường local/test — thiếu BE/DB test thì agent trả `not_run` + lý do,
  không tự dựng hạ tầng.
- **Đầu ra:** test mới + báo cáo test pass (e2e: pass hoặc `not_run` có lý do).
- **Gate:** mỗi acceptance criterion ≥1 test; test pass (e2e `not_run` vì thiếu môi trường là hợp lệ, ghi vào
  `remaining_risks`); so với trạng thái ghi lại ở đầu bước (`git status --porcelain`), các file thay đổi hoặc mới
  trong bước (`git diff --name-only` và `git ls-files --others --exclude-standard`) chỉ gồm file test (và
  fixture/mock của test; e2e: thư mục `e2e/` và `playwright.config.*`).
- **Khi fail:** test đỏ do lỗi code thật → quay lại Bước 4 sửa code (không xoá/nới test); test đỏ do lỗi viết
  test → sửa test; e2e flaky → sửa test, không nới assertion.
- **Evidence:** lệnh test + exit code 0 + số liệu (`X tests, X passed`); e2e: lệnh Playwright + kết quả hoặc
  `not_run` + lý do; danh sách file thay đổi hoặc mới trong bước so với trạng thái đầu bước.
```

- [ ] **Step 8: Bảng Xử lý lỗi** — sau hàng `| Chưa rõ có API hay contract xung đột (sau Bước 3 ⏸) | … |` thêm:

```markdown
| Phạm vi có đổi schema DB (Bước 2) | Dừng, đề xuất chạy `workflow-db-change` trước rồi quay lại feature |
| e2e thiếu BE/DB test (Bước 5) | Ghi `not_run` + lý do vào `remaining_risks`; không tự dựng hạ tầng |
```

- [ ] **Step 9: Orchestrator `workflows/orchestrator/WORKFLOW.md:38`**

Cột "Nối tiếp" của hàng `workflow-feature`: `` `workflow-docs` `` → `—`. Không đổi hàng khác.

- [ ] **Step 10: Gỡ assert `e2eWfMentions` (`test/validate.mjs:919-927`)**

Xoá 2 dòng comment `// Agent chưa được nối vào workflow …` / `// Xoá assert này ở pha nối workflow …` và khối `const e2eWfDir … ok(e2eWfMentions.length === 0, …)`. Giữ các assert agent phía trên.

- [ ] **Step 11: Chạy toàn bộ**

Run: `npm test`
Expected: validate `0 fail`; các test khác xanh. Kiểm assert orchestrator có sẵn (`validate.mjs:1043-1044` về chuỗi db-change → api → feature) vẫn pass.

- [ ] **Step 12: Commit**

```text
fix(workflows): wire data-integrator and e2e test-writer into feature workflow

Changed:
- workflow-feature Bước 2: phạm vi có đổi schema → dừng, đề xuất workflow-db-change trước.
- Bước 4: khi fullstack, frontend-data-integrator chạy sau frontend-implementer để nối container/page với API theo contract; bỏ ghi chú Gap G1.
- Bước 5: AC dạng luồng UI thêm frontend-e2e-test-writer; Gate cho phép e2e/ + playwright.config.*, e2e thiếu BE/DB test → not_run hợp lệ.
- Frontmatter agents, tiền điều kiện, bảng lỗi cập nhật; orchestrator bỏ workflow-docs khỏi Nối tiếp của feature; số bước giữ 8.
- validate: gỡ assert "frontend-e2e-test-writer chưa workflow nào dùng"; khối 19 thêm assert feature/orchestrator.

Reason:
- Spec 2026-09-29 WF5; "Bước 3b" gộp vào Bước 4 để không đánh số lại bước.
```

---

### Task 5: WF6 — `workflow-testing` (Bước 4, 5)

**Files:**
- Modify: `workflows/testing/WORKFLOW.md` — frontmatter; Điều kiện tiên quyết; Bước 4 (dòng 73-85); Bước 5 (dòng 87-100); bảng lỗi
- Modify: `test/validate.mjs` (khối 19)

- [ ] **Step 1: Thêm assert đỏ vào khối 19**

```js
  const tst19 = wf19('workflow-testing');
  const tS4 = step19(tst19, 4), tS5 = step19(tst19, 5);
  for (const [n, s] of [[4, tS4], [5, tS5]]) {
    ok(field19(s.body, 'Thực hiện').includes('agent `frontend-e2e-test-writer`'),
      `workflow-testing Bước ${n}: loại "luồng quan trọng: e2e" do frontend-e2e-test-writer thực hiện`);
    ok(field19(s.body, 'Gate').includes('playwright.config'),
      `workflow-testing Bước ${n}: Gate cho phép e2e/ + playwright.config.*`);
  }
  ok(flat19(tS5.body).includes('not_run'), 'workflow-testing Bước 5: e2e thiếu BE/DB test → not_run hợp lệ');
  ok(tst19 && tst19.agents.includes('frontend-e2e-test-writer'), 'workflow-testing: frontmatter agents có frontend-e2e-test-writer');
  ok(parseSteps(tst19?.body ?? '').length === 7, 'workflow-testing: vẫn 7 bước');
```

- [ ] **Step 2: Chạy validate, xác nhận đỏ đúng nhóm `workflow-testing`**

Expected: 6 `✗` `workflow-testing …`; `vẫn 7 bước` xanh.

- [ ] **Step 3: Frontmatter** `agents: "backend-test-writer,frontend-test-writer,frontend-e2e-test-writer"`

- [ ] **Step 4: Điều kiện tiên quyết** — dòng đầu:

```markdown
- Skill/agent đã cài: `backend-test-writer`, `frontend-test-writer`, `frontend-e2e-test-writer` (chỉ khi chiến
  lược có e2e), skill `core/git-workflow`.
```

- [ ] **Step 5: Bước 4 — sửa 3 trường**

- Thực hiện: `agent \`backend-test-writer\` ∥ agent \`frontend-test-writer\` (phía có vùng đụng); hành vi loại "luồng quan trọng: e2e" → agent \`frontend-e2e-test-writer\``
- Hành động: nối thêm `; e2e viết bằng Playwright theo skill \`frontend-e2e-testing\` (mỗi test map 1 hành vi/AC, selector theo role/label, không sleep cứng).`
- Gate: trong ngoặc `(và fixture/mock của test)` → `(và fixture/mock của test; e2e: thư mục \`e2e/\` và \`playwright.config.*\`)`.

- [ ] **Step 6: Bước 5 — sửa 4 trường**

- Thực hiện: như Bước 4 (thêm `; e2e → agent \`frontend-e2e-test-writer\``).
- Hành động: nối thêm `; e2e chạy \`npx playwright test --repeat-each=3\`, flaky → sửa test (không nới assertion); thiếu BE/DB test → \`not_run\` + lý do.`
- Gate: thêm ngoại lệ `e2e/` + `playwright.config.*` như Bước 4, và câu `; e2e \`not_run\` vì thiếu môi trường là hợp lệ (ghi vào \`remaining_risks\`)`.
- Evidence: nối thêm `; e2e: lệnh Playwright + kết quả hoặc \`not_run\` + lý do`.

- [ ] **Step 7: Bảng lỗi** — sau hàng `| Test fail | … |` thêm:

```markdown
| e2e thiếu BE/DB test (Bước 4–5) | Ghi `not_run` + lý do vào `remaining_risks`; không tự dựng hạ tầng |
```

- [ ] **Step 8: Chạy toàn bộ** — `npm test` → xanh.

- [ ] **Step 9: Commit**

```text
fix(workflows): route e2e strategy in testing workflow to frontend-e2e-test-writer

Changed:
- workflow-testing Bước 4–5: hành vi loại "luồng quan trọng: e2e" do frontend-e2e-test-writer viết và chạy (Playwright, --repeat-each=3); Gate cho phép e2e/ + playwright.config.*; thiếu BE/DB test → not_run hợp lệ.
- Frontmatter agents, tiền điều kiện, bảng lỗi cập nhật; số bước giữ 7; khối validate 19 thêm assert.

Reason:
- Spec 2026-09-29 WF6: policy có e2e nhưng chưa ai viết.
```

---

### Task 6: Docs — README, CLAUDE.md, spec 2026-09-29

**Files:**
- Modify: `README.md`, `README_VI.md` (heading agent, bảng agent, bảng workflow WF01/WF05/WF08, bảng Skill gaps G1/G5)
- Modify: `CLAUDE.md:83`
- Modify: `docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md` (§9, §12, §13.1, §13.2)
- Modify: `test/validate.mjs` (khối 19)

- [ ] **Step 1: Assert đỏ vào khối 19**

```js
  for (const [f, head] of [['README.md', '### Agents (15)'], ['README_VI.md', '### Agent (15)']]) {
    const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
    const row = (a) => rd.split('\n').find((l) => l.startsWith(`| \`${a}\` |`)) ?? '';
    ok(rd.split('\n').some((l) => l.trim() === head), `${f}: heading ${head}`);
    ok(['WF01', 'WF08'].every((w) => row('frontend-data-integrator').includes(w)),
      `${f}: bảng agent có frontend-data-integrator dùng ở WF01, WF08`);
    ok(['WF01', 'WF05'].every((w) => row('frontend-e2e-test-writer').includes(w)),
      `${f}: bảng agent có frontend-e2e-test-writer dùng ở WF01, WF05`);
    ok(!/^\| G1 \|/m.test(rd) && !/^\| G5 \|/m.test(rd), `${f}: bảng Skill gaps bỏ G1, G5 (đã có skill)`);
  }
```

- [ ] **Step 2: Chạy validate → đỏ đúng 8 dòng README**

- [ ] **Step 3: README.md**

- `### Agents (13)` → `### Agents (15)`.
- Bảng agent: sau hàng `| \`frontend-implementer\` | … |` thêm `| \`frontend-data-integrator\` | frontend | write | frontend-data-integration | WF01, WF08 |`; sau hàng `| \`frontend-test-writer\` | … |` thêm `| \`frontend-e2e-test-writer\` | frontend | write | frontend-e2e-testing | WF01, WF05 |`.
- Bảng workflow, cột agent:
  - WF01 → `spec-analyst, BE/FE implementer, FE data-integrator, BE/FE test-writer, FE e2e-test-writer, BE/FE reviewer, quality-auditor`
  - WF05 → `BE/FE test-writer, FE e2e-test-writer`
  - WF08 → `backend-implementer, backend-test-writer, backend-reviewer, quality-auditor, frontend-data-integrator`
- Bảng Skill gaps: xoá hàng `| G1 | …` và `| G5 | …`.

- [ ] **Step 4: README_VI.md** — cùng các thay đổi với heading `### Agent (13)` → `### Agent (15)`, các hàng dùng cùng id; hàng G1/G5 bản tiếng Việt xoá.

- [ ] **Step 5: CLAUDE.md:83** — thay `\`frontend\` (7 skills published incl. \`frontend-fix\` + \`frontend-data-integration\` and \`frontend-e2e-testing\` drafts, gated per-skill in \`plugins/_published.json\`)` bằng `\`frontend\` (9 skills published incl. \`frontend-fix\`, \`frontend-data-integration\`, \`frontend-e2e-testing\`, gated per-skill in \`plugins/_published.json\`)`. Đọc câu thật trước; giữ phần còn lại.

- [ ] **Step 6: Spec 2026-09-29**

- §9 hàng **P1c**: cột Trạng thái `⏳ chờ pilot (Q7)` → `✅ publish không chờ pilot (2026-09-30), nhánh \`feature/spec-followups\``.
- §9 hàng **P2**: cập nhật `◐ WF7, WF8–WF10 xong; WF3/WF4 một phần; WF5, WF6 chưa` → `◐ WF4–WF10 xong; WF3 phần dùng skill còn chờ P1b`.
- §13.1 hàng A4/Q2: cột Merge `nhánh \`feature/fixer-agent\`` → `` `909f1b9` ``; cột Commit thêm `` `938349f` ``, `` `528ec4f` ``.
- §13.1 thêm hàng: `| S7, P1c, WF4, WF5, WF6 | nhánh \`feature/spec-followups\` | (liệt kê SHA commit Task 1–5 thật) |`.
- §13.2: xoá hàng `S7`, `P1c`, `WF4 Bước 5, WF5, WF6`.
- §12: thêm bullet `- Publish \`frontend-data-integration\` và \`frontend-e2e-testing\` không chờ pilot (2026-09-30, lần thứ hai làm trái Q4 sau F-Q3 của spec fixer); chất lượng nội dung chưa kiểm trên project thật. \`frontend-data-integration\` giả định \`frontend-implement\` để lại \`props\` + \`TODO\`.`
- §13.2 thêm hàng mở: `| e2e smoke ở release | §8.1 ghi "release (smoke)" cho \`frontend-e2e-test-writer\` nhưng không có hàng WF nào | Chưa có thiết kế |`.

- [ ] **Step 7: Chạy validate → 0 fail; `npm test` xanh**

- [ ] **Step 8: Commit**

```text
docs: document published frontend agents and sync upgrade spec progress

Changed:
- README/README_VI: heading 15 agent, thêm frontend-data-integrator (WF01, WF08) và frontend-e2e-test-writer (WF01, WF05); cập nhật cột agent WF01/WF05/WF08; bỏ G1, G5 khỏi bảng Skill gaps.
- CLAUDE.md: frontend 9 skill published.
- Spec 2026-09-29: P1c xong, P2 cập nhật; §13.1 ghi merge 909f1b9 cho A4/Q2 và hàng mới S7/P1c/WF4–WF6; §13.2 bỏ mục đã xong, thêm e2e smoke ở release; §12 ghi rủi ro publish không pilot.
- Khối validate 19 thêm assert README.

Reason:
- Tài liệu phải khớp catalog và workflow sau khi publish và nối 2 agent frontend.
```

---

### Task 7: Smoke install sandbox (không commit)

- [ ] **Step 1:** `npm run build`
- [ ] **Step 2:** Cài `workflow-feature` vào sandbox, kiểm closure:

```bash
SB="$(node -e "console.log(require('os').tmpdir())")/aip-followups-smoke" && node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true});require('fs').mkdirSync(process.argv[1],{recursive:true})" "$SB" && AIE_INSTALL_ROOT="$SB" node cli/index.mjs install --provider claude --skill workflows/workflow-feature --yes && node -e "const m=require(process.argv[1]+'/.ai-engineering/manifest.json');console.log(JSON.stringify(m,null,1).split('\n').filter(l=>/data-integ|e2e/.test(l)).join('\n'))" "$SB"
```

Expected: manifest có `frontend-data-integration`, `frontend-e2e-testing`, `frontend-data-integrator.md`, `frontend-e2e-test-writer.md`.

- [ ] **Step 3:** Dọn: `node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true})" "$SB"`; `git status --short` sạch.

---

## Self-Review

**1. Spec coverage**

| Spec | Task |
|---|---|
| §3.3 S7 | 1 |
| §7.3.7 pha publish (`_published.json`, principles:14,41, pointer implement) | 2 |
| §7.2 e2e publish | 2 |
| §5.3 WF4 (api FE client → integrator) | 3 |
| §5.3 WF5 (schema stop, 3b→B4, e2e B5, bỏ docs khỏi Nối tiếp) | 4 |
| §5.3 WF6 | 5 |
| §8.1 catalog (README) + §13 tiến độ | 6 |
| §6.3 kiểu smoke | 7 |
| §8.1 "release (smoke)" | Ngoài phạm vi — ghi §13.2 ở Task 6 |

**2. Placeholder scan:** Task 6 Step 6 yêu cầu "liệt kê SHA commit Task 1–5 thật" — dữ liệu chỉ có sau khi commit, không phải placeholder thiết kế. 

**3. Type consistency:** `flat19`, `wf19`, `step19`, `field19` định nghĩa ở Task 1, dùng ở Task 2–6. `offeredCatalog`, `parseRegistry`, `parseSteps`, `workflows` đã có ở đầu `validate.mjs`.

**4. Review Focus:** (1) Task 3 assert offered + teeth; (2) Task 4 assert "sau khi"; (3) Task 4/5 assert `playwright.config`; (4) Task 4/5 assert `not_run`; (5) Task 4 assert schema → `workflow-db-change`.
