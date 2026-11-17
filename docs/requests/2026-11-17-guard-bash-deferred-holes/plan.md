# Vá các lỗ guard-bash ở full đã hoãn Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** vá các lỗ cho qua im lặng của `guard-bash` ở `full` + bypass (nhóm A chung, B Bash, C PowerShell) và làm test hook không phụ thuộc `aip-gate.json` thật.
**Architecture:** vá trên bộ giải của request `2026-11-16-full-path-resolver` (`scanWords`, `resolveWord`, `walkSegments`, `leadInfo`/`leadInfoPs`, `psUnsafe`, `writeTargets`, `confineSegment`); không thêm cơ chế song song. Mọi sửa theo hướng `ask`/`deny`, không thêm `null`.
**Tech Stack:** Node.js 20+ ESM, zero dependency; test là module contract chạy bằng `node test/validate.mjs`.
**Spec:** design.md
**Requirement:** không có

**Thứ tự:** tuần tự Task 1 → 12, không song song (cùng sửa `core/hooks/scripts/guard-bash.mjs` và cùng khối test). Task 1 bắt đầu bằng rebase lên master đã chứa nhánh `claude/beautiful-nobel-cdade6`; nhánh đó chưa merge thì dừng và hỏi người dùng. **Tổng ước lượng:** 285 phút.

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `test/contract/90-hooks.contract.mjs`, `91-guard-mcp.contract.mjs`, `93-hooks-worktree.contract.mjs`, `94-permission-modes.contract.mjs`, `97-audit-mustfix.contract.mjs`, `99-hook-popup.contract.mjs`, `test/content/48-ask-execution-mode.pin.mjs` | chỉ sửa chỗ gọi `decide` thiếu `config`/`reader` (danh sách chốt ở Task 1 Step 2) | Task 1 |
| `test/contract/99-path-permissions.contract.mjs` | assert chống tái phát AC1.4 và khối bảng tham số hoá "lỗ hoãn" (mỗi task thêm hàng của mình) | Task 1–10 |
| `core/hooks/scripts/guard-bash.mjs` | bộ duyệt và phân loại đích của H6; mọi sửa production của request này | Task 2–10 |
| `docs/specs/hooks-gates/spec.md` | R23, R24, Lịch sử | Task 11 |
| `README.md`, `README_VI.md` | đoạn liệt kê giới hạn của `full` nếu có | Task 11 |
| `core/.manifest.json`, `plugins/_versions.lock.json` | bump patch kế tiếp và lock | Task 12 |
| `docs/requests/2026-11-17-guard-bash-deferred-holes/design.md` | đổi Trạng thái khi merge | Task 12 |

## Global Constraints
- Hướng an toàn: không hiểu thì hỏi; không thêm đường nào biến `ask` hiện có thành `null`; không làm lỏng root. Fail-open ngoài `full` giữ nguyên (chỉ `full` + bypass đổi, A2).
- Câu `reason` của `ask`/`deny` (R21) và dòng "Lệnh gồm" không đổi chữ; lỗi nội bộ ở `full` dùng `FULL_PATH_TEXT` hiện có.
- Không đổi `parse()`, `summarize`, `trackDirs`, `gate-config.mjs`, `guard-files.mjs`, `guard-mcp.mjs`, `cli/lib/*`.
- Zero-dependency, Node built-ins; không thêm lời gọi git ở đường nóng.
- Test: một hành vi — một hàng của bảng tham số hoá, tên có ID AC; mỗi lỗ có hàng "đỏ trước khi sửa" và hàng "không hỏi oan"; seam `bd(cmd, { tool, extra })` của `99-path-permissions`; `T` là root hợp lệ, `OUT` ngoài mọi root, tạo bằng `mkdtemp` dưới `<tmpdir>/aip-…`.
- Mọi lệnh test: `node test/validate.mjs --only hook` (và `--only path-permissions` cho khối mới) chạy ở repo/worktree có `mode: full`; `npm test` chỉ chạy trên bản `git clone` sạch.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment chỉ ghi lý do (AGENTS.md); commit header tiếng Anh, body tiếng Việt, commit từng task qua `core:git-workflow`, không `Co-Authored-By`.
- `MAX_WALK_SEGS` đề xuất 1000, chốt bằng đo ở Task 3. Danh sách tên mới của `WRITE_CMDS`: `md`, `ni`, `new-item`, `sc`, `ac`.

## Review Focus
- Ca "không hỏi oan" của mỗi lỗ (vd `builtin cd <T>; rm x`, `Get-ChildItem '<T>' | Remove-Item`, `S=<T>; rm -rf $S/x`) vẫn `null`: hàng đối chứng trong cùng bảng ở Task 4, 5, 8, 10.
- Lỗi A2 chỉ đổi ở full + bypass: hàng "ngoài full vẫn ném lỗi" ở Task 2 (AC1.2).
- Trần `MAX_WALK_SEGS` không làm lệnh dài hợp lệ dưới trần đổi kết quả: hàng 50 × `cd a; rm x` ở Task 3 (AC1.3).
- `sc`/`ac` mới vào `WRITE_CMDS` không làm đổi ca đang `null` của `Set-Content`/`Add-Content` trong root: bộ `99-path-permissions` hiện có ở Task 6 (AC4.1).
- Test AC1.4 quét nguồn test không bắt oan các lời gọi `decide` hợp lệ có `reader`: Task 1 Step 3.

### Task 1: Rebase, baseline và test hook không đọc gate thật
**Kind:** TOOLING
**TDD:** không — chỉ sửa seam của test và thêm một assert quét nguồn; không đổi hành vi production
**Ước lượng:** 25 phút
**Phủ AC:** AC1.4
**Files:**
- Modify: `test/contract/99-path-permissions.contract.mjs` (assert quét nguồn)
- Modify: `test/contract/90-hooks.contract.mjs`, `test/contract/91-guard-mcp.contract.mjs`, `test/contract/93-hooks-worktree.contract.mjs`, `test/contract/94-permission-modes.contract.mjs`, `test/contract/97-audit-mustfix.contract.mjs`, `test/contract/99-hook-popup.contract.mjs`, `test/content/48-ask-execution-mode.pin.mjs` (chỉ chỗ gọi `decide` thiếu `config`/`reader`)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: seam `decide(input, { config, reader, repoRoot, tracked })` của `guard-bash.mjs` và `guard-files.mjs`.
- Produces: không có

- [ ] **Step 1:** `git fetch`, kiểm nhánh `claude/beautiful-nobel-cdade6` đã nằm trong master chưa (`git branch --contains`); chưa thì dừng `blocked` hỏi người dùng. Rồi rebase nhánh làm việc lên master, ghi `core/.manifest.json` version hiện tại và chạy `node test/validate.mjs --only hook`; ghi số đỏ/xanh làm baseline (ở worktree này, repo chính bật `mode: full`, nên dự kiến có ca đỏ vì đọc gate thật).
- [ ] **Step 2:** liệt kê chỗ gọi `decide(`/`main` trong các file trên mà không truyền `config` hay `reader` (`grep -n "decide(" test/…`); ghi danh sách vào ledger. Mỗi chỗ thêm `config` (hoặc `reader: () => null` khi test không cần cấu hình) theo seam đang có trong file đó; không thêm biến môi trường.
- [ ] **Step 3:** thêm vào `99-path-permissions.contract.mjs` assert AC1.4: đọc nguồn các file test hook, mọi lời gọi `decide(` phải có `config` hoặc `reader` trong cùng lời gọi; chạy trên bản chưa sửa Step 2 phải đỏ (thấy danh sách), rồi xanh sau Step 2.
- [ ] **Step 4:** chạy `node test/validate.mjs --only hook`, mong đợi xanh dù repo bật `mode: full`; commit `test(hooks): stop hook tests reading the real aip-gate.json`.

### Task 2: Hết `push(...)` tràn stack và lỗi nội bộ ở full thành ask (A1, A2)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30 phút
**Phủ AC:** AC1.1, AC1.2
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`writeTargets`, `braceExpand`, `walkSegments`, `decide`)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `decide(input, { currentBranch, config, repoRoot })`, `FULL_PATH_TEXT`, `full()` trong `decide`.
- Produces: `decide` không ném `RangeError` với lệnh bất kỳ độ dài; ở `full` + bypass mọi lỗi ném trong thân `decide` thành `ask` với `FULL_PATH_TEXT`.

- [ ] **Step 1:** thêm khối bảng "lỗ hoãn" vào `99-path-permissions.contract.mjs` với hàng AC1.1: `rm <OUT>/x` + 130000 đối số → `deny`; `rm <T>/x` + 130000 đối số → `null`. Chạy `node test/validate.mjs --only path-permissions`, thấy đỏ (đo trước: `RangeError`, hook cho qua).
- [ ] **Step 2:** `grep -n "push(\.\.\." core/hooks/scripts/guard-bash.mjs`; mọi chỗ mà mảng phụ thuộc độ dài lệnh (`writeTargets`, `braceExpand`, `walkSegments`) đổi sang vòng `for`/`concat`. Chạy lại, hàng AC1.1 xanh.
- [ ] **Step 3:** thêm hàng AC1.2 (đỏ trước): `git push` với `currentBranch` ném lỗi ở full + bypass → `ask` có đúng chữ `FULL_PATH_TEXT`; ở `mode: "ask"` và ở full không bypass `decide` vẫn ném lỗi như trước (assert `throws`).
- [ ] **Step 4:** bọc thân `decide` bằng `try/catch`; khi bắt lỗi, gọi `full()` trong một `try` riêng: đúng thì trả `ask(FULL_PATH_TEXT)`, sai hoặc `full()` ném thì ném lại lỗi gốc. Comment một dòng lý do (lỗi bất ngờ không được thành cho qua ở full). Chạy lại, xanh.
- [ ] **Step 5:** chạy `node test/validate.mjs --only hook`, xanh; commit `fix(hooks): ask instead of passing when guard-bash fails in full mode`.

### Task 3: Trần số đoạn lệnh cho bộ duyệt (A3)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25 phút
**Phủ AC:** AC1.3
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`walkSegments`, hằng `MAX_WALK_SEGS`)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: khối bảng "lỗ hoãn" của Task 2; mảng `entry.opaque` mà `decide` đã đọc ở H6.
- Produces: hằng `MAX_WALK_SEGS`; lệnh vượt trần thì `walkSegments` trả đoạn `opaque` ⇒ `ask`.

- [ ] **Step 1:** đo lại bằng script tạm trong scratchpad: 500/1000/2000/4000 × `cd a; rm x` và × `cd a`, ghi thời gian vào ledger; chọn `MAX_WALK_SEGS` sao cho ca ngay dưới trần xong dưới 0,5 s (đề xuất 1000).
- [ ] **Step 2:** thêm hàng AC1.3 đỏ: 8000 × `cd a; rm x` và 8000 × `cd a` → `ask` và dưới 1 s (assert thời gian); 50 × `cd a; rm x` trong root → `null` như cũ.
- [ ] **Step 3:** thêm `MAX_WALK_SEGS` và kiểm số đoạn ở đầu `walkSegments` (không đọc lại từng đoạn khi vượt trần: trả một đoạn `opaque`); comment lý do (đường dẫn `dir` dài dần làm mỗi đoạn tốn bậc hai [Inference, chưa profile]). Chạy `--only path-permissions`, xanh.
- [ ] **Step 4:** chạy `node test/validate.mjs --only hook`, xanh; commit `fix(hooks): cap walked segments so long cd chains ask instead of stalling`.

### Task 4: `cd` sau từ khoá và lệnh bọc (B1)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25 phút
**Phủ AC:** AC2.1
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`walkSegments`)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `leadInfo(seg).cmdAt` (vị trí tên lệnh sau `LEAD_KW`, `builtin`, `command`), `CD_CMDS`, `POP_CMDS`, `structOk`/`allAnd` trong `walkSegments`.
- Produces: không có

- [ ] **Step 1:** thêm hàng AC2.1 đỏ (cwd = project, `T` trong root): `if true; then cd <OUT>; fi; rm x`, `time cd <OUT>; rm x`, `builtin cd <OUT>; rm x`, `command cd <OUT>; rm x` → không `null`; hàng đối chứng `builtin cd <T>; rm x` → `null`. Chạy, thấy đỏ ở các ca ngoài root.
- [ ] **Step 2:** trong `walkSegments`, tên lệnh dùng để nhận `cd`/`popd` lấy từ `t[infos[i].cmdAt]` thay vì `t[0]`; đối số của `cd` lấy sau vị trí đó. Luật tin cậy (`sure`) giữ nguyên nên `cd` trong `if`/`then` thành chưa rõ.
- [ ] **Step 3:** chạy `--only path-permissions` rồi `--only hook`, xanh (ba bảng của `99-hook-popup` không đổi); commit `fix(hooks): track cd after shell keywords and builtin/command wrappers`.

### Task 5: Tên lệnh là biến sau tiền tố bọc và biến gán lạ (B2, B3)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30 phút
**Phủ AC:** AC2.2, AC2.3
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`walkSegments`, `leadInfo`)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `unwrap(tokens)` (trả `[tokens, k]`), `leadInfo(seg).extra`, cờ `opaque` của `walkSegments`.
- Produces: không có

- [ ] **Step 1:** thêm hàng AC2.2 đỏ: `R=rm; sudo $R <OUT>/x`, `R=rm; env $R <OUT>/x`, `R=rm; nohup $R <OUT>/x` → không `null`; đối chứng `sudo rm <T>/x` → `null`. Hàng AC2.3 đỏ: `S=<T>; exec {S}>/dev/null; rm -rf $S/x`, `S=<T>; wait -p S; rm -rf $S/x`, `S=<T>; coproc S { :; }; rm -rf $S/x` → `ask`; đối chứng `S=<T>; rm -rf $S/x` → `null`.
- [ ] **Step 2:** trong `walkSegments`, sau khi giải từ, gọi `unwrap` trên `t`; từ ở vị trí lệnh thật mà `safe()` trả `null` và có `$` hoặc backtick ngoài nháy đơn thì `opaque` (cùng nhánh với kiểm `cmdAt` đầu đoạn).
- [ ] **Step 3:** trong `leadInfo`, thêm vào `extra` tên bị gán bởi `exec {NAME}>`/`<`, `wait -p NAME`, `coproc NAME` (cùng chỗ với `printf -v`); không đụng `VAR_MUTATORS`.
- [ ] **Step 4:** chạy `--only path-permissions` rồi `--only hook`, xanh; commit `fix(hooks): treat wrapped variable command names and exec/wait/coproc assignments as unknown`.

### Task 6: Cmdlet và alias ghi PowerShell trong `WRITE_CMDS` (C3)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 20 phút
**Phủ AC:** AC3.3
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`WRITE_CMDS`, `needsOf`/`DELETE_CMDS` nếu cần)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `WRITE_CMDS`, `FIRST_ONLY` (đã chứa `set-content`, `add-content`, `out-file`), `psWriteCandidates`.
- Produces: không có

- [ ] **Step 1:** thêm hàng AC3.3 đỏ (`tool: 'PowerShell'`): `md '<OUT>\d'`, `ni '<OUT>\f'`, `New-Item '<OUT>\f'`, `sc '<OUT>\f' x`, `ac '<OUT>\f' x` → `deny`; `md '<T>\d'`, `ni '<T>\f'`, `New-Item -Path '<T>\f'`, `sc '<T>\f' x` → `null`.
- [ ] **Step 2:** thêm `md`, `ni`, `new-item`, `sc`, `ac` vào `WRITE_CMDS`; `sc`/`ac` vào `FIRST_ONLY` cùng nhóm với `set-content`/`add-content`; kiểm `needsOf` cho quyền `write`. Chạy `--only path-permissions`, xanh.
- [ ] **Step 3:** chạy `node test/validate.mjs --only hook`, xanh (đặc biệt các ca Set-Content/Add-Content cũ không đổi); commit `fix(hooks): classify md, ni, New-Item, sc and ac as write commands`.

### Task 7: Đích trong ngoặc và splat PowerShell thành `unknown` (C5)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25 phút
**Phủ AC:** AC3.5
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`writeTargets`, `confineSegment`)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `writeTargets(t, msys)` → `{ targets, needs, name, args, allPos }`, `confineSegment` (kết quả `'unknown'` của `classifyTarget`).
- Produces: `writeTargets(t, msys)` trả thêm `unknown: boolean[]` song song `targets`; `confineSegment` coi `unknown[i] === true` là `'unknown'` ⇒ `ask`.

- [ ] **Step 1:** thêm hàng AC3.5 đỏ (`PowerShell`): `Remove-Item ('<OUT>\x')`, `Remove-Item -Path ('<OUT>\x')`, `$p = @{Path='<OUT>\x'}; Remove-Item @p` → không `null`; đối chiếu `Remove-Item '<T>\x'` → `null`.
- [ ] **Step 2:** trong `writeTargets`, đích của dialect PowerShell (`!msys`) mà text bắt đầu bằng `(`, `$(`, `@` + chữ, hoặc chứa `(` ngoài nháy thì đánh dấu `unknown[i] = true`; mảng `unknown` luôn cùng độ dài `targets` (kể cả nhánh tách dấu phẩy). Lấy dấu "ngoài nháy" từ `t.qpos`.
- [ ] **Step 3:** trong `confineSegment`, đích có `unknown[i]` thành `unknown = true` mà không gọi `classifyTarget`. Chạy `--only path-permissions` rồi `--only hook`, xanh; commit `fix(hooks): ask for PowerShell write targets given as parenthesized expressions or splats`.

### Task 8: Đường dẫn đưa qua ống PowerShell (C1)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30 phút
**Phủ AC:** AC3.1
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`confineSegment`, `walkSegments` hoặc chỗ duyệt đoạn trong `decide`)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `writeTargets(t, msys)` kèm `unknown: boolean[]` do Task 7 tạo; `seg.pipeIn`/`seg.pipeOut` của `scanWords`; mảng đoạn `{ t, dir, unres }` của `walkSegments`.
- Produces: không có

- [ ] **Step 1:** thêm hàng AC3.1 đỏ (`PowerShell`): `$p = '<OUT>'; $p | Remove-Item`, `Get-ChildItem '<OUT>' | Remove-Item`, `Get-ChildItem $x | Remove-Item`, `Get-Content a | Set-Content` → không `null` (hai ca đầu `deny` hoặc `ask`, ca `$x` `ask`); đối chứng `Get-ChildItem '<T>' | Remove-Item` → `null`.
- [ ] **Step 2:** `walkSegments` gắn vào entry của đoạn cờ `pipedFrom` (đoạn trước khi có `pipeIn`). Quy tắc trong `confineSegment`/bộ duyệt: lệnh thuộc `WRITE_CMDS` của PowerShell có ống vào và không có đích đường dẫn tường minh ⇒ thêm một đích `unknown`; ngoại lệ: đoạn trước là `get-childitem`/`gci`/`ls`/`dir`/`get-item`/`gi` có đối số đường dẫn tường minh thì các đường dẫn đó thành đích của lệnh ghi với quyền của nó (`delete` cho `Remove-Item`).
- [ ] **Step 3:** chạy `--only path-permissions` rồi `--only hook`, xanh; commit `fix(hooks): check PowerShell write targets fed through the pipeline`.

### Task 9: `Function:`/`Alias:` định nghĩa lại lệnh (C2)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 20 phút
**Phủ AC:** AC3.2
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (cạnh `PS_MUTATORS`, `prepareWalk` hoặc `walkSegments`)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `PS_MUTATORS`, cờ `opaque` của `walkSegments`.
- Produces: không có

- [ ] **Step 1:** thêm hàng AC3.2 đỏ (`PowerShell`): `Set-Alias gd Remove-Item; gd '<OUT>\x'`, `sal gd ri; gd '<OUT>\x'`, `function f { Remove-Item '<OUT>\x' }; f`, `${function:gd} = { Remove-Item $args }; gd '<OUT>\x'` → không `null`.
- [ ] **Step 2:** thêm regex `PS_REDEFINE` cạnh `PS_MUTATORS` (`set-alias`, `new-alias`, `sal`, `nal`, `function:`, `alias:`, `function <tên>`); lệnh PowerShell khớp thì `prepareWalk` đánh `opaque` mọi đoạn (không chỉ tắt giải biến). Chạy `--only path-permissions` rồi `--only hook`, xanh; commit `fix(hooks): ask when a PowerShell command redefines aliases or functions`.

### Task 10: `cd` trong khối và `cd` vào ổ provider PowerShell (C4)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25 phút
**Phủ AC:** AC3.4
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`walkSegments`)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `CD_CMDS`, `structOk`/`allAnd`/`sure` trong `walkSegments`, `PS_CD`.
- Produces: không có

- [ ] **Step 1:** thêm hàng AC3.4 (`PowerShell`), chạy trước để xác định ca nào thật sự đỏ [Unverified: `cd` trong khối]: `& { cd '<OUT>' }; Remove-Item x`, `if ($true) { cd '<OUT>' }; Remove-Item x`, `cd HKCU:; Remove-Item Software\x`, `cd Env:; Remove-Item x`, `cd HKLM:\Software; Remove-Item x` → không `null`; đối chiếu `cd '<T>'; Remove-Item x` → `null`, `cd C:\<trong root>; Remove-Item x` giữ kết quả cũ. Ca đã không `null` ở bản chưa sửa thì ghi vào ledger và bỏ nhánh (i) của design (C4) cho ca đó.
- [ ] **Step 2:** trong `walkSegments`, đối số `cd` của PowerShell khớp `^[A-Za-z][\w]+:` (ổ provider dài hơn một chữ cái) ⇒ `unres = true`; `cd` trong khối/sau `&` ⇒ thư mục chưa rõ từ đó, qua `structOk`/`sure` như D9 chặt (nếu Step 1 cho thấy còn đỏ).
- [ ] **Step 3:** chạy `--only path-permissions` rồi `--only hook`, xanh; commit `fix(hooks): treat PowerShell cd into blocks and provider drives as unknown`.

### Task 11: Spec và README
**Kind:** DOCS
**TDD:** không — tài liệu, không mã
**Ước lượng:** 25 phút
**Phủ AC:** AC5.1
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md` (R23, R24, Lịch sử, dòng "Gồm" đầu file)
- Modify: `README.md`, `README_VI.md` (đoạn liệt kê giới hạn của `full`, nếu có)
- Test: `core/skills/artifact-templates/scripts/check-request.mjs` (chạy trên thư mục request)

**Interfaces:**
- Consumes: hành vi đã làm ở Task 2–10 (tên hằng, giá trị `MAX_WALK_SEGS` chốt ở Task 3).
- Produces: không có

- [ ] **Step 1:** đổi R23 (lỗi nội bộ ở full ⇒ ask, trần số đoạn, `cd` sau từ khoá/lệnh bọc, tên lệnh là biến sau tiền tố bọc, ba chỗ gán lạ `exec {S}>`/`wait -p`/`coproc`) và R24 (PowerShell: đường dẫn qua ống, ngoặc/splat, định nghĩa lại lệnh, `md`/`ni`/`new-item`/`sc`/`ac`, `cd` trong khối và ổ provider); mỗi nhóm một câu, không đổi phần khác. Thêm hai dòng Lịch sử cho `2026-11-17-guard-bash-deferred-holes` và dòng "Gồm" đầu file.
- [ ] **Step 2:** `grep` README.md, README_VI.md tìm đoạn nói về giới hạn của `full` (R23/R24 hay "bộ giải"); có thì cập nhật cho khớp, không có thì ghi vào ledger.
- [ ] **Step 3:** đối chiếu khẳng định với code: liệt kê từng khẳng định kiểm được (tên hằng, số trần, danh sách tên lệnh, mã lỗi) vừa viết, đối chiếu bằng grep trong `guard-bash.mjs`; ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo task; dòng `lệch` sửa docs.
- [ ] **Step 4:** chạy `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-17-guard-bash-deferred-holes/` (không cảnh báo W10–W14 mới); commit `docs(hooks): record guard-bash deferred holes in hooks-gates spec`.

### Task 12: Version, build, lock và kiểm cuối
**Kind:** TOOLING
**TDD:** không — chỉ chạy lệnh và bump version
**Ước lượng:** 25 phút
**Phủ AC:** AC4.1, AC5.2
**Files:**
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json` (qua `node cli/lib/versions.mjs --lock`)
- Modify: `docs/requests/2026-11-17-guard-bash-deferred-holes/design.md` (Trạng thái)
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: version hiện tại ghi ở Task 1 Step 1.
- Produces: không có

- [ ] **Step 1:** bump patch kế tiếp của `core/.manifest.json` (từ master sau rebase, không đoán số); `npm run build`, rồi `node cli/lib/versions.mjs --lock`.
- [ ] **Step 2:** `node test/validate.mjs --only hook` ở worktree, xanh (AC1.4 + AC4.1: gồm `94-permission-modes`, `99-hook-popup`, `99-path-permissions`, `90-hooks`, `97-audit-mustfix`).
- [ ] **Step 3:** reviewer cuối chạy `decide` thật bằng script tạm trong scratchpad cho mọi ca AC1.1–AC3.5 (không chỉ đọc code) và ghi kết quả vào ledger.
- [ ] **Step 4:** `git clone` repo vào thư mục tạm, checkout nhánh, chạy `npm test` trong clone (không phải repo chính); mong đợi xanh. Dọn clone bằng Node `fs.rmSync`.
- [ ] **Step 5:** đổi Trạng thái của `design.md` theo kết quả (merged hash sau khi người dùng duyệt merge); commit `chore(core): bump core for guard-bash deferred holes`.
