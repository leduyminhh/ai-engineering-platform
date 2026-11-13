# Requirement: Đối chiếu giao diện đã render với mockup trong đường feature của plugin frontend

## Yêu cầu gốc

Đường `workflow-feature` PHẢI có một bước chạy giao diện thật, đối chiếu với mockup và kiểm các trạng thái lỗi cùng focus bàn phím, trước review cuối, với feature có màn hình.

## Bối cảnh

Trial plugin `frontend` ngày 2026-11-13 ([trial-report.md](../2026-11-13-frontend-trial/trial-report.md), mục N1) chạy `workflow-feature` tới G3 với 149 test, typecheck, build và 7 E2E xanh, nhưng không bước nào mở trang lên để nhìn. Hai lỗi UX `major` chỉ lộ ở review cuối nhờ đọc code: thông báo 404 của AC3.5 không bao giờ hiện, và focus bàn phím rơi về `body` sau mỗi lần chuyển trang. Agent tự nêu lỗi focus là "chưa quan sát trên Chrome thật, suy luận từ cách DOM hoạt động".

Bằng chứng khoảng trống, đã kiểm trong báo cáo trial: không có lệnh chụp ảnh hay đo style trong log; 7 E2E (`e2e/ticket-board.spec.ts`) chỉ phủ lọc, phân trang, tạo, đổi trạng thái; skill `frontend-manual-check` đã có và đã published (`plugins/_published.json:25`) nhưng không workflow nào gọi nó, và `workflows/feature/WORKFLOW.md` không nhắc tới nó.

Các file liên quan hiện tại: `workflows/feature/WORKFLOW.md` (Bước 5, Bước 6) và `graph.json`; `plugins/frontend/skills/frontend-manual-check/` (SKILL.md, `references/walkthrough.md`, `references/runbook.template.md`); `plugins/frontend/skills/frontend-implement/references/fidelity-checklist.md` dòng 15–28; `plugins/frontend/skills/frontend-code-review/references/review-dimensions.md` dòng 110–111.

## Ràng buộc

- Giữ `workflow-feature` đúng 7 bước (spec sống `workflows/R7`; pin `test/content/31-workflow-self-sufficient.pin.mjs` kiểm đúng 7 tiêu đề): bước mới là phần của Bước 5, không đánh số bước mới.
- `graph.json` phải khớp văn xuôi `WORKFLOW.md` (`checkGraphAgainstBody`); `aip build` thoát mã 1 nếu lệch.
- Walkthrough giữ nguyên sáu luật an toàn L1–L6 của `frontend-manual-check`: chỉ host local/test, không sửa code hay cấu hình, không tự cài Playwright.
- Không đổi `description` của `frontend-manual-check` (ngưỡng routing ở `test/routing/rank1.lock.json`).
- Không chạm file của request N2: `workflows/bugfix/`, `plugins/frontend/skills/frontend-fix/`. Bump version trong `plugins/frontend/.manifest.json` và `plugins/_versions.lock.json` có thể xung đột với N2; xử lý khi merge.
- Nội dung tiếng Việt có dấu, UTF-8 không BOM, LF.

## Tiêu chí chấp nhận

### R1 — `workflow-feature` có bước kiểm giao diện thật

- [ ] **AC1.1** — Given `workflows/feature/WORKFLOW.md` When đọc Bước 5 Then Hành động nêu một lượt "kiểm giao diện thật" chạy một lần sau khi mọi task `complete` và trước Bước 6, gọi skill `frontend-manual-check`, và nêu điều kiện áp dụng: phạm vi `frontend` hoặc `fullstack` và có ít nhất một AC kiểm được trên màn hình; phạm vi backend-only hoặc FE không có màn hình thì ghi "bỏ qua" kèm lý do.
- [ ] **AC1.2** — Given bước kiểm đã chạy When đọc Gate và Evidence của Bước 5 Then đầu ra là `docs/requests/<ngày>-<slug>/ui-check.md` có tổng PASS/FAIL/SKIP và, cho mỗi trạng thái đã kiểm, đường dẫn ảnh chụp hoặc dòng SKIP kèm lý do; không có công cụ trình duyệt hoặc không dựng được môi trường thì ghi `not_run` + `reason` vào `remaining_risks`, bước này không chặn Bước 6.
- [ ] **AC1.3** — Given `ui-check.md` có bước FAIL When đọc Bước 6 Then Đầu vào của reviewer có `ui-check.md`, reviewer frontend xếp severity cho từng FAIL theo thang của `frontend-code-review` (walkthrough chỉ gán PASS/FAIL), FAIL `blocker`/`major` đi vào đúng một lượt sửa của Bước 6, và các bước FAIL đó được chạy lại một lần sau lượt sửa, kết quả vào evidence của Bước 6; không có lượt sửa thứ hai.
- [ ] **AC1.4** — Given nhánh đã sửa When chạy `node test/validate.mjs --build` Then 0 lỗi graph, `workflow-feature` vẫn đúng 7 bước, và `run.skills` của bước `task-loop` trong `graph.json` có `frontend-manual-check` kèm `when`.
- [ ] **AC1.5** — Given frontmatter của `workflow-feature` When đọc `requires` và mục Điều kiện tiên quyết Then có `frontend/frontend-manual-check`, và bảng "Xử lý lỗi" cùng Definition of Done của workflow có dòng cho bước kiểm giao diện.

### R2 — `frontend-manual-check` kiểm được trạng thái, lỗi, focus và đối chiếu mockup

- [ ] **AC2.1** — Given `references/walkthrough.md` When đọc Then có quy tắc chụp ảnh cho mỗi màn hình ở từng trạng thái loading, rỗng, lỗi, thành công mà AC hoặc mockup nêu; ảnh lưu ngoài git; trạng thái không dựng được thì SKIP-PRECOND kèm lý do, không bỏ trống.
- [ ] **AC2.2** — Given một trạng thái cần dữ liệu đặc biệt When đọc `walkthrough.md` Then cách gây trạng thái là seed của runbook hoặc chặn/giả request ở tầng trình duyệt, không sửa mã nguồn hay cấu hình (L6 giữ nguyên).
- [ ] **AC2.3** — Given một thao tác làm tải lại hoặc đổi nội dung tại chỗ (đổi trang, lọc, tạo, đổi trạng thái, xoá dòng) When đọc `walkthrough.md` Then bước sau thao tác ghi phần tử đang focus, nhấn Tab một lần và ghi phần tử nhận focus tiếp theo; gán FAIL khi focus nằm ở `body` mà trang không đổi route và không vừa đóng dialog.
- [ ] **AC2.4** — Given AC mô tả một thông báo lỗi hay thành công When đọc `walkthrough.md` Then kiểm thông báo có trong DOM (chữ hoặc `role="alert"`) sau đủ chuỗi sự kiện, kể cả tải lại danh sách; thông báo nằm trong vùng bị gỡ cùng danh sách thì FAIL.
- [ ] **AC2.5** — Given `references/runbook.template.md` When đọc Then có mục `## Đối chiếu mockup` (bảng: trạng thái, ảnh, phần tử mockup tham chiếu, khớp/lệch), bảng bước bốn cột `| # | Thao tác | Kết quả mong đợi | AC |` giữ nguyên, và `node test/validate.mjs --only enrich-frontend` vẫn xanh với pin AC5.1–AC5.3 của `test/content/51-enrich-frontend.pin.mjs`.

- [ ] **AC2.6** — Given `frontend-manual-check` được gọi từ `workflow-feature` When đọc `SKILL.md` Then có mục chế độ nhúng: runbook lập từ AC đã duyệt ở G1 và không chờ duyệt thêm; thiếu công cụ trình duyệt, chưa tự cài Playwright hoặc chưa rõ lệnh dựng môi trường thì trả `not_run` + lý do thay vì hỏi; skill không commit, việc commit `ui-check.md` thuộc session chính. Chạy độc lập (người dùng gọi trực tiếp) giữ nguyên luật duyệt runbook và hỏi trước khi cài.

### R3 — `fidelity-checklist.md` đòi dẫn chứng cho mục "đã chạy thật"

- [ ] **AC3.1** — Given `plugins/frontend/skills/frontend-implement/references/fidelity-checklist.md` When đọc phần Fidelity self-check Then có mục "đã chạy thật và đối chiếu mockup" chỉ được tích khi kèm dẫn chứng (đường dẫn ảnh hoặc lệnh đã chạy); không chạy được thì ghi `chưa kiểm` kèm lý do, không tích; dòng a11y về focus nêu thêm trường hợp nội dung đổi tại chỗ.

### R4 — `review-dimensions.md` phủ focus khi nội dung đổi tại chỗ

- [ ] **AC4.1** — Given `plugins/frontend/skills/frontend-code-review/references/review-dimensions.md` When đọc bullet "Quản lý focus" của Trục 4 Then ngoài modal và đổi route còn nêu thay nội dung tại chỗ (tải lại danh sách, phân trang, xoá dòng làm phần tử đang focus bị gỡ) và vùng `role="alert"` bị gỡ cùng danh sách làm thông báo không hiện; nêu mức severity gợi ý khi nằm trên luồng chính.

### R5 — Phát hành

- [ ] **AC5.1** — Given các thay đổi trên When chạy `npm test` Then exit 0.
- [ ] **AC5.2** — Given nội dung chiếu đã đổi When so version Then version của `workflows` (`workflows/.manifest.json`) và `frontend` (`plugins/frontend/.manifest.json`) tăng, `node cli/lib/versions.mjs --lock` chạy không từ chối, và `plugins/_versions.lock.json` khớp bản build.
- [ ] **AC5.3** — Given một pin mới `test/content/54-frontend-ui-verify.pin.mjs` When chạy `node test/validate.mjs --only frontend-ui-verify` Then pin kiểm các câu khoá của AC1.1–AC1.5, AC2.1–AC2.6, AC3.1 và AC4.1 và xanh.

### R6 — Kiểm chứng hành vi trên ca thật của trial

- [ ] **AC6.1** — Given project trial `E:\Mine\AI\aip-frontend-trial` ở commit `62bfcb0` (cha của `e01a7e7`, trước khi sửa hai lỗi) và plugin `frontend` đã cập nhật When chạy bước kiểm giao diện thật Then `ui-check.md` ghi FAIL cho thông báo 404 của AC3.5 và ít nhất một FAIL focus sau khi chuyển trang. Đây là kiểm tay tốn model, nằm ngoài `npm test`; kết quả (hoặc `not_run` kèm lý do) ghi vào mục "Kết quả kiểm chứng" của `design.md` trước G3.

## Ngoài phạm vi

- Test tự động chụp ảnh so sánh (`toHaveScreenshot`) và kiểm a11y tự động (axe): thuộc `frontend-e2e-testing`, cần ảnh nền và duyệt `@playwright/test`.
- Agent mới cho việc kiểm giao diện; kind task mới trong `plan-execution`/`engineering-plan-writing`.
- Quy tắc test có assert nội dung người dùng thấy (N4), kiểm tương thích công cụ sinh code (N3), `workflow-bugfix` (N2), script đo trong `perf/` (N5), hook `guard-bash` (N6).
- Bước tương đương cho phía backend.
