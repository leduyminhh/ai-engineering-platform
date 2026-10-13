# Checklist an toàn gitflow

## Trước khi stage

- Xem `git status --short` và diff liên quan.
- Quyết định worktree là một commit hay nhiều nhóm commit logic.
- Để nguyên thay đổi không liên quan / vô tình dính vào.

## Trước khi commit

- Xác nhận commit type, scope và working branch.
- Staged set thuộc đúng MỘT mục tiêu thay đổi logic; file rác/ngoài phạm vi không được dính.
- Sinh title/body theo `commit-convention.md`; scope không mơ hồ (misc/update),
  title mô tả KẾT QUẢ chứ không phải quá trình.
- Chạy verification liên quan khi khả thi.
- Không commit công việc đang fail trừ khi người dùng muốn checkpoint tường minh.

## Sau khi commit

- Kiểm tra `git log -1 --format=%B` còn nguyên tiếng Việt có dấu.
- Chỉ push branch hiện tại; dùng tracking khi cần.
- Tạo PR sau push khi người dùng muốn publish hoặc luồng tự nhiên tới bước PR.
- Báo cáo cuối gồm: remote, branch, link PR, verification, ghi chú.

## Merge

- Xác định rõ source branch, target branch, file conflict.
- Resolve conflict có chủ đích, nói rõ hướng resolve; không reset/checkout phá huỷ.
- Verify sau khi resolve; nêu rủi ro còn lại.

## Revert

- Ưu tiên `git revert`; xác định ĐÚNG commit hash và title gốc.
- Nêu tác động rollback dự kiến; title revert tường minh.
- Verify sau revert.

## Release / Hotfix

- Tạo `release/*` / `hotfix/*`, tính version, tag, merge-back: theo skill `git-release`.
- Commit bên trong các branch đó vẫn theo checklist commit ở trên.
