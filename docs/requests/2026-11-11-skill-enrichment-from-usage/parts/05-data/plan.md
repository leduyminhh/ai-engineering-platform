# Part 05-data — Số migration khi nhánh song song Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** `data-db-migration` thêm quy tắc chọn số migration khi nhiều nhánh chạy song song (đọc số trên mọi nhánh/worktree, dải dự trữ do phiên gốc ghi) và thứ tự merge.
**Architecture:** Sửa `plugins/data/skills/data-db-migration/SKILL.md` (C1–C3, bảng tự biện minh); nếu thân gần 300 dòng thì chi tiết sang `references/change/migration-numbering.md`. Template design của `artifact-templates` không đổi (mục `## Dự trữ số migration` là tuỳ chọn; muốn thêm vào template thì thuộc part 01-core, không thuộc part này).
**Tech Stack:** Markdown, pin Node `test/content/52-enrich-data.pin.mjs`.
**Spec:** ../../design.md
**Requirement:** không có

## Bản đồ file

| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/data/skills/data-db-migration/SKILL.md` | Bước chọn số ở C1–C3, quy tắc thứ tự merge, đúng một dòng mới ở bảng tự biện minh (≤ 300 dòng, hiện 166) | Task 1, Task 2 |
| `plugins/data/skills/data-db-migration/references/change/migration-numbering.md` | Chi tiết đánh số và thứ tự merge, chỉ tạo khi thân `SKILL.md` gần 300 dòng | Task 1, Task 2 |
| `test/content/52-enrich-data.pin.mjs` | Pin AC6.1–AC6.2 | Task 1, Task 2 |

Part không ghi `.manifest.json`, `plugins/_versions.lock.json`, `plugins/_published.json`, `test/routing/*`, `CHANGELOG.md`, `README*.md`, `docs/specs/*`, `AGENTS.md`, `build/`: session gốc làm.

## Global Constraints

- Nội dung skill tiếng Việt có dấu, theo `engineering-writing-style`; nhãn `[Verified]`/`[Inference]`/`[Unverified]` ở chỗ nêu sự thật chưa kiểm.
- Trung lập project (D5): ví dụ khái quát ("migration số tuần tự"), không số phiên bản hay tên bảng của project nguồn. Biểu thức cấm: `cap-(core|web|ui|storage|contracts)|capcore|capstorage|content-automation|khe kho|\bV1[0-9]{2}\b|worker-(intelligence|media|content|metadata|acquisition|publishing)|tts-local|searxng|story-series|niche`.
- Trước khi chọn số migration kế tiếp: đọc số lớn nhất trên nhánh tích hợp và trên mọi nhánh/worktree đang mở bằng `git worktree list`, `git branch --list`, `git ls-tree -r --name-only <nhánh> -- <thư mục migration>`; số đã bị nhánh khác giữ thì chọn số cao hơn; request chia part dùng mục `## Dự trữ số migration` trong `design.md` của request (bảng `| Part | Dải số | Trạng thái |`) do phiên gốc ghi trước khi chạy nhóm song song, part chỉ chọn số trong dải của mình; skill trỏ tới mục này.
- Thứ tự merge: nhánh số thấp merge trước; trùng số khi merge sau thì đổi số của nhánh chưa phát hành (chưa áp lên DB nào ngoài container test) và ghi `Ruling:`; không đổi số hay nội dung migration đã áp lên DB dùng chung (checksum).
- Bảng "Dấu hiệu đang tự biện minh" thêm đúng một dòng, giữ 4–6 dòng (pin 47); thân `SKILL.md` ≤ 300 dòng.
- Không đổi hành vi C3 "file cũ bất biến" và không chạy migration hay kết nối DB.
- Commit theo `git-workflow`: header Conventional Commits tiếng Anh, thân tiếng Việt có dấu, không `Co-authored-by`.

## Review Focus

- Ba lệnh git đọc số có mặt nguyên văn và skill trỏ mục `## Dự trữ số migration` kèm tên ba cột bảng: Task 1 (pin 52).
- Quy tắc "không đổi số hay nội dung migration đã áp lên DB dùng chung" không bị đảo nghĩa so với C3 hiện có: Task 2 (pin 52 kiểm câu cấm; pin 01 và pin 11 giữ).
- Bảng tự biện minh sau khi thêm đúng một dòng vẫn 4–6 dòng: Task 2 (pin 47 và pin 52).
- Thân `SKILL.md` ≤ 300 dòng; nếu gần mốc, chi tiết sang `migration-numbering.md` và `SKILL.md` chỉ giữ tóm tắt và liên kết: Task 1, Task 2 (pin 52).

### Task 1: Chọn số migration khi có nhánh song song
**Kind:** DOCS
**TDD:** không — task tài liệu; pin 52 viết trước
**Phủ AC:** AC6.1
**Ước lượng:** 20'
**Files:**
- Modify: `plugins/data/skills/data-db-migration/SKILL.md`
- Create: `plugins/data/skills/data-db-migration/references/change/migration-numbering.md`
- Create: `test/content/52-enrich-data.pin.mjs`
- Test: `test/content/52-enrich-data.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Tạo pin 52 với case AC6.1: `SKILL.md` (hoặc `references/change/migration-numbering.md` khi chi tiết nằm ở đó và `SKILL.md` trỏ tới) có bước trước khi chọn số kế tiếp gồm ba lệnh `git worktree list`, `git branch --list`, `git ls-tree -r --name-only <nhánh> -- <thư mục migration>`; số bị giữ thì chọn cao hơn; trỏ `## Dự trữ số migration` với bảng `| Part | Dải số | Trạng thái |`, phiên gốc ghi trước nhóm song song, part chỉ chọn số trong dải; thân ≤ 300 dòng. Chạy `npm run build` rồi `node test/validate.mjs --build --only 52-enrich-data`. Kết quả mong đợi: đỏ.
- [ ] **Step 2:** Viết bước ở C1–C3 (chi tiết sang `migration-numbering.md` chỉ khi thân gần 300 dòng; nếu không cần, không tạo file và bỏ khỏi `**Files:**` khi báo cáo, ghi lý do). Không sửa template của `artifact-templates`.
- [ ] **Step 3:** Chạy `node test/validate.mjs --build --only 52-enrich-data --only 01-data-db-migration --only 11-db-change --only 08-publish --only 47-rationalization-tables`. Kết quả mong đợi: xanh.
- [ ] **Step 4:** Grep D5 ra 0 dòng. Lập bảng khẳng định → file:line → khớp|lệch cho ba lệnh git, tên mục C1–C3 và tên cột bảng; sửa chỗ lệch. Commit (`docs(data): add parallel migration numbering rule`).

### Task 2: Thứ tự merge và dòng tự biện minh
**Kind:** DOCS
**TDD:** không — task tài liệu; pin 52
**Phủ AC:** AC6.2
**Ước lượng:** 20'
**Files:**
- Modify: `plugins/data/skills/data-db-migration/SKILL.md`
- Modify: `plugins/data/skills/data-db-migration/references/change/migration-numbering.md`
- Test: `test/content/52-enrich-data.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Thêm case AC6.2 vào pin 52: có quy tắc nhánh số thấp merge trước; trùng số khi merge sau thì đổi số của nhánh chưa phát hành và ghi `Ruling:`; không đổi số hay nội dung migration đã áp lên DB dùng chung (checksum); bảng "Dấu hiệu đang tự biện minh" tăng đúng một dòng (4–6 dòng); thân ≤ 300 dòng. Chạy `node test/validate.mjs --build --only 52-enrich-data`. Kết quả mong đợi: đỏ.
- [ ] **Step 2:** Viết quy tắc thứ tự merge (sang `migration-numbering.md` nếu file đã tồn tại từ Task 1, không thì vào `SKILL.md`) và thêm đúng một dòng vào bảng tự biện minh (ví dụ suy nghĩ "số này chắc chưa ai lấy").
- [ ] **Step 3:** Chạy `npm run build` rồi `node test/validate.mjs --build --only 52-enrich-data --only 01-data-db-migration --only 11-db-change --only 47-rationalization-tables --only 40-conventions`. Kết quả mong đợi: xanh, không cảnh báo "quá mốc 300".
- [ ] **Step 4:** Grep D5 ra 0 dòng. Lập bảng khẳng định → file:line → khớp|lệch cho khẳng định về checksum và `Ruling:`; sửa chỗ lệch. Commit (`docs(data): add migration merge order rule`).
