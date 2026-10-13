# Định dạng đầu ra: changelog & release page

Mục tiêu: chọn định dạng đúng kênh và trình bày nhất quán, có ngày và link truy vết. Đây là hướng dẫn định
dạng nội dung, KHÔNG thao tác git (tag/release/merge-back thuộc skill `git-release`, push thuộc `git-workflow`).

## Chọn định dạng theo kênh

- **`CHANGELOG.md` trong repo** → theo quy ước **Keep a Changelog**: file tích lũy nhiều phiên bản, mới nhất
  trên cùng, có mục `Unreleased`.
- **Trang release** (release page của nền tảng repo) → một bản cho một version: tiêu đề = version + ngày, nội
  dung theo nhóm, có thể kèm link so sánh và danh sách PR.
- **Bản tin tuần/tháng** → văn xuôi ngắn theo nhóm, nhấn các mục người dùng quan tâm; ít nhấn truy vết kỹ thuật.

Nếu người dùng chưa nói kênh → hỏi một câu; mặc định an toàn là `CHANGELOG.md` kiểu Keep a Changelog.

## Bố cục Keep a Changelog (khung tham khảo)

Thứ tự nhóm cố định, chỉ hiện nhóm CÓ thay đổi; đặt Breaking Changes nổi bật:

```
## [Unreleased]

## [X.Y.Z] - YYYY-MM-DD

### Breaking Changes
- <mục> (kèm cách migrate) (#PR)

### New Features
- <mục viết theo giá trị> (#PR)

### Improvements
- <mục> (#PR)

### Fixes
- <mục> (#PR)

### Security
- <mục ở mức người dùng cần biết> (CVE/advisory nếu có)
```

Tiêu đề mục là ví dụ khung; nội dung viết theo `user-facing-writing.md`. Với trang release, bỏ `[Unreleased]`
và dùng version + ngày làm tiêu đề bản.

## Version theo SemVer

- **MAJOR** khi có Breaking Changes; **MINOR** khi có New Features tương thích ngược; **PATCH** khi chỉ Fixes/
  Security tương thích ngược.
- Skill này **không tự bump/tag** — chỉ **đề xuất** mức tăng dựa trên nhóm thay đổi và nêu lý do; con người
  (hoặc `git-release`) chốt version thật. Nếu người dùng đã cho version → dùng đúng version đó.

## Ngày & link truy vết

- Mỗi phiên bản kèm **ngày phát hành** dạng `YYYY-MM-DD`.
- Link nên có: **so sánh giữa 2 tag** (`vX..vY`), **tag** của phiên bản, và **PR** cho từng mục khi có.
- Trình bày truy vết nhất quán: ví dụ đặt `(#123)` cuối mỗi mục; hoặc gom link ở cuối phiên bản.

## Ẩn thông tin nhạy cảm theo kênh

- **Kênh công khai** (release page/CHANGELOG công khai): ẩn hash nội bộ, mã ticket nội bộ, đường dẫn/host/secret;
  giữ PR/tag công khai. Mục Security nêu vừa đủ, link CVE thay vì mô tả khai thác.
- **Kênh nội bộ** (repo private, bản cho dev): có thể giữ hash + ticket để đối chiếu nhanh.
- Khi nghi ngờ một chi tiết có nhạy cảm không → hỏi con người thay vì tự công bố.

## Trước khi trả kết quả

- Chỉ hiện nhóm CÓ thay đổi; Breaking Changes (nếu có) nổi bật và kèm migration.
- Có version (hoặc đề xuất mức bump + lý do), ngày, link truy vết đúng kênh.
- Không lộ nội dung nhạy cảm ở kênh công khai; tiếng Việt còn nguyên dấu.
