---
name: frontend-testing
description: "Recipe on-demand: chiến lược và viết TEST cho một FRONTEND React/TypeScript project BÁM kiến trúc UI đã chọn (Feature-Based/FSD/Micro-FE) — render + interaction test bằng Testing Library (query theo role/accessible, dùng userEvent), test custom hook, mock mạng bằng msw (KHÔNG mock fetch thủ công), snapshot có kiểm soát, characterization khi đụng code cũ. Test theo hành vi người dùng, tránh test chi tiết cài đặt/giòn (phụ thuộc timer/thứ tự/DOM nội bộ). Dùng skill NÀY khi người dùng muốn \"test frontend\", \"test React\", \"unit test component\", \"test hook\", \"React Testing Library\", \"mock API msw\", \"test coverage FE\", \"kiểm thử giao diện\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã có mã nguồn."
order: 3
stageNumber: "03"
title: "Frontend Testing — Chiến lược và viết test React bám kiến trúc (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
sharedAssets: templates/architecture
next: null
---

# Frontend Testing — Chiến lược và viết test React bám kiến trúc (recipe on-demand)

Recipe hướng dẫn agent **chọn loại test, đặt test đúng tầng, và viết test** cho một FRONTEND
React/TypeScript project sao cho test **bám KIẾN TRÚC UI đã chọn** (Feature-Based / FSD / Micro-FE) và
`code-convention` của project. KHÔNG nằm trong chuỗi bắt buộc; gọi khi cần. Đây là **docs-only
recipe** — hướng dẫn cách agent viết/chạy test, KHÔNG phải bộ test dựng sẵn hay công cụ codegen.

Nguyên tắc trục: kiến trúc phân tầng tách **UI thuần (presentational)** khỏi **state/data layer**,
nên **test presentational không cần bật mạng** (render + props, nhanh, nhiều), còn tầng chạm dữ
liệu mới cần **mock mạng bằng msw** — xem `architecture/react-feature-based.template.md` mục "Presentational
trong `ui` ... test được bằng render + props". Test **hành vi người dùng nhìn thấy**, không test chi tiết cài đặt.

## Ranh giới an toàn (CLAUDE.md)
- Test bám **kiến trúc UI đã chốt** (`project-knowledge/architecture.md` — Feature-Based / FSD / Micro-FE) +
  `design-system.md` + `code-convention.md` của project; KHÔNG áp phong cách test lạ với repo.
- **KHÔNG gọi API thật trong test:** chặn tầng mạng ở ranh giới bằng **msw** (mock Service Worker),
  KHÔNG mock `fetch`/`axios` thủ công rải rác và KHÔNG trỏ test vào backend staging/production.
- Không đổi hành vi UI để "cho test xanh"; nếu test lộ bug thật (a11y, luồng lỗi) → BÁO, để người
  quyết sửa code hay sửa kỳ vọng.
- Mỗi task = 1 commit, DỪNG cho người **duyệt diff** trước khi commit; không push thẳng main.
- **Ngôn ngữ (bắt buộc):** mọi đầu ra hướng người dùng — mô tả `describe/it`, bảng phủ, báo cáo,
  commit message, comment trong file test — viết **tiếng Việt CÓ DẤU** (UTF-8). Comment chỉ giải
  thích *vì sao* (bất biến, cạm bẫy dễ tái phạm), không kể lại *cái gì* code đã nói.
- **Ngôn ngữ đo được:** báo cáo bằng số đếm được (số test, nhánh/state đã phủ, lệnh + kết quả
  THẬT). KHÔNG dùng "đảm bảo / loại bỏ / chặn triệt để / test hết"; LUÔN nêu khoảng trống còn lại
  và residual risk. Độ phủ phản ánh thời điểm chạy, có thể sót đường đi chưa nghĩ tới.

## Quy trình

### 0. Nạp context + dò stack, test runner, lệnh test — BẮT BUỘC trước khi viết
- Đọc `project-knowledge/`: **kiến trúc UI đã chọn** (`architecture.md` — Feature-Based / FSD / Micro-FE),
  `design-system.md`, `component-map.md`, `code-convention.md`, `tech-stack.yml` để biết ranh
  giới tầng/slice, quy ước đặt tên và idiom test hiện có.
- Dò **stack test + lệnh chạy** từ chính project, không đoán:
  - Test runner: **Vitest** (`vitest.config.*`, script `test`) hay **Jest** (`jest.config.*`);
    lệnh thường là `npm test` / `npm run test` (đọc `package.json` `scripts`).
  - Thư viện render: **React Testing Library** (`@testing-library/react`, `@testing-library/user-event`,
    `@testing-library/jest-dom`); mock mạng: **msw** (`msw`, thư mục handler đã có?).
  - Môi trường DOM: `jsdom` / `happy-dom` (khai trong config runner).
- Đọc **test đã có** để tái dùng render helper / custom render (bọc provider: QueryClient, Router,
  Theme) / factory / msw handler thay vì dựng mới trùng lặp.
- Thiếu test runner/lệnh test/msw setup → BÁO (fail-loud), đề nghị người xác nhận thay vì tự chế khung.

### 1. Chiến lược test — đặt đúng tầng
Xác định **hành vi người dùng cần test + mức rủi ro**, rồi chọn **loại test hẹp nhất chứng minh
được rủi ro đó** theo test pyramid và ánh xạ tầng-kiến-trúc. Chi tiết + ma trận chọn loại:
[references/test-strategy.md](references/test-strategy.md).
- **Feature-Based:** presentational (`features/<x>/ui`) → render + interaction test bằng props, KHÔNG mạng;
  hook/logic (`features/<x>/hooks`) → hook test; container/page chạm data → test với **msw** giả response.
  `shared/ui` test render + props độc lập.
- **FSD:** test theo slice — `entities`/`features` (UI + logic của slice) là nơi tập trung; UI
  thuần trong slice test render + props; slice chạm data mock mạng qua msw. `shared/ui` test độc lập.
- **Micro-FE:** test **trong từng remote** theo FSD (như trên) — remote build/test độc lập; không cross-import
  ruột remote khác trong test (giữ đúng boundary như code). `packages/ui-kit` test render + props độc lập.
- **e2e (Playwright/Cypress) mỏng:** chỉ vài luồng người dùng giá trị cao đầu-cuối, **ngoài phạm
  vi recipe này**; không dồn e2e cho thứ tầng component/hook phủ được rẻ và ổn định hơn.
- Ưu tiên **hành vi người dùng** (thấy gì, bấm gì, kết quả gì) hơn chi tiết cài đặt; ưu tiên nhánh
  chính + các state hiển thị (loading / empty / error / có dữ liệu).

### 2. Viết test theo tầng (patterns)
Đặt file test đúng cấu trúc `code-convention` của project (colocate cạnh component `*.test.tsx`
hay thư mục `__tests__` — theo repo, không tự bịa). Idiom cụ thể + ví dụ:
[references/react-testing-patterns.md](references/react-testing-patterns.md).
- **Presentational (render + interaction):** render với props, **query theo role/label/text hiển
  thị** (`getByRole`, `getByLabelText`) — a11y-first, tránh `data-testid` trừ khi không có lựa chọn
  ngữ nghĩa; tương tác bằng **`userEvent`** (không `fireEvent` thô khi mô phỏng người dùng). Test các
  **state qua props**: loading / empty / error / có dữ liệu, trạng thái disabled/hover khi có ý nghĩa.
- **Custom hook:** test bằng `renderHook` + `act`; assert giá trị trả về và chuyển trạng thái theo
  hành động, không assert nội bộ. Hook bọc React Query → dựng `QueryClientProvider` + msw cho data.
- **Tầng chạm data:** chặn mạng bằng **msw** (khai `server` với handler cho endpoint), test luồng
  loading → success/error qua UI. KHÔNG mock `fetch` thủ công; KHÔNG copy cache React Query ra ngoài.
- **Snapshot có kiểm soát:** chỉ dùng cho khối UI nhỏ, shape ổn định; ưu tiên assert đúng phần tử/
  văn bản có ý nghĩa để test không vỡ vì thay đổi markup vô hại. Tránh snapshot cả cây lớn.

### 3. Characterization khi đụng code cũ / ít test
Trước khi refactor/migrate màn hình cũ chưa có test bao quanh, **viết characterization test khóa
hành vi HIỆN TẠI** (render màn hình + interaction chính qua điểm vào người dùng, chốt phần tử hiển
thị + kết quả tương tác quan sát được), xác nhận XANH trên code cũ để làm lưới an toàn hồi quy.
Quy trình + cạm bẫy (msw ghi lại response thật, cố định thời gian/ngẫu nhiên):
[references/characterization.md](references/characterization.md). Các test này ở lại repo làm tài sản.

### 4. Chạy + đo độ phủ, đánh giá chất lượng test — CỔNG
Chạy đúng lệnh test đã dò ở bước 0, ghi **lệnh + kết quả THẬT** (số pass/fail). Nếu project có đo
phủ (`vitest --coverage` / `jest --coverage`), chạy và đọc theo **nhánh + state hiển thị chính**,
không chạy theo con số phần trăm tổng.
- **Test phải đo được là tốt, không chỉ "chạy được":** phủ nhánh hành vi chính + state biên
  (empty/error); **không phụ thuộc thứ tự chạy**, không phụ thuộc timer thực/mạng thật/DOM nội bộ;
  assert hành vi người dùng chứ không phải chi tiết cài đặt. Dấu hiệu **test giòn** + cách tránh:
  [references/test-strategy.md](references/test-strategy.md) mục "Tránh test giòn".
- Nêu rõ **khoảng trống còn lại** (state/nhánh chưa phủ, phần bỏ qua vì thiếu handler msw) và
  **residual risk**; KHÔNG tuyên bố đã phủ hết.

## Bảng gate
| # | Gate | Bước | Đỏ thì |
|---|------|------|--------|
| T1 | Đã dò stack test + runner + lệnh test + msw setup THẬT từ project | 0 | DỪNG, hỏi người dùng, không tự chế khung |
| T2 | Test đặt đúng tầng theo kiến trúc (presentational render-no-net / data qua msw) | 1–2 | Xếp lại tầng trước khi viết thêm |
| T3 | Query theo role/accessible + userEvent; mạng qua msw, không mock fetch tay | 2 | Sửa cách query/mock trước khi kết luận |
| T4 | Characterization khóa hành vi màn hình cũ XANH TRƯỚC khi refactor | 3 | Chưa dám refactor sâu vùng đó |
| T5 | Suite chạy được, ghi lệnh + kết quả thật, không phụ thuộc thứ tự/timer thực | 4 | Sửa test giòn / báo trước khi kết luận |
| T6 | 1 task = 1 commit, DỪNG duyệt diff, không push main | Xuyên suốt | — |

## Ranh giới
- **Docs-only:** hướng dẫn cách viết/chạy test; không phải bộ test dựng sẵn hay codegen.
- Test bám **boundary kiến trúc** + `code-convention` + `design-system` của project; không áp idiom lạ.
- **Mock mạng qua msw**, không gọi API thật, không mock `fetch`/`axios` thủ công rải rác.
- Ngôn ngữ đo được; con người **duyệt diff** trước khi commit. e2e đầy đủ nằm ngoài phạm vi recipe này.

## Sau khi xong
Tóm tắt: test đã thêm (số + tầng), lệnh chạy + kết quả THẬT, nhánh/state đã phủ, **khoảng trống +
residual risk** còn lại. Con người **duyệt diff** trước khi commit; tự push nhánh + mở PR. Nếu gặp
ràng buộc mâu thuẫn (runner ngoài Vitest/Jest chưa có idiom trong references, thiếu msw, hoặc không
có điểm vào rõ để characterization), DỪNG và BÁO thay vì tự đi chệch.
