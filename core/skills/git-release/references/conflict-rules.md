# Conflict được phép đề xuất resolve

Chỉ hai loại dưới đây. Mọi conflict khác → dừng, liệt kê file (`git diff --name-only --diff-filter=U`), không tự
resolve, không `reset --hard`; người dùng resolve hoặc yêu cầu `git merge --abort`.

| File | Tình huống điển hình | Đề xuất |
|---|---|---|
| File version (dòng khai báo version trong bảng `version-files.md`) | Merge-back hotfix `1.2.4` vào `release/1.3.0` | Giữ version cao hơn (`1.3.0`); hậu tố dev giữ theo branch đích |
| CHANGELOG (phần đầu file) | Cả hai bên cùng chèn mục mới lên đầu | Giữ cả hai mục, mục version cao hơn đứng trên; không sửa nội dung từng mục |

Quy trình: trình nội dung đề xuất cho từng file ⏸ → người dùng đồng ý → ghi file, `git add`, `git commit --no-edit`
→ kiểm `git diff --name-only --diff-filter=U` rỗng.
