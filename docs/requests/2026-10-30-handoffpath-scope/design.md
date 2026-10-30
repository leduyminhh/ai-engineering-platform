# Thiết kế: giới hạn handoffPath của hook session-start trong project
- Ngày: 2026-10-30
- Trạng thái: approved — sửa theo yêu cầu "Tiếp tục 2 việc còn mở" ngày 2026-10-30; regression test đỏ trước, xanh sau sửa
- Requirement: không có
## Vấn đề và lý do
Quality gate toàn nhánh `2026-10-29-superpowers-gap-closure` tái lập được: `handoffPath` trong `.claude/aip-gate.json` có thể trỏ ra ngoài repo (đường dẫn tương đối `../`, đường dẫn tuyệt đối) hoặc tới file bí mật trong repo (vd `.env`), và hook `session-start` nạp nguyên văn file đó vào `additionalContext`. Hook không đi qua `guard-files`, nên lỗi này lách được cổng đọc file bí mật H3. `aip-gate.json` nằm trong repo, nên một repo lạ có thể đặt giá trị này.
## Quyết định đã chốt
- Chỉ nhận `handoffPath` khi đường dẫn đã resolve là file `.md` nằm trong cwd của phiên, xét cả đường dẫn thật sau khi theo symlink (so với đường dẫn thật của cwd).
- Không khớp thì bỏ qua `handoffPath` và rơi về thứ tự tự tìm như cũ (`docs/requests/*/handoff.md`, rồi `.claude/handoff.md`); không báo lỗi, giữ fail-open.
- Không gọi git trong hook để tìm gốc repo: so với cwd của phiên (giới hạn đã ghi bằng chú thích `shortcut:` trong code).
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given `handoffPath` là `../outside.md`, đường dẫn tuyệt đối ngoài cwd, `.env` hoặc `notes/h.txt`, When hook chạy với `source: startup`, Then nội dung file đó không có trong `additionalContext` và handoff tự tìm vẫn được nạp.
- [ ] **AC1.2** — Given `handoffPath` là một symlink `.md` trong project trỏ ra ngoài project, When hook chạy, Then nội dung đích không được nạp.
- [ ] **AC1.3** — Given `handoffPath` là `notes/h.md` trong project, When hook chạy, Then nội dung được nạp như trước.
## Thiết kế
`findHandoff` trong `core/hooks/scripts/session-start.mjs` thêm hàm `within(root, p)` (dựa trên `path.relative`) và điều kiện `/\.md$/i`. Deps của `decide` thêm `realpath` (mặc định `realpathSync.native`) để test giả lập được symlink; `realpath` lỗi (file chưa có) thì dùng đường dẫn gốc.
## Ảnh hưởng spec
- hooks-gates: thêm R13
## Ngoài phạm vi và anti-goal
- Không đổi cách tự tìm handoff, không đổi ledger, bootstrap hay ngân sách 9000 ký tự.
- Không chặn nội dung độc hại bên trong một handoff hợp lệ của project (đã có từ R11, ngoài phạm vi).
## Ràng buộc
- Hook zero-dependency, fail-open, không ghi file; bump version `core` và chạy `node cli/lib/versions.mjs --lock`.
## Không đổi
- `handoffPath` hợp lệ (file `.md` trong cwd) vẫn được ưu tiên hơn tự tìm.
- Handoff quá tuổi, rỗng hoặc còn là template vẫn bị bỏ qua; cảnh báo resume/fork không đổi.
## Kiểm thử
- AC1.1, AC1.2, AC1.3: `decide()` trong `test/contract/90-hooks.contract.mjs` (ca hiện có "handoffPath được ưu tiên hơn tự tìm" phủ AC1.3; regression mới phủ AC1.1 và AC1.2).
- Smoke test trên đĩa thật (thư mục tạm, symlink thật) chạy tay, không thêm vào suite.
## Để builder quyết
- Không có.
## Rủi ro và câu hỏi mở
- Phiên mở ở thư mục con của repo mà `handoffPath` trỏ lên trên sẽ bị bỏ qua (giới hạn đã chấp nhận).
- [Unverified] `realpathSync.native` trên ổ mạng hoặc đường UNC chưa được thử.
