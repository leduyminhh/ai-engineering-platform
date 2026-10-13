# Dò và bump file version

## Thứ tự dò

1. Version lấy từ git tag → KHÔNG bump file, chỉ tạo tag; ghi rõ trong báo cáo:
   - Java: plugin `jgitver`, `axion-release`, `gradle-git-versioning` trong `pom.xml` / `build.gradle(.kts)`.
   - Python: `setuptools-scm`, `hatch-vcs`, `poetry-dynamic-versioning` trong `pyproject.toml`.
2. `release-policy.md` khai báo `version files` → dùng đúng danh sách đó (`none` = không bump).
3. Dò theo bảng dưới. 0 file, hoặc nhiều nơi khai báo lệch nhau, hoặc nhiều stack → hỏi; lựa chọn có thể ghi vào policy.

Không mở file secret khi dò (`.env`, `*.jks`, `*.keystore`, file properties chứa mật khẩu/token).

## Bảng

| Stack | Nơi khai báo | Cách bump |
|---|---|---|
| Maven | `pom.xml` → `<project><version>` (KHÔNG phải `<parent><version>`) | `mvn versions:set -DnewVersion=<v> -DgenerateBackupPoms=false`; multi-module chạy ở pom gốc, thêm `-DprocessAllModules` khi module con không kế thừa trực tiếp |
| Maven CI-friendly | `<version>${revision}</version>` + `<properties><revision>` | Sửa giá trị `<revision>` ở pom gốc; KHÔNG chạy `versions:set` |
| Gradle | `gradle.properties` → `version=`, hoặc `build.gradle(.kts)` → `version = "…"` | Sửa đúng một nơi; cả hai có → hỏi |
| PEP 621 | `pyproject.toml` → `[project] version` | Sửa dòng; dùng `uv version <v>` chỉ khi `uv version --help` có tham số này |
| Poetry | `[tool.poetry] version` | `poetry version <v>` |
| Hatch | `[tool.hatch.version] path = "…"` | `hatch version <v>` |
| Version động trỏ vào file | `[project] dynamic = ["version"]` + `__version__` trong file được trỏ tới | Sửa `__version__` |
| setuptools cũ | `setup.py` / `setup.cfg` → `version=` | Sửa dòng |
| Node | `package.json` → `"version"` | `npm version <v> --no-git-tag-version` (cập nhật cả lockfile) |

Tool native không có trên máy → sửa trực tiếp file. Diff luôn được trình ở checkpoint commit.

## Kiểm nhất quán

Version trong file (bỏ hậu tố dev) phải bằng `current` của `next-version.mjs`. Lệch → cảnh báo, hỏi, không bump đè.

## Hậu tố dev

| Hậu tố | Nhận biết | `release start` | `release finish` (chặng cuối) |
|---|---|---|---|
| `-SNAPSHOT` (Maven/Gradle) | version hiện tại kết thúc bằng `-SNAPSHOT` | `1.3.0-SNAPSHOT` → `1.3.0` | integration → `<nextDev>-SNAPSHOT` (vd `1.4.0-SNAPSHOT`) |
| `.devN` (Python) | version hiện tại có `.dev<số>` | `1.3.0.dev0` → `1.3.0` | integration → `<nextDev>.dev0` |
| không có | — | bump thẳng | không thêm commit |

`hotfix finish` không bump hậu tố dev cho integration.
