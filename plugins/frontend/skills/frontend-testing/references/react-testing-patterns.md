# Patterns test React — Testing Library, hook, msw, snapshot

Tài liệu tham chiếu cho `frontend-testing`, bước 2. Chỉ nêu **idiom + cách đặt test đúng tầng**;
chiến lược chung ở [test-strategy.md](test-strategy.md). Luôn theo `code-convention` + test runner
THẬT của project (bước 0), không áp mặc định của tài liệu này khi repo đã có quy ước khác.

## Bảng đối chiếu nhanh

| Nhu cầu | Công cụ / idiom |
|---|---|
| Test runner | Vitest (`vitest.config.*`) hoặc Jest (`jest.config.*`) — theo project |
| Render component | `render` của `@testing-library/react` |
| Query phần tử | `getByRole` / `getByLabelText` / `getByText` (a11y-first); `findBy*` cho async |
| Tương tác người dùng | `@testing-library/user-event` (`userEvent.setup()`) |
| Assertion DOM | `@testing-library/jest-dom` (`toBeInTheDocument`, `toBeDisabled`, `toHaveTextContent`) |
| Test custom hook | `renderHook` + `act` (`@testing-library/react`) |
| Mock mạng | **msw** (`setupServer` + `http`/`rest` handler) |
| Chờ async | `findBy*`, `waitFor`, `waitForElementToBeRemoved` |
| Fake thời gian | `vi.useFakeTimers()` / `jest.useFakeTimers()` |

## 1. Render + interaction (presentational)

- Render với **props** (dữ liệu giả), không bọc data layer. Query theo **role + accessible name**:
  `screen.getByRole('button', { name: /lưu/i })`, `getByLabelText(/email/i)`. Ưu tiên neo ngữ nghĩa
  người dùng thấy; `getByTestId` chỉ khi không có role/label/text phù hợp.
- Tương tác qua `userEvent` (luôn `await`):
  - `const user = userEvent.setup();` rồi `await user.click(...)`, `await user.type(input, '...')`.
  - Không dùng `fireEvent` thô khi mục tiêu là mô phỏng người dùng (userEvent phát đủ chuỗi sự kiện).
- **Test các state qua props** (đúng checklist template): `loading` (skeleton/spinner hiển thị),
  `empty` (thông báo rỗng), `error` (thông báo lỗi + hành động thử lại), có dữ liệu (danh sách render
  đúng số dòng), `disabled` khi điều kiện chưa thoả.
- Callback: truyền `vi.fn()`/`jest.fn()` làm prop handler, assert `expect(onSelect).toHaveBeenCalledWith(id)`
  sau tương tác — chứng minh presentational **phát sự kiện lên**, không tự xử lý data.

## 2. Custom hook

- `const { result } = renderHook(() => useDisclosure());` rồi `act(() => result.current.open());`
  và assert `result.current.isOpen === true`. Assert giá trị/kết quả trả về, không assert nội bộ.
- Hook bọc **React Query** (`useQuery`/`useMutation`): dựng wrapper `QueryClientProvider` với
  `QueryClient` mới **mỗi test** (tắt retry để test nhanh, tránh giòn), kết hợp msw giả response;
  `renderHook(() => useInvoices(), { wrapper })` rồi `await waitFor(() => expect(result.current.isSuccess).toBe(true))`.
- Hook phụ thuộc thời gian (debounce/interval): dùng fake timer + `act` để tua thời gian có kiểm soát,
  không `sleep` thực.

## 3. Mock mạng bằng msw (KHÔNG mock fetch thủ công)

- Dựng `server = setupServer(...handlers)` một lần; vòng đời chuẩn trong setup test:
  - `beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))` — request quên mock sẽ **đỏ**,
    lộ ngay chỗ chưa giả.
  - `afterEach(() => server.resetHandlers())` — không rò handler override giữa các test (tránh phụ
    thuộc thứ tự).
  - `afterAll(() => server.close())`.
- Handler đặt theo endpoint thật của tầng `api` của domain (`<x>.handlers.ts` cạnh file gọi API): trả body
  giả sát DTO; server dùng chung (`mocks/server.ts`) để rỗng. Ghi đè
  cho từng case bằng `server.use(...)` trong test (ví dụ giả lỗi 500, mạng chậm, body rỗng).
- Vì sao msw thay cho mock `fetch`/`axios` tay: chặn ở **ranh giới mạng** nên test đi qua đúng code
  data layer (api-client, parse, map lỗi) thay vì thay thế nó; một bộ handler dùng lại được cho cả
  test lẫn dev. [giả định] Trong `jsdom`, msw chạy ở tầng request Node, không cần Service Worker
  trình duyệt — kiểm cấu hình `server` (Node) chứ không phải `worker` (browser).

## 4. Test tầng chạm data (integration UI)

- Render container/page thật bọc đủ provider (QueryClient, Router, Theme — tái dùng **custom render**
  helper của project nếu có), msw giả response.
- Assert **luồng người dùng thấy**: ban đầu loading → `await screen.findByText(...)` khi dữ liệu về;
  case lỗi (`server.use` trả 500) → thông báo lỗi hiển thị; empty → thông báo rỗng.
- Sau mutation (submit form): assert UI phản ánh kết quả (toast, điều hướng, danh sách cập nhật),
  không kiểm cache React Query trực tiếp — kiểm qua thứ người dùng thấy. Khi chuỗi có tải lại, điểm assert và ca đối chứng xem mục «AC hiển thị: assert ở cuối chuỗi sự kiện» bên dưới.

### AC hiển thị: assert ở cuối chuỗi sự kiện

Áp khi AC mô tả thứ người dùng thấy (thông báo, nhãn, dòng danh sách) và chuỗi sự kiện có tải lại; gate T7 ở `SKILL.md`.

- **Điểm assert:** sau khi mọi request và lần tải lại của chuỗi đã xong. Chờ bằng `findBy*` trên một thứ hiển thị ở cuối chuỗi (ví dụ nhãn phân trang sau khi tải lại), rồi mới assert thông báo.
- **Không tính:** assert request log, state của hook, mock được gọi hay số lần gọi. Các thứ này vẫn xanh khi thông báo không hiện.
- **Đặt ở đâu:** thêm assertion vào test đã có của AC, ở tầng thấp nhất render được cả nguồn của thông báo lẫn vùng chứa nó (tầng ghép = tầng render cả nguồn của thông báo lẫn vùng chứa nó); không thêm test thứ hai cho AC đã có test ở tầng đó. AC chưa có test ở tầng đó (chỉ có test hook hoặc test trình bày) thì thêm một test cho AC ở tầng ấy; đó là hành vi chưa có test, không phải bản trùng. Chỉ ghi AC vào khoảng trống của báo cáo khi không thêm được test ở tầng ghép.
- **AC không có chuỗi sự kiện** (một thao tác ra kết quả ngay): assert ngay sau thao tác, không giả lập tải lại.

Ví dụ: AC3.5 của trial `aip-frontend-trial` (commit `2587135`). Đoạn trích từ `TicketBoardPage.test.tsx` của trial: `tickets`, `patchStatus` và `seed` khai ở cấp module; handler msw PATCH trả 404 khi `patchStatus === 404`. Thêm vào test tích hợp đã có:

```tsx
tickets = seed(25);
patchStatus = 404;
render(<TicketBoardPage />);
await screen.findByText('1–10 / 25');
await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Đổi trạng thái: Ticket 0' }), 'Xong');

await screen.findByText('1–10 / 24');
expect(screen.getByRole('alert')).toHaveTextContent('Ticket không còn tồn tại. Danh sách đã được tải lại.');
```

Ca đối chứng: test gốc AC3.5 trong `TicketBoardPage.test.tsx` kiểm thứ tự `PATCH` → `GET` và nhãn `1–10 / 24`, không assert thông báo. [Unverified] Theo báo cáo của agent trong trial, test này xanh; chưa chạy lại nguyên bản ở `2587135`. Lý do không bắt được lỗi (đã đọc mã ở `2587135`): hook đặt `errors[id]` rồi gọi `reload`; `TicketList` chỉ vẽ danh sách khi `state.kind === 'ready'`, nên lúc tải lại thông báo nằm trong vùng bị gỡ, và ticket đã xoá không còn dòng để mang lỗi. [Unverified] Test hook và test `TicketItem` có assertion khớp hành vi của tầng đó (đã đọc mã ở `2587135`, chưa chạy lại); chỉ assertion ở tầng ghép thấy được lỗi.

## 5. Snapshot có kiểm soát

- Chỉ snapshot **khối UI nhỏ, shape ổn định** (ví dụ một badge/chip theo trạng thái). Tránh snapshot
  cả trang/cây lớn — dễ bị "update mù" khi vỡ.
- Ưu tiên assert **phần tử/văn bản có ý nghĩa** hơn snapshot toàn khối; snapshot chỉ bổ sung, không
  thay assert hành vi. Khi snapshot đỏ, đọc diff để hiểu *vì sao* trước khi update, không update phản xạ.

## 6. Colocate + đặt tên

- Đặt file test theo `code-convention` của project: colocate `Component.test.tsx` cạnh component,
  hoặc thư mục `__tests__/` — **theo repo**, không tự bịa cây mới. Repo chưa có quy ước → mặc định colocate
  theo mục "Test — vị trí file" của template kiến trúc (`src/testing` · `src/shared/testing` · `packages/testing`).
- Mô tả `describe`/`it` viết **tiếng Việt có dấu**, mô tả **hành vi** ("hiển thị thông báo rỗng khi
  danh sách trống"), không mô tả cài đặt ("gọi setState").
- Tái dùng render helper / factory / msw handler đã có trong repo; không nhân bản setup provider ở
  từng file.
