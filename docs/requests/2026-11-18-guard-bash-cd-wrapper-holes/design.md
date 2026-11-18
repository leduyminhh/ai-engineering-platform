# Thiết kế: guard-bash nhận cd và lệnh sau các lệnh bọc còn sót
- Ngày: 2026-11-18
- Trạng thái: draft — chờ duyệt design và plan (G1/G2)
- Requirement: không có

## Vấn đề và lý do

Request `2026-11-17-guard-bash-deferred-holes` (nhánh `claude/laughing-tu-69e18d`, chưa merge) hoãn nhóm "cd/wrapper Bash" vì ngoài AC của nó. Người dùng chọn làm luôn (2026-11-18), tiếp trên cùng nhánh, chạy tuần tự sau request đó. Hướng an toàn của hook không đổi: không hiểu thì hỏi, không im lặng cho qua lệnh ghi hay xoá ngoài root.

Các lỗ (đã chạy `decide` thật ở review cuối của request trước; full + bypass, `T` trong root, `OUT` ngoài mọi root):

| Lệnh | Kết quả hiện tại | Vì sao |
|---|---|---|
| `command -- cd OUT; rm x`, `command -p cd OUT; rm x`, `builtin -- cd OUT; rm x` | `null` | `leadInfo.cmdAt` chỉ bỏ `builtin`/`command` trần, nên tên lệnh là `--`/`-p`, `cd` không được nhận ra và `rm x` bị xét theo thư mục cũ |
| `time -p cd OUT; rm x` | `null` | `time` là từ khoá mở đầu (`LEAD_KW`) nhưng cờ `-p` của nó làm vòng bỏ từ khoá dừng sớm |
| `.{ cd 'OUT' }; Remove-Item x` | `null` | PowerShell: từ `.{` (dot-source một khối) không được bỏ như `{` |
| `builtin cd <repo main> && git push`, `command cd …`, `if …; then cd <repo>; fi; git push` | `null` (tra nhánh của cwd) | `trackDirs` (H1) vẫn nhận `cd` qua `t[0]` |
| `S=<T>; wait -fp S; rm -rf $S/x`, `wait -pS` | `null` | `wait` chỉ nhận `-p` đứng riêng; cờ gộp và tên dính liền làm `S` vẫn được tin |
| `timeout $T ls` | `ask` oan | `unwrap` chỉ nhận thời lượng literal, `$T` bị coi là tên lệnh |

## Quyết định đã chốt

- **K1 — Phạm vi:** đúng nhóm "cd/wrapper Bash" ở trên (người dùng chọn). Hoãn tiếp: PowerShell hẹp (`cd Registry::`, `Remove-Item HKCU:`, `Rename-Item`…, `iex`), lệnh dài theo byte, tiền tố bọc `setsid`/`flock`/`xargs` và hỏi thừa khác.
- **K2 — Làm tiếp trên nhánh `claude/laughing-tu-69e18d`**, tuần tự sau request `2026-11-17-guard-bash-deferred-holes`; một lần merge vào master.
- **K3 — Dùng lại bộ giải của các request trước** (`leadInfo`, `unwrap`, `walkSegments`, `trackDirs`); không thêm cơ chế song song.

### Quyết định của agent (cần duyệt ở G1)

- **D1 — `cmdAt` bỏ cờ của `command`/`builtin`/`time`.** Sau `builtin`, `command` hoặc `time` bỏ các từ bắt đầu bằng `-` (gồm `--`, `-p`). Riêng `command -v`/`-V` (và `command -pv`…) là tra cứu tên, không chạy lệnh: `cmdAt` giữ ở từ `command`, nên `command -v cd; rm x` không làm thư mục đổi (và `command -v $x` giữ nguyên ngoại lệ `lookup` của request trước). `time` vẫn là từ khoá mở đầu không được tin: `time -p cd OUT; rm x` thành `ask` (thư mục chưa rõ), như `time cd OUT` hiện tại. `builtin`/`command` thì `cd` chắc chạy: `deny` ở thư mục ngoài root.
- **D2 — `trackDirs` (H1) nhận `cd` qua `unwrap`.** Tên lệnh lấy từ `unwrap(t)` thay `t[0]`; `builtin` thêm vào danh sách tiền tố của `unwrap`. Luật cd cũ của H1 (hiệu lực cho đoạn sau, trừ sau `||`/`|`) giữ nguyên; chỉ vị trí nhận ra đổi. Request trước nêu `trackDirs` "không đổi" như ràng buộc của riêng nó; request này được phép vì ghi rõ ở đây.
- **D3 — PowerShell `.{` và `&{`:** `walkSegments` bỏ các từ `{`, `.{`, `&{` đầu đoạn khi tìm tên lệnh (mở rộng vòng `while (t[ci] === '{')` của request trước). `cd` trong khối vẫn không chắc chạy (`structOk`/`compound`) nên thư mục thành chưa rõ (`ask`).
- **D4 — `wait`:** trong cửa sổ 3 từ sau `wait`, nhận `-p` đứng riêng, cờ gộp kết thúc bằng `p` (`-fp`, `-nfp`) và `-p` dính tên (`-pS`, `-fpS`); tên biến là từ kế (khi riêng) hoặc phần dính liền. Cờ không có `p` (`-n`, `-f`, `-fn`) không làm gì.
- **D5 — `timeout`:** thời lượng được nhận cả khi là biến (`$T`, `${T}`, có thể kèm hậu tố `s|m|h|d`). `timeout 5 $R x` và `timeout $T $R x` vẫn làm `$R` là tên lệnh không đọc được (`ask`): chỉ một từ được nuốt làm thời lượng.

## Hướng đã cân nhắc

- **Chọn — vá tại `cmdAt`, `unwrap`, `trackDirs`, `leadInfo`** (K3).
- **Loại — gộp `unwrap` và `leadInfo.cmdAt` thành một hàm.** Hai nơi dùng khác kiểu token (`words` có phần nháy so với chuỗi đã giải); gộp lớn hơn phạm vi.
- **Loại — bắt cả `command -- cd` bằng cách coi mọi cờ của `command` là chạy lệnh.** `command -v` là tra cứu, hỏi oan.

## Tiêu chí chấp nhận

Test ở `test/contract/99-path-permissions.contract.mjs` (khối mới "cd và lệnh bọc", bảng tham số hoá, ID AC trong tên), seam `bd(cmd, { tool, opts, extra })`; `T` trong root, `OUT` ngoài mọi root; ca H1 dùng seam `currentBranch(dir)` như khối F2 của `90-hooks`.

- [ ] **AC1.1** — Given full + bypass, cwd = project, Bash When `command -- cd <OUT>; rm x`, `command -p cd <OUT>; rm x`, `builtin -- cd <OUT>; rm x` Then `deny`; `time -p cd <OUT>; rm x` Then `ask`; Given `command -v cd; rm x`, `command -v $x`, `command -pv cd; rm x`, `builtin cd <T>; rm x`, `command -p cd <T>; rm x` Then `null`.
- [ ] **AC1.2** — Given full + bypass, PowerShell When `.{ cd '<OUT>' }; Remove-Item x`, `&{ cd '<OUT>' }; Remove-Item x` Then `ask`; `cd '<T>'; Remove-Item x` Then `null`.
- [ ] **AC1.3** — Given `currentBranch(dir)` trả `main` chỉ cho thư mục `<P>/repo`, full + bypass (push giữ theo `fullKeep`) và `mode: ask` When `builtin cd repo && git push`, `command cd repo; git push origin HEAD`, `command -- cd repo && git push`, `if true; then cd repo; fi; git push` Then `ask`; `cd repo && git push` Then `ask` (đối chứng cũ); `builtin cd other && git push` Then `null`.
- [ ] **AC1.4** — Given full + bypass When `S=<T>; wait -fp S; rm -rf $S/x`, `S=<T>; wait -pS; rm -rf $S/x`, `S=<T>; wait -n -fp S; rm -rf $S/x` Then `ask`; `S=<T>; wait -fn; rm -rf $S/x`, `S=<T>; wait; rm -rf $S/x` Then `null`.
- [ ] **AC1.5** — Given full + bypass When `timeout $T ls`, `timeout ${T}s ls <T>/x` Then `null`; `R=rm; timeout 5 $R <OUT>/x`, `R=rm; timeout $T $R <OUT>/x` Then `ask`.
- [ ] **AC2.1** — Given thay đổi trên When chạy `--only hook`, `--only path-permissions`, `--only spec` Then xanh; mọi ca không thuộc AC1.x giữ kết quả (không ask/deny cũ nào thành `null`, trừ ca H1 đã nêu ở AC1.3 đổi từ `null` sang `ask`).
- [ ] **AC2.2** — Given tài liệu When đọc `docs/specs/hooks-gates/spec.md` Then R23 nêu D1–D5 và bỏ các mục đã vá khỏi "giới hạn đã biết"; README.md và README_VI.md khớp.
- [ ] **AC2.3** — Given các sửa trên When `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` trên bản `git clone` sạch Then build và lock khớp (bump patch kế tiếp), `npm test` exit 0.

## Thiết kế

### Chỗ cần sửa

- **`core/hooks/scripts/guard-bash.mjs`**:
  - `leadInfo`: vòng `cmdAt` bỏ cờ sau `builtin`/`command`/`time` (D1), trừ `-v`/`-V`; nhánh `wait` nhận cờ gộp và tên dính liền (D4).
  - `unwrap`: thêm `builtin` (D2); thời lượng `timeout` nhận biến (D5).
  - `trackDirs`: tên lệnh và đối số `cd` lấy sau `unwrap` (D2).
  - `walkSegments`: từ `.{`/`&{` đầu đoạn PowerShell bỏ như `{` (D3).
- **Test:** `test/contract/99-path-permissions.contract.mjs` (khối mới); ca H1 dựng theo khối F2 của `90-hooks.contract.mjs`.
- **Tài liệu:** `docs/specs/hooks-gates/spec.md` (R23, Lịch sử), `README.md`, `README_VI.md`, `core/.manifest.json`, `plugins/_versions.lock.json`.
- **Không đổi:** `parse()`, `summarize`, `gate-config.mjs`, `guard-files.mjs`, `guard-mcp.mjs`, câu `reason` (R21), luật cd của H1 ngoài vị trí nhận ra.

### Thứ tự thực thi (gợi ý cho plan)

1. D1 (`cmdAt`) → 2. D3 (`.{`) → 3. D2 (`trackDirs`) → 4. D4 + D5 → 5. spec/README → 6. version, build, lock, `npm test` trên clone sạch.

## Ảnh hưởng spec
- hooks-gates: đổi R23

## Ngoài phạm vi và anti-goal

- PowerShell hẹp, lệnh dài theo byte, tiền tố bọc mới, hỏi thừa khác: tiếp tục hoãn (K1).
- Không đổi câu `reason` (R21), `parse()`, `summarize`.
- Anti-goal: không biến một `ask`/`deny` có sẵn thành `null`; không làm lỏng root.

## Ràng buộc

- Zero-dependency, Node built-ins; không thêm lời gọi git ở đường nóng.
- Hook vẫn fail-open ngoài full + bypass (A2 của request trước).
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment chỉ ghi lý do (AGENTS.md); không `Co-Authored-By` ngoài dòng attribution của phiên.
- `npm test` chạy trên bản `git clone` sạch (repo chính bật `mode: full`).
- Tuần tự sau `2026-11-17-guard-bash-deferred-holes`, cùng nhánh; không chạy song song với request khác cùng sửa `guard-bash.mjs`.

## Không đổi (bugfix)

- Mọi ca không có dấu hiệu của các lỗ trên giữ kết quả, gồm các bảng của `99-hook-popup` và khối cd/H1 của `90-hooks`.
- Chế độ `ask` giữ kết quả, trừ ca H1 đã nêu ở AC1.3 (`cd` sau `builtin`/`command`/`then` nay đổi nhánh tra push).
- `command -v`/`-V` giữ nguyên ngoại lệ tra cứu.

## Kiểm thử

- Bảng tham số hoá một hàng một hành vi; mỗi lỗ có hàng "đỏ trước khi sửa" và hàng đối chứng.
- Trước khi báo xong, reviewer chạy `decide` thật bằng script tạm cho mọi ca AC1.1–AC1.5 (không chỉ đọc code).
- AC2.3: `npm test` trên clone sạch; hai test brace đã đo trong tiến trình con ở request trước.

## Để builder quyết

- Cách viết regex cờ gộp `wait` và vị trí đặt cờ `lookup` cho `command -v` trong `cmdAt`; tên biến nội bộ; cách gom hàng test.

## Rủi ro và câu hỏi mở

- **D2 đổi H1 (`trackDirs`)**, ràng buộc "không đổi" của request trước chỉ áp cho request đó; hành vi đổi theo hướng hỏi nhiều hơn khi `cd` đứng sau từ khoá hoặc lệnh bọc ([Inference]: không có ca `ask` nào thành `null` ngoài trường hợp cd tới repo ở nhánh feature, vốn là hành vi đúng).
- [Unverified] Cách bash thật xử lý `builtin -- cd`, `command -p cd`, `time -p cd` và `wait -fpS` được ghi từ review cuối của request trước (reviewer đã chạy bash 5.2 cho `command -- cd`, `command -p cd`, `builtin -- cd`, `time -p cd`, `wait -fp`/`-pS`); chưa đo lại ở phiên này.
- Chưa kiểm được hành vi PowerShell thật với `.{ … }` (chỉ `decide`).
- Request này phụ thuộc nhánh hiện tại chưa merge; merge sau cùng nhánh node -e vẫn gây conflict chữ ở manifest/lock.
