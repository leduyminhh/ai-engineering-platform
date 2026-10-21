# ADR-0002: Chọn model theo tầng việc và cố định model theo phiên

- Trạng thái: Proposed
- Ngày: 2026-10-21

Nguồn quyết định: người dùng yêu cầu giảm opus, dùng haiku cho việc máy móc, sonnet cho việc có logic, và cần bộ quy tắc điều hướng chuẩn cho engineering platform (2026-10-21).

Liên kết:
- Thiết kế: [`2026-10-21-model-session-routing/design.md`](../requests/2026-10-21-model-session-routing/design.md).

## Bối cảnh

- Các agent của plugin không khai `model`, nên chạy theo model của phiên chính. `default` trên gói Pro/Max/Team/Enterprise là Opus 5.5 ([model-config](https://code.claude.com/docs/en/model-config)), vì vậy reviewer, implementer, fixer đều chạy Opus.
- Một phiên điều phối thật (1 phiên gốc, 3 phiên con, tới 6 subagent) dùng 41% hạn mức 5 giờ trong một buổi; các phiên con đạt 53–75% cửa sổ 1M.
- Prompt cache gắn theo model: đổi model giữa phiên làm request kế tính lại toàn bộ ([prompt-caching](https://code.claude.com/docs/en/prompt-caching)). Cách "đổi sang model rẻ khi thấy tốn" giữa phiên vì vậy có thể đắt hơn giữ nguyên.
- Subagent có context riêng và không đọc cache của phiên cha; chọn model cho subagent không làm mất cache phiên cha ([prompt-caching](https://code.claude.com/docs/en/prompt-caching)).
- Thứ tự chọn model của subagent: tham số lúc gọi → frontmatter → `CLAUDE_CODE_SUBAGENT_MODEL` → model của phiên chính ([sub-agents](https://code.claude.com/docs/en/sub-agents)).

## Các lựa chọn đã cân nhắc

1. **A. Giữ kế thừa model, chỉ ghi khuyến nghị trong README.**
   - Ưu: không đổi code.
   - Nhược: không ai đọc README lúc gọi agent; agent vẫn chạy Opus khi phiên chạy Opus.
2. **B. Khai `model` trong frontmatter mọi agent + quy tắc phiên trong baseline `AGENTS.md` + validate thiếu `model` — chọn.**
   - Ưu: model đúng tầng ngay cả khi người dùng không cấu hình gì; quy tắc phiên đi kèm mọi project cài aip; validate chặn agent mới quên khai.
   - Nhược: đặt cứng `sonnet` có thể chưa đủ cho review khó; bù bằng nâng `opus` qua tham số lúc gọi.
3. **C. Đặt `CLAUDE_CODE_SUBAGENT_MODEL` trong settings do aip ghi.**
   - Ưu: một chỗ cấu hình cho mọi subagent, kể cả ngoài plugin.
   - Nhược: aip không quản settings người dùng (nguyên tắc chỉ chuẩn hoá và phân phối); ghi đè cấu hình riêng của người dùng.
4. **D. Hook chặn đổi model giữa phiên.**
   - Ưu: chặn cứng việc mất cache.
   - Nhược: Claude Code đã tự hỏi xác nhận khi cache còn ấm; thêm hook là trùng.

## Quyết định

Chọn B. Mọi agent của plugin khai `model` (mặc định `sonnet`); việc máy móc gọi subagent `haiku` bằng tham số lúc gọi; `opus` chỉ dùng cho phiên điều phối gốc hoặc khi sonnet thất bại, có ghi lý do. Baseline `AGENTS.md` có mục "Model and session routing": chọn model lúc tạo phiên, không đổi giữa chừng; xoay phiên theo gói việc; gom tin giữa phiên; không dùng cron dày.

C chỉ ghi thành hướng dẫn trong README (người dùng tự đặt). D để sau.

## Hệ quả

- Agent của plugin chạy Sonnet kể cả khi phiên chính chạy Opus.
- Project cài aip nhận quy tắc phiên qua managed block, không phải nhắc lại trong từng `CLAUDE.md`.
- Agent mới thêm vào plugin phải khai `model`, nếu không `validate.mjs` báo lỗi.
- Rủi ro: Sonnet có thể bỏ sót lỗi tinh vi ở review; quy tắc nâng `opus` cho review toàn phase và bảo mật trước release bù lại.
- Cần kiểm lại con số TTL, hệ số giá khi Claude Code đổi tài liệu; trọng số cache read trong hạn mức gói chưa kiểm được [Unverified].
