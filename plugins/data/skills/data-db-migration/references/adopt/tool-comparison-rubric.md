# Rubric so sánh Flyway ↔ Liquibase (chế độ `adopt`, bước A3)

So sánh theo **dữ liệu của chính project** lấy từ bảng hiện trạng ([inventory-checklist.md](inventory-checklist.md)).
Cấm trình bày bảng lý thuyết chung không gắn dữ liệu project.

## Tiêu chí

| Mã | Tiêu chí | Nghiêng **Flyway** khi | Nghiêng **Liquibase** khi | Trọng số |
|---|---|---|---|---|
| T1 | Số DB engine phải hỗ trợ | 1 engine cố định | ≥ 2 engine từ cùng changelog | Cao |
| T2 | Tỉ lệ SQL engine-specific | Cao: partition, PL/pgSQL, partial index, `jsonb` | Thấp: chủ yếu DDL phổ thông | Cao |
| T3 | Yêu cầu rollback | Expand/contract đã là chính sách | Vận hành bắt buộc rollback declarative | Trung bình |
| T4 | Baseline DB có dữ liệu | Dev bỏ được, hoặc đã có file DDL đầy đủ | Cần `generateChangeLog` từ DB legacy chưa có DDL | Trung bình |
| T5 | Người review migration | DBA đọc SQL thô | Dev đọc changeset abstract | Trung bình |
| T6 | Ngân sách ceremony | Tối giản, cần nhân rộng nhiều project | Chấp nhận master changelog + quy ước id/author | Thấp |

## Quy tắc kết luận

T1 và T2 là hai tiêu chí nặng. Cả hai cùng nghiêng một phía → khuyến nghị phía đó và nói rõ các tiêu chí còn lại không
đủ lật ngược. T1 và T2 nghiêng ngược nhau → trình bày cả hai kịch bản, **không tự chọn**.

## Lưu ý phải nêu khi trình bày

- `clean` mặc định đã bị khoá ở Flyway (`cleanDisabled = true`).
- Cả hai đều được BOM Spring Boot pin version; không ghim tay trừ khi có ADR.
- Điểm mạnh thật của Liquibase mà Flyway Community không có: `generateChangeLog` / `diffChangeLog` để baseline một
  DB legacy chưa có DDL.
- Điểm mạnh thật của Flyway: SQL thô nguyên vẹn, không lớp trung gian nào phải "dịch".
- Chế độ `change` của skill này dùng Flyway theo **forward-only** (không undo); Liquibase có block `rollback` chạy được.

## Định dạng trình bày

| Mã | Dữ liệu project | Bằng chứng | Nghiêng |
|---|---|---|---|
| T1 | 1 engine (PostgreSQL 16) | `application.yml:8` driver `org.postgresql.Driver` | Flyway |
| T2 | 3 function PL/pgSQL, 1 partial index | `db/schema.sql:40`, `:88`, `:120`, `:201` | Flyway |
| … | … | … | … |

**Khuyến nghị:** <Flyway | Liquibase> — <một dòng lý do gắn T1/T2>.
