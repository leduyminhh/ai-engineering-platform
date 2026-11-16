# Thiết kế: câu deny ngoài root liệt kê các root agent được làm việc
- Ngày: 2026-11-16
- Trạng thái: approved — G1 duyệt 2026-11-16 (implement sau khi hook-popup-short merge)
- Requirement: không có

## Vấn đề và lý do

Người dùng gửi bài "Roots" của khoá Model Context Protocol: Advanced Topics (anthropic.skilljar.com, bài 296289) và yêu cầu "update lại luồng root". Người dùng chọn "luồng root" là root của hook ở chế độ `full` (`core/hooks/scripts/gate-config.mjs`: `grantsOf`, `classifyPath`, `fullRoots`, `fullPaths`).

Bài nói ba điều áp được cho repo này:

1. Root là ranh giới thư mục được truy cập; SDK không tự chặn, nên chính tool phải kiểm một hàm kiểu `is_path_allowed()` trước mỗi thao tác file. Hook này đã làm đúng (`classifyPath`), nhưng câu `deny` do hai nơi tự dựng chữ giống nhau: `guard-bash.mjs:980` và `guard-files.mjs:96`.
2. Chạm ngoài root thì trả lỗi để Claude báo người dùng. Câu `deny` hiện chỉ nói thiếu quyền và cách xin thêm (`fullPaths`, `fullRoots`), không nói agent được làm ở đâu.
3. `list_roots` giúp Claude biết tìm file ở đâu thay vì đoán. Agent bị `deny` hiện phải đoán thư mục khác, dễ thử lại ngoài root nhiều lần.

Đã đọc: `gate-config.mjs` (`grantsOf` gồm gốc project, `scratchpad_dir`, `fullRoots`, `<tmpdir>/claude`, `fullReadRoots` và `defaultReadRoots` dạng glob chỉ đọc, `fullPaths`), hai câu deny nêu trên và spec `docs/specs/hooks-gates/spec.md` R21, R24. `deny` do agent đọc nên được giữ gợi ý hành động (R21); `ask` do người dùng đọc, đang được rút gọn ở request `2026-11-16-hook-popup-short`, không đổi ở đây.

## Quyết định đã chốt

Người dùng đã trả lời ba câu làm rõ (gom một tin nhắn) ngày 2026-11-16:

- **K1 — "luồng root" là root của hook full mode** (không phải phiên root của `plan-execution`, không phải ghi chú vào brainstorm).
- **K2 — câu `deny` liệt kê root kèm quyền** (kiểu `list_roots`): thêm một dòng các root có quyền đang thiếu, tối đa 6 mục rồi "… và N mục khác"; vẫn nhắc `fullPaths`/`fullRoots` để xin thêm.
- **K3 — gom logic dựng câu `deny` vào một helper chung** trong `gate-config.mjs`, hai hook cùng dùng.
- **K4 — viết design (G1) ngay, code sau.** Request này cùng sửa `guard-bash.mjs` và `guard-files.mjs` với `2026-11-16-hook-popup-short` (đang chạy tới G3 ở phiên khác); chỉ implement sau khi request đó đã merge vào `master`, rồi rebase nhánh này.

### Quyết định của agent

Mọi dòng dưới là **quyết định của agent**, nêu nổi bật để người duyệt sửa.

- **D1 — chỉ liệt kê root có đúng quyền đang thiếu.** `deny` luôn là `write` hoặc `delete` (thiếu `read` là `ask`). Dòng thêm: ``Được ghi: `A`, `B`, … và N mục khác`` (hoặc `Được xoá:`), lấy từ `grantsOf` lọc `allow.includes(need)`. Root chỉ-đọc (`fullReadRoots`, `defaultReadRoots`, dạng glob `*`) và các `fullPaths` chỉ read tự không có mặt. Không có root nào có quyền đó thì không thêm dòng.
- **D2 — hiện tối đa 6 root, mỗi đường dẫn qua `showArg(…, 80)`.** Thứ tự giữ như `grantsOf` (gốc project, scratchpad, `fullRoots`, `<tmpdir>/claude`, `fullPaths`). Root `<tmpdir>/claude` hiện đúng `<tmpdir>/claude/…` (chỉ phần dưới nó là root, R23).
- **D3 — helper `denyOutsideText(need, grants, subject)` ở `gate-config.mjs`.** Trả câu hoàn chỉnh: `Chế độ full chỉ cho phép <subject> có quyền <need>; đường dẫn chưa có.` + dòng root + câu xin thêm `Cần mở rộng → thêm vào "fullPaths" (allow có "<need>") hoặc "fullRoots" trong .claude/aip-gate.json.` `subject` là "lệnh này ở thư mục" (guard-bash) hoặc "ghi vào thư mục" (guard-files). Hai câu hiện tại giữ đúng nghĩa; chỉ thêm dòng root.
- **D4 — không đổi.** `CLAUDE_TMP_BLOCKED_TEXT`, `DENY_COMMIT`, câu `ask` (R21 khuôn mới), `classifyPath`, `grantsOf`, `allowedRoots`, `guard-mcp`, `gate-stop`, `session-start`. Không thêm công cụ `list_roots` cho agent: hook chỉ chạy khi agent gọi tool, không có kênh trả danh sách chủ động.
- **D5 — chi phí và quyền riêng tư.** Đường dẫn root đi vào ngữ cảnh của mô hình. Chúng do chính người dùng khai (`fullRoots`, `fullPaths`) hoặc là gốc project và scratchpad mà agent đã biết; không có dữ liệu agent đi qua. Tối đa 6 mục × 80 ký tự giữ câu `deny` dưới ~720 ký tự.
- **D6 — version.** `core/.manifest.json` tăng một bậc patch từ giá trị lúc implement (1.34.1 ở thời điểm viết); `npm run build`, `node cli/lib/versions.mjs --lock`.

## Hướng đã cân nhắc

**Chọn — một helper `denyOutsideText` trong `gate-config.mjs`**, hai hook gọi nó và truyền `grantsOf(...)` đã có sẵn trong ngữ cảnh. Không đổi chữ ký hàm công khai khác.

**Loại 1 — chỉ nêu root gần nhất** (ngắn hơn): bỏ thông tin có `fullPaths` nhiều mục, agent vẫn phải đoán.

**Loại 2 — không đổi câu, chỉ dọn code gộp helper:** không giải quyết điều bài Roots nhấn mạnh (agent cần biết đi đâu). Người dùng chọn có liệt kê.

**Loại 3 — liệt kê mọi root kể cả chỉ-đọc:** gây hiểu nhầm (root chỉ-đọc không ghi được); D1 lọc theo quyền thiếu.

## Tiêu chí chấp nhận

Test thêm vào `test/contract/99-path-permissions.contract.mjs` (cùng seam `config`, `repoRoot`, `tracked`, `permission_mode`; thư mục `T`/`O`/`D`/`OUT` tạo bằng `mkdtemp` dưới `<tmpdir>/aip-…`, không dưới `<tmpdir>/claude`); `94-permission-modes.contract.mjs` giữ nguyên các ca deny hiện có.

- [ ] **AC1.1** — Given full + bypass, `fullPaths` cấp `T` đủ ba quyền, `O` read+write, `D` chỉ read, `OUT` ngoài mọi root When `guard-bash` nhận `rm OUT/f`, `cp x OUT/b`, `echo x > OUT/f` Then `deny`, `reason` chứa dòng `Được xoá:` (với `rm`) hoặc `Được ghi:` (với `cp`, `>`) liệt kê `T` (và gốc project) và, với `Được ghi:`, cả `O`, không liệt kê `D`; `reason` vẫn chứa `fullPaths`, `fullRoots` và quyền thiếu.
- [ ] **AC1.2** — Given như AC1.1 When `guard-files` nhận Write/Edit/MultiEdit/NotebookEdit vào `OUT/f` Then `deny`, `reason` chứa dòng `Được ghi:` với cùng tập root như AC1.1, vẫn chứa `fullPaths`, `fullRoots`, `write`.
- [ ] **AC1.3** — Given 8 root cùng có quyền ghi When bị `deny` ghi ngoài root Then dòng root chỉ liệt kê 6 mục, kết thúc bằng "… và 2 mục khác"; reason không có xuống dòng chèn bởi đường dẫn (đường dẫn qua `showArg`, backtick bị bỏ).
- [ ] **AC1.4** — Given không root nào có quyền ghi (chỉ có root chỉ-đọc) When bị `deny` ghi ngoài root Then reason không có dòng `Được ghi:`, vẫn có câu xin thêm quyền như trước.
- [ ] **AC1.5** — Given deny của `<tmpdir>/claude` (CLAUDE_TMP_BLOCKED_TEXT), `DENY_COMMIT`, mọi `ask` When hook quyết định Then chữ không đổi so với trước request; reason `ask` vẫn qua `shapeOk` của `99-hook-popup.contract.mjs`.
- [ ] **AC2.1** — Given helper `denyOutsideText(need, grants, subject)` When gọi với `write`, `delete` và các tập grants khác nhau (rỗng, một root, trên 6 root, chỉ có glob chỉ-đọc) Then kết quả đúng như AC1.x; cả `guard-bash` và `guard-files` gọi helper này (không còn chuỗi `Chế độ full chỉ cho phép` nào ngoài `gate-config.mjs`).
- [ ] **AC3.1** — Given tài liệu When đọc Then `docs/specs/hooks-gates/spec.md` R21 (câu `deny` thêm dòng root) và R24 (deny của `guard-files`/`guard-bash` nêu cả root có quyền) đã sửa kèm dòng Lịch sử; `README.md`, `README_VI.md` (mục Hooks) và `CHANGELOG.md` khớp spec; các pin `test/content` liên quan xanh.
- [ ] **AC3.2** — Given các sửa trên When `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` Then xanh; `core/.manifest.json` tăng version.

## Thiết kế

### Chỗ cần sửa

- **`core/hooks/scripts/gate-config.mjs`**: thêm và export `denyOutsideText(need, grants, subject)` (D3), dùng `showArg` sẵn có; không đổi `grantsOf`/`classifyPath`.
- **`core/hooks/scripts/guard-bash.mjs`** (dòng deny trong nhánh full, ~980): thay chuỗi dựng tay bằng `denyOutsideText(r.deny, rootsOf(), 'lệnh này')`; `rootsOf()` đã có sẵn trong `decide`.
- **`core/hooks/scripts/guard-files.mjs`** (dòng ~96 trong `confine`): `denyOutsideText('write', grants, 'ghi vào')`; `grants` đã có sẵn trong `confine`.
- **Test**: `test/contract/99-path-permissions.contract.mjs` (bảng ca mới AC1.x, AC2.1); ca deny hiện có của `94-permission-modes` và `99-hook-popup` giữ nguyên làm bằng chứng tương thích.
- **Tài liệu**: `docs/specs/hooks-gates/spec.md`, `README.md`, `README_VI.md`, `CHANGELOG.md`; `core/.manifest.json`, `plugins/_versions.lock.json`.
- **Không đổi**: `guard-mcp.mjs`, `gate-stop.mjs`, `session-start.mjs`, `cli/lib/*`, logic quyết định `ask`/`deny`.

## Ảnh hưởng spec
- hooks-gates: đổi R21, đổi R24

## Ngoài phạm vi và anti-goal

- Không đổi khi nào hook hỏi hay chặn; không thêm quyền, không đổi cách tính root hay `fullPaths`.
- Không đổi câu `ask` (user-facing, ngắn) và không thêm công cụ MCP `list_roots` cho agent.
- Không liệt kê root chỉ-đọc ở câu `deny` ghi hoặc xoá.
- Anti-goal: không làm `deny` dài hơn ~720 ký tự; không để đường dẫn trong cấu hình làm giả dòng hay chèn backtick (qua `showArg`).

## Ràng buộc

- Zero-dependency; hook fail-open khi lỗi nội bộ (helper lỗi thì rơi về câu cũ không có dòng root).
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment theo AGENTS.md.
- Không chạy song song với `2026-11-16-hook-popup-short` (cùng sửa `guard-bash.mjs`, `guard-files.mjs`, R21 và `README`); implement sau khi request đó merge vào `master`, rebase rồi mới làm Task đầu.
- Không push, không merge khi người dùng chưa duyệt G3; commit không có `Co-Authored-By`.

## Kiểm thử

- Bảng ca (lệnh/công cụ, cấu hình, `reason` kỳ vọng) qua `guard-bash.decide` và `guard-files.decide`, một hàng mỗi hành vi; ca đỏ viết trước và commit riêng.
- Trước G3, reviewer cuối chạy `decide` thật ở full bằng script tạm trong scratchpad: in `reason` cho các ca AC1.x (và cấu hình với 0, 1, 8 root), đo độ dài, đối chiếu D1–D3.
- AC3.2: `npm run build`, `versions.mjs --lock`, `npm test` một lần cuối.

## Để builder quyết

- Tên tham số của helper; cách gom các ca thành bảng; có tách hàm con `rootLine(grants, need)` hay không.

## Rủi ro và câu hỏi mở

- [Inference] Liệt kê root giúp agent tự sửa đường dẫn nên giảm số lần thử lại ngoài root; chưa đo trên phiên thật.
- [Inference] `fullPaths` rất dài (hàng chục mục) làm dòng root bị cắt ở 6 mục và agent vẫn không thấy hết; chấp nhận, câu có "… và N mục khác".
- [Unverified] Bài Roots mô tả roots của giao thức MCP (server nhận danh sách từ client); repo này ánh xạ khái niệm sang `fullRoots`/`fullPaths` của hook, không dùng giao thức MCP roots. Bài chưa được đối chiếu với đặc tả MCP gốc.
- Mở: request `2026-11-16-hook-popup-short` còn ở G3; request này chờ nó merge. Nếu người dùng muốn làm trước, cần chấp nhận rebase/xung đột ở R21 và các câu deny.
