# Thiết kế: bốn lỗ ghi còn lại của guard-bash ở chế độ full
- Ngày: 2026-11-16
- Trạng thái: approved
- Requirement: không có

## Vấn đề và lý do

Request `2026-11-13-hook-fullpaths-followups` (core 1.33.14) và `2026-11-13-hook-ps-write-flags` (core 1.33.19) hoãn bốn lỗ của `core/hooks/scripts/guard-bash.mjs`; chúng đã ghi ở `docs/specs/hooks-gates/spec.md` R18 và R24 phần giới hạn và có từ master. Người dùng chọn làm tiếp. Ký hiệu: `T` đủ ba quyền, `O` có `read`+`write`, `D` chỉ `read`, `OUT` ngoài mọi root. Kết quả "hiện tại" là đo ở bước đọc code (chưa chạy lại script thử; reviewer cuối sẽ chạy `decide` thật).

1. **`Copy-Item` có cờ lạ hoặc viết tắt.** `Move-Item` đã có nhánh `blurred` cho cờ lạ (mọi đối số vị trí cần `delete`+`write`), `Copy-Item` thì không: `Copy-Item -Dest D/b x`, `-De`, `-D` bị coi `-Dest` là cờ bỏ qua, `D/b` rơi vào slot `Path` (nguồn, chỉ `read`) nên ghi vào `D` chỉ read mà qua. `Copy-Item -Dest .claude\settings.json x` cũng ghi file cấu hình hook mà `writesGuardConfig` bỏ qua vì đích bị gán vai `read`; ở các ca bị hỏi vì lý do khác, dòng "Lệnh gồm" nói "đọc" dù lệnh ghi.
2. **Alias `cpi`, `mi`, `ri` không nằm trong `WRITE_CMDS`.** `cpi T/a D/b`, `mi T/a OUT/b`, `ri OUT/a` đều `null`.
3. **Brace expansion không được coi là glob** (`GLOB = /[*?[]/`). `rm T/{..,x}/f` và `rm T/.{.,x}/d/f` mở rộng thành `..` ở bash nhưng hook coi đó là đường dẫn trong `T`, nên `null`.
4. **Giá trị của `cp -S` / `--suffix`.** `cp O/x D/b -S .bak`: `.bak` được tính là đối số vị trí cuối nên là "đích ghi", còn `D/b` bị coi là nguồn chỉ cần `read`; kết quả `null` dù ghi vào `D`. Tương tự `--suffix .bak` (tách rời; `--suffix=.bak` dính thì đã đúng).

## Quyết định đã chốt

- **K1 — `Copy-Item` dùng danh sách switch biết trước** (người dùng chọn ở bước làm rõ, thay vì coi mọi cờ lạ như `Move-Item`, và thay vì khớp tiền tố tham số). Hệ quả nêu rõ: cờ lạ thật (`-Dest`, `-De`, `-D`) làm mọi đối số vị trí cần cả `read` lẫn `write`, nên `Copy-Item -Dest O/b D/a` (nguồn trong `D` chỉ read) bị `deny` oan; đó là cái giá của việc không biết cờ lạ có nhận giá trị hay không.

### Quyết định của agent

Người dùng chỉ trả lời K1; mọi dòng dưới là **quyết định của agent**, nêu nổi bật để người duyệt sửa.

- **D1 — switch đã biết của Copy-Item/Move-Item.** Hằng `PS_COPY_SWITCH` = `recurse`, `force`, `container`, `passthru`, `whatif`, `confirm`, `usetransaction`, `verbose`, `debug` (so khớp tên đầy đủ, không phân biệt hoa thường; dạng `-X:giá-trị` cũng tính, bỏ cả token). Cờ có giá trị đã có (`PS_VALUE_FLAGS`) giữ nguyên. Mọi cờ `-X` còn lại là "lạ" → `blurred`. Viết tắt của switch (`-Rec`, `-Fo`) cũng là cờ lạ nên bị thận trọng; ghi vào R24 phần giới hạn.
- **D2 — `blurred` dùng chung cho copy và move, vai theo lệnh.** Nhánh `blurred` hiện chỉ có `Move-Item`; mở sang `LAST_ONLY` (copy/cp/copy-item/cpi): `needs` là `['read','write']` cho mọi đối số vị trí (move giữ `['delete','write']`), không gán slot. Giá trị dính (`-Dest:X`) vẫn thành một đích với cùng vai. Hệ quả có chủ đích cho `Move-Item`: `Move-Item -Force T/a O/b` thôi bị coi `blurred` (trước đây `deny` oan vì `-Force` là cờ lạ) vì danh sách switch dùng chung; ghi vào R24.
- **D3 — dòng "Lệnh gồm" ưu tiên `ghi`.** `summarize` chọn động từ: có `delete` → "xoá"/"xoá hoặc ghi"; không thì có `write` → "ghi vào"; còn lại "đọc". Trước đây `read` đứng trước `write` nên đích `read`+`write` được nói là "đọc". Không đổi câu `reason` (R21), chỉ động từ trong dòng "Lệnh gồm".
- **D4 — alias PowerShell.** Thêm `cpi` (cùng nhóm `copy-item`: `WRITE_CMDS`, `LAST_ONLY`, `COPY_MOVE`), `mi` (`MOVE_CMDS`, `COPY_MOVE`), `ri` (`DELETE_CMDS`). Không thêm alias khác (`sc`, `ac`, `ni`, `clc`…): ngoài yêu cầu, ghi vào R24 phần giới hạn. `ri` ở Bash là công cụ đọc tài liệu Ruby nhưng hook coi mọi `ri <đường dẫn tuyệt đối ngoài root>` là xoá; chấp nhận hỏi/deny thừa vì hiếm gặp.
- **D5 — brace expansion chỉ ở Bash.** Trong `classifyTarget`, khi `msys` và đường dẫn có nhóm `{a,b}` (có dấu phẩy ở cấp ngoài cùng, lồng được), mở rộng thành các đường dẫn con (tối đa 256, vượt thì `unknown`) rồi phân loại từng cái bằng chính `classifyTarget` (nên glob/`..` trong từng nhánh vẫn xét); kết quả tổng theo thứ tự `blocked` > `outside` > `unknown` > còn lại, nên `rm T/{..,x}/f` ra `deny` như `rm T/../f` hiện tại. Dải `{1..3}`, `{a..c}` và `{x}` không dấu phẩy không sinh `..` nên bỏ qua (coi như một nhánh). PowerShell không mở rộng brace, giữ nguyên. Không bóc nháy (hook không biết `"T/{..,x}/f"` trong nháy bash không mở rộng): hỏi/deny thừa còn hơn bỏ sót. Không mở rộng brace trong kiểm tên file của R18 (`cp {settings,x}.json .claude/` vẫn là giới hạn đã biết).
- **D6 — `-S` / `--suffix` bỏ giá trị (Bash, `cp`/`mv`).** Trong vòng đối số, trước khi bỏ qua cờ chung: `--suffix` đứng trơn hoặc cờ bó kết thúc bằng `S` (`-S`, `-bS`) thì bỏ luôn token kế (giá trị); `--suffix=X` và `-SX` dính đã bị bỏ như cờ. Chỉ Bash: ở PowerShell `-S` là tiền tố tham số.
- **D7 — không thêm câu hỏi mới, không đổi chữ ký.** Mọi `ask` dùng câu có sẵn (`CONFIG_TEXT`, `FULL_PATH_TEXT`, `READ_OUTSIDE_TEXT`); ca R21 (`shapeOk` của `99-hook-popup`) giữ.
- **D8 — version.** `core/.manifest.json` 1.33.19 → 1.33.20 (sửa hành vi hook), `npm run build`, `node cli/lib/versions.mjs --lock`.

## Hướng đã cân nhắc

**Chọn — sửa tại chỗ trong `writeTargets`/`classifyTarget`/`summarize`**, thêm một hằng switch, mở nhánh `blurred` sang copy, thêm hàm nhỏ `braceExpand`. Test thêm vào bảng ca sẵn có.

**Loại 1 — coi mọi cờ lạ của `Copy-Item` như `Move-Item`** (đơn giản nhất): `Copy-Item -Recurse D/a O/b` bị `deny` oan. Người dùng loại.

**Loại 2 — khớp tiền tố tham số theo bảng tham số `Copy-Item` của PowerShell** (`-De`, `-Des` → `Destination`): chính xác hơn nhưng dài và lệch giữa các phiên bản PowerShell. Người dùng loại.

**Loại 3 — coi `{` là ký tự glob** (`GLOB = /[*?[{]/`): `rm T/{..,x}/f` ra `unknown` (ask) nhưng `rm {T,OUT}/f` cũng không thấy `OUT`; mở rộng thật cho kết quả `deny` đúng và bao cả nhánh ngoài root.

## Tiêu chí chấp nhận

Test thêm vào `test/contract/99-path-permissions.contract.mjs` (cùng seam `config`, `repoRoot`, `tracked`, `permission_mode`; `T`/`O`/`D`/`OUT` tạo bằng `mkdtemp` dưới `<tmpdir>/aip-…`, không dưới `<tmpdir>/claude`); ca R18 chạy ở cả `mode: ask` thường lẫn full+bypass. Bash dùng `tool_name: 'Bash'`, PowerShell dùng `'PowerShell'`.

- [ ] **AC1.1** — Given full, PowerShell, `fullPaths` như `T`/`O`/`D` When `Copy-Item -Dest D/b x`, `Copy-Item -De D/b x`, `Copy-Item -D D/b x`, `Copy-Item -Dest:D/b x`, `Copy-Item -Recurse -Dest D/b x`, `cp -Dest D/b x`, `Copy-Item -Dest O/b D/a` Then `deny` (cờ lạ: mọi đối số vị trí cần `read`+`write`; ca cuối là cái giá của K1); `Copy-Item -Dest O/b T/a`, `Copy-Item -Dest T/b O/a` Then `null`; `Copy-Item -Dest O/b OUT/a` Then `deny` (nguồn thiếu `write`).
- [ ] **AC1.2** — Given full, PowerShell When `Copy-Item -Recurse D/a O/b`, `Copy-Item -Force D/a O/b`, `Copy-Item -Container D/a O/b`, `Copy-Item -PassThru D/a O/b`, `Copy-Item -WhatIf D/a O/b`, `Copy-Item -Confirm:$false D/a O/b`, `Copy-Item -recurse -Path D/a -Destination O/b`, `Move-Item -Force T/a O/b` Then `null` (switch đã biết không làm cờ lạ); `Copy-Item -Recurse OUT/a O/b` Then `ask`; `Copy-Item -Recurse D/a D/b` Then `deny`.
- [ ] **AC1.3** — Given PowerShell, `mode: ask` thường và full+bypass When `Copy-Item -Dest .claude\settings.json x`, `Copy-Item -Dest .claude settings.json`, `Copy-Item -Dest:.claude\aip-gate.json x`, `Copy-Item -De .claude\settings.json x` Then `ask`; `Copy-Item -Path .claude/settings.json -Destination out\x` Then `null` (giữ AC1.3 của request trước).
- [ ] **AC1.4** — Given hook trả `ask` cho `Copy-Item -Dest .claude\settings.json x` When đọc `reason` Then dòng "Lệnh gồm" nói "ghi vào" (không "đọc") và `reason` vẫn qua `shapeOk` của `99-hook-popup.contract.mjs`.
- [ ] **AC2.1** — Given full, PowerShell, `fullPaths` như trên When `cpi T/a D/b`, `mi T/a OUT/b`, `ri OUT/a`, `mi O/a T/b`, `ri O/a`, `cpi D/a D/b` Then `deny`; `cpi D/a O/b`, `mi T/a O/b`, `ri T/a`, `cpi T/a T/b` Then `null`; `cpi OUT/a O/b` Then `ask`.
- [ ] **AC2.2** — Given PowerShell, `mode: ask` thường và full+bypass When `cpi settings.json .claude`, `mi settings.json .claude\`, `cpi -Path settings.json -Destination .claude`, `ri .claude\settings.json` Then `ask`; `cpi .claude\settings.json out\x` Then `null`.
- [ ] **AC3.1** — Given full, Bash, `fullPaths` như trên When `rm T/{..,x}/f`, `rm T/.{.,x}/d/f`, `rm T/{a,..}`, `rm {T,OUT}/f`, `rm O/{a,b}`, `cp x T/{..,y}/f`, `rm T/{a,{..,b}}/f` Then `deny` (nhánh mở rộng ra `..` hoặc ngoài root/thiếu quyền; nhánh ngoài root thắng nhánh ask); `rm T/{a,b}/f`, `rm T/{a,b}`, `rm T/{1..3}/f`, `rm T/{x}/f`, `rm T/{.git,.x}/f` Then `null`; `rm T/{a,$X}/f` Then `ask` (biến trong một nhánh).
- [ ] **AC3.2** — Given full, Bash When đường dẫn mở rộng ra hơn 256 nhánh (`rm T/{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}/f`) Then `ask`, không treo; nhánh glob trong brace (`rm T/{.?,x}/f`) Then `ask` (như `rm T/.?/f`).
- [ ] **AC3.3** — Given full, PowerShell When `Remove-Item T/{..,x}/f`, `Remove-Item O/{a,b}` Then kết quả như trước request (brace không mở rộng ở PowerShell; không thêm ca ghim hành vi PowerShell thật nếu chưa kiểm).
- [ ] **AC4.1** — Given full, Bash, `fullPaths` như trên When `cp O/x D/b -S .bak`, `cp O/x D/b --suffix .bak`, `cp -S .bak O/x D/b`, `cp -bS .bak O/x D/b`, `cp O/x D/b --suffix=.bak`, `mv T/x D/b -S .bak`, `mv O/x T/b -S .bak` Then `deny` (đích thiếu `write` hoặc nguồn `mv` thiếu `delete`); `cp T/x O/b -S .bak`, `cp D/x O/b --suffix .bak`, `mv T/x O/b -S .bak` Then `null`; `cp OUT/x O/b -S .bak` Then `ask`; `cp -t O OUT/x --suffix .bak` Then `ask`.
- [ ] **AC5.1** — Given suite hiện có When chạy `94-permission-modes`, `99-hook-popup`, `99-path-permissions`, `90-hooks`, `97-audit-mustfix` Then xanh; mọi `reason` `ask` mới vẫn qua `shapeOk`.
- [ ] **AC6.1** — Given tài liệu When đọc Then `docs/specs/hooks-gates/spec.md` R18 (alias `cpi`/`mi` ghi vào đích `.claude`, bỏ `alias cpi/mi` khỏi giới hạn) và R24 (switch đã biết, `Copy-Item` cờ lạ cần `read`+`write`, alias `cpi`/`mi`/`ri`, brace ở Bash, `-S`/`--suffix`; giới hạn còn lại: viết tắt switch, alias khác, brace trong tên file R18) đã sửa kèm dòng Lịch sử; `README.md` và `README_VI.md` (mục Hooks, đoạn `fullPaths` và đoạn giới hạn) khớp spec; các pin `test/content` liên quan xanh.
- [ ] **AC6.2** — Given các sửa trên When `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` Then xanh; `core/.manifest.json` tăng từ 1.33.19.

## Thiết kế

### Chỗ cần sửa

- **`core/hooks/scripts/guard-bash.mjs`** (bốn hằng/nhánh, không đổi chữ ký hàm công khai):
  - Hằng alias: thêm `cpi`/`mi`/`ri` vào `WRITE_CMDS`, `LAST_ONLY`, `MOVE_CMDS`, `DELETE_CMDS`, `COPY_MOVE` (D4).
  - `writeTargets`: hằng `PS_COPY_SWITCH`; nhánh `blurred` mở cho `LAST_ONLY` với vai `['read','write']`, bỏ qua switch đã biết (D1, D2); `slots` chỉ khi không `blurred`; bước bỏ giá trị của `--suffix`/`-…S` cho `cp`/`mv` Bash (D6).
  - `classifyTarget`: hàm `braceExpand(p, cap)` và nhánh mở rộng chỉ khi `msys` (D5).
  - `summarize`: thứ tự động từ (D3).
- **Test**: `test/contract/99-path-permissions.contract.mjs` thêm ca (bảng tham số hoá, AGENTS.md Testing; không sửa ca cũ trừ khi ca cũ ghim `Move-Item -Force` bị `blurred`, sẽ ghi ở plan).
- **Tài liệu**: `docs/specs/hooks-gates/spec.md`, `README.md`, `README_VI.md`; `core/.manifest.json` + `plugins/_versions.lock.json`.
- **Không đổi**: `gate-config.mjs`, `guard-files.mjs`, `classifyPath`/`grantsOf`/`fullPaths`, `guard-mcp`, `gate-stop`, `session-start`, `cli/lib/*`.

## Ảnh hưởng spec
- hooks-gates: đổi R18, đổi R24

## Ngoài phạm vi và anti-goal

- Không thêm parser GNU/PowerShell đầy đủ; không khớp tiền tố tham số PowerShell; viết tắt của switch (`-Rec`, `-Fo`) vẫn là cờ lạ (thận trọng).
- Không thêm alias PowerShell ngoài `cpi`/`mi`/`ri` (`sc`, `ac`, `ni`…).
- Không đổi R18 cho brace trong tên file (`cp {settings,x}.json .claude/`), `-t DIR` viết tắt (`--target`), lệnh con trong nháy kép: giữ là giới hạn đã biết.
- Anti-goal: không biến thiếu `read` ở nguồn thành `deny`; không để sửa danh sách switch làm `Copy-Item -Recurse` thường dùng bị hỏi/deny; không đổi `reason` của popup (R21).

## Ràng buộc

- Zero-dependency; hook fail-open với lỗi nội bộ; không thêm lời gọi git ở đường nóng; `braceExpand` có trần 256 nhánh và không đệ quy không giới hạn.
- Chỉ tác động khi full hiệu lực (mục 1, 3, 4, alias) hoặc theo R18 ở mọi chế độ (`Copy-Item -Dest .claude\…`, `cpi`/`mi`).
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment theo AGENTS.md.
- Không push, không merge khi người dùng chưa duyệt G3; không `Co-Authored-By` trong commit (người dùng đã dặn).
- Request này và `hook-popup-r21` cùng sửa `guard-bash.mjs`: chạy lần lượt, không song song.

## Kiểm thử

- Bảng ca (lệnh, cấu hình, kết quả) qua `guard-bash.decide`, đặt trong `99-path-permissions.contract.mjs`; một hàng mỗi hành vi, ca đỏ viết trước và commit riêng.
- Trước G3, reviewer cuối chạy thử `decide` thật ở full bằng script tạm trong scratchpad với các ca của AC (không chỉ đọc code), gồm cả ca không ghi trong AC (`Copy-Item -Dest` có dấu phẩy, `cp --suffix` trong `-t`, brace lồng).
- AC6.2: `npm run build`, `versions.mjs --lock`, `npm test` một lần cuối.

## Để builder quyết

- Tên hàm/biến nội bộ (`braceExpand`, `PS_COPY_SWITCH`); cách gom các ca mới thành bảng tham số hoá miễn không lặp ca.

## Rủi ro và câu hỏi mở

- [Inference] K1 làm `Copy-Item -Dest O/b D/a` (nguồn chỉ read, dùng cờ viết tắt) bị `deny` oan; hiếm vì người dùng thường viết `-Destination` đủ. Giảm nhẹ: dùng tên tham số đầy đủ.
- [Inference] D5 mở rộng cả brace trong nháy (bash không mở rộng), nên `rm "T/{..,x}/f"` bị `deny`; chấp nhận hỏi/deny thừa.
- [Unverified] Gán `-Dest` là viết tắt của `-Destination` và hành vi brace của bash/dash chưa chạy lại trên shell thật trong request này; mô tả lấy từ follow-up của request trước. Reviewer cuối chạy `decide` thật nhưng không chạy PowerShell/bash thật.
- [giả định] `-S` chỉ nhận giá trị rời với `cp`/`mv` GNU (coreutils); BSD/busybox không có `-S` cho `cp`.
