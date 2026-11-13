# Hook fullPaths follow-ups Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** sửa bốn lỗ bảo mật còn lại của PreToolUse hook sau request `fullPaths`: R18 cho `cp`/`mv` vào `.claude`, `guard-files` chặn gốc `<tmpdir>/claude`, vai của đối số vị trí ở `cp`/`Copy-Item`/`Move-Item`, và glob khớp `..`.
**Architecture:** sửa tại chỗ `writesGuardConfig`, `writeTargets` và `classifyTarget` của `guard-bash.mjs`, chuyển `isClaudeTmpRoot` sang `gate-config.mjs` để `guard-files.mjs` dùng chung; test thêm vào bảng ca sẵn có.
**Tech Stack:** Node.js 20+ ESM thuần, không phụ thuộc; test là hàm `run({ ok, ctx })` trong `test/contract/*.contract.mjs` chạy bằng `node test/validate.mjs --only <chuỗi>`.
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/hooks/scripts/guard-bash.mjs` | R18 ghép thư mục `.claude` với tên nguồn; vai `read` cho nguồn copy và slot `Path`/`Destination` của PowerShell; glob khớp `..` | Task 1, Task 3, Task 4 |
| `core/hooks/scripts/gate-config.mjs` | nhận `isClaudeTmpRoot` và câu deny gốc tmp dùng chung | Task 2 |
| `core/hooks/scripts/guard-files.mjs` | `deny` mọi công cụ file vào đúng `<tmpdir>/claude` | Task 2 |
| `core/hooks/scripts/guard-bash.mjs` (import) | bỏ bản `isClaudeTmpRoot`/`BLOCKED_TEXT` local, dùng bản chung | Task 2 |
| `test/contract/99-path-permissions.contract.mjs` | ca mới cho AC1–AC4 (bảng tham số hoá) | Task 1, Task 2, Task 3, Task 4 |
| `test/contract/94-permission-modes.contract.mjs` | ca cũ `cp /etc/hosts here.txt` chuyển từ `pass` sang `ask` (đổi hành vi có chủ đích, K1) | Task 3 |
| `docs/specs/hooks-gates/spec.md` | sửa R18, R23, R24 và thêm dòng Lịch sử | Task 5 |
| `README.md`, `README_VI.md` | mục Hooks: R18 và đoạn `fullPaths` khớp spec | Task 5 |
| `core/.manifest.json`, `plugins/_versions.lock.json` | nâng version và sinh lại lock | Task 6 |

Caller/test bị kéo theo đã grep: `isClaudeTmpRoot` và `BLOCKED_TEXT` chỉ dùng trong `guard-bash.mjs`; test ghim hành vi bị đổi chỉ có ca `cp /etc/hosts here.txt` ở `94-permission-modes` dòng ~182; các ca R18 ở `99-hook-popup` (dòng ~89–92, ~348) và `97-audit-mustfix` (dòng ~39) giữ nguyên, phải còn xanh.

## Global Constraints

- Chỉ tác động ở chế độ full hiệu lực (mục 2, 3, 4) hoặc theo R18 ở mọi chế độ (mục 1); full hiệu lực = phiên `bypassPermissions` + `mode: "full"` + `aip-gate.json` không bị git theo dõi.
- Giữ nguyên chữ ký `classifyPath`, `grantsOf`, `allowedRoots`; không thêm lời gọi git ở đường nóng; zero-dependency; hook fail-open.
- R18: đích `.claude` khớp `/(^|[\\/])\.claude[\\/]*$/`, tên nguồn khớp `^(settings(\.[\w-]+)?|aip-gate)\.json$` (không phân biệt hoa thường); `writesGuardConfig` bỏ qua đích chỉ có vai `read`.
- Câu hỏi dùng câu có sẵn (`CONFIG_TEXT`, `FULL_PATH_TEXT`, `READ_OUTSIDE_TEXT`); không chứa từ trong `BANNED` của `test/contract/99-hook-popup.contract.mjs`; câu deny gốc tmp không nhắc `fullRoots`/`fullPaths`.
- Thiếu `read` ở nguồn chỉ `ask`, không `deny`; `deny` ở đích khác vẫn thắng `ask`.
- Glob khớp `..` (`.?`, `..*`, `.[.]`, `.*`) → `unknown` (ask); không khớp: `.[!.]*`, `.git*`, `a?`, `*`, `.?x`.
- Version: `core/.manifest.json` 1.33.12 → 1.33.14.
- Commit: `core:git-workflow` (`git commit -F`, header tiếng Anh `type(scope): summary`, body tiếng Việt có dấu), KHÔNG `Co-Authored-By`; test đỏ commit riêng trước commit code; không push.
- Một lệnh Bash mỗi lần gọi; không `git stash` trần; comment theo AGENTS.md (tiếng Việt, chỉ nói vì sao).

## Review Focus

1. Nguồn `cp` là glob hoặc biến (`cp OUT/* O/`, `cp $X/a O/b`) ở full không bị bỏ sót: Task 3, test AC3.1.
2. R18 không hỏi nhầm khi `.claude/settings.json` chỉ là nguồn đọc (`cp .claude/settings.json /tmp/x`, `Copy-Item -Path .claude/settings.json -Destination out\x`): Task 3, test AC1.3.
3. `cp -t O OUT/a` kiểm `read` nguồn; cờ gộp `cp -rt O OUT/a` giữ cách thận trọng (đối số cuối vẫn là đích ghi, nên `deny` như cũ): Task 3, test AC3.1.
4. Glob không khớp `..` (`.[!.]*`, `.git*`, `a?`, `.?x`) không bị hỏi thừa: Task 4, test AC4.1.
5. Gốc tmp với `/` cuối bị chặn ở mọi công cụ, file dưới gốc không: Task 2, test AC2.1.

**Tổng ước lượng:** Task 1 20 + Task 2 25 + Task 3 30 + Task 4 15 + Task 5 25 + Task 6 10 = 125 phút tới review cuối, chưa tính review và vòng sửa.

### Task 1: R18 — cp/mv vào thư mục .claude
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 20 phút
**Phủ AC:** AC1.1, AC1.2, AC1.3
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`writesGuardConfig`, thêm hai hằng regex cạnh `GUARD_CONFIG`)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `writeTargets(t, msys)` trả `{ targets, needs, name, args, allPos }` (đã có)
- Produces: `writesGuardConfig(t, msys)` trả `true` thêm cho `cp`/`copy`/`copy-item`/`mv`/`move`/`move-item` khi một đích kết thúc ở `.claude` và một đối số có basename là `settings*.json` hoặc `aip-gate.json`; không đổi chữ ký

- [ ] **Step 1 (test đỏ):** thêm vào `99-path-permissions.contract.mjs`, trong khối guard-bash, một bảng tham số hoá R18 chạy hai cấu hình (`mode: ask` với `permission_mode: default`, và full+bypass) bằng `bd`/`expectAll` sẵn có. AC1.1 (Bash, mong đợi `ask`): `cp settings.json .claude/`, `cp -t .claude settings.json`, `cp -t .claude /s/settings.local.json`, `mv -t .claude settings.json`, `mv settings.json .claude`, `cp aip-gate.json .claude`, `cp --target-directory=.claude settings.json`, `cp a settings.json .claude/`. AC1.2 (PowerShell, `ask`): `Copy-Item settings.json .claude\`, `Copy-Item -Path settings.json -Destination .claude`, `Copy-Item -Path settings.json -Destination .claude\`, `Move-Item settings.json .claude`. AC1.3 (`null`, chạy cả hai cấu hình; đường dẫn tương đối để ở full vẫn nằm trong root): `cp x.json .claude/`, `cp settings.json out/`, `cp .claude/settings.json out/x`. Chạy `node test/validate.mjs --only path-permissions`; mong đợi exit 1 với các ca AC1.1 và AC1.2 đỏ, AC1.3 xanh.
- [ ] **Step 2:** commit test đỏ (`test(hooks): add red cases for cp/mv into .claude`), ghi `red:` vào ledger.
- [ ] **Step 3 (code):** trong `writesGuardConfig`, với tên thuộc nhóm copy/move, trả `true` khi có `target` khớp regex đích `.claude` (Global Constraints) và có đối số (trong `args`) mà basename sau khi tách theo `/` và `\` khớp regex tên file cấu hình. Thêm hai hằng cạnh `GUARD_CONFIG` kèm một dòng comment giải thích vì sao phải ghép tên nguồn (đích là thư mục, tên file nằm ở nguồn). Không đổi nhánh hiện có.
- [ ] **Step 4:** chạy `node test/validate.mjs --only path-permissions`, mong đợi exit 0; chạy `node test/validate.mjs --only hook-popup` và `--only audit-mustfix`, mong đợi exit 0 (các ca R18 cũ còn xanh).
- [ ] **Step 5:** commit code (`fix(hooks): ask when cp/mv targets the .claude directory with a config file`).

### Task 2: guard-files chặn gốc <tmpdir>/claude
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25 phút
**Phủ AC:** AC2.1, AC2.2
**Files:**
- Modify: `core/hooks/scripts/gate-config.mjs` (thêm `isClaudeTmpRoot` và hằng câu deny dùng chung)
- Modify: `core/hooks/scripts/guard-files.mjs` (`confine()`)
- Modify: `core/hooks/scripts/guard-bash.mjs` (bỏ bản local `isClaudeTmpRoot` và `BLOCKED_TEXT`, import bản chung)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `claudeTmpRoots()` (đã có trong `gate-config.mjs`)
- Produces: `isClaudeTmpRoot(p, dir)` (cùng hành vi bản cũ: resolve theo `dir`, bỏ `/` cuối, so không phân biệt hoa thường ở win32) và `CLAUDE_TMP_BLOCKED_TEXT` (chuỗi nguyên văn của `BLOCKED_TEXT` hiện có), cùng export từ `gate-config.mjs`

- [ ] **Step 1 (test đỏ):** thêm bảng AC2.1 vào phần `guard-files` của `99-path-permissions.contract.mjs`: ở full+bypass, mỗi công cụ trong Read, Grep, Write, Edit, MultiEdit, NotebookEdit vào `<tmpdir>/claude` và `<tmpdir>/claude/` → `deny`, `reason` khớp `/luôn/` và không khớp `/fullRoots|fullPaths/`; vào `<tmpdir>/claude/p/x` → `null`; Write vào `<tmpdir>/khac/x` → `deny`, Read vào đó → `ask`; thêm cấu hình `fullPaths` cấp ba quyền cho `<tmpdir>/claude` → vẫn `deny`. AC2.2: ở `mode: ask`, phiên `permission_mode: default`, và `aip-gate.json` bị git theo dõi (seam `tracked`/`reader` như AC6.1 sẵn có), Write vào `<tmpdir>/claude` không trả `deny` của mục này. Đường dẫn tính từ `os.tmpdir()`, không tạo gì dưới đó. Chạy `--only path-permissions`, mong đợi các ca AC2.1 đỏ.
- [ ] **Step 2:** commit test đỏ (`test(hooks): add red cases for guard-files tmp root`), ghi `red:` vào ledger.
- [ ] **Step 3 (code):** chuyển hàm `isClaudeTmpRoot` và chuỗi `BLOCKED_TEXT` từ `guard-bash.mjs` sang `gate-config.mjs` (export, đổi tên chuỗi thành `CLAUDE_TMP_BLOCKED_TEXT`); `guard-bash.mjs` import chúng và bỏ bản local. Trong `confine()` của `guard-files.mjs`, sau `fullEffective` và trước khi tra grant, nếu `isClaudeTmpRoot(target, cwd)` (với `target` đã `normalizeMsysPath`) thì trả `{ decision: 'deny', reason: CLAUDE_TMP_BLOCKED_TEXT }` cho mọi công cụ Read, Grep và `WRITE_TOOLS`.
- [ ] **Step 4:** chạy `node test/validate.mjs --only path-permissions`, `--only permission-modes`, `--only hook-popup`; mong đợi exit 0 cả ba (hành vi `guard-bash` với gốc tmp không đổi).
- [ ] **Step 5:** commit code (`fix(hooks): block the claude tmp root in guard-files like guard-bash`).

### Task 3: vai của đối số vị trí ở cp, Copy-Item và Move-Item
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30 phút
**Phủ AC:** AC1.3, AC3.1, AC3.2, AC3.3, AC5.1
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`writeTargets`, `writesGuardConfig`)
- Modify: `test/contract/94-permission-modes.contract.mjs` (chuyển `cp /etc/hosts here.txt` từ danh sách `pass` sang `ask`, đổi hành vi có chủ đích)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `isClaudeTmpRoot` từ `gate-config.mjs` (Task 2, chưa dùng ở task này); `needs` song song với `targets` của `writeTargets` (đã có)
- Produces: `writeTargets` gán `['read']` cho nguồn của `cp`/`copy`/`copy-item` (mọi đối số vị trí trừ cuối; với `cp -t DIR` mọi đối số vị trí) và gán slot `Path`/`Destination` cho `Copy-Item`/`Move-Item` PowerShell (vai theo Global Constraints và design D4); `writesGuardConfig` bỏ đích có `needs` chỉ gồm `read` khi so `GUARD_CONFIG`

- [ ] **Step 1 (test đỏ):** thêm các bảng vào `99-path-permissions.contract.mjs` (dùng `D`/`O`/`T`/`OUT` sẵn có, full+bypass). AC3.1 Bash: `ask` cho `cp OUT/a O/b`, `cp OUT/a OUT/b2 O/`, `cp -t O OUT/a`, `cp OUT/* O/`, `cp $X/a O/b`; `null` cho `cp T/a O/b`, `cp D/a O/b`, `cp -t O D/a`, `cp x O/b`, `cp -t backup .claude settings.json` (ở cả `mode: ask`); `deny` cho `cp OUT/a D/b` và `cp -rt O OUT/a`. AC3.2 PowerShell: `ask` cho `Copy-Item OUT/a O/b`, `cp OUT/a O/b`, `copy OUT/a O/b`, `Copy-Item -Destination O/b OUT/a`, `Copy-Item -Path OUT/a O/b`; `null` cho `Copy-Item D/a O/b`, `Copy-Item -Destination O/b D/a`, `Copy-Item -Path D/a O/b`; `deny` cho `Copy-Item D/a D/b`. AC3.3 PowerShell: `null` cho `Move-Item -Path T/a O/b`, `Move-Item -LiteralPath T/a O/b`, `Move-Item -Destination O/b T/a`, `Move-Item T/a O/b`; `deny` cho `Move-Item -Path O/a O/b`, `Move-Item -Path T/a D/b`, `Move-Item -Destination O/b O/a`, `Move-Item -Dest T/b O/a`. AC1.3 bổ sung (R18, `mode: ask`): `Copy-Item -Path .claude/settings.json -Destination out\x` (PowerShell) → `null`. Sửa `94-permission-modes.contract.mjs`: bỏ `'cp /etc/hosts here.txt'` khỏi `pass`, thêm vào `ask`. Chạy `--only path-permissions` và `--only permission-modes`, mong đợi đỏ ở các ca nói trên.
- [ ] **Step 2:** commit test đỏ (`test(hooks): add red cases for copy/move operand roles`), ghi `red:` vào ledger.
- [ ] **Step 3 (code, `writeTargets`):** cho nhóm `cp`/`copy`/`copy-item`: nguồn (mọi đối số vị trí trừ cuối khi không có `-t`; mọi đối số vị trí khi có `-t DIR` kiểu GNU của Bash) nhận `['read']` thay vì bị bỏ hoặc `[]`; cờ gộp/dính có `t` giữ cách thận trọng hiện có nhưng phần nguồn nhận `['read']`. Cho `Copy-Item`/`Move-Item` và alias trên PowerShell: slot 0 là `Path` (copy: `read`, move: `delete`), slot 1 là `Destination` (`write`); tham số gọi tên (`-Path`/`-LiteralPath`/`-Destination`, cả dạng `-X:giá-trị`) chiếm slot đó, đối số vị trí lấp slot còn trống theo thứ tự, đối số thừa lấy vai thận trọng (copy `read`+`write`, move `delete`+`write`). Cờ lạ của `Move-Item` giữ nhánh `blurred` cũ; `mv` Bash không đổi.
- [ ] **Step 4 (code, `writesGuardConfig`):** khi so `GUARD_CONFIG` với `targets`, bỏ đích có `needs[i]` chỉ gồm `read`; kiểm lại rằng ca `cp -t .claude <nguồn>` vẫn `ask` nhờ nhánh basename của Task 1.
- [ ] **Step 5:** chạy `node test/validate.mjs --only path-permissions`, `--only permission-modes`, `--only hook-popup`, `--only audit-mustfix`, `--only hooks`; mong đợi exit 0 cả năm (AC5.1).
- [ ] **Step 6:** commit code (`fix(hooks): check read on copy sources and fix Move-Item positional roles`).

### Task 4: glob khớp `..`
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 15 phút
**Phủ AC:** AC4.1
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`classifyTarget`, thêm hàm nhỏ kiểm một đoạn glob có khớp `..`)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: nhánh `GLOB` của `classifyTarget` (đã có, đã trả `unknown` khi `..` đứng sau đoạn glob)
- Produces: `classifyTarget` trả `unknown` khi một đoạn từ đoạn glob đầu trở đi dịch ra regex khớp được chuỗi `..` (`*`→`.*`, `?`→`.`, `[…]`→lớp ký tự với `!`/`^` phủ định); đoạn có `[` không đóng được hoặc regex hỏng coi là khớp

- [ ] **Step 1 (test đỏ):** thêm bảng AC4.1 (full+bypass): `ask` cho `rm T/.?/d/f`, `rm T/..*/d/f`, `rm T/.[.]/d/f`, `rm T/.*/d/f`, `rm T/.*`, `cp x T/.?/f`; `null` cho `rm T/.[!.]*/f`, `rm T/.git*/f`, `rm T/*/d/f`, `rm T/a?/f`, `rm T/.?x/f`; giữ `deny` cho `rm O/*` và `ask` cho `rm T/*/../../d/f`. Chạy `--only path-permissions`, mong đợi các ca `ask` đỏ.
- [ ] **Step 2:** commit test đỏ (`test(hooks): add red cases for globs matching ..`), ghi `red:` vào ledger.
- [ ] **Step 3 (code):** thêm hàm kiểm đoạn glob (dịch sang regex neo hai đầu, thử với `..`, bắt lỗi trả `true`) và dùng nó trong nhánh `GLOB` cho mọi đoạn từ đoạn glob đầu, trả `unknown` trước khi gọi `classifyPath`; kèm comment một dòng nói bash < 5.2 và dash có thể mở rộng thành `..`.
- [ ] **Step 4:** chạy `node test/validate.mjs --only path-permissions`, `--only permission-modes`, `--only hook-popup`; mong đợi exit 0.
- [ ] **Step 5:** commit code (`fix(hooks): ask when a glob segment can match ..`).

### Task 5: spec và README
**Kind:** DOCS
**Ước lượng:** 25 phút
**Phủ AC:** AC6.1
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md` (sửa R18, R23, R24; thêm ba dòng Lịch sử ngày 2026-11-13 trỏ `2026-11-13-hook-fullpaths-followups`; đổi dòng "Cập nhật")
- Modify: `README.md` (đoạn "Hook config writes" và đoạn `fullPaths`: ngoại lệ gốc tmp, bảng quyền theo lệnh, Bash `-t`, glob, quy tắc slot PowerShell)
- Modify: `README_VI.md` (cùng nội dung, tiếng Việt, đoạn "Ghi cấu hình hook" và đoạn `fullPaths`)
- Test: `test/content/30-permission-modes-phase2-docs.pin.mjs` (pin hiện có, không sửa; phải còn xanh)

**Interfaces:**
- Consumes: hành vi đã chốt ở Task 1–4 và design D1–D5
- Produces: không có

- [ ] **Step 1:** sửa `spec.md`: R18 thêm câu `cp`/`mv` vào thư mục `.claude` (đích kết thúc `.claude`, nguồn tên `settings*.json`/`aip-gate.json`; chỉ đích ghi mới tính) và bỏ ca đã bắt khỏi danh sách "không bắt"; R23 bỏ câu "`guard-files` không có ngoại lệ này", ghi cả hai hook chặn gốc `<tmpdir>/claude` với mọi quyền; R24 bỏ câu "nguồn là đối số vị trí của `cp`/`copy` không được kiểm quyền", ghi nguồn `cp`/`copy`/`Copy-Item` cần `read` (thiếu thì `ask`) ở cả Bash và PowerShell, quy tắc slot `Path`/`Destination` của `Move-Item`/`Copy-Item`, và glob có đoạn khớp `..` thì `ask`; cập nhật dòng "Nguồn" của ba mục.
- [ ] **Step 2:** sửa `README.md` và `README_VI.md` theo `spec.md` (các đoạn nêu ở Files); bỏ câu "[Inference: `guard-files` … không có ngoại lệ này]" và dòng bảng chỉ có `Copy-Item -Path` làm nguồn.
- [ ] **Step 3 (đối chiếu khẳng định với code):** liệt kê từng khẳng định kiểm được vừa viết (tên regex, tên hàm, ví dụ lệnh, tên hằng, đường dẫn), đối chiếu với `guard-bash.mjs`, `guard-files.mjs`, `gate-config.mjs` bằng grep hoặc đọc file, ghi vào báo cáo task bảng `khẳng định → file:line → khớp|lệch`; dòng `lệch` thì sửa docs hoặc gắn `[Unverified]`.
- [ ] **Step 4:** chạy `node test/validate.mjs --only permission-modes-docs` và `--only phase2`, mong đợi exit 0.
- [ ] **Step 5:** commit (`docs(hooks): update hooks-gates spec and README for fullPaths follow-ups`).

### Task 6: nâng version và sinh lại lock
**Kind:** TOOLING
**TDD:** không — chỉ nâng version và sinh lại lock, kiểm bằng validate
**Ước lượng:** 10 phút
**Phủ AC:** AC6.2
**Files:**
- Modify: `core/.manifest.json` (version 1.33.12 → 1.33.14)
- Modify: `plugins/_versions.lock.json` (sinh bằng script)
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** sửa `version` trong `core/.manifest.json` thành `1.33.14`.
- [ ] **Step 2:** chạy `npm run build`, mong đợi exit 0.
- [ ] **Step 3:** chạy `node cli/lib/versions.mjs --lock`, mong đợi exit 0 và `plugins/_versions.lock.json` đổi dòng của `core`.
- [ ] **Step 4:** chạy `node test/validate.mjs --only versions`, mong đợi exit 0.
- [ ] **Step 5:** commit (`chore(core): bump to 1.33.14`).
