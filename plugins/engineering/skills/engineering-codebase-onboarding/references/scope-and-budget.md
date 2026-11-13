# Phạm vi, nhóm và ngân sách đọc

Session chính đọc file này ở bước 1–2 (đọc trường kiểm kê) và khi dựng nhóm giao subagent ở bước 3. Mọi con số ngoài trường kiểm kê là `[giả định]`, hiệu chỉnh ở lần chạy thật và ghi vào báo cáo cuối.

## Trường của `inventory-modules.mjs`

Lệnh: `node <thư mục skill>/scripts/inventory-modules.mjs <gốc> --format json`. Đầu ra JSON có các trường sau.

| Trường | Cấp | Ý nghĩa |
|---|---|---|
| `modules[].id` | module | Tên module: `artifactId` (Maven), tên package (npm), tên thư mục khi thiếu |
| `modules[].path` | module | Đường dẫn từ gốc; `.` là gốc |
| `modules[].kind` | module | `maven`, `gradle`, `npm` hoặc `python` |
| `modules[].buildFile` | module | Build file đã mở để lấy tên và phụ thuộc |
| `modules[].sourceFiles` | module | Số file mã nguồn, không tính file test |
| `modules[].testFiles` | module | Số file test; không tính vào `lines` |
| `modules[].lines` | module | Tổng dòng của `sourceFiles` |
| `modules[].hasReadme` | module | Thư mục module đã có `README.md` |
| `modules[].declaredDeps` | module | Module anh em được khai báo phụ thuộc. Đây là khai báo, không phải lời gọi |
| `unclaimed` | gốc | Thư mục cấp một có file nhưng không thuộc module nào |
| `rootFiles` | gốc | Số file mã nguồn nằm ở gốc, ngoài mọi module |
| `projectKnowledge` | gốc | Bốn file `project-knowledge/`: `true` khi đã có |
| `notes` | gốc | Cảnh báo: không nhận ra build file, hoặc `include` động trong Gradle |

Không nhận ra build file nào thì `modules` rỗng, `notes` có một dòng, lệnh vẫn thoát 0. Khi đó kiểm kê tay ở cổng 1 và ghi rõ vào bảng.

## Sở hữu file

- File thuộc module có đường dẫn sâu nhất chứa nó. Module con không bị đếm lại ở module cha.
- Module tổng hợp (pom cha, workspace gốc) không nằm trong `modules`, không có README riêng. Phần nội dung của nó nằm ở README gốc.
- File ngoài mọi module nằm trong thư mục cấp một thì vào `unclaimed` theo tên thư mục đó.
- File mã nguồn nằm ở gốc, ngoài mọi module, chỉ được đếm vào `rootFiles`. Build file và tài liệu ở gốc không được đếm.

## Nhóm và trần

- Trần một nhóm: `sourceFiles` ≤ 150 và `lines` ≤ 15.000 `[giả định]`.
- Gộp các module nhỏ vào cùng nhóm cho đến khi chạm một trong hai trần. Một module vượt trần thì nằm riêng và chia phần.
- Chia module vượt trần theo thư mục con cấp một bên trong module (ví dụ `src/` với npm, thư mục package với Python). File nằm trực tiếp ở gốc module gom vào một phần riêng `[giả định]`.
- Mỗi phần ghi vào `.aip/runs/onboarding-<slug>/parts/<module>/<tên-phần>.md`. Subagent ghép bằng prompt 2 trong `subagent-prompts.md`. Phần nào vẫn vượt trần thì không chia thêm; ghi vào `not_read` với lý do ngân sách.
- Hai nhóm không chung thư mục. Ghi số nhóm và số file, dòng của từng nhóm ở cổng 1.

## Mức đọc

Bắt buộc, làm trước trong ngân sách:

1. README có sẵn của module (nếu `hasReadme`).
2. Build file: lấy tên và phụ thuộc từ trường kiểm kê, không mở `pom.xml`, `build.gradle`, `settings.gradle`.
3. Điểm vào: file tên chứa `Application`, `Main`, `main`, `index`, `app`, `server`, `Program`.
4. Route: file khai báo route, controller hoặc router (liệt kê bằng Glob hoặc Grep, chỉ lấy tên file).
5. Tên khoá cấu hình, bằng lệnh trong `secret-safety.md`. Không mở giá trị.
6. Dockerfile của module (hoặc của gốc khi module là gốc), nếu có; theo luật mục E của `subagent-prompts.md`.
7. File CI ở gốc, chỉ phần lệnh build và test; theo luật mục E của `subagent-prompts.md`.

Mở rộng trong ngân sách: các file còn lại theo thư mục cấp một, ưu tiên file có lời gọi tới module khác (tìm bằng Grep, chỉ lấy danh sách file).

Ngân sách:

- Tối đa 60 lần gọi công cụ mỗi subagent `[giả định]`. Khi còn 5 lần, ngừng đọc và viết phần đã có.
- Hết ngân sách: liệt kê file hoặc thư mục chưa đọc vào `not_read` kèm lý do `ngân sách`.
- Tối đa 6 subagent chạy song song `[giả định]`.
- Reviewer tối đa 30 lần gọi `[giả định]`.
- Báo cáo cuối ghi số lần gọi thực tế của từng subagent để hiệu chỉnh con số này.
