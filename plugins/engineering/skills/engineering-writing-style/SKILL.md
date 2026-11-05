---
name: engineering-writing-style
description: "Soạn hoặc viết lại văn bản cho người đọc theo giọng tự nhiên: bỏ cụm sáo rỗng của văn AI, giữ nguyên nghĩa, số liệu, thuật ngữ; phủ tiếng Việt và tiếng Anh. Dùng khi người dùng muốn \"viết lại cho tự nhiên\", \"bỏ văn AI\", \"humanize\", \"sửa văn phong\", \"soạn README/PR cho tự nhiên\". Không dùng khi cần gom lịch sử git thành release notes → engineering-release-notes; cần làm rõ yêu cầu và viết spec → engineering-spec-writing."
order: 13
title: "Writing Style — soạn và viết lại văn bản cho người đọc"
runsIn: execute
invoke: per-request
---

# Writing Style (skill dùng chung)

Văn bản agent viết cho người đọc hay mang dấu hiệu "văn AI": câu mở rỗng, từ nhấn rỗng, gom ba ý ở mọi câu,
câu kết lặp lại thân bài. Skill này dạy tránh và sửa những chỗ đó mà không đổi nội dung. Nó dùng chung quy
tắc với mục "Văn phong & trình bày" của `engineering-release-notes`, không thay thế mục đó.

Hai chế độ:

- **Soạn mới:** agent tự viết README, docs, mô tả PR, release notes, body commit hay câu trả lời chat. Viết thẳng
  theo quy tắc dưới đây; nháp xong thì tự dò theo bảng và dấu hiệu cấu trúc.
- **Viết lại:** có sẵn một bản và người dùng nhờ sửa văn phong. Giữ nghĩa, chỉ đổi cách diễn đạt.

## Quy trình

1. **Xác định loại văn bản.** Đối chiếu [references/scope.md](references/scope.md). Loại "không cần" (ví dụ code, comment,
   header commit, config, log, output cho máy đọc, prompt giao agent, trích dẫn) thì agent không tự áp. Khi người
   dùng yêu cầu rõ vẫn làm, sau khi nêu một dòng rủi ro: đổi chữ có thể đổi hành vi hoặc phá so khớp, test pin.
2. **Dò.** Tìm cụm trong [references/patterns-vi.md](references/patterns-vi.md) và
   [references/patterns-en.md](references/patterns-en.md), rồi các dấu hiệu cấu trúc ở cuối mỗi file.
3. **Viết hoặc viết lại.** Nói thẳng ý chính ở câu đầu, bỏ từ nhấn không mang thông tin, dùng câu thay gạch
   đầu dòng khi nội dung là văn xuôi, bỏ câu kết chỉ nhắc lại thân bài. Câu ngắn là chính, tránh mọi câu cùng
   độ dài.
4. **Quét.** Khi văn bản nằm trong file, chạy `node <thư mục skill>/scripts/scan-style.mjs <file>` (exit 0 sạch,
   1 còn cụm, 2 sai đối số, file không đọc được hoặc bảng cụm hỏng). Văn bản không nằm trong file (như câu trả lời chat) thì bỏ bước này. Cụm dùng đúng
   nghĩa thì giữ.
5. **Tự soát.** Khi viết lại, so bản mới với bản gốc: nghĩa, số liệu, ngày, tên, thuật ngữ kỹ thuật không đổi;
   không thêm hay bớt thông tin. Khi soạn mới, đối chiếu với nguồn của nội dung (diff, kết quả chạy, yêu cầu).

## Ranh giới an toàn

- Không thêm, không bớt thông tin; không đổi nghĩa, số, ngày, tên riêng, thuật ngữ kỹ thuật.
- Không sửa code block, inline code, URL, đường dẫn, trích dẫn.
- Loại "không cần" trong `references/scope.md`: agent không tự áp. Người dùng yêu cầu rõ thì nêu rủi ro một dòng
  rồi làm theo yêu cầu.
- Script chỉ để tự soát, không phải cổng chặn: danh sách cụm cố định nên bỏ sót văn AI không dùng cụm trong
  bảng và có thể báo nhầm cụm đúng nghĩa. Fence code không đóng được coi là code đến hết file. Indented code block (thụt 4, không fence, ngoài list) bị quét như văn xuôi.
- Không tự viết lại văn bản của người dùng khi họ không yêu cầu.

## Đầu ra

Chỉ trả văn bản đã viết, không lời dẫn. Khi sửa trực tiếp một file, báo số cụm đã bỏ và cụm còn giữ vì
đúng nghĩa.

## Bản đồ tài liệu

Nạp đúng file khi cần:

- [references/scope.md](references/scope.md): loại văn bản cần và không cần áp văn phong, kèm lý do.
- [references/patterns-vi.md](references/patterns-vi.md): bảng cụm tiếng Việt và dấu hiệu cấu trúc.
- [references/patterns-en.md](references/patterns-en.md): bảng cụm tiếng Anh và dấu hiệu cấu trúc.
- `scripts/scan-style.mjs`: quét file theo bảng cụm, in `file:line: "<cụm>" → <thay bằng>`.
