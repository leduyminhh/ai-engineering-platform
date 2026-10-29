# Anti-pattern khi làm TDD

Mỗi mục: dấu hiệu, và việc nên làm thay thế. Các mục này bổ sung cho mục Testing của `AGENTS.md`, không thay thế.

| Anti-pattern | Dấu hiệu | Làm thay vì |
|---|---|---|
| Chỉ assert mock vừa cấu hình | Test cấu hình mock trả `X` rồi khẳng định kết quả là `X`; xoá logic thật vẫn xanh | Assert hành vi quan sát được ở ranh giới của đơn vị (giá trị trả về, trạng thái, tác dụng ra ngoài) |
| Ghim chi tiết cài đặt | Test đỏ khi đổi thứ tự gọi nội bộ, tên hàm private, nội dung log | Chỉ ghim hợp đồng công khai; đổi cách làm mà hành vi giữ nguyên thì test phải xanh |
| Test chưa từng đỏ | Viết sau code, hoặc assert luôn đúng | Hoàn tác phần code vừa viết, thấy test đỏ, khôi phục, thấy xanh |
| Phụ thuộc thời gian, mạng, thứ tự | `sleep` cố định, gọi dịch vụ thật, test này dựa vào dữ liệu của test kia | Chờ theo điều kiện với thời hạn ngắn nhất ổn định; mỗi test tự dựng dữ liệu của mình |
| Kỳ vọng chép từ output của code | Snapshot tự sinh được chấp nhận mà không đọc | Tự tính kỳ vọng từ spec hoặc AC trước khi chạy |
| Một test kiểm nhiều hành vi | Test đỏ nhưng không biết hành vi nào hỏng | Tách theo hành vi; nhiều đầu vào của cùng một hành vi thì tham số hoá |
| Test chỉ để tăng coverage | Không có AC hay hành vi nào đứng sau test | Bỏ test, hoặc tìm hành vi thật mà test phải bảo vệ |
| Mock ranh giới nội bộ | Mock cả lớp domain để test lớp domain | Chỉ mock ranh giới hệ thống (DB, mạng, đồng hồ); logic thuần chạy thật |
