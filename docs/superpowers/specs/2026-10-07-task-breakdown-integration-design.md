# Thiết kế: nối `engineering-task-breakdown` vào platform + script `check-tasks.mjs`

- Ngày: 2026-10-07
- Trạng thái: **Chờ duyệt spec**
- Phạm vi: Phase 1 — skill code nhận task từ `tasks.md`, `workflow-feature`, agent `engineering-spec-analyst`,
  `plugins/engineering/shared/principles.md`. Phase 2 — script Node zero-dep `check-tasks.mjs` (kiểm + xuất CSV) ship
  kèm skill `engineering-task-breakdown`.
- Người duyệt: chủ dự án (teamlead).
- Tiền đề: skill `engineering-task-breakdown` đã merge vào `master` local (`d804d01`), spec gốc
  `docs/superpowers/specs/2026-10-07-engineering-task-breakdown-design.md`.
- Hướng đã chọn (2026-10-07): Q1 = A (3 skill code), Q2 = A (mở rộng Bước 2, không đánh số lại), Q3 = A (script nằm
  trong skill).

---

## 0. Cách đọc & nhãn

| Nhãn | Nghĩa |
|---|---|
| (không nhãn) | Đã kiểm chứng bằng đọc file trong repo |
| `[Inference]` | Suy luận từ nội dung đã đọc, chưa chạy thực tế |
| `[Chưa thảo luận]` | Thiết kế viết thẳng vào spec, chưa trình trong chat — người duyệt cần đọc kỹ |

---

## 1. Vấn đề & mục tiêu

### 1.1 Vấn đề

- Skill `engineering-task-breakdown` sinh `tasks.md` để "giao cho agent", nhưng không skill code nào biết đọc một task:
  `backend-implement` → `references/use-case-intake.md` chỉ có nguồn A (mô tả), B (`requirement.md`), C (contract).
- `workflow-feature` Bước 2 ghi "không phân rã story/task chi tiết"; Bước 4 giao implementer theo `requirement.md`.
- Agent `engineering-spec-analyst` có phạm vi "Không được: … phân rã story/task chi tiết".
- `plugins/engineering/shared/principles.md` chỉ nêu 3 skill (`quality-gate`, `spec-writing`, `diagram`) và ghi "Mỗi skill
  là recipe docs-only — KHÔNG sinh code chạy được".
- Checklist của `tasks.md` (ID, vòng phụ thuộc, phủ AC, size L) do agent tự kiểm bằng đọc; pilot 11 task đã phải tự lập
  bảng AC → task. `[Inference]` Với > 20 task, kiểm bằng mắt dễ sót.
- Nhánh CSV phụ thuộc Python (`py`/`python`), trên Windows `python` có thể là stub.

### 1.2 Mục tiêu

1. Agent code nhận "làm task `<ID>` trong `tasks.md`" và có quy tắc map trường task → đầu vào của skill.
2. `workflow-feature` dùng được `tasks.md` khi người dùng chọn tách task, không phá luồng hiện có.
3. Kiểm `tasks.md` bằng script tất định; xuất CSV không cần Python.

### 1.3 Tiêu chí thành công

- 3 skill code (`backend-implement`, `frontend-implement`, `frontend-data-integration`) có mục nhận task, kiểm bởi assert.
- `workflow-feature` Bước 2/Bước 4 nhắc `engineering-task-breakdown` / `tasks.md`; khung workflow (`WF_ANCHORS`) và
  Registry vẫn xanh.
- `check-tasks.mjs` bắt đúng từng mã lỗi E1–E9 trên fixture; fixture hợp lệ cho 0 lỗi; CSV bắt đầu bằng BOM.
- `npm test` xanh; không sửa `package.json`, `pack.config.json`, `cli/`, `adapters/`.

### 1.4 Ngoài phạm vi

- Skill `backend-api-contract`, `data-db-migration`, `frontend-e2e-testing` nhận task (Q1 đã loại).
- Lệnh CLI `aip check-tasks` (Q3 đã loại).
- Tự viết `.xlsx` zero-dep (vẫn dùng `openpyxl`).
- Agent tự sửa `tasks.md` (cập nhật Trạng thái do session chính làm).
- Bump version manifest `backend`/`frontend`: chỉ đổi câu chữ, và version của hai manifest này bị assert cứng
  (`test/validate.mjs:1316`, `:1470`, `:1789`).

---

## 2. Phase 1 — nối vào platform

### 2.1 Quy tắc chung khi skill code nhận task

Áp dụng cho cả 3 skill, viết lại ngắn gọn trong từng skill (mỗi skill phải đọc được độc lập):

- Đầu vào dạng "task `<ID>` trong `docs/requests/<…>/tasks.md`" → đọc **chỉ** mục chi tiết của task đó (anchor
  `<a id="<id chữ thường>">`) + mục của các task trong cột Phụ thuộc; không làm phần việc của task khác.
- AC + DoD của task là tiêu chí xong; "Lệnh verify" là lệnh build/test phải chạy.
- Mục còn `[giả định]` ảnh hưởng thiết kế (aggregate, endpoint, quyền, nguồn thiết kế) → hỏi lại, không tự chốt.
- Kết thúc: báo trạng thái đề xuất (`Done` hoặc lý do chặn) để session chính cập nhật cột Trạng thái; agent
  **không** sửa `tasks.md`.

### 2.2 `backend-implement`

File `plugins/backend/skills/backend-implement/references/use-case-intake.md`: thêm mục
**"## Nguồn D — task `BE` trong `tasks.md`"** sau nguồn C, gồm quy tắc §2.1 + bảng map:

| Trường task | Phạm vi use-case |
|---|---|
| B1 Endpoint | kênh vào (endpoint / trigger) + input/output DTO theo contract |
| B2 Use case | command hay query |
| B3 Aggregate + invariant | aggregate root + invariant |
| B4 Validation, B5 Phân quyền, B7 Bảng lỗi | ràng buộc ở biên + mã lỗi |
| B6 Dữ liệu chạm | driven port (repository/gateway); đổi schema → task `DB` phải xong trước |
| B8 Transaction / idempotency | ranh giới transaction |
| B10 Test bắt buộc | test lõi + integration của slice |

`SKILL.md` bước 1 "Chốt use-case": thêm `tasks.md` vào danh sách nguồn đầu vào (một cụm, trỏ intake).

### 2.3 `frontend-implement`

File `plugins/frontend/skills/frontend-implement/SKILL.md`, mục `### 1. Chuẩn hoá đầu vào → "design intent"`: thêm
đoạn **"Nhận task `FE-UI` từ `tasks.md`"** gồm quy tắc §2.1 + map: F2 → nguồn thiết kế đưa vào input adapter; F3 →
component tái dùng/mới; F1, F4, F5, F7, F8 → yêu cầu UI (route, 4 trạng thái, form, phân quyền hiển thị,
i18n/a11y/responsive); F6 là `N/A` (nối API thuộc task `FE-INT`); F9 → test render + interaction.

### 2.4 `frontend-data-integration`

File `plugins/frontend/skills/frontend-data-integration/SKILL.md`, mục `### 0. Nạp context`: thêm đoạn **"Nhận task
`FE-INT` từ `tasks.md`"** gồm quy tắc §2.1 + map: F6 → `operationId` + map lỗi theo bảng B7 của task `BE` liên quan;
F4 → 4 trạng thái; F9 → test mock bằng msw; task `FE-UI` trong Phụ thuộc là container/page cần nối.

### 2.5 `workflow-feature` (`workflows/feature/WORKFLOW.md`)

- **Bước 2** — Hành động: thêm câu "Ở checkpoint, hỏi người dùng có tách task không (gợi ý có khi phạm vi `fullstack`
  hoặc ≥ 2 use case); có → `engineering-spec-analyst` chạy skill `engineering-task-breakdown`, sinh `tasks.md` cùng
  thư mục." Ràng buộc: bỏ cụm "không phân rã story/task chi tiết", thay bằng "chỉ phân rã task khi người dùng chọn".
  Đầu ra / Gate / Evidence: thêm `tasks.md` (nếu chọn) + kết quả checklist (và `check-tasks.mjs` sau Phase 2).
- **Bước 4** — Hành động: thêm "Có `tasks.md` → giao từng task theo thứ tự phụ thuộc (nhóm song song chạy song song):
  `BE` → `backend-implementer`, `FE-UI` → `frontend-implementer`, `FE-INT` → `frontend-data-integrator`; mỗi task xong
  cập nhật Trạng thái trong `tasks.md`." Không có `tasks.md` → luồng cũ giữ nguyên.
- Không đổi số bước, không đổi frontmatter `agents`, không đổi Registry orchestrator.

### 2.6 Agent `engineering-spec-analyst` (`plugins/engineering/agents/engineering-spec-analyst.md`)

- `skills`: thêm `engineering-task-breakdown`.
- Description: thêm cụm "và phân rã task BE/FE theo skill engineering-task-breakdown khi được yêu cầu".
- Phạm vi "Được": thêm `tasks.md` (+ `tasks.csv`/`tasks.xlsx`) trong `docs/requests/<ngày>-<slug>/`. "Không được":
  đổi "phân rã story/task chi tiết" → "phân rã task khi người dùng chưa yêu cầu".
- Quy trình: thêm bước "Được yêu cầu tách task → đọc skill `engineering-task-breakdown`, chạy bước 0–6, dừng ở 2
  checkpoint chờ người duyệt".
- Report: thêm `tasks.md` + kết quả checklist.
- `README.md:177` / `README_VI.md:172` (bảng agent): cột skill thêm `engineering-task-breakdown`.

### 2.7 `plugins/engineering/shared/principles.md`

- Đoạn "Bản chất plugin": liệt kê đủ 7 skill (`quality-gate`, `spec-writing`, `task-breakdown`, `diagram`, `adr`,
  `convention-enforce`, `release-notes`).
- Câu "docs-only — KHÔNG sinh code chạy được" sửa ở Phase 2 (§3.6).

---

## 3. Phase 2 — `check-tasks.mjs` `[Chưa thảo luận]`

### 3.1 Vị trí & cách chạy

- File: `plugins/engineering/skills/engineering-task-breakdown/scripts/check-tasks.mjs`. Thư mục cạnh `SKILL.md` tự ship
  sang mọi provider (`cli/lib/plugins.mjs:142` → `adapters/_shared/lib.mjs:50` `copyDir`).
- Node ≥ 20, ESM, chỉ dùng built-in (`node:fs`, `node:path`, `node:url`).
- Chạy: `node <skill-dir>/scripts/check-tasks.mjs <path/tasks.md> [--csv <out.csv>]`.
- Exit code: `0` không lỗi (có thể có cảnh báo), `1` có lỗi E*, `2` sai tham số / không đọc được file.
- Module export `parseTasks(text)`, `checkTasks(model)`, `toCsv(model)`; phần CLI chỉ chạy khi file được gọi trực tiếp
  (`import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href` — realpath vì skill cài trên Windows qua junction) để test import được.

### 3.2 Hợp đồng parse (bám `output-formats.md` §3)

- Tìm mục theo **tên heading H2** (không theo số): heading chứa "Use case", "Bảng tổng task", "Chi tiết task".
- Bảng Use case: cột theo tên header (`ID`, `AC`); mã AC lấy bằng regex `AC\d+\.\d+` trong ô AC.
- Bảng tổng task: cột theo tên header `ID`, `UC`, `Loại`, `Tiêu đề`, `Size`, `Phụ thuộc`, `Owner`, `Trạng thái`,
  `Skill gợi ý`; ô ID dạng `[UC01-BE-01](#uc01-be-01)` hoặc ID trần; Phụ thuộc tách bằng dấu phẩy, `—`/rỗng = không có.
- Chi tiết task: mỗi task = `<a id="…"></a>` + `### <ID> — <tiêu đề>`; AC của task = dòng `- [ ] AC…`/`- [x] AC…`
  trong mục đó; mục riêng BE nhận diện bằng `**B<n>. `, FE bằng `**F<n>. `.
- Mỗi lỗi kèm số dòng trong `tasks.md`.

### 3.3 Luật kiểm

| Mã | Mức | Luật |
|---|---|---|
| E1 | lỗi | ID đúng `^UC\d{2}-(CT\|DB\|BE\|FE\|E2E)-\d{2}$`; tiền tố khớp Loại (`FE` ↔ `FE-UI`/`FE-INT`) |
| E2 | lỗi | ID trùng trong bảng tổng |
| E3 | lỗi | Bảng tổng ↔ chi tiết khớp 1–1; anchor `<a id>` = ID chữ thường |
| E4 | lỗi | Phụ thuộc trỏ ID có trong bảng tổng |
| E5 | lỗi | Không vòng phụ thuộc (in ra chu trình) |
| E6 | lỗi | Size ∈ {S, M}; `L` → "buộc tách" |
| E7 | lỗi | Mọi AC trong bảng Use case được ≥ 1 task phủ |
| E8 | lỗi | Mọi AC trong task tồn tại trong bảng Use case; mỗi task có ≥ 1 AC |
| E9 | lỗi | Ô bảng tổng không rỗng (trừ Owner); task `BE` đủ B1–B10; `FE-UI`/`FE-INT` đủ F1–F9 |
| W1 | cảnh báo | Thiếu phụ thuộc tối thiểu: `BE` thiếu `CT`/`DB` cùng UC đang tồn tại; `FE-INT` thiếu `CT`/`FE-UI` cùng UC; `E2E` thiếu `BE`/`FE-INT` cùng UC |
| W2 | cảnh báo | `FE-UI` có `CT` trong Phụ thuộc |

Đầu ra dạng `tasks.md:<dòng>: [E4] UC01-BE-01 phụ thuộc UC01-CT-09 không tồn tại`, cuối cùng một dòng tổng
`<n> lỗi, <m> cảnh báo, <k> task`.

### 3.4 Xuất CSV (`--csv`)

- Chỉ ghi khi **không có lỗi E\*** (xuất dữ liệu sai sang Excel dễ gây hiểu nhầm); có lỗi → không ghi, exit 1.
- 11 cột đúng sheet `Tasks` (`output-formats.md` §4): ID · UC · Loại · Tiêu đề · Size · Phụ thuộc · Owner · Trạng thái
  · Skill gợi ý · AC · Link chi tiết. AC = các dòng AC của task nối bằng `\n`; Link = `tasks.md#<id chữ thường>`.
- UTF-8 có BOM, quote mọi ô, `"` nhân đôi, dòng kết thúc `\r\n`.

### 3.5 Cập nhật nội dung skill

- `SKILL.md` bước 5: "Có Node → chạy `check-tasks.mjs`; exit 1 → sửa `tasks.md` rồi chạy lại; không có Node → checklist
  thủ công." Bước 6: CSV qua `--csv`.
- `references/output-formats.md` §4: CSV ưu tiên `check-tasks.mjs --csv`; mẫu Python giữ cho `.xlsx` và cho CSV khi
  không có Node.
- `references/breakdown-checklist.md`: đánh dấu mục nào script kiểm tự động (E1–E9) và mục nào vẫn kiểm bằng đọc
  (`[giả định]` → Câu hỏi mở, quyết định kiến trúc, N/A có lý do).
- Bản đồ tài liệu: thêm `scripts/check-tasks.mjs`.

### 3.6 Nguyên tắc plugin

`plugins/engineering/shared/principles.md`: sửa câu "docs-only — KHÔNG sinh code chạy được" thành: skill là recipe
docs-only; được kèm **script kiểm tra/xuất tất định** khi thoả cả 3: (1) Node built-in, không phụ thuộc ngoài,
(2) chỉ đọc input và ghi file đầu ra được chỉ định, không sửa mã nguồn project, (3) skill vẫn chạy được bằng hướng dẫn
thủ công khi không có runtime. Tiền lệ: `core:git-workflow` ship `scripts/test-commit-message-encoding.ps1`.

### 3.7 Version

`plugins/engineering/.manifest.json` → `1.4.0` (thêm capability script); description nêu script. Assert
`test/validate.mjs` khối 29d đang ghim `1.3.0` → đổi thành `1.4.0`.

---

## 4. Kiểm thử

### 4.1 Phase 1 — khối `30a` trong `test/validate.mjs`

- `use-case-intake.md` có heading `## Nguồn D` + `tasks.md`.
- `frontend-implement/SKILL.md` có `FE-UI` + `tasks.md`; `frontend-data-integration/SKILL.md` có `FE-INT` + `tasks.md`.
- `workflows/feature/WORKFLOW.md`: Bước 2 có `engineering-task-breakdown`, Bước 4 có `tasks.md`; không còn cụm
  "không phân rã story/task chi tiết".
- Agent `engineering-spec-analyst`: `skills` chứa `engineering-task-breakdown`.
- `principles.md` nêu đủ 7 skill.
- Khối 25–28 có sẵn (khung skill, description, WF_ANCHORS, Registry) vẫn xanh.

### 4.2 Phase 2 — khối `30b` trong `test/validate.mjs`

Không thêm file test mới (thêm vào `npm test` phải sửa `package.json`). Khối 30b import script bằng `pathToFileURL`:

- Fixture `tasks.md` hợp lệ tối thiểu (1 UC, task CT + BE + FE-UI + FE-INT, đủ B1–B10/F1–F9) → 0 lỗi, 0 cảnh báo.
- Mỗi mã E1–E9 + W1, W2: một biến thể fixture → đúng mã đó xuất hiện.
- `toCsv`: bắt đầu bằng `﻿`; số bản ghi = 1 header + số task; tiêu đề chứa `"` được nhân đôi `""`; ô AC có `\n`
  nằm trong ngoặc kép.
- CLI: chạy `node check-tasks.mjs <fixture lỗi>` qua `execFileSync` trên file tạm trong `os.tmpdir()` → exit 1, không
  tạo file CSV; fixture hợp lệ + `--csv` → exit 0 và có file; thiếu tham số → exit 2. Dọn file tạm bằng `fs.rmSync`.
- `SKILL.md` link tới `scripts/check-tasks.mjs`; `principles.md` có câu 3 điều kiện.
- Script không import gì ngoài `node:*` (đọc nguồn, regex `from '(?!node:)`).

### 4.3 Lệnh xác nhận

`npm run build` · `npm test` · `npm run overlap` · `npm run pack:verify`; build có `scripts/check-tasks.mjs` ở 4 provider.

---

## 5. Rủi ro & giả định

| Rủi ro | Giảm thiểu |
|---|---|
| Agent tự viết `tasks.md` lệch định dạng → script parse sai | Parse theo tên header/heading, không theo số; lỗi parse báo dòng; fixture bám đúng `output-formats.md` |
| Người dùng không có Node (Cowork) | Skill giữ checklist thủ công làm đường chính khi không có runtime (§3.6 điều kiện 3) |
| `workflow-feature` dài thêm | Tách task là tuỳ chọn; không đổi số bước |
| Đổi nguyên tắc "docs-only" mở đường cho script tràn lan | 3 điều kiện cứng ở §3.6 |
| `[Inference]` adapter ship `scripts/` cho 4 provider | Kiểm ở §4.3 (build có file ở 4 provider) |
