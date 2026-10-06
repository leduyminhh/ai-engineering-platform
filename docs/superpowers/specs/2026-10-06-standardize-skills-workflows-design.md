# Thiết kế: Chuẩn hoá skill + workflow và gộp có điều kiện

- Ngày: 2026-10-06
- Trạng thái: **Chờ duyệt spec**.
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
5. Câu đầu tiên (đến dấu `.` đầu) không quá 200 ký tự, vì `whenToUse()` render câu này.
6. Độ dài: cảnh báo khi vượt ngưỡng, không chặn. `[Unverified]` Một số provider có thể giới hạn độ dài description
   (vd 1.024 ký tự); plan phải kiểm tài liệu chính thức của từng provider trước khi chốt ngưỡng.

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
| `workflow-api` → chế độ của `workflow-feature` | 6/8 tên bước của `api` tương ứng bước của `feature`; cùng risk `medium`. `[Unverified]` Mới so tên bước, chưa so nội dung | Chờ số đo B0 |
| `workflow-db-change` | 9 bước riêng, risk `high`, checkpoint xác nhận DB đích | Giữ |
| `workflow-docs` | Là đích nối tiếp của 6 workflow trong Registry | Giữ |
| 4 skill `data-oltp-*`/`data-olap-*` | `init` 25/57, `implement` 10/96 dòng chung | Giữ (§2.1) |
| 6 cặp skill BE/FE | 16–53 dòng chung | Giữ (D2) |

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

1. Ngưỡng cảnh báo độ dài description: chờ kiểm giới hạn chính thức của từng provider (§4.3 rule 6).
2. Có giữ hậu tố trong heading (`Quy trình (trung tính stack)`) hay chuẩn về `Quy trình` trần: spec hiện cho phép hậu tố
   để giảm diff.
