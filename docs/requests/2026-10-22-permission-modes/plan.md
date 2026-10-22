# Hai chế độ quyền theo project `ask`/`full` (P4e) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm chế độ `full` theo project (bật bằng `aip mode full`, chỉ hiệu lực khi phiên chạy `bypassPermissions`), nhốt thao tác ghi/xóa trong root project, và giữ `ask` cho phiên không bypass.
**Architecture:** `effectiveMode(config, input)` là hàm thuần trong `core/hooks/scripts/gate-config.mjs`; ba hook `guard-*` gọi nó đầu `decide` và rẽ nhánh. Việc nhốt root dùng một hàm đường dẫn chung (`gate-config.mjs`) cho `guard-files` và `guard-bash`. Lệnh `aip mode` là `cli/lib/mode.mjs` (hàm thuần dựng nội dung file + một lớp I/O mỏng) nối vào `args.mjs`/`index.mjs`.
**Tech Stack:** Node.js 20+ built-ins (ESM), test tự viết kiểu `ok(cond, msg)` (`test/contract/*.contract.mjs`, `test/*.test.mjs`).
**Spec:** design.md
**Requirement:** không có

## Global Constraints

- Zero-dep, Node built-ins; UTF-8 không BOM, LF; comment code tiếng Việt chỉ nêu *vì sao*; README EN/VI; hook fail-open, chỉ đọc, không ghi file.
- Dùng đúng giá trị `permission_mode === "bypassPermissions"` đã kiểm; thiếu hoặc khác ⇒ `ask`; không suy từ cờ khác. Không cấu hình thừa kế từ thư mục cha, không chế độ global.
- Quyết định của người dùng (2026-10-22): `fullKeep` mặc định `["push"]` (push lên `main`/`master`/`dev`/`develop` và force push vẫn hỏi trong `full`); giữ H5 (`writeScope`) trong `full`.
- Tên test mang tiền tố `P4e ACx.y:`; test CLI chạy trong thư mục tạm, dọn bằng `fs.rmSync`; không `rm -rf` thư mục có junction trên Windows.
- Test hook dùng stdin tự dựng (khóa: `session_id, transcript_path, cwd, scratchpad_dir, permission_mode, effort, hook_event_name, tool_name, tool_input, tool_use_id`) và `config` tiêm vào `decide`; không chạy `claude -p` thật trừ spike Task 1 (phải hỏi người dùng, trần `--max-budget-usd 0.2`).
- Khẳng định về Claude Code chưa đối chiếu giữ nhãn `[Unverified]` kèm link; không in bí mật vào báo cáo.
- Bump version đúng một lần ở Task 9 (core chắc chắn; thành phần khác chỉ khi `node cli/lib/versions.mjs --lock` buộc), không sửa tay `plugins/_versions.lock.json`.
- Nhánh hiện tại (`claude/p4e-permission-modes-4cca67`, tương ứng `feature/p4e-permission-modes` trong design), commit mỗi task qua `core:git-workflow` (header tiếng Anh, thân tiếng Việt có dấu, `git commit -F` từ file ngoài repo, không Co-Authored-By); không push, không merge.
- Các task chạy tuần tự (Task 2–6 cùng sửa `guard-bash`/`guard-files`/`gate-config`); không khai `**Song song:**`.

## Review Focus

- `config.mode` sai kiểu (số, `null`, `"FULL"`, mảng) hoặc `permission_mode` không phải chuỗi: luôn `ask`, không ném lỗi (Task 2).
- `fullKeep`/`fullRoots` sai kiểu (chuỗi, phần tử không phải chuỗi, đường dẫn tương đối): bỏ phần tử sai, mặc định cho `fullKeep`, `fullRoots` rỗng (Task 2).
- Đường dẫn ghi vào root nhưng viết lạ: `..` rồi quay lại (`a/../b`), khác hoa thường trên Windows, dấu `\`, ổ đĩa khác (`C:\…` trên runner Linux), UNC: ngoài root ⇒ `deny`, trong root ⇒ không quyết định (Task 4, 5).
- Redirect khó nhận: `2>&1`, `>/dev/null`, `>>out.log`, `> "x y"`, `NUL`: không chặn nhầm đích hợp lệ, không bỏ sót `> /tmp/y` (Task 5).
- Lệnh ghép (`cd /tmp && rm x`, `rm a; rm /etc/b`, `bash -c "rm /x"`): đoạn nào ra ngoài thì `deny`; `bash -c`/`sh -c`/`eval` mang lệnh ghi/xóa ⇒ `ask` thay vì bỏ sót (Task 5).
- `cwd` của phiên nằm ngoài root (project `full` ở thư mục con nhưng cwd ở nơi khác): đường dẫn tương đối tính theo `cwd`, nên ghi tương đối từ cwd ngoài root bị `deny` (Task 4, 5).
- `mode: "full"` nhưng hook chạy trong subagent không có `permission_mode`: rơi về `ask`, không quyết định sai chiều (Task 1, 2).

---

### Task 1: Spike `permission_mode` trong subagent và khi đổi chế độ giữa phiên
**Phủ AC:** rủi ro [Unverified] trong design (không có AC riêng); ghi kết quả vào design
**Files:**
- Modify: `docs/requests/2026-10-22-permission-modes/design.md` (header `Trạng thái: đã duyệt 2026-10-22`; mục "Quyết định đã chốt": ghi câu hỏi mở 1 = giữ hỏi, 2 = giữ H5, bỏ nhãn "chưa ai duyệt" đúng chỗ; mục "Đã kiểm thực tế": thêm kết quả spike)
- Test: không có (spike)

**Interfaces:**
- Consumes: không có.
- Produces: kết luận bằng văn bản về hai điểm chưa kiểm; các task sau không phụ thuộc vào kết quả (thiếu trường ⇒ `ask` đã là hành vi mặc định).

- [ ] **Step 1: Hỏi người dùng trước khi tốn tiền.** Đề xuất một phiên `claude -p` nhỏ có trần `--max-budget-usd 0.2` gọi một subagent (Agent tool) chạy một lệnh Bash, với hook thử chỉ ghi các khóa của stdin (không ghi nội dung lệnh) vào một file ngoài repo. Người dùng từ chối ⇒ bỏ qua Step 2–3, ghi "chưa kiểm, giữ `[Unverified]`" và sang Step 4.
- [ ] **Step 2: Chạy spike** với `--permission-mode bypassPermissions`, đọc file khóa: có `permission_mode` trong hook chạy bên trong subagent hay không (và `agent_type`). Đổi chế độ giữa phiên (Shift+Tab) không thể tự động hóa trong `-p`: ghi là chưa kiểm trừ khi người dùng tự thử.
- [ ] **Step 3: Ghi kết quả** vào mục "Đã kiểm thực tế" của design (ngày, phiên bản Claude Code, chi phí, chỉ các khóa quan sát được).
- [ ] **Step 4: Cập nhật header và "Quyết định đã chốt"** như mục Files; không đổi AC.
- [ ] **Step 5: Commit** `docs(requests): record P4e approval and permission_mode spike` qua `core:git-workflow`.

### Task 2: `effectiveMode` và chế độ `full` cho `guard-mcp` và `guard-files` (secrets, H5 giữ nguyên)
**Phủ AC:** AC1.1, AC1.3, AC1.4, AC1.5 (phần `guard-mcp`, `guard-files`)
**Files:**
- Modify: `core/hooks/scripts/gate-config.mjs`, `core/hooks/scripts/guard-mcp.mjs`, `core/hooks/scripts/guard-files.mjs`
- Create: `test/contract/94-permission-modes.contract.mjs` (mọi test hook của request này nằm trong file này; các task 3–6 chỉ thêm vào)

**Interfaces:**
- Produces (trong `gate-config.mjs`):
  - `export function effectiveMode(config: object | null, input: object): 'full' | 'ask'` — `'full'` chỉ khi `config.mode === 'full'` (đúng chuỗi, phân biệt hoa thường) và `input.permission_mode === 'bypassPermissions'`.
  - `export function fullKeep(config: object | null): string[]` — mảng chuỗi lọc từ `config.fullKeep`, mặc định `['push']` khi khóa thiếu hoặc không phải mảng; mảng hợp lệ nhưng rỗng ⇒ `[]` (mở hết); chỉ nhận giá trị `'push'`, giá trị lạ bị bỏ.
  - `export function fullRoots(config: object | null): string[]` — phần tử chuỗi là đường dẫn tuyệt đối của `config.fullRoots` (đã `path.resolve`), còn lại bỏ; mặc định `[]`.
  - `export function readGate(dir: string): { config: object, roots: string[] } | null` — như `readGateConfig` nhưng trả thêm `roots`: gốc worktree/project nơi tìm thấy hoặc chứa `aip-gate.json` cộng gốc repo chính (loại trùng). `readGateConfig(dir)` giữ nguyên hành vi và gọi `readGate(dir)?.config ?? null`.
- Consumes: không có.

- [ ] **Step 1: Viết test (đỏ)** trong `94-permission-modes.contract.mjs` theo khuôn `91-guard-mcp.contract.mjs` (`export default async function run({ ok, ctx })`). `P4e AC1.1:` bảng tham số `config.mode` ∈ {thiếu, `'ask'`, `'full'`, `'FULL'`, `1`, `null`, `['full']`} × `permission_mode` ∈ {thiếu, `'default'`, `'acceptEdits'`, `'auto'`, `'dontAsk'`, `'bypassPermissions'`, `5`} chỉ cho `'full'` ở ô (`'full'`, `'bypassPermissions'`); `config` là `null`/chuỗi và `input` là `null` ⇒ `'ask'`; `fullKeep` mặc định, `[]`, `['push','x',3]`, `'push'`; `fullRoots` lọc đường dẫn tương đối. `P4e AC1.4:` `guard-mcp` với `config {mode:'full', mcpAllow:['a']}`, input có `permission_mode:'bypassPermissions'`, tool `mcp__b__t` ⇒ `null`; `mcpDeny:['b']` ⇒ `deny`; cùng cấu hình nhưng `permission_mode:'default'` hoặc thiếu ⇒ `deny` như `ask` (`P4e AC1.5:`). `P4e AC1.3:` `guard-files` (tiêm `allowEnv`, `repoRoot`, `scopes`, và config qua tham số mới `config`) với `full` hiệu lực: Read `.env` và Write `x.pem` ⇒ `null`; Edit ngoài `writeScope` của agent có scope ⇒ vẫn `deny`; không hiệu lực ⇒ `.env` vẫn `deny`.
- [ ] **Step 2: Chạy `node test/validate.mjs --only P4e`.** Mong đợi: FAIL.
- [ ] **Step 3: Hiện thực** `effectiveMode`, `fullKeep`, `fullRoots`, `readGate` như Interfaces. `guard-mcp.decide(input, { config })`: `full` hiệu lực ⇒ bỏ nhánh `mcpAllow`, giữ `mcpDeny`. `guard-files.decide` nhận thêm tham số tiêm `config` (mặc định đọc bằng `readGate(dir)` theo thư mục của file đích, đúng quy tắc cấu hình theo repo chứa file đích); `full` hiệu lực ⇒ bỏ cả hai nhánh `SECRET_DENY`; nhánh `writeScope` (H5) không đổi.
- [ ] **Step 4: Chạy lại** `node test/validate.mjs --only P4e` và `node test/validate.mjs --only guard` (các test `90`/`91`/`93` không hồi quy). Mong đợi: PASS.
- [ ] **Step 5: Commit** `feat(core): add effectiveMode and full mode for guard-mcp and guard-files` qua `core:git-workflow`.

### Task 3: `guard-bash` ở chế độ `full` (H1–H3 và `fullKeep`)
**Phủ AC:** AC1.2, AC1.5 (phần `guard-bash`)
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Test: `test/contract/94-permission-modes.contract.mjs`

**Interfaces:**
- Consumes: `effectiveMode`, `fullKeep` (Task 2); `readGate` để lấy config theo `cwd`.
- Produces: `decide(input, { currentBranch, allowEnv, config })` — `config` tiêm được (mặc định `readGate(cwd)?.config`); khi `full` hiệu lực: bỏ H2 (non-ASCII `-m`, cả nhánh `ASK_UNPARSABLE`) và H3 (file bí mật), chỉ giữ H1 khi `fullKeep(config).includes('push')`; `fullKeep` rỗng ⇒ bỏ cả H1.

- [ ] **Step 1: Viết test (đỏ).** `P4e AC1.2:` với `config {mode:'full'}` và `permission_mode:'bypassPermissions'`: `rm -rf x`, `cat .env`, `curl http://x`, `git commit -m "có dấu"` ⇒ `null`; `git push origin main` và `git push --force` ⇒ `ask`; với `config {mode:'full', fullKeep:[]}` cả hai push ⇒ `null`. `P4e AC1.5:` cùng config nhưng `permission_mode:'default'` hoặc thiếu: `cat .env` ⇒ `ask`, `git commit -m "có dấu"` ⇒ `deny`, `git push origin main` ⇒ `ask` (đúng như không có `mode`). Để tránh gọi git thật, tiêm `currentBranch`.
- [ ] **Step 2: Chạy `node test/validate.mjs --only P4e`.** Mong đợi: FAIL.
- [ ] **Step 3: Hiện thực** rẽ nhánh đầu `decide`; chỉ đọc config khi cần (lệnh không đụng push/commit/secret không tốn lời gọi git: giữ đúng lệch đọc muộn hiện có của `allowEnv`).
- [ ] **Step 4: Chạy lại** `--only P4e` và `--only hooks` (test `90` không hồi quy). Mong đợi: PASS.
- [ ] **Step 5: Commit** `feat(core): full mode for guard-bash with fullKeep` qua `core:git-workflow`.

### Task 4: Nhốt trong root cho `guard-files` (H6)
**Phủ AC:** AC1.6
**Files:**
- Modify: `core/hooks/scripts/gate-config.mjs`, `core/hooks/scripts/guard-files.mjs`
- Test: `test/contract/94-permission-modes.contract.mjs`

**Interfaces:**
- Produces (trong `gate-config.mjs`): `export function classifyPath(p: string, cwd: string, roots: string[]): 'inside' | 'outside' | 'unknown'` — `p` rỗng hoặc chứa `$`, `~`, `` ` `` ⇒ `'unknown'`; ngược lại `path.resolve(cwd, p)` (đã chuẩn hóa `..`) nằm trong một root ⇒ `'inside'`, không thì `'outside'`; so khớp không phân biệt hoa thường trên win32, dấu `\` và `/` như nhau; đường dẫn kiểu ổ đĩa (`/^[A-Za-z]:[\\/]/`) hoặc UNC (`\\\\`) trên nền không phải win32 luôn `'outside'`. Root = `readGate(...).roots` + `input.scratchpad_dir` (nếu là chuỗi tuyệt đối) + `fullRoots(config)`; hàm dựng danh sách này: `export function allowedRoots(gate: {config, roots} | null, input: object): string[]`.
- Consumes: Task 2.

- [ ] **Step 1: Viết test (đỏ).** `P4e AC1.6:` với `full` hiệu lực và `repoRoot` giả (thư mục tạm): Write/Edit/MultiEdit/NotebookEdit vào `<root>/a.txt`, `<root>/x/../b.txt`, `<scratchpad_dir>/t` ⇒ `null`; vào `<root>/../c.txt`, `/etc/x`, `C:\Windows\x` ⇒ `deny` kèm lý do nhắc `fullRoots`; đường dẫn trong một mục `fullRoots` ⇒ `null`; Read/Grep ngoài root ⇒ `ask`, trong root ⇒ `null`; không hiệu lực ⇒ không có H6 (Write `/etc/x` vẫn `null`). Có một ca `cwd` ngoài root ghi bằng đường dẫn tương đối ⇒ `deny` (Review Focus).
- [ ] **Step 2: Chạy `node test/validate.mjs --only P4e`.** Mong đợi: FAIL.
- [ ] **Step 3: Hiện thực** `classifyPath`, `allowedRoots` và nhánh H6 trong `guard-files.decide` (sau nhánh secret, trước H5; `Grep` dùng `ti.path`, bỏ qua khi thiếu path). Không `realpath` symlink: Ruling của plan, ghi vào mục Rủi ro của design ở Task 9 (symlink trong root trỏ ra ngoài không bị phát hiện).
- [ ] **Step 4: Chạy lại** `--only P4e`, `--only hooks`. Mong đợi: PASS.
- [ ] **Step 5: Commit** `feat(core): confine file tools to project roots in full mode` qua `core:git-workflow`.

### Task 5: Nhốt trong root cho `guard-bash` (H6)
**Phủ AC:** AC1.7
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Test: `test/contract/94-permission-modes.contract.mjs`

**Interfaces:**
- Consumes: `classifyPath`, `allowedRoots` (Task 4); `parse()`/`withDirs`-style theo dõi `cd` hiện có để tính thư mục làm việc từng đoạn.
- Produces: trong `decide`, khi `full` hiệu lực, với mỗi đoạn lệnh: tên lệnh (bỏ đường dẫn và `.exe`, không phân biệt hoa thường) thuộc nhóm ghi/xóa của design (`rm rmdir del erase rd remove-item mv move move-item cp copy copy-item touch mkdir chmod chown tee truncate set-content out-file add-content`) hoặc có token chuyển hướng `>`, `>>`, `N>`, `N>>` ⇒ phân loại từng đường dẫn đích: bất kỳ `'outside'` ⇒ `{decision:'deny'}`; không có `'outside'` nhưng có `'unknown'` ⇒ `{decision:'ask'}`; còn lại không quyết định. Quy tắc đích (Ruling của plan): bỏ token bắt đầu bằng `-` (và giá trị của `-Path/-LiteralPath/-FilePath/-Destination` của cmdlet thì tính là đường dẫn); `chmod`/`chown` bỏ tham số vị trí đầu; `cp/copy/copy-item` chỉ xét tham số vị trí cuối; `mv/move/move-item` xét mọi tham số vị trí; `rm -rf *`, `*`, `.*`, `/*` (ký tự glob ở đoạn đầu) ⇒ `'unknown'`, glob ở đoạn sau thì xét phần chữ cố định phía trước; đích `/dev/null`, `NUL`, `&1` bỏ qua; `bash -c`/`sh -c`/`zsh -c`/`pwsh -c`/`powershell -Command`/`eval` mà chuỗi lệnh chứa tên lệnh nhóm ghi/xóa hoặc `>` ⇒ `ask`.

- [ ] **Step 1: Viết test (đỏ).** `P4e AC1.7:` bảng: `rm -rf ../x`, `rm /etc/x`, `mv a /tmp/b`, `echo x > /tmp/y`, `del C:\Windows\x`, `cd /tmp && rm x`, `rm a; rm /etc/b` ⇒ `deny`; `rm -rf build`, `mv a b`, `echo x > out.txt`, `cp /etc/hosts here.txt`, `echo x > /dev/null`, `cmd 2>&1`, `echo x >>out.log`, `ls /tmp` ⇒ `null`; `rm -rf $X`, `rm -rf ~`, `rm -rf *`, `bash -c "rm /x"` ⇒ `ask`; `scratchpad_dir` trong lệnh (`mv a <scratchpad>/b`) ⇒ `null`; không hiệu lực ⇒ `rm /etc/x` vẫn `null`.
- [ ] **Step 2: Chạy `node test/validate.mjs --only P4e`.** Mong đợi: FAIL.
- [ ] **Step 3: Hiện thực** theo Interfaces, dùng đoạn `segs` từ `parse()` (và cũng chạy trên `naiveSegments` như H1 để nháy lẻ không che lệnh); thứ tự quyết định: H1 (fullKeep) → H6 deny → H6 ask. Comment nêu rõ đây là heuristic, không phải sandbox (design, mục Rủi ro).
- [ ] **Step 4: Chạy lại** `--only P4e`, `--only hooks`. Mong đợi: PASS.
- [ ] **Step 5: Commit** `feat(core): confine bash write/delete to project roots in full mode` qua `core:git-workflow`.

### Task 6: `ask` bằng hook cho phiên không bypass trong project `full`
**Phủ AC:** AC1.8, AC1.9
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Test: `test/contract/94-permission-modes.contract.mjs`

**Interfaces:**
- Consumes: `effectiveMode` (Task 2), config tiêm của `decide` (Task 3).
- Produces: `export const ASK_COMMANDS = ['git push', 'curl', 'wget', 'kubectl apply', 'terraform apply', 'helm upgrade']` trong `guard-bash.mjs` (tiền tố lệnh đầu đoạn; `git push` khớp cả khi có `-C <dir>`/`-c k=v` xen giữa nhờ `gitCmd`); khi `config.mode === 'full'` và `effectiveMode(...) === 'ask'` ⇒ lệnh khớp trả `{decision:'ask'}`; `mode` thiếu hoặc `'ask'` ⇒ không bật (đã có quy tắc trong `settings.json`); `full` hiệu lực ⇒ tắt.

- [ ] **Step 1: Viết test (đỏ).** `P4e AC1.8:` `config {mode:'full'}` và `permission_mode` `'default'` hoặc thiếu: `git push origin feature/x`, `curl http://x`, `wget x`, `kubectl apply -f x`, `terraform apply`, `helm upgrade r c` ⇒ `ask`; `ls` ⇒ `null`; `config` thiếu `mode` hoặc `mode:'ask'` ⇒ `curl http://x` là `null`; `full` hiệu lực ⇒ `curl http://x` là `null`. `P4e AC1.9:` đọc `core/permissions/policy.json` qua `loadPolicy`, lấy các quy tắc dạng `Bash(<prefix> *)` của nhóm `git_push`, `network`, `production_deploy`, so sánh tập `prefix` với `ASK_COMMANDS` (bằng nhau, không phân biệt thứ tự); `WebFetch` bị loại có chủ đích (khẳng định tập quy tắc không phải-Bash của ba nhóm đúng bằng `['WebFetch']`, để thêm quy tắc khác mà quên hook làm test đỏ).
- [ ] **Step 2: Chạy `node test/validate.mjs --only P4e`.** Mong đợi: FAIL.
- [ ] **Step 3: Hiện thực** `ASK_COMMANDS` và nhánh trong `decide` (lý do nhắc `aip mode ask`, `--permission-mode bypassPermissions`).
- [ ] **Step 4: Chạy lại** `--only P4e`, `--only hooks`, `--only permissions`. Mong đợi: PASS.
- [ ] **Step 5: Commit** `feat(core): keep ask prompts via hook for non-bypass sessions in full projects` qua `core:git-workflow`.

### Task 7: Lệnh `aip mode full|ask|status`
**Phủ AC:** AC2.1, AC2.2, AC2.3, AC2.4
**Files:**
- Create: `cli/lib/mode.mjs`, `test/mode.test.mjs`
- Modify: `cli/lib/args.mjs`, `cli/index.mjs` (case `mode` và dòng trợ giúp trong `buildHelp()`), `package.json` (nối `&& node test/mode.test.mjs` vào script `test`; kiểm `.github/workflows` xem CI có liệt kê test riêng không), `test/args.test.mjs`

**Interfaces:**
- Consumes: `buildClaudePermissions`, `loadPolicy` (`cli/lib/permissions.mjs`); đường dẫn `.claude/aip-gate.json` và `.claude/settings.json` ở gốc git của cwd.
- Produces:
  - `parse()` đặt `a._ = ['mode', <full|ask|status>]` như mọi lệnh con khác; `mode`-giá trị lạ hoặc thiếu bị từ chối trong `index.mjs` (in cách dùng ra stderr, exit 2); không đổi `explicit`; `-g` với `mode` bị từ chối (exit 2, thông báo "chỉ phạm vi project").
  - `export function applyFull(gate: object | null, settingsText: string | null, { allowEnvFiles }: { allowEnvFiles: boolean }): { gate: object, settingsText: string | null, settingsAction: 'replaced' | 'kept-custom' | 'absent', leftoverRules: string[] }` — `gate.mode = 'full'` giữ khóa khác; `settingsText` trùng byte (sau bỏ BOM, so với `JSON.stringify(buildClaudePermissions(loadPolicy(), { allowEnvFiles }), null, 2) + '\n'`, Ruling: đúng định dạng mà `aip init --full` đang ghi, builder xác nhận bằng cách đọc `cli/lib/init.mjs`) ⇒ `{"permissions":{"deny":[],"ask":[]}}` cùng định dạng đó, `'replaced'`; khác ⇒ không đổi, `'kept-custom'`, `leftoverRules` = các quy tắc của aip có trong `permissions.deny/ask` của file; không có file ⇒ `'absent'`.
  - `export function applyAsk(gate, settingsText, { allowEnvFiles }): { gate, settingsText, settingsAction: 'regenerated' | 'kept' | 'absent' }` — bỏ khóa `mode` (giữ khóa khác); `settingsText` đúng bản `full` do aip sinh ⇒ sinh lại policy chuẩn theo `allowEnvFiles`, `'regenerated'`.
  - `export function statusOf(gate, settingsText): { mode: 'ask' | 'full', settings: 'aip-ask' | 'aip-full' | 'custom-with-aip-rules' | 'custom' | 'absent', leftoverRules: string[] }`.
  - `export function runMode(sub: 'full' | 'ask' | 'status', { root, out }): number` — lớp I/O mỏng: đọc/ghi hai file (UTF-8, LF, không BOM, tạo `.claude/` khi thiếu), in kết quả và cảnh báo (nội dung cảnh báo theo design: cần `--permission-mode bypassPermissions` hoặc settings người dùng, project không bật được; lệnh xóa đường dẫn quan trọng vẫn có thể hỏi; Windows native không có sandbox), trả exit code.

- [ ] **Step 1: Viết test (đỏ).** `P4e AC2.4:` trong `test/args.test.mjs`: `parse(['mode','full'])._` và `['mode','ask']`, `['mode','status']` đúng; `parse(['mode','full','-g']).scope === 'global'`; `parse(['install'])` không đổi. `P4e AC2.1–2.3:` trong `test/mode.test.mjs` (hàm thuần + `runMode` trong thư mục tạm `git init`): file có BOM và khóa khác (`mcpAllow`) được giữ; chạy `full` hai lần cho cùng nội dung; `settings.json` trùng bản aip sinh ⇒ thành `{"permissions":{"deny":[],"ask":[]}}`; bản đã sửa tay ⇒ byte không đổi và `leftoverRules` liệt kê quy tắc aip còn lại; `ask` sau `full` trả policy chuẩn (một ca `allowEnvFiles: true` không có `Read(.env)`); `status` in `mode` và tình trạng; `node cli/index.mjs mode full -g` exit ≠ 0 và `mode bogus` exit 2, chạy qua `execFileSync` với cwd là thư mục tạm.
- [ ] **Step 2: Chạy `node test/args.test.mjs && node test/mode.test.mjs`.** Mong đợi: FAIL.
- [ ] **Step 3: Hiện thực** `mode.mjs` và nối `index.mjs`; định dạng đầu ra của `status` do builder chọn (design, mục "Để builder quyết"), có `mode`, nguồn cấu hình, tình trạng `settings.json`; `runMode` tìm gốc git từ cwd (không thừa kế cha ngoài repo; không có git ⇒ dùng cwd).
- [ ] **Step 4: Chạy lại hai test.** Mong đợi: PASS; `node test/install.test.mjs` và `node test/init.test.mjs` vẫn PASS.
- [ ] **Step 5: Commit** `feat(cli): add aip mode full|ask|status` qua `core:git-workflow`.

### Task 8: Baseline, README EN/VI, `CLAUDE.md` và pin
**Phủ AC:** AC3.1, AC3.2
**Files:**
- Modify: `core/agents/AGENTS.template.md` (một bullet trong `Safety`), `AGENTS.md` (chép byte-for-byte), `README.md`, `README_VI.md` (mục hooks: chế độ quyền; cập nhật dòng `[Unverified]` cũ về "hook `ask` trong bypass" theo kết quả đã kiểm ở design), `CLAUDE.md` (mô tả khóa `mode`/`fullKeep`/`fullRoots` và lệnh `aip mode` trong phần Hooks và Commands)
- Create: `test/content/29-permission-modes-docs.pin.mjs` (số thứ tự kế tiếp thực tế trong thư mục)

**Interfaces:**
- Consumes: hành vi và tên khóa của Task 2–7.
- Produces: không có.

- [ ] **Step 1: Viết pin (đỏ)** theo khuôn `26-cost-tracking-docs.pin.mjs`, nhãn `P4e AC3.1:`/`P4e AC3.2:`: bullet `Safety` trong template chứa `aip-gate.json`, `mode: "full"`, `bypassPermissions` và nói push lên nhánh bảo vệ vẫn cần xác nhận; `AGENTS.md` bằng template từng byte; mỗi README (neo theo đoạn của mục chế độ quyền, một cụm cố định cho mỗi ngôn ngữ) nêu `aip mode`, `bypassPermissions`, `fullKeep`, `fullRoots`, `[Unverified]`, `Windows` và `sandbox`; `CLAUDE.md` nhắc `aip mode`; dòng `[Unverified]` cũ về `ask` trong bypass không còn khẳng định "chưa kiểm" mà khớp kết quả design (kiểm là mệnh đề có điều kiện theo kết quả Task 1, không pin chữ cứng ngoài nhãn).
- [ ] **Step 2: Chạy `node test/validate.mjs --only P4e`.** Mong đợi: FAIL.
- [ ] **Step 3: Viết tài liệu.** Baseline: một bullet, tiếng Anh, ngắn như các bullet `Safety` khác; README EN/VI cùng cấu trúc: hai chế độ, `aip mode full|ask|status`, điều kiện hiệu lực, hành vi trong `full` (hook bỏ gì, giữ gì, nhốt root, `fullKeep`, `fullRoots`), phiên không bypass, cảnh báo (project không bật được bypass; `deny`/`ask` trong `settings.json` vẫn chặn trong bypass; Windows native không có sandbox, muốn nhốt dùng WSL2/VM/container), kết quả kiểm thực tế kèm ngày và phiên bản Claude Code (từ design), điều chưa kiểm. Chép `AGENTS.md` bằng `cp`/Node, không sửa tay.
- [ ] **Step 4: Chạy lại** `--only P4e`, `node test/managed-block.test.mjs`. Mong đợi: PASS.
- [ ] **Step 5: Commit** `docs(core): document permission modes and add Safety bullet` qua `core:git-workflow`.

### Task 9: Spec sống, version, đồng bộ trạng thái, kiểm chứng cuối
**Phủ AC:** AC4.1, AC5.1
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md` (R6 hiệu lực `full`; R7 hành vi hook trong `full` gồm nhốt root và `fullKeep`; R8 phiên không bypass trong project `full`; mỗi yêu cầu một dòng bảng lịch sử), `docs/specs/cli-wizard/spec.md` (R4 `aip mode`), `docs/requests/2026-10-22-permission-modes/design.md` (Trạng thái, mục Rủi ro: ghi Ruling không `realpath`; tick AC đã đạt), `docs/requests/2026-10-21-aip-trends-master-spec/design.md` (bảng trace xu hướng 8: P4e), `docs/specs/README.md` (chỉ nếu bảng cần), `plugins/_versions.lock.json` (chỉ qua `node cli/lib/versions.mjs --lock`), `core/.manifest.json` (bump version)
- Test: `npm test`

**Interfaces:**
- Consumes: toàn bộ task trước.
- Produces: không có (task cuối).

- [ ] **Step 1: Cập nhật hai spec sống** theo khuôn các yêu cầu R1–R5 hiện có (mệnh đề kiểm được, ID `hooks-gates/R6…R8`, `cli-wizard/R4`, bảng lịch sử trỏ `2026-10-22-permission-modes`).
- [ ] **Step 2: Chạy** `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-22-permission-modes` (và với `--base master`). Mong đợi: không có W10–W14.
- [ ] **Step 3: Bump `core`** (hook và `core/skills` nằm trong build plugin): sửa `version` trong `core/.manifest.json` một bậc patch/minor đúng cỡ thay đổi, `npm run build`, `node cli/lib/versions.mjs --lock`; nếu lock buộc thêm plugin khác thì bump đúng thành phần được nêu, một lần, rồi chạy lại.
- [ ] **Step 4: Kiểm toàn bộ, tự chạy:** `npm test`, `npm run pack:verify`, `npm run validate`. Mong đợi: xanh cả ba; nếu đỏ do thiếu build, `npm run build` rồi chạy lại.
- [ ] **Step 5: Commit** `docs(core): add permission-mode specs and bump core version` qua `core:git-workflow`.
