# Thiết kế: vá 5 lỗ hổng chế độ part từ lần chạy thử aip-parts-trial
- Ngày: 2026-10-30
- Trạng thái: merged — merge `fix/part-mode-trial-gaps` vào master ngày 2026-10-30; regression test đỏ trước, xanh sau sửa
- Requirement: không có
## Vấn đề và lý do
Lần chạy thử thật chế độ part (repo `E:\Mine\AI\aip-parts-trial`, 2 part cùng nhóm Song song, mỗi part một phiên và worktree) chạy xong nhưng lộ 5 lỗ hổng:
1. Review cuối chỉ nhận `Ruling:`/`minor (deferred)` "trong ledger" (ledger `root/`); dòng của ledger part bị sót (ledger part 02 có 1 `Ruling:` và 2 `minor (deferred)`, ledger root không có).
2. Plan part không mang Review Focus/Global Constraints của plan gốc; reviewer part phải tự tìm plan gốc.
3. Dọn worktree khi phiên part còn mở: `git worktree remove` gỡ đăng ký rồi báo `Permission denied`, để lại thư mục rỗng (Windows khoá cwd của phiên).
4. `aip check -g` báo core "đã cài 1.19.5" trong khi scope user là 1.22.3: `claude plugin list --json` trả cả bản ghi `scope: project` của project khác (`projectPath`), và `parseClaudePluginJson` bỏ mất thông tin đó.
5. Hook `session-start` trong worktree part chọn ledger dở có mtime mới nhất của mọi part, nên có thể nạp ledger part anh em hoặc root thay vì ledger của chính part.
## Quyết định đã chốt
- (4) `parseClaudePluginJson(text, mkt, root)` bỏ bản ghi có `projectPath` khác `root` của scope đang kiểm; `check()` (doctor) và cảnh báo trùng skills-mode truyền `root`. Parser text (CLI cũ) không có `projectPath`, giữ nguyên.
- (5) Khi gốc worktree khác gốc repo chính và tên thư mục worktree khớp `<slug>-p<nn>`, hook chỉ xét ledger `.aip/runs/<request>/<nn>-*/` của request có tên `<slug>` hoặc `<yyyy-mm-dd>-<slug>`; không có ledger nào khớp thì giữ cách chọn cũ.
- (1)(2)(3) sửa câu chữ: `prompts/final-review.md` và bước 11 của "Chế độ part" gom từ ledger `root/` và mọi ledger part; `plan-structure.md` chép Global Constraints/Review Focus liên quan vào plan part; bước 10 và mục dọn của `git-worktree` đòi đóng phiên trong worktree trước.
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given request chia part có `Ruling:`/`minor (deferred)` ở ledger part When session gốc chuẩn bị review cuối Then `final-review.md` và bước 11 của "Chế độ part" bảo gom từ ledger `root/` và mọi ledger part
- [ ] **AC2.1** — Given plan gốc có Review Focus/Global Constraints chạm tới một part When viết plan part theo `plan-structure.md` Then các mục đó được chép vào plan part
- [ ] **AC3.1** — Given phiên part còn mở trong worktree When session gốc tới bước dọn worktree Then bước 10 và `git-worktree` đòi đóng phiên trước
- [ ] **AC4.1** — Given `claude plugin list --json` có bản ghi `projectPath` của project khác lệch version When chạy `aip check -g` Then bản ghi đó không bị báo lệch
- [ ] **AC5.1** — Given phiên ở worktree `<slug>-p<nn>` và ledger part khác hoặc root mới hơn When hook `session-start` chạy Then nạp ledger của chính part `<nn>`
## Thiết kế
Xem Quyết định đã chốt; `session-start.mjs` thêm `gitInfo` (cache kết quả `gitRoots` cho cả `aipRoots` và `ownPart`) và `ownPart`.
## Ảnh hưởng spec
- hooks-gates: đổi R11
- install-lifecycle: thêm R10
- workflows: đổi R14
## Ngoài phạm vi và anti-goal
- Không đổi cách chọn ledger ở gốc repo chính (part chạy tuần tự trong checkout chính vẫn theo mtime mới nhất).
- Không thêm test pin câu chữ cho (1)(2)(3): tài liệu văn xuôi, quy tắc Testing không pin.
- Không xử lý các vướng khác do phiên part báo (mẫu dòng complete TOOLING, reviewer TOOLING không có skill, `status: done`, `ledger.mjs` chỉ kiểm dòng `inline`).
## Ràng buộc
- Hook zero-dependency, fail-open; bump version `core` và `engineering`, chạy `node cli/lib/versions.mjs --lock`.
## Không đổi
- Phiên ở gốc repo chính vẫn nạp ledger dở có mtime mới nhất; `Part: complete`/`Plan: complete` vẫn đóng ledger.
- `aip check` vẫn báo bản ghi scope user và bản ghi của chính project đang kiểm; output text của CLI cũ vẫn được đọc như trước.
## Kiểm thử
- (4) `test/contract/60-versions.contract.mjs`: regression `parseClaudePluginJson` bỏ bản ghi của project khác.
- (5) `test/contract/90-hooks.contract.mjs`: regression worktree `x-p02` nạp ledger `02-b`; phiên ở gốc giữ cách chọn cũ.
- Thực tế: `aip check -g` trên máy thật; hook từ worktree part thật; (1)(2)(3) tái hiện thủ công ở lần chạy thử.
## Để builder quyết
- Không có.
## Rủi ro và câu hỏi mở
- Worktree đặt tên khác quy ước `<slug>-p<nn>` thì hook giữ cách chọn cũ. Ledger của chính part quá `handoffMaxAgeHours` thì hook không nạp ledger nào cho phiên part (không rơi về ledger part anh em).
- `aip check` scope project dùng cwd làm gốc: chạy từ thư mục con của project thì bản ghi `projectPath` của chính project có thể bị coi là project khác. [Unverified] `projectPath` của Claude Code là gốc nơi cài plugin, chưa kiểm khi cài từ thư mục con.
- [Unverified] CLI Claude Code cũ chỉ có output text sẽ vẫn báo lệch sai như trước.
