# Kết thúc nhánh

Chạy sau khi review cuối sạch (0 blocker, hoặc phần còn lại đã có `Ruling:`/được người dùng chấp nhận). Mục tiêu: đưa
nhánh về trạng thái người dùng có thể quyết định, không tự merge hay push thay họ.

## Thứ tự

1. **Cập nhật docs.** Docs của thay đổi (README, hướng dẫn, `design.md`/`requirement.md` đổi trạng thái) theo đúng
   những gì đã làm; ghi các file docs đã đụng vào `docs_updated` của `workflow_result`.
2. **Cập nhật spec sống.** Làm theo mục `## Ảnh hưởng spec` của design: thêm, sửa hoặc gạch bỏ `R<n>` trong
   `docs/specs/<capability>/spec.md`, thêm một hàng vào bảng lịch sử của spec; capability mới thì thêm vào
   `docs/specs/README.md`. Design ghi "Không ảnh hưởng" thì bỏ qua và ghi lý do.
3. **Chạy `check-request.mjs`** trên thư mục request (`node <thư mục skill artifact-templates>/scripts/check-request.mjs
   docs/requests/<ngày>-<slug>/`, thêm `--base <nhánh gốc>` khi có spec sống). Cảnh báo nào còn lại phải sửa hoặc ghi vào
   `remaining_risks`; không xoá mục `**Files:**` hay test để làm cảnh báo biến mất.
4. **Full suite** của mọi component bị chạm và component phụ thuộc vào chúng, chạy một lần, chọn theo component chứ không
   theo từng test. Nếu thay đổi cần bước phát hành theo quy ước dự án (bump version, cập nhật lock), làm trước lần chạy
   này. Đỏ → dừng: sửa trong phạm vi plan rồi chạy lại, hoặc báo `blocked`. Không đưa menu khi suite còn đỏ.
5. **Gom `Ruling:`.** Đọc ledger (request chia part: ledger `root/` và mọi ledger part), liệt kê mọi dòng `Ruling:` (cùng `minor (deferred)` còn mở) và đưa vào trường `rulings`
   của `workflow_result` (định dạng theo contract đầu ra, `core:principles`). Trình các dòng này cho người dùng cùng
   diff cả nhánh ở G3 (bước 7); dòng nào thuộc loại dừng hỏi của `task-loop.md` thì nêu riêng để người dùng quyết.
6. **Xác nhận nhánh gốc** (nhánh sẽ merge vào hoặc làm đích của PR). Không đoán: hỏi khi có nhiều ứng viên. Chạy
   `git remote`: kết quả rỗng thì repo chưa có remote, lựa chọn push + PR ghi "không khả dụng: repo chưa có remote" và
   không gợi ý lệnh `git push`.
7. **G3.** Trình diff cả nhánh + `rulings` + finding còn lại (`remaining_risks`) cho người dùng duyệt, rồi rẽ theo khoá
   `mergeLocal` của `autonomy.mjs` (đã đọc ở bước Chuẩn bị của skill). `mergeLocal: true`: bản trình G3 nêu rõ sẽ merge
   `--no-ff` vào `<nhánh gốc>`, rồi tạo một commit docs trên nhánh gốc (Trạng thái `merged <hash>`, xoá `plan.md` và
   `parts/*/plan.md`); duyệt G3 là đồng ý cả hai, kể cả khi nhánh gốc là protected (ngoại lệ có chủ đích của "dừng trước
   mỗi commit" trên nhánh protected, chỉ cho đúng hai commit này). Làm theo mục "Merge local theo khoá" bên dưới, không hỏi
   thêm. Thiếu khoá: đưa đúng 3 lựa chọn dưới đây ngay trong câu hỏi G3, lựa chọn mặc định là giữ nguyên; push + PR là
   lựa chọn 2, không hỏi lại lần nữa. Không khoá nào bật push: với `mergeLocal: true`, push/PR hỏi riêng ở bước 4 của mục
   "Merge local theo khoá".

| # | Lựa chọn | Việc làm |
|---|---|---|
| 1 | merge local | Chuyển sang nhánh gốc, merge nhánh feature (`--no-ff`). |
| 2 | push + PR | Xác nhận tên nhánh rồi push và mở PR qua `git-workflow`. |
| 3 | giữ nguyên | Không làm gì thêm; báo tên nhánh và commit đầu/cuối. |

Không merge nhánh `feature/<slug>` vào nhánh gốc, không push khi người dùng chưa chọn (merge nhánh part vào `feature/<slug>` đã làm ở "Chế độ part" của `task-loop.md`; `mergeLocal: true` đã là chọn merge local); không trả lời rõ → áp lựa chọn mặc định (giữ nguyên) và nói như vậy.

## Merge local theo khoá

Chỉ khi `mergeLocal: true` và người dùng đã duyệt G3:

1. Merge `--no-ff` nhánh feature vào nhánh gốc đã xác nhận ở bước 6 (local, không push), rồi chạy full suite trên kết quả
   merge. Đỏ → dừng, không dọn gì, báo người dùng; merge giữ nguyên trên nhánh gốc, người dùng hoàn tác bằng thao tác git
   của họ (không tự reset).
2. Xanh → đặt `Trạng thái` trong `design.md` thành `merged <hash merge>`, và xoá `plan.md` cùng `parts/*/plan.md` (nếu có):
   `check-request.mjs` W16 đòi xoá plan khi request đã `merged`. Commit thay đổi docs này qua `git-workflow` (commit thứ hai
   đã được G3 đồng ý), rồi chạy lại `check-request.mjs` trên thư mục request; cảnh báo còn lại ghi vào `remaining_risks`.
3. `cleanup: true` → dọn như mục "Dọn theo khoá" bên dưới. Thiếu khoá `cleanup` → hỏi như mục "Xoá và huỷ".
4. Push/PR hỏi riêng sau bước này.

## Chi tiết từng lựa chọn

- **merge local** (lựa chọn tay, khi thiếu khoá `mergeLocal`; với `mergeLocal` xem "Merge local theo khoá"): nhánh gốc là nhánh protected thì cần người dùng đã chọn tường minh lựa chọn này. Sau khi merge xong,
  chạy lại full suite trên kết quả merge; đỏ → dừng, không xoá gì, báo người dùng. Xanh → hỏi có xoá nhánh feature
  không (xem bên dưới).
- **push + PR**: không push lên nhánh protected; chỉ push nhánh feature đã xác nhận tên. Mô tả PR bằng tiếng Việt, tóm
  tắt thay đổi, kết quả test, các `Ruling:`; không thêm dòng `Co-Authored-By` hay attribution. Push và tạo PR theo
  `git-workflow`.
- **giữ nguyên**: đây là lựa chọn mặc định, nhánh và (nếu có) worktree để nguyên.

## Xoá và huỷ

- Xoá nhánh, huỷ công việc hoặc bỏ commit chỉ khi người dùng xác nhận rõ, sau khi bạn liệt kê commit sẽ mất. Xoá nhánh
  feature sau merge local cũng cần xác nhận, không làm mặc định (trừ `cleanup: true`, xem "Dọn theo khoá").
- Dọn worktree chỉ với worktree đã merge và sạch, thuộc `.claude/worktrees/`; trên Windows không `rm -rf` thư mục có
  junction, dọn bằng `git worktree remove` hoặc `fs.rmSync` của Node.
- Không amend, squash hay force-push khi người dùng chưa xác nhận.

## Dọn theo khoá

Chỉ khi `cleanup: true` và merge local đã xanh (full suite trên kết quả merge, bước 1 của "Merge local theo khoá"): tự gỡ
worktree sạch thuộc `.claude/worktrees/` (theo `git-worktree`) và xoá nhánh mà `git merge-base --is-ancestor <nhánh> <nhánh gốc>`
báo là tổ tiên của nhánh gốc. Phạm vi: nhánh feature vừa merge và các nhánh part `worktree-<slug>-p<nn>` của request. Xoá bằng
`git branch -d <nhánh>` (git từ chối khi chưa merge; không dùng `-D`). Nhánh chưa merge và worktree còn thay đổi (kể cả
file chưa theo dõi) thì giữ nguyên. Báo một dòng đã gỡ/xoá gì. Không dọn khi suite đỏ.

## Ghi nhận

Khi người dùng đã chọn (hoặc duyệt G3 với `mergeLocal: true`) và việc của lựa chọn đó xong (kể cả giữ nguyên), ghi
`node <thư mục skill plan-execution>/scripts/ledger.mjs <plan.md gốc> "Plan: complete"` rồi trả `workflow_result` có `rulings` đã gom. `Plan: complete` chỉ ghi ở ledger `root/` (plan gốc), không bao giờ ở ledger part. Dòng
`Plan: complete` làm hook `session-start` ngừng nạp ledger.
