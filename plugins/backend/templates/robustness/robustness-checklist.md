# Checklist robustness backend

Dùng chung cho `backend-implement` (tự soát trước khi báo xong) và `backend-code-review` (đối chiếu khi review). Năm nhóm dưới
đây là lỗi hay lọt qua test chạy đường vui. Chỉ đánh dấu một dòng khi đã chạy hoặc đọc đúng chỗ ghi ở "Cách kiểm"; dòng không áp
dụng cho slice thì ghi "N/A" kèm lý do, không bỏ trống.

## Chặn kích thước input

- [ ] Mọi body, mảng, chuỗi và tham số số trang ở biên có trần cụ thể (cấu hình được, có giá trị mặc định). Cách kiểm: tìm nơi khai báo giới hạn của từng trường trong DTO hoặc cấu hình server; trường không có trần là finding.
- [ ] Vượt trần thì trả lỗi 4xx có mã lỗi rõ, không cắt âm thầm và không để đến lúc hết bộ nhớ. Cách kiểm: gửi một request vượt trần mỗi loại (body, mảng, chuỗi, `size` quá lớn) và xác nhận mã trạng thái.
- [ ] Số trang và số phần tử mỗi trang bị chặn trên, kể cả khi client không gửi tham số. Cách kiểm: gọi endpoint danh sách không có tham số và với `size` cực lớn, đọc câu truy vấn thực sinh ra.

## Che secret trong log và thông báo lỗi

- [ ] Khoá, token, mật khẩu, header xác thực và payload chứa dữ liệu nhạy cảm không vào log, thông báo lỗi hay `toString` của DTO. Cách kiểm: tìm các lệnh log gần nơi xử lý credential; chạy một luồng lỗi rồi đọc log và body phản hồi.
- [ ] Thông báo lỗi trả cho client không lộ stacktrace, câu truy vấn hay đường dẫn nội bộ. Cách kiểm: gây một lỗi hạ tầng (ngắt kết nối phụ thuộc) và đọc nguyên body phản hồi.

## Idempotency

- [ ] Thao tác ghi có thể bị gọi lặp (client retry, consumer nhận lại bản tin) có khoá idempotency hoặc ràng buộc duy nhất ở tầng dữ liệu. Cách kiểm: gọi hai lần cùng khoá, xác nhận chỉ một bản ghi và cùng một kết quả trả về; xem thêm bước B8 trong `use-case-intake.md` của `backend-implement`.
- [ ] Retry sau lỗi giữa chừng không tạo tác dụng phụ lần hai (gửi thông báo, trừ tiền, gọi dịch vụ ngoài). Cách kiểm: mô phỏng lỗi sau bước ghi nhưng trước bước trả lời, chạy lại và đếm tác dụng phụ.
- [ ] Consumer xử lý bản tin trùng hoặc đến sai thứ tự mà không hỏng dữ liệu. Cách kiểm: phát lại cùng một bản tin hai lần trong test tích hợp.

## Race và CAS

- [ ] Mọi chỗ đọc rồi ghi trên cùng dữ liệu chia sẻ dùng cập nhật có điều kiện (so sánh version, `UPDATE … WHERE` trạng thái cũ) hoặc khoá, không dùng kiểm tra rồi mới ghi rời rạc. Cách kiểm: tìm cặp đọc-ghi liền nhau; xem mục concurrency của Trục 1 trong `review-dimensions.md` của `backend-code-review`.
- [ ] Cập nhật có điều kiện kiểm số dòng bị ảnh hưởng và xử lý nhánh thua (thử lại có giới hạn hoặc báo xung đột), không bỏ qua kết quả. Cách kiểm: đọc nhánh xử lý khi số dòng bằng 0 và chạy hai luồng song song trong test.
- [ ] Job định kỳ hoặc worker chạy song song không giẫm lên cùng một bản ghi. Cách kiểm: xác nhận cơ chế chiếm bản ghi (khoá, lease, trạng thái chuyển nguyên tử) và chạy hai instance trong test.

## Việc mồ côi sau lỗi

- [ ] Lỗi giữa chừng không để lại bản ghi dở ở trạng thái trung gian không ai xử lý tiếp: bước ghi nhiều phần nằm trong một transaction, hoặc có trạng thái lỗi để dọn và retry. Cách kiểm: ép lỗi ở từng bước của luồng ghi nhiều bước rồi đọc dữ liệu còn lại.
- [ ] Tài nguyên ngoài đã tạo (file tạm, đối tượng lưu trữ, đặt chỗ, kết nối) được dọn hoặc có job dọn khi bước sau thất bại. Cách kiểm: ép lỗi sau khi tạo tài nguyên và đếm tài nguyên còn lại.
- [ ] Việc dọn cũng chạy được khi tiến trình chết đột ngột, không chỉ trong khối xử lý lỗi. Cách kiểm: xác định ai dọn khi process bị kill giữa chừng (job quét theo thời hạn, lease hết hạn) và chỉ ra nơi cấu hình.
