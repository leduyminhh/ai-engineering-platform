# Requirement: Lưu số đo hiệu năng frontend thành script lặp lại được trong `perf/`

## Yêu cầu gốc

Khi `frontend-performance` đo hiệu năng mà project không có Lighthouse (hoặc công cụ đo khác) và người dùng chưa cho
cài thêm, skill PHẢI dẫn agent tới một script đo Node + Playwright lưu trong `perf/`, chạy được lại bằng một lệnh, thay
vì đo bằng lệnh một lần của công cụ trình duyệt tương tác (Playwright MCP, `browser_run_code_unsafe`). Mẫu `.gitignore`
mà `frontend-init` dựng cho project mới PHẢI bỏ qua artefact của công cụ đo và thư mục build.

## Bối cảnh

Nguồn: `docs/requests/2026-11-13-frontend-trial/trial-report.md`, mục N5 và mục 4.3 (đường performance, lượt 7,
`turn-t7.jsonl`). Trong trial, agent đo trung thực (5 lần, bản build production, không sửa `src/`, hỏi trước khi thêm
Lighthouse) nhưng:

- không lưu số đo thành script ở `perf/` như `plugins/frontend/skills/frontend-performance/SKILL.md:39` yêu cầu; agent
  dùng `browser_run_code_unsafe` của Playwright MCP, nên Bước 6 của `workflow-performance` (chạy lại nguyên trạng, băm
  script ở Bước 3) không có gì để chạy lại;
- để lại `.playwright-mcp/` untracked trong repo project (`git status`: `?? .playwright-mcp/`).

Hiện trạng đã kiểm trong repo:

- `SKILL.md:41` nói "Ưu tiên công cụ project đã có; thiếu → đề xuất mặc định (Lighthouse CLI …) và hỏi trước khi thêm
  tool/dependency"; không có lối cho trường hợp project đã có Playwright (cài cho E2E) mà không có Lighthouse.
- `frontend-init` **không có** mẫu `.gitignore` nào: `templates/init/` là khung dùng chung của mọi skill `*-init`
  (backend, data, ops, frontend) và không chứa `.gitignore`. Câu "thêm vào mẫu `.gitignore`" của N5 vì vậy là thêm bước
  mới cho `frontend-init`, không phải sửa một mẫu có sẵn.
- `references/lighthouse-cli.md:75` ghi output đo vào `perf/frontend/run-*.json` và để ngỏ "hỏi người dùng có commit hay
  thêm vào `.gitignore`"; `measure-conditions.md:28` đã coi `.gitignore` là Config tool đo cần người dùng duyệt.

[Inference] Script có trong repo thì Bước 6 chạy lại và so sánh được; hiệu quả thật chưa thử, cần chạy lại kịch bản
trial (mục Kiểm thử của `design.md`).

## Ràng buộc

- Giữ nguyên cổng P1–P5 của `frontend-performance`: chỉ local/test, bản build production, ≥ 3 lần, không sửa `src/`,
  hỏi trước khi thêm tool/dependency (`SKILL.md:78`), chạy như subagent thì trả `blocked`.
- Không đổi `description` của skill (giữ điểm routing, `test/routing/rank1.lock.json`).
- Văn bản tiếng Việt có dấu, UTF-8 không BOM, LF; comment trong code chỉ giải thích lý do (AGENTS.md).
- Không sửa file riêng của N1–N4 (`workflows/feature/`, `workflows/bugfix/`, `frontend-implement`,
  `frontend-code-review`, `frontend-fix`, `frontend-data-integration`, `frontend-testing`).

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given project có `playwright` hoặc `@playwright/test` trong `package.json` và không có Lighthouse
  When `frontend-performance` chạy chế độ `measure` Then `SKILL.md` dẫn agent dùng script mẫu Playwright của skill, chép
  vào `perf/` (không hỏi thêm dependency), thay vì đo bằng công cụ trình duyệt tương tác; kiểm bằng pin test đọc
  `SKILL.md` nêu thứ tự: script hoặc config đo project đã có (kể cả script Playwright riêng) → Lighthouse đã cài →
  script mẫu Playwright (dependency đã có) → đề xuất Lighthouse và hỏi. "Đã cài" nghĩa là khai trong `package.json`
  hoặc có trong `node_modules/.bin`; bản global và gói `npx` tải tạm không tính (tải là thêm tool).
- [ ] **AC1.2** — Given project không có cả Lighthouse lẫn Playwright When `measure` chạy Then agent không tự thêm
  dependency: đề xuất Lighthouse và hỏi (chạy như subagent: `blocked` + câu hỏi), giữ nguyên `SKILL.md:78`.
- [ ] **AC1.3** — Given script mẫu được chạy với URL ngoài `localhost`, `127.0.0.1` hoặc `[::1]` When khởi động Then
  script thoát mã khác 0 trước khi mở trình duyệt, nêu lý do (P1); URL localhost chạy bình thường. Kiểm bằng test đơn vị
  trên hàm kiểm host, một test tham số hoá cho cả bốn URL (localhost, 127.0.0.1, `[::1]`, một host ngoài).
- [ ] **AC1.4** — Given số lần lặp `--runs` nhỏ hơn 3 When script khởi động Then script từ chối chạy (P3). Kiểm bằng test
  đơn vị trên hàm kiểm tham số.
- [ ] **AC1.5** — Given dãy kết quả thô của các lần chạy When script tổng hợp Then in median, độ lệch
  `(max − min) / median` và dãy thô cho LCP, TBT-xấp-xỉ, CLS, cùng công thức với `lighthouse-cli.md`; kiểm bằng test
  đơn vị tham số hoá. Ví dụ số lần chẵn (lấy phần tử trên giữa, không nội suy): dãy 100, 120, 110, 130 có median 120 và
  độ lệch 0,25: `calc: (130 - 100) / 120 = 0.25`. Median bằng 0 (hay gặp ở CLS) → độ lệch là `null` (in "không xác
  định"), không chia cho 0 và không sinh `Infinity`/`NaN`; cảnh báo P3 bỏ qua chỉ số đó.
- [ ] **AC2.1** — Given agent dùng script Playwright When viết bảng điều kiện đo Then bảng điều kiện đo (không thêm hàng mới) ghi: hàng "Công cụ
  + phiên bản" là Playwright + Chromium (phiên bản lấy từ output lệnh) kèm cửa sổ đo của script; hàng "Thiết bị/throttle"
  là cờ CPU slowdown nguyên văn hoặc "không throttle". Mục "Chỉ số báo cáo" nêu LCP/CLS đo bằng `PerformanceObserver`,
  TBT là số xấp xỉ từ long task, không phải số Lighthouse; Bước 6 chỉ so với baseline cùng công cụ. Kiểm bằng pin test
  đọc `measure-conditions.md` và `SKILL.md`.
- [ ] **AC3.1** — Given script đo ghi kết quả thô When agent lưu output Then output nằm ở `perf/<phía>/results/` và dòng
  `.gitignore` bỏ qua `perf/**/results/` được đề xuất dưới dạng Config tool đo cần người dùng duyệt nếu chưa có; script,
  bảng điều kiện (`*.conditions.md`) vẫn nằm ngoài `results/` để vào diff. Kiểm bằng pin test đọc `SKILL.md`,
  `measure-conditions.md`, `lighthouse-cli.md` (đường dẫn output thống nhất `results/`).
- [ ] **AC3.2** — Given sau lần đo `git status` còn artefact công cụ chưa ignore (`.playwright-mcp/`,
  `perf/**/results/`, thư mục output build) When agent báo cáo Then report nêu từng đường dẫn và dòng `.gitignore` đề
  xuất; agent không tự sửa `.gitignore` khi chưa được duyệt và không xoá file của người dùng.
- [ ] **AC4.1** — Given project mới When `frontend-init` chạy Then `SKILL.md` của nó có bước: `.gitignore` đã có → thêm vào cuối các dòng còn
  thiếu trong `.playwright-mcp/`, `perf/**/results/`, `dist/`; chưa có → tạo với ba dòng đó cộng `node_modules/`; không
  ghi đè hay xoá dòng có sẵn, không thêm dòng env/secret, và báo những dòng đã thêm. Kiểm bằng pin test đọc `SKILL.md`.
- [ ] **AC4.2** — Given `templates/init/` dùng chung When đổi `frontend-init` Then `templates/init/` không đổi (không có
  `.gitignore` chung cho backend/data/ops); kiểm bằng `git diff --name-only` không chứa `templates/init/`.
- [ ] **AC5.1** — Given thay đổi nội dung `plugins/frontend/` When chạy `npm test` Then xanh; manifest `frontend` đã tăng
  version, `plugins/_versions.lock.json` khớp bản build (`node cli/lib/versions.mjs --lock`).

## Không đổi (bugfix)

Không phải bugfix; các hành vi sau giữ nguyên:

- Quy trình Lighthouse hiện có (`lighthouse-cli.md`: lệnh, hỏi trước khi thêm Lighthouse) vẫn dùng được khi project đã có
  hoặc người dùng đồng ý cài.
- Bảng gate P1–P5, ngưỡng 10%, quy tắc đo trên bản build production.
