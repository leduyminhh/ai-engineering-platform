---
name: workflow-api
description: "Điều phối làm API contract-first: chốt OpenAPI 3.1 trước khi code, implement backend, test integration + contract, kiểm drift, review authorization/input, cập nhật docs, commit. Dùng khi người dùng muốn \"làm API\", \"thêm endpoint\", \"OpenAPI\", \"contract-first\". Không dùng khi không cần contract mới, chỉ đổi logic nội bộ để thêm tính năng → workflow-feature; sửa lỗi → workflow-bugfix."
order: 8
title: "API — contract-first, implement, kiểm drift"
kind: workflow
tier: 2
risk: medium
agents: "backend-implementer,backend-test-writer,backend-reviewer,engineering-quality-auditor,frontend-data-integrator"
requires: "backend/backend-api-contract,core/git-workflow"
runsIn: execute
invoke: per-request
---

# API — contract-first, implement, kiểm drift

## Mục tiêu & đầu vào

- **Mục tiêu:** có endpoint API mới/đổi, contract OpenAPI 3.1 hợp lệ chốt trước khi code, backend implement
  khớp contract, test integration + contract pass, 0 drift contract↔code, 0 finding blocker về
  authorization/input validation, docs cập nhật.
- **Đầu vào bắt buộc:** mô tả endpoint cần làm (mục đích, request/response, ai gọi).
- **Đầu vào tuỳ chọn:** contract OpenAPI hiện có (nếu là đổi endpoint đã có), FE có cần nối client hay không.

## Điều kiện tiên quyết

- Skill/agent đã cài: `backend-implementer`, `backend-test-writer`, `backend-reviewer`,
  `engineering-quality-auditor`, `frontend-data-integrator` (chỉ khi nối FE ở Bước 6), skill
  `backend/backend-api-contract`, `core/git-workflow`.
- Artifact phải có sẵn: `docs/contracts/` của project (nếu đã có API khác) để giữ nhất quán versioning.
- Baseline: build/test hiện tại của backend đang XANH trước khi thêm endpoint — được đo và ghi số mốc ở Bước 1.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Baseline build/test

- **Thực hiện:** session chính
- **Đầu vào:** mô tả endpoint của người dùng
- **Hành động:** chạy build và test của backend theo lệnh của project; ghi số mốc (lệnh, exit code, số test
  pass/fail) làm baseline cho các bước sau.
- **Ràng buộc:** chỉ chạy build/test cục bộ; không chạy lệnh tác động môi trường; không sửa code để làm xanh.
- **Đầu ra:** baseline build/test (lệnh + exit code + số liệu).
- **Gate:** build/test xanh (exit code 0) và số mốc đã ghi.
- **Khi fail:** đỏ → dừng `blocked`, đề xuất `workflow-bugfix`; không thêm endpoint trên baseline đỏ.
- **Evidence:** lệnh build/test + exit code + số liệu pass/fail.

### Bước 2 — Contract ⏸

- **Thực hiện:** agent `backend-implementer` (skill `backend-api-contract`)
- **Đầu vào:** mô tả endpoint của người dùng
- **Hành động:** thiết kế/cập nhật OpenAPI 3.1 tại `docs/contracts/`; nếu là breaking change trên endpoint đã
  có, thêm versioning/deprecation theo lộ trình; trình cho người dùng xác nhận trước khi implement.
- **Ràng buộc:** không code trước khi contract được xác nhận.
- **Đầu ra:** file OpenAPI 3.1 đã cập nhật, đã được người dùng xác nhận.
- **Gate:** OpenAPI 3.1 hợp lệ; breaking change có versioning/deprecation.
- **Khi fail:** người dùng không đồng ý contract → sửa lại theo góp ý, trình lại.
- **Evidence:** đường dẫn file contract + xác nhận của người dùng.

### Bước 3 — Implement BE

- **Thực hiện:** agent `backend-implementer`
- **Đầu vào:** contract đã xác nhận từ Bước 2
- **Hành động:** implement controller/handler khớp đúng request/response của contract.
- **Ràng buộc:** không tự đổi contract khi implement — lệch thì quay lại Bước 2 sửa contract trước.
- **Đầu ra:** code backend khớp contract.
- **Gate:** build xanh.
- **Khi fail:** build đỏ → chẩn đoán → sửa → build lại.
- **Evidence:** lệnh build + exit code 0.

### Bước 4 — Test

- **Thực hiện:** agent `backend-test-writer`
- **Đầu vào:** code backend từ Bước 3 + contract từ Bước 2
- **Hành động:** viết integration test cho endpoint + contract test đối chiếu response thật với schema OpenAPI.
- **Ràng buộc:** không viết test giòn phụ thuộc dữ liệu ngoài tầm kiểm soát.
- **Đầu ra:** integration test + contract test, chạy được.
- **Gate:** integration + contract test pass; so với trạng thái ghi lại ở đầu bước (`git status --porcelain`),
  các file thay đổi hoặc mới trong bước (`git diff --name-only` và `git ls-files --others --exclude-standard`)
  chỉ gồm file test (và fixture/mock của test).
- **Khi fail:** test fail → phân tích failure → sửa code (không xoá/nới test) → chạy lại.
- **Evidence:** lệnh chạy test + exit code + số liệu pass/fail; danh sách file thay đổi hoặc mới trong bước so
  với trạng thái đầu bước.

### Bước 5 — Kiểm drift & bảo mật

- **Thực hiện:** agent `backend-reviewer` ∥ agent `engineering-quality-auditor`
- **Đầu vào:** contract + code + test đã qua Bước 1–4
- **Hành động:** `backend-reviewer` đối chiếu endpoint/DTO thực tế với contract (thiếu/thừa field, kiểu sai,
  endpoint lệch). `engineering-quality-auditor` review endpoint mới/đổi về authorization (mỗi endpoint có kiểm
  quyền theo vai trò/chủ sở hữu tài nguyên, không lộ dữ liệu của người khác) và input validation (ràng buộc
  trong schema contract được thực thi ở server); mask mọi secret nếu gặp.
- **Ràng buộc:** chỉ đọc, không tự sửa code; không in giá trị secret.
- **Đầu ra:** danh sách drift (nếu có) hoặc xác nhận 0 drift; danh sách finding bảo mật theo severity (contract
  đầu ra, `core:principles`).
- **Gate:** 0 drift contract↔code; 0 finding `blocker` về authorization/input validation.
- **Khi fail:** phát hiện drift → quay lại Bước 3 sửa code hoặc Bước 2 sửa contract; còn finding `blocker` bảo
  mật → quay lại Bước 3 sửa code; review lại phần đã sửa.
- **Evidence:** danh sách đối chiếu contract↔code + danh sách finding bảo mật (severity/category/location/evidence/confidence) trong report bước.

### Bước 6 — FE client (tuỳ chọn)

- **Thực hiện:** agent `frontend-data-integrator` (chỉ khi người dùng yêu cầu nối FE)
- **Đầu vào:** contract đã qua kiểm drift từ Bước 5 + màn hình/component FE đã có (do `frontend-implement` dựng,
  chỗ cần dữ liệu để trống bằng `props` + `TODO`)
- **Hành động:** agent nối UI với endpoint mới theo skill `frontend-data-integration`: dùng type sinh từ contract
  bằng codegen sẵn có của project, tạo data hook đúng tầng kiến trúc, nối ở container/page, đủ 4 trạng thái
  loading/error/empty/success; chạy `tsc --noEmit`, lint, build. Người dùng không yêu cầu nối FE → ghi "bỏ qua".
  Người dùng muốn nối FE nhưng chưa có màn hình (chưa chạy `frontend-implement`) → ghi "bỏ qua" +
  `next_actions: workflow-feature`.
- **Ràng buộc:** không sửa `docs/contracts/` để hợp với FE — lệch contract thì dừng, quay lại Bước 2; chưa có
  codegen hoặc thư viện data → agent dừng, đề xuất, chờ người dùng chọn (không tự thêm); không viết tay type trùng
  contract; không gọi `fetch`/`axios` trong component.
- **Đầu ra:** type/hook/container FE khớp contract, `tsc`/lint/build xanh; hoặc dòng "bỏ qua".
- **Gate:** type khớp contract, `tsc`/lint/build xanh; hoặc ghi "bỏ qua".
- **Khi fail:** type/hook không khớp contract → sửa FE theo đúng contract, không sửa contract để hợp FE; thiếu
  codegen/thư viện data → dừng chờ người dùng chọn.
- **Evidence:** report của agent (file đã thêm/sửa theo tầng, endpoint ↔ hook ↔ container, lệnh `tsc`/lint/build +
  exit code), hoặc dòng "bỏ qua" trong report bước.

### Bước 7 — Docs

- **Thực hiện:** session chính
- **Đầu vào:** contract + code + test đã qua Bước 1–6
- **Hành động:** cập nhật docs API bị ảnh hưởng (README/API docs/ví dụ request-response) theo contract đã chốt.
- **Ràng buộc:** docs phải khớp contract; không sửa vùng managed block của `AGENTS.md`/`CLAUDE.md`.
- **Đầu ra:** docs API cập nhật, hoặc ghi rõ "không ảnh hưởng".
- **Gate:** docs API bị ảnh hưởng đã cập nhật hoặc ghi "không ảnh hưởng".
- **Khi fail:** không xác định được docs nào bị ảnh hưởng → hỏi lại người dùng.
- **Evidence:** danh sách file docs đã cập nhật, hoặc dòng "không ảnh hưởng".

### Bước 8 — Commit ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** contract + code + test + docs đã qua Bước 1–7
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
| 2 | OpenAPI 3.1 (mới/đổi) + versioning/deprecation nếu breaking | Người dùng xác nhận contract |
| 8 | Docs API + diff code/test | Người dùng duyệt diff |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Baseline đỏ (Bước 1) | Dừng `blocked`, không tiếp tục trên baseline đỏ; đề xuất workflow-bugfix |
| Build fail | Chẩn đoán → sửa → build lại |
| Test fail | Phân tích failure → sửa code (không xoá/nới test) → chạy lại |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` | Chặn hoàn thành cho tới khi sửa hoặc người dùng chấp nhận rủi ro |
| Người dùng không xác nhận contract (sau Bước 2 ⏸) | Sửa lại theo góp ý, trình lại, không code trước |
| Phát hiện drift contract↔code (Bước 5) | Quay lại Bước 3 sửa code hoặc Bước 2 sửa contract |
| Finding `blocker` về authorization/input validation (Bước 5) | Quay lại Bước 3 sửa code, review lại phần đã sửa |
| Contract lệch khi nối FE (Bước 6) | Dừng, quay lại Bước 2 chỉnh contract; không sửa contract để hợp FE |
| Người dùng không duyệt diff (sau Bước 8 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |

- **Điều kiện dừng:** người dùng không xác nhận contract sau nhiều vòng; drift contract↔code không sửa được;
  finding `blocker` không sửa được; người dùng không duyệt diff.
- **Rollback:** trước khi contract được xác nhận ở Bước 2, chưa có code nào được viết nên không cần rollback;
  sau đó, chưa có gì để rollback ở tầng git cho tới checkpoint commit.

## Definition of Done

- [ ] Baseline build/test đã đo, số mốc đã ghi — evidence: Bước 1
- [ ] Contract OpenAPI 3.1 hợp lệ đã xác nhận — evidence: Bước 2
- [ ] Build xanh sau implement BE — evidence: Bước 3
- [ ] Integration + contract test pass — evidence: Bước 4
- [ ] 0 drift contract↔code và 0 finding `blocker` về authorization/input validation — evidence: Bước 5
- [ ] FE client khớp contract hoặc ghi "bỏ qua" — evidence: Bước 6
- [ ] Docs API cập nhật hoặc ghi "không ảnh hưởng" — evidence: Bước 7
- [ ] Người dùng đã duyệt diff và commit đã tạo — evidence: Bước 8
- [ ] Mọi gate có evidence `passed`
- [ ] 0 finding `blocker`

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
workflow_result:
  workflow: workflow-api
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
