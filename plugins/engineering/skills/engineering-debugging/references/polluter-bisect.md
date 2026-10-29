# Tìm test gây ô nhiễm và commit gây lỗi bằng chia đôi

Hai tình huống, cùng một kỹ thuật: chia đôi tập ứng viên cho tới khi còn một.

## Test chạy riêng thì qua, chạy chung thì đỏ

1. Xác nhận: test nạn nhân qua khi chạy một mình, đỏ khi chạy cùng bộ test.
2. Lấy danh sách test chạy trước nạn nhân theo đúng thứ tự của runner.
3. Chạy **nửa đầu** của danh sách rồi test nạn nhân. Đỏ thì kẻ gây ô nhiễm nằm trong nửa đầu; qua thì nằm trong nửa sau.
4. Lặp lại trên nửa chứa nó cho tới khi còn một test; xác nhận bằng cách chạy riêng cặp (kẻ gây ô nhiễm, nạn nhân).
5. Tìm tài nguyên dùng chung giữa hai test: file, biến toàn cục, biến môi trường, singleton, bản ghi DB, cổng mạng.
6. Sửa bằng cô lập: mỗi test tự dựng và dọn dữ liệu của nó. Không sửa bằng cách ép thứ tự chạy.

Dùng cờ chạy một tập con test của runner đang dùng (theo tài liệu của runner đó); không tự bịa cờ.

## Lỗi xuất hiện từ một commit nào đó

Dùng `git bisect` với lệnh kiểm có exit code rõ ràng:

```bash
git bisect start <commit-xấu> <commit-tốt>
git bisect run <lệnh kiểm trả exit 0 khi tốt, khác 0 khi xấu>
git bisect reset
```

Lưu ý: lệnh kiểm phải chạy được ở mọi commit trong khoảng (có thể phải build lại); commit không build được thì `git bisect skip`.
`git bisect` checkout lần lượt các commit trong khoảng (HEAD tách rời), nên chỉ chạy khi cây làm việc sạch và luôn `git bisect reset` khi xong.
