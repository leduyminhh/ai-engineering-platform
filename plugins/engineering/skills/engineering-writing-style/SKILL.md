---
name: engineering-writing-style
description: "Viết lại văn bản cho người đọc cho tự nhiên: bỏ cụm sáo rỗng của văn AI, giữ nguyên nghĩa, số liệu, thuật ngữ; phủ tiếng Việt và tiếng Anh. Dùng khi người dùng muốn \"viết lại cho tự nhiên\", \"bỏ văn AI\", \"humanize\", \"sửa văn phong\", \"bớt sáo rỗng\". Không dùng khi viết release notes từ git → engineering-release-notes; viết spec → engineering-spec-writing."
order: 13
title: "Writing Style — viết lại văn bản cho người đọc cho tự nhiên"
runsIn: execute
invoke: per-request
---

# Writing Style (skill dùng chung)

Văn bản agent viết cho người đọc hay mang dấu hiệu "văn AI": câu mở rỗng, từ nhấn rỗng, gom ba ý ở mọi câu,
câu kết lặp lại thân bài. Skill này dạy dò và viết lại những chỗ đó mà không đổi nội dung. Nó dùng chung quy
tắc với mục "Văn phong & trình bày" của `engineering-release-notes`, không thay thế mục đó.

## Quy trình

1. **Xác định loại văn bản.** Đối chiếu [references/scope.md](references/scope.md). Loại không thuộc diện cần
   (code, comment, header commit, config, log, output cho máy đọc, prompt giao agent, trích dẫn) thì dừng và
   nói một dòng vì sao không áp.
2. **Dò.** Tìm cụm trong [references/patterns-vi.md](references/patterns-vi.md) và
   [references/patterns-en.md](references/patterns-en.md), rồi các dấu hiệu cấu trúc ở cuối mỗi file.
3. **Viết lại.** Nói thẳng ý chính ở câu đầu, bỏ từ nhấn không mang thông tin, thay danh sách gạch đầu dòng
   bằng câu khi nội dung là văn xuôi, bỏ câu kết chỉ nhắc lại thân bài. Câu dài ngắn xen kẽ.
4. **Quét.** Khi văn bản nằm trong file, chạy `node <thư mục skill>/scripts/scan-style.mjs <file>` (exit 0 sạch,
   1 còn cụm, 2 sai đối số). Cụm dùng đúng nghĩa thì giữ.
5. **Tự soát.** So bản mới với bản cũ: nghĩa, số liệu, ngày, tên, thuật ngữ kỹ thuật không đổi; không thêm
   hay bớt thông tin.

## Ranh giới an toàn

- Không thêm, không bớt thông tin; không đổi nghĩa, số, ngày, tên riêng, thuật ngữ kỹ thuật.
- Không sửa code block, inline code, URL, đường dẫn, trích dẫn.
- Không áp cho loại "không cần" trong `references/scope.md`, kể cả khi người dùng nhờ "viết lại cho tự nhiên"
  mà đối tượng là một trong các loại đó: nói rõ rồi dừng.
- Script chỉ để tự soát, không phải cổng chặn: danh sách cụm cố định nên bỏ sót văn AI không dùng cụm trong
  bảng và có thể báo nhầm cụm đúng nghĩa.
- Không tự viết lại văn bản người dùng không yêu cầu.

## Đầu ra

Chỉ trả văn bản đã viết lại, không lời dẫn. Khi sửa trực tiếp một file, báo số cụm đã bỏ và cụm còn giữ vì
đúng nghĩa.

## Bản đồ tài liệu

Nạp đúng file khi cần:

- [references/scope.md](references/scope.md): loại văn bản cần và không cần áp văn phong, kèm lý do.
- [references/patterns-vi.md](references/patterns-vi.md): bảng cụm tiếng Việt và dấu hiệu cấu trúc.
- [references/patterns-en.md](references/patterns-en.md): bảng cụm tiếng Anh và dấu hiệu cấu trúc.
- `scripts/scan-style.mjs`: quét file theo bảng cụm, in `file:line: "<cụm>" → <thay bằng>`.
