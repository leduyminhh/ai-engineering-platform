# Báo cáo trial plugin `frontend`

Ngày: 2026-11-13. Thiết kế trial: [trial-design.md](trial-design.md). Bản aip được thử: master `8b76eeb1` (core 1.33.12, frontend 1.16.3, engineering 2.15.0), cài plugin mode từ `build/claude`. Project thử: `E:\Mine\AI\aip-frontend-trial` (ngoài repo aip, giữ nguyên để xem lại). Báo cáo này không sửa plugin; các nâng cấp ở mục 5 sẽ là request riêng.

## 1. Kết luận ngắn

- Đường feature chạy tới cổng G3 mà không cần mớm tên skill: `workflow-feature` → spec/plan → `plan-execution` → 11 task, mỗi task có review riêng. Kết quả xanh: 149 test, typecheck, build, 7 E2E.
- Hai lỗ lớn nhất không nằm ở code sinh ra mà ở quy trình. Một: **không bước nào đối chiếu giao diện render với mockup, và không kiểm trạng thái lỗi hay focus bàn phím trên trình duyệt** (7 E2E có chạy Chrome thật nhưng chỉ phủ lọc, phân trang, tạo, đổi trạng thái), nên hai lỗi UX mức `major` (thông báo 404 không bao giờ hiện, focus rơi về `body`) chỉ lộ ở review cuối bằng cách đọc code. Hai: **`workflow-bugfix` được gọi đúng nhưng không được làm theo** (bỏ xác nhận root cause, không dùng `frontend-fixer`, không review).
- Giả định "dùng `openapi-typescript`" lọt qua G1 và G2, đến Task 1 mới lộ là không chạy với TypeScript 7.0.2.
- Điểm tổng (trung bình 6 tiêu chí): **7,0/10**. Chi phí cả trial ≈ $23,4 và ≈ 28 phút máy chạy, không đặt trần.

## 2. Điều kiện chạy và những gì tôi mớm

Chạy headless `claude -p --model sonnet --permission-mode bypassPermissions`, nối lượt bằng `--resume`; lượt bugfix và performance mở phiên mới. `.claude/aip-gate.json` ở `mode: ask` (không bật `full`), hook chạy ở plugin mode. Log stream-json nằm ở scratchpad của phiên này (không vào repo).

Những chỗ tôi mớm (ảnh hưởng độ tin của điểm):

| Chỗ mớm | Ảnh hưởng |
|---|---|
| Mockup `design/ticket-board.html`, contract `docs/contracts/openapi.yaml`, `mock-api/` do tôi viết | Đầu vào của `frontend-implement` và `frontend-data-integration` là đầu vào sạch, không phải đầu vào lộn xộn của người dùng thật |
| Lượt 0 gọi tường minh `/frontend:frontend-init`; lượt 0b trả lời 5 điểm gọn (Feature-Based, React, CSS thuần, không ràng buộc nghiệp vụ) và nói "cứ điền rồi commit luôn" | `frontend-init` có `disable-model-invocation: true` nên không đo được routing của skill này |
| Lượt 1b: tôi nêu tên công cụ "được thêm `openapi-typescript`", "được thêm `playwright.config.ts` + `e2e/`", cỡ trang 10, "cỡ dự án" | Lựa chọn `openapi-typescript` đến từ prompt của tôi (skill `frontend-data-integration` cũng đề xuất đúng tên đó), không phải từ khâu chọn công cụ của plugin |
| Trả lời G1 bằng "Duyệt. Đồng ý hết khuyến nghị cho 5 câu", G2 bằng "Duyệt plan" | Cổng duyệt không bị thử bằng phản hồi khó; ADR 0005 do agent chuyển Accepted sau chữ "Duyệt" của tôi (lượt 2), người dùng không xem riêng ADR |
| Blocker Task 1 (TypeScript 7): tôi chọn phương án 1 (npx ghim TS5) | Quyết định của người dùng được tôi thay |
| G3: tôi chọn "1a, 2a, form giữ nguyên" rồi merge local | Phần sửa sau G3 (lượt 4) là do lựa chọn của tôi |
| Bug gài `9d78d3c`: làm test AC1.4 đỏ | Bug quá dễ tái hiện, `git show` commit cuối đã chỉ ra nguyên nhân, nên lượt bugfix là bằng chứng yếu |
| Prompt lượt performance nêu sẵn `SEED=5000 npm run mock-api`, "Chỉ chạy local" | Mớm lệnh chạy và ràng buộc an toàn |

Biến nhiễu: user-scope còn bật plugin `superpowers` và `ponytail`. Hook SessionStart của chúng chạy trong mọi phiên (12 lần `startup`, 24 lần `resume`). Tôi không tách được ảnh hưởng của chúng lên routing, nên số liệu routing dưới đây là "plugin aip + superpowers + ponytail", không phải aip riêng.

Run 1 bị tôi dừng giữa lượt 1b theo yêu cầu người dùng (chạy lại sau khi hỏi cập nhật aip; master không đổi, vẫn `8b76eeb1`). Ở lượt 1, run 1 tốn $0,94 cộng dồn so với $0,74 của run 2. [Inference] Chênh lệch này đến từ biến thiên giữa các lần chạy của model, không phải từ thay đổi plugin; tôi không có phép đo tách riêng nên không kết luận chắc hơn.

## 3. Nhật ký từng lượt (run 2)

Chi phí `total_cost_usd` cộng dồn trong một phiên `--resume` (lượt 0–5 cùng một phiên). Thời gian là `duration_ms` của từng lượt.

| Lượt | Việc | Skill / agent thấy trong log | Thời gian | Chi phí cộng dồn | Dừng hỏi |
|---|---|---|---|---|---|
| 0 | `/frontend:frontend-init` (gọi tường minh) | lệnh không hiện như lời gọi `Skill` trong log; phát hiện project đã có khung, không ghi đè | 18 s | $0,14 | 4 câu (framework, kiểu kiến trúc, stack UI, domain) |
| 0b | trả lời, điền `project-knowledge/` | `core:git-workflow` | 98 s | $0,53 | không |
| 1 | "làm màn hình quản lý ticket theo mockup, nối API, có test" | `workflows:workflow-feature`, `core:plan-execution` | 51 s | $0,74 | 8 điểm cần chốt (cỡ trang, lọc, cỡ việc…) |
| 1b | trả lời → viết requirement + design | agent `engineering-spec-analyst` | 27 s | $1,19 | G1 + 5 câu agent không tự chốt |
| 2 | duyệt G1 → plan | `engineering:engineering-plan-writing` | 165 s | $1,65 | G2 + câu hỏi cách chạy |
| 3 | duyệt plan, chọn subagent | không | 91 s | $2,04 | blocker Task 1 (TypeScript 7) |
| 3b | chọn phương án, chạy Task 1–10 | 29 lượt gọi agent: `frontend-implementer` ×4, `frontend-data-integrator` ×5, `frontend-test-writer` ×4, `frontend-e2e-test-writer` ×1, `frontend-reviewer` ×13, `general-purpose` ×5, `engineering-quality-auditor` ×1, `frontend-fixer` ×1 | 488 s | $19,64 | G3 với 2 finding `major` |
| 4 | sửa 2 finding + đổi chữ AC3.5, thêm AC4.6 | `frontend-implementer`, `frontend-reviewer` | 605 s | $22,21 | G3 lần 2 |
| 5 | duyệt G3, merge local | không agent | 65 s | $22,71 | không |
| 6 | bugfix (phiên mới) | `workflows:workflow-bugfix` (không agent) | 43 s | $0,29 | không |
| 7 | performance (phiên mới) | `frontend:frontend-performance` (không agent) | 65 s | $0,39 | không |

Tổng: $22,71 + $0,29 + $0,39 = **$23,39**; thời gian 1 606 s + 43 s + 65 s ≈ **1 714 s (28,6 phút)**. Riêng thực thi plan (3b) tốn $17,60, tức khoảng $1,76 mỗi task tính cả review. [Unverified] Tôi chưa kiểm `total_cost_usd` có gồm chi phí subagent hay không.

Kết quả cuối của nhánh (tôi tự chạy lại trên `master` `35c9201`): `npm test` 14 file / 149 test pass; `npm run typecheck` không báo lỗi; `check-request.mjs` trên `docs/requests/2026-11-13-ticket-board` báo 0 cảnh báo; diff `1fc13a5..HEAD` 62 file, +3771/−74. Build (exit 0) và E2E (7 passed) là số do agent báo trong log lượt 3b/4/5, tôi không chạy lại. Lint không có vì project chưa cấu hình ESLint (agent lượt 0b tự nêu).

Ledger review từng task (`.aip/runs/2026-11-13-ticket-board/root/progress.md`, dòng 7–59): vòng 1 của 14 lượt review cho 4 finding `major` (Task 3, Task 7, Task 10 ×2) và không `critical`; review cuối + auditor thêm 2 `major` mà review từng task không thấy (mục 4.2).

## 4. Chấm điểm

### 4.1 Routing: 7/10

Đúng, không mớm tên skill:
- Yêu cầu feature tự nhiên → `workflows:workflow-feature` rồi `core:plan-execution` (lượt 1; run 1 cũng vậy, `turn-t1.jsonl` hai run).
- Agent chọn đúng kind theo plan: FE-UI → `frontend-implementer` + `frontend-test-writer`, FE-INT → `frontend-data-integrator`, E2E → `frontend-e2e-test-writer`, DOCS → `general-purpose`, review → `frontend-reviewer`.
- Bug → `workflows:workflow-bugfix` (lượt 6).

Chưa đúng:
- Lượt 6: gọi đúng workflow nhưng không gọi `frontend-fixer`/`frontend-fix` (mục 4.3). Khớp ghi chú của phiên khác: `frontend-fix` 0/3 lần kích hoạt trong các eval cũ (`skill-coverage-audit-evidence.md`, nguồn-C mục 9; nguyên nhân [Inference]).
- Lượt 7: "đo xem chậm ở đâu và có đáng sửa không" → skill `frontend-performance` thẳng, không qua `workflow-performance`, không gọi `frontend-performance-analyst`. Mô tả của `frontend-performance` ghi "cần cả quy trình tối ưu có commit → workflow-performance" nên lựa chọn này có cơ sở vì yêu cầu mới dừng ở bước đo; tôi không coi đây là lỗi, chỉ ghi nhận là ca ranh giới.
- Lượt 0: tôi gọi tường minh `/frontend:frontend-init` vì skill có `disable-model-invocation: true` (`plugins/frontend/skills/frontend-init/SKILL.md`), nên không đo được routing ở đây. Agent nhận ra khung đã có và không ghi đè, điều đúng.

### 4.2 Kết quả: 8/10

Đạt: 149 test xanh, typecheck sạch, build và 7 E2E (Chrome thật) xanh theo log, spec sống R1–R4 được viết, `check-request.mjs` 0 cảnh báo. `gen:api` ghim phiên bản và ADR 0005 cập nhật đúng theo phương án chọn.

Trừ điểm:
- **Hai lỗi `major` chỉ lộ ở review cuối** (`turn-t3b.jsonl`, báo cáo cuối): (1) khi đổi trạng thái gặp 404, thông báo của AC3.5 không bao giờ hiện vì danh sách bị ẩn lúc tải lại; test tích hợp xanh nhưng không assert có thông báo. (2) danh sách và Pager bị gỡ khi loading nên focus bàn phím rơi về `body` sau mỗi lần chuyển trang; agent nói rõ "chưa quan sát trên Chrome thật, đây là suy luận từ cách DOM hoạt động". Cả hai đều là thứ người dùng thật thấy ngay khi mở trang.
- Sau lượt 4 vẫn còn một `minor` suspected: heuristic `activeElement === body` có thể kéo cuộn trang (chưa có `preventScroll`); đã hoãn vào ledger theo lựa chọn của tôi.
- Không có lint; không có bằng chứng a11y tự động (axe hay tương đương). a11y trong test là kiểm role/label bằng Testing Library, không có kiểm tương phản.
- `gen:api` chưa chạy lại ở HEAD cuối (cần mạng), agent đã nêu.

### 4.3 Đúng quy trình: 7/10

Đường feature (8/10): G1, G2, G3 đều dừng chờ duyệt (lượt 1b, 2, 3b/4); ledger đủ `start/review/complete`; mỗi task một hoặc hai commit; header commit tiếng Anh theo `git log` (`feat(tickets): …`); không push, merge local chỉ sau khi tôi duyệt (lượt 5). Agent tự đọc lại và sửa Ruling sai (AC3.5 ban đầu ghi "hook và UI làm đúng chữ AC") sau khi review cuối chỉ ra. Chỉ sửa AC khi được phép, và dừng hỏi ở cổng. Trừ điểm: Task 11 sửa 2 file docs ngoài `Files` của task (có `Ruling:` kèm lý do); `plan.md` Task 10 còn ghi "thêm `openapi-typescript`" đã lỗi thời.

Đường bugfix (4/10), theo `workflows/bugfix/WORKFLOW.md`:
- Bước 5 ⏸ "root cause có xác nhận người dùng" (dòng 103–122) bị bỏ; câu trả lời cuối nói rõ: "tôi đã bỏ bước xin bạn xác nhận root cause … vì git diff của `9d78d3c` đã cho thấy rõ nguyên nhân".
- Bước 6 dùng `frontend-fixer` (dòng 124–), Bước 8 review (dòng 175–), Bước 9 commit ⏸ (dòng 188–): không có agent nào được gọi; 11 lượt gọi công cụ, tất cả do phiên chính làm (`Skill`, `Read`, `Glob`, `Bash`, `Edit`).
- Làm thẳng trên `master`, không tạo nhánh; may là không commit (agent để lại diff chờ tôi duyệt, đúng quy tắc Safety của `AGENTS.md`).
- Điểm tốt: sửa đúng một dòng, test AC1.4 từ đỏ sang xanh, 149 test và typecheck xanh, và agent liệt kê trung thực những bước đã bỏ.
- Nguyên nhân bỏ bước: [Inference] một phần do `-p` không có công cụ hỏi tương tác nên bước ⏸ khó thực hiện; tôi không kiểm được. Trong log không lượt nào gọi `AskUserQuestion` (mọi câu hỏi ở mục 3 đều ở dạng văn bản).

Đường performance: trung thực và có kỷ luật (đo 5 lần, build production, không đo trên dev server, không sửa `src/`, hỏi trước khi thêm Lighthouse), nhưng số đo không được lưu thành script lặp lại được trong `perf/` như `plugins/frontend/skills/frontend-performance/SKILL.md:39` yêu cầu; agent dùng `browser_run_code_unsafe` của Playwright MCP và để lại `.playwright-mcp/` untracked trong repo (`git status` của project trial).

### 4.4 Hook: 8/10

Số liệu: toàn bộ sự kiện hook của 11 log đều `success`, exit 0, kể cả 467 lần `PreToolUse:Read`, 349 `:Bash`, 213 `:Grep`, 130 `:Edit`, 87 `:Write`, 37 `SubagentStop`. Không có `deny`/`block`. Stop gate không chặn lần nào.

Duy nhất một `ask`, ở `turn-t3b.jsonl` dòng 5042: reviewer chạy lệnh quét tên file nhạy cảm:

```
git ls-files | grep -iE "lock|\.env|secret|credential|\.pem|\.key|\.jks|aip-gate"
```

Hook hỏi "Lệnh nhắc tới file bí mật `.env`…". Đây là bắt nhầm: lệnh chỉ liệt kê tên file, không đọc nội dung. Tôi chạy lại `core/hooks/scripts/guard-bash.mjs` với các biến thể (probe ở scratchpad `hookprobe.mjs`):

| Lệnh | Kết quả |
|---|---|
| `grep -iE ".env"` | cho qua |
| `grep -E "\.env"` | cho qua |
| `grep -E "lock\|.env"` (có `\|` trong mẫu) | **ask** |
| `grep -iE "lock\|\.env\|secret"` | **ask** |

[Inference] Ngoại lệ "mẫu tìm kiếm không phải file được mở" (`guard-bash.mjs:633`) mất tác dụng khi mẫu có `|`, có thể vì bộ tách đoạn lệnh cắt ở `|` trong dấu nháy; tôi chưa đọc hàm tách nên chưa xác nhận. Trong `-p` câu hỏi không có ai trả lời; kết quả công cụ là chính câu hỏi và lời gọi kế tiếp là `Read` khác (dòng 5045). [Inference] Lệnh quét đó không chạy được, nên bước kiểm "không có file bí mật bị commit" của reviewer không có kết quả; tôi không kiểm được reviewer có chạy lại bằng cách khác không.

Không đánh giá được chặn đúng (true positive): trial không có lệnh nào thử đẩy nhánh bảo vệ hay đọc secret thật, nên 8 điểm là "không chặn oan có hệ thống, một lần bắt nhầm", chưa phải "chặn đúng".

### 4.5 Ít hỏi: 6/10

Trước G3, phiên feature dừng 6 lần cần người: 4 câu ở lượt 0, 8 điểm ở lượt 1, 5 câu cộng G1 ở lượt 1b, G2 cộng câu cách chạy ở lượt 2, blocker Task 1 ở lượt 3, rồi G3. Các cổng G1/G2/G3 là cổng thật theo thiết kế. Phần đáng trừ:
- **Blocker Task 1 tránh được**: một lệnh `npm view openapi-typescript peerDependencies` ở bước đề xuất công cụ đã lộ xung đột với TypeScript 7; thay vào đó nó thành `[Unverified]` trong tài liệu G1 (lượt 1b: "chưa chạy thử"), đi qua G1 và G2 rồi mới dừng ở Task 1 (lượt 3).
- Lượt 1 hỏi 8 điểm trong một tin nhắn, trong đó cỡ trang, reset trang khi đổi bộ lọc, tải lại sau khi tạo/đổi trạng thái đều có khuyến nghị và được trả lời "đồng ý hết"; theo [Inference] có thể gom thành "giả định đã chốt, bác bỏ nếu sai" thay vì hỏi từng điểm.
- G3 lần 1 hỏi thêm 2 điểm ngoài hai finding (form tạo ticket, xác nhận ADR Accepted). Điểm ADR phát sinh vì chính agent đã đặt Accepted ở lượt 2 mà dòng 5 của ADR vẫn ghi "người chốt Status xác nhận sau".
- Tôi không thấy lần hỏi nào lặp lại một điều đã được trả lời.

### 4.6 Chi phí: 6/10

Run 2 đầy đủ: $23,39 và 28,6 phút. Tách theo giai đoạn: chuẩn bị tài liệu (lượt 0–2) $1,65; Task 1–10 $17,60; sửa sau G3 + merge $3,07; bugfix + performance $0,68. Có 13 lượt `frontend-reviewer`, 5 lượt `general-purpose` cho DOCS/review docs, 1 auditor; 4 trong 6 finding `major` do review từng task bắt, 2 còn lại do review cuối. Tôi không có số liệu để so sánh với chạy không review nên không nói review "đáng" hay "không đáng"; người dùng đã chọn không đặt trần. Điểm 6 vì lượt 4 (605 s, $2,57) tốn cho 2 sửa nhỏ cộng một lượt review lại, và mỗi task UI đi qua implementer, test-writer, reviewer ba lần gọi riêng.

### Bảng tổng

| Tiêu chí | Điểm |
|---|---|
| 1. Routing | 7 |
| 2. Kết quả | 8 |
| 3. Đúng quy trình | 7 (feature 8, bugfix 4) |
| 4. Hook | 8 |
| 5. Ít hỏi | 6 |
| 6. Chi phí | 6 |
| **Trung bình** | **7,0** |

## 5. Danh sách nâng cấp, xếp theo tác động

Mỗi mục: bằng chứng, file cần đổi, và nhãn tin cậy.

### N1. Thêm bước đối chiếu giao diện thật với mockup, gồm trạng thái lỗi và focus — tác động cao

Bằng chứng: quét mọi lời gọi công cụ của `turn-t3b.jsonl` và `turn-t4.jsonl` cho `manual-check`, `screenshot`, `toHaveScreenshot`, `getComputedStyle`, `axe`: các khớp chỉ là chữ trùng trong nội dung ledger và prompt giao agent, không có lệnh chụp ảnh hay đo style. `e2e/ticket-board.spec.ts` (7 test, dòng 35–119) chạy Chrome thật nhưng chỉ có luồng lọc, phân trang, tạo, đổi trạng thái; không có test nào cho 404, trạng thái lỗi, hay focus, và không có ảnh chụp. `frontend-manual-check` không được gọi và không được workflow nào nhắc: `grep manual-check` ngoài `docs/`, `build/` chỉ ra `plugins/_published.json:25`, `plugins/frontend/.manifest.json:4`, bản thân skill và test pin `test/content/51-enrich-frontend.pin.mjs`; `workflows/feature/WORKFLOW.md` (dòng 10 và 29–30 liệt kê skill/agent) không có nó. Hai lỗi UX `major` (mục 4.2) chỉ lộ nhờ review cuối đọc code.

Đổi:
- `workflows/feature/WORKFLOW.md`, Bước 5 hoặc Bước 6: thêm bước "chạy UI trên bản build, so mockup, lấy ảnh chụp từng trạng thái loading/rỗng/lỗi/thành công, thử Tab sau mỗi lần tải lại" gọi `frontend-manual-check` (hoặc Playwright chụp ảnh) cho feature có màn hình; kết quả vào evidence.
- `plugins/frontend/skills/frontend-implement/references/fidelity-checklist.md` (dòng 15–28): thêm mục "đã chạy thật, đối chiếu mockup" cần dẫn chứng (ảnh hoặc lệnh), không chỉ tích ô.
- `plugins/frontend/skills/frontend-code-review/references/review-dimensions.md` dòng 110–111 chỉ nói focus ở modal và đổi route; thêm trường hợp thay nội dung tại chỗ (tải lại danh sách, phân trang, xóa dòng) và vùng `role="alert"` bị gỡ cùng danh sách.

Tin cậy: [Verified] phần grep và đọc file; [Inference] rằng bước chạy thật sẽ bắt được hai lỗi trên, tôi chưa thử.

### N2. Không cho phép bỏ gate khi bug "đã rõ" trong `workflow-bugfix` — tác động cao

Bằng chứng: mục 4.3. Đổi: `workflows/bugfix/WORKFLOW.md`, Bước 5 (dòng 103–122) thêm ràng buộc hoặc bảng "tự biện minh" ("bug một dòng, `git show` đã rõ" vẫn phải trình root cause và hỏi); nếu muốn có lối nhanh thì định nghĩa rõ điều kiện (đã có test đỏ + nguyên nhân là một commit cụ thể) và vẫn bắt buộc Bước 8 và nhánh riêng. `plugins/frontend/skills/frontend-fix/SKILL.md`: kiểm lại `description` có cụm tự nhiên của người dùng ("lỗi ở màn hình", "đang ở trang 3 đổi bộ lọc thì …") vì `frontend-fix` không được kích hoạt trong lượt này và 0/3 trong eval cũ. Việc đo thêm là `node scripts/routing-score.mjs`: ghi chú của phiên khác báo cặp frontend-fix→backend-fix trượt 2 lần.

Tin cậy: [Verified] hành vi bỏ bước (agent tự nêu); n=1 lần chạy, bug do tôi gài nên dễ; nguyên nhân do `-p` không hỏi được là [Inference].

### N3. Kiểm tương thích công cụ sinh code trước G1 — tác động trung bình-cao

Bằng chứng: `plugins/frontend/skills/frontend-data-integration/SKILL.md:79–83` bắt đầu bằng "chưa có codegen → đề xuất `openapi-typescript` … hành vi công cụ gắn `[Unverified]`"; `references/contract-and-codegen.md:21–33` chỉ nêu script, không có kiểm peer. Hậu quả đo được: xung đột `ERESOLVE` (peer `typescript@^5`) và crash `createKeywordTypeNode` với TypeScript 7.0.2 lộ ở lượt 3, sau khi ADR 0005, AC5.1/5.2, tên type và Task 1 đã dựa trên giả định; phương án sửa phải đổi ADR, ghi `Ruling:` và thêm `.gitignore`.

Đổi: `SKILL.md` mục I2 thêm "đọc `peerDependencies` của công cụ so với TypeScript/Node của project (`npm view <gói> peerDependencies`) và chạy thử trong thư mục tạm trước khi đề xuất; ghi kết quả vào ADR"; `workflows/feature/WORKFLOW.md` Bước 3 (tài liệu): giả định công cụ còn `[Unverified]` mà kiểm được bằng một lệnh thì kiểm trước G1. Lưu ý quy trình hiện tại đã gắn nhãn `[Unverified]` đúng; vấn đề là nhãn đó không buộc phải kiểm trước cổng.

Lưu ý: tên công cụ do chính prompt lượt 1b của tôi nêu ("được thêm openapi-typescript"), nên trial không đo được việc plugin tự chọn công cụ; chỉ đo được việc không có bước kiểm tương thích sau khi công cụ đã được chốt.

Tin cậy: [Verified] (log lượt 3 và đọc file); mức độ phổ biến ở project khác [Unverified].

### N4. Kiểm test có assert nội dung người dùng thấy cho AC hiển thị — tác động trung bình

Bằng chứng: agent nói test tích hợp AC3.5 xanh "nhưng không kiểm có thông báo" (báo cáo cuối lượt 3b); chính Ruling ban đầu của agent sai, review từng task không bắt được. Đổi: `plugins/frontend/skills/frontend-testing/SKILL.md` hoặc reference của nó thêm quy tắc "AC mô tả thứ người dùng thấy → có assertion trên text hoặc role xuất hiện sau đủ chuỗi sự kiện (kể cả tải lại)"; `plugins/frontend/skills/frontend-code-review/references/review-dimensions.md` dòng 30–35 (loading/error/empty) thêm "thông báo lỗi nằm ngoài vùng bị gỡ khi loading".

Tin cậy: [Verified] lời agent; [Inference] rằng quy tắc mới đủ để bắt.

### N5. Lưu script đo trong `perf/` và dọn artefact công cụ — tác động trung bình-thấp

Bằng chứng: mục 4.3, đường performance. Đổi: `plugins/frontend/skills/frontend-performance/SKILL.md:39–41`: khi không có Lighthouse và chưa được phép cài, mặc định viết script Node + Playwright vào `perf/` thay vì chạy `browser_run_code_unsafe`; `plugins/frontend/skills/frontend-init/SKILL.md`: thêm `.playwright-mcp/`, `perf/results/`, `dist/` vào mẫu `.gitignore`. Chưa thử.

### N6. Hook `guard-bash` bắt nhầm mẫu `grep` có `|` — tác động thấp, ngoài phạm vi `plugins/frontend`

Bằng chứng: mục 4.4, có tái hiện. File: `core/hooks/scripts/guard-bash.mjs` quanh dòng 614–635. Trùng với điểm "bắt nhầm" (B) đã duyệt trong request hook-standardization (`hook-standardization-scope` trong bộ nhớ dự án); nên gộp vào request đó thay vì mở request riêng.

### Không đề xuất sửa

- `workflow-performance` đã nêu ngưỡng và đo ≥3 lần; lượt 7 trung thực báo "không tái hiện được". Ca 5000 ticket với `PAGE_SIZE = 10` cho trang không chậm là lẽ thường, không phải lỗ plugin.
- Việc agent dừng ở blocker Task 1 thay vì tự chọn là đúng.

## 6. Những gì tôi chưa kiểm hoặc không biết

- Hành vi thật của focus và hiển thị trên trình duyệt thật: không ai chạy; cả báo cáo dựa trên jsdom và E2E của project.
- Chi phí subagent có nằm trong `total_cost_usd` hay không.
- Mức ảnh hưởng của `superpowers` và `ponytail` lên routing và độ hay hỏi.
- Hook `ask` trong `-p` được xử lý ra sao (tự từ chối hay bỏ qua): suy từ log, không đọc mã harness.
- Chưa chạy `workflow-performance` đủ 8 bước vì không có bottleneck; đường sửa hiệu năng (`frontend-fixer` ở Bước 5, `frontend-performance-analyst`) vẫn chưa được thử. Tương tự `frontend-refactor`, `frontend-migrate-architecture`, `frontend-manual-check` không được phủ.
- Chỉ một lần chạy mỗi kịch bản (n=1 cho bugfix và performance); không nên đọc điểm theo từng số lẻ.
