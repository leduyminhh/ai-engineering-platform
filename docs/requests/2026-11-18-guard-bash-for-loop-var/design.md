# Thiết kế: guard-bash giải biến vòng `for NAME in <literal>` ở full
- Ngày: 2026-11-18
- Trạng thái: merged 1ba564f0
- Requirement: không có

## Vấn đề và lý do

Ở chế độ `full`, `guard-bash` hỏi oan lệnh `SP="<scratchpad>" && for c in 82-swap-guard.sh 83-swap-refuse-engine.sh 84-swap-plan-pg.sh; do bash "$SP/runcase.sh" $c > "$SP/$c.out" 2>&1; …; done` dù `SP` nằm trong `fullRoots`. `$SP` giải đúng; nguyên nhân là biến vòng `$c`: luật tên gán không tin được (`leadInfo`: `for NAME`, `NAME in`) đưa `c` vào tập `bad`, nên `"$SP/$c.out"` còn `$` và đích ghi là chưa rõ → `ask`. Thay `$c.out` bằng tên cố định thì `null`. Hướng an toàn của hook không đổi: không hiểu thì hỏi, không im lặng cho qua lệnh ghi hay xoá ngoài root.

Đo bằng `decide` thật trên nhánh nền (full + bypass, `T` trong root, `OUT` ngoài mọi root, 2026-11-18):

| Lệnh | Hiện tại |
|---|---|
| `for c in a b; do rm <T>/$c.out; done` | `ask` |
| `for c in a b; do rm <OUT>/$c.out; done` | `ask` (nên `deny`) |
| `SP=<T> && for c in 1 2 3; do bash "$SP/runcase.sh" $c > "$SP/$c.out" 2>&1; done` | `ask` |
| `{rm,ls} <OUT>/x` (brace literal làm tên lệnh) | `null` — lỗ có từ trước, ngoài request này (xem Rủi ro) |

## Quyết định đã chốt

- **K1 — Giải `$NAME` bằng từng giá trị như brace expansion** (theo yêu cầu của phiên giao việc): mỗi giá trị phân loại riêng, gộp `blocked` > `outside` > `unknown`, mọi giá trị phải an toàn, trần 256 giá trị.
- **K2 — Dùng lại bộ giải đang có** (`scanWords`, `resolveWord`, `walkSegments`) và luật brace của `classifyTarget`/`braceExpand`; không thêm cơ chế song song.
- **K3 — Nền:** cắt từ `claude/laughing-tu-69e18d` (tip `6a66a2d0`, chưa merge, cùng sửa `guard-bash.mjs`); master chưa có hai nhánh sibling. Nhánh `claude/beautiful-nobel-cdade6` (sửa `node -e`) chưa có commit nào ngoài master khi bắt đầu.

### Quyết định của agent (cần duyệt ở G1)

- **D1 — Nhận dạng vòng.** Đoạn có dạng `for NAME in W1 … Wn` (`for` ở vị trí lệnh sau từ khoá mở đầu, `NAME` là tên biến, ≥ 1 từ), đoạn kế bắt đầu bằng `do` ngăn bằng `;` hoặc xuống dòng, và có đoạn `done` đóng đúng cấp (đếm lồng `for`/`while`/`until`/`select`). Mọi dạng khác (thiếu `in`, `for ((…))`, `select`, `do` thiếu, không có `done`) giữ nguyên: `NAME` thuộc tên không tin được → `ask` như cũ.
- **D2 — Danh sách phải literal.** Mỗi từ giải được không cần biến (`resolveWord` với env rỗng) và giá trị không có khoảng trắng, `,`, `{`, `}`, ký tự glob `*?[]`, không bắt đầu bằng `-` (giá trị như `-t` đổi nghĩa lệnh: `cp $c <ngoài> a`). Từ có `$`, backtick, `$( )`, `~` đầu từ, glob, `{`, hoặc quá 256 giá trị → vòng không được nhận, `NAME` chưa rõ. `HOME`, `PWD`, `OLDPWD`, `PATH`, `CDPATH` không bao giờ được nhận làm biến vòng.
- **D3 — Phạm vi hiệu lực.** `$NAME` chỉ được giải ở các đoạn từ `do` tới trước `done` (gồm lệnh con `$( )` trong đó); header `for` và đoạn `done` (chuyển hướng của `done > "$c.out"` chạy trước vòng, `$c` chưa gán) giữ chưa rõ, ngoài vòng cũng vậy.
- **D4 — Điều kiện nhận.** `NAME` chỉ có đúng một header vòng trong lệnh và không có phép gán, `for`/`select`, `NAME in`, `printf -v`… nào khác (gán lại trong thân vòng → chưa rõ). Lệnh có `case`, `<<`, hoặc khi cả lệnh đã tắt giải biến (`noVars`: `eval`, `read`, `IFS`…, hay vượt `MAX_VAR_NAMES`) thì không nhận vòng nào.
- **D5 — Biểu diễn.** Giá trị đưa vào từ như một nhóm có ký tự đánh dấu riêng (`U+E000` mở, `U+E001` ngăn, `U+E002` đóng; một giá trị → chính nó), không dùng `{,}` thật vì `classifyTarget` chỉ mở brace khi `msys` (PowerShell thì không). `classifyTarget` đổi nhóm đánh dấu thành brace rồi dùng lại `expandBraces` (một thể thức, một ngân sách `BRACE_BUDGET`) bất kể dialect. Trạng thái là một `Map` `loop` riêng trong `state` của `resolveWord` (không lẫn với `env`, vì `env` đòi giá trị là đường dẫn tuyệt đối), được truyền xuống lệnh con `$( )`; ở lệnh con, tên bị gán hay là biến vòng khác thì bỏ khỏi `loop` thừa kế. Giá trị chứa ký tự đánh dấu bị loại.
- **D6 — Tên lệnh không dùng giá trị vòng.** Giá trị `{rm,ls}` làm tên lệnh sẽ không khớp `rm` (thấy ở lỗ brace có từ trước), nên kiểm "tên lệnh là biến" (`opaque`) chạy trên từ giải **không có** `loop`: `for c in rm ls; do $c <ngoài> x; done`, `sudo $c …`, `env $c …`, `timeout 5 $c …` vẫn `ask` như cũ.
- **D7 — PowerShell** (người dùng chọn làm cùng request). Dạng nhận: `foreach ($x in 'a','b') { … }` (`foreach` đứng một mình một đoạn, `(` ngay sau, danh sách là các phần tử literal ngăn bằng dấu phẩy, khoảng trắng chỉ được đứng cạnh dấu phẩy, khối `{ … }` đóng đúng cấp). Giá trị theo D2 và thêm: mọi phần tử phải có nháy (từ không nháy trong danh sách `foreach` là lệnh hoặc biểu thức: `pwd`, `.\s.ps1`, `1kb`; reviewer độc lập đã chứng minh `foreach ($x in pwd)` cho `$x` là thư mục hiện tại), không có `:` (`variable:S`, `Env:X` là đường dẫn ổ provider). `@( )`, `1..3`, `$( )`, `(…)`, `ForEach-Object`, `%`, `while` giữ `ask`. Tên không phân biệt hoa thường. Các điểm riêng của PowerShell:
  - `psUnsafe` (bộ lọc tắt giải biến khi có `{ } ( =`) nhìn một bản "ảo" của lệnh: bỏ các đoạn cấu trúc của vòng (`foreach`, `$x in …`, `}`) và từ `{` mở khối; các đoạn thân chỉ phức vì vòng này coi như đơn; thân vẫn phải qua danh sách lệnh được giải biến, và tên biến vòng được coi là biến chỉ nhận giá trị an toàn (như `$S` gán đường dẫn tuyệt đối literal). Cần `scanWords` ghi thêm độ sâu `{`, độ sâu `(` và cờ khối của từng đoạn.
  - Lần quét thô (`naiveSegments` cắt theo `;` `|` `&&` kể cả trong nháy) không thấy cấu trúc vòng; để nó không hỏi oan, lần quét thô dùng các biến vòng mà lần quét `scanWords` đã nhận (không theo phạm vi), nhưng vẫn bỏ tên mà chính nó thấy bị gán. Lần quét `scanWords` giữ phạm vi; hai kết quả được hợp nên không nới hơn.
- **D8 — Bash dùng cùng cơ chế đánh dấu** (D5) để một biểu diễn cho cả hai dialect.

## Hướng đã cân nhắc

- **Chọn — `loop` Map riêng + nhóm brace trong text** (D5): dùng lại phân loại brace, thay đổi nhỏ ở `leadInfo`/`walkSegments`/`resolveWord`.
- **Loại — chạy `walkSegments` N lần, mỗi lần một giá trị, gộp kết quả.** Nhân chi phí và ngân sách theo N; ba chỗ gộp kết quả (`decide`, `secretOutsideRoots`, H1) phải biết về lặp.
- **Loại — bỏ biến vòng ra khỏi `bad` và đặt vào `env` như phép gán.** `env` chỉ nhận đường dẫn tuyệt đối và dựa vào `trusted` (thứ tự đoạn) không hợp với thân vòng.

## Tiêu chí chấp nhận

Test ở `test/contract/99-path-permissions.contract.mjs` (khối mới "biến vòng for", bảng tham số hoá), seam `bd(cmd, { tool, opts, extra })`; `T` trong root, `OUT` ngoài mọi root, `O` chỉ ghi, `D` chỉ đọc.

- [ ] **AC1.1** — Given full + bypass, Bash When `for c in a b; do rm <T>/$c.out; done`, `SP=<T> && for c in 1 2 3; do bash "$SP/runcase.sh" $c > "$SP/$c.out" 2>&1; done`, `for c in a b; do rm "$c"; done` (cwd = project) Then `null`; `for c in a b; do rm <OUT>/$c.out; done`, `for c in a b; do rm <D>/$c.out; done`, `SP=<OUT> && for … > "$SP/$c.out" …; done` Then `deny`; thân vòng nhiều lệnh (`cp`, `echo >`, `$( )` chứa `$c`) và vòng lồng hai tên khác nhau (`for a in 1 2; do for b in x y; do rm <T>/$a/$b; done; done`) cũng giải mỗi tên.
- [ ] **AC1.2** — Given giá trị có `..` (`for c in .. a; do rm <T>/$c/x; done`), hoặc một giá trị rơi ra ngoài root (`for c in a ..; do rm <T>/$c/x; done`) Then `deny`; mọi giá trị phải an toàn thì mới `null`.
- [ ] **AC1.3** — Given danh sách không literal hoặc vòng ở dạng không nhận: `for c in $X; do rm <T>/$c; done`, `for c in *.log`, `for c in $(ls)`, `for c in {a,b}`, `for c in a,b`, `for c in "a b"`, `for c in; do …`, `for c; do …`, 257 giá trị, `for c in -t …` Then `ask` (như cũ).
- [ ] **AC1.4** — Given `$c` ngoài tầm nhìn hoặc bị đổi: dùng trước vòng (`rm <T>/$c; for c in a; do :; done`), sau `done`, trong chuyển hướng của `done` (`done > <T>/$c.out`), gán lại trong thân (`for c in a; do c=/etc; rm <T>/$c; done`), hai vòng cùng tên, `for c in a; do read c; …` Then `ask`.
- [ ] **AC1.5** — Given giá trị vòng là tên lệnh: `for c in rm ls; do $c <OUT>/x; done`, `for c in rm; do $c <OUT>/x; done`, `sudo $c`, `env $c`, `timeout 5 $c` Then `ask` khi có ≥ 2 giá trị hoặc đích trong root; một giá trị `rm` ghi ngoài root thì `deny` (đúng là lệnh `rm`); không bao giờ `null`; lỗ brace có từ trước (`{rm,ls} <OUT>/x` → `null`) không bị mở rộng và không bị sửa ở request này.
- [ ] **AC1.6** — Given full + bypass, PowerShell When `$SP = '<T>'; foreach ($x in 'a','b') { Remove-Item "$SP\$x.out" }`, `foreach ($x in 'a', 'b') { Remove-Item "<T>/$x.out" }` (nhiều lệnh trong khối, xuống dòng) Then `null`; cùng dạng với `<OUT>` hoặc `<D>` Then `deny`; `foreach ($x in 'a','..') { Remove-Item "<T>/$x/f" }` Then `deny`; danh sách ngoài dạng (`@('a','b')`, `1..3`, `$list`, `(Get-ChildItem)`, `'a' 'b'`, giá trị có `:`), dùng `$x` ngoài khối, gán lại `$x` trong khối, `ForEach-Object`, lệnh ngoài danh sách được giải biến trong khối (`Get-Date`, `iex`) Then `ask` (như cũ).
- [ ] **AC1.7** — Given tên file bí mật nằm trong danh sách When `for c in .env a; do cat <OUT>/$c; done` Then `ask` (nhóm giá trị được đọc như brace khi dò bí mật ngoài root, như `cat <OUT>/{.env,a}`); `cat <T>/$c` trong root Then `null`.
- [ ] **AC2.1** — Given thay đổi trên When chạy `--only hook`, `--only path-permissions`, `--only spec` Then xanh; không `ask`/`deny` cũ nào thành `null` ngoài các ca AC1.1.
- [ ] **AC2.2** — Given tài liệu When đọc `docs/specs/hooks-gates/spec.md` Then R23 nêu D1–D7; README.md và README_VI.md khớp.
- [ ] **AC2.3** — Given các sửa trên When `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` trên bản `git clone` sạch Then build và lock khớp (bump patch kế tiếp), `npm test` exit 0.

## Thiết kế

### Chỗ cần sửa

- **`core/hooks/scripts/guard-bash.mjs`**:
  - `leadInfo`: nhận header `for NAME in …`, trả `loop` và không đẩy hai tên header vào `extra`.
  - `walkSegments`: tìm `do`…`done` đúng cấp, kiểm D2/D4, dựng `loopAt[i]`, đưa vào `state.loop`; kiểm `opaque` tên lệnh trên từ giải không có `loop` (D6); truyền `loop` cho lệnh con.
  - `resolveWord`: cả hai dialect nhận giá trị từ `state.loop` (không đòi đường dẫn tuyệt đối).
  - `scanWords`: đoạn ghi thêm `kd`, `pn`, `km`; `psUnsafe`/`prepareWalk`: bản ảo của lệnh PowerShell (D7); `classifyTarget`: nhóm đánh dấu (D5); `walked` trong `decide`: truyền biến vòng sang lần quét thô PowerShell.
- **Test:** `test/contract/99-path-permissions.contract.mjs` (khối mới).
- **Tài liệu:** `docs/specs/hooks-gates/spec.md` (R23, Lịch sử), `README.md`, `README_VI.md`, `core/.manifest.json`, `plugins/_versions.lock.json`.
- **Không đổi:** `braceExpand`, `confineSegment`, `unwrap`, `parse()`, `summarize`, `guard-files.mjs`, câu `reason` (R21), PowerShell (D7).

### Thứ tự thực thi (gợi ý cho plan)

1. Bash + nhóm đánh dấu (TDD) → 2. PowerShell (TDD) → 3. spec/README → 4. version, build, lock, `npm test` trên clone sạch.

## Ảnh hưởng spec
- hooks-gates: đổi R23

## Ngoài phạm vi và anti-goal

- PowerShell `ForEach-Object`, `%`, `while`; `while read`, `for` kiểu C `((…))`, `select`; danh sách có biến, glob, thế lệnh; giải `$c` ngoài thân vòng.
- Lỗ brace làm tên lệnh (`{rm,ls} <ngoài> x` → `null`) có từ trước: không sửa ở đây, báo thành follow-up.
- Anti-goal: không biến `ask`/`deny` có sẵn thành `null` ngoài ca AC1.1; không làm lỏng root.

## Ràng buộc

- Zero-dependency, Node built-ins; không thêm lời gọi git ở đường nóng; hook fail-open ngoài full + bypass.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment chỉ ghi lý do (AGENTS.md).
- `npm test` chạy trên bản `git clone` sạch (repo chính bật `mode: full`).
- Nền là nhánh `claude/laughing-tu-69e18d` chưa merge: merge request này sau nhánh đó (hoặc cùng lúc) để tránh conflict ở `guard-bash.mjs`, spec R23, manifest và lock.

## Không đổi (bugfix)

- Mọi lệnh không có header `for NAME in <literal>` đúng cấu trúc D1 giữ kết quả; mọi vòng `for` ngoài D1–D4 vẫn `ask` như cũ.
- Chế độ `ask` giữ kết quả (giải biến chỉ ảnh hưởng `full`).

## Kiểm thử

- Bảng tham số hoá, một hàng một hành vi; hàng đỏ trước khi sửa và hàng đối chứng; tên có ID AC.
- Trước khi báo xong, chạy `decide` thật bằng script tạm cho mọi ca AC1.1–AC1.5 và trường hợp xấu nhất về chi phí (256 giá trị × thân nhiều từ).

## Để builder quyết

- Tên biến nội bộ, cách gom hàng test, ngưỡng độ dài giá trị.

## Rủi ro và câu hỏi mở

- **[Inference]** Nhóm brace trong text đi qua `braceCache`/`BRACE_BUDGET`: 256 giá trị × 3 lần phân loại (read/write/delete) × nhiều từ có thể hết ngân sách → `unknown` (hỏi), đúng hướng an toàn nhưng có thể hỏi oan với thân vòng rất dài; sẽ đo ở bước kiểm thử.
- **PowerShell là phần rủi ro nhất:** sửa bộ lọc `psUnsafe` và `scanWords` dùng chung; hàng đối chứng (mọi lệnh PowerShell có `{ } ( =` ngoài dạng vòng giữ `ask`) phải xanh, và reviewer chạy `decide` thật.
- **Lỗ có từ trước:** `{rm,ls} <ngoài root> x` → `null` (tên lệnh là nhóm brace không khớp `rm`). Request này không mở rộng nó (D6) nhưng cũng không đóng; đề xuất request riêng.
- **[Unverified]** Hành vi bash thật của `done > "$c.out"` (chuyển hướng chạy trước vòng) ghi theo hiểu biết bash chung; sẽ đo bằng bash thật nếu có ở môi trường.
- Phụ thuộc nhánh nền chưa merge; merge sau cùng nhánh `node -e` vẫn có thể conflict chữ ở manifest/lock.
