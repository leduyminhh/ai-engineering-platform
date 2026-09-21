---
name: frontend-implement
description: "Recipe on-demand: chuyển một thiết kế có sẵn (file HTML/CSS, Figma qua MCP/Dev Mode, hoặc ảnh/screenshot) thành React component TypeScript bám ĐÚNG kiến trúc đã chọn (Feature-Based/FSD/Micro-FE) + design-system của project. Ưu tiên tái dùng component library (shadcn/MUI/antd) + Tailwind; sinh ở mức presentational + tương tác cơ bản (props typed, state/handler nội bộ), KHÔNG nối API/data/route. Dùng skill NÀY khi người dùng muốn \"code React từ Figma\", \"dựng UI từ HTML có sẵn\", \"chuyển mockup/ảnh sang component\", \"convert design sang React\", \"làm màn hình theo thiết kế\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã chạy frontend-init."
order: 2
stageNumber: "02"
title: "Frontend Implement — Sinh React component từ HTML/Figma/ảnh"
runsIn: execute
invoke: per-request
pipeline: false
sharedAssets: templates/architecture
next: null
---

# Frontend Implement — Sinh React component từ thiết kế (recipe on-demand)

Chuyển một thiết kế có sẵn thành **React component** bám kiến trúc + design-system của project. Skill này
là **hướng dẫn cách agent sinh code** (docs-only recipe), KHÔNG phải công cụ codegen. Recipe `pipeline: false`,
gọi khi cần — không thuộc chuỗi bắt buộc.

## Tiền đề

- Project **đã chạy `frontend-init`** (có `project-knowledge/`: `architecture.md`, `design-system.md`,
  `component-map.md`, `code-convention.md`, `tech-stack.yml`). Chưa có → đề nghị chạy `frontend-init`
  trước; hoặc chạy với giả định an toàn và **ghi rõ giả định** (fail-loud), không âm thầm bịa chuẩn.
- Mọi bối cảnh nằm trong FILE. Con người giữ chốt: **duyệt diff trước khi commit**.

## Quy trình

### 0. Nạp context (BẮT BUỘC — đọc TRƯỚC khi sinh)
- Đọc `project-knowledge/`: **kiến trúc UI đã chọn** (`architecture.md` — Feature-Based / FSD / Micro-FE),
  `design-system.md` (design tokens + nguyên tắc UI), `component-map.md`, `code-convention.md`,
  `tech-stack.yml`.
- Dò **stack thật** từ `package.json`/config: React hay Next; **component library nào** (shadcn / MUI /
  antd / Chakra); có Tailwind + `tailwind.config` không; TypeScript; alias import (`@/...`).
- Đối chiếu blueprint kiến trúc ship kèm ở `architecture/react-<feature-based|fsd|micro-frontend>.template.md`
  để biết **cây `src/`, tầng/slice và import boundary** đích. Đây là nguồn quyết định "đặt file ở đâu".

### 1. Chuẩn hoá đầu vào → "design intent"
Nhận diện dạng đầu vào rồi rút một mô tả trung gian (cấu trúc/layout + token quan sát + phần tử UI +
tương tác nhìn thấy) TRƯỚC khi sinh code. Cách rút cho từng dạng: xem
[references/input-adapters.md](references/input-adapters.md).
- **File HTML/CSS**, **Figma qua MCP/Dev Mode**, hoặc **ảnh/screenshot**. Với ảnh: đánh dấu rõ phần
  **ước lượng** (khoảng cách/màu/độ đo) để người duyệt kiểm mắt.
- Luôn map token quan sát → token chuẩn trong `design-system.md`; không chế token mới nếu đã có.

### 2. Map sang component
- Ưu tiên **tái dùng component-library** của project (Button/Card/Dialog/Table/Tabs…) trước khi tự dựng;
  phần không có trong lib mới dựng bằng Tailwind. Bảng map theo lib: [references/component-mapping.md](references/component-mapping.md).
- Map giá trị style quan sát → class Tailwind + token: [references/tailwind-token-map.md](references/tailwind-token-map.md).

### 3. Sinh component ĐÚNG kiến trúc
- **Đặt file đúng tầng/slice** theo kiến trúc đã chọn và **tôn trọng import boundary** (Feature-Based:
  presentational ở `features/<x>/components` không tự fetch/store, feature không cross-import ruột feature khác,
  mở qua public API `index.ts`; FSD: chỉ import xuống layer, không cross-import cùng layer, qua public API;
  Micro-FE: nội bộ remote theo FSD, không import ruột remote khác — qua module `expose` + `packages/*`).
  Blueprint ở `architecture/…` là chuẩn.
- **Tier tương tác** = presentational + cơ bản: `props` typed (interface/type) + state/handler nội bộ cho
  tương tác nhìn thấy (toggle/tab/form-control). **KHÔNG** fetch/API/route/global-store — chỗ cần dữ liệu
  để trống bằng `props` + `TODO` rõ ràng. Chi tiết: [references/interaction-tiers.md](references/interaction-tiers.md).
- Tuân thủ `code-convention.md` tuyệt đối (đặt tên, cấu trúc, format).

### 4. Verify (Definition of Done)
Theo [references/fidelity-checklist.md](references/fidelity-checklist.md):
- `tsc` + lint (`eslint-plugin-boundaries` / Steiger của kiến trúc) + build xanh.
- Fidelity self-check: cấu trúc, token, các state (hover/disabled/loading/empty), a11y cơ bản.
- Nêu rõ phần **ước lượng** (nhất là từ ảnh) — độ trung thực pixel không tự verify tuyệt đối được.
- Con người **duyệt diff** trước khi commit.

## Ranh giới

- Không nối data/API, không routing, không backend, không sinh test nghiệp vụ (chỉ component + tương tác cơ bản).
- Defer `code-convention.md` + `design-system.md` của project **tuyệt đối**; không chế design-system riêng.
- Chỉ chạm plugin `frontend`; blueprint kiến trúc quyết định tầng/slice + boundary.

## Ghi chú

- Chưa chạy `frontend-init` → thiếu `project-knowledge/`; đề nghị chạy `frontend-init` trước để có kiến
  trúc + design-system làm chuẩn, rồi mới gọi skill này.
- Nối dữ liệu/logic thật là bước hiện thực sau, ngoài phạm vi recipe này.
