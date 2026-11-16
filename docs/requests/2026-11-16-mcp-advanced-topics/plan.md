# Reference MCP trong backend-llm-integration Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Trạng thái:** approved — G2 duyệt 2026-11-16, chấp nhận 4 cảnh báo W7 cho AC1.3–AC1.6
**Goal:** thêm `references/mcp-llm.md` vào skill `backend-llm-integration`, một dòng liên kết ở `SKILL.md`, bump `backend` lên 1.16.0 và khoá lại version, không đổi `description`.
**Architecture:** nội dung tham chiếu docs-only; skill vẫn là recipe on-demand, reference chỉ nạp khi skill kích hoạt.
**Tech Stack:** Markdown tiếng Việt, Node 20+ (`cli/lib/versions.mjs`, `scripts/routing-score.mjs`, `test/validate.mjs`).
**Spec:** design.md
**Requirement:** requirement.md

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/backend/skills/backend-llm-integration/references/mcp-llm.md` | hướng dẫn xử lý lời gọi LLM khi backend là server MCP, theo spec 2026-07-28 | Task 1 |
| `plugins/backend/skills/backend-llm-integration/SKILL.md` | thêm đúng một dòng liên kết tới reference ở mục Tiền đề | Task 1 |
| `plugins/backend/.manifest.json` | nâng `version` lên 1.16.0 | Task 2 |
| `plugins/_versions.lock.json` | khoá version khớp bản build | Task 2 |
| `CHANGELOG.md` | một dòng Added trong `[Unreleased]` | Task 2 |

## Global Constraints
- Không đổi `description` trong frontmatter của `SKILL.md` (test `test/content/50-enrich-backend.pin.mjs` ghim nguyên văn; spec `skill-quality/R5`).
- Không chép nội dung khoá hay spec: tóm tắt bằng lời, mỗi lần trích dưới 15 từ; không hướng dẫn xác thực OAuth.
- Khẳng định chưa đọc nguồn đúng phiên bản gắn `[Unverified]`; khẳng định về Python SDK gắn v2.3.0 hoặc `[Unverified]`.
- Văn bản tiếng Việt có dấu theo `engineering-writing-style`; UTF-8 không BOM, LF.
- Commit header tiếng Anh `type(scope): summary`, body tiếng Việt, qua `core:git-workflow`; không `Co-Authored-By`; không push, không merge khi chưa được xác nhận.
- Chỉ sửa file trong `**Files:**` của task; không sửa hook, `aip-gate.json`, `policy.json`, `description` của skill.

## Review Focus
- AC nào kiểm bằng gì: AC1.1 bởi `test/contract/10-source.contract.mjs` (link `references/` phải trỏ tới file tồn tại, file mồ côi bị bắt) và `test/content/50-enrich-backend.pin.mjs` (ghim `description`); AC1.2 đến AC1.4 bởi reviewer đọc (không có hành vi chạy được để test); AC1.5 bởi `scripts/routing-score.mjs`; AC1.6 bởi `versions.mjs --lock` và `npm test`.
- Đoạn chép nguyên văn từ trang spec hoặc bài khoá: reviewer so từng câu với URL ở mục "Nguồn đã đọc" của design (Task 1, step 4).
- `description` bị đổi nhầm khi sửa `SKILL.md`: `git diff` của frontmatter rỗng và `node test/validate.mjs --only enrich-backend` xanh (Task 1, step 5).
- Ánh xạ bảy mục checklist lệch số hoặc tên: step 4 của Task 1 đối chiếu từng tên mục với `llm-call-checklist.md`.
- Điểm routing tụt dưới khoá 70/94 dù `description` không đổi: `node scripts/routing-score.mjs` (Task 2, step 3).
- Bump version quên chạy `--lock`: `npm test` đỏ ở ca khớp lock (Task 2, step 4).

### Task 1: Reference mcp-llm.md và dòng liên kết
**Kind:** DOCS
**TDD:** không — nội dung tham chiếu không có hành vi chạy được; kiểm bằng đối chiếu khẳng định và test ghim sẵn của skill.
**Ước lượng:** 25 phút
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4
**Files:**
- Create: `plugins/backend/skills/backend-llm-integration/references/mcp-llm.md`
- Modify: `plugins/backend/skills/backend-llm-integration/SKILL.md`
- Test: `test/content/50-enrich-backend.pin.mjs`
- Test: `test/contract/10-source.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: tệp `references/mcp-llm.md` mà `SKILL.md` liên kết bằng đường dẫn tương đối `references/mcp-llm.md`

- [ ] **Step 1:** Đọc `design.md` mục "Thiết kế" và "Nguồn đã đọc", `references/llm-call-checklist.md` (bảy mục) và mục "Tiền đề" của `SKILL.md`.
- [ ] **Step 2:** Viết `references/mcp-llm.md` khoảng 60 dòng, bốn phần theo design: (1) gọi thẳng nhà cung cấp, ánh xạ bảy mục checklist áp dụng trọn; (2) sampling cho đối tác bản cũ, mục nào chuyển sang client, rơi vào `degraded` khi client từ chối; (3) bảo mật tối thiểu cho server HTTP (`Origin` trả 403, bind `127.0.0.1`, một dòng nói spec yêu cầu xác thực, Roots chỉ là thông tin); (4) nhận biết đối tác bản cũ hay mới. Cuối file: bảng URL đã đọc, ngày đọc 2026-11-16, bản gốc 2026-07-28, nhãn phiên bản SDK v2.3.0, và `[Unverified]` cho cờ `stateless_http`/`json_response` ở SDK v2.
- [ ] **Step 3:** Thêm đúng một dòng vào mục `## Tiền đề` của `SKILL.md` trỏ tới `references/mcp-llm.md` (khi backend là server MCP). Không sửa frontmatter.
- [ ] **Step 4:** Đối chiếu khẳng định (bắt buộc cho task DOCS): liệt kê từng khẳng định kiểm được (tên mục checklist, tên cờ, mã 403, đường dẫn, số URL), đối chiếu với `llm-call-checklist.md` và `SKILL.md` bằng grep, và với URL nguồn khi có công cụ đọc web (không có thì gắn `[Unverified]`). Ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo; sửa mọi dòng `lệch`.
- [ ] **Step 5:** Chạy `git diff -- plugins/backend/skills/backend-llm-integration/SKILL.md` xác nhận frontmatter không đổi, rồi `node test/validate.mjs --only enrich-backend`, kết quả mong đợi `0 fail`. Commit qua `core:git-workflow`.

### Task 2: Bump version, khoá lock, kiểm routing
**Kind:** TOOLING
**TDD:** không — chỉ đổi số version và lock; kiểm bằng `versions.mjs` và `npm test`.
**Ước lượng:** 20 phút
**Phủ AC:** AC1.5, AC1.6
**Files:**
- Modify: `plugins/backend/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Modify: `CHANGELOG.md`
- Test: `test/content/50-enrich-backend.pin.mjs`

**Interfaces:**
- Consumes: tệp `references/mcp-llm.md` do Task 1 tạo
- Produces: không có

- [ ] **Step 1:** Sửa `version` trong `plugins/backend/.manifest.json` từ `1.15.3` thành `1.16.0`.
- [ ] **Step 2:** Chạy `npm run build`, rồi `node cli/lib/versions.mjs --lock`; kết quả mong đợi thoát 0 và `plugins/_versions.lock.json` có `backend` ở `1.16.0`.
- [ ] **Step 3:** Chạy `node scripts/routing-score.mjs`; kết quả mong đợi positive không dưới 70, negative không dưới 94. Dưới ngưỡng thì dừng và báo, không hạ khoá `rank1.lock.json`.
- [ ] **Step 4:** Thêm một dòng vào mục Added của `[Unreleased]` trong `CHANGELOG.md` (request `2026-11-16-mcp-advanced-topics`; backend 1.16.0), rồi chạy `npm test`, kết quả mong đợi thoát 0. Commit qua `core:git-workflow`.
