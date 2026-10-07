# Template chung — loại task, ID, header

## 1. Loại task

| Loại | Khi nào sinh | Skill / agent gợi ý |
|---|---|---|
| `CT` | Use case có API mới hoặc đổi API | `backend-api-contract` |
| `DB` | Đổi bảng / cột / index | `data-db-migration` (luồng `workflow-db-change`) |
| `BE` | Mỗi command/query | `backend-implement` → agent `backend-implementer` |
| `FE-UI` | Mỗi màn hình / component | `frontend-implement` → agent `frontend-implementer` |
| `FE-INT` | Nối UI với API | `frontend-data-integration` |
| `E2E` | AC là luồng UI đầu-cuối, không chứng minh được ở unit/integration | `frontend-e2e-testing` |

Chỉ sinh loại cần: use case không có API (UI tĩnh, tính toán phía client) → không sinh `CT`, `BE`, `FE-INT`; use
case chỉ có backend (job, API nội bộ) → không sinh `FE-UI`, `FE-INT`, `E2E`.

Unit/integration test nằm trong DoD của task `BE` / `FE-UI` / `FE-INT`, không tách task test riêng.

## 2. Quy ước ID

`UC<nn>-<loại>-<nn>`:

- `UC01-CT-01`, `UC01-DB-01`, `UC01-BE-01`, `UC01-BE-02`, `UC01-FE-01` (FE-UI), `UC01-FE-02` (FE-INT), `UC01-E2E-01`.
- `FE-UI` và `FE-INT` dùng chung tiền tố `FE`, đánh số liên tục trong use case; trường Loại phân biệt hai loại.
- `UC00-…` cho nền tảng dùng chung, chỉ khi ≥ 2 use case cần.
- Anchor của task trong `tasks.md` là ID viết chữ thường (`uc01-be-01`), đặt bằng `<a id="uc01-be-01"></a>` ngay
  trên heading để link ổn định trên mọi renderer markdown.

## 3. Header chung (mọi task)

````markdown
<a id="uc01-be-01"></a>
### UC01-BE-01 — <tiêu đề ngắn, bắt đầu bằng động từ>

| Trường | Giá trị |
|---|---|
| Use case | UC01 — <tên> |
| Loại | BE |
| Size | S |
| Phụ thuộc | UC01-CT-01, UC01-DB-01 |
| Owner |  |
| Trạng thái | Todo |
| Skill gợi ý | backend-implement |
| Nguồn | requirement.md §3.1 |

**Ngữ cảnh:** <2–3 dòng: vì sao có task này, nằm ở đâu trong luồng use case>

**Acceptance criteria:**
- [ ] AC1.1 — <tiêu chí đo được, trích hoặc thu hẹp từ AC của use case>

**File dự kiến:** <đường dẫn theo architecture.md / source-structure.md, hoặc [giả định]>

**Lệnh verify:** <lệnh build/test thật của project, hoặc [giả định]>

**DoD:**
- [ ] Đạt mọi AC ở trên
- [ ] Test bắt buộc của loại task đã viết và xanh
- [ ] Build/lint xanh
- [ ] Con người duyệt diff

<mục riêng theo loại: B1–B10 cho BE, F1–F9 cho FE-UI/FE-INT, hoặc mục CT/DB/E2E ở §4>
````

Owner luôn để trống — teamlead điền. Trạng thái khởi tạo `Todo`.

## 4. Template theo loại

Mục riêng đặt dưới heading `#### Contract` / `#### Schema` / `#### E2E` (tương ứng `#### Backend` / `#### Frontend`).

### CT — Contract

- **Endpoint cần chốt:** method + path + `operationId`.
- **Request/response schema:** field, kiểu, bắt buộc/tuỳ chọn.
- **Mã lỗi:** case → mã lỗi → HTTP status.
- **Versioning / tương thích ngược:** thay đổi có breaking không; nếu có, lộ trình deprecate.
- **Test bắt buộc:** contract hợp lệ OpenAPI 3.1; kiểm drift theo `backend-api-contract`.

### DB — Schema

- **Thay đổi:** bảng / cột / index / constraint.
- **Backfill dữ liệu:** có / không; khối lượng ước tính.
- **Rollback:** cách quay lui; thay đổi nào không đảo ngược được.
- **Luồng:** chạy qua `workflow-db-change` (skill `data-db-migration`).
- **Test bắt buộc:** migration chạy lên trên DB cục bộ; chạy xuống nếu đảo ngược được, không thì `N/A — <lý do>` + cách khôi phục (backup / forward-fix).

### E2E — Luồng đầu-cuối

- **Luồng:** các bước người dùng từ đầu tới cuối.
- **AC phủ:** danh sách `AC<uc>.<n>`.
- **Dữ liệu seed:** dữ liệu cần có trước khi chạy.
- **Lý do cần e2e:** vì sao không chứng minh được ở unit/integration.
- **Test bắt buộc:** chạy ổn định khi lặp lại (theo `frontend-e2e-testing`).

## 5. Quy tắc điền

- Mục không áp dụng → ghi `N/A — <lý do>` (vd `N/A — query chỉ đọc, không có transaction ghi`). KHÔNG bỏ trống:
  mục trống bị hiểu là quên.
- Thiếu thông tin → ghi **[giả định] <giá trị>** tại chỗ và thêm vào Câu hỏi mở; KHÔNG bịa.
- Nhiều **[giả định]** cùng chủ đề được gộp vào một Câu hỏi mở; ghi `(Qn)` cạnh [giả định] để truy vết.
- Mỗi task phải đọc được độc lập: không viết "như task trên"; lặp lại thông tin cần thiết.
