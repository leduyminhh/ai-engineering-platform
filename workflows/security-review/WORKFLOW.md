---
name: workflow-security-review
description: "Workflow điều phối review bảo mật: xác định phạm vi & threat model, review/scan theo OWASP và các vùng rủi ro (auth/session, authorization/access control, input, SSRF, crypto/secrets, dependency, misconfiguration, logging), validate finding bằng đọc lại file:line, lập kế hoạch remediation cùng người dùng, thu hồi (rotate) secret bị lộ do người dùng thực hiện, viết regression test tái hiện lỗ hổng, sửa, re-scan xác nhận hết blocker, rồi commit qua git-workflow. Dùng workflow NÀY khi người dùng muốn \"security review\", \"review bảo mật\", \"quét lỗ hổng\", \"OWASP\", \"kiểm secret\" — kể cả khi không nói chính xác chữ \"workflow\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần."
order: 6
title: "Security review — threat model, scan, remediation, re-scan"
kind: workflow
tier: 1
risk: high
agents: "engineering-quality-auditor,backend-test-writer,frontend-test-writer,backend-fixer,frontend-fixer"
requires: "core/git-workflow"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Security review — threat model, scan, remediation, re-scan

## Mục tiêu & đầu vào

- **Mục tiêu:** rà soát bảo mật một phạm vi code theo threat model rõ ràng, phát hiện và validate finding
  thật (không false positive), remediation được người dùng chọn, secret bị lộ được người dùng rotate, lỗ hổng
  có regression test tái hiện trước khi sửa, sửa xong re-scan xác nhận hết blocker (hoặc blocker được người
  dùng chấp nhận rõ ràng), sẵn sàng để commit.
- **Đầu vào bắt buộc:** phạm vi cần review (module/service/toàn bộ project).
- **Đầu vào tuỳ chọn:** báo cáo CVE/dependency đã biết, log sự cố bảo mật trước đó, yêu cầu compliance cụ thể.

## Điều kiện tiên quyết

- Skill/agent đã cài: `engineering-quality-auditor`, `backend-test-writer`, `frontend-test-writer`,
  `backend-fixer`, `frontend-fixer` (test-writer và fixer chỉ phía có finding cần sửa), skill `core/git-workflow`.
- Artifact phải có sẵn: không bắt buộc, nhưng danh sách dependency (`package.json`/`pom.xml`/…) giúp scan
  dependency nhanh hơn.
- Baseline: build/test hiện tại của phạm vi review đang XANH trước khi bắt đầu (để phân biệt lỗi bảo mật với
  lỗi build có sẵn) — được đo và ghi số mốc ở Bước 1.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Baseline build/test

- **Thực hiện:** session chính
- **Đầu vào:** phạm vi cần review của người dùng
- **Hành động:** chạy build và test của phạm vi review theo lệnh của project; ghi số mốc (lệnh, exit code, số test
  pass/fail) làm baseline cho các bước sau.
- **Ràng buộc:** chỉ chạy build/test cục bộ; không chạy lệnh tác động môi trường; không sửa code để làm xanh.
- **Đầu ra:** baseline build/test (lệnh + exit code + số liệu).
- **Gate:** build/test xanh (exit code 0) và số mốc đã ghi, để phân biệt lỗi bảo mật với lỗi build có sẵn.
- **Khi fail:** đỏ → dừng `blocked`, đề xuất `workflow-bugfix`; lỗi build có sẵn không tính là finding bảo mật.
- **Evidence:** lệnh build/test + exit code + số liệu pass/fail.

### Bước 2 — Phạm vi & threat

- **Thực hiện:** session chính
- **Đầu vào:** phạm vi cần review của người dùng
- **Hành động:** xác định vùng rủi ro áp dụng cho phạm vi này trong tập {auth/session, authorization/access
  control, input validation, SSRF, crypto/secrets, dependency, security misconfiguration, logging}; loại vùng
  rõ ràng không áp dụng (vd không có input validation nếu không nhận input người dùng; không có SSRF nếu
  không gọi URL do người dùng cung cấp) và ghi lý do.
- **Ràng buộc:** không mở rộng phạm vi ngoài module/service được nêu; không bỏ qua vùng rủi ro mà không ghi
  lý do.
- **Đầu ra:** danh sách vùng rủi ro áp dụng + lý do loại vùng không áp dụng.
- **Gate:** danh sách vùng rủi ro áp dụng (auth/session, authorization/access control, input, SSRF, crypto/secrets, dependency, misconfiguration, logging).
- **Khi fail:** không xác định được phạm vi rõ ràng → hỏi lại người dùng.
- **Evidence:** danh sách vùng rủi ro áp dụng trong report bước.

### Bước 3 — Review & scan

- **Thực hiện:** agent `engineering-quality-auditor`
- **Đầu vào:** danh sách vùng rủi ro từ Bước 2
- **Hành động:** review code theo từng vùng rủi ro áp dụng (STRIDE/OWASP), gồm kiểm quyền theo vai trò/chủ sở
  hữu tài nguyên (authorization) và cấu hình mặc định không an toàn; quét secret hardcode và dependency có
  CVE đã biết; mask giá trị secret thật trong mọi finding trước khi báo; đánh dấu finding secret bị lộ để
  Bước 6 xử lý.
- **Ràng buộc:** không in giá trị secret thật ra report (luôn mask); không tự sửa code ở bước này.
- **Đầu ra:** danh sách finding theo severity (contract đầu ra, `core:principles`), secret đã mask.
- **Gate:** report finding theo schema; secret đã mask.
- **Khi fail:** phát hiện secret nhưng chưa mask được an toàn → dừng, báo người dùng xử lý thủ công secret đó
  trước khi tiếp tục report.
- **Evidence:** danh sách finding (severity/category/location/evidence/confidence), xác nhận secret đã mask.

### Bước 4 — Validate findings

- **Thực hiện:** session chính
- **Đầu vào:** finding thô từ Bước 3
- **Hành động:** đọc lại `file:line` của từng finding để xác nhận còn đúng trong code thật; loại finding
  không tái lập được hoặc là false positive, ghi lý do loại.
- **Ràng buộc:** không giữ lại finding không đọc lại được `file:line`; không tự hạ severity để giảm số
  blocker.
- **Đầu ra:** danh sách finding đã validate + số finding bị loại kèm lý do.
- **Gate:** từng finding đọc lại `file:line`.
- **Khi fail:** không đọc lại được `file:line` (file không tồn tại/đã đổi) → loại finding đó, ghi rõ lý do.
- **Evidence:** danh sách finding đã validate trong report bước.

### Bước 5 — Kế hoạch remediation ⏸

- **Thực hiện:** session chính
- **Đầu vào:** finding đã validate từ Bước 4
- **Hành động:** trình toàn bộ finding cho người dùng theo severity; người dùng chọn finding nào sửa ngay,
  finding nào chấp nhận rủi ro (ghi lý do chấp nhận).
- **Ràng buộc:** không tự quyết định bỏ qua finding `blocker` mà không có xác nhận rõ ràng của người dùng.
- **Đầu ra:** danh sách finding người dùng chọn sửa + **danh sách file được sửa cho mỗi finding đã chọn** (đầu
  vào cho Bước 8) + danh sách finding được chấp nhận rủi ro (nếu có).
- **Gate:** người dùng chọn finding cần sửa; có danh sách file được sửa.
- **Khi fail:** người dùng chưa quyết định được → dừng, chờ người dùng xác nhận, không tự sửa khi chưa có
  quyết định.
- **Evidence:** danh sách finding người dùng chọn sửa/chấp nhận kèm file được sửa cho mỗi finding, trích dẫn xác
  nhận của người dùng.

### Bước 6 — Thu hồi secret ⏸

- **Thực hiện:** session chính
- **Đầu vào:** finding đã validate từ Bước 4 + danh sách finding người dùng chọn ở Bước 5
- **Hành động:** nếu có finding là secret bị lộ (đã nằm trong code, lịch sử git, log hoặc artifact), yêu cầu
  người dùng tự rotate/thu hồi secret đó tại hệ thống phát hành (cloud, IdP, database, dịch vụ ngoài) rồi xác
  nhận đã làm; coi secret là đã lộ kể cả khi sau này xoá khỏi code. Nếu không có finding secret bị lộ, ghi
  "không áp dụng".
- **Ràng buộc:** workflow không tự rotate, không gọi hệ thống bên ngoài, không đọc hay in giá trị secret (chỉ
  nêu tên/vị trí đã mask); không viết lại lịch sử git.
- **Đầu ra:** xác nhận của người dùng rằng secret đã được rotate, hoặc dòng "không áp dụng".
- **Gate:** người dùng xác nhận đã rotate mọi secret bị lộ, hoặc không có finding secret bị lộ.
- **Khi fail:** người dùng chưa rotate → dừng; secret vẫn coi là lộ, finding không được đóng, ghi vào
  `remaining_risks`.
- **Evidence:** trích dẫn xác nhận của người dùng (không kèm giá trị secret), hoặc dòng "không áp dụng".

### Bước 7 — Regression test (đỏ)

- **Thực hiện:** agent `backend-test-writer` ∥ agent `frontend-test-writer` (chỉ phía có finding cần sửa)
- **Đầu vào:** danh sách finding cần sửa từ Bước 5
- **Hành động:** với mỗi finding kiểm được bằng test (authorization, input validation, SSRF, logic), viết test
  tái hiện lỗ hổng và chạy trên code chưa sửa: test phải đỏ đúng lý do lỗ hổng. Finding không kiểm được bằng
  test (secret, dependency, cấu hình) ghi "không áp dụng" kèm lý do.
- **Ràng buộc:** chỉ viết test, không sửa code production; chỉ chạy trên môi trường local/test; test không chứa
  giá trị secret thật và không gọi dịch vụ bên ngoài thật (SSRF dùng server giả cục bộ hoặc mock).
- **Đầu ra:** danh sách test regression đỏ đúng lý do + danh sách finding "không áp dụng" kèm lý do.
- **Gate:** mỗi test regression đỏ đúng lý do lỗ hổng, không đỏ vì lỗi của chính test; so với trạng thái ghi
  lại ở đầu bước (`git status --porcelain`), các file thay đổi hoặc mới trong bước (`git diff --name-only` và
  `git ls-files --others --exclude-standard`) chỉ gồm file test (và fixture/mock của test).
- **Khi fail:** test xanh trên code chưa sửa (không bắt được lỗ hổng) hoặc đỏ vì lỗi test → sửa test, chạy lại;
  không nới assertion. Test đã viết đúng mà vẫn xanh → nghi finding là false positive, quay lại Bước 4 validate
  lại.
- **Evidence:** lệnh chạy test + exit code khác 0 + đoạn lỗi giải thích lý do đỏ; danh sách file thay đổi hoặc
  mới trong bước so với trạng thái đầu bước.

### Bước 8 — Sửa

- **Thực hiện:** agent `backend-fixer` ∥ agent `frontend-fixer` (chỉ phía có finding cần sửa)
- **Đầu vào:** oracle = test regression đỏ của Bước 7 + danh sách finding và danh sách file được sửa từ Bước 5.
  Finding không có test regression (Bước 7 "không áp dụng"): oracle = finding đã validate; gate xanh = Bước 9.
  Khi quay lại từ Bước 9 (re-scan còn finding): oracle = finding còn lại đã validate (`file:line`); gate xanh =
  re-scan Bước 9 sạch.
- **Hành động:** session chính ghi mốc `git status --porcelain` (+ `git hash-object` file test đang bẩn) TRƯỚC khi
  dispatch agent; agent sửa đúng finding đã chọn theo skill `backend-fix`/`frontend-fix` (chế độ `security`),
  phạm vi tối thiểu trong danh sách file; chạy lại build/test của phạm vi đã sửa, gồm test regression ở Bước 7
  (phải chuyển từ đỏ sang xanh). Danh sách file là hợp của hai phía; mỗi agent chỉ đối chiếu phần thuộc phía
  mình.
- **Ràng buộc:** không sửa ngoài phạm vi finding đã chọn và danh sách file — cần mở rộng → agent trả `blocked`,
  session chính hỏi người dùng rồi gọi lại; không chỉ che triệu chứng (vd log giảm chi tiết thay vì sửa lỗ hổng
  thật); không xoá hay nới test regression để qua.
- **Đầu ra:** code đã sửa, build/test xanh, test regression xanh.
- **Gate:** build/test xanh, gồm test regression; so với trạng thái ghi lại ở đầu bước (`git status --porcelain`),
  file thay đổi hoặc mới trong bước (`git diff --name-only` và `git ls-files --others --exclude-standard`) ⊆
  danh sách file của Bước 5 và không chứa file test/fixture/snapshot/mock; file test đã bẩn trong mốc (test của
  Bước 7) không đổi nội dung (`git hash-object` trước/sau).
- **Khi fail:** agent trả `blocked` → người dùng mở rộng danh sách (ghi bổ sung vào Đầu ra Bước 5) → gọi lại; sửa
  xong vẫn đỏ → chẩn đoán lại, sửa tiếp trong danh sách, không bỏ qua; diff lệch danh sách → revert phần lệch,
  không nhận.
- **Evidence:** report của agent (lệnh build/test + exit code 0, test regression đã từ đỏ sang xanh) + danh sách
  file thay đổi hoặc mới trong bước so với trạng thái đầu bước + `git hash-object` trước/sau của file test đã bẩn.

### Bước 9 — Re-scan

- **Thực hiện:** agent `engineering-quality-auditor`
- **Đầu vào:** code đã sửa từ Bước 8 + danh sách finding đã chọn sửa từ Bước 5
- **Hành động:** scan lại đúng vùng đã sửa để xác nhận finding đã chọn không còn; kiểm tra không phát sinh
  finding mới trong vùng vừa sửa.
- **Ràng buộc:** không tự đóng finding khi chưa scan lại xác nhận; finding chấp nhận rủi ro ở Bước 5 giữ
  nguyên trạng thái, không tính là blocker còn lại.
- **Đầu ra:** báo cáo finding đã sửa không còn xuất hiện; danh sách finding còn lại (nếu có) + trạng thái.
- **Gate:** finding đã sửa không còn; 0 finding `blocker` hoặc blocker được chấp nhận rõ ràng.
- **Khi fail:** finding đã sửa vẫn còn xuất hiện → quay lại Bước 8 sửa lại cho đúng.
- **Evidence:** danh sách finding sau re-scan + đối chiếu với danh sách đã sửa ở Bước 5.

### Bước 10 — Commit ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** diff sửa hoàn chỉnh đã qua Bước 1–9
- **Hành động:** tóm tắt finding đã sửa + finding được chấp nhận rủi ro (nếu có); đề xuất commit message
  Conventional Commits (header EN, body VI); trình diff cho người dùng duyệt.
- **Ràng buộc:** không tự commit khi người dùng chưa duyệt diff; không push trừ khi được yêu cầu; không commit
  kèm giá trị secret thật.
- **Đầu ra:** commit đã tạo (sau khi người dùng duyệt).
- **Gate:** người dùng duyệt diff.
- **Khi fail:** người dùng yêu cầu sửa thêm → quay lại bước tương ứng, không commit tạm.
- **Evidence:** hash commit + message.

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 5 | Toàn bộ finding theo severity | Người dùng chọn finding cần sửa/chấp nhận rủi ro |
| 6 | Danh sách secret bị lộ (đã mask) và trạng thái rotate | Người dùng xác nhận đã rotate, hoặc không có secret bị lộ |
| 10 | Diff sửa hoàn chỉnh + test regression | Người dùng duyệt diff |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Baseline đỏ (Bước 1) | Dừng `blocked`, không tiếp tục trên baseline đỏ; đề xuất workflow-bugfix |
| Build fail | Chẩn đoán → sửa → build lại |
| Test fail | Phân tích failure → sửa code (không xoá/nới test) → chạy lại |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` | Chặn hoàn thành cho tới khi sửa hoặc người dùng chấp nhận rủi ro rõ ràng |
| Phát hiện secret chưa mask an toàn (Bước 3) | Dừng, báo người dùng xử lý thủ công secret trước khi tiếp tục |
| Người dùng chưa quyết định remediation (sau Bước 5 ⏸) | Dừng, chờ xác nhận, không tự sửa |
| Người dùng chưa rotate secret bị lộ (sau Bước 6 ⏸) | Dừng, coi secret là đã lộ, không đóng finding, ghi vào `remaining_risks` |
| Test regression không đỏ đúng lý do (Bước 7) | Sửa test, chạy lại; không nới assertion |
| Fixer trả `blocked` (Bước 8) | Người dùng mở rộng danh sách file có xác nhận, gọi lại agent; không tự mở phạm vi |
| Finding đã sửa vẫn còn sau re-scan (Bước 9) | Quay lại Bước 8 sửa lại cho đúng |
| Người dùng không duyệt diff (sau Bước 10 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |

- **Điều kiện dừng:** phát hiện secret không xử lý được an toàn; người dùng không rotate secret bị lộ; người
  dùng không quyết định được remediation sau nhiều vòng; finding `blocker` không sửa được và người dùng không
  chấp nhận rủi ro; người dùng không duyệt diff.
- **Rollback:** trước checkpoint commit, chưa có gì để rollback (chưa commit); nếu người dùng huỷ giữa chừng,
  xoá thay đổi chưa commit bằng thao tác git thủ công của người dùng (workflow không tự `reset --hard`). Secret
  đã rotate không hoàn tác được và không cần hoàn tác.

## Definition of Done

- [ ] Baseline build/test đã đo, số mốc đã ghi — evidence: Bước 1
- [ ] Danh sách vùng rủi ro áp dụng đã xác định — evidence: Bước 2
- [ ] Finding đã scan theo schema, secret đã mask — evidence: Bước 3
- [ ] Finding đã validate bằng đọc lại `file:line` — evidence: Bước 4
- [ ] Người dùng đã chọn finding cần sửa/chấp nhận rủi ro — evidence: Bước 5
- [ ] Secret bị lộ đã được người dùng rotate, hoặc không áp dụng — evidence: Bước 6
- [ ] Test regression đỏ đúng lý do trước khi sửa (hoặc "không áp dụng" kèm lý do) — evidence: Bước 7
- [ ] Build/test xanh sau khi sửa, gồm test regression — evidence: Bước 8
- [ ] Re-scan xác nhận finding đã sửa không còn — evidence: Bước 9
- [ ] Người dùng đã duyệt diff và commit đã tạo — evidence: Bước 10
- [ ] Mọi gate có evidence `passed`
- [ ] 0 finding `blocker` (hoặc blocker được người dùng chấp nhận rõ ràng, ghi trong `remaining_risks`)

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
workflow_result:
  workflow: workflow-security-review
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
  remaining_risks: []      # finding blocker được chấp nhận rủi ro (nếu có) + lý do
  docs_updated: []
  next_actions: []         # gồm việc dọn secret khỏi lịch sử git (người dùng quyết định) nếu có secret bị lộ
```
