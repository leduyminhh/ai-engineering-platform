# Phân tích input → bảng Use case

## 1. Nhận diện input

| Dạng input | Đọc gì | Lấy ra |
|---|---|---|
| Yêu cầu thô (chat, email, ticket) | Toàn văn | Actor, mục tiêu, hành động chính → nháp use case |
| Use case (UC spec, user story) | Actor, tiền điều kiện, luồng chính/phụ, hậu điều kiện | Use case gần như 1–1; AC từ hậu điều kiện + luồng phụ |
| ARD (Architecture Requirements Document) | Ràng buộc kiến trúc, NFR, tích hợp, quyết định đã chốt | NFR + ràng buộc gắn vào use case liên quan; quyết định chưa chốt → Câu hỏi mở |
| `requirement.md` (từ `engineering-spec-writing`) | Functional requirements, AC, phạm vi, NFR | **Nguồn chính**; không phân tích lại phần đã chốt |

Nhiều nguồn cùng lúc: thứ tự ưu tiên làm nguồn chính là `requirement.md` > use case > ARD > yêu cầu thô; các nguồn
còn lại bổ sung.

## 2. Ngưỡng mơ hồ — khi nào DỪNG

DỪNG và đề nghị `engineering-spec-writing` khi một trong hai đúng:

- Không trích được **use case nào** có đủ actor + mục tiêu.
- Không có **AC đo được** nào (chỉ có mô tả cảm tính như "nhanh", "thân thiện", "dễ dùng" mà không có ngưỡng).

Thiếu vài chi tiết (validation cụ thể, mã lỗi) KHÔNG phải ngưỡng mơ hồ → tiếp tục, ghi **[giả định]** hoặc Câu hỏi mở.

## 3. Bảng Use case

```markdown
| ID | Tên | Actor | Mục tiêu | AC | NFR | Nguồn |
|---|---|---|---|---|---|---|
| UC01 | Đăng ký tài khoản | Khách | Tạo tài khoản bằng email | AC1.1 Given email chưa dùng When gửi form hợp lệ Then tạo tài khoản và gửi mail xác nhận trong ≤ 1 phút; AC1.2 Given email đã dùng When gửi form Then báo lỗi "Email đã tồn tại" | p95 ≤ 500 ms | requirement.md §3.1 |
```

- ID use case: `UC01`, `UC02`… theo thứ tự xuất hiện trong nguồn chính. `UC00` dành cho nền tảng dùng chung.
- AC đánh số `AC<uc>.<n>` (vd `AC1.2`) để task truy vết được.
- AC viết Given/When/Then hoặc tiêu chí kiểm được có ngưỡng.
- Cột Nguồn trỏ về vị trí cụ thể trong input (file + mục, hoặc đoạn trích ngắn).

## 4. Nguồn mâu thuẫn hoặc thiếu

- Hai nguồn **mâu thuẫn** (vd use case nói "admin duyệt", ARD nói "tự động duyệt") → KHÔNG tự chọn; ghi Câu hỏi
  mở, nêu cả hai phía + task bị ảnh hưởng.
- Thiếu thông tin nhưng có giá trị hợp lý → ghi **[giả định] <giá trị>** ngay tại chỗ + thêm vào Câu hỏi mở để
  teamlead xác nhận.
- Quyết định kiến trúc chưa chốt (chọn message broker, cách xác thực…) → Câu hỏi mở + gợi ý `engineering-adr`.

## 5. Câu hỏi mở

```markdown
| # | Câu hỏi | Ảnh hưởng tới | Trạng thái |
|---|---|---|---|
| Q1 | Duyệt tài khoản thủ công hay tự động? (UC spec §2 vs ARD §4.1) | UC01-BE-01, UC01-FE-01 | Mở |
```

Trình bảng Use case + Câu hỏi mở cho teamlead ở **Checkpoint 1** trước khi tách task.
