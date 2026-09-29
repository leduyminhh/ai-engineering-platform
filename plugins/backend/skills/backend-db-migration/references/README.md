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

Mọi file `*.tpl` được đổi tên bằng cách **bỏ đuôi `.tpl`** sau khi điền placeholder; tên file Flyway và `sqlFile` trong
changeSet Liquibase trỏ tới tên `.sql` cuối cùng (không có `.tpl`).

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

## Liquibase với DB đã có dữ liệu

- KHÔNG để changeSet baseline chạy DDL trên DB đã có schema đó: DDL sẽ đụng object đã tồn tại.
- Với mỗi DB như vậy, đánh dấu changeSet baseline là **đã áp dụng** đúng một lần, không chạy SQL của nó — vd lệnh
  Liquibase `changelog-sync`. `[Unverified]` Tên lệnh / Maven goal chính xác tuỳ version Liquibase; đối chiếu tài
  liệu Liquibase đúng version project dùng trước khi chạy.
- Xác nhận DB đích theo `references/change/verify-cycle.md` (mục "Xác nhận DB đích — làm TRƯỚC mọi lệnh") trước khi
  chạy bất kỳ lệnh nào.

## Lưu ý dependency

`flyway-database-postgresql` không khai `<version>` để BOM pin. `[Unverified]` Nếu BOM của project không quản version
artifact này, Maven báo thiếu version → hỏi người dùng, ghi ADR trước khi thêm version tay.

- Artifact `flyway-database-postgresql` chỉ có từ **Flyway 10**; Flyway cũ hơn không có artifact này. `[Unverified]`
  Spec G2 §8.1 gắn Flyway 10+ với Spring Boot ≥ 3.3 — mốc Boot chính xác chưa đối chiếu tài liệu gốc; kiểm version
  Flyway mà BOM của project pin.
- Parent của module phải **hoặc** kế thừa `spring-boot-starter-parent`, **hoặc** import BOM Spring Boot và bind goal
  `repackage` của `spring-boot-maven-plugin` (`module-pom.xml.tpl` chỉ khai plugin, không khai `<executions>`); nếu
  không, version dependency không resolve được hoặc jar không đóng gói để chạy bằng `java -jar`.
