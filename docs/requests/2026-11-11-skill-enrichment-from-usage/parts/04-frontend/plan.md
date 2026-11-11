# Part 04-frontend — Skill frontend-manual-check Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Thêm skill `frontend-manual-check`: runbook kiểm tay ánh xạ AC cho UI chưa có test tự động, kèm walkthrough khám phá bằng Playwright có luật PASS/FAIL/SKIP và luật an toàn.
**Architecture:** Một skill mới trong plugin `frontend` (draft cho tới khi session gốc thêm vào `plugins/_published.json`, D7); chi tiết dài ở `references/`. Không sửa skill khác.
**Tech Stack:** Markdown, pin Node `test/content/51-enrich-frontend.pin.mjs`.
**Spec:** ../../design.md
**Requirement:** không có

## Bản đồ file

| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/frontend/skills/frontend-manual-check/SKILL.md` | Frontmatter theo D6, `## Quy trình`, `## Ranh giới an toàn`, trỏ `references/` (≤ 300 dòng) | Task 1, Task 2 |
| `plugins/frontend/skills/frontend-manual-check/references/runbook.template.md` | Mẫu runbook: `## Điều kiện`, bảng `\| # \| Thao tác \| Kết quả mong đợi \| AC \|`, `## Kết quả đã chạy` | Task 1 |
| `plugins/frontend/skills/frontend-manual-check/references/walkthrough.md` | Walkthrough Playwright: bốn kết quả, luật an toàn, mẫu báo cáo | Task 2 |
| `test/content/51-enrich-frontend.pin.mjs` | Pin AC5.1–AC5.3 | Task 1, Task 2 |

Part không ghi `.manifest.json`, `plugins/_versions.lock.json`, `plugins/_published.json`, `test/routing/*` (kể cả `frontend-manual-check.json`), `CHANGELOG.md`, `README*.md`, `docs/specs/*`, `AGENTS.md`, `build/`: session gốc làm.

## Global Constraints

- Nội dung skill tiếng Việt có dấu, theo `engineering-writing-style`; nhãn `[Verified]`/`[Inference]`/`[Unverified]` ở chỗ nêu sự thật chưa kiểm.
- Trung lập project (D5): không tên thành phần, màn hình hay bảng của project nguồn; ví dụ khái quát. Biểu thức cấm: `cap-(core|web|ui|storage|contracts)|capcore|capstorage|content-automation|khe kho|\bV1[0-9]{2}\b|worker-(intelligence|media|content|metadata|acquisition|publishing)|tts-local|searxng|story-series|niche`.
- `description` nguyên văn D6: "Viết runbook kiểm tay ánh xạ từng AC (dữ liệu seed, bước, kết quả mong đợi) cho UI chưa có test tự động, kèm walkthrough khám phá bằng Playwright có luật PASS/FAIL/SKIP và luật an toàn. Dùng khi người dùng muốn \"viết checklist kiểm tay UI\", \"runbook kiểm tay theo AC\", \"duyệt thủ công các màn hình\", \"walkthrough UI bằng Playwright\". Không dùng khi cần viết test e2e tự động → frontend-e2e-testing; test component → frontend-testing." (≤ 500 ký tự, giữ ranh giới với `frontend-e2e-testing` và `frontend-testing`). Frontmatter theo `aip-add-content`: `name`, `description`, `order`, `title`, `runsIn`, `invoke`; thân có `## Quy trình…` và `## Ranh giới an toàn…`.
- Runbook: mỗi `AC<n>.<m>` của design xuất hiện ở ít nhất một bước; phần không chạy được ghi "chưa kiểm", không để trống.
- Walkthrough có bốn kết quả: PASS (UI đúng, không request API 4xx/5xx ngoài ý muốn, không lỗi console mới), FAIL (kèm bước tái hiện, kết quả thực, kết quả mong đợi, request lỗi), SKIP-SAFETY, SKIP-PRECOND.
- Luật an toàn: không xoá vĩnh viễn (dừng ở hộp xác nhận rồi huỷ); không nhập khoá hay mật khẩu thật; không đi theo OAuth ra ngoài localhost; không tải file; dữ liệu tạo mới có tiền tố riêng; không sửa code hay cấu hình; không đọc file bí mật. Báo cáo nêu tổng PASS/FAIL/SKIP và danh sách ID FAIL.
- `SKILL.md` ≤ 300 dòng; chi tiết dài ở `references/`.
- Commit theo `git-workflow`: header Conventional Commits tiếng Anh, thân tiếng Việt có dấu, không `Co-authored-by`.

## Review Focus

- Mẫu runbook có đủ ba phần (`## Điều kiện`, bảng bốn cột, `## Kết quả đã chạy`) và quy trình đòi mỗi AC xuất hiện ở một bước: Task 1 (pin 51 đọc tiêu đề và hàng tiêu đề bảng).
- Quy trình đòi ghi "chưa kiểm" cho phần không chạy được thay vì bỏ trống: Task 1 (pin 51).
- Cả bốn kết quả và cả sáu luật an toàn có mặt, tách rõ với e2e tự động: Task 2 (pin 51 kiểm bốn nhãn kết quả và sáu luật).
- `description` còn ≤ 500 ký tự và nêu ranh giới với `frontend-e2e-testing`, `frontend-testing`: Task 1 (pin 51; `npm run build`).
- Contract 56 và routing của skill mới thuộc bước file dùng chung của session gốc, không làm trong part: skill là draft tới lúc đó.

### Task 1: SKILL.md và mẫu runbook
**Kind:** DOCS
**TDD:** không — task tài liệu; pin 51 viết trước
**Phủ AC:** AC5.1, AC5.3
**Ước lượng:** 25'
**Files:**
- Create: `plugins/frontend/skills/frontend-manual-check/SKILL.md`
- Create: `plugins/frontend/skills/frontend-manual-check/references/runbook.template.md`
- Create: `test/content/51-enrich-frontend.pin.mjs`
- Test: `test/content/51-enrich-frontend.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `references/walkthrough.md` được `SKILL.md` trỏ tới (file do Task 2 tạo)

- [ ] **Step 1:** Tạo pin 51 với case AC5.1 (mẫu runbook có `## Điều kiện`, bảng `| # | Thao tác | Kết quả mong đợi | AC |`, `## Kết quả đã chạy`; `SKILL.md` đòi mỗi `AC<n>.<m>` ở ít nhất một bước và đòi ghi "chưa kiểm") và AC5.3 (thân ≤ 300 dòng, `description` nêu `frontend-e2e-testing` và `frontend-testing`). Chạy `npm run build` rồi `node test/validate.mjs --build --only 51-enrich-frontend`. Kết quả mong đợi: đỏ.
- [ ] **Step 2:** Viết `SKILL.md` (quy trình: đọc design/AC, dựng seed và điều kiện, viết bảng bước, chạy và ghi kết quả; trỏ `references/walkthrough.md` và `references/runbook.template.md`) và mẫu runbook. Không thêm hàng vào bảng của orchestrator (D13).
- [ ] **Step 3:** Chạy lại lệnh bước 1 cùng `--only 40-conventions --only 80-frontmatter --only 70-bytes`. Kết quả mong đợi: xanh (liên kết tới `walkthrough.md` chưa tồn tại thì pin chỉ kiểm sau Task 2; giữ liên kết dạng văn bản, không bắt contract liên kết gãy trước khi Task 2 xong).
- [ ] **Step 4:** Grep D5 ra 0 dòng. Lập bảng khẳng định → file:line → khớp|lệch cho tên skill được trỏ (`frontend-e2e-testing`, `frontend-testing`) và tên mục mẫu; sửa chỗ lệch. Commit (`feat(frontend): add frontend-manual-check skill and runbook template`).

### Task 2: Walkthrough Playwright
**Kind:** DOCS
**TDD:** không — task tài liệu; pin 51
**Phủ AC:** AC5.2
**Ước lượng:** 25'
**Files:**
- Create: `plugins/frontend/skills/frontend-manual-check/references/walkthrough.md`
- Modify: `plugins/frontend/skills/frontend-manual-check/SKILL.md`
- Test: `test/content/51-enrich-frontend.pin.mjs`

**Interfaces:**
- Consumes: `references/walkthrough.md` được trỏ từ `SKILL.md`
- Produces: không có

- [ ] **Step 1:** Thêm case AC5.2 vào pin 51: `walkthrough.md` có bốn kết quả PASS, FAIL, SKIP-SAFETY, SKIP-PRECOND kèm điều kiện của từng loại, đủ sáu luật an toàn, mẫu báo cáo nêu tổng PASS/FAIL/SKIP và danh sách ID FAIL; `SKILL.md` trỏ file này và vẫn ≤ 300 dòng. Chạy `node test/validate.mjs --build --only 51-enrich-frontend`. Kết quả mong đợi: đỏ.
- [ ] **Step 2:** Viết `walkthrough.md`; sửa `SKILL.md` chỉ ở dòng trỏ và phần tóm tắt luật an toàn trong `## Ranh giới an toàn`.
- [ ] **Step 3:** Chạy `npm run build` rồi `node test/validate.mjs --build --only 51-enrich-frontend --only 40-conventions --only 80-frontmatter`. Kết quả mong đợi: xanh, không cảnh báo "quá mốc 300".
- [ ] **Step 4:** Grep D5 ra 0 dòng. Lập bảng khẳng định → file:line → khớp|lệch cho tên công cụ và đường dẫn trong walkthrough; sửa chỗ lệch. Commit (`docs(frontend): add manual check playwright walkthrough`).
