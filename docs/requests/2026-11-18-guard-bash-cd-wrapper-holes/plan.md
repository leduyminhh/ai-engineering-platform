# guard-bash cd và lệnh bọc còn sót Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** guard-bash nhận `cd` sau `command --`/`-p`, `builtin --`, `time -p`, `.{ }` (PowerShell) và trong `trackDirs` (H1); nhận `wait` cờ gộp/dính liền; `timeout $T` vẫn hỏi (D5 bị hoàn nguyên sau review cuối, người dùng quyết 2026-11-18).
**Architecture:** vá trên bộ giải hiện có (`leadInfo.cmdAt`, `unwrap`, `trackDirs`, `walkSegments`); không thêm cơ chế song song. Mọi sửa theo hướng `ask`/`deny`, không thêm `null`.
**Tech Stack:** Node.js 20+ ESM, zero dependency; test là module contract chạy bằng `node test/validate.mjs`.
**Spec:** design.md
**Requirement:** không có

**Thứ tự:** tuần tự Task 1 → 6, cùng nhánh `claude/laughing-tu-69e18d`, sau request `2026-11-17-guard-bash-deferred-holes` (mọi task cùng sửa `core/hooks/scripts/guard-bash.mjs`). **Tổng ước lượng:** 135 phút.

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/hooks/scripts/guard-bash.mjs` | `cmdAt`, `walkSegments`, `trackDirs`, `unwrap`, nhánh `wait` | Task 1–4 |
| `test/contract/99-path-permissions.contract.mjs` | khối mới "cd và lệnh bọc" (bảng tham số hoá, mỗi task thêm hàng) | Task 1–4 |
| `docs/specs/hooks-gates/spec.md` | R23, Lịch sử, dòng "Gồm" | Task 5 |
| `README.md`, `README_VI.md` | đoạn giới hạn của `full` | Task 5 |
| `core/.manifest.json`, `plugins/_versions.lock.json` | bump patch kế tiếp và lock | Task 6 |
| `docs/requests/2026-11-18-guard-bash-cd-wrapper-holes/design.md` | đổi Trạng thái khi xong | Task 6 |

## Global Constraints
- Hướng an toàn: không hiểu thì hỏi; không thêm đường nào biến `ask`/`deny` hiện có thành `null`; không làm lỏng root. Fail-open ngoài `full` + bypass giữ nguyên.
- Câu `reason` của `ask`/`deny` (R21) và dòng "Lệnh gồm" không đổi chữ.
- Không đổi `parse()`, `summarize`, `gate-config.mjs`, `guard-files.mjs`, `guard-mcp.mjs`, `cli/lib/*`; `trackDirs` chỉ đổi vị trí nhận `cd` (D2), luật cd cũ giữ.
- `command -v`/`-V` là tra cứu: không làm thư mục đổi và giữ ngoại lệ `lookup` (không hỏi `command -v $x`).
- Zero-dependency; không thêm lời gọi git ở đường nóng.
- Test: một hành vi một hàng của bảng; hàng đỏ trước khi sửa và hàng đối chứng; tên có ID AC; seam `bd(cmd, { tool, opts, extra })`; `T` trong root, `OUT` ngoài mọi root. Lệnh test hẹp: `node test/validate.mjs --only path-permissions` (không nằm trong `--only hook`: chạy cả hai); `npm test` chỉ trên bản `git clone` sạch.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment chỉ ghi lý do (AGENTS.md); commit header tiếng Anh, body tiếng Việt, từng task qua `core:git-workflow`; commit test đỏ trước, rồi code.
- Không dùng `String.replace` với chuỗi thay thế có `$`` hoặc `$&` khi sửa code bằng script (đã làm hỏng file một lần); dùng công cụ Edit.

## Review Focus
- Hàng đối chứng của mỗi lỗ vẫn `null` (`command -v cd; rm x`, `command -p cd <T>; rm x`, `builtin cd other && git push`, `wait -fn`): hàng đối chứng trong cùng bảng ở Task 1, 3, 4.
- Đổi `trackDirs` (H1) không làm đổi kết quả ba bảng `99-hook-popup` và khối cd/F2 của `90-hooks`: chạy `--only hook` ở Task 3.
- `cmdAt` mới không làm lọt `command -v` thành lệnh `cd`/ghi: hàng `command -pv cd; rm x` ở Task 1.
- `timeout` chỉ nhận thời lượng literal (D5 hoàn nguyên): hàng `T='5 rm'; timeout $T -rf <OUT>/x` → `ask` ở Task 4.
- Cờ gộp `wait` không bắt nhầm lệnh không liên quan (`wait -fn`, `wait 1 2 3`): hàng đối chứng ở Task 4.

### Task 1: `cmdAt` bỏ cờ của command/builtin/time (D1)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25 phút
**Phủ AC:** AC1.1
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`leadInfo`, vòng `cmdAt` và vòng từ khoá mở đầu)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `leadInfo(seg).cmdAt`, `LEAD_KW`, ngoại lệ `lookup` (`command -v/-V`) trong `walkSegments` của request trước, `CD_CMDS`.
- Produces: `leadInfo(seg).cmdAt` bỏ cờ (`--`, `-p`) sau `builtin`/`command`/`time`, trừ khi cờ gồm `v`/`V` (lookup: `cmdAt` giữ ở từ `command`).

- [ ] **Step 1:** thêm hàng AC1.1 đỏ vào khối mới "cd và lệnh bọc": `command -- cd <OUT>; rm x`, `command -p cd <OUT>; rm x`, `builtin -- cd <OUT>; rm x` → `deny`; `time -p cd <OUT>; rm x` → `ask`; đối chứng `command -v cd; rm x`, `command -v $x`, `command -pv cd; rm x`, `builtin cd <T>; rm x`, `command -p cd <T>; rm x` → `null`. Chạy `node test/validate.mjs --only path-permissions`, thấy đỏ ở bốn hàng đầu; commit test đỏ riêng.
- [ ] **Step 2:** trong `leadInfo`, sau khi bỏ `builtin`/`command` bỏ tiếp các từ bắt đầu bằng `-`; gặp cờ khớp `^-[A-Za-z]*[vV]` sau `command` thì đặt `cmdAt` ở chính từ `command` (lookup) và dừng. Vòng từ khoá mở đầu bỏ cờ sau `time` (`-p`). Chạy lại, xanh; chạy `--only hook`.
- [ ] **Step 3:** commit `fix(hooks): skip flags of command, builtin and time when finding the command name`.

### Task 2: `.{` và `&{` đầu đoạn PowerShell (D3)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 15 phút
**Phủ AC:** AC1.2
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`walkSegments`, vòng `while (t[ci] === '{') ci++`)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: biến `ci` và `name` của `walkSegments` (request trước), `structOk`/`compound`.
- Produces: không có

- [ ] **Step 1:** thêm hàng AC1.2 (PowerShell): `.{ cd '<OUT>' }; Remove-Item x`, `&{ cd '<OUT>' }; Remove-Item x` → `deny`; thêm `.{ Remove-Item <OUT>/x }` → `deny`; đối chứng `cd '<T>'; Remove-Item x` → `null`. Chạy, thấy đỏ (đặc biệt `.{`); commit test đỏ.
- [ ] **Step 2:** mở rộng vòng bỏ từ đầu đoạn thành `/^[.&]?\{$/`; chạy `--only path-permissions` và `--only hook`, xanh; commit `fix(hooks): treat .{ and &{ blocks like { when finding the PowerShell command name`.

### Task 3: `trackDirs` (H1) nhận cd qua unwrap (D2)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25 phút
**Phủ AC:** AC1.3
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`trackDirs`, `unwrap`)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `unwrap(tokens)` trả `[tokens, k]`; `CD_CMDS`, `POP_CMDS`; seam `currentBranch(dir)` của `decide`.
- Produces: `unwrap` nhận `builtin` như tiền tố bọc (bỏ cờ như `command`); `trackDirs` lấy tên lệnh `cd` và đối số từ `unwrap(t)`.

- [ ] **Step 1:** thêm hàng AC1.3: với seam `currentBranch: (d) => (d === path.resolve(P, 'repo') ? 'main' : 'feature/x')`, `builtin cd repo && git push`, `command cd repo; git push origin HEAD`, `command -- cd repo && git push`, `if true; then cd repo; fi; git push` → `ask`; đối chứng `cd repo && git push` → `ask`, `builtin cd other && git push` → `null`; chạy ở full + bypass và ở `cfg: { mode: 'ask' }`. Chạy, thấy đỏ; commit test đỏ.
- [ ] **Step 2:** thêm `builtin` vào danh sách tiền tố của `unwrap` (bỏ cờ sau nó); trong `trackDirs`, `const [tk, k] = unwrap(t)`, `name = cmdName(tk[k])`, đối số `cd` lấy từ `tk.slice(k + 1)`; luật cd cũ giữ nguyên. Chạy `--only path-permissions` và `--only hook` (đặc biệt khối cd/F2 của `90-hooks`), xanh; commit `fix(hooks): let trackDirs recognise cd after builtin, command and then`.

### Task 4: `wait` cờ gộp (D4) và hàng khoá `timeout` (D5 hoàn nguyên)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25 phút
**Phủ AC:** AC1.4, AC1.5
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`leadInfo` nhánh `wait`)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: cửa sổ `ws.slice(k + 1, k + 4)` của nhánh `wait` (request trước).
- Produces: không có

- [ ] **Step 1:** thêm hàng AC1.4: `S=<T>; wait -fp S; rm -rf $S/x`, `S=<T>; wait -pS; rm -rf $S/x`, `S=<T>; wait -n -fp S; rm -rf $S/x` → `ask`; đối chứng `S=<T>; wait -fn; rm -rf $S/x`, `S=<T>; wait; rm -rf $S/x` → `null`; hàng AC1.5: `timeout $T ls`, `timeout ${T}s ls <T>/x`, `T='5 rm'; timeout $T -rf <OUT>/x`, `R=rm; timeout 5 $R <OUT>/x`, `R=rm; timeout $T $R <OUT>/x` → `ask`; `timeout 5 ls <T>/x` → `null`. Chạy, thấy đỏ ở `wait` cờ gộp; commit test đỏ.
- [ ] **Step 2:** nhánh `wait`: trong cửa sổ, nhận từ khớp `^-[A-Za-z]*p(.*)$`; tên biến là phần dính liền nếu có, không thì từ kế. Chạy `--only path-permissions` và `--only hook`, xanh; commit `fix(hooks): recognise wait combined flags`.

### Task 5: Spec và README
**Kind:** DOCS
**TDD:** không — tài liệu, không mã
**Ước lượng:** 20 phút
**Phủ AC:** AC2.2
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md` (R23, Lịch sử, dòng "Gồm")
- Modify: `README.md`, `README_VI.md` (đoạn giới hạn của `full`)
- Test: `core/skills/artifact-templates/scripts/check-request.mjs` (chạy trên thư mục request)

**Interfaces:**
- Consumes: hành vi đã làm ở Task 1–4 (tên hằng, hàm).
- Produces: không có

- [ ] **Step 1:** đổi R23: nêu D1–D4 (cd sau cờ của `command`/`builtin`/`time`, `command -v` là tra cứu; `.{`/`&{`; H1 nhận `cd` qua `unwrap`; `wait` cờ gộp) và bỏ khỏi "giới hạn đã biết" các mục đã vá (`command -- cd X`, `command -p cd X`, `time -p cd X`, `.{ cd X }`, `wait -fp S`, `trackDirs` dùng `t[0]`); thêm một dòng Lịch sử cho `2026-11-18-guard-bash-cd-wrapper-holes` (hooks-gates/R23, đổi) và dòng "Gồm". Cập nhật hai README cho khớp.
- [ ] **Step 2:** đối chiếu khẳng định với code: liệt kê từng khẳng định kiểm được (tên hàm, biểu thức, danh sách tiền tố), grep `guard-bash.mjs`, ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo; dòng lệch sửa docs hoặc gắn `[Unverified]`.
- [ ] **Step 3:** chạy `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-18-guard-bash-cd-wrapper-holes/` và `node test/validate.mjs --only spec`; commit `docs(hooks): record cd and wrapper fixes in hooks-gates spec`.

### Task 6: Version, build, lock và kiểm cuối
**Kind:** TOOLING
**TDD:** không — chỉ chạy lệnh và bump version
**Ước lượng:** 20 phút
**Phủ AC:** AC2.1, AC2.3
**Files:**
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json` (qua `node cli/lib/versions.mjs --lock`)
- Modify: `docs/requests/2026-11-18-guard-bash-cd-wrapper-holes/design.md` (Trạng thái)
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: version hiện tại của `core/.manifest.json` (1.34.8 sau request trước).
- Produces: không có

- [ ] **Step 1:** bump patch kế tiếp của `core/.manifest.json`; `npm run build`, rồi `node cli/lib/versions.mjs --lock`.
- [ ] **Step 2:** `node test/validate.mjs --only hook` và `--only path-permissions` và `--only spec`, xanh.
- [ ] **Step 3:** reviewer cuối chạy `decide` thật bằng script tạm trong scratchpad cho mọi ca AC1.1–AC1.5 và ghi kết quả vào ledger.
- [ ] **Step 4:** `git clone` repo vào thư mục tạm, chạy `npm test` trong clone; mong đợi exit 0. Dọn clone bằng Node `fs.rmSync`.
- [ ] **Step 5:** đổi Trạng thái của `design.md` theo kết quả (merged hash sau khi người dùng duyệt merge); commit `chore(core): bump core for guard-bash cd and wrapper holes`.
