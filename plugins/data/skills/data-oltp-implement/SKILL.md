---
name: data-oltp-implement
description: "Recipe hiện thực SCHEMA VẬT LÝ cho một DATABASE project OLTP: từ data-model + schema-conventions (do data-oltp-init tạo trong project-knowledge/) sinh DDL (bảng/cột/kiểu/nullability/default/khóa chính/khóa ngoại/unique/check/index) + migration versioned theo expand-contract, REVERSIBLE (mỗi up có down), tương thích online (không khóa lâu, backfill theo lô) + DB object tối thiểu (view/constraint/trigger) + seed idempotent, đặt trong root db/ đã phân tầng; giữ SCHEMA CONTRACT đã công bố cho consumer; test toàn vẹn chạy up/down trên DB tạm. Dùng skill NÀY khi người dùng muốn \"tạo schema database\", \"viết migration\", \"DDL\", \"expand-contract migration\", \"áp schema OLTP\", \"thêm bảng/cột\", \"seed dữ liệu\", \"schema change\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG tự áp migration lên production (nêu kế hoạch, con người duyệt/chạy). KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã chạy data-oltp-init."
order: 2
stageNumber: "02"
title: "OLTP Database Implement — Hiện thực schema vật lý + migration"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# OLTP Database Implement — Hiện thực schema vật lý + migration

Recipe hiện thực SCHEMA VẬT LÝ của một database OLTP dùng chung: từ **data-model** +
**schema-conventions** (nguồn trong `project-knowledge/`, do `data-oltp-init` tạo) sinh DDL
thật, **migration versioned expand-contract reversible**, DB object tối thiểu + seed, rồi test
toàn vẹn. Skill này KHÔNG nằm trong chuỗi bắt buộc; gọi khi cần trên project đã chạy
`data-oltp-init`. Đây là skill DOCS/hướng dẫn — sản phẩm là DDL + migration của project đích,
KHÔNG sinh code ứng dụng.

## Tiền đề
- Project đã có cấu trúc workflow database (đã chạy `data-oltp-init`). Nếu chưa, gợi ý khởi
  tạo trước; KHÔNG tự bịa layout.
- Mọi bối cảnh nằm trong FILE. Con người giữ 2 chốt: duyệt hình dạng schema + duyệt diff/áp prod.

## Ranh giới an toàn (đọc CLAUDE.md của project + `shared/principles.md`)
- KHÔNG tự kết nối / áp migration/DDL lên **production**: nêu kế hoạch, con người duyệt và tự chạy.
  Mọi thử nghiệm chạy trên DB dev/tạm.
- KHÔNG drop/rename/thay kiểu theo hướng phá tương thích trong MỘT bước; đi theo expand-contract
  nhiều pha (xem bước 2).
- Migration PHẢI reversible: mỗi `up` có `down` tương ứng trước khi coi là xong.
- Bám cơ chế quản lý schema đã chốt ở init (ADR) làm nguồn sự thật cho cách sinh + áp migration;
  auto-DDL trên DB dùng chung là anti-pattern. Đổi cơ chế/engine KHÔNG thuộc skill này.
- Secret kết nối qua biến môi trường / vault; KHÔNG hardcode, KHÔNG commit.
- KHÔNG commit migration còn fail test toàn vẹn.

**Ngôn ngữ (bắt buộc):** MỌI đầu ra hướng người dùng — bảng ánh xạ, kế hoạch migration, comment
trong DDL/migration sinh ra, báo cáo — viết **tiếng Việt CÓ DẤU** (UTF-8). Nêu số đo được; tránh
tuyên bố tuyệt đối; ghi rõ residual risk và đánh dấu `[giả định]` khi suy đoán.

## Quy trình

### 0. Nạp context + chốt scope
Đọc `project-knowledge/` (data-model / ERD đã chốt, `schema-conventions.md`, engine trong
`tech-stack.yml` — vd PostgreSQL/MySQL), CLAUDE.md (ranh giới an toàn), và layout root `db/` đã
phân tầng (`db/schema/`, thư mục migration theo cơ chế đã chọn, `db/seeds/`, `db/queries/`,
`db/functions/`). Chốt PHẠM VI thay đổi lần này (bảng/cột/ràng buộc nào thêm/sửa) trước khi viết.
Ca không chắc → liệt kê "CẦN XÁC NHẬN" và HỎI, KHÔNG tự suy diễn.

### 1. Chốt schema contract (hình dạng vật lý)
Chi tiết: [references/schema-and-migration.md](references/schema-and-migration.md).
- Từ data-model → tên bảng/cột, kiểu dữ liệu theo engine, nullability/default, PK/FK,
  unique/check, index (kèm lý do theo access pattern), khóa tự nhiên vs surrogate — TẤT CẢ theo
  `schema-conventions.md`.
- Xác định phần CÔNG BỐ cho consumer (bảng/cột/khóa/index thành hợp đồng) vs phần nội bộ.
- In bảng ánh xạ data-model → schema vật lý cho người duyệt. DỪNG cho duyệt hình dạng trước khi
  lập kế hoạch thay đổi.

### 2. Migration expand-contract (reversible, online)
Chi tiết + mẫu: [references/schema-and-migration.md](references/schema-and-migration.md).
- Viết migration **versioned** theo cơ chế đã chốt ở init; thứ tự an toàn nhiều pha:
  **expand** (thêm cấu trúc mới, cột nullable / bảng mới, không phá cái cũ) → **migrate data**
  (backfill theo LÔ, tránh transaction dài khóa bảng) → **contract** (siết ràng buộc / gỡ cột cũ
  ở migration SAU, khi không còn consumer dùng).
- Mỗi migration có `down` để hoàn tác (reversible). KHÔNG drop/rename phá tương thích một bước.
- Ưu tiên thao tác ít khóa (vd thêm cột nullable + default sau; tạo index kiểu concurrent nếu
  engine hỗ trợ). Ghi rõ thao tác nào CÓ THỂ khóa lâu để con người chọn cửa sổ chạy.
- Đổi schema đã công bố theo hướng breaking → version contract mới + ADR nêu lý do và kế hoạch
  tương thích ngược.

### 3. DB object + seed
- Thêm view/constraint/index/trigger THẬT SỰ cần theo access pattern và ràng buộc nghiệp vụ; đặt
  ở tầng phù hợp (`db/functions/`, DDL trong migration). Giữ tối thiểu — chỉ cái schema contract
  hoặc toàn vẹn dữ liệu đòi hỏi.
- Seed dữ liệu tham chiếu / mẫu **idempotent** (chạy lại không nhân bản; vd upsert theo khóa tự
  nhiên) vào `db/seeds/`, tách seed dev khỏi dữ liệu tham chiếu bắt buộc nếu cần.

### 4. Test toàn vẹn
Chi tiết: [references/integrity-tests.md](references/integrity-tests.md).
- Kiểm ràng buộc/khóa hoạt động đúng như schema contract: PK/unique chặn trùng, FK chặn tham
  chiếu mồ côi, check/nullable đúng, index tồn tại đúng cột.
- Chạy migration **up → down → up** trên **DB tạm** (không phải prod) để xác nhận reversible và
  không mất dữ liệu ở dải backfill (so số bản ghi / checksum trước–sau).
- Báo cáo kết quả THẬT (lệnh đã chạy, số kiểm pass/fail). Có fail → DỪNG, phân tích, sửa; KHÔNG
  tuyên bố hoàn tất khi chưa có bằng chứng.

### 5. Verify + bàn giao
- Xác nhận migration chạy up/down SẠCH trên môi trường tạm và test toàn vẹn xanh.
- Cập nhật `project-knowledge/` + `docs/contracts/` phản ánh schema contract MỚI (bảng/cột/khóa
  đã chốt); nếu breaking, kèm ADR.
- Nêu KẾ HOẠCH áp prod (thứ tự pha expand/contract, cửa sổ chạy, thao tác có thể khóa lâu, cách
  rollback) — **con người duyệt và tự áp lên prod**. Người dùng tự commit/push theo git-workflow.
- **Residual risk:** nêu rõ giới hạn — vd backfill trên bảng rất lớn vẫn có thể chậm/khóa tùy tải
  thật; test trên DB tạm KHÔNG phản ánh 100% dữ liệu prod. Ràng buộc mâu thuẫn (engine không hỗ
  trợ thao tác online đã chọn) → DỪNG và báo, không tự đi chệch.
