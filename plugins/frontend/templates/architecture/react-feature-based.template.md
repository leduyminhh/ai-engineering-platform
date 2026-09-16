# Template: React · Feature-Based (nhóm theo domain)

## Summary

Blueprint **cấu trúc** cho một web app/SPA **React + TypeScript** quy mô **nhỏ/vừa** theo kiến trúc
**Feature-Based** kiểu **bulletproof-react**: nhóm mã theo **domain/feature** (chia dọc — vertical slice)
thay vì theo loại kỹ thuật. Mỗi `features/<domain>/` tự chứa đủ segment của nó
(`api, components, hooks, stores, types, utils, index.ts`) và mở ra ngoài qua **public API `index.ts`**.
Đây là biến thể **mềm hơn FSD**: **không** có tầng `widgets`/`entities`, chỉ **ba tầng**
(`shared → features → app`). Hai luật cốt lõi: (1) **codebase một chiều** — import chảy
`shared → features → app`, cấm ngược; (2) một `feature` **không** import ruột `feature` khác — compose ở
**tầng app** (`app/routes`). Ranh giới ép bằng **`import/no-restricted-paths`** (đúng cách bulletproof-react
dùng). Cây minh hoạ bằng domain `invoices`. **Không chứa code skeleton** — chỉ blueprint cấu trúc.

## Context

- **Stack:** React 18+ · TypeScript · Vite · **Tailwind CSS + component library** (shadcn/MUI/antd — đọc
  `package.json`/`design-system.md`). Data-fetching: **TanStack Query (React Query)**.
- **Phạm vi file:** chỉ mô tả **CẤU TRÚC** theo nhóm-domain (mô hình bulletproof-react). Cần ranh giới cứng
  hơn (layer/slice/segment, entities vs features): [react-fsd.template.md](react-fsd.template.md).
- **Khi nào dùng:** **mặc định** cho app nhỏ/vừa, ít/vừa domain, một team — muốn colocation theo domain để
  dễ đọc/xoá tính năng mà chưa cần bộ luật nặng của FSD. App lớn nhiều team → FSD; tách app build/deploy
  riêng → Micro-Frontend.
- **Đối chiếu domain minh hoạ ↔ vai trò:** cây dùng domain `invoices`; cột phải là "chỗ trống" cần thay.

| Vai trò (chỗ trống) | Ý nghĩa | Ví dụ trong `invoices` |
|---------------------|---------|------------------------|
| Route/màn hình | compose feature cho một path | `app/routes/invoices.tsx` (`/invoices`) |
| Feature (vertical slice) | một vùng nghiệp vụ tự chứa | `features/invoices` |
| UI của feature | presentational + container nhẹ | `features/invoices/components/invoice-list.tsx` |
| Hook của feature | logic/state cục bộ feature | `features/invoices/hooks/use-invoice-filters.ts` |
| API + server-state của feature | gọi backend + React Query + DTO | `features/invoices/api/get-invoices.ts` |
| Type/view-model của feature | kiểu domain, map DTO→VM | `features/invoices/types/invoice.ts` |
| Hạ tầng/UI-kit dùng chung | không mang nghiệp vụ | `components/`, `lib/api-client.ts` |

## Problem

App React nhỏ/vừa nếu chia theo **loại kỹ thuật** (`components/`, `hooks/`, `services/` phẳng cho mọi
domain) thì mã của một tính năng bị rải khắp cây: đọc/sửa/xoá một domain phải nhảy nhiều thư mục, không thấy
ranh giới tính năng, dễ nhồi chéo domain vào nhau. Ngược lại, FSD đầy đủ (layer + slice + segment + public
API + Steiger) là **quá nặng** khi chỉ có ít domain và một team — chi phí luật lớn hơn giá trị nhận lại. Cần
một cách nhóm **theo domain**, đủ ranh giới để không rối, nhưng **nhẹ luật** để đi nhanh.

## Solution

Feature-Based (bulletproof-react) nhóm mã theo **domain** thành các `feature` vertical, mỗi feature tự chứa
đủ segment; phần dùng chung được **làm phẳng** ở gốc `src/`:

1. **`features/<domain>/`** — một vertical slice: `api` (gọi backend + React Query hook + DTO),
   `components` (presentational + container nhẹ), `hooks` (logic/state cục bộ), `stores` (client-state riêng
   feature — tuỳ), `types` (type/view-model), `utils` (hàm thuần riêng — tuỳ), `index.ts` (**public API**).
   Chỉ tạo segment **thật sự cần** (không bắt buộc đủ 6).
2. **`app/`** — tầng khởi tạo + route: providers, router, và `app/routes/` **compose feature(s)** cho từng
   màn hình. Đây là **nơi hợp pháp để ghép nhiều feature** (thay cho "pages" ở template khác).
3. **`shared` (phẳng ở gốc `src/`)** — `components`, `hooks`, `lib`, `stores`, `config`, `types`, `utils`,
   `assets`, `testing`: hạ tầng & UI-kit không mang nghiệp vụ, dùng được mọi nơi.

Khác FSD: **không** tách `entities`/`widgets`, chỉ **ba tầng**. Hai luật về coupling: **codebase một chiều**
(`shared → features → app`) và **feature không import ruột feature khác** — cần liên kết thì hạ phần chung
xuống `shared` hoặc compose ở `app/routes`; mọi import vào feature đi qua `index.ts`. Server-state ở
`features/<x>/api` (React Query); presentational thuần ở `features/<x>/components`. Ép chiều phụ thuộc bằng
**`import/no-restricted-paths`** — chi tiết cấu hình ở
[references/eslint-boundaries.feature-based.jsonc](references/eslint-boundaries.feature-based.jsonc).

## Architecture

### Cây thư mục

Cây minh hoạ domain `invoices`. Ở **thư mục lá** chỉ nêu **một-hai file tượng trưng**; `+ …` báo còn file
cùng loại — quan trọng là **cây thư mục** và ranh giới, không phải liệt kê hết file. File/thư mục
kebab-case (theo bulletproof-react), component export PascalCase. Mỗi feature có `index.ts` (public API);
segment nào **không cần thì bỏ**.

```
src/
├── app/                              # TẦNG APP: khởi tạo + route (compose feature -> màn hình)
│   ├── routes/                       #   khai báo route -> màn hình; NƠI HỢP PHÁP ghép nhiều feature
│   │   └── invoices.tsx              #     ghép <InvoiceList/> + <CreateInvoiceForm/> (từ feature invoices)
│   ├── app.tsx                       #   root component
│   ├── provider.tsx                  #   QueryClientProvider, RouterProvider, ThemeProvider
│   └── router.tsx                    #   cấu hình router (lazy import routes)
│
├── features/                         # NHÓM THEO DOMAIN — mỗi feature là vertical slice tự chứa
│   └── invoices/
│       ├── api/                      #   GỌI BACKEND + React Query hook + DTO của feature
│       │   ├── get-invoices.ts       #     useQuery(getInvoices) -> qua @/lib/api-client
│       │   ├── create-invoice.ts     #     useMutation(createInvoice)
│       │   └── invoice.dto.ts        #     InvoiceDto (kiểu backend, nội bộ feature)
│       ├── assets/                   #   (tuỳ) ảnh/icon riêng feature
│       ├── components/               #   PRESENTATIONAL + container nhẹ của feature
│       │   ├── invoice-list.tsx      #     UI thuần: props in / events out (Tailwind + component-lib)
│       │   ├── invoice-list-container.tsx  #  container: gọi hook api -> đổ props xuống presentational
│       │   └── create-invoice-form.tsx     #  (+ invoice-row.tsx …)
│       ├── hooks/                    #   LOGIC/STATE cục bộ feature (bọc quanh api hook nếu cần)
│       │   └── use-invoice-filters.ts
│       ├── stores/                   #   (tuỳ) CLIENT-STATE riêng feature (Zustand) — KHÔNG server-state
│       │   └── invoice-ui.store.ts
│       ├── types/                    #   TYPE/VIEW-MODEL của feature
│       │   └── invoice.ts            #     Invoice (view model)
│       ├── utils/                    #   (tuỳ) hàm thuần riêng feature: map DTO->VM, format domain
│       │   └── to-invoice.ts
│       └── index.ts                  #   PUBLIC API: chỉ re-export phần công khai (xem references/)
│
├── components/                       # SHARED · UI-kit dùng chung (wrapper component-lib + primitive Tailwind)
├── hooks/                            # SHARED · hook tiện ích dùng chung (useDisclosure, useDebounce…)
├── lib/                              # SHARED · thư viện cấu hình sẵn: api-client, react-query, auth, i18n
│   └── api-client.ts                 #   baseURL, header auth, interceptor/map lỗi — MỌI HTTP đi qua đây
├── stores/                           # SHARED · client-state TOÀN CỤC (theme, sidebar, auth UI)
├── config/                           # SHARED · hằng số, env đã export, route path
├── types/                            # SHARED · type dùng chung toàn app
├── utils/                            # SHARED · hàm thuần dùng chung (format, cn…)
├── assets/                           # SHARED · ảnh/font tĩnh toàn app
└── testing/                          # SHARED · test util + mock (msw handlers, render wrapper)
```

> **Bên trong feature:** `api` = request + React Query hook + DTO; `components` = presentational + container
> nhẹ; `hooks` = logic/state cục bộ; `stores` = client-state riêng feature; `types` = type/view-model;
> `utils` = hàm thuần riêng. `index.ts` **chỉ** re-export phần công khai — phần còn lại là nội bộ feature.
> **Không cần đủ mọi segment** — chỉ tạo cái thật sự dùng (NOTE của bulletproof-react).

> **Vì sao `shared` làm phẳng ở gốc `src/`?** bulletproof-react đặt `components/hooks/lib/stores/config/
> types/utils` ngay dưới `src/` (không gói trong `shared/`). Về mặt **luật ranh giới**, nhóm này là **tầng
> shared** (đáy chiều phụ thuộc). Nếu muốn một thư mục `shared/` gói lại cũng được — chỉnh `pattern` trong
> file lint tương ứng.

### Vai trò & ranh giới (ba tầng)

Ranh giới do `import/no-restricted-paths` ép (React/TS không có compiler cô lập module như Maven). Ba tầng,
từ cao xuống thấp:

- **`app` (tầng cao nhất)** — dựng providers (QueryClient/Router/Theme) + `app/routes` compose feature(s)
  thành màn hình. Chỉ compose, không nghiệp vụ tái dùng. **Import được** `features` + `shared`; **không ai
  import ngược vào `app`**. `app/routes` là **nơi hợp pháp ghép nhiều feature**.
- **`features/<domain>` (tầng giữa)** — vertical slice tự chứa của một domain. Bên trong tự do dùng
  `api`/`components`/`hooks`/`stores`/`types`/`utils` của **chính nó** + `shared`. **KHÔNG** import ruột
  feature khác. **KHÔNG** import từ `app`. Mở ra ngoài **chỉ** qua `index.ts`.
- **`shared` (tầng đáy)** — hạ tầng & UI-kit không mang nghiệp vụ: `lib/api-client`, primitive Tailwind/
  wrapper component-lib (`components`), helper (`utils`), hook tiện ích (`hooks`), store toàn cục (`stores`),
  `config`, `types`. **Không** biết domain, **không** import `features`/`app`.

### Chiều phụ thuộc (unidirectional codebase)

bulletproof-react diễn giải: *"code chảy một chiều, từ phần dùng chung tới ứng dụng —
`shared → features → app`. `shared` dùng được ở mọi nơi; `features` chỉ import từ `shared`; `app` import
từ `features` và `shared`."* Thêm luật cô lập: **`features/A` không import `features/B`** — compose ở
`app/routes`, hoặc hạ phần chung xuống `shared`.

Ép bằng **`import/no-restricted-paths`** (eslint-plugin-import) — vi phạm là **fail lint**. Trích ngắn luật
**cấm cross-feature** (mỗi feature một entry, `except` = chính nó):

```jsonc
// .eslintrc — TRÍCH NGẮN; cấu hình đầy đủ ở references/eslint-boundaries.feature-based.jsonc
"import/no-restricted-paths": ["error", { "zones": [
  // cấm import chéo feature: features/invoices chỉ được import chính nó
  { "target": "./src/features/invoices",  "from": "./src/features", "except": ["./invoices"] },
  { "target": "./src/features/customers", "from": "./src/features", "except": ["./customers"] }
  // + luật MỘT CHIỀU (features !-> app; shared !-> features/app) — xem file references/
]}]
```

> **Cấu hình đầy đủ** (cross-feature + một chiều `shared→features→app`, kèm biến thể
> `eslint-plugin-boundaries` tương đương và naming/absolute-import tuỳ chọn) nằm ở
> [references/eslint-boundaries.feature-based.jsonc](references/eslint-boundaries.feature-based.jsonc).
> Public API (`index.ts`) và trade-off barrel-file vs tree-shaking: xem
> [references/feature-public-api.md](references/feature-public-api.md). Cấu hình là khởi điểm, chỉnh theo
> dự án; naming (`use*`, `*.dto`) vẫn giữ bằng review.

### Ranh giới state

| Loại state | Ở đâu | Công cụ |
|-----------|-------|---------|
| Server-state (list/detail/cache/refetch/mutation) | `features/<x>/api` | **React Query** (`useQuery`/`useMutation`) — KHÔNG copy vào `useState` |
| Client-state riêng feature (bộ lọc, tab đang mở của feature) | `features/<x>/stores` hoặc `hooks` | Zustand / `useReducer` |
| Client-state toàn cục (theme, sidebar, auth UI) | `stores/` (gốc, dùng chung) | Zustand/Context |
| UI-state cục bộ (input, mở/đóng menu) | trong `features/<x>/components` | `useState`/`useReducer` |

## Feature-flags (Optional)

> **Tùy chọn** — chỉ thêm khi cần bật/tắt nhánh tính năng theo môi trường/đối tượng. App không cần cờ thì
> **bỏ qua toàn bộ mục này**.

- **Nguồn flag:** `config/` (gốc, tầng shared) — đọc từ `env`/remote config, chuẩn hoá thành map
  `{ [key]: boolean }`. Đây là nơi **duy nhất** biết cờ đến từ đâu.
- **Đọc flag:** hook `useFeatureFlag(key)` ở `hooks/` (gốc, shared) — trả `boolean`, giấu nguồn (env/remote)
  khỏi UI. `features` đọc cờ **qua shared** (import xuống), không tự dựng cơ chế cờ riêng.
- **Gate ở đâu:** quyết định bật/tắt đặt ở `app/routes` (chọn có render feature không) hoặc
  `features/<x>/components` (bật/tắt nhánh UI trong feature). **KHÔNG** nhét logic quyết định flag vào
  `features/<x>/api` — tầng api chỉ gọi backend, không rẽ nhánh theo cờ (giữ data layer thuần, dễ test).

Ví dụ ngắn: bật màn hình `/invoices` mới sau cờ `invoices.v2`.

```
// app/routes/invoices.tsx  (gate ở route — compose theo cờ)
useFeatureFlag('invoices.v2')  ->  true  ? <InvoiceListV2/> : <InvoiceListV1/>
//   useFeatureFlag đọc từ config/ (shared); route chọn nhánh feature nào để compose.
```

## Implementation

Map ở biên để presentational luôn sạch, DTO backend không rò vào UI:

| Ranh giới | Ở đâu | Quy tắc |
|-----------|-------|---------|
| Public API feature | `features/<domain>/index.ts` | Chỉ re-export component/hook/type công khai; giấu nội bộ. Ngoài feature dùng `@/features/invoices`, không `.../api/...`. Xem [references/feature-public-api.md](references/feature-public-api.md). |
| DTO API → view model | `features/invoices/api/invoice.dto.ts` + `types/invoice.ts` (map ở `utils/to-invoice.ts`) | Nếu shape backend khác nhu cầu UI, map ở `utils`; UI chỉ thấy view model. Shape trùng thì dùng thẳng DTO, khỏi lớp thừa. |
| Gọi API | `features/invoices/api/get-invoices.ts` qua `@/lib/api-client` | Mọi HTTP đi qua `lib/api-client` (baseURL, header auth, map lỗi); hàm API không `fetch` rải rác. |
| Data/handler → presentational | `features/invoices/components/*-container.tsx` | Container gọi hook api, truyền `{data, loading, error, onX}` xuống presentational qua props. |
| Ghép nhiều feature | `app/routes/<route>` | Chỉ tầng `app` được compose nhiều feature; feature không tự gọi feature khác. |

## Standards

- **Feature tự chứa:** mã một domain nằm gọn trong `features/<domain>/` (`api/components/hooks/stores/types/
  utils`); chỉ tạo segment thật sự cần.
- **Codebase một chiều:** import chảy `shared → features → app`; `features` không import `app`; `shared`
  không import `features`/`app`. Ép bằng `import/no-restricted-paths`.
- **Không cross-import feature:** `features/invoices` **không** import `features/customers`; liên kết qua
  `shared` hoặc compose ở `app/routes`.
- **Public API:** mỗi feature có `index.ts`; ngoài feature dùng public API, hạn chế import sâu (xem trade-off
  barrel-file trong references/feature-public-api.md).
- **Presentational thuần trong `components`:** component nhận props / phát event; container nhẹ nối hook →
  presentational.
- **Server-state = React Query** ở `features/<x>/api`: không tự quản cache bằng `useState`/`useEffect`.
- **HTTP tập trung:** chỉ `features/<x>/api` (qua `@/lib/api-client`) biết endpoint; UI không thấy URL.
- **Đặt tên:** file/thư mục kebab-case (`invoice-list.tsx`, `create-invoice.ts`), component export
  PascalCase, hook `use*`, DTO `*Dto`, view model gọn (`Invoice`); alias `@/features/<domain>`, `@/lib/*`,
  `@/components/*`.
- **Styling:** Tailwind + tái dùng `components/` (wrapper component-lib) trước khi tự dựng.

## Best Practices

- Bắt đầu từ `shared` (`lib/api-client`, `components` UI-kit) → dựng từng `feature` theo domain →
  `app/routes` ghép.
- Giữ feature đủ nhỏ, một domain rõ ràng; domain lớn có thể tách nhiều feature ghép ở `app/routes`.
- Public API `index.ts` là "hợp đồng" của feature — đổi nội bộ tự do, giữ export ổn định.
- Cần dùng chung giữa hai feature → hạ phần chung xuống `shared` (không copy, không import chéo feature).
- Bắt đầu presentational với dữ liệu giả (props), rồi mới bọc container nối hook — dễ test/preview.
- Đặt `queryClient` + key convention ở `lib/react-query`; key theo domain (`['invoices', params]`).
- Cân nhắc barrel-file theo quy mô feature (ranh giới rõ vs tree-shaking) — xem references/feature-public-api.md.

## Anti-patterns

- `features/A` import trực tiếp `features/B` (cross-import) thay vì qua `shared` hoặc compose ở `app/routes`.
- Import sâu vào ruột feature (`features/invoices/api/get-invoices`) thay vì public API `index.ts`.
- Import ngược chiều: `features` import từ `app`, hoặc `shared` (`components`/`lib`/`utils`) import lên
  `features`/`app` — phá luật một chiều.
- `fetch()`/`axios` trong component `components/` hoặc `useEffect` giữa JSX (phải ở `api` qua hook, dùng
  `@/lib/api-client`).
- Copy dữ liệu React Query sang `useState` rồi tự đồng bộ (nguồn sự thật đôi → lệch).
- Để **logic/component tái dùng lẫn trong một feature** thay vì **nâng lên `shared`** khi feature thứ hai cần
  tới — dẫn tới copy hoặc cross-import.
- Feature **phình** ôm nhiều domain: tách thành nhiều feature nhỏ, ghép ở `app/routes`.
- Rẽ nhánh theo feature-flag trong `features/<x>/api` (data layer nên thuần; gate ở `app/routes`/`components`).
- Tự dựng lại `widgets`/`entities` kiểu FSD ở đây — nếu thật sự cần thì chuyển hẳn sang FSD.

## Examples

Luồng màn hình `/invoices` (danh sách + nút tạo):

1. `app/router.tsx` map `/invoices` → `app/routes/invoices.tsx`.
2. `app/routes/invoices.tsx` compose `<InvoiceList/>` + `<CreateInvoiceForm/>` — cả hai lấy từ
   `@/features/invoices` (public API `index.ts`).
3. `features/invoices/components/invoice-list-container.tsx` gọi `useInvoices()` → `{data, isLoading, error}`,
   truyền xuống `<InvoiceList invoices={data} loading={isLoading} onSelect={…}/>` (presentational thuần).
4. `useInvoices` (`features/invoices/api/get-invoices.ts`) = `useQuery(['invoices'], getInvoices)`;
   `getInvoices()` gọi `@/lib/api-client`; `utils/to-invoice.ts` map `InvoiceDto` → `Invoice` (view model ở
   `types/invoice.ts`).
5. Cần hiển thị tên khách trong dòng hoá đơn → **không** import `features/customers`; đưa kiểu/format dùng
   chung xuống `shared` (`types`/`utils`), hoặc ghép hai feature ở `app/routes/invoices.tsx`.

## Checklist

Scaffold coi là đúng khi:

- [ ] `import/no-restricted-paths` xanh: một chiều `shared→features→app` (không import ngược); feature không
      import feature khác; import vào feature qua `index.ts`.
- [ ] Mỗi feature có `index.ts` (public API); ngoài feature hạn chế import sâu.
- [ ] Không có `fetch`/`axios` ngoài `features/<x>/api` (qua `@/lib/api-client`).
- [ ] Server-state đi qua React Query ở `api`; không `useState` giữ cache API.
- [ ] Presentational trong `components/` nhận đủ data/handler qua props (test được bằng render + props).
- [ ] `shared` (`components`/`hooks`/`lib`/`stores`/`config`/`types`/`utils`) không biết domain, không import
      `features`/`app`.
- [ ] (Nếu dùng flag) nguồn ở `config/`, đọc qua `useFeatureFlag` (`hooks/`), gate ở `app/routes`/
      `components`, không rẽ nhánh cờ trong `api`.
- [ ] `tsc` + `eslint` xanh; xoá một feature không vỡ feature khác.

## References

- Ghi **lựa chọn kiến trúc này thành ADR** (Nygard) ở `docs/decisions/` — vì sao Feature-Based, phương án đã
  cân nhắc (Layered nhẹ hơn, FSD nặng hơn), hệ quả.
- **bulletproof-react** (Alan Alickovic) — mô hình gốc của template này:
  - Repo: <https://github.com/alan2207/bulletproof-react>
  - Project Structure (cây thư mục, feature segment, cross-feature import, unidirectional, `import/no-restricted-paths`):
    <https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md>
  - Project Standards (ESLint/Prettier/TS, absolute imports `@/*`, kebab-case naming):
    <https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md>
- **Companion (cấu hình THẬT, copy-paste được):**
  - [references/eslint-boundaries.feature-based.jsonc](references/eslint-boundaries.feature-based.jsonc) —
    `import/no-restricted-paths` ép cross-feature + một chiều; kèm biến thể `eslint-plugin-boundaries`.
  - [references/feature-public-api.md](references/feature-public-api.md) — quy ước public API `index.ts` +
    trade-off barrel-file vs tree-shaking (theo bulletproof-react).
- `import/no-restricted-paths` (eslint-plugin-import) — ép chiều import + cô lập feature (fitness function;
  tương đương ArchUnit/import-linter của backend). Cấu hình trong references/ là khởi điểm, chỉnh theo dự án.
- TanStack Query — quản server-state (cache/refetch/mutation) ở `features/<x>/api` thay cho `useEffect` thủ công.

## Related

- [ARD.md](ARD.md) — bảng chọn kiến trúc + tín hiệu nâng cấp (Small/Medium → Feature-Based · Large → FSD ·
  tách app build/deploy → Micro-FE).
- [react-fsd.template.md](react-fsd.template.md) — biến thể ranh giới cứng hơn: layer/slice/segment
  (app/pages/widgets/features/entities/shared), public API + Steiger; chọn khi nhiều domain/nhiều team.
- [react-micro-frontend.template.md](react-micro-frontend.template.md) — tách thành host + remote (Module
  Federation), mỗi remote nội bộ FSD; chọn khi cần build/deploy độc lập theo team.
