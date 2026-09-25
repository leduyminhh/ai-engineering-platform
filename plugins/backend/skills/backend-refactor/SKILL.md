---
name: backend-refactor
description: "Recipe on-demand: REFACTOR mã nguồn BACKEND (Java/Spring, Python) mà GIỮ NGUYÊN hành vi nghiệp vụ — extract method/class, gom trùng lặp về shared/util đúng tầng, thay điều kiện phức tạp bằng guard clause/polymorphism, tách god class, introduce parameter object, đảo phụ thuộc qua port. TÔN TRỌNG boundary/Dependency Rule của kiến trúc đã chốt; áp design pattern CHỈ khi gỡ được phức tạp thật (tránh lạm dụng, HỎI trước khi áp pattern lớn). Đi qua cổng behavior-preserving: baseline build/test/lint XANH → thiếu test vùng đụng thì viết characterization test trước → bước nhỏ, XANH sau mỗi bước → verify + con người duyệt diff. KHÁC với đổi KIỂU kiến trúc (Onion/Hexagonal/CQRS) — việc đó dùng backend-migrate-architecture. Dùng skill NÀY khi người dùng muốn \"refactor backend\", \"tái cấu trúc code backend\", \"dọn code Java/Python\", \"giảm trùng lặp\", \"tách hàm/tách class\", \"đơn giản hoá code\", \"gỡ god class\", \"áp design pattern backend\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã có mã nguồn."
order: 5
stageNumber: "05"
title: "Backend Refactor — Tái cấu trúc code backend giữ nguyên hành vi (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
sharedAssets: templates/architecture
next: null
---

# Backend Refactor — Tái cấu trúc code backend giữ nguyên hành vi (recipe on-demand)

Recipe hướng dẫn agent **refactor mã nguồn BACKEND** (Java/Spring, Python) — cải thiện cấu trúc bên
trong (đọc-hiểu, tái dùng, giảm trùng lặp, giảm phức tạp) **mà KHÔNG đổi hành vi nghiệp vụ quan sát
được**. Đây là **docs-only recipe** — hướng dẫn cách agent làm việc, KHÔNG phải công cụ codegen hay
lint dựng sẵn. KHÔNG phụ thuộc skill nào khác; gọi độc lập trên project đã có mã nguồn (đã hoặc
chưa chạy `backend-init`/`backend-implement`).

Định nghĩa refactor ở skill này: các move quen thuộc — extract method/class, gom trùng lặp về
shared/util **đúng tầng**, thay điều kiện phức tạp bằng guard clause/polymorphism, tách god class,
introduce parameter object, đảo phụ thuộc qua port — mỗi move **giữ nguyên hành vi**. Áp design
pattern chỉ khi gỡ được **phức tạp thật**, không phải để "cho đẹp".

**KHÁC biệt quan trọng — ranh giới với `backend-migrate-architecture`:** skill này KHÔNG đổi *kiểu*
kiến trúc (Onion ↔ Hexagonal ↔ CQRS ↔ layered). Đổi kiểu kiến trúc là việc của
`backend-migrate-architecture`. Ở đây mọi move phải **tôn trọng kiểu kiến trúc đã chốt** và
Dependency Rule của nó — refactor *trong* ranh giới, không dời ranh giới.

## Ranh giới an toàn (CLAUDE.md)
- **Giữ hành vi (bất biến cốt lõi).** Refactor KHÔNG đổi nghiệp vụ: cùng input → cùng output +
  side-effect quan sát được. Cần đổi hành vi (sửa bug, đổi quy tắc) → đó là bước RIÊNG, tách khỏi
  refactor, gọi `backend-implement`; KHÔNG trộn "dọn code" với "đổi logic" trong một bước.
- **Baseline phải XANH.** Không refactor trên nền gãy: build/test/lint hiện trạng đỏ → DỪNG, báo,
  đề xuất sửa/ổn định trước. Vùng đụng thiếu test → viết characterization test khoá hành vi TRƯỚC.
- **Tôn trọng boundary.** Bám kiến trúc đã chốt (`project-knowledge/architecture.md` + blueprint
  `architecture/<stack>-<kiểu>.template.md`) và Dependency Rule ([architecture/ARD.md](architecture/ARD.md)
  mục 1, 7). KHÔNG đổi kiểu kiến trúc — đó là `backend-migrate-architecture`.
- **Bám code-convention, không áp gu lạ.** Đặt tên/tổ chức theo `code-convention` của project;
  convention của project thắng sở thích cá nhân.
- **Không tự mở rộng phạm vi.** Chỉ refactor đúng vùng người dùng nêu; thấy vùng khác cần dọn →
  đề xuất, không tự lan.
- **Không push thẳng main.** Mỗi bước refactor = 1 commit; DỪNG cho người **duyệt diff** trước commit.
- **Ngôn ngữ (bắt buộc):** mọi đầu ra hướng người dùng — bảng move, đề xuất pattern, báo cáo, commit
  message — viết **tiếng Việt CÓ DẤU** (UTF-8).
- **Ngôn ngữ đo được:** báo cáo bằng thứ đếm được (số move, `file:line`, kết quả build/test THẬT).
  KHÔNG dùng "đảm bảo / loại bỏ / chặn triệt để / không còn nợ kỹ thuật". LUÔN nêu **residual risk**;
  characterization test chỉ khoá hành vi *quan sát được qua điểm vào*, có thể sót đường đi chưa nghĩ
  tới. Dùng `[giả định]` khi suy đoán ý định code cũ mà không xác minh được.

## Quy trình (trung tính stack) — cổng behavior-preserving

### 0. Nạp context — BẮT BUỘC trước khi động code
- **Chốt scope refactor:** file/class/module/thư mục nào? Đọc code THẬT trong scope, không đoán.
- Đọc `project-knowledge/` (`architecture.md` = **kiến trúc đã chốt**, `source-structure.md`,
  `code-convention.md`, `stack-profile`/`tech-stack`) + blueprint `architecture/<stack>-<kiểu>.template.md`
  + [architecture/ARD.md](architecture/ARD.md) để biết kiểu kiến trúc, ranh giới tầng, quy ước đặt tên.
- **Dò stack + lệnh THẬT** từ project (`pom.xml`/`build.gradle`/`pyproject.toml`/`requirements.txt`):
  Java/Spring hay Python; lệnh build/test/lint (vd `mvn verify`, `./gradlew build`, `pytest`, `ruff`);
  có ArchUnit/import-linter không.
- Thiếu scope rõ hoặc thiếu `project-knowledge` → BÁO (fail-loud), hỏi người dùng, KHÔNG tự bịa.

### 1. Baseline XANH — CỔNG G1
Chạy build + test + lint hiện trạng, ghi lệnh + kết quả THẬT — đây là mốc so hồi quy.
- Baseline **đỏ** → DỪNG; không refactor trên nền gãy (báo + đề xuất ổn định trước).
- Vùng sẽ đụng **thiếu test** → sinh **characterization test khoá hành vi hiện tại TRƯỚC khi động
  code** (gọi qua điểm vào công khai, chốt output/side-effect quan sát được); xác nhận test mới XANH
  **trên code CŨ**. Trỏ `backend-testing` để viết test. Chi tiết cổng: [references/refactor-workflow.md](references/refactor-workflow.md).

### 2. Nhận diện target refactor
Đọc soát vùng trong scope, liệt kê các "code smell" theo danh mục và chọn move tương ứng — dấu hiệu,
rủi ro, cách giữ hành vi ở [references/refactor-catalog.md](references/refactor-catalog.md): trùng lặp
(gom về shared/util **đúng tầng**), method/class quá dài (extract method/class), điều kiện phức tạp
(guard clause / thay if-else theo type bằng polymorphism), god class (tách theo trách nhiệm),
tham số dài (introduce parameter object), magic value (đặt hằng/VO), feature envy (dời method về nơi
giữ dữ liệu)… Ưu tiên move gỡ được nhiều phức tạp/trùng lặp nhất với ít rủi ro nhất.

### 3. Áp từng bước nhỏ — GIỮ hành vi, XANH sau mỗi bước — CỔNG G2
- Mỗi bước là **một** loại thay đổi, phạm vi nhỏ, dễ đọc diff.
- **Dời/đổi tên/tách trước; đổi hành vi là bước TÁCH RIÊNG.** Trong một bước refactor KHÔNG vừa dời
  vừa sửa logic — nếu phát hiện bug lúc dọn, GHI LẠI và xử ở bước riêng (route `backend-implement`).
- Sau **mỗi** bước: build ✓ + test (gồm characterization) ✓ + lint ✓. Đỏ → sửa hoặc revert **bước
  đó**, KHÔNG đi tiếp. 1 bước = 1 commit; DỪNG cho người duyệt diff.

### 4. Design pattern khi cần — HỎI trước khi áp pattern lớn — CỔNG G3
- Chỉ cân nhắc pattern khi có **áp lực thiết kế cụ thể** (behavior variation, tạo object phức tạp,
  ranh giới không tương thích, workflow nhiều bước) mà move đơn giản (rename/extract) KHÔNG gỡ được.
- Đối chiếu [references/design-patterns.md](references/design-patterns.md): khi nào áp / khi nào
  KHÔNG, và chống lạm dụng. **HỎI người dùng duyệt TRƯỚC khi áp bất kỳ pattern lớn nào** (thêm nhiều
  class/interface, đổi cách cộng tác). Không có áp lực rõ → chọn refactor đơn giản hơn và DỪNG.
- Sau khi áp: báo cáo pattern đã dùng + LÝ DO + move nào đơn giản đã bị bác — vẫn qua cổng bước 3.

### 5. Verify + con người duyệt — CỔNG G4
- Chạy lại FULL build + test + lint, SO với baseline bước 1 (số pass/fail, lệnh THẬT). Có fail →
  DỪNG, phân tích, sửa; KHÔNG tuyên bố hoàn tất khi suite chưa xanh.
- Có ArchUnit/import-linter → chạy để chứng minh boundary vẫn nguyên (refactor không rò tầng).
- So sánh với characterization test: hành vi quan sát được KHÔNG đổi.
- Con người **duyệt diff** trước khi commit/merge. Nêu residual risk + phần chưa soát.

## Bảng gate
| # | Gate | Bước | Đỏ thì |
|---|------|------|--------|
| G1 | Baseline build/test/lint XANH; vùng thiếu test có characterization khoá hành vi | 1 | DỪNG, không refactor trên nền gãy / chưa có lưới an toàn |
| G2 | Mỗi bước giữ hành vi + build/test/lint XANH; dời tách trước, đổi hành vi tách riêng | 3 | Sửa/revert bước đó, không đi tiếp |
| G3 | Pattern chỉ khi gỡ phức tạp thật; HỎI duyệt trước pattern lớn; báo cáo pattern + lý do | 4 | Bỏ pattern, chọn move đơn giản hơn |
| G4 | Hồi quy so baseline + boundary check (ArchUnit/import-linter) XANH; con người duyệt diff | 5 | Không tuyên bố hoàn tất |
| G5 | 1 bước = 1 commit, DỪNG duyệt diff, không push main; giữ boundary/kiểu kiến trúc | Xuyên suốt | — |

## Sau khi xong
Tóm tắt: các move đã áp (+ `file:line`), pattern đã dùng (nếu có) kèm lý do, kết quả build/test/lint
so baseline (số THẬT), phần **chưa soát + residual risk**. Refactor giữ hành vi — nếu cần đổi nghiệp
vụ, route `backend-implement`; cần đổi *kiểu* kiến trúc, route `backend-migrate-architecture`; cần
thêm/sửa test, route `backend-testing`. Gặp ràng buộc mâu thuẫn (stack ngoài Java/Python chưa có
dấu hiệu trong references, hoặc không lập được baseline xanh), DỪNG và BÁO thay vì tự đi chệch.
