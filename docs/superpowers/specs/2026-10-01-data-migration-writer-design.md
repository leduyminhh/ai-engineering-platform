# Thiết kế: Publish `data-db-migration` + agent `data-migration-writer` + nối `workflow-db-change` (P1b, S8, WF3)

- Ngày: 2026-10-01
- Trạng thái: **Đề xuất — chờ duyệt**. Chưa thực thi.
- Phạm vi: đóng P1b, S8 và phần "dùng skill" của WF3 trong spec
  [`2026-09-29-skill-plugin-workflow-upgrade-design.md`](2026-09-29-skill-plugin-workflow-upgrade-design.md)
  (§7.1.10, §9 P1b, §13.2) theo ADR-0001 (năng lực database thuộc plugin `data`).
- Người duyệt: chủ dự án.
- Nền: ADR-0001 (`docs/decisions/0001-database-capabilities-in-data-plugin.md`); spec fixer
  [`2026-09-30-fixer-agent-design.md`](2026-09-30-fixer-agent-design.md) và spec performance
  [`2026-09-30-backend-performance-design.md`](2026-09-30-backend-performance-design.md) (cùng khung: skill → agent →
  publish → nối workflow, gate diff).

---

## 0. Cách đọc & nhãn

| Nhãn | Nghĩa |
|---|---|
| (không nhãn) | Đã kiểm chứng: đọc file hoặc grep, có `file:dòng` hay tên bước đi kèm |
| `[Inference]` | Suy luận từ nội dung đã đọc, chưa chạy thực tế |
| `[Unverified]` | Chưa kiểm chứng được |
| `[Đề xuất]` | Quyết định thiết kế chờ duyệt |

Số bước trích theo `master` = `1538852`.

---

## 1. Vấn đề & mục tiêu

### 1.1 Vấn đề

- Skill `data-db-migration` (plugin `data`, draft) có 2 chế độ `adopt` và `change`
  (`plugins/data/skills/data-db-migration/SKILL.md`). Chưa publish nên `workflow-db-change` không dùng được nó.
- `workflows/db-change/WORKFLOW.md` Bước 3 vẫn là "session chính (file migration) ∥ agent `backend-implementer` (code)":
  file migration được viết ở session chính, không khoá phạm vi (cùng loại lỗi W-b mà A4 đã gỡ cho 3 workflow khác).
- `plugins/backend/skills/backend-implement/SKILL.md:78` và `:89` trỏ chung "thuộc `data` nhánh OLTP / recipe migration
  khác" (S8) — chưa trỏ đích danh sang `data-db-migration`.

### 1.2 Vì sao không đưa nguyên chế độ `change` cho một subagent

CHANGE mode có hai cổng người duyệt: **C2 Kế hoạch ⏸** và **C4 Verify ⏸** (`SKILL.md` §C2, §C4). Subagent không dừng để
hỏi người dùng được. `workflow-db-change` đã có sẵn các cổng tương ứng ở session chính: Bước 2 ⏸ (thiết kế), Bước 5 ⏸
(xác nhận DB đích), Bước 6 (chạy thử). Vì vậy agent chỉ nhận **phần viết file** (C1 + C3); C2/C4/C5 do workflow đảm nhiệm.

### 1.3 Mục tiêu & tiêu chí thành công

1. `data-db-migration` được publish; wizard offer plugin `data` chỉ với skill này (4 skill `data-oltp/olap` vẫn draft).
2. Bước 3 của `workflow-db-change` giao file migration cho agent có hợp đồng riêng và gate diff.
3. Agent không kết nối DB, không chạy migration, không sửa file migration đã có.
4. Không đánh số lại bước (9 bước); `workflow-db-change` vẫn được wizard offer.
5. `npm test` xanh; assert mới trong `validate.mjs`.

---

## 2. Quyết định đã chốt (2026-10-01)

| # | Câu hỏi | Quyết định |
|---|---|---|
| D-Q1 | Publish thế nào? | **Không chờ pilot** (như `*-fix`, frontend e2e/data-integration, `backend-performance`). Chỉ `data/data-db-migration`. |
| D-Q2 | Ai viết file migration ở Bước 3? | **Agent mới `data-migration-writer`** (plugin `data`, mode `write`). Không thêm skill chéo plugin vào `backend-implementer`. |

---

## 3. Agent `data-migration-writer`

### 3.1 Vị trí & frontmatter

`plugins/data/agents/data-migration-writer.md` — plugin `data` chưa có thư mục `agents/`; `loadAgents()` quét `agents/*.md`
theo từng plugin (`cli/lib/plugins.mjs`). `name` = tên file, prefix `data-`; `mode: write`;
`skills: "data-db-migration"`; body đủ 4 heading `## Vai trò`, `## Phạm vi`, `## Quy trình`, `## Report trả về`
(contract `test/validate.mjs:~276-286`). Catalog agent 16 → **17**.

### 3.2 Nội dung (bản để hiện thực)

```markdown
---
name: data-migration-writer
description: "Agent chỉ VIẾT file migration schema mới theo skill data-db-migration (chế độ change, bước C1 nhận diện + C3 viết): nhận kế hoạch đã được người dùng duyệt ở workflow, nhận diện công cụ (Flyway/Liquibase/Alembic), thư mục migration và quy ước đặt tên, rồi chỉ THÊM file migration mới theo pattern expand/migrate/contract (lock_timeout, backfill theo lô, changeSet có rollback). Không kết nối DB, không chạy migration, không sửa file migration đã có trên base branch, không sửa mã nguồn hay test. Cần quyết định của người dùng → dừng và trả blocked. Dùng khi workflow db-change cần giao file migration cho agent có khoá phạm vi."
mode: write
skills: "data-db-migration"
---

## Vai trò
Viết đúng các file migration mới thể hiện kế hoạch schema đã được người dùng duyệt, trong thư mục migration của project.

## Phạm vi
- Được: ĐỌC không giới hạn (code, config, `project-knowledge/`, migration hiện có); TẠO file migration MỚI trong thư mục
  migration đã nhận diện ở C1; SỬA file migration do chính lượt workflow này tạo (chưa có trên base branch).
- Không được: kết nối DB, chạy migration hay công cụ migration (kể cả `validate`/`info`), `pg_dump`; sửa/xoá file
  migration đã có trên base branch; dùng `repair`/`clearChecksums`/`clean`; sửa `src/` hay test; sửa
  `project-knowledge/data-model.md`; đọc hay in secret; thêm dependency; commit; gọi agent khác.
- Bắt buộc: cần quyết định của người dùng (không nhận diện được công cụ, engine không phải PostgreSQL, major version
  Spring Boot khác 3, thao tác phá huỷ chưa được xác nhận ở kế hoạch, số dòng bảng bị đụng chưa biết) → trả
  `status: blocked` + `questions[]`, không tự làm.

## Quy trình
1. Đọc skill `data-db-migration` (chế độ `change`); nhận kế hoạch đã duyệt (các pha expand / migrate data / contract
   nào vào lượt này) và danh sách nơi dùng từ bước gọi. Thiếu kế hoạch → `blocked`.
2. C1: nhận diện công cụ + version, engine + version, thư mục migration, version mới nhất, quy ước đặt tên. Ghi mốc
   `git status --porcelain` do session chính truyền; gọi độc lập → tự ghi ở bước này.
3. C3: chỉ THÊM file mới theo quy ước tìm được; đặt `lock_timeout`; backfill theo lô, tách khỏi migration đổi cấu
   trúc; Liquibase: mỗi changeSet có `rollback`; Flyway forward-only: KHÔNG tạo file migration bù trong thư mục
   migration (migrate sau sẽ áp nó); ghi đoạn SQL migration bù dưới dạng văn bản trong report (`compensating_sql`)
   và `next_actions`/runbook.
4. Tự đối chiếu `git diff --name-only` và `git ls-files --others --exclude-standard` so với mốc: chỉ có file MỚI
   trong thư mục migration; không file đã có bị sửa.
5. Báo cáo; không chạy gì ngoài đọc file và lệnh git chỉ-đọc.

## Report trả về
- Công cụ, version, engine đã nhận diện; thư mục migration; danh sách file migration mới (`file`) kèm pha
  (expand / migrate data / contract) mỗi file thuộc về.
- `compensating_sql`: đoạn SQL migration bù dạng văn bản (công cụ forward-only), hoặc "không có / công cụ có rollback".
- `validation`: `not_run` + `reason: "verify do session chính ở bước chạy thử trên DB test"` (agent không chạy migration).
- `remaining_risks`: khoá bảng (theo `lock-risk-postgres.md`), backfill lớn, pha contract còn nợ.
- `next_actions`: pha contract còn nợ kèm điều kiện kích hoạt.
```

Hợp đồng đầu ra theo `core:principles` (evidence/`not_run` + `reason`) áp dụng như các agent khác.

### 3.3 Ranh giới với skill

Agent chỉ thực hiện C1 + C3 (thêm file migration mới và sửa lại file do chính lượt này tạo; migration bù của công cụ forward-only chỉ là văn bản `compensating_sql` trong report, không phải file). C2 (kế hoạch ⏸), C4 (verify ⏸) và C5 (bàn giao, runbook, cập nhật `data-model.md`) do
`workflow-db-change` đảm nhiệm ở Bước 2, 5–6, 8. Chế độ `adopt` (A1–A7) không thuộc workflow này và không giao cho agent.

---

## 4. Nối vào `workflow-db-change`

### 4.1 Nguyên tắc

- Giữ **9 bước**; giữ ⏸ ở Bước 2, 5, 9; không đánh số lại.
- Trường `- **Thực hiện:** …` có thể xuống dòng (`stepRefs` nay đọc trọn trường — `cli/lib/workflows.mjs`).
- `requires` thêm `data/data-db-migration` để các bước tham chiếu skill (Bước 2, 6) qua được kiểm tra closure.

### 4.2 Thay đổi theo bước

| Bước | Thay đổi |
|---|---|
| 2 Thiết kế migration ⏸ | `Thực hiện: session chính (theo skill \`data-db-migration\`, C2)`. Hành động: tra pattern trong `references/change/change-patterns.md` và mức khoá trong `lock-risk-postgres.md`; hỏi số dòng bảng bị đụng; ghi rõ pha nào vào lượt này, pha nào để sau. Đầu ra thêm "kế hoạch theo pha (expand / migrate data / contract)" và số dòng bảng bị đụng, làm đầu vào cho Bước 3. |
| 3 Implement | `Thực hiện: agent \`data-migration-writer\` (file migration) ∥ agent \`backend-implementer\` (code)`. Đầu vào thêm kế hoạch theo pha và số dòng bảng bị đụng từ Bước 2. Hành động: session chính ghi mốc `git status --porcelain` MỘT lần ở lần dispatch đầu của Bước 3; các lần gọi lại (sau Bước 4/6/7 hoặc `blocked`) dùng lại mốc đó. Agent chỉ thêm file migration MỚI (forward + rollback; với công cụ forward-only chỉ forward — migration bù là đoạn SQL `compensating_sql` trong report, không thành file) và được sửa lại file do chính lượt này tạo. Ràng buộc: file migration do agent viết chỉ là file MỚI; `backend-implementer` chỉ sửa code ngoài thư mục migration trong danh sách nơi dùng của Bước 1; file trong thư mục migration xuất hiện ở danh sách nơi dùng của Bước 1 (vd migration Java, `R__` lặp lại) không thuộc phạm vi hai agent → hỏi người dùng; danh sách file là hợp của hai phía, mỗi agent chỉ đối chiếu phần của mình. Gate: build xanh; so với mốc đầu bước, file thay đổi/mới chỉ gồm (a) file migration mới trong thư mục migration và (b) file code thuộc nơi dùng đã xác định ở Bước 1; không file migration đã có trên base branch bị sửa. Khi fail: agent trả `blocked` + câu hỏi → session chính hỏi người dùng; quyết định ghi vào report Bước 3 (làm đổi kế hoạch → quay lại Bước 2), gọi lại agent; diff lệch → revert phần lệch. Evidence nêu `compensating_sql`. |
| 6 Chạy thử | `Thực hiện: session chính (theo skill \`data-db-migration\`, C4)`; chu trình verify theo `references/change/verify-cycle.md` trên đúng DB đã xác nhận ở Bước 5. Công cụ forward-only: đoạn SQL migration bù lấy từ report Bước 3 (không phải file trong thư mục migration), áp bằng tay trên đúng DB đã xác nhận ở Bước 5. Nội dung hiện có giữ nguyên. |
| 8 Cập nhật data-model | Thêm: pha contract còn nợ lấy từ `next_actions` của agent ở Bước 3. |
| 1, 4, 5, 7, 9 | Không đổi. |

Frontmatter: `agents: "data-migration-writer,backend-implementer,backend-test-writer,backend-reviewer"`;
`requires: "core/git-workflow,data/data-db-migration"`. Điều kiện tiên quyết liệt kê thêm agent và skill. Bảng lỗi thêm
hàng: "Agent migration trả `blocked` (Bước 3)" → "Người dùng quyết định; đổi kế hoạch → quay lại Bước 2, ngược lại ghi
vào report Bước 3 rồi gọi lại agent".

---

## 5. Publish, S8, docs, kiểm chứng

### 5.1 Publish (làm TRƯỚC khi nối workflow)

- `plugins/_published.json`: thêm `data/data-db-migration`. `plugins/_cowork.json`: thêm `data:data-db-migration`
  (hiện chỉ có 4 skill `data-oltp/olap`).
- `plugins/data/.manifest.json`: version `1.2.0` → `1.3.0`; description nêu `data-db-migration` (assert PL2-kiểu nếu có áp
  cho plugin này — kiểm khi hiện thực).
- Hệ quả `[Inference]`: `offeredCatalog` sẽ offer plugin `data` với 1 skill, và `data-principles` (baseline sinh tự động
  khi plugin có ≥1 skill hiệu lực — `cli/lib/install.mjs:~432`) đi kèm. Nguyên tắc riêng của `data`
  (`plugins/data/shared/principles.md`) mô tả hai nhánh sở hữu dữ liệu (OLTP/OLAP) và nói rõ ERD nhúng trong app backend
  là thứ KHÁC; người dùng `data-db-migration` là backend app nên cần 1 đoạn ngắn ở đầu file nói skill này phục vụ project
  backend có DB riêng của app (không phải nhánh OLTP/OLAP). Thêm đoạn đó ở bước hiện thực.
- Cập nhật assert "plugin data là draft": `test/install.test.mjs` (~dòng 156, 161, 181-187) và các assert tương ứng trong
  `validate.mjs`.

### 5.2 S8

`plugins/backend/skills/backend-implement/SKILL.md` ranh giới (~dòng 78 và 89): "thuộc `data` nhánh OLTP / recipe
migration khác" và "DB migration, externalize config là các recipe khác" → trỏ đích danh `data-db-migration` (plugin
`data`) cho DB migration và `backend-migrate-vault-consul` cho externalize config.

### 5.3 Docs

- `README.md`/`README_VI.md`: `### Agents (16)` → `(17)`; thêm hàng `| \`data-migration-writer\` | data | write |
  data-db-migration | WF07 |`; cột agent của WF07 thêm `data-migration-writer`; bảng plugin: `data` ghi "một phần published
  (`data-db-migration`)"; bảng Skill gaps: bỏ G2 (`backend-migrate-db`, nay là `data-db-migration`).
- `CLAUDE.md` Conventions: `data` "1 skill published (`data-db-migration`), 4 draft".
- Spec 2026-09-29: §9 P1b, §13 đánh dấu xong; §7.1.10 "Pha publish (sau pilot)" ghi miễn pilot; §13.2 bỏ S8, P1b,
  "WF3 phần dùng skill"; §12 bỏ rủi ro chéo plugin liên quan `backend-implementer` (không còn thêm skill chéo plugin).
- ADR-0001: thêm mục cập nhật cuối file: "2026-10-01: publish `data/data-db-migration`; agent `data-migration-writer`".

### 5.4 Test

Khối `// 22.` cuối `test/validate.mjs`:
- agent: `mode: write`, `skills` đúng 1; Phạm vi chứa "không" + "kết nối DB", "file migration đã có" (cấm sửa), `blocked`,
  `questions`; body chứa `core:principles` (qua report), `git diff --name-only`;
- publish: `_published.json`, `_cowork.json`, manifest `1.3.0`;
- workflow db-change: Bước 3 Thực hiện có cả hai agent; Gate chứa "migration" và "đã có"; Bước 2 Hành động chứa
  `change-patterns`; Bước 6 Hành động chứa `verify-cycle`; frontmatter agents/requires; vẫn 9 bước; ⏸ Bước 2/5/9;
  `offeredCatalog` vẫn chứa `workflows/workflow-db-change` (kiểm có răng);
- S8: `backend-implement/SKILL.md` chứa `data-db-migration`;
- README: heading `(17)`, hàng agent, WF07.

### 5.5 Kiểm chứng

| Bước | Lệnh | Chứng minh |
|---|---|---|
| Contract | `npm run validate` | skill/agent/workflow đúng contract |
| Build | `npm run build` | agent `.md`/`.toml` của plugin `data` ở `build/<provider>/` |
| Toàn bộ | `npm test` | installer/wizard/pack-guard không regression |
| Smoke | `AIE_INSTALL_ROOT=<sandbox> aip install --provider claude --skill workflows/workflow-db-change --yes` | closure kéo `data-db-migration`, `data-principles`, agent; dọn bằng `fs.rmSync` |
| Công cụ thật | Chạy trên project Spring/Alembic thật | `[Unverified]` — chỉ làm được khi pilot (Q6) |

---

## 6. Lộ trình (mỗi task = 1 commit, người duyệt diff)

| Pha | Nội dung |
|---|---|
| DM-P1 | Publish (§5.1) + sửa assert draft + đoạn principles của `data` + khối 22 (assert publish) |
| DM-P2 | Agent `data-migration-writer` (§3.2) + assert |
| DM-P3 | Nối `workflow-db-change` (§4) + assert + kiểm có răng |
| DM-P4 | S8 + docs (§5.2–§5.3) + assert |
| DM-P5 | Smoke sandbox (§5.5) |

DM-P1 phải đi trước DM-P3 (publish trước, nối sau — `offeredCatalog` ẩn workflow có closure chưa publish,
`cli/lib/install.mjs:355`).

---

## 7. Rủi ro còn lại

- **Chưa pilot** (D-Q1): `data-db-migration` chưa chạy trên project thật; hướng dẫn về Flyway/Liquibase/Alembic và khoá
  PostgreSQL chưa kiểm trên DB thật (`[Unverified]` ghi sẵn trong references).
- Skill hướng dẫn thao tác DB có rủi ro cao hơn các recipe chỉ sửa code; ràng buộc "chỉ DB test" nằm ở Bước 5 ⏸ của workflow
  (người dùng xác nhận) chứ không do công cụ chặn.
- `[Inference]` Agent `write` không bị chặn ghi theo đường dẫn bằng công cụ (`adapters/_shared/agents.mjs:5`); "chỉ thêm
  file mới trong thư mục migration" chỉ được kiểm bằng gate diff của Bước 3.
- Hai agent `write` chạy song song ở Bước 3 trong cùng working tree; mỗi agent tự đối chiếu phần của mình, gate cuối ở
  session chính kiểm hợp hai danh sách.
- Plugin `data` có agent đầu tiên: `[Inference]` các adapter xử lý agent theo plugin chung, chưa từng chạy với `data`; kiểm
  ở smoke (§5.5).
- Wizard offer plugin `data` với 1 skill kèm `data-principles` — người dùng thấy nhóm `data` nhưng 4 skill OLTP/OLAP
  vẫn ẩn.

---

## 8. Quyết định cần chốt

| # | Câu hỏi | Trạng thái |
|---|---|---|
| ~~D-Q1~~ | Publish không chờ pilot? | Đã chốt 2026-10-01 |
| ~~D-Q2~~ | Agent riêng trong plugin `data`? | Đã chốt 2026-10-01 |
| D-Q3 | Có publish tiếp 4 skill `data-oltp/olap` không? | Mở — ngoài phạm vi; cần spec riêng |
