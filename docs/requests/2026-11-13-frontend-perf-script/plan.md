# Script đo hiệu năng frontend Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** khi `frontend-performance` đo mà không có Lighthouse, agent chép một script đo Node + Playwright vào `perf/` (chạy lại được bằng một lệnh) thay vì đo bằng công cụ trình duyệt tương tác; `frontend-init` thêm bước `.gitignore` cho artefact đo.
**Architecture:** một script mẫu trong `scripts/` của skill, hàm thuần xuất ra để test, phần mở trình duyệt chỉ chạy khi gọi trực tiếp (cùng kiểu `engineering-spec-backfill/scripts/check-citations.mjs`); phần còn lại là sửa tài liệu của plugin `frontend` kèm pin vận hành.
**Tech Stack:** Node ESM, Playwright của project đích (không thêm vào repo này); test tự viết ở `test/content/`.
**Spec:** design.md
**Requirement:** requirement.md

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/frontend/skills/frontend-performance/scripts/playwright-measure.mjs` | script mẫu: kiểm host/tham số, đo, tổng hợp median và độ lệch | Task 2 |
| `test/content/12-frontend-perf-script.pin.mjs` | test đơn vị hàm thuần của script (AC1.3–1.5) và pin vận hành của `SKILL.md`/references/`frontend-init` (AC1.1, 2.1, 3.1, 4.1) | Task 2, Task 3, Task 4 |
| `plugins/frontend/skills/frontend-performance/SKILL.md` | Bước 2: thứ tự chọn công cụ, chép script, output `results/`; mục an toàn: artefact chưa ignore | Task 3 |
| `plugins/frontend/skills/frontend-performance/references/measure-conditions.md` | hàng "Công cụ + phiên bản", "Thiết bị/throttle", mục "Chỉ số báo cáo" thêm nhánh Playwright; đường dẫn `results/` | Task 3 |
| `plugins/frontend/skills/frontend-performance/references/lighthouse-cli.md` | output sang `results/`, bỏ câu hỏi commit/gitignore | Task 3 |
| `plugins/frontend/agents/frontend-performance-analyst.md` | một câu ở mục Phạm vi/Được | Task 3 |
| `plugins/frontend/skills/frontend-init/SKILL.md` | bước `.gitignore`; sửa dòng Ranh giới an toàn | Task 4 |
| `plugins/frontend/.manifest.json`, `plugins/_versions.lock.json` | bump `frontend` 1.16.3 → 1.17.0, khoá version | Task 4 |
| `CHANGELOG.md` | dòng Added dưới `[Unreleased]` | Task 4 |

Không đổi: `templates/init/`, `workflows/`, và các thư mục riêng của N1–N4.

## Global Constraints
- Số lần đo `--runs` mặc định 5, tối thiểu 3. Host hợp lệ: `localhost`, `127.0.0.1`, `[::1]` (giao thức `http` hoặc `https`).
- Cửa sổ đo: đợi `load`, rồi `networkidle`, rồi thêm 1000 ms lặng (giá trị chỉnh sau spike, Task 1). TBT xấp xỉ = tổng `(thời lượng − 50 ms)` của các `longtask` bắt đầu sau FCP. Mỗi lần đo dùng context trình duyệt mới (cache lạnh).
- Median số lần chẵn lấy phần tử trên giữa, không nội suy; độ lệch = `(max − min) / median`, `null` khi median bằng 0.
- Output thô nằm ở `perf/<phía>/results/` (mặc định `perf/frontend/results/`); dòng `.gitignore` là `perf/**/results/`.
- Dòng `.gitignore` của `frontend-init`: `.playwright-mcp/`, `perf/**/results/`, `dist/`, và `node_modules/` khi tạo file mới; không thêm dòng env/secret.
- Không thêm Playwright hay dependency nào vào `package.json` của repo này; không chạy `playwright install` (Chromium thiếu → `not_run`, báo người dùng).
- Không đổi `description` của skill hay agent; không sửa `workflows/`, `templates/init/`, `frontend-implement`, `frontend-code-review`, `frontend-fix`, `frontend-data-integration`, `frontend-testing`.
- Văn bản tiếng Việt có dấu, UTF-8 không BOM, LF; comment code chỉ giải thích lý do.
- Mỗi task: commit riêng trên nhánh của request qua `core:git-workflow` (header tiếng Anh, body tiếng Việt, `git commit -F`, không `Co-Authored-By`); không push.
- Bump version và `node cli/lib/versions.mjs --lock` chỉ ở Task 4, sau `npm run build`; `npm test` chạy một lần ở Task 4.

## Review Focus
- Task 2: host lừa (`http://localhost.evil.com/`, `http://127.0.0.1.evil.com/`) bị từ chối — ca tham số hoá của test `assertLocalUrl`.
- Task 2: import module khi chưa cài Playwright không lỗi và không mở trình duyệt — test import trong cùng file test.
- Task 2: CLS bằng 0 cho độ lệch `null`, không `Infinity`/`NaN` — ca tham số hoá của test `summarize`.
- Task 3: chuỗi `results/` xuất hiện nhất quán ở `SKILL.md`, `measure-conditions.md`, `lighthouse-cli.md` — pin AC3.1.
- Task 3: pin hiện có của `frontend-performance` (P1–P5, `blocked`, `[Unverified]` trong references) vẫn xanh — `node test/validate.mjs --only frontend-performance`.

### Task 1: spike giả định về Playwright
**Kind:** TOOLING
**TDD:** không — spike bỏ đi, không đưa vào nhánh; kết quả ghi vào báo cáo task
**Ước lượng:** 25'
**Phủ AC:** AC1.1
**Files:**
- Create: không có trong repo (script và fixture tạm ở thư mục scratchpad)
- Test: không có (spike bỏ đi)

**Interfaces:**
- Consumes: không có
- Produces: báo cáo task nêu (a) API nạp `chromium` hoạt động (`playwright` hoặc `@playwright/test`), (b) cách lấy LCP/CLS/longtask bằng `PerformanceObserver`, (c) cách đặt CPU slowdown qua CDP, (d) cửa sổ đo cuối cùng, (e) kết quả 5 lần liên tiếp; Task 2 dùng các giá trị này

- [ ] **Step 1:** kiểm Chromium của Playwright có sẵn: nạp Playwright bằng `createRequire` trỏ vào `E:\Mine\AI\aip-frontend-trial\package.json` (chỉ đọc), chạy `chromium.launch()` rồi đóng. Không chạy được → dừng task, báo `blocked` + câu hỏi cho người dùng (không tự tải gói hay Chromium).
- [ ] **Step 2:** dựng fixture tĩnh trong scratchpad (một trang có ảnh lớn làm LCP, một khối dịch chuyển bố cục, một vòng lặp chặn ≥ 100 ms) phục vụ bằng `node:http` ở `127.0.0.1`. Viết script nháp tạo context mới mỗi lần, đặt CPU slowdown qua CDP (`Emulation.setCPUThrottlingRate`), đợi `load` → `networkidle` → 1000 ms, đọc LCP, CLS, longtask bằng `PerformanceObserver` `buffered: true`. Thử với `playwright` và với `@playwright/test`; ghi cái nào nạp được.
- [ ] **Step 3:** chạy 5 lần liên tiếp, ghi LCP/TBT-xấp-xỉ/CLS thô và độ lệch. Đạt khi 5 lần đều lấy được LCP và CLS và độ lệch LCP ≤ 10%. Không đạt → dừng, báo người dùng chọn lùi hướng A kèm quy tắc hoặc cài Lighthouse; không tự đổi hướng. Chỉnh cửa sổ đo nếu độ lệch vượt ngưỡng do chờ chưa đủ.
- [ ] **Step 4:** ghi kết quả (a)–(e) vào báo cáo task; xoá fixture và script nháp trong scratchpad. Không commit.

### Task 2: script đo `playwright-measure.mjs` và test hàm thuần
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25'
**Phủ AC:** AC1.3, AC1.4, AC1.5
**Files:**
- Create: `plugins/frontend/skills/frontend-performance/scripts/playwright-measure.mjs`
- Create: `test/content/12-frontend-perf-script.pin.mjs`
- Test: `test/content/12-frontend-perf-script.pin.mjs`

**Interfaces:**
- Consumes: kết quả spike của Task 1 (cách nạp Playwright, cách lấy chỉ số, cách throttle, cửa sổ đo)
- Produces: `assertLocalUrl(url)` trả `URL`, ném lỗi khi host ngoài `localhost`/`127.0.0.1`/`[::1]` hay giao thức khác `http`/`https`; `parseArgs(argv)` trả `{ url, runs, out, cpuSlowdown }`, ném lỗi khi thiếu `--url` hoặc `--runs` < 3, mặc định `runs` 5, `out` `perf/frontend/results`, `cpuSlowdown` `null`; `median(xs)`; `spread(xs)` trả `number | null`; `summarize(runs)` trả `{ lcp, tbt, cls }` mỗi khoá có `{ median, spread, raw }`; CLI `node <đường dẫn script> --url <url> [--runs <n>] [--out <thư mục>] [--cpu-slowdown <n>]`

- [ ] **Step 1:** viết `test/content/12-frontend-perf-script.pin.mjs` (một module `export default async function run({ ok, ctx })`), import script bằng đường dẫn tuyệt đối qua `pathToFileURL`. Ba test tham số hoá: (1) `assertLocalUrl` với `http://localhost:4173/`, `http://127.0.0.1:4173/`, `http://[::1]:4173/` hợp lệ và `https://example.com/`, `http://localhost.evil.com/`, `http://127.0.0.1.evil.com/`, `file:///etc/passwd` bị từ chối (AC1.3); (2) `parseArgs` với `--runs` 2 và 0 bị từ chối, 3 và mặc định 5 hợp lệ, thiếu `--url` bị từ chối (AC1.4); (3) `summarize` với `[100,120,110,130]` cho median 120 và độ lệch 0.25, dãy lẻ `[3,1,2]` cho median 2, dãy CLS toàn 0 cho độ lệch `null` (AC1.5). Thêm một assert: import module không ném lỗi khi chưa cài Playwright. Chạy `node test/validate.mjs --only frontend-perf-script`: đỏ vì file script chưa có.
- [ ] **Step 2:** tạo `playwright-measure.mjs`: các hàm trong Interfaces, comment tiếng Việt chỉ giải thích lý do (vì sao lấy phần tử trên giữa, vì sao nạp Playwright trong hàm, vì sao context mới mỗi lần). Khối chạy trực tiếp đặt sau kiểm `import.meta.url === pathToFileURL(process.argv[1]).href`, nạp Playwright bằng `import()` bên trong hàm chạy (thử `playwright` rồi `@playwright/test`, ghi tên gói đã dùng và phiên bản Chromium vào JSON), mỗi lần ghi `run-<i>.json` vào `--out`, cuối in median, độ lệch và dãy thô theo định dạng của `lighthouse-cli.md`. Chạy lại bước 1: xanh.
- [ ] **Step 3:** chạy script thật một lần trên fixture đã dùng ở Task 1 (dựng lại trong scratchpad; Playwright nạp từ project trial) để xác nhận khối chạy trực tiếp hoạt động; dọn fixture, không commit output. Không chạy được vì thiếu Chromium → ghi `not_run` + lý do ở báo cáo task, không đổi code.
- [ ] **Step 4:** commit test đỏ trước (`test(frontend): add playwright-measure unit tests`), rồi code (`feat(frontend): add playwright measure script for frontend-performance`).

### Task 3: tài liệu `frontend-performance` và agent
**Kind:** DOCS
**TDD:** không — tài liệu, pin viết sau khi sửa chữ
**Ước lượng:** 25'
**Phủ AC:** AC1.1, AC1.2, AC2.1, AC3.1, AC3.2
**Files:**
- Modify: `plugins/frontend/skills/frontend-performance/SKILL.md`
- Modify: `plugins/frontend/skills/frontend-performance/references/measure-conditions.md`
- Modify: `plugins/frontend/skills/frontend-performance/references/lighthouse-cli.md`
- Modify: `plugins/frontend/agents/frontend-performance-analyst.md`
- Test: `test/content/12-frontend-perf-script.pin.mjs`

**Interfaces:**
- Consumes: đường dẫn `scripts/playwright-measure.mjs` và cờ `--url`, `--runs`, `--out`, `--cpu-slowdown` của Task 2
- Produces: không có

- [ ] **Step 1:** sửa `SKILL.md` Bước 2 (hiện ở dòng 39–42 trước khi sửa; grep lại): thứ tự chọn công cụ (a) script/config đo project đã có, kể cả script Playwright riêng, (b) Lighthouse đã cài, (c) script mẫu Playwright khi `playwright`/`@playwright/test` có trong `package.json`, chép từ `scripts/playwright-measure.mjs` vào `perf/<phía>/`, (d) đề xuất Lighthouse và hỏi. Nêu "đã cài" = khai trong `package.json` hoặc có trong `node_modules/.bin`, không tính global hay `npx` tải tạm. Nêu không đo bằng công cụ trình duyệt tương tác (`browser_run_code_unsafe`). Output vào `perf/<phía>/results/`. Thêm vào mục an toàn/P5: artefact công cụ chưa ignore (`.playwright-mcp/`, `perf/**/results/`, thư mục output build) → report nêu đường dẫn và dòng `.gitignore` đề xuất, chờ người dùng duyệt (Config tool đo), không tự sửa, không xoá file người dùng. Thêm link `(scripts/playwright-measure.mjs)`. Giữ nguyên dòng "Hỏi trước khi thêm tool/dependency" và bảng gate P1–P5.
- [ ] **Step 2:** sửa `measure-conditions.md`: hàng "Công cụ + phiên bản" thêm nhánh Playwright + Chromium kèm cửa sổ đo; hàng "Thiết bị/throttle" thêm "CPU slowdown nguyên văn hoặc không throttle"; mục "Chỉ số báo cáo" nêu LCP/CLS bằng `PerformanceObserver`, TBT xấp xỉ từ long task không phải số Lighthouse, Bước 6 chỉ so cùng công cụ và cửa sổ. Không thêm hàng mới. Đổi đường dẫn output sang `results/`. Sửa `lighthouse-cli.md`: `--output-path=perf/frontend/results/run-1.json`, lệnh `summarize` đọc từ `results/`, bỏ câu "hỏi người dùng có commit hay thêm vào `.gitignore`" và thay bằng một câu: output thô không commit, dòng `perf/**/results/`. Sửa `frontend-performance-analyst.md` mục Phạm vi/Được: thêm "script đo Playwright" cạnh Lighthouse.
- [ ] **Step 3:** thêm vào `test/content/12-frontend-perf-script.pin.mjs` các pin vận hành: `SKILL.md` nêu đủ bốn bước theo thứ tự (a)→(d) và còn câu "Hỏi trước khi thêm tool/dependency" (AC1.1, AC1.2); `SKILL.md`, `measure-conditions.md`, `lighthouse-cli.md` đều chứa `results/` và không còn `perf/frontend/run-` (AC3.1); `measure-conditions.md` nêu `PerformanceObserver` và "xấp xỉ" (AC2.1). Chạy `node test/validate.mjs --only frontend-perf` và `node test/validate.mjs --only frontend-performance`: xanh, pin cũ vẫn xanh.
- [ ] **Step 4:** đối chiếu khẳng định với code. Liệt kê từng khẳng định kiểm được trong phần vừa viết (tên cờ CLI, đường dẫn `scripts/playwright-measure.mjs`, `perf/**/results/`, hàng của bảng điều kiện, tên gate P1–P5, số dòng nếu có), đối chiếu với `playwright-measure.mjs`, `measure-conditions.md` và `SKILL.md` bằng grep; ghi vào báo cáo task bảng `khẳng định → file:line → khớp|lệch`; dòng lệch thì sửa tài liệu hoặc gắn `[Unverified]`.
- [ ] **Step 5:** commit `docs(frontend): guide frontend-performance to a saved Playwright measure script`.

### Task 4: `frontend-init` thêm bước `.gitignore`, bump version, kiểm toàn bộ
**Kind:** DOCS
**TDD:** không — tài liệu, pin viết sau khi sửa chữ
**Ước lượng:** 20'
**Phủ AC:** AC4.1, AC4.2, AC5.1
**Files:**
- Modify: `plugins/frontend/skills/frontend-init/SKILL.md`
- Modify: `plugins/frontend/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Modify: `CHANGELOG.md`
- Test: `test/content/12-frontend-perf-script.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** sửa `frontend-init/SKILL.md`: thêm một bước (sau bước 1 "Khung chung") về `.gitignore`: đã có thì thêm vào cuối các dòng còn thiếu trong `.playwright-mcp/`, `perf/**/results/`, `dist/`; chưa có thì tạo với ba dòng đó cộng `node_modules/`; không ghi đè hay xoá dòng có sẵn, không thêm dòng env/secret, báo dòng đã thêm; ghi chú build ra thư mục khác (vd `.next/`) thì thêm thư mục đó. Sửa dòng "Ranh giới an toàn" (hiện ở dòng 61 trước khi sửa; grep lại): `.gitignore` là ngoại lệ có chủ đích, chỉ thêm dòng còn thiếu. Giữ `disable-model-invocation: true` và mục "chỉ scaffold tài liệu".
- [ ] **Step 2:** thêm vào `test/content/12-frontend-perf-script.pin.mjs` pin: `frontend-init/SKILL.md` chứa cả bốn dòng `.playwright-mcp/`, `perf/**/results/`, `dist/`, `node_modules/` và nêu "không ghi đè" (AC4.1). Chạy `node test/validate.mjs --only frontend-perf`: xanh.
- [ ] **Step 3:** bump `plugins/frontend/.manifest.json` `version` 1.16.3 → 1.17.0 (grep lại giá trị hiện tại trước khi sửa; nhánh anh em có thể đã đổi), thêm dòng Added ở `CHANGELOG.md` dưới `[Unreleased]` theo định dạng các dòng hiện có (request, version frontend). Chạy `npm run build`, rồi `node cli/lib/versions.mjs --lock`.
- [ ] **Step 4:** kiểm AC4.2: `git diff --name-only <base>..HEAD` không chứa `templates/init/`, `workflows/` hay thư mục riêng của N1–N4. Chạy `npm test` một lần: xanh; báo exit code và tóm tắt số pass. Đối chiếu `git diff --name-only` của cả nhánh với Bản đồ file: không file ngoài bảng.
- [ ] **Step 5:** commit `docs(frontend): add gitignore step to frontend-init and bump frontend 1.17.0`.
