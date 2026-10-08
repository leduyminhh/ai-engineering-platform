---
name: data-db-migration
description: "Quản lý schema DB backend (Spring Boot + PostgreSQL; Python/Alembic chỉ hướng dẫn): ADOPT so Flyway/Liquibase để người dùng chọn; CHANGE viết schema expand/contract, kiểm khoá bảng. Dùng khi người dùng muốn \"migrate db\", \"flyway\", \"bỏ ddl-auto\", \"đổi schema\", \"thêm cột\". Không dùng khi project đã chạy data-oltp-init → data-oltp-implement; cần quy trình đổi schema có review query và commit → workflow-db-change."
order: 5
title: "Data DB Migration — Áp công cụ migration & viết thay đổi schema an toàn (recipe on-demand)"
runsIn: execute
invoke: per-request
---

# Data DB Migration — Áp công cụ migration & viết thay đổi schema an toàn (recipe on-demand)

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
  skill này; dùng `data-oltp-implement` (cùng plugin `data`).

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

## Quy trình

### Bước 0 — Chọn chế độ

| Dấu hiệu trong project | Đi tiếp |
|---|---|
| Chưa có công cụ migration (`ddl-auto=update`, DDL chạy tay) | `adopt` |
| Đã có Flyway / Liquibase / Alembic + yêu cầu đổi schema | `change` |
| Có `data-oltp-init`, hoặc schema là contract cho nhiều consumer | DỪNG → `data-oltp-implement` |
| Có cả hai dấu hiệu: đã có công cụ migration trong app **và** dấu hiệu schema là contract (có `data-oltp-init` / nhiều consumer) | DỪNG, hỏi người dùng |

### Chế độ ADOPT — áp công cụ migration

#### A1. Nạp context
Đọc các nguồn ở **Tiền đề**; xác định ranh giới an toàn của repo đích.

#### A2. Kiểm kê source
Theo [references/adopt/inventory-checklist.md](references/adopt/inventory-checklist.md). Xuất **bảng hiện trạng**; hạng
mục không đọc được ghi "KHÔNG XÁC ĐỊNH ĐƯỢC", không suy đoán. Ghi **major version Spring Boot** (parent/BOM): khác 3 →
DỪNG, hỏi người dùng — template viết cho Boot 3 (dependency `flyway-core` / `liquibase-core` theo
[Spring Boot 3.5 — Database Initialization](https://docs.spring.io/spring-boot/3.5/how-to/data-initialization.html));
tài liệu Boot 4.1 ghi starter `spring-boot-starter-flyway` / `spring-boot-starter-liquibase`
([Spring Boot — Database Initialization](https://docs.spring.io/spring-boot/how-to/data-initialization.html)).
`[Inference]` Boot 4 tách auto-configuration Flyway/Liquibase sang module riêng, nên pom của kit có thể không kích hoạt
công cụ trên Boot 4.

#### A3. So sánh Flyway ↔ Liquibase
Theo [references/adopt/tool-comparison-rubric.md](references/adopt/tool-comparison-rubric.md). Mỗi dòng có cột
**Bằng chứng** trích từ A2. Kết bằng khuyến nghị một dòng + lý do một dòng. Cấm bảng lý thuyết chung.

#### A4. DỪNG — người dùng chọn công cụ
Trình bảng so sánh, hỏi Flyway hay Liquibase. **Chưa ghi bất kỳ file nào trước khi có câu trả lời.** Đây là cổng
cứng, không phải gợi ý.

#### A5. Chuẩn bị
`git checkout -b <type>/db-migration-<flyway|liquibase>`. Ghi ADR: công cụ đã chọn, mô hình chạy (module job riêng),
vị trí migration, quy ước đặt tên, nguồn sự thật schema mới, chiến lược expand/contract.

#### A6. Áp template
Theo [references/README.md](references/README.md): sinh module `<app>-db-migration` từ `references/spring-boot/common/`
+ nhánh công cụ đã chọn (nhánh còn lại KHÔNG ship vào project); chỉ áp khi A2 ghi Spring Boot 3. Baseline sinh **một
lần từ schema thật** (file DDL sẵn có, hoặc `pg_dump --schema-only --no-owner --no-privileges` khi người dùng cho phép
kết nối), rồi làm sạch trước khi điền `{{BASELINE_DDL}}`: bỏ phần mở đầu cấu hình session (`SET …`,
`SELECT pg_catalog.set_config('search_path', …)`) và mọi dòng meta-command psql (bắt đầu bằng `\`) — xem
[references/README.md](references/README.md), mục "Làm sạch DDL baseline". App chính chuyển `ddl-auto: validate`. Cập nhật
`project-knowledge/` + CONTRIBUTING + README của project đích. Stack khác Spring Boot: sinh layout trung tính và hỏi
người dùng trước khi ghi.

#### A7. Verify + báo cáo
Build module. Boot thử job **chỉ khi người dùng cấp DB test và đồng ý** (cùng thủ tục xác nhận DB đích ở C4). Evidence
gồm exit code **và số migration/changeSet đã áp đọc từ log job** (exit code 0 mà 0 migration áp là chưa verify). Báo
cáo trung thực: đã verify gì, chưa verify gì, rủi ro còn lại.

### Chế độ CHANGE — viết một thay đổi schema

#### C1. Nhận diện
Đọc công cụ + version (theo BOM/manifest), engine + version, thư mục migration, version mới nhất, quy ước đặt tên
đang dùng, và **cơ chế chạy migration**: job module của kit / chạy trong app lúc boot / Maven-Gradle plugin / CLI.
Không nhận diện được công cụ → DỪNG, đề xuất chế độ `adopt`. Engine khác PostgreSQL → DỪNG, hỏi DBA (bảng rủi ro khoá
chỉ viết cho PostgreSQL). Project Spring Boot có major version khác 3 → DỪNG, hỏi (lý do như A2).

#### C2. Kế hoạch ⏸
Mỗi thay đổi → một pattern ở [references/change/change-patterns.md](references/change/change-patterns.md) → các pha
**expand / migrate data / contract**; tra mức khoá ở
[references/change/lock-risk-postgres.md](references/change/lock-risk-postgres.md). **Hỏi** số dòng của bảng bị đụng
(hoặc lấy từ ADR của project) — không có ngưỡng mặc định. Ghi rõ pha nào vào PR này, pha nào để sau. Thao tác phá huỷ
chưa được xác nhận, hoặc code bản đang chạy vẫn dùng cột/bảng đó (evidence grep `file:line`) → DỪNG. Trình kế hoạch,
chờ người dùng duyệt.

#### C3. Viết
Chỉ thêm file mới (file đã có trên base branch là bất biến); đặt tên theo quy ước tìm được ở C1 (chỉ dùng
`CONVENTIONS.md` của kit khi project dựng từ kit); đặt `lock_timeout`; backfill theo lô, tách khỏi migration đổi cấu
trúc; Liquibase: mỗi changeSet có `rollback`. Lỡ sửa file đã có trên base → huỷ thay đổi đó, viết file mới.

#### C4. Verify ⏸
Xác nhận DB đích là **DB test** (profile/biến môi trường, host, tên database — đã mask), rồi chạy chu trình theo công cụ
ở [references/change/verify-cycle.md](references/change/verify-cycle.md), qua cơ chế chạy đã nhận diện ở C1. Evidence
gồm exit code **và số migration/changeSet đã áp đọc từ log**. Không có DB test → `not_run` + lý do. Không bao giờ chạy
trên production.

#### C5. Bàn giao
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
