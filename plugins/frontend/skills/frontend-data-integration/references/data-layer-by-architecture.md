# Đặt tầng data theo kiến trúc UI

Tài liệu tham chiếu cho `frontend-data-integration`, bước 0 và cổng I3. Bảng lấy từ các template ở
`architecture/react-<feature-based|fsd|micro-frontend>.template.md`; đọc lại template của project trước khi tạo file.

## 1. Bảng đặt file

| Kiến trúc | Client gốc | Type sinh | Đọc (query) | Ghi (mutation) | Map DTO → view model | Nối UI |
|---|---|---|---|---|---|---|
| Feature-Based | `lib/api-client.ts` | `lib/api/generated/` | `features/<x>/api/` | `features/<x>/api/` | `features/<x>/utils/to-*.ts` | `features/<x>/components/*-container.tsx` |
| FSD | `shared/api/` | `shared/api/generated/` | `entities/<x>/api/` | `features/<x>/api/` | segment `api` của slice | `ui` của `widgets/<x>` hoặc `pages/<x>` |
| Micro-FE | trong remote (theo FSD) | trong remote, `shared/api/generated/` | như FSD | như FSD | như FSD | như FSD |

Quy tắc chung: mọi HTTP đi qua client gốc; hook không chứa JSX; presentational không import hook; feature/slice mở
ra ngoài chỉ qua `index.ts`.

## 2. Ví dụ — Feature-Based (domain `invoices`)

Giả định `api-client` có phương thức `get<T>(url, { params })`; đọc `lib/api-client.ts` thật của project và bám theo
đó.

```ts
// features/invoices/api/get-invoices.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { InvoiceDto } from './invoice.dto';
import { toInvoice } from '../utils/to-invoice';

export const invoiceKeys = {
  list: (params: { page: number }) => ['invoices', params] as const,
};

export function useInvoices(params: { page: number }) {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: () => apiClient.get<InvoiceDto[]>('/invoices', { params }),
    select: (dtos) => dtos.map(toInvoice),
  });
}
```

Chữ ký một đối tượng `useQuery({ queryKey, queryFn, select })` là của TanStack Query v5 (v5 chỉ hỗ trợ dạng đối
tượng, bỏ dạng nhiều tham số của v4): https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5 ;
`select` lấy/biến đổi dữ liệu trước khi component nhận:
https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations . Template Feature-Based hiện
minh hoạ dạng v4 `useQuery(['invoices'], getInvoices)` — đọc phiên bản thật trong `package.json` và bám theo đó.

```tsx
// features/invoices/components/invoice-list-container.tsx
import { useInvoices } from '../api/get-invoices';
import { InvoiceList } from './invoice-list'; // presentational, giữ nguyên
import { toUiError } from '../utils/to-ui-error';

export function InvoiceListContainer({ page }: { page: number }) {
  const { data, isPending, error, refetch } = useInvoices({ page });
  return (
    <InvoiceList
      invoices={data ?? []}
      loading={isPending}
      error={error ? toUiError(error) : undefined}
      onRetry={refetch}
    />
  );
}
```

`InvoiceList` chỉ nhận `props`; cách hiển thị 4 trạng thái xem `states-and-errors.md`.

## 3. Ví dụ — FSD

```ts
// entities/invoice/api/get-invoices.ts      — đọc, do entity sở hữu
// features/create-invoice/api/create-invoice.ts — ghi, do feature sở hữu
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api';
import { invoiceKeys } from '@/entities/invoice';
import type { CreateInvoiceDto } from './create-invoice.dto';

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInvoiceDto) => apiClient.post('/invoices', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
}
```

Làm mới danh sách sau khi ghi bằng `invalidateQueries` trong `onSuccess`:
https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations

Feature import entity qua public API (`@/entities/invoice`), không import ruột entity và không import feature khác.
Widget/page (`ui`) gọi hook rồi đổ props xuống, đúng vai container của Feature-Based.

## 4. Micro-FE

Làm trong từng remote theo FSD ở mục 3. Không import ruột remote khác; dữ liệu cần chia sẻ giữa remote đi qua
props/context do host bơm xuống hoặc event bus ở `packages/contracts` (xem template Micro-FE).
