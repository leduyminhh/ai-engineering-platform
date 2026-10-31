# autonomy-gates Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Luồng chỉ dừng ở G1/G2/G3 (+ push cuối nhánh, + 6 loại dừng); khoá `autonomy` trong `aip-gate.json` bật merge local, dọn nhánh và chạy part bằng subagent.
**Architecture:** Script đọc khoá (`autonomy.mjs`, zero-dep) cho skill; lệnh `aip autonomy` theo mẫu `aip mode`; câu chữ `workflow-feature` + `plan-execution`; lượt thử 4 trên `aip-parts-trial`.
**Tech Stack:** Node 20+, ESM, zero-dependency.
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/skills/plan-execution/scripts/autonomy.mjs` | đọc + chuẩn hoá khoá `autonomy`, in JSON | Task 1 |
| `test/content/34-autonomy-gates.pin.mjs` | test `autonomy.mjs` | Task 1 |
| `cli/lib/autonomy.mjs` | `runAutonomy(sub, {root,…})`: high / safe / status | Task 2 |
| `cli/index.mjs` | định tuyến lệnh `autonomy` + help | Task 2 |
| `test/mode.test.mjs` | test `runAutonomy` cạnh test `aip mode` | Task 2 |
| `workflows/feature/WORKFLOW.md` | Bước 2 gom câu hỏi, Checkpoint G1/G2/G3, push cuối nhánh | Task 3 |
| `core/skills/plan-execution/SKILL.md` | danh sách điểm dừng, quy tắc báo cáo | Task 3 |
| `core/skills/plan-execution/references/task-loop.md` | "Chế độ part" theo `partRunner`, không báo trạng thái | Task 3 |
| `core/skills/plan-execution/references/finish.md` | G3 + `mergeLocal` + `cleanup`, push hỏi riêng | Task 3 |
| `core/skills/plan-execution/references/inline.md` | subagent part tự commit trên nhánh part | Task 3 |
| `docs/requests/2026-10-31-autonomy-gates/trial-4.md` | kết quả lượt thử 4 | Task 4 |

## Global Constraints
- Thiếu khoá `autonomy` → mặc định an toàn `{ mergeLocal: false, cleanup: false, partRunner: "session" }`, luồng hỏi như hiện nay.
- Không khoá nào bật push; push chỉ hỏi ở cuối nhánh hoặc khi người dùng yêu cầu.
- `autonomy.mjs` đọc gate cùng thứ tự với hook (gốc worktree rồi gốc repo chính); dùng `resolveGate` của `core/hooks/scripts/gate-config.mjs` chỉ ở phía CLI, script skill tự đọc để cài độc lập (như `workspace.mjs`).
- Bump `core`, `workflows`; `node cli/lib/versions.mjs --lock`; spec sống `workflows/R7`, `R14`, `hooks-gates/R15`, `cli-wizard/R6` ở bước kết thúc nhánh.

## Review Focus
- `autonomy.mjs`: giá trị sai kiểu/ngoài tập từng trường rơi về mặc định riêng trường đó, không làm hỏng trường khác; JSON hỏng → mặc định cả ba.
- `aip autonomy high/safe` giữ nguyên mọi khoá khác của `aip-gate.json` (`mode`, `allowEnvFiles`, …).
- Câu chữ không mâu thuẫn: `partRunner: "session"` vẫn hỏi bước 3; `"subagent"` không hỏi; `mergeLocal` chỉ có hiệu lực sau duyệt G3.

### Task 1: autonomy.mjs đọc khoá autonomy
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC3.1, AC3.2, AC3.3, AC3.4, AC10.1
**Files:**
- Create: `core/skills/plan-execution/scripts/autonomy.mjs`
- Test: `test/content/34-autonomy-gates.pin.mjs`
- Test: `test/contract/91-guard-mcp.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `readAutonomy(cwd, deps?) → { mergeLocal: boolean, cleanup: boolean, partRunner: 'subagent'|'session'|'sequential' }`; CLI `node autonomy.mjs` in JSON đó

- [ ] **Step 1:** Test có tham số (AC3.1 giá trị hợp lệ; AC3.2 thiếu khoá, sai kiểu từng trường, JSON hỏng; AC3.3 worktree không có gate → đọc gate repo chính qua `deps.git`). Chạy `node test/validate.mjs --only autonomy-gates` thấy đỏ; commit test đỏ riêng.
- [ ] **Step 2:** Viết `autonomy.mjs`; chạy lại xanh; commit.

### Task 2: lệnh aip autonomy high|safe|status
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC8.1
**Files:**
- Create: `cli/lib/autonomy.mjs`
- Modify: `cli/index.mjs`
- Test: `test/mode.test.mjs`

**Interfaces:**
- Consumes: `readAutonomy` (Task 1) cho `status`; `resolveGate` của `gate-config.mjs`
- Produces: `runAutonomy(sub, { root, out, err }) → exit code`

- [ ] **Step 1:** Test: `high` ghi preset và giữ khoá khác; `safe` xoá khoá `autonomy` và giữ khoá khác; `status` in giá trị hiệu lực; sub lạ → exit 2. Chạy `node test/mode.test.mjs` thấy đỏ; commit test đỏ riêng.
- [ ] **Step 2:** Viết `cli/lib/autonomy.mjs`, định tuyến + help trong `cli/index.mjs`; chạy lại xanh; commit.

### Task 3: câu chữ 3 cổng, partRunner, mergeLocal, cleanup, báo cáo
**Kind:** DOCS
**Phủ AC:** AC1.1, AC2.1, AC4.1, AC5.1, AC6.1, AC7.1
**Files:**
- Modify: `workflows/feature/WORKFLOW.md`
- Modify: `core/skills/plan-execution/SKILL.md`
- Modify: `core/skills/plan-execution/references/task-loop.md`
- Modify: `core/skills/plan-execution/references/finish.md`
- Modify: `core/skills/plan-execution/references/inline.md`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: lệnh `node <thư mục skill plan-execution>/scripts/autonomy.mjs` (Task 1)
- Produces: không có

- [ ] **Step 1:** `workflow-feature` Bước 2 gom câu hỏi một tin nhắn (AC2.1); Checkpoint chỉ G1/G2/G3 + push cuối nhánh (AC1.1). `plan-execution` SKILL.md + `task-loop.md`: đọc `autonomy.mjs` đầu phiên; "Chế độ part" theo `partRunner` (AC6.1); không gửi dòng trạng thái giữa chừng (AC7.1). `inline.md`: subagent part tự commit trên nhánh part.
- [ ] **Step 2:** `finish.md`: G3 trình diff + rulings; `mergeLocal` → merge, full suite, `merged`, bỏ `plan.md` (AC4.1); `cleanup` → gỡ worktree sạch, xoá nhánh đã là tổ tiên (AC5.1); push hỏi riêng. Chạy `node test/validate.mjs` xanh (rebuild nếu thiếu SKILL.md).

### Task 4: lượt thử 4 trên aip-parts-trial
**Kind:** TOOLING
**TDD:** không — kiểm thực tế bằng một request thật, không có test tự động
**Phủ AC:** AC9.1
**Files:**
- Create: `docs/requests/2026-10-31-autonomy-gates/trial-4.md`
- Test: `docs/requests/2026-10-31-autonomy-gates/trial-4.md`

**Interfaces:**
- Consumes: core/workflows build từ nhánh này cài scope user (`aip update -g`), `aip autonomy high` trong `aip-parts-trial`
- Produces: không có

- [ ] **Step 1:** Bump + lock + `npm test`, `aip update -g`; trong `aip-parts-trial` chạy `aip autonomy high`, tạo request 2 part Song song (task TOOLING TDD có).
- [ ] **Step 2:** Chạy từ G2 tới G3: ghi mọi lần dừng, cách part chạy bằng subagent (cwd, hook, commit), merge local + dọn sau G3. Ghi `trial-4.md`, đối chiếu AC1.1, AC2.1, AC4.1–AC7.1, AC9.1.
