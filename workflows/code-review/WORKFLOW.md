---
name: workflow-code-review
description: "Workflow điều phối review một diff/PR đã có sẵn: hiểu intent thay đổi, phân vùng diff theo backend/frontend, review song song đa vai trò theo trục correctness/thiết kế/a11y/test, validate lại từng finding bằng cách đọc file:line, rồi tổng hợp verdict approve/request-changes. Dùng workflow NÀY khi người dùng muốn \"review PR\", \"review code\", \"đọc soát diff\", \"nhận xét PR\" — kể cả khi không nói chính xác chữ \"workflow\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần."
order: 4
title: "Code review — review diff/PR đa vai trò, chỉ đọc"
kind: workflow
tier: 1
risk: low
agents: "backend-reviewer,frontend-reviewer,engineering-quality-auditor"
requires: ""
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Code review — review diff/PR đa vai trò, chỉ đọc

## Mục tiêu & đầu vào

- **Mục tiêu:** review một diff/PR đã có sẵn theo đúng trục (correctness, thiết kế/kiến trúc, a11y, test
  coverage), trả về danh sách finding đã validate theo severity, và một verdict rõ ràng — không sửa code,
  không commit.
- **Đầu vào bắt buộc:** diff/PR cần review (số PR, branch, hoặc patch dán trực tiếp).
- **Đầu vào tuỳ chọn:** mô tả intent của PR (nếu có sẵn trong PR description), yêu cầu/spec liên quan.

## Điều kiện tiên quyết

- Skill/agent đã cài: `backend-reviewer`, `frontend-reviewer`, `engineering-quality-auditor`.
- Artifact phải có sẵn: diff/PR có thể đọc được (đã fetch được branch/PR, hoặc patch đầy đủ).
- Baseline: không yêu cầu build/test xanh trước — workflow chỉ đọc, không sửa code nên không cần baseline
  của project.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Hiểu intent

- **Thực hiện:** session chính
- **Đầu vào:** diff/PR + mô tả (nếu có) của người dùng
- **Hành động:** đọc PR description/commit message để nắm mục tiêu thay đổi; liệt kê toàn bộ file bị đổi
  trong diff.
- **Ràng buộc:** không suy diễn intent khi PR description trống — hỏi người dùng hoặc suy ra từ tên
  file/commit một cách thận trọng, ghi rõ đây là suy luận.
- **Đầu ra:** mục tiêu thay đổi (1–2 câu) + danh sách file đổi.
- **Gate:** mục tiêu thay đổi + danh sách file đổi.
- **Khi fail:** không xác định được mục tiêu thay đổi từ diff/PR → hỏi lại người dùng.
- **Evidence:** đoạn tóm tắt mục tiêu + danh sách file đổi trong report bước.

### Bước 2 — Phân vùng diff

- **Thực hiện:** session chính
- **Đầu vào:** danh sách file đổi từ Bước 1
- **Hành động:** gán mỗi file vào `backend`, `frontend`, hoặc `khác` (docs/config/CI…); đối chiếu với cấu
  trúc thư mục project để tránh gán sai.
- **Ràng buộc:** không bỏ sót file nào trong diff; file `khác` vẫn phải liệt kê dù không có reviewer chuyên
  trách.
- **Đầu ra:** bảng file → BE/FE/khác.
- **Gate:** mỗi file gán BE, FE hoặc khác.
- **Khi fail:** một file không rõ thuộc phía nào → hỏi người dùng, hoặc gán tạm "khác" và ghi rõ lý do.
- **Evidence:** bảng phân vùng file trong report bước.

### Bước 3 — Review song song

- **Thực hiện:** agent `backend-reviewer` ∥ agent `frontend-reviewer` ∥ agent `engineering-quality-auditor`
  (chỉ vùng có đụng theo Bước 2)
- **Đầu vào:** diff đầy đủ + bảng phân vùng từ Bước 2
- **Hành động:** mỗi agent review đúng phía được gán theo trục correctness/thiết kế-kiến trúc/a11y/test
  coverage/quality-security; trích `file:line` cụ thể cho từng finding.
- **Ràng buộc:** chỉ đọc, không tự sửa code; không review phía không có file đụng.
- **Đầu ra:** danh sách finding thô theo severity (schema §5.1) từ mỗi agent.
- **Gate:** mỗi agent trả finding theo schema.
- **Khi fail:** một agent không trả finding theo đúng schema (thiếu `file:line`/severity) → yêu cầu agent đó
  bổ sung lại, không tự bịa field thiếu.
- **Evidence:** danh sách finding thô của từng agent (severity/category/location/evidence/confidence).

### Bước 4 — Validate findings

- **Thực hiện:** session chính
- **Đầu vào:** finding thô từ Bước 3
- **Hành động:** đọc lại `file:line` của từng finding trong diff thật để xác nhận còn đúng; loại finding
  không tái lập được hoặc `file:line` sai; ghi lại số lượng finding bị loại kèm lý do.
- **Ràng buộc:** không tự hạ severity của finding để giảm số blocker; không giữ lại finding không đọc lại
  được `file:line`.
- **Đầu ra:** danh sách finding đã validate + số finding bị loại kèm lý do.
- **Gate:** mỗi finding giữ lại đã đọc lại `file:line`; ghi số finding bị loại.
- **Khi fail:** không đọc lại được `file:line` của một finding (file không tồn tại trong diff) → loại finding
  đó, ghi lý do "không tái lập được".
- **Evidence:** danh sách finding đã validate + số finding bị loại kèm lý do trong report bước.

### Bước 5 — Tổng hợp & verdict ⏸

- **Thực hiện:** session chính
- **Đầu vào:** finding đã validate từ Bước 4
- **Hành động:** gom finding theo severity, dedupe finding trùng theo cùng `file:line`; đưa ra verdict
  `approve` hoặc `request-changes` dựa trên số finding `blocker`/`major` còn lại.
- **Ràng buộc:** verdict `approve` chỉ khi 0 finding `blocker`; không tự sửa code để "cho qua" verdict.
- **Đầu ra:** report theo severity (dedupe) + verdict `approve` \| `request-changes`.
- **Gate:** report theo severity, dedupe theo `file:line`, verdict `approve` \| `request-changes`.
- **Khi fail:** người dùng không đồng ý verdict → quay lại Bước 3/4 review/validate lại phần người dùng chỉ
  ra.
- **Evidence:** report cuối theo severity + verdict, trình cho người dùng xác nhận.

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 5 | Report finding theo severity (dedupe) + verdict `approve`/`request-changes` | Người dùng xác nhận đã đọc report |

Ràng buộc: chỉ đọc, không commit — workflow này không đi qua `core:git-workflow`.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Build fail | Không áp dụng — workflow chỉ đọc, không build |
| Test fail | Không áp dụng — workflow chỉ đọc, không chạy test |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` | Ghi vào report với verdict `request-changes`; không tự sửa code |
| Không xác định được mục tiêu thay đổi (sau Bước 1) | Hỏi lại người dùng, không tự suy diễn |
| Agent trả finding thiếu field theo schema (Bước 3) | Yêu cầu agent bổ sung lại, không tự bịa field thiếu |
| Người dùng không đồng ý verdict (sau Bước 5 ⏸) | Quay lại Bước 3/4 review/validate lại phần người dùng chỉ ra |

- **Điều kiện dừng:** không xác định được mục tiêu thay đổi sau khi hỏi lại; diff/PR không đọc được (thiếu
  quyền truy cập); người dùng không đồng ý verdict sau nhiều vòng.
- **Rollback:** không áp dụng — workflow chỉ đọc, không sửa file, không commit, không có gì để rollback.

## Definition of Done

- [ ] Mục tiêu thay đổi + danh sách file đổi — evidence: Bước 1
- [ ] Mỗi file đã gán BE/FE/khác — evidence: Bước 2
- [ ] Mỗi agent đã trả finding theo schema — evidence: Bước 3
- [ ] Finding đã validate bằng đọc lại `file:line`, số finding bị loại đã ghi — evidence: Bước 4
- [ ] Report theo severity (dedupe) + verdict đã trình người dùng — evidence: Bước 5
- [ ] Mọi gate có evidence `passed`
- [ ] Report cuối phản ánh đúng verdict `approve`/`request-changes`

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
workflow_result:
  workflow: workflow-code-review
  status: completed        # completed | failed | blocked — "completed" = đã có verdict, KHÔNG nghĩa là code sạch blocker
  summary: "<1–3 câu, kèm verdict approve | request-changes>"
  changes: { added: [], modified: [], deleted: [] }
  validation:
    - command: "<lệnh>"
      exit_code: 0
      status: not_run
      summary: ""
      reason: "workflow chỉ đọc, không build/test"
  findings: []             # severity, category, location, evidence, impact, recommendation, confidence
  remaining_risks: []
  docs_updated: []
  next_actions: []
```
