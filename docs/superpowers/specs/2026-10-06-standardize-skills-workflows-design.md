# Thiết kế: Chuẩn hoá skill + workflow và gộp có điều kiện

- Ngày: 2026-10-06
- Trạng thái: **Đã thực thi Pha A + B0 + B1 (2026-10-06)**.
- Phạm vi: toàn bộ `SKILL.md` (35 file: `core/skills/` + `plugins/*/skills/`), `WORKFLOW.md` (13 file trong `workflows/`),
  validator `test/validate.mjs`, loader `cli/lib/plugins.mjs`, adapter dùng chung `adapters/_shared/lib.mjs`.
- Người duyệt: chủ dự án.
- Hướng đã chọn: **B** (chuẩn hoá trước, gộp sau theo tiêu chí). Đã loại hướng C (gộp mạnh cặp BE/FE + workflow).
- Branch: `refactor/skills-workflows-standardization`.

---

## 0. Cách đọc & nhãn

| Nhãn | Nghĩa |
|---|---|
| (không nhãn) | Đã kiểm chứng: đọc file, grep hoặc chạy script, có `file:dòng` hoặc số đo đi kèm |
| `[Inference]` | Suy luận từ nội dung đã đọc, chưa chạy thực tế |
| `[Unverified]` | Chưa kiểm chứng |
| `[Đề xuất]` | Quyết định thiết kế chờ duyệt |

Số liệu đo trên `master` = `321d0c3`.

---

## 1. Vấn đề & mục tiêu

### 1.1 Vấn đề

Repo có 35 skill, 13 workflow (gồm orchestrator), 18 agent. Workflow đã có khung bắt buộc (`WF_HEADINGS`,
`STEP_FIELDS` ở `cli/lib/workflows.mjs:4-6`, kiểm bởi `checkWorkflowBody`). Skill thì chưa có khung, nên mỗi skill mới
tự chọn cấu trúc, và ranh giới giữa skill ↔ skill ↔ workflow chỉ nằm trong văn bản tự do.

### 1.2 Mục tiêu (chủ dự án chọn 2026-10-06)

1. **Dễ bảo trì khi thêm skill mới:** khung `SKILL.md` được validator ép, frontmatter không còn trường chết.
2. **Giảm chọn sai/trùng:** mỗi description nêu "Không dùng khi → id", không có cụm trigger trùng nguyên văn giữa hai
   skill, registry orchestrator không trôi lệch khỏi description workflow.
3. **Gộp/bớt khi có số đo chứng minh:** quyết định gộp dựa trên tiêu chí tường minh, không dựa trên tên gọi.

Không phải mục tiêu: giảm token/context (chủ dự án không chọn).

### 1.3 Tiêu chí thành công

1. `npm test` xanh sau mỗi task.
2. Mọi `SKILL.md` qua rule khung (§4.2); mọi description qua rule description (§4.3).
3. Không còn `pipeline`/`next`/`stageNumber` trong source; loader và validator không còn nhánh pipeline.
4. Drift guard (§4.4) đỏ khi cố ý làm lệch một dòng.
5. Bảng số đo trùng lặp (§5.1) có trong spec này; mỗi quyết định gộp hoặc không gộp ghi kèm số đo.

---

## 2. Hiện trạng đo được

| Hạng mục | Số liệu |
|---|---|
| Frontmatter skill | 35/35 có `stageNumber`; 48/48 file skill+workflow có `pipeline: false` và `next: null` |
| `runsIn` | 40 `execute`, 8 `plan`. Dùng làm fallback Cowork (`cli/lib/pack.mjs:110`) khi `_cowork.json` không có `skills` |
| `invoke` | 44 `per-request`, 4 `once`. Chỉ dùng để render dòng "Tần suất" (`adapters/_shared/lib.mjs:120,132`) |
| H2 "Ranh giới an toàn…" | 3 biến thể: `(CLAUDE.md)` 17, trần 10, `(đọc CLAUDE.md…)` 2. Thiếu hẳn ở 6 skill |
| H2 "Quy trình…" | `Quy trình` 11, `Quy trình (…)`/`Quy trình — …` 11, `Luồng …` 11 (ở 10 skill). Thiếu cả hai ở 3 skill |
| H2 "Khi nào dùng" | Chỉ 10/35 skill có |
| Description | 44/48 chứa câu "KHÔNG thuộc pipeline bắt buộc"; 2/48 có "không dùng"; dài tối đa 1.680 ký tự |
| Trigger trùng nguyên văn skill ↔ skill | `backend-fix` ↔ `frontend-fix` (3 cụm), `frontend-migrate-architecture` ↔ `frontend-refactor` ("tái cấu trúc react"), `data-db-migration` ↔ `data-oltp-implement` ("schema change") |
| Trigger trùng skill ↔ workflow | `openapi`, `đổi kiến trúc`, `đổi schema`, `security review`, `release`, `phát hành`, `incident`, `alert` |
| Registry ↔ description workflow | 4/45 cụm trong cột "Tín hiệu" không có trong description: bugfix "không chạy", "sai kết quả"; code-review "PR #"; security-review "CVE" |
| Boilerplate workflow | Các dòng khung (vd "Thiếu điều kiện nào → dừng…", "Mỗi bước có đủ 8 trường…") lặp 13/13 file |

Skill thiếu "Ranh giới an toàn": `backend-init`, `frontend-init`, `data-oltp-init`, `data-olap-init` (không có mục an
toàn nào), `backend-implement`, `frontend-implement` (có `## Ranh giới`).
Skill thiếu "Quy trình"/"Luồng": `backend-performance`, `frontend-performance` (`## Hai chế độ`), `data-db-migration`
(`## Bước 0 — Chọn chế độ`, `## Chế độ ADOPT …`, `## Chế độ CHANGE …`).

### 2.1 Đính chính so với thiết kế trình bày trong chat

1. **Bỏ "Khi nào dùng" khỏi bộ mục bắt buộc.** Chat đề xuất 3 mục bắt buộc gồm "Khi nào dùng". Số đo cho thấy chỉ 10/35
   skill có mục này; thêm vào 25 skill là viết nội dung mới, không phải chuẩn hoá. "Khi nào dùng" đã nằm trong description
   (adapter lấy câu đầu description qua `whenToUse()`, `adapters/_shared/lib.mjs:87-91`), và §4.3 ép phần "Không dùng
   khi".
2. **A2 không chỉ là đổi tên heading.** 4 skill `*-init` không có mục an toàn nào → phải thêm nội dung (§4.2). 3 skill
   không có "Quy trình" → phải thêm heading và hạ cấp mục chế độ.
3. **A1 có làm đổi build output.** Bỏ nhánh pipeline/recipe làm đổi các dòng do `adapters/_shared/lib.mjs:108-136` sinh
   (tiêu đề nhóm "Skill theo yêu cầu (KHÔNG thuộc pipeline bắt buộc)", trường "Tiếp theo"). Tiêu chí "build output không
   đổi" trong chat sửa thành "diff `build/` chỉ gồm các dòng đó".
4. **Rút lại ứng viên gộp 4 skill `data-oltp-*`/`data-olap-*`** (đã nêu trong chat Phần 2): `implement` chỉ chung 10/96
   dòng.

---

## 3. Quyết định đã chốt (2026-10-06)

| # | Quyết định |
|---|---|
| D1 | Hướng B: Pha A chuẩn hoá (không đổi hành vi người dùng) rồi Pha B gộp có điều kiện |
| D2 | Không gộp 6 cặp skill BE/FE (16–53 dòng chung trên mỗi file ~115–145 dòng) |
| D3 | Không gộp cặp skill ↔ workflow cùng chủ đề; xử lý bằng rule description (§4.3) |
| D4 | Không dedupe boilerplate workflow vào `_shared`: agent đọc từng `WORKFLOW.md` đã cài, dedupe buộc build phải expand. Thay bằng drift guard (§4.4) |
| D5 | Ngưỡng gộp 60%; chấp nhận kết quả Pha B gộp tối đa 1 workflow nếu số đo xác nhận |
| D6 | 1 task = 1 commit; chủ dự án duyệt diff trước mỗi commit; không push `master` |

---

## 4. Pha A — Chuẩn hoá

### 4.1 A1 — Bỏ frontmatter chết

- Xoá `pipeline`, `next`, `stageNumber` khỏi 35 `SKILL.md`; xoá `pipeline`, `next` khỏi 13 `WORKFLOW.md` và
  `templates/workflows/workflow.template.md` (workflow không có `stageNumber`).
- `cli/lib/plugins.mjs:165-174,239-242`: bỏ đọc 3 trường. Parser frontmatter vẫn chấp nhận key lạ, nên source cũ còn
  key này vẫn nạp được.
- `adapters/_shared/lib.mjs:108-136`: bỏ tách pipeline/recipe; mọi skill render một nhóm; bỏ "Tiếp theo".
- `test/validate.mjs:183-266` (skill) và `:315` (workflow): bỏ các assert pipeline/next/stageNumber/order liên tục;
  giữ assert `order` unique trong plugin. Các assert riêng skill nhắc `stageNumber` (vd `validate.mjs:659`) sửa theo.
- Giữ `order`, `title`, `runsIn`, `invoke`.
- `[Unverified]` Chưa biết script hoặc fork ngoài repo có đọc 3 trường này không.

### 4.2 A2 — Khung H2 cho `SKILL.md`

`[Đề xuất]` Rule (thêm vào validator, chế độ cảnh báo trước, lỗi sau khi toàn bộ skill đạt):

| Mục bắt buộc | Regex khớp | Ghi chú |
|---|---|---|
| Quy trình | `^## Quy trình(\b.*)?$` | Cho phép hậu tố như `(trung tính stack)`, `— cổng F1–F5` |
| Ranh giới an toàn | `^## Ranh giới an toàn(\b.*)?$` | Cho phép hậu tố `(CLAUDE.md)` |

Thay đổi theo file:

| Nhóm | File | Thay đổi |
|---|---|---|
| `Luồng …` | 11 heading ở 10 skill (engineering 6, ops 3, `git-workflow` 2 heading) | `## Luồng X` → `## Quy trình — X` (chỉ đổi dòng heading) |
| `## Ranh giới` | `backend-implement`, `frontend-implement` | → `## Ranh giới an toàn` |
| Không có mục an toàn | 4 skill `*-init` | Thêm `## Ranh giới an toàn`, nội dung lấy từ `## Ghi chú` hiện có và `shared/principles.md` của plugin; không thêm quy tắc mới. Diff nội dung này cần duyệt riêng |
| Không có "Quy trình" | `backend-performance`, `frontend-performance`, `data-db-migration` | Thêm `## Quy trình` bọc các mục chế độ, hạ mục chế độ xuống H3; không đổi văn bản |

Trước khi đổi heading: grep tham chiếu tới tên heading cũ trong `README*`, `docs/`, `test/` và sửa theo.

### 4.3 A3 — Rule description

`[Đề xuất]` Khung description:

```text
<Recipe on-demand | Workflow điều phối>: <làm gì, một câu>. <chi tiết phạm vi>.
Dùng skill NÀY khi người dùng muốn "<trigger>", "<trigger>" — kể cả khi không nói chính xác chữ "skill".
Không dùng khi <tình huống> → <id>[; <tình huống> → <id>].
```

Rule validator:

1. Có cụm `Không dùng khi`; mọi `→ <id>` phải là id skill, workflow hoặc agent có thật.
2. Bỏ câu "KHÔNG thuộc pipeline bắt buộc; gọi khi cần…" (44 file) vì A1 đã bỏ khái niệm pipeline.
3. Không có cụm trigger trong ngoặc kép trùng nguyên văn (không phân biệt hoa thường) giữa hai **skill**. Hiện trạng
   vi phạm: `backend-fix`/`frontend-fix` (3 cụm), `frontend-migrate-architecture`/`frontend-refactor`,
   `data-db-migration`/`data-oltp-implement`.
4. Trigger trùng giữa skill và workflow được phép khi description của skill có `→ workflow-<x>` trỏ đúng workflow đó.
5. Câu đầu tiên (đến dấu `.` đầu) không quá 200 ký tự, vì `whenToUse()` render câu này. **Đã đổi thành cảnh báo,
   xem §10 S1.**
6. Độ dài: **lỗi cứng khi vượt 1024 ký tự** (xem §10 S2). Nguồn: tài liệu Agent Skills, mục "Skill structure"
   (platform.claude.com/docs/en/agents-and-tools/agent-skills/overview): `description` "Maximum 1024 characters".

### 4.4 A4 — Drift guard

1. **Boilerplate workflow ↔ template:** tập dòng neo = các dòng cố định của `templates/workflows/workflow.template.md`
   (không chứa `<…>`). Mỗi `WORKFLOW.md` (trừ orchestrator) phải chứa nguyên văn mọi dòng neo. Plan đo trước để xác
   định dòng neo hiện có trong 12/12 file.
2. **Registry ↔ description:** mỗi cụm trong cột "Tín hiệu" của Registry (`workflows/orchestrator/WORKFLOW.md`) phải
   có trong description workflow tương ứng. Sửa 4 cụm lệch hiện có (§2) bằng cách thêm vào description, không xoá khỏi
   registry.

---

## 5. Pha B — Gộp có điều kiện

### 5.1 B0 — Script đo trùng lặp

`[Đề xuất]` `test/overlap.mjs`, chạy bằng `npm run overlap`, **không** nằm trong `npm test` (in báo cáo, không assert).

- Chuẩn hoá: bỏ dòng trống, bỏ khoảng trắng đầu/cuối, bỏ các dòng neo của template (§4.4).
- Chỉ số skill ↔ skill: `|A ∩ B| / min(|A|, |B|)` trên tập dòng đã chuẩn hoá.
- Chỉ số workflow ↔ workflow: như trên, cộng tỉ lệ bước có cùng "Thực hiện" và "Hành động".
- Xuất bảng top cặp. Kết quả chạy lần đầu ghi vào §5.3 của spec này.

### 5.2 Tiêu chí gộp (phải thoả cả 5)

1. Không có trigger độc lập: cụm người dùng nói để gọi nó đều thuộc phần còn lại.
2. Chỉ số trùng ≥ 60% (§5.1).
3. Cùng `risk` và `tier` (workflow) hoặc cùng plugin (skill).
4. Bản gộp không dài hơn workflow dài nhất hiện có (272 dòng, `workflows/security-review/WORKFLOW.md`).
5. Có đường migrate cho người dùng đã cài (§5.4).

### 5.3 Ứng viên

| Ứng viên | Bằng chứng hiện có | Trạng thái |
|---|---|---|
| `workflow-api` → chế độ của `workflow-feature` | So nguyên văn (`titleOverlap`) chỉ 3/8 tên bước của `api` trùng bước của `feature` (38%): "Baseline build/test", "Test", "Commit"; cùng risk `medium`. Cách so theo nghĩa trước đó cho 6/8 (vd "Contract" ≈ "Thiết kế & contract"), giữ làm ghi chú; số đo đầy đủ ở §5.3.1 | Giữ (§5.3.1) |
| `workflow-db-change` | 9 bước riêng, risk `high`, checkpoint xác nhận DB đích | Giữ |
| `workflow-docs` | Là đích nối tiếp của 6 workflow trong Registry | Giữ |
| 4 skill `data-oltp-*`/`data-olap-*` | `init` 25/57, `implement` 10/96 dòng chung | Giữ (§2.1) |
| 6 cặp skill BE/FE | 16–53 dòng chung | Giữ (D2) |

### 5.3.1 Số đo B0 và quyết định (2026-10-06)

Lệnh: `npm run overlap` (= `node test/overlap.mjs`), chạy trên HEAD `7c44f9a`, working tree sạch. Hai bảng dưới đây dán
nguyên văn từ output (bỏ dòng banner của npm); mọi dòng đã ghi ở "số đo trước" (§11.2.6) đều khớp từng ô.

#### Skill ↔ skill (top 15)

| Cặp | Dòng |
|---|---|
| data-oltp-init ↔ data-olap-init | 56% |
| backend-init ↔ data-oltp-init | 55% |
| data-oltp-init ↔ frontend-init | 55% |
| backend-init ↔ data-olap-init | 51% |
| data-olap-init ↔ frontend-init | 51% |
| backend-fix ↔ frontend-fix | 51% |
| backend-code-review ↔ frontend-code-review | 49% |
| backend-init ↔ frontend-init | 48% |
| backend-performance ↔ frontend-performance | 32% |
| frontend-data-integration ↔ frontend-e2e-testing | 22% |
| data-db-migration ↔ frontend-data-integration | 19% |
| backend-refactor ↔ frontend-refactor | 18% |
| data-db-migration ↔ frontend-e2e-testing | 17% |
| backend-testing ↔ frontend-testing | 15% |
| backend-implement ↔ frontend-implement | 14% |

#### Workflow ↔ workflow (top 15)

| Cặp | Dòng | Bước (Thực hiện + Hành động) | Tên bước |
|---|---|---|---|
| workflow-feature ↔ workflow-bugfix | 26% | 0% | 38% |
| workflow-feature ↔ workflow-db-change | 20% | 0% | 38% |
| workflow-feature ↔ workflow-api | 30% | 0% | 38% |
| workflow-testing ↔ workflow-docs | 35% | 20% | 20% |
| workflow-api ↔ workflow-docs | 35% | 20% | 20% |
| workflow-performance ↔ workflow-docs | 35% | 20% | 20% |
| workflow-db-change ↔ workflow-docs | 34% | 20% | 20% |
| workflow-feature ↔ workflow-docs | 33% | 0% | 20% |
| workflow-bugfix ↔ workflow-docs | 33% | 0% | 20% |
| workflow-feature ↔ workflow-testing | 31% | 0% | 29% |
| workflow-security-review ↔ workflow-docs | 30% | 0% | 20% |
| workflow-refactor ↔ workflow-docs | 29% | 0% | 0% |
| workflow-feature ↔ workflow-performance | 18% | 0% | 29% |
| workflow-bugfix ↔ workflow-testing | 26% | 0% | 29% |
| workflow-bugfix ↔ workflow-performance | 20% | 0% | 29% |

⚠ = chạm ngưỡng gộp 60% (spec §5.2 tiêu chí 2). Không có ô nào mang ⚠ ở cả hai bảng.

Đánh giá 5 tiêu chí (§5.2) cho `workflow-api → workflow-feature`:

| # | Tiêu chí | Kết quả |
|---|---|---|
| 1 | Không có trigger độc lập | **Không đạt**. Trigger trong ngoặc kép ở description `workflow-api`: "làm API", "thêm endpoint", "OpenAPI", "contract-first"; cả 4 cụm đều không có trong description `workflow-feature` (trigger của `feature`: "làm feature", "thêm tính năng", "implement user story", "làm chức năng mới end-to-end"). Cụm "workflow" trong câu "kể cả khi không nói chính xác chữ" là từ chung của cả hai file, không tính là trigger |
| 2 | Trùng ≥ 60% | **Không đạt**. Dòng `workflow-feature ↔ workflow-api` 30%, Bước 0%, Tên bước 38% (cả hai cột tính ngưỡng đều < 60%) |
| 3 | Cùng `risk` và `tier` | **Không đạt**. `risk`: cả hai `medium`; `tier`: `workflow-api` = 2, `workflow-feature` = 1 |
| 4 | Bản gộp ≤ workflow dài nhất | **Không đạt**. `wc -l`: `workflow-api` 209 dòng, `workflow-feature` 232 dòng; ước lượng 232 + 209 × (1 − 0,30) ≈ 378 dòng. Workflow dài nhất hiện có là `workflows/security-review/WORKFLOW.md` = 270 dòng (`wc -l`), 378 > 270. Số mới khác "272" ghi ở §5.2 mục 4 và §11.3.2; dùng 270 vì đây là số đo trên HEAD `7c44f9a`, kết luận không đổi |
| 5 | Có đường migrate | **Không đạt**. Chưa có cơ chế stub `deprecatedBy` (§5.4): `grep -rn deprecatedBy cli adapters test` không trả dòng nào |

Kết luận: Không gộp `workflow-api` vào `workflow-feature`; Pha B kết thúc.

### 5.4 B1 — Cơ chế gộp (chỉ chạy nếu ứng viên qua §5.2)

- `[Inference]` Xoá hẳn một id làm `aip update` lỗi với bản đã cài: `cli/lib/install.mjs:388-392` ném
  `Skill không tồn tại` khi id không còn trong catalog. Plan phải thử bằng sandbox `AIE_INSTALL_ROOT` trước khi gộp.
- Id cũ giữ một bản phát hành dưới dạng **stub**: frontmatter thêm `deprecatedBy: <id-mới>`, thân chỉ còn "Đã gộp vào
  `<id-mới>`, dùng chế độ `<x>`". Validator miễn `checkWorkflowBody` cho stub; wizard không offer stub.
- Cập nhật Registry, chuỗi nối tiếp (vd `db-change → api`), `agents`/`requires` của workflow khác, `README*`,
  `CHANGELOG.md`, `MIGRATION.md`.
- Gỡ stub ở bản phát hành kế tiếp: task riêng, ngoài spec này.

---

## 6. Thứ tự thực thi & kiểm chứng

Cổng chung mọi task: `npm test`, `npm run validate`, `npm run build`, `npm run pack:verify`. Sandbox cài thử dọn bằng
Node `fs.rmSync`, không `rm -rf` (junction trên Windows xoá xuyên vào `build/`).

| # | Task | Kiểm chứng riêng |
|---|---|---|
| 1 | A1 bỏ frontmatter chết | Diff `build/` trước/sau chỉ gồm dòng do `adapters/_shared/lib.mjs:108-136` sinh |
| 2 | A2 rule khung (cảnh báo) → sửa heading → thêm mục an toàn cho 4 `*-init` → chuyển thành lỗi | Diff các bước đổi heading chỉ gồm dòng `#`; fixture âm/dương cho rule |
| 3 | A3 rule description + sửa 48 description | Fixture âm/dương; các cụm trùng ở §2 hết vi phạm |
| 4 | A4 drift guard + sửa 4 cụm Registry lệch | Cố ý làm lệch 1 dòng neo và 1 cụm Registry → validator đỏ |
| 5 | B0 script đo + ghi số vào §5.3 | Chạy trên repo, bảng số có trong spec |
| 6 | B1 gộp (có điều kiện) | Sandbox `aip install` bản cũ → `aip update` thành công; Registry + `agents`/`requires` khớp |

Git: header commit tiếng Anh `type(scope): summary`, thân tiếng Việt có dấu, commit qua `git commit -F`; không thêm dòng
`Co-authored-by`.

---

## 7. Ngoài phạm vi

- Giảm token/context, rút gọn thân skill.
- Gộp cặp skill BE/FE, gộp 4 skill `data-*`.
- Đổi id skill/workflow (trừ B1 nếu qua tiêu chí).
- Thu thập dữ liệu sử dụng thực tế.
- Khung cho file agent (`plugins/*/agents/*.md`): đã có contract riêng trong `test/validate.mjs`.

---

## 8. Rủi ro còn lại

- `[Unverified]` Hiệu quả của mục tiêu 2 (giảm chọn sai) không đo được trong phạm vi này: không có dữ liệu chạy thật.
  Spec chỉ bảo đảm cấu trúc nhất quán và validator kiểm được.
- `[Inference]` Sửa 48 description có thể đổi hành vi chọn skill của provider (description là cơ chế trigger). Giảm
  nhẹ: giữ nguyên các cụm trigger hiện có, chỉ thêm "Không dùng khi" và bỏ câu pipeline; cụm trùng được sửa bằng cách
  thêm từ chỉ stack, không xoá.
- `[Inference]` Thêm mục an toàn cho 4 `*-init` có thể vô tình thêm quy tắc mới. Giảm nhẹ: chỉ chuyển nội dung đã có.
- `[Unverified]` Script/fork ngoài repo đọc `stageNumber`/`next`/`pipeline`.

## 9. Câu hỏi mở (chốt trong plan)

1. ~~Ngưỡng độ dài description~~: đã chốt 1024 ký tự, lỗi cứng (§10 S2).
2. Có giữ hậu tố trong heading (`Quy trình (trung tính stack)`) hay chuẩn về `Quy trình` trần: spec hiện cho phép hậu tố
   để giảm diff.

---

## 10. Sai lệch khi lập plan (2026-10-06)

Plan: [`2026-10-06-standardize-skills-workflows.md`](../plans/2026-10-06-standardize-skills-workflows.md). Số liệu đo
trên `4f139f4`.

| # | Mục spec | Thay đổi | Lý do (số đo) |
|---|---|---|---|
| S1 | §4.3 rule 5 | Câu đầu > 200 ký tự: **cảnh báo một dòng**, không chặn | 41/48 description vượt; sửa hết là viết lại câu mở đầu, ngoài phạm vi |
| S2 | §4.3 rule 6 | Description > 1024 ký tự: **lỗi cứng**; rút gọn 22 description trong Task 3, giữ nguyên danh sách trigger | Giới hạn chính thức 1024 ký tự. Hiện 12/48 vượt (cả 12 thuộc `_cowork.json`); thêm "Không dùng khi" thì thành 22/48. Chủ dự án chọn 2026-10-06. `[Unverified]` claude.ai từ chối hay cắt khi upload; Claude Code có áp cùng giới hạn không |
| S3 | §4.4 mục 1 | Dòng neo = 5 dòng khung cố định (`WF_ANCHORS`), không phải mọi dòng cố định của template; áp cho cả 13 file (orchestrator đạt sẵn) | Bảng lỗi, DoD, dòng commit được workflow tuỳ biến hợp lệ (có mặt ở 7–10/12 file) |
| S4 | §4.4 mục 1 | Bỏ dòng "Không có subagent → session chính chạy tuần tự skill tương ứng." khỏi template | 0/12 workflow có dòng này; `adapters/_shared/agents.mjs:46` đã chèn câu tương đương vào preamble khi build |
| S5 | §4.2 | `backend-performance`/`frontend-performance`: đổi `## Hai chế độ` → `## Quy trình — hai chế độ` (giữ H3) thay vì bọc + hạ cấp. `data-db-migration` vẫn bọc + hạ cấp | Diff chỉ một dòng heading mỗi file |
| S6 | §4.2 | Không có vòng "cảnh báo" riêng: rule viết dạng lỗi, test đỏ liệt kê file, sửa trong cùng commit | Cả hai bước nằm trong một task/commit nên vòng cảnh báo không mang thêm thông tin |
| S7 | §4.2 | Mục an toàn của 4 `*-init` lấy từ `## Tiền đề` + `## Quy trình` của chính skill, không lấy từ `## Ghi chú` | `## Ghi chú` của các skill này không có quy tắc an toàn nào |
| S8 | §4.3 rule 3 | Thêm cặp trùng `git-workflow` ↔ `ops-deploy-release` ("release"): đổi trigger của `git-workflow` thành "release branch" | Cặp này chưa được liệt kê ở §2 |
| S9 | §4.3 rule 1 | `→ <id>` lấy từ "Không dùng khi" tới hết description (câu này phải đứng cuối); thêm lỗi khi trỏ vào chính nó | Tách câu theo dấu chấm hỏng với "v.v." |
| S10 | §5.4 | Plan chỉ đo (B0) và ghi quyết định (B1). Nếu `api → feature` đạt cả 5 tiêu chí, việc gộp (stub `deprecatedBy`, wizard/installer, `aip update`) làm spec + plan riêng | Chưa có cơ chế stub; tiêu chí 1 có thể đã loại ứng viên: `workflow-api` có trigger riêng "làm API", "contract-first" |

---

## 11. Đặc tả chi tiết Task 5–6 (Pha B, 2026-10-06)

Phần này đặc tả đầy đủ hai task còn lại của plan để duyệt trước khi chạy. Trạng thái lúc viết: Task 1–4 đã commit
(`5655add`, `b87a14c`, `e8fc75b`, `2d49639`). Số "đo trước" dưới đây chạy bằng đúng code `test/overlap.mjs` trong plan,
trên HEAD `2d49639`, ở thư mục tạm git-ignored; Task 5 phải tái tạo được các số này.

### 11.1 Mục tiêu

| Task | Kết quả | Không làm |
|---|---|---|
| 5 (B0) | Một lệnh in số đo trùng lặp skill ↔ skill và workflow ↔ workflow, chạy lại được khi thêm skill mới | Không chặn CI, không gộp gì, không đo thư mục `references/` |
| 6 (B1) | Quyết định gộp hoặc không gộp `workflow-api` vào `workflow-feature`, ghi kèm số đo vào §5.3.1 | Không sửa workflow, installer, wizard; không làm cơ chế stub |

### 11.2 Task 5: `test/overlap.mjs`

#### 11.2.1 Giao diện

| Export | Chữ ký | Nghĩa |
|---|---|---|
| `normLines` | `(text: string) => Set<string>` | Tập dòng nội dung đã chuẩn hoá (§11.2.2) |
| `lineOverlap` | `(a: string, b: string) => number` | `|A ∩ B| / min(|A|, |B|)` trên `normLines`; 0 nếu một bên rỗng |
| `stepOverlap` | `(a: string, b: string) => number` | Tỉ lệ bước của `a` có cặp (Thực hiện, Hành động) trùng nguyên văn với một bước của `b`, chia cho `min(số bước a, số khoá bước khác nhau của b)`; 0 nếu một bên không có bước |
| `titleOverlap` | `(a: string, b: string) => number` | Như `stepOverlap` nhưng khoá là tên bước (chữ thường, bỏ `⏸`, trim) |

- Chạy trực tiếp (`node test/overlap.mjs`, alias `npm run overlap`) thì in báo cáo. Khi bị `import` (từ `test/validate.mjs`)
  thì không in gì. Điều kiện chạy: `import.meta.url === pathToFileURL(process.argv[1]).href`.
- Phụ thuộc: chỉ `cli/lib/plugins.mjs` (loader), `cli/lib/workflows.mjs` (`WF_ANCHORS`, `parseSteps`), Node built-in.
- Không nằm trong `npm test`, không nằm trong gói npm (pack-guard đã loại `test/`).

#### 11.2.2 Chuẩn hoá dòng

Thứ tự áp dụng cho mỗi dòng của body (body do loader trả, đã bỏ frontmatter và đã đổi CRLF → LF):

1. `trim()` hai đầu.
2. Bỏ dòng rỗng.
3. Bỏ dòng nằm trong `WF_ANCHORS`: dòng khung giống nhau ở mọi workflow, không phản ánh nội dung.
4. Bỏ dòng cấu trúc khớp `^(\|[-| :]+\||```.*|#+|---)$` (dòng kẻ bảng, rào code, dòng chỉ có `#`, `---`).
5. Gom thành `Set`: dòng lặp trong cùng một file chỉ tính một lần.

Dòng heading có chữ (vd `## Quy trình`) **được giữ**, vì tên heading là nội dung có thể trùng thật.

#### 11.2.3 Tập so sánh

| Bảng | Phần tử | Số cặp |
|---|---|---|
| Skill ↔ skill | 35 skill: `core/skills/*` + `plugins/*/skills/*` | 595 |
| Workflow ↔ workflow | 13 `WORKFLOW.md`, gồm orchestrator | 78 |

Mỗi cặp không thứ tự tính một lần (`i < j` theo thứ tự loader trả).

#### 11.2.4 Định dạng báo cáo

```text
## Skill ↔ skill (top 15)

| Cặp | Dòng |
|---|---|
| <id-a> ↔ <id-b> | 56% |
…

## Workflow ↔ workflow (top 15)

| Cặp | Dòng | Bước (Thực hiện + Hành động) | Tên bước |
|---|---|---|---|
…

⚠ = chạm ngưỡng gộp 60% (spec §5.2 tiêu chí 2).
```

- Sắp giảm dần theo **giá trị lớn nhất trong các cột** của dòng; hoà nhau giữ thứ tự sinh cặp.
- Phần trăm làm tròn `Math.round(x * 100)`; giá trị ≥ 0,6 có thêm ` ⚠`.
- Exit code luôn 0; không ném lỗi khi thiếu `workflows/` (`loadWorkflows()` trả `null` → bảng workflow rỗng).

#### 11.2.5 Kiểm thử (block `// 28.` trong `test/validate.mjs`)

| # | Đầu vào | Kỳ vọng |
|---|---|---|
| 1 | `lineOverlap('a\nb\nc', 'b\nc\nd\ne')` | `2/3` (chia cho tập nhỏ hơn) |
| 2 | Hai text chỉ chung một dòng `WF_ANCHORS` | `0` |
| 3 | Hai text chỉ chung `|---|---|` và ```` ``` ```` | `0` |
| 4 | `lineOverlap('', 'a')` | `0` |
| 5 | Hai workflow fixture: bước 1 trùng cả Thực hiện lẫn Hành động, bước 2 khác Thực hiện | `stepOverlap = 0.5` |
| 6 | Cùng fixture, tên bước T1/T2 có ở cả hai | `titleOverlap = 1` |

Bằng chứng chạy: `node test/validate.mjs` → `0 fail`; `npm run overlap` → in đủ 2 bảng, exit 0.

#### 11.2.6 Số đo trước (HEAD `2d49639`)

Skill ↔ skill, top 8 (không cặp nào ≥ 60%):

| Cặp | Dòng |
|---|---|
| data-oltp-init ↔ data-olap-init | 56% |
| backend-init ↔ data-oltp-init | 55% |
| data-oltp-init ↔ frontend-init | 55% |
| backend-init ↔ data-olap-init | 51% |
| data-olap-init ↔ frontend-init | 51% |
| backend-fix ↔ frontend-fix | 51% |
| backend-code-review ↔ frontend-code-review | 49% |
| backend-init ↔ frontend-init | 48% |

Workflow ↔ workflow, các dòng liên quan (không cặp nào ≥ 60%):

| Cặp | Dòng | Bước | Tên bước |
|---|---|---|---|
| workflow-feature ↔ workflow-api | 30% | 0% | 38% |
| workflow-feature ↔ workflow-bugfix | 26% | 0% | 38% |
| workflow-feature ↔ workflow-db-change | 20% | 0% | 38% |
| workflow-api ↔ workflow-docs | 35% | 20% | 20% |

`[Inference]` Bốn skill `*-init` trùng 48–56% vì cùng khung scaffold (Tiền đề, bước copy `templates/`, mục an toàn mới
của Task 2). Đây là trùng boilerplate, không phải trùng chức năng: mỗi skill tạo cây thư mục khác nhau. Ghi nhận, ngoài
phạm vi spec này.

#### 11.2.7 Giới hạn đã biết

- `lineOverlap` so dòng nguyên văn nên đánh giá thấp nội dung được diễn đạt lại; không có so khớp ngữ nghĩa.
- `stepOverlap` so nguyên văn hai trường nên gần như luôn 0 giữa workflow khác nhau (đo trước: 0% ở mọi cặp có
  `workflow-feature`). Cột này chủ yếu bắt workflow bị chép nguyên bước.
- Ngưỡng 60% là đề xuất của spec (§3 D5), chưa được hiệu chỉnh bằng dữ liệu sử dụng thật.

### 11.3 Task 6: quyết định B1 cho `workflow-api → workflow-feature`

#### 11.3.1 Đính chính §5.3

§5.3 ghi "6/8 tên bước của `api` tương ứng bước của `feature`". Con số đó do so tên bước **theo nghĩa** (vd "Contract"
≈ "Thiết kế & contract"). So **nguyên văn** (`titleOverlap`) chỉ trùng 3/8 bước của `api` (38%): "Baseline build/test",
"Test", "Commit". Task 6 sửa câu trong §5.3 theo số nguyên văn và giữ ghi chú về cách so cũ.

#### 11.3.2 Cách đánh giá từng tiêu chí

| # | Tiêu chí (§5.2) | Cách kiểm | Đạt khi | Đo trước |
|---|---|---|---|---|
| 1 | Không có trigger độc lập | Lấy cụm trong ngoặc kép ở description `workflow-api`; kiểm từng cụm có xuất hiện (không phân biệt hoa thường) trong description `workflow-feature` | Mọi cụm của `api` có trong `feature` | **Không đạt**: "làm API", "thêm endpoint", "OpenAPI", "contract-first" không có trong `feature` |
| 2 | Trùng ≥ 60% | Dòng `workflow-feature ↔ workflow-api` trong `npm run overlap` | Cột Dòng **hoặc** cột Bước ≥ 60% | **Không đạt**: Dòng 30%, Bước 0% |
| 3 | Cùng `risk` và `tier` | Frontmatter hai file | Bằng nhau cả hai | **Không đạt**: risk cùng `medium`; tier `api` = 2, `feature` = 1 |
| 4 | Bản gộp ≤ 272 dòng | `wc -l`; ước lượng = dòng `feature` + dòng riêng của `api` (= dòng `api` × (1 − cột Dòng)) | Ước lượng ≤ 272 | **Không đạt**: 232 + 209 × 0,70 ≈ 378 |
| 5 | Có đường migrate | Có cơ chế stub `deprecatedBy` + `aip update` không lỗi với id cũ | Cả hai có | **Không đạt**: chưa có cơ chế stub (§5.4) |

Gộp chỉ khi đạt cả 5. Với số đo trước, kết luận dự kiến là **không gộp**. Task 6 phải chạy lại `npm run overlap` và
đối chiếu: nếu số mới khác số đo trước ở bất kỳ ô nào, ghi số mới và đánh giá lại; không được chép bảng đo trước.

#### 11.3.3 Nội dung ghi vào spec

1. Thêm `### 5.3.1 Số đo B0 và quyết định (<ngày chạy>)` ngay sau bảng §5.3, gồm theo thứ tự:
   a. lệnh đã chạy và HEAD lúc chạy;
   b. hai bảng top 15 dán nguyên văn từ `npm run overlap`;
   c. bảng 5 tiêu chí của §11.3.2 với cột "Kết quả" là số vừa đo;
   d. một câu kết luận: "Không gộp `workflow-api` vào `workflow-feature`; Pha B kết thúc." hoặc, nếu đạt cả 5,
      "Đủ điều kiện gộp; việc gộp làm spec + plan riêng (§5.4, §10 S10)".
2. Bảng §5.3: cột "Trạng thái" của dòng `workflow-api` đổi từ "Chờ số đo B0" thành "Giữ (§5.3.1)" hoặc
   "Đủ điều kiện, spec riêng"; cột "Bằng chứng hiện có" sửa theo §11.3.1.
3. Dòng trạng thái đầu spec: `**Đã thực thi Pha A + B0 + B1 (<ngày chạy>)**`.
4. Không sửa file nào ngoài spec này.

#### 11.3.4 Kiểm chứng Task 6

- `npm test` exit 0 (spec không nằm trong phạm vi validator nhưng vẫn chạy để chắc không có thay đổi lạc).
- `git diff --stat HEAD` chỉ có file spec.
- Mọi số trong §5.3.1 truy được về output `npm run overlap` hoặc frontmatter/description (người duyệt so được).

### 11.4 Rủi ro còn lại

- `[Inference]` Nếu ngưỡng 60% quá cao thì Pha B không bao giờ ra quyết định gộp; đổi ngưỡng là quyết định của chủ dự
  án, không thuộc spec này.
- `[Unverified]` Số đo trước chạy trên bản tạm có cùng nội dung với HEAD `2d49639`; Task 5 chạy trên repo thật phải ra
  cùng số. Lệch thì ghi số thật.
