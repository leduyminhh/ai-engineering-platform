# Chuẩn hóa docs/spec cho luồng superpowers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa chuẩn của aip vào luồng superpowers. Spec và plan ghi vào `docs/requests/<yyyy-mm-dd>-<slug>/`. AC có ID. Có quy ước bộ nhớ và resume. Script `check-request.mjs` cảnh báo khi docs lệch chuẩn. Skill và workflow liên quan đi theo cùng chuẩn.

**Architecture:**
- Chuẩn được viết vào managed block `AGENTS.md` dưới dạng preference, đủ để ghi đè mặc định `docs/superpowers/` của superpowers.
- Template requirement/design/plan đã có trong skill core `artifact-templates` (project 1b, merge `c337dbc`).
- Script kiểm tra đặt trong cùng skill core, lấp ô "chưa có" của validator. Cùng mẫu với `check-tasks.mjs`.

**Tech Stack:** Node.js ≥ 20, ESM, chỉ dùng `node:*`. Harness `test/validate.mjs` (`ok`, `ctx`, `--only`, `--build`).

**Spec:** design.md

**Requirement:** không có

## Global Constraints

**Kỹ thuật và ngôn ngữ**
- Zero runtime dependency. ESM. UTF-8 không BOM. LF.
- Baseline (`core/agents/AGENTS.template.md`) viết tiếng Anh. Skill, workflow và template viết tiếng Việt có dấu.
- `AGENTS.md` ở gốc repo phải giống `core/agents/AGENTS.template.md` (contract `30-templates`).

**Phạm vi được và không được sửa**
- Không sửa plugin superpowers.
- Không thêm `→ superpowers` vào description, vì validator `cli/lib/conventions.mjs` chỉ nhận id có trong repo.

**Định dạng AC và cảnh báo**
- AC có dạng `AC<n>.<m>`, regex `^AC\d+\.\d+$`, viết theo Given/When/Then.
- `<n>` là số thứ tự requirement. `engineering-task-breakdown` dùng lại ID AC có sẵn.
- Script `check-request.mjs`:
  - Mỗi cảnh báo in một dòng `WARN <file>:<dòng> [<mã>] <mô tả>`.
  - Dòng cuối in `<n> cảnh báo`.
  - Exit 0 khi chạy được, exit 2 khi đối số sai.

**Version và commit**
- Bump version và chạy `node cli/lib/versions.mjs --lock` **chỉ ở Task 5**. Task 1–4 chỉ chạy test có chọn lọc bằng `--only`.
- Mỗi task một commit, qua `core:git-workflow`:
  - Header tiếng Anh dạng `type(scope): summary`, body tiếng Việt.
  - Commit bằng `git commit -F`.
  - Không push.
  - Không thêm dòng Co-authored-by.
- Branch `feature/superpowers-docs-standard`. Trước Task 1, đưa branch lên `master` bằng `git merge --ff-only master`.

**Quyết định của controller (ghi nhận lúc viết plan)**
- **P1:** Script đặt ở `core/skills/artifact-templates/scripts/check-request.mjs`, khác vị trí "đề xuất" ở design §4.5 (`engineering-spec-writing/scripts/`). Lý do: core luôn được cài, nên baseline gọi script không phụ thuộc plugin `engineering`, và ô validator của requirement/design/plan có nội dung thật.
- **P2:** Các AC2.1–AC2.3 trong design đã đạt ở project 1b: template nằm trong core, `aip init --full` sinh `_TEMPLATE/`, có contract 35 và `init.test.mjs`. Plan này chỉ kiểm lại, không làm lại.
- **P3:** Baseline áp quy tắc template theo design §4.3:
  - `docs/requests/_TEMPLATE/` của project chỉ được dùng khi có `design.md`.
  - Nếu không có, dùng template của skill `artifact-templates`.
  - Quy tắc này khớp với quy tắc "template cũ" của project 1b: không ghi đè, chỉ báo và gợi ý cập nhật.

## Review Focus

Mỗi rủi ro dưới đây đều có test ở Task 1.

- **File Windows có CRLF/BOM:** script vẫn nhận đúng heading và AC.
- **AC mẫu trong khối code ```:** không tính là AC thật, không báo trùng. Ví dụ: chính design.md của project này có template ví dụ nằm trong khối code.
- **Heading `Tiêu chí chấp nhận` ở dạng NFD hoặc có số thứ tự phía trước** (`## 3. Tiêu chí chấp nhận`): vẫn nhận.
- **Thư mục chỉ có `plan.md`, không có nguồn AC:** cảnh báo `W1`, không crash.
- **Đối số là file thay vì thư mục:** exit 2.

---

### Task 1: Script `check-request.mjs` trong skill core

**Phủ AC:** AC4.1, AC4.2, AC4.3

**Files:**
- Create: `core/skills/artifact-templates/scripts/check-request.mjs`
- Modify:
  - `core/skills/artifact-templates/SKILL.md`:
    - Ô Validator của 3 dòng `requirement`, `design`, `plan` → `scripts/check-request.mjs`.
    - Bước chạy validator trong `## Quy trình` gọi script này.
    - `## Bản đồ tài liệu` thêm link script.
  - `references/{requirement,design,plan}.template.md`: dòng `validator:` trong header phải giống hệt ô mục lục (contract 35 kiểm điều này).
- Create: `test/content/18-superpowers-docs-standard.pin.mjs`

**Interfaces:**
- Produces:
  - `export function checkRequest(texts: Record<string, string>): Array<{ file: string, line: number, code: string, msg: string }>`
    - Key của `texts` là tên file: `'requirement.md'`, `'design.md'`, `'plan.md'`, `'tasks.md'`.
    - Key nào vắng thì coi như file đó không tồn tại.
  - `export function main(argv: string[]): number`
    - `argv[0]` là thư mục request. Đọc 4 file nếu có.
    - In cảnh báo, rồi dòng tổng `<n> cảnh báo`. Trả về exit code.
  - Mã cảnh báo:

    | Mã | Khi nào |
    |---|---|
    | `W1` | Không có nguồn AC |
    | `W2` | AC nằm ở cả `requirement.md` lẫn `design.md` |
    | `W3` | AC trùng ID |
    | `W4` | AC sai định dạng |
    | `W5` | `plan.md` thiếu `**Goal:**` hoặc `**Spec:**` |
    | `W6` | AC không task nào phủ |

  - Module pin `test/content/18-superpowers-docs-standard.pin.mjs`. Task 2–4 thêm block vào cùng file này.

- [x] **Step 1: Viết test đỏ (một test tham số hóa).**
  - Import script qua `pathToFileURL` (lấy từ `ctx`).
  - Fixture `OK` gồm:
    - `design.md` có `## 3. Tiêu chí chấp nhận`, trong đó có `- [ ] **AC1.1** — Given a When b Then c` và `- [ ] **AC1.2** — Given c When d Then e`. Thêm một khối ```` ```markdown ```` chứa `**AC1.1**`; khối này phải bị bỏ qua.
    - `plan.md` có `**Goal:** x`, `**Spec:** design.md`, và hai dòng `**Phủ AC:** AC1.1` và `**Phủ AC:** AC1.2`, mỗi dòng đứng đầu dòng.

  ```js
  const codes = (t) => cr.checkRequest(t).map((w) => w.code).sort().join(',');
  ok(codes(OK) === '', 'AC4.1: thư mục hợp lệ → 0 cảnh báo');
  const cases = [
    ['W1', { 'plan.md': OK['plan.md'] }],
    ['W2', { ...OK, 'requirement.md': '## Tiêu chí chấp nhận\n- [ ] **AC1.1** — Given a When b Then c\n' }],
    ['W3', { ...OK, 'design.md': OK['design.md'].replace('**AC1.2**', '**AC1.1**') }],
    ['W4', { ...OK, 'design.md': OK['design.md'].replace('**AC1.2**', '**AC-2**') }],
    ['W5', { ...OK, 'plan.md': OK['plan.md'].replace('**Goal:** x', '') }],
    ['W6', { ...OK, 'plan.md': OK['plan.md'].replace('**Phủ AC:** AC1.2', '') }],
    ['', { ...OK, 'design.md': '﻿' + OK['design.md'].replace(/\n/g, '\r\n') }],
    ['', { ...OK, 'design.md': OK['design.md'].normalize('NFD') }],
    ['', { 'design.md': OK['design.md'] }],
  ];
  for (const [want, t] of cases) ok(codes(t).includes(want) && (want || codes(t) === ''), `AC4.2: ${want || 'biến thể sạch'} đúng`);
  ```

  - Kiểm CLI (AC4.3): `cr.main([])` → `2`; `cr.main([<đường dẫn chính file pin>])` → `2`.
- [x] **Step 2: Chạy để xác nhận đỏ.** Lệnh: `node test/validate.mjs --only 18-superpowers`. Kết quả mong đợi: FAIL (chưa có script).
- [x] **Step 3: Hiện thực** theo design §4.5.
  - Chuẩn hóa text: bỏ BOM → `normalize('NFC')` → đổi CRLF thành LF. Bỏ qua các dòng nằm trong khối ```, nhưng vẫn giữ số dòng gốc.
  - Mục AC là heading `#{2,4}` có chứa `Tiêu chí chấp nhận`, kéo dài tới heading cùng cấp hoặc cao hơn.
  - ID AC lấy từ `**…**` ở đầu dòng bullet.
  - Độ phủ chỉ kiểm khi có `plan.md` hoặc `tasks.md`. Một AC được tính là đã phủ khi:
    - nằm trong một dòng của plan **bắt đầu bằng** `**Phủ AC:**`, hoặc
    - khớp `AC\d+\.\d+` ở bất kỳ đâu trong `tasks.md`.
  - Phát hiện script được chạy trực tiếp bằng realpath, giống `check-tasks.mjs`.
- [x] **Step 4: Chạy để xác nhận xanh.** Lệnh: `node test/validate.mjs --build --only 18-superpowers --only 35-artifact --only 10-source --only 20-build`. Kết quả mong đợi: 0 fail.
- [x] **Step 5: Commit** — `feat(core): add check-request script to artifact-templates`

---

### Task 2: Baseline — vị trí docs, quy ước AC, bộ nhớ và resume

**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4

**Files:**
- Modify: `core/agents/AGENTS.template.md`. Thêm vào mục `### Superpowers workflow defaults`, ngay sau bullet `finishing-a-development-branch`.
- Modify: `AGENTS.md`, chép y hệt template.
- Modify: `test/content/18-superpowers-docs-standard.pin.mjs`.

- [x] **Step 1: Viết test đỏ.**

  ```js
  const tpl = fs.readFileSync(path.join(REPO_ROOT, 'core', 'agents', 'AGENTS.template.md'), 'utf8');
  const sp = tpl.slice(tpl.indexOf('### Superpowers workflow defaults'), tpl.indexOf('### Language'));
  ok(sp.includes('docs/requests/<yyyy-mm-dd>-<slug>/design.md') && sp.includes('`plan.md` in the same folder')
    && sp.includes('overrides the superpowers default `docs/superpowers/`'), 'AC1.1: baseline ghi đè vị trí docs');
  ok(sp.includes('`AC<n>.<m>`') && sp.includes('Given/When/Then') && sp.includes('one file per change')
    && sp.includes('`**Phủ AC:**`') && sp.includes('`Không đổi`'), 'AC1.2: baseline có quy ước AC');
  ok(sp.includes('| Short-term |') && sp.includes('| Long-term |') && sp.includes('first unchecked task')
    && sp.includes('never create a second folder'), 'AC1.4: baseline có bảng bộ nhớ + quy tắc resume');
  ok(sp.includes('only when it contains `design.md`') && sp.includes('`artifact-templates`')
    && sp.includes('check-request.mjs'), 'P1/P3: baseline trỏ template core + script kiểm tra');
  ```

- [x] **Step 2: Chạy để xác nhận đỏ.** Lệnh: `node test/validate.mjs --only 18-superpowers`. Kết quả mong đợi: FAIL ở AC1.1, AC1.2, AC1.4.
- [x] **Step 3: Thêm hai tiểu mục vào template:** `#### Docs location and format` và `#### Memory and resume`.
  - Nội dung bám design §4.3, §4.6 và quyết định P1, P3.
  - Câu chữ tự do, nhưng phải chứa đủ các chuỗi mà Step 1 kiểm.
  - Ý cần có: chạy `check-request.mjs` của skill `artifact-templates` sau khi viết `design.md` và sau khi viết `plan.md`. Script chỉ cảnh báo, không chặn.
  - Sau đó chép template sang `AGENTS.md`.
- [x] **Step 4: Chạy để xác nhận xanh.** Lệnh: `node test/validate.mjs --only 18-superpowers --only 30-templates`. Kết quả mong đợi: 0 fail. Dòng `AGENTS.md == AGENTS.template.md` xanh (AC1.3).
- [x] **Step 5: Commit** — `feat(core): set docs location, AC ids and resume rules in baseline`

---

### Task 3: Skill engineering — AC có ID, bỏ khung plan, dùng lại ID AC

**Phủ AC:** AC3.1, AC3.3

**Files:**
- Modify `plugins/engineering/skills/engineering-spec-writing/SKILL.md`:
  - Dòng 53: bỏ "(+ khung `plan.md`)". Thêm quy tắc ID `AC<n>.<m>`, với `<n>` là số thứ tự requirement.
  - Dòng 99: map vào `requirement.md` (+ `design.md` khi có). Bỏ ý dựng `plan.md`.
  - Mục `## Verification`: chạy `check-request.mjs` của skill `artifact-templates`.
- Modify `plugins/engineering/skills/engineering-spec-writing/references/checklist.md:36`: bỏ "khung `plan.md` đã dựng".
- Modify `plugins/engineering/skills/engineering-spec-writing/references/spec-structure.md`:
  - Mục "Acceptance criteria ĐO ĐƯỢC": thêm quy tắc ID.
  - Dòng 62: `_TEMPLATE` gồm cả `design.md`.
- Modify `plugins/engineering/agents/engineering-spec-analyst.md`, các dòng 17, 32, 47:
  - Bỏ "khung `plan.md`".
  - Danh sách file được ghi phải có `design.md`.
- Modify `plugins/engineering/skills/engineering-task-breakdown/references/analysis.md:33`:

  > Nguồn đã có AC mang ID `AC<n>.<m>` (requirement.md hoặc design.md) → dùng lại nguyên ID, không đánh số lại. Chỉ khi nguồn chưa có ID mới đánh số `AC<uc>.<n>` (vd `AC1.2`).

- Modify `plugins/engineering/skills/engineering-task-breakdown/SKILL.md:44-45`: khi không có `requirement.md` thì `design.md` là nguồn chính.
- Modify `test/content/18-superpowers-docs-standard.pin.mjs`.

- [x] **Step 1: Viết test đỏ.**

  ```js
  const SW = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-spec-writing');
  const r = (p) => fs.readFileSync(p, 'utf8');
  const skill = r(path.join(SW, 'SKILL.md'));
  ok(skill.includes('`AC<n>.<m>`') && skill.includes('check-request.mjs'), 'AC3.1: spec-writing dùng ID AC + gọi check-request');
  for (const p of [path.join(SW, 'SKILL.md'), path.join(SW, 'references', 'checklist.md'),
    path.join(PLUGINS_DIR, 'engineering', 'agents', 'engineering-spec-analyst.md')])
    ok(!r(p).includes('khung `plan.md`'), `AC3.1: ${path.basename(p)} không còn dựng khung plan.md`);
  ok(r(path.join(PLUGINS_DIR, 'engineering', 'agents', 'engineering-spec-analyst.md')).includes('design.md'),
    'AC3.1: spec-analyst liệt kê design.md');
  const TB = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-task-breakdown');
  ok(r(path.join(TB, 'references', 'analysis.md')).includes('dùng lại nguyên ID'), 'AC3.3: dùng lại ID AC của nguồn');
  ok(/không có `requirement\.md`.*`design\.md`/s.test(r(path.join(TB, 'SKILL.md'))), 'AC3.3: đọc AC từ design.md khi không có requirement.md');
  ```

- [x] **Step 2: Chạy để xác nhận đỏ.** Lệnh: `node test/validate.mjs --only 18-superpowers`. Kết quả mong đợi: FAIL ở AC3.1 và AC3.3.
- [x] **Step 3: Sửa các file** theo danh sách Files. Không đụng `description` và trigger.
- [x] **Step 4: Chạy để xác nhận xanh.** Lệnh: `node test/validate.mjs --only 18-superpowers --only 40-conv --only 13-task --only 14-task --only 17-legacy`. Kết quả mong đợi: 0 fail.
- [x] **Step 5: Commit** — `feat(engineering): use AC ids and drop plan skeleton in spec skills`

---

### Task 4: Workflow — superpowers là quy trình chính

**Phủ AC:** AC3.2

**Files:**
- Modify mục `## Điều kiện tiên quyết` trong 3 file:
  - `workflows/feature/WORKFLOW.md`
  - `workflows/bugfix/WORKFLOW.md`
  - `workflows/orchestrator/WORKFLOW.md`. Không sửa bảng Registry vì bảng này được parse.
- Modify: `test/content/18-superpowers-docs-standard.pin.mjs`.

- [x] **Step 1: Viết test đỏ.**

  ```js
  for (const wf of ['feature', 'bugfix', 'orchestrator']) {
    const t = fs.readFileSync(path.join(REPO_ROOT, 'workflows', wf, 'WORKFLOW.md'), 'utf8');
    const i = t.indexOf('## Điều kiện tiên quyết');
    const pre = t.slice(i, t.indexOf('\n## ', i + 5));
    ok(pre.includes('superpowers:brainstorming') && pre.includes('docs/requests/'), `AC3.2: ${wf} nêu nhánh superpowers trong điều kiện tiên quyết`);
  }
  ```

- [x] **Step 2: Chạy để xác nhận đỏ.** Lệnh: `node test/validate.mjs --only 18-superpowers`. Kết quả mong đợi: FAIL ở AC3.2.
- [x] **Step 3: Thêm một bullet vào mỗi file.**
  - Nội dung: nếu project đã cài superpowers thì dùng `superpowers:brainstorming` → `writing-plans` → `subagent-driven-development`, docs ghi vào `docs/requests/<ngày>-<slug>/` theo baseline.
  - Workflow này chỉ chạy khi chưa cài superpowers.
- [x] **Step 4: Chạy để xác nhận xanh.** Lệnh: `node test/validate.mjs --only 18-superpowers --only 50-workflows --only 00-unit`. Kết quả mong đợi: 0 fail.
- [x] **Step 5: Commit** — `feat(workflows): route to superpowers when installed`

---

### Task 5: CLAUDE.md repo, version, lock, kiểm tra toàn bộ, dogfood

**Phủ AC:** AC2.1, AC2.2, AC2.3, AC5.1, AC5.2

**Files:**
- Modify `CLAUDE.md`, mục `## Superpowers workflow defaults`. Thêm dòng:
  - Spec và plan từ nay ghi vào `docs/requests/<yyyy-mm-dd>-<slug>/` (`design.md`, `plan.md`).
  - 15 spec cũ trong `docs/superpowers/` giữ nguyên làm lịch sử.
- Modify version:
  - `core/.manifest.json`: `1.6.1` → `1.7.0`
  - `plugins/engineering/.manifest.json`: `2.1.1` → `2.2.0`
  - `workflows/.manifest.json`: `3.0.1` → `3.1.0`
  - Bump thêm plugin nào mà `versions.mjs --lock` yêu cầu.
- Modify `CHANGELOG.md`: thêm vào `[Unreleased]` 4 thay đổi:
  - Baseline ghi đè vị trí docs.
  - Script `check-request.mjs`.
  - AC có ID.
  - Workflow chuyển hướng sang superpowers khi đã cài.
- Modify `plugins/_versions.lock.json` (sinh bằng lệnh).

- [ ] **Step 1: Kiểm lại AC2.1–AC2.3 đã đạt ở 1b (P2).** Lệnh: `node test/init.test.mjs` và `node test/validate.mjs --only 35-artifact`. Kết quả mong đợi: 0 fail. Riêng `init --full` phải sinh đủ `docs/requests/_TEMPLATE/{requirement,design,plan}.md`.
- [ ] **Step 2: Sửa CLAUDE.md, CHANGELOG; bump 3 version.**
- [ ] **Step 3: Build và lock.** Lệnh: `npm run build`, rồi `node cli/lib/versions.mjs --lock`. Kết quả mong đợi: lock ghi version mới, không bị từ chối.
- [ ] **Step 4: Chạy toàn bộ.** Lệnh: `npm test < /dev/null` và `npm run pack:verify`. Kết quả mong đợi: exit 0, mọi suite 0 fail.
- [ ] **Step 5: Dogfood.** Lệnh: `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-20-superpowers-docs-standard`. Kết quả mong đợi: `0 cảnh báo`. Điều kiện:
  - Mọi AC trong design.md đều nằm trong một dòng `**Phủ AC:**` của plan này.
  - AC mẫu trong khối code bị bỏ qua.
- [ ] **Step 6: Kiểm AC5.1.** Lệnh: `git status --short docs/superpowers`. Kết quả mong đợi: không có file cũ nào bị sửa hay xóa.
- [ ] **Step 7: Commit** — `chore(release): bump core, engineering, workflows for docs standard`
