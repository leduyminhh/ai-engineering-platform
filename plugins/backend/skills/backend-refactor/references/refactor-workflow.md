# Cổng behavior-preserving — baseline → characterization → bước nhỏ → verify

Tài liệu tham chiếu cho `backend-refactor`. Mô tả chi tiết chuỗi cổng G bảo đảm refactor **giữ hành
vi**: từ baseline xanh, dựng lưới an toàn (characterization test), làm từng bước nhỏ giữ xanh, đến
verify + con người duyệt. Trung tính stack; lệnh minh hoạ bằng Java/Spring và Python.

## Nguyên tắc trục
Refactor an toàn = **không đổi hành vi quan sát được**, chứng minh bằng test XANH liên tục — không
phải bằng lời. Vì vậy mọi cổng đều quy về câu hỏi: *"Trước và sau bước này, cùng input có cùng output
+ side-effect không?"* Test là lưới an toàn; thiếu lưới thì dựng lưới trước, không refactor "mù".

## CỔNG G1 — Baseline XANH
- Chạy build + test + lint hiện trạng; ghi **lệnh + kết quả THẬT**.
  - Java: `mvn verify` / `./gradlew build` (+ ArchUnit nếu có).
  - Python: `pytest` + `ruff`/`flake8` + `mypy` (nếu dự án dùng) + `lint-imports` nếu có import-linter.
- Baseline **đỏ** → DỪNG. Không refactor trên nền gãy: báo trạng thái, đề xuất ổn định trước (test
  đỏ có phải bug thật không → route `backend-implement`; hay hạ tầng test hỏng).
- Baseline là **mốc so hồi quy** ở G4 — số pass/fail phải giữ nguyên (hoặc chỉ tăng do characterization
  test mới).

## CỔNG G1b — Characterization test (khi vùng đụng thiếu test)
Đo độ phủ quanh vùng sẽ refactor. Vùng RỦI RO (sẽ tách/dời/đảo phụ thuộc) mà THIẾU test:
- **Viết characterization test khoá hành vi HIỆN TẠI TRƯỚC khi động code:** gọi qua **điểm vào công
  khai** (API/service/hàm public), chốt output + side-effect quan sát được (giá trị trả, bản ghi DB,
  message phát ra). Không cần "đúng nghiệp vụ" — chỉ cần **chụp lại hành vi đang chạy**, kể cả hành
  vi lạ (ghi chú `[giả định]` nếu nghi là bug, xử sau, KHÔNG sửa trong lúc refactor).
- Xác nhận test mới **XANH trên code CŨ** — nếu không xanh, chưa hiểu đúng hành vi hiện tại, DỪNG.
- Trỏ `backend-testing` để viết test đúng chuẩn dự án. Characterization test **ở lại repo** làm tài sản.
- Không có điểm vào rõ để khoá hành vi → BÁO rủi ro, đề xuất thu hẹp phạm vi refactor.

## CỔNG G2 — Bước nhỏ, XANH sau mỗi bước
Vòng lặp chính. Mỗi bước:
1. Nêu ngắn: move gì (tham chiếu [refactor-catalog.md](refactor-catalog.md)), file dự kiến đụng.
2. Thực hiện **một** loại thay đổi, phạm vi nhỏ. **Dời/đổi tên/tách trước; đổi hành vi là bước RIÊNG.**
   Ưu tiên refactoring tự động của IDE (Rename/Extract/Move) hơn sửa tay.
3. Chạy build + test (gồm characterization) + lint. **Đỏ → sửa hoặc `git`-revert BƯỚC ĐÓ**, không đi
   tiếp; không dồn nhiều move rồi mới chạy.
4. **1 bước = 1 commit** (header ≤72, body tiếng Việt có dấu, nói đúng một move). Không push thẳng main;
   con người **duyệt diff** trước merge/push (protected branch: mỗi commit).

Ranh giới trong G2:
- Phát hiện bug lúc dọn → GHI LẠI, KHÔNG sửa trong bước refactor (trộn dọn + sửa làm diff khó duyệt
  và phá tính "giữ hành vi"); xử ở bước/commit riêng, route `backend-implement`.
- Không đổi format log/metric/contract công khai (đó là hành vi quan sát được).
- Giữ **kiểu kiến trúc và Dependency Rule** hiện tại; cần đổi *kiểu* kiến trúc → DỪNG, route
  `backend-migrate-architecture`.

## CỔNG G3 — Design pattern (nếu leo lên pattern)
Chỉ khi move đơn giản không gỡ được áp lực thiết kế thật. **HỎI người dùng duyệt TRƯỚC khi áp pattern
lớn.** Đối chiếu [design-patterns.md](design-patterns.md). Áp xong vẫn phải qua G2 (bước nhỏ, XANH) và
báo cáo pattern + lý do + phương án đơn giản đã bác.

## CỔNG G4 — Verify + con người duyệt
- Chạy lại FULL build + test + lint, **SO baseline G1** (số pass/fail, lệnh THẬT). Fail → DỪNG, sửa;
  KHÔNG tuyên bố hoàn tất khi suite chưa xanh. CI thiếu hạ tầng để chạy phần nào → BÁO scope skip,
  không im lặng coi như đã phủ.
- Có ArchUnit/import-linter → chạy để chứng minh **boundary còn nguyên** (refactor không rò tầng,
  không đổi chiều phụ thuộc ngoài ý muốn).
- Đối chiếu characterization test: hành vi quan sát được KHÔNG đổi.
- Con người **duyệt diff** cuối trước merge. Báo cáo: move đã áp (+ `file:line`), pattern (nếu có),
  kết quả so baseline, **residual risk + phần chưa soát** (characterization chỉ khoá hành vi qua điểm
  vào đã chọn — có thể sót đường đi chưa nghĩ tới hoặc hành vi runtime không lộ trong test tĩnh).

## Bảng gate (khớp SKILL)
| # | Gate | Đỏ thì |
|---|------|--------|
| G1 | Baseline build/test/lint XANH | DỪNG, không refactor trên nền gãy |
| G1b | Vùng thiếu test có characterization khoá hành vi, xanh trên code cũ | Dựng lưới trước / thu hẹp phạm vi |
| G2 | Mỗi bước giữ hành vi + XANH; dời tách trước, đổi hành vi tách riêng; 1 bước = 1 commit | Sửa/revert bước đó, không đi tiếp |
| G3 | Pattern chỉ khi gỡ phức tạp thật; hỏi duyệt trước pattern lớn | Bỏ pattern, chọn move đơn giản |
| G4 | Hồi quy so baseline + boundary check XANH; con người duyệt diff | Không tuyên bố hoàn tất |
