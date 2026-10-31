# Thiết kế: sửa các minor còn hoãn của part-mode-tooling-gaps
- Ngày: 2026-10-31
- Trạng thái: merged — merge `fix/part-mode-tooling-minors` vào master b5d8d21 ngày 2026-10-31 (mục 1–4, review cuối 0 blocker/major); mục 5 vẫn chờ người dùng duyệt, chưa viết
- Requirement: không có
## Vấn đề và lý do
Review cuối nhánh `feature/part-mode-tooling-gaps` và lượt thử 3 (`../2026-10-31-part-mode-tooling-gaps/trial-3.md`) để lại các `minor (deferred)`:
1. `ledger.mjs`: dòng `Task <n>: complete` của task TDD `có` do session chính làm (TOOLING) không bị đòi `tests: <lệnh> exit 0`; `red: exit 1` (không có lệnh) được nhận; tách dòng bằng `\r?\n` nên `\r` lẻ cho một dòng `Task … inline` thiếu evidence lọt kiểm.
2. `final-review.md`: task sửa thêm vào plan gốc không nói có dòng `Task <n>: complete` riêng, nên làm tiếp sau compact sẽ làm lại task đó. `review clean` ở `task-loop.md` bước 9 chưa nhắc `spec_verdict: compliant`.
3. `task-review.md`: reviewer không được chạy git, nhưng không được bảo kiểm file của commit đỏ qua mục `## Commits` của review package (có từ `ddb7341`).
4. `workflows/R7` nói review cuối dùng `general-purpose` `model: opus` khi diff không chạm backend/frontend; `workflows/feature/WORKFLOW.md` Bước 6 chỉ nêu `backend-reviewer`/`frontend-reviewer`.
## Quyết định đã chốt
- (1) `ledger.mjs`: tách dòng bằng `/\r\n|\r|\n/` ở `validateLine` và `main`. `RED_RE` đòi một lệnh (không mở đầu bằng `tests:`) giữa `red:` và `exit <n>`; khối `red:` không có lệnh (`red: exit <n>`, `red: tests: …`) bị từ chối ở mọi dòng `complete`. Dòng `complete` của task TDD `có` do session chính làm (selfRun) phải có `tests: <lệnh> exit 0` và không có exit khác 0 ngoài khối `red:` — cùng kiểm với dòng inline.
- (2) `final-review.md`: task sửa thêm vào plan gốc ghi `Task <n>: complete (…)` theo `task-loop.md` bước 9 sau re-review. `task-loop.md` bước 9: `review clean` = `spec_verdict: compliant` (hoặc `cannot_verify` session chính đã giải quyết ở bước 8 mà không ra lệch) và không còn finding `blocker`/`major` mở.
- (3) `task-review.md` bước 3: TDD `có` thì kiểm qua mục `## Commits` của review package rằng commit đỏ chỉ chứa file test và đứng trước commit code.
- (4) Sửa `WORKFLOW.md` Bước 6 cho khớp R7 (không đổi R7 về nghĩa). `general-purpose` không phải agent của plugin nên ghi không có chữ `agent` đứng trước: `graph.json` không đổi, bump `workflows` vì nội dung chiếu ra đổi.
## Tiêu chí chấp nhận
- [x] **AC1.1** — Given plan có task `TOOLING` TDD `có` When `ledger.mjs` ghi dòng `complete` có `red:` hợp lệ nhưng thiếu `tests: <lệnh> exit 0`, hoặc `tests:` exit khác 0, hoặc kèm exit khác 0 ngoài `red:` Then exit 2 và không ghi
- [x] **AC1.2** — Given task `TOOLING` TDD `có` When dòng `complete` có `red: exit 1` (không có lệnh) Then exit 2 và không ghi
- [x] **AC1.3** — Given đối số có `\r` lẻ ngăn hai dòng When dòng sau là `Task <n>: complete … inline` thiếu evidence Then `validateLine` từ chối
- [x] **AC2.1** — Given task sửa thêm vào plan gốc sau review cuối When re-review xong Then `final-review.md` bảo ghi `Task <n>: complete (…)` theo `task-loop.md` bước 9
- [x] **AC2.2** — Given `task-loop.md` bước 9 When đọc định nghĩa `review clean` Then có vế `spec_verdict: compliant`
- [x] **AC3.1** — Given task TDD `có` When reviewer đọc `task-review.md` Then được bảo kiểm file của commit đỏ qua mục `## Commits` của review package
- [x] **AC4.1** — Given diff toàn nhánh không chạm backend/frontend When đọc `workflows/feature/WORKFLOW.md` Bước 6 Then reviewer là `general-purpose` `model: opus`, khớp R7, và `graph.json` vẫn qua `checkGraphAgainstBody`
## Thiết kế
- `ledger.mjs`: hằng `LINE_SPLIT = /\r\n|\r|\n/` dùng ở `validateLine` và `main`; `RED_RE = /\bred:\s*(?!tests:)\S(?:(?!\btests:).)*? exit (\d+)\b/gi` (`red:x` không dấu cách vẫn là khối red như R12); điều kiện evidence (`INLINE_EVIDENCE_RE` và không `EXIT_FAILED_RE` trên phần đã bỏ `red:`) áp cho dòng inline và cho dòng selfRun TDD `có`.
- Mục (2)(3)(4) là câu chữ.
## Ảnh hưởng spec
- workflows: đổi R7
- workflows: đổi R12
## Ngoài phạm vi và anti-goal
- Không pin câu chữ (2)(3)(4) bằng test (văn xuôi); `graph.json` đã có contract đối chiếu.
- Không xử lý các minor khác của ledger (`TDD_KINDS` hai nguồn, comment lịch sử trong test, F5/F10).
## Ràng buộc
- Script zero-dependency; bump `core` và `workflows`, `node cli/lib/versions.mjs --lock`; `npm test` exit 0.
## Không đổi
- Dòng `complete` của task TDD `không`, kind `BE` không inline, hay task không có trong plan vẫn ghi như cũ (exit 0).
- `validateLine(line)` không ctx giữ hành vi R12 cho dòng không inline.
## Kiểm thử
- AC1.1–AC1.3: một test có tham số trong `test/content/32-superpowers-gap.pin.mjs` (cùng chỗ kiểm `ledger.mjs`).
- AC2.1, AC2.2, AC3.1: đọc lại tài liệu; AC4.1: `npm test` (contract graph↔body).
## Đề xuất chờ duyệt (mục 5, chưa viết)
- **Red cho hàm mới (V6):** đề xuất chấp nhận `ERR_MODULE_NOT_FOUND`/lỗi import là red hợp lệ khi test gọi một module/hàm chưa tồn tại, với điều kiện `tdd.red` ghi rõ lý do đó; stub trong `src/` chỉ khi muốn red bằng assertion và stub đi chung commit code, không vào commit đỏ. Lý do: giữ quy tắc "commit đỏ chỉ chứa file test" đơn giản, đúng thứ tự đỏ → xanh.
- **Chỗ lưu `agent_result` của review (V12):** đề xuất session chính lưu nguyên khối vào `.aip/runs/<request>/<part>/task-<n>-review.md` (re-review: `task-<n>-review-<k>.md`) và `final-review-result.md`, cạnh `task-<n>-report.md`; ledger không đổi.
- **Nhóm Song song khi một phiên không mở được (V11):** đề xuất part đó chạy trong session gốc nhưng vẫn ở worktree + nhánh part riêng và `merge --no-ff` như part song song; ghi một dòng `Ruling:` ở ledger `root/`; không chuyển cả nhóm sang tuần tự.
