# Thiết kế: merge local tay đi cùng cơ chế `--no-commit` như merge local theo khoá
- Ngày: 2026-11-04
- Trạng thái: in-progress — nhánh feature/finish-manual-merge-no-commit
- Requirement: không có
## Vấn đề và lý do
`core/skills/plan-execution/references/finish.md` có hai đường merge local. Đường `mergeLocal: true` (mục "Merge local theo khoá") đã an toàn: cây sạch, `git merge --no-ff --no-commit`, full suite trên cây đã merge, xanh mới commit, đỏ hoặc conflict thì `git merge --abort`. Đường tay (lựa chọn 1 của G3 khi thiếu khoá, bullet "merge local" ở "Chi tiết từng lựa chọn") merge `--no-ff` trước rồi mới chạy full suite; suite đỏ thì commit merge vẫn nằm trên nhánh gốc, có thể là nhánh protected, và finish.md chỉ bảo "dừng, không xoá gì".

Nguồn gốc: finding ở review cuối request `2026-11-04-living-spec-bootstrap`, ghi `Ruling:` "ngoài AC, đổi hành vi" vì cơ chế có từ trước nên đẩy sang request này.

Các chỗ mô tả cùng luồng, đã đọc:
- `finish.md`: bảng 3 lựa chọn (hàng 1 "merge `--no-ff`"), mục "Merge local theo khoá" (mở đầu "Chỉ khi `mergeLocal: true`…"), bullet tay, mục "Dọn theo khoá" (nhắc "full suite sau merge ở 'Chi tiết từng lựa chọn'").
- `workflows/feature/WORKFLOW.md` Bước 7 (cơ chế `--no-commit` chỉ gắn với `mergeLocal`), bảng "Xử lý lỗi" (hàng "Merge local theo khoá `mergeLocal`…"), đoạn Rollback.
- `workflows/feature/references/error-matrix.md`: chưa có hàng cho lỗi chặn khi merge local.
- `core/skills/plan-execution/references/ask-user.md` (hàng G3) và `core/skills/git-workflow/SKILL.md` (mục "Kết thúc nhánh") chỉ nêu tên lựa chọn, không mô tả cơ chế merge: không cần đổi.
## Quyết định đã chốt
Người dùng chốt qua session chính (2026-11-04): cho đường tay đi cùng cơ chế với đường theo khoá, giữ nguyên phần còn lại (commit docs `merged <hash>`, xoá plan, hỏi dọn khi `cleanup` không bật).

Hướng đã cân nhắc:

| Hướng | Nội dung | Đánh đổi | Kết luận |
|---|---|---|---|
| A. Đường tay trỏ sang bước 1–4 của "Merge local theo khoá" | Một cơ chế, hai cách kích hoạt; bullet tay chỉ giữ phần riêng (nhánh protected cần chọn tường minh) | Mục "Merge local theo khoá" phải nói rõ áp cho cả hai cách kích hoạt; bước 5 (hỏi push/PR) chỉ của đường khoá vì ở đường tay push là lựa chọn 2 | **Chọn** |
| B. Chép lại cơ chế vào bullet tay | Hai bản sao của cùng quy trình | Lệch nhau lần sửa sau | Loại |
| C. Giữ nguyên, chỉ thêm `git reset --hard` khi suite đỏ | Sửa hậu quả thay vì không tạo ra | `reset --hard` là lệnh phá huỷ, trái AGENTS.md Safety | Loại |

Quyết định của agent: giữ nguyên tên mục "Merge local theo khoá" và số thứ tự 1–5 vì `test/content/36-brainstorming-routing.pin.mjs` và nhiều chỗ khác tham chiếu theo tên và số; chỉ đổi câu mở đầu và chú thích bước 5.
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given `finish.md` When đọc bullet "merge local" (lựa chọn tay) và hàng 1 của bảng 3 lựa chọn Then cả hai dẫn tới cơ chế "cây sạch, `git merge --no-ff --no-commit`, full suite trên cây đã merge, xanh mới commit, đỏ hoặc conflict thì `git merge --abort`", và không còn câu "chạy lại full suite trên kết quả merge" hay chuỗi merge rồi mới chạy suite.
- [ ] **AC2.1** — Given mục "Merge local theo khoá" When đọc câu mở đầu Then nêu rõ áp cho cả `mergeLocal: true` (đã duyệt G3) lẫn lựa chọn tay 1 của G3, bước 5 (hỏi push/PR riêng) ghi chỉ cho đường theo khoá, và heading cùng số bước 1–5 giữ nguyên.
- [ ] **AC3.1** — Given mục "Dọn theo khoá" When đọc điều kiện Then trỏ một nguồn duy nhất (bước 2 của "Merge local theo khoá") thay vì "hoặc full suite sau merge ở Chi tiết từng lựa chọn".
- [ ] **AC4.1** — Given `WORKFLOW.md` Bước 7, bảng "Xử lý lỗi" và Rollback, và `error-matrix.md` When đọc phần merge local Then cơ chế `--no-commit`/`--abort` và lỗi chặn (cây bẩn, conflict, suite đỏ trên cây đã merge) mô tả cho cả hai đường (khoá và tay), không còn gắn riêng với `mergeLocal`.
- [ ] **AC5.1** — Given test `test/content` mới When chạy trên `finish.md` Then đỏ nếu bullet tay thiếu `--no-commit` hoặc `--abort`, hoặc còn câu "full suite trên kết quả merge" (bảo vệ đúng hồi quy: commit merge nằm lại khi suite đỏ).
- [ ] **AC6.1** — Given thay đổi nội dung chiếu Then `core/.manifest.json` và `workflows/.manifest.json` được bump patch, `node cli/lib/versions.mjs --lock` đã chạy, và `npm test` exit 0.
## Thiết kế
Chỉ sửa tài liệu và một test pin; không đổi code CLI, hook hay script.
1. `finish.md`: hàng 1 bảng 3 lựa chọn; mở đầu "Merge local theo khoá" (áp cho cả hai cách kích hoạt; bước 5 chỉ khi `mergeLocal: true`); bullet "merge local" ở "Chi tiết từng lựa chọn" rút gọn thành: nhánh protected cần chọn tường minh, rồi "làm bước 1–4 của 'Merge local theo khoá'"; "Dọn theo khoá" trỏ bước 2.
2. `WORKFLOW.md` Bước 7: đưa cơ chế `--no-commit` ra khỏi mệnh đề `mergeLocal`, áp cho "merge local" nói chung; hàng bảng lỗi và Rollback đổi từ "theo khoá `mergeLocal`" thành "(theo khoá hoặc lựa chọn tay)".
3. `error-matrix.md`: thêm một hàng lỗi chặn cùng nội dung hàng tương ứng trong `WORKFLOW.md`.
4. Test pin trong `test/content/` cho AC5.1, cách chạy: `node test/validate.mjs --build --only <substr>`.
5. Bump `core` 1.28.1 → 1.28.2, `workflows` 3.14.13 → 3.14.14; `node cli/lib/versions.mjs --lock` sau `npm run build`.
## Ảnh hưởng spec
- workflows: đổi R7
## Ngoài phạm vi và anti-goal
- Không đổi hành vi `mergeLocal: true`, `cleanup`, `partRunner`, commit docs `merged <hash>`, xoá plan, hỏi dọn.
- Không đổi `ask-user.md` và `git-workflow/SKILL.md` (không mô tả cơ chế merge).
- Không push.
## Ràng buộc
Văn bản tiếng Việt có dấu, UTF-8 không BOM, LF; test không ghim văn xuôi ngoài hợp đồng vận hành (lệnh `--no-commit`, `--abort`).
## Kiểm thử
AC1.1–AC4.1: đọc diff ở review; AC5.1: test pin (đỏ trước khi sửa tài liệu, xanh sau); AC6.1: `npm test`.
## Để builder quyết
Câu chữ chính xác của bullet tay và hàng bảng lỗi, miễn đúng AC1.1–AC4.1.
## Rủi ro và câu hỏi mở
Các pin hiện có trong `test/content/31-…`, `33-…`, `36-…`, `38-…` đọc `finish.md` và `WORKFLOW.md`; builder chạy `npm test` để bắt pin vỡ. Không có câu hỏi mở.
