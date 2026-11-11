# Cỡ task — cách đọc điều kiện

Chi tiết cho mục "Cỡ task và review từng task" của [task-loop.md](task-loop.md). Chỉ đọc khi cần xếp một task vào cỡ Nhỏ hay Lớn.

## Đọc từng điều kiện cỡ Nhỏ

| Điều kiện | Đọc ở đâu | Ghi chú |
|---|---|---|
| `Kind` là `FE-UI` hoặc `TOOLING` | dòng `**Kind:**` | `FE-INT` (nối API thật) và `DOCS` là cỡ Lớn dù ít file. |
| `**TDD:** không` | dòng `**TDD:**` | Task có test đỏ → xanh là cỡ Lớn: lỗi logic cần review sớm. |
| Không quá 5 file production | các dòng `Modify`/`Create` trong `**Files:**` | Không đếm dòng `Test:`; file test và fixture không tính vào trần 5. |
| Không đường dẫn nhạy cảm | toàn bộ `**Files:**` | Nhạy cảm: thư mục migration, mã auth hoặc phân quyền, secret hoặc credential, cấu hình CI, hook; cộng việc đổi contract API (OpenAPI, schema message) hoặc schema dữ liệu. |

Nghi ngờ một đường dẫn có nhạy cảm không thì coi là có: nâng lên cỡ Lớn tốn một lượt review, hạ nhầm xuống cỡ Nhỏ có thể để lọt lỗi tới review cuối.
