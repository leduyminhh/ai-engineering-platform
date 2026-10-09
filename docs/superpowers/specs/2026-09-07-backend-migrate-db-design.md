# Thiết kế: Skill `backend-migrate-db` — chọn & áp công cụ migration DB (Flyway ↔ Liquibase)

- Ngày: 2026-09-07
- Trạng thái: **Đã thay thế, không thực thi riêng** — gộp vào `backend-db-migration` (spec `2026-09-29-skill-plugin-workflow-upgrade-design.md` §7.1, phương án A), sau đó chuyển thành `data-db-migration` theo ADR-0001 (`8a98313`).
- Phạm vi: Nội dung — thêm skill recipe on-demand `backend-migrate-db` cho plugin `backend`,
  kèm `references/spring-boot/` (template Flyway + Liquibase). Không đổi engine/adapter/CLI.
- Người duyệt: chủ dự án (đã chốt 3 quyết định ở §2.3).

---

## 1. Mục tiêu & tiêu chí thành công

Nhiều backend project trong tổ chức đang để Hibernate `ddl-auto=update` làm chủ schema, hoặc chạy
file DDL bằng tay. Cả hai đều không phải công cụ migration: không có lịch sử, không có checksum,
không rollback được, và không sinh được các object riêng của engine (partition, trigger, partial
index, PL/pgSQL). Đã có một template nội bộ (`be-iam/iam-db-migration`) đi đúng hướng nhưng chưa
dùng được (§3).

Mục tiêu: một recipe **on-demand** giúp agent (a) đọc source code project đích, (b) so sánh
**Flyway ↔ Liquibase theo chính dữ liệu của project đó**, (c) **DỪNG chờ người dùng chọn**, rồi (d)
áp template tương ứng theo mô hình **module migration chạy riêng**.

Thành công khi:

1. Có `plugins/backend/skills/backend-migrate-db/SKILL.md` (recipe mỏng, cổng an toàn đánh số) +
   `references/` (dày), auto-discover, project ra cả 4 provider, parity `references/`.
2. Bước so sánh sinh bảng **có bằng chứng trích từ project đích**, không phải bảng lý thuyết chung.
3. Có **gate cứng**: chưa ghi bất kỳ file nào trước khi người dùng chọn công cụ.
4. Template `references/spring-boot/` sửa hết 15 khiếm khuyết đã tìm thấy ở §3 (B1–B5, D1–D10).
5. `npm test` xanh; `npm run build` ship skill + `references/` ra 4 provider.
6. Docs-only. Skill là *hướng dẫn agent*, không phải công cụ tự động chạy migration lên DB.

---

## 2. Phạm vi

### 2.1 Trong phạm vi

- Kiểm kê cơ chế schema hiện trạng của project đích (`ddl-auto`, DDL tay, migration cũ).
- So sánh Flyway ↔ Liquibase theo rubric có trọng số bối cảnh, kèm khuyến nghị.
- Template Spring Boot cho **cả hai** công cụ, theo mô hình module migration chạy riêng.
- Ghi ADR + cập nhật `project-knowledge/` của project đích.
- Sinh baseline từ schema thật (một lần, một nguồn).

### 2.2 Ngoài phạm vi

- **Không** tự chạy migration lên bất kỳ DB nào khi chưa được duyệt tường minh.
- **Không** sửa repo `be-iam` (đã chốt: chỉ báo cáo).
- **Không** ship template cho stack ngoài Spring Boot ở đợt này.
- Không đụng CI/CD pipeline, không đụng secret.
- Không thiết kế chính sách phân quyền DB user (chỉ nêu thành câu hỏi cho người vận hành).

### 2.3 Ba quyết định đã chốt

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Mô hình chạy migration | **Module job riêng** (`<app>-db-migration`, có `main()`, `WebApplicationType.NONE`), chạy trước khi app lên. App chính dùng `ddl-auto: validate`. |
| Q2 | Phạm vi phiên thực thi | **Chỉ skill + template trong kit.** Chưa áp pilot lên `be-directive-mgt`. |
| Q3 | 5 lỗi chặn ở `be-iam` | **Chỉ báo cáo, không sửa.** Repo khác, ngoài phạm vi. |

---

## 3. Đầu vào khảo sát — đánh giá `be-iam/iam-db-migration`

Nguồn: `E:\Company\IOC\KH_IOC_OLD\IDP\be-iam\be-iam-parent\iam-db-migration`, đọc toàn bộ ngày
2026-09-07. Đây là cơ sở bằng chứng cho mọi quyết định template ở §6.

### 3.1 Lỗi chặn — app không chạy được hoặc chạy sai âm thầm

| # | Vấn đề | Bằng chứng |
|---|---|---|
| B1 | `src/main/resources/META-INF/spring.factories` khai `EnvironmentPostProcessor` = `com.fpt.egov.platform.iam.db.migration.DotenvEnvironmentPostProcessor` — class **không tồn tại** trong module. Bản thật nằm ở `iam-server`, package `...iam.server`. | `find` toàn repo chỉ thấy 1 file, ở `iam-server`. Commit gần nhất của module tên `fix(db-migration): fix error run source`. |
| B2 | `db-migration.properties` tham chiếu `FLYWAY_ENABLED`, `FLYWAY_LOCATIONS`, `FLYWAY_SCHEMA`, `FLYWAY_BASELINE_ON_MIGRATE`, `FLYWAY_BASELINE_VERSION`, `LIQUIBASE_ENABLED`, `LIQUIBASE_CHANGELOG`, `LIQUIBASE_CONTEXTS`, `LIQUIBASE_SCHEMA`, `DB_MIGRATION_PORT` — **không key nào** có trong `.env_template` / `.env_clean_architecture`. | grep 2 file template: 0 kết quả. |
| B3 | `LiquibaseConfig`: `liquibase.setContexts(properties.getContexts().toString())`. `getContexts()` trả `List<String>` → `toString()` cho ra `"[a, b]"` kèm ngoặc vuông, sai cú pháp context; `null` → NPE. | Đọc code. |
| B4 | Hai file sai separator: `versioned/system/V_1440_171125_system_example.sql` và `repeatable/views/R_views_user_list.sql` dùng **một** `_` thay vì `__`. Flyway không nhận `R_...` là repeatable migration. | Cả 4 file versioned/repeatable đều rỗng 0 byte → chưa ai chạy thử. |
| B5 | `script/gen.sh`: `VERSION=1400` hardcode (chạy 2 lần → trùng version), sinh tên `V${VERSION}_${DATE}_${DESC}.sql` (một `_`, mâu thuẫn với baseline dùng `__`), ghi vào `./src/main/resources/db/migration/versioned/` — thiếu segment `flyway/`, đường dẫn không tồn tại. | Đọc script + đối chiếu cây thư mục thật. |

### 3.2 Lỗi thiết kế

| # | Vấn đề | Hệ quả |
|---|---|---|
| D1 | `FlywayConfig` tự dựng bean `Flyway` với `initMethod="migrate"`. Vì `FlywayAutoConfiguration` là `@ConditionalOnMissingBean(Flyway.class)`, autoconfig bị vô hiệu. Bean tự viết chỉ đọc 5 thuộc tính (`locations`, `schemas`, `baselineOnMigrate`, `baselineVersion`, `enabled`). | `FlywayProperties` của Spring Boot 3.5 có **50+ trường**. Mọi thuộc tính khác đặt trong properties/env **im lặng không có tác dụng** — gồm `validate-on-migrate`, `clean-disabled`, `out-of-order`, `table`, `placeholders`, `sql-migration-prefix`, `execute-in-transaction`. Đây là khiếm khuyết nguy hiểm nhất của module. |
| D2 | `LiquibaseConfig` y hệt với `SpringLiquibase`. | `LiquibaseProperties` có **24 trường**; bean tự viết đọc 4. Mất `label-filter`, `liquibase-schema`, `parameters`, `test-rollback-on-update`, `database-change-log-table`, `tag`, `rollback-file`… |
| D3 | Hai `@Configuration` đều vô điều kiện → hai bean cùng sống trong một context. | Bật cả hai cờ enabled → hai bảng lịch sử (`flyway_schema_history` + `DATABASECHANGELOG`) cùng ghi lên một schema. Không có cơ chế loại trừ. |
| D4 | **Hai baseline đã lệch nhau.** Nhánh Flyway: `V_1424_171125__init_users_table.sql` **rỗng** → không có bảng `users`, trong khi `V_1423` lại có FK `um_password_recover_code.user_id → users(id)`. Nhánh Liquibase: baseline tạo `users`. Flyway dùng `CREATE TABLE`, Liquibase dùng `CREATE TABLE IF NOT EXISTS`. | Hai nhánh sinh ra **hai schema khác nhau**; nhánh Flyway nhiều khả năng fail ngay ở FK. Template dạy sai từ chính ví dụ. |
| D5 | Thư mục `liquibase/repeatable/` là tên gọi sai — Liquibase không có khái niệm repeatable; tương đương là `runOnChange` trên changeSet, **không được đặt**. | Sửa nội dung file function sau này → lỗi checksum, không chạy lại. |
| D6 | Không changeSet nào có block `rollback`. | Trả toàn bộ chi phí ceremony của Liquibase mà không nhận lợi ích chính của nó. |
| D7 | Version Flyway `V_1423_171125__` bắt đầu bằng `_`; ngày dạng `ddMMyy` không sắp xếp được theo thời gian. [Unverified] Flyway coi `_` trong phần version tương đương `.`, nên version thực tế là `.1423.171125`. | Khó đọc, dễ trùng, thứ tự không phản ánh thời gian. |
| D8 | `author: "usr"` ở mọi changeSet; changeSet id `20251118-iam-layout-view` nằm trong changelog **function** (copy-paste). | Mất truy vết. |
| D9 | Module khai `server.port` + `server.servlet.context-path` trong khi `WebApplicationType.NONE`. | Config chết, gây hiểu nhầm là service có HTTP. |
| D10 | Parent ghim tay `flyway.core.version=11.17.0`, `liquibase.core.verion=4.33.0` (chú ý typo `verion`) đè BOM `spring-boot-starter-parent:3.5.7`. | Tự gánh rủi ro tương thích. Nếu có lý do thì phải ghi ADR; hiện không có. |

### 3.3 Điểm tốt — giữ lại làm chuẩn

1. **Module migration riêng có `main()`, `WebApplicationType.NONE`.** Migration là một *job* chạy
   trước khi app lên, không phải side-effect lúc app boot. Đây là quyết định kiến trúc đúng và là
   giá trị lớn nhất của template. → Trở thành Q1 đã chốt.
2. **Taxonomy `baseline / versioned / repeatable`**, chia thư mục con theo domain
   (`versioned/user`, `versioned/system`). → Giữ nguyên ở §6.
3. **Liquibase kiểu `sqlFile` bọc SQL thô**: giữ SQL review được bằng mắt DBA, chỉ dùng Liquibase để
   điều phối. Đúng hướng cho schema nặng Postgres. → Giữ làm style Liquibase mặc định, nhưng đổi
   định dạng changelog từ **JSON sang YAML**: YAML cho phép viết block `rollback` nhiều dòng và
   ghi chú `#` dễ đọc, còn JSON thì không có comment. Đây là thay đổi có chủ ý so với bản `be-iam`.
4. `splitStatements: false` cho file PL/pgSQL `$$` — chi tiết đúng và dễ sai.
5. Cấu hình qua biến môi trường (12-factor).

**Kết luận:** ý tưởng kiến trúc đúng, hiện thực chưa dùng được. Bỏ hai lớp `@Configuration` tự viết
thì D1, D2, D3 biến mất cùng lúc.

---

## 4. Kiến trúc đích

```
plugins/backend/skills/backend-migrate-db/
├── SKILL.md                              # recipe mỏng: 7 bước, gate cứng ở bước 4
└── references/
    ├── inventory-checklist.md            # đọc gì trong source, theo stack
    ├── tool-comparison-rubric.md         # 6 tiêu chí + cách lấy bằng chứng + cách trình bày
    ├── README.md                         # cách dùng kit + ma trận file — ĐẶT Ở GỐC references/,
    │                                     # KHÔNG để spring-boot/README.md vì trùng path tương đối với
    │                                     # backend-migrate-vault-consul/references/spring-boot/README.md
    │                                     # → test/validate.mjs (uniqueness) fail
    └── spring-boot/
        ├── common/
        │   ├── module-pom.xml.tpl
        │   ├── DbMigrationApplication.java.tpl
        │   ├── application-migration.yml  # datasource + logging, CẢ HAI công cụ tắt
        │   ├── env.example
        │   └── new-migration.sh
        ├── flyway/
        │   ├── application-flyway.yml
        │   ├── CONVENTIONS.md
        │   └── db/migration/
        │       ├── baseline/V00000000000000__baseline_schema.sql.tpl
        │       ├── versioned/<domain>/V20260101120000__vi_du_them_cot.sql.tpl
        │       ├── versioned/<domain>/V20260101130000__vi_du_index_concurrently.sql.tpl
        │       ├── versioned/<domain>/V20260101130000__vi_du_index_concurrently.sql.conf
        │       └── repeatable/R__vi_du_function.sql.tpl
        └── liquibase/
            ├── application-liquibase.yml
            ├── CONVENTIONS.md
            └── db/changelog/
                ├── db.changelog-master.yaml
                ├── baseline/20260101120000-baseline-schema.yaml (+ sql/)
                ├── versioned/<domain>/20260101130000-vi-du-them-cot.yaml (+ sql/)
                └── repeatable/20260101140000-vi-du-function.yaml (+ sql/)
```

**Frontmatter SKILL.md:**

```yaml
name: backend-migrate-db
description: "<chuỗi có ngoặc kép, gồm mô tả recipe + đủ cụm kích hoạt VI+EN liệt kê ngay dưới>"
order: 9
stageNumber: "09"
title: "Backend Migrate — Công cụ migration DB: Flyway ↔ Liquibase (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
next: null
```

`description` là key **bắt buộc** trong frontmatter (dạng chuỗi có ngoặc kép, một dòng, như các
skill anh em) — không phải chỉ mô tả ở prose.

`order: 9` vì 1–8 đã dùng (`backend-init` 1 … `backend-api-contract` 8). Không khai
`sharedAssets` — skill này không đọc blueprint kiến trúc.

`description` phải chứa các cụm kích hoạt tiếng Việt lẫn tiếng Anh: "migrate db", "flyway",
"liquibase", "công cụ migration", "bỏ ddl-auto", "quản lý schema", "versioning database",
"đổi schema", "database migration".

---

## 5. Luồng skill — 7 bước, gate cứng ở bước 4

**Bước 1 — Nạp context.** Đọc `core:principles` + `backend:backend-principles`, CLAUDE.md /
AGENTS.md của project đích, `project-knowledge/` (đặc biệt `stack-profile.md`, `data-model.md`).
Xác định ranh giới an toàn của repo đó.

**Bước 2 — Kiểm kê source** theo `references/inventory-checklist.md`. Xuất **bảng hiện trạng**:

| Hạng mục | Cách lấy | Dùng cho tiêu chí |
|---|---|---|
| Stack + version thật | manifest phụ thuộc (`pom.xml`/`build.gradle`/`package.json`), BOM parent | chọn template |
| Cơ chế schema hiện tại | `ddl-auto`, file DDL, thư mục migration cũ | mức độ rủi ro |
| DB engine + version | cấu hình datasource, driver | T1 |
| Số bảng | đếm `CREATE TABLE` trong DDL hoặc số entity | quy mô baseline |
| Object engine-specific | grep `PARTITION BY`, `CREATE TRIGGER`, `CREATE.*FUNCTION`, `WHERE ` trong `CREATE INDEX`, `jsonb`, `$$` | **T2 — tiêu chí nặng nhất** |
| Số DB engine phải hỗ trợ | ADR / stack-profile | **T1 — tiêu chí nặng nhất** |
| Chính sách rollback | ADR, CONTRIBUTING | T3 |
| Hiện trạng DB | HỎI người dùng: dev bỏ được / có dữ liệu / có prod | T4 + nhánh baseline |
| Ai review migration | HỎI người dùng | T5 |

Nếu không đọc được một hạng mục thì ghi "KHÔNG XÁC ĐỊNH ĐƯỢC", **không suy đoán**.

**Bước 3 — So sánh** theo `references/tool-comparison-rubric.md`. Mỗi dòng bảng phải có cột
**Bằng chứng** trích từ bước 2 (tên file, số đếm). Kết bằng khuyến nghị một dòng + lý do một dòng.
Cấm trình bày bảng lý thuyết chung không gắn dữ liệu project.

**Bước 4 — DỪNG.** Trình bảng so sánh, hỏi người dùng chọn Flyway hay Liquibase.
**Chưa được ghi bất kỳ file nào trước khi có câu trả lời.** Đây là cổng cứng, không phải gợi ý.

**Bước 5 — Chuẩn bị.** `git checkout -b <type>/db-migration-<flyway|liquibase>` (không làm trên
`main`/`master`/`dev`/`develop`). Ghi ADR: công cụ đã chọn, mô hình chạy (module job riêng), vị trí
migration, quy ước đặt tên, nguồn sự thật schema mới, chiến lược expand-contract.

**Bước 6 — Áp template.** Sinh module `<app>-db-migration` từ `references/spring-boot/common/` +
nhánh công cụ đã chọn. Sinh baseline **một lần từ schema thật** (file DDL sẵn có, hoặc
`pg_dump --schema-only` nếu DB đang chạy — chỉ đọc, cần người dùng cho phép kết nối). Đổi app chính
sang `ddl-auto: validate`. Cập nhật `project-knowledge/` + CONTRIBUTING + README của project đích.

**Bước 7 — Verify + báo cáo.** Build module. Boot thử **chỉ khi người dùng cấp DB và đồng ý**. Báo
cáo trung thực: đã verify gì, chưa verify gì, rủi ro còn lại. Dừng cho người duyệt diff trước khi
commit (1 task = 1 commit).

---

## 6. Rubric so sánh (`references/tool-comparison-rubric.md`)

| Mã | Tiêu chí | Nghiêng **Flyway** khi | Nghiêng **Liquibase** khi | Trọng số |
|---|---|---|---|---|
| T1 | Số DB engine phải hỗ trợ | 1 engine cố định | ≥ 2 engine từ cùng changelog | Cao |
| T2 | Tỉ lệ SQL engine-specific | Cao: partition, PL/pgSQL, partial index, `jsonb` | Thấp: chủ yếu DDL phổ thông | Cao |
| T3 | Yêu cầu rollback | Expand-contract đã là chính sách | Vận hành bắt buộc rollback declarative | Trung bình |
| T4 | Baseline DB có dữ liệu | Dev bỏ được, hoặc đã có file DDL đầy đủ | Cần `generateChangeLog` từ DB legacy chưa có DDL | Trung bình |
| T5 | Người review migration | DBA đọc SQL thô | Dev đọc changeset abstract | Trung bình |
| T6 | Ngân sách ceremony | Tối giản, cần nhân rộng nhiều project | Chấp nhận master changelog + quy ước id/author | Thấp |

**Quy tắc kết luận:** T1 và T2 là hai tiêu chí nặng. Nếu cả hai cùng nghiêng một phía thì khuyến
nghị phía đó và nói rõ các tiêu chí còn lại không đủ lật ngược. Nếu T1 và T2 nghiêng ngược nhau thì
trình bày cả hai kịch bản, không tự chọn.

**Lưu ý phải nêu khi trình bày** (đã kiểm chứng, xem §8):

- `clean` mặc định đã bị khoá ở Flyway (`cleanDisabled = true`).
- Cả hai đều được BOM Spring Boot pin version; **không ghim tay** trừ khi có ADR.
- Điểm mạnh thật của Liquibase mà Flyway Community không có: `generateChangeLog` / `diffChangeLog`
  để baseline một DB legacy chưa có DDL.
- Điểm mạnh thật của Flyway: SQL thô nguyên vẹn, không lớp trung gian nào phải "dịch".

---

## 7. Template Spring Boot — quyết định và ánh xạ sang lỗi đã sửa

### 7.1 Bảng ánh xạ quyết định → khiếm khuyết được sửa

| # | Quyết định template | Sửa |
|---|---|---|
| P1 | **Không có lớp `@Configuration` tự viết.** Dùng thẳng autoconfig Spring Boot; cần tuỳ biến thì `FlywayConfigurationCustomizer` / `SpringLiquibase` customizer bean, không thay thế bean gốc. | D1, D2 |
| P2 | Loại trừ bằng **profile**: `application-migration.yml` đặt cả `spring.flyway.enabled: false` và `spring.liquibase.enabled: false`; profile `flyway` hoặc `liquibase` bật đúng một. Chạy job phải truyền profile. | D3 |
| P3 | Baseline **sinh một lần từ schema thật**, chỉ nhánh công cụ đã chọn có nội dung. Nhánh còn lại không được ship kèm project đích. Baseline-V0 (file chạy được) và `baseline-on-migrate` LOẠI TRỪ nhau — xem ghi chú §7.4. | D4 |
| P4 | Liquibase: repeatable = `runOnChange: true`; **mỗi changeSet có block `rollback`**; `author` là tên thật; `id` = `<yyyyMMddHHmmss>-<mô-tả-gạch-nối>`. | D5, D6, D8 |
| P5 | Flyway naming: `V<yyyyMMddHHmmss>__<mo_ta_khong_dau>.sql`, separator **hai** `_`, repeatable `R__<ten>.sql`. Version là timestamp **giây** → sắp xếp đúng thời gian; độ phân giải giây thu hẹp nhưng KHÔNG loại hẳn khả năng trùng (xem guard P6). | B4, D7 |
| P6 | `new-migration.sh <flyway\|liquibase> <domain> "<mô tả>"` — lấy version từ `date +%Y%m%d%H%M%S`, **kiểm version đã tồn tại chưa; nếu trùng thì +1 giây (hoặc thoát khác 0 báo lỗi)** trước khi ghi, sinh đúng bộ file của công cụ tương ứng (Flyway: 1 file `.sql`; Liquibase: 1 file `.yaml` + 1 file `sql/*.sql` + nhắc thêm `include` vào master), in ra đường dẫn đã tạo, thoát khác 0 khi thiếu tham số. | B5 |
| P7 | `env.example` liệt kê **đủ** key mà file properties tham chiếu; module **không** khai `server.port` / `context-path`. | B2, D9 |
| P8 | Không khai `<version>` cho `flyway-core`, `flyway-database-postgresql`, `liquibase-core` — để BOM Spring Boot pin. | D10 |
| P9 | Không dùng `spring.factories`; nạp `.env` bằng cơ chế sẵn có của project (`platform-environment-starter` hoặc `--spring.config.import`). Nếu bắt buộc phải có `EnvironmentPostProcessor` thì class phải nằm **trong chính module**. | B1 |
| P10 | App chính: `ddl-auto: validate`, `spring.flyway.enabled=false`, `spring.liquibase.enabled=false`. Migration do job riêng chạy. | Q1 |
| P11 | Ship file `.conf` mẫu cho `CREATE INDEX CONCURRENTLY` (`executeInTransaction=false`). | vận hành prod |
| P12 | `application-*.yml` khai tường minh `validate-on-migrate: true`, `clean-disabled: true`, `out-of-order: false` dù `clean-disabled` đã mặc định `true` — để ý định nằm trong file, không nằm trong trí nhớ. | D1 |

### 7.2 `common/DbMigrationApplication.java.tpl`

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

`SpringApplication.exit` + `System.exit` là bắt buộc với job: CI/CD phải nhận được exit code khác 0
khi migration fail. Bản `be-iam` thiếu điểm này.

### 7.3 `common/application-migration.yml`

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

### 7.4 `flyway/application-flyway.yml`

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

**[Unverified] Baseline-V0 và `baseline-on-migrate` là HAI ĐƯỜNG LOẠI TRỪ, không dùng đồng thời.**
Khi `baseline-on-migrate=true` với `baseline-version=0`, Flyway ghi một hàng baseline ở version 0 và
**bỏ qua mọi migration có version ≤ baseline** — tức bỏ qua chính file `V00000000000000__baseline`
(version 0). Do đó:

- **Greenfield / dev bỏ được** (DB rỗng): ship file baseline chạy được (`V0…`), giữ
  `baseline-on-migrate=false`. Baseline chạy như migration đầu tiên.
- **Adopt DB đã có dữ liệu**: **KHÔNG** ship file baseline chạy được; đặt `baseline-on-migrate=true`
  và `baseline-version` = version migration đầu tiên bạn muốn chạy tiếp (khác 0), để Flyway đánh dấu
  trạng thái sẵn có mà không chạy lại DDL.

Session thực thi phải xác nhận ngữ nghĩa skip-≤-baseline trên Flyway của project đích, và README kit
ghi rõ hai đường này để người dùng không bật cả hai.

`locations` để **một** đường dẫn gốc: Flyway quét đệ quy, nên `baseline/`, `versioned/<domain>/`,
`repeatable/` đều được gom mà thứ tự vẫn do version quyết định.

### 7.5 `liquibase/application-liquibase.yml`

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

### 7.6 `common/env.example` — tập biến bắt buộc

Phải khớp **đúng** tập biến mà các file `application-*.yml` ở §7.3–§7.5 tham chiếu, không thừa
không thiếu (đây chính là B2):

```
# Kết nối DB — bắt buộc
DB_URL=jdbc:postgresql://localhost:5432/<db_name>
DB_U=<user có quyền DDL>
DB_P=

# Định danh job — tuỳ chọn, có giá trị mặc định trong yml
APP_NAME=db-migration

# Flyway — chỉ dùng khi chạy profile `flyway`
FLYWAY_BASELINE_ON_MIGRATE=false
FLYWAY_BASELINE_VERSION=0

# Liquibase — chỉ dùng khi chạy profile `liquibase`
LIQUIBASE_CONTEXTS=
LIQUIBASE_SCHEMA=public
```

Không có `DB_MIGRATION_PORT`, không có `*_ENABLED`, không có `*_LOCATIONS` / `*_CHANGELOG`: cờ bật
công cụ do profile quyết định (P2), còn vị trí migration là hằng số của template, không phải cấu
hình vận hành.

Lệnh chạy job:

```bash
java -jar <app>-db-migration.jar --spring.profiles.active=migration,flyway
```

### 7.7 Quy ước đặt tên

**Flyway** (`flyway/CONVENTIONS.md`):

```
V<yyyyMMddHHmmss>__<mo_ta_khong_dau>.sql    versioned — ĐÃ APPLY LÀ BẤT BIẾN
R__<ten_object>.sql                          repeatable — chạy lại khi checksum đổi, SAU mọi V
<tên file migration>.conf                    cấu hình riêng cho một file (transaction, điều kiện)
```

**Liquibase** (`liquibase/CONVENTIONS.md`):

```
db.changelog-master.yaml                     chỉ chứa include, không chứa change
<yyyyMMddHHmmss>-<mo-ta-gach-noi>.yaml       một nhóm changeSet
sql/<cùng tên>.sql                           SQL thô, changeSet trỏ vào bằng sqlFile
changeSet.id     = <yyyyMMddHHmmss>-<mo-ta>
changeSet.author = <tên thật hoặc email>
```

Quy tắc bất biến chung cho cả hai: **file đã apply ở bất kỳ môi trường nào là bất biến.** Sửa nội
dung = thêm file mới. Không dùng `repair` / `clearChecksums` để "cho qua".

### 7.8 Ví dụ `.conf` cho index không chạy trong transaction

`V20260101130000__vi_du_index_concurrently.sql.conf`:

```
executeInTransaction=false
```

Postgres không cho `CREATE INDEX CONCURRENTLY` chạy trong transaction, mà Flyway mặc định bọc mỗi
migration trong một transaction. File `.conf` cùng tên là cách tắt cho đúng một migration.

---

## 8. Sự kiện đã kiểm chứng vs chưa kiểm chứng

Phần này để session thực thi không phải kiểm lại, và biết chỗ nào phải tự kiểm.

### 8.1 Đã kiểm chứng (2026-09-07)

| Sự kiện | Nguồn |
|---|---|
| `be-egov-parent:1.4.0-SNAPSHOT` pin `spring.boot.version = 3.5.14` | `~/.m2/.../be-egov-parent-1.4.0-SNAPSHOT.pom` |
| Spring Boot 3.5.14 → Flyway **11.7.2**, Hibernate **6.6.49.Final** | `spring-boot-dependencies-3.5.14.pom` |
| Spring Boot 3.3.x → Flyway 10.10.0 (nên tài liệu ghi "3.3.x" của một số project là lệch) | `spring-boot-dependencies-3.3.13.pom` |
| `be-iam-parent` dùng `spring-boot-starter-parent:3.5.7`, ghim tay Flyway 11.17.0 / Liquibase 4.33.0 | `be-iam-parent/pom.xml` dòng 52-54 |
| Flyway `cleanDisabled` **mặc định `true`** | Redgate docs, trang Clean Disabled Setting |
| `FlywayProperties` (Boot 3.5.9) có 50+ trường gồm `executeInTransaction`, `validateMigrationNaming`, `cleanDisabled`, `outOfOrder`, `table`, `placeholders` | `javap -p` trên `spring-boot-autoconfigure-3.5.9.jar` |
| `LiquibaseProperties` có 24 trường gồm `labelFilter`, `parameters`, `testRollbackOnUpdate`, `rollbackFile`, `tag` | `javap -p` cùng jar |
| Autoconfig Flyway có sẵn `FlywayMigrationInitializer`, `FlywayMigrationStrategy`, `FlywayConfigurationCustomizer`, `PostgresqlFlywayConfigurationCustomizer` | liệt kê class trong jar |
| Vị trí mặc định `classpath:db/migration`; Spring Boot gọi `Flyway.migrate()` và migration chạy trước khi Hibernate khởi tạo | Spring Boot how-to Data Initialization |
| Không nên dùng `schema.sql`/`data.sql` song song Flyway/Liquibase | như trên |
| Migration chỉ-cho-test đặt ở `src/test/resources/db/migration` | như trên |
| Flyway ≥ 10 tách module theo DB: cần `flyway-database-postgresql` cạnh `flyway-core` | như trên |
| Script config file: cùng thư mục, cùng tên file migration + hậu tố `.conf`, dùng để tuỳ biến transaction và điều kiện chạy | Redgate docs, trang Migrations |
| Trong một lần chạy: mọi versioned pending chạy trước theo thứ tự, rồi tới repeatable đã đổi, repeatable sắp theo description | Redgate docs, trang Migrations |
| 15 khiếm khuyết B1–B5 / D1–D10 của `iam-db-migration` | đọc trực tiếp source |

### 8.2 Chưa kiểm chứng — session thực thi phải tự xác nhận

| Điều cần xác nhận | Cách xác nhận |
|---|---|
| [Unverified] Flyway coi `_` trong phần version tương đương `.` | thử một file `V1_2__x.sql`, đọc `flyway_schema_history.version` |
| [Unverified] Undo migration `U__` chỉ có ở Teams/Enterprise | trang pricing/docs Redgate |
| [Unverified] Baseline migration `B__` có ở Community từ version nào | docs Redgate |
| [Unverified] Ứng dụng fail với `ClassNotFoundException` khi `spring.factories` trỏ class không tồn tại | không cần — template bỏ hẳn `spring.factories` (P9) |
| [Unverified] `@DataJpaTest` có tự loại Flyway không | chạy thử nếu project đích có test loại này |
| [Unverified] Ngữ nghĩa chính xác của `runOnChange` khi dùng chung với `sqlFile` | thử sửa file SQL rồi chạy lại |
| [Unverified] `baseline-on-migrate=true` + `baseline-version=0` khiến Flyway bỏ qua file `V0…` (version ≤ baseline) | chạy thử trên DB rỗng: bật cờ, xem `V0` có bị skip trong `flyway_schema_history` không |
| [Inference] Tách user DB (app DML-only, migration dùng user DDL) là best practice | tuỳ chính sách DBA — skill phải HỎI, không mặc định |
| [Inference] Tạo partition theo tháng không nên là versioned migration vô hạn | nêu thành quyết định phải chốt trong ADR của project đích, gợi ý job hoặc pre-create N tháng |

---

## 9. Kiểm thử & verification

1. `npm run validate` — hợp đồng source + build output.
2. `npm test` — validate --build, install, wizard, managed-block, pack-guard.
3. `npm run build` rồi kiểm bằng mắt: skill xuất hiện ở `build/claude/plugins/backend/skills/`,
   `build/codex/`, `build/cursor/`, `build/antigravity/`, và `references/` có đủ ở **cả bốn**
   (parity do `test/validate.mjs` ép).
4. Kiểm frontmatter: `order: 9` không trùng, `pipeline: false`, `next: null`.
5. Kiểm `description` chứa đủ cụm kích hoạt tiếng Việt lẫn tiếng Anh.
6. Đọc lại toàn bộ template: không còn lớp `@Configuration` tự viết, không còn `spring.factories`,
   `env.example` khớp đúng tập biến mà các file `application-*.yml` tham chiếu.
7. Kiểm **không trùng path tương đối trong `references/` giữa các skill backend**: `spring-boot/README.md`
   đã bị `backend-migrate-vault-consul` chiếm → skill này để README ở gốc `references/`. `test/validate.mjs`
   (mục hygiene dòng 117–125) sẽ ĐỎ nếu còn trùng. Đối chiếu nhanh các path tương đối `spring-boot/*` giữa
   hai skill trước khi đặt tên file mới.

**Không có** trong đợt này: chạy thử template lên một Postgres thật. Đó là việc của phiên pilot
(Q2 đã chốt hoãn). Spec này không được tuyên bố template "đã chạy được".

---

## 10. Ranh giới / ngoài phạm vi

- Không sửa `be-iam`. §3 là báo cáo để team đó tự xử lý.
- Không áp lên `be-directive-mgt` trong đợt này.
- Không ship template cho `dotnet` / `node` / `python` — chỉ ghi vào SKILL.md rằng stack chưa có
  template thì vẫn chạy được bước 1–4, còn bước 6 sinh layout trung tính và hỏi người dùng.
- Không tự chạy migration lên DB. Không chạy `pg_dump` khi chưa được cho phép kết nối.
- Không push thẳng `main`/`master`/`dev`/`develop`. Dừng cho người duyệt diff trước khi commit.
- Không thêm test tự động cho project đích (theo ghi nhớ "logic first" của chủ dự án); verification
  ở đây là của **kit**, không phải của project đích.

---

## 11. Các pha thực thi

| Pha | Nội dung | Điều kiện xong |
|---|---|---|
| P1 | Tạo `plugins/backend/skills/backend-migrate-db/SKILL.md` — frontmatter + 7 bước + gate cứng bước 4 + ranh giới an toàn | `npm run build` thấy skill ở cả 4 provider |
| P2 | `references/inventory-checklist.md` + `references/tool-comparison-rubric.md` | Rubric có đủ 6 tiêu chí, cột bằng chứng, quy tắc kết luận |
| P3 | `references/spring-boot/common/` — module pom, `DbMigrationApplication`, `application-migration.yml`, `env.example` (§7.6), `new-migration.sh` | `env.example` khớp đúng tập biến các yml tham chiếu |
| P4 | `references/spring-boot/flyway/` — yml, CONVENTIONS, layout mẫu, file `.conf` | Không có lớp `@Configuration`; naming đúng `__` |
| P5 | `references/spring-boot/liquibase/` — yml, master changelog, CONVENTIONS, changeSet mẫu **có `rollback`** và `runOnChange` | Mỗi changeSet mẫu có block rollback |
| P6 | `references/README.md` (GỐC references/, KHÔNG phải `spring-boot/README.md` — tránh trùng path với vault-consul) — ma trận file, cách chọn nhánh, cách chạy job | Đọc README là dựng được module; `npm run validate` không báo trùng references |
| P7 | Cập nhật `plugins/backend/.manifest.json`: **viết lại `description` cho đủ TOÀN BỘ skill hiện có** (init, implement, testing, code-review, refactor, migrate-vault-consul, migrate-architecture, api-contract) + thêm `backend-migrate-db` — vì description hiện chỉ liệt kê 3/8 (đã cũ, không do skill này). Bump `version` `1.1.1` → `1.2.0` (thêm năng lực, không phá vỡ). Đồng bộ catalog plugin ở `README.md` → `README_VI.md` và `CLAUDE.md` (đang liệt kê thiếu skill backend) theo Change checklist của repo. `npm test`. | `npm test` xanh; catalog README/CLAUDE khớp `plugins/backend/skills/` |
| P8 | Dừng cho người duyệt diff → commit qua `core:git-workflow` (1 task = 1 commit, không trailer đồng tác giả) | Người dùng duyệt |

Thứ tự P1 → P8 tuần tự; P4 và P5 độc lập nhau, làm song song được.
