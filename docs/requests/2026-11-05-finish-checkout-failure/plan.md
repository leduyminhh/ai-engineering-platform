# Checkout nhánh gốc thất bại trong "Merge local theo khoá" Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** bước 2 của "Merge local theo khoá" coi `git checkout <nhánh gốc>` thất bại là lỗi chặn (không `git merge`, không abort, không dọn).
**Architecture:** sửa một dòng bước 2 của `finish.md`; `WORKFLOW.md`, `error-matrix.md` và spec R7 mô tả đồng bộ; pin 41 ghim thứ tự lệnh.
**Tech Stack:** Markdown, test pin Node (`test/harness.mjs`).
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `test/content/41-finish-merge-edge-cases.pin.mjs` | thêm pin thứ tự `git checkout <nhánh gốc>` trước `git merge --no-ff --no-commit` | Task 1 |
| `core/skills/plan-execution/references/finish.md` | bước 2: lệnh checkout và lỗi chặn khi thoát khác 0 | Task 2 |
| `workflows/feature/WORKFLOW.md` | hàng bảng Xử lý lỗi, Rollback | Task 2 |
| `workflows/feature/references/error-matrix.md` | hàng lỗi chặn merge local | Task 2 |
| `docs/specs/workflows/spec.md` | R7 và hàng lịch sử | Task 2 |
| `core/.manifest.json`, `workflows/.manifest.json`, `plugins/_versions.lock.json` | bump version và lock | Task 3 |

## Global Constraints
Tiếng Việt có dấu, UTF-8 không BOM, LF. Giữ heading "## Merge local theo khoá" và số bước 1–5. Không đổi `task-loop.md`, `ask-user.md`, `git-workflow/SKILL.md`, code CLI/hook/script, và hai ca biên đã có (tổ tiên, git từ chối bắt đầu merge). Test chỉ ghim lệnh và điều kiện dừng.

## Review Focus
- Checkout thất bại: không `git merge`, không `--abort`, không dọn; báo tên nhánh gốc và nơi giữ nó (AC1.1).
- Hai ca biên cũ (tổ tiên kiểm trước checkout; không `MERGE_HEAD` thì không abort) vẫn đúng thứ tự và không mâu thuẫn (AC1.1).
- `finish.md`, `WORKFLOW.md`, `error-matrix.md`, spec R7 mô tả cùng ca này (AC2.1, AC3.1).
- Pin mới đỏ trước Task 2, xanh sau; pin cũ không vỡ (AC4.1).

### Task 1: Pin thứ tự checkout trước merge
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC4.1
**Files:**
- Modify: `test/content/41-finish-merge-edge-cases.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: pin đỏ cho tới khi Task 2 xong

- [ ] **Step 1:** Trong pin 41 thêm một `ok` nhãn bắt đầu bằng `AC4.1:`: trong mục "Merge local theo khoá" của `finish.md`, vị trí của `git checkout <nhánh gốc>` tồn tại và đứng trước vị trí của `git merge --no-ff --no-commit`.
- [ ] **Step 2:** `node test/validate.mjs --build --only finish-merge-edge` đỏ (exit 1); commit riêng chỉ file test.

### Task 2: Đồng bộ tài liệu ca checkout thất bại
**Kind:** DOCS
**Phủ AC:** AC1.1, AC2.1, AC3.1
**Files:**
- Modify: `core/skills/plan-execution/references/finish.md`
- Modify: `workflows/feature/WORKFLOW.md`
- Modify: `workflows/feature/references/error-matrix.md`
- Modify: `docs/specs/workflows/spec.md`

**Interfaces:**
- Consumes: pin của Task 1
- Produces: không có

- [ ] **Step 1:** `finish.md` bước 2: dòng "Thoát khác 0: chuyển sang nhánh gốc…" thành: chạy `git checkout <nhánh gốc>`; thoát khác 0 (vd nhánh gốc đang được worktree khác giữ) → lỗi chặn: dừng, báo tên nhánh gốc và nơi đang giữ nó (`git worktree list`), không `git merge`, không `--abort`, không dọn; người dùng merge ở worktree đó hoặc chọn nhánh gốc khác. Thoát 0: chạy `git merge --no-ff --no-commit <nhánh feature>` (local, không push) và giữ hai gạch đầu dòng sau.
- [ ] **Step 2:** `WORKFLOW.md` hàng bảng lỗi và Rollback; `error-matrix.md` hàng tương ứng; ngắn, cùng nội dung.
- [ ] **Step 3:** Spec R7: thêm ca vào đoạn merge local, nối nguồn `[2026-11-05-finish-checkout-failure](../../requests/2026-11-05-finish-checkout-failure/design.md) (đổi: checkout nhánh gốc thất bại là lỗi chặn)`; thêm hàng lịch sử `| 2026-11-05 | [2026-11-05-finish-checkout-failure](../../requests/2026-11-05-finish-checkout-failure/design.md) | workflows/R7 | đổi |`.
- [ ] **Step 4:** `node test/validate.mjs --build --only finish-` xanh.

### Task 3: Bump version và lock
**Kind:** TOOLING
**TDD:** không — chỉnh số phiên bản, kiểm bằng `npm test`
**Phủ AC:** AC5.1
**Files:**
- Modify: `core/.manifest.json`
- Modify: `workflows/.manifest.json`
- Modify: `plugins/_versions.lock.json`

**Interfaces:**
- Consumes: nội dung Task 2
- Produces: không có

- [ ] **Step 1:** `core` 1.28.4 → 1.28.5, `workflows` 3.14.15 → 3.14.16; `npm run build`; `node cli/lib/versions.mjs --lock`.
- [ ] **Step 2:** `npm test` exit 0.
