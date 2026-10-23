# Docs

`docs/` chứa tài liệu ổn định của repo, cần tồn tại lâu hơn một task hay PR. KHÔNG
dùng làm nơi đổ report sinh tự động.

> English: xem [README.md](README.md).

## Cấu trúc

| Thư mục | Vai trò | Vòng đời |
| --- | --- | --- |
| `specs/<năng-lực>/spec.md` | Spec sống: hành vi hiện tại của một năng lực, có ID `R<n>`. | Dài hạn |
| `decisions/` | ADR: vì sao chọn thiết kế đó. | Dài hạn |
| `requests/<yyyy-mm-dd>-<slug>/` | `design.md` (và `plan.md` khi đang làm) của một thay đổi. Dòng `Trạng thái` trong `design.md` ghi tình trạng. | Ngắn hạn |

## Vòng đời request

- `plan.md` là checklist thực thi: xoá sau khi thay đổi đã merge.
- `design.md` giữ lại khi còn spec hoặc ADR link tới làm nguồn; phần dài hạn chuyển vào `specs/` hoặc `decisions/`.

## Thuộc về đây

- Tài liệu kiến trúc / thiết kế giải thích vì sao repo có hình hài hiện tại.
- Ghi chú bàn giao lâu dài cho maintainer sau này.

## Không thuộc về đây

- Output lệnh tạm, report quét, hay ghi chú debug cục bộ.
- Tài liệu dùng của riêng plugin — để trong thư mục plugin sở hữu.

## Checklist thay đổi

- Giữ mọi khẳng định truy vết được về code, config, test, hoặc quyết định tường minh.
- Cập nhật `README.md` (EN) trước, rồi đồng bộ `README_VI.md`.
