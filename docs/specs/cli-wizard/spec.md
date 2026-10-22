# Spec: cli-wizard

Cập nhật: 2026-10-22

## Mục đích

CLI `aip` và wizard là cửa vào của người dùng; năng lực này gồm các lệnh đo đạc chỉ đọc như `aip stats`.

## Phạm vi

- Gồm: `aip stats --usage [--since <số ngày|yyyy-mm-dd>]` — chỉ phần do request `2026-10-22-cost-tracking` thêm.
- Không gồm: hành vi cũ của `init`, wizard, `args` và các chế độ `aip stats` đã có (bảng context, `--session`, `--json`) chưa có yêu cầu trong spec này vì chưa có request nào chạm tới; spec sống tạo dần.

## Yêu cầu

- **cli-wizard/R1** — `aip stats --usage` đọc transcript Claude Code của project hiện tại, tổng hợp token theo model (mỗi `message.id` một lần trên toàn project (kể cả bản sao fork/resume)), tách phiên chính và subagent; chỉ đọc. `--since` lọc theo `timestamp` của từng dòng, mặc định 7 ngày, giá trị sai định dạng thì exit 2. Nguồn: [2026-10-22-cost-tracking](../../requests/2026-10-22-cost-tracking/design.md) (thêm)
- **cli-wizard/R2** — Tiền lấy từ bản ghi `cost-state` của Claude Code (giá trị `totalCostUSD` lớn nhất của phiên), aip không có bảng giá và không dự đoán hạn mức; phiên thiếu `cost-state` hiển thị `—`. Nguồn: [2026-10-22-cost-tracking](../../requests/2026-10-22-cost-tracking/design.md) (thêm)
- **cli-wizard/R3** — `aip stats --usage` (bảng và `--json`) không in nội dung hội thoại (chỉ số, tên model, `sessionId`, tên agent, tên file) và không ghi file nào. Nguồn: [2026-10-22-cost-tracking](../../requests/2026-10-22-cost-tracking/design.md) (thêm)

## Lịch sử

| Ngày | Request | ID | Thêm/đổi/bỏ |
|---|---|---|---|
| 2026-10-22 | [2026-10-22-cost-tracking](../../requests/2026-10-22-cost-tracking/design.md) | cli-wizard/R1 | thêm |
| 2026-10-22 | [2026-10-22-cost-tracking](../../requests/2026-10-22-cost-tracking/design.md) | cli-wizard/R2 | thêm |
| 2026-10-22 | [2026-10-22-cost-tracking](../../requests/2026-10-22-cost-tracking/design.md) | cli-wizard/R3 | thêm |
