---
name: frontend-data-integration
description: "Recipe on-demand: NỐI UI React đã dựng (presentational từ frontend-implement) với API THẬT theo contract OpenAPI ở docs/contracts/ — type sinh từ contract, data hook đúng tầng kiến trúc bằng TanStack Query, nối ở container/page (KHÔNG sửa presentational), đủ loading/error/empty/success, map DTO sang view model ở biên, map lỗi 401/4xx/5xx, test bằng msw. Lệch contract thì DỪNG và báo drift. KHÔNG quyết định lưu token/auth, KHÔNG thêm global store hay thư viện data khi chưa hỏi. Dùng skill NÀY khi người dùng muốn \"nối API\", \"gọi API cho màn hình\", \"tích hợp API vào React\", \"data hook\", \"sinh type từ OpenAPI\", \"nối data cho component\", \"thay mock bằng API thật\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần trên project đã chạy frontend-init và đã có contract. Không dùng khi contract API chưa chốt → backend-api-contract; dựng UI từ thiết kế → frontend-implement."
order: 7
title: "Frontend Data Integration — Nối UI với API theo contract OpenAPI (recipe on-demand)"
runsIn: execute
invoke: per-request
sharedAssets: templates/architecture
---

# Frontend Data Integration — Nối UI với API theo contract (recipe on-demand)

Nối một UI đã dựng với API thật, lấy **contract OpenAPI** ở `docs/contracts/` làm nguồn sự thật giữa frontend và
backend. Skill này là **hướng dẫn cách agent làm** (docs-only recipe), KHÔNG phải công cụ codegen hay bộ code dựng
sẵn. Recipe on-demand, gọi khi cần — không thuộc chuỗi bắt buộc.

Phân công với skill anh em: `frontend-implement` dựng component presentational + tương tác cơ bản và để chỗ trống
bằng `props` + `TODO`; skill này lấp chỗ trống đó bằng dữ liệu thật ở **container/page**; `frontend-testing` viết
test (msw); `backend-api-contract` chốt và kiểm drift contract.

## Tiền đề

- Project **đã chạy `frontend-init`** (có `project-knowledge/`: `architecture.md`, `code-convention.md`,
  `tech-stack.yml`) và đã có component cần nối. Thiếu → đề nghị chạy `frontend-init` / `frontend-implement` trước.
- Contract OpenAPI đã có ở `docs/contracts/` (thường `openapi.json`). Chưa có → xem cổng I1.
- Mọi bối cảnh nằm trong FILE. Con người giữ chốt: **chọn công cụ ở I2** và **duyệt diff trước khi commit**.

## Ranh giới an toàn (CLAUDE.md)

- KHÔNG sửa file trong `docs/contracts/`; contract lệch code hoặc thiếu endpoint → DỪNG, báo drift, chuyển
  `backend-api-contract`.
- KHÔNG viết tay type trùng với contract; KHÔNG gọi `fetch` / `axios` trực tiếp trong component.
- KHÔNG sửa component presentational ngoài việc thay chỗ `TODO` bằng props đã có sẵn kiểu; nối dữ liệu ở
  container/page.
- KHÔNG tự cài dependency (codegen, thư viện data, global store); đề xuất và HỎI. Thư viện data mới → ADR
  (`engineering-adr`).
- KHÔNG quyết định nơi lưu token hay luồng auth/refresh; chỉ map lỗi 401 thành trạng thái UI hoặc lỗi hook trả ra.
- KHÔNG thêm e2e (thuộc `frontend-e2e-testing`).
- Làm trên branch riêng (không `main`/`master`/`dev`/`develop`); dừng cho người duyệt diff trước khi commit
  (1 task = 1 commit).

**Ngôn ngữ (bắt buộc):** mọi đầu ra hướng người dùng — bảng dò công cụ, kế hoạch, báo cáo, comment trong code
sinh ra — viết **tiếng Việt CÓ DẤU** (UTF-8). Báo cáo bằng số đo được (lệnh đã chạy, exit code, số endpoint đã
nối); không dùng "đảm bảo / an toàn tuyệt đối"; luôn nêu rủi ro còn lại.

## Quy trình

### 0. Nạp context (BẮT BUỘC — đọc TRƯỚC khi viết)

- Đọc `project-knowledge/`: `architecture.md` (Feature-Based / FSD / Micro-FE), `code-convention.md`,
  `tech-stack.yml`.
- Đối chiếu blueprint kiến trúc ship kèm ở `architecture/react-<feature-based|fsd|micro-frontend>.template.md` để
  biết tầng/slice và import boundary. Bảng đặt file: [references/data-layer-by-architecture.md](references/data-layer-by-architecture.md).
- Dò **stack thật** từ `package.json` và config: thư viện data (TanStack Query / SWR / RTK Query), codegen
  (openapi-typescript / orval / openapi-generator), `api-client` sẵn có (`lib/api-client.ts` hoặc `shared/api`),
  msw. Ghi lại phiên bản TanStack Query thật (chữ ký `useQuery` khác nhau giữa v4 và v5).
- Đọc các component được giao và liệt kê chỗ `TODO` / props còn thiếu dữ liệu do `frontend-implement` để lại.

### I1. Contract

Đọc contract ở `docs/contracts/`: xác nhận mọi endpoint cần dùng có trong `paths` và schema trong
`components.schemas`. Tìm bằng chứng contract đã qua drift-check gần nhất (report của `backend-api-contract` hoặc
`workflow-api`); không có bằng chứng → HỎI người dùng, không tự suy. Chi tiết:
[references/contract-and-codegen.md](references/contract-and-codegen.md).

**Đỏ khi:** chưa có contract, thiếu endpoint/schema cần dùng, hoặc đang drift → DỪNG, đề xuất `workflow-api` /
`backend-api-contract`.

### I2. Công cụ ⏸

Trình bảng "đã có / chưa có" cho: codegen, thư viện data, `api-client`, msw. Cái nào **đã có thì dùng lại**. Chưa
có codegen → đề xuất `openapi-typescript` (chỉ sinh type, giữ hook viết mỏng theo template; hành vi công cụ gắn
`[Unverified]`) và HỎI. DỪNG chờ người dùng chọn; chưa được cài gì trước khi có câu trả lời.

**Đỏ khi:** thư viện data mới → cần ADR trước khi dùng.

### I3. Không viết tay

- Type sinh từ contract đặt ở tầng shared (`lib/api/generated/` hoặc `shared/api/generated/`); mỗi `*.dto.ts` của
  feature chỉ là type alias chọn từ schema đã sinh, không viết lại tay.
- Mọi HTTP đi qua `api-client` của project; hook đặt đúng segment `api` theo kiến trúc; DTO → view model map ở
  biên (không map trong component).
- Kiểm: `grep -rnE "fetch\(|axios" src --include=*.tsx` trong thư mục component/container → 0 kết quả.

**Đỏ khi:** còn type viết tay trùng contract hoặc component gọi HTTP trực tiếp → sửa.

### I4. Trạng thái

Mỗi màn hình có đủ **loading / error / empty / success**; map lỗi 401 / 4xx / 5xx theo
[references/states-and-errors.md](references/states-and-errors.md). Container chuyển kết quả hook thành props cho
presentational; presentational không biết đến hook hay HTTP.

**Đỏ khi:** thiếu một trạng thái hoặc lỗi bị nuốt → bổ sung.

### I5. Xanh

- `tsc --noEmit`, lint (gồm `eslint-plugin-boundaries` / Steiger của kiến trúc), build phải xanh.
- Test bằng msw theo skill `frontend-testing`: mỗi container có test cho loading → success, lỗi 500 và trạng thái
  rỗng. Handler đặt theo endpoint thật ở segment `api` của slice.
- Con người **duyệt diff** trước khi commit.

**Đỏ khi:** một lệnh đỏ → sửa trong đúng phạm vi; không nới test để qua.

## Report trả về

```yaml
result:
  summary: "<1–3 câu>"
  changes: { added: [], modified: [] }     # theo tầng: type sinh, api hook, container
  wiring:                                  # endpoint ↔ hook ↔ container
    - endpoint: "GET /invoices"
      hook: "useInvoices"
      container: "InvoiceListContainer"
  validation:
    - command: "<lệnh>"
      exit_code: 0
      status: passed       # passed | failed | not_run
      summary: "<số liệu>"
      reason: ""
  remaining_risks: []
  next_actions: []
```

## Rủi ro còn lại (luôn nêu)

- Test msw dựng từ contract; nếu BE thật khác contract, lỗi chỉ lộ ở tích hợp thật hoặc e2e.
- Công cụ codegen và TanStack Query có hành vi theo phiên bản; đối chiếu phiên bản thật của project.
- Kit chưa được pilot trên project React thật.
