# Tự soát plan

Chạy sau khi viết xong `plan.md`, trước checkpoint. Tự đọc và sửa tại chỗ; **không** giao subagent. Mỗi mục có
phát hiện thì sửa `plan.md` rồi đọc lại mục đó.

1. **Phủ AC và spec.** Với từng `AC<n>.<m>` ở `design.md`/`requirement.md`, chỉ ra task có `**Phủ AC:**` chứa nó và test
   trong `- Test:` nhắc ID đó. AC không task nào phủ → thêm task hoặc step. Mục "Ảnh hưởng spec" có việc cần làm thì
   phải có task tương ứng.
2. **Quét step mơ hồ hoặc chép code.** Step không có lệnh hoặc kết quả mong đợi ("xử lý lỗi", "thêm validation phù hợp")
   → viết lại thành hành động kiểm được. Step chứa nguyên thân hàm, nguyên file → rút về chữ ký + tên test + điều assert.
3. **Nhất quán tên/kiểu/interface giữa các task.** Tên hàm, kiểu, đường dẫn, `operationId` ở `Produces` của task trước
   trùng từng ký tự với `Consumes` task sau và với test. Đồng thời kiểm `**Kind:**` thuộc tập đóng và khớp chuỗi agent.
4. **Review Focus.** Mỗi dòng nêu được test ở task nào phủ; không dòng nào chỉ lặp lại AC; không quá 5 dòng.
5. **Tỉ lệ độ dài plan so với design.** Plan dài nhiều lần `design.md` thường là chép chương trình vào plan → quay lại
   mục 2 và rút gọn; plan ngắn hơn đáng kể mà task còn mơ hồ thì thiếu step.

Sau 5 mục, chạy script tất định:

```bash
node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/<yyyy-mm-dd>-<slug>/
```

Đường dẫn script theo nơi skill `artifact-templates` được cài. Script chỉ cảnh báo (exit 0). Ngay sau khi viết plan,
W9 (file test liệt kê chưa tồn tại) là bình thường; mọi cảnh báo khác phải được sửa hoặc nêu lý do. Không xoá
`**Files:**` hay mục test để tắt cảnh báo.
