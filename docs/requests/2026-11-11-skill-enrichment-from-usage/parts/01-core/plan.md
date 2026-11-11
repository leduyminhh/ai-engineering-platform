# Part 01-core — Cỡ task, vai phiên, luật git Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Thêm cỡ task Nhỏ/Vừa/Lớn và review từng task theo D8 ([ADR-0005](../../../../decisions/0005-small-task-skips-per-task-review.md)), vai phiên gốc/phiên con ở `model-routing.md`, luật commit chỉ-xoá của `git-workflow`, đoạn worktree `isolation: worktree` của `git-worktree`.
**Architecture:** Markdown skill/reference/workflow của `core` và `workflows`; chi tiết dài chuyển sang `references/` của `plan-execution` theo luật ưu tiên của AC2.1, AC2.4.
**Tech Stack:** Markdown, pin Node `test/content/*.pin.mjs`.
**Spec:** ../../design.md
**Requirement:** không có

## Bản đồ file

| File | Trách nhiệm | Task |
|---|---|---|
| `core/skills/plan-execution/references/task-loop.md` | Mục "Cỡ task và review từng task" (≤ 25 dòng) hoặc tóm tắt + liên kết; dòng ledger cỡ nhỏ trong bảng Ledger | Task 1, Task 2 |
| `core/skills/plan-execution/references/task-size.md` | Chi tiết cỡ task nếu mục dài hơn 25 dòng; bước đối chiếu diff sau commit | Task 1, Task 2 |
| `core/skills/plan-execution/SKILL.md` | Dòng trỏ ở "Quy trình" bước 2; hàng "Task nhỏ, bỏ review cho nhanh" (≤ 300 dòng) | Task 1, Task 3 |
| `core/skills/plan-execution/references/prompts/final-review.md` | Nhắc reviewer cuối đọc kỹ diff task ghi `cỡ nhỏ` | Task 3 |
| `workflows/feature/WORKFLOW.md` | Bước 5 (và Bước 1 nếu còn câu "mọi cỡ việc" buộc review) trỏ mục cỡ task | Task 3 |
| `core/skills/plan-execution/references/model-routing.md` | Mục "Vai phiên gốc và phiên con" (≤ 20 dòng) hoặc tóm tắt + liên kết | Task 4 |
| `core/skills/plan-execution/references/session-roles.md` | Chi tiết vai phiên nếu mục dài hơn 20 dòng | Task 4 |
| `core/skills/git-workflow/SKILL.md` | Luật commit chỉ-xoá (≤ 300 dòng) | Task 5 |
| `core/skills/git-worktree/SKILL.md` | Đoạn worktree `isolation: worktree` dựng từ nhánh gốc xa | Task 5 |
| `test/content/48-enrich-core.pin.mjs` | Pin AC2.1–AC2.6 (cấu trúc và điều kiện, không ghim câu văn) | Task 1–Task 5 |
| `test/content/31-workflow-self-sufficient.pin.mjs` | Sửa pin nhắc "review từng task" theo hành vi mới | Task 3 |
| `test/content/20-model-session-routing.pin.mjs` | Sửa pin nếu đỏ do mục mới | Task 4 |
| `test/content/21-long-session-context.pin.mjs` | Sửa pin nếu đỏ do mục mới | Task 4 |

Part không ghi `.manifest.json`, `plugins/_versions.lock.json`, `test/routing/*`, `CHANGELOG.md`, `README*.md`, `docs/specs/*`, `AGENTS.md`, `build/`: session gốc làm (plan gốc, mục "Bước file dùng chung").

## Global Constraints

- Nội dung skill tiếng Việt có dấu, theo `engineering-writing-style`; nhãn `[Verified]`/`[Inference]`/`[Unverified]` ở chỗ nêu sự thật chưa kiểm.
- Trung lập project (D5): không tên thành phần, bảng hay số phiên bản của project nguồn. Biểu thức cấm: `cap-(core|web|ui|storage|contracts)|capcore|capstorage|content-automation|khe kho|\bV1[0-9]{2}\b|worker-(intelligence|media|content|metadata|acquisition|publishing)|tts-local|searxng|story-series|niche`.
- Điều kiện cỡ Nhỏ (D8), phải đủ cả bốn: (1) `Kind` ∈ {`FE-UI`, `TOOLING`}; (2) `**TDD:** không`; (3) ≤ 5 file production; (4) `**Files:**` không có đường dẫn migration, auth/phân quyền, secret/credential, CI hoặc hook, và không đổi contract API hay schema. Cỡ Lớn = mọi task còn lại (`BE`, `DB`, `CT`, `FE-INT`, `E2E`, `DOCS`, `**TDD:** có`, hoặc chạm đường dẫn nhạy cảm): vòng đầy đủ. Cỡ Vừa = gộp theo mục "Gom task nhỏ" đã có.
- Phạm vi áp dụng: mọi chế độ còn review từng task (tuần tự không part; part với `partRunner: session`). Chế độ inline và part `partRunner: subagent` không đổi.
- Dòng D9 (ghi khi task cỡ Nhỏ vừa commit, diff khớp `**Files:**`): `Task <n>: complete (commits <a>..<b>, review cuối — cỡ nhỏ)`. Dòng không được bắt đầu bằng `Task <n>: review`, vì `EVENT_FORMATS` của `ledger.mjs` từ chối.
- Ngưỡng ~40%/~60% giữ nhãn `[Inference]` như ADR-0003; không đổi bảng tầng hay 18 quy tắc có sẵn của `model-routing.md`.
- `SKILL.md` bị sửa ≤ 300 dòng (hiện `plan-execution` 112, `git-workflow` 160, `git-worktree` 81); không thêm hàng bảng tự biện minh trừ khi cần (bảng giữ 4–6 dòng, pin 47).
- Không đổi: Minor ngoài vòng sửa (`task-loop.md` mục Nhận review), full suite một lần, `ledger.mjs` và các dạng dòng của nó, `inline.md`, `check-request.mjs`, `AGENTS.md`, `core/agents/AGENTS.template.md`.
- Pin sửa theo hành vi mới kèm `Ruling:` nêu phép kiểm thay thế; không xoá phép kiểm hành vi còn đúng.
- Commit theo `git-workflow`: header Conventional Commits tiếng Anh, thân tiếng Việt có dấu, không `Co-authored-by`.

## Review Focus

- Điều kiện cỡ Nhỏ đủ cả bốn và `DOCS`, `BE`, `DB`, `CT`, `FE-INT`, `E2E`, `TDD có` luôn review: Task 1 (pin 48 kiểm đủ bốn điều kiện và tập kind cỡ Lớn).
- Dòng D9 không bị `ledger.mjs` từ chối (không mở đầu bằng `Task <n>: review`): Task 2 (pin 48 chạy `core/skills/plan-execution/scripts/ledger.mjs` thật, exit 0).
- Đối chiếu diff làm task cỡ Nhỏ nâng lên Lớn khi file ngoài `**Files:**` hoặc đường dẫn nhạy cảm: Task 2 (pin 48 kiểm mục có cả hai nhánh).
- `graph.json` của `workflow-feature` vẫn qua `checkGraphAgainstBody` sau khi sửa Bước 5: Task 3 (`--only 50-workflows`).
- Pin 20, 21, 31 đỏ vì hành vi mới nhưng phép kiểm hành vi còn đúng vẫn giữ: Task 3, Task 4 (`Ruling:` nêu phép kiểm thay thế).

### Task 1: Mục cỡ task và review từng task
**Kind:** DOCS
**TDD:** không — task tài liệu; pin 48 viết trước và kiểm cấu trúc mục
**Phủ AC:** AC2.1
**Ước lượng:** 25'
**Files:**
- Modify: `core/skills/plan-execution/references/task-loop.md`
- Create: `core/skills/plan-execution/references/task-size.md`
- Modify: `core/skills/plan-execution/SKILL.md`
- Create: `test/content/48-enrich-core.pin.mjs`
- Test: `test/content/48-enrich-core.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: mục `## Cỡ task và review từng task` ở `task-loop.md` (đặt trước "Gom task nhỏ")

- [ ] **Step 1:** Tạo pin 48 với case AC2.1: `task-loop.md` có mục tiêu đề "Cỡ task và review từng task"; mục nêu đủ bốn điều kiện cỡ Nhỏ, nêu `BE`, `DB`, `CT`, `FE-INT`, `E2E`, `DOCS` và `**TDD:** có` luôn review, trỏ mục "Gom task nhỏ"; mục ≤ 25 dòng (dài hơn thì nội dung chi tiết nằm ở `references/task-size.md` và mục chỉ giữ tóm tắt cùng liên kết); `SKILL.md` ≤ 300 dòng. Chạy `npm run build` rồi `node test/validate.mjs --build --only 48-enrich-core`. Kết quả mong đợi: đỏ.
- [ ] **Step 2:** Viết mục trong `task-loop.md` (đặt trước "Gom task nhỏ"); nếu quá 25 dòng, chuyển chi tiết sang `references/task-size.md` mới. Thêm một dòng ở `plan-execution/SKILL.md` "Quy trình" bước 2 trỏ mục mới.
- [ ] **Step 3:** Lập bảng khẳng định → file:line → khớp|lệch cho mọi số dòng, tên mục và đường dẫn vừa viết (grep trong repo), sửa chỗ lệch hoặc gắn `[Unverified]`; ghi bảng vào báo cáo.
- [ ] **Step 4:** Chạy lại lệnh bước 1 (xanh) và `node test/validate.mjs --build --only 31-workflow-self-sufficient --only 32-superpowers-gap --only 33-request-parts` (không đỏ mới do task này). Commit (`docs(plan-execution): add task size section`).

### Task 2: Đối chiếu diff sau commit và dòng ledger cỡ nhỏ
**Kind:** DOCS
**TDD:** không — task tài liệu; pin 48 chạy `ledger.mjs` thật
**Phủ AC:** AC2.2
**Ước lượng:** 20'
**Files:**
- Modify: `core/skills/plan-execution/references/task-loop.md`
- Modify: `core/skills/plan-execution/references/task-size.md`
- Test: `test/content/48-enrich-core.pin.mjs`

**Interfaces:**
- Consumes: mục `## Cỡ task và review từng task`
- Produces: bước đối chiếu `git diff --name-only <BASE>..HEAD` với `**Files:**` và dòng D9 trong bảng Ledger

- [ ] **Step 1:** Thêm case AC2.2 vào pin 48: tài liệu có bước đối chiếu diff sau commit với hai nhánh (lệch hoặc đường dẫn nhạy cảm → nâng lên Lớn, giao review thường; không lệch → ghi dòng D9), nêu phạm vi chế độ (tuần tự không part, part `partRunner: session`; inline và `subagent` không đổi); và dòng D9 trích từ tài liệu qua `core/skills/plan-execution/scripts/ledger.mjs` trên thư mục tạm cho exit 0. Chạy `node test/validate.mjs --build --only 48-enrich-core`. Kết quả mong đợi: đỏ.
- [ ] **Step 2:** Viết bước đối chiếu vào mục cỡ task (hoặc `task-size.md`) và thêm dòng D9 vào bảng "Ledger" của `task-loop.md` (đúng định dạng ở Global Constraints, không đụng `ledger.mjs`).
- [ ] **Step 3:** Lập bảng khẳng định → file:line → khớp|lệch cho lệnh git, tên file, dạng dòng ledger; sửa chỗ lệch.
- [ ] **Step 4:** Chạy lại lệnh bước 1. Kết quả mong đợi: xanh. Commit (`docs(plan-execution): add small task diff check and ledger line`).

### Task 3: Bảng tự biện minh, final-review và Bước 5 của workflow-feature
**Kind:** DOCS
**TDD:** không — task tài liệu; pin 48 và contract workflow
**Phủ AC:** AC2.3
**Ước lượng:** 25'
**Files:**
- Modify: `core/skills/plan-execution/SKILL.md`
- Modify: `core/skills/plan-execution/references/prompts/final-review.md`
- Modify: `workflows/feature/WORKFLOW.md`
- Test: `test/content/48-enrich-core.pin.mjs`

**Interfaces:**
- Consumes: mục `## Cỡ task và review từng task`
- Produces: không có

- [ ] **Step 1:** Thêm case AC2.3 vào pin 48: hàng "Task nhỏ, bỏ review cho nhanh" của bảng tự biện minh trỏ về mục cỡ task (không còn phủ định chung "Mỗi task có review"); `final-review.md` bảo reviewer đọc kỹ diff của task ghi `cỡ nhỏ`; Bước 5 của `WORKFLOW.md` không còn buộc review từng task cho cỡ Nhỏ và trỏ mục mới; bảng tự biện minh vẫn 4–6 dòng. Chạy `node test/validate.mjs --build --only 48-enrich-core`. Kết quả mong đợi: đỏ.
- [ ] **Step 2:** Sửa hàng bảng ở `SKILL.md`, thêm dòng nhắc ở `final-review.md`, sửa Bước 5 (và Bước 1 nếu còn câu "mọi cỡ việc" buộc review) ở `WORKFLOW.md`; không đổi `graph.json`.
- [ ] **Step 3:** Chạy `npm run build` rồi `node test/validate.mjs --build --only 48-enrich-core --only 31-workflow-self-sufficient --only 50-workflows --only 47-rationalization-tables`. Pin 31 đỏ vì nhắc "review từng task" thì sửa `test/content/31-workflow-self-sufficient.pin.mjs` theo hành vi mới (ngoại lệ có điều kiện, nên không nằm ở **Files:** để tránh coi là test đã có; vẫn nêu ở Bản đồ file), ghi `Ruling:` nêu phép kiểm thay thế (pin 48). Kết quả mong đợi: xanh, `graph.json` qua `checkGraphAgainstBody`.
- [ ] **Step 4:** Lập bảng khẳng định → file:line → khớp|lệch cho các câu trỏ mục và tên bước; sửa chỗ lệch. Commit (`docs(plan-execution): route small tasks past per-task review`).

### Task 4: Vai phiên gốc và phiên con
**Kind:** DOCS
**TDD:** không — task tài liệu; pin 48 kiểm đủ bốn ý
**Phủ AC:** AC2.4
**Ước lượng:** 25'
**Files:**
- Modify: `core/skills/plan-execution/references/model-routing.md`
- Create: `core/skills/plan-execution/references/session-roles.md`
- Test: `test/content/48-enrich-core.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: mục `## Vai phiên gốc và phiên con` ở `model-routing.md`

- [ ] **Step 1:** Thêm case AC2.4 vào pin 48: mục "Vai phiên gốc và phiên con" nêu (a) giao việc kế, không chồng file, cho phiên con vừa xong hoặc rảnh; (b) xoay mềm ở ranh giới task, cứng ngay, mở phiên mới trước rồi dừng phiên cũ, không dừng phiên con giữa plan vì hạn mức; (c) không mở được phiên (Remote Control, lượt do tin cross-session khởi động) thì để phiên cũ chạy tiếp; (d) phiên con xong và merge thì đóng, không xoay; ngưỡng ~40%/~60% kèm `[Inference]`; mục ≤ 20 dòng (dài hơn thì chi tiết ở `references/session-roles.md`, mục chỉ tóm tắt và liên kết); bảng tầng và 18 quy tắc có sẵn không đổi. Chạy `node test/validate.mjs --build --only 48-enrich-core`. Kết quả mong đợi: đỏ.
- [ ] **Step 2:** Viết mục ở `model-routing.md` (chi tiết sang `session-roles.md` nếu cần); không sửa baseline `AGENTS.md`.
- [ ] **Step 3:** Chạy `npm run build` rồi `node test/validate.mjs --build --only 48-enrich-core --only 20-model-session-routing --only 21-long-session-context --only 33-request-parts --only 30-templates`. Pin 20 hoặc 21 đỏ thì sửa `test/content/20-model-session-routing.pin.mjs` hoặc `test/content/21-long-session-context.pin.mjs` theo hành vi mới kèm `Ruling:` (ngoại lệ có điều kiện, nêu ở Bản đồ file, không nằm ở **Files:**). Kết quả mong đợi: xanh; số quy tắc đánh số và bảng tầng của `model-routing.md` không đổi.
- [ ] **Step 4:** Lập bảng khẳng định → file:line → khớp|lệch cho ngưỡng 40%/60%, số quy tắc, tên ADR; sửa chỗ lệch. Commit (`docs(plan-execution): add root and child session roles`).

### Task 5: Luật commit chỉ-xoá và worktree isolation
**Kind:** DOCS
**TDD:** không — task tài liệu hai file cùng khuôn (gom theo luật "Gom task nhỏ"); pin 48
**Phủ AC:** AC2.5, AC2.6
**Ước lượng:** 20'
**Files:**
- Modify: `core/skills/git-workflow/SKILL.md`
- Modify: `core/skills/git-worktree/SKILL.md`
- Test: `test/content/48-enrich-core.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Thêm case AC2.5 và AC2.6 vào pin 48. AC2.5: `git-workflow/SKILL.md` có luật xoá file đã tracked → một commit chỉ gồm các file bị xoá (body liệt kê file và lý do), sửa tham chiếu là commit riêng sau đó, build có thể đỏ giữa hai commit, không gộp, không viết lại lịch sử; thân ≤ 300 dòng. AC2.6: `git-worktree/SKILL.md` có đoạn worktree do `isolation: worktree` tự tạo dựng từ `origin/<nhánh gốc>`, kiểm `git merge-base --is-ancestor <hash đỉnh feature> HEAD` (không đạt trả `blocked`), session chính cherry-pick commit nhánh `worktree-agent-*` về `feature/<slug>`, không `reset --hard`. Chạy `node test/validate.mjs --build --only 48-enrich-core`. Kết quả mong đợi: đỏ.
- [ ] **Step 2:** Viết luật ở `git-workflow/SKILL.md` và đoạn ở `git-worktree/SKILL.md` (không thêm gì về giữ ledger khi xoá worktree, đã có ở bước dọn 2).
- [ ] **Step 3:** Chạy `npm run build` rồi `node test/validate.mjs --build --only 48-enrich-core --only 25-parallel-agents-docs --only 32-superpowers-gap --only 47-rationalization-tables --only 30-templates`. Kết quả mong đợi: xanh (bảng tự biện minh của `git-workflow` giữ 4–6 dòng).
- [ ] **Step 4:** Lập bảng khẳng định → file:line → khớp|lệch cho lệnh git và tên nhánh; sửa chỗ lệch. Commit (`docs(git): add delete-only commit rule and worktree base check`).
