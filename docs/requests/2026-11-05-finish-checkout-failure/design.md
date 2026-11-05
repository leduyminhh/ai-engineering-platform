# Thiết kế: checkout nhánh gốc thất bại trong "Merge local theo khoá"
- Ngày: 2026-11-05
- Trạng thái: in-progress — nhánh claude/finish-merge-edge-cases-12ddeb
- Requirement: không có
## Vấn đề và lý do
Bước 2 của mục "Merge local theo khoá" (`core/skills/plan-execution/references/finish.md`) bảo "chuyển sang nhánh gốc đã nêu ở G3" rồi chạy `git merge --no-ff --no-commit <nhánh feature>`, nhưng không nói gì khi bước chuyển nhánh thất bại. Finding F2 của review cuối request `2026-11-05-finish-merge-edge-cases` (đã kiểm trên git 2.47.1): nhánh gốc đang được một worktree khác giữ (bố cục thường gặp: phiên chạy trong `.claude/worktrees/…`, còn `master` hoặc nhánh gốc đang checkout ở gốc repo chính) thì `git checkout <nhánh gốc>` thoát 128 ("already used by worktree at …"). Agent cứ chạy tiếp `git merge …` trên nhánh feature thì git báo "Already up to date", thoát 0, không có `MERGE_HEAD`: ca này không khớp gạch đầu dòng nào của bước 2 (ca "git từ chối bắt đầu" đòi thoát khác 0), nên agent có thể coi như merge xong rồi chạy full suite và commit docs `merged <hash>` sai.

Các chỗ mô tả cùng luồng, đã đọc: `finish.md` (bước 2), `workflows/feature/WORKFLOW.md` (Bước 7, hàng bảng Xử lý lỗi về merge local, Rollback), `workflows/feature/references/error-matrix.md` (hàng cùng nội dung), `docs/specs/workflows/spec.md` R7, pin `test/content/41-finish-merge-edge-cases.pin.mjs`. Không đổi `task-loop.md` (định nghĩa "Lỗi chặn" của nó là finding F1 riêng, ngoài request này).
## Quyết định đã chốt
Người dùng yêu cầu làm follow-up F2 (2026-11-05). Việc cần chốt ở G1: cách xử lý khi checkout thất bại.

| Hướng | Nội dung | Đánh đổi | Kết luận |
|---|---|---|---|
| A. Lỗi chặn | Chuyển nhánh bằng `git checkout <nhánh gốc>`; thoát khác 0 → dừng, báo tên nhánh gốc và nơi đang giữ nó (`git worktree list`), không `git merge`, không `--abort`, không dọn; người dùng merge ở worktree đó hoặc chọn nhánh gốc khác | Thêm một lượt người dùng ở bố cục worktree phổ biến; không đụng cây làm việc của worktree khác | **Chọn (đề xuất)** |
| B. Merge bằng `git -C <worktree giữ nhánh gốc>` | Tìm worktree giữ nhánh gốc, chạy `--no-commit`, suite và commit ở đó | Tự động hơn; nhưng thao tác trên cây làm việc của phiên khác (có thể đang bẩn hoặc đang chạy), kiểm "cây sạch" và chạy suite phải làm lại ở đó, đường dẫn/cấu hình khác worktree hiện tại | Loại |
| C. Merge ngay trên nhánh feature | Bỏ qua checkout | Merge feature vào chính nó, vô nghĩa | Loại |

Quyết định của agent: giữ heading và số bước 1–5; không thêm bước mới, chỉ tách lệnh checkout ra thành một dòng rõ trong bước 2 (sau kiểm tổ tiên, trước `git merge`).
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given `finish.md` mục "Merge local theo khoá" bước 2 When đọc Then lệnh `git checkout <nhánh gốc>` đứng trước `git merge --no-ff --no-commit` và nêu: thoát khác 0 (vd nhánh gốc đang được worktree khác giữ) → lỗi chặn: dừng, báo tên nhánh gốc và nơi đang giữ nó (`git worktree list`), không chạy `git merge`, không `git merge --abort`, không dọn; người dùng merge ở worktree đó hoặc chọn nhánh gốc khác.
- [ ] **AC2.1** — Given `WORKFLOW.md` (hàng bảng Xử lý lỗi về merge local, Rollback) và `error-matrix.md` When đọc Then cùng nêu ca checkout thất bại với cùng hành động.
- [ ] **AC3.1** — Given `docs/specs/workflows/spec.md` Then R7 nêu ca này và bảng lịch sử có thêm hàng cho request này (R7, đổi).
- [ ] **AC4.1** — Given test pin `41-finish-merge-edge-cases` When chạy Then đỏ nếu mục "Merge local theo khoá" thiếu lệnh `git checkout <nhánh gốc>` đứng trước `git merge --no-ff --no-commit`; không ghim văn xuôi.
- [ ] **AC5.1** — Given thay đổi nội dung chiếu Then `core/.manifest.json` 1.28.4 → 1.28.5 và `workflows/.manifest.json` 3.14.15 → 3.14.16, `node cli/lib/versions.mjs --lock` đã chạy sau `npm run build`, và `npm test` exit 0.
## Thiết kế
Chỉ sửa tài liệu và mở rộng một test pin; không đổi code CLI, hook hay script.
1. `finish.md` bước 2: sau kiểm tổ tiên, dòng "chuyển nhánh" thành lệnh `git checkout <nhánh gốc>` kèm điều kiện lỗi chặn; giữ phần `git merge --no-ff --no-commit` và hai gạch đầu dòng sau đó.
2. `WORKFLOW.md` hàng bảng lỗi và Rollback; `error-matrix.md`: thêm ca checkout thất bại, ngắn.
3. Spec R7: thêm ca và nguồn request này; thêm hàng lịch sử ngày 2026-11-05.
4. Pin 41: thêm một `ok` kiểm thứ tự `git checkout <nhánh gốc>` trước `git merge --no-ff --no-commit` trong mục "Merge local theo khoá".
5. Bump core 1.28.5, workflows 3.14.16; `npm run build`, `node cli/lib/versions.mjs --lock`.
## Ảnh hưởng spec
- workflows: đổi R7
## Ngoài phạm vi và anti-goal
- Không tự động merge ở worktree khác (hướng B); không đổi `task-loop.md` (F1), `ask-user.md`, `git-workflow/SKILL.md`, code CLI/hook/script; không đổi hai ca biên đã có.
- Không push, không merge vào nhánh gốc.
## Ràng buộc
Tiếng Việt có dấu, UTF-8 không BOM, LF; test chỉ ghim lệnh và điều kiện dừng.
## Kiểm thử
AC1.1–AC3.1: đọc diff ở review; AC4.1: pin (đỏ trước khi sửa tài liệu, xanh sau); AC5.1: `npm test`.
## Để builder quyết
Câu chữ chính xác của bước 2 và các hàng bảng, miễn đúng AC1.1–AC3.1.
## Rủi ro và câu hỏi mở
Request này xếp chồng lên nhánh `claude/finish-merge-edge-cases-12ddeb` (chưa merge): khi merge, hai request đi cùng một nhánh. Mặc định bố cục worktree vẫn cần người dùng merge tay ở worktree đang giữ nhánh gốc (hướng A).
