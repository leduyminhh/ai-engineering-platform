# Chọn luồng, mẫu test và xử lý ổn định — cho e2e

Tài liệu tham chiếu cho `frontend-e2e-testing`, cổng E2–E5 và quy tắc E-r1, E-r2, E-r5, E-r6.

## 1. Chọn luồng (E2 ⏸)

Chỉ đưa vào luồng mà **unit/integration không chứng minh được** (đi qua FE → BE → DB, hoặc ghép nhiều màn hình).
Tối đa 3–5 luồng. Trình bảng sau để người dùng duyệt trước khi viết:

| # | Luồng | AC | Vì sao unit/integration không đủ | Quyết định |
|---|---|---|---|---|
| 1 | Tạo hoá đơn từ form đến danh sách | AC-3 | Cần BE + DB ghi thật rồi đọc lại | Giữ |
| 2 | Hiển thị lỗi khi validate ở client | AC-4 | Test component + msw đã phủ | Loại |

Tiêu chí loại: rủi ro kiểm được bằng render + props hoặc msw; luồng không có acceptance criterion; luồng cần dữ liệu
nhạy cảm hay môi trường production.

## 2. Mẫu test (E-r1, E-r2, E-r5)

```ts
// e2e/invoices.spec.ts
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

test('AC-3: tạo hoá đơn mới hiển thị trong danh sách', async ({ page }) => {
  const customer = `Khách e2e ${randomUUID().slice(0, 8)}`;

  await page.goto('/invoices');
  await page.getByRole('button', { name: 'Tạo hoá đơn' }).click();
  await page.getByLabel('Khách hàng').fill(customer);
  await page.getByRole('button', { name: 'Lưu' }).click();

  await expect(page.getByRole('row', { name: new RegExp(customer) })).toBeVisible();
});
```

- Tiêu đề test nêu mã AC để map test ↔ tiêu chí (`result.flows[].ac`).
- Nhãn và tên nút là minh hoạ: đọc giao diện thật của project.
- Dữ liệu tự sinh có hậu tố ngẫu nhiên nên chạy lặp (`--repeat-each=3`) không đụng nhau; nếu project cần dọn dữ liệu,
  dùng seed/cleanup riêng dưới `e2e/` theo lệnh của project.
- Assertion `expect(locator).toBeVisible()` tự chờ, không cần sleep (nguồn: mục 5).

## 3. Lỗi thường gặp

| Lỗi | Vì sao sai | Cách đúng |
|---|---|---|
| Selector theo CSS class hoặc XPath | Vỡ khi đổi style/cấu trúc DOM (E-r1) | Dùng `getByRole`, `getByLabel`, `getByText` |
| Chờ bằng sleep cứng (`waitForTimeout`) | Chậm và vẫn flaky (E-r2) | Assertion tự chờ, `await expect(...)` |
| Ghi cứng URL hoặc credential | Có thể chạm staging/production, lộ bí mật (E-r3, E-r4) | Biến môi trường + `assertLocalBaseURL` |
| Test dùng dữ liệu của test khác | Phụ thuộc thứ tự, đỏ ngẫu nhiên (E-r5) | Dữ liệu duy nhất theo từng test |
| Nới assertion hoặc `skip` để hết flaky | Che lỗi thật (E4, E5) | Tìm nguyên nhân gốc, sửa test |

## 4. Ổn định (E4) và bug thật (E5)

1. Chạy `npx playwright test --repeat-each=3`.
2. Có test đỏ → mở trace (`npx playwright show-trace <trace.zip>`; trace chỉ có khi đã chạy retry, xem mục 5 của
   [playwright-config-and-auth.md](playwright-config-and-auth.md)) và phân loại:
   - **Lỗi của test** (selector sai, chờ sai, dữ liệu đụng nhau, thứ tự): sửa test, chạy lại từ bước 1.
   - **Hành vi ứng dụng sai** (kết quả không khớp AC): giữ nguyên đỏ đúng lý do, đính trace, ghi vào
     `result.flows[].status: failed_real_bug`. **Không sửa `src/`**, không `skip`, không nới assertion.
3. Ghi lệnh, exit code và số test xanh/đỏ vào `result.validation`.

## 5. Nguồn đối chiếu

Trạng thái đối chiếu: locator khuyến nghị (`getByRole`, `getByLabel`), khuyến cáo tránh CSS/XPath, assertion tự chờ,
`--repeat-each` đã đối chiếu với tài liệu chính thức; riêng nhận định về `waitForTimeout` chưa mở được mục tương ứng
trong tài liệu API (trang tải về bị cắt). Đối chiếu theo bản docs mới nhất trên playwright.dev, chưa so với phiên bản
Playwright cài trong project.

- Locator khuyến nghị (`getByRole`, `getByLabel`): https://playwright.dev/docs/locators
- Assertion tự chờ (`expect(locator).toBeVisible()`): https://playwright.dev/docs/test-assertions
- [Unverified] `page.waitForTimeout` không nên dùng cho test production: https://playwright.dev/docs/api/class-page
- Trace và `--repeat-each`: https://playwright.dev/docs/trace-viewer-intro, https://playwright.dev/docs/test-cli
