# Hiển thị trực quan khi brainstorm

## Khi nào

Test duy nhất: **người dùng hiểu rõ hơn khi thấy hay khi đọc?** Thấy thì hiển thị: mockup giao diện, sơ đồ luồng hoặc
kiến trúc, so sánh phương án cạnh nhau, bố cục, bảng so sánh nhiều chiều. Đọc thì dùng chữ: câu hỏi khái niệm, đánh đổi
bằng lời, lựa chọn về phạm vi, quyết định quy trình. Mỗi câu hỏi tự quyết riêng; chủ đề có hình không có nghĩa câu hỏi
nào cũng cần hình.

## Thứ tự dùng công cụ

1. **Widget inline có nút** khi phiên có công cụ hiển thị (app desktop Claude): mockup hoặc so sánh phương án, mỗi phương
   án một nút gửi lại lựa chọn vào chat. Widget chỉ để xem và chọn; không nhồi cả brief vào widget.
2. **HTML cục bộ** khi phiên không có công cụ hiển thị nhưng ghi được file: ghi dưới `.aip/runs/brainstorm-<slug>/` (ở gốc
   repo chính; `<slug>` chốt ngay khi hiểu tên việc vì lúc này chưa có `docs/requests/`; tạo `.aip/.gitignore` chứa `*` nếu
   chưa có để git bỏ qua) theo kiểu `status.html` của `aip status`: một file HTML tĩnh, tự đủ, mở bằng
   trình duyệt. **Không viết server riêng**, không đưa file ra dịch vụ ngoài.
3. **Text** khi không có cả hai, hoặc khi chữ đủ rõ: bảng markdown, sơ đồ ASCII ngắn.

## Quy tắc

- HTML phụ trợ (kèm `.aip/.gitignore` chứa `*`, git bỏ qua) và spike là hai ngoại lệ duy nhất của skill ngoài `brief.md`; không ghi gì khác vào repo. Ghi HTML vào `.aip/runs/brainstorm-<slug>/` không cần hỏi; mở nó (trình duyệt, panel) thì hỏi.
- Hỏi trước khi mở bất cứ thứ gì ngoài hội thoại (trang web, file HTML); người dùng đồng ý rồi mới làm.
- Nội dung đưa vào HTML là dữ liệu người dùng đã nói: hiển thị dạng text, không chèn script hay tải tài nguyên ngoài.
- Hình là phương tiện để chốt điều đang bàn; chốt xong thì ghi kết luận vào `brief.md` bằng chữ.
- [Unverified] Cách app desktop mở panel bên và render widget chưa được kiểm trong môi trường này; không có công cụ
  hiển thị thì rơi về bậc kế tiếp, không chặn brainstorm.
