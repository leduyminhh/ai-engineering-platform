# Part 04 — bảng "Dấu hiệu đang tự biện minh" cho các skill còn thiếu

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** 8 skill chưa có bảng nhận bảng 4–6 dòng; `engineering-debugging` giữ bảng sẵn có ("Dấu hiệu đang đoán thay vì điều tra", 6 dòng) và được pin cùng.
**Architecture:** mỗi bảng là một mục Markdown trong SKILL.md, cột Thực tế trỏ về bước, cổng hay ranh giới đã có trong chính skill.
**Tech Stack:** Markdown + pin test Node.
**Spec:** ../../design.md (mục P4; AC4.1)
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/backend/skills/backend-code-review/SKILL.md` | bảng tự biện minh | Task 1 |
| `plugins/frontend/skills/frontend-code-review/SKILL.md` | bảng tự biện minh | Task 1 |
| `plugins/backend/skills/backend-refactor/SKILL.md` | bảng tự biện minh | Task 1 |
| `plugins/frontend/skills/frontend-refactor/SKILL.md` | bảng tự biện minh | Task 1 |
| `plugins/engineering/skills/engineering-quality-gate/SKILL.md` | bảng tự biện minh | Task 2 |
| `plugins/ops/skills/ops-deploy-release/SKILL.md` | bảng tự biện minh | Task 2 |
| `plugins/data/skills/data-db-migration/SKILL.md` | bảng tự biện minh | Task 2 |
| `core/skills/git-workflow/SKILL.md` | bảng tự biện minh | Task 2 |
| `test/content/47-rationalization-tables.pin.mjs` | pin AC4.1 cho 9 skill | Task 1, Task 2 |

## Global Constraints

- File UTF-8 không BOM, LF. Văn bản tiếng Việt có dấu, theo skill `engineering-writing-style`. Không chép câu chữ của agent-skills.
- Không sửa: `**/.manifest.json`, `plugins/_versions.lock.json`, `CHANGELOG.md`, `CLAUDE.md`, `docs/requests/**/design.md`, `docs/specs/**`, `description` của skill, `plugins/engineering/skills/engineering-debugging/SKILL.md`.
- Mục `## Dấu hiệu đang tự biện minh`, bảng `| Suy nghĩ | Thực tế |`, 4–6 dòng, mỗi dòng mở bằng `| "`; cột Thực tế nêu tên bước, cổng, gate hay ranh giới đã có trong chính SKILL.md đó, không thêm luật mới. Mẫu: mục cùng tên trong `core/skills/plan-execution/SKILL.md`.
- Vị trí: ngay sau mục Quy trình (và `## Bảng gate` nếu có), trước `## Sau khi xong` / `## Verification…` / `## Report trả về` / `## Kết thúc nhánh` (git-workflow: sau `## Quy trình — commit & push`).
- Thân SKILL.md ≤ 300 dòng.
- Mỗi assert nhắc ID AC nó phủ (vd `AC3.2`) trong thông điệp, để `check-request.mjs` W7 thấy.
- Test hẹp: `node test/validate.mjs --build --only 47-rationalization` và `--only 40-conventions`; không chạy full suite trong part.
- Commit: `git commit -F <file>`, header tiếng Anh `type(scope): summary`, body tiếng Việt, không dòng `Co-Authored-By`.

## Review Focus

- Dòng bảng trỏ tới bước không có trong skill: reviewer cuối đối chiếu từng dòng; pin 47 chỉ đếm dòng.
- `engineering-debugging` bị sửa ngoài ý: pin 47 giữ heading cũ của nó và đếm 4–6 dòng.

### Task 1: bốn skill review và refactor
**Kind:** DOCS
**Ước lượng:** 20'
**Phủ AC:** AC4.1
**Files:**
- Modify: `plugins/backend/skills/backend-code-review/SKILL.md`
- Modify: `plugins/frontend/skills/frontend-code-review/SKILL.md`
- Modify: `plugins/backend/skills/backend-refactor/SKILL.md`
- Modify: `plugins/frontend/skills/frontend-refactor/SKILL.md`
- Create: `test/content/47-rationalization-tables.pin.mjs`
- Test: `test/content/47-rationalization-tables.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** viết pin 47 với bảng 9 mục (đường dẫn SKILL.md, heading mong đợi: 8 skill `## Dấu hiệu đang tự biện minh`, `engineering-debugging` `## Dấu hiệu đang đoán thay vì điều tra`): mỗi mục có heading, 4–6 dòng `| "` trong mục đó, thân ≤ 300 dòng. Chạy `--only 47-rationalization` → đỏ (8 skill chưa có).
- [ ] **Step 2:** thêm bảng cho 4 skill của task. Chạy lại → còn đỏ đúng 4 skill của Task 2.
- [ ] **Step 3:** commit `docs(skills): add rationalization tables to review and refactor skills`.

### Task 2: bốn skill gate, deploy, migration, git
**Kind:** DOCS
**Ước lượng:** 20'
**Phủ AC:** AC4.1
**Files:**
- Modify: `plugins/engineering/skills/engineering-quality-gate/SKILL.md`
- Modify: `plugins/ops/skills/ops-deploy-release/SKILL.md`
- Modify: `plugins/data/skills/data-db-migration/SKILL.md`
- Modify: `core/skills/git-workflow/SKILL.md`
- Test: `test/content/47-rationalization-tables.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** thêm bảng cho 4 skill. Chạy `--only 47-rationalization` và `--only 40-conventions` → xanh.
- [ ] **Step 2:** commit `docs(skills): add rationalization tables to gate, deploy, migration and git skills`.
