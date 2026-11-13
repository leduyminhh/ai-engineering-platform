# Contract và codegen — từ OpenAPI sang type dùng trong React

Tài liệu tham chiếu cho `frontend-data-integration`, cổng I1–I3. Contract là nguồn sự thật FE↔BE; frontend **không
sửa** contract, chỉ đọc và sinh type từ nó.

## 1. Đọc contract

Contract nằm ở `docs/contracts/` (thường `openapi.json`, do `backend-api-contract` chốt). Với mỗi màn hình cần nối,
lập bảng:

| Endpoint (method + path) | Có trong `paths`? | Schema request / response (`components.schemas`) | Schema lỗi | Ghi chú |
|---|---|---|---|---|
| `GET /invoices` | ✓ / ✗ | `InvoiceList` | `Problem` | phân trang? |

Thiếu endpoint hoặc schema → DỪNG (cổng I1), không tự thêm vào contract và không tự đoán hình dạng dữ liệu.

## 2. Dò codegen sẵn có (cổng I2)

| Dấu hiệu trong project | Hành động |
|---|---|
| `openapi-typescript` trong `package.json` | Dùng lại script hiện có (tìm trong `scripts`) |
| `orval` (có `orval.config.*`) | Dùng lại; client và hook do orval sinh là nguồn, không viết hook thứ hai song song |
| `openapi-generator` (có `openapitools.json` hoặc script tương ứng) | Dùng lại |
| Không có gì | Đề xuất mục 3 và HỎI người dùng; không tự cài |

## 2a. Kiểm tương thích công cụ (trước khi đề xuất hoặc chốt)

Áp cho mọi công cụ codegen ứng viên (`openapi-typescript`, `orval`, `openapi-generator`), kể cả công cụ do người dùng
nêu tên, và chạy **trước G1** khi công cụ được chốt ở tài liệu (`workflow-feature` Bước 3), không đợi tới task `FE-INT`.
Gắn `[Unverified]` cho mỗi hành vi công cụ chưa kiểm bằng lệnh.

1. **Đọc khai báo** (không ghi gì): `npm view <gói>@<phiên bản> peerDependencies engines --json`. So `peerDependencies`
   (vd `typescript`) và `engines.node` với phiên bản TypeScript trong `package.json` và lockfile, và với `node --version`.
2. **Chạy thử bộ giải của npm** (không ghi vào project): sao chép `package.json` (và lockfile nếu có) sang một thư mục
   tạm rồi chạy `npm install --dry-run --ignore-scripts <gói>@<phiên bản>` ở đó. `ERESOLVE` (exit code khác 0) nghĩa là
   peer xung đột với phiên bản trong project. Project dùng package manager khác npm: vẫn đọc khai báo bằng bước 1, còn
   phần chạy thử gắn `[Unverified]`. Không chạy được lệnh (không mạng, registry lỗi): giữ `[Unverified]` kèm lý do và nêu
   ở G1 như rủi ro chặn hướng; không chặn việc làm rõ hay viết tài liệu.
3. **Ghi kết quả** vào ADR của công cụ: lệnh đã chạy, `peerDependencies`/`engines` đã đọc, phiên bản TypeScript/Node của
   project, kết luận. Request không có ADR cho công cụ thì ghi vào `design.md` (hoặc `requirement.md` cỡ thay đổi nhỏ),
   mục rủi ro/giả định.

Xung đột thì **dừng và để người dùng chọn** (ở G1 nếu còn trước G1, không để lộ ở Task 1):

| Phương án | Cách làm | Hệ quả |
|---|---|---|
| Ghim công cụ bằng `npx` | `npx --yes -p typescript@<x.y.z> -p <gói>@<x.y.z> <lệnh>` trong script `api:types`; không thêm dependency vào `package.json` | `tsc` của project vẫn kiểm file type sinh ra; phiên bản ghim phải đủ `x.y.z`, không dùng `latest`, `^` hay dải |
| Đổi công cụ hoặc phiên bản công cụ | Chọn bản có peer/`engines` khớp project, kiểm lại bằng bước 1–2 | Đổi ADR nếu đã có |
| Hạ TypeScript hoặc Node của project | Ngoài phạm vi của skill này | Chỉ nêu như hệ quả, không tự làm |

## 3. Đề xuất mặc định khi chưa có codegen

`openapi-typescript` chỉ sinh **type**; hook và `api-client` vẫn viết mỏng theo template kiến trúc. Chỉ đề xuất sau khi
mục 2a không báo xung đột. Ví dụ script (đường dẫn đích theo bảng mục 4; thay `<x.y.z>` bằng phiên bản đã kiểm ở mục 2a):

```json
"scripts": {
  "api:types": "npx --yes openapi-typescript@<x.y.z> docs/contracts/openapi.json -o src/lib/api/generated/schema.d.ts"
}
```

Dạng trên ghim đúng một phiên bản bằng `npx`, không thêm dependency vào `package.json`. Nếu mục 2a báo xung đột peer
`typescript`, thêm `-p typescript@<x.y.z>` (`npx --yes -p typescript@<x.y.z> -p openapi-typescript@<x.y.z> openapi-typescript …`).
Project đã cài `openapi-typescript` trong `package.json` thì dùng lại script sẵn có (mục 2).

Đối chiếu tài liệu chính thức (bản mới nhất, không phải phiên bản cài trong project): CLI nhận file schema cục bộ
và ghi ra file qua `-o`, file sinh ra xuất `paths` và `components`, và tham chiếu schema bằng
`components['schemas']['<Tên>']` — https://openapi-ts.dev/introduction và https://openapi-ts.dev/cli. Đổi thư viện
data hoặc thêm codegen là thay đổi dependency: hỏi trước; thư viện data mới cần ADR (`engineering-adr`).

## 4. Nơi đặt type sinh

Type sinh nằm ở tầng shared, không nằm trong từng feature:

| Kiến trúc | Thư mục file sinh |
|---|---|
| Feature-Based | `src/lib/api/generated/` |
| FSD | `src/shared/api/generated/` |
| Micro-FE | `src/shared/api/generated/` **trong remote sở hữu miền** (không đặt ở `packages/contracts`) |

File sinh không sửa tay. Có commit file sinh hay không là quy ước của project — hỏi và ghi vào
`project-knowledge/tech-stack.yml`.

## 5. `*.dto.ts` là alias, không viết lại

```ts
// features/invoices/api/invoice.dto.ts (FSD: entities/invoice/api/invoice.dto.ts)
import type { components } from '@/lib/api/generated/schema';

export type InvoiceDto = components['schemas']['Invoice'];
```

View model (`types/invoice.ts`) và hàm map (`utils/to-invoice.ts`) vẫn do feature sở hữu; chỉ DTO thô đến từ contract.

## 6. Khi contract đổi

Sinh lại type rồi chạy `tsc --noEmit`: chỗ đỏ là chỗ frontend lệch contract mới. Sửa **code frontend** theo contract;
không sửa file sinh và không sửa contract để "cho qua". Contract đổi theo hướng breaking → báo người dùng, đề xuất
`backend-api-contract`.
