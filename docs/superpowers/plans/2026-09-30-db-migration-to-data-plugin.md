# Chuyển backend-db-migration sang plugin data (ADR 0001) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thực hiện quyết định của người dùng "dữ liệu liên quan database → move về plugin `data`": chuyển skill draft `backend-db-migration` từ plugin `backend` sang plugin `data` với tên `data-db-migration` (giữ nguyên nội dung và lịch sử git), cập nhật test, manifest, `CLAUDE.md`, rồi ghi quyết định thành ADR `docs/decisions/0001-…` và ghi chú vào spec (đóng câu hỏi Q5).

**Architecture:** `git mv` cả thư mục skill (31 file) sang `plugins/data/skills/data-db-migration/`. Quy tắc của `test/validate.mjs:216` buộc tên skill bắt đầu bằng id plugin, nên phải đổi tên `backend-db-migration` → `data-db-migration` (`name`, tiêu đề, hai file có chuỗi tên cũ). Plugin `data` chưa nằm trong `plugins/_published.json` nên skill vẫn là draft; không sửa `_published.json`. Quy tắc phân ranh với `data-oltp-implement` (Bước 0 của skill) giữ nguyên, nay nằm trong cùng một plugin.

**Tech Stack:** Markdown + YAML frontmatter (parser zero-dep của repo); harness `ok(cond, msg)` của repo (Node ≥ 20, ESM, zero dependency).

**Spec:** [docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md](../specs/2026-09-29-skill-plugin-workflow-upgrade-design.md) §7.1 (thiết kế `backend-db-migration`), §7.1.3 (quy tắc phân ranh), §11 Q5, §9 (P1 "ADR phân ranh").

## Quyết định của plan (người dùng chưa nêu — có thể đổi)

| # | Quyết định | Lý do |
|---|---|---|
| D-1 | Tên mới `data-db-migration`, `order: 5`, `stageNumber: "05"` | `test/validate.mjs:216` buộc tên skill bắt đầu bằng `<plugin>-`; `order` 1–4 đã dùng trong plugin `data` |
| D-2 | Chỉ chuyển skill `backend-db-migration`; không chuyển skill khác | Người dùng nêu "dữ liệu liên quan database"; `backend-migrate-vault-consul` là cấu hình/secret, không phải dữ liệu |
| D-3 | Không đổi nội dung kỹ thuật của skill/references (chỉ tên, tiêu đề, câu trỏ "plugin `data`") | Tránh trộn di chuyển với thay đổi hành vi; `git mv` giữ lịch sử |
| D-4 | Không sửa `_published.json`; skill draft cùng plugin `data` | Plugin `data` là draft nguyên khối (spec M4: publish sau pilot); pha publish sau này thêm mục `data/data-db-migration` hoặc `data` |
| D-5 | Bump `plugins/data/.manifest.json` version `1.1.1` → `1.2.0`; không đổi version `backend` | Thêm skill vào `data`; backend chưa từng publish skill này |
| D-6 | ADR đặt Status `Accepted` (ngày 2026-09-30) vì người dùng đã chốt trong chat | Skill `engineering-adr`: người dùng chốt Status; ghi rõ nguồn quyết định |
| D-7 | Spec chỉ thêm ghi chú (không viết lại mọi đường dẫn cũ) | Spec là tài liệu thiết kế; ghi chú ở §7.1 và đóng Q5 đủ để không gây hiểu nhầm |

## Global Constraints

- Docs/tests only: KHÔNG sửa `cli/`, `adapters/`, `core/`, `workflows/`, `plugins/_published.json`, agent nào, skill nào khác ngoài `backend-db-migration` (được chuyển).
- Nội dung 29 file `references/` không đổi (trừ `references/README.md` chỉ đổi chuỗi tên) và cây thư mục `references/**` giữ nguyên tương đối (validate block 8 kiểm theo đường dẫn tương đối).
- Không còn chuỗi `backend-db-migration` trong `plugins/`, `test/`, `CLAUDE.md` sau Task 1 (docs/superpowers/ cũ giữ nguyên như bản ghi lịch sử, trừ ghi chú ở Task 2).
- Frontmatter skill sau chuyển: `name: data-db-migration`, `order: 5`, `stageNumber: "05"`, `runsIn: execute`, `invoke: per-request`, `pipeline: false`, `next: null`; không có `sharedAssets` (plugin `data` không có `templates/`).
- Quy tắc phân ranh (Bước 0, bảng chế độ) giữ nguyên ý nghĩa: có `data-oltp-init`/schema là contract nhiều consumer → dừng, dùng `data-oltp-implement`; có cả hai dấu hiệu → hỏi người dùng.
- File UTF-8 không BOM, LF. Nội dung tiếng Việt có dấu. Comment chỉ giải thích *why*, tiếng Việt, 1–2 dòng.
- Không sửa assert cũ ngoài việc đổi tên/đường dẫn của skill; không thêm file test mới; assert mới chỉ thêm vào block "8." của `test/validate.mjs` và khối draft ở `test/install.test.mjs`.
- `build/` có thể cũ sau khi chuyển: chạy `npm run build` trước khi chạy `validate`. Không `rm -rf` thư mục chứa junction; dọn sandbox bằng `node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true})" <dir>` [[windows-junction-rm-hazard]]. Lệnh `find` trên thư mục cài phải là `find -L`.
- Mỗi task = 1 commit qua skill `core:git-workflow` (header EN, body VI có dấu, commit bằng `git commit -F`, KHÔNG trailer `Co-Authored-By`). Push/PR/merge: chờ người dùng.
- Làm trên branch riêng, không commit lên `master` (xem Task 0).
- `<scratchpad>` trong lệnh = thư mục tạm của phiên thực thi, nằm NGOÀI repo.

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/data/skills/data-db-migration/**` (chuyển từ `plugins/backend/skills/backend-db-migration/**`) | Skill draft, 31 file | 1 |
| `plugins/backend/.manifest.json` | Bỏ mệnh đề db-migration khỏi description | 1 |
| `plugins/data/.manifest.json` | Nêu skill mới, version `1.2.0` | 1 |
| `CLAUDE.md` | Câu catalog plugin: backend 8 published, data 5 draft | 1 |
| `test/validate.mjs` | Block "8." trỏ đường dẫn/tên mới + 2 assert vị trí | 1 |
| `test/install.test.mjs` | Khối draft đổi sang `data/data-db-migration` | 1 |
| `docs/decisions/0001-database-capabilities-in-data-plugin.md` | ADR (Nygard) ghi quyết định | 2 |
| `docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md` | Ghi chú ở §7.1 + đóng Q5 | 2 |

---

### Task 0: Branch và commit plan

**Files:**
- Commit: `docs/superpowers/plans/2026-09-30-db-migration-to-data-plugin.md` (file này)

**Interfaces:**
- Consumes: branch `master` (đang đứng), working tree sạch trừ file plan.
- Produces: branch `refactor/db-migration-to-data-plugin` mà mọi task sau commit lên.

- [ ] **Step 1: Kiểm tra trạng thái**

Run: `git status --short && git branch --show-current`
Expected: chỉ file plan untracked; branch `master`.

- [ ] **Step 2: Tạo branch và commit plan qua `core:git-workflow`**

Run: `git checkout -b refactor/db-migration-to-data-plugin && git add docs/superpowers/plans/2026-09-30-db-migration-to-data-plugin.md && git status --short`
Header đề xuất: `docs(specs): add db-migration to data plugin move plan`

---

### Task 1: Chuyển skill sang plugin `data`

**Files:**
- Move: `plugins/backend/skills/backend-db-migration/` → `plugins/data/skills/data-db-migration/`
- Modify: `plugins/data/skills/data-db-migration/SKILL.md`, `plugins/data/skills/data-db-migration/references/README.md`
- Modify: `plugins/backend/.manifest.json`, `plugins/data/.manifest.json`, `CLAUDE.md`
- Test: `test/validate.mjs` (block "8."), `test/install.test.mjs` (khối `backend-db-migration là DRAFT`)

**Interfaces:**
- Consumes: skill hiện có ở `plugins/backend/skills/backend-db-migration/`; `skillCatalog()`, `offeredCatalog()` (đã import ở `test/install.test.mjs`).
- Produces: skill id `data/data-db-migration` mà ADR (Task 2) nhắc tới.

- [ ] **Step 1: Sửa assert trước (failing)**

(a) `test/validate.mjs`, block "8.": đổi comment đầu block thành `// 8. SOURCE: data-db-migration — hợp đồng references/ (spec 2026-09-29 §7.1, G2 §5–§7; ADR 0001: skill thuộc plugin data)`; đổi dòng
`const dbmRef = path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-db-migration', 'references');`
thành
`const dbmRef = path.join(PLUGINS_DIR, 'data', 'skills', 'data-db-migration', 'references');`;
đổi mọi chuỗi `backend-db-migration` còn lại trong block (thông điệp assert `'backend-db-migration: …'`) thành `data-db-migration`. Ngay sau dòng `const skillMd = skillExists ? … : '';` chèn 2 assert:

```js
  // ADR 0001: mọi năng lực liên quan database thuộc plugin data; bản cũ ở backend phải biến mất hẳn.
  ok(!fs.existsSync(path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-db-migration')),
    'data-db-migration: không còn thư mục backend-db-migration ở plugin backend');
  ok(/^name: data-db-migration$/m.test(skillMd) && /^order: 5$/m.test(skillMd) && /^stageNumber: "05"$/m.test(skillMd),
    'data-db-migration: frontmatter name, order 5, stageNumber "05" trong plugin data');
```

(b) `test/install.test.mjs`: thay toàn bộ khối bắt đầu bằng comment `// backend-db-migration là DRAFT (spec 2026-09-29 §7.1.1 M4): …` (từ dòng comment tới dấu `}` đóng khối) bằng:

```js
// data-db-migration là DRAFT (plugin data chưa publish; spec 2026-09-29 §7.1.1 M4, ADR 0001): có trên đĩa nhưng wizard không offer.
{
  const daAll = skillCatalog().plugins.find((p) => p.id === 'data');
  ok(daAll && daAll.skillIds.includes('data/data-db-migration'),
    'skillCatalog: có data/data-db-migration (draft vẫn cài được bằng --skill)');
  ok(!offeredCatalog().plugins.some((p) => p.id === 'data'),
    'offeredCatalog: KHÔNG offer plugin data (draft), gồm data-db-migration');
  const beAll = skillCatalog().plugins.find((p) => p.id === 'backend');
  ok(beAll && !beAll.skillIds.some((s) => s.includes('db-migration')),
    'skillCatalog: plugin backend không còn skill db-migration');
  const beOff = offeredCatalog().plugins.find((p) => p.id === 'backend');
  ok(beOff && beOff.skillIds.length === 8, 'offeredCatalog: vẫn offer đủ 8 skill backend đã publish');
}
```

- [ ] **Step 2: Chạy, xác nhận đỏ đúng lý do**

Run: `node test/install.test.mjs 2>&1 | tail -5; node test/validate.mjs 2>&1 | grep -E "data-db-migration|KẾT QUẢ" | head -20`
Expected: `install`: FAIL `skillCatalog: có data/data-db-migration` và FAIL `plugin backend không còn skill db-migration`; `validate`: FAIL hàng loạt assert `data-db-migration: …` vì đường dẫn mới chưa tồn tại (gồm `không còn thư mục …` FAIL và `frontmatter name…` FAIL).

- [ ] **Step 3: Chuyển thư mục và đổi tên**

```bash
git mv plugins/backend/skills/backend-db-migration plugins/data/skills/data-db-migration
```

Trong `plugins/data/skills/data-db-migration/SKILL.md`:
- frontmatter: `name: backend-db-migration` → `name: data-db-migration`; `order: 9` → `order: 5`; `stageNumber: "09"` → `stageNumber: "05"`; `title: "Backend DB Migration — …"` → `title: "Data DB Migration — Áp công cụ migration & viết thay đổi schema an toàn (recipe on-demand)"`.
- H1 `# Backend DB Migration — …` → `# Data DB Migration — Áp công cụ migration & viết thay đổi schema an toàn (recipe on-demand)`.
- Mục "Tiền đề", thay đúng đoạn
```
- Project đã chạy `data-oltp-init` hoặc sở hữu DB như sản phẩm (schema contract cho nhiều consumer) → KHÔNG dùng
  skill này; dùng `data-oltp-implement` (plugin `data`).
```
bằng
```
- Project đã chạy `data-oltp-init` hoặc sở hữu DB như sản phẩm (schema contract cho nhiều consumer) → KHÔNG dùng
  skill này; dùng `data-oltp-implement` (cùng plugin `data`).
```
- Giữ nguyên mọi nội dung khác của `SKILL.md`. Nếu còn chuỗi `backend-db-migration` ở chỗ khác trong file → đổi thành `data-db-migration`.

Trong `plugins/data/skills/data-db-migration/references/README.md`: dòng 1 `# Kit template \`backend-db-migration\` — Spring Boot + PostgreSQL` → `# Kit template \`data-db-migration\` — Spring Boot + PostgreSQL`; các chuỗi `backend-db-migration` khác (nếu có) → `data-db-migration`.

- [ ] **Step 4: Cập nhật manifest và `CLAUDE.md`**

(a) `plugins/backend/.manifest.json`: trong `description`, thay đúng cụm cuối `backend-api-contract (OpenAPI-first, kiểm drift); backend-db-migration (DRAFT — áp Flyway/Liquibase, thay đổi schema expand/contract).` bằng `backend-api-contract (OpenAPI-first, kiểm drift).` (dấu `;` thành `.`, bỏ mệnh đề db-migration). Giữ `version` `1.3.0`.

(b) `plugins/data/.manifest.json`: trong `description`, thay đúng cụm `Docs-first, không pipeline bắt buộc: *-init scaffold tài liệu nền, *-implement hiện thực.` bằng `Docs-first, không pipeline bắt buộc: *-init scaffold tài liệu nền, *-implement hiện thực; data-db-migration (DRAFT — áp Flyway/Liquibase cho một backend project và viết thay đổi schema theo expand/contract; dừng và dùng data-oltp-implement khi schema là contract cho nhiều consumer).` Đổi `"version": "1.1.1"` thành `"version": "1.2.0"`. Giữ định dạng file (2 space, một dòng `description`).

(c) `CLAUDE.md` dòng ~81: thay `` `backend` (8 skills published + `backend-db-migration` draft, gated per-skill in `plugins/_published.json`) `` bằng `` `backend` (8 skills published, gated per-skill in `plugins/_published.json`) ``; và thay `` `data` (4 skills) stays **draft** `` bằng `` `data` (4 skills + `data-db-migration`, 5 in all) stays **draft** ``. Giữ nguyên phần còn lại của câu.

Kiểm JSON: `node -e "for (const p of ['backend','data']) JSON.parse(require('fs').readFileSync('plugins/'+p+'/.manifest.json','utf8'))"` → không lỗi.

- [ ] **Step 5: Rà chuỗi cũ và chạy toàn bộ**

Run: `grep -rn "backend-db-migration" plugins test CLAUDE.md; echo "grep-exit=$?"`
Expected: không in dòng nào; `grep-exit=1`.

Run: `npm run build 2>&1 | tail -3 && node test/validate.mjs 2>&1 | grep -E "db-migration|KẾT QUẢ" ; npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]"`
Expected: build không lỗi; không dòng FAIL nào chứa `db-migration`; `KẾT QUẢ: <n> pass, 0 fail`; `INSTALL TEST … 0 fail`, `WIZARD TEST … 0 fail`; không có dòng `fail [1-9]`. Nếu một assert cũ đỏ (vd hygiene trùng đường dẫn `references/` với skill khác của plugin `data`, hoặc số skill của plugin) → đọc assert, nêu nguyên nhân và BÁO trước khi sửa.

- [ ] **Step 6: Smoke cài skill ở plugin mới**

```bash
sb="<scratchpad>/dbm-install"
mkdir -p "$sb"
AIE_INSTALL_ROOT="$sb" node cli/index.mjs install --provider claude --skill data/data-db-migration --yes
find -L "$sb" -path "*data-db-migration*" -name SKILL.md | sort
find -L "$sb" -path "*data-db-migration*" -name "verify-cycle.md" | sort
AIE_INSTALL_ROOT="$sb" node cli/index.mjs check
```

Expected: install exit 0; `SKILL.md` và `verify-cycle.md` được in ra; `check` liệt kê entry có `data/data-db-migration`. Nếu không → DỪNG, báo output.

Dọn (không dùng `rm -rf`):
`node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true})" "<scratchpad>/dbm-install"`
Sau khi dọn: `node test/validate.mjs 2>&1 | tail -1` vẫn `0 fail` (xác nhận `build/` không bị xoá xuyên junction). Nếu báo "thiếu SKILL.md" hoặc parity → `npm run build` rồi chạy lại và BÁO.

- [ ] **Step 7: Commit qua `core:git-workflow`**

Stage: thư mục `plugins/data/skills/data-db-migration` (gồm file đã đổi tên), phần xoá của `plugins/backend/skills/backend-db-migration`, `plugins/backend/.manifest.json`, `plugins/data/.manifest.json`, `CLAUDE.md`, `test/validate.mjs`, `test/install.test.mjs`. Không stage `build/` hay `.superpowers/`.
Header đề xuất: `refactor(data): move db-migration skill from backend to data plugin`

---

### Task 2: ADR 0001 và ghi chú spec

**Files:**
- Create: `docs/decisions/0001-database-capabilities-in-data-plugin.md`
- Modify: `docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md` (ghi chú dưới tiêu đề `### 7.1`; hàng Q5 ở §11)

**Interfaces:**
- Consumes: skill `data/data-db-migration` (Task 1); cấu trúc ADR ở `plugins/engineering/skills/engineering-adr/references/adr-structure.md` và `.../decision-facilitation.md`.
- Produces: ADR làm nguồn cho quy tắc "database thuộc plugin data".

- [ ] **Step 1: Đọc quy ước ADR**

Đọc `plugins/engineering/skills/engineering-adr/SKILL.md` và `references/adr-structure.md`; bám đúng cấu trúc (Nygard), đánh số `0001` (thư mục `docs/decisions/` chưa tồn tại: tạo mới), Status theo quy ước của skill.

- [ ] **Step 2: Viết ADR (tiếng Việt có dấu)**

Tạo `docs/decisions/0001-database-capabilities-in-data-plugin.md`, nội dung phải có đủ các mục sau (viết đầy đủ, không để trống):

- **Tiêu đề:** `ADR-0001: Năng lực liên quan database thuộc plugin data`.
- **Status:** `Accepted` (2026-09-30). Nguồn quyết định: chủ dự án chốt trong phiên làm việc ("dữ liệu liên quan database → move về plugin data"). Liên kết: spec `docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md` §7.1, §7.1.3, §11 Q5; plan `docs/superpowers/plans/2026-09-30-db-migration-to-data-plugin.md`.
- **Bối cảnh & lực đẩy:** hai skill cùng viết migration schema theo expand/contract: `backend-db-migration` (plugin `backend`, draft, áp Flyway/Liquibase và đổi schema trong app repo) và `data-oltp-implement` (plugin `data`, draft, hiện thực schema vật lý cho DB project OLTP, giữ schema contract). Quy tắc phân ranh ở spec §7.1.3 chỉ là `[Inference]`; nếu giữ hai skill ở hai plugin, skill được publish trước sẽ trỏ (redirect Bước 0) sang skill của plugin còn là draft `[Inference]`. Các lực đẩy: một chủ sở hữu cho mọi việc về schema; quy tắc đặt tên skill theo plugin (`test/validate.mjs:216`); gating publish theo plugin/skill (`plugins/_published.json`); tránh trùng lặp và mâu thuẫn hướng dẫn migration.
- **Phương án:** (A) giữ `backend-db-migration` ở plugin `backend` kèm quy tắc phân ranh; (B) chuyển skill sang plugin `data` (đổi tên `data-db-migration`) — **chọn**; (C) gộp hẳn hai skill thành một; (D) publish nhánh OLTP của plugin `data` trước rồi giữ hai plugin. Mỗi phương án nêu ưu/nhược thực chất (vd A: redirect chéo plugin, hai chủ sở hữu; C: trộn hai đối tượng khác nhau — migration trong app repo vs DB project riêng — làm skill phình và khó pilot; D: trì hoãn pilot, vẫn hai plugin).
- **Quyết định:** chuyển `backend-db-migration` sang plugin `data` với tên `data-db-migration`; giữ nguyên hai skill riêng; quy tắc phân ranh Bước 0 giữ nguyên nhưng nằm trong cùng plugin; plugin `data` vẫn draft nên skill vẫn draft, publish sau pilot (spec M4).
- **Hệ quả (tích cực và tiêu cực, trung thực):** tích cực — một plugin sở hữu mọi việc về database, redirect nội bộ, không còn liên kết treo chéo plugin. Tiêu cực/rủi ro — đổi tên skill (mọi tham chiếu cũ trong docs/superpowers là lịch sử); plugin `data` là draft nguyên khối nên publish db-migration sẽ cần mục `data/data-db-migration` trong `_published.json` hoặc publish cả plugin `data`; khi publish, agent `backend-implementer` (plugin `backend`) dùng skill của plugin khác qua closure cài đặt `[Inference]` cần kiểm lại lúc đó; spec §7.1.10 và §8.1 vẫn dùng tên cũ (đã có ghi chú). Residual risk: chưa pilot.
- **Việc theo sau (không thuộc ADR này):** pha publish sau pilot (spec §9 P1b); WF3 dùng `data-db-migration` khi publish.

- [ ] **Step 3: Ghi chú vào spec**

Trong `docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md`:

(a) Ngay dưới dòng tiêu đề `### 7.1 \`backend-db-migration\` (gộp G2 — phương án A, đã chốt 2026-09-29)`, chèn một đoạn (giữ một dòng trống trước và sau):

```markdown
> **Cập nhật 2026-09-30 (ADR-0001, `docs/decisions/0001-database-capabilities-in-data-plugin.md`):** skill này nay
> thuộc plugin `data` với tên `data-db-migration`. Mọi đường dẫn `plugins/backend/skills/backend-db-migration/…` và
> tên `backend-db-migration` trong mục 6–9 và 11 đọc là `plugins/data/skills/data-db-migration/…` và
> `data-db-migration`. Nội dung thiết kế không đổi.
```

(b) Ở §11, thay hàng Q5 (bắt đầu bằng `| Q5 | Plugin \`data\`: giữ draft hay publish nhánh OLTP …`) bằng:

```markdown
| ~~Q5~~ | ~~Plugin `data`: giữ draft hay publish nhánh OLTP để tránh trùng với `backend-db-migration`?~~ | **Đã chốt (2026-09-30, ADR-0001):** mọi năng lực liên quan database thuộc plugin `data`; skill chuyển sang `data-db-migration`; plugin `data` vẫn draft, quy tắc phân ranh §7.1.3 giữ nguyên trong cùng plugin |
```

- [ ] **Step 4: Kiểm tra**

Run: `test -f docs/decisions/0001-database-capabilities-in-data-plugin.md && grep -c "" docs/decisions/0001-database-capabilities-in-data-plugin.md && grep -n "Status\|Accepted\|Quyết định\|Hệ quả\|Phương án" docs/decisions/0001-database-capabilities-in-data-plugin.md | head; npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]"`
Expected: file tồn tại, có các mục Status/Bối cảnh/Phương án/Quyết định/Hệ quả; `KẾT QUẢ: <n> pass, 0 fail`; `INSTALL TEST … 0 fail`, `WIZARD TEST … 0 fail`.

- [ ] **Step 5: Commit qua `core:git-workflow`**

Stage: ADR, spec. Header đề xuất: `docs(decisions): record database capabilities move to data plugin`

---

## Ngoài plan này

- Pha publish `data-db-migration` sau pilot (spec §9 P1b): mục trong `plugins/_published.json` (per-skill `data/data-db-migration` hoặc cả plugin `data`), thêm skill vào `backend-implementer` và kiểm closure cài đặt chéo plugin, S8 (`backend-implement` trỏ sang skill mới), WF3.
- Sửa các plan cũ trong `docs/superpowers/plans/` nhắc tên cũ: giữ nguyên như lịch sử.
- Quyết định về việc plugin `data` có được publish per-skill hay không: thuộc pha publish.
