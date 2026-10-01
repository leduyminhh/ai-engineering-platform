# Phục vụ bản build production ở local — điều kiện bắt buộc của mọi lần đo

Tài liệu tham chiếu cho `frontend-performance`, chế độ `measure`. Mọi lệnh và cờ trong file này chưa được đối
chiếu với tài liệu chính thức của phiên bản project đang dùng → gắn `[Unverified]`; kiểm lại với `package.json`
và `--help` của công cụ thật.

## Vì sao không đo trên dev server

Dev server (HMR, source map, React dev build, không minify, không tách chunk như production) làm số đo vô nghĩa:
LCP/TBT và kích thước bundle không đại diện cho thứ người dùng nhận. Chỉ đo trên **bản build production** phục
vụ ở local. Project chỉ có dev server, không có cách phục vụ bản build → xem mục "Không có lệnh phục vụ".

## Bước 1 — build production

```bash
npm run build   # [Unverified] tên script lấy từ package.json của project
```

Dùng đúng script build của project (không tự đổi cờ minify/sourcemap). Ghi commit SHA và
`git diff --name-only` vào bảng điều kiện (`measure-conditions.md`).

## Bước 2 — phục vụ local

Chọn lệnh theo bundler/framework project đang dùng; ghi lệnh nguyên văn + port vào hàng "Phục vụ bản build".

| Stack | Lệnh phục vụ mẫu | Ghi chú |
|---|---|---|
| Vite | `npx vite preview --port 4173` | `[Unverified]` cờ `--port`; phục vụ thư mục `dist/` |
| Next.js | `npx next start -p 3000` | `[Unverified]` cờ `-p`; cần `next build` trước |
| Tĩnh khác (CRA, webpack) | `npx serve dist -l 4173` | `[Unverified]` cờ `-l`; `serve` là dependency mới → hỏi trước |

- Dùng script phục vụ project đã có (vd `npm run preview`) nếu có; thêm gói mới (`serve`) → **hỏi trước**, chạy
  như subagent thì trả `blocked` + câu hỏi.
- Chỉ bind `localhost`/`127.0.0.1`. Không mở cổng ra mạng, không tunnel ra ngoài (P1).
- Tiến trình phục vụ chạy nền; ghi ai start (agent hay người dùng), port, thời điểm start.

## Bước 3 — xác nhận bản phục vụ là bản đang cần đo

Ở Bước 5, build lại + phục vụ lại từ working tree rồi xác nhận là bản **mới** trước khi đo:

```bash
ls dist/assets | sort > perf/frontend/assets-after.txt   # [Unverified] thư mục output theo bundler
diff perf/frontend/assets-baseline.txt perf/frontend/assets-after.txt
```

- Hash trong tên file/tên chunk **khác** baseline → là bản mới, tiếp tục.
- Trùng hoàn toàn baseline → dừng, báo "chưa phải bản mới" (thay đổi chưa vào build, hoặc đang phục vụ bản cũ).
- Tên chunk không có hash (cấu hình tắt) → so bằng `git hash-object` của file chunk chính.
- Cổng đã có tiến trình cũ chiếm → dừng tiến trình do chính agent start; tiến trình của người dùng → hỏi.

## Không có lệnh phục vụ

Project không có script phục vụ bản build và agent không được thêm gói → **không** chuyển sang dev server để
"đo tạm". Trả `blocked` + câu hỏi, ví dụ: "Project chưa có lệnh phục vụ bản build production. Được thêm
`serve` làm devDependency hay bạn cung cấp lệnh?" Chạy được trên dev server mà người dùng vẫn muốn → ghi rõ số đó
không dùng để so sánh trước/sau.
