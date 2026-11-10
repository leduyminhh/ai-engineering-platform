# Part 02 — mục Kiểm nguồn trong principles

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** skill `principles` có mục "Kiểm nguồn"; `backend-implement`, `frontend-implement`, `frontend-data-integration` trỏ tới nó ở bước đầu `## Quy trình`.
**Architecture:** `core/principles/source-check.md` được `readCorePrinciples` ghép vào skill `principles` khi build.
**Tech Stack:** Markdown + pin test Node.
**Spec:** ../../design.md (mục P2, D5; AC2.1, AC2.2)
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/principles/source-check.md` | mục `## Kiểm nguồn` | Task 1 |
| `plugins/backend/skills/backend-implement/SKILL.md` | trỏ tới Kiểm nguồn ở bước 0 | Task 1 |
| `plugins/frontend/skills/frontend-implement/SKILL.md` | trỏ tới Kiểm nguồn ở bước 0 | Task 1 |
| `plugins/frontend/skills/frontend-data-integration/SKILL.md` | trỏ tới Kiểm nguồn ở bước 0 | Task 1 |
| `test/content/45-source-check.pin.mjs` | pin AC2.1, AC2.2 | Task 1 |

## Global Constraints

- File UTF-8 không BOM, LF. Văn bản tiếng Việt có dấu, theo skill `engineering-writing-style`. Không chép câu chữ của agent-skills.
- Không sửa: `**/.manifest.json`, `plugins/_versions.lock.json`, `CHANGELOG.md`, `CLAUDE.md`, `docs/requests/**/design.md`, `docs/specs/**`, `description` của skill.
- Mục `## Kiểm nguồn` ≤ 15 dòng, nêu đủ 4 ý: (1) đọc phiên bản từ manifest/lockfile (`package.json` + lockfile, `pom.xml`, `build.gradle`, `pyproject.toml`/`requirements*.txt`); (2) thứ tự nguồn: docs chính thức đúng phiên bản > changelog/migration guide > source thư viện đã cài > bài viết khác; (3) API dùng lần đầu hoặc dễ đổi giữa phiên bản thì ghi deep link vào báo cáo (`agent_result.evidence` hoặc body commit), không vào comment code; (4) không có mạng hay WebFetch thì gắn `[Unverified]` cho API đó trong báo cáo và làm tiếp, không chặn.
- Câu trỏ trong SKILL.md theo mẫu: mục "Kiểm nguồn" của skill `principles` (bản cài plugin: `core:principles`).
- SKILL.md ≤ 300 dòng.
- Mỗi assert nhắc ID AC nó phủ (vd `AC3.2`) trong thông điệp, để `check-request.mjs` W7 thấy.
- Test hẹp: `node test/validate.mjs --build --only 45-source`; không chạy full suite trong part.
- Commit: `git commit -F <file>`, header tiếng Anh `type(scope): summary`, body tiếng Việt, không dòng `Co-Authored-By`.

## Review Focus

- Mục nằm trong bản build của skill `principles`, không chỉ trong nguồn: Task 1 pin đọc `build/claude/plugins/core/skills/principles/SKILL.md` (mẫu: `test/content/38-scope-discipline.pin.mjs` với `trust-boundary.md`).
- Câu trỏ nằm trong bước 0, không ở chỗ khác của file: Task 1 pin cắt đoạn từ `### 0.` tới `### 1.`.

### Task 1: reference Kiểm nguồn và ba con trỏ
**Kind:** DOCS
**Ước lượng:** 15'
**Phủ AC:** AC2.1, AC2.2
**Files:**
- Create: `core/principles/source-check.md`
- Modify: `plugins/backend/skills/backend-implement/SKILL.md`
- Modify: `plugins/frontend/skills/frontend-implement/SKILL.md`
- Modify: `plugins/frontend/skills/frontend-data-integration/SKILL.md`
- Test: `test/content/45-source-check.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** viết pin 45: bản build skill `principles` có `## Kiểm nguồn` và 4 ý (khớp các cụm `phiên bản`, `docs chính thức`, `deep link`, `[Unverified]`); đoạn `### 0.`…`### 1.` của 3 SKILL.md nguồn có `Kiểm nguồn` và `core:principles`. Chạy `node test/validate.mjs --build --only 45-source` → đỏ.
- [ ] **Step 2:** viết `core/principles/source-check.md` và thêm một gạch đầu dòng vào bước 0 của 3 SKILL.md. Chạy lại → xanh.
- [ ] **Step 3:** commit `feat(core): add source-check principle for implement skills`.
