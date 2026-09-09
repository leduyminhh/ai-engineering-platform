---
name: frontend-migrate-architecture
description: "Recipe on-demand: tái cấu trúc mã nguồn của một FRONTEND (React) project hiện có sang kiến trúc đích trong bộ chuẩn (Layered hoặc Feature-Sliced Design), GIỮ NGUYÊN hành vi — chỉ dời/gom file và sửa import theo tầng/slice, ép ranh giới bằng import-boundary lint, con người duyệt diff. Nhận diện cấu trúc src hiện trạng, chọn đích, di chuyển theo lô nhỏ XANH-mỗi-bước. Xử lý cả project đã chạy frontend-init lẫn code cũ chưa theo chuẩn. Dùng skill NÀY khi người dùng muốn \"đổi kiến trúc frontend\", \"tái cấu trúc React\", \"chuyển sang FSD\", \"áp Feature-Sliced Design\", \"restructure src frontend\", \"refactor cấu trúc UI\", \"dọn cấu trúc component\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã có mã nguồn React."
order: 6
stageNumber: "06"
title: "Frontend Migrate — Kiến trúc mã nguồn UI (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
sharedAssets: templates/architecture
next: null
---

# Frontend Migrate — Kiến trúc mã nguồn UI (recipe on-demand)

Recipe tái tổ chức cây `src/` của một FRONTEND (React) project ĐÃ TỒN TẠI sang một kiến trúc đích trong bộ
chuẩn — **Layered** (Presentational/Container + Hooks + Data) hoặc **Feature-Sliced Design (FSD)**. GIỮ
NGUYÊN hành vi: chỉ đổi cách phân tầng/slice + ranh giới import, KHÔNG đổi logic nghiệp vụ. Skill này là
**hướng dẫn cách agent tái cấu trúc an toàn** (docs-only recipe), KHÔNG phải công cụ refactor tự động.
KHÔNG nằm trong chuỗi bắt buộc; gọi khi cần.

## Tiền đề
- Project có mã nguồn React thật + VCS sạch có kiểm soát. **Baseline build + test + lint phải XANH TRƯỚC
  khi bắt đầu** (CỔNG G1); baseline đỏ → DỪNG, không migrate trên nền gãy.
- Đọc CLAUDE.md + `project-knowledge/` (nếu có: `architecture.md`, `design-system.md`, `code-convention.md`,
  `tech-stack.yml`) để biết ranh giới an toàn và idiom stack.
- Bộ kiến trúc đích: `architecture/react-layered.template.md` và `architecture/react-fsd.template.md` (ship
  kèm skill qua `sharedAssets`, cùng nguồn với `frontend-init`/`frontend-implement`). **KHÔNG định nghĩa lại
  cây/luật ở đây — trỏ template.**

## Ranh giới an toàn (CLAUDE.md)
Không push thẳng main. Mỗi bước = 1 commit logic, DỪNG cho người duyệt diff trước khi commit. **KHÔNG đổi
hành vi nghiệp vụ khi diff không thể hiện — đổi hành vi là bước TÁCH RIÊNG sau migrate.** Không đụng
secret/config/CI infra ngoài cấu hình lint boundary. Cho phép code cũ/mới cùng tồn tại TẠM (barrel re-export)
trong lúc migrate để giữ mỗi bước XANH. Defer `design-system.md` + `code-convention.md` của project tuyệt đối.

**Ngôn ngữ (bắt buộc):** MỌI đầu ra hướng người dùng — bảng ánh xạ file→tầng/slice, ADR, báo cáo từng bước,
commit message, comment trong file sinh ra — viết **tiếng Việt CÓ DẤU** (UTF-8).

## Hai nhánh đầu vào
- **Nhánh A — đã init:** đọc `project-knowledge/architecture.md` + ADR ở `docs/decisions/` để biết kiến
  trúc TUYÊN BỐ; đối chiếu code thật ở bước 2, báo nếu tài liệu lệch thực tế.
- **Nhánh B — chưa init (code cũ):** không có tài liệu nền. Nhận diện hiện trạng từ code (bước 2) và
  BOOTSTRAP TỐI THIỂU: tạo `project-knowledge/architecture.md` + `source-structure.md` và thư mục
  `docs/decisions/` để ghi ADR. KHÔNG chạy full `frontend-init` (tránh đè cấu trúc); chỉ dựng đủ để migrate
  có nguồn sự thật.

## Quy trình (trung tính stack)

### 0. Nạp context + chọn kiến trúc đích — DỪNG cho người chọn
Đọc `project-knowledge/` (nếu có) và dò **cấu trúc React thật**: cây `src/`, router, cách quản state, data
layer (fetch/axios/React Query), component-lib (shadcn/MUI/antd), Tailwind, TypeScript, alias import (`@/…`),
lệnh build/test/lint. Chọn đích: **Layered** nếu app nhỏ/ít domain; **FSD** nếu nhiều domain/nhiều team, cần
ranh giới slice cứng. Trình bày khuyến nghị theo khoảng cách hiện trạng→đích, rồi DỪNG cho người dùng chốt.
Đọc blueprint tương ứng ở `architecture/react-<layered|fsd>.template.md` — đây là nguồn quyết định "đặt file
ở đâu" + luật ranh giới.

### 1. Baseline XANH — CỔNG G1
Chạy build + test + lint hiện trạng (vd `tsc`, `npm run build`, `npm test`/`vitest run`, `eslint`). **Phải
XANH mới đi tiếp** — đây là mốc so sánh hồi quy. Ghi lại lệnh + kết quả THẬT. Baseline đỏ → DỪNG, báo, đề
xuất sửa trước khi migrate. Chưa có test → lưới an toàn được dựng ở CỔNG G2 trước khi động code.

### 2. Nhận diện hiện trạng + BẢNG ÁNH XẠ file→tầng/slice
Dò từ CODE THẬT: cấu trúc đang tổ chức theo **feature**, theo **type** (`components/`, `hooks/`, `utils/`
phẳng), hay **phẳng** hoàn toàn; các vi phạm ranh giới (component gọi thẳng `fetch`, import chéo domain).
Lập bảng: mỗi file/thư mục hiện tại → tầng/slice đích của blueprint, đánh dấu **(a) chỉ DỜI**, **(b) TÁCH
public API / gom slice**, **(c) VI PHẠM ranh giới** cần sửa. Xử lý alias import khi dời. Quy tắc nhận diện
+ ánh xạ: [references/detection-heuristic.md](references/detection-heuristic.md). IN BẢNG cho người dùng rà
soát TRƯỚC khi động code.

### 3. Dựng lưới an toàn characterization — CỔNG G2
Đo độ phủ test quanh các màn hình/luồng sẽ đụng ở bước 2.
- Vùng ĐỦ test → dùng làm cổng hồi quy.
- Vùng RỦI RO mà THIẾU test → **sinh characterization test khóa hành vi hiện tại TRƯỚC khi động code**
  (render màn hình chính + tương tác nhìn thấy + snapshot). Xác nhận XANH trên code CŨ.
Cách viết characterization test cho React: [references/migration-workflow.md](references/migration-workflow.md).
Test ở lại repo làm tài sản.

### 4. Di chuyển theo lô nhỏ, XANH mỗi bước — CỔNG G3 (vòng lặp chính)
Chiến lược: **incremental, XANH sau mỗi bước, dời trước — đổi hành vi sau (nếu cần) là bước tách riêng.**
Thứ tự an toàn mặc định: **lá trước → gốc sau** (Layered: `components` presentational → `hooks`/`services` →
`containers` → `pages`; FSD: `shared` → `entities` → `features` → `widgets` → `pages`). Mỗi lô là một
slice/nhóm component; MỖI lô:
1. Tóm tắt ngắn + file dự kiến đụng tới.
2. Dời/gom + cập nhật import/alias; nơi cần: thêm public API `index.ts` (FSD) và cho barrel re-export cũ/mới
   cùng tồn tại TẠM để giữ XANH. KHÔNG đổi logic/JSX/hành vi.
3. **CỔNG G3:** `tsc` ✓ + test suite (gồm characterization) ✓ + build ✓. Đỏ → sửa hoặc revert lô đó, KHÔNG
   đi tiếp.
4. DỪNG cho người duyệt diff → commit (header ≤72, body tiếng Việt có dấu, nói đúng MỘT việc của lô).

### 5. Ép ranh giới kiến trúc — CỔNG G4 (đặc thù migrate)
Sau khi dời xong, bật CÔNG CỤ kiểm ranh giới import để chứng minh kiến trúc đích THỰC SỰ thành hình (không
chỉ "đúng thư mục"):
- **Layered:** cấu hình `eslint-plugin-boundaries` theo blueprint — presentational không import
  `services`/`store`/`hooks`; phụ thuộc chỉ trỏ xuống.
- **FSD:** chạy `steiger ./src` (linter FSD) + `eslint-plugin-boundaries` — chỉ import xuống, không
  cross-import cùng layer, chỉ qua public API `index.ts`.
Giới thiệu dần (cảnh báo → lỗi) để không vỡ CI giữa chừng; TRỎ cấu hình gốc trong blueprint thay vì lặp lại.
Chi tiết: [references/boundary-tooling.md](references/boundary-tooling.md). Còn vi phạm → kiến trúc CHƯA
thành hình, quay lại bước 4 sửa. Cấu hình này ở lại repo làm gate thường trực.

### 6. Hồi quy toàn bộ + cập nhật nguồn sự thật — CỔNG G5
- Chạy FULL `tsc` + lint (gồm boundary) + build + test lại, SO với baseline bước 1 (số pass/fail, lệnh
  THẬT) và với characterization bước 3. Có fail → DỪNG, phân tích, sửa; KHÔNG tuyên bố hoàn tất khi chưa xanh.
- Dọn code cũ/barrel còn sót của giai đoạn "cùng tồn tại".
- Cập nhật `project-knowledge/architecture.md` + `source-structure.md` phản ánh cấu trúc mới; ghi ADR chốt
  kiến trúc đích + lý do (nhánh B: tạo mới).

## Bảng gate production-ready
| # | Gate | Bước | Đỏ thì |
|---|------|------|--------|
| G1 | Baseline build + test + lint XANH trước khi bắt đầu | 1 | DỪNG, không migrate trên nền gãy |
| G2 | Characterization test khóa hành vi vùng rủi ro thiếu test | 3 | Chưa dám dời sâu vùng đó |
| G3 | tsc + test + build XANH sau MỖI lô | 4 | Sửa/revert lô, không đi tiếp |
| G4 | Ép ranh giới (eslint-plugin-boundaries / Steiger) | 5 | Kiến trúc chưa thành hình → chưa xong |
| G5 | Hồi quy toàn bộ so baseline + characterization | 6 | Không tuyên bố hoàn tất |
| G6 | 1 bước = 1 commit, DỪNG duyệt diff, không push main | Xuyên suốt | — |

## Sau khi xong
Tóm tắt file đã đổi + bảng ánh xạ; xác nhận full suite XANH (G5) và gate ranh giới XANH (G4) trước khi bàn
giao. Nêu rõ phần **ước lượng** / rủi ro còn lại (vd vùng thiếu test, hành vi cần đổi ở bước sau). Người dùng
tự push nhánh migrate + mở PR. Nếu phát hiện ràng buộc mâu thuẫn (vd stack không phải React, hoặc không có
công cụ ép ranh giới tương ứng), DỪNG và BÁO thay vì tự đi chệch.
