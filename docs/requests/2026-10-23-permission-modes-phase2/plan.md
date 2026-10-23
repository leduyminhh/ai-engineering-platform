# Chế độ quyền giai đoạn 2 (P4e-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chặn `full` khi `aip-gate.json` được git theo dõi, vá các minor của hook/CLI, và (nếu người dùng cho đo) thêm root chỉ-đọc cho file của Claude Code ngoài project.
**Architecture:** `fullEffective(gate, input, { tracked })` trong `core/hooks/scripts/gate-config.mjs` là lớp tin cậy đặt trên hàm thuần `effectiveMode`; ba hook `guard-*` gọi nó. `resolveGate` trả thêm `file` và xử lý file worktree hỏng. `cli/lib/mode.mjs` dùng cùng quy tắc và in cảnh báo git. Các minor là vá cục bộ trong `guard-bash.mjs`.
**Tech Stack:** Node.js 20+ built-ins (ESM), test tự viết kiểu `ok(cond, msg)`.
**Spec:** design.md
**Requirement:** không có

## Global Constraints

- Zero-dep, Node built-ins; UTF-8 không BOM, LF; comment code tiếng Việt chỉ nêu *vì sao*; README EN/VI; hook fail-open, chỉ đọc, không ghi file; kiểm rẻ trước (phiên thường, project `ask` không spawn git).
- Tên test mang tiền tố `P4e2 ACx.y:`; test CLI trong thư mục tạm, dọn bằng `fs.rmSync`; không `rm -rf` thư mục có junction trên Windows; không chạy `claude -p` trừ phép đo Task 6 và chỉ khi người dùng đã đồng ý (trần `--max-budget-usd 0.2`).
- Bump version đúng một lần ở Task 8 (core chắc chắn; backend/frontend chỉ khi `node cli/lib/versions.mjs --lock` buộc), không sửa tay `plugins/_versions.lock.json`.
- `AGENTS.md` và `core/agents/AGENTS.template.md` không đổi (design R-I4.6).
- Khẳng định về Claude Code chưa đối chiếu giữ `[Unverified]` kèm link; không in bí mật vào báo cáo.
- Nhánh `feature/permission-modes-phase2`; commit mỗi task qua `core:git-workflow` (`git commit -F` từ file ngoài repo, header tiếng Anh, thân tiếng Việt có dấu, không Co-Authored-By); không push, không merge.
- Các task tuần tự (cùng sửa `gate-config`, `guard-bash`, `guard-files`, `mode.mjs`); không khai `**Song song:**`.

## Review Focus

- Kiểm rẻ trước: phiên không bypass hoặc `mode` ≠ `full` không được spawn git; một lần `decide` không quá một lệnh git cho mỗi file cấu hình (Task 1).
- Mọi kết quả git khác exit 0/1 (không có git, timeout, 128, spawn lỗi) ⇒ `ask`, không bao giờ `full` (Task 1).
- Worktree: file được kiểm là file thật cấp cấu hình; file worktree hỏng che repo chính ở cả hook lẫn `aip mode` (Task 1, 3).
- `aip mode` không bao giờ ghi `.gitignore` và không ghi file nào khi cấu hình hỏng (Task 2, 3).
- Wrapper: `sudo -u root rm`, `env -S` với chuỗi nháy, `nice --10`: không bỏ sót đích ngoài root và không làm sai đích trong root (Task 4).
- PowerShell không đổi `/e/x`, Bash vẫn đổi (Task 4); test win32-only phải tự bỏ qua trên nền khác.
- Root chỉ-đọc không bao giờ cho ghi (Task 6, nếu nhánh A).

---

### Task 1: Lớp tin cậy `fullEffective` (I4)
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6
**Files:**
- Modify: `core/hooks/scripts/gate-config.mjs`, `core/hooks/scripts/guard-bash.mjs`, `core/hooks/scripts/guard-files.mjs`, `core/hooks/scripts/guard-mcp.mjs`
- Test: `test/contract/94-permission-modes.contract.mjs` (thêm; không đổi bảng AC1.1 của P4e)

**Interfaces:**
- Produces trong `gate-config.mjs`:
  - `resolveGate(dir)` thêm trường `file` (đường dẫn tuyệt đối của file cấu hình thực sự dùng: file worktree nếu có, ngược lại file repo chính; `null` khi không có cấu hình).
  - `export function gateTracked(file: string, { run }?): true | false | null` — `git -C <dirname(dirname(file))> ls-files --error-unmatch -- .claude/aip-gate.json`; exit 0 ⇒ `true`, exit 1 ⇒ `false`, mọi kết quả khác ⇒ `null`; nhớ kết quả theo `file` trong tiến trình; `run` là seam test (mặc định `execFileSync`, timeout 3000 ms).
  - `export function fullEffective(gate: { config, roots, file? } | null, input: object, { tracked }?): boolean` — thứ tự kiểm rẻ trước: (1) `input.permission_mode === 'bypassPermissions'`, (2) `effectiveMode(gate?.config, input) === 'full'`, (3) nếu `gate.file` có mặt thì `gateTracked(gate.file) === false`; không có `gate.file` (cấu hình tiêm) thì bỏ qua (3).
- Consumes: `effectiveMode` (giữ nguyên).
- Hook: `guard-bash`, `guard-files` (cả `isFull` lẫn `confine`), `guard-mcp` đổi sang `fullEffective`; `guard-mcp` đọc bằng `readGate` thay `readGateConfig`. Nhánh `ask` dự phòng của phiên không bypass trong `guard-bash` KHÔNG qua `fullEffective` (design R-I4.4).

- [ ] **Step 1: Viết test (đỏ)** nhãn `P4e2 AC1.x:`. Dựng repo git tạm (`git init`, `.claude/aip-gate.json` với `mode:"full"`): file đã `git add` ⇒ AC1.1 (`cat .env` hỏi, Write `.env` chặn, `mcpAllow` chặn tool ngoài, `rm /etc/x` không bị H6 chặn); chưa add ⇒ AC1.2 (kể cả có `.gitignore`); AC1.3 đếm lời gọi `run` (không bypass, `mode` thiếu/`ask` ⇒ 0; bypass + `full` ⇒ đúng 1 dù gọi `decide` có nhiều `full()`); AC1.4 `run` trả mã 128/ném lỗi/exit lạ ⇒ không `full`, thêm một ca thật chạy hook với `PATH` không có git; AC1.5 worktree thật (`git worktree add`): file worktree tracked ⇒ ask; chỉ repo chính, tracked ⇒ ask, untracked ⇒ full; AC1.6 `mode:"full"` tracked + `permission_mode:'default'` + `git push origin feature/x` ⇒ `ask`. Dọn thư mục tạm bằng `fs.rmSync`.
- [ ] **Step 2: Chạy `node test/validate.mjs --only P4e2`.** Mong đợi: FAIL.
- [ ] **Step 3: Hiện thực** theo Interfaces; comment giải thích *vì sao* chặn file được theo dõi (repo không đáng tin tự cấp `full`) và vì sao exit lạ ⇒ `ask`.
- [ ] **Step 4: Chạy lại** `--only P4e2`, `--only P4e`, `--only hooks`, `--only guard`. Mong đợi: PASS, không hồi quy P4e.
- [ ] **Step 5: Commit** `feat(core): ignore full mode when aip-gate.json is tracked by git` qua `core:git-workflow`.

### Task 2: `aip mode` cảnh báo và trạng thái git (I4)
**Phủ AC:** AC1.7
**Files:**
- Modify: `cli/lib/mode.mjs`
- Test: `test/mode.test.mjs`

**Interfaces:**
- Consumes: `gateTracked` (Task 1) hoặc lời gọi git tương đương của chính `mode.mjs`; `git check-ignore -q -- .claude/aip-gate.json`.
- Produces: `runMode('full')` in cảnh báo theo ba nhánh của design R-I4.5 (tracked ⇒ cảnh báo bị bỏ qua + `git rm --cached .claude/aip-gate.json`; untracked chưa ignore ⇒ cảnh báo + dòng gitignore; untracked đã ignore ⇒ không in gì về git), vẫn exit 0 và vẫn ghi `mode:"full"`, không đụng `.gitignore`. `runMode('status')` thêm một dòng `git:` (được theo dõi ⇒ full bị bỏ qua; không theo dõi; không xác định). Ngoài repo git (cwd không có git) ⇒ `không xác định`, không lỗi.

- [ ] **Step 1: Viết test (đỏ)** `P4e2 AC1.7:` trong `test/mode.test.mjs` với repo git tạm ba tình huống + kiểm `.gitignore` không đổi (nội dung/không tồn tại) + `status` in dòng git đúng.
- [ ] **Step 2: Chạy `node test/mode.test.mjs`.** Mong đợi: FAIL.
- [ ] **Step 3: Hiện thực.**
- [ ] **Step 4: Chạy lại** `node test/mode.test.mjs`, `node test/args.test.mjs`. Mong đợi: PASS.
- [ ] **Step 5: Commit** `feat(cli): warn in aip mode when aip-gate.json is tracked or not ignored` qua `core:git-workflow`.

### Task 3: Cấu hình worktree hỏng và lỗi `aip mode` (N4, minor CLI)
**Phủ AC:** AC2.3, AC2.5
**Files:**
- Modify: `core/hooks/scripts/gate-config.mjs`, `cli/lib/mode.mjs`
- Test: `test/contract/94-permission-modes.contract.mjs`, `test/mode.test.mjs`

**Interfaces:**
- Produces: `resolveGate` — file `aip-gate.json` của worktree tồn tại nhưng không parse được hoặc không phải đối tượng ⇒ `{ config: null, source: 'worktree-invalid', file: <file worktree> }`, không rơi về repo chính (file thiếu hẳn vẫn rơi về repo chính như R4). `locateGate` của `mode.mjs` dùng cùng quy tắc; `aip mode` in lỗi (JSON hỏng, thư mục thay file `settings.json`/`aip-gate.json`, EISDIR) ra stderr, exit 1, không ghi file nào.
- Consumes: Task 1.

- [ ] **Step 1: Viết test (đỏ)** `P4e2 AC2.3:` (worktree thật: file worktree hỏng, repo chính `mode:"full"` hợp lệ ⇒ `config` null, nguồn `worktree-invalid`; hook `bypass` không `full`; `aip mode status|full|ask` exit 1, stderr có thông báo, cả hai file không đổi) và `P4e2 AC2.5:` (`settings.json` là thư mục ⇒ stderr rõ, exit 1; JSON hỏng ⇒ stderr).
- [ ] **Step 2: Chạy** `node test/validate.mjs --only P4e2` và `node test/mode.test.mjs`. Mong đợi: FAIL.
- [ ] **Step 3: Hiện thực.** `runMode` nhận `err` (mặc định `console.error`) cho thông báo lỗi.
- [ ] **Step 4: Chạy lại** hai lệnh trên cộng `--only P4e`, `--only hooks-worktree`. Mong đợi: PASS.
- [ ] **Step 5: Commit** `fix(core): let a broken worktree aip-gate.json shadow the main repo and send aip mode errors to stderr` qua `core:git-workflow`.

### Task 4: Wrapper `nice`/`env -S`/`sudo` và PowerShell `/e/x` (N2, N3)
**Phủ AC:** AC2.1, AC2.2
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`, `core/hooks/scripts/gate-config.mjs`
- Test: `test/contract/94-permission-modes.contract.mjs`

**Interfaces:**
- Produces: `cmdIndex` hiểu `nice -n5`, `nice --10`, `nice --adjustment N`, tùy chọn có giá trị của `sudo` (`-u`/`--user`, `-g`, `-h`, `-p`, `-C`, `-r`, `-t`, `-U`, `-D`, `-R`, `-T`), và `env -S "<chuỗi>"`/`--split-string` được tách thành token rồi xử lý như lệnh thật (dùng chung cho H6 và `matchesAsk`). Hook không gọi `normalizeMsysPath` (cd, đích ghi, đường dẫn secret, `-C` của git, `classifyPath`) khi `tool_name === 'PowerShell'`.
- Consumes: Task 1 (`fullEffective`).

- [ ] **Step 1: Viết test (đỏ)** `P4e2 AC2.1:` bảng như design (deny khi ngoài root, `null` khi trong root; phiên không bypass: `ask`) và `P4e2 AC2.2:` ca `win32` (bỏ qua trên nền khác) cho PowerShell/Bash cùng với test thuần của `normalizeMsysPath(p, platform)`.
- [ ] **Step 2: Chạy `node test/validate.mjs --only P4e2`.** Mong đợi: FAIL.
- [ ] **Step 3: Hiện thực.**
- [ ] **Step 4: Chạy lại** `--only P4e2`, `--only P4e`, `--only hooks`. Mong đợi: PASS.
- [ ] **Step 5: Commit** `fix(core): cover nice, env -S and sudo option wrappers and keep PowerShell paths literal` qua `core:git-workflow`.

### Task 5: Các minor còn lại của `guard-bash`
**Phủ AC:** AC2.4
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Test: `test/contract/94-permission-modes.contract.mjs`

**Interfaces:**
- Produces: `chmod`/`chown` nhận mode dạng `-x`/`+x`/`u-x` là mode (không làm rơi đích đầu tiên); `bash -lc`/`sh -ic` coi như `-c`; chuyển hướng nối chuỗi tách đủ mọi `>`; `matchesAsk` bỏ qua cờ toàn cục có giá trị (`-n`/`--namespace`/`--context`/`--kubeconfig` cho `kubectl`/`helm`) khi tìm subcommand; bỏ `bypass &&` thừa trước `full()` (không đổi hành vi).
- Consumes: Task 4.

- [ ] **Step 1: Viết test (đỏ)** `P4e2 AC2.4:` đúng các ca của design; ca âm: `chmod +x run.sh`, `kubectl get pods` không `ask`.
- [ ] **Step 2: Chạy `node test/validate.mjs --only P4e2`.** Mong đợi: FAIL.
- [ ] **Step 3: Hiện thực.** Không thêm parser heredoc (minor hoãn còn lại, ghi ở Task 7).
- [ ] **Step 4: Chạy lại** `--only P4e2`, `--only P4e`, `--only hooks`. Mong đợi: PASS.
- [ ] **Step 5: Commit** `fix(core): close remaining guard-bash minors in full mode` qua `core:git-workflow`.

### Task 6: I5 — phép đo và root chỉ-đọc (cổng: cần người dùng đồng ý)
**Phủ AC:** AC3.1, AC3.2 (nhánh A); AC3.3 (nhánh B, thay hai AC trên)
**Files:**
- Modify: `docs/requests/2026-10-23-permission-modes-phase2/design.md` (ghi kết quả đo hoặc quyết định từ chối, bỏ nhánh không dùng khỏi AC), nhánh A: `core/hooks/scripts/gate-config.mjs`, `core/hooks/scripts/guard-files.mjs`
- Test: `test/contract/94-permission-modes.contract.mjs` (nhánh A)

**Interfaces:**
- Produces (nhánh A): `export function fullReadRoots(config): string[]` (mảng đường dẫn tuyệt đối, sai kiểu bỏ) cộng mặc định đã đo; `guard-files.confine`: Read/Grep dưới các root này ⇒ không quyết định; ghi ⇒ `deny`; `guard-bash` H6 coi chúng là ngoài root cho lệnh ghi/xóa.
- Consumes: Task 1.

- [ ] **Step 1 (cổng, chỉ controller làm):** đã có xác nhận của người dùng cho một lần `claude -p` (trần `--max-budget-usd 0.2`, hook `--settings` chỉ ghi `tool_name` + khóa đường dẫn, không ghi nội dung)? Có ⇒ chạy phép đo theo design R-I5.2, ghi kết quả (đường dẫn tổng quát, phiên bản, chi phí) vào design, nhánh A; không ⇒ nhánh B: bỏ Step 2–4, task này chỉ sửa design (AC3.3) và README ở Task 7.
- [ ] **Step 2 (nhánh A): Viết test (đỏ)** `P4e2 AC3.1:`/`P4e2 AC3.2:`.
- [ ] **Step 3 (nhánh A): Hiện thực.** Chạy `--only P4e2`, `--only P4e`, `--only hooks`: PASS.
- [ ] **Step 4: Commit** `feat(core): read-only roots for Claude Code files in full mode` (nhánh A) hoặc `docs(requests): record I5 decision for permission modes phase 2` (nhánh B).

### Task 7: README EN/VI, `CLAUDE.md` và pin
**Phủ AC:** AC4.1
**Files:**
- Modify: `README.md`, `README_VI.md` (mục `Permission modes` / `Chế độ quyền`: điều kiện thứ ba, wrapper nay được phủ, danh sách chưa phát hiện còn lại, PowerShell, worktree hỏng, minor hoãn còn lại gồm tách `;` trong nháy/heredoc, kết quả phép đo hoặc hướng dẫn `fullRoots`; thay đoạn rủi ro I4/I5 cũ), `CLAUDE.md` (một dòng về điều kiện theo dõi git)
- Create: `test/content/30-permission-modes-phase2-docs.pin.mjs` (đúng số thứ tự kế tiếp trong thư mục)
- Test: chính pin này

**Interfaces:**
- Consumes: hành vi Task 1–6. Produces: không có.

- [ ] **Step 1: Viết pin (đỏ)** nhãn `P4e2 AC4.1:` neo theo đoạn (đoạn I4 trong README EN và VI chứa `git ls-files`/`git rm --cached`, `aip-gate.json`, `bypassPermissions`; đoạn wrapper chứa `env -S`; đoạn PowerShell; nhánh I5), không ghim văn xuôi ngoài lệnh/khóa/ngưỡng.
- [ ] **Step 2: Chạy `node test/validate.mjs --only P4e2`.** Mong đợi: FAIL.
- [ ] **Step 3: Viết tài liệu** EN/VI cùng cấu trúc; nhãn `[Unverified]` + link cho điều chưa đối chiếu.
- [ ] **Step 4: Chạy lại** `--only P4e2`, `node test/managed-block.test.mjs`. Mong đợi: PASS.
- [ ] **Step 5: Commit** `docs(core): document tracked-file rule and phase 2 permission-mode changes` qua `core:git-workflow`.

### Task 8: Spec sống, version, kiểm chứng cuối
**Phủ AC:** AC4.2, AC5.1
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md` (đổi R6, đổi R7, thêm R9, thêm R10 nếu nhánh A; bảng lịch sử), `docs/specs/cli-wizard/spec.md` (đổi R4; bảng lịch sử), `core/.manifest.json`, `plugins/_versions.lock.json` (chỉ qua `node cli/lib/versions.mjs --lock`)
- Test: `npm test`

**Interfaces:**
- Consumes: toàn bộ task trước. Produces: không có.

- [ ] **Step 1: Cập nhật hai spec sống** theo khuôn hiện có (mệnh đề kiểm được, nguồn trỏ request này, `Cập nhật:` đổi ngày).
- [ ] **Step 2: Chạy** `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-23-permission-modes-phase2` và thêm `--base master`. Mong đợi: không có W10–W14.
- [ ] **Step 3: Bump `core`** một bậc, `npm run build`, `node cli/lib/versions.mjs --lock`; plugin khác chỉ khi lock buộc.
- [ ] **Step 4: Kiểm toàn bộ, tự chạy:** `npm test`, `npm run pack:verify`, `npm run validate`. Mong đợi: xanh cả ba.
- [ ] **Step 5: Commit** `docs(core): update hooks-gates and cli-wizard specs and bump core version` qua `core:git-workflow`.
