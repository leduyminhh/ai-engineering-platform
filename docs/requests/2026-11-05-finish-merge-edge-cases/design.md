# Thiết kế: hướng dẫn hai ca biên của "Merge local theo khoá"
- Ngày: 2026-11-05
- Trạng thái: merged 2e4b6fc3
- Requirement: không có
## Vấn đề và lý do
Mục "Merge local theo khoá" của `core/skills/plan-execution/references/finish.md` (áp cho `mergeLocal: true` lẫn lựa chọn 1 tay ở G3) chỉ nêu ba kết quả của bước 2: xanh thì commit, conflict hoặc suite đỏ thì `git merge --abort`. Hai ca sau chưa có hướng dẫn, agent phải đoán:

1. **Git từ chối bắt đầu merge** (vd file chưa theo dõi trong cây sẽ bị ghi đè): git thoát khác 0 mà không tạo trạng thái merge (không có `MERGE_HEAD`), nên `git merge --abort` sẽ lỗi ("There is no merge to abort"). Văn bản hiện tại đọc như "mọi lỗi của merge thì abort".
2. **Nhánh feature đã là tổ tiên của nhánh gốc** (`git merge-base --is-ancestor <nhánh feature> <nhánh gốc>` thoát 0): `git merge --no-ff --no-commit` báo "Already up to date", exit 0, không có `MERGE_HEAD`. Chạy tiếp theo văn bản hiện tại thì full suite chạy trên cây không đổi, rồi `git commit --no-edit` lỗi "nothing to commit" (hoặc, nếu agent tự thêm `--allow-empty`, tạo commit rỗng), và bước 3 đặt `merged <hash merge>` với hash không tồn tại.

Nguồn gốc: finding minor (deferred) có từ trước, ghi ở review cuối request `2026-11-04-finish-manual-merge-no-commit`.

Các chỗ mô tả cùng luồng, đã đọc: `finish.md` (bảng 3 lựa chọn hàng 1, mục "Merge local theo khoá", bullet merge local tay, mục "Dọn theo khoá"), `workflows/feature/WORKFLOW.md` (Bước 7, hàng "Merge local…" trong bảng Xử lý lỗi, Rollback), `workflows/feature/references/error-matrix.md` (hàng cùng nội dung), `docs/specs/workflows/spec.md` R7. `ask-user.md` và `git-workflow/SKILL.md` không mô tả cơ chế merge: không đổi.
## Quyết định đã chốt
Người dùng giao hai ca và hướng xử lý ca 1 (qua session chính, 2026-11-05): ca 1 là dừng, báo lỗi chặn, không abort, không dọn. Ca 2: dừng, báo, không tạo commit rỗng. Việc còn mở và cần chốt ở G1 là **ca 2 có làm tiếp commit docs `merged <hash>` và xoá plan không**:

| Hướng | Nội dung | Đánh đổi | Kết luận |
|---|---|---|---|
| A. Dừng hẳn, người dùng quyết | Phát hiện ngay đầu bước 2 (trước khi checkout), không merge, không chạy suite, không bước 3–5 (không đặt `merged`, không xoá plan, không dọn); báo là lỗi chặn kèm hash tip nhánh feature và nhánh gốc, gợi ý người dùng xác nhận nhánh đã merge ở đâu rồi tự đặt `merged <hash>` | Thêm một lượt người dùng; nhưng nhánh "đã là tổ tiên" mà chưa ai merge qua quy trình này là bất thường (đã merge tay, qua PR, nhánh rỗng) nên không suy ra được hash `merged` đúng | **Chọn (đề xuất)** |
| B. Bỏ qua merge, làm tiếp bước 3–5 | Coi nhánh đã merge: đặt `merged <tip nhánh feature>`, xoá plan, dọn theo `cleanup` | Tự động hơn; nhưng nhánh rỗng (chưa có commit) cũng bị đánh dấu `merged`, và `merged <hash>` trỏ tip feature chứ không phải commit merge | Loại |
| C. Tạo commit rỗng `--allow-empty` | Giữ mọi bước như cũ | Lịch sử có commit không đổi gì, hash `merged` vô nghĩa | Loại |

Quyết định của agent: phát hiện ca 2 ở đầu bước 2, trước checkout, vì `git merge-base --is-ancestor` chỉ đọc ref; ca 1 phân biệt bằng "không có trạng thái merge" (`git rev-parse -q --verify MERGE_HEAD` không in gì) thay vì đoán theo thông báo của git. Giữ heading "Merge local theo khoá" và số bước 1–5 (pin `36-brainstorming-routing`): chỉ sửa nội dung bước 2 và mô tả lỗi chặn.
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given `finish.md` mục "Merge local theo khoá" When đọc bước 2 Then nêu: `git merge --no-ff --no-commit` bị git từ chối bắt đầu (thoát khác 0, không có `MERGE_HEAD`) → lỗi chặn: dừng, báo, không `git merge --abort`, không dọn.
- [ ] **AC2.1** — Given cùng mục When đọc bước 2 Then nêu: `git merge-base --is-ancestor <nhánh feature> <nhánh gốc>` thoát 0 (kiểm trước checkout) → lỗi chặn: dừng, báo hash tip nhánh feature và nhánh gốc, không merge, không commit rỗng, không chạy bước 3–5; người dùng quyết có đặt `merged` và xoá plan không.
- [ ] **AC3.1** — Given `WORKFLOW.md` (Bước 7, hàng lỗi merge local trong bảng Xử lý lỗi, Rollback) và `error-matrix.md` When đọc phần merge local Then cùng nêu hai ca mới và `--abort` chỉ khi đã có trạng thái merge (conflict hoặc suite đỏ).
- [ ] **AC4.1** — Given `docs/specs/workflows/spec.md` Then R7 mô tả hai ca và bảng lịch sử có thêm hàng cho request này (R7, đổi).
- [ ] **AC5.1** — Given test pin trong `test/content/` When chạy Then đỏ nếu mục "Merge local theo khoá" thiếu `git merge-base --is-ancestor` hoặc `MERGE_HEAD`, hoặc mất heading hay số bước 1–5; không ghim văn xuôi.
- [ ] **AC6.1** — Given thay đổi nội dung chiếu Then `core/.manifest.json` và `workflows/.manifest.json` được bump patch, `node cli/lib/versions.mjs --lock` đã chạy sau `npm run build`, và `npm test` exit 0.
## Thiết kế
Chỉ sửa tài liệu và một test pin; không đổi code CLI, hook hay script.
1. `finish.md` bước 2: đầu bước, trước checkout, chạy `git merge-base --is-ancestor <nhánh feature> <nhánh gốc>`; thoát 0 → lỗi chặn (ca 2). Sau `git merge --no-ff --no-commit`: git từ chối bắt đầu (không `MERGE_HEAD`) → lỗi chặn, không abort (ca 1); `MERGE_HEAD` có mà conflict hoặc suite đỏ → `git merge --abort` như cũ.
2. `WORKFLOW.md` Bước 7, hàng bảng Xử lý lỗi, Rollback; `error-matrix.md`: cùng nội dung, ngắn.
3. `docs/specs/workflows/spec.md` R7: thêm hai ca vào đoạn merge local, nối nguồn request này; thêm hàng lịch sử ngày 2026-11-05.
4. Test pin mới trong `test/content/` cho AC5.1 (chạy: `node test/validate.mjs --build --only <substr>`).
5. Bump `core` 1.28.3 → 1.28.4, `workflows` 3.14.14 → 3.14.15; `npm run build`, `node cli/lib/versions.mjs --lock`.
## Ảnh hưởng spec
- workflows: đổi R7
## Ngoài phạm vi và anti-goal
- Không đổi `mergeLocal`, `cleanup`, `partRunner`, commit docs `merged <hash>` hay xoá plan ở đường bình thường; không đổi `ask-user.md`, `git-workflow/SKILL.md`, code CLI/hook/script.
- Không tự động hoá việc phát hiện (chỉ hướng dẫn cho agent).
- Không push, không merge vào master.
## Ràng buộc
Văn bản tiếng Việt có dấu, UTF-8 không BOM, LF; test chỉ ghim hợp đồng vận hành (lệnh, điều kiện dừng), không ghim văn xuôi.
## Kiểm thử
AC1.1–AC4.1: đọc diff ở review; AC5.1: test pin (đỏ trước khi sửa tài liệu, xanh sau); AC6.1: `npm test`.
## Để builder quyết
Câu chữ chính xác của bước 2 và hàng bảng lỗi, miễn đúng AC1.1–AC3.1.
## Rủi ro và câu hỏi mở
Hướng A (dừng hẳn) cần người dùng tự đặt `merged` trong ca 2; nếu muốn tự động hơn chọn hướng B ở G1. Các pin hiện có đọc `finish.md`/`WORKFLOW.md` (`31`, `33`, `36`, `38`, `40`): chạy `npm test` bắt pin vỡ.
