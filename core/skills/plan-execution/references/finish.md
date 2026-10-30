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
   menu bên dưới; dòng nào thuộc loại dừng hỏi của `task-loop.md` thì nêu riêng để người dùng quyết.
6. **Xác nhận nhánh gốc** (nhánh sẽ merge vào hoặc làm đích của PR). Không đoán: hỏi khi có nhiều ứng viên. Chạy
   `git remote`: kết quả rỗng thì repo chưa có remote, lựa chọn push + PR ghi "không khả dụng: repo chưa có remote" và
   không gợi ý lệnh `git push`.
7. **Đưa đúng 3 lựa chọn**, lựa chọn mặc định là giữ nguyên:

| # | Lựa chọn | Việc làm |
|---|---|---|
| 1 | merge local | Chuyển sang nhánh gốc, merge nhánh feature (`--no-ff`). |
| 2 | push + PR | Xác nhận tên nhánh rồi push và mở PR qua `git-workflow`. |
| 3 | giữ nguyên | Không làm gì thêm; báo tên nhánh và commit đầu/cuối. |

Không merge nhánh `feature/<slug>` vào nhánh gốc, không push khi người dùng chưa chọn (merge nhánh part vào `feature/<slug>` đã làm ở "Chế độ part" của `task-loop.md`); không trả lời rõ → áp lựa chọn mặc định (giữ nguyên) và nói như vậy.

## Chi tiết từng lựa chọn

- **merge local**: nhánh gốc là nhánh protected thì cần người dùng đã chọn tường minh lựa chọn này. Sau khi merge xong,
  chạy lại full suite trên kết quả merge; đỏ → dừng, không xoá gì, báo người dùng. Xanh → hỏi có xoá nhánh feature
  không (xem bên dưới).
- **push + PR**: không push lên nhánh protected; chỉ push nhánh feature đã xác nhận tên. Mô tả PR bằng tiếng Việt, tóm
  tắt thay đổi, kết quả test, các `Ruling:`; không thêm dòng `Co-Authored-By` hay attribution. Push và tạo PR theo
  `git-workflow`.
- **giữ nguyên**: đây là lựa chọn mặc định, nhánh và (nếu có) worktree để nguyên.

## Xoá và huỷ

- Xoá nhánh, huỷ công việc hoặc bỏ commit chỉ khi người dùng xác nhận rõ, sau khi bạn liệt kê commit sẽ mất. Xoá nhánh
  feature sau merge local cũng cần xác nhận, không làm mặc định.
- Dọn worktree chỉ với worktree đã merge và sạch, thuộc `.claude/worktrees/`; trên Windows không `rm -rf` thư mục có
  junction, dọn bằng `git worktree remove` hoặc `fs.rmSync` của Node.
- Không amend, squash hay force-push khi người dùng chưa xác nhận.

## Ghi nhận

Khi người dùng đã chọn và việc của lựa chọn đó xong (kể cả giữ nguyên), ghi
`node <thư mục skill plan-execution>/scripts/ledger.mjs <plan.md gốc> "Plan: complete"` rồi trả `workflow_result` có `rulings` đã gom. `Plan: complete` chỉ ghi ở ledger `root/` (plan gốc), không bao giờ ở ledger part. Dòng
`Plan: complete` làm hook `session-start` ngừng nạp ledger.
