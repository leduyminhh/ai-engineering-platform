# Thiết kế: engineering-repo-audit và đọc caller/callee trong review
- Ngày: 2026-10-29
- Trạng thái: approved — người dùng yêu cầu làm B6 ngày 2026-10-29 (backlog của `2026-10-23-eval-coverage-and-upgrade`)
- Requirement: không có
## Vấn đề và lý do
Skill review chỉ đọc diff nên bỏ sót lỗi nằm ở nơi gọi hoặc nơi được gọi của symbol bị đổi. Chưa có skill nào soát cả repo: `engineering-quality-gate` chạy tool và security review, `*-code-review` bị khoá ở diff/PR/module, `engineering-convention-enforce` chỉ kiểm quy ước. Người dùng không có cách yêu cầu "soát toàn repo, cho tôi danh sách rủi ro xếp hạng" mà không bị ép vào diff hoặc scanner.
## Quyết định đã chốt
- Thêm skill `engineering-repo-audit` vào plugin `engineering`, `runsIn: execute`, `order: 9`, chỉ đọc.
- Audit không đọc hết repo: skill dẫn agent xếp hạng điểm nóng (kích thước × tần suất sửa × thiếu test) rồi đọc có giới hạn, và báo rõ phần chưa soát.
- Đầu ra nằm trong chat; chỉ ghi file khi người dùng yêu cầu rõ.
- `backend-code-review` và `frontend-code-review` thêm một bước đọc caller/callee của symbol công khai bị đổi, có giới hạn số symbol và độ sâu một bước.
## Thiết kế
**Skill `engineering-repo-audit`** (`plugins/engineering/skills/engineering-repo-audit/`):
- `SKILL.md`: ranh giới an toàn (chỉ đọc, không đọc file bí mật, không chạy lệnh tác động môi trường, finding có `file:line` và nhãn proven/suspected), quy trình 0–4 (chốt scope và ngân sách đọc → xếp hạng điểm nóng → đọc theo trục → xếp hạng finding → báo cáo), định tuyến sang skill chuyên trách.
- `references/hotspot-ranking.md`: cách xếp hạng điểm nóng bằng `git log --name-only`, `git ls-files`, đếm dòng, tìm test tương ứng; ngân sách đọc theo cỡ repo.
- `references/audit-axes.md`: các trục (lỗi logic, bảo mật nhìn bằng mắt, độ tin cậy dưới tải, rủi ro thiếu test, đường chậm, code chết/trùng) và dấu hiệu từng trục.
- `references/audit-report-template.md`: mẫu báo cáo (phạm vi và phần chưa soát, bảng finding xếp hạng, việc nên làm trước, route).
**Caller/callee trong review:** thêm vào `review-dimensions.md` của hai skill review một mục "Đọc phần liên quan": với tối đa 5 symbol công khai bị đổi chữ ký hoặc hành vi, tìm caller bằng `grep`, đọc callee trực tiếp, nêu finding ngoài diff dưới nhãn "ngoài scope, ảnh hưởng trực tiếp". Không lan quá một bước.
**Chiếu:** skill nằm trong plugin `engineering` đã published, nên wizard tự cung cấp; thêm vào `_cowork.json`; mô tả plugin cập nhật; bump version `engineering` và `backend`, `frontend`.
## Ảnh hưởng spec
Không ảnh hưởng: skill mới và nội dung review không đổi hành vi của năng lực nào trong `docs/specs/` (projection chiếu skill theo quy ước sẵn).
## Ngoài phạm vi và anti-goal
- Không thay `engineering-quality-gate` (scanner, SCA); audit chỉ định tuyến sang đó khi cần.
- Không tự sửa code, không tạo plan sửa lỗi tự động.
- Không tuyên bố "repo sạch" hoặc "đã soát hết".
- B7 (embedded mode) và B8 (statusline) không làm ở đây.
## Ràng buộc
- Mô tả skill ≤ 500 ký tự, theo mẫu "Dùng khi … Không dùng khi … → id"; không lặp nguyên văn trigger của skill khác; ngân sách mô tả tổng ≤ 450 ký tự mỗi skill (trung bình).
- Thân skill có đủ hai heading `## Quy trình…` và `## Ranh giới an toàn…`.
- Mọi nội dung hướng người dùng bằng tiếng Việt có dấu.
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given plugin `engineering`, When chạy `node test/validate.mjs --build`, Then `engineering-repo-audit` qua mọi contract (frontmatter, heading, mô tả, link `references/`) và có trong `_cowork.json`.
- [ ] **AC1.2** — Given một repo mẫu có lỗi gài sẵn, When agent chạy skill với yêu cầu "soát toàn repo", Then agent không gọi Edit/Write và mọi finding có `file:line`.
- [ ] **AC1.3** — Given cùng repo mẫu, When agent chạy skill, Then báo cáo có phần "chưa soát" và không dùng câu khẳng định tuyệt đối ("hết bug", "đã soát hết").
- [ ] **AC2.1** — Given `backend-code-review` và `frontend-code-review`, When người dùng review một diff đổi symbol công khai, Then `review-dimensions.md` của mỗi skill hướng dẫn đọc caller/callee với giới hạn 5 symbol và một bước.
## Kiểm thử
- AC1.1: contract hiện có (`10-source`, `40-conventions`, `60-versions`) cộng contract link `references/` mới; không viết pin mới.
- AC1.2, AC1.3: case eval `evals/engineering/repo-audit-readonly` (graders `seeded-found`, `coverage-disclosed`) (n=3, có trần chi phí). Kết quả được ghi vào `evals/README.md` kèm nhãn Δ đo cái gì.
- AC2.1: một assert trong contract vì không có contract chung nào bắt được: mục "Đọc phần liên quan" tồn tại trong `review-dimensions.md` của hai skill review.
## Để builder quyết
- Tên chính xác các lệnh xếp hạng điểm nóng trên Windows và POSIX (ưu tiên `git` thuần để chạy được cả hai).
## Rủi ro và câu hỏi mở
- [Inference] Model trần có thể đã soát repo tốt; Δ eval có thể chỉ phản ánh định dạng và độ trung thực về phần chưa soát, như các case trước.
- Hotspot dựa vào lịch sử git; repo mới hoặc shallow clone không có tín hiệu churn, skill phải nói rõ và chuyển sang xếp theo kích thước.
