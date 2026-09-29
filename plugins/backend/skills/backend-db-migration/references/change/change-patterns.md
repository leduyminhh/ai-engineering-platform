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

Mặc định Flyway bọc **mỗi migration** trong một transaction
([Flyway — Migration transaction handling](https://documentation.red-gate.com/fd/migration-transaction-handling-273973399.html)),
Liquibase bọc **mỗi changeSet**
([Liquibase — runInTransaction](https://docs.liquibase.com/reference-guide/changelog-attributes/runintransaction)),
nên `UPDATE` cả bảng trong một migration/changeSet là một transaction dài giữ khoá dòng. Cách chọn:

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
-- contract (PR sau khi code luôn ghi status) — ba migration riêng:
-- migration riêng 1
SET LOCAL lock_timeout = '5s';
ALTER TABLE invoice ADD CONSTRAINT invoice_status_not_null CHECK (status IS NOT NULL) NOT VALID;
-- migration riêng 2
SET LOCAL lock_timeout = '5s';
ALTER TABLE invoice VALIDATE CONSTRAINT invoice_status_not_null;
-- migration riêng 3
SET LOCAL lock_timeout = '5s';
ALTER TABLE invoice ALTER COLUMN status SET NOT NULL;
ALTER TABLE invoice DROP CONSTRAINT invoice_status_not_null;
```

Khoá giữ tới hết transaction
([Explicit Locking — Table-Level Locks](https://www.postgresql.org/docs/current/explicit-locking.html)), nên mỗi bước
một migration: `ADD … NOT VALID` chung transaction với `VALIDATE` thì `ACCESS EXCLUSIVE` của `ADD` bị giữ suốt lượt quét
của `VALIDATE`. `[Inference]` `VALIDATE` chung transaction với `SET NOT NULL` thì `SET NOT NULL` fail do `lock_timeout`
sẽ rollback cả lượt quét đã làm; tách riêng để chỉ chạy lại migration 3. Migration 3 giữ `ACCESS EXCLUSIVE` ngắn (bỏ
được quét nhờ CHECK đã hợp lệ, PG ≥ 12).

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

**Thu hẹp kiểu** (vd `varchar(255)` → `varchar(50)`, `bigint` → `integer`, `text` → `varchar(n)`) là thao tác phá huỷ:
giá trị không vừa kiểu mới làm migration fail hoặc phải cắt/chuyển dữ liệu. Chỉ làm sau xác nhận tường minh ở cổng C2,
kèm truy vấn đếm dòng vượt giới hạn kiểu mới trước khi chạy.

## Thêm index

```sql
-- file chạy NGOÀI transaction, chỉ một lệnh DDL; SET/RESET là lệnh session (cách cấu hình: đoạn dưới)
SET lock_timeout = '5s';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_customer_id ON invoice (customer_id);
-- SET ngoài transaction có hiệu lực cả session; không reset thì lọt sang migration sau trên cùng connection.
RESET lock_timeout;
```

Chạy ngoài transaction:

- Flyway: file script configuration cùng tên migration thêm đuôi `.conf` (vd `V7__idx_invoice_customer_id.sql.conf`)
  chứa `executeInTransaction=false`
  ([Flyway — Script Configuration](https://documentation.red-gate.com/fd/script-configuration-277578847.html);
  [Migration transaction handling](https://documentation.red-gate.com/fd/migration-transaction-handling-273973399.html)).
- Liquibase: `runInTransaction: false` trên changeSet
  ([Liquibase — runInTransaction](https://docs.liquibase.com/reference-guide/changelog-attributes/runintransaction));
  changeSet đó chỉ chứa **một lệnh DDL**, vì lỗi giữa chừng ở changeSet nhiều lệnh để `DATABASECHANGELOG` ở trạng
  thái sai (cùng trang). `[Inference]` `SET lock_timeout` / `RESET lock_timeout` là lệnh cấp session, không để lại
  trạng thái schema, nên đi kèm lệnh DDL đó như ví dụ trên không phá ràng buộc này.
- Flyway trên PostgreSQL: tài liệu Flyway ghi setting transactional lock "nên đặt `false` cho lệnh như
  `CREATE INDEX CONCURRENTLY`"
  ([Flyway — PostgreSQL Transactional Lock Setting](https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-postgresql-namespace/flyway-postgresql-transactional-lock-setting)).
  `[Unverified]` Giữ mặc định (advisory lock dạng transaction) thì `CREATE INDEX CONCURRENTLY` có thể bị chặn chờ chính
  lock đó. `[Inference]` Spring: `spring.flyway.postgresql.transactional-lock: false` — kiểm khi pilot
  (`references/README.md`, mục "Kiểm khi pilot").

Fail giữa chừng để lại index `INVALID`: `DROP INDEX CONCURRENTLY IF EXISTS idx_invoice_customer_id;` rồi chạy lại.
Trước khi chạy lại, kiểm `flyway_schema_history` (hoặc `DATABASECHANGELOG`): có dòng thất bại → DỪNG, báo người dùng,
không tự `repair`. `[Unverified]` Flyway ghi dòng thất bại cho migration `executeInTransaction=false` trên PostgreSQL —
tài liệu chỉ nêu việc đánh dấu failed và cần `repair` cho DB không hỗ trợ DDL trong transaction
([Migration transaction handling](https://documentation.red-gate.com/fd/migration-transaction-handling-273973399.html)).

## Thêm unique

```sql
-- migration 1, ngoài transaction (như "Thêm index")
SET lock_timeout = '5s';
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_invoice_number ON invoice (number);
RESET lock_timeout;
-- migration 2 (trong transaction): ACCESS EXCLUSIVE ngắn, không build lại index
SET LOCAL lock_timeout = '5s';
ALTER TABLE invoice ADD CONSTRAINT uq_invoice_number UNIQUE USING INDEX uq_invoice_number;
```

Đây là cách tài liệu PostgreSQL gợi ý để thêm constraint mà không chặn ghi lâu; index phải là b-tree, không partial,
không cột biểu thức; không áp cho bảng partitioned
([ALTER TABLE — Description, ADD table_constraint_using_index](https://www.postgresql.org/docs/current/sql-altertable.html)).

Trước khi tạo: kiểm trùng
`SELECT number, count(*) FROM invoice WHERE number IS NOT NULL GROUP BY number HAVING count(*) > 1;` (unique index
mặc định coi các NULL là khác nhau —
[CREATE INDEX — NULLS DISTINCT](https://www.postgresql.org/docs/current/sql-createindex.html)) — có dòng → DỪNG,
hỏi người dùng cách xử lý dữ liệu trùng. Build fail ở lượt quét thứ hai thì index `INVALID` **vẫn ép unique** lên ghi mới
([CREATE INDEX — Building Indexes Concurrently](https://www.postgresql.org/docs/current/sql-createindex.html)) → drop
index trước khi xử lý dữ liệu và chạy lại.

## Thêm FK

```sql
-- migration 1
SET LOCAL lock_timeout = '5s';
ALTER TABLE invoice ADD CONSTRAINT fk_invoice_customer
  FOREIGN KEY (customer_id) REFERENCES customer (id) NOT VALID;
-- migration riêng 2
SET LOCAL lock_timeout = '5s';
ALTER TABLE invoice VALIDATE CONSTRAINT fk_invoice_customer;
```

Kiểm dòng mồ côi trước `VALIDATE`: `SELECT count(*) FROM invoice i LEFT JOIN customer c ON c.id = i.customer_id WHERE i.customer_id IS NOT NULL AND c.id IS NULL;`

## Drop cột / bảng

Chỉ ở pha contract. Điều kiện, đủ cả ba:

1. Grep code bản đang deploy không còn tham chiếu (evidence `file:line` = 0 kết quả, kể cả query native, view, report).
2. Người dùng xác nhận tường minh ở C2.
3. Runbook có cách khôi phục (backup/snapshot của người vận hành) — Flyway forward-only không hoàn tác được drop.
