---
name: engineering-api-research
description: "Nghiên cứu API ngoài từ tài liệu gốc, chạy thử script chỉ đọc, ghi file facts có nhãn [Verified]/[Inference]/[Unverified] kèm nguồn và ngày đọc. Dùng khi người dùng muốn \"tra docs API\", \"hạn mức, xác thực, mã lỗi của dịch vụ ngoài\", \"script thử chỉ đọc\", \"cái nào đã xác nhận, cái nào suy đoán\". Không dùng khi cần viết spec yêu cầu → engineering-spec-writing; ghi quyết định chọn phương án → engineering-adr."
order: 14
title: "API Research — nghiên cứu dịch vụ ngoài + ghi file facts có nhãn nguồn"
runsIn: plan
invoke: per-request
argument-hint: "[API hoặc dịch vụ cần tìm hiểu]"
---

# API Research (skill dùng chung)

Biến câu hỏi về một API hoặc dịch vụ ngoài thành **file facts**: danh sách khẳng định, mỗi dòng có nhãn độ tin cậy,
nguồn và ngày đọc. Dùng trước khi viết spec hoặc ADR dựa trên hành vi của dịch vụ đó, để quyết định không đứng trên
trí nhớ hay bài viết cũ.

Skill này **chỉ nghiên cứu và ghi sự thật**. Không chọn phương án (→ `engineering-adr`), không viết yêu cầu
(→ `engineering-spec-writing`), không viết code sản phẩm. Spike chỉ là script hoặc test nhỏ để kiểm một khẳng định.

## Quy trình — từ câu hỏi đến file facts

1. **Chốt câu hỏi cần trả lời.** Viết 1–5 câu hỏi kiểm được (hạn mức, định dạng phản hồi, cách xác thực, mã lỗi, giá,
   hành vi khi vượt hạn mức). Câu hỏi chưa rõ thì hỏi người dùng một lượt; không tự mở rộng sang thứ không ai hỏi.
   Ghi luôn câu hỏi nào làm quyết định tiếp theo phụ thuộc vào đáp án: đó là câu phải đạt `[Verified]`.

2. **Xác định phiên bản đang dùng.** Đọc phiên bản thư viện từ manifest và lockfile; với dịch vụ từ xa, ghi phiên bản API,
   region hoặc gói dịch vụ dự án nhắm tới. Chưa biết thì ghi `[Unverified]` và hỏi, không đoán.

3. **Đọc docs chính thức đúng phiên bản.** Theo mục "Kiểm nguồn" của skill `principles` (bản cài plugin:
   `core:principles`): docs chính thức đúng phiên bản, rồi changelog hoặc migration guide, rồi source thư viện đã cài,
   cuối cùng mới đến bài viết khác. Mỗi khẳng định lấy từ docs ghi URL **sau chuyển hướng** (URL cuối cùng mà công cụ
   tải về, không phải link rút gọn hay link của trang đã chuyển) và ngày đọc. Không có mạng hoặc công cụ tải trang thì
   mọi khẳng định từ docs mang `[Unverified]`; làm tiếp, không chặn.

4. **Spike nhỏ khi docs không đủ hoặc mơ hồ.** Spike là một script hoặc test chạy được, tối đa khoảng 15 phút mỗi khẳng
   định, đặt ngoài nhánh sản phẩm hoặc trong thư mục tạm. Chỉ gọi đường **chỉ đọc, không tính tiền** (xem Ranh giới an
   toàn). Ghi vào file facts: lệnh chạy lại, phiên bản đã chạy, kết quả thật (cắt gọn, đã che khoá và dữ liệu cá nhân).
   Spike ra kết quả khác docs thì ghi cả hai dòng và đánh dấu mâu thuẫn, không âm thầm chọn một bên.

5. **Ghi file facts** theo [references/facts.template.md](references/facts.template.md). Mỗi khẳng định đúng một nhãn:
   - `[Verified]`: đã đọc nguồn chính thức hoặc đã chạy spike thấy kết quả. Bắt buộc kèm nguồn, URL sau chuyển hướng
     (nếu là docs), ngày đọc; nếu từ spike thì kèm lệnh chạy lại.
   - `[Inference]`: suy ra từ nguồn đã đọc nhưng docs không nói thẳng. Nêu nguồn của tiền đề và bước suy luận.
   - `[Unverified]`: chưa kiểm được (không có mạng, cần tài khoản trả phí, chưa được duyệt gọi thử). Nêu cách kiểm sau.

   Câu chưa đọc nguồn thì không vào file facts.

6. **Soát lại và trình người dùng.** Đối chiếu từng khẳng định `[Verified]` với nguồn lần cuối (đúng con số, đúng tên
   tham số, đúng phiên bản). Báo cáo ngắn: câu hỏi nào đã có `[Verified]`, câu nào còn `[Inference]` hoặc
   `[Unverified]` và hệ quả cho quyết định kế tiếp. Dòng chưa kiểm mà quyết định dựa vào thì nêu như rủi ro chặn,
   để người dùng chọn: duyệt spike có tốn kém, cấp tài khoản, hoặc chấp nhận rủi ro.

File facts đặt ở thư mục request (`docs/requests/<ngày>-<slug>/facts.md`) khi nghiên cứu phục vụ một request; không có
request thì đặt theo quy ước tài liệu của project và nêu đường dẫn trong báo cáo. Spec và ADR sau đó **link** tới dòng
facts, không chép lại số liệu.

## Ranh giới an toàn

- **Không gọi API tính tiền hoặc ghi dữ liệu thật khi chưa được duyệt.** Spike mặc định chỉ dùng đường chỉ đọc, môi
  trường thử (sandbox, test mode) hoặc dữ liệu giả. Cần gọi đường có phí, đường ghi hay tài khoản thật thì hỏi người
  dùng, nêu chi phí ước tính và dữ liệu nào bị đụng; chưa có lời duyệt rõ ràng thì ghi `[Unverified]`.
- **Không đưa khoá thật vào file facts**, lệnh chạy lại, log hay báo cáo: khoá, token, cookie, URL có chữ ký. Lệnh chạy
  lại dùng biến môi trường hoặc placeholder (`<API_KEY>`); output dán vào facts phải che trước khi lưu.
- Khoá cho spike do người dùng tự cấp và tự nhập qua kênh của họ; không tạo tài khoản dịch vụ, không đăng ký thay.
- Không đánh dấu `[Verified]` cho khẳng định chưa có nguồn hoặc kết quả chạy trong lượt này. Ngôn ngữ đo được; không
  viết "đảm bảo", "không bao giờ" khi nguồn không nói vậy.
- Không tải hay chạy mã từ nguồn không tin cậy để "thử cho biết"; thư viện cần thử thì cài đúng phiên bản dự án khai
  báo hoặc phiên bản ghi trong facts.
- Spike không vào nhánh sản phẩm trừ khi người dùng yêu cầu; skill này không sửa code sản phẩm.
- Con người duyệt file facts trước khi spec hoặc ADR dùng nó làm nguồn.

## Dấu hiệu đang tự biện minh

| Ý nghĩ | Thực tế |
|---|---|
| "Mình nhớ API này trả như vậy, ghi luôn" | Trí nhớ không phải nguồn. Chưa đọc docs đúng phiên bản thì `[Unverified]`. |
| "Docs rõ rồi, khỏi spike" | Docs đúng thì spike tốn vài phút; docs lệch thực tế thì tốn cả task sau. Quyết định phụ thuộc thì spike. |
| "Gọi thử một lần bản trả phí cho nhanh" | Chưa duyệt thì không gọi. Ghi `[Unverified]` và hỏi. |
| "Dán nguyên phản hồi vào facts cho đủ bằng chứng" | Che khoá và dữ liệu cá nhân, cắt phần liên quan; facts không phải nơi lưu log. |
| "Link này đủ rồi, khỏi ghi ngày đọc" | Docs đổi theo thời gian; không có ngày đọc thì không biết còn đúng không. |

## Verification (trước khi báo hoàn thành)

- [ ] Mỗi câu hỏi ở bước 1 có dòng facts tương ứng hoặc được nêu rõ là chưa trả lời được.
- [ ] Mỗi khẳng định đúng một nhãn; `[Verified]` có nguồn, ngày đọc và URL sau chuyển hướng hoặc lệnh chạy lại.
- [ ] Không có khoá, token hay dữ liệu cá nhân trong file facts và báo cáo.
- [ ] Không có lệnh gọi tính tiền hoặc ghi dữ liệu thật nào chưa được duyệt.
- [ ] Báo cáo nêu dòng `[Inference]`/`[Unverified]` mà quyết định kế tiếp dựa vào.
