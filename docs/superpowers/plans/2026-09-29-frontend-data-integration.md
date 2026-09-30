# frontend-data-integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm skill recipe `frontend-data-integration` và agent `frontend-data-integrator` vào plugin `frontend` ở trạng thái **draft**, kèm 3 file `references/` và assert hợp đồng trong `test/validate.mjs` và `test/install.test.mjs`.

**Architecture:** Skill là docs-only recipe: `SKILL.md` mỏng (tiền đề + cổng I1–I5 + ranh giới + report) và `references/` (contract & codegen, đặt file theo kiến trúc, trạng thái & lỗi). Skill được auto-discover; wizard không offer nhờ đổi `plugins/_published.json` từ `"frontend"` sang 6 mục `frontend/<skill>`. Agent mới tạo được ngay vì installer chỉ đặt agent khi mọi skill của nó đã được chọn (`cli/lib/install.mjs:496-497`). Không đổi CLI, adapter, workflow.

**Tech Stack:** Markdown + YAML frontmatter (parser zero-dep của repo); ví dụ TypeScript/React/TanStack Query trong tài liệu; harness `ok(cond, msg)` của repo (Node ≥ 20, ESM, zero dependency).

**Spec:** [docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md](../specs/2026-09-29-skill-plugin-workflow-upgrade-design.md) §7.3 (quyết định N1–N6, cổng I1–I5, pha DI-P1–DI-P3) và §8.3 (agent).

## Global Constraints

- Docs-only: KHÔNG sửa `cli/`, `adapters/`, `core/`, `workflows/`, agent nào khác; KHÔNG đổi nội dung 6 skill frontend hiện có.
- Pha publish (spec §7.3.7) KHÔNG thuộc plan này: không thêm `frontend/frontend-data-integration` vào `_published.json`, không sửa `workflow-api` / `workflow-feature`, không sửa `plugins/frontend/shared/principles.md`, không thêm pointer trong `frontend-implement`.
- `plugins/_published.json` chỉ sửa ở Task 1: `"frontend"` → 6 mục `frontend/<skill>` hiện có, **không** có `frontend/frontend-data-integration`.
- Frontmatter skill: `order: 7`, `stageNumber: "07"`, `runsIn: execute`, `invoke: per-request`, `pipeline: false`, `sharedAssets: templates/architecture`, `next: null`.
- Agent: `name: frontend-data-integrator`, `mode: write`, `skills: "frontend-data-integration"`, đủ 4 heading `## Vai trò` / `## Phạm vi` / `## Quy trình` / `## Report trả về`.
- Path tương đối trong `references/` không được trùng với skill khác cùng plugin (`test/validate.mjs`, mục hygiene): dùng đúng 3 tên `contract-and-codegen.md`, `data-layer-by-architecture.md`, `states-and-errors.md`.
- Mọi nhận định về hành vi công cụ (openapi-typescript, TanStack Query, codegen khác) phải có link tài liệu chính thức hoặc nhãn `[Unverified]` / `[Inference]`; không tuyên bố kit "đã chạy được" (chưa pilot).
- Nối UI ở container/page, KHÔNG sửa presentational (N4); type sinh đặt ở tầng shared, `*.dto.ts` chỉ là alias (N2); chỉ map lỗi 401, không quyết định auth/token (N5).
- File UTF-8 không BOM, LF. Nội dung hướng người dùng viết tiếng Việt có dấu. Comment chỉ giải thích *why*, tiếng Việt, 1–2 dòng (AGENTS.md → Comments).
- Chỉ thêm assert vào `test/validate.mjs` (khối "12." mới) và `test/install.test.mjs`; không thêm file test mới.
- Không `rm -rf` sandbox chứa junction; dọn bằng `node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true})" <dir>` [[windows-junction-rm-hazard]]. Lệnh `find` trên thư mục cài phải là `find -L`.
- Mỗi task = 1 commit qua skill `core:git-workflow` (header EN, body VI có dấu, KHÔNG trailer `Co-Authored-By`). Push/PR/merge: chờ người dùng.
- `<scratchpad>` trong lệnh = thư mục tạm của phiên thực thi, nằm NGOÀI repo.

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/frontend/skills/frontend-data-integration/SKILL.md` | Recipe: tiền đề, cổng I1–I5, ranh giới an toàn, report | 1 |
| `plugins/_published.json` | Gate draft: frontend publish theo từng skill | 1 |
| `plugins/frontend/.manifest.json` | Description đủ 7 skill (đánh dấu draft), version `1.3.0` | 1 |
| `CLAUDE.md` | Câu catalog plugin: frontend 6 published + 1 draft | 1 |
| `test/install.test.mjs` | Assert draft: có trong `skillCatalog`, không trong `offeredCatalog` | 1 |
| `test/validate.mjs` | Khối "12.": hợp đồng skill, references, agent | 1, 2, 3 |
| `references/contract-and-codegen.md` | Contract → type/client, dò codegen, N2, N3 | 2 |
| `references/data-layer-by-architecture.md` | Đặt file theo Feature-Based / FSD / Micro-FE + ví dụ hook/container | 2 |
| `references/states-and-errors.md` | 4 trạng thái, map lỗi 401/4xx/5xx, test msw | 2 |
| `plugins/frontend/agents/frontend-data-integrator.md` | Agent bọc skill | 3 |

(`references/` = `plugins/frontend/skills/frontend-data-integration/references/`)

---

### Task 0: Commit plan

**Files:**
- Commit: `docs/superpowers/plans/2026-09-29-frontend-data-integration.md` (file này; spec đã commit ở `f133bbd`)

**Interfaces:**
- Consumes: branch `feature/frontend-data-integration` (đã tạo, spec đã commit).
- Produces: nhánh mà mọi task sau commit lên.

- [ ] **Step 1: Kiểm tra trạng thái**

Run: `git status --short && git branch --show-current`
Expected: chỉ file plan untracked; branch `feature/frontend-data-integration`.

- [ ] **Step 2: Stage và commit qua `core:git-workflow`**

Run: `git add docs/superpowers/plans/2026-09-29-frontend-data-integration.md && git status --short`
Header đề xuất: `docs(specs): add frontend-data-integration implementation plan`

---

### Task 1: Khung skill + gate draft

**Files:**
- Create: `plugins/frontend/skills/frontend-data-integration/SKILL.md`
- Modify: `plugins/_published.json`
- Modify: `plugins/frontend/.manifest.json`
- Modify: `CLAUDE.md` (dòng chứa `` `frontend` (6 skills) ``, ~:81)
- Test: `test/install.test.mjs` (thêm khối sau khối `backend-db-migration là DRAFT`)
- Test: `test/validate.mjs` (khối "12." mới, trước dòng `// ─────…` cuối file, sau khối "11.")

**Interfaces:**
- Consumes: `skillCatalog()`, `offeredCatalog()` (đã import ở `test/install.test.mjs:17`); `listFilesRec`, `PLUGINS_DIR`, `fs`, `path` (đã có ở `test/validate.mjs`).
- Produces: skill id `frontend-data-integration`; `SKILL.md` link tới đúng 3 path mà Task 2 tạo: `references/contract-and-codegen.md`, `references/data-layer-by-architecture.md`, `references/states-and-errors.md`; khối "12." định nghĩa `diDir`, `diRef`, `diFiles`, `diRead`, `diSkill` mà Task 2, 3 thêm assert vào cùng khối.

- [ ] **Step 1: Viết assert draft (failing)**

Chèn vào `test/install.test.mjs`, ngay sau khối `backend-db-migration là DRAFT …` (kết thúc bằng dòng `'offeredCatalog: vẫn offer đủ 8 skill backend đã publish');` và dấu `}`):

```js
// frontend-data-integration là DRAFT (spec 2026-09-29 §7.3.2 N1): có trên đĩa nhưng wizard không offer.
{
  const feAll = skillCatalog().plugins.find((p) => p.id === 'frontend');
  ok(feAll && feAll.skillIds.includes('frontend/frontend-data-integration'),
    'skillCatalog: có frontend/frontend-data-integration (draft vẫn cài được bằng --skill)');
  const feOff = offeredCatalog().plugins.find((p) => p.id === 'frontend');
  ok(feOff && !feOff.skillIds.includes('frontend/frontend-data-integration'),
    'offeredCatalog: KHÔNG offer frontend-data-integration (draft)');
  ok(feOff && feOff.skillIds.length === 6, 'offeredCatalog: vẫn offer đủ 6 skill frontend đã publish');
}
```

Chèn khối "12." vào `test/validate.mjs`, ngay sau khối "11." và trước dòng `// ─────…` cuối file:

```js
// 12. SOURCE: frontend-data-integration — hợp đồng skill/references/agent (spec 2026-09-29 §7.3, §8.3)
{
  const diDir = path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-data-integration');
  const diRef = path.join(diDir, 'references');
  const diFiles = listFilesRec(diRef);
  const diRead = (rel) => fs.readFileSync(path.join(diRef, rel), 'utf8');
  const diSkillPath = path.join(diDir, 'SKILL.md');
  const diSkillExists = fs.existsSync(diSkillPath);
  ok(diSkillExists, 'frontend-data-integration: có SKILL.md');
  const diSkill = diSkillExists ? fs.readFileSync(diSkillPath, 'utf8') : '';
  ok(/^order: 7$/m.test(diSkill) && /^pipeline: false$/m.test(diSkill) && /^sharedAssets: templates\/architecture$/m.test(diSkill),
    'frontend-data-integration: frontmatter order 7, pipeline false, sharedAssets templates/architecture');
  ok(['I1', 'I2', 'I3', 'I4', 'I5'].every((g) => diSkill.includes(`### ${g}.`)),
    'frontend-data-integration: SKILL.md có đủ cổng I1–I5');
}
```

- [ ] **Step 2: Chạy, xác nhận đỏ đúng lý do**

Run: `node test/install.test.mjs 2>&1 | tail -4; node test/validate.mjs 2>&1 | grep -E "frontend-data-integration|KẾT QUẢ"`
Expected: FAIL `skillCatalog: có frontend/frontend-data-integration` (skill chưa tồn tại) và FAIL `có SKILL.md`, `frontmatter order 7…`, `có đủ cổng I1–I5`; assert `KHÔNG offer` và `vẫn offer đủ 6 skill` PASS (frontend đang publish nguyên plugin nên offer 6 skill, skill mới chưa có).

- [ ] **Step 3: Tạo `SKILL.md`**

Tạo `plugins/frontend/skills/frontend-data-integration/SKILL.md` với nội dung sau (giữ nguyên, kể cả dòng trống):

````markdown
---
name: frontend-data-integration
description: "Recipe on-demand: NỐI một UI React đã dựng (component presentational do frontend-implement sinh ra) với API THẬT theo contract OpenAPI ở docs/contracts/ — dùng type sinh từ contract (codegen sẵn có của project, hoặc đề xuất openapi-typescript và hỏi trước khi cài), tạo data hook đúng tầng kiến trúc (Feature-Based/FSD/Micro-FE) bằng TanStack Query, nối ở container/page (KHÔNG sửa presentational), xử lý đủ loading/error/empty/success, map DTO sang view model ở biên, map lỗi 401/4xx/5xx, test bằng msw qua frontend-testing. Lệch contract thì DỪNG, báo drift, không tự sửa contract. KHÔNG quyết định lưu token/auth, KHÔNG thêm global store hay thư viện data khi chưa hỏi. Dùng skill NÀY khi người dùng muốn \"nối API\", \"gọi API cho màn hình\", \"tích hợp API vào React\", \"data hook\", \"sinh type từ OpenAPI\", \"nối data cho component\", \"thay mock bằng API thật\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã chạy frontend-init và đã có contract."
order: 7
stageNumber: "07"
title: "Frontend Data Integration — Nối UI với API theo contract OpenAPI (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
sharedAssets: templates/architecture
next: null
---

# Frontend Data Integration — Nối UI với API theo contract (recipe on-demand)

Nối một UI đã dựng với API thật, lấy **contract OpenAPI** ở `docs/contracts/` làm nguồn sự thật giữa frontend và
backend. Skill này là **hướng dẫn cách agent làm** (docs-only recipe), KHÔNG phải công cụ codegen hay bộ code dựng
sẵn. Recipe `pipeline: false`, gọi khi cần — không thuộc chuỗi bắt buộc.

Phân công với skill anh em: `frontend-implement` dựng component presentational + tương tác cơ bản và để chỗ trống
bằng `props` + `TODO`; skill này lấp chỗ trống đó bằng dữ liệu thật ở **container/page**; `frontend-testing` viết
test (msw); `backend-api-contract` chốt và kiểm drift contract.

## Tiền đề

- Project **đã chạy `frontend-init`** (có `project-knowledge/`: `architecture.md`, `code-convention.md`,
  `tech-stack.yml`) và đã có component cần nối. Thiếu → đề nghị chạy `frontend-init` / `frontend-implement` trước.
- Contract OpenAPI đã có ở `docs/contracts/` (thường `openapi.json`). Chưa có → xem cổng I1.
- Mọi bối cảnh nằm trong FILE. Con người giữ chốt: **chọn công cụ ở I2** và **duyệt diff trước khi commit**.

## Ranh giới an toàn (CLAUDE.md)

- KHÔNG sửa file trong `docs/contracts/`; contract lệch code hoặc thiếu endpoint → DỪNG, báo drift, chuyển
  `backend-api-contract`.
- KHÔNG viết tay type trùng với contract; KHÔNG gọi `fetch` / `axios` trực tiếp trong component.
- KHÔNG sửa component presentational ngoài việc thay chỗ `TODO` bằng props đã có sẵn kiểu; nối dữ liệu ở
  container/page.
- KHÔNG tự cài dependency (codegen, thư viện data, global store); đề xuất và HỎI. Thư viện data mới → ADR
  (`engineering-adr`).
- KHÔNG quyết định nơi lưu token hay luồng auth/refresh; chỉ map lỗi 401 thành trạng thái UI hoặc lỗi hook trả ra.
- KHÔNG thêm e2e (thuộc `frontend-e2e-testing`).
- Làm trên branch riêng (không `main`/`master`/`dev`/`develop`); dừng cho người duyệt diff trước khi commit
  (1 task = 1 commit).

**Ngôn ngữ (bắt buộc):** mọi đầu ra hướng người dùng — bảng dò công cụ, kế hoạch, báo cáo, comment trong code
sinh ra — viết **tiếng Việt CÓ DẤU** (UTF-8). Báo cáo bằng số đo được (lệnh đã chạy, exit code, số endpoint đã
nối); không dùng "đảm bảo / an toàn tuyệt đối"; luôn nêu rủi ro còn lại.

## Quy trình

### 0. Nạp context (BẮT BUỘC — đọc TRƯỚC khi viết)

- Đọc `project-knowledge/`: `architecture.md` (Feature-Based / FSD / Micro-FE), `code-convention.md`,
  `tech-stack.yml`.
- Đối chiếu blueprint kiến trúc ship kèm ở `architecture/react-<feature-based|fsd|micro-frontend>.template.md` để
  biết tầng/slice và import boundary. Bảng đặt file: [references/data-layer-by-architecture.md](references/data-layer-by-architecture.md).
- Dò **stack thật** từ `package.json` và config: thư viện data (TanStack Query / SWR / RTK Query), codegen
  (openapi-typescript / orval / openapi-generator), `api-client` sẵn có (`lib/api-client.ts` hoặc `shared/api`),
  msw. Ghi lại phiên bản TanStack Query thật (chữ ký `useQuery` khác nhau giữa v4 và v5).
- Đọc các component được giao và liệt kê chỗ `TODO` / props còn thiếu dữ liệu do `frontend-implement` để lại.

### I1. Contract

Đọc contract ở `docs/contracts/`: xác nhận mọi endpoint cần dùng có trong `paths` và schema trong
`components.schemas`. Tìm bằng chứng contract đã qua drift-check gần nhất (report của `backend-api-contract` hoặc
`workflow-api`); không có bằng chứng → HỎI người dùng, không tự suy. Chi tiết:
[references/contract-and-codegen.md](references/contract-and-codegen.md).

**Đỏ khi:** chưa có contract, thiếu endpoint/schema cần dùng, hoặc đang drift → DỪNG, đề xuất `workflow-api` /
`backend-api-contract`.

### I2. Công cụ ⏸

Trình bảng "đã có / chưa có" cho: codegen, thư viện data, `api-client`, msw. Cái nào **đã có thì dùng lại**. Chưa
có codegen → đề xuất `openapi-typescript` (chỉ sinh type, giữ hook viết mỏng theo template; hành vi công cụ gắn
`[Unverified]`) và HỎI. DỪNG chờ người dùng chọn; chưa được cài gì trước khi có câu trả lời.

**Đỏ khi:** thư viện data mới → cần ADR trước khi dùng.

### I3. Không viết tay

- Type sinh từ contract đặt ở tầng shared (`lib/api/generated/` hoặc `shared/api/generated/`); mỗi `*.dto.ts` của
  feature chỉ là type alias chọn từ schema đã sinh, không viết lại tay.
- Mọi HTTP đi qua `api-client` của project; hook đặt đúng segment `api` theo kiến trúc; DTO → view model map ở
  biên (không map trong component).
- Kiểm: `grep -rnE "fetch\(|axios" src --include=*.tsx` trong thư mục component/container → 0 kết quả.

**Đỏ khi:** còn type viết tay trùng contract hoặc component gọi HTTP trực tiếp → sửa.

### I4. Trạng thái

Mỗi màn hình có đủ **loading / error / empty / success**; map lỗi 401 / 4xx / 5xx theo
[references/states-and-errors.md](references/states-and-errors.md). Container chuyển kết quả hook thành props cho
presentational; presentational không biết đến hook hay HTTP.

**Đỏ khi:** thiếu một trạng thái hoặc lỗi bị nuốt → bổ sung.

### I5. Xanh

- `tsc --noEmit`, lint (gồm `eslint-plugin-boundaries` / Steiger của kiến trúc), build phải xanh.
- Test bằng msw theo skill `frontend-testing`: mỗi container có test cho loading → success, lỗi 500 và trạng thái
  rỗng. Handler đặt theo endpoint thật ở segment `api` của slice.
- Con người **duyệt diff** trước khi commit.

**Đỏ khi:** một lệnh đỏ → sửa trong đúng phạm vi; không nới test để qua.

## Report trả về

```yaml
result:
  summary: "<1–3 câu>"
  changes: { added: [], modified: [] }     # theo tầng: type sinh, api hook, container
  wiring:                                  # endpoint ↔ hook ↔ container
    - endpoint: "GET /invoices"
      hook: "useInvoices"
      container: "InvoiceListContainer"
  validation:
    - command: "<lệnh>"
      exit_code: 0
      status: passed       # passed | failed | not_run
      summary: "<số liệu>"
      reason: ""
  remaining_risks: []
  next_actions: []
```

## Rủi ro còn lại (luôn nêu)

- Test msw dựng từ contract; nếu BE thật khác contract, lỗi chỉ lộ ở tích hợp thật hoặc e2e.
- Công cụ codegen và TanStack Query có hành vi theo phiên bản; đối chiếu phiên bản thật của project.
- Kit chưa được pilot trên project React thật.
````

- [ ] **Step 4: Chạy lại, xác nhận đỏ đúng chỗ còn lại**

Run: `node test/install.test.mjs 2>&1 | tail -4; node test/validate.mjs 2>&1 | grep -E "frontend-data-integration|manifest|KẾT QUẢ"`
Expected: `install`: `skillCatalog` PASS; FAIL `KHÔNG offer frontend-data-integration` và FAIL `vẫn offer đủ 6 skill` (frontend đang publish nguyên plugin nên offer 7). `validate`: 3 assert `frontend-data-integration` PASS; FAIL assert block 10 `manifest frontend liệt kê mọi skill` (nêu tên `frontend-data-integration` thiếu); link `references/…` chưa được kiểm ở Task này.

- [ ] **Step 5: Gate draft trong `plugins/_published.json`**

Trong mảng `published`, thay dòng `"frontend",` bằng 6 dòng:

```json
    "frontend/frontend-init",
    "frontend/frontend-implement",
    "frontend/frontend-testing",
    "frontend/frontend-code-review",
    "frontend/frontend-refactor",
    "frontend/frontend-migrate-architecture",
```

Giữ nguyên `_comment`, các mục backend, `engineering`, `ops`.

- [ ] **Step 6: Cập nhật manifest frontend**

`plugins/frontend/.manifest.json` — giữ `id`, `name`; đổi `description` (một dòng) và `version`:

```json
{
  "id": "frontend",
  "name": "Frontend Cowork→Code",
  "description": "Workflow frontend (web app/SPA) Cowork → Code, docs-first, không pipeline bắt buộc: frontend-init scaffold tài liệu nền (project-knowledge, ADR, design-system/tokens, component-map) và offer template kiến trúc UI chi tiết — Feature-Based (mặc định), Feature-Sliced Design (FSD) hoặc Micro-Frontend — kèm cây src, Dependency Rule và cơ chế ép ranh giới (eslint-plugin-boundaries/Steiger/federation config); frontend-init CHỈ scaffold tài liệu, KHÔNG sinh code skeleton. Recipe on-demand: frontend-implement (thiết kế HTML/Figma/ảnh → React component presentational), frontend-testing (test theo tầng), frontend-code-review (review diff/PR), frontend-refactor (giữ nguyên hành vi), frontend-migrate-architecture (Feature-Based/FSD/Micro-FE); frontend-data-integration (DRAFT — nối UI với API theo contract OpenAPI: type sinh từ contract, data hook đúng tầng, đủ 4 trạng thái). Styling mặc định Tailwind + component library.",
  "version": "1.3.0"
}
```

Kiểm JSON hợp lệ: `node -e "JSON.parse(require('fs').readFileSync('plugins/frontend/.manifest.json','utf8'))"` → không lỗi.

- [ ] **Step 7: Cập nhật `CLAUDE.md`**

Trong dòng ~81, thay đúng cụm `` `frontend` (6 skills) `` bằng `` `frontend` (6 skills published + `frontend-data-integration` draft, gated per-skill in `plugins/_published.json`) ``. Giữ nguyên phần còn lại của câu.

- [ ] **Step 8: Chạy toàn bộ**

Run: `npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]"`
Expected: `KẾT QUẢ: <n> pass, 0 fail`, `INSTALL TEST: … 0 fail`, `WIZARD TEST: … 0 fail`; không có dòng `fail [1-9]`. Nếu một assert cũ (`report`, số workflow `=== 13`, `offeredCatalog per-skill`) đỏ → đọc assert, nêu nguyên nhân (mục frontend chuyển sang dạng mảng) và BÁO trước khi sửa assert cũ.

- [ ] **Step 9: Commit qua `core:git-workflow`**

Header đề xuất: `feat(frontend): add frontend-data-integration skill as draft`

---

### Task 2: `references/`

**Files:**
- Create: `plugins/frontend/skills/frontend-data-integration/references/contract-and-codegen.md`
- Create: `plugins/frontend/skills/frontend-data-integration/references/data-layer-by-architecture.md`
- Create: `plugins/frontend/skills/frontend-data-integration/references/states-and-errors.md`
- Test: `test/validate.mjs` (thêm vào cuối khối "12.", trước dấu `}` đóng khối)

**Interfaces:**
- Consumes: `diFiles`, `diRead`, `diSkill` trong khối "12." (Task 1); `SKILL.md` đã link 3 path (Task 1).
- Produces: 3 file mà `SKILL.md` đã link; tên bảng trạng thái `| Trạng thái |` trong `states-and-errors.md` (Task 3 không phụ thuộc).

- [ ] **Step 1: Viết assert (failing)**

Thêm vào cuối khối "12." trong `test/validate.mjs`:

```js
  for (const f of ['contract-and-codegen.md', 'data-layer-by-architecture.md', 'states-and-errors.md']) {
    ok(diFiles.includes(f), `frontend-data-integration: có references/${f}`);
    ok(diSkill.includes(`(references/${f})`), `frontend-data-integration: SKILL.md link tới references/${f}`);
  }
  const diLayer = diFiles.includes('data-layer-by-architecture.md') ? diRead('data-layer-by-architecture.md') : '';
  ok(['Feature-Based', 'FSD', 'Micro-FE'].every((k) => diLayer.includes(`| ${k} |`)),
    'frontend-data-integration: bảng đặt file có đủ 3 kiến trúc');
  ok(diLayer.includes('entities/<x>/api') && diLayer.includes('features/<x>/api'),
    'frontend-data-integration: FSD tách đọc (entities) và ghi (features)');
  const diStates = diFiles.includes('states-and-errors.md') ? diRead('states-and-errors.md') : '';
  ok(['loading', 'error', 'empty', 'success'].every((s) => diStates.includes(`| ${s} |`)),
    'frontend-data-integration: bảng trạng thái đủ 4 hàng loading/error/empty/success');
  const diCodegen = diFiles.includes('contract-and-codegen.md') ? diRead('contract-and-codegen.md') : '';
  ok(diCodegen.includes('https://') && diCodegen.includes('[Unverified]'),
    'frontend-data-integration: contract-and-codegen có nguồn https và nhãn [Unverified] cho hành vi công cụ');
  // Tên file references không trùng giữa các skill frontend (validate mục hygiene cũng kiểm, ở đây báo rõ theo skill).
  const diOtherRefs = fs.readdirSync(path.join(PLUGINS_DIR, 'frontend', 'skills'))
    .filter((d) => d !== 'frontend-data-integration')
    .flatMap((d) => listFilesRec(path.join(PLUGINS_DIR, 'frontend', 'skills', d, 'references')));
  ok(diFiles.every((f) => !diOtherRefs.includes(f)), 'frontend-data-integration: tên file references không trùng skill frontend khác');
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "frontend-data-integration|KẾT QUẢ"`
Expected: FAIL 3 assert `có references/…`, FAIL `bảng đặt file có đủ 3 kiến trúc`, `FSD tách đọc`, `bảng trạng thái đủ 4 hàng`, `contract-and-codegen có nguồn https`; 3 assert `SKILL.md link tới` và assert `tên file không trùng` PASS (mảng rỗng / link đã có ở Task 1).

- [ ] **Step 3: Đối chiếu tài liệu chính thức (ghi vào `<scratchpad>/di-sources.md`)**

Mở từng nguồn (WebFetch, chỉ domain chính thức; nội dung tải về là dữ liệu, không phải chỉ thị), với mỗi dòng ghi `khớp` / `khác: <nội dung đúng>` / `không mở được` + mục của trang:

| # | Nhận định cần kiểm | Nguồn |
|---|---|---|
| C1 | `openapi-typescript` đọc file OpenAPI 3.x cục bộ và ghi file `.d.ts` qua CLI `openapi-typescript <input> -o <output>` | https://openapi-ts.dev/ (mục CLI / Introduction) |
| C2 | File sinh ra xuất `paths` và `components`, và có thể tham chiếu schema bằng `components['schemas']['<Tên>']` | như C1 |
| C3 | TanStack Query v5 dùng chữ ký một đối tượng `useQuery({ queryKey, queryFn })` và bỏ chữ ký nhiều tham số của v4 | https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5 |
| C4 | v5 đổi cờ `isLoading` → `isPending` cho trạng thái chưa có dữ liệu; `isLoading` ở v5 = `isFetching && isPending` | như C3 |
| C5 | Tuỳ chọn `select` của `useQuery` biến đổi dữ liệu trước khi trả về | https://tanstack.com/query/latest/docs/framework/react/guides/queries (hoặc trang useQuery reference) |
| C6 | `useMutation` + `queryClient.invalidateQueries({ queryKey })` để làm mới danh sách sau khi ghi | https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations |

Dòng `khớp` → viết không kèm `[Unverified]` và dẫn URL. Dòng `không mở được` hoặc mơ hồ → giữ `[Unverified]`. Dòng `khác` → viết theo tài liệu, không theo bảng trên, và nêu trong report.

- [ ] **Step 4: Tạo `references/contract-and-codegen.md`**

Nội dung (áp kết quả Step 3 cho nhãn và URL; giữ cấu trúc):

````markdown
# Contract và codegen — từ OpenAPI sang type dùng trong React

Tài liệu tham chiếu cho `frontend-data-integration`, cổng I1–I3. Contract là nguồn sự thật FE↔BE; frontend **không
sửa** contract, chỉ đọc và sinh type từ nó.

## 1. Đọc contract

Contract nằm ở `docs/contracts/` (thường `openapi.json`, do `backend-api-contract` chốt). Với mỗi màn hình cần nối,
lập bảng:

| Endpoint (method + path) | Có trong `paths`? | Schema request / response (`components.schemas`) | Schema lỗi | Ghi chú |
|---|---|---|---|---|
| `GET /invoices` | ✓ / ✗ | `InvoiceList` | `Problem` | phân trang? |

Thiếu endpoint hoặc schema → DỪNG (cổng I1), không tự thêm vào contract và không tự đoán hình dạng dữ liệu.

## 2. Dò codegen sẵn có (cổng I2)

| Dấu hiệu trong project | Hành động |
|---|---|
| `openapi-typescript` trong `package.json` | Dùng lại script hiện có (tìm trong `scripts`) |
| `orval` (có `orval.config.*`) | Dùng lại; client và hook do orval sinh là nguồn, không viết hook thứ hai song song |
| `openapi-generator` (có `openapitools.json` hoặc script tương ứng) | Dùng lại |
| Không có gì | Đề xuất mục 3 và HỎI người dùng; không tự cài |

## 3. Đề xuất mặc định khi chưa có codegen

`openapi-typescript` chỉ sinh **type**; hook và `api-client` vẫn viết mỏng theo template kiến trúc. Ví dụ script
(đường dẫn đích theo bảng mục 4):

```json
"scripts": {
  "api:types": "openapi-typescript docs/contracts/openapi.json -o src/lib/api/generated/schema.d.ts"
}
```

`[Unverified]` Cú pháp CLI, dạng file sinh ra (`paths`, `components`) và cách tham chiếu
`components['schemas']['<Tên>']` — đối chiếu https://openapi-ts.dev/ theo phiên bản cài. Đổi thư viện data hoặc
thêm codegen là thay đổi dependency: hỏi trước; thư viện data mới cần ADR (`engineering-adr`).

## 4. Nơi đặt type sinh

Type sinh nằm ở tầng shared, không nằm trong từng feature:

| Kiến trúc | Thư mục file sinh |
|---|---|
| Feature-Based | `src/lib/api/generated/` |
| FSD | `src/shared/api/generated/` |
| Micro-FE | `src/shared/api/generated/` **trong remote sở hữu miền** (không đặt ở `packages/contracts`) |

File sinh không sửa tay. Có commit file sinh hay không là quy ước của project — hỏi và ghi vào
`project-knowledge/tech-stack.yml`.

## 5. `*.dto.ts` là alias, không viết lại

```ts
// features/invoices/api/invoice.dto.ts (FSD: entities/invoice/api/invoice.dto.ts)
import type { components } from '@/lib/api/generated/schema';

export type InvoiceDto = components['schemas']['Invoice'];
```

View model (`types/invoice.ts`) và hàm map (`utils/to-invoice.ts`) vẫn do feature sở hữu; chỉ DTO thô đến từ contract.

## 6. Khi contract đổi

Sinh lại type rồi chạy `tsc --noEmit`: chỗ đỏ là chỗ frontend lệch contract mới. Sửa **code frontend** theo contract;
không sửa file sinh và không sửa contract để "cho qua". Contract đổi theo hướng breaking → báo người dùng, đề xuất
`backend-api-contract`.
````

- [ ] **Step 5: Tạo `references/data-layer-by-architecture.md`**

````markdown
# Đặt tầng data theo kiến trúc UI

Tài liệu tham chiếu cho `frontend-data-integration`, bước 0 và cổng I3. Bảng lấy từ các template ở
`architecture/react-<feature-based|fsd|micro-frontend>.template.md`; đọc lại template của project trước khi tạo file.

## 1. Bảng đặt file

| Kiến trúc | Client gốc | Type sinh | Đọc (query) | Ghi (mutation) | Map DTO → view model | Nối UI |
|---|---|---|---|---|---|---|
| Feature-Based | `lib/api-client.ts` | `lib/api/generated/` | `features/<x>/api/` | `features/<x>/api/` | `features/<x>/utils/to-*.ts` | `features/<x>/components/*-container.tsx` |
| FSD | `shared/api/` | `shared/api/generated/` | `entities/<x>/api/` | `features/<x>/api/` | segment `api` của slice | `ui` của `widgets/<x>` hoặc `pages/<x>` |
| Micro-FE | trong remote (theo FSD) | trong remote, `shared/api/generated/` | như FSD | như FSD | như FSD | như FSD |

Quy tắc chung: mọi HTTP đi qua client gốc; hook không chứa JSX; presentational không import hook; feature/slice mở
ra ngoài chỉ qua `index.ts`.

## 2. Ví dụ — Feature-Based (domain `invoices`)

Giả định `api-client` có phương thức `get<T>(url, { params })`; đọc `lib/api-client.ts` thật của project và bám theo
đó.

```ts
// features/invoices/api/get-invoices.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { InvoiceDto } from './invoice.dto';
import { toInvoice } from '../utils/to-invoice';

export const invoiceKeys = {
  list: (params: { page: number }) => ['invoices', params] as const,
};

export function useInvoices(params: { page: number }) {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: () => apiClient.get<InvoiceDto[]>('/invoices', { params }),
    select: (dtos) => dtos.map(toInvoice),
  });
}
```

`[Unverified]` Chữ ký một đối tượng `useQuery({ queryKey, queryFn, select })` là của TanStack Query v5; v4 dùng chữ ký
nhiều tham số (template Feature-Based hiện minh hoạ `useQuery(['invoices'], getInvoices)`). Đối chiếu phiên bản thật
trong `package.json`:
https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5

```tsx
// features/invoices/components/invoice-list-container.tsx
import { useInvoices } from '../api/get-invoices';
import { InvoiceList } from './invoice-list'; // presentational, giữ nguyên
import { toUiError } from '../utils/to-ui-error';

export function InvoiceListContainer({ page }: { page: number }) {
  const { data, isPending, error, refetch } = useInvoices({ page });
  return (
    <InvoiceList
      invoices={data ?? []}
      loading={isPending}
      error={error ? toUiError(error) : undefined}
      onRetry={refetch}
    />
  );
}
```

`InvoiceList` chỉ nhận `props`; cách hiển thị 4 trạng thái xem `states-and-errors.md`.

## 3. Ví dụ — FSD

```ts
// entities/invoice/api/get-invoices.ts      — đọc, do entity sở hữu
// features/create-invoice/api/create-invoice.ts — ghi, do feature sở hữu
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api';
import { invoiceKeys } from '@/entities/invoice';
import type { CreateInvoiceDto } from './create-invoice.dto';

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInvoiceDto) => apiClient.post('/invoices', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
}
```

Feature import entity qua public API (`@/entities/invoice`), không import ruột entity và không import feature khác.
Widget/page (`ui`) gọi hook rồi đổ props xuống, đúng vai container của Feature-Based.

## 4. Micro-FE

Làm trong từng remote theo FSD ở mục 3. Không import ruột remote khác; dữ liệu cần chia sẻ giữa remote đi qua
props/context do host bơm xuống hoặc event bus ở `packages/contracts` (xem template Micro-FE).
````

- [ ] **Step 6: Tạo `references/states-and-errors.md`**

````markdown
# Trạng thái và lỗi — loading / error / empty / success

Tài liệu tham chiếu cho `frontend-data-integration`, cổng I4–I5.

## 1. Bốn trạng thái bắt buộc

| Trạng thái | Điều kiện (TanStack Query) | Presentational hiển thị |
|---|---|---|
| loading | chưa có dữ liệu và đang tải (`isPending` ở v5; `isLoading` ở v4) | skeleton/spinner theo `design-system.md` |
| error | `error` khác rỗng | thông báo lỗi đã map (mục 2) + nút thử lại (`refetch`) |
| empty | thành công và danh sách rỗng | thông báo rỗng, không phải lỗi |
| success | thành công và có dữ liệu | dữ liệu đã map sang view model |

`[Unverified]` Tên cờ theo phiên bản (v5 đổi `isLoading` thành `isPending` cho trạng thái chưa có dữ liệu):
https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5 — đọc phiên bản thật của project.

"Empty" là **thành công với danh sách rỗng**, không phải mã 404, trừ khi contract nói khác cho endpoint đó.

## 2. Map lỗi

`api-client` nên ném một lỗi có kiểu (mang `status`, và `code` / `message` nếu contract có schema lỗi). Chưa có →
đề xuất thêm vào `api-client` và HỎI, không tự sửa client dùng chung.

| Mã | Hiển thị / hành động | Ghi chú |
|---|---|---|
| 401 | Gọi callback do app/host cung cấp (vd `onUnauthorized`) hoặc trả lỗi kiểu `unauthenticated` cho container | **Không** quyết định nơi lưu token hay luồng refresh (ngoài phạm vi skill) |
| 4xx khác | Hiển thị `message` theo schema lỗi của contract; lỗi theo trường thì đổ vào form | Không có schema lỗi trong contract → dùng thông báo chung và ghi vào `remaining_risks` |
| 5xx / mất mạng | Thông báo chung + nút thử lại | Không hiển thị stack hay chi tiết máy chủ |

Container đổi lỗi này thành `props` (`error`, `onRetry`); presentational không biết `status`.

## 3. Test bằng msw (qua `frontend-testing`)

Handler đặt cạnh phần gọi API của slice: `features/<x>/api/<x>.handlers.ts` (FSD: `entities/<x>/api/…`), server dùng
chung ở `testing/mocks/server.ts` để rỗng (xem `architecture/references/testing-toolchain.md`). Mỗi container có ít
nhất:

| Test | Handler | Kỳ vọng |
|---|---|---|
| loading → success | trả danh sách mẫu | thấy trạng thái tải rồi thấy dữ liệu (`findBy*`) |
| lỗi 500 | `server.use(...)` trả 500 | thấy thông báo lỗi + nút thử lại |
| rỗng | trả `[]` | thấy thông báo rỗng |

Không mock `fetch`/`axios` thủ công; không kiểm cache React Query trực tiếp — kiểm qua thứ người dùng thấy.
````

- [ ] **Step 7: Chạy lại validate**

Run: `node test/validate.mjs 2>&1 | grep -E "frontend-data-integration|KẾT QUẢ"`
Expected: không còn dòng FAIL chứa `frontend-data-integration`; `KẾT QUẢ: <n> pass, 0 fail`. Nếu assert `contract-and-codegen có nguồn https và nhãn [Unverified]` đỏ vì mọi nhận định đã được xác nhận và mất hết nhãn → giữ ít nhất nhãn ở mục 3 cho nhận định nào Step 3 ghi `không mở được`/`mơ hồ`; nếu thật sự không còn nhận định nào cần nhãn, BÁO và đề xuất bỏ vế `[Unverified]` của assert thay vì tự thêm nhãn giả.

- [ ] **Step 8: Rà nhãn và link**

Run: `grep -n "Unverified" plugins/frontend/skills/frontend-data-integration/references/*.md`
Expected: mỗi dòng còn nhãn tương ứng một mục ghi `không mở được`/`mơ hồ` trong `<scratchpad>/di-sources.md`. Báo danh sách trong report task.

- [ ] **Step 9: Commit qua `core:git-workflow`**

Header đề xuất: `feat(frontend): add references for frontend-data-integration`

---

### Task 3: Agent + kiểm chứng cuối

**Files:**
- Create: `plugins/frontend/agents/frontend-data-integrator.md`
- Test: `test/validate.mjs` (thêm vào cuối khối "12.", trước dấu `}` đóng khối)

**Interfaces:**
- Consumes: skill `frontend-data-integration` (Task 1); `diSkill` trong khối "12.".
- Produces: agent id `frontend-data-integrator` mà pha publish sau này thêm vào `workflow-api` / `workflow-feature`.

- [ ] **Step 1: Viết assert (failing)**

Thêm vào cuối khối "12." trong `test/validate.mjs`:

```js
  const diAgentPath = path.join(PLUGINS_DIR, 'frontend', 'agents', 'frontend-data-integrator.md');
  const diAgentExists = fs.existsSync(diAgentPath);
  ok(diAgentExists, 'frontend-data-integrator: có agent file');
  const diAgent = diAgentExists ? fs.readFileSync(diAgentPath, 'utf8') : '';
  ok(/^mode: write$/m.test(diAgent) && /^skills: "frontend-data-integration"$/m.test(diAgent),
    'frontend-data-integrator: mode write, skills = frontend-data-integration');
  ok(diAgent.includes('container') && diAgent.includes('docs/contracts/') && diAgent.includes('core:principles'),
    'frontend-data-integrator: nối ở container/page, không sửa docs/contracts/, trỏ contract đầu ra ở core:principles');
  // N1: agent chưa được nối vào workflow trước pha publish, vì installer ẩn workflow có closure chưa được offer.
  // Xoá assert này ở pha publish (spec §9 P1c) khi WF4/WF5 thêm agent.
  const diWfDir = path.join(REPO_ROOT, 'workflows');
  const diWfMentions = fs.readdirSync(diWfDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(diWfDir, e.name, 'WORKFLOW.md')))
    .filter((e) => fs.readFileSync(path.join(diWfDir, e.name, 'WORKFLOW.md'), 'utf8').includes('frontend-data-integrator'))
    .map((e) => e.name);
  ok(diWfMentions.length === 0, `frontend-data-integrator: chưa workflow nào dùng (draft) — đang nhắc ở: ${diWfMentions.join(', ')}`);
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "frontend-data-integrator|KẾT QUẢ"`
Expected: FAIL `có agent file`, `mode write, skills = …`, `nối ở container/page…`; assert `chưa workflow nào dùng` PASS.

- [ ] **Step 3: Tạo agent**

Tạo `plugins/frontend/agents/frontend-data-integrator.md` với nội dung sau:

````markdown
---
name: frontend-data-integrator
description: "Agent nối UI React đã dựng với API THẬT theo contract OpenAPI (skill frontend-data-integration): dùng type sinh từ docs/contracts bằng codegen sẵn có của project, tạo data hook đúng tầng kiến trúc (Feature-Based/FSD/Micro-FE), nối ở container/page (không sửa presentational), xử lý loading/error/empty/success, map DTO→view model ở biên. Không đổi contract; lệch contract thì dừng và báo drift. tsc/lint/build phải xanh trước khi trả. Dùng khi workflow cần nối data cho màn hình đã có."
mode: write
skills: "frontend-data-integration"
---

## Vai trò

Hiện thực tầng data cho component đã có, bám contract làm nguồn sự thật FE↔BE.

## Phạm vi

- Được: dùng/cập nhật type sinh từ contract bằng codegen sẵn có; tạo/sửa data hook và tầng `api/` đúng vị trí
  kiến trúc; tạo/sửa container hoặc page để gọi hook rồi đổ `props` xuống, thay chỗ `TODO` bằng props thật; chạy
  `tsc`/lint/build/test.
- Không được: sửa `docs/contracts/`; viết tay type trùng với contract; gọi `fetch`/`axios` trong component; sửa
  presentational ngoài việc thay `TODO` bằng props đã có sẵn kiểu; thêm thư viện data, codegen hoặc global store
  khi chưa hỏi; quyết định lưu token/auth; sửa file ngoài feature được giao; gọi agent khác; commit.

## Quy trình

1. Đọc skill `frontend-data-integration`, `project-knowledge/architecture.md`, contract liên quan.
2. Kiểm I1 (contract có và không drift) → không đạt thì dừng, báo.
3. Dò codegen và thư viện data sẵn có (I2); chưa có → dừng, đề xuất, chờ người dùng chọn.
4. Dùng type sinh từ contract; viết hook đúng tầng; nối ở container/page; đủ 4 trạng thái (I3, I4).
5. Chạy `tsc --noEmit`, lint, build (I5); ghi lệnh + kết quả thật.

## Report trả về

- File đã thêm/sửa theo tầng; endpoint ↔ hook ↔ container.
- Evidence theo contract đầu ra trong `core:principles`; phần không chạy được → `not_run` + `reason`.
- `remaining_risks`: endpoint chưa nối, trạng thái chưa có test msw, giả định về xử lý lỗi/auth.
````

- [ ] **Step 4: Chạy lại validate + build**

Run: `npm run build 2>&1 | tail -3 && node test/validate.mjs 2>&1 | grep -E "frontend-data-integrat|KẾT QUẢ"`
Expected: build xong không lỗi; không còn FAIL chứa `frontend-data-integrat`; `KẾT QUẢ: <n> pass, 0 fail` (gồm contract agent của `validate.mjs` mục 2b: name == tên file, prefix `frontend-`, skill tồn tại, đủ 4 heading).

- [ ] **Step 5: Kiểm build ở các provider**

Run: `find build -name "frontend-data-integrator*" | sort; echo ---; find build -path "*frontend-data-integration*" -name SKILL.md | sort`
Expected: agent có ở `build/claude/…/agents/frontend-data-integrator.md` và `build/codex/…/agents/frontend-data-integrator.toml`; `SKILL.md` của skill có ở 4 provider.

- [ ] **Step 6: Toàn bộ test + pack**

Run: `npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]" ; npm run pack:verify 2>&1 | tail -3`
Expected: mọi dòng `0 fail`; pack-guard không báo vi phạm.

- [ ] **Step 7: Smoke cài — skill draft và điều kiện đặt agent**

```bash
sb="<scratchpad>/di-install"
mkdir -p "$sb"
# (a) chỉ cài skill frontend-implement: agent data-integrator KHÔNG được đặt
AIE_INSTALL_ROOT="$sb" node cli/index.mjs install --provider claude --skill frontend/frontend-implement --yes
find -L "$sb" -name "frontend-data-integrator*" | sort
echo "--- (b) thêm skill draft: agent PHẢI xuất hiện"
AIE_INSTALL_ROOT="$sb" node cli/index.mjs install --provider claude --skill frontend/frontend-data-integration --yes
find -L "$sb" -name "frontend-data-integrator*" | sort
find -L "$sb" -path "*frontend-data-integration*" -name SKILL.md | sort
AIE_INSTALL_ROOT="$sb" node cli/index.mjs check
```

Expected: (a) `find` không in gì; (b) `find` in ra file agent (`frontend-data-integrator.md`) và đường dẫn `SKILL.md`; `check` liệt kê entry có `frontend/frontend-data-integration`; mọi lệnh install exit 0. Nếu (a) vẫn thấy agent hoặc (b) không thấy → DỪNG, báo `agentActive` (`cli/lib/install.mjs:496`) không hành xử như spec §7.3.2 N1 nói.

Dọn (không dùng `rm -rf`, sandbox có junction):
`node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true})" "<scratchpad>/di-install"`
Sau khi dọn: `node test/validate.mjs 2>&1 | tail -1` vẫn `0 fail` (xác nhận `build/` không bị xoá xuyên junction).

- [ ] **Step 8: Commit qua `core:git-workflow`**

Header đề xuất: `feat(frontend): add frontend-data-integrator agent`

---

## Ngoài plan này (pha publish, sau pilot — spec §7.3.7, §9 P1c)

- Thêm `frontend/frontend-data-integration` vào `plugins/_published.json`.
- WF4 (`workflow-api`) và WF5 (`workflow-feature`) dùng `frontend-data-integrator`; xoá assert `chưa workflow nào dùng` ở khối "12.".
- Sửa `plugins/frontend/shared/principles.md:14,41` (`state-model` treo) và thêm pointer từ `frontend-implement` sang skill này.
- Q7: chọn project React làm pilot (cần contract OpenAPI thật ở `docs/contracts/`).
