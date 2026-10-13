# Mẫu `project-knowledge/release-policy.md`

Skill đọc file này ở preflight. Chỉ copy mẫu vào project hoặc sửa file khi người dùng đồng ý. Giá trị trong
policy vẫn qua checkpoint xác nhận ở `start`.

```markdown
# Release policy

> File này do `core:git-release` đọc trước mọi lệnh release/hotfix.
> Ô để `auto` → skill tự dò rồi hỏi xác nhận. Ô có giá trị → vẫn hỏi xác nhận ở `start`.
> Skill chỉ ghi/sửa file này khi người dùng đồng ý.

## 1. Branch

| Khoá | Giá trị | Ghi chú |
|---|---|---|
| integration branch | `auto` | `develop` / `dev` / `development` / `none` |
| promotion chain | `auto` | Thứ tự, chặng cuối = production + tag. VD: `staging, main` |
| release branch | `release/{version}` | |
| hotfix branch | `hotfix/{version}` | |
| xoá branch sau finish | `ask` | `ask` / `yes` / `no` |

## 2. Version

| Khoá | Giá trị | Ghi chú |
|---|---|---|
| tag format | `v{version}` | |
| version files | `auto` | `auto` / `none` (= `--no-bump`) / danh sách đường dẫn |
| dev suffix | `auto` | `auto` / `none` / `-SNAPSHOT` / `.dev0` |
| breaking khi 0.x | `minor` | `minor` / `major` |

## 3. Phát hành

| Khoá | Giá trị | Ghi chú |
|---|---|---|
| changelog | `CHANGELOG.md` | đường dẫn / `none` |
| github release | `auto` | `auto` (remote GitHub + `gh auth status` OK) / `no` |

## 4. Business rules

<!-- Mỗi dòng = 1 quy tắc riêng của dự án. -->

| ID | Thời điểm | Điều kiện | Hành động / Ràng buộc | Checkpoint | Nếu vi phạm |
|---|---|---|---|---|---|
| BR-01 | | | | | |
```

## Ý nghĩa khoá

- `tag format`: `{version}` được thay bằng `X.Y.Z`; phần đứng trước là tiền tố truyền vào `--tag-prefix`.
- `breaking khi 0.x`: truyền vào `--zero-breaking`.
- `version files: none`: tương đương `--no-bump`; vẫn tính version và tạo tag, commit release chỉ còn CHANGELOG
  (CHANGELOG cũng `none` → không có commit release, tag đặt trên merge commit chặng cuối).
- `github release: no`: bỏ bước tạo GitHub Release.

## Mục 4 — Business rules

Thời điểm hợp lệ: `release start`, `release finish`, `hotfix start`, `hotfix finish`, `chặng <tên branch>`. Skill
chỉ ĐỌC và trình các quy tắc khớp thời điểm ở checkpoint gần nhất, kèm cột `Nếu vi phạm`; quy tắc không bao giờ
khiến skill tự chạy lệnh. Quy tắc ghi `dừng` mà người dùng không xác nhận đã đáp ứng → dừng.
