# Gom & phân loại thay đổi từ lịch sử git

Mục tiêu: từ lịch sử git của một phạm vi, tạo ra một **danh sách thay đổi đã phân nhóm, đã lọc churn, còn truy
vết** — làm đầu vào cho bước viết hướng người dùng. Đây là hướng dẫn cách agent đọc và phân loại, KHÔNG thao
tác git (việc gom lịch sử thuộc skill `git-workflow`).

## 1. Chốt phạm vi so sánh nhỏ nhất có ích

Chọn phạm vi vừa đủ trả lời "có gì mới từ mốc trước đến giờ", không rộng hơn cần thiết:

- **Giữa 2 tag/version** — dạng phổ biến nhất cho một bản phát hành: `vX.Y.Z..vX.Y.(Z+1)` (từ tag phát hành
  gần nhất đến tag/nhánh sắp phát hành).
- **Khoảng ngày** — cho bản tin định kỳ: từ ngày A đến ngày B.
- **N ngày gần nhất** — cho tóm tắt tuần/tháng.
- **Từ một nhóm commit đã gom** — khi `git-workflow` đã trả sẵn danh sách commit theo phạm vi.

Nếu người dùng chưa nói mốc: hỏi **một câu** để chốt mốc bắt đầu (tag phát hành gần nhất thường là mốc đúng).
Nếu lịch sử chưa được gom → đề nghị chạy `git-workflow` (`Quy trình — changelog / release notes`) để lấy lịch sử theo
phạm vi trước; skill này không tự chạy lệnh git.

## 2. Nhóm chuẩn (theo tác động người dùng, không theo loại commit)

Phân mỗi thay đổi vào **một** nhóm theo *tác động với người đọc*, không máy móc theo prefix commit:

- **New Features** — khả năng mới người dùng trước đây không có (`feat` thường rơi vào đây, nhưng xét tác động).
- **Improvements** — cải thiện khả năng đã có: nhanh hơn, dễ dùng hơn, mở rộng đầu vào/tùy chọn (một phần
  `feat` nhỏ, `perf`, cải tiến UX).
- **Fixes** — sửa lỗi hành vi sai (`fix`). Chỉ nêu lỗi người dùng **cảm nhận được**; lỗi nội bộ chưa từng phát
  hành thì bỏ.
- **Breaking Changes** — thay đổi phá vỡ tương thích: đổi/bỏ API, đổi cấu hình mặc định, đổi định dạng dữ liệu,
  bỏ tính năng. Nhận diện qua `!` trong header (`feat!`, `fix!`) hoặc footer `BREAKING CHANGE:`. **Luôn tách
  riêng và ưu tiên hiển thị** (xem mục migration ở `user-facing-writing.md`).
- **Security** — vá lỗ hổng, nâng phụ thuộc để xử lý CVE, siết quyền/xác thực. Nêu ở mức người dùng cần biết
  (có nên nâng cấp gấp không), KHÔNG kèm chi tiết khai thác/PoC.

Một thay đổi có thể vừa là fix vừa breaking → xếp vào **Breaking Changes** (ưu tiên cao hơn) và mô tả cả phần
sửa. Nếu không rõ tác động người dùng của một commit → đưa vào danh sách **câu hỏi mở**, đánh dấu **[giả
định]**, không tự xếp bừa.

## 3. Lọc churn nội bộ

Bỏ khỏi release notes hướng người dùng những thay đổi **không đổi hành vi người dùng**:

- `chore`, `refactor`, `style`/format, `test`, `ci`, `build` nội bộ, bump phụ thuộc không liên quan bảo mật.
- Commit revert cặp đôi trong cùng phạm vi (thêm rồi gỡ) → triệt tiêu, không nêu.
- Commit merge, commit "wip"/"fixup" đã được squash.

Ngoại lệ giữ lại: refactor/perf có **tác động người dùng đo được** (nhanh hơn, ít RAM hơn) → xếp vào
**Improvements**; bump phụ thuộc vá CVE → xếp vào **Security**.

Với bản changelog **kỹ thuật nội bộ** (đối tượng đọc là dev), có thể giữ một mục "Internal/Chore" gọn; với bản
**hướng người dùng cuối**, lọc hẳn.

## 4. Giữ truy vết

Với mỗi mục thay đổi, giữ liên kết ngược để đối chiếu:

- **tag/version** chứa thay đổi, **hash commit** (ngắn), **số PR**, **mã ticket** (nếu có trong commit/PR).
- Khi gộp nhiều commit thành một mục người dùng → giữ **tất cả** hash/PR liên quan của mục đó.
- Phân biệt kênh khi hiển thị: bản **nội bộ** giữ hash/PR/ticket; bản **công khai** có thể chỉ giữ PR/tag và ẩn
  hash + mã ticket nội bộ (xem `changelog-format.md`).

Truy vết là để con người kiểm chứng release notes khớp lịch sử — không được bịa mục không có commit tương ứng.
