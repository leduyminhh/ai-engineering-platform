# ADR-0003: Kiểm soát context phiên chạy dài bằng file bàn giao và giảm số lượt

- Trạng thái: Proposed
- Ngày: 2026-10-21

Nguồn quyết định: người dùng yêu cầu (qua phiên content-automation-platform, 2026-10-21) ghi vấn đề phiên chạy dài ngốn hạn mức vào engineering platform để nâng cấp luồng làm việc.

Liên kết:
- Thiết kế: [`2026-10-21-long-session-context/design.md`](../requests/2026-10-21-long-session-context/design.md).
- Nối tiếp [ADR-0002](0002-model-and-session-routing.md) (chọn model, xoay phiên mức nguyên tắc).

## Bối cảnh

- Một buổi điều phối thật dùng 94% hạn mức 5 giờ sau ~8 giờ với 1 phiên gốc, 3–4 phiên con và tới 6 subagent; context phiên gốc 685K, phiên con 477–738K trên cửa sổ 1M.
- Mỗi request gửi lại toàn bộ hội thoại; cache đọc lại vẫn tính vào usage ([costs](https://code.claude.com/docs/en/costs#why-usage-climbs-in-a-long-session)). Chi phí chính là số lượt nhân với độ lớn context.
- Số đo thành phần context của root (~363K, đã loại trùng): nhắc nhở hệ thống tự chèn 30% (76 thông báo phiên con xong lượt, nạp lại file hướng dẫn), kết quả công cụ 29%, lời gọi công cụ 20%, lời của root 15%. Phần chênh với `get_usage` (578K) chưa giải thích được [Unverified].
- Cache có TTL: 1 giờ cho phiên chính trên subscription, 5 phút cho subagent; phiên rảnh quá TTL rồi bị đánh thức thì đọc lại toàn bộ không cache ([prompt-caching](https://code.claude.com/docs/en/prompt-caching#cache-lifetime)). Nén (compaction) là một request lớn, đắt nhất khi mở lại phiên nguội.
- Hook `SessionStart` chèn được context (tối đa 10.000 ký tự) và khi `resume` nhận `context_tokens`, `prompt_cache_likely_expired`, `estimated_cache_write_usd`; hook `Stop` và `PreCompact` không có trường dung lượng context; chỉ statusline nhận `context_window.used_percentage` ([hooks](https://code.claude.com/docs/en/hooks#sessionstart), [statusline](https://code.claude.com/docs/en/statusline)).

## Các lựa chọn đã cân nhắc

1. **A. Chỉ ghi khuyến nghị trong tài liệu, không đổi quy tắc.**
   - Ưu: không tốn công.
   - Nhược: không ai đọc lúc đang điều phối; vấn đề lặp lại.
2. **B. Quy tắc mềm trong baseline + file bàn giao chuẩn + hook tuỳ chọn — chọn.**
   - Ưu: nhắm đúng nguồn tăng (số lượt, kết quả công cụ dài, nạp lại file); xoay phiên bằng file thay vì kế thừa hội thoại; hook chỉ bật khi người dùng muốn.
   - Nhược: là chỉ dẫn mềm, phụ thuộc agent tuân thủ; ngưỡng xoay phiên chưa kiểm thực nghiệm.
3. **C. Hạ `autoCompactWindow` toàn cục để ép nén sớm.**
   - Ưu: trần mỗi request thấp hơn.
   - Nhược: nén thường xuyên hơn, mỗi lần là một request lớn và mất chi tiết; là cấu hình người dùng, aip không ghi thay. Giữ làm lưới an toàn do người dùng chọn.
4. **D. Hook `Stop` tự đo context từ transcript để nhắc bàn giao.**
   - Ưu: tự động.
   - Nhược: không có trường dung lượng; transcript ghi trễ và có mục lưu trùng nên số lệch ~2×; dễ báo sai. Không chọn.
5. **E. Hook `PreCompact` chặn nén tự động.**
   - Nhược: chặn thì phiên tiếp tục phình; không giữ được thông tin. Không chọn.

## Quyết định

Chọn B:
- Quy tắc mềm trong baseline (mở rộng sau khi thiết kế được duyệt): báo cáo dài ghi vào file và tin một dòng; kết quả công cụ ở phiên điều phối luôn có giới hạn; chạy foreground khi bước kế phụ thuộc kết quả; phiên con chỉ báo khi xong cả gói, bị chặn hoặc cần người dùng quyết; xoay phiên theo ngưỡng mềm (~40%) và cứng (~60%) [Inference] bằng file `handoff.md`; phiên rảnh quá 1 giờ thì mở phiên mới từ `handoff.md`; ghi % context ở mỗi cổng phase; giữ phần nạp cố định gọn.
- Chuẩn hoá `handoff.md` (template trong `artifact-templates`) đặt trong thư mục request đang chạy.
- Hook `SessionStart` (nạp `handoff.md`, cảnh báo khi resume phiên nguội) là đề xuất tuỳ chọn, mặc định tắt, người dùng chọn.
- Cấu hình nén (`autoCompactWindow`, `CLAUDE_CODE_AUTO_COMPACT_WINDOW`) chỉ ghi thành hướng dẫn kèm đánh đổi; aip không ghi settings người dùng.

Chưa hiện thực gì cho tới khi người dùng duyệt thiết kế.

## Hệ quả

- Project cài aip nhận quy tắc phiên dài qua managed block mà không phải nhắc lại trong từng CLAUDE.md.
- Cần thêm template `handoff.md` và mở rộng mục baseline "Model and session routing"; core được bump khi hiện thực.
- Nếu người dùng chọn hook: cần thêm `SessionStart` vào `HOOK_EVENTS` và `checkHooksJson`, thêm cấu hình trong `.claude/aip-gate.json`.
- Rủi ro: ngưỡng 40%/60% chưa kiểm thực nghiệm; chạy foreground có thể làm phiên đứng chờ lâu; xoay phiên bằng file mất sắc thái hội thoại nếu `handoff.md` thiếu chi tiết.
- Cần kiểm lại tên trường hook, tên setting và con số TTL khi Claude Code đổi tài liệu; trọng số cache read trong hạn mức gói chưa kiểm được [Unverified].
