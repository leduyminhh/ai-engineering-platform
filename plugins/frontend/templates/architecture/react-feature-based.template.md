# Template: React · Feature-Based (nhóm theo domain)

## Summary

Blueprint **cấu trúc** cho một web app/SPA **React + TypeScript** quy mô **nhỏ/vừa** theo kiến trúc
**Feature-Based**: nhóm mã theo **domain/feature** (chia dọc — vertical slice) thay vì theo loại kỹ thuật.
Mỗi `feature` tự chứa đủ tầng của nó (`ui/hooks/api/model`) và mở ra ngoài qua **public API `index.ts`**.
Đây là biến thể **mềm hơn FSD**: **không** có tầng `widgets`/`entities`, **không** ép luật cross-import cứng
theo layer — nằm giữa Layered và FSD. Một luật cốt lõi: một `feature` **không** import ruột `feature` khác;
liên kết qua `shared` hoặc **compose** ở `pages`. Ranh giới ép bằng **`eslint-plugin-boundaries`**. Cây minh
hoạ bằng domain `invoices`. **Không chứa code skeleton** — chỉ blueprint cấu trúc.

## Context

- **Stack:** React 18+ · TypeScript · Vite · **Tailwind CSS + component library** (shadcn/MUI/antd — đọc
  `package.json`/`design-system.md`). Data-fetching: **TanStack Query (React Query)**.
- **Phạm vi file:** chỉ mô tả **CẤU TRÚC** theo nhóm-domain. Cần ranh giới cứng hơn (layer/slice/segment,
  entities vs features): [react-fsd.template.md](react-fsd.template.md).
- **Khi nào dùng:** **mặc định** cho app nhỏ/vừa, ít/vừa domain, một team — muốn colocation theo domain để
  dễ đọc/xoá tính năng mà chưa cần bộ luật nặng của FSD. App lớn nhiều team → FSD; tách app build/deploy
  riêng → Micro-Frontend.
- **Đối chiếu domain minh hoạ ↔ vai trò:** cây dùng domain `invoices`; cột phải là "chỗ trống" cần thay.

| Vai trò (chỗ trống) | Ý nghĩa | Ví dụ trong `invoices` |
|---------------------|---------|------------------------|
| Trang theo route | một màn hình gắn với path | `pages/invoices` (`/invoices`) |
| Feature (vertical slice) | một vùng nghiệp vụ tự chứa | `features/invoices` |
| UI của feature | presentational + container nhẹ | `features/invoices/ui/InvoiceList.tsx` |
| Hook của feature | logic/state (bọc React Query) | `features/invoices/hooks/useInvoices.ts` |
| API của feature | gọi backend + DTO | `features/invoices/api/invoice.api.ts` |
| Model của feature | type/view-model/business rule | `features/invoices/model/invoice.ts` |
| Hạ tầng/UI-kit dùng chung | không mang nghiệp vụ | `shared/ui`, `shared/api` |

## Problem

App React nhỏ/vừa nếu chia theo **loại kỹ thuật** (`components/`, `hooks/`, `services/` phẳng cho mọi
domain) thì mã của một tính năng bị rải khắp cây: đọc/sửa/xoá một domain phải nhảy nhiều thư mục, không thấy
ranh giới tính năng, dễ nhồi chéo domain vào nhau. Ngược lại, FSD đầy đủ (layer + slice + segment + public
API + Steiger) là **quá nặng** khi chỉ có ít domain và một team — chi phí luật lớn hơn giá trị nhận lại. Cần
một cách nhóm **theo domain**, đủ ranh giới để không rối, nhưng **nhẹ luật** để đi nhanh.

## Solution

Feature-Based nhóm mã theo **domain** thành các `feature` vertical, mỗi feature tự chứa đủ tầng:

1. **`features/<domain>/`** — một vertical slice: `ui` (presentational + container nhẹ), `hooks` (logic/state,
   bọc React Query), `api` (gọi backend + DTO), `model` (type/view-model/business rule), `index.ts`
   (**public API** của feature).
2. **`pages/<domain>/`** — compose feature(s) cho **một route**; nơi hợp pháp để ghép nhiều feature.
3. **`shared/`** — hạ tầng & UI-kit không mang nghiệp vụ (`ui`, `lib`, `config`, `api`), dùng chung mọi nơi.
4. **`app/`** — providers + router + layout gốc.

Khác FSD: **không** tách `entities`/`widgets`, **không** ép "chỉ import xuống layer" cho từng segment. Luật
duy nhất về coupling: **feature không import ruột feature khác** — liên kết qua `shared` hoặc compose ở
`pages`; mọi import từ ngoài đi qua `index.ts`. Server-state ở `features/<x>/api` + `hooks` (React Query);
presentational thuần ở `features/<x>/ui`. Ép chiều phụ thuộc bằng `eslint-plugin-boundaries`.

## Architecture

### Cây thư mục

Cây minh hoạ domain `invoices`. Ở **thư mục lá** chỉ nêu **một file tượng trưng**; `+ …` báo còn file cùng
loại — quan trọng là **cây thư mục** và ranh giới, không phải liệt kê hết file. Feature/thư mục kebab-case,
component PascalCase, hook/util camelCase. Mỗi feature có `index.ts` (public API).

```
src/
├── app/                              # KHỞI TẠO app: providers + router + layout gốc
│   ├── App.tsx
│   ├── providers.tsx                 #   QueryClientProvider, RouterProvider, ThemeProvider
│   └── routes.tsx                    #   khai báo route -> pages (lazy import)
│
├── pages/                            # TRANG theo route — compose feature(s) cho MỘT màn hình
│   └── invoices/
│       └── InvoiceListPage.tsx       #   ghép <InvoiceList/> + <CreateInvoiceForm/> (từ feature invoices)
│
├── features/                         # NHÓM THEO DOMAIN — mỗi feature là vertical slice tự chứa
│   └── invoices/
│       ├── ui/                       #   PRESENTATIONAL + container nhẹ của feature
│       │   ├── InvoiceList.tsx       #     UI thuần: props in / events out (Tailwind + component-lib)
│       │   └── CreateInvoiceForm.tsx #     (+ InvoiceRow.tsx, InvoiceListContainer.tsx …)
│       ├── hooks/                    #   LOGIC/STATE của feature — bọc React Query
│       │   └── useInvoices.ts        #     useQuery(getInvoices)/useMutation(createInvoice)
│       ├── api/                      #   GỌI BACKEND + kiểu DTO của feature (nơi biết HTTP của feature)
│       │   ├── invoice.api.ts        #     getInvoices()/createInvoice() -> gọi shared/api client
│       │   └── invoice.dto.ts        #     InvoiceDto (kiểu backend)
│       ├── model/                    #   TYPE/VIEW-MODEL/BUSINESS RULE của feature
│       │   └── invoice.ts            #     Invoice (view model), map DTO->VM, quy tắc domain thuần
│       └── index.ts                  #   PUBLIC API: chỉ re-export phần công khai của feature
│
└── shared/                           # DÙNG CHUNG, KHÔNG mang nghiệp vụ — không import feature/pages
    ├── ui/                           #   UI-kit: wrapper component-lib + primitive Tailwind (Button/Card…)
    ├── lib/                          #   helper thuần (format, hook tiện ích, queryClient config)
    ├── config/                       #   hằng số, env, route path
    └── api/                          #   api-client base (baseURL, header auth, map lỗi/interceptor)
```

> **Bên trong feature:** `ui` = presentational + container nhẹ; `hooks` = logic/state (React Query);
> `api` = request + DTO; `model` = type/view-model/business rule. `index.ts` **chỉ** re-export phần công
> khai — phần còn lại là nội bộ feature.

### Vai trò & ranh giới

Ranh giới do `eslint-plugin-boundaries` ép (React/TS không có compiler cô lập module như Maven):

- **`app`** — dựng providers (QueryClient/Router/Theme) + layout gốc + khai route. Chỉ compose, không nghiệp
  vụ. "Thấy" `pages` và `shared`.
- **`pages`** — một route = một page; **compose** feature(s) thành màn hình. Không fetch, không business rule
  tái dùng (đẩy vào feature). Đây là **nơi hợp pháp để ghép nhiều feature**.
- **`features/<domain>`** — vertical slice tự chứa của một domain. Bên trong tự do dùng `ui`/`hooks`/`api`/
  `model` của **chính nó** + `shared`. **KHÔNG** import ruột feature khác. Mở ra ngoài **chỉ** qua `index.ts`.
- **`shared`** — hạ tầng & UI-kit không mang nghiệp vụ: `api-client`, primitive Tailwind/wrapper component-lib,
  helper, config. **Không** biết domain, **không** import `features`/`pages`.

### Chiều phụ thuộc

Phụ thuộc trỏ theo: `app → pages → features → shared`; **mọi tầng → `shared`** hợp lệ; **feature ↔ feature
disallow**. Ép bằng `eslint-plugin-boundaries` — vi phạm là **fail lint**:

```jsonc
// .eslintrc — sketch KHỞI ĐIỂM, chỉnh theo dự án
{
  "settings": {
    "boundaries/elements": [
      { "type": "app",     "pattern": "src/app/*" },
      { "type": "page",    "pattern": "src/pages/*" },
      { "type": "feature", "pattern": "src/features/*", "capture": ["domain"] },
      { "type": "shared",  "pattern": "src/shared/*" }
    ]
  },
  "rules": {
    "boundaries/element-types": ["error", {
      "default": "disallow",
      "rules": [
        { "from": "app",     "allow": ["page", "shared"] },
        { "from": "page",    "allow": ["feature", "shared"] },
        { "from": "feature", "allow": ["shared"] },
        { "from": "shared",  "allow": ["shared"] }
      ]
    }],
    // feature CHỈ được dùng feature của CHÍNH NÓ (cùng ${domain}); cross-feature = fail
    "boundaries/entry-point": ["error", {
      "default": "disallow",
      "rules": [
        { "target": ["feature"], "allow": "index.ts" }
      ]
    }]
  }
}
```

> `boundaries/element-types` chặn **chiều import** (app→pages→features→shared, không ngược). Luật
> **feature↔feature disallow** đến từ việc `feature` chỉ được `allow: ["shared"]` (không có `feature`) — nên
> một feature không import feature khác; cần liên kết thì hạ dùng chung xuống `shared` hoặc **compose ở
> `pages`**. `boundaries/entry-point` ép mọi import vào feature đi qua `index.ts` (cấm import sâu). Đây là
> khởi điểm, chỉnh theo dự án; naming (`*Page`/`use*`/`*.api`) vẫn giữ bằng review.

### Ranh giới state

| Loại state | Ở đâu | Công cụ |
|-----------|-------|---------|
| Server-state (list/detail/cache/refetch/mutation) | `features/<x>/api` + `features/<x>/hooks` | **React Query** (`useQuery`/`useMutation`) — KHÔNG copy vào `useState` |
| Client-state toàn cục (theme, sidebar, auth UI) | `shared` (store dùng chung) | Zustand/Context |
| UI-state cục bộ (input, mở/đóng menu) | trong `features/<x>/ui` component | `useState`/`useReducer` |

## Feature-flags (Optional)

> **Tùy chọn** — chỉ thêm khi cần bật/tắt nhánh tính năng theo môi trường/đối tượng. App không cần cờ thì
> **bỏ qua toàn bộ mục này**.

- **Nguồn flag:** `shared/config/flags` — đọc từ `env`/remote config, chuẩn hoá thành map `{ [key]: boolean }`.
  Đây là nơi **duy nhất** biết cờ đến từ đâu.
- **Đọc flag:** hook `useFeatureFlag(key)` ở `shared/lib` — trả `boolean`, giấu nguồn (env/remote) khỏi UI.
- **Gate ở đâu:** quyết định bật/tắt đặt ở `pages` (chọn có render feature không) hoặc `features/<x>/ui`
  (bật/tắt nhánh UI trong feature). **KHÔNG** nhét logic quyết định flag vào `features/<x>/api` — tầng api chỉ
  gọi backend, không rẽ nhánh theo cờ (giữ data layer thuần, dễ test).

Ví dụ ngắn: bật màn hình `/invoices` mới sau cờ `invoices.v2`.

```
// pages/invoices/InvoiceListPage.tsx  (gate ở page — compose theo cờ)
useFeatureFlag('invoices.v2')  ->  true  ? <InvoiceListV2/> : <InvoiceListV1/>
//   useFeatureFlag đọc từ shared/config/flags; page chọn nhánh feature nào để compose.
```

## Implementation

Map ở biên để presentational luôn sạch, DTO backend không rò vào UI:

| Ranh giới | Ở đâu | Quy tắc |
|-----------|-------|---------|
| Public API feature | `features/<domain>/index.ts` | Chỉ re-export component/hook/type công khai; giấu nội bộ. Ngoài feature dùng `@/features/invoices`, không `.../hooks/...`. |
| DTO API → view model | `features/invoices/api/invoice.dto.ts` + `model/invoice.ts` | Nếu shape backend khác nhu cầu UI, map ở `model`; UI chỉ thấy view model. Shape trùng thì dùng thẳng DTO, khỏi lớp thừa. |
| Gọi API | `features/invoices/api/invoice.api.ts` qua `shared/api` | Mọi HTTP đi qua `shared/api` client (baseURL, header auth, map lỗi); hàm API không `fetch` rải rác. |
| Data/handler → presentational | `features/invoices/ui/*Container.tsx` | Container gọi hook, truyền `{data, loading, error, onX}` xuống presentational qua props. |
| Ghép nhiều feature | `pages/<route>` | Chỉ `pages` được compose nhiều feature; feature không tự gọi feature khác. |

## Standards

- **Feature tự chứa:** mã một domain nằm gọn trong `features/<domain>/` (`ui/hooks/api/model`).
- **Không cross-import feature:** `features/invoices` **không** import `features/customers`; liên kết qua
  `shared` hoặc compose ở `pages`.
- **Public API bắt buộc:** mỗi feature có `index.ts`; ngoài feature chỉ dùng public API, cấm import sâu.
- **Presentational thuần trong `ui`:** component nhận props / phát event; container nhẹ nối hook → presentational.
- **Server-state = React Query** ở `features/<x>/api` + `hooks`: không tự quản cache bằng `useState`/`useEffect`.
- **HTTP tập trung:** chỉ `features/<x>/api` (qua `shared/api`) biết endpoint; UI không thấy URL.
- **Đặt tên:** trang `*Page`, hook `use*`, API `*.api.ts`, DTO `*Dto`, view model gọn (`Invoice`). Feature/thư
  mục kebab-case, component PascalCase, hook/util camelCase; alias `@/features/<domain>`, `@/shared/*`.
- **Styling:** Tailwind + tái dùng `shared/ui` (wrapper component-lib) trước khi tự dựng.

## Best Practices

- Bắt đầu từ `shared` (UI-kit, api-client) → dựng từng `feature` theo domain → `pages` ghép.
- Giữ feature đủ nhỏ, một domain rõ ràng; domain lớn có thể tách nhiều feature ghép ở `pages`.
- Public API `index.ts` là "hợp đồng" của feature — đổi nội bộ tự do, giữ export ổn định.
- Cần dùng chung giữa hai feature → hạ phần chung xuống `shared` (không copy, không import chéo feature).
- Bắt đầu presentational với dữ liệu giả (props), rồi mới bọc container nối hook — dễ test/preview.
- Đặt `queryClient` + key convention ở `shared/lib`; key theo domain (`['invoices', params]`).

## Anti-patterns

- `features/A` import trực tiếp `features/B` (cross-import) thay vì qua `shared` hoặc compose ở `pages`.
- Import sâu vào ruột feature (`features/invoices/hooks/useInvoices`) thay vì public API `index.ts`.
- `fetch()`/`axios` trong component `ui` hoặc `useEffect` giữa JSX (phải ở `api` qua hook).
- `shared` import ngược lên `features`/`pages` (mất tính "không biết domain").
- Copy dữ liệu React Query sang `useState` rồi tự đồng bộ (nguồn sự thật đôi → lệch).
- Nhét business rule tái dùng vào `pages` thay vì đẩy vào `model` của feature.
- Rẽ nhánh theo feature-flag trong `features/<x>/api` (data layer nên thuần; gate ở `pages`/`ui`).
- Tự dựng lại `widgets`/`entities` kiểu FSD ở đây — nếu thật sự cần thì chuyển hẳn sang FSD.

## Examples

Luồng màn hình `/invoices` (danh sách + nút tạo):

1. `app/routes.tsx` map `/invoices` → `pages/invoices/InvoiceListPage`.
2. `InvoiceListPage` (page) compose `<InvoiceList/>` + `<CreateInvoiceForm/>` — cả hai lấy từ
   `@/features/invoices` (public API `index.ts`).
3. `features/invoices/ui/InvoiceListContainer` gọi `useInvoices()` → `{data, isLoading, error}`, truyền xuống
   `<InvoiceList invoices={data} loading={isLoading} onSelect={…}/>` (presentational thuần).
4. `useInvoices` (`features/invoices/hooks`) = `useQuery(['invoices'], getInvoices)`; `getInvoices()` ở
   `features/invoices/api/invoice.api.ts` gọi `shared/api` client; `model/invoice.ts` map DTO → view model.
5. Cần hiển thị tên khách trong dòng hoá đơn → **không** import `features/customers`; đưa kiểu/format dùng
   chung xuống `shared`, hoặc ghép hai feature ở `pages/invoices`.

## Checklist

Scaffold coi là đúng khi:

- [ ] `eslint-plugin-boundaries` xanh: `app→pages→features→shared`, không import ngược; feature không import
      feature khác; import vào feature chỉ qua `index.ts`.
- [ ] Mỗi feature có `index.ts` (public API); ngoài feature không import sâu.
- [ ] Không có `fetch`/`axios` ngoài `features/<x>/api` (qua `shared/api`).
- [ ] Server-state đi qua React Query ở `api`/`hooks`; không `useState` giữ cache API.
- [ ] Presentational trong `ui` nhận đủ data/handler qua props (test được bằng render + props).
- [ ] `shared` không biết domain, không import `features`/`pages`.
- [ ] (Nếu dùng flag) nguồn ở `shared/config/flags`, đọc qua `useFeatureFlag`, gate ở `pages`/`ui`, không rẽ
      nhánh cờ trong `api`.
- [ ] `tsc` + `eslint` xanh; xoá một feature không vỡ feature khác.

## References

- Ghi **lựa chọn kiến trúc này thành ADR** (Nygard) ở `docs/decisions/` — vì sao Feature-Based, phương án đã
  cân nhắc (Layered nhẹ hơn, FSD nặng hơn), hệ quả.
- `eslint-plugin-boundaries` — ép chiều import + public API theo feature (fitness function; tương đương
  ArchUnit/import-linter của backend). Cấu hình trong file là khởi điểm, chỉnh theo dự án.
- TanStack Query — quản server-state (cache/refetch/mutation) ở `api`/`hooks` thay cho `useEffect` thủ công.

## Related

- [ARD.md](ARD.md) — bảng chọn kiến trúc + tín hiệu nâng cấp (Small/Medium → Feature-Based · Large → FSD ·
  tách app build/deploy → Micro-FE).
- [react-fsd.template.md](react-fsd.template.md) — biến thể ranh giới cứng hơn: layer/slice/segment
  (app/pages/widgets/features/entities/shared), public API + Steiger; chọn khi nhiều domain/nhiều team.
- [react-micro-frontend.template.md](react-micro-frontend.template.md) — tách thành host + remote (Module
  Federation), mỗi remote nội bộ FSD; chọn khi cần build/deploy độc lập theo team.
