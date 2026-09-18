---
name: backend-migrate-architecture
description: "Recipe on-demand: migrate KIẾN TRÚC mã nguồn của một BACKEND project hiện có sang một kiểu kiến trúc đích trong bộ chuẩn (Onion+DDD, Hexagonal+DDD, Hexagonal/Clean+CQRS, layered đơn giản). Nhận diện kiến trúc hiện trạng, chọn đích, tái tổ chức src/ theo template, đảo phụ thuộc đúng tầng, giữ nguyên hành vi nghiệp vụ. Xử lý cả project đã chạy backend-init lẫn project cũ chưa theo chuẩn. Dùng skill NÀY khi người dùng muốn \"đổi kiến trúc\", \"chuyển sang Onion/Hexagonal/CQRS\", \"tái cấu trúc phân tầng\", \"áp clean architecture\", \"refactor kiến trúc\", \"restructure src\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã có mã nguồn."
order: 7
stageNumber: "07"
title: "Backend Migrate — Kiến trúc mã nguồn (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
sharedAssets: templates/architecture
next: null
---

# Backend Migrate — Kiến trúc mã nguồn (recipe on-demand)

Recipe tái tổ chức mã nguồn của một BACKEND project ĐÃ TỒN TẠI sang một kiểu kiến trúc
đích trong bộ chuẩn — GIỮ NGUYÊN hành vi nghiệp vụ, chỉ đổi cách phân tầng/ranh giới phụ
thuộc. KHÔNG phụ thuộc skill nào khác; gọi độc lập trên project đã có mã nguồn (đã hoặc
chưa chạy `backend-init`). KHÔNG tách microservice, KHÔNG đổi logic nghiệp vụ.

## Tiền đề
- Project có mã nguồn thật + VCS sạch có kiểm soát. **Baseline build + full test phải XANH
  TRƯỚC khi bắt đầu** (bước 1); baseline đỏ → DỪNG, không migrate trên nền gãy.
- Đọc CLAUDE.md + `project-knowledge/` (đặc biệt `stack-profile.md`, `architecture.md`,
  `source-structure.md`) để biết ranh giới an toàn và idiom stack.
- Bộ kiểu kiến trúc đích: xem `architecture/ARD.md` + `architecture/<stack>-<kiểu>.template.md`
  (ship kèm skill qua sharedAssets). KHÔNG định nghĩa lại kiểu ở đây.

## Ranh giới an toàn (CLAUDE.md)
Không push thẳng main. Mỗi task = 1 commit, DỪNG cho người duyệt diff trước khi commit.
KHÔNG đổi hành vi nghiệp vụ khi diff không thể hiện. Không chạy lệnh phá huỷ dữ liệu khi
chưa duyệt. Cho phép code cũ/mới cùng tồn tại TẠM trong lúc migrate để giữ mỗi bước XANH.

**Ngôn ngữ (bắt buộc):** MỌI đầu ra hướng người dùng — bảng ánh xạ file→tầng, ADR, báo cáo
từng bước, commit message, comment trong file sinh ra — viết **tiếng Việt CÓ DẤU** (UTF-8).

## Hai nhánh đầu vào
- **Nhánh A — đã init:** đọc `docs/decisions/0004-architecture.md` (ADR-0004) +
  `project-knowledge/architecture.md` để biết kiến trúc TUYÊN BỐ; đối chiếu với code thật ở
  bước 2, báo nếu tài liệu lệch thực tế.
- **Nhánh B — chưa init (code cũ):** không có ADR/tài liệu nền. Nhận diện hiện trạng từ code
  (bước 2) và BOOTSTRAP TỐI THIỂU: tạo `project-knowledge/architecture.md`,
  `project-knowledge/source-structure.md` và thư mục `docs/decisions/` để ghi ADR. KHÔNG chạy
  full `backend-init` (tránh đè cấu trúc); chỉ dựng đủ để migrate có nguồn sự thật.

## Quy trình (trung tính stack)

### 1. Nạp context + xác lập baseline — CỔNG G1
Đọc CLAUDE.md, `project-knowledge/`, `stack-profile.md`. Chạy build + FULL test hiện trạng
(vd Maven `mvn verify`, Gradle `./gradlew build`, Python `pytest` + lint). **Phải XANH mới đi
tiếp** — đây là mốc so sánh hồi quy. Ghi lại lệnh + kết quả THẬT. Baseline đỏ → DỪNG, báo, đề
xuất sửa trước khi migrate.

### 2. Nhận diện kiến trúc hiện trạng
Dò từ CODE THẬT, không chỉ tin tài liệu: cây thư mục/package, chiều phụ thuộc giữa
module/package, có interface repository (port) hay gọi thẳng ORM/framework, domain có
import hạ tầng/web/framework không, có tách command/query chưa. Kết luận: hiện trạng GẦN kiểu
nào trong 4 chuẩn (heuristic chi tiết: `references/migration-heuristic.md`). Nhánh A: đối
chiếu ADR-0004; nếu tài liệu lệch code, BÁO trước khi tiếp.

### 3. Chọn kiến trúc đích — DỪNG cho người chọn
Trình bày 4 kiểu (mô tả + "tín hiệu nâng cấp" theo `architecture/ARD.md`): Onion+DDD (mặc
định), Hexagonal+DDD, Hexagonal/Clean+CQRS, layered đơn giản. Khuyến nghị theo khoảng cách
hiện trạng→đích và động lực thực tế, rồi DỪNG cho người dùng chốt. KHÔNG tự quyết.

### 4. Phân tích khoảng cách + BẢNG ÁNH XẠ file→tầng
Lập bảng: mỗi file/class/package hiện tại → tầng đích của template (`architecture/<stack>-<kiểu>.template.md`).
Đánh dấu mỗi mục: **(a) chỉ DỜI** (đổi vị trí + import), **(b) TÁCH interface/đảo phụ thuộc**
(vd đưa repository interface vào domain, impl xuống infrastructure), **(c) VI PHẠM chiều phụ
thuộc** cần sửa (domain đang import hạ tầng...). Liệt kê các "điểm vào" (API endpoint/service
công khai) làm mốc khóa hành vi ở bước 5. Quy tắc ánh xạ: `references/migration-heuristic.md`.
IN BẢNG cho người dùng rà soát TRƯỚC khi động code.

### 5. Dựng lưới an toàn — CỔNG G2 (theo mức độ có test)
Đo độ phủ test quanh các "điểm vào" ở bước 4.
- Vùng ĐỦ test → dùng làm cổng hồi quy.
- Vùng RỦI RO (sẽ tách interface/đảo phụ thuộc/tách CQRS) mà THIẾU test → **sinh
  characterization test khóa hành vi hiện tại TRƯỚC khi động code** (test gọi qua điểm vào,
  chốt output/side-effect quan sát được). Xác nhận các test mới XANH trên code CŨ.
- Không có điểm vào rõ (không API/service) → BÁO rủi ro, đề xuất thu hẹp phạm vi migrate.
Characterization test ở lại repo làm tài sản.

### 6. Nhánh migration + ADR
`git checkout -b refactor/architecture-<kiểu-đích>` (theo CONTRIBUTING.md). Ghi ADR mới trong
`docs/decisions/` (supersede ADR-0004 nếu có) chốt: kiểu đích, LÝ DO, phạm vi, chiến lược
incremental. Nhánh B: đây cũng là nơi tạo tài liệu nền tối thiểu (xem "Hai nhánh đầu vào").
Mọi commit của migration nằm trên nhánh này; không push thẳng main.

### 7. Thực thi theo TẦNG, step-by-step — CỔNG G3 (vòng lặp chính)
Chiến lược: **incremental, XANH sau mỗi bước.** Thứ tự an toàn mặc định: **lõi trước → ngoài
sau** (domain → application → infrastructure → bootstrap/adapter); với một số hướng migrate,
tách interface repository ở ranh giới trước lại thuận hơn — chọn thứ tự giảm được nhiều vi
phạm phụ thuộc nhất và nêu lý do. Mỗi tầng là một/vài task; MỖI task:
1. Tóm tắt ngắn + file dự kiến đụng tới.
2. Dời/tái tổ chức + sửa import/namespace/DI wiring; nơi cần: tách interface & đảo phụ thuộc
   (cho code cũ/mới cùng tồn tại TẠM để giữ XANH). KHÔNG đổi logic nghiệp vụ.
3. **CỔNG G3:** build ✓ + test suite (gồm characterization) ✓ + app boot ✓. Đỏ → sửa hoặc
   revert task đó, KHÔNG đi tiếp.
4. DỪNG cho người duyệt diff → commit (header ≤72, body tiếng Việt có dấu, nói đúng MỘT việc
   của task).

### 8. Kiểm chứng ranh giới kiến trúc — CỔNG G4 (đặc thù migrate)
Sau khi dời xong, chạy CÔNG CỤ kiểm chiều phụ thuộc theo stack để chứng minh kiến trúc đích
THỰC SỰ thành hình (không chỉ "đúng thư mục"):
- **Java/Spring:** thêm test ArchUnit theo `references/java-spring/` (chọn file theo kiểu
  đích), chạy trong test suite — domain không phụ thuộc infrastructure/application, adapter
  chỉ phụ thuộc port...
- **Python:** thêm contract import-linter theo `references/python/` (chọn theo kiểu đích),
  chạy `lint-imports`.
Đỏ (còn vi phạm) → kiến trúc CHƯA thành hình, quay lại bước 7 sửa. Test/contract này ở lại
repo làm gate thường trực.

### 9. Hồi quy toàn bộ + cập nhật nguồn sự thật — CỔNG G5
- Chạy FULL suite + lint + build lại, SO với baseline bước 1 (số pass/fail, lệnh THẬT). Có
  test fail → DỪNG, phân tích, sửa; KHÔNG tuyên bố hoàn tất khi suite chưa xanh.
- CI không đủ hạ tầng để boot → chạy phần chạy được + BÁO scope skip; không im lặng coi như
  đã phủ.
- Cập nhật `project-knowledge/architecture.md` + `source-structure.md` phản ánh kiến trúc
  mới; dọn code cũ còn sót của giai đoạn "cùng tồn tại".

## Bảng gate production-ready
| # | Gate | Bước | Đỏ thì |
|---|------|------|--------|
| G1 | Baseline build + test XANH trước khi bắt đầu | 1 | DỪNG, không migrate trên nền gãy |
| G2 | Characterization test khóa hành vi vùng rủi ro thiếu test | 5 | Chưa dám refactor sâu vùng đó |
| G3 | Build + test + boot XANH sau MỖI task | 7 | Sửa/revert task, không đi tiếp |
| G4 | Kiểm chiều phụ thuộc (ArchUnit / import-linter) | 8 | Kiến trúc chưa thành hình → chưa xong |
| G5 | Hồi quy toàn bộ so baseline + lint + build | 9 | Không tuyên bố hoàn tất |
| G6 | 1 task = 1 commit, DỪNG duyệt diff, không push main | Xuyên suốt | — |

## Sau khi xong
Tóm tắt file đã đổi + bảng ánh xạ; xác nhận full test suite XANH (G5) và gate ranh giới XANH
(G4) trước khi bàn giao. Người dùng tự push nhánh `refactor/architecture-<kiểu-đích>` + mở PR.
Nếu phát hiện ràng buộc mâu thuẫn (vd stack không có công cụ kiểm ranh giới tương ứng, hoặc
stack ngoài Java/Python chưa có template), DỪNG và BÁO thay vì tự đi chệch.
