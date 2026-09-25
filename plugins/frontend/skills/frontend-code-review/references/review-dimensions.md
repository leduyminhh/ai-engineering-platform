# Trục review + severity — dấu hiệu cụ thể cho frontend

Tài liệu tham chiếu cho `frontend-code-review`. Trung tính stack ở phần nguyên tắc; dấu hiệu cụ thể minh
hoạ bằng React + TypeScript (TanStack Query, Testing Library). Blueprint kiến trúc + luật boundary:
`architecture/react-feature-based.template.md`, `architecture/react-fsd.template.md` và
`architecture/react-micro-frontend.template.md`. Đọc soát phần **trong
scope** theo từng trục dưới; mỗi phát hiện phải quy về một `file:line` cụ thể — không có evidence thì không
dựng finding.

## Trục 1 — Correctness

Nơi lỗi hay nấp trong React; đây là trục ưu tiên. Dấu hiệu:

- **State & render:** đọc state ngay sau `setState` mong giá trị mới (state là snapshot, cập nhật bất đồng
  bộ); cập nhật state dựa state cũ mà không dùng dạng hàm `setX(prev => …)` (mất update khi gộp batch); giữ
  dữ liệu dẫn xuất trong `useState` rồi tự đồng bộ thay vì tính trong render; đổi state trực tiếp (mutate
  mảng/object rồi `setX(same ref)` → không re-render).
- **useEffect / dependency array:** thiếu phụ thuộc (dùng biến/prop trong effect nhưng không khai) → **stale
  closure** đọc giá trị cũ; thừa phụ thuộc gây chạy lại/loop; effect dùng cho thứ **không phải** side-effect
  (tính toán lẽ ra để trong render/`useMemo`); thiếu cleanup (subscribe/`setInterval`/listener không huỷ);
  set state trong effect vô điều kiện gây vòng lặp render.
- **Race giữa request:** hai request async trả về không đúng thứ tự ghi đè nhau (response cũ đến sau đè
  mới); effect fetch không **abort/ignore** khi deps đổi hoặc unmount (set state trên component đã tháo);
  double-submit form do không khoá khi đang gửi.
- **`key` của list:** dùng **index** làm `key` cho list có thể chèn/xoá/sắp lại (mất trạng thái/nhầm dòng);
  `key` không ổn định (random mỗi render); trùng `key`.
- **Memo hoá sai:** `useMemo`/`useCallback`/`React.memo` cho thứ rẻ (phức tạp vô ích) **hoặc** thiếu khi
  truyền callback/object mới mỗi render xuống child đã `memo` (memo vô hiệu); deps của `useMemo`/`useCallback`
  thiếu/thừa như effect.
- **Loading / error / empty:** thiếu xử lý một trong ba trạng thái của dữ liệu async (chỉ vẽ khi có data →
  crash/nháy khi loading, nuốt lỗi khi fail, trống trơn khi rỗng); render khi `data` còn `undefined`.
- **Logic sai:** điều kiện đảo, so sánh nhầm kiểu, sai định dạng số/tiền/ngày/timezone, `0`/chuỗi rỗng lọt
  vào `&&` render ra `0`, ép kiểu `any` che lỗi TypeScript.
- **Form & controlled input:** controlled/uncontrolled lẫn lộn (value `undefined`→`defined`); không kiểm tra
  đầu vào trước khi gửi; mất dữ liệu khi validate lỗi.

## Trục 2 — Thiết kế & bám boundary

Đối chiếu blueprint kiến trúc đã chọn. Phần lớn lỗi thiết kế lộ ở **ranh giới tầng** — soát import ở đầu
file trước.

### Nếu kiến trúc là **Feature-Based** (`react-feature-based.template.md`)
- **Feature tự chứa:** mã một domain phải nằm gọn trong `features/<domain>/` (`components/hooks/api/types`);
  logic domain rò ra `app/routes`/nhóm dùng chung là vi phạm (business rule tái dùng đẩy vào `types`/`utils`
  của feature).
- **KHÔNG cross-import ruột feature:** `features/A` **import** file nội bộ của `features/B`
  (`features/customers/hooks/...`) → vi phạm; liên kết phải hạ phần chung xuống nhóm dùng chung (phẳng gốc
  `src/`) hoặc **compose ở `app/routes`**. Nếu project có `eslint-plugin-boundaries` mà lọt, nghi luật chưa
  bao đủ.
- **Qua public API:** import **sâu** vào ruột feature (`features/invoices/hooks/useInvoices`) thay vì
  `@/features/invoices` (public API `index.ts`).
- **Presentational thuần trong `components`:** component trong `features/<x>/components` gọi
  `fetch`/`axios`/React Query trực tiếp, hoặc giữ store? → vi phạm (presentational phải props-in/events-out;
  data qua `hooks`/`api`).
- **HTTP tập trung:** `fetch`/`axios`/endpoint xuất hiện **ngoài** `features/<x>/api` (qua
  `lib/api-client.ts`); UI thấy URL/HTTP.
- **Nhóm dùng chung không mang nghiệp vụ:** `components/hooks/lib/stores/config/types/utils` (phẳng gốc
  `src/`) import ngược lên `features`/`app`, hoặc chứa logic domain.
- **Server-state = React Query:** copy `data` của React Query vào `useState` rồi tự `useEffect` đồng bộ
  (nguồn sự thật đôi → lệch); tự quản cache/refetch bằng `useEffect` thủ công.

### Nếu kiến trúc là **FSD** (`react-fsd.template.md`)
- **Chỉ import xuống:** module import **ngược** layer (`entities` import `features`, `shared` import
  `entities`); thứ tự đúng là `app > pages > widgets > features > entities > shared`.
- **Không cross-import cùng layer:** `features/A` import `features/B`, `entities/X` import `entities/Y` →
  vi phạm; liên kết phải hạ xuống layer dưới hoặc ghép ở page/widget.
- **Qua public API:** import **sâu** vào segment nội bộ (`entities/invoice/model/store`) thay vì
  `@/entities/invoice` (public API `index.ts`).
- **Segment đúng vai:** đặt request trong `ui/`, hoặc component trong `api/`; trộn "danh từ" (entity) và
  "động từ" (feature).
- **Server-state:** như Feature-Based — React Query ở segment `api`, không copy vào `useState`.

### Nếu kiến trúc là **Micro-Frontend** (`react-micro-frontend.template.md`)
- **Nội bộ remote theo FSD:** cấu trúc trong `apps/<remote>/src` phải bám luật FSD ở trên (layer/slice/
  segment + public API); soát ruột remote như một app FSD.
- **KHÔNG cross-import remote:** `apps/invoices` **import** file nội bộ của `apps/customers` → vi phạm;
  liên kết cross-remote chỉ qua module `expose` (host ghép) hoặc event bus contract ở `packages/contracts`.
- **`packages/*` không nghiệp vụ chéo:** type/logic riêng của một remote lọt vào `packages/*` (ui-kit/
  contracts/shared-config) → biến shared thành coupling chéo.
- **React singleton:** thiếu `singleton: true` cho `react`/`react-dom` trong federation config → nhiều bản
  React, hook/context vỡ.
- **Host thuần điều phối:** shell (`apps/host`) ôm nghiệp vụ của remote thay vì chỉ routing/layout/session.

> Khi kiến trúc project **không** khớp hoàn toàn các blueprint (biến thể riêng), chỉ soát các luật áp dụng
> được và bám `project-knowledge/architecture.md`; KHÔNG ép Feature-Based/FSD/Micro-FE lên project đã chọn kiểu khác.

## Trục 3 — Đơn giản hoá & tái dùng

- **Trùng lặp:** cùng một khối UI/logic lặp ở nhiều component (copy-paste); nên gom thành component/hook
  chung nếu là **cùng một lý do thay đổi** (tránh gom nhầm hai thứ tình cờ giống nhau).
- **Over-engineering:** trừu tượng/generic/context/pattern thừa cho nhu cầu hiện tại; wrapper không thêm
  giá trị; state global cho thứ chỉ dùng cục bộ.
- **Prop drilling:** truyền props qua nhiều tầng trung gian không dùng tới → cân nhắc composition
  (children)/context, nhưng không lạm dụng context cho thứ cục bộ.
- **Đặt logic đúng tầng (altitude):** business rule nằm trong presentational thay vì hook/container/model;
  fetch leo lên component hiển thị; helper kỹ thuật lẫn vào tầng UI domain.
- **Chết & thừa:** component/biến/prop không dùng, nhánh không bao giờ render, import thừa, comment lạc hậu.

## Trục 4 — A11y (khả năng tiếp cận)

Soát ở mức **đọc được từ diff tĩnh** (JSX/thuộc tính); phần cần runtime (đo tương phản thực tế, đọc màn
hình) ghi là suspected/cần kiểm.

- **Role & tên có nghĩa:** nút icon-only thiếu `aria-label`; `<img>` thiếu `alt` (hoặc `alt=""` khi ảnh
  mang thông tin); dùng `<div onClick>` thay cho `<button>`/`<a>` (mất role + bàn phím).
- **Label ↔ input:** input không gắn `<label htmlFor>` / `aria-labelledby`; placeholder dùng thay label.
- **Bàn phím:** phần tử tương tác không focusable (không phải nút/link, thiếu `tabIndex`); handler chỉ có
  `onClick` mà không hỗ trợ Enter/Space cho phần tử tuỳ biến; bẫy focus thiếu trong modal (Escape đóng,
  Tab quẩn trong modal).
- **Quản lý focus:** modal/dialog mở không chuyển focus vào, đóng không trả focus về; đổi route không thông
  báo/không đưa focus hợp lý.
- **Tương phản & trạng thái:** chỉ dùng **màu** để truyền trạng thái (lỗi/thành công) không kèm text/icon;
  tương phản chữ/nền thấp (đối chiếu design-system — nếu không đo được thì suspected).
- **ARIA đúng:** `aria-*` sai thuộc tính/giá trị, hoặc lạm dụng `role` che mất semantic gốc.

## Trục 5 — Readability & naming

Đối chiếu **`code-convention` của project** (không áp gu cá nhân — convention là việc của tài liệu convention):

- Tên theo quy ước kiến trúc: trang `*Page`, container `*Container`, hook `use*`, API `*.api.ts`, kiểu DTO
  `*Dto`, view model `*VM`, store `*.store.ts`; component PascalCase, hook/util camelCase; slice/segment
  kebab-case (FSD).
- Component/hook quá dài, quá nhiều props, JSX lồng sâu nhiều cấp → khó đọc; tách component con hợp lý;
  magic number/string không đặt tên.
- Kiểu TypeScript: lạm dụng `any`/ép `as` che lỗi; props type lỏng; export type/interface không nhất quán.
- Comment giải thích **vì sao** (bất biến, cạm bẫy), không kể lại **cái gì** JSX đã nói; comment lạc hậu.
- Định dạng/lint lệch chuẩn project (nếu có ESLint/Prettier, chỉ nhắc nếu là finding thật, không soi vụn).

## Trục 6 — Test coverage

- Component/hook **mới hoặc đã sửa** có test hành vi (render + interaction bằng Testing Library, query theo
  role/accessible, `userEvent`) cho nhánh mới không? Case biên (loading/error/empty, input rỗng/không hợp lệ)
  đã phủ?
- Gọi mạng được mock bằng **msw** (không mock `fetch` thủ công rải rác)?
- Thiếu test cho code **có rủi ro thật** = một finding (severity theo mức rủi ro), không phải đòi 100% phủ.
- Test kèm PR có **giòn** không (phụ thuộc timer/thứ tự/DOM nội bộ; query theo `data-testid`/class thay vì
  role; assert chi tiết cài đặt)? Sâu về chiến lược test → route `frontend-testing`.

## Severity — thang phân loại + evidence

| Severity | Nghĩa | Ví dụ |
|---|---|---|
| **blocker** | Sai/hỏng chắc chắn hoặc rủi ro nghiêm trọng; không nên merge khi chưa xử | Bug correctness proven (crash khi loading, race ghi đè dữ liệu, mất update state), rò ranh giới kiến trúc lõi, phần tử tương tác hoàn toàn không dùng được bằng bàn phím trên luồng chính |
| **major** | Vấn đề thật, tác động rõ nhưng có đường lách/không chặn ngay | Thiếu xử lý error/empty vùng quan trọng, presentational fetch trực tiếp, server-state copy vào `useState`, thiếu test cho nhánh rủi ro, nút icon-only thiếu nhãn a11y |
| **minor** | Nên sửa, tác động hạn chế | Trùng lặp vừa, prop drilling một-hai tầng, memo hoá thừa, naming lệch convention, `key` index ở list ít biến động |
| **nit** | Gu/đánh bóng, không bắt buộc | Định dạng vụn, tên cải thiện nhẹ, comment thừa, import chưa gọn |

Quy tắc gắn evidence + severity:

- **Mỗi finding phải có `file:line`** (đường dẫn tương đối + số dòng trong diff/file). Không có vị trí cụ
  thể → không dựng finding.
- **Rationale nêu tác động thật;** với correctness/a11y, viết **kịch bản tương tác→hành vi sai** (proven).
  Chỉ "có mùi/có thể" → nhãn **suspected**, KHÔNG nâng lên blocker.
- **Không thổi phồng:** một suspected không tái hiện được thì để minor/nit + nhãn suspected, để người quyết.
- **Đề xuất fix** nêu hướng sửa gọn; READ-ONLY mặc định nên KHÔNG viết code thay trừ khi người dùng yêu cầu.
