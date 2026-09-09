# DDL + Migration expand-contract (reversible, online)

Tài liệu hướng dẫn hiện thực schema vật lý + viết migration. Mọi ví dụ dưới đây là MẪU MINH HỌA
(pseudo-DDL), KHÔNG phải migration cuối cùng — sinh DDL thật theo `schema-conventions.md` + engine
của project. Ngôn ngữ đo được; đánh dấu `[giả định]` khi suy đoán.

## A. Từ data-model → schema vật lý (bước 1)

Với mỗi thực thể trong data-model, chốt các thuộc tính vật lý theo `schema-conventions.md`:

| Yếu tố | Cần quyết định | Ghi chú |
|---|---|---|
| Tên bảng/cột | Theo quy ước đặt tên đã chốt | Không tự đổi quy ước ở đây |
| Kiểu dữ liệu | Ánh xạ theo engine (vd Postgres `timestamptz`, `numeric`, `text`) | Nêu rõ khác biệt engine |
| Nullability / default | NOT NULL vs nullable, giá trị mặc định | Cột mới trên bảng có dữ liệu: xem pha expand |
| Khóa chính | Surrogate (id sinh tự động) vs khóa tự nhiên | Ghi lý do |
| Khóa ngoại | Bảng/cột tham chiếu + hành vi ON DELETE/UPDATE | Mặc định hạn chế; CASCADE phải có chủ đích |
| Unique / check | Ràng buộc toàn vẹn nghiệp vụ | Là phần của hợp đồng nếu công bố |
| Index | Theo access pattern (cột lọc/join/sắp xếp) | Nêu access pattern biện minh cho index |

Phân biệt phần **CÔNG BỐ cho consumer** (vào `docs/contracts/`, đổi breaking phải version mới) và
phần **nội bộ** (index tối ưu, cột kỹ thuật) có thể đổi linh hoạt hơn.

## B. Nguyên tắc expand-contract (bước 2)

Mục tiêu: đổi schema mà consumer đang đọc/ghi KHÔNG gãy giữa chừng, và có đường lùi. Chia thay
đổi phá tương thích thành nhiều migration tuần tự:

1. **Expand** — thêm cấu trúc mới ở trạng thái tương thích ngược: bảng mới, hoặc cột mới ở dạng
   `NULL`-able (chưa NOT NULL), tạo index. Cả code cũ lẫn mới cùng chạy được.
2. **Migrate data** — backfill dữ liệu sang cấu trúc mới theo LÔ (batch), tránh một transaction
   dài khóa cả bảng. Ứng dụng ghi cả cột cũ lẫn mới trong giai đoạn chuyển tiếp (do phía consumer
   đảm nhận — nêu trong kế hoạch).
3. **Contract** — ở migration SAU (khi mọi consumer đã dùng cấu trúc mới): siết ràng buộc (đặt
   NOT NULL, thêm FK), rồi mới gỡ cột/bảng cũ.

KHÔNG gộp expand + contract vào một migration. KHÔNG drop/rename cột đang được consumer dùng trong
một bước — rename an toàn = thêm cột mới (expand) → backfill → chuyển consumer → gỡ cột cũ
(contract).

### Ví dụ minh họa — tách cột `full_name` thành `first_name` + `last_name`

```
-- Migration N (expand): up
ALTER TABLE customer ADD COLUMN first_name text NULL;
ALTER TABLE customer ADD COLUMN last_name  text NULL;
-- down
ALTER TABLE customer DROP COLUMN first_name;
ALTER TABLE customer DROP COLUMN last_name;

-- Migration N+1 (migrate data): up — backfill theo lô (lặp đến khi hết dòng NULL)
UPDATE customer
   SET first_name = split_part(full_name, ' ', 1),
       last_name  = nullif(substr(full_name, position(' ' in full_name) + 1), '')
 WHERE id IN (
   SELECT id FROM customer WHERE first_name IS NULL AND full_name IS NOT NULL LIMIT 5000
 );
-- down — dữ liệu đã backfill; hoàn tác bằng cách để cột mới trở lại NULL (không mất full_name)
UPDATE customer SET first_name = NULL, last_name = NULL;

-- Migration N+2 (contract): up — chỉ chạy khi mọi consumer đã đọc cột mới
ALTER TABLE customer ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE customer DROP COLUMN full_name;
-- down
ALTER TABLE customer ADD COLUMN full_name text NULL;
UPDATE customer SET full_name = concat_ws(' ', first_name, last_name);
ALTER TABLE customer ALTER COLUMN first_name DROP NOT NULL;
```

## C. Reversible — quy tắc viết `down`

- Mỗi `up` có `down` khôi phục cấu trúc về trạng thái trước migration.
- `down` của bước migrate-data KHÔNG bắt buộc khôi phục nguyên vẹn dữ liệu đã biến đổi; nhưng phải
  nêu rõ phần nào KHÔNG thể khôi phục (`[giả định]` về khả năng mất mát) để con người cân nhắc.
- Với thao tác một chiều thực sự (vd đã DROP cột ở contract), `down` chỉ tái tạo cấu trúc rỗng —
  ghi chú rõ dữ liệu cũ không tự quay lại; khôi phục dữ liệu là việc restore từ backup.

## D. Tương thích online (giảm khóa)

- Cột mới: thêm ở dạng NULL trước; đặt default/NOT NULL ở bước sau để tránh viết lại toàn bảng
  (hành vi tùy engine — kiểm tra tài liệu engine của project).
- Index: tạo kiểu không khóa ghi nếu engine hỗ trợ (vd Postgres `CREATE INDEX CONCURRENTLY`, ngoài
  transaction). Nêu rõ thao tác này không chạy trong transaction migration thường.
- Backfill: chia LÔ theo khóa, mỗi lô một transaction ngắn; tránh `UPDATE`/`DELETE` toàn bảng một
  lần trên bảng lớn.
- Đánh dấu mỗi thao tác migration: khóa NGẮN / có thể khóa LÂU (để con người chọn cửa sổ áp prod).

## E. DB object + seed (bước 3)

- View/constraint/trigger: chỉ thêm khi schema contract hoặc toàn vẹn nghiệp vụ đòi hỏi; đặt DDL
  trong migration versioned, nguồn trạng thái hiện tại phản ánh ở `db/schema/`.
- Seed idempotent: dùng upsert theo khóa tự nhiên để chạy lại không nhân bản.

```
-- Seed tham chiếu idempotent (minh họa)
INSERT INTO order_status (code, label) VALUES ('NEW', 'Mới'), ('PAID', 'Đã thanh toán')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label;
```

## F. Nguồn sự thật + bàn giao

- Cơ chế quản lý migration chốt ở init (ADR) quyết định định dạng file + cách đánh version + cách
  áp — bám theo, KHÔNG tự đổi.
- Schema ĐANG áp thật (`db/schema/`) > `schema-contract.md` đã công bố > ERD phác thảo.
- KHÔNG tự áp lên prod: bàn giao kế hoạch (thứ tự pha, cửa sổ chạy, rollback) cho con người duyệt.
