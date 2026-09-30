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

## 3. Đề xuất mặc định khi chưa có codegen

`openapi-typescript` chỉ sinh **type**; hook và `api-client` vẫn viết mỏng theo template kiến trúc. Ví dụ script
(đường dẫn đích theo bảng mục 4):

```json
"scripts": {
  "api:types": "openapi-typescript docs/contracts/openapi.json -o src/lib/api/generated/schema.d.ts"
}
```

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
