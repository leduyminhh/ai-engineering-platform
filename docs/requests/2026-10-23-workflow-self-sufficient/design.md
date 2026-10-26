# Thiết kế: workflow aip tự đủ, thay superpowers
- Ngày: 2026-10-23
- Trạng thái: approved — chủ repo duyệt 2026-10-23, trần eval 20 USD
- Requirement: không có (AC nằm ở mục Tiêu chí chấp nhận bên dưới)

## Vấn đề và lý do

Chủ repo làm feature/bugfix bằng luồng superpowers (`brainstorming` → `writing-plans` → `subagent-driven-development`).
Workflow `workflow-feature` và `workflow-bugfix` của aip tự nhường chỗ khi superpowers đã cài
(`workflows/feature/WORKFLOW.md:34-37`, `workflows/bugfix/WORKFLOW.md:32-35`, `workflows/orchestrator/WORKFLOW.md:29-33,57`),
nên trên chính máy của chủ repo hai workflow này không bao giờ chạy. Có hai đường cho cùng một việc, và những điểm mạnh
riêng của aip (baseline đo trước, agent domain có `writeScope`, khoá phạm vi file bằng git, contract-first,
`agent_result`) không được dùng.

Chủ repo muốn chỉ dùng workflow aip. Cách làm: lấy điểm mạnh của superpowers đưa vào workflow, skill và agent của aip,
kiểm chứng bằng chạy thật trên một feature của repo này và bằng eval, rồi bỏ hẳn superpowers.

Bằng chứng so sánh hai bên (đọc toàn văn superpowers 7.0.0 và nội dung aip, có `file:line`) nằm ở
[research/compare-design-plan.md](research/compare-design-plan.md),
[research/compare-execution.md](research/compare-execution.md) và
[research/compare-bugfix.md](research/compare-bugfix.md); tóm tắt ở mục Thiết kế. Phát hiện gốc:

1. `workflow-feature` không có bước design và bước plan. Bỏ superpowers mà không bù thì mất hai khâu này.
2. `workflow-feature` chạy theo giai đoạn (implement hết → test hết → review hết, `WORKFLOW.md:94-159`); superpowers chạy
   theo task, mỗi task được review ngay. Chủ repo yêu cầu giữ review từng task.
3. aip không có ledger tiến độ; sau compact dễ mất dấu đang làm tới đâu.
4. `workflow-bugfix` đã mạnh hơn `systematic-debugging` ở 10 điểm; chỉ thiếu 5 kỹ thuật điều tra và giới hạn tổng số lần sửa.
5. Lần chấm điểm workflow trước đó (cùng phiên) tìm thêm: vòng lặp không giới hạn trong thân workflow (vd
   `workflows/feature/WORKFLOW.md:113` "lặp tới khi xanh"), `workflow-security-review` không có bước review code của bản
   sửa, `workflow-performance` không có bước đo baseline build/test.

## Quyết định đã chốt

Chủ repo đã nói trong phiên:
- Chỉ dùng workflow aip; superpowers chỉ là nguồn tham khảo, sau khi kiểm chứng xong thì không dùng nữa.
- Giữ vòng review từng task.
- Khâu làm rõ (brainstorming) phải chi tiết, làm rõ vấn đề và đưa ra đề xuất; bớt câu hỏi lặt vặt nhưng không giảm chất lượng.
- Phạm vi gồm cả tích hợp agent và nâng cấp skill, agent hiện có, không chỉ file workflow.
- Kiểm chứng bằng cả hai: chạy workflow mới trên một feature thật của repo này, và eval đo được.

Quyết định của agent (đề xuất trong phiên, chủ repo chưa phản đối; duyệt design này là duyệt các quyết định đó):
- D1. Khâu làm rõ chạy ở session chính (hội thoại, tóm tắt lại để xác nhận, đề xuất 2–3 hướng + 1 khuyến nghị, builder
  check). `engineering-spec-analyst` chỉ ghi tài liệu từ đầu vào đã chốt.
- D2. Ba cỡ việc: việc rõ và nhỏ → không chạy workflow; thay đổi nhỏ → `requirement.md` + checkpoint trong chat, không
  `plan.md`; dự án → `requirement.md` + `design.md` + `plan.md`, mỗi file một gate người duyệt.
- D3. Test trước code trong feature: task BE thì implementer viết test đỏ trước rồi code, trong cùng task, báo bằng
  chứng đỏ→xanh; task FE-UI thì implementer làm xong rồi `frontend-test-writer` viết test trong cùng task.
  `workflow-bugfix` giữ mô hình tách vai (test-writer đỏ trước, fixer làm xanh).
- D4. Commit: session chính commit sau mỗi task trên nhánh `feature/` qua `core:git-workflow`, không dừng; người dùng
  duyệt diff cả nhánh trước merge/push. Áp chung cho cả 4 workflow pipeline (đúng baseline `AGENTS.md` mục Safety).
  Nhánh protected vẫn dừng trước mỗi commit.
- D5. Vòng sửa theo finding review: tối đa 3 vòng mỗi task, vòng 3 dùng agent mới chạy opus. Hết vòng: ghi `Ruling:`
  vào ledger; finding chạm việc không đảo ngược được, bảo mật, schema DB hoặc tác động ngoài repo thì hỏi người dùng.
  Bộ đếm vòng sửa này là bộ đếm riêng của vòng task, đặt lại về 0 ở mỗi task, định nghĩa trong
  `workflow-output-contract.md`; nó không phải cạnh của `graph.json`. Bước "Vòng task" là một node trong graph; các
  cạnh lùi giữa các bước vẫn theo `max_attempts` (mặc định 2) như `workflows/R3`. Hai con số khác nhau vì đo hai thứ
  khác nhau: 3 = vòng sửa trong một task, 2 = số lần quay lại một bước trước đó của workflow.
- D6. Ledger ở `docs/requests/<ngày>-<slug>/.sdd/progress.md`. Script `ledger` tạo `.sdd/.gitignore` chứa `*` ở lần
  ghi đầu. Hook `session-start` nạp phần cuối ledger khi startup/clear/compact: chọn ledger có mtime mới nhất trong
  `docs/requests/*/.sdd/progress.md` chưa có dòng kết thúc, giới hạn riêng 2000 ký tự, nối sau phần `handoff.md` (không
  chiếm giới hạn của handoff); tắt được bằng khoá `ledgerInject: false` trong `aip-gate.json`.
- D7. Skill core mới chứa script Node zero-dep (`task-brief`, `review-package`, `ledger`) và mẫu prompt giao việc tiếng
  Việt (implementer, task-review, re-review, final-review). Đặt trong `core` để có trong gói npm.
- D8. Bỏ: visual companion, `find-polluter.sh`, mọi nhánh và tham chiếu `superpowers:*` trong nội dung aip.
- D9. Viết ADR đảo quyết định cũ "superpowers là quy trình chính" (`docs/requests/2026-10-22-parallel-agents/design.md`,
  mục Quyết định đã chốt).
- D10. Chia giai đoạn: P1 design + plan; P2 vòng task + review; P3 bugfix; P4 security-review + performance + giới hạn
  vòng lặp; P5 gỡ superpowers + baseline + ADR; P6 chạy thử + eval. Mỗi giai đoạn một plan, theo thứ tự.
- D11. Không chép nguyên văn từ superpowers (giấy phép MIT, © 2025 Jesse Vincent); chỉ tóm ý, viết lại bằng tiếng Việt.
  Token máy đọc trong ledger (`Task N: complete`, `Ruling:`) giữ tiếng Anh để grep được.
- D12. Một `plan.md` cho cả thay đổi, chia mục theo giai đoạn P1–P6; mỗi giai đoạn kết thúc bằng `npm test` xanh và
  commit, giai đoạn sau làm trên kết quả giai đoạn trước. P6 chỉ bắt đầu khi P1–P5 đã xong và người dùng duyệt diff nhánh.
- D13. `kind` của task thuộc tập đóng `BE`, `FE-UI`, `FE-INT`, `E2E`, `DB`, `CT`, `DOCS`, `TOOLING` (khớp lát dọc
  `CT→DB→BE→FE-UI→FE-INT→E2E` của `engineering-task-breakdown`, thêm `DOCS` và `TOOLING` cho task không thuộc phía nào).
  `kind` quyết định chuỗi agent: `BE` → `backend-implementer` (TDD) → `backend-reviewer`; `FE-UI` →
  `frontend-implementer` → `frontend-test-writer` → `frontend-reviewer`; `FE-INT` → `frontend-data-integrator` →
  `frontend-reviewer`; `E2E` → `frontend-e2e-test-writer` → `frontend-reviewer`; `DB` → `data-migration-writer` →
  `backend-reviewer`; `CT` → `backend-implementer` (skill `backend-api-contract`) → `backend-reviewer`; `DOCS`/`TOOLING`
  → session chính tự làm, review bằng `general-purpose`. `check-request.mjs` cảnh báo khi task trong `plan.md` thiếu
  `kind` hoặc `kind` ngoài tập.
- D14. Cỡ "thay đổi nhỏ": không có `plan.md`; một task duy nhất, brief là `requirement.md`, task id là `1`; ledger vẫn
  ghi để làm tiếp được. `check-request.mjs` không thêm yêu cầu cho trường hợp này.
- D15. Reviewer không có Write nên không tự ghi file: report của mọi agent trả trong tin nhắn (`agent_result`), session
  chính ghi file report khi cần. Review cuối nhánh và vòng sửa 3 chạy opus: P2 bắt đầu bằng một lần thử gọi agent plugin
  với tham số `model`. Nếu không được, dùng agent `general-purpose` với `model: opus` nạp skill `backend-code-review`/
  `frontend-code-review`, giữ chỉ-đọc bằng prompt; không thêm agent mới, không đổi ADR-0002.

## Tiêu chí chấp nhận

**R1 — Làm rõ ý định và thiết kế**
- [ ] **AC1.1** — Given yêu cầu feature mơ hồ, When chạy `workflow-feature`, Then session chính hỏi từng câu một, tóm tắt
  lại từng phần để người dùng sửa, và trước checkpoint design có ít nhất 2 hướng kèm 1 khuyến nghị và đánh đổi ghi trong `design.md`.
- [ ] **AC1.2** — Given người dùng nói bỏ qua phần hỏi, When workflow ở khâu làm rõ, Then workflow viết thẳng tài liệu
  với các lựa chọn của agent ghi là "quyết định của agent", không hỏi thêm câu nào trước checkpoint.
- [ ] **AC1.3** — Given đã có bản nháp `design.md`, When tới checkpoint design, Then đã có một lần builder check bằng
  subagent mới, và mọi câu hỏi còn lại của người dùng được gom vào đúng một tin nhắn.
- [ ] **AC1.4** — Given yêu cầu được xếp cỡ "thay đổi nhỏ", When chạy `workflow-feature`, Then không tạo `design.md`
  và `plan.md`, AC nằm trong `requirement.md`.
- [ ] **AC1.5** — Given `engineering-spec-analyst` được giao viết tài liệu, When nó chạy, Then nó không đặt câu hỏi khảo
  sát mới cho người dùng, chỉ ghi từ đầu vào đã chốt (hoặc trả `blocked` + `questions[]`).

**R2 — Lập plan**
- [ ] **AC2.1** — Given design đã duyệt, When lập plan, Then `plan.md` có bản đồ file, Global Constraints, Review Focus,
  và mỗi task có `kind`, `**Interfaces:**`, `**Files:**` (gồm `- Test:`), `**Phủ AC:**`.
- [ ] **AC2.2** — Given `plan.md` vừa viết, When trước checkpoint plan, Then đã tự soát nội dung (phủ AC, step mơ hồ,
  nhất quán tên/kiểu, Review Focus, độ dài) và `check-request.mjs` không còn cảnh báo ngoài W9.
- [ ] **AC2.3** — Given có `tasks.md` từ `engineering-task-breakdown`, When lập plan, Then task trong `plan.md` trỏ ID
  task của `tasks.md` thay vì chia lại, và chỉ có một checkpoint duyệt cho cả hai.

**R3 — Vòng task và review**
- [ ] **AC3.1** — Given plan đã duyệt, When thực thi, Then mỗi task đi đủ: ghi BASE → giao implementer domain theo
  `kind` → review task bởi `backend-reviewer`/`frontend-reviewer` trả cả `spec_verdict` lẫn finding → sửa → commit.
- [ ] **AC3.2** — Given task review có finding `blocker`/`major`, When vòng sửa chạy, Then re-review chỉ xét diff của
  vòng sửa, trả ADDRESSED / NOT ADDRESSED cho từng finding, và sau vòng 3 không còn vòng nào nữa.
- [ ] **AC3.3** — Given phiên bị compact giữa plan, When phiên tiếp tục, Then hook `session-start` nạp phần cuối
  ledger và workflow làm tiếp từ task chưa xong, không làm lại task đã `complete`.
- [ ] **AC3.4** — Given task BE, When implementer báo xong, Then `agent_result` có `tdd.red` và `tdd.green` (lệnh +
  exit code); thiếu thì supervisor coi là đầu ra hỏng.
- [ ] **AC3.5** — Given mọi task xong, When review cuối nhánh, Then reviewer chạy opus trên toàn nhánh, nhận Review Focus +
  các dòng `Ruling:` + finding minor đã hoãn, và `engineering-quality-auditor` chỉ chạy ở bước này.
- [ ] **AC3.6** — Given các script `task-brief`, `review-package`, `ledger` trong `scripts/` của skill core mới, When
  chạy trên Windows và Linux, Then chạy bằng Node không cần bash, có test.

**R4 — Kết thúc nhánh và commit**
- [ ] **AC4.1** — Given đang ở nhánh `feature/`, When một task xong, Then session chính commit qua `core:git-workflow`
  mà không dừng hỏi; agent không tự commit.
- [ ] **AC4.2** — Given review cuối sạch, When kết thúc, Then workflow cập nhật spec sống và chạy `check-request.mjs`,
  chạy full suite các component bị chạm, rồi đưa đúng 3 lựa chọn (merge local / push + PR / giữ nguyên, mặc định giữ
  nguyên) và không merge/push khi người dùng chưa chọn.
- [ ] **AC4.3** — Given workflow kết thúc, When trả `workflow_result`, Then có trường `rulings: []` liệt kê mọi
  `Ruling:` đã ghi trong ledger.

**R5 — Bugfix**
- [ ] **AC5.1** — Given đang thu evidence, When ở Bước 4 bugfix, Then có xem thay đổi gần đây của vùng nghi ngờ và so
  với một đoạn code tương tự đang chạy đúng (hoặc ghi lý do không có).
- [ ] **AC5.2** — Given log tạm được chèn để thu evidence, When sang Bước 5, Then diff so với mốc đầu Bước 4 sạch (log
  tạm đã gỡ).
- [ ] **AC5.3** — Given Bước 6 đã sửa thất bại tổng cộng 3 lần (qua bất kỳ cạnh nào), When cần thử lần nữa, Then
  workflow dừng `ask_user` với câu hỏi về kiến trúc.
- [ ] **AC5.4** — Given fixer báo test xanh, When qua gate Bước 6, Then session chính tự chạy lại lệnh oracle của Bước
  3 và ghi exit code.
- [ ] **AC5.5** — Given root cause đã xác nhận ở Bước 5, When có test đỏ từ Bước 3, Then lý do đỏ được đối chiếu với
  root cause; lệch thì quay về Bước 3.

**R6 — Security-review, performance, giới hạn vòng lặp**
- [ ] **AC6.1** — Given thân của bất kỳ `WORKFLOW.md` nào, When đọc trường Khi fail và bảng Xử lý lỗi, Then không còn
  vòng lặp không giới hạn ("lặp tới khi xanh", "sửa tiếp" không kèm số lần).
- [ ] **AC6.2** — Given bản sửa trong `workflow-security-review`, When tới Bước re-scan, Then có `backend-reviewer`/
  `frontend-reviewer` review correctness song song với auditor.
- [ ] **AC6.3** — Given chạy `workflow-performance`, When bắt đầu, Then có bước đo baseline build/test có số mốc trước khi tối ưu.

**R7 — Gỡ superpowers**
- [ ] **AC7.1** — Given nội dung nguồn (`workflows/`, `plugins/`, `core/`, `AGENTS.md`, `CLAUDE.md`, `templates/`),
  When grep `superpowers`, Then không còn tham chiếu nào ngoài ADR, CHANGELOG và `docs/requests/` cũ.
- [ ] **AC7.2** — Given baseline mới, When `aip init`/`aip install` ghi managed block, Then mục mặc định quy trình trỏ tới
  `workflow-feature`/`workflow-bugfix`, không nhắc skill ngoài bộ.
- [ ] **AC7.3** — Given thay đổi đã xong, When `npm test`, Then xanh; version các plugin bị chạm đã bump và
  `plugins/_versions.lock.json` khớp.

**R8 — Kiểm chứng**
- [ ] **AC8.1** — Given workflow mới đã cài, When làm trọn một feature thật của repo này từ yêu cầu tới review cuối,
  Then transcript không gọi skill `superpowers:*` nào và mọi checkpoint có evidence.
- [ ] **AC8.2** — Given `evals/workflows/` có 3 case mới (review từng task bắt lỗi spec, bugfix dừng sau 3 lần sửa,
  khâu làm rõ có đề xuất phương án), When chạy `scripts/eval-run.mjs --plugin workflows --runs 3 --max-cost-usd 20`,
  Then cả 3 case có điểm với plugin ≥ không plugin và ít nhất 2 case có Δ > 0; không đạt thì không bỏ superpowers mà
  quay lại chỉnh nội dung.

## Thiết kế

### Luồng `workflow-feature` mới

| Bước | Ai làm | Nội dung | Gate |
|---|---|---|---|
| 1 Baseline | session chính | như hiện tại | tự động |
| 2 Làm rõ + cỡ việc ⏸ | session chính | cổng "đã đủ thông tin"; lối thoát bỏ hỏi; hỏi từng câu, tóm tắt từng phần; đề xuất 2–3 hướng; xếp cỡ việc; tách nhiều request độc lập | người duyệt hướng + cỡ |
| 3 Tài liệu ⏸ | `engineering-spec-analyst` ghi; session chính chạy builder check | `requirement.md` (+ `design.md` nếu cỡ dự án); contract OpenAPI nếu có API; ADR nếu chạm kiến trúc | người duyệt tài liệu |
| 4 Plan ⏸ | session chính, skill plan mới | `plan.md`, tự soát, `check-request.mjs` | người duyệt plan (cỡ dự án) |
| 5 Vòng task | session chính điều phối agent domain | mỗi task: brief → implement (TDD theo `kind`) → task review → sửa ≤3 vòng → commit → ledger | tự động; dừng theo D5 |
| 6 Review cuối | reviewer opus + `engineering-quality-auditor` | toàn nhánh, một lần sửa + một re-review | 0 blocker |
| 7 Kết thúc nhánh ⏸ | session chính | docs + spec sống + `check-request.mjs` + full suite + menu 3 lựa chọn | người chọn |

Cỡ "thay đổi nhỏ" bỏ Bước 4 và chạy Bước 5 với một task duy nhất.

### Skill và agent

| Thành phần | Thay đổi |
|---|---|
| `engineering-spec-writing` (skill) | Thêm: cổng đủ thông tin, lối thoát, cách hỏi (8 nhóm thành vùng phủ ẩn, không đọc ra thành câu), playback, đề xuất phương án, builder check (`references/builder-check.md`), cỡ việc. Chạy ở session chính. |
| `engineering-spec-analyst` (agent) | Chỉ ghi tài liệu từ đầu vào đã chốt; bỏ vai khảo sát. |
| `engineering-plan-writing` (skill mới, plugin `engineering`) | Bản đồ file, độ mịn task/step, `kind`, Interfaces, Global Constraints, Review Focus, tự soát 5 mục, quan hệ với `tasks.md`. |
| `engineering-task-breakdown` | Quan hệ với `plan.md`, gộp checkpoint. |
| Skill core mới thực thi plan | Giao thức vòng task, ledger, breaker/`Ruling:`, review cuối, kết thúc nhánh; 3 script Node; 4 mẫu prompt. |
| `core:git-workflow` | Commit theo task do session chính; menu kết thúc nhánh; hỏi một lần trước khi tạo worktree (thay "không tạo trừ khi yêu cầu"). |
| `*-implementer` | Báo `tdd`; BE viết test đỏ trước. |
| `*-test-writer` | Chất lượng test: nêu thay đổi production nào làm test fail, expected là literal, không assert mock, chờ theo điều kiện. |
| `*-reviewer` + `*-code-review` | Chế độ `task-review` / `re-review` / `final-review`; trục spec (`spec_verdict`: Missing / Extra / Misunderstood); task-review không chạy lại suite. |
| `*-fixer` + `*-fix` | Một thay đổi mỗi lượt, revert bản sửa hỏng trước khi thử lại, báo số lần thử + giả thuyết. |
| `engineering-quality-auditor` | Chỉ chạy ở review cuối nhánh. |
| `workflow-output-contract.md` | Thêm `spec_verdict`, `tdd`, `report_file`, `commits`, `rulings`; vòng sửa + re-review có phạm vi + breaker; ánh xạ `remaining_risks≠∅` = xong kèm lo ngại, `blocked + questions` = session chính thử trả lời từ spec/plan trước. |
| `session-start.mjs` | Nạp đuôi ledger. |

### Workflow khác
- `workflow-bugfix`: thêm kiểm thay đổi gần đây, so với code tương tự, log tạm có mốc (Bước 4); giả thuyết + truy ngược
  tới nguồn + đối chiếu lý do đỏ (Bước 5); bộ đếm tổng 3 lần + revert + tự chạy lại oracle (Bước 6). Giữ 9 bước.
- `workflow-security-review`: thêm reviewer correctness ở Bước 9.
- `workflow-performance`: thêm bước baseline build/test.
- Mọi workflow: thay vòng lặp không giới hạn bằng "tối đa 2 lần rồi `ask_user`"; bỏ dòng Supervisor không áp dụng ở orchestrator; bỏ hoặc dùng thật cột `Nối tiếp` của orchestrator.

## Ảnh hưởng spec
- workflows: đổi R3, thêm R7, thêm R8, thêm R9, thêm R10
- artifact-templates: đổi R4, thêm R9
- baseline: đổi R2, đổi R3, thêm R8
- hooks-gates: thêm R11

Ghi chú: workflows R3 ghi rõ bộ đếm vòng sửa của vòng task là bộ đếm riêng, đặt lại mỗi task (D5); R7 vòng task + review từng task của `workflow-feature`; R8 ledger + làm tiếp; R9 giới hạn tổng số lần sửa của
bugfix; R10 không còn vòng lặp không giới hạn trong thân workflow; artifact-templates R9 trường bắt buộc mới của plan;
baseline R8 mặc định quy trình là workflow aip; hooks-gates R11 `session-start` nạp ledger.

## Ngoài phạm vi và anti-goal
- Ngoài phạm vi: visual companion (diagram dùng `engineering-diagram`); hỗ trợ chạy inline không subagent ngoài một
  chế độ dự phòng tối thiểu; đổi thang severity; đổi hệ tier model của ADR-0002; tính năng mới cho Cursor/Antigravity.
- Anti-goal (hỏng dù chạy được):
  - Làm mất bất kỳ điểm mạnh nào đã liệt kê của `workflow-bugfix` (tách vai, khoá phạm vi git, checkpoint root cause, baseline).
  - Workflow vẫn gọi hoặc phụ thuộc skill `superpowers:*` khi chạy.
  - Câu hỏi khảo sát quay lại kiểu checklist dài.
  - Model tự quyết thay người ở việc không đảo ngược được mà không ghi `Ruling:`.

## Ràng buộc
- Zero runtime dependency, Node 20+, chạy Windows và Linux (CI matrix).
- Quy ước skill/agent của `cli/lib/conventions.mjs` (H2 bắt buộc, description ≤ 500 ký tự, `Không dùng khi → id`).
- Mọi `graph.json` qua `checkGraph`/`checkGraphAgainstBody`; cạnh lùi có `max_attempts`.
- Version gate: bump `.manifest.json` của plugin bị chạm, `node cli/lib/versions.mjs --lock`.
- `AGENTS.md` trùng byte với `core/agents/AGENTS.template.md`.
- Nội dung tiếng Việt có dấu; không chép nguyên văn superpowers.
- Chủ repo vẫn dùng superpowers để phát triển P1–P5; chỉ P6 chạy bằng workflow mới.

## Kiểm thử
- Contract/pin (unit, `npm test`): cấu trúc workflow và graph mới (AC3.1, AC5.3, AC6.x), trường contract mới (AC3.4,
  AC4.3), không còn `superpowers` (AC7.1), managed block (AC7.2), skill/agent mới qua conventions.
- Test script Node: `task-brief`, `review-package`, `ledger` (AC3.6); `session-start` nạp ledger (AC3.3).
- `check-request.mjs` với trường plan mới (AC2.1).
- Eval (thủ công, tốn tiền): AC1.x, AC3.2, AC5.3, AC8.2.
- Chạy thật: AC8.1, đồng thời phủ AC1.1–AC4.2 ở mức hành vi.

## Để builder quyết
- Tên skill core mới và tên script.
- Bố cục `references/` của từng skill.
- Đánh số pin test mới.
- Feature thật dùng để chạy thử ở P6 (chọn từ follow-up đang mở, chủ repo duyệt).

## Rủi ro và câu hỏi mở
- [Unverified] Tiếp tục một subagent plugin bằng `SendMessage` và chỉ định `model` khi gọi agent plugin. Mặc định dùng
  agent mới nhận brief + report + finding cho vòng sửa; phương án khi không chỉ định được model ở D15.
- [Inference] Số 3 vòng sửa/task và bộ đếm tổng 3 lần ở bugfix chưa đo; điều chỉnh sau eval.
- [Inference] Vòng task tốn thêm một reviewer cho mỗi task; chi phí thật chỉ biết sau P6.
- [Inference] Model có làm đúng khâu làm rõ ở session chính khi hướng dẫn nằm trong skill thay vì trong superpowers hay
  không: đo bằng eval AC1.x.
- Đổi quy tắc commit (D4) làm 3 workflow kia bỏ "duyệt diff trước commit" trên nhánh feature; người dùng duyệt ở cuối nhánh.
