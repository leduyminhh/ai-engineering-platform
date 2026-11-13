# frontend-codegen-compat-harden Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** siết bảo mật và độ chính xác của chỉ dẫn kiểm tương thích công cụ codegen mà N3 thêm: ranh giới chỉ đọc của spike (workflow Bước 3 và `engineering-spec-writing`), mục 2a và mục 3 của reference, tên gói `@openapitools/openapi-generator-cli`, và pin ghim các ranh giới đó.
**Architecture:** chỉ đổi nội dung markdown chiếu (skill, reference, workflow), một file pin ở `test/content/`, spec sống và version; không thêm script, không thêm bước workflow, `workflows/feature/graph.json` không đổi.
**Tech Stack:** Markdown tiếng Việt có dấu; test pin Node ESM zero-dependency (`test/content/*.pin.mjs`, chạy bằng `node test/validate.mjs`).
**Spec:** design.md
**Requirement:** requirement.md

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `test/content/54-codegen-compat.pin.mjs` | pin của N3 + pin ranh giới N3b (tách mục 2a, I2, Bước 3 và đoạn spike của spec-writing) | Task 1, Task 2 |
| `plugins/frontend/skills/frontend-data-integration/references/contract-and-codegen.md` | mục 2a (không chép `.npmrc`, ca không dùng được, `EBADENGINE`, tên gói), mục 3 (một mặc định, câu `[Inference]`) | Task 1 |
| `plugins/frontend/skills/frontend-data-integration/SKILL.md` | I2: tên gói trong danh sách ứng viên gắn với `npm view` | Task 1 |
| `workflows/feature/WORKFLOW.md` | Bước 3: ranh giới chỉ đọc ở Hành động, một cụm ở Gate | Task 2 |
| `plugins/engineering/skills/engineering-spec-writing/SKILL.md` | bước 9, đoạn "Spike giả định": ranh giới chỉ đọc cho giả định công cụ/thư viện | Task 2 |
| `docs/specs/workflows/spec.md` | sửa `workflows/R25` và dòng Lịch sử `đổi` | Task 3 |
| `plugins/frontend/.manifest.json`, `workflows/.manifest.json`, `plugins/engineering/.manifest.json` | bump version | Task 3 |
| `plugins/_versions.lock.json` | khoá version sau build | Task 3 |

## Global Constraints
- Tiếng Việt có dấu, UTF-8 không BOM, LF. Lệnh trong nội dung chiếu chỉ dùng `npm`, `npx`, `node`; không đường dẫn tuyệt đối của máy nào.
- Chuỗi nguyên văn (requirement.md, design.md):
  - ranh giới spike: `thư mục tạm`, `không cài vào project`, `` `npx --yes` `` (cùng ý "không chạy gói chưa được người dùng duyệt")
  - lệnh chạy thử: `npm install --dry-run --ignore-scripts <gói>@<phiên bản>`; cụm `không ghi vào project`
  - mặc định không xung đột: `npm install --save-dev --save-exact <gói>@<x.y.z>`; dạng xung đột: `npx --yes -p typescript@<x.y.z> -p <gói>@<x.y.z> <lệnh>`
  - tên gói: `@openapitools/openapi-generator-cli`; tên `openapi-generator` chỉ còn ở bảng dò mục 2 của reference và dòng dò stack mục 0 của `SKILL.md`
  - file không được chép sang thư mục tạm: `.npmrc`, `.yarnrc*`, `.env`; nhãn `[Inference]` đứng đầu câu về `npm audit`
- Ở `workflows/feature/WORKFLOW.md` chỉ sửa mục `### Bước 3 — Tài liệu ⏸`, và trong đó chỉ Hành động, Gate, Evidence. Không thêm `skill \`...\`` hay `agent \`...\`` vào Thực hiện, không thêm chữ "hỏi" hay "quay lại Bước N" vào Khi fail, không viết `references/<x>.md` trong backtick (`checkGraphAgainstBody` và `test/contract/50-workflows.contract.mjs`). Câu thêm có thể làm Hành động dài hơn nhưng không đổi số bước (7).
- Ở `engineering-spec-writing/SKILL.md` chỉ sửa đoạn "Spike giả định" ở bước 9 (khoảng dòng 120–125); đoạn phải còn `[Unverified]`, `hướng đã chọn` và `trước checkpoint` (pin `test/content/43-progress-plan-quality.pin.mjs`).
- Không sửa `plugins/frontend/skills/frontend-implement/`, `plugins/frontend/skills/frontend-code-review/`, `workflows/bugfix/`, `plugins/frontend/skills/frontend-fix/` (N1, N2). `references/contract-and-codegen.md` giữ hai link `https://openapi-ts.dev/...` (pin `03-frontend-data-integration`).
- Pin: tách trường Bước 3 bằng `parseSteps` (hàm `field` đã có trong `54-codegen-compat.pin.mjs`); mục 2a cắt từ `## 2a.` tới `## 3.`, I2 cắt từ `### I2.` tới `### I3.`, chuẩn hoá khoảng trắng; ghim lệnh, ranh giới an toàn và tên gói, không ghim văn xuôi. Thông điệp `ok` mới mang tiền tố `N3b ` trước ID AC để khỏi lẫn với pin N3.
- Mỗi task: test đỏ đúng lý do, commit test đỏ riêng, sửa, test xanh, commit riêng trên nhánh hiện tại qua `core:git-workflow` (`git commit -F`, header tiếng Anh, body tiếng Việt); không push, không merge, không Co-Authored-By; một lệnh Bash mỗi lần gọi.
- Test hẹp ở từng task; `npm test` đúng một lần ở Task 3.

## Review Focus
- Chữ mới làm vỡ ranh giới "chỉ Bước 3, chỉ Hành động/Gate/Evidence": Task 2, step đối chiếu `git diff -U0 cb9ecb86 -- workflows/feature/WORKFLOW.md` với số dòng Bước 3, và `node test/validate.mjs --only workflow` (có `50-workflows.contract.mjs`).
- Câu thêm ở spec-writing làm mất cụm mà pin `43` đòi: Task 2, chạy `node test/validate.mjs --only progress-plan` sau khi sửa.
- Tên `openapi-generator` còn sót trong mục 2a hoặc I2: Task 1, pin `N3b AC3.1` loại `@openapitools/openapi-generator-cli` rồi tìm token còn lại.
- Câu `npm audit` lặp hai lần hoặc mất nhãn `[Inference]`: Task 1, pin `N3b AC4.2` đếm số lần và kiểm nhãn.
- Bump trùng hoặc thấp hơn N1/N2/N3 khi merge: Task 3, step đọc manifest hiện tại trước khi bump rồi `node cli/lib/versions.mjs --lock`.

### Task 1: Pin + mục 2a, mục 3 và tên gói
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30 phút
**Phủ AC:** AC2.1, AC2.2, AC2.3, AC3.1, AC4.1, AC4.2, AC5.1, AC5.2
**Files:**
- Modify: `test/content/54-codegen-compat.pin.mjs`
- Modify: `plugins/frontend/skills/frontend-data-integration/references/contract-and-codegen.md`
- Modify: `plugins/frontend/skills/frontend-data-integration/SKILL.md`
- Test: `test/content/54-codegen-compat.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: mục `## 2a. Kiểm tương thích công cụ` của `contract-and-codegen.md` giữ nguyên tên (Bước 3 và `engineering-spec-writing` không trỏ tên này, nhưng pin của Task 2 cắt theo nó)

- [ ] **Step 1:** đọc lại `54-codegen-compat.pin.mjs` và hai file nội dung; chạy `node test/validate.mjs --only codegen-compat` để thấy baseline xanh (exit 0), ghi dòng tổng vào báo cáo task.
- [ ] **Step 2:** sửa pin (đỏ): thêm cho mục 2a các `ok` `N3b AC5.1` (chuỗi liền `npm install --dry-run --ignore-scripts` sau chuẩn hoá khoảng trắng; cụm `không ghi vào project`), `N3b AC2.1` (`.npmrc`), `N3b AC2.3` (`EBADENGINE`), `N3b AC2.2` (mục 2a nêu `E404` hoặc `E401`, và `workspaces`), `N3b AC3.1` (mục 2a và I2 chứa `@openapitools/openapi-generator-cli`; sau khi xoá chuỗi đó, không còn `openapi-generator` đứng riêng: regex `(?<![\w@/-])openapi-generator(?![\w-])`); cho mục 3: `N3b AC4.1` (có `npm install --save-dev --save-exact`; dòng script `api:types` đầu tiên không chứa `npx`; có một dòng `api:types` thứ hai chứa `npx --yes -p typescript@`), `N3b AC4.2` (cụm `npm audit` xuất hiện đúng một lần trên toàn file và `[Inference]` đứng trước nó trong vòng 80 ký tự). Sửa `ok` cũ về `scriptLine` (AC2.2 của N3) theo mặc định mới: dòng `npx` ghim `openapi-typescript@(<x.y.z>|ba số)`. Giữ các `ok` khác.
- [ ] **Step 3:** chạy `node test/validate.mjs --only codegen-compat`; kết quả mong đợi: exit 1, chỉ các `ok` `N3b …` mới đỏ vì thiếu chữ (không phải lỗi cú pháp hay lỗi nạp). Commit test đỏ riêng: `test(frontend): pin codegen compat hardening (red)`.
- [ ] **Step 4:** sửa `references/contract-and-codegen.md` theo Thiết kế 2, 3, 4 của design.md: mục 2a bước "Chạy thử" (chỉ chép `package.json` và lockfile, không chép `.npmrc`/`.yarnrc*`/`.env`; bốn kết quả `ERESOLVE`, exit khác 0 mã khác (`E401`, `E404`), `workspaces` hoặc dependency `file:`/`link:`, `EBADENGINE`); dòng 28 đổi tên gói; mục 3 một mặc định `devDependencies` đúng `x.y.z` kèm hai ví dụ script (mặc định, và dạng `npx` cho ca xung đột đã chọn ghim); câu `npm audit` chỉ ở dòng "Ghim công cụ bằng `npx`" của bảng 2a, mở đầu `[Inference]`, bỏ bản lặp ở mục 3. Giữ bảng dò mục 2 và hai link `https://`.
- [ ] **Step 5:** sửa `SKILL.md` mục I2, dòng "Với mọi công cụ codegen ứng viên": `openapi-generator` → `@openapitools/openapi-generator-cli`; không đổi dòng 57 (dò stack mục 0).
- [ ] **Step 6:** đối chiếu khẳng định (task này sửa docs có lệnh và tên): lập bảng `khẳng định → file:line → khớp|lệch` cho tên gói và hai lệnh `npm view` đã ghi ở Spike của design.md; chạy `node test/validate.mjs --only codegen-compat` và `node test/validate.mjs --only data-integration`; kết quả mong đợi: cả hai exit 0. Commit: `fix(frontend): harden codegen compat check guidance`.

### Task 2: Ranh giới chỉ đọc ở Bước 3 và spec-writing
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25 phút
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC5.1
**Files:**
- Modify: `test/content/54-codegen-compat.pin.mjs`
- Modify: `workflows/feature/WORKFLOW.md`
- Modify: `plugins/engineering/skills/engineering-spec-writing/SKILL.md`
- Test: `test/content/54-codegen-compat.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** thêm vào pin (đỏ): `N3b AC1.1` (Hành động của Bước 3, lấy bằng `field('Hành động')`, chứa `thư mục tạm`, `không cài vào project` và `` `npx --yes` ``; trường Thực hiện và Khi fail không chứa `thư mục tạm`); `N3b AC1.3` (đoạn của `engineering-spec-writing/SKILL.md` cắt từ `**Spike giả định` tới `10. **Verify.**` chứa ba cụm trên). Đường dẫn file spec-writing dựng bằng `path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-spec-writing', 'SKILL.md')`.
- [ ] **Step 2:** chạy `node test/validate.mjs --only codegen-compat`; kết quả mong đợi: exit 1, chỉ `N3b AC1.1` và `N3b AC1.3` đỏ. Commit test đỏ riêng: `test(workflows): pin read-only spike boundary (red)`.
- [ ] **Step 3:** sửa `workflows/feature/WORKFLOW.md` Bước 3 theo Thiết kế 1: thêm ranh giới chỉ đọc vào câu spike ở Hành động; một cụm "theo ranh giới chỉ đọc đó" ở Gate, vế "đã có kết quả spike". Evidence không đổi. Không chạm Thực hiện và Khi fail; không viết `references/…`.
- [ ] **Step 4:** sửa `plugins/engineering/skills/engineering-spec-writing/SKILL.md` theo Thiết kế 7: một câu cuối đoạn "Spike giả định".
- [ ] **Step 5:** chạy `node test/validate.mjs --only codegen-compat`, `node test/validate.mjs --only workflow` và `node test/validate.mjs --only progress-plan`; kết quả mong đợi: cả ba exit 0.
- [ ] **Step 6:** đối chiếu AC1.2 và AC1.3: `git diff -U0 cb9ecb86 -- workflows/feature/WORKFLOW.md` và `git diff -U0 cb9ecb86 -- plugins/engineering/skills/engineering-spec-writing/SKILL.md`, so số dòng hunk với đầu/cuối mục `### Bước 3` (grep `^### Bước`) và đoạn "Spike giả định"; kết quả mong đợi: mọi hunk của `WORKFLOW.md` nằm trong Bước 3 ở các dòng `- **Hành động:**`/`- **Gate:**`/`- **Evidence:**`, mọi hunk của spec-writing nằm trong đoạn spike. Ghi bảng `hunk → dòng → trường` vào báo cáo task. Commit: `fix(workflows): add read-only boundary to spike guidance`.

### Task 3: Spec sống, bump version, kiểm toàn bộ
**Kind:** TOOLING
**TDD:** không — chỉ cập nhật spec, version và lock; hành vi đã được pin ở Task 1–2, bước này chạy toàn bộ suite
**Ước lượng:** 25 phút
**Phủ AC:** AC6.1, AC6.2
**Files:**
- Modify: `docs/specs/workflows/spec.md`
- Modify: `plugins/frontend/.manifest.json`
- Modify: `workflows/.manifest.json`
- Modify: `plugins/engineering/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/content/54-codegen-compat.pin.mjs`

**Interfaces:**
- Consumes: nội dung đã chốt ở Task 1 và Task 2
- Produces: không có

- [ ] **Step 1:** đọc `docs/specs/workflows/spec.md` (R25 hiện có, định dạng Lịch sử); sửa R25: thêm rằng spike ở Bước 3 và ở `engineering-spec-writing` chỉ đọc hoặc chạy thử trong thư mục tạm (không cài vào project, không `npx --yes` gói chưa duyệt) và chạy thử bỏ qua `.npmrc`; thêm một dòng `đổi` vào Lịch sử trỏ `2026-11-13-frontend-codegen-compat-harden`. Số R25 trùng với nhánh N2: không đổi ở đây, xử lý lúc merge.
- [ ] **Step 2:** chạy `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-13-frontend-codegen-compat-harden/ --base master`; kết quả mong đợi: không báo W10–W14.
- [ ] **Step 3:** đọc version hiện tại của ba manifest; tăng patch (mong đợi 1.16.5 → 1.16.6, 3.16.3 → 3.16.4, 2.15.0 → 2.15.1; số hiện tại lớn hơn thì lấy số lớn hơn), rồi chạy `npm run build` (exit 0) và `node cli/lib/versions.mjs --lock` (exit 0, `plugins/_versions.lock.json` đổi đúng ba plugin).
- [ ] **Step 4:** chạy `npm test` một lần; kết quả mong đợi: exit 0 gồm `54-codegen-compat`. Ghi dòng tổng vào báo cáo.
- [ ] **Step 5:** commit: `docs(specs): record read-only spike boundary; chore: bump versions`.
