# Thiết kế: quyền đọc/ghi/xoá riêng theo thư mục ở chế độ full
- Ngày: 2026-11-12
- Trạng thái: approved — làm sau khi `feature/hook-popup-standardization` merge vào master; nhánh mới tách từ master sau đó
- Requirement: không có

## Vấn đề và lý do

Ở chế độ `full` hiệu lực (phiên `bypassPermissions` + `mode: "full"` + `.claude/aip-gate.json` không bị git theo dõi), hook nhốt thao tác trong các root. Đã đọc code nền (`core/hooks/scripts/` trên nhánh `feature/hook-popup-standardization`):

1. **Chỉ có hai mức theo thư mục.** `fullRoots` (`gate-config.mjs` 52–56) cho đọc + ghi + xoá; `fullReadRoots` (102–106) chỉ cho Read/Grep. `allowedRoots` (97–100) gộp gốc project, scratchpad, `fullRoots` và `claudeTmpRoots()` thành một mảng chuỗi; `classifyPath` (86–92) chỉ trả `inside`/`outside`/`unknown`.
2. **Ghi và xoá cùng một nhóm.** `WRITE_CMDS` (`guard-bash.mjs` 171) chứa `rm`, `rmdir`, `del`, `erase`, `rd`, `remove-item`, `mv`, `move`, `move-item` lẫn `cp`, `touch`, `mkdir`, `chmod`, `chown`, `tee`, `truncate`, `set-content`, `out-file`, `add-content`. `writeTargets` (296–342) trả mảng chuỗi đích, không nói đích đó bị ghi hay bị xoá; `confineSegment` (357–368) chỉ có hai kết quả cho mỗi đích (`deny` ngoài root, `ask` không xác định). Vì vậy không cấu hình được "cho ghi vào `E:/out` nhưng cấm xoá".
3. **`mv` mang hai vai.** Hiện mọi đối số của `mv` bị xếp như đích ghi (không phân biệt nguồn bị xoá và đích được ghi).
4. **`guard-files` cũng hai mức.** `confine()` (82–99) gọi `classifyPath(file, cwd, allowedRoots(...))` rồi một lần `inReadRoot(..., [...fullReadRoots, ...defaultReadRoots])` cho Read/Grep.

Người dùng muốn quyền đọc, ghi, xoá tách rời theo từng thư mục.

## Quyết định đã chốt

Bốn điểm do người dùng chốt, không đổi:

- **K1 — khoá `fullPaths`.** Mảng đối tượng `{ "path": "<tuyệt đối>", "allow": ["read" | "write" | "delete", ...] }`. `fullRoots` và `fullReadRoots` giữ nguyên để tương thích (`fullRoots` ≡ allow read + write + delete; `fullReadRoots` ≡ allow read). Ví dụ:
  `{"mode":"full","fullPaths":[{"path":"E:/data","allow":["read"]},{"path":"E:/out","allow":["read","write"]},{"path":"E:/tmp","allow":["read","write","delete"]}]}`
- **K2 — phân loại lệnh.** `delete` áp cho `rm`, `rmdir`, `del`, `erase`, `rd`, `Remove-Item` và nguồn của `mv`/`move`/`Move-Item`. `write` áp cho đích của `mv`/`move`/`Move-Item` và các lệnh ghi còn lại: `cp`, `touch`, `mkdir`, `chmod`, `chown`, `tee`, `truncate`, `Set-Content`, `Out-File`, `Add-Content`, chuyển hướng `>`/`>>`, và công cụ Write/Edit/MultiEdit/NotebookEdit. `read` áp cho Read/Grep.
- **K3 — chỉ ở full hiệu lực**, như `fullRoots` hiện nay; chế độ `ask` không đổi.
- **K4 — thứ tự.** Làm sau khi `feature/hook-popup-standardization` merge vào master; nhánh mới tách từ master.

### Quyết định của agent

Người dùng giao phần còn lại cho agent; mọi dòng dưới đây là **quyết định của agent**, nêu nổi bật để người duyệt sửa.

- **D1 — mô hình quyền: hợp (union), không "mục cụ thể nhất thắng".** Quyền tại một đường dẫn là hợp quyền của mọi mục chứa nó (gốc project, gốc repo chính ở worktree, `scratchpad_dir`, `<tmpdir>/claude`, `fullRoots`, `fullReadRoots`, root chỉ-đọc mặc định, `fullPaths`). Lý do: (a) R10 đã làm vậy (root chỉ-đọc nằm trong root ghi được giữ quyền ghi), đổi sang "cụ thể nhất thắng" sẽ đổi hành vi cũ; (b) thêm một mục không bao giờ làm mất quyền nên sửa cấu hình không có bẫy thứ tự; (c) người dùng đã chốt gốc project/scratchpad/tmp luôn đủ ba quyền, nên mục cụ thể hơn không thể thu hẹp chúng. Hệ quả nêu rõ: `fullPaths` không thu hẹp được thư mục nằm trong root đầy đủ (xem ví dụ ở Thiết kế); muốn thu hẹp phải không đặt thư mục cha vào `fullRoots`.
- **D2 — quyền độc lập, không ngầm định.** `write` không kéo theo `read`, `delete` không kéo theo `write`. Lý do: ví dụ của người dùng liệt kê đủ từng quyền (`["read","write"]`); ngầm định làm `allow: ["delete"]` mở nhiều hơn chữ viết.
- **D3 — thiếu quyền theo cùng khuôn hiện có.** Thiếu `write` hoặc `delete` → `deny`; thiếu `read` → `ask`; đường dẫn không xác định (biến, `~`, backtick) → `ask` với mọi loại quyền. Lý do: giữ khuôn R7/R10 (ghi/xoá ngoài root không hỏi được mà chặn; đọc thì hỏi), nên không cần câu `ask` mới.
- **D4 — xác thực `fullPaths` theo hướng ít quyền hơn.** Khoá không phải mảng → `[]`. Mỗi mục: không phải đối tượng, `path` không phải chuỗi tuyệt đối, hoặc `allow` không phải mảng → bỏ cả mục. Trong `allow` chỉ giữ đúng chuỗi `"read"`, `"write"`, `"delete"` (phân biệt hoa thường: `"Write"` bị bỏ); phần tử lạ bị bỏ, mục còn lại giữ phần quyền đã nhận ra. `allow` rỗng hoặc không còn phần tử nhận ra → mục không cấp quyền gì. Khác `fullKeep` ở chỗ không cần ngoại lệ "mảng toàn giá trị lạ → giữ mặc định" vì mặc định an toàn của `fullPaths` chính là "không cấp gì", trùng với kết quả của mảng rỗng. Mục trùng đường dẫn gộp theo hợp. `path` chuẩn hoá bằng `path.resolve`, cùng cách `fullRoots` làm (kể cả ca `/e/x` trên Windows không đổi sang Msys; không phải việc của request này). `path` không hỗ trợ wildcard: ký tự `*` là ký tự thường, không mở rộng quyền (khác root chỉ-đọc mặc định có `*` do code gán).
- **D5 — `fullPaths` là khoá `untracked`.** Thêm `fullPaths: { type: 'array', trust: 'untracked' }` vào `GATE_KEYS` ở `core/hooks/scripts/gate-file.mjs` và chép byte-identical sang `core/skills/plan-execution/scripts/gate-file.mjs`. Lý do: cùng lý do `fullRoots` (R20) — file đã commit chép sang worktree rồi chạy `aip mode full` sẽ cho ghi/xoá ngoài project. Khoá thứ 19.
- **D6 — tập quyền cần cho từng đích.** `writeTargets` giữ `targets` (mảng chuỗi) nguyên cho các nơi dùng khác (kiểm cấu hình hook R18, `stringWrites`) và thêm mảng `needs` song song: mỗi phần tử là một mảng quyền cần cho đích cùng chỉ số (vd `['write']`, `['delete']`, `['delete','write']`, `['read']`). Cách gán ở cả bốn chỗ đẩy vào `targets`:
  1. Chuyển hướng `>`/`>>`/`>|` → `['write']`.
  2. Cờ đường dẫn PowerShell tách rời (`PS_PATH_FLAGS`, giá trị là đối số kế tiếp) và 3. dạng dính `-Destination:X`/`-Path:X`: cùng một bảng theo (lệnh, cờ): `-Destination` → `['write']`; `-Path`/`-LiteralPath` của `Move-Item` → `['delete']`, của `Remove-Item` → `['delete']`, của `Copy-Item` → `['read']`, của `Set-Content`/`Add-Content` → `['write']`; `-FilePath` (`Out-File`) → `['write']`.
  4. Đối số vị trí: `rm`/`rmdir`/`del`/`erase`/`rd`/`remove-item` → `['delete']`; `mv`/`move`/`move-item`: mọi đối số trừ cuối → `['delete']`, đối số cuối → `['write']` (`Move-Item a b` không cờ: nguồn `a` delete, đích `b` write); `cp`/`copy`/`copy-item` chỉ đối số cuối (như `LAST_ONLY` hiện nay) → `['write']`; còn lại (`touch`, `mkdir`, `chmod`, `chown`, `tee`, `truncate`, `Set-Content`…) → `['write']`.
  Dò `-t`/`--target-directory` cho `mv` và `cp` **trước** khi chia vai: `-t DIR`, `-tDIR`, `--target-directory DIR`, `--target-directory=DIR` thì `DIR` là đích (`['write']`) và mọi đối số vị trí còn lại là nguồn (`mv` → `['delete']`; `cp` không có đích nào để kiểm vì nguồn của `cp` không bị nhốt, như hiện nay); `-T` không nhận giá trị nên giữ cách chia mặc định. `mv` còn đúng một đối số vị trí và không có `-t` (không xác định được vai) → đối số đó cần cả `['delete','write']`.
  **Nới so với hiện nay (người dùng đã chốt):** `-Path`/`-LiteralPath` của `Copy-Item` là nguồn đọc nên chỉ cần `read` (hiện bị xếp như đích ghi, ngoài root là `deny`); thiếu `read` thì `ask` theo D3 thay vì `deny`. `cp -t DIR src` hiện bị phân tích sai (coi `src` là đích) và request này sửa lại.
- **D7 — bí mật chỉ miễn dưới root đủ ba quyền.** Quy tắc "Read hoặc Write vào đường dẫn bí mật (`.env`, khoá, credentials) chỉ được miễn khi nằm trong root có đủ ba quyền" áp cho `guard-files` (Read, Grep, Write, Edit, MultiEdit, NotebookEdit) và `secretOutsideRoots` của `guard-bash`. Root đủ ba quyền gồm gốc project, scratchpad, `<tmpdir>/claude`, `fullRoots` và mục `fullPaths` có cả `read`, `write`, `delete`. Đường dẫn bí mật dưới mục thiếu bất kỳ quyền nào (kể cả `["read","write"]`) → `ask` (không phải `deny`), dưới root không có quyền tương ứng thì vẫn `deny`/`ask` theo D3. Lý do: giữ đúng hành vi `fullReadRoots` ở R10 và chỉ làm hỏi thừa, không nới.
- **D11 — so khớp và gộp mục dùng `norm`.** `fullPaths` khớp và gộp mục trùng bằng đúng `norm` của `gate-config.mjs` (đổi `\` thành `/`, bỏ `/` cuối, hạ chữ thường ở win32) và `path.resolve` như `classifyPath`, nên `..` trong đích được xét sau khi resolve (`rm <T>/../O/f` xét theo `O`), `E:/Data` và `e:/data/` là một mục trên Windows, `<D>/` có `/` cuối khớp `D`.
- **D12 — thứ tự tra và chữ ký.** `rootsOf()` của `guard-bash` trả danh sách grant (không còn mảng chuỗi). `isClaudeTmpRoot` (D8) thắng trước khi tra grant. `secretOutsideRoots` truyền `need` = cả ba quyền; `confineSegment` truyền `need` theo `needs` của từng đích (glob đi qua nhánh `GLOB` của `classifyTarget` với cùng `need`: `rm <O>/*` xét thư mục cha `<O>/` với `delete`). `need` là tham số cuối của `classifyPath` (sau `msys`) hoặc nằm trong `opts`, để lời gọi `classifyPath(p, cwd, roots, msys)` và `fullReadRoots()` trong test `94-permission-modes` không vỡ.
- **D8 — gốc `<tmpdir>/claude` giữ ngoại lệ.** Chính thư mục `<tmpdir>/claude` và glob ngay dưới nó (`isClaudeTmpRoot`, R23) vẫn bị chặn cho cả ba loại thao tác. Gốc của một mục `fullPaths` (`rm -rf E:/tmp` khi `E:/tmp` có `delete`) được phép như `fullRoots` hiện nay (`abs === n` là inside).
- **D9 — `aip mode status` không hiện giá trị root.** `gateLines` (`cli/lib/mode.mjs` 91–96) không in `fullRoots`/`fullReadRoots`; nó chỉ lập danh sách "Khoá bị bỏ qua", "Khoá lạ", "Khoá sai kiểu" từ `GATE_KEYS`. Vì D5, `fullPaths` tự có mặt trong "Khoá bị bỏ qua" khi file bị git theo dõi và trong "Khoá sai kiểu" khi không phải mảng; không sửa `mode.mjs`. Không thêm cảnh báo mục `fullPaths` bị bỏ vì sai cú pháp (xem Rủi ro).
- **D10 — `gate-stop.mjs` không đổi.** Nó chỉ dùng `resolveGate(...).roots` để biết thư mục nào quét, không dùng `allowedRoots`.

## Hướng đã cân nhắc

**Hướng chọn — một mảng `fullPaths` gồm đối tượng `{path, allow}`.** Một nơi khai mọi quyền của một thư mục; mở rộng được (thêm quyền, thêm trường) mà không thêm khoá; sai chính tả của một mục chỉ làm rụng mục đó (D4). Đánh đổi: cấu trúc lồng khó gõ tay hơn mảng phẳng; có ba khoá (`fullRoots`, `fullReadRoots`, `fullPaths`) cùng cấp quyền thư mục nên người đọc phải biết `fullRoots` ≡ ba quyền.

**Bị loại 1 — hai mảng phẳng `fullWriteRoots` và `fullDeleteRoots`.** Người dùng đã loại. Lý do ghi lại: ba mảng phẳng (đọc, ghi, xoá) rải quyền của một thư mục ra nhiều khoá, và `fullWriteRoots` không biểu diễn được "ghi nhưng không đọc" mà không thêm mảng thứ ba có tên riêng.

**Bị loại 2 — đối tượng khoá theo đường dẫn `{ "E:/data": ["read"] }`.** Ngắn hơn, nhưng `JSON.parse` âm thầm giữ khoá trùng cuối cùng (mất quyền đã khai), và không còn chỗ cho trường mở rộng như mô tả hay `deny`. Hướng chọn dễ lint hơn.

**Bị loại 3 — "mục cụ thể nhất thắng" thay cho hợp quyền.** Cho phép thu hẹp thư mục con (vd cấm xoá trong `<project>/prod`). Bị loại vì đổi hành vi R10, làm kết quả phụ thuộc cấu trúc cây thư mục, và mâu thuẫn quyết định gốc project/scratchpad/tmp luôn đủ ba quyền. Để dành làm request riêng nếu có nhu cầu thu hẹp thật ([giả định]: chưa có ca dùng).

## Tiêu chí chấp nhận

Test mới `test/contract/99-path-permissions.contract.mjs` (cùng seam `config`, `repoRoot`, `tracked`, `input.permission_mode` như `94-permission-modes.contract.mjs`); thư mục thật tạo bằng `mkdtemp` dưới `<tmpdir>/aip-…` (không dưới `<tmpdir>/claude`, vì đó là root hợp lệ, D8), đường dẫn tuyệt đối. Ký hiệu: `D`, `O`, `T`, `T2` là các thư mục rời nhau (không cái nào chứa cái nào) và không nằm trong `P`; `P` là gốc project, cũng tạo riêng và không chứa chúng. `AC` đánh dấu *(đổi)*/*(thêm)* là phần sửa sau builder check.

- [ ] **AC1.1** — Given `GATE_KEYS` When đếm khoá Then có 19 khoá, `fullPaths` kiểu `array`, trust `untracked`, và hai bản `gate-file.mjs` (hook, plan-execution) giống hệt byte. `calc: 18 + 1 = 19`
- [ ] **AC1.2** *(đổi)* — Given `aip-gate.json` bị git theo dõi chứa `fullPaths` hợp lệ When `aip mode status` Then liệt kê `fullPaths` ở dòng "Khoá bị bỏ qua" (hành vi hook với file bị theo dõi nằm ở AC6.1).
- [ ] **AC2.1** — Given bảng đầu vào cho bộ đọc `fullPaths(config)` When gọi Then: khoá thiếu, `null`, chuỗi, đối tượng không phải mảng → `[]`; mục có `path` tương đối, `path` không phải chuỗi, `allow` không phải mảng, phần tử không phải đối tượng → bị bỏ; `allow: ["read","Write","x",3]` → mục còn quyền `{read}`; `allow: ["Write"]` và `allow: []` → mục không cấp quyền gì; hai mục cùng `path` → một mục với hợp quyền.
- [ ] **AC2.2** — Given `fullPaths: [{path: "<D>/*", allow: ["read","write","delete"]}]` When `rm <D>/a` Then `deny` (dấu `*` không phải wildcard, không mở rộng quyền).
- [ ] **AC3.1** — Given full hiệu lực và `fullPaths: [{path: D, allow: ["read"]}, {path: O, allow: ["read","write"]}, {path: T, allow: ["read","write","delete"]}]` When `guard-files` nhận Read/Grep vào `D`, `O`, `T` Then không quyết định; nhận Write/Edit/MultiEdit/NotebookEdit vào `D` Then `deny`, vào `O` và `T` Then không quyết định.
- [ ] **AC3.2** — Given `fullPaths: [{path: D, allow: ["write"]}]` When Read `<D>/f` Then `ask`; When Write `<D>/f` Then không quyết định (D2: `write` không kéo theo `read`).
- [ ] **AC3.3** — Given cấu hình ở AC3.1 When `guard-bash` nhận `rm <D>/f`, `rm <O>/f`, `rmdir <O>/d`, `Remove-Item <O>/f` (PowerShell) Then `deny`; `rm <T>/f`, `Remove-Item <T>/f` Then không quyết định; `rm <T>/a <O>/b` Then `deny` (một đích thiếu quyền là đủ).
- [ ] **AC3.4** *(đổi)* — Given cấu hình ở AC3.1 When `guard-bash` nhận `cp x <D>/f`, `touch <D>/f`, `mkdir <D>/d`, `chmod 600 <D>/f`, `tee <D>/f`, `truncate -s0 <D>/f`, `echo a > <D>/f`, `echo a >> <D>/f`, `Set-Content -Path <D>/f x` (PowerShell) Then `deny`; cùng các lệnh ở `<O>` và `<T>` Then không quyết định.
- [ ] **AC3.5** *(thêm)* — Given cấu hình riêng `fullPaths: [{path: T2, allow: ["delete"]}]` (không dùng chung với AC3.1) When `cp x <T2>/f`, `touch <T2>/f`, `echo a > <T2>/f` Then `deny` (xoá không kéo theo ghi); `rm <T2>/f` Then không quyết định.
- [ ] **AC3.6** *(đổi)* — Given cấu hình ở AC3.1 When `mv <T>/a <O>/b` Then không quyết định (`delete` ở nguồn, `write` ở đích); `mv <T>/a` (một đối số, `T` đủ ba quyền) Then không quyết định; `mv <O>/a <O>/b` Then `deny` (nguồn `O` thiếu `delete`); `mv <T>/a <D>/b` Then `deny` (đích `D` thiếu `write`); `mv <D>/a <T>/b` Then `deny` (nguồn `D` thiếu `delete`); `mv <O>/a` Then `deny` (vai không xác định nên cần cả `delete` lẫn `write`; `O` thiếu `delete`).
- [ ] **AC3.7** *(thêm)* — Given cấu hình ở AC3.1 When `mv -t <O> <T>/a`, `mv --target-directory=<O> <T>/a` Then không quyết định (đích `O` có `write`, nguồn `T` có `delete`); `mv -t <T> <O>/a` Then `deny` (nguồn `O` thiếu `delete`); `mv -t <D> <T>/a` Then `deny` (đích `D` thiếu `write`).
- [ ] **AC3.8** *(thêm)* — Given cấu hình ở AC3.1 When `cp -t <O> x`, `cp --target-directory=<O> x` Then không quyết định; `cp -t <D> x` Then `deny` (đích là `-t DIR`, không phải đối số cuối `x`).
- [ ] **AC3.9** *(thêm)* — Given cấu hình ở AC3.1, PowerShell When `Move-Item <T>/a <O>/b` (không cờ: nguồn `delete`, đích `write`) và `Move-Item -Path <T>/a -Destination <O>/b` Then không quyết định; `Move-Item <O>/a <O>/b` Then `deny`; `Move-Item -Path <T>/a -Destination:<D>/b` (dạng dính) Then `deny`; `Move-Item -Path:<O>/a -Destination <T>/b` Then `deny` (nguồn dạng dính thiếu `delete`).
- [ ] **AC3.10** *(thêm)* — Given cấu hình ở AC3.1, PowerShell When `Copy-Item -Path <D>/a -Destination <O>/b` Then không quyết định (nguồn chỉ cần `read`, đích `write`; **nới so với hiện nay**, trước đây `-Path` ngoài root bị `deny`); `Copy-Item -Path <O>/a -Destination <D>/b` Then `deny` (đích `D` thiếu `write`); `Copy-Item -Path <outside-all>/a -Destination <O>/b` Then `ask` (thiếu `read`).
- [ ] **AC3.11** — Given đường dẫn không xác định (`rm $X/f`, `cat > ~/f`, `rm \`pwd\`/f`) và `bash -c "rm <T>/f"` When `guard-bash` chạy ở full Then vẫn `ask` như trước (D3, R7); thao tác Read ngoài mọi mục của `guard-files` vẫn `ask` với câu hiện có.
- [ ] **AC4.1** — Given `fullReadRoots: [D]` và `fullPaths: [{path: "<D>/out", allow: ["read","write"]}]` When Write `<D>/out/f`, Write `<D>/x`, Read `<D>/x`, `rm <D>/out/f` Then lần lượt không quyết định, `deny`, không quyết định, `deny` (hợp quyền: `<D>/out` có read + write, phần còn lại của `D` chỉ read).
- [ ] **AC4.2** — Given `fullRoots: [T]` và `fullPaths: [{path: "<T>/keep", allow: ["read"]}]` When `rm <T>/keep/f` Then không quyết định (mục cụ thể hơn không thu hẹp root đầy đủ); Given `fullPaths: [{path: "<P>/sub", allow: ["read"]}]` When `rm <P>/sub/f` và Write `<P>/sub/f` Then không quyết định (gốc project luôn đủ ba quyền); tương tự với `scratchpad_dir` và `<tmpdir>/claude/p/x`.
- [ ] **AC4.3** — Given hai mục `fullPaths` cùng `path` `{["read"]}` và `{["write"]}` When Write và Read vào thư mục đó Then cả hai không quyết định (gộp theo hợp); Given `rm <tmpdir>/claude` Then vẫn `deny` dù mục `fullPaths` nào cho `delete` (D8).
- [ ] **AC5.1** — Given chỉ `fullRoots: [T]` (không có `fullPaths`) When chạy toàn bộ bảng ca AC3.1–AC3.10 với `T` Then kết quả y hệt mục `["read","write","delete"]` (đọc, ghi, xoá, `mv` vào/ra `T` đều không quyết định); ngoài `T` vẫn `deny`/`ask` như trước.
- [ ] **AC5.2** — Given chỉ `fullReadRoots: [D]` When Read/Grep `<D>/f` Then không quyết định; Write, `rm`, `cp x`, `mv <D>/a <T>/b` vào/từ `D` Then `deny` (y hệt cũ, test `94-permission-modes` mục P4e2 AC3.1).
- [ ] **AC4.4** *(thêm)* — Given `fullPaths: [{path: T, allow: ["read","write","delete"]}, {path: O, allow: ["read","write"]}]` When `rm <T>/../<O-tên-thư-mục>/f` (resolve ra `O`) Then `deny` (xét theo `O`, thiếu `delete`); `rm <T>/sub/../f` Then không quyết định; mục khai `<T>/` (có `/` cuối) khớp `rm <T>/f`; trên Windows, `rm <T-đổi-hoa-thường>/f` và mục khai khác hoa/thường vẫn khớp, và hai mục chỉ khác hoa/thường gộp thành một.
- [ ] **AC4.5** *(thêm)* — Given cấu hình ở AC3.1 When `rm <O>/*`, `rm <T>/*`, `cp x <D>/*` Then `deny`, không quyết định, `deny` (glob xét thư mục cha trước dấu `*` với đúng `need` của vai: `delete`, `delete`, `write`).
- [ ] **AC5.3** — Given suite hiện có When chạy `94-permission-modes`, `99-hook-popup`, `90-hooks`, `97-audit-mustfix` không sửa Then xanh (chỉ test `98-gate-file` đổi con số 18 → 19 và danh sách `UNTRACKED` thêm `fullPaths`).
- [ ] **AC6.1** *(đổi)* — Given `mode: "ask"`, hoặc phiên không bypass, hoặc `aip-gate.json` bị git theo dõi (nên full không hiệu lực, khoá `untracked` rơi về mặc định) và `fullPaths` hợp lệ When `guard-files`/`guard-bash` chạy các ca AC3 Then kết quả y hệt khi không có `fullPaths` (hook trả null cho ca thường của chế độ đó; không có mục nào tác động ngoài full hiệu lực).
- [ ] **AC6.2** — Given `deny` mới (thiếu `write` hoặc `delete`) ở `guard-files` và `guard-bash` When hook quyết định Then `reason` chứa `fullPaths`, `fullRoots` (giữ câu cũ mà test AC1.4 của `99-hook-popup` ghim) và tên quyền còn thiếu (`write` hoặc `delete`); mọi `reason` `ask` của hai hook vẫn qua `shapeOk` của `99-hook-popup.contract.mjs` (không chứa chuỗi cấm `BANNED`, có "cho phép"/"từ chối", ≤ 500 ký tự).
- [ ] **AC6.3** *(đổi)* — Given `D` với `["read"]`, `O` với `["read","write"]`, `T` với ba quyền When `guard-files` Read `<D>/.env` và `<O>/.env`, Read `<T>/.env`; `guard-bash` `cat <D>/.env` Then `ask` cho `D` và `O`, không quyết định cho `T` (D7).
- [ ] **AC6.4** *(thêm)* — Given cùng cấu hình AC6.3 When `guard-files` Write `<O>/.env`, Write `<T>/.env`, Write `<D>/.env`, Write `<P>/.env` Then `ask`, không quyết định, `deny` (thiếu `write`), không quyết định (D7: Write bí mật chỉ miễn dưới root đủ ba quyền; gốc project đủ ba quyền).
- [ ] **AC7.1** *(đổi)* — Given tài liệu When đọc Then `README.md` và `README_VI.md` (mục Hooks, đoạn chế độ quyền) mô tả `fullPaths` cùng bảng quyền theo lệnh và quy tắc hợp quyền, nêu `fullPaths` là heuristic đọc token, không phải sandbox, và symlink, `ln`, `sed -i`, `find -delete`, `xargs rm`, `git clean` không được phân loại theo quyền; nêu `Copy-Item -Path` chỉ cần `read`; `CLAUDE.md` dòng mô tả khoá `aip-gate.json` nhắc `fullPaths`; `docs/specs/hooks-gates/spec.md` có R24 mới, R7/R10/R20 đã sửa (R20 ghi 19 khoá và hàng `fullPaths`); các pin `test/content/29-*` và `30-*` vẫn xanh.
- [ ] **AC8.1** — Given các sửa trên When `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` Then xanh; `core/.manifest.json` tăng version so với lúc bắt đầu nhánh.

## Thiết kế

### Mô hình

Một "grant" là `{ root, allow }`; `allow` là tập con của `{read, write, delete}`. Quyền tại đường dẫn `p` với loại `need` là: `p` nằm dưới (hoặc bằng) một grant có `need` trong `allow`. Nguồn grant:

| Nguồn | allow |
|---|---|
| gốc project, gốc repo chính (worktree), `scratchpad_dir`, `<tmpdir>/claude` | read, write, delete |
| `fullRoots` | read, write, delete |
| `fullReadRoots`, root chỉ-đọc mặc định (`defaultReadRoots`, có `*`) | read |
| `fullPaths[i]` | phần đã nhận ra của `allow` |

Kết quả cho một đích: `unknown` (đường dẫn không xác định) → `ask`; có quyền → cho qua; thiếu quyền → `deny` nếu `need` là `write`/`delete`, `ask` nếu `read` (D3).

Ví dụ (full hiệu lực, `P` là gốc project, mọi đường dẫn tuyệt đối):

| Cấu hình | Thao tác | Kết quả | Vì sao |
|---|---|---|---|
| `fullPaths: [{E:/out, [read,write]}]` | `cp x E:/out/f` | cho qua | `write` có ở `E:/out` |
| như trên | `rm E:/out/f` | `deny` | thiếu `delete` |
| `fullReadRoots: [E:/data]`, `fullPaths: [{E:/data/out, [read,write]}]` | Write `E:/data/out/f` / Write `E:/data/x` | cho qua / `deny` | hợp: `out` có write, phần còn lại của `data` chỉ read |
| `fullRoots: [E:/a]`, `fullPaths: [{E:/a/keep, [read]}]` | `rm E:/a/keep/f` | cho qua | hợp, không thu hẹp root đầy đủ (D1) |
| `fullPaths: [{P/sub, [read]}]` | `rm P/sub/f` | cho qua | gốc project luôn đủ ba quyền |
| `fullPaths: [{E:/t, [delete]}]` | `cp x E:/t/f` | `deny` | `delete` không kéo theo `write` (D2) |
| `fullPaths: [{E:/d, [write]}]` | Read `E:/d/f` | `ask` | `write` không kéo theo `read` (D2) |

### Chỗ cần sửa

- **`core/hooks/scripts/gate-config.mjs`**: thêm `fullPaths(config)` (xác thực D4) và bộ dựng grant `grantsOf(gate, input)` gom các nguồn ở bảng trên; `classifyPath` nhận thêm tham số loại quyền cần (`need`, là tham số cuối sau `msys` hoặc trong `opts`, mặc định `'write'`) và chấp nhận phần tử roots là chuỗi (coi đủ ba quyền, giữ nguyên chữ ký cho nơi gọi cũ) hoặc `{path, allow}`; mọi so khớp qua `norm` (D11); `inReadRoot` giữ vai trò khớp `*` của root mặc định, còn `fullPaths` khớp theo tiền tố đường dẫn (không wildcard, D4). `allowedRoots` giữ cho nơi chỉ cần danh sách root đầy đủ (D7) và trả đúng các root có đủ ba quyền.
- **`core/hooks/scripts/guard-files.mjs`** `confine()`: thay hai bước (`classifyPath` + `inReadRoot`) bằng một lần tra grant theo `need` = `write` cho `WRITE_TOOLS`, `read` cho Read/Grep; đường dẫn bí mật (Read lẫn Write) dùng quy tắc D7; thêm câu `deny` nhắc `fullPaths` + `fullRoots` + quyền thiếu.
- **`core/hooks/scripts/guard-bash.mjs`**: `writeTargets` thêm `needs` (D6, kèm dò `-t`); `classifyTarget` nhận `need` (kể cả nhánh `GLOB`); `confineSegment` tra từng đích theo tập quyền của nó (trả `deny` khi một đích thiếu quyền, `ask` khi không xác định hoặc thiếu `read`, deny thắng ask như hiện nay); `isClaudeTmpRoot` thắng trước khi tra grant; câu `deny` ở dòng 728 nêu quyền thiếu và nhắc `fullPaths`; `rootsOf()` trả grant thay vì mảng chuỗi; `secretOutsideRoots` truyền `need` = ba quyền (D7, D12). Không đổi `stringWrites` (chuỗi `bash -c` vẫn `ask`, R7), H1, H2, H3, kiểm cấu hình hook (R18).
- **`core/hooks/scripts/gate-file.mjs`** + bản sao `core/skills/plan-execution/scripts/gate-file.mjs`: một dòng `fullPaths` (D5), chép byte-identical; cập nhật bình luận ba khoá full* thành bốn.
- **Không đổi**: `gate-stop.mjs` (D10), `session-start`, `guard-mcp`, `cli/lib/mode.mjs` (D9).
- **Test**: `test/contract/99-path-permissions.contract.mjs` mới (AC2–AC6); sửa `98-gate-file.contract.mjs` (18 → 19, thêm `fullPaths` vào `UNTRACKED`); các suite cũ giữ nguyên làm bằng chứng tương thích (AC5.3).
- **Tài liệu**: `README.md`, `README_VI.md` (mục Hooks, đoạn chế độ quyền và dòng nêu `fullRoots`), `CLAUDE.md` (dòng mô tả khoá `aip-gate.json`), spec sống `docs/specs/hooks-gates/spec.md`; `core/.manifest.json` tăng version và `plugins/_versions.lock.json` qua `node cli/lib/versions.mjs --lock`.

## Ảnh hưởng spec
- hooks-gates: đổi R7, đổi R10, đổi R20, thêm R24

[giả định] R21–R23 do request `2026-11-12-hook-popup-standardization` thêm đã vào master trước khi request này bắt đầu, nên R mới là R24; nếu thứ tự merge khác thì đánh số lại khi gộp spec. R7: thêm chữ "gồm `fullPaths`" ở danh sách root và câu "ghi/xoá phân biệt theo vai"; R10: root chỉ-đọc là trường hợp riêng của `fullPaths`; R20: 19 khoá, hàng `fullPaths`, câu lý do `untracked`; R24: mô hình hợp quyền, bảng quyền theo lệnh, quy tắc xác thực, quy tắc bí mật (D1–D8).

## Ngoài phạm vi và anti-goal

- Bash đọc file (`cat`, `head`, `less`, `Get-Content`…) vẫn không bị nhốt theo `read` (giới hạn hiện có của R7): `read` chỉ áp cho công cụ Read/Grep và cho quy tắc bí mật. Ghi rõ ở README để người dùng không hiểu nhầm `["write"]` là cấm đọc bằng `cat`.
- Không thu hẹp quyền của gốc project, scratchpad, `<tmpdir>/claude` (D1); không có quyền kiểu `deny` theo đường dẫn.
- Không thêm đường ghi/xoá mới vào bộ nhận diện (`find -delete`, `git clean`, `xargs rm`, `node -e`, `curl -o` vẫn không bị bắt như R7/R18); không resolve symlink.
- Không đổi chế độ `ask`, H1 (push), H2/H3 ở phiên không full, `mcpAllow`/`mcpDeny`.
- Không đổi câu `ask` hiện có; không hỏi người dùng mới (D3).
- Anti-goal: không làm `fullPaths` nới quyền khi file bị git theo dõi (D5); không biến lỗi gõ thành nhiều quyền hơn (D4).

## Ràng buộc

- Zero-dependency; hook fail-open với lỗi nội bộ; không thêm lời gọi git ở đường nóng (grant dựng từ config đã đọc, không thêm `readGate`).
- Tương thích ngược: chữ ký `classifyPath`, `allowedRoots`, `fullRoots`, `fullReadRoots` còn dùng được cho test và nơi gọi cũ.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment theo AGENTS.md.
- Không merge, không push khi người dùng chưa xác nhận; chỉ bắt đầu sau khi `feature/hook-popup-standardization` merge.

## Kiểm thử

- AC1.x: `98-gate-file.contract.mjs` (số khoá, trust, byte-identical) và một ca `aip mode status` qua seam của `mode.mjs`.
- AC2.x: bảng ca thuần hàm `fullPaths()` trong `99-path-permissions.contract.mjs`.
- AC3.x, AC4.x, AC5.x, AC6.x: bảng ca (lệnh, cấu hình, kết quả mong đợi) chạy qua `guard-bash.decide` và `guard-files.decide` với seam `config`/`repoRoot`/`tracked`; một test tham số hoá cho mỗi bảng (AGENTS.md Testing). PowerShell dùng `tool_name: 'PowerShell'`. Thư mục D/O/T/T2/P tạo bằng `mkdtemp` dưới `<tmpdir>/aip-…`, rời nhau, P không chứa chúng, không dưới `<tmpdir>/claude`; ca Windows (hoa/thường) chỉ chạy khi `process.platform === 'win32'`.
- AC5.3: chạy nguyên các suite cũ; không thêm test lặp.
- AC7.1: `test/content` pin chỉ các hợp đồng vận hành (tên khoá `fullPaths`, ba giá trị `allow`), không pin cả đoạn văn.
- AC8.1: `npm run build`, `versions.mjs --lock`, `npm test`.

## Để builder quyết

- Tên hàm/tham số nội bộ (`grantsOf`, `need`, `needs`) và cách tách `classifyPath` (một hàm hay hai) miễn giữ chữ ký cũ chạy được.
- Chữ chính xác của câu `deny` mới (bám khuôn câu cũ, thêm quyền thiếu và `fullPaths`).
- Có gộp ba mục README thành một bảng quyền hay giữ rải theo đoạn hiện có.

## Rủi ro và câu hỏi mở

- [Inference] `fullPaths` bỏ lặng lẽ mục sai cú pháp (D4) theo hướng ít quyền hơn, nhưng người dùng gõ `"Write"` sẽ thấy lệnh ghi bị `deny` mà không biết lý do; `aip mode status` không báo. Giảm nhẹ: câu `deny` nêu rõ tên quyền thiếu và nhắc `fullPaths`. Cách cải thiện (lint từng mục trong `lintGate`) nằm ngoài request này, vì `gate-file.mjs` phải giữ hai bản sao giống nhau.
- [Inference] Hợp quyền (D1) khiến một mục `fullPaths` đặt nhầm thư mục cha của project cấp thêm quyền cho mọi thứ dưới đó; vẫn là người dùng tự đặt, file `untracked`.
- `cp -t DIR src` hiện đã bị phân tích sai sẵn (coi `src` là đích); request này sửa lại (D6, AC3.8), nên một số lệnh `cp -t` đổi kết quả so với bản cũ. Chỉ dò `-t`/`--target-directory`; các cờ GNU khác của `mv`/`cp` không được phân tích thêm. `mv` một đối số không `-t` chọn an toàn (cần cả `delete` lẫn `write`).
- [Inference] Nới có chủ đích: `Copy-Item -Path/-LiteralPath` chỉ cần `read` (người dùng chốt); lệnh này trước đây `deny` khi nguồn ngoài root, nay có thể qua nếu nguồn có `read`, hoặc `ask` nếu không có.
- [giả định] Hành vi `*` literal của `fullPaths` (D4) chưa kiểm trên POSIX; đường dẫn Windows/POSIX khớp theo `norm` hiện có (không phân biệt hoa/thường ở win32).
- [giả định] Tên test `99-path-permissions` chưa trùng mẫu `*.contract.mjs` bị loại; builder xác nhận khi chạy `npm test`.
- Câu mở cho người duyệt: (1) chấp nhận hợp quyền (không thu hẹp được thư mục trong root đầy đủ) hay cần "cụ thể nhất thắng" ngay; (2) `write` không kéo theo `read` (D2) hay muốn ngầm định; (3) bí mật (Read lẫn Write) chỉ miễn ở root đủ ba quyền (D7) hay chỉ cần quyền tương ứng.
