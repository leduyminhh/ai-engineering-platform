# Cổng behavior-preserving — baseline → characterization → bước nhỏ → verify

Tài liệu tham chiếu cho `frontend-refactor`. Mô tả chi tiết chuỗi cổng G bảo đảm refactor React/TS
**giữ hành vi**: từ baseline xanh, dựng lưới an toàn (characterization render/interaction test), làm
từng bước nhỏ giữ xanh, đến verify + con người duyệt. Lệnh minh hoạ bằng hệ sinh thái React (Vite,
Vitest/Jest + Testing Library, ESLint).

## Nguyên tắc trục
Refactor an toàn = **không đổi hành vi quan sát được từ phía người dùng**, chứng minh bằng test XANH
liên tục — không phải bằng lời. Vì vậy mọi cổng đều quy về câu hỏi: *"Trước và sau bước này, cùng tương
tác có cùng UI render + cùng side-effect (request, điều hướng, message) không?"* Test là lưới an toàn;
thiếu lưới thì dựng lưới trước, không refactor "mù".

## CỔNG G1 — Baseline XANH
- Chạy build + test + lint hiện trạng; ghi **lệnh + kết quả THẬT**, vd: `tsc --noEmit`, `npm run build`
  (Vite), `vitest run` (hoặc `jest`), `eslint .` (+ `eslint-plugin-boundaries`/`steiger ./src` nếu dự án
  có gate ranh giới).
- Baseline **đỏ** → DỪNG. Không refactor trên nền gãy: báo trạng thái, đề xuất ổn định trước (test đỏ có
  phải bug thật không → route `frontend-implement`; hay hạ tầng test hỏng).
- Baseline là **mốc so hồi quy** ở G3 — số pass/fail phải giữ nguyên (hoặc chỉ tăng do characterization
  test mới).

## CỔNG G1b — Characterization test (khi vùng đụng thiếu test)
Đo độ phủ quanh vùng sẽ refactor. Vùng RỦI RO (sẽ tách component/hook, bỏ prop drilling, đổi state) mà
THIẾU test:
- **Viết characterization render/interaction test khoá hành vi HIỆN TẠI TRƯỚC khi động code:** render
  màn hình/component chính, thao tác qua **tương tác nhìn thấy được** (click/nhập bằng `userEvent`,
  query theo **role/accessible name**), chốt UI hiển thị + side-effect quan sát được (request phát ra —
  mock mạng bằng `msw`, điều hướng, message). Không cần "đúng nghiệp vụ" — chỉ **chụp lại hành vi đang
  chạy**, kể cả hành vi lạ (ghi chú `[giả định]` nếu nghi là bug, xử sau, KHÔNG sửa trong lúc refactor).
- Ưu tiên test theo **hành vi người dùng**, tránh bám chi tiết cài đặt (DOM nội bộ, thứ tự state) để test
  không giòn — nếu test bám cài đặt, chính nó sẽ vỡ khi tách component dù hành vi không đổi.
- Xác nhận test mới **XANH trên code CŨ** — nếu không xanh, chưa hiểu đúng hành vi hiện tại, DỪNG.
- Trỏ `frontend-testing` để viết test đúng chuẩn dự án. Characterization test **ở lại repo** làm tài sản.
- Không có điểm vào rõ để khoá hành vi (vd component chỉ render được khi có nhiều context ngoài) → BÁO
  rủi ro, đề xuất thu hẹp phạm vi refactor hoặc dựng provider tối thiểu cho test.

## CỔNG G2 — Bước nhỏ, XANH sau mỗi bước
Vòng lặp chính. Mỗi bước:
1. Nêu ngắn: move gì (tham chiếu [refactor-catalog.md](refactor-catalog.md)), file dự kiến đụng.
2. Thực hiện **một** loại thay đổi, phạm vi nhỏ. **Tách/đổi tên/dời trước; đổi hành vi là bước RIÊNG.**
   Ưu tiên refactoring tự động của IDE (Rename/Extract Component/Extract Function) hơn sửa tay.
3. Chạy `tsc` + test (gồm characterization) + lint + build. **Đỏ → sửa hoặc `git`-revert BƯỚC ĐÓ**,
   không đi tiếp; không dồn nhiều move rồi mới chạy.
4. **1 bước = 1 commit.** DỪNG cho người **duyệt diff** trước commit (header ≤72, body tiếng Việt có
   dấu, nói đúng một move). Không push thẳng main.

Ranh giới trong G2:
- Phát hiện bug lúc dọn → GHI LẠI, KHÔNG sửa trong bước refactor (trộn dọn + sửa làm diff khó duyệt và
  phá tính "giữ hành vi"); xử ở bước/commit riêng, route `frontend-implement`.
- Không đổi contract công khai: props công khai của component tái dùng, ARIA/role, URL/route, số/thứ tự
  request phát ra — đó là hành vi quan sát được.
- Giữ nguyên `key` trong list (đổi `key` làm remount, mất state) và thứ tự gọi hook (Rules of Hooks).
- Giữ **kiểu kiến trúc và chiều phụ thuộc** hiện tại (Feature-Based/FSD/Micro-FE); cần đổi *kiểu* kiến trúc → DỪNG,
  route `frontend-migrate-architecture`.

## CỔNG G3 — Verify + con người duyệt
- Chạy lại FULL `tsc` + test + lint + build, **SO baseline G1** (số pass/fail, lệnh THẬT). Fail → DỪNG,
  sửa; KHÔNG tuyên bố hoàn tất khi suite chưa xanh. CI thiếu hạ tầng để chạy phần nào (vd test e2e) →
  BÁO scope skip, không im lặng coi như đã phủ.
- Có `eslint-plugin-boundaries`/Steiger → chạy để chứng minh **boundary còn nguyên** (refactor không rò
  tầng, không cross-import cùng layer, không import sâu bỏ qua public API, chiều phụ thuộc không đảo ngoài
  ý muốn).
- Đối chiếu characterization test: hành vi quan sát được KHÔNG đổi.
- Con người **duyệt diff** cuối trước merge. Báo cáo: move đã áp (+ `file:line`), kết quả so baseline,
  **residual risk + phần chưa soát** (characterization chỉ khoá hành vi qua tương tác đã chọn — có thể
  sót đường đi, trạng thái, hoặc hành vi runtime không lộ trong test).

## Bảng gate (khớp SKILL)
| # | Gate | Đỏ thì |
|---|------|--------|
| G1 | Baseline build/test/lint XANH | DỪNG, không refactor trên nền gãy |
| G1b | Vùng thiếu test có characterization render/interaction khoá hành vi, xanh trên code cũ | Dựng lưới trước / thu hẹp phạm vi |
| G2 | Mỗi bước giữ hành vi + tsc/test/lint/build XANH; tách/dời trước, đổi hành vi tách riêng; 1 bước = 1 commit | Sửa/revert bước đó, không đi tiếp |
| G3 | Hồi quy so baseline + boundary check XANH; con người duyệt diff | Không tuyên bố hoàn tất |
