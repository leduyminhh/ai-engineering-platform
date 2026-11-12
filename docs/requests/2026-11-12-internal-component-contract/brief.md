# Brief: hợp đồng nội bộ giữa các component
- Ngày: 2026-11-12
- Trạng thái: approved

## Vấn đề và loại việc

Khi hai component của một hệ thống nói chuyện với nhau mà không qua frontend (lệnh hoặc job gửi sang worker, message hay event qua queue, payload HTTP giữa hai service), bộ skill không có chỗ nào để chốt hợp đồng đó. Tên khoá, kiểu, bắt buộc hay tuỳ chọn, quy ước camelCase hay snake_case, thời điểm đổi `Instant` sang chuỗi ISO thường chỉ được thống nhất bằng lời rồi lệch giữa producer và consumer, tới vòng review muộn mới lộ.

Đây là gap hạng 3 của `docs/requests/2026-11-12-skill-coverage-audit/backlog.md` (trục "thiếu"). Loại việc: **feature** về nội dung skill của bộ: sửa skill, template và test, không viết code ứng dụng. Phạm vi: nội dung skill và template của repo aip.

Ranh giới với các request khác trong backlog (mỗi gap là một request riêng):

- Hạng 1 lo ngữ nghĩa chuẩn hoá giá trị đầu vào trong AC (strip, rỗng so với thiếu khoá, đếm ký tự). Request này lo **hình dạng dữ liệu trên đường truyền giữa hai component**: khoá nào, kiểu gì, định dạng thời gian ra sao.
- Hạng 2 lo routing hạng 1 sai; hạng 4 lo hạ tầng dưới dạng code; hạng 5 lo thứ tự deploy và rollback nhiều component. Request này không chạm các việc đó.

## Vì sao bây giờ và thành công trông thế nào

Số đếm từ ledger của project nguồn ở đợt trước: cụm hợp đồng nội bộ khớp 10/23 ledger, 6/9 request. Regex "rộng", không loại trùng, nên số thật có thể thấp hơn. Chi phí khi thiếu (lỗi tích hợp tới vòng review muộn) là đánh giá của agent, `[Inference]`: chưa có số đo chi phí. Dẫn chứng đến từng dòng nằm ở ghi chú phiên ngoài repo, không commit vì mang tên request của project ngoài.

Thành công (đề xuất, người dùng sửa khi duyệt):

- Khi spec hoặc plan có hai component giao tiếp qua lệnh, queue hay HTTP nội bộ, quy trình dẫn tới một file hợp đồng ở `docs/contracts/` thay vì chốt miệng.
- Có bước đối chiếu hợp đồng với code producer và consumer, chỉ đọc, báo lệch theo khoá, kiểu, định dạng.
- Đo sau này bằng ledger của request mới: số ruling và vòng review nêu lỗi khớp hợp đồng nội bộ. Chưa có số nền sạch; `ledger-metrics.mjs` chưa đếm cụm này.

## Goal, non-goal, anti-goal

Goal:

- Một mẫu hợp đồng nội bộ cho ba loại giao tiếp: lệnh hoặc job gửi worker, message hoặc event qua queue, payload HTTP giữa service. Mẫu nêu đủ các trường mà ca lệch hay gặp (tên khoá và quy ước đặt tên, kiểu, bắt buộc hay tuỳ chọn, định dạng thời gian, phiên bản).
- Hợp đồng nội bộ nằm ở file riêng trong `docs/contracts/`; `design.md` và `plan.md` trỏ tới.
- Mở rộng skill `backend-api-contract` bằng một reference về hợp đồng nội bộ, tái dùng `docs/contracts/`, versioning và kiểm drift.
- Thêm ca làm rõ và mục trong template để spec và plan nhận ra sớm khi có component giao tiếp với nhau.
- Kiểm drift chỉ đọc giữa hợp đồng và code hai phía, kèm yêu cầu hai phía test từ cùng một nguồn (theo mục Testing của `AGENTS.md`).

Non-goal:

- Viết script kiểm drift mới (request này chỉ nêu cách kiểm, chưa có tool).
- Sinh code hay client từ hợp đồng nội bộ; dựng schema registry; bắt buộc AsyncAPI hay công cụ ngoài.
- Domain event trong cùng process (đã có ở `backend-implement`, một process và một transaction); người dùng không chọn loại này.
- Sửa luồng OpenAPI cho hợp đồng frontend↔backend.
- Gap hạng 1, 2, 4, 5.

Anti-goal:

- Biến thành bắt buộc cho mọi request: request chỉ có một component hoặc không có kênh giao tiếp nội bộ không bị ép viết hợp đồng.
- Đổi `description` của `backend-api-contract` theo cách làm hạng 2 (routing) trượt thêm hoặc đạp lên request hạng 2.
- Đưa tên request hay tên project ngoài vào tài liệu commit.

## Hiện trạng và tham khảo đã thấy

Đã đọc thân (chỉ đọc) các file dưới đây; kết luận gắn `[Verified]` chỉ ở chỗ thân file đã đọc:

- `plugins/backend/skills/backend-api-contract/SKILL.md` và `references/openapi-first.md` `[Verified]`: chỉ lo hợp đồng OpenAPI 3.1 ở `docs/contracts/openapi.json` giữa frontend và backend (endpoint, DTO, versioning, kiểm drift endpoint/DTO). Không nói gì về lệnh gửi worker, message trên queue hay payload giữa service. Hai file `references/versioning.md` và `references/contract-drift-check.md` chưa đọc thân.
- `plugins/backend/skills/backend-implement/SKILL.md` `[Verified]` và `references/` `[Inference]` (mới grep, chưa đọc từng file): domain event chỉ trong cùng process; không có hướng dẫn chốt cấu trúc payload. Bước "Chốt use-case" lấy contract OpenAPI làm đầu vào khi có.
- `plugins/backend/templates/architecture/ARD.md` (grep) `[Inference]`: nêu "message/queue consumer" là một kênh vào (driving port) và `<bc>-api-contract` (DTO + `@HttpExchange`) là mặt published qua HTTP; không có chỗ cho payload queue hay lệnh worker.
- `plugins/engineering/skills/engineering-spec-writing/SKILL.md` `[Verified]`: nhóm "dữ liệu & tích hợp" trong vùng phủ chỉ là gợi ý hỏi; `design.template.md` `[Verified]` không có mục nào cho hợp đồng nội bộ.
- `plugins/engineering/skills/engineering-plan-writing/SKILL.md` và `references/plan-structure.md` `[Verified]`: khối `Interfaces` chỉ ghi chữ ký hàm, kiểu hoặc `operationId` nguyên văn trong backtick, khớp chữ giữa các task của một plan; `check-partition.mjs` P4/P5 kiểm tên interface trong backtick giữa các part cùng nhóm Song song. Không có chỗ cho tên khoá hay định dạng thời gian, và khối này không còn sau request.
- `workflows/feature/WORKFLOW.md` (grep) `[Inference]`: Bước 3 chốt contract OpenAPI "khi phạm vi có API"; không nói tới hợp đồng nội bộ.
- `AGENTS.md` mục Testing `[Verified]`: hợp đồng giữa các component (schema, JSON HTTP, vector dùng chung) phải được test ở hai phía từ một nguồn chung, không chép tay.

Chưa xem:

- Từng dòng ledger của project nguồn: số 10/23 và 6/9 chỉ là số đếm regex rộng, chưa kiểm xem mỗi dòng có thật là hợp đồng nội bộ lệch hay chỉ nhắc từ khoá.
- Thân `backend-init` (chưa biết chính xác nó tạo gì ở `docs/contracts/`), thân `contract-drift-check.md` và `versioning.md`.
- Bằng chứng trực tiếp cho loại "message/event qua queue" và "payload HTTP giữa service": dẫn chứng đọc được chỉ nêu lệnh gửi worker. Hai loại này là `[giả định]`.

## Hướng đã cân nhắc

Người dùng đã chọn ở thẻ hỏi đầu (cả bốn lần theo khuyến nghị):

- **Loại giao tiếp:** lệnh hoặc job gửi worker, message hoặc event qua queue, payload HTTP giữa service nội bộ. Không chọn domain event trong cùng process.
- **Nơi chốt, chọn: file riêng ở `docs/contracts/`**, `design.md` chỉ trỏ tới. Loại: mục mới trong `design.md` (nằm ở tài liệu của một request, khó dùng lại), mở rộng khối `Interfaces` của plan (chốt muộn, chỉ kiểm khớp chữ giữa task, không đối chiếu với code).
- **Cách đưa vào bộ skill, chọn: mở rộng `backend-api-contract`** bằng một reference mới và thêm ca vào template. Loại: skill riêng (thêm một skill vào routing; ledger nguồn-C cụm 10 ghi thêm skill mới làm routing tụt dưới khoá, và `overlap` có thể cao với `backend-api-contract`); chỉ thêm ca vào `clarify-core.md` và template (không có bước kiểm drift, không có chỗ giữ hợp đồng lâu dài). Đánh đổi của hướng chọn: `description` hiện chỉ nói OpenAPI nên cần đổi mô tả để kích hoạt đúng, mà việc đó chạm vùng của request hạng 2.
- **Kiểm drift, chọn: drift chỉ đọc kèm test hai phía từ một nguồn.** Loại: chỉ drift chỉ đọc (lỗi có thể lọt khi chạy thật); không kiểm drift (lệch vẫn bắt ở review cuối như hiện tại).

## Quyết định của agent

- Slug `internal-component-contract`; brief ở `docs/requests/2026-11-12-internal-component-contract/` của repo aip.
- Câu mở của thẻ đầu (người dùng kể tình huống thật gần nhất) chưa được trả lời; request dựa trên dẫn chứng trong backlog và tình huống riêng của người dùng chưa được bổ sung.
- Ranh giới với hạng 1: request này lo hình dạng dữ liệu trên đường truyền giữa hai component; hạng 1 lo ngữ nghĩa chuẩn hoá giá trị trong AC.
- Việc sửa `description` của `backend-api-contract`: mặc định agent chọn là chỉ thêm một vế ngắn nêu hợp đồng nội bộ, sửa sau khi request hạng 2 merge, rồi chạy `routing-score.mjs` để kiểm không tụt dưới `rank1.lock.json`. Người dùng đã chốt thứ tự này ở thẻ duyệt brief (2026-11-12), không còn là quyết định của agent.
- Việc sửa nội dung skill nên bump `.manifest.json` của đúng plugin có file đổi rồi `node cli/lib/versions.mjs --lock`, theo quy ước repo. Design liệt kê theo file thực đổi: `backend` (skill, reference), `engineering` (nếu sửa `engineering-plan-writing` hoặc `engineering-spec-writing`), `core` (nếu sửa `artifact-templates`, vd `design.template.md`).
- `phạm-vi: không-code` nghĩa là không viết code ứng dụng và không viết script kiểm drift mới; sửa file nội dung skill, template và test cấu trúc nhỏ (nếu repo đã có mẫu ở `test/contract/`) vẫn nằm trong phạm vi. Nội dung skill đi qua `aip-add-content`.
- Ngưỡng kích hoạt và mức bắt buộc: hợp đồng nội bộ là **khuyến nghị**, kích hoạt khi design nêu từ hai component thuộc process hoặc service khác nhau giao tiếp qua lệnh, queue hay HTTP nội bộ. Design có thể chỉnh ngưỡng; request một component không bị ép.
- Bước đối chiếu hợp đồng với code: chạy như bước kiểm drift của `backend-api-contract`, `backend-reviewer` gọi khi có hợp đồng nội bộ. Hai phía nằm ở hai repo mà chỉ đọc được một phía thì ghi phía kia là "chưa kiểm được", không suy diễn.
- Tiêu chí test của request: mọi thứ kiểm được bằng `npm test` hiện có (validate, routing); thêm test mới chỉ khi design nêu một invariant cấu trúc chưa có test nào bắt. "Test hai phía từ một nguồn" là yêu cầu viết trong reference, không phải test chạy trong `npm test`.
- Trường riêng của queue và HTTP (ack hoặc retry, idempotency key, thứ tự) có vào mẫu hợp đồng hay không do design chốt; mẫu mở rộng được theo loại giao tiếp.

## Phần đoán

- [giả định] "message/event qua queue" và "payload HTTP giữa service" gặp cùng loại lỗi với "lệnh gửi worker": dẫn chứng chỉ nêu loại sau.
- [giả định] Định dạng file hợp đồng nội bộ (bảng Markdown, JSON Schema hay khác) và tập trường tối thiểu do design chốt; brief này chưa đề xuất.
- [giả định] Hợp đồng nội bộ nên là file riêng bất kể request chỉ chạm hai component trong cùng service.
- [giả định] Chi phí "cao" của gap này ở cột Chi phí của backlog là đánh giá của agent, chưa có số đo.
- [giả định] Mở rộng `backend-api-contract` không làm routing của skill này trượt thêm; chưa kiểm bằng `routing-score.mjs`.

## Định tuyến
loại-việc: feature
phạm-vi: không-code
đầu-ra-mong-đợi: một request làm từ design tới thay đổi nội dung skill backend-api-contract, template spec/plan và test, để hợp đồng nội bộ giữa component được chốt ở docs/contracts/ và kiểm drift
rủi-ro: sửa description của backend-api-contract đụng request routing hạng 2; hợp đồng nội bộ bị bắt buộc cho cả request chỉ có một component; ba loại giao tiếp chưa đủ dẫn chứng từng dòng
ứng-viên-route: [engineering-spec-writing, aip-add-content]
route-đã-duyệt: chưa-có-quy-trình
