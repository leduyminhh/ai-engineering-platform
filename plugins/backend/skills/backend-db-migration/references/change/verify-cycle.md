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

Flyway dùng theo **forward-only**: không chạy undo. Undo migration (`U__`) là tính năng bản Teams; Flyway Community
không hỗ trợ undo script ([Redgate Flyway — Undo migrations](https://documentation.red-gate.com/fd/undo-migrations-273973334.html);
[Flyway development and deployment pipelines — Agile Database Development](https://documentation.red-gate.com/fd/flyway-development-and-deployment-pipelines-180715693.html)).
An toàn dựa vào expand/contract; hoàn tác = migration bù mới, ghi trong runbook.

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

`[Unverified]` Đổi location `classpath:` → `filesystem:` không đổi identity migration trong `flyway_schema_history` —
trang [Flyway schema history table](https://documentation.red-gate.com/fd/flyway-schema-history-table-273973417.html)
không mô tả giá trị cột `script`. Nếu bước (b) báo lệch checksum/script, dừng và báo, không `repair`.

## Liquibase

| Bước | Lệnh | Chứng minh |
|---|---|---|
| (a) Từ rỗng | DB test rỗng → `java -jar target/<app>-db-migration.jar --spring.profiles.active=migration,liquibase` | Changelog chạy được từ đầu |
| Up → down → up | DB test ở trạng thái trước thay đổi → chạy lệnh (a) kèm `--spring.liquibase.test-rollback-on-update=true` | Block `rollback` của changeSet mới chạy được |
| (c) App | Như Flyway (c) | Entity khớp schema mới |

Spring Boot mô tả `spring.liquibase.test-rollback-on-update` là "Whether rollback should be tested before update is
performed", mặc định `false`
([Common Application Properties — Data Migration Properties](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)).
`[Unverified]` Property này chạy đúng chuỗi update → rollback → update như lệnh Liquibase
[`update-testing-rollback`](https://docs.liquibase.com/secure/reference-guide-5-2/init-update-and-rollback-commands/update-testing-rollback)
— tài liệu Spring không nêu chuỗi thao tác. Log không cho thấy rollback đã chạy → dùng Liquibase CLI / Maven plugin
theo tài liệu version của project: `update-testing-rollback`, hoặc `update` → rollback theo số changeSet vừa thêm →
`update`.

## Alembic

Không có template (M2). Chu trình: `alembic upgrade head` → `alembic downgrade -1` → `alembic upgrade head` trên DB
test đã xác nhận; mỗi revision mới phải có `downgrade()` chạy được.

## Evidence

Mỗi lệnh một mục trong `validation` của report: `command`, `exit_code`, `status`, `summary` (số migration/changeSet đã
áp, version cuối). Lệnh không chạy được → `status: not_run` + `reason`.
