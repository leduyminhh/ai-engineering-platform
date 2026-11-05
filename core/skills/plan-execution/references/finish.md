# Kết thúc nhánh

Chạy sau khi review cuối sạch (không còn blocker/major mở **trong phạm vi**, hoặc phần còn lại đã có `Ruling:`/được người dùng chấp nhận). Mục tiêu: đưa
nhánh về trạng thái người dùng có thể quyết định, không tự merge hay push thay họ.

## Thứ tự

1. **Cập nhật docs.** Docs của thay đổi (README, hướng dẫn, `design.md`/`requirement.md` đổi trạng thái) theo đúng
   những gì đã làm; ghi các file docs đã đụng vào `docs_updated` của `workflow_result`.
2. **Cập nhật spec sống.** Làm theo mục `## Ảnh hưởng spec` của design: thêm, sửa hoặc gạch bỏ `R<n>` trong
   `docs/specs/<capability>/spec.md`, thêm một hàng vào bảng lịch sử của spec; capability mới thì thêm vào
   `docs/specs/README.md`. Design ghi "Không ảnh hưởng" thì bỏ qua và ghi lý do. Design ghi "Không ảnh hưởng" mà repo chưa có `docs/specs/<năng-lực>/spec.md` nào thì không tự tạo spec; cảnh báo W23 còn lại ghi vào `remaining_risks` kèm gợi ý chạy skill `engineering-spec-backfill` (plugin `engineering`).
   - Capability chưa có `spec.md`: tạo từ `<thư mục skill artifact-templates>/references/spec.template.md`. Bỏ khối
     `<!-- artifact-template … -->` đầu file, điền Mục đích, Phạm vi, các `R<n>` đúng số design khai và một dòng Lịch sử.
     Project đã chạy `aip init --full` thì `docs/specs/_TEMPLATE.md` có sẵn cùng khung.
   - Chưa có `docs/specs/README.md`: tạo từ `<thư mục skill artifact-templates>/references/specs-readme.template.md`,
     bỏ khối `<!-- artifact-template … -->`, rồi thêm dòng capability vào bảng.
3. **Chạy `check-request.mjs`** trên thư mục request (`node <thư mục skill artifact-templates>/scripts/check-request.mjs
   docs/requests/<ngày>-<slug>/`, kèm `--base <nhánh gốc>` để W7 chỉ tính test thêm trong nhánh và W13 kiểm spec sống). Cảnh báo nào còn lại phải sửa hoặc ghi vào
   `remaining_risks`; không xoá mục `**Files:**` hay test để làm cảnh báo biến mất.
4. **Full suite** của mọi component bị chạm và component phụ thuộc vào chúng, chạy một lần, chọn theo component chứ không
   theo từng test. Nếu thay đổi cần bước phát hành theo quy ước dự án (bump version, cập nhật lock), làm trước lần chạy
   này. Đỏ → dừng: sửa trong phạm vi plan rồi chạy lại, hoặc báo `blocked`. Không đưa menu khi suite còn đỏ.
5. **Gom `Ruling:`.** Đọc ledger (request chia part: ledger `root/` và mọi ledger part), liệt kê mọi dòng `Ruling:` (cùng `minor (deferred)` còn mở) và đưa vào trường `rulings`
   của `workflow_result` (định dạng theo contract đầu ra, `core:principles`). Trình các dòng này cho người dùng cùng
   diff cả nhánh ở G3 (bước 7); dòng nào thuộc loại dừng hỏi của `task-loop.md` thì nêu riêng để người dùng quyết.
   Liệt kê trong thẻ G3 mọi finding **ngoài AC, đổi hành vi hoặc API** (`task-loop.md`, mục "Nhận review"), mỗi mục kèm hệ quả.
   Người dùng chọn "làm" cho mục nào thì ghi mục đó thành follow-up (request hoặc task riêng, làm sau khi nhánh xong); không chạy tiếp trong nhánh và không thêm lane mới.
6. **Chọn nhánh gốc đề xuất** (nhánh sẽ merge vào hoặc làm đích của PR), không hỏi riêng: một ứng viên thì nêu nó trong
   tin nhắn G3; nhiều ứng viên thì không đoán, liệt kê và hỏi chọn ngay trong tin nhắn G3 (bước 7). Chạy
   `git remote`: kết quả rỗng thì repo chưa có remote, lựa chọn push + PR ghi "không khả dụng: repo chưa có remote" và
   không gợi ý lệnh `git push`.
7. **G3.** Theo `ask-user.md`: mở diff cả nhánh ở pane diff trước, rồi hỏi bằng lựa chọn bấm được (`mergeLocal: true`: Duyệt / Sửa thêm / Giữ nguyên; thiếu khoá: 3 lựa chọn bên dưới), không chỉ viết câu hỏi bằng chữ. Một tin nhắn: diff cả nhánh + `rulings` + finding còn lại (`remaining_risks`) + tên nhánh feature và nhánh gốc
   (bước 6), dòng nhắc merge tay (cho lựa chọn 2 hoặc 3, xem "Ghi nhận"), rồi rẽ theo khoá `mergeLocal` của `autonomy.mjs` (đã đọc ở bước Chuẩn bị của skill):
   - `mergeLocal: true`: bản trình G3 nêu tên nhánh gốc và hai commit sẽ tạo trên đó: commit merge `--no-ff` của nhánh
     feature, rồi một commit docs (Trạng thái `merged <hash>`, xoá `plan.md` và `parts/*/plan.md`); và xin một câu duyệt
     rõ (vd "duyệt" hoặc "merge"). Câu trả lời mơ hồ thì hỏi lại đúng một lần; vẫn không rõ thì không merge, áp lựa chọn
     mặc định giữ nguyên và nói như vậy. Duyệt rõ là đồng ý cả hai commit, kể cả khi nhánh gốc là protected (ngoại lệ có
     chủ đích của "dừng trước mỗi commit" trên nhánh protected, chỉ cho đúng hai commit này). Làm theo mục "Merge local
     theo khoá" bên dưới, không hỏi thêm; push/PR hỏi riêng một lần sau khi merge local xong (bước 5 của mục đó).
   - Thiếu khoá (hoặc `mergeLocal: false`): đưa đúng 3 lựa chọn dưới đây ngay trong câu hỏi G3, lựa chọn mặc định là giữ
     nguyên. Lựa chọn 1 gồm hai commit (merge `--no-ff` và commit docs `merged <hash>`): chọn nó là đồng ý cả hai, như đường `mergeLocal: true`. Push + PR là lựa chọn 2 của chính câu hỏi này: chọn nó là đồng ý push nhánh feature đã nêu tên, không hỏi lại.

   Không khoá nào bật push.

| # | Lựa chọn | Việc làm |
|---|---|---|
| 1 | merge local | Làm theo "Merge local theo khoá" (cây sạch, `git merge --no-ff --no-commit`, full suite trên cây đã merge, đỏ hoặc conflict thì `git merge --abort`, xanh mới commit merge, rồi commit docs đặt `Trạng thái: merged <hash>`); chọn lựa chọn này là đồng ý cả hai commit. |
| 2 | push + PR | Push nhánh feature (tên đã nêu ở G3) và mở PR qua `git-workflow`. |
| 3 | giữ nguyên | Commit docs ghi `Trạng thái` (xem "Chi tiết từng lựa chọn"); báo tên nhánh và commit đầu/cuối. |

Không merge nhánh `feature/<slug>` vào nhánh gốc, không push khi người dùng chưa chọn (merge nhánh part vào `feature/<slug>` đã làm ở "Chế độ part" của `task-loop.md`; `mergeLocal: true` đã là chọn merge local); không trả lời rõ → áp lựa chọn mặc định (giữ nguyên) và nói như vậy.

## Merge local theo khoá

Áp cho hai cách kích hoạt: `mergeLocal: true` và người dùng đã duyệt rõ G3, hoặc người dùng chọn lựa chọn 1 (merge local) ở G3 khi thiếu khoá:

1. Trước khi chuyển sang nhánh gốc, cây làm việc phải sạch ở file đã theo dõi (`git status --porcelain --untracked-files=no`
   rỗng). Còn thay đổi → lỗi chặn (`task-loop.md`, mục "Báo cáo"): dừng, báo người dùng, không checkout, không stash.
2. Chuyển sang nhánh gốc đã nêu ở G3, chạy `git merge --no-ff --no-commit <nhánh feature>` (local, không push), rồi chạy
   full suite trên cây đã merge (chưa commit). Conflict hoặc suite đỏ → `git merge --abort` (nhánh gốc giữ nguyên như
   trước merge), dừng, báo là lỗi chặn, không dọn gì. Xanh mới commit merge (`git commit --no-edit`, message merge mặc
   định của git).
3. Đặt `Trạng thái` trong `design.md` thành `merged <hash merge>`, và xoá `plan.md` cùng `parts/*/plan.md` (nếu có):
   `check-request.mjs` W16 đòi xoá plan khi request đã `merged`. Commit thay đổi docs này qua `git-workflow` (commit thứ hai
   đã được G3 đồng ý), rồi chạy lại `check-request.mjs` trên thư mục request; cảnh báo còn lại ghi vào `remaining_risks`.
4. `cleanup: true` → dọn như mục "Dọn theo khoá" bên dưới, rồi đóng phiên con như mục "Đóng phiên con". `cleanup` không phải `true` (thiếu hoặc `false`) → hỏi một câu gộp xoá nhánh feature và đóng phiên con (xem "Đóng phiên con").
5. Chỉ với `mergeLocal: true`: push/PR hỏi riêng một lần sau bước này; không trả lời rõ → không push. Đường tay không hỏi push: push là lựa chọn 2 của chính câu hỏi G3.

## Chi tiết từng lựa chọn

Ghi `Trạng thái` trong `design.md` bằng một commit docs trước khi kết thúc, theo lựa chọn đã chọn:

| Lựa chọn | Trạng thái ghi | Thời điểm |
|---|---|---|
| merge local (theo khoá hoặc tay) | `merged <hash merge>` | như bước 3 của "Merge local theo khoá" (kèm xoá plan) |
| push + PR | `in-progress — PR nhánh <tên nhánh feature>` | commit docs trước khi push |
| giữ nguyên | `in-progress — nhánh <tên nhánh feature>` | commit docs trên nhánh feature |

Với hai trạng thái `in-progress`, dòng nhắc merge tay (xem mục "Ghi nhận") đi kèm tin nhắn G3 và `next_actions`.

- **merge local** (lựa chọn tay, khi thiếu khoá `mergeLocal`; với `mergeLocal` xem "Merge local theo khoá"): nhánh gốc là nhánh protected thì cần người dùng đã chọn tường minh lựa chọn này. Làm bước 1–4 của "Merge local theo khoá"
  (cây sạch, `git merge --no-ff --no-commit`, full suite trên cây đã merge; đỏ hoặc conflict thì `git merge --abort`; xanh mới commit merge rồi commit docs, dọn hoặc hỏi dọn theo `cleanup`).
- **push + PR**: không push lên nhánh protected; chỉ push nhánh feature đã nêu tên ở G3 (chọn lựa chọn này là xác nhận
  tên nhánh). Mô tả PR bằng tiếng Việt, tóm
  tắt thay đổi, kết quả test, các `Ruling:`; không thêm dòng `Co-Authored-By` hay attribution. Push và tạo PR theo
  `git-workflow`.
- **giữ nguyên**: đây là lựa chọn mặc định; chỉ thêm commit docs ghi `Trạng thái` (bảng trên), nhánh và (nếu có) worktree để nguyên.

## Xoá và huỷ

- Xoá nhánh, huỷ công việc hoặc bỏ commit chỉ khi người dùng xác nhận rõ, sau khi bạn liệt kê commit sẽ mất. Xoá nhánh
  feature sau merge local cũng cần xác nhận, không làm mặc định (trừ `cleanup: true`, xem "Dọn theo khoá").
- Dọn worktree chỉ với worktree đã merge và sạch, thuộc `.claude/worktrees/`; trên Windows không `rm -rf` thư mục có
  junction, dọn bằng `git worktree remove` hoặc `fs.rmSync` của Node.
- Không amend, squash hay force-push khi người dùng chưa xác nhận.

## Dọn theo khoá

Chỉ khi `cleanup: true` và merge local đã xanh (full suite trên cây đã merge, bước 2 của "Merge local theo khoá"): tự gỡ
worktree sạch thuộc `.claude/worktrees/` (theo `git-worktree`) và xoá nhánh mà `git merge-base --is-ancestor <nhánh> <nhánh gốc>`
báo là tổ tiên của nhánh gốc. Phạm vi: nhánh feature vừa merge và các nhánh part `worktree-<slug>-p<nn>` của request. Xoá bằng
`git branch -d <nhánh>` (git từ chối khi chưa merge; không dùng `-D`). Nhánh chưa merge và worktree còn thay đổi (kể cả
file chưa theo dõi) thì giữ nguyên. Báo một dòng đã gỡ/xoá gì. Không dọn khi suite đỏ.

## Đóng phiên con

Chỉ khi merge local đã xanh (cả merge theo khoá lẫn lựa chọn tay). `cleanup: true`: làm sau bước "Dọn theo khoá". Session gốc
archive các phiên con đã mở cho request này (phiên part, phiên thực thi), chỉ phiên đã idle:

- Danh sách phiên con lấy từ công cụ quản lý phiên của môi trường (liệt kê phiên liên kết với session gốc, archive); phiên
  idle là phiên môi trường báo không đang chạy và không chờ người dùng. Không có công cụ, hoặc không xác định được danh
  sách hay trạng thái: không archive gì, ghi một dòng trong báo cáo.
- Phiên còn chạy hoặc đang chờ người dùng: giữ và nêu tên từng phiên.
- `cleanup: true`: archive luôn, không hỏi thêm. `cleanup` không phải `true` (thiếu hoặc `false`, mặc định của `autonomy.mjs`):
  hỏi một câu gộp xoá nhánh feature và đóng phiên con; đây là câu hỏi duy nhất, cả hai đường merge local (theo khoá và lựa chọn tay) dùng chung.
- Archive đảo ngược được; không xoá phiên vì xoá không đảo ngược.

## Ghi nhận

Khi người dùng đã chọn (hoặc duyệt G3 với `mergeLocal: true`) và việc của lựa chọn đó xong (kể cả giữ nguyên), ghi
`node <thư mục skill plan-execution>/scripts/ledger.mjs <plan.md gốc> "Plan: complete"` rồi trả `workflow_result` có `rulings` đã gom. Truyền đường dẫn `plan.md` gốc kể cả khi file đã bị xoá ở bước 3 của "Merge local theo khoá" (script tính workspace từ đường dẫn, không cần file còn), không truyền đường dẫn `progress.md`. `Plan: complete` chỉ ghi ở ledger `root/` (plan gốc), không bao giờ ở ledger part. Dòng
`Plan: complete` làm hook `session-start` ngừng nạp ledger.

Với push + PR hoặc giữ nguyên, tin nhắn G3 và `workflow_result` (`next_actions`) nhắc: khi nhánh được merge tay hoặc qua PR, đặt `Trạng thái: merged <hash>` và xoá `plan.md`/`parts/*/plan.md` (W16 chỉ đòi xoá plan khi `merged`/`abandoned`).
