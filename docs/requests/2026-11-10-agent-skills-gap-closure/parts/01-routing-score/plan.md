# Part 01 — đo routing tất định và case eval im lặng

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** `npm test` chấm routing trên `description` của 50 id published, fail khi tỉ lệ rank-1 tụt dưới ngưỡng khoá; thêm 3 case eval "phải im lặng".
**Architecture:** script repo `scripts/routing-score.mjs` (hàm thuần + CLI), contract `test/contract/56-routing-score.contract.mjs` chạy trong `validate --build`, file khoá `test/routing/rank1.lock.json`.
**Tech Stack:** Node 20+ ESM, zero-dep.
**Spec:** ../../design.md (mục P1, D1–D3, D6; AC1.1–AC1.5)
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `scripts/routing-score.mjs` | chuẩn hoá, TF-IDF, xếp hạng, đo, quyết định ghi khoá, CLI | Task 1, Task 2 |
| `test/contract/56-routing-score.contract.mjs` | unit của scorer, kiểm dữ liệu + ngưỡng, pin grader case im lặng | Task 1, 2, 3 |
| `test/routing/rank1.lock.json` | ngưỡng khoá positive/negative | Task 2 |
| `evals/engineering/tdd-quiet-on-bug/` | case: báo lỗi → `workflow-bugfix` gọi, `engineering-tdd` im | Task 3 |
| `evals/backend/code-review-quiet-on-scan/` | case: quét lỗ hổng → `engineering-quality-gate` gọi, `backend-code-review` im | Task 3 |
| `evals/core/release-quiet-on-commit/` | case: commit → `git-workflow` gọi, `git-release` im | Task 3 |

`test/routing/<id>.json` do `plan.md` gốc tạo (đã commit trước khi part bắt đầu); part này chỉ đọc, không sửa.

## Global Constraints

- Node thuần, không dependency. File UTF-8 không BOM, LF. Văn bản tiếng Việt có dấu. Comment theo mục Comments của `AGENTS.md` (chỉ ghi lý do, tiếng Việt, 1–2 dòng).
- Không sửa: `**/.manifest.json`, `plugins/_versions.lock.json`, `CHANGELOG.md`, `CLAUDE.md`, `docs/requests/**/design.md`, `docs/specs/**`, `test/routing/<id>.json`, mọi `description` của skill/workflow.
- Tập chấm (D6): `offeredCatalog().plugins[].skillIds` (`cli/lib/install.mjs`) bỏ `core/principles`, cộng mọi workflow của `loadWorkflows()` (`cli/lib/plugins.mjs`); `description` lấy từ `stages[].description` của `loadCore()`, `loadWorkflows()`, `loadPlugins()`. Id là tên trần (phần sau `/`).
- Văn bản được chấm (D2): `description` cắt từ "Không dùng khi" trở đi.
- Positive đạt khi id đúng ở hạng 1; negative đạt khi id của file không ở hạng 1.
- File khoá: `{ "positive": { "threshold": N }, "negative": { "threshold": M } }`, mỗi `"threshold"` một dòng riêng, N/M là số nguyên phần trăm (làm tròn xuống).
- `--lock`: số đo > số khoá thì ghi; số đo < số khoá thì exit 1, không ghi; bằng thì không ghi, exit 0.
- Case eval: `prompt.md` có `runs: 3`, `allowed_tools` có `Skill`; grader `tool_used` `Skill`, `input_match: '"skill"\s*:\s*"(?:[\w-]+:)?<id>"'`; skill đúng `min: 1`; skill phải im lặng `min: 0`, `max: 0`.
- Mỗi assert nhắc ID AC nó phủ (vd `AC3.2`) trong thông điệp, để `check-request.mjs` W7 thấy.
- Test hẹp: `node test/validate.mjs --build --only 56-routing` và `--only 95-evals`; không chạy full suite trong part.
- Commit: `git commit -F <file>`, header tiếng Anh `type(scope): summary`, body tiếng Việt, không dòng `Co-Authored-By`.

## Review Focus

- Prompt rỗng hoặc chỉ có ký tự đặc biệt (không token nào): Task 1 test `rank` trả điểm 0 cho mọi id, không ném.
- Hoà điểm: Task 1 test hai tài liệu cùng điểm xếp theo id tăng dần (tất định).
- `--lock` khi chưa có file khoá: Task 1 test `lockDecision({ measured, locked: null })` cho ghi.
- Hạ `"threshold"` trong file khoá bằng tay: Task 1 test `findWeakening` trên diff giả liệt kê dòng đó (AC1.4).

### Task 1: scorer thuần và unit test
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25'
**Phủ AC:** AC1.3, AC1.4
**Files:**
- Create: `scripts/routing-score.mjs`
- Create: `test/contract/56-routing-score.contract.mjs`
- Test: `test/contract/56-routing-score.contract.mjs`

**Interfaces:**
- Consumes: `findWeakening(diff)` từ `core/skills/plan-execution/scripts/review-package.mjs` (chỉ trong test)
- Produces: `normalize(text)`, `tokens(text)`, `routable(description)`, `buildIndex(docs)`, `rank(index, prompt)`, `measure({ docs, data })`, `lockDecision({ measured, locked })`, `loadRoutingDocs()`

- [ ] **Step 1:** viết contract 56 phần unit (mẫu nạp module: `test/content/42-writing-style.pin.mjs`): `normalize('Đặc tả yêu cầu')` = `'dac ta yeu cau'`; `tokens` có `dac`, `ta`, `yeu`, `cau`, `dac ta`; `routable` cắt "Không dùng khi…"; `rank` trên corpus 3 tài liệu nhỏ đúng hạng 1, hoà điểm xếp theo id, prompt không token cho điểm 0; `measure` đếm hit/total/pct; `lockDecision` (ghi / exit 1 / không ghi, có ca `locked: null`); `findWeakening` trên diff giả của `test/routing/rank1.lock.json` hạ `"threshold": 80` xuống `70` cho đúng một dòng. Chạy `node test/validate.mjs --build --only 56-routing` → đỏ (module chưa có).
- [ ] **Step 2:** viết `scripts/routing-score.mjs`: các hàm Produces; `loadRoutingDocs()` dựng `[{ id, text }]` theo D6; CLI `node scripts/routing-score.mjs [--lock]` in tổng positive/negative và danh sách miss, `--lock` theo Global Constraints; chỉ chạy CLI khi được gọi trực tiếp (mẫu `invoked` ở cuối `review-package.mjs`). Ghi lựa chọn hằng số TF-IDF (idf = log((N+1)/(df+1)) + 1, cosine) vào comment đầu file. Chạy lại lệnh Step 1 → xanh.
- [ ] **Step 3:** commit `feat(scripts): add deterministic routing scorer`.

### Task 2: đo trên dữ liệu thật và khoá ngưỡng
**Kind:** TOOLING
**TDD:** không — ngưỡng là số đo lần đầu, test viết sau khi có số
**Ước lượng:** 25'
**Phủ AC:** AC1.1, AC1.2
**Files:**
- Create: `test/routing/rank1.lock.json`
- Modify: `scripts/routing-score.mjs` (chỉ khi chỉnh token hoá theo số đo)
- Modify: `test/contract/56-routing-score.contract.mjs`
- Test: `test/contract/56-routing-score.contract.mjs`

**Interfaces:**
- Consumes: `test/routing/<id>.json` (khoá `positive`, `negative`, do plan gốc tạo); `loadRoutingDocs()`, `measure({ docs, data })`, `lockDecision({ measured, locked })`
- Produces: `test/routing/rank1.lock.json`

- [ ] **Step 1:** thêm vào contract 56: mỗi id của `loadRoutingDocs()` có file với ≥ 3 positive, ≥ 2 negative; file `test/routing/*.json` (trừ `rank1.lock.json`) có id ngoài tập → fail; hai id trùng tên trần → fail; `measure` trên dữ liệu thật ≥ `threshold` của file khoá cho cả positive và negative. Chạy `--only 56-routing` → đỏ (chưa có file khoá).
- [ ] **Step 2:** chạy `node scripts/routing-score.mjs`, ghi số đo. Được thử bỏ/giữ bigram và lọc token 1 ký tự, chọn cấu hình có positive pct cao nhất mà negative pct không giảm quá 5 điểm; ghi lựa chọn vào comment đầu file. Không sửa dữ liệu hay `description`.
- [ ] **Step 3:** `node scripts/routing-score.mjs --lock` tạo file khoá; chạy `--only 56-routing` → xanh. Ghi số đo (positive pct, negative pct, số miss) vào báo cáo part.
- [ ] **Step 4:** commit `test(routing): lock initial rank-1 thresholds`.

### Task 3: ba case eval phải im lặng
**Kind:** TOOLING
**TDD:** không — nội dung eval, cấu trúc kiểm bằng contract 95 và 56
**Ước lượng:** 20'
**Phủ AC:** AC1.5
**Files:**
- Create: `evals/engineering/tdd-quiet-on-bug/prompt.md`, `graders/*.md` (thêm `case.yaml` + `scaffold.sh` nếu prompt cần file, theo mẫu `evals/workflows/bugfix-routes/` và `evals/engineering/tdd-red-first/`)
- Create: `evals/backend/code-review-quiet-on-scan/prompt.md`, `graders/*.md`
- Create: `evals/core/release-quiet-on-commit/prompt.md`, `graders/*.md`
- Modify: `test/contract/56-routing-score.contract.mjs`
- Test: `test/contract/56-routing-score.contract.mjs`, `test/contract/95-evals.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** thêm vào contract 56 bảng 3 case (thư mục, id phải gọi, id phải im lặng): mỗi case có grader `tool_used` `Skill` khớp `input_match` id phải gọi với `min: 1`, và grader khớp id phải im lặng với `max: 0`. Chạy `--only 56-routing` → đỏ.
- [ ] **Step 2:** viết 3 case theo Global Constraints; prompt viết như người dùng thật, không chứa tên skill. Chạy `--only 56-routing` và `--only 95-evals` → xanh.
- [ ] **Step 3:** commit `test(evals): add stays-quiet cases for three confusable skill pairs`.
