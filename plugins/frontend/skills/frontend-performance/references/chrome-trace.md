# Chrome performance trace — tầng profile thứ ba (đắt nhất)

Tài liệu tham chiếu cho `frontend-performance`, chế độ `profile` (tầng 3). Mọi lệnh, cờ và tên panel/trường trace
trong file này chưa được đối chiếu với tài liệu chính thức của phiên bản Chrome/Lighthouse đang dùng → gắn
`[Unverified]`; tham chiếu chính thức: https://developer.chrome.com/docs/devtools/performance.

## Khi nào dùng

- Bundle không có điểm bất thường (`bundle-analysis.md`) và render không có commit thừa (`profiling-react.md`),
  nhưng TBT/LCP vẫn cao; hoặc bottleneck nằm ngoài React (script bên thứ ba đã nằm trong bundle, layout, font,
  ảnh).
- Cần trả lời: **main thread bận ở đâu**, **long task** nào, ai gây.

## Lấy trace

Trace luôn lấy trên **bản build production phục vụ ở local** (`serve-production-build.md`), profile Chrome sạch.

| Cách | Mô tả | Ghi chú |
|---|---|---|
| DevTools Performance panel | Mở localhost, bấm ghi, thực hiện luồng, dừng, lưu trace ra file | Thủ công; hướng dẫn người dùng làm `[Unverified]` |
| Lighthouse `--save-assets` | `npx lighthouse <url localhost> --save-assets` lưu `*.trace.json` cạnh báo cáo | `[Unverified]` cờ và tên file theo phiên bản |
| Chrome `--trace-startup` | `chrome --trace-startup --trace-startup-file=perf/frontend/trace.json` | `[Unverified]` cờ; chỉ giai đoạn khởi động |

- Trace lưu ở `perf/frontend/` (backend dùng `perf/backend/`, không ghi đè nhau).
- **Không** upload trace lên dịch vụ ngoài: trace chứa URL, tên script, đôi khi dữ liệu trang (P1).
- Luồng cần đăng nhập: tài khoản test, token qua biến môi trường, chỉ nêu tên biến. Trace chứa cookie/token →
  không commit, không dán vào report.
- Thiếu Chrome → `not_run` + lý do.

## Đọc trace

1. **Long task:** task trên main thread > 50 ms `[Unverified]` ngưỡng theo định nghĩa của công cụ. Liệt kê task
   dài nhất, thời lượng (số thật), mốc thời gian so với LCP.
2. **Script evaluation:** tên bundle/hàm chiếm thời gian parse/compile/execute; khớp với chunk lớn từ tầng 1.
3. **Layout/style thrash:** chuỗi đọc layout (`offsetHeight`) xen ghi style lặp lại gây forced reflow; recalc
   style/layout lặp nhiều lần trong một frame.
4. **Third-party/handler:** script ngoài, event handler chạy lâu (liên quan INP thật, không đo được trong lab).
5. **Tài nguyên chặn render:** CSS/font/ảnh LCP tải muộn.

## Ghi lệnh vào report Bước 3

Lệnh lấy trace, cờ, phiên bản Chrome/Lighthouse (lấy từ output lệnh) và đường dẫn file trace ghi vào **report
Bước 3** (hoặc `perf/profile-<luồng>.md`), **không** vào bảng điều kiện đo của Bước 2. Nếu trace cần thêm cờ hay
config sửa file ngoài `perf/`/`bench/` → phải nằm trong hàng Config tool đo hoặc hỏi trước (P5). Không sửa `src/`.

## Đầu ra

Bottleneck + evidence: long task (thời lượng, mốc), hàm/script chiếm thời gian (tên, số thật), `file:line` hoặc
tên chunk liên quan, giả thuyết nguyên nhân (P4: có số đo, không chỉ suy từ đọc code), danh sách file/component đề
xuất sửa cho `frontend-fix`. Nêu **residual risk**: một thiết bị giả lập, trace là một lần ghi, lab ≠ người dùng
thật.
