# Ước lượng size S/M/L

| Size | Quy ước | Xử lý |
|---|---|---|
| S | ≤ 0.5 ngày công | Giữ |
| M | ≤ 2 ngày công | Giữ |
| L | > 2 ngày công | **Buộc tách** thành nhiều task S/M trước Checkpoint 2 |

Size là **gợi ý** cho teamlead, không phải cam kết; teamlead chỉnh ở Checkpoint 2.

## Dấu hiệu task sẽ thành L

- Một task `BE` gồm nhiều command/query.
- Một task `FE-UI` gồm nhiều màn hình, hoặc một màn hình có nhiều tab/bước độc lập.
- AC của task trải trên nhiều use case.
- Một task `DB` có hơn một thay đổi schema độc lập.

## Cách tách task L

| Loại | Tách theo |
|---|---|
| `BE` | Mỗi command/query một task; tách riêng phần tích hợp ngoài (gateway, message) nếu nặng |
| `FE-UI` | Mỗi màn hình một task; màn hình lớn → tách theo vùng (bảng, form, dialog) |
| `FE-INT` | Mỗi nhóm API (đọc / ghi) một task |
| `DB` | Mỗi migration độc lập một task; backfill dữ liệu tách task riêng |
| `CT` | Mỗi resource một task |
| `E2E` | Mỗi luồng đầu-cuối một task |

Sau khi tách: đánh số lại ID liên tục, cập nhật phụ thuộc, và truy vết AC cho từng task con.
