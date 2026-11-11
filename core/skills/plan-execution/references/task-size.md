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

## Đối chiếu diff sau commit

Cỡ tính từ `**Files:**` do plan khai, mà plan có thể sót, nên task cỡ Nhỏ được kiểm lại bằng diff thật. Tóm tắt luật ở mục cỡ task của [task-loop.md](task-loop.md); phần này nêu cách làm.

1. Chạy `git diff --name-only <BASE>..HEAD`, với BASE là hash ghi ở dòng `Task <n>: start` của ledger.
2. So từng file với danh sách `**Files:**` (kể cả dòng `Test:`). Có file ngoài danh sách, hoặc file nằm ở đường dẫn nhạy cảm: nâng lên Lớn và giao review thường. Không có thì task giữ cỡ Nhỏ.
3. Task giữ cỡ Nhỏ thì ghi dòng `Task <n>: complete (commits <a>..<b>, review cuối — cỡ nhỏ)`. Dòng này không bắt đầu bằng `Task <n>: review`, vì `ledger.mjs` chỉ nhận dạng dòng review có vòng và verdict.

Phạm vi: các chế độ còn review từng task, tức tuần tự không part và part chạy Phiên riêng (`partRunner: session`) hoặc Tuần tự trong session gốc. Chế độ inline và part chạy Subagent (`partRunner: subagent`) không đổi: chúng bỏ review từng task ở mọi cỡ và ghi dòng `complete` riêng của `inline.md`.
