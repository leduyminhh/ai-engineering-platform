<!-- artifact-template
type: requirement
version: 1
validator: scripts/check-request.mjs
sources: EARS (Mavin et al. 2009); Gherkin Given-When-Then; docs/requests/2026-10-20-superpowers-docs-standard/design.md §4.2; docs/requests/2026-10-23-workflow-self-sufficient/design.md (R7)
Bỏ khối này khi chép template ra dùng.
-->

# Requirement: <tên yêu cầu>
## Yêu cầu gốc
<Hệ thống PHẢI …>
## Bối cảnh
<...>
## Ràng buộc
<...>
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given <tiền điều kiện> When <hành động> Then <kết quả đo được>
<AC nêu kết quả số thì kèm khối `calc: <biểu thức> = <kết quả>` trong backtick, vd `calc: 99999 - floor(99999 * 15 / 100) = 85000`; check-request.mjs tính lại (W22)>
## Không đổi (bugfix)
- <hành vi phải giữ nguyên; bỏ mục này nếu không phải bugfix>
