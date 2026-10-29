# Phòng thủ nhiều lớp sau khi sửa ở nguồn

Sửa ở nguồn là việc chính. Phòng thủ nhiều lớp là bước thêm khi cùng một lớp lỗi có thể quay lại từ một đường khác. Chỉ thêm
lớp khi giá trị của nó lớn hơn chi phí; mỗi lớp thêm là code phải bảo trì.

| Lớp | Việc làm | Khi nào đáng |
|---|---|---|
| Đầu vào | Từ chối giá trị sai ngay ở biên (rỗng, sai kiểu, ngoài miền) với thông báo nêu rõ giá trị nhận được | Dữ liệu đến từ người dùng, mạng, file |
| Nghiệp vụ | Kiểm điều kiện mà thao tác cần để có nghĩa | Thao tác không đảo ngược hoặc có chi phí cao |
| Môi trường | Chặn thao tác nguy hiểm trong ngữ cảnh không phù hợp (vd ghi ngoài thư mục tạm khi chạy test) | Lỗi từng gây hỏng dữ liệu hoặc ghi nhầm chỗ |
| Chẩn đoán | Ghi log hoặc ném lỗi có đủ ngữ cảnh để lần sau truy ngược nhanh | Lỗi khó tái hiện |

## Quy tắc

- Mỗi lớp phải được test bằng chính trường hợp đã gây lỗi; lớp không có test thì bỏ.
- Lỗi phải ồn ào (fail loud): lớp phòng thủ không được nuốt lỗi rồi trả giá trị mặc định im lặng.
- Không thêm lớp nào chỉ vì "cho chắc". Không có đường quay lại thực tế thì chỉ cần sửa ở nguồn.
