# Frontend visible-assertion Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** `frontend-testing` buộc AC hiển thị có assertion trên text/role ở cuối chuỗi sự kiện; `frontend-code-review` bắt thông báo nằm trong vùng bị gỡ lúc loading và AC hiển thị thiếu assertion.
**Architecture:** chỉ đổi nội dung chiếu của plugin `frontend` (hai skill) và thêm một pin nội dung; không đổi code CLI, hook, adapter, agent.
**Tech Stack:** Markdown tiếng Việt có dấu; pin `test/content/*.pin.mjs` (Node ESM, `ok`/`ctx` của `test/harness.mjs`); `node cli/lib/versions.mjs --lock`; `npm test`.
**Spec:** design.md
**Requirement:** requirement.md

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `test/content/54-frontend-visible-assert.pin.mjs` | Pin ba chuỗi: gate T7, dấu hiệu Trục 1, câu hỏi Trục 6 | Task 1 |
| `plugins/frontend/skills/frontend-testing/SKILL.md` | Hàng gate `T7` và một câu trỏ ở bước 2 | Task 2 |
| `plugins/frontend/skills/frontend-testing/references/react-testing-patterns.md` | Mục con "AC hiển thị" trong §4 kèm ví dụ trial; dòng 67–68 trỏ tới mục con | Task 2 |
| `plugins/frontend/skills/frontend-code-review/references/review-dimensions.md` | Bullet Trục 1 (loading/error/empty) và bullet Trục 6 | Task 3 |
| `plugins/frontend/.manifest.json` | Bump version 1.16.3 → 1.16.4 | Task 4 |
| `plugins/_versions.lock.json` | Khoá phiên bản sinh bằng `versions.mjs --lock` | Task 4 |

## Global Constraints
- Văn bản tiếng Việt có dấu, UTF-8 không BOM, LF; comment trong file ví dụ/test nêu *vì sao*, không kể *cái gì*.
- Chuỗi cố định (pin bám theo, viết đúng từng ký tự; pin chuẩn hoá khoảng trắng nên bullet được xuống dòng):
  - `frontend-testing/SKILL.md`: hàng bảng gate bắt đầu `| T7 |` và chứa cả `text hoặc role` lẫn `trạng thái cuối`.
  - `review-dimensions.md` Trục 1: bullet bắt đầu `**Thông báo do hành động gây ra nằm trong vùng bị gỡ khi loading:**`.
  - `review-dimensions.md` Trục 6: câu hỏi chứa `AC mô tả thứ người dùng thấy` và `trạng thái cuối chuỗi sự kiện`.
- Nội dung phải đủ các ý của AC1.1–AC2.2 trong `requirement.md` (kể cả D8: AC chưa có test ở tầng ghép thì thêm một test cho AC đó; AC không có chuỗi sự kiện thì assert ngay sau thao tác).
- Severity: thông báo AC bị gỡ lúc loading (proven) là `major`; AC hiển thị thiếu assertion `major` khi là thông báo lỗi hoặc xác nhận, `minor` còn lại. Không sửa bảng Severity.
- Không sửa: Trục 4 (A11y) của `review-dimensions.md`, `AGENTS.md`, `core/agents/AGENTS.template.md`, `plugins/frontend/agents/*`, `workflows/`, `plugins/frontend/skills/frontend-implement/`, `frontend-fix/`, `frontend-data-integration/`.
- Version `frontend` mới là `1.16.4`.
- Commit qua `core:git-workflow`: header tiếng Anh `type(scope): summary`, body tiếng Việt, `git commit -F`, không `Co-Authored-By`; mỗi lệnh Bash một lần gọi; không push, không merge; không `git stash` trần.

## Review Focus
- Pin phải đỏ khi nội dung bị gỡ, không chỉ xanh khi nội dung có mặt: Task 4 step 3 gỡ tạm T7 ở bản sao và chạy pin.
- Trục 4 (A11y) của `review-dimensions.md` không có hunk nào: Task 3 step 3 (`git diff` theo hunk).
- Ví dụ ở `react-testing-patterns.md` §4 khớp trial (tên test, chuỗi thông báo, nhãn `1–10 / 24`): bảng đối chiếu của Task 2 step 3.
- Gate T7 và mục con không mâu thuẫn với `test-strategy.md` §4 và nguyên tắc "một hành vi một test" của AGENTS.md: Task 2 step 4.

### Task 1: Pin nội dung ba chuỗi (đỏ trước)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 10'
**Phủ AC:** AC1.1, AC2.1, AC2.2, AC4.2
**Files:**
- Create: `test/content/54-frontend-visible-assert.pin.mjs`
- Test: `test/content/54-frontend-visible-assert.pin.mjs`

**Interfaces:**
- Consumes: `export default async function run({ ok, ctx })` của `test/harness.mjs`, `ctx.fs`, `ctx.path`, `ctx.PLUGINS_DIR` (cùng mẫu `test/content/51-enrich-frontend.pin.mjs`).
- Produces: ba kiểm `ok(...)` mang nhãn `AC1.1`, `AC2.1`, `AC2.2` mà Task 2 và Task 3 làm xanh; chạy được bằng `node test/validate.mjs --only visible-assert`.

- [ ] **Step 1:** Đọc `test/content/51-enrich-frontend.pin.mjs` và `test/harness.mjs` để theo đúng mẫu `ok`/`ctx`; chạy `node test/validate.mjs --only enrich-frontend` làm đối chứng, kết quả mong đợi exit 0.
- [ ] **Step 2:** Viết pin: đọc ba file (`frontend-testing/SKILL.md`, `frontend-code-review/references/review-dimensions.md`), chuẩn hoá `\s+` thành một dấu cách, `ok` cho từng chuỗi ở mục Global Constraints; thông điệp mỗi `ok` bắt đầu bằng ID AC (`AC1.1 frontend-testing: …`). Một comment nêu vì sao pin (bảo vệ ba quy tắc nội dung khỏi bị xoá lặng lẽ, chưa có contract nào kiểm).
- [ ] **Step 3:** Chạy `node test/validate.mjs --only visible-assert`; kết quả mong đợi: exit 1, đúng ba kiểm fail (nội dung chưa có), không lỗi cú pháp.
- [ ] **Step 4:** Commit file pin (test đỏ riêng) qua `core:git-workflow`, header `test(frontend): pin visible-assertion rules`.

### Task 2: Gate T7 và mục con trong frontend-testing
**Kind:** DOCS
**Phủ AC:** AC1.1, AC1.2, AC1.3
**Ước lượng:** 25'
**Files:**
- Modify: `plugins/frontend/skills/frontend-testing/SKILL.md`
- Modify: `plugins/frontend/skills/frontend-testing/references/react-testing-patterns.md`
- Test: `test/content/54-frontend-visible-assert.pin.mjs`

**Interfaces:**
- Consumes: ba chuỗi cố định của Global Constraints (phần `frontend-testing/SKILL.md`); pin của Task 1.
- Produces: hàng `| T7 |` trong bảng gate; mục con "AC hiển thị: assert ở cuối chuỗi sự kiện" trong §4 của `react-testing-patterns.md` mà hàng T7 trỏ tới.

- [ ] **Step 1:** `SKILL.md`: thêm hàng `T7` vào bảng gate (cột Bước = 2; "Đỏ thì" = thêm assertion vào test đã có của AC, hoặc ghi AC vào khoảng trống chưa phủ ở báo cáo), và một câu ở bullet "Tầng chạm data" của bước 2 trỏ tới T7 và mục con. Nêu trong hàng/câu: assert request log, state hook, mock được gọi không thoả; AC không có chuỗi sự kiện thì assert ngay sau thao tác; chỉ áp khi có AC mô tả thứ người dùng thấy.
- [ ] **Step 2:** `react-testing-patterns.md` §4: thêm mục con ngay sau dòng 67–68 gồm bốn ý (điểm assert = sau khi mọi request và lần tải lại của chuỗi xong, chờ bằng `findBy*` trên một thứ hiển thị cuối chuỗi rồi mới assert thông báo; assert request log/state hook/mock không tính; assertion vào test đã có ở tầng thấp nhất render cả nguồn lẫn vùng chứa, AC chưa có test ở tầng đó thì thêm một test; ví dụ trial với ca đối chứng và lý do hook/trình bày xanh mà trang vẫn sai); dòng 67–68 thêm cụm trỏ xuống mục con, không viết lại.
- [ ] **Step 3 (đối chiếu khẳng định với code):** liệt kê khẳng định kiểm được của ví dụ (tên test AC3.5, chuỗi `Ticket không còn tồn tại. Danh sách đã được tải lại.`, nhãn `1–10 / 24`, `role="alert"`, thứ tự `PATCH` → `GET`, `TicketList.tsx` chỉ vẽ danh sách khi `state.kind === 'ready'`) và đối chiếu từng khẳng định với `git -C E:/Mine/AI/aip-frontend-trial show 2587135:<đường dẫn>`; ghi vào báo cáo task bảng `khẳng định → file:line → khớp|lệch`. Dòng `lệch` thì sửa docs hoặc gắn `[Unverified]`.
- [ ] **Step 4:** Đọc lại `test-strategy.md` §4 và nguyên tắc "một hành vi một test" của `AGENTS.md` mục Testing; xác nhận T7 và mục con không mâu thuẫn (ghi một dòng kết luận vào báo cáo).
- [ ] **Step 5:** Chạy `node test/validate.mjs --only visible-assert`; kết quả mong đợi: kiểm `AC1.1` xanh, hai kiểm còn lại (Trục 1, Trục 6) vẫn đỏ. Commit qua `core:git-workflow`, header `docs(frontend): add visible-assertion gate to frontend-testing`.

### Task 3: Dấu hiệu Trục 1 và câu hỏi Trục 6 trong review-dimensions
**Kind:** DOCS
**Phủ AC:** AC2.1, AC2.2, AC3.1, AC3.2
**Ước lượng:** 20'
**Files:**
- Modify: `plugins/frontend/skills/frontend-code-review/references/review-dimensions.md`
- Test: `test/content/54-frontend-visible-assert.pin.mjs`

**Interfaces:**
- Consumes: hai chuỗi cố định `review-dimensions.md` của Global Constraints; pin của Task 1.
- Produces: bullet Trục 1 `**Thông báo do hành động gây ra nằm trong vùng bị gỡ khi loading:**` và câu hỏi Trục 6; không có interface cho task sau.

- [ ] **Step 1:** Trục 1: thêm bullet ngay sau bullet "Loading / error / empty" (hiện ở dòng 30–31): dấu hiệu (thông báo lỗi/notice do hành động gây ra render trong vùng mà cha chỉ vẽ khi dữ liệu `ready`, trong khi chính hành động kích hoạt tải lại), cách kiểm (lần từ nơi đặt thông báo tới nhánh render của cha theo `state.kind`/`isLoading`/`isFetching`, hỏi nhánh đó còn mounted sau tải lại không; thông báo phải nằm ngoài vùng bị gỡ), nhãn proven khi chỉ ra cả nơi đặt lẫn nhánh gỡ nếu không thì suspected, severity `major` khi AC yêu cầu thông báo đó.
- [ ] **Step 2:** Trục 6: thêm bullet câu hỏi AC mô tả thứ người dùng thấy có assertion trên text/role ở trạng thái cuối chuỗi sự kiện (kể cả sau tải lại) không; assert request log hoặc state hook không tính; severity `major` khi AC là thông báo lỗi/xác nhận, `minor` với AC hiển thị khác.
- [ ] **Step 3:** Kiểm hunk: `git diff -U0 -- plugins/frontend/skills/frontend-code-review/references/review-dimensions.md`; kết quả mong đợi: đúng hai hunk, số dòng gốc nằm trong Trục 1 (khoảng dòng 30–31) và Trục 6 (khoảng dòng 129–137), không hunk nào trong Trục 4 (khoảng dòng 99–114). Có hunk ngoài hai vùng thì hoàn lại.
- [ ] **Step 4:** Đối chiếu khẳng định: ghi vào báo cáo bảng `khẳng định → file:line → khớp|lệch` cho các tham chiếu (tên mục "Loading / error / empty", dòng của bảng Severity "thiếu xử lý error/empty vùng quan trọng", tên trục).
- [ ] **Step 5:** Chạy `node test/validate.mjs --only visible-assert`; kết quả mong đợi exit 0, ba kiểm xanh. Commit qua `core:git-workflow`, header `docs(frontend): flag notices removed during loading in review dimensions`.

### Task 4: Bump version, khoá phiên bản, kiểm toàn bộ
**Kind:** TOOLING
**TDD:** không — chỉ đổi số version và khoá sinh tự động, không có hành vi mới; hành vi nội dung đã có test đỏ→xanh ở Task 1–3
**Ước lượng:** 15'
**Phủ AC:** AC3.2, AC4.1, AC4.2
**Files:**
- Modify: `plugins/frontend/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/content/54-frontend-visible-assert.pin.mjs`

**Interfaces:**
- Consumes: nội dung đã đổi ở Task 2–3; `node cli/lib/versions.mjs --lock`.
- Produces: `frontend` ở `1.16.4`, khoá khớp bản build.

- [ ] **Step 1:** Sửa `version` trong `plugins/frontend/.manifest.json` từ `1.16.3` thành `1.16.4`; chạy `npm run build` (exit 0), rồi `node cli/lib/versions.mjs --lock`; kết quả mong đợi: chỉ khoá của `frontend` đổi trong `plugins/_versions.lock.json` (`git diff --stat`).
- [ ] **Step 2:** Chạy `npm test`; kết quả mong đợi exit 0. Fail ở phần không liên quan tới ba file đã đổi thì ghi rõ lỗi và test fail, không sửa ngoài phạm vi.
- [ ] **Step 3 (pin đỏ khi nội dung bị gỡ):** chép `frontend-testing/SKILL.md` ra scratchpad, bỏ hàng `T7` trong bản trong repo, chạy `node test/validate.mjs --only visible-assert` (mong đợi exit 1, kiểm `AC1.1` đỏ), chép bản gốc về, rồi `git diff --exit-code -- plugins/frontend/skills/frontend-testing/SKILL.md` kiểm file không còn hunk nào so với commit Task 2 (exit 0).
- [ ] **Step 4:** Kiểm phạm vi: `git diff master...HEAD --stat` chỉ gồm sáu file ở Bản đồ file và `docs/requests/2026-11-13-frontend-visible-assert/`; không file nào trong danh sách "Không sửa" của Global Constraints.
- [ ] **Step 5:** Commit qua `core:git-workflow`, header `chore(frontend): bump to 1.16.4`.
