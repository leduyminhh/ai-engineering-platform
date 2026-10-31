# Thiết kế: aip status — xem tiến trình part và xử lý vướng
- Ngày: 2026-10-31
- Trạng thái: approved
- Requirement: không có
## Vấn đề và lý do
Khi request chia part, người dùng không biết part đang làm gì, đã làm gì, vướng gì; chỉ nhận các đoạn text từ phiên con. Dữ liệu có sẵn nhưng rải rác: Bảng part (`design.md`), ledger `.aip/runs/<request>/<part>/progress.md`, task trong `plan.md`, commit trên nhánh `worktree-<slug>-p<nn>`. Ledger không có thời gian và không ghi kết quả từng vòng review, nên không dựng được dòng sự kiện hay chi tiết task. Khi part vướng, chưa có cách phân loại ai gỡ, gỡ thế nào, gửi câu trả lời về part ra sao.
## Quyết định đã chốt
- (1) Lệnh `aip status` chỉ đọc (không gọi model): text mặc định, `--json`, `--html` ghi `.aip/runs/<request>/status.html` tự chứa, `--part <nn>`, `--watch` (tuỳ chọn, ghi lại HTML mỗi 10 giây). Chọn request mới nhất có ledger dở khi không truyền tên.
- (2) Trang gồm 7 khối: đầu trang (request, nhánh, HEAD, mức `autonomy`, thời điểm cập nhật); dải cổng G1 → G2 → G3 → push; "Cần bạn xử lý" (chỉ hiện khi có việc); số tổng (part merged/tổng, task xong/tổng, số vướng, Ruling/minor); bảng part; sơ đồ phụ thuộc (cột Phụ thuộc, nhãn từ `**Interfaces:**`); chi tiết part (mỗi task: start, commit đỏ, commit xanh, review từng vòng, minor, file) và dòng sự kiện (ledger mọi part + commit nhánh part, mới nhất trước).
- (3) Trạng thái part theo thứ tự ưu tiên: vướng (dòng `Blocked:` mới nhất chưa có `Unblocked:`/`complete` sau nó) > merged (`Part <nn>: merged` ở root) > xong chờ merge (`Part: complete`) > chờ part phụ thuộc (phụ thuộc chưa merged; màu xám, không phải vướng) > im lặng quá lâu (đang làm, không có dòng ledger hay commit mới quá `statusStaleMinutes`) > đang làm (`Task <n>: start` hoặc có commit trên nhánh part) > chưa làm.
- (4) Ngưỡng `statusStaleMinutes` trong `.claude/aip-gate.json`, mặc định 30.
- (5) `ledger.mjs` ghi thêm `events.jsonl` (`{"ts": ISO, "line": …}`) cạnh `progress.md` (không đổi định dạng `progress.md`); dòng ledger mới, được `ledger.mjs` kiểm định dạng: `Task <n>: start (base <hash>)`, `Task <n>: review <vòng> <spec_verdict> <blocker>/<major>/<minor>`, `Blocked: <lý do>`, `Unblocked: <cách giải>`. `task-loop.md` và `inline.md` bắt ghi các dòng này (phiên part, subagent part, session gốc).
- (6) Tách xem và hành động: HTML (`status.html`) là nguồn xem chính, luôn được tạo, render ở panel bên; widget inline trong chat (khi phiên có công cụ hiển thị) chỉ gồm khối "Cần bạn xử lý" và nút "Xử lý ↗" gửi lệnh xử lý đúng part vào chat, không vẽ lại dashboard; không có hai thứ trên thì in text.
- (7) Skill `/aip-status` để người dùng bấm xem bất cứ lúc nào: chạy `aip status --json` + `--html`, hiển thị theo (6). Session gốc tự đưa trang ở mỗi cổng và khi có part chuyển sang vướng cần người dùng.
- (8) Xử lý vướng — root tự gỡ, không hỏi: test đỏ sau merge part (vòng sửa trên `feature/<slug>`, tối đa 2 vòng rồi chuyển người dùng); conflict trong write set của part; part im lặng (kiểm phiên/subagent còn chạy; đã chết thì khởi động lại part từ task chưa `complete` trong worktree cũ, giữ thay đổi chưa commit; chỉ một lần, im lặng lần hai chuyển người dùng); câu hỏi trả lời được từ design/plan (ghi `Ruling:`).
- (9) Xử lý vướng — hỏi người dùng: 6 loại dừng của `task-loop.md` (AC mơ hồ/đổi AC, bảo mật, không đảo ngược, ngoài repo, schema DB, plan hỏng → root viết lại plan riêng part, người dùng duyệt một lần như G2 thu nhỏ); conflict ngoài write set (liệt kê file). Mọi câu hỏi gom vào một thẻ, mỗi mục có cách hiểu + hệ quả + đáp án khuyến nghị; part khác chạy tiếp.
- (10) Gửi lời giải về part: phiên part qua `SendMessage`; subagent part giao lại (hoặc subagent mới tiếp từ ledger); luôn ghi `Unblocked: <cách giải>`.
- (11) Mỗi lần vướng chỉ báo một lần (tin nhắn + trang); người dùng chưa trả lời thì không nhắc lại; vướng mới gộp vào cùng thẻ.
- (12) `aip statusline` thêm đoạn `⚠ <n> vướng` (đọc file, không tốn token) khi request đang chạy có part vướng.
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given request chia part có ledger root và ledger part When chạy `aip status` Then in số tổng và bảng part với trạng thái đúng thứ tự ưu tiên (3)
- [ ] **AC1.2** — Given cùng dữ liệu When chạy `aip status --json` Then in JSON có đủ trường của 7 khối
- [ ] **AC1.3** — Given cùng dữ liệu When chạy `aip status --html` Then ghi `status.html` tự chứa (không tải tài nguyên ngoài) có 7 khối
- [ ] **AC1.4** — Given part có phụ thuộc chưa merged When chạy `aip status` Then part đó ở trạng thái chờ part phụ thuộc, không tính là vướng
- [ ] **AC1.5** — Given part đang làm không có dòng ledger hay commit mới quá `statusStaleMinutes` When chạy `aip status` Then part ở trạng thái im lặng quá lâu; thiếu khoá thì ngưỡng 30
- [ ] **AC2.1** — Given `ledger.mjs` ghi một dòng hợp lệ When ghi xong Then `events.jsonl` có thêm một bản ghi `{ts, line}` và `progress.md` không đổi định dạng
- [ ] **AC2.2** — Given dòng `Task <n>: start`, `Task <n>: review …`, `Blocked:`, `Unblocked:` sai định dạng When gọi `ledger.mjs` Then exit 2 và không ghi
- [ ] **AC3.1** — Given phiên root có công cụ hiển thị When người dùng gọi `/aip-status` Then tạo `status.html`, render ở panel, và nếu có vướng thì hiện widget gồm khối "Cần bạn xử lý" với nút "Xử lý ↗"
- [ ] **AC3.2** — Given phiên không có công cụ hiển thị When gọi `/aip-status` Then in text gọn
- [ ] **AC4.1** — Given part vướng thuộc loại root tự gỡ (8) When root xử lý Then không hỏi người dùng, ghi `Ruling:`/`Unblocked:`, và dừng lại hỏi khi vượt giới hạn (2 vòng sửa, 1 lần khởi động lại)
- [ ] **AC4.2** — Given part vướng thuộc loại hỏi người dùng (9) When root xử lý Then gom vào một thẻ có đáp án khuyến nghị, part khác chạy tiếp, lời giải gửi về part và ghi `Unblocked:`
- [ ] **AC4.3** — Given một vướng đã báo When người dùng chưa trả lời Then root không nhắc lại; vướng mới gộp vào cùng thẻ
- [ ] **AC5.1** — Given request đang chạy có part vướng When `aip statusline` chạy Then dòng có `⚠ <n> vướng`
- [ ] **AC6.1** — Given request thử có một part vướng có chủ đích When chạy chế độ part tới G3 Then trang hiện đúng trạng thái, vướng được báo một lần, gỡ xong part tiếp tục và merged
## Thiết kế
- `cli/lib/status.mjs`: đọc design (Bảng part), plan gốc + plan part (`### Task`, `**Interfaces:**`), ledger + `events.jsonl` mọi part, `git log` nhánh part; dựng một mô hình JSON; render text / HTML từ mô hình đó. Zero-dependency, HTML một file có CSS inline, `<meta http-equiv="refresh">` khi `--watch`.
- `core/skills/plan-execution/scripts/ledger.mjs`: `validateLine` thêm 4 dạng dòng; `appendLedger` ghi thêm `events.jsonl`.
- Skill mới `core/skills/aip-status/SKILL.md` (frontmatter + `## Quy trình…` + `## Ranh giới an toàn…`).
- Câu chữ: `task-loop.md` (ghi dòng mới, bảng xử lý vướng, gom câu hỏi, báo một lần), `inline.md` (dòng mới cho subagent part).
- `cli/lib/statusline.mjs`: thêm đoạn vướng.
## Ảnh hưởng spec
- workflows: đổi R8
- workflows: đổi R14
- cli-wizard: thêm R7
- hooks-gates: thêm R17
## Ngoài phạm vi và anti-goal
- Không đọc trạng thái phiên Claude (aip chạy ngoài app); dùng ngưỡng im lặng thay thế.
- Không hiện diff (việc của G3) và không hiện chi phí token (đã có `aip stats --usage`).
- Không publish trang lên dịch vụ ngoài.
## Ràng buộc
- Phụ thuộc request `2026-10-31-autonomy-gates` (khoá `autonomy`, `partRunner`, G1/G2/G3): chỉ lập plan sau khi request đó qua G3 và merge.
- Zero-dependency; bump version `core` (và plugin chứa skill mới), `node cli/lib/versions.mjs --lock`; `npm test` xanh.
## Không đổi
- Định dạng các dòng ledger hiện có; hook `session-start` vẫn đọc `progress.md` như cũ.
- 6 loại dừng của `task-loop.md`.
## Kiểm thử
- AC1.1–AC1.5: test có tham số cho `status.mjs` với fixture request (ledger, plan, design) dựng trong thư mục tạm, git giả.
- AC2.1, AC2.2: test `ledger.mjs` cùng chỗ test ledger hiện có.
- AC5.1: test `statusline.mjs`.
- AC3.1, AC3.2, AC4.1–AC4.3, AC6.1: lượt thử thực tế, ghi `trial-5.md`.
## Để builder quyết
- Bố cục CSS của `status.html` trong khuôn 7 khối.
## Rủi ro và câu hỏi mở
- [Unverified] `<meta refresh>` khi mở `status.html` bằng `file://` và cách panel bên của app render HTML cục bộ.
- [Unverified] Widget inline và panel bên là công cụ của Claude desktop; CLI không có, nên phải giữ text fallback.
- [Inference] Widget nằm cố định trong transcript, không tự cập nhật; vì vậy chỉ dùng cho hành động.
