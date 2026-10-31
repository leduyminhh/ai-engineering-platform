# part-mode-tooling-gaps Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Vá các lỗ hổng TOOLING/ledger/review cuối của chế độ part từ lượt thử 2, rồi kiểm bằng lượt thử 3 với 3 part.
**Architecture:** Một thay đổi script (`ledger.mjs` đọc task trong plan để đòi `red:`), câu chữ trong `plan-execution` references, và một lượt thử thật trên `E:\Mine\AI\aip-parts-trial`.
**Tech Stack:** Node 20+, ESM, zero-dependency; test qua `test/validate.mjs`.
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/skills/plan-execution/scripts/ledger.mjs` | đòi `red:` cho task TDD `có` do session chính làm | Task 1 |
| `core/skills/plan-execution/scripts/task-brief.mjs` | export `taskField` để `ledger.mjs` đọc `**Kind:**` | Task 1 |
| `test/content/32-superpowers-gap.pin.mjs` | test `validateLine`/`main` của `ledger.mjs` | Task 1 |
| `core/skills/plan-execution/references/task-loop.md` | mẫu dòng complete, báo cáo TOOLING, commit đỏ riêng, nhắc trust | Task 2 |
| `core/skills/plan-execution/references/inline.md` | commit đỏ riêng ở chế độ inline | Task 2 |
| `core/skills/plan-execution/references/prompts/final-review.md` | reviewer `general-purpose` cho diff tooling; task sửa cho AC mới | Task 2 |
| `docs/requests/2026-10-31-part-mode-tooling-gaps/trial-3.md` | kết quả lượt thử 3 | Task 3 |

## Global Constraints
- Script zero-dependency, chỉ built-in Node; `validateLine(line)` gọi không có ctx giữ nguyên hành vi R12.
- Bump version `core` và chạy `node cli/lib/versions.mjs --lock` một lần ở bước kết thúc nhánh, trước full suite; cập nhật spec `hooks-gates/R11`, `workflows/R7`, `R12`, `R14` ở bước kết thúc nhánh.
- Lượt thử 3 chỉ ghi trong `E:\Mine\AI\aip-parts-trial` và `trial-3.md`; không push repo nào.

## Review Focus
- `ledger.mjs`: plan không đọc được, task không có trong plan, task trong khối code, dòng nhiều dòng — đều không được chặn nhầm hay bỏ lọt.
- `task-loop.md` bước 9 và `inline.md` bước 6 không mâu thuẫn nhau về mẫu dòng `complete`.
- Commit đỏ riêng không phá luồng `BE` (agent không commit).

### Task 1: ledger.mjs đòi red: theo TDD của task
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC2.4, AC2.5
**Files:**
- Modify: `core/skills/plan-execution/scripts/ledger.mjs`
- Modify: `core/skills/plan-execution/scripts/task-brief.mjs`
- Test: `test/content/32-superpowers-gap.pin.mjs`

**Interfaces:**
- Consumes: `extractTask`, `effectiveTdd`, `taskField` từ `task-brief.mjs`
- Produces: `validateLine(line, ctx?)` với `ctx = { tdd, kind }`; `main` tự dựng ctx từ plan

- [ ] **Step 1:** Thêm test có tham số (AC2.4, AC2.5) qua `main` với plan tạm: TOOLING TDD `có` thiếu `red:` → exit 2 không ghi; có `red:` → exit 0; TDD `không`, kind `BE`, task không có trong plan → exit 0. Chạy `node test/validate.mjs --only superpowers` thấy đỏ; commit test đỏ riêng.
- [ ] **Step 2:** Export `taskField`; `validateLine` nhận ctx; `main` đọc plan, lấy task theo số trong dòng, dựng ctx (lỗi đọc → không ctx). Chạy lại lệnh trên xanh; commit.

### Task 2: câu chữ plan-execution cho TOOLING, review cuối, bàn giao
**Kind:** DOCS
**Phủ AC:** AC2.1, AC2.2, AC2.3, AC3.1, AC4.1, AC5.1
**Files:**
- Modify: `core/skills/plan-execution/references/task-loop.md`
- Modify: `core/skills/plan-execution/references/inline.md`
- Modify: `core/skills/plan-execution/references/prompts/final-review.md`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: mẫu dòng và quy tắc `red:` của Task 1
- Produces: không có

- [ ] **Step 1:** `task-loop.md` bước 9: mẫu dòng `complete` cho task session chính làm có TDD `có` và định nghĩa `review clean` khi còn minor (AC2.1); bước 3/7: báo cáo `task-<n>-report.md` dạng `agent_result` có `tdd.red`/`tdd.green`, reviewer `general-purpose` không nạp skill domain (AC2.2); commit test đỏ riêng kèm lối thoát pre-commit (AC2.3, cả `inline.md`); "Chế độ part" bước 6: nhắc trust thư mục worktree (AC5.1).
- [ ] **Step 2:** `final-review.md`: diff không chạm backend/frontend → `general-purpose` `model: opus` (AC3.1); AC mới từ `questions[]` → thêm `### Task` sửa có `**Phủ AC:**` vào plan gốc (AC4.1). Chạy `node test/validate.mjs` xanh.

### Task 3: lượt thử 3 trên aip-parts-trial
**Kind:** TOOLING
**TDD:** không — kiểm thực tế bằng phiên part thật, không có test tự động
**Phủ AC:** AC1.1, AC6.1
**Files:**
- Create: `docs/requests/2026-10-31-part-mode-tooling-gaps/trial-3.md`
- Test: `docs/requests/2026-10-31-part-mode-tooling-gaps/trial-3.md`

**Interfaces:**
- Consumes: core build từ nhánh này (Task 1, Task 2), cài scope user
- Produces: không có

- [ ] **Step 1:** Build, cài core từ nhánh vào scope user, xác nhận version. Trong `aip-parts-trial` tạo request 3 part: 01 và 02 nhóm Song song A, 03 phụ thuộc 01 và Consumes export của 01; mỗi part 1 task TOOLING TDD `có`. `check-request` + `check-partition` sạch.
- [ ] **Step 2:** Chạy chế độ part: phiên thật cho 01/02 (ghi output hook lúc mở phiên — AC1.1), merge, rồi 03; review cuối; kết thúc nhánh giữ nguyên. Ghi vào `trial-3.md`: hash, ledger, mọi chỗ vướng, đối chiếu AC2.1–AC5.1.
