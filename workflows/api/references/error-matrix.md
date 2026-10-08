# Bảng tình huống lỗi theo bước — workflow-api

Bổ sung cho bảng "Xử lý lỗi & rollback" trong `WORKFLOW.md`; trường **Khi fail** của từng bước vẫn là nguồn chính.

| Tình huống | Hành động |
|---|---|
| Người dùng không xác nhận contract (sau Bước 2 ⏸) | Sửa lại theo góp ý, trình lại, không code trước |
| Phát hiện drift contract↔code (Bước 5) | Quay lại Bước 3 sửa code hoặc Bước 2 sửa contract |
| Finding `blocker` về authorization/input validation (Bước 5) | Quay lại Bước 3 sửa code, review lại phần đã sửa |
| Contract lệch khi nối FE (Bước 6) | Dừng, quay lại Bước 2 chỉnh contract; không sửa contract để hợp FE |
| Người dùng không duyệt diff (sau Bước 8 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |
