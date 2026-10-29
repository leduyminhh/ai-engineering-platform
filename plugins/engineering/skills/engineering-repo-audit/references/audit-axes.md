# Trục audit — dấu hiệu cụ thể

Tài liệu tham chiếu cho `engineering-repo-audit`. Đọc điểm nóng theo từng trục; mỗi phát hiện phải quy về
một `file:line`. Không có evidence thì không dựng finding. Nhãn: **proven** khi nói được kịch bản input → hành
vi sai, còn lại là **suspected**.

## Trục 1 — Lỗi logic

- Điều kiện biên: null/rỗng/0/âm, chỉ số ngoài biên, so sánh `==` cho object hoặc số thực, sai đơn vị, sai múi giờ.
- Nuốt lỗi: `catch` rồi bỏ qua, `except: pass`, trả giá trị mặc định che thất bại.
- Check-then-act không nguyên tử; trạng thái chia sẻ mutable không đồng bộ.
- Tiền tệ dùng kiểu số thực thay vì kiểu thập phân.

## Trục 2 — Bảo mật nhìn bằng mắt

Đây là **sàng lọc**, không thay `engineering-quality-gate`. Chỉ ghi dấu hiệu rõ rồi định tuyến:

- Ghép chuỗi vào SQL/lệnh shell/HTML thay vì tham số hoá hoặc escape.
- Secret nằm trong mã nguồn hoặc file cấu hình đã theo dõi (báo vị trí và loại, không in giá trị).
- Endpoint thiếu kiểm quyền cạnh các endpoint cùng loại đã có; tin tưởng dữ liệu từ client.
- Tắt kiểm tra TLS, CORS mở mọi nguồn, băm mật khẩu bằng thuật toán nhanh.

## Trục 3 — Độ tin cậy dưới tải

- Vòng lặp gọi DB/HTTP từng phần tử (N+1), không phân trang khi đọc bảng lớn.
- Không đặt timeout cho lời gọi ngoài; retry không giới hạn hoặc không idempotent.
- Tài nguyên không đóng (kết nối, luồng file); hàng đợi hoặc cache không giới hạn kích thước.
- Công việc nền chạy song song trên cùng dữ liệu.

## Trục 4 — Rủi ro thiếu test

- Điểm nóng có logic tiền, quyền hoặc dữ liệu mà không có test tương ứng.
- Test chỉ khẳng định mock vừa cấu hình, hoặc bị `skip`/`disable` kéo dài.
- Nhánh lỗi và nhánh biên không được test trong khi nhánh thành công thì có.

## Trục 5 — Đường chậm

- Lặp lại phép tính hoặc truy vấn đắt trong vòng lặp; sắp xếp/lọc bộ dữ liệu lớn trong bộ nhớ.
- Thiếu chỉ mục cho truy vấn lọc theo cột không phải khoá (nghi ngờ nếu chưa thấy schema).
- Gán nhãn **suspected** cho mọi thứ chưa đo; việc đo thuộc `workflow-performance`.

## Trục 6 — Code chết và trùng lặp

- Hàm, class, cờ cấu hình không còn nơi gọi (kiểm bằng `grep` toàn repo, không chỉ file hiện tại).
- Khối logic gần giống nhau ở ≥ 3 nơi; nhánh `if` không bao giờ đạt.
- Chỉ ghi khi xoá hoặc gộp **giảm** rủi ro; đừng liệt kê mọi chỗ trùng nhỏ.

## Xếp hạng

Điểm = hậu quả (mất tiền/dữ liệu/quyền > sai kết quả > chậm > khó đọc) × độ chắc chắn (proven > suspected) ×
độ dễ gặp (đường chính > đường hiếm). Finding cùng gốc gộp thành một dòng và liệt kê các `file:line`.
