# Brainstorming và định tuyến tin cậy Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** thêm skill `brainstorming` (core) ghi `brief.md` có khối định tuyến, `route.mjs` chọn route tất định từ bảng Registry của orchestrator, `status: misrouted`, nhật ký `.aip/routing-log.jsonl`, eval định tuyến và bước đóng phiên trong `finish.md`.
**Architecture:** `brief.md` (khối định tuyến) → `route.mjs` đọc hai bảng của `workflows/orchestrator/WORKFLOW.md` theo tên cột → `workflow-orchestrator` chạy route đã duyệt → Bước 1 của workflow pipeline có thể trả `misrouted` → orchestrator chọn route kế tiếp với cùng brief. Hằng số tập đóng (`TYPES`, `SCOPES`) có một nguồn là `route.mjs`; template brief và orchestrator được contract test đối chiếu với nguồn đó.
**Tech Stack:** Node 20+ ESM zero-dependency, markdown, test tự dựng của repo (`test/harness.mjs`).
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/skills/brainstorming/scripts/route.mjs` | Đọc khối định tuyến của brief + hai bảng Registry, chấm điểm tất định, ghi nhật ký định tuyến | Task 1 |
| `test/route.test.mjs` | Test có tham số cho `route.mjs` (chọn, hai ứng viên, không khớp, `--exclude`, `--log`) | Task 1 |
| `package.json` | Thêm `test/route.test.mjs` vào chuỗi `npm test` | Task 1 |
| `core/skills/artifact-templates/references/brief.template.md` | Khung `brief.md` kèm khối định tuyến | Task 2 |
| `core/skills/artifact-templates/SKILL.md` | Mục lục template (dòng `brief`) và ghi chú `check-request` nhận request chỉ có brief | Task 2 |
| `core/skills/artifact-templates/scripts/check-request.mjs` | Request chỉ có `brief.md` không bị W1 giả | Task 2 |
| `test/contract/35-artifact-templates.contract.mjs` | Contract của template brief, đối chiếu enum với `route.mjs`, brief-only không W1 | Task 2 |
| `workflows/orchestrator/WORKFLOW.md` | Ba cột mới ở hai bảng, hàng `quyết-định`, đường chạy khi có `brief.md`, ghi nhật ký | Task 3 |
| `core/principles/workflow-output-contract.md` | Giá trị `misrouted` của `workflow_result.status` | Task 3 |
| `test/contract/55-routing.contract.mjs` | Contract bảng Registry thật: cột, tập đóng, route kỳ vọng của brief mẫu, `misrouted` | Task 3, Task 4 |
| `workflows/{feature,bugfix,security-review,performance}/WORKFLOW.md` | Bước 1 kiểm `điều-kiện`, trả `misrouted`; Bước 2 của feature đọc `brief.md` | Task 4 |
| `core/skills/brainstorming/SKILL.md` + `references/*.md` | Quy trình brainstorm, bốn reference | Task 5 |
| `core/.manifest.json`, `README.md`, `README_VI.md`, `CLAUDE.md` | Đăng ký skill mới, danh sách test | Task 5 |
| `core/skills/plan-execution/references/finish.md` | Bước đóng phiên (13) | Task 6 |
| `plugins/engineering/skills/engineering-spec-writing/SKILL.md` | Trỏ tới reference làm rõ chung thay vì chép | Task 7 |
| `test/content/31-workflow-self-sufficient.pin.mjs` | Đổi nguồn đọc cụm bắt buộc sang SKILL + reference chung | Task 7 |
| `evals/core/brainstorm-gather-questions/`, `evals/core/route-brief-decision/` | Hai case eval: lượt đầu gom câu hỏi; route kỳ vọng của một brief | Task 8 |
| `test/content/36-brainstorming-routing.pin.mjs` | Neo các giá trị vận hành (lệnh, khoá, trạng thái, đường dẫn) theo AC | Task 4–8 |
| `core/.manifest.json`, `workflows/.manifest.json`, `plugins/engineering/.manifest.json`, `plugins/_versions.lock.json` | Bump version + lock | Task 9 |
| `docs/requests/2026-10-31-brainstorming-routing/trial-6.md` | Kết quả lượt thử 6 | Task 10 |

## Global Constraints
- Tập đóng `loại-việc`: `feature | bug | quyết-định | nghiên-cứu | quy-trình | tài-liệu | nghiệp-vụ | không-làm`. Tập đóng `phạm-vi`: `code-be | code-fe | fullstack | data | ops | không-code`. Nguồn duy nhất là `TYPES` và `SCOPES` export từ `route.mjs`; không chép danh sách sang nơi khác mà không có test đối chiếu.
- Khối định tuyến của brief nằm dưới heading `## Định tuyến`, mỗi dòng `khoá: giá trị`, khoá: `loại-việc`, `phạm-vi`, `đầu-ra-mong-đợi`, `rủi-ro`, `ứng-viên-route` (dạng `[chính, phụ]`), và `route-đã-duyệt` (chỉ ghi sau khi người dùng duyệt brief; có thể là `chưa-có-quy-trình`).
- Registry: ba cột mới `loại-việc`, `phạm-vi`, `điều-kiện` được **thêm vào cuối** hàng của cả `## Registry` lẫn `## Yêu cầu chạy trực tiếp bằng skill`, không đổi thứ tự cột cũ (`parseRegistry` đọc `risk` ở ô thứ 3, `registrySignals` đọc `Tín hiệu` ở ô thứ 2). `route.mjs` tìm cột theo tên tiêu đề. Giá trị `loại-việc`/`phạm-vi` là danh sách phân tách bằng dấu phẩy hoặc `*`. `điều-kiện` là `—` hoặc danh sách vị từ phân tách bằng dấu phẩy dạng `<trường>=<a|b>`, `<trường>!=<a|b>`, `<trường>~<chuỗi con>` trên các trường `loại-việc`, `phạm-vi`, `rủi-ro` của brief.
- Chấm điểm: `THRESHOLD = 6`, `MARGIN = 1`. Điểm = 4 nếu `loại-việc` khớp + 2 nếu `phạm-vi` khớp + 1 nếu id nằm đầu `ứng-viên-route` + 0.5 nếu nằm sau; hàng không đạt mọi vị từ `điều-kiện` bị loại. Hàng đủ điều kiện khi điểm ≥ `THRESHOLD`. Một ứng viên, hoặc chênh ≥ `MARGIN` so với hạng hai → `chosen`, `confidence: "high"`; chênh < `MARGIN` → `chosen: null`, hai `candidates`, `confidence: "low"`; không hàng nào → `chosen: null`, `candidates: []`, `confidence: "none"`. `**Thứ tự ưu tiên:**` chỉ dùng để sắp xếp hiển thị và thứ tự thử khi `misrouted`, không dùng để phá thế hoà.
- Đầu ra JSON của `route.mjs`: `{ chosen, candidates, reason, confidence }`; `chosen` là `{ id, kind }` với `kind ∈ workflow | skill | in-session`. Exit 0 khi chạy được kể cả không khớp; exit 2 khi thiếu đối số hoặc không đọc được file.
- `status: misrouted` chỉ thuộc `workflow_result` (không thuộc `agent_result`); trong văn bản `Khi fail` của Bước 1 các workflow không dùng chữ "hỏi" (luật `checkGraphAgainstBody`: chữ "hỏi" đòi cạnh `ask_user` trong `graph.json`); không đổi `graph.json` của workflow nào.
- Nhật ký: `<gốc repo chính>/.aip/routing-log.jsonl`, mỗi lần định tuyến xong một dòng `{ts, brief, chosen, overridden, misrouted}`, append-only, ghi hỏng thì bỏ qua và cảnh báo (fail-open, không chặn việc chính).
- Mô tả skill theo template Phase 1 (một câu hành động ≤ 200 ký tự, `Dùng khi người dùng muốn "…"` 3–5 cụm, `Không dùng khi <ca> → <id>.`), tổng ≤ 500 ký tự, không trùng cụm kích hoạt với `engineering-spec-writing` và `workflow-orchestrator`.
- Zero-dependency, UTF-8 không BOM, LF, tài liệu và comment tiếng Việt có dấu; comment chỉ giải thích *vì sao*.
- Mọi task bump version chỉ ở Task 9 (một chỗ); các task khác không sửa `.manifest.json` hay lock. Commit do session chính qua `core:git-workflow`, `commit -F`, body tiếng Việt, không `Co-Authored-By`. Không push.

## Review Focus
- Khối định tuyến thiếu khoá, sai hoa-thường, CRLF, `ứng-viên-route` rỗng → `route.mjs` phải trả `chosen: null` kèm lý do, không ném lỗi (Task 1, test có tham số `ac2_3`).
- Chênh điểm đúng bằng `MARGIN` (chọn) và đúng 0.5 (hai ứng viên); `--exclude` loại route đã thử rồi mới chấm (Task 1, test `ac2_1`/`ac2_2`).
- Thêm cột cuối không làm gãy `parseRegistry`, `registrySignals`, contract `50-workflows` hiện có (Task 3, chạy lại contract 50 và `55-routing`).
- Văn bản mới ở `Khi fail` Bước 1 không kéo theo lệch `graph.json` (Task 4, `checkGraphAgainstBody` trong contract 50).
- Tách bước làm rõ chung khỏi `engineering-spec-writing` không làm mất các cụm mà pin 31 bảo vệ: lối thoát bỏ qua phần hỏi, `quyết định của agent`, 2–3 hướng sau playback (Task 7, pin 31 đổi nguồn đọc nhưng không xoá).

### Task 1: `route.mjs` chấm điểm định tuyến
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC2.1, AC2.2, AC2.3, AC5.1
**Files:**
- Create: `core/skills/brainstorming/scripts/route.mjs`
- Modify: `package.json`
- Test: `test/route.test.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `TYPES`, `SCOPES`, `THRESHOLD`, `MARGIN` (hằng export); `parseBrief(text)` trả `{ type, scope, risk, hints, approved } | null` (`null` khi thiếu khối hoặc thiếu `loại-việc`/`phạm-vi`); `parseRoutes(orchestratorText)` trả mảng `{ id, kind, types, scopes, conds, order }`; `routeBrief(brief, routes, { exclude })` trả `{ chosen, candidates, reason, confidence }`; `appendRoutingLog(root, record)`; `main(argv, deps)` trả mã thoát. Lệnh: `node route.mjs <brief.md> <orchestrator WORKFLOW.md> [--exclude id,id]` và `node route.mjs --log <brief.md> --chosen <id|-> [--overridden] [--misrouted]`.

- [ ] **Step 1:** Viết `test/route.test.mjs` đỏ trước, theo mẫu `test/status.test.mjs` (harness `ok`, `mkdtemp` + `fs.rmSync` dọn). Test có tham số, tên chứa ID AC: `ac2_1` (brief khớp rõ một hàng workflow → `chosen.id` đúng, `confidence: "high"`; brief non-code khớp hàng skill; hàng không đạt `điều-kiện` bị loại), `ac2_2` (hai hàng chênh 0.5 → `chosen: null`, hai `candidates`; chênh đúng 1 → chọn), `ac2_3` (không hàng nào, thiếu khối, thiếu `loại-việc`, CRLF → `chosen: null` kèm `reason`), `--exclude` (loại id đã thử), `ac5_1` (`--log` ghi đúng một dòng JSON `{ts,brief,chosen,overridden,misrouted}` vào `<root>/.aip/routing-log.jsonl`; ghi hai lần được hai dòng; thư mục không ghi được → exit 0 và cảnh báo trên stderr). Fixture là chuỗi brief + bảng Registry mẫu theo Global Constraints, không đọc `workflows/orchestrator/WORKFLOW.md` thật.
- [ ] **Step 2:** Chạy `node test/route.test.mjs`; mong đợi đỏ vì thiếu `route.mjs` (ghi lệnh + exit khác 0 làm `red:`).
- [ ] **Step 3:** Viết `core/skills/brainstorming/scripts/route.mjs` theo chữ ký ở Interfaces: đọc cột theo tên tiêu đề, bỏ qua dòng không phải hàng bảng, ghi nhật ký ở gốc repo chính bằng `git rev-parse --git-common-dir` (cùng cách `workspace.mjs`, không import chéo skill vì skills-mode cài rời từng skill). Một comment ngắn cho `THRESHOLD`/`MARGIN` nói đây là ngưỡng chọn của builder.
- [ ] **Step 4:** Chạy lại `node test/route.test.mjs`; mong đợi xanh, exit 0.
- [ ] **Step 5:** Thêm `node test/route.test.mjs` vào cuối chuỗi `npm test` trong `package.json`; chạy `node test/route.test.mjs` xác nhận vẫn xanh.

### Task 2: Template `brief` và `check-request` nhận request chỉ có brief
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC1.2
**Files:**
- Create: `core/skills/artifact-templates/references/brief.template.md`
- Modify: `core/skills/artifact-templates/SKILL.md`
- Modify: `core/skills/artifact-templates/scripts/check-request.mjs`
- Test: `test/contract/35-artifact-templates.contract.mjs`

**Interfaces:**
- Consumes: `TYPES`, `SCOPES` (export của `route.mjs`, Task 1); khoá khối định tuyến theo Global Constraints
- Produces: `brief.template.md` (header `<!-- artifact-template type: brief … -->` + heading `## Định tuyến`); hành vi `check-request.mjs`: thư mục chỉ có `brief.md` thì không có cảnh báo W1

- [ ] **Step 1:** Mở rộng `test/contract/35-artifact-templates.contract.mjs` (đỏ trước): (a) `brief.template.md` có khối header với `type: brief`, có mục lục ở `SKILL.md`, có heading `## Định tuyến` đủ sáu khoá của Global Constraints; (b) mọi giá trị `TYPES`/`SCOPES` import từ `route.mjs` xuất hiện trong template và template không nêu giá trị lạ; (c) `checkRequest` với `texts` chỉ có `brief.md` → 0 cảnh báo (nhắc `AC1.2` trong tên assert); (d) thư mục không có `brief.md`, `requirement.md` lẫn `design.md` vẫn báo W1 như trước.
- [ ] **Step 2:** Chạy `node test/validate.mjs --build --only artifact-templates`; mong đợi đỏ ở (a)–(c).
- [ ] **Step 3:** Viết `brief.template.md` (Tiếng Việt có dấu): mục tiêu, vì sao bây giờ và thành công trông thế nào, goal/non-goal/anti-goal, hiện trạng và tham khảo đã thấy, quyết định của agent, phần đoán `[giả định]`, `## Định tuyến` với sáu khoá, trạng thái `draft | approved`. Thêm một dòng `brief` vào mục lục `SKILL.md` (Validator `scripts/check-request.mjs`, nguồn: design request này) và một câu mô tả hành vi brief-only.
- [ ] **Step 4:** Sửa `check-request.mjs`: đọc thêm `brief.md` và bỏ W1 khi chỉ có `brief.md` (không `requirement.md`/`design.md`); giữ nguyên mọi cảnh báo khác. Một comment ngắn nói vì sao.
- [ ] **Step 5:** Chạy lại `node test/validate.mjs --build --only artifact-templates`; mong đợi xanh. Chạy `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-31-brainstorming-routing/` xác nhận vẫn 0 cảnh báo (request này có design).

### Task 3: Orchestrator đọc brief và Registry có kiểu
**Kind:** DOCS
**Phủ AC:** AC2.1, AC2.2, AC2.3, AC3.1, AC3.2, AC5.1
**Files:**
- Modify: `workflows/orchestrator/WORKFLOW.md`
- Modify: `core/principles/workflow-output-contract.md`
- Create: `test/contract/55-routing.contract.mjs`
- Test: `test/contract/55-routing.contract.mjs`

**Interfaces:**
- Consumes: `parseRoutes`, `routeBrief`, `TYPES`, `SCOPES` (Task 1); khoá `route-đã-duyệt` của brief (Task 2)
- Produces: hai bảng có ba cột `loại-việc`, `phạm-vi`, `điều-kiện`; giá trị `status: misrouted` của `workflow_result`; lệnh `node <thư mục skill brainstorming>/scripts/route.mjs --log …` do orchestrator gọi khi một lần định tuyến xong

- [ ] **Step 1:** Viết `test/contract/55-routing.contract.mjs` (đỏ trước): mọi hàng của `## Registry` và `## Yêu cầu chạy trực tiếp bằng skill` (đọc bằng `parseRoutes`) có `loại-việc` ⊂ `TYPES` hoặc `*`, `phạm-vi` ⊂ `SCOPES` hoặc `*`, mọi `điều-kiện` đúng cú pháp vị từ; mọi `workflow-*` trong Registry có ít nhất một `loại-việc`; ba brief mẫu (feature fullstack, quyết-định không-code, nghiên-cứu không-code) chạy qua `routeBrief` với bảng thật cho kết quả `workflow-feature`, `engineering-adr`, `chosen: null` (nhắc `AC2.1`, `AC2.3` trong tên assert); `workflow-output-contract.md` nêu `misrouted` cho `workflow_result` mà không cho `agent_result` (nhắc `AC3.2`).
- [ ] **Step 2:** Chạy `node test/validate.mjs --build --only routing`; mong đợi đỏ.
- [ ] **Step 3:** Sửa `workflows/orchestrator/WORKFLOW.md`: thêm ba cột cuối cho cả hai bảng (giá trị chọn theo tín hiệu hiện có; `workflow-security-review` và `workflow-performance` dùng vị từ `rủi-ro~…`), thêm hàng `quyết-định` → `engineering-adr`, đổi hàng "cập nhật tài liệu" để ô Skill không mở đầu bằng backtick (route `in-session`). Không đổi thứ tự cột cũ, không đổi `**Thứ tự ưu tiên:**`.
- [ ] **Step 4:** Sửa các bước của orchestrator giữ đủ 8 trường: Đầu vào tuỳ chọn thêm `brief.md`; Bước 1 khi có `brief.md` thì chạy `route.mjs` (kèm `--exclude` các route đã thử), dùng `route-đã-duyệt` nếu có, không phân loại lại; Bước 3 chỉ bỏ qua khi brief đã duyệt và risk không phải `high`/`critical` (brief chưa duyệt hoặc risk cao thì vẫn xác nhận như cũ); Bước 4 khi workflow trả `misrouted` thì quay lại Bước 1 với route kế và cùng `brief.md`, tối đa số route còn lại; Bước 5 ghi nhật ký một dòng bằng `route.mjs --log`. Yêu cầu tự do không có brief giữ nguyên hành vi. Orchestrator không có `graph.json` nên không đổi graph.
- [ ] **Step 5:** Thêm `misrouted` vào mục `Result contract` của `workflow-output-contract.md` (chỉ `workflow_result.status`, kèm `summary` nêu lý do và `next_actions` nêu route gợi ý) và vào mục Kiểm đầu ra worker một câu: `misrouted` không phải lỗi, Supervisor chuyển route kế.
- [ ] **Step 6:** Chạy `node test/validate.mjs --build --only routing` và `node test/validate.mjs --build --only workflows`; mong đợi xanh, contract 50 hiện có không đỏ.

### Task 4: Bước 1 của workflow pipeline và Bước 2 của feature
**Kind:** DOCS
**Phủ AC:** AC3.2, AC4.1
**Files:**
- Modify: `workflows/feature/WORKFLOW.md`
- Modify: `workflows/bugfix/WORKFLOW.md`
- Modify: `workflows/security-review/WORKFLOW.md`
- Modify: `workflows/performance/WORKFLOW.md`
- Test: `test/contract/55-routing.contract.mjs`
- Test: `test/content/36-brainstorming-routing.pin.mjs`

**Interfaces:**
- Consumes: giá trị `status: misrouted` và cột `điều-kiện` của Registry (Task 3)
- Produces: câu `Khi fail` Bước 1 của bốn workflow trả `workflow_result` với `status: misrouted`; Bước 2 của `workflow-feature` đọc `brief.md`

- [ ] **Step 1:** Mở rộng `55-routing.contract.mjs` (đỏ trước): Bước 1 của đúng bốn workflow pipeline nhắc `misrouted` và `điều-kiện`; Bước 2 của `workflow-feature` nhắc `brief.md` (tên assert nhắc `AC3.2`, `AC4.1`). Tạo `test/content/36-brainstorming-routing.pin.mjs` dạng bảng `[AC, file, regex]` có tham số, ban đầu chỉ có hai dòng AC3.2 và AC4.1 này.
- [ ] **Step 2:** Chạy `node test/validate.mjs --build --only routing`; mong đợi đỏ ở bốn workflow và feature Bước 2.
- [ ] **Step 3:** Ở Bước 1 của từng workflow thêm vào `Hành động`: có `brief.md` của request thì đối chiếu `loại-việc`, `phạm-vi`, `điều-kiện` của chính hàng Registry mình với điều thấy khi chạy baseline và đọc vùng code; thêm vào `Khi fail` và `Evidence`: không khớp → dừng, trả `workflow_result` `status: misrouted` kèm lý do và route gợi ý, không làm tiếp. Giữ nguyên các câu `blocked` cũ và không dùng chữ "hỏi" trong `Khi fail`.
- [ ] **Step 4:** Ở Bước 2 của `workflow-feature` thêm: request có `brief.md` thì chỉ hỏi phần brief chưa có (mục tiêu đã chốt, phạm vi, quyết định của agent không hỏi lại), vẫn gom vào một tin nhắn.
- [ ] **Step 5:** Chạy `node test/validate.mjs --build --only workflows`, `--only routing` và `node test/content/36-brainstorming-routing.pin.mjs` nếu chạy độc lập được; mong đợi xanh, kể cả `checkGraphAgainstBody` của bốn graph.

### Task 5: Skill `brainstorming`
**Kind:** DOCS
**Phủ AC:** AC1.1, AC1.2, AC1.3
**Files:**
- Create: `core/skills/brainstorming/SKILL.md`
- Create: `core/skills/brainstorming/references/clarify-core.md`
- Create: `core/skills/brainstorming/references/coverage.md`
- Create: `core/skills/brainstorming/references/builder-check.md`
- Create: `core/skills/brainstorming/references/visual.md`
- Modify: `core/.manifest.json`
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `CLAUDE.md`
- Test: `test/content/36-brainstorming-routing.pin.mjs`

**Interfaces:**
- Consumes: `brief.template.md` và khoá khối định tuyến (Task 2); lệnh `route.mjs` (Task 1)
- Produces: skill `brainstorming` (frontmatter `order: 9`, `effort: high`, `runsIn: plan`, `invoke: per-request`); `references/clarify-core.md` (cổng đủ thông tin + lối thoát, playback, 2–3 hướng sau playback) để Task 7 trỏ tới

- [ ] **Step 1:** Mở rộng pin 36 (đỏ trước) với các dòng AC1.1–AC1.3: `SKILL.md` nêu `brief.md`, `route.mjs`, dòng bỏ qua phần hỏi, thẻ gom câu hỏi có đáp án khuyến nghị và một câu mở, `quyết định của agent`, builder check một vòng, cổng duy nhất là duyệt brief (một regex ngắn mỗi ý, không pin cả câu).
- [ ] **Step 2:** Chạy `node test/validate.mjs --build --only brainstorming-routing`; mong đợi đỏ vì chưa có skill.
- [ ] **Step 3:** Viết `SKILL.md`: frontmatter theo Global Constraints (đủ các khoá nguồn, `argument-hint` nếu cần quoted), thân có `## Quy trình…` và `## Ranh giới an toàn…`; quy trình: nạp context và gọi cổng "đủ thông tin" (đủ thì làm thẳng), lượt đầu gồm dòng bỏ qua + thẻ gom câu hỏi, các lượt sau cũng gom, đề nghị đi xem (code, file, web) và chờ đồng ý, mô tả trước phương án sau, spike bỏ đi khi cần cảm nhận, playback từng phần, builder check, ghi `brief.md` bằng template `brief`, chạy `route.mjs`, trình thẻ duyệt brief có route + ứng viên + quyền ghi đè và ghi `route-đã-duyệt` sau khi duyệt; route risk cao đòi câu duyệt rõ ngay trên thẻ này. Ra ngoài repo code thì hỏi chỗ lưu. Nêu tham chiếu superpowers 7.0.0 brainstorming ở cuối, không chép nội dung.
- [ ] **Step 4:** Viết bốn reference: `clarify-core.md` (phần chung, nguồn duy nhất), `coverage.md` (danh sách nội dung cần nắm: loại việc và điểm đặc biệt, vì sao bây giờ và thành công, goal/non-goal/anti-goal, tham khảo đã thấy, hiện trạng), `builder-check.md` (subagent mới, 3 nhóm, một vòng hỏi, tự đọc khi không có subagent; bám `engineering-spec-writing/references/builder-check.md` nhưng cho `brief.md`), `visual.md` (widget inline có nút → HTML cục bộ ghi dưới `.aip/runs/<request>/` theo kiểu `status.html` → text; không viết server riêng).
- [ ] **Step 5:** Đăng ký: thêm `brainstorming` vào `description` của `core/.manifest.json` (contract bắt thiếu id), cập nhật danh sách skill ở `README.md`, `README_VI.md` và `CLAUDE.md` (số skill core, dòng `npm test` thêm `route`), theo cách commit `feat(core): add aip-status skill` đã làm.
- [ ] **Step 6:** Chạy `node test/validate.mjs --build` (toàn contract + pin) và `node test/overlap.mjs`; mong đợi xanh, báo cáo overlap không có cặp trùng cụm kích hoạt với `engineering-spec-writing`/`workflow-orchestrator`.

### Task 6: Bước đóng phiên trong `finish.md`
**Kind:** DOCS
**Phủ AC:** AC7.1
**Files:**
- Modify: `core/skills/plan-execution/references/finish.md`
- Test: `test/content/36-brainstorming-routing.pin.mjs`

**Interfaces:**
- Consumes: khoá `cleanup` của `autonomy.mjs` và mục "Dọn theo khoá" của `finish.md`
- Produces: mục `## Đóng phiên con` sau "Dọn theo khoá", được bước 4 của "Merge local theo khoá" gọi tới

- [ ] **Step 1:** Thêm dòng AC7.1 vào pin 36 (đỏ trước): `finish.md` có mục `Đóng phiên con`, nêu `archive`, `cleanup: true`, phiên còn chạy hoặc đang chờ người dùng thì giữ và nêu tên, và nêu rõ không xoá phiên.
- [ ] **Step 2:** Chạy `node test/validate.mjs --build --only brainstorming-routing`; mong đợi đỏ ở dòng AC7.1.
- [ ] **Step 3:** Viết mục `## Đóng phiên con` theo quyết định (13): chỉ khi merge local xanh và dọn theo khoá xong, session gốc archive các phiên con nó đã mở cho request này (phiên part, phiên thực thi) nếu đã idle; còn chạy hoặc đang chờ người dùng thì giữ và nêu tên; `cleanup: true` thì không hỏi thêm, thiếu khoá thì gộp vào câu hỏi dọn của "Xoá và huỷ"; archive đảo ngược được, xoá phiên thì không làm. Nêu một câu nói công cụ quản lý phiên (liệt kê phiên liên kết, archive) tuỳ môi trường; môi trường không có thì bỏ qua và ghi một dòng. Thêm tham chiếu ở bước 4 của "Merge local theo khoá".
- [ ] **Step 4:** Chạy lại `--only brainstorming-routing` và `node test/validate.mjs --build --only workflow-self-sufficient --only request-parts` (hai pin có kiểm `finish.md`); mong đợi xanh.

### Task 7: Tách phần làm rõ chung khỏi `engineering-spec-writing`
**Kind:** DOCS
**Phủ AC:** AC1.2
**Files:**
- Modify: `plugins/engineering/skills/engineering-spec-writing/SKILL.md`
- Modify: `test/content/31-workflow-self-sufficient.pin.mjs`
- Test: `test/content/31-workflow-self-sufficient.pin.mjs`
- Test: `test/content/36-brainstorming-routing.pin.mjs`

**Interfaces:**
- Consumes: `core/skills/brainstorming/references/clarify-core.md` (Task 5)
- Produces: bước 2, 4, 5 của `engineering-spec-writing` thành một dòng trỏ tới skill `brainstorming` (bản cài plugin: `core:brainstorming`), mục `references/clarify-core.md`, giữ phần riêng của spec-writing (hỏi từng câu ở bước 3, "bỏ qua → bỏ bước 3–4", `quyết định của agent`)

- [ ] **Step 1:** Đọc các assert của pin 31 về `engineering-spec-writing` (cụm: `session chính`, `bỏ qua phần hỏi`, `quyết định của agent`, `2–3 hướng`, `lệch có chủ đích`, `sau playback`, bước 2/5/9) và liệt kê cụm nào chỉ còn nằm ở `clarify-core.md` sau khi tách.
- [ ] **Step 2:** Sửa `SKILL.md`: bước 2, 4, 5 giữ số bước và giữ phần riêng của spec-writing, phần chung chuyển thành pointer; chạy `node test/validate.mjs --build --only workflow-self-sufficient`; mong đợi đỏ ở các cụm vừa chuyển.
- [ ] **Step 3:** Sửa pin 31 để đọc cụm bắt buộc từ hợp `SKILL.md` + `clarify-core.md`; không xoá assert nào, không nới regex. Thêm dòng AC1.2 vào pin 36 kiểm `engineering-spec-writing` trỏ tới `clarify-core.md`.
- [ ] **Step 4:** Chạy `node test/validate.mjs --build`; mong đợi xanh toàn bộ.

### Task 8: Hai case eval định tuyến
**Kind:** TOOLING
**Phủ AC:** AC5.2
**Files:**
- Create: `evals/core/brainstorm-gather-questions/{prompt.md,case.yaml,graders/*.md}`
- Create: `evals/core/route-brief-decision/{prompt.md,case.yaml,scaffold.sh,graders/*.md}`
- Test: `test/contract/95-evals.contract.mjs`
- Test: `test/content/36-brainstorming-routing.pin.mjs`

**Interfaces:**
- Consumes: skill `brainstorming` và `route.mjs` (Task 1, Task 5)
- Produces: hai case hợp lệ cho `checkEvalCase` (`runs: 3`, `schema_version: "1.1"`); route kỳ vọng của `route-brief-decision` là `engineering-adr`

- [ ] **Step 1:** Thêm dòng AC5.2 vào pin 36 (đỏ trước): hai thư mục case tồn tại với `prompt.md`, `case.yaml` và ít nhất một grader; `route-brief-decision` có grader nhắc `engineering-adr`.
- [ ] **Step 2:** Chạy `node test/validate.mjs --build --only brainstorming-routing`; mong đợi đỏ ở dòng AC5.2.
- [ ] **Step 3:** Viết case `brainstorm-gather-questions` theo mẫu `evals/core/bootstrap-skill-first`: prompt nêu một vấn đề chưa rõ loại và không phải code; grader `tool_used` bắt `Skill` `brainstorming` trước mọi `Write`/`Edit`, grader `llm focus: trace` kiểm lượt đầu có dòng bỏ qua phần hỏi và một thẻ gom câu hỏi có đáp án khuyến nghị.
- [ ] **Step 4:** Viết case `route-brief-decision`: `scaffold.sh` tạo dự án mẫu gồm một `brief.md` loại `quyết-định`, phạm vi `không-code` và bản sao `workflows/orchestrator/WORKFLOW.md`; prompt yêu cầu chạy định tuyến; `allowed_tools` gồm `Bash(node *)` kèm tag `linux-only` theo luật của `checkEvalCase`; grader kiểm `engineering-adr` được chọn.
- [ ] **Step 5:** Chạy `node test/validate.mjs --build --only evals` và `--only brainstorming-routing`; mong đợi xanh. Không chạy `claude plugin eval` (tốn model); ghi vào báo cáo task rằng chỉ mới kiểm cấu trúc.

### Task 9: Bump version và lock
**Kind:** TOOLING
**Phủ AC:** AC5.2
**Files:**
- Modify: `core/.manifest.json`
- Modify: `workflows/.manifest.json`
- Modify: `plugins/engineering/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/contract/60-versions.contract.mjs`

**Interfaces:**
- Consumes: mọi thay đổi nội dung chiếu ra của Task 1–8
- Produces: `core` 1.25.0, `workflows` 3.14.0, `engineering` 2.10.4; lock khớp build

- [ ] **Step 1:** Chạy `node test/validate.mjs --build --only versions`; mong đợi đỏ vì nội dung đổi mà version chưa đổi (`red:`).
- [ ] **Step 2:** Sửa ba `.manifest.json` theo Interfaces (core và workflows tăng minor vì thêm năng lực; engineering tăng patch vì chỉ đổi cách trình bày một skill).
- [ ] **Step 3:** Chạy `npm run build` rồi `node cli/lib/versions.mjs --lock`; mong đợi lock cập nhật, không từ chối.
- [ ] **Step 4:** Chạy lại `node test/validate.mjs --build --only versions`; mong đợi xanh.

### Task 10: Lượt thử 6
**Kind:** DOCS
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC3.1, AC3.2, AC4.1, AC5.1, AC6.1
**Files:**
- Create: `docs/requests/2026-10-31-brainstorming-routing/trial-6.md`
- Test: `test/content/36-brainstorming-routing.pin.mjs`

**Interfaces:**
- Consumes: skill, `route.mjs`, orchestrator, bốn workflow đã build (Task 1–9)
- Produces: `trial-6.md` ghi từng vấn đề thử, brief sinh ra, kết quả `route.mjs`, route thực tế, và lỗ hổng tìm thấy

- [ ] **Step 1:** Chạy `npm run build`; với mỗi vấn đề thử (một feature, một quyết định quy trình không code, một nghiên cứu không code) giao một subagent `general-purpose` (`model: sonnet`) chạy skill `brainstorming` theo kịch bản trả lời đã viết sẵn (một vấn đề kịch bản "bỏ qua phần hỏi" để kiểm AC1.3, hai vấn đề trả lời gom); giữ brief sinh ra.
- [ ] **Step 2:** Với mỗi brief chạy `node core/skills/brainstorming/scripts/route.mjs <brief> workflows/orchestrator/WORKFLOW.md`; so với route kỳ vọng (`workflow-feature`; `engineering-adr`; không route thì "chưa có quy trình"). Chạy `route.mjs --log` một lần và xác nhận `.aip/routing-log.jsonl` thêm đúng một dòng (AC5.1).
- [ ] **Step 3:** Giả lập một route sai: brief loại `feature` giao nhầm cho `workflow-bugfix`; đọc Bước 1 của bugfix và ghi nó có đủ căn cứ để trả `misrouted` không và `--exclude workflow-bugfix` cho route kế nào (AC3.2). Đọc Bước 2 của `workflow-feature` với brief có sẵn (AC4.1).
- [ ] **Step 4:** Viết `trial-6.md` theo mẫu `trial-5.md` của request `aip-status` (nếu còn trong lịch sử git): bảng AC → bằng chứng, phần đã kiểm bằng máy và phần chỉ đọc câu chữ, ghi rõ giới hạn (subagent không thay được người dùng thật trả lời thẻ, nên chưa kiểm hội thoại thật và thẻ duyệt `[Unverified]`), danh sách lỗ hổng cần sửa. Thêm dòng AC6.1 vào pin 36 kiểm `trial-6.md` tồn tại và nhắc đủ ba vấn đề.
- [ ] **Step 5:** Chạy `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-31-brainstorming-routing/` và `node test/validate.mjs --build --only brainstorming-routing`; mong đợi xanh.
