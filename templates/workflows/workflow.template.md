---
name: workflow-<slug>
description: "Workflow điều phối <mục tiêu> cho <vai>: <chuỗi bước rút gọn>. Dùng workflow NÀY khi người dùng muốn \"<trigger 1>\", \"<trigger 2>\" — kể cả khi không nói chính xác chữ \"workflow\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần."
order: <n>
title: "<Tiêu đề workflow>"
kind: workflow
tier: <1|2|3>
risk: <low|medium|high|critical>
agents: "<plugin>-<agent>,<plugin>-<agent>"
requires: "<plugin>/<skill>,<plugin>/<skill>"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# <Tiêu đề workflow>

## Mục tiêu & đầu vào

- **Mục tiêu:** <kết quả đo được khi workflow hoàn thành>
- **Đầu vào bắt buộc:** <requirement / contract / diff / …>
- **Đầu vào tuỳ chọn:** <…>

## Điều kiện tiên quyết

- Skill/agent đã cài: <danh sách, khớp `agents` + `requires`>
- Artifact phải có sẵn: <vd `project-knowledge/architecture.md`, `docs/contracts/…`>
- Baseline: <vd build/test hiện tại XANH>

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.
Không có subagent → session chính chạy tuần tự skill tương ứng.

### Bước 1 — <Tên bước>

- **Thực hiện:** agent `<plugin>-<agent>` | skill `<plugin-skill>` | session chính
- **Đầu vào:** <artifact từ bước trước / đầu vào workflow>
- **Hành động:** <việc cụ thể phải làm>
- **Ràng buộc:** <phạm vi được sửa, điều cấm>
- **Đầu ra:** <artifact / file / report>
- **Gate:** <điều kiện kiểm chứng được để qua bước>
- **Khi fail:** <chẩn đoán → sửa → chạy lại | hỏi lại người dùng | dừng workflow>
- **Evidence:** <lệnh + exit code / file:line / artifact chứng minh gate>

### Bước 2 — <Tên bước> ⏸

- **Thực hiện:** …
- **Đầu vào:** …
- **Hành động:** …
- **Ràng buộc:** …
- **Đầu ra:** …
- **Gate:** …
- **Khi fail:** …
- **Evidence:** …

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| <n> | <diff / contract / report> | <người dùng xác nhận rõ ràng> |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Build fail | Chẩn đoán → sửa → build lại |
| Test fail | Phân tích failure → sửa code (không xoá/nới test) → chạy lại |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` | Chặn hoàn thành cho tới khi sửa hoặc người dùng chấp nhận rủi ro |

- **Điều kiện dừng:** <khi nào dừng hẳn và báo `blocked`>
- **Rollback:** <cách hoàn tác thay đổi của workflow>

## Definition of Done

- [ ] <tiêu chí> — evidence: <lệnh / artifact>
- [ ] Mọi gate có evidence `passed`
- [ ] Review không còn finding `blocker`

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
workflow_result:
  workflow: workflow-<slug>
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
