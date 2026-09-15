---
name: frontend-init
description: "Khởi tạo cấu trúc thư mục nền tảng cho một FRONTEND project (web app/SPA) theo workflow Cowork→Code: project-knowledge (kiến trúc UI, design system/tokens, stack, code-convention), docs/requests, docs/decisions/ADR, docs/contracts, CLAUDE.md, CONTRIBUTING.md, và layout src/ phân tầng presentational/component → container/hook (state) → data layer (API client/store). Dùng skill NÀY mỗi khi người dùng muốn \"khởi tạo frontend\", \"tạo cấu trúc thư mục frontend\", \"scaffold web app/SPA\", \"setup project frontend mới\", \"tạo bộ tài liệu nền cho UI\" — kể cả khi họ không nói chính xác chữ \"skill\". Chỉ chạy MỘT LẦN cho mỗi project."
order: 1
stageNumber: "01"
title: "Frontend Init — Khởi tạo cấu trúc frontend project"
runsIn: plan
invoke: once
pipeline: false
sharedAssets: templates/architecture
next: null
---

# Frontend Init — Khởi tạo cấu trúc frontend project

Skill tạo bộ khung TÀI LIỆU nền (cầu nối Cowork→Code) cho một FRONTEND project (web app/SPA
component-based). Chạy MỘT LẦN khi bắt đầu project mới. CHỈ scaffold tài liệu — KHÔNG sinh code
skeleton, KHÔNG thuộc pipeline nào.

## Tiền đề
- Project mới hoặc chưa có cấu trúc. Nếu đã tồn tại: KHÔNG ghi đè — báo lại.
- Mọi bối cảnh nằm trong FILE. Con người giữ 2 chốt: chọn phương án UX/IA + duyệt diff.

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

### 2. Hỏi thông tin nền + chọn kiến trúc + điền project-knowledge
- HỎI **framework** (React / Khác — mặc định React) + domain + **kiểu kiến trúc UI**. Bộ đích gồm
  **Feature-Based** (nhóm theo domain, ranh giới mềm — **mặc định**, app nhỏ/vừa một team), **FSD**
  (Feature-Sliced Design — layer/slice/segment + public API, app lớn/nhiều domain) và **Micro-Frontend**
  (host + remotes qua Module Federation, deploy độc lập — đa team; mỗi remote nội bộ = FSD). ĐỌC
  `architecture/ARD.md` (selector) để đánh giá dự án rồi chọn mức đơn giản nhất đủ dùng.
- Dùng blueprint tương ứng ship kèm skill ở `architecture/react-<feature-based|fsd|micro-frontend>.template.md`
  làm chuẩn cấu trúc: điền `project-knowledge/architecture.md` + `source-structure.md` theo cây `src/`,
  Dependency Rule và ranh giới tầng/slice của template đã chọn; `code-convention.md`, `tech-stack.yml` theo
  stack (mặc định Tailwind + component-lib). KHÔNG copy skeleton code — chỉ mô tả cấu trúc.
- Ghi ADR cho quyết định lớn (framework, kiểu kiến trúc UI) vào `docs/decisions/`.

### 3. Tài liệu đặc thù frontend (nhẹ)
- `project-knowledge/design-system.md`: design tokens + nguyên tắc UI (mô tả, không code).
- `project-knowledge/component-map.md`: cây component/màn hình dự kiến (mô tả).

### 4. Sau khi tạo
1. Liệt kê cây thư mục đã tạo.
2. Hướng dẫn: mỗi yêu cầu mới copy `docs/requests/_TEMPLATE/` → `docs/requests/<yyyy-mm-dd>-<ten-ngan>/`;
   mỗi quyết định tạo ADR mới đánh số tiếp.
3. Hỏi người dùng domain + mô hình dữ liệu để điền `project-knowledge/`.
4. KHÔNG viết code thực thi — mới chỉ scaffold.
