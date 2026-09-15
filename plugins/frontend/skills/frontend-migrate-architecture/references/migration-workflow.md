# Quy trình migrate an toàn — chi tiết cổng G1–G6

Nguyên tắc xuyên suốt: **behavior-preserving** — di chuyển/cấu trúc lại, KHÔNG đổi hành vi nghiệp vụ. Đổi
hành vi (sửa logic, đổi UX, thêm tính năng) là **bước TÁCH RIÊNG** sau khi migrate xong, có commit riêng.

## G1 — Baseline XANH (bước 1)

Chạy và ghi lại lệnh + kết quả THẬT:
- Type-check: `tsc --noEmit`.
- Build: `npm run build` (Vite/Next).
- Test: `npm test` / `vitest run` / `jest`.
- Lint: `eslint .` (chưa có boundary rule cũng chạy lint hiện có).

Tất cả phải XANH. Đỏ → DỪNG, báo, đề xuất sửa trước khi migrate (không migrate trên nền gãy). Đây là mốc so
sánh cho CỔNG G5.

## G2 — Characterization test cho React (bước 3)

Mục tiêu: **khoá hành vi hiện tại** quanh vùng sẽ đụng, để phát hiện regression khi dời file. Chỉ cần đủ để
bắt vỡ, không cần phủ 100%.

Ưu tiên theo thứ tự:
1. **Render test:** render màn hình/component chính với props/fixtures đại diện; assert phần tử/text mốc xuất
   hiện (React Testing Library `render` + `screen.getByRole/getByText`).
2. **Interaction test:** mô phỏng tương tác nhìn thấy (click tab, mở dialog, submit form) bằng
   `@testing-library/user-event`; assert kết quả quan sát được (đổi text, hiện/ẩn phần tử).
3. **Snapshot test:** chốt markup của presentational ổn định làm lưới rộng — dùng dè, chỉ cho component ít
   đổi; snapshot lớn dễ nhiễu.

Lưu ý cho vùng có data-fetching: mock ở **ranh giới mạng** (MSW hoặc mock `api-client`/React Query), KHÔNG
mock nội bộ component — để test còn đúng sau khi dời file. Xác nhận characterization XANH trên code CŨ trước
khi động code. Test ở lại repo làm tài sản.

Không có điểm vào rõ (không màn hình/route ổn định để khoá) → BÁO rủi ro, đề xuất thu hẹp phạm vi migrate.

## G3 — Di chuyển theo lô nhỏ, XANH mỗi bước (bước 4)

### Chia lô an toàn
- Một lô = **một slice** (FSD) hoặc **một feature/domain** (Feature-Based), đủ nhỏ để review diff trong một lần.
- Thứ tự: theo mục D của [detection-heuristic.md](detection-heuristic.md) (lá/`shared` trước → gốc sau).
- Ưu tiên lô cắt được nhiều vi phạm ranh giới (c) nhất trước.

### Trong mỗi lô — chỉ 3 loại thao tác được phép
1. **DỜI file** sang thư mục đích + cập nhật đường dẫn import/alias.
2. **GOM + public API:** gom file rải rác về slice; thêm `index.ts` re-export phần công khai (FSD).
3. **TÁCH cơ học không đổi hành vi:** tách phần nối-data ra `hook`/container nhẹ, để presentational nhận qua
   props (Feature-Based/FSD); nội dung JSX/logic giữ NGUYÊN, chỉ đổi nơi ở.

**Cấm trong lô migrate:** đổi JSX render khác đi, đổi điều kiện/logic, đổi shape props theo hướng khác hành
vi, đổi endpoint/param API, đổi style nhìn thấy. Nếu buộc phải đổi → ghi TODO, làm ở bước tách riêng sau.

### Giữ XANH bằng "cùng tồn tại tạm"
Khi file khác còn import đường cũ, để **barrel re-export** ở vị trí cũ trỏ sang vị trí mới:
```ts
// vị trí cũ — re-export tạm để chưa-dời vẫn build XANH; dọn ở G5
export * from '@/entities/invoice';
```
Nhờ vậy mỗi lô độc lập vẫn `tsc` + test XANH mà không phải sửa toàn bộ import một lần.

### Cổng cuối mỗi lô (G3)
`tsc --noEmit` ✓ + test suite (gồm characterization) ✓ + build ✓. Đỏ → sửa hoặc **revert lô đó**, KHÔNG đi
tiếp. Xanh → DỪNG cho người duyệt diff → commit (1 lô = 1 commit, header ≤72, body tiếng Việt có dấu).

## G4 — Ép ranh giới (bước 5)

Xem [boundary-tooling.md](boundary-tooling.md). Bật công cụ đúng theo kiến trúc đích, giới thiệu dần
(cảnh báo → lỗi), làm XANH. Còn vi phạm → quay lại G3 sửa vị trí/phụ thuộc.

## G5 — Hồi quy toàn bộ (bước 6)

- Chạy lại FULL `tsc` + lint (gồm boundary) + build + test; SO với baseline G1 (số pass/fail) và với
  characterization G2. Có fail → DỪNG, phân tích, sửa. KHÔNG tuyên bố hoàn tất khi chưa xanh.
- CI không đủ hạ tầng để chạy phần nào → chạy phần chạy được + BÁO scope skip; không im lặng coi như đã phủ.
- Dọn barrel/re-export tạm còn sót của giai đoạn "cùng tồn tại"; cập nhật
  `project-knowledge/architecture.md` + `source-structure.md`; ghi/cập nhật ADR.

## G6 — Một bước = một commit (xuyên suốt)

Mỗi lô một commit logic, DỪNG cho người duyệt diff trước khi commit, không push thẳng main. Diff nhỏ giúp
người kiểm chứng "chỉ dời, không đổi hành vi" — đó là cơ chế an toàn chính của recipe này.

## Quy tắc vàng

> **Di chuyển trước, đổi hành vi sau.** Trong toàn bộ migrate, nếu phát hiện chỗ cần sửa logic/UX, ghi lại
> thành TODO và làm ở một PR/commit RIÊNG sau khi cấu trúc đã ổn và các gate XANH — không trộn vào lô dời.
