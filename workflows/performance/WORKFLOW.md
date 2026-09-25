---
name: workflow-performance
description: "Workflow điều phối tối ưu hiệu năng: xác định metric + ngưỡng mục tiêu, đo baseline, profile tìm bottleneck có evidence, tối ưu, benchmark so sánh trước/sau cùng điều kiện, review rồi commit. Dùng workflow NÀY khi người dùng muốn \"chậm\", \"tối ưu hiệu năng\", \"performance\", \"latency\" — kể cả khi không nói chính xác chữ \"workflow\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần."
order: 9
title: "Performance — profile, tối ưu, benchmark trước/sau"
kind: workflow
tier: 3
risk: medium
agents: "backend-reviewer"
requires: "core/git-workflow"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Performance — profile, tối ưu, benchmark trước/sau

## Mục tiêu & đầu vào

- **Mục tiêu:** cải thiện metric hiệu năng đã chọn, có số đo trước/sau trên cùng điều kiện chứng minh mức cải
  thiện (hoặc không đạt), build/test vẫn xanh.
- **Đầu vào bắt buộc:** mô tả vấn đề hiệu năng (chỗ nào chậm, khi nào).
- **Đầu vào tuỳ chọn:** số đo/monitoring hiện có, ngưỡng SLA đã thống nhất trước đó.

## Điều kiện tiên quyết

- Skill/agent đã cài: `backend-reviewer`, skill `core/git-workflow`.
- Artifact phải có sẵn: không bắt buộc, ngoài mô tả vấn đề của người dùng.
- Baseline: build/test hiện tại của vùng đụng đang XANH trước khi tối ưu.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Metric & mục tiêu

- **Thực hiện:** session chính
- **Đầu vào:** mô tả vấn đề hiệu năng của người dùng
- **Hành động:** chọn metric đo (latency/throughput/memory/…) và ngưỡng mục tiêu cần đạt.
- **Ràng buộc:** không bắt đầu tối ưu khi chưa có metric + ngưỡng cụ thể.
- **Đầu ra:** metric + ngưỡng mục tiêu.
- **Gate:** metric + ngưỡng + điều kiện đo.
- **Khi fail:** người dùng chưa nêu rõ mục tiêu → hỏi lại ngưỡng cụ thể.
- **Evidence:** metric + ngưỡng ghi trong report bước.

### Bước 2 — Baseline

- **Thực hiện:** session chính
- **Đầu vào:** metric từ Bước 1
- **Hành động:** đo baseline hiện tại đúng môi trường/tải/dữ liệu đã chọn.
- **Ràng buộc:** không đổi code trước khi có baseline.
- **Đầu ra:** số đo baseline.
- **Gate:** số đo baseline có lệnh + môi trường.
- **Khi fail:** không đo được → hỏi công cụ/môi trường đo, không tự chọn thay.
- **Evidence:** lệnh đo + kết quả baseline.

### Bước 3 — Profile & giả thuyết ⏸

- **Thực hiện:** session chính
- **Đầu vào:** baseline từ Bước 2
- **Hành động:** profile để tìm bottleneck, nêu giả thuyết nguyên nhân kèm evidence, trình người dùng xác nhận
  hướng tối ưu.
- **Ràng buộc:** không tối ưu khi giả thuyết chưa có evidence.
- **Đầu ra:** bottleneck + giả thuyết đã xác nhận.
- **Gate:** bottleneck có evidence.
- **Khi fail:** người dùng không đồng ý hướng tối ưu → profile lại hoặc thu thêm evidence.
- **Evidence:** kết quả profile (file:line hoặc số đo) trong report bước.

### Bước 4 — Tối ưu

- **Thực hiện:** session chính
- **Đầu vào:** giả thuyết đã xác nhận từ Bước 3
- **Hành động:** áp thay đổi theo giả thuyết, chạy build/test sau mỗi thay đổi.
- **Ràng buộc:** không tối ưu ngoài bottleneck đã xác nhận.
- **Đầu ra:** code đã tối ưu, build/test xanh.
- **Gate:** build/test xanh.
- **Khi fail:** build/test đỏ → sửa hoặc revert thay đổi, không giữ thay đổi đỏ.
- **Evidence:** lệnh build/test + exit code.

### Bước 5 — Benchmark & so sánh

- **Thực hiện:** session chính
- **Đầu vào:** code đã tối ưu từ Bước 4
- **Hành động:** đo lại đúng điều kiện Bước 2, so với baseline, kết luận đạt hay không đạt ngưỡng.
- **Ràng buộc:** không so sánh số đo khác điều kiện với baseline.
- **Đầu ra:** số đo sau + kết luận đạt/không đạt.
- **Gate:** số đo sau cùng điều kiện; đạt ngưỡng hoặc báo không đạt.
- **Khi fail:** không đạt ngưỡng → báo rõ, quay lại Bước 3 tìm hướng khác hoặc dừng theo quyết định người dùng.
- **Evidence:** bảng baseline vs sau + lệnh đo.

### Bước 6 — Review

- **Thực hiện:** agent `backend-reviewer`
- **Đầu vào:** code đã tối ưu + số đo từ Bước 5
- **Hành động:** review thay đổi theo trục correctness/performance, trả finding.
- **Ràng buộc:** chỉ đọc, không tự sửa code.
- **Đầu ra:** danh sách finding.
- **Gate:** 0 finding blocker.
- **Khi fail:** có finding `blocker` → quay lại Bước 4 sửa, review lại.
- **Evidence:** danh sách finding trong report bước.

### Bước 7 — Commit ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** code đã tối ưu đã qua Bước 1–6
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
| 3 | Bottleneck + giả thuyết kèm evidence | Người dùng xác nhận hướng tối ưu |
| 7 | Diff | Người dùng duyệt diff |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Build fail | Chẩn đoán → sửa → build lại |
| Test fail | Phân tích failure → sửa code (không xoá/nới test) → chạy lại |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` (Bước 6) | Quay lại Bước 4 sửa, review lại |
| Không có số đo trước/sau trên cùng điều kiện | Dừng `blocked`, không kết luận về hiệu năng |
| Người dùng không đồng ý hướng tối ưu (sau Bước 3 ⏸) | Profile lại hoặc thu thêm evidence |
| Không đạt ngưỡng mục tiêu (Bước 5) | Báo rõ, quay lại Bước 3 tìm hướng khác hoặc dừng theo quyết định người dùng |
| Người dùng không duyệt diff (sau Bước 7 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |

- **Điều kiện dừng:** không có số đo trước/sau cùng điều kiện; người dùng không đồng ý hướng tối ưu sau nhiều
  vòng; finding `blocker` không sửa được; người dùng không duyệt diff.
- **Rollback:** trước checkpoint commit, revert thay đổi tối ưu bằng git thủ công của người dùng nếu benchmark
  không đạt; sau khi commit, rollback thuộc trách nhiệm người dùng.

## Definition of Done

- [ ] Metric + ngưỡng mục tiêu — evidence: Bước 1
- [ ] Baseline đo đúng điều kiện — evidence: Bước 2
- [ ] Bottleneck có evidence, người dùng xác nhận hướng tối ưu — evidence: Bước 3
- [ ] Build/test xanh sau tối ưu — evidence: Bước 4
- [ ] Số đo sau cùng điều kiện với baseline, đạt hoặc báo không đạt ngưỡng — evidence: Bước 5
- [ ] 0 finding `blocker` — evidence: Bước 6
- [ ] Người dùng đã duyệt diff và commit đã tạo — evidence: Bước 7
- [ ] Mọi gate có evidence `passed`
- [ ] Không có số đo trước/sau cùng điều kiện → không được `completed`

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
workflow_result:
  workflow: workflow-performance
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
