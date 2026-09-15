# Chiến lược test FE — chọn loại, đặt đúng tầng, tránh test giòn

Tài liệu tham chiếu cho `frontend-testing`. Trung tính runner (Vitest/Jest); idiom cụ thể xem
[react-testing-patterns.md](react-testing-patterns.md). Kiến trúc nền:
`architecture/react-feature-based.template.md`, `react-fsd.template.md` và `react-micro-frontend.template.md`.

## 1. Test pyramid FE — vì sao đáy rộng

Kiến trúc phân tầng tách **UI thuần (presentational)** khỏi **state/data layer**. Hệ quả trực
tiếp cho test: presentational test được **chỉ bằng render + props, không cần bật mạng**, nên phần
đáy kim tự tháp rộng ra.

```
        e2e (rất ít) — vài luồng người dùng đầu-cuối, đắt + dễ giòn (ngoài phạm vi recipe)
     integration UI (ít) — màn hình/feature chạm data, mock mạng bằng msw
  component + hook (nhiều) — presentational render+props, hook logic, không mạng
```

- **Nhiều test component + hook:** nhanh (mili-giây), chạy mỗi lần lưu file, khoanh lỗi sát điểm sai.
- **Ít integration UI:** chậm hơn (dựng provider + msw handler), chỉ dùng khi hành vi cần chứng
  minh là luồng data (loading → success/error, refetch, điều hướng sau mutation).
- **Rất ít e2e:** chỉ cho luồng người dùng giá trị cao **không** chứng minh được ở tầng thấp; nằm
  ngoài phạm vi recipe này.

Chống lộn ngược kim tự tháp: mỗi lần định thêm e2e/integration, hỏi "rủi ro này có test được rẻ và
ổn định hơn ở tầng component/hook không?" — nếu có, hạ xuống tầng đó.

## 2. Đặt test đúng tầng theo kiến trúc

### Feature-Based (feature tự chứa `ui/hooks/api/model`)

| Tầng kiến trúc | Loại test | Bật mạng? | Trọng tâm chứng minh |
|---|---|---|---|
| Presentational (`features/<x>/ui`) | Render + interaction (props) | Không | Hiển thị theo props, các state (loading/empty/error/có dữ liệu), phát callback đúng, a11y cơ bản |
| Hook (`features/<x>/hooks`) | Hook test (`renderHook`) | Không / msw nếu bọc React Query | Giá trị trả về, chuyển trạng thái theo hành động, nhánh logic |
| Container / Page (chạm data) | Integration UI + **msw** | Có (msw giả) | Luồng loading→success/error, truyền data xuống presentational, điều hướng/mutation |
| Data/model (`features/<x>/api` + `model`) | Test hàm map/parse thuần + msw | Có (msw giả) | Map DTO→view model, xử lý lỗi response, header/param request |
| `shared/ui` | Render + props độc lập | Không | UI-kit dùng lại nhiều nơi, đáng phủ kỹ |
| Luồng đầu-cuối | e2e (mỏng) | Toàn bộ | Vài kịch bản giá trị cao (ngoài phạm vi recipe) |

Presentational là lá đồ thị phụ thuộc → test **không cần mock mạng** (đúng checklist template
Feature-Based). Chỉ tầng chạm data mới cần msw.

### FSD (app/pages/widgets/features/entities/shared)

- Test tập trung ở **`features` / `entities`**: UI thuần của slice → render + props; logic/model của
  slice (hook, store slice) → test đơn vị; phần chạm data → msw.
- `shared/ui` → test render + props độc lập, tái dùng nhiều nơi nên đáng phủ kỹ.
- `widgets` / `pages` → integration UI mỏng, mock mạng qua msw; không cross-import slice cùng layer
  trong test (giữ đúng boundary như code).

### Micro-FE (host + remotes, mỗi remote nội bộ FSD)

- Test **trong từng remote** theo bảng FSD ở trên; remote build/test **độc lập** (suite riêng mỗi app).
- Không cross-import ruột remote khác trong test — mock ranh giới cross-remote (module `expose`, event bus
  contract ở `packages/contracts`) như code chạy thật, không với tay vào nội bộ remote khác.
- `packages/ui-kit` test render + props độc lập; `packages/contracts` test shape/map thuần.
- Ghép host↔remote đầu-cuối thuộc e2e (mỏng, ngoài phạm vi recipe).

## 3. Cái gì đáng test (ưu tiên rủi ro)

Đáng test — nơi lỗi hay nấp:
- **Các state hiển thị:** loading, empty, error, có dữ liệu; nhánh điều kiện render (feature flag,
  quyền, role) và fallback.
- **Tương tác người dùng:** click/submit/nhập liệu → thay đổi UI hoặc gọi callback đúng tham số;
  validation form (thông báo lỗi hiển thị), disable nút khi chưa hợp lệ.
- **Logic trong hook:** tính toán, debounce/throttle theo hành vi, chuyển trạng thái, xử lý lỗi từ
  data layer.
- **Ranh giới data:** map DTO→view model, hiển thị đúng khi response rỗng/lỗi/timeout (giả qua msw).
- **A11y cơ bản:** phần tử có role/label truy cập được (query theo role chạy được = tín hiệu tốt).
- Vùng vừa sửa/refactor và hồi quy quanh nó.

Ít/không đáng viết test riêng:
- Markup tĩnh thuần không có nhánh/logic; wrapper mỏng quanh component-lib không thêm hành vi.
- Kịch bản đã được một test tầng thấp hơn phủ chắc (tránh trùng lặp).
- Chi tiết style/pixel (Testing Library không dựng layout thật) — dành cho review mắt / visual test.

## 4. Test hành vi người dùng, không test chi tiết cài đặt

- **Query theo cách người dùng nhìn thấy:** ưu tiên `getByRole` (kèm `name`), `getByLabelText`,
  `getByText`; hạn chế `getByTestId` (chỉ khi không có neo ngữ nghĩa). Không query theo class/cấu
  trúc DOM nội bộ — refactor markup vô hại sẽ làm test đỏ oan.
- **Tương tác bằng `userEvent`** (mô phỏng chuỗi sự kiện thật) thay vì `fireEvent` thô khi test
  hành vi người dùng.
- Assert **kết quả quan sát được** (văn bản/phần tử hiển thị, callback ĐƯỢC gọi với đúng dữ liệu,
  điều hướng xảy ra), không assert state nội bộ component hay số lần render.
- **Không mock chính component đang test.** Mock ở ranh giới mạng (msw), không mock hook con của
  chính cây đang render trừ khi thật sự cần cô lập.

## 5. Tránh test giòn (brittle/flaky)

Test giòn = đỏ vì lý do không liên quan đến hành vi đang test → mất niềm tin vào suite.

| Dấu hiệu giòn | Vì sao hại | Cách tránh (đo được) |
|---|---|---|
| Query theo **class/DOM nội bộ**, cấu trúc cây | Refactor markup vô hại → đỏ | Query theo role/label/text hiển thị |
| Phụ thuộc **timer thực** (`setTimeout`, debounce, animation) | Máy chậm/nhanh → đỏ ngẫu nhiên | Fake timer của runner; `await` theo `findBy*`/`waitFor`, không `sleep` cứng |
| **Không `await`** thao tác bất đồng bộ (userEvent, data load) | Race → đỏ chập chờn | `await userEvent...`, `await findBy*` / `waitFor` cho phần async |
| Gọi **mạng thật** / thiếu handler msw | Mạng lỗi → đỏ; chậm | Chặn mọi request bằng msw; `onUnhandledRequest: 'error'` để lộ request quên mock |
| Phụ thuộc **thứ tự** chạy / state chia sẻ (msw handler, store global) | Đổi thứ tự → đỏ | `server.resetHandlers()` + cleanup sau mỗi test; không dùng singleton mutable dùng chung |
| **Snapshot cây lớn** | Đổi nhỏ → snapshot vỡ hàng loạt, bị "update mù" | Snapshot khối nhỏ ổn định; ưu tiên assert phần tử có ý nghĩa |
| Assert **số lần render / state nội bộ** | Chi tiết cài đặt đổi → đỏ | Assert hành vi/kết quả người dùng thấy |

Khi phát hiện test giòn: sửa **nguyên nhân gốc** (query sai neo, thiếu await, timer thực), không
"chạy lại tới khi xanh" và không nới assert tới mức không còn chứng minh gì.

## 6. Ranh giới của độ phủ

Phần trăm phủ là **chỉ báo vùng CHƯA chạm tới**, không phải bằng chứng đúng: một dòng JSX "được
render qua" chưa nghĩa là hành vi của nó đã được assert. Đọc phủ theo **nhánh + state hiển thị**
(loading/empty/error/có dữ liệu), không chạy theo con số tổng. LUÔN nêu state/nhánh còn hở và
residual risk; độ phủ phản ánh thời điểm chạy với các case đã nghĩ ra, có thể sót. [giả định] Test
render không dựng layout/CSS thật nên không thay được kiểm tra trực quan (visual/pixel).
