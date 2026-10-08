---
name: workflow-release
description: "Điều phối chuẩn bị release: baseline build/test, quality gate, release notes/CHANGELOG, commit release (version bump), deploy checklist + điều kiện rollback + migration chờ chạy, người dùng tự deploy, hậu kiểm, chỉ đề xuất lệnh tag/push chờ xác nhận. Dùng khi người dùng muốn \"release\", \"phát hành\", \"chuẩn bị deploy\", \"ra version\". Không dùng khi chưa sẵn sàng, cần thêm tính năng trước → workflow-feature; cần sửa lỗi trước → workflow-bugfix."
order: 11
title: "Release — quality gate, release notes, deploy checklist"
kind: workflow
tier: 2
risk: high
agents: "engineering-quality-auditor,engineering-release-scribe,ops-release-engineer,frontend-e2e-test-writer"
requires: "core/git-workflow"
runsIn: execute
invoke: per-request
---

# Release — quality gate, release notes, deploy checklist

## Mục tiêu & đầu vào

- **Mục tiêu:** xác nhận chất lượng đủ điều kiện release (đo baseline build/test trước; kiểm migration chờ
  chạy khi lập deploy checklist), có release notes đúng phạm vi, commit release (CHANGELOG + version bump),
  deploy checklist kèm điều kiện rollback, người dùng deploy, hậu kiểm sau deploy, và chỉ đề xuất lệnh tag/push trên
  commit release, chờ người dùng xác nhận.
- **Đầu vào bắt buộc:** phạm vi release (tag/version dự kiến, khoảng commit hoặc branch).
- **Đầu vào tuỳ chọn:** CHANGELOG hiện có, deploy checklist mẫu của project.

## Điều kiện tiên quyết

- Skill/agent đã cài: `engineering-quality-auditor`, `engineering-release-scribe`, `ops-release-engineer`,
  `frontend-e2e-test-writer` (chỉ khi project có e2e), skill `core/git-workflow`.
- Plugin cần cài thêm: `ops` (không nằm trong dependency của plugin workflows; xem preamble).
- Artifact phải có sẵn: git log của phạm vi release (tag trước hoặc khoảng commit xác định được).
- Baseline: build/test của branch release đang XANH — được đo và ghi số mốc ở Bước 1 trước khi chạy quality gate.

Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.

## Các bước

Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.

### Bước 1 — Baseline build/test

- **Thực hiện:** session chính
- **Đầu vào:** phạm vi release của người dùng
- **Hành động:** chạy build và test của branch release theo lệnh của project; ghi số mốc (lệnh, exit code,
  số test pass/fail) làm baseline cho các bước sau.
- **Ràng buộc:** chỉ chạy build/test cục bộ; không chạy lệnh tác động môi trường (deploy, migration); không
  sửa code để làm xanh.
- **Đầu ra:** baseline build/test (lệnh + exit code + số liệu).
- **Gate:** build/test xanh (exit code 0) và số mốc đã ghi.
- **Khi fail:** build/test đỏ → dừng `blocked`, đề xuất `workflow-bugfix`; không chạy quality gate trên
  baseline đỏ.
- **Evidence:** lệnh build/test + exit code + số liệu pass/fail.

### Bước 2 — Quality gate ⏸

- **Thực hiện:** agent `engineering-quality-auditor`
- **Đầu vào:** phạm vi release của người dùng + baseline xanh từ Bước 1
- **Hành động:** chạy quality gate (scan/lint/security) trên phạm vi release; trình kết quả cho người dùng
  xác nhận trước khi tiếp tục.
- **Ràng buộc:** chỉ đọc, không tự sửa code.
- **Đầu ra:** danh sách finding theo severity (contract đầu ra, `core:principles`).
- **Gate:** 0 blocker.
- **Khi fail:** còn finding `blocker` → dừng, đề xuất `workflow-bugfix`/`workflow-security-review` tuỳ loại
  finding, không tự sửa.
- **Evidence:** danh sách finding (severity/category/location/evidence/confidence).

### Bước 3 — Release notes ⏸

- **Thực hiện:** agent `engineering-release-scribe`
- **Đầu vào:** git log phạm vi release + quality gate đã pass từ Bước 2
- **Hành động:** gom commit trong phạm vi thành release notes/CHANGELOG theo type/scope; trình cho người
  dùng xác nhận nội dung đúng phạm vi.
- **Ràng buộc:** không đưa commit ngoài phạm vi release vào notes.
- **Đầu ra:** release notes/CHANGELOG đã xác nhận.
- **Gate:** notes/CHANGELOG từ git log đúng phạm vi.
- **Khi fail:** người dùng chỉ ra thiếu/thừa mục → sửa lại theo git log, trình lại.
- **Evidence:** đường dẫn/nội dung release notes + xác nhận của người dùng.

### Bước 4 — Version bump & commit release ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** release notes/CHANGELOG đã xác nhận từ Bước 3 + version dự kiến
- **Hành động:** bump version theo quy ước của project (vd `package.json`, `pom.xml`) đúng version dự kiến;
  gom CHANGELOG + version bump vào một commit release; trình diff cho người dùng duyệt.
- **Ràng buộc:** không tự commit khi người dùng chưa duyệt diff; không push trừ khi được yêu cầu; không đưa
  thay đổi code vào commit release.
- **Đầu ra:** commit release chứa CHANGELOG + version bump (sau khi người dùng duyệt).
- **Gate:** commit release đã tạo, chứa CHANGELOG + version bump khớp version dự kiến.
- **Khi fail:** người dùng yêu cầu sửa notes/version → quay lại Bước 3 hoặc sửa version, không commit tạm.
- **Evidence:** hash commit release + `git show --stat` liệt kê CHANGELOG và file version.

### Bước 5 — Deploy checklist

- **Thực hiện:** agent `ops-release-engineer` ∥ agent `frontend-e2e-test-writer` (smoke e2e tuỳ chọn — chỉ khi
  project có `e2e/`)
- **Đầu vào:** commit release từ Bước 4
- **Hành động:** lập checklist các bước deploy theo quy trình project; ghi rõ điều kiện rollback (khi nào
  cần rollback, cách rollback). Liệt kê migration schema nằm trong phạm vi release (thư mục migration của
  project, so với tag trước) và ghi thứ tự migration↔deploy: migration tương thích ngược chạy trước khi
  deploy code mới, migration phá tương thích chỉ sau khi code cũ đã ngừng dùng; migration nào đã áp trên môi
  trường đích do người dùng xác nhận. Smoke e2e (tuỳ chọn): `frontend-e2e-test-writer` chạy 1–3 luồng e2e
  giá trị cao **đã có** trên bản release candidate (commit release Bước 4) chạy ở local/test,
  `npx playwright test` theo skill `frontend-e2e-testing` [lệnh cụ thể theo project]; không viết test mới,
  không sửa test; thiếu môi trường BE/DB test → `not_run` + lý do. Chế độ smoke: luồng lấy từ e2e đã có (hoặc
  người dùng chỉ định trong Bước 5) — bỏ qua E2/E3; flaky → chạy lại `--repeat-each=3`, không sửa test; vẫn
  flaky → báo `failed`, dừng release.
- **Ràng buộc:** không tự thực hiện deploy và không tự chạy migration — chỉ lập checklist và đề xuất thứ tự;
  smoke chỉ trên local/test, không trỏ staging/production (E-r3); không viết hay sửa file test trong bước này.
- **Đầu ra:** deploy checklist + điều kiện rollback + danh sách migration chờ chạy kèm thứ tự (hoặc "không có
  migration") + kết quả smoke e2e (pass/fail/`not_run` + lý do) hoặc "không có e2e".
- **Gate:** checklist + điều kiện rollback + kiểm migration (danh sách hoặc "không có migration"); smoke e2e
  pass, hoặc `not_run` có lý do (ghi vào `remaining_risks`), hoặc "không có e2e"; so với mốc
  `git status --porcelain` đầu bước, smoke không thay đổi file nào ngoài output báo cáo/trace của Playwright.
- **Khi fail:** thiếu bước quan trọng trong quy trình project, hoặc không xác định được migration nào đã áp
  → bổ sung/hỏi người dùng, ghi rõ lý do; smoke e2e đỏ vì hành vi sai → dừng, không deploy, đề xuất
  `workflow-bugfix`; đỏ vì flaky → chạy lại, không sửa test; flaky kéo dài = `failed` → không deploy.
- **Evidence:** deploy checklist và danh sách migration trong report bước; smoke: lệnh Playwright +
  kết quả/trace hoặc `not_run` + lý do.

### Bước 6 — Deploy ⏸

- **Thực hiện:** session chính
- **Đầu vào:** deploy checklist + điều kiện rollback + kết quả smoke e2e (pass / `not_run` + lý do / "không có
  e2e") từ Bước 5
- **Hành động:** trình checklist cho người dùng; người dùng tự deploy commit release theo checklist rồi báo
  đã deploy, hoặc chủ động hoãn deploy.
- **Ràng buộc:** không agent nào tự deploy hay chạy lệnh tác động môi trường; chỉ đi tiếp khi người dùng báo
  rõ đã deploy hoặc đã hoãn.
- **Đầu ra:** xác nhận của người dùng: đã deploy (kèm thời điểm, môi trường) hoặc hoãn deploy.
- **Gate:** người dùng xác nhận đã deploy commit release, hoặc xác nhận hoãn.
- **Khi fail:** deploy lỗi giữa chừng → dừng, áp điều kiện rollback của Bước 5 (người dùng thực hiện), đề
  xuất `workflow-incident` nếu production bị ảnh hưởng.
- **Evidence:** xác nhận của người dùng + thời điểm và môi trường deploy (hoặc lý do hoãn).

### Bước 7 — Hậu kiểm

- **Thực hiện:** agent `ops-release-engineer`
- **Đầu vào:** xác nhận deploy từ Bước 6
- **Hành động:** nếu đã deploy, kiểm health/observability (log lỗi, metric, alert) sau deploy; nếu người dùng
  hoãn deploy ở Bước 6, ghi `not_run` kèm lý do.
- **Ràng buộc:** không tự deploy để hậu kiểm — chỉ kiểm khi deploy đã xảy ra.
- **Đầu ra:** kết quả hậu kiểm, hoặc `not_run` có lý do.
- **Gate:** health/observability bình thường sau deploy, hoặc `not_run` nếu đã hoãn deploy.
- **Khi fail:** health/observability bất thường sau deploy → dừng, đề xuất `workflow-incident`.
- **Evidence:** log/metric hậu kiểm, hoặc lý do `not_run`.

### Bước 8 — Tag ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** commit release (Bước 4) + kết quả hậu kiểm (Bước 7)
- **Hành động:** chỉ đề xuất lệnh tag/push trỏ vào đúng commit release của Bước 4; chờ người dùng xác nhận
  trước khi chạy.
- **Ràng buộc:** không tự chạy lệnh tag/push khi chưa được xác nhận; không push trừ khi được yêu cầu.
- **Đầu ra:** lệnh tag/push đề xuất, đã chạy (sau khi người dùng xác nhận) hoặc còn chờ.
- **Gate:** chỉ đề xuất lệnh tag/push, chờ xác nhận.
- **Khi fail:** người dùng chưa xác nhận → giữ nguyên đề xuất, không tự chạy.
- **Evidence:** lệnh tag/push đề xuất + xác nhận của người dùng (nếu đã chạy: hash tag).

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 2 | Danh sách finding quality gate | Người dùng xác nhận 0 blocker |
| 3 | Release notes/CHANGELOG | Người dùng xác nhận đúng phạm vi |
| 4 | Diff commit release (CHANGELOG + version bump) | Người dùng duyệt diff |
| 6 | Deploy checklist + điều kiện rollback + migration chờ chạy + kết quả smoke e2e | Người dùng báo đã deploy, hoặc hoãn deploy |
| 8 | Lệnh tag/push đề xuất trên commit release | Người dùng xác nhận rõ ràng trước khi chạy |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Build fail (Bước 1) | Dừng `blocked`, đề xuất `workflow-bugfix`; không chạy quality gate trên baseline đỏ |
| Test fail (Bước 1) | Dừng `blocked`, đề xuất `workflow-bugfix`; không sửa/nới test trong workflow này |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` (sau Bước 2 ⏸) | Dừng, đề xuất `workflow-bugfix`/`workflow-security-review`, không tự sửa |
| Người dùng không xác nhận release notes (sau Bước 3 ⏸) | Sửa lại theo git log, trình lại |
| Người dùng không duyệt commit release (sau Bước 4 ⏸) | Không commit, quay lại Bước 3 hoặc sửa version |
| Không xác định được migration nào đã áp (Bước 5) | Hỏi người dùng, không tự suy; không tự chạy migration |
| Smoke e2e đỏ trước deploy (Bước 5) | Dừng, không deploy; đề xuất `workflow-bugfix`; flaky → chạy lại, không sửa test; flaky kéo dài = `failed`, không deploy |
| Deploy lỗi giữa chừng (sau Bước 6 ⏸) | Dừng, người dùng áp điều kiện rollback của Bước 5; đề xuất `workflow-incident` nếu production bị ảnh hưởng |
| Health/observability bất thường sau deploy (Bước 7) | Dừng, đề xuất `workflow-incident` |
| Người dùng không xác nhận lệnh tag/push (sau Bước 8 ⏸) | Giữ nguyên đề xuất, không tự chạy |

- **Điều kiện dừng:** baseline build/test đỏ; finding `blocker` chưa xử lý; release notes sai phạm vi chưa
  sửa được; người dùng không duyệt commit release; deploy lỗi; health/observability bất thường sau deploy;
  smoke e2e đỏ hoặc flaky kéo dài; người dùng không xác nhận tag/push.
- **Rollback:** rollback deploy theo điều kiện đã ghi ở Bước 5 (người vận hành thực hiện); commit release
  chưa push có thể bỏ bằng thao tác git thủ công của người dùng (workflow không tự `reset --hard`); workflow
  không tự chạy tag/push nên không có gì để rollback ở tầng tag trước khi người dùng xác nhận.

## Definition of Done

- [ ] Baseline build/test xanh, số mốc đã ghi — evidence: Bước 1
- [ ] Quality gate 0 blocker — evidence: Bước 2
- [ ] Release notes/CHANGELOG đúng phạm vi đã xác nhận — evidence: Bước 3
- [ ] Commit release chứa CHANGELOG + version bump đã được duyệt — evidence: Bước 4
- [ ] Deploy checklist + điều kiện rollback + kiểm migration chờ chạy + smoke e2e pass/`not_run` có lý do/không
  có e2e — evidence: Bước 5
- [ ] Người dùng đã deploy hoặc xác nhận hoãn — evidence: Bước 6
- [ ] Hậu kiểm bình thường hoặc `not_run` có lý do — evidence: Bước 7
- [ ] Lệnh tag/push trên commit release đã đề xuất, chờ hoặc đã có xác nhận — evidence: Bước 8
- [ ] Mọi gate có evidence `passed`
- [ ] 0 finding `blocker`

## Report cuối

Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.

```yaml
workflow_result:
  workflow: workflow-release
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
