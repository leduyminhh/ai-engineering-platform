# Bật ép ranh giới sau khi tái cấu trúc (CỔNG G4)

Sau khi dời file, phải CHỨNG MINH kiến trúc đích thực sự thành hình bằng công cụ kiểm chiều import — không
chỉ "đúng thư mục". Đây là **fitness function** của kiến trúc frontend, tương đương ArchUnit/import-linter
của backend.

> **KHÔNG chép lại cấu hình vào đây.** Cấu hình gốc (`boundaries/elements`, `element-types`, thứ tự layer)
> đã có sẵn trong blueprint — dùng làm khởi điểm, chỉnh theo dự án:
> - Feature-Based → phần "Chiều phụ thuộc" của `architecture/react-feature-based.template.md`.
> - FSD → phần "Chiều phụ thuộc" của `architecture/react-fsd.template.md`.
> - Micro-Frontend → phần "federation config" + ranh giới `packages/*` của `architecture/react-micro-frontend.template.md`.

## Feature-Based → `eslint-plugin-boundaries`

- Cài `eslint-plugin-boundaries`, khai `boundaries/elements` theo cây (app/pages/features/shared) và luật
  `boundaries/element-types` "chỉ trỏ xuống" — lấy sketch từ blueprint Feature-Based.
- Luật cốt lõi phải XANH: một `feature` KHÔNG import ruột `feature` khác (**feature↔feature disallow**);
  liên kết chỉ qua `shared` hoặc compose ở `pages`; import ra ngoài feature đi qua public API `index.ts`.
- `eslint-plugin-boundaries` chặn **chiều import**, KHÔNG chặn naming — quy ước tên (`*Page`/`use*`/`*.api`)
  vẫn giữ bằng review.

## FSD → Steiger + `eslint-plugin-boundaries`

- Chạy `npx steiger ./src` — linter FSD chính thức, hiểu **layer + slice + segment + public API** (bắt
  cross-import cùng layer và import sâu qua `index.ts` mà boundaries thường không thấy). Đây là gate CHÍNH
  cho FSD.
- `eslint-plugin-boundaries` bổ trợ luật layer (chỉ import xuống) — khai `elements` theo
  app/pages/widgets/features/entities/shared, lấy sketch từ blueprint FSD.
- Hai luật cứng phải XANH: (1) chỉ import xuống, không ngược; (2) slice cùng layer KHÔNG import nhau; cộng
  (3) mọi import từ ngoài đi qua public API `index.ts`.

## Micro-Frontend → federation config + boundaries ở tầng `packages/*`

> Micro-FE là **target chỉ-lập-kế-hoạch** (không auto-move in-place). Phần này là ghi chú ranh giới cho lúc
> HIỆN THỰC kế hoạch phân rã, không phải gate G4 dời-file như hai kiến trúc trên.

- Ranh giới runtime ép bằng **federation config** (host khai `remotes`, remote `expose` module công khai,
  **React + deps nền là singleton `shared`**), KHÔNG bằng linter dời-file. Lấy sketch từ blueprint Micro-FE.
- `eslint-plugin-boundaries` áp ở **tầng `packages/*`**: remote KHÔNG import ruột remote khác (chỉ qua module
  `expose` + `packages/*`); `packages/*` KHÔNG mang nghiệp vụ chéo remote.
- Bên trong MỖI remote vẫn dùng gate FSD (`steiger` + boundaries) như mục trên.

## Giới thiệu dần (không vỡ CI giữa chừng)

Migrate lớn thường còn vi phạm tồn dư khi vừa bật rule. Bật theo bậc để CI không đỏ đồng loạt:

1. **Bậc cảnh báo:** đặt rule mức `"warn"` trước — thấy toàn bộ vi phạm còn lại mà build/CI vẫn XANH.
2. **Khoanh vùng đã sạch:** với vùng đã dời xong, nâng lên `"error"` (override theo thư mục/`overrides` của
   ESLint) để chống hồi quy ngay, phần chưa sạch vẫn `"warn"`.
3. **Xiết toàn bộ:** khi đã dọn hết (cuối G4/G5), nâng tất cả lên `"error"` và đưa `steiger`/`eslint` vào
   lệnh test/CI làm gate thường trực.

> Với dự án chưa sẵn sàng error toàn bộ, có thể chốt một "ngân sách vi phạm" tạm (đếm số warning không được
> tăng) và giảm dần theo từng lô — miễn là hướng đi về 0 và ghi rõ phần còn nợ (fail-loud).

## Định nghĩa "XANH" của CỔNG G4

- Feature-Based: `eslint` (gồm `boundaries/element-types`) không còn `error` — không còn import feature↔feature.
- FSD: `steiger ./src` sạch **và** `eslint` (gồm boundaries) không còn `error`.
- Micro-FE (khi đã hiện thực): `eslint` ở `packages/*` không còn `error`; federation build host+remotes chạy
  được với React singleton (không nhân bản); mỗi remote qua gate FSD riêng.
- Cấu hình boundary đã được đưa vào lệnh chạy test/CI để **ở lại làm gate thường trực**, không chỉ chạy tay
  một lần.

Còn `error` → kiến trúc CHƯA thành hình: quay lại bước di chuyển (G3) sửa vị trí/phụ thuộc, không nới lỏng
rule để "cho qua".
