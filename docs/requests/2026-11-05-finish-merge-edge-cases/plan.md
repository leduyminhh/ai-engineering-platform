# Hai ca biên của "Merge local theo khoá" Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** mục "Merge local theo khoá" nêu cách xử lý khi git từ chối bắt đầu merge (không abort) và khi nhánh feature đã là tổ tiên của nhánh gốc (dừng, không commit rỗng).
**Architecture:** sửa bước 2 của một cơ chế duy nhất trong `finish.md`; `WORKFLOW.md`, `error-matrix.md` và spec `workflows` R7 mô tả đồng bộ.
**Tech Stack:** Markdown, test pin Node (`test/harness.mjs`).
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `test/content/41-finish-merge-edge-cases.pin.mjs` | pin: bước 2 có `--is-ancestor` và `MERGE_HEAD`, giữ heading và bước 1–5 | Task 1 |
| `core/skills/plan-execution/references/finish.md` | bước 2 của "Merge local theo khoá": hai lỗi chặn mới | Task 2 |
| `workflows/feature/WORKFLOW.md` | Bước 7, bảng Xử lý lỗi, Rollback | Task 2 |
| `workflows/feature/references/error-matrix.md` | hàng lỗi chặn merge local | Task 2 |
| `docs/specs/workflows/spec.md` | R7 và hàng lịch sử | Task 2 |
| `core/.manifest.json`, `workflows/.manifest.json`, `plugins/_versions.lock.json` | bump version và lock | Task 3 |

## Global Constraints
Tiếng Việt có dấu, UTF-8 không BOM, LF. Giữ heading "## Merge local theo khoá" và số bước 1–5 (pin `36-brainstorming-routing`). Không đổi `ask-user.md`, `git-workflow/SKILL.md`, code CLI/hook/script. Test chỉ ghim lệnh và điều kiện dừng, không ghim văn xuôi.

## Review Focus
- Ca 1: không `git merge --abort` khi không có trạng thái merge (không `MERGE_HEAD`); ca conflict/suite đỏ vẫn abort (AC1.1).
- Ca 2: kiểm `git merge-base --is-ancestor` trước checkout, dừng, không commit rỗng, không bước 3–5, người dùng quyết `merged` và xoá plan (AC2.1).
- `finish.md`, `WORKFLOW.md`, `error-matrix.md`, spec R7 mô tả cùng hai ca, không mâu thuẫn với nhau hay với bảng 3 lựa chọn và "Dọn theo khoá" (AC3.1, AC4.1).
- Pin mới đỏ trước Task 2, xanh sau; các pin cũ (`31`, `33`, `36`, `38`, `40`) không vỡ (AC5.1).

### Task 1: Pin hợp đồng vận hành cho hai ca biên
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC5.1
**Files:**
- Create: `test/content/41-finish-merge-edge-cases.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: pin đỏ cho tới khi Task 2 xong

- [ ] **Step 1:** Viết module `export default async function run({ ok, ctx })` theo mẫu `test/content/40-finish-manual-merge.pin.mjs`: lấy mục `## Merge local theo khoá` của `finish.md`; `ok` khi mục chứa `git merge-base --is-ancestor` và `MERGE_HEAD`, và vẫn có đủ các bước `1.`–`5.` (heading giữ nguyên). Một test, nhãn bắt đầu bằng `AC5.1:`.
- [ ] **Step 2:** `node test/validate.mjs --build --only finish-merge-edge` đỏ; commit riêng chỉ file test (hook pre-commit chặn commit đỏ thì ghi `Ruling:` và gộp một commit).

### Task 2: Đồng bộ tài liệu hai ca biên
**Kind:** DOCS
**Phủ AC:** AC1.1, AC2.1, AC3.1, AC4.1
**Files:**
- Modify: `core/skills/plan-execution/references/finish.md`
- Modify: `workflows/feature/WORKFLOW.md`
- Modify: `workflows/feature/references/error-matrix.md`
- Modify: `docs/specs/workflows/spec.md`

**Interfaces:**
- Consumes: pin của Task 1
- Produces: không có

- [ ] **Step 1:** `finish.md` bước 2 theo mục Thiết kế 1: đầu bước, trước checkout, `git merge-base --is-ancestor <nhánh feature> <nhánh gốc>` thoát 0 → lỗi chặn (dừng, báo hash tip feature và nhánh gốc, không merge, không commit rỗng, không bước 3–5, người dùng quyết `merged` và xoá plan); sau `git merge --no-ff --no-commit`: git từ chối bắt đầu (không `MERGE_HEAD`) → lỗi chặn, không `--abort`, không dọn; có `MERGE_HEAD` mà conflict hoặc suite đỏ → `--abort` như cũ. Giữ heading và số bước 1–5.
- [ ] **Step 2:** `WORKFLOW.md` Bước 7, hàng bảng Xử lý lỗi, Rollback; `error-matrix.md` hàng tương ứng; ngắn, cùng nội dung.
- [ ] **Step 3:** `docs/specs/workflows/spec.md` R7: thêm hai ca vào đoạn merge local, nối nguồn request này vào "Nguồn" của R7; thêm hàng lịch sử `| 2026-11-05 | [2026-11-05-finish-merge-edge-cases](../../requests/2026-11-05-finish-merge-edge-cases/design.md) | workflows/R7 | đổi |`.
- [ ] **Step 4:** `node test/validate.mjs --build --only finish-` xanh (pin 40 và 41).

### Task 3: Bump version và lock
**Kind:** TOOLING
**TDD:** không — chỉnh số phiên bản, kiểm bằng `npm test`
**Phủ AC:** AC6.1
**Files:**
- Modify: `core/.manifest.json`
- Modify: `workflows/.manifest.json`
- Modify: `plugins/_versions.lock.json`

**Interfaces:**
- Consumes: nội dung Task 2
- Produces: không có

- [ ] **Step 1:** `core` 1.28.3 → 1.28.4, `workflows` 3.14.14 → 3.14.15; `npm run build`; `node cli/lib/versions.mjs --lock`.
- [ ] **Step 2:** `npm test` exit 0.
