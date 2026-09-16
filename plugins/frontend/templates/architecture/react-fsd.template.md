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

> **Segment trong slice** (nhóm theo *bản chất kỹ thuật*, tên chuẩn hoá): `ui` = component +
> formatter/style hiển thị; `model` = data model (schema, interface, store, business logic + validation);
> `api` = tương tác backend (request fn, kiểu dữ liệu, mapper); `lib` = thư viện nội bộ slice; `config` =
> config + feature flag. `index.ts` **chỉ** re-export phần công khai — phần còn lại là nội bộ slice.

> **Cái gì KHÔNG đặt ở đâu:** không để request/`fetch` trong `ui`; không để component trong `api`; không
> để business logic trong `ui` (đẩy vào `model`). `lib` **không phải** bãi rác `utils/helpers` — mỗi thư
> viện trong `lib` có **một vùng tập trung** (date, currency, text…), ghi rõ trong README. Đặt tên segment
> theo **mục đích**, không theo bản chất: `components`/`hooks`/`types` là tên **xấu** (Steiger cảnh báo).

### Bảng quy tắc thư mục

Tra nhanh từng thư mục/segment xuất hiện trong cây ở trên — đặt gì, cấm gì.

| Thư mục | Mục đích | Được đặt gì | KHÔNG đặt gì | Ví dụ |
|---|---|---|---|---|
| `app/` | Khởi tạo toàn app (layer cao nhất, không chia slice) | providers, router config, global store, style toàn cục, entrypoint | Chia slice theo domain; nghiệp vụ của riêng 1 domain | `app/providers/`, `app/routes/`, `app/index.tsx` |
| `app/providers/` | Khởi tạo context/provider dùng toàn app | `QueryClientProvider`, `RouterProvider`, `ThemeProvider` | Logic nghiệp vụ của 1 domain cụ thể | `app/providers/QueryClientProvider.tsx` |
| `app/routes/` | Khai báo route → page | Route config trỏ `pages/<slice>` | UI/logic render của page (đặt trong `pages`) | `app/routes/invoices.ts` |
| `pages/<slice>/` | Một route = một page; ghép widgets/features/entities thành màn hình | `ui` (page component, loading/error boundary), `api` fetch/mutate của trang, `index.ts` | Business logic tái dùng (đẩy xuống feature/entity); cross-import `pages` khác cùng layer | `pages/invoices/ui/InvoiceListPage.tsx` |
| `widgets/<slice>/` | Khối UI ghép độc lập, tái dùng nhiều page | `ui`, `model` (state riêng widget nếu có), `index.ts` | Widget hoá khối **không** tái dùng, chiếm phần lớn 1 page (để thẳng trong page) | `widgets/invoice-table/` |
| `features/<slice>/` | Một hành động người dùng mang giá trị = một use case | `ui` (form), `model` (validation/logic), `api` (mutation), `index.ts` | Cross-import feature khác cùng layer; component thuần không gắn use case | `features/create-invoice/` |
| `entities/<slice>/` | Thực thể nghiệp vụ ("danh từ") | `model` (type/schema), `ui` (card tái dùng), `api` (đọc), `index.ts` | Import thẳng ruột entity khác — phải qua **`@x`** hoặc public API; logic tạo/sửa (đó là feature) | `entities/invoice/` |
| `shared/` | Nền tảng dùng chung, không domain (layer thấp nhất, không chia slice) | `ui/api/lib/config` (segment trực tiếp) | Import từ `pages/widgets/features/entities`; mang nghiệp vụ domain | `shared/ui/`, `shared/api/` |
| `ui` (segment — `pages/widgets/features/entities`) | Component + hiển thị | React component, formatter/style hiển thị | request/`fetch`; business logic (đẩy vào `model`) | `entities/invoice/ui/InvoiceCard.tsx` |
| `model` (segment — `widgets/features/entities`) | Data model, state, business logic + validation | Type/interface, store, selector, validation logic | Component/JSX; gọi API trực tiếp (đặt ở `api`) | `entities/invoice/model/` |
| `api` (segment — `pages/features/entities`) | Tương tác backend qua React Query | Request fn, `useQuery`/`useMutation`, mapper, kiểu dữ liệu | Component; business logic thuần (đặt ở `model`) | `entities/invoice/api/get-invoices.ts` |
| `shared/ui/` | UI-kit dùng chung | Wrapper component-lib + primitive Tailwind (Button/Card…) | Business logic domain; gộp nhiều component vào 1 `index.ts` (vỡ tree-shaking) | `shared/ui/button/index.ts` |
| `shared/api/` | api-client nền tảng | baseURL, header, xử lý lỗi chung | Request cụ thể theo domain (đặt ở `entities\|features/<x>/api`) | `shared/api/api-client.ts` |
| `shared/lib/` | Helper thuần dùng chung | Mỗi thư viện một vùng tập trung (date, currency, text…), hook tiện ích | Bãi rác `utils/helpers` không rõ vùng | `shared/lib/format-date.ts` |
| `shared/config/` | Hằng số, cấu hình toàn app | env, route path, nguồn feature flag | Cấu hình riêng 1 domain | `shared/config/env.ts` |
| `index.ts` (public API mỗi slice) | Cổng public API của slice | Re-export tường minh phần công khai (component/hook/type) | `export *` (wildcard); đặt `index.ts` ở cấp layer | `pages/invoices/index.ts`, `entities/invoice/index.ts` |

### Vai trò & ranh giới từng layer

Bộ layer **chính thức (spec v2.1)** gồm 7 tầng, từ nhiều trách nhiệm/phụ thuộc nhất đến ít nhất:
`app > processes (DEPRECATED) > pages > widgets > features > entities > shared`. **`processes` đã bị bỏ** —
đưa nội dung của nó về `features`/`app`. Không bắt buộc dùng đủ layer: **chỉ thêm khi mang lại giá trị**;
tối thiểu hầu hết app có `shared`, `pages`, `app`. Mỗi layer chỉ dùng layer **dưới** nó:

- **`app`** — mọi việc phạm vi toàn app (kỹ thuật: providers/context; nghiệp vụ: analytics): router config,
  global store, style toàn cục, entrypoint. **Không có slice** — chứa **segment trực tiếp**. Không nghiệp vụ domain.
- **`pages`** — một route = một page (`ui` gồm loading/error boundary; `api` fetch/mutate của trang).
  **Compose** widgets/features/entities thành màn hình. Khối UI **không tái dùng** cứ để **thẳng trong page**;
  page hiếm khi cần data model riêng. Đẩy logic nghiệp vụ tái dùng xuống feature/entity.
- **`widgets`** — **khối UI lớn, tự chủ**, đáng làm widget khi **tái dùng qua nhiều page** *hoặc* khi một
  page có nhiều khối lớn độc lập. Nếu khối chiếm phần lớn nội dung một page và **không** tái dùng → **không**
  phải widget, để thẳng trong page. (Router lồng kiểu Remix: widget có thể chứa cả block router + layout.)
- **`features`** — **một hành động người dùng mang giá trị** (create-invoice, pay-invoice): UI (form) + logic/
  validation (`model`) + mutation (`api`) + feature flag (`config`). **Không phải mọi thứ đều là feature** —
  dấu hiệu tốt để tách feature là **được tái dùng ở nhiều page**; quá nhiều feature làm chìm cái quan trọng.
- **`entities`** — **thực thể nghiệp vụ** (invoice, customer): data model + schema validation (`model`),
  API đọc (`api`), biểu diễn UI tái dùng (`ui/InvoiceCard`, gắn logic khác nhau qua props/slot). "Danh từ"
  nghiệp vụ. Quan hệ entity↔entity → dùng **cross-import `@x`** (xem dưới).
- **`shared`** — nền tảng, kết nối thế giới ngoài (backend, thư viện, môi trường) + UI-kit. **Không có slice**
  — chứa **segment trực tiếp**. **Không** biết domain, không import layer trên.

> **Ngoại lệ App & Shared:** hai layer này vừa là *layer* vừa là *slice* — không chia slice mà chứa
> **segment trực tiếp**, và **các segment trong đó import tự do lẫn nhau** (vì Shared không có domain, App gộp
> mọi domain). Mọi layer còn lại chia thành slice theo domain và **tuân luật import layer**.

### Chiều phụ thuộc

Hai luật, ép bằng công cụ (vi phạm = **fail lint**):

1. **Chỉ import xuống:** `app → pages → widgets → features → entities → shared`. Không bao giờ import ngược.
2. **Không cross-import cùng layer:** `features/create-invoice` **không** import `features/pay-invoice`;
   `entities/invoice` **không** import `entities/customer`. Cần liên kết → hạ xuống layer dưới hoặc ghép
   ở layer trên (page/widget).

Thêm: **chỉ import qua public API** `slice/index.ts`, cấm import sâu (`entities/invoice/model/x`).

Ép bằng **Steiger** (linter FSD chính thức, hiểu layer/slice/segment + public API + `@x`) là **chính**,
`eslint-plugin-boundaries` **bổ trợ** cho riêng luật layer trong luồng ESLint sẵn có:

- **Steiger** — cấu hình copy-paste sẵn ở [`references/steiger.config.js`](references/steiger.config.js).
  Cài `npm i -D steiger @feature-sliced/steiger-plugin`, chạy `npx steiger ./src` (watch: `--watch`). Bộ
  `recommended` bật `fsd/forbidden-imports`, `fsd/public-api`, `fsd/no-public-api-sidestep`,
  `fsd/no-segmentless-slices`, `fsd/no-segments-on-sliced-layers`, `fsd/segments-by-purpose`,
  `fsd/no-processes`, `fsd/insignificant-slice`, `fsd/excessive-slicing`…
- **eslint-plugin-boundaries** — cấu hình ở [`references/eslint-boundaries.fsd.jsonc`](references/eslint-boundaries.fsd.jsonc)
  (merge vào eslint config). Chỉ ép "import đi xuống" ở cấp layer; nuance `@x`/public-API để Steiger lo.

### Cross-import `@x` (entity ↔ entity)

Mặc định slice cùng layer **không** biết nhau. Nhưng thực thể ngoài đời thường tham chiếu nhau (một
`Artist` có nhiều `Song`) — nên **phản ánh quan hệ đó** thay vì né tránh. FSD cho một loại public API riêng
gọi là **ký hiệu `@x`** (chỉ khuyến nghị ở **layer `entities`**, và giữ **tối thiểu**):

- Entity `A` mở một public API **riêng cho** entity `B` tại `entities/a/@x/b.ts`; `index.ts` vẫn là public
  API thường. Code trong `entities/b/` import qua đường `entities/a/@x/b` (đọc là "A crossed with B").
- Vì sao lộ liễu vậy: hai entity liên kết **phải refactor cùng nhau**, nên làm mối nối **không thể bỏ sót**.

```
entities/
├── artist/
│   ├── @x/song.ts          // public API riêng cho entities/song:  export type { Artist } from '../model/artist'
│   ├── model/artist.ts
│   └── index.ts            // public API thường của artist
└── song/
    └── model/song.ts       // import type { Artist } from 'entities/artist/@x/song'
```

> `@x` **không** phải cửa hậu để cross-import bừa. Chỉ dùng cho quan hệ dữ liệu entity↔entity; hành vi
> nghiệp vụ nối chúng vẫn nên đặt ở layer trên (`features`/`pages`). Vi phạm `@x` = **fail** `fsd/forbidden-imports`.

### Public API & insulation

`index.ts` là **hợp đồng + cổng** của slice: chỉ những gì re-export mới ra ngoài; phần còn lại là nội bộ,
đổi tự do khi refactor. Ba mục tiêu của một public API tốt:

1. **Bảo vệ** phần còn lại của app khỏi thay đổi cấu trúc nội bộ slice (đổi/di chuyển file bên trong).
2. Thay đổi **phá vỡ kỳ vọng** (đổi hành vi) thì **phải** thể hiện ở public API.
3. **Chỉ** lộ phần cần thiết.

- **Cấm `export *` (wildcard):** làm mất khả năng đọc ra "interface" của slice và **vô tình lộ nội bộ**,
  khiến người khác lỡ phụ thuộc vào chi tiết cài đặt → khó refactor. Liệt kê từng export tường minh.
- **Khi nào cần / không cần:** **mọi slice** phải có public API; ở layer không-slice (`shared`, `app`) thì
  **segment** đóng vai public API. **Cấm `index.ts` ở cấp layer** (`fsd/no-layer-public-api`).
- **`shared/ui`, `shared/lib`:** là tập hợp thứ rời rạc → một `index.ts` gộp dễ **vỡ tree-shaking** (kéo cả
  thư viện nặng vào mọi page). Nên cho **mỗi component/lib một `index.ts` riêng**, import `@/shared/ui/button`.
- **Môi trường khác nhau (Next.js):** khi module trong cùng slice chạy ở server vs client, tách public API
  theo runtime (ví dụ `index.ts` server / client riêng) để không phá ranh giới môi trường khi bundle.
- **Tránh circular import:** trong **cùng slice** dùng import **tương đối** (đường dẫn đầy đủ, không qua
  `../index`); **khác slice** dùng import **tuyệt đối** (alias `@/...`).

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
| Cross-import entity | `entities/artist/@x/song.ts` | Public API riêng cho entity khác; `entities/song` import `entities/artist/@x/song`. Chỉ ở `entities`, tối thiểu. |
| Ghép màn hình | `pages/<route>/ui` | Page compose widget/feature/entity; không nhồi logic tái dùng (đẩy xuống). |

## Standards

- **Luật layer:** chỉ import xuống; `entities` không import `features`; `shared` không import gì ở trên.
  `processes` **đã deprecated** — không tạo mới, dồn về `features`/`app`.
- **Không cross-import cùng layer:** slice độc lập; liên kết qua layer dưới hoặc ghép ở trên. Ngoại lệ duy
  nhất: entity↔entity qua **`@x`** (`entities/a/@x/b`), giữ tối thiểu.
- **Public API bắt buộc:** mỗi slice có `index.ts` (liệt kê export tường minh, **không `export *`**); ngoài
  slice chỉ dùng public API, cấm import sâu; **không** đặt `index.ts` ở cấp layer.
- **Segment chuẩn:** `ui/model/api/lib/config` (tên theo **mục đích**); không đặt request trong `ui`, không
  đặt component trong `api`; `lib` không phải bãi rác helpers.
- **Entity vs Feature vs Widget:** entity = danh từ (invoice là gì); feature = động từ, một use case tái
  dùng (tạo invoice); widget = khối UI ghép tái dùng nhiều page. Đặt đúng chỗ.
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

- `features/A` import `features/B`, hoặc `entities/X` import `entities/Y` **trực tiếp** (cross-import cùng layer).
- Entity↔entity nối nhau **không** qua `@x` (import thẳng `entities/artist/model/...` từ `entities/song`).
- Import ngược layer (`entities` import `features`, `shared` import `entities`).
- Import sâu vào segment nội bộ (`entities/invoice/model/store`) thay vì public API.
- `export *` (wildcard) trong `index.ts` — lộ nội bộ, mất khả năng đọc interface của slice.
- Lạm dụng `widgets`: biến khối UI **không tái dùng, chiếm phần lớn một page** thành widget thay vì để thẳng trong page.
- Slice quá to / quá nhiều feature vụn: chôn cái quan trọng (Steiger cảnh báo `excessive-slicing`, `insignificant-slice`).
- Nhét business logic tái dùng vào `pages` thay vì đẩy xuống feature/entity.
- Gọi HTTP rải rác trong `ui` thay vì `api` segment qua `shared/api`.
- Trộn "danh từ" và "động từ": đặt logic tạo/sửa vào `entities` hoặc để component thuần trong `features`.
- Đặt segment thẳng vào layer có slice (`features/ui/...` thiếu tên slice) hoặc tên segment theo bản chất (`components/`, `hooks/`).
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

- [ ] `npx steiger ./src` + `eslint-plugin-boundaries` xanh (không cross-import cùng layer, không import ngược).
- [ ] Mỗi slice có `index.ts` (không `export *`); ngoài slice chỉ import qua public API; không `index.ts` cấp layer.
- [ ] Layer đúng thứ tự `app>pages>widgets>features>entities>shared`; không dùng `processes`; `shared`/`app` chứa segment trực tiếp, `shared` không biết domain.
- [ ] Entity = danh từ (model+card+đọc); feature = một use case (ui+model+mutation); widget chỉ khi tái dùng nhiều page.
- [ ] Quan hệ entity↔entity đi qua `@x` (`entities/a/@x/b`), không import thẳng ruột entity khác.
- [ ] Segment đặt tên theo mục đích (`ui/model/api/lib/config`), không `components/hooks/types`.
- [ ] Server-state qua React Query ở `api` segment; không `useState` giữ cache API.
- [ ] `tsc` + `eslint` xanh; xoá một feature không vỡ feature/entity khác.

## References

- Ghi **lựa chọn kiến trúc này thành ADR** (Nygard) ở `docs/decisions/` — vì sao FSD, phương án cân nhắc,
  hệ quả.
- **Feature-Sliced Design** (chuẩn chính thức, v2.1):
  - Layers — <https://feature-sliced.design/docs/reference/layers> (7 layer, `processes` deprecated, ngoại lệ App/Shared).
  - Slices & segments — <https://feature-sliced.design/docs/reference/slices-segments> (segment `ui/api/model/lib/config`, zero-coupling/high-cohesion).
  - Public API — <https://feature-sliced.design/docs/reference/public-api> (index.ts, insulation, **`@x` cross-import**, tree-shaking `shared/ui`).
- **Steiger** — linter FSD chính thức: <https://github.com/feature-sliced/steiger>. Cấu hình:
  [`references/steiger.config.js`](references/steiger.config.js). Bổ trợ luật layer:
  [`references/eslint-boundaries.fsd.jsonc`](references/eslint-boundaries.fsd.jsonc) (`eslint-plugin-boundaries`).
- **TanStack Query** — server-state ở segment `api` của entity/feature: <https://tanstack.com/query>.

## Related

- [ARD.md](ARD.md) — bảng chọn kiến trúc (selector) + tín hiệu nâng cấp (Small/Medium → Feature-Based ·
  Large nhiều team → FSD · tách app build/deploy → Micro-FE).
- [react-feature-based.template.md](react-feature-based.template.md) — biến thể **đơn giản hơn** cho app
  nhỏ/vừa một team: nhóm theo domain (`features/<domain>`), không tầng `widgets`/`entities`, nhẹ luật.
- [react-micro-frontend.template.md](react-micro-frontend.template.md) — biến thể cho **đa team**: tách
  host + remote (Module Federation), mỗi remote nội bộ có thể theo FSD; chọn khi cần build/deploy độc lập.
