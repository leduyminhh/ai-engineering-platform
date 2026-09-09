# Lineage nguồn→đích

Tài liệu hướng dẫn ghi lineage (dòng dõi dữ liệu) từ nguồn tới dataset đích để downstream truy vết
nguồn gốc và đánh giá tác động khi nguồn đổi. Mọi ví dụ là MẪU MINH HỌA. Ngôn ngữ đo được;
`[giả định]` khi suy đoán.

## A. Hai mức lineage

| Mức | Nội dung | Khi nào |
|---|---|---|
| Bảng (table-level) | Dataset đích phụ thuộc nguồn/model nào | Luôn ghi (tối thiểu) |
| Cột (column-level) | Cột đích ánh xạ về cột nguồn + transform áp dụng | Khi khả thi / khi cột quan trọng cho contract |

Table-level là mức bắt buộc tối thiểu; column-level ghi khi engine/thời gian cho phép, ưu tiên cột
thuộc data-contract công bố.

## B. Ghi lineage theo cơ chế engine

- Engine có lineage tự sinh (vd dbt `ref()`/`source()` dựng DAG phụ thuộc): dựa vào đó, KHÔNG ghi
  tay trùng lặp; chỉ bổ sung phần engine không suy ra được (semantic/đơn vị, quy tắc biến đổi).
- Không có lineage tự sinh: externalize bảng ánh xạ ra file trong `project-knowledge/` (hoặc theo
  cơ chế đã chốt ở init).

## C. Bảng ánh xạ column-level (minh họa)

| Cột đích (mart) | Nguồn | Transform áp dụng |
|---|---|---|
| `fct_orders.order_id` | `oltp.orders.id` | cast bigint |
| `fct_orders.amount_usd` | `oltp.orders.amount` | đơn vị USD, additive |
| `fct_orders.date_key` | `oltp.orders.created_at` | join `dim_date` theo ngày |
| `dim_customer.full_name` | `oltp.customers.first_name`, `last_name` | concat có khoảng trắng |

## D. Dùng lineage để đánh giá tác động

- Khi cột/bảng nguồn đổi (rename, đổi kiểu, ngừng cấp): tra lineage để liệt kê dataset đích + cột
  downstream bị ảnh hưởng TRƯỚC khi đổi.
- Đổi ảnh hưởng contract đầu ra → theo quy tắc contract: version backward-compat + ADR, thông báo
  downstream. KHÔNG đổi âm thầm.

## E. Bàn giao

- Cập nhật lineage vào `project-knowledge/` mỗi khi thêm/sửa transform; lineage lệch thực tế còn
  hại hơn không có → giữ đồng bộ hoặc dựa vào lineage tự sinh của engine.
- `[giả định]`: lineage ghi tay có thể lỗi thời khi transform đổi mà quên cập nhật — nêu residual
  risk và ưu tiên nguồn tự sinh khi có.
