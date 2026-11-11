# Walkthrough Playwright — luật chạy, kết quả và báo cáo

Walkthrough là lần đi qua các bước của runbook bằng trình duyệt do agent điều khiển, để thu bằng chứng quan sát nhanh.
Khác với test e2e tự động (`frontend-e2e-testing`): không để lại file test, không chạy lặp được, không thay cho test.

## Điều kiện bắt đầu

Kiểm đủ các điều sau trước khi mở trình duyệt. Thiếu một điều thì các bước liên quan là SKIP-PRECOND, không đoán.

- Runbook đã được người dùng duyệt; mỗi bước có kết quả mong đợi cụ thể.
- Ứng dụng đang chạy ở host local hoặc test; URL lấy từ runbook. Host staging hoặc production thì dừng toàn bộ.
- Có công cụ trình duyệt dùng được. Ví dụ với Playwright MCP: điều hướng, chụp snapshot, đọc console, đọc request mạng
  `[Unverified]` tên công cụ cụ thể khác nhau giữa bản cài; dùng danh sách công cụ thật của phiên.
- Tài khoản test và dữ liệu seed trong `## Điều kiện` của runbook đã có.
- Chưa có Playwright hoặc trình duyệt thì hỏi người dùng trước khi cài hay tải; không tự cài.

## Vòng một bước

1. Thực hiện đúng thao tác của bước; không thêm thao tác ngoài runbook.
2. Chờ UI ổn định bằng điều kiện quan sát được (phần tử xuất hiện, văn bản đổi), không chờ theo số giây cố định.
3. Đọc trạng thái trang (snapshot hoặc văn bản), request mạng phát sinh từ bước, và console mới kể từ bước trước.
4. So với kết quả mong đợi, gán một kết quả ở bảng dưới, ghi một dòng vào `## Kết quả đã chạy`.

## Bốn kết quả

| Kết quả | Điều kiện gán |
|---|---|
| PASS | UI khớp kết quả mong đợi; không có request API trả 4xx/5xx ngoài ý muốn; không có lỗi console mới kể từ bước trước. Request 4xx/5xx chỉ được coi là "có chủ ý" khi bước đó cố tình gây ra và kết quả mong đợi nói rõ. |
| FAIL | UI sai kết quả mong đợi, hoặc có request 4xx/5xx ngoài ý muốn, hoặc có lỗi console mới. Ghi đủ: bước tái hiện, kết quả thực, kết quả mong đợi, request lỗi (phương thức, đường dẫn, mã trạng thái, phần thân lỗi đã bỏ dữ liệu nhạy cảm). |
| SKIP-SAFETY | Bước vi phạm một luật an toàn bên dưới nếu làm đủ (xoá vĩnh viễn, cần khoá thật, đi ra ngoài localhost, tải file...). Ghi luật nào chặn; đã đi tới điểm an toàn nhất (ví dụ hộp xác nhận) thì nói rõ. |
| SKIP-PRECOND | Thiếu điều kiện để làm bước: dữ liệu seed không dựng được, màn hình chưa có, phụ thuộc một bước trước đã FAIL hoặc SKIP, tài khoản test không đăng nhập được, dịch vụ nền chưa chạy. Ghi điều kiện thiếu. |

Ranh giới giữa các loại:

- Không biết kết quả đúng hay sai vì runbook mơ hồ thì không gán PASS; ghi "chưa kiểm" kèm câu hỏi cho người viết runbook.
- FAIL của một bước không dừng walkthrough; các bước độc lập vẫn chạy, bước phụ thuộc thành SKIP-PRECOND.
- Một FAIL do môi trường (dịch vụ nền sập) khác với FAIL do ứng dụng: ghi rõ nghi ngờ nào, đánh nhãn `[Inference]`
  khi chưa chứng minh.

## Luật an toàn

| # | Luật | Cách xử lý |
|---|---|---|
| L1 | Không xoá vĩnh viễn | Đi tới hộp xác nhận, chụp lại nội dung hộp, rồi bấm huỷ. Bước đánh SKIP-SAFETY kèm ghi chú "dừng ở hộp xác nhận". Xoá mềm hoặc lưu trữ có khôi phục được thì chỉ làm trên dữ liệu có tiền tố của lần kiểm. |
| L2 | Không nhập khoá hay mật khẩu thật | Chỉ dùng tài khoản và giá trị test nêu trong runbook. Màn hình đòi khoá thật (khoá nhà cung cấp, thẻ, mật khẩu cá nhân) thì SKIP-SAFETY; kiểm phần còn lại bằng giá trị giả. |
| L3 | Không đi theo OAuth hay chuyển hướng ra ngoài localhost | Bấm tới lúc URL sắp rời host local thì dừng, ghi URL đích (bỏ tham số nhạy cảm), quay lại. Bước đánh SKIP-SAFETY. |
| L4 | Không tải file về máy | Không bấm xuất hoặc tải xuống. Kiểm tới mức nút có đúng trạng thái và request đúng phát đi khi runbook cho phép; phần còn lại SKIP-SAFETY. |
| L5 | Dữ liệu tạo mới có tiền tố riêng | Mọi bản ghi tạo trong lần chạy mang tiền tố của runbook (ví dụ `manual-check-<ngày>-`). Liệt kê bản ghi đã tạo trong báo cáo để người dùng dọn. Không sửa hay xoá dữ liệu có sẵn không mang tiền tố. |
| L6 | Không sửa code hay cấu hình, không đọc file bí mật | Walkthrough chỉ quan sát và thao tác qua UI. Không sửa mã nguồn, cấu hình, biến môi trường; không mở `.env`, khoá, chứng chỉ, kho bí mật. Phát hiện lỗi thì báo cáo, không sửa. |

Gặp tình huống ngoài sáu luật mà có thể gây hậu quả không đảo ngược hoặc ảnh hưởng người khác thì coi như SKIP-SAFETY và hỏi người dùng.

## Mẫu báo cáo

```text
Walkthrough <tên thay đổi> — <yyyy-mm-dd> — <môi trường> — <nhánh>@<hash>
Tổng: PASS <n> · FAIL <n> · SKIP-SAFETY <n> · SKIP-PRECOND <n> · chưa kiểm <n>
ID FAIL: <danh sách # bước, hoặc "không có">

FAIL #<n> (AC<n>.<m>)
- Bước tái hiện: <thao tác từng bước>
- Kết quả thực: <điều quan sát được>
- Kết quả mong đợi: <theo runbook>
- Request lỗi: <PHƯƠNG THỨC đường dẫn → mã trạng thái, tóm tắt thân lỗi>
- Console: <lỗi mới, nếu có>

SKIP #<n>: <SAFETY | PRECOND> — <luật hoặc điều kiện thiếu>

Dữ liệu đã tạo (tiền tố <tiền tố>): <danh sách bản ghi cần dọn, hoặc "không có">
Chưa kiểm và rủi ro còn lại: <liệt kê>
```

Báo cáo dùng số đếm thật từ `## Kết quả đã chạy`; tổng PASS, FAIL, SKIP phải cộng đúng bằng số bước của runbook.
PASS trong walkthrough là "quan sát được khớp ở lần chạy này", không phải bằng chứng ứng dụng không còn lỗi.
