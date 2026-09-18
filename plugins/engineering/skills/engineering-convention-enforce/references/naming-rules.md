# Kiểm đặt tên — đối chiếu tên với convention của project

Mục tiêu: xác nhận **tên file / thư mục / định danh** bám quy ước trong `project-knowledge/code-convention.md`
và idiom của stack, để một người đọc **suy ra được phạm vi + hành động từ tên**. Nguồn chuẩn là
`code-convention.md` **của project**; phần dưới là *cách đối chiếu*, KHÔNG phải bộ luật thay thế.

## Nguyên tắc gốc

- Tên phải cho phép **suy ra phạm vi (domain) + hành động (action)** mà không cần mở file.
- Ưu tiên tên **xác định, dễ kiểm** (đúng một quy tắc case + ký tự cho phép), tránh tên mơ hồ, viết tắt tuỳ hứng.
- **Metadata phải khớp identity**: `name` trong frontmatter/manifest khớp tên thư mục/file; tên class/module khớp
  tên file theo idiom stack. Lệch tên (name drift) làm hỏng khả năng khám phá + đối chiếu.

## Các trục cần đối chiếu

1. **Case & ký tự.** So với quy ước project + idiom stack: kebab-case cho thư mục/skill; snake_case hay camelCase
   cho định danh tuỳ ngôn ngữ; PascalCase cho class/type nếu stack quy định. Cờ đỏ: gạch dưới/khoảng trắng/hoa-thường
   trộn/tiền tố nhập nhằng sai với quy ước đã chốt.
2. **Tiền tố / hậu tố bắt buộc.** Nhiều project ràng buộc hậu tố theo vai trò (ví dụ `*Service`, `*Repository`,
   `*.test.*`, `*.spec.*`) hoặc tiền tố module. Đối chiếu đúng quy ước project, không tự áp quy ước ngoài.
3. **Khớp tên ↔ định danh.** Tên file khớp tên thực thể chính bên trong (class/component/hàm export) theo idiom
   stack; `name` metadata khớp tên thư mục. Đây là loại lệch hay gặp và dễ kiểm.
4. **Từ vựng nhất quán.** Cùng khái niệm dùng cùng một từ trong toàn codebase (không lẫn `user`/`account`/`member`
   cho cùng một thực thể nếu convention đã chốt một từ). Ghi nhận biến thể gây nhập nhằng.
5. **Không dấu tiếng Việt trong tên file/định danh** (trừ khi project quy định khác); nội dung tài liệu vẫn tiếng
   Việt có dấu, nhưng *tên file* giữ ASCII kebab/slug.

## Loại lệch phổ biến (mỗi lệch cần evidence + rule nguồn)

- Sai case / dùng ký tự cấm so với quy ước (path + rule).
- Thiếu/thừa tiền tố-hậu tố vai trò mà convention yêu cầu (`file:line` khai báo + rule).
- `name` metadata **khác** tên thư mục/file (chỉ rõ cả hai giá trị).
- Tên không suy ra được phạm vi/hành động (mơ hồ: `utils2`, `tmp`, `data_final`).
- Đặt cùng khái niệm bằng nhiều từ khác nhau gây nhập nhằng.

## Ghi nhận khi báo cáo

Mỗi điểm lệch: **path/`file:line`** · **rule nguồn** (trích ngắn quy tắc trong `code-convention.md`) ·
**hiện tại → đề xuất**. Mục `code-convention.md` **không quy định rõ** → đánh dấu **[giả định]** và **hỏi**,
KHÔNG tự phán là lệch. KHÔNG tự đổi quy ước đặt tên (đổi là ADR → `engineering-adr`).

Ví dụ một finding thật:

| path:line | rule nguồn | hiện tại → đề xuất |
|---|---|---|
| `src/service/utils2.py:1` | `code-convention.md` §2: "tên module suy ra được domain + trách nhiệm" | `utils2` (mơ hồ, không rõ chứa gì) → `payment_formatting` (đúng nội dung: hàm format số tiền/currency) |
