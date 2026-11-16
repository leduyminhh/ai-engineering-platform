# Thiết kế: Đối chiếu giao diện đã render với mockup trong đường feature của plugin frontend

- Ngày: 2026-11-13
- Trạng thái: merged 96636a84 (local; chưa push)
- Requirement: [requirement.md](requirement.md)

## Vấn đề và lý do

`workflow-feature` kiểm code rất kỹ (review từng task, review cuối, 149 test trong trial) nhưng không bước nào mở giao diện lên. Trial ghi hai lỗi UX `major` chỉ lộ ở review cuối nhờ đọc code, và agent nói rõ chưa quan sát trên trình duyệt thật (báo cáo trial, mục 4.2 và N1). Lỗi kiểu này là thứ người dùng thấy ngay khi mở trang, nên chi phí phát hiện muộn cao hơn chi phí chạy một lượt kiểm.

Skill `frontend-manual-check` đã có phần lớn công cụ (runbook theo AC, walkthrough Playwright, luật PASS/FAIL/SKIP, sáu luật an toàn) nhưng không workflow nào gọi và chưa có ba thứ cần cho lỗi này: ảnh chụp từng trạng thái, đối chiếu mockup, kiểm focus sau khi nội dung đổi tại chỗ.

## Quyết định đã chốt

Từ yêu cầu của phiên cha (người dùng đã giao): route `workflow-feature`, cỡ dự án (có `requirement.md` và `design.md`, `plan.md` làm sau G1), phạm vi file ở mục Thiết kế, không sửa file của N2, bump version khi đổi nội dung chiếu.

Bốn điểm dưới đây đã được người dùng duyệt ở G1 (2026-11-13) với đúng khuyến nghị ở cột giữa. Cột "Đổi thì sửa AC" giữ lại để biết chỗ nào phải đổi nếu sau này đổi ý.

| # | Câu hỏi | Khuyến nghị (quyết định của agent, chờ G1) | Phương án khác | Đổi thì sửa AC |
|---|---|---|---|---|
| Q1 | Bước mới bắt buộc hay tuỳ chọn? | Bắt buộc khi phạm vi `frontend`/`fullstack` và có AC kiểm được trên màn hình; backend-only hoặc FE không có màn hình thì bỏ qua. Không có công cụ trình duyệt thì `not_run` hợp lệ, không chặn | Tuỳ chọn, hỏi người dùng mỗi lần ở G2 | AC1.1, AC1.2 |
| Q2 | Dùng `frontend-manual-check` hay Playwright chụp ảnh? | `frontend-manual-check`, mở rộng walkthrough của nó để chụp ảnh bằng Playwright; không viết test chụp ảnh tự động | Chỉ Playwright test (`toHaveScreenshot`, axe) thêm vào `frontend-e2e-testing` | AC2.x, R2 |
| Q3 | Ai chạy? | Subagent `general-purpose` (`model: sonnet`) nạp skill; không có tool subagent thì session chính tự chạy | Session chính tự chạy; hoặc thêm agent frontend riêng | AC1.1 (câu chữ "Thực hiện"), không đổi AC khác |
| Q4 | Chi phí thêm một bước có chấp nhận được? | Có, giới hạn tối đa hai lượt chạy: một lượt đủ, một lượt chạy lại các bước FAIL sau lượt sửa của Bước 6. [Inference] khoảng 0,5–2 USD mỗi feature, tức 2–9% của 23,39 USD trong trial | Chỉ chạy lượt đủ, không chạy lại | AC1.3 |

## Các hướng đã cân nhắc

1. **Lượt kiểm là phần cuối của Bước 5, dùng `frontend-manual-check` mở rộng (khuyến nghị).** Giữ 7 bước, ít file đổi nhất, tái dùng skill đã published; kết quả vào Bước 6 làm đầu vào. Đánh đổi: kiểm tay do agent làm nên không lặp lại được như test; phụ thuộc có công cụ trình duyệt trong phiên.
2. **Bước mới số 6, đẩy Review cuối thành 7 và Kết thúc nhánh thành 8.** Rõ ràng nhất trên giấy. Loại: phá `workflows/R7` và pin AC3.1 của `31-workflow-self-sufficient`, đổi số "Bước 6/7" ở mọi nơi tham chiếu (WORKFLOW.md, `graph.json`, nhiều pin, spec sống; [Unverified] chưa đếm hết). Chi phí lớn hơn lợi ích.
3. **Kind task mới `UI-CHECK` trong `plan.md`.** Tận dụng vòng task (ledger, review). Loại: đụng `plan-execution`, `engineering-plan-writing`, `check-request.mjs` (core), nhiều hơn phạm vi N1; review từng task cho một lượt kiểm không có code để review là thừa.
4. **Test tự động (`toHaveScreenshot`, axe, test 404/focus trong `e2e/`).** Lặp lại được và chặn hồi quy. Loại khỏi request này: cần ảnh nền và duyệt `@playwright/test` (E-r7), ảnh nền lệch giữa máy; đối chiếu với mockup HTML không tự động được. Có thể là request sau cho luồng giá trị cao, ngoài N1.

## Thiết kế

### Bước 5 của `workflows/feature/WORKFLOW.md`

Thêm vào cuối **Hành động** một đoạn "Kiểm giao diện thật", chạy một lần sau khi mọi task `complete`, trước Bước 6:

- Điều kiện: phạm vi `frontend` hoặc `fullstack` và có ít nhất một AC kiểm được trên màn hình. Không thoả thì ghi dòng "bỏ qua kiểm giao diện: <lý do>" vào ledger và Evidence.
- Việc làm: dựng môi trường theo lệnh trong README hoặc `project-knowledge/` (chưa rõ thì `not_run` + lý do, không hỏi, không đoán: giữa G2 và G3 workflow không thêm điểm dừng); lập runbook từ các AC có UI và mockup/thiết kế đã có ở Bước 2; chạy walkthrough theo `frontend-manual-check`; ghi `docs/requests/<ngày>-<slug>/ui-check.md` (runbook + kết quả + bảng `## Đối chiếu mockup`); ảnh chụp lưu ở `.aip/runs/<request>/<part>/ui-check/` (ngoài git).
- Người chạy: subagent `general-purpose` (`model: sonnet`) được giao danh sách AC, đường dẫn mockup, lệnh chạy, đường dẫn ghi; subagent chỉ ghi `ui-check.md` và thư mục ảnh, không sửa code (L6), không commit. Session chính commit `ui-check.md` qua `git-workflow` cùng nhịp commit theo task.
- Ngoài ra: **Thực hiện** thêm "skill `frontend-manual-check` (chỉ khi phạm vi có FE có màn hình)" để `graph.json` khớp; **Gate** thêm điều kiện có `ui-check.md` hoặc dòng bỏ qua hoặc `not_run` kèm `reason`; **Evidence** thêm đường dẫn `ui-check.md` + tổng PASS/FAIL/SKIP; **Khi fail** thêm: không có công cụ trình duyệt → `not_run`, không dừng; **Ràng buộc** thêm: host local/test, không tự cài Playwright, không sửa code.

Bước 6: **Đầu vào** thêm `ui-check.md`. Reviewer frontend xếp severity cho từng FAIL theo thang của `frontend-code-review` (walkthrough chỉ gán PASS/FAIL) và gắn `file:line` của nơi gây lỗi khi đọc được; FAIL ngoài tầm đọc code thì giữ nguyên văn quan sát. FAIL `blocker`/`major` trong phạm vi đi vào đúng một lượt sửa hiện có; sau lượt sửa chạy lại các bước FAIL một lần (cùng người chạy) và ghi kết quả vào Evidence của Bước 6. Bước 6 không thêm cạnh `on_fail` mới.

Bảng "Xử lý lỗi": thêm hàng "Không có công cụ trình duyệt hoặc không dựng được môi trường khi kiểm giao diện (Bước 5)" → `not_run` vào `remaining_risks`, tiếp Bước 6. Definition of Done: thêm một mục có evidence là Bước 5.

`graph.json`: bước `task-loop`, `run.skills` thêm `{ "id": "frontend-manual-check", "when": "phạm vi có FE có màn hình, sau khi mọi task complete" }`. Không thêm bước, không thêm cạnh. `agents` của bước không đổi vì `general-purpose` không nằm trong danh sách `agents` của workflow (nó là phép gọi chung, như DOCS hiện tại; `checkGraphAgainstBody` chỉ đối chiếu id trong backtick của **Thực hiện** — builder xác nhận lúc làm plan).

Frontmatter: `requires` thêm `frontend/frontend-manual-check`; Điều kiện tiên quyết thêm skill.

### `frontend-manual-check`

- `references/walkthrough.md`: thêm mục "Trạng thái, ảnh chụp" (AC2.1, AC2.2: bốn trạng thái, tên ảnh `<#bước>-<trạng-thái>.png`, cách gây trạng thái không sửa code), mục "Focus và thông báo" (AC2.3, AC2.4: ghi `document.activeElement`, Tab một lần, FAIL khi ở `body`; kiểm `role="alert"`/chữ sau tải lại). Chụp ảnh và đọc `document.activeElement` qua công cụ trình duyệt của phiên; tên công cụ cụ thể khác nhau giữa bản cài nên giữ nhãn `[Unverified]` đã có ở dòng 13.
- `references/runbook.template.md`: thêm mục `## Đối chiếu mockup` sau `## Các bước`; bảng bước bốn cột giữ nguyên (pin AC5.1).
- `SKILL.md`: một đoạn ngắn ở mục 5 trỏ tới hai mục mới, một dòng ở Phạm vi, và mục "Chế độ nhúng" (AC2.6). Lý do: skill hiện đòi người dùng duyệt runbook (`walkthrough.md:10`, `SKILL.md:28`) và hỏi trước khi cài Playwright, trong khi `workflow-feature` không có điểm dừng giữa G2 và G3. Khi chạy trong workflow, G1 đã duyệt AC nên runbook sinh cơ học từ AC không cần duyệt lại; thiếu điều kiện thì `not_run`. Đây là **quyết định của agent**, nêu ở G1. Đối chiếu với `workflows/R11` (chế độ nhúng của contract đầu ra). Đang 113 dòng, trần mềm 300 (pin AC5.3), cảnh báo 300, cứng 500. `description` không đổi.

### Hai reference còn lại

- `fidelity-checklist.md`: thêm một dòng vào "Fidelity self-check" (AC3.1) và một vế vào dòng focus của "A11y cơ bản".
- `review-dimensions.md`: mở rộng bullet "Quản lý focus" (dòng 110–111; AC4.1). Severity gợi ý: focus rơi về `body` hoặc thông báo lỗi không hiện, trên luồng chính, là `major`; đúng với thang hiện có (`blocker` dành cho phần tử không dùng được bằng bàn phím).

### Phát hành

Bump `workflows/.manifest.json` (3.16.2 → 3.17.0) và `plugins/frontend/.manifest.json` (1.16.3 → 1.17.0); chạy `node cli/lib/versions.mjs --lock`. Số chính xác sửa theo lúc làm nếu N2 đã bump trước. Pin mới `test/content/54-frontend-ui-verify.pin.mjs`. Cuối: một dòng `workflows/R25` vào spec sống ở bước gộp; `core` không đổi.

### Cập nhật sau review cuối (2026-11-13)

Các điểm dưới đây thay hoặc bổ sung câu chữ ở trên; nội dung đã vào `WORKFLOW.md` và `frontend-manual-check`:

- `not_run`: lượt vẫn ghi `ui-check.md` với dòng `Trạng thái: not_run — <lý do>` (các bước `chưa kiểm`) và ghi `not_run` kèm `reason` vào `remaining_risks`; không chặn Bước 6, không hỏi.
- Ảnh chụp tính từ gốc repo chính (`.aip/.gitignore` chỉ có ở đó); session chính truyền đường dẫn tuyệt đối cho subagent.
- Chế độ nhúng chỉ chạy trên loopback hoặc host khai trong `project-knowledge/`, chỉ ghi `ui-check.md` và thư mục ảnh, không tự thêm cấu hình khi cổng bị chiếm; `ui-check.md` và ảnh không ghi giá trị cookie, token, `Authorization`.
- Chặn hoặc giả request chỉ để dựng trạng thái loading hoặc lỗi mà AC nêu, không giả phản hồi thành công; bước đó ghi PASS/FAIL chỉ cho nhánh UI.
- Request chia part: lượt kiểm chạy sau khi mọi part `merged <hash>` hoặc `bỏ`; FAIL còn lại sau lần chạy lại vào `remaining_risks` để trình G3.

## Ảnh hưởng spec

- workflows: thêm R27 (đổi từ R25 lúc merge vì trùng với request bugfix-gates và codegen-compat)

## Ngoài phạm vi và anti-goal

Xem `requirement.md`. Anti-goal: bước kiểm không trở thành cổng chặn mới. Nó thu bằng chứng và báo FAIL; chỉ Bước 6 và G3 quyết định sửa. Không dùng ảnh chụp để chứng minh "khớp pixel"; độ khớp mockup là quan sát có nhãn `[ước lượng]` như `fidelity-checklist.md` đã nói.

## Ràng buộc

Như `requirement.md`. Thêm: ảnh không vào git; `ui-check.md` là văn bản, người đọc cần hiểu mà không mở ảnh.

## Kiểm thử

| AC | Tầng | Cách kiểm |
|---|---|---|
| AC1.1–AC1.3, AC1.5, AC2.1–AC2.4, AC2.6, AC3.1, AC4.1 | pin nội dung | `test/content/54-frontend-ui-verify.pin.mjs`, đọc file nguồn, kiểm câu khoá |
| AC1.4 | hợp đồng | `node test/validate.mjs --build` (`checkGraph`, `checkGraphAgainstBody`, pin AC3.1 7 bước) |
| AC2.5 | pin có sẵn | `node test/validate.mjs --only enrich-frontend` |
| AC5.1, AC5.2 | toàn bộ | `npm test`; `node cli/lib/versions.mjs --lock` |
| AC6.1 | kiểm tay | chạy bước trên project trial ở `62bfcb0`; tốn model, không nằm trong `npm test` |

Pin chỉ kiểm câu khoá của hành vi hứa (điều kiện áp dụng, đường dẫn đầu ra, quy tắc FAIL focus), không ghim câu chữ mô tả.

## Để builder quyết

- Tên chính xác của mục mới trong `walkthrough.md` và vị trí chèn trong từng file.
- Chạy trên dev server hay bản build/preview. [Inference] dev server của React có thể chạy effect hai lần (StrictMode), nên kết quả focus có thể khác bản build; skill nên nêu "ưu tiên preview của bản build nếu project có script, ghi môi trường vào báo cáo".
- Số bước tối đa của runbook (gợi ý ≤ 25) để giữ chi phí.
- `CHANGELOG.md`: có ghi mục mới hay không, theo thói quen các request gần đây (chưa kiểm).

## Rủi ro và câu hỏi mở

- [Inference] Bước chạy thật sẽ bắt được hai lỗi của trial. Chưa thử; AC6.1 là phép thử, nên chạy trước G3, và không có spike trước G1 (tốn khoảng 15 phút dựng project trial và cần mạng cho `npm install`). Nếu AC6.1 không bắt được cả hai thì thiết kế cần quay lại G1.
- [Unverified] Công cụ trình duyệt (Playwright MCP) có sẵn trong subagent `general-purpose` ở phiên của người dùng. Trial dùng nó ở phiên chính. Không có thì rơi vào `not_run` và bước vô tác dụng; AC1.2 chấp nhận điều đó nhưng nên nêu rõ ở G3.
- [Unverified] Chặn/giả request ở tầng trình duyệt để gây lỗi 404/500 hoạt động qua công cụ Playwright của phiên (API `page.route` có trong Playwright, nhưng công cụ MCP cụ thể có thể không bộc lộ nó). Nếu không, gây lỗi bằng seed của mock API; còn không thì SKIP-PRECOND kèm lý do.
- [Inference] Chi phí 0,5–2 USD mỗi lần dựa trên lượt performance của trial (0,39 USD, 65 giây cho 5 phép đo); chưa đo trên bước này.
- Xung đột bump version với N2 ở `plugins/frontend/.manifest.json` và `plugins/_versions.lock.json`: dự kiến giải quyết khi merge.
- Câu hỏi mở cho người dùng: bốn câu Q1–Q4 ở mục "Quyết định đã chốt".
- Builder check (một lượt, subagent mới): 3 câu, cả ba thuộc nhóm "nhỏ" nên đã ghi **quyết định của agent**: (1) runbook không chờ duyệt thêm khi chạy trong workflow, vì AC đã duyệt ở G1, kèm mục "Chế độ nhúng" (AC2.6); (2) thiếu Playwright hoặc lệnh dựng môi trường thì `not_run`, không hỏi (AC2.6, mục Bước 5); (3) reviewer frontend xếp severity cho FAIL, chỉ `blocker`/`major` vào lượt sửa (AC1.3). Subagent cũng đối chiếu code: `stepRefs` (`cli/lib/workflows.mjs:67-74`) chỉ đọc skill/agent ở trường **Thực hiện** nên viết "agent `general-purpose`" ở Hành động là an toàn; `test/contract/10-source.contract.mjs:147-155` đòi skill trong Thực hiện có trong `requires` (đã có trong thiết kế). Các mốc dòng và version trong tài liệu khớp.

## Kết quả kiểm chứng

AC6.1 chạy ngày 2026-11-13 trên bản sao (`git clone` project trial, checkout `62bfcb0`, `npm install` 145 gói). Cổng 3001 đang do một tiến trình khác giữ nên lần kiểm dùng mock API riêng ở cổng 3002 (`PORT=3002 SEED=25`) và dev server Vite ở cổng 5174 với một file cấu hình phụ `vite.alt.config.mjs` trong bản sao (proxy `/api` sang 3002; không sửa mã nguồn của project). Người chạy: subagent `general-purpose` (sonnet) đọc `frontend-manual-check` bản đã sửa, chạy Playwright MCP (khoảng 16 lượt `run_code_unsafe`), 37 lượt gọi công cụ, 472 giây, 201.514 token của subagent; chi phí tiền [Unverified] vì không đọc được. Báo cáo: `scratchpad/ui-check-result/ui-check.md` (ngoài repo) và 31 ảnh ở `scratchpad/ui-check-shots/`; project trial gốc không bị đụng.

Kết quả: 25 bước, PASS 7 · FAIL 15 · SKIP-SAFETY 1 · SKIP-PRECOND 1 · chưa kiểm 1.

- **Lỗi focus: bắt được.** 15 FAIL cùng gốc: `document.activeElement` là `BODY` sau thao tác đổi trang (bước 3, 4), sau khi alert lỗi hiện và sau "Thử lại" (7, 8), sau khi tạo ticket thành công hoặc lỗi (11–16) và sau khi đổi trạng thái (17, 19–22). Nút lọc không bị FAIL vì không bị gỡ khỏi DOM. Nội dung AC ở các bước đó đều khớp.
- **Lỗi thông báo 404: không tái hiện.** Bước 21 (AC3.5, PATCH giả 404): thông báo "Ticket không còn tồn tại. Danh sách đã được tải lại." hiện trong `role="alert"` sau khi danh sách tải lại (mốc: không alert → loading → alert). Bước 21 vẫn là FAIL, nhưng vì focus, không vì thiếu thông báo. Tức là lỗi `major` thứ nhất của báo cáo trial ("thông báo 404 không bao giờ hiện") không xảy ra trong lần chạy này. [Inference] hai khả năng: review cuối đã suy luận sai từ mã, hoặc lỗi chỉ xảy ra với một điều kiện thời gian mà mock API chạy cục bộ không tạo ra; chưa kiểm cách nào.
- Khác: bước 9 (AC4.2, trạng thái rỗng) SKIP-PRECOND vì dựng `total = 0` cần giả phản hồi thành công (cấm theo L6) hoặc đổi ticket có sẵn; bước 23 (AC4.4) SKIP-SAFETY; bước 25 (AC5.1, AC5.2) chưa kiểm vì ngoài UI. [Unverified] có hai hiện tượng không tái hiện lần hai (bộ lọc nhảy sang "Xong" sau khi tạo ticket; ô "Mức ưu tiên" tự đổi sang "Thấp"), chưa rõ do ứng dụng hay công cụ.

Kết luận AC6.1: bản gốc đạt nửa sau (≥ 1 FAIL focus sau chuyển trang), không đạt nửa đầu (FAIL vì thông báo 404). Mục Rủi ro đã ghi "không bắt được cả hai thì thiết kế cần quay lại G1"; người dùng quyết (2026-11-13) giữ hướng và sửa AC6.1 chỉ còn vế focus (`requirement.md`). Phần [Inference] "bước chạy thật bắt được cả hai lỗi" vì vậy chỉ được kiểm chứng cho lỗi focus; lỗi 404 chưa có bằng chứng nào cả hai chiều (review cuối của trial suy luận từ mã, lần chạy này không thấy lỗi); nêu lại ở G3.
