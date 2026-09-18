---
name: git-workflow
description: "Skill dùng chung (core) cho mọi thao tác Git an toàn: commit, push, tạo/chuyển branch, chuẩn bị PR, merge, revert, release, hotfix, và gom lịch sử git cho changelog/release notes. Sinh commit message Conventional Commits với header tiếng Anh + body tiếng Việt CÓ DẤU (UTF-8, commit qua git commit -F + kiểm tra encoding), tự sinh branch theo role khi đang ở main/master/develop/dev, stage đúng phạm vi yêu cầu. Dùng skill NÀY mỗi khi người dùng muốn \"commit\", \"push\", \"tạo branch\", \"chuẩn bị PR\", \"merge\", \"revert\", \"release\", \"hotfix\", \"gom changelog\", \"tóm tắt thay đổi từ tag/ngày\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần ở mọi giai đoạn có thao tác git."
order: 2
stageNumber: "02"
title: "Git Workflow — commit, branch, push, PR, merge, release (dùng chung)"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Git Workflow (skill dùng chung)

Điều phối luồng publish git của repository: kiểm tra worktree, chọn/xác nhận branch,
gom thay đổi thành các commit sạch, sinh commit message (header tiếng Anh, body tiếng
Việt CÓ DẤU UTF-8), push an toàn và chuẩn bị PR. Hỗ trợ thêm việc gom lịch sử git
(giữa commit, tag, branch, khoảng thời gian) làm nguồn cho changelog/release notes —
phần VIẾT changelog/release notes cuối cùng giao cho skill `engineering-release-notes`
khi được cài.

Skill này KHÔNG thuộc chuỗi pipeline bắt buộc của plugin nào; gọi khi cần ở bất kỳ
giai đoạn nào có thao tác git (init commit scaffold, implement commit từng task,
release/hotfix...).

## Khi nào dùng

- Người dùng yêu cầu commit, push, stage, tạo/chuyển branch, merge, revert, release, hotfix.
- Cần đặt tên branch hoặc viết conventional commit.
- Cần chuẩn bị PR hoặc checklist release.
- Cần gom lịch sử git cho changelog, release notes, tóm tắt tuần/tháng, hoặc tóm tắt
  thay đổi từ một tag/version/branch/khoảng ngày.

KHÔNG dùng skill này để giải thích code chung chung khi không có ý định git hay gom lịch sử.

## Ranh giới an toàn

- Đọc diff trước khi stage; chỉ stage file thuộc phạm vi người dùng yêu cầu — thay đổi
  không liên quan để nguyên trừ khi người dùng nói rõ.
- Không commit khi chưa đọc diff; không push khi chưa xác nhận branch hiện tại.
- Không tạo/dùng git worktree trừ khi người dùng yêu cầu tường minh.
- KHÔNG thêm bất kỳ dòng nào có prefix `Co-authored-by` / `Co-Authored-By` hay attribution
  của assistant vào commit message, PR body, tag/release notes.
- Không commit công việc đang fail trừ khi người dùng muốn checkpoint tường minh.
- Chạy validator/test liên quan trước khi commit/push khi diff chạm code, config, skill,
  hoặc cấu trúc; nếu bỏ qua kiểm tra nào phải báo rõ.

## Quy tắc ưu tiên branch

Quy tắc đặt branch trong [references/branch-convention.md](references/branch-convention.md)
GHI ĐÈ mọi prefix mặc định của app/harness (ví dụ prefix `codex/`) — chỉ dùng prefix
mặc định đó khi người dùng yêu cầu tường minh. Nếu branch hiện tại là `main`, `master`,
`develop`, `dev`: nạp branch-convention và tạo/chuyển sang branch dạng
`<role>/<scope-or-module>-<short-summary-slug>` TRƯỚC khi commit.

## Luồng commit & push

Dùng khi người dùng yêu cầu: commit, push, commit & push, tạo branch, chuẩn bị PR.

1. Chạy `git status --short` và đọc diff liên quan.
2. Quyết định worktree là MỘT thay đổi logic hay NHIỀU nhóm commit — tách commit khi
   trộn nhiều mục tiêu; giữ code + test + docs phụ trợ đi cùng nếu phục vụ một mục tiêu.
3. Nếu cần branch mới: nạp [references/branch-convention.md](references/branch-convention.md)
   và tạo/chuyển branch theo quy ước (xem Quy tắc ưu tiên branch ở trên).
4. Stage đúng các file của nhóm commit hiện tại.
5. Nếu người dùng đã cho commit message: giữ nguyên ý, chỉ chuẩn hoá lỗi format rõ ràng.
   Nếu chưa có: nạp [references/commit-convention.md](references/commit-convention.md)
   và sinh title + body theo quy ước đó (kèm template/ví dụ khi cần — xem Bản đồ tài liệu).
6. Ghi toàn bộ message vào file tạm UTF-8, chạy
   `scripts/test-commit-message-encoding.ps1 -MessageFile <file>`, kiểm tra pass.
7. **DỪNG cho người dùng duyệt diff:** trình bày `git status --short` (file đã stage) +
   toàn bộ nội dung commit message, chờ người dùng xác nhận TRƯỚC khi chạy lệnh commit.
8. Sau khi xác nhận: commit bằng `git commit -F <file>` (KHÔNG truyền tiếng Việt qua tham
   số shell). Check ở bước 6 fail: sửa xử lý UTF-8, không được bỏ dấu tiếng Việt để lách.
9. Chạy verification liên quan khi khả thi.
10. Sau khi commit: kiểm tra `git log -1 --format=%B` còn đọc được tiếng Việt. Encoding
    hỏng và commit **CHƯA push** → amend ngay để sửa. Đã push rồi → KHÔNG amend (viết đè
    lịch sử đã chia sẻ); tạo commit sửa mới thay thế.
11. Push branch hiện tại (dùng tracking khi cần) sau khi commit thành công và đã biết
    branch đích.
12. Khi người dùng muốn publish hoặc luồng tự nhiên tới PR: dùng Pull Request Notes
    Template trong [references/commit-templates.md](references/commit-templates.md),
    ghi rõ migration, testing, risk, notes.

Báo cáo branch, commit, push, PR, verification và ghi chú bằng tiếng Việt theo
[references/output-template-vi.md](references/output-template-vi.md).

## Luồng changelog / release notes

Dùng khi người dùng yêu cầu: release notes, tóm tắt thay đổi từ tag/version, tổng hợp
tuần/tháng từ commit, changelog thân thiện người dùng.

1. Chốt phạm vi so sánh nhỏ nhất có ích: giữa 2 tag (`v2.4.0..v2.5.0`), giữa 2 ngày,
   N ngày gần nhất, hoặc từ nhóm commit trước.
2. Đọc lịch sử commit của phạm vi đó; giữ lại tag, hash, PR, ticket để truy vết.
3. Giao phần phân loại, lọc theo đối tượng đọc, xử lý breaking change và VIẾT nội dung
   cuối cho skill `engineering-release-notes` khi được cài. Nếu không có: tạo bản tóm tắt
   tối thiểu theo nhóm (New Features / Improvements / Fixes / Breaking Changes / Security),
   lọc bớt churn nội bộ, và NÓI RÕ rằng skill `engineering-release-notes` chưa được cài.
4. Với release notes hướng người dùng: viết lại commit khô khan thành ngôn ngữ kết quả,
   không lặp nguyên văn subject.

## Merge / Revert / Release / Hotfix

Theo checklist trong [references/gitflow-checklist.md](references/gitflow-checklist.md):

- **Merge:** xác định rõ source/target, xử lý conflict có chủ đích, không reset/checkout
  phá huỷ; verify sau khi resolve.
- **Revert:** ưu tiên `git revert`, xác định đúng hash và title commit gốc, nêu tác động
  rollback dự kiến; verify sau revert.
- **Release:** phạm vi hẹp, chốt version bump + changelog + verification cuối, đặt tên
  branch `release/*`, merge-back về đúng các branch đang hoạt động.
- **Hotfix:** sửa production tối thiểu, blast radius nhỏ, có test hồi quy hoặc
  verification tập trung, branch `hotfix/*`, nhớ merge-back.

## Verification (trước khi báo hoàn thành)

- Đã xem `git status --short` và diff liên quan.
- File đã stage khớp đúng phạm vi yêu cầu.
- Validator/test bắt buộc đã pass, hoặc phần bị bỏ qua đã được báo rõ.
- Commit/push/PR chỉ được báo cáo SAU khi lệnh thật sự thành công.
- Body tiếng Việt trong `git log -1` còn nguyên dấu.

## Bản đồ tài liệu

Nạp đúng file khi cần, đừng nạp tất cả:

- [references/commit-convention.md](references/commit-convention.md): quy ước type,
  scope, title, body Changed/Reason, quy tắc sinh tự động (grounding) và an toàn encoding.
- [references/commit-templates.md](references/commit-templates.md): template theo cỡ
  thay đổi (daily, structured, multi-module, long body, refactor, fix, breaking,
  architecture) + PR notes template + chuẩn chất lượng.
- [references/commit-examples.md](references/commit-examples.md): ví dụ commit hoàn
  chỉnh (body tiếng Việt) — nạp khi cần khớp văn phong.
- [references/config-env-rules.md](references/config-env-rules.md): khi nào mục
  Important notes / Breaking impact là BẮT BUỘC và cách khai báo biến môi trường/config.
- [references/branch-convention.md](references/branch-convention.md): role prefix, quy
  tắc đặt tên và sinh branch tự động.
- [references/gitflow-checklist.md](references/gitflow-checklist.md): checklist an toàn
  staging, commit, push, merge, revert, release, hotfix.
- [references/output-template-vi.md](references/output-template-vi.md): template trả lời
  tiếng Việt (trước commit, sau commit/push, changelog).
- [scripts/test-commit-message-encoding.ps1](scripts/test-commit-message-encoding.ps1):
  kiểm tra message tiếng Việt còn UTF-8 hợp lệ trước `git commit -F`.
