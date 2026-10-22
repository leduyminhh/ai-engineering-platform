# Spec sống theo năng lực (P7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm loại template `spec`, mục `Ảnh hưởng spec` trong design, cảnh báo W10–W14 trong `check-request.mjs`, bước gộp spec trong baseline, và `docs/specs/README.md` liệt kê 7 năng lực của aip.
**Architecture:** Mở rộng `core/skills/artifact-templates/scripts/check-request.mjs` theo mẫu sẵn có (hàm thuần `checkRequest(texts, opts)` nhận I/O qua callback; `main` nối I/O thật). Template `spec` nằm cạnh các template khác và `cli/lib/templates.mjs` ánh xạ nó sang `docs/specs/_TEMPLATE.md`. Baseline sửa ở `core/agents/AGENTS.template.md` rồi chép sang `AGENTS.md`.
**Tech Stack:** Node 20+ ESM, chỉ built-in; harness `test/validate.mjs` (contract modules), `node:test` cho `test/init.test.mjs`.
**Spec:** design.md
**Requirement:** không có

## Global Constraints

- Zero-dep; UTF-8 không BOM, LF; comment code tiếng Việt chỉ nêu *vì sao*; baseline viết tiếng Anh; README.md tiếng Anh, README_VI.md tiếng Việt có dấu; nội dung template/spec tiếng Việt.
- `check-request.mjs` chỉ cảnh báo: exit 0, exit 1 khi `--strict` mà có cảnh báo, exit 2 khi sai đối số. W10–W14 chỉ chạy khi caller cấp `readSpec` (lời gọi cũ chỉ truyền `texts`/`readTest` giữ nguyên hành vi W1–W9).
- Mục `## Ảnh hưởng spec` có hai dạng: `- <năng-lực>: thêm R<n>, đổi R<m>, bỏ R<k>` (mỗi mục `<hành động> R<n>`, hành động ∈ `thêm|đổi|bỏ`) hoặc `Không ảnh hưởng: <lý do>` (lý do không rỗng). Dòng trong khối ``` bỏ qua (dùng `linesOf` có sẵn).
- Năng lực hợp lệ khớp `^[a-z0-9][a-z0-9-]*$`; spec ở `<request-dir>/../../specs/<năng-lực>/spec.md`. Không đọc file ngoài `specs/` (tên có `/`, `..` → W11, không đọc).
- ID yêu cầu `<năng-lực>/R<n>`, khớp `^[a-z0-9][a-z0-9-]*/R\d+$`. Yêu cầu bị bỏ: dòng dạng `- ~~**<id>** — …~~ đã bỏ bởi [<slug>](…)`.
- Spec mẫu có các mục H2: `Mục đích`, `Phạm vi`, `Yêu cầu`, `Lịch sử` (bảng `Ngày | Request | ID | Thêm/đổi/bỏ`).
- Tên test bắt đầu bằng ID AC (`AC3.1: …`). Giữa các task chỉ chạy test có mục tiêu; `npm test` toàn bộ xanh ở Task 6.
- Không bump plugin ngoài những cái `versions.mjs` buộc phải bump. Commit mỗi task qua `core:git-workflow` (`git commit -F`), không dòng `Co-Authored-By`; không push.

## Review Focus

- Request cũ không có mục `Ảnh hưởng spec` → đúng một W10, không crash, các W1–W9 giữ nguyên → test ở Task 2.
- Mục nằm trong khối code fence → bị bỏ qua, không tính là mục thật → Task 2.
- `R1` và `R10`: spec có `x/R10` mà design nói `đổi R1` → W12 (không khớp tiền tố) → Task 3.
- Tên năng lực kiểu `../x` hoặc `a/b` → W11 và không đọc ngoài `docs/specs` → Task 3.
- Spec/design dùng CRLF hoặc có BOM → vẫn parse đúng → Task 3.
- `--base` ở thư mục không phải git, hoặc ref không tồn tại → không crash, không W13 giả → Task 4.
- Dòng `Không ảnh hưởng:` rỗng lý do → W10 → Task 2.

---

### Task 1: Template `spec` và đích `aip init`

**Phủ AC:** AC1.1, AC1.2, AC2.2
**Files:**
- Create: `core/skills/artifact-templates/references/spec.template.md`
- Modify: `core/skills/artifact-templates/SKILL.md` (bảng mục lục), `cli/lib/templates.mjs:12-15` (danh sách cặp template → đích)
- Test: `test/contract/35-artifact-templates.contract.mjs`, `test/init.test.mjs`

**Interfaces:**
- Produces: loại `spec` trong mục lục; đích init `docs/specs/_TEMPLATE.md`; các heading và mẫu dòng đã nêu ở Global Constraints.

- [x] **Step 1: Viết test đỏ.** Trong contract 35: thêm `'spec'` vào `TYPES` (đổi nhãn "đúng 10 loại" thành 11); `AC1.1:` mục lục có dòng `spec` với `validator` chứa `check-request.mjs`; `AC1.2:` `spec.template.md` có đủ bốn heading H2 và hai mẫu dòng yêu cầu (một dòng thêm, một dòng `~~…~~ đã bỏ bởi`). Trong `test/init.test.mjs` thêm test `AC2.2: init --full sinh docs/specs/_TEMPLATE.md từ core, đã bỏ khối header` và test không ghi đè file đã có (theo mẫu test `_TEMPLATE/plan.md` ở dòng 62).
- [x] **Step 2: Chạy, xác nhận đỏ.** Run: `node test/validate.mjs --build --only artifact` và `node test/init.test.mjs`. Expected: FAIL (thiếu loại `spec`, thiếu đích).
- [x] **Step 3: Tạo `spec.template.md`** theo khối header của các template khác (`type: spec`, `version: 1`, `validator: scripts/check-request.mjs`, `sources` ghi design P7 và Kiro/Spec Kit/Thoughtworks "spec-anchored") và khung ở Global Constraints; hai dòng yêu cầu mẫu dùng `<năng-lực>` làm giữ chỗ.
- [x] **Step 4: Thêm dòng `spec` vào bảng mục lục `SKILL.md`** (cùng cột như các dòng khác) và cặp `['spec.template.md', 'docs/specs/_TEMPLATE.md']` vào danh sách trong `cli/lib/templates.mjs`.
- [x] **Step 5: Chạy, xác nhận xanh.** Run: `node test/validate.mjs --build --only artifact` và `node test/init.test.mjs`. Expected: PASS (nếu test init khác đếm danh sách file cố định thì cập nhật cho đúng).
- [x] **Step 6: Commit** `feat(core): add spec template and init target for living specs`.

### Task 2: Mục `Ảnh hưởng spec` và W10

**Phủ AC:** AC2.1, AC3.1
**Files:**
- Modify: `core/skills/artifact-templates/references/design.template.md`, `core/skills/artifact-templates/scripts/check-request.mjs`
- Create: `test/contract/36-living-spec.contract.mjs`
- Test: `test/contract/36-living-spec.contract.mjs`, `test/contract/35-artifact-templates.contract.mjs`

**Interfaces:**
- Produces: `export function parseImpact(lines: string[]): { found: boolean, line: number, none: { reason: string } | null, entries: Array<{ cap: string, items: Array<{ action: 'thêm'|'đổi'|'bỏ', n: number }>, line: number }> }` (`lines` từ `linesOf`; `line` là số dòng 1-based của heading, 0 nếu không thấy).
- Produces: `checkRequest(texts, { readTest, override, readSpec, changedSpecs })` — Task này chỉ thêm W10 và nhận tham số `readSpec`; kiểu `readSpec(cap: string) => string | null` (kèm tuỳ chọn riêng `linkExists(href, cap) => boolean`) được dùng ở Task 3.

- [x] **Step 1: Viết test đỏ** trong module mới `36-living-spec.contract.mjs` (`export default async function run({ ok, ctx })`, theo mẫu import của contract 35): bảng tham số hóa cho `parseImpact` (dòng `- hooks-gates: thêm R12, đổi R3`, dòng `Không ảnh hưởng: lý do`, `Không ảnh hưởng:` rỗng, mục trong code fence, không có heading); `AC3.1:` `checkRequest` với `readSpec` có cấp: design thiếu mục → đúng một W10; design có `Không ảnh hưởng: x` → không W10; `Không ảnh hưởng:` rỗng → W10; không cấp `readSpec` → không W10. `AC2.1:` `design.template.md` chứa `## Ảnh hưởng spec` và cả hai dạng mẫu (đặt trong contract 35 cạnh các kiểm template khác).
- [x] **Step 2: Chạy, xác nhận đỏ.** Run: `node test/validate.mjs --build --only living` và `--only artifact`. Expected: FAIL (hàm chưa có).
- [x] **Step 3: Viết `parseImpact`** trong `check-request.mjs` (export), heading H2 chứa "ảnh hưởng spec" không phân biệt hoa thường; tách mục theo `,`; bỏ dòng trong fence nhờ `linesOf`.
- [x] **Step 4: Thêm W10 vào `checkRequest`**: khi có `readSpec` và `texts['design.md']`: `!found` → W10 tại dòng 1; `found` nhưng `none` rỗng lý do và không có `entries` → W10 tại dòng heading. Thêm mục `## Ảnh hưởng spec` (sau `## Thiết kế`) vào `design.template.md` với hai dạng mẫu.
- [x] **Step 5: Nối `main`**: cấp `readSpec` thật (Task 3 hoàn thiện đọc file); tạm cấp hàm trả `null`. Cập nhật dòng chú thích đầu file và dòng usage nếu cần.
- [x] **Step 6: Chạy, xác nhận xanh.** Run: `node test/validate.mjs --build --only living`, `--only artifact`, và `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-21-living-spec`. Expected: PASS; lệnh cuối in `[W10]` (design chưa có mục) và exit 0.
- [x] **Step 7: Commit** `feat(core): add impact section to design template and W10 check`.

### Task 3: Đọc spec, W11, W12, W14

**Phủ AC:** AC3.2, AC3.3, AC3.5
**Files:**
- Modify: `core/skills/artifact-templates/scripts/check-request.mjs`
- Test: `test/contract/36-living-spec.contract.mjs`

**Interfaces:**
- Consumes: `parseImpact`, `readSpec`, `linesOf` (Task 2).
- Produces: `export function parseSpec(text: string, folder: string): { reqs: Map<string, { line: number, removed: boolean }>, problems: Array<{ line: number, msg: string }>, links: Array<{ line: number, href: string }> }`; `main` cấp `readSpec(cap) => string | null` và `linkExists(href, cap)` thật theo `path.resolve(dir, '..', '..', 'specs')`.

- [x] **Step 1: Viết test đỏ** (tham số hóa theo fixture văn bản spec/design, không chạm đĩa): `parseSpec` đọc đúng yêu cầu thường, yêu cầu `~~…~~ đã bỏ bởi`, và báo `problems` cho ID sai định dạng, ID trùng, tiền tố khác `folder`; `AC3.2:` năng lực không tồn tại (`readSpec` → null) → W11; tên `../x`, `a/b` → W11 và `readSpec` không được gọi; `AC3.3:` `đổi R3` mà spec không có `x/R3` → W12; `bỏ R3` mà dòng chưa `đã bỏ` → W12; `đổi R1` khi spec chỉ có `x/R10` → W12; `thêm R9` không kiểm; `AC3.5:` mỗi `problems` của `parseSpec` ra một W14, link trong bảng Lịch sử mà `linkExists` trả false → W14; spec CRLF/BOM parse như nhau. Một test CLI end-to-end trên thư mục tạm (`docs/requests/r1/design.md` + `docs/specs/x/spec.md`) kiểm main đọc đúng đường dẫn `../../specs`.
- [x] **Step 2: Chạy, xác nhận đỏ.** Run: `node test/validate.mjs --build --only living`. Expected: FAIL.
- [x] **Step 3: Viết `parseSpec`** (heading H2 `Yêu cầu` giới hạn vùng yêu cầu; dòng yêu cầu khớp `^\s*[-*]\s+(~~)?\*\*([^*]+)\*\*`; `removed` khi dòng bắt đầu `~~` và chứa `đã bỏ bởi`; `links` lấy mọi `](href)` tương đối trong toàn file, bỏ `http(s):` và `#`).
- [x] **Step 4: Thêm W11/W12/W14 vào `checkRequest`** cho từng `entry` của `parseImpact`; mỗi spec chỉ đọc và kiểm W14 một lần dù nhiều mục. Trong `main`, `readSpec(cap)` đọc `specs/<cap>/spec.md` (UTF-8, bỏ BOM) và `linkExists(href, cap)` resolve theo thư mục chứa spec.
- [x] **Step 5: Chạy, xác nhận xanh.** Run: `node test/validate.mjs --build --only living` rồi `--only artifact`. Expected: PASS.
- [x] **Step 6: Commit** `feat(core): validate impacted specs with W11, W12 and W14`.

### Task 4: `--base` và W13

**Phủ AC:** AC3.4
**Files:**
- Modify: `core/skills/artifact-templates/scripts/check-request.mjs`
- Test: `test/contract/36-living-spec.contract.mjs`

**Interfaces:**
- Consumes: `checkRequest` option `changedSpecs: Set<string> | null` (`null` = không chạy W13); `main` đọc cờ `--base <ref>`.

- [x] **Step 1: Viết test đỏ:** `AC3.4:` `changedSpecs` = rỗng và design nêu `x: đổi R1` → W13; `changedSpecs` có `x` → không W13; `changedSpecs` = null → không W13; `Không ảnh hưởng` → không W13. CLI trong repo git tạm (`git init`, commit spec, đổi/không đổi sau `--base HEAD`): W13 đúng như trên; thư mục không phải git và ref sai → không crash, không W13; `--base` thiếu giá trị → exit 2 kèm usage.
- [x] **Step 2: Chạy, xác nhận đỏ.** Run: `node test/validate.mjs --build --only living`. Expected: FAIL.
- [x] **Step 3: Thêm W13 vào `checkRequest`** và parse `--base <ref>` trong `main` (giá trị bắt buộc; cập nhật usage thành `[--tests <path>…] [--base <ref>] [--strict]`). Tính `changedSpecs` bằng `git diff --name-only <ref>` kèm `git ls-files --others --exclude-standard` trên `docs/specs`, chạy tại gốc project (`projectRoot`); mọi lỗi git → `null`.
- [x] **Step 4: Chạy, xác nhận xanh.** Run: `node test/validate.mjs --build --only living`. Expected: PASS.
- [x] **Step 5: Commit** `feat(core): warn when impacted spec is unchanged since base ref`.

### Task 5: Baseline, tài liệu và `docs/specs/README.md`

**Phủ AC:** AC4.1, AC4.2, AC5.1
**Files:**
- Modify: `core/agents/AGENTS.template.md` (mục `#### Docs location and format`, bảng `#### Memory and resume`), `AGENTS.md` (chép byte-for-byte), `CLAUDE.md`, `README.md`, `README_VI.md`, `core/skills/artifact-templates/SKILL.md` (đoạn mô tả W-code)
- Create: `docs/specs/README.md`
- Test: `test/content/22-living-spec.pin.mjs`, `test/contract/70-bytes.contract.mjs`

**Interfaces:**
- Consumes: định dạng mục `Ảnh hưởng spec` và W10–W14 (Task 2–4).

- [x] **Step 1: Viết test đỏ:** pin `AC4.1:` baseline có bước gộp spec trước `finishing-a-development-branch` (nhắc `docs/specs/<capability>/spec.md`, `Ảnh hưởng spec`, bảng Lịch sử, `docs/specs/README.md` khi tạo năng lực mới, `check-request.mjs`) và bảng bộ nhớ có spec sống ở dòng dài hạn; test byte-for-byte `AGENTS.md` = template giữ nguyên; `AC5.1:` `docs/specs/README.md` có đủ 7 tên năng lực và không có `spec.md` nào dưới `docs/specs/`.
- [x] **Step 2: Chạy, xác nhận đỏ.** Run: `node test/validate.mjs --build --only docs-standard` (và `--only bytes`). Expected: FAIL.
- [x] **Step 3: Sửa baseline** (tiếng Anh, ngắn): thêm một bullet bước gộp và một dòng trong bảng bộ nhớ (`Long-term` thêm `docs/specs/`); chép sang `AGENTS.md`.
- [x] **Step 4: Viết `docs/specs/README.md`** với bảng 7 năng lực (tên, mô tả một dòng, đường dẫn dự kiến `docs/specs/<tên>/spec.md`): `projection` — build, adapter, định dạng file theo provider; `install-lifecycle` — install/uninstall/update/check, manifest, managed block; `hooks-gates` — guard-bash/files, gate-stop, session-start, `aip-gate.json`; `workflows` — workflow, orchestrator, graph; `artifact-templates` — template, `check-request`, quy ước docs/requests; `baseline` — baseline AGENTS.md: quy tắc, routing model/phiên; `cli-wizard` — init, wizard, stats, args. Thêm một đoạn nói spec sống tạo khi request kế tiếp chạm tới năng lực.
- [x] **Step 5: Cập nhật `CLAUDE.md`, `README.md`, `README_VI.md`, `SKILL.md`**: ở mọi chỗ đang mô tả loại template và cảnh báo của `check-request.mjs` (tìm bằng `grep -n "check-request\|W7\|W8" CLAUDE.md README.md README_VI.md core/skills/artifact-templates/SKILL.md`), thêm loại `spec`, W10–W14 và `docs/specs/`; sửa các con số "9 loại"/"10 loại" cho đúng (kiểm bằng grep).
- [x] **Step 6: Chạy, xác nhận xanh.** Run: `node test/validate.mjs --build --only docs-standard`, `--only bytes`. Expected: PASS.
- [x] **Step 7: Commit** `docs(core): document living specs in baseline, README and docs/specs index`.

### Task 6: Version, lock và toàn bộ test

**Phủ AC:** AC6.1
**Files:**
- Modify: `core/.manifest.json`, `plugins/_versions.lock.json`, `CHANGELOG.md`
- Test: toàn repo (`npm test`)

- [x] **Step 1:** Bump `core/.manifest.json` version `1.9.0` → `1.10.0`; chạy `npm run build` rồi `node cli/lib/versions.mjs --lock`. Nếu lock từ chối vì plugin/workflow khác đổi nội dung chiếu mà chưa bump thì bump đúng plugin đó (theo thông báo của công cụ), không bump plugin khác. Thêm mục `core 1.10.0` vào `CHANGELOG.md` theo định dạng các mục trước.
- [x] **Step 2:** Run `npm test`. Expected: exit 0; validate, install, wizard, init, pack-guard, args, transcript-stats đều 0 fail.
- [x] **Step 3:** Run `npm run pack:verify`. Expected: exit 0.
- [x] **Step 4:** Run `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-21-living-spec`. Expected: không W4; W10–W14 chỉ có W10 (design P7 không có mục `Ảnh hưởng spec` — chấp nhận, request này mở đầu cơ chế) — nếu muốn sạch, thêm mục `## Ảnh hưởng spec` với `Không ảnh hưởng: P7 tạo cơ chế, chưa có spec sống nào` vào `design.md` của request này và chạy lại (khuyến nghị).
- [x] **Step 5:** Tick AC1.1–AC6.1 trong `design.md` của request này khi có bằng chứng từ các bước trên; commit `chore(core): bump core to 1.10.0 and lock versions`.
- [x] **Step 6:** Dừng, báo người dùng nhánh `feature/living-spec` để duyệt diff; không merge, không push.
