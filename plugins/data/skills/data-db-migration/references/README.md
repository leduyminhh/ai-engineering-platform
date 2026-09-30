# Kit template `data-db-migration` — Spring Boot + PostgreSQL

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

`[Inference]` Khi migration fail, job thoát với exit code khác 0 để CI/CD dừng deploy: `run(args)` ném exception trước
khi tới `SpringApplication.exit`, nên exit code đến từ exception không bắt được ở `main`, không từ
`SpringApplication.exit` + `System.exit` (hai lệnh này chỉ trả exit code khi job chạy xong). Xác nhận khi pilot.

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
| `flyway/db/migration/baseline/V00000000000000__baseline_schema.sql.tpl` | `src/main/resources/db/migration/baseline/V00000000000000__baseline_schema.sql` | Luôn ship (xem "Baseline Flyway" dưới) |
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

Mọi file `*.tpl` được đổi tên bằng cách **bỏ đuôi `.tpl`** sau khi điền placeholder; tên file Flyway và `sqlFile` trong
changeSet Liquibase trỏ tới tên `.sql` cuối cùng (không có `.tpl`).

## Placeholder

| Placeholder | Lấy từ |
|---|---|
| `{{parentGroupId}}`, `{{parentArtifactId}}`, `{{parentVersion}}` | Parent `pom.xml` của project (phải kế thừa hoặc import BOM Spring Boot) |
| `{{appName}}` | Tên app chính |
| `{{basePackage}}` | Package gốc của app chính |
| `{{BASELINE_DDL}}` | DDL sinh một lần từ schema thật, đã làm sạch (mục dưới) |
| `{{BASELINE_ROLLBACK_DDL}}` | DROP theo thứ tự ngược phụ thuộc (chỉ Liquibase) |

## Làm sạch DDL baseline

Khi được phép kết nối, sinh bằng `pg_dump --schema-only --no-owner --no-privileges`
([PostgreSQL — pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)): `--schema-only` chỉ dump định nghĩa
object, không dữ liệu; `--no-owner` bỏ lệnh gán owner (`ALTER OWNER` / `SET SESSION AUTHORIZATION`) vốn fail khi user
chạy migration không phải superuser hay owner; `--no-privileges` bỏ `GRANT`/`REVOKE`.

Trước khi điền `{{BASELINE_DDL}}`, xoá:

- Phần mở đầu cấu hình session: các dòng `SET …` và `SELECT pg_catalog.set_config('search_path', …)`. `[Unverified]`
  Danh sách dòng mở đầu cụ thể lấy theo output pg_dump thường gặp, trang tài liệu không liệt kê; đọc file dump thật.
- Mọi dòng meta-command psql (bắt đầu bằng `\`). Trang pg_dump bản `current` có option `--restrict-key` = "khoá
  `\restrict` của psql trong output dump" (dump plain-text), tức output có thể chứa dòng `\restrict`. `[Inference]`
  Flyway và Liquibase gửi SQL qua JDBC, không phải psql, nên meta-command làm migration fail. `[Unverified]` Cặp
  `\unrestrict` và version pg_dump bắt đầu sinh các dòng này chưa đối chiếu; kiểm file dump thật.

## Baseline Flyway — luôn ship V0, bật baseline-on-migrate theo môi trường

- **Luôn ship** `V00000000000000__baseline_schema.sql` (version 0). Nhờ vậy DB rỗng (CI, Testcontainers, bước (a) của
  `references/change/verify-cycle.md`, máy dev mới) dựng được toàn bộ schema chỉ từ migration.
- **Môi trường mà schema đã tồn tại** (DB đang chạy, chưa có `flyway_schema_history`): chỉ ở môi trường đó đặt
  `FLYWAY_BASELINE_ON_MIGRATE=true`, giữ `FLYWAY_BASELINE_VERSION=0`. Flyway ghi baseline version 0 rồi bỏ qua V0, chỉ
  áp các migration sau V0.
- **DB rỗng**: giữ `FLYWAY_BASELINE_ON_MIGRATE=false` (mặc định) → V0 chạy như migration đầu tiên.

Theo [Flyway — Baseline On Migrate Setting](https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-baseline-on-migrate-setting):
baseline chỉ tự gọi khi migrate chạy trên schema **không rỗng** và **chưa có** bảng schema history, rồi chỉ áp migration
có version **lớn hơn** `baselineVersion`; mặc định `false`; trang này cảnh báo bật nó là bỏ lớp bảo vệ chống migrate nhầm
DB khi cấu hình sai → chỉ bật đúng ở môi trường cần, không đặt `true` trong file cấu hình chung. `[Inference]` Version
`00000000000000` được Flyway đọc là 0, nên V0 không "lớn hơn" baseline 0 và bị bỏ qua; xác nhận khi pilot.

**Schema dở dang** (DB có một phần object của baseline, hoặc lệch so với V0): DỪNG, hỏi người dùng. Không bật
baseline-on-migrate để "cho qua" — Flyway sẽ coi schema đã khớp V0 dù thực tế thiếu object.

## Liquibase với DB đã có dữ liệu

`[Inference]` Job của kit (`--spring.profiles.active=migration,liquibase`) chỉ chạy Liquibase `update` khi khởi động,
nên changeSet baseline sẽ chạy DDL trên DB đã có schema nếu không chặn; DDL tạo object đã tồn tại sẽ fail hoặc làm
lệch schema.

**Đường chính (chạy được trong job):** khi adopt DB đã có dữ liệu, thêm `preConditions` vào changeSet baseline
(`baseline/<timestamp>-baseline-schema.yaml`) để bỏ qua DDL nếu schema đã có. `onFail: MARK_RAN` = "bỏ qua changeSet
nhưng đánh dấu đã chạy, rồi chạy tiếp changelog"
([Liquibase — What are preconditions?](https://docs.liquibase.com/concepts/changelogs/preconditions.html)):

```yaml
  - changeSet:
      id: <timestamp>-baseline-schema
      author: <tên thật hoặc email>
      preConditions:
        - onFail: MARK_RAN
        - not:
            - tableExists:
                tableName: <bang_then_chot>
                schemaName: public
      # changes + rollback giữ nguyên như template
```

- `[Inference]` Điều kiện là `not tableExists`: DB rỗng → điều kiện đúng → chạy DDL baseline; DB đã có bảng →
  điều kiện sai → `MARK_RAN`, không chạy DDL. Một changeSet dùng được cho cả hai loại DB.
- `<bang_then_chot>` là một bảng chắc chắn có trong schema thật (vd bảng lõi được tạo sớm nhất). `[Inference]`
  Precondition chỉ kiểm một bảng: DB có schema dở dang (có bảng đó nhưng thiếu bảng khác) vẫn bị `MARK_RAN` → đối
  chiếu schema với baseline trước khi chạy.
- `[Unverified]` Cú pháp YAML trên theo ví dụ ở trang tài liệu dẫn trên (bản Liquibase Secure 5.1); đối chiếu với
  tài liệu đúng version Liquibase mà BOM của project pin.

**Đường thay thế (ngoài job, không có trong kit):** lệnh `changelog-sync` của Liquibase CLI / Maven plugin "đánh dấu
mọi thay đổi chưa deploy trong changelog là đã chạy"
([Liquibase — changelog-sync](https://docs.liquibase.com/commands/utility/changelog-sync.html)).

- **Cảnh báo:** chỉ chạy khi master changelog **chỉ còn** changeSet baseline. Nếu đã có changeSet thật chưa chạy,
  `changelog-sync` đánh dấu luôn chúng là đã chạy mà không thực thi SQL → schema thiếu thay đổi mà không báo lỗi.
- Kit không kèm `liquibase-maven-plugin` hay Liquibase CLI. `[Unverified]` Cú pháp lệnh / tên Maven goal chính xác
  tuỳ version Liquibase; đối chiếu tài liệu đúng version trước khi chạy.

Với cả hai đường:

- Xác nhận DB đích theo `references/change/verify-cycle.md` (mục "Xác nhận DB đích — làm TRƯỚC mọi lệnh") trước khi
  chạy bất kỳ lệnh nào.

## Lưu ý dependency

`flyway-database-postgresql` không khai `<version>` để BOM pin. `[Unverified]` Nếu BOM của project không quản version
artifact này, Maven báo thiếu version → hỏi người dùng, ghi ADR trước khi thêm version tay.

- `[Unverified]` Artifact `flyway-database-postgresql` chỉ có từ **Flyway 10** (Flyway cũ hơn không có artifact này),
  và Flyway 10+ đi cùng Spring Boot ≥ 3.3 — chưa đối chiếu tài liệu gốc; kiểm version Flyway mà BOM của project pin.
- Parent của module phải **hoặc** kế thừa `spring-boot-starter-parent` (parent này có sẵn execution goal `repackage`),
  **hoặc** import BOM Spring Boot (`<scope>import</scope>`). Import BOM chỉ mang dependency management, **không** mang
  plugin management ([Spring Boot Maven Plugin — Using the Plugin](https://docs.spring.io/spring-boot/maven-plugin/using.html)),
  nên với parent kiểu này phải tự khai `<version>` cho `spring-boot-maven-plugin` và execution goal `repackage`
  (`module-pom.xml.tpl` chỉ khai plugin, không khai version hay `<executions>`).
- `[Inference]` Thiếu các điều trên thì version dependency/plugin không resolve được hoặc jar không được đóng gói để
  chạy bằng `java -jar`.

## Flyway và `CREATE INDEX CONCURRENTLY`

Tài liệu Flyway ghi setting transactional lock (mặc định `true`: advisory lock dạng transaction; `false`: lock cấp
session) "nên đặt `false` cho lệnh như `CREATE INDEX CONCURRENTLY`"
([Flyway — PostgreSQL Transactional Lock Setting](https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-postgresql-namespace/flyway-postgresql-transactional-lock-setting)).
`application-flyway.yml` của kit **không** đổi setting này. `[Unverified]` Giữ mặc định thì migration
`CREATE INDEX CONCURRENTLY` có thể bị chặn chờ chính advisory lock của Flyway. `[Inference]` Key Spring là
`spring.flyway.postgresql.transactional-lock` (suy từ `FlywayProperties.Postgresql#setTransactionalLock`,
[Spring Boot 3.5 API](https://docs.spring.io/spring-boot/3.5/api/java/org/springframework/boot/autoconfigure/flyway/FlywayProperties.Postgresql.html)).

## Kiểm khi pilot

Các điểm dưới đây chưa kiểm trên project thật; pilot đầu tiên phải xác nhận từng điểm và ghi kết quả vào ADR:

- [ ] Major version Spring Boot của project là 3; pom module resolve được `flyway-core` / `liquibase-core` từ BOM.
- [ ] Flyway: migration mẫu `V20260101130000__vi_du_index_concurrently.sql` chạy xong với transactional lock mặc định,
      hay cần `spring.flyway.postgresql.transactional-lock: false` (mục trên).
- [ ] Flyway: với `FLYWAY_BASELINE_ON_MIGRATE=true` + `FLYWAY_BASELINE_VERSION=0` trên DB có schema sẵn, V0 bị bỏ qua
      và migration sau V0 được áp; trên DB rỗng V0 chạy (mục "Baseline Flyway").
- [ ] Liquibase: cú pháp `preConditions` (`onFail: MARK_RAN` + `not` / `tableExists`) đúng với version Liquibase mà BOM
      pin (mục "Liquibase với DB đã có dữ liệu").
- [ ] Liquibase: block `rollback` chạy trong transaction như changeSet, tức `SET LOCAL lock_timeout` trong
      `.rollback.sql` có tác dụng (`liquibase/CONVENTIONS.md`).
