---
name: workflow-incident
description: "Workflow điều phối xử lý sự cố production: triage & blast radius, thu evidence log/metric/trace/deploy, đặt và kiểm chứng giả thuyết, đề xuất mitigation cho người dùng thực hiện (agent không tác động production), xác minh phục hồi, viết RCA/postmortem, rồi commit tài liệu qua git-workflow. Dùng workflow NÀY khi người dùng muốn \"sự cố production\", \"prod down\", \"incident\", \"hệ thống chậm bất thường\", \"alert\" — kể cả khi không nói chính xác chữ \"workflow\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần."
order: 10
title: "Incident — triage, mitigation, phục hồi, RCA"
kind: workflow
tier: 1
risk: critical
agents: "ops-incident-investigator,engineering-spec-analyst"
requires: "core/git-workflow"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Incident — triage, mitigation, phục hồi, RCA

## Mục tiêu & đầu vào

- **Mục tiêu:** xử lý một sự cố production theo đúng quy trình: xác định mức độ & phạm vi ảnh hưởng, thu
  evidence, kiểm chứng giả thuyết bằng evidence, để người dùng thực hiện mitigation (agent không tự tác động
  production), xác minh hệ thống phục hồi, và viết RCA/postmortem đầy đủ để commit làm tài liệu.
- **Đầu vào bắt buộc:** mô tả sự cố (alert, báo cáo người dùng, hoặc log/metric bất thường) + thời điểm phát
  hiện.
- **Đầu vào tuỳ chọn:** dashboard/metric có sẵn, lịch sử deploy gần đây, runbook incident cũ liên quan.

## Điều kiện tiên quyết

- Skill/agent đã cài: `ops-incident-investigator`, `engineering-spec-analyst`, skill `core/git-workflow`.
- Artifact phải có sẵn: quyền truy cập log/metric/trace của hệ thống production (đọc), lịch sử deploy gần
  đây.
- Baseline: không yêu cầu build/test xanh trước — sự cố có thể xảy ra bất kể trạng thái build/test của
  repo; workflow tập trung vào observability và mitigation trước.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Triage & blast radius

- **Thực hiện:** agent `ops-incident-investigator`
- **Đầu vào:** mô tả sự cố + thời điểm phát hiện của người dùng
- **Hành động:** xác định mức độ nghiêm trọng (severity) theo thang của project; xác định phạm vi ảnh hưởng
  (service/khách hàng/khu vực) và thời điểm bắt đầu ước tính dựa trên log/metric.
- **Ràng buộc:** không hạ thấp mức độ nghiêm trọng khi chưa đủ evidence; không suy đoán thời điểm bắt đầu
  nếu không có log/metric hỗ trợ — ghi rõ "chưa xác định" nếu vậy.
- **Đầu ra:** mức độ nghiêm trọng + phạm vi ảnh hưởng + thời điểm bắt đầu (hoặc "chưa xác định").
- **Gate:** mức độ, phạm vi ảnh hưởng, thời điểm bắt đầu.
- **Khi fail:** không xác định được phạm vi ảnh hưởng tối thiểu → hỏi lại người dùng thông tin truy cập
  log/metric cần thiết.
- **Evidence:** đoạn ghi mức độ + phạm vi + thời điểm bắt đầu trong report bước.

### Bước 2 — Thu evidence

- **Thực hiện:** agent `ops-incident-investigator`
- **Đầu vào:** phạm vi ảnh hưởng + thời điểm bắt đầu từ Bước 1
- **Hành động:** thu log/metric/trace quanh thời điểm bắt đầu sự cố; đối chiếu với lịch sử deploy gần đây để
  xác định có deploy nào trùng thời điểm không.
- **Ràng buộc:** không bỏ qua log gây khó hiểu; không suy diễn khi chưa có evidence hỗ trợ.
- **Đầu ra:** tập evidence log/metric/trace/deploy liên quan, có timestamp.
- **Gate:** evidence log/metric/trace/deploy liên quan.
- **Khi fail:** không truy cập được log/metric cần thiết → hỏi người dùng cấp quyền truy cập hoặc cung cấp
  export thủ công.
- **Evidence:** trích đoạn log/metric/trace/deploy kèm timestamp trong report bước.

### Bước 3 — Giả thuyết & kiểm chứng

- **Thực hiện:** agent `ops-incident-investigator`
- **Đầu vào:** evidence từ Bước 2
- **Hành động:** đặt ≥1 giả thuyết nguyên nhân dựa trên evidence; kiểm chứng từng giả thuyết bằng cách đối
  chiếu thêm evidence (không đoán mò), loại giả thuyết không khớp.
- **Ràng buộc:** không kết luận giả thuyết khi evidence chưa đủ khớp; không dừng ở giả thuyết đầu tiên nếu
  evidence còn mâu thuẫn.
- **Đầu ra:** ≥1 giả thuyết được kiểm chứng bằng evidence, kèm giả thuyết đã loại và lý do.
- **Gate:** ≥1 giả thuyết được kiểm chứng bằng evidence.
- **Khi fail:** không giả thuyết nào khớp evidence hiện có → quay lại Bước 2 thu thêm evidence.
- **Evidence:** giả thuyết + evidence đối chiếu tương ứng trong report bước.

### Bước 4 — Đề xuất mitigation ⏸

- **Thực hiện:** session chính
- **Đầu vào:** giả thuyết đã kiểm chứng từ Bước 3
- **Hành động:** đề xuất ≥1 phương án mitigation (rollback deploy, scale, tắt feature flag…) kèm rủi ro của
  từng phương án; trình cho người dùng chọn và tự thực hiện trên production.
- **Ràng buộc:** không agent nào tự thực hiện thao tác tác động production (rollback/scale/restart…) — chỉ đề
  xuất; người dùng là người thực hiện.
- **Đầu ra:** phương án mitigation người dùng đã chọn và (báo) đã thực hiện.
- **Gate:** người dùng chọn/thực hiện mitigation; không agent nào tác động production.
- **Khi fail:** người dùng chưa chọn được phương án → dừng, chờ xác nhận, không tự đề xuất mặc định rồi thực
  hiện thay.
- **Evidence:** phương án mitigation đã chọn + xác nhận của người dùng đã thực hiện.

### Bước 5 — Xác minh phục hồi

- **Thực hiện:** agent `ops-incident-investigator`
- **Đầu vào:** mitigation đã thực hiện từ Bước 4
- **Hành động:** theo dõi metric/health check liên quan sau khi mitigation được thực hiện; đối chiếu với
  ngưỡng bình thường trước sự cố (từ Bước 1–2) để xác nhận đã phục hồi.
- **Ràng buộc:** không kết luận phục hồi khi metric mới chỉ cải thiện một phần; theo dõi đủ thời gian để loại
  trừ giả phục hồi tạm thời.
- **Đầu ra:** xác nhận metric/health đã về ngưỡng bình thường, kèm số liệu.
- **Gate:** metric/health về ngưỡng bình thường.
- **Khi fail:** metric chưa về bình thường sau mitigation → quay lại Bước 4 đề xuất phương án khác.
- **Evidence:** số liệu metric/health trước và sau mitigation, kèm timestamp xác nhận phục hồi.

### Bước 6 — RCA & postmortem

- **Thực hiện:** agent `engineering-spec-analyst`
- **Đầu vào:** toàn bộ evidence, giả thuyết đã kiểm chứng, mitigation và xác nhận phục hồi từ Bước 1–5
- **Hành động:** viết postmortem đầy đủ (summary, timeline, impact, root_cause, mitigation, prevention); đề
  xuất hành động phòng ngừa tái diễn cụ thể, có chủ sở hữu/hướng xử lý gợi ý.
- **Ràng buộc:** root_cause phải khớp giả thuyết đã kiểm chứng ở Bước 3, không suy diễn thêm nguyên nhân
  chưa có evidence; không bỏ trống bất kỳ trường nào của khối `incident`.
- **Đầu ra:** khối `incident` đầy đủ 6 trường (summary, timeline, impact, root_cause, mitigation, prevention).
- **Gate:** khối `incident` đủ: summary, timeline, impact, root_cause, mitigation, prevention.
- **Khi fail:** thiếu evidence để điền một trường (vd `root_cause` chưa chắc chắn) → ghi rõ mức độ tin cậy
  thấp trong trường đó, không bỏ trống, không bịa.
- **Evidence:** khối `incident` đầy đủ trong report bước.

### Bước 7 — Commit tài liệu ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** postmortem hoàn chỉnh từ Bước 6
- **Hành động:** đề xuất commit message Conventional Commits cho tài liệu postmortem (header EN, body VI);
  trình diff tài liệu cho người dùng duyệt; gợi ý `next_actions` chạy `workflow-bugfix` nếu prevention cần
  sửa code.
- **Ràng buộc:** không tự commit khi người dùng chưa duyệt diff; không push trừ khi được yêu cầu; không commit
  thay đổi code (chỉ tài liệu) trong workflow này.
- **Đầu ra:** commit tài liệu postmortem đã tạo (sau khi người dùng duyệt).
- **Gate:** người dùng duyệt diff; `next_actions` gợi ý `workflow-bugfix`.
- **Khi fail:** người dùng yêu cầu sửa thêm nội dung postmortem → quay lại Bước 6, không commit tạm.
- **Evidence:** hash commit + message.

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 4 | Các phương án mitigation + rủi ro từng phương án | Người dùng chọn và tự thực hiện mitigation trên production |
| 7 | Diff tài liệu postmortem hoàn chỉnh | Người dùng duyệt diff |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit, không tự tác động
production.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Build fail | Không áp dụng ở giai đoạn triage/mitigation; nếu prevention (Bước 6) cần sửa code, xử lý ở `workflow-bugfix` kế tiếp |
| Test fail | Như trên — workflow này không tự sửa code |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` | Không áp dụng — workflow này không chạy code review; rủi ro production xử lý ở Bước 4 |
| Cấm: agent tự thực hiện thao tác tác động production (Bước 4) | Từ chối thực hiện, chỉ đề xuất; yêu cầu người dùng tự thực hiện |
| Không giả thuyết nào khớp evidence (Bước 3) | Quay lại Bước 2 thu thêm evidence |
| Metric chưa về bình thường sau mitigation (Bước 5) | Quay lại Bước 4 đề xuất phương án khác |
| Người dùng không duyệt diff postmortem (sau Bước 7 ⏸) | Không commit, quay lại Bước 6 sửa theo yêu cầu |

- **Điều kiện dừng:** không xác định được phạm vi ảnh hưởng tối thiểu; không thu được evidence cần thiết;
  không giả thuyết nào khớp evidence sau nhiều vòng; metric không phục hồi sau nhiều phương án mitigation;
  người dùng không duyệt diff postmortem.
- **Rollback:** workflow không tự thực hiện thao tác trên production nên không có gì để agent rollback ở tầng
  hệ thống; rollback hệ thống (nếu mitigation là rollback deploy) do người dùng tự thực hiện theo quy trình
  vận hành hiện có. Ở tầng tài liệu, trước checkpoint commit chưa có gì để rollback (chưa commit).

## Definition of Done

- [ ] Mức độ, phạm vi ảnh hưởng, thời điểm bắt đầu đã xác định — evidence: Bước 1
- [ ] Evidence log/metric/trace/deploy liên quan đã thu thập — evidence: Bước 2
- [ ] ≥1 giả thuyết được kiểm chứng bằng evidence — evidence: Bước 3
- [ ] Người dùng đã chọn và thực hiện mitigation — evidence: Bước 4
- [ ] Metric/health đã xác nhận về ngưỡng bình thường — evidence: Bước 5
- [ ] Khối `incident` đầy đủ 6 trường — evidence: Bước 6
- [ ] Người dùng đã duyệt diff và commit tài liệu đã tạo — evidence: Bước 7
- [ ] Mọi gate có evidence `passed`
- [ ] Không agent nào tự tác động production trong toàn bộ workflow

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
workflow_result:
  workflow: workflow-incident
  status: completed        # completed | failed | blocked
  summary: "<1–3 câu>"
  changes: { added: [], modified: [], deleted: [] }
  validation:
    - command: "<lệnh>"
      exit_code: 0
      status: not_run
      summary: ""
      reason: "workflow tập trung triage/mitigation/RCA, không build/test code"
  findings: []             # severity, category, location, evidence, impact, recommendation, confidence
  remaining_risks: []
  docs_updated: []
  next_actions: ["workflow-bugfix"]
  incident:
    summary: "<1–3 câu>"
    timeline: []            # {time, event}
    impact: "<phạm vi & mức độ ảnh hưởng>"
    root_cause: "<nguyên nhân gốc khớp evidence>"
    mitigation: "<phương án đã thực hiện>"
    prevention: []          # hành động phòng ngừa tái diễn
```
