---
name: workflow-testing
description: "Workflow điều phối viết test cho code đã có: phân tích hành vi cần test, chọn chiến lược theo policy (feature: unit; API: integration + contract; luồng quan trọng: e2e), viết test, chạy và phân loại failure (lỗi test vs lỗi code), đo coverage, rồi commit. Dùng workflow NÀY khi người dùng muốn \"viết test\", \"tăng coverage\", \"test strategy\", \"kiểm thử\" — kể cả khi không nói chính xác chữ \"workflow\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần."
order: 5
title: "Testing — viết test theo chiến lược, đo coverage"
kind: workflow
tier: 2
risk: low
agents: "backend-test-writer,frontend-test-writer,frontend-e2e-test-writer"
requires: "core/git-workflow"
runsIn: execute
invoke: per-request
---

# Testing — viết test theo chiến lược, đo coverage

## Mục tiêu & đầu vào

- **Mục tiêu:** viết test cho hành vi/code đã xác định, đúng loại test theo policy, chạy xanh, phân loại rõ
  failure (lỗi test hay lỗi code), có coverage report, sẵn sàng commit.
- **Đầu vào bắt buộc:** phạm vi code/hành vi cần test (module/feature/API/luồng).
- **Đầu vào tuỳ chọn:** coverage report hiện tại, policy test đã thống nhất trước đó.

## Điều kiện tiên quyết

- Skill/agent đã cài: `backend-test-writer`, `frontend-test-writer`, `frontend-e2e-test-writer` (chỉ khi chiến
  lược có e2e), skill `core/git-workflow`.
- Artifact phải có sẵn: code/hành vi cần test đã tồn tại (không phải feature chưa implement).
- Baseline: build hiện tại của vùng đụng đang XANH trước khi thêm test — được đo và ghi số mốc ở Bước 1.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Baseline build/test

- **Thực hiện:** session chính
- **Đầu vào:** vùng cần thêm test của người dùng
- **Hành động:** chạy build và test của vùng đụng theo lệnh của project; ghi số mốc (lệnh, exit code, số test
  pass/fail) làm baseline cho các bước sau.
- **Ràng buộc:** chỉ chạy build/test cục bộ; không chạy lệnh tác động môi trường; không sửa code để làm xanh.
- **Đầu ra:** baseline build/test (lệnh + exit code + số liệu).
- **Gate:** build/test xanh (exit code 0) và số mốc đã ghi.
- **Khi fail:** đỏ → dừng `blocked`, đề xuất `workflow-bugfix`; không thêm test trên baseline đỏ.
- **Evidence:** lệnh build/test + exit code + số liệu pass/fail.

### Bước 2 — Phân tích

- **Thực hiện:** session chính
- **Đầu vào:** phạm vi code/hành vi cần test của người dùng
- **Hành động:** đọc code trong phạm vi, liệt kê hành vi cần test (nhánh chính, edge case, lỗi).
- **Ràng buộc:** không mở rộng phạm vi ngoài module/feature/API được nêu.
- **Đầu ra:** danh sách hành vi cần test.
- **Gate:** danh sách hành vi cần test.
- **Khi fail:** không xác định được hành vi từ code → hỏi lại người dùng phạm vi cụ thể hơn.
- **Evidence:** danh sách hành vi cần test trong report bước.

### Bước 3 — Chiến lược ⏸

- **Thực hiện:** session chính
- **Đầu vào:** danh sách hành vi từ Bước 2
- **Hành động:** chọn loại test theo policy (feature: unit; API: integration + contract; luồng quan trọng:
  e2e); trình cho người dùng xác nhận trước khi viết test.
- **Ràng buộc:** không tự chọn e2e cho hành vi không phải luồng quan trọng.
- **Đầu ra:** loại test đã chọn cho từng hành vi, đã được người dùng xác nhận; hành vi loại e2e kèm lý do không
  chứng minh được ở tầng thấp (tính là duyệt E2 của skill `frontend-e2e-testing`).
- **Gate:** loại test theo policy (feature: unit; API: integration + contract; luồng quan trọng: e2e).
- **Khi fail:** người dùng không đồng ý chiến lược → quay lại Bước 2 làm rõ hành vi/rủi ro.
- **Evidence:** bảng hành vi → loại test đã xác nhận trong report bước; với hành vi loại e2e, bảng này kèm lý do
  không chứng minh được ở tầng thấp và được tính là duyệt E2 của skill `frontend-e2e-testing`.

### Bước 4 — Viết test

- **Thực hiện:** agent `backend-test-writer` ∥ agent `frontend-test-writer` (phía có vùng đụng); hành vi loại
  "luồng quan trọng: e2e" → agent `frontend-e2e-test-writer`
- **Đầu vào:** chiến lược đã xác nhận từ Bước 3 (e2e: bảng Bước 3 là duyệt E2, agent không trình lại)
- **Hành động:** viết test đúng loại đã chọn cho từng hành vi trong danh sách; e2e viết bằng Playwright theo
  skill `frontend-e2e-testing` (mỗi test map 1 hành vi/AC, selector theo role/label, không sleep cứng).
- **Ràng buộc:** không viết test giòn (phụ thuộc thứ tự/thời gian/mạng thật).
- **Đầu ra:** test mới, chạy được (e2e: hoặc `not_run` có lý do vì thiếu môi trường BE/DB test).
- **Gate:** test chạy được, hoặc e2e `not_run` vì thiếu môi trường BE/DB test (hợp lệ, ghi vào
  `remaining_risks`); so với trạng thái ghi lại ở đầu bước (`git status --porcelain`), các file thay đổi hoặc mới
  trong bước (`git diff --name-only` và `git ls-files --others --exclude-standard`) chỉ gồm file test (và
  fixture/mock của test; e2e: thư mục `e2e/`, `playwright.config.*`, dòng `.gitignore` cho thư mục auth/output
  của Playwright (vd `e2e/.auth/` và thư mục report/kết quả theo config); `package.json` + lockfile CHỈ khi
  người dùng đã duyệt (E-r7: thêm `@playwright/test`; thêm script chạy e2e cũng cần duyệt như E-r7)).
- **Khi fail:** test không chạy được (lỗi biên dịch/setup) → sửa test, chạy lại; e2e không chạy vì thiếu BE/DB
  test → `not_run`, không lặp sửa test.
- **Evidence:** lệnh chạy test + exit code; danh sách file thay đổi hoặc mới trong bước so với trạng thái đầu
  bước; e2e: lệnh Playwright + kết quả hoặc `not_run` + lý do.

### Bước 5 — Chạy & phân tích failure

- **Thực hiện:** agent `backend-test-writer` ∥ agent `frontend-test-writer` (phía có vùng đụng); e2e → agent
  `frontend-e2e-test-writer`
- **Đầu vào:** test mới từ Bước 4
- **Hành động:** chạy toàn bộ test mới; với mỗi failure, phân loại lỗi test (test sai) hay lỗi code (code có
  bug); lỗi code → đề xuất chạy `workflow-bugfix`; e2e chạy `npx playwright test --repeat-each=3`, flaky →
  sửa test (không nới assertion); thiếu BE/DB test → `not_run` + lý do.
- **Ràng buộc:** không tự sửa code production để test qua khi failure là lỗi code — chỉ đề xuất `workflow-bugfix`;
  e2e chỉ chạy trên môi trường local/test — thiếu BE/DB test thì agent trả `not_run` + lý do, không tự dựng hạ
  tầng.
- **Đầu ra:** danh sách failure đã phân loại (nếu có).
- **Gate:** mọi failure phân loại lỗi test | lỗi code; lỗi code → đề xuất `workflow-bugfix`; so với trạng thái
  ghi lại ở đầu bước (`git status --porcelain`), các file thay đổi hoặc mới trong bước (`git diff --name-only`
  và `git ls-files --others --exclude-standard`) chỉ gồm file test (và fixture/mock của test; e2e: thư mục
  `e2e/`, `playwright.config.*`, dòng `.gitignore` cho thư mục auth/output của Playwright (vd `e2e/.auth/` và
  thư mục report/kết quả theo config); `package.json` + lockfile CHỈ khi người dùng đã duyệt
  (E-r7: thêm `@playwright/test`; thêm script chạy e2e cũng cần duyệt như E-r7)); e2e `not_run` vì thiếu môi
  trường là hợp lệ (ghi vào `remaining_risks`).
- **Khi fail:** không phân loại được nguyên nhân failure → hỏi người dùng thêm ngữ cảnh, không tự đoán.
- **Evidence:** lệnh chạy test + exit code + danh sách failure đã phân loại; danh sách file thay đổi hoặc mới
  trong bước so với trạng thái đầu bước; e2e: lệnh Playwright + kết quả hoặc `not_run` + lý do.

### Bước 6 — Coverage

- **Thực hiện:** session chính
- **Đầu vào:** test lỗi-test đã xanh từ Bước 5 (e2e `not_run` có lý do được tính là đã xử lý) + danh sách
  lỗi-code đã chuyển sang `workflow-bugfix`
- **Hành động:** chạy coverage tool của project cho vùng đụng; ghi lại số liệu, hoặc ghi `not_run` kèm lý do
  nếu project chưa có coverage tool.
- **Ràng buộc:** không tự thêm coverage tool ngoài yêu cầu.
- **Đầu ra:** coverage report, hoặc `not_run` có lý do.
- **Gate:** coverage report, hoặc `not_run` có lý do.
- **Khi fail:** coverage tool lỗi cấu hình → ghi `not_run` kèm lý do, không chặn hoàn thành.
- **Evidence:** lệnh coverage + exit code + số liệu, hoặc lý do `not_run`.

### Bước 7 — Commit ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** test mới đã qua Bước 1–6
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
| 3 | Bảng hành vi → loại test theo policy | Người dùng xác nhận chiến lược |
| 7 | Diff test mới | Người dùng duyệt diff |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Baseline đỏ (Bước 1) | Dừng `blocked`, không tiếp tục trên baseline đỏ; đề xuất workflow-bugfix (bugfix: báo người dùng) |
| Build fail | Chẩn đoán → sửa → build lại |
| Test fail | Phân loại failure: lỗi test (test sai) → sửa test (không xoá/nới test để qua), chạy lại; lỗi code → dừng, đề xuất `workflow-bugfix`, không sửa code production (Bước 5) |
| e2e thiếu BE/DB test (Bước 4–5) | Ghi `not_run` + lý do vào `remaining_risks`; không tự dựng hạ tầng |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` | Chặn hoàn thành cho tới khi sửa hoặc người dùng chấp nhận rủi ro |
| Người dùng không đồng ý chiến lược (sau Bước 3 ⏸) | Quay lại Bước 2 làm rõ hành vi/rủi ro |
| Người dùng không duyệt diff (sau Bước 7 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |

- **Điều kiện dừng:** không xác định được hành vi cần test sau khi hỏi lại; failure là lỗi code chưa được xử
  lý qua `workflow-bugfix`; người dùng không duyệt diff.
- **Rollback:** trước checkpoint commit, chưa có gì để rollback; nếu người dùng huỷ giữa chừng, xoá thay đổi
  chưa commit bằng thao tác git thủ công của người dùng (workflow không tự `reset --hard`).

## Definition of Done

- [ ] Baseline build/test đã đo, số mốc đã ghi — evidence: Bước 1
- [ ] Danh sách hành vi cần test — evidence: Bước 2
- [ ] Chiến lược test đã được người dùng xác nhận — evidence: Bước 3
- [ ] Test mới chạy được (e2e `not_run` vì thiếu môi trường BE/DB test là hợp lệ, ghi vào `remaining_risks`) —
  evidence: Bước 4
- [ ] Mọi failure đã phân loại lỗi test | lỗi code — evidence: Bước 5
- [ ] Coverage report hoặc `not_run` có lý do — evidence: Bước 6
- [ ] Người dùng đã duyệt diff và commit đã tạo — evidence: Bước 7
- [ ] Mọi gate có evidence `passed` (trừ e2e `not_run` có lý do trong `remaining_risks`)

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
workflow_result:
  workflow: workflow-testing
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
