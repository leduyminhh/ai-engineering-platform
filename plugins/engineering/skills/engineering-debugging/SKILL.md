---
name: engineering-debugging
description: "Debug có hệ thống khi chưa rõ nguyên nhân: điều tra gốc trước, nêu giả thuyết rồi kiểm, mới sửa; kèm bốn kỹ thuật bổ trợ. Dùng khi người dùng muốn \"debug lỗi lạ\", \"test flaky\", \"tìm nguyên nhân gốc\", \"tại sao test này đỏ\". Không dùng khi lỗi đã rõ và cần pipeline sửa đủ bước có commit → workflow-bugfix."
order: 11
title: "Debugging — điều tra nguyên nhân gốc trước khi sửa (skill dùng chung)"
runsIn: execute
invoke: per-request
argument-hint: "[triệu chứng | test đỏ | log]"
---

# Debugging — tìm nguyên nhân gốc trước khi sửa (skill dùng chung)

Không sửa khi chưa nêu được nguyên nhân gốc bằng evidence. [Inference] Sửa theo triệu chứng tốn thời gian và thường tạo lỗi mới.

Ba skill hay bị nhầm với nhau:
- Skill này dùng cho lỗi **chưa rõ nguyên nhân** (test đỏ lạ, test flaky, lỗi chỉ ở một môi trường). Đầu ra là giả thuyết có
  evidence kèm đề xuất sửa; chỉ áp bản sửa khi người dùng muốn sửa luôn. Không tự commit.
- `workflow-bugfix` là pipeline đủ bước: tái hiện, root cause có người xác nhận, fix tối thiểu, regression, review, commit.
- `backend-fix` / `frontend-fix` áp bản sửa tối thiểu khi đã có oracle và root cause.

## Quy trình — bốn pha

1. **Điều tra.** Đọc đủ thông báo lỗi và stack trace. Tái hiện ổn định; chưa tái hiện được thì thu thêm dữ liệu, không đoán.
   Xem thay đổi gần đây của vùng nghi ngờ (`git log`, `git diff`, dependency, config). Hệ thống nhiều lớp thì thu evidence
   ở từng ranh giới (cái gì vào, cái gì ra) để biết lỗi xuất hiện ở lớp nào. Truy ngược từ chỗ nổ về nguồn:
   [references/root-cause-tracing.md](references/root-cause-tracing.md).
2. **So sánh mẫu.** Tìm đoạn tương tự đang chạy đúng; liệt kê mọi khác biệt, kể cả nhỏ; ghi giả định mà đoạn lỗi dựa vào.
3. **Giả thuyết và kiểm.** Viết một câu "X là nguyên nhân vì Y" kèm phép kiểm. Kiểm bằng thay đổi nhỏ nhất, một biến mỗi
   lần. Giả thuyết bị bác bỏ thì bỏ hẳn, không chồng thêm bản sửa lên. Thay đổi thử chỉ tạm thời: hoàn tác
   ngay (đối chiếu với mốc `git status --porcelain` ghi từ đầu) trước khi sang bước khác. Chưa hiểu thì nói là chưa hiểu.
   Khi chạy trong `workflow-bugfix`, cổng của workflow thắng.
4. **Sửa.** Chỉ khi người dùng muốn sửa luôn; nếu chỉ hỏi nguyên nhân thì dừng sau pha 3 và báo kết luận kèm đề xuất. Viết
   test tái hiện đỏ trước (kỷ luật của `engineering-tdd` khi skill đã cài; thiếu thì vẫn phải thấy test đỏ đúng lý do).
   Sửa tại nguồn, một thay đổi, rồi chạy test đó và test hẹp của vùng bị chạm. Phòng thủ nhiều lớp là bước tuỳ chọn sau khi
   đã xanh, không tính vào "một thay đổi": [references/defense-in-depth.md](references/defense-in-depth.md).

Sau 3 lần sửa thất bại thì dừng: nghi vấn kiến trúc (mỗi lần sửa lại lộ ra coupling hay shared state mới?) và hỏi người
dùng, không thử lần thứ tư. Quy tắc này giống `workflow-bugfix`.

Kỹ thuật theo loại lỗi:
- Test flaky, lỗi phụ thuộc thời gian: [references/condition-based-waiting.md](references/condition-based-waiting.md).
- Test chạy riêng thì qua, chạy chung thì đỏ, hoặc lỗi xuất hiện từ một commit nào đó:
  [references/polluter-bisect.md](references/polluter-bisect.md).

## Dấu hiệu đang đoán thay vì điều tra

| Suy nghĩ | Thực tế |
|---|---|
| "Sửa nhanh thử xem sao" | Mỗi lần thử không có giả thuyết là một biến mới. Nêu giả thuyết trước. |
| "Thêm retry hoặc tăng timeout là xong" | Đó là che triệu chứng. Tìm điều kiện thật sự đang chờ. |
| "Chắc do môi trường" | Chứng minh bằng evidence, không phải lời giải thích mặc định. |
| "Sửa luôn vài chỗ một lượt cho nhanh" | Không biết chỗ nào có tác dụng. Một thay đổi mỗi lần. |
| "Lần trước lỗi này do X" | Có thể đúng. Kiểm lại bằng evidence của lần này. |
| "Không tái hiện được nên bỏ qua" | Chưa tái hiện được nghĩa là chưa đủ dữ liệu. Thu thêm, không đoán. |

## Ranh giới an toàn

- Log tạm chỉ chèn sau khi ghi mốc `git status --porcelain` và phải gỡ hết trước khi sửa; không ghi secret hay dữ liệu cá nhân vào log.
- Không xoá, nới hay bỏ qua test để làm xanh; không `sleep` cố định hay tăng timeout để che flaky.
- Không đọc hay sửa file bí mật; không chạy lệnh tác động môi trường thật; không commit (commit đi qua `git-workflow`).
- Phát hiện thuộc loại dừng (bảo mật, dữ liệu không đảo ngược, schema DB) thì dừng và hỏi người dùng.
