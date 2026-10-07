# Nguyên tắc riêng — Engineering Practices

> Phần này BỔ SUNG cho `core/principles/` (4 nguyên tắc cốt lõi, 3 tầng tài liệu,
> ranh giới an toàn nền, nguồn sự thật nền). Chỉ mô tả phần ĐẶC THÙ của plugin.

## Bản chất plugin
Đây là các capability **opt-in, xuyên suốt (cross-cutting)** — KHÔNG thuộc pipeline bắt buộc của
plugin nào, KHÔNG có thứ tự chạy ép buộc. Gọi từng skill khi cần: `quality-gate` (chất lượng +
bảo mật), `spec-writing` (khảo sát + đặc tả), `task-breakdown` (phân rã yêu cầu thành task BE/FE),
`diagram` (sinh PlantUML), `adr` (ghi quyết định kiến trúc), `convention-enforce` (kiểm quy ước),
`release-notes` (changelog + release notes).
Mỗi skill là **recipe docs-only** — hướng dẫn cách agent hành động, KHÔNG sinh mã nguồn cho project và KHÔNG
đụng CLI/adapter/engine. Skill được kèm **script kiểm tra/xuất tất định** (vd `task-breakdown/scripts/check-tasks.mjs`)
chỉ khi thoả cả 3 điều kiện: (1) chỉ dùng built-in của runtime, không phụ thuộc ngoài; (2) chỉ đọc input và ghi
file đầu ra được chỉ định, không sửa mã nguồn project; (3) skill vẫn chạy được bằng hướng dẫn thủ công khi không có
runtime. Tiền lệ: `core:git-workflow` kèm `scripts/test-commit-message-encoding.ps1`.

## Ranh giới đặc thù
- **Defer** `code-convention.md` và `project-knowledge/` cho skill init/plugin nghiệp vụ lo — plugin
  này ĐỌC chúng làm ràng buộc, KHÔNG dựng lại.
- **Con người giữ chốt:** duyệt **diff** (quality-gate), duyệt **spec** (spec-writing), duyệt **use case + bảng task** (task-breakdown), xác nhận
  **protected path** trước khi ghi `docs/diagram/` (diagram). Không tự commit.
- **Không** nhập/in/log token/secret; token đi qua **biến môi trường**, chỉ nêu tên biến; mask giá
  trị secret trong mọi output; không đọc/sửa ngoài scope người dùng nêu.

## Agent & workflow
Agent (subagent gói skill) **không** commit/push/tạo PR, và **không** gọi agent khác — chỉ workflow ở
session chính điều phối và gọi `core:git-workflow` sau checkpoint người duyệt. Mọi khẳng định "đã chạy /
đã pass" phải kèm evidence (`file:line`, exit code, command); thiếu evidence thì ghi `not_run` + lý do,
KHÔNG được báo hoàn thành.

## Ngôn ngữ đo được
Mọi kết luận dùng ngôn ngữ **đo được** (đếm được, có `file:line`/CVE/CVSS/tiêu chí kiểm được) và
LUÔN nêu **residual risk**. KHÔNG tuyên bố "chặn / đảm bảo / loại bỏ / sửa triệt để" — findings/spec/
diagram phản ánh dữ liệu tại thời điểm làm, có thể sót.
