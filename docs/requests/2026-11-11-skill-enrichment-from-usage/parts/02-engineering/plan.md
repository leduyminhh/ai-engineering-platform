# Part 02-engineering — Kiểm plan, spec, docs và skill nghiên cứu API Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Siết `engineering-plan-writing` (file test/fixture đếm số, bước kiểm khẳng định cho task `DOCS`), `engineering-spec-writing` (kiểm AC mâu thuẫn) và thêm skill `engineering-api-research`.
**Architecture:** Markdown skill và `references/` của plugin `engineering`; skill mới theo D6; pin riêng của part.
**Tech Stack:** Markdown, pin Node `test/content/49-enrich-engineering.pin.mjs`.
**Spec:** ../../design.md
**Requirement:** không có

## Bản đồ file

| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/engineering/skills/engineering-plan-writing/references/self-review.md` | Mục 6 "Files đủ" thêm vế test/fixture/cấu hình đếm số; mục 2 nhắc bảng khẳng định cho task `DOCS`; vẫn đúng 6 mục | Task 1 |
| `plugins/engineering/skills/engineering-plan-writing/references/plan-structure.md` | Kind `DOCS`: step bắt buộc đối chiếu khẳng định với code, bảng `khẳng định → file:line → khớp\|lệch` | Task 1 |
| `plugins/engineering/skills/engineering-spec-writing/SKILL.md` | Bước 10: kiểm cặp AC cùng đối tượng và đối chiếu AC với "Quyết định đã chốt" và `brief.md` (≤ 300 dòng, hiện 184) | Task 2 |
| `plugins/engineering/skills/engineering-spec-writing/references/checklist.md` | Mục kiểm AC tương ứng | Task 2 |
| `plugins/engineering/skills/engineering-api-research/SKILL.md` | Skill mới theo D6: `## Quy trình`, `## Ranh giới an toàn` | Task 3 |
| `plugins/engineering/skills/engineering-api-research/references/facts.template.md` | Mẫu file facts: nhãn, nguồn, URL sau chuyển hướng, ngày đọc, lệnh chạy lại | Task 3 |
| `test/content/49-enrich-engineering.pin.mjs` | Pin AC3.1–AC3.4 | Task 1–Task 3 |

Part không ghi `.manifest.json`, `plugins/_versions.lock.json`, `plugins/_published.json`, `test/routing/*` (kể cả `engineering-api-research.json`), `CHANGELOG.md`, `README*.md`, `docs/specs/*`, `AGENTS.md`, `build/`: session gốc làm.

## Global Constraints

- Nội dung skill tiếng Việt có dấu, theo `engineering-writing-style`; nhãn `[Verified]`/`[Inference]`/`[Unverified]` ở chỗ nêu sự thật chưa kiểm.
- Trung lập project (D5): ví dụ khái quát ("test đếm số rule", "migration số tuần tự"), không tên thành phần, bảng hay số phiên bản của project nguồn. Biểu thức cấm: `cap-(core|web|ui|storage|contracts)|capcore|capstorage|content-automation|khe kho|\bV1[0-9]{2}\b|worker-(intelligence|media|content|metadata|acquisition|publishing)|tts-local|searxng|story-series|niche`.
- `SKILL.md` bị sửa hoặc thêm ≤ 300 dòng; chi tiết dài ở `references/`.
- `self-review.md` giữ đúng 6 mục đánh số; không thêm mục 7 (nhiều file và pin đếm "6 mục").
- Frontmatter skill mới theo `aip-add-content`: `name`, `description`, `order`, `title`, `runsIn`, `invoke`; thân có `## Quy trình…` và `## Ranh giới an toàn…`; `description` nguyên văn D6: "Nghiên cứu API hoặc dịch vụ ngoài, hoặc làm spike kỹ thuật nhỏ, rồi ghi file facts mỗi khẳng định có nhãn [Verified]/[Inference]/[Unverified] kèm nguồn và ngày đọc. Dùng khi người dùng muốn \"tìm hiểu API của dịch vụ ngoài\", \"đọc docs rồi ghi lại sự thật\", \"spike thử thư viện\", \"lập file facts\". Không dùng khi cần viết spec yêu cầu → engineering-spec-writing; ghi quyết định chọn phương án → engineering-adr." (≤ 500 ký tự, không trùng nguyên văn cụm "Dùng khi" của skill cũ).
- Không đổi `check-request.mjs`, template plan, prompt của core, skill cũ khác.
- Commit theo `git-workflow`: header Conventional Commits tiếng Anh, thân tiếng Việt có dấu, không `Co-authored-by`.

## Review Focus

- `self-review.md` vẫn có đúng 6 mục đánh số sau khi thêm vế vào mục 6 và mục 2: Task 1 (pin 49 đếm mục đánh số; pin 43 giữ).
- Vế mới của mục 6 nêu cách tìm bằng grep trên giá trị cũ (không chỉ nói "kiểm test"): Task 1 (pin 49).
- Skill mới không dính tên riêng project nguồn và không nhắc khoá thật trong file facts mẫu: Task 3 (`--only 57-skill-neutral` khi contract có, và grep D5 tay).
- `description` skill mới còn ≤ 500 ký tự và không trùng cụm của skill cũ: Task 3 (`npm run build`; `node scripts/routing-score.mjs` chạy ở bước file dùng chung của session gốc, [Unverified] tới lúc đó).
- Contract 56 đỏ trên nhánh part này (thiếu `test/routing/engineering-api-research.json`) là bình thường, không sửa trong part.

### Task 1: Kiểm Files đủ và khẳng định của task DOCS
**Kind:** DOCS
**TDD:** không — task tài liệu; pin 49 viết trước
**Phủ AC:** AC3.1, AC3.3
**Ước lượng:** 25'
**Files:**
- Modify: `plugins/engineering/skills/engineering-plan-writing/references/self-review.md`
- Modify: `plugins/engineering/skills/engineering-plan-writing/references/plan-structure.md`
- Create: `test/content/49-enrich-engineering.pin.mjs`
- Test: `test/content/49-enrich-engineering.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Tạo pin 49 với case AC3.1 (mục 6 "Files đủ" có vế: file test, fixture, cấu hình hoặc catalog khẳng định số đếm hay hằng mà task đổi phải nằm trong `**Files:**`, tìm bằng grep trên giá trị cũ; `self-review.md` còn đúng 6 mục đánh số) và AC3.3 (`plan-structure.md` kind `DOCS` có step bắt buộc: liệt kê khẳng định kiểm được, đối chiếu code bằng grep hoặc đọc, bảng `khẳng định → file:line → khớp|lệch`, lệch thì sửa docs hoặc gắn `[Unverified]`; mục 2 của `self-review.md` nhắc bước này). Chạy `npm run build` rồi `node test/validate.mjs --build --only 49-enrich-engineering`. Kết quả mong đợi: đỏ.
- [ ] **Step 2:** Sửa `self-review.md` (vế vào mục 6, một câu vào mục 2) và `plan-structure.md` (kind `DOCS`).
- [ ] **Step 3:** Chạy lại lệnh bước 1 (xanh) và `node test/validate.mjs --build --only 43-progress-plan-quality --only 31-workflow-self-sufficient --only 33-request-parts`. Pin cũ đỏ thì sửa vế đúng hành vi mới và ghi `Ruling:`, không xoá phép kiểm còn đúng.
- [ ] **Step 4:** Lập bảng khẳng định → file:line → khớp|lệch cho số mục, tên mục, đường dẫn trong phần vừa viết; sửa chỗ lệch. Commit (`docs(engineering): tighten plan files check and docs claims check`).

### Task 2: Kiểm AC mâu thuẫn trong spec-writing
**Kind:** DOCS
**TDD:** không — task tài liệu; pin 49
**Phủ AC:** AC3.2
**Ước lượng:** 20'
**Files:**
- Modify: `plugins/engineering/skills/engineering-spec-writing/SKILL.md`
- Modify: `plugins/engineering/skills/engineering-spec-writing/references/checklist.md`
- Test: `test/content/49-enrich-engineering.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Thêm case AC3.2 vào pin 49: bước 10 của `SKILL.md` và `checklist.md` có mục kiểm AC (lập cặp AC cùng đối tượng — trạng thái, ngưỡng, mã lỗi, thứ tự; đối chiếu mỗi AC với "Quyết định đã chốt" và `brief.md` nếu có; lệch thì sửa hoặc đưa vào câu hỏi mở trước checkpoint); thân `SKILL.md` ≤ 300 dòng. Chạy `node test/validate.mjs --build --only 49-enrich-engineering`. Kết quả mong đợi: đỏ.
- [ ] **Step 2:** Viết vào bước 10 một dòng trỏ checklist và thêm mục kiểm vào `checklist.md` (không nhân đôi nội dung giữa hai file).
- [ ] **Step 3:** Chạy `node test/validate.mjs --build --only 49-enrich-engineering --only 43-progress-plan-quality --only 38-scope-discipline --only 06-workflow-fixes`. Kết quả mong đợi: xanh.
- [ ] **Step 4:** Lập bảng khẳng định → file:line → khớp|lệch cho số bước, tên mục "Quyết định đã chốt", tên file; sửa chỗ lệch. Commit (`docs(engineering): add AC contradiction check to spec writing`).

### Task 3: Skill engineering-api-research
**Kind:** DOCS
**TDD:** không — task tài liệu; pin 49
**Phủ AC:** AC3.4
**Ước lượng:** 30'
**Files:**
- Create: `plugins/engineering/skills/engineering-api-research/SKILL.md`
- Create: `plugins/engineering/skills/engineering-api-research/references/facts.template.md`
- Test: `test/content/49-enrich-engineering.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Thêm case AC3.4 vào pin 49: skill có frontmatter đúng D6 và `description` nguyên văn; thân có `## Quy trình` và `## Ranh giới an toàn`; quy trình phủ: chốt câu hỏi cần trả lời, đọc docs chính thức đúng phiên bản theo mục "Kiểm nguồn" của skill `principles` (bản cài plugin: `core:principles`), spike nhỏ chạy được kèm lệnh chạy lại, ghi file facts với `[Verified]` (nguồn, URL sau chuyển hướng, ngày đọc), `[Inference]`, `[Unverified]` cho từng khẳng định; ranh giới: không gọi API tính tiền hay ghi dữ liệu thật khi chưa được duyệt, không đưa khoá thật vào file facts; `references/facts.template.md` tồn tại; thân ≤ 300 dòng. Chạy `node test/validate.mjs --build --only 49-enrich-engineering`. Kết quả mong đợi: đỏ.
- [ ] **Step 2:** Viết `SKILL.md` (frontmatter bám skill cùng plugin, ví dụ `engineering-spec-writing`) và `references/facts.template.md` (cột: khẳng định, nhãn, nguồn, URL sau chuyển hướng, ngày đọc, lệnh chạy lại). Không thêm hàng vào bảng "Yêu cầu chạy trực tiếp bằng skill" của orchestrator (D13).
- [ ] **Step 3:** Chạy `npm run build` rồi `node test/validate.mjs --build --only 49-enrich-engineering --only 40-conventions --only 80-frontmatter --only 70-bytes`. Kết quả mong đợi: xanh, không cảnh báo "quá mốc 300". Contract 56 đỏ vì thiếu file routing là bình thường (session gốc xử lý).
- [ ] **Step 4:** Chạy grep biểu thức D5 trên hai file mới: ra 0 dòng. Lập bảng khẳng định → file:line → khớp|lệch cho tên skill được trỏ (`engineering-spec-writing`, `engineering-adr`, `core:principles`) và tên mục "Kiểm nguồn"; sửa chỗ lệch. Commit (`feat(engineering): add engineering-api-research skill`).
