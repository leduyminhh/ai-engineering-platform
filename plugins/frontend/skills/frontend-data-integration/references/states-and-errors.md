# Trạng thái và lỗi — loading / error / empty / success

Tài liệu tham chiếu cho `frontend-data-integration`, cổng I4–I5.

## 1. Bốn trạng thái bắt buộc

| Trạng thái | Điều kiện (TanStack Query) | Presentational hiển thị |
|---|---|---|
| loading | chưa có dữ liệu và đang tải (`isPending` ở v5; `isLoading` ở v4) | skeleton/spinner theo `design-system.md` |
| error | `error` khác rỗng | thông báo lỗi đã map (mục 2) + nút thử lại (`refetch`) |
| empty | thành công và danh sách rỗng | thông báo rỗng, không phải lỗi |
| success | thành công và có dữ liệu | dữ liệu đã map sang view model |

Tên cờ theo phiên bản: v5 đổi `isLoading` thành `isPending` cho trạng thái chưa có dữ liệu, còn `isLoading` mới là
`isPending && isFetching`:
https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5 — đọc phiên bản thật của project.

"Empty" là **thành công với danh sách rỗng**, không phải mã 404, trừ khi contract nói khác cho endpoint đó.

## 2. Map lỗi

`api-client` nên ném một lỗi có kiểu (mang `status`, và `code` / `message` nếu contract có schema lỗi). Chưa có →
đề xuất thêm vào `api-client` và HỎI, không tự sửa client dùng chung.

| Mã | Hiển thị / hành động | Ghi chú |
|---|---|---|
| 401 | Gọi callback do app/host cung cấp (vd `onUnauthorized`) hoặc trả lỗi kiểu `unauthenticated` cho container | **Không** quyết định nơi lưu token hay luồng refresh (ngoài phạm vi skill) |
| 4xx khác | Hiển thị `message` theo schema lỗi của contract; lỗi theo trường thì đổ vào form | Không có schema lỗi trong contract → dùng thông báo chung và ghi vào `remaining_risks` |
| 5xx / mất mạng | Thông báo chung + nút thử lại | Không hiển thị stack hay chi tiết máy chủ |

Container đổi lỗi này thành `props` (`error`, `onRetry`); presentational không biết `status`.

## 3. Test bằng msw (qua `frontend-testing`)

Handler đặt cạnh phần gọi API của slice: `features/<x>/api/<x>.handlers.ts` (FSD: `entities/<x>/api/…`), server dùng
chung ở `testing/mocks/server.ts` để rỗng (xem `architecture/references/testing-toolchain.md`). Mỗi container có ít
nhất:

| Test | Handler | Kỳ vọng |
|---|---|---|
| loading → success | trả danh sách mẫu | thấy trạng thái tải rồi thấy dữ liệu (`findBy*`) |
| lỗi 500 | `server.use(...)` trả 500 | thấy thông báo lỗi + nút thử lại |
| rỗng | trả `[]` | thấy thông báo rỗng |

Không mock `fetch`/`axios` thủ công; không kiểm cache React Query trực tiếp — kiểm qua thứ người dùng thấy.
