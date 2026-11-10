# Part 03 — template quality bar và guard trong review package

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** có template quality bar; `review-package.mjs` liệt kê trong `## Dấu hiệu nới kiểm` mọi chỗ `project-knowledge/quality-bar.md` bị nới giữa base..head.
**Architecture:** template ở `artifact-templates/references/` (ngoài `references/project-knowledge/` để `aip init --full` không chép); hàm thuần `qualityBarLoosening` + nối vào `buildPackage`.
**Tech Stack:** Node 20+ ESM, zero-dep.
**Spec:** ../../design.md (mục P3, D4; AC3.1–AC3.3)
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/skills/artifact-templates/references/quality-bar.template.md` | template quality bar | Task 1 |
| `core/skills/artifact-templates/SKILL.md` | hàng mục lục `quality-bar` | Task 1 |
| `test/contract/35-artifact-templates.contract.mjs` | `TYPES` 14 loại, pin heading template | Task 1 |
| `core/skills/plan-execution/scripts/review-package.mjs` | `qualityBarLoosening`, nối vào `buildPackage` | Task 2 |
| `test/content/46-quality-bar.pin.mjs` | AC3.1 (vị trí template), AC3.2, AC3.3 | Task 1, Task 2 |

## Global Constraints

- Node thuần, không dependency. File UTF-8 không BOM, LF. Văn bản tiếng Việt có dấu. Comment theo mục Comments của `AGENTS.md`.
- Không sửa: `**/.manifest.json`, `plugins/_versions.lock.json`, `CHANGELOG.md`, `CLAUDE.md`, `docs/requests/**/design.md`, `docs/specs/**`.
- Template: header `<!-- artifact-template` với `type: quality-bar`, `version: 1`, `validator: chưa có`, `sources:`; `## Lệnh kiểm` bảng `| Lệnh | Ngưỡng | Owner |` (Ngưỡng dạng `exit 0`, `<chỉ số> >= <số>` hoặc `<chỉ số> <= <số>`); `## Ngoại lệ` bảng `| Ngoại lệ | Lý do | Owner | Hạn |` (`Hạn` dạng `yyyy-mm-dd`, bắt buộc); một dòng: sửa file này đi qua review như code, mọi nới hiện ở review package.
- Đường dẫn được so: đúng `project-knowledge/quality-bar.md` (tương đối gốc repo).
- "Nới" = bỏ lệnh kiểm (ô đầu bảng Lệnh kiểm, bỏ backtick, có ở base mà không có ở head); thêm ngoại lệ (ô đầu bảng Ngoại lệ mới); gia hạn (cùng ngoại lệ, `Hạn` muộn hơn); ngưỡng `>=` bị hạ hoặc `<=` bị nâng. Ô `Ngưỡng` đổi mà không đọc được hướng → "đổi ngưỡng, cần xét". Không báo: thêm lệnh kiểm, siết ngưỡng, bỏ ngoại lệ, rút hạn.
- Dòng báo bắt đầu `- project-knowledge/quality-bar.md: ` rồi một trong: `bỏ lệnh kiểm <lệnh>`, `thêm ngoại lệ <tên>`, `gia hạn ngoại lệ <tên>: <cũ> → <mới>`, `ngưỡng nới <lệnh>: <cũ> → <mới>`, `đổi ngưỡng, cần xét <lệnh>: <cũ> → <mới>`.
- `git show <ref>:project-knowledge/quality-bar.md` lỗi (file không có ở ref) → chuỗi rỗng, `buildPackage` không ném. Không đổi `findWeakening`.
- Mỗi assert nhắc ID AC nó phủ (vd `AC3.2`) trong thông điệp, để `check-request.mjs` W7 thấy.
- Test hẹp: `node test/validate.mjs --build --only 35-artifact` và `--only 46-quality`; không chạy full suite trong part.
- Commit: `git commit -F <file>`, header tiếng Anh `type(scope): summary`, body tiếng Việt, không dòng `Co-Authored-By`.

## Review Focus

- Bảng Markdown có dòng thừa khoảng trắng hoặc ô có backtick: Task 2 bảng tham số có ca ô `` `npm test` `` so với `npm test`.
- File bị xoá ở head: Task 2 ca "mọi lệnh kiểm cũ thành dòng bỏ lệnh kiểm".
- File chưa có ở base: Task 2 ca `run` giả ném ở `show` của base → không báo, không ném.
- Template chép sang project đích vẫn qua `qualityBarLoosening` không lỗi: Task 2 ca so template với chính nó → 0 dòng.

### Task 1: template quality bar và mục lục
**Kind:** TOOLING
**TDD:** không — template, kiểm bằng contract 35 và pin 46
**Ước lượng:** 15'
**Phủ AC:** AC3.1
**Files:**
- Create: `core/skills/artifact-templates/references/quality-bar.template.md`
- Modify: `core/skills/artifact-templates/SKILL.md`
- Modify: `test/contract/35-artifact-templates.contract.mjs`
- Create: `test/content/46-quality-bar.pin.mjs`
- Test: `test/contract/35-artifact-templates.contract.mjs`, `test/content/46-quality-bar.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `core/skills/artifact-templates/references/quality-bar.template.md`

- [ ] **Step 1:** contract 35: thêm `quality-bar` vào `TYPES`, sửa câu "13 loại" thành 14; pin heading `## Lệnh kiểm`, `## Ngoại lệ` và hai dòng header bảng. Pin 46 (AC3.1): template không nằm dưới `references/project-knowledge/`. Chạy `--only 35-artifact` và `--only 46-quality` → đỏ.
- [ ] **Step 2:** viết template và hàng mục lục (`| quality-bar | [quality-bar.template.md](references/quality-bar.template.md) | chưa có | <nguồn> |`, cột Nguồn ghi design của request này). Chạy lại → xanh.
- [ ] **Step 3:** commit `feat(core): add quality bar template`.

### Task 2: review package báo nới quality bar
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25'
**Phủ AC:** AC3.2, AC3.3
**Files:**
- Modify: `core/skills/plan-execution/scripts/review-package.mjs`
- Modify: `test/content/46-quality-bar.pin.mjs`
- Test: `test/content/46-quality-bar.pin.mjs`

**Interfaces:**
- Consumes: `core/skills/artifact-templates/references/quality-bar.template.md`
- Produces: `qualityBarLoosening(oldText, newText)` (export từ `review-package.mjs`)

- [ ] **Step 1:** pin 46: bảng tham số cho `qualityBarLoosening` (mỗi loại nới một ca có dòng báo đúng định dạng; mỗi loại không nới một ca rỗng; ca ô có backtick; template so với chính nó → rỗng); `buildPackage` với `run` giả trả output cho `merge-base`, `diff -U10`, `log`, `diff --stat`, `diff --name-only`, `show` → mục `## Dấu hiệu nới kiểm` chứa dòng mong đợi; ca `show` của base ném → không báo, không ném; ca `show` của head ném (file bị xoá) → mỗi lệnh kiểm cũ một dòng `bỏ lệnh kiểm`. Chạy `--only 46-quality` → đỏ.
- [ ] **Step 2:** cài `qualityBarLoosening` và nối vào `buildPackage` (gọi `diff --name-only <range>`; chỉ đọc hai bản khi danh sách có đúng đường dẫn đó); cập nhật comment đầu file nêu thêm quality bar. Chạy lại → xanh; chạy thêm `--only 31-workflow` (pin cũ của `findWeakening`) → xanh.
- [ ] **Step 3:** commit `feat(core): flag loosened quality bar in review package`.
