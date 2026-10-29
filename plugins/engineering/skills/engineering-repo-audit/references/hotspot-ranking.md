# Xếp hạng điểm nóng — chọn chỗ đáng đọc khi không có diff

Tài liệu tham chiếu cho `engineering-repo-audit`. Mục tiêu: dùng **tín hiệu rẻ** (lịch sử git, kích thước,
test tương ứng) để chọn 10–20 file đọc kỹ, thay vì đọc ngẫu nhiên.

## Tín hiệu

| Tín hiệu | Ý nghĩa | Cách lấy (POSIX / PowerShell) |
|---|---|---|
| **Churn** | File hay bị sửa thường là nơi logic còn đổi và dễ lỗi | `git log --since=6.months --name-only --pretty=format: \| sort \| uniq -c \| sort -rn \| head -30` / `git log --since=6.months --name-only --pretty=format: \| Where-Object { $_ } \| Group-Object \| Sort-Object Count -Descending \| Select-Object -First 30` |
| **Kích thước** | File rất dài thường gom nhiều trách nhiệm | `git ls-files \| xargs wc -l \| sort -rn \| head -30` / `git ls-files \| ForEach-Object { [pscustomobject]@{ Lines=(Get-Content $_ \| Measure-Object -Line).Lines; File=$_ } } \| Sort-Object Lines -Descending \| Select-Object -First 30` |
| **Thiếu test** | Module có churn cao mà không có test tương ứng | Với mỗi ứng viên, tìm file test theo quy ước của project (`FooTest`, `foo.test.ts`, `test_foo.py`) bằng `git ls-files` |
| **Tác giả đơn lẻ** | Chỉ một người từng sửa: rủi ro tri thức | `git shortlog -sn -- <đường dẫn>` |

`git ls-files` chỉ liệt kê file đã theo dõi nên tự loại `node_modules/`, `build/`, `target/`. Vẫn bỏ qua file sinh tự
động, file khoá (`package-lock.json`), file vendored và dữ liệu mẫu.

## Điểm nóng = giao của các tín hiệu

Xếp mỗi ứng viên theo số tín hiệu nó vượt ngưỡng của repo (top 20% churn, top 20% kích thước, không có test).
Ba tín hiệu cùng lúc xếp đầu; hai tín hiệu xếp tiếp. Ghi vào báo cáo **lý do** chọn từng file để người đọc
kiểm được.

## Ngân sách đọc

| Cỡ repo (file đã theo dõi) | Số file đọc kỹ | Ghi chú |
|---|---|---|
| ≤ 200 | 10 | đọc được hầu hết lõi nghiệp vụ |
| 200–2000 | 15 | thêm một lượt lướt tên file để thấy cấu trúc |
| > 2000 | 20, và hỏi người dùng khoanh một cây con | repo lớn không audit một lượt được |

Số này là **mặc định tự đặt**, không phải chuẩn; người dùng nói ngân sách khác thì theo người dùng.

## Khi không có tín hiệu churn

Repo mới, shallow clone (`git rev-parse --is-shallow-repository` trả `true`), không phải repo git, hoặc phiên
không có công cụ chạy lệnh (chỉ đọc/tìm file): bỏ tín hiệu churn và tác giả, xếp theo kích thước (liệt kê file bằng
công cụ tìm file, ước lượng cỡ khi mở) và thiếu test. **Nói rõ trong báo cáo** rằng điểm nóng được chọn không có
tín hiệu lịch sử.
