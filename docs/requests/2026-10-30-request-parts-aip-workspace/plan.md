# Request parts, workspace `.aip/` và trường TDD — Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Chia part bên trong một request, chuyển trạng thái chạy sang `.aip/` ở gốc repo chính, thêm trường `**TDD:**` theo task; ba giai đoạn A → B → C, mỗi giai đoạn tự đứng được.
**Architecture:** Node ESM zero-dep. Validator ở `core/skills/artifact-templates/scripts/`, script vòng task ở `core/skills/plan-execution/scripts/`, hook ở `core/hooks/scripts/`; văn bản quy trình ở skill/agent/workflow/baseline. Script của hai skill khác thư mục không import lẫn nhau (cài độc lập); logic trùng được khoá bằng bộ vector test dùng chung.
**Tech Stack:** Node 20+ built-in (`fs`, `path`, `child_process`), harness `test/validate.mjs` (`ok`, `--only`).
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/skills/artifact-templates/scripts/check-request.mjs` | W21 + `parseTddLine`; quét `parts/*/plan.md`, W6/W7/W16 trên hợp, W19/W20, `parsePartTable` | 1, 11 |
| `core/skills/plan-execution/scripts/task-brief.mjs` | chèn dòng TDD hiệu lực; ghi brief vào workspace | 2, 7 |
| `core/skills/plan-execution/scripts/ledger.mjs` | kiểm dòng `red:`; ghi ledger vào workspace; chép `.sdd` cũ | 3, 7 |
| `core/skills/plan-execution/scripts/workspace.mjs` (mới) | tính `<gốc>/.aip/runs/<request>/<part>/`, `.gitignore`, đường lui lỗi quyền | 6 |
| `core/skills/plan-execution/scripts/review-package.mjs` | `--plan <path>` ghi vào workspace | 7 |
| `core/hooks/scripts/session-start.mjs` | đọc ledger/handoff `.aip/`, bỏ `.sdd` trùng request, `Part: complete` | 8 |
| `core/skills/artifact-templates/scripts/check-partition.mjs` | P1/P2 cấp part, P3, P4 | 12 |
| `core/principles/workflow-output-contract.md`, `core/skills/plan-execution/references/{task-loop.md,inline.md,prompts/implementer.md,prompts/task-review.md}`, `plugins/backend/agents/backend-implementer.md`, `plugins/engineering/skills/engineering-tdd/SKILL.md`, `plugins/engineering/skills/engineering-plan-writing/references/plan-structure.md`, `core/skills/artifact-templates/references/plan.template.md`, `workflows/feature/WORKFLOW.md`, `workflows/feature/references/error-matrix.md` | văn bản TDD theo trường | 4 |
| `core/skills/plan-execution/{SKILL.md,references/task-loop.md,references/inline.md,references/prompts/final-review.md,references/prompts/re-review.md}`, `core/skills/git-worktree/SKILL.md`, `core/skills/artifact-templates/references/handoff.template.md`, `workflows/feature/WORKFLOW.md`, `evals/workflows/task-review-spec/{prompt.md,scaffold.sh,graders/not-marked-complete.md}` | văn bản đường dẫn `.aip/` | 9 |
| `core/skills/artifact-templates/references/design.template.md`, `core/skills/artifact-templates/SKILL.md`, `plugins/engineering/skills/engineering-plan-writing/{SKILL.md,references/plan-structure.md}`, `plugins/engineering/skills/engineering-spec-writing/SKILL.md` | hướng dẫn viết part, Bảng part, luật interface | 13 |
| `core/skills/plan-execution/{SKILL.md,references/task-loop.md,references/finish.md,references/prompts/final-review.md}`, `core/skills/git-worktree/SKILL.md`, `core/skills/git-workflow/{SKILL.md,references/branch-convention.md}`, `workflows/feature/WORKFLOW.md` | chế độ part, `-p<nn>` | 14 |
| `core/agents/AGENTS.template.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `README_VI.md` | baseline + tài liệu repo | 9, 15 |
| `test/contract/35-artifact-templates.contract.mjs` | unit `check-request` (W19–W21, part) | 1, 11 |
| `test/content/33-request-parts.pin.mjs` (mới) | unit script `plan-execution` + pin chuỗi vận hành của request này | 2, 3, 4, 6, 7, 9, 14 |
| `test/contract/90-hooks.contract.mjs` | unit `session-start` | 8 |
| `test/content/24-check-partition.pin.mjs` | unit `check-partition` cấp part | 12 |
| `test/content/25-parallel-agents-docs.pin.mjs`, `test/content/32-superpowers-gap.pin.mjs`, `test/content/31-workflow-self-sufficient.pin.mjs` | đổi pin `-t<n>`, `.sdd` theo hành vi mới | 9, 15 |
| `docs/specs/{artifact-templates,hooks-gates,workflows,baseline}/spec.md` | spec sống theo "Ảnh hưởng spec" | 5, 10, 16 |
| `core/.manifest.json`, `plugins/engineering/.manifest.json`, `plugins/backend/.manifest.json`, `workflows/.manifest.json`, `plugins/_versions.lock.json` | bump version + lock | 5, 10, 16 |

## Global Constraints
- Trường TDD, nguyên văn: `**TDD:** có` hoặc `**TDD:** không — <lý do>` (dấu `—`, lý do không rỗng). `có` chỉ hợp lệ với kind `BE`, `TOOLING`. Thiếu dòng → mặc định `BE` = có, kind khác = không. Dòng brief: `**TDD:** có (mặc định theo kind)` / `**TDD:** không (mặc định theo kind)` khi plan không ghi.
- Workspace: `<gốc>/.aip/runs/<tên-thư-mục-request>/<part>/`; `<gốc>` = `path.dirname(git rev-parse --path-format=absolute --git-common-dir)`, không phải git repo → cwd; `<part>` = `root` cho `plan.md` gốc, `<nn>-<part-slug>` cho `parts/<nn>-<part-slug>/plan.md`; plan ngoài `docs/requests/<x>/` → `<request>` = tên thư mục cha của plan, `<part>` = `root`. Handoff: `<gốc>/.aip/runs/<request>/handoff.md`. `<gốc>/.aip/.gitignore` = `*\n`. Đường lui: lỗi `EACCES`/`EPERM`/`EROFS` khi ghi `<gốc repo chính>/.aip/` → `<gốc worktree>/.aip/` + một dòng stderr nêu đường dẫn đã dùng; lỗi khác ném tiếp.
- Bảng part: heading `## Bảng part`, cột `| Part | Phụ thuộc | Song song | Trạng thái |`; Part khớp `^\d{2}-[a-z0-9][a-z0-9-]*$`; Phụ thuộc/Song song = danh sách hoặc `—`; Trạng thái ∈ `chưa làm`, `đang làm`, `merged <hash>`, `bỏ`.
- Dòng ledger: `Part: complete <hash>` (ledger part), `Part <nn>: merged <hash>` (ledger `root/`), `Plan: complete` chỉ ở ledger `root/`. Task TDD `có` chạy inline/TOOLING: dòng complete có `red: <lệnh> exit <n khác 0>` trước `tests: <lệnh> exit 0`.
- Nhánh/worktree part: `worktree-<slug>-p<nn>`, `.claude/worktrees/<slug>-p<nn>/`. Không còn `-t<n>` và `**Song song:**` cấp task.
- Mã cảnh báo mới: W19 (Bảng part lệch), W20 (AC trong `parts/*/design.md`), W21 (dòng TDD sai); P3 (`**Song song:**` cấp task đã bỏ), P4 (Consumes/Produces trùng trong cùng nhóm). Mọi cảnh báo chỉ exit 0 trừ `--strict`.
- Node built-in, zero-dep, chạy được Windows (so đường dẫn sau khi đổi `\` → `/`). Hook fail-open, chỉ `git rev-parse`/`git ls-files`, không ghi file. File UTF-8 không BOM, LF; comment code tiếng Việt, chỉ nêu *vì sao*.
- `AGENTS.md` byte-identical với `core/agents/AGENTS.template.md`. Commit qua `core:git-workflow` (header tiếng Anh, body tiếng Việt, `git commit -F`, không `Co-Authored-By`). Không xoá `**Files:**`/test để tắt cảnh báo.
- Mỗi giai đoạn kết thúc ở task cổng: bump version plugin bị chạm, `node cli/lib/versions.mjs --lock`, `npm test` exit 0. Version hiện tại: core 1.19.6, engineering 2.8.3, backend 1.12.5, workflows 3.9.2.

## Review Focus
- Đường dẫn Windows (backslash, khác hoa thường ổ đĩa) khi so gốc repo chính với gốc worktree → test `workspace: gốc repo chính từ worktree, đường dẫn Windows` ở Task 6.
- Chép `.sdd` cũ không được ghi đè ledger `.aip` đã có → test `ledger: không chép khi ledger mới đã tồn tại` ở Task 7.
- Hook thêm ứng viên ledger mà vượt ngân sách 9000 hoặc chặn khi `git` lỗi → test `session-start: git lỗi vẫn fail-open, ngân sách không đổi` ở Task 8.
- Request không có part phải ra output y hệt trước → test `AC1.5: request mẫu không part, output bằng snapshot trước thay đổi` ở Task 11.
- P4 báo nhầm với tên chung trong backtick (vd `string`) giữa hai part không liên quan → test `AC2.4: chỉ báo khi Consumes của part này trùng Produces của part kia` ở Task 12.

## Giai đoạn A — trường TDD

### Task 1: check-request hiểu dòng `**TDD:**` (W21)
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC5.1
**Files:**
- Modify: `core/skills/artifact-templates/scripts/check-request.mjs`
- Test: `test/contract/35-artifact-templates.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `parseTddLine(line: string) → { value: 'có' } | { value: 'không', reason: string } | { error: string }`; `TDD_ALLOWED_KINDS = ['BE', 'TOOLING']` (export từ `check-request.mjs`)

- [ ] **Step 1:** Thêm test `AC5.1` trong `35-artifact-templates.contract.mjs`: plan có task `BE` + `**TDD:** có` → không W21; `FE-UI` + `**TDD:** có` → W21; `**TDD:** không` (thiếu lý do) → W21; `**TDD:** sau` → W21; `**TDD:** không — script dùng một lần` → không W21; plan không có dòng TDD → không W21. Chạy `node test/validate.mjs --only 35-artifact` → đỏ vì chưa có W21.
- [ ] **Step 2:** Thêm `parseTddLine`, `TDD_ALLOWED_KINDS` và kiểm W21 trong vùng từng task (cạnh W17/W18). Chạy lại lệnh Step 1 → xanh.
- [ ] **Step 3:** Commit `feat(artifact-templates): validate per-task TDD line (W21)`.

### Task 2: task-brief chèn dòng TDD hiệu lực
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC5.2
**Files:**
- Modify: `core/skills/plan-execution/scripts/task-brief.mjs`
- Create: `test/content/33-request-parts.pin.mjs`
- Test: `test/content/33-request-parts.pin.mjs`

**Interfaces:**
- Consumes: không có (không import `check-request.mjs` vì khác skill)
- Produces: `effectiveTdd(taskText: string) → { value: 'có' | 'không', reason?: string, defaulted: boolean }` (export từ `task-brief.mjs`)

- [ ] **Step 1:** Tạo `33-request-parts.pin.mjs` (mẫu `export default async function run({ ok, ctx })`). Test `AC5.2`: brief của task `BE` không có dòng TDD có đúng một dòng `**TDD:** có (mặc định theo kind)` ngay sau heading; task `FE-UI` → `**TDD:** không (mặc định theo kind)`; task có `**TDD:** không — x` → giữ nguyên văn, không chèn thêm; phần còn lại của task giữ nguyên văn. Thêm bộ vector dùng chung (mảng dòng TDD) chạy qua cả `parseTddLine` và `effectiveTdd`, assert cùng kết luận hợp lệ/giá trị. Chạy `node test/validate.mjs --only 33-request-parts` → đỏ.
- [ ] **Step 2:** Thêm `effectiveTdd` và chèn dòng trong `main`. Chạy lại → xanh.
- [ ] **Step 3:** Commit `feat(plan-execution): add effective TDD line to task briefs`.

### Task 3: ledger kiểm dòng `red:`
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC5.3
**Files:**
- Modify: `core/skills/plan-execution/scripts/ledger.mjs`
- Test: `test/content/33-request-parts.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `validateLine(line)` (giữ chữ ký) từ chối dòng `Task <n>: complete` có `red: <lệnh> exit 0`

- [ ] **Step 1:** Test `AC5.3` (ledger): `validateLine('Task 1: complete (… inline, red: npm t exit 1, tests: npm t exit 0)')` → `null`; có `red: npm t exit 0` → chuỗi lỗi; dòng inline cũ không có `red:` vẫn hợp lệ. Chạy `--only 33-request-parts` → đỏ.
- [ ] **Step 2:** Sửa `validateLine`. Chạy lại → xanh.
- [ ] **Step 3:** Commit `feat(plan-execution): reject red evidence with exit 0 in ledger`.

### Task 4: văn bản quy trình đổi từ "kind BE" sang "TDD có"
**Kind:** DOCS
**Phủ AC:** AC5.3
**Files:**
- Modify: `core/principles/workflow-output-contract.md`
- Modify: `core/skills/plan-execution/references/task-loop.md`
- Modify: `core/skills/plan-execution/references/inline.md`
- Modify: `core/skills/plan-execution/references/prompts/implementer.md`
- Modify: `core/skills/plan-execution/references/prompts/task-review.md`
- Modify: `plugins/backend/agents/backend-implementer.md`
- Modify: `plugins/engineering/skills/engineering-tdd/SKILL.md`
- Modify: `plugins/engineering/skills/engineering-plan-writing/references/plan-structure.md`
- Modify: `core/skills/artifact-templates/references/plan.template.md`
- Modify: `workflows/feature/WORKFLOW.md`
- Modify: `workflows/feature/references/error-matrix.md`
- Test: `test/content/33-request-parts.pin.mjs`

**Interfaces:**
- Consumes: định dạng dòng TDD và dòng `red:` từ Global Constraints
- Produces: không có

- [ ] **Step 1:** Thêm pin `AC5.3` (chuỗi vận hành, không văn xuôi): `workflow-output-contract.md` có "TDD `có`" và không còn "chỉ task kind: BE"; `plan.template.md` có dòng `**TDD:**`; `inline.md` có `red: <lệnh> exit`; `engineering-tdd/SKILL.md` nêu ngoại lệ ghi bằng `**TDD:** không — <lý do>` trong plan đã duyệt. Chạy `--only 33-request-parts` → đỏ.
- [ ] **Step 2:** Sửa các file: mọi chỗ "task kind BE/task BE" về `tdd` đổi thành "task TDD `có`"; `plan-structure.md` thêm mục trường TDD (giá trị, mặc định theo kind, `có` chỉ BE/TOOLING, plan duyệt = đồng ý ngoại lệ); `engineering-tdd` liệt kê 3 ví dụ ngoại lệ (prototype vứt đi, code sinh tự động, file cấu hình). Chạy lại → xanh; `node test/validate.mjs --build` → exit 0.
- [ ] **Step 3:** Commit `docs(plan-execution): drive TDD evidence by per-task TDD field`.

### Task 5: cổng giai đoạn A
**Kind:** TOOLING
**TDD:** không — chỉ bump version, cập nhật spec sống và chạy suite
**Phủ AC:** AC5.1, AC5.2, AC5.3
**Files:**
- Modify: `docs/specs/artifact-templates/spec.md`
- Modify: `docs/specs/workflows/spec.md`
- Modify: `core/.manifest.json`
- Modify: `plugins/engineering/.manifest.json`
- Modify: `plugins/backend/.manifest.json`
- Modify: `workflows/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/contract/36-living-spec.contract.mjs`

**Interfaces:**
- Consumes: kết quả Task 1–4
- Produces: không có

- [ ] **Step 1:** Spec sống: thêm `artifact-templates/R11` (trường TDD, W21), đổi `workflows/R7` (TDD theo trường), mỗi spec thêm dòng Lịch sử trỏ request này.
- [ ] **Step 2:** Bump minor: core 1.20.0, engineering 2.9.0, backend 1.13.0, workflows 3.10.0. Chạy `npm run build` rồi `node cli/lib/versions.mjs --lock`.
- [ ] **Step 3:** `npm test` → exit 0; `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-30-request-parts-aip-workspace/` → chỉ W9 của task chưa làm.
- [ ] **Step 4:** Commit `chore(release): bump plugins for per-task TDD field`.

## Giai đoạn B — workspace `.aip/` và hook

### Task 6: hàm tính workspace
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC3.2, AC3.5
**Files:**
- Create: `core/skills/plan-execution/scripts/workspace.mjs`
- Test: `test/content/33-request-parts.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `resolveWorkspace(planArg: string, deps?: { cwd?, git?, fs?, stderr? }) → { dir: string, root: string, request: string, part: string, plan: string, fallback: boolean }` (tạo `dir` và `<root>/.aip/.gitignore`; `git(args, cwd) → string` tiêm được)

- [ ] **Step 1:** Test `AC3.2`: đối số là thư mục request → `plan` = `<dir>/plan.md`, `part` = `root`. Test plan `parts/01-a/plan.md` → `part` = `01-a`; plan ngoài `docs/requests/` → `request` = thư mục cha. Test `workspace: gốc repo chính từ worktree, đường dẫn Windows` với `git` giả trả `E:\repo\.git` khi cwd ở `e:/repo/.claude/worktrees/x-p01`. Test `AC3.5`: `fs.mkdirSync` giả ném `EPERM` cho gốc repo chính → `fallback: true`, `dir` dưới gốc worktree, stderr một dòng nêu đường dẫn; ném `ENOSPC` → hàm ném. Chạy `--only 33-request-parts` → đỏ.
- [ ] **Step 2:** Viết `workspace.mjs`. Chạy lại → xanh.
- [ ] **Step 3:** Commit `feat(plan-execution): resolve per-plan workspace under .aip`.

### Task 7: ba script dùng workspace
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC3.1, AC3.3, AC3.4
**Files:**
- Modify: `core/skills/plan-execution/scripts/ledger.mjs`
- Modify: `core/skills/plan-execution/scripts/task-brief.mjs`
- Modify: `core/skills/plan-execution/scripts/review-package.mjs`
- Test: `test/content/33-request-parts.pin.mjs`

**Interfaces:**
- Consumes: `resolveWorkspace` (Task 6)
- Produces: CLI `ledger.mjs <plan.md|requestDir> "<dòng>"`, `task-brief.mjs <plan.md> <n> [--out <dir>]`, `review-package.mjs <base> <head> [--plan <path>] [--out <file>]`

- [ ] **Step 1:** Test `AC3.1` trên repo git tạm (tạo bằng `git init` + `git worktree add`, dọn bằng `fs.rmSync`): chạy ba script cho `plan.md` gốc và `parts/01-a/plan.md` từ gốc và từ worktree → file nằm dưới `<gốc>/.aip/runs/<request>/root|01-a/`, `.aip/.gitignore` = `*`. Test `AC3.3`: có `.sdd/progress.md` cũ, chưa có ledger mới → nội dung được chép, file cũ còn; test `ledger: không chép khi ledger mới đã tồn tại`. Test `AC3.4`: `--plan` không `--out` → ghi vào workspace và in đường dẫn; không `--plan` → stdout như cũ. Chạy `--only 33-request-parts` → đỏ.
- [ ] **Step 2:** Sửa ba script; bỏ `ensureWorkspace(requestDir)` cũ (thay bằng `resolveWorkspace`), cập nhật dòng "Cách dùng" đầu file. Chạy lại → xanh; chạy `--only 31-workflow` → xanh (sửa pin cũ nếu ghim `.sdd`).
- [ ] **Step 3:** Commit `feat(plan-execution): write ledger, briefs and review packages under .aip`.

### Task 8: hook session-start đọc `.aip/`
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC4.1, AC4.2, AC4.3, AC4.4
**Files:**
- Modify: `core/hooks/scripts/session-start.mjs`
- Test: `test/contract/90-hooks.contract.mjs`

**Interfaces:**
- Consumes: quy ước đường dẫn `.aip/runs/<request>/<part>/progress.md` và `.aip/runs/<request>/handoff.md` (Global Constraints; không import `workspace.mjs`)
- Produces: không có

- [ ] **Step 1:** Test qua `decide()` với `fs`/`git` giả: `AC4.1` ledger dở ở `.aip` gốc repo chính, phiên ở gốc và ở worktree, và ledger ở `.aip` của gốc worktree → được nạp; `AC4.2` chỉ `.sdd` cũ → nạp; có thêm `.aip/runs/<r>/` → `.sdd` của `<r>` bị bỏ; `AC4.4` ledger có `Part: complete abc` → bỏ, lấy ứng viên kế; `AC4.3` đủ 4 nguồn handoff → đúng thứ tự; test `session-start: git lỗi vẫn fail-open, ngân sách không đổi`. Chạy `node test/validate.mjs --only hooks` → đỏ.
- [ ] **Step 2:** Sửa `findHandoff` và phần chọn ledger. Chạy lại → xanh.
- [ ] **Step 3:** Commit `feat(hooks): read ledger and handoff from .aip workspace`.

### Task 9: văn bản đường dẫn `.aip/`
**Kind:** DOCS
**Phủ AC:** AC3.6
**Files:**
- Modify: `core/skills/plan-execution/SKILL.md`
- Modify: `core/skills/plan-execution/references/task-loop.md`
- Modify: `core/skills/plan-execution/references/inline.md`
- Modify: `core/skills/plan-execution/references/prompts/final-review.md`
- Modify: `core/skills/plan-execution/references/prompts/re-review.md`
- Modify: `core/skills/git-worktree/SKILL.md`
- Modify: `core/skills/artifact-templates/references/handoff.template.md`
- Modify: `workflows/feature/WORKFLOW.md`
- Modify: `core/agents/AGENTS.template.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `evals/workflows/task-review-spec/prompt.md`
- Modify: `evals/workflows/task-review-spec/scaffold.sh`
- Modify: `evals/workflows/task-review-spec/graders/not-marked-complete.md`
- Modify: `test/content/32-superpowers-gap.pin.mjs`
- Test: `test/content/33-request-parts.pin.mjs`

**Interfaces:**
- Consumes: CLI mới của Task 7
- Produces: không có

- [ ] **Step 1:** Thêm pin `AC3.6`: `git-worktree/SKILL.md` có bước chép `.aip/runs/` về gốc repo chính đứng trước `git worktree remove`. Pin bảng Memory của `AGENTS.template.md` có `.aip/runs/<request>/<part>/progress.md`. Chạy `--only 33-request-parts` → đỏ.
- [ ] **Step 2:** Đổi mọi `.sdd/progress.md`/`.sdd` (ngoài `docs/requests/` và `CHANGELOG.md`) sang đường dẫn `.aip/`; lệnh mẫu dùng đối số plan; chép template vào `AGENTS.md`. Chạy `grep -rn "\.sdd" core plugins workflows evals/workflows/task-review-spec AGENTS.md CLAUDE.md README*.md` → chỉ còn chỗ nói về tương thích `.sdd` cũ. Chạy `--only 33-request-parts` và `--only 32-superpowers` → xanh.
- [ ] **Step 3:** Commit `docs(plan-execution): document .aip workspace paths`.

### Task 10: cổng giai đoạn B
**Kind:** TOOLING
**TDD:** không — chỉ bump version, cập nhật spec sống và chạy suite
**Phủ AC:** AC3.1, AC4.1
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md`
- Modify: `docs/specs/workflows/spec.md`
- Modify: `docs/specs/baseline/spec.md`
- Modify: `core/.manifest.json`
- Modify: `workflows/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/contract/36-living-spec.contract.mjs`

**Interfaces:**
- Consumes: kết quả Task 6–9
- Produces: không có

- [ ] **Step 1:** Spec sống: đổi `hooks-gates/R11`, thêm `hooks-gates/R14`, đổi `workflows/R8`, đổi `baseline/R3`; dòng Lịch sử.
- [ ] **Step 2:** Bump minor core và workflows; nếu Task 9 chạm plugin khác thì bump plugin đó. `npm run build`, `node cli/lib/versions.mjs --lock`.
- [ ] **Step 3:** `npm test` → exit 0.
- [ ] **Step 4:** Commit `chore(release): bump plugins for .aip workspace`.

## Giai đoạn C — part, validator part, chế độ part, baseline

### Task 11: check-request hiểu `parts/`
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6
**Files:**
- Modify: `core/skills/artifact-templates/scripts/check-request.mjs`
- Test: `test/contract/35-artifact-templates.contract.mjs`

**Interfaces:**
- Consumes: `parseTddLine` (Task 1)
- Produces: `parsePartTable(designText: string) → null | { line: number, rows: Array<{ part: string, deps: string[], group: string | null, status: string, line: number }> }` (export)

- [ ] **Step 1:** Test: `AC1.1` task thiếu Kind trong `parts/01-a/plan.md` → W17 có file `parts/01-a/plan.md`; `AC1.2` AC chỉ phủ và chỉ được nhắc trong test của part → không W6/W7; `AC1.3` bốn ca lệch → bốn W19; `AC1.4` → W20; `AC1.5: request mẫu không part, output bằng snapshot trước thay đổi` (chạy trên fixture request không part, so với output ghi lại trước khi sửa); `AC1.6` design `merged` còn plan part → W16 nêu file part. Chạy `--only 35-artifact` → đỏ.
- [ ] **Step 2:** Quét `parts/*/plan.md`, áp kiểm plan hiện có cho từng file với tên file đầy đủ; W6/W7 trên hợp; W16 cho part; `parsePartTable`, W19, W20. Chạy lại → xanh; `check-request.mjs` trên mọi thư mục `docs/requests/*` không đổi output so với trước sửa.
- [ ] **Step 3:** Commit `feat(artifact-templates): validate request parts (W19, W20)`.

### Task 12: check-partition cấp part
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC2.1, AC2.2, AC2.3, AC2.4
**Files:**
- Modify: `core/skills/artifact-templates/scripts/check-partition.mjs`
- Test: `test/content/24-check-partition.pin.mjs`

**Interfaces:**
- Consumes: `parsePartTable` (Task 11), `parsePartition` (hiện có, dùng cho `**Files:**`/`**Interfaces:**` từng task)
- Produces: CLI `check-partition.mjs <thư-mục-request> [--strict]` (giữ nguyên)

- [ ] **Step 1:** Đổi test cũ về nhóm task thành: `AC2.3` plan còn `**Song song:**` → P3, không P1/P2 giữa task. Thêm `AC2.1` (P1 hai part cùng nhóm, file giao; khác nhóm hoặc `—` → im), `AC2.2` (P2 part ghi file cấm), `AC2.4: chỉ báo khi Consumes của part này trùng Produces của part kia` (cùng nhóm → P4; khai Phụ thuộc khác nhóm → im; tên chung chỉ xuất hiện ở hai `Consumes` → im). Chạy `--only 24-check-partition` → đỏ.
- [ ] **Step 2:** Sửa `check-partition.mjs`. Chạy lại → xanh.
- [ ] **Step 3:** Commit `feat(artifact-templates): check partition between request parts (P3, P4)`.

### Task 13: hướng dẫn viết part
**Kind:** DOCS
**Phủ AC:** AC1.3, AC2.4
**Files:**
- Modify: `core/skills/artifact-templates/references/design.template.md`
- Modify: `core/skills/artifact-templates/SKILL.md`
- Modify: `plugins/engineering/skills/engineering-plan-writing/SKILL.md`
- Modify: `plugins/engineering/skills/engineering-plan-writing/references/plan-structure.md`
- Modify: `plugins/engineering/skills/engineering-spec-writing/SKILL.md`
- Test: `test/content/33-request-parts.pin.mjs`

**Interfaces:**
- Consumes: định dạng Bảng part, W19–W21, P3/P4 (Global Constraints)
- Produces: không có

- [ ] **Step 1:** Pin `AC1.3`: `design.template.md` có mục tuỳ chọn `## Bảng part` với đúng 4 cột. Pin `AC2.4`: `plan-structure.md` nêu luật interface giữa part (chỉ tạo ở plan gốc hoặc part được khai Phụ thuộc). Chạy `--only 33-request-parts` → đỏ.
- [ ] **Step 2:** Sửa các file: khi nào chia part (spec-writing), bố cục `parts/`, mỗi part một `plan.md` (plan-writing), mô tả W19–W21/P3/P4 (artifact-templates). `node test/validate.mjs --build` → exit 0 (kiểm template và convention).
- [ ] **Step 3:** Commit `docs(engineering): guide authors on request parts`.

### Task 14: chế độ part của plan-execution
**Kind:** DOCS
**Phủ AC:** AC6.1, AC6.2, AC6.3, AC6.4, AC6.5
**Files:**
- Modify: `core/skills/plan-execution/SKILL.md`
- Modify: `core/skills/plan-execution/references/task-loop.md`
- Modify: `core/skills/plan-execution/references/finish.md`
- Modify: `core/skills/plan-execution/references/prompts/final-review.md`
- Modify: `core/skills/git-worktree/SKILL.md`
- Modify: `core/skills/git-workflow/SKILL.md`
- Modify: `core/skills/git-workflow/references/branch-convention.md`
- Modify: `workflows/feature/WORKFLOW.md`
- Test: `test/content/33-request-parts.pin.mjs`

**Interfaces:**
- Consumes: dòng ledger part, tên nhánh `-p<nn>` (Global Constraints); `check-partition.mjs` P1/P2 (Task 12)
- Produces: không có

- [ ] **Step 1:** Pin chuỗi vận hành, một pin mỗi AC: `AC6.1` task-loop nêu hỏi người dùng một lần mỗi nhóm Song song và điều kiện không P1/P2; `AC6.2` có `worktree-<slug>-p<nn>`, `Part: complete <hash>`, `Part <nn>: merged <hash>`, `merge --no-ff`; `AC6.3` final-review nhận Bảng part và interface giữa part, `Plan: complete` chỉ ở ledger `root/`; `AC6.4` part tuần tự: hash = HEAD sau commit task cuối; `AC6.5` full suite của component bị chạm và phụ thuộc sau mỗi merge part. Không còn `-t<n>` trong `git-worktree`, `git-workflow`. Chạy `--only 33-request-parts` → đỏ.
- [ ] **Step 2:** Viết mục "Chế độ part" trong `task-loop.md` (thứ tự gốc → part, rà interface giữa part, hỏi phiên riêng/tuần tự, worktree, ledger part, merge, full suite, cập nhật Bảng part), cập nhật SKILL, finish, final-review, git-worktree/git-workflow (`-p<nn>`, chỉ giữa part), `WORKFLOW.md` Bước 4–5. Chạy lại → xanh; `node test/validate.mjs --build` → exit 0.
- [ ] **Step 3:** Commit `docs(plan-execution): add part mode for parallel request parts`.

### Task 15: baseline và tài liệu repo
**Kind:** DOCS
**Phủ AC:** AC7.1
**Files:**
- Modify: `core/agents/AGENTS.template.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `test/content/25-parallel-agents-docs.pin.mjs`
- Test: `test/content/33-request-parts.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Pin `AC7.1`: template có `parts/` ở Docs location, `.aip/runs/<request>/<part>/progress.md` ở Memory, `worktree-<slug>-p<nn>` và "chỉ song song giữa part" ở Parallel agents, không còn `-t<n>`. Đổi pin `25-parallel-agents-docs` từ `-t<n>` sang `-p<nn>`. Chạy `--only 33-request-parts` → đỏ.
- [ ] **Step 2:** Sửa template, chép sang `AGENTS.md`, cập nhật `CLAUDE.md` và README đôi (mục Hooks/Parallel agents, `aip` docs). Chạy `--only 33-request-parts`, `--only 25-parallel`, `--only baseline` → xanh.
- [ ] **Step 3:** Commit `docs(baseline): describe request parts and part worktrees`.

### Task 16: cổng giai đoạn C
**Kind:** TOOLING
**TDD:** không — chỉ bump version, cập nhật spec sống và chạy suite
**Phủ AC:** AC1.1, AC2.1, AC6.1, AC7.1
**Files:**
- Modify: `docs/specs/artifact-templates/spec.md`
- Modify: `docs/specs/workflows/spec.md`
- Modify: `docs/specs/baseline/spec.md`
- Modify: `core/.manifest.json`
- Modify: `plugins/engineering/.manifest.json`
- Modify: `workflows/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/contract/36-living-spec.contract.mjs`

**Interfaces:**
- Consumes: kết quả Task 11–15
- Produces: không có

- [ ] **Step 1:** Spec sống: thêm `artifact-templates/R10`, đổi `artifact-templates/R8`, thêm `workflows/R14`, đổi `baseline/R2`, `baseline/R6`; dòng Lịch sử.
- [ ] **Step 2:** Bump minor core, engineering, workflows. `npm run build`, `node cli/lib/versions.mjs --lock`.
- [ ] **Step 3:** `npm test` → exit 0; `check-request.mjs docs/requests/2026-10-30-request-parts-aip-workspace/ --base master` → 0 cảnh báo; `check-partition.mjs docs/requests/2026-10-30-request-parts-aip-workspace/` → 0 cảnh báo.
- [ ] **Step 4:** Commit `chore(release): bump plugins for request parts`.
