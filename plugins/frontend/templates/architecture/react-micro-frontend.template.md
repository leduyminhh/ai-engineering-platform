# Template: React · Micro-Frontend (Module Federation)

## Summary

Blueprint **cấu trúc** cho một hệ web quy mô **đa team, deploy độc lập** bằng **React + TypeScript** theo
kiểu **Micro-Frontend**: một **host (shell)** điều phối nhiều **remote** tự chủ, ghép runtime qua **Module
Federation** trên **Vite**. Host giữ routing gốc, layout khung, auth/session và khai `remotes`; mỗi remote
`expose` một/vài module công khai và **build/deploy độc lập**. Ba luật cứng: (1) remote **không** import ruột
remote khác — chỉ qua module `expose` + `packages/*`; (2) **React (và deps nền) là singleton shared** — một
bản duy nhất; (3) `packages/*` **không mang nghiệp vụ chéo** remote. **Bên trong mỗi remote tổ chức theo FSD**
— xem [react-fsd.template.md](react-fsd.template.md), file này **không** lặp lại chi tiết FSD. **Không chứa
code skeleton** — chỉ blueprint cấu trúc + sketch federation config ngắn.

## Context

- **Stack:** React 18+ · TypeScript · **Vite** · **Module Federation**. Plugin **chính**:
  `@module-federation/vite` (team Module Federation chính chủ). Biến thể cũ: `@originjs/vite-plugin-federation`.
  Nhánh Rspack/webpack: `@module-federation/enhanced`. **[chốt version khi triển khai]** — mọi thứ dưới đây mô
  tả theo **vai trò** (host khai remotes, remote expose module, shared singleton) để **không giòn theo version**.
- **Phạm vi file:** chỉ mô tả **CẤU TRÚC hệ host/remote/packages** + ranh giới cross-app. Cấu trúc **bên trong**
  một remote → [react-fsd.template.md](react-fsd.template.md).
- **Khi nào dùng:** **nhiều team** sở hữu các miền tách bạch, cần **release/deploy độc lập** (đổi một remote
  không redeploy cả hệ), stack/tiến độ mỗi team khác nhau. Một team, một pipeline deploy → dùng **FSD** trong
  một app là đủ, Micro-FE là over-engineer.
- **Đối chiếu domain minh hoạ ↔ vai trò:** monorepo có `host` + remotes `invoices`, `customers`; cột phải là
  "chỗ trống" cần thay bằng miền thật của bạn.

| Vai trò (chỗ trống) | Đơn vị | Ví dụ minh hoạ |
|---------------------|--------|----------------|
| Shell điều phối, routing gốc, auth | `apps/host` | `apps/host` |
| Miền tự chủ, build/deploy độc lập | `apps/<remote>` | `apps/invoices`, `apps/customers` |
| Module một remote công khai ra ngoài | `expose` | `./InvoicesApp`, `./InvoiceWidget` |
| Design system / UI-kit dùng chung | `packages/ui-kit` | `packages/ui-kit` |
| Hợp đồng type/DTO + event bus | `packages/contracts` | `packages/contracts` |
| Feature-flags runtime + env + route | `packages/shared-config` | `packages/shared-config` |

## Problem

Khi nhiều team cùng đổ vào **một SPA đơn khối**, họ va nhau ở build và deploy: một team merge là cả app phải
build lại, release bị khoá theo nhịp chậm nhất, sự cố một miền kéo sập toàn app. Muốn mỗi team **tự chủ vòng
đời** (chọn nhịp release, deploy riêng, rollback riêng) mà vẫn ghép thành **một sản phẩm liền mạch** cho người
dùng. Nhưng nếu tách app tuỳ tiện sẽ sinh bệnh mới: **nhiều bản React** cùng chạy (hook vỡ, context không chia
sẻ), remote gọi thẳng ruột nhau (coupling ngầm còn tệ hơn monolith), gói "shared" phình thành nơi chứa nghiệp
vụ chéo. Cần một ranh giới **runtime tường minh** giữa host và remote, ép được bằng cấu hình federation.

## Solution

Micro-FE áp mô hình **host–remote + shared package**, ghép ở **runtime**:

1. **Host (shell)** — sở hữu vỏ ứng dụng: routing gốc, layout khung, auth/session, cấu hình runtime. Host
   **khai `remotes`** và lazy-load module mà remote `expose`, gắn vào cây route/layout.
2. **Remote** — một miền tự chủ; **nội bộ theo FSD** (xem [react-fsd.template.md](react-fsd.template.md));
   chỉ phơi ra một/vài module qua `expose` (một page-level app hoặc widget nhúng được). Build/deploy độc lập,
   phát hành `remoteEntry` riêng.
3. **`packages/*`** — mã dùng chung **không mang nghiệp vụ chéo**: `ui-kit` (design system), `contracts`
   (type/DTO + event bus contract giữa host↔remote), `shared-config` (feature-flags runtime + env + route path).
4. **Shared singleton** — React và deps nền khai `singleton: true` để cả host lẫn remote **dùng chung một bản**
   (tránh nhiều React → hook/context vỡ). Versioning shared deps theo semver.

Ranh giới cứng: remote **chỉ** giao tiếp qua module `expose` + `packages/*`; **không** import ruột remote khác;
host điều phối, không nhét nghiệp vụ của remote vào shell. Ép bằng **federation config** (`remotes`/`exposes`/
`shared`) + import-boundary lint trong mỗi app.

## Architecture

### Các kiểu tích hợp & lựa chọn của template

Có nhiều thời điểm/cơ chế ghép micro-frontend; chọn sai là gốc của "distributed monolith". Bảng dưới đúc từ
literature (micro-frontends.org, Cam Jackson trên martinfowler.com) — chi tiết & bẫy version:
[references/integration-patterns.md](references/integration-patterns.md).

| Kiểu tích hợp | Ghép ở đâu | Deploy độc lập? | Ưu / Nhược ngắn | Khi nào dùng |
|---------------|-----------|-----------------|-----------------|--------------|
| Build-time (npm package) | Lúc build host | Không thật sự | +Đơn giản, type-safe · −Đổi remote phải build+deploy lại host | Chia sẻ **lib/UI-kit** versioned, không để tách vòng đời app |
| Server-side composition | Tầng server | Có | +TTFB/SEO tốt · −Cần hạ tầng ghép server, tương tác client phức tạp | App SSR/SEO nặng, nội dung là chính |
| Run-time — iframe | Trình duyệt | Có | +Cô lập mạnh nhất · −UX/routing/a11y kém | Sandbox cứng cho mã không tin cậy |
| **Run-time — Module Federation (JS)** | Trình duyệt | **Có** | +Shared singleton, lazy-load, chia sẻ context · −Phải quản version (bẫy nhiều React) | **Đa team, deploy độc lập** — lựa chọn ở đây |
| Run-time — Web Components | Trình duyệt | Có | +Chuẩn nền tảng, cô lập style qua Shadow DOM · −Ghép framework-agnostic thêm chi phí | Nhiều framework cùng tồn tại |
| Import maps | Trình duyệt | Có | +Chuẩn trình duyệt map tên→URL · −Chưa dàn xếp shared/singleton như MF | Nạp module theo tên chuẩn, tự quản chia sẻ deps |

**Template chọn run-time Module Federation** vì: (1) **deploy độc lập thật** — đổi một remote chỉ deploy lại
remote đó; (2) **shared + singleton** giữ một bản React khi ghép nhiều app trong một runtime; (3) **lazy-load
+ error boundary** cho host điều phối và cô lập lỗi remote. Đánh đổi: ranh giới cô lập là **quy ước + cấu hình
federation + lint** (không cứng như iframe), và phải chủ động quản dải version shared deps.

### Cây thư mục

Monorepo (pnpm/npm workspaces) minh hoạ `host` + remotes `invoices`, `customers`. Ở lá chỉ nêu file/thư mục
tượng trưng; `+ …` báo còn cùng loại. App/package kebab-case; module `expose` PascalCase theo component.

```
root/                                  # monorepo — pnpm/npm workspaces (mỗi app/package build riêng)
├── apps/
│   ├── host/                          # SHELL: điều phối toàn hệ — KHÔNG chứa nghiệp vụ của remote
│   │   ├── src/
│   │   │   ├── app/                   #   providers gốc (Theme/Query/Auth), router gốc
│   │   │   ├── routes/                #   map route -> lazy-load module remote (expose)
│   │   │   ├── layout/                #   khung chung: header/nav/sidebar/footer
│   │   │   ├── session/               #   auth/session; bơm runtime config + user xuống remote
│   │   │   └── remotes.d.ts           #   khai kiểu module remote (typed federation)
│   │   └── vite.config.ts             #   federation: khai `remotes` (invoices, customers) + `shared`
│   │
│   ├── invoices/                      # REMOTE: nội bộ theo FSD -> react-fsd.template.md (KHÔNG lặp ở đây)
│   │   ├── src/                       #   app/pages/widgets/features/entities/shared (theo FSD)
│   │   │   └── expose/                #   điểm phơi: InvoicesApp (page-level), InvoiceWidget (nhúng)
│   │   └── vite.config.ts             #   federation: `exposes` (./InvoicesApp, ./InvoiceWidget) + `shared`
│   │
│   └── customers/                     # REMOTE khác — cấu trúc tương tự, deploy độc lập
│       ├── src/                       #   nội bộ FSD; expose ./CustomersApp
│       └── vite.config.ts             #   federation: `exposes` + `shared`
│
└── packages/                          # DÙNG CHUNG — KHÔNG mang nghiệp vụ chéo remote
    ├── ui-kit/                        #   design system: wrapper component-lib + primitive (Button/Card…)
    ├── contracts/                     #   type/DTO chia sẻ host↔remote + event bus contract (tên/payload event)
    └── shared-config/                 #   feature-flags runtime + env + route path (hằng số điều phối)
```

> **Bên trong một remote = FSD.** `apps/<remote>/src` tổ chức theo layer/slice/segment của FSD; `expose/` chỉ
> là **mặt phơi công khai** (re-export module page-level/widget đã dựng từ các layer FSD). Chi tiết layer/slice/
> segment: [react-fsd.template.md](react-fsd.template.md) — file này không lặp lại.

### Vai trò & ranh giới

- **`apps/host` (shell)** — "danh từ" của cả hệ: routing gốc, layout khung, auth/session, cấu hình runtime,
  **error boundary** bao mỗi remote. Host **khai `remotes`**, **lazy-load** module `expose` của remote (nạp
  `remoteEntry` theo route) và gắn vào route/layout; **bơm** runtime config + user xuống remote qua context/
  props. Host **không** chứa logic nghiệp vụ của remote.
  - **Lazy-load + fallback:** host bọc mỗi remote trong `Suspense` (fallback loading) và **error boundary** —
    remote lỗi (remoteEntry 404/nạp fail/crash) hiển thị fallback cục bộ, **không kéo sập shell** hay remote
    khác. Đây là cơ chế cô lập lỗi runtime bù cho việc federation không cô lập cứng như iframe.
- **`apps/<remote>`** — một miền tự chủ, **nội bộ FSD**, build/deploy độc lập. Phơi **tối thiểu** ra ngoài qua
  `expose`: thường một module page-level (`./InvoicesApp` — remote tự quản route con của mình) và/hoặc widget
  nhúng (`./InvoiceWidget`). Ngoài các module `expose` này, ruột remote là **riêng tư**.
- **`packages/ui-kit`** — design system dùng chung: wrapper component-lib (shadcn/MUI/antd) + primitive Tailwind.
  Thuần trình bày, **không** biết nghiệp vụ của bất kỳ remote nào.
- **`packages/contracts`** — hợp đồng chia sẻ host↔remote: type/DTO ở biên (shape của props host bơm xuống,
  shape module `expose`) + **event bus contract** (tên event + payload để remote↔host/remote↔remote trao đổi
  gián tiếp). Chỉ **hợp đồng**, không logic, không nghiệp vụ đầy đủ của remote nào.
- **`packages/shared-config`** — nguồn điều phối runtime: feature-flags, env, route path. Là nơi host đọc để
  quyết định bật/tắt remote/feature (xem mục Feature-flags).

### Chiều phụ thuộc / ranh giới cross-app

Bốn luật, ép bằng federation config + import-boundary lint (vi phạm = **fail lint/build**):

1. **Host → remote một chiều, qua `expose`:** host lazy-load module remote phơi ra; **không** với tay vào ruột
   remote. Remote **không** import ngược vào host — nhận mọi thứ cần qua **props/context host bơm xuống**.
2. **Remote KHÔNG import ruột remote khác:** `invoices` **không** import file nội bộ của `customers`. Cần liên
   kết → qua module `expose` (host ghép) hoặc **event bus contract** ở `packages/contracts` (giao tiếp gián
   tiếp, lỏng lẻo). Coupling trực tiếp remote↔remote là cấm.
3. **React (và deps nền) là singleton shared:** khai `singleton: true` cho `react`/`react-dom` (và router/query
   client nếu chia sẻ) → **một bản duy nhất** cho cả host + mọi remote. Nhiều bản React = hook/context vỡ.
4. **`packages/*` chỉ chứa mã không-nghiệp-vụ-chéo:** UI-kit/contracts/shared-config đi **xuống** từ mọi app;
   không app nào import ngược lên, và `packages/*` **không** chứa nghiệp vụ riêng của một remote.

> **Versioning shared deps.** Khai **required version** cho mỗi shared dep; lệch minor thường dùng chung an
> toàn, lệch major có thể buộc nạp hai bản (nặng, dễ lỗi) — giữ host + remote **cùng dải version** cho deps
> singleton, nâng cấp có điều phối.

> **Biến thể poly-repo.** Thay vì một monorepo, **mỗi remote (và host) một repo riêng**; `packages/*` publish
> thành gói versioned (registry nội bộ), app khác `dependency` theo version. Ranh giới runtime (federation)
> **không đổi** — chỉ đổi cách chia sẻ mã dùng chung (workspace ↔ published package). Chọn poly-repo khi team
> muốn tách hẳn CI/ownership; monorepo khi muốn đồng bộ dễ.

### Shared dependencies + singleton

Deps nền được khai `shared` để host + mọi remote **dùng chung một instance** thay vì mỗi app bundle một bản.
Với React, đây là điều kiện đúng-sai chứ không phải tối ưu:

- **`singleton: true` cho `react` + `react-dom`** (và router/query client nếu chia sẻ context). React giữ
  hooks/context ở module-level state — **hai bản React** = "invalid hook call", context không xuyên ranh giới.
- **Chiến lược version:** khai `requiredVersion`/dải version cho mỗi shared dep; giữ host + remote **cùng dải**.
  Lệch **minor** thường dùng chung an toàn; lệch **major** có thể buộc nạp hai bản (nặng, dễ lỗi) — nâng cấp
  deps nền là việc **điều phối cả hệ**, lên kế hoạch chung, đồng bộ qua workspace (monorepo) hoặc pin (poly-repo).
- **Chốt danh sách singleton sớm** và giữ ngắn — chỉ chia sẻ khi thực sự cần một instance chung; chia sẻ bừa
  làm tăng coupling version giữa các team.

Cấu hình mẫu: [references/module-federation.host.vite.ts](references/module-federation.host.vite.ts) ·
[references/module-federation.remote.vite.ts](references/module-federation.remote.vite.ts).

### Giao tiếp cross-MFE

Giữ ghép **lỏng lẻo** — remote không biết ruột remote khác. Ba kênh, theo thứ tự ưu tiên:

1. **Props/context host bơm xuống:** kênh chính cho shell → remote (user/session/runtime-config). Host là chủ
   sở hữu, truyền xuống theo hợp đồng type ở `packages/contracts`.
2. **Custom events / event bus contract:** khi hai remote cần biết nhau, trao đổi qua **CustomEvent** hoặc một
   event bus mỏng, với **tên event + payload định nghĩa ở `packages/contracts`**. Giao tiếp gián tiếp, không
   app nào import ruột app kia.
3. **Module `expose` (host ghép):** nếu remote A cần UI của remote B, host ghép `B/BApp` ở route/slot khác —
   không phải A tự nạp remoteEntry của B.

**Cấm:** remote import ruột remote khác, remote nạp remoteEntry chéo, hay chia sẻ store trực tiếp xuyên remote
— đó là coupling ngầm còn tệ hơn monolith.

### Ranh giới state

| Loại state | Ở đâu | Ghi chú |
|-----------|-------|---------|
| Auth/session, user hiện tại | `apps/host/session` | Host sở hữu; **bơm xuống** remote qua context/props |
| Runtime config / feature-flags | `packages/shared-config` (host cung cấp) | Host đọc, truyền xuống; remote **không** tự fetch flag global |
| Server-state trong một miền | trong remote (`features|entities/<x>/api`) | React Query theo FSD của remote — không rò ra ngoài |
| State nghiệp vụ của một miền | trong remote (`model` theo FSD) | Riêng remote; không chia sẻ store xuyên remote |
| Giao tiếp gián tiếp giữa remote | `packages/contracts` (event bus contract) | Trao đổi qua event có hợp đồng, **không** chia sẻ store trực tiếp |
| UI-kit primitive | `packages/ui-kit` | Không giữ business state |

## Feature-flags (Optional)

> **Tùy chọn** — không bắt buộc trong scaffold. Thêm khi cần bật/tắt remote/feature theo môi trường hoặc theo
> lô người dùng mà **không redeploy**.

- **Flag là runtime config do HOST cung cấp**, không phải hằng số build-time của remote. Host đọc nguồn flag từ
  `packages/shared-config` (provider/loader đặt ở đây) rồi **truyền xuống remote qua context/props** — cùng
  kênh với runtime config. Nhờ vậy bật/tắt một remote/feature chỉ là đổi cấu hình phía host, **không cần build
  hay redeploy remote**.
- **Fallback flag cục bộ mỗi remote:** khi chạy remote độc lập (dev/test tách host) hoặc host chưa bơm flag,
  remote dùng một giá trị mặc định cục bộ (đọc qua cùng interface `useFeatureFlag`). Remote luôn **đọc qua
  interface** đó, không tự query nguồn flag global.
- **Vì sao runtime chứ không build-time (quan trọng với micro-FE):** remote build/deploy **độc lập và bất đối
  xứng về thời điểm** — nếu flag đóng cứng lúc build, muốn tắt một feature phải chờ remote đó build+deploy lại,
  phá vỡ chính lợi ích tự chủ vòng đời. Runtime flag cho host **điều phối tức thời** (bật remote mới, tắt miền
  lỗi, roll-out theo lô) trên các remote đã deploy sẵn — không đồng bộ nhịp release giữa các team.
- **Đặt provider/nguồn ở `packages/shared-config`;** gate ở host (bật/tắt cả remote khi khai `remotes`/route)
  và/hoặc trong remote (ẩn/hiện feature qua flag host bơm xuống). **Không** rải logic flag vào `ui-kit`.

## Implementation

Sketch federation config **ngắn** (minh hoạ vai trò — chốt cú pháp/tuỳ chọn theo package + version khi triển
khai). Cấu hình mẫu đầy đủ (có comment) ở artifact đi kèm:
[references/module-federation.host.vite.ts](references/module-federation.host.vite.ts) và
[references/module-federation.remote.vite.ts](references/module-federation.remote.vite.ts).

```ts
// apps/host/vite.config.ts — HOST khai remotes + shared singleton
federation({
  name: 'host',
  remotes: {
    invoices: 'https://invoices.example/assets/remoteEntry.js',   // [chốt URL/env khi deploy]
    customers: 'https://customers.example/assets/remoteEntry.js',
  },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
})

// apps/invoices/vite.config.ts — REMOTE expose module + cùng shared singleton
federation({
  name: 'invoices',
  exposes: { './InvoicesApp': './src/expose/InvoicesApp' },        // page-level; './InvoiceWidget' nếu cần nhúng
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
})
```

| Ranh giới | Ở đâu | Quy tắc |
|-----------|-------|---------|
| Khai remote | `apps/host` federation `remotes` | Host lazy-load module `expose`; URL `remoteEntry` từ env, không hardcode |
| Phơi module | `apps/<remote>` federation `exposes` | Chỉ phơi module công khai (page-level/widget); ruột remote riêng tư |
| Shared singleton | mọi `vite.config.ts` | `react`/`react-dom` `singleton: true`; đồng bộ version deps nền |
| Hợp đồng biên | `packages/contracts` | Type props host↔remote + event bus contract; không nghiệp vụ |
| Điều phối runtime | `packages/shared-config` | Env + route + feature-flags; host đọc, bơm xuống remote |

## Standards

- **Host là shell thuần điều phối:** routing gốc, layout, auth/session, cấu hình runtime; **không** nghiệp vụ
  của remote nằm trong host.
- **Remote tự chủ + nội bộ FSD:** mỗi remote build/deploy độc lập; cấu trúc trong theo
  [react-fsd.template.md](react-fsd.template.md); phơi **tối thiểu** qua `expose`.
- **Không cross-import remote:** remote **không** import ruột remote khác; liên kết qua `expose` (host ghép) hoặc
  event bus contract ở `packages/contracts`.
- **React singleton:** `react`/`react-dom` (và deps nền chia sẻ) khai `singleton: true`; đồng bộ dải version.
- **`packages/*` không nghiệp vụ chéo:** `ui-kit` (trình bày), `contracts` (hợp đồng), `shared-config` (điều
  phối) — không gói nào chứa nghiệp vụ riêng của một remote.
- **Runtime config, không hardcode:** URL `remoteEntry`, base-url, flag đọc từ env/`shared-config`, host bơm xuống.
- **Đặt tên:** app/package kebab-case (`apps/invoices`, `packages/ui-kit`); module `expose` PascalCase
  (`./InvoicesApp`).

## Best Practices

- Bắt đầu với **1 host + 1 remote + `packages/{ui-kit,contracts,shared-config}`**; thêm remote khi có team/miền
  thật cần tách vòng đời — không tách sẵn.
- Giữ **mặt `expose` nhỏ và ổn định**: một page-level app cho remote tự quản route con là đủ; coi `expose` +
  contract là "hợp đồng" — đổi ruột remote tự do, giữ mặt phơi ổn định.
- Chia sẻ qua **event bus contract** ở `packages/contracts` khi hai remote cần biết nhau — trao đổi event có
  hợp đồng thay vì import trực tiếp hay chia sẻ store.
- Chốt **danh sách shared singleton** sớm (React, router, query client nếu dùng chung) và đồng bộ version qua
  workspace; một upgrade major deps nền là việc **điều phối cả hệ**, lên kế hoạch.
- **Design system dùng chung qua `packages/ui-kit`:** một nguồn primitive/token cho host + mọi remote để UI
  liền mạch và giảm va style (federation không cô lập CSS tự động — dựa vào design system + quy ước đặt tên).
- Poly-repo: publish `packages/*` versioned, mọi app pin version; nâng cấp có changelog để remote khác theo kịp.

## Anti-patterns

- Nhét nghiệp vụ (type/logic riêng của một remote) vào `packages/*` → biến shared thành **coupling chéo**
  (triệu chứng: nâng version một package buộc mọi remote redeploy; class trong package mang tên miền của một remote).
- **Remote gọi thẳng remote khác** (import ruột hoặc nạp remoteEntry chéo) thay vì qua `expose`/event bus contract.
- **Nhiều bản React** vì quên `singleton: true` hoặc lệch major deps nền → hook/context vỡ khó lần.
- **Chia remote quá nhỏ** (một widget cũng thành remote) → bùng nổ remoteEntry, chi phí ghép runtime lấn át lợi
  ích tự chủ; gộp lại theo miền/ownership của team.
- Host ôm nghiệp vụ của remote (validate/logic miền trong shell) → host phình, mất tự chủ của remote.
- Phơi quá nhiều qua `expose` (phơi ruột remote) → mất ranh giới, remote khác bám vào chi tiết nội bộ.
- Hardcode URL `remoteEntry`/base-url trong code thay vì env → không điều phối được theo môi trường.

## Examples

Luồng màn hình `/invoices` (host ghép remote `invoices`):

1. `apps/host/routes` map `/invoices/*` → **lazy-load** `invoices/InvoicesApp` (module remote `expose`).
2. `apps/host/layout` bọc module trong khung chung (header/nav); `apps/host/session` **bơm** user + runtime
   config (kể cả feature-flags) xuống qua context/props theo hợp đồng ở `packages/contracts`.
3. `apps/invoices` (nội bộ **FSD**) dựng `InvoicesApp` từ các layer của nó, tự quản route con `/invoices/:id`;
   phơi `./InvoicesApp` (và `./InvoiceWidget` nếu miền khác cần nhúng thẻ invoice).
4. `invoices` cần dữ liệu khách hàng để hiển thị → **không** import ruột `customers`: hoặc host ghép
   `customers/CustomersApp` ở route khác, hoặc trao đổi qua **event bus contract** (`packages/contracts`).
5. `react`/`react-dom` khai `singleton: true` ở cả host + remote → một bản React cho toàn hệ; `packages/ui-kit`
   cấp Button/Card dùng chung cho host lẫn remote.

## Checklist

Scaffold coi là đúng khi:

- [ ] Host khai `remotes` + lazy-load module `expose`; **không** chứa nghiệp vụ của remote.
- [ ] Mỗi remote build/deploy độc lập (`remoteEntry` riêng), nội bộ theo FSD, phơi **tối thiểu** qua `exposes`.
- [ ] `react`/`react-dom` `singleton: true` ở mọi `vite.config.ts`; chỉ **một bản React** khi chạy ghép.
- [ ] Remote **không** import ruột remote khác; liên kết qua `expose`/event bus contract ở `packages/contracts`.
- [ ] `packages/*` không mang nghiệp vụ chéo (ui-kit trình bày · contracts hợp đồng · shared-config điều phối).
- [ ] URL `remoteEntry`/base-url/flag đọc từ env/`shared-config` (không hardcode); host bơm runtime config xuống.
- [ ] Feature-flags (nếu dùng) là runtime host cung cấp, có fallback cục bộ mỗi remote — tắt feature **không**
      cần redeploy remote.

## References

- Ghi **lựa chọn Micro-Frontend thành ADR** (Nygard) ở `docs/decisions/`: vì sao tách app + deploy độc lập,
  phương án cân nhắc (một app FSD vs micro-FE), monorepo vs poly-repo, hệ quả.
- Module Federation — cơ chế ghép runtime (host `remotes` / remote `exposes` / `shared` singleton). Trên Vite:
  `@module-federation/vite` (chính chủ), `@originjs/vite-plugin-federation` (biến thể cũ); nhánh Rspack/webpack
  `@module-federation/enhanced`. **[chốt version khi triển khai]** — mô tả theo vai trò để không lệ thuộc version.
- **Artifact đi kèm** (thư mục `references/`): so sánh các kiểu tích hợp + bẫy version →
  [references/integration-patterns.md](references/integration-patterns.md); cấu hình Vite mẫu →
  [references/module-federation.host.vite.ts](references/module-federation.host.vite.ts),
  [references/module-federation.remote.vite.ts](references/module-federation.remote.vite.ts).
- **Nguồn (URL canonical):** Micro Frontends — Michael Geers <https://micro-frontends.org/>; "Micro Frontends"
  — Cam Jackson <https://martinfowler.com/articles/micro-frontends.html>; Module Federation
  <https://module-federation.io/>. Package đã xác minh trên npm (2026-09-15): `@module-federation/vite`@1.21.6,
  `@module-federation/enhanced`@2.9.0 (Rspack/webpack), `@originjs/vite-plugin-federation`@1.4.1 (biến thể cũ);
  shape export/API còn [Unverified] — đối chiếu docs, chốt version theo release thực tế khi cài.
- Cấu trúc bên trong một remote: [react-fsd.template.md](react-fsd.template.md).

## Related

- [ARD.md](ARD.md) — selector chọn kiến trúc frontend (Feature-Based / FSD / Micro-Frontend) + tín hiệu nâng cấp.
- [react-fsd.template.md](react-fsd.template.md) — cấu trúc **nội bộ mỗi remote** (layer/slice/segment + public API).
- [react-feature-based.template.md](react-feature-based.template.md) — biến thể đơn giản hơn cho một app/team;
  chưa cần tách host/remote.
