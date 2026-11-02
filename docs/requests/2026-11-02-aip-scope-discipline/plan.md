# aip-scope-discipline Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Nâng ba phần "Làm rõ", "Spec / AC", "Gọn / đúng phạm vi" của lượt chấm E2E lên ≥ 9: rà ca biên bám code, AC có khối `calc:` được `check-request.mjs` tính lại (W22), session chính nhận review theo phạm vi AC và ranh giới tin cậy.
**Architecture:** Một hàm tính số học thuần trong `check-request.mjs`; còn lại là câu chữ skill/prompt (`clarify-core.md`, `engineering-spec-writing`, `plan-execution`, một file nguyên tắc mới trong `core/principles/`), 3 eval case và một lượt E2E chấm bằng oracle.
**Tech Stack:** Node 20+, ESM, zero-dependency; nội dung skill tiếng Việt.
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/skills/artifact-templates/scripts/check-request.mjs` | `evalCalc` + cảnh báo W22 | Task 1 |
| `core/skills/artifact-templates/references/requirement.template.md` | dòng hướng dẫn `calc:` ở mục AC | Task 1 |
| `core/skills/artifact-templates/references/design.template.md` | dòng hướng dẫn `calc:` ở mục AC | Task 1 |
| `core/skills/artifact-templates/SKILL.md` | mục lục cảnh báo thêm W22 | Task 1 |
| `test/contract/35-artifact-templates.contract.mjs` | test `evalCalc`, W22 | Task 1 |
| `plugins/engineering/skills/engineering-spec-writing/SKILL.md` | quy tắc AC nêu kết quả số kèm `calc:` | Task 2 |
| `plugins/engineering/skills/engineering-spec-writing/references/checklist.md` | mục kiểm `calc:` | Task 2 |
| `plugins/engineering/skills/engineering-spec-writing/references/builder-check.md` | chạy `check-request.mjs`, W22 sửa thẳng; tính năng cắt bớt là câu hỏi người dùng | Task 2 |
| `plugins/engineering/agents/engineering-spec-analyst.md` | quy tắc `calc:` cho agent ghi tài liệu | Task 2 |
| `core/skills/brainstorming/references/clarify-core.md` | mục "Rà ca biên" | Task 3 |
| `core/principles/trust-boundary.md` | quy tắc ranh giới tin cậy (một đoạn) | Task 4 |
| `core/skills/plan-execution/references/task-loop.md` | mục "Nhận review", định nghĩa `review clean` trong phạm vi | Task 4 |
| `core/skills/plan-execution/references/prompts/task-review.md` | trỏ `trust-boundary.md`, gắn nhãn trong/ngoài AC | Task 4 |
| `core/skills/plan-execution/references/prompts/final-review.md` | quy tắc 7 mở rộng; trỏ `trust-boundary.md` | Task 4 |
| `core/skills/plan-execution/references/finish.md` | thẻ G3 liệt kê finding ngoài AC; "làm" → follow-up | Task 4 |
| `plugins/engineering/agents/engineering-quality-auditor.md` | trỏ `trust-boundary.md` | Task 4 |
| `test/content/38-scope-discipline.pin.mjs` | pin câu quy tắc của Task 2–4 | Task 2, 3, 4 |
| `evals/core/brainstorm-reads-code-first/` | eval AC1.2 | Task 5 |
| `evals/engineering/spec-ac-calc/` | eval AC2.4 | Task 5 |
| `evals/workflows/review-out-of-scope/` | eval AC3.5 | Task 5 |
| `evals/README.md`, `evals/README_VI.md` | bảng case | Task 5 |
| `core/.manifest.json`, `plugins/engineering/.manifest.json`, `plugins/_versions.lock.json`, `CHANGELOG.md` | bump + lock | Task 6 |
| `docs/requests/2026-11-02-aip-scope-discipline/trial-7.md` | kết quả eval mới + E2E + điểm theo rubric | Task 7 |

## Global Constraints
- Khối calc: `` `calc: <biểu thức> = <kết quả>` `` trong backtick; biểu thức chỉ gồm số (thập phân dùng `.`), `+ - * / %`, ngoặc, hàm `floor`, `ceil`, `round`, `min`, `max`, `abs`; tách kết quả ở dấu `=` cuối cùng. Không `eval`, không `Function`.
- W22 chỉ kiểm khối `calc:` có mặt trong `requirement.md`, `design.md`, `parts/*/design.md`; không cảnh báo AC thiếu `calc:`.
- 5 nhóm ca biên nguyên văn: làm tròn; biên dưới/trên (không âm, trần); đầu vào rỗng; mốc thời gian (bao gồm hay loại trừ); đếm đồng thời.
- Ba nhóm khi nhận review nguyên văn: **trong phạm vi** (vi phạm AC hay tiêu chí đã duyệt, lỗi đúng/sai với đầu vào hợp lệ của chính tính năng, test sai, lỗ hổng bảo mật ở ranh giới tin cậy) → sửa; **ngoài AC, không đổi hành vi** → `minor (deferred)` hoặc `Ruling:` giữ mức gốc, không sửa; **ngoài AC, đổi hành vi hoặc API** → thẻ G3, "làm" thành follow-up. `Ruling:` không được thêm hành vi không có trong AC. `review clean` = không còn blocker/major mở **trong phạm vi**.
- Ranh giới tin cậy: dữ liệu do code hoặc cấu hình nội bộ của repo khai báo không phải ranh giới tin cậy; finding kiểm đầu vào cho dữ liệu đó tối đa `minor`.
- Eval case không cấp Bash. Chi phí model của Task 7 ≤ $15 (người dùng duyệt ~$10); vượt thì dừng hỏi.
- Bump `core` và `engineering` (workflows không đổi nội dung), `node cli/lib/versions.mjs --lock`, `npm test` xanh. Câu chữ tiếng Việt có dấu, file UTF-8 không BOM, LF. Header commit tiếng Anh, body tiếng Việt, không `Co-Authored-By`.
- Spec sống (`workflows/R16`, `workflows/R17`, `artifact-templates/R13`) cập nhật ở bước kết thúc nhánh theo `## Ảnh hưởng spec`.

## Review Focus
- `evalCalc`: thứ tự ưu tiên, dấu trừ một ngôi, ngoặc lồng, chia ra số lẻ so với kết quả (so sánh sai số 1e-9) — test có tham số ở Task 1.
- Khối có nhiều dấu `=` hoặc kết quả có dấu phẩy hàng nghìn: tách ở `=` cuối; kết quả không phải số → W22 "biểu thức không hợp lệ" — test ở Task 1.
- `review clean` "trong phạm vi" phải khớp giữa `task-loop.md`, `final-review.md` và `finish.md`, không mâu thuẫn quy tắc cũ "vi phạm AC là major trở lên" — pin ở Task 4.
- `core/principles/trust-boundary.md` thật sự có trong skill `principles` sau build (`build/claude/plugins/core/skills/principles/SKILL.md`) — assert ở Task 4.
- Eval mới không phụ thuộc Bash và grader không dựa vào câu chữ tiếng Anh — `95-evals.contract.mjs` ở Task 5 và đọc trace ở Task 7.

### Task 1: evalCalc và cảnh báo W22
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC2.1, AC2.2
**Files:**
- Modify: `core/skills/artifact-templates/scripts/check-request.mjs`
- Modify: `core/skills/artifact-templates/references/requirement.template.md`
- Modify: `core/skills/artifact-templates/references/design.template.md`
- Modify: `core/skills/artifact-templates/SKILL.md`
- Test: `test/contract/35-artifact-templates.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `evalCalc(expr: string) → number` (ném lỗi khi biểu thức không hợp lệ), export từ `check-request.mjs`; cảnh báo `W22` trong kết quả `checkRequest`

- [ ] **Step 1:** Thêm vào `35-artifact-templates.contract.mjs` một test có tham số cho `evalCalc` (AC2.2: `99999 - floor(99999 * 15 / 100)` → 85000, ưu tiên `2 + 3 * 4` → 14, một ngôi `-(-5)` → 5, `min(3, max(1, 2))` → 2, ký tự lạ `process.exit()` → ném lỗi) và test W22 qua `checkRequest` (AC2.1: AC ghi `= 84999` → một W22 nêu dòng, 84999 và 85000; khối đúng → không W22; biểu thức lạ → W22 "biểu thức không hợp lệ"). Chạy `node test/validate.mjs --only artifact-templates` thấy đỏ; commit test đỏ riêng.
- [ ] **Step 2:** Viết `evalCalc` (tokenizer + đệ quy giảm dần, tập hàm cố định) và quét W22 trong `check-request.mjs`; thêm dòng hướng dẫn `calc:` vào hai template và W22 vào mục lục `SKILL.md`. Chạy lại lệnh trên thấy xanh, chạy `node test/validate.mjs --build` thấy 0 fail; commit.

### Task 2: quy tắc calc: và tính năng cắt bớt trong spec
**Kind:** DOCS
**Phủ AC:** AC2.3, AC3.4
**Files:**
- Modify: `plugins/engineering/skills/engineering-spec-writing/SKILL.md`
- Modify: `plugins/engineering/skills/engineering-spec-writing/references/checklist.md`
- Modify: `plugins/engineering/skills/engineering-spec-writing/references/builder-check.md`
- Modify: `plugins/engineering/agents/engineering-spec-analyst.md`
- Test: `test/content/38-scope-discipline.pin.mjs`

**Interfaces:**
- Consumes: cảnh báo `W22` của `check-request.mjs` (Task 1)
- Produces: không có

- [ ] **Step 1:** Tạo `38-scope-discipline.pin.mjs` (mẫu module `export default async function run({ ok, ctx })`), pin AC2.3 (bốn file nêu "AC nêu kết quả số phải kèm `calc:`"; `builder-check.md` chạy `check-request.mjs` và đưa W22 vào nhóm sửa thẳng, bỏ câu "tự tính lại" cũ) và AC3.4 (`builder-check.md`: tính năng người dùng nêu mà design chỉ làm một phần → nhóm câu hỏi của người dùng). Chạy `node test/validate.mjs --only scope-discipline` thấy đỏ.
- [ ] **Step 2:** Sửa bốn file; chạy lại thấy xanh; commit.

### Task 3: rà ca biên khi làm rõ
**Kind:** DOCS
**Phủ AC:** AC1.1
**Files:**
- Modify: `core/skills/brainstorming/references/clarify-core.md`
- Test: `test/content/38-scope-discipline.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Thêm pin AC1.1 vào `38-scope-discipline.pin.mjs`: `clarify-core.md` có mục "Rà ca biên" liệt kê đủ 5 nhóm ca biên (Global Constraints), mỗi ca một mặc định dẫn `file:line`, ca code đã trả lời thì không hỏi. Chạy `node test/validate.mjs --only scope-discipline` thấy đỏ.
- [ ] **Step 2:** Viết mục "Rà ca biên" trong `clarify-core.md`; chạy lại thấy xanh; commit.

### Task 4: nhận review và ranh giới tin cậy
**Kind:** DOCS
**Phủ AC:** AC3.1, AC3.2, AC3.3
**Files:**
- Create: `core/principles/trust-boundary.md`
- Modify: `core/skills/plan-execution/references/task-loop.md`
- Modify: `core/skills/plan-execution/references/prompts/task-review.md`
- Modify: `core/skills/plan-execution/references/prompts/final-review.md`
- Modify: `core/skills/plan-execution/references/finish.md`
- Modify: `plugins/engineering/agents/engineering-quality-auditor.md`
- Test: `test/content/38-scope-discipline.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Thêm pin vào `38-scope-discipline.pin.mjs`. AC3.1: `task-loop.md` có mục "Nhận review", ba nhóm nguyên văn, nhóm "ngoài AC, không đổi hành vi" không giao sửa. AC3.2: nhóm đổi hành vi vào thẻ G3; `finish.md` ghi "làm" thành follow-up; câu "`Ruling:` không được thêm hành vi không có trong AC". AC3.3: `task-review.md`, `final-review.md` và `engineering-quality-auditor.md` trỏ `trust-boundary.md`; build ra skill `principles` có nội dung của `trust-boundary.md`. Pin thêm định nghĩa `review clean` "trong phạm vi" khớp giữa `task-loop.md` và `final-review.md`. Chạy `node test/validate.mjs --build --only scope-discipline` thấy đỏ.
- [ ] **Step 2:** Viết `trust-boundary.md` và sửa năm file; kiểm skill `principles` đã gộp file mới (nếu cách gộp không lấy mọi `.md` của `core/principles/` thì thêm vào danh sách nguồn đang dùng). Chạy lại thấy xanh; commit.

### Task 5: ba eval case mới
**Kind:** DOCS
**Phủ AC:** AC1.2, AC2.4, AC3.5
**Files:**
- Create: `evals/core/brainstorm-reads-code-first/case.yaml`
- Create: `evals/engineering/spec-ac-calc/case.yaml`
- Create: `evals/workflows/review-out-of-scope/case.yaml`
- Modify: `evals/README.md`
- Modify: `evals/README_VI.md`
- Test: `test/contract/95-evals.contract.mjs`

**Interfaces:**
- Consumes: quy tắc của Task 2–4 (hành vi mà grader đo)
- Produces: không có

- [ ] **Step 1:** Viết ba case theo mẫu `evals/core/brainstorm-gather-questions` và `evals/workflows/task-review-spec` (`case.yaml`, `prompt.md`, `graders/*.md`, `scaffold.sh` khi cần file mẫu). AC1.2 có grader `Read` file nguồn trước tin nhắn cuối, cộng một grader llm "không hỏi điều code đã trả lời, có ca biên kèm mặc định". AC2.4 có grader llm "requirement.md có `calc:` đúng số học". AC3.5 có grader `tool_used` Edit/Write vào `src/` max 0 và grader llm "hỏi người dùng về finding đổi hành vi". Không cấp Bash. Thêm 3 dòng vào bảng case của hai README.
- [ ] **Step 2:** Chạy `node test/validate.mjs --only evals` thấy xanh; commit.

### Task 6: bump version, lock, changelog
**Kind:** TOOLING
**TDD:** không — chỉ đổi số version và lock, `npm test` (60-versions) là kiểm chứng
**Phủ AC:** AC2.1, AC3.1
**Files:**
- Modify: `core/.manifest.json`
- Modify: `plugins/engineering/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Modify: `CHANGELOG.md`
- Test: `test/contract/60-versions.contract.mjs`

**Interfaces:**
- Consumes: nội dung đã đổi của Task 1–4
- Produces: không có

- [ ] **Step 1:** Bump patch `core` và `engineering`, thêm một dòng CHANGELOG (tiếng Việt), chạy `npm run build` rồi `node cli/lib/versions.mjs --lock`. Chạy `npm test` thấy 0 fail; commit.

### Task 7: chạy eval mới và E2E, chấm theo rubric
**Kind:** TOOLING
**TDD:** không — lượt đo hành vi bằng model, không có code mới
**Phủ AC:** AC1.2, AC2.4, AC3.5, AC4.1
**Files:**
- Create: `docs/requests/2026-11-02-aip-scope-discipline/trial-7.md`
- Test: `docs/requests/2026-11-02-aip-scope-discipline/e2e/oracle.mjs`

**Interfaces:**
- Consumes: kịch bản `docs/requests/2026-11-02-aip-scope-discipline/e2e/README.md`, plugin đã cài toàn cục ở version của Task 6 (`aip check -g` khớp source; lệch thì báo người dùng cập nhật plugin trước khi chạy)
- Produces: không có

- [ ] **Step 1:** Chạy `node scripts/eval-run.mjs --plugin <id> --max-cost-usd 2 --runs 1 --scaffold --case <case>` cho 3 case mới. Ghi bảng with/without vào `trial-7.md`; grader nhánh có plugin đỏ thì đọc trace, ghi nguyên nhân.
- [ ] **Step 2:** Chạy E2E nhánh aip theo `e2e/README.md` (sandbox ngoài repo), rồi chạy `node oracle.mjs aip <sandbox>/src/<file>`. Chấm ba phần theo rubric ở mục Kiểm thử của `design.md`, ghi điểm kèm bằng chứng (trích lượt, `file:line`, kết quả oracle) và tổng chi phí vào `trial-7.md`. Phần nào < 9 thì ghi nguyên nhân, không chấm nới. Commit.
