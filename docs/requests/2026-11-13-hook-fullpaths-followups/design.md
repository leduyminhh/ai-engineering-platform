# Thiết kế: bốn follow-up bảo mật của hook sau fullPaths
- Ngày: 2026-11-13
- Trạng thái: merged 261f3f86
- Requirement: không có

## Vấn đề và lý do

Request `2026-11-12-scoped-path-permissions` (core 1.33.12) để lại bốn lỗ ở PreToolUse hook (`core/hooks/scripts/`), người dùng chọn làm tiếp ở G3. Mỗi lỗ đã được đo lại trên nhánh này bằng script thử (không sửa code), kết quả ghi bên dưới. Ký hiệu: `T` có đủ ba quyền, `O` có `read`+`write`, `D` có `read`, `OUT` ngoài mọi mục.

1. **R18: `cp`/`mv` vào thư mục `.claude` không bị hỏi.** `writesGuardConfig` (`guard-bash.mjs` ~537) so `GUARD_CONFIG` với từng đích, nhưng đích là thư mục (`.claude/`) còn tên file cấu hình nằm ở nguồn nên không khớp. Đo ở `mode: ask`, phiên thường: `cp settings.json .claude/`, `cp -t .claude settings.json`, `cp -t .claude /s/settings.local.json`, `mv -t .claude settings.json`, `mv settings.json .claude`, `cp aip-gate.json .claude`, `cp --target-directory=.claude settings.json` đều ra `null` (mong đợi `ask`); PowerShell `Copy-Item settings.json .claude\`, `Copy-Item -Path settings.json -Destination .claude`, `Move-Item settings.json .claude` cũng `null`. Lỗi có từ trước `fullPaths`.
2. **`guard-files` không chặn gốc `<os.tmpdir()>/claude`.** `guard-bash` có `isClaudeTmpRoot` → `'blocked'` (deny cho cả ba quyền); `guard-files` chỉ coi `<tmpdir>/claude` là root nên Write, Read, Grep vào chính thư mục đó (và vào mọi phiên khác dưới nó) ra `null`. Spec R23/R24 hiện ghi "guard-files không có ngoại lệ này", tức lệch giữa hai hook.
3. **Vai của đối số vị trí ở lệnh copy/move chưa đúng.** Đo ở full: PowerShell `Copy-Item OUT/a O/b`, `cp OUT/a O/b`, `copy OUT/a O/b` ra `null` (nguồn vị trí không bị kiểm `read`, trong khi `Copy-Item -Path OUT/a O/b` ra `ask`); Bash `cp OUT/a O/b`, `cp OUT/a OUT/b2 O/`, `cp -t O OUT/a` cũng `null`; `Move-Item -Path T/a O/b` ra `deny` dù `T` có `delete` và `O` có `write`, vì đích vị trí `O/b` bị đòi cả `delete` lẫn `write`.
4. **Glob có đoạn khớp được `..`.** Đo ở full: `rm T/.?/d/f`, `rm T/..*/d/f`, `rm T/.[.]/d/f`, `rm T/.*/d/f`, `rm T/.*` đều `null`. [Unverified] Trên bash < 5.2 và dash các đoạn này có thể mở rộng thành `..` (thư mục cha) nên đường dẫn thật thoát khỏi thư mục đã phân loại; mô tả này lấy từ follow-up của request trước, chưa chạy trên bash < 5.2 hay dash. `nhánh GLOB` của `classifyTarget` (~293) đã trả `unknown` khi `..` đứng sau đoạn glob, chưa xét đoạn glob tự khớp `..`.

## Quyết định đã chốt

- **K1 — mục 3 làm cho cả Bash và PowerShell.** Người dùng chốt ở bước làm rõ: nguồn vị trí của `cp`/`copy`/`Copy-Item` cần `read` ở cả hai tool; thiếu `read` chỉ `ask`, không `deny`. Hệ quả nêu rõ: ở full, `cp /ngoài/x .` bắt đầu bị hỏi (trước đây qua).
- **K2 — đủ bốn mục, một request, một nhánh `feature/hook-fullpaths-followups`.** Bốn mục cùng nằm trong `guard-bash.mjs`/`guard-files.mjs`/`gate-config.mjs` nên làm tuần tự.

### Quyết định của agent

Người dùng không trả lời thêm; mọi dòng dưới là **quyết định của agent**, nêu nổi bật để người duyệt sửa.

- **D1 — R18: ghép thư mục đích với basename từng nguồn.** Trong `writesGuardConfig`, với `cp`/`copy`/`copy-item`/`mv`/`move`/`move-item`: nếu một `target` kết thúc ở đoạn `.claude` (`/(^|[\\/])\.claude[\\/]*$/`: `.claude`, `.claude/`, `x/.claude\`, giá trị của `-t`/`--target-directory`/`-Destination`) và một đối số bất kỳ có basename khớp `^(settings(\.[\w-]+)?|aip-gate)\.json$` (không phân biệt hoa thường) thì hỏi. Là so khớp theo token, không biết thư mục đích có thật không; ghép theo mọi nguồn (không theo từng cặp) vì với nhiều nguồn một đích thì mọi nguồn đều vào đó. Đối số cờ như `-t` nhận giá trị `.claude` không khớp tên file nên không gây hỏi nhầm.
- **D2 — R18 chỉ tính đích ghi.** Vì D4 đưa nguồn của `cp` vào `targets` với vai `read`, `writesGuardConfig` bỏ qua đích chỉ có vai `read` khi so `GUARD_CONFIG` (khớp câu "Chỉ đích ghi mới tính" đang có ở code và R18 "không ask khi chỉ đọc"). Hệ quả: `Copy-Item -Path .claude/settings.json -Destination x` (nguồn chỉ đọc, hiện đang bị hỏi) thôi bị hỏi; ca `cp -t .claude <nguồn>` mà nguồn trước đây được đưa vào kiểm cấu hình nay do D1 bắt qua basename.
- **D3 — `guard-files` chặn gốc `<tmpdir>/claude` giống `guard-bash`.** Chuyển `isClaudeTmpRoot` và câu deny "Thư mục tạm gốc của Claude luôn bị chặn…" vào `gate-config.mjs` (đã chứa `claudeTmpRoots`) để hai hook dùng một nguồn; `confine()` của `guard-files` trả `deny` với câu đó cho **mọi** công cụ (Read, Grep, Write, Edit, MultiEdit, NotebookEdit) khi `file` resolve đúng gốc, kiểm sau `fullEffective` và trước khi tra grant. Deny cả Read/Grep (không phải ask) cho khớp `guard-bash` (`blocked` thắng mọi quyền) và vì Grep vào gốc lộ nội dung của mọi phiên khác. File dưới gốc (`<tmpdir>/claude/p/x`) vẫn là root đủ ba quyền, không đổi. Câu deny không nhắc `fullRoots`/`fullPaths` (R21). Ngoài full hiệu lực không đổi. Không resolve symlink và tên 8.3 (như `guard-bash`).
- **D4 — gán vai cho đối số vị trí.** Trong `writeTargets` (nhánh `WRITE_CMDS`):
  - `cp`/`copy`/`copy-item` Bash và PowerShell không có `-t`: mọi đối số vị trí trừ cuối → `['read']`, đối số cuối → `['write']` như cũ.
  - `cp -t DIR`/`--target-directory[=]DIR` (chỉ Bash, như D6 cũ): `DIR` `['write']`, mọi đối số vị trí → `['read']` (trước đây `[]`).
  - Cờ gộp/dính có `t` (`-rt`, `-tDIR`): giữ cách thận trọng hiện có (đích phỏng đoán + đối số cuối vẫn là đích ghi); phần nguồn (mọi đối số trừ cuối) → `['read']`.
  - PowerShell `Copy-Item`/`Move-Item` (và alias `cp`/`copy`/`mv`/`move`) theo thứ tự tham số: slot 0 = `Path` (nguồn: `read` với copy, `delete` với move), slot 1 = `Destination` (`write`); tham số đã gọi tên (`-Path`/`-LiteralPath`/`-Destination`, kể cả dạng `-X:giá-trị`) làm slot đó bị chiếm, đối số vị trí lấp các slot còn trống theo thứ tự; đối số vị trí thừa so với slot trống (PowerShell báo lỗi) lấy vai thận trọng (copy: `read` + `write`; move: `delete` + `write`). Hệ quả: `Move-Item -Path T/a O/b` → nguồn `delete`, đích vị trí chỉ `write`; `Copy-Item -Destination O/b OUT/a` → `OUT/a` là nguồn `read`.
  - `Move-Item` có cờ lạ (viết tắt `-Dest`) giữ cách cũ (`blurred`: mọi đối số vị trí cần `delete` + `write`); `mv` Bash không đổi.
  - Sau review: tham số có giá trị `-Filter`/`-Include`/`-Exclude`/`-Credential`/`-ToSession`/`-FromSession` của `Copy-Item`/`Move-Item` được bỏ giá trị đi (không tính là đối số vị trí); ở PowerShell mỗi đích có dấu phẩy (`a,b`) được tách thành từng đích riêng với cùng quyền (Bash không tách); cờ gộp `cp -rt DIR src` giữ `deny` như cũ.
  - Thiếu `read` giữ đúng đường cũ: `confineSegment` đã biến `outside` + `read` thành `ask-read` (câu `READ_OUTSIDE_TEXT`), `deny` ở đích khác vẫn thắng. Đường dẫn không xác định (`$X`, `~`) ở nguồn → `ask` như mọi đích khác, nên `cp "$f" dest` ở full bắt đầu bị hỏi (xem Rủi ro).
- **D5 — glob khớp `..` thì `unknown`.** Trong nhánh `GLOB` của `classifyTarget`, mọi đoạn từ đoạn glob đầu trở đi mà khi dịch glob → regex (`*` → `.*`, `?` → `.`, `[...]` → lớp ký tự với `!`/`^` phủ định, ký tự khác khớp nguyên văn) khớp được chuỗi `..` thì trả `unknown` (→ `ask`, trước khi tra quyền, như ca `..` đứng sau đoạn glob). Gồm `.?`, `..*`, `.[.]`, `.*`. Không khớp `..`: `.[!.]*`, `.git*`, `a?`, `*`, `.?x`. Đoạn có `[` không đóng được, lớp POSIX (`[:punct:]`, `[=.=]`) hoặc regex hỏng → coi là khớp (hỏi thừa còn hơn bỏ sót). Chỉ đoạn bắt đầu bằng `.` viết tường minh mới có thể khớp `..` (không dotglob: `*`, `?`, `[…]` đứng đầu không khớp tên bắt đầu bằng dấu chấm); dãy `*` được gộp và đoạn dài trên 1024 ký tự coi là khớp, để regex không backtrack bậc hai. Biến hoặc `~` ở một đoạn từ đoạn glob trở đi (`rm T/$X?/d/f` với `X=.`) cũng trả `unknown`. Nếu thư mục trước đoạn glob đã thiếu quyền thì vẫn `deny` như trước (không hạ xuống ask); nhánh glob còn kiểm gốc `<tmpdir>/claude` trước khi hỏi. Là heuristic theo token; không phụ thuộc phiên bản shell (hỏi cả trên bash ≥ 5.2 nơi `.*` không khớp `..`, vì không biết shell thật).
- **D6 — không thêm câu hỏi mới, không đổi chữ ký.** `classifyPath`/`grantsOf`/`allowedRoots` giữ nguyên; mọi `ask` dùng câu có sẵn (`CONFIG_TEXT`, `FULL_PATH_TEXT`, `READ_OUTSIDE_TEXT`), không chứa từ trong `BANNED` của `99-hook-popup.contract.mjs`.
- **D7 — version.** `core/.manifest.json` 1.33.12 → 1.33.14 (sửa hành vi hook, không thêm khoá), rồi `npm run build` và `node cli/lib/versions.mjs --lock`.

## Hướng đã cân nhắc

**Chọn — sửa tại chỗ trong `writeTargets`/`writesGuardConfig`/`classifyTarget`.** Giữ cấu trúc `targets` + `needs` đã có từ request trước, thêm vai `read` cho nguồn và một nhánh kiểm basename; diff nhỏ, test thêm vào bảng ca sẵn có.

**Loại 1 — viết lại phân tích đối số `cp`/`mv` thành bộ parser GNU/PowerShell đầy đủ.** Chính xác hơn với cờ gộp và viết tắt, nhưng lớn, dễ sinh lỗ mới (review cuối request trước vừa bắt nhiều lỗ parser) và vượt phạm vi bốn mục. Các giới hạn đã biết ở R24 giữ nguyên.

**Loại 2 — R18 chỉ bắt khi đích là chuỗi `.claude/`.** Bỏ sót `.claude` không dấu `/`, `-t .claude`, `-Destination .claude`.

**Loại 3 — mục 2 trả `ask` (không `deny`) cho Read/Grep gốc tmp.** Lệch `guard-bash` (cùng đối tượng, hai kết quả) và vẫn để người dùng bấm cho đọc mọi phiên khác; bị loại.

## Tiêu chí chấp nhận

Test thêm vào `test/contract/99-path-permissions.contract.mjs` (cùng seam `config`, `repoRoot`, `tracked`, `permission_mode` và cách dựng `D`/`O`/`T`/`OUT`/`P` bằng `mkdtemp` dưới `<tmpdir>/aip-…`); các ca R18 chạy trong cả `mode: ask` phiên thường lẫn full+bypass vì R18 áp ở mọi chế độ. Bash dùng `tool_name: 'Bash'`, PowerShell dùng `'PowerShell'`.

- [ ] **AC1.1** — Given `mode: ask`, phiên thường When `guard-bash` nhận `cp settings.json .claude/`, `cp -t .claude settings.json`, `cp -t .claude /s/settings.local.json`, `mv -t .claude settings.json`, `mv settings.json .claude`, `cp aip-gate.json .claude`, `cp --target-directory=.claude settings.json`, `cp a settings.json .claude/` Then `ask`; cùng các lệnh ở full+bypass Then vẫn `ask`.
- [ ] **AC1.2** — Given PowerShell, `mode: ask` When `Copy-Item settings.json .claude\`, `Copy-Item -Path settings.json -Destination .claude`, `Copy-Item -Path settings.json -Destination .claude\`, `Move-Item settings.json .claude` Then `ask`.
- [ ] **AC1.3** — Given `mode: ask` When `cp x.json .claude/`, `cp settings.json out/`, `cp .claude/settings.json /tmp/x`, `Copy-Item -Path .claude/settings.json -Destination out\x` (PowerShell) Then `null` (đích không phải `.claude`, hoặc `.claude/settings.json` chỉ là nguồn đọc); giữ nguyên các ca R18 đã có trong `99-hook-popup` và `99-path-permissions` (vd `cp -t .claude aip-gate.json` vẫn `ask`).
- [ ] **AC2.1** — Given full hiệu lực When `guard-files` nhận Read, Grep, Write, Edit, MultiEdit, NotebookEdit vào đúng `<tmpdir>/claude` (có và không có `/` cuối) Then `deny`, `reason` có "luôn bị chặn" và không chứa `fullRoots`/`fullPaths`; vào `<tmpdir>/claude/p/x` Then `null`; vào `<tmpdir>/khac/x` Then như cũ (`deny` với Write, `ask` với Read); Given `fullPaths` cấp `["read","write","delete"]` cho `<tmpdir>/claude` Then vẫn `deny`.
- [ ] **AC2.2** — Given `mode: ask`, hoặc phiên không bypass, hoặc `aip-gate.json` bị git theo dõi When `guard-files` nhận Write vào `<tmpdir>/claude` Then kết quả như trước request (không `deny` do mục này).
- [ ] **AC3.1** — Given full, Bash, `fullPaths` như `T`/`O`/`D` When `cp OUT/a O/b`, `cp OUT/a OUT/b2 O/`, `cp -t O OUT/a`, `cp OUT/* O/` Then `ask` (nguồn thiếu `read`); `cp T/a O/b`, `cp D/a O/b`, `cp -t O D/a` Then `null`; `cp OUT/a D/b` Then `deny` (đích thiếu `write` thắng `ask`); `cp -rt O OUT/a` Then `deny` (cờ gộp giữ cách thận trọng: đối số cuối vẫn bị coi là đích ghi, như trước); `cp $X/a O/b` Then `ask`; `cp x O/b` (nguồn trong project) Then `null`.
- [ ] **AC3.2** — Given full, PowerShell When `Copy-Item OUT/a O/b`, `cp OUT/a O/b`, `copy OUT/a O/b`, `Copy-Item -Destination O/b OUT/a`, `Copy-Item -Path OUT/a O/b` Then `ask`; `Copy-Item D/a O/b`, `Copy-Item -Destination O/b D/a`, `Copy-Item -Path D/a O/b` Then `null`; `Copy-Item D/a D/b` Then `deny`.
- [ ] **AC3.3** — Given full, PowerShell When `Move-Item -Path T/a O/b`, `Move-Item -LiteralPath T/a O/b`, `Move-Item -Destination O/b T/a`, `Move-Item T/a O/b` Then `null`; `Move-Item -Path O/a O/b` Then `deny` (nguồn thiếu `delete`); `Move-Item -Path T/a D/b` Then `deny` (đích thiếu `write`); `Move-Item -Destination O/b O/a` Then `deny`; `Move-Item -Dest T/b O/a` Then `deny` (cờ lạ giữ đường thận trọng).
- [ ] **AC4.1** — Given full, `rm` When `rm T/.?/d/f`, `rm T/..*/d/f`, `rm T/.[.]/d/f`, `rm T/.*/d/f`, `rm T/.*`, `cp x T/.?/f` Then `ask`; `rm T/.[!.]*/f`, `rm T/.git*/f`, `rm T/*/d/f`, `rm T/a?/f`, `rm T/.?x/f` Then `null`; `rm O/*` vẫn `deny`; ca `rm T/*/../../d/f` vẫn `ask`.
- [ ] **AC5.1** — Given suite hiện có When chạy `94-permission-modes`, `99-hook-popup`, `99-path-permissions`, `90-hooks`, `97-audit-mustfix` Then xanh; mọi `reason` `ask` mới vẫn qua `shapeOk` của `99-hook-popup.contract.mjs`.
- [ ] **AC6.1** — Given tài liệu When đọc Then `docs/specs/hooks-gates/spec.md` có R18 (bao cả `cp`/`mv` vào `.claude`, chỉ đích ghi mới tính), R23 và R24 (guard-files chặn gốc tmp; nguồn cp/Copy-Item cần `read`, bỏ câu "không được kiểm quyền"; quy tắc vai theo thứ tự tham số của Move-Item/Copy-Item; glob khớp `..`) đã sửa kèm dòng Lịch sử; `README.md` và `README_VI.md` (mục Hooks, đoạn `fullPaths`) khớp spec và bỏ giới hạn cũ đã được sửa; các pin `test/content` liên quan xanh.
- [ ] **AC6.2** — Given các sửa trên When `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` Then xanh; `core/.manifest.json` tăng từ 1.33.12.

## Thiết kế

### Chỗ cần sửa

- **`core/hooks/scripts/gate-config.mjs`**: thêm `isClaudeTmpRoot(p, dir)` (chuyển từ `guard-bash.mjs`, cùng thân hàm) và hằng câu deny dùng chung (D3).
- **`core/hooks/scripts/guard-files.mjs`** `confine()`: sau `fullEffective`, nếu `isClaudeTmpRoot(file, cwd)` thì trả deny dùng chung (D3).
- **`core/hooks/scripts/guard-bash.mjs`**:
  - import `isClaudeTmpRoot` và hằng câu từ `gate-config.mjs`, bỏ bản local;
  - `writeTargets`: vai `read` cho nguồn của `cp`/`copy`/`copy-item` và `Copy-Item` có `-t` kiểu GNU, gán slot `Path`/`Destination` cho PowerShell (D4);
  - `writesGuardConfig`: kiểm basename nguồn + đích `.claude` (D1), bỏ đích chỉ có vai `read` (D2);
  - `classifyTarget`: hàm nhỏ `globMatchesDotDot(đoạn)` và nhánh trả `unknown` (D5).
- **Test**: `test/contract/99-path-permissions.contract.mjs` thêm ca (bảng tham số hoá, AGENTS.md Testing); không sửa test cũ trừ khi một ca cũ ghim hành vi bị đổi có chủ đích (sẽ ghi rõ ở plan).
- **Tài liệu**: `docs/specs/hooks-gates/spec.md`, `README.md`, `README_VI.md`; `core/.manifest.json` + `plugins/_versions.lock.json`.
- **Không đổi**: `classifyPath`/`grantsOf`/`fullPaths`, `gate-file.mjs`, `guard-mcp`, `gate-stop`, `session-start`, `cli/lib/mode.mjs`.

## Ảnh hưởng spec
- hooks-gates: đổi R18, đổi R23, đổi R24

## Ngoài phạm vi và anti-goal

- Không thêm parser GNU/PowerShell đầy đủ: `--target`/`--target-dir` viết tắt, `-Dest` của `Copy-Item`, alias `ri`/`mi`/`cpi`, lệnh con trong nháy kép vẫn là giới hạn đã biết của R24.
- Bash đọc file bằng `cat`, `head`… vẫn không bị nhốt `read`; chỉ nguồn của `cp`/`copy`/`Copy-Item` được kiểm (K1).
- Không đổi `mv` Bash, `rm`, chuyển hướng, H1–H3, `mcpAllow`/`mcpDeny`, chế độ `ask`; không resolve symlink.
- Anti-goal: không biến thiếu `read` ở nguồn thành `deny`; không để sửa R18 làm `ask` thêm với lệnh chỉ đọc file cấu hình.

## Ràng buộc

- Zero-dependency; hook fail-open với lỗi nội bộ; không thêm lời gọi git ở đường nóng.
- Chỉ tác động khi full hiệu lực (mục 2, 3, 4) hoặc theo R18 ở mọi chế độ (mục 1); chữ ký `classifyPath`/`grantsOf` giữ nguyên.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment theo AGENTS.md.
- Không push, không merge khi người dùng chưa duyệt G3; không `Co-Authored-By` trong commit.

## Kiểm thử

- AC1.x, AC3.x, AC4.1: bảng ca (lệnh, cấu hình, kết quả) qua `guard-bash.decide`; AC2.x qua `guard-files.decide`. Thư mục `T`/`O`/`D`/`OUT`/`P` tạo bằng `mkdtemp` dưới `<tmpdir>/aip-…`, rời nhau, không dưới `<tmpdir>/claude`; ca nhắc `<tmpdir>/claude` dùng đường dẫn tính từ `os.tmpdir()`, không tạo gì ở đó.
- AC5.1: chạy nguyên các suite cũ, không thêm test lặp.
- AC6.1: `test/content` chỉ ghim hợp đồng vận hành đã có (tên khoá); không ghim đoạn văn.
- AC6.2: `npm run build`, `versions.mjs --lock`, `npm test` một lần cuối.
- Trước G3, reviewer cuối chạy thử `decide` thật ở full bằng script tạm trong scratchpad với các ca của AC (không chỉ đọc code), theo bài học của request trước.

## Để builder quyết

- Tên hàm/biến nội bộ (`globMatchesDotDot`, hằng câu dùng chung), cách tách `writeTargets` thành hàm con cho phần gán slot PowerShell.
- Có gom các ca mới thành một bảng tham số hoá hay chia theo AC miễn không lặp ca.

## Quyết định khi thực thi

Chép từ `Ruling:` và vòng review của ledger (`.aip/` không vào nhánh); kiểm lại bằng `node test/validate.mjs --only path-permissions`.

- Cách chạy: Subagent + review từng task (người dùng chọn). Task 6 cỡ nhỏ chỉ chịu review cuối.
- `cp -rt O OUT/a` giữ `deny` (AC3.1 đã sửa): cờ gộp không phân biệt được với cờ PowerShell như `-Filter`, nên đối số cuối vẫn là đích ghi.
- R18: `CLAUDE_DIR` không phân biệt hoa thường, đích được chuẩn hoá (`.claude/.`, `.claude/sub/..`); tên nguồn bỏ tiền tố `-Tham:` và tách dấu phẩy.
- Tách mảng dấu phẩy ở PowerShell giữ cả token gốc bên cạnh các phần tách (chuỗi nháy có dấu phẩy là một đường dẫn literal; token rỗng vẫn là không xác định).
- Tham số có giá trị của `Copy-Item`/`Move-Item` được bỏ giá trị: `-Filter`, `-Include`, `-Exclude`, `-Credential`, `-ToSession`, `-FromSession` và các tham số chung `-ErrorAction`… `-PipelineVariable`.
- Glob: chỉ đoạn bắt đầu bằng `.` viết tường minh mới khớp `..`; lớp POSIX coi là khớp; dãy `*` gộp, đoạn dài trên 1024 ký tự coi là khớp; biến/`~` sau đoạn glob thì hỏi; thư mục trước đoạn glob đã thiếu quyền thì vẫn `deny`.
- Dòng "Lệnh gồm" của popup nêu đường dẫn chưa biết, rồi file cấu hình hook, rồi đích đầu tiên (nguồn đọc đứng đầu của `cp` không còn che đích ghi).
- Đoạn nối vi phạm R18 hạ `deny` của đoạn khác trong cùng lệnh thành `ask`: giữ, vì cơ chế ask cấu hình trước kiểm root đã có ở master; ghi vào R18.
- Core nâng 1.33.12 → 1.33.14 (1.33.13 đã bị khoá trước khi sửa review cuối; cổng version từ chối lock khi nội dung đổi mà version giữ nguyên).
- Rút gọn câu `reason` của popup ask (R21) làm request riêng sau request này: đổi R21 là đổi AC đã duyệt của `hook-popup`, và request này không thêm câu ask mới.
- Hoãn cho người dùng quyết ở G3 (lỗ ngoài AC, có từ master, đã ghi ở R24 phần giới hạn): `Set-Content -Encoding utf8 OUT/x -Value y` (và `Out-File`, `Add-Content` có tham số có giá trị đứng trước), `Copy-Item -Dest` viết tắt, alias `cpi`/`mi`/`ri`, brace expansion `rm T/{..,x}/f`, `cp … -S .bak`.

## Rủi ro và câu hỏi mở

- [Inference] K1 làm ca dùng thường xuyên bị hỏi thêm ở full: `cp "$f" dest` trong vòng lặp, `cp ~/x .`, `cp /ngoài/x .`. Hướng giảm nhẹ: thêm thư mục nguồn vào `fullPaths` với `read`.
- [Inference] D2 bỏ lời hỏi cũ cho `Copy-Item -Path .claude/settings.json -Destination x` (nguồn chỉ đọc); nếu người duyệt muốn giữ hỏi mọi lần nhắc tên file cấu hình thì đảo D2.
- [Unverified] Mục 4 dựa vào hành vi glob của bash < 5.2 và dash theo mô tả follow-up; D5 hỏi bất kể phiên bản nên đúng ở cả hai phía, chỉ có thể hỏi thừa trên bash ≥ 5.2.
- [giả định] Gán slot theo thứ tự tham số của PowerShell (`Path` rồi `Destination`) đúng cho `Copy-Item` và `Move-Item`; chưa chạy trên PowerShell thật trong request này.
- [giả định] `<tmpdir>/claude` là gốc đúng trên mọi nền (R23 ghi [Unverified] cho POSIX); mục 2 thừa hưởng cùng giả định.
