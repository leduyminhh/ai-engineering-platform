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
