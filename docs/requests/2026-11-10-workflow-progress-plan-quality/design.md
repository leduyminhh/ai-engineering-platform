# Thiết kế: báo tiến độ tổng thể, cỡ task và chất lượng plan trong workflow-feature
- Ngày: 2026-11-10
- Trạng thái: draft
- Requirement: không có
## Vấn đề và lý do
Đánh giá một lần chạy thật `workflow-feature` (repo `be-distributed-worker-platform`, request `2026-11-10-hoan-thien-luong-job`, 8 task, 2h49' tới review cuối) cho thấy:

1. **Người dùng không thấy tiến độ.** Danh sách task của app được đăng một lần lúc 05:28 với Task 1 đang làm, rồi không cập nhật trong 1h45'. `task-loop.md` mục "Báo cáo", `SKILL.md` và `WORKFLOW.md` cấm "dòng trạng thái giữa chừng" giữa G2 và G3, nên không có báo cáo tổng thể nào. Người dùng hỏi "Task 1 làm sáng giờ chưa xong".
2. **Task quá dài, không có ước lượng.** Task 7 (test tích hợp kiểm giả định) mất 32 phút. G2 không trình thời gian dự kiến.
3. **Plan sót `**Files:**`.** Task 4 sót `DlqJdbcAdapter` (đổi từ nuốt lỗi sang ném lỗi); Task 8 sót 4 rồi 2 file test (gỡ API và bean cũ). Có 3 lần `blocked`. Tự soát plan không có mục grep caller.
4. **Giả định cốt lõi của hướng không được kiểm trước G1.** `nack(Duration)` là [Unverified] ở design, tới Task 7 mới đo thấy nó tạm dừng cả consumer thread.
5. **Luật phạm vi áp không đều.** `auto.offset.reset` (đổi hành vi ngoài AC) được để chờ G3, còn `max.block.ms` (cũng đổi hành vi ngoài AC, xếp minor) lại được gộp vào Task 8 qua `Ruling:` mở rộng `Files`. Kết quả bác giả định của hướng (mục 4) cũng không dừng hỏi.
6. **Số đo nằm ngoài repo.** Số đo `nack` và `max.block.ms` chỉ có trong ledger (`.aip/`, git bỏ qua), nên không tái lập được, và comment trong test trỏ tới ledger.
7. **Cổng thừa.** Phiên hỏi duyệt commit trên nhánh feature cho brief và migration đã duyệt C2. Phiên cũng hỏi xác nhận DB đích cho container Testcontainers do chính test dựng.
## Quyết định đã chốt
Người dùng yêu cầu sửa toàn bộ phần chưa đạt (2026-11-10). Các quyết định của agent:
- Giữ nguyên số 6 loại dừng: ca "kết quả chạy thật bác giả định của hướng G1" gộp vào loại 6 (đổi điều người dùng đã duyệt), vì nhiều file và pin đếm "6 loại dừng".
- Dòng tiến độ là thông báo một chiều, không phải câu hỏi hay cổng, nên giữ nguyên nguyên tắc "giữa G2 và G3 chạy liền".
- Ước lượng là trường hướng dẫn trong plan (`**Ước lượng:**`), không thêm cảnh báo mới vào `check-request.mjs`.
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given `task-loop.md` When đọc mục "Báo tiến độ" Then sau mỗi `Task <n>: complete` có một dòng tiến độ gồm `<n>/<N>`, đã chạy, còn lại, minor hoãn, Ruling, kèm cập nhật danh sách task của công cụ (`update_plan`/`TodoWrite`), không chờ trả lời; `SKILL.md` và `WORKFLOW.md` trỏ tới mục này.
- [ ] **AC1.2** — Given `SKILL.md`, `task-loop.md` và `workflows/feature/WORKFLOW.md` Then không còn câu "không gửi dòng trạng thái giữa chừng".
- [ ] **AC1.3** — Given mục "Báo tiến độ" Then trước Task 1 đăng đủ mọi task, review cuối và G3 lên danh sách task.
- [ ] **AC1.4** — Given mục "Báo tiến độ" Then task vượt ước lượng được nêu trong dòng tiến độ.
- [ ] **AC2.1** — Given `plan-structure.md` Then mỗi task có `**Ước lượng:**`, trần 30 phút và 5 file production, vượt thì tách.
- [ ] **AC2.2** — Given G2 ở `WORKFLOW.md` và `ask-user.md` Then trình tổng ước lượng.
- [ ] **AC3.1** — Given `self-review.md` Then có mục 6 "Files đủ": grep caller, chỗ inject bean và test cho symbol bị gỡ hoặc đổi (kể cả đổi từ nuốt lỗi sang ném lỗi); `plan-structure.md` trỏ tới mục này; mọi chỗ ghi "tự soát 5 mục" đổi thành 6.
- [ ] **AC4.1** — Given `engineering-spec-writing/SKILL.md` Then có bước spike giả định [Unverified] mà hướng đã chọn dựa vào, làm trước checkpoint, ghi kết quả vào design kèm lệnh chạy lại.
- [ ] **AC4.2** — Given `checklist.md` của spec-writing Then có mục spike.
- [ ] **AC5.1** — Given `task-loop.md` loại dừng 6 Then gồm ca kết quả chạy thật bác giả định mà hướng G1 dựa vào, hỏi ngay ở task đó.
- [ ] **AC5.2** — Given mục "Nhận review" Then ba nhóm áp như nhau cho mọi mức severity, `Ruling:` không mở rộng `**Files:**` để làm thay đổi hành vi ngoài AC; bảng tự biện minh của `SKILL.md` có dòng "gộp vào task sau".
- [ ] **AC6.1** — Given `task-loop.md` và `prompts/implementer.md` Then số đo mà quyết định dựa vào phải tái lập được từ nhánh (test hoặc script trong repo, kèm lệnh chạy lại).
- [ ] **AC6.2** — Given `finish.md` bước 1 Then `Ruling:` và số đo được chép vào `design.md`.
- [ ] **AC7.1** — Given `verify-cycle.md` của `data-db-migration` Then container Testcontainers do test project dựng thì không hỏi xác nhận DB đích.
- [ ] **AC7.2** — Given `git-workflow/SKILL.md` bước 7 Then kế hoạch C2 đã duyệt và `brief.md` đã duyệt tính là plan đã duyệt cho commit của chính chúng trên nhánh feature.
- [ ] **AC8.1** — Given thay đổi nội dung chiếu Then bump `core` 1.30.0, `engineering` 2.13.0, `data` 1.6.10, `workflows` 3.15.0, `versions.mjs --lock` sau build, `npm test` exit 0 ngoài 3 pin CLAUDE.md đã đỏ trên master.
## Thiết kế
Chỉ sửa tài liệu skill/workflow và test pin; không đổi code CLI, hook hay script.
## Ảnh hưởng spec
- workflows: đổi R7
## Ngoài phạm vi và anti-goal
- Không đổi mục "Chế độ part" của `task-loop.md`: nhánh `fix/plan-execution-root-routing` đang sửa mục đó.
- Không thêm cảnh báo mới vào `check-request.mjs`, không đổi template `plan.template.md`.
## Kiểm thử
Pin `test/content/43-progress-plan-quality.pin.mjs` (đỏ 34/35 trước khi sửa, xanh sau); pin 31 đổi từ 5 sang 6 mục tự soát; `npm test`.
## Rủi ro và câu hỏi mở
- Khi merge cùng nhánh `fix/plan-execution-root-routing`: conflict dự kiến ở `core/.manifest.json` và `plugins/_versions.lock.json` (bump version). `task-loop.md` và `ask-user.md` sửa ở các đoạn khác nhau.
- [Unverified] Hiệu quả thực tế của dòng tiến độ và trần 30 phút chỉ kiểm được ở lần chạy workflow kế tiếp.
