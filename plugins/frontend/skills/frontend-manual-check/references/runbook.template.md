# Runbook kiểm tay — <tên thay đổi>

Request: `<đường dẫn design.md>` · Nhánh/commit đang kiểm: `<nhánh>@<hash>` · Ngày lập: `<yyyy-mm-dd>`

## Điều kiện

**Môi trường**

- URL: `<http://localhost:...>` (chỉ host local/test)
- Lệnh chạy: `<lệnh dựng FE/BE/DB test của project>`
- Tài khoản test: `<tên tài khoản hoặc tên biến môi trường; không ghi mật khẩu thật>`

**Dữ liệu seed**

| Dữ liệu | Cách tạo | Dùng ở bước |
|---|---|---|
| `<ví dụ: 3 bản ghi ở trạng thái khác nhau>` | `<script seed hoặc thao tác tay>` | `<#>` |

Tiền tố cho dữ liệu tạo mới trong lần kiểm này: `manual-check-<yyyymmdd>-`.

**Chưa dựng được** (các bước phụ thuộc ghi "chưa kiểm"): `<điều kiện thiếu, hoặc "không có">`

## Các bước

Mỗi `AC<n>.<m>` của design xuất hiện ở ít nhất một hàng. Bước phá huỷ dừng ở hộp xác nhận rồi huỷ.

| # | Thao tác | Kết quả mong đợi | AC |
|---|---|---|---|
| 1 | `<mở màn hình ...>` | `<điều nhìn thấy được>` | `AC1.1` |
| 2 | `<bấm nút ...>` | `<thông báo, trạng thái, URL mới>` | `AC1.1`, `AC1.2` |

## Kết quả đã chạy

Ngày chạy: `<yyyy-mm-dd>` · Người/agent chạy: `<tên>` · Cách chạy: `<tay | walkthrough Playwright>`

| # | Kết quả | Ghi chú |
|---|---|---|
| 1 | `PASS \| FAIL \| SKIP-SAFETY \| SKIP-PRECOND \| chưa kiểm` | `<với FAIL: kết quả thực, request lỗi; với chưa kiểm: lý do>` |

Tổng: PASS `<n>` · FAIL `<n>` · SKIP `<n>` · chưa kiểm `<n>`. ID FAIL: `<danh sách # hoặc "không có">`.

Phần chưa kiểm và rủi ro còn lại: `<liệt kê, không để trống>`
