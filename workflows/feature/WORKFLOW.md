---
name: workflow-feature
description: "Workflow điều phối làm một feature/user story end-to-end: phân tích yêu cầu + acceptance criteria, thiết kế/contract nếu có API, implement backend/frontend, viết test theo từng acceptance criterion, review đa vai trò, cập nhật docs, rồi commit qua git-workflow. Dùng workflow NÀY khi người dùng muốn \"làm feature\", \"thêm tính năng\", \"implement user story\", \"làm chức năng mới end-to-end\" — kể cả khi không nói chính xác chữ \"workflow\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần."
order: 1
title: "Feature — implement end-to-end từ yêu cầu tới commit"
kind: workflow
tier: 1
risk: medium
agents: "engineering-spec-analyst,backend-implementer,frontend-implementer,backend-test-writer,frontend-test-writer,backend-reviewer,frontend-reviewer,engineering-quality-auditor"
requires: "core/git-workflow"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Feature — implement end-to-end từ yêu cầu tới commit

## Mục tiêu & đầu vào

- **Mục tiêu:** biến một yêu cầu/user story thành một feature hoàn chỉnh, có test theo từng acceptance
  criterion, đã qua review, đã cập nhật docs liên quan, sẵn sàng để người dùng duyệt diff và commit.
- **Đầu vào bắt buộc:** mô tả yêu cầu/user story (câu lệnh tự nhiên hoặc file `docs/requests/…`).
- **Đầu vào tuỳ chọn:** contract API có sẵn (`docs/contracts/…`), thiết kế UI có sẵn (Figma/HTML/ảnh),
  ADR liên quan.

## Điều kiện tiên quyết

- Skill/agent đã cài: `engineering-spec-analyst`, `backend-implementer`, `frontend-implementer`,
  `backend-test-writer`, `frontend-test-writer`, `backend-reviewer`, `frontend-reviewer`,
  `engineering-quality-auditor`, skill `core/git-workflow`.
- Artifact phải có sẵn: `project-knowledge/architecture.md` (backend và/hoặc frontend, tuỳ phạm vi);
  `design-system.md` nếu có phần frontend.
- Baseline: build/test hiện tại của project đang XANH trước khi bắt đầu implement.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Phân tích yêu cầu & phạm vi ⏸

- **Thực hiện:** agent `engineering-spec-analyst`
- **Đầu vào:** mô tả yêu cầu/user story của người dùng
- **Hành động:** khảo sát yêu cầu còn thiếu, viết acceptance criteria đo được vào `docs/requests/…`; xác
  định phạm vi ảnh hưởng thuộc `backend`, `frontend`, hay `fullstack`.
- **Ràng buộc:** chỉ ghi trong `docs/`; không bịa yêu cầu khi thiếu thông tin — hỏi hoặc đánh dấu `[giả
  định]`; không phân rã story/task chi tiết.
- **Đầu ra:** `docs/requests/<ngày>-<slug>/requirement.md` với acceptance criteria + phạm vi BE/FE/fullstack.
- **Gate:** acceptance criteria đo được; phạm vi ∈ {backend, frontend, fullstack}.
- **Khi fail:** acceptance criteria mơ hồ/không đo được → hỏi lại người dùng, không tự suy diễn tiếp.
- **Evidence:** đường dẫn `requirement.md` + trích đoạn acceptance criteria.

### Bước 2 — Thiết kế & contract ⏸

- **Thực hiện:** agent `backend-implementer` (skill `backend-api-contract`, chỉ khi phạm vi có API)
- **Đầu vào:** `requirement.md` từ Bước 1
- **Hành động:** nếu feature có endpoint mới/đổi endpoint cũ, chốt/đồng bộ OpenAPI contract trong
  `docs/contracts/`; nếu ảnh hưởng kiến trúc, đề xuất ADR qua `engineering-spec-analyst`.
- **Ràng buộc:** không code implementation ở bước này; không đổi kiểu kiến trúc đã chốt.
- **Đầu ra:** contract OpenAPI cập nhật, hoặc ghi rõ "không có API" trong report bước.
- **Gate:** contract OpenAPI hợp lệ, hoặc ghi rõ "không có API".
- **Khi fail:** contract xung đột với hệ thống hiện có → dừng, hỏi lại người dùng cách xử lý breaking change.
- **Evidence:** đường dẫn file contract đã cập nhật, hoặc dòng ghi chú "không có API" trong report.

### Bước 3 — Implement

- **Thực hiện:** agent `backend-implementer` ∥ agent `frontend-implementer` (chỉ phía có đụng theo phạm vi
  Bước 1)
- **Đầu vào:** `requirement.md` + contract (nếu có) từ Bước 1–2
- **Hành động:** sinh vertical slice backend (aggregate/use-case/port/adapter) bám kiến trúc đã chọn; và/hoặc
  sinh component frontend bám kiến trúc UI + design-system; chạy build của từng phía.
- **Ràng buộc:** chỉ sửa file trong slice/feature được giao; frontend chưa nối API thật (Gap G1) → để trống
  bằng props + TODO, không giả lập data ẩn.
- **Đầu ra:** code implementation (backend và/hoặc frontend) build xanh.
- **Gate:** build xanh.
- **Khi fail:** build lỗi → chẩn đoán → sửa → build lại; lặp tới khi xanh.
- **Evidence:** lệnh build (`mvn compile`/`npm run build`/`tsc --noEmit` …) + exit code 0.

### Bước 4 — Test

- **Thực hiện:** agent `backend-test-writer` ∥ agent `frontend-test-writer` (chỉ phía có đụng)
- **Đầu vào:** code implementation từ Bước 3 + acceptance criteria từ Bước 1
- **Hành động:** viết unit/integration test cho từng acceptance criterion; chạy toàn bộ test suite của phía
  tương ứng.
- **Ràng buộc:** không sửa code production để "cho test xanh"; không viết test phụ thuộc thứ tự/thời gian
  thực/mạng thật.
- **Đầu ra:** test mới + báo cáo test pass.
- **Gate:** mỗi acceptance criterion ≥1 test; test pass.
- **Khi fail:** test đỏ do lỗi code thật → quay lại Bước 3 sửa code (không xoá/nới test); test đỏ do lỗi viết
  test → sửa test.
- **Evidence:** lệnh test + exit code 0 + số liệu (`X tests, X passed`).

### Bước 5 — Review

- **Thực hiện:** agent `backend-reviewer` ∥ agent `frontend-reviewer` ∥ agent `engineering-quality-auditor`
- **Đầu vào:** diff hoàn chỉnh từ Bước 3–4
- **Hành động:** review correctness/kiến trúc/a11y/test coverage theo phía tương ứng; chạy quality/security
  gate qua `engineering-quality-auditor`; validate lại từng finding (đọc `file:line`, loại finding không tái
  lập được).
- **Ràng buộc:** chỉ đọc, không tự sửa code; mọi finding phải có `file:line` + evidence quan sát được.
- **Đầu ra:** danh sách finding theo severity (schema §5.1).
- **Gate:** 0 finding `blocker`; finding `major` đã sửa hoặc được người dùng chấp nhận.
- **Khi fail:** còn finding `blocker` → quay lại Bước 3/4 sửa, review lại phần đã sửa.
- **Evidence:** danh sách finding (severity/category/location/evidence/confidence) + số finding còn lại sau
  khi sửa.

### Bước 6 — Tài liệu

- **Thực hiện:** session chính
- **Đầu vào:** diff cuối cùng đã qua review ở Bước 5
- **Hành động:** rà README/API docs/ADR/`project-knowledge/` bị ảnh hưởng bởi feature; cập nhật nội dung
  tương ứng.
- **Ràng buộc:** không sửa vùng managed block của `AGENTS.md`/`CLAUDE.md`.
- **Đầu ra:** docs cập nhật, hoặc ghi rõ "không ảnh hưởng".
- **Gate:** docs bị ảnh hưởng đã cập nhật hoặc ghi "không ảnh hưởng".
- **Khi fail:** không xác định được docs nào bị ảnh hưởng → hỏi lại người dùng.
- **Evidence:** danh sách file docs đã sửa, hoặc dòng ghi "không ảnh hưởng".

### Bước 7 — Commit ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** diff hoàn chỉnh (code + test + docs) đã qua Bước 1–6
- **Hành động:** tóm tắt thay đổi, đề xuất commit message Conventional Commits (header EN, body VI); trình
  diff cho người dùng duyệt.
- **Ràng buộc:** không tự commit khi người dùng chưa duyệt diff; không push trừ khi được yêu cầu.
- **Đầu ra:** commit đã tạo (sau khi người dùng duyệt).
- **Gate:** người dùng duyệt diff.
- **Khi fail:** người dùng yêu cầu sửa thêm → quay lại bước tương ứng, không commit tạm.
- **Evidence:** hash commit + message.

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 1 | Acceptance criteria + phạm vi BE/FE/fullstack | Người dùng xác nhận acceptance criteria đúng ý |
| 2 | Contract OpenAPI (nếu có) hoặc ghi chú "không có API" | Người dùng xác nhận contract, hoặc đồng ý không cần contract |
| 7 | Diff đầy đủ (code + test + docs) | Người dùng duyệt diff |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Build fail | Chẩn đoán → sửa → build lại |
| Test fail | Phân tích failure → sửa code (không xoá/nới test) → chạy lại |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` | Chặn hoàn thành cho tới khi sửa hoặc người dùng chấp nhận rủi ro |
| Acceptance criteria không đo được (sau Bước 1 ⏸) | Dừng, hỏi lại người dùng, không tự suy diễn |
| Chưa rõ có API hay contract xung đột (sau Bước 2 ⏸) | Dừng, hỏi lại người dùng cách xử lý breaking change |
| Người dùng không duyệt diff (sau Bước 7 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |

- **Điều kiện dừng:** acceptance criteria không đo được sau khi hỏi lại; finding `blocker` không sửa được
  trong phạm vi feature; người dùng không duyệt diff.
- **Rollback:** trước checkpoint commit, chưa có gì để rollback (chưa commit); nếu người dùng huỷ giữa
  chừng, xoá thay đổi chưa commit bằng thao tác git thủ công của người dùng (workflow không tự `reset --hard`).

## Definition of Done

- [ ] Acceptance criteria đo được, có xác nhận người dùng — evidence: Bước 1
- [ ] Contract OpenAPI hợp lệ hoặc ghi rõ không có API — evidence: Bước 2
- [ ] Build xanh cho phần backend/frontend có đụng — evidence: Bước 3
- [ ] Mỗi acceptance criterion có ≥1 test và toàn bộ test pass — evidence: Bước 4
- [ ] Docs bị ảnh hưởng đã cập nhật hoặc ghi "không ảnh hưởng" — evidence: Bước 6
- [ ] Người dùng đã duyệt diff và commit đã tạo — evidence: Bước 7
- [ ] Mọi gate có evidence `passed`
- [ ] 0 finding `blocker`

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
workflow_result:
  workflow: workflow-feature
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
