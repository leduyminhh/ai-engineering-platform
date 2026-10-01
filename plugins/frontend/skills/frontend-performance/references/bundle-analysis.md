# Phân tích bundle — tầng profile đầu tiên (rẻ nhất)

Tài liệu tham chiếu cho `frontend-performance`, chế độ `profile` (tầng 1) và phần kích thước bundle của chế độ
`measure`. Mọi lệnh và cờ trong file này chưa được đối chiếu với tài liệu chính thức của phiên bản project đang
dùng → gắn `[Unverified]`.

## Vì sao bắt đầu từ bundle

Kích thước bundle là chỉ số **xác định**: cùng source + cùng cấu hình build cho cùng số byte, không nhiễu như
LCP/TBT. Nên **so trực tiếp** trước/sau, không cần lặp 3 lần hay tính độ lệch. Chunk lớn là nguyên nhân phổ biến
của LCP/TBT cao, và tìm nó chỉ cần build, không cần trình duyệt.

## Lấy kích thước

1. **Từ output build** (không cần thêm tool): `npm run build` in danh sách file + kích thước (raw, thường kèm
   gzip) `[Unverified]` theo bundler. Ghi tổng và chunk lớn nhất, chép nguyên văn số.
2. **Từ thư mục output:** `ls -l dist/assets` hoặc script Node đọc `fs.statSync` `[Unverified]` thư mục theo
   bundler. Ghi rõ đo raw hay gzip và dùng cùng một loại ở cả hai lần.
3. Bundle phải build bằng cấu hình production của project, cùng commit/working tree ghi trong bảng điều kiện.

## Công cụ trực quan hóa theo bundler

Dùng cái project **đã có** trong `devDependencies`/script; thêm mới → **hỏi trước** (chạy như subagent: trả
`blocked` + câu hỏi).

| Bundler | Công cụ | Lệnh mẫu |
|---|---|---|
| Vite | `vite-bundle-visualizer` hoặc `rollup-plugin-visualizer` | `npx vite-bundle-visualizer` `[Unverified]` |
| Webpack | `webpack-bundle-analyzer` | `npx webpack-bundle-analyzer dist/stats.json` `[Unverified]` |
| Next.js | `@next/bundle-analyzer` | bật qua biến môi trường trong `next.config.js` `[Unverified]` |
| Bất kỳ (có source map) | `source-map-explorer` | `npx source-map-explorer dist/assets/*.js` `[Unverified]` |

- Bật plugin analyzer thường sửa file config build → file đó phải nằm trong hàng **Config tool đo** (P5) hoặc
  hỏi trước. Không sửa `src/`.
- `source-map-explorer` cần source map; bản build production có thể tắt source map → bật tạm là đổi config build,
  ghi vào Config tool đo và đo lại cả baseline với cùng cấu hình.
- Báo cáo analyzer (HTML/JSON) lưu ở `perf/frontend/`; không upload dịch vụ ngoài.

## Cần tìm gì

- **Chunk lớn:** chunk đầu vào (entry) lớn hơn hẳn phần còn lại → ứng viên tách.
- **Dependency nặng:** thư viện chiếm tỉ trọng lớn so với giá trị dùng (vd chart, editor, thư viện ngày giờ có
  locale), import cả package thay vì phần cần dùng.
- **Code trùng:** cùng thư viện nằm trong nhiều chunk (hai phiên bản, hoặc không dùng chunk chung).
- **Thiếu code-splitting:** route/màn hình nặng nằm trong chunk đầu vào; chưa dùng dynamic import
  (`import('./Page')` + `React.lazy`) `[Unverified]` cú pháp theo framework.
- **Không tree-shake được:** import theo kiểu CommonJS hoặc barrel file kéo cả module.

## Đầu ra của tầng này

Bottleneck + evidence: tên chunk, kích thước (số thật), dependency nào chiếm bao nhiêu, `file:line` của import
liên quan (đọc để trỏ chỗ, không để suy ra nguyên nhân thay cho số đo — P4). Giả thuyết nguyên nhân + danh
sách file đề xuất sửa cho `frontend-fix`. Bundle nhỏ, không thấy bất thường → chuyển tầng 2 (`profiling-react.md`).
