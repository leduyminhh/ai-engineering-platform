---
name: workflow-bugfix
description: "Workflow điều phối sửa bug đúng quy trình: hiểu bối cảnh, tái hiện bằng failing test, thu evidence, xác định root cause có xác nhận người dùng, fix tối thiểu, chạy regression toàn bộ, review đa vai trò, rồi commit qua git-workflow. Dùng workflow NÀY khi người dùng muốn \"sửa bug\", \"fix lỗi\", \"debug\", \"tại sao bị lỗi\", hoặc dán stacktrace — kể cả khi không nói chính xác chữ \"workflow\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần."
order: 2
title: "Bugfix — tái hiện, root cause, fix tối thiểu, regression"
kind: workflow
tier: 1
risk: medium
agents: "backend-test-writer,frontend-test-writer,backend-fixer,frontend-fixer,backend-reviewer,frontend-reviewer,engineering-quality-auditor"
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

- Skill/agent đã cài: `backend-test-writer`, `frontend-test-writer`, `backend-fixer`, `frontend-fixer`,
  `backend-reviewer`, `frontend-reviewer`, `engineering-quality-auditor`, skill `core/git-workflow`.
- Artifact phải có sẵn: không bắt buộc, nhưng có log/stacktrace/bug report giúp thu evidence nhanh hơn.
- Baseline: xác định được vùng code nghi ngờ (module/service/component); build hiện tại của project XANH
  ngoài phần đang lỗi — được đo và ghi số mốc ở Bước 1.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Baseline build/test

- **Thực hiện:** session chính
- **Đầu vào:** mô tả lỗi + vùng nghi ngờ của người dùng
- **Hành động:** chạy build và test của vùng nghi ngờ theo lệnh của project; ghi số mốc (lệnh, exit code, số test
  pass/fail) làm baseline cho các bước sau.
- **Ràng buộc:** chỉ chạy build/test cục bộ; không chạy lệnh tác động môi trường; không sửa code để làm xanh.
- **Đầu ra:** baseline build/test (lệnh + exit code + số liệu).
- **Gate:** build xanh; số mốc test của vùng nghi ngờ đã ghi (test có thể đỏ đúng vì bug đang xử lý).
- **Khi fail:** build đỏ, hoặc test đỏ ngoài vùng bug → dừng `blocked`, báo người dùng; không sửa lẫn hai lỗi.
- **Evidence:** lệnh build/test + exit code + số liệu pass/fail.

### Bước 2 — Hiểu bối cảnh

- **Thực hiện:** session chính
- **Đầu vào:** mô tả bug / stacktrace của người dùng
- **Hành động:** làm rõ hành vi mong đợi vs hành vi thực tế; xác định phía bị ảnh hưởng (backend/frontend/cả
  hai).
- **Ràng buộc:** không phỏng đoán nguyên nhân ở bước này; không sửa code.
- **Đầu ra:** mô tả "mong đợi vs thực tế" + phía BE/FE ghi rõ.
- **Gate:** hành vi mong đợi vs thực tế + phía BE/FE ghi rõ.
- **Khi fail:** mô tả bug không đủ để phân biệt mong đợi vs thực tế → hỏi lại người dùng.
- **Evidence:** đoạn mô tả "mong đợi vs thực tế" trong report bước.

### Bước 3 — Tái hiện

- **Thực hiện:** agent `backend-test-writer` ∥ agent `frontend-test-writer` (chỉ phía có lỗi theo Bước 2)
- **Đầu vào:** mô tả "mong đợi vs thực tế" từ Bước 2
- **Hành động:** viết failing test tái hiện đúng bug (đỏ đúng lý do bug, không đỏ vì lỗi viết test); nếu
  không viết được test tự động, thực hiện bước tái hiện thủ công và ghi lại evidence quan sát được.
- **Ràng buộc:** không sửa code production ở bước này; không viết test phụ thuộc thứ tự/thời gian thực/mạng
  thật.
- **Đầu ra:** failing test đỏ, hoặc log bước tái hiện thủ công.
- **Gate:** failing test đỏ đúng lý do, hoặc bước tái hiện thủ công có evidence; so với trạng thái ghi lại ở
  đầu bước (`git status --porcelain`), các file thay đổi hoặc mới trong bước (`git diff --name-only` và
  `git ls-files --others --exclude-standard`) chỉ gồm file test (và fixture/mock của test).
- **Khi fail:** không tái hiện được bug → quay lại Bước 2 làm rõ thêm bối cảnh, hoặc hỏi người dùng bước tái
  hiện chính xác hơn.
- **Evidence:** lệnh chạy test + output đỏ đúng lý do bug, hoặc log/screenshot bước tái hiện thủ công; danh
  sách file thay đổi hoặc mới trong bước so với trạng thái đầu bước.

### Bước 4 — Thu evidence

- **Thực hiện:** session chính
- **Đầu vào:** failing test/bước tái hiện từ Bước 3
- **Hành động:** thu log/stacktrace/metric/truy vấn DB liên quan trực tiếp tới lỗi; đối chiếu với thời điểm
  tái hiện.
- **Ràng buộc:** không mask sai lệch hoặc bỏ qua log gây khó hiểu; không suy diễn khi chưa có evidence.
- **Đầu ra:** tập evidence gắn với lỗi.
- **Gate:** ≥1 evidence (log/stacktrace/metric/DB) gắn với lỗi.
- **Khi fail:** không thu được evidence nào → hỏi người dùng cung cấp log/quyền truy cập cần thiết.
- **Evidence:** trích đoạn log/stacktrace/metric/DB kèm timestamp khớp lần tái hiện ở Bước 3.

### Bước 5 — Root cause ⏸

- **Thực hiện:** session chính
- **Đầu vào:** failing test (Bước 3) + evidence (Bước 4)
- **Hành động:** xây dựng chuỗi nhân quả từ evidence tới hành vi lỗi quan sát được; trình bày cho người dùng
  để xác nhận trước khi fix.
- **Ràng buộc:** không kết luận root cause khi evidence chưa đủ khớp; không suy diễn nguyên nhân không có
  evidence hỗ trợ.
- **Đầu ra:** giải thích root cause, có trích dẫn evidence; **danh sách file/module được sửa** suy từ chuỗi nhân
  quả (đầu vào cho Bước 6), người dùng xác nhận cùng root cause.
- **Gate:** giải thích nhân quả khớp evidence, người dùng đồng ý.
- **Khi fail:** người dùng không đồng ý root cause → quay lại Bước 4 thu thêm evidence hoặc xem lại giả
  thuyết.
- **Evidence:** đoạn giải thích root cause + trích dẫn evidence tương ứng + danh sách file được sửa + xác nhận
  của người dùng.

### Bước 6 — Fix tối thiểu

- **Thực hiện:** agent `backend-fixer` ∥ agent `frontend-fixer` (chỉ phía có lỗi theo Bước 2)
- **Đầu vào:** oracle = failing test của Bước 3 + root cause và danh sách file được sửa đã xác nhận ở Bước 5
- **Hành động:** agent sửa đúng nguyên nhân gốc theo skill `backend-fix`/`frontend-fix` (chế độ `bug`), phạm vi
  thay đổi tối thiểu trong danh sách file; chạy lại failing test của Bước 3 và build/lint của module đụng.
- **Ràng buộc:** cấm sửa khi chưa tái hiện được bug hoặc chưa có evidence mạnh; cấm chỉ sửa triệu chứng (che
  lỗi mà không sửa nguyên nhân); cấm xoá/nới điều kiện test cho qua; không sửa ngoài danh sách file — cần mở
  rộng → agent trả `blocked`, session chính hỏi người dùng rồi gọi lại.
- **Đầu ra:** code fix + failing test của Bước 3 chuyển xanh + build/lint xanh.
- **Gate:** failing test chuyển xanh; build/lint xanh; so với trạng thái ghi lại ở đầu bước
  (`git status --porcelain`), file thay đổi hoặc mới trong bước (`git diff --name-only` và
  `git ls-files --others --exclude-standard`) ⊆ danh sách file của Bước 5 và không chứa file test/fixture/snapshot.
- **Khi fail:** agent trả `blocked` → người dùng mở rộng danh sách (ghi bổ sung vào Đầu ra Bước 5) → gọi lại; fix
  không làm test xanh, hoặc test vẫn đỏ vì lý do khác → quay lại Bước 5 xem lại root cause; diff lệch danh sách
  → revert phần lệch, không nhận.
- **Evidence:** report của agent (lệnh chạy lại đúng test của Bước 3, exit code đỏ → 0) + danh sách file thay
  đổi hoặc mới trong bước so với trạng thái đầu bước.

### Bước 7 — Regression

- **Thực hiện:** agent `backend-test-writer` ∥ agent `frontend-test-writer` (phía đã fix)
- **Đầu vào:** code fix từ Bước 6
- **Hành động:** chạy toàn bộ test suite của phía đã fix (không chỉ test mới) để phát hiện regression; và
  đối chiếu số lượng test trước/sau fix để xác nhận không có test nào bị xoá hoặc nới lỏng điều kiện.
- **Ràng buộc:** không xoá/nới bất kỳ test nào để toàn bộ test pass.
- **Đầu ra:** báo cáo toàn bộ test suite pass.
- **Gate:** toàn bộ test pass; so với trạng thái ghi lại ở đầu bước (`git status --porcelain`), các file thay
  đổi hoặc mới trong bước (`git diff --name-only` và `git ls-files --others --exclude-standard`) chỉ gồm file
  test (và fixture/mock của test).
- **Khi fail:** có test khác đỏ do fix gây ra → quay lại Bước 6 điều chỉnh fix, không nới test đang đỏ.
- **Evidence:** lệnh chạy toàn bộ test suite + exit code 0 + số liệu (`X tests, X passed`); danh sách file
  thay đổi hoặc mới trong bước so với trạng thái đầu bước.

### Bước 8 — Review

- **Thực hiện:** agent `backend-reviewer` ∥ agent `frontend-reviewer` ∥ agent `engineering-quality-auditor`
- **Đầu vào:** diff fix hoàn chỉnh từ Bước 6–7
- **Hành động:** review correctness/kiến trúc của phần fix; chạy quality/security gate; validate lại từng
  finding trước khi báo.
- **Ràng buộc:** chỉ đọc, không tự sửa code.
- **Đầu ra:** danh sách finding theo severity (contract đầu ra, `core:principles`).
- **Gate:** 0 finding `blocker`.
- **Khi fail:** còn finding `blocker` → quay lại Bước 6 sửa, review lại phần đã sửa.
- **Evidence:** danh sách finding (severity/category/location/evidence/confidence).

### Bước 9 — Commit ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** diff fix hoàn chỉnh (code + test) đã qua Bước 1–8
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
| 5 | Giải thích root cause + evidence trích dẫn | Người dùng đồng ý root cause khớp evidence |
| 9 | Diff fix hoàn chỉnh (code + test) | Người dùng duyệt diff |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Baseline đỏ (Bước 1) | Build đỏ, hoặc test đỏ ngoài vùng bug → dừng `blocked`, báo người dùng; test đỏ trong vùng bug là bình thường và được ghi vào số mốc |
| Build fail | Chẩn đoán → sửa → build lại |
| Test fail | Phân tích failure → sửa code (không xoá/nới test) → chạy lại |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` | Chặn hoàn thành cho tới khi sửa hoặc người dùng chấp nhận rủi ro |
| Cấm: sửa khi chưa tái hiện được bug hoặc chưa có evidence mạnh | Từ chối sửa, quay lại Bước 3/4 thu thêm evidence |
| Cấm: chỉ sửa triệu chứng (che lỗi, không sửa nguyên nhân) | Từ chối, quay lại Bước 5 xác định lại root cause |
| Cấm: xoá/nới điều kiện test cho qua | Từ chối, quay lại Bước 6 sửa đúng code |
| Fixer trả `blocked` (Bước 6) | Người dùng mở rộng danh sách file có xác nhận, gọi lại agent; không tự mở phạm vi |
| Người dùng không đồng ý root cause (sau Bước 5 ⏸) | Quay lại Bước 4 thu thêm evidence hoặc xem lại giả thuyết |
| Người dùng không duyệt diff (sau Bước 9 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |

- **Điều kiện dừng:** không tái hiện được bug sau khi hỏi lại người dùng; người dùng không đồng ý root cause
  sau nhiều vòng; finding `blocker` không sửa được trong phạm vi bugfix; người dùng không duyệt diff.
- **Rollback:** trước checkpoint commit, chưa có gì để rollback (chưa commit); nếu người dùng huỷ giữa
  chừng, xoá thay đổi chưa commit bằng thao tác git thủ công của người dùng (workflow không tự `reset --hard`).

## Definition of Done

- [ ] Baseline build/test đã đo, số mốc đã ghi — evidence: Bước 1
- [ ] Hành vi mong đợi vs thực tế + phía BE/FE ghi rõ — evidence: Bước 2
- [ ] Failing test tái hiện đúng bug — evidence: Bước 3
- [ ] ≥1 evidence gắn với lỗi — evidence: Bước 4
- [ ] Root cause được người dùng xác nhận — evidence: Bước 5
- [ ] Failing test chuyển xanh sau fix — evidence: Bước 6
- [ ] Toàn bộ test suite pass (không regression) — evidence: Bước 7
- [ ] Người dùng đã duyệt diff và commit đã tạo — evidence: Bước 9
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
