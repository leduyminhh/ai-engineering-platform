# Data-quality test — cổng trước khi publish dataset

Tài liệu hướng dẫn khai báo và chạy data-quality (DQ) test kiểm chứng output transform TRƯỚC khi
publish dataset. Mọi ví dụ là MẪU MINH HỌA — khai báo test thật theo engine (dbt tests / Great
Expectations / assertion SQL). DQ test chạy trên dữ liệu **mẫu/synthetic** khi verify, không chạm
prod khi chưa duyệt. Ngôn ngữ đo được; `[giả định]` khi suy đoán.

## A. Bộ test tối thiểu (khớp kỳ vọng trong data-contract)

| Loại test | Kiểm gì | Kỳ vọng |
|---|---|---|
| not-null | Cột bắt buộc không NULL | 0 dòng NULL |
| unique / primary-key | Khoá/grain không trùng | 0 khoá trùng |
| accepted-values | Cột enum nằm trong tập cho phép | 0 giá trị lạ |
| referential | FK tới dim tồn tại (không mồ côi) | 0 khoá không khớp dim |
| freshness | Dữ liệu đủ mới theo SLA | max(loaded_at) trong ngưỡng SLA |
| row-count anomaly | Số dòng lệch bất thường so baseline | Trong biên độ cho phép |

Mỗi kỳ vọng chất lượng đã công bố trong data-contract cần ÍT NHẤT một test tương ứng. Test thiếu =
phần contract đó chưa được gác.

## B. Ví dụ khai báo (minh họa)

```
-- unique + not_null cho grain của fact (dbt-style)
models:
  - name: fct_orders
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: status
        tests:
          - accepted_values: { values: ['NEW','PAID','CANCELLED'] }
      - name: date_key
        tests:
          - relationships: { to: ref('dim_date'), field: date_key }

-- freshness (minh họa assertion SQL) — kỳ vọng: không có kết quả (fail nếu trả dòng)
select 1
from fct_orders
having max(loaded_at) < now() - interval '24 hours';   -- SLA freshness 24h

-- row-count anomaly (minh họa) — so với baseline kỳ vọng
select count(*) as n from fct_orders;                   -- fail nếu ngoài [min, max] kỳ vọng
```

## C. Row-count / anomaly

- Chốt baseline kỳ vọng (khoảng min–max, hoặc lệch % so lần chạy trước) theo hiểu biết nghiệp vụ.
- `[giả định]`: baseline dựa trên mẫu; khi tải nguồn thay đổi (khuyến mãi, mùa vụ) biên độ có thể
  cần điều chỉnh — nêu residual risk thay vì cố định cứng.

## D. Cổng kết luận

- Toàn bộ DQ test XANH trên output (dữ liệu mẫu/synthetic) → mới coi là qua bước test và được
  publish dataset.
- Còn test FAIL → DỪNG, phân tích (transform sai vs kỳ vọng sai), sửa; KHÔNG publish, KHÔNG commit
  transform còn fail DQ test.
- Báo cáo: danh sách test + kết quả pass/fail, số dòng vi phạm mỗi test fail, freshness/row-count
  đo được, và residual risk (mẫu chưa phủ hết ca biên prod) trước khi con người duyệt chạy thật.
