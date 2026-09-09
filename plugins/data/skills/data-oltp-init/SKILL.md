---
name: data-oltp-init
description: "Khởi tạo cấu trúc thư mục nền tảng cho một DATABASE project (cơ sở dữ liệu vận hành OLTP dùng chung, độc lập vòng đời với một app cụ thể) theo workflow Cowork→Code: project-knowledge (kiến trúc database, quy ước schema, engine-profile, tech-stack), docs/requests, docs/decisions/ADR, docs/contracts (schema contract đã công bố cho consumer), CLAUDE.md, CONTRIBUTING.md, và layout root db/ phân tầng schema → migrations → seeds → queries → functions. Dùng skill NÀY mỗi khi người dùng muốn \"khởi tạo database\", \"tạo cấu trúc thư mục database project\", \"scaffold cơ sở dữ liệu vận hành\", \"setup project database mới\", \"tạo bộ tài liệu nền cho database\" — kể cả khi họ không nói chính xác chữ \"skill\". Chỉ chạy MỘT LẦN cho mỗi project."
order: 1
stageNumber: "01"
title: "OLTP Database Init — Khởi tạo cấu trúc database project"
runsIn: plan
invoke: once
pipeline: false
next: null
---

# OLTP Database Init — Khởi tạo cấu trúc database project

Skill tạo bộ khung TÀI LIỆU nền (cầu nối Cowork→Code) cho một DATABASE project (CSDL vận hành
OLTP dùng chung). Chạy MỘT LẦN khi bắt đầu project mới. CHỈ scaffold tài liệu — KHÔNG sinh code
skeleton, KHÔNG thuộc pipeline nào.

## Tiền đề
- Project mới hoặc chưa có cấu trúc. Nếu đã tồn tại: KHÔNG ghi đè — báo lại.
- Mọi bối cảnh nằm trong FILE. Con người giữ 2 chốt: chọn phương án + duyệt diff.

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
- HỎI **engine** (PostgreSQL / Khác — mặc định PostgreSQL) + domain dữ liệu.
- Điền `project-knowledge/*` bằng PROSE theo engine: `architecture.md` (kiến trúc database),
  `source-structure.md` (mô tả layout root `db/`: `schema/`, `migrations/`, `seeds/`, `queries/`,
  `functions/`), `code-convention.md`, `tech-stack.yml`. KHÔNG sinh DDL/migration thật.
- Ghi ADR cho quyết định lớn (engine) vào `docs/decisions/`.

### 3. Tài liệu đặc thù database (nhẹ)
- `project-knowledge/schema-conventions.md`: chuẩn BẮT BUỘC đặt tên bảng/cột, kiểu dữ liệu, khóa,
  index, quy ước migration.
- `docs/contracts/`: nơi công bố schema contract (bảng/cột/khóa/index đã chốt) cho consumer.

### 4. Sau khi tạo
1. Liệt kê cây thư mục đã tạo.
2. Hướng dẫn: mỗi yêu cầu mới copy `docs/requests/_TEMPLATE/` → `docs/requests/<yyyy-mm-dd>-<ten-ngan>/`;
   mỗi quyết định tạo ADR mới đánh số tiếp.
3. Hỏi người dùng domain + mô hình dữ liệu để điền `project-knowledge/`.
4. KHÔNG viết code thực thi — mới chỉ scaffold.
