# Thiết kế: Skill `frontend-implement` — sinh React từ HTML/Figma/ảnh

- Ngày: 2026-09-03
- Trạng thái: **Đã thực thi** — skill `frontend-implement` (`6595c2b`), merge vào `master` qua PR #23 (`d08de01`, 2026-09-04).
- Phạm vi: Nội dung — thêm skill recipe on-demand `frontend-implement` cho plugin `frontend`. Không đổi
  engine/adapter/CLI.

## 1. Mục tiêu & tiêu chí thành công

Việc lặp lại hằng ngày "code React từ Figma/HTML có sẵn" hiện chưa có skill hỗ trợ (`frontend` chỉ có
`frontend-init` docs-only). Mục tiêu: một recipe chuyển **thiết kế** (HTML/CSS · Figma qua MCP · ảnh) thành
**React component** bám **kiến trúc đã chọn** (Layered/FSD từ phase template) + **design-system** của project.

Thành công khi:

1. Có `plugins/frontend/skills/frontend-implement/SKILL.md` (recipe mỏng) + `references/` (dày) theo cách
   khung vận hành.
2. Skill là recipe **on-demand** (`pipeline: false`, `next: null`, `order` sau `frontend-init`), auto-discover,
   project ra **cả 4 provider**, parity `references/`.
3. Skill khai `sharedAssets: templates/architecture` để đọc được blueprint kiến trúc đã chọn.
4. `npm test` xanh; `npm run build` ship skill + references ra 4 provider.
5. **Docs-only** — skill là *hướng dẫn agent sinh code*, không phải codegen tool; không tự viết runtime của khung.

## 2. Phạm vi

- **Trong phạm vi:** 3 dạng đầu vào (file HTML/CSS · Figma qua MCP/Dev Mode · ảnh/screenshot). Đầu ra
  **React + TypeScript**, **Tailwind + component library** (dò từ project). Mức "**presentational +
  tương tác cơ bản**": props typed + state/handler nội bộ, **không** nối API/data/route.
- **Ngoài phạm vi:** nối data/API, routing, backend, sinh test nghiệp vụ; Figma REST API (đã loại);
  Next.js RSC-specific.

## 3. Kiến trúc đích

```
plugins/frontend/skills/frontend-implement/
├── SKILL.md                         # recipe mỏng: nạp context -> chuẩn hoá input -> map -> sinh -> verify
└── references/
    ├── input-adapters.md            # rút "design intent" từ HTML/CSS · Figma-MCP · ảnh
    ├── component-mapping.md         # design element -> component-lib (shadcn/MUI/antd) / dựng Tailwind
    ├── tailwind-token-map.md        # giá trị CSS quan sát -> token design-system + class Tailwind
    ├── interaction-tiers.md         # hợp đồng "presentational + tương tác cơ bản"
    └── fidelity-checklist.md        # checklist verify + ranh giới đã ép
```

Frontmatter: `pipeline: false`, `next: null`, `order: 2`, `runsIn: execute`, `invoke: per-request`,
`sharedAssets: templates/architecture` (đọc blueprint Layered/FSD; cùng nguồn với `frontend-init`).

## 4. Luồng skill (5 bước)

0. **Nạp context (bắt buộc):** đọc `project-knowledge/` (architecture đã chọn, design-system.md,
   component-map.md, code-convention.md, tech-stack); dò `package.json` (React/Next, component-lib nào,
   Tailwind, TS, alias); tham chiếu `architecture/react-<layered|fsd>.template.md` để biết tầng/slice +
   import boundary đích.
1. **Chuẩn hoá đầu vào → design intent** (references/input-adapters.md): nhận diện dạng input, rút cấu
   trúc/layout + token quan sát + phần tử UI + tương tác; đánh dấu phần **ước lượng** (từ ảnh).
2. **Map component** (component-mapping + tailwind-token-map): ưu tiên tái dùng component-lib; phần thiếu
   dựng Tailwind; map token quan sát → token chuẩn (không chế token mới nếu project đã có).
3. **Sinh component đúng kiến trúc:** đặt file đúng tầng/slice + tôn trọng import boundary của kiến trúc
   đã chọn; tier tương tác theo interaction-tiers.md (props typed + state nội bộ; data để trống bằng
   props + TODO).
4. **Verify** (fidelity-checklist.md): `tsc` + lint (eslint-plugin-boundaries/Steiger) + build xanh;
   fidelity self-check; nêu rõ phần ước lượng; người duyệt diff.

## 5. Kiểm thử & verification

- `npm test`: frontmatter contract, parity `references/`/sharedAssets qua 4 adapter, strip
  workflow-metadata. Phải xanh.
- `npm run build`: `frontend-implement/` + `references/` xuất hiện trong output frontend của **cả 4 provider**.

## 6. Ranh giới / ngoài phạm vi

- Không nối data/API/routing/backend; không sinh test nghiệp vụ.
- Defer `code-convention.md` + `design-system.md` của project tuyệt đối; không chế design-system.
- Thiếu `project-knowledge/` (chưa chạy `frontend-init`) → skill đề nghị chạy init trước hoặc chạy với
  giả định + ghi rõ (fail-loud).
- Chỉ chạm plugin `frontend`; không đụng CLI/adapter/engine.

## 7. Các pha thực thi

1. Viết `SKILL.md`.
2. Viết 5 file `references/`.
3. `npm test` + `npm run build`; xác nhận ship qua 4 provider.
