# Checklist lời gọi LLM từ backend

Tham chiếu cho `backend-llm-integration`. Mỗi mục có **dấu hiệu lỗi** và **cách kiểm** chạy được. Dòng không áp dụng ghi "N/A"
kèm lý do. Mọi khẳng định về một nhà cung cấp cụ thể chưa đọc docs đúng phiên bản thì gắn `[Unverified]`.

## 1. Ngân sách theo ngày

- [ ] Có bước đặt chỗ nguyên tử trước khi gọi (một câu lệnh cập nhật có điều kiện hoặc khoá), không phải đọc-rồi-ghi. Cách kiểm: tìm nơi trừ ngân sách; chạy hai request song song gần ngưỡng cạn và xác nhận tổng không vượt trần.
- [ ] Gọi xong thì điều chỉnh theo số token thực dùng; lời gọi lỗi hoàn lại phần đặt chỗ. Cách kiểm: ép lỗi lời gọi và đọc ngân sách trước và sau.
- [ ] Cạn ngân sách thì không gọi, trả kết quả `degraded` hoặc mã lỗi rõ. Cách kiểm: đặt ngân sách bằng 0 trong test và xác nhận fake port không bị gọi.

## 2. Backoff

- [ ] Backoff luỹ thừa có jitter, có trần số lần và trần mỗi lần chờ. Cách kiểm: đọc công thức chờ; test với bộ sinh số ngẫu nhiên cố định và đồng hồ giả, không dùng `sleep` thật.
- [ ] Tổng thời gian retry bị chặn bởi ngân sách thời gian của job (nhỏ hơn hạn job). Cách kiểm: đặt hạn job ngắn và xác nhận dừng retry đúng hạn rồi rơi vào nhánh `degraded`.
- [ ] Lỗi 4xx (trừ giới hạn tốc độ) không retry. Cách kiểm: fake port trả 400 và đếm số lần gọi bằng 1.

## 3. Fail-soft có đánh dấu

- [ ] Kết quả thay thế luôn mang cờ `degraded` và đi kèm một dòng log có lý do. Cách kiểm: ép từng loại lỗi (hết thời gian, 5xx, hết ngân sách, chưa có khoá) và đọc cờ cùng dòng log.
- [ ] Có cờ cấu hình biến lỗi nhà cung cấp thành thất bại cứng; bật cờ thì job thất bại thay vì trả kết quả thay thế. Cách kiểm: test hai chế độ của cờ với cùng một lỗi.
- [ ] Kết quả `degraded` bị chặn ở bước không chấp nhận nó (xuất bản, ghi vào dữ liệu gốc). Cách kiểm: đi theo luồng từ kết quả `degraded` đến nơi dùng cuối và chỉ ra điều kiện chặn.
- [ ] Không dùng "job hoàn tất" làm bằng chứng lời gọi thật đã chạy trong test hay báo cáo. Cách kiểm: test khẳng định trên cờ hoặc dòng log, không chỉ trạng thái thành công.

## 4. Ghi usage

- [ ] Mỗi lời gọi (kể cả lỗi và hạ cấp) có đúng một bản ghi usage, chỉ chứa số token và siêu dữ liệu, không chứa nội dung prompt hay output. Cách kiểm: chạy ba kết quả (thành công, lỗi, hạ cấp) và đếm bản ghi; đọc các cột được ghi.
- [ ] Lỗi khi ghi usage không làm hỏng luồng chính (hoặc ngược lại, có quyết định rõ). Cách kiểm: ép lỗi kho usage và xác nhận hành vi đúng như thiết kế.

## 5. Redact output và hash input

- [ ] Output model qua bộ che trước khi vào log, bản lưu tạm hay trace. Cách kiểm: cho fake port trả chuỗi chứa email và token mẫu, rồi tìm chuỗi đó trong log và dữ liệu lưu.
- [ ] Prompt không được lưu nguyên văn; chỉ lưu băm kèm phiên bản template (trừ chỗ lưu được duyệt và phân quyền). Cách kiểm: tìm mọi nơi ghi biến prompt ra log hoặc bảng.
- [ ] Băm ổn định giữa các lần chạy (cùng input cùng băm) nếu mục đích là nhận diện lời gọi lặp. Cách kiểm: băm hai lần cùng input trong test.

## 6. Prompt dự phòng

- [ ] Có nhánh dự phòng không phụ thuộc kết quả lời gọi chính; kết quả từ nhánh này mang cờ `degraded`. Cách kiểm: ép lỗi lời gọi chính và xác nhận kết quả cùng cờ.
- [ ] Nhánh dự phòng có test riêng và không vòng lặp (lỗi nhánh dự phòng không kích hoạt chính nó). Cách kiểm: ép lỗi cả hai và xác nhận kết thúc có giới hạn.

## 7. Khoá nhà cung cấp

- [ ] Khoá được lấy tại lúc dùng từ nơi lưu secret, không nằm trong biến cấu hình chung, log, thông báo lỗi hay prompt. Cách kiểm: tìm tham chiếu tới khoá; chạy một luồng lỗi xác thực rồi đọc log và body phản hồi.
- [ ] Trace hoặc log lỗi của SDK không ghi nguyên header xác thực. Cách kiểm: bật mức log chi tiết trong test và tìm giá trị khoá mẫu trong đầu ra.
