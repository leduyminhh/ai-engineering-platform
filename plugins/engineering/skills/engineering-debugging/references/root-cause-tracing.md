# Truy vết ngược nguyên nhân gốc

Lỗi thường nổ ở chỗ sâu trong call stack, còn nguyên nhân nằm ở nơi truyền giá trị xấu vào. Sửa ở chỗ nổ chỉ che triệu chứng.

## Cách làm

1. **Ghi chỗ nổ:** thông báo lỗi, `file:line`, giá trị xấu quan sát được.
2. **Hỏi "giá trị này do ai truyền vào?"** và đọc caller trực tiếp. Lặp lại một cấp mỗi lần, ghi từng cấp vào chuỗi
   `chỗ nổ ← caller 1 ← caller 2 ← … ← nguồn`.
3. **Dừng ở nguồn:** nơi giá trị xấu được tạo ra hoặc nơi một giả định bị vi phạm lần đầu. Dấu hiệu: tới đây giá trị còn
   đúng ở đầu vào nhưng sai ở đầu ra.
4. **Thiếu thông tin ở một cấp** thì thêm log tạm tại ranh giới của cấp đó (in đầu vào, đầu ra, và `new Error().stack` hoặc
   tương đương). Ghi mốc `git status --porcelain` trước và gỡ hết log tạm sau. Với dữ liệu nhạy cảm chỉ in kiểu, độ dài hay tên
   khoá; che token, header xác thực và dữ liệu cá nhân.
5. **Sửa tại nguồn.** Chỗ nổ chỉ nhận thêm kiểm tra khi có giá trị riêng (xem `defense-in-depth.md`).

## Ví dụ rút gọn

| Cấp | Quan sát |
|---|---|
| Chỗ nổ | `ENOENT` khi đọc file cấu hình trong `loadConfig` |
| Caller 1 | `loadConfig(dir)` nhận `dir = ""` |
| Caller 2 | `init()` lấy `dir` từ `options.dir` |
| Nguồn | Test dựng `options` trước khi thư mục tạm được tạo, nên `options.dir` còn rỗng |

Sửa ở nguồn (dựng `options` sau khi có thư mục), không thêm `if (!dir) return` vào `loadConfig`.

## Khi không truy được tới nguồn

Chuỗi gọi đứt (callback, sự kiện bất đồng bộ, thread khác): ghi định danh tương quan (id yêu cầu, thời điểm) ở cả hai đầu
và đối chiếu. Vẫn không tới được thì báo "chưa tìm ra nguồn" kèm phần đã loại trừ; không kết luận từ suy đoán.
