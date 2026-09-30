# Rủi ro khoá — PostgreSQL (chế độ `change`, cổng C2)

Chỉ áp cho **PostgreSQL**; engine khác → DỪNG, hỏi DBA. Hành vi có thể khác theo version — đối chiếu version engine
thật của project (C1) với cột Nguồn. Nguồn đã đối chiếu với tài liệu PostgreSQL bản `current` (18) ngày 2026-09-29;
mốc "PG ≥ 11/12" lấy từ so sánh trang cùng tên ở bản 10/11/12.

## Vì sao khoá "ngắn" vẫn nguy hiểm

`ACCESS EXCLUSIVE` xung đột với mọi mức khoá, và là mức duy nhất chặn cả `SELECT` thường
([Explicit Locking — Table-Level Locks](https://www.postgresql.org/docs/current/explicit-locking.html)).
`[Unverified]` Lệnh đang **chờ** một khoá `ACCESS EXCLUSIVE` chặn mọi truy vấn đến sau nó, kể cả `SELECT`; một
`ALTER TABLE` chờ sau một transaction dài có thể làm đứng cả bảng dù bản thân lệnh chạy rất nhanh. Vì vậy mọi migration
đổi cấu trúc đặt `lock_timeout` để fail sớm và chạy lại, thay vì xếp hàng vô hạn — `lock_timeout` huỷ lệnh chờ khoá quá
hạn, tính riêng từng lần xin khoá
([Client Connection Defaults — lock_timeout](https://www.postgresql.org/docs/current/runtime-config-client.html)):

```sql
SET LOCAL lock_timeout = '5s';   -- migration chạy trong transaction
SET lock_timeout = '5s';         -- migration chạy ngoài transaction (vd CREATE INDEX CONCURRENTLY)
```

## Bảng thao tác

Lệnh `ALTER TABLE` giữ `ACCESS EXCLUSIVE` trừ khi tài liệu ghi mức khác cho từng subform.

| Thao tác | Khoá | Viết lại bảng? | Cách an toàn | Nguồn |
|---|---|---|---|---|
| `ADD COLUMN` nullable, không default | `ACCESS EXCLUSIVE` ngắn | Không | Làm trực tiếp, có `lock_timeout` | [ALTER TABLE — Notes](https://www.postgresql.org/docs/current/sql-altertable.html) |
| `ADD COLUMN … DEFAULT <hằng số>` | `ACCESS EXCLUSIVE` ngắn | Không (PG ≥ 11) | Làm trực tiếp | [ALTER TABLE — Notes](https://www.postgresql.org/docs/current/sql-altertable.html); so với [bản 10](https://www.postgresql.org/docs/10/sql-altertable.html) |
| `ADD COLUMN … DEFAULT <volatile>` (vd `gen_random_uuid()`) | `ACCESS EXCLUSIVE` | **Có** (bảng + index) | Thêm nullable → `ALTER COLUMN … SET DEFAULT` (chỉ áp cho `INSERT`/`UPDATE` sau đó, không đổi dòng cũ) → backfill theo lô; đặt default trước backfill để dòng chèn trong lúc backfill đã có giá trị | [ALTER TABLE — Notes](https://www.postgresql.org/docs/current/sql-altertable.html); [ALTER TABLE — Description, SET/DROP DEFAULT](https://www.postgresql.org/docs/current/sql-altertable.html) |
| `ALTER COLUMN … SET NOT NULL` | `ACCESS EXCLUSIVE` + quét toàn bảng | Không | `CHECK (col IS NOT NULL) NOT VALID` → `VALIDATE` → `SET NOT NULL` (PG ≥ 12) → drop CHECK | [ALTER TABLE — Description, SET NOT NULL](https://www.postgresql.org/docs/current/sql-altertable.html); so với [bản 11](https://www.postgresql.org/docs/11/sql-altertable.html) |
| `ADD CONSTRAINT CHECK` | `ACCESS EXCLUSIVE` + quét | Không | `NOT VALID` → `VALIDATE CONSTRAINT` (giữ `SHARE UPDATE EXCLUSIVE`) ở migration riêng | [ALTER TABLE — Notes](https://www.postgresql.org/docs/current/sql-altertable.html) |
| `ADD FOREIGN KEY` | `SHARE ROW EXCLUSIVE` trên cả hai bảng + quét | Không | `NOT VALID` → `VALIDATE CONSTRAINT` ở migration riêng | [ALTER TABLE — Description, ADD table_constraint](https://www.postgresql.org/docs/current/sql-altertable.html) |
| `ALTER COLUMN TYPE` | `ACCESS EXCLUSIVE` | **Có**, trừ đổi binary-coercible mà `USING` không đổi nội dung (vd `varchar` ↔ `text`); index vẫn có thể bị build lại | Cột mới + backfill (pattern đổi tên) | [ALTER TABLE — Notes](https://www.postgresql.org/docs/current/sql-altertable.html) |
| `CREATE INDEX` | `SHARE` (chặn ghi, vẫn cho đọc) | — | `CREATE INDEX CONCURRENTLY` (`SHARE UPDATE EXCLUSIVE`) chạy ngoài transaction | [CREATE INDEX — Building Indexes Concurrently](https://www.postgresql.org/docs/current/sql-createindex.html); [Explicit Locking — Table-Level Locks](https://www.postgresql.org/docs/current/explicit-locking.html) |
| `CREATE UNIQUE INDEX` | `SHARE` (chặn ghi); `CONCURRENTLY` → `SHARE UPDATE EXCLUSIVE` | — | `CREATE UNIQUE INDEX CONCURRENTLY` ngoài transaction | [Explicit Locking — Table-Level Locks](https://www.postgresql.org/docs/current/explicit-locking.html); [CREATE INDEX — Building Indexes Concurrently](https://www.postgresql.org/docs/current/sql-createindex.html) |
| `ADD CONSTRAINT … UNIQUE` | `ACCESS EXCLUSIVE` giữ tới hết transaction, tức cả lúc build index | — | Không dùng trên bảng có tải; thay bằng `CREATE UNIQUE INDEX CONCURRENTLY` → `USING INDEX` | [ALTER TABLE — Description, ADD table_constraint](https://www.postgresql.org/docs/current/sql-altertable.html); [Explicit Locking — Table-Level Locks](https://www.postgresql.org/docs/current/explicit-locking.html) |
| `ADD CONSTRAINT … UNIQUE USING INDEX` | `ACCESS EXCLUSIVE` ngắn (không build index) | Không | Migration riêng sau khi index concurrent hợp lệ, có `lock_timeout` | [ALTER TABLE — Description, ADD table_constraint_using_index](https://www.postgresql.org/docs/current/sql-altertable.html) |
| `RENAME COLUMN` / `RENAME TABLE` | `ACCESS EXCLUSIVE` ngắn | Không | Nhanh nhưng **làm vỡ code bản đang chạy** → pattern đổi tên | [ALTER TABLE — Description, RENAME](https://www.postgresql.org/docs/current/sql-altertable.html) |
| `DROP COLUMN` | `ACCESS EXCLUSIVE` ngắn | Không (chỉ ẩn cột, không thu hồi dung lượng ngay) | Chỉ ở pha contract, sau khi code không còn dùng | [ALTER TABLE — Notes](https://www.postgresql.org/docs/current/sql-altertable.html) |

`[Unverified]` Tăng độ dài `varchar(n)` là đổi binary-coercible (không viết lại bảng) — trang ALTER TABLE chỉ nêu ví dụ
`text` ↔ `varchar`; chưa đối chiếu được, coi như **có** viết lại bảng cho tới khi DBA xác nhận.

## Khi nào phải hỏi thêm

- Bảng bị đụng có số dòng lớn theo đánh giá của người dùng/ADR (skill không có ngưỡng mặc định): mọi thao tác "Có"
  ở cột viết lại bảng và mọi `VALIDATE` phải có cửa sổ chạy do người vận hành chọn.
- Thao tác không có trong bảng → DỪNG, hỏi DBA, không tự suy luận mức khoá.
