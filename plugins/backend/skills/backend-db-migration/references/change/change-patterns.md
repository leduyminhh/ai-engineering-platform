# Pattern thay đổi schema (chế độ `change`, cổng C2)

Mỗi thay đổi đi qua tối đa ba pha. Mỗi pha là **migration riêng**; pha contract nằm ở **PR sau**, chỉ khi bản app
không còn dùng cấu trúc cũ đã deploy hết mọi môi trường.

| Pha | Làm gì | Code bản đang chạy |
|---|---|---|
| expand | Thêm cấu trúc mới, không phá cái cũ (cột nullable, bảng mới, index concurrent) | Vẫn chạy bình thường |
| migrate data | Backfill dữ liệu sang cấu trúc mới | Vẫn chạy; bản mới ghi cả hai nơi nếu cần |
| contract | Siết ràng buộc, gỡ cấu trúc cũ | Đã được thay bằng bản không dùng cấu trúc cũ |

Mức khoá của từng lệnh: [lock-risk-postgres.md](lock-risk-postgres.md). Ví dụ dùng bảng `invoice`.

## Backfill theo lô

Flyway/Liquibase bọc cả file migration trong một transaction, nên `UPDATE` cả bảng trong migration là một transaction
dài giữ khoá dòng. Cách chọn:

- Bảng nhỏ (người dùng xác nhận): `UPDATE` một lần trong migration pha migrate data.
- Bảng lớn: script/job riêng chạy ngoài công cụ migration, mỗi lượt một transaction ngắn, lặp tới khi 0 dòng:

```sql
UPDATE invoice
SET note_v2 = note
WHERE id IN (
  SELECT id FROM invoice
  WHERE note_v2 IS NULL AND note IS NOT NULL
  ORDER BY id
  LIMIT 5000
);
```

Pha contract chỉ chạy khi kiểm được backfill xong: `SELECT count(*) FROM invoice WHERE note_v2 IS NULL AND note IS NOT NULL;` = 0.

## Thêm bảng

expand: `CREATE TABLE`. Không có migrate data/contract. FK tới bảng lớn → xem "Thêm FK".

## Thêm cột nullable

expand: `ALTER TABLE invoice ADD COLUMN note text;` Không có pha khác.

## Thêm cột NOT NULL

```sql
-- expand
ALTER TABLE invoice ADD COLUMN status text;
-- migrate data: backfill theo lô tới khi không còn NULL
-- contract (migration riêng, PR sau khi code luôn ghi status)
ALTER TABLE invoice ADD CONSTRAINT invoice_status_not_null CHECK (status IS NOT NULL) NOT VALID;
ALTER TABLE invoice VALIDATE CONSTRAINT invoice_status_not_null;
ALTER TABLE invoice ALTER COLUMN status SET NOT NULL;
ALTER TABLE invoice DROP CONSTRAINT invoice_status_not_null;
```

`VALIDATE` và `SET NOT NULL` nên tách migration để `VALIDATE` (khoá nhẹ) không nằm chung transaction với
`SET NOT NULL` (khoá `ACCESS EXCLUSIVE`).

## Đổi tên cột

1. expand: thêm cột mới `customer_ref`.
2. Code bản N+1 ghi **cả hai** cột, vẫn đọc cột cũ.
3. migrate data: backfill `customer_ref` từ `customer_code` theo lô.
4. Code bản N+2 đọc cột mới, vẫn ghi cả hai.
5. contract (PR sau khi N+2 deploy hết): `ALTER TABLE invoice DROP COLUMN customer_code;`

Không dùng `RENAME COLUMN` khi có code đang chạy đọc tên cũ.

## Đổi kiểu cột

Mặc định làm như **đổi tên cột** (cột mới đúng kiểu + backfill + chuyển đọc + drop cột cũ). Chỉ dùng `ALTER COLUMN TYPE`
trực tiếp khi đổi binary-coercible theo [lock-risk-postgres.md](lock-risk-postgres.md) và người dùng xác nhận.

## Thêm index

```sql
-- file chạy NGOÀI transaction: Flyway .conf executeInTransaction=false / Liquibase runInTransaction: false
SET lock_timeout = '5s';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_customer_id ON invoice (customer_id);
```

Fail giữa chừng để lại index `INVALID`: `DROP INDEX CONCURRENTLY IF EXISTS idx_invoice_customer_id;` rồi chạy lại.

## Thêm unique

```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_invoice_number ON invoice (number);   -- ngoài transaction
ALTER TABLE invoice ADD CONSTRAINT uq_invoice_number UNIQUE USING INDEX uq_invoice_number;  -- migration kế tiếp
```

Trước khi tạo: kiểm trùng `SELECT number, count(*) FROM invoice GROUP BY number HAVING count(*) > 1;` — có dòng → DỪNG,
hỏi người dùng cách xử lý dữ liệu trùng. Build fail ở lượt quét thứ hai thì index `INVALID` **vẫn ép unique** lên ghi mới
([CREATE INDEX — Building Indexes Concurrently](https://www.postgresql.org/docs/current/sql-createindex.html)) → drop
index trước khi xử lý dữ liệu và chạy lại.

## Thêm FK

```sql
ALTER TABLE invoice ADD CONSTRAINT fk_invoice_customer
  FOREIGN KEY (customer_id) REFERENCES customer (id) NOT VALID;
-- migration riêng
ALTER TABLE invoice VALIDATE CONSTRAINT fk_invoice_customer;
```

Kiểm dòng mồ côi trước `VALIDATE`: `SELECT count(*) FROM invoice i LEFT JOIN customer c ON c.id = i.customer_id WHERE i.customer_id IS NOT NULL AND c.id IS NULL;`

## Drop cột / bảng

Chỉ ở pha contract. Điều kiện, đủ cả ba:

1. Grep code bản đang deploy không còn tham chiếu (evidence `file:line` = 0 kết quả, kể cả query native, view, report).
2. Người dùng xác nhận tường minh ở C2.
3. Runbook có cách khôi phục (backup/snapshot của người vận hành) — Flyway forward-only không hoàn tác được drop.
