# Checklist — Definition of Done cho một feature/requirement spec

Chạy checklist này trước khi báo "spec xong". Ngôn ngữ **đo được**; phần còn thiếu phải **báo rõ (fail-loud)**,
không đánh dấu xong khi chưa đủ.

## Đầy đủ mục

- [ ] Có **Bối cảnh / vấn đề**: nêu được vì sao cần và ai bị ảnh hưởng.
- [ ] Có **Mục tiêu & success criteria** (success criteria ĐO ĐƯỢC, tách khỏi mục tiêu định hướng).
- [ ] Có **Phạm vi** và **Out-of-scope** (điều chủ đích không làm) rõ ràng.
- [ ] Có **Actors / personas (lite)**: ai dùng + vai trò/quyền.
- [ ] Có **Functional requirements** ở **mức FEATURE** (không phân rã story/task).
- [ ] Có **NFR** khi liên quan (hiệu năng/bảo mật/khả dụng…), đo được khi có thể.
- [ ] Có **Acceptance criteria** dạng checkbox, đo được.
- [ ] Có **Điểm chạm data/contract** (link, không chép).
- [ ] Có **Rủi ro / giả định / câu hỏi mở**.

## Chất lượng nội dung

- [ ] **Truy vết được:** mỗi requirement soi chiếu về nguồn (project-knowledge/ADR/contract) hoặc actor + mục
      tiêu; không có requirement "mồ côi".
- [ ] **Acceptance criteria đo được:** Given/When/Then hoặc tiêu chí kiểm được; không dùng từ mơ hồ
      ("nhanh", "ổn định") mà không kèm ngưỡng.
- [ ] **Không mâu thuẫn:** các mục nhất quán với nhau và với ADR/contract/project-knowledge; điểm lệch đã ghi
      thành câu hỏi mở.
- [ ] **Feature-level:** không lẫn bước triển khai/code vào requirement.
- [ ] **Giả định đánh dấu:** mọi **[giả định]** hiện diện rõ và nằm trong mục câu hỏi mở, không âm thầm điền.

## Quyết định & liên kết

- [ ] Quyết định lớn đã ghi **ADR** ở `docs/decisions/<số>-<slug>.md` theo `_TEMPLATE.md`; spec link tới ADR.
- [ ] Link contract/data-model chính xác (đường dẫn tương đối tồn tại); không lặp chi tiết trường/endpoint.

## Đặt đúng chỗ & hình thức

- [ ] Spec nằm ở `docs/requests/<yyyy-mm-dd>-<slug>/requirement.md` (+ `design.md` khi có); chưa dựng `plan.md`.
- [ ] Mỗi AC có ID `AC<n>.<m>`, không trùng; `check-request.mjs` của skill `artifact-templates` đã chạy trên thư mục request.
- [ ] Bám scaffold `_TEMPLATE` (mở rộng, không dựng cấu trúc song song).
- [ ] **Tiếng Việt CÓ DẤU**, UTF-8; văn phong rõ, không sáo rỗng.

## Thành thật (bắt buộc báo)

- [ ] Liệt kê phần **còn thiếu / chưa chốt** thay vì tự lấp — nêu rõ cần con người quyết gì.
- [ ] Ngôn ngữ **đo được**, KHÔNG tuyên bố "đảm bảo / loại bỏ rủi ro / chặn triệt để".
- [ ] Nếu cần artifact BA sâu (PRD/SOD/DDD/FSD/BRD/personas) hoặc đặc tả SAP-specific → đã nêu **handoff FIS**
      (khi ở Cowork có `fisba`/`fissap`/`fispm`); nếu không có FIS thì xác nhận spec feature-level này đã đủ.
- [ ] **Con người duyệt** spec trước khi dùng làm nguồn cho plan/triển khai.
