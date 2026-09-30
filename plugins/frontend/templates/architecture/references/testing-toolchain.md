# Toolchain test FE — package, script, file setup dùng chung

Artifact đi kèm 3 template kiến trúc (Feature-Based / FSD / Micro-FE). File này chốt **bộ package + script +
file setup chuẩn**; **vị trí** thư mục test theo từng kiến trúc nằm ở mục "Test — vị trí file" của template
tương ứng. Repo đã có runner/quy ước test riêng thì **theo repo**, file này chỉ là mặc định cho project mới.

## 1. Package chuẩn (devDependencies)

| Mục đích | Package | Ghi chú |
|---|---|---|
| Test runner | `vitest` | Mặc định cho stack Vite (dùng chung `vite.config`/alias). Repo đã dùng Jest thì giữ Jest. |
| Môi trường DOM | `jsdom` | Hoặc `happy-dom` — chọn một, khai ở `test.environment`. |
| Render + query | `@testing-library/react`, `@testing-library/dom` | `@testing-library/dom` là peer dependency ở bản mới — kiểm lại khi cài. |
| Tương tác người dùng | `@testing-library/user-event` | `userEvent.setup()`, luôn `await`. |
| Matcher DOM | `@testing-library/jest-dom` | Nạp qua entry `@testing-library/jest-dom/vitest` trong file setup. |
| Mock mạng | `msw` | `setupServer` từ `msw/node` (chạy trong Node/jsdom, không cần Service Worker). |
| Coverage | `@vitest/coverage-v8` | Bật bằng `vitest run --coverage`. |
| e2e (tuỳ chọn) | `@playwright/test` | Chỉ vài luồng đầu-cuối giá trị cao; ngoài phạm vi recipe `frontend-testing` → skill `frontend-e2e-testing`. |

```bash
npm i -D vitest jsdom @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom msw @vitest/coverage-v8
```

> **Version:** không pin ở đây — chốt theo release thực tế lúc cài và ghi vào `project-knowledge/tech-stack.yml`.
> Micro-FE: đồng bộ dải version toolchain test giữa host/remote/packages qua workspace (như shared deps).

## 2. Script chuẩn (`package.json`)

```jsonc
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "e2e": "playwright test"          // chỉ khi có e2e
}
```

Micro-FE: **mỗi app/package có script `test` riêng** (build/test độc lập); gốc monorepo chạy tất cả qua
workspace (`pnpm -r test` / `npm run test --workspaces`).

## 3. File setup chuẩn

Ba file, đặt trong thư mục testing dùng chung của kiến trúc (`<testing>` = `src/testing` ở Feature-Based,
`src/shared/testing` ở FSD và trong mỗi remote Micro-FE):

| File | Vai trò |
|---|---|
| `<testing>/setup-tests.ts` | Nạp matcher jest-dom + vòng đời msw server; khai ở `test.setupFiles`. |
| `<testing>/mocks/server.ts` | `setupServer()` **không** kèm handler domain — handler domain khai theo test/slice. |
| `<testing>/render.tsx` | Custom render bọc provider (QueryClient, Router, Theme) cho test chạm data. |

```ts
// vite.config.ts (hoặc vitest.config.ts) — khối test
test: {
  environment: 'jsdom',
  setupFiles: ['./src/testing/setup-tests.ts'],   // FSD/remote: ./src/shared/testing/setup-tests.ts
  coverage: { provider: 'v8' },
},
```

```ts
// <testing>/setup-tests.ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './mocks/server'

// 'error': request quên mock sẽ làm test đỏ thay vì âm thầm gọi mạng thật.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
// Không bật `globals` nên RTL không tự cleanup; reset handler để override của test này không rò sang test sau.
afterEach(() => { server.resetHandlers(); cleanup() })
afterAll(() => server.close())
```

```ts
// <testing>/mocks/server.ts
import { setupServer } from 'msw/node'

export const server = setupServer()
```

```tsx
// <testing>/render.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  // QueryClient mới mỗi test + tắt retry: cache không rò giữa test, case lỗi không chờ retry.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { user: userEvent.setup(), ...render(ui, { wrapper: Wrapper, ...options }) }
}
```

> Router/Theme: bọc thêm trong `Wrapper` theo thư viện project đang dùng (memory router cho test).
> FSD: `shared/testing/render.tsx` **tự dựng** provider từ thư viện, **không** import `app/providers`
> (shared không được import layer trên).

## 4. Quy ước chung cho cả 3 kiến trúc

- **Colocate mặc định:** `X.test.tsx` / `use-x.test.ts` nằm **cạnh** file được test, cùng thư mục/segment.
  Không dựng cây `__tests__/` song song trừ khi repo đã theo quy ước đó.
- **Handler msw theo domain** nằm cạnh phần gọi API của domain đó (`<name>.handlers.ts` trong segment/thư
  mục `api`), **không** gom vào thư mục testing dùng chung — thư mục testing không biết domain.
- **Code production không import thư mục testing** (chỉ file `*.test.*` và file setup được import).
- **e2e** (nếu có) ở `e2e/` tại gốc project/monorepo, ngoài `src/` — không trộn với unit/integration.
