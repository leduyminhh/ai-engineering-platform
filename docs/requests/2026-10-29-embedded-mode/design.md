# Thiết kế: chế độ nhúng của skill khi agent chạy trong workflow
- Ngày: 2026-10-29
- Trạng thái: approved — người dùng chọn hướng "quy tắc chung + contract" ngày 2026-10-29 (B7 của backlog `2026-10-23-eval-coverage-and-upgrade`)
- Requirement: không có
## Vấn đề và lý do
Skill được viết cho phiên tương tác: hỏi người dùng, xin xác nhận, chờ duyệt. Khi workflow giao việc cho agent worker nạp skill đó, agent không có người dùng để hỏi. Hiện từng agent tự ghi hành vi này theo cách riêng (`engineering-spec-analyst` trả `blocked` kèm `questions[]`, `backend-fixer` chặn mở rộng phạm vi) và không có quy tắc chung, nên agent mới hoặc agent cũ có thể lệch nhau mà contract không bắt được.
## Quyết định đã chốt
- Một mục "Chế độ nhúng" trong `core/principles/workflow-output-contract.md` là nguồn sự thật duy nhất.
- Mọi agent trong `plugins/*/agents/*.md` có một dòng trỏ tới mục đó.
- Contract kiểm hai điều: mục tồn tại trong contract đầu ra, và mọi agent có dòng trỏ.
- Không thêm con trỏ vào từng `SKILL.md`: quyết định chế độ nhúng nằm ở agent (nơi nạp skill), nên con trỏ ở skill chỉ lặp lại và tốn context.
## Thiết kế
Mục "Chế độ nhúng" có sáu quy tắc: không hỏi người dùng (thiếu đầu vào hoặc cần xác nhận → `status: blocked` + `questions[]`), gate ⏸ của skill thuộc workflow, phạm vi do bước gọi giao, không commit/push/tag/merge, đầu ra là `agent_result`, ranh giới an toàn của skill giữ nguyên. Chế độ nhúng chỉ bỏ tương tác, không nới an toàn.
Chế độ nhúng áp dụng khi agent worker chạy theo giao việc của workflow hoặc `plan-execution`. Session chính tự chạy skill theo yêu cầu người dùng thì không ở chế độ nhúng.
## Ảnh hưởng spec
- workflows: thêm R11
## Ngoài phạm vi và anti-goal
- Không sửa nội dung từng skill; không đổi hành vi agent đã đúng.
- Không đo bằng eval: hành vi nhúng cần agent chạy qua workflow thật, đo được khi có môi trường Linux có Bash.
## Ràng buộc
- Nội dung bằng tiếng Việt có dấu; mục mới nằm trong `workflow-output-contract.md` để `core:principles` chiếu ra mọi provider.
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given `core/principles/workflow-output-contract.md`, When đọc mục "Chế độ nhúng", Then mục nêu đủ sáu quy tắc và nói chế độ này chỉ bỏ tương tác, không nới ranh giới an toàn.
- [ ] **AC1.2** — Given mọi agent trong `plugins/*/agents/`, When chạy `node test/validate.mjs --build`, Then agent nào thiếu dòng trỏ tới mục "Chế độ nhúng" làm contract đỏ.
## Kiểm thử
- AC1.1 và AC1.2: contract `10-source` (phần agents), một assert cho mỗi ý; không viết pin.
## Rủi ro và câu hỏi mở
- [Inference] Dòng trỏ giống hệt nhau ở 16 agent có thể bị agent bỏ qua như văn bản lặp; chưa đo được hành vi thật.
- Nếu một agent cần bước nhúng riêng (ví dụ `quality-auditor` phải mask secret) thì ghi ở phần Phạm vi của agent đó, không đưa vào mục chung.
