---
name: git-release
description: "Chạy release/hotfix theo Gitflow: tính semver từ Conventional Commits, tạo release/hotfix branch, bump version Java/Python/Node, merge qua staging → main, tag, merge-back; push chờ xác nhận. Dùng khi người dùng muốn \"release start\", \"release finish\", \"hotfix start\", \"tạo tag version\", \"merge release vào main\". Không dùng khi chỉ commit/merge không ra version → git-workflow; cần checklist deploy/rollback → ops-deploy-release."
order: 3
title: "Git Release — release/hotfix theo Gitflow, semver, tag, merge-back (dùng chung)"
argument-hint: "[release|hotfix] [start|finish] [--no-bump]"
runsIn: execute
invoke: per-request
---

# Git Release (skill dùng chung)

Chạy một vòng release hoặc hotfix theo Gitflow trên máy local: tính version từ Conventional Commits, tạo
`release/*` / `hotfix/*`, bump file version, cập nhật CHANGELOG, đưa branch qua chuỗi promotion (vd `staging` →
`main`), đặt annotated tag ở chặng cuối, merge-back, rồi đề xuất lệnh push và chờ xác nhận. Commit, message và quy
ước branch dùng lại skill `git-workflow`. Skill không deploy, không viết code sửa lỗi.

Bốn lệnh: `release start`, `release finish`, `hotfix start`, `hotfix finish`. `finish` chạy lại được nhiều lần:
mỗi lần làm đúng một chặng kế tiếp của chuỗi promotion.

## Ranh giới an toàn

- KHÔNG: `push --force`, `reset --hard`, viết lại lịch sử, sửa/ghi đè tag đã có (tag tồn tại → dừng), commit trực
  tiếp lên branch trong chuỗi promotion (chỉ merge), tự sửa code trên `release/*` / `hotfix/*`, đọc file secret
  (`.env`, `*.jks`, `*.keystore`, file properties chứa secret) khi dò version.
- Luôn ⏸ chờ người dùng xác nhận: bảng branch ở `start`, version, diff trước mỗi commit, mọi lệnh `git push`, tạo
  GitHub Release, xoá branch local/remote, ghi/sửa `project-knowledge/release-policy.md`, cách resolve conflict
  dự đoán được.
- Conflict ngoài danh sách trong [references/conflict-rules.md](references/conflict-rules.md) → dừng, liệt kê
  file, không tự resolve.
- Hoàn tác: chưa push thì chỉ ĐỀ XUẤT lệnh đưa branch về hash đã ghi ở preflight và xoá tag local; đã push thì chỉ
  đề xuất `git revert`, không động vào lịch sử remote.
- KHÔNG thêm dòng `Co-Authored-By` hay attribution của assistant vào commit, tag message, release notes.

## Quy trình — preflight chung

Chạy đầu mọi lệnh; sai điều kiện nào → dừng, báo thiếu gì.

1. Worktree sạch (`git status --porcelain` rỗng); `git fetch origin --tags`.
2. Đọc `project-knowledge/release-policy.md` nếu có (mẫu: [references/release-policy.md](references/release-policy.md)).
3. Mọi branch vai trò (integration, các chặng promotion) khớp `origin` (`git rev-parse <b>` = `git rev-parse
   origin/<b>`); lệch → dừng, đề xuất người dùng pull/đồng bộ.
4. `start`: không có `release/*` (release) hoặc `hotfix/*` (hotfix) đang mở. `finish`: có đúng một branch tương ứng.
5. Có ít nhất một tag đúng `tag format`; chưa có → hỏi version khởi điểm.
6. Chỉ ở `release start`: hỏi lệnh build/test của project, chạy (hoặc nhờ người dùng chạy) và ghi kết quả; đỏ →
   dừng, đề xuất `workflow-bugfix`. Khuyến nghị chạy skill `engineering-quality-gate` trước khi tiếp tục (không bắt
   buộc, không gọi tự động).
7. Ghi hash hiện tại của mọi branch vai trò vào báo cáo (dùng cho đề xuất hoàn tác).

## Quy trình — chọn branch

Vai trò: **integration** (`develop`, có thể không có) và **promotion chain** (danh sách có thứ tự, chặng cuối là
production, nơi đặt tag). Thứ tự nguồn: tham số người dùng → `release-policy.md` → dò trên `origin` (integration:
`develop`, `dev`, `development`; chain: `staging` nếu có, rồi `main` hoặc `master`). Một vai trò dò ra 0 hoặc ≥ 2
ứng viên → hỏi, không đoán.

⏸ Ở `release start` và `hotfix start` LUÔN trình bảng `vai trò · giá trị · nguồn · tồn tại trên origin` (gồm cả
branch sẽ tạo) và chờ xác nhận, kể cả khi mọi giá trị lấy từ policy. Giá trị không có trên `origin` đánh dấu ✗ và
không xác nhận được trừ khi người dùng nói rõ branch đó chỉ có ở local. Giá trị khác policy → hỏi có cập nhật
policy không. `finish` không hỏi lại; policy đổi so với lúc `start` → cảnh báo và dừng.

## Quy trình — release start

1. Preflight + chọn branch ⏸.
2. `node <thư mục skill>/scripts/next-version.mjs --base <integration, không có thì chặng cuối> --tag-prefix
   <tiền tố> --zero-breaking <policy> --json`. Exit `2` → dừng, hỏi người dùng có thật sự release không. Trình bảng
   commit theo nhóm + version đề xuất + warnings. ⏸ xác nhận version (người dùng có thể nhập số khác: phải đúng
   semver, lớn hơn `current`; lệch mức bump thì cảnh báo).
3. `git switch -c release/X.Y.Z <integration hoặc chặng cuối>`.
4. Bump file version theo [references/version-files.md](references/version-files.md) (bỏ qua khi `--no-bump`,
   `version files: none`, hoặc project lấy version từ git tag). Version hiện tại có hậu tố dev (`-SNAPSHOT`,
   `.devN`) → bỏ hậu tố. Cập nhật CHANGELOG: có skill `engineering-release-notes` thì dùng skill đó, không thì thêm
   mục `## [X.Y.Z] - <ngày>` liệt kê commit theo nhóm `groups`.
5. ⏸ Trình `git status --short` + diff → commit `chore(release): vX.Y.Z` theo quy trình commit của
   `git-workflow` (message qua `check-commit-message.mjs`, `git commit -F`). Không có file nào đổi → bỏ commit.
6. ⏸ `git push -u origin release/X.Y.Z`. Báo: team test trên branch này, fix lỗi bằng commit lên `release/X.Y.Z`
   qua `git-workflow`, xong thì chạy `release finish`.

## Quy trình — release finish

Chi tiết từng chặng và ví dụ: [references/release-flow.md](references/release-flow.md).

1. Preflight. Xác định chặng kế tiếp: chặng đầu tiên trong chain mà `git merge-base --is-ancestor
   release/X.Y.Z <chặng>` sai. Chặng trước chỉ tính là xong khi chứa đúng HEAD hiện tại của `release/X.Y.Z`; có
   commit mới (fix, merge-back hotfix) → làm lại từ chặng đầu.
2. Có commit mới sau commit release → cập nhật mục `[X.Y.Z]` của CHANGELOG, ⏸ diff, commit
   `docs(changelog): update vX.Y.Z`.
3. **Chặng chưa phải cuối:** `git switch <chặng>` → `git merge --no-ff release/X.Y.Z` → ⏸ `git push origin <chặng>
   release/X.Y.Z` → dừng để người dùng deploy/test, báo chạy lại `release finish` khi đạt.
4. **Chặng cuối:** `git switch <production>` → `git merge --no-ff release/X.Y.Z` → `git tag -a vX.Y.Z -m "Release
   X.Y.Z"` trên merge commit → có integration branch thì `git switch <integration>` → `git merge --no-ff
   release/X.Y.Z` → project dùng hậu tố dev thì bump integration lên `nextDev` + hậu tố, ⏸ diff, commit
   `chore(release): start <nextDev>-SNAPSHOT` (hoặc `.dev0`).
5. ⏸ `git push --atomic origin <production> <integration nếu có> vX.Y.Z`.
6. ⏸ GitHub Release, chỉ khi `origin` trỏ GitHub và `gh auth status` thành công: trích mục `[X.Y.Z]` của
   CHANGELOG ra file tạm, `gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <file>`. Thiếu điều kiện → ghi
   "bỏ qua tạo GitHub Release" vào báo cáo, không coi là lỗi.
7. ⏸ Xoá branch theo policy (`ask` mặc định): `git branch -d release/X.Y.Z` và `git push origin --delete release/X.Y.Z`.
8. Báo cáo theo [references/output-template-vi.md](references/output-template-vi.md).

## Quy trình — hotfix start / hotfix finish

- `hotfix start`: preflight + chọn branch ⏸ (base = chặng cuối tại tag gần nhất; merge-back = `release/*` đang mở,
  không có thì integration, không có nữa thì bỏ) → `next-version.mjs --base <chặng cuối> --hotfix --json` (luôn
  patch+1) ⏸ → `git switch -c hotfix/X.Y.Z vA.B.C` (tag gần nhất) → dừng. Người dùng sửa lỗi qua `git-workflow` /
  `workflow-bugfix` / `backend-fix` / `frontend-fix`, xong chạy `hotfix finish`.
- `hotfix finish`: giống `release finish` với `hotfix/X.Y.Z` thay cho `release/X.Y.Z`, cộng: bước bump + CHANGELOG
  của `release start` (bước 4–5) chạy ở lần `finish` đầu tiên; merge-back theo đích đã xác nhận ở `start`; KHÔNG
  bump hậu tố dev cho integration. Người dùng có thể yêu cầu bỏ chặng khi khẩn cấp; báo cáo ghi rõ chặng đã bỏ.
- Merge-back vào `release/*` hay gặp conflict ở dòng version và đầu CHANGELOG → xử lý theo
  [references/conflict-rules.md](references/conflict-rules.md).

## Verification (trước khi báo hoàn thành)

- `git log --oneline --graph -15 --all` khớp luồng đã chạy; tag trỏ đúng merge commit của chặng cuối
  (`git rev-list -n 1 vX.Y.Z`).
- Mọi lệnh push đã chạy đều có xác nhận của người dùng; phần chưa push ghi "còn chờ".
- Body tiếng Việt của commit do skill tạo còn nguyên dấu (`git log -1 --format=%B`).

## Bản đồ tài liệu

- [references/release-flow.md](references/release-flow.md): Gitflow, chuỗi promotion, merge-back, hotfix chen
  ngang release đang mở, ví dụ lịch sử git.
- [references/version-files.md](references/version-files.md): dò và bump file version Java / Python / Node, hậu tố
  dev, version lấy từ git tag.
- [references/release-policy.md](references/release-policy.md): mẫu `project-knowledge/release-policy.md` và ý
  nghĩa từng khoá.
- [references/conflict-rules.md](references/conflict-rules.md): conflict được phép đề xuất resolve.
- [references/output-template-vi.md](references/output-template-vi.md): mẫu báo cáo cuối.
- [scripts/next-version.mjs](scripts/next-version.mjs): tính version kế tiếp, exit `0` / `2` (không có gì để
  release) / `1` (lỗi).
