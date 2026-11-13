# Thiết kế: PowerShell Set-Content/Out-File/Add-Content có cờ có giá trị đứng trước đường dẫn
- Ngày: 2026-11-13
- Trạng thái: draft
- Requirement: không có

## Vấn đề và lý do

Ở chế độ `full` hiệu lực (phiên `bypassPermissions` + `mode: "full"` + `.claude/aip-gate.json` không bị git theo dõi), `guard-bash` nhốt thao tác ghi trong các root. Request `2026-11-13-hook-fullpaths-followups` để lại lỗ này ngoài AC; người dùng chọn làm tiếp. Ghi ở `docs/specs/hooks-gates/spec.md` R24 phần "Giới hạn đã biết". Ký hiệu: `D` có `read`, `O` có `read`+`write`, `T` có đủ ba quyền, `OUT` ngoài mọi mục.

Đã đo trên master 39427638 bằng script tạm (không sửa code), tool `PowerShell`, full + bypass:

| Lệnh | Kết quả đo | Mong đợi |
|---|---|---|
| `Set-Content -Encoding utf8 OUT/x -Value y` | `null` | `deny` |
| `Out-File -Encoding utf8 OUT/x` | `null` | `deny` |
| `Add-Content -Value y OUT/x` | `null` | `deny` |
| `Set-Content -ErrorAction Stop OUT/a x` | `null` | `deny` |
| `Set-Content -Encoding utf8 D/x -Value y` | `null` | `deny` |
| `Out-File -Append -Encoding utf8 OUT/x`, `Out-File -Width 80 OUT/x`, `Set-Content -Stream s OUT/x y`, `Set-Content -Include a OUT/x y` | `null` | `deny` |
| `Set-Content -Enc utf8 OUT/x -Val y` (viết tắt tham số) | `null` | `deny` |
| `Set-Content -Path O/x OUT/y` (`OUT/y` là Value, không phải đích) | `deny` | `null` |

Nguyên nhân: nhánh `FIRST_ONLY` của `writeTargets` (`guard-bash.mjs` ~405) lấy `all.slice(0, 1)` của mọi đối số vị trí. Cờ có giá trị (`-Encoding`) bị bỏ qua vì bắt đầu bằng `-`, nhưng giá trị của nó (`utf8`) lại thành đối số vị trí đầu và bị coi là đích; đường dẫn thật đứng sau không được kiểm. `PS_VALUE_FLAGS` (bỏ giá trị cờ) hiện chỉ áp cho `LAST_ONLY` (`cp`/`copy`/`Copy-Item`) và `MOVE_CMDS`. Ngược lại, khi đã gọi tên `-Path`/`-FilePath`, đối số vị trí còn lại là Value nhưng vẫn bị coi là đích (dòng cuối bảng).

## Quyết định đã chốt

Người dùng giao hướng cho agent (yêu cầu của phiên cha: "bỏ giá trị của cờ có giá trị cho cả nhóm `FIRST_ONLY`, cân nhắc kiểm mọi đối số vị trí như `allPos`"). Mọi dòng dưới là **quyết định của agent**, nêu nổi bật để người duyệt sửa.

- **D1 — bỏ giá trị của cờ có giá trị cho `Set-Content`/`Out-File`/`Add-Content`.** Trong nhánh `WRITE_CMDS` của `writeTargets`, với tên thuộc `FIRST_ONLY` phân loại mỗi cờ (không phân biệt hoa thường, bỏ `-`, tách `:`) theo hai danh sách đầy đủ tên:
  - có giá trị (bỏ cờ và đối số kế; dạng `-X:giá-trị` chỉ bỏ cờ): `Value`, `Encoding`, `Stream`, `Width`, `InputObject`, `Filter`, `Include`, `Exclude`, `Credential`, và các tham số chung `ErrorAction`/`ea`, `WarningAction`/`wa`, `InformationAction`/`infa`, `ErrorVariable`/`ev`, `WarningVariable`/`wv`, `InformationVariable`/`iv`, `OutVariable`/`ov`, `OutBuffer`/`ob`, `PipelineVariable`/`pv`;
  - công tắc (chỉ bỏ cờ): `Force`, `NoNewline`, `Append`, `NoClobber`, `PassThru`, `AsByteStream`, `WhatIf`, `Confirm`/`cf`, `UseTransaction`, `Verbose`/`vb`, `Debug`/`db`.
  Danh sách mới, tách khỏi `PS_VALUE_FLAGS` (dùng cho `Copy-Item`/`Move-Item`, nơi `-Value`/`-Encoding` không tồn tại), để không đổi parse của hai lệnh đó. Từ vòng ba logic này nằm trong hàm `psWriteCandidates` (D2–D4), không còn trong vòng lặp cờ của `writeTargets`; dạng dính `-X:giá-trị` của cờ đã biết bỏ cả token.
- **D2 — mọi token trừ tên cờ đã biết là ứng viên đích (cờ lạ, viết tắt, dạng dính, đối số vị trí).** Cờ không thuộc hai danh sách (vd `-Enc`, `-Val`, `-Foo`, `-Lit`) không biết có nhận giá trị hay không nên là ứng viên như một đường dẫn tương đối (vô hại trong root); dạng dính `-X:val` với X không thuộc hai danh sách (gồm cờ đường dẫn viết tắt/alias `-Lit:`, `-FilePa:`, `-PSPath:`) đóng góp `val`. Vai `write`, không thêm `delete`. Chế độ kiểm hết: token bắt đầu/kết thúc bằng dấu phẩy, có backtick hoặc đúng `--` (bị bỏ; sau `--` PowerShell có thể đọc `-X:giá-trị` thành đường dẫn) làm ranh giới token mơ hồ; vòng bốn thêm một điều kiện cùng nguyên tắc: có cờ có giá trị đã biết (đứng trơn hoặc `-X:` bỏ trống; cờ lạ dạng `-X:` cũng tính vì có thể là viết tắt như `-Val:`) mà token kế bắt đầu bằng `-` (PowerShell 5.1 lấy token đó làm giá trị, hook không phân biệt được với cờ thật). Trong chế độ này chỉ tên cờ đã biết đứng trơn bị bỏ và không cờ nào nuốt giá trị. Hook không thấy nháy nên không đoán. Đổi lại có thể hỏi/chặn thừa: `Set-Content -Enc utf8 O/x OUT/y` (OUT/y là Value) bị `deny`. Chấp nhận (anti-goal của hook là không bỏ sót).
- **D3 — cờ đường dẫn không còn chiếm slot; token kế của nó luôn là ứng viên.** Bản trước coi đối số vị trí đứng sau `-Path` là Value; re-review trên Windows PowerShell 5.1 thật cho thấy 5.1 đảo vai đối số vị trí khi có tham số động (`-NoNewline`, `-Encoding:x`, `-Stream:s`) nên `Set-Content -NoNewline O/x OUT/y` ghi vào `OUT/y`. Nay cờ đường dẫn trơn (`-Path`/`-LiteralPath`/`-FilePath`/`-PSPath`) chỉ bị bỏ, token kế luôn là ứng viên (kể cả bắt đầu bằng `-`, trừ dạng dính `-X:val` vì có thể là cờ thật đứng sau một cờ giả trong nháy); `--` bị bỏ và bật chế độ kiểm hết (D2). Hệ quả: `Set-Content -Path O/x OUT/y` bị `deny` (trước đây `null`).
- **D4 — chỉ giá trị của cờ có giá trị đứng trơn là nội dung.** `-Value x`, `-Encoding utf8`, `-ea Stop`: bỏ cờ và token kế khi token kế không bắt đầu bằng `-` (token kế bắt đầu bằng `-` thì cả lệnh vào chế độ kiểm hết của D2; dạng `-X:` kết thúc bằng dấu hai chấm cũng vậy; dạng `-X:val` bỏ cả token). Công tắc chỉ bỏ cờ (`-Force: $false` nuốt `$false` nếu không bắt đầu bằng `-`). Đối số vị trí thứ hai trở đi KHÔNG còn được miễn: `Set-Content O/x OUT/y` bị `deny` (người dùng duyệt đổi AC1.2 ở vòng ba; lý do: 5.1 đảo vai nên không biết token nào là Path). `Out-File O/x utf8` vẫn `null` vì `utf8` là đường dẫn tương đối trong project. Giá trị `$var` dưới cờ có giá trị đứng trơn bị nuốt nên không sinh `ask`; `$var` ở vị trí ứng viên vẫn là đường dẫn chưa biết → `ask`.
- **D5 — kiểm cấu hình hook (R18) không đổi.** `allPos` là mảng ứng viên; giá trị của cờ có giá trị bị bỏ nên `Set-Content -Value .claude/aip-gate.json x` (nội dung, không phải đích) không bị hỏi nhầm; ca đích thật (`Set-Content -Encoding utf8 .claude\aip-gate.json x`, `Set-Content -Value x .claude\aip-gate.json`, đã có ở `99-hook-popup`) vẫn `ask`.
- **D6 — áp bất kể tool.** Tên `Set-Content`/`Out-File`/`Add-Content` chỉ tồn tại ở PowerShell, và nhánh cờ đường dẫn hiện tại cũng không kiểm `msys`; nên D1–D3 không điều kiện hoá theo `msys`, để chuỗi lồng `pwsh -Command "…"` (đọc `msys=true`) cũng được hưởng.
- **D7 — không thêm câu hỏi mới, không đổi chữ ký.** `classifyPath`/`grantsOf` giữ nguyên; kết quả là `deny` (thiếu `write`) hoặc `ask` (đường dẫn chưa biết) qua câu có sẵn, đã qua `shapeOk` của `99-hook-popup`.
- **D8 — version.** `core/.manifest.json` 1.33.14 → 1.33.19 (1.33.15 đến 1.33.18 đã bị khoá trước các lần sửa sau review cuối; cổng version từ chối lock khi nội dung đổi mà version giữ nguyên), `npm run build`, `node cli/lib/versions.mjs --lock`.

## Hướng đã cân nhắc

**Chọn — danh sách cờ riêng cho nhóm `FIRST_ONLY` trong `writeTargets` + nhánh cờ lạ thận trọng (D1–D3).** Đúng nguyên nhân, diff nhỏ, không đổi `Copy-Item`/`Move-Item`.

**Loại 1 — dùng chung `PS_VALUE_FLAGS` cho cả nhóm.** Danh sách đó thiếu `Value`, `Encoding`, `Stream`, `Width`, `InputObject`, công tắc; mở rộng thì gộp tham số của hai nhóm cmdlet khác nhau vào một regex.

**Loại 2 — kiểm mọi đối số vị trí như `allPos` cho mọi ca.** Nay là hướng đã chọn (vòng ba, D2–D4), trừ giá trị của cờ có giá trị đứng trơn. Đánh đổi: hỏi/chặn thừa khi Value vị trí là đường dẫn tuyệt đối ngoài root hoặc có `..`.

**Loại 3 — khớp tiền tố tham số đúng như PowerShell (`-Enc` → `Encoding`).** Chính xác hơn D2 nhưng cần bảng đầy đủ tham số từng cmdlet theo từng phiên bản PowerShell và xử lý mơ hồ; vượt phạm vi. D2 thận trọng hơn.

## Tiêu chí chấp nhận

Test thêm vào `test/contract/99-path-permissions.contract.mjs` (cùng seam `bd`/`expectAll` và `D`/`O`/`T`/`OUT`, `tool: 'PowerShell'`, full + bypass); gom thành bảng tham số hoá.

- [ ] **AC1.1** — Given full, PowerShell When `Set-Content -Encoding utf8 OUT/x -Value y`, `Out-File -Encoding utf8 OUT/x`, `Add-Content -Value y OUT/x`, `Set-Content -ErrorAction Stop OUT/a x`, `Set-Content -ea Stop OUT/x y`, `Set-Content -Encoding:utf8 OUT/x y`, `Out-File -Append -Encoding utf8 OUT/x`, `Out-File -Width 80 OUT/x`, `Set-Content -Stream s OUT/x y`, `Set-Content -Include a OUT/x y`, `Set-Content -Force OUT/x y`, `Set-Content -Encoding utf8 D/x -Value y` Then `deny`; cùng mẫu với `O/x` và `T/x` Then `null`.
- [ ] **AC1.2** — Given full, PowerShell When `Set-Content O/x OUT/y`, `Set-Content -Path O/x OUT/y`, `Set-Content -FilePath:O/x OUT/y` Then `deny` (vòng ba: 5.1 đảo vai đối số vị trí nên đối số vị trí thứ hai không còn được miễn); `Out-File O/x utf8`, `Set-Content -Value OUT/y O/x`, `Set-Content -Path O/x -Encoding utf8 -Value OUT/y` Then `null` (Value/Encoding đứng trơn là nội dung, `utf8` là đường dẫn tương đối); `Set-Content OUT/x y`, `Set-Content -Path OUT/x y` Then `deny` (đích thật vẫn bị chặn).
- [ ] **AC1.3** — Given full, PowerShell When `Set-Content -Enc utf8 OUT/x -Val y`, `Set-Content -Foo a OUT/x y` Then `deny` (cờ lạ: mọi đối số vị trí là ứng viên đích); `Set-Content -Enc utf8 O/x y` Then `null`.
- [ ] **AC1.4** — Given `mode: ask`, phiên thường When `Set-Content -Encoding utf8 .claude\aip-gate.json x`, `Out-File -Encoding utf8 .claude\settings.json`, `Set-Content -Value x .claude\aip-gate.json` Then `ask` (R18 không đổi); `Set-Content -Value .claude\aip-gate.json x` Then `null` (nội dung, không phải đích).
- [ ] **AC2.1** — Given suite hiện có When chạy `94-permission-modes`, `99-hook-popup`, `99-path-permissions`, `90-hooks`, `97-audit-mustfix` Then xanh, gồm mọi ca `Copy-Item`/`Move-Item`/`cp`/`mv` đã có (D1 chỉ chạm nhóm `FIRST_ONLY`); mọi `reason` `ask`/`deny` mới qua `shapeOk` của `99-hook-popup.contract.mjs`.
- [ ] **AC3.1** — Given tài liệu When đọc Then `docs/specs/hooks-gates/spec.md` R24 mô tả quy tắc cờ có giá trị của `Set-Content`/`Out-File`/`Add-Content` (D1–D4) và bỏ mục đó khỏi "Giới hạn đã biết", kèm dòng Lịch sử; `README.md` và `README_VI.md` (mục Hooks, đoạn `fullPaths`) khớp spec; các pin `test/content` xanh.
- [ ] **AC3.2** — Given các sửa trên When `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` Then xanh; `core/.manifest.json` tăng từ 1.33.14.

## Thiết kế

### Chỗ cần sửa

- **`core/hooks/scripts/guard-bash.mjs`**: hai hằng danh sách cờ (có giá trị, công tắc) cạnh `PS_VALUE_FLAGS`; trong `writeTargets` thêm nhánh phân loại cờ cho `FIRST_ONLY` và đổi dòng `pos = FIRST_ONLY.has(name) ? all.slice(0, 1) : all` theo D2/D3; cập nhật comment ở dòng đó (comment cũ nói đúng nguyên nhân chưa sửa).
- **Test**: `test/contract/99-path-permissions.contract.mjs` thêm bảng ca (AGENTS.md Testing); không sửa test cũ.
- **Tài liệu**: `docs/specs/hooks-gates/spec.md` (R24 + Lịch sử), `README.md`, `README_VI.md`; `core/.manifest.json` + `plugins/_versions.lock.json`.
- **Không đổi**: `classifyPath`/`grantsOf`/`fullPaths`, `guard-files`, `gate-config.mjs`, `Copy-Item`/`Move-Item`/`rm`, chế độ `ask`.

## Ảnh hưởng spec
- hooks-gates: đổi R24

## Ngoài phạm vi và anti-goal

- Không làm: `Copy-Item -Dest` viết tắt, alias `ri`/`mi`/`cpi`, brace expansion `rm T/{..,x}/f`, `cp … -S .bak` (còn ở "Giới hạn đã biết" của R24; sẽ do phiên khác xử lý tuần tự vì cùng sửa `guard-bash.mjs`).
- Không khớp tiền tố tham số theo PowerShell thật (Loại 3).
- Anti-goal: không làm `Set-Content` hợp lệ trong root (`Set-Content -Encoding utf8 f x`) bị hỏi; không biến giá trị của cờ có giá trị đứng trơn thành đích kiểm.

## Ràng buộc

- Zero-dependency; hook fail-open với lỗi nội bộ; không thêm lời gọi git ở đường nóng.
- Chỉ tác động khi full hiệu lực (kiểm root) hoặc theo R18 ở mọi chế độ (D5 chỉ thu hẹp hỏi nhầm).
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment theo AGENTS.md.
- Không push, không merge khi người dùng chưa duyệt G3; không `Co-Authored-By` trong commit.

## Kiểm thử

- AC1.x: bảng ca (lệnh, kết quả) qua `guard-bash.decide`, `D`/`O`/`T`/`OUT` tạo bằng `mkdtemp` dưới `<tmpdir>/aip-…` như test hiện có.
- AC2.1: chạy nguyên các suite cũ, không thêm test lặp.
- AC3.1: `test/content` chỉ ghim hợp đồng vận hành đã có; không ghim đoạn văn.
- Trước G3, reviewer cuối chạy thử `decide` thật ở full bằng script tạm trong scratchpad với các ca của AC (không chỉ đọc code), theo bài học của request trước; script dò đã dùng khi lập design nằm ở scratchpad của phiên.

## Để builder quyết

- Tên hằng/hàm nội bộ; cách tách phần phân loại cờ thành hàm nhỏ.
- Gom ca mới vào một bảng hay chia theo AC miễn không lặp ca.

## Quyết định khi thực thi

- Review cuối tìm được hồi quy so với master (ca master `deny`, bản đầu của D3 cho `null`) và một lỗ cùng loại; sửa trong nhánh `FIRST_ONLY` của `writeTargets`, mở rộng D2/D3: `namedPath` chỉ áp khi cờ đường dẫn nhận được giá trị và chỉ các đối số vị trí sau nó là Value; token có dấu phẩy ở đầu/cuối (`-Path x, y`, `-Value a, b`) làm mọi đối số vị trí là ứng viên đích (chấp nhận hỏi/chặn thừa: `Set-Content -Path O/x -Value a, b` vẫn `null` vì `b` là đường dẫn tương đối trong project). Ca thêm vào bảng AC1.2; không đổi AC.
- Vòng sửa thứ hai (re-review chạy thật `decide` so với master và Windows PowerShell 5.1): bỏ ý "sau `--` hết cờ" vì `--` có thể nằm trong nháy hoặc backtick, hoặc bị công tắc động của 5.1 (`-NoNewline`) làm mất tác dụng, và `-Path -- X` đưa `X` vào Path. Nay `--`, token có backtick, cờ đường dẫn xuất hiện hai lần và giá trị cờ đường dẫn bắt đầu bằng `-` đều đặt cờ lạ (D2); cờ đường dẫn vẫn được đọc sau `--`; token sau `--` cũng là đối số vị trí. Thêm: tách mảng ở cuối `writeTargets` tách cả token chỉ có dấu phẩy ở đầu/cuối (`,OUT/y`), lỗ có sẵn ở master, áp cho mọi lệnh PowerShell (Remove-Item, Copy-Item…) theo hướng chặt hơn.
- Vòng ba (người dùng duyệt, kèm đổi AC1.2): re-review lần hai (fuzz 116.834 lệnh so với master trên Windows PowerShell 5.1 thật) còn 17 hồi quy: cờ có giá trị trong nháy hoặc sau dấu phẩy nuốt nhầm token kế bắt đầu bằng `-`; dạng dính của cờ đường dẫn thật bị nuốt làm giá trị; 5.1 đảo vai đối số vị trí khi có tham số động; cờ đường dẫn viết tắt/alias dạng dính (`-PSPath:`, `-Lit:`, `-File:`) mất giá trị; đường dẫn trong nháy bắt đầu bằng `-`. Thay cơ chế `unknownFlag`/`namedAt`/`afterDashes`/`namedPath` bằng hàm `psWriteCandidates` trong `guard-bash.mjs`: mọi token trừ tên cờ đã biết là ứng viên (D2–D4). Re-review cuối trước vòng bốn (fuzz 134.862 lệnh so với master trên Windows PowerShell 5.1 thật) còn 53 hồi quy và 8 ca có sẵn từ master, đều cần cố ý né hook: lớp A (cờ có giá trị dạng `-X:` bỏ trống rồi token bắt đầu bằng `-`: `Set-Content -Value: -Encoding OUT/x`), lớp Z (cờ có giá trị đứng trơn rồi tên cờ mà 5.1 lấy làm giá trị: `Set-Content -ov -Encoding OUT/x y`) và 3 ca tên cờ đứng trong nháy (`Add-Content -NoNewline "-OutVariable" D/x`).
- Vòng bốn (người dùng duyệt): thêm điều kiện cho chế độ kiểm hết (D2): cờ có giá trị đã biết (đứng trơn hoặc `-X:` bỏ trống; cờ lạ dạng `-X:` cũng tính) mà token kế bắt đầu bằng `-`. Chỉ làm nhiều ca bị chặn hơn, không bỏ ca nào. Ca thêm vào bảng AC1.2 và AC1.4; không đổi AC. Ghi vào "Giới hạn đã biết" của R24: tên cờ đã biết nằm trong nháy (hook không thấy nháy), và chặn thừa nhỏ `-NoNew: $false` (viết tắt công tắc dạng dấu hai chấm cuối: `$false` thành ứng viên chưa biết nên hỏi).
- Ruling hoãn cho G3

## Rủi ro và câu hỏi mở

- [Inference] D2–D4 hỏi/chặn thừa khi đối số vị trí thứ hai (Value vị trí) là đường dẫn tuyệt đối ngoài root hoặc có `..`; hiếm trong thực tế, và hook không phân biệt được Value với đích (5.1 đảo vai).
- [Inference] Danh sách tham số của `Set-Content`/`Out-File`/`Add-Content` lấy từ hiểu biết về Windows PowerShell 5.1/PowerShell 7; hành vi ghi file đã được re-review kiểm trên Windows PowerShell 5.1 thật (chạy lệnh trong thư mục tạm), chưa kiểm PowerShell 7 (`pwsh`); tham số thiếu rơi vào D2 (an toàn).
- [Inference] Hành vi khi `-Path` đã gọi tên và còn đối số vị trí (vòng ba không còn coi là Value), việc `--` mất tác dụng với công tắc động và việc 5.1 đảo vai đối số vị trí, đã kiểm trên Windows PowerShell 5.1 thật; chưa kiểm PowerShell 7.
