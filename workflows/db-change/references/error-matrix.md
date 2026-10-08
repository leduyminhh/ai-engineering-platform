# Bảng tình huống lỗi theo bước — workflow-db-change

Bổ sung cho bảng "Xử lý lỗi & rollback" trong `WORKFLOW.md`; trường **Khi fail** của từng bước vẫn là nguồn chính.

| Tình huống | Hành động |
|---|---|
| Người dùng không xác nhận thiết kế migration (sau Bước 2 ⏸) | Quay lại Bước 1 làm rõ impact/ràng buộc |
| Một lượt trong chu trình verify thất bại (Bước 6) | Quay lại Bước 3 sửa migration, chạy lại cả chuỗi từ đầu |
| Integration test đỏ (Bước 7) | Lỗi test → sửa test; lỗi code/migration → quay lại Bước 3 (không nới test) |
| Người dùng không duyệt diff (sau Bước 9 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |
| Agent migration trả `blocked` (Bước 3) | Người dùng quyết định; đổi kế hoạch → quay lại Bước 2, ngược lại ghi vào report Bước 3 rồi gọi lại agent |
