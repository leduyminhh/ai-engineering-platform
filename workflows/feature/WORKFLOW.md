---
name: workflow-feature
description: "Điều phối feature/user story end-to-end: làm rõ yêu cầu → tài liệu → plan → vòng task review từng task → review cuối → kết thúc nhánh. Dùng khi người dùng muốn \"làm feature\", \"thêm tính năng\", \"thêm endpoint\", \"implement user story\", \"làm chức năng mới end-to-end\". Không dùng khi chỉ sửa lỗi hành vi đã có → workflow-bugfix."
order: 1
title: "Feature — implement end-to-end từ yêu cầu tới commit"
kind: workflow
tier: 1
risk: medium
argument-hint: "[yêu cầu | đường dẫn requirement]"
agents: "engineering-spec-analyst,backend-implementer,frontend-implementer,frontend-data-integrator,frontend-test-writer,frontend-e2e-test-writer,backend-reviewer,frontend-reviewer,engineering-quality-auditor"
requires: "core/git-workflow,core/plan-execution,engineering/engineering-plan-writing"
runsIn: execute
invoke: per-request
---

# Feature — implement end-to-end từ yêu cầu tới commit

## Mục tiêu & đầu vào

- **Mục tiêu:** biến một yêu cầu/user story thành một feature hoàn chỉnh, có test theo từng acceptance
  criterion, mỗi task đã qua review và commit, nhánh đã qua review cuối và cập nhật docs/spec liên quan, sẵn sàng
  để người dùng duyệt diff cả nhánh và chọn cách tích hợp.
- **Đầu vào bắt buộc:** mô tả yêu cầu/user story (câu lệnh tự nhiên hoặc file `docs/requests/…`).
- **Đầu vào tuỳ chọn:** contract API có sẵn (`docs/contracts/…`), thiết kế UI có sẵn (Figma/HTML/ảnh),
  ADR liên quan.

## Điều kiện tiên quyết

- Skill/agent đã cài: skill `engineering-spec-writing`, `engineering-plan-writing`; agent `engineering-spec-analyst`, `backend-implementer`, `frontend-implementer`,
  `frontend-data-integrator`, `frontend-test-writer`, `frontend-e2e-test-writer`,
  `backend-reviewer`, `frontend-reviewer`, `engineering-quality-auditor`, skill `core/git-workflow`, `core/plan-execution`.
- Artifact phải có sẵn (đọc ở Bước 2): `project-knowledge/architecture.md` (backend và/hoặc frontend, tuỳ phạm vi);
  `design-system.md` nếu có phần frontend.
- Baseline: build/test hiện tại của project đang XANH trước khi bắt đầu implement — được đo và ghi số mốc ở Bước 1.

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
  Bước 5 không có plan (brief là `requirement.md`, số task và kind theo Bước 5). Cỡ dự án: viết `plan.md` theo skill (bản đồ
  file, Global Constraints, task có Kind/Interfaces/Phủ AC, Review Focus), tự soát 5 mục, rồi chạy
  `node <thư mục skill artifact-templates>/scripts/check-request.mjs docs/requests/<ngày>-<slug>/`. Có `tasks.md` →
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

### Bước 5 — Vòng task

- **Thực hiện:** session chính điều phối theo skill `plan-execution`; mỗi task giao agent domain theo `**Kind:**`:
  agent `backend-implementer`, agent `frontend-implementer` rồi agent `frontend-test-writer`, agent
  `frontend-data-integrator`, agent `frontend-e2e-test-writer`; review từng task bởi agent `backend-reviewer` hoặc
  agent `frontend-reviewer` (chỉ phía có đụng)
- **Đầu vào:** `plan.md` đã duyệt (cỡ "thay đổi nhỏ": không có `plan.md`, brief là `requirement.md`) + `requirement.md`
  (acceptance criteria từ Bước 3) + contract (nếu có) + `design.md`/`tasks.md` (nếu có) + baseline Bước 1 + bảng ứng
  viên e2e đã duyệt ở Bước 2 (đây là duyệt E2 của skill `frontend-e2e-testing`; agent không trình lại)
- **Hành động:** chạy `plan-execution` (mục "Quy trình" 1–2, giao thức trong `task-loop.md` của skill đó). Chuẩn bị ledger
  `docs/requests/<ngày>-<slug>/.sdd/progress.md` (đã có thì làm tiếp từ task chưa `complete`, không làm lại task đã
  xong). Mỗi task theo thứ tự: ghi BASE → cắt brief → giao agent theo `**Kind:**` (chuỗi agent do
  `engineering-plan-writing` định nghĩa): `BE` → `backend-implementer`
  (TDD `có` thì viết test đỏ trước rồi code và báo `tdd`);
  `FE-UI` → `frontend-implementer` rồi `frontend-test-writer` viết test trong cùng task; `FE-INT` →
  `frontend-data-integrator` (sau `FE-UI`; type sinh từ contract, data hook đúng tầng, đủ 4 trạng thái); `E2E` →
  `frontend-e2e-test-writer` cho AC luồng UI đầu-cuối trong bảng ứng viên e2e (3–5 luồng, mỗi test map 1 AC, chạy
  `--repeat-each=3`); `DOCS`/`TOOLING` → session chính tự làm. Plan không chứa task `CT`/`DB` (đã xử lý ở Bước 2–3: contract chốt ở
  Bước 3, đổi schema đã dừng ở Bước 2 sang `data-db-migration`). Session chính kiểm `agent_result`, tự chạy test hẹp, rồi commit theo task qua `git-workflow` không dừng (agent
  không commit). Task review: reviewer chế độ `task-review` trả `spec_verdict` + finding, không chạy lại suite. Finding
  `blocker`/`major` hoặc `spec_verdict` khác `compliant` vào vòng sửa, tối đa 3 vòng mỗi task (vòng 3 agent mới chạy
  opus; mỗi vòng một re-review có phạm vi); hết vòng còn finding thì session chính phán và ghi `Ruling:`, thuộc loại dừng
  của `plan-execution` thì hỏi người dùng. Task xong ghi `Task <n>: complete` vào ledger. Cỡ "thay đổi nhỏ": brief là
  `requirement.md`, kind lấy theo phạm vi đã chốt ở Bước 2 (backend → `BE`; frontend → `FE-UI`, thêm `FE-INT` khi nối
  API thật); phạm vi backend hoặc frontend chạy một task duy nhất, task id `1`; phạm vi fullstack chạy hai task, `1` là
  `BE` rồi `2` là phía FE. Có `tasks.md` từ Bước 3 → đọc `references/task-breakdown.md`, mục Bước 5.
- **Ràng buộc:** chỉ sửa file trong `**Files:**` của task; không giả lập data ẩn; không sửa code production để "cho test
  xanh", không xoá hay nới test, không viết test phụ thuộc thứ tự/thời gian thực/mạng thật; integrator không sửa
  `docs/contracts/` — lệch contract thì dừng, quay lại Bước 3; integrator chưa có codegen/thư viện data → dừng, đề
  xuất, chờ người dùng chọn; không viết tay type trùng contract; không gọi `fetch`/`axios` trong component; e2e chỉ chạy
  trên môi trường local/test — thiếu BE/DB test thì agent trả `not_run` + lý do, không tự dựng hạ tầng; không chạy full
  suite ở từng task; agent không commit, không push, không gọi agent khác.
- **Đầu ra:** code + test của từng task, mỗi task ≥ 1 commit trên nhánh `feature/`, ledger cập nhật.
- **Gate:** mọi task có dòng `Task <n>: complete` kèm evidence test (lệnh + exit code); mỗi acceptance criterion ≥ 1 test
  (e2e `not_run` vì thiếu môi trường là hợp lệ, ghi vào `remaining_risks`); task TDD `có` có `tdd.red` và `tdd.green`; không
  còn finding `blocker` mở mà chưa có `Ruling:`; build/`tsc`/lint của phía có đụng xanh; task `FE-INT`: type khớp contract; mọi file đổi của task nằm trong
  `**Files:**`; so với trạng thái ghi lại
  ở đầu bước test (`git status --porcelain` trước lượt của `frontend-test-writer` hoặc `frontend-e2e-test-writer`), các
  file thay đổi hoặc mới trong lượt đó (`git diff --name-only` và `git ls-files --others --exclude-standard`) chỉ gồm
  file test (và fixture/mock của test; e2e: thư mục `e2e/`, `playwright.config.*`, dòng `.gitignore` cho thư mục
  auth/output của Playwright (vd `e2e/.auth/` và thư mục report/kết quả theo config); `package.json` + lockfile CHỈ khi
  người dùng đã duyệt (E-r7: thêm `@playwright/test`; thêm script chạy e2e cũng cần duyệt như E-r7)).
- **Khi fail:** `agent_result` hỏng → giao lại cho chính agent đó, tối đa 2 lần rồi hỏi người dùng; build/test đỏ hoặc
  finding review → vòng sửa của task, tối đa 3 vòng rồi `Ruling:` (không xoá/nới test); agent trả `blocked` kèm
  `questions[]` → session chính thử trả lời từ spec/plan trước, chỉ hỏi người dùng khi thuộc loại dừng; contract lệch khi
  nối data → quay lại Bước 3; integrator trả `blocked` vì chưa có codegen/thư viện data → hỏi người dùng chọn, gọi lại;
  plan hỏng đến mức mọi hướng đều là đoán → hỏi người dùng.
- **Evidence:** ledger `.sdd/progress.md` (các dòng `Task <n>: complete` và `Ruling:`) + `git log` commit theo task; lệnh
  build (`mvn compile`/`npm run build`/`tsc --noEmit` …) + exit code 0; task `FE-INT`: bằng chứng type sinh từ contract;
  lệnh test + exit code + số liệu (`X tests, X passed`); task TDD `có`: `tdd.red`/`tdd.green`; e2e: lệnh Playwright + kết quả hoặc
  `not_run` + lý do; report của integrator (endpoint ↔ hook ↔ container) khi fullstack có contract; danh sách file thay
  đổi hoặc mới của lượt test so với trạng thái đầu bước.

### Bước 6 — Review cuối

- **Thực hiện:** agent `backend-reviewer` ∥ agent `frontend-reviewer` (chỉ phía có đụng; reviewer chạy `model: opus`) ∥ agent
  `engineering-quality-auditor` (model mặc định)
- **Đầu vào:** toàn nhánh `MERGE_BASE..HEAD` (gom bằng `plan-execution` `scripts/review-package.mjs --out`), Review Focus
  của `plan.md`, các dòng `Ruling:` và `minor (deferred)` trong ledger, contract (nếu có)
- **Hành động:** theo mẫu `final-review.md` của `plan-execution`: reviewer tìm lỗi mà review từng task không
  thấy (tích hợp giữa các task, interface lệch tên/kiểu, hồi quy, phần plan hứa mà không ai làm, từng mục Review Focus
  có test phủ thật không) và xét từng `Ruling:`; `engineering-quality-auditor` chạy quality/security gate (chỉ ở bước
  này, không chạy theo task); validate lại từng finding (đọc `file:line`, loại finding không tái lập được). Phạm vi có
  API (Bước 3 có contract): reviewer đối chiếu endpoint/DTO thực tế với contract (thiếu/thừa field, kiểu sai, endpoint
  lệch — drift contract↔code); auditor kiểm authorization của endpoint mới/đổi (kiểm quyền theo vai trò/chủ sở hữu tài
  nguyên, không lộ dữ liệu người khác) và input validation (ràng buộc schema contract được thực thi ở server). Sau đó
  đúng một lần sửa cho toàn bộ finding `blocker`/`major` (một dispatch, `model: opus`) và một re-review có phạm vi; không
  có làn sửa thứ hai.
- **Ràng buộc:** reviewer và auditor chỉ đọc, không tự sửa code; mọi finding phải có `file:line` + evidence quan sát
  được; không lặp lại vòng sửa — phần còn lại trình người dùng ở Bước 7.
- **Đầu ra:** danh sách finding theo severity (contract đầu ra, `core:principles`), `ruling_review[]`, kết quả re-review.
- **Gate:** 0 finding `blocker`; có API thì 0 drift contract↔code; finding `major` đã sửa, hoặc ghi vào
  `remaining_risks`/`Ruling:` để người dùng quyết ở Bước 7.
- **Khi fail:** còn finding `blocker` sau một lần sửa và một re-review → quay lại Bước 5 thêm task sửa, tối đa 2 lần rồi
  hỏi người dùng; drift mà lỗi nằm ở contract → quay lại Bước 3; `Ruling:` hay finding chạm loại dừng của
  `plan-execution` (không đảo ngược, bảo mật, tác động ngoài repo, schema DB) → hỏi người dùng.
- **Evidence:** danh sách finding (severity/category/location/evidence/confidence) + số finding còn lại sau lượt sửa;
  `ruling_review[]`; có API: bảng đối chiếu contract↔code.

### Bước 7 — Kết thúc nhánh ⏸

- **Thực hiện:** session chính, theo skill `plan-execution` (`finish.md` của skill đó) và skill `git-workflow`
- **Đầu vào:** nhánh đã qua review cuối + ledger + mục `## Ảnh hưởng spec` của `design.md`
- **Hành động:** theo `finish.md` (của `plan-execution`): cập nhật docs bị ảnh hưởng (README/API docs/ADR/`project-knowledge/`); cập nhật spec
  sống `docs/specs/<capability>/spec.md` theo `## Ảnh hưởng spec` (không ảnh hưởng thì ghi lý do); chạy
  `node <thư mục skill artifact-templates>/scripts/check-request.mjs docs/requests/<ngày>-<slug>/` (thêm `--base <nhánh
  gốc>` khi có spec sống); bump version/lock theo quy ước dự án nếu cần; chạy full suite của mọi component bị chạm và
  component phụ thuộc, một lần; gom mọi dòng `Ruling:` vào `rulings`; trình diff cả nhánh để người dùng duyệt và đưa
  đúng 3 lựa chọn: merge local / push + PR / giữ nguyên (mặc định); ghi `Plan: complete` vào ledger sau khi việc của lựa
  chọn xong.
- **Ràng buộc:** không sửa vùng managed block của `AGENTS.md`/`CLAUDE.md`; không merge, không push khi người dùng chưa
  chọn (không trả lời → giữ nguyên) và không push lên nhánh protected; không xoá nhánh, amend, squash hay force-push khi
  chưa được xác nhận; không đưa 3 lựa chọn khi full suite còn đỏ; không xoá `**Files:**` hay test để tắt cảnh báo của
  `check-request.mjs`.
- **Đầu ra:** docs và spec sống cập nhật (hoặc ghi "không ảnh hưởng"), output `check-request.mjs`, kết quả full suite,
  `rulings`, lựa chọn của người dùng cùng việc đã làm theo lựa chọn đó.
- **Gate:** docs/spec sống đã cập nhật hoặc ghi "không ảnh hưởng"; `check-request.mjs` không còn cảnh báo chưa xử lý;
  full suite xanh; người dùng đã duyệt diff cả nhánh và chọn một trong 3 lựa chọn.
- **Khi fail:** full suite đỏ → dừng, sửa trong phạm vi plan rồi chạy lại, tối đa 2 lần, vẫn đỏ → báo `blocked`; không xác định được docs
  nào bị ảnh hưởng → hỏi lại người dùng; người dùng yêu cầu sửa thêm sau khi xem diff → quay lại Bước 5, tối đa 2 lần
  rồi hỏi người dùng.
- **Evidence:** output `check-request.mjs` (số cảnh báo); lệnh full suite + exit code + số liệu; danh sách file docs và
  spec sống đã sửa, hoặc dòng "không ảnh hưởng"; dòng `Plan: complete` trong ledger; lựa chọn của người dùng + hash commit
  đầu/cuối (hoặc đường dẫn PR).

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 2 | Hướng đã chọn (kèm hướng bị loại) + cỡ việc + phạm vi BE/FE/fullstack + bảng ứng viên e2e (nếu có) + quyết định tách task | Người dùng xác nhận hướng và cỡ việc (và bảng e2e, tính là duyệt E2); bỏ qua phần hỏi thì các quyết định của agent được nêu nổi bật |
| 3 | `requirement.md` (+ `design.md` cỡ dự án) + kết quả builder check; contract OpenAPI (nếu có) hoặc ghi chú "không có API"; ADR (nếu có) | Người dùng xác nhận tài liệu, contract/ADR, hoặc đồng ý không cần |
| 4 | `plan.md` + output `check-request.mjs` (cỡ dự án; cỡ "thay đổi nhỏ" bỏ qua bước này) | Người dùng duyệt plan; `check-request.mjs` không còn cảnh báo ngoài W9 |
| 7 | Diff cả nhánh (code + test + docs) + `rulings` + finding `major` còn lại trong `remaining_risks` + kết quả full suite | Người dùng duyệt diff cả nhánh, chấp nhận các `Ruling:`/`major` còn lại và chọn một trong 3 lựa chọn |

Vòng task (Bước 5) và review cuối (Bước 6) chạy liên tục, không có checkpoint; chỉ dừng hỏi người dùng ở các loại dừng của
`plan-execution`. Session chính commit theo task trên nhánh `feature/` qua `core:git-workflow` không dừng; merge, push,
tag chỉ sau lựa chọn của người dùng ở Bước 7; agent không tự commit.

## Xử lý lỗi & rollback

Supervisor (session chính) kiểm `agent_result` của worker và giới hạn retry theo contract đầu ra (`core:principles`).

| Tình huống | Hành động |
|---|---|
| Baseline đỏ (Bước 1) | Dừng `blocked`, không tiếp tục trên baseline đỏ; đề xuất workflow-bugfix (bugfix: báo người dùng) |
| Build/test đỏ hoặc finding review trong một task (Bước 5) | Vòng sửa của task: tối đa 3 vòng, vòng 3 agent mới chạy opus, rồi `Ruling:`; không xoá/nới test |
| `agent_result` hỏng (Bước 5) | Giao lại cho chính agent đó, tối đa 2 lần rồi hỏi người dùng |
| Yêu cầu mơ hồ (Bước 2–3) | Dừng, hỏi lại người dùng từng câu (builder check gom một tin nhắn) |
| Việc rõ và nhỏ (Bước 2) | Không chạy workflow; làm thẳng và báo người dùng |
| `check-request.mjs` còn cảnh báo ngoài W9 (Bước 4) | Sửa `plan.md`; lỗi ở tài liệu → quay lại Bước 3, tối đa 2 lần rồi hỏi người dùng |
| Finding `blocker` sau review cuối (Bước 6) | Một lần sửa + một re-review; vẫn còn → quay lại Bước 5, tối đa 2 lần rồi hỏi người dùng |
| Full suite đỏ (Bước 7) | Dừng, không đưa 3 lựa chọn; sửa trong phạm vi plan rồi chạy lại, tối đa 2 lần, vẫn đỏ → báo `blocked` |
| Phạm vi có đổi schema DB (Bước 2) | Dừng, đề xuất chạy skill `data-db-migration` trước rồi quay lại feature |

Khi gặp tình huống lỗi theo bước mà bảng trên chưa nêu → đọc `references/error-matrix.md` (trường Khi fail của bước vẫn là nguồn chính).

- **Điều kiện dừng:** acceptance criteria không đo được sau khi hỏi lại; finding `blocker` không sửa được trong
  phạm vi feature; việc thuộc loại dừng của `plan-execution`; người dùng không duyệt diff cả nhánh.
- **Rollback:** các task đã commit trên nhánh `feature/`; người dùng huỷ giữa chừng thì bỏ commit hoặc nhánh bằng thao
  tác git thủ công của họ (workflow không tự `reset --hard`, không xoá nhánh, không amend hay squash khi chưa được xác
  nhận). Chưa chọn ở Bước 7 thì không có merge hay push nào để hoàn tác.

## Definition of Done

- [ ] Baseline build/test đã đo, số mốc đã ghi — evidence: Bước 1
- [ ] Hướng, cỡ việc và phạm vi có xác nhận người dùng (hoặc quyết định của agent nêu rõ khi bỏ qua phần hỏi) — evidence: Bước 2
- [ ] Acceptance criteria đo được, builder check xong, người dùng duyệt tài liệu; contract OpenAPI hợp lệ hoặc ghi rõ
  không có API — evidence: Bước 3
- [ ] `plan.md` qua `check-request.mjs` (chỉ còn W9) và được duyệt, hoặc ghi rõ bỏ qua vì cỡ "thay đổi nhỏ" — evidence: Bước 4
- [ ] Mọi task `complete` trong ledger, mỗi task đã qua task review và có commit; build xanh cho phần backend/frontend có
  đụng — evidence: Bước 5
- [ ] Mỗi acceptance criterion có ≥1 test và toàn bộ test pass (e2e `not_run` vì thiếu môi trường BE/DB test là
  hợp lệ, ghi vào `remaining_risks`) — evidence: Bước 5
- [ ] Review cuối toàn nhánh: 0 `blocker`; có API: 0 drift contract↔code, 0 `blocker` về authorization/input
  validation — evidence: Bước 6
- [ ] Docs và spec sống bị ảnh hưởng đã cập nhật hoặc ghi "không ảnh hưởng", `check-request.mjs` và full suite xanh;
  người dùng đã duyệt diff cả nhánh và chọn một trong 3 lựa chọn — evidence: Bước 7
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
  rulings: []              # mọi dòng `Ruling:` đã ghi trong ledger; rỗng nếu không có
```
