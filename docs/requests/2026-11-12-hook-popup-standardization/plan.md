# hook-popup-standardization Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** viết lại câu `reason` của nhánh `ask` theo khuôn dễ hiểu (kèm dòng "Lệnh gồm"), sửa các ca `guard-bash` hỏi nhầm (cấu hình hook, file bí mật, chuỗi `bash -c` ở full), và giữ `mcpDeny`/`mcpAllow` khi `guard-mcp` không đọc được cấu hình.
**Architecture:** sửa tại chỗ trong `guard-bash.mjs`, `guard-files.mjs`, `guard-mcp.mjs`, `gate-config.mjs`; test mới gom ở một contract file; không đụng `gate-file.mjs` (hai bản sao giữ nguyên).
**Tech Stack:** Node ESM zero-dependency; test tự viết (`test/contract/*.contract.mjs`, export `default async run({ ok, ctx })`).
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/hooks/scripts/gate-config.mjs` | `gateForGuard(dir)`: bọc `locateGate`, trả `{ gate, invalid }`; `showArg` (Task 5); `allowedRoots` thêm root tạm của Claude (Task 7) | Task 1, 5, 7 |
| `core/hooks/scripts/guard-mcp.mjs` | dùng `gateForGuard`; ask khi file hỏng; honor config khi `gitUnknown` | Task 1 |
| `core/hooks/scripts/guard-bash.mjs` | `writeTargets`, `stringWrites`, cấu hình theo đích (Task 2); `secretScanText` mở rộng (Task 3); `pushReason` trả `{kind,branch}`, `askReason`, `summarize` (Task 4); `substituteVars` cho nhánh full (Task 7) | Task 2, 3, 4, 7 |
| `core/hooks/scripts/guard-files.mjs` | tách reason `ask`/`deny` ở `confine`; sửa `GUARD_CONFIG_ASK` | Task 5 |
| `test/contract/99-hook-popup.contract.mjs` | file test mới: mọi AC1–AC3 | Task 1–5 |
| `test/contract/94-permission-modes.contract.mjs` | dòng 264 bỏ `--permission-mode bypassPermissions` khỏi assert (thuật ngữ bị cấm trong reason ask), giữ `aip mode ask` | Task 4 |
| `core/agents/AGENTS.template.md`, `AGENTS.md` | một dòng rule mỗi lệnh Bash một việc; gộp để ≤ 200 dòng | Task 6 |
| `docs/specs/hooks-gates/spec.md`, `README.md`, `README_VI.md` | gộp spec sống R3, R7, R18 (đổi), R21, R22 (thêm); mục Hooks | Task 8 |
| `core/.manifest.json`, `plugins/_versions.lock.json` | bump core 1.33.6 → 1.33.7, lock | Task 8 |

## Global Constraints
- Zero-dependency; không sửa `core/hooks/scripts/gate-file.mjs` hay bản sao ở `core/skills/plan-execution/scripts/`.
- Hook fail-open với lỗi nội bộ; không thêm lời gọi git ở đường nóng (`guard-mcp` vẫn một `locateGate`).
- Reason `ask` không chứa "nguyên tắc nền", "hook an toàn", "fullRoots", "bypass", "root"; reason `deny` và `DENY_COMMIT` không đổi.
- Test reason chỉ kiểm khuôn (từ cấm, cụm "cho phép"/"từ chối", ≤ 500 ký tự) và token khớp; không ghim cả câu.
- Mỗi task: test đỏ đúng lý do trước, sửa, test xanh; commit riêng trên `feature/hook-popup-standardization` qua `core:git-workflow`; không push.
- Sau khi sửa file hook, chạy `node test/validate.mjs --only hooks` (nếu không có nhóm đó thì `node test/validate.mjs --build`); chạy `npm test` một lần ở Task 8.

## Review Focus
- Task 2: `echo x > a; cat .claude/settings.json` không hỏi nhưng `bash -c "echo x > .claude/aip-gate.json"`, `cp x .claude/settings.json`, `Set-Content` PowerShell vẫn hỏi; chuỗi nháy không đóng rơi về regex cũ.
- Task 3: `git log -p -- .env`, `git diff -- .env`, `grep x .env`, `git log -- .env | xargs cat` vẫn hỏi; chỉ mẫu tìm kiếm (đối số dương đầu, trước mọi `--`) bị bỏ.
- Task 1: file hỏng ở repo chính khi chạy trong worktree; ngoài repo git vẫn null; `start_session` thiếu model vẫn deny trước.
- Task 4/5: mọi nhánh `ask` đi qua một hàm dựng reason; `deny` không đổi.

### Task 1: guard-mcp giữ mcpDeny khi không đọc được cấu hình
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 20'
**Phủ AC:** AC3.1, AC3.2, AC3.3
**Files:**
- Modify: `core/hooks/scripts/gate-config.mjs`
- Modify: `core/hooks/scripts/guard-mcp.mjs`
- Test: `test/contract/99-hook-popup.contract.mjs`

**Interfaces:**
- Consumes: `locateGate(cwd)` từ `core/hooks/scripts/gate-file.mjs`
- Produces: `gateForGuard(dir)` export từ `gate-config.mjs`, trả `{ gate, invalid }` (`gate` có `config`; `invalid` là đường dẫn file hỏng hoặc `null`); seam `locate` của `guard-mcp.decide`

- [ ] **Step 1:** tạo `99-hook-popup.contract.mjs` với ca AC3: seam `locate` trả (a) `gitUnknown: true` + `config.mcpDeny: ['a']` → `mcp__a__t` deny nêu `mcpDeny`, `mcpAllow: ['a']` chặn `mcp__b__t`; (b) file hỏng (`source: 'worktree-invalid'` và `mainInvalid`) → tool MCP bất kỳ `ask`, lý do nêu đường dẫn file, tool `Bash` và `start_session` thiếu model không đổi; (c) ngoài repo git / không file / file hợp lệ không có `mcpDeny` → như cũ. Thêm một ca CLI trong git repo thật có `aip-gate.json` hỏng → JSON `ask`. Chạy `node test/validate.mjs --only hook-popup` (hoặc `--build`): đỏ.
- [ ] **Step 2:** thêm `gateForGuard` vào `gate-config.mjs` (gọi `locateGate`; `invalid` khi `source === 'worktree-invalid'` hoặc `mainInvalid`; `inRepo === false` → `{ gate: null, invalid: null }`); `guard-mcp.decide` dùng nó (giữ seam `config`, `tracked` hiện có). Chạy `node test/contract/91-guard-mcp.contract.mjs` qua validate: xanh cả test cũ.
- [ ] **Step 3:** commit `fix(hooks): keep mcpDeny when guard-mcp cannot read gate config`.

### Task 2: guard-bash chỉ hỏi cấu hình hook khi đích ghi là file cấu hình; chuỗi bash -c theo parse
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC2.1, AC2.3
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Test: `test/contract/99-hook-popup.contract.mjs`

**Interfaces:**
- Consumes: `parse`, `naiveSegments`, `unwrap`, `expandShells` trong `guard-bash.mjs`
- Produces: `writeTargets(t)` trả `{ targets, name, args }` (nội bộ, không export); `stringWrites(inner)` (nội bộ)

- [ ] **Step 1:** thêm test: ca null (`git commit -m "docs: aip-gate.json" > m2.txt`, `cat .claude/settings.json | tee x`, `echo x > a; cat .claude/aip-gate.json`), ca vẫn ask (`bash -c "echo x > .claude/aip-gate.json"`, `sed -i s/a/b/ .claude/settings.json`, `perl -pi -e s/a/b/ .claude/aip-gate.json`, `cp x .claude/settings.json`, `echo x >> .claude\settings.json`, PowerShell `Set-Content .claude\aip-gate.json x`); full + bypass: `bash -c "awk '$1>2' f"`, `bash -c "grep -rm 1 x ."` → null, `bash -c "rm /x"`, `bash -c "echo a > /x"`, `eval "rm /x"`, chuỗi con nháy không đóng chứa `rm` → ask. Chạy: các ca null đỏ.
- [ ] **Step 2:** tách `writeTargets` khỏi `confineSegment` (chuyển hướng + đối số `WRITE_CMDS` + cờ PowerShell, giữ nguyên hành vi); thay điều kiện dòng 455 bằng kiểm từng đoạn trong `[...segs, ...naiveAll]`: một đích khớp `GUARD_CONFIG`, hoặc `sed`/`perl` có cờ tại-chỗ kèm một đối số khớp `GUARD_CONFIG`; thay `WRITE_IN_STRING.test(args.join(' '))` ở `confineSegment` bằng `stringWrites(chuỗi con)` (parse + naive; nháy không đóng → regex cũ). Chạy toàn bộ contract hook: xanh kể cả 94 và 97.
- [ ] **Step 3:** commit `fix(hooks): ask on hook config only when the write target is the config file`.

### Task 3: guard-bash bỏ qua lệnh metadata và mẫu tìm kiếm khi quét file bí mật
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25'
**Phủ AC:** AC2.2
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Test: `test/contract/99-hook-popup.contract.mjs`

**Interfaces:**
- Consumes: `secretScanText`, `META_GIT`, `cmdName`, `gitCmd` trong `guard-bash.mjs`
- Produces: không có (đổi nội bộ `secretScanText`)

- [ ] **Step 1:** thêm test: null cho `git log -- .env`, `git log --oneline -5 -- credentials`, `ls credentials`, `grep -rn credentials src`, `npm test -- --grep "credentials"`, `rg --glob x credentials`; ask cho `git log -p -- .env`, `git log --patch -- .env`, `git diff -- .env`, `grep x .env`, `grep -rn credentials credentials.json`, `grep -e foo .env`, `cat .env`, `git log -- .env | xargs cat`, `ls .env > out` , `grep -- .env src` (sau `--` không bỏ). Chạy: ca null đỏ.
- [ ] **Step 2:** trong `secretScanText`: thêm `ls`/`dir` và `git log` (chỉ khi mọi cờ nằm trong danh sách an toàn của design) vào nhóm metadata; thêm bước bỏ token mẫu tìm kiếm (đối số dương đầu tiên trước `--` của `grep`/`egrep`/`fgrep`/`rg`/`ag`/`ack`/`findstr`/`select-string`, giá trị `-e`/`--regexp`, giá trị `--grep`/`-t`/`--testNamePattern`/`--filter`/`-k` dạng `=` và dạng tách). Chạy toàn bộ contract hook: xanh (đặc biệt H3 ở 90 và 97).
- [ ] **Step 3:** commit `fix(hooks): skip secret scan for metadata commands and search patterns`.

### Task 4: guard-bash reason theo khuôn, kèm dòng "Lệnh gồm"
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Modify: `test/contract/94-permission-modes.contract.mjs`
- Test: `test/contract/99-hook-popup.contract.mjs`

**Interfaces:**
- Consumes: `writeTargets` (Task 2), `gitCmd`, `segs`
- Produces: `pushReason` trả `{ kind: 'protected' | 'force' | 'unknown', branch? }` hoặc `null`; `askReason(text, segs)` (nội bộ) nối câu với dòng `Lệnh gồm: …`; `summarize(segs)` (nội bộ)

- [ ] **Step 1:** thêm test bảng ca ask của `guard-bash` (push `master`, `git push --force`, `git push origin $B`, ghi `.claude/aip-gate.json`, `cat .env` và `cat server.pem`, `git commit -m "é` nháy chưa đóng, full+bypass `rm -rf $X`, full ngoài bypass `curl http://x`): mỗi reason qua hàm kiểm khuôn (không từ cấm, có "cho phép" hoặc "từ chối", ≤ 500 ký tự không kể dòng "Lệnh gồm"), chứa token (`master`, `.env`/`server.pem`); lệnh `git add -A && git commit -m x && git push origin master` có dòng `Lệnh gồm:` với `git add`, `git commit`, `git push` theo thứ tự; lệnh 8 bước chỉ liệt kê 6 và nêu "2 bước khác"; deny full ngoài root vẫn chứa `fullRoots`. Chạy: đỏ.
- [ ] **Step 2:** viết lại các reason `ask` (dòng 379, 452, 456, 466, 471, 475) theo chín câu đã duyệt (thay "bypass" bằng "chế độ bỏ qua hỏi quyền"; câu full không-bypass giữ gợi ý `aip mode ask`); `pushReason` trả object; `hits` trả token khớp; thêm `summarize` + `askReason`. Sửa `94-permission-modes` dòng 264 chỉ còn kiểm `aip mode ask`. Chạy toàn bộ contract hook: xanh.
- [ ] **Step 3:** commit `feat(hooks): plain-language ask reasons with a command summary line`.

### Task 5: guard-files reason theo khuôn
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 15'
**Phủ AC:** AC1.1, AC1.2, AC1.4
**Files:**
- Modify: `core/hooks/scripts/guard-files.mjs`
- Test: `test/contract/99-hook-popup.contract.mjs`

**Interfaces:**
- Consumes: `confine`, `GUARD_CONFIG_ASK` trong `guard-files.mjs`
- Produces: không có (đổi nội bộ reason)

- [ ] **Step 1:** thêm test: Write vào `.claude/aip-gate.json` (ask), Read file ngoài project ở full+bypass (ask, reason chứa đường dẫn đã cho) qua hàm kiểm khuôn; Write ngoài project ở full (deny, reason vẫn chứa `fullRoots`); không có dòng "Lệnh gồm" trong reason của `guard-files`. Chạy: đỏ.
- [ ] **Step 2:** tách reason `ask` và `deny` trong `confine` (dòng 93–94): `deny` giữ câu cũ; `ask` dùng câu "Agent muốn đọc file ngoài thư mục project (`<đường dẫn>`)…" hoặc câu "không xác định được đường dẫn" cho `where === 'unknown'`; sửa `GUARD_CONFIG_ASK` theo câu đã duyệt. Chạy toàn bộ contract hook: xanh (94:149 vẫn xanh).
- [ ] **Step 3:** commit `feat(hooks): plain-language ask reasons in guard-files`.

### Task 6: rule AGENTS.md một lệnh Bash một việc
**Kind:** DOCS
**TDD:** không — chỉ sửa tài liệu baseline; hai contract hiện có (drift và trần 200 dòng) đã kiểm
**Ước lượng:** 10'
**Phủ AC:** AC1.5
**Files:**
- Modify: `core/agents/AGENTS.template.md`
- Modify: `AGENTS.md`
- Test: `test/contract/30-templates.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** sửa `core/agents/AGENTS.template.md`: thêm dòng "mỗi lệnh Bash một việc; không nối chuỗi dài bằng `&&` vì hộp xác nhận chỉ hỏi được cả chuỗi" vào `### Rules`, gộp một dòng sẵn có (chọn dòng ít giá trị nhất, nêu ở G3) để tổng ≤ 200 dòng; chép byte-identical sang `AGENTS.md`.
- [ ] **Step 2:** đối chiếu khẳng định với code: dòng rule có khớp hành vi `guard-bash` (hỏi cả chuỗi lệnh); ghi bảng `khẳng định → file:line → khớp|lệch`. Chạy `node test/validate.mjs --build`: xanh.
- [ ] **Step 3:** commit `docs(agents): one Bash command per call`.

### Task 7: root tạm của Claude và biến gán trong cùng lệnh ở chế độ full
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC6.1, AC6.2, AC6.3
**Files:**
- Modify: `core/hooks/scripts/gate-config.mjs`
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Test: `test/contract/99-hook-popup.contract.mjs`

**Interfaces:**
- Consumes: `allowedRoots(gate, input)` (gate-config), nhánh `full()` của `decide` trong `guard-bash.mjs`
- Produces: `allowedRoots` kèm `<os.tmpdir()>/claude`; `substituteVars(cmd)` (nội bộ, không export)

- [ ] **Step 1:** thêm test AC6: (a) `allowedRoots` có root tạm; `mkdir -p <tmpdir>/claude/p/s/scratchpad/bin` ở full không ask, `guard-files` Write/Read dưới `<tmpdir>/claude/…` không ask/deny, Write `<tmpdir>/x.txt` vẫn deny; (b) lệnh nhiều dòng của ảnh popup (`S=$(cygpath -u '<scratchpad_dir>'); R=/e/x; mkdir -p $S/bin && cd $S`, heredoc, `chmod +x`, `PATH="$S/bin:$PATH" bash $R/run.sh`) ở full + `scratchpad_dir` → null; (c) ca an toàn AC6.3 (`S=/etc; rm $S/x` deny, dùng trước khi gán, `S=$X`, gán giả trong thân heredoc, giá trị có khoảng trắng) vẫn bị chặn như cũ; lệnh không ở full không đổi. Chạy: đỏ.
- [ ] **Step 2:** thêm root tạm vào `allowedRoots`; viết `substituteVars` (quét từ trái sang phải trước dấu `<<` đầu tiên, nhận `NAME=<literal>` và `NAME=$(cygpath [cờ] '<literal>')` ở đầu lệnh, thay `$NAME`/`${NAME}` về sau, gán lại bằng giá trị không giải được thì xoá) và dùng cho `outer`/`naiveOuter` trong nhánh `full()` (H6 và `secretOutsideRoots`). Chạy toàn bộ contract hook: xanh.
- [ ] **Step 3:** commit `feat(hooks): treat Claude temp folders and same-command variables as inside the project in full mode`.

### Task 8: spec sống, README, bump version, full suite
**Kind:** DOCS
**TDD:** không — tài liệu và version; `npm test` kiểm lock và spec
**Ước lượng:** 25'
**Phủ AC:** AC4.1
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md`
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/contract/60-versions.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** cập nhật spec `hooks-gates`: đổi R3 (`guard-mcp` giữ `mcpDeny`/`mcpAllow` khi `gitUnknown`, `ask` khi file hỏng), R7 (chuỗi `bash -c`/`eval` ở full hỏi theo parse), R18 (cấu hình hook hỏi theo đích ghi); thêm R21 (khuôn reason `ask` + dòng "Lệnh gồm") và R22 (H3 bỏ qua lệnh metadata và mẫu tìm kiếm); thêm dòng lịch sử; cập nhật README.md và README_VI.md mục Hooks (guard-bash, guard-mcp, "Không phát hiện") và `Cập nhật:` của spec.
- [ ] **Step 2:** đối chiếu từng khẳng định mới (danh sách cờ an toàn, lệnh tìm kiếm, ngưỡng 6 bước, hành vi file hỏng) với code; ghi bảng `khẳng định → file:line → khớp|lệch`, sửa dòng lệch.
- [ ] **Step 3:** bump `core/.manifest.json` 1.33.6 → 1.33.7; `npm run build`; `node cli/lib/versions.mjs --lock`; `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-12-hook-popup-standardization/ --base master`; `npm test`. Xanh.
- [ ] **Step 4:** commit `docs(specs): record hook popup standardization; chore(core): bump to 1.33.7`.
