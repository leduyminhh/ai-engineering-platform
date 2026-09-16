# ARD — Kiến trúc giao diện cho frontend

> Architecture Reference Document — **khái niệm + cách chọn kiến trúc UI dùng chung cho mọi app React/TypeScript**.
> Đây là tài liệu **SELECTOR**: đánh giá dự án trước, rồi chọn mức kiến trúc đơn giản nhất thoả nhu cầu. Mục
> 1–4 và 6–7 là NGUYÊN TẮC chung; mục minh hoạ bám domain `invoices` (đồng bộ với các template cạnh đây).
>
> Chi tiết cấu trúc (cây thư mục annotated + ranh giới + quy ước tên, **không** code skeleton) của từng kiến
> trúc nằm ở file template cạnh đây — ARD này **không lặp lại** phần đó:
>
> - **Feature-Based** — nhóm mã theo domain, ranh giới mềm. **Mặc định của kit** (nhỏ/vừa, một team). → [react-feature-based.template.md](react-feature-based.template.md)
> - **FSD (Feature-Sliced Design)** — layer/slice/segment + public API, ranh giới cứng. Chọn khi lớn/nhiều domain. → [react-fsd.template.md](react-fsd.template.md)
> - **Micro-Frontend** — host + remotes (Module Federation), deploy độc lập; **mỗi remote nội bộ = FSD**. Chọn khi đa team. → [react-micro-frontend.template.md](react-micro-frontend.template.md)

## 1. Quy tắc nền — phụ thuộc chỉ trỏ xuống

Tất cả xoay quanh một quy tắc: **mã nguồn phụ thuộc chỉ được trỏ *xuống dưới***, về phía các tầng/module hạ
tầng ít nghiệp vụ hơn. Đơn vị ở tầng trên biết đơn vị ở tầng dưới; **không bao giờ ngược lại**, và **không
cross-import ngang hàng**.

Cụ thể trong React/TypeScript:

- Module trình bày (presentational) **không** tự `fetch`/không giữ store — nhận dữ liệu qua props, đẩy sự
  kiện qua callback.
- Giao tiếp giữa các đơn vị cùng cấp (feature ↔ feature, slice ↔ slice, remote ↔ remote) đi qua **public
  API / module expose**, **không** import sâu vào ruột nhau.
- Frontend **không có compiler cô lập module** như Maven của backend (không có `pom` chặn dependency ở mức
  biên dịch). Ranh giới phải **ép bằng lint**: `eslint-plugin-boundaries` cho chiều import; `steiger` (linter
  FSD chính thức) cho layer/slice/public-API của FSD; **federation config** (shared singleton + module
  expose) cho Micro-Frontend.

> **Quy tắc vàng:** Xoá một feature/slice/remote không được làm vỡ cái khác. Nếu đổi một đơn vị buộc phải
> sửa ruột đơn vị cùng cấp, ranh giới đang bị rò — đó là thước đo duy nhất để biết có làm đúng hay không.

## 2. Các khối kiến thức

### Component-driven UI

Giao diện dựng từ các **component** ghép lại: presentational (thuần UI — props in / events out, không biết
nguồn dữ liệu) tách khỏi phần **nối dữ liệu/state** (container/hook). Server-state (dữ liệu từ API: cache,
refetch, loading/error) do **React Query (TanStack Query)** quản, **không** copy vào `useState` thủ công.
Nguyên tắc này áp cho cả ba kiến trúc — chỉ khác nhau ở *cách nhóm* và *độ cứng ranh giới*.

### Separation-by-feature — nhóm theo domain

Thay vì gom theo *loại kỹ thuật* toàn cục (`components/`, `hooks/`, `services/` rải mọi domain), nhóm mã
**theo vùng nghiệp vụ** (`features/invoices`, `features/customers`): mỗi feature tự chứa UI + hook + gọi API
của chính nó. Đổi/xoá một domain gói gọn trong một thư mục; đây là bậc đơn giản nhất của "kiến trúc theo
tính năng" — **Feature-Based**. Ranh giới mềm: chưa tách "thực thể" khỏi "hành động", chưa ép public API
cứng, chỉ cấm cross-import ruột feature bằng lint. Chuẩn tham chiếu là **bulletproof-react**: `src/` phẳng
(top-level `app`, `features`, `components`, `hooks`, `lib`, `stores`, `config`… — dùng chung KHÔNG gói trong
`shared/`), và **unidirectional codebase** `shared → features → app` ép bằng `import/no-restricted-paths`
(chi tiết: [react-feature-based.template.md](react-feature-based.template.md)).

### FSD methodology — Feature-Sliced Design

Phương pháp chuẩn cho app lớn, áp **3 trục** phân rã:

- **Layer** (dọc, cố định): `app > pages > widgets > features > entities > shared`. Module chỉ import từ
  layer **thấp hơn** mình.
- **Slice** (ngang, theo domain): trong mỗi layer chia theo vùng nghiệp vụ; **slice cùng layer KHÔNG import
  nhau**.
- **Segment** (trong slice): `ui` (component), `model` (store/type/logic), `api` (request + React Query),
  `lib` (helper), `config` (hằng số).

Tách rõ **entities** (danh từ nghiệp vụ — invoice *là gì*) khỏi **features** (động từ — *tạo* invoice). Mọi
truy cập qua **public API `index.ts`** của slice (cấm import sâu; cấm `export *`). Liên kết entity↔entity đi
qua quy ước **cross-import `@x`** (`entities/<a>/@x/<b>`), không import thẳng ruột nhau. Layer `processes` đã
**deprecated** ở spec hiện hành. Ép bằng `steiger` (linter FSD chính thức) + `eslint-plugin-boundaries`.

### Micro-frontend / Module Federation

Chia một hệ thống lớn thành nhiều app **build & deploy độc lập**: một **host** (shell — routing gốc, layout,
auth/session) nạp các **remote** tại runtime qua **Module Federation**. Mỗi remote `expose` module công khai;
host khai `remotes`. Điểm cốt tử: **React (và các deps nền) là singleton chia sẻ** — tránh nhân bản nhiều bản
React gây vỡ hook/context. Contract & UI-kit chia sẻ đặt ở `packages/*`. Mỗi remote **nội bộ tổ chức theo
FSD**; ranh giới cross-app: remote **không** import nội bộ remote khác, chỉ qua module `expose` + `packages/*`.
Module Federation chỉ là **một** trong phổ tích hợp (build-time npm package · server-side composition · web
components · import maps · run-time Module Federation) — bảng so sánh + lý do chọn run-time MF ở
[references/integration-patterns.md](references/integration-patterns.md).

## 3. So sánh 3 kiến trúc

| Tiêu chí | Feature-Based | FSD | Micro-Frontend |
|----------|---------------|-----|----------------|
| Đơn vị chia | Feature (thư mục domain) | Layer × Slice × Segment | App độc lập (host + remotes) |
| Ranh giới cứng tới đâu | Mềm — cấm cross-import ruột feature | Cứng — luật layer + no cross-import cùng layer + public API bắt buộc | Rất cứng — biên process/build/deploy, chỉ qua module expose |
| Boundary tooling | `eslint-plugin-boundaries` | `steiger` (chính) + `eslint-plugin-boundaries` | federation config (shared singleton/expose) + `eslint-plugin-boundaries` mỗi app |
| Khi nào mạnh nhất | App một team, ít–vừa domain, muốn đơn giản-đủ-dùng | App lớn, nhiều domain, một–vài team cùng repo, cần chống spaghetti | Nhiều team tự chủ, mỗi mảng release theo nhịp riêng |
| Rủi ro dễ mắc | Feature phình / cross-import lén khi thiếu lint; chưa tách entity vs feature | Over-engineer khi app còn nhỏ; nhầm entity ↔ feature; import sâu bỏ public API | Nhân bản React/deps; version lệch giữa remote; hạ tầng federation phức tạp |
| Quy mô phù hợp | Nhỏ / vừa | Lớn | Rất lớn, đa team |
| Chuẩn tham chiếu | bulletproof-react | feature-sliced.design (+ Steiger) | Module Federation / micro-frontends.org |

**Điểm chung cả ba:** phụ thuộc chỉ trỏ xuống · giao tiếp qua public API/module expose · không cross-import
ngang hàng · server-state ở React Query, không ở `useState` · ranh giới ép bằng lint (không có compiler cô
lập). Ba mức là **thang độ liên tục**: Micro-FE dùng FSD *bên trong mỗi remote*; FSD là Feature-Based được
siết ranh giới và bổ sung entities/widgets.

## 4. Chọn kiến trúc nào (SELECTOR)

| Đặc điểm dự án | Lựa chọn | Template |
|----------------|----------|----------|
| App nhỏ/vừa, một team, ít–vừa domain | **Feature-Based** — mọi thứ phức tạp hơn là over-engineer | `react-feature-based` |
| App lớn, nhiều domain, cần ranh giới cứng chống spaghetti khi scale | **FSD** | `react-fsd` |
| Nhiều team tự chủ **+ deploy độc lập** từng mảng | **Micro-Frontend** (mỗi remote nội bộ FSD) | `react-micro-frontend` |

> **Cảnh báo — cái bẫy phổ biến nhất:** chọn kiến trúc phức tạp hơn nhu cầu. FSD cho một app 5 màn hình, hay
> Micro-Frontend cho một team, chỉ thêm nghi thức mà không đổi lại giá trị. Kiến trúc là để **phù hợp**, không
> phải để "trông xịn". Bắt đầu ở mức đơn giản nhất; chỉ leo thang khi có **tín hiệu thật**.

**Tín hiệu nâng cấp** (leo dần khi có tín hiệu, không nhảy cóc):

- *Feature-Based → FSD:* số domain tăng, xuất hiện coupling chéo feature khó kiểm soát; cần phân biệt rõ
  **thực thể** dùng lại (invoice) khỏi **hành động** (tạo/thanh toán invoice); nhiều lập trình viên đụng cùng
  vùng, muốn ranh giới ép bằng công cụ (public API + `steiger`) thay vì review tay.
- *FSD → Micro-Frontend:* nhiều team muốn **release theo nhịp riêng**, không muốn chung một pipeline build/deploy;
  một app đơn khối trở nên quá lớn để build/test/deploy chung; cần cô lập lỗi & tự chủ công nghệ theo mảng.
- *Tín hiệu KHÔNG nên leo:* app còn một team, build nhanh, ít domain → Micro-FE là gánh nặng hạ tầng thuần
  tuý; đừng thêm layer/slice của FSD khi Feature-Based còn gọn.

**Quy trình chọn (cho lead):** liệt kê số domain / số team / có cần deploy độc lập từng mảng / độ lớn build →
đối chiếu bảng, chọn mức đơn giản nhất thoả mãn → ghi **ADR** (`docs/decisions/`) kèm tín hiệu nâng cấp →
scaffold từ template tương ứng.

## 5. Quy ước chung + boundary tooling (cả ba)

Vì frontend không có compiler cô lập module, ranh giới là **fitness function** chạy trong CI — vi phạm là
**fail lint/build**, không phải góp ý review:

| Kiến trúc | Công cụ ép ranh giới | Ép cái gì |
|-----------|----------------------|-----------|
| Feature-Based | `eslint-plugin-boundaries` | feature ↔ feature disallow; mọi tầng → `shared` allow; `app → pages → features` |
| FSD | `steiger` (chính) + `eslint-plugin-boundaries` (bổ trợ luật layer) | thứ tự layer, no cross-import cùng layer, public API `index.ts`, segment |
| Micro-Frontend | federation config (React singleton + `shared` + module `expose`) + `eslint-plugin-boundaries` mỗi app | remote không import ruột remote khác; chỉ qua module expose + `packages/*`; deps nền singleton |

Quy ước chung mọi kiến trúc:

- **Stack nền:** React 18+ · TypeScript · Vite · Tailwind + component library (shadcn/MUI/antd — đọc
  `package.json`/`design-system.md`). Data-fetching: **TanStack Query (React Query)**.
- **Server-state** ở React Query (`useQuery`/`useMutation`), đặt tại segment/tầng `api` của đơn vị sở hữu dữ
  liệu; **client-state** (theme, UI flag) ở store riêng; **UI-state cục bộ** dùng `useState` trong component.
  KHÔNG copy cache API sang `useState`.
- **Public API là hợp đồng:** mỗi feature/slice/remote lộ ra ngoài đúng phần công khai (`index.ts` cho
  slice/feature; module `expose` cho remote); đổi nội bộ tự do, giữ mặt công khai ổn định.
- **Đặt tên:** thư mục domain/slice/segment kebab-case; component PascalCase; hook `use*`; alias
  `@/<đơn-vị>/...`.
- **Chi tiết cấu trúc** (cây thư mục, cấu hình lint khởi điểm, ranh giới state) nằm ở từng template:
  [react-feature-based.template.md](react-feature-based.template.md) ·
  [react-fsd.template.md](react-fsd.template.md) ·
  [react-micro-frontend.template.md](react-micro-frontend.template.md).
- **Artifact ép ranh giới copy-paste được** (`references/`): Feature-Based →
  [eslint-boundaries.feature-based.jsonc](references/eslint-boundaries.feature-based.jsonc) +
  [feature-public-api.md](references/feature-public-api.md); FSD →
  [steiger.config.js](references/steiger.config.js) +
  [eslint-boundaries.fsd.jsonc](references/eslint-boundaries.fsd.jsonc); Micro-FE →
  [module-federation.host.vite.ts](references/module-federation.host.vite.ts) +
  [module-federation.remote.vite.ts](references/module-federation.remote.vite.ts) +
  [integration-patterns.md](references/integration-patterns.md).

## 6. Checklist review PR

Dán vào mô tả review. **Một mục fail nghĩa là ranh giới kiến trúc đang bị rò.** Ưu tiên soát nhóm "Ranh giới
import" trước (rò ranh giới là lỗi đắt nhất); mục nào máy đã bắt được (`eslint-plugin-boundaries`/`steiger`/
federation) thì để CI chặn, checklist giữ phần máy không bắt được.

**Ranh giới import**

- [ ] Phụ thuộc chỉ trỏ **xuống**? Không có import ngược (đơn vị dưới biết đơn vị trên).
- [ ] **Không cross-import ngang hàng** (feature ↔ feature / slice ↔ slice / remote ↔ remote)? Liên kết đi
  qua tầng dưới, `shared`/`packages/*`, hoặc ghép ở tầng trên (page/host).
- [ ] Truy cập qua **public API / module expose**, không import sâu vào ruột đơn vị khác?
- [ ] `presentational` không tự `fetch`/không giữ store — chỉ props in / events out?

**Server-state (React Query)**

- [ ] Dữ liệu từ API quản bằng `useQuery`/`useMutation`, **không** copy vào `useState`/`useEffect` thủ công?
- [ ] Gọi HTTP tập trung ở tầng/segment `api` (qua `api-client` của `shared`), không rải trong `ui`?
- [ ] Có phân biệt server-state (React Query) với client-state (store) — không trộn cache API vào store?

**Public API & ranh giới đơn vị**

- [ ] Feature/slice/remote lộ đúng phần công khai; ruột nội bộ không bị import từ ngoài?
- [ ] (FSD) Đặt đúng chỗ **entity (danh từ)** vs **feature (động từ)**; layer đúng thứ tự?
- [ ] (Micro-FE) React/deps nền là **singleton** chia sẻ; contract chia sẻ ở `packages/*`, không nhân bản?

**Naming & convention**

- [ ] Đặt tên theo quy ước template (`*Page`/`use*`/`*.api`/slice kebab-case, component PascalCase)?
- [ ] Styling tái dùng `shared/ui` (wrapper component-lib) + Tailwind trước khi tự dựng?

## 7. Sinh example minh hoạ khi init (frontend-init)

Khi `frontend-init` đã chốt kiến trúc và scaffold cây `src/` theo template đã chọn, init **SINH một example
tối giản CHẠY ĐƯỢC** minh hoạ đúng structure đã chốt. **KHÔNG có "example template" lưu sẵn để copy** — Claude
ĐỌC blueprint (chính file template đã chọn) và tự sinh theo domain THẬT của dự án. Blueprint là nguồn chỉ
dẫn: **annotation cạnh mỗi thư mục/segment trong "Cây thư mục" nói rõ vai trò** (presentational, container/
hook, api segment, entity, feature, public API, module expose…) — mỗi folder AI đọc-hiểu và điền đúng loại
file cho use case đang sinh.

Hợp đồng sinh (mọi kiến trúc):

- **Một use case duy nhất, xuyên suốt mọi tầng** của kiến trúc đã chọn — một **vertical slice** tối giản:
  trang/route → phần nối dữ liệu (container/hook) → gọi API + React Query (tầng/segment `api`) →
  presentational thuần → public API của đơn vị. Đặt file theo **đúng cây thư mục** của template đã chọn, không
  bỏ tầng, không gộp tầng.
  - *Feature-Based:* một `features/<domain>` với `ui` (presentational + form) + `api` (`useQuery`/`useMutation`)
    + `model` (type/logic) + `index.ts`; trang ở `pages` compose feature đó.
  - *FSD:* một slice `entities/<x>` (model + card + `api` đọc) + một `features/<hành-động>` (form + `api`
    mutation) + `pages/<route>` compose; mỗi slice có `index.ts` (public API).
  - *Micro-Frontend:* một `apps/<remote>` (nội bộ FSD, `expose` một trang/route) + `apps/host` khai `remotes`
    nạp nó; một contract dùng chung ở `packages/contracts`, UI-kit ở `packages/ui-kit`.
- **Domain THẬT của dự án** — KHÔNG dùng `invoices`/`Invoice` của blueprint (đó chỉ minh hoạ cấu trúc). Nếu
  domain chưa rõ lúc init: hỏi nhanh MỘT domain + MỘT use case tiêu biểu rồi sinh theo đó.
- **Một file tối thiểu cho mỗi thư mục/segment mà use case đi qua**, đúng vai trò annotation của folder đó
  trong cây template.
- **Server-state qua React Query** (không `useState` giữ cache); presentational thuần (không fetch/không store);
  gọi HTTP qua `api-client` của `shared`.
- **Giữ ranh giới:** đúng chiều phụ thuộc + quy ước đặt tên của template; qua được block ép ranh giới template
  khai (`eslint-plugin-boundaries` / `steiger` / federation config) và một render/interaction test lõi bằng
  Testing Library (query theo role, `userEvent`; mock mạng bằng msw nếu chạm API).
- **Tối giản, không phình:** một domain, một use case, một–hai component, một hook, một hàm API. KHÔNG sinh
  nhiều feature — nghiệp vụ thật viết ở bước implement sau.
- **Đánh dấu rõ là EXAMPLE** (comment đầu file hoặc tên thư mục ví dụ) để dễ thay bằng nghiệp vụ thật.

Đây là bản minh hoạ *structure*, KHÔNG phải nghiệp vụ thật của dự án — bổ sung/thay ở giai đoạn implement.

## 8. Nguồn tham chiếu

Chuẩn pattern mỗi kiến trúc bám theo (URL canonical):

- **Feature-Based** — bulletproof-react (Alan Alickovic): <https://github.com/alan2207/bulletproof-react>
  (project-structure, unidirectional codebase, `import/no-restricted-paths`).
- **FSD** — Feature-Sliced Design: <https://feature-sliced.design> (layer/slice/segment, public API, cross-import
  `@x`); Steiger (linter chính thức): <https://github.com/feature-sliced/steiger>.
- **Micro-Frontend** — Michael Geers: <https://micro-frontends.org>; Cam Jackson (Martin Fowler):
  <https://martinfowler.com/articles/micro-frontends.html>; Module Federation: <https://module-federation.io>.
  Package đã xác minh trên npm (2026-09-15): `@module-federation/vite`@1.21.6, `@module-federation/enhanced`@2.9.0,
  `@originjs/vite-plugin-federation`@1.4.1.
- **Chung** — TanStack Query (server-state): <https://tanstack.com/query>; `eslint-plugin-boundaries` /
  `steiger` là **fitness function** ranh giới (tương đương ArchUnit/import-linter của backend).

> Grounding: bulletproof-react và feature-sliced.design được fetch trực tiếp (raw docs) khi soạn; tên/version
> package Micro-FE xác minh qua npm registry. Trang docs của micro-frontends.org / martinfowler / module-federation.io
> là URL canonical (nội dung khái niệm ổn định); shape API cụ thể còn [Unverified] — đối chiếu docs khi cài.
