---
name: workflow-refactor
description: "Workflow điều phối refactor mã nguồn (đổi code hoặc đổi kiểu kiến trúc) mà giữ nguyên hành vi quan sát được: chọn chế độ & phạm vi, ADR khi đổi kiến trúc, baseline xanh, characterization test khoá hành vi, refactor từng bước nhỏ luôn xanh, so hành vi, review đa vai trò, rồi commit theo lô qua git-workflow. Dùng workflow NÀY khi người dùng muốn \"refactor\", \"tái cấu trúc\", \"dọn code\", \"đổi kiến trúc\", \"chuyển sang Hexagonal/FSD\" — kể cả khi không nói chính xác chữ \"workflow\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần."
order: 3
title: "Refactor — đổi code/kiến trúc giữ nguyên hành vi"
kind: workflow
tier: 1
risk: medium
agents: "backend-test-writer,frontend-test-writer,backend-reviewer,frontend-reviewer,engineering-spec-analyst,engineering-quality-auditor"
requires: "backend/backend-refactor,frontend/frontend-refactor,backend/backend-migrate-architecture,frontend/frontend-migrate-architecture,core/git-workflow"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Refactor — đổi code/kiến trúc giữ nguyên hành vi

## Mục tiêu & đầu vào

- **Mục tiêu:** cải thiện cấu trúc code (hoặc đổi kiểu kiến trúc) mà không đổi hành vi quan sát được, có
  characterization test khoá hành vi trước khi sửa, xanh sau mỗi bước nhỏ, đã qua review, sẵn sàng để người
  dùng duyệt diff và commit theo lô.
- **Đầu vào bắt buộc:** mô tả phạm vi cần refactor (module/service/component) + lý do (giảm trùng lặp, gỡ god
  class, đổi kiến trúc…).
- **Đầu vào tuỳ chọn:** ADR/ghi chú kiến trúc có sẵn, test coverage report hiện tại của vùng đụng.

## Điều kiện tiên quyết

- Skill/agent đã cài: `backend-test-writer`, `frontend-test-writer`, `backend-reviewer`, `frontend-reviewer`,
  `engineering-spec-analyst`, `engineering-quality-auditor`, skill `backend/backend-refactor`,
  `frontend/frontend-refactor`, `backend/backend-migrate-architecture`,
  `frontend/frontend-migrate-architecture`, `core/git-workflow`.
- Artifact phải có sẵn: `project-knowledge/architecture.md` của phía có đụng, để xác định boundary/Dependency
  Rule đang áp dụng.
- Baseline: build/test/lint hiện tại của vùng đụng đang XANH trước khi bắt đầu refactor.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Chọn chế độ & phạm vi

- **Thực hiện:** session chính
- **Đầu vào:** mô tả phạm vi + lý do refactor của người dùng
- **Hành động:** xác định chế độ `code` (không đổi kiểu kiến trúc) hay `architecture` (đổi kiểu kiến trúc,
  vd Onion → Hexagonal); và viết rõ invariant hành vi phải giữ nguyên (API công khai, output quan sát được).
- **Ràng buộc:** không tự suy diễn chế độ khi người dùng mô tả mơ hồ; không mở rộng phạm vi ngoài module/service
  được nêu.
- **Đầu ra:** chế độ `code`/`architecture` + invariant hành vi ghi rõ trong report bước.
- **Gate:** chế độ `code` \| `architecture` + invariant hành vi ghi rõ.
- **Khi fail:** người dùng không phân biệt được chế độ hoặc invariant chưa rõ → hỏi lại, không tự suy diễn tiếp.
- **Evidence:** đoạn ghi chế độ + invariant hành vi trong report bước.

### Bước 2 — ADR ⏸

- **Thực hiện:** agent `engineering-spec-analyst` (chỉ chế độ `architecture`; chế độ `code` ghi "N/A")
- **Đầu vào:** chế độ + phạm vi từ Bước 1
- **Hành động:** nếu chế độ `architecture`, viết ADR mô tả kiến trúc đích + lý do đổi + rủi ro; trình cho
  người dùng chấp nhận trước khi baseline. Chế độ `code` bỏ qua, ghi rõ "N/A" trong report.
- **Ràng buộc:** không tự chọn kiến trúc đích khi chưa hỏi người dùng; không bắt đầu di chuyển file khi ADR
  chưa được chấp nhận.
- **Đầu ra:** ADR đã ghi (chế độ `architecture`), hoặc dòng "N/A" (chế độ `code`).
- **Gate:** ADR được người dùng chấp nhận (hoặc "N/A" hợp lệ ở chế độ `code`).
- **Khi fail:** người dùng không chấp nhận ADR → quay lại Bước 1 làm rõ lại đích kiến trúc, hoặc hỏi thêm
  ràng buộc.
- **Evidence:** đường dẫn ADR + xác nhận của người dùng, hoặc dòng "N/A".

### Bước 3 — Baseline

- **Thực hiện:** session chính
- **Đầu vào:** phạm vi đã chốt từ Bước 1–2
- **Hành động:** chạy build, test và lint hiện tại của vùng đụng; ghi lại số liệu (số test, số lỗi lint) làm
  mốc so sánh trước khi sửa.
- **Ràng buộc:** không bắt đầu refactor khi baseline chưa xanh; không sửa bất kỳ file production nào ở bước
  này.
- **Đầu ra:** kết quả build/test/lint baseline xanh, kèm số liệu mốc.
- **Gate:** build/test/lint xanh trước khi đổi.
- **Khi fail:** baseline đỏ vì lỗi có sẵn (không liên quan refactor) → dừng, báo người dùng cần xử lý baseline
  trước; không tự sửa lỗi ngoài phạm vi.
- **Evidence:** lệnh build/test/lint + exit code 0 + số liệu mốc (`X tests, X passed`).

### Bước 4 — Characterization test

- **Thực hiện:** agent `backend-test-writer` ∥ agent `frontend-test-writer` (phía có vùng đụng)
- **Đầu vào:** baseline từ Bước 3 + phạm vi từ Bước 1
- **Hành động:** rà coverage hiện tại của vùng đụng; viết characterization test khoá hành vi quan sát được ở
  những chỗ chưa có test, rồi chạy để xác nhận xanh trước khi refactor.
- **Ràng buộc:** không viết test phụ thuộc chi tiết cài đặt sẽ đổi (test theo hành vi/output, không theo cấu
  trúc nội bộ); không sửa code production ở bước này.
- **Đầu ra:** characterization test mới cho vùng đụng, chạy xanh.
- **Gate:** vùng đụng có test khoá hành vi, xanh.
- **Khi fail:** không viết được test khoá hành vi (hành vi phụ thuộc trạng thái ẩn phức tạp) → hỏi người dùng
  cách quan sát hành vi thay thế, hoặc thu hẹp phạm vi refactor.
- **Evidence:** lệnh test + exit code 0 + danh sách characterization test mới.

### Bước 5 — Refactor từng bước

- **Thực hiện:** skill `backend-refactor` \| skill `frontend-refactor` \| skill `backend-migrate-architecture`
  \| skill `frontend-migrate-architecture` (theo chế độ Bước 1 và phía có vùng đụng)
- **Đầu vào:** characterization test từ Bước 4; ADR từ Bước 2 (nếu chế độ `architecture`)
- **Hành động:** thực hiện từng bước refactor nhỏ (extract method/class, đảo phụ thuộc, di chuyển file theo
  template kiến trúc đích…); chạy lại test + build sau MỖI bước nhỏ trước khi sang bước tiếp theo.
- **Ràng buộc:** tôn trọng Dependency Rule/boundary của kiến trúc đã chốt; áp design pattern lớn chỉ khi gỡ
  được phức tạp thật, hỏi người dùng trước khi áp; không gộp nhiều bước lớn thành một lần sửa không kiểm
  chứng được.
- **Đầu ra:** code đã refactor, mỗi bước nhỏ đều xanh.
- **Gate:** xanh sau mỗi bước nhỏ.
- **Khi fail:** một bước nhỏ làm test/build đỏ → lùi lại bước nhỏ đó, sửa hoặc chia nhỏ hơn, không tiếp tục
  khi chưa xanh.
- **Evidence:** lệnh build/test sau mỗi bước nhỏ + exit code 0 (log từng lượt).

### Bước 6 — So hành vi

- **Thực hiện:** session chính
- **Đầu vào:** code đã refactor từ Bước 5 + số liệu mốc từ Bước 3
- **Hành động:** chạy toàn bộ test suite của vùng đụng; đối chiếu API công khai (endpoint/props/signature)
  trước và sau để xác nhận không đổi ngoài phạm vi đã chốt ở Bước 1.
- **Ràng buộc:** không đổi API công khai ngoài phạm vi đã xác nhận; không nới/xoá test để qua bước này.
- **Đầu ra:** báo cáo toàn bộ test xanh + xác nhận API công khai không đổi ngoài phạm vi.
- **Gate:** toàn bộ test xanh; không đổi API công khai ngoài phạm vi.
- **Khi fail:** phát hiện đổi API công khai ngoài phạm vi → quay lại Bước 5 điều chỉnh, hoặc xin người dùng
  mở rộng phạm vi đã xác nhận.
- **Evidence:** lệnh chạy toàn bộ test suite + exit code 0 + danh sách đối chiếu API công khai.

### Bước 7 — Review

- **Thực hiện:** agent `backend-reviewer` ∥ agent `frontend-reviewer` ∥ agent `engineering-quality-auditor`
- **Đầu vào:** diff refactor hoàn chỉnh từ Bước 5–6
- **Hành động:** review correctness/thiết kế theo trục backend-code-review/frontend-code-review; ở chế độ
  `architecture`, kiểm thêm boundary/Dependency Rule của kiến trúc đích không bị vi phạm; validate lại từng
  finding trước khi báo.
- **Ràng buộc:** chỉ đọc, không tự sửa code.
- **Đầu ra:** danh sách finding theo severity (schema §5.1).
- **Gate:** 0 finding `blocker`; chế độ `architecture`: không vi phạm boundary.
- **Khi fail:** còn finding `blocker` hoặc vi phạm boundary → quay lại Bước 5 sửa, review lại phần đã sửa.
- **Evidence:** danh sách finding (severity/category/location/evidence/confidence).

### Bước 8 — Commit theo lô ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** diff refactor hoàn chỉnh (code + test) đã qua Bước 1–7
- **Hành động:** chia diff thành từng lô hợp lý (theo bước refactor nhỏ hoặc theo module); đề xuất commit
  message Conventional Commits cho từng lô (header EN, body VI); trình từng lô cho người dùng duyệt.
- **Ràng buộc:** không tự commit khi người dùng chưa duyệt diff của lô đó; không push trừ khi được yêu cầu.
- **Đầu ra:** commit đã tạo cho từng lô (sau khi người dùng duyệt).
- **Gate:** người dùng duyệt diff từng lô.
- **Khi fail:** người dùng yêu cầu sửa thêm ở một lô → quay lại bước tương ứng, không commit lô đó tạm.
- **Evidence:** hash commit + message cho từng lô.

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 2 | ADR kiến trúc đích + rủi ro (chế độ `architecture`) | Người dùng chấp nhận ADR |
| 8 | Diff refactor hoàn chỉnh từng lô (code + test) | Người dùng duyệt diff từng lô |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Build fail | Chẩn đoán → sửa → build lại |
| Test fail | Phân tích failure → sửa code (không xoá/nới test) → chạy lại |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` | Chặn hoàn thành cho tới khi sửa hoặc người dùng chấp nhận rủi ro |
| Người dùng không chấp nhận ADR (sau Bước 2 ⏸) | Quay lại Bước 1 làm rõ lại đích kiến trúc/ràng buộc |
| Baseline đỏ trước khi refactor (Bước 3) | Dừng, báo người dùng xử lý lỗi có sẵn trước, không tự sửa ngoài phạm vi |
| Một bước nhỏ ở Bước 5 làm đỏ test/build | Lùi lại bước nhỏ đó, chia nhỏ hơn hoặc sửa, không tiếp tục khi chưa xanh |
| Đổi API công khai ngoài phạm vi (Bước 6) | Quay lại Bước 5 điều chỉnh, hoặc xin người dùng mở rộng phạm vi |
| Vi phạm boundary/Dependency Rule (chế độ `architecture`, Bước 7) | Chặn hoàn thành, quay lại Bước 5 sửa đúng boundary |
| Người dùng không duyệt diff một lô (sau Bước 8 ⏸) | Không commit lô đó, quay lại bước người dùng yêu cầu sửa |

- **Điều kiện dừng:** ADR không được chấp nhận sau nhiều vòng; baseline không xanh được; một bước nhỏ liên
  tục đỏ không sửa được trong phạm vi refactor; finding `blocker` hoặc vi phạm boundary không sửa được;
  người dùng không duyệt diff.
- **Rollback:** mỗi bước nhỏ ở Bước 5 chỉ tiến khi xanh, nên có thể lùi về bước nhỏ liền trước; trước
  checkpoint commit theo lô, lô nào chưa được duyệt thì chưa commit — không có gì để rollback ở lô đó; nếu
  người dùng huỷ giữa chừng, xoá thay đổi chưa commit bằng thao tác git thủ công của người dùng (workflow
  không tự `reset --hard`).

## Definition of Done

- [ ] Chế độ `code`/`architecture` + invariant hành vi ghi rõ — evidence: Bước 1
- [ ] ADR được chấp nhận (chế độ `architecture`) hoặc "N/A" (chế độ `code`) — evidence: Bước 2
- [ ] Baseline build/test/lint xanh trước khi đổi — evidence: Bước 3
- [ ] Vùng đụng có characterization test khoá hành vi, xanh — evidence: Bước 4
- [ ] Mỗi bước refactor nhỏ đều xanh — evidence: Bước 5
- [ ] Toàn bộ test xanh, API công khai không đổi ngoài phạm vi — evidence: Bước 6
- [ ] Người dùng đã duyệt diff và commit đã tạo cho từng lô — evidence: Bước 8
- [ ] Mọi gate có evidence `passed`
- [ ] 0 finding `blocker`

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
workflow_result:
  workflow: workflow-refactor
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
