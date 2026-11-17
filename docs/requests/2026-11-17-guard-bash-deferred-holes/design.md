# Thiết kế: vá các lỗ guard-bash ở chế độ full đã hoãn
- Ngày: 2026-11-17
- Trạng thái: approved — design và plan duyệt 2026-11-17; chờ nhánh `claude/beautiful-nobel-cdade6` merge master rồi mới thực thi
- Requirement: không có

## Vấn đề và lý do

Request `2026-11-16-full-path-resolver` (merged f0ba893b) hoãn một danh sách lỗ của `core/hooks/scripts/guard-bash.mjs` ở chế độ `full` + bypass (mục "Hoãn sang request sau" của design đó). Hướng an toàn của hook: không hiểu thì hỏi, không bao giờ im lặng cho qua lệnh ghi hay xoá ngoài root. Mỗi lỗ dưới đây vi phạm hướng đó: hook trả `null` (cho qua) trong khi lệnh có thể ghi hoặc xoá ngoài root.

Người dùng đã chọn (2026-11-17): một request, đủ ba nhóm; thứ tự chung → Bash → PowerShell; viết design và plan ngay, **thực thi sau khi nhánh `claude/beautiful-nobel-cdade6` (sửa hỏi oan `node -e '<JS>'`) merge** vì cùng sửa `guard-bash.mjs`, `core/.manifest.json` và test hook.

Số đo của phiên này, chạy `decide` thật (`mode: full`, bypass, `repoRoot` tạm) bằng script trong scratchpad, trên bản `guard-bash.mjs` của master f0ba893b/4740c181 [đo một lần, máy phát triển, Node 24]:

| Ca | Kết quả đo |
|---|---|
| `rm <ngoài root>/x` + 100000 đối số thừa | `deny`, 270 ms |
| `rm <ngoài root>/x` + 130000 đối số thừa | `decide` ném `RangeError`, `main` nuốt lỗi, hook **cho qua** |
| 8000 × `cd a` | 4,7 s |
| 8000 × `cd a; rm x` (tương đối) | 16,7 s |
| 8000 × `cd ..`, `cd /tmp`, `cd $X`, `S=…; cd $S`, PowerShell `cd C:\tmp` | dưới 0,5 s (tuyến tính) |

Hook quá thời hạn của Claude Code là lỗi không chặn nên lệnh chạy tiếp [Unverified: hành vi timeout của harness chưa kiểm ở phiên này; chỉ biết hook chậm thì phiên chờ].

Các lỗ còn lại là suy luận từ code và ghi chú của request trước; **chưa có test tái hiện**, nên mỗi lỗ bắt đầu bằng một test đỏ (xem Kiểm thử).

## Quyết định đã chốt

- **K1 — Một request, ba nhóm, thứ tự A (chung) → B (Bash) → C (PowerShell).** Người dùng chọn. Chạy tuần tự, không part song song (cùng sửa một file).
- **K2 — Dùng lại bộ giải của request trước** (`scanWords`, `resolveWord`, `walkSegments`, `leadInfo`/`leadInfoPs`, `psUnsafe`, `PS_VAR_SAFE_CMDS`). Không thêm cơ chế song song.
- **K3 — Thực thi sau merge của nhánh `node -e`.** Design và plan viết ngay; plan bắt đầu bằng bước rebase lên master đã chứa nhánh đó, rồi lấy số version kế tiếp.

### Quyết định của agent (cần duyệt ở G1)

**Nhóm A — chung**

- **A1 — Hết `push(...mảng)` trên dữ liệu người dùng.** `writeTargets` (`targets.push(...all)`, `needs.push(...)`, `targets.push(...pos)`), `braceExpand` và `out.push(...walkSegments(…))` trong `walkSegments` dùng vòng `for` hoặc `concat`. Nguyên nhân là giới hạn số đối số của lời gọi hàm (V8), nên mọi `push(...x)` mà `x` phụ thuộc độ dài lệnh đều phải đổi; builder `grep` hết trường hợp.
- **A2 — Ở full, lỗi nội bộ của `decide` thành `ask`, không còn cho qua.** `decide` bọc thân bằng `try/catch`; khi bắt lỗi mà `full()` đúng thì trả `ask` với câu `FULL_PATH_TEXT` hiện có (không đổi chữ, R21); `full()` không đúng hoặc chính nó ném lỗi thì ném lại như cũ (`main` vẫn fail-open ở ngoài full). Lý do: A1 chỉ vá một nguyên nhân đã biết; A2 chặn cả lớp "lỗi bất ngờ ⇒ cho qua". **Lệch ràng buộc cũ** "fail-open khi lỗi nội bộ" của request trước, chỉ trong full + bypass.
- **A3 — Trần số đoạn lệnh cho bộ duyệt.** Lệnh có nhiều hơn `MAX_WALK_SEGS` đoạn (đề xuất 1000; builder chọn số cuối từ phép đo, đã đo 2000 × `cd a; rm x` ≈ 1,5 s) thì `walkSegments` đánh dấu `opaque` cho toàn lệnh ⇒ `ask`, như trần 20000 ký tự và 20 tên biến của D4. Chọn trần thay vì tối ưu `path.resolve` vì [Inference] chi phí bậc hai đến từ đường dẫn `dir` dài dần qua `path.resolve`/`classifyPath` trên từng đoạn, và một lệnh thật không có hàng nghìn đoạn. Nguyên nhân chưa profile; task đầu của nhóm đo lại rồi mới chốt trần.
- **A4 — Test hook không đọc `.claude/aip-gate.json` thật.** Mọi chỗ test hook gọi `decide`/`main` mà không truyền `config` (hay `reader`) phải truyền; không thêm biến môi trường mới. Task đầu của nhóm liệt kê các chỗ đó (`grep` trong `test/contract/9*`), sửa, và thêm một assert chống tái phát (xem AC1.4).

**Nhóm B — Bash**

- **B1 — Tên lệnh `cd` tìm sau từ khoá và lệnh bọc.** `walkSegments` hiện nhận `cd` bằng `t[0]` của đoạn, nên `if …; then cd X; fi`, `time cd X`, `builtin cd X`, `command cd X` (đoạn mở bằng `then`/`time`/`builtin`) không đổi thư mục theo dõi: đường dẫn tương đối sau đó bị xét theo thư mục cũ (trong root) trong khi shell thật đã ở `X`. Dùng `infos[i].cmdAt` (đã bỏ `LEAD_KW`, `builtin`, `command`) làm vị trí tên lệnh cho cả kiểm `cd` lẫn `H6`. `cd` ở vị trí không chắc chạy (trong `if`/`then`) đã thành "chưa rõ" theo luật `structOk` của D9; chỉ cần nhận ra nó.
- **B2 — Tên lệnh là biến sau `sudo`/`env`/`nohup`.** Kiểm `opaque` hiện chỉ nhìn từ tại `cmdAt` (đầu đoạn). `sudo $R x` (với `R=rm`) và `env $R x` có tên lệnh thật nằm sau tiền tố bọc. Dùng `unwrap` (đã có, dùng bởi `writeTargets`) trên `t`: từ ở vị trí lệnh thật mà không giải được và chứa `$` hoặc backtick thì `opaque`.
- **B3 — Ba chỗ shell gán biến theo cách không đọc được:** `exec {S}>file` (fd đặt tên), `wait -p S`, `coproc S {…}`. Thêm vào `extra` của `leadInfo` cùng chỗ với `printf -v` (D3): tên đó chưa rõ ở toàn lệnh. Không dùng `VAR_MUTATORS` (tắt cả lệnh, quá rộng).

**Nhóm C — PowerShell** (mọi sửa theo hướng `ask`, không thêm `null`)

- **C1 — Đường dẫn đưa qua ống.** Đích của `Remove-Item`, `Move-Item`, `Copy-Item`, `Set-Content`… có ống vào (`seg.pipeIn`) và **không có đối số đường dẫn tường minh** thì đường dẫn đến từ đoạn trước, mà hook hiện không nhìn: `$p | Remove-Item`, `Get-ChildItem '<ngoài root>' | Remove-Item` cho qua. Luật: lệnh ghi có ống vào và không có đối số đường dẫn ⇒ đích thêm `unknown` ⇒ `ask`. Ngoại lệ có chủ đích, để không hỏi oan lệnh thường gặp: đoạn trước là `Get-ChildItem`/`gci`/`ls`/`dir`/`Get-Item`/`gi` có đối số đường dẫn tường minh thì các đường dẫn đó thành đích của lệnh ghi với quyền của nó (`delete` cho `Remove-Item`), nên `Get-ChildItem '<ngoài root>' | Remove-Item` ra `deny`, trong root ra `null`. Đoạn trước khác (kể cả `$p`) ⇒ `ask`.
- **C2 — `Function:`/`Alias:` định nghĩa lại lệnh.** `Set-Alias`, `New-Alias`, `sal`, `nal`, `function:`, `alias:`, `${function:x}`, `function <tên> {` làm tên lệnh trong lệnh không còn đáng tin (`Set-Alias gd Remove-Item; gd '<ngoài root>'`). Lệnh PowerShell có một trong các dấu hiệu này ⇒ mọi đoạn `opaque` ⇒ `ask`. Dùng regex cùng kiểu `PS_MUTATORS`, bổ sung (không thêm cơ chế mới).
- **C3 — Alias và cmdlet ghi chưa nằm trong `WRITE_CMDS`:** `md`, `ni`, `new-item`, và (nếu duyệt, câu hỏi Q1) `sc`, `ac`. Thêm vào `WRITE_CMDS` (và `DELETE_CMDS`/`needsOf` nếu cần quyền) để chúng được phân loại như `mkdir`/`set-content`. `New-Item` hiện không có trong `WRITE_CMDS` ở bất kỳ tên nào, nên `New-Item '<ngoài root>\x'` cho qua.
- **C4 — `cd` trong khối và `cd` vào ổ provider.** (i) `cd`/`Set-Location` trong `{ … }`, sau `&` hay sau `&&`/`||` làm thư mục chưa rõ từ đó (cùng luật D9 chặt hơn của Bash, nay áp cho PowerShell). (ii) `cd HKCU:`, `cd Env:`, `cd HKLM:\…` và mọi `Tên:` dài hơn một chữ cái là ổ provider, không phải thư mục đĩa: `path.resolve` hiện coi `HKCU:` là tên tương đối nối vào project, nên `Remove-Item Software\x` sau đó bị xét như file trong root. Đối số `cd` khớp `^[A-Za-z][\w]+:` ⇒ thư mục chưa rõ. [Unverified] cách hook hiện xử lý `cd` trong khối chưa tái hiện; test đỏ trước.
- **C5 — Đối số trong ngoặc và splat.** Đối số của lệnh ghi bắt đầu bằng `(`, `$(`, `@tên` (splat) hay chứa `(` ngoài nháy (`Remove-Item ('<ngoài root>')`, `Remove-Item @p`) hiện thành tên tương đối "trong root". Luật: đích như vậy ⇒ `unknown` ⇒ `ask`. `psUnsafe` đã tắt giải biến cho các dạng này; thiếu là phân loại đích.

## Hướng đã cân nhắc

- **Chọn — vá trên bộ giải hiện có** (K2): mỗi lỗ là một ca trong `resolveWord`/`walkSegments`/`confineSegment`/`writeTargets` hoặc một dòng trong tập tên.
- **Loại — viết lại PowerShell thành bộ phân tích đầy đủ.** Quá lớn, đổi `PS_VAR_SAFE_CMDS` và hành vi hiện có; mỗi lỗ ở đây chỉ cần "không hiểu thì hỏi".
- **Loại — giữ fail-open ở full cho lỗi bất ngờ** (chỉ vá A1). Một nguyên nhân nữa sẽ tái diễn cùng lỗ.
- **Loại — tối ưu `path.resolve` thay vì trần A3.** Phức tạp hơn và không loại được các dạng chậm khác.

## Tiêu chí chấp nhận

Không có `requirement.md`, nên AC nằm ở đây. Test nằm trong `test/contract/99-path-permissions.contract.mjs` (khối mới "lỗ hoãn", bảng tham số hoá; mỗi test có ID AC), cùng seam `bd(cmd, { tool, extra })` hiện có (`config`, `repoRoot`, `permission_mode: bypassPermissions`). `T` là root hợp lệ, `OUT` nằm ngoài mọi root (như request trước). Kết quả viết là `deny`, `ask` hay `null`; "không `null`" nghĩa là `ask` hoặc `deny`.

**Nhóm A**
- [ ] **AC1.1** — Given full + bypass, Bash When `rm <OUT>/x` kèm 130000 đối số thừa Then `deny` (không ném lỗi, không `null`); `rm <T>/x` kèm 130000 đối số thừa Then `null`.
- [ ] **AC1.2** — Given full + bypass When `decide` gặp lỗi nội bộ (seam: `currentBranch` ném lỗi với lệnh `git push`) Then `ask` với đúng câu `FULL_PATH_TEXT`; Given `mode` không full hoặc không bypass, cùng lỗi Then `decide` ném lỗi như trước.
- [ ] **AC1.3** — Given full + bypass When 8000 × `cd a; rm x` và 8000 × `cd a` Then `ask` và mỗi ca xong dưới 1 s (assert thời gian; theo bài học request trước, nới ngưỡng nếu flaky chứ không bỏ ca); lệnh dưới trần (vd 50 × `cd a; rm x` trong root) giữ kết quả cũ.
- [ ] **AC1.4** — Given repo gốc có `.claude/aip-gate.json` với `mode: "full"` (như repo chính hoặc worktree này) When chạy `node test/validate.mjs --only hook` Then xanh; một assert trong contract kiểm không test hook nào gọi `decide` mà thiếu `config`/`reader` (quét nguồn test).

**Nhóm B**
- [ ] **AC2.1** — Given full + bypass, cwd = project, Bash When `if true; then cd <OUT>; fi; rm x`, `time cd <OUT>; rm x`, `builtin cd <OUT>; rm x`, `command cd <OUT>; rm x` Then mỗi ca không `null`; `builtin cd <T>; rm x` Then `null`.
- [ ] **AC2.2** — Given full + bypass, Bash When `R=rm; sudo $R <OUT>/x`, `R=rm; env $R <OUT>/x`, `R=rm; nohup $R <OUT>/x` Then mỗi ca không `null`; `sudo rm <T>/x` giữ kết quả cũ.
- [ ] **AC2.3** — Given full + bypass, Bash When `S=<T>; exec {S}>/dev/null; rm -rf $S/x`, `S=<T>; wait -p S; rm -rf $S/x`, `S=<T>; coproc S { :; }; rm -rf $S/x` Then mỗi ca `ask` (không `null`); `S=<T>; rm -rf $S/x` vẫn `null` (không hỏi oan).

**Nhóm C** (`tool: 'PowerShell'`, `fullPaths` như request trước)
- [ ] **AC3.1** — Given full + bypass When `$p = '<OUT>'; $p | Remove-Item`, `Get-ChildItem '<OUT>' | Remove-Item`, `Get-ChildItem $x | Remove-Item`, `Get-Content a | Set-Content` Then mỗi ca không `null` (hai ca đầu `deny` hoặc `ask`, ca `$x` chưa gán `ask`); `Get-ChildItem '<T>' | Remove-Item` Then `null`.
- [ ] **AC3.2** — Given full + bypass When `Set-Alias gd Remove-Item; gd '<OUT>\x'`, `sal gd ri; gd '<OUT>\x'`, `function f { Remove-Item '<OUT>\x' }; f`, `${function:gd} = { Remove-Item $args }; gd '<OUT>\x'` Then mỗi ca không `null`.
- [ ] **AC3.3** — Given full + bypass When `md '<OUT>\d'`, `ni '<OUT>\f'`, `New-Item '<OUT>\f'` Then `deny`; `md '<T>\d'`, `ni '<T>\f'`, `New-Item -Path '<T>\f'` Then `null`. (`sc`/`ac` theo Q1.)
- [ ] **AC3.4** — Given full + bypass When `& { cd '<OUT>' }; Remove-Item x`, `if ($true) { cd '<OUT>' }; Remove-Item x`, `cd HKCU:; Remove-Item Software\x`, `cd Env:; Remove-Item x`, `cd HKLM:\Software; Remove-Item x` Then mỗi ca không `null`; `cd '<T>'; Remove-Item x` Then `null`; `cd C:\…` (ổ một chữ cái trong root) giữ kết quả cũ.
- [ ] **AC3.5** — Given full + bypass When `Remove-Item ('<OUT>\x')`, `Remove-Item -Path ('<OUT>\x')`, `$p = @{Path='<OUT>\x'}; Remove-Item @p` Then mỗi ca không `null`; `Remove-Item '<T>\x'` Then `null`.

**Chung**
- [ ] **AC4.1** — Given bộ giải sau thay đổi When chạy `94-permission-modes`, `99-hook-popup`, `99-path-permissions`, `90-hooks`, `97-audit-mustfix` Then xanh; mọi ca không thuộc AC trên giữ kết quả; chế độ `ask` (không full) và full không bypass không đổi kết quả nào.
- [ ] **AC5.1** — Given tài liệu When đọc `docs/specs/hooks-gates/spec.md` Then R23 và R24 mô tả đủ các luật mới (một câu mỗi nhóm A/B/C; R23 nêu A2 và trần A3, R24 nêu C1–C5) và dòng Lịch sử có hai mục cho `2026-11-17-guard-bash-deferred-holes`; README.md và README_VI.md khớp nếu có đoạn liệt kê giới hạn này.
- [ ] **AC5.2** — Given các sửa trên When `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` **trên bản `git clone` sạch** Then build và lock khớp, `npm test` xanh; `core/.manifest.json` tăng patch kế tiếp của master tại thời điểm thực thi.

## Thiết kế

### Chỗ cần sửa

- **`core/hooks/scripts/guard-bash.mjs`**:
  - Hết `push(...)` trên dữ liệu người dùng (A1): `writeTargets`, `braceExpand`, `walkSegments`.
  - `decide`: `try/catch` có điều kiện full (A2). Trần `MAX_WALK_SEGS` trong `walkSegments` (A3).
  - `walkSegments`: nhận `cd` qua `infos[i].cmdAt` (B1); `opaque` theo `unwrap` (B2); PowerShell: `cd` trong khối/sau `&`/`&&`/`||` và ổ provider thành chưa rõ (C4).
  - `leadInfo`: thêm `exec {S}>`, `wait -p S`, `coproc S` vào `extra` (B3).
  - PowerShell: tập dấu hiệu định nghĩa lại lệnh cạnh `PS_MUTATORS` (C2); `WRITE_CMDS` thêm `md`, `ni`, `new-item` (C3); phân loại đích khi có ống vào, ngoặc, splat (C1, C5) trong `writeTargets`/`confineSegment`, kèm cờ `unknown` cho đích loại này.
- **Test**: `test/contract/99-path-permissions.contract.mjs` (khối "lỗ hoãn"); các test hook khác chỉ sửa chỗ gọi thiếu `config` (A4).
- **Tài liệu**: `docs/specs/hooks-gates/spec.md` (R23, R24, Lịch sử), `README.md`, `README_VI.md` nếu có đoạn tương ứng, `core/.manifest.json`, `plugins/_versions.lock.json`.
- **Không đổi**: `parse()`, `summarize`, `trackDirs` (H1), `gate-config.mjs`, `guard-files.mjs`, `guard-mcp.mjs`, `gate-stop.mjs`, `session-start.mjs`, `cli/lib/*`, và câu `reason` của R21.

### Thứ tự thực thi (gợi ý cho plan)

1. Rebase lên master sau merge của nhánh `node -e`; ghi version hiện tại.
2. Nhóm A: A4 trước (để mọi bước sau chạy `--only hook` ở repo bật full), rồi A1 + A2, rồi A3 (đo trước khi chốt trần).
3. Nhóm B: B1, B2, B3.
4. Nhóm C: C3 (nhỏ), C5, C1, C2, C4.
5. Spec, README, version, build, lock, `npm test` trên clone sạch.

Mỗi lỗ là một task theo TDD: test đỏ tái hiện, sửa tối thiểu, xanh.

## Ảnh hưởng spec
- hooks-gates: đổi R23, đổi R24

## Ngoài phạm vi và anti-goal

- Không đổi `parse()`, `summarize`, `trackDirs`, không đổi câu `reason` (R21), không mở rộng giải biến (`$HOME`, `~`, `$env:X` vẫn chưa rõ).
- Không thêm quy tắc cho chế độ `ask`; không đụng guard-files/guard-mcp.
- Không sửa lỗi hỏi oan `node -e '<JS>'` (nhánh `claude/beautiful-nobel-cdade6`).
- Không tối ưu hiệu năng của `trackDirs` (H1) hay đường không full; chỉ trần ở bộ duyệt của H6.
- Các cmdlet ghi PowerShell ngoài danh sách C3 (`Rename-Item`, `Clear-Content`, `*-ItemProperty`…): xem Q1.
- Anti-goal: không biến một `ask` hiện có thành `null`; không làm lỏng root; không thêm cơ chế phân tích song song với bộ giải của request trước.

## Ràng buộc

- Zero-dependency, Node built-ins; không thêm lời gọi git ở đường nóng; bộ giải chỉ đọc chuỗi lệnh và trạng thái đã có.
- Hook vẫn fail-open ở ngoài full (A2 chỉ đổi trong full + bypass).
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment theo AGENTS.md (chỉ ghi lý do).
- Không push, không merge khi chưa được duyệt, không `Co-Authored-By` ngoài dòng attribution của phiên.
- `npm test` chạy trên bản `git clone` sạch (repo chính bật `mode: full` có chủ ý).
- Chạy tuần tự với mọi request khác cùng sửa `guard-bash.mjs`.

## Không đổi (bugfix)

- Mọi ca không có dấu hiệu của các lỗ trên giữ kết quả (AC4.1), gồm ba bảng test của `99-hook-popup`.
- Chế độ `ask` và full không bypass không đổi kết quả nào.
- Câu `reason` của `ask`/`deny` không đổi chữ; dòng "Lệnh gồm" không đổi.
- Hành vi PowerShell với đường dẫn literal không qua ống, ngoặc, splat không đổi.

## Kiểm thử

- Bảng tham số hoá trong `99-path-permissions.contract.mjs`, một hàng cho một hành vi, mỗi dòng có ID AC; mỗi lỗ có hàng "đỏ trước khi sửa" (xác nhận trên bản chưa sửa) và hàng "không hỏi oan" kèm theo.
- AC1.3: assert thời gian ngưỡng 1 s [Inference: mỏng trên máy tải; nới ngưỡng thay vì bỏ ca nếu flaky].
- AC1.4: chạy `--only hook` ở worktree/repo có `mode: full`.
- Trước khi báo xong, reviewer cuối chạy `decide` thật bằng script tạm trong scratchpad cho mọi ca của AC1.1…AC3.5 (không chỉ đọc code); PowerShell chỉ kiểm bằng `decide`, không chạy PowerShell thật với lệnh xoá [Unverified: cách PowerShell tách token thật chưa kiểm].
- AC5.2: `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` trên clone sạch.

## Để builder quyết

- Số `MAX_WALK_SEGS` cuối (từ phép đo), tên hàm/biến nội bộ, cách gom hàng test thành bảng.
- Cách đánh dấu đích `unknown` cho C1/C5 trong `writeTargets` (cờ trên mảng như `t.globs`, hay giá trị trả về), miễn không đổi chữ `reason`.

## Rủi ro và câu hỏi mở

- **Q1 (đã chốt: thêm `md`, `ni`, `new-item`, `sc`, `ac`) — phạm vi cmdlet ghi PowerShell ở C3.** Danh sách người dùng giao chỉ nêu `md`/`ni`. Cùng lớp lỗi còn `sc`, `ac` (alias của Set-Content/Add-Content, đã có tên đầy đủ trong `WRITE_CMDS`), `Rename-Item`/`ren`/`rni`, `Clear-Content`/`clc`, `Set-ItemProperty`/`sp`, `New-ItemProperty`/`Remove-ItemProperty` (registry). Đề xuất: thêm `md`, `ni`, `new-item`, `sc`, `ac` (cùng cmdlet đã có tên đầy đủ hoặc cặp trực tiếp); phần còn lại ghi thành request sau. Chọn khác thì sửa C3 và AC3.3 trước khi lập plan.
- **A2 lệch ràng buộc fail-open (đã duyệt).** Hook ở full + bypass sẽ hỏi thay vì cho qua khi `decide` lỗi. Cái giá: một lỗi nội bộ tương lai gây hỏi liên tục ở full thay vì im lặng; đánh đổi cho hướng "không hiểu thì hỏi".
- **A3 trần số đoạn:** lệnh hợp lệ rất dài (> trần đoạn) sẽ bị hỏi ở full. [Inference] hiếm; số trần chốt bằng đo, không bằng ước lượng.
- **C4(i)** chưa tái hiện được từ đọc code; nếu test đỏ cho thấy hook đã hỏi đúng thì bỏ nhánh (i), giữ (ii) (ổ provider).
- Phối hợp: nhánh `claude/beautiful-nobel-cdade6` sửa `guard-bash.mjs` (32 dòng), manifest, lock và hai file test cùng file test của request này. Plan bước 1 rebase và lấy version kế tiếp; nếu nhánh đó chưa merge khi cần thực thi thì dừng và hỏi.
- [Unverified] Số đo của phần Vấn đề từ một lần chạy; ngưỡng timeout hook của Claude Code chưa kiểm.
- [Unverified] Hành vi `exec {S}>`, `wait -p`, `coproc` trên các phiên bản bash khác bash 5.2 chưa kiểm; hook chỉ cần hiểu "tên biến bị gán theo cách không đọc được" nên không phụ thuộc phiên bản.
