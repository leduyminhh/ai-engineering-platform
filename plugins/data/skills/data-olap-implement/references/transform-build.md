# Mô hình hoá + build transform theo layer

Tài liệu hướng dẫn mô hình hoá dữ liệu từ data-contract và build transform. Mọi ví dụ dưới đây là
MẪU MINH HỌA (pseudo-SQL/pseudo-model), KHÔNG phải transform cuối cùng — sinh transform thật theo
engine của project (dbt / Spark / SQL warehouse) và naming/code-convention ở init. Ngôn ngữ đo
được; đánh dấu `[giả định]` khi suy đoán.

## A. Từ data-contract → mô hình dữ liệu (bước 1)

Đọc data-contract đầu ra (schema đích + grain + SLA) rồi chốt mô hình:

| Yếu tố | Cần quyết định | Ghi chú |
|---|---|---|
| Kiểu mô hình | Dimensional (fact/dim) vs normalized | Theo cách downstream truy vấn |
| Grain | Một dòng fact = sự kiện gì ở độ hạt nào | Grain SAI kéo theo aggregate sai |
| Key | Surrogate key của dim, khoá tự nhiên/nghiệp vụ | Ghi lý do |
| Đo lường (measure) | Cột số + đơn vị + quy tắc aggregate (sum/avg) | Là phần của contract nếu công bố |
| Partition | Cột partition (thường theo thời gian) | Khớp chiến lược incremental |
| SCD (nếu dim đổi) | Type 1 (ghi đè) vs Type 2 (giữ lịch sử) | Nêu rõ chọn loại nào |

### Mô hình dimensional (khi chọn)
- **Fact**: chốt grain rõ ràng; chỉ chứa key tới dim + measure ở đúng grain đó.
- **Dimension**: thuộc tính mô tả, surrogate key; nếu cần lịch sử thay đổi → SCD Type 2 (valid_from/
  valid_to + cột current).
- Tránh trộn nhiều grain trong một fact; measure cộng dồn được (additive) tách khỏi measure không
  cộng dồn (ratio) — nêu rõ trong contract.

## B. Phân layer staging → intermediate → mart (bước 1)

| Layer | Vai trò | Nguyên tắc |
|---|---|---|
| staging | Chuẩn hoá 1-1 từ nguồn (đổi tên cột, ép kiểu, khử null rác) | KHÔNG join business logic ở đây |
| intermediate | Join / biến đổi trung gian tái dùng | Tách logic phức tạp khỏi mart |
| mart | Dataset đầu ra khớp data-contract | Đây là phần CÔNG BỐ cho downstream |

In bảng ánh xạ **nguồn → staging → intermediate → mart** (kèm grain + key mỗi cấp) cho người
duyệt. DỪNG cho duyệt HÌNH DẠNG mô hình trước khi build.

## C. Build transform theo tầng (bước 2)

Viết transform theo thứ tự `source/ingest` → `transform/model` → `sink/serving`, khai báo phụ
thuộc để engine chạy đúng thứ tự (staging trước intermediate trước mart).

### Idempotent vs incremental
- **Idempotent / full**: chạy lại cùng input → cùng output; đơn giản, phù hợp dataset nhỏ/vừa.
- **Incremental**: chỉ xử lý phần mới/đổi, merge/upsert theo khoá xác định + cột partition; phải
  xử lý late-arriving/duplicate theo quy tắc trong contract. Nêu rõ điều kiện chọn incremental.

```
-- staging: chuẩn hoá 1-1 từ nguồn (minh họa)
select
  cast(id           as bigint)      as order_id,
  cast(created_at   as timestamp)   as created_at,
  nullif(trim(email), '')           as email
from {{ source('oltp', 'orders') }}   -- CHỈ ĐỌC từ nguồn vận hành

-- mart fact incremental (minh họa) — grain: 1 dòng = 1 order
select
  o.order_id,
  d.date_key,
  o.amount                          as amount_usd   -- measure additive
from stg_orders o
join dim_date d on d.date = date(o.created_at)
{% if is_incremental() %}
where o.created_at > (select max(created_at) from {{ this }})
{% endif %}
```

- Bám grain/partition đã chốt; KHÔNG đổi tên cột/kiểu đã công bố trong data-contract.
- Tránh side-effect ngoài dataset đích (không ghi ngược nguồn vận hành).

## D. Nguồn sự thật + bàn giao

- Data-contract đầu ra (`docs/contracts/`) > mô hình phác thảo > sample/synthetic.
- Output transform lệch contract → DỪNG, sửa cho khớp hoặc đổi contract có version backward-compat
  + ADR. KHÔNG để output trôi khỏi hợp đồng đã công bố.
- KHÔNG chạy transform lên nguồn/đích prod khi chưa duyệt: bàn giao kế hoạch (thứ tự layer,
  incremental vs full, partition, cửa sổ chạy, rollback) cho con người duyệt.
