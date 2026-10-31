# part-mode-tooling-minors Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Sửa các minor còn hoãn của `part-mode-tooling-gaps`: kiểm `tests:`/`red:`/`\r` trong `ledger.mjs`, câu chữ review và Bước 6 của `workflow-feature`.
**Architecture:** Một thay đổi script (`ledger.mjs`) và câu chữ trong `plan-execution` references cùng `workflows/feature/WORKFLOW.md`.
**Tech Stack:** Node 20+, ESM, zero-dependency; test qua `test/validate.mjs`.
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/skills/plan-execution/scripts/ledger.mjs` | đòi `tests:` cho selfRun TDD `có`, `red:` có lệnh, tách dòng theo mọi kiểu xuống dòng | Task 1 |
| `test/content/32-superpowers-gap.pin.mjs` | test có tham số cho `ledger.mjs` | Task 1 |
| `core/skills/plan-execution/references/prompts/final-review.md` | dòng complete cho task sửa | Task 2 |
| `core/skills/plan-execution/references/task-loop.md` | `review clean` gồm `spec_verdict: compliant` | Task 2 |
| `core/skills/plan-execution/references/prompts/task-review.md` | kiểm file commit đỏ qua `## Commits` | Task 2 |
| `workflows/feature/WORKFLOW.md` | Bước 6 nêu reviewer `general-purpose` | Task 2 |

## Global Constraints
- Script zero-dependency, chỉ built-in Node.
- Bump `core` và `workflows`, chạy `node cli/lib/versions.mjs --lock`, cập nhật spec `workflows/R7`, `R12` ở bước kết thúc nhánh.
- Không push, không merge.

## Review Focus
- `ledger.mjs`: dòng hợp lệ hiện có (BE, TDD `không`, task không có trong plan, inline đủ evidence) không bị chặn nhầm.
- `WORKFLOW.md` Bước 6 vẫn khớp `graph.json` (`run.agents`, `run.parallel`).

### Task 1: ledger.mjs đòi tests: cho selfRun TDD có, red: có lệnh, tách \r
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC1.1, AC1.2, AC1.3
**Files:**
- Modify: `core/skills/plan-execution/scripts/ledger.mjs`
- Test: `test/content/32-superpowers-gap.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không đổi chữ ký `validateLine(line, ctx?)`, `main(argv, deps)`

- [ ] **Step 1:** Thêm ca vào test có tham số qua `main` (AC1.1, AC1.2) và ca `validateLine` với `\r` lẻ (AC1.3). Chạy `node test/validate.mjs --only superpowers-gap` thấy đỏ; commit test đỏ riêng.
- [ ] **Step 2:** Sửa `ledger.mjs` theo design. Chạy lại lệnh trên xanh; commit.

### Task 2: câu chữ review và Bước 6 workflow-feature
**Kind:** DOCS
**Phủ AC:** AC2.1, AC2.2, AC3.1, AC4.1
**Files:**
- Modify: `core/skills/plan-execution/references/prompts/final-review.md`
- Modify: `core/skills/plan-execution/references/task-loop.md`
- Modify: `core/skills/plan-execution/references/prompts/task-review.md`
- Modify: `workflows/feature/WORKFLOW.md`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Sửa 4 file theo design (2)(3)(4).
- [ ] **Step 2:** `npm run build` rồi `node test/validate.mjs --build` exit 0; commit.
