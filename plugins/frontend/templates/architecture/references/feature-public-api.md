# Feature Public API (`index.ts`) — quy ước

Companion cho [`react-feature-based.template.md`](../react-feature-based.template.md). Giải thích quy
ước **public API** của một feature và cách nó phối hợp với luật ranh giới trong
[`eslint-boundaries.feature-based.jsonc`](./eslint-boundaries.feature-based.jsonc).

## Ý tưởng

Mỗi `features/<domain>/` mở ra ngoài qua **một cổng duy nhất** là `index.ts`. Mọi nơi ngoài feature
import qua `@/features/<domain>`; **không** import sâu vào segment nội bộ (`.../api/...`, `.../components/...`).
`index.ts` là **hợp đồng** của feature: đổi cấu trúc nội bộ tự do, giữ export ổn định thì bên ngoài không vỡ.

- Ngoài feature: `import { InvoiceList } from '@/features/invoices'` ✅
- Import sâu: `import { InvoiceList } from '@/features/invoices/components/invoice-list'` ❌ (chặn bằng lint + review)

## Ví dụ ngắn

```ts
// src/features/invoices/index.ts  — CHỈ re-export phần công khai
export { InvoiceList } from './components/invoice-list';
export { CreateInvoiceForm } from './components/create-invoice-form';
export { useInvoices } from './api/get-invoices';
export type { Invoice } from './types/invoice';
// KHÔNG export: DTO nội bộ, store nội bộ, hàm map, container — giữ là chi tiết cài đặt.
```

```tsx
// src/app/routes/invoices.tsx  — tầng app compose feature qua public API
import { InvoiceList, CreateInvoiceForm } from '@/features/invoices';
```

## Lưu ý quan trọng về barrel file (nguồn: bulletproof-react)

bulletproof-react **khuyến nghị import file trực tiếp thay vì barrel file** vì `index.ts` gom re-export
có thể cản **tree-shaking của Vite** và gây chậm build. Đây là trade-off THẬT, cân nhắc theo dự án:

- **Feature nhỏ/vừa (mặc định template này):** giữ `index.ts` **mỏng** — chỉ export đúng bề mặt công khai
  (vài component/hook/type). Ranh giới rõ ràng thường đáng giá hơn phần tree-shaking hao hụt.
- **Feature lớn / nhạy bundle-size:** bỏ barrel, import trực tiếp path đầy đủ, và dựa vào
  `import/no-restricted-paths` (cross-feature) để ép cô lập thay cho cổng `index.ts`.
- **Đừng** re-export nguyên cây (`export * from './...'`) — dễ kéo cả module vào bundle và làm public API phình.

> Tóm lại: `index.ts` ở đây là quy ước public API **mềm** của template, không bắt buộc như FSD. Chọn giữ
> barrel (ranh giới) hay bỏ barrel (tree-shaking) theo quy mô feature — miễn là luật **cấm cross-feature**
> và **chiều một chiều** vẫn xanh.

## Tham chiếu

- bulletproof-react — Project Structure: <https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md>
