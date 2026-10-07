# Thiết kế: skill `engineering-task-breakdown` — teamlead tách yêu cầu thành task BE/FE

- Ngày: 2026-10-07
- Trạng thái: **Chờ duyệt spec**
- Phạm vi: skill mới trong plugin `engineering` + cập nhật manifest/cowork/README/CLAUDE.md + assert trong
  `test/validate.mjs`. Không đụng `cli/`, `adapters/`, `workflows/`, không thêm agent.
- Người duyệt: chủ dự án (teamlead).
- Hướng đã chọn: **Phương án 1** — một skill docs-only trong `engineering`. Đã loại: (2) skill + agent + workflow
  riêng (YAGNI khi skill chưa được kiểm chứng), (3) mở rộng `engineering-spec-writing` (phá ranh giới "không phân rã
  story" của skill đó).

---

## 0. Cách đọc & nhãn

| Nhãn | Nghĩa |
|---|---|
| (không nhãn) | Đã kiểm chứng bằng đọc file trong repo |
| `[Inference]` | Suy luận từ nội dung đã đọc, chưa chạy thực tế |
| `[Unverified]` | Chưa kiểm chứng |

Số liệu đọc trên `master` = `34a846c`.

---

## 1. Vấn đề & mục tiêu

### 1.1 Vấn đề

- `engineering-spec-writing` viết spec **mức feature** và ghi rõ "KHÔNG phân rã story/task chi tiết".
- `templates/init/docs/requests/_TEMPLATE/plan.md` chỉ có khung Phase → `Task x.y: <mô tả, file dự kiến đụng tới>`.
- `workflow-feature` Bước 2 chỉ xác định phạm vi BE/FE/fullstack, không tách task.

→ Không có skill nào biến yêu cầu/use case/ARD thành **danh sách task giao được** với template chuẩn cho BE và FE.

### 1.2 Mục tiêu (chủ dự án chốt 2026-10-07)

1. Teamlead đưa input bất kỳ (yêu cầu thô, use case, ARD, `requirement.md`) → nhận danh sách task có ID, phụ thuộc,
   size, AC đo được.
2. Task phục vụ **hai đối tượng**: dev trong team đọc markdown trong repo, và agent AI (`backend-implementer`,
   `frontend-implementer`…) nhận từng task để code. Mỗi task phải **tự đủ nghĩa** — nhận một task không cần đọc lại
   toàn bộ input.
3. Template chuẩn nói rõ **Backend cần gì** và **Frontend cần gì**.
4. Đầu ra chọn được: `md` (mặc định) hoặc `md + excel`.

### 1.3 Tiêu chí thành công

- Mọi AC của mọi use case được phủ bởi ≥ 1 task (truy vết được).
- Không còn task size `L`; không vòng phụ thuộc; không mục template bỏ trống (dùng `N/A — <lý do>`).
- Agent nhận "làm task `UC01-BE-01` trong `tasks.md`" có đủ: ngữ cảnh, AC, file dự kiến, lệnh verify, DoD, skill gợi ý.
- `npm test` xanh với assert mới cho skill.

### 1.4 Ngoài phạm vi

- Gán người (`Owner` để trống cho teamlead điền).
- Đồng bộ với Jira/Azure DevOps/GitLab Issues qua API.
- Agent/workflow riêng cho teamlead.
- Ước lượng bằng giờ hoặc story point.

---

## 2. Quyết định đã chốt

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Ai dùng task? | Dev đọc markdown **và** agent AI nhận task |
| Q2 | Trục tách task | **Theo use case — lát dọc** (CT → DB → BE → FE-UI → FE-INT → E2E) |
| Q3 | Input | **Mọi loại input**; mơ hồ → dừng, đề nghị `engineering-spec-writing`; có `requirement.md` thì dùng làm nguồn chính |
| Q4 | Ước lượng | **Size S/M/L**, `L` buộc tách; cột `Owner` để trống |
| Q5 | Định dạng đầu ra | `md` mặc định; `md + excel` → `.xlsx` nếu môi trường hỗ trợ, nếu không thì CSV UTF-8 có BOM |

`[Unverified]` "ARD" được hiểu là *Architecture Requirements Document*. Repo hiện có
`plugins/backend/skills/backend-implement/architecture/ARD.md` dùng cùng tên; skill xử lý ARD như một nguồn input
tài liệu kiến trúc/yêu cầu, không phụ thuộc định dạng cụ thể.

---

## 3. Mô hình task

### 3.1 Loại task

| Loại | ID mẫu | Khi nào sinh | Skill / agent gợi ý |
|---|---|---|---|
| `CT` Contract | `UC01-CT-01` | Use case có API mới hoặc đổi API | `backend-api-contract` |
| `DB` Schema | `UC01-DB-01` | Đổi bảng / cột / index | `data-db-migration` (luồng `workflow-db-change`) |
| `BE` Slice | `UC01-BE-01` | Mỗi command/query | `backend-implement` → agent `backend-implementer` |
| `FE-UI` | `UC01-FE-01` | Mỗi màn hình / component | `frontend-implement` → agent `frontend-implementer` |
| `FE-INT` | `UC01-FE-02` | Nối UI với API | `frontend-data-integration` |
| `E2E` | `UC01-E2E-01` | Chỉ khi AC là luồng UI đầu-cuối | `frontend-e2e-testing` |

- ID: `UC<nn>-<loại>-<nn>`; `FE-UI` và `FE-INT` dùng chung tiền tố `FE` và đánh số liên tục trong use case.
- Nhóm `UC00` dành cho nền tảng dùng chung (auth, layout, shared component) — chỉ sinh khi ≥ 2 use case cần.
- Unit/integration test **nằm trong DoD** của task BE/FE, không tách task riêng.

### 3.2 Header chung (mọi task)

ID · Use case · Loại · Size · Phụ thuộc · Owner · Trạng thái · Skill gợi ý · Nguồn (truy vết đoạn input gốc) ·
Ngữ cảnh (2–3 dòng) · AC đo được (truy vết về AC của use case) · File dự kiến · Lệnh verify · DoD.

### 3.3 Backend cần gì (`task-template-backend.md`)

1. Endpoint: method, path, `operationId` trong contract.
2. Use case: command hay query.
3. Aggregate + invariant nghiệp vụ.
4. Validation rule theo từng field.
5. Phân quyền: role/scope được gọi.
6. Dữ liệu chạm: bảng đọc/ghi; đổi schema → tham chiếu task `DB`.
7. Bảng lỗi: case → mã lỗi → HTTP status.
8. Transaction / idempotency / concurrency.
9. NFR: SLA hiệu năng, audit/log, dữ liệu nhạy cảm.
10. Test bắt buộc: unit lõi + integration adapter.

### 3.4 Frontend cần gì (`task-template-frontend.md`)

1. Route / màn hình.
2. Nguồn thiết kế: Figma / HTML / ảnh (link).
3. Component tái dùng (design-system / component lib) + component mới.
4. Bốn trạng thái: loading / empty / error / success.
5. Form: field, validation (đồng bộ rule BE), thông báo lỗi.
6. API dùng (`operationId`); map lỗi 401/403/4xx/5xx sang UI.
7. Phân quyền hiển thị.
8. i18n, a11y, responsive (breakpoint).
9. Test bắt buộc: render + interaction, mock API bằng msw.

### 3.5 Template `CT` / `DB` / `E2E` (`task-template-common.md`)

- `CT`: endpoint cần chốt, request/response schema, mã lỗi, versioning / tương thích ngược.
- `DB`: bảng/cột/index thay đổi, có backfill dữ liệu không, khả năng rollback, gợi ý `workflow-db-change`.
- `E2E`: luồng UI đầu-cuối, AC phủ, dữ liệu seed, lý do không chứng minh được ở tầng unit/integration.

### 3.6 Quy tắc điền template

- Mục không áp dụng → `N/A — <lý do>`, không bỏ trống (phân biệt "không cần" với "quên").
- Thiếu thông tin → `[giả định]` hoặc đưa vào Câu hỏi mở; KHÔNG bịa.

---

## 4. Quy trình skill

0. **Nạp context.** Đọc `project-knowledge/` (`architecture.md` BE/FE, `data-model.md`, `design-system.md`,
   `code-convention.md`), `docs/contracts/`, `docs/decisions/`. Thiếu `project-knowledge/` → nói rõ (fail-loud), vẫn
   tách được nhưng đánh dấu `[giả định]` ở "File dự kiến" và "Lệnh verify".
1. **Nhận diện input.** Yêu cầu thô / use case / ARD / `requirement.md` (có thể nhiều nguồn). Có `requirement.md` →
   nguồn chính. **Ngưỡng mơ hồ:** không trích được use case nào có actor + mục tiêu, HOẶC không có AC đo được → dừng,
   đề nghị `engineering-spec-writing`.
2. **Phân tích → bảng Use case** (actor, mục tiêu, luồng chính/phụ, AC, NFR, nguồn). Suy đoán → `[giả định]` + Câu hỏi
   mở. ⏸ **Checkpoint 1:** teamlead duyệt use case + câu hỏi mở trước khi tách task.
3. **Tách task theo lát dọc** `CT → DB → BE → FE-UI → FE-INT → E2E`, chỉ sinh loại cần. Phụ thuộc chuẩn:
   - `BE` ← `CT`, `DB`
   - `FE-INT` ← `CT`, `FE-UI`
   - `FE-UI` **không** phụ thuộc `BE` (làm song song khi có contract/mock)
   - `E2E` ← `BE`, `FE-INT`
4. **Điền template + size.** S ≤ 0.5 ngày, M ≤ 2 ngày, L > 2 ngày → **buộc tách**. Mỗi task có ≥ 1 AC truy vết về AC
   use case.
5. **Kiểm tra** theo `breakdown-checklist.md`: phủ AC, không vòng phụ thuộc, không task L, không mục trống, ID duy nhất.
   ⏸ **Checkpoint 2:** teamlead duyệt bản tách task.
6. **Xuất file** theo §5.

### 4.1 Ranh giới an toàn

- Docs-only: KHÔNG sinh code; chỉ ghi trong `docs/requests/`.
- KHÔNG tự chốt quyết định kiến trúc → tạo câu hỏi mở + gợi ý `engineering-adr`.
- KHÔNG gán `Owner`.
- Đổi schema → nêu rõ + gợi ý `workflow-db-change`.
- KHÔNG ghi đè `plan.md` / `requirement.md` có sẵn.
- Ngôn ngữ đo được, không tuyên bố tuyệt đối ("đảm bảo", "loại bỏ").

---

## 5. Định dạng đầu ra

### 5.1 Chọn định dạng

Hỏi một lần ở bước 6 (hoặc lấy từ yêu cầu ban đầu): `md` (mặc định) | `md + excel`. Markdown **luôn sinh** — là nguồn
sự thật; Excel là bản xuất, sửa task thì sửa md rồi xuất lại.

### 5.2 Vị trí

`docs/requests/<yyyy-mm-dd>-<slug>/` — cùng thư mục `requirement.md` nếu đã có.

```
tasks.md      # nguồn sự thật
tasks.xlsx    # hoặc tasks.csv — chỉ khi chọn excel
```

### 5.3 Cấu trúc `tasks.md`

1. Tóm tắt: nguồn input, số use case, số task, tổng size theo loại.
2. Bảng Use case: ID, tên, actor, AC, nguồn.
3. Bảng tổng task: ID (anchor link), UC, loại, tiêu đề, size, phụ thuộc, owner, trạng thái, skill gợi ý.
4. Thứ tự thực hiện gợi ý: theo phụ thuộc, đánh dấu nhóm song song được.
5. Chi tiết từng task: `### UC01-BE-01 — <tiêu đề>` theo template §3.
6. Câu hỏi mở & giả định.

### 5.4 Excel

| Sheet | Cột |
|---|---|
| `Tasks` | ID · UC · Loại · Tiêu đề · Size · Phụ thuộc · Owner · Trạng thái · Skill gợi ý · AC (nhiều dòng trong 1 ô) · Link chi tiết (`tasks.md#…`) |
| `UseCases` | ID · Tên · Actor · AC · Nguồn |
| `OpenQuestions` | # · Câu hỏi · Ảnh hưởng tới task · Trạng thái |

- `.xlsx`: sinh khi môi trường có công cụ (skill xlsx, hoặc Python + `openpyxl`).
- Không có → **CSV** chỉ sheet `Tasks`, **UTF-8 có BOM**, quote mọi ô; báo rõ đã fallback.
  `[Inference]` Excel trên Windows thường đọc CSV không BOM theo codepage hệ thống nên hỏng dấu. Đây là output trong
  project đích, không phải file nguồn của repo, nên không vi phạm quy ước "UTF-8 không BOM" của repo.
- Excel không chứa chi tiết đầy đủ — "Link chi tiết" trỏ về `tasks.md` để tránh hai nguồn lệch nhau.

### 5.5 Quan hệ với `plan.md`

Không ghi đè. Nếu `plan.md` đã tồn tại → chỉ thêm 1 dòng link tới `tasks.md`.

---

## 6. Tích hợp vào repo

### 6.1 File tạo mới — `plugins/engineering/skills/engineering-task-breakdown/`

| File | Nội dung |
|---|---|
| `SKILL.md` | frontmatter `name`, `description`, `order: 7`, `title`, `runsIn: plan`, `invoke: per-request`; H2 `## Quy trình…` + `## Ranh giới an toàn…` |
| `references/analysis.md` | trích UC/actor/AC/NFR; ngưỡng mơ hồ → spec-writing |
| `references/task-template-backend.md` | §3.3 |
| `references/task-template-frontend.md` | §3.4 |
| `references/task-template-common.md` | §3.2 + §3.5 + §3.6 |
| `references/sizing.md` | S/M/L + quy tắc tách L |
| `references/output-formats.md` | §5 |
| `references/breakdown-checklist.md` | DoD bước 5 (tên khác `checklist.md` của spec-writing vì tên file references/ phải duy nhất trong plugin — test/validate.mjs:240) |

Description: ≤ 1024 ký tự; trigger dự kiến "tách task", "chia task", "phân rã yêu cầu", "breakdown task", "lập task
BE FE", "task từ use case"; không trùng nguyên văn trigger của skill khác; kết thúc
`Không dùng khi yêu cầu còn mơ hồ cần khảo sát → engineering-spec-writing.`

### 6.2 File sửa

| File | Thay đổi |
|---|---|
| `plugins/engineering/.manifest.json` | "6 skill" → "7 skill", thêm mô tả 1 dòng, version `1.2.1` → `1.3.0` |
| `plugins/_cowork.json` | thêm `engineering:engineering-task-breakdown` |
| `README.md`, `README_VI.md` | thêm skill vào dòng plugin engineering; xoá dòng G9 `engineering-task-breakdown` khỏi Roadmap (gap đã lấp) |
| `CLAUDE.md` | `engineering` (6 skills) → (7 skills) |
| `plugins/engineering/skills/engineering-spec-writing/SKILL.md` | thêm 1 câu trỏ phần phân rã task sang skill mới; không đổi ranh giới |

Không sửa: `plugins/_published.json` (engineering publish nguyên plugin → wizard tự offer), `cli/`, `adapters/`,
`workflows/`, `pack.config.json`, `package.json`.

---

## 7. Kiểm thử

### 7.1 Test-first (`test/validate.mjs`)

Assert viết trước, chạy thấy đỏ, rồi mới thêm nội dung:

- Có `SKILL.md`; frontmatter `order: 7`, `runsIn: plan`.
- Đủ 7 file `references/` và link từ `SKILL.md` tới từng file.
- `task-template-backend.md` có đủ 10 mục §3.3; `task-template-frontend.md` có đủ 9 mục §3.4.
- Có đủ 6 loại task `CT`, `DB`, `BE`, `FE-UI`, `FE-INT`, `E2E`.
- Có quy tắc `N/A — <lý do>`, quy tắc tách task `L`, quy tắc CSV UTF-8 có BOM.
- Manifest engineering liệt kê skill mới (assert sẵn có của validate).

### 7.2 Lệnh xác nhận

`npm run build` · `npm test` · `npm run overlap` (advisory) · `npm run pack:verify`.

### 7.3 Pilot

Chạy skill trên một yêu cầu mẫu nhỏ trong sandbox (`$AIE_INSTALL_ROOT`), kiểm `tasks.md` + `tasks.csv` theo
`breakdown-checklist.md`. `[Unverified]` Nhánh `.xlsx` phụ thuộc môi trường có `openpyxl`; nếu không có thì báo rõ chỉ kiểm được
nhánh CSV.

---

## 8. Rủi ro & giả định

| Rủi ro | Giảm thiểu |
|---|---|
| Trigger chồng `engineering-spec-writing` / `workflow-feature` | Câu "Không dùng khi"; `npm run overlap`; spec-writing trỏ sang skill mới |
| Agent bỏ mục template vì "không cần" | Quy tắc `N/A — <lý do>` + checklist "không mục trống" |
| Size ước lượng lệch thực tế | Size chỉ là gợi ý; teamlead duyệt ở Checkpoint 2 |
| `.xlsx` không sinh được trên một số provider | Fallback CSV có BOM + báo rõ |
| `[Unverified]` "ARD" khác nghĩa với cách hiểu | Skill xử lý ARD như tài liệu input chung, không giả định định dạng |
