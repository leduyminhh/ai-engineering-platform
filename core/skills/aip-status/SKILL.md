---
name: aip-status
description: "Xem tiến độ request đang chạy bằng lệnh aip status: trang HTML ở panel, widget chỉ gồm phần cần người dùng xử lý khi có vướng, hoặc text khi không có công cụ hiển thị. Dùng khi người dùng muốn \"xem tiến độ\", \"trạng thái request\", \"tiến độ các part\", \"part nào đang vướng\", \"mở trang tiến độ\". Không dùng khi cần làm tiếp plan → plan-execution."
order: 8
title: "AIP Status — xem tiến độ request và phần vướng (dùng chung)"
runsIn: execute
invoke: per-request
---

# AIP Status (skill dùng chung)

Skill chỉ đọc tiến độ qua `aip status`. Nguồn xem chính là `status.html`; widget trong chat chỉ dùng để hành động.

## Quy trình — xem tiến độ

1. **Lấy số liệu.** Chạy `aip status --json` ở gốc worktree; có tên request thì `aip status <request> --json`. Đọc khoá `needs`
   (mảng `{part, state, reason}`, `state` là `blocked` hoặc `stale`).
   Đầu ra không phải JSON (lệnh in một dòng chữ khi không có request đang chạy) thì sang bước 4 và dừng.
2. **Tạo trang.** Chạy `aip status --html` cùng tham số request. Lệnh in đường dẫn tuyệt đối tới
   `<gốc repo chính>/.aip/runs/<request>/status.html`; lấy đường dẫn đó. Bước 1 không ra JSON thì bỏ qua bước này.
3. **Hiển thị theo công cụ có sẵn.**
   - **Phiên có công cụ hiển thị** (app desktop Claude): đưa `status.html` lên panel bên để xem. Nếu `needs` không rỗng, hiện
     thêm một widget inline CHỈ gồm khối "Cần bạn xử lý": mỗi part một dòng (part, trạng thái, lý do), mỗi dòng có nút
     "Xử lý ↗" gửi vào chat lệnh `xử lý vướng part <nn>` đúng part đó (`root` là session gốc: `xử lý vướng part root`).
     Widget không vẽ lại dashboard.
     [Unverified] Cách app desktop mở panel bên và render widget chưa được kiểm trong môi trường này.
   - **Phiên không có công cụ hiển thị** (CLI): in text của `aip status` (gọn), không tạo widget.
4. **Không có request đang chạy.** Lệnh in một dòng chữ và thoát 0; báo đúng dòng đó, không tạo widget, dừng. Lệnh thoát 2
   (`Không tìm thấy request …`, sai tên request hay sai `--part`) thì báo nguyên dòng lỗi, dừng.
5. **Ai tự đưa trang.** Session gốc chạy `plan-execution` đưa trang lên ở mỗi cổng G1, G2, G3 và khi một part chuyển sang
   vướng cần người dùng (`references/task-loop.md`); skill này là cách người dùng bấm xem bất cứ lúc nào.

## Quy trình — xử lý phần vướng

Khi người dùng bấm "Xử lý ↗" hoặc nhắn `xử lý vướng part <nn>`, xử lý part đó theo bảng xử lý vướng của `references/task-loop.md`
(thuộc `plan-execution`). Skill không tự gỡ vướng khi người dùng chưa yêu cầu; việc session gốc đang chạy `plan-execution` tự gỡ các loại vướng "không hỏi" nằm ở bảng đó, không ở skill này.

## Ranh giới an toàn

- Chỉ đọc. `aip status` chỉ ghi `status.html` trong `<gốc repo chính>/.aip/runs/<request>/`; `<gốc repo chính>/.aip/.gitignore` (do `plan-execution` tạo) chứa `*` nên git bỏ qua file này.
- Không đưa `status.html`, nội dung ledger hay số liệu ra dịch vụ ngoài (publish, gist, link chia sẻ). File ở máy người dùng.
- Widget chỉ để hành động: không vẽ lại dashboard, không thêm số liệu ngoài khối "Cần bạn xử lý".
- Skill này không tự gỡ vướng khi người dùng chưa bấm nút hoặc nhắn; cách xử lý theo `plan-execution`.
- [Unverified] Với `--watch`, `status.html` có `<meta http-equiv="refresh">`; chưa kiểm trình duyệt có tự làm mới khi mở bằng `file://` hay không.
