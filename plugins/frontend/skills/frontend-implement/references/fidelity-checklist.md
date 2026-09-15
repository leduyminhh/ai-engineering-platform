# Fidelity checklist — Definition of Done cho một lần sinh

Chạy checklist này trước khi báo "xong". Ưu tiên kiểm định **tất định** (tsc/lint/build) + **self-check
trung thực** cho phần không tự verify được (độ khớp thị giác).

## Kiểm định tất định (phải xanh)

- [ ] **`tsc`** không lỗi kiểu; props đều typed, không `any` ẩn.
- [ ] **Lint** xanh, gồm **ranh giới kiến trúc**: `eslint-plugin-boundaries` (Feature-Based) / `steiger` +
      boundaries (FSD) / federation config + boundaries mỗi app (Micro-FE) — không import ngược tầng, không
      cross-import ruột feature/cùng layer/remote, không import sâu qua public API.
- [ ] **Build** (Vite/Next) qua; không import chết, không phá tree-shaking.
- [ ] Tuân thủ `code-convention.md`: đặt tên, cấu trúc thư mục, format (prettier/eslint style) xanh.

## Fidelity self-check (đối chiếu design intent)

- [ ] **Cấu trúc/hệ phân cấp** khớp thiết kế (thứ tự, nhóm, list/table lặp đúng).
- [ ] **Token** đúng: màu/spacing/typography/radius/shadow lấy từ token design-system, không giá trị lẻ
      (trừ chỗ có `TODO` đề nghị thêm token).
- [ ] **Các state** dựng đủ theo thiết kế: hover/active/disabled/selected và (nếu có) loading/empty/error.
- [ ] **Responsive** theo breakpoint project nếu thiết kế thể hiện nhiều cỡ.
- [ ] **Tái dùng component-lib** đúng chỗ (không dựng lại thứ lib đã có).

## A11y cơ bản

- [ ] Role/aria hợp lý; input có label liên kết; ảnh có alt.
- [ ] Bấm được bằng bàn phím; focus nhìn thấy; không bẫy focus ngoài dialog.
- [ ] Tương phản màu theo token đạt mức dùng được.

## Ranh giới tier (không vượt phạm vi)

- [ ] Không `fetch`/API/React Query/route/global-store trong component (xem [interaction-tiers.md](interaction-tiers.md)).
- [ ] Dữ liệu động qua `props` + `TODO(data)`; không hard-code nội dung động.
- [ ] Không nhét business rule vào presentational.

## Thành thật (bắt buộc báo)

- [ ] Nêu rõ mọi phần **`[ước lượng]`** (nhất là từ ảnh): khoảng cách/màu/độ đo suy đoán — độ trung thực
      pixel **không tự verify tuyệt đối được**, cần người kiểm mắt.
- [ ] Liệt kê giả định đã dùng (stack/lib/token thiếu) và điểm cần người xác nhận.
- [ ] **Con người duyệt diff** trước khi commit (ranh giới an toàn của khung).
