# Cụm cần bỏ hoặc thay (tiếng Việt)

Bảng là nguồn duy nhất của `scripts/scan-style.mjs`: mỗi hàng là một cụm chữ thuần, không regex. Cụm dùng đúng
nghĩa thì giữ.

## Mở đầu rỗng

| Cụm | Thay bằng |
|---|---|
| Trong thế giới ngày nay | bỏ, vào thẳng ý |
| Trong bối cảnh hiện nay | bỏ, vào thẳng ý |
| Không thể phủ nhận rằng | bỏ |
| Điều đáng chú ý là | bỏ, nêu luôn điều đó |
| Cần lưu ý rằng | bỏ, hoặc "Lưu ý:" khi là cảnh báo thật |
| Phải nói rằng | bỏ |
| Hãy cùng khám phá | bỏ |
| Chào mừng bạn đến với | bỏ, nêu tên và việc nó làm |
| Như chúng ta đều biết | bỏ |
| Trong bài viết này, chúng ta sẽ | nêu thẳng nội dung |

## Từ nhấn rỗng

| Cụm | Thay bằng |
|---|---|
| đóng vai trò quan trọng | nêu vai trò cụ thể |
| vô cùng quan trọng | nêu hậu quả nếu bỏ qua |
| giải pháp toàn diện | nêu giải pháp làm gì |
| mạnh mẽ | bỏ, hoặc số đo; chỉ khi dùng làm từ nhấn |
| đột phá | bỏ, nêu thay đổi cụ thể |
| liền mạch | bỏ, hoặc nêu bước được bỏ; chỉ khi dùng làm từ nhấn |
| nâng tầm | bỏ, nêu kết quả |
| tối ưu hóa trải nghiệm | nêu thay đổi và số đo |
| mở khóa sức mạnh | bỏ |

## Câu kết lặp

| Cụm | Thay bằng |
|---|---|
| Tóm lại | bỏ khi chỉ nhắc lại thân bài |
| Nói tóm lại | bỏ khi chỉ nhắc lại thân bài |
| Tựu trung lại | bỏ |
| Hy vọng bài viết này | bỏ |
| Hãy cho tôi biết nếu bạn cần | bỏ, hoặc hỏi một câu cụ thể |
| Chúc bạn thành công | bỏ |

## Dấu hiệu cấu trúc

Script không quét mục này; tự soát bằng mắt.

- Gom ba ý ở mọi câu ("nhanh, ổn định và dễ dùng") dù nội dung chỉ có một hai ý.
- "Không chỉ … mà còn …" dùng làm khuôn cho nhiều câu liên tiếp.
- In đậm tràn lan: nhiều cụm đậm trong một đoạn thì không cụm nào còn nổi.
- Emoji ở đầu dòng hoặc đầu mục trong văn bản kỹ thuật.
- Gạch đầu dòng cho nội dung vốn là văn xuôi liền mạch. Ngoại lệ: release notes, CHANGELOG và danh sách thật (các mục độc lập) thì gạch đầu dòng là chuẩn.
- Câu kết lặp lại thân bài bằng chữ khác.
- Các câu dài gần bằng nhau, cùng nhịp.
