<!-- artifact-template
type: project-knowledge
version: 1
validator: chưa có
sources: Chuyển nguyên từ templates/init/project-knowledge (giữ nội dung); tech-stack.yml không có khối header
Bỏ khối này khi chép template ra dùng.
-->

# Code Convention (BẮT BUỘC)

> Đây là CHUẨN code RÀNG BUỘC của project. Mọi code (người hoặc AI sinh ra) PHẢI tuân thủ.
> Quyết định chốt convention: xem docs/decisions/0002-code-convention.md.
> Nguồn sự thật khi lệch: file này + config lint/format > thói quen cá nhân.
> Điền theo stack thực tế — KHÔNG để placeholder khi đã chốt.

## 0. Nguyên tắc
- Convention là bắt buộc, không tùy chọn. Lệch chuẩn = lỗi phải sửa trước khi commit.
- Ưu tiên tự động hoá: formatter + linter quyết định, không tranh luận style thủ công.

## 1. Đặt tên
| Đối tượng | Quy ước | Ví dụ |
|---|---|---|
| File / thư mục | <vd kebab-case / snake_case> | <...> |
| Class / Type | <vd PascalCase> | <...> |
| Hàm / method | <vd camelCase, động từ> | <...> |
| Biến | <vd camelCase, danh từ> | <...> |
| Hằng số | <vd UPPER_SNAKE_CASE> | <...> |
| Module / package | <...> | <...> |
- Tên rõ nghĩa, không viết tắt khó hiểu; tránh ký hiệu/tiền tố thừa.

## 2. Format & Lint (tự động, bắt buộc)
- Formatter: <vd Prettier / gofmt / Black / Spotless> — config: `<đường dẫn>`.
- Linter: <vd ESLint / golangci-lint / Ruff / Checkstyle> — config: `<đường dẫn>`.
- Lệnh chạy: `<lệnh format>` và `<lệnh lint>`.
- Quy ước cơ bản: indent <space/tab + size>, max line <n>, trailing comma <...>, quote <...>.
- Bắt buộc chạy format + lint TRƯỚC commit; CI chặn nếu fail (xem CONTRIBUTING.md).

## 3. Cấu trúc file & module
- Tuân theo phân tầng kiến trúc của dự án (xem architecture.md / source-structure.md). KHÔNG gọi ngược tầng.
- Một file một trách nhiệm; thứ tự khai báo trong file: <vd import → type → public → private>.
- Import: <thứ tự nhóm / cấm import vòng / cấm reach-in module khác>.

## 4. Xử lý lỗi & log
- Cách trả lỗi: <vd exception / Result; map sang mã lỗi theo docs/contracts/>.
- KHÔNG nuốt lỗi im lặng; log có context, KHÔNG log dữ liệu nhạy cảm/bí mật.
- Mức log: <error/warn/info/debug — khi nào dùng>.

## 5. Comment & tài liệu
- Docstring/comment cho public API: <chuẩn vd JSDoc / GoDoc / docstring>.
- Comment giải thích "tại sao", không lặp lại "cái gì" code đã rõ.

## 6. Test
- Framework: <...>; đặt tên test: <vd should_..., Test_...>.
- Vị trí: <cạnh module / tests/>; tối thiểu cover: <nhánh nghiệp vụ chính + lỗi>.

## 7. Phụ thuộc
- Thêm lib mới phải có lý do + ghi vào tech-stack.yml; ưu tiên thư viện chuẩn.
