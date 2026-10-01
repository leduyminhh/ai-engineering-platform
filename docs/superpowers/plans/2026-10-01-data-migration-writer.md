# Data Migration Writer (P1b, S8, WF3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `data/data-db-migration`, thêm agent `data-migration-writer` (plugin `data`, chỉ viết file migration mới), rồi nối `workflow-db-change` Bước 2/3/6 theo skill và agent; sửa S8 và docs.

**Architecture:** Nội dung canonical ở `plugins/data/…`, `plugins/backend/…`, `workflows/db-change/WORKFLOW.md`; hợp đồng kiểm bằng assert chuỗi trong `test/validate.mjs` (khối `// 22.` mới ở cuối file). Wizard ẩn workflow có closure chưa publish (`cli/lib/install.mjs:355`) → thứ tự bắt buộc: **publish → agent → nối workflow**.

**Tech Stack:** Node.js 20+, ESM, zero dependency. `node test/validate.mjs`, `npm test`, `npm run build`.

**Spec:** [`docs/superpowers/specs/2026-10-01-data-migration-writer-design.md`](../specs/2026-10-01-data-migration-writer-design.md)

## Global Constraints

- File UTF-8 **không BOM**, LF; nội dung tiếng Việt có dấu; frontmatter/identifier tiếng Anh; wrap ~110 cột (đo ký tự Unicode).
- Agent: `name: data-migration-writer`, `mode: write`, `skills: "data-db-migration"`, đủ 4 heading `## Vai trò`, `## Phạm vi`, `## Quy trình`, `## Report trả về`. File ở `plugins/data/agents/` (thư mục mới).
- `workflow-db-change` giữ **9 bước**; ⏸ ở Bước 2, 5, 9; không đánh số lại. Trường `- **Thực hiện:**` có thể xuống dòng (`stepRefs` đọc trọn trường).
- **Kiểm tra hợp đồng workflow:** một agent id nêu trong `**Hành động:**` phải nằm trong `**Thực hiện:**` của cùng bước (`test/validate.mjs:~327`). Vì vậy KHÔNG ghi `data-migration-writer` trong Hành động của Bước 2, 6, 8 (chỉ Bước 3 có agent trong Thực hiện). Skill nêu trong `Thực hiện` phải có trong `requires` hoặc skill của agent.
- Commit qua `core:git-workflow`: header tiếng Anh, body tiếng Việt (Changed/Reason, **không dùng dấu `?`**), message ghi ra file UTF-8 rồi `git commit -F`. **Không `Co-Authored-By`.** Không push.
- Nhánh: `feature/data-migration-writer` (cắt từ nhánh chứa spec, xem Task 0).
- Dọn sandbox bằng Node `fs.rmSync`, không `rm -rf` (junction Windows).

## Review Focus

1. **Nối workflow trước publish** → wizard ẩn `workflow-db-change` lặng lẽ. Task 1 publish trước; Task 3 assert `offeredCatalog` vẫn chứa workflow và kiểm có răng.
2. **Agent ghi vào file migration đã có** (mất tính bất biến). Task 2/3 assert Phạm vi/Gate nêu "file migration đã có" bị cấm sửa.
3. **Agent kết nối DB/chạy migration.** Task 2 assert Phạm vi cấm "kết nối DB" và "chạy migration".
4. **`data-principles` mô tả sai đối tượng** khi `data-db-migration` được cài riêng. Task 1 thêm đoạn nêu rõ và assert.
5. **Assert "plugin data là draft" cũ** làm đỏ sau publish. Task 1 sửa `test/install.test.mjs`.

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/_published.json`, `plugins/_cowork.json`, `plugins/data/.manifest.json`, `plugins/data/shared/principles.md` | Publish + principles | 1 |
| `test/install.test.mjs` (~dòng 156, 161-162, 181-187) | Bỏ assert "data là draft" | 1 |
| `test/validate.mjs` (khối `// 22.` mới cuối file) | Assert đợt này | 1–4 |
| `plugins/data/agents/data-migration-writer.md` | Agent | 2 |
| `workflows/db-change/WORKFLOW.md` | Bước 2/3/6/8, frontmatter, tiền điều kiện, bảng lỗi | 3 |
| `plugins/backend/skills/backend-implement/SKILL.md` (~:78, ~:89) | S8 | 4 |
| `README.md`, `README_VI.md`, `CLAUDE.md`, spec 2026-09-29, ADR-0001 | Docs | 4 |
| `test/validate.mjs` khối 20 (assert heading `### Agents (16)`) | Thay bằng khối 22 | 4 |

---

### Task 0: Nhánh

- [ ] `git checkout docs/data-and-frontend-perf-specs && git checkout -b feature/data-migration-writer`; `npm test` xanh (mốc validate 1955/0, install 209, wizard 64).

---

### Task 1: Publish `data-db-migration` + principles + mở khối 22

**Files:** Modify `plugins/_published.json`, `plugins/_cowork.json`, `plugins/data/.manifest.json`, `plugins/data/shared/principles.md`, `test/install.test.mjs`, `test/validate.mjs`.

**Interfaces — Produces:** khối 22 với helper `flat22(t)`, `wf22(id)`, `step22(wf, n)`, `field22(body, name)` (cắt thân bước thô từ dòng cột 0 `- **<name>:**` tới dòng cột 0 `- **` kế tiếp, flatten, GỒM nhãn; không thấy → `''`), dùng ở Task 2–4.

- [ ] **Step 1: Mở khối 22 + assert publish (đỏ)** — thêm cuối `test/validate.mjs`, SAU `}` đóng khối 21, TRƯỚC dòng `// ───…` + `console.log('')`:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 22. SOURCE: publish data-db-migration + agent data-migration-writer + workflow-db-change (spec 2026-10-01-data-migration-writer-design)
{
  const flat22 = (t) => t.replace(/\s+/g, ' ');
  const wf22 = (id) => workflows.stages.find((s) => s.id === id);
  const step22 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { title: '', body: '', checkpoint: false };
  // Cắt đúng một trường cột 0 để assert không khớp nhầm chữ của trường khác trong cùng bước.
  const field22 = (body, name) => {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lines = body.split('\n');
    const i = lines.findIndex((l) => new RegExp(`^- \\*\\*${esc}:\\*\\*`).test(l));
    if (i < 0) return '';
    let j = lines.findIndex((l, k) => k > i && /^- \*\*/.test(l));
    if (j < 0) j = lines.length;
    return flat22(lines.slice(i, j).join('\n'));
  };
  const pub22 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_published.json'), 'utf8')).published;
  ok(pub22.includes('data/data-db-migration'), '_published.json: có data/data-db-migration (publish không chờ pilot, publish trước khi nối workflow)');
  ok(!pub22.some((e) => /^data\/data-(oltp|olap)/.test(e)), '_published.json: 4 skill data-oltp/olap vẫn draft');
  const cowork22 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_cowork.json'), 'utf8')).skills;
  ok(cowork22.includes('data:data-db-migration'), '_cowork.json: có data:data-db-migration');
  const dataMan22 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, 'data', '.manifest.json'), 'utf8'));
  ok(dataMan22.version === '1.3.0' && !dataMan22.description.includes('DRAFT') && dataMan22.description.includes('data-db-migration'),
    'data manifest: version 1.3.0, description nêu data-db-migration và không còn nhãn DRAFT');
  const dataPr22 = fs.readFileSync(path.join(PLUGINS_DIR, 'data', 'shared', 'principles.md'), 'utf8');
  ok(dataPr22.includes('data-db-migration') && flat22(dataPr22).includes('project backend'),
    'data principles: nêu data-db-migration phục vụ project backend có DB riêng của app (không thuộc nhánh OLTP/OLAP)');
  const offData22 = offeredCatalog().plugins.find((p) => p.id === 'data');
  ok(!!offData22 && offData22.skillIds.includes('data/data-db-migration') && !offData22.skillIds.some((s) => /data-(oltp|olap)/.test(s)),
    'offeredCatalog: plugin data chỉ offer data/data-db-migration');
}
```

- [ ] **Step 2:** `node test/validate.mjs` → đỏ đúng 6 dòng trên (`_published.json …`×1 chính + draft assert có thể xanh sẵn; ghi lại các dòng đỏ thực tế).

- [ ] **Step 3: `plugins/_published.json`** — thêm `"data/data-db-migration",` ngay sau mục `frontend/…` cuối cùng và trước `"engineering"` (giữ JSON hợp lệ).

- [ ] **Step 4: `plugins/_cowork.json`** — thêm `"data:data-db-migration",` ngay trước `"data:data-oltp-init",`.

- [ ] **Step 5: `plugins/data/.manifest.json`** — `"version": "1.2.0"` → `"1.3.0"`; trong `description`, đổi đoạn `data-db-migration (DRAFT — áp Flyway/Liquibase …)` thành `data-db-migration (áp Flyway/Liquibase …)` (bỏ chữ `DRAFT — `, giữ phần còn lại của câu).

- [ ] **Step 6: `plugins/data/shared/principles.md`** — sau khối "OLAP đọc dữ liệu TỪ nguồn vận hành … (mô hình dữ liệu của riêng service đó, phục vụ repository nội bộ — không phải DB dùng chung)." thêm đoạn:

```markdown
Ngoại lệ về đối tượng: skill `data-db-migration` (đã publish) phục vụ **project backend có DB riêng của app** — áp
Flyway/Liquibase/Alembic và viết thay đổi schema theo expand/contract — chứ không thuộc nhánh OLTP hay OLAP. Khi schema là
contract cho nhiều consumer hoặc project sở hữu DB như một sản phẩm, dùng nhánh OLTP (`data-oltp-implement`) thay vì skill này.
```

- [ ] **Step 7:** `node test/install.test.mjs` → đỏ ở các assert "data là draft". Sửa `test/install.test.mjs`:
  - `ok(!pub.includes('data'), 'publishedPluginIds: KHÔNG gồm data (draft)');` → `ok(pub.includes('data'), 'publishedPluginIds: gồm data (publish một phần: data-db-migration)');`
  - `ok(offered.includes('engineering') && offered.includes('ops') && !offered.includes('data'), 'offeredCatalog: offer engineering/ops, ẩn data');` → bỏ `&& !offered.includes('data')` thay bằng `&& offered.includes('data')`, message `'offeredCatalog: offer engineering/ops và data (chỉ data-db-migration)'`.
  - Khối comment `// data-db-migration là DRAFT …` (~181-187): thay bằng
```js
// data-db-migration đã publish (spec 2026-10-01-data-migration-writer-design D-Q1); 4 skill data-oltp/olap vẫn draft.
{
  const daAll = skillCatalog().plugins.find((p) => p.id === 'data');
  ok(daAll && daAll.skillIds.includes('data/data-db-migration') && daAll.skillIds.includes('data/data-oltp-init'),
    'skillCatalog: có data/data-db-migration và các skill draft (cài được bằng --skill)');
  const daOff = offeredCatalog().plugins.find((p) => p.id === 'data');
  ok(daOff && daOff.skillIds.includes('data/data-db-migration') && !daOff.skillIds.includes('data/data-oltp-init'),
    'offeredCatalog: plugin data chỉ offer data-db-migration, ẩn skill draft');
}
```
  Nếu có assert đếm skill Cowork/số nhóm bị lệch +1 vì `_cowork.json`/offer thay đổi, sửa đúng con số (ghi lại dòng nào, vì sao). Không nới assert khác.

- [ ] **Step 8:** `npm test && npm run pack:verify` → xanh.

- [ ] **Step 9: Commit**

```text
feat(publish): publish data-db-migration skill

Changed:
- Thêm data/data-db-migration vào _published.json và _cowork.json; manifest data 1.3.0 bỏ nhãn DRAFT; 4 skill data-oltp/olap vẫn draft.
- principles của plugin data nêu rõ data-db-migration phục vụ project backend có DB riêng của app, không thuộc nhánh OLTP/OLAP.
- install.test: bỏ assert plugin data là draft, thay bằng assert offer một phần; mở khối validate 22 với assert publish.

Reason:
- P1b của spec 2026-09-29: publish không chờ pilot, làm trước khi nối workflow vì offeredCatalog ẩn workflow có closure chưa publish (spec 2026-10-01-data-migration-writer-design D-Q1).
```

---

### Task 2: Agent `data-migration-writer`

**Files:** Create `plugins/data/agents/data-migration-writer.md`; Modify `test/validate.mjs` (khối 22).

- [ ] **Step 1: Assert đỏ (cuối khối 22, trước `}` đóng)**

```js
  const dmwPath = path.join(PLUGINS_DIR, 'data', 'agents', 'data-migration-writer.md');
  const dmw = fs.existsSync(dmwPath) ? fs.readFileSync(dmwPath, 'utf8') : '';
  ok(dmw.length > 0, 'data-migration-writer: có agent file');
  ok(/^mode: write$/m.test(dmw) && /^skills: "data-db-migration"$/m.test(dmw),
    'data-migration-writer: mode write, skills = data-db-migration (đúng 1 skill)');
  const dmwScope = flat22(dmw.split('## Phạm vi')[1]?.split('## Quy trình')[0] ?? '');
  ok(dmwScope.includes('kết nối DB') && dmwScope.includes('chạy migration'),
    'data-migration-writer: Phạm vi cấm kết nối DB và chạy migration');
  ok(dmwScope.includes('file migration đã có') && dmwScope.includes('repair'),
    'data-migration-writer: Phạm vi cấm sửa file migration đã có và repair/clean');
  ok(dmwScope.includes('`src/`') && dmwScope.includes('blocked') && dmwScope.includes('questions'),
    'data-migration-writer: cấm sửa src/, cần quyết định → blocked + questions');
  ok(dmw.includes('git diff --name-only') && dmw.includes('not_run'),
    'data-migration-writer: tự đối chiếu diff; validation not_run (verify do session chính)');
  const dmwSpec = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'superpowers', 'specs', '2026-10-01-data-migration-writer-design.md'), 'utf8')
    .replace(/\r\n/g, '\n');
  const dmwBlock = dmwSpec.split('### 3.2')[1]?.split('```markdown\n')[1]?.split('\n```')[0] ?? '';
  ok(dmwBlock.length > 0 && dmwBlock.trimEnd() === dmw.replace(/\r\n/g, '\n').trimEnd(),
    'data-migration-writer: khối agent trong spec §3.2 giống hệt file agent');
```

- [ ] **Step 2:** validate → đỏ đúng các dòng `data-migration-writer: …` (7).

- [ ] **Step 3: Tạo file** — copy **nguyên văn** khối ```markdown trong spec §3.2 (từ dòng `---` mở frontmatter tới hết `- \`next_actions\`: pha contract còn nợ kèm điều kiện kích hoạt.`), không kèm hàng rào ```.

- [ ] **Step 4:** `npm run build && node test/validate.mjs` → 0 fail (contract agent chung `validate.mjs:~276-286` cũng chạy cho agent mới). Kiểm `build/claude` có `…/data-migration-writer.md` và `build/codex` có `…/data-migration-writer.toml` (`grep -rl data-migration-writer build/claude build/codex | head`); nếu adapter nào bỏ qua plugin `data`, ghi lại và báo (không tự sửa adapter).

- [ ] **Step 5: Commit**

```text
feat(agents): add data-migration-writer agent

Changed:
- Thêm agent data-migration-writer (plugin data, skill data-db-migration, mode write): chỉ làm C1 nhận diện + C3 viết file migration MỚI; không kết nối DB, không chạy migration, không sửa file migration đã có; cần quyết định thì trả blocked + questions.
- Khối validate 22 thêm assert agent, gồm so khớp từng byte với khối trong spec.

Reason:
- Spec 2026-10-01-data-migration-writer-design §3: C2 và C4 của skill là cổng người duyệt nên subagent chỉ nhận phần viết file.
```

---

### Task 3: Nối `workflow-db-change`

**Files:** `workflows/db-change/WORKFLOW.md`; `test/validate.mjs` (khối 22).

- [ ] **Step 1: Assert đỏ**

```js
  const dbc22 = wf22('workflow-db-change');
  const dS2 = step22(dbc22, 2), dS3 = step22(dbc22, 3), dS6 = step22(dbc22, 6), dS8 = step22(dbc22, 8);
  ok(field22(dS2.body, 'Thực hiện').includes('skill `data-db-migration`') && field22(dS2.body, 'Hành động').includes('change-patterns')
    && field22(dS2.body, 'Hành động').includes('lock-risk-postgres'),
    'workflow-db-change Bước 2: theo skill data-db-migration (C2), tra change-patterns và lock-risk-postgres');
  ok(field22(dS2.body, 'Đầu ra').includes('expand') && field22(dS2.body, 'Đầu ra').includes('Bước 3'),
    'workflow-db-change Bước 2: Đầu ra có kế hoạch theo pha làm đầu vào cho Bước 3');
  ok(field22(dS3.body, 'Thực hiện').includes('agent `data-migration-writer`') && field22(dS3.body, 'Thực hiện').includes('agent `backend-implementer`'),
    'workflow-db-change Bước 3: data-migration-writer (file migration) ∥ backend-implementer (code)');
  ok(field22(dS3.body, 'Hành động').includes('git status --porcelain'), 'workflow-db-change Bước 3: session chính ghi mốc git status --porcelain trước khi dispatch');
  ok(field22(dS3.body, 'Ràng buộc').includes('không sửa file migration đã có') && field22(dS3.body, 'Ràng buộc').includes('không kết nối DB'),
    'workflow-db-change Bước 3: file migration chỉ file MỚI, agent không kết nối DB/chạy migration');
  ok(field22(dS3.body, 'Gate').includes('file migration MỚI') && field22(dS3.body, 'Gate').includes('git ls-files --others')
    && field22(dS3.body, 'Gate').includes('đã có trên base branch'),
    'workflow-db-change Bước 3: Gate so diff với mốc — chỉ file migration mới + file code thuộc nơi dùng, không sửa file đã có');
  ok(field22(dS3.body, 'Khi fail').includes('blocked') && field22(dS3.body, 'Khi fail').includes('quay lại Bước 2'),
    'workflow-db-change Bước 3: agent blocked → hỏi người dùng; đổi kế hoạch → quay lại Bước 2');
  ok(field22(dS6.body, 'Thực hiện').includes('skill `data-db-migration`') && field22(dS6.body, 'Hành động').includes('verify-cycle'),
    'workflow-db-change Bước 6: chạy thử theo skill data-db-migration (C4), chu trình verify-cycle');
  ok(field22(dS8.body, 'Hành động').includes('next_actions') && field22(dS8.body, 'Hành động').includes('Bước 3'),
    'workflow-db-change Bước 8: pha contract còn nợ lấy từ next_actions của report Bước 3');
  ok(dbc22 && ['data-migration-writer', 'backend-implementer', 'backend-test-writer', 'backend-reviewer'].every((a) => dbc22.agents.includes(a))
    && dbc22.requires.includes('data/data-db-migration'),
    'workflow-db-change: frontmatter agents có data-migration-writer, requires có data/data-db-migration');
  ok(parseSteps(dbc22?.body ?? '').length === 9 && step22(dbc22, 2).checkpoint && step22(dbc22, 5).checkpoint && step22(dbc22, 9).checkpoint,
    'workflow-db-change: vẫn 9 bước, ⏸ ở Bước 2, 5, 9');
  ok(flat22(dbc22?.body.split('## Xử lý lỗi')[1]?.split('## Definition of Done')[0] ?? '').includes('Agent migration trả `blocked`'),
    'workflow-db-change: bảng lỗi có hàng agent migration trả blocked');
  ok((offeredCatalog().plugins.find((p) => p.id === 'workflows')?.skillIds ?? []).includes('workflows/workflow-db-change'),
    'offeredCatalog: vẫn offer workflows/workflow-db-change (closure data-db-migration đã publish)');
```

- [ ] **Step 2:** validate → đỏ nhóm `workflow-db-change …` (guard `vẫn 9 bước`? — dòng ⏸/9 bước nằm cùng assert với frontmatter-free check, nên assert "vẫn 9 bước, ⏸ ở 2/5/9" xanh; `offeredCatalog …` xanh). Ghi dòng đỏ thực tế.

- [ ] **Step 3: Frontmatter** (`workflows/db-change/WORKFLOW.md` dòng `agents:` và `requires:`)

```yaml
agents: "data-migration-writer,backend-implementer,backend-test-writer,backend-reviewer"
requires: "core/git-workflow,data/data-db-migration"
```

- [ ] **Step 4: Điều kiện tiên quyết** — dòng đầu:

```markdown
- Skill/agent đã cài: `data-migration-writer`, `backend-implementer`, `backend-test-writer`, `backend-reviewer`,
  skill `core/git-workflow`, `data/data-db-migration`.
```

- [ ] **Step 5: Bước 2** — sửa 3 trường (đọc text thật trước):
  - `Thực hiện`: `- **Thực hiện:** session chính (theo skill \`data-db-migration\`, chế độ \`change\`, bước C2)`
  - `Hành động`: giữ nội dung hiện có, nối thêm: `Tra pattern trong \`references/change/change-patterns.md\` và mức khoá trong \`references/change/lock-risk-postgres.md\` của skill; hỏi số dòng của bảng bị đụng (không có ngưỡng mặc định); ghi rõ pha nào (expand / migrate data / contract) vào lượt này, pha nào để sau.`
  - `Đầu ra`: nối `, kèm kế hoạch theo pha (expand / migrate data / contract) làm đầu vào cho Bước 3`.

- [ ] **Step 6: Thay toàn bộ Bước 3**

```markdown
### Bước 3 — Implement

- **Thực hiện:** agent `data-migration-writer` (file migration) ∥ agent `backend-implementer` (code)
- **Đầu vào:** thiết kế + kế hoạch theo pha đã xác nhận từ Bước 2 + nơi dùng đã xác định ở Bước 1
- **Hành động:** session chính ghi mốc `git status --porcelain` rồi dispatch hai agent; `data-migration-writer`
  nhận diện công cụ và thư mục migration rồi chỉ thêm file migration MỚI (forward + rollback; công cụ forward-only
  chỉ forward, SQL bù ghi trong report) cho các pha của lượt này; `backend-implementer` cập nhật code (query/ORM mapping/DTO)
  theo nơi dùng đã xác định ở Bước 1.
- **Ràng buộc:** không sửa file migration đã có trên base branch; `backend-implementer` không sửa file trong thư
  mục migration và không sửa code ngoài nơi dùng đã xác định ở Bước 1; danh sách file là hợp của hai phía, mỗi
  agent chỉ đối chiếu phần của mình; agent không kết nối DB hay chạy migration (verify ở Bước 6).
- **Đầu ra:** file migration mới + code cập nhật.
- **Gate:** build xanh; so với mốc `git status --porcelain` đầu bước, file thay đổi hoặc mới trong bước
  (`git diff --name-only` và `git ls-files --others --exclude-standard`) chỉ gồm (a) file migration MỚI trong thư
  mục migration và (b) file code thuộc nơi dùng đã xác định ở Bước 1; không có file migration đã có trên base
  branch bị sửa.
- **Khi fail:** build đỏ → chẩn đoán → sửa → build lại; `data-migration-writer` trả `blocked` + câu hỏi → session
  chính hỏi người dùng; quyết định làm đổi kế hoạch → quay lại Bước 2, ngược lại ghi vào report bước rồi gọi lại
  agent; diff ngoài phạm vi → revert phần lệch, không nhận.
- **Evidence:** lệnh build + exit code 0; report của `data-migration-writer` (công cụ/engine, file migration mới
  theo pha, `next_actions`); danh sách file thay đổi hoặc mới trong bước so với mốc đầu bước.
```

- [ ] **Step 7: Bước 6** — `Thực hiện` → `- **Thực hiện:** session chính (theo skill \`data-db-migration\`, chế độ \`change\`, bước C4)`; `Hành động`: đầu câu thêm `Chu trình verify theo \`references/change/verify-cycle.md\` của skill. ` rồi giữ nguyên nội dung hiện có.

- [ ] **Step 8: Bước 8 Hành động** — nối: `; pha contract còn nợ lấy từ \`next_actions\` trong report Bước 3.` (KHÔNG ghi id agent ở đây — xem Global Constraints).

- [ ] **Step 9: Bảng lỗi** — sau hàng `| Thay đổi phá huỷ dữ liệu chưa được xác nhận | … |` thêm:

```markdown
| Agent migration trả `blocked` (Bước 3) | Người dùng quyết định; đổi kế hoạch → quay lại Bước 2, ngược lại ghi vào report Bước 3 rồi gọi lại agent |
```

- [ ] **Step 10:** `npm test` → xanh (các assert db-change cũ ở validate ~970-983, 1064-1069 phải vẫn xanh). Teeth: tạm xoá `"data/data-db-migration",` khỏi `_published.json` → `✗ offeredCatalog: vẫn offer workflows/workflow-db-change` đỏ → `git checkout -- plugins/_published.json` → xanh.

- [ ] **Step 11: Commit**

```text
fix(workflows): dispatch db-change migration files to data-migration-writer with diff gate

Changed:
- workflow-db-change Bước 3 giao file migration cho agent data-migration-writer (song song backend-implementer); Gate so diff với mốc đầu bước: chỉ file migration MỚI + file code thuộc nơi dùng, không sửa file migration đã có; blocked → hỏi người dùng.
- Bước 2 theo skill data-db-migration (C2: pattern, mức khoá, kế hoạch theo pha), Bước 6 theo verify-cycle (C4), Bước 8 lấy nợ contract từ report Bước 3; frontmatter agents/requires, tiền điều kiện, bảng lỗi cập nhật; số bước giữ 9.
- Khối validate 22 thêm assert workflow và assert workflow-db-change vẫn được offer.

Reason:
- WF3 của spec 2026-09-29: file migration đang viết ở session chính, không khoá phạm vi (spec 2026-10-01-data-migration-writer-design §4).
```

---

### Task 4: S8 + docs

**Files:** `plugins/backend/skills/backend-implement/SKILL.md`, `README.md`, `README_VI.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md`, `docs/decisions/0001-database-capabilities-in-data-plugin.md`, `test/validate.mjs`.

- [ ] **Step 1: Assert đỏ (khối 22)**

```js
  const beImpl22 = flat22(fs.readFileSync(path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-implement', 'SKILL.md'), 'utf8'));
  ok(beImpl22.includes('`data-db-migration`') && beImpl22.includes('`backend-migrate-vault-consul`'),
    'backend-implement (S8): ranh giới trỏ đích danh data-db-migration và backend-migrate-vault-consul');
  for (const [f, head] of [['README.md', '### Agents (17)'], ['README_VI.md', '### Agent (17)']]) {
    const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
    const row = (a) => rd.split('\n').find((l) => l.startsWith(`| \`${a}\` |`)) ?? '';
    ok(rd.split('\n').some((l) => l.trim() === head), `${f}: heading ${head}`);
    ok(row('data-migration-writer').includes('WF07'), `${f}: bảng agent có data-migration-writer dùng ở WF07`);
    ok((rd.split('\n').find((l) => l.startsWith('| WF07 |')) ?? '').includes('data-migration-writer'), `${f}: WF07 liệt kê data-migration-writer`);
    ok(!/^\| G2 \|/m.test(rd), `${f}: bảng Skill gaps bỏ G2 (đã có data-db-migration)`);
    ok(!(rd.split('\n').find((l) => l.startsWith('| `data` |')) ?? '').includes('draft, not yet published') && !(rd.split('\n').find((l) => l.startsWith('| `data` |')) ?? '').includes('draft, chưa publish'),
      `${f}: hàng plugin data không còn ghi draft toàn khối`);
  }
  ok(flat22(fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8')).includes('`data-db-migration` published'),
    'CLAUDE.md: data có data-db-migration published, 4 skill còn draft');
  ok(fs.readFileSync(path.join(REPO_ROOT, 'docs', 'decisions', '0001-database-capabilities-in-data-plugin.md'), 'utf8').includes('data-migration-writer'),
    'ADR-0001: ghi cập nhật publish data-db-migration và agent data-migration-writer');
```

- [ ] **Step 2:** validate → đỏ: assert mới + assert heading `### Agents (16)` ở khối 20 sẽ đỏ sau khi sửa README (xử lý ở Step 7).

- [ ] **Step 3: S8** — `plugins/backend/skills/backend-implement/SKILL.md`: đọc dòng ~78 và ~89, đổi:
  - "(thuộc `data` nhánh OLTP / recipe migration khác)" → "(thuộc skill `data-db-migration` của plugin `data`)"; "(thuộc `backend-migrate-vault-consul`)" giữ.
  - "- Nối hạ tầng thật (DB migration, externalize config) là các recipe khác, ngoài phạm vi slice này." → "- Nối hạ tầng thật là recipe khác, ngoài phạm vi slice này: DB migration → `data-db-migration` (plugin `data`); externalize config/secret → `backend-migrate-vault-consul`."
  Giữ wrap ~100 cột.

- [ ] **Step 4: README.md / README_VI.md**
  - `### Agents (16)` → `### Agents (17)`; `### Agent (16)` → `### Agent (17)`.
  - Bảng agent: thêm hàng `| \`data-migration-writer\` | data | write | data-db-migration | WF07 |` ngay sau hàng `backend-fixer` hoặc `backend-performance-analyst` (hàng backend cuối) — giữ 5 ô.
  - Hàng `| WF07 | \`workflow-db-change\` | … | backend-implementer, backend-test-writer, backend-reviewer |` → cột agent: `data-migration-writer, backend-implementer, backend-test-writer, backend-reviewer`.
  - Hàng plugin `| \`data\` | … *(draft, not yet published)* …` (EN) / `*(draft, chưa publish)*` (VI) → `*(partly published: \`data-db-migration\`; OLTP/OLAP skills still draft)*` / `*(publish một phần: \`data-db-migration\`; skill OLTP/OLAP còn draft)*`; cột Skills thêm `data-db-migration`.
  - Bảng Skill gaps: xoá hàng `| G2 | …`.
  - Đoạn "Plugins with no published skill (e.g. `data`) stay drafts…" (EN ~117-123) / tương ứng VI: đổi ví dụ — `data` nay published một phần; ví dụ draft dùng "the `data-oltp-*` / `data-olap-*` skills".

- [ ] **Step 5: `CLAUDE.md` Conventions** — thay đoạn `` `data` (4 skills + `data-db-migration`, 5 in all) stays **draft** (builds/validates and installs via explicit `--plugin`/`--skill`, not offered by default — see `plugins/_published.json`) `` bằng `` `data` is **partly published** (`data-db-migration` published — offered by the wizard; the 4 `data-oltp-*`/`data-olap-*` skills stay **draft**: build/validate and install via explicit `--plugin`/`--skill` or `aip --all`, not offered by default — see `plugins/_published.json`) ``. Đọc đoạn thật, đổi tối thiểu; cũng cập nhật câu liệt kê plugin published (`backend`, `frontend`, `engineering`, `ops`) thêm `data` (partial) nếu câu đó nêu tập đóng.

- [ ] **Step 6: Spec 2026-09-29** (`docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md`; đọc từng dòng trước khi sửa):
  - Dòng trạng thái đầu file: bỏ "P1b chờ pilot (Q6)" → "P1b xong (publish không chờ pilot, 2026-10-01)"; "WF3 phần dùng skill chờ P1b" → bỏ; P2 "WF3–WF11 xong".
  - §7.1.10 hàng `Pha publish (sau pilot)` → `(publish không chờ pilot, 2026-10-01)`; bỏ "thêm skill vào `backend-implementer`" (đã chọn agent `data-migration-writer` trong plugin `data` thay thế — ghi chú ngắn).
  - §9 hàng P1b → trạng thái `✅ publish không chờ pilot (2026-10-01); agent data-migration-writer thay cho việc thêm skill vào backend-implementer`; hàng P2 → `◐ WF3–WF11 xong`.
  - §12: bullet chéo plugin `backend-implementer`/`data-db-migration` (~dòng 656-658) → thay bằng "Đã xử lý: dùng agent `data-migration-writer` thuộc plugin `data`, không thêm skill chéo plugin vào `backend-implementer` (2026-10-01)".
  - §13.1 thêm hàng `| P1b, S8, WF3 (dùng skill) | (xem git log) | (xem git log) |`; §13.2 xoá hàng `S8`, `P1b`, `WF3 phần dùng skill`.
  - §8.1 catalog: thêm hàng `data-migration-writer | data | write | data-db-migration | db-change | mới (2026-10-01)`; tiêu đề catalog tăng +1 (xem số hiện có trong tiêu đề, +1).

- [ ] **Step 7: ADR-0001** — nối cuối file:

```markdown

## Cập nhật 2026-10-01

- `data/data-db-migration` đã publish (không chờ pilot), plugin `data` publish một phần; 4 skill `data-oltp/olap` vẫn draft.
- Không thêm skill chéo plugin vào `backend-implementer`: file migration do agent `data-migration-writer` (plugin `data`) viết, chỉ làm C1 + C3; C2/C4/C5 thuộc `workflow-db-change` (Bước 2, 5–6, 8).
- Rủi ro chéo plugin nêu ở mục Hệ quả không còn áp dụng; rủi ro còn lại: skill chưa pilot trên project thật.
```

- [ ] **Step 8:** Khối 20 của `test/validate.mjs` có vòng README assert heading `### Agents (16)` / `### Agent (16)`: xoá **chỉ** dòng assert heading đó (và biến `head` nếu thành thừa), giữ các assert hàng agent/WF09; khối 22 đã assert `(17)`.

- [ ] **Step 9:** `node test/validate.mjs` → 0 fail; `npm test` xanh.

- [ ] **Step 10: Commit**

```text
docs: document data-migration-writer and close P1b, S8 and WF3 in upgrade spec

Changed:
- backend-implement ranh giới trỏ đích danh data-db-migration (S8) và backend-migrate-vault-consul.
- README/README_VI: 17 agent, thêm data-migration-writer (WF07), cột agent WF07, hàng plugin data publish một phần, bỏ G2 khỏi Skill gaps; CLAUDE.md và ADR-0001 cập nhật publish một phần.
- Spec 2026-09-29: P1b, S8, WF3 đánh dấu xong, bỏ rủi ro chéo plugin; khối validate 22 thêm assert docs, khối 20 bỏ assert heading (16).

Reason:
- Tài liệu phải khớp catalog và workflow sau khi publish data-db-migration và thêm agent (spec 2026-10-01-data-migration-writer-design §5).
```

---

### Task 5: Smoke sandbox (không commit)

- [ ] `npm run build`
- [ ] Sandbox (Node, không `rm -rf`):

```bash
SB="$(node -e "console.log(require('os').tmpdir())")/aip-dm-smoke" && node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true});require('fs').mkdirSync(process.argv[1],{recursive:true})" "$SB" && AIE_INSTALL_ROOT="$SB" node cli/index.mjs install --provider claude --skill workflows/workflow-db-change --yes && node -e "const m=require(process.argv[1]+'/.ai-engineering/manifest.json');console.log(JSON.stringify(m,null,1).split('\n').filter(l=>/data|db-change/.test(l)).join('\n'))" "$SB" && node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true})" "$SB"
```

Expected: manifest có `.claude/skills/data-db-migration`, `.claude/agents/data-migration-writer.md`, `.claude/skills/workflow-db-change`; `git status --short` sạch.

---

## Self-Review

**1. Spec coverage**

| Spec | Task |
|---|---|
| §5.1 publish (+ principles + draft asserts) | 1 |
| §3 agent | 2 |
| §4 workflow | 3 |
| §5.2 S8, §5.3 docs, ADR | 4 |
| §5.5 smoke | 5 |
| §5.4 test (khối 22) | 1–4 |

**2. Placeholder scan:** Task 4 Step 6 ghi `(xem git log)` có chủ ý (tránh tự tham chiếu hash). Không TBD khác.

**3. Type consistency:** `flat22`, `wf22`, `step22`, `field22` định nghĩa Task 1, dùng Task 2–4; `offeredCatalog`, `parseSteps`, `workflows`, `PLUGINS_DIR`, `REPO_ROOT` có sẵn đầu `validate.mjs`.

**4. Review Focus:** (1) Task 3 assert offered + teeth; (2) Task 2/3 assert cấm sửa file migration đã có; (3) Task 2 assert cấm kết nối DB/chạy migration; (4) Task 1 assert principles; (5) Task 1 Step 7 sửa install.test.
