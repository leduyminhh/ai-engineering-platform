# Nguyên tắc riêng — Data (OLTP + OLAP)

> Phần này BỔ SUNG cho `core/principles/` (4 nguyên tắc cốt lõi, 3 tầng tài liệu,
> ranh giới an toàn nền, nguồn sự thật nền). Chỉ mô tả phần ĐẶC THÙ của plugin `data`.

Plugin `data` gộp hai NHÁNH phân biệt, chọn theo bản chất project:
- **Nhánh OLTP** (`data-oltp-*`): sở hữu một cơ sở dữ liệu VẬN HÀNH dùng chung như một SẢN PHẨM.
- **Nhánh OLAP** (`data-olap-*`): xây KHO/pipeline PHÂN TÍCH đọc dữ liệu TỪ các nguồn vận hành.
OLAP đọc dữ liệu TỪ nguồn vận hành (gồm chính một DB OLTP); cả hai KHÁC ERD nhúng trong một app
backend (mô hình dữ liệu của riêng service đó, phục vụ repository nội bộ — không phải DB dùng chung).

---

## Nhánh OLTP — cơ sở dữ liệu vận hành

### Thẻ nhận diện
- **Là ai:** workflow sở hữu một cơ sở dữ liệu VẬN HÀNH (OLTP) dùng chung như một SẢN PHẨM độc
  lập; chốt schema vật lý làm HỢP ĐỒNG công bố cho consumer, rồi migration versioned, rồi áp thật
  + test toàn vẹn.
- **Viết tắt:** OLTP = Online Transaction Processing (xử lý giao dịch trực tuyến) — CRUD độ trễ
  thấp, chuẩn hoá cao, toàn vẹn giao dịch (ACID).
- **Phục vụ:** app backend / service khác là CONSUMER đọc-ghi trực tiếp trên database này qua
  schema contract đã công bố.

### Phân tầng mã nguồn database
Schema/migration/DB object nằm trong root riêng (mặc định `db/`): `db/schema/` (DDL nguồn sự
thật của trạng thái HIỆN TẠI) → thư mục migration THEO cơ chế đã chọn (mặc định `db/migrations/`;
Liquibase `db/changelog/`, Flyway `db/migration/`, ORM dir framework — xem ADR-0004) · `db/seeds/`
(seed cho DB dev) · `db/queries/` (query dùng chung) · `db/functions/` (view/function/trigger),
tách hẳn khỏi tài liệu. `docs/contracts/` chứa SCHEMA CONTRACT đã CÔNG BỐ cho consumer (app
backend, service khác tiêu thụ cùng database).

> Lưu ý 2 chốt con người với database đặc biệt quan trọng: một migration sai có thể làm mất
> dữ liệu thật hoặc phá vỡ mọi consumer đang đọc/ghi chung một database.

### Pipeline database (thứ tự bắt buộc)
**Schema Contract** (schema vật lý: bảng/cột/kiểu/ràng buộc/khóa/index + seed mẫu) →
**Migration** (kế hoạch versioned, expand-contract, reversible) → **Implement đầy đủ** (áp
migration + DB object thật + test toàn vẹn). Chốt HÌNH DẠNG schema trước (tên bảng/cột, kiểu,
nullability, khóa chính/khóa ngoại, unique/check, index), rồi mới lập kế hoạch thay đổi
(migration), rồi mới áp dụng lên DB thật.

Contract của database là **SCHEMA CONTRACT**: chốt TRƯỚC schema vật lý của database vận hành
dùng chung — tên bảng/cột, kiểu dữ liệu theo engine đã chọn, nullability/default, PK/FK/
unique/check, index kèm lý do theo access pattern, grain/khóa tự nhiên vs surrogate — kèm
seed/sample khớp schema. Đây là HỢP ĐỒNG công bố cho consumer, KHÁC với ERD/mô hình phác thảo
ở giai đoạn phân tích (chỉ mô tả Ý ĐỊNH, chưa phải cam kết).

### Ranh giới an toàn — bổ sung OLTP
- Không chạy DDL phá hủy/ghi đè dữ liệu thật (DROP/TRUNCATE/ALTER làm mất dữ liệu) khi chưa
  được duyệt.
- Không tự kết nối / áp migration lên database production khi chưa được phép; ưu tiên DB
  dev/seed cho mọi thao tác thử nghiệm.
- Migration PHẢI reversible (có kịch bản down/rollback tương ứng mỗi up) trước khi áp dụng.
- Cơ chế quản lý schema chốt ở init (ADR-0004) là NGUỒN SỰ THẬT cho cách sinh + áp migration.
  Auto-DDL (`hbm2ddl.auto=update/create/create-drop` hay tương đương) trên DB dùng chung /
  production là ANTI-PATTERN (không kiểm soát, khó rollback) — ưu tiên migration versioned tường
  minh hoặc SINH RA có review; auto-DDL chỉ chấp nhận ở DB dev cá nhân.
- Secret kết nối (connection string, mật khẩu, API key của DB) qua biến môi trường / vault,
  KHÔNG hardcode và KHÔNG commit.
- Không commit migration fail test toàn vẹn (ràng buộc/khóa/index không hoạt động đúng như
  schema contract đã chốt).

### Nguồn sự thật — bổ sung OLTP
Schema ĐANG áp dụng thực trên DB (phản ánh ở `db/schema/`, trạng thái mới nhất) >
`schema-contract.md` đã công bố > ERD/mô hình phác thảo ở giai đoạn phân tích. Contract đã
công bố ở `docs/contracts/` > suy đoán từ tài liệu cũ hoặc trí nhớ. Đổi schema đã công bố theo
hướng breaking với consumer đã biết PHẢI có version mới + ADR ghi rõ lý do và kế hoạch tương
thích ngược — KHÔNG để schema thật âm thầm trôi khỏi hợp đồng đã công bố.

---

## Nhánh OLAP — kho/pipeline phân tích

### Thẻ nhận diện
- **Là ai:** workflow xây KHO/pipeline PHÂN TÍCH; chốt data contract (schema đầu ra + SLA + nguồn)
  làm hợp đồng cho downstream, rồi mô hình hoá dimensional/normalized + lineage, rồi build
  transform thật + data quality test. Bao cả warehouse, lakehouse, stream.
- **Viết tắt:** OLAP = Online Analytical Processing (xử lý phân tích trực tuyến) — đọc khối lớn,
  tổng hợp/aggregate, mô hình chiều (dimensional); tối ưu cho truy vấn phân tích, không phải giao dịch.
- **Đọc dữ liệu TỪ:** các nguồn vận hành — gồm chính một DB OLTP — KHÔNG sở hữu giao dịch vận hành.
- **Phục vụ:** BI/report/dashboard, data science, downstream dataset consumer.

### Phân tầng mã nguồn / transform
Transform/job/model nằm trong root riêng (mặc định `pipelines/`): `source/ingest` → `transform/model`
→ `sink/serving`, KHÔNG trộn với tài liệu. `docs/contracts/` chứa data contract đã công bố cho
downstream. Mọi data contract, lineage, kiến thức nền externalize ra file.

> Lưu ý 2 chốt con người với data đặc biệt quan trọng: một transform sai có thể làm hỏng cả
> dataset downstream.

### Pipeline data (thứ tự bắt buộc)
**Data Contract** (schema đầu ra + SLA + sample/synthetic) → **Model & Lineage** (mô hình hóa +
lineage cột + mapping transform→nguồn) → **Implement đầy đủ** (transform thật + data quality test).
Chốt HÌNH DẠNG dữ liệu đích trước (schema, grain, key, partition, freshness/SLA, expectation chất
lượng), rồi mô hình hóa nguồn→trung gian→đích + lineage, rồi mới build transform thật.

Contract của pipeline là **DATA CONTRACT** của dataset đầu ra: chốt trước schema đích (tên cột, kiểu,
nullability, semantic/đơn vị, primary/unique key, grain, partition key), kèm freshness/SLA và kỳ vọng
chất lượng (uniqueness/range/not-null) cùng quy tắc late/duplicate/null. Golden sample/synthetic data
khớp schema đóng vai MOCK để dev/test transform độc lập với nguồn upstream.

### Ranh giới an toàn — bổ sung OLAP
- Không chạy migration / backfill / lệnh phá hủy/ghi đè dữ liệu (DROP/TRUNCATE/overwrite partition) khi chưa duyệt.
- Không tự kết nối / đọc-ghi nguồn dữ liệu production khi chưa được phép; ưu tiên sample/synthetic.
- Không commit transform fail data quality test.

### Nguồn sự thật — bổ sung OLAP
schema/DDL thực của dataset đích > `data-model.md`; `contract.md` (data contract) > sample/synthetic
> lineage suy đoán. Transform tạo output lệch contract: DỪNG, sửa cho khớp hoặc cập nhật contract
(có ADR, version backward-compat) — KHÔNG để output trôi khỏi hợp đồng đã công bố.
