# Thiết kế: aip statusline
- Ngày: 2026-10-29
- Trạng thái: approved — người dùng yêu cầu làm B8 ngày 2026-10-29 (backlog của `2026-10-23-eval-coverage-and-upgrade`)
- Requirement: không có
## Vấn đề và lý do
Baseline (`AGENTS.md`, mục Model and session routing) bắt người dùng xoay phiên theo ngưỡng context (mềm ~40%, cứng ~60%) và cảnh báo phiên rảnh quá TTL của cache, nhưng chỉ có người hoặc statusline đọc được `context_window.used_percentage`. Chưa có statusline nào bám các ngưỡng của baseline. Người dùng phải tự viết script và nhớ ngưỡng.
## Quyết định đã chốt
- Thêm lệnh `aip statusline`: đọc JSON của Claude Code từ stdin, in một dòng.
- Chỉ dùng các trường Claude Code đã gửi sẵn trong stdin: `model.display_name`, `context_window.used_percentage`, `prompt_cache` (`warm`, `expires_at`, `hit_ratio`, `caching_observed`), `cost.total_cost_usd`, `rate_limits.five_hour.used_percentage`. Không đọc transcript.
- Không tự ghi `settings.json`: README ghi sẵn khối `statusLine` để người dùng dán.
## Thiết kế
- `cli/lib/statusline.mjs`: hàm thuần `renderStatusline(input, { nowMs, soft, hard, color })`, không I/O, không ném lỗi với đầu vào bất kỳ (đầu vào không phải object cho dòng rỗng).
- Định dạng: `Opus │ ctx 43% ⚠ bàn giao sau gói │ cache 38m 91% │ $1.23 │ 5h 23%`; phân đoạn thiếu dữ liệu thì bỏ, riêng context thiếu thì in `ctx --`.
- Ngưỡng: mặc định `--soft 40`, `--hard 60` (cùng giá trị baseline, [Inference] chưa kiểm thực nghiệm); `--soft`/`--hard` phải là số trong 1–100 và soft < hard, sai thì báo lỗi ra stderr, thoát mã 2.
- Màu ANSI bật mặc định (Claude Code hiển thị được), tắt bằng `NO_COLOR` hoặc `--no-color`.
- Cache: còn ấm in số phút còn lại tính từ `expires_at`; ≤ 5 phút tô vàng; nguội in `cache nguội` tô đỏ; không có `prompt_cache` hoặc `caching_observed: false` thì bỏ phân đoạn.
- Lệnh luôn thoát mã 0 với stdin hỏng hoặc rỗng để statusline không làm vỡ giao diện.
- Cấu hình người dùng dán: `{"statusLine":{"type":"command","command":"aip statusline","refreshInterval":60}}`; `refreshInterval` giữ phút còn lại của cache không đứng yên khi phiên rảnh.
## Ảnh hưởng spec
- cli-wizard: thêm R5
## Ngoài phạm vi và anti-goal
- Không đọc hoặc parse transcript mỗi lần cập nhật: statusline chạy sau mỗi tin assistant và phải nhanh.
- Không hiển thị chi phí subagent hay theo model (cần transcript; xem `aip stats --usage`).
- Không tự cài hay sửa `settings.json`.
## Ràng buộc
- Zero dependency, không I/O ngoài stdin/stdout; nội dung hướng người dùng bằng tiếng Việt có dấu.
- Các trường stdin theo tài liệu statusline của Claude Code; `prompt_cache` cần v2.1.251 trở lên, thiếu thì bỏ phân đoạn.
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given stdin JSON có `context_window.used_percentage` lần lượt 30, 45, 62, When chạy `aip statusline`, Then dòng in `ctx 30%`, `ctx 45% ⚠ bàn giao sau gói`, `ctx 62% ‼ bàn giao ngay`, và `--soft`/`--hard` đổi các ngưỡng đó.
- [ ] **AC1.2** — Given `prompt_cache` ấm với `expires_at` còn 38 phút, nguội, hoặc vắng, When chạy lệnh, Then dòng in `cache 38m`, `cache nguội`, hoặc không có phân đoạn cache.
- [ ] **AC1.3** — Given stdin rỗng, JSON hỏng hoặc không phải object, When chạy lệnh, Then thoát mã 0 và không in stack trace.
- [ ] **AC1.4** — Given `--soft 70 --hard 60` hoặc giá trị không phải số, When chạy lệnh, Then stderr nêu lỗi và thoát mã 2.
## Kiểm thử
- AC1.1–AC1.4: `test/statusline.test.mjs` (hàm thuần cho AC1.1–AC1.2; chạy CLI thật qua stdin cho AC1.3–AC1.4; `parse()` cho cờ mới). Thêm vào `npm test`.
## Rủi ro và câu hỏi mở
- [Unverified] Chưa chạy trong Claude Code thật: định dạng đầu ra theo tài liệu (nhiều dòng, ANSI, OSC 8 được hỗ trợ), chưa quan sát hiển thị.
- Ngưỡng 40/60 lấy từ baseline và chưa kiểm thực nghiệm.
- Trường `prompt_cache` và `rate_limits` chỉ có ở một số gói/phiên bản; vắng thì bỏ.
