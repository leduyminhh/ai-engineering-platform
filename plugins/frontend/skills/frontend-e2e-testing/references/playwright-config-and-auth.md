# Cấu hình Playwright, môi trường và đăng nhập — cho e2e

Tài liệu tham chiếu cho `frontend-e2e-testing`, cổng E1 và quy tắc E-r3, E-r4, E-r6, E-r7. Skill này không sinh
`playwright.config.ts` dựng sẵn; bảng và mã dưới đây là mẫu để agent bám theo, luôn đọc config thật của project
trước khi sửa.

## 1. Vị trí e2e theo kiến trúc

Lấy từ các template ở `architecture/react-<feature-based|fsd|micro-frontend>.template.md` và
`architecture/references/testing-toolchain.md`.

| Kiến trúc | Thư mục e2e | Config |
|---|---|---|
| Feature-Based | `e2e/` ở gốc project, ngoài `src/` | `playwright.config.ts` ở gốc project |
| FSD | `e2e/` ở gốc project, ngoài `src/` | `playwright.config.ts` ở gốc project |
| Micro-FE | `e2e/` ở gốc monorepo, ngoài mọi app | `playwright.config.ts` ở gốc monorepo; `webServer` dựng host và các remote cần cho luồng |

Script `e2e` trong `package.json` do `testing-toolchain.md` chốt (`"e2e": "playwright test"`); project đã có script
khác thì theo project.

## 2. Config mẫu

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import { assertLocalBaseURL } from './e2e/support/assert-local-host';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
assertLocalBaseURL(baseURL);

export default defineConfig({
  testDir: './e2e',
  retries: process.env.CI ? 2 : 1,
  reporter: [['html', { open: 'never' }]],
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
```

- `[Inference]` Cổng `5173` là mặc định của Vite; đọc `package.json` và `vite.config` của project để lấy lệnh và cổng
  thật, không giữ nguyên số trên.
- Mỗi cấu hình trong mẫu (`use.baseURL`, `webServer`, dự án `setup` + `dependencies` + `storageState`,
  `trace: 'on-first-retry'`, reporter HTML) có nguồn ở mục 8.
- Micro-FE: khai `webServer` cho host và từng remote theo lệnh của project (nhiều server, xem mục 8).

## 3. Chặn host không phải local/test (E-r3)

Kiểm ngay khi nạp config, để host sai làm hỏng cả lần chạy trước khi có test nào chạy:

```ts
// e2e/support/assert-local-host.ts
// Chạy lúc nạp config: host lạ phải làm hỏng cả lần chạy, không để test lỡ chạm staging/production.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function assertLocalBaseURL(url: string): void {
  const { hostname } = new URL(url);
  const isLocal = LOCAL_HOSTS.has(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.test');
  if (!isLocal) {
    throw new Error(`E2E_BASE_URL phải là host local/test, nhận: ${hostname} (từ chối staging/production)`);
  }
}
```

Tên dịch vụ docker compose và `host.docker.internal` bị từ chối theo thiết kế; nếu project chạy FE trong container thì
dùng cổng publish ra `localhost`.

Người dùng đưa staging/production → từ chối, giải thích, đề nghị dựng môi trường local/test (thuộc E1, không tự dựng).

## 4. Đăng nhập một lần (E-r4)

Credential chỉ lấy từ biến môi trường `E2E_USERNAME`, `E2E_PASSWORD` và là **tài khoản test**. Không viết giá trị vào
file, không in ra log hay report.

```ts
// e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('đăng nhập tài khoản test', async ({ page }) => {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  if (!username || !password) {
    throw new Error('Thiếu biến môi trường E2E_USERNAME hoặc E2E_PASSWORD');
  }

  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập').fill(username);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();

  await page.context().storageState({ path: authFile });
});
```

Nhãn `Tên đăng nhập`, `Mật khẩu`, `Đăng nhập` là minh hoạ: đọc form thật của project. Chọn phần tử chỉ xuất hiện một
lần sau khi đăng nhập thành công (vd. heading của trang chủ), không chọn landmark có thể lặp như `navigation`. Thêm `e2e/.auth/` vào `.gitignore`
vì file `storageState` chứa cookie phiên. Luồng không cần đăng nhập thì bỏ dự án `setup` và dòng `storageState`.

## 5. Evidence (E-r6)

| Thành phần | Cách làm |
|---|---|
| Trace | `use.trace: 'on-first-retry'` trong config; xem bằng `npx playwright show-trace <đường-dẫn-trace.zip>` |
| Report HTML | `reporter: [['html', { open: 'never' }]]`; mở bằng `npx playwright show-report` |
| Chống flaky | `npx playwright test --repeat-each=3` phải xanh trước khi báo hoàn tất |

`on-first-retry` chỉ ghi trace khi có retry (cần `retries` ≥ 1; mặc định của Playwright là 0 khi chạy local, 2 trên CI,
xem https://playwright.dev/docs/trace-viewer-intro). Nếu project đặt `retries` về 0 thì chạy lượt E5 với `--trace on`.

Trace và report đính kèm vào `result.flows[].trace` khi có test giữ đỏ vì bug thật (cổng E5).

## 6. Môi trường (E1)

| Dấu hiệu trong project | Hành động |
|---|---|
| `docker-compose*.yml` / `compose*.yml` có dịch vụ BE + DB | Dùng lệnh của project; agent không tự chạy nếu chưa được phép |
| Script `dev:e2e`, `start:test` hoặc tương tự trong `package.json` | Dùng lại làm `webServer.command` |
| Không có BE/DB test | `not_run` + lý do trong report; **không tự dựng hạ tầng** |
| Cần biến môi trường (`E2E_BASE_URL`, `E2E_USERNAME`, `E2E_PASSWORD`, …) | Chỉ nêu tên biến trong report; người dùng cung cấp giá trị |

## 7. Dependency (E-r7)

`npm i -D @playwright/test` và `npx playwright install` (tải browser) là thay đổi dependency và dung lượng lớn: nêu
lệnh, lý do, dung lượng ước tính và **hỏi trước**. Project đã có Playwright thì dùng lại, không đổi phiên bản.

## 8. Nguồn đối chiếu

Trạng thái đối chiếu: các nhận định về `use.baseURL`, `webServer` (một và nhiều server), dự án `setup` +
`dependencies` + `storageState` (kèm khuyến nghị đưa thư mục auth vào `.gitignore`), `trace: 'on-first-retry'`,
`--repeat-each` và reporter HTML đã đối chiếu với tài liệu chính thức. Đối chiếu theo bản docs mới nhất trên
playwright.dev, chưa so với phiên bản Playwright cài trong project.

- `use.baseURL`, cấu hình chung: https://playwright.dev/docs/test-configuration
- `webServer` (một hoặc nhiều server): https://playwright.dev/docs/test-webserver
- Xác thực, `storageState`, dự án `setup`: https://playwright.dev/docs/auth
- Trace: https://playwright.dev/docs/trace-viewer-intro
- CLI (`--repeat-each`): https://playwright.dev/docs/test-cli
- Reporter: https://playwright.dev/docs/test-reporters
