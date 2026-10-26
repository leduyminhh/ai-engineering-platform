---
name: workflow-performance
description: "Điều phối tối ưu hiệu năng: đo baseline build/test, chốt metric + ngưỡng, đo baseline hiệu năng, profile bottleneck có evidence, tối ưu, benchmark trước/sau cùng điều kiện, review, commit. Dùng khi người dùng muốn \"chậm\", \"tối ưu hiệu năng\", \"performance\", \"latency\". Không dùng khi chậm do lỗi logic rõ ràng, không phải hiệu năng → workflow-bugfix."
order: 9
title: "Performance — profile, tối ưu, benchmark trước/sau"
kind: workflow
tier: 3
risk: medium
argument-hint: "[luồng | metric mục tiêu]"
agents: "backend-performance-analyst,frontend-performance-analyst,backend-fixer,frontend-fixer,backend-reviewer,frontend-reviewer"
requires: "core/git-workflow"
runsIn: execute
invoke: per-request
---

# Performance — profile, tối ưu, benchmark trước/sau

## Mục tiêu & đầu vào

- **Mục tiêu:** cải thiện metric hiệu năng đã chọn, có số đo trước/sau trên cùng điều kiện chứng minh mức cải
  thiện (hoặc không đạt), build/test vẫn xanh.
- **Đầu vào bắt buộc:** mô tả vấn đề hiệu năng (chỗ nào chậm, khi nào).
- **Đầu vào tuỳ chọn:** số đo/monitoring hiện có, ngưỡng SLA đã thống nhất trước đó.

## Điều kiện tiên quyết

- Skill/agent đã cài: `backend-performance-analyst`, `frontend-performance-analyst`, `backend-fixer`,
  `frontend-fixer`, `backend-reviewer`, `frontend-reviewer`, skill `core/git-workflow`.
- Phía FE: project build được bản production và có Chrome cài trên máy (Lighthouse); thiếu → agent trả `not_run`.
- Artifact phải có sẵn: không bắt buộc, ngoài mô tả vấn đề của người dùng.
- Baseline: build/test hiện tại của vùng đụng đang XANH trước khi tối ưu — được đo và ghi số mốc ở Bước 1.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Baseline build/test

- **Thực hiện:** session chính
- **Đầu vào:** mô tả vấn đề hiệu năng của người dùng
- **Hành động:** chạy build và test của vùng sẽ đụng theo lệnh của project; ghi số mốc (lệnh, exit code, số test
  pass/fail) làm baseline cho các bước sau — Gate bước Tối ưu so với số mốc này.
- **Ràng buộc:** chỉ chạy build/test cục bộ; không chạy lệnh tác động môi trường; không sửa code để làm xanh.
- **Đầu ra:** baseline build/test (lệnh + exit code + số liệu).
- **Gate:** build xanh; test của vùng sẽ đụng xanh, số mốc đã ghi.
- **Khi fail:** build đỏ hoặc test đỏ trong vùng sẽ đụng → dừng `blocked`, báo người dùng và đề xuất
  `workflow-bugfix` trước; không tối ưu trên nền đỏ, không sửa lẫn hai việc.
- **Evidence:** lệnh build/test + exit code + số liệu pass/fail.

### Bước 2 — Metric & mục tiêu

- **Thực hiện:** session chính
- **Đầu vào:** mô tả vấn đề hiệu năng của người dùng
- **Hành động:** chọn metric đo (latency/throughput/memory/…) và ngưỡng mục tiêu cần đạt.
- **Ràng buộc:** không bắt đầu tối ưu khi chưa có metric + ngưỡng cụ thể.
- **Đầu ra:** metric + ngưỡng mục tiêu + điều kiện đo sơ bộ (môi trường local/test, endpoint/luồng, tải mục tiêu).
- **Gate:** metric + ngưỡng + điều kiện đo.
- **Khi fail:** người dùng chưa nêu rõ mục tiêu → hỏi lại ngưỡng cụ thể.
- **Evidence:** report bước.

### Bước 3 — Baseline hiệu năng

- **Thực hiện:** agent `backend-performance-analyst` (chế độ `measure`; phía BE) ∥ agent
  `frontend-performance-analyst` (chế độ `measure`; phía FE) — chỉ phía có đụng theo Bước 2
- **Đầu vào:** metric + ngưỡng + điều kiện đo sơ bộ từ Bước 2
- **Hành động:** session chính ghi mốc `git status --porcelain` rồi dispatch agent; agent chốt bảng điều kiện đo
  theo skill `backend-performance`, viết/tái dùng script trong `perf/` hoặc `bench/`, chạy ≥ 3 lần trên môi trường
  local/test, ghi p50/p95/p99, throughput, error rate, độ lệch. Khi phạm vi có phía FE → đọc
  `references/frontend.md`, mục Bước 3. Khi phạm vi có cả hai phía, hai agent chạy song song, mỗi phía ghi vào thư mục
  con riêng `perf/backend/` và `perf/frontend/` với bảng điều kiện + script riêng. Mỗi agent chỉ tự đối chiếu diff
  của phía mình (thư mục con riêng cùng hàng Config tool đo của bảng phía mình) và không revert file của phía kia.
- **Ràng buộc:** không đổi code production trước khi có baseline; không trỏ tải vào staging/production; thêm
  tool/dependency đo → hỏi trước; phía FE không đo trên dev server, không trỏ URL ngoài local/test, không gửi URL
  cho dịch vụ đo của bên thứ ba.
- **Đầu ra:** bảng điều kiện đo + script đo + số đo baseline (phía FE thêm `assets-baseline.txt`).
- **Gate:** bảng điều kiện đo đầy đủ; ≥ 3 lần + độ lệch; so với mốc đầu bước, file thay đổi hoặc mới trong bước
  (`git diff --name-only` và `git ls-files --others --exclude-standard`) chỉ gồm `perf/`, `bench/`, config tool đo
  đã liệt kê ở hàng Config tool đo của bảng điều kiện; session chính chỉ ghi MỘT mốc nên diff chứa file của cả hai
  phía và được đối chiếu với hợp của hai bảng Config tool đo (bảng của từng phía, BE và FE).
- **Khi fail:** agent trả `not_run` vì thiếu môi trường local/test → dừng `blocked`, báo người dùng cung cấp môi
  trường (không có baseline thì không tối ưu); agent FE trả `not_run` vì không dựng được bản build hoặc không có
  Chrome → dừng `blocked`, báo người dùng; agent trả `blocked` + câu hỏi → session chính hỏi người dùng, ghi
  quyết định vào bảng điều kiện (hàng Config tool đo nếu liên quan), gọi lại agent; độ lệch vượt ngưỡng P3 → tăng
  số lần lặp hoặc cô lập nhiễu, đo lại; nếu độ lệch vượt ngưỡng P3 do hai pha đo chồng nhau trên cùng máy → đo lại
  từng phía tuần tự; diff ngoài phạm vi (ngoài `perf/`, `bench/`, hợp hai bảng Config tool đo) → revert phần lệch,
  không nhận (mỗi agent chỉ revert file của phía mình, không đụng file của phía kia).
- **Evidence:** report của agent (bảng điều kiện, bảng số, lệnh chạy) + danh sách file thay đổi so với mốc đầu
  bước + `git hash-object` của script và file bảng điều kiện **của từng phía** (BE và FE) sau khi chốt (mốc bất
  biến cho Bước 6); phía FE gồm cả `assets-baseline.txt`. Session chính tự chạy `git hash-object` và ghi giá trị
  hash vào Evidence/report Bước 3 (như phía BE); file `<luồng>.hashes.txt` của agent chỉ là bản sao tiện lợi,
  không có thẩm quyền; Bước 4/6 so với giá trị hash trong Evidence này.

### Bước 4 — Profile & giả thuyết ⏸

- **Thực hiện:** agent `backend-performance-analyst` (chế độ `profile`; phía BE) ∥ agent
  `frontend-performance-analyst` (chế độ `profile`; phía FE) — chỉ phía có đụng theo Bước 2
- **Đầu vào:** bảng điều kiện + script + số đo baseline từ Bước 3
- **Hành động:** session chính ghi mốc `git status --porcelain`, đọc mốc `git hash-object` của script và bảng
  điều kiện ghi ở Evidence Bước 3, rồi dispatch; agent profile theo thứ tự DB → CPU/alloc → I/O trong lúc chạy
  tải của Bước 3, nêu bottleneck + giả thuyết kèm evidence đo được, đề xuất danh
  sách file/hàm cho Bước 5; session chính trình người dùng xác nhận hướng tối ưu. Khi phạm vi có phía FE → đọc
  `references/frontend.md`, mục Bước 4.
- **Ràng buộc:** không tối ưu khi giả thuyết chưa có evidence; không sửa bảng điều kiện và script đo của Bước 3 —
  lệnh/config bật đếm query hay profiler ghi vào report Bước 4 (hoặc `perf/profile-<luồng>.md`).
- **Đầu ra:** bottleneck + giả thuyết đã xác nhận + **danh sách file/hàm bottleneck được sửa** (đầu vào cho
  Bước 5).
- **Gate:** bottleneck có evidence đo được (không chỉ đọc code); có danh sách file được sửa; so với mốc đầu bước,
  file thay đổi hoặc mới (`git diff --name-only`, `git ls-files --others --exclude-standard`) chỉ gồm `perf/`,
  `bench/`, config tool đo đã liệt kê ở hàng Config tool đo của bảng điều kiện (đối chiếu với hợp của hai bảng
  Config tool đo, vì mốc là một và diff chứa file của cả hai phía; mỗi agent chỉ tự kiểm phía mình); script, bảng
  điều kiện Bước 3 của từng phía (BE và FE) và `assets-baseline.txt` (FE) không đổi (`git hash-object` bằng
  giá trị ở mốc Bước 3).
- **Khi fail:** người dùng không đồng ý hướng tối ưu → profile lại hoặc thu thêm evidence; agent trả `blocked` +
  câu hỏi → session chính hỏi người dùng, ghi quyết định vào report Bước 4, gọi lại agent; quyết định làm đổi điều
  kiện đo (môi trường, dữ liệu seed, tải, warm-up, số lần lặp, config tool đo) → quay lại Bước 3 đo lại baseline;
  diff ngoài phạm vi (ngoài `perf/`, `bench/`, hợp hai bảng Config tool đo) → revert phần lệch, không nhận (mỗi
  agent chỉ revert file của phía mình, không đụng file của phía kia).
- **Evidence:** kết quả profile (file:line hoặc số đo) trong report bước + danh sách file được sửa + xác nhận
  của người dùng + `git hash-object` hiện tại của script, bảng điều kiện của từng phía và `assets-baseline.txt` (FE) so với mốc Bước 3.

### Bước 5 — Tối ưu

- **Thực hiện:** agent `backend-fixer` ∥ agent `frontend-fixer` (chỉ phía có đụng)
- **Đầu vào:** giả thuyết đã xác nhận + danh sách file/hàm bottleneck từ Bước 4 (không có test đỏ; oracle là giả
  thuyết có evidence profile). Khi quay lại từ Bước 7 (finding `blocker`): oracle = finding đã xác nhận
  (`file:line`); gate xanh = review lại.
- **Hành động:** session chính ghi mốc `git status --porcelain` (+ `git hash-object` file test đang bẩn) TRƯỚC khi
  dispatch agent; agent áp thay đổi theo giả thuyết theo skill `backend-fix`/`frontend-fix` (chế độ
  `performance`), trong danh sách file; chạy build/test sau mỗi thay đổi. Agent **không kết luận nhanh hơn** —
  số đo trước/sau thuộc Bước 6. Danh sách file là hợp của hai phía; mỗi agent chỉ đối chiếu phần thuộc phía
  mình.
- **Ràng buộc:** không tối ưu ngoài bottleneck đã xác nhận và danh sách file — cần mở rộng → agent trả
  `blocked`, session chính hỏi người dùng rồi gọi lại; không nới test hay skip test để qua.
- **Đầu ra:** code đã tối ưu, build/test xanh so với số mốc Bước 1.
- **Gate:** build/test xanh, không kém số mốc Bước 1 (cùng lệnh; không thêm test đỏ so với số mốc); so với trạng thái ghi lại ở đầu bước (`git status --porcelain`), file thay đổi hoặc
  mới trong bước (`git diff --name-only` và `git ls-files --others --exclude-standard`) ⊆ danh sách file của Bước
  3 và không chứa file test/fixture/snapshot/mock; file test đã bẩn trong mốc (nếu có) không đổi nội dung
  (`git hash-object` trước/sau).
- **Khi fail:** agent trả `blocked` → người dùng mở rộng danh sách (ghi bổ sung vào Đầu ra Bước 4) → gọi lại;
  build/test đỏ → sửa hoặc revert thay đổi, không giữ thay đổi đỏ; diff lệch danh sách → revert phần lệch, không
  nhận.
- **Evidence:** report của agent (lệnh build/test + exit code) + danh sách file thay đổi hoặc mới trong bước so
  với trạng thái đầu bước + `git hash-object` trước/sau của file test đã bẩn (nếu có).

### Bước 6 — Benchmark & so sánh

- **Thực hiện:** agent `backend-performance-analyst` (chế độ `measure`; phía BE) ∥ agent
  `frontend-performance-analyst` (chế độ `measure`; phía FE) — chỉ phía có đụng theo Bước 2
- **Đầu vào:** code đã tối ưu từ Bước 5 + script và bảng điều kiện đo của Bước 3
- **Hành động:** session chính ghi mốc `git status --porcelain`, đọc mốc `git hash-object` của script và bảng
  điều kiện đã ghi ở Evidence Bước 3, rồi dispatch;
  agent build + khởi chạy lại ứng dụng từ working tree theo hàng Khởi chạy ứng dụng (không tự làm được →
  `blocked` hỏi người dùng), xác nhận là tiến trình mới (PID/thời điểm start khác baseline, hoặc version/actuator
  info) trước warm-up, rồi chạy lại đúng script + bảng điều kiện của Bước 3 (≥ 3 lần), so với baseline, lập bảng
  baseline vs sau. Khi phạm vi có phía FE → đọc `references/frontend.md`, mục Bước 6. Mỗi agent chỉ tự đối chiếu
  diff của phía mình, không revert file của phía kia.
- **Ràng buộc:** không đổi điều kiện đo so với Bước 3 (môi trường, dữ liệu seed, tải, warm-up, số lần lặp); không
  so sánh số đo khác điều kiện với baseline; phía FE không đo trên dev server.
- **Đầu ra:** số đo sau + kết luận đạt/không đạt ngưỡng.
- **Gate:** bảng baseline vs sau cùng điều kiện; đạt ngưỡng hoặc báo không đạt, kết luận đạt/không đạt theo
  từng phía; độ lệch vượt ngưỡng P3 (nhiễu) → không kết luận; script và bảng điều kiện Bước 3 không đổi
  (`git hash-object` của từng phía, gồm `assets-baseline.txt` (FE), bằng mốc Bước 3); file mới chỉ
  trong `perf/`/`bench/` (output); diff code production của working tree (`git diff --name-only` +
  `git ls-files --others --exclude-standard`) chỉ gồm danh sách file Bước 5, cộng file ở hợp của hai bảng Config
  tool đo (một mốc, diff chứa file của cả hai phía).
- **Khi fail:** không đạt ngưỡng → báo rõ, quay lại Bước 4 tìm hướng khác hoặc dừng theo quyết định người dùng;
  điều kiện lệch Bước 3 → chạy lại đúng điều kiện; nhiễu vượt ngưỡng → đo lại, nếu do hai pha đo chồng nhau trên cùng máy → đo lại từng phía tuần tự; agent trả `blocked` + câu hỏi →
  session chính hỏi người dùng, ghi quyết định vào report Bước 6, gọi lại agent; quyết định làm đổi điều kiện đo
  (môi trường, dữ liệu seed, tải, warm-up, số lần lặp, config tool đo) → quay lại Bước 3 đo lại baseline.
- **Evidence:** report của agent (bảng baseline vs sau + lệnh đo) + `git hash-object` hiện tại của script,
  bảng điều kiện của từng phía và `assets-baseline.txt` (FE) so với mốc Bước 3.

### Bước 7 — Review

- **Thực hiện:** agent `backend-reviewer` ∥ agent `frontend-reviewer` (chỉ phía có đụng)
- **Đầu vào:** code đã tối ưu + số đo từ Bước 6
- **Hành động:** review thay đổi theo trục correctness/performance của phía tương ứng, trả finding.
- **Ràng buộc:** chỉ đọc, không tự sửa code.
- **Đầu ra:** danh sách finding.
- **Gate:** 0 finding blocker.
- **Khi fail:** có finding `blocker` → quay lại Bước 5 sửa, review lại.
- **Evidence:** danh sách finding trong report bước.

### Bước 8 — Commit ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** code đã tối ưu đã qua Bước 1–7
- **Hành động:** đề xuất commit message Conventional Commits (header EN, body VI); trình diff cho người dùng
  duyệt.
- **Ràng buộc:** không tự commit khi người dùng chưa duyệt diff.
  Đây là chốt riêng của workflow, áp cả trên feature branch.
- **Đầu ra:** commit đã tạo (sau khi người dùng duyệt).
- **Gate:** người dùng duyệt diff.
- **Khi fail:** người dùng yêu cầu sửa thêm → quay lại bước người dùng chỉ định, không commit tạm.
- **Evidence:** hash commit + message.

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 4 | Bottleneck + giả thuyết kèm evidence | Người dùng xác nhận hướng tối ưu |
| 8 | Diff | Người dùng duyệt diff |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

Supervisor (session chính) kiểm `agent_result` của worker và giới hạn retry theo contract đầu ra (`core:principles`).

| Tình huống | Hành động |
|---|---|
| Baseline build/test đỏ (Bước 1) | Dừng `blocked`, báo người dùng, đề xuất `workflow-bugfix`; không tối ưu trên nền đỏ |
| Build fail | Chẩn đoán → sửa → build lại |
| Test fail | Phân tích failure → sửa code (không xoá/nới test) → chạy lại |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` (Bước 7) | Quay lại Bước 5 sửa, review lại |
| Không có số đo trước/sau trên cùng điều kiện | Dừng `blocked`, không kết luận về hiệu năng |
| Môi trường đo thiếu (Bước 3/6, `not_run`) | Dừng `blocked`, báo người dùng cung cấp môi trường local/test; không tối ưu khi chưa có baseline |

Khi gặp tình huống lỗi theo bước mà bảng trên chưa nêu → đọc `references/error-matrix.md` (trường Khi fail của bước vẫn là nguồn chính).

- **Điều kiện dừng:** không có số đo trước/sau cùng điều kiện; người dùng không đồng ý hướng tối ưu sau nhiều
  vòng; finding `blocker` không sửa được; người dùng không duyệt diff.
- **Rollback:** trước checkpoint commit, revert thay đổi tối ưu bằng git thủ công của người dùng nếu benchmark
  không đạt; sau khi commit, rollback thuộc trách nhiệm người dùng.

## Definition of Done

- [ ] Baseline build/test đã đo, số mốc đã ghi, build xanh — evidence: Bước 1
- [ ] Metric + ngưỡng mục tiêu — evidence: Bước 2
- [ ] Baseline đo đúng điều kiện (bảng điều kiện đo + ≥ 3 lần, từng phía có đụng) — evidence: Bước 3
- [ ] Bottleneck có evidence, người dùng xác nhận hướng tối ưu — evidence: Bước 4
- [ ] Build/test xanh sau tối ưu, không kém số mốc Bước 1 — evidence: Bước 5
- [ ] Số đo sau cùng điều kiện với baseline, đạt hoặc báo không đạt ngưỡng (từng phía có đụng) — evidence: Bước 6
- [ ] 0 finding `blocker` — evidence: Bước 7
- [ ] Người dùng đã duyệt diff và commit đã tạo — evidence: Bước 8
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
