-- BASELINE — chỉ cho DB RỖNG (greenfield/dev bỏ được), đi cùng FLYWAY_BASELINE_ON_MIGRATE=false.
-- DB đã có dữ liệu: KHÔNG ship file này; dùng baseline-on-migrate (xem references/README.md của skill).
-- Thay {{BASELINE_DDL}} bằng DDL sinh MỘT LẦN từ schema thật (file DDL sẵn có hoặc pg_dump --schema-only).
{{BASELINE_DDL}}
