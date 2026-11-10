# Thu hẹp bốn mảng agent-skills — plan gốc

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** dữ liệu prompt routing viết mù cho mọi skill/workflow published, làm nền cho part 01. Bốn part (`parts/*/plan.md`) chạy sau plan này.
**Architecture:** session gốc trích `## Quy trình` (workflow: `## Các bước`) của từng skill, giao subagent viết prompt không thấy `description`, rồi ghi JSON vào `test/routing/`.
**Tech Stack:** Node 20+ ESM, zero-dep.
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `test/routing/<id>.json` (một file mỗi skill/workflow published) | prompt positive/negative viết mù | Task 1 |

Bump version, `plugins/_versions.lock.json`, `CHANGELOG.md`, `CLAUDE.md` làm ở bước file dùng chung sau mỗi merge part và ở bước kết thúc nhánh (`finish.md`), không phải task.

## Global Constraints

- Node thuần, không dependency. File UTF-8 không BOM, LF. Nội dung tiếng Việt có dấu.
- Định dạng file dữ liệu: `{ "positive": ["…"], "negative": ["…"] }`, ≥ 3 positive, ≥ 2 negative, tên file `<id>.json` với `<id>` là id skill hoặc workflow (vd `engineering-tdd.json`, `workflow-bugfix.json`).
- Tập chấm (D6): `offeredCatalog().plugins[].skillIds` (`cli/lib/install.mjs`) bỏ `core/principles`, cộng mọi workflow của `loadWorkflows()`; id file là tên trần sau dấu `/`. Hiện là 50 id.
- Contract 56 (part 01) kiểm số file và số câu; task này chỉ kiểm tay ở Step 3.
- Người viết prompt KHÔNG thấy `description`, KHÔNG đọc file trong repo; chỉ nhận đoạn quy trình trong prompt giao việc.
- Không sửa `description` của skill nào.

## Review Focus

- Prompt lộ nguyên văn cụm trong `description` (dấu hiệu người viết đã thấy description): Task 1 Step 3 so chuỗi.
- Skill published bị sót hoặc file thừa cho id không published: contract 56 ở part 01 (AC1.2) phủ.

### Task 1: dữ liệu routing viết mù
**Kind:** TOOLING
**TDD:** không — dữ liệu, kiểm bằng contract 56 của part 01
**Ước lượng:** 30'
**Phủ AC:** AC1.2
**Files:**
- Create: `test/routing/<id>.json` (mọi id trong tập chấm D6 của design)
- Test: `test/contract/56-routing-score.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `test/routing/<id>.json` với khoá `positive`, `negative`

- [ ] **Step 1:** liệt kê id published (dùng `offeredCatalog`/`loadCore`/`loadWorkflows` qua một lệnh `node -e` trong scratchpad), trích `## Quy trình` (workflow: tên bước + trường Hành động của `## Các bước`) của từng id vào file scratchpad, mỗi id một khối.
- [ ] **Step 2:** giao 4–5 subagent `general-purpose` (`model: sonnet`) song song, mỗi subagent một nhóm id, prompt chỉ chứa các khối quy trình, yêu cầu: không đọc file, mỗi id 3–4 positive (câu người dùng sẽ gõ để làm việc đó) và 2–3 negative (câu gần lĩnh vực mà quy trình đó không làm), trả JSON `{ "<id>": { "positive": [], "negative": [] } }`.
- [ ] **Step 3:** session gốc ghi từng `test/routing/<id>.json`; kiểm: số file = số id published, mỗi file đủ số câu, không câu nào chứa nguyên một cụm trích dẫn (trong ngoặc kép) của `description`; câu vi phạm thì giao lại subagent viết câu thay, không tự sửa.
- [ ] **Step 4:** commit `test(routing): add blind routing prompts for published skills`.
