# aip-gate-followups Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** sửa bốn follow-up của aip-gate-config-flow: từ chối ghi qua symlink ở `aip mode`/`aip autonomy`, gom git của handoff ở SessionStart, bỏ gợi ý `stopGate` ngoài repo git, so gốc bằng realpath ở `readAllowEnvFiles`.
**Architecture:** sửa tại chỗ trong hook và CLI; không đụng `gate-file.mjs` (hai bản sao giữ nguyên).
**Tech Stack:** Node ESM zero-dependency; test tự viết (`test/*.test.mjs`, `test/contract/*.contract.mjs`).
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `cli/lib/mode.mjs` | `assertNotLinked`, gọi trước ghi của `full`/`ask` | Task 1 |
| `cli/lib/autonomy.mjs` | gọi `assertNotLinked` trước ghi | Task 1 |
| `test/mode.test.mjs` | test hồi quy AC1.1, AC1.2 | Task 1 |
| `core/hooks/scripts/session-start.mjs` | tra tracked theo tập `ls-files` một lần mỗi gốc | Task 2 |
| `core/hooks/scripts/gate-stop.mjs` | bỏ gợi ý `stopGate` khi ngoài repo git | Task 3 |
| `test/contract/90-hooks.contract.mjs` | test hồi quy AC2, AC3 | Task 2, Task 3 |
| `cli/lib/init.mjs` | so gốc bằng realpath | Task 4 |
| `test/init.test.mjs` | test hồi quy AC4 | Task 4 |
| `docs/specs/hooks-gates/spec.md`, `docs/specs/cli-wizard/spec.md` | gộp spec sống | Task 5 |
| `core/.manifest.json`, `plugins/_versions.lock.json` | bump core, lock | Task 5 |

## Global Constraints
- Zero-dependency; không sửa `core/hooks/scripts/gate-file.mjs` hay bản sao ở `core/skills/plan-execution/scripts/`.
- Hook fail-open; lỗi nội bộ không được chặn phiên.
- Mỗi task: test đỏ đúng lý do trước, sửa, test xanh; commit riêng trên `feature/aip-gate-followups` qua `core:git-workflow`; không push.
- Sau khi sửa file hook, chạy `node test/validate.mjs --only hooks`; chạy `npm test` một lần ở Task 5.

## Review Focus
- Task 1: danh sách file sắp ghi khớp từng nhánh (`full` thay `settings.json`, `ask` sinh lại), không ghi dở một nửa.
- Task 2: handoff đã commit (kể cả khác hoa/thường, qua symlink) không được nạp; batch lỗi rơi về từng file.
- Task 4: thư mục con thật của repo không thừa kế file gốc.

### Task 1: từ chối ghi qua symlink ở aip mode / aip autonomy
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC1.1, AC1.2
**Files:**
- Modify: `cli/lib/mode.mjs`
- Modify: `cli/lib/autonomy.mjs`
- Test: `test/mode.test.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `assertNotLinked(files)` export từ `cli/lib/mode.mjs`

- [ ] **Step 1:** thêm test: repo git tạm, `.claude` là junction/symlink tới thư mục ngoài; chạy `runMode('full'|'ask')` và `runAutonomy('high'|'safe')` (với khoá `autonomy` có sẵn) → exit 1, stderr nêu symlink/junction, thư mục đích và `settings.json` không đổi. Thêm ca file `aip-gate.json` là symlink (bỏ nếu không tạo được symlink file). Chạy: đỏ.
- [ ] **Step 2:** thêm `assertNotLinked` vào `mode.mjs`, gọi trước ghi ở `full`/`ask` (file sắp ghi theo `settingsAction`) và trong `autonomy.mjs` ngay trước `mkdirSync`/`writeFileSync`. Chạy `node test/mode.test.mjs`: xanh, kể cả các test cũ.
- [ ] **Step 3:** commit `fix(cli): refuse aip mode/autonomy writes through symlinks`.

### Task 2: SessionStart tra tracked của handoff bằng một lần git mỗi gốc
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC2.1, AC2.2, AC2.3
**Files:**
- Modify: `core/hooks/scripts/session-start.mjs`
- Test: `test/contract/90-hooks.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: seam `d.listTracked(dir)` của `decide`

- [ ] **Step 1:** thêm test trong khối SessionStart của `90-hooks.contract.mjs`: (a) ≥ 20 ứng viên giả, `listTracked` đếm lời gọi ≤ 2, `gateTracked` không bị gọi; (b) `listTracked` ném lỗi → rơi về `d.tracked` từng file; (c) repo git thật: handoff đã commit (kể cả `HANDOFF.MD` đổi hoa/thường) bị bỏ, file chưa theo dõi được nạp. Chạy: đỏ ở (a).
- [ ] **Step 2:** thay `handoffTracked` bằng bản dùng tập từ `git ls-files -z -- ':(icase,glob)**/handoff.md'` (cache theo gốc trong `d`), điều kiện dùng tập và đường rơi về như design A2; truyền `root` vào `d.tracked`. Chạy `node test/validate.mjs --only hooks`: xanh.
- [ ] **Step 3:** commit `perf(hooks): list tracked handoffs once per root at session start`.

### Task 3: bỏ gợi ý stopGate khi ngoài repo git
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC3.1, AC3.2
**Files:**
- Modify: `core/hooks/scripts/gate-stop.mjs`
- Test: `test/contract/90-hooks.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** thêm test cạnh các ca AC3.2 hiện có (dòng ~862–870): `gate-stop` với `loadGate` trả `null` (ngoài repo) → lý do không có `"stopGate": false`, có `AIP_STOP_GATE=off`; trong repo không có file hoặc file chưa theo dõi → vẫn có gợi ý. Chạy: đỏ ở ca ngoài repo.
- [ ] **Step 2:** đổi điều kiện `fileOff` thành `gate != null && (!gate.file || tracked(gate.file) === false)`. Chạy `node test/validate.mjs --only hooks`: xanh.
- [ ] **Step 3:** commit `fix(hooks): omit stopGate hint outside a git repo`.

### Task 4: readAllowEnvFiles so gốc bằng realpath
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC4.1, AC4.2
**Files:**
- Modify: `cli/lib/init.mjs`
- Test: `test/init.test.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** thêm test cạnh dòng ~395: worktree liên kết không có file, repo chính có `allowEnvFiles: true` chưa theo dõi; `readAllowEnvFiles` với `root` là junction/symlink tới worktree (và win32: ổ đĩa viết khác hoa/thường) → `true`; thư mục con thật → `false`. Chạy: đỏ ở ca link.
- [ ] **Step 2:** thêm so sánh realpath (hạ chữ thường trên win32, lỗi thì so chuỗi). Chạy `node test/init.test.mjs`: xanh.
- [ ] **Step 3:** commit `fix(cli): compare init root with git top via realpath`.

### Task 5: spec sống, bump core, kiểm toàn bộ
**Kind:** DOCS
**Phủ AC:** AC5.1
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md`
- Modify: `docs/specs/cli-wizard/spec.md`
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Modify: `docs/requests/2026-11-12-aip-gate-followups/design.md`

**Interfaces:**
- Consumes: Task 1–4
- Produces: không có

- [ ] **Step 1:** sửa R19 (hooks-gates), R4, R6, R8 (cli-wizard) và dòng lịch sử cuối mỗi spec; xoá mục "giữ nguyên, ghi follow-up" đã làm xong khỏi bất kỳ chỗ nào còn nhắc như việc mở (kiểm bằng grep).
- [ ] **Step 2:** bump `core/.manifest.json` 1.33.5 → 1.33.6; `npm run build`; `node cli/lib/versions.mjs --lock`.
- [ ] **Step 3:** `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-12-aip-gate-followups --base master`, rồi `npm test`: xanh.
- [ ] **Step 4:** commit `docs(specs): record aip-gate followups; chore(core): bump to 1.33.6`.
