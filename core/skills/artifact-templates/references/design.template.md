<!-- artifact-template
type: design
version: 1
validator: scripts/check-request.mjs
sources: docs/requests/2026-10-20-superpowers-docs-standard/design.md §4.2; docs/requests/2026-10-23-workflow-self-sufficient/design.md (R7)
Bỏ khối này khi chép template ra dùng.
-->

# Thiết kế: <tên>
- Ngày: <yyyy-mm-dd>
- Trạng thái: <draft | approved | in-progress | merged | abandoned> — <ghi chú, vd hash merge>
- Requirement: <link requirement.md, hoặc "không có">
## Vấn đề và lý do
<...>
## Quyết định đã chốt
<...>
## Tiêu chí chấp nhận
<chỉ khi không có requirement.md; cùng định dạng AC như requirement.md>
## Thiết kế
<...>
## Bảng part
<tuỳ chọn, bỏ mục này nếu request không chia part; mỗi part có parts/<nn>-<part-slug>/plan.md; Phụ thuộc = danh sách part hoặc —; Song song = nhãn nhóm hoặc —; Trạng thái ∈ chưa làm | đang làm | merged <hash> | bỏ>
| Part | Phụ thuộc | Song song | Trạng thái |
|---|---|---|---|
| 01-<part-slug> | — | — | chưa làm |
## Ảnh hưởng spec
<chọn một trong hai dạng, bỏ dạng không dùng; hành động ∈ thêm|đổi|bỏ>
- <năng-lực>: thêm R<n>, đổi R<m>, bỏ R<k>
Không ảnh hưởng: <lý do>
## Ngoài phạm vi và anti-goal
<...>
## Ràng buộc
<...>
## Không đổi (bugfix)
<chỉ với bugfix: hành vi phải giữ nguyên; bỏ mục này nếu không phải bugfix>
## Kiểm thử
<AC nào được kiểm ở tầng nào>
## Để builder quyết
<...>
## Rủi ro và câu hỏi mở
<...>
