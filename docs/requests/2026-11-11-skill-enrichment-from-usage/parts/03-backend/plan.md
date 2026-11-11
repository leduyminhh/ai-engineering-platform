# Part 03-backend — Checklist robustness và skill gọi LLM Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Thêm checklist robustness dùng chung cho `backend-implement` và `backend-code-review` (qua `sharedAssets`), và skill `backend-llm-integration`.
**Architecture:** Một file checklist ở `plugins/backend/templates/robustness/` ship vào skill bằng cơ chế `sharedAssets` đang dùng cho `templates/architecture` (D11); skill mới theo D6, draft cho tới khi session gốc thêm vào `plugins/_published.json` (D7).
**Tech Stack:** Markdown, frontmatter `sharedAssets`, pin Node `test/content/50-enrich-backend.pin.mjs` (có kiểm build output).
**Spec:** ../../design.md
**Requirement:** không có

## Bản đồ file

| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/backend/templates/robustness/robustness-checklist.md` | Checklist 5 nhóm, mỗi nhóm 2–4 dòng checkbox kèm cách kiểm; trỏ phần đã có thay vì chép | Task 1 |
| `plugins/backend/skills/backend-implement/SKILL.md` | Khai `sharedAssets` thêm `templates/robustness`; trỏ checklist ở bước đầu `## Quy trình` (≤ 300 dòng, hiện 99) | Task 2 |
| `plugins/backend/skills/backend-code-review/SKILL.md` | Khai `sharedAssets` thêm `templates/robustness`; trỏ checklist ở Trục 1 hoặc bước đầu quy trình (≤ 300 dòng, hiện 148) | Task 2 |
| `plugins/backend/skills/backend-code-review/references/review-dimensions.md` | Một dòng ở Trục 1 nếu hợp hơn đặt trong `SKILL.md` | Task 2 |
| `plugins/backend/skills/backend-implement/references/checklist.md` | Một dòng trỏ nếu hợp hơn đặt trong `SKILL.md` | Task 2 |
| `plugins/backend/skills/backend-llm-integration/SKILL.md` | Skill mới theo D6 | Task 3 |
| `plugins/backend/skills/backend-llm-integration/references/` | Chi tiết 7 mục khi cần giữ thân < 300 dòng | Task 3 |
| `test/content/50-enrich-backend.pin.mjs` | Pin AC4.1–AC4.3, gồm kiểm file checklist nằm cạnh hai skill trong `build/claude/` | Task 1–Task 3 |

Part không ghi `.manifest.json`, `plugins/_versions.lock.json`, `plugins/_published.json`, `test/routing/*`, `CHANGELOG.md`, `README*.md`, `docs/specs/*`, `AGENTS.md`, `build/`: session gốc làm.

## Global Constraints

- Nội dung skill tiếng Việt có dấu, theo `engineering-writing-style`; nhãn `[Verified]`/`[Inference]`/`[Unverified]` ở chỗ nêu sự thật chưa kiểm.
- Trung lập project (D5): nội dung ở mức khái quát (tên nhóm kiểm, không tên thư viện, không tên thành phần hay bảng của project nguồn). Biểu thức cấm: `cap-(core|web|ui|storage|contracts)|capcore|capstorage|content-automation|khe kho|\bV1[0-9]{2}\b|worker-(intelligence|media|content|metadata|acquisition|publishing)|tts-local|searxng|story-series|niche`.
- Checklist đúng 5 nhóm: chặn kích thước input (body, mảng, chuỗi, số trang); che secret trong log và thông báo lỗi; idempotency (khoá, lặp lại, retry); race và CAS (đọc rồi ghi, cập nhật có điều kiện); việc mồ côi sau lỗi (bản ghi dở, tài nguyên chưa dọn); mỗi nhóm 2–4 dòng checkbox kèm cách kiểm.
- Skill `backend-llm-integration` phủ 7 mục: ngân sách theo ngày (đặt chỗ trước khi gọi, cạn thì hạ cấp, không gọi); backoff (luỹ thừa có jitter, chặn trên bằng ngân sách thời gian của job, lỗi 4xx không retry); fail-soft có đánh dấu (kết quả thay thế mang cờ `degraded` và dòng log có lý do; có cờ biến lỗi nhà cung cấp thành thất bại cứng; hoàn tất job không chứng minh lời gọi thật đã chạy); ghi usage (chỉ token, mỗi lời gọi); redact output trước khi log hay lưu; hash input thay vì lưu nguyên prompt; prompt dự phòng khi lời gọi lỗi; khoá nhà cung cấp không vào log, lỗi hay prompt.
- `description` nguyên văn D6: "Thêm hoặc rà tính năng backend gọi LLM: ngân sách theo ngày, backoff, fail-soft có đánh dấu, ghi usage, redact output, hash input, prompt dự phòng. Dùng khi người dùng muốn \"thêm tính năng gọi LLM\", \"gọi model AI từ backend\", \"ngân sách token theo ngày\", \"fail-soft khi LLM lỗi\", \"ghi usage gọi LLM\". Không dùng khi code slice thường không gọi LLM → backend-implement; review diff tổng quát → backend-code-review." (≤ 500 ký tự). Frontmatter theo `aip-add-content`: `name`, `description`, `order`, `title`, `runsIn`, `invoke`; thân có `## Quy trình…` và `## Ranh giới an toàn…`.
- `SKILL.md` bị sửa hoặc thêm ≤ 300 dòng; chi tiết dài ở `references/`. Một file checklist, hai skill trỏ, không chép nội dung vào cả hai (D11).
- Không đổi bảng "Dấu hiệu đang tự biện minh" của `backend-code-review` ngoài 4–6 dòng (pin 47).
- Commit theo `git-workflow`: header Conventional Commits tiếng Anh, thân tiếng Việt có dấu, không `Co-authored-by`.

## Review Focus

- Checklist có đúng 5 nhóm và mỗi nhóm 2–4 checkbox kèm cách kiểm: Task 1 (pin 50 đếm nhóm và checkbox).
- `sharedAssets` của hai skill chứa `templates/robustness` và file checklist nằm cạnh cả hai trong `build/claude/` sau build: Task 2 (pin 50 đọc build output).
- Quy trình skill LLM phủ đủ 7 mục và không nhắc tên nhà cung cấp hay thư viện cụ thể: Task 3 (pin 50 kiểm bảy chủ đề; grep D5 tay).
- Thân `backend-implement` và `backend-code-review` còn ≤ 300 dòng sau khi thêm dòng trỏ: Task 2 (pin 50).
- Pin cũ chạm hai skill (02, 05, 11, 15, 31, 32, 45, 47) không đỏ mới: Task 2 (`--only` các pin này).

### Task 1: Checklist robustness
**Kind:** DOCS
**TDD:** không — task tài liệu; pin 50 viết trước
**Phủ AC:** AC4.1
**Ước lượng:** 20'
**Files:**
- Create: `plugins/backend/templates/robustness/robustness-checklist.md`
- Create: `test/content/50-enrich-backend.pin.mjs`
- Test: `test/content/50-enrich-backend.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Tạo pin 50 với case AC4.1: file checklist có đúng 5 nhóm (tiêu đề nhóm theo Global Constraints), mỗi nhóm 2–4 dòng checkbox `- [ ]` kèm cách kiểm. Chạy `node test/validate.mjs --build --only 50-enrich-backend`. Kết quả mong đợi: đỏ.
- [ ] **Step 2:** Viết checklist; nhóm race và idempotency trỏ `review-dimensions.md` và `use-case-intake.md` thay vì chép (đã có nhắc rải rác).
- [ ] **Step 3:** Chạy lại lệnh bước 1. Kết quả mong đợi: xanh.
- [ ] **Step 4:** Lập bảng khẳng định → file:line → khớp|lệch cho các đường dẫn file được trỏ; grep D5 ra 0 dòng. Commit (`docs(backend): add robustness checklist`).

### Task 2: Nối checklist vào backend-implement và backend-code-review
**Kind:** DOCS
**TDD:** không — task tài liệu; pin 50 kiểm frontmatter và build output
**Phủ AC:** AC4.2
**Ước lượng:** 25'
**Files:**
- Modify: `plugins/backend/skills/backend-implement/SKILL.md`
- Modify: `plugins/backend/skills/backend-code-review/SKILL.md`
- Modify: `plugins/backend/skills/backend-implement/references/checklist.md`
- Modify: `plugins/backend/skills/backend-code-review/references/review-dimensions.md`
- Test: `test/content/50-enrich-backend.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Thêm case AC4.2 vào pin 50: `sharedAssets` của cả hai skill chứa `templates/robustness` (giữ `templates/architecture`); cả hai trỏ tới checklist ở bước đầu `## Quy trình` hoặc Trục 1; thân cả hai ≤ 300 dòng; sau `npm run build`, file checklist nằm cạnh cả hai skill trong `build/claude/`. Chạy `npm run build` rồi `node test/validate.mjs --build --only 50-enrich-backend`. Kết quả mong đợi: đỏ.
- [ ] **Step 2:** Sửa frontmatter `sharedAssets` (danh sách phân tách như cách `plugins.mjs` đọc) và thêm dòng trỏ ở mỗi skill; dòng phụ ở `checklist.md` hoặc `review-dimensions.md` chỉ khi hợp hơn đặt trong `SKILL.md`.
- [ ] **Step 3:** Chạy `npm run build` rồi `node test/validate.mjs --build --only 50-enrich-backend --only 02-p0-fixes --only 05-review-perf --only 11-db-change --only 15-workflow-pruning --only 32-superpowers-gap --only 45-source-check --only 47-rationalization-tables --only 20-build`. Kết quả mong đợi: xanh.
- [ ] **Step 4:** Lập bảng khẳng định → file:line → khớp|lệch cho đường dẫn `templates/robustness` và tên Trục 1; sửa chỗ lệch. Commit (`docs(backend): link robustness checklist from implement and review`).

### Task 3: Skill backend-llm-integration
**Kind:** DOCS
**TDD:** không — task tài liệu; pin 50
**Phủ AC:** AC4.3
**Ước lượng:** 30'
**Files:**
- Create: `plugins/backend/skills/backend-llm-integration/SKILL.md`
- Create: `plugins/backend/skills/backend-llm-integration/references/llm-call-checklist.md`
- Test: `test/content/50-enrich-backend.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Thêm case AC4.3 vào pin 50: frontmatter và `description` nguyên văn D6; thân có `## Quy trình` và `## Ranh giới an toàn`; quy trình phủ 7 chủ đề (ngân sách theo ngày, backoff, fail-soft có đánh dấu, ghi usage, redact output, hash input, prompt dự phòng) và câu khoá nhà cung cấp không vào log, lỗi hay prompt; thân ≤ 300 dòng. Chạy `node test/validate.mjs --build --only 50-enrich-backend`. Kết quả mong đợi: đỏ.
- [ ] **Step 2:** Viết `SKILL.md` (bám khuôn skill cùng plugin) và `references/llm-call-checklist.md` cho phần chi tiết mỗi mục; không thêm hàng vào bảng của orchestrator (D13). Skill mới ở trạng thái draft cho tới khi `plugins/_published.json` có `backend/backend-llm-integration` (session gốc, plan gốc).
- [ ] **Step 3:** Chạy `npm run build` rồi `node test/validate.mjs --build --only 50-enrich-backend --only 40-conventions --only 80-frontmatter --only 70-bytes`. Kết quả mong đợi: xanh, không cảnh báo "quá mốc 300".
- [ ] **Step 4:** Grep D5 trên hai file mới ra 0 dòng. Lập bảng khẳng định → file:line → khớp|lệch cho tên skill được trỏ (`backend-implement`, `backend-code-review`) và đường dẫn `references/`; sửa chỗ lệch. Commit (`feat(backend): add backend-llm-integration skill`).
