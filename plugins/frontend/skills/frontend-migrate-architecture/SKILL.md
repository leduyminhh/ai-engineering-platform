---
name: frontend-migrate-architecture
description: "Recipe on-demand: tái cấu trúc mã nguồn của một FRONTEND (React) project hiện có sang kiến trúc đích trong bộ chuẩn (Feature-Based, Feature-Sliced Design, hoặc Micro-Frontend), GIỮ NGUYÊN hành vi — với Feature-Based/FSD dời/gom file in-place và sửa import theo tầng/slice, ép ranh giới bằng import-boundary lint; với Micro-Frontend CHỈ nhận diện + lập KẾ HOẠCH phân rã (slice→remote, host shell, packages chia sẻ), KHÔNG auto-move. Nhận diện cấu trúc src hiện trạng, chọn đích, di chuyển theo lô nhỏ XANH-mỗi-bước, con người duyệt diff. Xử lý cả project đã chạy frontend-init lẫn code cũ chưa theo chuẩn. Dùng skill NÀY khi người dùng muốn \"đổi kiến trúc frontend\", \"tái cấu trúc React\", \"chuyển sang Feature-Based/FSD\", \"áp Feature-Sliced Design\", \"tách Micro-Frontend\", \"restructure src frontend\", \"refactor cấu trúc UI\", \"dọn cấu trúc component\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã có mã nguồn React."
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
chuẩn — **Feature-Based** (nhóm theo domain, ranh giới mềm) hoặc **Feature-Sliced Design (FSD)** (layer/slice/
segment + public API, ranh giới cứng); hoặc **Micro-Frontend** như một **target đặc biệt chỉ-lập-kế-hoạch**.
GIỮ NGUYÊN hành vi: chỉ đổi cách phân tầng/slice + ranh giới import, KHÔNG đổi logic nghiệp vụ. Skill này là
**hướng dẫn cách agent tái cấu trúc an toàn** (docs-only recipe), KHÔNG phải công cụ refactor tự động.
KHÔNG nằm trong chuỗi bắt buộc; gọi khi cần.

**Hai lớp đích — ranh giới khác nhau:**
- **Feature-Based / FSD → migrate dời-file IN-PLACE:** tái tổ chức trong cùng một `src/` bằng cách dời/gom
  file + sửa import theo lô nhỏ XANH-mỗi-bước (đầy đủ CỔNG G1–G6 dưới đây).
- **Micro-Frontend → target ĐẶC BIỆT, CHỈ nhận diện + KẾ HOẠCH phân rã có hướng dẫn:** vì đây là **tách app +
  build/deploy độc lập**, không phải dời file trong một `src/`. Skill CHỈ lập bản đồ "domain/slice nào →
  remote nào, host shell giữ gì, `packages/*` chia sẻ gì" rồi bàn giao cho con người; **KHÔNG auto-move
  in-place**. Bước tiền đề khuyến nghị: đưa mỗi remote về **FSD sạch** trong monolith trước, rồi mới tách ra
  app riêng theo kế hoạch.

## Tiền đề
- Project có mã nguồn React thật + VCS sạch có kiểm soát. **Baseline build + test + lint phải XANH TRƯỚC
  khi bắt đầu** (CỔNG G1); baseline đỏ → DỪNG, không migrate trên nền gãy.
- Đọc CLAUDE.md + `project-knowledge/` (nếu có: `architecture.md`, `design-system.md`, `code-convention.md`,
  `tech-stack.yml`) để biết ranh giới an toàn và idiom stack.
- Bộ kiến trúc đích: `architecture/react-feature-based.template.md`, `architecture/react-fsd.template.md` và
  `architecture/react-micro-frontend.template.md`, cùng `architecture/ARD.md` (selector) — ship kèm skill qua
  `sharedAssets`, cùng nguồn với `frontend-init`/`frontend-implement`. **KHÔNG định nghĩa lại cây/luật ở đây —
  trỏ template.**
- **Lưu ý mềm:** project ĐANG là một kiến trúc khác thì đọc `project-knowledge/architecture.md` của project
  để biết hiện trạng đã tuyên bố; skill CHỈ cung cấp bộ đích mới, **KHÔNG ép** đổi — con người chốt đích.

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
lệnh build/test/lint. ĐỌC `architecture/ARD.md` (selector) để đánh giá và chọn đích: **Feature-Based** nếu
app nhỏ/vừa ít domain, một team; **FSD** nếu nhiều domain, cần ranh giới slice cứng; **Micro-Frontend** nếu
đa team cần build/deploy độc lập (target đặc biệt — xem dưới). Trình bày khuyến nghị theo khoảng cách hiện
trạng→đích, rồi DỪNG cho người dùng chốt. Đọc blueprint tương ứng ở
`architecture/react-<feature-based|fsd|micro-frontend>.template.md` — đây là nguồn quyết định "đặt file ở đâu"
+ luật ranh giới.

> **Đích = Micro-Frontend → dừng ở KẾ HOẠCH.** Không đi tiếp CỔNG G1–G6 dời-file. Thay vào đó lập **bản đồ
> phân rã**: mỗi domain/slice hiện tại → remote nào (`apps/<remote>`), host shell (`apps/host`) giữ routing
> gốc + auth + layout khung, và `packages/*` chia sẻ gì (ui-kit, contracts/type, shared-config). Bàn giao kế
> hoạch cho con người; việc tách app + dựng Module Federation + pipeline deploy riêng nằm ngoài phạm vi
> auto-move của skill này. Bên trong mỗi remote → tổ chức theo FSD (dùng nhánh FSD của recipe cho từng app).

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
Thứ tự an toàn mặc định: **lá trước → gốc sau** (Feature-Based: `shared` → `features/<domain>` (ui/hooks/api/
model từng feature) → `pages`; FSD: `shared` → `entities` → `features` → `widgets` → `pages`). Mỗi lô là một
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
- **Feature-Based:** cấu hình `eslint-plugin-boundaries` theo blueprint — `feature` KHÔNG import ruột
  `feature` khác (feature↔feature disallow); liên kết qua `shared` hoặc compose ở `pages`; phụ thuộc chỉ
  trỏ xuống.
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
