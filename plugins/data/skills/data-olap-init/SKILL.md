---
name: data-olap-init
description: "Khởi tạo cấu trúc thư mục nền tảng cho một DATA PIPELINE project (warehouse/lakehouse) theo workflow Cowork→Code: project-knowledge (kiến trúc dữ liệu, nguồn/đích, mô hình hóa, naming, code-convention), docs/requests, docs/decisions/ADR, docs/contracts (data contract đã công bố cho downstream), CLAUDE.md, CONTRIBUTING.md, và layout phân tầng source/ingest → transform/model → sink/serving. Dùng skill NÀY mỗi khi người dùng muốn \"khởi tạo pipeline\", \"tạo cấu trúc thư mục data project\", \"scaffold ETL/warehouse\", \"setup project data mới\", \"tạo bộ tài liệu nền cho pipeline\" — kể cả khi họ không nói chính xác chữ \"skill\". Chỉ chạy MỘT LẦN cho mỗi project."
order: 3
stageNumber: "03"
title: "OLAP Warehouse Init — Khởi tạo cấu trúc pipeline project"
runsIn: plan
invoke: once
pipeline: false
next: null
---

# OLAP Warehouse Init — Khởi tạo cấu trúc pipeline project

Skill tạo bộ khung TÀI LIỆU nền (cầu nối Cowork→Code) cho một DATA PIPELINE project (ETL/ELT,
warehouse/lakehouse, batch/stream). Chạy MỘT LẦN khi bắt đầu project mới. CHỈ scaffold tài liệu
— KHÔNG sinh code skeleton, KHÔNG thuộc pipeline nào.

## Tiền đề
- Project mới hoặc chưa có cấu trúc. Nếu đã tồn tại: KHÔNG ghi đè — báo lại.
- Mọi bối cảnh nằm trong FILE. Con người giữ 2 chốt: chọn phương án mô hình/nguồn + duyệt diff.

## Quy trình

### 1. Khung chung (idempotent)
Copy nguyên cây `templates/` (đi kèm skill) vào gốc project, skip file đã có:
- `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, `TODO.md`
- `project-knowledge/` (project-overview, domain-context, architecture, source-structure,
  code-convention, tech-stack)
- `docs/requests/_TEMPLATE/` (requirement, plan), `docs/contracts/`
- `docs/decisions/` (_TEMPLATE, 0001, 0002-code-convention)
- `src/shared/`, `tests/`

Nếu project CHƯA có `AGENTS.md`: copy `AGENTS.template.md` (đi kèm skill) → `./AGENTS.md`. Đã
có thì giữ nguyên.

### 2. Hỏi thông tin nền + điền project-knowledge
- HỎI nền tảng kho/engine (warehouse/lakehouse, batch/stream) + **nguồn → đích** dữ liệu.
- Điền `project-knowledge/*` bằng PROSE: `architecture.md` (kiến trúc pipeline nguồn→đích),
  `source-structure.md`, `code-convention.md`, `tech-stack.yml`. KHÔNG sinh transform thật.
- Ghi ADR cho quyết định lớn (nền tảng, mô hình) vào `docs/decisions/`.

### 3. Tài liệu đặc thù pipeline (nhẹ)
- `project-knowledge/`: mô tả nguồn dữ liệu → dataset đích, grain, partition.
- `docs/contracts/`: nơi công bố data contract (schema đích + freshness/SLA + kỳ vọng chất
  lượng) cho downstream.

### 4. Sau khi tạo
1. Liệt kê cây thư mục đã tạo.
2. Hướng dẫn: mỗi yêu cầu mới copy `docs/requests/_TEMPLATE/` → `docs/requests/<yyyy-mm-dd>-<ten-ngan>/`;
   mỗi quyết định tạo ADR mới đánh số tiếp.
3. Hỏi người dùng domain + nguồn/đích dữ liệu để điền `project-knowledge/`.
4. KHÔNG viết code thực thi — mới chỉ scaffold.
