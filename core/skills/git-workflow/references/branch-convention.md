# Quy ước branch

## Role prefix

- `feature/*`: tính năng mới hoặc workflow hướng người dùng.
- `bugfix/*`: sửa bug thông thường.
- `chore/*`: bảo trì, dọn dẹp, sắp xếp repo.
- `refactor/*`: cải thiện cấu trúc/độ đọc, không đổi hành vi.
- `release/*`: chuẩn bị release.
- `hotfix/*`: sửa production khẩn cấp.

Đặt tên: kebab-case chữ thường sau prefix, ngắn và có nghĩa, role khớp với loại thay
đổi chiếm ưu thế.

## Sinh branch tự động

Khi commit, sinh branch TRƯỚC commit trừ khi branch hiện tại đã là working branch
phù hợp (không phải main). Định dạng:

```text
<role>/<scope-or-module>-<short-summary-slug>
```

Ánh xạ commit type → role:

- `feat` → `feature`
- `fix` → `bugfix`
- `refactor`, `perf` → `refactor`
- `docs`, `style`, `test`, `chore`, `build`, `ci`, `revert` → `chore`
- chuẩn bị release → `release`
- fix production khẩn cấp được mô tả rõ là hotfix → `hotfix`
- `merge` → giữ branch merge hiện tại trừ khi người dùng yêu cầu tạo mới

Quy tắc slug:

- Lấy scope/module của commit trước, thêm 2–5 từ từ summary.
- Slug dùng TIẾNG ANH (dịch/tóm tắt ý tiếng Việt thành tiếng Anh gọn); chỉ dùng từ
  tiếng Việt khi người dùng yêu cầu tường minh.
- kebab-case chữ thường; bỏ dấu câu và ký tự shell không an toàn.
- Giữ ngắn: ưu tiên dưới 50 ký tự sau prefix.

Quy tắc theo branch hiện tại:

- Đang ở `main`, `master`, `develop`, `dev` → tạo/chuyển sang branch sinh ra trước khi commit.
- Branch hiện tại đã khớp role + scope/module → giữ nguyên.
- Branch hiện tại không liên quan → báo người dùng phương án chuyển branch trước khi commit.
- Quy ước này GHI ĐÈ prefix mặc định của app/harness (vd `codex/`) — chỉ dùng prefix đó
  khi người dùng yêu cầu tường minh.

## Ví dụ

```text
feature/git-workflow-design-skill
bugfix/audit-timezone
chore/link-installer
refactor/validator-config
release/2026-04
hotfix/audit-retention
```

Sinh từ commit:

```text
feat(workflow): add linked skill installer   -> feature/workflow-linked-skill-installer
fix(audit): use Ho Chi Minh date             -> bugfix/audit-ho-chi-minh-date
docs(readme): document audited runner        -> chore/readme-audited-runner
refactor(api): simplify user payload mapping -> refactor/api-user-payload-mapping
```

## Quy tắc worktree

Hỏi người dùng một lần trước khi tạo worktree. Chưa được đồng ý thì làm việc trên checkout và
branch hiện tại; được đồng ý thì đặt theo `.claude/worktrees/<slug>-p<nn>/` (chỉ song song giữa part).
