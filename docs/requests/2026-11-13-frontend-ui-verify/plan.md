# Frontend UI verify Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Thêm lượt "Kiểm giao diện thật" vào Bước 5 của `workflow-feature`, mở rộng `frontend-manual-check` (ảnh chụp trạng thái, đối chiếu mockup, focus, thông báo lỗi, chế độ nhúng) và cập nhật hai reference frontend, để lỗi hiển thị lộ ở bước chạy thật thay vì review cuối.
**Architecture:** Nội dung chiếu (markdown + `graph.json`), không có code runtime. Bước mới là phần cuối của Bước 5, giữ `workflow-feature` đúng 7 bước; kết quả vào `ui-check.md` rồi vào đầu vào Bước 6.
**Tech Stack:** Markdown, JSON, test pin Node (`test/content/*.pin.mjs`), `node test/validate.mjs`.
**Spec:** design.md
**Requirement:** requirement.md

## Bản đồ file

| File | Trách nhiệm | Task |
|---|---|---|
| `test/content/54-frontend-ui-verify.pin.mjs` | Pin câu khoá của AC1.1–AC1.3, AC1.5, AC2.1–AC2.6, AC3.1, AC4.1 | Task 1 |
| `plugins/frontend/skills/frontend-manual-check/references/walkthrough.md` | Luật ảnh chụp trạng thái, focus, thông báo, cách gây trạng thái | Task 2 |
| `plugins/frontend/skills/frontend-manual-check/references/runbook.template.md` | Mục `## Đối chiếu mockup` | Task 2 |
| `plugins/frontend/skills/frontend-manual-check/SKILL.md` | Trỏ hai mục mới, `## Chế độ nhúng` | Task 2 |
| `workflows/feature/WORKFLOW.md` | Bước 5 (lượt kiểm), Bước 6 (đầu vào, chạy lại FAIL), frontmatter `requires`, Điều kiện tiên quyết, bảng Xử lý lỗi, Definition of Done | Task 3 |
| `workflows/feature/graph.json` | `run.skills` của bước `task-loop` thêm `frontend-manual-check` | Task 3 |
| `plugins/frontend/skills/frontend-implement/references/fidelity-checklist.md` | Mục "đã chạy thật và đối chiếu mockup" có dẫn chứng; vế focus | Task 4 |
| `plugins/frontend/skills/frontend-code-review/references/review-dimensions.md` | Bullet "Quản lý focus" mở rộng, severity gợi ý | Task 4 |
| `workflows/.manifest.json` | Bump version `workflows` | Task 5 |
| `plugins/frontend/.manifest.json` | Bump version `frontend` | Task 5 |
| `plugins/_versions.lock.json` | Lock version sau build | Task 5 |
| `CHANGELOG.md` | Một dòng dưới `[Unreleased]` / `### Added` | Task 5 |
| `docs/requests/2026-11-13-frontend-ui-verify/design.md` | Điền mục "Kết quả kiểm chứng" | Task 6 |

Gộp spec sống (`docs/specs/workflows/spec.md`, thêm `workflows/R25`) làm ở bước gộp của `finish.md`, không phải task.

## Global Constraints

- Chuỗi cố định (nguyên văn, pin của Task 1 và nội dung các task sau dùng cùng giá trị):
  - đường dẫn báo cáo `docs/requests/<ngày>-<slug>/ui-check.md`; thư mục ảnh `.aip/runs/<request>/<part>/ui-check/`;
  - tên lượt: `Kiểm giao diện thật`; skill: `frontend-manual-check`; trạng thái không chạy được: `not_run`;
  - `walkthrough.md`: tiêu đề mục `## Trạng thái và ảnh chụp` và `## Focus và thông báo`; các cụm `document.activeElement`, `Tab`, `chặn hoặc giả request`, `role="alert"`;
  - `runbook.template.md`: tiêu đề `## Đối chiếu mockup`; bảng bước giữ nguyên `| # | Thao tác | Kết quả mong đợi | AC |`;
  - `SKILL.md`: tiêu đề `## Chế độ nhúng`;
  - `fidelity-checklist.md`: cụm `đã chạy thật và đối chiếu mockup` và `dẫn chứng`;
  - `review-dimensions.md`: cụm `thay nội dung tại chỗ` và `role="alert"`.
- Không đổi `description` của `frontend-manual-check` (ngưỡng routing `test/routing/rank1.lock.json`).
- `workflow-feature` giữ đúng 7 bước và tiêu đề các bước như pin AC3.1 của `31-workflow-self-sufficient.pin.mjs`. Trong trường **Thực hiện** của Bước 5 chỉ thêm `skill \`frontend-manual-check\``; không viết `agent \`general-purpose\`` ở trường đó (`stepRefs` sẽ bắt và graph báo lệch), chỉ ở **Hành động**.
- Không chạm `workflows/bugfix/` và `plugins/frontend/skills/frontend-fix/` (request N2).
- Commit mỗi task qua `core:git-workflow` (header tiếng Anh, body tiếng Việt có dấu, `git commit -F`, không Co-Authored-By). Văn bản tiếng Việt có dấu, UTF-8 không BOM, LF. Một lệnh Bash mỗi lần gọi.

## Review Focus

1. Graph lệch văn xuôi sau khi thêm skill vào Bước 5: Task 3 chạy `node test/validate.mjs --build`, nhóm `checkGraph`/`checkGraphAgainstBody`.
2. Pin 7 bước của `31-workflow-self-sufficient` vẫn xanh: Task 3 chạy `node test/validate.mjs --only 31-workflow-self-sufficient`.
3. Pin của `frontend-manual-check` (SKILL.md ≤ 300 dòng, bảng bốn cột, bốn kết quả, L1–L6) không vỡ: Task 2 chạy `node test/validate.mjs --only enrich-frontend`.
4. Luật độc lập (người dùng gọi trực tiếp: duyệt runbook, hỏi trước khi cài) không bị chế độ nhúng ghi đè: pin AC2.6 ở Task 1 kiểm cả hai vế, Task 2 phủ.
5. `description` không đổi nên điểm routing không trượt: Task 5 chạy `node scripts/routing-score.mjs` trong `npm test`.

### Task 1: Pin nội dung cho bước kiểm giao diện

**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 20 phút
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.5, AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6, AC3.1, AC4.1, AC5.3
**Files:**
- Create: `test/content/54-frontend-ui-verify.pin.mjs`
- Test: `test/content/54-frontend-ui-verify.pin.mjs`

**Interfaces:**
- Consumes: các chuỗi cố định ở Global Constraints; `ctx.fs`, `ctx.path`, `ctx.REPO_ROOT`, `ctx.PLUGINS_DIR` của `test/context.mjs`.
- Produces: module `export default async function run({ ok, ctx })` chạy được bằng `node test/validate.mjs --only frontend-ui-verify`.

- [ ] **Step 1:** Đọc `test/content/53-reasoning-review.pin.mjs` và `51-enrich-frontend.pin.mjs` để theo mẫu (`read`, `flat`, tiền tố AC trong tên `ok`).
- [ ] **Step 2:** Viết pin, mỗi `ok(...)` mang ID AC trong tên: (a) `WORKFLOW.md` Bước 5 chứa `Kiểm giao diện thật`, `ui-check.md`, `.aip/runs/<request>/<part>/ui-check/`, `not_run`, điều kiện phạm vi `frontend`/`fullstack`, và trường Thực hiện của Bước 5 chứa `skill \`frontend-manual-check\`` (AC1.1, AC1.2); (b) Bước 6 Đầu vào chứa `ui-check.md`, nói reviewer xếp severity và chạy lại bước FAIL một lần (AC1.3); (c) frontmatter `requires` chứa `frontend/frontend-manual-check`, bảng Xử lý lỗi và Definition of Done có dòng nhắc kiểm giao diện (AC1.5); (d) `graph.json` bước `task-loop` có `frontend-manual-check` kèm `when`, và có đúng 7 bước (AC1.4 phần đọc file); (e) `walkthrough.md` chứa hai tiêu đề mục, `document.activeElement`, `Tab`, `chặn hoặc giả request`, `role="alert"`, và luật FAIL khi focus ở `body` (AC2.1–AC2.4); `runbook.template.md` chứa `## Đối chiếu mockup` và vẫn có bảng bước bốn cột (AC2.5); (f) `SKILL.md` chứa `## Chế độ nhúng` và hai vế: nhúng thì không chờ duyệt thêm và `not_run`; độc lập thì giữ duyệt runbook và hỏi trước khi cài (AC2.6); (g) `fidelity-checklist.md` chứa `đã chạy thật và đối chiếu mockup` và `dẫn chứng` (AC3.1); (h) `review-dimensions.md` chứa `thay nội dung tại chỗ` và `role="alert"` (AC4.1).
- [ ] **Step 3:** Chạy `node test/validate.mjs --only frontend-ui-verify`. Kỳ vọng: exit 1, mọi `ok` về nội dung mới đỏ (chưa có nội dung), không lỗi cú pháp. Ghi `red:` vào ledger.
- [ ] **Step 4:** Commit test đỏ: `test(frontend): pin ui-verify step and manual-check embed mode`.

### Task 2: Mở rộng `frontend-manual-check`

**Kind:** DOCS
**Ước lượng:** 25 phút
**Phủ AC:** AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6
**Files:**
- Modify: `plugins/frontend/skills/frontend-manual-check/references/walkthrough.md`
- Modify: `plugins/frontend/skills/frontend-manual-check/references/runbook.template.md`
- Modify: `plugins/frontend/skills/frontend-manual-check/SKILL.md`
- Test: `test/content/54-frontend-ui-verify.pin.mjs`, `test/content/51-enrich-frontend.pin.mjs`

**Interfaces:**
- Consumes: chuỗi cố định ở Global Constraints; sáu luật L1–L6 và bốn kết quả hiện có của `walkthrough.md` (giữ nguyên).
- Produces: mục `## Trạng thái và ảnh chụp`, mục `## Focus và thông báo` (trong `walkthrough.md`), mục `## Đối chiếu mockup` (trong `runbook.template.md`), mục `## Chế độ nhúng` (trong `SKILL.md`).

- [ ] **Step 1:** `walkthrough.md` thêm `## Trạng thái và ảnh chụp`: mỗi màn hình chụp ở bốn trạng thái loading, rỗng, lỗi, thành công mà AC hoặc mockup nêu; tên ảnh `<#bước>-<trạng-thái>.png` lưu ở `.aip/runs/<request>/<part>/ui-check/` (ngoài git); trạng thái không dựng được thì SKIP-PRECOND kèm lý do; cách gây trạng thái là seed của runbook hoặc `chặn hoặc giả request` ở tầng trình duyệt, không sửa mã nguồn hay cấu hình (L6).
- [ ] **Step 2:** `walkthrough.md` thêm `## Focus và thông báo`: sau mỗi thao tác tải lại hoặc đổi nội dung tại chỗ (đổi trang, lọc, tạo, đổi trạng thái, xoá dòng) ghi `document.activeElement`, nhấn `Tab` một lần và ghi phần tử nhận focus; FAIL khi focus ở `body` mà trang không đổi route và không vừa đóng dialog; AC có thông báo thì kiểm thông báo trong DOM (chữ hoặc `role="alert"`) sau đủ chuỗi sự kiện kể cả tải lại danh sách, thông báo nằm trong vùng bị gỡ cùng danh sách là FAIL. Giữ nhãn `[Unverified]` về tên công cụ trình duyệt.
- [ ] **Step 3:** `runbook.template.md` thêm `## Đối chiếu mockup` sau `## Các bước`: bảng `| Trạng thái | Ảnh | Phần tử mockup tham chiếu | Khớp/lệch |`, ghi chú không có mockup thì ghi "không có mockup"; phần suy đoán gắn `[ước lượng]`. Bảng bước bốn cột giữ nguyên.
- [ ] **Step 4:** `SKILL.md` thêm một đoạn ở mục 5 trỏ tới hai mục mới của `walkthrough.md`, một dòng ở Phạm vi, và `## Chế độ nhúng`: gọi từ `workflow-feature` thì runbook lập từ AC đã duyệt ở G1 và không chờ duyệt thêm; thiếu công cụ trình duyệt, chưa tự cài Playwright hoặc chưa rõ lệnh dựng môi trường thì trả `not_run` + lý do, không hỏi; skill không commit, session chính commit `ui-check.md`; gọi độc lập giữ nguyên luật duyệt runbook và hỏi trước khi cài. Không đổi `description`.
- [ ] **Step 5 (đối chiếu khẳng định với code):** liệt kê khẳng định kiểm được trong phần vừa viết (đường dẫn `.aip/runs/...`, tên mục, L1–L6, số dòng SKILL.md), grep/đọc nguồn, ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo task; sửa dòng `lệch`.
- [ ] **Step 6:** Chạy `node test/validate.mjs --only enrich-frontend`. Kỳ vọng: exit 0.
- [ ] **Step 7:** Chạy `node test/validate.mjs --only frontend-ui-verify`. Kỳ vọng: các `ok` của AC2.1–AC2.6 xanh; các `ok` của workflow, checklist, review-dimensions còn đỏ.
- [ ] **Step 8:** Commit: `feat(frontend): extend manual-check with state screenshots, focus and embed mode`.

### Task 3: Bước kiểm giao diện trong `workflow-feature`

**Kind:** TOOLING
**TDD:** không — pin đỏ của Task 1 là test đỏ chung cho task này
**Ước lượng:** 30 phút
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4, AC1.5
**Files:**
- Modify: `workflows/feature/WORKFLOW.md`
- Modify: `workflows/feature/graph.json`
- Test: `test/content/54-frontend-ui-verify.pin.mjs`, `test/content/31-workflow-self-sufficient.pin.mjs`

**Interfaces:**
- Consumes: mục `## Chế độ nhúng` của `SKILL.md` (Task 2); chuỗi cố định ở Global Constraints; `stepRefs` của `cli/lib/workflows.mjs` (chỉ đọc skill/agent ở trường Thực hiện).
- Produces: đoạn `Kiểm giao diện thật` trong Hành động Bước 5; `ui-check.md` ở Đầu vào Bước 6; `run.skills` của bước `task-loop` có `frontend-manual-check`.

- [ ] **Step 1:** Bước 5: **Thực hiện** thêm `skill \`frontend-manual-check\` (chỉ khi phạm vi có FE có màn hình)`; **Hành động** thêm đoạn `Kiểm giao diện thật` theo mục Thiết kế của `design.md` (điều kiện áp dụng, dựng môi trường, subagent `general-purpose` `model: sonnet` nạp skill, đường dẫn `ui-check.md` và thư mục ảnh, session chính commit `ui-check.md`); **Ràng buộc**, **Gate**, **Evidence**, **Khi fail** thêm vế tương ứng (`not_run` không chặn; không hỏi giữa G2 và G3). Không thêm câu "quay lại Bước N" mới và không thêm chữ "hỏi" vào **Khi fail** (`checkGraphAgainstBody` đòi cạnh `on_fail` tương ứng).
- [ ] **Step 2:** Bước 6: **Đầu vào** thêm `ui-check.md`; **Hành động** thêm: reviewer frontend xếp severity cho FAIL, `blocker`/`major` trong phạm vi vào lượt sửa duy nhất, chạy lại bước FAIL một lần sau lượt sửa, kết quả vào Evidence.
- [ ] **Step 3:** Frontmatter `requires` thêm `frontend/frontend-manual-check`; mục Điều kiện tiên quyết thêm skill; bảng "Xử lý lỗi" thêm hàng "Không có công cụ trình duyệt hoặc không dựng được môi trường khi kiểm giao diện (Bước 5)" → `not_run` vào `remaining_risks`, tiếp Bước 6; Definition of Done thêm một mục, evidence Bước 5.
- [ ] **Step 4:** `graph.json`: bước `task-loop`, `run.skills` thêm `{ "id": "frontend-manual-check", "when": "phạm vi có FE có màn hình, sau khi mọi task complete" }`. Không đổi `next`, `on_fail`, `gate`.
- [ ] **Step 5:** Chạy `npm run build`. Kỳ vọng: exit 0 (build gọi `workflowGraphErrors`, exit 1 nếu graph lệch văn xuôi).
- [ ] **Step 6:** Chạy `node test/validate.mjs --build`. Kỳ vọng: exit 0, không dòng `✗`, gồm pin 7 bước của `31-workflow-self-sufficient`.
- [ ] **Step 7:** Chạy `node test/validate.mjs --only frontend-ui-verify`. Kỳ vọng: các `ok` của AC1.1–AC1.5 xanh.
- [ ] **Step 8:** Commit: `feat(workflows): add real-UI check to workflow-feature step 5`.

### Task 4: Hai reference frontend

**Kind:** DOCS
**Ước lượng:** 15 phút
**Phủ AC:** AC3.1, AC4.1
**Files:**
- Modify: `plugins/frontend/skills/frontend-implement/references/fidelity-checklist.md`
- Modify: `plugins/frontend/skills/frontend-code-review/references/review-dimensions.md`
- Test: `test/content/54-frontend-ui-verify.pin.mjs`

**Interfaces:**
- Consumes: chuỗi cố định ở Global Constraints; thang severity của `review-dimensions.md` (bảng "Severity").
- Produces: dòng `đã chạy thật và đối chiếu mockup` trong Fidelity self-check; bullet "Quản lý focus" mở rộng.

- [ ] **Step 1:** `fidelity-checklist.md` (phần Fidelity self-check, quanh dòng 15–28) thêm một dòng `- [ ]` "Đã chạy thật và đối chiếu mockup" chỉ được tích khi có `dẫn chứng` (đường dẫn ảnh hoặc lệnh đã chạy); không chạy được thì ghi `chưa kiểm` kèm lý do, không tích. Dòng focus ở "A11y cơ bản" thêm vế nội dung đổi tại chỗ.
- [ ] **Step 2:** `review-dimensions.md` bullet "Quản lý focus" (quanh dòng 110–111) thêm: `thay nội dung tại chỗ` (tải lại danh sách, phân trang, xoá dòng làm phần tử đang focus bị gỡ → focus rơi về `body`) và vùng `role="alert"` bị gỡ cùng danh sách làm thông báo không hiện; severity gợi ý `major` khi nằm trên luồng chính.
- [ ] **Step 3 (đối chiếu khẳng định với code):** liệt kê khẳng định kiểm được (số dòng, tên mục, tên thang severity), đối chiếu với file nguồn, ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo task; sửa dòng `lệch`.
- [ ] **Step 4:** Chạy `node test/validate.mjs --only frontend-ui-verify`. Kỳ vọng: exit 0, toàn bộ pin xanh.
- [ ] **Step 5:** Commit: `docs(frontend): require evidence for rendered check and cover in-place focus loss`.

### Task 5: Phát hành

**Kind:** TOOLING
**TDD:** không — task phát hành, test là `npm test` và lock
**Ước lượng:** 20 phút
**Phủ AC:** AC5.1, AC5.2
**Files:**
- Modify: `workflows/.manifest.json`
- Modify: `plugins/frontend/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Modify: `CHANGELOG.md`
- Test: `npm test`

**Interfaces:**
- Consumes: `node cli/lib/versions.mjs --lock` (từ chối khi nội dung đổi mà version không đổi).
- Produces: version `workflows` và `frontend` tăng; lock khớp bản build.

- [ ] **Step 1:** Đọc version hiện tại; nếu N2 đã bump trước (master đổi), lấy số mới nhất rồi tăng minor. Mặc định: `workflows` 3.16.2 → 3.17.0, `frontend` 1.16.3 → 1.17.0.
- [ ] **Step 2:** Sửa hai `.manifest.json`, chạy `npm run build`, rồi `node cli/lib/versions.mjs --lock`. Kỳ vọng: exit 0, `plugins/_versions.lock.json` có hai version mới.
- [ ] **Step 3:** `CHANGELOG.md` thêm một dòng dưới `## [Unreleased]` / `### Added`, theo dạng các dòng cạnh nó: tên request, version `workflows` và `frontend`, nội dung một câu.
- [ ] **Step 4:** Chạy `npm test`. Kỳ vọng: exit 0, gồm routing rank-1 và `validate --build`.
- [ ] **Step 5:** Commit: `chore: bump workflows and frontend for ui-verify step`.

### Task 6: Kiểm chứng trên ca thật của trial (AC6.1)

**Kind:** TOOLING
**TDD:** không — kiểm tay, không có code mới
**Ước lượng:** 30 phút
**Phủ AC:** AC6.1
**Files:**
- Modify: `docs/requests/2026-11-13-frontend-ui-verify/design.md`
- Test: không có (kiểm tay, ngoài `npm test`)

**Interfaces:**
- Consumes: `frontend-manual-check` đã sửa (Task 2); project `E:\Mine\AI\aip-frontend-trial`, commit `62bfcb0`.
- Produces: mục "Kết quả kiểm chứng" của `design.md` có kết quả, hoặc `not_run` kèm lý do.

- [ ] **Step 1:** Hỏi người dùng một lần (tốn model, `npm install` cần mạng) rồi mới chạy. Chưa trả lời hoặc không đồng ý thì ghi `not_run` kèm lý do vào `design.md`, bỏ các step sau.
- [ ] **Step 2:** Dựng bản sao không đụng project trial gốc: `git clone E:/Mine/AI/aip-frontend-trial <thư mục scratchpad>` rồi `git checkout 62bfcb0` trong bản sao; `npm install`; chạy mock API và dev server theo README của trial.
- [ ] **Step 3:** Gọi subagent `general-purpose` (`model: sonnet`) nạp `frontend-manual-check` bản đã sửa (đường dẫn trong worktree này), giao AC của `docs/requests/2026-11-13-ticket-board`, mockup `design/ticket-board.html`, lệnh chạy; yêu cầu ghi `ui-check.md` vào bản sao.
- [ ] **Step 4:** Đọc `ui-check.md`. Kỳ vọng AC6.1: FAIL cho thông báo 404 của AC3.5 và ít nhất một FAIL focus sau chuyển trang. Ghi vào `design.md`, mục "Kết quả kiểm chứng": lệnh đã chạy, tổng PASS/FAIL/SKIP, kết luận đạt hoặc không đạt, và chi phí nếu đọc được. Không đạt thì ghi nguyên văn và nêu ở G3 như rủi ro; không tự sửa skill ngoài phạm vi plan.
- [ ] **Step 5:** Commit: `docs(requests): record ui-verify validation result`.
