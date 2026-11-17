# full-path-resolver Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** `guard-bash` ở chế độ full giải đường dẫn đích bằng một bộ giải từ dùng chung (nháy từng phần, biến đã gán ở mọi đoạn cấp cao nhất theo luật tin cậy D1, `export`, `$PWD`, `$(cygpath …)` ghép, glob chỉ ngoài nháy), cho cả Bash và PowerShell, thay regex `substituteVars`.
**Architecture:** thêm tokenizer `scanWords` (giữ `{text, quote}` từng phần, tách `&&` khỏi `&`, `$( )` nằm trong từ), hàm `resolveWord`, và vòng duyệt `walkSegments` theo dõi biến (luật D1, D3, D4, D12) cùng thư mục (luật cũ của `trackDirs`, D9); H6 và kiểm bí mật ngoài root dùng kết quả của vòng duyệt; `naiveSegments` tách từ theo D11; `parse()`, `summarize`, H1 không đổi.
**Tech Stack:** Node ESM zero-dependency; test tự viết (`test/contract/*.contract.mjs`, export `default async run({ ok, ctx })`).
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/hooks/scripts/guard-bash.mjs` | `scanWords` (Task 1); `resolveWord` Bash, cờ glob theo đích ở `classifyPlain`/`classifyTarget`, tách từ của `naiveSegments` (Task 2); `walkSegments`, nối vào H6 và `variableLists`/`secretOutsideRoots`, bỏ `substituteVars`/`ASSIGN_*`/`CD_LEAD` (Task 3); trần cỡ (Task 4); dialect PowerShell (Task 5) | Task 1–5 |
| `test/contract/99-path-permissions.contract.mjs` | khối mới "bộ giải đường dẫn": bảng ca AC1.x–AC4.2 dùng seam `bd`/`expectAll` (dòng ~199–202) | Task 1–5 |
| `test/contract/99-hook-popup.contract.mjs` | khối Task 7 (dòng ~243–340): chuyển hai hàng D2 ra khỏi `stay`/`mustStop`, ghi ba hàng `mustStop` đầu thành `deny` (AC1.7) | Task 3 |
| `docs/specs/hooks-gates/spec.md` | R7 (một cụm), R23 (đoạn giải biến viết lại), R24 (glob trong nháy, `$(cygpath …)`), dòng Lịch sử | Task 6 |
| `README.md`, `README_VI.md` | đoạn "Variables assigned in the same command" (`README.md` dòng ~460, `README_VI.md` ~456) | Task 6 |
| `core/.manifest.json`, `plugins/_versions.lock.json` | bump core 1.34.4 → 1.34.5, lock | Task 7 |

Không đổi: `parse()`, `summarize`, `trackDirs` (H1 dùng), `gate-config.mjs`, `guard-files.mjs`, `guard-mcp.mjs`, `gate-stop.mjs`, `session-start.mjs`, `cli/lib/*`; `94-permission-modes`, `90-hooks`, `97-audit-mustfix` giữ nguyên làm bằng chứng tương thích (AC4.1). Task 1–5 cùng sửa `guard-bash.mjs` và cùng file test nên chạy tuần tự.

## Global Constraints
- Zero-dependency, Node built-ins; hook fail-open với lỗi nội bộ (lỗi trong bộ giải không được ném ra khỏi `decide`: rơi về "chưa rõ"); không thêm lời gọi git ở đường nóng.
- Luật tin cậy D1 (nguyên văn): phép gán `k` (`NAME=…` hoặc `export NAME=…`) được tin cho đoạn `j` sau nó khi (i) `k` không ở pipeline (không có `|` ngay trước hoặc sau), không kết thúc bằng `&`, không nằm trong cấu trúc phức (D12); và (ii) `k` là đoạn đầu của danh sách and-or (đứng đầu chuỗi, sau `;` hoặc xuống dòng) và `j` ở danh sách sau, hoặc `j` cùng danh sách với `k` và mọi toán tử từ đầu danh sách tới `j` đều là `&&`.
- D3: tên có phép gán không tin được ở bất kỳ vị trí nào (env-prefix `S=v cmd`, trong if/hàm/subshell, sau `|`, `&`, `||`, `NAME+=`, `NAME[…]=`, `for NAME`, `NAME in`, `printf -v NAME`) thì chưa rõ ở toàn bộ lệnh.
- D4: tắt giải biến cả lệnh khi lệnh dài hơn 20000 ký tự, nhiều hơn 20 tên, gán `IFS`, có một trong `unset read declare typeset local readonly eval source . mapfile readarray getopts`, here-string `<<<`, heredoc không phải `cat`/`tee` với delimiter có nháy đơn giản, nháy không đóng; PowerShell thêm `Set-Variable`, `New-Variable`, `Remove-Variable`, `Clear-Variable`.
- D5: `$(cygpath [cờ] 'lit')` / `$(cygpath [cờ] "lit")` (nội dung không có `$`, backtick, `\` trong dạng nháy kép), cờ thuộc `{-u, -m, -w, -a, -l}`, bare, trong nháy kép hoặc ghép; giải thành `lit` chuẩn hoá bằng `normalizeMsysPath`. `$( )` khác và backtick: chỉ từ đó chưa rõ.
- D6: `*`, `?`, `[` trong nháy là ký tự thường; glob khi ở phần không nháy hoặc khi giá trị biến mở rộng ngoài nháy chứa chúng. Brace giữ như cũ (mở cả trong nháy).
- D7/D8: giá trị biến phải tuyệt đối (tương đối là chưa rõ); khoảng trắng trong phần mở rộng ngoài nháy là chưa rõ; `..` sau ghép được chuẩn hoá rồi kiểm root (ra ngoài là `deny`). `$PWD`/`${PWD}` = thư mục của vòng duyệt khi tin được; `~`, `$HOME`, `$?`, `$$`, `$1`, `$#`, `$OLDPWD`, `${…}` khác `${NAME}`, `$'…'`, `$[…]` là chưa rõ.
- D9: `cd` giữ luật cũ của `trackDirs` (có hiệu lực cho đoạn sau, trừ sau `||`/`|`; `popd`, `cd $X`, `cd -` làm thư mục chưa rõ).
- D13 PowerShell: `'…'` literal (`''` là nháy); `"…"` giải `$NAME`, `${NAME}` đơn, `$PWD`; backtick, `$(`, `$env:` là chưa rõ; tên biến không phân biệt hoa thường; `$NAME\x` không nháy là chưa rõ; `&&`/`||` không tin.
- Không đổi chữ câu `reason` (R21); không thêm câu `ask`/`deny` mới; `shapeOk` của `99-hook-popup` vẫn đúng. Chế độ `ask` (không full) không đổi kết quả nào.
- Test dùng seam `bd`/`expectAll` của `99-path-permissions.contract.mjs` (`T`/`OUT` từ `mkdtemp` dưới `<tmpdir>/aip-…`, không dưới `<tmpdir>/claude`; full + bypass); mỗi `ok()` ghi ID AC; một hàng mỗi hành vi, bảng tham số hoá; dọn bằng `fs.rmSync`. Hàm nội bộ kiểm trực tiếp (`scanWords`, `resolveWord`) được export chỉ để test tầng thấp nhất.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment theo AGENTS.md (chỉ lý do, khi gate đạt).
- Mỗi task: test đỏ đúng lý do trước (commit riêng), sửa, test xanh; commit trên `feature/full-path-resolver` qua `core:git-workflow` (header tiếng Anh, body tiếng Việt, `git commit -F`), không `Co-Authored-By`; không push. Test hẹp: `node test/validate.mjs --only path-permissions`, sau khi sửa hook thêm `node test/validate.mjs --only hook`; `npm test` một lần ở Task 7. Một lệnh Bash mỗi lần gọi.

## Review Focus
- Task 3: hai hàng D2 (`echo hi⏎S=<T>⏎rm …`, `cd /e/x && echo hi; S=<T>; rm $S/x`) là ca duy nhất trong ba bảng Task 7 đổi sang `null`; mọi hàng khác của `stay`/`mustStop`/`heredocMustStop` vẫn không-`null` (AC1.7).
- Task 3: phép gán bị bỏ qua mà lệnh sau vẫn chạy (`false && S=<T>; rm -rf $S/`) không được tin, nên không ra `null` (AC1.5); `S=<T> || true; …` thì được tin theo D1 vì phép gán đứng đầu danh sách luôn chạy (sửa sau review cuối).
- Task 2: `"T/x*"` (nháy) thành literal trong `T` nhưng `$S/*` với `S` chứa `*` hay khoảng trắng ngoài nháy vẫn chưa rõ (AC1.3, AC1.5).
- Task 3: kiểm bí mật ngoài root (`variableLists`) dùng cùng kết quả với H6: `S=<OUT>; cat $S/.env` vẫn hỏi ở full khi `allowEnvFiles` tắt (AC1.6, AC4.1).
- Task 5: PowerShell `$S` gán trong `{ }`/`if` hoặc qua `Set-Variable` không được tin (AC2.1).

### Task 1: tokenizer scanWords giữ nháy từng phần
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25'
**Phủ AC:** AC4.2
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Modify: `test/contract/99-path-permissions.contract.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `scanWords(cmd, dialect)` (export) trả `{ segs, unclosed }`; `segs` là mảng `{ words, sep, pipeIn, pipeOut, background, compound }` với `sep` ∈ `'start' | ';' | '&&' | '||' | '|' | '&'` (xuống dòng là `';'`), `words` là mảng `{ parts: Array<{ text, quote: 'none' | 'single' | 'double' }> }`; `dialect` ∈ `'bash' | 'powershell'`

- [ ] **Step 1:** thêm khối "bộ giải đường dẫn" vào `99-path-permissions.contract.mjs` với bảng AC4.2: với các lệnh mẫu không biến (`a && b & c`, `rm "x"*`, `echo $(cygpath -u 'a b')/x`, `x # c; y`, `S='a'"b"c`, `(cd x); y`, `if a; then b; fi`), assert số đoạn, `sep`, `background`, `compound`, và phần `{text, quote}` của từ cần xét; và so danh sách token đã bỏ nháy của `scanWords` với `parse()` trên các lệnh không có `$( )`/`&` (cùng token ở mọi ca). Chạy `node test/validate.mjs --only path-permissions`: đỏ (`scanWords` chưa export). Commit test đỏ: `test(hooks): cover scanWords tokenizer`.
- [ ] **Step 2:** viết `scanWords` một lượt quét ký tự (không regex lồng): bash — nháy đơn/kép (`\` trong kép trước `"`/`\`/`$`/backtick), `\` ngoài nháy, `$( … )` và backtick cân bằng ngoặc là một phần của từ hiện tại, `#` đầu từ không nháy là chú thích tới hết dòng, `&&`/`||`/`|`/`;`/`&`/xuống dòng, `(`/`)` và từ khoá `{ if then else elif fi for while until case do done function` hoặc `name()` đánh dấu `compound` cho các đoạn bên trong; powershell — `'…'` với `''`, `"…"` với backtick escape. Chạy `--only path-permissions`: xanh.
- [ ] **Step 3:** chạy `node test/validate.mjs --only hook`: xanh, không sửa test cũ.
- [ ] **Step 4:** commit `feat(hooks): add quote-aware scanWords tokenizer to guard-bash`.

### Task 2: resolveWord Bash, glob theo đích, naiveSegments
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC1.3, AC4.1
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Modify: `test/contract/99-path-permissions.contract.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `scanWords(cmd, dialect)`
- Produces: `resolveWord(word, state, dialect)` (export) trả `{ text, glob }` hoặc `null` (chưa rõ), `state = { env: Map<string, string | null>, dir: string, unres: boolean, msys: boolean }`; token đã giải mang mảng song song `t.globs` (boolean theo từng token) mà `classifyPlain(raw, dir, unres, roots, msys, need, glob)` đọc thay cho `GLOB.test` khi có

- [ ] **Step 1:** thêm bảng AC1.3 (`rm "<T>/x*"` → `null`, `rm "<T>/x"*` → `null`, `rm "<OUT>/x"*` → `deny`, `rm -rf "<T>/backup/"*` → `null`) và bảng `resolveWord` trực tiếp: nháy đơn/kép, `$NAME`/`${NAME}` có trong `env`, tên `null` trong `env` hoặc không có → `null`, `$PWD` khi `unres` false/true, `$(cygpath -u '<T>')/e2e` bare và trong nháy kép, cờ ngoài tập D5 → `null`, `~`/`$HOME`/`$?`/`${X:-y}` → `null`, giá trị có khoảng trắng mở rộng ngoài nháy → `null`, `glob` đúng theo D6. Chạy `--only path-permissions`: đỏ ở các ca dùng nháy + glob và mọi ca `resolveWord`. Commit test đỏ: `test(hooks): cover resolveWord and quoted globs`.
- [ ] **Step 2:** viết `resolveWord` theo D5–D8 trên `parts` của `scanWords`; `naiveSegments` tách từ theo D11 (chuỗi liên tiếp phần nháy/không nháy là một từ, text dựng từ phần) và mang `t.globs`; `classifyPlain`/`classifyTarget` nhận cờ glob theo đích (thiếu cờ thì giữ `GLOB.test` như cũ). H6 lấy cờ glob cho từ không có biến. Chạy `--only path-permissions`: xanh.
- [ ] **Step 3:** chạy `node test/validate.mjs --only hook`: xanh (mọi ca không biến giữ kết quả, AC4.1).
- [ ] **Step 4:** commit `feat(hooks): resolve quoted words and per-target globs in guard-bash`.

### Task 3: walkSegments với luật tin cậy, thay substituteVars
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC1.1, AC1.2, AC1.4, AC1.5, AC1.6, AC1.7, AC1.8
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Modify: `test/contract/99-path-permissions.contract.mjs`
- Modify: `test/contract/99-hook-popup.contract.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`
- Test: `test/contract/99-hook-popup.contract.mjs`

**Interfaces:**
- Consumes: `scanWords(cmd, dialect)`, `resolveWord(word, state, dialect)`, `t.globs`
- Produces: `walkSegments(scan, { cwd, msys, dialect })` trả mảng `{ t, dir, unres }` (cùng hình với phần tử của `trackDirs`, `t` là token đã giải kèm `t.globs`, `t.qpos`), dùng cho H6 (`confineSegment`) và `secretOutsideRoots`

- [ ] **Step 1:** thêm bảng AC1.1 (lệnh rút gọn của design, scratchpad dưới root, cwd là `T`), AC1.2, AC1.4, AC1.5, AC1.6, AC1.8 vào `99-path-permissions.contract.mjs`; trong `99-hook-popup.contract.mjs` chuyển hai hàng D2 ra khỏi `stay`/`mustStop` (chúng nằm ở AC1.2) và ghi ba hàng `mustStop` đầu (`S='T'/../../..`, `S="T"/../../..`, `S=$(cygpath -u 'T')/../../..`) thành `deny` kèm nhãn AC1.7. Chạy `--only path-permissions` và `--only hook`: đỏ ở AC1.1, AC1.2, AC1.4, AC1.6 và ba hàng `deny`. Commit test đỏ: `test(hooks): cover trusted assignments in guard-bash full mode`.
- [ ] **Step 2:** viết `walkSegments`: duyệt `scan.segs` theo thứ tự, theo dõi `dir`/`unres` đúng luật `trackDirs` (D9) và `env` theo D1, D3 (quét trước toàn lệnh để đánh dấu tên không tin được), D4, D12; `export A=v B=v` gán như phép gán; trả token đã giải bằng `resolveWord` (từ chưa rõ giữ text thô có `$` để `hasUnresolvedRef` bắt). Nối vào `decide`: H6 dùng `walkSegments` trên `scanWords(cmd)` và trên từ của `naiveSegments`; `variableLists`/`secretOutsideRoots` dùng cùng kết quả, tính một lần mỗi `decide` (D14). Xoá `substituteVars`, `ASSIGN_LEAD`, `ASSIGN_VALUE`, `ASSIGN_TAIL`, `CD_LEAD`, `absoluteLiteral`; giữ `stripSimpleHeredocs` (còn `summarize` dùng) và `VAR_MUTATORS` nếu dùng lại cho D4. Grep `substituteVars|ASSIGN_|CD_LEAD|absoluteLiteral` toàn repo: không còn tham chiếu. Chạy `--only path-permissions` và `--only hook`: xanh.
- [ ] **Step 3:** commit `feat(hooks): track assignments with one trust rule in guard-bash`.

### Task 4: trần cỡ và thời gian của bộ giải
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 15'
**Phủ AC:** AC3.1, AC3.2
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Modify: `test/contract/99-path-permissions.contract.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `walkSegments(scan, { cwd, msys, dialect })`
- Produces: không có

- [ ] **Step 1:** thêm AC3.1 (lệnh dưới 20000 ký tự, 20 tên gán hợp lệ, nhiều đường dẫn dùng biến: kết quả đúng luật và `decide` < 1000 ms, đo bằng `performance.now()`) và AC3.2 (lệnh > 20000 ký tự có `S=<T>; rm -rf $S/x` → `ask`; 21 tên gán → `ask`). Chạy `--only path-permissions`: ca nào đã xanh nhờ Task 3 thì ghi lại; ca đỏ là việc của step 2. Commit test (đỏ nếu có): `test(hooks): cover resolver size limits`.
- [ ] **Step 2:** bảo đảm trần 20000 ký tự và 20 tên tắt giải biến cả lệnh (D4) và không có vòng lặp bậc hai theo số tên × số từ. Chạy `--only path-permissions`: xanh.
- [ ] **Step 3:** commit `fix(hooks): cap resolver work per command in guard-bash` (bỏ qua nếu step 2 không cần sửa code; ghi lý do vào ledger).

### Task 5: dialect PowerShell của bộ giải
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC2.1, AC2.2
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Modify: `test/contract/99-path-permissions.contract.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `scanWords(cmd, dialect)`, `resolveWord(word, state, dialect)`, `walkSegments(scan, { cwd, msys, dialect })`
- Produces: không có

- [ ] **Step 1:** thêm bảng AC2.1 (`tool: 'PowerShell'`, full + bypass: `$S = '<T>'; Remove-Item "$S\x"`, `$s = '<T>'; Remove-Item "$S\x"`, `$S = "<T>"; Remove-Item "$S\x"` → `null`; `$S = '<OUT>'; Remove-Item "$S\x"` → `deny`; `$S = '<T>/../../..'; Remove-Item "$S\x"` → `deny`; `$S = $env:TEMP; Remove-Item "$S\x"` → `ask`; `if ($true) { $S = '<T>' }; Remove-Item "$S\x"` → `ask`; `$S = "<T>"; Set-Variable S '<OUT>'; Remove-Item "$S\x"` → không `null`) và AC2.2 (cùng ca ở `mode: "ask"` và full không bypass: kết quả như trước, ghi bằng giá trị đo trên master trước khi sửa). Chạy `--only path-permissions`: đỏ ở các ca `null`/`deny` của AC2.1. Commit test đỏ: `test(hooks): cover PowerShell variables in guard-bash full mode`.
- [ ] **Step 2:** H6 với `tool_name: 'PowerShell'` dùng `scanWords(cmd, 'powershell')` và `walkSegments` dialect `powershell`: phép gán `$NAME = <từ>` (có hoặc không khoảng trắng quanh `=`), tên khoá viết thường, luật D13; `{`/`}` đánh dấu `compound`; mutator PowerShell theo D4. Chạy `--only path-permissions` và `--only hook`: xanh.
- [ ] **Step 3:** commit `feat(hooks): resolve PowerShell variables in guard-bash full mode`.

### Task 8: danh sách lệnh PowerShell được giải biến (chạy trước Task 6)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC2.1
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Modify: `test/contract/99-path-permissions.contract.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `psUnsafe(scan)`, `prepareWalk(cmd, ps)`, `walkSegments(scan, { cwd, msys, dialect, noVars })`
- Produces: không có

Thêm sau review cuối của Task 5 (người dùng chọn ở breaker): Task 5 dùng danh sách chặn cho các cách đổi biến PowerShell nên còn lọt `Set-ItemProperty $n …`, `Clear-ItemProperty $n`, `Rename-ItemProperty $n …`, `Invoke-Item $n`, `$n | Set-Item -Value '<OUT>'`, `$n='vari'+'able:'; Set-Location $n; Set-Item S '<OUT>'` (cả `Push-Location`/`cd`/`sl`), `New-PSDrive … -PSProvider Variable …; Set-Item Z:S '<OUT>'`, rồi `Remove-Item "$S\x"` → null. Đổi sang danh sách cho phép ở mức tên lệnh: PowerShell chỉ giải biến khi MỌI tên lệnh của câu (vị trí lệnh của từng đoạn, kể cả trong `$( )`) thuộc tập `PS_VAR_SAFE_CMDS` = `Remove-Item`, `ri`, `rm`, `del`, `New-Item`, `ni`, `mkdir`, `md`, `Copy-Item`, `cpi`, `cp`, `copy`, `Move-Item`, `mi`, `mv`, `move`, `Set-Content`, `Add-Content`, `Out-File`, `Get-Content`, `gc`, `cat`, `Write-Host`, `Write-Output`, `echo`, `Get-ChildItem`, `gci`, `ls`, `dir`, `Test-Path`, `Get-Item`, `gi`, `Resolve-Path`, `Join-Path` (không phân biệt hoa thường) hoặc là phép gán đơn đã nhận; có tên lệnh khác (gồm `Set-Location`/`cd`/`sl`, `*-ItemProperty`, `Invoke-Item`, `New-PSDrive`, cmdlet lạ, `&`/`.` gọi lệnh) thì tắt giải biến cả lệnh (D4). Các điều kiện tắt của Task 5 giữ nguyên. Trên đoạn có pipe, mọi lệnh trong pipe cũng phải thuộc tập.

- [ ] **Step 1:** thêm bảng AC2.1 (PowerShell, full + bypass): bảy ca lọt ở trên → ask; giữ null cho các ca null đã có của AC2.1 (`$S = '<T>'; Remove-Item "$S\x"`, `$s`, `"<T>"`, `$S='<T>'`, backtick, `$M = $PWD`, `Set-Content "$S\f"`, `Copy-Item x "$S\y"`, `New-Item -ItemType Directory "$S\d"`); thêm `$S = '<T>'; Get-Date; Remove-Item "$S\x"` → ask (lệnh ngoài tập). Chạy `node test/validate.mjs --only path-permissions`: đỏ ở các ca lọt. Commit test đỏ: `test(hooks): cover PowerShell command allowlist for variable resolution`.
- [ ] **Step 2:** thêm `PS_VAR_SAFE_CMDS` và kiểm tên lệnh trong `psUnsafe` (hoặc `prepareWalk`) cho dialect PowerShell; Bash không đổi. Chạy `--only path-permissions` và `--only hook`: xanh.
- [ ] **Step 3:** commit `fix(hooks): resolve PowerShell variables only under known commands`.

### Task 6: spec R7, R23, R24 và README
**Kind:** DOCS
**Ước lượng:** 20'
**Phủ AC:** AC5.1
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md`
- Modify: `README.md`
- Modify: `README_VI.md`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: hành vi của `walkSegments`, `resolveWord`, `scanWords` sau Task 1–5
- Produces: không có

- [ ] **Step 1:** sửa R7 (cụm "biến gán và `$PWD` trong cùng lệnh được giải (R23)"), viết lại đoạn giải biến của R23 theo D1–D14 (gồm PowerShell, `export`, `$PWD`, cygpath ghép, luật tin cậy, các điều kiện tắt, `..` sau ghép bị `deny`), thêm vào R24 câu về glob trong nháy (D6) và `$(cygpath …)` (D5); thêm ba dòng Lịch sử `2026-11-16 | 2026-11-16-full-path-resolver | hooks-gates/R7, R23, R24 | đổi`; sửa đoạn "Variables assigned in the same command" của `README.md` và đoạn tương ứng của `README_VI.md`.
- [ ] **Step 2:** đối chiếu khẳng định với code: liệt kê từng khẳng định kiểm được (trần 20000/20, tập cờ cygpath, danh sách mutator, luật D1, hành vi PowerShell), grep hoặc đọc `guard-bash.mjs`, ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo task; dòng `lệch` sửa docs hoặc gắn `[Unverified]`.
- [ ] **Step 3:** chạy `node test/validate.mjs --only content` và `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-16-full-path-resolver/ --base master`: xanh, không cảnh báo chưa xử lý.
- [ ] **Step 4:** commit `docs(hooks): describe shared path resolver in spec and readme`.

### Task 7: bump core, build, lock, npm test
**Kind:** TOOLING
**TDD:** không — chỉ bump version và chạy lại suite, không có hành vi mới để viết test đỏ
**Ước lượng:** 10'
**Phủ AC:** AC5.2
**Files:**
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** `core/.manifest.json` version 1.34.4 → 1.34.5; chạy `npm run build`, rồi `node cli/lib/versions.mjs --lock`: lock cập nhật, không từ chối.
- [ ] **Step 2:** chạy `npm test`: xanh, trừ `test/statusline.test.mjs` AC1.1 (baseline đỏ vì ledger `.aip/runs/2026-11-16-hook-copy-alias-brace` trên máy; ghi số liệu pass/fail).
- [ ] **Step 3:** commit `chore(core): bump core to 1.34.5 for shared path resolver`.
