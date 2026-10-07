# Backend cần gì — template task BE

Task `BE` = một command hoặc một query của một use case (một vertical slice theo `backend-implement`). Điền header
chung (task-template-common §3) + 10 mục dưới. Mục không áp dụng → `N/A — <lý do>`.

## Template chép được

````markdown
#### Backend

- **B1. Endpoint:** <METHOD> <path> — operationId `<id>` (contract: docs/contracts/<file>)
- **B2. Use case:** <command | query> — <tên use case trong code>
- **B3. Aggregate + invariant:** <aggregate root>; invariant: <quy tắc luôn đúng>
- **B4. Validation:**

  | Field | Rule | Thông báo lỗi |
  |---|---|---|
  | <field> | <rule> | <thông báo> |

- **B5. Phân quyền:** <role/scope được gọi>; chưa đăng nhập → 401; không đủ quyền → 403
- **B6. Dữ liệu chạm:** đọc <bảng>; ghi <bảng>; đổi schema → <UC..-DB-..> hoặc `N/A — không đổi schema`
- **B7. Bảng lỗi:**

  | Case | Mã lỗi | HTTP |
  |---|---|---|
  | <case> | <mã> | <status> |

- **B8. Transaction / idempotency / concurrency:** <ranh giới transaction; idempotency; khoá đồng thời>
- **B9. NFR:** hiệu năng <ngưỡng>; audit/log <sự kiện>; dữ liệu nhạy cảm <cách xử lý>
- **B10. Test bắt buộc:** unit lõi (mock/fake port) cho <case>; integration adapter cho <case>
````

## Hướng dẫn từng mục

### B1. Endpoint

Method + path + `operationId` khớp contract ở `docs/contracts/`. Chưa có contract → task phụ thuộc task `CT` của
use case. Use case không qua HTTP (job, consumer) → ghi trigger thay endpoint (vd `consumer topic order.created`).

### B2. Use case

Command (đổi trạng thái) hay query (chỉ đọc). Một task = một command hoặc một query; nhiều hơn → tách theo sizing.md.

### B3. Aggregate + invariant

Aggregate root bị đổi/đọc và các quy tắc nghiệp vụ phải luôn đúng (vd "tổng tiền đơn = tổng dòng − giảm giá",
"không huỷ đơn đã giao"). Lấy từ `data-model.md` và AC; không có → **[giả định]**.

### B4. Validation

Rule cho từng field đầu vào: bắt buộc, kiểu, độ dài, định dạng, miền giá trị. Đây là nguồn để FE đồng bộ ở F5.

### B5. Phân quyền

Role/scope được gọi; người chưa đăng nhập nhận 401, không đủ quyền nhận 403. Ràng buộc theo dữ liệu (vd chỉ chủ sở
hữu được sửa) ghi rõ.

### B6. Dữ liệu chạm

Bảng đọc / ghi. Đổi schema → tham chiếu task `DB`; không đổi schema trong task `BE`.

### B7. Bảng lỗi

Mỗi case lỗi nghiệp vụ/kỹ thuật → mã lỗi ứng dụng → HTTP status. Khớp contract; FE dùng bảng này ở F6.

### B8. Transaction / idempotency / concurrency

Ranh giới transaction (một transaction một aggregate); request lặp lại có an toàn không (idempotency key); tranh
chấp đồng thời (optimistic lock / version). Query chỉ đọc → `N/A — query chỉ đọc`.

### B9. NFR

Hiệu năng (vd p95 ≤ 300 ms ở 50 rps), audit/log (sự kiện cần ghi; không log dữ liệu nhạy cảm), dữ liệu nhạy cảm
(mask, mã hoá). Lấy từ NFR của use case hoặc ARD.

### B10. Test bắt buộc

Unit lõi với mock/fake port cho invariant + validation + phân quyền; integration adapter cho persistence/gateway.
Liệt kê case cụ thể gắn AC (vd "AC1.2 → test email trùng trả 409").
