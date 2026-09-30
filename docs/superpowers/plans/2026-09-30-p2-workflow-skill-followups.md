# P2 còn lại: WF8, WF9, WF10, S5, S6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn tất các mục P2 của spec không phụ thuộc skill/agent draft: S5 (`engineering-quality-gate` trỏ sang `engineering-convention-enforce`), S6 (`engineering-spec-writing` bước 4 trỏ sang `engineering-adr`), WF9 (`workflow-code-review` phủ nhóm CI/IaC/SQL và kiểm drift contract), WF8 (`workflow-release` có bước baseline build/test và kiểm migration chờ chạy), WF10 (`workflow-orchestrator` cho phép chuỗi `db-change → api → feature` và chỉ đường tới skill không có workflow). Assert hợp đồng ở `test/validate.mjs` (khối "16.").

**Architecture:** Docs-only. Sửa 2 file `SKILL.md`, 3 file `workflows/<slug>/WORKFLOW.md` theo khung `cli/lib/workflows.mjs` (`checkWorkflowBody`: 8 trường mỗi bước, đánh số liên tục từ 1, ít nhất một bước ⏸; agent nêu trong `Hành động` phải có trong `Thực hiện` của cùng bước và trong frontmatter `agents`; registry orchestrator: mỗi dòng là `workflow-*` có thật, `risk` khớp frontmatter, cột "Nối tiếp" trỏ tới workflow có thật). Không thêm agent hay workflow mới nên không đụng cột "dùng bởi" ở README.

**Tech Stack:** Markdown + YAML frontmatter (parser zero-dep của repo); harness `ok(cond, msg)` của repo (Node ≥ 20, ESM, zero dependency).

**Spec:** [docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md](../specs/2026-09-29-skill-plugin-workflow-upgrade-design.md) §3.3 (S5, S6), §5.3 (WF8, WF9, WF10), §5.2 (W-a), §9 (pha P2).

## Quyết định của plan (spec không nêu — người duyệt có thể đổi)

| # | Quyết định | Lý do |
|---|---|---|
| D-1 | WF8: "Bước 0 baseline" của spec thành **Bước 1** mới (release có 8 bước); `checkWorkflowBody` bắt buộc đánh số từ 1 nên không có Bước 0 | Khung workflow của repo |
| D-2 | WF8: kiểm migration chờ chạy + thứ tự migration↔deploy nằm trong bước Deploy checklist (Bước 5) do `ops-release-engineer` (chỉ đề xuất, không chạy migration) | Tránh thêm bước và agent mới; agent đã đọc cấu hình deploy |
| D-3 | WF10: các dòng "init project" và "migrate config/secret" là **skill**, không phải workflow, nên KHÔNG thêm vào bảng Registry (validate buộc mọi dòng là workflow có thật); thêm mục `## Yêu cầu chạy trực tiếp bằng skill` sau Registry | `parseRegistry` chỉ đọc `## Registry` và kiểm từng dòng trỏ tới workflow |
| D-4 | WF10: chuỗi `db-change → api → feature` thể hiện bằng cột "Nối tiếp" (`db-change` → `api`; `api` → `feature`), tối đa 3 workflow như luật sẵn có ở Bước 4 | Không đổi luật độ dài chuỗi |
| D-5 | WF11 (Bước 0 baseline cho MỌI workflow sửa code) và WF12 KHÔNG thuộc plan này | WF11 buộc đánh số lại nhiều workflow (rủi ro cao, cần plan riêng); WF12 là P3 |
| D-6 | Nhánh riêng `feature/workflow-p2-followups` từ `master`, độc lập với `refactor/db-migration-to-data-plugin` | Hai nhánh không chung file; người dùng chưa chốt merge nhánh kia |

## Global Constraints

- Docs/tests only: KHÔNG sửa `cli/`, `adapters/`, `core/`, `plugins/_published.json`, agent nào, workflow nào ngoài `code-review`, `release`, `orchestrator`, skill nào ngoài `engineering-quality-gate` và `engineering-spec-writing`.
- Giữ nguyên `name`, `order`, `title`, `kind`, `tier`, `risk`, `requires`, `runsIn`, `invoke` và danh sách `agents` của cả 3 workflow (không thêm/bớt agent).
- KHÔNG nhắc skill/agent draft (`frontend-data-integrator`, `frontend-e2e-test-writer`, `frontend-data-integration`, `frontend-e2e-testing`, `data-db-migration`, `backend-db-migration`) trong nội dung workflow/skill.
- Khung bước theo `checkWorkflowBody`: mọi bước đủ 8 trường `Thực hiện`/`Đầu vào`/`Hành động`/`Ràng buộc`/`Đầu ra`/`Gate`/`Khi fail`/`Evidence`; đánh số liên tục từ 1; agent nêu trong `Hành động` chỉ khi có trong `Thực hiện` của cùng bước.
- Không in/không yêu cầu in giá trị secret; không thêm khẳng định về tiêu chuẩn bên ngoài (mã OWASP/CWE) vào workflow.
- File UTF-8 không BOM, LF. Nội dung tiếng Việt có dấu. Comment chỉ giải thích *why*, tiếng Việt, 1–2 dòng.
- Chỉ thêm assert vào `test/validate.mjs` (khối "16." mới, sau khối "15."); không thêm file test mới; không sửa assert cũ.
- Nếu `validate` báo "ship references/ (parity)" hoặc "thiếu SKILL.md" thì chạy `npm run build` rồi chạy lại. Không `rm -rf` thư mục chứa junction [[windows-junction-rm-hazard]].
- Mỗi task = 1 commit qua skill `core:git-workflow` (header EN, body VI có dấu, commit bằng `git commit -F`, KHÔNG trailer `Co-Authored-By`). Push/PR/merge: chờ người dùng.
- `<scratchpad>` trong lệnh = thư mục tạm của phiên thực thi, nằm NGOÀI repo.

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/engineering/skills/engineering-quality-gate/SKILL.md` | S5: câu trỏ sang convention-enforce | 1 |
| `plugins/engineering/skills/engineering-spec-writing/SKILL.md` | S6: bước 4 trỏ sang engineering-adr | 1 |
| `workflows/code-review/WORKFLOW.md` | WF9: nhóm CI/IaC/SQL + kiểm drift | 2 |
| `workflows/release/WORKFLOW.md` | WF8: Bước 1 baseline, Bước 5 kiểm migration, đánh số lại | 3 |
| `workflows/orchestrator/WORKFLOW.md` | WF10: chuỗi db-change → api → feature + mục skill trực tiếp | 4 |
| `test/validate.mjs` | Khối "16.": hợp đồng 5 mục | 1–4 |

---

### Task 0: Branch và commit plan

**Files:**
- Commit: `docs/superpowers/plans/2026-09-30-p2-workflow-skill-followups.md` (file này)

**Interfaces:**
- Consumes: branch `master` (a609735 hoặc mới hơn), working tree sạch trừ file plan (file plan có thể đang untracked trên nhánh khác: `git checkout master` mang theo file untracked).
- Produces: branch `feature/workflow-p2-followups` mà mọi task sau commit lên.

- [ ] **Step 1: Kiểm tra trạng thái**

Run: `git status --short && git branch --show-current`
Expected: chỉ file plan untracked.

- [ ] **Step 2: Tạo branch từ master và commit plan qua `core:git-workflow`**

Run: `git checkout master && git checkout -b feature/workflow-p2-followups && git add docs/superpowers/plans/2026-09-30-p2-workflow-skill-followups.md && git status --short && git log --oneline -1`
Expected: branch mới; file plan đã stage; `git log` là commit merge `Merge feature/frontend-data-integration…`.
Header đề xuất: `docs(specs): add P2 workflow and skill follow-ups plan`

---

### Task 1: S5 và S6 — hai câu trỏ chéo skill

**Files:**
- Modify: `plugins/engineering/skills/engineering-quality-gate/SKILL.md`
- Modify: `plugins/engineering/skills/engineering-spec-writing/SKILL.md`
- Test: `test/validate.mjs` (khối "16." mới, trước dòng `// ─────…` cuối file, sau khối "15.")

**Interfaces:**
- Consumes: `PLUGINS_DIR`, `fs`, `path`, `ok` (đã có ở `test/validate.mjs`).
- Produces: khối "16." định nghĩa `wf16(id)` mà Task 2–4 dùng; hai skill engineering trỏ đúng skill anh em.

- [ ] **Step 1: Viết assert (failing)**

Chèn khối "16." vào `test/validate.mjs`, ngay sau khối "15." và trước dòng `// ─────…` cuối file:

```js
// 16. SOURCE: P2 còn lại — S5, S6, WF9, WF8, WF10 (spec 2026-09-29 §3.3, §5.3)
{
  const engRead = (rel) => fs.readFileSync(path.join(PLUGINS_DIR, 'engineering', 'skills', rel), 'utf8');
  const wf16 = (id) => workflows.stages.find((s) => s.id === id);
  const noStep16 = { title: '', body: '', checkpoint: false };

  // S5: quality-gate không làm nhiệm vụ kiểm quy ước; chỉ đường sang skill chuyên trách.
  ok(engRead('engineering-quality-gate/SKILL.md').includes('engineering-convention-enforce'),
    'S5: engineering-quality-gate trỏ sang engineering-convention-enforce');
  // S6: thủ tục ghi ADR nằm ở engineering-adr; spec-writing chỉ trỏ sang, không lặp lại thủ tục.
  const specSkill = engRead('engineering-spec-writing/SKILL.md');
  const specStep4 = (specSkill.split('4. **Ghi ADR')[1] ?? '').split('5. **Verify')[0];
  ok(specStep4.includes('engineering-adr') && !specStep4.includes('<số kế tiếp>'),
    'S6: engineering-spec-writing bước 4 trỏ sang engineering-adr, không còn thủ tục đánh số ADR');
}
```

- [ ] **Step 2: Chạy, xác nhận đỏ đúng lý do**

Run: `node test/validate.mjs 2>&1 | grep -E "S5:|S6:|KẾT QUẢ"`
Expected: FAIL 2 assert `S5:` và `S6:`; mọi assert khác PASS. Nếu một assert PASS ngay từ đầu (chuỗi đã có sẵn) → DỪNG, báo và nêu chuỗi đã có ở đâu.

- [ ] **Step 3: Sửa hai skill**

(a) `plugins/engineering/skills/engineering-quality-gate/SKILL.md`, thay đúng dòng
`KHÔNG dùng skill này để tự cấu hình server/CI, hay gọi web API của SonarQube/Black Duck (ngoài phạm vi).`
bằng
```
KHÔNG dùng skill này để tự cấu hình server/CI, hay gọi web API của SonarQube/Black Duck (ngoài phạm vi).
Kiểm quy ước đặt tên và cấu trúc thư mục/file (không phải chất lượng hay bảo mật) → dùng skill
`engineering-convention-enforce`.
```

(b) `plugins/engineering/skills/engineering-spec-writing/SKILL.md`, thay đúng đoạn
```
4. **Ghi ADR cho quyết định lớn.**
   Với mỗi quyết định thiết kế/nghiệp vụ đáng lưu (chọn phương án, đánh đổi phạm vi, ràng buộc kỹ thuật lớn):
   tạo file `docs/decisions/<số kế tiếp>-<slug>.md` theo `docs/decisions/_TEMPLATE.md`; link ngược từ spec và
   link tới contract/data-model liên quan.
```
bằng
```
4. **Ghi ADR cho quyết định lớn.**
   Với mỗi quyết định thiết kế/nghiệp vụ đáng lưu (chọn phương án, đánh đổi phạm vi, ràng buộc kỹ thuật lớn):
   dùng skill **`engineering-adr`** (cùng plugin) để làm rõ phương án và ghi ADR vào `docs/decisions/`; spec chỉ
   link tới ADR đó và tới contract/data-model liên quan, không tự lặp lại thủ tục ghi ADR.
```

- [ ] **Step 4: Chạy lại, xác nhận xanh**

Run: `node test/validate.mjs 2>&1 | grep -E "S5:|S6:|KẾT QUẢ"`
Expected: không còn FAIL `S5:`/`S6:`; `KẾT QUẢ: <n> pass, 0 fail`.

- [ ] **Step 5: Commit qua `core:git-workflow`**

Stage: hai file `SKILL.md` và `test/validate.mjs`.
Header đề xuất: `docs(engineering): cross-link quality-gate and spec-writing to sibling skills`

---

### Task 2: WF9 — `workflow-code-review`

**Files:**
- Modify: `workflows/code-review/WORKFLOW.md`
- Test: `test/validate.mjs` (thêm vào cuối khối "16.", trước dấu `}` đóng khối)

**Interfaces:**
- Consumes: `wf16`, `noStep16`, `parseSteps` (Task 1).
- Produces: Bước 2 phân nhóm "khác" chi tiết; Bước 3 có auditor cho CI/IaC/SQL và drift contract.

- [ ] **Step 1: Viết assert (failing)**

Thêm vào cuối khối "16." trong `test/validate.mjs`:

```js

  // WF9: nhóm "khác" từng không có reviewer; diff đụng contract/controller từng không kiểm drift.
  const cr = wf16('workflow-code-review');
  const crStep = (n) => (cr ? parseSteps(cr.body).find((s) => s.n === n) ?? noStep16 : noStep16);
  ok(/CI/.test(crStep(2).body) && /IaC/.test(crStep(2).body) && /SQL/.test(crStep(2).body),
    'workflow-code-review Bước 2: nhóm "khác" tách CI/IaC/SQL khỏi docs/config thuần');
  ok(crStep(3).body.includes('agent `engineering-quality-auditor`') && /CI\/IaC\/SQL/.test(crStep(3).body),
    'workflow-code-review Bước 3: auditor review nhóm CI/IaC/SQL');
  ok(crStep(3).body.includes('docs/contracts') && /drift/.test(crStep(3).body) && crStep(3).body.includes('agent `backend-reviewer`'),
    'workflow-code-review Bước 3: diff đụng docs/contracts hoặc controller thì backend-reviewer kiểm drift');
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "workflow-code-review|KẾT QUẢ"`
Expected: FAIL 3 assert `workflow-code-review Bước 2/3: …`; assert khung body và cũ PASS.

- [ ] **Step 3: Sửa `workflows/code-review/WORKFLOW.md`**

(a) Bước 2, thay đúng đoạn
```
- **Hành động:** gán mỗi file vào `backend`, `frontend`, hoặc `khác` (docs/config/CI…); đối chiếu với cấu
  trúc thư mục project để tránh gán sai.
- **Ràng buộc:** không bỏ sót file nào trong diff; file `khác` vẫn phải liệt kê dù không có reviewer chuyên
  trách.
- **Đầu ra:** bảng file → BE/FE/khác.
- **Gate:** mỗi file gán BE, FE hoặc khác.
```
bằng
```
- **Hành động:** gán mỗi file vào `backend`, `frontend`, hoặc `khác`; đối chiếu với cấu trúc thư mục project
  để tránh gán sai. Nhóm `khác` tách tiếp: file CI/IaC/SQL (pipeline CI, Dockerfile/IaC, migration SQL) và
  file docs/config thuần. Đánh dấu file chạm `docs/contracts/` hoặc controller/route của backend để Bước 3
  kiểm drift contract↔code.
- **Ràng buộc:** không bỏ sót file nào trong diff; file docs/config thuần vẫn phải liệt kê dù không có
  reviewer chuyên trách.
- **Đầu ra:** bảng file → BE/FE/khác (CI/IaC/SQL hoặc docs/config) + danh sách file cần kiểm drift.
- **Gate:** mỗi file gán BE, FE hoặc khác (kèm nhóm con của khác).
```

(b) Bước 3, thay đúng đoạn
```
- **Hành động:** mỗi agent review đúng phía được gán theo trục correctness/thiết kế-kiến trúc/a11y/test
  coverage/quality-security; trích `file:line` cụ thể cho từng finding.
- **Ràng buộc:** chỉ đọc, không tự sửa code; không review phía không có file đụng.
- **Đầu ra:** danh sách finding thô theo severity (contract đầu ra, `core:principles`) từ mỗi agent.
```
bằng
```
- **Hành động:** mỗi agent review đúng phía được gán theo trục correctness/thiết kế-kiến trúc/a11y/test
  coverage/quality-security; trích `file:line` cụ thể cho từng finding. `engineering-quality-auditor` cũng
  review nhóm `khác` là CI/IaC/SQL (quyền quá rộng, secret, cấu hình không an toàn, migration nguy hiểm);
  nhóm docs/config thuần ghi "không cần reviewer". Diff chạm `docs/contracts/` hoặc controller/route thì
  `backend-reviewer` kiểm thêm drift contract↔code.
- **Ràng buộc:** chỉ đọc, không tự sửa code; không review phía không có file đụng; không in giá trị secret.
- **Đầu ra:** danh sách finding thô theo severity (contract đầu ra, `core:principles`) từ mỗi agent, kèm kết
  quả kiểm drift nếu có.
```

(c) Bước 3 `Thực hiện`: thay đúng đoạn
```
- **Thực hiện:** agent `backend-reviewer` ∥ agent `frontend-reviewer` ∥ agent `engineering-quality-auditor`
  (chỉ vùng có đụng theo Bước 2)
```
bằng
```
- **Thực hiện:** agent `backend-reviewer` ∥ agent `frontend-reviewer` ∥ agent `engineering-quality-auditor`
  (chỉ vùng có đụng theo Bước 2, gồm nhóm CI/IaC/SQL)
```

(d) Mục tiêu: thay đúng đoạn
```
  coverage), trả về danh sách finding đã validate theo severity, và một verdict rõ ràng — không sửa code,
  không commit.
```
bằng
```
  coverage, drift contract khi diff chạm contract/controller; CI/IaC/SQL do auditor soát), trả về danh sách
  finding đã validate theo severity, và một verdict rõ ràng — không sửa code, không commit.
```
(Đoạn "(correctness, thiết kế/kiến trúc, a11y, test" ở dòng liền trước giữ nguyên; kiểm ngoặc đóng cân sau khi sửa.)

- [ ] **Step 4: Chạy lại validate + toàn bộ**

Run: `node test/validate.mjs 2>&1 | grep -E "workflow-code-review|KẾT QUẢ" ; npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]"`
Expected: không còn FAIL chứa `workflow-code-review`; `KẾT QUẢ: <n> pass, 0 fail`; `INSTALL TEST … 0 fail`, `WIZARD TEST … 0 fail`.

- [ ] **Step 5: Commit qua `core:git-workflow`**

Stage: `workflows/code-review/WORKFLOW.md`, `test/validate.mjs`.
Header đề xuất: `fix(workflows): cover CI/IaC/SQL files and contract drift in code-review`

---

### Task 3: WF8 — `workflow-release`

**Files:**
- Modify: `workflows/release/WORKFLOW.md`
- Test: `test/validate.mjs` (thêm vào cuối khối "16.")

**Interfaces:**
- Consumes: `wf16`, `noStep16`, `parseSteps` (Task 1).
- Produces: workflow-release 8 bước (Bước 1 = Baseline build/test, Bước 2 = Quality gate ⏸, Bước 3 = Release notes ⏸, Bước 4 = Version bump ⏸, Bước 5 = Deploy checklist, Bước 6 = Deploy ⏸, Bước 7 = Hậu kiểm, Bước 8 = Tag ⏸).

- [ ] **Step 1: Viết assert (failing)**

Thêm vào cuối khối "16." trong `test/validate.mjs`:

```js

  // WF8: baseline từng chỉ là tiền điều kiện không ai đo (W-a); migration chờ chạy từng không được kiểm.
  const rel = wf16('workflow-release');
  const relSteps = rel ? parseSteps(rel.body) : [];
  const relStep = (n) => relSteps.find((s) => s.n === n) ?? noStep16;
  ok(relSteps.length === 8 && /Baseline/.test(relStep(1).title) && relStep(1).body.includes('session chính'),
    'workflow-release: 8 bước, Bước 1 là Baseline build/test do session chính đo');
  ok(relStep(2).title.startsWith('Quality gate') && relStep(4).title.startsWith('Version bump') && relStep(8).title.startsWith('Tag'),
    'workflow-release: Quality gate ở Bước 2, Version bump ở Bước 4, Tag ở Bước 8');
  ok(relStep(5).body.includes('agent `ops-release-engineer`') && /migration/.test(relStep(5).body) && /thứ tự/.test(relStep(5).body),
    'workflow-release Bước 5: deploy checklist kiểm migration chờ chạy và thứ tự migration↔deploy');
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "workflow-release|KẾT QUẢ"`
Expected: FAIL 3 assert của workflow-release; khung body PASS.

- [ ] **Step 3: Sửa frontmatter, mục tiêu, điều kiện tiên quyết**

Trong `workflows/release/WORKFLOW.md`:

(a) `description`: thay đúng cụm `Workflow điều phối chuẩn bị release: chạy quality gate,` bằng `Workflow điều phối chuẩn bị release: đo baseline build/test, chạy quality gate,`; và thay cụm `lập deploy checklist kèm điều kiện rollback,` bằng `lập deploy checklist kèm điều kiện rollback và kiểm migration chờ chạy,`.

(b) Điều kiện tiên quyết, thay đúng dòng
`- Baseline: build/test của branch release đang XANH trước khi chạy quality gate.`
bằng
`- Baseline: build/test của branch release đang XANH — được đo và ghi số mốc ở Bước 1 trước khi chạy quality gate.`

- [ ] **Step 4: Thay khối từ Bước 1 đến hết Definition of Done**

Trong `workflows/release/WORKFLOW.md`, thay toàn bộ đoạn từ dòng `### Bước 1 — Quality gate ⏸` đến hết mục `## Definition of Done` (dòng cuối của mục là `- [ ] 0 finding \`blocker\``) bằng nội dung sau. Giữ nguyên mục `## Report cuối` trở đi.

````markdown
### Bước 1 — Baseline build/test

- **Thực hiện:** session chính
- **Đầu vào:** phạm vi release của người dùng
- **Hành động:** chạy build và test của branch release theo lệnh của project; ghi số mốc (lệnh, exit code,
  số test pass/fail) làm baseline cho các bước sau.
- **Ràng buộc:** chỉ chạy build/test cục bộ; không chạy lệnh tác động môi trường (deploy, migration); không
  sửa code để làm xanh.
- **Đầu ra:** baseline build/test (lệnh + exit code + số liệu).
- **Gate:** build/test xanh (exit code 0) và số mốc đã ghi.
- **Khi fail:** build/test đỏ → dừng `blocked`, đề xuất `workflow-bugfix`; không chạy quality gate trên
  baseline đỏ.
- **Evidence:** lệnh build/test + exit code + số liệu pass/fail.

### Bước 2 — Quality gate ⏸

- **Thực hiện:** agent `engineering-quality-auditor`
- **Đầu vào:** phạm vi release của người dùng + baseline xanh từ Bước 1
- **Hành động:** chạy quality gate (scan/lint/security) trên phạm vi release; trình kết quả cho người dùng
  xác nhận trước khi tiếp tục.
- **Ràng buộc:** chỉ đọc, không tự sửa code.
- **Đầu ra:** danh sách finding theo severity (contract đầu ra, `core:principles`).
- **Gate:** 0 blocker.
- **Khi fail:** còn finding `blocker` → dừng, đề xuất `workflow-bugfix`/`workflow-security-review` tuỳ loại
  finding, không tự sửa.
- **Evidence:** danh sách finding (severity/category/location/evidence/confidence).

### Bước 3 — Release notes ⏸

- **Thực hiện:** agent `engineering-release-scribe`
- **Đầu vào:** git log phạm vi release + quality gate đã pass từ Bước 2
- **Hành động:** gom commit trong phạm vi thành release notes/CHANGELOG theo type/scope; trình cho người
  dùng xác nhận nội dung đúng phạm vi.
- **Ràng buộc:** không đưa commit ngoài phạm vi release vào notes.
- **Đầu ra:** release notes/CHANGELOG đã xác nhận.
- **Gate:** notes/CHANGELOG từ git log đúng phạm vi.
- **Khi fail:** người dùng chỉ ra thiếu/thừa mục → sửa lại theo git log, trình lại.
- **Evidence:** đường dẫn/nội dung release notes + xác nhận của người dùng.

### Bước 4 — Version bump & commit release ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** release notes/CHANGELOG đã xác nhận từ Bước 3 + version dự kiến
- **Hành động:** bump version theo quy ước của project (vd `package.json`, `pom.xml`) đúng version dự kiến;
  gom CHANGELOG + version bump vào một commit release; trình diff cho người dùng duyệt.
- **Ràng buộc:** không tự commit khi người dùng chưa duyệt diff; không push trừ khi được yêu cầu; không đưa
  thay đổi code vào commit release.
- **Đầu ra:** commit release chứa CHANGELOG + version bump (sau khi người dùng duyệt).
- **Gate:** commit release đã tạo, chứa CHANGELOG + version bump khớp version dự kiến.
- **Khi fail:** người dùng yêu cầu sửa notes/version → quay lại Bước 3 hoặc sửa version, không commit tạm.
- **Evidence:** hash commit release + `git show --stat` liệt kê CHANGELOG và file version.

### Bước 5 — Deploy checklist

- **Thực hiện:** agent `ops-release-engineer`
- **Đầu vào:** commit release từ Bước 4
- **Hành động:** lập checklist các bước deploy theo quy trình project; ghi rõ điều kiện rollback (khi nào
  cần rollback, cách rollback). Liệt kê migration schema nằm trong phạm vi release (thư mục migration của
  project, so với tag trước) và ghi thứ tự migration↔deploy: migration tương thích ngược chạy trước khi
  deploy code mới, migration phá tương thích chỉ sau khi code cũ đã ngừng dùng; migration nào đã áp trên môi
  trường đích do người dùng xác nhận.
- **Ràng buộc:** không tự thực hiện deploy và không tự chạy migration — chỉ lập checklist và đề xuất thứ tự.
- **Đầu ra:** deploy checklist + điều kiện rollback + danh sách migration chờ chạy kèm thứ tự (hoặc "không có
  migration").
- **Gate:** checklist + điều kiện rollback + kiểm migration (danh sách hoặc "không có migration").
- **Khi fail:** thiếu bước quan trọng trong quy trình project, hoặc không xác định được migration nào đã áp
  → bổ sung/hỏi người dùng, ghi rõ lý do.
- **Evidence:** deploy checklist và danh sách migration trong report bước.

### Bước 6 — Deploy ⏸

- **Thực hiện:** session chính
- **Đầu vào:** deploy checklist + điều kiện rollback từ Bước 5
- **Hành động:** trình checklist cho người dùng; người dùng tự deploy commit release theo checklist rồi báo
  đã deploy, hoặc chủ động hoãn deploy.
- **Ràng buộc:** không agent nào tự deploy hay chạy lệnh tác động môi trường; chỉ đi tiếp khi người dùng báo
  rõ đã deploy hoặc đã hoãn.
- **Đầu ra:** xác nhận của người dùng: đã deploy (kèm thời điểm, môi trường) hoặc hoãn deploy.
- **Gate:** người dùng xác nhận đã deploy commit release, hoặc xác nhận hoãn.
- **Khi fail:** deploy lỗi giữa chừng → dừng, áp điều kiện rollback của Bước 5 (người dùng thực hiện), đề
  xuất `workflow-incident` nếu production bị ảnh hưởng.
- **Evidence:** xác nhận của người dùng + thời điểm và môi trường deploy (hoặc lý do hoãn).

### Bước 7 — Hậu kiểm

- **Thực hiện:** agent `ops-release-engineer`
- **Đầu vào:** xác nhận deploy từ Bước 6
- **Hành động:** nếu đã deploy, kiểm health/observability (log lỗi, metric, alert) sau deploy; nếu người dùng
  hoãn deploy ở Bước 6, ghi `not_run` kèm lý do.
- **Ràng buộc:** không tự deploy để hậu kiểm — chỉ kiểm khi deploy đã xảy ra.
- **Đầu ra:** kết quả hậu kiểm, hoặc `not_run` có lý do.
- **Gate:** health/observability bình thường sau deploy, hoặc `not_run` nếu đã hoãn deploy.
- **Khi fail:** health/observability bất thường sau deploy → dừng, đề xuất `workflow-incident`.
- **Evidence:** log/metric hậu kiểm, hoặc lý do `not_run`.

### Bước 8 — Tag ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** commit release (Bước 4) + kết quả hậu kiểm (Bước 7)
- **Hành động:** chỉ đề xuất lệnh tag/push trỏ vào đúng commit release của Bước 4; chờ người dùng xác nhận
  trước khi chạy.
- **Ràng buộc:** không tự chạy lệnh tag/push khi chưa được xác nhận; không push trừ khi được yêu cầu.
- **Đầu ra:** lệnh tag/push đề xuất, đã chạy (sau khi người dùng xác nhận) hoặc còn chờ.
- **Gate:** chỉ đề xuất lệnh tag/push, chờ xác nhận.
- **Khi fail:** người dùng chưa xác nhận → giữ nguyên đề xuất, không tự chạy.
- **Evidence:** lệnh tag/push đề xuất + xác nhận của người dùng (nếu đã chạy: hash tag).

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 2 | Danh sách finding quality gate | Người dùng xác nhận 0 blocker |
| 3 | Release notes/CHANGELOG | Người dùng xác nhận đúng phạm vi |
| 4 | Diff commit release (CHANGELOG + version bump) | Người dùng duyệt diff |
| 6 | Deploy checklist + điều kiện rollback + migration chờ chạy | Người dùng báo đã deploy, hoặc hoãn deploy |
| 8 | Lệnh tag/push đề xuất trên commit release | Người dùng xác nhận rõ ràng trước khi chạy |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Build fail (Bước 1) | Dừng `blocked`, đề xuất `workflow-bugfix`; không chạy quality gate trên baseline đỏ |
| Test fail (Bước 1) | Dừng `blocked`, đề xuất `workflow-bugfix`; không sửa/nới test trong workflow này |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` (sau Bước 2 ⏸) | Dừng, đề xuất `workflow-bugfix`/`workflow-security-review`, không tự sửa |
| Người dùng không xác nhận release notes (sau Bước 3 ⏸) | Sửa lại theo git log, trình lại |
| Người dùng không duyệt commit release (sau Bước 4 ⏸) | Không commit, quay lại Bước 3 hoặc sửa version |
| Không xác định được migration nào đã áp (Bước 5) | Hỏi người dùng, không tự suy; không tự chạy migration |
| Deploy lỗi giữa chừng (sau Bước 6 ⏸) | Dừng, người dùng áp điều kiện rollback của Bước 5; đề xuất `workflow-incident` nếu production bị ảnh hưởng |
| Health/observability bất thường sau deploy (Bước 7) | Dừng, đề xuất `workflow-incident` |
| Người dùng không xác nhận lệnh tag/push (sau Bước 8 ⏸) | Giữ nguyên đề xuất, không tự chạy |

- **Điều kiện dừng:** baseline build/test đỏ; finding `blocker` chưa xử lý; release notes sai phạm vi chưa
  sửa được; người dùng không duyệt commit release; deploy lỗi; health/observability bất thường sau deploy;
  người dùng không xác nhận tag/push.
- **Rollback:** rollback deploy theo điều kiện đã ghi ở Bước 5 (người vận hành thực hiện); commit release
  chưa push có thể bỏ bằng thao tác git thủ công của người dùng (workflow không tự `reset --hard`); workflow
  không tự chạy tag/push nên không có gì để rollback ở tầng tag trước khi người dùng xác nhận.

## Definition of Done

- [ ] Baseline build/test xanh, số mốc đã ghi — evidence: Bước 1
- [ ] Quality gate 0 blocker — evidence: Bước 2
- [ ] Release notes/CHANGELOG đúng phạm vi đã xác nhận — evidence: Bước 3
- [ ] Commit release chứa CHANGELOG + version bump đã được duyệt — evidence: Bước 4
- [ ] Deploy checklist + điều kiện rollback + kiểm migration chờ chạy — evidence: Bước 5
- [ ] Người dùng đã deploy hoặc xác nhận hoãn — evidence: Bước 6
- [ ] Hậu kiểm bình thường hoặc `not_run` có lý do — evidence: Bước 7
- [ ] Lệnh tag/push trên commit release đã đề xuất, chờ hoặc đã có xác nhận — evidence: Bước 8
- [ ] Mọi gate có evidence `passed`
- [ ] 0 finding `blocker`
````

- [ ] **Step 5: Chạy lại validate + toàn bộ + rà số bước cũ**

Run: `node test/validate.mjs 2>&1 | grep -E "workflow-release|KẾT QUẢ" ; npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]" ; grep -nE "Bước 7 ⏸|Bước 1–6|sau Bước 5 ⏸" workflows/release/WORKFLOW.md`
Expected: không còn FAIL chứa `workflow-release`; `KẾT QUẢ: <n> pass, 0 fail`; `INSTALL TEST … 0 fail`, `WIZARD TEST … 0 fail`; `grep` cuối không in gì.

- [ ] **Step 6: Commit qua `core:git-workflow`**

Stage: `workflows/release/WORKFLOW.md`, `test/validate.mjs`.
Header đề xuất: `fix(workflows): add baseline and migration check steps to release`

---

### Task 4: WF10 — `workflow-orchestrator`

**Files:**
- Modify: `workflows/orchestrator/WORKFLOW.md`
- Test: `test/validate.mjs` (thêm vào cuối khối "16.")

**Interfaces:**
- Consumes: `wf16`, `parseRegistry` (đã import ở `test/validate.mjs`).
- Produces: chuỗi `workflow-db-change → workflow-api → workflow-feature` hợp lệ theo cột "Nối tiếp"; mục `## Yêu cầu chạy trực tiếp bằng skill`.

- [ ] **Step 1: Viết assert (failing)**

Thêm vào cuối khối "16." trong `test/validate.mjs`:

```js

  // WF10: orchestrator từng không ghép được db-change + api + feature, và không chỉ đường tới skill không có workflow.
  const orch16 = wf16('workflow-orchestrator');
  const reg16 = orch16 ? parseRegistry(orch16.body) : { rows: [], priority: [] };
  const nextOf = (id) => (reg16.rows.find((r) => r.id === id) ?? { next: [] }).next;
  ok(nextOf('workflow-db-change').includes('workflow-api') && nextOf('workflow-api').includes('workflow-feature'),
    'workflow-orchestrator: Registry cho chuỗi db-change → api → feature qua cột Nối tiếp');
  const direct16 = ((orch16?.body ?? '').split('## Yêu cầu chạy trực tiếp bằng skill')[1] ?? '').split('\n## ')[0];
  ok(['backend-init', 'frontend-init', 'backend-migrate-vault-consul'].every((s) => direct16.includes(`\`${s}\``)),
    'workflow-orchestrator: mục "Yêu cầu chạy trực tiếp bằng skill" nêu backend-init, frontend-init, backend-migrate-vault-consul');
  ok(/tối đa 3/.test(orch16?.body ?? '') && /thứ tự phụ thuộc/.test(orch16?.body ?? ''),
    'workflow-orchestrator: giữ luật chuỗi tối đa 3 workflow và ghép theo thứ tự phụ thuộc');
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "workflow-orchestrator|KẾT QUẢ"`
Expected: FAIL `Registry cho chuỗi db-change → api → feature`, FAIL `mục "Yêu cầu chạy trực tiếp bằng skill"…`, FAIL `giữ luật chuỗi tối đa 3 … thứ tự phụ thuộc` (cụm `thứ tự phụ thuộc` chưa có); assert cũ (registry hợp lệ) PASS.

- [ ] **Step 3: Sửa `workflows/orchestrator/WORKFLOW.md`**

(a) Registry, thay đúng dòng
`| \`workflow-db-change\` | "đổi schema", "migration", "thêm cột/bảng", "đổi index" | high | \`workflow-docs\` | Không đổi schema, chỉ đổi query/logic → feature/bugfix |`
bằng
`| \`workflow-db-change\` | "đổi schema", "migration", "thêm cột/bảng", "đổi index" | high | \`workflow-api\`, \`workflow-docs\` | Không đổi schema, chỉ đổi query/logic → feature/bugfix |`

và thay đúng dòng
`| \`workflow-api\` | "làm API", "thêm endpoint", "OpenAPI", "contract-first" | medium | \`workflow-docs\` | Không cần contract mới, chỉ sửa logic nội bộ → feature/bugfix |`
bằng
`| \`workflow-api\` | "làm API", "thêm endpoint", "OpenAPI", "contract-first" | medium | \`workflow-feature\`, \`workflow-docs\` | Không cần contract mới, chỉ sửa logic nội bộ → feature/bugfix |`

(b) Ngay sau dòng `**Thứ tự ưu tiên:** …` (dòng cuối của mục Registry) và trước `## Các bước`, chèn (một dòng trống trước và sau):

```markdown
## Yêu cầu chạy trực tiếp bằng skill

Các việc sau là skill on-demand, không có workflow. Khi yêu cầu khớp, orchestrator không chọn workflow: chỉ nêu
skill cần gọi và kết thúc (không phải lỗi).

| Tín hiệu | Skill |
|---|---|
| "khởi tạo backend", "scaffold API/service", "setup project backend mới" | `backend-init` |
| "khởi tạo frontend", "setup project React mới", "scaffold tài liệu nền frontend" | `frontend-init` |
| "chuyển .env sang Vault/Consul", "externalize config/secret", "đưa secret vào Vault" | `backend-migrate-vault-consul` |
```

(c) Bước 1 "Hành động", thay đúng đoạn
```
  `Không dùng khi` (chuyển sang workflow cột đó chỉ tới); nếu vẫn khớp nhiều dòng, áp dụng **Thứ tự ưu tiên**
  để rút về tối đa 2 ứng viên.
```
bằng
```
  `Không dùng khi` (chuyển sang workflow cột đó chỉ tới); nếu vẫn khớp nhiều dòng, áp dụng **Thứ tự ưu tiên**
  để rút về tối đa 2 ứng viên. Khi yêu cầu cần nhiều workflow phụ thuộc nhau (vd đổi schema → làm API → làm
  tính năng), đề xuất chuỗi theo thứ tự phụ thuộc thay vì chọn một workflow, tối đa 3 workflow, mỗi mắt nối
  phải có trong cột `Nối tiếp` của workflow đứng trước. Yêu cầu khớp mục "Yêu cầu chạy trực tiếp bằng skill"
  thì nêu skill cần gọi và dừng.
```

(d) Bước 1 "Khi fail", thay đúng dòng
`- **Khi fail:** không ứng viên nào khớp → hỏi lại người dùng mô tả rõ hơn việc cần làm.`
bằng
`- **Khi fail:** không ứng viên nào khớp Registry và cũng không khớp mục skill trực tiếp → hỏi lại người dùng mô tả rõ hơn việc cần làm.`

- [ ] **Step 4: Chạy lại validate + toàn bộ**

Run: `node test/validate.mjs 2>&1 | grep -E "workflow-orchestrator|KẾT QUẢ" ; npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]"`
Expected: không còn FAIL chứa `workflow-orchestrator`; assert registry cũ (`registry có …`, `nối tiếp "…" tồn tại`, `thứ tự ưu tiên liệt kê đủ`) PASS; `KẾT QUẢ: <n> pass, 0 fail`; `INSTALL TEST … 0 fail`, `WIZARD TEST … 0 fail`.

- [ ] **Step 5: Commit qua `core:git-workflow`**

Stage: `workflows/orchestrator/WORKFLOW.md`, `test/validate.mjs`.
Header đề xuất: `fix(workflows): allow db-change to api to feature chain and point to direct skills`

---

## Ngoài plan này

- WF11: Bước baseline chung cho mọi workflow sửa code (buộc đánh số lại nhiều workflow, cần plan riêng); WF12: incident (bước cập nhật stakeholder, thang severity) và performance (chờ G10).
- Ánh xạ vùng rủi ro `authorization/access control`, `SSRF`, `security misconfiguration` của `workflow-security-review` sang `engineering-quality-gate/references/security-review-areas.md` (hiện 5 vùng): cần plan riêng vì đụng ánh xạ OWASP/ASVS/CWE.
- Nối workflow phụ thuộc draft (WF3 phần skill, WF4 Bước 5, WF5, WF6): chờ pha publish.
