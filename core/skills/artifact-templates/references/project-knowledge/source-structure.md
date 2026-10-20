<!-- artifact-template
type: project-knowledge
version: 1
validator: chưa có
sources: Chuyển nguyên từ templates/init/project-knowledge (giữ nội dung); tech-stack.yml không có khối header
Bỏ khối này khi chép template ra dùng.
-->

# Source Structure

> Thư mục ROOT của mã nguồn: `src/` — mọi code chạy được nằm trong đây.
> NGUỒN SỰ THẬT về cây thư mục: CÂY THỰC TẾ trong `src/` > file này khi lệch.
> Quyết định chọn root + quy ước module: xem docs/decisions/0001-*.md.

## Root & quy ước module
- Root mã nguồn: `src/`  (monorepo nhiều app: thay bằng `apps/` + `packages/`).
- Mỗi module = một thư mục con TỰ CHỨA: `src/<ten-module>/`, tách theo nghiệp vụ.
- Code dùng chung: `src/shared/`.
- Test: cạnh module hoặc gom ở `tests/` — ghi rõ đã chọn cách nào.

## Cây thư mục mã nguồn

    src/
    ├── shared/            # type, util, config dùng chung
    ├── <module-a>/        # <vai trò nghiệp vụ module A>
    ├── <module-b>/        # <vai trò nghiệp vụ module B>
    └── <module-c>/        # <...>

## Danh mục module (CẬP NHẬT mỗi khi thêm module)
| Module | Thư mục | Trách nhiệm | Phụ thuộc |
|---|---|---|---|
| <module-a> | src/<module-a>/ | <...> | shared |
| <module-b> | src/<module-b>/ | <...> | shared, <module-a> |

## Quy ước đặt tên
<đặt tên thư mục/file/symbol theo convention của stack>

## Ranh giới module (bắt buộc)
- Module CHỈ giao tiếp qua API công khai của module khác hoặc qua `src/shared/`.
- KHÔNG import trực tiếp file nội bộ của module khác (no reach-in).
- Thêm module mới: tạo `src/<ten>/`, thêm dòng vào bảng trên, khai báo phụ thuộc.
