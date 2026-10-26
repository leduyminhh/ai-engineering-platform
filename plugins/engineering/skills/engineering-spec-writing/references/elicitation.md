# Làm rõ yêu cầu — cách hỏi và tám nhóm vùng phủ

Mục tiêu: lấp các khoảng trống trong hiểu biết về tính năng TRƯỚC khi viết spec. Chạy ở **session chính** (hội thoại
trực tiếp với người dùng), không chạy trong subagent. Chỉ hỏi phần **còn thiếu** sau khi đã nạp context
(`project-knowledge/`, ADR, contract, `CLAUDE.md`) — đừng hỏi lại thứ đã rõ hoặc tìm được trong repo.

## Nguyên tắc hỏi

- **Một câu mỗi tin nhắn:** tin nhắn kết thúc bằng đúng một câu hỏi, không kèm danh sách ví dụ hay bảng câu hỏi;
  đợi trả lời rồi mới sang câu tiếp.
- **Câu mở trước:** hỏi mở để người dùng kể tình huống thật ("lần gần nhất chuyện này xảy ra thế nào?"); chỉ đưa
  lựa chọn khi họ bí. Neo câu hỏi vào tình huống cụ thể thay vì hỏi khái niệm.
- **Đoán để họ sửa:** khi có cơ sở, nêu điều mình đoán và hỏi "đúng không?" — thường nhanh hơn hỏi trống. Điều đoán
  mà chưa được xác nhận ghi **[giả định]**.
- **Playback từng phần:** hiểu xong một phần thì nói lại ngắn (khoảng 200–300 từ), chỗ suy đoán đánh dấu **[giả định]**,
  kết bằng "sai hoặc thiếu gì?", xen kẽ với câu hỏi. Không để dồn một lần diễn giải ở cuối.
- **Ưu tiên câu mở khoá spec:** hỏi trước những câu mà thiếu nó thì không viết được acceptance criteria đo được
  (mục tiêu, actor, kết quả kỳ vọng).
- **Đo được khi có thể:** khi hỏi NFR/tiêu chí, đẩy về con số/điều kiện kiểm được thay vì tính từ mơ hồ.
- **KHÔNG bịa:** phần chưa có câu trả lời → ghi **[giả định]** kèm cơ sở, và đưa vào mục *câu hỏi mở* của
  spec để con người chốt. Người dùng bỏ qua phần hỏi thì lựa chọn của agent ghi **quyết định của agent**.

## Tám nhóm là vùng phủ, không phải kịch bản

Tám nhóm dưới đây dùng để **kiểm không bỏ sót**: trước khi sang bước đề xuất, tự đối chiếu xem nhóm nào còn
trống thì mới đặt câu hỏi cho nhóm đó. **Không đọc ra** thành danh sách câu hay hỏi lần lượt từ nhóm 1 đến 8; các câu
gợi ý bên dưới chỉ để tự chọn và diễn đạt lại theo tình huống người dùng đã kể. Nhóm đã được trả lời gián tiếp thì bỏ qua.

## Nhóm 1 — Mục tiêu / why

- Vấn đề nghiệp vụ nào tính năng này giải quyết? Nếu không làm thì hậu quả gì?
- Kết quả mong muốn là gì? Đo thành công bằng chỉ số/điều kiện nào (số, tỷ lệ, thời gian)?
- Tính năng này phục vụ mục tiêu lớn hơn nào (OKR/roadmap) nếu có?

## Nhóm 2 — Actors / personas

- Ai là người dùng chính? Còn actor phụ nào (hệ thống khác, admin, batch job)?
- Vai trò/quyền của từng actor? Ai được làm gì, không được làm gì?
- Mục tiêu và bối cảnh sử dụng của họ (khi nào, ở đâu, tần suất)?

## Nhóm 3 — Phạm vi & out-of-scope

- Trong lần này, tính năng bao gồm những khả năng nào?
- Có khả năng nào **chủ đích KHÔNG làm** lần này (để tránh hiểu nhầm)?
- Ranh giới với tính năng/hệ thống lân cận ở đâu?

## Nhóm 4 — Luồng chính + edge case

- Luồng thành công (happy path) diễn ra theo bước nào (mức nghiệp vụ, không phải code)?
- Các nhánh rẽ/ngoại lệ: input sai, thiếu quyền, dữ liệu rỗng, trùng, quá hạn, hủy giữa chừng?
- Trạng thái biên: lần đầu chưa có dữ liệu (empty), lỗi hệ thống, đồng thời (concurrency)?

## Nhóm 5 — Dữ liệu & tích hợp

- Tính năng đọc/ghi dữ liệu gì? Trường bắt buộc, ràng buộc, quy tắc hợp lệ?
- Có contract/API liên quan chưa (link `docs/contracts/`)? Đồng bộ hay bất đồng bộ?
- Phụ thuộc hệ thống ngoài nào? Điều gì xảy ra khi hệ thống đó không sẵn sàng?

## Nhóm 6 — NFR (phi chức năng)

- **Hiệu năng:** khối lượng dự kiến, ngưỡng phản hồi (ví dụ p95), giới hạn tải?
- **Bảo mật:** dữ liệu nhạy cảm nào? Yêu cầu xác thực/phân quyền/nhật ký kiểm toán?
- **Khả dụng / độ tin cậy:** yêu cầu uptime, xử lý lỗi, khôi phục, nhất quán dữ liệu?
- **Khả dụng (UX) & khả năng bảo trì / tuân thủ:** i18n, a11y, quy định pháp lý cần tuân?

## Nhóm 7 — Ràng buộc & giả định

- Ràng buộc kỹ thuật (stack, nền tảng, hạ tầng) hoặc thời gian/ngân sách?
- Giả định đang dựa vào là gì? Điều gì phải đúng thì tính năng mới chạy như mô tả?
- Phụ thuộc vào quyết định/tính năng khác chưa chốt?

## Nhóm 8 — Tiêu chí chấp nhận

- Làm sao biết tính năng "xong đúng"? Điều kiện nghiệm thu đo được là gì?
- Diễn đạt được theo **Given/When/Then** cho các luồng chính + ngoại lệ không?
- Ai là người duyệt/nghiệm thu, theo tiêu chí nào?

## Sau khi làm rõ

Đề xuất 2–3 hướng (sau playback), xếp cỡ việc, rồi giao `engineering-spec-analyst` ghi spec theo [spec-structure.md](spec-structure.md); mọi phần chưa chốt giữ nguyên
dạng **[giả định]** + đưa vào mục *câu hỏi mở* để con người quyết. Kiểm tài liệu bằng [builder-check.md](builder-check.md) rồi [checklist.md](checklist.md).
