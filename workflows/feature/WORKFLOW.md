---
name: workflow-feature
description: "Điều phối làm feature/user story end-to-end: phân tích yêu cầu + acceptance criteria, contract nếu có API, implement backend/frontend, test theo từng criterion, review, docs, commit qua git-workflow. Dùng khi người dùng muốn \"làm feature\", \"thêm tính năng\", \"thêm endpoint\", \"implement user story\", \"làm chức năng mới end-to-end\". Không dùng khi chỉ sửa lỗi hành vi đã có → workflow-bugfix."
order: 1
title: "Feature — implement end-to-end từ yêu cầu tới commit"
kind: workflow
tier: 1
risk: medium
argument-hint: "[yêu cầu | đường dẫn requirement]"
agents: "engineering-spec-analyst,backend-implementer,frontend-implementer,frontend-data-integrator,backend-test-writer,frontend-test-writer,frontend-e2e-test-writer,backend-reviewer,frontend-reviewer,engineering-quality-auditor"
requires: "core/git-workflow,engineering/engineering-plan-writing"
runsIn: execute
invoke: per-request
---

# Feature — implement end-to-end từ yêu cầu tới commit

## Mục tiêu & đầu vào

- **Mục tiêu:** biến một yêu cầu/user story thành một feature hoàn chỉnh, có test theo từng acceptance
  criterion, đã qua review, đã cập nhật docs liên quan, sẵn sàng để người dùng duyệt diff và commit.
- **Đầu vào bắt buộc:** mô tả yêu cầu/user story (câu lệnh tự nhiên hoặc file `docs/requests/…`).
- **Đầu vào tuỳ chọn:** contract API có sẵn (`docs/contracts/…`), thiết kế UI có sẵn (Figma/HTML/ảnh),
  ADR liên quan.

## Điều kiện tiên quyết

- Skill/agent đã cài: skill `engineering-spec-writing`, `engineering-plan-writing`; agent `engineering-spec-analyst`, `backend-implementer`, `frontend-implementer`,
  `frontend-data-integrator`, `backend-test-writer`, `frontend-test-writer`, `frontend-e2e-test-writer`,
  `backend-reviewer`, `frontend-reviewer`, `engineering-quality-auditor`, skill `core/git-workflow`.
- Artifact phải có sẵn (đọc ở Bước 2): `project-knowledge/architecture.md` (backend và/hoặc frontend, tuỳ phạm vi);
  `design-system.md` nếu có phần frontend.
- Baseline: build/test hiện tại của project đang XANH trước khi bắt đầu implement — được đo và ghi số mốc ở Bước 1.
- Superpowers: đã cài superpowers (`superpowers:brainstorming` có trong danh sách skill khả dụng) thì không chạy
  workflow này, trừ khi người dùng chỉ định rõ — dùng `superpowers:brainstorming` → `writing-plans` →
  `subagent-driven-development`, docs ghi vào `docs/requests/<ngày>-<slug>/` theo baseline `AGENTS.md`.
  Workflow này chỉ chạy khi chưa cài superpowers hoặc khi được chỉ định rõ.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Baseline build/test

- **Thực hiện:** session chính
- **Đầu vào:** yêu cầu tính năng của người dùng
- **Hành động:** chạy build và test của vùng sẽ đụng theo lệnh của project; ghi số mốc (lệnh, exit code, số test
  pass/fail) làm baseline cho các bước sau.
- **Ràng buộc:** chỉ chạy build/test cục bộ; không chạy lệnh tác động môi trường; không sửa code để làm xanh.
- **Đầu ra:** baseline build/test (lệnh + exit code + số liệu).
- **Gate:** build/test xanh (exit code 0) và số mốc đã ghi.
- **Khi fail:** đỏ → dừng `blocked`, đề xuất `workflow-bugfix`; không implement trên baseline đỏ.
- **Evidence:** lệnh build/test + exit code + số liệu pass/fail.

### Bước 2 — Làm rõ & cỡ việc ⏸

- **Thực hiện:** session chính, theo skill `engineering-spec-writing` (không giao agent hỏi người dùng)
- **Đầu vào:** mô tả yêu cầu/user story của người dùng + baseline Bước 1
- **Hành động:** chạy quy trình làm rõ của skill: cổng "đủ thông tin" (đủ thì không hỏi), lối thoát cho người dùng
  bỏ qua phần hỏi, hỏi từng câu một và tóm tắt lại từng phần, đề xuất 2–3 hướng kèm 1 khuyến nghị và đánh đổi, xếp
  cỡ việc (việc rõ và nhỏ → không chạy workflow, làm thẳng; thay đổi nhỏ; dự án), tách các request độc lập.
  Xác định phạm vi ảnh hưởng thuộc `backend`, `frontend`, hay `fullstack`. Phạm vi cần đổi schema DB
  (bảng/cột/index/migration) → dừng, đề xuất chạy skill `data-db-migration` (chế độ `change`, plugin `data`)
  trước rồi quay lại feature. Với phạm vi có FE: đánh dấu AC nào là luồng UI đầu-cuối cần e2e, kèm lý do không
  chứng minh được ở tầng unit/integration (bảng luồng → AC → lý do). Ở checkpoint, hỏi người dùng có tách task
  không (gợi ý có khi phạm vi `fullstack` hoặc ≥ 2 use case); khi người dùng chọn tách task → đọc
  `references/task-breakdown.md`, mục Bước 2 (`tasks.md` được ghi ở Bước 3). Chưa duyệt checkpoint này → chưa sang
  Bước 3.
- **Ràng buộc:** hỏi từng câu một; không bịa yêu cầu khi thiếu thông tin — hỏi hoặc đánh dấu `[giả định]`; chưa ghi
  tài liệu ở bước này (Bước 3 ghi); người dùng bỏ qua phần hỏi → agent tự chọn hướng, ghi "quyết định của agent",
  không hỏi thêm; chỉ phân rã task khi người dùng chọn ở checkpoint.
- **Đầu ra:** tóm tắt trình duyệt trong chat: hướng đã chọn (kèm hướng bị loại), cỡ việc, phạm vi BE/FE/fullstack,
  bảng ứng viên e2e (nếu có), quyết định có tách task hay không.
- **Gate:** người dùng duyệt hướng và cỡ việc; phạm vi ∈ {backend, frontend, fullstack}; không đổi schema, hoặc
  migration đã viết và verify qua `data-db-migration`; có FE thì có bảng ứng viên e2e hoặc ghi "không có e2e"; cỡ
  "việc rõ và nhỏ" thì kết thúc workflow tại đây.
- **Khi fail:** thông tin còn mơ hồ/không đo được sau khi hỏi → hỏi lại người dùng, không tự suy diễn tiếp; phạm vi
  có đổi schema → dừng, đề xuất skill `data-db-migration`.
- **Evidence:** bản tóm tắt đã trình (hướng, cỡ việc, phạm vi, bảng e2e) + dòng xác nhận của người dùng, hoặc dòng
  "bỏ qua phần hỏi — quyết định của agent".

### Bước 3 — Tài liệu ⏸

- **Thực hiện:** agent `engineering-spec-analyst` ghi tài liệu → agent `backend-implementer` (skill
  `backend-api-contract`, chỉ khi phạm vi có API) chốt contract → session chính chạy builder check
- **Đầu vào:** hướng, cỡ việc, phạm vi và các quyết định đã chốt ở Bước 2 (session chính chuyển cho agent; agent không
  hỏi người dùng)
- **Hành động:** `engineering-spec-analyst` ghi `requirement.md` (acceptance criteria đo được, phạm vi, bảng ứng
  viên e2e) và `design.md` chỉ khi cỡ dự án (2–3 hướng, hướng bị loại); ảnh hưởng kiến trúc thì viết thêm ADR đề
  xuất; thiếu đầu vào thì trả `blocked` + `questions[]`, session chính thử trả lời từ đầu vào đã chốt trước khi hỏi
  người dùng. Người dùng đã chọn tách task ở Bước 2 → đọc `references/task-breakdown.md`, mục Bước 3. Có endpoint
  mới/đổi endpoint cũ: `backend-implementer` chốt/đồng bộ OpenAPI contract trong `docs/contracts/`. Sau cùng session
  chính chạy builder check (subagent mới đọc tài liệu như người sẽ làm; không có tool subagent thì tự đọc như
  builder): câu của người dùng gom một tin nhắn, câu nhỏ ghi "quyết định của agent"; người dùng đã bỏ qua phần hỏi
  thì không hỏi, nêu nổi bật các quyết định của agent ở checkpoint.
- **Ràng buộc:** agent chỉ ghi trong `docs/`; không code implementation; không đổi kiểu kiến trúc đã chốt; cỡ
  "thay đổi nhỏ" chỉ có `requirement.md`, không có `design.md`; không bịa yêu cầu, phần suy đoán đánh dấu `[giả
  định]`.
- **Đầu ra:** `docs/requests/<ngày>-<slug>/requirement.md` (+ `design.md` nếu cỡ dự án; + `tasks.md` nếu người
  dùng chọn tách task); contract OpenAPI cập nhật (hoặc ghi rõ "không có API"); ADR đề xuất nếu ảnh hưởng kiến trúc.
- **Gate:** acceptance criteria đo được; builder check xong và câu của người dùng đã được trả lời; contract OpenAPI
  hợp lệ hoặc ghi rõ "không có API"; có ảnh hưởng kiến trúc thì ADR đã viết; có `tasks.md` thì `check-tasks.mjs`
  báo 0 lỗi (không có Node → đạt `breakdown-checklist.md` kiểm thủ công) và Checkpoint 1 của
  `engineering-task-breakdown` đã duyệt; người dùng đã duyệt tài liệu.
- **Khi fail:** acceptance criteria không đo được hoặc agent `blocked` mà session chính không tự trả lời được →
  hỏi người dùng (gom một tin nhắn); contract xung đột với hệ thống hiện có → dừng, hỏi lại người dùng cách xử lý
  breaking change; tài liệu cho thấy hướng hoặc cỡ việc đã duyệt sai → quay lại Bước 2.
- **Evidence:** đường dẫn `requirement.md` (+ `design.md`) + trích đoạn acceptance criteria; kết quả builder check
  (số câu theo nhóm đã trả lời/nhỏ/của người dùng); đường dẫn contract (hoặc dòng "không có API") + đường dẫn ADR nếu
  có; có `tasks.md` thì đường dẫn + output `check-tasks.mjs` (dòng tổng + exit code) hoặc kết quả checklist thủ công.

### Bước 4 — Plan ⏸

- **Thực hiện:** session chính, theo skill `engineering-plan-writing`
- **Đầu vào:** `requirement.md` + `design.md` (+ `tasks.md` nếu có) + contract từ Bước 3 + baseline Bước 1
- **Hành động:** cỡ "thay đổi nhỏ" → bỏ qua bước này, ghi rõ "bỏ qua: cỡ thay đổi nhỏ, không có `plan.md`" và sang
  Bước 5 với một task duy nhất (brief là `requirement.md`, task id `1`). Cỡ dự án: viết `plan.md` theo skill (bản đồ
  file, Global Constraints, task có Kind/Interfaces/Phủ AC, Review Focus), tự soát 5 mục, rồi chạy
  `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/<ngày>-<slug>/`. Có `tasks.md` →
  task trong `plan.md` trỏ ID task của `tasks.md`, và Checkpoint 2 của `engineering-task-breakdown` được duyệt cùng
  `plan.md` (không hỏi hai lần).
- **Ràng buộc:** chỉ ghi `plan.md` trong thư mục request; không sinh mã nguồn; không sửa `requirement.md`/`design.md`
  ở bước này; không xoá `**Files:**` hay test để tắt cảnh báo.
- **Đầu ra:** `docs/requests/<ngày>-<slug>/plan.md`, hoặc dòng ghi rõ bỏ qua vì cỡ "thay đổi nhỏ".
- **Gate:** `check-request.mjs` không còn cảnh báo ngoài W9 (file test chưa tồn tại lúc lập plan); mọi acceptance
  criterion có task phủ; người dùng đã duyệt plan (cỡ dự án) — cỡ "thay đổi nhỏ" không có gate này.
- **Khi fail:** `check-request.mjs` còn cảnh báo ngoài W9 mà sửa `plan.md` không hết vì lỗi nằm ở tài liệu → quay
  lại Bước 3; plan còn điểm mơ hồ về phạm vi hay thứ tự → hỏi người dùng ở checkpoint.
- **Evidence:** đường dẫn `plan.md` + output `check-request.mjs` (số cảnh báo, chỉ còn W9 hoặc 0), hoặc dòng bỏ qua.

### Bước 5 — Implement

- **Thực hiện:** agent `backend-implementer` ∥ agent `frontend-implementer` (chỉ phía có đụng theo phạm vi
  Bước 2); phạm vi `fullstack` có contract ở Bước 3 → agent `frontend-data-integrator` chạy sau khi
  `frontend-implementer` xong
- **Đầu vào:** `requirement.md` + contract (nếu có) + `design.md`/`plan.md`/`tasks.md` (nếu có) từ Bước 3–4
- **Hành động:** sinh vertical slice backend (aggregate/use-case/port/adapter) bám kiến trúc đã chọn; và/hoặc
  sinh component frontend presentational bám kiến trúc UI + design-system (chỗ cần dữ liệu để trống bằng props +
  TODO); khi fullstack có contract ở Bước 3, `frontend-data-integrator` nối container/page với API theo contract
  (type sinh từ contract, data hook đúng tầng, đủ 4 trạng thái); chạy build của từng phía.
  Khi có `tasks.md` từ Bước 3 → đọc `references/task-breakdown.md`, mục Bước 5; không có `tasks.md` → giữ luồng
  trên.
- **Ràng buộc:** chỉ sửa file trong slice/feature được giao; không giả lập data ẩn; integrator không sửa
  `docs/contracts/` — lệch contract thì dừng, quay lại Bước 3; integrator: chưa có codegen/thư viện data → dừng,
  đề xuất, chờ người dùng chọn; không viết tay type trùng contract; không gọi `fetch`/`axios` trong component.
- **Đầu ra:** code implementation (backend và/hoặc frontend, gồm tầng data khi fullstack có contract ở Bước 3)
  build xanh.
- **Gate:** build xanh; khi fullstack có contract ở Bước 3: type khớp contract, `tsc`/lint/build xanh sau khi nối
  data.
- **Khi fail:** build lỗi → chẩn đoán → sửa → build lại; lặp tới khi xanh; contract lệch khi nối data → quay lại
  Bước 3; integrator trả `blocked` vì chưa có codegen/thư viện data → hỏi người dùng chọn, gọi lại.
- **Evidence:** lệnh build (`mvn compile`/`npm run build`/`tsc --noEmit` …) + exit code 0; report của integrator
  (endpoint ↔ hook ↔ container) khi fullstack có contract ở Bước 3.

### Bước 6 — Test

- **Thực hiện:** agent `backend-test-writer` ∥ agent `frontend-test-writer` (chỉ phía có đụng); AC dạng luồng
  UI đầu-cuối → thêm agent `frontend-e2e-test-writer`
- **Đầu vào:** code implementation từ Bước 5 + acceptance criteria từ Bước 2 + bảng ứng viên e2e đã được người
  dùng duyệt ở Bước 2 (đây là duyệt E2 của skill `frontend-e2e-testing`; agent không trình lại)
- **Hành động:** viết unit/integration test cho từng acceptance criterion; chạy toàn bộ test suite của phía
  tương ứng; với AC dạng luồng UI, `frontend-e2e-test-writer` viết e2e Playwright (3–5 luồng, mỗi test map 1 AC)
  và chạy `--repeat-each=3`.
- **Ràng buộc:** không sửa code production để "cho test xanh"; không viết test phụ thuộc thứ tự/thời gian
  thực/mạng thật; e2e chỉ chạy trên môi trường local/test — thiếu BE/DB test thì agent trả `not_run` + lý do,
  không tự dựng hạ tầng.
- **Đầu ra:** test mới + báo cáo test pass (e2e: pass hoặc `not_run` có lý do).
- **Gate:** mỗi acceptance criterion ≥1 test; test pass (e2e `not_run` vì thiếu môi trường là hợp lệ, ghi vào
  `remaining_risks`); so với trạng thái ghi lại ở đầu bước (`git status --porcelain`), các file thay đổi hoặc mới
  trong bước (`git diff --name-only` và `git ls-files --others --exclude-standard`) chỉ gồm file test (và
  fixture/mock của test; e2e: thư mục `e2e/`, `playwright.config.*`, dòng `.gitignore` cho thư mục auth/output
  của Playwright (vd `e2e/.auth/` và thư mục report/kết quả theo config); `package.json` + lockfile CHỈ khi
  người dùng đã duyệt (E-r7: thêm `@playwright/test`; thêm script chạy e2e cũng cần duyệt như E-r7)).
- **Khi fail:** test đỏ do lỗi code thật → quay lại Bước 5 sửa code (không xoá/nới test); test đỏ do lỗi viết
  test → sửa test; e2e flaky → sửa test, không nới assertion.
- **Evidence:** lệnh test + exit code 0 + số liệu (`X tests, X passed`); e2e: lệnh Playwright + kết quả hoặc
  `not_run` + lý do; danh sách file thay đổi hoặc mới trong bước so với trạng thái đầu bước.

### Bước 7 — Review

- **Thực hiện:** agent `backend-reviewer` ∥ agent `frontend-reviewer` ∥ agent `engineering-quality-auditor`
- **Đầu vào:** diff hoàn chỉnh từ Bước 5–6
- **Hành động:** review correctness/kiến trúc/a11y/test coverage theo phía tương ứng; chạy quality/security
  gate qua `engineering-quality-auditor`; validate lại từng finding (đọc `file:line`, loại finding không tái
  lập được). Phạm vi có API (Bước 3 có contract): `backend-reviewer` đối chiếu endpoint/DTO thực tế với contract
  (thiếu/thừa field, kiểu sai, endpoint lệch); `engineering-quality-auditor` kiểm authorization của endpoint mới/đổi
  (kiểm quyền theo vai trò/chủ sở hữu tài nguyên, không lộ dữ liệu người khác) và input validation (ràng buộc schema
  contract được thực thi ở server).
- **Ràng buộc:** chỉ đọc, không tự sửa code; mọi finding phải có `file:line` + evidence quan sát được.
- **Đầu ra:** danh sách finding theo severity (contract đầu ra, `core:principles`).
- **Gate:** 0 finding `blocker`; có API thì 0 drift contract↔code; finding `major` đã sửa, hoặc ghi vào
  `remaining_risks` để người dùng quyết ở checkpoint Bước 9.
- **Khi fail:** còn finding `blocker` → quay lại Bước 5/6 sửa, review lại phần đã sửa; drift contract↔code → quay lại
  Bước 5 sửa code hoặc quay lại Bước 3 sửa contract.
- **Evidence:** danh sách finding (severity/category/location/evidence/confidence) + số finding còn lại sau
  khi sửa; có API: bảng đối chiếu contract↔code.

### Bước 8 — Tài liệu

- **Thực hiện:** session chính
- **Đầu vào:** diff cuối cùng đã qua review ở Bước 7
- **Hành động:** rà README/API docs/ADR/`project-knowledge/` bị ảnh hưởng bởi feature; cập nhật nội dung
  tương ứng.
- **Ràng buộc:** không sửa vùng managed block của `AGENTS.md`/`CLAUDE.md`.
- **Đầu ra:** docs cập nhật, hoặc ghi rõ "không ảnh hưởng".
- **Gate:** docs bị ảnh hưởng đã cập nhật hoặc ghi "không ảnh hưởng".
- **Khi fail:** không xác định được docs nào bị ảnh hưởng → hỏi lại người dùng.
- **Evidence:** danh sách file docs đã sửa, hoặc dòng ghi "không ảnh hưởng".

### Bước 9 — Commit ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** diff hoàn chỉnh (code + test + docs) đã qua Bước 1–8
- **Hành động:** tóm tắt thay đổi, đề xuất commit message Conventional Commits (header EN, body VI); trình
  diff cho người dùng duyệt.
- **Ràng buộc:** không tự commit khi người dùng chưa duyệt diff; không push trừ khi được yêu cầu.
  Đây là chốt riêng của workflow, áp cả trên feature branch.
- **Đầu ra:** commit đã tạo (sau khi người dùng duyệt).
- **Gate:** người dùng duyệt diff.
- **Khi fail:** người dùng yêu cầu sửa thêm → quay lại bước người dùng chỉ định, không commit tạm.
- **Evidence:** hash commit + message.

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 2 | Hướng đã chọn (kèm hướng bị loại) + cỡ việc + phạm vi BE/FE/fullstack + bảng ứng viên e2e (nếu có) + quyết định tách task | Người dùng xác nhận hướng và cỡ việc (và bảng e2e, tính là duyệt E2); bỏ qua phần hỏi thì các quyết định của agent được nêu nổi bật |
| 3 | `requirement.md` (+ `design.md` cỡ dự án) + kết quả builder check; contract OpenAPI (nếu có) hoặc ghi chú "không có API"; ADR (nếu có) | Người dùng xác nhận tài liệu, contract/ADR, hoặc đồng ý không cần |
| 4 | `plan.md` + output `check-request.mjs` (cỡ dự án; cỡ "thay đổi nhỏ" bỏ qua bước này) | Người dùng duyệt plan; `check-request.mjs` không còn cảnh báo ngoài W9 |
| 9 | Diff đầy đủ (code + test + docs) + finding `major` còn lại trong `remaining_risks` | Người dùng duyệt diff và chấp nhận các `major` còn lại |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

Supervisor (session chính) kiểm `agent_result` của worker và giới hạn retry theo contract đầu ra (`core:principles`).

| Tình huống | Hành động |
|---|---|
| Baseline đỏ (Bước 1) | Dừng `blocked`, không tiếp tục trên baseline đỏ; đề xuất workflow-bugfix (bugfix: báo người dùng) |
| Build fail | Chẩn đoán → sửa → build lại |
| Test fail | Phân tích failure → sửa code (không xoá/nới test) → chạy lại |
| Yêu cầu mơ hồ (Bước 2–3) | Dừng, hỏi lại người dùng từng câu (builder check gom một tin nhắn) |
| Việc rõ và nhỏ (Bước 2) | Không chạy workflow; làm thẳng và báo người dùng |
| `check-request.mjs` còn cảnh báo ngoài W9 (Bước 4) | Sửa `plan.md`; lỗi ở tài liệu → quay lại Bước 3 |
| Finding `blocker` | Chặn hoàn thành cho tới khi sửa hoặc người dùng chấp nhận rủi ro |
| Phạm vi có đổi schema DB (Bước 2) | Dừng, đề xuất chạy skill `data-db-migration` trước rồi quay lại feature |

Khi gặp tình huống lỗi theo bước mà bảng trên chưa nêu → đọc `references/error-matrix.md` (trường Khi fail của bước vẫn là nguồn chính).

- **Điều kiện dừng:** acceptance criteria không đo được sau khi hỏi lại; finding `blocker` không sửa được
  trong phạm vi feature; người dùng không duyệt diff.
- **Rollback:** trước checkpoint commit, chưa có gì để rollback (chưa commit); nếu người dùng huỷ giữa
  chừng, xoá thay đổi chưa commit bằng thao tác git thủ công của người dùng (workflow không tự `reset --hard`).

## Definition of Done

- [ ] Baseline build/test đã đo, số mốc đã ghi — evidence: Bước 1
- [ ] Hướng, cỡ việc và phạm vi có xác nhận người dùng (hoặc quyết định của agent nêu rõ khi bỏ qua phần hỏi) — evidence: Bước 2
- [ ] Acceptance criteria đo được, builder check xong, người dùng duyệt tài liệu; contract OpenAPI hợp lệ hoặc ghi rõ
  không có API — evidence: Bước 3
- [ ] `plan.md` qua `check-request.mjs` (chỉ còn W9) và được duyệt, hoặc ghi rõ bỏ qua vì cỡ "thay đổi nhỏ" — evidence: Bước 4
- [ ] Build xanh cho phần backend/frontend có đụng — evidence: Bước 5
- [ ] Mỗi acceptance criterion có ≥1 test và toàn bộ test pass (e2e `not_run` vì thiếu môi trường BE/DB test là
  hợp lệ, ghi vào `remaining_risks`) — evidence: Bước 6
- [ ] Có API: 0 drift contract↔code, 0 `blocker` về authorization/input validation — evidence: Bước 7
- [ ] Docs bị ảnh hưởng đã cập nhật hoặc ghi "không ảnh hưởng" — evidence: Bước 8
- [ ] Người dùng đã duyệt diff và commit đã tạo — evidence: Bước 9
- [ ] Mọi gate có evidence `passed` (trừ e2e `not_run` có lý do trong `remaining_risks`)
- [ ] 0 finding `blocker`

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
workflow_result:
  workflow: workflow-feature
  status: completed        # completed | failed | blocked
  summary: "<1–3 câu>"
  changes: { added: [], modified: [], deleted: [] }
  validation:
    - command: "<lệnh>"
      exit_code: 0
      status: passed       # passed | failed | not_run
      summary: "<số liệu>"
      reason: ""
  findings: []             # severity, category, location, evidence, impact, recommendation, confidence
  remaining_risks: []
  docs_updated: []
  next_actions: []
```
