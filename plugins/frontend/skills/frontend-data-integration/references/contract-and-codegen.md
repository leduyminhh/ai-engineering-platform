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

Áp cho mọi công cụ codegen ứng viên (`openapi-typescript`, `orval`, `@openapitools/openapi-generator-cli`), kể cả công cụ do người dùng
nêu tên, và chạy **trước G1** khi công cụ được chốt ở tài liệu (`workflow-feature` Bước 3), không đợi tới task `FE-INT`.
Gắn `[Unverified]` cho mỗi hành vi công cụ chưa kiểm bằng lệnh.

1. **Đọc khai báo** (không ghi gì): `npm view <gói>@<phiên bản> peerDependencies engines --json`. So `peerDependencies`
   (vd `typescript`) và `engines.node` với phiên bản TypeScript trong `package.json` và lockfile, và với `node --version`.
2. **Chạy thử bộ giải của npm** (không ghi vào project): tạo một thư mục tạm ngoài project, chép **chỉ** `package.json`
   (và lockfile nếu có) vào đó; không chép `.npmrc`, `.yarnrc*`, `.env` hay file nào khác chứa token hoặc thông tin đăng
   nhập registry. Chạy `npm install --dry-run --ignore-scripts <gói>@<phiên bản>` ở thư mục tạm. Đọc kết quả:
   - `ERESOLVE` (exit code khác 0): peer xung đột với phiên bản trong project.
   - Exit code khác 0 với mã lỗi khác (vd `E404`; `E401` chưa kiểm bằng lệnh, `[Unverified]`): không chạy được, không
     phải kết luận về peer.
   - `package.json` có `workspaces` hoặc dependency trỏ vào đường dẫn cục bộ (`file:`, `link:`): bản sao không chứa các
     thư mục đó nên cây phụ thuộc khác project dù exit code là 0; coi như không chạy được.
   - `EBADENGINE`: chỉ là cảnh báo, không đổi exit code; kết luận về `engines` lấy từ lệnh `npm view` ở bước 1,
     còn stderr của dry-run chỉ để đối chiếu.

   Không chạy được (exit code khác 0 với mã lỗi khác `ERESOLVE`, ca `workspaces`/`file:`/`link:`, không mạng, registry lỗi): giữ `[Unverified]` kèm lý do và nêu ở G1 như rủi ro chặn
   hướng; không chặn việc làm rõ hay viết tài liệu. Project dùng package manager khác npm: vẫn đọc khai báo bằng bước 1,
   còn phần chạy thử gắn `[Unverified]`.
3. **Ghi kết quả** vào ADR của công cụ: lệnh đã chạy, `peerDependencies`/`engines` đã đọc, phiên bản TypeScript/Node của
   project, kết luận. Request không có ADR cho công cụ thì ghi vào `design.md` (hoặc `requirement.md` cỡ thay đổi nhỏ),
   mục rủi ro/giả định.

Xung đột thì **dừng và để người dùng chọn** (ở G1 nếu còn trước G1, không để lộ ở Task 1):

| Phương án | Cách làm | Hệ quả |
|---|---|---|
| Ghim công cụ bằng `npx` | `npx --yes -p typescript@<x.y.z> -p <gói>@<x.y.z> <lệnh>` trong script `api:types`; không thêm dependency vào `package.json` | `tsc` của project vẫn kiểm file type sinh ra; phiên bản ghim phải đủ `x.y.z`, không dùng `latest`, `^` hay dải. [Inference] Gói chạy bằng `npx` nằm ngoài `package.json` và lockfile nên `npm audit` và công cụ quét dependency có thể không thấy nó: ghi điều này vào ADR |
| Đổi công cụ hoặc phiên bản công cụ | Chọn bản có peer/`engines` khớp project, kiểm lại bằng bước 1–2 | Đổi ADR nếu đã có |
| Hạ TypeScript hoặc Node của project | Ngoài phạm vi của skill này | Chỉ nêu như hệ quả, không tự làm |

## 3. Đề xuất mặc định khi chưa có codegen

`openapi-typescript` chỉ sinh **type**; hook và `api-client` vẫn viết mỏng theo template kiến trúc. Chỉ đề xuất sau khi
mục 2a không báo xung đột. Thay `<x.y.z>` bằng phiên bản đã kiểm ở mục 2a, đường dẫn đích theo bảng mục 4.

**Mặc định (mục 2a không báo xung đột peer):** cài vào `devDependencies` đúng một phiên bản, sau khi người dùng đồng ý
thêm dependency (không tự cài):

```
npm install --save-dev --save-exact openapi-typescript@<x.y.z>
```

```json
"scripts": {
  "api:types": "openapi-typescript docs/contracts/openapi.json -o src/lib/api/generated/schema.d.ts"
}
```

**Chỉ khi mục 2a báo xung đột peer `typescript` và người dùng đã chọn phương án ghim bằng `npx`:** script không thêm
dependency vào `package.json`; chưa được chọn thì không tự ghim:

```json
"scripts": {
  "api:types": "npx --yes -p typescript@<x.y.z> -p openapi-typescript@<x.y.z> openapi-typescript docs/contracts/openapi.json -o src/lib/api/generated/schema.d.ts"
}
```

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
