-- BASELINE (version 0) — luôn ship để DB rỗng (CI, Testcontainers, máy dev mới) dựng được schema từ migration.
-- Môi trường schema đã tồn tại: bật FLYWAY_BASELINE_ON_MIGRATE=true (version 0) để Flyway bỏ qua file này
-- (xem references/README.md của skill).
-- Thay {{BASELINE_DDL}} bằng DDL sinh MỘT LẦN từ schema thật, đã làm sạch theo references/README.md.
{{BASELINE_DDL}}
