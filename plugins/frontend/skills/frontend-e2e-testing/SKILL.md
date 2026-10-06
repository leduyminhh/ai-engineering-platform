---
name: frontend-e2e-testing
description: "Recipe on-demand: viết TEST ĐẦU-CUỐI bằng Playwright cho 3–5 luồng người dùng giá trị cao của FRONTEND React đã nối API thật — mỗi test map một acceptance criterion, đặt ở e2e/, selector theo role/label/text, không sleep cứng, baseURL/credential từ biến môi trường, CHỈ chạy local/test (từ chối staging/production), đăng nhập một lần qua storageState, dữ liệu cô lập, chống flaky bằng --repeat-each=3, evidence bằng trace + report HTML. Test đỏ vì bug thật thì giữ đỏ và báo, KHÔNG sửa code production; KHÔNG load test; KHÔNG tự cài @playwright/test hay browser khi chưa hỏi. Dùng skill NÀY khi người dùng muốn \"e2e\", \"end-to-end\", \"test đầu-cuối\", \"Playwright\", \"test luồng người dùng\", \"smoke test FE\", \"kiểm luồng xuyên FE-BE-DB\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần trên project đã có luồng nối API thật. Không dùng khi cần unit/integration test component → frontend-testing; đo hiệu năng → frontend-performance."
order: 8
title: "Frontend E2E Testing — Test đầu-cuối Playwright cho vài luồng giá trị cao (recipe on-demand)"
runsIn: execute
invoke: per-request
sharedAssets: templates/architecture
---

# Frontend E2E Testing — Test đầu-cuối Playwright cho vài luồng giá trị cao (recipe on-demand)

Viết test đầu-cuối chạy trình duyệt thật qua Playwright để làm **lưới an toàn xuyên tầng FE → BE → DB** cho vài
luồng quan trọng. Skill này là **hướng dẫn cách agent làm** (docs-only recipe), KHÔNG phải bộ test dựng sẵn hay công
cụ sinh test. Recipe `pipeline: false`, gọi khi cần — không thuộc chuỗi bắt buộc.

Phân công với skill anh em: `frontend-testing` phủ unit/integration (Testing Library + msw) và là nơi mặc định để
chứng minh rủi ro; skill này chỉ nhận luồng mà tầng thấp **không** chứng minh được; `frontend-data-integration` nối
UI với API thật (tiền đề của e2e xuyên BE); `backend-api-contract` chốt contract.

## Tiền đề

- Project **đã chạy `frontend-init`** (có `project-knowledge/`: `architecture.md`, `code-convention.md`,
  `tech-stack.yml`) và có **acceptance criteria** (thường ở `docs/requests/`). Thiếu → đề nghị chạy `frontend-init` /
  `engineering-spec-writing` trước.
- Màn hình của luồng đã nối API thật. Chưa nối → xem `frontend-data-integration`; luồng xuyên BE chưa chạy được
  thì dừng ở cổng E1.
- Mọi bối cảnh nằm trong FILE. Con người giữ chốt: **duyệt bảng luồng ở E2** và **duyệt diff trước khi commit**.

## Phạm vi

- **Làm:** test đầu-cuối bằng Playwright (`@playwright/test`, công cụ repo đã chọn ở
  `architecture/references/testing-toolchain.md`) cho **3–5 luồng giá trị cao**, mỗi test map tới **1 acceptance
  criterion**. Test đặt ở `e2e/` ngoài `src/`; với Micro-FE đặt ở gốc monorepo
  (`architecture/react-micro-frontend.template.md`).
- **Không làm:** thay unit/integration (đó là `frontend-testing`); load test; test trên staging/production.

## Ranh giới an toàn (CLAUDE.md)

- KHÔNG sửa `src/` production; test đỏ vì bug thật thì **giữ đỏ**, báo cáo, để người quyết (cổng E5).
- KHÔNG trỏ `baseURL` vào staging/production; KHÔNG dùng hay in credential thật (chỉ nêu tên biến môi trường và dùng
  tài khoản test).
- KHÔNG tự cài `@playwright/test`, KHÔNG tải browser (`npx playwright install`) khi chưa hỏi (E-r7).
- KHÔNG tự dựng hạ tầng BE/DB test; thiếu → `not_run` + lý do (cổng E1).
- Làm trên branch riêng (không `main`/`master`/`dev`/`develop`); dừng cho người duyệt diff trước khi commit
  (1 task = 1 commit).

**Ngôn ngữ (bắt buộc):** mọi đầu ra hướng người dùng — bảng luồng, tiêu đề test, báo cáo, comment trong code sinh
ra — viết **tiếng Việt CÓ DẤU** (UTF-8). Báo cáo bằng số đo được (lệnh đã chạy, exit code, số test xanh/đỏ); không
dùng "đảm bảo / loại bỏ hoàn toàn / test hết"; luôn nêu luồng chưa phủ và rủi ro còn lại.

## Quy tắc bắt buộc

| # | Quy tắc |
|---|---|
| E-r1 | Selector theo role/label/text (`getByRole`, `getByLabel`), không dùng CSS class hay XPath |
| E-r2 | Không `waitForTimeout`/sleep cứng; dùng assertion tự chờ (`await expect(locator).toBeVisible()`) |
| E-r3 | `baseURL` lấy từ biến môi trường; chỉ nhận host local/test; từ chối staging/production |
| E-r4 | Credential lấy từ biến môi trường (chỉ nêu tên biến) và là tài khoản test; đăng nhập một lần qua setup project + `storageState` |
| E-r5 | Dữ liệu cô lập theo từng lần chạy (hậu tố duy nhất hoặc seed/cleanup riêng); không phụ thuộc thứ tự test |
| E-r6 | Evidence: `trace: 'on-first-retry'` + report HTML; chống flaky bằng `--repeat-each=3` |
| E-r7 | Thêm `@playwright/test` hoặc tải browser là thay đổi dependency → **hỏi trước** |

## Quy trình

### 0. Nạp context (BẮT BUỘC — đọc TRƯỚC khi viết)

- Đọc `project-knowledge/`: `architecture.md` (Feature-Based / FSD / Micro-FE) để biết vị trí `e2e/`,
  `code-convention.md`, `tech-stack.yml`.
- Đọc acceptance criteria liên quan (`docs/requests/…`) và danh sách luồng được giao.
- Dò **stack thật**: `playwright.config.*`, script `e2e` trong `package.json`, thư mục `e2e/` đã có, lệnh chạy FE
  và BE/DB test của project (docker compose hoặc script). Ghi lại phiên bản `@playwright/test` thật nếu đã cài.
- Cấu hình, đăng nhập và môi trường: [references/playwright-config-and-auth.md](references/playwright-config-and-auth.md).
  Chọn luồng, mẫu test và xử lý flaky: [references/flow-selection-and-patterns.md](references/flow-selection-and-patterns.md).

### E1. Môi trường

Xác nhận FE chạy được (qua `webServer` của Playwright hoặc lệnh của project) và **BE + DB test có sẵn** (docker
compose hoặc lệnh của project), và mọi biến môi trường cần có đã được người dùng cung cấp (chỉ nêu tên biến).

**Đỏ khi:** thiếu BE/DB test → `not_run` + lý do; **không tự dựng hạ tầng**.

### E2. Chọn luồng ⏸

Lập bảng luồng → acceptance criterion → lý do unit/integration không chứng minh được; trình người dùng duyệt.
DỪNG chờ duyệt; chưa viết test trước khi có câu trả lời.

**Đỏ khi:** luồng mà unit/integration phủ được → loại khỏi bảng.

### E3. Viết

Viết test theo E-r1…E-r5. Đăng nhập một lần qua setup project + `storageState`. Mỗi test có tiêu đề nêu mã AC.

**Đỏ khi:** còn selector CSS/XPath, sleep cứng, credential viết cứng, hoặc test phụ thuộc thứ tự → sửa.

### E4. Ổn định

Chạy `npx playwright test --repeat-each=3` (E-r6) phải xanh.

**Đỏ khi:** flaky → sửa **test** (tìm nguyên nhân, không nới assertion), chạy lại.

### E5. Bug thật

Test đỏ do hành vi ứng dụng sai → giữ nguyên đỏ, đính trace, báo cáo. **Không sửa code production**, không
`skip` để che.

## Report trả về

```yaml
result:
  summary: "<1–3 câu>"
  flows:                                   # luồng ↔ AC ↔ test
    - flow: "Tạo hoá đơn"
      ac: "AC-3"
      test: "e2e/invoices.spec.ts:12"
      status: passed                       # passed | failed_real_bug | not_run
      trace: ""                            # đường dẫn trace nếu failed_real_bug
  validation:
    - command: "npx playwright test --repeat-each=3"
      exit_code: 0
      status: passed       # passed | failed | not_run
      summary: "<số liệu>"
      reason: ""
  remaining_risks: []
  next_actions: []
```

## Rủi ro còn lại (luôn nêu)

- Chỉ phủ 3–5 luồng đã duyệt; luồng khác vẫn dựa vào unit/integration.
- Test phụ thuộc dữ liệu seed và môi trường BE/DB test của project; môi trường lệch thì kết quả lệch.
- Hành vi Playwright theo phiên bản; đối chiếu phiên bản thật của project.
- Kit chưa được pilot trên project React thật.
