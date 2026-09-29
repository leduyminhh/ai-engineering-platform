# backend-db-migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm skill recipe `backend-db-migration` (2 chế độ `adopt` / `change`) vào plugin `backend` ở trạng thái **draft**, kèm `references/` và template Spring Boot (Flyway + Liquibase), có assert hợp đồng trong `test/validate.mjs`.

**Architecture:** Skill là docs-only recipe: `SKILL.md` mỏng (Bước 0 chọn chế độ → `adopt` 7 bước theo G2 | `change` cổng C1–C5) + `references/` dày (`adopt/`, `change/`, `spring-boot/{common,flyway,liquibase}/`, `README.md` ở gốc). Skill được auto-discover; wizard không offer nhờ đổi `plugins/_published.json` từ `"backend"` sang danh sách 8 skill lẻ. Không đổi CLI/adapter.

**Tech Stack:** Markdown + YAML frontmatter (parser zero-dep của repo); template Spring Boot 3 (Maven, Flyway, Liquibase, PostgreSQL); bash cho `new-migration.sh`; test harness `ok(cond, msg)` của repo (Node ≥ 20, ESM, zero dependency).

**Spec:** [docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md](../specs/2026-09-29-skill-plugin-workflow-upgrade-design.md) §7.1 (+ nền G2: [docs/superpowers/specs/2026-09-07-backend-migrate-db-design.md](../specs/2026-09-07-backend-migrate-db-design.md) §3–§8 cho chế độ `adopt`)

## Global Constraints

- Docs-only: KHÔNG sửa `cli/`, `adapters/`, `core/`, `workflows/`, agent nào; KHÔNG đổi nội dung 8 skill backend hiện có.
- Pha publish (§7.1.10) KHÔNG thuộc plan này: không thêm skill vào `backend-implementer`, không sửa `workflow-db-change` (WF3), không sửa pointer `backend-implement:78`/`:89` (S8).
- `plugins/_published.json` chỉ sửa ở Task 1: `"backend"` → 8 mục `backend/<skill>` hiện có; **không** có `backend/backend-db-migration`.
- Stack đợt này: chỉ Java/Spring Boot (M2). Engine: chỉ PostgreSQL (M5). Flyway: forward-only (M3). Không có ngưỡng "bảng lớn" mặc định (M6).
- Frontmatter: `order: 9`, `stageNumber: "09"`, `runsIn: execute`, `invoke: per-request`, `pipeline: false`, `next: null`; không khai `sharedAssets`.
- README của references đặt ở `references/README.md` (gốc), KHÔNG ở `references/spring-boot/README.md` — path đó đã thuộc `backend-migrate-vault-consul` và `test/validate.mjs:243-251` sẽ đỏ.
- Template: không lớp `@Configuration` tự viết, không `spring.factories`, không `<version>` cho `flyway-core` / `flyway-database-postgresql` / `liquibase-core` (G2 P1, P8, P9). `env.example` khớp ĐÚNG tập biến các `application-*.yml` tham chiếu (G2 B2).
- Nhãn `[Unverified]` giữ nguyên trừ khi Task 3 đối chiếu được tài liệu gốc; không tuyên bố template "đã chạy được" (chưa có pilot).
- File UTF-8 không BOM, LF. Nội dung hướng người dùng viết tiếng Việt có dấu. Comment chỉ giải thích *why*, tiếng Việt, 1–2 dòng (AGENTS.md → Comments).
- Chỉ thêm assert vào `test/validate.mjs` và `test/install.test.mjs`; không thêm file test mới.
- Không `rm -rf` sandbox chứa junction; dọn bằng `node -e "require('fs').rmSync(p,{recursive:true,force:true})"` [[windows-junction-rm-hazard]].
- Mỗi task = 1 commit qua skill `core:git-workflow` (header EN, body VI có dấu, KHÔNG trailer `Co-Authored-By`). Dừng cho người duyệt diff trước mỗi commit. Push/PR/merge: chờ người dùng.
- `<scratchpad>` trong lệnh = thư mục tạm của phiên thực thi, nằm NGOÀI repo.

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/backend/skills/backend-db-migration/SKILL.md` | Recipe mỏng: Bước 0, `adopt` A1–A7, `change` C1–C5, ranh giới an toàn, report | 1 |
| `plugins/_published.json` | Gate draft: backend publish theo từng skill | 1 |
| `plugins/backend/.manifest.json` | Description đủ 9 skill (đánh dấu draft), version `1.3.0` | 1 |
| `CLAUDE.md` | Câu catalog plugin: backend 8 published + 1 draft | 1 |
| `test/install.test.mjs` | Assert draft: có trong `skillCatalog`, không trong `offeredCatalog` | 1 |
| `references/adopt/inventory-checklist.md` | Kiểm kê hiện trạng schema (G2 §5 bước 2) | 2 |
| `references/adopt/tool-comparison-rubric.md` | Rubric Flyway ↔ Liquibase (G2 §6) | 2 |
| `references/change/change-patterns.md` | Loại thay đổi → pha expand / migrate data / contract + SQL mẫu | 3 |
| `references/change/lock-risk-postgres.md` | Thao tác → mức khoá, viết lại bảng, cách an toàn, nguồn | 3 |
| `references/change/verify-cycle.md` | Chu trình verify theo công cụ + xác nhận DB đích + evidence | 3 |
| `references/spring-boot/common/*` | pom, `DbMigrationApplication`, `application-migration.yml`, `env.example`, `new-migration.sh` | 4 |
| `references/spring-boot/flyway/*` | `application-flyway.yml`, `CONVENTIONS.md`, layout mẫu + `.conf` | 5 |
| `references/spring-boot/liquibase/*` | `application-liquibase.yml`, `CONVENTIONS.md`, master + changeSet mẫu có `rollback` | 6 |
| `references/README.md` | Ma trận file, chọn nhánh, placeholder, cách chạy job | 7 |
| `test/validate.mjs` | Mục 8: hợp đồng template `backend-db-migration` | 4, 5, 6, 7 |

(`references/` = `plugins/backend/skills/backend-db-migration/references/`)

---

### Task 0: Branch + commit spec và plan

**Files:**
- Commit: `docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md` (đang untracked)
- Commit: `docs/superpowers/plans/2026-09-29-backend-db-migration.md` (file này)

**Interfaces:**
- Consumes: —
- Produces: branch `feature/backend-db-migration` mà mọi task sau commit lên.

- [ ] **Step 1: Kiểm tra trạng thái**

Run: `git status --short && git branch --show-current`
Expected: chỉ 2 file untracked ở trên; branch `master` (hoặc branch người dùng chỉ định).

- [ ] **Step 2: Tạo branch**

Run: `git switch -c feature/backend-db-migration`
Expected: `Switched to a new branch 'feature/backend-db-migration'`

- [ ] **Step 3: Stage đúng 2 file**

Run: `git add docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md docs/superpowers/plans/2026-09-29-backend-db-migration.md && git status --short`
Expected: 2 dòng `A `.

- [ ] **Step 4: Commit qua `core:git-workflow`** (dừng cho người duyệt message)

Header đề xuất: `docs(specs): add skill/plugin/workflow upgrade spec and db-migration plan`

---

### Task 1: Khung skill + gate draft

**Files:**
- Create: `plugins/backend/skills/backend-db-migration/SKILL.md`
- Modify: `plugins/_published.json`
- Modify: `plugins/backend/.manifest.json`
- Modify: `CLAUDE.md:81`
- Test: `test/install.test.mjs` (thêm khối sau khối `publishedPluginIds + offeredCatalog`, trước `// ── unit: wizardReportModel`)

**Interfaces:**
- Consumes: `skillCatalog()`, `offeredCatalog()` từ `cli/lib/install.mjs` (đã import ở `test/install.test.mjs:17`).
- Produces: skill id `backend-db-migration`; `SKILL.md` link tới các path mà Task 2, 3, 7 tạo: `references/adopt/inventory-checklist.md`, `references/adopt/tool-comparison-rubric.md`, `references/change/change-patterns.md`, `references/change/lock-risk-postgres.md`, `references/change/verify-cycle.md`, `references/README.md`.

- [ ] **Step 1: Viết assert draft (failing)**

Chèn vào `test/install.test.mjs`, ngay trước dòng `// ── unit: wizardReportModel`:

```js
// backend-db-migration là DRAFT (spec 2026-09-29 §7.1.1 M4): có trên đĩa nhưng wizard không offer.
{
  const beAll = skillCatalog().plugins.find((p) => p.id === 'backend');
  ok(beAll && beAll.skillIds.includes('backend/backend-db-migration'),
    'skillCatalog: có backend/backend-db-migration (draft vẫn cài được bằng --skill)');
  const beOff = offeredCatalog().plugins.find((p) => p.id === 'backend');
  ok(beOff && !beOff.skillIds.includes('backend/backend-db-migration'),
    'offeredCatalog: KHÔNG offer backend-db-migration (draft)');
  ok(beOff && beOff.skillIds.length === 8, 'offeredCatalog: vẫn offer đủ 8 skill backend đã publish');
}
```

- [ ] **Step 2: Chạy, xác nhận đỏ đúng lý do**

Run: `node test/install.test.mjs 2>&1 | tail -5`
Expected: FAIL `skillCatalog: có backend/backend-db-migration` (skill chưa tồn tại); 2 assert còn lại pass.

- [ ] **Step 3: Tạo `SKILL.md`**

Tạo `plugins/backend/skills/backend-db-migration/SKILL.md` với nội dung:

````markdown
---
name: backend-db-migration
description: "Recipe on-demand cho SCHEMA DATABASE của một BACKEND project, 2 chế độ: ADOPT — kiểm kê cơ chế schema hiện trạng (ddl-auto, DDL chạy tay), so sánh Flyway ↔ Liquibase bằng bằng chứng của chính project, DỪNG cho người dùng chọn, rồi áp module migration chạy riêng; CHANGE — viết MỘT thay đổi schema an toàn theo expand/contract (thêm/đổi/xoá cột, index, FK), kiểm rủi ro khoá bảng PostgreSQL, verify trên DB test theo chu trình của từng công cụ (Flyway forward-only). Template có cho Java/Spring Boot + PostgreSQL; Python/Alembic chỉ có hướng dẫn quy trình. KHÔNG chạy migration lên production. Dùng skill NÀY khi người dùng muốn \"migrate db\", \"flyway\", \"liquibase\", \"công cụ migration\", \"bỏ ddl-auto\", \"quản lý schema\", \"database migration\", \"đổi schema\", \"thêm cột\", \"expand contract\", \"schema change\", \"migration an toàn\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG dùng khi project đã chạy data-oltp-init (dùng data-oltp-implement). KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã có mã nguồn."
order: 9
stageNumber: "09"
title: "Backend DB Migration — Áp công cụ migration & viết thay đổi schema an toàn (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Backend DB Migration — Áp công cụ migration & viết thay đổi schema an toàn (recipe on-demand)

Recipe hướng dẫn agent làm việc với schema database của một backend project theo **hai chế độ**:

| Chế độ | Câu hỏi nó trả lời | Tần suất |
|---|---|---|
| `adopt` | Project nên dùng công cụ migration nào, áp nó thế nào? (Flyway ↔ Liquibase, module migration chạy riêng) | Một lần mỗi project |
| `change` | Viết **một** thay đổi schema an toàn thế nào? (expand/contract, rủi ro khoá, verify theo công cụ) | Mỗi lần đổi schema |

Template có cho **Java/Spring Boot + PostgreSQL** (`references/spring-boot/`). Stack khác (Python/Alembic…) dùng được
quy trình nhưng **chưa có template** — nói rõ điều này với người dùng, không tự bịa layout. Đây là docs-only recipe:
hướng dẫn agent, KHÔNG phải công cụ tự chạy migration lên DB.

## Tiền đề
- Project có mã nguồn backend. Đọc CLAUDE.md / AGENTS.md, `project-knowledge/` (`stack-profile.md`,
  `data-model.md`, `architecture.md`), ADR trong `docs/decisions/` để biết ranh giới an toàn và quyết định đã chốt.
- Project đã chạy `data-oltp-init` hoặc sở hữu DB như sản phẩm (schema contract cho nhiều consumer) → KHÔNG dùng
  skill này; dùng `data-oltp-implement` (plugin `data`).

## Ranh giới an toàn (CLAUDE.md)
- Không chạy migration lên DB nào khi chưa qua cổng C4 (chế độ `change`) hoặc bước A7 (chế độ `adopt`); **không bao
  giờ** chạy trên production.
- Không kết nối DB, không chạy `pg_dump` khi chưa được cho phép; không đọc hay in secret — chỉ nêu tên biến, host,
  tên database (đã mask).
- Không sửa file migration đã có trên base branch; không dùng `repair` / `clearChecksums` / `clean` để "cho qua".
- Thao tác phá huỷ (drop cột/bảng, thu hẹp kiểu) chỉ sau xác nhận tường minh ở C2.
- Không ghim version công cụ đè BOM khi không có ADR.
- Làm trên branch riêng (không `main`/`master`/`dev`/`develop`); dừng cho người duyệt diff trước khi commit
  (1 task = 1 commit).

**Ngôn ngữ (bắt buộc):** mọi đầu ra hướng người dùng — bảng kiểm kê, bảng so sánh, kế hoạch migration, ADR, comment
trong file migration sinh ra, báo cáo — viết **tiếng Việt CÓ DẤU** (UTF-8). Báo cáo bằng số đo được (lệnh đã chạy,
exit code, số migration áp); không dùng "đảm bảo / an toàn tuyệt đối / không bao giờ lỗi"; luôn nêu rủi ro còn lại.

## Bước 0 — Chọn chế độ

| Dấu hiệu trong project | Đi tiếp |
|---|---|
| Chưa có công cụ migration (`ddl-auto=update`, DDL chạy tay) | `adopt` |
| Đã có Flyway / Liquibase / Alembic + yêu cầu đổi schema | `change` |
| Có `data-oltp-init`, hoặc schema là contract cho nhiều consumer | DỪNG → `data-oltp-implement` |
| Có cả hai dấu hiệu | DỪNG, hỏi người dùng |

## Chế độ ADOPT — áp công cụ migration

### A1. Nạp context
Đọc các nguồn ở **Tiền đề**; xác định ranh giới an toàn của repo đích.

### A2. Kiểm kê source
Theo [references/adopt/inventory-checklist.md](references/adopt/inventory-checklist.md). Xuất **bảng hiện trạng**; hạng
mục không đọc được ghi "KHÔNG XÁC ĐỊNH ĐƯỢC", không suy đoán.

### A3. So sánh Flyway ↔ Liquibase
Theo [references/adopt/tool-comparison-rubric.md](references/adopt/tool-comparison-rubric.md). Mỗi dòng có cột
**Bằng chứng** trích từ A2. Kết bằng khuyến nghị một dòng + lý do một dòng. Cấm bảng lý thuyết chung.

### A4. DỪNG — người dùng chọn công cụ
Trình bảng so sánh, hỏi Flyway hay Liquibase. **Chưa ghi bất kỳ file nào trước khi có câu trả lời.** Đây là cổng
cứng, không phải gợi ý.

### A5. Chuẩn bị
`git checkout -b <type>/db-migration-<flyway|liquibase>`. Ghi ADR: công cụ đã chọn, mô hình chạy (module job riêng),
vị trí migration, quy ước đặt tên, nguồn sự thật schema mới, chiến lược expand/contract.

### A6. Áp template
Theo [references/README.md](references/README.md): sinh module `<app>-db-migration` từ `references/spring-boot/common/`
+ nhánh công cụ đã chọn (nhánh còn lại KHÔNG ship vào project). Baseline sinh **một lần từ schema thật** (file DDL
sẵn có, hoặc `pg_dump --schema-only` khi người dùng cho phép kết nối). App chính chuyển `ddl-auto: validate`. Cập nhật
`project-knowledge/` + CONTRIBUTING + README của project đích. Stack khác Spring Boot: sinh layout trung tính và hỏi
người dùng trước khi ghi.

### A7. Verify + báo cáo
Build module. Boot thử job **chỉ khi người dùng cấp DB test và đồng ý** (cùng thủ tục xác nhận DB đích ở C4). Báo
cáo trung thực: đã verify gì, chưa verify gì, rủi ro còn lại.

## Chế độ CHANGE — viết một thay đổi schema

### C1. Nhận diện
Đọc công cụ + version (theo BOM/manifest), engine + version, thư mục migration, version mới nhất, quy ước đặt tên
đang dùng. Không nhận diện được công cụ → DỪNG, đề xuất chế độ `adopt`. Engine khác PostgreSQL → DỪNG, hỏi DBA (bảng
rủi ro khoá chỉ viết cho PostgreSQL).

### C2. Kế hoạch ⏸
Mỗi thay đổi → một pattern ở [references/change/change-patterns.md](references/change/change-patterns.md) → các pha
**expand / migrate data / contract**; tra mức khoá ở
[references/change/lock-risk-postgres.md](references/change/lock-risk-postgres.md). **Hỏi** số dòng của bảng bị đụng
(hoặc lấy từ ADR của project) — không có ngưỡng mặc định. Ghi rõ pha nào vào PR này, pha nào để sau. Thao tác phá huỷ
chưa được xác nhận, hoặc code bản đang chạy vẫn dùng cột/bảng đó (evidence grep `file:line`) → DỪNG. Trình kế hoạch,
chờ người dùng duyệt.

### C3. Viết
Chỉ thêm file mới (file đã có trên base branch là bất biến); đặt tên theo `CONVENTIONS.md` của công cụ; đặt
`lock_timeout`; backfill theo lô, tách khỏi migration đổi cấu trúc; Liquibase: mỗi changeSet có `rollback`. Lỡ sửa
file đã có trên base → huỷ thay đổi đó, viết file mới.

### C4. Verify ⏸
Xác nhận DB đích là **DB test** (profile/biến môi trường, host, tên database — đã mask), rồi chạy chu trình theo công cụ
ở [references/change/verify-cycle.md](references/change/verify-cycle.md). Không có DB test → `not_run` + lý do. Không
bao giờ chạy trên production.

### C5. Bàn giao
Cập nhật `project-knowledge/data-model.md`. Pha contract còn nợ → `next_actions` kèm điều kiện kích hoạt (vd "sau khi
bản app X.Y deploy hết mọi môi trường"). Viết runbook prod: thứ tự migration/deploy, thao tác có thể khoá lâu, bước
chạy ngoài transaction, migration bù nếu cần hoàn tác (Flyway forward-only).

## Report trả về

```yaml
result:
  mode: adopt | change
  summary: "<1–3 câu>"
  changes: { added: [], modified: [] }
  validation:
    - command: "<lệnh>"
      exit_code: 0
      status: passed       # passed | failed | not_run
      summary: "<số liệu>"
      reason: ""
  remaining_risks: []
  next_actions: []         # pha contract còn nợ + điều kiện kích hoạt
```

## Rủi ro còn lại (luôn nêu)
- Verify trên DB test không phản ánh đủ cỡ dữ liệu và tải của production; thời gian khoá thật có thể dài hơn.
- Bảng rủi ro khoá theo tài liệu PostgreSQL; hành vi có thể khác theo version — đối chiếu version engine thật.
- Template Spring Boot chưa được pilot trên project thật.
````

- [ ] **Step 4: Chạy lại, xác nhận assert "không offer" đỏ**

Run: `node test/install.test.mjs 2>&1 | tail -5`
Expected: `skillCatalog` pass; FAIL `offeredCatalog: KHÔNG offer backend-db-migration (draft)` và FAIL `vẫn offer đủ 8 skill` (backend đang `'*'` nên offer 9).

- [ ] **Step 5: Gate draft trong `plugins/_published.json`**

Thay mảng `published` (giữ nguyên `_comment`):

```json
  "published": [
    "backend/backend-init",
    "backend/backend-implement",
    "backend/backend-testing",
    "backend/backend-code-review",
    "backend/backend-refactor",
    "backend/backend-migrate-vault-consul",
    "backend/backend-migrate-architecture",
    "backend/backend-api-contract",
    "frontend",
    "engineering",
    "ops"
  ]
```

- [ ] **Step 6: Chạy lại install test**

Run: `node test/install.test.mjs 2>&1 | tail -3`
Expected: `INSTALL TEST: <n> pass, 0 fail`. Nếu `report: entry offered có cờ published` hoặc đếm workflow `=== 13` đỏ → đọc assert, xác nhận nguyên nhân là mục backend chuyển sang dạng mảng, báo lại trước khi sửa assert cũ.

- [ ] **Step 7: Cập nhật manifest backend**

`plugins/backend/.manifest.json`:

```json
{
  "id": "backend",
  "name": "Backend Cowork→Code",
  "description": "Workflow backend Cowork → Code (docs-first, không pipeline bắt buộc): backend-init scaffold cấu trúc thư mục + tài liệu nền (project-knowledge, ADR, data-model/ERD, layout src theo kiến trúc chọn khi init); recipe on-demand: backend-implement (vertical slice theo kiến trúc), backend-testing (test theo tầng), backend-code-review (review diff/PR), backend-refactor (giữ nguyên hành vi), backend-migrate-architecture (Onion/Hexagonal/CQRS/layered), backend-migrate-vault-consul (config/secret sang Vault/Consul), backend-api-contract (OpenAPI-first, kiểm drift); backend-db-migration (DRAFT — áp Flyway/Liquibase, thay đổi schema expand/contract).",
  "version": "1.3.0"
}
```

- [ ] **Step 8: Cập nhật `CLAUDE.md:81`**

Thay `` `backend` (8 skills), `` bằng `` `backend` (8 skills published + `backend-db-migration` draft, gated per-skill in `plugins/_published.json`), ``. Giữ nguyên phần còn lại của câu.

- [ ] **Step 9: Chạy toàn bộ**

Run: `npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]"`
Expected: `KẾT QUẢ: <n> pass, 0 fail`, `INSTALL TEST: ... 0 fail`, `WIZARD TEST: ... 0 fail`; không có dòng `fail [1-9]`.

- [ ] **Step 10: Commit qua `core:git-workflow`** (dừng cho người duyệt diff)

Header đề xuất: `feat(backend): add backend-db-migration skill as draft`

---

### Task 2: `references/adopt/`

**Files:**
- Create: `plugins/backend/skills/backend-db-migration/references/adopt/inventory-checklist.md`
- Create: `plugins/backend/skills/backend-db-migration/references/adopt/tool-comparison-rubric.md`
- Test: `test/validate.mjs` (mục 8 mới, trước khối `// ─────` cuối file)

**Interfaces:**
- Consumes: link từ `SKILL.md` (Task 1) tới 2 path trên; `listFilesRec` (`test/validate.mjs:26`), `PLUGINS_DIR`.
- Produces: khối `// 8. SOURCE: backend-db-migration` trong `test/validate.mjs`, định nghĩa `dbmRef` (đường dẫn `references/`) mà Task 3–7 thêm assert vào cùng khối.

- [ ] **Step 1: Viết assert (failing)**

Chèn vào `test/validate.mjs`, ngay trước dòng `// ─────────────────────────────────────────────────────────────────────────────` cuối file:

```js
// 8. SOURCE: backend-db-migration — hợp đồng references/ (spec 2026-09-29 §7.1, G2 §5–§7)
{
  const dbmRef = path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-db-migration', 'references');
  const dbmFiles = listFilesRec(dbmRef);
  const dbmRead = (rel) => fs.readFileSync(path.join(dbmRef, rel), 'utf8');
  const skillMd = fs.readFileSync(path.join(dbmRef, '..', 'SKILL.md'), 'utf8');
  for (const f of ['adopt/inventory-checklist.md', 'adopt/tool-comparison-rubric.md']) {
    ok(dbmFiles.includes(f), `backend-db-migration: có references/${f}`);
    ok(skillMd.includes(`(references/${f})`), `backend-db-migration: SKILL.md link tới references/${f}`);
  }
  const rubric = dbmFiles.includes('adopt/tool-comparison-rubric.md') ? dbmRead('adopt/tool-comparison-rubric.md') : '';
  ok(['T1', 'T2', 'T3', 'T4', 'T5', 'T6'].every((t) => rubric.includes(`| ${t} |`)),
    'backend-db-migration: rubric đủ 6 tiêu chí T1–T6');
  ok(rubric.includes('Bằng chứng'), 'backend-db-migration: rubric bắt buộc cột Bằng chứng');
}
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "backend-db-migration|KẾT QUẢ"`
Expected: FAIL `có references/adopt/inventory-checklist.md`, `có references/adopt/tool-comparison-rubric.md`, `rubric đủ 6 tiêu chí`, `rubric bắt buộc cột Bằng chứng`; 2 assert "SKILL.md link" pass.

- [ ] **Step 3: Tạo `references/adopt/inventory-checklist.md`**

````markdown
# Kiểm kê hiện trạng schema (chế độ `adopt`, bước A2)

Mục tiêu: một **bảng hiện trạng** có bằng chứng trích từ chính project, làm đầu vào cho rubric ở
[tool-comparison-rubric.md](tool-comparison-rubric.md). Hạng mục không đọc được → ghi "KHÔNG XÁC ĐỊNH ĐƯỢC",
không suy đoán.

## Bảng hiện trạng

| Hạng mục | Cách lấy | Dùng cho tiêu chí |
|---|---|---|
| Stack + version thật | Manifest phụ thuộc (`pom.xml` / `build.gradle` / `pyproject.toml`), BOM parent | Chọn template |
| Cơ chế schema hiện tại | `ddl-auto`, file DDL, thư mục migration cũ | Mức rủi ro |
| DB engine + version | Cấu hình datasource, driver | T1 |
| Số bảng | Đếm `CREATE TABLE` trong DDL, hoặc số entity | Quy mô baseline |
| Object engine-specific | Grep `PARTITION BY`, `CREATE TRIGGER`, `CREATE.*FUNCTION`, `WHERE` trong `CREATE INDEX`, `jsonb`, `$$` | **T2 — tiêu chí nặng** |
| Số DB engine phải hỗ trợ | ADR / `stack-profile.md` | **T1 — tiêu chí nặng** |
| Chính sách rollback | ADR, CONTRIBUTING | T3 |
| Hiện trạng DB | **HỎI** người dùng: dev bỏ được / có dữ liệu / có production | T4 + nhánh baseline |
| Ai review migration | **HỎI** người dùng | T5 |

## Cách đọc — Spring Boot

```bash
# Cơ chế schema hiện tại
grep -rnE "ddl-auto|hbm2ddl" --include=*.yml --include=*.yaml --include=*.properties src/main/resources
ls src/main/resources/db 2>/dev/null; ls src/main/resources/*.sql 2>/dev/null

# Công cụ migration đã có (Bước 0: có rồi thì sang chế độ change)
grep -nE "flyway|liquibase" pom.xml build.gradle* 2>/dev/null

# Số bảng và object engine-specific trong DDL sẵn có
grep -rliE "create table" --include=*.sql . | wc -l
grep -rnEi "partition by|create trigger|create (or replace )?function|jsonb|\\$\\$" --include=*.sql .
grep -rnEi "create (unique )?index .* where " --include=*.sql .

# Số entity (khi không có DDL)
grep -rln "@Entity" src/main/java | wc -l
```

Version thật của Spring Boot/Flyway/Liquibase lấy theo BOM mà project kế thừa (parent `pom.xml`), không theo tài liệu
mô tả của project — hai nguồn này có thể lệch nhau.

## Stack khác

Chạy được bảng hiện trạng với lệnh tương đương của stack (vd Python: `alembic.ini`, `migrations/`, SQLAlchemy
`create_all`). Template chỉ có cho Spring Boot — nói rõ với người dùng ở bước A6.

## Định dạng xuất

| Hạng mục | Giá trị | Bằng chứng |
|---|---|---|
| Cơ chế schema hiện tại | `ddl-auto: update` | `src/main/resources/application.yml:12` |
| Object engine-specific | 3 function PL/pgSQL, 1 partial index | `db/schema.sql:40`, `:88`, `:120`, `:201` |
| Hiện trạng DB | KHÔNG XÁC ĐỊNH ĐƯỢC — chờ người dùng trả lời | — |
````

- [ ] **Step 4: Tạo `references/adopt/tool-comparison-rubric.md`**

````markdown
# Rubric so sánh Flyway ↔ Liquibase (chế độ `adopt`, bước A3)

So sánh theo **dữ liệu của chính project** lấy từ bảng hiện trạng ([inventory-checklist.md](inventory-checklist.md)).
Cấm trình bày bảng lý thuyết chung không gắn dữ liệu project.

## Tiêu chí

| Mã | Tiêu chí | Nghiêng **Flyway** khi | Nghiêng **Liquibase** khi | Trọng số |
|---|---|---|---|---|
| T1 | Số DB engine phải hỗ trợ | 1 engine cố định | ≥ 2 engine từ cùng changelog | Cao |
| T2 | Tỉ lệ SQL engine-specific | Cao: partition, PL/pgSQL, partial index, `jsonb` | Thấp: chủ yếu DDL phổ thông | Cao |
| T3 | Yêu cầu rollback | Expand/contract đã là chính sách | Vận hành bắt buộc rollback declarative | Trung bình |
| T4 | Baseline DB có dữ liệu | Dev bỏ được, hoặc đã có file DDL đầy đủ | Cần `generateChangeLog` từ DB legacy chưa có DDL | Trung bình |
| T5 | Người review migration | DBA đọc SQL thô | Dev đọc changeset abstract | Trung bình |
| T6 | Ngân sách ceremony | Tối giản, cần nhân rộng nhiều project | Chấp nhận master changelog + quy ước id/author | Thấp |

## Quy tắc kết luận

T1 và T2 là hai tiêu chí nặng. Cả hai cùng nghiêng một phía → khuyến nghị phía đó và nói rõ các tiêu chí còn lại không
đủ lật ngược. T1 và T2 nghiêng ngược nhau → trình bày cả hai kịch bản, **không tự chọn**.

## Lưu ý phải nêu khi trình bày

- `clean` mặc định đã bị khoá ở Flyway (`cleanDisabled = true`).
- Cả hai đều được BOM Spring Boot pin version; không ghim tay trừ khi có ADR.
- Điểm mạnh thật của Liquibase mà Flyway Community không có: `generateChangeLog` / `diffChangeLog` để baseline một
  DB legacy chưa có DDL.
- Điểm mạnh thật của Flyway: SQL thô nguyên vẹn, không lớp trung gian nào phải "dịch".
- Chế độ `change` của skill này dùng Flyway theo **forward-only** (không undo); Liquibase có block `rollback` chạy được.

## Định dạng trình bày

| Mã | Dữ liệu project | Bằng chứng | Nghiêng |
|---|---|---|---|
| T1 | 1 engine (PostgreSQL 16) | `application.yml:8` driver `org.postgresql.Driver` | Flyway |
| T2 | 3 function PL/pgSQL, 1 partial index | `db/schema.sql:40`, `:88`, `:120`, `:201` | Flyway |
| … | … | … | … |

**Khuyến nghị:** <Flyway | Liquibase> — <một dòng lý do gắn T1/T2>.
````

- [ ] **Step 5: Chạy lại validate**

Run: `node test/validate.mjs 2>&1 | grep -E "backend-db-migration|KẾT QUẢ"`
Expected: không còn dòng FAIL chứa `backend-db-migration`; `KẾT QUẢ: <n> pass, 0 fail`.

- [ ] **Step 6: Commit qua `core:git-workflow`** (dừng cho người duyệt diff)

Header đề xuất: `feat(backend): add adopt-mode references for db-migration`

---

### Task 3: `references/change/` (đối chiếu tài liệu trước)

**Files:**
- Create: `plugins/backend/skills/backend-db-migration/references/change/change-patterns.md`
- Create: `plugins/backend/skills/backend-db-migration/references/change/lock-risk-postgres.md`
- Create: `plugins/backend/skills/backend-db-migration/references/change/verify-cycle.md`
- Test: `test/validate.mjs` (thêm vào khối mục 8)

**Interfaces:**
- Consumes: `dbmFiles`, `dbmRead`, `skillMd` trong khối mục 8 (Task 2).
- Produces: 3 file reference mà `SKILL.md` đã link; cột **Nguồn** trong `lock-risk-postgres.md`.

- [ ] **Step 1: Viết assert (failing)**

Thêm vào cuối khối mục 8 (trước dấu `}` đóng khối):

```js
  for (const f of ['change/change-patterns.md', 'change/lock-risk-postgres.md', 'change/verify-cycle.md']) {
    ok(dbmFiles.includes(f), `backend-db-migration: có references/${f}`);
    ok(skillMd.includes(`(references/${f})`), `backend-db-migration: SKILL.md link tới references/${f}`);
  }
  const cycle = dbmFiles.includes('change/verify-cycle.md') ? dbmRead('change/verify-cycle.md') : '';
  ok(['## Flyway', '## Liquibase', '## Alembic'].every((h) => cycle.includes(h)),
    'backend-db-migration: verify-cycle có đủ Flyway / Liquibase / Alembic');
  ok(cycle.includes('forward-only'), 'backend-db-migration: verify-cycle nêu Flyway forward-only (M3)');
  const lock = dbmFiles.includes('change/lock-risk-postgres.md') ? dbmRead('change/lock-risk-postgres.md') : '';
  ok(lock.includes('| Nguồn |'), 'backend-db-migration: bảng rủi ro khoá có cột Nguồn');
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "backend-db-migration|KẾT QUẢ"`
Expected: FAIL 3 assert `có references/change/...`, `verify-cycle có đủ`, `forward-only`, `cột Nguồn`.

- [ ] **Step 3: Đối chiếu tài liệu gốc (ghi chú vào `<scratchpad>/dbm-sources.md`)**

Mở từng nguồn (WebFetch hoặc trình duyệt), với mỗi dòng dưới đây ghi `khớp` / `khác: <nội dung đúng>` + mục của trang:

| # | Nhận định cần kiểm | Nguồn |
|---|---|---|
| L1 | `ADD COLUMN` không default hoặc default không volatile: không viết lại bảng (PG ≥ 11); default volatile: viết lại bảng | https://www.postgresql.org/docs/current/sql-altertable.html (Notes) |
| L2 | `SET NOT NULL` quét toàn bảng dưới `ACCESS EXCLUSIVE`, bỏ quét được khi đã có `CHECK (col IS NOT NULL)` hợp lệ (PG ≥ 12) | như L1 |
| L3 | `ADD CONSTRAINT … NOT VALID` nhanh; `VALIDATE CONSTRAINT` giữ `SHARE UPDATE EXCLUSIVE` | như L1 |
| L4 | `ADD FOREIGN KEY` khoá `SHARE ROW EXCLUSIVE` trên cả hai bảng | như L1 |
| L5 | `ALTER COLUMN TYPE` viết lại bảng trừ khi đổi kiểu binary-coercible (vd tăng độ dài `varchar`, `varchar` → `text`) | như L1 |
| L6 | `CREATE INDEX` thường giữ `SHARE` (chặn ghi); `CONCURRENTLY` giữ `SHARE UPDATE EXCLUSIVE`, không chạy được trong transaction block, fail để lại index `INVALID` | https://www.postgresql.org/docs/current/sql-createindex.html |
| L7 | `RENAME COLUMN`, `DROP COLUMN` chỉ đổi metadata, giữ `ACCESS EXCLUSIVE` ngắn | https://www.postgresql.org/docs/current/sql-altertable.html |
| L8 | Lệnh chờ `ACCESS EXCLUSIVE` chặn mọi truy vấn xếp hàng sau nó; `lock_timeout` giới hạn thời gian chờ | https://www.postgresql.org/docs/current/explicit-locking.html, https://www.postgresql.org/docs/current/runtime-config-client.html |
| F1 | Undo migration `U__` không có ở Flyway Community | Tài liệu Redgate Flyway, trang Undo |
| F2 | Cột `script` trong `flyway_schema_history` lưu path tương đối với location (đổi `classpath:` ↔ `filesystem:` không đổi identity) | Tài liệu Redgate Flyway, trang Schema History Table |
| Q1 | `spring.liquibase.test-rollback-on-update=true` chạy update → rollback → update trước khi áp | https://docs.spring.io/spring-boot/appendix/application-properties/index.html (mục Data Migration) |
| Q2 | YAML changeSet nhận `rollback` là danh sách change, gồm `sqlFile` | Tài liệu Liquibase, trang rollback |

Dòng nào `khớp` → ở Step 4–6 viết **không** kèm `[Unverified]` và điền nguồn vào cột Nguồn. Dòng nào không mở được
hoặc tài liệu mơ hồ → giữ `[Unverified]`. Dòng nào `khác` → viết theo tài liệu, không theo bảng ở trên.

- [ ] **Step 4: Tạo `references/change/lock-risk-postgres.md`**

Nội dung (điền cột Nguồn và gỡ/giữ `[Unverified]` theo kết quả Step 3):

````markdown
# Rủi ro khoá — PostgreSQL (chế độ `change`, cổng C2)

Chỉ áp cho **PostgreSQL**; engine khác → DỪNG, hỏi DBA. Hành vi có thể khác theo version — đối chiếu version engine
thật của project (C1) với cột Nguồn.

## Vì sao khoá "ngắn" vẫn nguy hiểm

Lệnh đang **chờ** một khoá `ACCESS EXCLUSIVE` chặn mọi truy vấn đến sau nó, kể cả `SELECT`. Một `ALTER TABLE` chờ sau
một transaction dài có thể làm đứng cả bảng dù bản thân lệnh chạy rất nhanh. Vì vậy mọi migration đổi cấu trúc đặt
`lock_timeout` để fail sớm và chạy lại, thay vì xếp hàng vô hạn:

```sql
SET LOCAL lock_timeout = '5s';   -- migration chạy trong transaction
SET lock_timeout = '5s';         -- migration chạy ngoài transaction (vd CREATE INDEX CONCURRENTLY)
```

## Bảng thao tác

| Thao tác | Khoá | Viết lại bảng? | Cách an toàn | Nguồn |
|---|---|---|---|---|
| `ADD COLUMN` nullable, không default | `ACCESS EXCLUSIVE` ngắn | Không | Làm trực tiếp, có `lock_timeout` | L1 |
| `ADD COLUMN … DEFAULT <hằng số>` | `ACCESS EXCLUSIVE` ngắn | Không (PG ≥ 11) | Làm trực tiếp | L1 |
| `ADD COLUMN … DEFAULT <volatile>` (vd `gen_random_uuid()`) | `ACCESS EXCLUSIVE` | **Có** | Thêm nullable → backfill theo lô → đặt default | L1 |
| `ALTER COLUMN … SET NOT NULL` | `ACCESS EXCLUSIVE` + quét toàn bảng | Không | `CHECK (col IS NOT NULL) NOT VALID` → `VALIDATE` → `SET NOT NULL` (PG ≥ 12) → drop CHECK | L2, L3 |
| `ADD CONSTRAINT CHECK` | `ACCESS EXCLUSIVE` + quét | Không | `NOT VALID` → `VALIDATE CONSTRAINT` ở migration riêng | L3 |
| `ADD FOREIGN KEY` | `SHARE ROW EXCLUSIVE` trên cả hai bảng + quét | Không | `NOT VALID` → `VALIDATE CONSTRAINT` ở migration riêng | L3, L4 |
| `ALTER COLUMN TYPE` | `ACCESS EXCLUSIVE` | **Có**, trừ đổi binary-coercible | Cột mới + backfill (pattern đổi tên) | L5 |
| `CREATE INDEX` | `SHARE` (chặn ghi) | — | `CREATE INDEX CONCURRENTLY` chạy ngoài transaction | L6 |
| `CREATE UNIQUE INDEX` / thêm `UNIQUE` | `SHARE` | — | `CREATE UNIQUE INDEX CONCURRENTLY` → `ADD CONSTRAINT … UNIQUE USING INDEX` | L6 |
| `RENAME COLUMN` / `RENAME TABLE` | `ACCESS EXCLUSIVE` ngắn | Không | Nhanh nhưng **làm vỡ code bản đang chạy** → pattern đổi tên | L7 |
| `DROP COLUMN` | `ACCESS EXCLUSIVE` ngắn | Không | Chỉ ở pha contract, sau khi code không còn dùng | L7 |

`[Unverified]` gắn ở dòng nào chưa đối chiếu được ở Task 3 Step 3 (L1–L8).

## Khi nào phải hỏi thêm

- Bảng bị đụng có số dòng lớn theo đánh giá của người dùng/ADR (skill không có ngưỡng mặc định): mọi thao tác "Có"
  ở cột viết lại bảng và mọi `VALIDATE` phải có cửa sổ chạy do người vận hành chọn.
- Thao tác không có trong bảng → DỪNG, hỏi DBA, không tự suy luận mức khoá.
````

- [ ] **Step 5: Tạo `references/change/change-patterns.md`**

````markdown
# Pattern thay đổi schema (chế độ `change`, cổng C2)

Mỗi thay đổi đi qua tối đa ba pha. Mỗi pha là **migration riêng**; pha contract nằm ở **PR sau**, chỉ khi bản app
không còn dùng cấu trúc cũ đã deploy hết mọi môi trường.

| Pha | Làm gì | Code bản đang chạy |
|---|---|---|
| expand | Thêm cấu trúc mới, không phá cái cũ (cột nullable, bảng mới, index concurrent) | Vẫn chạy bình thường |
| migrate data | Backfill dữ liệu sang cấu trúc mới | Vẫn chạy; bản mới ghi cả hai nơi nếu cần |
| contract | Siết ràng buộc, gỡ cấu trúc cũ | Đã được thay bằng bản không dùng cấu trúc cũ |

Mức khoá của từng lệnh: [lock-risk-postgres.md](lock-risk-postgres.md). Ví dụ dùng bảng `invoice`.

## Backfill theo lô

Flyway/Liquibase bọc cả file migration trong một transaction, nên `UPDATE` cả bảng trong migration là một transaction
dài giữ khoá dòng. Cách chọn:

- Bảng nhỏ (người dùng xác nhận): `UPDATE` một lần trong migration pha migrate data.
- Bảng lớn: script/job riêng chạy ngoài công cụ migration, mỗi lượt một transaction ngắn, lặp tới khi 0 dòng:

```sql
UPDATE invoice
SET note_v2 = note
WHERE id IN (
  SELECT id FROM invoice
  WHERE note_v2 IS NULL AND note IS NOT NULL
  ORDER BY id
  LIMIT 5000
);
```

Pha contract chỉ chạy khi kiểm được backfill xong: `SELECT count(*) FROM invoice WHERE note_v2 IS NULL AND note IS NOT NULL;` = 0.

## Thêm bảng

expand: `CREATE TABLE`. Không có migrate data/contract. FK tới bảng lớn → xem "Thêm FK".

## Thêm cột nullable

expand: `ALTER TABLE invoice ADD COLUMN note text;` Không có pha khác.

## Thêm cột NOT NULL

```sql
-- expand
ALTER TABLE invoice ADD COLUMN status text;
-- migrate data: backfill theo lô tới khi không còn NULL
-- contract (migration riêng, PR sau khi code luôn ghi status)
ALTER TABLE invoice ADD CONSTRAINT invoice_status_not_null CHECK (status IS NOT NULL) NOT VALID;
ALTER TABLE invoice VALIDATE CONSTRAINT invoice_status_not_null;
ALTER TABLE invoice ALTER COLUMN status SET NOT NULL;
ALTER TABLE invoice DROP CONSTRAINT invoice_status_not_null;
```

`VALIDATE` và `SET NOT NULL` nên tách migration để `VALIDATE` (khoá nhẹ) không nằm chung transaction với
`SET NOT NULL` (khoá `ACCESS EXCLUSIVE`).

## Đổi tên cột

1. expand: thêm cột mới `customer_ref`.
2. Code bản N+1 ghi **cả hai** cột, vẫn đọc cột cũ.
3. migrate data: backfill `customer_ref` từ `customer_code` theo lô.
4. Code bản N+2 đọc cột mới, vẫn ghi cả hai.
5. contract (PR sau khi N+2 deploy hết): `ALTER TABLE invoice DROP COLUMN customer_code;`

Không dùng `RENAME COLUMN` khi có code đang chạy đọc tên cũ.

## Đổi kiểu cột

Mặc định làm như **đổi tên cột** (cột mới đúng kiểu + backfill + chuyển đọc + drop cột cũ). Chỉ dùng `ALTER COLUMN TYPE`
trực tiếp khi đổi binary-coercible theo [lock-risk-postgres.md](lock-risk-postgres.md) và người dùng xác nhận.

## Thêm index

```sql
-- file chạy NGOÀI transaction: Flyway .conf executeInTransaction=false / Liquibase runInTransaction: false
SET lock_timeout = '5s';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_customer_id ON invoice (customer_id);
```

Fail giữa chừng để lại index `INVALID`: `DROP INDEX CONCURRENTLY IF EXISTS idx_invoice_customer_id;` rồi chạy lại.

## Thêm unique

```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_invoice_number ON invoice (number);   -- ngoài transaction
ALTER TABLE invoice ADD CONSTRAINT uq_invoice_number UNIQUE USING INDEX uq_invoice_number;  -- migration kế tiếp
```

Trước khi tạo: kiểm trùng `SELECT number, count(*) FROM invoice GROUP BY number HAVING count(*) > 1;` — có dòng → DỪNG,
hỏi người dùng cách xử lý dữ liệu trùng.

## Thêm FK

```sql
ALTER TABLE invoice ADD CONSTRAINT fk_invoice_customer
  FOREIGN KEY (customer_id) REFERENCES customer (id) NOT VALID;
-- migration riêng
ALTER TABLE invoice VALIDATE CONSTRAINT fk_invoice_customer;
```

Kiểm dòng mồ côi trước `VALIDATE`: `SELECT count(*) FROM invoice i LEFT JOIN customer c ON c.id = i.customer_id WHERE i.customer_id IS NOT NULL AND c.id IS NULL;`

## Drop cột / bảng

Chỉ ở pha contract. Điều kiện, đủ cả ba:

1. Grep code bản đang deploy không còn tham chiếu (evidence `file:line` = 0 kết quả, kể cả query native, view, report).
2. Người dùng xác nhận tường minh ở C2.
3. Runbook có cách khôi phục (backup/snapshot của người vận hành) — Flyway forward-only không hoàn tác được drop.
````

- [ ] **Step 6: Tạo `references/change/verify-cycle.md`**

````markdown
# Chu trình verify theo công cụ (chế độ `change`, cổng C4)

## Xác nhận DB đích — làm TRƯỚC mọi lệnh

1. Đọc cấu hình kết nối job/công cụ sẽ dùng: profile, tên biến môi trường (`DB_URL`, `DB_U`, `DB_P`…), host, tên
   database. Không in giá trị secret.
2. Trình người dùng: `profile=… host=… database=…` (đã mask). Hỏi: "Đây là DB test, không phải production?"
3. Chỉ đi tiếp khi người dùng xác nhận rõ ràng. Cấu hình kết nối đổi giữa chừng → hỏi lại.

DB test ưu tiên DB tạm: dịch vụ trong `docker compose` của project hoặc Testcontainers mà test của project đã dùng.
Dựng container mới (vd `docker run … postgres:<major version của production>`) là việc của người dùng hoặc cần người
dùng đồng ý. Không có DB test → ghi `not_run` + lý do, không tự dựng hạ tầng.

## Flyway

Flyway dùng theo **forward-only**: không chạy undo. An toàn dựa vào expand/contract; hoàn tác = migration bù mới, ghi
trong runbook.

| Bước | Lệnh (module job `<app>-db-migration`) | Chứng minh |
|---|---|---|
| (a) Từ rỗng | DB test rỗng → `java -jar target/<app>-db-migration.jar --spring.profiles.active=migration,flyway` | Toàn bộ migration chạy được từ đầu; `validate-on-migrate: true` kiểm checksum/naming |
| (b) Từ bản trước | DB test rỗng → áp migration của base branch (dưới đây) → chạy lệnh (a) | Chỉ migration mới được áp lên schema N-1 |
| (c) App | Test integration của app (vd `mvn -pl <app-module> verify`) hoặc boot app với `ddl-auto: validate` trỏ cùng DB test | Entity khớp schema mới |

Áp migration của base branch mà không đổi branch làm việc:

```bash
base_dir="<scratchpad>/dbm-base"
mkdir -p "$base_dir"
git archive <base-branch> <app>-db-migration/src/main/resources/db/migration | tar -x -C "$base_dir"
java -jar target/<app>-db-migration.jar --spring.profiles.active=migration,flyway \
  --spring.flyway.locations=filesystem:$base_dir/<app>-db-migration/src/main/resources/db/migration
```

`[Unverified]` (F2) Đổi location `classpath:` → `filesystem:` không đổi identity migration trong
`flyway_schema_history` — nếu bước (b) báo lệch checksum/script, dừng và báo, không `repair`.

## Liquibase

| Bước | Lệnh | Chứng minh |
|---|---|---|
| (a) Từ rỗng | DB test rỗng → `java -jar target/<app>-db-migration.jar --spring.profiles.active=migration,liquibase` | Changelog chạy được từ đầu |
| Up → down → up | DB test ở trạng thái trước thay đổi → chạy lệnh (a) kèm `--spring.liquibase.test-rollback-on-update=true` | Block `rollback` của changeSet mới chạy được |
| (c) App | Như Flyway (c) | Entity khớp schema mới |

`[Unverified]` (Q1) Ngữ nghĩa `test-rollback-on-update`. Nếu Task 3 Step 3 không xác nhận được, dùng Liquibase CLI /
Maven plugin theo tài liệu version của project: `update` → rollback theo số changeSet vừa thêm → `update`.

## Alembic

Không có template (M2). Chu trình: `alembic upgrade head` → `alembic downgrade -1` → `alembic upgrade head` trên DB
test đã xác nhận; mỗi revision mới phải có `downgrade()` chạy được.

## Evidence

Mỗi lệnh một mục trong `validation` của report: `command`, `exit_code`, `status`, `summary` (số migration/changeSet đã
áp, version cuối). Lệnh không chạy được → `status: not_run` + `reason`.
````

- [ ] **Step 7: Chạy lại validate**

Run: `node test/validate.mjs 2>&1 | grep -E "backend-db-migration|KẾT QUẢ"`
Expected: không còn FAIL chứa `backend-db-migration`; `0 fail`.

- [ ] **Step 8: Rà nhãn**

Run: `grep -n "Unverified" plugins/backend/skills/backend-db-migration/references/change/*.md`
Expected: mỗi dòng còn nhãn tương ứng một mục ghi `không mở được` / `mơ hồ` trong `<scratchpad>/dbm-sources.md`. Báo danh sách này trong report task.

- [ ] **Step 9: Commit qua `core:git-workflow`** (dừng cho người duyệt diff)

Header đề xuất: `feat(backend): add change-mode references for db-migration`

---

### Task 4: `references/spring-boot/common/`

**Files:**
- Create: `plugins/backend/skills/backend-db-migration/references/spring-boot/common/module-pom.xml.tpl`
- Create: `.../spring-boot/common/DbMigrationApplication.java.tpl`
- Create: `.../spring-boot/common/application-migration.yml`
- Create: `.../spring-boot/common/env.example`
- Create: `.../spring-boot/common/new-migration.sh`
- Test: `test/validate.mjs` (thêm vào khối mục 8)

**Interfaces:**
- Consumes: `dbmFiles`, `dbmRead` (Task 2).
- Produces: biến `sbFiles`, `sbRead` (file dưới `spring-boot/`) và assert parity `env.example` ↔ `${VAR}` trong mọi `*.yml` dưới `spring-boot/` — Task 5 và 6 phải giữ parity này xanh khi thêm yml. Placeholder: `{{parentGroupId}}`, `{{parentArtifactId}}`, `{{parentVersion}}`, `{{appName}}`, `{{basePackage}}`.

- [ ] **Step 1: Viết assert (failing)**

Thêm vào cuối khối mục 8:

```js
  const sbFiles = dbmFiles.filter((f) => f.startsWith('spring-boot/'));
  const sbRead = (rel) => dbmRead(rel);
  for (const f of ['module-pom.xml.tpl', 'DbMigrationApplication.java.tpl', 'application-migration.yml',
    'env.example', 'new-migration.sh']) {
    ok(sbFiles.includes(`spring-boot/common/${f}`), `backend-db-migration: có spring-boot/common/${f}`);
  }
  // B2 của G2: env.example thừa/thiếu key so với yml là lỗi im lặng lúc chạy job.
  const ymlVars = new Set(sbFiles.filter((f) => f.endsWith('.yml'))
    .flatMap((f) => [...sbRead(f).matchAll(/\$\{([A-Z0-9_]+)(?::[^}]*)?\}/g)].map((m) => m[1])));
  const envKeys = new Set(sbFiles.includes('spring-boot/common/env.example')
    ? [...sbRead('spring-boot/common/env.example').matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]) : []);
  ok(ymlVars.size > 0 && [...ymlVars].every((v) => envKeys.has(v)) && [...envKeys].every((k) => ymlVars.has(k)),
    `backend-db-migration: env.example khớp đúng biến yml (yml=${[...ymlVars].sort()} env=${[...envKeys].sort()})`);
  // D1–D3, B1 của G2: bean tự viết vô hiệu autoconfig; spring.factories trỏ class không tồn tại.
  ok(!dbmFiles.some((f) => f.endsWith('spring.factories')), 'backend-db-migration: không ship spring.factories');
  ok(sbFiles.filter((f) => f.endsWith('.tpl')).every((f) => !sbRead(f).includes('@Configuration')),
    'backend-db-migration: template không có @Configuration tự viết');
  const pom = sbFiles.includes('spring-boot/common/module-pom.xml.tpl') ? sbRead('spring-boot/common/module-pom.xml.tpl') : '';
  ok(pom.includes('<artifactId>flyway-core</artifactId>') && pom.includes('<artifactId>liquibase-core</artifactId>')
    && !/<artifactId>(flyway-core|flyway-database-postgresql|liquibase-core)<\/artifactId>\s*<version>/.test(pom),
    'backend-db-migration: pom có cả hai khối công cụ, không ghim version (để BOM pin)');
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "backend-db-migration|KẾT QUẢ"`
Expected: FAIL 5 assert `có spring-boot/common/...`, FAIL `env.example khớp` (`ymlVars.size` = 0), FAIL `pom có cả hai khối`; `không ship spring.factories` và `không có @Configuration` pass.

- [ ] **Step 3: Tạo `common/module-pom.xml.tpl`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>{{parentGroupId}}</groupId>
    <artifactId>{{parentArtifactId}}</artifactId>
    <version>{{parentVersion}}</version>
  </parent>

  <artifactId>{{appName}}-db-migration</artifactId>
  <name>{{appName}}-db-migration</name>
  <description>Job migration schema, chạy trước khi {{appName}} lên</description>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-jdbc</artifactId>
    </dependency>
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>

    <!-- Giữ ĐÚNG MỘT khối theo công cụ đã chọn ở bước A4; version để BOM Spring Boot pin (G2 P8). -->
    <!-- BEGIN flyway -->
    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-core</artifactId>
    </dependency>
    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-database-postgresql</artifactId>
    </dependency>
    <!-- END flyway -->
    <!-- BEGIN liquibase -->
    <dependency>
      <groupId>org.liquibase</groupId>
      <artifactId>liquibase-core</artifactId>
    </dependency>
    <!-- END liquibase -->
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
```

- [ ] **Step 4: Tạo `common/DbMigrationApplication.java.tpl`** (nguyên văn G2 §7.2)

```java
package {{basePackage}}.db.migration;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;

/**
 * Job migration chạy độc lập, KHÔNG phải service HTTP: schema phải sẵn sàng TRƯỚC khi app chính
 * lên, và người vận hành cần điều khiển được thời điểm chạy (ADR — mô hình module job riêng).
 */
@SpringBootApplication
public class DbMigrationApplication {

    public static void main(String[] args) {
        int exitCode = SpringApplication.exit(
                new SpringApplicationBuilder(DbMigrationApplication.class)
                        .web(WebApplicationType.NONE)
                        .run(args));
        System.exit(exitCode);
    }
}
```

- [ ] **Step 5: Tạo `common/application-migration.yml`** (nguyên văn G2 §7.3)

```yaml
spring:
  application:
    name: ${APP_NAME:db-migration}
  datasource:
    driver-class-name: org.postgresql.Driver
    url: ${DB_URL}
    username: ${DB_U}
    password: ${DB_P}
    hikari:
      maximum-pool-size: 2          # job ngắn, không cần pool lớn
      initialization-fail-timeout: 1 # fail-fast: job không có lý do sống khi thiếu DB
  jpa:
    hibernate:
      ddl-auto: none                # job KHÔNG bao giờ được đụng schema qua Hibernate
  # Mặc định TẮT cả hai; profile `flyway` hoặc `liquibase` bật đúng một (P2).
  flyway:
    enabled: false
  liquibase:
    enabled: false

logging:
  level:
    org.flywaydb: INFO
    liquibase: INFO
```

- [ ] **Step 6: Tạo `common/env.example`** (chỉ phần chung; Task 5/6 nối thêm)

```
# Kết nối DB — bắt buộc
DB_URL=jdbc:postgresql://localhost:5432/<db_name>
DB_U=<user có quyền DDL>
DB_P=

# Định danh job — tuỳ chọn, có giá trị mặc định trong yml
APP_NAME=db-migration
```

- [ ] **Step 7: Tạo `common/new-migration.sh`**

```bash
#!/usr/bin/env bash
# Sinh file migration mới. Chạy từ thư mục gốc module <app>-db-migration:
#   scripts/new-migration.sh <flyway|liquibase> <domain> "<mo ta khong dau>"
set -euo pipefail

usage() {
  echo "Cách dùng: $0 <flyway|liquibase> <domain> \"<mo ta khong dau>\"" >&2
  exit 2
}

[ "$#" -eq 3 ] || usage
tool=$1
domain=$2
desc=$3

case "$tool" in
  flyway | liquibase) ;;
  *) usage ;;
esac
if ! [[ "$domain" =~ ^[a-z0-9-]+$ ]]; then
  echo "domain chỉ gồm a-z, 0-9, '-': $domain" >&2
  exit 2
fi
# Tên file phải ASCII để mọi OS/công cụ đọc giống nhau; không tự bỏ dấu vì iconv mỗi máy cho kết quả khác.
if ! [[ "$desc" =~ ^[A-Za-z0-9\ _-]+$ ]]; then
  echo "Mô tả chỉ dùng chữ không dấu, số, khoảng trắng, '_' hoặc '-': $desc" >&2
  exit 2
fi

slug=$(printf '%s' "$desc" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/_/g; s/^_+//; s/_+$//')
slug_dash=${slug//_/-}
flyway_root=src/main/resources/db/migration
liquibase_root=src/main/resources/db/changelog

version_taken() {
  if [ "$tool" = flyway ]; then
    [ -d "$flyway_root" ] && [ -n "$(find "$flyway_root" -name "V${1}__*")" ]
  else
    [ -d "$liquibase_root" ] && [ -n "$(find "$liquibase_root" -name "${1}-*")" ]
  fi
}

version=$(date +%Y%m%d%H%M%S)
tries=0
# Hai người sinh cùng giây sẽ trùng version; tăng dần thay vì ghi đè (B5 của G2).
while version_taken "$version"; do
  version=$((version + 1))
  tries=$((tries + 1))
  if [ "$tries" -ge 60 ]; then
    echo "Không tìm được version trống sau 60 lần thử" >&2
    exit 1
  fi
done

if [ "$tool" = flyway ]; then
  dir="$flyway_root/versioned/$domain"
  file="$dir/V${version}__${slug}.sql"
  mkdir -p "$dir"
  printf -- "-- %s\n-- Pha: expand | migrate-data | contract (giữ đúng một pha)\nSET LOCAL lock_timeout = '5s';\n\n" "$desc" > "$file"
  echo "Đã tạo: $file"
  exit 0
fi

author=${MIGRATION_AUTHOR:-$(git config user.email 2>/dev/null || true)}
if [ -z "$author" ]; then
  echo "Thiếu tác giả: đặt MIGRATION_AUTHOR hoặc git config user.email" >&2
  exit 1
fi
dir="$liquibase_root/versioned/$domain"
name="${version}-${slug_dash}"
mkdir -p "$dir/sql"
cat > "$dir/$name.yaml" <<EOF
databaseChangeLog:
  - changeSet:
      id: ${name}
      author: ${author}
      changes:
        - sqlFile:
            path: sql/${name}.sql
            relativeToChangelogFile: true
      rollback:
        - sqlFile:
            path: sql/${name}.rollback.sql
            relativeToChangelogFile: true
EOF
printf -- "-- %s\nSET LOCAL lock_timeout = '5s';\n\n" "$desc" > "$dir/sql/$name.sql"
printf -- "-- Hoàn tác: %s\n\n" "$desc" > "$dir/sql/$name.rollback.sql"
echo "Đã tạo: $dir/$name.yaml"
echo "Đã tạo: $dir/sql/$name.sql"
echo "Đã tạo: $dir/sql/$name.rollback.sql"
echo "Thêm vào db.changelog-master.yaml:"
echo "  - include:"
echo "      file: versioned/$domain/$name.yaml"
echo "      relativeToChangelogFile: true"
```

- [ ] **Step 8: Chạy thử script trong sandbox**

```bash
sb="<scratchpad>/dbm-script"
mkdir -p "$sb" && cd "$sb"
bash "<repo>/plugins/backend/skills/backend-db-migration/references/spring-boot/common/new-migration.sh" flyway invoice "them cot note"
bash "<repo>/plugins/backend/skills/backend-db-migration/references/spring-boot/common/new-migration.sh" flyway invoice "them cot note"
MIGRATION_AUTHOR=dev@example.com bash "<repo>/plugins/backend/skills/backend-db-migration/references/spring-boot/common/new-migration.sh" liquibase invoice "them cot note"
bash "<repo>/plugins/backend/skills/backend-db-migration/references/spring-boot/common/new-migration.sh" flyway invoice "thêm cột"; echo "exit=$?"
bash "<repo>/plugins/backend/skills/backend-db-migration/references/spring-boot/common/new-migration.sh" flyway; echo "exit=$?"
find . -type f | sort
```

Expected:
- 2 file Flyway `src/main/resources/db/migration/versioned/invoice/V<14 số>__them_cot_note.sql` với version khác nhau (lần 2 tăng khi trùng giây).
- 3 file Liquibase (`.yaml`, `sql/*.sql`, `sql/*.rollback.sql`) + 3 dòng gợi ý include.
- Mô tả có dấu → `exit=2`; thiếu tham số → `exit=2`.

Dọn: `node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true})" "<scratchpad>/dbm-script"`

- [ ] **Step 9: Chạy lại validate**

Run: `node test/validate.mjs 2>&1 | grep -E "backend-db-migration|KẾT QUẢ"`
Expected: không còn FAIL chứa `backend-db-migration` (`ymlVars` = `APP_NAME,DB_P,DB_U,DB_URL` = `envKeys`); `0 fail`.

- [ ] **Step 10: Commit qua `core:git-workflow`** (dừng cho người duyệt diff)

Header đề xuất: `feat(backend): add Spring Boot common template for db-migration`

---

### Task 5: `references/spring-boot/flyway/`

**Files:**
- Create: `.../spring-boot/flyway/application-flyway.yml`
- Create: `.../spring-boot/flyway/CONVENTIONS.md`
- Create: `.../spring-boot/flyway/db/migration/baseline/V00000000000000__baseline_schema.sql.tpl`
- Create: `.../spring-boot/flyway/db/migration/versioned/example/V20260101120000__vi_du_them_cot.sql.tpl`
- Create: `.../spring-boot/flyway/db/migration/versioned/example/V20260101130000__vi_du_index_concurrently.sql.tpl`
- Create: `.../spring-boot/flyway/db/migration/versioned/example/V20260101130000__vi_du_index_concurrently.sql.conf`
- Create: `.../spring-boot/flyway/db/migration/repeatable/R__vi_du_function.sql.tpl`
- Modify: `.../spring-boot/common/env.example` (nối khối Flyway)
- Test: `test/validate.mjs` (thêm vào khối mục 8)

**Interfaces:**
- Consumes: `sbFiles`, `sbRead`, assert parity env (Task 4).
- Produces: biến `FLYWAY_BASELINE_ON_MIGRATE`, `FLYWAY_BASELINE_VERSION` trong cả yml lẫn `env.example`.

- [ ] **Step 1: Viết assert (failing)**

Thêm vào cuối khối mục 8:

```js
  const fw = sbFiles.filter((f) => f.startsWith('spring-boot/flyway/db/migration/'));
  const baseName = (f) => f.split('/').pop();
  ok(sbFiles.includes('spring-boot/flyway/application-flyway.yml') && sbFiles.includes('spring-boot/flyway/CONVENTIONS.md'),
    'backend-db-migration: có flyway/application-flyway.yml + CONVENTIONS.md');
  ok(fw.length === 5, `backend-db-migration: layout mẫu flyway đủ 5 file (=${fw.length})`);
  // B4 của G2: sai separator thì Flyway bỏ qua migration mà không báo.
  ok(fw.every((f) => /^(V\d{14}__[a-z0-9_]+\.sql\.(tpl|conf)|R__[a-z0-9_]+\.sql\.tpl)$/.test(baseName(f))),
    'backend-db-migration: tên file flyway đúng V<14 số>__ / R__');
  ok(fw.filter((f) => f.endsWith('.conf')).every((c) => fw.includes(c.replace(/\.conf$/, '.tpl'))),
    'backend-db-migration: mỗi .conf có migration mẫu cùng tên');
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "backend-db-migration|KẾT QUẢ"`
Expected: FAIL `có flyway/application-flyway.yml`, FAIL `layout mẫu flyway đủ 5 file (=0)`; 2 assert tên file pass (mảng rỗng).

- [ ] **Step 3: Tạo `flyway/application-flyway.yml`** (nguyên văn G2 §7.4)

```yaml
spring:
  config:
    activate:
      on-profile: flyway
  flyway:
    enabled: true
    locations: classpath:db/migration
    # MẶC ĐỊNH false: đường greenfield/dev ship file baseline chạy được (V0…) làm migration đầu.
    baseline-on-migrate: ${FLYWAY_BASELINE_ON_MIGRATE:false}
    baseline-version: ${FLYWAY_BASELINE_VERSION:0}
    validate-on-migrate: true
    validate-migration-naming: true   # bắt lỗi tên file sai NGAY (chính là B4 ở be-iam)
    clean-disabled: true
    out-of-order: false
    table: flyway_schema_history
```

- [ ] **Step 4: Nối khối Flyway vào `common/env.example`**

Thêm cuối file:

```

# Flyway — chỉ dùng khi chạy profile `flyway`
FLYWAY_BASELINE_ON_MIGRATE=false
FLYWAY_BASELINE_VERSION=0
```

- [ ] **Step 5: Tạo `flyway/CONVENTIONS.md`**

````markdown
# Quy ước Flyway

```
V<yyyyMMddHHmmss>__<mo_ta_khong_dau>.sql    versioned — ĐÃ APPLY LÀ BẤT BIẾN
R__<ten_object>.sql                          repeatable — chạy lại khi checksum đổi, SAU mọi V
<tên file migration>.conf                    cấu hình riêng cho một file (transaction, điều kiện)
```

- Separator giữa version và mô tả là **hai** dấu `_`. `validate-migration-naming: true` làm job fail khi sai.
- Sinh file bằng `scripts/new-migration.sh flyway <domain> "<mo ta>"`; không tự gõ version.
- Thư mục: `baseline/` (chỉ đường greenfield), `versioned/<domain>/`, `repeatable/`. Flyway quét đệ quy một location
  `classpath:db/migration`; thứ tự do version quyết định, không do thư mục.
- **Bất biến:** file đã có trên base branch (hoặc đã áp ở bất kỳ môi trường nào) không được sửa. Sửa = thêm file mới.
  Không dùng `repair` để "cho qua" lỗi checksum.
- **Forward-only:** không viết undo `U__`. Hoàn tác = migration bù mới, theo pattern ở
  `references/change/change-patterns.md` của skill.
- Mỗi migration đổi cấu trúc đặt `SET LOCAL lock_timeout = '5s';` ở đầu file.
- `CREATE INDEX CONCURRENTLY` cần file `.conf` cùng tên chứa `executeInTransaction=false`.
- Một migration = một pha (expand | migrate data | contract); pha contract ở PR sau.
````

- [ ] **Step 6: Tạo 5 file layout mẫu**

`flyway/db/migration/baseline/V00000000000000__baseline_schema.sql.tpl`:

```sql
-- BASELINE — chỉ cho DB RỖNG (greenfield/dev bỏ được), đi cùng FLYWAY_BASELINE_ON_MIGRATE=false.
-- DB đã có dữ liệu: KHÔNG ship file này; dùng baseline-on-migrate (xem references/README.md của skill).
-- Thay {{BASELINE_DDL}} bằng DDL sinh MỘT LẦN từ schema thật (file DDL sẵn có hoặc pg_dump --schema-only).
{{BASELINE_DDL}}
```

`flyway/db/migration/versioned/example/V20260101120000__vi_du_them_cot.sql.tpl`:

```sql
-- Mẫu pha EXPAND: thêm cột nullable, code bản đang chạy không bị ảnh hưởng.
-- lock_timeout: chờ khoá quá lâu thì fail để chạy lại, thay vì chặn mọi truy vấn xếp hàng phía sau.
SET LOCAL lock_timeout = '5s';

ALTER TABLE invoice ADD COLUMN note text;
```

`flyway/db/migration/versioned/example/V20260101130000__vi_du_index_concurrently.sql.tpl`:

```sql
-- Chạy NGOÀI transaction (file .conf cùng tên): PostgreSQL cấm CREATE INDEX CONCURRENTLY trong transaction.
-- Fail giữa chừng để lại index INVALID: DROP INDEX CONCURRENTLY IF EXISTS rồi chạy lại.
SET lock_timeout = '5s';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_customer_id ON invoice (customer_id);
```

`flyway/db/migration/versioned/example/V20260101130000__vi_du_index_concurrently.sql.conf`:

```
executeInTransaction=false
```

`flyway/db/migration/repeatable/R__vi_du_function.sql.tpl`:

```sql
-- Repeatable: Flyway chạy lại khi checksum đổi, SAU mọi migration V trong cùng lần chạy.
CREATE OR REPLACE FUNCTION invoice_total(p_invoice_id bigint)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(amount), 0) FROM invoice_line WHERE invoice_id = p_invoice_id;
$$;
```

- [ ] **Step 7: Chạy lại validate**

Run: `node test/validate.mjs 2>&1 | grep -E "backend-db-migration|KẾT QUẢ"`
Expected: không còn FAIL chứa `backend-db-migration` (parity env gồm thêm 2 biến Flyway); `0 fail`.

- [ ] **Step 8: Commit qua `core:git-workflow`** (dừng cho người duyệt diff)

Header đề xuất: `feat(backend): add Flyway template for db-migration`

---

### Task 6: `references/spring-boot/liquibase/`

**Files:**
- Create: `.../spring-boot/liquibase/application-liquibase.yml`
- Create: `.../spring-boot/liquibase/CONVENTIONS.md`
- Create: `.../spring-boot/liquibase/db/changelog/db.changelog-master.yaml`
- Create: `.../liquibase/db/changelog/baseline/20260101120000-baseline-schema.yaml`
- Create: `.../liquibase/db/changelog/baseline/sql/20260101120000-baseline-schema.sql.tpl`
- Create: `.../liquibase/db/changelog/baseline/sql/20260101120000-baseline-schema.rollback.sql.tpl`
- Create: `.../liquibase/db/changelog/versioned/example/20260101130000-vi-du-them-cot.yaml`
- Create: `.../liquibase/db/changelog/versioned/example/sql/20260101130000-vi-du-them-cot.sql`
- Create: `.../liquibase/db/changelog/versioned/example/sql/20260101130000-vi-du-them-cot.rollback.sql`
- Create: `.../liquibase/db/changelog/repeatable/20260101140000-vi-du-function.yaml`
- Create: `.../liquibase/db/changelog/repeatable/sql/20260101140000-vi-du-function.sql`
- Create: `.../liquibase/db/changelog/repeatable/sql/20260101140000-vi-du-function.rollback.sql`
- Modify: `.../spring-boot/common/env.example` (nối khối Liquibase)
- Test: `test/validate.mjs` (thêm vào khối mục 8)

**Interfaces:**
- Consumes: `sbFiles`, `sbRead`, assert parity env (Task 4).
- Produces: biến `LIQUIBASE_CONTEXTS`, `LIQUIBASE_SCHEMA` trong cả yml lẫn `env.example`.

- [ ] **Step 1: Viết assert (failing)**

Thêm vào cuối khối mục 8:

```js
  const lbRoot = 'spring-boot/liquibase/db/changelog/';
  const lb = sbFiles.filter((f) => f.startsWith(lbRoot));
  ok(sbFiles.includes('spring-boot/liquibase/application-liquibase.yml') && sbFiles.includes('spring-boot/liquibase/CONVENTIONS.md'),
    'backend-db-migration: có liquibase/application-liquibase.yml + CONVENTIONS.md');
  const lbMaster = lb.includes(lbRoot + 'db.changelog-master.yaml') ? sbRead(lbRoot + 'db.changelog-master.yaml') : '';
  const lbIncludes = [...lbMaster.matchAll(/file:\s*(\S+\.yaml)/g)].map((m) => m[1]);
  ok(lbIncludes.length === 3 && lbIncludes.every((i) => lb.includes(lbRoot + i)),
    `backend-db-migration: master include đủ 3 changelog có thật (=${lbIncludes})`);
  const lbSets = lb.filter((f) => f.endsWith('.yaml') && !f.endsWith('db.changelog-master.yaml'));
  // D6 của G2: changeSet thiếu rollback thì trả chi phí Liquibase mà mất lợi ích chính.
  ok(lbSets.length === 3 && lbSets.every((f) => {
    const c = sbRead(f);
    return (c.match(/- changeSet:/g) || []).length === (c.match(/^\s+rollback:/gm) || []).length;
  }), 'backend-db-migration: mỗi changeSet mẫu có rollback');
  ok(lbSets.every((f) => [...sbRead(f).matchAll(/path:\s*(\S+)/g)].every((m) => {
    const p = path.posix.join(path.posix.dirname(f), m[1]);
    return lb.includes(p) || lb.includes(p + '.tpl');
  })), 'backend-db-migration: sqlFile trong changeSet trỏ tới file có thật');
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "backend-db-migration|KẾT QUẢ"`
Expected: FAIL `có liquibase/application-liquibase.yml`, FAIL `master include đủ 3 changelog (=)`, FAIL `mỗi changeSet mẫu có rollback`; `sqlFile ... có thật` pass (mảng rỗng).

- [ ] **Step 3: Tạo `liquibase/application-liquibase.yml`** (nguyên văn G2 §7.5)

```yaml
spring:
  config:
    activate:
      on-profile: liquibase
  liquibase:
    enabled: true
    change-log: classpath:db/changelog/db.changelog-master.yaml
    contexts: ${LIQUIBASE_CONTEXTS:}
    default-schema: ${LIQUIBASE_SCHEMA:public}
    database-change-log-table: DATABASECHANGELOG
    database-change-log-lock-table: DATABASECHANGELOGLOCK
    test-rollback-on-update: false   # bật true ở môi trường staging để kiểm block rollback
```

- [ ] **Step 4: Nối khối Liquibase vào `common/env.example`**

Thêm cuối file:

```

# Liquibase — chỉ dùng khi chạy profile `liquibase`
LIQUIBASE_CONTEXTS=
LIQUIBASE_SCHEMA=public
```

- [ ] **Step 5: Tạo `liquibase/CONVENTIONS.md`**

````markdown
# Quy ước Liquibase

```
db.changelog-master.yaml                     chỉ chứa include, không chứa change
<yyyyMMddHHmmss>-<mo-ta-gach-noi>.yaml       một nhóm changeSet
sql/<cùng tên>.sql                           SQL thô, changeSet trỏ vào bằng sqlFile
sql/<cùng tên>.rollback.sql                  SQL hoàn tác, block rollback trỏ vào
changeSet.id     = <yyyyMMddHHmmss>-<mo-ta>
changeSet.author = <tên thật hoặc email>
```

- Sinh file bằng `scripts/new-migration.sh liquibase <domain> "<mo ta>"`, rồi thêm dòng `include` script in ra vào
  master theo đúng thứ tự thời gian.
- **Mỗi changeSet có block `rollback`**; rollback kiểm được bằng chu trình ở `references/change/verify-cycle.md`.
- Repeatable = `runOnChange: true` trên changeSet (Liquibase không có thư mục/khái niệm repeatable riêng).
- File SQL chứa `$$` (PL/pgSQL) đặt `splitStatements: false`.
- `CREATE INDEX CONCURRENTLY` đặt `runInTransaction: false` trên changeSet đó.
- **Bất biến:** changeSet đã có trên base branch không được sửa (trừ changeSet `runOnChange`). Không dùng
  `clearCheckSums` để "cho qua".
- Mỗi migration đổi cấu trúc đặt `SET LOCAL lock_timeout = '5s';` ở đầu file SQL.
````

- [ ] **Step 6: Tạo master + 3 changelog mẫu + SQL**

`liquibase/db/changelog/db.changelog-master.yaml`:

```yaml
databaseChangeLog:
  - include:
      file: baseline/20260101120000-baseline-schema.yaml
      relativeToChangelogFile: true
  - include:
      file: versioned/example/20260101130000-vi-du-them-cot.yaml
      relativeToChangelogFile: true
  - include:
      file: repeatable/20260101140000-vi-du-function.yaml
      relativeToChangelogFile: true
```

`liquibase/db/changelog/baseline/20260101120000-baseline-schema.yaml`:

```yaml
databaseChangeLog:
  - changeSet:
      id: 20260101120000-baseline-schema
      author: ten.that@example.com
      changes:
        - sqlFile:
            path: sql/20260101120000-baseline-schema.sql
            relativeToChangelogFile: true
      rollback:
        - sqlFile:
            path: sql/20260101120000-baseline-schema.rollback.sql
            relativeToChangelogFile: true
```

`liquibase/db/changelog/baseline/sql/20260101120000-baseline-schema.sql.tpl`:

```sql
-- BASELINE — thay {{BASELINE_DDL}} bằng DDL sinh MỘT LẦN từ schema thật
-- (file DDL sẵn có, pg_dump --schema-only, hoặc generateChangeLog với DB legacy chưa có DDL).
{{BASELINE_DDL}}
```

`liquibase/db/changelog/baseline/sql/20260101120000-baseline-schema.rollback.sql.tpl`:

```sql
-- Hoàn tác baseline: DROP theo thứ tự NGƯỢC phụ thuộc (bảng con trước bảng cha). Chỉ dùng trên DB test.
{{BASELINE_ROLLBACK_DDL}}
```

`liquibase/db/changelog/versioned/example/20260101130000-vi-du-them-cot.yaml`:

```yaml
databaseChangeLog:
  - changeSet:
      id: 20260101130000-vi-du-them-cot
      author: ten.that@example.com
      changes:
        - sqlFile:
            path: sql/20260101130000-vi-du-them-cot.sql
            relativeToChangelogFile: true
      rollback:
        - sqlFile:
            path: sql/20260101130000-vi-du-them-cot.rollback.sql
            relativeToChangelogFile: true
```

`liquibase/db/changelog/versioned/example/sql/20260101130000-vi-du-them-cot.sql`:

```sql
-- Mẫu pha EXPAND: thêm cột nullable, code bản đang chạy không bị ảnh hưởng.
-- lock_timeout: chờ khoá quá lâu thì fail để chạy lại, thay vì chặn mọi truy vấn xếp hàng phía sau.
SET LOCAL lock_timeout = '5s';

ALTER TABLE invoice ADD COLUMN note text;
```

`liquibase/db/changelog/versioned/example/sql/20260101130000-vi-du-them-cot.rollback.sql`:

```sql
ALTER TABLE invoice DROP COLUMN note;
```

`liquibase/db/changelog/repeatable/20260101140000-vi-du-function.yaml`:

```yaml
databaseChangeLog:
  - changeSet:
      id: 20260101140000-vi-du-function
      author: ten.that@example.com
      # runOnChange: sửa thân hàm thì changeSet chạy lại thay vì báo lỗi checksum (D5 của G2).
      runOnChange: true
      changes:
        - sqlFile:
            path: sql/20260101140000-vi-du-function.sql
            relativeToChangelogFile: true
            # Thân hàm PL/pgSQL chứa ';' bên trong $$ … $$, tách câu sẽ cắt hỏng hàm.
            splitStatements: false
      rollback:
        - sqlFile:
            path: sql/20260101140000-vi-du-function.rollback.sql
            relativeToChangelogFile: true
```

`liquibase/db/changelog/repeatable/sql/20260101140000-vi-du-function.sql`:

```sql
CREATE OR REPLACE FUNCTION invoice_total(p_invoice_id bigint)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(amount), 0) FROM invoice_line WHERE invoice_id = p_invoice_id;
$$;
```

`liquibase/db/changelog/repeatable/sql/20260101140000-vi-du-function.rollback.sql`:

```sql
-- Hoàn tác về trạng thái KHÔNG có hàm; muốn về bản thân hàm cũ thì viết changeSet mới.
DROP FUNCTION IF EXISTS invoice_total(bigint);
```

- [ ] **Step 7: Chạy lại validate**

Run: `node test/validate.mjs 2>&1 | grep -E "backend-db-migration|KẾT QUẢ"`
Expected: không còn FAIL chứa `backend-db-migration` (parity env = 8 biến: `APP_NAME, DB_P, DB_U, DB_URL, FLYWAY_BASELINE_ON_MIGRATE, FLYWAY_BASELINE_VERSION, LIQUIBASE_CONTEXTS, LIQUIBASE_SCHEMA`); `0 fail`.

- [ ] **Step 8: Commit qua `core:git-workflow`** (dừng cho người duyệt diff)

Header đề xuất: `feat(backend): add Liquibase template for db-migration`

---

### Task 7: `references/README.md` + kiểm chứng cuối

**Files:**
- Create: `plugins/backend/skills/backend-db-migration/references/README.md`
- Test: `test/validate.mjs` (thêm vào khối mục 8)

**Interfaces:**
- Consumes: mọi file của Task 2–6; link `(references/README.md)` trong `SKILL.md` (Task 1).
- Produces: —

- [ ] **Step 1: Viết assert (failing)**

Thêm vào cuối khối mục 8:

```js
  ok(dbmFiles.includes('README.md') && !dbmFiles.includes('spring-boot/README.md'),
    'backend-db-migration: README ở gốc references/, không ở spring-boot/ (trùng path với vault-consul)');
  ok(skillMd.includes('(references/README.md)'), 'backend-db-migration: SKILL.md link tới references/README.md');
  const readme = dbmFiles.includes('README.md') ? dbmRead('README.md') : '';
  ok(sbFiles.every((f) => readme.includes(f.replace(/^spring-boot\//, ''))),
    'backend-db-migration: README liệt kê mọi file template spring-boot/');
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "backend-db-migration|KẾT QUẢ"`
Expected: FAIL `README ở gốc references/`, FAIL `README liệt kê mọi file`.

- [ ] **Step 3: Tạo `references/README.md`**

````markdown
# Kit template `backend-db-migration` — Spring Boot + PostgreSQL

Dùng ở bước **A6** (chế độ `adopt`). Chỉ có template cho Spring Boot 3 + PostgreSQL; stack khác sinh layout trung tính
và hỏi người dùng. Template **chưa được pilot** trên project thật.

## Mô hình

Module `<app>-db-migration` là một **job** (`WebApplicationType.NONE`) chạy trước khi app chính lên. App chính dùng
`ddl-auto: validate`, tắt Flyway/Liquibase. Công cụ bật bằng profile: `migration` + đúng một trong `flyway` /
`liquibase`.

```bash
java -jar <app>-db-migration.jar --spring.profiles.active=migration,flyway
java -jar <app>-db-migration.jar --spring.profiles.active=migration,liquibase
```

Exit code khác 0 khi migration fail (`SpringApplication.exit` + `System.exit`), để CI/CD dừng deploy.

## Ma trận file

| File trong kit | Đích trong module | Ghi chú |
|---|---|---|
| `common/module-pom.xml.tpl` | `pom.xml` | Giữ đúng một khối `BEGIN/END flyway` hoặc `BEGIN/END liquibase` |
| `common/DbMigrationApplication.java.tpl` | `src/main/java/<basePackage dạng thư mục>/db/migration/DbMigrationApplication.java` | |
| `common/application-migration.yml` | `src/main/resources/application-migration.yml` | Tắt cả hai công cụ mặc định |
| `common/env.example` | `env.example` | Xoá khối biến của công cụ không chọn |
| `common/new-migration.sh` | `scripts/new-migration.sh` | Chạy từ thư mục gốc module |
| `flyway/application-flyway.yml` | `src/main/resources/application-flyway.yml` | Chỉ nhánh Flyway |
| `flyway/CONVENTIONS.md` | `CONVENTIONS.md` của module | Chỉ nhánh Flyway |
| `flyway/db/migration/baseline/V00000000000000__baseline_schema.sql.tpl` | `src/main/resources/db/migration/baseline/V00000000000000__baseline_schema.sql` | Chỉ đường greenfield (xem dưới) |
| `flyway/db/migration/versioned/example/V20260101120000__vi_du_them_cot.sql.tpl` | — | Mẫu tham khảo, không copy |
| `flyway/db/migration/versioned/example/V20260101130000__vi_du_index_concurrently.sql.tpl` | — | Mẫu tham khảo, không copy |
| `flyway/db/migration/versioned/example/V20260101130000__vi_du_index_concurrently.sql.conf` | — | Mẫu `.conf` đi cùng file trên |
| `flyway/db/migration/repeatable/R__vi_du_function.sql.tpl` | — | Mẫu tham khảo, không copy |
| `liquibase/application-liquibase.yml` | `src/main/resources/application-liquibase.yml` | Chỉ nhánh Liquibase |
| `liquibase/CONVENTIONS.md` | `CONVENTIONS.md` của module | Chỉ nhánh Liquibase |
| `liquibase/db/changelog/db.changelog-master.yaml` | `src/main/resources/db/changelog/db.changelog-master.yaml` | Bỏ 2 include mẫu, giữ baseline |
| `liquibase/db/changelog/baseline/20260101120000-baseline-schema.yaml` | `src/main/resources/db/changelog/baseline/<timestamp>-baseline-schema.yaml` | Đổi id/author thật |
| `liquibase/db/changelog/baseline/sql/20260101120000-baseline-schema.sql.tpl` | `.../baseline/sql/<timestamp>-baseline-schema.sql` | |
| `liquibase/db/changelog/baseline/sql/20260101120000-baseline-schema.rollback.sql.tpl` | `.../baseline/sql/<timestamp>-baseline-schema.rollback.sql` | |
| `liquibase/db/changelog/versioned/example/20260101130000-vi-du-them-cot.yaml` | — | Mẫu tham khảo, không copy |
| `liquibase/db/changelog/versioned/example/sql/20260101130000-vi-du-them-cot.sql` | — | Mẫu tham khảo |
| `liquibase/db/changelog/versioned/example/sql/20260101130000-vi-du-them-cot.rollback.sql` | — | Mẫu tham khảo |
| `liquibase/db/changelog/repeatable/20260101140000-vi-du-function.yaml` | — | Mẫu tham khảo |
| `liquibase/db/changelog/repeatable/sql/20260101140000-vi-du-function.sql` | — | Mẫu tham khảo |
| `liquibase/db/changelog/repeatable/sql/20260101140000-vi-du-function.rollback.sql` | — | Mẫu tham khảo |

Nhánh công cụ **không chọn** không được ship vào project đích.

## Placeholder

| Placeholder | Lấy từ |
|---|---|
| `{{parentGroupId}}`, `{{parentArtifactId}}`, `{{parentVersion}}` | Parent `pom.xml` của project (phải kế thừa hoặc import BOM Spring Boot) |
| `{{appName}}` | Tên app chính |
| `{{basePackage}}` | Package gốc của app chính |
| `{{BASELINE_DDL}}` | DDL sinh một lần từ schema thật |
| `{{BASELINE_ROLLBACK_DDL}}` | DROP theo thứ tự ngược phụ thuộc (chỉ Liquibase) |

## Baseline Flyway — hai đường loại trừ nhau

- **DB rỗng** (greenfield/dev bỏ được): ship `V00000000000000__baseline_schema.sql`, giữ
  `FLYWAY_BASELINE_ON_MIGRATE=false`.
- **DB đã có dữ liệu**: KHÔNG ship file baseline; đặt `FLYWAY_BASELINE_ON_MIGRATE=true` và `FLYWAY_BASELINE_VERSION` =
  version ngay trước migration đầu tiên muốn chạy.

`[Unverified]` Với `baseline-on-migrate=true`, Flyway bỏ qua migration có version ≤ baseline — không bật cả hai đường
cùng lúc; xác nhận trên Flyway của project khi pilot.

## Lưu ý dependency

`flyway-database-postgresql` không khai `<version>` để BOM pin. `[Unverified]` Nếu BOM của project không quản version
artifact này, Maven báo thiếu version → hỏi người dùng, ghi ADR trước khi thêm version tay.
````

- [ ] **Step 4: Chạy validate + build**

Run: `npm run build 2>&1 | tail -3 && node test/validate.mjs 2>&1 | grep -E "backend-db-migration|KẾT QUẢ"`
Expected: build xong không lỗi; không FAIL chứa `backend-db-migration`; `0 fail` (gồm parity `references/` ở 4 provider, mục 4).

- [ ] **Step 5: Kiểm build ở 4 provider**

Run: `find build -path "*backend-db-migration*" -name README.md | sort`
Expected: 4 dòng, mỗi provider một (`build/claude/…`, `build/codex/…`, `build/cursor/…`, `build/antigravity/…`), đều nằm dưới `references/`.

- [ ] **Step 6: Toàn bộ test + pack**

Run: `npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]" ; npm run pack:verify 2>&1 | tail -3`
Expected: mọi dòng `0 fail`; pack-guard không báo vi phạm.

- [ ] **Step 7: Smoke cài draft trong sandbox**

```bash
sb="<scratchpad>/dbm-install"
mkdir -p "$sb"
AIE_INSTALL_ROOT="$sb" node cli/index.mjs install --provider claude --skill backend/backend-db-migration --yes
AIE_INSTALL_ROOT="$sb" node cli/index.mjs check
find -L "$sb" -path "*backend-db-migration*" -name SKILL.md
```

Expected: install exit 0; `check` liệt kê entry có `backend/backend-db-migration`; `find` in ra 1 đường dẫn `SKILL.md`.

Install tạo junction/symlink trỏ vào `build/`; `find` mặc định không đi theo link nên phải có `-L`.

Dọn (không dùng `rm -rf` — sandbox có junction):
`node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true})" "<scratchpad>/dbm-install"`
Sau khi dọn: `node test/validate.mjs 2>&1 | tail -1` vẫn `0 fail` (xác nhận `build/` không bị xoá xuyên junction).

- [ ] **Step 8: Commit qua `core:git-workflow`** (dừng cho người duyệt diff)

Header đề xuất: `feat(backend): add references README and verify db-migration kit`

---

## Ngoài plan này (pha publish, sau pilot — spec §7.1.10, §9 P1b)

- Thêm `backend/backend-db-migration` vào `plugins/_published.json`.
- Thêm `backend-db-migration` vào `skills` của `plugins/backend/agents/backend-implementer.md`.
- WF3: sửa `workflows/db-change/WORKFLOW.md` (Bước 6 verify theo công cụ, thêm bước test, cập nhật `data-model.md`).
- S8: pointer ở `plugins/backend/skills/backend-implement/SKILL.md:78`, `:89`.
- Q6: chọn project pilot.
