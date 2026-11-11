# Tự soát plan

Chạy sau khi viết xong `plan.md`, trước checkpoint. Tự đọc và sửa tại chỗ; **không** giao subagent. Mỗi mục có
phát hiện thì sửa `plan.md` rồi đọc lại mục đó.

1. **Phủ AC và spec.** Với từng `AC<n>.<m>` ở `design.md`/`requirement.md`, chỉ ra task có `**Phủ AC:**` chứa nó và test
   trong `- Test:` nhắc ID đó. AC không task nào phủ → thêm task hoặc step. Mục "Ảnh hưởng spec" có việc cần làm thì
   phải có task tương ứng.
2. **Quét step mơ hồ hoặc chép code.** Step không có lệnh hoặc kết quả mong đợi ("xử lý lỗi", "thêm validation phù hợp")
   → viết lại thành hành động kiểm được. Step chứa nguyên thân hàm, nguyên file → rút về chữ ký + tên test + điều assert.
   Task `DOCS` phải có step đối chiếu khẳng định với code và bảng `khẳng định → file:line → khớp|lệch` (`plan-structure.md`, mục "Task DOCS").
3. **Nhất quán tên/kiểu/interface giữa các task.** Tên hàm, kiểu, đường dẫn, `operationId` ở `Produces` của task trước
   trùng từng ký tự với `Consumes` task sau và với test. Đồng thời kiểm `**Kind:**` thuộc tập đóng và khớp chuỗi agent.
4. **Review Focus.** Mỗi dòng nêu được test ở task nào phủ; không dòng nào chỉ lặp lại AC; không quá 5 dòng.
5. **Tỉ lệ độ dài plan so với design.** Plan dài nhiều lần `design.md` thường là chép chương trình vào plan → quay lại
   mục 2 và rút gọn; plan ngắn hơn đáng kể mà task còn mơ hồ thì thiếu step.

6. **Files đủ.** Với mỗi symbol mà task gỡ, đổi tên, đổi chữ ký hoặc đổi hành vi lỗi (vd từ nuốt lỗi sang ném lỗi, bỏ một
   bean), grep toàn repo tìm caller, lớp hiện thực, chỗ inject bean hoặc dùng generic của bean đó và test gọi tới nó. Mọi
   file khớp phải nằm trong `**Files:**` của task đó (kèm lý do một vế), hoặc task trước đã đổi nó. Task đổi một số đếm
   hoặc hằng (số mục, số rule, số migration, tên khoá) thì grep giá trị cũ trên toàn repo: file test, fixture, cấu hình
   hoặc catalog khẳng định số đếm hay hằng đó (test đếm số mục, snapshot, file kiểu dùng chung) cũng phải nằm trong
   `**Files:**`. Đồng thời kiểm mỗi task
   có `**Ước lượng:**` không quá 30 phút và không quá 5 file production (`plan-structure.md`, mục "Độ mịn task"); vượt thì tách.

Sau 6 mục, chạy script tất định:

```bash
node <thư mục skill artifact-templates>/scripts/check-request.mjs docs/requests/<yyyy-mm-dd>-<slug>/
```

Đường dẫn script theo nơi skill `artifact-templates` được cài. Script chỉ cảnh báo (exit 0). Ngay sau khi viết plan,
W9 (file test liệt kê chưa tồn tại) và W11 của năng lực chỉ khai `thêm` mà chưa có `docs/specs/<năng-lực>/spec.md` (finish.md tạo spec ở bước gộp) là bình thường; mọi cảnh báo khác phải được sửa hoặc nêu lý do. Không xoá
`**Files:**` hay mục test để tắt cảnh báo.
