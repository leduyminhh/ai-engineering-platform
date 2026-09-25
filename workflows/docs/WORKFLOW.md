---
name: workflow-docs
description: "Workflow điều phối cập nhật tài liệu sau thay đổi hành vi công khai: xác định diff, tìm tài liệu bị ảnh hưởng (README, API docs, ADR, runbook, project-knowledge), cập nhật, kiểm link/ví dụ khớp code rồi commit. Dùng workflow NÀY khi người dùng muốn \"cập nhật tài liệu\", \"sync docs\", \"README lỗi thời\", \"viết runbook\" — kể cả khi không nói chính xác chữ \"workflow\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần."
order: 12
title: "Docs — đồng bộ tài liệu theo thay đổi hành vi"
kind: workflow
tier: 3
risk: low
agents: "engineering-spec-analyst"
requires: "core/git-workflow"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Docs — đồng bộ tài liệu theo thay đổi hành vi

## Mục tiêu & đầu vào

- **Mục tiêu:** mọi tài liệu bị ảnh hưởng bởi thay đổi hành vi công khai được cập nhật đúng, link nội bộ và ví
  dụ lệnh khớp code thật, sẵn sàng commit.
- **Đầu vào bắt buộc:** diff hoặc mô tả thay đổi cần đồng bộ tài liệu.
- **Đầu vào tuỳ chọn:** danh sách tài liệu nghi ngờ lỗi thời đã biết trước.

## Điều kiện tiên quyết

- Skill/agent đã cài: `engineering-spec-analyst`, skill `core/git-workflow`.
- Artifact phải có sẵn: diff hoặc mô tả thay đổi hành vi công khai.
- Baseline: không yêu cầu build/test xanh trước — workflow chỉ sửa tài liệu.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Xác định diff

- **Thực hiện:** session chính
- **Đầu vào:** diff hoặc mô tả thay đổi của người dùng
- **Hành động:** đọc diff, liệt kê thay đổi hành vi công khai (API, CLI, cấu hình, quy trình).
- **Ràng buộc:** không tính thay đổi nội bộ không ảnh hưởng người dùng.
- **Đầu ra:** danh sách thay đổi hành vi công khai.
- **Gate:** danh sách thay đổi hành vi công khai.
- **Khi fail:** không xác định được diff → hỏi người dùng phạm vi thay đổi cụ thể.
- **Evidence:** danh sách thay đổi trong report bước.

### Bước 2 — Tài liệu bị ảnh hưởng

- **Thực hiện:** session chính
- **Đầu vào:** danh sách thay đổi từ Bước 1
- **Hành động:** rà README, API docs, ADR, runbook, `project-knowledge/`, `AGENTS.md`/`CLAUDE.md` để tìm file
  cần sửa.
- **Ràng buộc:** không mở rộng rà soát ngoài tài liệu liên quan thay đổi.
- **Đầu ra:** danh sách file docs cần sửa.
- **Gate:** danh sách file docs cần sửa.
- **Khi fail:** không chắc tài liệu nào liên quan → hỏi người dùng xác nhận phạm vi.
- **Evidence:** danh sách file trong report bước.

### Bước 3 — Cập nhật

- **Thực hiện:** agent `engineering-spec-analyst` (ADR/diagram) ∥ session chính (README, runbook)
- **Đầu vào:** danh sách file từ Bước 2
- **Hành động:** sửa nội dung từng file theo đúng thay đổi thật; ghi lý do nếu không sửa.
- **Ràng buộc:** không sửa vùng managed block của `AGENTS.md`/`CLAUDE.md`.
- **Đầu ra:** file docs đã sửa (hoặc lý do không sửa).
- **Gate:** mỗi file đã sửa hoặc ghi lý do không sửa.
- **Khi fail:** nội dung cần đổi nằm trong managed block → dừng, báo người dùng tự sửa qua cơ chế managed-block.
- **Evidence:** danh sách file đã sửa + lý do (nếu có) trong report bước.

### Bước 4 — Kiểm

- **Thực hiện:** session chính
- **Đầu vào:** file docs đã sửa từ Bước 3
- **Hành động:** kiểm link nội bộ còn tồn tại, ví dụ lệnh trong docs khớp code thật.
- **Ràng buộc:** không tự sửa code để khớp docs — chỉ sửa docs để khớp code.
- **Đầu ra:** kết quả kiểm link + lệnh.
- **Gate:** link nội bộ tồn tại; ví dụ lệnh khớp code.
- **Khi fail:** link hỏng hoặc lệnh sai → sửa lại docs, kiểm lại.
- **Evidence:** danh sách link/lệnh đã kiểm + kết quả.

### Bước 5 — Commit ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** docs đã qua Bước 1–4
- **Hành động:** đề xuất commit message Conventional Commits (header EN, body VI); trình diff cho người dùng
  duyệt.
- **Ràng buộc:** không tự commit khi người dùng chưa duyệt diff.
- **Đầu ra:** commit đã tạo (sau khi người dùng duyệt).
- **Gate:** người dùng duyệt diff.
- **Khi fail:** người dùng yêu cầu sửa thêm → quay lại bước tương ứng, không commit tạm.
- **Evidence:** hash commit + message.

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 5 | Diff docs | Người dùng duyệt diff |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Build fail | Chẩn đoán → sửa → build lại |
| Test fail | Phân tích failure → sửa code (không xoá/nới test) → chạy lại |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` | Chặn hoàn thành cho tới khi sửa hoặc người dùng chấp nhận rủi ro |
| Nội dung cần sửa nằm trong managed block của `AGENTS.md`/`CLAUDE.md` (Bước 3) | Dừng, báo người dùng tự sửa qua cơ chế managed-block, không tự đụng vùng đó |
| Link nội bộ hỏng hoặc ví dụ lệnh sai khớp code (Bước 4) | Sửa lại docs, kiểm lại |
| Người dùng không duyệt diff (sau Bước 5 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |

- **Điều kiện dừng:** thay đổi cần thiết nằm trong managed block chưa xử lý được; link/ví dụ lệnh sai chưa sửa
  được; người dùng không duyệt diff.
- **Rollback:** trước checkpoint commit, chưa có gì để rollback ở tầng git; nếu người dùng huỷ giữa chừng, xoá
  thay đổi chưa commit bằng thao tác git thủ công của người dùng.

## Definition of Done

- [ ] Danh sách thay đổi hành vi công khai — evidence: Bước 1
- [ ] Danh sách file docs cần sửa — evidence: Bước 2
- [ ] Mỗi file đã sửa hoặc ghi lý do không sửa; không đụng managed block — evidence: Bước 3
- [ ] Link nội bộ tồn tại; ví dụ lệnh khớp code — evidence: Bước 4
- [ ] Người dùng đã duyệt diff và commit đã tạo — evidence: Bước 5
- [ ] Mọi gate có evidence `passed`

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
workflow_result:
  workflow: workflow-docs
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
