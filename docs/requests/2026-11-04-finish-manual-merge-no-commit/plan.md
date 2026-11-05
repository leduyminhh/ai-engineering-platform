# Merge local tay đi cùng cơ chế `--no-commit` Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** lựa chọn "merge local" tay ở G3 dùng cùng cơ chế với `mergeLocal: true`: `--no-ff --no-commit`, suite, `--abort` khi đỏ.
**Architecture:** một cơ chế trong mục "Merge local theo khoá" của `finish.md`, hai cách kích hoạt; `WORKFLOW.md` và `error-matrix.md` mô tả đồng bộ.
**Tech Stack:** Markdown, test pin Node (`test/harness.mjs`).
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `test/content/40-finish-manual-merge.pin.mjs` | pin: bullet tay có `--no-commit`/`--abort`, không còn suite sau merge | Task 1 |
| `core/skills/plan-execution/references/finish.md` | một cơ chế merge local cho cả hai cách kích hoạt | Task 2 |
| `workflows/feature/WORKFLOW.md` | Bước 7, bảng Xử lý lỗi, Rollback | Task 2 |
| `workflows/feature/references/error-matrix.md` | hàng lỗi chặn merge local | Task 2 |
| `core/.manifest.json`, `workflows/.manifest.json`, `plugins/_versions.lock.json` | bump version và lock | Task 3 |

## Global Constraints
Tiếng Việt có dấu, UTF-8 không BOM, LF. Giữ heading "## Merge local theo khoá" và số bước 1–5 (pin `36-brainstorming-routing`). Không đổi `ask-user.md`, `git-workflow/SKILL.md`, code CLI/hook/script.

## Review Focus
- Đường tay không còn chỗ nào merge rồi mới chạy suite (AC1.1, AC3.1).
- Bước 5 (hỏi push/PR) chỉ của đường theo khoá; đường tay không hỏi push vì push là lựa chọn 2 (AC2.1).
- `WORKFLOW.md`, `error-matrix.md` và `finish.md` mô tả cùng một cơ chế (AC4.1).
- Pin mới đỏ trước Task 2, xanh sau (AC5.1); các pin cũ của `finish.md`/`WORKFLOW.md` không vỡ.

### Task 1: Pin hồi quy cho đường tay
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC5.1
**Files:**
- Create: `test/content/40-finish-manual-merge.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: pin đỏ cho tới khi Task 2 xong

- [ ] **Step 1:** Viết module `export default async function run({ ok, ctx })` theo mẫu `test/content/38-scope-discipline.pin.mjs`: lấy bullet bắt đầu bằng `- **merge local**` trong `finish.md`, `ok` khi nó chứa `--no-commit` hoặc trỏ tới "Merge local theo khoá" và mục đó chứa `--no-commit` và `--abort`, và `finish.md` không còn `full suite trên kết quả merge`. Một test duy nhất, nhãn bắt đầu bằng `AC5.1:`.
- [ ] **Step 2:** `node test/validate.mjs --build --only finish-manual` đỏ; commit riêng chỉ file test (hook pre-commit chặn commit đỏ thì ghi `Ruling:` và gộp một commit).

### Task 2: Đồng bộ tài liệu merge local
**Kind:** DOCS
**Phủ AC:** AC1.1, AC2.1, AC3.1, AC4.1
**Files:**
- Modify: `core/skills/plan-execution/references/finish.md`
- Modify: `workflows/feature/WORKFLOW.md`
- Modify: `workflows/feature/references/error-matrix.md`
- Modify: `test/content/31-workflow-self-sufficient.pin.mjs`

**Interfaces:**
- Consumes: pin của Task 1
- Produces: không có

- [ ] **Step 1:** `finish.md` theo mục Thiết kế 1: hàng 1 bảng; câu mở đầu và bước 5 của "Merge local theo khoá"; bullet tay (giữ câu nhánh protected); "Dọn theo khoá" trỏ bước 2.
- [ ] **Step 2:** `WORKFLOW.md` Bước 7, hàng bảng lỗi, Rollback; thêm hàng vào `error-matrix.md`.
- [ ] **Step 3:** `node test/validate.mjs --build --only finish-manual` xanh; `npm run build` rồi `node test/validate.mjs --build` xanh.

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

- [ ] **Step 1:** `core` 1.28.1 → 1.28.2, `workflows` 3.14.13 → 3.14.14; `npm run build`; `node cli/lib/versions.mjs --lock`.
- [ ] **Step 2:** `npm test` exit 0.
