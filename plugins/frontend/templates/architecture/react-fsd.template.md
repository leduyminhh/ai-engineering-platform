# Template: React · Feature-Sliced Design (FSD)

## Summary

Blueprint **cấu trúc** cho một web app/SPA **React + TypeScript** quy mô lớn theo **Feature-Sliced Design
(FSD)**: chia mã theo **layer** (`app > pages > widgets > features > entities > shared`), trong layer chia
theo **slice** (domain), trong slice chia theo **segment** (`ui/model/api/lib/config`). Hai luật cứng:
(1) một module chỉ import từ **layer thấp hơn**; (2) các slice **cùng layer KHÔNG import lẫn nhau** — giao
tiếp qua layer thấp hơn. Mọi truy cập qua **public API `index.ts`** của slice. Ranh giới ép bằng **Steiger**
(linter FSD chính thức) + **`eslint-plugin-boundaries`**. Cây minh hoạ bằng domain `invoices`. **Không chứa
code skeleton** — chỉ blueprint cấu trúc.

## Context

- **Stack:** React 18+ · TypeScript · Vite · **Tailwind CSS + component library** (shadcn/MUI/antd — đọc
  `package.json`/`design-system.md`). Data-fetching: **TanStack Query (React Query)**.
- **Phạm vi file:** chỉ mô tả **CẤU TRÚC** theo chuẩn FSD. Biến thể đơn giản hơn:
  [react-feature-based.template.md](react-feature-based.template.md).
- **Khi nào dùng:** app **nhiều domain / nhiều team**, cần ranh giới cứng để tránh spaghetti khi lớn dần;
  muốn tách rõ "thực thể nghiệp vụ" (entities) khỏi "hành động người dùng" (features). Ít/vừa domain một
  team thì Feature-Based nhẹ hơn; tách app build/deploy riêng thì Micro-Frontend.
- **Đối chiếu domain minh hoạ ↔ vai trò:** cây dùng domain `invoices`; cột phải là "chỗ trống" cần thay.

| Vai trò (chỗ trống) | Layer | Ví dụ trong `invoices` |
|---------------------|-------|------------------------|
| Trang theo route | `pages` | `pages/invoices` (`/invoices`) |
| Khối UI ghép tái dùng | `widgets` | `widgets/invoice-table` |
| Hành động mang giá trị (1 use case) | `features` | `features/create-invoice` |
| Thực thể nghiệp vụ | `entities` | `entities/invoice` |
| Hạ tầng/UI-kit dùng chung | `shared` | `shared/ui`, `shared/api` |

## Problem

App React lớn dần thường rối: "feature" gọi chéo "feature", component domain này import sâu vào ruột
component domain khác, không biết đổi một chỗ vỡ những đâu; không có ranh giới rõ giữa *thực thể* (invoice
là gì) và *hành động* (tạo invoice). Hệ quả: coupling ngầm, khó tách team, khó xoá tính năng. Cần một luật
tầng **tường minh, ép được bằng công cụ**.

## Solution

FSD áp **3 trục** phân rã + luật import cứng:

1. **Layer** (dọc, cố định): `app > pages > widgets > features > entities > shared`. Module chỉ import từ
   layer **thấp hơn** mình.
2. **Slice** (ngang, theo domain): trong mỗi layer, chia theo vùng nghiệp vụ (`invoice`, `customer`). Slice
   **cùng layer KHÔNG import nhau** → hết coupling chéo feature/entity.
3. **Segment** (trong slice): `ui` (component), `model` (store/type/logic), `api` (request/React Query),
   `lib` (helper), `config` (hằng số).

Mọi import đi qua **public API `index.ts`** của slice (cấm import sâu vào segment nội bộ). Server-state ở
`api` segment (React Query); state nghiệp vụ ở `model`. Ép luật bằng **Steiger** + `eslint-plugin-boundaries`.

## Architecture

### Cây thư mục

Cây minh hoạ domain `invoices`/`customer`. Mỗi slice có `index.ts` (public API). Ở lá chỉ nêu file tượng
trưng; `+ …` báo còn file cùng loại. Slice/segment kebab-case, component PascalCase.

```
src/
├── app/                              # KHỞI TẠO app: providers, router, style toàn cục, entry
│   ├── providers/                    #   QueryClientProvider, RouterProvider, ThemeProvider
│   ├── routes/                       #   khai báo route -> pages
│   └── index.tsx
│
├── pages/                            # TRANG theo route — compose widgets/features/entities cho 1 màn hình
│   └── invoices/
│       ├── ui/InvoiceListPage.tsx    #   ghép <InvoiceTable/> (widget) + <CreateInvoice/> (feature)
│       └── index.ts                  #   public API của slice page
│
├── widgets/                          # KHỐI UI ghép độc lập, tái dùng nhiều page (không phải 1 use case đơn)
│   └── invoice-table/
│       ├── ui/InvoiceTable.tsx
│       ├── model/                    #   state riêng của widget (sort/paging) nếu có
│       └── index.ts
│
├── features/                         # HÀNH ĐỘNG người dùng mang giá trị — MỖI feature = 1 use case
│   └── create-invoice/
│       ├── ui/CreateInvoiceForm.tsx  #   form (react-hook-form + component-lib)
│       ├── model/                    #   validation/logic của feature
│       ├── api/create-invoice.ts     #   useMutation(createInvoice) — React Query
│       └── index.ts
│
├── entities/                         # THỰC THỂ nghiệp vụ — model + UI thẻ + API đọc của thực thể
│   └── invoice/
│       ├── model/                    #   Invoice type, selector/store nếu cần
│       ├── ui/InvoiceCard.tsx        #   biểu diễn 1 invoice (tái dùng ở nhiều feature/widget)
│       ├── api/get-invoices.ts       #   useQuery(getInvoices) — server-state của entity
│       └── index.ts
│
└── shared/                           # DÙNG CHUNG, KHÔNG mang nghiệp vụ — không import layer trên
    ├── ui/                           #   UI-kit: wrapper component-lib + primitive Tailwind (Button/Card…)
    ├── api/                          #   api-client base (baseURL, header, lỗi)
    ├── lib/                          #   helper thuần (format, hooks tiện ích)
    └── config/                       #   hằng số, env, route path
```

> **Segment trong slice:** `ui` = component; `model` = store/type/business logic; `api` = request +
> React Query của slice; `lib` = helper nội bộ; `config` = hằng số. `index.ts` **chỉ** re-export phần
> công khai — phần còn lại là nội bộ slice.

### Vai trò & ranh giới từng layer

Từ cao xuống thấp; mỗi layer chỉ dùng layer **dưới** nó:

- **`app`** — khởi tạo: providers (QueryClient/Router/Theme), style toàn cục, router. Không nghiệp vụ.
- **`pages`** — một route = một page; **compose** widgets/features/entities thành màn hình. Không chứa
  logic nghiệp vụ tái dùng (đẩy xuống feature/entity).
- **`widgets`** — khối UI ghép lớn, tái dùng nhiều page (bảng, sidebar, header). Ghép nhiều
  entity/feature nhưng **không** là một use case đơn.
- **`features`** — **một hành động người dùng mang giá trị** (create-invoice, pay-invoice): UI + logic +
  mutation của use case đó. Đây là nơi "làm gì đó" với entity.
- **`entities`** — **thực thể nghiệp vụ** (invoice, customer): kiểu domain (`model`), biểu diễn UI
  (`ui/InvoiceCard`), API đọc (`api`). "Danh từ" nghiệp vụ, tái dùng bởi feature/widget/page.
- **`shared`** — hạ tầng & UI-kit không mang nghiệp vụ: `api-client`, primitive Tailwind/wrapper
  component-lib, helper, config. **Không** biết gì về domain, không import layer trên.

### Chiều phụ thuộc

Hai luật, ép bằng công cụ (vi phạm = **fail lint**):

1. **Chỉ import xuống:** `app → pages → widgets → features → entities → shared`. Không bao giờ import ngược.
2. **Không cross-import cùng layer:** `features/create-invoice` **không** import `features/pay-invoice`;
   `entities/invoice` **không** import `entities/customer`. Cần liên kết → hạ xuống layer dưới hoặc ghép
   ở layer trên (page/widget).

Thêm: **chỉ import qua public API** `slice/index.ts`, cấm import sâu (`entities/invoice/model/x`).

Ép bằng **Steiger** (linter FSD chính thức, hiểu layer/slice/segment + public API) và/hoặc
`eslint-plugin-boundaries`:

```jsonc
// .eslintrc — sketch KHỞI ĐIỂM, chỉnh theo dự án (kèm chạy: npx steiger ./src)
{
  "settings": {
    "boundaries/elements": [
      { "type": "app",      "pattern": "src/app/*" },
      { "type": "pages",    "pattern": "src/pages/*" },
      { "type": "widgets",  "pattern": "src/widgets/*" },
      { "type": "features", "pattern": "src/features/*" },
      { "type": "entities", "pattern": "src/entities/*" },
      { "type": "shared",   "pattern": "src/shared/*" }
    ]
  },
  "rules": {
    "boundaries/element-types": ["error", {
      "default": "disallow",
      "rules": [
        { "from": "app",      "allow": ["pages", "widgets", "features", "entities", "shared"] },
        { "from": "pages",    "allow": ["widgets", "features", "entities", "shared"] },
        { "from": "widgets",  "allow": ["features", "entities", "shared"] },
        { "from": "features", "allow": ["entities", "shared"] },
        { "from": "entities", "allow": ["shared"] },
        { "from": "shared",   "allow": ["shared"] }
      ]
    }],
    // cấm slice cùng layer import nhau (external-of self-layer, trừ shared)
    "boundaries/no-private": ["error", { "allowUncles": false }]
  }
}
```

> **Steiger** hiểu FSD sâu hơn (public-API, cross-import cùng layer, segment) — nên chạy `steiger` là
> chính, `eslint-plugin-boundaries` bổ trợ cho luật layer. Cấu hình trên là khởi điểm, chỉnh theo dự án.

### Ranh giới state

| Loại state | Ở đâu | Công cụ |
|-----------|-------|---------|
| Server-state của thực thể (đọc list/detail) | `entities/<x>/api` | React Query `useQuery` |
| Server-state của hành động (tạo/sửa) | `features/<x>/api` | React Query `useMutation` |
| State nghiệp vụ / form | `features|entities/<x>/model` | store slice (Zustand) / react-hook-form |
| UI-state cục bộ | trong `ui/` component | `useState` |
| Hạ tầng dùng chung | `shared` | — (không giữ business state) |

## Feature-flags (Optional)

> **Tùy chọn** — chỉ thêm khi cần bật/tắt nhánh tính năng theo môi trường/đối tượng. App không cần cờ thì
> **bỏ qua toàn bộ mục này**.

- **Nguồn flag:** `shared/config` — đọc từ `env`/remote config, chuẩn hoá thành map `{ [key]: boolean }`. Đây
  là nơi **duy nhất** biết cờ đến từ đâu; **không** định nghĩa cờ trong segment `api` của entity/feature.
- **Đọc flag:** hook `useFeatureFlag(key)` ở `shared/lib` — trả `boolean`, giấu nguồn (env/remote) khỏi UI.
  `entities`/`features` đọc cờ **qua `shared`** (import xuống), không tự dựng cơ chế cờ riêng.
- **Gate ở đâu:** quyết định bật/tắt đặt ở `pages` (chọn có render page/nhánh feature không) hoặc `widgets`
  (bật/tắt khối UI ghép). **KHÔNG** rẽ nhánh theo cờ trong `entities|features/<x>/api` — tầng `api` chỉ gọi
  backend, giữ data layer thuần, dễ test.

Ví dụ ngắn: bật màn hình `/invoices` mới sau cờ `invoices.v2`.

```
// pages/invoices/ui/InvoiceListPage.tsx  (gate ở page — compose theo cờ)
useFeatureFlag('invoices.v2')  ->  true  ? <InvoiceTableV2/> : <InvoiceTable/>
//   useFeatureFlag đọc từ shared/config; page chọn widget/feature nào để compose.
```

## Implementation

| Ranh giới | Ở đâu | Quy tắc |
|-----------|-------|---------|
| Public API slice | `<slice>/index.ts` | Chỉ re-export component/hook/type công khai; giấu segment nội bộ. Mọi import từ ngoài dùng `@/entities/invoice`, không `.../model/...`. |
| Đọc entity | `entities/invoice/api/get-invoices.ts` | `useQuery` + `api-client` của `shared/api`; entity sở hữu server-state đọc của chính nó. |
| Hành động | `features/create-invoice/api` + `model` | `useMutation` + validation; feature import entity (xuống), không import feature khác (ngang). |
| Ghép màn hình | `pages/<route>/ui` | Page compose widget/feature/entity; không nhồi logic tái dùng (đẩy xuống). |

## Standards

- **Luật layer:** chỉ import xuống; `entities` không import `features`; `shared` không import gì ở trên.
- **Không cross-import cùng layer:** slice độc lập; liên kết qua layer dưới hoặc ghép ở trên.
- **Public API bắt buộc:** mỗi slice có `index.ts`; ngoài slice chỉ dùng public API, cấm import sâu.
- **Segment chuẩn:** `ui/model/api/lib/config`; không đặt request trong `ui`, không đặt component trong
  `api`.
- **Entity vs Feature:** entity = danh từ (invoice là gì); feature = động từ (tạo invoice). Đặt đúng chỗ.
- **Đặt tên:** slice/segment kebab-case (`create-invoice`, `invoice-table`), component PascalCase; alias
  `@/<layer>/<slice>`.
- **Styling:** Tailwind + tái dùng `shared/ui` (wrapper component-lib) trước khi tự dựng.

## Best Practices

- Bắt đầu từ `shared` (UI-kit, api-client) → `entities` (thực thể + đọc) → `features` (hành động) →
  `widgets`/`pages` (ghép). Xây từ dưới lên.
- Giữ `features` nhỏ, đúng một use case; use case lớn tách nhiều feature ghép ở page/widget.
- Public API `index.ts` là "hợp đồng" của slice — đổi nội bộ tự do, giữ export ổn định.
- Cùng một entity dùng lại ở nhiều feature qua `entities/<x>` (không copy).
- Chạy `steiger ./src` trong CI như một fitness function của kiến trúc.

## Anti-patterns

- `features/A` import `features/B`, hoặc `entities/X` import `entities/Y` (cross-import cùng layer).
- Import ngược layer (`entities` import `features`, `shared` import `entities`).
- Import sâu vào segment nội bộ (`entities/invoice/model/store`) thay vì public API.
- Nhét business logic tái dùng vào `pages` thay vì đẩy xuống feature/entity.
- Gọi HTTP rải rác trong `ui` thay vì `api` segment qua `shared/api`.
- Trộn "danh từ" và "động từ": đặt logic tạo/sửa vào `entities` hoặc để component thuần trong `features`.
- Bỏ `index.ts`, để ngoài import tuỳ tiện vào ruột slice (mất ranh giới).

## Examples

Luồng màn hình `/invoices` (danh sách + nút tạo):

1. `app/routes` map `/invoices` → `pages/invoices`.
2. `pages/invoices/ui/InvoiceListPage` compose `<InvoiceTable/>` (widget) + `<CreateInvoiceForm/>` (feature).
3. `widgets/invoice-table` dùng `entities/invoice` (thẻ + `useQuery(getInvoices)` ở `entities/invoice/api`).
4. `features/create-invoice` có form (`ui`) + `useMutation(createInvoice)` (`api`) + validation (`model`);
   import **xuống** `entities/invoice` + `shared/ui`, **không** import feature khác.
5. `shared/api` giữ `api-client`; `shared/ui` giữ Button/Card (wrapper component-lib) tái dùng khắp nơi.

## Checklist

Scaffold coi là đúng khi:

- [ ] `steiger ./src` + `eslint-plugin-boundaries` xanh (không cross-import cùng layer, không import ngược).
- [ ] Mỗi slice có `index.ts`; ngoài slice chỉ import qua public API.
- [ ] Layer đúng thứ tự `app>pages>widgets>features>entities>shared`; `shared` không biết domain.
- [ ] Entity = danh từ (model+card+đọc); feature = một use case (ui+model+mutation).
- [ ] Server-state qua React Query ở `api` segment; không `useState` giữ cache API.
- [ ] `tsc` + `eslint` xanh; xoá một feature không vỡ feature/entity khác.

## References

- Ghi **lựa chọn kiến trúc này thành ADR** (Nygard) ở `docs/decisions/` — vì sao FSD, phương án cân nhắc,
  hệ quả.
- Feature-Sliced Design — phương pháp chuẩn (layer/slice/segment, public API). Steiger — linter chính thức
  kiểm luật FSD; `eslint-plugin-boundaries` bổ trợ luật layer. Cấu hình trong file là khởi điểm.
- TanStack Query — server-state ở segment `api` của entity/feature.

## Related

- [ARD.md](ARD.md) — bảng chọn kiến trúc (selector) + tín hiệu nâng cấp (Small/Medium → Feature-Based ·
  Large nhiều team → FSD · tách app build/deploy → Micro-FE).
- [react-feature-based.template.md](react-feature-based.template.md) — biến thể **đơn giản hơn** cho app
  nhỏ/vừa một team: nhóm theo domain (`features/<domain>`), không tầng `widgets`/`entities`, nhẹ luật.
- [react-micro-frontend.template.md](react-micro-frontend.template.md) — biến thể cho **đa team**: tách
  host + remote (Module Federation), mỗi remote nội bộ có thể theo FSD; chọn khi cần build/deploy độc lập.
