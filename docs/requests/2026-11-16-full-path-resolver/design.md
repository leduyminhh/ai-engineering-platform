# Thiết kế: bộ giải đường dẫn dùng chung cho guard-bash ở full
- Ngày: 2026-11-16
- Trạng thái: draft
- Requirement: không có

## Vấn đề và lý do

Lệnh thật bị hỏi oan ở chế độ `full` + bypass, với scratchpad nằm dưới `fullRoots` (`<tmpdir>/claude/…`) và thư mục dự án là cwd (rút gọn, `T` là scratchpad, `OUT` là đường dẫn ngoài mọi root):

```
S="$(cygpath -u 'C:\…\scratchpad')/e2e" && M="$PWD/src/data/database-backup" && rm -rf "$S/run/backup"/* && : >"$S/stub.log" && echo "CRON_USER=$(id -un)" >>"$S/run/.env" && export APP_ROOT="$S/run/app" PATH="$S/shim:$M/scripts:$PATH" && bash "$APP_ROOT/scripts/db-job.sh" create 2>&1 | tail -2; cat "$S/cron.d" | tail -1
```

Nguyên nhân (số đo do session chính báo cáo từ `decide()` thật; [Unverified] agent chỉ đối chiếu với code, chưa chạy lại):

1. `substituteVars` (`core/hooks/scripts/guard-bash.mjs`) chỉ nhận khối gán ở đầu chuỗi, giá trị là literal hoặc `$(cygpath …)` đứng riêng, kết thúc bằng `;` hoặc xuống dòng. `S="$(cygpath …)/e2e"`, `S=$(cygpath …)/e2e` và `S=… && …` không được giải, nên `$S` còn lại là chưa rõ.
2. `naiveSegments` tách từ bằng `/"[^"]*"|'[^']*'|\S+/g` (đã đọc code, đúng regex này). `"$S/run/backup/"*` thành hai từ `…/backup/` và `*`; `*` đứng riêng là glob tương đối nên chưa rõ. Ngay cả `rm -rf "C:/…/backup/"*` không biến cũng bị hỏi.
3. Đường dẫn có `\` không phải nguyên nhân (session chính đo: `S=$(cygpath -u 'C:\…'); rm "$S/x"` qua được).

Gốc vấn đề: ba chỗ tự hiểu đường dẫn theo luật riêng.
- `substituteVars` viết lại chuỗi bằng regex rồi parse lại.
- `parse()` không giữ nháy theo từng phần và gộp `&&` với `&` vào cùng một op `&` (đã đọc code).
- `naiveSegments` làm mất cấu trúc nháy liền kề.

Mỗi dạng cú pháp mới phải vá một chỗ. Thiết kế này gom ba chỗ về một bộ giải từ dùng chung.

Baseline: `npm test` exit 1 chỉ vì `test/statusline.test.mjs` AC1.1 (statusline đọc dòng `Blocked:` của ledger `.aip/runs/2026-11-16-hook-copy-alias-brace` trên máy, ngoài vùng sửa) [Unverified: do session chính báo cáo]. Các suite hook xanh theo báo cáo đó.

## Quyết định đã chốt

- **K1 — Bộ giải từ chung.** Một hàm giải một từ (token kèm thông tin nháy từng phần) theo các bước bash: bỏ nháy; thay `$NAME`/`${NAME}` từ môi trường đã biết; thay `$(cygpath [cờ] <literal>)`; glob chỉ tính ở phần không nháy; `~` đầu từ không nháy là chưa rõ. Một vòng duyệt các đoạn lệnh theo thứ tự theo dõi cả thư mục (cd) lẫn biến (phép gán) với cùng luật tin cậy. Bỏ `substituteVars`; H6 và kiểm bí mật ngoài root dùng bộ giải mới. Dạng mới về sau chỉ thêm một ca vào hàm giải và một dòng vào bảng test. Hướng bị loại: nới regex `ASSIGN_VALUE` và sửa `naiveSegments` (diff nhỏ nhưng vẫn vá từng dạng).
- **K2 — `&&` sau phép gán được tin**, theo luật ở D1 (cygpath lỗi thì `&&` dừng cả chuỗi).
- **K3 — Phạm vi Bash.** Phép gán ở bất kỳ đoạn cấp cao nhất nào (không chỉ khối đầu), `export A=v B=v`, giá trị ghép (`"$(cygpath …)/e2e"`, `"$S/run/app"`), `$PWD`/`${PWD}` là thư mục đang theo dõi khi thư mục đó tin được. `$HOME` và `~` không làm: vẫn chưa rõ, nên hỏi.
- **K4 — PowerShell trong đợt này.** `$S = '…'` và `$S = "…$T\x"` rồi `Remove-Item "$S\x"`; tên biến không phân biệt hoa thường; `$PWD` cũng giải. `$env:X`, `$(…)` và `${…}` lạ là chưa rõ.

### Quyết định của agent

Người dùng trả lời K1–K4 và duyệt ở G1 với lựa chọn bỏ D2. Mọi dòng dưới là **quyết định của agent**. D3, D4 và D9 lệch khỏi luật đề xuất của session chính ở chỗ ghi rõ.

- **D1 — Luật tin cậy cho phép gán.** Gọi `k` là một phép gán `NAME=…` hoặc `export NAME=…` (đơn lẻ, không phải khối), `j` là đoạn sau `k`. Giá trị của `k` được tin cho `j` khi cả hai điều kiện đúng:
  - (i) `k` không ở pipeline (không có `|` ngay trước hoặc sau), không kết thúc bằng `&`, không nằm trong cấu trúc phức (D12);
  - (ii) `k` là đoạn đầu của danh sách and-or (đứng đầu chuỗi, sau `;` hoặc xuống dòng) và `j` ở danh sách sau; hoặc `j` cùng danh sách với `k` và mọi toán tử từ đầu danh sách tới `j` đều là `&&`.

  Đối chiếu: `S=T; true && S=/etc; rm $S/x` cho `S=/etc` không đầu danh sách nên không tin, `S` chưa rõ, `ask`. `cd $D && S=T; rm $S/x` không tin, `ask`. `S=T && rm $S/x` tin, `null` nếu nằm trong root. `echo hi⏎S=T⏎rm $S/x` tin (`S=T` đầu danh sách nên luôn chạy), `null`.

- **D2 — (bỏ ở G1).** Bản nháp từng chỉ tin phép gán trong khối đầu chuỗi. Người dùng bỏ ở G1 vì lệch K3. Hệ quả có chủ đích: hai hàng test cũ `cd /e/x && echo hi; S=<T>; rm $S/x` (`stay`) và `echo hi⏎S=<T>⏎rm -rf $S/etc` (`mustStop`) đổi từ `ask` sang `null`. Hai hàng đó ghim giới hạn của regex cũ, không phải ca không an toàn: phép gán đứng đầu danh sách sau `;`/xuống dòng luôn chạy. Test được chuyển sang AC1.2.

- **D3 — Tên biến không tin được thì chưa rõ ở mọi vị trí.** Nếu một tên có phép gán không tin được ở bất kỳ vị trí nào trong lệnh (kể cả env-prefix `S=v cmd`, trong `if`/hàm/subshell, sau `|`, `&`, `||`), thì tên đó chưa rõ ở toàn bộ lệnh, kể cả các đoạn trước phép gán. Cùng quy tắc cho `NAME+=`, `NAME[…]=`, `NAME in`, `for NAME`, `printf -v NAME`. Đây là mở rộng của quy tắc `NAME=` cũ của R23 (áp cho cả lệnh, không chỉ phần sau). Lý do: không đổi `ask` thành `null` (ví dụ `S=<T>; S=$X; …` hay `S=<T> rm …`).

- **D4 — Tắt giải biến cả lệnh (giữ như R23 cũ).** Lệnh dài hơn 20000 ký tự, nhiều hơn 20 tên, `IFS`, một trong `unset read declare typeset local readonly eval source . mapfile readarray getopts`, here-string `<<<`, heredoc không phải `cat`/`tee` với delimiter có nháy đơn giản, nháy không đóng: không giải biến nào. Các biến khi đó là chưa rõ, nên kết quả là `ask` như hiện nay. Lệch so với gợi ý "biến liên quan": không gộp theo tên, vì nếu gộp thì `S=<T>; read X; rm $S/x` đổi từ `ask` sang `null`.

- **D5 — `$(cygpath …)`.** `$(cygpath [cờ] 'lit')` hoặc `$(cygpath [cờ] "lit")` (nội dung không có `$`, backtick, `\`) với cờ thuộc `{-u, -m, -w, -a, -l}` được giải thành `lit`, chuẩn hoá bằng `normalizeMsysPath` như hiện nay. Được nhận khi đứng bare, trong nháy kép, hoặc ghép với phần khác. `$( )` khác và backtick: chỉ từ chứa nó là chưa rõ, không tắt cả lệnh (lệnh con không đổi biến của shell cha). [giả định] đây là khẳng định về POSIX shell, chưa đo.

- **D6 — Nháy và glob.** Chọn cách bash: `*`, `?`, `[` trong nháy đơn hoặc kép là ký tự thường; chỉ là glob khi đứng ngoài nháy, hoặc khi giá trị biến được mở rộng ngoài nháy chứa chúng (bash glob kết quả mở rộng không nháy). Cờ glob đi theo từng đích (mảng song song), `classifyPlain` nhận cờ này thay cho `GLOB.test` trên chuỗi. Lý do: K1 đã nói glob chỉ tính ở phần không nháy. An toàn: `"T/x*"` thành đường dẫn literal trong `T`, còn `"T/x"*` vẫn là glob (ở phần không nháy). Brace giữ như D5 cũ (vẫn mở cả trong nháy, vì hook không biết nháy có chặn mở rộng hay không).

- **D7 — Giá trị và chuẩn hoá.** Giá trị phải là đường dẫn tuyệt đối (như cũ; tương đối là chưa rõ). Bỏ hạn chế charset của regex cũ, vì giá trị không còn bị dán lại vào lệnh rồi parse lại. Nếu phần mở rộng nằm ngoài nháy và giá trị có khoảng trắng, đó là chưa rõ (bash tách từ). Sau khi ghép, `..` được chuẩn hoá rồi kiểm root bình thường: ra ngoài root thì `deny` (đổi có chủ đích từ `ask`, ví dụ `S='<T>'/../../..; rm -rf $S/victim`). `~` và `$HOME` là chưa rõ (K3).

- **D8 — Biến đặc biệt.** `$PWD`/`${PWD}` là thư mục của bộ giải khi tin được, không thì chưa rõ. `$?`, `$$`, `$1`, `$OLDPWD`, `${…}` khác `${NAME}` đơn, `$'…'`, `$[…]`, `$#`: chưa rõ.

- **D9 — Thư mục (cd) giữ luật cũ của `trackDirs` (LỆCH có chủ đích).** `cd` có hiệu lực cho các đoạn sau, trừ sau `||`/`|`; `popd`/`pop-location` làm thư mục chưa rõ; `cd $X`, `cd -` là chưa rõ, như cũ. Không áp luật D1 cho `cd`. Lý do: áp đầy đủ sẽ đổi ca popup đang `null` của AC6.2 (`S=…; R=…; mkdir -p $S/bin && cd $S⏎…⏎cat > bin/docker <<'EOF'`): `cat > bin/docker` nằm ở danh sách sau nên `cd` không tin, `bin/docker` thành tương đối, `ask`. Hệ quả đã biết: `cd` thất bại không được phát hiện, dir vẫn coi là đã đổi. [Inference] đây là giả định cũ của `trackDirs`, không phải lỗ hổng mới. Người duyệt có thể đổi, khi đó ca popup phải sửa test.

- **D10 — Hai bộ tách từ.** `parse()` và `summarize` không đổi (H1 và dòng "Lệnh gồm" giữ nguyên). Thêm tokenizer `scanWords` chạy song song để bộ giải dùng: tách `&&` khỏi `&`, coi `$( )` và backtick là một phần của từ, giữ nháy từng phần `{text, quote}`, coi `#` đầu từ không nháy là chú thích tới hết dòng (đúng bash), đánh dấu pipeline và nền. Lý do: `parse()` gộp `&&` với `&`, tách `(` trong `$(` thành subshell, và không giữ nháy từng phần; đổi `parse()` sẽ đổi H1 và "Lệnh gồm". Rủi ro: hai tokenizer lệch nhau, giảm bằng test đối chiếu (AC4.2).

- **D11 — `naiveSegments`.** Đổi cách tách thành một lượt quét ký tự: một từ là chuỗi liên tiếp các phần nháy đơn, nháy kép và không nháy, không có khoảng trắng ngoài nháy. Từ giữ `wparts`; text dựng từ `wparts`, không strip nháy bằng regex như cũ (vì `"a"b"c"` bị cắt sai). Vẫn chạy song song với `parse()` như cũ để hợp kết quả cho H1 và H6.

- **D12 — Cấu trúc phức.** Từ `(`, `{`, `if`, `then`, `else`, `elif`, `fi`, `for`, `while`, `until`, `case`, `do`, `done`, `function` hoặc `name()` trở đi trong lệnh, mọi phép gán ở trong đó là không tin (D1, D3 áp). Lệnh `cd` trong đó xử lý theo D9.

- **D13 — PowerShell (K4).** Chuỗi đơn `'…'` là literal (`''` là nháy). Chuỗi kép `"…"`: `$NAME` và `$PWD` được giải; backtick, `$(`, `${`, `$env:` là chưa rõ. Tên biến không phân biệt hoa thường (khoá viết thường). `$NAME` không nháy đứng riêng thành một đối số được giải; `$NAME\x` không nháy là chưa rõ [Unverified: cách PowerShell tách token này chưa kiểm]. `&&`/`||` (PowerShell 7) không tin, theo D1. `Set-Variable`, `New-Variable`, `Remove-Variable`, `Clear-Variable` làm cả lệnh tắt giải biến như D4 (nhất quán với bash). Lệnh PowerShell không dùng biến không đổi.

- **D14 — Bỏ `substituteVars`.** H6 và kiểm bí mật (`variableLists`) dùng cùng kết quả của bộ giải, tính một lần cho mỗi `decide` và cache theo chuỗi. `secretOutsideRoots` nhận danh sách đã giải.

- **D15 — Hiệu năng.** Bộ giải và `scanWords` là một lượt quét, không regex lồng, không backtrack bậc hai. Ngân sách brace cũ (`BRACE_BUDGET`) và trần 20000 ký tự giữ nguyên. Tổng chi phí cỡ tuyến tính theo số ký tự và số từ.

- **D16 — Dòng "Lệnh gồm" và spec.** `summarize` không đổi, vẫn hiện đường dẫn thô (kể cả `$S/…`). Spec: R23 viết lại đoạn giải biến theo mô hình mới; R24 thêm một câu về glob trong nháy (D6) và `$(cygpath …)` (D5); R7 đổi một cụm ("biến gán và `$PWD` trong cùng lệnh được giải (R23)"). Thêm dòng Lịch sử cho ba mục. README.md (dòng ~460) và README_VI.md (dòng ~456) sửa đoạn tương ứng.

- **D17 — Version.** `core/.manifest.json` 1.34.4 → 1.34.5 (sửa hành vi hook), `npm run build`, `node cli/lib/versions.mjs --lock`. [giả định] số 1.34.5 là bước patch tiếp theo, không kiểm được từ phạm vi thiết kế này.

## Hướng đã cân nhắc

**Chọn — bộ giải từ dùng chung (K1)**: `scanWords` cho token có nháy từng phần, một bộ giải `resolveWord`, một vòng duyệt cho cd và phép gán với luật ở D1–D3, bỏ `substituteVars`.

**Loại 1 — nới `ASSIGN_VALUE` và sửa `naiveSegments`** (diff nhỏ): vẫn vá từng dạng (`"…"*`, `$(cygpath …)/x`, `&&`). Người dùng loại (K1).

**Loại 2 — thay `parse()` bằng tokenizer đầy đủ cho mọi nơi** (agent tự nêu, không phải người dùng chọn): sẽ đổi H1, "Lệnh gồm" và rủi ro hồi quy lớn hơn phạm vi K1. Loại; D10 giữ `parse()`.

## Tiêu chí chấp nhận

Không có `requirement.md`, nên AC nằm ở đây. Test ở `test/contract/99-path-permissions.contract.mjs` (khối mới "biến gán và bộ giải") và giữ nguyên khối Task 7 của `test/contract/99-hook-popup.contract.mjs`. Mỗi test tên có ID AC.

- [ ] **AC1.1** — Given full + bypass, `fullRoots` gồm `<tmpdir>` (scratchpad `T` nằm dưới root), cwd là thư mục dự án, Bash, lệnh rút gọn của phần Vấn đề (có `S`, `M`, `export`, `&&`, `cat "$S/cron.d"`) When `decide` Then trả `null`.
- [ ] **AC1.2** — Given full + bypass, Bash When `S="$(cygpath -u '<T>')/e2e"; rm -rf "$S/x"`, `S=$(cygpath -u '<T>')/e2e && rm "$S/x"`, `S="<T>/e2e"; rm -rf "$S/run/backup/"*`, `rm -rf "<T>/backup/"*`, `echo hi⏎S=<T>⏎rm -rf "$S/etc"`, `cd <T> && echo hi; S=<T>; rm $S/x`, `echo hi && export A=<T>/a && rm "$A/x"` Then mỗi ca trả `null` (hai ca `echo hi…S=<T>` đổi từ `ask`, có chủ đích, D2).
- [ ] **AC1.3** — Given full + bypass, Bash When `rm "<T>/x*"` (glob trong nháy là ký tự thường) và `rm "<T>/x"*` (glob ngoài nháy, trong root) Then `null`; `rm "<OUT>/x"*` Then `deny`.
- [ ] **AC1.4** — Given full + bypass, Bash When `export APP="<T>/app" && rm "$APP/x"` Then `null`; `cd <T>; M="$PWD"; rm "$M/y"` Then `null`; `cd <OUT>; M="$PWD"; rm "$M/y"` Then `deny`; `export APP=<OUT>/app && rm -rf "$APP/x"` Then `deny`.
- [ ] **AC1.5** — Given full + bypass, Bash When mỗi ca trong bảng sau chạy, Then kết quả là `ask` (không `null`): `rm $S/x; S=<T>`; `S=$X; rm "$S/x"`; `S=<T>; S=$X; rm "$S/x"`; `S="<T>/a b"; rm $S/x`; `A=1 && S=<T>; rm $S/x`; `S=<T> rm -rf "$S/etc"`; `S=<T> | cat; rm -rf "$S/etc"`; `S=<T> & rm -rf "$S/etc"`; `if false; then S=<T>; fi; rm -rf "$S/x"`; `(S=<T>); rm -rf "$S/x"`; `f() { S=<T>; }; rm -rf "$S/x"`; `S=<T>; S+=/../v; rm -rf $S`; `S=<T>; S[0]=/etc; rm -rf $S/x`; `S=<T>; unset S; rm -rf $S/etc`; `S=<T>; read X; rm -rf "$S/x"`; `S=<T>; eval S=/etc; rm -rf $S/x`; `S=<T>; cat <<<x; rm -rf $S/y`.
- [ ] **AC1.6** — Given full + bypass, Bash When `S=<OUT>; rm $S/x`, `cd <T>; S=/etc; rm $S/x`, `S='<T>'/../../..; rm -rf $S/victim`, `S="<T>"/../../..; rm -rf $S/victim`, `S=$(cygpath -u '<T>')/../../..; rm -rf $S/victim` Then `deny` (ba ca cuối đổi từ `ask` sang `deny`, có chủ đích).
- [ ] **AC1.7** — Given khối Task 7 của `99-hook-popup` (bảng `stay`, `mustStop`, `heredocMustStop`) When chạy với bộ giải mới Then mọi hàng trả không-`null`, trừ đúng hai hàng của D2 (chuyển sang AC1.2, kết quả `null`); ba hàng `mustStop` đầu đổi `ask` → `deny` và được ghi trong test.
- [ ] **AC1.8** — Given `mode: "ask"` (không full) và full không bypass, Bash When `S=<OUT>; rm $S/x` và `S=<T>; rm $S/x` Then `null` như trước (không có H6).
- [ ] **AC2.1** — Given full + bypass, PowerShell, `fullPaths` như hiện có When `$S = '<T>'; Remove-Item "$S\x"`, `$s = '<T>'; Remove-Item "$S\x"`, `$S = "<T>"; Remove-Item "$S\x"` Then `null`; `$S = '<OUT>'; Remove-Item "$S\x"` Then `deny`; `$S = '<T>/../../..'; Remove-Item "$S\x"` Then `deny`; `$S = $env:TEMP; Remove-Item "$S\x"` Then `ask`; `if ($true) { $S = '<T>' }; Remove-Item "$S\x"` Then `ask`; `$S = "<T>"; Set-Variable S '<OUT>'; Remove-Item "$S\x"` Then `ask` hoặc `deny` (không `null`).
- [ ] **AC2.2** — Given `mode: "ask"` và full không bypass, PowerShell When các ca của AC2.1 Then kết quả như trước thiết kế (không có H6).
- [ ] **AC3.1** — Given full + bypass, Bash When một lệnh dưới 20000 ký tự có 20 tên gán hợp lệ và nhiều đường dẫn dùng biến Then `decide` cho kết quả đúng theo luật và xong trong ngưỡng 1 s (assert trong test).
- [ ] **AC3.2** — Given full + bypass, Bash When một lệnh trên 20000 ký tự có `S=<T>; rm -rf $S/x` Then `ask` (không giải biến, như trước); và một lệnh có 21 tên gán Then `ask`.
- [ ] **AC4.1** — Given bộ giải mới When chạy các suite `94-permission-modes`, `99-hook-popup`, `99-path-permissions`, `90-hooks`, `97-audit-mustfix` Then xanh; mọi ca không có biến giữ kết quả cũ, trừ các thay đổi đã liệt kê ở Thiết kế (đối chiếu ca).
- [ ] **AC4.2** — Given `parse()` không đổi và `scanWords` mới When chạy test đối chiếu trên các lệnh mẫu có nháy, `$( )`, `&&`/`&` Then tokenizer mới và `parse()` cho cùng danh sách đích ghi ở mọi ca không có biến, `&&` và `&` được tách đúng.
- [ ] **AC5.1** — Given tài liệu When đọc `docs/specs/hooks-gates/spec.md` Then R7 (một cụm), R23 (đoạn giải biến viết theo mô hình mới) và R24 (glob trong nháy, `$(cygpath …)`) đã sửa, dòng Lịch sử có ba mục cho `2026-11-16-full-path-resolver`; README.md và README_VI.md (đoạn biến gán) khớp spec.
- [ ] **AC5.2** — Given các sửa trên When `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` Then build và lock khớp; `npm test` xanh trừ `test/statusline.test.mjs` AC1.1 (baseline đã nêu); `core/.manifest.json` là 1.34.5.

## Thiết kế

### Chỗ cần sửa

- **`core/hooks/scripts/guard-bash.mjs`**:
  - `scanWords(cmd)` (mới, D10): tokenizer với `{text, quote}` cho từng phần, `sep` (`start`, `;`, `&&`, `||`, `|`, `&`), cờ pipeline, nền, cấu trúc phức.
  - `resolveWord(word, state, dialect)` (mới, K1): trả `{text, glob, qpos}` hoặc `null` (chưa rõ). `dialect` là `bash` hoặc `powershell`. `qpos` là vị trí ký tự nháy đầu tiên trong chuỗi đã giải, để `writeTargets` vẫn tìm `>` đúng chỗ.
  - Vòng duyệt trạng thái (thay `trackDirs` cho H6 và kiểm bí mật; `trackDirs` giữ cho H1): theo D1–D3, D9, D12.
  - `naiveSegments`: tách từ theo D11.
  - `writeTargets`/`classifyTarget`/`classifyPlain`: nhận cờ glob theo đích thay cho `GLOB.test` trên chuỗi (D6).
  - `substituteVars` và `ASSIGN_*`, `CD_LEAD`, `VAR_MUTATORS` (phần giải biến): bỏ hoặc chuyển thành điều kiện tắt của D4.
  - `decide`: H6 và `variableLists` dùng kết quả của vòng duyệt (D14).
- **`core/hooks/scripts/gate-config.mjs`**: không đổi (`normalizeMsysPath`, `classifyPath`, `hasUnresolvedRef` giữ nguyên).
- **Test**: khối mới trong `test/contract/99-path-permissions.contract.mjs` (bảng tham số hoá theo AGENTS.md Testing; tên test có ID AC); khối Task 7 của `99-hook-popup` giữ, thêm ba hàng `deny` đổi từ `ask`.
- **Tài liệu**: `docs/specs/hooks-gates/spec.md` (R7, R23, R24, Lịch sử), `README.md` và `README_VI.md`, `core/.manifest.json`, `plugins/_versions.lock.json` (qua `versions.mjs --lock`).
- **Không đổi**: `parse()`, `summarize`, `trackDirs` (H1), `gate-config.mjs`, `guard-files.mjs`, `guard-mcp.mjs`, `gate-stop.mjs`, `session-start.mjs`, `cli/lib/*`.

### Đối chiếu ca (đối chiếu bằng tay, chưa chạy)

[Inference] Đối chiếu bằng tay từng nhóm trong ba bảng Task 7 với D1–D9. Chưa chạy lại; reviewer phải chạy `decide` thật (AC1.7, AC4.1).

| Ca | Hiện tại | Theo thiết kế | Ghi chú |
|---|---|---|---|
| `cd /e/x && echo hi; S=<T>; rm $S/x` | ask | null | D1 (ii), D2 bỏ ở G1 |
| `echo hi⏎S=<T>⏎rm -rf $S/etc` | ask | null | D1 (ii), D2 bỏ ở G1 |
| `S=<T>; true && S=/etc; rm $S/x` | ask | ask | D1: không đầu danh sách |
| `S='<T>'/../../..; rm -rf $S/victim` | ask | deny | D7, đổi có chủ đích |
| `S="<T>"/../../..; rm -rf $S/victim` | ask | deny | D7 |
| `S=$(cygpath -u '<T>')/../../..; rm -rf $S/victim` | ask | deny | D7 |
| `cd /e/x; S=/etc; rm $S/x` | deny | deny | D1, đầu danh sách |
| Popup AC6.2: `S=$(cygpath -u '<T>'); R=…; mkdir -p $S/bin && cd $S⏎…⏎cat > bin/docker <<'EOF'` | null | null | D9 giữ cd cũ |
| `S=<T> rm -rf $S/etc` | ask | ask | D3 (env-prefix) |
| `S=<T> \| cat; rm -rf $S/etc`; `S=<T> & rm -rf $S/etc` | ask | ask | D1 (pipeline, nền) |
| `if false; then S=<T>; fi; rm -rf $S/x` | ask | ask | D3, D12 |
| `S=<T>; S+=/../v; rm -rf $S` | ask | ask | D3 |
| `S=<T>; read X; rm -rf $S/x` | ask | ask | D4 (không gộp theo tên) |
| `S=<T>; cat <<<x; rm -rf $S/y` | ask | ask | D4 |
| `S=<T>⏎cat <<'EOF' > /etc/x⏎…⏎EOF` | deny | deny | heredoc đơn giản, đích ngoài root |
| `S=<T>⏎bash <<'EOF'⏎…⏎EOF` | ask | ask | D4: heredoc không đơn giản |
| `cd $D && S=<T>; rm $S/x` | ask | ask | D1, chưa rõ `cd` |
| `cd /khong && S=<T>; rm -rf $S/` | ask | ask | D1 (không đầu danh sách) |

Các hàng còn lại của ba bảng tuân theo cùng luật (đều dùng gán không tin được, D3, D4 hoặc heredoc) [Inference].

### Thứ tự thực thi (gợi ý cho plan)

1. Khối test mới (AC1.x, AC2.x, AC3.x) viết trước, chạy đỏ.
2. `scanWords` + test đối chiếu với `parse()` (AC4.2).
3. `resolveWord` (K1, D5–D8) và naive (D11).
4. Vòng duyệt trạng thái (D1–D4, D9, D12) và thay `substituteVars` (D14).
5. Cờ glob theo đích (D6) và PowerShell (D13).
6. Spec, README, version, build, lock, `npm test`.

## Ảnh hưởng spec
- hooks-gates: đổi R7, đổi R23, đổi R24

## Ngoài phạm vi và anti-goal

- Không đổi `parse()`, `summarize`, `trackDirs` của H1, và không áp luật D1 cho `cd` (D9).
- Không giải `$HOME`, `~`, `$env:X`, `$(…)` ngoài `cygpath`, `${…}` lạ (K3, K4).
- Không gộp tắt biến theo tên cho lệnh mutator (D4).
- Không thêm alias PowerShell, không đổi câu hỏi (`reason`) của R21, không đổi brace của R18/R24 ngoài đoạn đã nêu.
- Anti-goal: không biến một `ask` có sẵn thành `null` trong ba bảng test, trừ hai hàng của D2 đã duyệt ở G1; không làm lỏng root.

## Ràng buộc

- Zero-dependency, Node built-ins; hook fail-open khi lỗi nội bộ (`decide` lỗi thì không chặn lệnh, như cũ).
- Không thêm lời gọi git ở đường nóng; bộ giải chỉ đọc chuỗi lệnh và trạng thái đã có.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment theo AGENTS.md (chỉ ghi lý do, không ghi "làm gì").
- Không push, không merge, không `Co-Authored-By`.
- Request này và các request hook khác cùng sửa `guard-bash.mjs`: chạy lần lượt, không song song.

## Không đổi (bugfix)

Đây là bugfix hỏi oan. Các hành vi sau phải giữ nguyên:
- Mọi ca không có biến trong `99-path-permissions` và `94-permission-modes` giữ kết quả, trừ các thay đổi đã liệt kê ở đối chiếu ca.
- Chế độ `ask` (không full) không đổi kết quả nào.
- H1 (push) và dòng "Lệnh gồm" không đổi.
- Câu `reason` của `ask`/`deny` không đổi chữ (R21).
- Quy tắc heredoc đơn giản (`cat`/`tee` với delimiter có nháy) không đổi.
- Hành vi PowerShell với đường dẫn không dùng biến không đổi.

## Kiểm thử

- Bảng tham số hoá trong `test/contract/99-path-permissions.contract.mjs` (khối biến gán và bộ giải); một hàng cho một hành vi. Cùng seam `config`, `repoRoot`, `tracked`, `permission_mode`; `T`, `OUT` tạo bằng `mkdtemp` dưới `<tmpdir>/aip-…`, không dưới `<tmpdir>/claude`, trừ ca cần scratchpad thật.
- Khối Task 7 của `99-hook-popup` giữ nguyên; thêm chú thích AC1.7 cho ba hàng đổi.
- Đối chiếu tokenizer (AC4.2): test đọc `parse()` và `scanWords` trên cùng lệnh không biến.
- Đo thời gian (AC3.1): một assert với ngưỡng 1 s. [Inference] ngưỡng mỏng trên máy tải, theo bài học của request trước; nếu flaky, nới ngưỡng thay vì bỏ ca.
- Trước khi báo xong, reviewer cuối chạy `decide` thật bằng script tạm trong scratchpad cho các ca của AC1.1–AC1.6 và AC2.1 (không chỉ đọc code).
- AC5.2: `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` một lần cuối.

## Để builder quyết

- Tên hàm và biến nội bộ (`scanWords`, `resolveWord`, cờ glob).
- Cách gom ca mới thành bảng tham số hoá, miễn không lặp ca đã có.

## Rủi ro và câu hỏi mở

- **D9 (cd, đã duyệt ở G1).** Giữ `cd` như `trackDirs`, nên `cd` thất bại không được phát hiện (giả định cũ).
- **D6 (glob trong nháy là ký tự thường, đã duyệt ở G1).** Đúng bash. [Inference] nếu hook gặp shell khác bash, cách hiểu có thể khác; hiện Claude Code trên Windows chạy Git Bash.
- **D7 (`..` sau ghép → deny, đã duyệt ở G1).** Đổi `ask` sang `deny` ở ba ca.
- [Unverified] Cách PowerShell tách `$NAME\x` không nháy chưa kiểm; chỉ kiểm bằng `decide`, không chạy PowerShell thật.
- [Unverified] Hành vi cygpath và bash/dash trên các phiên bản khác với bash đã đo chưa kiểm (theo R24 cũ, chỉ đo bash 5.2.37).
- [Inference] Hai tokenizer (`parse` và `scanWords`) có thể lệch; giảm bằng AC4.2 nhưng không loại hẳn.
- [giả định] Giới hạn 20000 ký tự, 20 tên, 256 nhánh brace và ngân sách `2^24` giữ như cũ; không đo lại trong thiết kế này.
- Không lập ADR: quyết định bộ giải chung là quyết định nội bộ của hook; nếu người duyệt muốn lưu lại, tạo ADR riêng.
- Baseline `npm test` đỏ ở `test/statusline.test.mjs` AC1.1 (ngoài vùng sửa) [Unverified: do session chính báo cáo].
