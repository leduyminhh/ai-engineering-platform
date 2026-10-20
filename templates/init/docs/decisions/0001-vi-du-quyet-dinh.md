# ADR-0001: Chốt root mã nguồn và quy ước module

- Trạng thái: Accepted
- Ngày: <yyyy-mm-dd>
- Người quyết định: <tên>

## Bối cảnh và vấn đề

Cần chốt thư mục ROOT của mã nguồn và quy ước tổ chức module để git diff sạch, scope
build/test/lint rõ, và tách tầng tài liệu khỏi tầng mã nguồn.

## Yếu tố quyết định

- Diff sạch, dễ review.
- Scope build/test/lint rõ theo module.
- Tách tài liệu khỏi mã nguồn.

## Các phương án

- Một root `src/` + mỗi module một thư mục con tự chứa.
- Monorepo nhiều app (`apps/` + `packages/`).
- Trộn mã nguồn với tài liệu.

## Kết quả quyết định

Chọn phương án "một root `src/` + mỗi module một thư mục con tự chứa", vì rõ ràng và dễ scope.

- Root mã nguồn: <`src/`; đổi thành `apps/`+`packages/` nếu project là monorepo>.
- Mỗi module là thư mục con tự chứa; code dùng chung ở `<root>/shared/`.
- Module chỉ giao tiếp qua API công khai hoặc shared (no reach-in). Chi tiết: project-knowledge/source-structure.md.

### Hệ quả

- Tốt, vì diff sạch, scope rõ, dễ thêm module mới.
- Xấu, vì cần kỷ luật ranh giới module ngay từ đầu.

### Xác nhận

Review PR kiểm tra không có import xuyên module (no reach-in).

## Ưu nhược từng phương án

### Một root `src/` + mỗi module một thư mục con tự chứa

- Tốt, vì rõ ràng, dễ scope.
- Xấu, vì cần kỷ luật ranh giới module.

### Monorepo nhiều app (`apps/` + `packages/`)

- Tốt, vì phù hợp khi nhiều ứng dụng dùng chung thư viện.
- Xấu, vì tốn công cấu hình khi chỉ có một ứng dụng.

### Trộn mã nguồn với tài liệu

- Xấu, vì diff bẩn, khó scope. Loại.
