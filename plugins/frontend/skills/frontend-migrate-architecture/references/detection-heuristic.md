# Heuristic nhận diện cấu trúc React + ánh xạ file → tầng/slice

## A. Nhận diện cấu trúc hiện trạng (bước 2)

Dò các TÍN HIỆU trong cây `src/` thật (không chỉ tin tài liệu):

| Tín hiệu quan sát | Cấu trúc hiện trạng |
|---|---|
| `src/features/<x>/` hoặc `src/modules/<x>/` mỗi domain tự chứa (ui + hook + api) | Đã theo **feature** — gần **Feature-Based**, thiếu public API/feature-boundary |
| `src/components/`, `src/hooks/`, `src/services/`, `src/utils/` phẳng theo **type** | Theo **type** — chưa nhóm theo domain; đích Feature-Based/FSD gom lại theo feature |
| Component + `fetch()`/`axios` + `useState` lẫn trong một file, ít thư mục | **Phẳng** — chưa phân tầng |
| Có `pages/` + `containers/` + `components/` tách theo type | Cấu trúc **by-type** kiểu cũ — gom về **Feature-Based** theo domain, hoặc FSD nếu cần ranh giới cứng |
| `entities/ features/ widgets/ shared/` + `index.ts` mỗi slice | Đã gần **FSD**, kiểm layer + cross-import |

Đối chiếu **chiều phụ thuộc thật** (đọc import của các file "lá"):
- Component presentational có `import` từ `api`/`store`/`fetch` không? → lẫn presentational với nối-data, cần tách khi gom về feature.
- Feature/slice cùng cấp import ruột lẫn nhau (`features/A` → ruột `features/B`, `entities/X` → `entities/Y`)? → vi phạm Feature-Based (feature↔feature) / FSD (cross-import cùng layer).
- Import sâu vào ruột feature/slice (`features/invoice/api/x`, `entities/invoice/model/x`) thay vì public API `index.ts`? → vi phạm public API.

Đây là input chính cho cột (c) của bảng ánh xạ. Nhánh A: đối chiếu `architecture.md`/ADR; nếu tài liệu lệch
code, BÁO trước khi tiếp.

## B. Quy tắc ánh xạ file → tầng/slice đích (bước 2)

Đối chiếu với blueprint `architecture/react-<feature-based|fsd>.template.md` (Micro-FE là target lập-kế-hoạch
— xem B.3, không có bảng dời-file). **KHÔNG chép cây từ blueprint — dùng bảng dưới để phân loại, blueprint giữ
định nghĩa tầng/slice + luật.**

### B.1 Đích = Feature-Based (react-feature-based.template.md)

| Loại phần tử hiện tại | Slice/segment đích | Ghi chú |
|---|---|---|
| Component thuần (props in / render) | `features/<domain>/ui/` (presentational) | Bỏ mọi `fetch`/store khỏi component khi dời |
| Component "thông minh" nối data vào UI | `features/<domain>/ui/` (container nhẹ) + `hooks/` | Tách phần nối data ra hook; markup ở presentational |
| Hook logic/state tái dùng, bọc React Query | `features/<domain>/hooks/` | Logic/state của feature |
| Gọi API / `fetch` / `axios` / client HTTP | `features/<domain>/api/*.api.ts` + `shared/api` (client base) | Nơi biết HTTP/endpoint của feature |
| Kiểu DTO / view-model / business rule | `features/<domain>/model/*.ts` | Type/view-model của feature, không rò vào presentational |
| Component gắn với route | `pages/<domain>/*Page.tsx` | Mỏng — compose feature |
| Client-state toàn cục (theme, sidebar) | `shared` (store dùng chung) hoặc trong feature | KHÔNG cache server-state ở đây |
| Util thuần / lib config / type chung | `shared/{ui,api,lib,config}` | Không mang nghiệp vụ, không import feature |

> Mỗi `feature` mở ra ngoài qua public API `index.ts`; `feature` KHÔNG import ruột `feature` khác.

### B.2 Đích = FSD (react-fsd.template.md)

| Loại phần tử hiện tại | Layer/segment đích | Ghi chú |
|---|---|---|
| UI-kit / wrapper component-lib / api-client base / helper thuần | `shared/{ui,api,lib,config}` | Không mang nghiệp vụ, không import layer trên |
| Thực thể nghiệp vụ (kiểu domain + thẻ hiển thị + API đọc) | `entities/<x>/{model,ui,api}` + `index.ts` | "Danh từ" nghiệp vụ; API đọc `useQuery` |
| Hành động người dùng (1 use case: tạo/sửa) | `features/<x>/{ui,model,api}` + `index.ts` | "Động từ"; `useMutation` + validation |
| Khối UI ghép lớn, tái dùng nhiều page | `widgets/<x>/{ui,model}` + `index.ts` | Ghép entity/feature, không phải 1 use case đơn |
| Component gắn với route | `pages/<x>/ui/*Page.tsx` + `index.ts` | Compose widgets/features/entities |
| Providers / router / style toàn cục | `app/{providers,routes}` | Khởi tạo app, không nghiệp vụ |

Phân loại mỗi phần tử vào một trong ba cột hành động:
- **(a) DỜI:** đã đúng tinh thần, chỉ sai vị trí → đổi thư mục + cập nhật import/alias.
- **(b) TÁCH/GOM:** cần gom về feature/slice, thêm public API `index.ts`, hoặc tách phần nối-data (hook/
  container) khỏi presentational (Feature-Based/FSD).
- **(c) VI PHẠM:** ranh giới sai (presentational gọi API, import ruột feature/slice cùng cấp, import sâu qua
  public API) → phải cắt trước khi coi là đạt.

### B.3 Đích = Micro-Frontend (react-micro-frontend.template.md) — KẾ HOẠCH, KHÔNG auto-move

Micro-FE là **tách app + build/deploy độc lập**, không phải dời file trong một `src/`. KHÔNG lập bảng dời-file
theo lô như B.1/B.2. Thay vào đó lập **bản đồ phân rã** (bàn giao cho con người thực hiện):

| Đơn vị hiện tại | Đích trong hệ Micro-FE | Ghi chú |
|---|---|---|
| Một domain/nhóm slice tự chủ, một team sở hữu | `apps/<remote>` (build/deploy riêng) | Bên trong remote tổ chức theo **FSD** |
| Routing gốc + auth/session + layout khung | `apps/host` (shell) | Host khai `remotes`, không chứa nghiệp vụ |
| UI-kit / design-system dùng chung | `packages/ui-kit` | Không mang nghiệp vụ chéo remote |
| Type/DTO hợp đồng + event bus | `packages/contracts` | Ranh giới type giữa các remote |
| Feature-flags / env / route runtime | `packages/shared-config` | Cấu hình chia sẻ |
| Module một remote công khai ra ngoài | `expose` của remote | Nơi DUY NHẤT remote khác được dùng |

Ranh giới ép bằng **federation config** (React singleton shared, remote chỉ dùng nhau qua `expose` + `packages/*`),
không bằng linter dời-file. Bước tiền đề khuyến nghị: đưa mỗi remote về **FSD sạch** trong monolith (dùng B.2)
TRƯỚC, rồi mới tách ra app riêng theo bản đồ này.

## C. Xử lý import alias khi dời (bước 4)

- Ưu tiên **alias tuyệt đối** (`@/...`) hơn đường dẫn tương đối sâu — dời file ít vỡ import hơn.
- Chưa có alias → cân nhắc thêm `paths` trong `tsconfig.json` + `resolve.alias` của Vite TRƯỚC khi dời nhiều
  (một bước riêng, XANH, rồi mới dời) — đây là hạ tầng, không đổi hành vi.
- Dời theo lô nhỏ: mỗi lô cập nhật đường dẫn import trỏ tới vị trí mới; giữ barrel/re-export cũ TẠM để file
  chưa dời vẫn build XANH, dọn ở CỔNG G5.

## D. Thứ tự thực thi gợi ý (bước 4)

- **Feature-Based:** `shared` trước → từng `features/<domain>` (dời `ui`/`hooks`/`api`/`model` của feature,
  dựng public API `index.ts`) → `pages` compose sau. Tách `fetch` khỏi presentational sớm để cắt vi phạm (c).
- **FSD:** dưới lên: `shared` → `entities` → `features` → `widgets` → `pages`. Dựng public API `index.ts`
  cho slice trước khi để nơi khác import qua nó.
- **Micro-FE:** không áp thứ tự dời-file — theo bản đồ phân rã B.3 (đưa từng remote về FSD sạch trong monolith
  trước, rồi tách app).

Luôn giữ mỗi lô `tsc` + test XANH; cho phép barrel tạm giữ cả đường cũ lẫn mới. Ưu tiên lô giảm được nhiều
vi phạm ranh giới nhất và nêu lý do.
