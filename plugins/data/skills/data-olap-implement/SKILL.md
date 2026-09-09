---
name: data-olap-implement
description: "Recipe hiện thực TRANSFORM/MODEL + PIPELINE cho một DATA WAREHOUSE/LAKEHOUSE project OLAP: từ data-contract (schema đầu ra + grain + SLA) và kiến trúc phân tầng (do data-olap-init tạo trong project-knowledge/) build transform thật trong pipelines/ (source/ingest → transform/model → sink/serving), mô hình hóa dimensional (fact/dim theo grain) hoặc normalized, layer staging → intermediate → mart, transform idempotent/incremental, data-quality test (not-null/unique/accepted-values/referential/freshness/row-count-anomaly) làm cổng trước khi publish dataset, và lineage nguồn→đích (cột/bảng) cho downstream truy vết; giữ DATA CONTRACT đầu ra đã công bố. Dùng skill NÀY khi người dùng muốn \"build pipeline\", \"viết transform\", \"ETL/ELT\", \"data model warehouse\", \"dimensional model\", \"data quality test\", \"lineage\", \"build dataset\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG chạy pipeline lên dữ liệu production khi chưa duyệt. KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã chạy data-olap-init."
order: 4
stageNumber: "04"
title: "OLAP Warehouse Implement — Hiện thực transform/model + pipeline"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# OLAP Warehouse Implement — Hiện thực transform/model + pipeline

Recipe hiện thực TRANSFORM/MODEL của một data warehouse/lakehouse OLAP: từ **data-contract**
(schema đầu ra + grain + SLA/freshness + kỳ vọng chất lượng) và **kiến trúc pipeline phân tầng**
(nguồn trong `project-knowledge/`, do `data-olap-init` tạo) build transform thật trong
`pipelines/` (`source/ingest` → `transform/model` → `sink/serving`), kèm **data-quality test** và
**lineage** nguồn→đích. Skill này KHÔNG nằm trong chuỗi bắt buộc; gọi khi cần trên project đã chạy
`data-olap-init`. Đây là skill DOCS/hướng dẫn — sản phẩm là transform/model + DQ test của
project đích, KHÔNG sinh code ứng dụng và KHÔNG chạy pipeline lên dữ liệu prod khi chưa duyệt.

## Tiền đề
- Project đã có cấu trúc workflow data (đã chạy `data-olap-init`). Nếu chưa, gợi ý khởi tạo
  trước; KHÔNG tự bịa layout hay data-contract.
- Mọi bối cảnh nằm trong FILE. Con người giữ 2 chốt: duyệt HÌNH DẠNG mô hình dữ liệu + duyệt
  diff/chạy lên nguồn/đích thật.

## Ranh giới an toàn (đọc CLAUDE.md của project + `shared/principles.md`)
- CHỈ ĐỌC từ nguồn vận hành (gồm nhánh OLTP (`data-oltp-*`)) — KHÔNG sở hữu / KHÔNG ghi lại giao dịch vận hành.
- KHÔNG tự kết nối / chạy transform lên nguồn hay đích **production** khi chưa duyệt: ưu tiên
  sample/synthetic; nêu kế hoạch, con người duyệt và tự chạy.
- KHÔNG chạy lệnh phá hủy/ghi đè dữ liệu (DROP/TRUNCATE/overwrite partition, full-refresh trên
  dataset lớn) khi chưa duyệt.
- Giữ **data-contract đầu ra** đã công bố: output lệch contract → DỪNG, sửa cho khớp hoặc đổi
  contract có version backward-compat + ADR. KHÔNG để output trôi khỏi hợp đồng đã công bố.
- KHÔNG commit transform còn fail data-quality test.
- Secret kết nối nguồn/đích qua biến môi trường / vault; KHÔNG hardcode, KHÔNG commit.

**Ngôn ngữ (bắt buộc):** MỌI đầu ra hướng người dùng — bảng ánh xạ, mô hình dữ liệu, comment trong
transform sinh ra, báo cáo — viết **tiếng Việt CÓ DẤU** (UTF-8). Nêu số đo được; tránh tuyên bố
tuyệt đối; ghi rõ residual risk và đánh dấu `[giả định]` khi suy đoán.

## Quy trình

### 0. Nạp context + chốt scope dataset
Đọc `project-knowledge/` (data-contract đầu ra, nguồn dữ liệu + grain/partition, engine trong
`tech-stack.yml` — vd dbt / Spark / SQL warehouse), `docs/contracts/` (contract đã công bố cho
downstream), CLAUDE.md (ranh giới an toàn), và layout root `pipelines/` đã phân tầng
(`source/ingest`, `transform/model` theo layer staging → intermediate → mart, `sink/serving`).
Chốt PHẠM VI dataset lần này (dataset/bảng đích nào build/sửa; nguồn nào đọc) trước khi viết.
Ca không chắc → liệt kê "CẦN XÁC NHẬN" và HỎI, KHÔNG tự suy diễn.

### 1. Mô hình hoá từ data-contract
Chi tiết: [references/transform-build.md](references/transform-build.md).
- Từ data-contract đầu ra → chọn mô hình: **dimensional** (fact/dim, chốt grain của fact) hoặc
  **normalized** theo semantic đích; xác định key/độ hạt (grain), partition, cột + kiểu + đơn vị.
- Chia layer: **staging** (chuẩn hoá 1-1 từ nguồn) → **intermediate** (join/biến đổi trung gian)
  → **mart** (dataset đầu ra khớp contract). Chốt idempotent vs incremental cho từng model.
- In bảng ánh xạ nguồn → staging → mart (grain + key) cho người duyệt. DỪNG cho duyệt HÌNH DẠNG mô
  hình trước khi build.

### 2. Build transform theo layer
Chi tiết + mẫu: [references/transform-build.md](references/transform-build.md).
- Viết transform theo thứ tự tầng `source/ingest` → `transform/model` → `sink/serving`, đúng
  grain/partition đã chốt; khai báo PHỤ THUỘC giữa model (staging trước mart) theo cơ chế engine.
- Transform **idempotent** (chạy lại cùng input → cùng output) hoặc **incremental** có khoá
  merge/upsert xác định; tránh side-effect ngoài dataset đích.
- Bám naming/code-convention ở init; KHÔNG phá data-contract đầu ra (tên cột/kiểu/grain đã công bố).

### 3. Data-quality test (cổng trước publish)
Chi tiết: [references/data-quality-tests.md](references/data-quality-tests.md).
- Khai báo test khớp kỳ vọng trong contract: **not-null**, **unique**/primary-key, **accepted-values**,
  **referential** (khoá tham chiếu tồn tại bên dim), **freshness** (dữ liệu đủ mới theo SLA),
  **row-count anomaly** (số dòng lệch bất thường so với baseline/kỳ vọng).
- DQ test là CỔNG: chạy trên output của transform TRƯỚC khi publish dataset. Có test FAIL → DỪNG,
  phân tích, sửa; KHÔNG publish / KHÔNG commit khi còn fail.

### 4. Lineage nguồn→đích
Chi tiết: [references/lineage.md](references/lineage.md).
- Ghi lineage mức bảng và (khi khả thi) mức cột: mỗi cột/bảng đích ánh xạ về nguồn + transform
  áp dụng; tài liệu hoá phụ thuộc giữa các layer.
- Externalize lineage ra file (trong `project-knowledge/` hoặc theo cơ chế engine) để downstream
  truy vết nguồn gốc và đánh giá tác động khi nguồn đổi.

### 5. Verify + bàn giao
- Chạy transform trên dữ liệu **mẫu/synthetic** (không phải prod) → output khớp schema + grain của
  data-contract; DQ test XANH toàn bộ; lineage phản ánh đúng nguồn→đích.
- Báo cáo kết quả THẬT: lệnh đã chạy, số model build, số DQ test pass/fail, chênh lệch row-count so
  kỳ vọng. Có fail → DỪNG, phân tích, sửa; KHÔNG tuyên bố hoàn tất khi chưa có bằng chứng.
- Cập nhật `project-knowledge/` + `docs/contracts/` phản ánh dataset/lineage MỚI; nếu đổi contract
  theo hướng breaking, kèm ADR + version backward-compat.
- Nêu KẾ HOẠCH chạy lên nguồn/đích thật (thứ tự layer, incremental vs full-refresh, partition,
  cửa sổ chạy, cách rollback/reprocess) — **con người duyệt và tự chạy prod**. Người dùng tự
  commit/push theo git-workflow.
- **Residual risk:** nêu rõ giới hạn — vd sample/synthetic KHÔNG phản ánh 100% phân bố prod (ca
  biên chưa phủ, skew/khối lượng khác); freshness/row-count baseline có thể lệch khi tải nguồn
  thay đổi. Ràng buộc mâu thuẫn (engine không hỗ trợ incremental đã chọn) → DỪNG và báo, không tự
  đi chệch.
