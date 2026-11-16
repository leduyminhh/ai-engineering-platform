# frontend-codegen-compat Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** buộc kiểm tương thích công cụ codegen (`peerDependencies`, `engines`) với TypeScript/Node của project trước G1: thêm cách làm vào reference của `frontend-data-integration`, lưới đỡ ở I2, và bước spike bắt buộc ở `workflow-feature` Bước 3.
**Architecture:** chỉ đổi nội dung markdown chiếu (skill, reference, workflow) và một file pin ở `test/content/`; không thêm script, không thêm bước workflow, `workflows/feature/graph.json` không đổi.
**Tech Stack:** Markdown tiếng Việt có dấu; test pin Node ESM zero-dependency (`test/content/*.pin.mjs`, chạy bằng `node test/validate.mjs`).
**Spec:** design.md
**Requirement:** requirement.md

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `test/content/54-codegen-compat.pin.mjs` | pin chuỗi lệnh và vị trí của AC1–AC4.1 (file mới) | Task 1, Task 2 |
| `plugins/frontend/skills/frontend-data-integration/references/contract-and-codegen.md` | mục "Kiểm tương thích công cụ", ví dụ script ghim phiên bản | Task 1 |
| `plugins/frontend/skills/frontend-data-integration/SKILL.md` | I2: bước kiểm trước khi đề xuất, "Đỏ khi" thêm xung đột | Task 1 |
| `workflows/feature/WORKFLOW.md` | Bước 3: spike giả định công cụ ở Hành động, Gate, Evidence | Task 2 |
| `docs/specs/workflows/spec.md` | `workflows/R25` và dòng Lịch sử | Task 3 |
| `plugins/frontend/.manifest.json`, `workflows/.manifest.json` | bump version | Task 3 |
| `plugins/_versions.lock.json` | khoá version sau build | Task 3 |

## Global Constraints
- Tiếng Việt có dấu, UTF-8 không BOM, LF. Lệnh trong nội dung chiếu chỉ dùng `npm`, `npx`, `node`; không đường dẫn tuyệt đối của máy nào.
- Chuỗi lệnh nguyên văn (design.md, Thiết kế):
  - `npm view <gói>@<phiên bản> peerDependencies engines --json`
  - `npm install --dry-run --ignore-scripts <gói>@<phiên bản>` chạy trong thư mục tạm có bản sao `package.json` (và lockfile)
  - `npx --yes -p typescript@<x.y.z> -p <gói>@<x.y.z> <lệnh>`
- Ở `workflows/feature/WORKFLOW.md` chỉ sửa mục `### Bước 3 — Tài liệu ⏸`, và trong đó chỉ các trường Hành động, Gate, Evidence. Không thêm `skill \`...\`` hay `agent \`...\`` vào Thực hiện, không thêm chữ "hỏi" hay "quay lại Bước N" vào Khi fail (`checkGraphAgainstBody` ở `cli/lib/workflows.mjs` suy graph từ hai trường đó). Không đụng bước khác (N1 sửa Bước 5/6).
- Không sửa `plugins/frontend/skills/frontend-implement/`, `plugins/frontend/skills/frontend-code-review/`, `workflows/bugfix/`, `plugins/frontend/skills/frontend-fix/` (N1, N2).
- `references/contract-and-codegen.md` giữ hai link `https://openapi-ts.dev/...` (pin `test/content/03-frontend-data-integration.pin.mjs` đòi có `https://`).
- Pin khớp từng token rời (`--dry-run`, `--ignore-scripts`, `engines`, `peerDependencies`), tách trường bằng `parseSteps` (mẫu `field20` của `test/content/09-backend-performance.pin.mjs`), không khớp trên cả file.
- Mỗi task: test đỏ đúng lý do, commit test đỏ riêng, sửa, test xanh, commit riêng trên nhánh hiện tại qua `core:git-workflow`; không push, không Co-Authored-By.
- Test hẹp ở từng task; `npm test` đúng một lần ở Task 3.

## Review Focus
- Pin khớp nhầm trường (chữ spike ở Thực hiện thay vì Hành động/Gate): Task 2, test `AC3.1` lấy từng trường bằng `parseSteps`.
- Chữ mới ở Bước 3 làm vỡ đối chiếu graph: Task 2, chạy `node test/validate.mjs --only workflow` (gồm `50-workflows.contract.mjs`).
- Bước đọc `peerDependencies` đứng sau câu "Chưa có codegen" ở I2 thì mất tác dụng: Task 1, test `AC1.1` so `indexOf`.
- Hunk ngoài Bước 3 lọt vào `WORKFLOW.md`: Task 2, step đối chiếu `git diff master -- workflows/feature/WORKFLOW.md` với số dòng Bước 3.
- Bump version trùng hoặc thấp hơn N1/N2: Task 3, step đọc manifest hiện tại trước khi bump và chạy `node cli/lib/versions.mjs --lock`.

### Task 1: Pin + kiểm tương thích ở reference và I2
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25 phút
**Phủ AC:** AC1.1, AC1.2, AC2.1, AC2.2
**Files:**
- Create: `test/content/54-codegen-compat.pin.mjs`
- Modify: `plugins/frontend/skills/frontend-data-integration/references/contract-and-codegen.md`
- Modify: `plugins/frontend/skills/frontend-data-integration/SKILL.md`
- Test: `test/content/54-codegen-compat.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: tên mục `Kiểm tương thích công cụ` trong `contract-and-codegen.md` (Task 2 trỏ tới tên này từ Bước 3)

- [ ] **Step 1:** xác minh runner nạp `*.pin.mjs` theo thư mục (`test/validate.mjs`, vòng `readdirSync` ở dòng 25) và `ctx` có `parseSteps`, `PLUGINS_DIR`, `workflows` như `test/content/08-publish.pin.mjs`; ghi kết quả vào báo cáo task.
- [ ] **Step 2:** viết `test/content/54-codegen-compat.pin.mjs` (`export default async function run({ ok, ctx })`), mỗi `ok` mang ID AC trong thông điệp: `AC1.1` (đoạn I2 từ `### I2.` tới `### I3.` chứa `npm view`, `peerDependencies`, `engines` và vị trí `npm view` nhỏ hơn vị trí `Chưa có codegen`; nhắc "ADR" và "design.md"), `AC1.2` (dòng `**Đỏ khi:**` của I2 chứa `xung đột`; chỉ có một dòng `**Đỏ khi:**` trong I2), `AC2.1` (reference có `--dry-run`, `--ignore-scripts`, `ERESOLVE`, `[Unverified]`), `AC2.2` (có `npx --yes -p typescript@`, `x.y.z`, và dòng script `api:types` chứa `openapi-typescript@`; vẫn có `https://openapi-ts.dev`).
- [ ] **Step 3:** chạy `node test/validate.mjs --only codegen-compat`; kết quả mong đợi: exit 1, các `ok` của AC1.1–AC2.2 đỏ vì thiếu chữ (không phải lỗi cú pháp hay lỗi nạp). Commit test đỏ riêng: `test(frontend): add codegen compat pin (red)`.
- [ ] **Step 4:** sửa `references/contract-and-codegen.md`: thêm mục "Kiểm tương thích công cụ" ngay sau mục 2 theo Thiết kế 1 của design.md (đọc khai báo, chạy thử trong thư mục tạm, phương án khi xung đột, câu `[Unverified]` cho package manager khác npm và cho lệnh không chạy được); đổi ví dụ script ở mục 3 sang `openapi-typescript@<x.y.z>`; giữ hai link `https://`.
- [ ] **Step 5:** sửa `SKILL.md` mục I2: thêm đoạn kiểm tương thích đứng trước câu "Chưa có codegen → đề xuất…", trỏ `references/contract-and-codegen.md`, ghi dòng "Tương thích" vào ADR của công cụ (hoặc vào `design.md` khi không có ADR cho công cụ); thêm vào dòng `**Đỏ khi:**` hiện có của I2 ý xung đột peer/`engines` → dừng, trình phương án, chưa Accepted ADR trước khi người dùng chọn.
- [ ] **Step 6:** chạy `node test/validate.mjs --only codegen-compat` và `node test/validate.mjs --only data-integration`; kết quả mong đợi: cả hai exit 0, không còn `ok` đỏ. Commit: `feat(frontend): require codegen compat check at I2`.

### Task 2: Spike giả định công cụ ở workflow-feature Bước 3
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 20 phút
**Phủ AC:** AC3.1, AC3.2, AC4.1
**Files:**
- Modify: `workflows/feature/WORKFLOW.md`
- Modify: `test/content/54-codegen-compat.pin.mjs`
- Test: `test/content/54-codegen-compat.pin.mjs`

**Interfaces:**
- Consumes: mục `Kiểm tương thích công cụ` của `contract-and-codegen.md` (Task 1)
- Produces: không có

- [ ] **Step 1:** thêm vào `54-codegen-compat.pin.mjs` các `ok` cho `AC3.1` và `AC4.1`: lấy Bước 3 của `workflow-feature` qua `parseSteps(workflow.body)` (mẫu `step19`/`field19` ở `test/content/08-publish.pin.mjs`); assert trường Hành động chứa `spike` và `frontend-data-integration`, trường Gate chứa `spike` hoặc `một lệnh` và `rủi ro chặn hướng`, trường Evidence chứa `spike`; assert trường Thực hiện và Khi fail không chứa `spike`; số bước bằng 7.
- [ ] **Step 2:** chạy `node test/validate.mjs --only codegen-compat`; kết quả mong đợi: exit 1, chỉ `AC3.1`/`AC4.1` đỏ vì thiếu chữ. Commit test đỏ riêng: `test(workflows): add feature step 3 spike pin (red)`.
- [ ] **Step 3:** sửa `workflows/feature/WORKFLOW.md` Bước 3 theo Thiết kế 3 của design.md: một câu spike ở Hành động sau câu builder check (kiểm trước checkpoint giả định công cụ/thư viện kiểm được bằng một lệnh, trỏ `references/contract-and-codegen.md` của `frontend-data-integration` cho công cụ codegen, ghi lệnh và kết quả vào tài liệu, không kiểm được thì nêu ở G1 như rủi ro chặn hướng); một vế ở Gate; một vế ở Evidence. Không chạm Thực hiện và Khi fail.
- [ ] **Step 4:** chạy `node test/validate.mjs --only codegen-compat` và `node test/validate.mjs --only workflow`; kết quả mong đợi: cả hai exit 0 (đối chiếu graph của `50-workflows.contract.mjs`, đúng 7 bước ở `08-publish.pin.mjs`, các pin `31-` và `14-`).
- [ ] **Step 5:** đối chiếu AC3.2: `git diff -U0 master -- workflows/feature/WORKFLOW.md` rồi so số dòng các hunk với dòng đầu và cuối mục `### Bước 3` (grep `^### Bước` để lấy); kết quả mong đợi: mọi hunk nằm trong khoảng đó và chỉ ở các dòng `- **Hành động:**`, `- **Gate:**`, `- **Evidence:**`. Ghi bảng `hunk → dòng → trường` vào báo cáo task. Commit: `feat(workflows): add tool spike to feature step 3`.

### Task 3: Spec sống, bump version, kiểm toàn bộ
**Kind:** TOOLING
**TDD:** không — chỉ cập nhật spec, version và lock; hành vi đã được pin ở Task 1–2, bước này chạy toàn bộ suite
**Ước lượng:** 25 phút
**Phủ AC:** AC4.2, AC5.1, AC5.2
**Files:**
- Modify: `docs/specs/workflows/spec.md`
- Modify: `plugins/frontend/.manifest.json`
- Modify: `workflows/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/content/54-codegen-compat.pin.mjs`

**Interfaces:**
- Consumes: nội dung đã chốt ở Task 1 và Task 2
- Produces: không có

- [ ] **Step 1:** đọc `docs/specs/workflows/spec.md` (số R cuối, định dạng dòng Lịch sử) và `core/skills/artifact-templates/references/spec.template.md`; thêm `workflows/R25` mô tả bước kiểm tương thích ở I2 và spike công cụ ở Bước 3 (nguồn: request này, test `test/content/54-codegen-compat.pin.mjs`); thêm một dòng `thêm` vào bảng Lịch sử trỏ `2026-11-13-frontend-codegen-compat`. Nếu `R25` đã bị request khác chiếm trên nhánh, dùng số kế tiếp và đổi `design.md` mục Ảnh hưởng spec cho khớp.
- [ ] **Step 2:** chạy `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-13-frontend-codegen-compat/ --base master`; kết quả mong đợi: không báo W10–W14.
- [ ] **Step 3:** đọc version hiện tại của `plugins/frontend/.manifest.json` và `workflows/.manifest.json`; tăng patch (mong đợi 1.16.3 → 1.16.4 và 3.16.2 → 3.16.3; nếu master đã đổi thì lấy số lớn hơn số hiện tại), rồi chạy `npm run build` (exit 0) và `node cli/lib/versions.mjs --lock` (exit 0, `plugins/_versions.lock.json` đổi đúng hai plugin).
- [ ] **Step 4:** chạy `npm test` một lần; kết quả mong đợi: exit 0 gồm `54-codegen-compat`. Ghi dòng tổng vào báo cáo.
- [ ] **Step 5:** kiểm tay AC5.2 trong thư mục tạm ngoài repo (scratchpad của phiên): `package.json` có `typescript: 7.0.2`, chạy `npm install --dry-run --ignore-scripts openapi-typescript@7.13.0` (mong đợi exit 1, `ERESOLVE` nêu `peer typescript@"^5.x"`), rồi `npx --yes -p typescript@5.9.3 -p openapi-typescript@7.13.0 openapi-typescript <file openapi.yaml> -o <file .d.ts tạm>` (mong đợi exit 0, file được ghi). Không có mạng thì ghi `not_run` kèm lý do. Commit: `docs(specs): record codegen compat requirement; chore(frontend): bump versions`.
