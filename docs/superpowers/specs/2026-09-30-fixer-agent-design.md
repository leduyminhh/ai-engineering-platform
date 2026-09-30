# Thiết kế: Agent `*-fixer` + skill `*-fix` — khoá phạm vi bước sửa code trong workflow (A4/Q2)

- Ngày: 2026-09-30
- Trạng thái: **Đã thực thi** trên nhánh `feature/fixer-agent` (2026-09-30), chờ merge; các sửa sau review toàn
  nhánh ghi ở §8.
- Phạm vi: đóng mục A4 (§8.5) và Q2 (§11) của spec
  [`2026-09-29-skill-plugin-workflow-upgrade-design.md`](2026-09-29-skill-plugin-workflow-upgrade-design.md)
  — chuyển các bước "sửa code ở session chính" (W-b, §5.2) của `workflow-bugfix`, `workflow-security-review`,
  `workflow-performance` sang agent có hợp đồng riêng. `workflow-db-change` Bước 3 **không** thuộc spec này
  (thuộc WF3/P1b).
- Người duyệt: chủ dự án.
- Nền: spec 2026-09-25 (§5.1 contract agent, §9 gap), spec 2026-09-29 (§5.2 W-b, §8.4 checklist agent, §8.5 A3/A4,
  §11 Q2/Q4), ADR-0001.

---

## 0. Cách đọc & nhãn

| Nhãn | Nghĩa |
|---|---|
| (không nhãn) | Đã kiểm chứng: đọc file hoặc grep, có `file:dòng` hay tên bước đi kèm |
| `[Inference]` | Suy luận từ nội dung đã đọc, chưa chạy thực tế |
| `[Unverified]` | Chưa kiểm chứng được (hành vi client thật) |
| `[Đề xuất]` | Quyết định thiết kế chờ duyệt |

Số bước workflow trích theo **tên bước** và theo số bước **hiện tại** trên `master` = `0a22df5` (sau WF11 đánh
số lại).

---

## 1. Vấn đề & mục tiêu

### 1.1 Vấn đề

Ba bước sửa code vẫn ghi `Thực hiện: session chính`, ràng buộc phạm vi chỉ bằng lời văn:

| Workflow | Bước | Câu ràng buộc hiện có |
|---|---|---|
| bugfix | Bước 6 — Fix tối thiểu | "phạm vi thay đổi tối thiểu cần thiết"; "cấm xoá/nới điều kiện test" |
| security-review | Bước 8 — Sửa | "không sửa ngoài phạm vi finding đã chọn"; "không chỉ che triệu chứng" |
| performance | Bước 4 — Tối ưu | "không tối ưu ngoài bottleneck đã xác nhận" |

Không bước nào có gate kiểm được bằng lệnh rằng diff nằm trong phạm vi hay không đụng file test — khác với các
bước test-writer đã có gate A3 (`git diff --name-only` chỉ file test, ví dụ bugfix Bước 7).

### 1.2 Vì sao không dùng 2 implementer hiện có

- `backend-implementer` sinh **một vertical slice mới** theo skill `backend-implement`
  (`plugins/backend/agents/backend-implementer.md`, mục Vai trò). `frontend-implementer` chuyển **thiết kế →
  component presentational**, cấm nối API (`plugins/frontend/agents/frontend-implementer.md`, mục Phạm vi).
- Bước sửa là **sửa code có sẵn theo một oracle đỏ**. Không skill nào của 2 agent mô tả việc này; giao cho chúng
  là dùng agent ngoài hợp đồng.

### 1.3 Điều agent làm được và không làm được

- Mode `write` chỉ sinh `disallowedTools: Agent` (`adapters/_shared/agents.mjs:5`). Agent **không** khoá phạm vi
  theo đường dẫn bằng công cụ.
- Lợi ích thật khi chuyển sang agent: context riêng, buộc đọc skill, report theo contract `core:principles`, và
  **gate kiểm diff** do workflow áp (gương A3). Spec này thiết kế cả bốn thứ đó; không tuyên bố hard-enforcement.

### 1.4 Mục tiêu & tiêu chí thành công

1. Ba bước sửa có `Thực hiện: agent` với hợp đồng riêng, đầu vào rõ (oracle + danh sách file), gate kiểm diff.
2. Không đánh số lại bước nào; assert số bước hiện có không đổi.
3. Ba workflow **vẫn được wizard offer** sau thay đổi (closure agent → skill đã publish).
4. `npm test` xanh; contract §8.4 (spec 2026-09-29) cho 2 agent mới; assert nội dung mới trong `validate.mjs`.

---

## 2. Quyết định đã chốt (2026-09-30)

| # | Câu hỏi | Quyết định |
|---|---|---|
| F-Q1 | Ai sửa code? | **(a)** Agent mới `backend-fixer` / `frontend-fixer` với skill `backend-fix` / `frontend-fix`. Không mở rộng implementer (b), không chỉ siết gate ở session chính (c). |
| F-Q2 | Bước nào giao fixer? | bugfix Bước 6, security-review Bước 8, performance Bước 4. **Loại** db-change Bước 3 (thuộc WF3/P1b). |
| F-Q3 | Publish thế nào? | **(i)** Publish `backend/backend-fix`, `frontend/frontend-fix` **cùng đợt** nối workflow. Lý do: `offeredCatalog` ẩn workflow có closure chưa publish (`cli/lib/install.mjs:355`); draft sẽ làm 3 workflow đang publish biến mất khỏi wizard. Trái nguyên tắc "publish sau pilot" (Q4) — chấp nhận vì skill là recipe docs-only; bù bằng review nội dung + assert contract; §8 ghi rõ "chưa pilot". |

---

## 3. Skill `backend-fix` / `frontend-fix`

### 3.1 Vị trí & frontmatter

```text
plugins/backend/skills/backend-fix/SKILL.md
plugins/frontend/skills/frontend-fix/SKILL.md
```

`order: 9` cho cả hai (backend và frontend đều đã dùng `order` 1–8, kể cả 2 skill frontend draft). Không có
`references/` ở đợt đầu; recipe khoảng 100 dòng theo khuôn `*-refactor`. Frontmatter theo skill đã publish:
`name`, `description`, `order`, `stageNumber: "09"`, `title`, `runsIn: execute`, `invoke: per-request`,
`pipeline: false`, `next: null`.

### 3.2 Ranh giới với skill lân cận (phần cốt lõi)

| Skill | Đầu vào | Kết quả |
|---|---|---|
| `*-implement` | use-case / thiết kế mới | code **mới** |
| `*-refactor` | code có sẵn, test xanh | hành vi **không đổi** |
| **`*-fix`** | code có sẵn + **một oracle đỏ** + **danh sách file được sửa** | hành vi **đổi đúng một chỗ**, oracle chuyển xanh |

Description phải ghi rõ ba câu "KHÔNG dùng khi": viết feature mới (→ `*-implement`); dọn code không đổi hành vi
(→ `*-refactor`); chưa có oracle (→ chạy `workflow-bugfix` từ đầu để tái hiện).

### 3.3 Ba chế độ, cùng khung, khác oracle

| Chế độ | Oracle | Gate xanh |
|---|---|---|
| `bug` | failing test tái hiện (bugfix Bước 3) | test đó xanh |
| `security` | regression test đỏ (security-review Bước 7) + finding | test đó xanh; không "che triệu chứng" |
| `performance` | giả thuyết bottleneck đã xác nhận + file/hàm (performance Bước 3); **không có test đỏ** | build/test hiện có xanh; skill **không tự tuyên bố nhanh hơn** — số đo là việc của Bước 5 |

### 3.4 Cổng F1–F5 (fail-loud)

| Cổng | Nội dung | Khi fail |
|---|---|---|
| F1 Có oracle | Chạy oracle xác nhận **đang đỏ** (bug/security) hoặc có giả thuyết đã xác nhận (performance) | Không có / đỏ vì lý do khác → dừng, báo, không sửa |
| F2 Phạm vi khoanh trước | Bước gọi đưa **danh sách file/module được sửa**; chỉ sửa trong đó | Cần sửa ngoài danh sách → dừng, trả `blocked` + file đề nghị thêm, chờ người dùng |
| F3 Không đụng test | Không sửa/xoá/nới file test, fixture, snapshot, mock | Test sai thật → báo, để test-writer xử lý |
| F4 Sửa nguyên nhân | Cấm che triệu chứng (danh sách theo stack, §3.5) | Phát hiện trong tự đối chiếu → gỡ, sửa lại |
| F5 Xanh trước khi trả | Oracle xanh (bug/security) / build-test hiện có xanh (performance) + build/lint/test xanh; diff so mốc ⊆ danh sách F2, không đổi file test (kể cả oracle đã bẩn — `git hash-object` trước/sau bằng nhau) | Không xanh → sửa tiếp trong danh sách; hết cách → `blocked` |

### 3.5 Phần khác nhau giữa 2 skill

Chỉ ở danh sách "che triệu chứng" theo stack và lệnh build/lint:

- **backend-fix** (Java/Spring, Python): `try/catch` nuốt lỗi hoặc `except: pass`; `@Disabled`/`@Ignore`/
  `pytest.skip`; nới timeout/retry để qua; hạ mức log thay vì sửa lỗ hổng; `@SuppressWarnings` mới; đổi assert
  trong test. Build/lint: theo `tech-stack` của project (Maven/Gradle, pytest + ruff/flake8).
- **frontend-fix** (React/TypeScript): `any`, `!` non-null, `// eslint-disable`, `// @ts-ignore`/`@ts-expect-error`
  mới; `test.skip`/`it.skip`; nới `waitFor` timeout; sửa snapshot để qua; `catch` nuốt lỗi. Build/lint: `tsc
  --noEmit`, eslint, build.

Không tách phần chung ra `core`: hai file, chấp nhận lặp có kiểm soát, giống cách `*-refactor` đang làm.

### 3.6 Trigger (description)

"sửa bug theo failing test", "fix finding bảo mật", "sửa theo root cause", "áp fix tối thiểu", "tối ưu theo
bottleneck đã xác nhận" — kể cả khi không nói chữ "skill". KHÔNG thuộc pipeline bắt buộc.

---

## 4. Agent `backend-fixer` / `frontend-fixer`

### 4.1 Vị trí & frontmatter

```text
plugins/backend/agents/backend-fixer.md
plugins/frontend/agents/frontend-fixer.md
```

`name` = tên file; `mode: write`; `skills: "backend-fix"` / `"frontend-fix"` (đúng 1 skill); body đủ 4 heading
`## Vai trò`, `## Phạm vi`, `## Quy trình`, `## Report trả về` (contract `test/validate.mjs:275-286`, spec
2026-09-29 §8.4). Catalog 13 → **15** agent.

### 4.2 Nội dung (bản để hiện thực)

```markdown
---
name: backend-fixer
description: "Agent chỉ SỬA code backend có sẵn theo skill backend-fix: nhận một oracle đỏ (failing test, regression test, hoặc giả thuyết bottleneck đã xác nhận) và danh sách file được sửa, áp fix tối thiểu cho oracle xanh, không đụng test, không sửa ngoài danh sách. Cần sửa ngoài phạm vi → dừng và trả blocked. Dùng khi workflow bugfix/security-review/performance cần bước sửa code có khoá phạm vi."
mode: write
skills: "backend-fix"
---

## Vai trò
Sửa đúng một chỗ trong code có sẵn để oracle đỏ chuyển xanh, trong phạm vi file đã được người dùng xác nhận.

## Phạm vi
- Được: đọc skill `backend-fix`, `project-knowledge/architecture.md`, `code-convention.md`, code trong danh
  sách file được giao; chạy oracle + build/lint để lấy evidence.
- Không được: sửa file test/fixture/snapshot/mock; sửa file ngoài danh sách; đổi `docs/contracts/`; thêm hay
  đổi migration; thêm dependency; commit; gọi agent khác.
- Bắt buộc: cần mở rộng phạm vi → trả `status: blocked` + danh sách file đề nghị thêm; không tự mở.

## Quy trình
1. Đọc skill `backend-fix`; nhận oracle (lệnh + kỳ vọng đỏ→xanh) và danh sách file từ bước gọi.
2. Chạy oracle, xác nhận đang đỏ đúng lý do (F1); đỏ vì lý do khác hoặc không đỏ → báo, dừng.
3. Sửa tối thiểu trong danh sách (F2), không đụng test (F3), không che triệu chứng (F4).
4. Chạy oracle + build/lint (F5); chưa xanh → sửa tiếp trong danh sách; hết cách → `blocked`.
5. Tự đối chiếu `git diff --name-only` với danh sách và với danh sách che triệu chứng của skill trước khi trả.

## Report trả về
- Oracle trước/sau: `command`, `exit_code`, `status` (đỏ → xanh).
- File đã sửa (`file:line`) và xác nhận ⊆ danh sách giao; evidence build/lint theo contract `core:principles`;
  không chạy được → `not_run` + `reason`.
- `remaining_risks`: giả định về nguyên nhân; chỗ cùng pattern chưa sửa vì ngoài phạm vi; phần chỉ kiểm bằng
  đọc, chưa có test.
```

`frontend-fixer` giống hệt về cấu trúc; khác: skill `frontend-fix`; "code backend" → "code frontend React/TS";
lệnh build/lint `tsc --noEmit` + eslint + build; không đọc `design-system.md`/`component-map.md` (fixer không
dựng UI).

### 4.3 Assert mới trong `validate.mjs` (khối riêng, đánh số tiếp)

Mỗi agent: `mode: write`; `skills` đúng 1 skill và skill đó tồn tại; body chứa "không đụng test" (hoặc "file
test"), "ngoài danh sách", "blocked", "core:principles"; description chứa "oracle".

### 4.4 Tài liệu

- Bảng agent `README.md:150-168` và `README_VI.md` tương ứng: thêm 2 dòng
  `backend-fixer | backend | write | backend-fix | WF02, WF06, WF09` và `frontend-fixer | frontend | write |
  frontend-fix | WF02, WF06, WF09`.
- Bảng workflow (`README.md:180-191`): cột agent của WF02, WF06, WF09 thêm "BE/FE fixer".

---

## 5. Nối vào 3 workflow + gate

### 5.1 Nguyên tắc

- **Không đánh số lại** bước nào. Assert `workflow-security-review: 10 bước, Sửa ở Bước 8`
  (`test/validate.mjs:969`) và các assert đếm bước khác giữ nguyên.
- Danh sách file được sửa (đầu vào F2) sinh ở **bước ⏸ đứng trước** — nằm trong thứ người dùng đã xác nhận, nên
  fixer không tự khoanh phạm vi cho mình.

### 5.2 Thay đổi theo workflow

| Workflow | Bước ⏸ trước — thêm vào **Đầu ra** | Bước sửa — đổi **Thực hiện** |
|---|---|---|
| bugfix | Bước 5 Root cause: "+ danh sách file/module được sửa, suy từ chuỗi nhân quả, người dùng xác nhận cùng root cause" | Bước 6 Fix tối thiểu → `agent backend-fixer ∥ agent frontend-fixer` (phía có lỗi theo Bước 2) |
| security-review | Bước 5 Kế hoạch remediation: "+ danh sách file được sửa cho mỗi finding đã chọn" | Bước 8 Sửa → `agent backend-fixer ∥ agent frontend-fixer` (phía có finding cần sửa) |
| performance | Bước 3 Profile & giả thuyết: "+ file/hàm bottleneck được sửa" | Bước 4 Tối ưu → `agent backend-fixer ∥ agent frontend-fixer` (phía có đụng) |

### 5.3 Khung bước sửa sau thay đổi (áp cho cả 3, đổi tên oracle theo bảng §3.3)

- **Thực hiện:** `agent backend-fixer ∥ agent frontend-fixer` (phía …)
- **Đầu vào:** oracle (failing test Bước 3 / regression test Bước 7 / giả thuyết Bước 3) + danh sách file từ
  bước ⏸ trước.
- **Hành động:** session chính ghi mốc `git status --porcelain` (+ `git hash-object` file test đang bẩn) TRƯỚC
  khi dispatch agent; agent sửa tối thiểu trong danh sách theo skill `*-fix`; chạy lại oracle + build/lint. Danh
  sách file là hợp của hai phía; mỗi agent chỉ đối chiếu phần thuộc phía mình.
- **Ràng buộc:** giữ nguyên các câu cấm hiện có (không che triệu chứng, không xoá/nới test); thêm "không sửa
  ngoài danh sách; cần mở rộng → agent trả `blocked`, session chính hỏi người dùng rồi gọi lại".
- **Đầu ra:** code đã sửa; oracle xanh; build/lint xanh.
- **Gate:** oracle xanh + build/lint xanh; so với trạng thái ghi lại ở đầu bước (`git status --porcelain`), file
  thay đổi hoặc mới trong bước (`git diff --name-only` và `git ls-files --others --exclude-standard`) **⊆ danh
  sách** và **không chứa file test/fixture/snapshot/mock**; file test đã bẩn trong mốc (test của Bước 3 / Bước 7)
  **không đổi nội dung** (`git hash-object` trước/sau).
- **Khi fail:** agent `blocked` → người dùng mở rộng danh sách (ghi vào Đầu ra bước ⏸) → gọi lại; oracle vẫn đỏ
  → quay lại bước root cause / kế hoạch / giả thuyết (như hiện tại); diff lệch danh sách → revert phần lệch,
  không nhận.
- **Evidence:** report của agent (oracle đỏ → xanh, `command`/`exit_code`) + danh sách file thay đổi hoặc mới
  trong bước so với đầu bước.

### 5.4 Frontmatter & closure

- `agents:` của 3 workflow thêm `backend-fixer,frontend-fixer`.
- Hệ quả: `expandWorkflowDeps` (`cli/lib/workflows.mjs:77-94`) kéo `backend/backend-fix`,
  `frontend/frontend-fix` vào closure → phải publish (§6) để `offeredCatalog` không ẩn workflow.
- Assert `test/validate.mjs:959` ("security-review: agents gồm auditor + 2 test-writer") sửa thành "+ 2 fixer".
- Bảng lỗi (mục "Xử lý lỗi & rollback") của 3 workflow: thêm hàng "Fixer trả `blocked`" → "mở rộng danh sách
  có xác nhận người dùng, gọi lại; không tự mở".

### 5.5 Fallback không có subagent

Preamble sẵn có ("Không có subagent → chạy tuần tự skill tương ứng trong session chính",
`adapters/_shared/agents.mjs:46`) áp dụng luôn: session chính đọc skill `*-fix` và tự tuân F1–F5 + gate diff.
Không thêm gì.

### 5.6 Ngoài phạm vi (ghi để không lẫn)

- db-change Bước 3 (file migration ở session chính) — WF3/P1b.
- bugfix Bước 7 "regression chỉ phía đã fix" — đã nêu ở spec 2026-09-29 §5.1, không thuộc A4.
- Cải tiến "khoá phạm vi bằng công cụ" theo đường dẫn — không có trong cơ chế `disallowedTools` hiện tại
  (`[Inference]` cần cơ chế hook/permission của client, ngoài phạm vi projection).

---

## 6. Publish, đóng gói, kiểm chứng

### 6.1 Publish

- `plugins/_published.json`: thêm `backend/backend-fix`, `frontend/frontend-fix`.
- `plugins/backend/.manifest.json`, `plugins/frontend/.manifest.json`: description liệt kê thêm skill mới (assert
  PL2 `test/validate.mjs:785-789`); bump version (backend `1.3.0` → `1.4.0`, frontend `1.4.0` → `1.5.0`).
- `plugins/_cowork.json`: thêm `backend:backend-fix`, `frontend:frontend-fix` (recipe chạy được trong Cowork
  không cần subagent).
- npm: thư mục `plugins/backend/`, `plugins/frontend/` đã trong `package.json` `files` → không đổi; `npm run
  pack:verify` xanh.

### 6.2 Test phải sửa

| File | Dòng | Thay đổi |
|---|---|---|
| `test/install.test.mjs` | 183 | `beOff.skillIds.length === 8` → `9` |
| `test/install.test.mjs` | 194, 205 | `feOff.skillIds.length === 6` → `7` (2 assert) |
| `test/validate.mjs` | 959 | agents của security-review: + `backend-fixer`, `frontend-fixer` |
| `test/validate.mjs` | khối mới | §4.3 (agent), §5.3 (bước sửa của 3 workflow: Thực hiện có `fixer`, Gate có "⊆ danh sách" và "không chứa file test", bước ⏸ trước có "danh sách file"), §6.1 (`_published.json` có 2 mục; workflow bugfix/security-review/performance vẫn nằm trong `offeredCatalog`) |

Assert "3 workflow vẫn được offer" là assert **quan trọng nhất** của đợt này: nó chứng minh F-Q3 đúng và bắt lỗi
nếu ai đó sau này chuyển `*-fix` về draft.

### 6.3 Kiểm chứng

| Bước | Lệnh | Chứng minh |
|---|---|---|
| Contract source | `npm run validate` | 2 skill + 2 agent + 3 workflow đúng contract; assert mới xanh |
| Build 4 provider | `npm run build` | `backend-fix`, `frontend-fix`, 2 agent xuất hiện ở `build/<provider>/` |
| Toàn bộ | `npm test` | installer/wizard/pack-guard không regression; số skill offer 9/7 |
| Smoke | `AIE_INSTALL_ROOT=<sandbox> aip install --skill workflows/workflow-bugfix` | closure kéo `backend-fix`, `frontend-fix`; 2 agent xuất hiện |
| Client thật | `/agents` trong Claude Code | `[Unverified]` cho tới khi chạy thật |
| Hành vi | Chạy `workflow-bugfix` trên project mẫu có bug thật | `[Unverified]` — gate diff có chặn đúng chỉ đo được khi chạy thật |

---

## 7. Lộ trình (mỗi task = 1 commit, người duyệt diff)

| Pha | Nội dung | Điều kiện xong |
|---|---|---|
| FX-P1 | `backend-fix/SKILL.md` + `frontend-fix/SKILL.md` (§3) | `npm run build` thấy 2 skill ở 4 provider; validate skill contract xanh |
| FX-P2 | `backend-fixer.md` + `frontend-fixer.md` (§4.2) + assert §4.3 | validate agent contract xanh; agent chưa được workflow nào dùng |
| FX-P3 | Publish (§6.1) + sửa assert đếm (§6.2 dòng 183/194/205) | `npm test` xanh; wizard offer 9 backend / 7 frontend |
| FX-P4 | Nối 3 workflow (§5.2–§5.4) + assert §5.3 + assert "3 workflow vẫn offer" + sửa `validate.mjs:959` | `npm test` xanh |
| FX-P5 | README/README_VI bảng agent + workflow (§4.4); spec 2026-09-29 §8.1 catalog 13→15, §9/§13 đánh dấu A4 xong | Validate xanh |
| FX-P6 | Smoke install sandbox (§6.3) | Closure đúng; dọn sandbox bằng `fs.rmSync` (không `rm -rf` junction) |

Thứ tự FX-P3 trước FX-P4 là bắt buộc: nối workflow trước khi publish sẽ làm 3 workflow bị ẩn trong khoảng giữa
hai commit.

---

## 8. Rủi ro còn lại

- **Chưa pilot.** Publish ngay (F-Q3) nên skill `*-fix` chưa chạy trên project thật; nội dung có thể cần chỉnh sau
  lần dùng đầu. Bù: review nội dung trước merge; assert contract.
- `[Inference]` Gate diff ở §5.3 chỉ chặn khi session chính **thực sự chạy** lệnh so diff; mức tuân thủ của model
  chỉ đo được khi chạy workflow thật.
- `[Inference]` Chế độ `performance` không có oracle đỏ nên F1 yếu hơn; phụ thuộc Bước 3 profile có evidence tốt.
  Nếu pilot cho thấy fixer hay "tối ưu quá tay", cân nhắc tách khỏi skill.
- Thêm bước ⏸ phải xuất "danh sách file" làm tăng việc cho session chính ở 3 bước; đổi lại phạm vi sửa nằm trong
  thứ người dùng đã duyệt.
- Catalog 15 agent, 2 skill mới: tăng token khi cài `--plugin all`; không đổi hành vi skill cũ.
- Hai skill lặp nội dung khung F1–F5 (§3.5): trôi lệch về sau là rủi ro bảo trì đã biết, giống `*-refactor`.
- **Mở rộng sau review toàn nhánh (oracle b–c).** Ngoài test đỏ chạy được (a), skill nhận thêm: (b) finding đã
  validate khi quay lại từ bước review/re-scan, gate xanh = review/re-scan lại; (c) giả thuyết có evidence
  profile (chế độ `performance`). Các oracle này **yếu hơn test đỏ chạy được**: không có lệnh đỏ → xanh, độ tin
  phụ thuộc chất lượng review/profile.
- **Mở rộng sau review toàn nhánh (oracle d–e).** (d) bug chỉ tái hiện thủ công: oracle = bước tái hiện + kết quả
  kỳ vọng người dùng xác nhận, gate xanh = chạy lại đúng các bước đó; (e) finding bảo mật không có test
  (secret/dependency/misconfiguration): oracle = finding đã validate (`file:line`/CVE), gate xanh = re-scan
  Bước 9. Gate **yếu hơn test đỏ chạy được** (thủ công, không lặp lại tự động). Cùng đợt: gate diff trừ mốc đầu
  bước và kiểm `git hash-object` file test đã bẩn; nâng version dependency đã có được phép khi manifest/lockfile
  nằm trong danh sách và finding là CVE.

---

## 9. Quyết định cần chốt

| # | Câu hỏi | Trạng thái |
|---|---|---|
| ~~F-Q1~~ | Ai sửa code? | Đã chốt: (a) agent mới |
| ~~F-Q2~~ | Bước nào? | Đã chốt: bugfix B6, security-review B8, performance B4 |
| ~~F-Q3~~ | Publish? | Đã chốt: (i) publish cùng đợt |
| F-Q4 | Có tách chế độ `performance` khỏi `*-fix` sau pilot không? | Mở — quyết sau lần dùng thật đầu tiên |
