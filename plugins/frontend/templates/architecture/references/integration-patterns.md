# Tham chiếu: Các kiểu tích hợp Micro-Frontend

> Artifact tham chiếu đi kèm [react-micro-frontend.template.md](../react-micro-frontend.template.md).
> Đúc từ literature Micro-Frontend (micro-frontends.org của Michael Geers; bài của Cam Jackson trên
> martinfowler.com; tài liệu Module Federation). Template CHÍNH chọn **run-time qua Module Federation** —
> file này giải thích các phương án còn lại để bạn đối chiếu và ghi ADR.

## Bảng so sánh nhanh

Ba trục thời điểm ghép (theo cách phân loại của Cam Jackson): **build-time** (ghép lúc build),
**server-side** (ghép ở tầng server khi trả HTML), **run-time client** (ghép trong trình duyệt).

| Kiểu tích hợp | Ghép ở đâu | Deploy độc lập? | Ưu điểm | Nhược điểm | Khi nào chọn |
|---------------|-----------|-----------------|---------|-----------|--------------|
| **Build-time (npm package)** | Lúc build host | Không thật sự | Đơn giản, type-safe qua package, không có chi phí ghép runtime | Mỗi lần đổi remote phải **build + deploy lại host** → mất tự chủ vòng đời; dễ thành "distributed monolith" | Chia sẻ **thư viện/UI-kit** versioned, không phải để tách vòng đời app |
| **Server-side composition** | Tầng server (SSI/edge/ template) | Có | TTFB tốt, SEO mạnh, ghép trước khi tới client | Cần hạ tầng server-side ghép mảnh; tương tác client phức tạp hơn; khó chia sẻ state runtime | App **SSR/SEO nặng**, nội dung là chính, tương tác vừa phải |
| **Run-time qua iframe** | Trình duyệt | Có | **Cô lập mạnh nhất** (CSS/JS/global tách hẳn) | UX kém (routing/deep-link/resize/khó chia sẻ context), a11y & SEO yếu | Cần **sandbox cứng** cho mã bên thứ ba/không tin cậy |
| **Run-time qua JavaScript / Module Federation** | Trình duyệt | **Có** | Ghép linh hoạt, **shared deps + singleton**, lazy-load remote, chia sẻ context runtime | Phải quản **shared version** (bẫy nhiều React); ranh giới cô lập là quy ước + cấu hình, không cứng như iframe | **Đa team, deploy độc lập** — lựa chọn của template này |
| **Run-time qua Web Components** | Trình duyệt | Có | Chuẩn nền tảng, **cô lập style qua Shadow DOM**, agnostic framework | Ghép framework-agnostic thêm chi phí; tích hợp React ↔ custom element cần lớp đệm | Nhiều **framework khác nhau** cùng tồn tại; muốn bám web standard |
| **Import maps** | Trình duyệt | Có | Chuẩn trình duyệt để map tên module -> URL; không khoá vào một bundler | Chưa lo **shared/singleton** dàn xếp version như Module Federation; thường ghép cùng SystemJS | Muốn cơ chế **nạp module theo tên chuẩn**, tự quản chia sẻ deps |

## Vì sao template chọn run-time Module Federation

- **Deploy độc lập thật:** đổi một remote chỉ cần deploy lại remote đó, host và các remote khác không đụng —
  đúng mục tiêu "mỗi team tự chủ vòng đời" mà build-time không đạt được.
- **Shared deps + singleton:** ghép được nhiều app React trong **một** runtime mà vẫn giữ **một bản React**
  (khai `singleton: true`), điều mà iframe/web-component phải xử lý vòng vo hơn để chia sẻ context.
- **Lazy-load + fallback:** host nạp remoteEntry theo route, bọc error boundary để một remote lỗi không kéo
  sập shell — cân bằng giữa cô lập và trải nghiệm liền mạch.
- **Đánh đổi phải chấp nhận:** ranh giới cô lập là **quy ước + cấu hình federation + lint**, không cứng như
  iframe; và bạn phải chủ động quản dải version của shared deps (xem bẫy bên dưới).

## Bẫy "nhiều bản React" (quan trọng nhất với run-time JS)

React dùng module-level state cho hooks/context. Nếu host và remote nạp **hai bản React khác nhau**, hook
sẽ ném lỗi kiểu "invalid hook call" và context không xuyên qua ranh giới. Cách xử lý:

- Khai `react` và `react-dom` là `shared` với `singleton: true` ở **cả** host lẫn **mọi** remote.
- Giữ host + remote **cùng dải version** (đồng bộ qua workspace ở monorepo, hoặc pin version ở poly-repo).
- Lệch **minor** thường dùng chung an toàn; lệch **major** có thể buộc nạp hai bản — nâng cấp deps nền là
  việc **điều phối cả hệ**, lên kế hoạch chung.

## Cross-app communication (giao tiếp cross-MFE)

Theo literature, giữ ghép **lỏng lẻo** — remote không biết ruột remote khác:

- **Props/context host bơm xuống:** host truyền user/session/runtime-config xuống remote qua props hoặc
  context theo hợp đồng ở `packages/contracts`. Đây là kênh chính cho dữ liệu shell -> remote.
- **Custom events / event bus:** remote phát và nghe **CustomEvent** (hoặc một event bus mỏng) theo hợp đồng
  tên + payload định nghĩa ở `packages/contracts`. Cách này giữ remote độc lập, không import lẫn nhau.
- **KHÔNG chia sẻ store trực tiếp xuyên remote** và **KHÔNG** để remote import ruột remote — đó là coupling
  ngầm còn tệ hơn monolith.

## Styling / cô lập CSS

- **Web Components + Shadow DOM:** cô lập style ở mức nền tảng (style trong shadow root không rò ra ngoài).
- **iframe:** cô lập tuyệt đối nhưng đánh đổi UX.
- **Run-time JS (Module Federation):** không có cô lập CSS tự động — dùng **quy ước đặt tên** (BEM/prefix),
  **CSS Modules**, hoặc utility-first (Tailwind) + design system chung ở `packages/ui-kit` để tránh va style.

## Independent deployment & versioning

- Mỗi remote có **pipeline build/deploy riêng**, phát hành `remoteEntry.js` độc lập; host trỏ URL qua env.
- Mặt `expose` + hợp đồng ở `packages/contracts` là "API" của remote — giữ **ổn định**, đổi ruột tự do.
- **Monorepo** (pnpm/npm workspaces): đồng bộ shared deps dễ, một PR đổi nhiều app. **Poly-repo**: mỗi app
  một repo, `packages/*` publish thành gói versioned; tách hẳn CI/ownership nhưng nâng cấp cần changelog.

## Chốt gì khi triển khai

Các package dưới đã **xác minh tồn tại trên npm registry** (curl, tính đến 2026-09-15); shape export/API còn
[Unverified] — đối chiếu docs package khi cài.

- **Plugin Vite:** `@module-federation/vite` (chính chủ, npm latest **1.21.6**) — export `federation` (giả định,
  [Unverified] — xác nhận theo docs), shape `remotes`/`exposes`/`shared`. Biến thể cũ
  `@originjs/vite-plugin-federation` (latest **1.4.1**) có export/option lệch. Nhánh Rspack/webpack dùng
  `@module-federation/enhanced` (latest **2.9.0**). **Version chốt theo release thực tế của dự án khi cài.**
- **Build target:** cần môi trường hỗ trợ top-level await (`build.target: 'esnext'` hoặc tương đương).
- Xem file cấu hình mẫu: [module-federation.host.vite.ts](module-federation.host.vite.ts),
  [module-federation.remote.vite.ts](module-federation.remote.vite.ts).

## Nguồn tham chiếu (URL canonical)

> Ghi chú minh bạch: WebFetch/WebSearch không khả dụng lúc soạn, nên nội dung khái niệm đúc từ kiến thức ổn
> định về các nguồn dưới (URL là địa chỉ canonical, chưa fetch lại HTML trang). Riêng **tên/version package
> đã được xác minh trực tiếp qua npm registry (curl) ngày 2026-09-15**. Chi tiết shape API còn [Unverified] —
> đối chiếu docs khi cài.

- Michael Geers — Micro Frontends: <https://micro-frontends.org/> (các kiểu tích hợp, web components,
  isolation, communication).
- Cam Jackson — "Micro Frontends": <https://martinfowler.com/articles/micro-frontends.html> (định nghĩa,
  server-side/build-time/run-time, cross-app communication, styling isolation).
- Module Federation — <https://module-federation.io/> (host/remote, `exposes`/`remotes`, shared dependencies
  + singleton, runtime).
