---
name: workflow-db-change
description: "Workflow điều phối thay đổi schema database: xác định bảng/cột/index bị ảnh hưởng, thiết kế migration forward + rollback tương thích ngược, implement migration và code, review query/index, chạy thử chu trình verify theo công cụ (migrate up/rollback/up, hoặc up/migration bù với công cụ forward-only) trên DB test, viết integration test cho query/repository bị ảnh hưởng, cập nhật data-model.md, rồi commit. Dùng workflow NÀY khi người dùng muốn \"đổi schema\", \"migration\", \"thêm cột/bảng\", \"đổi index\" — kể cả khi không nói chính xác chữ \"workflow\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần."
order: 7
title: "DB change — migration schema forward/rollback"
kind: workflow
tier: 2
risk: high
agents: "data-migration-writer,backend-implementer,backend-test-writer,backend-reviewer"
requires: "core/git-workflow,data/data-db-migration"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# DB change — migration schema forward/rollback

## Mục tiêu & đầu vào

- **Mục tiêu:** thay đổi schema database an toàn — có migration forward + rollback tương thích ngược, code
  đi kèm đã review, đã chạy thử chu trình verify theo công cụ (migrate up → rollback → migrate up, hoặc migrate up → migration bù với công cụ forward-only) thành công trên DB test, có integration
  test cho query/repository bị ảnh hưởng và `data-model.md` được cập nhật.
- **Đầu vào bắt buộc:** mô tả thay đổi schema (bảng/cột/index cần thêm/sửa/xoá).
- **Đầu vào tuỳ chọn:** data-model/ERD hiện tại, migration tool đang dùng của project.

## Điều kiện tiên quyết

- Skill/agent đã cài: `data-migration-writer`, `backend-implementer`, `backend-test-writer`, `backend-reviewer`,
  skill `core/git-workflow`, `data/data-db-migration`.
- Artifact phải có sẵn: schema/data-model hiện tại đọc được (migration trước đó, ERD, hoặc kết nối DB test).
- Baseline: có DB test riêng biệt để chạy thử migration, không phải DB production.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Data model & impact

- **Thực hiện:** session chính
- **Đầu vào:** mô tả thay đổi schema của người dùng
- **Hành động:** xác định bảng/cột/index bị ảnh hưởng; tìm nơi dùng các bảng/cột đó trong code (query, ORM
  mapping, DTO).
- **Ràng buộc:** không mở rộng phạm vi ngoài thay đổi được nêu.
- **Đầu ra:** danh sách bảng/cột/index bị ảnh hưởng + nơi dùng trong code.
- **Gate:** bảng/cột/index bị ảnh hưởng + nơi dùng trong code.
- **Khi fail:** không xác định được hết nơi dùng → hỏi người dùng phạm vi rõ hơn, không tự đoán.
- **Evidence:** danh sách bảng/cột/index + `file:line` nơi dùng trong report bước.

### Bước 2 — Thiết kế migration ⏸

- **Thực hiện:** session chính (theo skill `data-db-migration`, chế độ `change`, bước C2)
- **Đầu vào:** danh sách impact từ Bước 1
- **Hành động:** thiết kế migration forward + rollback theo chiến lược expand/contract (công cụ forward-only: "rollback" là một migration bù mới) (thêm trước, backfill,
  rồi mới xoá/đổi ràng buộc cũ ở migration sau); trình cho người dùng xác nhận trước khi implement. Tra pattern
  trong `references/change/change-patterns.md` và mức khoá trong `references/change/lock-risk-postgres.md` của
  skill; hỏi số dòng của bảng bị đụng (không có ngưỡng mặc định); ghi rõ pha nào (expand / migrate data /
  contract) vào lượt này, pha nào để sau.
- **Ràng buộc:** không thiết kế migration xoá dữ liệu ngay trong cùng migration thêm cột/bảng mới.
- **Đầu ra:** thiết kế migration forward + rollback + tương thích ngược, đã được người dùng xác nhận, kèm kế
  hoạch theo pha (expand / migrate data / contract) và số dòng bảng bị đụng làm đầu vào cho Bước 3.
- **Gate:** forward + rollback + tương thích ngược (expand/contract).
- **Khi fail:** người dùng không đồng ý thiết kế → quay lại Bước 1 làm rõ impact/ràng buộc.
- **Evidence:** thiết kế migration + xác nhận của người dùng trong report bước.

### Bước 3 — Implement

- **Thực hiện:** agent `data-migration-writer` (file migration) ∥ agent `backend-implementer` (code)
- **Đầu vào:** thiết kế + kế hoạch theo pha + số dòng bảng bị đụng đã xác nhận từ Bước 2 + nơi dùng đã xác định ở
  Bước 1
- **Hành động:** session chính ghi mốc `git status --porcelain` MỘT lần ở lần dispatch đầu của Bước 3 (các lần
  gọi lại sau Bước 4/6/7 hoặc `blocked` dùng lại mốc đó) rồi dispatch hai agent; `data-migration-writer` nhận
  diện công cụ và thư mục migration rồi chỉ thêm file migration MỚI (forward + rollback; với công cụ
  forward-only chỉ forward — migration bù là đoạn SQL trong report, không thành file) cho các pha của lượt này;
  `backend-implementer` cập nhật code (query/ORM mapping/DTO) theo nơi dùng đã xác định ở Bước 1.
- **Ràng buộc:** không sửa file migration đã có trên base branch; `backend-implementer` không sửa file trong thư
  mục migration và không sửa code ngoài nơi dùng đã xác định ở Bước 1; danh sách file là hợp của hai phía, mỗi
  agent chỉ đối chiếu phần của mình; file trong thư mục migration xuất hiện ở danh sách nơi dùng của Bước 1 (vd
  migration Java, `R__` lặp lại) không thuộc phạm vi hai agent → hỏi người dùng; agent không kết nối DB hay chạy
  migration (verify ở Bước 6).
- **Đầu ra:** file migration mới + code cập nhật.
- **Gate:** build xanh; so với mốc `git status --porcelain` đầu bước, file thay đổi hoặc mới trong bước
  (`git diff --name-only` và `git ls-files --others --exclude-standard`) chỉ gồm (a) file migration MỚI trong thư
  mục migration và (b) file code thuộc nơi dùng đã xác định ở Bước 1; không có file migration đã có trên base
  branch bị sửa.
- **Khi fail:** build đỏ → chẩn đoán → sửa → build lại; `data-migration-writer` trả `blocked` + câu hỏi → session
  chính hỏi người dùng; quyết định làm đổi kế hoạch → quay lại Bước 2, ngược lại ghi vào report bước rồi gọi lại
  agent; diff ngoài phạm vi → revert phần lệch, không nhận.
- **Evidence:** lệnh build + exit code 0; report của `data-migration-writer` (công cụ/engine, file migration mới
  theo pha, `compensating_sql`, `next_actions`); danh sách file thay đổi hoặc mới trong bước so với mốc đầu bước.

### Bước 4 — Review query/index

- **Thực hiện:** agent `backend-reviewer`
- **Đầu vào:** migration + code từ Bước 3
- **Hành động:** review query mới/đổi và index liên quan (thiếu index gây scan toàn bảng, index thừa,
  N+1 query phát sinh từ thay đổi schema).
- **Ràng buộc:** chỉ đọc, không tự sửa code.
- **Đầu ra:** danh sách finding theo severity (contract đầu ra, `core:principles`).
- **Gate:** 0 blocker.
- **Khi fail:** còn finding `blocker` → quay lại Bước 3 sửa, review lại phần đã sửa.
- **Evidence:** danh sách finding (severity/category/location/evidence/confidence).

### Bước 5 — Xác nhận DB đích ⏸

- **Thực hiện:** session chính
- **Đầu vào:** migration đã qua review từ Bước 4
- **Hành động:** đọc cấu hình kết nối mà migration tool sẽ dùng (profile/biến môi trường, host, tên database);
  trình cho người dùng target đó, đã mask mọi credential.
- **Ràng buộc:** không đọc/in giá trị secret, chỉ nêu tên biến và host/tên database; không chạy lệnh migration
  nào ở bước này.
- **Đầu ra:** target DB đã được người dùng xác nhận là DB test.
- **Gate:** người dùng xác nhận rõ ràng target là DB test, không phải production.
- **Khi fail:** target trỏ production hoặc người dùng không chắc → dừng, không chạy migration.
- **Evidence:** tên profile/biến môi trường + host + tên database (đã mask) + xác nhận của người dùng.

### Bước 6 — Chạy thử trên DB test

- **Thực hiện:** session chính (theo skill `data-db-migration`, chế độ `change`, bước C4)
- **Đầu vào:** migration đã qua review từ Bước 4 + target DB đã xác nhận ở Bước 5
- **Hành động:** Chu trình verify theo `references/change/verify-cycle.md` của skill. Chạy chu trình verify theo
  công cụ migration của project trên DB test. Công cụ có rollback
  (vd Liquibase, Alembic): migrate up → rollback → migrate up lại. Công cụ forward-only (vd Flyway khi dùng
  theo hướng forward-only): migrate up, rồi áp migration bù (đoạn SQL migration bù lấy từ report Bước 3, không
  phải file trong thư mục migration) bằng tay trên DB đã xác nhận ở Bước 5 và kiểm schema/dữ liệu sau từng
  lượt; nếu Bước 2 chưa thiết kế migration bù cho thay đổi này thì quay lại Bước 2 bổ sung, không tự bịa
  migration bù. Xác nhận mọi lượt thành công.
- **Ràng buộc:** chỉ chạy trên đúng target đã xác nhận ở Bước 5 (cấu hình kết nối đổi → quay lại Bước 5);
  cấm chạy trên DB production; cấm thay đổi phá huỷ dữ liệu khi chưa được người dùng xác nhận ở Bước 2; không
  giả lập lượt rollback bằng cách sửa tay schema.
- **Đầu ra:** kết quả chu trình verify theo công cụ trên DB test.
- **Gate:** chu trình verify theo công cụ thành công (up → rollback → up, hoặc up → migration bù → kiểm schema),
  có evidence lệnh.
- **Khi fail:** một lượt trong chu trình verify thất bại → quay lại Bước 3 sửa migration, chạy lại cả chu
  trình từ đầu.
- **Evidence:** lệnh từng lượt + exit code từng lượt, ghi rõ công cụ và chế độ (có rollback / forward-only).

### Bước 7 — Test

- **Thực hiện:** agent `backend-test-writer`
- **Đầu vào:** migration + code đã qua Bước 4–6 + nơi dùng đã xác định ở Bước 1
- **Hành động:** viết integration test cho repository/query bị ảnh hưởng: đọc/ghi qua schema mới; khi đang ở
  giai đoạn expand, kiểm code cũ vẫn đọc được dữ liệu. Dùng DB tạm (Testcontainers hoặc tương đương của
  project) hoặc đúng target đã xác nhận ở Bước 5; chạy test và ghi kết quả.
- **Ràng buộc:** không chạy trên DB production hay target chưa xác nhận (DB tạm do chính test tự dựng, vd
  Testcontainers, là ngoại lệ); không sửa code production — bug thật thì giữ test đỏ và báo; không xoá/nới
  test để qua.
- **Đầu ra:** integration test cho query/repository bị ảnh hưởng, chạy được.
- **Gate:** integration test pass; so với trạng thái ghi lại ở đầu bước (`git status --porcelain`), các file
  thay đổi hoặc mới trong bước (`git diff --name-only` và `git ls-files --others --exclude-standard`) chỉ gồm
  file test (và fixture/mock của test).
- **Khi fail:** lỗi do test → sửa test; lỗi do code hoặc migration → quay lại Bước 3 sửa, chạy lại từ Bước 4;
  project không có DB tạm (Docker/Testcontainers) → chạy trên target đã xác nhận ở Bước 5, hoặc hỏi người dùng
  nếu chưa có, không tự dựng hạ tầng.
- **Evidence:** lệnh chạy test + exit code + số liệu pass/fail; danh sách file thay đổi hoặc mới trong bước so
  với trạng thái đầu bước.

### Bước 8 — Cập nhật data-model & nợ contract

- **Thực hiện:** session chính
- **Đầu vào:** migration + code + test đã qua Bước 1–7
- **Hành động:** cập nhật `project-knowledge/data-model.md` (ERD) theo schema mới; nếu thay đổi theo
  expand/contract và còn pha contract chưa làm (xoá cột/ràng buộc cũ ở migration sau), ghi việc đó vào
  `next_actions` của report cuối kèm điều kiện thực hiện; pha contract còn nợ lấy từ `next_actions` trong
  report Bước 3.
- **Ràng buộc:** chỉ sửa phần ERD/tài liệu liên quan tới thay đổi; không sửa vùng managed block của
  `AGENTS.md`/`CLAUDE.md`; không thực hiện pha contract trong workflow này.
- **Đầu ra:** `data-model.md` đã cập nhật (hoặc "không ảnh hưởng" kèm lý do) + nợ contract đã ghi vào
  `next_actions` (hoặc "không có").
- **Gate:** data-model cập nhật hoặc ghi "không ảnh hưởng"; nợ contract được ghi nếu có.
- **Khi fail:** không tìm thấy `data-model.md` → hỏi người dùng nơi lưu ERD, không tự tạo file mới.
- **Evidence:** đường dẫn file đã cập nhật + danh sách nợ contract (hoặc "không có").

### Bước 9 — Commit ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** migration + code + test + docs đã qua Bước 1–8
- **Hành động:** đề xuất commit message Conventional Commits (header EN, body VI); trình diff cho người dùng
  duyệt.
- **Ràng buộc:** không tự commit khi người dùng chưa duyệt diff; không push trừ khi được yêu cầu.
- **Đầu ra:** commit đã tạo (sau khi người dùng duyệt).
- **Gate:** người dùng duyệt diff.
- **Khi fail:** người dùng yêu cầu sửa thêm → quay lại bước tương ứng, không commit tạm.
- **Evidence:** hash commit + message.

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 2 | Thiết kế migration forward + rollback + tương thích ngược | Người dùng xác nhận thiết kế |
| 5 | Target DB (profile, host, tên database — đã mask) | Người dùng xác nhận rõ ràng target là DB test |
| 9 | Diff migration + code + test + docs | Người dùng duyệt diff |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Build fail | Chẩn đoán → sửa → build lại |
| Test fail | Phân tích failure → sửa code (không xoá/nới test) → chạy lại |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` | Chặn hoàn thành cho tới khi sửa hoặc người dùng chấp nhận rủi ro |
| Người dùng không xác nhận thiết kế migration (sau Bước 2 ⏸) | Quay lại Bước 1 làm rõ impact/ràng buộc |
| Target DB trỏ production hoặc chưa được xác nhận (sau Bước 5 ⏸) | Dừng, không chạy migration |
| Một lượt trong chu trình verify thất bại (Bước 6) | Quay lại Bước 3 sửa migration, chạy lại cả chuỗi từ đầu |
| Integration test đỏ (Bước 7) | Lỗi test → sửa test; lỗi code/migration → quay lại Bước 3 (không nới test) |
| Người dùng không duyệt diff (sau Bước 9 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |
| Thay đổi phá huỷ dữ liệu chưa được xác nhận | Cấm thực hiện; quay lại Bước 2 xin xác nhận rõ ràng |
| Agent migration trả `blocked` (Bước 3) | Người dùng quyết định; đổi kế hoạch → quay lại Bước 2, ngược lại ghi vào report Bước 3 rồi gọi lại agent |
| Yêu cầu chạy migration trên production | Cấm thực hiện; chỉ chạy trên DB test |

- **Điều kiện dừng:** người dùng không xác nhận thiết kế migration sau nhiều vòng; chu trình verify migration
  liên tục thất bại; finding `blocker` không sửa được; người dùng không duyệt diff; yêu cầu chạy migration
  trên production.
- **Rollback:** migration đã viết có sẵn script rollback riêng, hoặc migration bù với công cụ forward-only
  (Bước 2); trước checkpoint commit, chưa có gì để rollback ở tầng git; workflow không tự chạy migration trên
  production nên không cần rollback ở đó.

## Definition of Done

- [ ] Bảng/cột/index bị ảnh hưởng + nơi dùng trong code — evidence: Bước 1
- [ ] Thiết kế migration forward + rollback + tương thích ngược đã xác nhận — evidence: Bước 2
- [ ] Build xanh sau implement — evidence: Bước 3
- [ ] 0 finding blocker ở review query/index — evidence: Bước 4
- [ ] Target DB đã được người dùng xác nhận là DB test — evidence: Bước 5
- [ ] Chu trình verify theo công cụ thành công trên DB test — evidence: Bước 6
- [ ] Integration test cho query/repository bị ảnh hưởng pass — evidence: Bước 7
- [ ] `data-model.md` cập nhật (hoặc "không ảnh hưởng"); nợ contract ghi vào `next_actions` — evidence: Bước 8
- [ ] Người dùng đã duyệt diff và commit đã tạo — evidence: Bước 9
- [ ] Mọi gate có evidence `passed`
- [ ] 0 finding `blocker`

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
workflow_result:
  workflow: workflow-db-change
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
  next_actions: []         # gồm migration pha contract còn nợ (xoá cột/ràng buộc cũ ở đợt sau)
```
