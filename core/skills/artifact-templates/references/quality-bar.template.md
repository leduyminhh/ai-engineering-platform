<!-- artifact-template
type: quality-bar
version: 1
validator: chưa có
sources: docs/requests/2026-11-10-agent-skills-gap-closure/design.md (D4)
Ghi bản điền ở <gốc repo>/project-knowledge/quality-bar.md; không nằm trong references/project-knowledge/ nên aip init --full không chép.
Bỏ khối này khi chép template ra dùng.
-->

# Quality bar — <tên project>

Sửa file này đi qua review như code; mọi chỗ nới hiện ở mục "Dấu hiệu nới kiểm" của review package.

## Lệnh kiểm

Ngưỡng dạng `exit 0`, `<chỉ số> >= <số>` hoặc `<chỉ số> <= <số>`.

| Lệnh | Ngưỡng | Owner |
|---|---|---|
| `<lệnh test>` | exit 0 | <người hoặc nhóm> |
| `<lệnh đo coverage>` | coverage >= <số> | <người hoặc nhóm> |
| `<lệnh lint>` | warnings <= <số> | <người hoặc nhóm> |

## Ngoại lệ

`Hạn` bắt buộc, dạng `yyyy-mm-dd`.

| Ngoại lệ | Lý do | Owner | Hạn |
|---|---|---|---|
| <tên ngoại lệ> | <lý do> | <người hoặc nhóm> | <yyyy-mm-dd> |
