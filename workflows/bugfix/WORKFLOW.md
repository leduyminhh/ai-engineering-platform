---
name: workflow-bugfix
description: "Workflow điều phối sửa bug đúng quy trình: hiểu bối cảnh, tái hiện bằng failing test, thu evidence, xác định root cause có xác nhận người dùng, fix tối thiểu, chạy regression toàn bộ, review đa vai trò, rồi commit qua git-workflow. Dùng workflow NÀY khi người dùng muốn \"sửa bug\", \"fix lỗi\", \"debug\", \"tại sao bị lỗi\", hoặc dán stacktrace — kể cả khi không nói chính xác chữ \"workflow\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần."
order: 2
title: "Bugfix — tái hiện, root cause, fix tối thiểu, regression"
kind: workflow
tier: 1
risk: medium
agents: "backend-test-writer,frontend-test-writer,backend-reviewer,frontend-reviewer,engineering-quality-auditor"
requires: "core/git-workflow"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Bugfix — tái hiện, root cause, fix tối thiểu, regression

## Mục tiêu & đầu vào

- **Mục tiêu:** sửa đúng nguyên nhân gốc của một bug, có failing test tái hiện được bug và chuyển xanh sau
  khi fix, không phá vỡ hành vi khác, sẵn sàng để người dùng duyệt diff và commit.
- **Đầu vào bắt buộc:** mô tả bug (hành vi mong đợi vs thực tế), hoặc stacktrace/log lỗi.
- **Đầu vào tuỳ chọn:** bước tái hiện thủ công đã biết, metric/DB liên quan, PR/commit nghi ngờ gây lỗi.

## Điều kiện tiên quyết

- Skill/agent đã cài: `backend-test-writer`, `frontend-test-writer`, `backend-reviewer`,
  `frontend-reviewer`, `engineering-quality-auditor`, skill `core/git-workflow`.
- Artifact phải có sẵn: không bắt buộc, nhưng có log/stacktrace/bug report giúp thu evidence nhanh hơn.
- Baseline: xác định được vùng code nghi ngờ (module/service/component); build hiện tại của project XANH
  ngoài phần đang lỗi.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Hiểu bối cảnh

- **Thực hiện:** session chính
- **Đầu vào:** mô tả bug / stacktrace của người dùng
- **Hành động:** làm rõ hành vi mong đợi vs hành vi thực tế; xác định phía bị ảnh hưởng (backend/frontend/cả
  hai).
- **Ràng buộc:** không phỏng đoán nguyên nhân ở bước này; không sửa code.
- **Đầu ra:** mô tả "mong đợi vs thực tế" + phía BE/FE ghi rõ.
- **Gate:** hành vi mong đợi vs thực tế + phía BE/FE ghi rõ.
- **Khi fail:** mô tả bug không đủ để phân biệt mong đợi vs thực tế → hỏi lại người dùng.
- **Evidence:** đoạn mô tả "mong đợi vs thực tế" trong report bước.

### Bước 2 — Tái hiện

- **Thực hiện:** agent `backend-test-writer` ∥ agent `frontend-test-writer` (chỉ phía có lỗi theo Bước 1)
- **Đầu vào:** mô tả "mong đợi vs thực tế" từ Bước 1
- **Hành động:** viết failing test tái hiện đúng bug (đỏ đúng lý do bug, không đỏ vì lỗi viết test); nếu
  không viết được test tự động, thực hiện bước tái hiện thủ công và ghi lại evidence quan sát được.
- **Ràng buộc:** không sửa code production ở bước này; không viết test phụ thuộc thứ tự/thời gian thực/mạng
  thật.
- **Đầu ra:** failing test đỏ, hoặc log bước tái hiện thủ công.
- **Gate:** failing test đỏ đúng lý do, hoặc bước tái hiện thủ công có evidence.
- **Khi fail:** không tái hiện được bug → quay lại Bước 1 làm rõ thêm bối cảnh, hoặc hỏi người dùng bước tái
  hiện chính xác hơn.
- **Evidence:** lệnh chạy test + output đỏ đúng lý do bug, hoặc log/screenshot bước tái hiện thủ công.

### Bước 3 — Thu evidence

- **Thực hiện:** session chính
- **Đầu vào:** failing test/bước tái hiện từ Bước 2
- **Hành động:** thu log/stacktrace/metric/truy vấn DB liên quan trực tiếp tới lỗi; đối chiếu với thời điểm
  tái hiện.
- **Ràng buộc:** không mask sai lệch hoặc bỏ qua log gây khó hiểu; không suy diễn khi chưa có evidence.
- **Đầu ra:** tập evidence gắn với lỗi.
- **Gate:** ≥1 evidence (log/stacktrace/metric/DB) gắn với lỗi.
- **Khi fail:** không thu được evidence nào → hỏi người dùng cung cấp log/quyền truy cập cần thiết.
- **Evidence:** trích đoạn log/stacktrace/metric/DB kèm timestamp khớp lần tái hiện ở Bước 2.

### Bước 4 — Root cause ⏸

- **Thực hiện:** session chính
- **Đầu vào:** failing test (Bước 2) + evidence (Bước 3)
- **Hành động:** xây dựng chuỗi nhân quả từ evidence tới hành vi lỗi quan sát được; trình bày cho người dùng
  để xác nhận trước khi fix.
- **Ràng buộc:** không kết luận root cause khi evidence chưa đủ khớp; không suy diễn nguyên nhân không có
  evidence hỗ trợ.
- **Đầu ra:** giải thích root cause, có trích dẫn evidence.
- **Gate:** giải thích nhân quả khớp evidence, người dùng đồng ý.
- **Khi fail:** người dùng không đồng ý root cause → quay lại Bước 3 thu thêm evidence hoặc xem lại giả
  thuyết.
- **Evidence:** đoạn giải thích root cause + trích dẫn evidence tương ứng + xác nhận của người dùng.

### Bước 5 — Fix tối thiểu

- **Thực hiện:** session chính
- **Đầu vào:** root cause đã xác nhận ở Bước 4
- **Hành động:** sửa đúng nguyên nhân gốc, phạm vi thay đổi tối thiểu cần thiết; chạy lại failing test của
  Bước 2.
- **Ràng buộc:** cấm sửa khi chưa tái hiện được bug hoặc chưa có evidence mạnh; cấm chỉ sửa triệu chứng (che
  lỗi mà không sửa nguyên nhân); cấm xoá/nới điều kiện test cho qua.
- **Đầu ra:** code fix + failing test của Bước 2 chuyển xanh.
- **Gate:** failing test chuyển xanh.
- **Khi fail:** fix không làm test xanh, hoặc test vẫn đỏ vì lý do khác → quay lại Bước 4 xem lại root cause.
- **Evidence:** lệnh chạy lại đúng test của Bước 2 + exit code 0.

### Bước 6 — Regression

- **Thực hiện:** agent `backend-test-writer` ∥ agent `frontend-test-writer` (phía đã fix)
- **Đầu vào:** code fix từ Bước 5
- **Hành động:** chạy toàn bộ test suite của phía đã fix (không chỉ test mới) để phát hiện regression.
- **Ràng buộc:** không xoá/nới bất kỳ test nào để toàn bộ test pass.
- **Đầu ra:** báo cáo toàn bộ test suite pass.
- **Gate:** toàn bộ test pass.
- **Khi fail:** có test khác đỏ do fix gây ra → quay lại Bước 5 điều chỉnh fix, không nới test đang đỏ.
- **Evidence:** lệnh chạy toàn bộ test suite + exit code 0 + số liệu (`X tests, X passed`).

### Bước 7 — Review

- **Thực hiện:** agent `backend-reviewer` ∥ agent `frontend-reviewer` ∥ agent `engineering-quality-auditor`
- **Đầu vào:** diff fix hoàn chỉnh từ Bước 5–6
- **Hành động:** review correctness/kiến trúc của phần fix; chạy quality/security gate; validate lại từng
  finding trước khi báo.
- **Ràng buộc:** chỉ đọc, không tự sửa code.
- **Đầu ra:** danh sách finding theo severity (schema §5.1).
- **Gate:** 0 finding `blocker`.
- **Khi fail:** còn finding `blocker` → quay lại Bước 5 sửa, review lại phần đã sửa.
- **Evidence:** danh sách finding (severity/category/location/evidence/confidence).

### Bước 8 — Commit ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** diff fix hoàn chỉnh (code + test) đã qua Bước 1–7
- **Hành động:** tóm tắt bug + root cause + fix, đề xuất commit message Conventional Commits (header EN, body
  VI); trình diff cho người dùng duyệt.
- **Ràng buộc:** không tự commit khi người dùng chưa duyệt diff; không push trừ khi được yêu cầu.
- **Đầu ra:** commit đã tạo (sau khi người dùng duyệt).
- **Gate:** người dùng duyệt diff.
- **Khi fail:** người dùng yêu cầu sửa thêm → quay lại bước tương ứng, không commit tạm.
- **Evidence:** hash commit + message.

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 4 | Giải thích root cause + evidence trích dẫn | Người dùng đồng ý root cause khớp evidence |
| 8 | Diff fix hoàn chỉnh (code + test) | Người dùng duyệt diff |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Build fail | Chẩn đoán → sửa → build lại |
| Test fail | Phân tích failure → sửa code (không xoá/nới test) → chạy lại |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` | Chặn hoàn thành cho tới khi sửa hoặc người dùng chấp nhận rủi ro |
| Cấm: sửa khi chưa tái hiện được bug hoặc chưa có evidence mạnh | Từ chối sửa, quay lại Bước 2/3 thu thêm evidence |
| Cấm: chỉ sửa triệu chứng (che lỗi, không sửa nguyên nhân) | Từ chối, quay lại Bước 4 xác định lại root cause |
| Cấm: xoá/nới điều kiện test cho qua | Từ chối, quay lại Bước 5 sửa đúng code |
| Người dùng không đồng ý root cause (sau Bước 4 ⏸) | Quay lại Bước 3 thu thêm evidence hoặc xem lại giả thuyết |
| Người dùng không duyệt diff (sau Bước 8 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |

- **Điều kiện dừng:** không tái hiện được bug sau khi hỏi lại người dùng; người dùng không đồng ý root cause
  sau nhiều vòng; finding `blocker` không sửa được trong phạm vi bugfix; người dùng không duyệt diff.
- **Rollback:** trước checkpoint commit, chưa có gì để rollback (chưa commit); nếu người dùng huỷ giữa
  chừng, xoá thay đổi chưa commit bằng thao tác git thủ công của người dùng (workflow không tự `reset --hard`).

## Definition of Done

- [ ] Hành vi mong đợi vs thực tế + phía BE/FE ghi rõ — evidence: Bước 1
- [ ] Failing test tái hiện đúng bug — evidence: Bước 2
- [ ] ≥1 evidence gắn với lỗi — evidence: Bước 3
- [ ] Root cause được người dùng xác nhận — evidence: Bước 4
- [ ] Failing test chuyển xanh sau fix — evidence: Bước 5
- [ ] Toàn bộ test suite pass (không regression) — evidence: Bước 6
- [ ] Người dùng đã duyệt diff và commit đã tạo — evidence: Bước 8
- [ ] Mọi gate có evidence `passed`
- [ ] 0 finding `blocker`

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
workflow_result:
  workflow: workflow-bugfix
  status: completed        # completed | failed | blocked
  summary: "<1–3 câu>"
  changes: { added: [], modified: [], deleted: [] }
  validation:
    - command: "<lệnh>"
      exit_code: 0
      status: passed       # passed | failed | not_run
      summary: "<số liệu>"
      reason: ""
  findings: []             # severity, category, location, evidence, impact, recommendation, confidence
  remaining_risks: []
  docs_updated: []
  next_actions: []
```
