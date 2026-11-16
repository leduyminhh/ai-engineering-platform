# Thiết kế: Script đo hiệu năng frontend lưu trong `perf/` và `.gitignore` cho artefact đo

- Ngày: 2026-11-13
- Trạng thái: merged 96636a84 (local; chưa push)
- Requirement: [requirement.md](requirement.md)

## Vấn đề và lý do

Trial plugin frontend (mục N5, 4.3 của `docs/requests/2026-11-13-frontend-trial/trial-report.md`) cho thấy khi không có
Lighthouse, agent đo bằng `browser_run_code_unsafe` của Playwright MCP: số đo trung thực nhưng không có script trong
`perf/`, và `.playwright-mcp/` bị bỏ lại untracked. Không có script thì Bước 6 của `workflow-performance` không "chạy
lại nguyên trạng" được và cổng P2 (băm script ở Bước 3, so ở Bước 6) không có đối tượng để băm.

Mục tiêu: có một lối mặc định đo được, tái lập được, nằm trong repo khi chưa có Lighthouse; project mới không bị lẫn
artefact đo vào git. Không nhằm: thay Lighthouse, đo INP, đo trên môi trường ngoài local.

Chỉnh một điểm so với N5: N5 viết "mẫu `.gitignore` của `frontend-init`", nhưng skill này **chưa có** mẫu `.gitignore`
(`templates/init/` chung cho mọi `*-init`, không có file này). Vì vậy phần này là thêm một bước vào `SKILL.md` của
`frontend-init`, không phải sửa mẫu.

## Quyết định đã chốt

Chưa có quyết định nào được người dùng chốt; mọi lựa chọn dưới đây là quyết định của agent, nêu ở G1 để duyệt hoặc sửa.

## Quyết định của agent

1. **Playwright là "tool project đã có" khi `playwright` hoặc `@playwright/test` nằm trong `package.json`** (trả lời câu
   hỏi về `SKILL.md:78`). Thứ tự chọn công cụ: (a) script hoặc config đo project đã có, kể cả script Playwright riêng
   (khớp `lighthouse-cli.md:11`, giữ nguyên); (b) Lighthouse đã cài; (c) script mẫu Playwright; (d) đề xuất Lighthouse
   và hỏi. "Đã cài" = khai trong `package.json` hoặc có trong `node_modules/.bin`; bản global và `npx` tải tạm không
   tính. Lý do: dòng 78 cấm *thêm* tool/dependency; dùng cái đã khai báo không thêm gì, và dòng 41 đã
   nói "ưu tiên công cụ project đã có". Điều kiện kèm theo: nếu Chromium của Playwright chưa cài trên máy thì
   `not_run` + lý do (P1, không tự chạy `playwright install`). Không có Playwright trong `package.json` thì vẫn hỏi như
   cũ (AC1.2). Lighthouse đã cài vẫn được ưu tiên trước Playwright vì cho số chuẩn hơn.
2. **Script mẫu có sẵn trong skill, agent chép vào `perf/` và điền tham số; agent không tự viết từ đầu.** Lý do: script
   có thể test được (AC1.3–AC1.5), người duyệt diff đọc một mẫu đã biết, và Bước 6 so sánh được vì hai lần đo dùng
   cùng mã. Đặt ở `plugins/frontend/skills/frontend-performance/scripts/playwright-measure.mjs`.
3. **`perf/**/results/` không commit** (gitignore); script và `*.conditions.md` được commit sau khi người dùng duyệt diff
   như hiện nay. Số liệu chính thức nằm trong report (kèm dãy số thô, như `lighthouse-cli.md` đã yêu cầu), không phụ
   thuộc file thô. Dùng một dòng `perf/**/results/` thay vì `perf/results/` để khớp `perf/frontend/` và `perf/backend/`
   (agent và `lighthouse-cli.md` đặt output dưới `perf/frontend/`, không phải `perf/results/` như N5 ghi).
4. **Đổi đường dẫn output của `lighthouse-cli.md`** từ `perf/frontend/run-*.json` sang `perf/frontend/results/run-*.json`
   cho thống nhất với script Playwright, và bỏ câu "hỏi người dùng có commit hay thêm vào `.gitignore`" (đã có quyết
   định ở mục 3).
5. **Chỉ số của script Playwright là số riêng, không so với Lighthouse.** LCP và CLS lấy bằng `PerformanceObserver`
   (`largest-contentful-paint`, `layout-shift`); TBT là số xấp xỉ: tổng `(thời lượng − 50 ms)` của các `longtask` bắt
   đầu sau FCP, ghi rõ là xấp xỉ. **Cửa sổ đo:** đợi `load`, rồi `networkidle`, rồi thêm 1000 ms lặng; mọi chỉ số tính
   đến hết cửa sổ đó (builder chỉnh con số nếu spike cho thấy lệch). Cửa sổ ghi vào ô "Công cụ + phiên bản" của bảng
   điều kiện. Bước 6 từ chối so với baseline đo bằng công cụ khác hoặc cửa sổ khác (đã có nguyên tắc "điều kiện lệch →
   từ chối"). Không thêm hàng mới vào bảng điều kiện (bảng cũ không bị coi là thiếu hàng); chỉ điền thêm vào hàng "Công
   cụ + phiên bản", "Thiết bị/throttle" và mục văn xuôi "Chỉ số báo cáo".
6. **Script kiểm P1 và P3 trong code:** kiểm URL đầu vào và URL sau điều hướng ban đầu là `localhost`/`127.0.0.1`/`[::1]` (request tài nguyên con không bị chặn, residual risk), từ chối `--runs` < 3, mỗi lần
   chạy dùng context trình duyệt mới (cache lạnh), throttle CPU qua CDP và ghi nguyên văn vào kết quả. Sửa sau spike
   (Task 1, người dùng duyệt 2026-11-13): throttle CPU mặc định 4× (`--cpu-slowdown 0` tắt; không throttle thì LCP vài
   chục ms nhiễu quá lớn, độ lệch 128% trên `dist` của trial); thêm **một lần warm-up không tính vào median** (lần
   đầu của trình duyệt vừa mở bị lệch: LCP 0 hoặc 980 ms, CLS/TBT mất do shift và long task xảy ra trước paint đầu); thêm
   `--executable-path` tuỳ chọn cho máy mà Chromium cài sẵn lệch bản Playwright (cả hai chỉ dùng bản đã có trên máy,
   không tải gì). Không lấy được Chromium → thoát nêu lý do, agent báo `not_run`.
7. **`frontend-init` thêm bước `.gitignore`:** đã có thì thêm vào cuối các dòng còn thiếu trong
   `.playwright-mcp/`, `perf/**/results/`, `dist/`; chưa có thì tạo với ba dòng đó cộng `node_modules/` (project React
   luôn cần; không thêm dòng env/secret vì thuộc project generator). Báo dòng đã thêm, không đụng dòng có sẵn. Dòng `dist/` kèm ghi chú:
   build ra thư mục khác (vd `.next/`) thì thêm thư mục đó. Danh sách ghi thẳng trong `SKILL.md` (3 dòng), không tạo
   file mẫu riêng.
8. **Sửa agent `frontend-performance-analyst` một câu** ở mục Phạm vi/Được để liệt kê "script đo Playwright" cạnh
   Lighthouse (danh sách hiện đọc như đầy đủ); **không sửa** `workflows/performance/` (Bước 3 chỉ nói "chạy
   Lighthouse/đo bundle", không mâu thuẫn; sửa sẽ kéo thêm bump `workflows` và chạm file chung).
9. **Cỡ: dự án nhỏ gọn, plan dự kiến ≤ 3 task.** Về công sức đây gần mức "thay đổi nhỏ" (tài liệu, 1 script ~60–80 dòng),
   nhưng có hai quyết định thiết kế (Playwright có phải tool có sẵn không; `.gitignore` đặt ở đâu) và một script cần
   test, nên giữ `design.md` ngắn và cho người dùng cổng duyệt riêng. Người dùng muốn cỡ nhỏ thì bỏ `plan.md`, làm
   trực tiếp theo `requirement.md`.

### Các hướng đã cân nhắc

| Hướng | Đánh đổi | Kết luận |
|---|---|---|
| A. Chỉ sửa chữ trong `SKILL.md` ("khi không có Lighthouse, viết script Playwright") | Rẻ nhất; mỗi lần agent tự viết script khác nhau, không test được, người duyệt đọc lại từ đầu | Loại |
| B. **Script mẫu có test trong skill + chữ trong `SKILL.md`** | Thêm một file code và test; đổi lại tái lập được và kiểm P1/P3 bằng code | **Chọn** |
| C. Thêm Lighthouse làm devDependency mặc định | Số chuẩn nhất, nhưng vẫn phải hỏi trước mỗi project, đúng chỗ trial bị kẹt; không giải quyết việc agent bỏ qua script | Loại (vẫn là nhánh "không có Playwright", AC1.2) |
| `.gitignore`: thêm `templates/init/.gitignore` dùng chung | Một chỗ; nhưng backend/data/ops nhận dòng `.playwright-mcp/`; `[Unverified]` npm không ship file tên `.gitignore` trong gói | Loại |
| `.gitignore`: bước trong `SKILL.md` của `frontend-init` | Chỉ frontend; phụ thuộc agent làm đúng chữ | **Chọn** |

## Tiêu chí chấp nhận

Nằm ở [requirement.md](requirement.md) (AC1.1–AC5.1).

## Thiết kế

File đổi (kiểm lại ở plan):

| File | Thay đổi |
|---|---|
| `plugins/frontend/skills/frontend-performance/SKILL.md` | Bước 2 (dòng 39–42): thứ tự chọn công cụ; chép script mẫu vào `perf/<phía>/`; output vào `results/`; không đo bằng công cụ trình duyệt tương tác. Mục an toàn/gate P5: artefact công cụ chưa ignore → report + đề xuất, chờ duyệt. Link `scripts/playwright-measure.mjs` |
| `plugins/frontend/skills/frontend-performance/scripts/playwright-measure.mjs` | Mới. Tham số `--url`, `--runs` (mặc định 5), `--out`, `--cpu-slowdown` tuỳ chọn. Hàm thuần xuất ra: kiểm host, kiểm tham số, `median`, `spread`, tổng hợp. Chỉ tải `playwright` bằng `import()` bên trong hàm chạy, nên test import được khi chưa cài Playwright; chạy trực tiếp mới mở trình duyệt |
| `plugins/frontend/skills/frontend-performance/references/measure-conditions.md` | Hàng "Công cụ + phiên bản", "Thiết bị/throttle" và mục văn xuôi "Chỉ số báo cáo" thêm nhánh Playwright (AC2.1), không thêm hàng; đường dẫn `results/` |
| `plugins/frontend/skills/frontend-performance/references/lighthouse-cli.md` | Đổi đường dẫn output sang `results/`; bỏ câu hỏi commit/gitignore |
| `plugins/frontend/agents/frontend-performance-analyst.md` | Một câu ở "Được" |
| `plugins/frontend/skills/frontend-init/SKILL.md` | Bước mới `.gitignore`; cập nhật dòng "Ranh giới an toàn" (thêm file vào `.gitignore` là ngoại lệ có chủ đích của "chỉ thêm file chưa có") |
| `plugins/frontend/.manifest.json`, `plugins/_versions.lock.json` | Tăng version (đề xuất minor vì có file mới), `node cli/lib/versions.mjs --lock` sau `npm run build`; xung đột với N1–N4 xử lý khi merge |
| `test/content/12-frontend-performance.pin.mjs` (hoặc test riêng) | Test đơn vị hàm thuần của script (AC1.3–1.5) + pin vận hành cho thứ tự công cụ và đường dẫn `results/` (AC1.1, 2.1, 3.1, 4.1) |

Luồng khi `measure` (project có Playwright, không có Lighthouse): chốt bảng điều kiện → chép script mẫu vào
`perf/frontend/measure.mjs` → phục vụ bản build production → `node perf/frontend/measure.mjs --url http://localhost:4173/…
--runs 5 --out perf/frontend/results/playwright` → script in median, độ lệch, dãy thô và ghi JSON thô → report ghi lệnh nguyên văn.
Bước 6 băm lại script, build + phục vụ lại, chạy lại đúng lệnh.

## Ảnh hưởng spec

Không ảnh hưởng: chỉ đổi nội dung skill/agent của plugin `frontend` và thêm một script; đã đọc `docs/specs/README.md`
(8 năng lực: projection, install-lifecycle, hooks-gates, workflows, artifact-templates, baseline, cli-wizard,
skill-quality), không năng lực nào mô tả nội dung từng skill, và `description` skill, graph workflow, hook không đổi.

## Ngoài phạm vi và anti-goal

- Không thêm Lighthouse hay dependency nào vào project; không chạy `playwright install`.
- Không đo INP, không đo trên dev server hay URL ngoài local.
- Không sửa `workflows/performance/`, `templates/init/`, và các file riêng của N1–N4.
- Không viết kiểm tra tự động cho hành vi của agent ở `npm test` (cần chạy lại trial thật, tốn chi phí model).

## Ràng buộc

- Giữ nguyên tên và ý nghĩa gate P1–P5; test pin hiện có ở `test/content/12-frontend-performance.pin.mjs` vẫn xanh.
- Script không có phụ thuộc runtime ngoài `playwright` (đã có ở project) và built-in Node 20+.
- Comment trong script viết tiếng Việt, chỉ giải thích lý do.

## Kiểm thử

| AC | Tầng |
|---|---|
| AC1.3, AC1.4, AC1.5 | Đơn vị, hàm thuần của script; một test tham số hoá mỗi hành vi |
| AC1.1, AC2.1, AC3.1, AC4.1 | Pin vận hành trên `SKILL.md`/references (thứ tự công cụ, đường dẫn, dòng `.gitignore`); không pin câu chữ khác |
| AC1.2, AC3.2 | Giữ nguyên hành vi hiện có và quy tắc "hỏi trước"; kiểm bằng đọc diff ở review cuối |
| AC4.2 | `git diff --name-only` lúc review cuối |
| AC5.1 | `npm test`, `node cli/lib/versions.mjs --lock` |
| Hành vi agent thật (dùng script thay vì MCP, không còn `.playwright-mcp/`) | Chạy lại lượt 7 của trial trên `E:\Mine\AI\aip-frontend-trial` sau khi merge; `[Inference]` cho đến lúc đó |

## Để builder quyết

- Tên tham số CLI, định dạng JSON thô, cách bật throttle CDP, cách lấy phiên bản Chromium, giá trị chính xác của cửa sổ
  đo (mục 5, sau spike).
- Test đơn vị đặt trong module pin hiện có hay file test riêng (file riêng phải thêm vào script `test` của `package.json`).
- Câu chữ chính xác của bước `.gitignore` trong `frontend-init`.

## Rủi ro và câu hỏi mở

- **Kết quả spike (Task 1, 2026-11-13):** nạp `playwright` và `@playwright/test` (1.65.0) đều được; `PerformanceObserver`
  (`largest-contentful-paint`, `layout-shift`, `paint`, `longtask`, `buffered: true`) và CDP `Emulation.setCPUThrottlingRate`
  chạy; fixture cho CLS 0,0903 và TBT xấp xỉ 70 ms đúng như dựng. **Tiêu chí ≤ 10% không đạt:** trên `dist` của trial
  (chỉ đọc, server tạm, có warm-up) LCP không throttle 252/136/104/104/116 ms (độ lệch 128%), throttle 4×
  224/240/240/248/252 ms (11,7%); lần đầu của trình duyệt mới lệch; Chromium cài sẵn là 1228 còn Playwright 1.65.0 đòi
  1254 nên `launch()` lỗi nếu không có `executablePath`. Người dùng chọn giữ hướng B với sửa ở quyết định 6; độ lệch
  > 10% vẫn xử lý bằng P3 (cảnh báo, tăng số lần, không kết luận). Lệnh chạy lại: chạy script Task 2 trên một bản build
  (`node perf/frontend/measure.mjs --url <localhost> --runs 5`). Chưa kiểm trên trang có dữ liệu thật (`dist` của trial
  không có API mock chạy).
- [Unverified, đã kiểm một phần ở spike] Script chưa chạy với Playwright thật: API `PerformanceObserver` với `buffered: true`, CDP throttle, cách
  lấy LCP sau `load` chưa kiểm. Task đầu của plan là spike, chạy trong thư mục tạm ngoài repo (repo này zero-dependency,
  không thêm Playwright vào `package.json`). Nơi chạy: bản build của project trial `E:\Mine\AI\aip-frontend-trial`
  (đã có Playwright cho E2E; Chromium có sẵn hay không chưa kiểm) hoặc một trang tĩnh nhỏ; chỉ đọc project trial.
  Đạt khi 5 lần liên tiếp lấy được LCP và CLS và độ lệch LCP ≤ 10% (ngưỡng P3 mặc định). Chưa có Chromium thì dừng
  spike, báo người dùng, không tự tải; tải gói hay Chromium là việc của người dùng. Không đạt thì builder dừng và báo
  người dùng chọn lùi về hướng A kèm quy tắc hoặc cài Lighthouse; không tự đổi hướng. Không chạy được spike thì
  AC1.3–AC1.5 vẫn kiểm bằng hàm thuần, phần đo thật ghi `not_run` ở báo cáo cuối.
- [Unverified] `@playwright/test` có xuất `chromium` để `import` trực tiếp không; spike kiểm, nếu không thì script
  nạp `playwright` rồi lùi về `@playwright/test`.
- [Inference] TBT xấp xỉ từ `longtask` lệch Lighthouse (Lighthouse tính trong khoảng FCP–TTI với throttle mô phỏng); vì
  vậy báo cáo gắn nhãn xấp xỉ và chỉ so cùng công cụ. Nếu người dùng cần số chuẩn thì dùng Lighthouse.
- Chromium của Playwright có thể chưa cài trên máy dù package đã có → `not_run`, người dùng tự cài; khi đó vẫn không có số
  đo. Chấp nhận.
- `frontend-init` có `disable-model-invocation: true` và chạy một lần ở project mới, nên bước `.gitignore` không cứu project
  đã có (như project trial); phần đó do AC3.2 của `frontend-performance` xử lý (báo + đề xuất dòng).
- Còn mở sau review cuối (Ruling hoãn): câu P3 "median bằng 0" ở `measure-conditions.md` chưa có "không kết luận từ chỉ số này" nên mâu thuẫn một phần với dòng CLS gần 0 của `lighthouse-cli.md`; sửa một câu tài liệu, chưa làm vì không còn làn sửa thứ hai trong lúc thực thi. Các minor còn lại: header script và `SKILL.md` ghi exit 1 "redirect ra host ngoài trong lúc đo" rộng hơn code (chỉ kiểm một lần sau `goto`), bước `.gitignore` của `frontend-init` nhắc stack chốt ở bước 3 (đứng sau), pin `lighthouse-cli.md` giòn theo chuỗi, điều kiện chạy main nuốt lỗi `realpathSync` và thoát 0, câu "hay gặp ở CLS và TBT" chưa gắn nhãn [Inference].
- Hoãn sang G3 (chưa làm, residual risk): chặn request tài nguyên con và redirect bằng JS sau điều hướng ban đầu, giới hạn `--out` trong project, cận trên `--runs`, từ chối URL có userinfo, kiểm `--executable-path`. [Inference] Độ lệch (max − min) / median có thể không giảm khi tăng số lần đo (khoảng rộng của mẫu tăng theo cỡ mẫu), nên "tăng số lần lặp" của P3 không bảo đảm đưa độ lệch xuống dưới ngưỡng.
- Câu hỏi mở cho G1: (1) chấp nhận quyết định 1 (Playwright dependency có sẵn = tool có sẵn) hay vẫn muốn hỏi trước mỗi
  lần? (2) Chấp nhận hướng B (có script mẫu + test) hay chỉ sửa chữ (hướng A)? (3) Cỡ: giữ dự án nhỏ gọn hay hạ xuống
  thay đổi nhỏ?
