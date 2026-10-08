# Bảng tình huống lỗi theo bước — workflow-refactor

Bổ sung cho bảng "Xử lý lỗi & rollback" trong `WORKFLOW.md`; trường **Khi fail** của từng bước vẫn là nguồn chính.

| Tình huống | Hành động |
|---|---|
| Người dùng không chấp nhận ADR (sau Bước 2 ⏸) | Quay lại Bước 1 làm rõ lại đích kiến trúc/ràng buộc |
| Baseline đỏ trước khi refactor (Bước 3) | Dừng, báo người dùng xử lý lỗi có sẵn trước, không tự sửa ngoài phạm vi |
| Một bước nhỏ ở Bước 5 làm đỏ test/build | Lùi lại bước nhỏ đó, chia nhỏ hơn hoặc sửa, không tiếp tục khi chưa xanh |
| Đổi API công khai ngoài phạm vi (Bước 6) | Quay lại Bước 5 điều chỉnh, hoặc xin người dùng mở rộng phạm vi |
| Vi phạm boundary/Dependency Rule (chế độ `architecture`, Bước 7) | Chặn hoàn thành, quay lại Bước 5 sửa đúng boundary |
| Người dùng không duyệt diff một lô (sau Bước 8 ⏸) | Không commit lô đó, quay lại bước người dùng yêu cầu sửa |
