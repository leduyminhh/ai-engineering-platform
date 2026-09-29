---
name: backend-init
description: "Khởi tạo cấu trúc thư mục nền tảng cho một BACKEND project theo workflow Cowork→Code (project-knowledge, docs/requests, docs/decisions/ADR, docs/contracts, CLAUDE.md, CONTRIBUTING.md, data-model/ERD, layout src/ phân tầng theo KIẾN TRÚC chọn khi init). Dùng skill NÀY mỗi khi người dùng muốn \"khởi tạo backend\", \"tạo cấu trúc thư mục\", \"scaffold backend/API/service\", \"setup project backend mới\", \"tạo bộ tài liệu nền\" — kể cả khi họ không nói chính xác chữ \"skill\". Chỉ chạy MỘT LẦN cho mỗi project."
order: 1
stageNumber: "01"
title: "Backend Init — Khởi tạo cấu trúc backend project"
runsIn: plan
invoke: once
pipeline: false
next: null
---

# Backend Init — Khởi tạo cấu trúc backend project

Skill tạo bộ khung TÀI LIỆU nền (cầu nối Cowork→Code) cho một BACKEND project (REST API /
service). Chạy MỘT LẦN khi bắt đầu project mới. CHỈ scaffold tài liệu — KHÔNG sinh code
skeleton, KHÔNG thuộc pipeline nào.

## Tiền đề
- Project mới hoặc chưa có cấu trúc workflow. Nếu cấu trúc đã tồn tại: KHÔNG ghi đè — báo lại.
- Mọi bối cảnh nằm trong FILE (không dựa vào memory). Con người giữ 2 chốt: chọn phương án +
  duyệt diff trước commit.

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
- HỎI **stack** (Python / Java / Khác — mặc định Python) và **kiểu kiến
  trúc** muốn hướng tới (Layered đơn giản / Onion+DDD / Hexagonal+DDD / Hexagonal+CQRS). Chọn
  mức đơn giản nhất đủ dùng. Chọn **Khác** → chưa có template kiến trúc cho stack đó: chỉ scaffold
  tài liệu nền và HỎI người dùng trước khi mô tả layout `src/`.
- Điền `project-knowledge/*` bằng PROSE theo lựa chọn: `architecture.md` + `source-structure.md`
  mô tả phân tầng đã chọn và Dependency Rule (tầng trên gọi tầng dưới; domain không biết hạ
  tầng); `code-convention.md`, `tech-stack.yml` theo stack. KHÔNG copy skeleton code.
- Ghi ADR cho quyết định lớn (stack, kiến trúc) vào `docs/decisions/`.

### 3. Tài liệu đặc thù backend (nhẹ)
- `project-knowledge/data-model.md`: ERD bằng Mermaid (không ảnh).
- Tuỳ chọn `docs/contracts/openapi.json`: bản GỘP khởi tạo rỗng-hợp-lệ nếu muốn công bố API ổn
  định — `{"openapi":"3.1.0","info":{"title":"<API>","version":"0.1.0"},"paths":{},"components":{"schemas":{}}}`.

### 4. Sau khi tạo
1. Liệt kê cây thư mục đã tạo.
2. Hướng dẫn: mỗi yêu cầu mới copy `docs/requests/_TEMPLATE/` → `docs/requests/<yyyy-mm-dd>-<ten-ngan>/`;
   mỗi quyết định kiến trúc tạo ADR mới đánh số tiếp.
3. Hỏi người dùng domain + mô hình dữ liệu để điền `project-knowledge/`.
4. KHÔNG viết code thực thi — mới chỉ scaffold.

## Ghi chú
- Muốn tái cấu trúc kiến trúc mã nguồn về sau → recipe on-demand `backend-migrate-architecture`.
- Muốn externalize config/secret sang Vault/Consul → recipe on-demand `backend-migrate-vault-consul`.
